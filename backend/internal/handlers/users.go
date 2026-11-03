package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"r1/backend/internal/audit"
	"r1/backend/internal/auth"
	"r1/backend/internal/models"

	"golang.org/x/crypto/bcrypt"
)

type UsersHandler struct {
	DB    *sql.DB
	Audit *audit.Service
}

func NewUsersHandler(dbConn *sql.DB, auditSvc *audit.Service) *UsersHandler {
	return &UsersHandler{
		DB:    dbConn,
		Audit: auditSvc,
	}
}

// UserInput define el payload recibido para crear o editar usuarios.
type UserInput struct {
	Username    string            `json:"username"`
	Email       string            `json:"email"`
	FullName    string            `json:"fullName"`
	Password    string            `json:"password,omitempty"`
	Role        string            `json:"role"` // 'admin' o 'usuario' / 'editor'
	Active      *bool             `json:"active,omitempty"`
	Permissions map[string]string `json:"permissions"` // module_id -> "editor" | "viewer"
}

// List devuelve todos los usuarios no eliminados (ROOT nunca aparece porque no está en la DB).
func (h *UsersHandler) List(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		auth.WriteJSONError(w, http.StatusMethodNotAllowed, "método no permitido")
		return
	}

	ctx := r.Context()
	rows, err := h.DB.QueryContext(ctx, `
		SELECT u.id, u.username, u.email, u.full_name, r.name, u.active, u.created_at, u.updated_at
		FROM users u
		INNER JOIN roles r ON r.id = u.role_id
		WHERE u.deleted_at IS NULL
		ORDER BY u.id ASC
	`)
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "error al listar usuarios: "+err.Error())
		return
	}
	defer rows.Close()

	users := make([]models.User, 0)
	for rows.Next() {
		var u models.User
		if err := rows.Scan(&u.ID, &u.Username, &u.Email, &u.FullName, &u.Role, &u.Active, &u.CreatedAt, &u.UpdatedAt); err != nil {
			auth.WriteJSONError(w, http.StatusInternalServerError, "error al leer usuario")
			return
		}

		// Cargar permisos por módulo
		u.Permissions = make(map[string]string)
		permRows, err := h.DB.QueryContext(ctx, `
			SELECT module_id, access_level
			FROM user_module_permissions
			WHERE user_id = ?
		`, u.ID)
		if err == nil {
			for permRows.Next() {
				var mod, lvl string
				if err := permRows.Scan(&mod, &lvl); err == nil {
					u.Permissions[mod] = lvl
				}
			}
			permRows.Close()
		}

		users = append(users, u)
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"data":  users,
		"total": len(users),
	})
}

// Create añade un nuevo usuario con bcrypt y permisos específicos.
func (h *UsersHandler) Create(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		auth.WriteJSONError(w, http.StatusMethodNotAllowed, "método no permitido")
		return
	}

	var in UserInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		auth.WriteJSONError(w, http.StatusBadRequest, "cuerpo de solicitud inválido")
		return
	}

	in.Username = strings.TrimSpace(in.Username)
	in.Email = strings.TrimSpace(in.Email)
	in.FullName = strings.TrimSpace(in.FullName)
	in.Password = strings.TrimSpace(in.Password)

	if in.Username == "" || in.Email == "" || in.FullName == "" || in.Password == "" {
		auth.WriteJSONError(w, http.StatusBadRequest, "todos los campos obligatorios deben completarse")
		return
	}

	// Root name check: no se puede crear un usuario con el nombre de root
	if strings.EqualFold(in.Username, "root") {
		auth.WriteJSONError(w, http.StatusBadRequest, "el nombre de usuario 'root' está reservado por el sistema")
		return
	}

	ctx := r.Context()

	// Obtener ID del rol (1 = admin, 2 = editor / usuario común)
	roleID := 2
	if in.Role == "admin" {
		roleID = 1
	}

	// Hashear contraseña con bcrypt
	hash, err := bcrypt.GenerateFromPassword([]byte(in.Password), bcrypt.DefaultCost)
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "error al procesar contraseña")
		return
	}

	active := true
	if in.Active != nil {
		active = *in.Active
	}

	tx, err := h.DB.BeginTx(ctx, nil)
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "error iniciando transacción")
		return
	}
	defer tx.Rollback()

	res, err := tx.ExecContext(ctx, `
		INSERT INTO users (username, email, full_name, password_hash, role_id, active, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
	`, in.Username, in.Email, in.FullName, string(hash), roleID, active)
	if err != nil {
		if strings.Contains(err.Error(), "Duplicate entry") {
			auth.WriteJSONError(w, http.StatusConflict, "el nombre de usuario o correo ya se encuentra registrado")
			return
		}
		auth.WriteJSONError(w, http.StatusInternalServerError, "error al insertar usuario: "+err.Error())
		return
	}

	newID, _ := res.LastInsertId()

	// Insertar permisos de módulo
	if len(in.Permissions) > 0 {
		stmt, err := tx.PrepareContext(ctx, `
			INSERT INTO user_module_permissions (user_id, module_id, access_level)
			VALUES (?, ?, ?)
		`)
		if err == nil {
			for mod, lvl := range in.Permissions {
				lvl = strings.ToLower(lvl)
				if lvl != "editor" && lvl != "viewer" {
					lvl = "editor"
				}
				_, _ = stmt.ExecContext(ctx, newID, mod, lvl)
			}
			stmt.Close()
		}
	}

	if err := tx.Commit(); err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "error al guardar usuario")
		return
	}

	// Registrar en auditoría
	claims := auth.CurrentUserClaims(r)
	actor := auth.CurrentActorName(r)
	isRoot := claims != nil && claims.IsRoot
	var actorUID *int
	if claims != nil && claims.UserID > 0 {
		actorUID = &claims.UserID
	}

	if h.Audit != nil {
		_ = h.Audit.Log(ctx, audit.LogEntry{
			UserID:     actorUID,
			Username:   actor,
			IsRoot:     isRoot,
			IPAddress:  clientIP(r),
			Module:     "Usuarios y Roles",
			Action:     "crear",
			EntityType: "user",
			EntityID:   fmt.Sprintf("%d", newID),
			EntityName: in.FullName + " (" + in.Username + ")",
			NewValues:  audit.ToJSONString(in),
		})
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"message": "Usuario creado correctamente",
		"id":      newID,
	})
}

// Update modifica los datos, rol, estado, contraseña y permisos de un usuario existente.
func (h *UsersHandler) Update(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut && r.Method != http.MethodPatch {
		auth.WriteJSONError(w, http.StatusMethodNotAllowed, "método no permitido")
		return
	}

	idStr := strings.TrimPrefix(r.URL.Path, "/api/users/")
	idStr = strings.TrimSuffix(idStr, "/")
	targetID, err := strconv.Atoi(idStr)
	if err != nil || targetID <= 0 {
		auth.WriteJSONError(w, http.StatusBadRequest, "ID de usuario inválido")
		return
	}

	var in UserInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		auth.WriteJSONError(w, http.StatusBadRequest, "cuerpo de solicitud inválido")
		return
	}

	ctx := r.Context()

	// Obtener usuario actual para comparar valores anteriores
	var oldUser models.User
	var oldRoleID int
	err = h.DB.QueryRowContext(ctx, `
		SELECT u.id, u.username, u.email, u.full_name, u.role_id, r.name, u.active
		FROM users u
		INNER JOIN roles r ON r.id = u.role_id
		WHERE u.id = ? AND u.deleted_at IS NULL
	`, targetID).Scan(&oldUser.ID, &oldUser.Username, &oldUser.Email, &oldUser.FullName, &oldRoleID, &oldUser.Role, &oldUser.Active)
	if err != nil {
		auth.WriteJSONError(w, http.StatusNotFound, "usuario no encontrado")
		return
	}

	// Regla clave: Un administrador no puede quitarse a sí mismo el rol de admin si es el último administrador.
	if oldRoleID == 1 && (in.Role != "admin" || (in.Active != nil && !*in.Active)) {
		var adminCount int
		_ = h.DB.QueryRowContext(ctx, `
			SELECT COUNT(*) FROM users
			WHERE role_id = 1 AND active = 1 AND deleted_at IS NULL
		`).Scan(&adminCount)

		if adminCount <= 1 {
			auth.WriteJSONError(w, http.StatusForbidden, "no es posible degradar ni desactivar al último administrador del sistema")
			return
		}
	}

	tx, err := h.DB.BeginTx(ctx, nil)
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "error iniciando transacción")
		return
	}
	defer tx.Rollback()

	newRoleID := oldRoleID
	if in.Role == "admin" {
		newRoleID = 1
	} else if in.Role != "" {
		newRoleID = 2
	}

	fullName := in.FullName
	if fullName == "" {
		fullName = oldUser.FullName
	}
	email := in.Email
	if email == "" {
		email = oldUser.Email
	}
	active := oldUser.Active
	if in.Active != nil {
		active = *in.Active
	}

	// Si se envió una nueva contraseña, actualizarla con bcrypt
	if strings.TrimSpace(in.Password) != "" {
		newHash, err := bcrypt.GenerateFromPassword([]byte(in.Password), bcrypt.DefaultCost)
		if err != nil {
			auth.WriteJSONError(w, http.StatusInternalServerError, "error al encriptar contraseña")
			return
		}
		_, err = tx.ExecContext(ctx, `
			UPDATE users
			SET full_name = ?, email = ?, password_hash = ?, role_id = ?, active = ?, updated_at = NOW()
			WHERE id = ?
		`, fullName, email, string(newHash), newRoleID, active, targetID)
		if err != nil {
			auth.WriteJSONError(w, http.StatusInternalServerError, "error al actualizar usuario")
			return
		}
	} else {
		_, err = tx.ExecContext(ctx, `
			UPDATE users
			SET full_name = ?, email = ?, role_id = ?, active = ?, updated_at = NOW()
			WHERE id = ?
		`, fullName, email, newRoleID, active, targetID)
		if err != nil {
			auth.WriteJSONError(w, http.StatusInternalServerError, "error al actualizar usuario")
			return
		}
	}

	// Actualizar matriz de permisos si fue provista
	if in.Permissions != nil {
		_, _ = tx.ExecContext(ctx, `DELETE FROM user_module_permissions WHERE user_id = ?`, targetID)
		stmt, err := tx.PrepareContext(ctx, `
			INSERT INTO user_module_permissions (user_id, module_id, access_level)
			VALUES (?, ?, ?)
		`)
		if err == nil {
			for mod, lvl := range in.Permissions {
				lvl = strings.ToLower(lvl)
				if lvl != "editor" && lvl != "viewer" {
					lvl = "editor"
				}
				_, _ = stmt.ExecContext(ctx, targetID, mod, lvl)
			}
			stmt.Close()
		}
	}

	if err := tx.Commit(); err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "error confirmando actualización")
		return
	}

	// Registrar en auditoría
	claims := auth.CurrentUserClaims(r)
	actor := auth.CurrentActorName(r)
	isRoot := claims != nil && claims.IsRoot
	var actorUID *int
	if claims != nil && claims.UserID > 0 {
		actorUID = &claims.UserID
	}

	if h.Audit != nil {
		_ = h.Audit.Log(ctx, audit.LogEntry{
			UserID:     actorUID,
			Username:   actor,
			IsRoot:     isRoot,
			IPAddress:  clientIP(r),
			Module:     "Usuarios y Roles",
			Action:     "editar",
			EntityType: "user",
			EntityID:   fmt.Sprintf("%d", targetID),
			EntityName: fullName + " (" + oldUser.Username + ")",
			OldValues:  audit.ToJSONString(oldUser),
			NewValues:  audit.ToJSONString(in),
		})
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"message": "Usuario actualizado correctamente",
	})
}

// Delete realiza borrado lógico (soft-delete) enviando el usuario a Reciclaje.
func (h *UsersHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		auth.WriteJSONError(w, http.StatusMethodNotAllowed, "método no permitido")
		return
	}

	idStr := strings.TrimPrefix(r.URL.Path, "/api/users/")
	idStr = strings.TrimSuffix(idStr, "/")
	targetID, err := strconv.Atoi(idStr)
	if err != nil || targetID <= 0 {
		auth.WriteJSONError(w, http.StatusBadRequest, "ID de usuario inválido")
		return
	}

	ctx := r.Context()

	var oldUser models.User
	var oldRoleID int
	err = h.DB.QueryRowContext(ctx, `
		SELECT u.id, u.username, u.full_name, u.role_id, r.name, u.active
		FROM users u
		INNER JOIN roles r ON r.id = u.role_id
		WHERE u.id = ? AND u.deleted_at IS NULL
	`, targetID).Scan(&oldUser.ID, &oldUser.Username, &oldUser.FullName, &oldRoleID, &oldUser.Role, &oldUser.Active)
	if err != nil {
		auth.WriteJSONError(w, http.StatusNotFound, "usuario no encontrado")
		return
	}

	// Verificar si es el último administrador activo
	if oldRoleID == 1 {
		var adminCount int
		_ = h.DB.QueryRowContext(ctx, `
			SELECT COUNT(*) FROM users
			WHERE role_id = 1 AND active = 1 AND deleted_at IS NULL
		`).Scan(&adminCount)

		if adminCount <= 1 {
			auth.WriteJSONError(w, http.StatusForbidden, "no es posible eliminar al último administrador del sistema")
			return
		}
	}

	actor := auth.CurrentActorName(r)
	claims := auth.CurrentUserClaims(r)
	isRoot := claims != nil && claims.IsRoot
	var actorUID *int
	if claims != nil && claims.UserID > 0 {
		actorUID = &claims.UserID
	}

	// Soft-delete con deleted_at y deleted_by según AGENTS.md
	_, err = h.DB.ExecContext(ctx, `
		UPDATE users
		SET deleted_at = NOW(), deleted_by = ?, active = 0
		WHERE id = ?
	`, actor, targetID)
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "error al enviar usuario a reciclaje: "+err.Error())
		return
	}

	if h.Audit != nil {
		_ = h.Audit.Log(ctx, audit.LogEntry{
			UserID:     actorUID,
			Username:   actor,
			IsRoot:     isRoot,
			IPAddress:  clientIP(r),
			Module:     "Usuarios y Roles",
			Action:     "eliminar",
			EntityType: "user",
			EntityID:   fmt.Sprintf("%d", targetID),
			EntityName: oldUser.FullName + " (" + oldUser.Username + ")",
			OldValues:  audit.ToJSONString(oldUser),
		})
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"message": "Usuario movido a la papelera de reciclaje",
	})
}
