package models

import "time"

type Proveedor struct {
	ID                     int        `json:"id"`
	TipoProveedor          string     `json:"tipoProveedor"` // "Empresa" | "Persona Física"
	RazonSocial            string     `json:"razonSocial"`
	NombreComercial        string     `json:"nombreComercial"`
	RucDocumento           string     `json:"rucDocumento"`
	Direccion              string     `json:"direccion"`
	Ciudad                 string     `json:"ciudad"`
	Pais                   string     `json:"pais"`
	TelefonoCodigo         string     `json:"telefonoCodigo"`
	TelefonoNumero         string     `json:"telefonoNumero"`
	TelefonoCorporativo    string     `json:"telefonoCorporativo"`
	EmailGeneral           string     `json:"emailGeneral"`
	SitioWeb               string     `json:"sitioWeb"`
	ContactoNombre         string     `json:"contactoNombre"`
	ContactoCargo          string     `json:"contactoCargo"`
	WhatsappCodigo         string     `json:"whatsappCodigo"`
	WhatsappNumero         string     `json:"whatsappNumero"`
	ContactoTelefono       string     `json:"contactoTelefono"`
	ContactoEmail          string     `json:"contactoEmail"`
	Banco                  string     `json:"banco"`
	NumeroCuenta           string     `json:"numeroCuenta"`
	Moneda                 string     `json:"moneda"`        // "Gs" | "USD" | "Reales"
	CondicionPago          string     `json:"condicionPago"` // "Contado" | "Crédito 15 días" | "Crédito 30 días"
	Rubro                  string     `json:"rubro"`
	TiempoEntregaDias      int        `json:"tiempoEntregaDias"`
	Estado                 string     `json:"estado"` // "Activo" | "Inactivo"
	DeletedAt              *time.Time `json:"deletedAt,omitempty"`
	CreatedAt              time.Time  `json:"createdAt"`
	UpdatedAt              time.Time  `json:"updatedAt"`
}
