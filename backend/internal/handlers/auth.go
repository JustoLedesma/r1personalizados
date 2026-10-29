package handlers

import (
	"database/sql"
	"encoding/json"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"r1/backend/internal/auth"
	"r1/backend/internal/models"

	"golang.org/x/crypto/bcrypt"
)

type AuthHandler struct {
	DB       *sql.DB
	mu       sync.Mutex
	attempts map[string][]time.Time
}

func NewAuthHandler(dbConn *sql.DB) *AuthHandler {
	return &AuthHandler{
		DB:       dbConn,
		attempts: make(map[string][]time.Time),
	}
}

func (h *AuthHandler) allowAttempt(ip string) bool {
	h.mu.Lock()
	defer h.mu.Unlock()

	now := time.Now()
	cutoff := now.Add(-1 * time.Minute)
	var valid []time.Time
	for _, t := range h.attempts[ip] {
		if t.After(cutoff) {
			valid = append(valid, t)
		}
	}
	if len(valid) >= 10 {
		h.attempts[ip] = valid
		return false
	}
	h.attempts[ip] = append(valid, now)
	return true
}

func clientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		return strings.TrimSpace(parts[0])
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

func setAuthCookies(w http.ResponseWriter, r *http.Request, accessToken, refreshToken string) {
	isSecure := r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https"

	http.SetCookie(w, &http.Cookie{
		Name:     "access_token",
		Value:    accessToken,
		Path:     "/",
		HttpOnly: true,
		Secure:   isSecure,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   3600,
	})
	http.SetCookie(w, &http.Cookie{
		Name:     "refresh_token",
		Value:    refreshToken,
		Path:     "/",
		HttpOnly: true,
		Secure:   isSecure,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   7 * 24 * 3600,
	})
}

func clearAuthCookies(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     "access_token",
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		MaxAge:   -1,
	})
	http.SetCookie(w, &http.Cookie{
		Name:     "refresh_token",
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		MaxAge:   -1,
	})
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		auth.WriteJSONError(w, http.StatusMethodNotAllowed, "método no permitido")
		return
	}

	ip := clientIP(r)
	if !h.allowAttempt(ip) {
		auth.WriteJSONError(w, http.StatusTooManyRequests, "demasiados intentos, espere un minuto")
		return
	}

	var req struct {
		Identifier string `json:"identifier"`
		Password   string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		auth.WriteJSONError(w, http.StatusBadRequest, "datos de entrada inválidos")
		return
	}

	identifier := strings.TrimSpace(req.Identifier)
	if identifier == "" || req.Password == "" {
		auth.WriteJSONError(w, http.StatusBadRequest, "credenciales inválidas")
		return
	}

	var u models.User
	if h.DB != nil {
		err := h.DB.QueryRowContext(r.Context(), `
			SELECT u.id, u.username, u.email, u.full_name, u.password_hash, r.name, u.active
			FROM users u
			INNER JOIN roles r ON r.id = u.role_id
			WHERE (u.email = ? OR u.username = ?) AND u.active = 1
			LIMIT 1
		`, identifier, identifier).Scan(&u.ID, &u.Username, &u.Email, &u.FullName, &u.PasswordHash, &u.Role, &u.Active)
		if err != nil {
			auth.WriteJSONError(w, http.StatusUnauthorized, "credenciales inválidas")
			return
		}
		if err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(req.Password)); err != nil {
			auth.WriteJSONError(w, http.StatusUnauthorized, "credenciales inválidas")
			return
		}
	} else {
		// Modo vista previa inicial mientras el usuario completa backend/.env
		u = models.User{
			ID:       1,
			Username: "admin",
			Email:    identifier,
			FullName: "Operador Ventas",
			Role:     "admin",
			Active:   true,
		}
	}

	accessToken, err := auth.GenerateToken(u.ID, u.Username, u.FullName, u.Role, "access", 1*time.Hour)
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "error al generar sesión")
		return
	}
	refreshToken, err := auth.GenerateToken(u.ID, u.Username, u.FullName, u.Role, "refresh", 7*24*time.Hour)
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "error al generar sesión")
		return
	}

	setAuthCookies(w, r, accessToken, refreshToken)
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"user": u,
	})
}

func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		auth.WriteJSONError(w, http.StatusMethodNotAllowed, "método no permitido")
		return
	}
	clearAuthCookies(w)
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]string{"message": "sesión cerrada"})
}

func (h *AuthHandler) Refresh(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		auth.WriteJSONError(w, http.StatusMethodNotAllowed, "método no permitido")
		return
	}
	cookie, err := r.Cookie("refresh_token")
	if err != nil || cookie.Value == "" {
		auth.WriteJSONError(w, http.StatusUnauthorized, "sin token de refresco")
		return
	}
	claims, err := auth.ParseToken(cookie.Value, "refresh")
	if err != nil {
		clearAuthCookies(w)
		auth.WriteJSONError(w, http.StatusUnauthorized, "sesión expirada")
		return
	}

	accessToken, err := auth.GenerateToken(claims.UserID, claims.Username, claims.FullName, claims.Role, "access", 1*time.Hour)
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "error renovando sesión")
		return
	}
	refreshToken, err := auth.GenerateToken(claims.UserID, claims.Username, claims.FullName, claims.Role, "refresh", 7*24*time.Hour)
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "error renovando sesión")
		return
	}

	setAuthCookies(w, r, accessToken, refreshToken)
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	claims, ok := r.Context().Value(auth.UserClaimsKey).(*auth.Claims)
	if !ok || claims == nil {
		auth.WriteJSONError(w, http.StatusUnauthorized, "no autenticado")
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"user": models.User{
			ID:       claims.UserID,
			Username: claims.Username,
			FullName: claims.FullName,
			Role:     claims.Role,
			Active:   true,
		},
	})
}

