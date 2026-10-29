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

type ProveedoresHandler struct {
	DB *sql.DB
}

func NewProveedoresHandler(dbConn *sql.DB) *ProveedoresHandler {
	return &ProveedoresHandler{DB: dbConn}
}

func (h *ProveedoresHandler) HandleCollection(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.List(w, r)
	case http.MethodPost:
		h.Create(w, r)
	default:
		auth.WriteJSONError(w, http.StatusMethodNotAllowed, "método no permitido")
	}
}

func (h *ProveedoresHandler) HandleItem(w http.ResponseWriter, r *http.Request) {
	idStr := strings.TrimPrefix(r.URL.Path, "/api/proveedores/")
	idStr = strings.Trim(idStr, "/")
	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		auth.WriteJSONError(w, http.StatusBadRequest, "ID de proveedor inválido")
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

func (h *ProveedoresHandler) List(w http.ResponseWriter, r *http.Request) {
	if h.DB == nil {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"data":      []models.Proveedor{},
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

	if tipo == "Empresa" || tipo == "Persona Física" {
		where += " AND tipo_proveedor = ?"
		args = append(args, tipo)
	}
	if estado == "Activo" || estado == "Inactivo" {
		where += " AND estado = ?"
		args = append(args, estado)
	}
	if q != "" {
		like := "%" + q + "%"
		where += ` AND (
			razon_social LIKE ? OR nombre_comercial LIKE ? OR ruc_documento LIKE ?
			OR rubro LIKE ? OR contacto_nombre LIKE ? OR email_general LIKE ?
			OR telefono_corporativo LIKE ? OR contacto_telefono LIKE ?
		)`
		args = append(args, like, like, like, like, like, like, like, like)
	}

	var total int
	if err := h.DB.QueryRowContext(r.Context(), "SELECT COUNT(*) FROM proveedores "+where, args...).Scan(&total); err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "La tabla 'proveedores' aún no existe en la base de datos. Ejecuta el SQL de creación en phpMyAdmin.")
		return
	}

	query := `
		SELECT
			id, COALESCE(tipo_proveedor,'Empresa'), COALESCE(razon_social,''), COALESCE(nombre_comercial,''),
			COALESCE(ruc_documento,''), COALESCE(direccion,''), COALESCE(ciudad,''), COALESCE(pais,'Paraguay'),
			COALESCE(telefono_codigo,'+595'), COALESCE(telefono_numero,''), COALESCE(telefono_corporativo,''),
			COALESCE(email_general,''), COALESCE(sitio_web,''),
			COALESCE(contacto_nombre,''), COALESCE(contacto_cargo,''),
			COALESCE(whatsapp_codigo,'+595'), COALESCE(whatsapp_numero,''), COALESCE(contacto_telefono,''),
			COALESCE(contacto_email,''),
			COALESCE(banco,''), COALESCE(numero_cuenta,''), COALESCE(moneda,'Gs'), COALESCE(condicion_pago,'Contado'),
			COALESCE(rubro,''), COALESCE(tiempo_entrega_dias, 0), COALESCE(estado,'Activo'),
			created_at, updated_at
		FROM proveedores
		` + where + `
		ORDER BY id DESC
		LIMIT ? OFFSET ?
	`
	queryArgs := append(append([]any{}, args...), pageSize, offset)
	rows, err := h.DB.QueryContext(r.Context(), query, queryArgs...)
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "error al listar proveedores: "+err.Error())
		return
	}
	defer rows.Close()

	list := make([]models.Proveedor, 0)
	for rows.Next() {
		var p models.Proveedor
		if err := rows.Scan(
			&p.ID, &p.TipoProveedor, &p.RazonSocial, &p.NombreComercial,
			&p.RucDocumento, &p.Direccion, &p.Ciudad, &p.Pais,
			&p.TelefonoCodigo, &p.TelefonoNumero, &p.TelefonoCorporativo,
			&p.EmailGeneral, &p.SitioWeb,
			&p.ContactoNombre, &p.ContactoCargo,
			&p.WhatsappCodigo, &p.WhatsappNumero, &p.ContactoTelefono,
			&p.ContactoEmail,
			&p.Banco, &p.NumeroCuenta, &p.Moneda, &p.CondicionPago,
			&p.Rubro, &p.TiempoEntregaDias, &p.Estado,
			&p.CreatedAt, &p.UpdatedAt,
		); err != nil {
			auth.WriteJSONError(w, http.StatusInternalServerError, "error leyendo registro de proveedor")
			return
		}
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

func (h *ProveedoresHandler) GetByID(w http.ResponseWriter, r *http.Request, id int) {
	if h.DB == nil {
		auth.WriteJSONError(w, http.StatusServiceUnavailable, "base de datos no disponible")
		return
	}

	var p models.Proveedor
	err := h.DB.QueryRowContext(r.Context(), `
		SELECT
			id, COALESCE(tipo_proveedor,'Empresa'), COALESCE(razon_social,''), COALESCE(nombre_comercial,''),
			COALESCE(ruc_documento,''), COALESCE(direccion,''), COALESCE(ciudad,''), COALESCE(pais,'Paraguay'),
			COALESCE(telefono_codigo,'+595'), COALESCE(telefono_numero,''), COALESCE(telefono_corporativo,''),
			COALESCE(email_general,''), COALESCE(sitio_web,''),
			COALESCE(contacto_nombre,''), COALESCE(contacto_cargo,''),
			COALESCE(whatsapp_codigo,'+595'), COALESCE(whatsapp_numero,''), COALESCE(contacto_telefono,''),
			COALESCE(contacto_email,''),
			COALESCE(banco,''), COALESCE(numero_cuenta,''), COALESCE(moneda,'Gs'), COALESCE(condicion_pago,'Contado'),
			COALESCE(rubro,''), COALESCE(tiempo_entrega_dias, 0), COALESCE(estado,'Activo'),
			created_at, updated_at
		FROM proveedores
		WHERE id = ? AND deleted_at IS NULL
	`, id).Scan(
		&p.ID, &p.TipoProveedor, &p.RazonSocial, &p.NombreComercial,
		&p.RucDocumento, &p.Direccion, &p.Ciudad, &p.Pais,
		&p.TelefonoCodigo, &p.TelefonoNumero, &p.TelefonoCorporativo,
		&p.EmailGeneral, &p.SitioWeb,
		&p.ContactoNombre, &p.ContactoCargo,
		&p.WhatsappCodigo, &p.WhatsappNumero, &p.ContactoTelefono,
		&p.ContactoEmail,
		&p.Banco, &p.NumeroCuenta, &p.Moneda, &p.CondicionPago,
		&p.Rubro, &p.TiempoEntregaDias, &p.Estado,
		&p.CreatedAt, &p.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		auth.WriteJSONError(w, http.StatusNotFound, "proveedor no encontrado")
		return
	}
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "error al obtener proveedor")
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(p)
}

func sanitizeAndValidateProveedor(p *models.Proveedor) string {
	p.TipoProveedor = strings.TrimSpace(p.TipoProveedor)
	if p.TipoProveedor != "Persona Física" {
		p.TipoProveedor = "Empresa"
	}

	p.RazonSocial = strings.TrimSpace(p.RazonSocial)
	p.NombreComercial = strings.TrimSpace(p.NombreComercial)
	p.RucDocumento = strings.TrimSpace(p.RucDocumento)
	p.Direccion = strings.TrimSpace(p.Direccion)
	p.Ciudad = strings.TrimSpace(p.Ciudad)
	p.Pais = strings.TrimSpace(p.Pais)
	if p.Pais == "" {
		p.Pais = "Paraguay"
	}

	p.TelefonoCodigo = strings.TrimSpace(p.TelefonoCodigo)
	if p.TelefonoCodigo == "" {
		p.TelefonoCodigo = "+595"
	}
	p.TelefonoNumero = strings.TrimLeft(strings.ReplaceAll(strings.TrimSpace(p.TelefonoNumero), " ", ""), "0")
	if p.TelefonoNumero != "" {
		p.TelefonoCorporativo = p.TelefonoCodigo + p.TelefonoNumero
	} else {
		p.TelefonoCorporativo = ""
	}

	p.EmailGeneral = strings.TrimSpace(p.EmailGeneral)
	p.SitioWeb = strings.TrimSpace(p.SitioWeb)
	p.ContactoNombre = strings.TrimSpace(p.ContactoNombre)
	p.ContactoCargo = strings.TrimSpace(p.ContactoCargo)

	p.WhatsappCodigo = strings.TrimSpace(p.WhatsappCodigo)
	if p.WhatsappCodigo == "" {
		p.WhatsappCodigo = "+595"
	}
	p.WhatsappNumero = strings.TrimLeft(strings.ReplaceAll(strings.TrimSpace(p.WhatsappNumero), " ", ""), "0")
	if p.WhatsappNumero != "" {
		p.ContactoTelefono = p.WhatsappCodigo + p.WhatsappNumero
	} else {
		p.ContactoTelefono = ""
	}

	p.ContactoEmail = strings.TrimSpace(p.ContactoEmail)
	p.Banco = strings.TrimSpace(p.Banco)
	p.NumeroCuenta = strings.TrimSpace(p.NumeroCuenta)

	p.Moneda = strings.TrimSpace(p.Moneda)
	if p.Moneda != "USD" && p.Moneda != "Reales" {
		p.Moneda = "Gs"
	}

	p.CondicionPago = strings.TrimSpace(p.CondicionPago)
	if p.CondicionPago != "Crédito 15 días" && p.CondicionPago != "Crédito 30 días" {
		p.CondicionPago = "Contado"
	}

	p.Rubro = strings.TrimSpace(p.Rubro)
	if p.TiempoEntregaDias < 0 {
		p.TiempoEntregaDias = 0
	}

	p.Estado = strings.TrimSpace(p.Estado)
	if p.Estado != "Inactivo" {
		p.Estado = "Activo"
	}

	if p.RazonSocial == "" {
		return "La Razón Social / Nombre del proveedor es obligatoria."
	}
	if p.RucDocumento == "" {
		return "El RUC / Documento de Identidad es obligatorio."
	}

	return ""
}

func (h *ProveedoresHandler) Create(w http.ResponseWriter, r *http.Request) {
	if h.DB == nil {
		auth.WriteJSONError(w, http.StatusServiceUnavailable, "base de datos no conectada")
		return
	}

	var p models.Proveedor
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		auth.WriteJSONError(w, http.StatusBadRequest, "datos inválidos")
		return
	}

	if msg := sanitizeAndValidateProveedor(&p); msg != "" {
		auth.WriteJSONError(w, http.StatusBadRequest, msg)
		return
	}

	res, err := h.DB.ExecContext(r.Context(), `
		INSERT INTO proveedores (
			tipo_proveedor, razon_social, nombre_comercial, ruc_documento,
			direccion, ciudad, pais,
			telefono_codigo, telefono_numero, telefono_corporativo,
			email_general, sitio_web,
			contacto_nombre, contacto_cargo,
			whatsapp_codigo, whatsapp_numero, contacto_telefono,
			contacto_email,
			banco, numero_cuenta, moneda, condicion_pago,
			rubro, tiempo_entrega_dias, estado
		) VALUES (
			?, ?, ?, ?,
			?, ?, ?,
			?, ?, ?,
			?, ?,
			?, ?,
			?, ?, ?,
			?,
			?, ?, ?, ?,
			?, ?, ?
		)
	`,
		p.TipoProveedor, p.RazonSocial, nullString(p.NombreComercial), p.RucDocumento,
		nullString(p.Direccion), nullString(p.Ciudad), p.Pais,
		p.TelefonoCodigo, nullString(p.TelefonoNumero), nullString(p.TelefonoCorporativo),
		nullString(p.EmailGeneral), nullString(p.SitioWeb),
		nullString(p.ContactoNombre), nullString(p.ContactoCargo),
		p.WhatsappCodigo, nullString(p.WhatsappNumero), nullString(p.ContactoTelefono),
		nullString(p.ContactoEmail),
		nullString(p.Banco), nullString(p.NumeroCuenta), p.Moneda, p.CondicionPago,
		nullString(p.Rubro), p.TiempoEntregaDias, p.Estado,
	)
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "error al guardar el proveedor: "+err.Error())
		return
	}

	id, _ := res.LastInsertId()
	p.ID = int(id)

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(p)
}

func (h *ProveedoresHandler) Update(w http.ResponseWriter, r *http.Request, id int) {
	if h.DB == nil {
		auth.WriteJSONError(w, http.StatusServiceUnavailable, "base de datos no conectada")
		return
	}

	var p models.Proveedor
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		auth.WriteJSONError(w, http.StatusBadRequest, "datos inválidos")
		return
	}

	if msg := sanitizeAndValidateProveedor(&p); msg != "" {
		auth.WriteJSONError(w, http.StatusBadRequest, msg)
		return
	}

	_, err := h.DB.ExecContext(r.Context(), `
		UPDATE proveedores SET
			tipo_proveedor = ?, razon_social = ?, nombre_comercial = ?, ruc_documento = ?,
			direccion = ?, ciudad = ?, pais = ?,
			telefono_codigo = ?, telefono_numero = ?, telefono_corporativo = ?,
			email_general = ?, sitio_web = ?,
			contacto_nombre = ?, contacto_cargo = ?,
			whatsapp_codigo = ?, whatsapp_numero = ?, contacto_telefono = ?,
			contacto_email = ?,
			banco = ?, numero_cuenta = ?, moneda = ?, condicion_pago = ?,
			rubro = ?, tiempo_entrega_dias = ?, estado = ?
		WHERE id = ? AND deleted_at IS NULL
	`,
		p.TipoProveedor, p.RazonSocial, nullString(p.NombreComercial), p.RucDocumento,
		nullString(p.Direccion), nullString(p.Ciudad), p.Pais,
		p.TelefonoCodigo, nullString(p.TelefonoNumero), nullString(p.TelefonoCorporativo),
		nullString(p.EmailGeneral), nullString(p.SitioWeb),
		nullString(p.ContactoNombre), nullString(p.ContactoCargo),
		p.WhatsappCodigo, nullString(p.WhatsappNumero), nullString(p.ContactoTelefono),
		nullString(p.ContactoEmail),
		nullString(p.Banco), nullString(p.NumeroCuenta), p.Moneda, p.CondicionPago,
		nullString(p.Rubro), p.TiempoEntregaDias, p.Estado,
		id,
	)
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "error al actualizar el proveedor: "+err.Error())
		return
	}

	p.ID = id
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(p)
}

// SoftDelete simula el borrado, guarda fecha/hora y usuario que borró, y envía al módulo de Reciclaje (AGENTS.md)
func (h *ProveedoresHandler) SoftDelete(w http.ResponseWriter, r *http.Request, id int) {
	if h.DB == nil {
		auth.WriteJSONError(w, http.StatusServiceUnavailable, "base de datos no conectada")
		return
	}

	deletedBy := auth.CurrentActorName(r)
	_, err := h.DB.ExecContext(
		r.Context(),
		"UPDATE proveedores SET deleted_at = NOW(), deleted_by = ? WHERE id = ?",
		deletedBy, id,
	)
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "error al enviar el proveedor a reciclaje")
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]string{"message": "proveedor enviado a reciclaje"})
}
