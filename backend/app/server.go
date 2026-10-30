package app

import (
	"database/sql"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

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

	authHandler := handlers.NewAuthHandler(dbConn)
	clientesHandler := handlers.NewClientesHandler(dbConn)
	proveedoresHandler := handlers.NewProveedoresHandler(dbConn)
	perfilesMensajesHandler := handlers.NewPerfilesMensajesHandler(dbConn)
	whatsappHandler := handlers.NewWhatsAppHandler()
	difusionMensajesHandler := handlers.NewDifusionMensajesHandler(dbConn, whatsappHandler)
	reciclajeHandler := handlers.NewReciclajeHandler(dbConn)
	configuracionHandler := handlers.NewConfiguracionHandler(dbConn)

	mux := http.NewServeMux()

	registerAuthRoutes := func(prefix string) {
		mux.HandleFunc(prefix+"/login", authHandler.Login)
		mux.HandleFunc(prefix+"/logout", authHandler.Logout)
		mux.HandleFunc(prefix+"/refresh", authHandler.Refresh)
		mux.Handle(prefix+"/me", auth.Authenticate(http.HandlerFunc(authHandler.Me)))
	}
	registerAuthRoutes("/auth")
	registerAuthRoutes("/api/auth")

	// Rutas del módulo Clientes
	mux.HandleFunc("/api/clientes", clientesHandler.HandleCollection)
	mux.HandleFunc("/api/clientes/", clientesHandler.HandleItem)

	// Rutas del módulo Proveedor
	mux.HandleFunc("/api/proveedores", proveedoresHandler.HandleCollection)
	mux.HandleFunc("/api/proveedores/", proveedoresHandler.HandleItem)

	// Rutas del módulo Perfiles de Mensajes
	mux.HandleFunc("/api/perfiles-mensajes", perfilesMensajesHandler.HandleCollection)
	mux.HandleFunc("/api/perfiles-mensajes/", perfilesMensajesHandler.HandleItem)

	// Rutas del módulo Difusión y Mensajes
	mux.HandleFunc("/api/difusion-mensajes", difusionMensajesHandler.HandleCollection)
	mux.HandleFunc("/api/difusion-mensajes/", difusionMensajesHandler.HandleItem)

	// Rutas del módulo Sesiones de WhatsApp (navegador headless en segundo plano)
	mux.HandleFunc("/api/whatsapp/status", whatsappHandler.Status)
	mux.HandleFunc("/api/whatsapp/start", whatsappHandler.Start)
	mux.HandleFunc("/api/whatsapp/restart", whatsappHandler.Restart)
	mux.HandleFunc("/api/whatsapp/stop", whatsappHandler.Stop)
	mux.HandleFunc("/api/whatsapp/delete-session", whatsappHandler.DeleteSession)
	mux.HandleFunc("/api/whatsapp/send", whatsappHandler.Send)

	// Rutas del módulo Reciclaje
	mux.HandleFunc("/api/reciclaje", reciclajeHandler.List)
	mux.HandleFunc("/api/reciclaje/restaurar", reciclajeHandler.Restore)

	// Rutas del módulo Configuración (WhatsApp, Pedidos, Productos, Perfil, General)
	mux.HandleFunc("/api/configuracion", configuracionHandler.HandleConfig)
	mux.HandleFunc("/api/configuracion/perfil", configuracionHandler.HandlePerfil)
	mux.HandleFunc("/api/configuracion/atributos", configuracionHandler.ListAtributos)
	mux.HandleFunc("/api/configuracion/categorias", configuracionHandler.HandleCategorias)
	mux.HandleFunc("/api/configuracion/categorias/", configuracionHandler.HandleCategorias)
	mux.HandleFunc("/api/configuracion/marcas", configuracionHandler.HandleMarcas)
	mux.HandleFunc("/api/configuracion/marcas/", configuracionHandler.HandleMarcas)
	mux.HandleFunc("/api/configuracion/unidades", configuracionHandler.HandleUnidades)
	mux.HandleFunc("/api/configuracion/unidades/", configuracionHandler.HandleUnidades)

	frontendDir := resolveDir("frontend", "../frontend")
	logoDir := resolveDir("logo", "../logo", "frontend/logo")

	mux.Handle("/logo/", http.StripPrefix("/logo/", http.FileServer(http.Dir(logoDir))))

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
		ln, err := net.Listen("tcp", fmt.Sprintf(":%d", port))
		if err == nil {
			if i > 0 {
				log.Printf("[AVISO PUERTO] El puerto %d estaba ocupado; usando automáticamente el puerto %d", startPort, port)
			}
			return ln, port, nil
		}
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
