import { renderLoginPage } from './pages/login.js?v=20261030_10';
import { renderDashboardLayout, MENU_MODULES } from './pages/dashboard.js?v=20261031_5';

const SESSION_STORAGE_KEY = 'r1_session_user';

function getStoredUser() {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

function setStoredUser(user) {
  try {
    if (user) {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
    } else {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    }
  } catch (_) {
    // Ignorar errores de sessionStorage
  }
}

function parseRoute() {
  const hash = window.location.hash || '#/dashboard';
  const clean = hash.replace(/^#\/?/, '').trim();
  if (!clean) return 'dashboard';
  return clean.split('/')[0].toLowerCase();
}

function initApp() {
  const appRoot = document.getElementById('app');
  if (!appRoot) return;

  let currentUser = getStoredUser() || {
    id: 1,
    username: 'admin',
    email: 'admin@netz.local',
    fullName: 'Operador Ventas',
    role: 'admin',
  };

  function navigateTo(route) {
    window.location.hash = `#/${route}`;
  }

  function renderCurrentRoute() {
    const route = parseRoute();

    if (route === 'login' || !currentUser) {
      renderLoginPage(appRoot, {
        onLoginSuccess: (user) => {
          currentUser = user;
          setStoredUser(user);
          navigateTo('dashboard');
        },
      });
      return;
    }

    const validModule = MENU_MODULES.some((m) => m.id === route) ? route : 'dashboard';

    renderDashboardLayout(appRoot, {
      user: currentUser,
      activeModule: validModule,
      onNavigate: (moduleId) => {
        navigateTo(moduleId);
      },
      onLogout: () => {
        currentUser = null;
        setStoredUser(null);
        navigateTo('login');
      },
    });
  }

  window.addEventListener('hashchange', renderCurrentRoute);
  window.addEventListener('auth:unauthorized', () => {
    currentUser = null;
    setStoredUser(null);
    navigateTo('login');
  });

  renderCurrentRoute();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

