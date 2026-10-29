package server

import (
	"database/sql"
	"log"
	"net/http"
	"os"
	"path/filepath"
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

	mux := http.NewServeMux()

	registerAuthRoutes := func(prefix string) {
		mux.HandleFunc(prefix+"/login", authHandler.Login)
		mux.HandleFunc(prefix+"/logout", authHandler.Logout)
		mux.HandleFunc(prefix+"/refresh", authHandler.Refresh)
		mux.Handle(prefix+"/me", auth.Authenticate(http.HandlerFunc(authHandler.Me)))
	}
	registerAuthRoutes("/auth")
	registerAuthRoutes("/api/auth")

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
		target := filepath.Join(frontendDir, cleanPath)
		info, err := os.Stat(target)
		if err != nil || info.IsDir() {
			http.ServeFile(w, r, filepath.Join(frontendDir, "index.html"))
			return
		}
		fileServer.ServeHTTP(w, r)
	})

	port := strings.TrimSpace(os.Getenv("PORT"))
	if port == "" {
		port = "8080"
	}

	log.Printf("Servidor R1 iniciado en http://localhost:%s", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatalf("error fatal en servidor HTTP: %v", err)
	}
}

func resolveDir(candidates ...string) string {
	for _, c := range candidates {
		if info, err := os.Stat(c); err == nil && info.IsDir() {
			return c
		}
	}
	return candidates[0]
}
