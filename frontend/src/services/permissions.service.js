/**
 * Servicio Centralizado de Permisos y Modos (AGENTS.md)
 * Maneja los permisos a nivel de módulo, discriminando entre 'editor', 'viewer' y 'admin'/'root'.
 */

export function getCurrentUser() {
  try {
    const raw = sessionStorage.getItem('r1_session_user');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

export function setCurrentUser(user) {
  if (!user) {
    sessionStorage.removeItem('r1_session_user');
    return;
  }
  sessionStorage.setItem('r1_session_user', JSON.stringify(user));
}

export function isRootUser() {
  const user = getCurrentUser();
  return !!(user && user.isRoot);
}

export function isAdminUser() {
  const user = getCurrentUser();
  return !!(user && (user.isRoot || user.role === 'admin'));
}

/**
 * Determina si el usuario actual tiene acceso (al menos lectura) a un módulo dado.
 */
export function hasModuleAccess(moduleId) {
  const user = getCurrentUser();
  if (!user) return false;
  if (user.isRoot || user.role === 'admin') return true;

  if (moduleId === 'usuarios-roles') return false; // Solo admins
  if (!user.permissions) return false;

  return !!user.permissions[moduleId];
}

/**
 * Obtiene el modo del usuario en un módulo: 'editor', 'viewer' o null.
 */
export function getModuleMode(moduleId) {
  const user = getCurrentUser();
  if (!user) return null;
  if (user.isRoot || user.role === 'admin') return 'editor';

  if (!user.permissions) return null;
  return user.permissions[moduleId] || null;
}

/**
 * Indica si el usuario puede realizar acciones de escritura (crear, editar, eliminar, enviar).
 */
export function canWrite(moduleId) {
  const mode = getModuleMode(moduleId);
  return mode === 'editor';
}

/**
 * Indica si el usuario está en modo Solo Vista en el módulo.
 */
export function isViewOnly(moduleId) {
  const user = getCurrentUser();
  if (!user) return true;
  if (user.isRoot || user.role === 'admin') return false;
  const mode = getModuleMode(moduleId);
  return mode === 'viewer';
}

/**
 * Aplica el modo Solo Vista a un contenedor del DOM de un módulo:
 * Deshabilita u oculta botones de acción (crear, editar, eliminar, guardar, enviar, etc.)
 */
export function applyViewOnlyMode(container, moduleId) {
  if (!container || !isViewOnly(moduleId)) return;

  // Botones marcados explícitamente para escritura
  const writeElements = container.querySelectorAll(
    '[data-action="create"], [data-action="edit"], [data-action="delete"], [data-action="write"], [data-action="send"], [data-action="import"]'
  );
  writeElements.forEach((el) => {
    el.setAttribute('disabled', 'true');
    el.classList.add('opacity-40', 'cursor-not-allowed', 'pointer-events-none');
    el.title = 'Modo Solo Vista: No tienes permisos para realizar cambios en este módulo';
  });

  // Ocultar botones flotantes de agregar
  const addButtons = container.querySelectorAll('button');
  addButtons.forEach((btn) => {
    const text = btn.textContent.toLowerCase();
    if (
      text.includes('nuevo') ||
      text.includes('crear') ||
      text.includes('guardar') ||
      text.includes('eliminar') ||
      text.includes('importar') ||
      text.includes('enviar whatsapp') ||
      text.includes('aceptado') ||
      text.includes('rechazado')
    ) {
      // Si no es un botón de cancelar, ver o volver
      if (!text.includes('cancelar') && !text.includes('volver') && !text.includes('ver') && !text.includes('pdf')) {
        btn.setAttribute('disabled', 'true');
        btn.classList.add('opacity-40', 'cursor-not-allowed', 'pointer-events-none');
        btn.title = 'Modo Solo Vista';
      }
    }
  });
}

