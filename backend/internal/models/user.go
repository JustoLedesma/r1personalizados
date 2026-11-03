package models

import "time"

type User struct {
	ID                int               `json:"id"`
	Username          string            `json:"username"`
	Email             string            `json:"email"`
	FullName          string            `json:"fullName"`
	PasswordHash      string            `json:"-"`
	Role              string            `json:"role"`
	Modulos           []string          `json:"modulos"`
	Permissions       map[string]string `json:"permissions"` // module_id -> "editor" | "viewer"
	IsRoot            bool              `json:"isRoot"`
	Active            bool              `json:"active"`
	FotoPerfil        string            `json:"fotoPerfil,omitempty"`
	AutoLogoutMinutes int               `json:"autoLogoutMinutes,omitempty"`
	CreatedAt         time.Time         `json:"createdAt"`
	UpdatedAt         time.Time         `json:"updatedAt"`
	DeletedAt         *time.Time        `json:"deletedAt,omitempty"`
	DeletedBy         *string           `json:"deletedBy,omitempty"`
}
