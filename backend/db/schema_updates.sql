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
  `deleted_at` DATETIME NULL DEFAULT NULL,
  `deleted_by` VARCHAR(150) NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
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
  `deleted_at` DATETIME NULL DEFAULT NULL,
  `deleted_by` VARCHAR(150) NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_users_role` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Módulo: Clientes (Persona Física y Empresa) con soporte para Reciclaje
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
  `activo` TINYINT(1) NOT NULL DEFAULT 1,
  `deleted_at` DATETIME NULL DEFAULT NULL,
  `deleted_by` VARCHAR(150) NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_clientes_tipo` (`tipo_cliente`),
  INDEX `idx_clientes_documento` (`numero_documento`),
  INDEX `idx_clientes_ruc_base` (`ruc_base`),
  INDEX `idx_clientes_ruc` (`ruc`),
  INDEX `idx_clientes_deleted_at` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Módulo: Proveedores con soporte para Reciclaje (fecha, hora y usuario)
-- ============================================================================
CREATE TABLE IF NOT EXISTS `proveedores` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `tipo_proveedor` VARCHAR(40) NOT NULL DEFAULT 'Empresa',
  `razon_social` VARCHAR(200) NOT NULL,
  `nombre_comercial` VARCHAR(200) NULL,
  `ruc_documento` VARCHAR(60) NOT NULL,
  `direccion` VARCHAR(255) NULL,
  `ciudad` VARCHAR(120) NULL,
  `pais` VARCHAR(80) NOT NULL DEFAULT 'Paraguay',
  `telefono_codigo` VARCHAR(12) NOT NULL DEFAULT '+595',
  `telefono_numero` VARCHAR(40) NULL,
  `telefono_corporativo` VARCHAR(60) NULL,
  `email_general` VARCHAR(160) NULL,
  `sitio_web` VARCHAR(255) NULL,
  `contacto_nombre` VARCHAR(150) NULL,
  `contacto_cargo` VARCHAR(120) NULL,
  `whatsapp_codigo` VARCHAR(12) NOT NULL DEFAULT '+595',
  `whatsapp_numero` VARCHAR(40) NULL,
  `contacto_telefono` VARCHAR(60) NULL,
  `contacto_email` VARCHAR(160) NULL,
  `banco` VARCHAR(120) NULL,
  `numero_cuenta` VARCHAR(80) NULL,
  `moneda` VARCHAR(20) NOT NULL DEFAULT 'Gs',
  `condicion_pago` VARCHAR(60) NOT NULL DEFAULT 'Contado',
  `rubro` VARCHAR(150) NULL,
  `tiempo_entrega_dias` INT NOT NULL DEFAULT 0,
  `estado` VARCHAR(20) NOT NULL DEFAULT 'Activo',
  `deleted_at` DATETIME NULL DEFAULT NULL,
  `deleted_by` VARCHAR(150) NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_proveedores_tipo` (`tipo_proveedor`),
  INDEX `idx_proveedores_ruc` (`ruc_documento`),
  INDEX `idx_proveedores_estado` (`estado`),
  INDEX `idx_proveedores_deleted_at` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Actualización para tablas roles y users ya existentes (MySQL 8+)
-- ============================================================================
-- ALTER TABLE `roles`
--   ADD COLUMN `deleted_at` DATETIME NULL DEFAULT NULL,
--   ADD COLUMN `deleted_by` VARCHAR(150) NULL DEFAULT NULL,
--   ADD COLUMN `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;
--
-- ALTER TABLE `users`
--   ADD COLUMN `deleted_at` DATETIME NULL DEFAULT NULL,
--   ADD COLUMN `deleted_by` VARCHAR(150) NULL DEFAULT NULL;

-- ============================================================================
-- Módulo: Perfiles de Mensajes con soporte para Reciclaje y Variables Dinámicas
-- ============================================================================
CREATE TABLE IF NOT EXISTS `perfiles_mensajes` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `titulo` VARCHAR(160) NOT NULL,
  `categoria` VARCHAR(80) NOT NULL DEFAULT 'General',
  `descripcion` VARCHAR(255) NULL,
  `contenido` TEXT NOT NULL,
  `activo` TINYINT(1) NOT NULL DEFAULT 1,
  `deleted_at` DATETIME NULL DEFAULT NULL,
  `deleted_by` VARCHAR(150) NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_perfiles_mensajes_categoria` (`categoria`),
  INDEX `idx_perfiles_mensajes_activo` (`activo`),
  INDEX `idx_perfiles_mensajes_deleted_at` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `perfiles_mensajes` (`id`, `titulo`, `categoria`, `descripcion`, `contenido`, `activo`) VALUES
  (1, 'Bienvenida', 'Bienvenida', 'Enviar tras el registro o primer contacto con el cliente', '¡Hola {nombre}! 👋 Te damos una cordial bienvenida a NETZ. Estamos a tu disposición para ayudarte con todo lo que necesites.', 1),
  (2, 'Saludo Inicial', 'Saludo', 'Saludo diario para iniciar conversación comercial', '¡Hola {nombre}! Espero que tengas un excelente día. ¿En qué podemos colaborarte hoy?', 1),
  (3, 'Recordatorio de Pedido', 'Recordatorio', 'Notificar que el pedido está listo para entrega o retiro', 'Estimado/a {nombre}, le informamos que su pedido se encuentra listo para entrega / retiro. Por favor confírmenos su disponibilidad.', 1),
  (4, 'Agradecimiento', 'General', 'Agradecer la preferencia tras finalizar la atención o entrega', '¡Muchas gracias por tu preferencia, {nombre}! Nos alegra atenderte. Que tengas un excelente día. ✨', 1);
