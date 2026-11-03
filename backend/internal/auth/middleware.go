package auth

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
)

type ctxKey string

const UserClaimsKey ctxKey = "user_claims"

// CurrentUserClaims obtiene las credenciales del usuario actual desde el contexto.
func CurrentUserClaims(r *http.Request) *Claims {
	if claims, ok := r.Context().Value(UserClaimsKey).(*Claims); ok && claims != nil {
		return claims
	}
	if cookie, err := r.Cookie("access_token"); err == nil && cookie.Value != "" {
		if claims, parseErr := ParseToken(cookie.Value, "access"); parseErr == nil && claims != nil {
			return claims
		}
	}
	return nil
}

// CurrentActorName obtiene el nombre del usuario autenticado desde el JWT o cabecera de sesión.
func CurrentActorName(r *http.Request) string {
	if claims := CurrentUserClaims(r); claims != nil {
		if claims.FullName != "" {
			return claims.FullName
		}
		if claims.Username != "" {
			return claims.Username
		}
	}
	if hdr := strings.TrimSpace(r.Header.Get("X-User-Name")); hdr != "" {
		return hdr
	}
	return "Operador Ventas"
}

func WriteJSONError(w http.ResponseWriter, status int, msg string) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": msg})
}

func Authenticate(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie("access_token")
		if err != nil || cookie.Value == "" {
			WriteJSONError(w, http.StatusUnauthorized, "no autenticado")
			return
		}
		claims, err := ParseToken(cookie.Value, "access")
		if err != nil {
			WriteJSONError(w, http.StatusUnauthorized, "sesión expirada o inválida")
			return
		}
		ctx := context.WithValue(r.Context(), UserClaimsKey, claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func RequireRole(roles ...string) func(http.Handler) http.Handler {
	allowed := make(map[string]struct{}, len(roles))
	for _, r := range roles {
		allowed[r] = struct{}{}
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims, ok := r.Context().Value(UserClaimsKey).(*Claims)
			if !ok || claims == nil {
				WriteJSONError(w, http.StatusUnauthorized, "no autenticado")
				return
			}
			// Root tiene acceso total e incondicional
			if claims.IsRoot {
				next.ServeHTTP(w, r)
				return
			}
			if _, exists := allowed[claims.Role]; !exists {
				WriteJSONError(w, http.StatusForbidden, "acceso denegado para este rol")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// RequirePermission valida acceso a nivel de módulo y nivel de escritura ('editor' vs 'viewer').
// Si requireWrite es true (ej. POST, PUT, DELETE), rechaza a los usuarios que tengan 'viewer'.
func RequirePermission(module string, requireWrite bool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims, ok := r.Context().Value(UserClaimsKey).(*Claims)
			if !ok || claims == nil {
				WriteJSONError(w, http.StatusUnauthorized, "no autenticado")
				return
			}

			// Root y Administradores tienen control total sin restricción
			if claims.IsRoot || claims.Role == "admin" {
				next.ServeHTTP(w, r)
				return
			}

			// Si es usuario común, verificar permisos del módulo
			accessLevel, hasModule := claims.Permissions[module]
			if !hasModule {
				WriteJSONError(w, http.StatusForbidden, "acceso denegado: no tiene permisos para este módulo")
				return
			}

			if requireWrite && accessLevel != "editor" {
				WriteJSONError(w, http.StatusForbidden, "acceso denegado: modo solo vista (no puede realizar modificaciones)")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
