package models

import "time"

type User struct {
	ID           int       `json:"id"`
	Username     string    `json:"username"`
	Email        string    `json:"email"`
	FullName     string    `json:"fullName"`
	PasswordHash string    `json:"-"`
	Role         string    `json:"role"`
	Modulos      []string  `json:"modulos"`
	Active       bool      `json:"active"`
	CreatedAt    time.Time `json:"createdAt"`
}

