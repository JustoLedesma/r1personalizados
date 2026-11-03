package handlers

import (
	"context"
	"database/sql"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"r1/backend/internal/auth"
)

type DashboardHandler struct {
	DB *sql.DB
}

func NewDashboardHandler(dbConn *sql.DB) *DashboardHandler {
	return &DashboardHandler{DB: dbConn}
}

func checkDashboardPermissions(r *http.Request) (canPedidos, canPagos, canMensajes, canGeneral bool) {
	claims := auth.CurrentUserClaims(r)
	if claims == nil {
		return false, false, false, false
	}
	if claims.IsRoot || claims.Role == "admin" {
		return true, true, true, true
	}
	perms := claims.Permissions
	if perms != nil {
		canPedidos = perms["pedidos"] != ""
		canPagos = perms["pagos"] != ""
		canMensajes = perms["difusion-mensajes"] != "" || perms["mensajes"] != ""
	}
	canGeneral = canPedidos || canPagos
	return canPedidos, canPagos, canMensajes, canGeneral
}

// Stats maneja GET /api/dashboard/stats
func (h *DashboardHandler) Stats(w http.ResponseWriter, r *http.Request) {
	if h.DB == nil {
		auth.WriteJSONError(w, http.StatusServiceUnavailable, "base de datos no disponible")
		return
	}

	canPedidos, canPagos, canMensajes, canGeneral := checkDashboardPermissions(r)
	if !canPedidos && !canPagos && !canMensajes && !canGeneral {
		auth.WriteJSONError(w, http.StatusForbidden, "acceso denegado al dashboard para este rol")
		return
	}

	desdeStr, hastaStr, estadoFilter := parseFilterParams(r)

	dInicio, err1 := time.Parse("2006-01-02", desdeStr)
	dFin, err2 := time.Parse("2006-01-02", hastaStr)
	isTodo := desdeStr <= "2020-01-01" || hastaStr >= "2099-01-01" || err1 != nil || err2 != nil
	var prevDesdeStr, prevHastaStr string
	if !isTodo {
		durDays := int(dFin.Sub(dInicio).Hours()/24) + 1
		prevFin := dInicio.AddDate(0, 0, -1)
		prevInicio := prevFin.AddDate(0, 0, -(durDays - 1))
		prevDesdeStr = prevInicio.Format("2006-01-02")
		prevHastaStr = prevFin.Format("2006-01-02")
	}

	ctx := r.Context()

	var pedidosStats *PedidosStatsResult
	if canPedidos {
		p := h.getPedidosStats(ctx, desdeStr, hastaStr, estadoFilter)
		pedidosStats = &p
	}

	var pagosStats *PagosStatsResult
	if canPagos {
		p := h.getPagosStats(ctx, desdeStr, hastaStr, estadoFilter)
		pagosStats = &p
	}

	var mensajesStats *MensajesStatsResult
	if canMensajes {
		m := h.getMensajesStats(ctx, desdeStr, hastaStr)
		mensajesStats = &m
	}

	var generalStats map[string]float64
	if canGeneral {
		ing := 0.0
		pendCobro := 0.0
		if pedidosStats != nil {
			ing = pedidosStats.MontoPagado
			pendCobro = pedidosStats.SaldoPendiente
		}
		egr := 0.0
		pendPago := 0.0
		pagCliPag := 0.0
		pagCliPend := 0.0
		if pagosStats != nil {
			egr = pagosStats.TotalPagadosMonto
			pendPago = pagosStats.TotalPendientesMonto
			pagCliPag = pagosStats.PagosClientesMontoPagado
			pagCliPend = pagosStats.PagosClientesSaldoPendiente
		}
		generalStats = map[string]float64{
			"ingresos":               ing,
			"egresos":                egr,
			"pendientesCobro":        pendCobro,
			"pendientesPago":         pendPago,
			"balance":                ing - egr,
			"pagosClientesPagado":    pagCliPag,
			"pagosClientesPendiente": pagCliPend,
		}
	}

	variaciones := map[string]any{
		"pedidosMontoDelta": 0.0,
		"ingresosDelta":     0.0,
		"egresosDelta":      0.0,
		"balanceDelta":      0.0,
	}
	if !isTodo && prevDesdeStr != "" && canGeneral {
		var prevIng, prevEgr float64
		if canPedidos {
			prevP := h.getPedidosStats(ctx, prevDesdeStr, prevHastaStr, estadoFilter)
			prevIng = prevP.MontoPagado
			if pedidosStats != nil {
				variaciones["pedidosMontoDelta"] = calcDelta(pedidosStats.MontoTotal, prevP.MontoTotal)
			}
		}
		if canPagos {
			prevPag := h.getPagosStats(ctx, prevDesdeStr, prevHastaStr, estadoFilter)
			prevEgr = prevPag.TotalPagadosMonto
		}
		if generalStats != nil {
			variaciones["ingresosDelta"] = calcDelta(generalStats["ingresos"], prevIng)
			variaciones["egresosDelta"] = calcDelta(generalStats["egresos"], prevEgr)
			variaciones["balanceDelta"] = calcDelta(generalStats["balance"], prevIng-prevEgr)
		}
	}

	var clientesPendientes []ClienteDeudaItem
	if canPedidos {
		clientesPendientes = h.getClientesPendientes(ctx, desdeStr, hastaStr)
	}

	graficos := h.getGraficosData(ctx, desdeStr, hastaStr, pedidosStats, pagosStats, mensajesStats, canPedidos, canPagos, canMensajes)

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"periodo": map[string]string{
			"desde": desdeStr,
			"hasta": hastaStr,
		},
		"pedidos":            pedidosStats,
		"pagos":              pagosStats,
		"mensajes":           mensajesStats,
		"general":            generalStats,
		"variaciones":        variaciones,
		"graficos":           graficos,
		"clientesPendientes": clientesPendientes,
		"permisos": map[string]bool{
			"pedidos":  canPedidos,
			"pagos":    canPagos,
			"mensajes": canMensajes,
			"general":  canGeneral,
		},
	})
}

type PedidosStatsResult struct {
	TotalCount      int            `json:"totalCount"`
	MontoTotal      float64        `json:"montoTotal"`
	MontoPagado     float64        `json:"montoPagado"`
	SaldoPendiente  float64        `json:"saldoPendiente"`
	PagadosCount    int            `json:"pagadosCount"`
	PendientesCount int            `json:"pendientesCount"`
	PorEstado       map[string]int `json:"porEstado"`
}

func (h *DashboardHandler) getPedidosStats(ctx context.Context, desde, hasta, estado string) PedidosStatsResult {
	var res PedidosStatsResult
	res.PorEstado = make(map[string]int)

	where := []string{
		"deleted_at IS NULL",
		"estado != 'Cancelado'",
		"COALESCE(fecha_pedido, DATE(created_at)) BETWEEN ? AND ?",
	}
	args := []any{desde, hasta}

	if estado == "pendientes" {
		where = append(where, "saldo_pendiente > 0")
	} else if estado == "pagados" {
		where = append(where, "saldo_pendiente = 0")
	}

	whereSQL := strings.Join(where, " AND ")

	query := fmt.Sprintf(`
		SELECT
			COUNT(*),
			COALESCE(SUM(monto_total), 0),
			COALESCE(SUM(monto_pagado), 0),
			COALESCE(SUM(saldo_pendiente), 0),
			COALESCE(SUM(CASE WHEN saldo_pendiente = 0 OR monto_pagado >= monto_total THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN saldo_pendiente > 0 THEN 1 ELSE 0 END), 0)
		FROM pedidos
		WHERE %s
	`, whereSQL)

	_ = h.DB.QueryRowContext(ctx, query, args...).Scan(
		&res.TotalCount,
		&res.MontoTotal,
		&res.MontoPagado,
		&res.SaldoPendiente,
		&res.PagadosCount,
		&res.PendientesCount,
	)

	qEstados := `
		SELECT estado, COUNT(*)
		FROM pedidos
		WHERE deleted_at IS NULL AND estado != 'Cancelado' AND COALESCE(fecha_pedido, DATE(created_at)) BETWEEN ? AND ?
		GROUP BY estado
	`
	if rows, err := h.DB.QueryContext(ctx, qEstados, desde, hasta); err == nil {
		defer rows.Close()
		for rows.Next() {
			var est string
			var cnt int
			if err := rows.Scan(&est, &cnt); err == nil {
				res.PorEstado[est] = cnt
			}
		}
	}

	return res
}

type ClienteDeudaItem struct {
	ClienteNombre  string  `json:"clienteNombre"`
	ClienteDoc     string  `json:"clienteDoc"`
	ClienteTel     string  `json:"clienteTel"`
	PedidosCount   int     `json:"pedidosCount"`
	MontoTotal     float64 `json:"montoTotal"`
	MontoPagado    float64 `json:"montoPagado"`
	SaldoPendiente float64 `json:"saldoPendiente"`
	AntiguedadMax  int     `json:"antiguedadMax"`
}

func (h *DashboardHandler) getClientesPendientes(ctx context.Context, desde, hasta string) []ClienteDeudaItem {
	where := []string{
		"deleted_at IS NULL",
		"estado != 'Cancelado'",
		"saldo_pendiente > 0",
		"COALESCE(fecha_pedido, DATE(created_at)) BETWEEN ? AND ?",
	}
	args := []any{desde, hasta}
	whereSQL := strings.Join(where, " AND ")

	query := fmt.Sprintf(`
		SELECT
			cliente_nombre,
			COALESCE(cliente_documento, ''),
			COALESCE(cliente_telefono, ''),
			COUNT(*),
			COALESCE(SUM(monto_total), 0),
			COALESCE(SUM(monto_pagado), 0),
			COALESCE(SUM(saldo_pendiente), 0),
			COALESCE(MAX(DATEDIFF(CURDATE(), COALESCE(fecha_pedido, DATE(created_at)))), 0)
		FROM pedidos
		WHERE %s
		GROUP BY cliente_nombre, cliente_documento, cliente_telefono
		ORDER BY SUM(saldo_pendiente) DESC
		LIMIT 20
	`, whereSQL)

	rows, err := h.DB.QueryContext(ctx, query, args...)
	if err != nil {
		return []ClienteDeudaItem{}
	}
	defer rows.Close()

	var list []ClienteDeudaItem
	for rows.Next() {
		var item ClienteDeudaItem
		if err := rows.Scan(
			&item.ClienteNombre,
			&item.ClienteDoc,
			&item.ClienteTel,
			&item.PedidosCount,
			&item.MontoTotal,
			&item.MontoPagado,
			&item.SaldoPendiente,
			&item.AntiguedadMax,
		); err == nil {
			list = append(list, item)
		}
	}
	return list
}

type PagosStatsResult struct {
	TotalCount                  int            `json:"totalCount"`
	TotalPagadosMonto           float64        `json:"totalPagadosMonto"`    // Egresos (solo Proveedor)
	TotalPendientesMonto        float64        `json:"totalPendientesMonto"` // Egresos pendientes (solo Proveedor)
	TotalGeneralMonto           float64        `json:"totalGeneralMonto"`    // Egresos total (solo Proveedor)
	PagadosCount                int            `json:"pagadosCount"`
	PendientesCount             int            `json:"pendientesCount"`
	ParcialesCount              int            `json:"parcialesCount"`
	PorEstado                   map[string]int `json:"porEstado"`
	PagosClientesCount          int            `json:"pagosClientesCount"`
	PagosClientesMontoTotal     float64        `json:"pagosClientesMontoTotal"`
	PagosClientesMontoPagado    float64        `json:"pagosClientesMontoPagado"`
	PagosClientesSaldoPendiente float64        `json:"pagosClientesSaldoPendiente"`
}

func (h *DashboardHandler) getPagosStats(ctx context.Context, desde, hasta, estado string) PagosStatsResult {
	var res PagosStatsResult
	res.PorEstado = make(map[string]int)

	where := []string{"deleted_at IS NULL", "fecha_pago BETWEEN ? AND ?"}
	args := []any{desde, hasta}

	if estado == "pendientes" {
		where = append(where, "(estado_pago = 'Pendiente' OR estado_pago = 'Pago Parcial' OR saldo_pendiente > 0)")
	} else if estado == "pagados" {
		where = append(where, "estado_pago = 'Pagado'")
	}

	whereSQL := strings.Join(where, " AND ")

	query := fmt.Sprintf(`
		SELECT
			COALESCE(SUM(CASE WHEN tipo_beneficiario = 'Proveedor' THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN tipo_beneficiario = 'Proveedor' THEN monto_pagado ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN tipo_beneficiario = 'Proveedor' THEN saldo_pendiente ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN tipo_beneficiario = 'Proveedor' THEN monto_total ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN tipo_beneficiario = 'Proveedor' AND estado_pago = 'Pagado' THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN tipo_beneficiario = 'Proveedor' AND estado_pago = 'Pendiente' THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN tipo_beneficiario = 'Proveedor' AND estado_pago = 'Pago Parcial' THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN tipo_beneficiario = 'Cliente' THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN tipo_beneficiario = 'Cliente' THEN monto_total ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN tipo_beneficiario = 'Cliente' THEN monto_pagado ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN tipo_beneficiario = 'Cliente' THEN saldo_pendiente ELSE 0 END), 0)
		FROM pagos
		WHERE %s
	`, whereSQL)

	_ = h.DB.QueryRowContext(ctx, query, args...).Scan(
		&res.TotalCount,
		&res.TotalPagadosMonto,
		&res.TotalPendientesMonto,
		&res.TotalGeneralMonto,
		&res.PagadosCount,
		&res.PendientesCount,
		&res.ParcialesCount,
		&res.PagosClientesCount,
		&res.PagosClientesMontoTotal,
		&res.PagosClientesMontoPagado,
		&res.PagosClientesSaldoPendiente,
	)

	qEst := `
		SELECT estado_pago, COUNT(*)
		FROM pagos
		WHERE deleted_at IS NULL AND tipo_beneficiario = 'Proveedor' AND fecha_pago BETWEEN ? AND ?
		GROUP BY estado_pago
	`
	if rows, err := h.DB.QueryContext(ctx, qEst, desde, hasta); err == nil {
		defer rows.Close()
		for rows.Next() {
			var est string
			var cnt int
			if err := rows.Scan(&est, &cnt); err == nil {
				res.PorEstado[est] = cnt
			}
		}
	}

	return res
}

type MensajesStatsResult struct {
	TotalCount       int            `json:"totalCount"`
	EnviadosCount    int            `json:"enviadosCount"`
	ProgramadosCount int            `json:"programadosCount"`
	EnColaCount      int            `json:"enColaCount"`
	FallidosCount    int            `json:"fallidosCount"`
	PorTipo          map[string]int `json:"porTipo"`
}

func (h *DashboardHandler) getMensajesStats(ctx context.Context, desde, hasta string) MensajesStatsResult {
	var res MensajesStatsResult
	res.PorTipo = make(map[string]int)

	query := `
		SELECT
			COUNT(*),
			COALESCE(SUM(CASE WHEN estado = 'Enviado' THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN estado = 'Programado' THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN estado = 'En Cola' THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN estado = 'Fallido' THEN 1 ELSE 0 END), 0)
		FROM mensajes_historial
		WHERE DATE(created_at) BETWEEN ? AND ?
	`
	_ = h.DB.QueryRowContext(ctx, query, desde, hasta).Scan(
		&res.TotalCount,
		&res.EnviadosCount,
		&res.ProgramadosCount,
		&res.EnColaCount,
		&res.FallidosCount,
	)

	qTipos := `
		SELECT COALESCE(tipo, 'Mensaje'), COUNT(*)
		FROM mensajes_historial
		WHERE DATE(created_at) BETWEEN ? AND ?
		GROUP BY tipo
	`
	if rows, err := h.DB.QueryContext(ctx, qTipos, desde, hasta); err == nil {
		defer rows.Close()
		for rows.Next() {
			var tip string
			var cnt int
			if err := rows.Scan(&tip, &cnt); err == nil {
				res.PorTipo[tip] = cnt
			}
		}
	}

	return res
}

func (h *DashboardHandler) getGraficosData(
	ctx context.Context,
	desde, hasta string,
	ped *PedidosStatsResult,
	pag *PagosStatsResult,
	msg *MensajesStatsResult,
	canPedidos, canPagos, canMensajes bool,
) map[string]any {
	type DayPoint struct {
		Fecha    string  `json:"fecha"`
		Label    string  `json:"label"`
		Ingresos float64 `json:"ingresos"`
		Egresos  float64 `json:"egresos"`
	}
	dayMap := make(map[string]*DayPoint)
	var dayList []string

	d1, err1 := time.Parse("2006-01-02", desde)
	d2, err2 := time.Parse("2006-01-02", hasta)
	if err1 == nil && err2 == nil && d2.Sub(d1).Hours() <= 24*62 {
		for curr := d1; !curr.After(d2); curr = curr.AddDate(0, 0, 1) {
			fStr := curr.Format("2006-01-02")
			lbl := curr.Format("02/01")
			dayMap[fStr] = &DayPoint{Fecha: fStr, Label: lbl}
			dayList = append(dayList, fStr)
		}
	}

	if canPedidos {
		qIng := `
			SELECT COALESCE(fecha_pedido, DATE(created_at)) as d, COALESCE(SUM(monto_pagado), 0)
			FROM pedidos
			WHERE deleted_at IS NULL AND estado != 'Cancelado' AND COALESCE(fecha_pedido, DATE(created_at)) BETWEEN ? AND ?
			GROUP BY d
		`
		if rows, err := h.DB.QueryContext(ctx, qIng, desde, hasta); err == nil {
			defer rows.Close()
			for rows.Next() {
				var d string
				var m float64
				if err := rows.Scan(&d, &m); err == nil {
					if pt, ok := dayMap[d]; ok {
						pt.Ingresos = m
					} else {
						lbl := d
						if pTime, pe := time.Parse("2006-01-02", d); pe == nil {
							lbl = pTime.Format("02/01")
						}
						dayMap[d] = &DayPoint{Fecha: d, Label: lbl, Ingresos: m}
						dayList = append(dayList, d)
					}
				}
			}
		}
	}

	if canPagos {
		qEgr := `
			SELECT fecha_pago as d, COALESCE(SUM(monto_pagado), 0)
			FROM pagos
			WHERE deleted_at IS NULL AND tipo_beneficiario = 'Proveedor' AND fecha_pago BETWEEN ? AND ?
			GROUP BY d
		`
		if rows, err := h.DB.QueryContext(ctx, qEgr, desde, hasta); err == nil {
			defer rows.Close()
			for rows.Next() {
				var d string
				var m float64
				if err := rows.Scan(&d, &m); err == nil {
					if pt, ok := dayMap[d]; ok {
						pt.Egresos = m
					} else {
						lbl := d
						if pTime, pe := time.Parse("2006-01-02", d); pe == nil {
							lbl = pTime.Format("02/01")
						}
						dayMap[d] = &DayPoint{Fecha: d, Label: lbl, Egresos: m}
						dayList = append(dayList, d)
					}
				}
			}
		}
	}

	sort.Strings(dayList)
	var timelineIngEgr []*DayPoint
	for _, dKey := range dayList {
		timelineIngEgr = append(timelineIngEgr, dayMap[dKey])
	}

	type PendPoint struct {
		Fecha       string  `json:"fecha"`
		Label       string  `json:"label"`
		PendCobro   float64 `json:"pendCobro"`
		PendPago    float64 `json:"pendPago"`
		PendTotales float64 `json:"pendTotales"`
	}
	pendMap := make(map[string]*PendPoint)
	var pendList []string
	if err1 == nil && err2 == nil && d2.Sub(d1).Hours() <= 24*62 {
		for curr := d1; !curr.After(d2); curr = curr.AddDate(0, 0, 1) {
			fStr := curr.Format("2006-01-02")
			lbl := curr.Format("02/01")
			pendMap[fStr] = &PendPoint{Fecha: fStr, Label: lbl}
			pendList = append(pendList, fStr)
		}
	}

	if canPedidos {
		qPendPed := `
			SELECT COALESCE(fecha_pedido, DATE(created_at)) as d, COALESCE(SUM(saldo_pendiente), 0)
			FROM pedidos
			WHERE deleted_at IS NULL AND estado != 'Cancelado' AND saldo_pendiente > 0 AND COALESCE(fecha_pedido, DATE(created_at)) BETWEEN ? AND ?
			GROUP BY d
		`
		if rows, err := h.DB.QueryContext(ctx, qPendPed, desde, hasta); err == nil {
			defer rows.Close()
			for rows.Next() {
				var d string
				var m float64
				if err := rows.Scan(&d, &m); err == nil {
					if pt, ok := pendMap[d]; ok {
						pt.PendCobro = m
					} else {
						lbl := d
						if pTime, pe := time.Parse("2006-01-02", d); pe == nil {
							lbl = pTime.Format("02/01")
						}
						pendMap[d] = &PendPoint{Fecha: d, Label: lbl, PendCobro: m}
						pendList = append(pendList, d)
					}
				}
			}
		}
	}

	if canPagos {
		qPendPag := `
			SELECT fecha_pago as d, COALESCE(SUM(saldo_pendiente), 0)
			FROM pagos
			WHERE deleted_at IS NULL AND tipo_beneficiario = 'Proveedor' AND saldo_pendiente > 0 AND fecha_pago BETWEEN ? AND ?
			GROUP BY d
		`
		if rows, err := h.DB.QueryContext(ctx, qPendPag, desde, hasta); err == nil {
			defer rows.Close()
			for rows.Next() {
				var d string
				var m float64
				if err := rows.Scan(&d, &m); err == nil {
					if pt, ok := pendMap[d]; ok {
						pt.PendPago = m
					} else {
						lbl := d
						if pTime, pe := time.Parse("2006-01-02", d); pe == nil {
							lbl = pTime.Format("02/01")
						}
						pendMap[d] = &PendPoint{Fecha: d, Label: lbl, PendPago: m}
						pendList = append(pendList, d)
					}
				}
			}
		}
	}

	sort.Strings(pendList)
	var timelinePend []*PendPoint
	for _, dKey := range pendList {
		pt := pendMap[dKey]
		pt.PendTotales = pt.PendCobro + pt.PendPago
		timelinePend = append(timelinePend, pt)
	}

	estadosDona := map[string]int{
		"pedidosPagados":    0,
		"pedidosPendientes": 0,
		"pagosPagados":      0,
		"pagosPendientes":   0,
	}
	if ped != nil {
		estadosDona["pedidosPagados"] = ped.PagadosCount
		estadosDona["pedidosPendientes"] = ped.PendientesCount
	}
	if pag != nil {
		estadosDona["pagosPagados"] = pag.PagadosCount
		estadosDona["pagosPendientes"] = pag.PendientesCount + pag.ParcialesCount
	}

	mensajesTipos := []map[string]any{}
	if msg != nil {
		for k, v := range msg.PorTipo {
			mensajesTipos = append(mensajesTipos, map[string]any{"tipo": k, "count": v})
		}
	}

	return map[string]any{
		"ingresosVsEgresos": timelineIngEgr,
		"pendientesTiempo":  timelinePend,
		"distribucion":      estadosDona,
		"mensajesTipos":     mensajesTipos,
	}
}

// Drilldown maneja GET /api/dashboard/drilldown
func (h *DashboardHandler) Drilldown(w http.ResponseWriter, r *http.Request) {
	if h.DB == nil {
		auth.WriteJSONError(w, http.StatusServiceUnavailable, "base de datos no disponible")
		return
	}

	canPedidos, canPagos, canMensajes, canGeneral := checkDashboardPermissions(r)

	tarjeta := strings.TrimSpace(r.URL.Query().Get("tarjeta"))
	desdeStr, hastaStr, estadoFilter := parseFilterParams(r)
	busqueda := strings.TrimSpace(r.URL.Query().Get("busqueda"))
	tipoFiltro := strings.TrimSpace(r.URL.Query().Get("tipo_filtro"))
	isExport := r.URL.Query().Get("exportar") == "1" || r.URL.Query().Get("exportar") == "true" || strings.HasSuffix(r.URL.Path, "/export")

	page := 1
	if p, err := strconv.Atoi(r.URL.Query().Get("pagina")); err == nil && p > 0 {
		page = p
	}
	pageSize := 20
	if isExport || r.URL.Query().Get("tamanoPagina") == "all" || r.URL.Query().Get("page_size") == "all" {
		pageSize = 500000
	} else if ps, err := strconv.Atoi(r.URL.Query().Get("tamanoPagina")); err == nil && ps > 0 {
		pageSize = ps
	} else if ps, err := strconv.Atoi(r.URL.Query().Get("page_size")); err == nil && ps > 0 {
		pageSize = ps
	}
	offset := (page - 1) * pageSize

	ctx := r.Context()

	// Validación de permisos por tarjeta solicitada
	switch {
	case strings.HasPrefix(tarjeta, "pedidos_") || tarjeta == "general_ingresos" || tarjeta == "general_pendientes" || tarjeta == "clientes_deuda":
		if !canPedidos {
			auth.WriteJSONError(w, http.StatusForbidden, "sin permiso para consultar pedidos")
			return
		}
	case strings.HasPrefix(tarjeta, "pagos_") || tarjeta == "general_egresos":
		if !canPagos {
			auth.WriteJSONError(w, http.StatusForbidden, "sin permiso para consultar pagos")
			return
		}
	case strings.HasPrefix(tarjeta, "mensajes_"):
		if !canMensajes {
			auth.WriteJSONError(w, http.StatusForbidden, "sin permiso para consultar mensajes")
			return
		}
	case tarjeta == "general_balance":
		if !canGeneral {
			auth.WriteJSONError(w, http.StatusForbidden, "sin permiso para consultar balance")
			return
		}
	}

	switch tarjeta {
	case "pedidos_recibidos", "pedidos_costo", "pedidos_pagados", "pedidos_pendientes", "general_ingresos":
		h.drilldownPedidos(w, ctx, tarjeta, desdeStr, hastaStr, estadoFilter, busqueda, page, pageSize, offset, isExport)
	case "clientes_deuda":
		h.drilldownClientesDeuda(w, ctx, desdeStr, hastaStr, estadoFilter, busqueda, page, pageSize, offset, isExport)
	case "pagos_realizados", "pagos_pendientes", "pagos_total", "pagos_clientes", "general_egresos":
		h.drilldownPagos(w, ctx, tarjeta, desdeStr, hastaStr, estadoFilter, busqueda, page, pageSize, offset, isExport)
	case "mensajes_total", "mensajes_enviados", "mensajes_programados", "mensajes_en_cola", "mensajes_fallidos", "mensajes_tipo":
		h.drilldownMensajes(w, ctx, tarjeta, desdeStr, hastaStr, tipoFiltro, busqueda, page, pageSize, offset, isExport)
	case "general_pendientes":
		h.drilldownPedidos(w, ctx, "pedidos_pendientes", desdeStr, hastaStr, estadoFilter, busqueda, page, pageSize, offset, isExport)
	case "general_balance":
		h.drilldownBalance(w, ctx, desdeStr, hastaStr, busqueda, page, pageSize, offset, isExport)
	default:
		h.drilldownPedidos(w, ctx, "pedidos_recibidos", desdeStr, hastaStr, estadoFilter, busqueda, page, pageSize, offset, isExport)
	}
}

// ExportDrilldown maneja GET /api/dashboard/drilldown/export
func (h *DashboardHandler) ExportDrilldown(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	q.Set("exportar", "1")
	r.URL.RawQuery = q.Encode()
	h.Drilldown(w, r)
}

func (h *DashboardHandler) drilldownPedidos(
	w http.ResponseWriter,
	ctx context.Context,
	tarjeta, desde, hasta, estado, busqueda string,
	page, pageSize, offset int,
	isExport bool,
) {
	where := []string{
		"deleted_at IS NULL",
		"estado != 'Cancelado'",
		"COALESCE(fecha_pedido, DATE(created_at)) BETWEEN ? AND ?",
	}
	args := []any{desde, hasta}

	if tarjeta == "pedidos_pagados" || tarjeta == "general_ingresos" {
		where = append(where, "saldo_pendiente = 0")
	} else if tarjeta == "pedidos_pendientes" || tarjeta == "general_pendientes" {
		where = append(where, "saldo_pendiente > 0")
	}

	if estado == "pendientes" {
		where = append(where, "saldo_pendiente > 0")
	} else if estado == "pagados" {
		where = append(where, "saldo_pendiente = 0")
	}

	if busqueda != "" {
		s := "%" + busqueda + "%"
		where = append(where, "(numero_pedido LIKE ? OR cliente_nombre LIKE ? OR cliente_documento LIKE ? OR cliente_telefono LIKE ?)")
		args = append(args, s, s, s, s)
	}

	whereSQL := strings.Join(where, " AND ")

	var totalRegs int
	var totalMonto float64
	montoCol := "monto_total"
	if tarjeta == "pedidos_pagados" || tarjeta == "general_ingresos" {
		montoCol = "monto_pagado"
	} else if tarjeta == "pedidos_pendientes" || tarjeta == "general_pendientes" {
		montoCol = "saldo_pendiente"
	}

	countQ := fmt.Sprintf(`SELECT COUNT(*), COALESCE(SUM(%s), 0) FROM pedidos WHERE %s`, montoCol, whereSQL)
	_ = h.DB.QueryRowContext(ctx, countQ, args...).Scan(&totalRegs, &totalMonto)

	orderClause := "id DESC"
	if tarjeta == "pedidos_costo" {
		orderClause = "monto_total DESC, id DESC"
	}

	dataQ := fmt.Sprintf(`
		SELECT
			id, numero_pedido, COALESCE(DATE_FORMAT(fecha_pedido, '%%Y-%%m-%%d'), DATE_FORMAT(created_at, '%%Y-%%m-%%d')),
			cliente_nombre, cliente_documento, cliente_telefono,
			condicion_venta, monto_total, monto_pagado, saldo_pendiente, estado,
			DATEDIFF(CURDATE(), COALESCE(fecha_pedido, DATE(created_at))) as antiguedad_dias
		FROM pedidos
		WHERE %s
		ORDER BY %s
		LIMIT ? OFFSET ?
	`, whereSQL, orderClause)

	queryArgs := append(args, pageSize, offset)
	rows, err := h.DB.QueryContext(ctx, dataQ, queryArgs...)
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "error al consultar pedidos: "+err.Error())
		return
	}
	defer rows.Close()

	if isExport {
		w.Header().Set("Content-Type", "text/csv; charset=utf-8")
		w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"pedidos_%s_%s.csv\"", tarjeta, time.Now().Format("20060102_150405")))
		_, _ = w.Write([]byte{0xEF, 0xBB, 0xBF})
		writer := csv.NewWriter(w)
		_ = writer.Write([]string{"N° Pedido", "Fecha Pedido", "Cliente", "Documento", "Teléfono", "Condición", "Costo Total (Gs.)", "Monto Pagado (Gs.)", "Saldo Pendiente (Gs.)", "Estado", "Antigüedad (días)"})
		for rows.Next() {
			var (
				id, antiguedad                                            int
				numPed, fecha, cliNom, cliDoc, cliTel, condVenta, estPed string
				total, pagado, saldo                                     float64
			)
			if err := rows.Scan(&id, &numPed, &fecha, &cliNom, &cliDoc, &cliTel, &condVenta, &total, &pagado, &saldo, &estPed, &antiguedad); err == nil {
				_ = writer.Write([]string{
					numPed, fecha, cliNom, cliDoc, cliTel, condVenta,
					strconv.FormatFloat(total, 'f', 0, 64),
					strconv.FormatFloat(pagado, 'f', 0, 64),
					strconv.FormatFloat(saldo, 'f', 0, 64),
					estPed,
					strconv.Itoa(antiguedad),
				})
			}
		}
		writer.Flush()
		return
	}

	var filas []map[string]any
	for rows.Next() {
		var (
			id, antiguedad                                            int
			numPed, fecha, cliNom, cliDoc, cliTel, condVenta, estPed string
			total, pagado, saldo                                     float64
		)
		if err := rows.Scan(&id, &numPed, &fecha, &cliNom, &cliDoc, &cliTel, &condVenta, &total, &pagado, &saldo, &estPed, &antiguedad); err == nil {
			filas = append(filas, map[string]any{
				"id":             id,
				"numeroPedido":   numPed,
				"fecha":          fecha,
				"clienteNombre":  cliNom,
				"clienteDoc":     cliDoc,
				"clienteTel":     cliTel,
				"condicionVenta": condVenta,
				"montoTotal":     total,
				"montoPagado":    pagado,
				"saldoPendiente": saldo,
				"estado":         estPed,
				"antiguedadDias": antiguedad,
			})
		}
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"tarjeta":        tarjeta,
		"contexto":       fmt.Sprintf("Pedidos · Período %s al %s", formatDateShort(desde), formatDateShort(hasta)),
		"filas":          filas,
		"totalRegistros": totalRegs,
		"totalMonto":     totalMonto,
		"pagina":         page,
		"tamanoPagina":   pageSize,
		"moduloOrigen":   "pedidos",
	})
}

func (h *DashboardHandler) drilldownClientesDeuda(
	w http.ResponseWriter,
	ctx context.Context,
	desde, hasta, estado, busqueda string,
	page, pageSize, offset int,
	isExport bool,
) {
	where := []string{
		"deleted_at IS NULL",
		"estado != 'Cancelado'",
		"saldo_pendiente > 0",
		"COALESCE(fecha_pedido, DATE(created_at)) BETWEEN ? AND ?",
	}
	args := []any{desde, hasta}

	if busqueda != "" {
		s := "%" + busqueda + "%"
		where = append(where, "(cliente_nombre LIKE ? OR cliente_documento LIKE ? OR cliente_telefono LIKE ?)")
		args = append(args, s, s, s)
	}
	whereSQL := strings.Join(where, " AND ")

	countQ := fmt.Sprintf(`
		SELECT COUNT(*), COALESCE(SUM(sub.saldo_pendiente), 0)
		FROM (
			SELECT SUM(saldo_pendiente) AS saldo_pendiente
			FROM pedidos
			WHERE %s
			GROUP BY cliente_nombre, cliente_documento, cliente_telefono
		) sub
	`, whereSQL)

	var totalRegs int
	var totalMonto float64
	_ = h.DB.QueryRowContext(ctx, countQ, args...).Scan(&totalRegs, &totalMonto)

	dataQ := fmt.Sprintf(`
		SELECT
			cliente_nombre,
			COALESCE(cliente_documento, ''),
			COALESCE(cliente_telefono, ''),
			COUNT(*),
			COALESCE(SUM(monto_total), 0),
			COALESCE(SUM(monto_pagado), 0),
			COALESCE(SUM(saldo_pendiente), 0),
			COALESCE(MAX(DATEDIFF(CURDATE(), COALESCE(fecha_pedido, DATE(created_at)))), 0)
		FROM pedidos
		WHERE %s
		GROUP BY cliente_nombre, cliente_documento, cliente_telefono
		ORDER BY SUM(saldo_pendiente) DESC
		LIMIT ? OFFSET ?
	`, whereSQL)

	queryArgs := append(args, pageSize, offset)
	rows, err := h.DB.QueryContext(ctx, dataQ, queryArgs...)
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "error al consultar clientes con deuda: "+err.Error())
		return
	}
	defer rows.Close()

	if isExport {
		w.Header().Set("Content-Type", "text/csv; charset=utf-8")
		w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"clientes_deuda_%s.csv\"", time.Now().Format("20060102_150405")))
		_, _ = w.Write([]byte{0xEF, 0xBB, 0xBF})
		writer := csv.NewWriter(w)
		_ = writer.Write([]string{"Cliente", "Documento", "Teléfono", "Cant. Pedidos Pendientes", "Costo Total (Gs.)", "Monto Pagado (Gs.)", "Total a Pagar / Saldo (Gs.)", "Antigüedad Máx (días)"})
		for rows.Next() {
			var (
				cliNom, cliDoc, cliTel    string
				pedCount, antiguedad      int
				montoTotal, pagado, saldo float64
			)
			if err := rows.Scan(&cliNom, &cliDoc, &cliTel, &pedCount, &montoTotal, &pagado, &saldo, &antiguedad); err == nil {
				_ = writer.Write([]string{
					cliNom, cliDoc, cliTel,
					strconv.Itoa(pedCount),
					strconv.FormatFloat(montoTotal, 'f', 0, 64),
					strconv.FormatFloat(pagado, 'f', 0, 64),
					strconv.FormatFloat(saldo, 'f', 0, 64),
					strconv.Itoa(antiguedad),
				})
			}
		}
		writer.Flush()
		return
	}

	var filas []map[string]any
	for rows.Next() {
		var (
			cliNom, cliDoc, cliTel    string
			pedCount, antiguedad      int
			montoTotal, pagado, saldo float64
		)
		if err := rows.Scan(&cliNom, &cliDoc, &cliTel, &pedCount, &montoTotal, &pagado, &saldo, &antiguedad); err == nil {
			filas = append(filas, map[string]any{
				"clienteNombre":  cliNom,
				"clienteDoc":     cliDoc,
				"clienteTel":     cliTel,
				"pedidosCount":   pedCount,
				"montoTotal":     montoTotal,
				"montoPagado":    pagado,
				"saldoPendiente": saldo,
				"antiguedadDias": antiguedad,
			})
		}
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"tarjeta":        "clientes_deuda",
		"contexto":       fmt.Sprintf("Clientes con Saldos Pendientes de Pago · Período %s al %s", formatDateShort(desde), formatDateShort(hasta)),
		"filas":          filas,
		"totalRegistros": totalRegs,
		"totalMonto":     totalMonto,
		"pagina":         page,
		"tamanoPagina":   pageSize,
		"moduloOrigen":   "pedidos",
	})
}

func (h *DashboardHandler) drilldownPagos(
	w http.ResponseWriter,
	ctx context.Context,
	tarjeta, desde, hasta, estado, busqueda string,
	page, pageSize, offset int,
	isExport bool,
) {
	where := []string{"deleted_at IS NULL", "fecha_pago BETWEEN ? AND ?"}
	args := []any{desde, hasta}

	if tarjeta == "pagos_clientes" {
		where = append(where, "tipo_beneficiario = 'Cliente'")
	} else {
		where = append(where, "tipo_beneficiario = 'Proveedor'")
	}

	if tarjeta == "pagos_realizados" || tarjeta == "general_egresos" {
		where = append(where, "estado_pago = 'Pagado'")
	} else if tarjeta == "pagos_pendientes" {
		where = append(where, "(estado_pago = 'Pendiente' OR estado_pago = 'Pago Parcial' OR saldo_pendiente > 0)")
	}

	if estado == "pendientes" {
		where = append(where, "(estado_pago = 'Pendiente' OR estado_pago = 'Pago Parcial' OR saldo_pendiente > 0)")
	} else if estado == "pagados" {
		where = append(where, "estado_pago = 'Pagado'")
	}

	if busqueda != "" {
		s := "%" + busqueda + "%"
		where = append(where, "(numero_pago LIKE ? OR proveedor_nombre LIKE ? OR cliente_nombre LIKE ? OR producto_nombre LIKE ?)")
		args = append(args, s, s, s, s)
	}

	whereSQL := strings.Join(where, " AND ")

	var totalRegs int
	var totalMonto float64
	montoCol := "monto_total"
	if tarjeta == "pagos_realizados" || tarjeta == "general_egresos" {
		montoCol = "monto_pagado"
	} else if tarjeta == "pagos_pendientes" {
		montoCol = "saldo_pendiente"
	}

	countQ := fmt.Sprintf(`SELECT COUNT(*), COALESCE(SUM(%s), 0) FROM pagos WHERE %s`, montoCol, whereSQL)
	_ = h.DB.QueryRowContext(ctx, countQ, args...).Scan(&totalRegs, &totalMonto)

	dataQ := fmt.Sprintf(`
		SELECT
			id, numero_pago, DATE_FORMAT(fecha_pago, '%%Y-%%m-%%d'),
			tipo_beneficiario,
			COALESCE(CASE WHEN tipo_beneficiario = 'Cliente' THEN cliente_nombre ELSE proveedor_nombre END, ''),
			producto_nombre, metodo_pago, monto_total, monto_pagado, saldo_pendiente, estado_pago,
			DATEDIFF(CURDATE(), fecha_pago) as antiguedad_dias
		FROM pagos
		WHERE %s
		ORDER BY id DESC
		LIMIT ? OFFSET ?
	`, whereSQL)

	queryArgs := append(args, pageSize, offset)
	rows, err := h.DB.QueryContext(ctx, dataQ, queryArgs...)
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "error al consultar pagos: "+err.Error())
		return
	}
	defer rows.Close()

	if isExport {
		w.Header().Set("Content-Type", "text/csv; charset=utf-8")
		w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"pagos_%s_%s.csv\"", tarjeta, time.Now().Format("20060102_150405")))
		_, _ = w.Write([]byte{0xEF, 0xBB, 0xBF})
		writer := csv.NewWriter(w)
		_ = writer.Write([]string{"N° Pago", "Fecha Pago", "Tipo Beneficiario", "Beneficiario", "Concepto/Producto", "Método", "Monto Total (Gs.)", "Monto Pagado (Gs.)", "Saldo Pendiente (Gs.)", "Estado", "Antigüedad (días)"})
		for rows.Next() {
			var (
				id, antiguedad                                        int
				numPago, fecha, tipoBen, benNom, prodNom, metodo, est string
				total, pagado, saldo                                  float64
			)
			if err := rows.Scan(&id, &numPago, &fecha, &tipoBen, &benNom, &prodNom, &metodo, &total, &pagado, &saldo, &est, &antiguedad); err == nil {
				_ = writer.Write([]string{
					numPago, fecha, tipoBen, benNom, prodNom, metodo,
					strconv.FormatFloat(total, 'f', 0, 64),
					strconv.FormatFloat(pagado, 'f', 0, 64),
					strconv.FormatFloat(saldo, 'f', 0, 64),
					est,
					strconv.Itoa(antiguedad),
				})
			}
		}
		writer.Flush()
		return
	}

	var filas []map[string]any
	for rows.Next() {
		var (
			id, antiguedad                                        int
			numPago, fecha, tipoBen, benNom, prodNom, metodo, est string
			total, pagado, saldo                                  float64
		)
		if err := rows.Scan(&id, &numPago, &fecha, &tipoBen, &benNom, &prodNom, &metodo, &total, &pagado, &saldo, &est, &antiguedad); err == nil {
			filas = append(filas, map[string]any{
				"id":               id,
				"numeroPago":       numPago,
				"fecha":            fecha,
				"tipoBeneficiario": tipoBen,
				"beneficiario":     benNom,
				"concepto":         prodNom,
				"metodoPago":       metodo,
				"montoTotal":       total,
				"montoPagado":      pagado,
				"saldoPendiente":   saldo,
				"estado":           est,
				"antiguedadDias":   antiguedad,
			})
		}
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"tarjeta":        tarjeta,
		"contexto":       fmt.Sprintf("Pagos · Período %s al %s", formatDateShort(desde), formatDateShort(hasta)),
		"filas":          filas,
		"totalRegistros": totalRegs,
		"totalMonto":     totalMonto,
		"pagina":         page,
		"tamanoPagina":   pageSize,
		"moduloOrigen":   "pagos",
	})
}

func (h *DashboardHandler) drilldownMensajes(
	w http.ResponseWriter,
	ctx context.Context,
	tarjeta, desde, hasta, tipoFiltro, busqueda string,
	page, pageSize, offset int,
	isExport bool,
) {
	where := []string{"DATE(created_at) BETWEEN ? AND ?"}
	args := []any{desde, hasta}

	switch tarjeta {
	case "mensajes_enviados":
		where = append(where, "estado = 'Enviado'")
	case "mensajes_programados":
		where = append(where, "estado = 'Programado'")
	case "mensajes_en_cola":
		where = append(where, "estado = 'En Cola'")
	case "mensajes_fallidos":
		where = append(where, "estado = 'Fallido'")
	}

	if tipoFiltro != "" && tipoFiltro != "todos" {
		where = append(where, "tipo = ?")
		args = append(args, tipoFiltro)
	}

	if busqueda != "" {
		s := "%" + busqueda + "%"
		where = append(where, "(nombre_destinatario LIKE ? OR telefono_destinatario LIKE ? OR plantilla_titulo LIKE ?)")
		args = append(args, s, s, s)
	}

	whereSQL := strings.Join(where, " AND ")

	var totalRegs int
	countQ := fmt.Sprintf(`SELECT COUNT(*) FROM mensajes_historial WHERE %s`, whereSQL)
	_ = h.DB.QueryRowContext(ctx, countQ, args...).Scan(&totalRegs)

	dataQ := fmt.Sprintf(`
		SELECT
			id, DATE_FORMAT(created_at, '%%Y-%%m-%%d %%H:%%i'),
			COALESCE(nombre_destinatario, ''), COALESCE(telefono_destinatario, ''),
			COALESCE(tipo, 'Mensaje'), COALESCE(plantilla_titulo, 'Sin plantilla'),
			COALESCE(estado, 'Enviado')
		FROM mensajes_historial
		WHERE %s
		ORDER BY id DESC
		LIMIT ? OFFSET ?
	`, whereSQL)

	queryArgs := append(args, pageSize, offset)
	rows, err := h.DB.QueryContext(ctx, dataQ, queryArgs...)
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "error al consultar mensajes: "+err.Error())
		return
	}
	defer rows.Close()

	if isExport {
		w.Header().Set("Content-Type", "text/csv; charset=utf-8")
		w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"mensajes_%s.csv\"", time.Now().Format("20060102_150405")))
		_, _ = w.Write([]byte{0xEF, 0xBB, 0xBF})
		writer := csv.NewWriter(w)
		_ = writer.Write([]string{"ID", "Fecha/Hora", "Destinatario", "Teléfono", "Tipo", "Campaña/Plantilla", "Estado"})
		for rows.Next() {
			var id int
			var fecha, nom, tel, tip, tit, est string
			if err := rows.Scan(&id, &fecha, &nom, &tel, &tip, &tit, &est); err == nil {
				_ = writer.Write([]string{strconv.Itoa(id), fecha, nom, tel, tip, tit, est})
			}
		}
		writer.Flush()
		return
	}

	var filas []map[string]any
	for rows.Next() {
		var id int
		var fecha, nom, tel, tip, tit, est string
		if err := rows.Scan(&id, &fecha, &nom, &tel, &tip, &tit, &est); err == nil {
			filas = append(filas, map[string]any{
				"id":           id,
				"fecha":        fecha,
				"destinatario": nom,
				"telefono":     tel,
				"tipo":         tip,
				"campana":      tit,
				"estado":       est,
			})
		}
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"tarjeta":        tarjeta,
		"contexto":       fmt.Sprintf("Mensajes · Período %s al %s", formatDateShort(desde), formatDateShort(hasta)),
		"filas":          filas,
		"totalRegistros": totalRegs,
		"totalMonto":     0,
		"pagina":         page,
		"tamanoPagina":   pageSize,
		"moduloOrigen":   "broadcast",
	})
}

func (h *DashboardHandler) drilldownBalance(
	w http.ResponseWriter,
	ctx context.Context,
	desde, hasta, busqueda string,
	page, pageSize, offset int,
	isExport bool,
) {
	type Movimiento struct {
		Fecha        string
		Tipo         string
		Concepto     string
		Beneficiario string
		Monto        float64
		Modulo       string
		ID           int
	}

	var movs []Movimiento

	// 1. Ingresos (pedidos cobrados, no cancelados)
	wherePed := []string{
		"deleted_at IS NULL",
		"estado != 'Cancelado'",
		"monto_pagado > 0",
		"COALESCE(fecha_pedido, DATE(created_at)) BETWEEN ? AND ?",
	}
	argsPed := []any{desde, hasta}
	if busqueda != "" {
		s := "%" + busqueda + "%"
		wherePed = append(wherePed, "(numero_pedido LIKE ? OR cliente_nombre LIKE ?)")
		argsPed = append(argsPed, s, s)
	}
	qPed := fmt.Sprintf(`
		SELECT id, COALESCE(DATE_FORMAT(fecha_pedido, '%%Y-%%m-%%d'), DATE_FORMAT(created_at, '%%Y-%%m-%%d')),
		       numero_pedido, cliente_nombre, monto_pagado
		FROM pedidos
		WHERE %s
		ORDER BY id DESC
	`, strings.Join(wherePed, " AND "))
	if rows, err := h.DB.QueryContext(ctx, qPed, argsPed...); err == nil {
		defer rows.Close()
		for rows.Next() {
			var id int
			var f, num, cli string
			var m float64
			if err := rows.Scan(&id, &f, &num, &cli, &m); err == nil {
				movs = append(movs, Movimiento{
					ID:           id,
					Fecha:        f,
					Tipo:         "Ingreso",
					Concepto:     "Cobro Pedido " + num,
					Beneficiario: cli,
					Monto:        m,
					Modulo:       "pedidos",
				})
			}
		}
	}

	// 2. Egresos (solo Proveedor)
	wherePag := []string{
		"deleted_at IS NULL",
		"tipo_beneficiario = 'Proveedor'",
		"monto_pagado > 0",
		"fecha_pago BETWEEN ? AND ?",
	}
	argsPag := []any{desde, hasta}
	if busqueda != "" {
		s := "%" + busqueda + "%"
		wherePag = append(wherePag, "(numero_pago LIKE ? OR proveedor_nombre LIKE ? OR producto_nombre LIKE ?)")
		argsPag = append(argsPag, s, s, s)
	}
	qPag := fmt.Sprintf(`
		SELECT id, DATE_FORMAT(fecha_pago, '%%Y-%%m-%%d'), numero_pago, proveedor_nombre, monto_pagado
		FROM pagos
		WHERE %s
		ORDER BY id DESC
	`, strings.Join(wherePag, " AND "))
	if rows, err := h.DB.QueryContext(ctx, qPag, argsPag...); err == nil {
		defer rows.Close()
		for rows.Next() {
			var id int
			var f, num, prov string
			var m float64
			if err := rows.Scan(&id, &f, &num, &prov, &m); err == nil {
				movs = append(movs, Movimiento{
					ID:           id,
					Fecha:        f,
					Tipo:         "Egreso",
					Concepto:     "Pago Proveedor " + num,
					Beneficiario: prov,
					Monto:        m,
					Modulo:       "pagos",
				})
			}
		}
	}

	totalRegs := len(movs)
	var totIng, totEgr float64
	for _, m := range movs {
		if m.Tipo == "Ingreso" {
			totIng += m.Monto
		} else {
			totEgr += m.Monto
		}
	}
	netBalance := totIng - totEgr

	if isExport {
		w.Header().Set("Content-Type", "text/csv; charset=utf-8")
		w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"balance_%s.csv\"", time.Now().Format("20060102_150405")))
		_, _ = w.Write([]byte{0xEF, 0xBB, 0xBF})
		writer := csv.NewWriter(w)
		_ = writer.Write([]string{"Fecha", "Tipo", "Concepto", "Cliente / Proveedor", "Monto (Gs.)"})
		for _, m := range movs {
			_ = writer.Write([]string{
				m.Fecha, m.Tipo, m.Concepto, m.Beneficiario,
				strconv.FormatFloat(m.Monto, 'f', 0, 64),
			})
		}
		writer.Flush()
		return
	}

	var pagedMovs []Movimiento
	if offset < totalRegs {
		end := offset + pageSize
		if end > totalRegs {
			end = totalRegs
		}
		pagedMovs = movs[offset:end]
	}

	var filas []map[string]any
	for _, m := range pagedMovs {
		filas = append(filas, map[string]any{
			"id":           m.ID,
			"fecha":        m.Fecha,
			"tipo":         m.Tipo,
			"concepto":     m.Concepto,
			"beneficiario": m.Beneficiario,
			"monto":        m.Monto,
			"modulo":       m.Modulo,
		})
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"tarjeta":        "general_balance",
		"contexto":       fmt.Sprintf("Balance Financiero · Período %s al %s", formatDateShort(desde), formatDateShort(hasta)),
		"filas":          filas,
		"totalRegistros": totalRegs,
		"totalMonto":     netBalance,
		"subtotales": map[string]float64{
			"ingresos": totIng,
			"egresos":  totEgr,
			"balance":  netBalance,
		},
		"pagina":         page,
		"tamanoPagina":   pageSize,
		"moduloOrigen":   "balance",
	})
}

func parseFilterParams(r *http.Request) (string, string, string) {
	q := r.URL.Query()
	desde := strings.TrimSpace(q.Get("desde"))
	hasta := strings.TrimSpace(q.Get("hasta"))
	dia := strings.TrimSpace(q.Get("dia"))
	estado := strings.ToLower(strings.TrimSpace(q.Get("estado")))

	if dia != "" {
		desde = dia
		hasta = dia
	}

	if desde == "" {
		desde = "2020-01-01"
	}
	if hasta == "" {
		hasta = "2099-12-31"
	}

	if estado == "" {
		estado = "todos"
	}

	return desde, hasta, estado
}

func calcDelta(actual, previo float64) float64 {
	if previo <= 0 {
		if actual > 0 {
			return 100.0
		}
		return 0.0
	}
	return math.Round(((actual-previo)/previo)*1000) / 10
}

func formatDateShort(d string) string {
	parts := strings.Split(d, "-")
	if len(parts) == 3 {
		return fmt.Sprintf("%s/%s/%s", parts[2], parts[1], parts[0])
	}
	return d
}
