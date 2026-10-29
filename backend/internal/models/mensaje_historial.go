package models

import "time"

type MensajeHistorial struct {
	ID                   int       `json:"id"`
	Tipo                 string    `json:"tipo"`                 // "Mensaje" | "Difusión" | "Programado"
	ContactoOrigen       string    `json:"contactoOrigen"`       // "Cliente" | "Proveedor" | "Manual"
	NombreDestinatario   string    `json:"nombreDestinatario"`   // Nombre del cliente/proveedor o "—"
	TelefonoDestinatario string    `json:"telefonoDestinatario"` // Ej: 595986901117
	PlantillaTitulo      string    `json:"plantillaTitulo"`
	Contenido            string    `json:"contenido"`
	AdjuntoNombre        string    `json:"adjuntoNombre"`
	AdjuntoFormato       string    `json:"adjuntoFormato"`
	AdjuntoMime          string    `json:"adjuntoMime"`
	AdjuntoData          string    `json:"adjuntoData"` // DataURL o URL externa
	IntervaloSegundos    int       `json:"intervaloSegundos"`
	ProgramadoPara       string    `json:"programadoPara"`
	Estado               string    `json:"estado"` // "Enviado" | "Programado" | "En Cola"
	CreatedAt            time.Time `json:"createdAt"`
	UpdatedAt            time.Time `json:"updatedAt"`
}

