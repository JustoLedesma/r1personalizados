package db

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"strings"
	"time"

	_ "github.com/go-sql-driver/mysql"
	"golang.org/x/crypto/bcrypt"
)

func envOrDefault(key, def string) string {
	val := strings.TrimSpace(os.Getenv(key))
	if val == "" {
		return def
	}
	return val
}

// Connect lee las variables de entorno (con los valores por defecto de AGENTS.md),
// asegura que la base de datos exista, abre el pool sql.DB y ejecuta Ping().
func Connect() (*sql.DB, error) {
	host := envOrDefault("DB_HOST", "localhost")
	port := envOrDefault("DB_PORT", "3306")
	user := envOrDefault("DB_USER", "root")
	password := os.Getenv("DB_PASSWORD")
	if password == "" {
		password = "L3d35m41991@Ju5t0"
	}
	name := envOrDefault("DB_NAME", "r1personalizados")

	// Asegurar que la base de datos exista antes de abrir el pool principal
	rootDSN := fmt.Sprintf("%s:%s@tcp(%s:%s)/?parseTime=true&charset=utf8mb4&loc=Local",
		user, password, host, port,
	)
	if bootstrapConn, err := sql.Open("mysql", rootDSN); err == nil {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		if pingErr := bootstrapConn.PingContext(ctx); pingErr == nil {
			_, _ = bootstrapConn.ExecContext(ctx, fmt.Sprintf(
				"CREATE DATABASE IF NOT EXISTS `%s` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
				name,
			))
		}
		cancel()
		_ = bootstrapConn.Close()
	}

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

	if err := ensureBaseSchema(ctx, conn); err != nil {
		_ = conn.Close()
		return nil, fmt.Errorf("error inicializando tablas base: %w", err)
	}

	return conn, nil
}

func ensureBaseSchema(ctx context.Context, conn *sql.DB) error {
	_, err := conn.ExecContext(ctx, `
		CREATE TABLE IF NOT EXISTS roles (
			id INT AUTO_INCREMENT PRIMARY KEY,
			name VARCHAR(50) NOT NULL UNIQUE,
			description VARCHAR(255) NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
	`)
	if err != nil {
		return err
	}

	_, err = conn.ExecContext(ctx, `
		INSERT IGNORE INTO roles (id, name, description) VALUES
			(1, 'admin', 'Administrador con acceso total al sistema'),
			(2, 'editor', 'Operador con permisos de creación y edición'),
			(3, 'viewer', 'Usuario con permisos de solo lectura');
	`)
	if err != nil {
		return err
	}

	_, err = conn.ExecContext(ctx, `
		CREATE TABLE IF NOT EXISTS users (
			id INT AUTO_INCREMENT PRIMARY KEY,
			username VARCHAR(100) NOT NULL UNIQUE,
			email VARCHAR(150) NOT NULL UNIQUE,
			full_name VARCHAR(150) NOT NULL,
			password_hash VARCHAR(255) NOT NULL,
			role_id INT NOT NULL DEFAULT 1,
			modulos JSON NULL,
			active TINYINT(1) NOT NULL DEFAULT 1,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
	`)
	if err != nil {
		return err
	}

	var count int
	if err := conn.QueryRowContext(ctx, "SELECT COUNT(*) FROM users").Scan(&count); err == nil && count == 0 {
		hash, hashErr := bcrypt.GenerateFromPassword([]byte("admin123"), bcrypt.DefaultCost)
		if hashErr == nil {
			_, _ = conn.ExecContext(ctx, `
				INSERT INTO users (username, email, full_name, password_hash, role_id, active)
				VALUES (?, ?, ?, ?, 1, 1)
			`, "admin", "admin@netz.local", "Operador Ventas", string(hash))
		}
	}

	return nil
}
