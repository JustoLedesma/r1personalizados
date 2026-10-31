package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"r1/backend/internal/auth"
	"r1/backend/internal/models"
)

type PedidosHandler struct {
	DB *sql.DB
}

func NewPedidosHandler(dbConn *sql.DB) *PedidosHandler {
	h := &PedidosHandler{DB: dbConn}
	if dbConn != nil {
		h.ensureSchema()
	}
	return h
}

func (h *PedidosHandler) ensureSchema() {
	queries := []string{
		`CREATE TABLE IF NOT EXISTS pedidos (
			id INT AUTO_INCREMENT PRIMARY KEY,
			numero_pedido VARCHAR(50) NOT NULL UNIQUE,
			cliente_id INT NULL,
			cliente_casual TINYINT(1) NOT NULL DEFAULT 0,
			cliente_nombre VARCHAR(200) NOT NULL,
			cliente_telefono VARCHAR(60) NULL,
			cliente_documento VARCHAR(60) NULL,
			cliente_direccion VARCHAR(255) NULL,
			condicion_venta ENUM('Contado', 'Credito') NOT NULL DEFAULT 'Contado',
			fecha_pedido DATE NULL DEFAULT NULL,
			tipo_pago ENUM('Total', 'Parcial') NULL DEFAULT NULL,
			fecha_cobro DATE NULL DEFAULT NULL,
			monto_total DECIMAL(15,2) NOT NULL DEFAULT 0,
			monto_pagado DECIMAL(15,2) NOT NULL DEFAULT 0,
			saldo_pendiente DECIMAL(15,2) NOT NULL DEFAULT 0,
			modalidad_entrega VARCHAR(80) NOT NULL DEFAULT 'Retiro en Local',
			modalidad_entrega_otro VARCHAR(255) NULL,
			estado ENUM('Creado', 'En Producción', 'En Pausa', 'Listo', 'Cancelado') NOT NULL DEFAULT 'Creado',
			semana_iso INT NOT NULL,
			anio_iso INT NOT NULL,
			notas_produccion TEXT NULL,
			deleted_at DATETIME NULL DEFAULT NULL,
			deleted_by VARCHAR(150) NULL DEFAULT NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			INDEX idx_pedidos_numero (numero_pedido),
			INDEX idx_pedidos_cliente (cliente_id),
			INDEX idx_pedidos_estado (estado),
			INDEX idx_pedidos_condicion (condicion_venta),
			INDEX idx_pedidos_fecha_cobro (fecha_cobro),
			INDEX idx_pedidos_semana (semana_iso, anio_iso),
			INDEX idx_pedidos_deleted_at (deleted_at)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

		`CREATE TABLE IF NOT EXISTS pedido_items (
			id INT AUTO_INCREMENT PRIMARY KEY,
			pedido_id INT NOT NULL,
			producto_id INT NULL,
			es_no_registrado TINYINT(1) NOT NULL DEFAULT 0,
			nombre_producto VARCHAR(255) NOT NULL,
			sku VARCHAR(100) NULL,
			cantidad DECIMAL(12,2) NOT NULL DEFAULT 1,
			precio_unitario DECIMAL(15,2) NOT NULL DEFAULT 0,
			subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			INDEX idx_pedido_items_pedido (pedido_id),
			INDEX idx_pedido_items_producto (producto_id)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

		`CREATE TABLE IF NOT EXISTS pedido_proveedores (
			id INT AUTO_INCREMENT PRIMARY KEY,
			pedido_id INT NOT NULL,
			proveedor_id INT NULL,
			es_no_registrado TINYINT(1) NOT NULL DEFAULT 0,
			nombre_proveedor VARCHAR(200) NOT NULL,
			cantidad DECIMAL(12,2) NOT NULL DEFAULT 1,
			costo DECIMAL(15,2) NOT NULL DEFAULT 0,
			subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			INDEX idx_pedido_proveedores_pedido (pedido_id),
			INDEX idx_pedido_proveedores_proveedor (proveedor_id)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
	}

	for _, q := range queries {
		_, _ = h.DB.Exec(q)
	}

	// Migración segura si la tabla ya existía sin la columna fecha_pedido
	_, _ = h.DB.Exec("ALTER TABLE pedidos ADD COLUMN fecha_pedido DATE NULL DEFAULT NULL AFTER condicion_venta")
	_, _ = h.DB.Exec("UPDATE pedidos SET fecha_pedido = DATE(created_at) WHERE fecha_pedido IS NULL")
	_, _ = h.DB.Exec("CREATE INDEX idx_pedidos_fecha_pedido ON pedidos (fecha_pedido)")

	// Migración de fechas de estados e historial
	_, _ = h.DB.Exec("ALTER TABLE pedidos ADD COLUMN fecha_en_produccion DATETIME NULL DEFAULT NULL AFTER estado")
	_, _ = h.DB.Exec("ALTER TABLE pedidos ADD COLUMN fecha_en_pausa DATETIME NULL DEFAULT NULL AFTER fecha_en_produccion")
	_, _ = h.DB.Exec("ALTER TABLE pedidos ADD COLUMN fecha_listo DATETIME NULL DEFAULT NULL AFTER fecha_en_pausa")
	_, _ = h.DB.Exec("ALTER TABLE pedidos ADD COLUMN historial_estados JSON NULL DEFAULT NULL AFTER fecha_listo")

	// Columnas para pedido_proveedores
	_, _ = h.DB.Exec("ALTER TABLE pedido_proveedores ADD COLUMN producto_id INT NULL DEFAULT NULL AFTER nombre_proveedor")
	_, _ = h.DB.Exec("ALTER TABLE pedido_proveedores ADD COLUMN producto_nombre VARCHAR(255) NULL DEFAULT NULL AFTER producto_id")
	_, _ = h.DB.Exec("ALTER TABLE pedido_proveedores ADD COLUMN estado_pago ENUM('Pendiente', 'Pagado', 'Pago Parcial') NOT NULL DEFAULT 'Pendiente' AFTER subtotal")
	_, _ = h.DB.Exec("ALTER TABLE pedido_proveedores ADD COLUMN monto_pagado DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER estado_pago")
	_, _ = h.DB.Exec("ALTER TABLE pedido_proveedores ADD COLUMN saldo_pendiente DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER monto_pagado")
}

func (h *PedidosHandler) getActorName(r *http.Request) string {
	if claims, ok := r.Context().Value(auth.UserClaimsKey).(*auth.Claims); ok && claims != nil {
		if claims.FullName != "" {
			return claims.FullName
		}
		if claims.Username != "" {
			return claims.Username
		}
	}
	if headerUser := strings.TrimSpace(r.Header.Get("X-User-Name")); headerUser != "" {
		return headerUser
	}
	return "Operador Ventas"
}

// HandleCollection maneja GET (listar) y POST (crear)
func (h *PedidosHandler) HandleCollection(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.List(w, r)
	case http.MethodPost:
		h.Create(w, r)
	default:
		auth.WriteJSONError(w, http.StatusMethodNotAllowed, "método no permitido")
	}
}

// HandleItem maneja GET, PUT, PATCH y DELETE sobre /api/pedidos/{id}
func (h *PedidosHandler) HandleItem(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/pedidos/")
	parts := strings.Split(strings.Trim(path, "/"), "/")
	if len(parts) == 0 || parts[0] == "" {
		auth.WriteJSONError(w, http.StatusBadRequest, "ID de pedido inválido")
		return
	}

	id, err := strconv.Atoi(parts[0])
	if err != nil || id <= 0 {
		auth.WriteJSONError(w, http.StatusBadRequest, "ID de pedido no numérico")
		return
	}

	if len(parts) == 2 && parts[1] == "estado" && r.Method == http.MethodPatch {
		h.UpdateEstado(w, r, id)
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

// List devuelve los pedidos con filtros, chips financieros, contadores y fecha/semana actual
func (h *PedidosHandler) List(w http.ResponseWriter, r *http.Request) {
	if h.DB == nil {
		auth.WriteJSONError(w, http.StatusServiceUnavailable, "base de datos no disponible")
		return
	}

	q := strings.TrimSpace(r.URL.Query().Get("q"))
	estado := strings.TrimSpace(r.URL.Query().Get("estado"))
	financiero := strings.TrimSpace(r.URL.Query().Get("financiero"))

	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("page_size"))
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	now := time.Now()
	anioActual, semanaActual := now.ISOWeek()
	fechaHoyFormatted := now.Format("02/01/2006")

	// Construir cláusula WHERE
	whereClauses := []string{"p.deleted_at IS NULL"}
	var args []any

	if q != "" {
		term := "%" + q + "%"
		whereClauses = append(whereClauses, "(p.numero_pedido LIKE ? OR p.cliente_nombre LIKE ? OR p.cliente_telefono LIKE ? OR p.cliente_documento LIKE ?)")
		args = append(args, term, term, term, term)
	}

	if estado != "" && strings.ToLower(estado) != "todos" {
		whereClauses = append(whereClauses, "p.estado = ?")
		args = append(args, estado)
	}

	semanasStr := strings.TrimSpace(r.URL.Query().Get("semanas"))
	if semanasStr == "" {
		semanasStr = strings.TrimSpace(r.URL.Query().Get("semana"))
	}
	if semanasStr != "" {
		parts := strings.Split(semanasStr, ",")
		var semNums []any
		var placeholders []string
		for _, p := range parts {
			p = strings.TrimSpace(p)
			if sem, err := strconv.Atoi(p); err == nil && sem > 0 {
				semNums = append(semNums, sem)
				placeholders = append(placeholders, "?")
			}
		}
		if len(semNums) == 1 {
			whereClauses = append(whereClauses, "p.semana_iso = ?")
			args = append(args, semNums[0])
		} else if len(semNums) > 1 {
			whereClauses = append(whereClauses, fmt.Sprintf("p.semana_iso IN (%s)", strings.Join(placeholders, ",")))
			args = append(args, semNums...)
		}
	}

	// Filtros financieros:
	// - 'todos': todos
	// - 'cobros_hoy': credito con fecha_cobro = CURDATE()
	// - 'cobros_semanales': credito con semana_iso = semanaActual AND anio_iso = anioActual
	// - 'cobros_mes': credito con fecha_cobro en el mes actual
	// - 'pagos_pendientes': credito y monto_pagado = 0
	// - 'saldos_pendientes': saldo_pendiente > 0
	switch strings.ToLower(financiero) {
	case "cobros_hoy":
		whereClauses = append(whereClauses, "p.condicion_venta = 'Credito' AND p.fecha_cobro = CURDATE()")
	case "cobros_semanales":
		whereClauses = append(whereClauses, "p.condicion_venta = 'Credito' AND p.semana_iso = ? AND p.anio_iso = ?")
		args = append(args, semanaActual, anioActual)
	case "cobros_mes":
		whereClauses = append(whereClauses, "p.condicion_venta = 'Credito' AND MONTH(p.fecha_cobro) = MONTH(CURDATE()) AND YEAR(p.fecha_cobro) = YEAR(CURDATE())")
	case "pagos_pendientes":
		whereClauses = append(whereClauses, "p.condicion_venta = 'Credito' AND p.monto_pagado = 0 AND p.saldo_pendiente > 0")
	case "saldos_pendientes":
		whereClauses = append(whereClauses, "p.saldo_pendiente > 0")
	}

	whereSQL := strings.Join(whereClauses, " AND ")

	// Total con filtros
	var total int
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM pedidos p WHERE %s", whereSQL)
	if err := h.DB.QueryRowContext(r.Context(), countQuery, args...).Scan(&total); err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "error al contar pedidos: "+err.Error())
		return
	}

	// Paginación
	offset := (page - 1) * pageSize
	dataArgs := append(args, pageSize, offset)

	selectSQL := fmt.Sprintf(`
		SELECT
			p.id, p.numero_pedido, p.cliente_id, p.cliente_casual, p.cliente_nombre,
			COALESCE(p.cliente_telefono, ''), COALESCE(p.cliente_documento, ''), COALESCE(p.cliente_direccion, ''),
			p.condicion_venta, COALESCE(DATE_FORMAT(p.fecha_pedido, '%%Y-%%m-%%d'), DATE_FORMAT(p.created_at, '%%Y-%%m-%%d')),
			p.tipo_pago, DATE_FORMAT(p.fecha_cobro, '%%Y-%%m-%%d'),
			p.monto_total, p.monto_pagado, p.saldo_pendiente,
			p.modalidad_entrega, COALESCE(p.modalidad_entrega_otro, ''),
			p.estado, p.semana_iso, p.anio_iso, COALESCE(p.notas_produccion, ''),
			p.created_at, p.updated_at
		FROM pedidos p
		WHERE %s
		ORDER BY p.id DESC
		LIMIT ? OFFSET ?
	`, whereSQL)

	rows, err := h.DB.QueryContext(r.Context(), selectSQL, dataArgs...)
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "error al consultar pedidos: "+err.Error())
		return
	}
	defer rows.Close()

	pedidos := make([]models.Pedido, 0)
	pedidoIDs := make([]int, 0)

	for rows.Next() {
		var p models.Pedido
		var clienteID sql.NullInt64
		var tipoPago, fechaCobro sql.NullString
		var fechaPedido string

		if err := rows.Scan(
			&p.ID, &p.NumeroPedido, &clienteID, &p.ClienteCasual, &p.ClienteNombre,
			&p.ClienteTelefono, &p.ClienteDocumento, &p.ClienteDireccion,
			&p.CondicionVenta, &fechaPedido, &tipoPago, &fechaCobro,
			&p.MontoTotal, &p.MontoPagado, &p.SaldoPendiente,
			&p.ModalidadEntrega, &p.ModalidadEntregaOtro,
			&p.Estado, &p.SemanaISO, &p.AnioISO, &p.NotasProduccion,
			&p.CreatedAt, &p.UpdatedAt,
		); err != nil {
			auth.WriteJSONError(w, http.StatusInternalServerError, "error al escanear pedido: "+err.Error())
			return
		}

		p.FechaPedido = fechaPedido

		if clienteID.Valid {
			cid := int(clienteID.Int64)
			p.ClienteID = &cid
		}
		if tipoPago.Valid {
			tp := tipoPago.String
			p.TipoPago = &tp
		}
		if fechaCobro.Valid && fechaCobro.String != "" {
			fc := fechaCobro.String
			p.FechaCobro = &fc
		}

		pedidos = append(pedidos, p)
		pedidoIDs = append(pedidoIDs, p.ID)
	}

	// Cargar ítems resumidos para cada pedido visible
	if len(pedidoIDs) > 0 {
		h.attachItemsToPedidos(r.Context(), pedidos)
	}

	// Obtener contadores para las tarjetas
	stats := h.getStats(r.Context())

	// Total de semanas ISO del año actual (52 o 53)
	lastDayOfYear := time.Date(now.Year(), 12, 28, 0, 0, 0, 0, time.Local)
	_, totalSemanasAnio := lastDayOfYear.ISOWeek()

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"data":             pedidos,
		"page":             page,
		"page_size":        pageSize,
		"total":            total,
		"stats":            stats,
		"fechaHoy":         fechaHoyFormatted,
		"semanaActual":     semanaActual,
		"totalSemanasAnio": totalSemanasAnio,
		"anioActual":       anioActual,
	})
}

func (h *PedidosHandler) attachItemsToPedidos(ctx context.Context, pedidos []models.Pedido) {
	if len(pedidos) == 0 {
		return
	}

	ids := make([]string, len(pedidos))
	pedMap := make(map[int]*models.Pedido)
	for i := range pedidos {
		ids[i] = strconv.Itoa(pedidos[i].ID)
		pedMap[pedidos[i].ID] = &pedidos[i]
	}

	inClause := strings.Join(ids, ",")
	query := fmt.Sprintf(`
		SELECT id, pedido_id, producto_id, es_no_registrado, nombre_producto, COALESCE(sku, ''), cantidad, precio_unitario, subtotal, created_at, updated_at
		FROM pedido_items
		WHERE pedido_id IN (%s)
		ORDER BY id ASC
	`, inClause)

	rows, err := h.DB.QueryContext(ctx, query)
	if err != nil {
		return
	}
	defer rows.Close()

	for rows.Next() {
		var item models.PedidoItem
		var prodID sql.NullInt64
		if err := rows.Scan(
			&item.ID, &item.PedidoID, &prodID, &item.EsNoRegistrado,
			&item.NombreProducto, &item.SKU, &item.Cantidad, &item.PrecioUnitario, &item.Subtotal,
			&item.CreatedAt, &item.UpdatedAt,
		); err == nil {
			if prodID.Valid {
				pid := int(prodID.Int64)
				item.ProductoID = &pid
			}
			if p, ok := pedMap[item.PedidoID]; ok {
				p.Items = append(p.Items, item)
			}
		}
	}
}

func (h *PedidosHandler) getStats(ctx context.Context) models.PedidoStats {
	var s models.PedidoStats
	if h.DB == nil {
		return s
	}

	query := `
		SELECT
			COUNT(*) AS total,
			COUNT(CASE WHEN estado = 'Creado' THEN 1 END) AS creados,
			COUNT(CASE WHEN estado = 'En Producción' THEN 1 END) AS en_produccion,
			COUNT(CASE WHEN estado = 'En Pausa' THEN 1 END) AS en_pausa,
			COUNT(CASE WHEN estado = 'Listo' THEN 1 END) AS listos,
			COUNT(CASE WHEN estado = 'Cancelado' THEN 1 END) AS cancelados
		FROM pedidos
		WHERE deleted_at IS NULL
	`
	_ = h.DB.QueryRowContext(ctx, query).Scan(
		&s.Total, &s.Creados, &s.EnProduccion, &s.EnPausa, &s.Listos, &s.Cancelados,
	)
	return s
}

// GetByID obtiene un pedido completo con sus ítems y proveedores
func (h *PedidosHandler) GetByID(w http.ResponseWriter, r *http.Request, id int) {
	if h.DB == nil {
		auth.WriteJSONError(w, http.StatusServiceUnavailable, "base de datos no disponible")
		return
	}

	query := `
		SELECT
			id, numero_pedido, cliente_id, cliente_casual, cliente_nombre,
			COALESCE(cliente_telefono, ''), COALESCE(cliente_documento, ''), COALESCE(cliente_direccion, ''),
			condicion_venta, COALESCE(DATE_FORMAT(fecha_pedido, '%Y-%m-%d'), DATE_FORMAT(created_at, '%Y-%m-%d')),
			tipo_pago, DATE_FORMAT(fecha_cobro, '%Y-%m-%d'),
			monto_total, monto_pagado, saldo_pendiente,
			modalidad_entrega, COALESCE(modalidad_entrega_otro, ''),
			estado,
			DATE_FORMAT(fecha_en_produccion, '%Y-%m-%d %H:%i:%s'),
			DATE_FORMAT(fecha_en_pausa, '%Y-%m-%d %H:%i:%s'),
			DATE_FORMAT(fecha_listo, '%Y-%m-%d %H:%i:%s'),
			COALESCE(historial_estados, '[]'),
			semana_iso, anio_iso, COALESCE(notas_produccion, ''),
			created_at, updated_at
		FROM pedidos
		WHERE id = ? AND deleted_at IS NULL
	`

	var p models.Pedido
	var clienteID sql.NullInt64
	var tipoPago, fechaCobro sql.NullString
	var fechaEnProd, fechaEnPausa, fechaListo, histEstados sql.NullString
	var fechaPedido string

	err := h.DB.QueryRowContext(r.Context(), query, id).Scan(
		&p.ID, &p.NumeroPedido, &clienteID, &p.ClienteCasual, &p.ClienteNombre,
		&p.ClienteTelefono, &p.ClienteDocumento, &p.ClienteDireccion,
		&p.CondicionVenta, &fechaPedido, &tipoPago, &fechaCobro,
		&p.MontoTotal, &p.MontoPagado, &p.SaldoPendiente,
		&p.ModalidadEntrega, &p.ModalidadEntregaOtro,
		&p.Estado,
		&fechaEnProd, &fechaEnPausa, &fechaListo, &histEstados,
		&p.SemanaISO, &p.AnioISO, &p.NotasProduccion,
		&p.CreatedAt, &p.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		auth.WriteJSONError(w, http.StatusNotFound, "pedido no encontrado")
		return
	} else if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "error al consultar pedido: "+err.Error())
		return
	}

	p.FechaPedido = fechaPedido

	if clienteID.Valid {
		cid := int(clienteID.Int64)
		p.ClienteID = &cid
	}
	if tipoPago.Valid {
		tp := tipoPago.String
		p.TipoPago = &tp
	}
	if fechaCobro.Valid && fechaCobro.String != "" {
		fc := fechaCobro.String
		p.FechaCobro = &fc
	}

	if fechaEnProd.Valid && fechaEnProd.String != "" {
		f := fechaEnProd.String
		p.FechaEnProduccion = &f
	}
	if fechaEnPausa.Valid && fechaEnPausa.String != "" {
		f := fechaEnPausa.String
		p.FechaEnPausa = &f
	}
	if fechaListo.Valid && fechaListo.String != "" {
		f := fechaListo.String
		p.FechaListo = &f
	}
	if histEstados.Valid && histEstados.String != "" {
		p.HistorialEstados = histEstados.String
	}

	// Cargar ítems
	p.Items = h.getPedidoItems(r.Context(), id)
	// Cargar proveedores
	p.Proveedores = h.getPedidoProveedores(r.Context(), id)

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(p)
}

func (h *PedidosHandler) getPedidoItems(ctx context.Context, pedidoID int) []models.PedidoItem {
	items := make([]models.PedidoItem, 0)
	rows, err := h.DB.QueryContext(ctx, `
		SELECT id, pedido_id, producto_id, es_no_registrado, nombre_producto, COALESCE(sku, ''), cantidad, precio_unitario, subtotal, created_at, updated_at
		FROM pedido_items
		WHERE pedido_id = ?
		ORDER BY id ASC
	`, pedidoID)
	if err != nil {
		return items
	}
	defer rows.Close()

	for rows.Next() {
		var it models.PedidoItem
		var pid sql.NullInt64
		if err := rows.Scan(
			&it.ID, &it.PedidoID, &pid, &it.EsNoRegistrado,
			&it.NombreProducto, &it.SKU, &it.Cantidad, &it.PrecioUnitario, &it.Subtotal,
			&it.CreatedAt, &it.UpdatedAt,
		); err == nil {
			if pid.Valid {
				v := int(pid.Int64)
				it.ProductoID = &v
			}
			items = append(items, it)
		}
	}
	return items
}

func (h *PedidosHandler) getPedidoProveedores(ctx context.Context, pedidoID int) []models.PedidoProveedor {
	provs := make([]models.PedidoProveedor, 0)
	rows, err := h.DB.QueryContext(ctx, `
		SELECT
			id, pedido_id, proveedor_id, es_no_registrado, nombre_proveedor,
			producto_id, COALESCE(producto_nombre, ''),
			cantidad, costo, subtotal,
			COALESCE(estado_pago, 'Pendiente'), COALESCE(monto_pagado, 0), COALESCE(saldo_pendiente, 0),
			created_at, updated_at
		FROM pedido_proveedores
		WHERE pedido_id = ?
		ORDER BY id ASC
	`, pedidoID)
	if err != nil {
		return provs
	}
	defer rows.Close()

	for rows.Next() {
		var pr models.PedidoProveedor
		var pvid, prodid sql.NullInt64
		if err := rows.Scan(
			&pr.ID, &pr.PedidoID, &pvid, &pr.EsNoRegistrado, &pr.NombreProveedor,
			&prodid, &pr.ProductoNombre,
			&pr.Cantidad, &pr.Costo, &pr.Subtotal,
			&pr.EstadoPago, &pr.MontoPagado, &pr.SaldoPendiente,
			&pr.CreatedAt, &pr.UpdatedAt,
		); err == nil {
			if pvid.Valid {
				v := int(pvid.Int64)
				pr.ProveedorID = &v
			}
			if prodid.Valid {
				v := int(prodid.Int64)
				pr.ProductoID = &v
			}
			provs = append(provs, pr)
		}
	}
	return provs
}

type CreatePedidoRequest struct {
	ClienteID            *int                     `json:"clienteId"`
	ClienteCasual        bool                     `json:"clienteCasual"`
	ClienteNombre        string                   `json:"clienteNombre"`
	ClienteTelefono      string                   `json:"clienteTelefono"`
	ClienteDocumento     string                   `json:"clienteDocumento"`
	ClienteDireccion     string                   `json:"clienteDireccion"`
	CondicionVenta       string                   `json:"condicionVenta"`
	FechaPedido          *string                  `json:"fechaPedido"`
	TipoPago             *string                  `json:"tipoPago"`
	FechaCobro           *string                  `json:"fechaCobro"`
	MontoAbonado         float64                  `json:"montoAbonado"`
	ModalidadEntrega     string                   `json:"modalidadEntrega"`
	ModalidadEntregaOtro string                   `json:"modalidadEntregaOtro"`
	NotasProduccion      string                   `json:"notasProduccion"`
	Items                []CreatePedidoItemReq    `json:"items"`
	Proveedores          []CreatePedidoProvReq    `json:"proveedores"`
}

type CreatePedidoItemReq struct {
	ProductoID     *int    `json:"productoId"`
	EsNoRegistrado bool    `json:"esNoRegistrado"`
	NombreProducto string  `json:"nombreProducto"`
	SKU            string  `json:"sku"`
	Cantidad       float64 `json:"cantidad"`
	PrecioUnitario float64 `json:"precioUnitario"`
}

type CreatePedidoProvReq struct {
	ProveedorID     *int    `json:"proveedorId"`
	EsNoRegistrado  bool    `json:"esNoRegistrado"`
	NombreProveedor string  `json:"nombreProveedor"`
	ProductoID      *int    `json:"productoId"`
	ProductoNombre  string  `json:"productoNombre"`
	Cantidad        float64 `json:"cantidad"`
	Costo           float64 `json:"costo"`
	EstadoPago      string  `json:"estadoPago"`
	MontoPagado     float64 `json:"montoPagado"`
	SaldoPendiente  float64 `json:"saldoPendiente"`
}

// Create genera un nuevo pedido en la BD
func (h *PedidosHandler) Create(w http.ResponseWriter, r *http.Request) {
	if h.DB == nil {
		auth.WriteJSONError(w, http.StatusServiceUnavailable, "base de datos no disponible")
		return
	}

	var req CreatePedidoRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		auth.WriteJSONError(w, http.StatusBadRequest, "cuerpo de solicitud inválido")
		return
	}

	req.ClienteNombre = strings.TrimSpace(req.ClienteNombre)
	if req.ClienteNombre == "" {
		auth.WriteJSONError(w, http.StatusBadRequest, "el cliente es obligatorio")
		return
	}

	if len(req.Items) == 0 {
		auth.WriteJSONError(w, http.StatusBadRequest, "debe incluir al menos un producto en el pedido")
		return
	}

	condicion := strings.TrimSpace(req.CondicionVenta)
	if condicion != "Contado" && condicion != "Credito" {
		condicion = "Contado"
	}

	// Calcular monto total sumando subtotales de ítems
	var montoTotal float64
	for _, it := range req.Items {
		cant := it.Cantidad
		if cant <= 0 {
			cant = 1
		}
		montoTotal += cant * it.PrecioUnitario
	}

	var montoPagado, saldoPendiente float64
	var tipoPago, fechaCobro *string

	if condicion == "Contado" {
		montoPagado = montoTotal
		saldoPendiente = 0
	} else {
		// Crédito
		if req.FechaCobro != nil && strings.TrimSpace(*req.FechaCobro) != "" {
			fcClean := strings.TrimSpace(*req.FechaCobro)
			fechaCobro = &fcClean
		}

		tpVal := "Total"
		if req.TipoPago != nil && *req.TipoPago == "Parcial" {
			tpVal = "Parcial"
		}
		tipoPago = &tpVal

		if tpVal == "Parcial" {
			montoPagado = req.MontoAbonado
			if montoPagado < 0 {
				montoPagado = 0
			}
			if montoPagado > montoTotal {
				montoPagado = montoTotal
			}
			saldoPendiente = montoTotal - montoPagado
		} else {
			montoPagado = 0
			saldoPendiente = montoTotal
		}
	}

	modalidad := strings.TrimSpace(req.ModalidadEntrega)
	if modalidad == "" {
		modalidad = "Retiro en Local"
	}

	fechaPedido := time.Now()
	if req.FechaPedido != nil && strings.TrimSpace(*req.FechaPedido) != "" {
		if t, err := time.Parse("2006-01-02", strings.TrimSpace(*req.FechaPedido)); err == nil {
			fechaPedido = t
		}
	}
	anioISO, semanaISO := fechaPedido.ISOWeek()
	fechaPedidoStr := fechaPedido.Format("2006-01-02")

	// Iniciar transacción
	tx, err := h.DB.BeginTx(r.Context(), nil)
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "error al iniciar transacción: "+err.Error())
		return
	}
	defer tx.Rollback()

	// Generar número de pedido secuencial (ej. PED-000001)
	var lastID int
	_ = tx.QueryRowContext(r.Context(), "SELECT COALESCE(MAX(id), 0) FROM pedidos").Scan(&lastID)
	nextNum := lastID + 1
	numeroPedido := fmt.Sprintf("PED-%06d", nextNum)

	insertOrderSQL := `
		INSERT INTO pedidos (
			numero_pedido, cliente_id, cliente_casual, cliente_nombre,
			cliente_telefono, cliente_documento, cliente_direccion,
			condicion_venta, fecha_pedido, tipo_pago, fecha_cobro,
			monto_total, monto_pagado, saldo_pendiente,
			modalidad_entrega, modalidad_entrega_otro,
			estado, historial_estados, semana_iso, anio_iso, notas_produccion
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Creado', JSON_ARRAY(JSON_OBJECT('estado', 'Creado', 'fecha', DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s'))), ?, ?, ?)
	`

	res, err := tx.ExecContext(r.Context(), insertOrderSQL,
		numeroPedido, req.ClienteID, req.ClienteCasual, req.ClienteNombre,
		req.ClienteTelefono, req.ClienteDocumento, req.ClienteDireccion,
		condicion, fechaPedidoStr, tipoPago, fechaCobro,
		montoTotal, montoPagado, saldoPendiente,
		modalidad, req.ModalidadEntregaOtro,
		semanaISO, anioISO, req.NotasProduccion,
	)
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "error al insertar pedido: "+err.Error())
		return
	}

	pedidoID64, _ := res.LastInsertId()
	pedidoID := int(pedidoID64)

	// Insertar ítems
	insertItemSQL := `
		INSERT INTO pedido_items (
			pedido_id, producto_id, es_no_registrado, nombre_producto, sku, cantidad, precio_unitario, subtotal
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`
	for _, it := range req.Items {
		cant := it.Cantidad
		if cant <= 0 {
			cant = 1
		}
		subt := cant * it.PrecioUnitario
		_, err := tx.ExecContext(r.Context(), insertItemSQL,
			pedidoID, it.ProductoID, it.EsNoRegistrado, it.NombreProducto, it.SKU, cant, it.PrecioUnitario, subt,
		)
		if err != nil {
			auth.WriteJSONError(w, http.StatusInternalServerError, "error al insertar ítem del pedido: "+err.Error())
			return
		}
	}

	// Insertar proveedores si se cargaron y sincronizar con Pagos
	if len(req.Proveedores) > 0 {
		insertProvSQL := `
			INSERT INTO pedido_proveedores (
				pedido_id, proveedor_id, es_no_registrado, nombre_proveedor,
				producto_id, producto_nombre,
				cantidad, costo, subtotal,
				estado_pago, monto_pagado, saldo_pendiente
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`
		for _, pr := range req.Proveedores {
			cant := pr.Cantidad
			if cant <= 0 {
				cant = 1
			}
			subt := cant * pr.Costo

			prodID := pr.ProductoID
			prodNom := strings.TrimSpace(pr.ProductoNombre)
			if len(req.Items) == 1 && prodNom == "" {
				prodID = req.Items[0].ProductoID
				prodNom = req.Items[0].NombreProducto
			}

			estPago := strings.TrimSpace(pr.EstadoPago)
			if estPago != "Pagado" && estPago != "Pago Parcial" {
				estPago = "Pendiente"
			}
			mPagado := pr.MontoPagado
			sPendiente := pr.SaldoPendiente
			if estPago == "Pagado" {
				mPagado = subt
				sPendiente = 0
			} else if estPago == "Pendiente" {
				mPagado = 0
				sPendiente = subt
			} else if estPago == "Pago Parcial" {
				if mPagado < 0 {
					mPagado = 0
				}
				if mPagado > subt {
					mPagado = subt
				}
				sPendiente = subt - mPagado
			}

			resProv, err := tx.ExecContext(r.Context(), insertProvSQL,
				pedidoID, pr.ProveedorID, pr.EsNoRegistrado, pr.NombreProveedor,
				prodID, prodNom,
				cant, pr.Costo, subt,
				estPago, mPagado, sPendiente,
			)
			if err != nil {
				auth.WriteJSONError(w, http.StatusInternalServerError, "error al asociar proveedor del pedido: "+err.Error())
				return
			}

			ppID64, _ := resProv.LastInsertId()
			ppID := int(ppID64)

			var provRUC string
			if pr.ProveedorID != nil && *pr.ProveedorID > 0 {
				_ = tx.QueryRowContext(r.Context(), "SELECT COALESCE(ruc_documento, '') FROM proveedores WHERE id = ?", *pr.ProveedorID).Scan(&provRUC)
			}

			var lastPagoID int
			_ = tx.QueryRowContext(r.Context(), "SELECT COALESCE(MAX(id), 0) FROM pagos").Scan(&lastPagoID)
			numPago := fmt.Sprintf("PAG-%06d", lastPagoID+1)

			insertPagoSQL := `
				INSERT INTO pagos (
					numero_pago, pedido_id, pedido_proveedor_id, tipo_beneficiario,
					proveedor_id, proveedor_nombre, proveedor_ruc, es_proveedor_temporal,
					cliente_id, cliente_nombre, cliente_documento, cliente_telefono,
					producto_id, producto_nombre, es_producto_temporal,
					cantidad, monto_total, monto_pagado, saldo_pendiente,
					estado_pago, metodo_pago, fecha_pago, semana_iso, anio_iso,
					notas, created_by
				) VALUES (?, ?, ?, 'Proveedor', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, 'Efectivo', ?, ?, ?, ?, ?)
			`
			notes := fmt.Sprintf("Generado automáticamente desde Pedido %s", numeroPedido)
			_, _ = tx.ExecContext(r.Context(), insertPagoSQL,
				numPago, pedidoID, ppID,
				pr.ProveedorID, pr.NombreProveedor, provRUC, pr.EsNoRegistrado,
				req.ClienteID, req.ClienteNombre, req.ClienteDocumento, req.ClienteTelefono,
				prodID, prodNom,
				cant, subt, mPagado, sPendiente,
				estPago, fechaPedidoStr, semanaISO, anioISO,
				notes, h.getActorName(r),
			)
		}
	}

	if err := tx.Commit(); err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "error al confirmar creación del pedido: "+err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"message":      "Pedido creado exitosamente",
		"id":           pedidoID,
		"numeroPedido": numeroPedido,
	})
}

// UpdateEstado actualiza el estado del pedido ('Creado', 'En Producción', 'En Pausa', 'Listo', 'Cancelado')
func (h *PedidosHandler) UpdateEstado(w http.ResponseWriter, r *http.Request, id int) {
	if h.DB == nil {
		auth.WriteJSONError(w, http.StatusServiceUnavailable, "base de datos no disponible")
		return
	}

	var body struct {
		Estado string `json:"estado"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		auth.WriteJSONError(w, http.StatusBadRequest, "cuerpo de solicitud inválido")
		return
	}

	body.Estado = strings.TrimSpace(body.Estado)
	validStates := map[string]bool{
		"Creado":        true,
		"En Producción": true,
		"En Pausa":      true,
		"Listo":         true,
		"Cancelado":     true,
	}
	if !validStates[body.Estado] {
		auth.WriteJSONError(w, http.StatusBadRequest, "estado de pedido no reconocido")
		return
	}

	nowStr := time.Now().Format("2006-01-02 15:04:05")
	var sqlUpdate string
	switch body.Estado {
	case "En Producción":
		sqlUpdate = `
			UPDATE pedidos SET 
				estado = ?,
				fecha_en_produccion = NOW(),
				historial_estados = JSON_ARRAY_APPEND(COALESCE(historial_estados, '[]'), '$', JSON_OBJECT('estado', ?, 'fecha', ?)),
				updated_at = NOW()
			WHERE id = ? AND deleted_at IS NULL`
	case "En Pausa":
		sqlUpdate = `
			UPDATE pedidos SET 
				estado = ?,
				fecha_en_pausa = NOW(),
				historial_estados = JSON_ARRAY_APPEND(COALESCE(historial_estados, '[]'), '$', JSON_OBJECT('estado', ?, 'fecha', ?)),
				updated_at = NOW()
			WHERE id = ? AND deleted_at IS NULL`
	case "Listo":
		sqlUpdate = `
			UPDATE pedidos SET 
				estado = ?,
				fecha_listo = NOW(),
				historial_estados = JSON_ARRAY_APPEND(COALESCE(historial_estados, '[]'), '$', JSON_OBJECT('estado', ?, 'fecha', ?)),
				updated_at = NOW()
			WHERE id = ? AND deleted_at IS NULL`
	default:
		sqlUpdate = `
			UPDATE pedidos SET 
				estado = ?,
				historial_estados = JSON_ARRAY_APPEND(COALESCE(historial_estados, '[]'), '$', JSON_OBJECT('estado', ?, 'fecha', ?)),
				updated_at = NOW()
			WHERE id = ? AND deleted_at IS NULL`
	}

	_, err := h.DB.ExecContext(r.Context(), sqlUpdate, body.Estado, body.Estado, nowStr, id)
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "error al actualizar estado: "+err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"message": "Estado del pedido actualizado",
		"estado":  body.Estado,
		"fecha":   nowStr,
	})
}

// Update actualiza un pedido existente
func (h *PedidosHandler) Update(w http.ResponseWriter, r *http.Request, id int) {
	if h.DB == nil {
		auth.WriteJSONError(w, http.StatusServiceUnavailable, "base de datos no disponible")
		return
	}

	var req CreatePedidoRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		auth.WriteJSONError(w, http.StatusBadRequest, "cuerpo de solicitud inválido")
		return
	}

	req.ClienteNombre = strings.TrimSpace(req.ClienteNombre)
	if req.ClienteNombre == "" {
		auth.WriteJSONError(w, http.StatusBadRequest, "el cliente es obligatorio")
		return
	}

	if len(req.Items) == 0 {
		auth.WriteJSONError(w, http.StatusBadRequest, "debe incluir al menos un producto en el pedido")
		return
	}

	condicion := strings.TrimSpace(req.CondicionVenta)
	if condicion != "Contado" && condicion != "Credito" {
		condicion = "Contado"
	}

	var montoTotal float64
	for _, it := range req.Items {
		cant := it.Cantidad
		if cant <= 0 {
			cant = 1
		}
		montoTotal += cant * it.PrecioUnitario
	}

	var montoPagado, saldoPendiente float64
	var tipoPago, fechaCobro *string

	if condicion == "Contado" {
		montoPagado = montoTotal
		saldoPendiente = 0
	} else {
		if req.FechaCobro != nil && strings.TrimSpace(*req.FechaCobro) != "" {
			fcClean := strings.TrimSpace(*req.FechaCobro)
			fechaCobro = &fcClean
		}

		tpVal := "Total"
		if req.TipoPago != nil && *req.TipoPago == "Parcial" {
			tpVal = "Parcial"
		}
		tipoPago = &tpVal

		if tpVal == "Parcial" {
			montoPagado = req.MontoAbonado
			if montoPagado < 0 {
				montoPagado = 0
			}
			if montoPagado > montoTotal {
				montoPagado = montoTotal
			}
			saldoPendiente = montoTotal - montoPagado
		} else {
			montoPagado = 0
			saldoPendiente = montoTotal
		}
	}

	modalidad := strings.TrimSpace(req.ModalidadEntrega)
	if modalidad == "" {
		modalidad = "Retiro en Local"
	}

	fechaPedido := time.Now()
	if req.FechaPedido != nil && strings.TrimSpace(*req.FechaPedido) != "" {
		if t, err := time.Parse("2006-01-02", strings.TrimSpace(*req.FechaPedido)); err == nil {
			fechaPedido = t
		}
	}
	anioISO, semanaISO := fechaPedido.ISOWeek()
	fechaPedidoStr := fechaPedido.Format("2006-01-02")

	tx, err := h.DB.BeginTx(r.Context(), nil)
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "error al iniciar transacción: "+err.Error())
		return
	}
	defer tx.Rollback()

	updateSQL := `
		UPDATE pedidos SET
			cliente_id = ?, cliente_casual = ?, cliente_nombre = ?,
			cliente_telefono = ?, cliente_documento = ?, cliente_direccion = ?,
			condicion_venta = ?, fecha_pedido = ?, tipo_pago = ?, fecha_cobro = ?,
			monto_total = ?, monto_pagado = ?, saldo_pendiente = ?,
			modalidad_entrega = ?, modalidad_entrega_otro = ?,
			semana_iso = ?, anio_iso = ?,
			notas_produccion = ?
		WHERE id = ? AND deleted_at IS NULL
	`
	_, err = tx.ExecContext(r.Context(), updateSQL,
		req.ClienteID, req.ClienteCasual, req.ClienteNombre,
		req.ClienteTelefono, req.ClienteDocumento, req.ClienteDireccion,
		condicion, fechaPedidoStr, tipoPago, fechaCobro,
		montoTotal, montoPagado, saldoPendiente,
		modalidad, req.ModalidadEntregaOtro,
		semanaISO, anioISO,
		req.NotasProduccion, id,
	)
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "error al actualizar pedido: "+err.Error())
		return
	}

	// Reemplazar ítems
	_, _ = tx.ExecContext(r.Context(), "DELETE FROM pedido_items WHERE pedido_id = ?", id)
	insertItemSQL := `
		INSERT INTO pedido_items (
			pedido_id, producto_id, es_no_registrado, nombre_producto, sku, cantidad, precio_unitario, subtotal
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`
	for _, it := range req.Items {
		cant := it.Cantidad
		if cant <= 0 {
			cant = 1
		}
		subt := cant * it.PrecioUnitario
		_, err := tx.ExecContext(r.Context(), insertItemSQL,
			id, it.ProductoID, it.EsNoRegistrado, it.NombreProducto, it.SKU, cant, it.PrecioUnitario, subt,
		)
		if err != nil {
			auth.WriteJSONError(w, http.StatusInternalServerError, "error al actualizar ítems: "+err.Error())
			return
		}
	}

	// Reemplazar proveedores y sincronizar con Pagos
	_, _ = tx.ExecContext(r.Context(), "DELETE FROM pagos WHERE pedido_id = ? AND pedido_proveedor_id IS NOT NULL", id)
	_, _ = tx.ExecContext(r.Context(), "DELETE FROM pedido_proveedores WHERE pedido_id = ?", id)
	if len(req.Proveedores) > 0 {
		insertProvSQL := `
			INSERT INTO pedido_proveedores (
				pedido_id, proveedor_id, es_no_registrado, nombre_proveedor,
				producto_id, producto_nombre,
				cantidad, costo, subtotal,
				estado_pago, monto_pagado, saldo_pendiente
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`
		for _, pr := range req.Proveedores {
			cant := pr.Cantidad
			if cant <= 0 {
				cant = 1
			}
			subt := cant * pr.Costo

			prodID := pr.ProductoID
			prodNom := strings.TrimSpace(pr.ProductoNombre)
			if len(req.Items) == 1 && prodNom == "" {
				prodID = req.Items[0].ProductoID
				prodNom = req.Items[0].NombreProducto
			}

			estPago := strings.TrimSpace(pr.EstadoPago)
			if estPago != "Pagado" && estPago != "Pago Parcial" {
				estPago = "Pendiente"
			}
			mPagado := pr.MontoPagado
			sPendiente := pr.SaldoPendiente
			if estPago == "Pagado" {
				mPagado = subt
				sPendiente = 0
			} else if estPago == "Pendiente" {
				mPagado = 0
				sPendiente = subt
			} else if estPago == "Pago Parcial" {
				if mPagado < 0 {
					mPagado = 0
				}
				if mPagado > subt {
					mPagado = subt
				}
				sPendiente = subt - mPagado
			}

			resProv, err := tx.ExecContext(r.Context(), insertProvSQL,
				id, pr.ProveedorID, pr.EsNoRegistrado, pr.NombreProveedor,
				prodID, prodNom,
				cant, pr.Costo, subt,
				estPago, mPagado, sPendiente,
			)
			if err != nil {
				auth.WriteJSONError(w, http.StatusInternalServerError, "error al actualizar proveedores: "+err.Error())
				return
			}

			ppID64, _ := resProv.LastInsertId()
			ppID := int(ppID64)

			var provRUC string
			if pr.ProveedorID != nil && *pr.ProveedorID > 0 {
				_ = tx.QueryRowContext(r.Context(), "SELECT COALESCE(ruc_documento, '') FROM proveedores WHERE id = ?", *pr.ProveedorID).Scan(&provRUC)
			}

			var lastPagoID int
			_ = tx.QueryRowContext(r.Context(), "SELECT COALESCE(MAX(id), 0) FROM pagos").Scan(&lastPagoID)
			numPago := fmt.Sprintf("PAG-%06d", lastPagoID+1)

			insertPagoSQL := `
				INSERT INTO pagos (
					numero_pago, pedido_id, pedido_proveedor_id, tipo_beneficiario,
					proveedor_id, proveedor_nombre, proveedor_ruc, es_proveedor_temporal,
					cliente_id, cliente_nombre, cliente_documento, cliente_telefono,
					producto_id, producto_nombre, es_producto_temporal,
					cantidad, monto_total, monto_pagado, saldo_pendiente,
					estado_pago, metodo_pago, fecha_pago, semana_iso, anio_iso,
					notas, created_by
				) VALUES (?, ?, ?, 'Proveedor', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, 'Efectivo', ?, ?, ?, ?, ?)
			`
			notes := fmt.Sprintf("Generado automáticamente desde Pedido %s", id)
			_, _ = tx.ExecContext(r.Context(), insertPagoSQL,
				numPago, id, ppID,
				pr.ProveedorID, pr.NombreProveedor, provRUC, pr.EsNoRegistrado,
				req.ClienteID, req.ClienteNombre, req.ClienteDocumento, req.ClienteTelefono,
				prodID, prodNom,
				cant, subt, mPagado, sPendiente,
				estPago, fechaPedidoStr, semanaISO, anioISO,
				notes, h.getActorName(r),
			)
		}
	}

	if err := tx.Commit(); err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "error al confirmar actualización: "+err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]any{"message": "Pedido actualizado exitosamente"})
}

// SoftDelete envía el pedido a Reciclaje
func (h *PedidosHandler) SoftDelete(w http.ResponseWriter, r *http.Request, id int) {
	if h.DB == nil {
		auth.WriteJSONError(w, http.StatusServiceUnavailable, "base de datos no disponible")
		return
	}

	actor := h.getActorName(r)
	res, err := h.DB.ExecContext(r.Context(), `
		UPDATE pedidos
		SET deleted_at = NOW(), deleted_by = ?
		WHERE id = ? AND deleted_at IS NULL
	`, actor, id)
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "error al eliminar pedido: "+err.Error())
		return
	}

	// Sincronizar borrado suave a los pagos originados por este pedido
	_, _ = h.DB.ExecContext(r.Context(), `
		UPDATE pagos
		SET deleted_at = NOW(), deleted_by = ?
		WHERE pedido_id = ? AND deleted_at IS NULL
	`, actor, id)

	affected, _ := res.RowsAffected()
	if affected == 0 {
		auth.WriteJSONError(w, http.StatusNotFound, "pedido no encontrado o ya eliminado")
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"message": "Pedido enviado a la papelera de reciclaje exitosamente",
	})
}

