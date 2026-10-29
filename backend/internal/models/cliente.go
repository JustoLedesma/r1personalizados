package models

import "time"

type Cliente struct {
	ID                     int        `json:"id"`
	TipoCliente            string     `json:"tipoCliente"` // "persona_fisica" | "empresa"
	TipoDocumento          string     `json:"tipoDocumento"`
	NumeroDocumento        string     `json:"numeroDocumento"`
	Nombres                string     `json:"nombres"`
	Apellidos              string     `json:"apellidos"`
	FechaNacimiento        string     `json:"fechaNacimiento"`
	Sexo                   string     `json:"sexo"`
	Nacionalidad           string     `json:"nacionalidad"`
	RucBase                string     `json:"rucBase"`
	RazonSocial            string     `json:"razonSocial"`
	NombreFantasia         string     `json:"nombreFantasia"`
	Ruc                    string     `json:"ruc"`
	RepresentanteNombre    string     `json:"representanteNombre"`
	RepresentanteDocumento string     `json:"representanteDocumento"`
	PersonaContacto        string     `json:"personaContacto"`
	WhatsappCodigo         string     `json:"whatsappCodigo"`
	WhatsappNumero         string     `json:"whatsappNumero"`
	WhatsappCompleto       string     `json:"whatsappCompleto"`
	TelefonoCodigo         string     `json:"telefonoCodigo"`
	TelefonoNumero         string     `json:"telefonoNumero"`
	TelefonoCompleto       string     `json:"telefonoCompleto"`
	Email                  string     `json:"email"`
	Direccion              string     `json:"direccion"`
	Departamento           string     `json:"departamento"`
	Ciudad                 string     `json:"ciudad"`
	Barrio                 string     `json:"barrio"`
	Referencia             string     `json:"referencia"`
	Activo                 bool       `json:"activo"`
	DeletedAt              *time.Time `json:"deletedAt,omitempty"`
	CreatedAt              time.Time  `json:"createdAt"`
	UpdatedAt              time.Time  `json:"updatedAt"`
}
