package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"r1/backend/internal/auth"
	"r1/backend/internal/models"
)

type PerfilesMensajesHandler struct {
	DB *sql.DB
}

func NewPerfilesMensajesHandler(dbConn *sql.DB) *PerfilesMensajesHandler {
	return &PerfilesMensajesHandler{DB: dbConn}
}

func (h *PerfilesMensajesHandler) HandleCollection(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.List(w, r)
	case http.MethodPost:
		h.Create(w, r)
	default:
		auth.WriteJSONError(w, http.StatusMethodNotAllowed, "método no permitido")
	}
}

func (h *PerfilesMensajesHandler) HandleItem(w http.ResponseWriter, r *http.Request) {
	idStr := strings.TrimPrefix(r.URL.Path, "/api/perfiles-mensajes/")
	idStr = strings.Trim(idStr, "/")
	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		auth.WriteJSONError(w, http.StatusBadRequest, "ID de perfil de mensaje inválido")
		return
	}

	switch r.Method {
	case http.MethodGet:
		h.GetByID(w, r, id)
	case http.MethodPut:
		h.Update(w, r, id)
	case http.MethodPatch:
		h.ToggleStatus(w, r, id)
	case http.MethodDelete:
		h.SoftDelete(w, r, id)
	default:
		auth.WriteJSONError(w, http.StatusMethodNotAllowed, "método no permitido")
	}
}

func (h *PerfilesMensajesHandler) List(w http.ResponseWriter, r *http.Request) {
	if h.DB == nil {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"data":      []models.PerfilMensaje{},
			"page":      1,
			"page_size": 20,
			"total":     0,
		})
		return
	}

	q := strings.TrimSpace(r.URL.Query().Get("q"))
	categoria := strings.TrimSpace(r.URL.Query().Get("categoria"))
	estado := strings.TrimSpace(r.URL.Query().Get("estado"))
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("page_size"))
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	where := "WHERE deleted_at IS NULL"
	var args []any

	if categoria != "" {
		where += " AND categoria = ?"
		args = append(args, categoria)
	}
	switch estado {
	case "activo", "Activo", "1":
		where += " AND activo = 1"
	case "inactivo", "Inactivo", "0":
		where += " AND activo = 0"
	}
	if q != "" {
		like := "%" + q + "%"
		where += " AND (titulo LIKE ? OR categoria LIKE ? OR descripcion LIKE ? OR contenido LIKE ?)"
		args = append(args, like, like, like, like)
	}

	var total int
	if err := h.DB.QueryRowContext(r.Context(), "SELECT COUNT(*) FROM perfiles_mensajes "+where, args...).Scan(&total); err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "La tabla 'perfiles_mensajes' aún no existe en la base de datos. Ejecuta el SQL de creación en phpMyAdmin.")
		return
	}

	query := `
		SELECT
			id, COALESCE(titulo, ''), COALESCE(categoria, 'General'),
			COALESCE(descripcion, ''), COALESCE(contenido, ''),
			COALESCE(activo, 1), created_at, updated_at
		FROM perfiles_mensajes
		` + where + `
		ORDER BY id ASC
		LIMIT ? OFFSET ?
	`
	queryArgs := append(args, pageSize, offset)

	rows, err := h.DB.QueryContext(r.Context(), query, queryArgs...)
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "error al listar perfiles de mensajes")
		return
	}
	defer rows.Close()

	list := make([]models.PerfilMensaje, 0)
	for rows.Next() {
		var p models.PerfilMensaje
		var activoInt int
		if err := rows.Scan(
			&p.ID, &p.Titulo, &p.Categoria,
			&p.Descripcion, &p.Contenido,
			&activoInt, &p.CreatedAt, &p.UpdatedAt,
		); err != nil {
			auth.WriteJSONError(w, http.StatusInternalServerError, "error leyendo perfil de mensaje")
			return
		}
		p.Activo = activoInt == 1
		list = append(list, p)
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"data":      list,
		"page":      page,
		"page_size": pageSize,
		"total":     total,
	})
}

func (h *PerfilesMensajesHandler) GetByID(w http.ResponseWriter, r *http.Request, id int) {
	if h.DB == nil {
		auth.WriteJSONError(w, http.StatusServiceUnavailable, "base de datos no conectada")
		return
	}

	var p models.PerfilMensaje
	var activoInt int
	err := h.DB.QueryRowContext(r.Context(), `
		SELECT
			id, COALESCE(titulo, ''), COALESCE(categoria, 'General'),
			COALESCE(descripcion, ''), COALESCE(contenido, ''),
			COALESCE(activo, 1), created_at, updated_at
		FROM perfiles_mensajes
		WHERE id = ? AND deleted_at IS NULL
	`, id).Scan(
		&p.ID, &p.Titulo, &p.Categoria,
		&p.Descripcion, &p.Contenido,
		&activoInt, &p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		auth.WriteJSONError(w, http.StatusNotFound, "perfil de mensaje no encontrado")
		return
	}
	p.Activo = activoInt == 1

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(p)
}

func validatePerfilMensajePayload(p *models.PerfilMensaje) string {
	p.Titulo = strings.TrimSpace(p.Titulo)
	p.Categoria = strings.TrimSpace(p.Categoria)
	p.Descripcion = strings.TrimSpace(p.Descripcion)
	p.Contenido = strings.TrimSpace(p.Contenido)

	if p.Titulo == "" {
		return "el Nombre / Título del Perfil es obligatorio"
	}
	if p.Categoria == "" {
		p.Categoria = "General"
	}
	if p.Contenido == "" {
		return "el Contenido del Mensaje de WhatsApp es obligatorio"
	}
	return ""
}

func (h *PerfilesMensajesHandler) Create(w http.ResponseWriter, r *http.Request) {
	if h.DB == nil {
		auth.WriteJSONError(w, http.StatusServiceUnavailable, "base de datos no conectada")
		return
	}

	var payload models.PerfilMensaje
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		auth.WriteJSONError(w, http.StatusBadRequest, "formato de datos inválido")
		return
	}

	if msg := validatePerfilMensajePayload(&payload); msg != "" {
		auth.WriteJSONError(w, http.StatusBadRequest, msg)
		return
	}

	activoInt := 1
	if !payload.Activo {
		activoInt = 0
	}

	res, err := h.DB.ExecContext(r.Context(), `
		INSERT INTO perfiles_mensajes (titulo, categoria, descripcion, contenido, activo)
		VALUES (?, ?, ?, ?, ?)
	`, payload.Titulo, payload.Categoria, payload.Descripcion, payload.Contenido, activoInt)
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "no se pudo guardar el perfil de mensaje")
		return
	}

	id64, _ := res.LastInsertId()
	payload.ID = int(id64)

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(payload)
}

func (h *PerfilesMensajesHandler) Update(w http.ResponseWriter, r *http.Request, id int) {
	if h.DB == nil {
		auth.WriteJSONError(w, http.StatusServiceUnavailable, "base de datos no conectada")
		return
	}

	var payload models.PerfilMensaje
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		auth.WriteJSONError(w, http.StatusBadRequest, "formato de datos inválido")
		return
	}

	if msg := validatePerfilMensajePayload(&payload); msg != "" {
		auth.WriteJSONError(w, http.StatusBadRequest, msg)
		return
	}

	activoInt := 1
	if !payload.Activo {
		activoInt = 0
	}

	_, err := h.DB.ExecContext(r.Context(), `
		UPDATE perfiles_mensajes SET
			titulo = ?, categoria = ?, descripcion = ?, contenido = ?, activo = ?
		WHERE id = ? AND deleted_at IS NULL
	`, payload.Titulo, payload.Categoria, payload.Descripcion, payload.Contenido, activoInt, id)
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "no se pudo actualizar el perfil de mensaje")
		return
	}

	payload.ID = id
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(payload)
}

func (h *PerfilesMensajesHandler) ToggleStatus(w http.ResponseWriter, r *http.Request, id int) {
	if h.DB == nil {
		auth.WriteJSONError(w, http.StatusServiceUnavailable, "base de datos no conectada")
		return
	}

	var req struct {
		Activo *bool `json:"activo"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)

	var err error
	if req.Activo != nil {
		activoInt := 0
		if *req.Activo {
			activoInt = 1
		}
		_, err = h.DB.ExecContext(r.Context(), `
			UPDATE perfiles_mensajes SET activo = ? WHERE id = ? AND deleted_at IS NULL
		`, activoInt, id)
	} else {
		_, err = h.DB.ExecContext(r.Context(), `
			UPDATE perfiles_mensajes SET activo = CASE WHEN activo = 1 THEN 0 ELSE 1 END WHERE id = ? AND deleted_at IS NULL
		`, id)
	}
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "no se pudo cambiar el estado del perfil")
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]string{"message": "estado actualizado"})
}

func (h *PerfilesMensajesHandler) SoftDelete(w http.ResponseWriter, r *http.Request, id int) {
	if h.DB == nil {
		auth.WriteJSONError(w, http.StatusServiceUnavailable, "base de datos no conectada")
		return
	}

	actor := auth.CurrentActorName(r)
	_, err := h.DB.ExecContext(r.Context(), `
		UPDATE perfiles_mensajes
		SET deleted_at = NOW(), deleted_by = ?
		WHERE id = ? AND deleted_at IS NULL
	`, actor, id)
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "no se pudo enviar el perfil a Reciclaje")
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]string{
		"message": "perfil enviado a reciclaje",
	})
}

