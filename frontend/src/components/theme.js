import { createButton } from './button.js';

const STORAGE_KEY = 'theme';

export const LOGOS = {
  BLUE: 'https://netz.com.py/route1/img/header/NETZ-IA.svg',
  WHITE: 'https://netz.com.py/route1/img/header/NETZ-BLANCO.svg',
  LOGIN: './logo/r1.png',
};

export function isDarkMode() {
  return document.documentElement.classList.contains('dark');
}

export function setTheme(mode) {
  const root = document.documentElement;
  const isDark = mode === 'dark';
  if (isDark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  try {
    localStorage.setItem(STORAGE_KEY, isDark ? 'dark' : 'light');
  } catch (_) {
    // Ignorar errores de almacenamiento privado
  }
  window.dispatchEvent(new CustomEvent('theme:change', { detail: { theme: isDark ? 'dark' : 'light' } }));
}

export function toggleTheme() {
  setTheme(isDarkMode() ? 'light' : 'dark');
}

export function getBrandLogoUrl() {
  return isDarkMode() ? LOGOS.WHITE : LOGOS.BLUE;
}

/**
 * Componente único ThemeToggle (AGENTS.md Sección 7)
 */
export function createThemeToggle({ className = '' } = {}) {
  const getIconClass = () => (isDarkMode() ? 'fa-regular fa-sun text-amber-400' : 'fa-regular fa-moon text-brand');

  const btn = createButton({
    variant: 'icon',
    size: 'sm',
    icon: getIconClass(),
    ariaLabel: 'Alternar modo claro y oscuro',
    className: `shadow-sm ${className}`.trim(),
    onClick: () => {
      toggleTheme();
    },
  });

  const updateIcon = () => {
    const iconEl = btn.querySelector('i');
    if (iconEl) {
      iconEl.className = getIconClass();
    }
  };

  window.addEventListener('theme:change', updateIcon);
  return btn;
}

