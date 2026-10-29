package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"r1/backend/internal/auth"
)

type RecycleItem struct {
	ID            int       `json:"id"`
	Modulo        string    `json:"modulo"`
	Identificador string    `json:"identificador"`
	Nombre        string    `json:"nombre"`
	Detalle       string    `json:"detalle"`
	DeletedBy     string    `json:"deletedBy"`
	DeletedAt     time.Time `json:"deletedAt"`
}

type ReciclajeHandler struct {
	DB *sql.DB
}

func NewReciclajeHandler(dbConn *sql.DB) *ReciclajeHandler {
	return &ReciclajeHandler{DB: dbConn}
}

func (h *ReciclajeHandler) List(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		auth.WriteJSONError(w, http.StatusMethodNotAllowed, "método no permitido")
		return
	}

	if h.DB == nil {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"data":      []RecycleItem{},
			"page":      1,
			"page_size": 20,
			"total":     0,
		})
		return
	}

	q := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("q")))
	modulo := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("modulo")))
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("page_size"))
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	allItems := make([]RecycleItem, 0)

	// 1. Clientes en reciclaje
	if modulo == "" || modulo == "clientes" {
		rows, err := h.DB.QueryContext(r.Context(), `
			SELECT
				id, tipo_cliente, COALESCE(numero_documento, ''), COALESCE(ruc_base, ''),
				COALESCE(nombres, ''), COALESCE(apellidos, ''), COALESCE(razon_social, ''),
				COALESCE(whatsapp_completo, ''), COALESCE(email, ''),
				COALESCE(deleted_by, 'Operador Ventas'), deleted_at
			FROM clientes
			WHERE deleted_at IS NOT NULL
			ORDER BY deleted_at DESC
		`)
		if err == nil {
			for rows.Next() {
				var (
					id            int
					tipoCliente   string
					numDoc        string
					rucBase       string
					nombres       string
					apellidos     string
					razonSocial   string
					whatsapp      string
					email         string
					deletedBy     string
					deletedAtTime time.Time
				)
				if scanErr := rows.Scan(
					&id, &tipoCliente, &numDoc, &rucBase,
					&nombres, &apellidos, &razonSocial,
					&whatsapp, &email, &deletedBy, &deletedAtTime,
				); scanErr == nil {
					ident := numDoc
					nombre := strings.TrimSpace(nombres + " " + apellidos)
					if tipoCliente == "empresa" {
						ident = rucBase
						nombre = razonSocial
					}
					item := RecycleItem{
						ID:            id,
						Modulo:        "Clientes",
						Identificador: ident,
						Nombre:        nombre,
						Detalle:       strings.TrimSpace(whatsapp + " · " + email),
						DeletedBy:     deletedBy,
						DeletedAt:     deletedAtTime,
					}
					if q == "" || matchesRecycleSearch(item, q) {
						allItems = append(allItems, item)
					}
				}
			}
			rows.Close()
		}
	}

	// 2. Proveedores en reciclaje
	if modulo == "" || modulo == "proveedor" || modulo == "proveedores" {
		rows, err := h.DB.QueryContext(r.Context(), `
			SELECT
				id, COALESCE(ruc_documento, ''), COALESCE(razon_social, ''),
				COALESCE(rubro, ''), COALESCE(telefono_corporativo, ''), COALESCE(email_general, ''),
				COALESCE(deleted_by, 'Operador Ventas'), deleted_at
			FROM proveedores
			WHERE deleted_at IS NOT NULL
			ORDER BY deleted_at DESC
		`)
		if err == nil {
			for rows.Next() {
				var (
					id            int
					rucDoc        string
					razonSocial   string
					rubro         string
					telefono      string
					email         string
					deletedBy     string
					deletedAtTime time.Time
				)
				if scanErr := rows.Scan(
					&id, &rucDoc, &razonSocial, &rubro, &telefono, &email, &deletedBy, &deletedAtTime,
				); scanErr == nil {
					parts := []string{}
					if rubro != "" {
						parts = append(parts, rubro)
					}
					if telefono != "" {
						parts = append(parts, telefono)
					}
					if email != "" {
						parts = append(parts, email)
					}
					item := RecycleItem{
						ID:            id,
						Modulo:        "Proveedor",
						Identificador: rucDoc,
						Nombre:        razonSocial,
						Detalle:       strings.Join(parts, " · "),
						DeletedBy:     deletedBy,
						DeletedAt:     deletedAtTime,
					}
					if q == "" || matchesRecycleSearch(item, q) {
						allItems = append(allItems, item)
					}
				}
			}
			rows.Close()
		}
	}

	sort.Slice(allItems, func(i, j int) bool {
		return allItems[i].DeletedAt.After(allItems[j].DeletedAt)
	})

	total := len(allItems)
	offset := (page - 1) * pageSize
	paged := []RecycleItem{}
	if offset < total {
		end := offset + pageSize
		if end > total {
			end = total
		}
		paged = allItems[offset:end]
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"data":      paged,
		"page":      page,
		"page_size": pageSize,
		"total":     total,
	})
}

func matchesRecycleSearch(item RecycleItem, q string) bool {
	return strings.Contains(strings.ToLower(item.Nombre), q) ||
		strings.Contains(strings.ToLower(item.Identificador), q) ||
		strings.Contains(strings.ToLower(item.Detalle), q) ||
		strings.Contains(strings.ToLower(item.DeletedBy), q) ||
		strings.Contains(strings.ToLower(item.Modulo), q)
}

func (h *ReciclajeHandler) Restore(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		auth.WriteJSONError(w, http.StatusMethodNotAllowed, "método no permitido")
		return
	}
	if h.DB == nil {
		auth.WriteJSONError(w, http.StatusServiceUnavailable, "base de datos no conectada")
		return
	}

	var req struct {
		Modulo string `json:"modulo"`
		ID     int    `json:"id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.ID <= 0 {
		auth.WriteJSONError(w, http.StatusBadRequest, "datos inválidos para restaurar")
		return
	}

	mod := strings.ToLower(strings.TrimSpace(req.Modulo))
	switch mod {
	case "clientes", "cliente":
		_, err := h.DB.ExecContext(r.Context(), "UPDATE clientes SET deleted_at = NULL, deleted_by = NULL WHERE id = ?", req.ID)
		if err != nil {
			auth.WriteJSONError(w, http.StatusInternalServerError, "no se pudo restaurar el cliente")
			return
		}
	case "proveedor", "proveedores":
		_, err := h.DB.ExecContext(r.Context(), "UPDATE proveedores SET deleted_at = NULL, deleted_by = NULL WHERE id = ?", req.ID)
		if err != nil {
			auth.WriteJSONError(w, http.StatusInternalServerError, "no se pudo restaurar el proveedor")
			return
		}
	default:
		auth.WriteJSONError(w, http.StatusBadRequest, "módulo no soportado")
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]string{"message": "registro restaurado exitosamente"})
}
