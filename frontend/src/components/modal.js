import { createButton } from './button.js';

/**
 * Componente estandarizado Modal y ConfirmModal (AGENTS.md Sección 5)
 * Tamaños: 'sm', 'md', 'lg', 'xl'
 */
export function openModal({
  title = '',
  content = '',
  size = 'md',
  confirmText = 'Guardar',
  cancelText = 'Cancelar',
  confirmVariant = 'primary',
  hideFooter = false,
  hasUnsavedChanges = () => false,
  onConfirm = null,
  onClose = null,
} = {}) {
  const previousActiveElement = document.activeElement;
  const previousOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';

  const titleId = `modal-title-${Math.random().toString(36).slice(2, 9)}`;

  const sizeMap = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  const overlay = document.createElement('div');
  overlay.className =
    'fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-xs p-2 sm:p-4 transition-opacity';

  const dialog = document.createElement('div');
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', titleId);
  dialog.className = [
    'w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100',
    'border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl',
    'flex flex-col max-h-[92vh] sm:max-h-[85vh] overflow-hidden',
    sizeMap[size] || sizeMap.md,
  ].join(' ');

  // Cabecera
  const header = document.createElement('div');
  header.className =
    'flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0';

  const titleEl = document.createElement('h2');
  titleEl.id = titleId;
  titleEl.className = 'text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100';
  titleEl.textContent = title;

  const headerActions = document.createElement('div');
  headerActions.className = 'flex items-center gap-1';

  let isExpanded = false;
  const baseSizeClass = sizeMap[size] || sizeMap.md;

  const expandBtn = createButton({
    variant: 'ghost',
    size: 'sm',
    icon: 'fa-solid fa-expand',
    ariaLabel: 'Expandir o contraer ventana modal',
    onClick: () => {
      isExpanded = !isExpanded;
      const iconEl = expandBtn.querySelector('i');
      if (isExpanded) {
        dialog.classList.remove(baseSizeClass, 'max-h-[92vh]', 'sm:max-h-[85vh]');
        dialog.classList.add('max-w-6xl', 'h-[94vh]', 'max-h-[94vh]');
        if (iconEl) iconEl.className = 'fa-solid fa-compress';
      } else {
        dialog.classList.remove('max-w-6xl', 'h-[94vh]', 'max-h-[94vh]');
        dialog.classList.add(baseSizeClass, 'max-h-[92vh]', 'sm:max-h-[85vh]');
        if (iconEl) iconEl.className = 'fa-solid fa-expand';
      }
    },
  });

  const closeBtn = createButton({
    variant: 'ghost',
    size: 'sm',
    icon: 'fa-solid fa-xmark',
    ariaLabel: 'Cerrar ventana modal',
    onClick: () => attemptClose(),
  });

  headerActions.append(expandBtn, closeBtn);
  header.append(titleEl, headerActions);

  // Cuerpo con scroll interno
  const body = document.createElement('div');
  body.className = 'p-5 overflow-y-auto flex-1 text-sm text-slate-700 dark:text-slate-300';
  if (typeof content === 'string') {
    body.innerHTML = content;
  } else if (content instanceof HTMLElement) {
    body.appendChild(content);
  }

  dialog.append(header, body);

  // Pie de acciones (cancel a la izquierda, primary/danger a la derecha)
  if (!hideFooter) {
    const footer = document.createElement('div');
    footer.className =
      'flex items-center justify-end gap-3 px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 shrink-0';

    const btnCancel = createButton({
      text: cancelText,
      variant: 'cancel',
      onClick: () => attemptClose(),
    });

    const btnConfirm = createButton({
      text: confirmText,
      variant: confirmVariant,
      onClick: async (_, btnInstance) => {
        if (typeof onConfirm === 'function') {
          const result = await onConfirm({ close, setLoading: btnInstance.setLoading, body });
          if (result !== false) {
            close();
          }
        } else {
          close();
        }
      },
    });

    footer.append(btnCancel, btnConfirm);
    dialog.appendChild(footer);
  }

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  function close() {
    window.removeEventListener('keydown', handleKeyDown);
    document.body.style.overflow = previousOverflow;
    overlay.remove();
    if (previousActiveElement && typeof previousActiveElement.focus === 'function') {
      previousActiveElement.focus();
    }
    if (typeof onClose === 'function') {
      onClose();
    }
  }

  function attemptClose() {
    if (typeof hasUnsavedChanges === 'function' && hasUnsavedChanges()) {
      const discard = window.confirm('Tienes cambios sin guardar. ¿Deseas descartarlos y cerrar?');
      if (!discard) return;
    }
    close();
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      attemptClose();
      return;
    }
    if (e.key === 'Tab') {
      const focusable = dialog.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  overlay.addEventListener('mousedown', (e) => {
    if (e.target === overlay) {
      attemptClose();
    }
  });

  window.addEventListener('keydown', handleKeyDown);

  const firstFocusable = dialog.querySelector(
    'input:not([disabled]), button:not([disabled]), select:not([disabled]), textarea:not([disabled])'
  );
  if (firstFocusable) {
    firstFocusable.focus();
  }

  return { close, dialog, body };
}

export function openConfirmModal({
  title = 'Confirmar acción',
  message = '¿Estás seguro de que deseas continuar?',
  confirmText = 'Eliminar',
  cancelText = 'Cancelar',
  onConfirm = null,
} = {}) {
  const wrapper = document.createElement('div');
  wrapper.className = 'flex items-start gap-3.5';
  wrapper.innerHTML = `
    <div class="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/60 text-danger flex items-center justify-center shrink-0">
      <i class="fa-solid fa-triangle-exclamation"></i>
    </div>
    <div class="pt-0.5">
      <p class="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">${message}</p>
    </div>
  `;

  return openModal({
    title,
    content: wrapper,
    size: 'sm',
    confirmText,
    cancelText,
    confirmVariant: 'danger',
    onConfirm,
  });
}

