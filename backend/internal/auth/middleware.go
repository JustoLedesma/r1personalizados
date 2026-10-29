package auth

import (
	"context"
	"encoding/json"
	"net/http"
)

type ctxKey string

const UserClaimsKey ctxKey = "user_claims"

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
			if _, exists := allowed[claims.Role]; !exists {
				WriteJSONError(w, http.StatusForbidden, "acceso denegado para este rol")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

