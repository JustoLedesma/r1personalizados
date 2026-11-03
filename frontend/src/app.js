import { renderLoginPage } from './pages/login.js?v=20261102_15';
import { renderDashboardLayout, MENU_MODULES } from './pages/dashboard.js?v=20261102_15';
import { toast } from './components/toast.js?v=20261102_15';

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

  let currentUser = getStoredUser();
  let lastActivity = Date.now();

  function recordActivity() {
    lastActivity = Date.now();
  }

  ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'].forEach((ev) => {
    window.addEventListener(ev, recordActivity, { passive: true });
  });

  window.__resetInactivityTimer = () => {
    lastActivity = Date.now();
  };

  window.__getInactivityRemainingMinutes = () => {
    if (!currentUser || !currentUser.autoLogoutMinutes || currentUser.autoLogoutMinutes <= 0) {
      return null;
    }
    const totalMs = currentUser.autoLogoutMinutes * 60 * 1000;
    const elapsedMs = Date.now() - lastActivity;
    const remMs = totalMs - elapsedMs;
    return remMs / (60 * 1000);
  };

  window.__setInactivityTimeoutMinutes = (mins) => {
    if (currentUser) {
      currentUser.autoLogoutMinutes = mins;
      lastActivity = Date.now();
    }
  };

  window.addEventListener('profile:updated', (e) => {
    if (e.detail) {
      currentUser = e.detail;
      lastActivity = Date.now();
    }
  });

  // Chequeo periódico de inactividad
  setInterval(() => {
    if (!currentUser || !currentUser.autoLogoutMinutes || currentUser.autoLogoutMinutes <= 0) {
      return;
    }
    const elapsedMinutes = (Date.now() - lastActivity) / (60 * 1000);
    if (elapsedMinutes >= currentUser.autoLogoutMinutes) {
      currentUser = null;
      setStoredUser(null);
      fetch('./api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
      toast.warning('Tu sesión se ha cerrado automáticamente por inactividad.');
      navigateTo('login');
      renderCurrentRoute();
    }
  }, 2000);

  // Validar sesión contra el servidor al iniciar
  if (currentUser) {
    fetch('./api/auth/me', { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error('sesión inválida');
        return res.json();
      })
      .then((data) => {
        if (data && data.user) {
          currentUser = data.user;
          setStoredUser(data.user);
          renderCurrentRoute();
        }
      })
      .catch(() => {
        currentUser = null;
        setStoredUser(null);
        renderCurrentRoute();
      });
  }

  function navigateTo(route) {
    const targetHash = `#/${route}`;
    if (window.location.hash === targetHash) {
      renderCurrentRoute();
    } else {
      window.location.hash = targetHash;
    }
  }

  function renderCurrentRoute() {
    const route = parseRoute();

    if (route === 'login' || !currentUser) {
      renderLoginPage(appRoot, {
        onLoginSuccess: (user) => {
          currentUser = user;
          lastActivity = Date.now();
          setStoredUser(user);
          navigateTo('dashboard');
          renderCurrentRoute();
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
