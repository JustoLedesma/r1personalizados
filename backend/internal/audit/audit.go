package audit

import (
	"context"
	"database/sql"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"strings"
	"time"
)

// LogEntry representa un registro de auditoría en la base de datos.
type LogEntry struct {
	ID         int64     `json:"id"`
	UserID     *int      `json:"user_id"`
	Username   string    `json:"username"`
	IsRoot     bool      `json:"is_root"`
	IPAddress  string    `json:"ip_address"`
	Module     string    `json:"module"`
	Action     string    `json:"action"`
	EntityType string    `json:"entity_type"`
	EntityID   string    `json:"entity_id"`
	EntityName string    `json:"entity_name"`
	OldValues  string    `json:"old_values"`
	NewValues  string    `json:"new_values"`
	CreatedAt  time.Time `json:"created_at"`
}

// Filter define los parámetros de búsqueda y paginación para la consulta de logs.
type Filter struct {
	Username  string
	Module    string
	Action    string
	Search    string
	StartDate string
	EndDate   string
	Page      int
	PageSize  int
	IsRoot    bool // Si el solicitante es root, puede ver logs de root. Si no, is_root = 0.
}

// Service gestiona la auditoría del sistema.
type Service struct {
	db *sql.DB
}

// NewService crea una nueva instancia del servicio de auditoría.
func NewService(dbConn *sql.DB) *Service {
	return &Service{db: dbConn}
}

// Log registra un evento de auditoría. Es no bloqueante si falla la DB, pero imprime el error.
func (s *Service) Log(ctx context.Context, entry LogEntry) error {
	if s.db == nil {
		return nil
	}

	query := `
		INSERT INTO audit_logs (
			user_id, username, is_root, ip_address, module, action,
			entity_type, entity_id, entity_name, old_values, new_values, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`

	now := time.Now()
	if entry.CreatedAt.IsZero() {
		entry.CreatedAt = now
	}

	_, err := s.db.ExecContext(
		ctx,
		query,
		entry.UserID,
		entry.Username,
		entry.IsRoot,
		entry.IPAddress,
		entry.Module,
		entry.Action,
		entry.EntityType,
		entry.EntityID,
		entry.EntityName,
		entry.OldValues,
		entry.NewValues,
		entry.CreatedAt,
	)
	return err
}

// Helper para convertir cualquier estructura a string JSON
func ToJSONString(v interface{}) string {
	if v == nil {
		return ""
	}
	b, err := json.Marshal(v)
	if err != nil {
		return ""
	}
	return string(b)
}

// List devuelve los registros paginados y el total según los filtros aplicados.
func (s *Service) List(ctx context.Context, f Filter) ([]LogEntry, int, error) {
	if s.db == nil {
		return []LogEntry{}, 0, nil
	}

	var where []string
	var args []interface{}

	// Regla de seguridad: Si no es root, NUNCA debe ver acciones de root ni intentos que mencionen al usuario root
	rootUser := strings.ToLower(strings.Trim(strings.TrimSpace(os.Getenv("ROOT_USER")), "'\""))
	if !f.IsRoot {
		where = append(where, "is_root = 0")
		if rootUser != "" {
			where = append(where, "(LOWER(username) != ? AND LOWER(username) != 'root' AND LOWER(COALESCE(entity_name, '')) NOT LIKE ?)")
			args = append(args, rootUser, "%"+rootUser+"%")
		} else {
			where = append(where, "LOWER(username) != 'root'")
		}
	}

	if f.Username != "" {
		where = append(where, "username = ?")
		args = append(args, f.Username)
	}

	if f.Module != "" {
		where = append(where, "module = ?")
		args = append(args, f.Module)
	}

	if f.Action != "" {
		where = append(where, "action = ?")
		args = append(args, f.Action)
	}

	if f.StartDate != "" {
		where = append(where, "DATE(created_at) >= ?")
		args = append(args, f.StartDate)
	}

	if f.EndDate != "" {
		where = append(where, "DATE(created_at) <= ?")
		args = append(args, f.EndDate)
	}

	if f.Search != "" {
		pattern := "%" + f.Search + "%"
		where = append(where, "(username LIKE ? OR module LIKE ? OR action LIKE ? OR entity_name LIKE ? OR ip_address LIKE ?)")
		args = append(args, pattern, pattern, pattern, pattern, pattern)
	}

	whereClause := ""
	if len(where) > 0 {
		whereClause = "WHERE " + strings.Join(where, " AND ")
	}

	// Conteo total
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM audit_logs %s", whereClause)
	var total int
	err := s.db.QueryRowContext(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("error al contar logs: %w", err)
	}

	if total == 0 {
		return []LogEntry{}, 0, nil
	}

	// Paginación
	limit := f.PageSize
	if limit <= 0 {
		limit = 20
	}
	page := f.Page
	if page <= 0 {
		page = 1
	}
	offset := (page - 1) * limit

	selectQuery := fmt.Sprintf(`
		SELECT id, user_id, username, is_root, ip_address, module, action,
		       COALESCE(entity_type, ''), COALESCE(entity_id, ''), COALESCE(entity_name, ''),
		       COALESCE(old_values, ''), COALESCE(new_values, ''), created_at
		FROM audit_logs
		%s
		ORDER BY id DESC
		LIMIT ? OFFSET ?
	`, whereClause)

	selectArgs := append(args, limit, offset)
	rows, err := s.db.QueryContext(ctx, selectQuery, selectArgs...)
	if err != nil {
		return nil, 0, fmt.Errorf("error al consultar logs: %w", err)
	}
	defer rows.Close()

	var logs []LogEntry
	for rows.Next() {
		var l LogEntry
		var uid sql.NullInt64
		err := rows.Scan(
			&l.ID,
			&uid,
			&l.Username,
			&l.IsRoot,
			&l.IPAddress,
			&l.Module,
			&l.Action,
			&l.EntityType,
			&l.EntityID,
			&l.EntityName,
			&l.OldValues,
			&l.NewValues,
			&l.CreatedAt,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("error al leer fila de log: %w", err)
		}
		if uid.Valid {
			idInt := int(uid.Int64)
			l.UserID = &idInt
		}
		logs = append(logs, l)
	}

	return logs, total, nil
}

// ExportCSV escribe en formato CSV los registros coincidentes con los filtros (sin límite de paginación).
func (s *Service) ExportCSV(ctx context.Context, f Filter, w io.Writer) error {
	if s.db == nil {
		return nil
	}

	var where []string
	var args []interface{}

	rootUser := strings.ToLower(strings.Trim(strings.TrimSpace(os.Getenv("ROOT_USER")), "'\""))
	if !f.IsRoot {
		where = append(where, "is_root = 0")
		if rootUser != "" {
			where = append(where, "(LOWER(username) != ? AND LOWER(username) != 'root' AND LOWER(COALESCE(entity_name, '')) NOT LIKE ?)")
			args = append(args, rootUser, "%"+rootUser+"%")
		} else {
			where = append(where, "LOWER(username) != 'root'")
		}
	}
	if f.Username != "" {
		where = append(where, "username = ?")
		args = append(args, f.Username)
	}
	if f.Module != "" {
		where = append(where, "module = ?")
		args = append(args, f.Module)
	}
	if f.Action != "" {
		where = append(where, "action = ?")
		args = append(args, f.Action)
	}
	if f.StartDate != "" {
		where = append(where, "DATE(created_at) >= ?")
		args = append(args, f.StartDate)
	}
	if f.EndDate != "" {
		where = append(where, "DATE(created_at) <= ?")
		args = append(args, f.EndDate)
	}
	if f.Search != "" {
		pattern := "%" + f.Search + "%"
		where = append(where, "(username LIKE ? OR module LIKE ? OR action LIKE ? OR entity_name LIKE ? OR ip_address LIKE ?)")
		args = append(args, pattern, pattern, pattern, pattern, pattern)
	}

	whereClause := ""
	if len(where) > 0 {
		whereClause = "WHERE " + strings.Join(where, " AND ")
	}

	query := fmt.Sprintf(`
		SELECT id, username, ip_address, module, action,
		       COALESCE(entity_type, ''), COALESCE(entity_id, ''), COALESCE(entity_name, ''),
		       created_at
		FROM audit_logs
		%s
		ORDER BY id DESC
		LIMIT 10000
	`, whereClause)

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return err
	}
	defer rows.Close()

	writer := csv.NewWriter(w)
	defer writer.Flush()

	// Encabezados
	_ = writer.Write([]string{"ID", "Fecha y Hora", "Usuario", "IP", "Módulo", "Acción", "Tipo Entidad", "ID Entidad", "Nombre Entidad"})

	for rows.Next() {
		var id int64
		var username, ip, module, action, entType, entId, entName string
		var createdAt time.Time

		if err := rows.Scan(&id, &username, &ip, &module, &action, &entType, &entId, &entName, &createdAt); err != nil {
			return err
		}

		_ = writer.Write([]string{
			fmt.Sprintf("%d", id),
			createdAt.Format("2006-01-02 15:04:05"),
			username,
			ip,
			module,
			action,
			entType,
			entId,
			entName,
		})
	}

	return nil
}

