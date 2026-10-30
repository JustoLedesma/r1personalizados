package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"r1/backend/internal/auth"
)

type WhatsAppHandler struct {
	workerURL string
	mu        sync.Mutex
	cmd       *exec.Cmd
	client    *http.Client
}

type WhatsAppMediaPayload struct {
	Data     string `json:"data"`
	Mime     string `json:"mime"`
	Filename string `json:"filename"`
}

type WhatsAppSendPayload struct {
	Phone   string                `json:"phone"`
	Message string                `json:"message"`
	Media   *WhatsAppMediaPayload `json:"media,omitempty"`
}

func NewWhatsAppHandler() *WhatsAppHandler {
	port := strings.TrimSpace(os.Getenv("WA_WORKER_PORT"))
	if port == "" {
		port = "3009"
	}
	h := &WhatsAppHandler{
		workerURL: "http://127.0.0.1:" + port,
		client: &http.Client{
			Timeout: 45 * time.Second,
		},
	}
	go func() {
		if err := h.ensureWorkerRunning(); err != nil {
			log.Printf("[AVISO WA-WORKER] %v", err)
		}
	}()
	return h
}

func resolveWorkerDir() string {
	candidates := []string{
		"backend/whatsapp-worker",
		"whatsapp-worker",
		"../backend/whatsapp-worker",
	}
	for _, c := range candidates {
		workerFile := filepath.Join(c, "worker.js")
		if info, err := os.Stat(workerFile); err == nil && !info.IsDir() {
			abs, errAbs := filepath.Abs(c)
			if errAbs == nil {
				return abs
			}
			return c
		}
	}
	return "backend/whatsapp-worker"
}

func (h *WhatsAppHandler) isWorkerReachable() bool {
	shortClient := &http.Client{Timeout: 1500 * time.Millisecond}
	resp, err := shortClient.Get(h.workerURL + "/status")
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	return resp.StatusCode == http.StatusOK
}

func (h *WhatsAppHandler) ensureWorkerRunning() error {
	if h.isWorkerReachable() {
		return nil
	}

	h.mu.Lock()
	defer h.mu.Unlock()

	if h.isWorkerReachable() {
		return nil
	}

	workerDir := resolveWorkerDir()
	workerScript := filepath.Join(workerDir, "worker.js")
	if _, err := os.Stat(workerScript); err != nil {
		return fmt.Errorf("no se encontró el script worker.js en %s", workerScript)
	}

	cmd := exec.Command("node", "worker.js")
	cmd.Dir = workerDir
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("no se pudo iniciar node worker.js: %w", err)
	}
	h.cmd = cmd
	log.Printf("[WA-WORKER] Proceso en segundo plano iniciado (PID %d)", cmd.Process.Pid)

	// Esperar hasta 5 segundos a que el servidor HTTP del worker responda
	for i := 0; i < 20; i++ {
		time.Sleep(250 * time.Millisecond)
		if h.isWorkerReachable() {
			return nil
		}
	}
	return nil
}

func (h *WhatsAppHandler) proxyRequest(w http.ResponseWriter, method string, path string, body io.Reader) {
	if err := h.ensureWorkerRunning(); err != nil {
		auth.WriteJSONError(w, http.StatusServiceUnavailable, "El servicio de WhatsApp en segundo plano no está disponible: "+err.Error())
		return
	}

	req, err := http.NewRequest(method, h.workerURL+path, body)
	if err != nil {
		auth.WriteJSONError(w, http.StatusInternalServerError, "Error preparando solicitud al worker de WhatsApp")
		return
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := h.client.Do(req)
	if err != nil {
		auth.WriteJSONError(w, http.StatusBadGateway, "No se pudo conectar con el navegador en segundo plano de WhatsApp: "+err.Error())
		return
	}
	defer resp.Body.Close()

	respBytes, _ := io.ReadAll(resp.Body)
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(resp.StatusCode)
	_, _ = w.Write(respBytes)
}

func (h *WhatsAppHandler) Status(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		auth.WriteJSONError(w, http.StatusMethodNotAllowed, "método no permitido")
		return
	}
	h.proxyRequest(w, http.MethodGet, "/status", nil)
}

func (h *WhatsAppHandler) Start(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		auth.WriteJSONError(w, http.StatusMethodNotAllowed, "método no permitido")
		return
	}
	h.proxyRequest(w, http.MethodPost, "/start", nil)
}

func (h *WhatsAppHandler) Restart(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		auth.WriteJSONError(w, http.StatusMethodNotAllowed, "método no permitido")
		return
	}
	h.proxyRequest(w, http.MethodPost, "/restart", nil)
}

func (h *WhatsAppHandler) Stop(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		auth.WriteJSONError(w, http.StatusMethodNotAllowed, "método no permitido")
		return
	}
	h.proxyRequest(w, http.MethodPost, "/stop", nil)
}

func (h *WhatsAppHandler) DeleteSession(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		auth.WriteJSONError(w, http.StatusMethodNotAllowed, "método no permitido")
		return
	}
	h.proxyRequest(w, http.MethodPost, "/delete-session", nil)
}

func (h *WhatsAppHandler) Send(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		auth.WriteJSONError(w, http.StatusMethodNotAllowed, "método no permitido")
		return
	}
	h.proxyRequest(w, http.MethodPost, "/send", r.Body)
}

func (h *WhatsAppHandler) IsConnected() bool {
	if !h.isWorkerReachable() {
		return false
	}
	shortClient := &http.Client{Timeout: 2 * time.Second}
	resp, err := shortClient.Get(h.workerURL + "/status")
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	var data struct {
		Connected bool   `json:"connected"`
		Status    string `json:"status"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return false
	}
	return data.Connected || data.Status == "CONNECTED"
}

func (h *WhatsAppHandler) SendMessage(phone string, message string, mediaData string, mediaMime string, mediaFilename string) error {
	if err := h.ensureWorkerRunning(); err != nil {
		return err
	}

	payload := WhatsAppSendPayload{
		Phone:   phone,
		Message: message,
	}
	if strings.TrimSpace(mediaData) != "" {
		payload.Media = &WhatsAppMediaPayload{
			Data:     mediaData,
			Mime:     mediaMime,
			Filename: mediaFilename,
		}
	}

	raw, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	resp, err := h.client.Post(h.workerURL+"/send", "application/json", bytes.NewReader(raw))
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		var errResp struct {
			Error string `json:"error"`
		}
		_ = json.NewDecoder(resp.Body).Decode(&errResp)
		if errResp.Error != "" {
			return fmt.Errorf("%s", errResp.Error)
		}
		return fmt.Errorf("error enviando por WhatsApp (código %d)", resp.StatusCode)
	}
	return nil
}

