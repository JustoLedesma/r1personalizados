/**
 * Componente estandarizado Button (AGENTS.md Sección 4)
 * Variantes: 'primary' (por defecto #a37cfc), 'cancel', 'danger', 'ghost', 'icon'
 * Tamaños: 'sm', 'md' (por defecto), 'lg'
 */
export function createButton({
  text = '',
  icon = '',
  iconPosition = 'left',
  variant = 'primary',
  size = 'md',
  type = 'button',
  disabled = false,
  loading = false,
  fullWidth = false,
  ariaLabel = '',
  className = '',
  onClick = null,
} = {}) {
  const btn = document.createElement('button');
  btn.type = type;

  if (ariaLabel) {
    btn.setAttribute('aria-label', ariaLabel);
  } else if (!text && icon) {
    btn.setAttribute('aria-label', 'Acción');
  }

  const baseClasses = [
    'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all duration-150 select-none',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900',
    'disabled:opacity-50 disabled:cursor-not-allowed',
  ];

  const variantClasses = {
    primary: 'bg-brand hover:bg-brand-hover active:bg-brand-active text-white shadow-sm',
    cancel: 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 active:bg-slate-100 dark:active:bg-slate-700',
    danger: 'bg-danger hover:bg-danger-hover active:bg-red-800 text-white shadow-sm',
    ghost: 'bg-transparent text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800',
    icon: 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-brand hover:bg-brand-soft/50 dark:hover:bg-slate-800',
  };

  const sizeClasses = {
    sm: variant === 'icon' ? 'min-h-[40px] min-w-[40px] sm:min-h-[34px] sm:min-w-[34px] p-2 text-xs' : 'min-h-[40px] sm:min-h-[34px] px-3 py-1.5 text-xs',
    md: variant === 'icon' ? 'min-h-[40px] min-w-[40px] p-2 text-sm' : 'min-h-[40px] px-4 py-2 text-sm',
    lg: variant === 'icon' ? 'min-h-[44px] min-w-[44px] p-2.5 text-base' : 'min-h-[44px] px-5 py-2.5 text-sm',
  };

  btn.className = [
    ...baseClasses,
    variantClasses[variant] || variantClasses.primary,
    sizeClasses[size] || sizeClasses.md,
    fullWidth ? 'w-full' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  let isLoading = Boolean(loading);

  function renderContent() {
    btn.innerHTML = '';
    if (isLoading) {
      const spinner = document.createElement('i');
      spinner.className = 'fa-solid fa-circle-notch fa-spin text-current';
      spinner.setAttribute('aria-hidden', 'true');
      btn.appendChild(spinner);
      if (text) {
        const span = document.createElement('span');
        span.textContent = text;
        btn.appendChild(span);
      }
      return;
    }

    if (icon && iconPosition === 'left') {
      const i = document.createElement('i');
      i.className = icon;
      i.setAttribute('aria-hidden', 'true');
      btn.appendChild(i);
    }

    if (text) {
      const span = document.createElement('span');
      span.textContent = text;
      btn.appendChild(span);
    }

    if (icon && iconPosition === 'right') {
      const i = document.createElement('i');
      i.className = icon;
      i.setAttribute('aria-hidden', 'true');
      btn.appendChild(i);
    }
  }

  btn.disabled = Boolean(disabled || isLoading);
  renderContent();

  if (typeof onClick === 'function') {
    btn.addEventListener('click', (e) => {
      if (btn.disabled || isLoading) {
        e.preventDefault();
        return;
      }
      onClick(e, btn);
    });
  }

  btn.setLoading = (state) => {
    isLoading = Boolean(state);
    btn.disabled = Boolean(disabled || isLoading);
    renderContent();
  };

  return btn;
}

