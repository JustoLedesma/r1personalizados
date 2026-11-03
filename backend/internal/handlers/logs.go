package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"r1/backend/internal/audit"
	"r1/backend/internal/auth"
)

type LogsHandler struct {
	Audit *audit.Service
}

func NewLogsHandler(auditSvc *audit.Service) *LogsHandler {
	return &LogsHandler{Audit: auditSvc}
}

// List obtiene los logs filtrados y paginados.
func (h *LogsHandler) List(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		auth.WriteJSONError(w, http.StatusMethodNotAllowed, "método no permitido")
		return
	}

	claims := auth.CurrentUserClaims(r)
	if claims == nil {
		auth.WriteJSONError(w, http.StatusUnauthorized, "no autenticado")
		return
	}

	q := r.URL.Query()
	page, _ := strconv.Atoi(q.Get("page"))
	if page < 1 {
		page = 1
	}
	pageSize, _ := strconv.Atoi(q.Get("page_size"))
	if pageSize < 1 {
		pageSize = 20
	}

	filter := audit.Filter{
		Username:  strings.TrimSpace(q.Get("username")),
		Module:    strings.TrimSpace(q.Get("module")),
		Action:    strings.TrimSpace(q.Get("action")),
		Search:    strings.TrimSpace(q.Get("search")),
		StartDate: strings.TrimSpace(q.Get("start_date")),
		EndDate:   strings.TrimSpace(q.Get("end_date")),
		Page:      page,
		PageSize:  pageSize,
		IsRoot:    claims.IsRoot, // Clave: solo root puede ver registros con is_root = 1
	}

	logs, total, err := h.Audit.List(r.Context(), filter)
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "error al consultar logs: "+err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"data":      logs,
		"page":      page,
		"page_size": pageSize,
		"total":     total,
	})
}

// Export genera un archivo CSV descargable con los logs filtrados.
func (h *LogsHandler) Export(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		auth.WriteJSONError(w, http.StatusMethodNotAllowed, "método no permitido")
		return
	}

	claims := auth.CurrentUserClaims(r)
	if claims == nil {
		auth.WriteJSONError(w, http.StatusUnauthorized, "no autenticado")
		return
	}

	q := r.URL.Query()
	filter := audit.Filter{
		Username:  strings.TrimSpace(q.Get("username")),
		Module:    strings.TrimSpace(q.Get("module")),
		Action:    strings.TrimSpace(q.Get("action")),
		Search:    strings.TrimSpace(q.Get("search")),
		StartDate: strings.TrimSpace(q.Get("start_date")),
		EndDate:   strings.TrimSpace(q.Get("end_date")),
		IsRoot:    claims.IsRoot,
	}

	filename := fmt.Sprintf("auditoria_netz_%s.csv", time.Now().Format("20060102_150405"))
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))

	if err := h.Audit.ExportCSV(r.Context(), filter, w); err != nil {
		// No se puede cambiar el status header si ya se escribió parte del stream
		return
	}
}

