import { createButton } from '../components/button.js';
import { openModal } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { apiFetch } from '../services/api.js';

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatGuaranies(amount) {
  const num = Math.round(Number(amount) || 0);
  return num.toLocaleString('es-PY') + ' Gs.';
}

function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getAsuncionDate() {
  const s = new Date().toLocaleString('en-US', { timeZone: 'America/Asuncion' });
  return new Date(s);
}

function getISOWeekNumber(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
}

function getWeekRangeFromDate(refDate) {
  const d = new Date(refDate);
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    desde: toISODate(monday),
    hasta: toISODate(sunday),
    semana: getISOWeekNumber(monday),
    anio: monday.getFullYear(),
  };
}

function getWeekRangeByNumber(year, weekNum) {
  const jan4 = new Date(year, 0, 4);
  const day = jan4.getDay() || 7;
  const monday1 = new Date(jan4);
  monday1.setDate(jan4.getDate() - (day - 1));
  const targetMonday = new Date(monday1);
  targetMonday.setDate(monday1.getDate() + (weekNum - 1) * 7);
  const targetSunday = new Date(targetMonday);
  targetSunday.setDate(targetMonday.getDate() + 6);
  return {
    desde: toISODate(targetMonday),
    hasta: toISODate(targetSunday),
    semana: weekNum,
    anio: year,
  };
}

const STORAGE_KEY = 'r1_dashboard_filters_v2';

export function renderDashboardView(container, onNavigate, currentUser) {
  container.innerHTML = '';

  const role = (currentUser?.role || 'admin').toLowerCase();
  const isRoot = Boolean(currentUser?.isRoot || role === 'admin');
  const perms = currentUser?.permissions || {};

  const canPedidos = isRoot || Boolean(perms['pedidos']);
  const canPagos = isRoot || Boolean(perms['pagos']);
  const canMensajes = isRoot || Boolean(perms['difusion-mensajes'] || perms['mensajes']);
  const canGeneral = canPedidos || canPagos;

  const now = getAsuncionDate();
  const thisWeek = getWeekRangeFromDate(now);

  const defaultFilters = {
    tipoAtajo: 'todo',
    dia: '',
    desde: '2020-01-01',
    hasta: '2099-12-31',
    semanaNum: null,
    semanaAnio: null,
    estado: 'todos',
  };

  let initialFilters = { ...defaultFilters };

  // 1. Limpiar versiones previas de filtros y cargar desde localStorage v2
  try {
    localStorage.removeItem('r1_dashboard_filters_v1');
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.desde && parsed.hasta) {
        initialFilters = { ...initialFilters, ...parsed };
      }
    }
  } catch (_) {}

  // 2. Sobrescribir desde parámetros en URL Hash si existen
  try {
    const hash = window.location.hash || '';
    const qIdx = hash.indexOf('?');
    if (qIdx !== -1) {
      const sp = new URLSearchParams(hash.slice(qIdx + 1));
      if (sp.get('desde')) initialFilters.desde = sp.get('desde');
      if (sp.get('hasta')) initialFilters.hasta = sp.get('hasta');
      if (sp.get('dia')) initialFilters.dia = sp.get('dia');
      if (sp.get('estado')) initialFilters.estado = sp.get('estado');
      if (sp.get('tipoAtajo')) initialFilters.tipoAtajo = sp.get('tipoAtajo');
    }
  } catch (_) {}

  const state = {
    filters: initialFilters,
    loading: false,
    stats: null,
    chartInstances: {},
    pendView: 'list',
  };

  function saveFilters() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.filters));
    } catch (_) {}
    try {
      const params = new URLSearchParams();
      if (state.filters.desde) params.set('desde', state.filters.desde);
      if (state.filters.hasta) params.set('hasta', state.filters.hasta);
      if (state.filters.dia) params.set('dia', state.filters.dia);
      if (state.filters.estado && state.filters.estado !== 'todos') params.set('estado', state.filters.estado);
      if (state.filters.tipoAtajo) params.set('tipoAtajo', state.filters.tipoAtajo);
      const queryStr = params.toString();
      const newHash = queryStr ? `#/dashboard?${queryStr}` : '#/dashboard';
      window.history.replaceState(null, '', newHash);
    } catch (_) {}
  }

  const wrapper = document.createElement('div');
  wrapper.className = 'w-full space-y-6 select-none';
  container.appendChild(wrapper);

  // Secciones
  const headerSection = document.createElement('div');
  const filtersSection = document.createElement('div');
  const kpisSection = document.createElement('div');
  const chartsSection = document.createElement('div');
  const quickAccessSection = document.createElement('div');

  wrapper.append(headerSection, filtersSection, kpisSection, chartsSection, quickAccessSection);

  // ========================================================================
  // 1. ENCABEZADO
  // ========================================================================
  function renderHeader() {
    headerSection.innerHTML = `
      <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div class="space-y-1">
          <div class="flex items-center gap-2">
            <span class="w-8 h-8 rounded-xl bg-brand-soft dark:bg-brand/20 text-brand flex items-center justify-center text-sm font-bold">
              <i class="fa-solid fa-chart-pie"></i>
            </span>
            <h1 class="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">R1 Personalizados</h1>
          </div>
          <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Control de ingresos, egresos, pedidos, pagos y actividad en tiempo real.
          </p>
        </div>
        <div class="flex items-center gap-2">
          ${
            canMensajes
              ? `<button type="button" id="dash-btn-broadcast" class="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-brand text-white hover:bg-brand-hover active:bg-brand-active shadow-xs cursor-pointer transition">
                  <i class="fa-solid fa-bullhorn text-xs"></i>
                  <span>Difusión y Mensajes</span>
                </button>`
              : ''
          }
          <button type="button" id="dash-btn-cfg" class="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-brand/40 cursor-pointer transition">
            <i class="fa-solid fa-gear text-xs"></i>
            <span>Configuración</span>
          </button>
        </div>
      </div>
    `;

    headerSection.querySelector('#dash-btn-broadcast')?.addEventListener('click', () => onNavigate?.('broadcast'));
    headerSection.querySelector('#dash-btn-cfg')?.addEventListener('click', () => onNavigate?.('configuracion'));
  }

  // ========================================================================
  // 2. BARRA DE FILTROS GLOBAL
  // ========================================================================
  function getPeriodLabel() {
    const f = state.filters;
    if (f.tipoAtajo === 'hoy') return `Hoy (${formatDateDisplay(f.desde)})`;
    if (f.tipoAtajo === 'ayer') return `Ayer (${formatDateDisplay(f.desde)})`;
    if (f.tipoAtajo === 'esta_semana') return `Esta Semana (Semana ${f.semanaNum || ''} · ${formatDateDisplay(f.desde)} al ${formatDateDisplay(f.hasta)})`;
    if (f.tipoAtajo === 'semana_pasada') return `Semana Pasada (${formatDateDisplay(f.desde)} al ${formatDateDisplay(f.hasta)})`;
    if (f.tipoAtajo === 'este_mes') return `Este Mes (${formatDateDisplay(f.desde)} al ${formatDateDisplay(f.hasta)})`;
    if (f.tipoAtajo === 'mes_pasado') return `Mes Pasado (${formatDateDisplay(f.desde)} al ${formatDateDisplay(f.hasta)})`;
    if (f.tipoAtajo === 'todo') return 'Histórico Completo (Sin filtro de fecha)';
    if (f.dia) return `Día puntual: ${formatDateDisplay(f.dia)}`;
    return `Período: ${formatDateDisplay(f.desde)} al ${formatDateDisplay(f.hasta)}`;
  }

  function formatDateDisplay(iso) {
    if (!iso) return '';
    const parts = String(iso).split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return iso;
  }

  function renderFiltersBar() {
    filtersSection.innerHTML = `
      <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5">
        <!-- Fila 1: Atajos rápidos tipo píldora + Badge de período activo -->
        <div class="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800/80">
          <div class="flex flex-wrap items-center gap-1.5" id="dash-shortcuts">
            ${[
              { id: 'hoy', label: 'Hoy' },
              { id: 'ayer', label: 'Ayer' },
              { id: 'esta_semana', label: 'Esta semana' },
              { id: 'semana_pasada', label: 'Semana pasada' },
              { id: 'este_mes', label: 'Este mes' },
              { id: 'mes_pasado', label: 'Mes pasado' },
              { id: 'todo', label: 'Todo' },
            ]
              .map(
                (s) => `
              <button type="button" data-shortcut="${s.id}" class="dash-shortcut-btn px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  state.filters.tipoAtajo === s.id
                    ? 'bg-brand text-white shadow-xs font-bold'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }">
                ${s.label}
              </button>
            `
              )
              .join('')}
          </div>

          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-brand/10 text-brand text-xs font-bold border border-brand/20">
            <i class="fa-regular fa-calendar-check text-[11px]"></i>
            <span id="dash-period-label">${escapeHtml(getPeriodLabel())}</span>
          </div>
        </div>

        <!-- Fila 2: Selectores finos (Día puntual, Rango Desde/Hasta, Semana con ◀ ▶, Estado y Limpiar) -->
        <div class="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div class="flex flex-wrap items-center gap-2.5">
            <!-- Selector Día puntual -->
            <div class="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700" title="Seleccionar día puntual">
              <i class="fa-solid fa-calendar-day text-brand text-[11px]"></i>
              <span class="text-[11px] font-semibold text-slate-400">Día:</span>
              <input type="date" id="dash-inp-dia" value="${state.filters.dia || ''}"
                class="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer" />
              ${
                state.filters.dia
                  ? `<button type="button" id="dash-clear-dia" class="text-slate-400 hover:text-danger text-xs px-1 cursor-pointer"><i class="fa-solid fa-xmark"></i></button>`
                  : ''
              }
            </div>

            <!-- Selector Rango Desde / Hasta -->
            <div class="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
              <span class="text-[11px] font-semibold text-slate-400">Desde:</span>
              <input type="date" id="dash-inp-desde" value="${state.filters.tipoAtajo === 'todo' ? '' : (state.filters.desde || '')}"
                class="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer" />
              <span class="text-[11px] font-semibold text-slate-400">Hasta:</span>
              <input type="date" id="dash-inp-hasta" value="${state.filters.tipoAtajo === 'todo' ? '' : (state.filters.hasta || '')}"
                class="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer" />
            </div>

            <!-- Navegación por semana con ◀ ▶ -->
            <div class="flex items-center gap-1 bg-slate-50 dark:bg-slate-800/80 px-2 py-1 rounded-xl border border-slate-200 dark:border-slate-700" title="Navegar por semana">
              <button type="button" id="dash-week-prev" class="w-6 h-6 rounded-lg text-slate-500 hover:text-brand hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center cursor-pointer transition" title="Semana anterior">
                <i class="fa-solid fa-chevron-left text-[10px]"></i>
              </button>
              <span class="text-[11px] font-bold text-slate-700 dark:text-slate-200 font-mono px-1">
                S${state.filters.semanaNum || getISOWeekNumber(getAsuncionDate())} (${state.filters.semanaAnio || getAsuncionDate().getFullYear()})
              </span>
              <button type="button" id="dash-week-next" class="w-6 h-6 rounded-lg text-slate-500 hover:text-brand hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center cursor-pointer transition" title="Semana siguiente">
                <i class="fa-solid fa-chevron-right text-[10px]"></i>
              </button>
            </div>

            <!-- Filtro Estado (Todos, Pendientes, Pagados) -->
            <div class="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
              <span class="text-[11px] font-semibold text-slate-400">Estado:</span>
              <select id="dash-sel-estado" class="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer">
                <option value="todos" ${state.filters.estado === 'todos' ? 'selected' : ''}>Todos los Estados</option>
                <option value="pendientes" ${state.filters.estado === 'pendientes' ? 'selected' : ''}>Solo Pendientes</option>
                <option value="pagados" ${state.filters.estado === 'pagados' ? 'selected' : ''}>Solo Pagados</option>
              </select>
            </div>
          </div>

          <!-- Botón Limpiar Filtros -->
          <button type="button" id="dash-btn-clear" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-danger hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-slate-200 dark:border-slate-700 cursor-pointer transition">
            <i class="fa-solid fa-filter-circle-xmark text-xs"></i>
            <span>Limpiar filtros</span>
          </button>
        </div>
      </div>
    `;

    // Listeners de atajos
    filtersSection.querySelectorAll('.dash-shortcut-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        applyShortcut(btn.dataset.shortcut);
      });
    });

    // Selector de día puntual
    filtersSection.querySelector('#dash-inp-dia')?.addEventListener('change', (e) => {
      const val = e.target.value;
      if (val) {
        state.filters.tipoAtajo = 'custom';
        state.filters.dia = val;
        state.filters.desde = val;
        state.filters.hasta = val;
        state.filters.semanaNum = null;
        triggerFilterChange();
      }
    });

    filtersSection.querySelector('#dash-clear-dia')?.addEventListener('click', () => {
      state.filters.dia = '';
      applyShortcut('esta_semana');
    });

    // Selectores rango Desde / Hasta
    filtersSection.querySelector('#dash-inp-desde')?.addEventListener('change', (e) => {
      state.filters.tipoAtajo = 'custom';
      state.filters.dia = '';
      state.filters.desde = e.target.value;
      state.filters.semanaNum = null;
      triggerFilterChange();
    });

    filtersSection.querySelector('#dash-inp-hasta')?.addEventListener('change', (e) => {
      state.filters.tipoAtajo = 'custom';
      state.filters.dia = '';
      state.filters.hasta = e.target.value;
      state.filters.semanaNum = null;
      triggerFilterChange();
    });

    // Navegación por semana
    filtersSection.querySelector('#dash-week-prev')?.addEventListener('click', () => {
      changeWeekBy(-1);
    });

    filtersSection.querySelector('#dash-week-next')?.addEventListener('click', () => {
      changeWeekBy(1);
    });

    // Selector de estado
    filtersSection.querySelector('#dash-sel-estado')?.addEventListener('change', (e) => {
      state.filters.estado = e.target.value;
      triggerFilterChange();
    });

    // Botón Limpiar filtros
    filtersSection.querySelector('#dash-btn-clear')?.addEventListener('click', () => {
      applyShortcut('todo');
    });
  }

  function applyShortcut(sh) {
    const today = getAsuncionDate();
    state.filters.tipoAtajo = sh;
    state.filters.dia = '';
    state.filters.estado = 'todos';

    if (sh === 'hoy') {
      const s = toISODate(today);
      state.filters.desde = s;
      state.filters.hasta = s;
      state.filters.semanaNum = null;
    } else if (sh === 'ayer') {
      const y = new Date(today);
      y.setDate(today.getDate() - 1);
      const s = toISODate(y);
      state.filters.desde = s;
      state.filters.hasta = s;
      state.filters.semanaNum = null;
    } else if (sh === 'esta_semana') {
      const w = getWeekRangeFromDate(today);
      state.filters.desde = w.desde;
      state.filters.hasta = w.hasta;
      state.filters.semanaNum = w.semana;
      state.filters.semanaAnio = w.anio;
    } else if (sh === 'semana_pasada') {
      const prevW = new Date(today);
      prevW.setDate(today.getDate() - 7);
      const w = getWeekRangeFromDate(prevW);
      state.filters.desde = w.desde;
      state.filters.hasta = w.hasta;
      state.filters.semanaNum = w.semana;
      state.filters.semanaAnio = w.anio;
    } else if (sh === 'este_mes') {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      state.filters.desde = toISODate(first);
      state.filters.hasta = toISODate(last);
      state.filters.semanaNum = null;
    } else if (sh === 'mes_pasado') {
      const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const last = new Date(today.getFullYear(), today.getMonth(), 0);
      state.filters.desde = toISODate(first);
      state.filters.hasta = toISODate(last);
      state.filters.semanaNum = null;
    } else if (sh === 'todo') {
      state.filters.desde = '2020-01-01';
      state.filters.hasta = '2099-12-31';
      state.filters.semanaNum = null;
      state.filters.dia = '';
    }

    triggerFilterChange();
  }

  function changeWeekBy(delta) {
    let currW = state.filters.semanaNum || getISOWeekNumber(getAsuncionDate());
    let currY = state.filters.semanaAnio || getAsuncionDate().getFullYear();
    currW += delta;
    if (currW < 1) {
      currW = 52;
      currY -= 1;
    } else if (currW > 52) {
      currW = 1;
      currY += 1;
    }
    const rng = getWeekRangeByNumber(currY, currW);
    state.filters.tipoAtajo = 'custom';
    state.filters.dia = '';
    state.filters.desde = rng.desde;
    state.filters.hasta = rng.hasta;
    state.filters.semanaNum = rng.semana;
    state.filters.semanaAnio = rng.anio;
    triggerFilterChange();
  }

  function triggerFilterChange() {
    saveFilters();
    renderFiltersBar();
    loadDashboardStats();
  }

  // ========================================================================
  // 3. TARJETAS DE RESUMEN (KPIS) CON DRILL-DOWN
  // ========================================================================
  function renderKpiCards() {
    const s = state.stats;
    if (!s) {
      kpisSection.innerHTML = `
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
          ${Array.from({ length: 8 }).map(() => `<div class="h-28 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"></div>`).join('')}
        </div>
      `;
      return;
    }

    const gen = s.general || {};
    const ped = s.pedidos || {};
    const pag = s.pagos || {};
    const msg = s.mensajes || {};
    const vars = s.variaciones || {};
    const permsInfo = s.permisos || {};

    const allowGeneral = permsInfo.general !== undefined ? permsInfo.general : canGeneral;
    const allowPedidos = permsInfo.pedidos !== undefined ? permsInfo.pedidos : canPedidos;
    const allowPagos = permsInfo.pagos !== undefined ? permsInfo.pagos : canPagos;
    const allowMensajes = permsInfo.mensajes !== undefined ? permsInfo.mensajes : canMensajes;

    const formatDelta = (val) => {
      const n = Number(val) || 0;
      if (n > 0) return `<span class="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400"><i class="fa-solid fa-arrow-up text-[9px]"></i>+${n}%</span>`;
      if (n < 0) return `<span class="inline-flex items-center gap-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-400"><i class="fa-solid fa-arrow-down text-[9px]"></i>${n}%</span>`;
      return `<span class="text-[10px] text-slate-400 font-bold">0%</span>`;
    };

    let html = `<div class="space-y-4">`;

    if (state.filters.tipoAtajo !== 'todo') {
      html += `
        <div class="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/90 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 shadow-2xs">
          <div class="flex items-center gap-2.5">
            <span class="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 flex items-center justify-center text-xs">
              <i class="fa-solid fa-filter"></i>
            </span>
            <div>
              <span class="font-bold">Filtro de fecha activo: ${escapeHtml(getPeriodLabel())}</span>
              <p class="text-[11px] text-amber-700/80 dark:text-amber-300/80">Los números del tablero corresponden únicamente a este período.</p>
            </div>
          </div>
          <button type="button" id="dash-banner-all-btn" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold bg-brand text-white hover:bg-brand-hover shadow-2xs cursor-pointer transition">
            <i class="fa-solid fa-rotate-left text-xs"></i>
            <span>Ver Todo el Historial</span>
          </button>
        </div>
      `;
    }

    // BLOQUE 1: GENERAL & BALANCE FINANCIERO
    if (allowGeneral && s.general) {
      html += `
        <div>
          <div class="flex items-center gap-2 mb-2">
            <span class="w-2 h-2 rounded-full bg-brand"></span>
            <h2 class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Balance y Finanzas Generales</h2>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <!-- Ingresos Totales -->
            <div data-drill="general_ingresos" class="dash-kpi-card p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-brand/40 shadow-xs cursor-pointer transition group">
              <div class="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                <span class="font-bold uppercase tracking-wider group-hover:text-brand transition">Ingresos Totales</span>
                <span class="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs">
                  <i class="fa-solid fa-arrow-trend-up"></i>
                </span>
              </div>
              <p class="text-xl sm:text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">${formatGuaranies(gen.ingresos)}</p>
              <div class="flex items-center justify-between mt-1.5 text-[11px] text-slate-400">
                <span>Cobrado en pedidos</span>
                ${formatDelta(vars.ingresosDelta)}
              </div>
            </div>

            <!-- Egresos Totales (Solo Proveedores) -->
            <div data-drill="general_egresos" class="dash-kpi-card p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-brand/40 shadow-xs cursor-pointer transition group">
              <div class="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                <span class="font-bold uppercase tracking-wider group-hover:text-brand transition">Egresos Totales</span>
                <span class="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center text-xs">
                  <i class="fa-solid fa-arrow-trend-down"></i>
                </span>
              </div>
              <p class="text-xl sm:text-2xl font-black font-mono text-rose-600 dark:text-rose-400">${formatGuaranies(gen.egresos)}</p>
              <div class="flex items-center justify-between mt-1.5 text-[11px] text-slate-400">
                <span>Pagos a proveedores</span>
                ${formatDelta(vars.egresosDelta)}
              </div>
            </div>

            <!-- Pendientes Totales de Cobro -->
            <div data-drill="general_pendientes" class="dash-kpi-card p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-brand/40 shadow-xs cursor-pointer transition group">
              <div class="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                <span class="font-bold uppercase tracking-wider group-hover:text-brand transition">Por Cobrar / Pendiente</span>
                <span class="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center text-xs">
                  <i class="fa-solid fa-clock"></i>
                </span>
              </div>
              <p class="text-xl sm:text-2xl font-black font-mono text-amber-600 dark:text-amber-400">${formatGuaranies(gen.pendientesCobro)}</p>
              <div class="flex items-center justify-between mt-1.5 text-[11px] text-slate-400">
                <span>Faltante de clientes</span>
                <span class="font-mono text-xs text-slate-500">Saldo activo</span>
              </div>
            </div>

            <!-- Balance Neto -->
            <div data-drill="general_balance" class="dash-kpi-card p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-brand/40 shadow-xs cursor-pointer transition group">
              <div class="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                <span class="font-bold uppercase tracking-wider group-hover:text-brand transition">Balance Neto</span>
                <span class="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-brand flex items-center justify-center text-xs">
                  <i class="fa-solid fa-scale-balanced"></i>
                </span>
              </div>
              <p class="text-xl sm:text-2xl font-black font-mono ${gen.balance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}">
                ${formatGuaranies(gen.balance)}
              </p>
              <div class="flex items-center justify-between mt-1.5 text-[11px] text-slate-400">
                <span>Ingresos − Egresos</span>
                ${formatDelta(vars.balanceDelta)}
              </div>
            </div>
          </div>
        </div>
      `;
    }

    // BLOQUE 2: RESUMEN DE PEDIDOS
    if (allowPedidos && s.pedidos) {
      html += `
        <div>
          <div class="flex items-center gap-2 mb-2">
            <span class="w-2 h-2 rounded-full bg-blue-500"></span>
            <h2 class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Módulo de Pedidos</h2>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <!-- Pedidos Recibidos -->
            <div data-drill="pedidos_recibidos" class="dash-kpi-card p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-brand/40 shadow-xs cursor-pointer transition group">
              <div class="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                <span class="font-bold uppercase tracking-wider group-hover:text-brand transition">Pedidos Recibidos</span>
                <span class="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs">
                  <i class="fa-regular fa-clipboard"></i>
                </span>
              </div>
              <p class="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">${ped.totalCount || 0}</p>
              <div class="flex items-center justify-between mt-1.5 text-[11px] text-slate-400">
                <span>Órdenes creadas</span>
                <span class="font-bold text-slate-600 dark:text-slate-300">${ped.pagadosCount || 0} pagados / ${ped.pendientesCount || 0} pend.</span>
              </div>
            </div>

            <!-- Costo Total Pedidos -->
            <div data-drill="pedidos_costo" class="dash-kpi-card p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-brand/40 shadow-xs cursor-pointer transition group">
              <div class="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                <span class="font-bold uppercase tracking-wider group-hover:text-brand transition">Costo Total Pedidos</span>
                <span class="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs">
                  <i class="fa-solid fa-receipt"></i>
                </span>
              </div>
              <p class="text-xl sm:text-2xl font-black font-mono text-slate-900 dark:text-white">${formatGuaranies(ped.montoTotal)}</p>
              <div class="flex items-center justify-between mt-1.5 text-[11px] text-slate-400">
                <span>Total pactado (sin cancelados)</span>
                ${formatDelta(vars.pedidosMontoDelta)}
              </div>
            </div>

            <!-- Total Ya Pagado -->
            <div data-drill="pedidos_pagados" class="dash-kpi-card p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-brand/40 shadow-xs cursor-pointer transition group">
              <div class="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                <span class="font-bold uppercase tracking-wider group-hover:text-brand transition">Total Ya Pagado</span>
                <span class="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs">
                  <i class="fa-solid fa-circle-check"></i>
                </span>
              </div>
              <p class="text-xl sm:text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">${formatGuaranies(ped.montoPagado)}</p>
              <div class="flex items-center justify-between mt-1.5 text-[11px] text-slate-400">
                <span>Cobrado de clientes</span>
                <span class="font-bold text-emerald-600 dark:text-emerald-400">${ped.totalCount ? Math.round((ped.montoPagado / (ped.montoTotal || 1)) * 100) : 0}% cobrado</span>
              </div>
            </div>

            <!-- Faltante por Pagar -->
            <div data-drill="pedidos_pendientes" class="dash-kpi-card p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-brand/40 shadow-xs cursor-pointer transition group">
              <div class="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                <span class="font-bold uppercase tracking-wider group-hover:text-brand transition">Faltante por Cobrar</span>
                <span class="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center text-xs">
                  <i class="fa-solid fa-triangle-exclamation"></i>
                </span>
              </div>
              <p class="text-xl sm:text-2xl font-black font-mono text-amber-600 dark:text-amber-400">${formatGuaranies(ped.saldoPendiente)}</p>
              <div class="flex items-center justify-between mt-1.5 text-[11px] text-slate-400">
                <span>Saldo pendiente total</span>
                <span class="font-bold text-amber-600 dark:text-amber-400">${ped.pendientesCount || 0} pedidos pend.</span>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    // BLOQUE 3: PAGOS Y MENSAJES
    if (allowPagos || allowMensajes) {
      html += `<div class="grid grid-cols-1 ${allowPagos && allowMensajes ? 'lg:grid-cols-2' : 'grid-cols-1'} gap-4">`;

      if (allowPagos && s.pagos) {
        html += `
          <!-- Pagos a Proveedores y Clientes -->
          <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
            <div class="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800/80">
              <div class="flex items-center gap-2">
                <span class="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-brand flex items-center justify-center text-xs">
                  <i class="fa-solid fa-file-invoice-dollar"></i>
                </span>
                <h3 class="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">Pagos a Proveedores (Egresos)</h3>
              </div>
              <button type="button" data-drill="pagos_total" class="dash-kpi-card text-[11px] font-bold text-brand hover:underline cursor-pointer">
                Ver todos (${pag.totalCount || 0}) →
              </button>
            </div>
            <div class="grid grid-cols-3 gap-3">
              <div data-drill="pagos_realizados" class="dash-kpi-card p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition">
                <span class="text-[10px] font-bold uppercase text-slate-400 block mb-1">Egresos Pagados</span>
                <span class="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400 block">${formatGuaranies(pag.totalPagadosMonto)}</span>
                <span class="text-[10px] text-slate-400">${pag.pagadosCount || 0} pagados</span>
              </div>
              <div data-drill="pagos_pendientes" class="dash-kpi-card p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition">
                <span class="text-[10px] font-bold uppercase text-slate-400 block mb-1">Pendientes Pago</span>
                <span class="text-sm font-black font-mono text-amber-600 dark:text-amber-400 block">${formatGuaranies(pag.totalPendientesMonto)}</span>
                <span class="text-[10px] text-slate-400">${pag.pendientesCount + (pag.parcialesCount || 0)} pend./parc.</span>
              </div>
              <div data-drill="pagos_total" class="dash-kpi-card p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition">
                <span class="text-[10px] font-bold uppercase text-slate-400 block mb-1">Total Proveedores</span>
                <span class="text-sm font-black font-mono text-slate-900 dark:text-white block">${formatGuaranies(pag.totalGeneralMonto)}</span>
                <span class="text-[10px] text-slate-400">${pag.totalCount || 0} registros</span>
              </div>
            </div>

            <!-- Línea aparte: Pagos a Clientes (reembolsos / anticipos) -->
            <div data-drill="pagos_clientes" class="dash-kpi-card p-2.5 rounded-xl bg-purple-50/50 dark:bg-slate-800/40 border border-purple-100 dark:border-slate-700/60 hover:border-brand/40 cursor-pointer transition flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="w-6 h-6 rounded-lg bg-purple-100 dark:bg-purple-950 text-brand flex items-center justify-center text-[11px]">
                  <i class="fa-solid fa-user-tag"></i>
                </span>
                <div>
                  <span class="text-[11px] font-bold text-slate-700 dark:text-slate-200 block">Pagos a Clientes (Reembolsos / Anticipos)</span>
                  <span class="text-[10px] text-slate-400">No computan como egresos a proveedores</span>
                </div>
              </div>
              <div class="text-right">
                <span class="text-xs font-black font-mono text-slate-900 dark:text-white block">${formatGuaranies(pag.pagosClientesMontoPagado || 0)}</span>
                <span class="text-[10px] text-slate-400">${pag.pagosClientesCount || 0} reg. · Pend: ${formatGuaranies(pag.pagosClientesSaldoPendiente || 0)}</span>
              </div>
            </div>
          </div>
        `;
      }

      if (allowMensajes && s.mensajes) {
        html += `
          <!-- Mensajes WhatsApp Card -->
          <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
            <div class="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800/80">
              <div class="flex items-center gap-2">
                <span class="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs">
                  <i class="fa-brands fa-whatsapp"></i>
                </span>
                <h3 class="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">Mensajes & Difusión WhatsApp</h3>
              </div>
              <button type="button" data-drill="mensajes_total" class="dash-kpi-card text-[11px] font-bold text-brand hover:underline cursor-pointer">
                Ver historial (${msg.totalCount || 0}) →
              </button>
            </div>
            <!-- Grid de 4 estados: Enviados, Programados, En Cola, Fallidos -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div data-drill="mensajes_enviados" class="dash-kpi-card p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition text-center">
                <span class="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Enviados</span>
                <span class="text-base font-black font-mono text-emerald-600 dark:text-emerald-400 block">${msg.enviadosCount || 0}</span>
                <span class="text-[9px] text-emerald-600">Exitosos</span>
              </div>
              <div data-drill="mensajes_programados" class="dash-kpi-card p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition text-center">
                <span class="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Programados</span>
                <span class="text-base font-black font-mono text-amber-600 dark:text-amber-400 block">${msg.programadosCount || 0}</span>
                <span class="text-[9px] text-amber-600">En agenda</span>
              </div>
              <div data-drill="mensajes_en_cola" class="dash-kpi-card p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition text-center">
                <span class="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">En Cola</span>
                <span class="text-base font-black font-mono text-blue-600 dark:text-blue-400 block">${msg.enColaCount || 0}</span>
                <span class="text-[9px] text-blue-600">Pendientes</span>
              </div>
              <div data-drill="mensajes_fallidos" class="dash-kpi-card p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition text-center">
                <span class="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Fallidos</span>
                <span class="text-base font-black font-mono text-rose-600 dark:text-rose-400 block">${msg.fallidosCount || 0}</span>
                <span class="text-[9px] text-rose-600">Con error</span>
              </div>
            </div>

            <!-- Desglose por tipo (Difusión, Individual, Programado) -->
            <div class="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
              <span class="text-[10px] font-bold uppercase text-slate-400 mr-1">Por tipo:</span>
              <button type="button" data-drill="mensajes_tipo" data-tipo="Difusión" class="dash-kpi-card px-2.5 py-1 rounded-lg bg-brand-soft dark:bg-brand/20 text-brand font-bold hover:bg-brand hover:text-white transition cursor-pointer">
                Difusión: ${msg.porTipo?.['Difusión'] || 0}
              </button>
              <button type="button" data-drill="mensajes_tipo" data-tipo="Mensaje" class="dash-kpi-card px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 font-bold hover:bg-blue-600 hover:text-white transition cursor-pointer">
                Individual: ${msg.porTipo?.['Mensaje'] || 0}
              </button>
              <button type="button" data-drill="mensajes_tipo" data-tipo="Programado" class="dash-kpi-card px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-300 font-bold hover:bg-amber-600 hover:text-white transition cursor-pointer">
                Programado: ${msg.porTipo?.['Programado'] || 0}
              </button>
            </div>
          </div>
        `;
      }

      html += `</div>`;
    }

    html += `</div>`;
    kpisSection.innerHTML = html;

    kpisSection.querySelector('#dash-banner-all-btn')?.addEventListener('click', () => {
      applyShortcut('todo');
    });

    // Asignar listeners de drill-down en cada tarjeta
    kpisSection.querySelectorAll('.dash-kpi-card[data-drill]').forEach((el) => {
      el.addEventListener('click', () => {
        const tarjeta = el.dataset.drill;
        const tipoFiltro = el.dataset.tipo || '';
        openDrilldownModal(tarjeta, tipoFiltro);
      });
    });
  }

  // ========================================================================
  // 4. GRÁFICOS DINÁMICOS CON CHART.JS
  // ========================================================================
  function renderCharts() {
    const s = state.stats;
    if (!s || !s.graficos) {
      chartsSection.innerHTML = '';
      return;
    }

    const permsInfo = s.permisos || {};
    const allowGeneral = permsInfo.general !== undefined ? permsInfo.general : canGeneral;
    const allowPedidos = permsInfo.pedidos !== undefined ? permsInfo.pedidos : canPedidos;
    const allowPagos = permsInfo.pagos !== undefined ? permsInfo.pagos : canPagos;
    const allowMensajes = permsInfo.mensajes !== undefined ? permsInfo.mensajes : canMensajes;

    chartsSection.innerHTML = `
      <div class="space-y-4">
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-brand"></span>
          <h2 class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Evolución y Gráficos del Período</h2>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <!-- Gráfico 1: Ingresos vs Egresos (solo si tiene acceso a General) -->
          ${
            allowGeneral
              ? `
            <div class="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
              <div class="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800/80">
                <div class="flex items-center gap-2">
                  <span class="w-6 h-6 rounded-lg bg-brand-soft dark:bg-brand/20 text-brand flex items-center justify-center text-xs">
                    <i class="fa-solid fa-chart-column"></i>
                  </span>
                  <h3 class="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">Ingresos vs. Egresos</h3>
                </div>
                <span class="text-[10px] text-slate-400 font-mono">Clic en barras para ver detalle</span>
              </div>
              <div class="h-64 relative w-full flex items-center justify-center">
                <canvas id="chart-ingresos-egresos"></canvas>
              </div>
            </div>
            `
              : ''
          }

          <!-- Tarjeta 2: Saldos Pendientes en el Tiempo (Clientes con Saldo / Gráfico Evolución) -->
          ${
            allowPedidos || allowPagos
              ? `
            <div class="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
              <div class="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800/80">
                <div class="flex items-center gap-2">
                  <span class="w-6 h-6 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center text-xs">
                    <i class="fa-solid fa-user-clock"></i>
                  </span>
                  <div>
                    <h3 class="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">Saldos Pendientes en el Tiempo</h3>
                    <p class="text-[10px] text-slate-400 font-mono">Clientes con saldos pendientes de pago</p>
                  </div>
                </div>

                <div class="flex items-center gap-2">
                  <div class="inline-flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] sm:text-[11px] font-bold">
                    <button type="button" id="tab-pend-clientes" class="px-2 py-1 rounded-md transition ${state.pendView === 'chart' ? 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200' : 'bg-white dark:bg-slate-700 text-brand shadow-2xs'} cursor-pointer">
                      Clientes (${(s.clientesPendientes || []).length})
                    </button>
                    <button type="button" id="tab-pend-chart" class="px-2 py-1 rounded-md transition ${state.pendView === 'chart' ? 'bg-white dark:bg-slate-700 text-brand shadow-2xs' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'} cursor-pointer">
                      Gráfico
                    </button>
                  </div>

                  <button type="button" id="dash-btn-ver-detalle-pendientes" class="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-brand text-white hover:bg-brand-hover shadow-2xs cursor-pointer transition">
                    <i class="fa-solid fa-eye text-xs"></i>
                    <span>Ver Detalle</span>
                  </button>
                </div>
              </div>

              <!-- Vista 1: Lista de Clientes con Saldo Pendiente -->
              <div id="container-pend-list" class="${state.pendView === 'chart' ? 'hidden' : ''}">
                ${
                  (s.clientesPendientes || []).length === 0
                    ? `
                  <div class="h-64 flex flex-col items-center justify-center text-slate-400">
                    <i class="fa-solid fa-circle-check text-3xl text-emerald-500 mb-2"></i>
                    <span class="font-bold text-slate-700 dark:text-slate-200">No hay clientes con saldos pendientes</span>
                    <span class="text-[11px] text-slate-400 mt-1">Todos los pedidos se encuentran 100% pagados o cancelados</span>
                  </div>
                `
                    : `
                  <div class="flex items-center justify-between px-3 py-1.5 bg-amber-50/80 dark:bg-amber-950/40 rounded-xl text-xs text-amber-900 dark:text-amber-200 font-semibold mb-2 border border-amber-200/60 dark:border-amber-900/60">
                    <span class="flex items-center gap-1.5">
                      <i class="fa-solid fa-users text-amber-600 dark:text-amber-400 text-xs"></i>
                      <span>${(s.clientesPendientes || []).length} cliente${(s.clientesPendientes || []).length === 1 ? '' : 's'} con saldo pendiente</span>
                    </span>
                    <span class="font-mono font-black text-amber-600 dark:text-amber-400">Total a Pagar: ${formatGuaranies((s.clientesPendientes || []).reduce((acc, c) => acc + (Number(c.saldoPendiente) || 0), 0))}</span>
                  </div>

                  <div class="h-56 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                    ${(s.clientesPendientes || [])
                      .map(
                        (c) => `
                      <div class="dash-client-deuda-row flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-amber-50/70 dark:hover:bg-amber-950/30 border border-slate-100 dark:border-slate-800 transition cursor-pointer group" data-client="${escapeHtml(c.clienteNombre)}">
                        <div class="flex items-center gap-2.5 min-w-0">
                          <div class="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 font-black flex items-center justify-center text-xs flex-shrink-0 group-hover:scale-105 transition">
                            ${escapeHtml((c.clienteNombre || '?').charAt(0).toUpperCase())}
                          </div>
                          <div class="min-w-0">
                            <div class="font-bold text-slate-800 dark:text-slate-100 text-xs group-hover:text-brand transition truncate">${escapeHtml(c.clienteNombre)}</div>
                            <div class="text-[10px] text-slate-400 flex flex-wrap items-center gap-2 mt-0.5">
                              ${c.clienteDoc ? `<span><i class="fa-regular fa-id-card text-[9px] mr-1"></i>${escapeHtml(c.clienteDoc)}</span>` : ''}
                              ${c.clienteTel ? `<span><i class="fa-brands fa-whatsapp text-[9px] mr-1 text-emerald-500"></i>${escapeHtml(c.clienteTel)}</span>` : ''}
                              <span class="text-slate-500 dark:text-slate-400 font-medium"><i class="fa-solid fa-box text-[9px] mr-1"></i>${c.pedidosCount} ped.</span>
                              <span class="text-amber-600 dark:text-amber-400 font-medium"><i class="fa-regular fa-clock text-[9px] mr-1"></i>${c.antiguedadMax} d. antigüedad</span>
                            </div>
                          </div>
                        </div>
                        <div class="text-right flex-shrink-0 pl-2">
                          <span class="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">Total a Pagar</span>
                          <span class="font-mono font-black text-xs sm:text-sm text-amber-600 dark:text-amber-400 block">${formatGuaranies(c.saldoPendiente)}</span>
                        </div>
                      </div>
                    `
                      )
                      .join('')}
                  </div>
                `
                }
              </div>

              <!-- Vista 2: Gráfico de Evolución -->
              <div id="container-pend-chart" class="h-64 relative w-full flex items-center justify-center ${state.pendView === 'chart' ? '' : 'hidden'}">
                <canvas id="chart-pendientes"></canvas>
              </div>
            </div>
            `
              : ''
          }

          <!-- Gráfico 3: Distribución de Estados -->
          ${
            allowPedidos || allowPagos
              ? `
            <div class="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
              <div class="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800/80">
                <div class="flex items-center gap-2">
                  <span class="w-6 h-6 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-brand flex items-center justify-center text-xs">
                    <i class="fa-solid fa-chart-pie"></i>
                  </span>
                  <h3 class="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">Distribución de Estados</h3>
                </div>
                <span class="text-[10px] text-slate-400 font-mono">Pedidos & Pagos</span>
              </div>
              <div class="h-64 relative w-full flex items-center justify-center">
                <canvas id="chart-distribucion"></canvas>
              </div>
            </div>
            `
              : ''
          }

          <!-- Gráfico 4: Mensajes por Tipo -->
          ${
            allowMensajes
              ? `
            <div class="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
              <div class="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800/80">
                <div class="flex items-center gap-2">
                  <span class="w-6 h-6 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs">
                    <i class="fa-solid fa-comments"></i>
                  </span>
                  <h3 class="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">Mensajes por Tipo</h3>
                </div>
                <span class="text-[10px] text-slate-400 font-mono">Actividad WhatsApp</span>
              </div>
              <div class="h-64 relative w-full flex items-center justify-center">
                <canvas id="chart-mensajes"></canvas>
              </div>
            </div>
            `
              : ''
          }
        </div>
      </div>
    `;

    if (!window.Chart) {
      console.warn('[Dashboard] Chart.js no disponible.');
      return;
    }

    Object.values(state.chartInstances).forEach((inst) => {
      try {
        inst?.destroy();
      } catch (_) {}
    });
    state.chartInstances = {};

    const isDark = document.documentElement.classList.contains('dark');
    const textColor = isDark ? '#94a3b8' : '#64748b';
    const gridColor = isDark ? 'rgba(51, 65, 85, 0.4)' : 'rgba(226, 232, 240, 0.8)';
    const g = s.graficos;

    // 1. Gráfico Ingresos vs Egresos (Barras agrupadas)
    const ctx1 = chartsSection.querySelector('#chart-ingresos-egresos')?.getContext('2d');
    if (ctx1 && Array.isArray(g.ingresosVsEgresos)) {
      const labels = g.ingresosVsEgresos.map((p) => p.label);
      const dataIng = g.ingresosVsEgresos.map((p) => p.ingresos);
      const dataEgr = g.ingresosVsEgresos.map((p) => p.egresos);

      state.chartInstances.ingEgr = new window.Chart(ctx1, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Ingresos (Cobros)',
              data: dataIng,
              backgroundColor: '#10b981',
              borderRadius: 6,
            },
            {
              label: 'Egresos (Proveedores)',
              data: dataEgr,
              backgroundColor: '#f43f5e',
              borderRadius: 6,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'top', labels: { color: textColor, font: { size: 11 } } },
            tooltip: {
              callbacks: {
                label: (ctx) => `${ctx.dataset.label}: ${formatGuaranies(ctx.raw)}`,
              },
            },
          },
          scales: {
            x: { ticks: { color: textColor }, grid: { display: false } },
            y: {
              ticks: {
                color: textColor,
                callback: (v) => {
                  if (v >= 1000000) return (v / 1000000).toFixed(1) + 'M';
                  if (v >= 1000) return (v / 1000).toFixed(0) + 'k';
                  return v;
                },
              },
              grid: { color: gridColor },
            },
          },
          onClick: (e, elements) => {
            if (elements.length > 0) {
              const idx = elements[0].index;
              const dayPoint = g.ingresosVsEgresos[idx];
              if (dayPoint && dayPoint.fecha) {
                state.filters.tipoAtajo = 'custom';
                state.filters.dia = dayPoint.fecha;
                state.filters.desde = dayPoint.fecha;
                state.filters.hasta = dayPoint.fecha;
                triggerFilterChange();
              }
            }
          },
        },
      });
    }

    // 2. Gráfico Pendientes (Línea)
    const ctx2 = chartsSection.querySelector('#chart-pendientes')?.getContext('2d');
    if (ctx2 && Array.isArray(g.pendientesTiempo)) {
      const labels = g.pendientesTiempo.map((p) => p.label);
      const dataCobro = g.pendientesTiempo.map((p) => p.pendCobro || 0);
      const dataPago = g.pendientesTiempo.map((p) => p.pendPago || 0);

      state.chartInstances.pend = new window.Chart(ctx2, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Por Cobrar (Pedidos)',
              data: dataCobro,
              borderColor: '#f59e0b',
              backgroundColor: 'rgba(245, 158, 11, 0.1)',
              fill: true,
              tension: 0.3,
            },
            {
              label: 'Por Pagar (Proveedores)',
              data: dataPago,
              borderColor: '#ef4444',
              backgroundColor: 'rgba(239, 68, 68, 0.05)',
              fill: true,
              tension: 0.3,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'top', labels: { color: textColor, font: { size: 11 } } },
            tooltip: {
              callbacks: {
                label: (ctx) => `${ctx.dataset.label}: ${formatGuaranies(ctx.raw)}`,
              },
            },
          },
          scales: {
            x: { ticks: { color: textColor }, grid: { display: false } },
            y: { ticks: { color: textColor }, grid: { color: gridColor } },
          },
        },
      });
    }

    // 3. Gráfico Distribución de Estados (Dona)
    const ctx3 = chartsSection.querySelector('#chart-distribucion')?.getContext('2d');
    if (ctx3 && g.distribucion) {
      const distLabels = ['Pedidos Pagados', 'Pedidos Pendientes', 'Pagos Realizados', 'Pagos Pendientes'];
      const distData = [
        g.distribucion.pedidosPagados || 0,
        g.distribucion.pedidosPendientes || 0,
        g.distribucion.pagosPagados || 0,
        g.distribucion.pagosPendientes || 0,
      ];

      state.chartInstances.dist = new window.Chart(ctx3, {
        type: 'doughnut',
        data: {
          labels: distLabels,
          datasets: [
            {
              data: distData,
              backgroundColor: ['#10b981', '#f59e0b', '#a37cfc', '#f43f5e'],
              borderWidth: 2,
              borderColor: isDark ? '#0f172a' : '#ffffff',
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'right', labels: { color: textColor, font: { size: 11 } } },
          },
          onClick: (e, elements) => {
            if (elements.length > 0) {
              const idx = elements[0].index;
              const lbl = distLabels[idx];
              if (lbl.includes('Pedidos')) {
                openDrilldownModal(lbl.includes('Pagados') ? 'pedidos_pagados' : 'pedidos_pendientes');
              } else {
                openDrilldownModal(lbl.includes('Realizados') ? 'pagos_realizados' : 'pagos_pendientes');
              }
            }
          },
        },
      });
    }

    // 4. Gráfico Mensajes por tipo (Dona)
    const ctx4 = chartsSection.querySelector('#chart-mensajes')?.getContext('2d');
    if (ctx4 && Array.isArray(g.mensajesTipos)) {
      const msgLabels = g.mensajesTipos.map((m) => m.tipo);
      const msgData = g.mensajesTipos.map((m) => m.count);

      state.chartInstances.msg = new window.Chart(ctx4, {
        type: 'doughnut',
        data: {
          labels: msgLabels.length > 0 ? msgLabels : ['Sin envíos'],
          datasets: [
            {
              data: msgData.length > 0 ? msgData : [1],
              backgroundColor: ['#a37cfc', '#3b82f6', '#10b981', '#64748b'],
              borderWidth: 2,
              borderColor: isDark ? '#0f172a' : '#ffffff',
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'right', labels: { color: textColor, font: { size: 11 } } },
          },
          onClick: (e, elements) => {
            if (elements.length > 0) {
              const idx = elements[0].index;
              const tip = msgLabels[idx];
              openDrilldownModal('mensajes_tipo', tip);
            }
          },
        },
      });
    }

    // Listeners interactivos para la tarjeta de Saldos Pendientes (Clientes / Gráfico)
    const tabClientes = chartsSection.querySelector('#tab-pend-clientes');
    const tabChart = chartsSection.querySelector('#tab-pend-chart');
    const boxList = chartsSection.querySelector('#container-pend-list');
    const boxChart = chartsSection.querySelector('#container-pend-chart');

    tabClientes?.addEventListener('click', () => {
      state.pendView = 'list';
      tabClientes.classList.add('bg-white', 'dark:bg-slate-700', 'text-brand', 'shadow-2xs');
      tabClientes.classList.remove('text-slate-500');
      tabChart?.classList.remove('bg-white', 'dark:bg-slate-700', 'text-brand', 'shadow-2xs');
      tabChart?.classList.add('text-slate-500');
      boxList?.classList.remove('hidden');
      boxChart?.classList.add('hidden');
    });

    tabChart?.addEventListener('click', () => {
      state.pendView = 'chart';
      tabChart?.classList.add('bg-white', 'dark:bg-slate-700', 'text-brand', 'shadow-2xs');
      tabChart?.classList.remove('text-slate-500');
      tabClientes?.classList.remove('bg-white', 'dark:bg-slate-700', 'text-brand', 'shadow-2xs');
      tabClientes?.classList.add('text-slate-500');
      boxChart?.classList.remove('hidden');
      boxList?.classList.add('hidden');
      try {
        state.chartInstances.pend?.resize();
      } catch (_) {}
    });

    chartsSection.querySelector('#dash-btn-ver-detalle-pendientes')?.addEventListener('click', () => {
      openDrilldownModal('clientes_deuda');
    });

    chartsSection.querySelectorAll('.dash-client-deuda-row').forEach((row) => {
      row.addEventListener('click', () => {
        const cli = row.dataset.client || '';
        openDrilldownModal('clientes_deuda', '', cli);
      });
    });
  }

  // ========================================================================
  // 5. ACCESOS RÁPIDOS INFERIORES
  // ========================================================================
  function renderQuickAccess() {
    quickAccessSection.innerHTML = `
      <div class="space-y-2">
        <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400">Accesos Rápidos del Sistema</h3>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div id="dash-qa-pedidos" class="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-brand/40 transition shadow-xs cursor-pointer flex items-center gap-3 group">
            <span class="w-10 h-10 rounded-xl bg-brand-soft dark:bg-brand/20 text-brand flex items-center justify-center text-lg group-hover:scale-105 transition">
              <i class="fa-regular fa-clipboard"></i>
            </span>
            <div>
              <h4 class="text-sm font-bold text-slate-800 dark:text-slate-100 group-hover:text-brand transition">Pedidos</h4>
              <p class="text-xs text-slate-500 dark:text-slate-400">Gestión de órdenes y entregas</p>
            </div>
          </div>

          <div id="dash-qa-clientes" class="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-brand/40 transition shadow-xs cursor-pointer flex items-center gap-3 group">
            <span class="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-lg group-hover:scale-105 transition">
              <i class="fa-solid fa-users"></i>
            </span>
            <div>
              <h4 class="text-sm font-bold text-slate-800 dark:text-slate-100 group-hover:text-emerald-600 transition">Clientes</h4>
              <p class="text-xs text-slate-500 dark:text-slate-400">Directorio y fichas de clientes</p>
            </div>
          </div>

          <div id="dash-qa-sesiones" class="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-brand/40 transition shadow-xs cursor-pointer flex items-center gap-3 group">
            <span class="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-brand flex items-center justify-center text-lg group-hover:scale-105 transition">
              <i class="fa-solid fa-mobile-screen"></i>
            </span>
            <div>
              <h4 class="text-sm font-bold text-slate-800 dark:text-slate-100 group-hover:text-brand transition">Sesiones WhatsApp</h4>
              <p class="text-xs text-slate-500 dark:text-slate-400">Conexión de WhatsApp Web</p>
            </div>
          </div>
        </div>
      </div>
    `;

    quickAccessSection.querySelector('#dash-qa-pedidos')?.addEventListener('click', () => onNavigate?.('pedidos'));
    quickAccessSection.querySelector('#dash-qa-clientes')?.addEventListener('click', () => onNavigate?.('clientes'));
    quickAccessSection.querySelector('#dash-qa-sesiones')?.addEventListener('click', () => onNavigate?.('sessions'));
  }

  // ========================================================================
  // 6. CARGA DE DATOS DESDE LA API
  // ========================================================================
  async function loadDashboardStats() {
    state.loading = true;
    renderKpiCards();

    try {
      const q = new URLSearchParams({
        desde: state.filters.desde,
        hasta: state.filters.hasta,
        estado: state.filters.estado,
      });
      if (state.filters.dia) q.set('dia', state.filters.dia);

      const res = await apiFetch(`/api/dashboard/stats?${q.toString()}`);
      if (res) {
        state.stats = res;
      }
    } catch (err) {
      console.error('[Dashboard] Error cargando stats:', err);
      toast.error('Error al cargar datos del Dashboard.');
    } finally {
      state.loading = false;
      renderKpiCards();
      renderCharts();
    }
  }

  // ========================================================================
  // 7. DRILL-DOWN: MODAL / TABLA DE DETALLE INTERACTIVO
  // ========================================================================
  async function openDrilldownModal(tarjeta, tipoFiltro = '', initialSearch = '') {
    const content = document.createElement('div');
    content.className = 'space-y-4 text-xs select-none';

    let page = 1;
    let pageSize = 20;
    let busqueda = initialSearch || '';
    let currentData = null;

    content.innerHTML = `
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div class="flex items-center gap-2">
          <div class="relative w-full sm:w-72">
            <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
            <input type="text" id="drill-inp-search" placeholder="Buscar por cliente, N°, concepto..."
              value="${escapeHtml(busqueda)}"
              class="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button type="button" id="drill-btn-export" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 cursor-pointer transition">
            <i class="fa-solid fa-download text-xs text-brand"></i>
            <span>Exportar CSV Completo</span>
          </button>
          <button type="button" id="drill-btn-goto" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-brand text-white hover:bg-brand-hover cursor-pointer transition shadow-xs">
            <i class="fa-solid fa-arrow-up-right-from-square text-xs"></i>
            <span>Ver en módulo completo</span>
          </button>
        </div>
      </div>

      <!-- Contenedor de la tabla -->
      <div id="drill-table-box" class="w-full overflow-x-auto min-h-[220px] max-h-[50vh] overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <div class="p-8 text-center text-slate-400">Cargando registros...</div>
      </div>

      <!-- Barra de pie con totales fijos y paginación estándar -->
      <div id="drill-footer-bar" class="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 font-semibold">
        <div class="flex items-center gap-3">
          <span id="drill-count-badge" class="text-slate-500 dark:text-slate-400 font-mono text-xs">—</span>
          <span id="drill-total-badge" class="font-mono font-black text-brand text-sm">—</span>
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <div class="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-xs">
            <span class="text-[11px] font-normal hidden sm:inline">Mostrar:</span>
            <select id="drill-sel-pagesize" class="px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand cursor-pointer">
              <option value="20" selected>20 por pág.</option>
              <option value="50">50 por pág.</option>
              <option value="100">100 por pág.</option>
              <option value="500">500 por pág.</option>
              <option value="1000">1000 (Ver Todo)</option>
            </select>
          </div>
          <div id="drill-pagination" class="flex items-center gap-1 text-xs"></div>
        </div>
      </div>
    `;

    function buildPageNumbers(curr, total) {
      if (total <= 7) {
        return Array.from({ length: total }, (_, i) => i + 1);
      }
      const pages = [1];
      if (curr > 3) pages.push('...');
      const start = Math.max(2, curr - 1);
      const end = Math.min(total - 1, curr + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (curr < total - 2) pages.push('...');
      pages.push(total);
      return pages;
    }

    async function fetchDrilldownData() {
      const box = content.querySelector('#drill-table-box');
      box.innerHTML = `<div class="p-12 text-center text-slate-400 animate-pulse"><i class="fa-solid fa-spinner fa-spin text-xl text-brand mb-2 block"></i>Cargando detalle...</div>`;

      try {
        const q = new URLSearchParams({
          tarjeta: tarjeta,
          desde: state.filters.desde,
          hasta: state.filters.hasta,
          estado: state.filters.estado,
          busqueda: busqueda,
          pagina: String(page),
          tamanoPagina: String(pageSize),
        });
        if (tipoFiltro) q.set('tipo_filtro', tipoFiltro);

        const res = await apiFetch(`/api/dashboard/drilldown?${q.toString()}`);
        currentData = res;
        renderDrilldownTable(res);
      } catch (err) {
        console.error('[Drilldown] Error:', err);
        box.innerHTML = `<div class="p-8 text-center text-danger font-bold">Error al cargar registros de detalle.</div>`;
      }
    }

    function renderDrilldownTable(res) {
      const box = content.querySelector('#drill-table-box');
      const filas = res?.filas || [];
      const totalRegs = res?.totalRegistros || 0;
      const totalMonto = res?.totalMonto || 0;

      const from = totalRegs > 0 ? (page - 1) * pageSize + 1 : 0;
      const to = Math.min(page * pageSize, totalRegs);
      content.querySelector('#drill-count-badge').textContent = `Mostrando ${from}–${to} de ${totalRegs} registro${totalRegs === 1 ? '' : 's'}`;

      if (tarjeta.includes('mensajes')) {
        content.querySelector('#drill-total-badge').textContent = '';
      } else if (tarjeta === 'clientes_deuda') {
        content.querySelector('#drill-total-badge').textContent = `Total a Pagar: ${formatGuaranies(totalMonto)}`;
      } else {
        content.querySelector('#drill-total-badge').textContent = `Total: ${formatGuaranies(totalMonto)}`;
      }

      const pagerEl = content.querySelector('#drill-pagination');
      pagerEl.innerHTML = '';
      const totalPages = Math.max(1, Math.ceil(totalRegs / pageSize));

      const btnPrev = document.createElement('button');
      btnPrev.type = 'button';
      btnPrev.className = 'px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-xs font-bold transition';
      btnPrev.innerHTML = '<i class="fa-solid fa-chevron-left text-[10px] mr-1"></i>Anterior';
      btnPrev.disabled = page <= 1;
      btnPrev.onclick = () => {
        if (page > 1) {
          page--;
          fetchDrilldownData();
        }
      };
      pagerEl.appendChild(btnPrev);

      buildPageNumbers(page, totalPages).forEach((p) => {
        if (p === '...') {
          const dots = document.createElement('span');
          dots.className = 'px-1.5 text-slate-400 font-bold';
          dots.textContent = '…';
          pagerEl.appendChild(dots);
        } else {
          const btnP = document.createElement('button');
          btnP.type = 'button';
          btnP.className = `px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
            p === page
              ? 'bg-brand text-white shadow-2xs'
              : 'bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600'
          }`;
          btnP.textContent = String(p);
          btnP.onclick = () => {
            if (page !== p) {
              page = p;
              fetchDrilldownData();
            }
          };
          pagerEl.appendChild(btnP);
        }
      });

      const btnNext = document.createElement('button');
      btnNext.type = 'button';
      btnNext.className = 'px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-xs font-bold transition';
      btnNext.innerHTML = 'Siguiente<i class="fa-solid fa-chevron-right text-[10px] ml-1"></i>';
      btnNext.disabled = page >= totalPages;
      btnNext.onclick = () => {
        if (page < totalPages) {
          page++;
          fetchDrilldownData();
        }
      };
      pagerEl.appendChild(btnNext);

      if (filas.length === 0) {
        box.innerHTML = `
          <div class="py-12 px-4 text-center">
            <i class="fa-regular fa-folder-open text-2xl text-slate-300 dark:text-slate-600 mb-2 block"></i>
            <p class="font-bold text-slate-600 dark:text-slate-300">Sin registros para este filtro.</p>
          </div>
        `;
        return;
      }

      const table = document.createElement('table');
      table.className = 'w-full text-left border-collapse text-xs';

      if (tarjeta === 'clientes_deuda') {
        table.innerHTML = `
          <thead class="bg-slate-50 dark:bg-slate-800 text-slate-500 uppercase tracking-wider text-[10px] font-bold sticky top-0 border-b border-slate-200 dark:border-slate-700">
            <tr>
              <th class="p-2.5">Cliente</th>
              <th class="p-2.5">Documento</th>
              <th class="p-2.5">Teléfono</th>
              <th class="p-2.5 text-center">Pedidos Pendientes</th>
              <th class="p-2.5 text-right">Costo Total</th>
              <th class="p-2.5 text-right">Monto Pagado</th>
              <th class="p-2.5 text-right text-amber-600 dark:text-amber-400 font-black">Total a Pagar (Saldo)</th>
              <th class="p-2.5 text-right">Antigüedad (días)</th>
              <th class="p-2.5 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800/80">
            ${filas
              .map(
                (r) => `
              <tr class="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                <td class="p-2.5 font-bold text-slate-800 dark:text-slate-100">${escapeHtml(r.clienteNombre)}</td>
                <td class="p-2.5 font-mono text-slate-500">${escapeHtml(r.clienteDoc || '—')}</td>
                <td class="p-2.5 font-mono text-slate-500">${escapeHtml(r.clienteTel || '—')}</td>
                <td class="p-2.5 text-center">
                  <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    ${r.pedidosCount} pedido${r.pedidosCount === 1 ? '' : 's'}
                  </span>
                </td>
                <td class="p-2.5 font-mono font-bold text-right">${formatGuaranies(r.montoTotal)}</td>
                <td class="p-2.5 font-mono text-emerald-600 text-right">${formatGuaranies(r.montoPagado)}</td>
                <td class="p-2.5 font-mono font-black text-amber-600 dark:text-amber-400 text-right text-sm">
                  ${formatGuaranies(r.saldoPendiente)}
                </td>
                <td class="p-2.5 font-mono text-right text-slate-500">${r.antiguedadDias ?? 0} d.</td>
                <td class="p-2.5 text-center">
                  <button type="button" class="btn-ver-pedidos-cliente inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg bg-brand text-white hover:bg-brand-hover shadow-2xs transition cursor-pointer" data-client="${escapeHtml(r.clienteNombre)}">
                    <i class="fa-solid fa-list-check text-[10px]"></i>
                    <span>Ver Pedidos</span>
                  </button>
                </td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        `;
      } else if (tarjeta.startsWith('pedidos') || tarjeta === 'general_ingresos' || tarjeta === 'general_pendientes') {
        table.innerHTML = `
          <thead class="bg-slate-50 dark:bg-slate-800 text-slate-500 uppercase tracking-wider text-[10px] font-bold sticky top-0 border-b border-slate-200 dark:border-slate-700">
            <tr>
              <th class="p-2.5">N° Pedido</th>
              <th class="p-2.5">Fecha</th>
              <th class="p-2.5">Cliente</th>
              <th class="p-2.5">Condición</th>
              <th class="p-2.5 text-right">Costo Total</th>
              <th class="p-2.5 text-right">Pagado</th>
              <th class="p-2.5 text-right">Saldo</th>
              <th class="p-2.5 text-right">Antigüedad (días)</th>
              <th class="p-2.5">Estado</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800/80">
            ${filas
              .map((r) => {
                const saldo = Number(r.saldoPendiente) || 0;
                const pagado = Number(r.montoPagado) || 0;
                const isParcial = saldo > 0 && pagado > 0;
                return `
              <tr class="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                <td class="p-2.5 font-mono font-bold text-brand hover:underline cursor-pointer" data-ped-id="${r.id}">${escapeHtml(r.numeroPedido)}</td>
                <td class="p-2.5 text-slate-500">${formatDateDisplay(r.fecha)}</td>
                <td class="p-2.5 font-bold text-slate-800 dark:text-slate-100">${escapeHtml(r.clienteNombre)}</td>
                <td class="p-2.5">${escapeHtml(r.condicionVenta)}</td>
                <td class="p-2.5 font-mono font-bold text-right">${formatGuaranies(r.montoTotal)}</td>
                <td class="p-2.5 font-mono text-emerald-600 text-right">${formatGuaranies(r.montoPagado)}</td>
                <td class="p-2.5 font-mono ${saldo > 0 ? 'text-amber-600 font-bold' : 'text-slate-400'} text-right">
                  ${formatGuaranies(saldo)}
                  ${isParcial ? `<span class="block text-[9px] text-amber-500 font-normal">Parcial</span>` : ''}
                </td>
                <td class="p-2.5 font-mono text-right text-slate-500">${r.antiguedadDias ?? 0} d.</td>
                <td class="p-2.5">
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    saldo === 0
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                      : isParcial
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }">
                    ${escapeHtml(r.estado)}
                  </span>
                </td>
              </tr>
            `;
              })
              .join('')}
          </tbody>
        `;
      } else if (tarjeta.startsWith('pagos') || tarjeta === 'general_egresos') {
        table.innerHTML = `
          <thead class="bg-slate-50 dark:bg-slate-800 text-slate-500 uppercase tracking-wider text-[10px] font-bold sticky top-0 border-b border-slate-200 dark:border-slate-700">
            <tr>
              <th class="p-2.5">N° Pago</th>
              <th class="p-2.5">Fecha</th>
              <th class="p-2.5">Tipo</th>
              <th class="p-2.5">Beneficiario</th>
              <th class="p-2.5">Concepto</th>
              <th class="p-2.5 text-right">Monto Total</th>
              <th class="p-2.5 text-right">Pagado</th>
              <th class="p-2.5 text-right">Saldo</th>
              <th class="p-2.5 text-right">Antigüedad (días)</th>
              <th class="p-2.5">Estado</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800/80">
            ${filas
              .map((r) => {
                const saldo = Number(r.saldoPendiente) || 0;
                const isParcial = r.estado === 'Pago Parcial';
                return `
              <tr class="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                <td class="p-2.5 font-mono font-bold text-brand">${escapeHtml(r.numeroPago)}</td>
                <td class="p-2.5 text-slate-500">${formatDateDisplay(r.fecha)}</td>
                <td class="p-2.5 font-bold"><span class="px-2 py-0.5 rounded-full text-[10px] ${r.tipoBeneficiario === 'Proveedor' ? 'bg-purple-100 text-brand' : 'bg-blue-100 text-blue-700'}">${escapeHtml(r.tipoBeneficiario)}</span></td>
                <td class="p-2.5 font-bold text-slate-800 dark:text-slate-100">${escapeHtml(r.beneficiario)}</td>
                <td class="p-2.5 text-slate-500">${escapeHtml(r.concepto)}</td>
                <td class="p-2.5 font-mono font-bold text-right">${formatGuaranies(r.montoTotal)}</td>
                <td class="p-2.5 font-mono text-emerald-600 text-right">${formatGuaranies(r.montoPagado)}</td>
                <td class="p-2.5 font-mono ${saldo > 0 ? 'text-amber-600 font-bold' : 'text-slate-400'} text-right">
                  ${formatGuaranies(saldo)}
                  ${isParcial ? `<span class="block text-[9px] text-amber-500 font-normal">Resta</span>` : ''}
                </td>
                <td class="p-2.5 font-mono text-right text-slate-500">${r.antiguedadDias ?? 0} d.</td>
                <td class="p-2.5">
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    r.estado === 'Pagado'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                      : isParcial
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
                      : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400'
                  }">
                    ${escapeHtml(r.estado)}
                  </span>
                </td>
              </tr>
            `;
              })
              .join('')}
          </tbody>
        `;
      } else if (tarjeta.startsWith('mensajes')) {
        table.innerHTML = `
          <thead class="bg-slate-50 dark:bg-slate-800 text-slate-500 uppercase tracking-wider text-[10px] font-bold sticky top-0 border-b border-slate-200 dark:border-slate-700">
            <tr>
              <th class="p-2.5">ID</th>
              <th class="p-2.5">Fecha y Hora</th>
              <th class="p-2.5">Tipo</th>
              <th class="p-2.5">Destinatario</th>
              <th class="p-2.5">Teléfono</th>
              <th class="p-2.5">Campaña / Plantilla</th>
              <th class="p-2.5">Estado</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800/80">
            ${filas
              .map(
                (r) => `
              <tr class="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                <td class="p-2.5 font-mono text-slate-400">#${r.id}</td>
                <td class="p-2.5 font-mono text-slate-500">${escapeHtml(r.fecha)}</td>
                <td class="p-2.5 font-bold"><span class="px-2 py-0.5 rounded-full text-[10px] bg-brand-soft dark:bg-brand/20 text-brand">${escapeHtml(r.tipo)}</span></td>
                <td class="p-2.5 font-bold text-slate-800 dark:text-slate-100">${escapeHtml(r.destinatario)}</td>
                <td class="p-2.5 font-mono text-slate-600 dark:text-slate-300">${escapeHtml(r.telefono)}</td>
                <td class="p-2.5 text-slate-500">${escapeHtml(r.campana)}</td>
                <td class="p-2.5">
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    r.estado === 'Enviado'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                      : r.estado === 'Programado'
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
                      : r.estado === 'En Cola'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400'
                      : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400'
                  }">
                    ${escapeHtml(r.estado)}
                  </span>
                </td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        `;
      } else {
        // Balance de movimientos (Ingresos / Egresos)
        table.innerHTML = `
          <thead class="bg-slate-50 dark:bg-slate-800 text-slate-500 uppercase tracking-wider text-[10px] font-bold sticky top-0 border-b border-slate-200 dark:border-slate-700">
            <tr>
              <th class="p-2.5">Tipo Movimiento</th>
              <th class="p-2.5">Fecha</th>
              <th class="p-2.5">Concepto</th>
              <th class="p-2.5">Cliente / Proveedor</th>
              <th class="p-2.5 text-right">Monto</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800/80">
            ${filas
              .map(
                (r) => `
              <tr class="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                <td class="p-2.5 font-bold">
                  <span class="px-2 py-0.5 rounded-full text-[10px] ${r.tipo === 'Ingreso' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400'}">
                    ${escapeHtml(r.tipo)}
                  </span>
                </td>
                <td class="p-2.5 text-slate-500">${formatDateDisplay(r.fecha)}</td>
                <td class="p-2.5 font-bold text-slate-800 dark:text-slate-100">${escapeHtml(r.concepto)}</td>
                <td class="p-2.5 text-slate-600 dark:text-slate-300">${escapeHtml(r.beneficiario)}</td>
                <td class="p-2.5 font-mono font-bold text-right ${r.tipo === 'Ingreso' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}">
                  ${r.tipo === 'Ingreso' ? '+' : '-'}${formatGuaranies(r.monto)}
                </td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        `;
      }

      box.innerHTML = '';
      box.appendChild(table);

      // Listener para ver los pedidos individuales de un cliente desde la vista de clientes_deuda
      box.querySelectorAll('.btn-ver-pedidos-cliente').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const cli = btn.dataset.client || '';
          tarjeta = 'pedidos_pendientes';
          busqueda = cli;
          const inp = content.querySelector('#drill-inp-search');
          if (inp) inp.value = cli;
          page = 1;
          fetchDrilldownData();
        });
      });
    }

    // Buscador con debounce
    let searchTimer = null;
    content.querySelector('#drill-inp-search')?.addEventListener('input', (e) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        busqueda = e.target.value.trim();
        page = 1;
        fetchDrilldownData();
      }, 300);
    });

    // Exportar CSV COMPLETO (sin paginar, streaming desde el backend según Req #7)
    content.querySelector('#drill-btn-export')?.addEventListener('click', () => {
      const q = new URLSearchParams({
        tarjeta: tarjeta,
        desde: state.filters.desde,
        hasta: state.filters.hasta,
        estado: state.filters.estado,
        busqueda: busqueda,
        exportar: '1',
      });
      if (tipoFiltro) q.set('tipo_filtro', tipoFiltro);

      const downloadUrl = `/api/dashboard/drilldown/export?${q.toString()}`;
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.setAttribute('download', `dashboard_${tarjeta}_${toISODate(new Date())}.csv`);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success('Descargando archivo CSV con todo el conjunto filtrado...');
    });

    // Selector de tamaño de página
    content.querySelector('#drill-sel-pagesize')?.addEventListener('change', (e) => {
      pageSize = parseInt(e.target.value, 10) || 20;
      page = 1;
      fetchDrilldownData();
    });

    // Botón Ver en módulo completo
    content.querySelector('#drill-btn-goto')?.addEventListener('click', () => {
      if (tarjeta.startsWith('pedidos') || tarjeta === 'general_ingresos' || tarjeta === 'general_pendientes' || tarjeta === 'clientes_deuda') {
        onNavigate?.('pedidos');
      } else if (tarjeta.startsWith('pagos') || tarjeta === 'general_egresos') {
        onNavigate?.('pagos');
      } else if (tarjeta.startsWith('mensajes')) {
        onNavigate?.('broadcast');
      } else {
        onNavigate?.('pedidos');
      }
    });

    const modalTitleMap = {
      clientes_deuda: 'Detalle: Clientes con Saldos Pendientes de Pago',
      pedidos_recibidos: 'Detalle: Pedidos Recibidos',
      pedidos_costo: 'Detalle: Costo Total de Pedidos',
      pedidos_pagados: 'Detalle: Pedidos Pagados',
      pedidos_pendientes: 'Detalle: Pedidos con Saldo Pendiente',
      pagos_realizados: 'Detalle: Pagos a Proveedores Realizados',
      pagos_pendientes: 'Detalle: Pagos a Proveedores Pendientes',
      pagos_total: 'Detalle: Todos los Pagos a Proveedores',
      pagos_clientes: 'Detalle: Pagos a Clientes (Reembolsos / Anticipos)',
      mensajes_total: 'Detalle: Todos los Mensajes',
      mensajes_enviados: 'Detalle: Mensajes Enviados con Éxito',
      mensajes_programados: 'Detalle: Mensajes Programados',
      mensajes_en_cola: 'Detalle: Mensajes En Cola',
      mensajes_fallidos: 'Detalle: Mensajes Fallidos',
      mensajes_tipo: `Detalle: Mensajes (${tipoFiltro || 'Tipo'})`,
      general_ingresos: 'Detalle: Ingresos Totales (Cobros)',
      general_egresos: 'Detalle: Egresos Totales (Proveedores)',
      general_pendientes: 'Detalle: Saldos Pendientes de Cobro',
      general_balance: 'Detalle: Balance Financiero (Ingresos vs. Egresos)',
    };

    openModal({
      title: modalTitleMap[tarjeta] || 'Detalle de Registros',
      content: content,
      size: 'xl',
      hideFooter: true,
    });

    fetchDrilldownData();
  }

  // ========================================================================
  // INICIALIZACIÓN
  // ========================================================================
  renderHeader();
  renderFiltersBar();
  renderQuickAccess();
  loadDashboardStats();
}
