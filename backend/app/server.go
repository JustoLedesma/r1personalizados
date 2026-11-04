package app

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"r1/backend/internal/audit"
	"r1/backend/internal/auth"
	"r1/backend/internal/db"
	"r1/backend/internal/handlers"

	"github.com/joho/godotenv"
)

func Run() {
	// Cargar variables desde .env (desde raíz o desde /backend)
	_ = godotenv.Load("backend/.env")
	_ = godotenv.Load(".env")
	_ = godotenv.Load("../backend/.env")

	var dbConn *sql.DB
	conn, err := db.Connect()
	if err != nil {
		log.Printf("[AVISO BD] %v — El servidor iniciará en modo vista previa hasta que MySQL esté activo", err)
	} else {
		dbConn = conn
		defer dbConn.Close()
		log.Println("[BD] Conectado exitosamente a MySQL/MariaDB (base de datos: r1personalizados)")
	}

	auditSvc := audit.NewService(dbConn)
	authHandler := handlers.NewAuthHandler(dbConn, auditSvc)
	usersHandler := handlers.NewUsersHandler(dbConn, auditSvc)
	logsHandler := handlers.NewLogsHandler(auditSvc)
	clientesHandler := handlers.NewClientesHandler(dbConn)
	proveedoresHandler := handlers.NewProveedoresHandler(dbConn)
	perfilesMensajesHandler := handlers.NewPerfilesMensajesHandler(dbConn)
	whatsappHandler := handlers.NewWhatsAppHandler(dbConn)
	difusionMensajesHandler := handlers.NewDifusionMensajesHandler(dbConn, whatsappHandler)
	reciclajeHandler := handlers.NewReciclajeHandler(dbConn)
	configuracionHandler := handlers.NewConfiguracionHandler(dbConn)
	productosHandler := handlers.NewProductosHandler(dbConn)
	pedidosHandler := handlers.NewPedidosHandler(dbConn)
	pagosHandler := handlers.NewPagosHandler(dbConn)
	budgetsHandler := handlers.NewBudgetsHandler(dbConn)
	dashboardHandler := handlers.NewDashboardHandler(dbConn)

	mux := http.NewServeMux()

	registerAuthRoutes := func(prefix string) {
		mux.HandleFunc(prefix+"/login", authHandler.Login)
		mux.HandleFunc(prefix+"/logout", authHandler.Logout)
		mux.HandleFunc(prefix+"/refresh", authHandler.Refresh)
		mux.Handle(prefix+"/me", auth.Authenticate(http.HandlerFunc(authHandler.Me)))
	}
	registerAuthRoutes("/auth")
	registerAuthRoutes("/api/auth")

	// Middleware guardián por módulo y método de escritura
	guard := func(module string, next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			claims := auth.CurrentUserClaims(r)
			if claims == nil {
				// Si no tiene cookie/claims, rechazar con 401
				auth.WriteJSONError(w, http.StatusUnauthorized, "no autenticado")
				return
			}
			ctx := context.WithValue(r.Context(), auth.UserClaimsKey, claims)
			r = r.WithContext(ctx)

			if claims.IsRoot || claims.Role == "admin" {
				next(w, r)
				return
			}
			access, exists := claims.Permissions[module]
			if !exists {
				auth.WriteJSONError(w, http.StatusForbidden, "acceso denegado al módulo")
				return
			}
			isWrite := r.Method == http.MethodPost || r.Method == http.MethodPut || r.Method == http.MethodPatch || r.Method == http.MethodDelete
			if isWrite && access != "editor" {
				auth.WriteJSONError(w, http.StatusForbidden, "acceso denegado: modo solo vista (no puede realizar modificaciones)")
				return
			}
			next(w, r)
		}
	}

	// Rutas de Usuarios y Roles (exclusivo para Administradores y Root)
	mux.HandleFunc("/api/users", func(w http.ResponseWriter, r *http.Request) {
		claims := auth.CurrentUserClaims(r)
		if claims == nil || (!claims.IsRoot && claims.Role != "admin") {
			auth.WriteJSONError(w, http.StatusForbidden, "acceso denegado: módulo reservado para administradores")
			return
		}
		if r.Method == http.MethodGet {
			usersHandler.List(w, r)
		} else if r.Method == http.MethodPost {
			usersHandler.Create(w, r)
		} else {
			auth.WriteJSONError(w, http.StatusMethodNotAllowed, "método no permitido")
		}
	})

	mux.HandleFunc("/api/users/", func(w http.ResponseWriter, r *http.Request) {
		claims := auth.CurrentUserClaims(r)
		if claims == nil || (!claims.IsRoot && claims.Role != "admin") {
			auth.WriteJSONError(w, http.StatusForbidden, "acceso denegado: módulo reservado para administradores")
			return
		}
		if r.Method == http.MethodPut || r.Method == http.MethodPatch {
			usersHandler.Update(w, r)
		} else if r.Method == http.MethodDelete {
			usersHandler.Delete(w, r)
		} else {
			auth.WriteJSONError(w, http.StatusMethodNotAllowed, "método no permitido")
		}
	})

	// Rutas de Logs / Auditoría (exclusivo para Administradores y Root)
	mux.HandleFunc("/api/logs", func(w http.ResponseWriter, r *http.Request) {
		claims := auth.CurrentUserClaims(r)
		if claims == nil || (!claims.IsRoot && claims.Role != "admin") {
			auth.WriteJSONError(w, http.StatusForbidden, "acceso denegado: logs reservados para administradores")
			return
		}
		logsHandler.List(w, r)
	})

	mux.HandleFunc("/api/logs/export", func(w http.ResponseWriter, r *http.Request) {
		claims := auth.CurrentUserClaims(r)
		if claims == nil || (!claims.IsRoot && claims.Role != "admin") {
			auth.WriteJSONError(w, http.StatusForbidden, "acceso denegado: logs reservados para administradores")
			return
		}
		logsHandler.Export(w, r)
	})

	// Rutas protegidas por módulo con soporte para 'viewer' (Solo Vista) vs 'editor'
	mux.HandleFunc("/api/clientes", guard("clientes", clientesHandler.HandleCollection))
	mux.HandleFunc("/api/clientes/", guard("clientes", clientesHandler.HandleItem))

	mux.HandleFunc("/api/proveedores", guard("proveedores", proveedoresHandler.HandleCollection))
	mux.HandleFunc("/api/proveedores/", guard("proveedores", proveedoresHandler.HandleItem))

	mux.HandleFunc("/api/perfiles-mensajes", guard("perfiles-mensajes", perfilesMensajesHandler.HandleCollection))
	mux.HandleFunc("/api/perfiles-mensajes/", guard("perfiles-mensajes", perfilesMensajesHandler.HandleItem))

	mux.HandleFunc("/api/difusion-mensajes", guard("difusion-mensajes", difusionMensajesHandler.HandleCollection))
	mux.HandleFunc("/api/difusion-mensajes/", guard("difusion-mensajes", difusionMensajesHandler.HandleItem))

	// Rutas del módulo Sesiones de WhatsApp
	mux.HandleFunc("/api/whatsapp/status", func(w http.ResponseWriter, r *http.Request) {
		claims := auth.CurrentUserClaims(r)
		if claims == nil {
			auth.WriteJSONError(w, http.StatusUnauthorized, "no autenticado")
			return
		}
		whatsappHandler.Status(w, r)
	})
	mux.HandleFunc("/api/whatsapp/start", guard("sesiones-whatsapp", whatsappHandler.Start))
	mux.HandleFunc("/api/whatsapp/restart", guard("sesiones-whatsapp", whatsappHandler.Restart))
	mux.HandleFunc("/api/whatsapp/restart-full", guard("sesiones-whatsapp", whatsappHandler.RestartFull))
	mux.HandleFunc("/api/whatsapp/stop", guard("sesiones-whatsapp", whatsappHandler.Stop))
	mux.HandleFunc("/api/whatsapp/delete-session", guard("sesiones-whatsapp", whatsappHandler.DeleteSession))
	mux.HandleFunc("/api/whatsapp/send", func(w http.ResponseWriter, r *http.Request) {
		claims := auth.CurrentUserClaims(r)
		if claims == nil {
			auth.WriteJSONError(w, http.StatusUnauthorized, "no autenticado")
			return
		}
		if claims.IsRoot || claims.Role == "admin" {
			whatsappHandler.Send(w, r)
			return
		}
		perms := claims.Permissions
		if perms["sesiones-whatsapp"] == "editor" || perms["presupuestos"] == "editor" || perms["pedidos"] == "editor" || perms["difusion-mensajes"] == "editor" {
			whatsappHandler.Send(w, r)
			return
		}
		auth.WriteJSONError(w, http.StatusForbidden, "acceso denegado para enviar mensajes")
	})
	mux.HandleFunc("/api/whatsapp/render-pdf", whatsappHandler.RenderPDF)

	// Rutas del Dashboard
	mux.HandleFunc("/api/dashboard/stats", guard("dashboard", dashboardHandler.Stats))
	mux.HandleFunc("/api/dashboard/drilldown", guard("dashboard", dashboardHandler.Drilldown))
	mux.HandleFunc("/api/dashboard/drilldown/export", guard("dashboard", dashboardHandler.ExportDrilldown))

	// Rutas del módulo Productos
	mux.HandleFunc("/api/productos", guard("productos", productosHandler.HandleCollection))
	mux.HandleFunc("/api/productos/check-sku", guard("productos", productosHandler.HandleCheckSKU))
	mux.HandleFunc("/api/productos/", guard("productos", productosHandler.HandleItem))

	// Rutas del módulo Pedidos
	mux.HandleFunc("/api/pedidos", guard("pedidos", pedidosHandler.HandleCollection))
	mux.HandleFunc("/api/pedidos/", guard("pedidos", pedidosHandler.HandleItem))

	// Rutas del módulo Pagos
	mux.HandleFunc("/api/pagos", guard("pagos", pagosHandler.HandleCollection))
	mux.HandleFunc("/api/pagos/", guard("pagos", pagosHandler.HandleItem))

	// Rutas del módulo Presupuestos y Plantillas PDF
	mux.HandleFunc("/api/config/budget-template", guard("presupuestos", configuracionHandler.HandleBudgetTemplate))
	mux.HandleFunc("/api/budgets", guard("presupuestos", budgetsHandler.HandleCollection))
	mux.HandleFunc("/api/budgets/upload-image", guard("presupuestos", budgetsHandler.HandleUploadImage))
	mux.HandleFunc("/api/budgets/", guard("presupuestos", budgetsHandler.HandleItem))

	// Rutas del módulo Reciclaje
	mux.HandleFunc("/api/reciclaje", guard("reciclaje", reciclajeHandler.List))
	mux.HandleFunc("/api/reciclaje/restaurar", guard("reciclaje", reciclajeHandler.Restore))

	// Rutas del módulo Configuración
	mux.HandleFunc("/api/configuracion", guard("configuracion", configuracionHandler.HandleConfig))
	mux.HandleFunc("/api/configuracion/perfil", guard("configuracion", configuracionHandler.HandlePerfil))
	mux.HandleFunc("/api/configuracion/atributos", guard("configuracion", configuracionHandler.ListAtributos))
	mux.HandleFunc("/api/configuracion/categorias", guard("configuracion", configuracionHandler.HandleCategorias))
	mux.HandleFunc("/api/configuracion/categorias/", guard("configuracion", configuracionHandler.HandleCategorias))
	mux.HandleFunc("/api/configuracion/marcas", guard("configuracion", configuracionHandler.HandleMarcas))
	mux.HandleFunc("/api/configuracion/marcas/", guard("configuracion", configuracionHandler.HandleMarcas))
	mux.HandleFunc("/api/configuracion/unidades", guard("configuracion", configuracionHandler.HandleUnidades))
	mux.HandleFunc("/api/configuracion/unidades/", guard("configuracion", configuracionHandler.HandleUnidades))

	frontendDir := resolveDir("frontend", "../frontend")
	logoDir := resolveDir("logo", "../logo", "frontend/logo")
	uploadsDir := resolveDir("uploads", "../uploads", "frontend/uploads")
	_ = os.MkdirAll(filepath.Join(uploadsDir, "presupuestos"), 0755)

	mux.Handle("/logo/", http.StripPrefix("/logo/", http.FileServer(http.Dir(logoDir))))
	mux.Handle("/uploads/", http.StripPrefix("/uploads/", http.FileServer(http.Dir(uploadsDir))))

	fileServer := http.FileServer(http.Dir(frontendDir))
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		cleanPath := filepath.Clean(r.URL.Path)
		if strings.HasPrefix(cleanPath, "/api/") || strings.HasPrefix(cleanPath, "/auth/") {
			auth.WriteJSONError(w, http.StatusNotFound, "ruta no encontrada")
			return
		}
		w.Header().Set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
		w.Header().Set("Pragma", "no-cache")
		w.Header().Set("Expires", "0")
		target := filepath.Join(frontendDir, cleanPath)
		info, err := os.Stat(target)
		if err != nil || info.IsDir() {
			http.ServeFile(w, r, filepath.Join(frontendDir, "index.html"))
			return
		}
		fileServer.ServeHTTP(w, r)
	})

	startPort := 8081
	if envPort := strings.TrimSpace(os.Getenv("PORT")); envPort != "" {
		if p, convErr := strconv.Atoi(envPort); convErr == nil && p > 0 {
			startPort = p
		}
	}

	listener, boundPort, err := listenAvailablePort(startPort, 20)
	if err != nil {
		log.Fatalf("error fatal en servidor HTTP: %v", err)
	}

	log.Printf("Servidor R1 iniciado en http://localhost:%d", boundPort)
	if err := http.Serve(listener, mux); err != nil {
		log.Fatalf("error fatal en servidor HTTP: %v", err)
	}
}

func listenAvailablePort(startPort int, maxAttempts int) (net.Listener, int, error) {
	for i := 0; i < maxAttempts; i++ {
		port := startPort + i
		// Probar tcp4 en 0.0.0.0, tcp4 en 127.0.0.1 y finalmente tcp dual-stack
		attempts := []struct {
			net  string
			addr string
		}{
			{"tcp4", fmt.Sprintf("0.0.0.0:%d", port)},
			{"tcp4", fmt.Sprintf("127.0.0.1:%d", port)},
			{"tcp", fmt.Sprintf(":%d", port)},
		}

		var lastErr error
		for _, a := range attempts {
			ln, err := net.Listen(a.net, a.addr)
			if err == nil {
				if i > 0 {
					log.Printf("[AVISO PUERTO] El puerto %d no pudo abrirse; usando automáticamente el puerto %d", startPort, port)
				}
				return ln, port, nil
			}
			lastErr = err
		}
		log.Printf("[PUERTO %d RECHAZADO] %v", port, lastErr)
	}
	return nil, 0, fmt.Errorf("no se encontró ningún puerto libre entre %d y %d", startPort, startPort+maxAttempts-1)
}

func resolveDir(candidates ...string) string {
	for _, c := range candidates {
		if info, err := os.Stat(c); err == nil && info.IsDir() {
			return c
		}
	}
	return candidates[0]
}
