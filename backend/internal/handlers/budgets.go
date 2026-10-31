package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"r1/backend/internal/auth"
	"r1/backend/internal/models"
)

type BudgetsHandler struct {
	DB *sql.DB
}

func NewBudgetsHandler(dbConn *sql.DB) *BudgetsHandler {
	return &BudgetsHandler{DB: dbConn}
}

// HandleCollection maneja GET /api/budgets
func (h *BudgetsHandler) HandleCollection(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		auth.WriteJSONError(w, http.StatusMethodNotAllowed, "método no permitido")
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")

	// Si existe la tabla presupuestos, consultar registros activos
	if h.DB != nil {
		rows, err := h.DB.QueryContext(r.Context(), `
			SELECT id, numero_presupuesto, fecha_emision, validez_dias, cliente_nombre, cliente_ruc, total_final, estado
			FROM presupuestos
			WHERE deleted_at IS NULL
			ORDER BY id DESC
			LIMIT 50
		`)
		if err == nil {
			defer rows.Close()
			var list []map[string]any
			for rows.Next() {
				var id, validezDias int
				var numPres, fechaEm, cliNom, cliRuc, estado string
				var totalFinal float64
				if scanErr := rows.Scan(&id, &numPres, &fechaEm, &validezDias, &cliNom, &cliRuc, &totalFinal, &estado); scanErr == nil {
					list = append(list, map[string]any{
						"id":                 id,
						"numero_presupuesto": numPres,
						"fecha_emision":      fechaEm,
						"validez_dias":       validezDias,
						"cliente_nombre":     cliNom,
						"cliente_ruc":        cliRuc,
						"total_final":        totalFinal,
						"total_formateado":   formatGs(totalFinal),
						"estado":             estado,
					})
				}
			}
			if len(list) > 0 {
				_ = json.NewEncoder(w).Encode(map[string]any{
					"data":  list,
					"total": len(list),
				})
				return
			}
		}
	}

	// Lista de presupuestos de muestra inicial
	sample := []map[string]any{
		{
			"id":                 3,
			"numero_presupuesto": "PRES-2026-0003",
			"fecha_emision":      "24/10/2026",
			"validez_dias":       15,
			"cliente_nombre":     "Zunilda Ledesma",
			"cliente_ruc":        "727424",
			"total_final":        3200000,
			"total_formateado":   "3.200.000 Gs.",
			"estado":             "Aprobado",
		},
		{
			"id":                 2,
			"numero_presupuesto": "PRES-2026-0002",
			"fecha_emision":      "20/10/2026",
			"validez_dias":       15,
			"cliente_nombre":     "Marcos Acosta",
			"cliente_ruc":        "4589622-1",
			"total_final":        850000,
			"total_formateado":   "850.000 Gs.",
			"estado":             "Pendiente",
		},
	}

	_ = json.NewEncoder(w).Encode(map[string]any{
		"data":  sample,
		"total": len(sample),
	})
}

// HandleItem maneja GET /api/budgets/:id
func (h *BudgetsHandler) HandleItem(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		auth.WriteJSONError(w, http.StatusMethodNotAllowed, "método no permitido")
		return
	}

	idStr := strings.TrimPrefix(r.URL.Path, "/api/budgets/")
	idStr = strings.TrimSpace(idStr)
	if idStr == "" {
		auth.WriteJSONError(w, http.StatusBadRequest, "identificador de presupuesto requerido")
		return
	}

	// Obtener datos institucionales de la empresa
	empresa := h.getEmpresaDatos(r)

	// Intentar consultar desde la base de datos si existe la tabla
	if h.DB != nil {
		if resp, found := h.fetchFromDB(r, idStr, empresa); found {
			w.Header().Set("Content-Type", "application/json; charset=utf-8")
			_ = json.NewEncoder(w).Encode(resp)
			return
		}
	}

	// Si no está en BD o es solicitud de muestra, entregar el presupuesto oficial predeterminado de R1
	resp := h.getDefaultSampleBudget(idStr, empresa)
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(resp)
}

func (h *BudgetsHandler) fetchFromDB(r *http.Request, idOrNum string, empresa models.BudgetEmpresaDTO) (models.BudgetResponse, bool) {
	var b models.BudgetResponse
	var bID, validezDias int
	var numPres, fechaEm, valFecha, estado string
	var cliNom, cliRuc, cliTel, cliEmail, cliDir string
	var subtotal, descPct, descMonto, totalFinal float64

	query := `
		SELECT id, numero_presupuesto, fecha_emision, validez_dias, validez_fecha, estado,
		       cliente_nombre, cliente_ruc, cliente_telefono, cliente_email, cliente_direccion,
		       subtotal, porcentaje_descuento, monto_descuento, total_final
		FROM presupuestos
		WHERE (id = ? OR numero_presupuesto = ?) AND deleted_at IS NULL
		LIMIT 1
	`
	idNum, _ := strconv.Atoi(idOrNum)
	err := h.DB.QueryRowContext(r.Context(), query, idNum, idOrNum).Scan(
		&bID, &numPres, &fechaEm, &validezDias, &valFecha, &estado,
		&cliNom, &cliRuc, &cliTel, &cliEmail, &cliDir,
		&subtotal, &descPct, &descMonto, &totalFinal,
	)
	if err != nil {
		return b, false
	}

	b.ID = bID
	b.NumeroPresupuesto = numPres
	b.FechaEmision = fechaEm
	b.ValidezDias = validezDias
	b.ValidezFecha = valFecha
	b.Estado = estado
	b.Cliente = models.BudgetClienteDTO{
		Nombre:    cliNom,
		RUC:       cliRuc,
		Telefono:  cliTel,
		Email:     cliEmail,
		Direccion: cliDir,
	}

	// Consultar ítems
	itemRows, err := h.DB.QueryContext(r.Context(), `
		SELECT id, descripcion, precio_unitario, cantidad, total, IFNULL(imagen_url, '')
		FROM presupuesto_items
		WHERE presupuesto_id = ?
		ORDER BY id ASC
	`, bID)
	if err == nil {
		defer itemRows.Close()
		for itemRows.Next() {
			var itID, cant int
			var desc, imgURL string
			var pu, tot float64
			if itemRows.Scan(&itID, &desc, &pu, &cant, &tot, &imgURL) == nil {
				b.Items = append(b.Items, models.BudgetItem{
					ID:                 itID,
					PresupuestoID:      bID,
					Descripcion:        desc,
					PrecioUnitario:     pu,
					PrecioUnitarioForm: formatGs(pu),
					Cantidad:           cant,
					Total:              tot,
					TotalFormateado:    formatGs(tot),
					ImagenURL:          imgURL,
				})
				if imgURL != "" {
					b.ImagenesProductos = append(b.ImagenesProductos, models.BudgetProductoFotoDTO{
						Nombre: desc,
						URL:    imgURL,
					})
				}
			}
		}
	}

	b.Totales = models.BudgetTotalesDTO{
		Subtotal:                subtotal,
		SubtotalFormateado:      formatGs(subtotal),
		PorcentajeDescuento:     descPct,
		MontoDescuento:          descMonto,
		MontoDescuentoFormatead: "- " + formatGs(descMonto),
		TotalFinal:              totalFinal,
		TotalFinalFormateado:    formatGs(totalFinal),
		LeyendaDescuento:        fmt.Sprintf("¡%.1f%% DE DESCUENTO POR PAGO AL CONTADO!", descPct),
	}

	b.TerminosCondiciones = []string{
		"1. Validez de la oferta: Este presupuesto tiene una validez de 15 días corridos a partir de su fecha de emisión.",
		"2. Condiciones de pago: El pedido se confirma con la entrega del 60%, por medio de efectivo o transferencia bancaria.",
		"3. Plazos de entrega: Tiempo estimado de 3 a 5 días hábiles posterior a la aprobación del diseño y confirmación de seña.",
		"4. Garantía y cambios: Tratándose de artículos personalizados, no se admiten cancelaciones una vez iniciada la producción.",
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
			LeyendaDescuento:        "¡2.3% DE DESCUENTO POR PAGO AL CONTADO!",
		},
		TerminosCondiciones: []string{
			"1. Validez de la oferta: Este presupuesto tiene una validez de 15 días corridos a partir de su fecha de emisión.",
			"2. Condiciones de pago: El pedido se confirma con la entrega del 60%, por medio de efectivo o transferencia bancaria.",
			"3. Plazos de entrega: Tiempo estimado de 3 a 5 días hábiles posterior a la aprobación del diseño y confirmación de seña.",
			"4. Garantía y cambios: Tratándose de artículos personalizados, no se admiten cancelaciones una vez iniciada la producción.",
		},
		ImagenesProductos: []models.BudgetProductoFotoDTO{
			{Nombre: "Taza para Bebe", URL: "/logo/R1.png"},
			{Nombre: "Taza para Bebe", URL: "/logo/R1.png"},
			{Nombre: "Taza Especial Sublimada R1", URL: "/logo/R1.png"},
			{Nombre: "Taza Magica Sublimada 350ml", URL: "/logo/R1.png"},
			{Nombre: "Kepis", URL: "/logo/R1.png"},
		},
		Empresa: empresa,
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
