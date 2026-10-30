package models

import "time"

type ConfiguracionItem struct {
	Clave     string    `json:"clave"`
	Valor     string    `json:"valor"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type CategoriaProducto struct {
	ID        int        `json:"id"`
	Nombre    string     `json:"nombre"`
	Activo    bool       `json:"activo"`
	DeletedAt *time.Time `json:"deletedAt,omitempty"`
	DeletedBy string     `json:"deletedBy,omitempty"`
	CreatedAt time.Time  `json:"createdAt"`
	UpdatedAt time.Time  `json:"updatedAt"`
}

type MarcaProducto struct {
	ID        int        `json:"id"`
	Nombre    string     `json:"nombre"`
	Activo    bool       `json:"activo"`
	DeletedAt *time.Time `json:"deletedAt,omitempty"`
	DeletedBy string     `json:"deletedBy,omitempty"`
	CreatedAt time.Time  `json:"createdAt"`
	UpdatedAt time.Time  `json:"updatedAt"`
}

type UnidadMedida struct {
	ID               int        `json:"id"`
	Nombre           string     `json:"nombre"`
	Abreviatura      string     `json:"abreviatura"`
	PermiteDecimales bool       `json:"permiteDecimales"`
	Activo           bool       `json:"activo"`
	DeletedAt        *time.Time `json:"deletedAt,omitempty"`
	DeletedBy        string     `json:"deletedBy,omitempty"`
	CreatedAt        time.Time  `json:"createdAt"`
	UpdatedAt        time.Time  `json:"updatedAt"`
}

type UserProfile struct {
	ID                int    `json:"id"`
	Username          string `json:"username"`
	Email             string `json:"email"`
	FullName          string `json:"fullName"`
	Role              string `json:"role"`
	FechaNacimiento   string `json:"fechaNacimiento"`
	FotoPerfil        string `json:"fotoPerfil"`
	AutoLogoutMinutes int    `json:"autoLogoutMinutes"`
}

