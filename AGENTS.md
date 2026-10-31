# AGENTS.md — Reglas del proyecto (Dashboard)

Eres un desarrollador senior full-stack. Este documento es la fuente de verdad: léelo antes de cada tarea y síguelo siempre. Si una petición del usuario lo contradice, avisa del conflicto antes de actuar.

## 1. Stack obligatorio

- **Frontend:** JavaScript (ES2022+, módulos ES). Sin TypeScript, sin frameworks salvo que se indique.
- **Estilos:** Tailwind CSS. Prohibido escribir CSS propio salvo en `@layer components` del archivo de entrada de Tailwind cuando una utilidad no alcance.
- **Backend:** Go (librería estándar `net/http` o Chi/Gin si ya está en el proyecto; no mezclar routers).
- **Base de datos:** MySQL/MariaDB en `localhost` (ver sección 2.1); acceso siempre con consultas parametrizadas.
- **Iconos** font awesome obligatorio, nada de emojis
- **Switches** todo interruptor (toggle) del sistema debe usar el diseño tipo iOS: pista redondeada tipo píldora con perilla circular blanca; apagado en gris (perilla a la izquierda) y encendido en azul (perilla a la derecha), con transición suave. Aplica a todos los módulos, nuevos y existentes, salvo que el usuario indique otro diseño
- **Contadores de cantidad** todo campo de cantidad numérica del sistema debe usar un selector con botones: botón "−" a la izquierda, valor numérico centrado y botón "+" a la derecha, con botones cuadrados de fondo gris azulado oscuro e íconos blancos, dentro de un contenedor de bordes redondeados con sombra suave. El mínimo es 1 (o 0 donde corresponda), el valor también se puede escribir directamente, solo acepta números enteros y mantener presionado el botón repite el cambio. Aplica a todos los módulos, nuevos y existentes, salvo que el usuario indique otro diseño
- **Modulos** cualquier modulo creado debe tomar toda el area asignada salvo que el usuario solicite modal
- **Notificaciones** Todas las notificaciones deben venir de Flashy.js
- **Logo azul** logo de color azul, https://netz.com.py/route1/img/header/NETZ-IA.svg obligatorio
- **Logo blanco** logo de color blanco https://netz.com.py/route1/img/header/NETZ-BLANCO.svg obligatorio
- **Icon** usar icono para el sistema en la parte dela pestaña este: https://netz.com.py/route1/img/header/N-SVG.svg obligatorio
- **Rutas** desarollado en local, pero necesito que funcione en un vps dentro de un contenedor con ngix, es necesario que todas las rutas funcionen automaticamente al levantar el servicio
- **Acceso a la DB** usuario y contraseña por defecto debemos usar USER: root PASS: L3d35m41991@Ju5t0
 - **Modificaciones de Base de Datos (SQL Directo)**
- **Formato obligatorio:** Para cualquier creación, ajuste o modificación en la estructura de la base de datos (tablas, relaciones, índices), el agente DEBE generar únicamente el código en SQL plano (raw SQL).
- **Prohibición de herramientas:** Está estrictamente prohibido utilizar, sugerir o generar archivos para frameworks de migración (como golang-migrate) o funciones de auto-migración de ORMs.
- **Entrega de código:** El código SQL debe entregarse en bloques de texto limpios y directos, listos para que el usuario los copie y pegue en la consola de comandos de MySQL/MariaDB.
- **Historial (Opcional):** Cuando se generen cambios estructurales, sugiere al usuario guardar la sentencia SQL en un archivo centralizado (ej. `/backend/db/schema_updates.sql`) para mantener un registro manual de los cambios en el repositorio.
- **Carga de datos** todo lo que es para crear datos, ya sea cliente, productos, usuarioles, roles, papelera, debe tener historial de fecha creada, modificada y borrada
- **Borrado de datos desde el sistema** Nada del sistema se debe borrar, cuando se hace click en un icono oboton para borrar debe pedir confirmacion y solo simular el borrado, luego debe ocultar de esa vista, y debajo de Usuario y Roles crear un modulo de Reciclaje que ahi debe aparecer todos los archivos o datos borrados con la opcion de restaurar y tener icono de vista previa, que es para ver que fue exactamente el dato borrado, y si algo fue borrado debe tomar la fecha del borrado y la hora del archivo borrado, al igual que el usuario que borro el archivo o documento
- **Tablas y vista previa** Todos los modulos que tengan vista previa de tabla, tienen que tener la opcion de ver, editar, borrar deben tener fecha creada, fecha modificada y si se hace click por el RUC o Documento o nombre del producto o id debe abrir la vista previa del item
- **Imagenes** Todas las imagenes cargadas debe de tomar los formatos de png, jpg, ico, webp y si sin cualquier otro formato se deben de comprimir las fotos a webp y reducir su peso sin perder calidad, tambien deben tener una vista previa en miniatura, si se hace click sobre la foto debe tener un zoom y abrir mas grande la foto, debajo de la foto debe decir el formato de la foto y el nombre

- No agregues dependencias nuevas sin justificarlas en una línea.

## 2. Estructura sugerida

```
/backend
  /cmd/server        main.go
  /internal/auth     login, JWT, middleware, roles
  /internal/handlers
  /internal/models
  /internal/db
/frontend
  /src/components    button.js, modal.js, table.js, theme.js, toast.js
  /src/pages
  /src/services      api.js (fetch centralizado)
  /src/styles        input.css (Tailwind)
```

Todo componente de UI reutilizable vive en `/src/components`. **Nunca** copies y pegues markup de botones, modales o tablas en las páginas: importa el componente.

## 2.1 Base de datos y archivo de conexión

- Motor: **MySQL/MariaDB** en `localhost`, puerto `3306`. Driver Go: `github.com/go-sql-driver/mysql`.
- **Tu tarea:** crear el archivo de conexión; **el usuario cargará los parámetros de acceso él mismo**. No inventes ni escribas credenciales reales en el código.
- Crea estos archivos:
  - `backend/internal/db/db.go`: lee la configuración desde variables de entorno, arma el DSN, abre `sql.DB` con pool configurado (`SetMaxOpenConns`, `SetMaxIdleConns`, `SetConnMaxLifetime`) y hace `Ping()` al iniciar con mensaje de error claro si falla.
  - `backend/.env.example` con **valores vacíos o de ejemplo** (se versiona):
    ```
    DB_HOST=localhost
    DB_PORT=3306
    DB_USER=root
    DB_PASSWORD=L3d35m41991@Ju5t0
    DB_NAME=r1personalizados
    ```
  - `backend/.env` (lo completa el usuario; **no lo crees con datos reales**).
- Agrega `.env` al `.gitignore`. Nunca subas credenciales al repositorio ni las imprimas en logs.
- Carga el `.env` al arrancar (por ejemplo con `github.com/joho/godotenv`) y falla con un mensaje claro si falta alguna variable obligatoria.
- Sugiere (sin imponer) un script `backend/migrations/001_init.sql` con las tablas `users` y `roles`.
- Nota para producción: no usar `root` como usuario de la aplicación; crear un usuario con permisos limitados.

## 3. Tokens de diseño

Define en `tailwind.config.js` (`darkMode: 'class'`):

```js
theme: {
  extend: {
    colors: {
      brand: { DEFAULT: '#a37cfc', hover: '#8f63f5', active: '#7c4de8', soft: '#efe8ff' },
      danger: { DEFAULT: '#dc2626', hover: '#b91c1c' },
    },
  },
}
```

- Prohibido usar el color `#a37cfc` o cualquier violeta "a mano" fuera de estos tokens. Usa `bg-brand`, `hover:bg-brand-hover`, etc.
- Tipografía, radios (`rounded-lg`), sombras y espaciados: elige una escala y mantenla en todo el sistema.

## 4. Botones (estandarizados)

Un único componente `Button` con variantes. No se permiten botones sueltos con clases ad hoc.

| Variante | Uso | Estilo |
|---|---|---|
| `primary` (por defecto) | Toda acción principal: guardar, crear, aceptar, buscar, exportar | `bg-brand` (#a37cfc), `hover:bg-brand-hover`, `active:bg-brand-active`, texto blanco |
| `cancel` | Cancelar, cerrar, volver | Gris neutro/borde (`border` + texto gris), **nunca** violeta |
| `danger` | Eliminar, errores, acciones destructivas | `bg-danger`, texto blanco |
| `ghost` / `icon` | Acciones secundarias en tablas | Transparente, hover sutil |

Reglas:
- **Todos los botones son #a37cfc salvo cancelar y error/peligro.**
- Estados obligatorios: `hover`, `focus-visible` (anillo visible), `disabled` (opacidad reducida + `cursor-not-allowed`) y `loading` (spinner, bloquea doble clic).
- Tamaños: `sm`, `md` (por defecto), `lg`. Altura táctil mínima de 40px en móvil.
- Verifica el contraste del texto sobre #a37cfc; usa `font-semibold` y no uses texto gris sobre este color.
- Botones con ícono deben llevar `aria-label`.

## 5. Ventanas modales (estandarizadas)

Un único componente `Modal` reutilizable, con estas partes: **cabecera** (título + botón cerrar), **cuerpo** (scroll interno) y **pie** (acciones).

- Pie: botón `cancel` a la izquierda/segundo y acción `primary` (o `danger` si es destructiva) a la derecha.
- Se cierra con: botón X, botón Cancelar, tecla `Esc` y clic en el fondo (excepto formularios con cambios sin guardar → pedir confirmación).
- Accesibilidad: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, foco atrapado dentro, devolver el foco al elemento que la abrió, bloquear scroll del `body` mientras está abierta.
- Tamaños: `sm`, `md`, `lg`, `xl`. En móvil (`< sm`) ocupa casi toda la pantalla (o pantalla completa en `lg/xl`).
- Soporta modo claro y oscuro.
- Variante `ConfirmModal` para confirmar eliminaciones (botón `danger`).

## 6. Tablas y paginación

Un único componente `DataTable` con columnas configurables, búsqueda y orden.

- **Hasta 20 registros:** se muestran todos en lista simple, **sin controles de paginación**.
- **Más de 20 registros:** se activa el **modo paginación** con **20 filas por página**.
- Paginador: anterior / siguiente, números de página con elipsis (`1 … 4 5 6 … 12`), indicador "Mostrando X–Y de Z".
- Para volúmenes grandes la paginación debe ser **del lado del servidor** (`?page=&page_size=20`) y la respuesta de Go devuelve `{ data, page, page_size, total }`.
- Estados obligatorios: cargando (skeleton), vacío (mensaje claro) y error (con botón de reintentar).
- Responsive: en pantallas pequeñas usar scroll horizontal contenido (`overflow-x-auto`) o transformar filas en tarjetas apiladas; nunca romper el layout de la página.
- Acciones por fila alineadas a la derecha, usando los botones estandarizados.

## 7. Modo claro / modo oscuro

- Tailwind con `darkMode: 'class'`; la clase `dark` va en `<html>`.
- Al cargar: leer `localStorage` (`theme`); si no existe, usar `prefers-color-scheme`. Aplicar la clase **antes** del primer render (script inline en `<head>`) para evitar parpadeo.
- Un único componente `ThemeToggle` visible en la cabecera.
- Todo componente debe definir ambas variantes (`bg-white dark:bg-slate-900`, `text-slate-900 dark:text-slate-100`, bordes, inputs, tablas, modales, toasts).
- Nunca usar colores fijos (`#fff`, `black`) fuera de los tokens.

## 8. Responsive (obligatorio)

- Enfoque **mobile-first**: estilos base para móvil y `sm: md: lg: xl: 2xl:` para ampliar.
- El dashboard debe funcionar de 320px a pantallas ultra anchas: sidebar colapsable/drawer en móvil, rejilla fluida (`grid-cols-1 sm:grid-cols-2 xl:grid-cols-4`), sin scroll horizontal de página.
- Meta viewport correcta; áreas táctiles ≥ 40px; tipografía legible sin zoom.
- Antes de dar una tarea por terminada, revisa mentalmente (o con herramientas) los anchos 360, 768, 1024 y 1440.

## 9. Autenticación y roles

**Backend (Go):**
- Login con email/usuario + contraseña. Contraseñas con **bcrypt** (o argon2id); nunca en texto plano ni en logs.
- Sesión con **JWT de vida corta + refresh token**, entregados en **cookies `HttpOnly`, `Secure`, `SameSite=Lax/Strict`**. No guardar tokens en `localStorage`.
- Roles iniciales: `admin`, `editor`, `viewer` (ampliable). Modelo: usuario → rol (o tabla de permisos si crece).
- Middleware en cadena: `Authenticate` (valida token) → `RequireRole(...)` (autoriza por ruta/acción).
- **La autorización siempre se valida en el servidor.** Ocultar botones o rutas en el frontend es solo UX, nunca seguridad.
- Rate limiting en login, mensajes de error genéricos ("credenciales inválidas"), CORS restringido, validación y sanitización de toda entrada, consultas SQL parametrizadas.
- Endpoints mínimos: `POST /auth/login`, `POST /auth/logout`, `POST /auth/refresh`, `GET /auth/me`, y CRUD de usuarios solo para `admin`.

**Frontend (JavaScript):**
- `services/api.js` centraliza `fetch` con `credentials: 'include'`, maneja 401 (refresh o redirigir a login) y 403 (mensaje de acceso denegado).
- Guard de rutas por rol; el menú lateral muestra solo lo que el rol puede usar.
- Pantalla de login con la misma estandarización de botones, modo claro/oscuro y responsive.

## 10. Calidad de código

- Funciones pequeñas, nombres descriptivos en inglés para código y **textos de interfaz en español**.
- Manejo de errores explícito en Go (`if err != nil`), sin `panic` en handlers; errores devueltos en JSON consistente `{ "error": "mensaje" }`.
- Comentarios solo donde aporten (el "por qué", no el "qué").
- Sin secretos en el repositorio: usar variables de entorno y `.env.example`.
- Formatear con `gofmt` y Prettier.

## 11. Forma de trabajar

1. Antes de programar, resume en pocas líneas qué vas a hacer y qué archivos tocarás.
2. Reutiliza y extiende componentes existentes antes de crear nuevos.
3. Cambios pequeños y verificables; no refactorices código no relacionado con la tarea.
4. Si falta información crítica (modelo de datos, nombres de roles, endpoints), pregunta antes de inventar.

## 12. Definición de "terminado"

Una tarea está completa solo si:
- [ ] Usa los componentes estandarizados (botones, modales, tablas).
- [ ] Botones en #a37cfc, salvo cancelar y error/peligro.
- [ ] Tablas: lista hasta 20 filas, paginación de 20 en 20 si hay más.
- [ ] Se ve bien en modo claro y oscuro.
- [ ] Es responsive de 320px en adelante.
- [ ] Las rutas y endpoints respetan la autenticación y los roles en el servidor.
- [ ] Estados de carga, vacío y error contemplados.
- [ ] Sin errores en consola ni en `go vet`.