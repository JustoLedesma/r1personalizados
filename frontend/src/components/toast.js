import { isDarkMode } from './theme.js';

/**
 * Notificaciones centralizadas con Flashy.js (AGENTS.md Sección 1)
 */
export function notify(message, type = 'default', options = {}) {
  const theme = isDarkMode() ? 'dark' : 'light';
  if (typeof window.flashy === 'function') {
    return window.flashy(message, {
      type,
      position: 'top-right',
      duration: 3500,
      closable: true,
      theme,
      ...options,
    });
  }
  return null;
}

export const toast = {
  success: (msg, opts) => notify(msg, 'success', opts),
  error: (msg, opts) => notify(msg, 'error', opts),
  warning: (msg, opts) => notify(msg, 'warning', opts),
  info: (msg, opts) => notify(msg, 'info', opts),
};

