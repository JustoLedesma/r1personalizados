import { toast } from '../components/toast.js';

/**
 * Servicio centralizado de peticiones HTTP (AGENTS.md Sección 9)
 * - Usa credentials: 'include' para cookies HttpOnly
 * - Maneja 401 (intento de refresh o redirección a login) y 403 (acceso denegado)
 */
export async function apiFetch(endpoint, options = {}, isRetry = false) {
  const cleanEndpoint = endpoint.startsWith('/') ? `.${endpoint}` : endpoint;

  const config = {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  };

  const response = await fetch(cleanEndpoint, config);

  if (response.status === 401 && !isRetry && !cleanEndpoint.includes('/auth/login') && !cleanEndpoint.includes('/auth/refresh')) {
    try {
      const refreshRes = await fetch('./auth/refresh', {
        method: 'POST',
        credentials: 'include',
      });
      if (refreshRes.ok) {
        return apiFetch(endpoint, options, true);
      }
    } catch (_) {
      // Continuar al evento de sesión expirada
    }
    window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    throw new Error('Sesión expirada');
  }

  if (response.status === 403) {
    toast.error('Acceso denegado: no tienes permisos para realizar esta acción.');
    throw new Error('Acceso denegado');
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Error en la solicitud al servidor');
  }
  return data;
}

