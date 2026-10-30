package models

import "time"

type Producto struct {
	ID                 int        `json:"id"`
	Nombre             string     `json:"nombre"`
	SKU                string     `json:"sku"`
	CodigoBarras       string     `json:"codigoBarras"`
	CategoriaID        int        `json:"categoriaId"`
	CategoriaNombre    string     `json:"categoriaNombre,omitempty"`
	MarcaID            *int       `json:"marcaId"`
	MarcaNombre        string     `json:"marcaNombre,omitempty"`
	UnidadMedidaID     int        `json:"unidadMedidaId"`
	UnidadMedidaNombre string     `json:"unidadMedidaNombre,omitempty"`
	UnidadMedidaAbrev  string     `json:"unidadMedidaAbrev,omitempty"`
	Descripcion        string     `json:"descripcion"`
	ProveedorID        *int       `json:"proveedorId"`
	ProveedorNombre    string     `json:"proveedorNombre,omitempty"`
	CostoCompra        float64    `json:"costoCompra"`
	PrecioVenta        float64    `json:"precioVenta"`
	IVA                string     `json:"iva"`
	ControlarStock     bool       `json:"controlarStock"`
	StockActual        float64    `json:"stockActual"`
	StockMinimo        float64    `json:"stockMinimo"`
	Activo             bool       `json:"activo"`
	MostrarEnWeb       bool       `json:"mostrarEnWeb"`
	MostrarPrecio      bool       `json:"mostrarPrecio"`
	PermitirSinStock   bool       `json:"permitirSinStock"`
	EnPromocion        bool       `json:"enPromocion"`
	FotoPrincipal      string     `json:"fotoPrincipal"`
	GaleriaFotos       []string   `json:"galeriaFotos"`
	DeletedAt          *time.Time `json:"deletedAt,omitempty"`
	DeletedBy          *string    `json:"deletedBy,omitempty"`
	CreatedAt          time.Time  `json:"createdAt"`
	UpdatedAt          time.Time  `json:"updatedAt"`
}

