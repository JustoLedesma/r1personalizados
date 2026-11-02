package models

import "time"

// Budget representa la cabecera de un presupuesto comercial
type Budget struct {
	ID                  int                      `json:"id"`
	NumeroPresupuesto   string                   `json:"numero_presupuesto"`
	FechaEmision        string                   `json:"fecha_emision"`
	ValidezDias         int                      `json:"validez_dias"`
	ValidezFecha        string                   `json:"validez_fecha"`
	Moneda              string                   `json:"moneda"`
	RegimenIVA          string                   `json:"regimen_iva"`
	Estado              string                   `json:"estado"`
	ClienteID           *int                     `json:"cliente_id,omitempty"`
	ClienteCasual       bool                     `json:"cliente_casual"`
	ClienteNombre       string                   `json:"cliente_nombre"`
	ClienteRUC          string                   `json:"cliente_ruc"`
	ClienteTelefono     string                   `json:"cliente_telefono"`
	ClienteEmail        string                   `json:"cliente_email,omitempty"`
	ClienteDireccion    string                   `json:"cliente_direccion,omitempty"`
	Subtotal            float64                  `json:"subtotal"`
	SubtotalFormateado  string                   `json:"subtotal_formateado"`
	PorcentajeDescuento float64                  `json:"porcentaje_descuento"`
	MontoDescuento      float64                  `json:"monto_descuento"`
	MontoDescFormateado string                   `json:"monto_descuento_formateado"`
	TotalFinal          float64                  `json:"total_final"`
	TotalFormateado     string                   `json:"total_final_formateado"`
	LeyendaDescuento    string                   `json:"leyenda_descuento,omitempty"`
	MostrarDescuentoPDF bool                     `json:"mostrar_descuento_pdf"`
	TerminosCondiciones []string                 `json:"terminos_condiciones"`
	Observaciones       string                   `json:"observaciones,omitempty"`
	ServiciosOpcionales []BudgetServicioOpcional `json:"servicios_opcionales,omitempty"`
	GaleriaFotos        []BudgetGaleriaFoto      `json:"galeria_fotos,omitempty"`
	MostrarGaleriaPDF   bool                     `json:"mostrar_galeria_pdf"`
	GaleriaLayout       string                   `json:"galeria_layout"`
	PedidoID            *int                     `json:"pedido_id,omitempty"`
	NumeroPedido        string                   `json:"numero_pedido,omitempty"`
	Items               []BudgetItem             `json:"items"`
	DeletedAt           *time.Time               `json:"deleted_at,omitempty"`
	DeletedBy           string                   `json:"deleted_by,omitempty"`
	CreatedAt           time.Time                `json:"created_at"`
	UpdatedAt           time.Time                `json:"updated_at"`
}

// BudgetServicioOpcional representa un servicio opcional en el presupuesto
type BudgetServicioOpcional struct {
	ID             string  `json:"id,omitempty"`
	Descripcion    string  `json:"descripcion"`
	PrecioUnitario float64 `json:"precio_unitario"`
	Cantidad       int     `json:"cantidad"`
	Subtotal       float64 `json:"subtotal"`
}

// BudgetGaleriaFoto representa una imagen de la galería de la Hoja 3
type BudgetGaleriaFoto struct {
	ID         string `json:"id,omitempty"`
	ProductoID *int   `json:"producto_id,omitempty"`
	Nombre     string `json:"nombre"`
	URL        string `json:"url"`
	Visible    bool   `json:"visible"`
	Orden      int    `json:"orden"`
}

// BudgetItem representa una fila del presupuesto
type BudgetItem struct {
	ID                 int     `json:"id"`
	PresupuestoID      int     `json:"presupuesto_id"`
	ProductoID         *int    `json:"producto_id,omitempty"`
	EsNoRegistrado     bool    `json:"es_no_registrado"`
	SKU                string  `json:"sku,omitempty"`
	Descripcion        string  `json:"descripcion"`
	PrecioUnitario     float64 `json:"precio_unitario"`
	PrecioUnitarioForm string  `json:"precio_unitario_formateado"`
	Cantidad           int     `json:"cantidad"`
	Total              float64 `json:"total"`
	TotalFormateado    string  `json:"total_formateado"`
	ImagenURL          string  `json:"imagen_url,omitempty"`
	Orden              int     `json:"orden"`
	ProveedorID        *int    `json:"proveedor_id,omitempty"`
	ProveedorCasual    bool    `json:"proveedor_casual"`
	ProveedorNombre    string  `json:"proveedor_nombre,omitempty"`
	ProveedorCosto     float64 `json:"proveedor_costo"`
	ProveedorCantidad  int     `json:"proveedor_cantidad"`
}

// BudgetResponse es el DTO completo consumido por el generador de PDF en el cliente
type BudgetResponse struct {
	ID                  int                     `json:"id"`
	NumeroPresupuesto   string                  `json:"numero_presupuesto"`
	FechaEmision        string                  `json:"fecha_emision"`
	ValidezDias         int                     `json:"validez_dias"`
	ValidezFecha        string                  `json:"validez_fecha"`
	Moneda              string                  `json:"moneda"`
	RegimenIVA          string                  `json:"regimen_iva"`
	Estado              string                  `json:"estado"`
	Cliente             BudgetClienteDTO        `json:"cliente"`
	Items               []BudgetItem            `json:"items"`
	ServiciosOpcionales []BudgetServicioOpcional `json:"servicios_opcionales,omitempty"`
	Totales             BudgetTotalesDTO        `json:"totales"`
	TerminosCondiciones []string                `json:"terminos_condiciones"`
	Observaciones       string                  `json:"observaciones,omitempty"`
	ImagenesProductos   []BudgetProductoFotoDTO `json:"imagenes_productos"`
	GaleriaLayout       string                  `json:"galeria_layout"`
	MostrarGaleriaPDF   bool                    `json:"mostrar_galeria_pdf"`
	PedidoID            *int                    `json:"pedido_id,omitempty"`
	NumeroPedido        string                  `json:"numero_pedido,omitempty"`
	Empresa             BudgetEmpresaDTO        `json:"empresa"`
}

type BudgetClienteDTO struct {
	ID        *int   `json:"id,omitempty"`
	Casual    bool   `json:"casual"`
	Nombre    string `json:"nombre"`
	RUC       string `json:"ruc"`
	Telefono  string `json:"telefono"`
	Email     string `json:"email,omitempty"`
	Direccion string `json:"direccion,omitempty"`
	Ciudad    string `json:"ciudad,omitempty"`
}

type BudgetTotalesDTO struct {
	Subtotal                float64 `json:"subtotal"`
	SubtotalFormateado      string  `json:"subtotal_formateado"`
	PorcentajeDescuento     float64 `json:"porcentaje_descuento"`
	MontoDescuento          float64 `json:"monto_descuento"`
	MontoDescuentoFormatead string  `json:"monto_descuento_formateado"`
	TotalFinal              float64 `json:"total_final"`
	TotalFinalFormateado    string  `json:"total_final_formateado"`
	LeyendaDescuento        string  `json:"leyenda_descuento,omitempty"`
	MostrarDescuentoPDF     bool    `json:"mostrar_descuento_pdf"`
}

type BudgetProductoFotoDTO struct {
	ID      string `json:"id,omitempty"`
	Nombre  string `json:"nombre"`
	URL     string `json:"url"`
	Visible bool   `json:"visible"`
	Orden   int    `json:"orden"`
}

type BudgetEmpresaDTO struct {
	LogoURL     string            `json:"logo_url"`
	RazonSocial string            `json:"razon_social"`
	RUC         string            `json:"ruc"`
	Telefonos   []string          `json:"telefonos"`
	Direccion   string            `json:"direccion"`
	SitioWeb    string            `json:"sitio_web"`
	Redes       map[string]string `json:"redes"`
}
