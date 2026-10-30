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

type DifusionMensajesHandler struct {
	DB *sql.DB
	WA *WhatsAppHandler
}

func NewDifusionMensajesHandler(dbConn *sql.DB, waHandler *WhatsAppHandler) *DifusionMensajesHandler {
	return &DifusionMensajesHandler{DB: dbConn, WA: waHandler}
}

func (h *DifusionMensajesHandler) HandleCollection(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.List(w, r)
	case http.MethodPost:
		h.Create(w, r)
	default:
		auth.WriteJSONError(w, http.StatusMethodNotAllowed, "método no permitido")
	}
}

func (h *DifusionMensajesHandler) HandleItem(w http.ResponseWriter, r *http.Request) {
	idStr := strings.TrimPrefix(r.URL.Path, "/api/difusion-mensajes/")
	idStr = strings.Trim(idStr, "/")
	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		auth.WriteJSONError(w, http.StatusBadRequest, "ID de mensaje inválido")
		return
	}

	switch r.Method {
	case http.MethodGet:
		h.GetByID(w, r, id)
	case http.MethodPut:
		h.Update(w, r, id)
	case http.MethodDelete:
		h.SoftDelete(w, r, id)
	default:
		auth.WriteJSONError(w, http.StatusMethodNotAllowed, "método no permitido")
	}
}

func (h *DifusionMensajesHandler) List(w http.ResponseWriter, r *http.Request) {
	if h.DB == nil {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"data":      []models.MensajeHistorial{},
			"page":      1,
			"page_size": 20,
			"total":     0,
		})
		return
	}

	q := strings.TrimSpace(r.URL.Query().Get("q"))
	tipo := strings.TrimSpace(r.URL.Query().Get("tipo"))
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

	if tipo != "" {
		where += " AND tipo = ?"
		args = append(args, tipo)
	}
	if estado != "" {
		where += " AND estado = ?"
		args = append(args, estado)
	}
	if q != "" {
		like := "%" + q + "%"
		where += " AND (nombre_destinatario LIKE ? OR telefono_destinatario LIKE ? OR contenido LIKE ? OR tipo LIKE ? OR adjunto_nombre LIKE ?)"
		args = append(args, like, like, like, like, like)
	}

	var total int
	if err := h.DB.QueryRowContext(r.Context(), "SELECT COUNT(*) FROM mensajes_historial "+where, args...).Scan(&total); err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "La tabla 'mensajes_historial' aún no existe en la base de datos. Ejecuta el SQL de creación en phpMyAdmin.")
		return
	}

	query := `
		SELECT
			id, COALESCE(tipo, 'Mensaje'), COALESCE(contacto_origen, 'Manual'),
			COALESCE(nombre_destinatario, '—'), COALESCE(telefono_destinatario, ''),
			COALESCE(plantilla_titulo, ''), COALESCE(contenido, ''),
			COALESCE(adjunto_nombre, ''), COALESCE(adjunto_formato, ''),
			COALESCE(adjunto_mime, ''), COALESCE(adjunto_data, ''),
			COALESCE(intervalo_segundos, 0),
			COALESCE(DATE_FORMAT(programado_para, '%Y-%m-%d %H:%i:%s'), ''),
			COALESCE(estado, 'Enviado'),
			created_at, updated_at
		FROM mensajes_historial
		` + where + `
		ORDER BY id DESC
		LIMIT ? OFFSET ?
	`
	queryArgs := append(args, pageSize, offset)

	rows, err := h.DB.QueryContext(r.Context(), query, queryArgs...)
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "error al listar el historial de mensajes")
		return
	}
	defer rows.Close()

	list := make([]models.MensajeHistorial, 0)
	for rows.Next() {
		var m models.MensajeHistorial
		if err := rows.Scan(
			&m.ID, &m.Tipo, &m.ContactoOrigen,
			&m.NombreDestinatario, &m.TelefonoDestinatario,
			&m.PlantillaTitulo, &m.Contenido,
			&m.AdjuntoNombre, &m.AdjuntoFormato,
			&m.AdjuntoMime, &m.AdjuntoData,
			&m.IntervaloSegundos, &m.ProgramadoPara,
			&m.Estado, &m.CreatedAt, &m.UpdatedAt,
		); err != nil {
			auth.WriteJSONError(w, http.StatusInternalServerError, "error leyendo registro de historial de mensajes")
			return
		}
		list = append(list, m)
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"data":      list,
		"page":      page,
		"page_size": pageSize,
		"total":     total,
	})
}

func (h *DifusionMensajesHandler) GetByID(w http.ResponseWriter, r *http.Request, id int) {
	if h.DB == nil {
		auth.WriteJSONError(w, http.StatusServiceUnavailable, "base de datos no conectada")
		return
	}

	var m models.MensajeHistorial
	err := h.DB.QueryRowContext(r.Context(), `
		SELECT
			id, COALESCE(tipo, 'Mensaje'), COALESCE(contacto_origen, 'Manual'),
			COALESCE(nombre_destinatario, '—'), COALESCE(telefono_destinatario, ''),
			COALESCE(plantilla_titulo, ''), COALESCE(contenido, ''),
			COALESCE(adjunto_nombre, ''), COALESCE(adjunto_formato, ''),
			COALESCE(adjunto_mime, ''), COALESCE(adjunto_data, ''),
			COALESCE(intervalo_segundos, 0),
			COALESCE(DATE_FORMAT(programado_para, '%Y-%m-%d %H:%i:%s'), ''),
			COALESCE(estado, 'Enviado'),
			created_at, updated_at
		FROM mensajes_historial
		WHERE id = ? AND deleted_at IS NULL
	`, id).Scan(
		&m.ID, &m.Tipo, &m.ContactoOrigen,
		&m.NombreDestinatario, &m.TelefonoDestinatario,
		&m.PlantillaTitulo, &m.Contenido,
		&m.AdjuntoNombre, &m.AdjuntoFormato,
		&m.AdjuntoMime, &m.AdjuntoData,
		&m.IntervaloSegundos, &m.ProgramadoPara,
		&m.Estado, &m.CreatedAt, &m.UpdatedAt,
	)
	if err != nil {
		auth.WriteJSONError(w, http.StatusNotFound, "mensaje no encontrado")
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(m)
}

func (h *DifusionMensajesHandler) insertOne(r *http.Request, item *models.MensajeHistorial) (int, error) {
	item.Tipo = strings.TrimSpace(item.Tipo)
	if item.Tipo == "" {
		item.Tipo = "Mensaje"
	}
	item.ContactoOrigen = strings.TrimSpace(item.ContactoOrigen)
	if item.ContactoOrigen == "" {
		item.ContactoOrigen = "Manual"
	}
	item.NombreDestinatario = strings.TrimSpace(item.NombreDestinatario)
	if item.NombreDestinatario == "" {
		item.NombreDestinatario = "—"
	}
	item.TelefonoDestinatario = strings.TrimSpace(item.TelefonoDestinatario)
	item.PlantillaTitulo = strings.TrimSpace(item.PlantillaTitulo)
	item.Contenido = strings.TrimSpace(item.Contenido)
	item.AdjuntoNombre = strings.TrimSpace(item.AdjuntoNombre)
	item.AdjuntoFormato = strings.TrimSpace(item.AdjuntoFormato)
	item.AdjuntoMime = strings.TrimSpace(item.AdjuntoMime)
	item.AdjuntoData = strings.TrimSpace(item.AdjuntoData)
	item.Estado = strings.TrimSpace(item.Estado)
	if item.Estado == "" {
		if item.Tipo == "Programado" {
			item.Estado = "Programado"
		} else {
			item.Estado = "Enviado"
		}
	}

	var progVal any = nil
	if strings.TrimSpace(item.ProgramadoPara) != "" {
		progVal = strings.TrimSpace(item.ProgramadoPara)
	}

	res, err := h.DB.ExecContext(r.Context(), `
		INSERT INTO mensajes_historial (
			tipo, contacto_origen, nombre_destinatario, telefono_destinatario,
			plantilla_titulo, contenido,
			adjunto_nombre, adjunto_formato, adjunto_mime, adjunto_data,
			intervalo_segundos, programado_para, estado
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`,
		item.Tipo, item.ContactoOrigen, item.NombreDestinatario, item.TelefonoDestinatario,
		item.PlantillaTitulo, item.Contenido,
		item.AdjuntoNombre, item.AdjuntoFormato, item.AdjuntoMime, item.AdjuntoData,
		item.IntervaloSegundos, progVal, item.Estado,
	)
	if err != nil {
		return 0, err
	}
	id64, _ := res.LastInsertId()
	return int(id64), nil
}

func (h *DifusionMensajesHandler) Create(w http.ResponseWriter, r *http.Request) {
	if h.DB == nil {
		auth.WriteJSONError(w, http.StatusServiceUnavailable, "base de datos no conectada")
		return
	}

	// Soporta tanto un envío individual como un lote (difusión masiva: { "items": [...] })
	var raw map[string]json.RawMessage
	if err := json.NewDecoder(r.Body).Decode(&raw); err != nil {
		auth.WriteJSONError(w, http.StatusBadRequest, "formato de datos inválido")
		return
	}

	if itemsRaw, ok := raw["items"]; ok {
		var items []models.MensajeHistorial
		if err := json.Unmarshal(itemsRaw, &items); err != nil || len(items) == 0 {
			auth.WriteJSONError(w, http.StatusBadRequest, "lista de destinatarios vacía o inválida")
			return
		}
		inserted := 0
		waSentCount := 0
		var lastWaErr string
		waConnected := h.WA != nil && h.WA.IsConnected()
		for i := range items {
			if strings.TrimSpace(items[i].TelefonoDestinatario) == "" || strings.TrimSpace(items[i].Contenido) == "" {
				continue
			}
			if (items[i].Estado == "" || items[i].Estado == "Enviado") && items[i].Tipo != "Programado" {
				if !waConnected {
					items[i].Estado = "Fallido"
					lastWaErr = "La cuenta de WhatsApp no está conectada"
				} else if err := h.WA.SendMessage(
					items[i].TelefonoDestinatario,
					items[i].Contenido,
					items[i].AdjuntoData,
					items[i].AdjuntoMime,
					items[i].AdjuntoNombre,
				); err != nil {
					items[i].Estado = "Fallido"
					lastWaErr = err.Error()
				} else {
					waSentCount++
				}
			}
			id, err := h.insertOne(r, &items[i])
			if err != nil {
				auth.WriteJSONError(w, http.StatusInternalServerError, "no se pudo guardar el mensaje en la base de datos: "+err.Error())
				return
			}
			items[i].ID = id
			inserted++
		}
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"inserted":      inserted,
			"whatsapp_sent": waSentCount,
			"whatsapp_err":  lastWaErr,
			"items":         items,
		})
		return
	}

	// Envío individual o programado
	bodyBytes, _ := json.Marshal(raw)
	var single models.MensajeHistorial
	if err := json.Unmarshal(bodyBytes, &single); err != nil {
		auth.WriteJSONError(w, http.StatusBadRequest, "datos de mensaje inválidos")
		return
	}

	if strings.TrimSpace(single.TelefonoDestinatario) == "" {
		auth.WriteJSONError(w, http.StatusBadRequest, "el número de teléfono del destinatario es obligatorio")
		return
	}
	if strings.TrimSpace(single.Contenido) == "" {
		auth.WriteJSONError(w, http.StatusBadRequest, "el contenido del mensaje es obligatorio")
		return
	}

	// Si es un envío inmediato (no Programado), enviarlo por WhatsApp Web y registrar siempre en BD
	var waSendErr error
	if single.Tipo != "Programado" && (single.Estado == "" || single.Estado == "Enviado") {
		if h.WA == nil || !h.WA.IsConnected() {
			single.Estado = "Fallido"
			waSendErr = sql.ErrConnDone
		} else {
			if err := h.WA.SendMessage(
				single.TelefonoDestinatario,
				single.Contenido,
				single.AdjuntoData,
				single.AdjuntoMime,
				single.AdjuntoNombre,
			); err != nil {
				single.Estado = "Fallido"
				waSendErr = err
			}
		}
	}

	id, err := h.insertOne(r, &single)
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "no se pudo guardar el mensaje en la base de datos: "+err.Error())
		return
	}
	single.ID = id

	if waSendErr != nil {
		if waSendErr == sql.ErrConnDone {
			auth.WriteJSONError(w, http.StatusServiceUnavailable, "El mensaje se guardó en el historial como Fallido porque WhatsApp está desconectado. Vincula tu cuenta en Sesiones WhatsApp.")
			return
		}
		auth.WriteJSONError(w, http.StatusBadGateway, "No se pudo entregar por WhatsApp ("+waSendErr.Error()+"). Registrado en historial como Fallido.")
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(single)
}

func (h *DifusionMensajesHandler) Update(w http.ResponseWriter, r *http.Request, id int) {
	if h.DB == nil {
		auth.WriteJSONError(w, http.StatusServiceUnavailable, "base de datos no conectada")
		return
	}

	var payload models.MensajeHistorial
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		auth.WriteJSONError(w, http.StatusBadRequest, "formato de datos inválido")
		return
	}

	payload.NombreDestinatario = strings.TrimSpace(payload.NombreDestinatario)
	if payload.NombreDestinatario == "" {
		payload.NombreDestinatario = "—"
	}
	payload.TelefonoDestinatario = strings.TrimSpace(payload.TelefonoDestinatario)
	payload.Contenido = strings.TrimSpace(payload.Contenido)
	payload.Estado = strings.TrimSpace(payload.Estado)
	if payload.Estado == "" {
		payload.Estado = "Enviado"
	}

	if payload.TelefonoDestinatario == "" || payload.Contenido == "" {
		auth.WriteJSONError(w, http.StatusBadRequest, "el destinatario y el contenido son obligatorios")
		return
	}

	// Verificar estado anterior por si un mensaje Programado o En Cola (Difusión) pasa a Enviado ahora
	var prevEstado, adjNombre, adjMime, adjData string
	_ = h.DB.QueryRowContext(r.Context(), `
		SELECT COALESCE(estado, ''), COALESCE(adjunto_nombre, ''), COALESCE(adjunto_mime, ''), COALESCE(adjunto_data, '')
		FROM mensajes_historial
		WHERE id = ? AND deleted_at IS NULL
	`, id).Scan(&prevEstado, &adjNombre, &adjMime, &adjData)

	var waSendErr error
	if prevEstado != "Enviado" && payload.Estado == "Enviado" {
		if h.WA == nil || !h.WA.IsConnected() {
			payload.Estado = "Fallido"
			waSendErr = sql.ErrConnDone
		} else {
			mediaData := payload.AdjuntoData
			mediaMime := payload.AdjuntoMime
			mediaName := payload.AdjuntoNombre
			if mediaData == "" {
				mediaData = adjData
				mediaMime = adjMime
				mediaName = adjNombre
			}
			if err := h.WA.SendMessage(payload.TelefonoDestinatario, payload.Contenido, mediaData, mediaMime, mediaName); err != nil {
				payload.Estado = "Fallido"
				waSendErr = err
			}
		}
	}

	_, err := h.DB.ExecContext(r.Context(), `
		UPDATE mensajes_historial SET
			nombre_destinatario = ?, telefono_destinatario = ?, contenido = ?, estado = ?
		WHERE id = ? AND deleted_at IS NULL
	`, payload.NombreDestinatario, payload.TelefonoDestinatario, payload.Contenido, payload.Estado, id)
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "no se pudo actualizar el registro del mensaje")
		return
	}

	if waSendErr != nil {
		if waSendErr == sql.ErrConnDone {
			auth.WriteJSONError(w, http.StatusServiceUnavailable, "WhatsApp desconectado al intentar enviar mensaje en cola/programado.")
			return
		}
		auth.WriteJSONError(w, http.StatusBadGateway, "Error enviando por WhatsApp: "+waSendErr.Error())
		return
	}

	payload.ID = id
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(payload)
}

func (h *DifusionMensajesHandler) SoftDelete(w http.ResponseWriter, r *http.Request, id int) {
	if h.DB == nil {
		auth.WriteJSONError(w, http.StatusServiceUnavailable, "base de datos no conectada")
		return
	}

	actor := auth.CurrentActorName(r)
	_, err := h.DB.ExecContext(r.Context(), `
		UPDATE mensajes_historial
		SET deleted_at = NOW(), deleted_by = ?
		WHERE id = ? AND deleted_at IS NULL
	`, actor, id)
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "no se pudo enviar el mensaje a Reciclaje")
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]string{
		"message": "mensaje enviado a reciclaje",
	})
}

