package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"r1/backend/internal/audit"
	"r1/backend/internal/auth"
	"r1/backend/internal/models"

	"golang.org/x/crypto/bcrypt"
)

type failedAttempt struct {
	Count        int
	LastFail     time.Time
	BlockedUntil time.Time
}

type AuthHandler struct {
	DB      *sql.DB
	Audit   *audit.Service
	mu      sync.Mutex
	failsIP map[string]*failedAttempt
}

func NewAuthHandler(dbConn *sql.DB, auditSvc *audit.Service) *AuthHandler {
	return &AuthHandler{
		DB:      dbConn,
		Audit:   auditSvc,
		failsIP: make(map[string]*failedAttempt),
	}
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

func (h *AuthHandler) checkBruteForce(ip string) (bool, string) {
	h.mu.Lock()
	defer h.mu.Unlock()

	att, exists := h.failsIP[ip]
	if !exists {
		return true, ""
	}

	now := time.Now()
	if att.BlockedUntil.After(now) {
		remaining := int(att.BlockedUntil.Sub(now).Minutes()) + 1
		return false, fmt.Sprintf("Demasiados intentos fallidos. Bloqueado temporalmente por %d minuto(s).", remaining)
	}

	return true, ""
}

func (h *AuthHandler) recordFail(ip string) {
	h.mu.Lock()
	defer h.mu.Unlock()

	now := time.Now()
	att, exists := h.failsIP[ip]
	if !exists {
		att = &failedAttempt{}
		h.failsIP[ip] = att
	}

	// Si el último fallo fue hace más de 15 minutos, reiniciar conteo
	if att.LastFail.Before(now.Add(-15 * time.Minute)) {
		att.Count = 0
	}

	att.Count++
	att.LastFail = now

	// Bloquear a los 5 intentos por 5 minutos
	if att.Count >= 5 {
		att.BlockedUntil = now.Add(5 * time.Minute)
	}
}

func (h *AuthHandler) resetFail(ip string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.failsIP, ip)
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
		MaxAge:   3600, // 1 hora
	})
	http.SetCookie(w, &http.Cookie{
		Name:     "refresh_token",
		Value:    refreshToken,
		Path:     "/",
		HttpOnly: true,
		Secure:   isSecure,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   7 * 24 * 3600, // 7 días
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
	if allowed, msg := h.checkBruteForce(ip); !allowed {
		auth.WriteJSONError(w, http.StatusTooManyRequests, msg)
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
		auth.WriteJSONError(w, http.StatusBadRequest, "credenciales requeridas")
		return
	}

	ctx := r.Context()

	// 1. Verificación de Usuario ROOT Oculto (desde .env)
	rootUser := strings.Trim(strings.TrimSpace(os.Getenv("ROOT_USER")), "'\"")
	rootHash := strings.Trim(strings.TrimSpace(os.Getenv("ROOT_PASSWORD_HASH")), "'\"")

	if rootUser != "" && rootHash != "" && strings.EqualFold(identifier, rootUser) {
		if err := bcrypt.CompareHashAndPassword([]byte(rootHash), []byte(req.Password)); err != nil {
			h.recordFail(ip)
			if h.Audit != nil {
				_ = h.Audit.Log(ctx, audit.LogEntry{
					Username:   rootUser,
					IsRoot:     true,
					IPAddress:  ip,
					Module:     "Autenticación",
					Action:     "login_fallido",
					EntityName: "Intento fallido de acceso root",
				})
			}
			auth.WriteJSONError(w, http.StatusUnauthorized, "credenciales inválidas")
			return
		}

		// Login de ROOT exitoso
		h.resetFail(ip)

		// ROOT tiene todos los permisos en modo 'editor'
		allModules := []string{
			"dashboard", "pedidos", "presupuestos", "clientes", "proveedores",
			"pagos", "productos", "perfiles-mensajes", "sesiones-whatsapp",
			"difusion-mensajes", "usuarios-roles", "reciclaje", "configuracion",
		}
		rootPerms := make(map[string]string)
		for _, m := range allModules {
			rootPerms[m] = "editor"
		}

		accessToken, err := auth.GenerateTokenWithPerms(0, rootUser, "Super Administrador", "admin", true, rootPerms, "access", 2*time.Hour)
		if err != nil {
			auth.WriteJSONError(w, http.StatusInternalServerError, "error al generar sesión")
			return
		}
		refreshToken, err := auth.GenerateTokenWithPerms(0, rootUser, "Super Administrador", "admin", true, rootPerms, "refresh", 7*24*time.Hour)
		if err != nil {
			auth.WriteJSONError(w, http.StatusInternalServerError, "error al generar sesión")
			return
		}

		setAuthCookies(w, r, accessToken, refreshToken)

		if h.Audit != nil {
			_ = h.Audit.Log(ctx, audit.LogEntry{
				Username:   rootUser,
				IsRoot:     true,
				IPAddress:  ip,
				Module:     "Autenticación",
				Action:     "login",
				EntityName: "Sesión iniciada correctamente",
			})
		}

		var rootFoto string
		var rootAutoLogout int
		if h.DB != nil {
			var raw string
			if err := h.DB.QueryRowContext(ctx, "SELECT valor FROM configuraciones WHERE clave = 'root_profile'").Scan(&raw); err == nil {
				var rp struct {
					FotoPerfil        string `json:"foto_perfil"`
					AutoLogoutMinutes int    `json:"auto_logout_minutes"`
				}
				if json.Unmarshal([]byte(raw), &rp) == nil {
					rootFoto = rp.FotoPerfil
					rootAutoLogout = rp.AutoLogoutMinutes
				}
			}
		}

		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"user": models.User{
				ID:                0,
				Username:          rootUser,
				Email:             rootUser + "@netz.local",
				FullName:          "Super Administrador",
				Role:              "admin",
				IsRoot:            true,
				Permissions:       rootPerms,
				Active:            true,
				FotoPerfil:        rootFoto,
				AutoLogoutMinutes: rootAutoLogout,
			},
		})
		return
	}

	// 2. Verificación de Usuario común en Base de Datos
	if h.DB == nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "servicio de base de datos no disponible")
		return
	}

	var u models.User
	var fotoPerf sql.NullString
	var autoLogout sql.NullInt64
	err := h.DB.QueryRowContext(ctx, `
		SELECT u.id, u.username, u.email, u.full_name, u.password_hash, r.name, u.active, u.foto_perfil, COALESCE(u.auto_logout_minutes, 0)
		FROM users u
		INNER JOIN roles r ON r.id = u.role_id
		WHERE (u.email = ? OR u.username = ?) AND u.deleted_at IS NULL
		LIMIT 1
	`, identifier, identifier).Scan(&u.ID, &u.Username, &u.Email, &u.FullName, &u.PasswordHash, &u.Role, &u.Active, &fotoPerf, &autoLogout)

	if err != nil {
		h.recordFail(ip)
		isRootAttempt := strings.EqualFold(identifier, "root") || (rootUser != "" && strings.EqualFold(identifier, rootUser))
		if h.Audit != nil {
			_ = h.Audit.Log(ctx, audit.LogEntry{
				Username:   identifier,
				IsRoot:     isRootAttempt,
				IPAddress:  ip,
				Module:     "Autenticación",
				Action:     "login_fallido",
				EntityName: "Intento fallido (usuario no encontrado)",
			})
		}
		auth.WriteJSONError(w, http.StatusUnauthorized, "credenciales inválidas")
		return
	}

	if !u.Active {
		if h.Audit != nil {
			_ = h.Audit.Log(ctx, audit.LogEntry{
				UserID:     &u.ID,
				Username:   u.Username,
				IsRoot:     false,
				IPAddress:  ip,
				Module:     "Autenticación",
				Action:     "login_fallido",
				EntityName: "Intento en cuenta desactivada",
			})
		}
		auth.WriteJSONError(w, http.StatusForbidden, "cuenta desactivada por el administrador")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(req.Password)); err != nil {
		h.recordFail(ip)
		if h.Audit != nil {
			_ = h.Audit.Log(ctx, audit.LogEntry{
				UserID:     &u.ID,
				Username:   u.Username,
				IsRoot:     false,
				IPAddress:  ip,
				Module:     "Autenticación",
				Action:     "login_fallido",
				EntityName: "Contraseña incorrecta",
			})
		}
		auth.WriteJSONError(w, http.StatusUnauthorized, "credenciales inválidas")
		return
	}

	h.resetFail(ip)
	if fotoPerf.Valid {
		u.FotoPerfil = fotoPerf.String
	}
	if autoLogout.Valid {
		u.AutoLogoutMinutes = int(autoLogout.Int64)
	}

	// Cargar permisos específicos por módulo del usuario
	perms := h.loadUserPermissions(ctx, u.ID, u.Role)
	u.Permissions = perms

	accessToken, err := auth.GenerateTokenWithPerms(u.ID, u.Username, u.FullName, u.Role, false, perms, "access", 1*time.Hour)
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "error al generar sesión")
		return
	}
	refreshToken, err := auth.GenerateTokenWithPerms(u.ID, u.Username, u.FullName, u.Role, false, perms, "refresh", 7*24*time.Hour)
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "error al generar sesión")
		return
	}

	setAuthCookies(w, r, accessToken, refreshToken)

	if h.Audit != nil {
		_ = h.Audit.Log(ctx, audit.LogEntry{
			UserID:     &u.ID,
			Username:   u.Username,
			IsRoot:     false,
			IPAddress:  ip,
			Module:     "Autenticación",
			Action:     "login",
			EntityName: "Inicio de sesión exitoso",
		})
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"user": u,
	})
}

func (h *AuthHandler) loadUserPermissions(ctx context.Context, userID int, role string) map[string]string {
	perms := make(map[string]string)
	allModules := []string{
		"dashboard", "pedidos", "presupuestos", "clientes", "proveedores",
		"pagos", "productos", "perfiles-mensajes", "sesiones-whatsapp",
		"difusion-mensajes", "reciclaje", "configuracion",
	}

	if role == "admin" {
		allModules = append(allModules, "usuarios-roles")
		for _, m := range allModules {
			perms[m] = "editor"
		}
		return perms
	}

	if h.DB == nil {
		return perms
	}

	rows, err := h.DB.QueryContext(ctx, `
		SELECT module_id, access_level
		FROM user_module_permissions
		WHERE user_id = ?
	`, userID)
	if err != nil {
		return perms
	}
	defer rows.Close()

	for rows.Next() {
		var mod, lvl string
		if err := rows.Scan(&mod, &lvl); err == nil {
			perms[mod] = lvl
		}
	}
	return perms
}

func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		auth.WriteJSONError(w, http.StatusMethodNotAllowed, "método no permitido")
		return
	}

	claims := auth.CurrentUserClaims(r)
	if claims != nil && h.Audit != nil {
		var uid *int
		if claims.UserID > 0 {
			uidVal := claims.UserID
			uid = &uidVal
		}
		_ = h.Audit.Log(r.Context(), audit.LogEntry{
			UserID:     uid,
			Username:   claims.Username,
			IsRoot:     claims.IsRoot,
			IPAddress:  clientIP(r),
			Module:     "Autenticación",
			Action:     "logout",
			EntityName: "Cierre de sesión",
		})
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

	var perms map[string]string
	if claims.IsRoot {
		perms = claims.Permissions
	} else {
		perms = h.loadUserPermissions(r.Context(), claims.UserID, claims.Role)
	}

	accessToken, err := auth.GenerateTokenWithPerms(claims.UserID, claims.Username, claims.FullName, claims.Role, claims.IsRoot, perms, "access", 1*time.Hour)
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "error renovando sesión")
		return
	}
	refreshToken, err := auth.GenerateTokenWithPerms(claims.UserID, claims.Username, claims.FullName, claims.Role, claims.IsRoot, perms, "refresh", 7*24*time.Hour)
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "error renovando sesión")
		return
	}

	setAuthCookies(w, r, accessToken, refreshToken)
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	claims := auth.CurrentUserClaims(r)
	if claims == nil {
		auth.WriteJSONError(w, http.StatusUnauthorized, "no autenticado")
		return
	}

	perms := claims.Permissions
	var fotoPerfil string
	var autoLogoutMinutes int
	userEmail := claims.Username + "@netz.local"
	userFullName := claims.FullName

	if claims.IsRoot {
		if h.DB != nil {
			var raw string
			if err := h.DB.QueryRowContext(r.Context(), "SELECT valor FROM configuraciones WHERE clave = 'root_profile'").Scan(&raw); err == nil {
				var rp struct {
					Email             string `json:"email"`
					FotoPerfil        string `json:"foto_perfil"`
					AutoLogoutMinutes int    `json:"auto_logout_minutes"`
				}
				if json.Unmarshal([]byte(raw), &rp) == nil {
					if rp.Email != "" {
						userEmail = rp.Email
					}
					fotoPerfil = rp.FotoPerfil
					autoLogoutMinutes = rp.AutoLogoutMinutes
				}
			}
		}
	} else if h.DB != nil {
		perms = h.loadUserPermissions(r.Context(), claims.UserID, claims.Role)
		var fotoPerf sql.NullString
		var emailStr, fullNameStr sql.NullString
		var autoMin sql.NullInt64
		_ = h.DB.QueryRowContext(r.Context(), `
			SELECT email, full_name, foto_perfil, COALESCE(auto_logout_minutes, 0)
			FROM users
			WHERE id = ? AND deleted_at IS NULL
		`, claims.UserID).Scan(&emailStr, &fullNameStr, &fotoPerf, &autoMin)

		if emailStr.Valid && emailStr.String != "" {
			userEmail = emailStr.String
		}
		if fullNameStr.Valid && fullNameStr.String != "" {
			userFullName = fullNameStr.String
		}
		if fotoPerf.Valid {
			fotoPerfil = fotoPerf.String
		}
		if autoMin.Valid {
			autoLogoutMinutes = int(autoMin.Int64)
		}
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"user": models.User{
			ID:                claims.UserID,
			Username:          claims.Username,
			Email:             userEmail,
			FullName:          userFullName,
			Role:              claims.Role,
			IsRoot:            claims.IsRoot,
			Permissions:       perms,
			Active:            true,
			FotoPerfil:        fotoPerfil,
			AutoLogoutMinutes: autoLogoutMinutes,
		},
	})
}
