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

type PagosHandler struct {
	DB *sql.DB
}

func NewPagosHandler(dbConn *sql.DB) *PagosHandler {
	h := &PagosHandler{DB: dbConn}
	if dbConn != nil {
		h.ensureSchema()
	}
	return h
}

func (h *PagosHandler) ensureSchema() {
	q := `CREATE TABLE IF NOT EXISTS pagos (
		id INT AUTO_INCREMENT PRIMARY KEY,
		numero_pago VARCHAR(50) NOT NULL UNIQUE,
		pedido_id INT NULL DEFAULT NULL,
		pedido_proveedor_id INT NULL DEFAULT NULL,
		tipo_beneficiario VARCHAR(50) NOT NULL DEFAULT 'Proveedor',
		referencia_pago VARCHAR(255) NULL DEFAULT NULL,
		proveedor_id INT NULL DEFAULT NULL,
		proveedor_nombre VARCHAR(200) NOT NULL,
		proveedor_ruc VARCHAR(50) NULL DEFAULT NULL,
		es_proveedor_temporal TINYINT(1) NOT NULL DEFAULT 0,
		cliente_id INT NULL DEFAULT NULL,
		cliente_nombre VARCHAR(200) NULL DEFAULT NULL,
		cliente_documento VARCHAR(60) NULL DEFAULT NULL,
		cliente_telefono VARCHAR(60) NULL DEFAULT NULL,
		producto_id INT NULL DEFAULT NULL,
		producto_nombre VARCHAR(255) NOT NULL,
		es_producto_temporal TINYINT(1) NOT NULL DEFAULT 0,
		cantidad DECIMAL(12,2) NOT NULL DEFAULT 1,
		monto_total DECIMAL(15,2) NOT NULL DEFAULT 0,
		monto_pagado DECIMAL(15,2) NOT NULL DEFAULT 0,
		saldo_pendiente DECIMAL(15,2) NOT NULL DEFAULT 0,
		estado_pago ENUM('Pendiente', 'Pagado', 'Pago Parcial') NOT NULL DEFAULT 'Pendiente',
		metodo_pago VARCHAR(60) NOT NULL DEFAULT 'Efectivo',
		fecha_pago DATE NOT NULL,
		semana_iso INT NOT NULL,
		anio_iso INT NOT NULL,
		historial_parciales LONGTEXT NULL DEFAULT NULL,
		notas TEXT NULL,
		created_by VARCHAR(150) NULL DEFAULT NULL,
		deleted_at DATETIME NULL DEFAULT NULL,
		deleted_by VARCHAR(150) NULL DEFAULT NULL,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
		INDEX idx_pagos_numero (numero_pago),
		INDEX idx_pagos_pedido (pedido_id),
		INDEX idx_pagos_pedido_proveedor (pedido_proveedor_id),
		INDEX idx_pagos_proveedor (proveedor_id),
		INDEX idx_pagos_cliente (cliente_id),
		INDEX idx_pagos_estado (estado_pago),
		INDEX idx_pagos_fecha (fecha_pago),
		INDEX idx_pagos_semana (semana_iso, anio_iso),
		INDEX idx_pagos_deleted (deleted_at)
	) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`

	_, _ = h.DB.Exec(q)

	// Ampliar tipo_beneficiario para soportar Proveedor, Colaborador, Otros (y Cliente histórico)
	_, _ = h.DB.Exec("ALTER TABLE pagos MODIFY COLUMN tipo_beneficiario VARCHAR(50) NOT NULL DEFAULT 'Proveedor'")
	_, _ = h.DB.Exec("ALTER TABLE pagos ADD COLUMN referencia_pago VARCHAR(255) NULL DEFAULT NULL AFTER tipo_beneficiario")
	_, _ = h.DB.Exec("ALTER TABLE pagos ADD COLUMN historial_parciales LONGTEXT NULL DEFAULT NULL AFTER anio_iso")
	_, _ = h.DB.Exec("ALTER TABLE pagos ADD COLUMN es_recurrente TINYINT(1) NOT NULL DEFAULT 0 AFTER historial_parciales")
	_, _ = h.DB.Exec("ALTER TABLE pagos ADD COLUMN recurrencia_frecuencia VARCHAR(30) NULL DEFAULT NULL AFTER es_recurrente")
	_, _ = h.DB.Exec("ALTER TABLE pagos ADD COLUMN recurrencia_tipo_dia VARCHAR(30) NULL DEFAULT NULL AFTER recurrencia_frecuencia")
	_, _ = h.DB.Exec("ALTER TABLE pagos ADD COLUMN recurrencia_fecha_inicio DATE NULL DEFAULT NULL AFTER recurrencia_tipo_dia")
	_, _ = h.DB.Exec("ALTER TABLE pagos ADD COLUMN recurrencia_fecha_fin DATE NULL DEFAULT NULL AFTER recurrencia_fecha_inicio")
	_, _ = h.DB.Exec("ALTER TABLE pagos ADD COLUMN recurrencia_grupo_id VARCHAR(60) NULL DEFAULT NULL AFTER recurrencia_fecha_fin")

	// Columnas para pedido_proveedores
	_, _ = h.DB.Exec("ALTER TABLE pedido_proveedores ADD COLUMN producto_id INT NULL DEFAULT NULL AFTER nombre_proveedor")
	_, _ = h.DB.Exec("ALTER TABLE pedido_proveedores ADD COLUMN producto_nombre VARCHAR(255) NULL DEFAULT NULL AFTER producto_id")
	_, _ = h.DB.Exec("ALTER TABLE pedido_proveedores ADD COLUMN estado_pago ENUM('Pendiente', 'Pagado', 'Pago Parcial') NOT NULL DEFAULT 'Pendiente' AFTER subtotal")
	_, _ = h.DB.Exec("ALTER TABLE pedido_proveedores ADD COLUMN monto_pagado DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER estado_pago")
	_, _ = h.DB.Exec("ALTER TABLE pedido_proveedores ADD COLUMN saldo_pendiente DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER monto_pagado")
}

func (h *PagosHandler) getActorName(r *http.Request) string {
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

// HandleCollection maneja GET /api/pagos y POST /api/pagos
func (h *PagosHandler) HandleCollection(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.List(w, r)
	case http.MethodPost:
		h.Create(w, r)
	default:
		auth.WriteJSONError(w, http.StatusMethodNotAllowed, "método no permitido")
	}
}

// HandleItem maneja GET, PUT, DELETE sobre /api/pagos/{id}
func (h *PagosHandler) HandleItem(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/pagos/")
	parts := strings.Split(path, "/")
	if len(parts) == 0 || parts[0] == "" {
		auth.WriteJSONError(w, http.StatusBadRequest, "ID de pago requerido")
		return
	}

	id, err := strconv.Atoi(parts[0])
	if err != nil || id <= 0 {
		auth.WriteJSONError(w, http.StatusBadRequest, "ID de pago inválido")
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

// List devuelve los pagos filtrados y paginados
func (h *PagosHandler) List(w http.ResponseWriter, r *http.Request) {
	if h.DB == nil {
		auth.WriteJSONError(w, http.StatusServiceUnavailable, "base de datos no disponible")
		return
	}

	filter := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("filter")))
	search := strings.TrimSpace(r.URL.Query().Get("search"))

	page := 1
	if p, err := strconv.Atoi(r.URL.Query().Get("page")); err == nil && p > 0 {
		page = p
	}
	pageSize := 20
	if r.URL.Query().Get("page_size") == "all" {
		pageSize = 100000
	} else if ps, err := strconv.Atoi(r.URL.Query().Get("page_size")); err == nil && ps > 0 {
		pageSize = ps
	}
	offset := (page - 1) * pageSize

	whereClauses := []string{"p.deleted_at IS NULL"}
	var args []any

	now := time.Now()
	todayStr := now.Format("2006-01-02")
	anioISO, semanaISO := now.ISOWeek()
	currentMonth := now.Format("2006-01")

	// Filtros opcionales de encabezado de tabla
	if ben := strings.TrimSpace(r.URL.Query().Get("beneficiario")); ben != "" && ben != "todos" {
		whereClauses = append(whereClauses, "p.tipo_beneficiario = ?")
		args = append(args, ben)
	}
	if est := strings.TrimSpace(r.URL.Query().Get("estado")); est != "" && est != "todos" {
		whereClauses = append(whereClauses, "p.estado_pago = ?")
		args = append(args, est)
	}
	if semStr := strings.TrimSpace(r.URL.Query().Get("semana")); semStr != "" && semStr != "todas" {
		if semInt, err := strconv.Atoi(semStr); err == nil && semInt > 0 {
			whereClauses = append(whereClauses, "p.semana_iso = ?")
			args = append(args, semInt)
		}
	}
	if diaStr := strings.TrimSpace(r.URL.Query().Get("dia")); diaStr != "" && diaStr != "todos" {
		if len(diaStr) == 10 && strings.Count(diaStr, "-") == 2 {
			whereClauses = append(whereClauses, "p.fecha_pago = ?")
			args = append(args, diaStr)
		} else if dNum, err := strconv.Atoi(diaStr); err == nil && dNum >= 1 && dNum <= 31 {
			whereClauses = append(whereClauses, "DAY(p.fecha_pago) = ? AND DATE_FORMAT(p.fecha_pago, '%Y-%m') = ?")
			args = append(args, dNum, currentMonth)
		}
	}

	switch filter {
	case "pendientes":
		whereClauses = append(whereClauses, "p.estado_pago IN ('Pendiente', 'Pago Parcial')")
	case "hoy":
		whereClauses = append(whereClauses, "p.fecha_pago = ?")
		args = append(args, todayStr)
	case "semana":
		whereClauses = append(whereClauses, "p.semana_iso = ? AND p.anio_iso = ?")
		args = append(args, semanaISO, anioISO)
	case "mes":
		whereClauses = append(whereClauses, "DATE_FORMAT(p.fecha_pago, '%Y-%m') = ?")
		args = append(args, currentMonth)
	}

	if search != "" {
		sPattern := "%" + search + "%"
		whereClauses = append(whereClauses, `(
			p.numero_pago LIKE ? OR
			p.proveedor_nombre LIKE ? OR
			COALESCE(p.referencia_pago, '') LIKE ? OR
			COALESCE(p.proveedor_ruc, '') LIKE ? OR
			COALESCE(p.cliente_nombre, '') LIKE ? OR
			p.producto_nombre LIKE ? OR
			COALESCE(ped.numero_pedido, '') LIKE ? OR
			COALESCE(p.recurrencia_frecuencia, '') LIKE ? OR
			COALESCE(p.recurrencia_grupo_id, '') LIKE ?
		)`)
		args = append(args, sPattern, sPattern, sPattern, sPattern, sPattern, sPattern, sPattern, sPattern, sPattern)
	}

	whereSQL := strings.Join(whereClauses, " AND ")

	// Total count
	countQuery := fmt.Sprintf(`
		SELECT COUNT(*)
		FROM pagos p
		LEFT JOIN pedidos ped ON p.pedido_id = ped.id
		WHERE %s
	`, whereSQL)

	var total int
	err := h.DB.QueryRowContext(r.Context(), countQuery, args...).Scan(&total)
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "error al contar pagos: "+err.Error())
		return
	}

	// Select query
	dataQuery := fmt.Sprintf(`
		SELECT
			p.id, p.numero_pago, p.pedido_id, COALESCE(ped.numero_pedido, ''),
			p.pedido_proveedor_id, p.tipo_beneficiario, COALESCE(p.referencia_pago, ''),
			p.proveedor_id, p.proveedor_nombre, COALESCE(p.proveedor_ruc, ''), p.es_proveedor_temporal,
			p.cliente_id, COALESCE(p.cliente_nombre, ''), COALESCE(p.cliente_documento, ''), COALESCE(p.cliente_telefono, ''),
			p.producto_id, p.producto_nombre, p.es_producto_temporal,
			p.cantidad, p.monto_total, p.monto_pagado, p.saldo_pendiente,
			p.estado_pago, p.metodo_pago,
			DATE_FORMAT(p.fecha_pago, '%%%%Y-%%%%m-%%%%d'),
			p.semana_iso, p.anio_iso, COALESCE(p.historial_parciales, '[]'), COALESCE(p.notas, ''),
			COALESCE(p.es_recurrente, 0), COALESCE(p.recurrencia_frecuencia, ''), COALESCE(p.recurrencia_tipo_dia, ''),
			COALESCE(DATE_FORMAT(p.recurrencia_fecha_inicio, '%%%%Y-%%%%m-%%%%d'), ''),
			COALESCE(DATE_FORMAT(p.recurrencia_fecha_fin, '%%%%Y-%%%%m-%%%%d'), ''),
			COALESCE(p.recurrencia_grupo_id, ''),
			p.created_by, p.created_at, p.updated_at
		FROM pagos p
		LEFT JOIN pedidos ped ON p.pedido_id = ped.id
		WHERE %s
		ORDER BY p.id DESC
		LIMIT ? OFFSET ?
	`, whereSQL)

	dataArgs := append(args, pageSize, offset)
	rows, err := h.DB.QueryContext(r.Context(), dataQuery, dataArgs...)
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "error al consultar pagos: "+err.Error())
		return
	}
	defer rows.Close()

	list := make([]models.Pago, 0)
	for rows.Next() {
		var item models.Pago
		var pedID, provID, cliID, prodID, pedProvID sql.NullInt64
		var createdBy sql.NullString
		var histJSON string

		err := rows.Scan(
			&item.ID, &item.NumeroPago, &pedID, &item.NumeroPedido,
			&pedProvID, &item.TipoBeneficiario, &item.ReferenciaPago,
			&provID, &item.ProveedorNombre, &item.ProveedorRUC, &item.EsProveedorTemporal,
			&cliID, &item.ClienteNombre, &item.ClienteDocumento, &item.ClienteTelefono,
			&prodID, &item.ProductoNombre, &item.EsProductoTemporal,
			&item.Cantidad, &item.MontoTotal, &item.MontoPagado, &item.SaldoPendiente,
			&item.EstadoPago, &item.MetodoPago,
			&item.FechaPago,
			&item.SemanaISO, &item.AnioISO, &histJSON, &item.Notas,
			&item.EsRecurrente, &item.RecurrenciaFrecuencia, &item.RecurrenciaTipoDia,
			&item.RecurrenciaFechaInicio, &item.RecurrenciaFechaFin, &item.RecurrenciaGrupoID,
			&createdBy, &item.CreatedAt, &item.UpdatedAt,
		)
		if err != nil {
			continue
		}

		item.HistorialParciales = make([]models.PagoParcialItem, 0)
		if strings.TrimSpace(histJSON) != "" {
			_ = json.Unmarshal([]byte(histJSON), &item.HistorialParciales)
		}
		if len(item.HistorialParciales) == 0 && item.EstadoPago == "Pago Parcial" && item.MontoPagado > 0 {
			item.HistorialParciales = []models.PagoParcialItem{
				{
					Monto:      item.MontoPagado,
					FechaPago:  item.FechaPago,
					SemanaISO:  item.SemanaISO,
					AnioISO:    item.AnioISO,
					MetodoPago: item.MetodoPago,
				},
			}
		}

		if pedID.Valid {
			v := int(pedID.Int64)
			item.PedidoID = &v
		}
		if pedProvID.Valid {
			v := int(pedProvID.Int64)
			item.PedidoProveedorID = &v
		}
		if provID.Valid {
			v := int(provID.Int64)
			item.ProveedorID = &v
		}
		if cliID.Valid {
			v := int(cliID.Int64)
			item.ClienteID = &v
		}
		if prodID.Valid {
			v := int(prodID.Int64)
			item.ProductoID = &v
		}
		if createdBy.Valid {
			item.CreatedBy = &createdBy.String
		}

		list = append(list, item)
	}

	var sumTotal, sumPagado, sumSaldo float64
	totalsQuery := fmt.Sprintf(`
		SELECT
			COALESCE(SUM(p.monto_total), 0),
			COALESCE(SUM(p.monto_pagado), 0),
			COALESCE(SUM(p.saldo_pendiente), 0)
		FROM pagos p
		LEFT JOIN pedidos ped ON p.pedido_id = ped.id
		WHERE %s
	`, whereSQL)
	_ = h.DB.QueryRowContext(r.Context(), totalsQuery, args...).Scan(&sumTotal, &sumPagado, &sumSaldo)

	stats := h.getStats(r.Context())

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"data":           list,
		"stats":          stats,
		"filteredTotals": map[string]float64{
			"montoTotal":  sumTotal,
			"montoPagado": sumPagado,
			"saldo":       sumSaldo,
		},
		"page":           page,
		"pageSize":       pageSize,
		"total":          total,
		"totalPages":     (total + pageSize - 1) / pageSize,
	})
}

func (h *PagosHandler) getStats(ctx context.Context) models.PagoStats {
	var s models.PagoStats
	if h.DB == nil {
		return s
	}

	now := time.Now()
	todayStr := now.Format("2006-01-02")
	anioISO, semanaISO := now.ISOWeek()
	currentMonth := now.Format("2006-01")

	query := `
		SELECT
			COUNT(*) AS total,
			COUNT(CASE WHEN estado_pago IN ('Pendiente', 'Pago Parcial') THEN 1 END) AS pendientes,
			COUNT(CASE WHEN fecha_pago = ? THEN 1 END) AS pagados_hoy,
			COUNT(CASE WHEN semana_iso = ? AND anio_iso = ? THEN 1 END) AS pagados_semana,
			COUNT(CASE WHEN DATE_FORMAT(fecha_pago, '%Y-%m') = ? THEN 1 END) AS pagados_mes,
			COALESCE(SUM(monto_total), 0) AS monto_total,
			COALESCE(SUM(saldo_pendiente), 0) AS monto_pendiente,
			COALESCE(SUM(monto_pagado), 0) AS monto_pagado,
			COALESCE(SUM(CASE WHEN fecha_pago = ? THEN monto_total ELSE 0 END), 0) AS monto_hoy,
			COALESCE(SUM(CASE WHEN semana_iso = ? AND anio_iso = ? THEN monto_total ELSE 0 END), 0) AS monto_semana,
			COALESCE(SUM(CASE WHEN DATE_FORMAT(fecha_pago, '%Y-%m') = ? THEN monto_total ELSE 0 END), 0) AS monto_mes,
			COALESCE(SUM(CASE WHEN fecha_pago = ? THEN monto_pagado ELSE 0 END), 0) AS monto_pagado_hoy,
			COALESCE(SUM(CASE WHEN semana_iso = ? AND anio_iso = ? THEN monto_pagado ELSE 0 END), 0) AS monto_pagado_semana,
			COALESCE(SUM(CASE WHEN DATE_FORMAT(fecha_pago, '%Y-%m') = ? THEN monto_pagado ELSE 0 END), 0) AS monto_pagado_mes
		FROM pagos
		WHERE deleted_at IS NULL
	`
	_ = h.DB.QueryRowContext(ctx, query,
		todayStr, semanaISO, anioISO, currentMonth,
		todayStr, semanaISO, anioISO, currentMonth,
		todayStr, semanaISO, anioISO, currentMonth,
	).Scan(
		&s.Total, &s.Pendientes, &s.PagadosHoy, &s.PagadosSemana, &s.PagadosMes,
		&s.MontoTotal, &s.MontoPendiente, &s.MontoPagado,
		&s.MontoHoy, &s.MontoSemana, &s.MontoMes,
		&s.MontoPagadoHoy, &s.MontoPagadoSemana, &s.MontoPagadoMes,
	)
	return s
}

// GetByID devuelve un pago en detalle
func (h *PagosHandler) GetByID(w http.ResponseWriter, r *http.Request, id int) {
	if h.DB == nil {
		auth.WriteJSONError(w, http.StatusServiceUnavailable, "base de datos no disponible")
		return
	}

	query := `
		SELECT
			p.id, p.numero_pago, p.pedido_id, COALESCE(ped.numero_pedido, ''),
			p.pedido_proveedor_id, p.tipo_beneficiario, COALESCE(p.referencia_pago, ''),
			p.proveedor_id, p.proveedor_nombre, COALESCE(p.proveedor_ruc, ''), p.es_proveedor_temporal,
			p.cliente_id, COALESCE(p.cliente_nombre, ''), COALESCE(p.cliente_documento, ''), COALESCE(p.cliente_telefono, ''),
			p.producto_id, p.producto_nombre, p.es_producto_temporal,
			p.cantidad, p.monto_total, p.monto_pagado, p.saldo_pendiente,
			p.estado_pago, p.metodo_pago,
			DATE_FORMAT(p.fecha_pago, '%Y-%m-%d'),
			p.semana_iso, p.anio_iso, COALESCE(p.historial_parciales, '[]'), COALESCE(p.notas, ''),
			COALESCE(p.es_recurrente, 0), COALESCE(p.recurrencia_frecuencia, ''), COALESCE(p.recurrencia_tipo_dia, ''),
			COALESCE(DATE_FORMAT(p.recurrencia_fecha_inicio, '%Y-%m-%d'), ''),
			COALESCE(DATE_FORMAT(p.recurrencia_fecha_fin, '%Y-%m-%d'), ''),
			COALESCE(p.recurrencia_grupo_id, ''),
			p.created_by, p.created_at, p.updated_at
		FROM pagos p
		LEFT JOIN pedidos ped ON p.pedido_id = ped.id
		WHERE p.id = ? AND p.deleted_at IS NULL
	`

	var item models.Pago
	var pedID, provID, cliID, prodID, pedProvID sql.NullInt64
	var createdBy sql.NullString
	var histJSON string

	err := h.DB.QueryRowContext(r.Context(), query, id).Scan(
		&item.ID, &item.NumeroPago, &pedID, &item.NumeroPedido,
		&pedProvID, &item.TipoBeneficiario, &item.ReferenciaPago,
		&provID, &item.ProveedorNombre, &item.ProveedorRUC, &item.EsProveedorTemporal,
		&cliID, &item.ClienteNombre, &item.ClienteDocumento, &item.ClienteTelefono,
		&prodID, &item.ProductoNombre, &item.EsProductoTemporal,
		&item.Cantidad, &item.MontoTotal, &item.MontoPagado, &item.SaldoPendiente,
		&item.EstadoPago, &item.MetodoPago,
		&item.FechaPago,
		&item.SemanaISO, &item.AnioISO, &histJSON, &item.Notas,
		&item.EsRecurrente, &item.RecurrenciaFrecuencia, &item.RecurrenciaTipoDia,
		&item.RecurrenciaFechaInicio, &item.RecurrenciaFechaFin, &item.RecurrenciaGrupoID,
		&createdBy, &item.CreatedAt, &item.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		auth.WriteJSONError(w, http.StatusNotFound, "pago no encontrado")
		return
	} else if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "error al consultar pago: "+err.Error())
		return
	}

	item.HistorialParciales = make([]models.PagoParcialItem, 0)
	if strings.TrimSpace(histJSON) != "" {
		_ = json.Unmarshal([]byte(histJSON), &item.HistorialParciales)
	}
	if len(item.HistorialParciales) == 0 && item.EstadoPago == "Pago Parcial" && item.MontoPagado > 0 {
		item.HistorialParciales = []models.PagoParcialItem{
			{
				Monto:      item.MontoPagado,
				FechaPago:  item.FechaPago,
				SemanaISO:  item.SemanaISO,
				AnioISO:    item.AnioISO,
				MetodoPago: item.MetodoPago,
			},
		}
	}

	if pedID.Valid {
		v := int(pedID.Int64)
		item.PedidoID = &v
	}
	if pedProvID.Valid {
		v := int(pedProvID.Int64)
		item.PedidoProveedorID = &v
	}
	if provID.Valid {
		v := int(provID.Int64)
		item.ProveedorID = &v
	}
	if cliID.Valid {
		v := int(cliID.Int64)
		item.ClienteID = &v
	}
	if prodID.Valid {
		v := int(prodID.Int64)
		item.ProductoID = &v
	}
	if createdBy.Valid {
		item.CreatedBy = &createdBy.String
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(item)
}

type CreatePagoRequest struct {
	TipoBeneficiario       string                   `json:"tipoBeneficiario"`
	ReferenciaPago         string                   `json:"referenciaPago"`
	ProveedorID            *int                     `json:"proveedorId"`
	ProveedorNombre        string                   `json:"proveedorNombre"`
	ProveedorRUC           string                   `json:"proveedorRuc"`
	EsProveedorTemporal    bool                     `json:"esProveedorTemporal"`
	ClienteID              *int                     `json:"clienteId"`
	ClienteNombre          string                   `json:"clienteNombre"`
	ClienteDocumento       string                   `json:"clienteDocumento"`
	ClienteTelefono        string                   `json:"clienteTelefono"`
	ProductoID             *int                     `json:"productoId"`
	ProductoNombre         string                   `json:"productoNombre"`
	EsProductoTemporal     bool                     `json:"esProductoTemporal"`
	Cantidad               float64                  `json:"cantidad"`
	MontoTotal             float64                  `json:"montoTotal"`
	MontoPagado            float64                  `json:"montoPagado"`
	SaldoPendiente         float64                  `json:"saldoPendiente"`
	EstadoPago             string                   `json:"estadoPago"`
	MetodoPago             string                   `json:"metodoPago"`
	FechaPago              string                   `json:"fechaPago"`
	FechaPagoParcial       string                   `json:"fechaPagoParcial"`
	HistorialParciales     []models.PagoParcialItem `json:"historialParciales"`
	PedidoID               *int                     `json:"pedidoId"`
	Notas                  string                   `json:"notas"`
	EsRecurrente           bool                     `json:"esRecurrente"`
	RecurrenciaFrecuencia  string                   `json:"recurrenciaFrecuencia"`
	RecurrenciaTipoDia     string                   `json:"recurrenciaTipoDia"`
	RecurrenciaFechaInicio string                   `json:"recurrenciaFechaInicio"`
	RecurrenciaFechaFin    string                   `json:"recurrenciaFechaFin"`
	RecurrenciaGrupoID     string                   `json:"recurrenciaGrupoId"`
}

type RecurringPaymentDate struct {
	Fecha     time.Time
	SemanaISO int
	AnioISO   int
}

func generateRecurringDates(frecuencia, tipoDia string, fechaInicio, fechaFin time.Time) ([]RecurringPaymentDate, error) {
	if fechaFin.Before(fechaInicio) {
		return nil, fmt.Errorf("la fecha fin no puede ser anterior a la fecha de inicio")
	}

	var dates []RecurringPaymentDate

	switch strings.ToLower(strings.TrimSpace(frecuencia)) {
	case "diario":
		cur := fechaInicio
		for !cur.After(fechaFin) {
			anio, sem := cur.ISOWeek()
			dates = append(dates, RecurringPaymentDate{Fecha: cur, SemanaISO: sem, AnioISO: anio})
			cur = cur.AddDate(0, 0, 1)
			if len(dates) > 366 {
				return nil, fmt.Errorf("el rango supera el límite máximo de 366 días para pagos diarios")
			}
		}

	case "semanal":
		// Iniciar lunes automáticamente según requisito del usuario
		weekday := int(fechaInicio.Weekday())
		offset := weekday - 1
		if offset < 0 { // Domingo
			offset = 6
		}
		monday := fechaInicio.AddDate(0, 0, -offset)
		cur := monday
		for !cur.After(fechaFin) {
			if !cur.Before(monday) {
				anio, sem := cur.ISOWeek()
				dates = append(dates, RecurringPaymentDate{Fecha: cur, SemanaISO: sem, AnioISO: anio})
			}
			cur = cur.AddDate(0, 0, 7)
			if len(dates) > 156 {
				return nil, fmt.Errorf("el rango supera el límite máximo de 156 semanas")
			}
		}

	case "mensual":
		startYear, startMonth, _ := fechaInicio.Date()
		endYear, endMonth, _ := fechaFin.Date()
		totalMonths := (endYear-startYear)*12 + int(endMonth-startMonth)
		if totalMonths < 0 {
			totalMonths = 0
		}

		for i := 0; i <= totalMonths; i++ {
			baseMonth := time.Date(startYear, startMonth+time.Month(i), 1, 0, 0, 0, 0, time.Local)
			var targetDate time.Time

			if tipoDia == "cierre_mes" {
				targetDate = time.Date(baseMonth.Year(), baseMonth.Month()+1, 0, 0, 0, 0, 0, time.Local)
			} else {
				targetDate = time.Date(baseMonth.Year(), baseMonth.Month(), 1, 0, 0, 0, 0, time.Local)
			}

			if !targetDate.Before(fechaInicio) && !targetDate.After(fechaFin) {
				anio, sem := targetDate.ISOWeek()
				dates = append(dates, RecurringPaymentDate{Fecha: targetDate, SemanaISO: sem, AnioISO: anio})
			}

			if len(dates) > 60 {
				return nil, fmt.Errorf("el rango supera el límite máximo de 60 meses")
			}
		}

	case "trimestral":
		startYear, startMonth, _ := fechaInicio.Date()
		endYear, endMonth, _ := fechaFin.Date()
		totalMonths := (endYear-startYear)*12 + int(endMonth-startMonth)
		if totalMonths < 0 {
			totalMonths = 0
		}

		for i := 0; i <= totalMonths; i += 3 {
			baseMonth := time.Date(startYear, startMonth+time.Month(i), 1, 0, 0, 0, 0, time.Local)
			var targetDate time.Time

			if tipoDia == "cierre_mes" {
				targetDate = time.Date(baseMonth.Year(), baseMonth.Month()+1, 0, 0, 0, 0, 0, time.Local)
			} else {
				targetDate = time.Date(baseMonth.Year(), baseMonth.Month(), 1, 0, 0, 0, 0, time.Local)
			}

			if !targetDate.Before(fechaInicio) && !targetDate.After(fechaFin) {
				anio, sem := targetDate.ISOWeek()
				dates = append(dates, RecurringPaymentDate{Fecha: targetDate, SemanaISO: sem, AnioISO: anio})
			}

			if len(dates) > 40 {
				return nil, fmt.Errorf("el rango supera el límite máximo de 40 trimestres")
			}
		}

	default:
		return nil, fmt.Errorf("frecuencia no reconocida: %s", frecuencia)
	}

	if len(dates) == 0 {
		return nil, fmt.Errorf("no se generaron fechas de pago válidas en el rango seleccionado")
	}

	return dates, nil
}

func normalizeBeneficiarioTipo(raw string) string {
	switch strings.TrimSpace(raw) {
	case "Colaborador":
		return "Colaborador"
	case "Otros":
		return "Otros"
	case "Cliente":
		return "Cliente"
	default:
		return "Proveedor"
	}
}

func normalizeHistorialParciales(items []models.PagoParcialItem, fallbackDate time.Time, fallbackMetodo string) ([]models.PagoParcialItem, time.Time) {
	cleaned := make([]models.PagoParcialItem, 0, len(items))
	latestDate := fallbackDate
	for _, it := range items {
		if it.Monto <= 0 {
			continue
		}
		d := fallbackDate
		if strings.TrimSpace(it.FechaPago) != "" {
			if parsed, err := time.Parse("2006-01-02", strings.TrimSpace(it.FechaPago)); err == nil {
				d = parsed
			}
		}
		anio, sem := d.ISOWeek()
		met := strings.TrimSpace(it.MetodoPago)
		if met == "" {
			met = fallbackMetodo
		}
		cleaned = append(cleaned, models.PagoParcialItem{
			Monto:      it.Monto,
			FechaPago:  d.Format("2006-01-02"),
			SemanaISO:  sem,
			AnioISO:    anio,
			MetodoPago: met,
			Notas:      strings.TrimSpace(it.Notas),
		})
		latestDate = d
	}
	return cleaned, latestDate
}

// Create crea un nuevo pago manual
func (h *PagosHandler) Create(w http.ResponseWriter, r *http.Request) {
	if h.DB == nil {
		auth.WriteJSONError(w, http.StatusServiceUnavailable, "base de datos no disponible")
		return
	}

	var req CreatePagoRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		auth.WriteJSONError(w, http.StatusBadRequest, "cuerpo de solicitud inválido")
		return
	}

	tipoBen := normalizeBeneficiarioTipo(req.TipoBeneficiario)
	refPago := strings.TrimSpace(req.ReferenciaPago)
	provNom := strings.TrimSpace(req.ProveedorNombre)
	cliNom := strings.TrimSpace(req.ClienteNombre)

	switch tipoBen {
	case "Proveedor":
		if provNom == "" {
			auth.WriteJSONError(w, http.StatusBadRequest, "el nombre del proveedor es obligatorio")
			return
		}
	case "Colaborador":
		if provNom == "" && cliNom != "" {
			provNom = cliNom
		}
		if provNom == "" {
			auth.WriteJSONError(w, http.StatusBadRequest, "el nombre del colaborador es obligatorio")
			return
		}
	case "Otros":
		if refPago == "" && provNom != "" {
			refPago = provNom
		}
		if refPago == "" {
			auth.WriteJSONError(w, http.StatusBadRequest, "debe indicar a qué hace referencia el pago (Otros)")
			return
		}
		if provNom == "" {
			provNom = refPago
		}
	case "Cliente":
		if cliNom == "" && provNom != "" {
			cliNom = provNom
		}
		if cliNom == "" {
			auth.WriteJSONError(w, http.StatusBadRequest, "el nombre del cliente es obligatorio")
			return
		}
		if provNom == "" {
			provNom = cliNom
		}
	}

	prodNom := strings.TrimSpace(req.ProductoNombre)
	if prodNom == "" && refPago != "" {
		prodNom = refPago
	}
	if prodNom == "" {
		auth.WriteJSONError(w, http.StatusBadRequest, "el nombre del producto o concepto es obligatorio")
		return
	}

	cant := req.Cantidad
	if cant <= 0 {
		cant = 1
	}

	total := req.MontoTotal
	if total < 0 {
		total = 0
	}

	estado := strings.TrimSpace(req.EstadoPago)
	if estado != "Pagado" && estado != "Pago Parcial" {
		estado = "Pendiente"
	}

	metodo := strings.TrimSpace(req.MetodoPago)
	if metodo == "" {
		metodo = "Efectivo"
	}

	fechaPago := time.Now()
	rawFecha := strings.TrimSpace(req.FechaPago)
	if estado == "Pago Parcial" && strings.TrimSpace(req.FechaPagoParcial) != "" {
		rawFecha = strings.TrimSpace(req.FechaPagoParcial)
	}
	if rawFecha != "" {
		if t, err := time.Parse("2006-01-02", rawFecha); err == nil {
			fechaPago = t
		}
	}

	var montoPagado, saldoPendiente float64
	var histItems []models.PagoParcialItem

	switch estado {
	case "Pagado":
		montoPagado = total
		saldoPendiente = 0
		if len(req.HistorialParciales) > 0 {
			histItems, _ = normalizeHistorialParciales(req.HistorialParciales, fechaPago, metodo)
		}
	case "Pendiente":
		montoPagado = 0
		saldoPendiente = total
	case "Pago Parcial":
		if len(req.HistorialParciales) > 0 {
			histItems, fechaPago = normalizeHistorialParciales(req.HistorialParciales, fechaPago, metodo)
		}
		montoPagado = req.MontoPagado
		if montoPagado <= 0 && len(histItems) > 0 {
			for _, it := range histItems {
				montoPagado += it.Monto
			}
		}
		if montoPagado < 0 {
			montoPagado = 0
		}
		if montoPagado > total {
			montoPagado = total
		}
		saldoPendiente = total - montoPagado

		if len(histItems) == 0 && montoPagado > 0 {
			aISO, sISO := fechaPago.ISOWeek()
			histItems = []models.PagoParcialItem{
				{
					Monto:      montoPagado,
					FechaPago:  fechaPago.Format("2006-01-02"),
					SemanaISO:  sISO,
					AnioISO:    aISO,
					MetodoPago: metodo,
					Notas:      strings.TrimSpace(req.Notas),
				},
			}
		}
	}

	anioISO, semanaISO := fechaPago.ISOWeek()
	fechaPagoStr := fechaPago.Format("2006-01-02")

	histBytes, _ := json.Marshal(histItems)
	histJSON := string(histBytes)

	actor := h.getActorName(r)

	if req.EsRecurrente {
		frec := strings.Title(strings.ToLower(strings.TrimSpace(req.RecurrenciaFrecuencia)))
		if frec == "" {
			frec = "Mensual"
		}
		tipoDia := strings.ToLower(strings.TrimSpace(req.RecurrenciaTipoDia))
		if tipoDia != "cierre_mes" {
			tipoDia = "inicio_mes"
		}

		fInicio, err := time.Parse("2006-01-02", strings.TrimSpace(req.RecurrenciaFechaInicio))
		if err != nil {
			fInicio = fechaPago
		}
		fFin, err := time.Parse("2006-01-02", strings.TrimSpace(req.RecurrenciaFechaFin))
		if err != nil {
			fFin = fInicio.AddDate(0, 3, 0)
		}

		recDates, err := generateRecurringDates(frec, tipoDia, fInicio, fFin)
		if err != nil {
			auth.WriteJSONError(w, http.StatusBadRequest, err.Error())
			return
		}

		grupoID := fmt.Sprintf("REC-%s-%04d", time.Now().Format("20060102150405"), time.Now().Nanosecond()%10000)

		var lastID int
		_ = h.DB.QueryRowContext(r.Context(), "SELECT COALESCE(MAX(id), 0) FROM pagos").Scan(&lastID)

		tx, err := h.DB.BeginTx(r.Context(), nil)
		if err != nil {
			auth.WriteJSONError(w, http.StatusInternalServerError, "error al iniciar transacción de pagos recurrentes: "+err.Error())
			return
		}
		defer tx.Rollback()

		stmt, err := tx.PrepareContext(r.Context(), `
			INSERT INTO pagos (
				numero_pago, pedido_id, tipo_beneficiario, referencia_pago,
				proveedor_id, proveedor_nombre, proveedor_ruc, es_proveedor_temporal,
				cliente_id, cliente_nombre, cliente_documento, cliente_telefono,
				producto_id, producto_nombre, es_producto_temporal,
				cantidad, monto_total, monto_pagado, saldo_pendiente,
				estado_pago, metodo_pago, fecha_pago, semana_iso, anio_iso,
				historial_parciales, notas, es_recurrente, recurrencia_frecuencia,
				recurrencia_tipo_dia, recurrencia_fecha_inicio, recurrencia_fecha_fin,
				recurrencia_grupo_id, created_by
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`)
		if err != nil {
			auth.WriteJSONError(w, http.StatusInternalServerError, "error al preparar inserción recurrente: "+err.Error())
			return
		}
		defer stmt.Close()

		totalCuotas := len(recDates)
		var firstID int64
		for idx, item := range recDates {
			lastID++
			numPago := fmt.Sprintf("PAG-%06d", lastID)
			fItemStr := item.Fecha.Format("2006-01-02")

			notaCuota := fmt.Sprintf("Pago Recurrente %s (%d/%d)", frec, idx+1, totalCuotas)
			if strings.TrimSpace(req.Notas) != "" {
				notaCuota = fmt.Sprintf("%s · %s", notaCuota, strings.TrimSpace(req.Notas))
			}

			estadoItem := estado
			montoPagadoItem := montoPagado
			saldoPendienteItem := saldoPendiente

			if estado == "Pagado" {
				montoPagadoItem = total
				saldoPendienteItem = 0
			} else if estado == "Pendiente" {
				montoPagadoItem = 0
				saldoPendienteItem = total
			} else if estado == "Pago Parcial" {
				if idx > 0 {
					estadoItem = "Pendiente"
					montoPagadoItem = 0
					saldoPendienteItem = total
				}
			}

			histItemJSON := "[]"
			if estadoItem == "Pago Parcial" && montoPagadoItem > 0 {
				hp := []models.PagoParcialItem{
					{
						Monto:      montoPagadoItem,
						FechaPago:  fItemStr,
						SemanaISO:  item.SemanaISO,
						AnioISO:    item.AnioISO,
						MetodoPago: metodo,
						Notas:      notaCuota,
					},
				}
				b, _ := json.Marshal(hp)
				histItemJSON = string(b)
			}

			resRec, err := stmt.ExecContext(r.Context(),
				numPago, req.PedidoID, tipoBen, refPago,
				req.ProveedorID, provNom, strings.TrimSpace(req.ProveedorRUC), req.EsProveedorTemporal,
				req.ClienteID, cliNom, strings.TrimSpace(req.ClienteDocumento), strings.TrimSpace(req.ClienteTelefono),
				req.ProductoID, prodNom, req.EsProductoTemporal,
				cant, total, montoPagadoItem, saldoPendienteItem,
				estadoItem, metodo, fItemStr, item.SemanaISO, item.AnioISO,
				histItemJSON, notaCuota, 1, frec, tipoDia,
				fInicio.Format("2006-01-02"), fFin.Format("2006-01-02"), grupoID, actor,
			)
			if err != nil {
				auth.WriteJSONError(w, http.StatusInternalServerError, "error al registrar cuota recurrente: "+err.Error())
				return
			}
			if idx == 0 {
				firstID, _ = resRec.LastInsertId()
			}
		}

		if err := tx.Commit(); err != nil {
			auth.WriteJSONError(w, http.StatusInternalServerError, "error al confirmar serie recurrente: "+err.Error())
			return
		}

		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"message":        fmt.Sprintf("Se generaron exitosamente %d pagos recurrentes (%s)", totalCuotas, frec),
			"id":             firstID,
			"totalGenerados": totalCuotas,
			"grupoId":        grupoID,
			"frecuencia":     frec,
		})
		return
	}

	// Generar número de pago secuencial (ej. PAG-000001)
	var lastID int
	_ = h.DB.QueryRowContext(r.Context(), "SELECT COALESCE(MAX(id), 0) FROM pagos").Scan(&lastID)
	numeroPago := fmt.Sprintf("PAG-%06d", lastID+1)

	insertSQL := `
		INSERT INTO pagos (
			numero_pago, pedido_id, tipo_beneficiario, referencia_pago,
			proveedor_id, proveedor_nombre, proveedor_ruc, es_proveedor_temporal,
			cliente_id, cliente_nombre, cliente_documento, cliente_telefono,
			producto_id, producto_nombre, es_producto_temporal,
			cantidad, monto_total, monto_pagado, saldo_pendiente,
			estado_pago, metodo_pago, fecha_pago, semana_iso, anio_iso,
			historial_parciales, notas, es_recurrente, recurrencia_frecuencia,
			recurrencia_tipo_dia, recurrencia_fecha_inicio, recurrencia_fecha_fin,
			recurrencia_grupo_id, created_by
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`

	res, err := h.DB.ExecContext(r.Context(), insertSQL,
		numeroPago, req.PedidoID, tipoBen, refPago,
		req.ProveedorID, provNom, strings.TrimSpace(req.ProveedorRUC), req.EsProveedorTemporal,
		req.ClienteID, cliNom, strings.TrimSpace(req.ClienteDocumento), strings.TrimSpace(req.ClienteTelefono),
		req.ProductoID, prodNom, req.EsProductoTemporal,
		cant, total, montoPagado, saldoPendiente,
		estado, metodo, fechaPagoStr, semanaISO, anioISO,
		histJSON, strings.TrimSpace(req.Notas),
		0, nil, nil, nil, nil, nil, actor,
	)
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "error al registrar pago: "+err.Error())
		return
	}

	newID, _ := res.LastInsertId()

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"message":    "Pago registrado exitosamente",
		"id":         newID,
		"numeroPago": numeroPago,
		"fechaPago":  fechaPagoStr,
		"semanaIso":  semanaISO,
		"anioIso":    anioISO,
	})
}

// Update actualiza un pago existente
func (h *PagosHandler) Update(w http.ResponseWriter, r *http.Request, id int) {
	if h.DB == nil {
		auth.WriteJSONError(w, http.StatusServiceUnavailable, "base de datos no disponible")
		return
	}

	var req CreatePagoRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		auth.WriteJSONError(w, http.StatusBadRequest, "cuerpo de solicitud inválido")
		return
	}

	var pedProvID sql.NullInt64
	var oldHistJSON string
	var oldMontoPagado float64
	err := h.DB.QueryRowContext(r.Context(),
		"SELECT pedido_proveedor_id, COALESCE(historial_parciales, '[]'), monto_pagado FROM pagos WHERE id = ? AND deleted_at IS NULL",
		id,
	).Scan(&pedProvID, &oldHistJSON, &oldMontoPagado)
	if err == sql.ErrNoRows {
		auth.WriteJSONError(w, http.StatusNotFound, "pago no encontrado")
		return
	} else if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "error al verificar pago: "+err.Error())
		return
	}

	tipoBen := normalizeBeneficiarioTipo(req.TipoBeneficiario)
	refPago := strings.TrimSpace(req.ReferenciaPago)
	provNom := strings.TrimSpace(req.ProveedorNombre)
	cliNom := strings.TrimSpace(req.ClienteNombre)

	switch tipoBen {
	case "Proveedor":
		if provNom == "" {
			auth.WriteJSONError(w, http.StatusBadRequest, "el nombre del proveedor es obligatorio")
			return
		}
	case "Colaborador":
		if provNom == "" && cliNom != "" {
			provNom = cliNom
		}
		if provNom == "" {
			auth.WriteJSONError(w, http.StatusBadRequest, "el nombre del colaborador es obligatorio")
			return
		}
	case "Otros":
		if refPago == "" && provNom != "" {
			refPago = provNom
		}
		if refPago == "" {
			auth.WriteJSONError(w, http.StatusBadRequest, "debe indicar a qué hace referencia el pago (Otros)")
			return
		}
		if provNom == "" {
			provNom = refPago
		}
	case "Cliente":
		if cliNom == "" && provNom != "" {
			cliNom = provNom
		}
		if cliNom == "" {
			auth.WriteJSONError(w, http.StatusBadRequest, "el nombre del cliente es obligatorio")
			return
		}
		if provNom == "" {
			provNom = cliNom
		}
	}

	prodNom := strings.TrimSpace(req.ProductoNombre)
	if prodNom == "" && refPago != "" {
		prodNom = refPago
	}
	if prodNom == "" {
		auth.WriteJSONError(w, http.StatusBadRequest, "el nombre del producto o concepto es obligatorio")
		return
	}

	cant := req.Cantidad
	if cant <= 0 {
		cant = 1
	}

	total := req.MontoTotal
	if total < 0 {
		total = 0
	}

	estado := strings.TrimSpace(req.EstadoPago)
	if estado != "Pagado" && estado != "Pago Parcial" {
		estado = "Pendiente"
	}

	metodo := strings.TrimSpace(req.MetodoPago)
	if metodo == "" {
		metodo = "Efectivo"
	}

	fechaPago := time.Now()
	rawFecha := strings.TrimSpace(req.FechaPago)
	if estado == "Pago Parcial" && strings.TrimSpace(req.FechaPagoParcial) != "" {
		rawFecha = strings.TrimSpace(req.FechaPagoParcial)
	}
	if rawFecha != "" {
		if t, err := time.Parse("2006-01-02", rawFecha); err == nil {
			fechaPago = t
		}
	}

	var existingHist []models.PagoParcialItem
	if strings.TrimSpace(oldHistJSON) != "" {
		_ = json.Unmarshal([]byte(oldHistJSON), &existingHist)
	}

	var montoPagado, saldoPendiente float64
	var histItems []models.PagoParcialItem

	switch estado {
	case "Pagado":
		montoPagado = total
		saldoPendiente = 0
		if len(req.HistorialParciales) > 0 {
			histItems, _ = normalizeHistorialParciales(req.HistorialParciales, fechaPago, metodo)
		} else {
			histItems = existingHist
		}
	case "Pendiente":
		montoPagado = 0
		saldoPendiente = total
		histItems = make([]models.PagoParcialItem, 0)
	case "Pago Parcial":
		if len(req.HistorialParciales) > 0 {
			// Tomar la fecha y semana del último pago parcial agregado
			histItems, fechaPago = normalizeHistorialParciales(req.HistorialParciales, fechaPago, metodo)
		} else {
			histItems = existingHist
		}
		montoPagado = req.MontoPagado
		if montoPagado < 0 {
			montoPagado = 0
		}
		if montoPagado > total {
			montoPagado = total
		}
		saldoPendiente = total - montoPagado

		if len(req.HistorialParciales) == 0 && montoPagado > 0 {
			aISO, sISO := fechaPago.ISOWeek()
			delta := montoPagado - oldMontoPagado
			if delta > 0 && len(histItems) > 0 {
				histItems = append(histItems, models.PagoParcialItem{
					Monto:      delta,
					FechaPago:  fechaPago.Format("2006-01-02"),
					SemanaISO:  sISO,
					AnioISO:    aISO,
					MetodoPago: metodo,
					Notas:      strings.TrimSpace(req.Notas),
				})
			} else if len(histItems) == 0 {
				histItems = []models.PagoParcialItem{
					{
						Monto:      montoPagado,
						FechaPago:  fechaPago.Format("2006-01-02"),
						SemanaISO:  sISO,
						AnioISO:    aISO,
						MetodoPago: metodo,
						Notas:      strings.TrimSpace(req.Notas),
					},
				}
			}
		}
	}

	anioISO, semanaISO := fechaPago.ISOWeek()
	fechaPagoStr := fechaPago.Format("2006-01-02")

	histBytes, _ := json.Marshal(histItems)
	histJSON := string(histBytes)

	updateSQL := `
		UPDATE pagos SET
			tipo_beneficiario = ?, referencia_pago = ?,
			proveedor_id = ?, proveedor_nombre = ?, proveedor_ruc = ?, es_proveedor_temporal = ?,
			cliente_id = ?, cliente_nombre = ?, cliente_documento = ?, cliente_telefono = ?,
			producto_id = ?, producto_nombre = ?, es_producto_temporal = ?,
			cantidad = ?, monto_total = ?, monto_pagado = ?, saldo_pendiente = ?,
			estado_pago = ?, metodo_pago = ?, fecha_pago = ?, semana_iso = ?, anio_iso = ?,
			historial_parciales = ?, notas = ?
		WHERE id = ? AND deleted_at IS NULL
	`

	_, err = h.DB.ExecContext(r.Context(), updateSQL,
		tipoBen, refPago,
		req.ProveedorID, provNom, strings.TrimSpace(req.ProveedorRUC), req.EsProveedorTemporal,
		req.ClienteID, cliNom, strings.TrimSpace(req.ClienteDocumento), strings.TrimSpace(req.ClienteTelefono),
		req.ProductoID, prodNom, req.EsProductoTemporal,
		cant, total, montoPagado, saldoPendiente,
		estado, metodo, fechaPagoStr, semanaISO, anioISO,
		histJSON, strings.TrimSpace(req.Notas), id,
	)
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "error al actualizar pago: "+err.Error())
		return
	}

	if pedProvID.Valid && pedProvID.Int64 > 0 {
		_, _ = h.DB.ExecContext(r.Context(),
			"UPDATE pedido_proveedores SET estado_pago = ?, monto_pagado = ?, saldo_pendiente = ? WHERE id = ?",
			estado, montoPagado, saldoPendiente, pedProvID.Int64,
		)
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"message":   "Pago actualizado exitosamente",
		"id":        id,
		"fechaPago": fechaPagoStr,
		"semanaIso": semanaISO,
		"anioIso":   anioISO,
	})
}

// Delete realiza el borrado suave (simulado) del pago
func (h *PagosHandler) Delete(w http.ResponseWriter, r *http.Request, id int) {
	if h.DB == nil {
		auth.WriteJSONError(w, http.StatusServiceUnavailable, "base de datos no disponible")
		return
	}

	actor := h.getActorName(r)
	query := `
		UPDATE pagos
		SET deleted_at = NOW(), deleted_by = ?
		WHERE id = ? AND deleted_at IS NULL
	`
	res, err := h.DB.ExecContext(r.Context(), query, actor, id)
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "error al anular pago: "+err.Error())
		return
	}

	rowsAff, _ := res.RowsAffected()
	if rowsAff == 0 {
		auth.WriteJSONError(w, http.StatusNotFound, "pago no encontrado")
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"message": "Pago anulado correctamente",
	})
}

