package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"r1/backend/internal/auth"
	"r1/backend/internal/models"

	"golang.org/x/crypto/bcrypt"
)

type ConfiguracionHandler struct {
	DB *sql.DB
}

func NewConfiguracionHandler(dbConn *sql.DB) *ConfiguracionHandler {
	return &ConfiguracionHandler{DB: dbConn}
}

// ----------------------------------------------------------------------------
// 1. Configuraciones Globales (WhatsApp, Pedidos, Datos de Empresa)
// ----------------------------------------------------------------------------

func (h *ConfiguracionHandler) HandleConfig(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.GetConfig(w, r)
	case http.MethodPut, http.MethodPost:
		h.SaveConfig(w, r)
	default:
		auth.WriteJSONError(w, http.StatusMethodNotAllowed, "método no permitido")
	}
}

func (h *ConfiguracionHandler) GetConfig(w http.ResponseWriter, r *http.Request) {
	if h.DB == nil {
		auth.WriteJSONError(w, http.StatusServiceUnavailable, "base de datos no conectada")
		return
	}

	rows, err := h.DB.QueryContext(r.Context(), "SELECT clave, valor FROM configuraciones")
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "error al consultar configuraciones: "+err.Error())
		return
	}
	defer rows.Close()

	res := make(map[string]any)
	for rows.Next() {
		var clave, rawValor string
		if err := rows.Scan(&clave, &rawValor); err == nil {
			var parsed any
			if json.Unmarshal([]byte(rawValor), &parsed) == nil {
				res[clave] = parsed
			} else {
				res[clave] = rawValor
			}
		}
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(res)
}

func (h *ConfiguracionHandler) SaveConfig(w http.ResponseWriter, r *http.Request) {
	if h.DB == nil {
		auth.WriteJSONError(w, http.StatusServiceUnavailable, "base de datos no conectada")
		return
	}

	var payload struct {
		Clave string `json:"clave"`
		Valor any    `json:"valor"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		auth.WriteJSONError(w, http.StatusBadRequest, "formato de datos inválido")
		return
	}

	payload.Clave = strings.TrimSpace(payload.Clave)
	if payload.Clave == "" {
		auth.WriteJSONError(w, http.StatusBadRequest, "la clave de configuración es obligatoria")
		return
	}

	var valorStr string
	switch v := payload.Valor.(type) {
	case string:
		valorStr = v
	default:
		bytes, err := json.Marshal(v)
		if err != nil {
			auth.WriteJSONError(w, http.StatusBadRequest, "error al codificar el valor")
			return
		}
		valorStr = string(bytes)
	}

	_, err := h.DB.ExecContext(r.Context(), `
		INSERT INTO configuraciones (clave, valor)
		VALUES (?, ?)
		ON DUPLICATE KEY UPDATE valor = VALUES(valor)
	`, payload.Clave, valorStr)
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "error al guardar configuración: "+err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"status":  "ok",
		"clave":   payload.Clave,
		"updated": true,
	})
}

// ----------------------------------------------------------------------------
// 1.1 Plantilla de Presupuesto (@pdfme Template Configuration)
// ----------------------------------------------------------------------------

func (h *ConfiguracionHandler) HandleBudgetTemplate(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.GetBudgetTemplate(w, r)
	case http.MethodPost, http.MethodPut:
		h.SaveBudgetTemplate(w, r)
	default:
		auth.WriteJSONError(w, http.StatusMethodNotAllowed, "método no permitido")
	}
}

func (h *ConfiguracionHandler) GetBudgetTemplate(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	var empLogo string
	if h.DB != nil {
		var rawEmp string
		if err := h.DB.QueryRowContext(r.Context(), "SELECT valor FROM configuraciones WHERE clave = 'empresa_datos'").Scan(&rawEmp); err == nil && strings.TrimSpace(rawEmp) != "" {
			var empMap map[string]any
			if json.Unmarshal([]byte(rawEmp), &empMap) == nil {
				if l, ok := empMap["logo_url"].(string); ok && strings.TrimSpace(l) != "" {
					empLogo = strings.TrimSpace(l)
				}
			}
		}

		var rawValor string
		err := h.DB.QueryRowContext(r.Context(), "SELECT valor FROM configuraciones WHERE clave = 'budget_template'").Scan(&rawValor)
		if err == nil && strings.TrimSpace(rawValor) != "" {
			var parsed map[string]any
			if json.Unmarshal([]byte(rawValor), &parsed) == nil {
				// Si ya cuenta con la estructura enriquecida de personalización visual, devolverla
				if caratula, ok := parsed["caratula"].(map[string]any); ok {
					curLogo, _ := caratula["logo_url"].(string)
					curLogo = strings.TrimSpace(curLogo)
					if curLogo == "" || curLogo == "/logo/R1.png" || curLogo == "./logo/r1.png" {
						if empLogo != "" {
							caratula["logo_url"] = empLogo
						} else {
							caratula["logo_url"] = "./logo/r1.png"
						}
					}
					_ = json.NewEncoder(w).Encode(parsed)
					return
				}
			}
		}
	}

	fallbackLogo := "./logo/r1.png"
	if empLogo != "" {
		fallbackLogo = empLogo
	}

	// Configuración y Plantilla Oficial Predeterminada de R1 Personalizados
	defaultConfig := map[string]any{
		"basePdf": "/templates/presupuesto_base.pdf",
		"caratula": map[string]any{
			"logo_ancho":   140,
			"estilo_color": "#435A62",
			"logo_url":     fallbackLogo,
		},
		"pagina2": map[string]any{
			"cabecera_logo_visible":     true,
			"cabecera_logo_alto":        28,
			"titulo_barra_visible":      true,
			"titulo_barra_texto":        "PRESUPUESTO OFICIAL",
			"tamano_textos_porcentaje":  100,
			"separacion_bloques_px":     20,
			"foto_producto_descripcion": true,
			"descuento": map[string]any{
				"visible":              true,
				"mostrar_cuadro_borde": true,
				"texto":                "¡10% DE DESCUENTO POR PAGO AL CONTADO!",
				"color_fondo":          "#FEF2F2",
				"color_texto":          "#DC2626",
				"color_borde":          "#FECACA",
			},
			"terminos": map[string]any{
				"titulo":               "TÉRMINOS Y CONDICIONES",
				"titulo_html":          "<strong>TÉRMINOS Y CONDICIONES</strong>",
				"posicion_vertical_px": 20,
				"clausulas": []string{
					"1. Validez de la oferta: Este presupuesto tiene una validez de 15 días corridos a partir de su fecha de emisión.",
					"2. Condiciones de pago: El pedido se confirma con la entrega del 60%, por medio de efectivo o transferencia bancaria.",
					"3. Plazos de entrega: Tiempo estimado de 3 a 5 días hábiles posterior a la aprobación del diseño y confirmación de seña.",
					"4. Garantía y cambios: Tratándose de artículos personalizados, no se admiten cancelaciones una vez iniciada la producción.",
				},
				"clausulas_html": `<ol class="list-decimal pl-4 space-y-1"><li><strong>Validez de la oferta:</strong> Este presupuesto tiene una validez de 15 días corridos a partir de su fecha de emisión.</li><li><strong>Condiciones de pago:</strong> El pedido se confirma con la entrega del 60%, por medio de efectivo o transferencia bancaria.</li><li><strong>Plazos de entrega:</strong> Tiempo estimado de 3 a 5 días hábiles posterior a la aprobación del diseño y confirmación de seña.</li><li><strong>Garantía y cambios:</strong> Tratándose de artículos personalizados, no se admiten cancelaciones una vez iniciada la producción.</li></ol>`,
			},
		},
		"pagina3": map[string]any{
			"visible":                 true,
			"titulo":                  "FOTOS DE PRODUCTOS",
			"titulo_visible":          true,
			"posicion_vertical_px":    20,
			"posicion_horizontal_px":  0,
			"separacion_fotos_px":     16,
			"altura_foto_mm":          80,
			"ajuste_foto":             "contain",
			"columnas_por_fila":       2,
			"mostrar_nombre_producto": true,
		},
		"pie_pagina": map[string]any{
			"redes": map[string]bool{
				"facebook":  true,
				"instagram": true,
				"tiktok":    true,
				"sitio_web": true,
			},
			"contacto": map[string]bool{
				"incluir_telefonos": true,
				"incluir_direccion": true,
			},
			"mensaje_cierre": "¡Muchas gracias por su preferencia!",
		},
	}

	_ = json.NewEncoder(w).Encode(defaultConfig)
}

func (h *ConfiguracionHandler) SaveBudgetTemplate(w http.ResponseWriter, r *http.Request) {
	if h.DB == nil {
		auth.WriteJSONError(w, http.StatusServiceUnavailable, "base de datos no conectada")
		return
	}

	var payload any
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		auth.WriteJSONError(w, http.StatusBadRequest, "formato JSON inválido para la plantilla")
		return
	}

	bytes, err := json.Marshal(payload)
	if err != nil {
		auth.WriteJSONError(w, http.StatusBadRequest, "error al codificar la plantilla")
		return
	}

	_, err = h.DB.ExecContext(r.Context(), `
		INSERT INTO configuraciones (clave, valor)
		VALUES ('budget_template', ?)
		ON DUPLICATE KEY UPDATE valor = VALUES(valor)
	`, string(bytes))
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "error al guardar plantilla: "+err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"status":  "ok",
		"message": "Plantilla de presupuesto guardada con éxito",
	})
}

// ----------------------------------------------------------------------------
// 2. Perfil de Usuario
// ----------------------------------------------------------------------------

func (h *ConfiguracionHandler) HandlePerfil(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.GetPerfil(w, r)
	case http.MethodPut:
		h.UpdatePerfil(w, r)
	default:
		auth.WriteJSONError(w, http.StatusMethodNotAllowed, "método no permitido")
	}
}

func (h *ConfiguracionHandler) GetPerfil(w http.ResponseWriter, r *http.Request) {
	if h.DB == nil {
		auth.WriteJSONError(w, http.StatusServiceUnavailable, "base de datos no conectada")
		return
	}

	claims := auth.CurrentUserClaims(r)
	if claims == nil {
		auth.WriteJSONError(w, http.StatusUnauthorized, "no autenticado")
		return
	}

	if claims.IsRoot {
		rootUser := os.Getenv("ROOT_USER")
		if rootUser == "" {
			rootUser = "Ju5t0L3d35m4"
		}
		p := models.UserProfile{
			ID:                0,
			Username:          rootUser,
			Email:             rootUser + "@netz.local",
			FullName:          "Super Administrador",
			Role:              "admin",
			AutoLogoutMinutes: 0,
		}
		var raw string
		if err := h.DB.QueryRowContext(r.Context(), "SELECT valor FROM configuraciones WHERE clave = 'root_profile'").Scan(&raw); err == nil {
			var rp struct {
				Email             string `json:"email"`
				FechaNacimiento   string `json:"fecha_nacimiento"`
				FotoPerfil        string `json:"foto_perfil"`
				AutoLogoutMinutes int    `json:"auto_logout_minutes"`
			}
			if json.Unmarshal([]byte(raw), &rp) == nil {
				if rp.Email != "" {
					p.Email = rp.Email
				}
				p.FechaNacimiento = rp.FechaNacimiento
				p.FotoPerfil = rp.FotoPerfil
				p.AutoLogoutMinutes = rp.AutoLogoutMinutes
			}
		}
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		_ = json.NewEncoder(w).Encode(p)
		return
	}

	userID := claims.UserID
	if userID <= 0 {
		auth.WriteJSONError(w, http.StatusBadRequest, "identificador de usuario inválido")
		return
	}

	var p models.UserProfile
	var fechaNac sql.NullTime
	var fotoPerf sql.NullString
	var roleName string

	err := h.DB.QueryRowContext(r.Context(), `
		SELECT u.id, u.username, u.email, u.full_name, COALESCE(r.name, 'admin'),
		       u.fecha_nacimiento, u.foto_perfil, COALESCE(u.auto_logout_minutes, 0)
		FROM users u
		LEFT JOIN roles r ON u.role_id = r.id
		WHERE u.id = ? AND u.deleted_at IS NULL
	`, userID).Scan(&p.ID, &p.Username, &p.Email, &p.FullName, &roleName, &fechaNac, &fotoPerf, &p.AutoLogoutMinutes)

	if err != nil {
		auth.WriteJSONError(w, http.StatusNotFound, "usuario no encontrado")
		return
	}

	p.Role = roleName
	if fechaNac.Valid {
		p.FechaNacimiento = fechaNac.Time.Format("2006-01-02")
	}
	if fotoPerf.Valid {
		p.FotoPerfil = fotoPerf.String
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(p)
}

func (h *ConfiguracionHandler) UpdatePerfil(w http.ResponseWriter, r *http.Request) {
	if h.DB == nil {
		auth.WriteJSONError(w, http.StatusServiceUnavailable, "base de datos no conectada")
		return
	}

	claims := auth.CurrentUserClaims(r)
	if claims == nil {
		auth.WriteJSONError(w, http.StatusUnauthorized, "no autenticado")
		return
	}

	var req struct {
		Username          string `json:"username"`
		Email             string `json:"email"`
		FechaNacimiento   string `json:"fechaNacimiento"`
		FotoPerfil        string `json:"fotoPerfil"`
		AutoLogoutMinutes int    `json:"autoLogoutMinutes"`
		CurrentPassword   string `json:"currentPassword"`
		NewPassword       string `json:"newPassword"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		auth.WriteJSONError(w, http.StatusBadRequest, "formato de datos inválido")
		return
	}

	req.Username = strings.TrimSpace(req.Username)
	req.Email = strings.TrimSpace(req.Email)
	if req.Username == "" {
		auth.WriteJSONError(w, http.StatusBadRequest, "el nombre de usuario es obligatorio")
		return
	}
	if req.Email == "" {
		auth.WriteJSONError(w, http.StatusBadRequest, "el correo electrónico es obligatorio")
		return
	}

	if claims.IsRoot {
		// Guardar perfil de root en configuraciones
		data, _ := json.Marshal(map[string]any{
			"email":               req.Email,
			"fecha_nacimiento":    req.FechaNacimiento,
			"foto_perfil":         req.FotoPerfil,
			"auto_logout_minutes": req.AutoLogoutMinutes,
		})
		_, err := h.DB.ExecContext(r.Context(), `
			INSERT INTO configuraciones (clave, valor)
			VALUES ('root_profile', ?)
			ON DUPLICATE KEY UPDATE valor = VALUES(valor)
		`, string(data))
		if err != nil {
			auth.WriteJSONError(w, http.StatusInternalServerError, "error al guardar perfil de root: "+err.Error())
			return
		}

		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"status":  "ok",
			"message": "Perfil de superadministrador actualizado correctamente",
		})
		return
	}

	userID := claims.UserID
	if userID <= 0 {
		auth.WriteJSONError(w, http.StatusBadRequest, "identificador de usuario inválido")
		return
	}

	// Verificar unicidad de username y email excluyendo a sí mismo
	var existsID int
	err := h.DB.QueryRowContext(r.Context(), "SELECT id FROM users WHERE username = ? AND id != ? AND deleted_at IS NULL", req.Username, userID).Scan(&existsID)
	if err == nil {
		auth.WriteJSONError(w, http.StatusBadRequest, "el nombre de usuario ya está registrado por otro operador")
		return
	}

	err = h.DB.QueryRowContext(r.Context(), "SELECT id FROM users WHERE email = ? AND id != ? AND deleted_at IS NULL", req.Email, userID).Scan(&existsID)
	if err == nil {
		auth.WriteJSONError(w, http.StatusBadRequest, "el correo electrónico ya está registrado por otro operador")
		return
	}

	// Verificar si se solicitó cambio de contraseña
	var updatePassSQL string
	var newHash string
	if strings.TrimSpace(req.NewPassword) != "" {
		if len(req.NewPassword) < 6 {
			auth.WriteJSONError(w, http.StatusBadRequest, "la nueva contraseña debe tener al menos 6 caracteres")
			return
		}

		var currentHash string
		err := h.DB.QueryRowContext(r.Context(), "SELECT password_hash FROM users WHERE id = ?", userID).Scan(&currentHash)
		if err != nil {
			auth.WriteJSONError(w, http.StatusInternalServerError, "error al verificar credenciales")
			return
		}

		if err := bcrypt.CompareHashAndPassword([]byte(currentHash), []byte(req.CurrentPassword)); err != nil {
			auth.WriteJSONError(w, http.StatusBadRequest, "la contraseña actual es incorrecta")
			return
		}

		hashBytes, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
		if err != nil {
			auth.WriteJSONError(w, http.StatusInternalServerError, "error al procesar la nueva contraseña")
			return
		}
		newHash = string(hashBytes)
		updatePassSQL = ", password_hash = ?"
	}

	var fechaVal any = nil
	if strings.TrimSpace(req.FechaNacimiento) != "" {
		if t, err := time.Parse("2006-01-02", req.FechaNacimiento); err == nil {
			fechaVal = t.Format("2006-01-02")
		}
	}

	query := `
		UPDATE users SET
			username = ?,
			email = ?,
			fecha_nacimiento = ?,
			foto_perfil = ?,
			auto_logout_minutes = ?
	`
	args := []any{req.Username, req.Email, fechaVal, req.FotoPerfil, req.AutoLogoutMinutes}

	if updatePassSQL != "" {
		query += updatePassSQL
		args = append(args, newHash)
	}

	query += " WHERE id = ? AND deleted_at IS NULL"
	args = append(args, userID)

	_, err = h.DB.ExecContext(r.Context(), query, args...)
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "no se pudo actualizar el perfil: "+err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"status":  "ok",
		"message": "Perfil actualizado correctamente",
	})
}

// ----------------------------------------------------------------------------
// 3. Atributos de Productos (Categorías, Marcas, Unidades de Medida)
// ----------------------------------------------------------------------------

func (h *ConfiguracionHandler) ListAtributos(w http.ResponseWriter, r *http.Request) {
	if h.DB == nil {
		auth.WriteJSONError(w, http.StatusServiceUnavailable, "base de datos no conectada")
		return
	}

	// Categorías
	catRows, err := h.DB.QueryContext(r.Context(), `
		SELECT id, nombre, activo, created_at, updated_at
		FROM categorias_productos
		WHERE deleted_at IS NULL
		ORDER BY id ASC
	`)
	var categorias []models.CategoriaProducto
	if err == nil {
		defer catRows.Close()
		for catRows.Next() {
			var c models.CategoriaProducto
			if err := catRows.Scan(&c.ID, &c.Nombre, &c.Activo, &c.CreatedAt, &c.UpdatedAt); err == nil {
				categorias = append(categorias, c)
			}
		}
	}
	if categorias == nil {
		categorias = []models.CategoriaProducto{}
	}

	// Marcas
	mrcRows, err := h.DB.QueryContext(r.Context(), `
		SELECT id, nombre, activo, created_at, updated_at
		FROM marcas_productos
		WHERE deleted_at IS NULL
		ORDER BY id ASC
	`)
	var marcas []models.MarcaProducto
	if err == nil {
		defer mrcRows.Close()
		for mrcRows.Next() {
			var m models.MarcaProducto
			if err := mrcRows.Scan(&m.ID, &m.Nombre, &m.Activo, &m.CreatedAt, &m.UpdatedAt); err == nil {
				marcas = append(marcas, m)
			}
		}
	}
	if marcas == nil {
		marcas = []models.MarcaProducto{}
	}

	// Unidades de medida
	uniRows, err := h.DB.QueryContext(r.Context(), `
		SELECT id, nombre, abreviatura, permite_decimales, activo, created_at, updated_at
		FROM unidades_medida
		WHERE deleted_at IS NULL
		ORDER BY id ASC
	`)
	var unidades []models.UnidadMedida
	if err == nil {
		defer uniRows.Close()
		for uniRows.Next() {
			var u models.UnidadMedida
			if err := uniRows.Scan(&u.ID, &u.Nombre, &u.Abreviatura, &u.PermiteDecimales, &u.Activo, &u.CreatedAt, &u.UpdatedAt); err == nil {
				unidades = append(unidades, u)
			}
		}
	}
	if unidades == nil {
		unidades = []models.UnidadMedida{}
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"categorias": categorias,
		"marcas":     marcas,
		"unidades":   unidades,
	})
}

// Handler genérico de Categorías
func (h *ConfiguracionHandler) HandleCategorias(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/configuracion/categorias")
	path = strings.Trim(path, "/")
	if path == "" {
		if r.Method == http.MethodPost {
			h.CreateCategoria(w, r)
		} else {
			auth.WriteJSONError(w, http.StatusMethodNotAllowed, "método no permitido")
		}
		return
	}

	id, err := strconv.Atoi(path)
	if err != nil || id <= 0 {
		auth.WriteJSONError(w, http.StatusBadRequest, "ID inválido")
		return
	}

	switch r.Method {
	case http.MethodPut:
		h.UpdateCategoria(w, r, id)
	case http.MethodPatch:
		h.ToggleCategoria(w, r, id)
	case http.MethodDelete:
		h.DeleteCategoria(w, r, id)
	default:
		auth.WriteJSONError(w, http.StatusMethodNotAllowed, "método no permitido")
	}
}

func (h *ConfiguracionHandler) CreateCategoria(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Nombre string `json:"nombre"`
		Activo *bool  `json:"activo"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		auth.WriteJSONError(w, http.StatusBadRequest, "formato de datos inválido")
		return
	}
	body.Nombre = strings.TrimSpace(body.Nombre)
	if body.Nombre == "" {
		auth.WriteJSONError(w, http.StatusBadRequest, "el nombre de la categoría es obligatorio")
		return
	}
	activo := true
	if body.Activo != nil {
		activo = *body.Activo
	}

	res, err := h.DB.ExecContext(r.Context(), `
		INSERT INTO categorias_productos (nombre, activo)
		VALUES (?, ?)
	`, body.Nombre, activo)
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "no se pudo crear la categoría: "+err.Error())
		return
	}
	newID, _ := res.LastInsertId()
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"id":     newID,
		"nombre": body.Nombre,
		"activo": activo,
	})
}

func (h *ConfiguracionHandler) UpdateCategoria(w http.ResponseWriter, r *http.Request, id int) {
	var body struct {
		Nombre string `json:"nombre"`
		Activo *bool  `json:"activo"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		auth.WriteJSONError(w, http.StatusBadRequest, "formato de datos inválido")
		return
	}
	body.Nombre = strings.TrimSpace(body.Nombre)
	if body.Nombre == "" {
		auth.WriteJSONError(w, http.StatusBadRequest, "el nombre es obligatorio")
		return
	}

	query := "UPDATE categorias_productos SET nombre = ?"
	args := []any{body.Nombre}
	if body.Activo != nil {
		query += ", activo = ?"
		args = append(args, *body.Activo)
	}
	query += " WHERE id = ? AND deleted_at IS NULL"
	args = append(args, id)

	_, err := h.DB.ExecContext(r.Context(), query, args...)
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "no se pudo actualizar la categoría")
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]any{"id": id, "status": "ok"})
}

func (h *ConfiguracionHandler) ToggleCategoria(w http.ResponseWriter, r *http.Request, id int) {
	_, err := h.DB.ExecContext(r.Context(), `
		UPDATE categorias_productos
		SET activo = NOT activo
		WHERE id = ? AND deleted_at IS NULL
	`, id)
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "no se pudo cambiar el estado")
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]any{"id": id, "status": "ok"})
}

func (h *ConfiguracionHandler) DeleteCategoria(w http.ResponseWriter, r *http.Request, id int) {
	deletedBy := getDeletedByFromRequest(r)
	_, err := h.DB.ExecContext(r.Context(), `
		UPDATE categorias_productos
		SET deleted_at = NOW(), deleted_by = ?
		WHERE id = ? AND deleted_at IS NULL
	`, deletedBy, id)
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "no se pudo enviar a reciclaje")
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]any{"id": id, "deleted": true})
}

// Handler genérico de Marcas
func (h *ConfiguracionHandler) HandleMarcas(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/configuracion/marcas")
	path = strings.Trim(path, "/")
	if path == "" {
		if r.Method == http.MethodPost {
			h.CreateMarca(w, r)
		} else {
			auth.WriteJSONError(w, http.StatusMethodNotAllowed, "método no permitido")
		}
		return
	}

	id, err := strconv.Atoi(path)
	if err != nil || id <= 0 {
		auth.WriteJSONError(w, http.StatusBadRequest, "ID inválido")
		return
	}

	switch r.Method {
	case http.MethodPut:
		h.UpdateMarca(w, r, id)
	case http.MethodPatch:
		h.ToggleMarca(w, r, id)
	case http.MethodDelete:
		h.DeleteMarca(w, r, id)
	default:
		auth.WriteJSONError(w, http.StatusMethodNotAllowed, "método no permitido")
	}
}

func (h *ConfiguracionHandler) CreateMarca(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Nombre string `json:"nombre"`
		Activo *bool  `json:"activo"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		auth.WriteJSONError(w, http.StatusBadRequest, "formato de datos inválido")
		return
	}
	body.Nombre = strings.TrimSpace(body.Nombre)
	if body.Nombre == "" {
		auth.WriteJSONError(w, http.StatusBadRequest, "el nombre de la marca es obligatorio")
		return
	}
	activo := true
	if body.Activo != nil {
		activo = *body.Activo
	}

	res, err := h.DB.ExecContext(r.Context(), `
		INSERT INTO marcas_productos (nombre, activo)
		VALUES (?, ?)
	`, body.Nombre, activo)
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "no se pudo crear la marca: "+err.Error())
		return
	}
	newID, _ := res.LastInsertId()
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"id":     newID,
		"nombre": body.Nombre,
		"activo": activo,
	})
}

func (h *ConfiguracionHandler) UpdateMarca(w http.ResponseWriter, r *http.Request, id int) {
	var body struct {
		Nombre string `json:"nombre"`
		Activo *bool  `json:"activo"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		auth.WriteJSONError(w, http.StatusBadRequest, "formato de datos inválido")
		return
	}
	body.Nombre = strings.TrimSpace(body.Nombre)
	if body.Nombre == "" {
		auth.WriteJSONError(w, http.StatusBadRequest, "el nombre es obligatorio")
		return
	}

	query := "UPDATE marcas_productos SET nombre = ?"
	args := []any{body.Nombre}
	if body.Activo != nil {
		query += ", activo = ?"
		args = append(args, *body.Activo)
	}
	query += " WHERE id = ? AND deleted_at IS NULL"
	args = append(args, id)

	_, err := h.DB.ExecContext(r.Context(), query, args...)
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "no se pudo actualizar la marca")
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]any{"id": id, "status": "ok"})
}

func (h *ConfiguracionHandler) ToggleMarca(w http.ResponseWriter, r *http.Request, id int) {
	_, err := h.DB.ExecContext(r.Context(), `
		UPDATE marcas_productos
		SET activo = NOT activo
		WHERE id = ? AND deleted_at IS NULL
	`, id)
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "no se pudo cambiar el estado")
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]any{"id": id, "status": "ok"})
}

func (h *ConfiguracionHandler) DeleteMarca(w http.ResponseWriter, r *http.Request, id int) {
	deletedBy := getDeletedByFromRequest(r)
	_, err := h.DB.ExecContext(r.Context(), `
		UPDATE marcas_productos
		SET deleted_at = NOW(), deleted_by = ?
		WHERE id = ? AND deleted_at IS NULL
	`, deletedBy, id)
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "no se pudo enviar a reciclaje")
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]any{"id": id, "deleted": true})
}

// Handler genérico de Unidades de Medida
func (h *ConfiguracionHandler) HandleUnidades(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/configuracion/unidades")
	path = strings.Trim(path, "/")
	if path == "" {
		if r.Method == http.MethodPost {
			h.CreateUnidad(w, r)
		} else {
			auth.WriteJSONError(w, http.StatusMethodNotAllowed, "método no permitido")
		}
		return
	}

	id, err := strconv.Atoi(path)
	if err != nil || id <= 0 {
		auth.WriteJSONError(w, http.StatusBadRequest, "ID inválido")
		return
	}

	switch r.Method {
	case http.MethodPut:
		h.UpdateUnidad(w, r, id)
	case http.MethodPatch:
		h.ToggleUnidad(w, r, id)
	case http.MethodDelete:
		h.DeleteUnidad(w, r, id)
	default:
		auth.WriteJSONError(w, http.StatusMethodNotAllowed, "método no permitido")
	}
}

func (h *ConfiguracionHandler) CreateUnidad(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Nombre           string `json:"nombre"`
		Abreviatura      string `json:"abreviatura"`
		PermiteDecimales bool   `json:"permiteDecimales"`
		Activo           *bool  `json:"activo"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		auth.WriteJSONError(w, http.StatusBadRequest, "formato de datos inválido")
		return
	}
	body.Nombre = strings.TrimSpace(body.Nombre)
	body.Abreviatura = strings.TrimSpace(body.Abreviatura)
	if body.Nombre == "" || body.Abreviatura == "" {
		auth.WriteJSONError(w, http.StatusBadRequest, "el nombre y la abreviatura son obligatorios")
		return
	}
	activo := true
	if body.Activo != nil {
		activo = *body.Activo
	}

	res, err := h.DB.ExecContext(r.Context(), `
		INSERT INTO unidades_medida (nombre, abreviatura, permite_decimales, activo)
		VALUES (?, ?, ?, ?)
	`, body.Nombre, body.Abreviatura, body.PermiteDecimales, activo)
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "no se pudo crear la unidad: "+err.Error())
		return
	}
	newID, _ := res.LastInsertId()
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"id":               newID,
		"nombre":           body.Nombre,
		"abreviatura":      body.Abreviatura,
		"permiteDecimales": body.PermiteDecimales,
		"activo":           activo,
	})
}

func (h *ConfiguracionHandler) UpdateUnidad(w http.ResponseWriter, r *http.Request, id int) {
	var body struct {
		Nombre           string `json:"nombre"`
		Abreviatura      string `json:"abreviatura"`
		PermiteDecimales bool   `json:"permiteDecimales"`
		Activo           *bool  `json:"activo"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		auth.WriteJSONError(w, http.StatusBadRequest, "formato de datos inválido")
		return
	}
	body.Nombre = strings.TrimSpace(body.Nombre)
	body.Abreviatura = strings.TrimSpace(body.Abreviatura)
	if body.Nombre == "" || body.Abreviatura == "" {
		auth.WriteJSONError(w, http.StatusBadRequest, "el nombre y la abreviatura son obligatorios")
		return
	}

	query := "UPDATE unidades_medida SET nombre = ?, abreviatura = ?, permite_decimales = ?"
	args := []any{body.Nombre, body.Abreviatura, body.PermiteDecimales}
	if body.Activo != nil {
		query += ", activo = ?"
		args = append(args, *body.Activo)
	}
	query += " WHERE id = ? AND deleted_at IS NULL"
	args = append(args, id)

	_, err := h.DB.ExecContext(r.Context(), query, args...)
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "no se pudo actualizar la unidad")
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]any{"id": id, "status": "ok"})
}

func (h *ConfiguracionHandler) ToggleUnidad(w http.ResponseWriter, r *http.Request, id int) {
	_, err := h.DB.ExecContext(r.Context(), `
		UPDATE unidades_medida
		SET activo = NOT activo
		WHERE id = ? AND deleted_at IS NULL
	`, id)
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "no se pudo cambiar el estado")
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]any{"id": id, "status": "ok"})
}

func (h *ConfiguracionHandler) DeleteUnidad(w http.ResponseWriter, r *http.Request, id int) {
	deletedBy := getDeletedByFromRequest(r)
	_, err := h.DB.ExecContext(r.Context(), `
		UPDATE unidades_medida
		SET deleted_at = NOW(), deleted_by = ?
		WHERE id = ? AND deleted_at IS NULL
	`, deletedBy, id)
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "no se pudo enviar a reciclaje")
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]any{"id": id, "deleted": true})
}

func getDeletedByFromRequest(r *http.Request) string {
	claims, ok := r.Context().Value(auth.UserClaimsKey).(*auth.Claims)
	if ok && claims != nil && claims.Username != "" {
		return claims.Username
	}
	return "admin"
}

