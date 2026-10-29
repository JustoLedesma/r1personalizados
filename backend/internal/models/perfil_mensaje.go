package models

import "time"

type PerfilMensaje struct {
	ID          int       `json:"id"`
	Titulo      string    `json:"titulo"`
	Categoria   string    `json:"categoria"`
	Descripcion string    `json:"descripcion"`
	Contenido   string    `json:"contenido"`
	Activo      bool      `json:"activo"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

