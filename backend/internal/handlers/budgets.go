package handlers

import (
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math/rand"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"r1/backend/internal/auth"
	"r1/backend/internal/models"
)

type BudgetsHandler struct {
	DB *sql.DB
}

func (h *BudgetsHandler) getActorName(r *http.Request) string {
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

func NewBudgetsHandler(dbConn *sql.DB) *BudgetsHandler {
	h := &BudgetsHandler{DB: dbConn}
	h.initSchema()
	return h
}

// normalizeDate asegura que cualquier fecha en formato DD/MM/YYYY, YYYY-MM-DD o DD-MM-YYYY se transforme a YYYY-MM-DD para MySQL
func normalizeDate(str string) string {
	str = strings.TrimSpace(str)
	if str == "" {
		return time.Now().Format("2006-01-02")
	}

	for _, layout := range []string{
		"2006-01-02",
		"02/01/2006",
		"2/1/2006",
		"02-01-2006",
		"2-1-2006",
		"2006/01/02",
		"2006/1/2",
		time.RFC3339,
	} {
		if t, err := time.Parse(layout, str); err == nil {
			return t.Format("2006-01-02")
		}
	}

	if strings.Contains(str, "/") {
		parts := strings.Split(str, "/")
		if len(parts) == 3 {
			p0 := strings.TrimSpace(parts[0])
			p1 := strings.TrimSpace(parts[1])
			p2 := strings.TrimSpace(parts[2])
			if len(p0) == 4 {
				if len(p1) == 1 { p1 = "0" + p1 }
				if len(p2) == 1 { p2 = "0" + p2 }
				return fmt.Sprintf("%s-%s-%s", p0, p1, p2)
			}
			if len(p2) == 4 {
				if len(p0) == 1 { p0 = "0" + p0 }
				if len(p1) == 1 { p1 = "0" + p1 }
				return fmt.Sprintf("%s-%s-%s", p2, p1, p0)
			}
		}
	}

	if strings.Contains(str, "-") {
		parts := strings.Split(str, "-")
		if len(parts) == 3 {
			p0 := strings.TrimSpace(parts[0])
			p1 := strings.TrimSpace(parts[1])
			p2 := strings.TrimSpace(parts[2])
			if len(p0) == 4 {
				if len(p1) == 1 { p1 = "0" + p1 }
				if len(p2) == 1 { p2 = "0" + p2 }
				return fmt.Sprintf("%s-%s-%s", p0, p1, p2)
			}
			if len(p2) == 4 {
				if len(p0) == 1 { p0 = "0" + p0 }
				if len(p1) == 1 { p1 = "0" + p1 }
				return fmt.Sprintf("%s-%s-%s", p2, p1, p0)
			}
		}
	}

	return time.Now().Format("2006-01-02")
}

// saveBase64Image guarda un data URI base64 como archivo WebP en uploads/presupuestos/ y retorna la URL relativa corta
func saveBase64Image(dataURI string, prefix string) string {
	if !strings.HasPrefix(dataURI, "data:image/") {
		return dataURI
	}

	parts := strings.SplitN(dataURI, ",", 2)
	if len(parts) != 2 {
		return dataURI
	}

	mimePart := parts[0]
	rawB64 := parts[1]

	ext := ".webp"
	if strings.Contains(mimePart, "png") {
		ext = ".png"
	} else if strings.Contains(mimePart, "jpeg") || strings.Contains(mimePart, "jpg") {
		ext = ".jpg"
	}

	dec, err := base64.StdEncoding.DecodeString(rawB64)
	if err != nil {
		dec, err = base64.RawStdEncoding.DecodeString(rawB64)
		if err != nil {
			log.Printf("[Budgets] Error al decodificar imagen base64: %v", err)
			return dataURI
		}
	}

	uploadDir := filepath.Join("uploads", "presupuestos")
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		log.Printf("[Budgets] Error al crear directorio uploads: %v", err)
		return dataURI
	}

	fileName := fmt.Sprintf("%s_%d_%04x%s", prefix, time.Now().UnixNano(), rand.Intn(0x10000), ext)
	filePath := filepath.Join(uploadDir, fileName)

	if err := os.WriteFile(filePath, dec, 0644); err != nil {
		log.Printf("[Budgets] Error al escribir archivo de imagen %s: %v", filePath, err)
		return dataURI
	}

	return fmt.Sprintf("/uploads/presupuestos/%s", fileName)
}

// initSchema garantiza la existencia de las tablas necesarias sin romper el servidor
func (h *BudgetsHandler) initSchema() {
	if h.DB == nil {
		return
	}

	createPresupuestosSQL := `
	CREATE TABLE IF NOT EXISTS presupuestos (
		id INT AUTO_INCREMENT PRIMARY KEY,
		numero_presupuesto VARCHAR(50) NOT NULL UNIQUE,
		fecha_emision DATE NOT NULL,
		validez_dias INT NOT NULL DEFAULT 15,
		validez_fecha VARCHAR(60) NOT NULL,
		moneda VARCHAR(20) NOT NULL DEFAULT 'Gs.',
		regimen_iva VARCHAR(50) NOT NULL DEFAULT 'Exento de IVA',
		estado ENUM('Borrador', 'Pendiente', 'Enviado', 'Aprobado', 'Rechazado', 'Vencido') NOT NULL DEFAULT 'Pendiente',
		cliente_id INT NULL,
		cliente_casual TINYINT(1) NOT NULL DEFAULT 0,
		cliente_nombre VARCHAR(150) NOT NULL,
		cliente_ruc VARCHAR(50) NULL,
		cliente_telefono VARCHAR(60) NULL,
		cliente_email VARCHAR(150) NULL,
		cliente_direccion VARCHAR(255) NULL,
		subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
		porcentaje_descuento DECIMAL(5,2) NOT NULL DEFAULT 0,
		monto_descuento DECIMAL(15,2) NOT NULL DEFAULT 0,
		total_final DECIMAL(15,2) NOT NULL DEFAULT 0,
		leyenda_descuento VARCHAR(255) NULL,
		mostrar_descuento_pdf TINYINT(1) NOT NULL DEFAULT 1,
		terminos_condiciones JSON NULL,
		observaciones TEXT NULL,
		servicios_opcionales JSON NULL,
		galeria_fotos JSON NULL,
		mostrar_galeria_pdf TINYINT(1) NOT NULL DEFAULT 1,
		galeria_layout VARCHAR(30) NOT NULL DEFAULT '2x3',
		pedido_id INT NULL,
		created_by VARCHAR(150) NULL DEFAULT NULL,
		deleted_at DATETIME NULL DEFAULT NULL,
		deleted_by VARCHAR(150) NULL DEFAULT NULL,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
		INDEX idx_presupuestos_numero (numero_presupuesto),
		INDEX idx_presupuestos_cliente (cliente_id),
		INDEX idx_presupuestos_fecha (fecha_emision),
		INDEX idx_presupuestos_deleted (deleted_at)
	) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`

	createItemsSQL := `
	CREATE TABLE IF NOT EXISTS presupuesto_items (
		id INT AUTO_INCREMENT PRIMARY KEY,
		presupuesto_id INT NOT NULL,
		producto_id INT NULL,
		es_no_registrado TINYINT(1) NOT NULL DEFAULT 0,
		sku VARCHAR(100) NULL,
		descripcion VARCHAR(255) NOT NULL,
		precio_unitario DECIMAL(15,2) NOT NULL DEFAULT 0,
		cantidad INT NOT NULL DEFAULT 1,
		total DECIMAL(15,2) NOT NULL DEFAULT 0,
		imagen_url VARCHAR(255) NULL,
		orden INT NOT NULL DEFAULT 0,
		proveedor_id INT NULL,
		proveedor_casual TINYINT(1) NOT NULL DEFAULT 0,
		proveedor_nombre VARCHAR(150) NULL,
		proveedor_costo DECIMAL(15,2) NOT NULL DEFAULT 0,
		proveedor_cantidad INT NOT NULL DEFAULT 0,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
		INDEX idx_presupuesto_items_presupuesto (presupuesto_id),
		INDEX idx_presupuesto_items_producto (producto_id),
		CONSTRAINT fk_presupuesto_items_presupuesto FOREIGN KEY (presupuesto_id) REFERENCES presupuestos(id) ON DELETE CASCADE
	) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`

	_, _ = h.DB.Exec(createPresupuestosSQL)
	_, _ = h.DB.Exec(createItemsSQL)

	// Agregar columnas si no existen (idempotente)
	alterCols := []string{
		"ALTER TABLE presupuestos ADD COLUMN IF NOT EXISTS cliente_casual TINYINT(1) NOT NULL DEFAULT 0;",
		"ALTER TABLE presupuestos ADD COLUMN IF NOT EXISTS moneda VARCHAR(20) NOT NULL DEFAULT 'Gs.';",
		"ALTER TABLE presupuestos ADD COLUMN IF NOT EXISTS regimen_iva VARCHAR(50) NOT NULL DEFAULT 'Exento de IVA';",
		"ALTER TABLE presupuestos ADD COLUMN IF NOT EXISTS leyenda_descuento VARCHAR(255) NULL;",
		"ALTER TABLE presupuestos ADD COLUMN IF NOT EXISTS mostrar_descuento_pdf TINYINT(1) NOT NULL DEFAULT 1;",
		"ALTER TABLE presupuestos ADD COLUMN IF NOT EXISTS servicios_opcionales JSON NULL;",
		"ALTER TABLE presupuestos ADD COLUMN IF NOT EXISTS galeria_fotos JSON NULL;",
		"ALTER TABLE presupuestos ADD COLUMN IF NOT EXISTS mostrar_galeria_pdf TINYINT(1) NOT NULL DEFAULT 1;",
		"ALTER TABLE presupuestos ADD COLUMN IF NOT EXISTS galeria_layout VARCHAR(30) NOT NULL DEFAULT '2x3';",
		"ALTER TABLE presupuestos ADD COLUMN IF NOT EXISTS pedido_id INT NULL;",
		"ALTER TABLE presupuesto_items ADD COLUMN IF NOT EXISTS es_no_registrado TINYINT(1) NOT NULL DEFAULT 0;",
		"ALTER TABLE presupuesto_items ADD COLUMN IF NOT EXISTS sku VARCHAR(100) NULL;",
		"ALTER TABLE presupuesto_items ADD COLUMN IF NOT EXISTS orden INT NOT NULL DEFAULT 0;",
		"ALTER TABLE presupuesto_items ADD COLUMN IF NOT EXISTS proveedor_id INT NULL;",
		"ALTER TABLE presupuesto_items ADD COLUMN IF NOT EXISTS proveedor_casual TINYINT(1) NOT NULL DEFAULT 0;",
		"ALTER TABLE presupuesto_items ADD COLUMN IF NOT EXISTS proveedor_nombre VARCHAR(150) NULL;",
		"ALTER TABLE presupuesto_items ADD COLUMN IF NOT EXISTS proveedor_costo DECIMAL(15,2) NOT NULL DEFAULT 0;",
		"ALTER TABLE presupuesto_items ADD COLUMN IF NOT EXISTS proveedor_cantidad INT NOT NULL DEFAULT 0;",
		"ALTER TABLE presupuestos MODIFY COLUMN estado VARCHAR(30) NOT NULL DEFAULT 'Borrador';",
		"ALTER TABLE presupuesto_items MODIFY COLUMN imagen_url TEXT NULL;",
	}
	for _, sqlStmt := range alterCols {
		_, _ = h.DB.Exec(sqlStmt)
	}

	_ = os.MkdirAll(filepath.Join("uploads", "presupuestos"), 0755)
}

// HandleUploadImage guarda una imagen WebP subida y retorna su URL corta
func (h *BudgetsHandler) HandleUploadImage(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	if r.Method != http.MethodPost {
		auth.WriteJSONError(w, http.StatusMethodNotAllowed, "método no permitido")
		return
	}

	// 1. Intentar decodificar JSON con base64
	var jsonReq struct {
		Image string `json:"image"`
		Name  string `json:"name,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&jsonReq); err == nil && jsonReq.Image != "" {
		pfx := "foto"
		if jsonReq.Name != "" {
			cleanName := strings.ToLower(strings.ReplaceAll(jsonReq.Name, " ", "_"))
			if len(cleanName) > 20 {
				cleanName = cleanName[:20]
			}
			pfx = cleanName
		}
		url := saveBase64Image(jsonReq.Image, pfx)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"success": true,
			"url":     url,
		})
		return
	}

	// 2. Intentar multipart form
	file, header, err := r.FormFile("file")
	if err != nil {
		auth.WriteJSONError(w, http.StatusBadRequest, "no se proporcionó imagen válida")
		return
	}
	defer file.Close()

	uploadDir := filepath.Join("uploads", "presupuestos")
	_ = os.MkdirAll(uploadDir, 0755)

	ext := filepath.Ext(header.Filename)
	if ext == "" {
		ext = ".webp"
	}
	fileName := fmt.Sprintf("foto_%d_%04x%s", time.Now().UnixNano(), rand.Intn(0x10000), ext)
	dstPath := filepath.Join(uploadDir, fileName)

	dst, err := os.Create(dstPath)
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "error al guardar archivo en disco")
		return
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "error al copiar archivo")
		return
	}

	_ = json.NewEncoder(w).Encode(map[string]any{
		"success": true,
		"url":     fmt.Sprintf("/uploads/presupuestos/%s", fileName),
	})
}

// HandleCollection maneja GET y POST en /api/budgets
func (h *BudgetsHandler) HandleCollection(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")

	switch r.Method {
	case http.MethodGet:
		h.listBudgets(w, r)
	case http.MethodPost:
		h.createBudget(w, r)
	default:
		auth.WriteJSONError(w, http.StatusMethodNotAllowed, "método no permitido")
	}
}

// listBudgets lista los presupuestos con filtros y contadores superiores
func (h *BudgetsHandler) listBudgets(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	estadoFilter := strings.TrimSpace(r.URL.Query().Get("estado"))
	fechaDesde := strings.TrimSpace(r.URL.Query().Get("fecha_desde"))
	fechaHasta := strings.TrimSpace(r.URL.Query().Get("fecha_hasta"))

	page := 1
	if p, err := strconv.Atoi(r.URL.Query().Get("page")); err == nil && p > 0 {
		page = p
	}
	pageSize := 20
	if ps, err := strconv.Atoi(r.URL.Query().Get("page_size")); err == nil && ps > 0 {
		pageSize = ps
	}

	counters := map[string]int{
		"total":      0,
		"borrador":   0,
		"enviados":   0,
		"aprobados":  0,
		"rechazados": 0,
		"vencidos":   0,
		"anulados":   0,
	}

	if h.DB == nil {
		h.sendSampleList(w, counters)
		return
	}

	// 1. Obtener contadores por estado de presupuestos no eliminados
	countRows, err := h.DB.QueryContext(r.Context(), `
		SELECT estado, COUNT(*) 
		FROM presupuestos 
		WHERE deleted_at IS NULL 
		GROUP BY estado
	`)
	if err == nil {
		defer countRows.Close()
		tot := 0
		for countRows.Next() {
			var est string
			var cnt int
			if countRows.Scan(&est, &cnt) == nil {
				estNorm := strings.ToLower(est)
				switch estNorm {
				case "borrador":
					counters["borrador"] = cnt
				case "enviado", "pendiente":
					counters["enviados"] += cnt
				case "aprobado", "aceptado":
					counters["aprobados"] += cnt
				case "rechazado":
					counters["rechazados"] = cnt
				case "vencido":
					counters["vencidos"] = cnt
				case "anulado":
					counters["anulados"] = cnt
				}
				if estNorm != "anulado" {
					tot += cnt
				}
			}
		}
		counters["total"] = tot
	}

	// 2. Armar consulta con filtros
	var whereClauses []string
	var args []any

	whereClauses = append(whereClauses, "p.deleted_at IS NULL")

	if q != "" {
		like := "%" + q + "%"
		whereClauses = append(whereClauses, "(p.numero_presupuesto LIKE ? OR p.cliente_nombre LIKE ? OR IFNULL(p.cliente_ruc, '') LIKE ? OR IFNULL(p.cliente_telefono, '') LIKE ?)")
		args = append(args, like, like, like, like)
	}

	if estadoFilter != "" && !strings.EqualFold(estadoFilter, "todos") && !strings.EqualFold(estadoFilter, "todos los estados") {
		if strings.EqualFold(estadoFilter, "enviados") || strings.EqualFold(estadoFilter, "enviado") {
			whereClauses = append(whereClauses, "(p.estado = 'Enviado' OR p.estado = 'Pendiente')")
		} else if strings.EqualFold(estadoFilter, "aprobados") || strings.EqualFold(estadoFilter, "aprobado") {
			whereClauses = append(whereClauses, "(p.estado = 'Aprobado' OR p.estado = 'Aceptado')")
		} else {
			whereClauses = append(whereClauses, "p.estado = ?")
			args = append(args, estadoFilter)
		}
	} else if estadoFilter == "" {
		// Por defecto ocultar Anulados para no llenar la vista, a menos que se elija 'Todos' o 'Anulados'
		whereClauses = append(whereClauses, "p.estado != 'Anulado'")
	}

	if fechaDesde != "" {
		whereClauses = append(whereClauses, "p.fecha_emision >= ?")
		args = append(args, fechaDesde)
	}
	if fechaHasta != "" {
		whereClauses = append(whereClauses, "p.fecha_emision <= ?")
		args = append(args, fechaHasta)
	}

	whereSQL := "WHERE " + strings.Join(whereClauses, " AND ")

	// Conteo total filtrado
	var totalRecords int
	countQuery := "SELECT COUNT(*) FROM presupuestos p " + whereSQL
	_ = h.DB.QueryRowContext(r.Context(), countQuery, args...).Scan(&totalRecords)

	// Consulta de registros con resumen de ítems
	query := fmt.Sprintf(`
		SELECT 
			p.id, 
			p.numero_presupuesto, 
			DATE_FORMAT(p.fecha_emision, '%%d/%%m/%%Y') AS fecha_emision, 
			p.validez_dias, 
			COALESCE(p.validez_fecha, '') AS validez_fecha, 
			p.estado, 
			p.cliente_id, 
			COALESCE(p.cliente_casual, 0) AS cliente_casual,
			p.cliente_nombre, 
			COALESCE(p.cliente_ruc, '') AS cliente_ruc, 
			COALESCE(p.cliente_telefono, '') AS cliente_telefono, 
			COALESCE(p.cliente_email, '') AS cliente_email,
			p.subtotal, 
			p.monto_descuento, 
			p.total_final, 
			COALESCE(p.pedido_id, 0) AS pedido_id,
			p.created_at,
			(SELECT COUNT(*) FROM presupuesto_items pi WHERE pi.presupuesto_id = p.id) AS items_count,
			COALESCE((
				SELECT GROUP_CONCAT(CONCAT(pi.cantidad, 'x ', pi.descripcion) SEPARATOR ', ')
				FROM (SELECT presupuesto_id, cantidad, descripcion FROM presupuesto_items ORDER BY id ASC LIMIT 3) pi
				WHERE pi.presupuesto_id = p.id
			), '') AS items_resumen
		FROM presupuestos p
		%s
		ORDER BY p.id DESC
		LIMIT ? OFFSET ?
	`, whereSQL)

	offset := (page - 1) * pageSize
	queryArgs := append(args, pageSize, offset)

	rows, err := h.DB.QueryContext(r.Context(), query, queryArgs...)
	if err != nil {
		// Si la tabla estuviera vacía o en migración, entregar muestra
		if totalRecords == 0 {
			h.sendSampleList(w, counters)
			return
		}
		auth.WriteJSONError(w, http.StatusInternalServerError, "error al consultar presupuestos: "+err.Error())
		return
	}
	defer rows.Close()

	var list []map[string]any
	for rows.Next() {
		var (
			id, validezDias, itemsCount, pedidoID int
			cliCasual                             int
			cliID                                 sql.NullInt64
			numPres, fechaEm, valFecha, estado    string
			cliNom, cliRuc, cliTel, cliEmail      string
			itemsResumen                          string
			subtotal, descMonto, totalFinal       float64
			createdAt                             time.Time
		)

		if err := rows.Scan(
			&id, &numPres, &fechaEm, &validezDias, &valFecha, &estado,
			&cliID, &cliCasual, &cliNom, &cliRuc, &cliTel, &cliEmail,
			&subtotal, &descMonto, &totalFinal, &pedidoID, &createdAt,
			&itemsCount, &itemsResumen,
		); err == nil {
			var cID *int
			if cliID.Valid {
				v := int(cliID.Int64)
				cID = &v
			}
			var pID *int
			if pedidoID > 0 {
				pID = &pedidoID
			}

			list = append(list, map[string]any{
				"id":                 id,
				"numero_presupuesto": numPres,
				"fecha_emision":      fechaEm,
				"validez_dias":       validezDias,
				"validez_fecha":      valFecha,
				"estado":             estado,
				"cliente_id":         cID,
				"cliente_casual":     cliCasual == 1,
				"cliente_nombre":     cliNom,
				"cliente_ruc":        cliRuc,
				"cliente_telefono":   cliTel,
				"cliente_email":      cliEmail,
				"subtotal":           subtotal,
				"subtotal_formateado": formatGs(subtotal),
				"monto_descuento":    descMonto,
				"total_final":        totalFinal,
				"total_formateado":   formatGs(totalFinal),
				"pedido_id":          pID,
				"items_count":        itemsCount,
				"items_resumen":      itemsResumen,
				"created_at":         createdAt.Format("2006-01-02 15:04:05"),
			})
		}
	}

	if len(list) == 0 && totalRecords == 0 && q == "" && estadoFilter == "" {
		h.sendSampleList(w, counters)
		return
	}

	_ = json.NewEncoder(w).Encode(map[string]any{
		"data":      list,
		"counters":  counters,
		"total":     totalRecords,
		"page":      page,
		"page_size": pageSize,
	})
}

func (h *BudgetsHandler) sendSampleList(w http.ResponseWriter, counters map[string]int) {
	sample := []map[string]any{
		{
			"id":                  3,
			"numero_presupuesto":  "PRES-2026-0003",
			"fecha_emision":       "24/10/2026",
			"validez_dias":        15,
			"validez_fecha":       "08/11/2026",
			"estado":              "Aprobado",
			"cliente_nombre":      "Zunilda Ledesma",
			"cliente_ruc":         "727424",
			"cliente_telefono":    "+595986901117",
			"subtotal":            3275000,
			"subtotal_formateado": "3.275.000 Gs.",
			"monto_descuento":     75000,
			"total_final":         3200000,
			"total_formateado":    "3.200.000 Gs.",
			"items_count":         4,
			"items_resumen":       "10x Taza para Bebe, 10x Taza Especial Sublimada R1, 10x Taza Magica Sublimada 350ml, 15x Kepis",
		},
		{
			"id":                  2,
			"numero_presupuesto":  "PRES-2026-0002",
			"fecha_emision":       "20/10/2026",
			"validez_dias":        15,
			"validez_fecha":       "04/11/2026",
			"estado":              "Enviado",
			"cliente_nombre":      "Marcos Acosta",
			"cliente_ruc":         "4589622-1",
			"cliente_telefono":    "+595981234567",
			"subtotal":            850000,
			"subtotal_formateado": "850.000 Gs.",
			"monto_descuento":     0,
			"total_final":         850000,
			"total_formateado":    "850.000 Gs.",
			"items_count":         1,
			"items_resumen":       "1x Remera Personalizada Algodón",
		},
	}
	counters["total"] = len(sample)
	counters["aprobados"] = 1
	counters["enviados"] = 1

	_ = json.NewEncoder(w).Encode(map[string]any{
		"data":      sample,
		"counters":  counters,
		"total":     len(sample),
		"page":      1,
		"page_size": 20,
	})
}

// createBudget registra un nuevo presupuesto en la base de datos
func (h *BudgetsHandler) createBudget(w http.ResponseWriter, r *http.Request) {
	if h.DB == nil {
		auth.WriteJSONError(w, http.StatusServiceUnavailable, "base de datos no disponible")
		return
	}

	var req models.Budget
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		auth.WriteJSONError(w, http.StatusBadRequest, "cuerpo de solicitud inválido: "+err.Error())
		return
	}

	if strings.TrimSpace(req.ClienteNombre) == "" {
		auth.WriteJSONError(w, http.StatusBadRequest, "el nombre del cliente es obligatorio")
		return
	}

	tx, err := h.DB.BeginTx(r.Context(), nil)
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "error al iniciar transacción: "+err.Error())
		return
	}
	defer tx.Rollback()

	// Generar correlativo secuencial si no viene especificado
	if strings.TrimSpace(req.NumeroPresupuesto) == "" {
		var lastID int
		_ = tx.QueryRowContext(r.Context(), "SELECT COALESCE(MAX(id), 0) FROM presupuestos").Scan(&lastID)
		req.NumeroPresupuesto = fmt.Sprintf("PRES-%d-%04d", time.Now().Year(), lastID+1)
	}

	fechaEm := normalizeDate(req.FechaEmision)

	valDias := req.ValidezDias
	if valDias <= 0 {
		valDias = 15
	}
	valFecha := strings.TrimSpace(req.ValidezFecha)
	if valFecha == "" {
		t, err := time.Parse("2006-01-02", fechaEm)
		if err == nil {
			valFecha = t.AddDate(0, 0, valDias).Format("02/01/2006")
		} else {
			valFecha = fmt.Sprintf("%d días", valDias)
		}
	}

	estado := strings.TrimSpace(req.Estado)
	if estado == "" {
		estado = "Pendiente"
	}

	// Procesar imágenes base64 en ítems y en la galería para almacenar solo URLs cortas en el servidor
	for i := range req.Items {
		if strings.HasPrefix(req.Items[i].ImagenURL, "data:image/") {
			pfx := "item"
			if req.Items[i].Descripcion != "" {
				cleanDesc := strings.ToLower(strings.ReplaceAll(req.Items[i].Descripcion, " ", "_"))
				if len(cleanDesc) > 15 {
					cleanDesc = cleanDesc[:15]
				}
				pfx = cleanDesc
			}
			req.Items[i].ImagenURL = saveBase64Image(req.Items[i].ImagenURL, pfx)
		}
	}
	for i := range req.GaleriaFotos {
		if strings.HasPrefix(req.GaleriaFotos[i].URL, "data:image/") {
			pfx := "galeria"
			if req.GaleriaFotos[i].Nombre != "" {
				cleanNom := strings.ToLower(strings.ReplaceAll(req.GaleriaFotos[i].Nombre, " ", "_"))
				if len(cleanNom) > 15 {
					cleanNom = cleanNom[:15]
				}
				pfx = cleanNom
			}
			req.GaleriaFotos[i].URL = saveBase64Image(req.GaleriaFotos[i].URL, pfx)
		}
	}

	termJSON, _ := json.Marshal(req.TerminosCondiciones)
	servJSON, _ := json.Marshal(req.ServiciosOpcionales)
	galJSON, _ := json.Marshal(req.GaleriaFotos)

	userActive := r.Header.Get("X-User-Name")
	if userActive == "" {
		userActive = "Operador Ventas"
	}

	insertSQL := `
		INSERT INTO presupuestos (
			numero_presupuesto, fecha_emision, validez_dias, validez_fecha,
			moneda, regimen_iva, estado,
			cliente_id, cliente_casual, cliente_nombre, cliente_ruc, cliente_telefono, cliente_email, cliente_direccion,
			subtotal, porcentaje_descuento, monto_descuento, total_final,
			leyenda_descuento, mostrar_descuento_pdf,
			terminos_condiciones, observaciones, servicios_opcionales, galeria_fotos,
			mostrar_galeria_pdf, galeria_layout, created_by
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`

	res, err := tx.ExecContext(r.Context(), insertSQL,
		req.NumeroPresupuesto, fechaEm, valDias, valFecha,
		req.Moneda, req.RegimenIVA, estado,
		req.ClienteID, req.ClienteCasual, req.ClienteNombre, req.ClienteRUC, req.ClienteTelefono, req.ClienteEmail, req.ClienteDireccion,
		req.Subtotal, req.PorcentajeDescuento, req.MontoDescuento, req.TotalFinal,
		req.LeyendaDescuento, req.MostrarDescuentoPDF,
		termJSON, req.Observaciones, servJSON, galJSON,
		req.MostrarGaleriaPDF, req.GaleriaLayout, userActive,
	)
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "error al guardar presupuesto: "+err.Error())
		return
	}

	presupuestoID64, _ := res.LastInsertId()
	presupuestoID := int(presupuestoID64)

	// Guardar ítems
	itemInsertSQL := `
		INSERT INTO presupuesto_items (
			presupuesto_id, producto_id, es_no_registrado, sku, descripcion,
			precio_unitario, cantidad, total, imagen_url, orden,
			proveedor_id, proveedor_casual, proveedor_nombre, proveedor_costo, proveedor_cantidad
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`

	for idx, it := range req.Items {
		cant := it.Cantidad
		if cant <= 0 {
			cant = 1
		}
		tot := it.Total
		if tot <= 0 {
			tot = float64(cant) * it.PrecioUnitario
		}

		_, err := tx.ExecContext(r.Context(), itemInsertSQL,
			presupuestoID, it.ProductoID, it.EsNoRegistrado, it.SKU, it.Descripcion,
			it.PrecioUnitario, cant, tot, it.ImagenURL, idx,
			it.ProveedorID, it.ProveedorCasual, it.ProveedorNombre, it.ProveedorCosto, it.ProveedorCantidad,
		)
		if err != nil {
			auth.WriteJSONError(w, http.StatusInternalServerError, "error al guardar ítems del presupuesto: "+err.Error())
			return
		}
	}

	if err := tx.Commit(); err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "error al confirmar creación de presupuesto: "+err.Error())
		return
	}

	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"success":            true,
		"id":                 presupuestoID,
		"numero_presupuesto": req.NumeroPresupuesto,
		"message":            fmt.Sprintf("Presupuesto %s generado exitosamente", req.NumeroPresupuesto),
	})
}

// HandleItem maneja GET, PUT, PATCH, DELETE en /api/budgets/:id y subrutas
func (h *BudgetsHandler) HandleItem(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")

	path := strings.TrimPrefix(r.URL.Path, "/api/budgets/")
	parts := strings.Split(strings.Trim(path, "/"), "/")
	if len(parts) == 0 || parts[0] == "" {
		auth.WriteJSONError(w, http.StatusBadRequest, "identificador de presupuesto requerido")
		return
	}

	idOrNum := parts[0]

	// Subrutas de acción: /api/budgets/:id/convert-to-order
	if len(parts) > 1 {
		subAction := strings.ToLower(parts[1])
		switch subAction {
		case "convert-to-order":
			if r.Method == http.MethodPost {
				h.convertToOrder(w, r, idOrNum)
				return
			}
		case "status":
			if r.Method == http.MethodPatch || r.Method == http.MethodPost {
				h.updateStatus(w, r, idOrNum)
				return
			}
		case "restore":
			if r.Method == http.MethodPost {
				h.restoreBudget(w, r, idOrNum)
				return
			}
		}
		auth.WriteJSONError(w, http.StatusNotFound, "subruta no encontrada")
		return
	}

	switch r.Method {
	case http.MethodGet:
		h.getBudget(w, r, idOrNum)
	case http.MethodPut:
		h.updateBudget(w, r, idOrNum)
	case http.MethodPatch:
		h.updateStatus(w, r, idOrNum)
	case http.MethodDelete:
		h.deleteBudget(w, r, idOrNum)
	default:
		auth.WriteJSONError(w, http.StatusMethodNotAllowed, "método no permitido")
	}
}

// getBudget devuelve la información completa de un presupuesto
func (h *BudgetsHandler) getBudget(w http.ResponseWriter, r *http.Request, idOrNum string) {
	empresa := h.getEmpresaDatos(r)

	if h.DB != nil {
		if resp, found := h.fetchFromDB(r, idOrNum, empresa); found {
			_ = json.NewEncoder(w).Encode(resp)
			return
		}
	}

	resp := h.getDefaultSampleBudget(idOrNum, empresa)
	_ = json.NewEncoder(w).Encode(resp)
}

// updateBudget actualiza la cabecera e ítems del presupuesto
func (h *BudgetsHandler) updateBudget(w http.ResponseWriter, r *http.Request, idOrNum string) {
	if h.DB == nil {
		auth.WriteJSONError(w, http.StatusServiceUnavailable, "base de datos no disponible")
		return
	}

	idNum, _ := strconv.Atoi(idOrNum)

	var req models.Budget
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		auth.WriteJSONError(w, http.StatusBadRequest, "cuerpo de solicitud inválido")
		return
	}

	tx, err := h.DB.BeginTx(r.Context(), nil)
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "error al iniciar transacción: "+err.Error())
		return
	}
	defer tx.Rollback()

	// Procesar imágenes base64 en ítems y en la galería para almacenar solo URLs cortas en el servidor
	for i := range req.Items {
		if strings.HasPrefix(req.Items[i].ImagenURL, "data:image/") {
			pfx := "item"
			if req.Items[i].Descripcion != "" {
				cleanDesc := strings.ToLower(strings.ReplaceAll(req.Items[i].Descripcion, " ", "_"))
				if len(cleanDesc) > 15 {
					cleanDesc = cleanDesc[:15]
				}
				pfx = cleanDesc
			}
			req.Items[i].ImagenURL = saveBase64Image(req.Items[i].ImagenURL, pfx)
		}
	}
	for i := range req.GaleriaFotos {
		if strings.HasPrefix(req.GaleriaFotos[i].URL, "data:image/") {
			pfx := "galeria"
			if req.GaleriaFotos[i].Nombre != "" {
				cleanNom := strings.ToLower(strings.ReplaceAll(req.GaleriaFotos[i].Nombre, " ", "_"))
				if len(cleanNom) > 15 {
					cleanNom = cleanNom[:15]
				}
				pfx = cleanNom
			}
			req.GaleriaFotos[i].URL = saveBase64Image(req.GaleriaFotos[i].URL, pfx)
		}
	}

	termJSON, _ := json.Marshal(req.TerminosCondiciones)
	servJSON, _ := json.Marshal(req.ServiciosOpcionales)
	galJSON, _ := json.Marshal(req.GaleriaFotos)

	fechaEm := normalizeDate(req.FechaEmision)

	updateSQL := `
		UPDATE presupuestos SET
			fecha_emision = ?, validez_dias = ?, validez_fecha = ?,
			moneda = ?, regimen_iva = ?, estado = ?,
			cliente_id = ?, cliente_casual = ?, cliente_nombre = ?, cliente_ruc = ?, cliente_telefono = ?, cliente_email = ?, cliente_direccion = ?,
			subtotal = ?, porcentaje_descuento = ?, monto_descuento = ?, total_final = ?,
			leyenda_descuento = ?, mostrar_descuento_pdf = ?,
			terminos_condiciones = ?, observaciones = ?, servicios_opcionales = ?, galeria_fotos = ?,
			mostrar_galeria_pdf = ?, galeria_layout = ?
		WHERE (id = ? OR numero_presupuesto = ?) AND deleted_at IS NULL
	`

	_, err = tx.ExecContext(r.Context(), updateSQL,
		fechaEm, req.ValidezDias, req.ValidezFecha,
		req.Moneda, req.RegimenIVA, req.Estado,
		req.ClienteID, req.ClienteCasual, req.ClienteNombre, req.ClienteRUC, req.ClienteTelefono, req.ClienteEmail, req.ClienteDireccion,
		req.Subtotal, req.PorcentajeDescuento, req.MontoDescuento, req.TotalFinal,
		req.LeyendaDescuento, req.MostrarDescuentoPDF,
		termJSON, req.Observaciones, servJSON, galJSON,
		req.MostrarGaleriaPDF, req.GaleriaLayout,
		idNum, idOrNum,
	)
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "error al actualizar presupuesto: "+err.Error())
		return
	}

	// Obtener ID numérico real
	var realID int
	_ = tx.QueryRowContext(r.Context(), "SELECT id FROM presupuestos WHERE (id = ? OR numero_presupuesto = ?)", idNum, idOrNum).Scan(&realID)

	// Reemplazar ítems
	_, _ = tx.ExecContext(r.Context(), "DELETE FROM presupuesto_items WHERE presupuesto_id = ?", realID)

	itemInsertSQL := `
		INSERT INTO presupuesto_items (
			presupuesto_id, producto_id, es_no_registrado, sku, descripcion,
			precio_unitario, cantidad, total, imagen_url, orden,
			proveedor_id, proveedor_casual, proveedor_nombre, proveedor_costo, proveedor_cantidad
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	for idx, it := range req.Items {
		cant := it.Cantidad
		if cant <= 0 {
			cant = 1
		}
		tot := it.Total
		if tot <= 0 {
			tot = float64(cant) * it.PrecioUnitario
		}
		_, err := tx.ExecContext(r.Context(), itemInsertSQL,
			realID, it.ProductoID, it.EsNoRegistrado, it.SKU, it.Descripcion,
			it.PrecioUnitario, cant, tot, it.ImagenURL, idx,
			it.ProveedorID, it.ProveedorCasual, it.ProveedorNombre, it.ProveedorCosto, it.ProveedorCantidad,
		)
		if err != nil {
			auth.WriteJSONError(w, http.StatusInternalServerError, "error al actualizar ítems: "+err.Error())
			return
		}
	}

	if err := tx.Commit(); err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "error al confirmar actualización: "+err.Error())
		return
	}

	_ = json.NewEncoder(w).Encode(map[string]any{
		"success": true,
		"message": "Presupuesto actualizado correctamente",
	})
}

// updateStatus cambia únicamente el estado de un presupuesto
func (h *BudgetsHandler) updateStatus(w http.ResponseWriter, r *http.Request, idOrNum string) {
	if h.DB == nil {
		auth.WriteJSONError(w, http.StatusServiceUnavailable, "base de datos no disponible")
		return
	}

	var req struct {
		Estado string `json:"estado"`
		Motivo string `json:"motivo,omitempty"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)

	if req.Estado == "" {
		auth.WriteJSONError(w, http.StatusBadRequest, "el estado es obligatorio")
		return
	}

	idNum, _ := strconv.Atoi(idOrNum)
	_, err := h.DB.ExecContext(r.Context(), `
		UPDATE presupuestos 
		SET estado = ? 
		WHERE (id = ? OR numero_presupuesto = ?) AND deleted_at IS NULL
	`, req.Estado, idNum, idOrNum)

	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "error al cambiar estado: "+err.Error())
		return
	}

	_ = json.NewEncoder(w).Encode(map[string]any{
		"success": true,
		"estado":  req.Estado,
		"message": fmt.Sprintf("Estado del presupuesto actualizado a '%s'", req.Estado),
	})
}

// convertToOrder convierte un presupuesto Aprobado directamente en un Pedido oficial
func (h *BudgetsHandler) convertToOrder(w http.ResponseWriter, r *http.Request, idOrNum string) {
	if h.DB == nil {
		auth.WriteJSONError(w, http.StatusServiceUnavailable, "base de datos no disponible")
		return
	}

	idNum, _ := strconv.Atoi(idOrNum)

	tx, err := h.DB.BeginTx(r.Context(), nil)
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "error al iniciar transacción: "+err.Error())
		return
	}
	defer tx.Rollback()

	// 1. Obtener datos del presupuesto
	var (
		bID, cliCasual, pedidoExistente                  int
		cliID                                            sql.NullInt64
		numPres, fechaEm, cliNom, cliRuc, cliTel, cliDir string
		subtotal, descMonto, totalFinal                  float64
		observaciones                                    sql.NullString
	)

	err = tx.QueryRowContext(r.Context(), `
		SELECT id, numero_presupuesto, fecha_emision, cliente_id, cliente_casual,
		       cliente_nombre, COALESCE(cliente_ruc, ''), COALESCE(cliente_telefono, ''), COALESCE(cliente_direccion, ''),
		       subtotal, monto_descuento, total_final, observaciones, COALESCE(pedido_id, 0)
		FROM presupuestos
		WHERE (id = ? OR numero_presupuesto = ?) AND deleted_at IS NULL
		LIMIT 1
	`, idNum, idOrNum).Scan(
		&bID, &numPres, &fechaEm, &cliID, &cliCasual,
		&cliNom, &cliRuc, &cliTel, &cliDir,
		&subtotal, &descMonto, &totalFinal, &observaciones, &pedidoExistente,
	)

	if err != nil {
		auth.WriteJSONError(w, http.StatusNotFound, "presupuesto no encontrado")
		return
	}

	// Si ya fue convertido a pedido, retornar el existente
	if pedidoExistente > 0 {
		var existingNum string
		_ = tx.QueryRowContext(r.Context(), "SELECT numero_pedido FROM pedidos WHERE id = ?", pedidoExistente).Scan(&existingNum)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"success":       true,
			"pedido_id":     pedidoExistente,
			"numero_pedido": existingNum,
			"message":       fmt.Sprintf("El presupuesto ya tiene el pedido vinculado %s", existingNum),
		})
		return
	}

	// 2. Generar número correlativo de pedido PED-00000X
	var lastOrderID int
	_ = tx.QueryRowContext(r.Context(), "SELECT COALESCE(MAX(id), 0) FROM pedidos").Scan(&lastOrderID)
	nextOrderNum := lastOrderID + 1
	numeroPedido := fmt.Sprintf("PED-%06d", nextOrderNum)

	now := time.Now()
	_, currentWeek := now.ISOWeek()
	currentYear := now.Year()

	var clientIDVal *int
	if cliID.Valid && cliCasual == 0 {
		v := int(cliID.Int64)
		clientIDVal = &v
	}

	// Obtener documento real del cliente (si es persona física y no tiene RUC, usar Número de Documento / CI)
	docCliente := cliRuc
	if clientIDVal != nil {
		var tCli, numDoc, ruc, rucB string
		if errC := tx.QueryRowContext(r.Context(), "SELECT COALESCE(tipo_cliente, ''), COALESCE(numero_documento, ''), COALESCE(ruc, ''), COALESCE(ruc_base, '') FROM clientes WHERE id = ?", *clientIDVal).Scan(&tCli, &numDoc, &ruc, &rucB); errC == nil {
			ruc = strings.TrimSpace(ruc)
			numDoc = strings.TrimSpace(numDoc)
			rucB = strings.TrimSpace(rucB)
			if tCli == "empresa" {
				if ruc != "" {
					docCliente = ruc
				} else if rucB != "" {
					docCliente = rucB
				} else if numDoc != "" {
					docCliente = numDoc
				}
			} else {
				// Persona física: tomar el Número de documento (CI) si está disponible
				if numDoc != "" {
					docCliente = numDoc
				} else if ruc != "" {
					docCliente = ruc
				}
			}
		}
	}

	notas := fmt.Sprintf("Generado automáticamente desde Presupuesto %s.", numPres)
	if observaciones.Valid && strings.TrimSpace(observaciones.String) != "" {
		notas += " Notas: " + observaciones.String
	}

	// 3. Insertar pedido en la tabla `pedidos`
	insertOrderSQL := `
		INSERT INTO pedidos (
			numero_pedido, cliente_id, cliente_casual, cliente_nombre,
			cliente_telefono, cliente_documento, cliente_direccion,
			condicion_venta, fecha_pedido, tipo_pago, fecha_cobro,
			monto_total, monto_pagado, saldo_pendiente,
			modalidad_entrega, modalidad_entrega_otro,
			estado, historial_estados, semana_iso, anio_iso, notas_produccion
		) VALUES (?, ?, ?, ?, ?, ?, ?, 'Contado', DATE_FORMAT(NOW(), '%Y-%m-%d'), NULL, DATE_FORMAT(NOW(), '%Y-%m-%d'), ?, 0, ?, 'Retiro en Local', '', 'Creado', JSON_ARRAY(JSON_OBJECT('estado', 'Creado', 'fecha', DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s'))), ?, ?, ?)
	`

	resOrder, err := tx.ExecContext(r.Context(), insertOrderSQL,
		numeroPedido, clientIDVal, cliCasual, cliNom,
		cliTel, docCliente, cliDir,
		totalFinal, totalFinal,
		currentWeek, currentYear, notas,
	)
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "error al crear pedido: "+err.Error())
		return
	}

	pedidoID64, _ := resOrder.LastInsertId()
	nuevoPedidoID := int(pedidoID64)

	// 4. Copiar ítems del presupuesto a `pedido_items` y `pedido_proveedores`
	type budgetItemConversion struct {
		ProductoID        *int
		EsNoRegistrado     int
		SKU                string
		Descripcion        string
		PrecioUnitario     float64
		Cantidad           int
		Total              float64
		ProveedorID        *int
		ProveedorCasual    int
		ProveedorNombre    string
		ProveedorCosto     float64
		ProveedorCantidad  int
	}

	itemRows, err := tx.QueryContext(r.Context(), `
		SELECT producto_id, es_no_registrado, COALESCE(sku, ''), descripcion, precio_unitario, cantidad, total,
		       proveedor_id, COALESCE(proveedor_casual, 0), COALESCE(proveedor_nombre, ''), COALESCE(proveedor_costo, 0), COALESCE(proveedor_cantidad, 0)
		FROM presupuesto_items
		WHERE presupuesto_id = ?
		ORDER BY orden ASC, id ASC
	`, bID)
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "error al leer ítems del presupuesto: "+err.Error())
		return
	}

	var itemsToConvert []budgetItemConversion
	for itemRows.Next() {
		var (
			pID, provID                         sql.NullInt64
			esNoReg, provCasual, cant, provCant int
			sku, desc, provNom                  string
			pu, tot, provCosto                  float64
		)
		if scanErr := itemRows.Scan(
			&pID, &esNoReg, &sku, &desc, &pu, &cant, &tot,
			&provID, &provCasual, &provNom, &provCosto, &provCant,
		); scanErr == nil {
			var prodIDPtr *int
			if pID.Valid {
				v := int(pID.Int64)
				prodIDPtr = &v
			}
			var provIDPtr *int
			if provID.Valid {
				v := int(provID.Int64)
				provIDPtr = &v
			}
			itemsToConvert = append(itemsToConvert, budgetItemConversion{
				ProductoID:        prodIDPtr,
				EsNoRegistrado:    esNoReg,
				SKU:               sku,
				Descripcion:       desc,
				PrecioUnitario:    pu,
				Cantidad:          cant,
				Total:             tot,
				ProveedorID:       provIDPtr,
				ProveedorCasual:   provCasual,
				ProveedorNombre:   provNom,
				ProveedorCosto:    provCosto,
				ProveedorCantidad: provCant,
			})
		}
	}
	itemRows.Close() // Cerrar inmediatamente para liberar la conexión de la transacción

	insertItemSQL := `
		INSERT INTO pedido_items (
			pedido_id, producto_id, es_no_registrado, nombre_producto, sku, cantidad, precio_unitario, subtotal
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`

	insertProvSQL := `
		INSERT INTO pedido_proveedores (
			pedido_id, proveedor_id, es_no_registrado, nombre_proveedor,
			producto_id, producto_nombre,
			cantidad, costo, subtotal,
			estado_pago, monto_pagado, saldo_pendiente
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pendiente', 0, ?)
	`

	insertPagoSQL := `
		INSERT INTO pagos (
			numero_pago, pedido_id, pedido_proveedor_id, tipo_beneficiario,
			proveedor_id, proveedor_nombre, proveedor_ruc, es_proveedor_temporal,
			cliente_id, cliente_nombre, cliente_documento, cliente_telefono,
			producto_id, producto_nombre, es_producto_temporal,
			cantidad, monto_total, monto_pagado, saldo_pendiente,
			estado_pago, metodo_pago, fecha_pago, semana_iso, anio_iso,
			notas, created_by
		) VALUES (?, ?, ?, 'Proveedor', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'Pendiente', 'Efectivo', ?, ?, ?, ?, ?)
	`

	var lastPagoID int
	_ = tx.QueryRowContext(r.Context(), "SELECT COALESCE(MAX(id), 0) FROM pagos").Scan(&lastPagoID)

	for _, it := range itemsToConvert {
		_, errItem := tx.ExecContext(r.Context(), insertItemSQL,
			nuevoPedidoID, it.ProductoID, it.EsNoRegistrado, it.Descripcion, it.SKU, it.Cantidad, it.PrecioUnitario, it.Total,
		)
		if errItem != nil {
			log.Printf("[Budgets] Error al insertar pedido_item: %v", errItem)
		}

		// Si el ítem tiene proveedor asociado o costo de compra
		hasProvider := it.ProveedorID != nil || strings.TrimSpace(it.ProveedorNombre) != "" || it.ProveedorCosto > 0
		if hasProvider {
			pCant := it.ProveedorCantidad
			if pCant <= 0 {
				pCant = it.Cantidad
			}
			pSubt := float64(pCant) * it.ProveedorCosto

			var provRUC string
			provNom := strings.TrimSpace(it.ProveedorNombre)
			if it.ProveedorID != nil && *it.ProveedorID > 0 {
				var rucDoc, rz, nc string
				_ = tx.QueryRowContext(r.Context(), "SELECT COALESCE(ruc_documento, ''), COALESCE(razon_social, ''), COALESCE(nombre_comercial, '') FROM proveedores WHERE id = ?", *it.ProveedorID).Scan(&rucDoc, &rz, &nc)
				provRUC = rucDoc
				if provNom == "" {
					if rz != "" {
						provNom = rz
					} else {
						provNom = nc
					}
				}
			}
			if provNom == "" {
				provNom = "Proveedor Asignado"
			}

			resProv, errProv := tx.ExecContext(r.Context(), insertProvSQL,
				nuevoPedidoID, it.ProveedorID, it.ProveedorCasual, provNom,
				it.ProductoID, it.Descripcion,
				pCant, it.ProveedorCosto, pSubt, pSubt,
			)
			if errProv == nil {
				ppID64, _ := resProv.LastInsertId()
				ppID := int(ppID64)

				lastPagoID++
				numPago := fmt.Sprintf("PAG-%06d", lastPagoID)

				notes := fmt.Sprintf("Generado automáticamente desde Presupuesto %s (Pedido %s)", numPres, numeroPedido)
				fechaHoyStr := now.Format("2006-01-02")
				_, errPago := tx.ExecContext(r.Context(), insertPagoSQL,
					numPago, nuevoPedidoID, ppID,
					it.ProveedorID, provNom, provRUC, it.ProveedorCasual,
					clientIDVal, cliNom, docCliente, cliTel,
					it.ProductoID, it.Descripcion, it.EsNoRegistrado,
					pCant, pSubt, pSubt,
					fechaHoyStr, currentWeek, currentYear,
					notes, h.getActorName(r),
				)
				if errPago != nil {
					log.Printf("[Budgets] Error al insertar pago para proveedor: %v", errPago)
				}
			} else {
				log.Printf("[Budgets] Error al insertar pedido_proveedor: %v", errProv)
			}
		}
	}

	// 5. Actualizar estado del presupuesto a "Aprobado", guardar pedido_id y sincronizar documento
	_, err = tx.ExecContext(r.Context(), `
		UPDATE presupuestos 
		SET estado = 'Aprobado', pedido_id = ?, cliente_ruc = ?
		WHERE id = ?
	`, nuevoPedidoID, docCliente, bID)

	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "error al actualizar presupuesto: "+err.Error())
		return
	}

	if err := tx.Commit(); err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "error al confirmar pedido: "+err.Error())
		return
	}

	_ = json.NewEncoder(w).Encode(map[string]any{
		"success":       true,
		"pedido_id":     nuevoPedidoID,
		"numero_pedido": numeroPedido,
		"message":       fmt.Sprintf("Presupuesto %s aprobado con éxito. Se generó el Pedido %s.", numPres, numeroPedido),
	})
}

// deleteBudget realiza un borrado lógico (soft-delete) hacia Reciclaje
func (h *BudgetsHandler) deleteBudget(w http.ResponseWriter, r *http.Request, idOrNum string) {
	if h.DB == nil {
		auth.WriteJSONError(w, http.StatusServiceUnavailable, "base de datos no disponible")
		return
	}

	userActive := r.Header.Get("X-User-Name")
	if userActive == "" {
		userActive = "Operador Ventas"
	}

	idNum, _ := strconv.Atoi(idOrNum)
	_, err := h.DB.ExecContext(r.Context(), `
		UPDATE presupuestos 
		SET deleted_at = NOW(), deleted_by = ? 
		WHERE (id = ? OR numero_presupuesto = ?) AND deleted_at IS NULL
	`, userActive, idNum, idOrNum)

	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "error al eliminar presupuesto: "+err.Error())
		return
	}

	_ = json.NewEncoder(w).Encode(map[string]any{
		"success": true,
		"message": "Presupuesto enviado al módulo de Reciclaje",
	})
}

// restoreBudget restaura un presupuesto eliminado
func (h *BudgetsHandler) restoreBudget(w http.ResponseWriter, r *http.Request, idOrNum string) {
	if h.DB == nil {
		auth.WriteJSONError(w, http.StatusServiceUnavailable, "base de datos no disponible")
		return
	}

	idNum, _ := strconv.Atoi(idOrNum)
	_, err := h.DB.ExecContext(r.Context(), `
		UPDATE presupuestos 
		SET deleted_at = NULL, deleted_by = NULL 
		WHERE id = ? OR numero_presupuesto = ?
	`, idNum, idOrNum)

	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "error al restaurar presupuesto: "+err.Error())
		return
	}

	_ = json.NewEncoder(w).Encode(map[string]any{
		"success": true,
		"message": "Presupuesto restaurado exitosamente",
	})
}

func (h *BudgetsHandler) fetchFromDB(r *http.Request, idOrNum string, empresa models.BudgetEmpresaDTO) (models.BudgetResponse, bool) {
	var b models.BudgetResponse
	var bID, validezDias, cliCasual, mostrarDesc, mostrarGal, pedidoID int
	var numPres, fechaEm, valFecha, estado, moneda, regIVA string
	var cliNom, cliRuc, cliTel, cliEmail, cliDir string
	var subtotal, descPct, descMonto, totalFinal float64
	var leyendaDesc, observaciones, galLayout string
	var termJSON, servJSON, galJSON sql.NullString
	var cliID sql.NullInt64

	query := `
		SELECT id, numero_presupuesto, DATE_FORMAT(fecha_emision, '%d/%m/%Y') AS fecha_emision,
		       validez_dias, COALESCE(validez_fecha, '') AS validez_fecha,
		       COALESCE(moneda, 'Gs.'), COALESCE(regimen_iva, 'Exento de IVA'), estado,
		       cliente_id, COALESCE(cliente_casual, 0),
		       cliente_nombre, COALESCE(cliente_ruc, ''), COALESCE(cliente_telefono, ''),
		       COALESCE(cliente_email, ''), COALESCE(cliente_direccion, ''),
		       subtotal, porcentaje_descuento, monto_descuento, total_final,
		       COALESCE(leyenda_descuento, ''), COALESCE(mostrar_descuento_pdf, 1),
		       terminos_condiciones, COALESCE(observaciones, ''),
		       servicios_opcionales, galeria_fotos,
		       COALESCE(mostrar_galeria_pdf, 1), COALESCE(galeria_layout, '2x3'),
		       COALESCE(pedido_id, 0)
		FROM presupuestos
		WHERE (id = ? OR numero_presupuesto = ?) AND deleted_at IS NULL
		LIMIT 1
	`
	idNum, _ := strconv.Atoi(idOrNum)
	err := h.DB.QueryRowContext(r.Context(), query, idNum, idOrNum).Scan(
		&bID, &numPres, &fechaEm,
		&validezDias, &valFecha,
		&moneda, &regIVA, &estado,
		&cliID, &cliCasual,
		&cliNom, &cliRuc, &cliTel,
		&cliEmail, &cliDir,
		&subtotal, &descPct, &descMonto, &totalFinal,
		&leyendaDesc, &mostrarDesc,
		&termJSON, &observaciones,
		&servJSON, &galJSON,
		&mostrarGal, &galLayout,
		&pedidoID,
	)
	if err != nil {
		return b, false
	}

	b.ID = bID
	b.NumeroPresupuesto = numPres
	b.FechaEmision = fechaEm
	b.ValidezDias = validezDias
	b.ValidezFecha = valFecha
	b.Moneda = moneda
	b.RegimenIVA = regIVA
	b.Estado = estado
	b.Observaciones = observaciones
	b.GaleriaLayout = galLayout
	b.MostrarGaleriaPDF = mostrarGal == 1

	if pedidoID > 0 {
		b.PedidoID = &pedidoID
		var numPed string
		_ = h.DB.QueryRowContext(r.Context(), "SELECT numero_pedido FROM pedidos WHERE id = ?", pedidoID).Scan(&numPed)
		b.NumeroPedido = numPed
	}

	var cID *int
	docCliente := cliRuc
	if cliID.Valid {
		v := int(cliID.Int64)
		cID = &v
		if cliCasual == 0 {
			var tCli, numDoc, ruc, rucB string
			if errC := h.DB.QueryRowContext(r.Context(), "SELECT COALESCE(tipo_cliente, ''), COALESCE(numero_documento, ''), COALESCE(ruc, ''), COALESCE(ruc_base, '') FROM clientes WHERE id = ?", v).Scan(&tCli, &numDoc, &ruc, &rucB); errC == nil {
				ruc = strings.TrimSpace(ruc)
				numDoc = strings.TrimSpace(numDoc)
				rucB = strings.TrimSpace(rucB)
				if tCli == "empresa" {
					if ruc != "" {
						docCliente = ruc
					} else if rucB != "" {
						docCliente = rucB
					} else if numDoc != "" {
						docCliente = numDoc
					}
				} else {
					// Persona física: tomar el Número de documento (CI) si está disponible
					if numDoc != "" {
						docCliente = numDoc
					} else if ruc != "" {
						docCliente = ruc
					}
				}
			}
		}
	}
	b.Cliente = models.BudgetClienteDTO{
		ID:        cID,
		Casual:    cliCasual == 1,
		Nombre:    cliNom,
		RUC:       docCliente,
		Telefono:  cliTel,
		Email:     cliEmail,
		Direccion: cliDir,
	}

	// Consultar ítems con proveedores
	itemRows, err := h.DB.QueryContext(r.Context(), `
		SELECT id, producto_id, COALESCE(es_no_registrado, 0), COALESCE(sku, ''), descripcion,
		       precio_unitario, cantidad, total, IFNULL(imagen_url, ''), orden,
		       proveedor_id, COALESCE(proveedor_casual, 0), COALESCE(proveedor_nombre, ''),
		       COALESCE(proveedor_costo, 0), COALESCE(proveedor_cantidad, 0)
		FROM presupuesto_items
		WHERE presupuesto_id = ?
		ORDER BY orden ASC, id ASC
	`, bID)
	if err == nil {
		defer itemRows.Close()
		for itemRows.Next() {
			var itID, cant, orden, esNoReg, provCasual, provCant int
			var prodID, provID sql.NullInt64
			var desc, imgURL, sku, provNom string
			var pu, tot, provCosto float64
			if itemRows.Scan(
				&itID, &prodID, &esNoReg, &sku, &desc,
				&pu, &cant, &tot, &imgURL, &orden,
				&provID, &provCasual, &provNom, &provCosto, &provCant,
			) == nil {
				var pIDPtr *int
				if prodID.Valid {
					v := int(prodID.Int64)
					pIDPtr = &v
				}
				var prIDPtr *int
				if provID.Valid {
					v := int(provID.Int64)
					prIDPtr = &v
				}

				b.Items = append(b.Items, models.BudgetItem{
					ID:                 itID,
					PresupuestoID:      bID,
					ProductoID:         pIDPtr,
					EsNoRegistrado:     esNoReg == 1,
					SKU:                sku,
					Descripcion:        desc,
					PrecioUnitario:     pu,
					PrecioUnitarioForm: formatGs(pu),
					Cantidad:           cant,
					Total:              tot,
					TotalFormateado:    formatGs(tot),
					ImagenURL:          imgURL,
					Orden:              orden,
					ProveedorID:        prIDPtr,
					ProveedorCasual:    provCasual == 1,
					ProveedorNombre:    provNom,
					ProveedorCosto:     provCosto,
					ProveedorCantidad:  provCant,
				})
			}
		}
	}

	// Deserializar servicios opcionales
	if servJSON.Valid && servJSON.String != "" {
		_ = json.Unmarshal([]byte(servJSON.String), &b.ServiciosOpcionales)
	}

	// Deserializar fotos de galería
	if galJSON.Valid && galJSON.String != "" {
		var gf []models.BudgetGaleriaFoto
		if json.Unmarshal([]byte(galJSON.String), &gf) == nil {
			for _, f := range gf {
				b.ImagenesProductos = append(b.ImagenesProductos, models.BudgetProductoFotoDTO{
					ID:      f.ID,
					Nombre:  f.Nombre,
					URL:     f.URL,
					Visible: f.Visible,
					Orden:   f.Orden,
				})
			}
		}
	}

	// Si no hay fotos en galJSON, usar miniaturas de los ítems
	if len(b.ImagenesProductos) == 0 {
		for _, it := range b.Items {
			if it.ImagenURL != "" {
				b.ImagenesProductos = append(b.ImagenesProductos, models.BudgetProductoFotoDTO{
					Nombre:  it.Descripcion,
					URL:     it.ImagenURL,
					Visible: true,
				})
			}
		}
	}

	// Totales
	b.Totales = models.BudgetTotalesDTO{
		Subtotal:                subtotal,
		SubtotalFormateado:      formatGs(subtotal),
		PorcentajeDescuento:     descPct,
		MontoDescuento:          descMonto,
		MontoDescuentoFormatead: "- " + formatGs(descMonto),
		TotalFinal:              totalFinal,
		TotalFinalFormateado:    formatGs(totalFinal),
		LeyendaDescuento:        leyendaDesc,
		MostrarDescuentoPDF:     mostrarDesc == 1,
	}

	// Términos
	if termJSON.Valid && termJSON.String != "" {
		_ = json.Unmarshal([]byte(termJSON.String), &b.TerminosCondiciones)
	}
	if len(b.TerminosCondiciones) == 0 {
		b.TerminosCondiciones = []string{
			"1. Validez de la oferta: Este presupuesto tiene una validez de 15 días corridos a partir de su fecha de emisión.",
			"2. Condiciones de pago: El pedido se confirma con la entrega del 60%, por medio de efectivo o transferencia bancaria.",
			"3. Plazos de entrega: Tiempo estimado de 3 a 5 días hábiles posterior a la aprobación del diseño y confirmación de seña.",
			"4. Garantía y cambios: Tratándose de artículos personalizados, no se admiten cancelaciones una vez iniciada la producción.",
		}
	}

	b.Empresa = empresa
	return b, true
}

func (h *BudgetsHandler) getDefaultSampleBudget(idStr string, empresa models.BudgetEmpresaDTO) models.BudgetResponse {
	num := "PRES-2026-0003"
	if strings.HasPrefix(strings.ToUpper(idStr), "PRES-") {
		num = strings.ToUpper(idStr)
	}

	return models.BudgetResponse{
		ID:                3,
		NumeroPresupuesto: num,
		FechaEmision:      "24/10/2026",
		ValidezDias:       15,
		ValidezFecha:      "08/11/2026 (15 días)",
		Estado:            "Aprobado",
		Moneda:            "Gs.",
		RegimenIVA:        "Exento de IVA",
		Cliente: models.BudgetClienteDTO{
			Nombre:    "Zunilda Ledesma",
			RUC:       "727424",
			Telefono:  "+595986901117",
			Email:     "zunilda@example.com",
			Ciudad:    "Presidente Franco",
			Direccion: "Presidente Franco, Paraguay",
		},
		Items: []models.BudgetItem{
			{
				ID:                 1,
				Descripcion:        "Taza para Bebe",
				PrecioUnitario:     50000,
				PrecioUnitarioForm: "50.000 Gs.",
				Cantidad:           10,
				Total:              500000,
				TotalFormateado:    "500.000 Gs.",
				ImagenURL:          "/logo/R1.png",
			},
			{
				ID:                 2,
				Descripcion:        "Taza Especial Sublimada R1",
				PrecioUnitario:     150000,
				PrecioUnitarioForm: "150.000 Gs.",
				Cantidad:           10,
				Total:              1500000,
				TotalFormateado:    "1.500.000 Gs.",
				ImagenURL:          "/logo/R1.png",
			},
			{
				ID:                 3,
				Descripcion:        "Taza Magica Sublimada 350ml",
				PrecioUnitario:     45000,
				PrecioUnitarioForm: "45.000 Gs.",
				Cantidad:           10,
				Total:              450000,
				TotalFormateado:    "450.000 Gs.",
				ImagenURL:          "/logo/R1.png",
			},
			{
				ID:                 4,
				Descripcion:        "Kepis",
				PrecioUnitario:     55000,
				PrecioUnitarioForm: "55.000 Gs.",
				Cantidad:           15,
				Total:              825000,
				TotalFormateado:    "825.000 Gs.",
				ImagenURL:          "/logo/R1.png",
			},
		},
		Totales: models.BudgetTotalesDTO{
			Subtotal:                3275000,
			SubtotalFormateado:      "3.275.000 Gs.",
			PorcentajeDescuento:     2.3,
			MontoDescuento:          75000,
			MontoDescuentoFormatead: "- 75.000 Gs.",
			TotalFinal:              3200000,
			TotalFinalFormateado:    "3.200.000 Gs.",
			LeyendaDescuento:        "¡10% DE DESCUENTO POR PAGO AL CONTADO!",
			MostrarDescuentoPDF:     true,
		},
		TerminosCondiciones: []string{
			"1. Validez de la oferta: Este presupuesto tiene una validez de 15 días corridos a partir de su fecha de emisión.",
			"2. Condiciones de pago: El pedido se confirma con la entrega del 60%, por medio de efectivo o transferencia bancaria.",
			"3. Plazos de entrega: Tiempo estimado de 3 a 5 días hábiles posterior a la aprobación del diseño y confirmación de seña.",
			"4. Garantía y cambios: Tratándose de artículos personalizados, no se admiten cancelaciones una vez iniciada la producción.",
		},
		ImagenesProductos: []models.BudgetProductoFotoDTO{
			{Nombre: "Taza para Bebe", URL: "/logo/R1.png", Visible: true},
			{Nombre: "Taza Especial Sublimada R1", URL: "/logo/R1.png", Visible: true},
			{Nombre: "Taza Magica Sublimada 350ml", URL: "/logo/R1.png", Visible: true},
			{Nombre: "Kepis", URL: "/logo/R1.png", Visible: true},
		},
		MostrarGaleriaPDF: true,
		GaleriaLayout:     "2x3",
		Empresa:           empresa,
	}
}

func (h *BudgetsHandler) getEmpresaDatos(r *http.Request) models.BudgetEmpresaDTO {
	emp := models.BudgetEmpresaDTO{
		LogoURL:     "/logo/R1.png",
		RazonSocial: "R1 Personalizados",
		RUC:         "00012345-0",
		Telefonos:   []string{"+595 981 654321"},
		Direccion:   "Pdte Franco, Paraguay",
		SitioWeb:    "netz.com.py",
		Redes: map[string]string{
			"instagram": "instagram.com/r1personalizados",
			"facebook":  "facebook.com/r1personalizados",
			"tiktok":    "tiktok.com/@r1personalizados",
			"sitio_web": "netz.com.py",
		},
	}

	if h.DB == nil {
		return emp
	}

	var raw string
	err := h.DB.QueryRowContext(r.Context(), "SELECT valor FROM configuraciones WHERE clave = 'empresa_datos'").Scan(&raw)
	if err == nil && raw != "" {
		var d struct {
			LogoURL     string            `json:"logo_url"`
			RazonSocial string            `json:"razon_social"`
			RUC         string            `json:"ruc"`
			Telefonos   []string          `json:"telefonos"`
			Direccion   string            `json:"direccion"`
			Redes       map[string]string `json:"redes"`
		}
		if json.Unmarshal([]byte(raw), &d) == nil {
			if d.LogoURL != "" {
				emp.LogoURL = d.LogoURL
			}
			if d.RazonSocial != "" {
				emp.RazonSocial = d.RazonSocial
			}
			if d.RUC != "" {
				emp.RUC = d.RUC
			}
			if len(d.Telefonos) > 0 {
				emp.Telefonos = d.Telefonos
			}
			if d.Direccion != "" {
				emp.Direccion = d.Direccion
			}
			if len(d.Redes) > 0 {
				emp.Redes = d.Redes
			}
		}
	}
	return emp
}

func formatGs(val float64) string {
	intVal := int64(val)
	str := strconv.FormatInt(intVal, 10)
	var result []byte
	n := len(str)
	for i := 0; i < n; i++ {
		if i > 0 && (n-i)%3 == 0 {
			result = append(result, '.')
		}
		result = append(result, str[i])
	}
	return string(result) + " Gs."
}
