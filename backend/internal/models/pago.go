package models

import "time"

type PagoParcialItem struct {
	Monto      float64 `json:"monto"`
	FechaPago  string  `json:"fechaPago"`
	SemanaISO  int     `json:"semanaIso"`
	AnioISO    int     `json:"anioIso"`
	MetodoPago string  `json:"metodoPago,omitempty"`
	Notas      string  `json:"notas,omitempty"`
}

type Pago struct {
	ID                  int               `json:"id"`
	NumeroPago          string            `json:"numeroPago"`
	PedidoID            *int              `json:"pedidoId,omitempty"`
	NumeroPedido        string            `json:"numeroPedido,omitempty"`
	PedidoProveedorID   *int              `json:"pedidoProveedorId,omitempty"`
	TipoBeneficiario    string            `json:"tipoBeneficiario"` // 'Proveedor' | 'Colaborador' | 'Otros' | 'Cliente'
	ReferenciaPago      string            `json:"referenciaPago"`
	ProveedorID         *int              `json:"proveedorId,omitempty"`
	ProveedorNombre     string            `json:"proveedorNombre"`
	ProveedorRUC        string            `json:"proveedorRuc"`
	EsProveedorTemporal bool              `json:"esProveedorTemporal"`
	ClienteID           *int              `json:"clienteId,omitempty"`
	ClienteNombre       string            `json:"clienteNombre"`
	ClienteDocumento    string            `json:"clienteDocumento"`
	ClienteTelefono     string            `json:"clienteTelefono"`
	ProductoID          *int              `json:"productoId,omitempty"`
	ProductoNombre      string            `json:"productoNombre"`
	EsProductoTemporal  bool              `json:"esProductoTemporal"`
	Cantidad            float64           `json:"cantidad"`
	MontoTotal          float64           `json:"montoTotal"`
	MontoPagado         float64           `json:"montoPagado"`
	SaldoPendiente      float64           `json:"saldoPendiente"`
	EstadoPago          string            `json:"estadoPago"` // 'Pendiente' | 'Pagado' | 'Pago Parcial'
	MetodoPago          string            `json:"metodoPago"`
	FechaPago           string            `json:"fechaPago"` // 'YYYY-MM-DD'
	SemanaISO           int               `json:"semanaIso"`
	AnioISO             int               `json:"anioIso"`
	HistorialParciales  []PagoParcialItem `json:"historialParciales"`
	Notas               string            `json:"notas"`
	EsRecurrente        bool              `json:"esRecurrente"`
	RecurrenciaFrecuencia string          `json:"recurrenciaFrecuencia,omitempty"`
	RecurrenciaTipoDia  string            `json:"recurrenciaTipoDia,omitempty"`
	RecurrenciaFechaInicio string         `json:"recurrenciaFechaInicio,omitempty"`
	RecurrenciaFechaFin string            `json:"recurrenciaFechaFin,omitempty"`
	RecurrenciaGrupoID  string            `json:"recurrenciaGrupoId,omitempty"`
	CreatedBy           *string           `json:"createdBy,omitempty"`
	DeletedAt           *time.Time        `json:"deletedAt,omitempty"`
	DeletedBy           *string           `json:"deletedBy,omitempty"`
	CreatedAt           time.Time         `json:"createdAt"`
	UpdatedAt           time.Time         `json:"updatedAt"`
}

type PagoStats struct {
	Total             int     `json:"total"`
	Pendientes        int     `json:"pendientes"`
	PagadosHoy        int     `json:"pagadosHoy"`
	PagadosSemana     int     `json:"pagadosSemana"`
	PagadosMes        int     `json:"pagadosMes"`
	MontoTotal        float64 `json:"montoTotal"`
	MontoPendiente    float64 `json:"montoPendiente"`
	MontoPagado       float64 `json:"montoPagado"`
	MontoHoy          float64 `json:"montoHoy"`
	MontoSemana       float64 `json:"montoSemana"`
	MontoMes          float64 `json:"montoMes"`
	MontoPagadoHoy    float64 `json:"montoPagadoHoy"`
	MontoPagadoSemana float64 `json:"montoPagadoSemana"`
	MontoPagadoMes    float64 `json:"montoPagadoMes"`
}

