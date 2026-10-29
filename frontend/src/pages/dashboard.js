import { createButton } from '../components/button.js';
import { createThemeToggle, getBrandLogoUrl } from '../components/theme.js';
import { toast } from '../components/toast.js';
import { apiFetch } from '../services/api.js';
import { renderClientesModule } from './clientes.js?v=20261029_5';
import { renderProveedoresModule } from './proveedores.js?v=20261029_5';
import { renderPerfilesMensajesModule } from './perfiles-mensajes.js?v=20261029_5';
import { renderDifusionMensajesModule } from './difusion-mensajes.js?v=20261029_5';
import { renderReciclajeModule } from './reciclaje.js?v=20261029_5';
import {
  subscribeQueue,
  formatRemainingDuration,
  syncPendingTasksFromDB,
  setPreferredBroadcastTab,
  clearCompletedBroadcastBanner,
} from '../services/queue-manager.js?v=20261029_5';

export const MENU_MODULES = [
  { id: 'dashboard', label: 'Panel General', icon: 'fa-solid fa-table-cells-large', roles: ['admin', 'editor', 'viewer'] },
  { id: 'pedidos', label: 'Pedidos', icon: 'fa-regular fa-clipboard', roles: ['admin', 'editor', 'viewer'] },
  { id: 'presupuestos', label: 'Presupuestos', icon: 'fa-regular fa-file-lines', roles: ['admin', 'editor', 'viewer'] },
  { id: 'clientes', label: 'Clientes', icon: 'fa-solid fa-users', roles: ['admin', 'editor', 'viewer'] },
  { id: 'proveedor', label: 'Proveedor', icon: 'fa-solid fa-truck-field', roles: ['admin', 'editor', 'viewer'] },
  { id: 'pagos', label: 'Pagos', icon: 'fa-solid fa-file-invoice-dollar', roles: ['admin', 'editor', 'viewer'] },
  { id: 'productos', label: 'Productos', icon: 'fa-solid fa-cube', roles: ['admin', 'editor', 'viewer'] },
  { id: 'mensajes', label: 'Perfiles de Mensajes', icon: 'fa-regular fa-comment', roles: ['admin', 'editor'] },
  { id: 'sessions', label: 'Sesiones WhatsApp', icon: 'fa-solid fa-mobile-screen', roles: ['admin', 'editor'] },
  { id: 'broadcast', label: 'Difusión y Mensajes', icon: 'fa-solid fa-bullhorn', roles: ['admin', 'editor'] },
  { id: 'users', label: 'Usuarios y Roles', icon: 'fa-solid fa-user-group', roles: ['admin'] },
  { id: 'reciclaje', label: 'Reciclaje', icon: 'fa-solid fa-recycle', roles: ['admin'] },
  { id: 'configuracion', label: 'Configuración', icon: 'fa-solid fa-gear', roles: ['admin'] },
];

export function renderDashboardLayout(container, { user, activeModule = 'dashboard', onNavigate, onLogout } = {}) {
  container.innerHTML = '';

  const currentUser = user || {
    fullName: 'Operador Ventas',
    role: 'admin',
  };

  const role = (currentUser.role || 'admin').toLowerCase();
  const allowedModules = MENU_MODULES.filter((m) => m.roles.includes(role));
  const currentMod = allowedModules.find((m) => m.id === activeModule) || allowedModules[0];

  const shell = document.createElement('div');
  shell.className =
    'min-h-screen h-screen w-full overflow-hidden flex bg-[#f8fafc] dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200';

  // Fondo oscuro para el drawer móvil
  const mobileOverlay = document.createElement('div');
  mobileOverlay.className =
    'fixed inset-0 z-30 bg-slate-950/50 backdrop-blur-xs hidden lg:hidden transition-opacity';

  // Sidebar izquierdo (fijo en desktop lg+, drawer en móvil/tablet)
  const sidebar = document.createElement('aside');
  sidebar.setAttribute('aria-label', 'Menú principal');
  sidebar.className = [
    'fixed inset-y-0 left-0 z-40 w-60 bg-white dark:bg-slate-900',
    'border-r border-slate-200/80 dark:border-slate-800',
    'flex flex-col justify-between shrink-0 select-none',
    'transform -translate-x-full lg:translate-x-0 lg:static transition-transform duration-200 ease-in-out',
  ].join(' ');

  function openMobileSidebar() {
    sidebar.classList.remove('-translate-x-full');
    mobileOverlay.classList.remove('hidden');
  }

  function closeMobileSidebar() {
    sidebar.classList.add('-translate-x-full');
    mobileOverlay.classList.add('hidden');
  }

  mobileOverlay.addEventListener('click', closeMobileSidebar);

  // Cabecera del Sidebar con el logo oficial NETZ (azul en modo claro, blanco en modo oscuro)
  const sidebarTop = document.createElement('div');
  sidebarTop.className = 'flex flex-col flex-1 min-h-0';

  const brandBar = document.createElement('div');
  brandBar.className = 'h-16 px-5 flex items-center justify-between shrink-0';

  const brandLink = document.createElement('a');
  brandLink.href = '#/dashboard';
  brandLink.className = 'inline-flex items-center focus:outline-none';

  const brandLogo = document.createElement('img');
  brandLogo.src = getBrandLogoUrl();
  brandLogo.alt = 'NETZ';
  brandLogo.className = 'h-7 w-auto object-contain';
  brandLink.appendChild(brandLogo);

  window.addEventListener('theme:change', () => {
    brandLogo.src = getBrandLogoUrl();
  });

  const closeDrawerBtn = createButton({
    variant: 'ghost',
    size: 'sm',
    icon: 'fa-solid fa-xmark',
    ariaLabel: 'Cerrar menú lateral',
    className: 'lg:hidden',
    onClick: closeMobileSidebar,
  });

  brandBar.append(brandLink, closeDrawerBtn);
  sidebarTop.appendChild(brandBar);

  // Lista de módulos del menú
  const nav = document.createElement('nav');
  nav.className = 'px-3 py-2 space-y-1 flex-1 overflow-y-auto';

  allowedModules.forEach((mod) => {
    const isActive = mod.id === currentMod.id;
    const itemBtn = document.createElement('button');
    itemBtn.type = 'button';
    itemBtn.className = [
      'w-full min-h-[40px] sm:min-h-[38px] flex items-center gap-3 px-3.5 py-2 rounded-lg text-xs transition-all duration-150 text-left',
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand',
      isActive
        ? 'bg-brand text-white font-semibold shadow-xs'
        : 'text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-100 dark:hover:bg-slate-800/70',
    ].join(' ');

    const iconEl = document.createElement('i');
    iconEl.className = `${mod.icon} w-4 text-center ${isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`;
    iconEl.setAttribute('aria-hidden', 'true');

    const labelEl = document.createElement('span');
    labelEl.className = 'truncate';
    labelEl.textContent = mod.label;

    itemBtn.append(iconEl, labelEl);
    itemBtn.addEventListener('click', () => {
      closeMobileSidebar();
      if (typeof onNavigate === 'function') {
        onNavigate(mod.id);
      }
    });

    nav.appendChild(itemBtn);
  });

  sidebarTop.appendChild(nav);

  // Pie del Sidebar con avatar e información del usuario
  const sidebarFooter = document.createElement('div');
  sidebarFooter.className =
    'px-4 py-3.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-3 shrink-0';

  const initials = (currentUser.fullName || 'Operador Ventas')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');

  const avatar = document.createElement('div');
  avatar.className =
    'w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold flex items-center justify-center shrink-0';
  avatar.textContent = initials || 'OP';

  const userMeta = document.createElement('div');
  userMeta.className = 'min-w-0 flex-1';
  userMeta.innerHTML = `
    <p class="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate leading-tight">${currentUser.fullName || 'Operador Ventas'}</p>
    <p class="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 leading-tight mt-0.5">${(currentUser.role || 'ADMIN').toUpperCase()}</p>
  `;

  sidebarFooter.append(avatar, userMeta);
  sidebar.append(sidebarTop, sidebarFooter);

  // Columna derecha: Cabecera superior + Área asignada del módulo
  const contentCol = document.createElement('div');
  contentCol.className = 'flex-1 flex flex-col min-w-0 h-screen overflow-hidden';

  // Cabecera superior
  const header = document.createElement('header');
  header.className =
    'h-14 px-3 sm:px-6 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2 shrink-0';

  const headerLeft = document.createElement('div');
  headerLeft.className = 'flex items-center gap-2.5 sm:gap-3 min-w-0';

  const menuToggleBtn = createButton({
    variant: 'ghost',
    size: 'sm',
    icon: 'fa-solid fa-bars',
    ariaLabel: 'Abrir menú de navegación',
    className: 'lg:hidden',
    onClick: openMobileSidebar,
  });

  const pageTitle = document.createElement('h1');
  pageTitle.className = 'text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 truncate';
  pageTitle.textContent = currentMod.label;

  const statusBadge = document.createElement('button');
  statusBadge.type = 'button';
  statusBadge.className =
    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60 hover:bg-emerald-100/70 dark:hover:bg-emerald-900/50 transition-colors shrink-0 cursor-pointer';
  statusBadge.innerHTML = `
    <span class="relative flex h-2 w-2">
      <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
      <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
    </span>
    <i class="fa-brands fa-whatsapp text-emerald-600 dark:text-emerald-400 text-xs" aria-hidden="true"></i>
    <span class="hidden sm:inline">WhatsApp Online</span>
    <span class="sm:hidden">Online</span>
  `;
  statusBadge.addEventListener('click', () => {
    if (typeof onNavigate === 'function') {
      onNavigate('sessions');
    }
  });

  // Indicadores en vivo en la parte superior al lado del estado Online de WhatsApp:
  // 1) Progreso de Difusión en curso (conteo de enviados + barra de progreso)
  // 2) Cuenta regresiva de Mensaje Programado (tiempo que falta + barra de progreso)
  const headerQueueBox = document.createElement('div');
  headerQueueBox.className = 'flex items-center gap-2 overflow-x-auto no-scrollbar';

  syncPendingTasksFromDB();

  subscribeQueue((snap) => {
    headerQueueBox.innerHTML = '';

    // Píldora de Difusión Masiva en curso o recién completada
    if (snap.broadcast.active || (snap.broadcast.completed && snap.broadcast.total > 0)) {
      const b = snap.broadcast;
      const bPill = document.createElement('div');
      bPill.className =
        'inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-semibold bg-brand-soft/80 dark:bg-brand/20 text-brand border border-brand/30 shrink-0';

      const goBtn = document.createElement('button');
      goBtn.type = 'button';
      goBtn.title = 'Ver progreso de la campaña de difusión';
      goBtn.className = 'inline-flex items-center gap-2 cursor-pointer focus:outline-none';
      goBtn.innerHTML = `
        <i class="fa-solid ${b.active ? 'fa-bullhorn fa-beat-fade' : 'fa-circle-check'} text-xs"></i>
        <span>
          Difusión: <strong>${b.sent}/${b.total}</strong> enviados (${b.progressPercent}%)
          ${b.active ? `<span class="text-[10px] opacity-80 ml-1">· próx. ${b.secondsToNext}s</span>` : ''}
        </span>
        <span class="w-16 sm:w-24 h-1.5 rounded-full bg-white/80 dark:bg-slate-800 overflow-hidden inline-flex">
          <span class="h-full bg-brand transition-all duration-300" style="width: ${b.progressPercent}%"></span>
        </span>
      `;
      goBtn.addEventListener('click', () => {
        setPreferredBroadcastTab('difusion');
        if (typeof onNavigate === 'function') onNavigate('broadcast');
      });
      bPill.appendChild(goBtn);

      if (!b.active && b.completed) {
        const closeDoneBtn = document.createElement('button');
        closeDoneBtn.type = 'button';
        closeDoneBtn.title = 'Ocultar aviso';
        closeDoneBtn.className = 'text-brand hover:text-brand-active ml-0.5 cursor-pointer';
        closeDoneBtn.innerHTML = '<i class="fa-solid fa-xmark text-[10px]"></i>';
        closeDoneBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          clearCompletedBroadcastBanner();
        });
        bPill.appendChild(closeDoneBtn);
      }

      headerQueueBox.appendChild(bPill);
    }

    // Píldora de Mensaje(s) Programado(s) con tiempo restante y barra de progreso
    if (snap.scheduled.length > 0) {
      const nextSched = snap.scheduled[0];
      const extraCount = snap.scheduled.length - 1;
      const destName =
        nextSched.nombreDestinatario && nextSched.nombreDestinatario !== '—'
          ? nextSched.nombreDestinatario
          : nextSched.telefonoDestinatario;

      const sPill = document.createElement('button');
      sPill.type = 'button';
      sPill.title = 'Ver mensaje programado en cola';
      sPill.className =
        'inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/60 shrink-0 cursor-pointer hover:bg-amber-100/70 transition-colors';
      sPill.innerHTML = `
        <i class="fa-regular fa-clock text-amber-500 text-xs"></i>
        <span>
          Programado (${ destName }): falta <strong>${formatRemainingDuration(nextSched.remainingSeconds)}</strong>
          ${extraCount > 0 ? `<span class="text-[10px] opacity-80">(+${extraCount} más)</span>` : ''}
        </span>
        <span class="w-14 sm:w-20 h-1.5 rounded-full bg-amber-200/60 dark:bg-slate-800 overflow-hidden inline-flex">
          <span class="h-full bg-amber-500 transition-all duration-300" style="width: ${nextSched.progressPercent}%"></span>
        </span>
      `;
      sPill.addEventListener('click', () => {
        setPreferredBroadcastTab('programar');
        if (typeof onNavigate === 'function') onNavigate('broadcast');
      });

      headerQueueBox.appendChild(sPill);
    }
  });

  headerLeft.append(menuToggleBtn, pageTitle, statusBadge, headerQueueBox);

  const headerRight = document.createElement('div');
  headerRight.className = 'flex items-center gap-2 shrink-0';

  const themeToggle = createThemeToggle();

  const logoutBtn = createButton({
    text: 'Salir',
    icon: 'fa-solid fa-arrow-right-from-bracket',
    variant: 'cancel',
    size: 'sm',
    ariaLabel: 'Cerrar sesión y salir',
    onClick: async () => {
      try {
        await apiFetch('/auth/logout', { method: 'POST' });
      } catch (_) {
        // Ignorar si no hay backend activo
      }
      toast.info('Has cerrado sesión.');
      if (typeof onLogout === 'function') {
        onLogout();
      }
    },
  });

  headerRight.append(themeToggle, logoutBtn);
  header.append(headerLeft, headerRight);

  // Área asignada principal (toma toda el área asignada)
  const mainArea = document.createElement('main');
  mainArea.id = 'module-workspace';
  mainArea.dataset.module = currentMod.id;
  mainArea.className = 'app-module-area p-4 sm:p-6';

  contentCol.append(header, mainArea);
  shell.append(mobileOverlay, sidebar, contentCol);
  container.appendChild(shell);

  try {
    if (currentMod.id === 'clientes') {
      renderClientesModule(mainArea);
    } else if (currentMod.id === 'proveedor') {
      renderProveedoresModule(mainArea);
    } else if (currentMod.id === 'mensajes') {
      renderPerfilesMensajesModule(mainArea);
    } else if (currentMod.id === 'broadcast') {
      renderDifusionMensajesModule(mainArea);
    } else if (currentMod.id === 'reciclaje') {
      renderReciclajeModule(mainArea);
    }
  } catch (err) {
    console.error('[Error renderizando módulo]', err);
  }

  return { mainArea };
}

