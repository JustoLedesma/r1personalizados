-- ============================================================================
-- Historial centralizado de estructura SQL (r1personalizados)
-- ============================================================================

CREATE DATABASE IF NOT EXISTS `r1personalizados`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `r1personalizados`;

CREATE TABLE IF NOT EXISTS `roles` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(50) NOT NULL UNIQUE,
  `description` VARCHAR(255) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `roles` (`id`, `name`, `description`) VALUES
  (1, 'admin', 'Administrador con acceso total al sistema'),
  (2, 'editor', 'Operador con permisos de creación y edición'),
  (3, 'viewer', 'Usuario con permisos de solo lectura');

CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(100) NOT NULL UNIQUE,
  `email` VARCHAR(150) NOT NULL UNIQUE,
  `full_name` VARCHAR(150) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `role_id` INT NOT NULL DEFAULT 1,
  `modulos` JSON NULL,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_users_role` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Módulo: Clientes (Persona Física y Empresa)
-- ============================================================================
CREATE TABLE IF NOT EXISTS `clientes` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `tipo_cliente` ENUM('persona_fisica', 'empresa') NOT NULL DEFAULT 'persona_fisica',
  `tipo_documento` VARCHAR(80) NULL,
  `numero_documento` VARCHAR(60) NULL,
  `nombres` VARCHAR(150) NULL,
  `apellidos` VARCHAR(150) NULL,
  `fecha_nacimiento` DATE NULL,
  `sexo` VARCHAR(40) NULL,
  `nacionalidad` VARCHAR(80) NULL DEFAULT 'Paraguay',
  `ruc_base` VARCHAR(60) NULL,
  `razon_social` VARCHAR(200) NULL,
  `nombre_fantasia` VARCHAR(200) NULL,
  `ruc` VARCHAR(60) NULL,
  `representante_nombre` VARCHAR(150) NULL,
  `representante_documento` VARCHAR(80) NULL,
  `persona_contacto` VARCHAR(150) NULL,
  `whatsapp_codigo` VARCHAR(12) NOT NULL DEFAULT '+595',
  `whatsapp_numero` VARCHAR(40) NOT NULL,
  `whatsapp_completo` VARCHAR(60) NOT NULL,
  `telefono_codigo` VARCHAR(12) NULL DEFAULT '+595',
  `telefono_numero` VARCHAR(40) NULL,
  `telefono_completo` VARCHAR(60) NULL,
  `email` VARCHAR(160) NOT NULL,
  `direccion` VARCHAR(255) NULL,
  `departamento` VARCHAR(100) NULL,
  `ciudad` VARCHAR(120) NULL,
  `barrio` VARCHAR(120) NULL,
  `referencia` VARCHAR(255) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_clientes_tipo` (`tipo_cliente`),
  INDEX `idx_clientes_documento` (`numero_documento`),
  INDEX `idx_clientes_ruc_base` (`ruc_base`),
  INDEX `idx_clientes_ruc` (`ruc`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
