package models

import "time"

// Budget representa la cabecera de un presupuesto comercial
type Budget struct {
	ID                  int          `json:"id"`
	NumeroPresupuesto   string       `json:"numero_presupuesto"`
	FechaEmision        string       `json:"fecha_emision"`
	ValidezDias         int          `json:"validez_dias"`
	ValidezFecha        string       `json:"validez_fecha"`
	Estado              string       `json:"estado"`
	ClienteID           *int         `json:"cliente_id,omitempty"`
	ClienteNombre       string       `json:"cliente_nombre"`
	ClienteRUC          string       `json:"cliente_ruc"`
	ClienteTelefono     string       `json:"cliente_telefono"`
	ClienteEmail        string       `json:"cliente_email"`
	ClienteDireccion    string       `json:"cliente_direccion"`
	Subtotal            float64      `json:"subtotal"`
	SubtotalFormateado  string       `json:"subtotal_formateado"`
	PorcentajeDescuento float64      `json:"porcentaje_descuento"`
	MontoDescuento      float64      `json:"monto_descuento"`
	MontoDescFormateado string       `json:"monto_descuento_formateado"`
	TotalFinal          float64      `json:"total_final"`
	TotalFormateado     string       `json:"total_final_formateado"`
	LeyendaDescuento    string       `json:"leyenda_descuento,omitempty"`
	TerminosCondiciones []string     `json:"terminos_condiciones"`
	Items               []BudgetItem `json:"items"`
	DeletedAt           *time.Time   `json:"deleted_at,omitempty"`
	DeletedBy           string       `json:"deleted_by,omitempty"`
	CreatedAt           time.Time    `json:"created_at"`
	UpdatedAt           time.Time    `json:"updated_at"`
}

// BudgetItem representa una fila del presupuesto
type BudgetItem struct {
	ID                 int     `json:"id"`
	PresupuestoID      int     `json:"presupuesto_id"`
	ProductoID         *int    `json:"producto_id,omitempty"`
	Descripcion        string  `json:"descripcion"`
	PrecioUnitario     float64 `json:"precio_unitario"`
	PrecioUnitarioForm string  `json:"precio_unitario_formateado"`
	Cantidad           int     `json:"cantidad"`
	Total              float64 `json:"total"`
	TotalFormateado    string  `json:"total_formateado"`
	ImagenURL          string  `json:"imagen_url,omitempty"`
}

// BudgetResponse es el DTO completo consumido por el generador de PDF en el cliente
type BudgetResponse struct {
	ID                  int                     `json:"id"`
	NumeroPresupuesto   string                  `json:"numero_presupuesto"`
	FechaEmision        string                  `json:"fecha_emision"`
	ValidezDias         int                     `json:"validez_dias"`
	ValidezFecha        string                  `json:"validez_fecha"`
	Estado              string                  `json:"estado"`
	Cliente             BudgetClienteDTO        `json:"cliente"`
	Items               []BudgetItem            `json:"items"`
	Totales             BudgetTotalesDTO        `json:"totales"`
	TerminosCondiciones []string                `json:"terminos_condiciones"`
	ImagenesProductos   []BudgetProductoFotoDTO `json:"imagenes_productos"`
	Empresa             BudgetEmpresaDTO        `json:"empresa"`
}

type BudgetClienteDTO struct {
	ID        *int   `json:"id,omitempty"`
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
}

type BudgetProductoFotoDTO struct {
	Nombre string `json:"nombre"`
	URL    string `json:"url"`
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

