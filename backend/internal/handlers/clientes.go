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

type ClientesHandler struct {
	DB *sql.DB
}

func NewClientesHandler(dbConn *sql.DB) *ClientesHandler {
	return &ClientesHandler{DB: dbConn}
}

func (h *ClientesHandler) HandleCollection(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.List(w, r)
	case http.MethodPost:
		h.Create(w, r)
	default:
		auth.WriteJSONError(w, http.StatusMethodNotAllowed, "método no permitido")
	}
}

func (h *ClientesHandler) HandleItem(w http.ResponseWriter, r *http.Request) {
	idStr := strings.TrimPrefix(r.URL.Path, "/api/clientes/")
	idStr = strings.Trim(idStr, "/")
	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		auth.WriteJSONError(w, http.StatusBadRequest, "ID de cliente inválido")
		return
	}

	switch r.Method {
	case http.MethodGet:
		h.GetByID(w, r, id)
	case http.MethodPut:
		h.Update(w, r, id)
	case http.MethodDelete:
		h.Delete(w, r, id)
	default:
		auth.WriteJSONError(w, http.StatusMethodNotAllowed, "método no permitido")
	}
}

func (h *ClientesHandler) List(w http.ResponseWriter, r *http.Request) {
	if h.DB == nil {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"data":      []models.Cliente{},
			"page":      1,
			"page_size": 20,
			"total":     0,
		})
		return
	}

	q := strings.TrimSpace(r.URL.Query().Get("q"))
	tipo := strings.TrimSpace(r.URL.Query().Get("tipo"))
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("page_size"))
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	where := "WHERE 1=1"
	var args []any
	if tipo == "persona_fisica" || tipo == "empresa" {
		where += " AND tipo_cliente = ?"
		args = append(args, tipo)
	}
	if q != "" {
		like := "%" + q + "%"
		where += ` AND (
			nombres LIKE ? OR apellidos LIKE ? OR razon_social LIKE ?
			OR nombre_fantasia LIKE ? OR numero_documento LIKE ?
			OR ruc_base LIKE ? OR ruc LIKE ? OR whatsapp_completo LIKE ? OR email LIKE ?
		)`
		args = append(args, like, like, like, like, like, like, like, like, like)
	}

	var total int
	countQuery := "SELECT COUNT(*) FROM clientes " + where
	if err := h.DB.QueryRowContext(r.Context(), countQuery, args...).Scan(&total); err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "error al consultar total de clientes: "+err.Error())
		return
	}

	query := `
		SELECT
			id, tipo_cliente, COALESCE(tipo_documento,''), COALESCE(numero_documento,''),
			COALESCE(nombres,''), COALESCE(apellidos,''), COALESCE(DATE_FORMAT(fecha_nacimiento, '%Y-%m-%d'),''),
			COALESCE(sexo,''), COALESCE(nacionalidad,''), COALESCE(ruc_base,''),
			COALESCE(razon_social,''), COALESCE(nombre_fantasia,''), COALESCE(ruc,''),
			COALESCE(representante_nombre,''), COALESCE(representante_documento,''), COALESCE(persona_contacto,''),
			COALESCE(whatsapp_codigo,'+595'), COALESCE(whatsapp_numero,''), COALESCE(whatsapp_completo,''),
			COALESCE(telefono_codigo,'+595'), COALESCE(telefono_numero,''), COALESCE(telefono_completo,''),
			COALESCE(email,''), COALESCE(direccion,''), COALESCE(departamento,''),
			COALESCE(ciudad,''), COALESCE(barrio,''), COALESCE(referencia,''),
			created_at, updated_at
		FROM clientes
		` + where + `
		ORDER BY id DESC
		LIMIT ? OFFSET ?
	`
	queryArgs := append(append([]any{}, args...), pageSize, offset)
	rows, err := h.DB.QueryContext(r.Context(), query, queryArgs...)
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "error al listar clientes: "+err.Error())
		return
	}
	defer rows.Close()

	clientes := make([]models.Cliente, 0)
	for rows.Next() {
		var c models.Cliente
		if err := rows.Scan(
			&c.ID, &c.TipoCliente, &c.TipoDocumento, &c.NumeroDocumento,
			&c.Nombres, &c.Apellidos, &c.FechaNacimiento,
			&c.Sexo, &c.Nacionalidad, &c.RucBase,
			&c.RazonSocial, &c.NombreFantasia, &c.Ruc,
			&c.RepresentanteNombre, &c.RepresentanteDocumento, &c.PersonaContacto,
			&c.WhatsappCodigo, &c.WhatsappNumero, &c.WhatsappCompleto,
			&c.TelefonoCodigo, &c.TelefonoNumero, &c.TelefonoCompleto,
			&c.Email, &c.Direccion, &c.Departamento,
			&c.Ciudad, &c.Barrio, &c.Referencia,
			&c.CreatedAt, &c.UpdatedAt,
		); err != nil {
			auth.WriteJSONError(w, http.StatusInternalServerError, "error leyendo registro de cliente")
			return
		}
		clientes = append(clientes, c)
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"data":      clientes,
		"page":      page,
		"page_size": pageSize,
		"total":     total,
	})
}

func (h *ClientesHandler) GetByID(w http.ResponseWriter, r *http.Request, id int) {
	if h.DB == nil {
		auth.WriteJSONError(w, http.StatusServiceUnavailable, "base de datos no disponible")
		return
	}

	var c models.Cliente
	err := h.DB.QueryRowContext(r.Context(), `
		SELECT
			id, tipo_cliente, COALESCE(tipo_documento,''), COALESCE(numero_documento,''),
			COALESCE(nombres,''), COALESCE(apellidos,''), COALESCE(DATE_FORMAT(fecha_nacimiento, '%Y-%m-%d'),''),
			COALESCE(sexo,''), COALESCE(nacionalidad,''), COALESCE(ruc_base,''),
			COALESCE(razon_social,''), COALESCE(nombre_fantasia,''), COALESCE(ruc,''),
			COALESCE(representante_nombre,''), COALESCE(representante_documento,''), COALESCE(persona_contacto,''),
			COALESCE(whatsapp_codigo,'+595'), COALESCE(whatsapp_numero,''), COALESCE(whatsapp_completo,''),
			COALESCE(telefono_codigo,'+595'), COALESCE(telefono_numero,''), COALESCE(telefono_completo,''),
			COALESCE(email,''), COALESCE(direccion,''), COALESCE(departamento,''),
			COALESCE(ciudad,''), COALESCE(barrio,''), COALESCE(referencia,''),
			created_at, updated_at
		FROM clientes
		WHERE id = ?
	`, id).Scan(
		&c.ID, &c.TipoCliente, &c.TipoDocumento, &c.NumeroDocumento,
		&c.Nombres, &c.Apellidos, &c.FechaNacimiento,
		&c.Sexo, &c.Nacionalidad, &c.RucBase,
		&c.RazonSocial, &c.NombreFantasia, &c.Ruc,
		&c.RepresentanteNombre, &c.RepresentanteDocumento, &c.PersonaContacto,
		&c.WhatsappCodigo, &c.WhatsappNumero, &c.WhatsappCompleto,
		&c.TelefonoCodigo, &c.TelefonoNumero, &c.TelefonoCompleto,
		&c.Email, &c.Direccion, &c.Departamento,
		&c.Ciudad, &c.Barrio, &c.Referencia,
		&c.CreatedAt, &c.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		auth.WriteJSONError(w, http.StatusNotFound, "cliente no encontrado")
		return
	}
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "error al obtener cliente")
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(c)
}

func sanitizeAndValidateCliente(c *models.Cliente) string {
	c.TipoCliente = strings.TrimSpace(c.TipoCliente)
	if c.TipoCliente != "empresa" {
		c.TipoCliente = "persona_fisica"
	}

	c.TipoDocumento = strings.TrimSpace(c.TipoDocumento)
	c.NumeroDocumento = strings.TrimSpace(c.NumeroDocumento)
	c.Nombres = strings.TrimSpace(c.Nombres)
	c.Apellidos = strings.TrimSpace(c.Apellidos)
	c.FechaNacimiento = strings.TrimSpace(c.FechaNacimiento)
	c.Sexo = strings.TrimSpace(c.Sexo)
	c.Nacionalidad = strings.TrimSpace(c.Nacionalidad)
	c.RucBase = strings.TrimSpace(c.RucBase)
	c.RazonSocial = strings.TrimSpace(c.RazonSocial)
	c.NombreFantasia = strings.TrimSpace(c.NombreFantasia)
	c.Ruc = strings.TrimSpace(c.Ruc)
	c.RepresentanteNombre = strings.TrimSpace(c.RepresentanteNombre)
	c.RepresentanteDocumento = strings.TrimSpace(c.RepresentanteDocumento)
	c.PersonaContacto = strings.TrimSpace(c.PersonaContacto)
	c.WhatsappCodigo = strings.TrimSpace(c.WhatsappCodigo)
	if c.WhatsappCodigo == "" {
		c.WhatsappCodigo = "+595"
	}
	c.WhatsappNumero = strings.TrimLeft(strings.ReplaceAll(strings.TrimSpace(c.WhatsappNumero), " ", ""), "0")
	if c.WhatsappNumero != "" {
		c.WhatsappCompleto = c.WhatsappCodigo + c.WhatsappNumero
	} else {
		c.WhatsappCompleto = ""
	}

	c.TelefonoCodigo = strings.TrimSpace(c.TelefonoCodigo)
	if c.TelefonoCodigo == "" {
		c.TelefonoCodigo = "+595"
	}
	c.TelefonoNumero = strings.TrimLeft(strings.ReplaceAll(strings.TrimSpace(c.TelefonoNumero), " ", ""), "0")
	if c.TelefonoNumero != "" {
		c.TelefonoCompleto = c.TelefonoCodigo + c.TelefonoNumero
	} else {
		c.TelefonoCompleto = ""
	}

	c.Email = strings.TrimSpace(c.Email)
	c.Direccion = strings.TrimSpace(c.Direccion)
	c.Departamento = strings.TrimSpace(c.Departamento)
	c.Ciudad = strings.TrimSpace(c.Ciudad)
	c.Barrio = strings.TrimSpace(c.Barrio)
	c.Referencia = strings.TrimSpace(c.Referencia)

	if c.TipoCliente == "persona_fisica" {
		if c.TipoDocumento == "" || c.NumeroDocumento == "" {
			return "El tipo y número de documento son obligatorios."
		}
		if c.Nombres == "" || c.Apellidos == "" {
			return "Nombres y apellidos son obligatorios."
		}
	} else {
		if c.RucBase == "" {
			return "El RUC Base de la empresa es obligatorio."
		}
		if c.RazonSocial == "" {
			return "La Razón Social es obligatoria."
		}
	}

	if c.WhatsappNumero == "" {
		return "El número de WhatsApp es obligatorio."
	}
	if c.Email == "" {
		return "El correo electrónico es obligatorio."
	}

	return ""
}

func nullString(s string) any {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	return s
}

func (h *ClientesHandler) Create(w http.ResponseWriter, r *http.Request) {
	if h.DB == nil {
		auth.WriteJSONError(w, http.StatusServiceUnavailable, "base de datos no conectada")
		return
	}

	var c models.Cliente
	if err := json.NewDecoder(r.Body).Decode(&c); err != nil {
		auth.WriteJSONError(w, http.StatusBadRequest, "datos inválidos")
		return
	}

	if msg := sanitizeAndValidateCliente(&c); msg != "" {
		auth.WriteJSONError(w, http.StatusBadRequest, msg)
		return
	}

	res, err := h.DB.ExecContext(r.Context(), `
		INSERT INTO clientes (
			tipo_cliente, tipo_documento, numero_documento,
			nombres, apellidos, fecha_nacimiento, sexo, nacionalidad,
			ruc_base, razon_social, nombre_fantasia, ruc,
			representante_nombre, representante_documento, persona_contacto,
			whatsapp_codigo, whatsapp_numero, whatsapp_completo,
			telefono_codigo, telefono_numero, telefono_completo,
			email, direccion, departamento, ciudad, barrio, referencia
		) VALUES (
			?, ?, ?,
			?, ?, ?, ?, ?,
			?, ?, ?, ?,
			?, ?, ?,
			?, ?, ?,
			?, ?, ?,
			?, ?, ?, ?, ?, ?
		)
	`,
		c.TipoCliente, nullString(c.TipoDocumento), nullString(c.NumeroDocumento),
		nullString(c.Nombres), nullString(c.Apellidos), nullString(c.FechaNacimiento), nullString(c.Sexo), nullString(c.Nacionalidad),
		nullString(c.RucBase), nullString(c.RazonSocial), nullString(c.NombreFantasia), nullString(c.Ruc),
		nullString(c.RepresentanteNombre), nullString(c.RepresentanteDocumento), nullString(c.PersonaContacto),
		c.WhatsappCodigo, c.WhatsappNumero, c.WhatsappCompleto,
		c.TelefonoCodigo, nullString(c.TelefonoNumero), nullString(c.TelefonoCompleto),
		c.Email, nullString(c.Direccion), nullString(c.Departamento), nullString(c.Ciudad), nullString(c.Barrio), nullString(c.Referencia),
	)
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "error al guardar el cliente: "+err.Error())
		return
	}

	id, _ := res.LastInsertId()
	c.ID = int(id)

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(c)
}

func (h *ClientesHandler) Update(w http.ResponseWriter, r *http.Request, id int) {
	if h.DB == nil {
		auth.WriteJSONError(w, http.StatusServiceUnavailable, "base de datos no conectada")
		return
	}

	var c models.Cliente
	if err := json.NewDecoder(r.Body).Decode(&c); err != nil {
		auth.WriteJSONError(w, http.StatusBadRequest, "datos inválidos")
		return
	}

	if msg := sanitizeAndValidateCliente(&c); msg != "" {
		auth.WriteJSONError(w, http.StatusBadRequest, msg)
		return
	}

	_, err := h.DB.ExecContext(r.Context(), `
		UPDATE clientes SET
			tipo_cliente = ?, tipo_documento = ?, numero_documento = ?,
			nombres = ?, apellidos = ?, fecha_nacimiento = ?, sexo = ?, nacionalidad = ?,
			ruc_base = ?, razon_social = ?, nombre_fantasia = ?, ruc = ?,
			representante_nombre = ?, representante_documento = ?, persona_contacto = ?,
			whatsapp_codigo = ?, whatsapp_numero = ?, whatsapp_completo = ?,
			telefono_codigo = ?, telefono_numero = ?, telefono_completo = ?,
			email = ?, direccion = ?, departamento = ?, ciudad = ?, barrio = ?, referencia = ?
		WHERE id = ?
	`,
		c.TipoCliente, nullString(c.TipoDocumento), nullString(c.NumeroDocumento),
		nullString(c.Nombres), nullString(c.Apellidos), nullString(c.FechaNacimiento), nullString(c.Sexo), nullString(c.Nacionalidad),
		nullString(c.RucBase), nullString(c.RazonSocial), nullString(c.NombreFantasia), nullString(c.Ruc),
		nullString(c.RepresentanteNombre), nullString(c.RepresentanteDocumento), nullString(c.PersonaContacto),
		c.WhatsappCodigo, c.WhatsappNumero, c.WhatsappCompleto,
		c.TelefonoCodigo, nullString(c.TelefonoNumero), nullString(c.TelefonoCompleto),
		c.Email, nullString(c.Direccion), nullString(c.Departamento), nullString(c.Ciudad), nullString(c.Barrio), nullString(c.Referencia),
		id,
	)
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "error al actualizar el cliente: "+err.Error())
		return
	}

	c.ID = id
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(c)
}

func (h *ClientesHandler) Delete(w http.ResponseWriter, r *http.Request, id int) {
	if h.DB == nil {
		auth.WriteJSONError(w, http.StatusServiceUnavailable, "base de datos no conectada")
		return
	}

	_, err := h.DB.ExecContext(r.Context(), "DELETE FROM clientes WHERE id = ?", id)
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "error al eliminar el cliente")
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]string{"message": "cliente eliminado"})
}

