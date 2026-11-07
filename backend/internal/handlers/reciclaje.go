package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"r1/backend/internal/auth"
)

type RecycleField struct {
	Label string `json:"label"`
	Value string `json:"value"`
}

type RecycleItem struct {
	ID            int            `json:"id"`
	Modulo        string         `json:"modulo"`
	Identificador string         `json:"identificador"`
	Nombre        string         `json:"nombre"`
	Detalle       string         `json:"detalle"`
	CreatedAt     time.Time      `json:"createdAt"`
	UpdatedAt     time.Time      `json:"updatedAt"`
	DeletedBy     string         `json:"deletedBy"`
	DeletedAt     time.Time      `json:"deletedAt"`
	Campos        []RecycleField `json:"campos"`
}

type ReciclajeHandler struct {
	DB *sql.DB
}

func NewReciclajeHandler(dbConn *sql.DB) *ReciclajeHandler {
	return &ReciclajeHandler{DB: dbConn}
}

func nonEmptyOrDash(v string) string {
	s := strings.TrimSpace(v)
	if s == "" {
		return "-"
	}
	return s
}

func (h *ReciclajeHandler) List(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		auth.WriteJSONError(w, http.StatusMethodNotAllowed, "método no permitido")
		return
	}

	if h.DB == nil {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"data":      []RecycleItem{},
			"page":      1,
			"page_size": 20,
			"total":     0,
		})
		return
	}

	q := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("q")))
	modulo := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("modulo")))
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("page_size"))
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	allItems := make([]RecycleItem, 0)

	// 1. Clientes en reciclaje
	if modulo == "" || modulo == "clientes" {
		rows, err := h.DB.QueryContext(r.Context(), `
			SELECT
				id, tipo_cliente, COALESCE(tipo_documento, ''), COALESCE(numero_documento, ''),
				COALESCE(nombres, ''), COALESCE(apellidos, ''), COALESCE(DATE_FORMAT(fecha_nacimiento, '%Y-%m-%d'), ''),
				COALESCE(sexo, ''), COALESCE(nacionalidad, ''),
				COALESCE(ruc_base, ''), COALESCE(razon_social, ''), COALESCE(nombre_fantasia, ''),
				COALESCE(ruc, ''), COALESCE(representante_nombre, ''), COALESCE(representante_documento, ''),
				COALESCE(persona_contacto, ''), COALESCE(whatsapp_completo, ''), COALESCE(telefono_completo, ''),
				COALESCE(email, ''), COALESCE(direccion, ''), COALESCE(departamento, ''),
				COALESCE(ciudad, ''), COALESCE(barrio, ''), COALESCE(referencia, ''),
				created_at, updated_at, COALESCE(deleted_by, 'Operador Ventas'), deleted_at
			FROM clientes
			WHERE deleted_at IS NOT NULL
			ORDER BY deleted_at DESC
		`)
		if err == nil {
			for rows.Next() {
				var (
					id, tipoCliente, tipoDoc, numDoc, nombres, apellidos, fechaNac, sexo, nac string
					rucBase, razonSocial, nombreFantasia, ruc, repNombre, repDoc              string
					personaContacto, whatsapp, telefono, email, direccion, depto              string
					ciudad, barrio, referencia, deletedBy                                     string
					idNum                                                                     int
					createdAt, updatedAt, deletedAtTime                                       time.Time
				)
				if scanErr := rows.Scan(
					&idNum, &tipoCliente, &tipoDoc, &numDoc,
					&nombres, &apellidos, &fechaNac, &sexo, &nac,
					&rucBase, &razonSocial, &nombreFantasia,
					&ruc, &repNombre, &repDoc,
					&personaContacto, &whatsapp, &telefono,
					&email, &direccion, &depto,
					&ciudad, &barrio, &referencia,
					&createdAt, &updatedAt, &deletedBy, &deletedAtTime,
				); scanErr == nil {
					_ = id
					ident := numDoc
					nombre := strings.TrimSpace(nombres + " " + apellidos)
					campos := []RecycleField{}
					if tipoCliente == "empresa" {
						ident = rucBase
						nombre = razonSocial
						campos = []RecycleField{
							{Label: "Categoría", Value: "Empresa (Persona Jurídica)"},
							{Label: "RUC Base", Value: nonEmptyOrDash(rucBase)},
							{Label: "Razón Social", Value: nonEmptyOrDash(razonSocial)},
							{Label: "Nombre de Fantasía", Value: nonEmptyOrDash(nombreFantasia)},
							{Label: "Representante Legal", Value: nonEmptyOrDash(repNombre)},
							{Label: "Documento Representante", Value: nonEmptyOrDash(repDoc)},
							{Label: "Persona de Contacto", Value: nonEmptyOrDash(personaContacto)},
							{Label: "WhatsApp Corporativo", Value: nonEmptyOrDash(whatsapp)},
							{Label: "Teléfono Adicional", Value: nonEmptyOrDash(telefono)},
							{Label: "Correo Electrónico", Value: nonEmptyOrDash(email)},
							{Label: "Dirección", Value: nonEmptyOrDash(direccion)},
							{Label: "Departamento / Ciudad", Value: nonEmptyOrDash(strings.TrimSpace(depto + " - " + ciudad))},
							{Label: "Barrio / Referencia", Value: nonEmptyOrDash(strings.TrimSpace(barrio + " · " + referencia))},
						}
					} else {
						campos = []RecycleField{
							{Label: "Categoría", Value: "Persona Física"},
							{Label: "Tipo de Documento", Value: nonEmptyOrDash(tipoDoc)},
							{Label: "Número de Documento", Value: nonEmptyOrDash(numDoc)},
							{Label: "Nombres y Apellidos", Value: nonEmptyOrDash(nombre)},
							{Label: "RUC", Value: nonEmptyOrDash(ruc)},
							{Label: "Fecha de Nacimiento", Value: nonEmptyOrDash(fechaNac)},
							{Label: "Sexo / Nacionalidad", Value: nonEmptyOrDash(strings.TrimSpace(sexo + " · " + nac))},
							{Label: "WhatsApp / Celular", Value: nonEmptyOrDash(whatsapp)},
							{Label: "Teléfono Adicional", Value: nonEmptyOrDash(telefono)},
							{Label: "Correo Electrónico", Value: nonEmptyOrDash(email)},
							{Label: "Dirección", Value: nonEmptyOrDash(direccion)},
							{Label: "Departamento / Ciudad", Value: nonEmptyOrDash(strings.TrimSpace(depto + " - " + ciudad))},
							{Label: "Barrio / Referencia", Value: nonEmptyOrDash(strings.TrimSpace(barrio + " · " + referencia))},
						}
					}
					item := RecycleItem{
						ID:            idNum,
						Modulo:        "Clientes",
						Identificador: ident,
						Nombre:        nombre,
						Detalle:       strings.TrimSpace(whatsapp + " · " + email),
						CreatedAt:     createdAt,
						UpdatedAt:     updatedAt,
						DeletedBy:     deletedBy,
						DeletedAt:     deletedAtTime,
						Campos:        campos,
					}
					if q == "" || matchesRecycleSearch(item, q) {
						allItems = append(allItems, item)
					}
				}
			}
			rows.Close()
		}

		// 8. Presupuestos y Cotizaciones
		rowsPres, err := h.DB.QueryContext(r.Context(), `
			SELECT
				id, numero_presupuesto, cliente_nombre, COALESCE(cliente_telefono, ''),
				total_final, estado,
				created_at, updated_at, COALESCE(deleted_by, 'Operador Ventas'), deleted_at
			FROM presupuestos
			WHERE deleted_at IS NOT NULL
			ORDER BY deleted_at DESC
		`)
		if err == nil {
			for rowsPres.Next() {
				var (
					id                      int
					numPres, cliNom, cliTel string
					est, delBy              string
					totalFinal              float64
					created, updated, delAt time.Time
				)
				if err := rowsPres.Scan(
					&id, &numPres, &cliNom, &cliTel,
					&totalFinal, &est,
					&created, &updated, &delBy, &delAt,
				); err == nil {
					campos := []RecycleField{
						{Label: "N° Presupuesto", Value: numPres},
						{Label: "Cliente", Value: cliNom},
						{Label: "Teléfono", Value: cliTel},
						{Label: "Total", Value: fmt.Sprintf("%.0f Gs.", totalFinal)},
						{Label: "Último Estado", Value: est},
					}
					item := RecycleItem{
						ID:            id,
						Modulo:        "Presupuestos",
						Identificador: numPres,
						Nombre:        fmt.Sprintf("Presupuesto %s - %s", numPres, cliNom),
						Detalle:       fmt.Sprintf("Cliente: %s · Total: %.0f Gs.", cliNom, totalFinal),
						CreatedAt:     created,
						UpdatedAt:     updated,
						DeletedBy:     delBy,
						DeletedAt:     delAt,
						Campos:        campos,
					}
					if q == "" || matchesRecycleSearch(item, q) {
						allItems = append(allItems, item)
					}
				}
			}
			rowsPres.Close()
		}
	}

	// 2. Proveedores en reciclaje
	if modulo == "" || modulo == "proveedor" || modulo == "proveedores" {
		rows, err := h.DB.QueryContext(r.Context(), `
			SELECT
				id, COALESCE(tipo_proveedor, ''), COALESCE(razon_social, ''), COALESCE(nombre_comercial, ''),
				COALESCE(ruc_documento, ''), COALESCE(direccion, ''), COALESCE(ciudad, ''), COALESCE(pais, ''),
				COALESCE(telefono_corporativo, ''), COALESCE(email_general, ''), COALESCE(sitio_web, ''),
				COALESCE(contacto_nombre, ''), COALESCE(contacto_cargo, ''), COALESCE(contacto_telefono, ''),
				COALESCE(contacto_email, ''), COALESCE(banco, ''), COALESCE(numero_cuenta, ''),
				COALESCE(moneda, ''), COALESCE(condicion_pago, ''), COALESCE(rubro, ''),
				tiempo_entrega_dias, COALESCE(estado, ''),
				created_at, updated_at, COALESCE(deleted_by, 'Operador Ventas'), deleted_at
			FROM proveedores
			WHERE deleted_at IS NOT NULL
			ORDER BY deleted_at DESC
		`)
		if err == nil {
			for rows.Next() {
				var (
					idNum, tiempoEntrega                                                     int
					tipoProv, razonSocial, nombreComercial, rucDoc, direccion, ciudad, pais string
					telefono, email, sitioWeb, contactoNombre, contactoCargo, contactoTel   string
					contactoEmail, banco, numCuenta, moneda, condPago, rubro, estado        string
					deletedBy                                                               string
					createdAt, updatedAt, deletedAtTime                                     time.Time
				)
				if scanErr := rows.Scan(
					&idNum, &tipoProv, &razonSocial, &nombreComercial,
					&rucDoc, &direccion, &ciudad, &pais,
					&telefono, &email, &sitioWeb,
					&contactoNombre, &contactoCargo, &contactoTel,
					&contactoEmail, &banco, &numCuenta,
					&moneda, &condPago, &rubro,
					&tiempoEntrega, &estado,
					&createdAt, &updatedAt, &deletedBy, &deletedAtTime,
				); scanErr == nil {
					parts := []string{}
					if rubro != "" {
						parts = append(parts, rubro)
					}
					if telefono != "" {
						parts = append(parts, telefono)
					}
					if email != "" {
						parts = append(parts, email)
					}
					campos := []RecycleField{
						{Label: "Tipo de Proveedor", Value: nonEmptyOrDash(tipoProv)},
						{Label: "Razón Social / Nombre", Value: nonEmptyOrDash(razonSocial)},
						{Label: "Nombre Comercial", Value: nonEmptyOrDash(nombreComercial)},
						{Label: "RUC / Documento", Value: nonEmptyOrDash(rucDoc)},
						{Label: "Rubro / Categoría", Value: nonEmptyOrDash(rubro)},
						{Label: "Teléfono Corporativo", Value: nonEmptyOrDash(telefono)},
						{Label: "Correo General", Value: nonEmptyOrDash(email)},
						{Label: "Dirección / Ciudad / País", Value: nonEmptyOrDash(strings.TrimSpace(direccion + " · " + ciudad + " (" + pais + ")"))},
						{Label: "Sitio Web", Value: nonEmptyOrDash(sitioWeb)},
						{Label: "Contacto Directo", Value: nonEmptyOrDash(strings.TrimSpace(contactoNombre + " (" + contactoCargo + ")"))},
						{Label: "WhatsApp Contacto", Value: nonEmptyOrDash(contactoTel)},
						{Label: "Correo Contacto", Value: nonEmptyOrDash(contactoEmail)},
						{Label: "Banco / Cuenta", Value: nonEmptyOrDash(strings.TrimSpace(banco + " - " + numCuenta))},
						{Label: "Moneda / Condición Pago", Value: nonEmptyOrDash(moneda + " · " + condPago)},
						{Label: "Tiempo Estimado Entrega", Value: strconv.Itoa(tiempoEntrega) + " días"},
						{Label: "Estado al Borrar", Value: nonEmptyOrDash(estado)},
					}
					item := RecycleItem{
						ID:            idNum,
						Modulo:        "Proveedor",
						Identificador: rucDoc,
						Nombre:        razonSocial,
						Detalle:       strings.Join(parts, " · "),
						CreatedAt:     createdAt,
						UpdatedAt:     updatedAt,
						DeletedBy:     deletedBy,
						DeletedAt:     deletedAtTime,
						Campos:        campos,
					}
					if q == "" || matchesRecycleSearch(item, q) {
						allItems = append(allItems, item)
					}
				}
			}
			rows.Close()
		}

		// 8. Presupuestos y Cotizaciones
		rowsPres, err := h.DB.QueryContext(r.Context(), `
			SELECT
				id, numero_presupuesto, cliente_nombre, COALESCE(cliente_telefono, ''),
				total_final, estado,
				created_at, updated_at, COALESCE(deleted_by, 'Operador Ventas'), deleted_at
			FROM presupuestos
			WHERE deleted_at IS NOT NULL
			ORDER BY deleted_at DESC
		`)
		if err == nil {
			for rowsPres.Next() {
				var (
					id                      int
					numPres, cliNom, cliTel string
					est, delBy              string
					totalFinal              float64
					created, updated, delAt time.Time
				)
				if err := rowsPres.Scan(
					&id, &numPres, &cliNom, &cliTel,
					&totalFinal, &est,
					&created, &updated, &delBy, &delAt,
				); err == nil {
					campos := []RecycleField{
						{Label: "N° Presupuesto", Value: numPres},
						{Label: "Cliente", Value: cliNom},
						{Label: "Teléfono", Value: cliTel},
						{Label: "Total", Value: fmt.Sprintf("%.0f Gs.", totalFinal)},
						{Label: "Último Estado", Value: est},
					}
					item := RecycleItem{
						ID:            id,
						Modulo:        "Presupuestos",
						Identificador: numPres,
						Nombre:        fmt.Sprintf("Presupuesto %s - %s", numPres, cliNom),
						Detalle:       fmt.Sprintf("Cliente: %s · Total: %.0f Gs.", cliNom, totalFinal),
						CreatedAt:     created,
						UpdatedAt:     updated,
						DeletedBy:     delBy,
						DeletedAt:     delAt,
						Campos:        campos,
					}
					if q == "" || matchesRecycleSearch(item, q) {
						allItems = append(allItems, item)
					}
				}
			}
			rowsPres.Close()
		}
	}

	// 3. Perfiles de Mensajes en reciclaje
	if modulo == "" || modulo == "mensajes" || modulo == "perfiles de mensajes" || modulo == "perfiles_mensajes" {
		rows, err := h.DB.QueryContext(r.Context(), `
			SELECT
				id, COALESCE(titulo, ''), COALESCE(categoria, 'General'),
				COALESCE(descripcion, ''), COALESCE(contenido, ''), COALESCE(activo, 1),
				created_at, updated_at, COALESCE(deleted_by, 'Operador Ventas'), deleted_at
			FROM perfiles_mensajes
			WHERE deleted_at IS NOT NULL
			ORDER BY deleted_at DESC
		`)
		if err == nil {
			for rows.Next() {
				var (
					idNum, activoInt                      int
					titulo, categoria, desc, cont         string
					deletedBy                             string
					createdAt, updatedAt, deletedAtTime   time.Time
				)
				if scanErr := rows.Scan(
					&idNum, &titulo, &categoria, &desc, &cont, &activoInt,
					&createdAt, &updatedAt, &deletedBy, &deletedAtTime,
				); scanErr == nil {
					estadoTxt := "Activo"
					if activoInt == 0 {
						estadoTxt = "Inactivo"
					}
					campos := []RecycleField{
						{Label: "Nombre / Título del Perfil", Value: nonEmptyOrDash(titulo)},
						{Label: "Categoría del Perfil", Value: nonEmptyOrDash(categoria)},
						{Label: "Descripción / Uso", Value: nonEmptyOrDash(desc)},
						{Label: "Contenido del Mensaje", Value: nonEmptyOrDash(cont)},
						{Label: "Estado al Borrar", Value: estadoTxt},
					}
					item := RecycleItem{
						ID:            idNum,
						Modulo:        "Perfiles de Mensajes",
						Identificador: categoria,
						Nombre:        titulo,
						Detalle:       cont,
						CreatedAt:     createdAt,
						UpdatedAt:     updatedAt,
						DeletedBy:     deletedBy,
						DeletedAt:     deletedAtTime,
						Campos:        campos,
					}
					if q == "" || matchesRecycleSearch(item, q) {
						allItems = append(allItems, item)
					}
				}
			}
			rows.Close()
		}

		// 8. Presupuestos y Cotizaciones
		rowsPres, err := h.DB.QueryContext(r.Context(), `
			SELECT
				id, numero_presupuesto, cliente_nombre, COALESCE(cliente_telefono, ''),
				total_final, estado,
				created_at, updated_at, COALESCE(deleted_by, 'Operador Ventas'), deleted_at
			FROM presupuestos
			WHERE deleted_at IS NOT NULL
			ORDER BY deleted_at DESC
		`)
		if err == nil {
			for rowsPres.Next() {
				var (
					id                      int
					numPres, cliNom, cliTel string
					est, delBy              string
					totalFinal              float64
					created, updated, delAt time.Time
				)
				if err := rowsPres.Scan(
					&id, &numPres, &cliNom, &cliTel,
					&totalFinal, &est,
					&created, &updated, &delBy, &delAt,
				); err == nil {
					campos := []RecycleField{
						{Label: "N° Presupuesto", Value: numPres},
						{Label: "Cliente", Value: cliNom},
						{Label: "Teléfono", Value: cliTel},
						{Label: "Total", Value: fmt.Sprintf("%.0f Gs.", totalFinal)},
						{Label: "Último Estado", Value: est},
					}
					item := RecycleItem{
						ID:            id,
						Modulo:        "Presupuestos",
						Identificador: numPres,
						Nombre:        fmt.Sprintf("Presupuesto %s - %s", numPres, cliNom),
						Detalle:       fmt.Sprintf("Cliente: %s · Total: %.0f Gs.", cliNom, totalFinal),
						CreatedAt:     created,
						UpdatedAt:     updated,
						DeletedBy:     delBy,
						DeletedAt:     delAt,
						Campos:        campos,
					}
					if q == "" || matchesRecycleSearch(item, q) {
						allItems = append(allItems, item)
					}
				}
			}
			rowsPres.Close()
		}
	}

	// 4. Difusión y Mensajes en reciclaje
	if modulo == "" || modulo == "difusion" || modulo == "difusión y mensajes" || modulo == "mensajes_historial" {
		rows, err := h.DB.QueryContext(r.Context(), `
			SELECT
				id, COALESCE(tipo, 'Mensaje'), COALESCE(nombre_destinatario, '—'),
				COALESCE(telefono_destinatario, ''), COALESCE(contenido, ''),
				COALESCE(adjunto_nombre, ''), COALESCE(adjunto_formato, ''), COALESCE(estado, 'Enviado'),
				created_at, updated_at, COALESCE(deleted_by, 'Operador Ventas'), deleted_at
			FROM mensajes_historial
			WHERE deleted_at IS NOT NULL
			ORDER BY deleted_at DESC
		`)
		if err == nil {
			for rows.Next() {
				var (
					idNum                                                       int
					tipo, nombreDest, telDest, cont, adjNombre, adjFormato, est string
					deletedBy                                                   string
					createdAt, updatedAt, deletedAtTime                         time.Time
				)
				if scanErr := rows.Scan(
					&idNum, &tipo, &nombreDest, &telDest, &cont, &adjNombre, &adjFormato, &est,
					&createdAt, &updatedAt, &deletedBy, &deletedAtTime,
				); scanErr == nil {
					campos := []RecycleField{
						{Label: "Tipo de Envío", Value: nonEmptyOrDash(tipo)},
						{Label: "Nombre del Destinatario", Value: nonEmptyOrDash(nombreDest)},
						{Label: "Teléfono WhatsApp", Value: nonEmptyOrDash(telDest)},
						{Label: "Mensaje Enviado", Value: nonEmptyOrDash(cont)},
						{Label: "Archivo Adjunto", Value: nonEmptyOrDash(strings.TrimSpace(adjNombre + " (" + adjFormato + ")"))},
						{Label: "Estado", Value: nonEmptyOrDash(est)},
					}
					item := RecycleItem{
						ID:            idNum,
						Modulo:        "Difusión y Mensajes",
						Identificador: telDest,
						Nombre:        nombreDest + " (" + tipo + ")",
						Detalle:       cont,
						CreatedAt:     createdAt,
						UpdatedAt:     updatedAt,
						DeletedBy:     deletedBy,
						DeletedAt:     deletedAtTime,
						Campos:        campos,
					}
					if q == "" || matchesRecycleSearch(item, q) {
						allItems = append(allItems, item)
					}
				}
			}
			rows.Close()
		}

		// 8. Presupuestos y Cotizaciones
		rowsPres, err := h.DB.QueryContext(r.Context(), `
			SELECT
				id, numero_presupuesto, cliente_nombre, COALESCE(cliente_telefono, ''),
				total_final, estado,
				created_at, updated_at, COALESCE(deleted_by, 'Operador Ventas'), deleted_at
			FROM presupuestos
			WHERE deleted_at IS NOT NULL
			ORDER BY deleted_at DESC
		`)
		if err == nil {
			for rowsPres.Next() {
				var (
					id                      int
					numPres, cliNom, cliTel string
					est, delBy              string
					totalFinal              float64
					created, updated, delAt time.Time
				)
				if err := rowsPres.Scan(
					&id, &numPres, &cliNom, &cliTel,
					&totalFinal, &est,
					&created, &updated, &delBy, &delAt,
				); err == nil {
					campos := []RecycleField{
						{Label: "N° Presupuesto", Value: numPres},
						{Label: "Cliente", Value: cliNom},
						{Label: "Teléfono", Value: cliTel},
						{Label: "Total", Value: fmt.Sprintf("%.0f Gs.", totalFinal)},
						{Label: "Último Estado", Value: est},
					}
					item := RecycleItem{
						ID:            id,
						Modulo:        "Presupuestos",
						Identificador: numPres,
						Nombre:        fmt.Sprintf("Presupuesto %s - %s", numPres, cliNom),
						Detalle:       fmt.Sprintf("Cliente: %s · Total: %.0f Gs.", cliNom, totalFinal),
						CreatedAt:     created,
						UpdatedAt:     updated,
						DeletedBy:     delBy,
						DeletedAt:     delAt,
						Campos:        campos,
					}
					if q == "" || matchesRecycleSearch(item, q) {
						allItems = append(allItems, item)
					}
				}
			}
			rowsPres.Close()
		}
	}

	// 5. Categorías de Productos en reciclaje
	if modulo == "" || modulo == "categorias" || modulo == "categorías" || modulo == "productos" {
		rows, err := h.DB.QueryContext(r.Context(), `
			SELECT id, nombre, created_at, updated_at, COALESCE(deleted_by, 'admin'), deleted_at
			FROM categorias_productos
			WHERE deleted_at IS NOT NULL
			ORDER BY deleted_at DESC
		`)
		if err == nil {
			for rows.Next() {
				var idNum int
				var nombre, deletedBy string
				var createdAt, updatedAt, deletedAtTime time.Time
				if scanErr := rows.Scan(&idNum, &nombre, &createdAt, &updatedAt, &deletedBy, &deletedAtTime); scanErr == nil {
					campos := []RecycleField{
						{Label: "Nombre de Categoría", Value: nombre},
					}
					item := RecycleItem{
						ID:            idNum,
						Modulo:        "Categorías de Productos",
						Identificador: "#" + strconv.Itoa(idNum),
						Nombre:        nombre,
						Detalle:       "Categoría del catálogo",
						CreatedAt:     createdAt,
						UpdatedAt:     updatedAt,
						DeletedBy:     deletedBy,
						DeletedAt:     deletedAtTime,
						Campos:        campos,
					}
					if q == "" || matchesRecycleSearch(item, q) {
						allItems = append(allItems, item)
					}
				}
			}
			rows.Close()
		}

		// 8. Presupuestos y Cotizaciones
		rowsPres, err := h.DB.QueryContext(r.Context(), `
			SELECT
				id, numero_presupuesto, cliente_nombre, COALESCE(cliente_telefono, ''),
				total_final, estado,
				created_at, updated_at, COALESCE(deleted_by, 'Operador Ventas'), deleted_at
			FROM presupuestos
			WHERE deleted_at IS NOT NULL
			ORDER BY deleted_at DESC
		`)
		if err == nil {
			for rowsPres.Next() {
				var (
					id                      int
					numPres, cliNom, cliTel string
					est, delBy              string
					totalFinal              float64
					created, updated, delAt time.Time
				)
				if err := rowsPres.Scan(
					&id, &numPres, &cliNom, &cliTel,
					&totalFinal, &est,
					&created, &updated, &delBy, &delAt,
				); err == nil {
					campos := []RecycleField{
						{Label: "N° Presupuesto", Value: numPres},
						{Label: "Cliente", Value: cliNom},
						{Label: "Teléfono", Value: cliTel},
						{Label: "Total", Value: fmt.Sprintf("%.0f Gs.", totalFinal)},
						{Label: "Último Estado", Value: est},
					}
					item := RecycleItem{
						ID:            id,
						Modulo:        "Presupuestos",
						Identificador: numPres,
						Nombre:        fmt.Sprintf("Presupuesto %s - %s", numPres, cliNom),
						Detalle:       fmt.Sprintf("Cliente: %s · Total: %.0f Gs.", cliNom, totalFinal),
						CreatedAt:     created,
						UpdatedAt:     updated,
						DeletedBy:     delBy,
						DeletedAt:     delAt,
						Campos:        campos,
					}
					if q == "" || matchesRecycleSearch(item, q) {
						allItems = append(allItems, item)
					}
				}
			}
			rowsPres.Close()
		}
	}

	// 6. Marcas de Productos en reciclaje
	if modulo == "" || modulo == "marcas" || modulo == "productos" {
		rows, err := h.DB.QueryContext(r.Context(), `
			SELECT id, nombre, created_at, updated_at, COALESCE(deleted_by, 'admin'), deleted_at
			FROM marcas_productos
			WHERE deleted_at IS NOT NULL
			ORDER BY deleted_at DESC
		`)
		if err == nil {
			for rows.Next() {
				var idNum int
				var nombre, deletedBy string
				var createdAt, updatedAt, deletedAtTime time.Time
				if scanErr := rows.Scan(&idNum, &nombre, &createdAt, &updatedAt, &deletedBy, &deletedAtTime); scanErr == nil {
					campos := []RecycleField{
						{Label: "Nombre de Marca", Value: nombre},
					}
					item := RecycleItem{
						ID:            idNum,
						Modulo:        "Marcas de Productos",
						Identificador: "#" + strconv.Itoa(idNum),
						Nombre:        nombre,
						Detalle:       "Marca del catálogo",
						CreatedAt:     createdAt,
						UpdatedAt:     updatedAt,
						DeletedBy:     deletedBy,
						DeletedAt:     deletedAtTime,
						Campos:        campos,
					}
					if q == "" || matchesRecycleSearch(item, q) {
						allItems = append(allItems, item)
					}
				}
			}
			rows.Close()
		}

		// 8. Presupuestos y Cotizaciones
		rowsPres, err := h.DB.QueryContext(r.Context(), `
			SELECT
				id, numero_presupuesto, cliente_nombre, COALESCE(cliente_telefono, ''),
				total_final, estado,
				created_at, updated_at, COALESCE(deleted_by, 'Operador Ventas'), deleted_at
			FROM presupuestos
			WHERE deleted_at IS NOT NULL
			ORDER BY deleted_at DESC
		`)
		if err == nil {
			for rowsPres.Next() {
				var (
					id                      int
					numPres, cliNom, cliTel string
					est, delBy              string
					totalFinal              float64
					created, updated, delAt time.Time
				)
				if err := rowsPres.Scan(
					&id, &numPres, &cliNom, &cliTel,
					&totalFinal, &est,
					&created, &updated, &delBy, &delAt,
				); err == nil {
					campos := []RecycleField{
						{Label: "N° Presupuesto", Value: numPres},
						{Label: "Cliente", Value: cliNom},
						{Label: "Teléfono", Value: cliTel},
						{Label: "Total", Value: fmt.Sprintf("%.0f Gs.", totalFinal)},
						{Label: "Último Estado", Value: est},
					}
					item := RecycleItem{
						ID:            id,
						Modulo:        "Presupuestos",
						Identificador: numPres,
						Nombre:        fmt.Sprintf("Presupuesto %s - %s", numPres, cliNom),
						Detalle:       fmt.Sprintf("Cliente: %s · Total: %.0f Gs.", cliNom, totalFinal),
						CreatedAt:     created,
						UpdatedAt:     updated,
						DeletedBy:     delBy,
						DeletedAt:     delAt,
						Campos:        campos,
					}
					if q == "" || matchesRecycleSearch(item, q) {
						allItems = append(allItems, item)
					}
				}
			}
			rowsPres.Close()
		}
	}

	// 7. Unidades de Medida en reciclaje
	if modulo == "" || modulo == "unidades" || modulo == "unidades_medida" || modulo == "unidades de medida" {
		rows, err := h.DB.QueryContext(r.Context(), `
			SELECT id, nombre, abreviatura, permite_decimales, created_at, updated_at, COALESCE(deleted_by, 'admin'), deleted_at
			FROM unidades_medida
			WHERE deleted_at IS NOT NULL
			ORDER BY deleted_at DESC
		`)
		if err == nil {
			for rows.Next() {
				var idNum int
				var nombre, abrev, deletedBy string
				var dec bool
				var createdAt, updatedAt, deletedAtTime time.Time
				if scanErr := rows.Scan(&idNum, &nombre, &abrev, &dec, &createdAt, &updatedAt, &deletedBy, &deletedAtTime); scanErr == nil {
					decStr := "Solo enteros"
					if dec {
						decStr = "Admite decimales"
					}
					campos := []RecycleField{
						{Label: "Nombre de Unidad", Value: nombre},
						{Label: "Abreviatura", Value: abrev},
						{Label: "Modo Decimal", Value: decStr},
					}
					item := RecycleItem{
						ID:            idNum,
						Modulo:        "Unidades de Medida",
						Identificador: abrev,
						Nombre:        nombre + " (" + abrev + ")",
						Detalle:       decStr,
						CreatedAt:     createdAt,
						UpdatedAt:     updatedAt,
						DeletedBy:     deletedBy,
						DeletedAt:     deletedAtTime,
						Campos:        campos,
					}
					if q == "" || matchesRecycleSearch(item, q) {
						allItems = append(allItems, item)
					}
				}
			}
			rows.Close()
		}

		// 8. Presupuestos y Cotizaciones
		rowsPres, err := h.DB.QueryContext(r.Context(), `
			SELECT
				id, numero_presupuesto, cliente_nombre, COALESCE(cliente_telefono, ''),
				total_final, estado,
				created_at, updated_at, COALESCE(deleted_by, 'Operador Ventas'), deleted_at
			FROM presupuestos
			WHERE deleted_at IS NOT NULL
			ORDER BY deleted_at DESC
		`)
		if err == nil {
			for rowsPres.Next() {
				var (
					id                      int
					numPres, cliNom, cliTel string
					est, delBy              string
					totalFinal              float64
					created, updated, delAt time.Time
				)
				if err := rowsPres.Scan(
					&id, &numPres, &cliNom, &cliTel,
					&totalFinal, &est,
					&created, &updated, &delBy, &delAt,
				); err == nil {
					campos := []RecycleField{
						{Label: "N° Presupuesto", Value: numPres},
						{Label: "Cliente", Value: cliNom},
						{Label: "Teléfono", Value: cliTel},
						{Label: "Total", Value: fmt.Sprintf("%.0f Gs.", totalFinal)},
						{Label: "Último Estado", Value: est},
					}
					item := RecycleItem{
						ID:            id,
						Modulo:        "Presupuestos",
						Identificador: numPres,
						Nombre:        fmt.Sprintf("Presupuesto %s - %s", numPres, cliNom),
						Detalle:       fmt.Sprintf("Cliente: %s · Total: %.0f Gs.", cliNom, totalFinal),
						CreatedAt:     created,
						UpdatedAt:     updated,
						DeletedBy:     delBy,
						DeletedAt:     delAt,
						Campos:        campos,
					}
					if q == "" || matchesRecycleSearch(item, q) {
						allItems = append(allItems, item)
					}
				}
			}
			rowsPres.Close()
		}
	}

	// 8. Productos en reciclaje
	if modulo == "" || modulo == "productos" || modulo == "producto" {
		rows, err := h.DB.QueryContext(r.Context(), `
			SELECT
				p.id, p.nombre, p.sku, COALESCE(p.codigo_barras, ''),
				COALESCE(c.nombre, 'General'), COALESCE(p.precio_venta, 0),
				COALESCE(p.stock_actual, 0), COALESCE(u.abreviatura, 'un.'),
				p.created_at, p.updated_at, COALESCE(p.deleted_by, 'Operador Ventas'), p.deleted_at
			FROM productos p
			LEFT JOIN categorias_productos c ON p.categoria_id = c.id
			LEFT JOIN unidades_medida u ON p.unidad_medida_id = u.id
			WHERE p.deleted_at IS NOT NULL
			ORDER BY p.deleted_at DESC
		`)
		if err == nil {
			for rows.Next() {
				var idNum int
				var nombre, sku, codBarras, catNom, unAbrev, deletedBy string
				var precioVenta, stockActual float64
				var createdAt, updatedAt, deletedAtTime time.Time
				if scanErr := rows.Scan(&idNum, &nombre, &sku, &codBarras, &catNom, &precioVenta, &stockActual, &unAbrev, &createdAt, &updatedAt, &deletedBy, &deletedAtTime); scanErr == nil {
					campos := []RecycleField{
						{Label: "SKU", Value: sku},
						{Label: "Código de Barras", Value: nonEmptyOrDash(codBarras)},
						{Label: "Categoría", Value: catNom},
						{Label: "Precio de Venta", Value: strconv.FormatFloat(precioVenta, 'f', 0, 64) + " Gs."},
						{Label: "Stock Registrado", Value: strconv.FormatFloat(stockActual, 'f', 0, 64) + " " + unAbrev},
					}
					item := RecycleItem{
						ID:            idNum,
						Modulo:        "Productos",
						Identificador: sku,
						Nombre:        nombre,
						Detalle:       catNom + " · " + strconv.FormatFloat(precioVenta, 'f', 0, 64) + " Gs.",
						CreatedAt:     createdAt,
						UpdatedAt:     updatedAt,
						DeletedBy:     deletedBy,
						DeletedAt:     deletedAtTime,
						Campos:        campos,
					}
					if q == "" || matchesRecycleSearch(item, q) {
						allItems = append(allItems, item)
					}
				}
			}
			rows.Close()
		}

		// 8. Presupuestos y Cotizaciones
		rowsPres, err := h.DB.QueryContext(r.Context(), `
			SELECT
				id, numero_presupuesto, cliente_nombre, COALESCE(cliente_telefono, ''),
				total_final, estado,
				created_at, updated_at, COALESCE(deleted_by, 'Operador Ventas'), deleted_at
			FROM presupuestos
			WHERE deleted_at IS NOT NULL
			ORDER BY deleted_at DESC
		`)
		if err == nil {
			for rowsPres.Next() {
				var (
					id                      int
					numPres, cliNom, cliTel string
					est, delBy              string
					totalFinal              float64
					created, updated, delAt time.Time
				)
				if err := rowsPres.Scan(
					&id, &numPres, &cliNom, &cliTel,
					&totalFinal, &est,
					&created, &updated, &delBy, &delAt,
				); err == nil {
					campos := []RecycleField{
						{Label: "N° Presupuesto", Value: numPres},
						{Label: "Cliente", Value: cliNom},
						{Label: "Teléfono", Value: cliTel},
						{Label: "Total", Value: fmt.Sprintf("%.0f Gs.", totalFinal)},
						{Label: "Último Estado", Value: est},
					}
					item := RecycleItem{
						ID:            id,
						Modulo:        "Presupuestos",
						Identificador: numPres,
						Nombre:        fmt.Sprintf("Presupuesto %s - %s", numPres, cliNom),
						Detalle:       fmt.Sprintf("Cliente: %s · Total: %.0f Gs.", cliNom, totalFinal),
						CreatedAt:     created,
						UpdatedAt:     updated,
						DeletedBy:     delBy,
						DeletedAt:     delAt,
						Campos:        campos,
					}
					if q == "" || matchesRecycleSearch(item, q) {
						allItems = append(allItems, item)
					}
				}
			}
			rowsPres.Close()
		}
	}

	// 9. Pedidos en reciclaje
	if modulo == "" || modulo == "pedidos" || modulo == "pedido" {
		rows, err := h.DB.QueryContext(r.Context(), `
			SELECT
				id, numero_pedido, cliente_nombre, COALESCE(cliente_telefono, ''),
				condicion_venta, monto_total, estado, semana_iso,
				created_at, updated_at, COALESCE(deleted_by, 'Operador Ventas'), deleted_at
			FROM pedidos
			WHERE deleted_at IS NOT NULL
			ORDER BY deleted_at DESC
		`)
		if err == nil {
			for rows.Next() {
				var (
					id, semISO                               int
					numPed, cliNom, cliTel, cond, est, delBy string
					monto                                    float64
					created, updated, delAt                  time.Time
				)
				if err := rows.Scan(
					&id, &numPed, &cliNom, &cliTel, &cond, &monto, &est, &semISO,
					&created, &updated, &delBy, &delAt,
				); err == nil {
					campos := []RecycleField{
						{Label: "N° Pedido", Value: numPed},
						{Label: "Cliente", Value: cliNom},
						{Label: "Teléfono", Value: cliTel},
						{Label: "Condición", Value: cond},
						{Label: "Monto Total", Value: fmt.Sprintf("%.0f Gs.", monto)},
						{Label: "Semana", Value: fmt.Sprintf("Semana %d", semISO)},
						{Label: "Último Estado", Value: est},
					}
					item := RecycleItem{
						ID:            id,
						Modulo:        "Pedidos",
						Identificador: numPed,
						Nombre:        fmt.Sprintf("Pedido %s - %s", numPed, cliNom),
						Detalle:       fmt.Sprintf("Cliente: %s · Total: %.0f Gs.", cliNom, monto),
						CreatedAt:     created,
						UpdatedAt:     updated,
						DeletedBy:     delBy,
						DeletedAt:     delAt,
						Campos:        campos,
					}
					if q == "" || matchesRecycleSearch(item, q) {
						allItems = append(allItems, item)
					}
				}
			}
			rows.Close()
		}

		// 8. Presupuestos y Cotizaciones
		rowsPres, err := h.DB.QueryContext(r.Context(), `
			SELECT
				id, numero_presupuesto, cliente_nombre, COALESCE(cliente_telefono, ''),
				total_final, estado,
				created_at, updated_at, COALESCE(deleted_by, 'Operador Ventas'), deleted_at
			FROM presupuestos
			WHERE deleted_at IS NOT NULL
			ORDER BY deleted_at DESC
		`)
		if err == nil {
			for rowsPres.Next() {
				var (
					id                      int
					numPres, cliNom, cliTel string
					est, delBy              string
					totalFinal              float64
					created, updated, delAt time.Time
				)
				if err := rowsPres.Scan(
					&id, &numPres, &cliNom, &cliTel,
					&totalFinal, &est,
					&created, &updated, &delBy, &delAt,
				); err == nil {
					campos := []RecycleField{
						{Label: "N° Presupuesto", Value: numPres},
						{Label: "Cliente", Value: cliNom},
						{Label: "Teléfono", Value: cliTel},
						{Label: "Total", Value: fmt.Sprintf("%.0f Gs.", totalFinal)},
						{Label: "Último Estado", Value: est},
					}
					item := RecycleItem{
						ID:            id,
						Modulo:        "Presupuestos",
						Identificador: numPres,
						Nombre:        fmt.Sprintf("Presupuesto %s - %s", numPres, cliNom),
						Detalle:       fmt.Sprintf("Cliente: %s · Total: %.0f Gs.", cliNom, totalFinal),
						CreatedAt:     created,
						UpdatedAt:     updated,
						DeletedBy:     delBy,
						DeletedAt:     delAt,
						Campos:        campos,
					}
					if q == "" || matchesRecycleSearch(item, q) {
						allItems = append(allItems, item)
					}
				}
			}
			rowsPres.Close()
		}
	}

	// 10. Pagos en reciclaje
	if modulo == "" || modulo == "pagos" || modulo == "pago" {
		rowsPagos, err := h.DB.QueryContext(r.Context(), `
			SELECT
				p.id, p.numero_pago, p.tipo_beneficiario, COALESCE(p.referencia_pago, ''),
				COALESCE(p.proveedor_nombre, ''), COALESCE(p.cliente_nombre, ''),
				p.producto_nombre, p.cantidad, p.monto_total, p.monto_pagado, p.saldo_pendiente,
				p.estado_pago, p.metodo_pago, DATE_FORMAT(p.fecha_pago, '%Y-%m-%d'),
				p.semana_iso, p.anio_iso, COALESCE(p.notas, ''),
				p.created_at, p.updated_at, COALESCE(p.deleted_by, 'Operador Ventas'), p.deleted_at
			FROM pagos p
			WHERE p.deleted_at IS NOT NULL
			ORDER BY p.deleted_at DESC
		`)
		if err == nil {
			for rowsPagos.Next() {
				var (
					id, semISO, anioISO                           int
					numPago, tipoBen, refPago, provNom, cliNom   string
					prodNom, estPago, metodoPago, fechaPago, notas, delBy string
					cant, montoTotal, montoPagado, saldoPendiente float64
					created, updated, delAt                       time.Time
				)
				if err := rowsPagos.Scan(
					&id, &numPago, &tipoBen, &refPago,
					&provNom, &cliNom,
					&prodNom, &cant, &montoTotal, &montoPagado, &saldoPendiente,
					&estPago, &metodoPago, &fechaPago,
					&semISO, &anioISO, &notas,
					&created, &updated, &delBy, &delAt,
				); err == nil {
					beneficiario := provNom
					if tipoBen == "Otros" {
						if refPago != "" {
							beneficiario = fmt.Sprintf("%s (%s)", provNom, refPago)
						}
					} else if tipoBen == "Cliente" && cliNom != "" {
						beneficiario = cliNom
					}
					if beneficiario == "" {
						beneficiario = "No especificado"
					}

					campos := []RecycleField{
						{Label: "N° de Pago", Value: numPago},
						{Label: "Tipo de Beneficiario", Value: tipoBen},
						{Label: "Beneficiario", Value: beneficiario},
						{Label: "Producto / Concepto", Value: prodNom},
						{Label: "Cantidad", Value: fmt.Sprintf("%.0f", cant)},
						{Label: "Monto Total", Value: fmt.Sprintf("%.0f Gs.", montoTotal)},
						{Label: "Monto Abonado", Value: fmt.Sprintf("%.0f Gs.", montoPagado)},
						{Label: "Saldo Pendiente", Value: fmt.Sprintf("%.0f Gs.", saldoPendiente)},
						{Label: "Estado de Pago", Value: estPago},
						{Label: "Método de Pago", Value: metodoPago},
						{Label: "Fecha de Pago", Value: fechaPago},
						{Label: "Semana ISO", Value: fmt.Sprintf("Semana %d (%d)", semISO, anioISO)},
					}
					if strings.TrimSpace(notas) != "" {
						campos = append(campos, RecycleField{Label: "Notas / Observaciones", Value: notas})
					}

					item := RecycleItem{
						ID:            id,
						Modulo:        "Pagos",
						Identificador: numPago,
						Nombre:        fmt.Sprintf("Pago %s - %s", numPago, beneficiario),
						Detalle:       fmt.Sprintf("Beneficiario: %s · Concepto: %s · Total: %.0f Gs.", beneficiario, prodNom, montoTotal),
						CreatedAt:     created,
						UpdatedAt:     updated,
						DeletedBy:     delBy,
						DeletedAt:     delAt,
						Campos:        campos,
					}
					if q == "" || matchesRecycleSearch(item, q) {
						allItems = append(allItems, item)
					}
				}
			}
			rowsPagos.Close()
		}
	}

	sort.Slice(allItems, func(i, j int) bool {
		return allItems[i].DeletedAt.After(allItems[j].DeletedAt)
	})

	total := len(allItems)
	offset := (page - 1) * pageSize
	paged := []RecycleItem{}
	if offset < total {
		end := offset + pageSize
		if end > total {
			end = total
		}
		paged = allItems[offset:end]
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"data":      paged,
		"page":      page,
		"page_size": pageSize,
		"total":     total,
	})
}

func matchesRecycleSearch(item RecycleItem, q string) bool {
	return strings.Contains(strings.ToLower(item.Nombre), q) ||
		strings.Contains(strings.ToLower(item.Identificador), q) ||
		strings.Contains(strings.ToLower(item.Detalle), q) ||
		strings.Contains(strings.ToLower(item.DeletedBy), q) ||
		strings.Contains(strings.ToLower(item.Modulo), q)
}

func (h *ReciclajeHandler) Restore(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		auth.WriteJSONError(w, http.StatusMethodNotAllowed, "método no permitido")
		return
	}
	if h.DB == nil {
		auth.WriteJSONError(w, http.StatusServiceUnavailable, "base de datos no conectada")
		return
	}

	var req struct {
		Modulo string `json:"modulo"`
		ID     int    `json:"id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.ID <= 0 {
		auth.WriteJSONError(w, http.StatusBadRequest, "datos inválidos para restaurar")
		return
	}

	mod := strings.ToLower(strings.TrimSpace(req.Modulo))
	switch mod {
	case "clientes", "cliente":
		_, err := h.DB.ExecContext(r.Context(), "UPDATE clientes SET deleted_at = NULL, deleted_by = NULL WHERE id = ?", req.ID)
		if err != nil {
			auth.WriteJSONError(w, http.StatusInternalServerError, "no se pudo restaurar el cliente")
			return
		}
	case "proveedor", "proveedores":
		_, err := h.DB.ExecContext(r.Context(), "UPDATE proveedores SET deleted_at = NULL, deleted_by = NULL WHERE id = ?", req.ID)
		if err != nil {
			auth.WriteJSONError(w, http.StatusInternalServerError, "no se pudo restaurar el proveedor")
			return
		}
	case "perfiles de mensajes", "mensajes", "perfiles_mensajes":
		_, err := h.DB.ExecContext(r.Context(), "UPDATE perfiles_mensajes SET deleted_at = NULL, deleted_by = NULL WHERE id = ?", req.ID)
		if err != nil {
			auth.WriteJSONError(w, http.StatusInternalServerError, "no se pudo restaurar el perfil de mensaje")
			return
		}
	case "difusión y mensajes", "difusion", "mensajes_historial":
		_, err := h.DB.ExecContext(r.Context(), "UPDATE mensajes_historial SET deleted_at = NULL, deleted_by = NULL WHERE id = ?", req.ID)
		if err != nil {
			auth.WriteJSONError(w, http.StatusInternalServerError, "no se pudo restaurar el mensaje del historial")
			return
		}
	case "categorías de productos", "categorias", "categoria", "categorias_productos":
		_, err := h.DB.ExecContext(r.Context(), "UPDATE categorias_productos SET deleted_at = NULL, deleted_by = NULL WHERE id = ?", req.ID)
		if err != nil {
			auth.WriteJSONError(w, http.StatusInternalServerError, "no se pudo restaurar la categoría")
			return
		}
	case "marcas de productos", "marcas", "marca", "marcas_productos":
		_, err := h.DB.ExecContext(r.Context(), "UPDATE marcas_productos SET deleted_at = NULL, deleted_by = NULL WHERE id = ?", req.ID)
		if err != nil {
			auth.WriteJSONError(w, http.StatusInternalServerError, "no se pudo restaurar la marca")
			return
		}
	case "unidades de medida", "unidades", "unidad", "unidades_medida":
		_, err := h.DB.ExecContext(r.Context(), "UPDATE unidades_medida SET deleted_at = NULL, deleted_by = NULL WHERE id = ?", req.ID)
		if err != nil {
			auth.WriteJSONError(w, http.StatusInternalServerError, "no se pudo restaurar la unidad de medida")
			return
		}
	case "productos", "producto":
		_, err := h.DB.ExecContext(r.Context(), "UPDATE productos SET deleted_at = NULL, deleted_by = NULL WHERE id = ?", req.ID)
		if err != nil {
			auth.WriteJSONError(w, http.StatusInternalServerError, "no se pudo restaurar el producto")
			return
		}
	case "pedidos", "pedido":
		_, err := h.DB.ExecContext(r.Context(), "UPDATE pedidos SET deleted_at = NULL, deleted_by = NULL WHERE id = ?", req.ID)
		if err != nil {
			auth.WriteJSONError(w, http.StatusInternalServerError, "no se pudo restaurar el pedido")
			return
		}
	case "presupuestos", "presupuesto":
		_, err := h.DB.ExecContext(r.Context(), "UPDATE presupuestos SET deleted_at = NULL, deleted_by = NULL WHERE id = ?", req.ID)
		if err != nil {
			auth.WriteJSONError(w, http.StatusInternalServerError, "no se pudo restaurar el presupuesto")
			return
		}
	case "pagos", "pago":
		_, err := h.DB.ExecContext(r.Context(), "UPDATE pagos SET deleted_at = NULL, deleted_by = NULL WHERE id = ?", req.ID)
		if err != nil {
			auth.WriteJSONError(w, http.StatusInternalServerError, "no se pudo restaurar el pago")
			return
		}
	default:
		auth.WriteJSONError(w, http.StatusBadRequest, "módulo no soportado")
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]string{"message": "registro restaurado exitosamente"})
}
