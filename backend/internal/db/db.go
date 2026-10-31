package db

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"strings"
	"time"

	_ "github.com/go-sql-driver/mysql"
)

func envOrDefault(key, def string) string {
	val := strings.TrimSpace(os.Getenv(key))
	if val == "" {
		return def
	}
	return val
}

// Connect lee la configuración desde variables de entorno, arma el DSN,
// abre sql.DB con pool configurado y hace Ping() al iniciar.
func Connect() (*sql.DB, error) {
	host := envOrDefault("DB_HOST", "127.0.0.1")
	if host == "localhost" {
		host = "127.0.0.1"
	}
	port := envOrDefault("DB_PORT", "3306")
	user := envOrDefault("DB_USER", "root")
	password := os.Getenv("DB_PASSWORD")
	if password == "" {
		password = "L3d35m41991@Ju5t0"
	}
	name := envOrDefault("DB_NAME", "r1personalizados")

	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?parseTime=true&charset=utf8mb4&loc=Local",
		user, password, host, port, name,
	)

	conn, err := sql.Open("mysql", dsn)
	if err != nil {
		return nil, fmt.Errorf("error al inicializar el driver MySQL: %w", err)
	}

	conn.SetMaxOpenConns(25)
	conn.SetMaxIdleConns(10)
	conn.SetConnMaxLifetime(5 * time.Minute)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := conn.PingContext(ctx); err != nil {
		_ = conn.Close()
		return nil, fmt.Errorf("no se pudo conectar a MySQL en %s:%s (base de datos '%s'): %w", host, port, name, err)
	}

	return conn, nil
}
