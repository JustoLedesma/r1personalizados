/**
 * Flashy.js — Librería de notificaciones ligeras (soporta tema claro/oscuro y Font Awesome)
 */
(function (global) {
  const ICON_MAP = {
    success: 'fa-solid fa-circle-check text-emerald-500',
    error: 'fa-solid fa-circle-xmark text-danger',
    warning: 'fa-solid fa-triangle-exclamation text-amber-500',
    info: 'fa-solid fa-circle-info text-brand',
    default: 'fa-solid fa-bell text-brand',
  };

  function ensureContainer(position = 'top-right') {
    const id = `flashy-container-${position}`;
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement('div');
      el.id = id;
      el.className = 'fixed top-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-[calc(100vw-2rem)] pointer-events-none';
      document.body.appendChild(el);
    }
    return el;
  }

  function flashy(message, options = {}) {
    const {
      type = 'default',
      position = 'top-right',
      duration = 3500,
      closable = true,
    } = options;

    const container = ensureContainer(position);

    const item = document.createElement('div');
    item.setAttribute('role', 'status');
    item.className = [
      'pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border',
      'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800',
      'text-slate-800 dark:text-slate-100 text-xs sm:text-sm font-medium',
      'transition-all duration-200 transform translate-y-0 opacity-100',
    ].join(' ');

    const icon = document.createElement('i');
    icon.className = `${ICON_MAP[type] || ICON_MAP.default} text-base shrink-0`;
    icon.setAttribute('aria-hidden', 'true');

    const text = document.createElement('div');
    text.className = 'flex-1 leading-snug';
    text.textContent = message;

    item.append(icon, text);

    function removeToast() {
      item.classList.add('opacity-0', 'translate-x-2');
      setTimeout(() => item.remove(), 180);
    }

    if (closable) {
      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.setAttribute('aria-label', 'Cerrar notificación');
      closeBtn.className =
        'p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 focus:outline-none';
      closeBtn.innerHTML = '<i class="fa-solid fa-xmark text-xs" aria-hidden="true"></i>';
      closeBtn.addEventListener('click', removeToast);
      item.appendChild(closeBtn);
    }

    container.appendChild(item);

    if (duration > 0) {
      setTimeout(removeToast, duration);
    }

    return { close: removeToast };
  }

  global.flashy = flashy;
})(window);

