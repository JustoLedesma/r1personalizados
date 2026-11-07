package models

import "time"

type Pedido struct {
	ID                   int                `json:"id"`
	NumeroPedido         string             `json:"numeroPedido"`
	ClienteID            *int               `json:"clienteId,omitempty"`
	ClienteCasual        bool               `json:"clienteCasual"`
	ClienteNombre        string             `json:"clienteNombre"`
	ClienteTelefono      string             `json:"clienteTelefono"`
	ClienteDocumento     string             `json:"clienteDocumento"`
	ClienteDireccion     string             `json:"clienteDireccion"`
	CondicionVenta       string             `json:"condicionVenta"` // 'Contado' | 'Credito'
	FechaPedido          string             `json:"fechaPedido"` // 'YYYY-MM-DD'
	TipoPago             *string            `json:"tipoPago,omitempty"` // 'Total' | 'Parcial'
	FechaCobro           *string            `json:"fechaCobro,omitempty"` // 'YYYY-MM-DD'
	TieneSena            bool               `json:"tieneSena"`
	MontoSena            float64            `json:"montoSena"`
	FechaSena            *string            `json:"fechaSena,omitempty"` // 'YYYY-MM-DD'
	SemanaSenaISO        *int               `json:"semanaSenaIso,omitempty"`
	MetodoPagoSena       string             `json:"metodoPagoSena,omitempty"`
	MontoTotal           float64            `json:"montoTotal"`
	MontoPagado          float64            `json:"montoPagado"`
	SaldoPendiente       float64            `json:"saldoPendiente"`
	ModalidadEntrega     string             `json:"modalidadEntrega"` // 'Retiro en Local' | 'Envío a Domicilio' | 'Encomienda' | 'Otro'
	ModalidadEntregaOtro string             `json:"modalidadEntregaOtro"`
	Estado               string             `json:"estado"` // 'Creado' | 'En Producción' | 'En Pausa' | 'Listo' | 'Cancelado'
	FechaEnProduccion    *string            `json:"fechaEnProduccion,omitempty"`
	FechaEnPausa         *string            `json:"fechaEnPausa,omitempty"`
	FechaListo           *string            `json:"fechaListo,omitempty"`
	HistorialEstados     string             `json:"historialEstados,omitempty"`
	SemanaISO            int                `json:"semanaIso"`
	AnioISO              int                `json:"anioIso"`
	NotasProduccion      string             `json:"notasProduccion"`
	Items                []PedidoItem       `json:"items,omitempty"`
	Proveedores          []PedidoProveedor  `json:"proveedores,omitempty"`
	DeletedAt            *time.Time         `json:"deletedAt,omitempty"`
	DeletedBy            *string            `json:"deletedBy,omitempty"`
	CreatedAt            time.Time          `json:"createdAt"`
	UpdatedAt            time.Time          `json:"updatedAt"`
}

type PedidoItem struct {
	ID              int       `json:"id"`
	PedidoID        int       `json:"pedidoId"`
	ProductoID      *int      `json:"productoId,omitempty"`
	EsNoRegistrado  bool      `json:"esNoRegistrado"`
	NombreProducto  string    `json:"nombreProducto"`
	SKU             string    `json:"sku"`
	Cantidad        float64   `json:"cantidad"`
	PrecioUnitario  float64   `json:"precioUnitario"`
	Subtotal        float64   `json:"subtotal"`
	CreatedAt       time.Time `json:"createdAt"`
	UpdatedAt       time.Time `json:"updatedAt"`
}

type PedidoProveedor struct {
	ID              int       `json:"id"`
	PedidoID        int       `json:"pedidoId"`
	ProveedorID     *int      `json:"proveedorId,omitempty"`
	EsNoRegistrado  bool      `json:"esNoRegistrado"`
	NombreProveedor string    `json:"nombreProveedor"`
	ProductoID      *int      `json:"productoId,omitempty"`
	ProductoNombre  string    `json:"productoNombre"`
	Cantidad        float64   `json:"cantidad"`
	Costo           float64   `json:"costo"`
	Subtotal        float64   `json:"subtotal"`
	EstadoPago      string    `json:"estadoPago"` // 'Pendiente' | 'Pagado' | 'Pago Parcial'
	MontoPagado     float64   `json:"montoPagado"`
	SaldoPendiente  float64   `json:"saldoPendiente"`
	CreatedAt       time.Time `json:"createdAt"`
	UpdatedAt       time.Time `json:"updatedAt"`
}

type PedidoStats struct {
	Total        int `json:"total"`
	Creados      int `json:"creados"`
	EnProduccion int `json:"enProduccion"`
	EnPausa      int `json:"enPausa"`
	Listos       int `json:"listos"`
	Cancelados   int `json:"cancelados"`
}

