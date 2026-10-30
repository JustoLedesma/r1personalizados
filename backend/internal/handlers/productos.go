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

type ProductosHandler struct {
	DB *sql.DB
}

func NewProductosHandler(dbConn *sql.DB) *ProductosHandler {
	return &ProductosHandler{DB: dbConn}
}

func (h *ProductosHandler) HandleCollection(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.List(w, r)
	case http.MethodPost:
		h.Create(w, r)
	default:
		auth.WriteJSONError(w, http.StatusMethodNotAllowed, "método no permitido")
	}
}

func (h *ProductosHandler) HandleItem(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/productos/")
	path = strings.Trim(path, "/")

	if strings.HasSuffix(path, "/toggle-activo") {
		idStr := strings.TrimSuffix(path, "/toggle-activo")
		id, err := strconv.Atoi(idStr)
		if err != nil || id <= 0 {
			auth.WriteJSONError(w, http.StatusBadRequest, "ID de producto inválido")
			return
		}
		if r.Method == http.MethodPatch || r.Method == http.MethodPut {
			h.ToggleActivo(w, r, id)
			return
		}
		auth.WriteJSONError(w, http.StatusMethodNotAllowed, "método no permitido")
		return
	}

	id, err := strconv.Atoi(path)
	if err != nil || id <= 0 {
		auth.WriteJSONError(w, http.StatusBadRequest, "ID de producto inválido")
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

func (h *ProductosHandler) HandleCheckSKU(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		auth.WriteJSONError(w, http.StatusMethodNotAllowed, "método no permitido")
		return
	}
	sku := strings.TrimSpace(r.URL.Query().Get("sku"))
	if sku == "" {
		auth.WriteJSONError(w, http.StatusBadRequest, "el parámetro sku es obligatorio")
		return
	}
	excludeID, _ := strconv.Atoi(r.URL.Query().Get("exclude_id"))

	query := `SELECT COUNT(1) FROM productos WHERE sku = ? AND deleted_at IS NULL`
	args := []any{sku}
	if excludeID > 0 {
		query += ` AND id != ?`
		args = append(args, excludeID)
	}

	var count int
	if err := h.DB.QueryRowContext(r.Context(), query, args...).Scan(&count); err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "error al verificar SKU")
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"sku":       sku,
		"disponible": count == 0,
		"existe":    count > 0,
	})
}

func (h *ProductosHandler) List(w http.ResponseWriter, r *http.Request) {
	if h.DB == nil {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"data":      []models.Producto{},
			"page":      1,
			"page_size": 20,
			"total":     0,
		})
		return
	}

	q := strings.TrimSpace(r.URL.Query().Get("q"))
	categoriaStr := strings.TrimSpace(r.URL.Query().Get("categoria_id"))
	estadoStr := strings.TrimSpace(r.URL.Query().Get("estado"))
	stockFilter := strings.TrimSpace(r.URL.Query().Get("stock"))

	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page <= 0 {
		page = 1
	}
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("page_size"))
	if pageSize <= 0 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	where := " WHERE p.deleted_at IS NULL"
	args := make([]any, 0)

	if q != "" {
		like := "%" + q + "%"
		where += " AND (p.nombre LIKE ? OR p.sku LIKE ? OR p.codigo_barras LIKE ?)"
		args = append(args, like, like, like)
	}

	if categoriaStr != "" && categoriaStr != "todas" {
		if catID, err := strconv.Atoi(categoriaStr); err == nil && catID > 0 {
			where += " AND p.categoria_id = ?"
			args = append(args, catID)
		}
	}

	if estadoStr == "activo" {
		where += " AND p.activo = 1"
	} else if estadoStr == "inactivo" {
		where += " AND p.activo = 0"
	}

	if stockFilter == "con_stock" {
		where += " AND (!p.controlar_stock OR p.stock_actual > 0)"
	} else if stockFilter == "sin_stock" {
		where += " AND p.controlar_stock = 1 AND p.stock_actual <= 0"
	} else if stockFilter == "bajo_minimo" {
		where += " AND p.controlar_stock = 1 AND p.stock_actual <= p.stock_minimo"
	}

	countQuery := `SELECT COUNT(1) FROM productos p` + where
	var total int
	if err := h.DB.QueryRowContext(r.Context(), countQuery, args...).Scan(&total); err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "error al contar productos")
		return
	}

	query := `
		SELECT
			p.id, p.nombre, p.sku, COALESCE(p.codigo_barras, ''), p.categoria_id,
			COALESCE(c.nombre, 'General') AS categoria_nombre,
			p.marca_id, COALESCE(m.nombre, 'Sin marca') AS marca_nombre,
			p.unidad_medida_id, COALESCE(u.nombre, 'Unidad') AS unidad_nombre, COALESCE(u.abreviatura, 'un.') AS unidad_abrev,
			COALESCE(p.descripcion, ''), p.proveedor_id, COALESCE(pr.razon_social, '') AS proveedor_nombre,
			p.costo_compra, p.precio_venta, p.iva, p.controlar_stock, p.stock_actual, p.stock_minimo,
			p.activo, p.mostrar_en_web, p.mostrar_precio, p.permitir_sin_stock, p.en_promocion,
			COALESCE(p.foto_principal, ''), COALESCE(p.galeria_fotos, '[]'),
			p.created_at, p.updated_at
		FROM productos p
		LEFT JOIN categorias_productos c ON p.categoria_id = c.id
		LEFT JOIN marcas_productos m ON p.marca_id = m.id
		LEFT JOIN unidades_medida u ON p.unidad_medida_id = u.id
		LEFT JOIN proveedores pr ON p.proveedor_id = pr.id
		` + where + `
		ORDER BY p.id DESC
		LIMIT ? OFFSET ?
	`
	queryArgs := append(args, pageSize, offset)

	rows, err := h.DB.QueryContext(r.Context(), query, queryArgs...)
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "error al consultar productos: "+err.Error())
		return
	}
	defer rows.Close()

	list := make([]models.Producto, 0)
	for rows.Next() {
		var p models.Producto
		var galeriaJSON string
		if err := rows.Scan(
			&p.ID, &p.Nombre, &p.SKU, &p.CodigoBarras, &p.CategoriaID,
			&p.CategoriaNombre,
			&p.MarcaID, &p.MarcaNombre,
			&p.UnidadMedidaID, &p.UnidadMedidaNombre, &p.UnidadMedidaAbrev,
			&p.Descripcion, &p.ProveedorID, &p.ProveedorNombre,
			&p.CostoCompra, &p.PrecioVenta, &p.IVA, &p.ControlarStock, &p.StockActual, &p.StockMinimo,
			&p.Activo, &p.MostrarEnWeb, &p.MostrarPrecio, &p.PermitirSinStock, &p.EnPromocion,
			&p.FotoPrincipal, &galeriaJSON,
			&p.CreatedAt, &p.UpdatedAt,
		); err != nil {
			auth.WriteJSONError(w, http.StatusInternalServerError, "error al leer registro de producto: "+err.Error())
			return
		}
		var galeria []string
		if galeriaJSON != "" {
			_ = json.Unmarshal([]byte(galeriaJSON), &galeria)
		}
		p.GaleriaFotos = galeria
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

func (h *ProductosHandler) GetByID(w http.ResponseWriter, r *http.Request, id int) {
	if h.DB == nil {
		auth.WriteJSONError(w, http.StatusServiceUnavailable, "base de datos no conectada")
		return
	}

	query := `
		SELECT
			p.id, p.nombre, p.sku, COALESCE(p.codigo_barras, ''), p.categoria_id,
			COALESCE(c.nombre, 'General') AS categoria_nombre,
			p.marca_id, COALESCE(m.nombre, 'Sin marca') AS marca_nombre,
			p.unidad_medida_id, COALESCE(u.nombre, 'Unidad') AS unidad_nombre, COALESCE(u.abreviatura, 'un.') AS unidad_abrev,
			COALESCE(p.descripcion, ''), p.proveedor_id, COALESCE(pr.razon_social, '') AS proveedor_nombre,
			p.costo_compra, p.precio_venta, p.iva, p.controlar_stock, p.stock_actual, p.stock_minimo,
			p.activo, p.mostrar_en_web, p.mostrar_precio, p.permitir_sin_stock, p.en_promocion,
			COALESCE(p.foto_principal, ''), COALESCE(p.galeria_fotos, '[]'),
			p.created_at, p.updated_at
		FROM productos p
		LEFT JOIN categorias_productos c ON p.categoria_id = c.id
		LEFT JOIN marcas_productos m ON p.marca_id = m.id
		LEFT JOIN unidades_medida u ON p.unidad_medida_id = u.id
		LEFT JOIN proveedores pr ON p.proveedor_id = pr.id
		WHERE p.id = ? AND p.deleted_at IS NULL
	`

	var p models.Producto
	var galeriaJSON string
	err := h.DB.QueryRowContext(r.Context(), query, id).Scan(
		&p.ID, &p.Nombre, &p.SKU, &p.CodigoBarras, &p.CategoriaID,
		&p.CategoriaNombre,
		&p.MarcaID, &p.MarcaNombre,
		&p.UnidadMedidaID, &p.UnidadMedidaNombre, &p.UnidadMedidaAbrev,
		&p.Descripcion, &p.ProveedorID, &p.ProveedorNombre,
		&p.CostoCompra, &p.PrecioVenta, &p.IVA, &p.ControlarStock, &p.StockActual, &p.StockMinimo,
		&p.Activo, &p.MostrarEnWeb, &p.MostrarPrecio, &p.PermitirSinStock, &p.EnPromocion,
		&p.FotoPrincipal, &galeriaJSON,
		&p.CreatedAt, &p.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		auth.WriteJSONError(w, http.StatusNotFound, "producto no encontrado")
		return
	} else if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "error al obtener producto: "+err.Error())
		return
	}

	var galeria []string
	if galeriaJSON != "" {
		_ = json.Unmarshal([]byte(galeriaJSON), &galeria)
	}
	p.GaleriaFotos = galeria

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(p)
}

func (h *ProductosHandler) Create(w http.ResponseWriter, r *http.Request) {
	if h.DB == nil {
		auth.WriteJSONError(w, http.StatusServiceUnavailable, "base de datos no conectada")
		return
	}

	var payload models.Producto
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		auth.WriteJSONError(w, http.StatusBadRequest, "formato de datos inválido")
		return
	}

	payload.Nombre = strings.TrimSpace(payload.Nombre)
	if payload.Nombre == "" {
		auth.WriteJSONError(w, http.StatusBadRequest, "el nombre del producto es obligatorio")
		return
	}

	payload.SKU = strings.TrimSpace(payload.SKU)
	if payload.SKU == "" {
		auth.WriteJSONError(w, http.StatusBadRequest, "el SKU / código interno es obligatorio")
		return
	}

	if payload.CategoriaID <= 0 {
		auth.WriteJSONError(w, http.StatusBadRequest, "la categoría del producto es obligatoria")
		return
	}

	if payload.UnidadMedidaID <= 0 {
		payload.UnidadMedidaID = 1 // Unidad por defecto
	}

	if payload.IVA == "" {
		payload.IVA = "10%"
	}

	// Verificar SKU único
	var existingID int
	errCheck := h.DB.QueryRowContext(r.Context(), "SELECT id FROM productos WHERE sku = ? AND deleted_at IS NULL", payload.SKU).Scan(&existingID)
	if errCheck == nil {
		auth.WriteJSONError(w, http.StatusConflict, "Ya existe un producto con el SKU '"+payload.SKU+"'. Por favor use otro código o autogenere uno nuevo.")
		return
	}

	galeriaJSON, _ := json.Marshal(payload.GaleriaFotos)

	query := `
		INSERT INTO productos (
			nombre, sku, codigo_barras, categoria_id, marca_id, unidad_medida_id,
			descripcion, proveedor_id, costo_compra, precio_venta, iva,
			controlar_stock, stock_actual, stock_minimo,
			activo, mostrar_en_web, mostrar_precio, permitir_sin_stock, en_promocion,
			foto_principal, galeria_fotos
		) VALUES (
			?, ?, ?, ?, ?, ?,
			?, ?, ?, ?, ?,
			?, ?, ?,
			?, ?, ?, ?, ?,
			?, ?
		)
	`

	res, err := h.DB.ExecContext(r.Context(), query,
		payload.Nombre, payload.SKU, payload.CodigoBarras, payload.CategoriaID, payload.MarcaID, payload.UnidadMedidaID,
		payload.Descripcion, payload.ProveedorID, payload.CostoCompra, payload.PrecioVenta, payload.IVA,
		payload.ControlarStock, payload.StockActual, payload.StockMinimo,
		payload.Activo, payload.MostrarEnWeb, payload.MostrarPrecio, payload.PermitirSinStock, payload.EnPromocion,
		payload.FotoPrincipal, string(galeriaJSON),
	)
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "no se pudo crear el producto: "+err.Error())
		return
	}

	id64, _ := res.LastInsertId()
	payload.ID = int(id64)

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(payload)
}

func (h *ProductosHandler) Update(w http.ResponseWriter, r *http.Request, id int) {
	if h.DB == nil {
		auth.WriteJSONError(w, http.StatusServiceUnavailable, "base de datos no conectada")
		return
	}

	var payload models.Producto
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		auth.WriteJSONError(w, http.StatusBadRequest, "formato de datos inválido")
		return
	}

	payload.Nombre = strings.TrimSpace(payload.Nombre)
	if payload.Nombre == "" {
		auth.WriteJSONError(w, http.StatusBadRequest, "el nombre del producto es obligatorio")
		return
	}

	payload.SKU = strings.TrimSpace(payload.SKU)
	if payload.SKU == "" {
		auth.WriteJSONError(w, http.StatusBadRequest, "el SKU / código interno es obligatorio")
		return
	}

	if payload.CategoriaID <= 0 {
		auth.WriteJSONError(w, http.StatusBadRequest, "la categoría del producto es obligatoria")
		return
	}

	if payload.UnidadMedidaID <= 0 {
		payload.UnidadMedidaID = 1
	}

	if payload.IVA == "" {
		payload.IVA = "10%"
	}

	// Verificar SKU único excluyendo este ID
	var existingID int
	errCheck := h.DB.QueryRowContext(r.Context(), "SELECT id FROM productos WHERE sku = ? AND id != ? AND deleted_at IS NULL", payload.SKU, id).Scan(&existingID)
	if errCheck == nil {
		auth.WriteJSONError(w, http.StatusConflict, "Ya existe otro producto con el SKU '"+payload.SKU+"'. Por favor use otro código.")
		return
	}

	galeriaJSON, _ := json.Marshal(payload.GaleriaFotos)

	query := `
		UPDATE productos SET
			nombre = ?, sku = ?, codigo_barras = ?, categoria_id = ?, marca_id = ?, unidad_medida_id = ?,
			descripcion = ?, proveedor_id = ?, costo_compra = ?, precio_venta = ?, iva = ?,
			controlar_stock = ?, stock_actual = ?, stock_minimo = ?,
			activo = ?, mostrar_en_web = ?, mostrar_precio = ?, permitir_sin_stock = ?, en_promocion = ?,
			foto_principal = ?, galeria_fotos = ?
		WHERE id = ? AND deleted_at IS NULL
	`

	res, err := h.DB.ExecContext(r.Context(), query,
		payload.Nombre, payload.SKU, payload.CodigoBarras, payload.CategoriaID, payload.MarcaID, payload.UnidadMedidaID,
		payload.Descripcion, payload.ProveedorID, payload.CostoCompra, payload.PrecioVenta, payload.IVA,
		payload.ControlarStock, payload.StockActual, payload.StockMinimo,
		payload.Activo, payload.MostrarEnWeb, payload.MostrarPrecio, payload.PermitirSinStock, payload.EnPromocion,
		payload.FotoPrincipal, string(galeriaJSON),
		id,
	)
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "no se pudo actualizar el producto: "+err.Error())
		return
	}

	rowsAff, _ := res.RowsAffected()
	if rowsAff == 0 {
		var exists int
		_ = h.DB.QueryRowContext(r.Context(), "SELECT id FROM productos WHERE id = ? AND deleted_at IS NULL", id).Scan(&exists)
		if exists == 0 {
			auth.WriteJSONError(w, http.StatusNotFound, "producto no encontrado")
			return
		}
	}

	payload.ID = id
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(payload)
}

func (h *ProductosHandler) ToggleActivo(w http.ResponseWriter, r *http.Request, id int) {
	if h.DB == nil {
		auth.WriteJSONError(w, http.StatusServiceUnavailable, "base de datos no conectada")
		return
	}

	var currentActivo int
	err := h.DB.QueryRowContext(r.Context(), "SELECT activo FROM productos WHERE id = ? AND deleted_at IS NULL", id).Scan(&currentActivo)
	if err == sql.ErrNoRows {
		auth.WriteJSONError(w, http.StatusNotFound, "producto no encontrado")
		return
	} else if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "error al consultar estado del producto")
		return
	}

	newActivo := 1
	if currentActivo == 1 {
		newActivo = 0
	}

	_, err = h.DB.ExecContext(r.Context(), "UPDATE productos SET activo = ? WHERE id = ? AND deleted_at IS NULL", newActivo, id)
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "error al actualizar estado del producto")
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"id":     id,
		"activo": newActivo == 1,
	})
}

func (h *ProductosHandler) SoftDelete(w http.ResponseWriter, r *http.Request, id int) {
	if h.DB == nil {
		auth.WriteJSONError(w, http.StatusServiceUnavailable, "base de datos no conectada")
		return
	}

	userName := "Operador Ventas"
	if claims, ok := r.Context().Value(auth.UserClaimsKey).(*auth.Claims); ok && claims != nil && claims.Username != "" {
		userName = claims.Username
	}

	query := `UPDATE productos SET deleted_at = NOW(), deleted_by = ? WHERE id = ? AND deleted_at IS NULL`
	res, err := h.DB.ExecContext(r.Context(), query, userName, id)
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "error al eliminar producto: "+err.Error())
		return
	}
	rowsAff, _ := res.RowsAffected()
	if rowsAff == 0 {
		auth.WriteJSONError(w, http.StatusNotFound, "producto no encontrado o ya eliminado")
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"message": "producto movido al módulo de Reciclaje",
		"id":      id,
	})
}
