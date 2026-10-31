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

-- ============================================================================
-- Módulo: Difusión y Mensajes (Historial de todos los envíos sin excepción)
-- ============================================================================
CREATE TABLE IF NOT EXISTS `mensajes_historial` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `tipo` VARCHAR(40) NOT NULL DEFAULT 'Mensaje',
  `contacto_origen` VARCHAR(40) NULL DEFAULT 'Manual',
  `nombre_destinatario` VARCHAR(200) NOT NULL DEFAULT '—',
  `telefono_destinatario` VARCHAR(60) NOT NULL,
  `plantilla_titulo` VARCHAR(160) NULL,
  `contenido` TEXT NOT NULL,
  `adjunto_nombre` VARCHAR(255) NULL,
  `adjunto_formato` VARCHAR(40) NULL,
  `adjunto_mime` VARCHAR(100) NULL,
  `adjunto_data` LONGTEXT NULL,
  `intervalo_segundos` INT NOT NULL DEFAULT 0,
  `programado_para` DATETIME NULL DEFAULT NULL,
  `estado` VARCHAR(40) NOT NULL DEFAULT 'Enviado',
  `deleted_at` DATETIME NULL DEFAULT NULL,
  `deleted_by` VARCHAR(150) NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_mensajes_historial_tipo` (`tipo`),
  INDEX `idx_mensajes_historial_telefono` (`telefono_destinatario`),
  INDEX `idx_mensajes_historial_estado` (`estado`),
  INDEX `idx_mensajes_historial_deleted_at` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Módulo: Configuración del Sistema (WhatsApp, Pedidos, Empresa, Atributos de Productos)
-- ============================================================================
CREATE TABLE IF NOT EXISTS `configuraciones` (
  `clave` VARCHAR(80) PRIMARY KEY,
  `valor` LONGTEXT NOT NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `configuraciones` (`clave`, `valor`) VALUES
  ('whatsapp_nombre_formato', '{"incluir_nombre":true,"incluir_apellido":true}'),
  ('pedidos_notificaciones', '{"notificar_automatico":false,"plantilla_retiro_id":null,"plantilla_envio_id":1,"plantilla_presupuesto_id":null}'),
  ('empresa_datos', '{"logo_url":"./logo/r1.png","razon_social":"NETZ - R1 Personalizados","ruc":"00012345-0","propietario":"Juan Pérez","email":"contacto@netz.com.py","telefonos":["+595 981 123456"],"direccion":"Asunción, Paraguay","horario_atencion":"Lunes a Viernes de 08:00 a 18:00 hs - Sábados de 08:00 a 12:00 hs","gps_enlace":"https://maps.google.com/?q=-25.285,-57.6470","redes":{"facebook":"https://facebook.com/r1personalizados","instagram":"https://instagram.com/r1personalizados","tiktok":"https://tiktok.com/@r1personalizados","sitio_web":"https://netz.com.py"}}');

-- Pestaña Productos: Categorías
CREATE TABLE IF NOT EXISTS `categorias_productos` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `nombre` VARCHAR(120) NOT NULL,
  `activo` TINYINT(1) NOT NULL DEFAULT 1,
  `deleted_at` DATETIME NULL DEFAULT NULL,
  `deleted_by` VARCHAR(150) NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_categorias_activo` (`activo`),
  INDEX `idx_categorias_deleted_at` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `categorias_productos` (`id`, `nombre`, `activo`) VALUES
  (1, 'General', 1),
  (2, 'Electrónica', 1),
  (3, 'Indumentaria', 1),
  (4, 'Bazar y Hogar', 1),
  (5, 'Servicios', 1);

-- Pestaña Productos: Marcas
CREATE TABLE IF NOT EXISTS `marcas_productos` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `nombre` VARCHAR(120) NOT NULL,
  `activo` TINYINT(1) NOT NULL DEFAULT 1,
  `deleted_at` DATETIME NULL DEFAULT NULL,
  `deleted_by` VARCHAR(150) NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_marcas_activo` (`activo`),
  INDEX `idx_marcas_deleted_at` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `marcas_productos` (`id`, `nombre`, `activo`) VALUES
  (1, 'Genérica / Sin marca', 1),
  (2, 'NETZ', 1),
  (3, 'Sublimados R1', 1);

-- Pestaña Productos: Unidades de Medida
CREATE TABLE IF NOT EXISTS `unidades_medida` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `nombre` VARCHAR(120) NOT NULL,
  `abreviatura` VARCHAR(30) NOT NULL,
  `permite_decimales` TINYINT(1) NOT NULL DEFAULT 0,
  `activo` TINYINT(1) NOT NULL DEFAULT 1,
  `deleted_at` DATETIME NULL DEFAULT NULL,
  `deleted_by` VARCHAR(150) NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_unidades_activo` (`activo`),
  INDEX `idx_unidades_deleted_at` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `unidades_medida` (`id`, `nombre`, `abreviatura`, `permite_decimales`, `activo`) VALUES
  (1, 'Unidad', 'un.', 0, 1),
  (2, 'Par', 'par', 0, 1),
  (3, 'Docena', 'doc.', 0, 1),
  (4, 'Caja', 'caja', 0, 1),
  (5, 'Paquete', 'paq.', 0, 1),
  (6, 'Kilogramo', 'kg', 1, 1),
  (7, 'Metro', 'm', 1, 1),
  (8, 'Litro', 'l', 1, 1);

-- Campos de perfil en tabla users
-- ALTER TABLE `users` ADD COLUMN `fecha_nacimiento` DATE NULL;
-- ALTER TABLE `users` ADD COLUMN `foto_perfil` LONGTEXT NULL;
-- ALTER TABLE `users` ADD COLUMN `auto_logout_minutes` INT NOT NULL DEFAULT 0;

-- ============================================================================
-- Módulo: Catálogo de Productos con soporte para Reciclaje
-- ============================================================================
CREATE TABLE IF NOT EXISTS `productos` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `nombre` VARCHAR(255) NOT NULL,
  `sku` VARCHAR(100) NOT NULL UNIQUE,
  `codigo_barras` VARCHAR(100) NULL,
  `categoria_id` INT NOT NULL,
  `marca_id` INT NULL,
  `unidad_medida_id` INT NOT NULL DEFAULT 1,
  `descripcion` TEXT NULL,
  `proveedor_id` INT NULL,
  `costo_compra` DECIMAL(15,2) NOT NULL DEFAULT 0,
  `precio_venta` DECIMAL(15,2) NOT NULL DEFAULT 0,
  `iva` VARCHAR(20) NOT NULL DEFAULT '10%',
  `controlar_stock` TINYINT(1) NOT NULL DEFAULT 1,
  `stock_actual` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `stock_minimo` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `activo` TINYINT(1) NOT NULL DEFAULT 1,
  `mostrar_en_web` TINYINT(1) NOT NULL DEFAULT 1,
  `mostrar_precio` TINYINT(1) NOT NULL DEFAULT 1,
  `permitir_sin_stock` TINYINT(1) NOT NULL DEFAULT 0,
  `en_promocion` TINYINT(1) NOT NULL DEFAULT 0,
  `foto_principal` LONGTEXT NULL,
  `galeria_fotos` LONGTEXT NULL,
  `deleted_at` DATETIME NULL DEFAULT NULL,
  `deleted_by` VARCHAR(150) NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_productos_sku` (`sku`),
  INDEX `idx_productos_nombre` (`nombre`),
  INDEX `idx_productos_categoria` (`categoria_id`),
  INDEX `idx_productos_marca` (`marca_id`),
  INDEX `idx_productos_proveedor` (`proveedor_id`),
  INDEX `idx_productos_activo` (`activo`),
  INDEX `idx_productos_deleted_at` (`deleted_at`),
  CONSTRAINT `fk_productos_categoria` FOREIGN KEY (`categoria_id`) REFERENCES `categorias_productos`(`id`),
  CONSTRAINT `fk_productos_unidad` FOREIGN KEY (`unidad_medida_id`) REFERENCES `unidades_medida`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Módulo: Pedidos con soporte para Reciclaje, Ítems y Proveedores
-- ============================================================================
CREATE TABLE IF NOT EXISTS `pedidos` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `numero_pedido` VARCHAR(50) NOT NULL UNIQUE,
  `cliente_id` INT NULL,
  `cliente_casual` TINYINT(1) NOT NULL DEFAULT 0,
  `cliente_nombre` VARCHAR(200) NOT NULL,
  `cliente_telefono` VARCHAR(60) NULL,
  `cliente_documento` VARCHAR(60) NULL,
  `cliente_direccion` VARCHAR(255) NULL,
  `condicion_venta` ENUM('Contado', 'Credito') NOT NULL DEFAULT 'Contado',
  `tipo_pago` ENUM('Total', 'Parcial') NULL DEFAULT NULL,
  `fecha_cobro` DATE NULL DEFAULT NULL,
  `monto_total` DECIMAL(15,2) NOT NULL DEFAULT 0,
  `monto_pagado` DECIMAL(15,2) NOT NULL DEFAULT 0,
  `saldo_pendiente` DECIMAL(15,2) NOT NULL DEFAULT 0,
  `modalidad_entrega` VARCHAR(80) NOT NULL DEFAULT 'Retiro en Local',
  `modalidad_entrega_otro` VARCHAR(255) NULL,
  `estado` ENUM('Creado', 'En Producción', 'En Pausa', 'Listo', 'Cancelado') NOT NULL DEFAULT 'Creado',
  `semana_iso` INT NOT NULL,
  `anio_iso` INT NOT NULL,
  `notas_produccion` TEXT NULL,
  `deleted_at` DATETIME NULL DEFAULT NULL,
  `deleted_by` VARCHAR(150) NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_pedidos_numero` (`numero_pedido`),
  INDEX `idx_pedidos_cliente` (`cliente_id`),
  INDEX `idx_pedidos_estado` (`estado`),
  INDEX `idx_pedidos_condicion` (`condicion_venta`),
  INDEX `idx_pedidos_fecha_cobro` (`fecha_cobro`),
  INDEX `idx_pedidos_semana` (`semana_iso`, `anio_iso`),
  INDEX `idx_pedidos_deleted_at` (`deleted_at`),
  CONSTRAINT `fk_pedidos_cliente` FOREIGN KEY (`cliente_id`) REFERENCES `clientes`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `pedido_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `pedido_id` INT NOT NULL,
  `producto_id` INT NULL,
  `es_no_registrado` TINYINT(1) NOT NULL DEFAULT 0,
  `nombre_producto` VARCHAR(255) NOT NULL,
  `sku` VARCHAR(100) NULL,
  `cantidad` DECIMAL(12,2) NOT NULL DEFAULT 1,
  `precio_unitario` DECIMAL(15,2) NOT NULL DEFAULT 0,
  `subtotal` DECIMAL(15,2) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_pedido_items_pedido` (`pedido_id`),
  INDEX `idx_pedido_items_producto` (`producto_id`),
  CONSTRAINT `fk_pedido_items_pedido` FOREIGN KEY (`pedido_id`) REFERENCES `pedidos`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pedido_items_producto` FOREIGN KEY (`producto_id`) REFERENCES `productos`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `pedido_proveedores` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `pedido_id` INT NOT NULL,
  `proveedor_id` INT NULL,
  `es_no_registrado` TINYINT(1) NOT NULL DEFAULT 0,
  `nombre_proveedor` VARCHAR(200) NOT NULL,
  `cantidad` DECIMAL(12,2) NOT NULL DEFAULT 1,
  `costo` DECIMAL(15,2) NOT NULL DEFAULT 0,
  `subtotal` DECIMAL(15,2) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_pedido_proveedores_pedido` (`pedido_id`),
  INDEX `idx_pedido_proveedores_proveedor` (`proveedor_id`),
  CONSTRAINT `fk_pedido_proveedores_pedido` FOREIGN KEY (`pedido_id`) REFERENCES `pedidos`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pedido_proveedores_proveedor` FOREIGN KEY (`proveedor_id`) REFERENCES `proveedores`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Actualización: Campo fecha_pedido en pedidos con asociación a semana_iso
-- ============================================================================
ALTER TABLE `pedidos` ADD COLUMN `fecha_pedido` DATE NULL DEFAULT NULL AFTER `condicion_venta`;
UPDATE `pedidos` SET `fecha_pedido` = DATE(`created_at`) WHERE `fecha_pedido` IS NULL;
ALTER TABLE `pedidos` ADD INDEX `idx_pedidos_fecha_pedido` (`fecha_pedido`);

-- ============================================================================
-- Actualización: Fechas de transición de estados e historial en pedidos
-- ============================================================================
ALTER TABLE `pedidos` ADD COLUMN `fecha_en_produccion` DATETIME NULL DEFAULT NULL AFTER `estado`;
ALTER TABLE `pedidos` ADD COLUMN `fecha_en_pausa` DATETIME NULL DEFAULT NULL AFTER `fecha_en_produccion`;
ALTER TABLE `pedidos` ADD COLUMN `fecha_listo` DATETIME NULL DEFAULT NULL AFTER `fecha_en_pausa`;
ALTER TABLE `pedidos` ADD COLUMN `historial_estados` JSON NULL DEFAULT NULL AFTER `fecha_listo`;





