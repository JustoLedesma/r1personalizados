import { createButton } from '../components/button.js';
import { createDataTable } from '../components/table.js';
import { openModal, openConfirmModal } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { apiFetch } from '../services/api.js';

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatGuaranies(amount) {
  const num = Math.round(Number(amount) || 0);
  return num.toLocaleString('es-PY') + ' Gs.';
}

function parseGuaranies(str) {
  if (typeof str === 'number') return Math.round(str);
  const clean = String(str || '').replace(/[^\d]/g, '');
  return parseInt(clean, 10) || 0;
}

function getTodayISODate() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateDisplay(isoDateStr) {
  if (!isoDateStr) return '—';
  const parts = String(isoDateStr).split('T')[0].split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return isoDateStr;
}

function getNombreDiaSemana(isoDateStr) {
  if (!isoDateStr) return '';
  const clean = String(isoDateStr).split('T')[0];
  const parts = clean.split('-').map(Number);
  if (parts.length !== 3) return '';
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  return DIAS_SEMANA_ES[d.getDay()] || '';
}

function getISOWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

function getISOWeekAndYearFromStr(isoDateStr) {
  const clean = String(isoDateStr || '').split('T')[0];
  const parts = clean.split('-');
  let d;
  if (parts.length === 3) {
    d = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])));
  } else {
    const now = new Date();
    d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  }
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const isoYear = d.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const isoWeek = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return { week: isoWeek, year: isoYear };
}

function formatLocalDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getMondayOfDateStr(dateStr) {
  const clean = String(dateStr || '').split('T')[0];
  const parts = clean.split('-').map(Number);
  const d = parts.length === 3 ? new Date(parts[0], parts[1] - 1, parts[2]) : new Date();
  const day = d.getDay(); // 0 is Sunday, 1 is Monday
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return formatLocalDate(d);
}

function addMonthsToDateStr(dateStr, months) {
  const parts = String(dateStr || '').split('-').map(Number);
  const d = new Date(parts[0], parts[1] - 1 + months, parts[2]);
  return formatLocalDate(d);
}

function addWeeksToDateStr(dateStr, weeks) {
  const parts = String(dateStr || '').split('-').map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2] + weeks * 7);
  return formatLocalDate(d);
}

function getEndOfMonthDateStr(dateStr) {
  const parts = String(dateStr || '').split('-').map(Number);
  const d = new Date(parts[0], parts[1], 0);
  return formatLocalDate(d);
}

function getStartOfMonthDateStr(dateStr) {
  const parts = String(dateStr || '').split('-').map(Number);
  const d = new Date(parts[0], parts[1] - 1, 1);
  return formatLocalDate(d);
}

const DIAS_SEMANA_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MESES_NOMBRES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

function calculateRecurringDatesPreview(frecuencia, tipoDia, fechaInicioStr, fechaFinStr) {
  if (!fechaInicioStr || !fechaFinStr) return [];
  const startParts = fechaInicioStr.split('-').map(Number);
  const endParts = fechaFinStr.split('-').map(Number);
  const start = new Date(startParts[0], startParts[1] - 1, startParts[2]);
  const end = new Date(endParts[0], endParts[1] - 1, endParts[2]);

  if (end < start) return [];

  const dates = [];
  const frec = (frecuencia || 'Semanal').toLowerCase();

  if (frec === 'diario') {
    let cur = new Date(start);
    while (cur <= end && dates.length < 366) {
      const dStr = formatLocalDate(cur);
      const iso = getISOWeekAndYearFromStr(dStr);
      const diaNombre = DIAS_SEMANA_ES[cur.getDay()];
      dates.push({
        fecha: dStr,
        dateStr: dStr,
        diaNombre: diaNombre,
        semanaIso: iso.week,
        week: iso.week,
        anioIso: iso.year,
        year: iso.year,
        badgeTexto: `Semana ISO ${iso.week}`,
        detalleTexto: `Día ${diaNombre} · Pago diario regular`,
      });
      cur.setDate(cur.getDate() + 1);
    }
  } else if (frec === 'semanal') {
    let cur = new Date(start);
    const day = cur.getDay(); // 0 es Domingo, 1 es Lunes
    const diff = day === 0 ? -6 : 1 - day;
    cur.setDate(cur.getDate() + diff); // Iniciar lunes automáticamente según sistema ISO

    while (cur <= end && dates.length < 156) {
      const dStr = formatLocalDate(cur);
      const iso = getISOWeekAndYearFromStr(dStr);
      const sunday = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 6);
      const sundayStr = formatLocalDate(sunday);
      const diaNombre = DIAS_SEMANA_ES[cur.getDay()]; // Siempre 'Lunes'

      dates.push({
        fecha: dStr,
        dateStr: dStr,
        diaNombre: diaNombre,
        semanaIso: iso.week,
        week: iso.week,
        anioIso: iso.year,
        year: iso.year,
        domingoFecha: sundayStr,
        badgeTexto: `Semana ISO ${iso.week} (${iso.year})`,
        detalleTexto: `Semana ISO: Lunes ${formatDateDisplay(dStr)} al Domingo ${formatDateDisplay(sundayStr)}`,
      });
      cur.setDate(cur.getDate() + 7);
    }
  } else if (frec === 'mensual') {
    const totalMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    for (let i = 0; i <= totalMonths && dates.length < 60; i++) {
      const y = start.getFullYear();
      const m = start.getMonth() + i;
      let target;
      let modoLabel = '';
      if (tipoDia === 'cierre_mes') {
        target = new Date(y, m + 1, 0); // Cierre de mes (último día)
        modoLabel = 'Cierre de Mes';
      } else {
        target = new Date(y, m, 1); // Inicio de mes (día 1)
        modoLabel = 'Inicio de Mes';
      }
      if (target >= start && target <= end) {
        const dStr = formatLocalDate(target);
        const iso = getISOWeekAndYearFromStr(dStr);
        const diaNombre = DIAS_SEMANA_ES[target.getDay()];
        const mesNombre = MESES_NOMBRES_ES[target.getMonth()];

        dates.push({
          fecha: dStr,
          dateStr: dStr,
          diaNombre: diaNombre,
          semanaIso: iso.week,
          week: iso.week,
          anioIso: iso.year,
          year: iso.year,
          badgeTexto: `${modoLabel} · Semana ISO ${iso.week}`,
          detalleTexto: `${modoLabel} de ${mesNombre} ${target.getFullYear()} (corresponde a día ${diaNombre})`,
        });
      }
    }
  } else if (frec === 'trimestral') {
    const totalMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    for (let i = 0; i <= totalMonths && dates.length < 40; i += 3) {
      const y = start.getFullYear();
      const m = start.getMonth() + i;
      let target;
      let modoLabel = '';
      if (tipoDia === 'cierre_mes') {
        target = new Date(y, m + 1, 0);
        modoLabel = 'Cierre Trimestral';
      } else {
        target = new Date(y, m, 1);
        modoLabel = 'Inicio Trimestral';
      }
      if (target >= start && target <= end) {
        const dStr = formatLocalDate(target);
        const iso = getISOWeekAndYearFromStr(dStr);
        const diaNombre = DIAS_SEMANA_ES[target.getDay()];
        const mesNombre = MESES_NOMBRES_ES[target.getMonth()];

        dates.push({
          fecha: dStr,
          dateStr: dStr,
          diaNombre: diaNombre,
          semanaIso: iso.week,
          week: iso.week,
          anioIso: iso.year,
          year: iso.year,
          badgeTexto: `${modoLabel} · Semana ISO ${iso.week}`,
          detalleTexto: `${modoLabel} (${mesNombre} ${target.getFullYear()}) · corresponde a día ${diaNombre}`,
        });
      }
    }
  }

  return dates;
}

// Switch iOS estandarizado según AGENTS.md
function createIOSToggle({ label = '', checked = false, onChange = null, activeColor = 'brand' }) {
  const wrap = document.createElement('label');
  wrap.className = 'inline-flex items-center gap-2.5 cursor-pointer select-none';

  const activeBg = activeColor === 'emerald' ? 'bg-emerald-500' : 'bg-brand';

  wrap.innerHTML = `
    <span class="text-xs font-semibold text-slate-700 dark:text-slate-300">${escapeHtml(label)}</span>
    <div class="relative inline-flex items-center">
      <input type="checkbox" class="sr-only peer" ${checked ? 'checked' : ''} />
      <div class="w-11 h-6 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:${activeBg}"></div>
    </div>
  `;

  const input = wrap.querySelector('input');
  input.addEventListener('change', () => {
    if (typeof onChange === 'function') onChange(input.checked);
  });

  return {
    element: wrap,
    isChecked: () => input.checked,
    setChecked: (val) => {
      input.checked = Boolean(val);
    },
  };
}

// Contador numérico estandarizado según AGENTS.md
function createQuantityCounter({ value = 1, min = 1, onChange = null } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'inline-flex items-center rounded-xl bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700 shadow-xs';

  wrap.innerHTML = `
    <button type="button" class="btn-qty-minus w-8 h-8 rounded-lg bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 text-white flex items-center justify-center transition active:scale-95 cursor-pointer" aria-label="Disminuir cantidad">
      <i class="fa-solid fa-minus text-xs"></i>
    </button>
    <input type="text" class="input-qty-val w-12 text-center text-xs font-bold font-mono bg-transparent text-slate-900 dark:text-white focus:outline-none" value="${value}" />
    <button type="button" class="btn-qty-plus w-8 h-8 rounded-lg bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 text-white flex items-center justify-center transition active:scale-95 cursor-pointer" aria-label="Aumentar cantidad">
      <i class="fa-solid fa-plus text-xs"></i>
    </button>
  `;

  const minusBtn = wrap.querySelector('.btn-qty-minus');
  const plusBtn = wrap.querySelector('.btn-qty-plus');
  const inputVal = wrap.querySelector('.input-qty-val');

  let currentVal = Math.max(min, Math.floor(Number(value) || min));
  inputVal.value = currentVal;

  function updateVal(newVal) {
    currentVal = Math.max(min, Math.floor(Number(newVal) || min));
    inputVal.value = currentVal;
    if (typeof onChange === 'function') onChange(currentVal);
  }

  let intervalId = null;
  function startRepeat(delta) {
    updateVal(currentVal + delta);
    intervalId = setInterval(() => {
      updateVal(currentVal + delta);
    }, 180);
  }
  function stopRepeat() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  minusBtn.addEventListener('mousedown', () => startRepeat(-1));
  minusBtn.addEventListener('mouseup', stopRepeat);
  minusBtn.addEventListener('mouseleave', stopRepeat);

  plusBtn.addEventListener('mousedown', () => startRepeat(1));
  plusBtn.addEventListener('mouseup', stopRepeat);
  plusBtn.addEventListener('mouseleave', stopRepeat);

  inputVal.addEventListener('change', () => {
    updateVal(inputVal.value);
  });
  inputVal.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      updateVal(inputVal.value);
    }
  });

  return {
    element: wrap,
    getValue: () => currentVal,
    setValue: (v) => updateVal(v),
  };
}

function downloadFileBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 200);
}

export function renderPagosModule(container) {
  container.innerHTML = '';

  const state = {
    filter: 'todos', // 'todos' | 'pendientes' | 'hoy' | 'semana' | 'mes'
    search: '',
    headerBeneficiario: 'todos', // 'todos' | 'Proveedor' | 'Cliente'
    headerEstado: 'todos', // 'todos' | 'Pagado' | 'Pendiente' | 'Pago Parcial'
    headerSemana: 'todas', // 'todas' | number
    headerDia: '', // '' | 'YYYY-MM-DD'
    page: 1,
    pageSize: 20,
    data: [],
    total: 0,
    filteredTotals: {
      montoTotal: 0,
      montoPagado: 0,
      saldo: 0,
    },
    stats: {
      total: 0,
      pendientes: 0,
      pagadosHoy: 0,
      pagadosSemana: 0,
      pagadosMes: 0,
      montoTotal: 0,
      montoPendiente: 0,
      montoPagado: 0,
      montoHoy: 0,
      montoSemana: 0,
      montoMes: 0,
      montoPagadoHoy: 0,
      montoPagadoSemana: 0,
      montoPagadoMes: 0,
    },
    loading: false,
    catalogoProveedores: [],
    catalogoClientes: [],
    catalogoColaboradores: [],
    catalogoProductos: [],
    catalogoPedidos: [],
  };

  const moduleWrap = document.createElement('div');
  moduleWrap.className = 'w-full space-y-6';

  // ==========================================================================
  // 1. ENCABEZADO: Título, Indicadores de Fecha y Semana, y Botón Crear Pago
  // ==========================================================================
  const headerCard = document.createElement('div');
  headerCard.className =
    'p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4';

  const today = new Date();
  const todayStr = today.toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const weekNum = getISOWeekNumber(today);

  headerCard.innerHTML = `
    <div class="flex flex-wrap items-center gap-3 sm:gap-4">
      <div class="w-12 h-12 rounded-2xl bg-brand-soft dark:bg-brand/20 text-brand flex items-center justify-center text-xl shrink-0">
        <i class="fa-solid fa-file-invoice-dollar"></i>
      </div>
      <div>
        <h1 class="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
          <span>Gestión de Pagos</span>
        </h1>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Control de pagos a proveedores, colaboradores, otros gastos y vinculación de compras por pedido
        </p>
      </div>
      <div class="flex items-center gap-2 mt-2 sm:mt-0 sm:ml-2">
        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700" title="Fecha actual">
          <i class="fa-regular fa-calendar text-brand text-[11px]"></i>
          <span>Hoy: <strong>${todayStr}</strong></span>
        </span>
        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-50 dark:bg-brand/10 text-brand border border-brand/20" title="Semana ISO 8601">
          <i class="fa-solid fa-calendar-week text-[11px]"></i>
          <span>Semana actual: <strong>Semana ${weekNum}</strong></span>
        </span>
      </div>
    </div>
    <div id="header-actions" class="flex items-center gap-2 shrink-0"></div>
  `;

  const headerActions = headerCard.querySelector('#header-actions');
  const btnNuevoPago = createButton({
    text: 'Generar Pago',
    icon: 'fa-solid fa-plus',
    variant: 'primary',
    size: 'md',
    ariaLabel: 'Crear o generar un nuevo pago',
    onClick: () => openCrearPagoModal(),
  });
  headerActions.appendChild(btnNuevoPago);
  moduleWrap.appendChild(headerCard);

  // ==========================================================================
  // 2. TARJETAS DE CONTADORES QUE FUNCIONAN COMO FILTRO PRINCIPAL (Sin chips redundantes)
  // ==========================================================================
  const statsGrid = document.createElement('div');
  statsGrid.className = 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 select-none';

  function renderStatsCards() {
    statsGrid.innerHTML = `
      <div data-filter="todos" class="stat-card p-4 rounded-2xl bg-white dark:bg-slate-900 border transition shadow-xs cursor-pointer ${state.filter === 'todos' ? 'border-brand ring-2 ring-brand/30 bg-purple-50/20 dark:bg-purple-950/20' : 'border-slate-200/80 dark:border-slate-800 hover:border-brand/40'}">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Pagos</span>
          <span class="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-950/50 text-brand flex items-center justify-center text-sm">
            <i class="fa-solid fa-list-check"></i>
          </span>
        </div>
        <p class="text-2xl font-black text-slate-900 dark:text-white mt-2 font-mono">${state.stats.total}</p>
        <p class="text-[11px] text-slate-400 mt-0.5 font-mono">Total: ${formatGuaranies(state.stats.montoTotal)}</p>
      </div>

      <div data-filter="pendientes" class="stat-card p-4 rounded-2xl bg-white dark:bg-slate-900 border transition shadow-xs cursor-pointer ${state.filter === 'pendientes' ? 'border-amber-500 ring-2 ring-amber-500/30 bg-amber-50/20 dark:bg-amber-950/20' : 'border-slate-200/80 dark:border-slate-800 hover:border-amber-400'}">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Pendientes</span>
          <span class="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center text-sm">
            <i class="fa-solid fa-clock"></i>
          </span>
        </div>
        <p class="text-2xl font-black text-amber-600 dark:text-amber-400 mt-2 font-mono">${state.stats.pendientes}</p>
        <p class="text-[11px] text-slate-400 mt-0.5 font-mono">Saldo: ${formatGuaranies(state.stats.montoPendiente)}</p>
      </div>

      <div data-filter="hoy" class="stat-card p-4 rounded-2xl bg-white dark:bg-slate-900 border transition shadow-xs cursor-pointer ${state.filter === 'hoy' ? 'border-emerald-500 ring-2 ring-emerald-500/30 bg-emerald-50/20 dark:bg-emerald-950/20' : 'border-slate-200/80 dark:border-slate-800 hover:border-emerald-400'}">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Pagos de Hoy</span>
          <span class="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center text-sm">
            <i class="fa-solid fa-calendar-day"></i>
          </span>
        </div>
        <p class="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2 font-mono">${state.stats.pagadosHoy}</p>
        <p class="text-[11px] text-slate-400 mt-0.5 font-mono">Total: ${formatGuaranies(state.stats.montoHoy)}</p>
      </div>

      <div data-filter="semana" class="stat-card p-4 rounded-2xl bg-white dark:bg-slate-900 border transition shadow-xs cursor-pointer ${state.filter === 'semana' ? 'border-blue-500 ring-2 ring-blue-500/30 bg-blue-50/20 dark:bg-blue-950/20' : 'border-slate-200/80 dark:border-slate-800 hover:border-blue-400'}">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Esta Semana</span>
          <span class="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center text-sm">
            <i class="fa-solid fa-calendar-week"></i>
          </span>
        </div>
        <p class="text-2xl font-black text-blue-600 dark:text-blue-400 mt-2 font-mono">${state.stats.pagadosSemana}</p>
        <p class="text-[11px] text-slate-400 mt-0.5 font-mono">Total: ${formatGuaranies(state.stats.montoSemana)}</p>
      </div>

      <div data-filter="mes" class="stat-card p-4 rounded-2xl bg-white dark:bg-slate-900 border transition shadow-xs cursor-pointer ${state.filter === 'mes' ? 'border-purple-500 ring-2 ring-purple-500/30 bg-purple-50/20 dark:bg-purple-950/20' : 'border-slate-200/80 dark:border-slate-800 hover:border-purple-400'} col-span-2 sm:col-span-1">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">Este Mes</span>
          <span class="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-950/50 text-purple-600 flex items-center justify-center text-sm">
            <i class="fa-solid fa-calendar-days"></i>
          </span>
        </div>
        <p class="text-2xl font-black text-purple-600 dark:text-purple-400 mt-2 font-mono">${state.stats.pagadosMes}</p>
        <p class="text-[11px] text-slate-400 mt-0.5 font-mono">Total: ${formatGuaranies(state.stats.montoMes)}</p>
      </div>
    `;

    statsGrid.querySelectorAll('.stat-card').forEach((c) => {
      c.addEventListener('click', () => {
        state.filter = c.dataset.filter;
        state.page = 1;
        renderStatsCards();
        loadData();
      });
    });
  }
  renderStatsCards();
  moduleWrap.appendChild(statsGrid);

  // ==========================================================================
  // 3. BARRA DE HERRAMIENTAS Y FILTRO MINIMALISTA DE ENCABEZADO
  // ==========================================================================
  const minimalBar = document.createElement('div');
  minimalBar.className =
    'p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs';

  function renderMinimalBar() {
    minimalBar.innerHTML = `
      <div class="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
        <!-- Buscador minimalista -->
        <div class="relative w-full sm:w-64">
          <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
          <input type="text" id="pagos-search-inp" value="${escapeHtml(state.search)}"
            placeholder="Buscar por N°, nombre, producto..."
            class="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand" />
        </div>

        <!-- Filtro Beneficiario -->
        <div class="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-xl border border-slate-200 dark:border-slate-700">
          <span class="text-[11px] font-semibold text-slate-400">Tipo:</span>
          <select id="filter-beneficiario" class="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer">
            <option value="todos" ${state.headerBeneficiario === 'todos' ? 'selected' : ''}>Todos</option>
            <option value="Proveedor" ${state.headerBeneficiario === 'Proveedor' ? 'selected' : ''}>Proveedores</option>
            <option value="Colaborador" ${state.headerBeneficiario === 'Colaborador' ? 'selected' : ''}>Colaboradores</option>
            <option value="Otros" ${state.headerBeneficiario === 'Otros' ? 'selected' : ''}>Otros</option>
          </select>
        </div>

        <!-- Filtro Estado -->
        <div class="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-xl border border-slate-200 dark:border-slate-700">
          <span class="text-[11px] font-semibold text-slate-400">Estado:</span>
          <select id="filter-estado" class="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer">
            <option value="todos" ${state.headerEstado === 'todos' ? 'selected' : ''}>Todos</option>
            <option value="Pagado" ${state.headerEstado === 'Pagado' ? 'selected' : ''}>Pagados</option>
            <option value="Pendiente" ${state.headerEstado === 'Pendiente' ? 'selected' : ''}>Pendientes</option>
            <option value="Pago Parcial" ${state.headerEstado === 'Pago Parcial' ? 'selected' : ''}>Pago Parcial</option>
          </select>
        </div>

        <!-- Filtro Semana -->
        <div class="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-xl border border-slate-200 dark:border-slate-700">
          <span class="text-[11px] font-semibold text-slate-400">Semana:</span>
          <select id="filter-semana" class="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer">
            <option value="todas" ${state.headerSemana === 'todas' ? 'selected' : ''}>Todas</option>
            ${Array.from({ length: 52 }, (_, i) => i + 1).map((s) => `
              <option value="${s}" ${String(state.headerSemana) === String(s) ? 'selected' : ''}>Semana ${s}</option>
            `).join('')}
          </select>
        </div>

        <!-- Filtro Día / Fecha (hasta fecha actual nomás) -->
        <div class="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-xl border border-slate-200 dark:border-slate-700" title="Seleccione o escriba el día/fecha (hasta hoy)">
          <i class="fa-solid fa-calendar-day text-brand text-[11px]"></i>
          <span class="text-[11px] font-semibold text-slate-400">Día:</span>
          <input type="date" id="filter-dia" value="${escapeHtml(state.headerDia)}" max="${getTodayISODate()}"
            class="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer" />
          ${state.headerDia ? `
            <button type="button" id="btn-clear-dia" class="text-slate-400 hover:text-danger text-xs px-1 cursor-pointer" title="Quitar filtro de día">
              <i class="fa-solid fa-xmark"></i>
            </button>
          ` : ''}
        </div>

        <!-- Selector de Paginación / Límite de Vista (hasta 1.000 ítems para ver total de deuda) -->
        <div class="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-xl border border-slate-200 dark:border-slate-700" title="Cantidad de pagos a visualizar (hasta 1.000 ítems)">
          <i class="fa-solid fa-table-list text-slate-400 text-[11px]"></i>
          <span class="text-[11px] font-semibold text-slate-400">Ver:</span>
          <select id="filter-pagesize" class="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer">
            <option value="20" ${state.pageSize === 20 ? 'selected' : ''}>20 (Estándar)</option>
            <option value="50" ${state.pageSize === 50 ? 'selected' : ''}>50 por pág.</option>
            <option value="100" ${state.pageSize === 100 ? 'selected' : ''}>100 por pág.</option>
            <option value="1000" ${state.pageSize === 1000 ? 'selected' : ''}>1.000 ítems (Ver Todo / Deuda)</option>
          </select>
        </div>

        ${
          state.search || state.headerBeneficiario !== 'todos' || state.headerEstado !== 'todos' || state.headerSemana !== 'todas' || state.headerDia || state.pageSize !== 20
            ? `
          <button type="button" id="btn-limpiar-filtros" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold text-slate-500 hover:text-danger hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer" title="Restablecer filtros">
            <i class="fa-solid fa-rotate-left text-[10px]"></i>
            <span>Limpiar</span>
          </button>
        `
            : ''
        }
      </div>

      <!-- Resumen contador -->
      <div class="flex items-center gap-2 text-slate-400 text-xs shrink-0 font-mono">
        <i class="fa-solid fa-table text-slate-400 text-[11px]"></i>
        <span>${state.total} registro${state.total === 1 ? '' : 's'}</span>
      </div>
    `;

    let searchTimeout = null;
    const searchInp = minimalBar.querySelector('#pagos-search-inp');
    searchInp?.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        state.search = e.target.value.trim();
        state.page = 1;
        loadData();
      }, 300);
    });

    minimalBar.querySelector('#filter-beneficiario')?.addEventListener('change', (e) => {
      state.headerBeneficiario = e.target.value;
      state.page = 1;
      loadData();
    });

    minimalBar.querySelector('#filter-estado')?.addEventListener('change', (e) => {
      state.headerEstado = e.target.value;
      state.page = 1;
      loadData();
    });

    minimalBar.querySelector('#filter-semana')?.addEventListener('change', (e) => {
      state.headerSemana = e.target.value;
      state.page = 1;
      loadData();
    });

    minimalBar.querySelector('#filter-dia')?.addEventListener('change', (e) => {
      state.headerDia = e.target.value;
      state.page = 1;
      renderMinimalBar();
      loadData();
    });

    minimalBar.querySelector('#btn-clear-dia')?.addEventListener('click', () => {
      state.headerDia = '';
      state.page = 1;
      renderMinimalBar();
      loadData();
    });

    minimalBar.querySelector('#filter-pagesize')?.addEventListener('change', (e) => {
      state.pageSize = Number(e.target.value) || 20;
      state.page = 1;
      loadData();
    });

    minimalBar.querySelector('#btn-limpiar-filtros')?.addEventListener('click', () => {
      state.search = '';
      state.headerBeneficiario = 'todos';
      state.headerEstado = 'todos';
      state.headerSemana = 'todas';
      state.headerDia = '';
      state.pageSize = 20;
      state.page = 1;
      renderMinimalBar();
      loadData();
    });
  }
  renderMinimalBar();
  moduleWrap.appendChild(minimalBar);

  // ==========================================================================
  // 4. TABLA DE PAGOS (DataTable con Paginación estandarizada e Ícono de Descarga)
  // ==========================================================================
  const tableHolder = document.createElement('div');
  moduleWrap.appendChild(tableHolder);

  const totalsHolder = document.createElement('div');
  totalsHolder.className = 'w-full';
  moduleWrap.appendChild(totalsHolder);

  function renderTotalsBar() {
    totalsHolder.innerHTML = `
      <div class="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 select-none">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-brand flex items-center justify-center text-lg shrink-0">
            <i class="fa-solid fa-calculator"></i>
          </div>
          <div>
            <h3 class="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Totales Generales de la Vista</span>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                ${state.total} registro${state.total === 1 ? '' : 's'} ${state.pageSize === 1000 ? '(Vista ampliada 1.000)' : ''}
              </span>
            </h3>
            <p class="text-[11px] text-slate-500 dark:text-slate-400">
              Monto total, monto abonado y saldo pendiente calculados dinámicamente acorde a los filtros aplicados.
            </p>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-3 sm:gap-4">
          <!-- Monto Total -->
          <div class="p-3 sm:px-4 sm:py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 min-w-[140px]">
            <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Monto Total</span>
            <span class="text-sm sm:text-base font-black font-mono text-slate-900 dark:text-white">
              ${formatGuaranies(state.filteredTotals.montoTotal)}
            </span>
          </div>

          <!-- Monto Pagado -->
          <div class="p-3 sm:px-4 sm:py-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/40 min-w-[140px]">
            <span class="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">Monto Pagado</span>
            <span class="text-sm sm:text-base font-black font-mono text-emerald-600 dark:text-emerald-400">
              ${formatGuaranies(state.filteredTotals.montoPagado)}
            </span>
          </div>

          <!-- Saldo / Deuda -->
          <div class="p-3 sm:px-4 sm:py-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/40 min-w-[150px]">
            <span class="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center justify-between">
              <span>Saldo / Deuda</span>
              <i class="fa-solid fa-triangle-exclamation text-[10px]"></i>
            </span>
            <span class="text-sm sm:text-base font-black font-mono text-amber-600 dark:text-amber-400">
              ${formatGuaranies(state.filteredTotals.saldo)}
            </span>
          </div>
        </div>
      </div>
    `;
  }

  function renderTable() {
    tableHolder.innerHTML = '';

    const columns = [
      {
        key: 'numeroPago',
        label: 'N° Pago',
        render: (row) => {
          const wrap = document.createElement('div');
          wrap.className = 'cursor-pointer group flex flex-col items-start gap-0.5';
          wrap.innerHTML = `
            <span class="font-mono font-bold text-brand group-hover:underline">${escapeHtml(row.numeroPago)}</span>
            <span class="text-[10px] text-slate-400">${formatDateDisplay(row.fechaPago)}</span>
            ${row.esRecurrente ? `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 font-mono mt-0.5" title="Pago recurrente programado (${escapeHtml(row.recurrenciaFrecuencia || '')})"><i class="fa-solid fa-arrows-rotate text-[8px]"></i> Recurrente (${escapeHtml(row.recurrenciaFrecuencia || 'Prog.')})</span>` : ''}
          `;
          wrap.addEventListener('click', () => openDetallePagoModal(row));
          return wrap;
        },
      },
      {
        key: 'fechaPago',
        label: 'Semana',
        render: (row) => {
          const wrap = document.createElement('div');
          wrap.className = 'flex flex-col items-start gap-1';
          const badge = document.createElement('span');
          badge.className =
            'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono';
          badge.textContent = `S${row.semanaIso || weekNum}`;
          wrap.appendChild(badge);

          if (row.estadoPago === 'Pago Parcial' && Array.isArray(row.historialParciales) && row.historialParciales.length > 0) {
            const lastParcial = row.historialParciales[row.historialParciales.length - 1];
            const weeksSet = [...new Set(row.historialParciales.map((hp) => `S${hp.semanaIso || row.semanaIso}`))];
            const sub = document.createElement('span');
            sub.className = 'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-100 text-brand dark:bg-brand/20 dark:text-brand font-mono';
            sub.innerHTML = `<i class="fa-solid fa-calendar-check text-[8px]"></i><span>${weeksSet.join(' → ')} · ${formatDateDisplay(lastParcial.fechaPago || row.fechaPago)}</span>`;
            wrap.appendChild(sub);
          }
          return wrap;
        },
      },
      {
        key: 'beneficiario',
        label: 'Beneficiario',
        render: (row) => {
          const tipo = row.tipoBeneficiario || 'Proveedor';
          const isProv = tipo === 'Proveedor';
          const isColab = tipo === 'Colaborador';
          const isOtros = tipo === 'Otros';

          const nom = isOtros
            ? (row.proveedorNombre || row.referenciaPago || 'Otros')
            : isProv || isColab
            ? (row.proveedorNombre || row.clienteNombre || '—')
            : (row.clienteNombre || row.proveedorNombre || '—');
          const doc = isProv || isColab || isOtros ? (row.proveedorRuc || '') : (row.clienteDocumento || '');
          const isTemporal = isProv ? row.esProveedorTemporal : false;

          let badgeStyle = 'bg-purple-100 text-brand dark:bg-brand/20 dark:text-brand';
          if (isColab) {
            badgeStyle = 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300';
          } else if (isOtros) {
            badgeStyle = 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300';
          } else if (!isProv) {
            badgeStyle = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300';
          }

          const wrap = document.createElement('div');
          wrap.className = 'space-y-0.5';
          wrap.innerHTML = `
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${badgeStyle}">${escapeHtml(tipo)}</span>
              <span class="font-bold text-slate-800 dark:text-slate-100 text-xs">${escapeHtml(nom)}</span>
            </div>
            <div class="text-[10px] text-slate-400">
              ${isOtros && row.referenciaPago && row.referenciaPago !== nom ? `<div class="text-brand font-semibold">Ref: ${escapeHtml(row.referenciaPago)}</div>` : ''}
              ${doc ? `<span>Doc: ${escapeHtml(doc)}</span>` : ''}
              ${isTemporal ? '<span class="text-amber-500 ml-1 font-semibold">· Temporal</span>' : ''}
            </div>
          `;
          return wrap;
        },
      },
      {
        key: 'producto',
        label: 'Producto',
        render: (row) => {
          const wrap = document.createElement('div');
          wrap.className = 'space-y-0.5';
          wrap.innerHTML = `
            <p class="font-semibold text-slate-800 dark:text-slate-100 text-xs">${escapeHtml(row.productoNombre)}</p>
            <p class="text-[10px] text-slate-400 font-mono">Cant: ${row.cantidad}</p>
          `;
          return wrap;
        },
      },
      {
        key: 'destino',
        label: 'Destinado a (Cliente / Pedido)',
        render: (row) => {
          const wrap = document.createElement('div');
          wrap.className = 'space-y-0.5';

          if (row.numeroPedido || row.clienteNombre) {
            wrap.innerHTML = `
              <div class="flex items-center gap-1.5">
                ${row.numeroPedido ? `<span class="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-brand-soft dark:bg-brand/20 text-brand">${escapeHtml(row.numeroPedido)}</span>` : ''}
                <span class="text-xs font-medium text-slate-700 dark:text-slate-300">${escapeHtml(row.clienteNombre || '')}</span>
              </div>
              ${row.clienteTelefono ? `<p class="text-[10px] text-slate-400">Tel: ${escapeHtml(row.clienteTelefono)}</p>` : ''}
            `;
          } else {
            wrap.innerHTML = `<span class="text-[11px] text-slate-400 italic">Compra / Pago directo</span>`;
          }
          return wrap;
        },
      },
      {
        key: 'montoTotal',
        label: 'Monto Total',
        render: (row) => {
          const el = document.createElement('span');
          el.className = 'font-mono font-black text-slate-900 dark:text-white text-xs';
          el.textContent = formatGuaranies(row.montoTotal);
          return el;
        },
      },
      {
        key: 'pagadoSaldo',
        label: 'Pagado / Saldo',
        render: (row) => {
          const wrap = document.createElement('div');
          wrap.className = 'space-y-0.5 text-xs font-mono';
          wrap.innerHTML = `
            <div class="text-emerald-600 dark:text-emerald-400 font-bold">${formatGuaranies(row.montoPagado)}</div>
            ${row.saldoPendiente > 0 ? `<div class="text-[10px] text-danger font-semibold">Saldo: ${formatGuaranies(row.saldoPendiente)}</div>` : '<div class="text-[10px] text-slate-400">Sin saldo</div>'}
          `;
          return wrap;
        },
      },
      {
        key: 'estadoPago',
        label: 'Estado',
        render: (row) => {
          const wrap = document.createElement('span');
          const st = row.estadoPago;
          if (st === 'Pagado') {
            wrap.className = 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300';
            wrap.innerHTML = `<i class="fa-solid fa-check text-[9px]"></i><span>Pagado</span>`;
          } else if (st === 'Pago Parcial') {
            wrap.className = 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-100 text-brand dark:bg-purple-950/60 dark:text-brand';
            wrap.innerHTML = `<i class="fa-solid fa-circle-half-stroke text-[9px]"></i><span>Pago Parcial</span>`;
          } else {
            wrap.className = 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300';
            wrap.innerHTML = `<i class="fa-solid fa-clock text-[9px]"></i><span>Pendiente</span>`;
          }
          return wrap;
        },
      },
      {
        key: 'acciones',
        label: 'Acciones',
        render: (row) => {
          const wrap = document.createElement('div');
          wrap.className = 'flex items-center justify-end gap-1';

          // Ver / Vista Previa
          const viewBtn = createButton({
            variant: 'ghost',
            size: 'sm',
            icon: 'fa-regular fa-eye',
            ariaLabel: 'Ver detalle del pago',
            onClick: () => openDetallePagoModal(row),
          });

          // Editar
          const editBtn = createButton({
            variant: 'ghost',
            size: 'sm',
            icon: 'fa-regular fa-pen-to-square',
            ariaLabel: 'Editar pago',
            onClick: () => openEditarPagoModal(row),
          });

          // Anular / Eliminar (soft-delete simulado con confirmación)
          const delBtn = createButton({
            variant: 'danger',
            size: 'sm',
            icon: 'fa-regular fa-trash-can',
            ariaLabel: 'Anular pago',
            onClick: () => confirmarAnularPago(row),
          });

          wrap.append(viewBtn, editBtn, delBtn);
          return wrap;
        },
      },
    ];

    const dt = createDataTable({
      columns: columns,
      data: state.data,
      total: state.total,
      page: state.page,
      pageSize: state.pageSize,
      loading: state.loading,
      searchable: false,
      emptyMessage: 'No hay pagos registrados con los filtros seleccionados.',
      onPageChange: (newPage) => {
        state.page = newPage;
        loadData();
      },
    });

    // Inyectar ícono de descarga al lado de "Acciones" en el encabezado de la tabla
    const thHeaders = dt.querySelectorAll('thead th');
    if (thHeaders.length > 0) {
      const lastTh = thHeaders[thHeaders.length - 1];
      const thContent = lastTh.textContent.trim();
      if (thContent.includes('Acciones')) {
        lastTh.innerHTML = `
          <div class="flex items-center justify-end gap-1.5 select-none">
            <span>Acciones</span>
            <button type="button" id="btn-export-table" class="inline-flex items-center justify-center w-7 h-7 rounded-lg text-brand hover:text-white hover:bg-brand active:bg-brand-active border border-brand/30 transition shadow-2xs cursor-pointer ml-1" title="Descargar / Exportar reporte de pagos">
              <i class="fa-solid fa-download text-xs"></i>
            </button>
          </div>
        `;
        lastTh.querySelector('#btn-export-table')?.addEventListener('click', (e) => {
          e.stopPropagation();
          openExportModal();
        });
      }
    }

    tableHolder.appendChild(dt);
  }

  // Carga de datos desde la API
  async function loadData() {
    state.loading = true;
    renderTable();

    try {
      const q = new URLSearchParams({
        filter: state.filter,
        search: state.search,
        beneficiario: state.headerBeneficiario,
        estado: state.headerEstado,
        semana: state.headerSemana,
        page: String(state.page),
        page_size: String(state.pageSize),
      });
      if (state.headerDia) {
        q.set('dia', state.headerDia);
      }

      const res = await apiFetch(`/api/pagos?${q.toString()}`);
      if (res) {
        state.data = Array.isArray(res.data) ? res.data : [];
        state.total = Number(res.total) || 0;

        if (res.filteredTotals) {
          state.filteredTotals = {
            montoTotal: Number(res.filteredTotals.montoTotal) || 0,
            montoPagado: Number(res.filteredTotals.montoPagado) || 0,
            saldo: Number(res.filteredTotals.saldo) || 0,
          };
        } else {
          let sumTotal = 0, sumPagado = 0, sumSaldo = 0;
          state.data.forEach((p) => {
            sumTotal += Number(p.montoTotal) || 0;
            sumPagado += Number(p.montoPagado) || 0;
            sumSaldo += Number(p.saldoPendiente) || 0;
          });
          state.filteredTotals = {
            montoTotal: sumTotal,
            montoPagado: sumPagado,
            saldo: sumSaldo,
          };
        }

        if (res.stats) {
          state.stats = {
            total: res.stats.total || 0,
            pendientes: res.stats.pendientes || 0,
            pagadosHoy: res.stats.pagadosHoy || 0,
            pagadosSemana: res.stats.pagadosSemana || 0,
            pagadosMes: res.stats.pagadosMes || 0,
            montoTotal: res.stats.montoTotal || 0,
            montoPendiente: res.stats.montoPendiente || 0,
            montoPagado: res.stats.montoPagado || 0,
            montoHoy: res.stats.montoHoy || 0,
            montoSemana: res.stats.montoSemana || 0,
            montoMes: res.stats.montoMes || 0,
            montoPagadoHoy: res.stats.montoPagadoHoy || 0,
            montoPagadoSemana: res.stats.montoPagadoSemana || 0,
            montoPagadoMes: res.stats.montoPagadoMes || 0,
          };
          renderStatsCards();
        }
      }
    } catch (err) {
      console.error('[Error cargando pagos]', err);
      toast.error('Error al cargar la lista de pagos.');
    } finally {
      state.loading = false;
      renderTable();
      renderMinimalBar();
      renderTotalsBar();
    }
  }

  // Pre-carga de catálogos para modales
  async function loadCatalogos() {
    try {
      const [provs, clis, prods, peds, usrs] = await Promise.all([
        apiFetch('/api/proveedores').catch(() => null),
        apiFetch('/api/clientes').catch(() => null),
        apiFetch('/api/productos').catch(() => null),
        apiFetch('/api/pedidos').catch(() => null),
        apiFetch('/api/users').catch(() => null),
      ]);

      if (provs && Array.isArray(provs.data)) state.catalogoProveedores = provs.data;
      if (clis && Array.isArray(clis.data)) state.catalogoClientes = clis.data;
      if (prods && Array.isArray(prods.data)) state.catalogoProductos = prods.data;
      if (peds && Array.isArray(peds.data)) state.catalogoPedidos = peds.data;
      if (usrs && Array.isArray(usrs.data)) state.catalogoColaboradores = usrs.data;
      else if (Array.isArray(usrs)) state.catalogoColaboradores = usrs;
    } catch (_) {}
  }

  // ==========================================================================
  // 5. MODAL: VISTA PREVIA DETALLADA DEL PAGO
  // ==========================================================================
  async function openDetallePagoModal(item) {
    let p = item;
    try {
      const fresh = await apiFetch(`/api/pagos/${item.id}`);
      if (fresh) p = fresh;
    } catch (_) {}

    const tipo = p.tipoBeneficiario || 'Proveedor';
    const isProv = tipo === 'Proveedor';
    const isColab = tipo === 'Colaborador';
    const isOtros = tipo === 'Otros';

    const benIcon = isProv
      ? 'fa-solid fa-truck-field'
      : isColab
      ? 'fa-solid fa-user-tie'
      : isOtros
      ? 'fa-solid fa-tags'
      : 'fa-solid fa-user';
    const benNombre = isProv || isColab || isOtros
      ? (p.proveedorNombre || p.referenciaPago || p.clienteNombre || '—')
      : (p.clienteNombre || p.proveedorNombre || '—');
    const benDoc = isProv || isColab || isOtros
      ? (p.proveedorRuc || 'No registrado')
      : (p.clienteDocumento || 'No registrado');

    const historialParciales = Array.isArray(p.historialParciales) ? p.historialParciales : [];

    const content = document.createElement('div');
    content.className = 'space-y-4 text-xs';

    content.innerHTML = `
      <!-- Encabezado de la ficha -->
      <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3">
        <div>
          <span class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Comprobante de Pago</span>
          <h3 class="text-base font-black text-brand font-mono">${escapeHtml(p.numeroPago)}</h3>
          <span class="text-[11px] text-slate-500">Fecha de Pago: <strong>${getNombreDiaSemana(p.fechaPago) ? `${getNombreDiaSemana(p.fechaPago)}, ` : ''}${formatDateDisplay(p.fechaPago)}</strong></span>
        </div>
        <div class="flex items-center gap-2">
          <span class="px-2.5 py-1 rounded-full text-xs font-bold font-mono bg-purple-100 text-brand dark:bg-purple-950/60 dark:text-brand">
            S${p.semanaIso || weekNum} (${p.anioIso || 2026})
          </span>
          <span class="px-2.5 py-1 rounded-full text-xs font-bold ${
            p.estadoPago === 'Pagado'
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
              : p.estadoPago === 'Pago Parcial'
              ? 'bg-purple-100 text-brand dark:bg-purple-950/60 dark:text-brand'
              : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
          }">
            ${escapeHtml(p.estadoPago)}
          </span>
        </div>
      </div>

      <!-- Cuadrícula de Información: Beneficiario y Producto -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- Beneficiario -->
        <div class="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
          <h4 class="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 pb-1 border-b border-slate-100 dark:border-slate-800">
            <i class="${benIcon} text-brand"></i>
            <span>Beneficiario (${escapeHtml(tipo)})</span>
          </h4>
          <p class="text-sm font-black text-slate-900 dark:text-white">${escapeHtml(benNombre)}</p>
          <div class="space-y-1 text-slate-600 dark:text-slate-300">
            ${isOtros && p.referenciaPago ? `<p><strong>Referencia de Pago:</strong> <span class="text-brand font-bold">${escapeHtml(p.referenciaPago)}</span></p>` : ''}
            <p><strong>Documento / RUC:</strong> ${escapeHtml(benDoc)}</p>
            ${!isProv && !isColab && !isOtros && p.clienteTelefono ? `<p><strong>Teléfono / WhatsApp:</strong> ${escapeHtml(p.clienteTelefono)}</p>` : ''}
            <p><strong>Registro:</strong> ${isProv && p.esProveedorTemporal ? '<span class="text-amber-500 font-semibold">Temporal / Manual</span>' : isOtros || isColab ? `<span class="text-brand font-semibold">${escapeHtml(tipo)}</span>` : '<span class="text-emerald-600 font-semibold">Registrado en Base de Datos</span>'}</p>
          </div>
        </div>

        <!-- Producto -->
        <div class="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
          <h4 class="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 pb-1 border-b border-slate-100 dark:border-slate-800">
            <i class="fa-solid fa-box text-brand"></i>
            <span>Producto / Concepto Suministrado</span>
          </h4>
          <p class="text-sm font-black text-slate-900 dark:text-white">${escapeHtml(p.productoNombre)}</p>
          <div class="space-y-1 text-slate-600 dark:text-slate-300">
            <p><strong>Cantidad:</strong> <span class="font-bold">${p.cantidad}</span></p>
            <p><strong>Costo Total Asignado:</strong> <span class="font-mono font-bold text-brand">${formatGuaranies(p.montoTotal)}</span></p>
            <p><strong>Tipo de Ítem:</strong> ${p.esProductoTemporal ? '<span class="text-amber-500 font-semibold">Temporal / Manual</span>' : '<span class="text-emerald-600 font-semibold">Catálogo Oficial</span>'}</p>
          </div>
        </div>
      </div>

      ${
        historialParciales.length > 0
          ? `
        <!-- Historial de Pagos Parciales con Fechas y Semanas -->
        <div class="p-4 rounded-xl border border-brand/30 bg-purple-50/40 dark:bg-purple-950/20 space-y-2.5">
          <h4 class="text-xs font-bold uppercase tracking-wider text-brand flex items-center gap-1.5 pb-1 border-b border-brand/20">
            <i class="fa-solid fa-calendar-week"></i>
            <span>Registro de Pagos Parciales (Fechas y Semanas Asignadas)</span>
          </h4>
          <div class="space-y-1.5">
            ${historialParciales
              .map(
                (hp, idx) => `
              <div class="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                <div class="flex items-center gap-2">
                  <span class="w-5 h-5 rounded-full bg-brand text-white text-[10px] font-bold flex items-center justify-center">#${idx + 1}</span>
                  <div>
                    <p class="font-bold text-slate-800 dark:text-slate-100">Fecha de Pago: ${formatDateDisplay(hp.fechaPago)}</p>
                    <p class="text-[10px] text-slate-500">${escapeHtml(hp.metodoPago || p.metodoPago || 'Efectivo')}${hp.notas ? ` · ${escapeHtml(hp.notas)}` : ''}</p>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-100 text-brand dark:bg-brand/20 dark:text-brand">
                    Semana ${hp.semanaIso || p.semanaIso} (${hp.anioIso || p.anioIso || 2026})
                  </span>
                  <span class="font-mono font-black text-emerald-600 dark:text-emerald-400 text-xs">${formatGuaranies(hp.monto)}</span>
                </div>
              </div>
            `
              )
              .join('')}
          </div>
        </div>
      `
          : ''
      }

      ${
        p.esRecurrente
          ? `
        <!-- Información de Pago Recurrente Programado -->
        <div class="p-4 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/20 space-y-2">
          <h4 class="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5 pb-1 border-b border-indigo-200/80 dark:border-indigo-800/80">
            <i class="fa-solid fa-arrows-rotate text-indigo-600 dark:text-indigo-400"></i>
            <span>Pago Recurrente / Programado</span>
          </h4>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-slate-700 dark:text-slate-200">
            <div>
              <p class="text-[10px] text-slate-500 uppercase font-bold">Frecuencia</p>
              <p class="text-xs font-bold text-indigo-600 dark:text-indigo-400">${escapeHtml(p.recurrenciaFrecuencia || 'Recurrente')}</p>
            </div>
            <div>
              <p class="text-[10px] text-slate-500 uppercase font-bold">Modalidad de Fecha</p>
              <p class="text-xs font-bold">${p.recurrenciaTipoDia === 'cierre_mes' ? 'Cierre de mes (Último día)' : p.recurrenciaTipoDia === 'inicio_mes' ? 'Inicio de mes (Día 1)' : 'Semana ISO (Inicia lunes y termina domingo)'}</p>
            </div>
            <div>
              <p class="text-[10px] text-slate-500 uppercase font-bold">Periodo Programado</p>
              <p class="text-xs font-mono font-bold">${formatDateDisplay(p.recurrenciaFechaInicio)} → ${formatDateDisplay(p.recurrenciaFechaFin)}</p>
            </div>
          </div>
          ${p.recurrenciaGrupoId ? `<p class="text-[10px] text-slate-400 font-mono">ID de Grupo Recurrente: ${escapeHtml(p.recurrenciaGrupoId)}</p>` : ''}
        </div>
      `
          : ''
      }

      <!-- Destinado a: Cliente y Pedido -->
      <div class="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-purple-50/30 dark:bg-purple-950/20 space-y-2">
        <h4 class="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5 pb-1 border-b border-brand/20">
          <i class="fa-solid fa-people-arrows text-brand"></i>
          <span>Destino del Producto / Pedido Asociado</span>
        </h4>
        ${
          p.numeroPedido || p.clienteNombre
            ? `
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-700 dark:text-slate-200">
            <div>
              <p class="text-[11px] text-slate-500">Pedido Vinculado:</p>
              <p class="text-sm font-mono font-bold text-brand">${escapeHtml(p.numeroPedido || 'Asignado directamente')}</p>
            </div>
            <div>
              <p class="text-[11px] text-slate-500">Cliente a quien se destinó el producto:</p>
              <p class="text-sm font-bold">${escapeHtml(p.clienteNombre || 'No especificado')}</p>
              ${p.clienteTelefono ? `<p class="text-[11px] text-slate-500">Tel: ${escapeHtml(p.clienteTelefono)}</p>` : ''}
              ${p.clienteDocumento ? `<p class="text-[11px] text-slate-500">Doc: ${escapeHtml(p.clienteDocumento)}</p>` : ''}
            </div>
          </div>
        `
            : `
          <p class="text-slate-500 italic">Este pago fue generado como una compra directa o gasto general de insumos, sin asignación a un pedido de cliente específico.</p>
        `
        }
      </div>

      <!-- Resumen Financiero -->
      <div class="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
        <h4 class="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 pb-1 border-b border-slate-100 dark:border-slate-800">
          <i class="fa-solid fa-coins text-brand"></i>
          <span>Detalle de Valores y Saldos</span>
        </h4>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
            <span class="text-[10px] uppercase font-bold text-slate-400">Monto Total</span>
            <p class="text-sm font-black font-mono text-slate-900 dark:text-white mt-0.5">${formatGuaranies(p.montoTotal)}</p>
          </div>
          <div class="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30">
            <span class="text-[10px] uppercase font-bold text-emerald-600">Abonado / Pagado</span>
            <p class="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">${formatGuaranies(p.montoPagado)}</p>
          </div>
          <div class="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30">
            <span class="text-[10px] uppercase font-bold text-danger">Saldo Pendiente</span>
            <p class="text-sm font-black font-mono text-danger mt-0.5">${formatGuaranies(p.saldoPendiente)}</p>
          </div>
          <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
            <span class="text-[10px] uppercase font-bold text-slate-400">Método de Pago</span>
            <p class="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1">${escapeHtml(p.metodoPago || 'Efectivo')}</p>
          </div>
        </div>
      </div>

      <!-- Notas -->
      ${
        p.notas
          ? `
        <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
          <span class="text-[10px] uppercase font-bold text-slate-400 block mb-1">Notas / Observaciones</span>
          <p class="text-xs whitespace-pre-wrap">${escapeHtml(p.notas)}</p>
        </div>
      `
          : ''
      }
    `;

    openModal({
      title: `Detalle del Pago — ${p.numeroPago}`,
      content: content,
      size: 'lg',
      cancelText: 'Cerrar',
      hideFooter: false,
      confirmText: 'Aceptar',
      confirmVariant: 'primary',
      onConfirm: ({ close }) => {
        if (typeof close === 'function') close();
      },
    });
  }

  // ==========================================================================
  // 6. MODAL: GENERAR NUEVO PAGO / CREAR PAGO
  // ==========================================================================
  function openCrearPagoModal() {
    let tipoBeneficiario = 'Proveedor';
    let isProvTemporal = false;
    let selectedProv = null;
    let isProdTemporal = false;
    let selectedProd = null;
    let estadoPago = 'Pendiente';

    const todayStr = getTodayISODate();
    const initialIso = getISOWeekAndYearFromStr(todayStr);

    const content = document.createElement('div');
    content.className = 'space-y-4 text-xs';

    content.innerHTML = `
      <!-- 1. Tipo de Beneficiario -->
      <div>
        <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Tipo de Beneficiario</label>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button type="button" id="btn-tipo-prov" class="py-2.5 px-3 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-2 bg-brand text-white border-brand shadow-xs">
            <i class="fa-solid fa-truck-field"></i>
            <span>Proveedor</span>
          </button>
          <button type="button" id="btn-tipo-colab" class="py-2.5 px-3 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            <i class="fa-solid fa-user-tie"></i>
            <span>Colaborador</span>
          </button>
          <button type="button" id="btn-tipo-otros" class="py-2.5 px-3 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            <i class="fa-solid fa-tags"></i>
            <span>Otros</span>
          </button>
        </div>
      </div>

      <!-- 2. Contenedor Dinámico de Beneficiario -->
      <div id="beneficiario-box" class="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3"></div>

      <!-- 3. Contenedor Dinámico de Producto -->
      <div id="producto-box" class="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3"></div>

      <!-- 4. Cantidad, Monto Total y Estado de Pago -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
        <div>
          <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Cantidad</label>
          <div id="counter-holder"></div>
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Monto Total / Costo (Gs.) *</label>
          <input type="text" id="pago-monto-total" value="0 Gs."
            class="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-bold focus:outline-none focus:ring-2 focus:ring-brand" />
        </div>
      </div>

      <!-- Selector de Estado de Pago -->
      <div>
        <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Estado del Pago</label>
        <div class="grid grid-cols-3 gap-2">
          <button type="button" data-estado="Pendiente" class="modal-estado-btn py-2 px-2.5 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 bg-amber-500 text-white border-amber-500 shadow-xs">
            <i class="fa-solid fa-clock text-[11px]"></i>
            <span>Pendiente</span>
          </button>
          <button type="button" data-estado="Pagado" class="modal-estado-btn py-2 px-2.5 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            <i class="fa-solid fa-check text-[11px]"></i>
            <span>Pagado</span>
          </button>
          <button type="button" data-estado="Pago Parcial" class="modal-estado-btn py-2 px-2.5 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            <i class="fa-solid fa-circle-half-stroke text-[11px]"></i>
            <span>Pago Parcial</span>
          </button>
        </div>
      </div>

      <!-- Cuadro dinámico de Pago Parcial (con Fecha y Semana del Pago Parcial) -->
      <div id="modal-partial-box" class="p-4 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-brand/30 space-y-3 hidden">
        <div class="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-brand/20">
          <div class="flex items-center gap-1.5 text-brand font-bold">
            <i class="fa-solid fa-calendar-check"></i>
            <span>Detalle del Pago Parcial (Fecha y Semana Asignada)</span>
          </div>
          <span id="modal-semana-parcial-badge" class="px-2.5 py-1 rounded-full text-xs font-mono font-black bg-brand text-white shadow-2xs">
            Semana ${initialIso.week} (${initialIso.year})
          </span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
          <div>
            <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Monto Abonado / Pagado (Gs.) *</label>
            <input type="text" id="modal-monto-pagado" value="0 Gs."
              class="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-bold focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Fecha del Pago Parcial *</label>
            <input type="date" id="modal-fecha-parcial" value="${todayStr}"
              class="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <div class="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex flex-col justify-center">
            <span class="text-[10px] uppercase font-bold text-slate-500">Saldo Pendiente Calculado</span>
            <span id="modal-saldo-calc" class="text-sm font-mono font-black text-danger">0 Gs.</span>
          </div>
        </div>
        <p class="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
          <i class="fa-solid fa-circle-info text-brand"></i>
          <span>El pago parcial tomará automáticamente la fecha seleccionada y se asignará a la semana correspondiente.</span>
        </p>
      </div>

      <!-- Sección de Pago Recurrente / Programado -->
      <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
        <div class="flex items-center justify-between gap-3" id="recurrente-toggle-holder">
          <div>
            <span class="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <i class="fa-solid fa-arrows-rotate text-brand"></i>
              <span>¿Es un Pago Recurrente / Programado?</span>
            </span>
            <p class="text-[11px] text-slate-400">Permite generar pagos periódicos automáticos (diarios, semanales, mensuales o trimestrales) en un rango de fechas para cualquier beneficiario.</p>
          </div>
        </div>

        <div id="recurrente-config-box" class="space-y-3.5 pt-2 border-t border-slate-200 dark:border-slate-700 hidden">
          <!-- 1. Frecuencia -->
          <div>
            <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Frecuencia de Recurrencia</label>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button type="button" data-frec="Diario" class="btn-rec-frec py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer flex flex-col items-center gap-1 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                <i class="fa-solid fa-calendar-day text-sm"></i>
                <span>Diario</span>
              </button>
              <button type="button" data-frec="Semanal" class="btn-rec-frec py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer flex flex-col items-center gap-1 bg-brand text-white border-brand shadow-xs">
                <i class="fa-solid fa-calendar-week text-sm"></i>
                <span>Semanal</span>
                <span class="text-[9px] font-normal opacity-90">Inicia lunes</span>
              </button>
              <button type="button" data-frec="Mensual" class="btn-rec-frec py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer flex flex-col items-center gap-1 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                <i class="fa-solid fa-calendar text-sm"></i>
                <span>Mensual</span>
              </button>
              <button type="button" data-frec="Trimestral" class="btn-rec-frec py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer flex flex-col items-center gap-1 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                <i class="fa-solid fa-calendar-days text-sm"></i>
                <span>Trimestral</span>
              </button>
            </div>
          </div>

          <!-- 2. Modalidad de aplicación (Solo para Mensual o Trimestral: Cierre de mes vs Inicio de mes) -->
          <div id="rec-mes-modalidad-box" class="p-3 rounded-xl bg-purple-50/60 dark:bg-purple-950/30 border border-brand/20 space-y-2 hidden">
            <label class="block text-xs font-bold text-slate-700 dark:text-slate-300">
              ¿En qué momento del periodo se registrará el pago?
            </label>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button type="button" id="btn-rec-inicio-mes" class="btn-rec-tipo-dia py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                <i class="fa-solid fa-calendar-plus"></i>
                <span>Inicio de Mes (Día 1)</span>
              </button>
              <button type="button" id="btn-rec-cierre-mes" class="btn-rec-tipo-dia py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-2 bg-brand text-white border-brand shadow-xs">
                <i class="fa-solid fa-calendar-check"></i>
                <span>Cierre de Mes (Último Día)</span>
              </button>
            </div>
          </div>

          <!-- 3. Rango de Fechas (De qué fecha a qué fecha) -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Fecha de Inicio *</label>
              <input type="date" id="rec-fecha-inicio" value="${getMondayOfDateStr(todayStr)}"
                class="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand font-semibold" />
              <p id="rec-fecha-inicio-hint" class="text-[10px] text-brand font-medium mt-1">Inicia automáticamente en lunes</p>
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Fecha de Fin *</label>
              <input type="date" id="rec-fecha-fin" value="${addWeeksToDateStr(getMondayOfDateStr(todayStr), 4)}"
                class="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand font-semibold" />
              <p id="rec-fecha-fin-hint" class="text-[10px] text-slate-400 mt-1">Límite del ciclo recurrente</p>
            </div>
          </div>

          <!-- 4. Vista Previa de Pagos Recurrentes a Generarse -->
          <div id="rec-preview-box" class="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
            <div class="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
              <span class="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                <i class="fa-solid fa-list-check text-brand"></i>
                <span>Proyección de Cuotas / Pagos a Generar</span>
              </span>
              <span id="rec-preview-counter" class="text-xs font-mono font-black text-brand bg-purple-50 dark:bg-brand/20 px-2 py-0.5 rounded-md">
                0 cuotas
              </span>
            </div>
            <div id="rec-preview-list" class="max-h-36 overflow-y-auto space-y-1 pr-1 text-[11px]"></div>
            <div id="rec-preview-total" class="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-100">
              <span class="text-slate-500">Monto Total Proyectado:</span>
              <span id="rec-preview-total-val" class="font-mono text-brand font-black text-sm">0 Gs.</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Método de Pago y Fecha -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Método de Pago</label>
          <select id="pago-metodo" class="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand">
            <option value="Efectivo">Efectivo</option>
            <option value="Transferencia Bancaria">Transferencia Bancaria</option>
            <option value="Cheque">Cheque</option>
            <option value="Tarjeta de Débito">Tarjeta de Débito</option>
            <option value="Tarjeta de Crédito">Tarjeta de Crédito</option>
            <option value="Giro Móvil">Giro Móvil</option>
            <option value="Otro">Otro</option>
          </select>
        </div>
        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="block text-xs font-bold text-slate-700 dark:text-slate-300">Fecha del Pago</label>
            <span id="pago-fecha-semana-hint" class="text-[10px] font-mono font-bold text-brand">Semana ${initialIso.week} (${initialIso.year})</span>
          </div>
          <input type="date" id="pago-fecha" value="${todayStr}"
            class="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand" />
        </div>
      </div>

      <!-- Destinado a Pedido / Cliente (Opcional) -->
      <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-2">
        <label class="block text-xs font-bold text-slate-700 dark:text-slate-300">
          Vincular a Pedido / Cliente Destino (Opcional)
        </label>
        <select id="pago-pedido-select" class="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand">
          <option value="">-- Sin pedido asociado (Compra directa) --</option>
          ${state.catalogoPedidos.map((ped) => `
            <option value="${ped.id}">${escapeHtml(ped.numeroPedido)} — Cliente: ${escapeHtml(ped.clienteNombre)} (${formatGuaranies(ped.montoTotal)})</option>
          `).join('')}
        </select>
      </div>

      <!-- Notas -->
      <div>
        <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Notas / Observaciones</label>
        <textarea id="pago-notas" rows="2" placeholder="Detalles de la compra, factura N°, entrega de insumos..."
          class="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand"></textarea>
      </div>
    `;

    // Cálculos de montos, inputs y referencias principales
    let unitCost = 0;
    const totalInp = content.querySelector('#pago-monto-total');
    const montoPagadoInp = content.querySelector('#modal-monto-pagado');
    const fechaParcialInp = content.querySelector('#modal-fecha-parcial');
    const semanaParcialBadge = content.querySelector('#modal-semana-parcial-badge');
    const pagoFechaInp = content.querySelector('#pago-fecha');
    const pagoFechaHint = content.querySelector('#pago-fecha-semana-hint');
    const saldoCalcEl = content.querySelector('#modal-saldo-calc');
    const partialBox = content.querySelector('#modal-partial-box');

    // Contador numérico estandarizado según AGENTS.md
    const counter = createQuantityCounter({
      value: 1,
      min: 1,
      onChange: (newQty) => {
        if (unitCost > 0) {
          totalInp.value = formatGuaranies(Math.round(unitCost * newQty));
        } else {
          const curTot = parseGuaranies(totalInp.value);
          if (curTot > 0) {
            unitCost = curTot;
            totalInp.value = formatGuaranies(Math.round(unitCost * newQty));
          }
        }
        updateMath();
      },
    });
    content.querySelector('#counter-holder').appendChild(counter.element);

    const btnTipoProv = content.querySelector('#btn-tipo-prov');
    const btnTipoColab = content.querySelector('#btn-tipo-colab');
    const btnTipoOtros = content.querySelector('#btn-tipo-otros');
    const benBox = content.querySelector('#beneficiario-box');
    const prodBox = content.querySelector('#producto-box');

    function updateTipoButtonsStyle() {
      const activeClass = 'py-2.5 px-3 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-2 bg-brand text-white border-brand shadow-xs';
      const inactiveClass = 'py-2.5 px-3 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300';
      btnTipoProv.className = tipoBeneficiario === 'Proveedor' ? activeClass : inactiveClass;
      btnTipoColab.className = tipoBeneficiario === 'Colaborador' ? activeClass : inactiveClass;
      btnTipoOtros.className = tipoBeneficiario === 'Otros' ? activeClass : inactiveClass;
    }

    function renderBeneficiarioUI() {
      benBox.innerHTML = '';
      if (tipoBeneficiario === 'Proveedor') {
        const topRow = document.createElement('div');
        topRow.className = 'flex items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-700';
        topRow.innerHTML = `<span class="text-xs font-bold text-slate-800 dark:text-slate-100">Datos del Proveedor</span>`;

        const provToggle = createIOSToggle({
          label: 'Proveedor temporal / no registrado',
          checked: isProvTemporal,
          activeColor: 'emerald',
          onChange: (chk) => {
            isProvTemporal = chk;
            selectedProv = null;
            renderBeneficiarioUI();
          },
        });
        topRow.appendChild(provToggle.element);
        benBox.appendChild(topRow);

        if (!isProvTemporal) {
          const wrap = document.createElement('div');
          wrap.className = 'relative';
          wrap.innerHTML = `
            <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Buscar Proveedor Registrado *</label>
            <div class="relative">
              <i class="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
              <input type="text" id="modal-prov-search" value="${selectedProv ? escapeHtml(selectedProv.razonSocial) : ''}"
                placeholder="Escriba nombre o RUC del proveedor..."
                class="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
            <div id="modal-prov-sug" class="absolute left-0 right-0 top-full mt-1 max-h-48 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-30 hidden"></div>
          `;

          const inp = wrap.querySelector('#modal-prov-search');
          const sug = wrap.querySelector('#modal-prov-sug');

          function renderSug(q) {
            const clean = q.toLowerCase().trim();
            const filtered = state.catalogoProveedores.filter((pv) => {
              const nom = (pv.razonSocial || pv.nombreComercial || '').toLowerCase();
              const ruc = (pv.rucDocumento || '').toLowerCase();
              return nom.includes(clean) || ruc.includes(clean);
            });
            sug.innerHTML = '';
            if (filtered.length === 0) {
              sug.innerHTML = '<div class="p-3 text-xs text-slate-400 text-center">No se encontraron proveedores.</div>';
              sug.classList.remove('hidden');
              return;
            }
            filtered.slice(0, 6).forEach((pv) => {
              const r = document.createElement('div');
              r.className = 'px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer border-b border-slate-100 dark:border-slate-700/50 last:border-b-0 text-xs';
              r.innerHTML = `
                <p class="font-bold text-slate-800 dark:text-slate-100">${escapeHtml(pv.razonSocial)}</p>
                <p class="text-[10px] text-slate-400">${escapeHtml(pv.rucDocumento || '')}</p>
              `;
              r.addEventListener('click', () => {
                selectedProv = pv;
                inp.value = pv.razonSocial;
                sug.classList.add('hidden');
              });
              sug.appendChild(r);
            });
            sug.classList.remove('hidden');
          }

          inp.addEventListener('focus', () => renderSug(inp.value));
          inp.addEventListener('input', (e) => {
            renderSug(e.target.value);
            if (selectedProv) selectedProv.razonSocial = e.target.value;
          });
          document.addEventListener('click', (e) => {
            if (!wrap.contains(e.target)) sug.classList.add('hidden');
          }, { capture: true });

          benBox.appendChild(wrap);
        } else {
          const fields = document.createElement('div');
          fields.className = 'grid grid-cols-1 sm:grid-cols-2 gap-3';
          fields.innerHTML = `
            <div>
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Nombre del Proveedor Temporal *</label>
              <input type="text" id="modal-prov-temp-name" placeholder="Ej. Fábrica de Remeras Central"
                class="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">RUC del Proveedor (Opcional)</label>
              <input type="text" id="modal-prov-temp-ruc" placeholder="Ej. 80012345-6"
                class="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
          `;
          benBox.appendChild(fields);
        }
      } else if (tipoBeneficiario === 'Colaborador') {
        benBox.innerHTML = `
          <div class="flex items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-700">
            <span class="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <i class="fa-solid fa-user-tie text-brand"></i>
              <span>Datos del Colaborador</span>
            </span>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="relative">
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Seleccionar o Escribir Colaborador *</label>
              <div class="relative">
                <i class="fa-solid fa-user-tie absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                <input type="text" id="modal-colab-input" placeholder="Nombre del colaborador..."
                  class="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand" />
              </div>
              <div id="modal-colab-sug" class="absolute left-0 right-0 top-full mt-1 max-h-40 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-30 hidden"></div>
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Documento / CI o Cargo (Opcional)</label>
              <input type="text" id="modal-colab-doc" placeholder="Ej. CI 4.567.890 o Producción / Diseño"
                class="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
          </div>
        `;

        const inp = benBox.querySelector('#modal-colab-input');
        const docInp = benBox.querySelector('#modal-colab-doc');
        const sug = benBox.querySelector('#modal-colab-sug');

        function renderColabSug(q) {
          const clean = q.toLowerCase().trim();
          const list = Array.isArray(state.catalogoColaboradores) ? state.catalogoColaboradores : [];
          const filtered = list.filter((u) => {
            const nom = (u.nombre || u.name || u.username || u.email || '').toLowerCase();
            return !clean || nom.includes(clean);
          });
          sug.innerHTML = '';
          if (filtered.length > 0) {
            filtered.slice(0, 6).forEach((u) => {
              const r = document.createElement('div');
              r.className = 'px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer text-xs border-b border-slate-100 dark:border-slate-700/50 last:border-b-0';
              const nom = u.nombre || u.name || u.username || u.email || '';
              const rol = u.rol || u.role || '';
              r.innerHTML = `<span class="font-bold text-slate-800 dark:text-slate-100">${escapeHtml(nom)}</span> ${rol ? `<span class="text-slate-400 text-[10px]">(${escapeHtml(rol)})</span>` : ''}`;
              r.addEventListener('click', () => {
                inp.value = nom;
                if (rol && docInp && !docInp.value) docInp.value = rol;
                sug.classList.add('hidden');
              });
              sug.appendChild(r);
            });
            sug.classList.remove('hidden');
          } else {
            sug.classList.add('hidden');
          }
        }

        inp.addEventListener('focus', () => renderColabSug(inp.value));
        inp.addEventListener('input', (e) => renderColabSug(e.target.value));
        document.addEventListener('click', (e) => {
          if (!benBox.contains(e.target)) sug.classList.add('hidden');
        }, { capture: true });
      } else if (tipoBeneficiario === 'Otros') {
        benBox.innerHTML = `
          <div class="flex items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-700">
            <span class="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <i class="fa-solid fa-tags text-brand"></i>
              <span>Especificación de Opción de Pago (Otros)</span>
            </span>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">¿A qué hace referencia la opción de Pago? *</label>
              <div class="relative">
                <i class="fa-solid fa-pen-clip absolute left-3.5 top-1/2 -translate-y-1/2 text-brand text-xs"></i>
                <input type="text" id="modal-otros-referencia" placeholder="Escriba a qué hace referencia el pago (Ej. Alquiler, ANDE, Flete, Servicios...)"
                  class="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand" />
              </div>
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Beneficiario / Entidad o Documento (Opcional)</label>
              <input type="text" id="modal-otros-beneficiario" placeholder="Ej. Nombre de entidad, persona o RUC"
                class="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
          </div>
        `;

        // Sincronizar con el concepto/producto temporal si está vacío
        const refInp = benBox.querySelector('#modal-otros-referencia');
        refInp?.addEventListener('input', () => {
          const tempProdInp = content.querySelector('#modal-prod-temp-name');
          if (tempProdInp && (!tempProdInp.dataset.userEdited || !tempProdInp.value.trim())) {
            tempProdInp.value = refInp.value;
          }
        });
      }
    }

    btnTipoProv.addEventListener('click', () => {
      tipoBeneficiario = 'Proveedor';
      updateTipoButtonsStyle();
      renderBeneficiarioUI();
    });

    btnTipoColab.addEventListener('click', () => {
      tipoBeneficiario = 'Colaborador';
      updateTipoButtonsStyle();
      if (!isProdTemporal) {
        isProdTemporal = true;
        selectedProd = null;
        renderProductoUI();
      }
      renderBeneficiarioUI();
    });

    btnTipoOtros.addEventListener('click', () => {
      tipoBeneficiario = 'Otros';
      updateTipoButtonsStyle();
      if (!isProdTemporal) {
        isProdTemporal = true;
        selectedProd = null;
        renderProductoUI();
      }
      renderBeneficiarioUI();
    });

    renderBeneficiarioUI();

    // UI de Producto (Catálogo o Temporal)
    function renderProductoUI() {
      prodBox.innerHTML = '';
      const topRow = document.createElement('div');
      topRow.className = 'flex items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-700';
      topRow.innerHTML = `<span class="text-xs font-bold text-slate-800 dark:text-slate-100">Producto, Insumo o Concepto</span>`;

      const prodToggle = createIOSToggle({
        label: 'Producto / concepto temporal o manual',
        checked: isProdTemporal,
        activeColor: 'emerald',
        onChange: (chk) => {
          isProdTemporal = chk;
          selectedProd = null;
          renderProductoUI();
        },
      });
      topRow.appendChild(prodToggle.element);
      prodBox.appendChild(topRow);

      if (!isProdTemporal) {
        const wrap = document.createElement('div');
        wrap.className = 'relative';
        wrap.innerHTML = `
          <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Buscar Producto en Catálogo *</label>
          <div class="relative">
            <i class="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
            <input type="text" id="modal-prod-search" value="${selectedProd ? escapeHtml(selectedProd.nombre) : ''}"
              placeholder="Buscar producto por nombre o SKU..."
              class="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <div id="modal-prod-sug" class="absolute left-0 right-0 top-full mt-1 max-h-48 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-30 hidden"></div>
        `;

        const inp = wrap.querySelector('#modal-prod-search');
        const sug = wrap.querySelector('#modal-prod-sug');

        function renderProdSug(q) {
          const clean = q.toLowerCase().trim();
          const filtered = state.catalogoProductos.filter((p) => {
            const nom = (p.nombre || '').toLowerCase();
            const sku = (p.sku || '').toLowerCase();
            return nom.includes(clean) || sku.includes(clean);
          });
          sug.innerHTML = '';
          if (filtered.length === 0) {
            sug.innerHTML = '<div class="p-3 text-xs text-slate-400 text-center">No se encontraron productos.</div>';
            sug.classList.remove('hidden');
            return;
          }
          filtered.slice(0, 6).forEach((p) => {
            const r = document.createElement('div');
            r.className = 'px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer border-b border-slate-100 dark:border-slate-700/50 last:border-b-0 text-xs';
            r.innerHTML = `
              <p class="font-bold text-slate-800 dark:text-slate-100">${escapeHtml(p.nombre)}</p>
              <p class="text-[10px] text-slate-400 font-mono">${escapeHtml(p.sku || '')} · Costo Ref: ${formatGuaranies(p.costoCompra || 0)}</p>
            `;
            r.addEventListener('click', () => {
              selectedProd = p;
              inp.value = p.nombre;
              sug.classList.add('hidden');
              if (p.costoCompra != null && Number(p.costoCompra) > 0) {
                unitCost = Number(p.costoCompra);
                const qty = Math.max(1, counter.getValue());
                totalInp.value = formatGuaranies(Math.round(unitCost * qty));
                updateMath();
              }
            });
            sug.appendChild(r);
          });
          sug.classList.remove('hidden');
        }

        inp.addEventListener('focus', () => renderProdSug(inp.value));
        inp.addEventListener('input', (e) => {
          renderProdSug(e.target.value);
          if (selectedProd) selectedProd.nombre = e.target.value;
        });
        document.addEventListener('click', (e) => {
          if (!wrap.contains(e.target)) sug.classList.add('hidden');
        }, { capture: true });

        prodBox.appendChild(wrap);
      } else {
        const wrap = document.createElement('div');
        wrap.innerHTML = `
          <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Nombre del Producto / Insumo o Concepto *</label>
          <input type="text" id="modal-prod-temp-name" placeholder="Ej. Tinta para sublimación negra 1L, Pago de quincena, Servicio..."
            class="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand" />
        `;
        const tempInp = wrap.querySelector('#modal-prod-temp-name');
        tempInp?.addEventListener('input', () => {
          tempInp.dataset.userEdited = 'true';
        });
        prodBox.appendChild(wrap);
      }
    }
    renderProductoUI();

    // Sincronización de fecha y semana de Pago Parcial

    function syncPartialDateBadge(dateStr) {
      const iso = getISOWeekAndYearFromStr(dateStr);
      if (semanaParcialBadge) {
        semanaParcialBadge.textContent = `Semana ${iso.week} (${iso.year})`;
      }
      if (pagoFechaHint) {
        pagoFechaHint.textContent = `Semana ${iso.week} (${iso.year})`;
      }
    }

    fechaParcialInp?.addEventListener('change', (e) => {
      const val = e.target.value || getTodayISODate();
      if (pagoFechaInp) pagoFechaInp.value = val;
      syncPartialDateBadge(val);
    });

    pagoFechaInp?.addEventListener('change', (e) => {
      const val = e.target.value || getTodayISODate();
      if (fechaParcialInp) fechaParcialInp.value = val;
      syncPartialDateBadge(val);
    });

    // Recurrencia / Pagos Programados
    let isRecurrente = false;
    let recFrecuencia = 'Semanal';
    let recTipoDia = 'cierre_mes';
    let currentRecPreviewDates = [];

    const recToggleHolder = content.querySelector('#recurrente-toggle-holder');
    const recConfigBox = content.querySelector('#recurrente-config-box');
    const recMesModalidadBox = content.querySelector('#rec-mes-modalidad-box');
    const recFechaInicioInp = content.querySelector('#rec-fecha-inicio');
    const recFechaFinInp = content.querySelector('#rec-fecha-fin');
    const recFechaInicioHint = content.querySelector('#rec-fecha-inicio-hint');
    const recPreviewList = content.querySelector('#rec-preview-list');
    const recPreviewCounter = content.querySelector('#rec-preview-counter');
    const recPreviewTotalVal = content.querySelector('#rec-preview-total-val');
    const btnRecInicioMes = content.querySelector('#btn-rec-inicio-mes');
    const btnRecCierreMes = content.querySelector('#btn-rec-cierre-mes');

    function updateRecFrecButtons() {
      content.querySelectorAll('.btn-rec-frec').forEach((b) => {
        const f = b.dataset.frec;
        if (f === recFrecuencia) {
          b.className = 'btn-rec-frec py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer flex flex-col items-center gap-1 bg-brand text-white border-brand shadow-xs';
        } else {
          b.className = 'btn-rec-frec py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer flex flex-col items-center gap-1 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300';
        }
      });
    }

    function updateRecTipoDiaButtons() {
      const activeClass = 'btn-rec-tipo-dia py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-2 bg-brand text-white border-brand shadow-xs';
      const inactiveClass = 'btn-rec-tipo-dia py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300';
      if (btnRecInicioMes && btnRecCierreMes) {
        btnRecInicioMes.className = recTipoDia === 'inicio_mes' ? activeClass : inactiveClass;
        btnRecCierreMes.className = recTipoDia === 'cierre_mes' ? activeClass : inactiveClass;
      }
    }

    function syncRecurrenceUI() {
      updateRecFrecButtons();
      updateRecTipoDiaButtons();

      if (recFrecuencia === 'Mensual' || recFrecuencia === 'Trimestral') {
        recMesModalidadBox?.classList.remove('hidden');
        if (recTipoDia === 'cierre_mes') {
          if (recFechaInicioInp) {
            recFechaInicioInp.value = getEndOfMonthDateStr(recFechaInicioInp.value || todayStr);
          }
          if (recFechaInicioHint) {
            recFechaInicioHint.textContent = `Aplica al cierre de mes (${recFrecuencia.toLowerCase()})`;
            recFechaInicioHint.className = 'text-[10px] text-brand font-medium mt-1';
          }
        } else {
          if (recFechaInicioInp) {
            recFechaInicioInp.value = getStartOfMonthDateStr(recFechaInicioInp.value || todayStr);
          }
          if (recFechaInicioHint) {
            recFechaInicioHint.textContent = `Aplica al inicio de mes (día 1) (${recFrecuencia.toLowerCase()})`;
            recFechaInicioHint.className = 'text-[10px] text-brand font-medium mt-1';
          }
        }
        const monthsToAdd = recFrecuencia === 'Trimestral' ? 6 : 3;
        if (recFechaFinInp && recFechaInicioInp) {
          recFechaFinInp.value = addMonthsToDateStr(recFechaInicioInp.value, monthsToAdd);
        }
      } else if (recFrecuencia === 'Semanal') {
        recMesModalidadBox?.classList.add('hidden');
        if (recFechaInicioInp) {
          recFechaInicioInp.value = getMondayOfDateStr(recFechaInicioInp.value || todayStr);
        }
        if (recFechaFinInp && recFechaInicioInp) {
          recFechaFinInp.value = addWeeksToDateStr(recFechaInicioInp.value, 4);
        }
        if (recFechaInicioHint) {
          recFechaInicioHint.textContent = 'Inicia automáticamente en lunes';
          recFechaInicioHint.className = 'text-[10px] text-brand font-medium mt-1';
        }
      } else {
        // Diario
        recMesModalidadBox?.classList.add('hidden');
        if (recFechaInicioHint) {
          recFechaInicioHint.textContent = 'Genera un pago por cada día en el rango';
          recFechaInicioHint.className = 'text-[10px] text-slate-400 mt-1';
        }
      }

      updateRecurrencePreview();
    }

    function updateRecurrencePreview() {
      if (!isRecurrente || !recPreviewList) return;
      const fIni = recFechaInicioInp ? recFechaInicioInp.value : '';
      const fFin = recFechaFinInp ? recFechaFinInp.value : '';
      currentRecPreviewDates = calculateRecurringDatesPreview(recFrecuencia, recTipoDia, fIni, fFin);

      const cuotasCount = currentRecPreviewDates.length;
      if (recPreviewCounter) {
        recPreviewCounter.textContent = `${cuotasCount} cuota${cuotasCount === 1 ? '' : 's'}`;
      }

      const totalUnit = parseGuaranies(totalInp.value);
      const totalProyectado = totalUnit * cuotasCount;
      if (recPreviewTotalVal) {
        recPreviewTotalVal.textContent = formatGuaranies(totalProyectado);
      }

      recPreviewList.innerHTML = '';
      if (cuotasCount === 0) {
        recPreviewList.innerHTML = '<p class="text-slate-400 italic text-center py-2">No se proyectaron pagos. Ajuste el rango de fechas.</p>';
        return;
      }

      currentRecPreviewDates.forEach((p, idx) => {
        const row = document.createElement('div');
        row.className = 'flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 hover:border-brand/40 transition';
        row.innerHTML = `
          <div class="flex items-center gap-2.5">
            <span class="w-6 h-6 rounded-full bg-brand text-white text-[11px] font-bold flex items-center justify-center shrink-0">#${idx + 1}</span>
            <div>
              <div class="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span class="font-black text-slate-900 dark:text-white text-xs">${p.diaNombre}, ${formatDateDisplay(p.fecha)}</span>
                <span class="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-purple-100 text-brand dark:bg-brand/20 dark:text-brand">
                  ${p.badgeTexto}
                </span>
              </div>
              <p class="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">${p.detalleTexto}</p>
            </div>
          </div>
          <div class="text-right">
            <span class="font-mono font-black text-slate-900 dark:text-white text-xs">${formatGuaranies(totalUnit)}</span>
            <span class="block text-[9px] text-slate-400">Cuota programada</span>
          </div>
        `;
        recPreviewList.appendChild(row);
      });
    }

    // Botones de frecuencia
    content.querySelectorAll('.btn-rec-frec').forEach((b) => {
      b.addEventListener('click', () => {
        recFrecuencia = b.dataset.frec;
        syncRecurrenceUI();
      });
    });

    // Botones de tipo día
    btnRecInicioMes?.addEventListener('click', () => {
      recTipoDia = 'inicio_mes';
      syncRecurrenceUI();
    });
    btnRecCierreMes?.addEventListener('click', () => {
      recTipoDia = 'cierre_mes';
      syncRecurrenceUI();
    });

    recFechaInicioInp?.addEventListener('change', (e) => {
      if (recFrecuencia === 'Semanal') {
        const monday = getMondayOfDateStr(e.target.value);
        if (monday !== e.target.value) {
          e.target.value = monday;
          toast.info('Se ajustó automáticamente al lunes de esa semana (inicio ISO).');
        }
      } else if ((recFrecuencia === 'Mensual' || recFrecuencia === 'Trimestral') && recTipoDia === 'cierre_mes') {
        e.target.value = getEndOfMonthDateStr(e.target.value);
      } else if ((recFrecuencia === 'Mensual' || recFrecuencia === 'Trimestral') && recTipoDia === 'inicio_mes') {
        e.target.value = getStartOfMonthDateStr(e.target.value);
      }
      updateRecurrencePreview();
    });

    recFechaInicioInp?.addEventListener('input', () => updateRecurrencePreview());

    recFechaFinInp?.addEventListener('change', () => {
      updateRecurrencePreview();
    });

    recFechaFinInp?.addEventListener('input', () => updateRecurrencePreview());

    // iOS Toggle para Pagos Recurrentes
    if (recToggleHolder) {
      const recToggle = createIOSToggle({
        label: '',
        checked: isRecurrente,
        activeColor: 'purple',
        onChange: (chk) => {
          isRecurrente = chk;
          if (isRecurrente) {
            recConfigBox?.classList.remove('hidden');
            syncRecurrenceUI();
          } else {
            recConfigBox?.classList.add('hidden');
          }
        },
      });
      recToggleHolder.appendChild(recToggle.element);
    }

    function updateMath() {
      const tot = parseGuaranies(totalInp.value);
      if (estadoPago === 'Pagado') {
        montoPagadoInp.value = formatGuaranies(tot);
        saldoCalcEl.textContent = '0 Gs.';
      } else if (estadoPago === 'Pendiente') {
        montoPagadoInp.value = '0 Gs.';
        saldoCalcEl.textContent = formatGuaranies(tot);
      } else if (estadoPago === 'Pago Parcial') {
        const pag = parseGuaranies(montoPagadoInp.value);
        const sal = Math.max(0, tot - pag);
        saldoCalcEl.textContent = formatGuaranies(sal);
      }
      if (isRecurrente) {
        updateRecurrencePreview();
      }
    }

    totalInp.addEventListener('input', (e) => {
      const n = parseGuaranies(e.target.value);
      e.target.value = formatGuaranies(n);
      const qty = Math.max(1, counter.getValue());
      unitCost = n / qty;
      updateMath();
    });

    montoPagadoInp.addEventListener('input', (e) => {
      const n = parseGuaranies(e.target.value);
      e.target.value = formatGuaranies(n);
      updateMath();
    });

    content.querySelectorAll('.modal-estado-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        estadoPago = btn.dataset.estado;
        content.querySelectorAll('.modal-estado-btn').forEach((b) => {
          const st = b.dataset.estado;
          if (st === estadoPago) {
            if (st === 'Pendiente') b.className = 'modal-estado-btn py-2 px-2.5 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 bg-amber-500 text-white border-amber-500 shadow-xs';
            if (st === 'Pagado') b.className = 'modal-estado-btn py-2 px-2.5 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 bg-emerald-600 text-white border-emerald-600 shadow-xs';
            if (st === 'Pago Parcial') b.className = 'modal-estado-btn py-2 px-2.5 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 bg-brand text-white border-brand shadow-xs';
          } else {
            b.className = 'modal-estado-btn py-2 px-2.5 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300';
          }
        });

        if (estadoPago === 'Pago Parcial') {
          partialBox.classList.remove('hidden');
          if (fechaParcialInp && pagoFechaInp) {
            fechaParcialInp.value = pagoFechaInp.value || getTodayISODate();
            syncPartialDateBadge(fechaParcialInp.value);
          }
        } else {
          partialBox.classList.add('hidden');
        }
        updateMath();
      });
    });

    // En lugar de modal, tomar toda el área asignada según AGENTS.md
    moduleWrap.innerHTML = '';

    const viewWrapper = document.createElement('div');
    viewWrapper.className = 'w-full space-y-6';

    const header = document.createElement('div');
    header.className = 'flex flex-wrap items-center justify-between gap-4';
    header.innerHTML = `
      <div>
        <div class="flex items-center gap-2 text-xs text-slate-400 mb-1">
          <button type="button" id="btn-back-pagos" class="hover:text-brand transition cursor-pointer flex items-center gap-1">
            <i class="fa-solid fa-chevron-left text-[10px]"></i>
            Pagos
          </button>
          <span>/</span>
          <span class="text-slate-600 dark:text-slate-300 font-semibold">Generar Nuevo Pago</span>
        </div>
        <h1 class="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">Generar Nuevo Pago</h1>
      </div>
      <div class="flex items-center gap-2" id="form-actions-top"></div>
    `;

    const topActions = header.querySelector('#form-actions-top');
    const btnCancelTop = createButton({
      text: 'Cancelar',
      variant: 'cancel',
      size: 'md',
      onClick: () => renderPagosModule(moduleWrap),
    });
    topActions.appendChild(btnCancelTop);
    header.querySelector('#btn-back-pagos')?.addEventListener('click', () => renderPagosModule(moduleWrap));
    viewWrapper.appendChild(header);

    const formCard = document.createElement('div');
    formCard.className = 'w-full p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-6';
    formCard.appendChild(content);

    const footerActions = document.createElement('div');
    footerActions.className = 'flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800';

    const btnCancelBottom = createButton({
      text: 'Cancelar',
      variant: 'cancel',
      size: 'md',
      onClick: () => renderPagosModule(moduleWrap),
    });
    footerActions.appendChild(btnCancelBottom);

    const btnGuardar = createButton({
      text: 'Guardar Pago',
      icon: 'fa-solid fa-floppy-disk',
      variant: 'primary',
      size: 'md',
      onClick: async () => {
        let provNombre = '';
        let provRuc = '';
        let provId = null;
        let referenciaPago = '';
        let cliNombre = '';
        let cliId = null;

        if (tipoBeneficiario === 'Proveedor') {
          if (isProvTemporal) {
            const nomInp = content.querySelector('#modal-prov-temp-name');
            const rucInp = content.querySelector('#modal-prov-temp-ruc');
            provNombre = nomInp ? nomInp.value.trim() : '';
            provRuc = rucInp ? rucInp.value.trim() : '';
          } else {
            const searchInp = content.querySelector('#modal-prov-search');
            provNombre = searchInp ? searchInp.value.trim() : (selectedProv?.razonSocial || '');
            provRuc = selectedProv?.rucDocumento || '';
            provId = selectedProv?.id || null;
          }

          if (!provNombre) {
            toast.error('Indique el nombre del proveedor.');
            return;
          }
        } else if (tipoBeneficiario === 'Colaborador') {
          const colabInp = content.querySelector('#modal-colab-input');
          const colabDocInp = content.querySelector('#modal-colab-doc');
          provNombre = colabInp ? colabInp.value.trim() : '';
          provRuc = colabDocInp ? colabDocInp.value.trim() : '';
          if (!provNombre) {
            toast.error('Indique el nombre del colaborador.');
            return;
          }
        } else if (tipoBeneficiario === 'Otros') {
          const refInp = content.querySelector('#modal-otros-referencia');
          const benInp = content.querySelector('#modal-otros-beneficiario');
          referenciaPago = refInp ? refInp.value.trim() : '';
          const benExtra = benInp ? benInp.value.trim() : '';
          if (!referenciaPago) {
            toast.error('Escriba a qué hace referencia la opción de pago en "Otros".');
            return;
          }
          provNombre = benExtra || referenciaPago;
        }

        let prodNombre = '';
        let prodId = null;
        if (isProdTemporal) {
          const pInp = content.querySelector('#modal-prod-temp-name');
          prodNombre = pInp ? pInp.value.trim() : '';
        } else {
          const pSearch = content.querySelector('#modal-prod-search');
          prodNombre = pSearch ? pSearch.value.trim() : (selectedProd?.nombre || '');
          prodId = selectedProd?.id || null;
        }

        if (!prodNombre && tipoBeneficiario === 'Otros' && referenciaPago) {
          prodNombre = referenciaPago;
          isProdTemporal = true;
        }

        if (!prodNombre) {
          toast.error('Indique el nombre del producto o concepto.');
          return;
        }

        const montoTotal = parseGuaranies(totalInp.value);
        if (montoTotal <= 0) {
          toast.error('El monto total debe ser mayor a 0 Gs.');
          return;
        }

        if (isRecurrente) {
          const fIni = recFechaInicioInp ? recFechaInicioInp.value : '';
          const fFin = recFechaFinInp ? recFechaFinInp.value : '';
          if (!fIni || !fFin) {
            toast.error('Indique fecha de inicio y fin para el pago recurrente.');
            return;
          }
          if (fFin < fIni) {
            toast.error('La fecha de fin no puede ser anterior a la fecha de inicio.');
            return;
          }
          currentRecPreviewDates = calculateRecurringDatesPreview(recFrecuencia, recTipoDia, fIni, fFin);
          if (!currentRecPreviewDates || currentRecPreviewDates.length === 0) {
            toast.error('El rango de fechas no genera ninguna cuota recurrente.');
            return;
          }
        }

        const metodo = content.querySelector('#pago-metodo').value;
        let fecha = content.querySelector('#pago-fecha').value || getTodayISODate();
        let fechaParcial = '';
        let historialParciales = [];

        let montoPagado = 0;
        let saldoPendiente = montoTotal;
        if (estadoPago === 'Pagado') {
          montoPagado = montoTotal;
          saldoPendiente = 0;
        } else if (estadoPago === 'Pendiente') {
          montoPagado = 0;
          saldoPendiente = montoTotal;
        } else if (estadoPago === 'Pago Parcial') {
          montoPagado = parseGuaranies(montoPagadoInp.value);
          if (montoPagado <= 0) {
            toast.error('Ingrese el monto abonado para el Pago Parcial.');
            return;
          }
          if (montoPagado > montoTotal) montoPagado = montoTotal;
          saldoPendiente = Math.max(0, montoTotal - montoPagado);

          fechaParcial = (fechaParcialInp && fechaParcialInp.value) ? fechaParcialInp.value : fecha;
          fecha = fechaParcial; // Tomar la fecha y semana del pago parcial agregado
          const isoParcial = getISOWeekAndYearFromStr(fechaParcial);
          historialParciales = [
            {
              monto: montoPagado,
              fechaPago: fechaParcial,
              semanaIso: isoParcial.week,
              anioIso: isoParcial.year,
              metodoPago: metodo,
            },
          ];
        }

        const pedSelect = content.querySelector('#pago-pedido-select');
        const pedidoIdVal = pedSelect && pedSelect.value ? Number(pedSelect.value) : null;
        const notasVal = content.querySelector('#pago-notas').value.trim();

        let cliDoc = '';
        let cliTel = '';
        if (pedidoIdVal) {
          const pedObj = state.catalogoPedidos.find((p) => p.id === pedidoIdVal);
          if (pedObj) {
            cliNombre = pedObj.clienteNombre;
            cliId = pedObj.clienteId || null;
            cliDoc = pedObj.clienteDocumento || '';
            cliTel = pedObj.clienteTelefono || '';
          }
        }

        const payload = {
          tipoBeneficiario: tipoBeneficiario,
          referenciaPago: referenciaPago,
          proveedorId: provId,
          proveedorNombre: provNombre,
          proveedorRuc: provRuc,
          esProveedorTemporal: tipoBeneficiario === 'Proveedor' ? isProvTemporal : true,
          clienteId: cliId,
          clienteNombre: cliNombre,
          clienteDocumento: cliDoc,
          clienteTelefono: cliTel,
          productoId: prodId,
          productoNombre: prodNombre,
          esProductoTemporal: isProdTemporal,
          cantidad: counter.getValue(),
          montoTotal: montoTotal,
          montoPagado: montoPagado,
          saldoPendiente: saldoPendiente,
          estadoPago: estadoPago,
          metodoPago: metodo,
          fechaPago: fecha,
          fechaPagoParcial: fechaParcial,
          historialParciales: historialParciales,
          pedidoId: pedidoIdVal,
          notas: notasVal,
          esRecurrente: isRecurrente,
          recurrenciaFrecuencia: isRecurrente ? recFrecuencia : '',
          recurrenciaTipoDia: isRecurrente ? recTipoDia : '',
          recurrenciaFechaInicio: isRecurrente && recFechaInicioInp ? recFechaInicioInp.value : '',
          recurrenciaFechaFin: isRecurrente && recFechaFinInp ? recFechaFinInp.value : '',
        };

        try {
          const res = await apiFetch('/api/pagos', {
            method: 'POST',
            body: JSON.stringify(payload),
          });

          toast.success(res?.message || 'Pago registrado exitosamente.');
          renderPagosModule(moduleWrap);
        } catch (err) {
          console.error('[Error creando pago]', err);
          toast.error(err.message || 'Error al guardar el pago.');
        }
      },
    });
    footerActions.appendChild(btnGuardar);
    formCard.appendChild(footerActions);
    viewWrapper.appendChild(formCard);
    moduleWrap.appendChild(viewWrapper);
  }

  // ==========================================================================
  // 7. MODAL: EDITAR PAGO EXISTENTE (Con registro de fecha y semana de Pagos Parciales)
  // ==========================================================================
  function openEditarPagoModal(pago) {
    let estadoPago = pago.estadoPago || 'Pendiente';
    const initialMontoPagado = Number(pago.montoPagado) || 0;
    let historialParciales = Array.isArray(pago.historialParciales)
      ? pago.historialParciales.map((item) => ({ ...item }))
      : [];

    if (historialParciales.length === 0 && pago.estadoPago === 'Pago Parcial' && initialMontoPagado > 0) {
      const f = pago.fechaPago || getTodayISODate();
      const iso = getISOWeekAndYearFromStr(f);
      historialParciales.push({
        monto: initialMontoPagado,
        fechaPago: f,
        semanaIso: pago.semanaIso || iso.week,
        anioIso: pago.anioIso || iso.year,
        metodoPago: pago.metodoPago || 'Efectivo',
      });
    }

    const defaultPartialDate = pago.fechaPago || getTodayISODate();
    const defaultPartialIso = getISOWeekAndYearFromStr(defaultPartialDate);

    const content = document.createElement('div');
    content.className = 'space-y-4 text-xs';

    content.innerHTML = `
      <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
        <div>
          <span class="text-[10px] uppercase font-bold text-slate-500">Editando Pago (${escapeHtml(pago.tipoBeneficiario || 'Proveedor')})</span>
          <p class="text-sm font-black text-brand font-mono">${escapeHtml(pago.numeroPago)}</p>
        </div>
        <div class="text-right">
          <span class="text-[10px] text-slate-400">Beneficiario</span>
          <p class="font-bold text-slate-800 dark:text-slate-100">${escapeHtml(pago.proveedorNombre || pago.referenciaPago || pago.clienteNombre)}</p>
          ${pago.referenciaPago ? `<p class="text-[10px] text-brand font-semibold">Ref: ${escapeHtml(pago.referenciaPago)}</p>` : ''}
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Monto Total (Gs.) *</label>
          <input type="text" id="edit-monto-total" value="${formatGuaranies(pago.montoTotal)}"
            class="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-bold focus:outline-none focus:ring-2 focus:ring-brand" />
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Método de Pago</label>
          <select id="edit-metodo" class="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand">
            <option value="Efectivo" ${pago.metodoPago === 'Efectivo' ? 'selected' : ''}>Efectivo</option>
            <option value="Transferencia Bancaria" ${pago.metodoPago === 'Transferencia Bancaria' ? 'selected' : ''}>Transferencia Bancaria</option>
            <option value="Cheque" ${pago.metodoPago === 'Cheque' ? 'selected' : ''}>Cheque</option>
            <option value="Tarjeta de Débito" ${pago.metodoPago === 'Tarjeta de Débito' ? 'selected' : ''}>Tarjeta de Débito</option>
            <option value="Tarjeta de Crédito" ${pago.metodoPago === 'Tarjeta de Crédito' ? 'selected' : ''}>Tarjeta de Crédito</option>
            <option value="Giro Móvil" ${pago.metodoPago === 'Giro Móvil' ? 'selected' : ''}>Giro Móvil</option>
            <option value="Otro" ${pago.metodoPago === 'Otro' ? 'selected' : ''}>Otro</option>
          </select>
        </div>
      </div>

      <!-- Selector de Estado de Pago -->
      <div>
        <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Estado del Pago</label>
        <div class="grid grid-cols-3 gap-2">
          <button type="button" data-estado="Pendiente" class="edit-estado-btn py-2 px-2.5 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${estadoPago === 'Pendiente' ? 'bg-amber-500 text-white border-amber-500 shadow-xs' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'}">
            <i class="fa-solid fa-clock text-[11px]"></i>
            <span>Pendiente</span>
          </button>
          <button type="button" data-estado="Pagado" class="edit-estado-btn py-2 px-2.5 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${estadoPago === 'Pagado' ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'}">
            <i class="fa-solid fa-check text-[11px]"></i>
            <span>Pagado</span>
          </button>
          <button type="button" data-estado="Pago Parcial" class="edit-estado-btn py-2 px-2.5 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${estadoPago === 'Pago Parcial' ? 'bg-brand text-white border-brand shadow-xs' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'}">
            <i class="fa-solid fa-circle-half-stroke text-[11px]"></i>
            <span>Pago Parcial</span>
          </button>
        </div>
      </div>

      <div id="edit-partial-box" class="p-3.5 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-brand/30 space-y-3 ${estadoPago === 'Pago Parcial' ? '' : 'hidden'}">
        <div class="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-brand/20">
          <span class="text-xs font-bold text-brand flex items-center gap-1.5">
            <i class="fa-solid fa-calendar-check"></i>
            <span>Control de Pago Parcial (Fecha y Semana)</span>
          </span>
          <span id="edit-semana-parcial-badge" class="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-black bg-brand text-white">
            Semana ${defaultPartialIso.week} (${defaultPartialIso.year})
          </span>
        </div>

        <!-- Agregar nuevo pago parcial por fecha -->
        <div class="p-3 rounded-xl bg-white dark:bg-slate-900 border border-brand/20 space-y-2">
          <span class="text-[11px] font-bold text-slate-700 dark:text-slate-200 block">Agregar nuevo abono parcial con su fecha y semana:</span>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
            <div>
              <label class="block text-[10px] font-bold text-slate-500 mb-1">Monto del Abono (Gs.)</label>
              <input type="text" id="edit-nuevo-abono" placeholder="Ej. 150.000 Gs."
                class="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-bold focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
            <div>
              <label class="block text-[10px] font-bold text-slate-500 mb-1">Fecha del Abono Parcial</label>
              <input type="date" id="edit-fecha-parcial" value="${defaultPartialDate}"
                class="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
            <div>
              <button type="button" id="btn-add-parcial" class="w-full py-1.5 px-3 rounded-lg bg-brand hover:bg-brand-hover text-white font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5">
                <i class="fa-solid fa-plus"></i>
                <span>Agregar Abono</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Historial de pagos parciales cargados -->
        <div id="edit-historial-parciales-list" class="space-y-1.5"></div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center pt-1">
          <div>
            <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Total Abonado Acumulado (Gs.)</label>
            <input type="text" id="edit-monto-pagado" value="${formatGuaranies(pago.montoPagado)}"
              class="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-bold focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <div class="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex flex-col justify-center">
            <span class="text-[10px] uppercase font-bold text-slate-500">Saldo Pendiente Calculado</span>
            <span id="edit-saldo-calc" class="text-sm font-mono font-black text-danger">${formatGuaranies(pago.saldoPendiente)}</span>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Fecha del Pago (Última / Vigente)</label>
          <input type="date" id="edit-fecha" value="${pago.fechaPago || getTodayISODate()}"
            class="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand" />
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Notas / Observaciones</label>
          <input type="text" id="edit-notas" value="${escapeHtml(pago.notas || '')}"
            placeholder="Observaciones adicionales..."
            class="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand" />
        </div>
      </div>
    `;

    const totalInp = content.querySelector('#edit-monto-total');
    const montoPagadoInp = content.querySelector('#edit-monto-pagado');
    const nuevoAbonoInp = content.querySelector('#edit-nuevo-abono');
    const fechaParcialInp = content.querySelector('#edit-fecha-parcial');
    const editFechaInp = content.querySelector('#edit-fecha');
    const semanaBadge = content.querySelector('#edit-semana-parcial-badge');
    const histListEl = content.querySelector('#edit-historial-parciales-list');
    const saldoCalcEl = content.querySelector('#edit-saldo-calc');
    const partialBox = content.querySelector('#edit-partial-box');

    function renderHistorialList() {
      if (!histListEl) return;
      if (historialParciales.length === 0) {
        histListEl.innerHTML = `<p class="text-[11px] text-slate-400 italic">Aún no se han registrado pagos parciales individuales.</p>`;
        return;
      }
      histListEl.innerHTML = `
        <span class="text-[10px] uppercase font-bold text-slate-500 block">Pagos Parciales Registrados (${historialParciales.length}):</span>
        <div class="space-y-1 max-h-36 overflow-y-auto pr-1">
          ${historialParciales
            .map(
              (hp, idx) => `
            <div class="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px]">
              <div class="flex items-center gap-2">
                <span class="font-bold text-brand">#${idx + 1}</span>
                <span class="font-semibold text-slate-700 dark:text-slate-200">${formatDateDisplay(hp.fechaPago)}</span>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-100 text-brand dark:bg-brand/20 dark:text-brand">
                  Semana ${hp.semanaIso} (${hp.anioIso})
                </span>
              </div>
              <div class="flex items-center gap-2">
                <span class="font-mono font-bold text-emerald-600 dark:text-emerald-400">${formatGuaranies(hp.monto)}</span>
                <button type="button" data-del-idx="${idx}" class="text-slate-400 hover:text-danger transition cursor-pointer" title="Quitar este abono">
                  <i class="fa-solid fa-xmark"></i>
                </button>
              </div>
            </div>
          `
            )
            .join('')}
        </div>
      `;

      histListEl.querySelectorAll('[data-del-idx]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const i = Number(btn.dataset.delIdx);
          historialParciales.splice(i, 1);
          const sum = historialParciales.reduce((acc, item) => acc + (Number(item.monto) || 0), 0);
          montoPagadoInp.value = formatGuaranies(sum);
          if (historialParciales.length > 0) {
            const last = historialParciales[historialParciales.length - 1];
            editFechaInp.value = last.fechaPago;
          }
          renderHistorialList();
          updateMath();
        });
      });
    }

    renderHistorialList();

    fechaParcialInp?.addEventListener('change', (e) => {
      const f = e.target.value || getTodayISODate();
      const iso = getISOWeekAndYearFromStr(f);
      if (semanaBadge) semanaBadge.textContent = `Semana ${iso.week} (${iso.year})`;
      if (editFechaInp) editFechaInp.value = f;
    });

    editFechaInp?.addEventListener('change', (e) => {
      const f = e.target.value || getTodayISODate();
      if (fechaParcialInp) fechaParcialInp.value = f;
      const iso = getISOWeekAndYearFromStr(f);
      if (semanaBadge) semanaBadge.textContent = `Semana ${iso.week} (${iso.year})`;
    });

    nuevoAbonoInp?.addEventListener('input', (e) => {
      e.target.value = formatGuaranies(parseGuaranies(e.target.value));
    });

    content.querySelector('#btn-add-parcial')?.addEventListener('click', () => {
      const abono = parseGuaranies(nuevoAbonoInp.value);
      if (abono <= 0) {
        toast.error('Ingrese un monto de abono parcial mayor a 0 Gs.');
        return;
      }
      const f = fechaParcialInp.value || getTodayISODate();
      const iso = getISOWeekAndYearFromStr(f);
      const metodoActual = content.querySelector('#edit-metodo').value || 'Efectivo';

      historialParciales.push({
        monto: abono,
        fechaPago: f,
        semanaIso: iso.week,
        anioIso: iso.year,
        metodoPago: metodoActual,
      });

      const sum = historialParciales.reduce((acc, item) => acc + (Number(item.monto) || 0), 0);
      montoPagadoInp.value = formatGuaranies(sum);
      editFechaInp.value = f;
      nuevoAbonoInp.value = '';
      renderHistorialList();
      updateMath();
      toast.success(`Abono de ${formatGuaranies(abono)} asignado a la Semana ${iso.week} (${formatDateDisplay(f)}).`);
    });

    function updateMath() {
      const tot = parseGuaranies(totalInp.value);
      if (estadoPago === 'Pagado') {
        montoPagadoInp.value = formatGuaranies(tot);
        saldoCalcEl.textContent = '0 Gs.';
      } else if (estadoPago === 'Pendiente') {
        montoPagadoInp.value = '0 Gs.';
        saldoCalcEl.textContent = formatGuaranies(tot);
      } else if (estadoPago === 'Pago Parcial') {
        const pag = parseGuaranies(montoPagadoInp.value);
        const sal = Math.max(0, tot - pag);
        saldoCalcEl.textContent = formatGuaranies(sal);
      }
    }

    totalInp.addEventListener('input', (e) => {
      e.target.value = formatGuaranies(parseGuaranies(e.target.value));
      updateMath();
    });
    montoPagadoInp.addEventListener('input', (e) => {
      e.target.value = formatGuaranies(parseGuaranies(e.target.value));
      updateMath();
    });

    content.querySelectorAll('.edit-estado-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        estadoPago = btn.dataset.estado;
        content.querySelectorAll('.edit-estado-btn').forEach((b) => {
          const st = b.dataset.estado;
          if (st === estadoPago) {
            if (st === 'Pendiente') b.className = 'edit-estado-btn py-2 px-2.5 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 bg-amber-500 text-white border-amber-500 shadow-xs';
            if (st === 'Pagado') b.className = 'edit-estado-btn py-2 px-2.5 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 bg-emerald-600 text-white border-emerald-600 shadow-xs';
            if (st === 'Pago Parcial') b.className = 'edit-estado-btn py-2 px-2.5 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 bg-brand text-white border-brand shadow-xs';
          } else {
            b.className = 'edit-estado-btn py-2 px-2.5 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300';
          }
        });

        if (estadoPago === 'Pago Parcial') {
          partialBox.classList.remove('hidden');
        } else {
          partialBox.classList.add('hidden');
        }
        updateMath();
      });
    });

    openModal({
      title: `Editar Pago — ${pago.numeroPago}`,
      content: content,
      size: 'md',
      confirmText: 'Actualizar Pago',
      cancelText: 'Cancelar',
      confirmVariant: 'primary',
      onConfirm: async ({ close }) => {
        const montoTotal = parseGuaranies(totalInp.value);
        if (montoTotal <= 0) {
          toast.error('El monto total debe ser mayor a 0 Gs.');
          return false;
        }

        const metodoVal = content.querySelector('#edit-metodo').value;
        let fechaVal = editFechaInp.value || pago.fechaPago || getTodayISODate();
        let fechaParcialVal = '';

        let montoPagado = 0;
        let saldoPendiente = montoTotal;
        if (estadoPago === 'Pagado') {
          montoPagado = montoTotal;
          saldoPendiente = 0;
        } else if (estadoPago === 'Pendiente') {
          montoPagado = 0;
          saldoPendiente = montoTotal;
          historialParciales = [];
        } else if (estadoPago === 'Pago Parcial') {
          // Si el usuario escribió un monto en "nuevo abono" sin pulsar "+ Agregar Abono", lo sumamos automáticamente
          const pendingNuevoAbono = nuevoAbonoInp ? parseGuaranies(nuevoAbonoInp.value) : 0;
          const selectedPartialDate = (fechaParcialInp && fechaParcialInp.value) ? fechaParcialInp.value : fechaVal;
          const isoSelected = getISOWeekAndYearFromStr(selectedPartialDate);

          if (pendingNuevoAbono > 0) {
            historialParciales.push({
              monto: pendingNuevoAbono,
              fechaPago: selectedPartialDate,
              semanaIso: isoSelected.week,
              anioIso: isoSelected.year,
              metodoPago: metodoVal,
            });
            montoPagado = historialParciales.reduce((acc, item) => acc + (Number(item.monto) || 0), 0);
          } else {
            montoPagado = parseGuaranies(montoPagadoInp.value);
            const sumHist = historialParciales.reduce((acc, item) => acc + (Number(item.monto) || 0), 0);
            if (historialParciales.length === 0 && montoPagado > 0) {
              historialParciales.push({
                monto: montoPagado,
                fechaPago: selectedPartialDate,
                semanaIso: isoSelected.week,
                anioIso: isoSelected.year,
                metodoPago: metodoVal,
              });
            } else if (montoPagado > sumHist) {
              // Se incrementó el monto pagado manualmente: registramos la diferencia con la fecha y semana seleccionada
              historialParciales.push({
                monto: montoPagado - sumHist,
                fechaPago: selectedPartialDate,
                semanaIso: isoSelected.week,
                anioIso: isoSelected.year,
                metodoPago: metodoVal,
              });
            } else if ( historialParciales.length === 1 && (montoPagado !== sumHist || historialParciales[0].fechaPago !== selectedPartialDate)) {
              historialParciales[0] = {
                ...historialParciales[0],
                monto: montoPagado,
                fechaPago: selectedPartialDate,
                semanaIso: isoSelected.week,
                anioIso: isoSelected.year,
                metodoPago: metodoVal,
              };
            }
          }

          if (montoPagado < 0) montoPagado = 0;
          if (montoPagado > montoTotal) montoPagado = montoTotal;
          saldoPendiente = Math.max(0, montoTotal - montoPagado);

          if (historialParciales.length > 0) {
            const latest = historialParciales[historialParciales.length - 1];
            fechaParcialVal = latest.fechaPago || selectedPartialDate;
            fechaVal = fechaParcialVal;
          } else {
            fechaParcialVal = selectedPartialDate;
            fechaVal = selectedPartialDate;
          }
        }

        const payload = {
          ...pago,
          montoTotal: montoTotal,
          montoPagado: montoPagado,
          saldoPendiente: saldoPendiente,
          estadoPago: estadoPago,
          metodoPago: metodoVal,
          fechaPago: fechaVal,
          fechaPagoParcial: fechaParcialVal,
          historialParciales: historialParciales,
          notas: content.querySelector('#edit-notas').value.trim(),
        };

        try {
          await apiFetch(`/api/pagos/${pago.id}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
          });
          toast.success('Pago actualizado correctamente.');
          if (typeof close === 'function') close();
          await loadData();
        } catch (err) {
          console.error('[Error actualizando pago]', err);
          toast.error(err.message || 'Error al actualizar el pago.');
          return false;
        }
      },
    });
  }

  // ==========================================================================
  // 8. MODAL DE DESCARGA / EXPORTACIÓN (TXT, WORD, EXCEL, PDF)
  // ==========================================================================
  function openExportModal() {
    let scope = 'actual'; // 'actual' | 'total'
    let format = 'excel'; // 'excel' | 'pdf' | 'word' | 'txt'

    const availableColumns = [
      { id: 'numeroPago', label: 'N° Pago', default: true, getValue: (r) => r.numeroPago },
      { id: 'fechaPago', label: 'Fecha de Pago', default: true, getValue: (r) => formatDateDisplay(r.fechaPago) },
      { id: 'semanaIso', label: 'Semana ISO', default: true, getValue: (r) => `Semana ${r.semanaIso}` },
      { id: 'tipoBeneficiario', label: 'Tipo Beneficiario', default: true, getValue: (r) => r.tipoBeneficiario },
      { id: 'beneficiario', label: 'Beneficiario / Referencia', default: true, getValue: (r) => (r.tipoBeneficiario === 'Otros' ? `${r.proveedorNombre || ''}${r.referenciaPago && r.referenciaPago !== r.proveedorNombre ? ` (${r.referenciaPago})` : ''}` : (r.proveedorNombre || r.clienteNombre || '')) },
      { id: 'documento', label: 'Documento / RUC', default: true, getValue: (r) => (r.proveedorRuc || r.clienteDocumento || '') },
      { id: 'productoNombre', label: 'Producto / Insumo', default: true, getValue: (r) => r.productoNombre },
      { id: 'cantidad', label: 'Cantidad', default: true, getValue: (r) => r.cantidad },
      { id: 'destino', label: 'Destinado a (Cliente / Pedido)', default: true, getValue: (r) => (r.numeroPedido || r.clienteNombre ? `${r.numeroPedido || ''} - ${r.clienteNombre || ''}`.trim() : 'Compra directa') },
      { id: 'montoTotal', label: 'Monto Total (Gs.)', default: true, isMoney: true, getValue: (r) => formatGuaranies(r.montoTotal) },
      { id: 'montoPagado', label: 'Monto Pagado (Gs.)', default: true, isMoney: true, getValue: (r) => formatGuaranies(r.montoPagado) },
      { id: 'saldoPendiente', label: 'Saldo Pendiente (Gs.)', default: true, isMoney: true, getValue: (r) => formatGuaranies(r.saldoPendiente) },
      { id: 'estadoPago', label: 'Estado del Pago', default: true, getValue: (r) => r.estadoPago },
      { id: 'metodoPago', label: 'Método de Pago', default: true, getValue: (r) => r.metodoPago || 'Efectivo' },
      { id: 'esRecurrente', label: '¿Es Recurrente?', default: false, getValue: (r) => (r.esRecurrente ? `Sí (${r.recurrenciaFrecuencia || ''})` : 'No') },
      { id: 'recurrenciaPeriodo', label: 'Periodo Recurrente', default: false, getValue: (r) => (r.esRecurrente && r.recurrenciaFechaInicio ? `${r.recurrenciaFechaInicio} a ${r.recurrenciaFechaFin}` : '—') },
      { id: 'notas', label: 'Notas / Observaciones', default: false, getValue: (r) => r.notas || '' },
    ];

    const content = document.createElement('div');
    content.className = 'space-y-4 text-xs';

    content.innerHTML = `
      <!-- 1. Alcance de la descarga -->
      <div class="space-y-1.5">
        <label class="block text-xs font-bold text-slate-700 dark:text-slate-300">Alcance de la Descarga</label>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <label class="flex items-center gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-brand/40 cursor-pointer">
            <input type="radio" name="export-scope" value="actual" checked class="text-brand focus:ring-brand" />
            <div>
              <p class="font-bold text-slate-800 dark:text-slate-100">Vista Actual Filtrada</p>
              <p class="text-[11px] text-slate-400">Registros mostrados actualmente (${state.data.length} ítems)</p>
            </div>
          </label>
          <label class="flex items-center gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-brand/40 cursor-pointer">
            <input type="radio" name="export-scope" value="total" class="text-brand focus:ring-brand" />
            <div>
              <p class="font-bold text-slate-800 dark:text-slate-100">Toda la Tabla General</p>
              <p class="text-[11px] text-slate-400">Histórico completo de la base de datos (${state.total} ítems)</p>
            </div>
          </label>
        </div>
      </div>

      <!-- 2. Formato de descarga -->
      <div class="space-y-1.5">
        <label class="block text-xs font-bold text-slate-700 dark:text-slate-300">Formato del Archivo</label>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button type="button" data-format="excel" class="export-format-btn p-3 rounded-xl border transition flex flex-col items-center gap-1.5 cursor-pointer bg-brand text-white border-brand shadow-xs">
            <i class="fa-solid fa-file-excel text-base"></i>
            <span class="font-bold text-xs">Excel (.csv)</span>
          </button>
          <button type="button" data-format="pdf" class="export-format-btn p-3 rounded-xl border transition flex flex-col items-center gap-1.5 cursor-pointer border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            <i class="fa-solid fa-file-pdf text-base"></i>
            <span class="font-bold text-xs">PDF (.pdf)</span>
          </button>
          <button type="button" data-format="word" class="export-format-btn p-3 rounded-xl border transition flex flex-col items-center gap-1.5 cursor-pointer border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            <i class="fa-solid fa-file-word text-base"></i>
            <span class="font-bold text-xs">Word (.doc)</span>
          </button>
          <button type="button" data-format="txt" class="export-format-btn p-3 rounded-xl border transition flex flex-col items-center gap-1.5 cursor-pointer border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            <i class="fa-solid fa-file-lines text-base"></i>
            <span class="font-bold text-xs">Texto (.txt)</span>
          </button>
        </div>
      </div>

      <!-- 3. Selección de campos a descargar -->
      <div class="space-y-2">
        <div class="flex items-center justify-between pb-1 border-b border-slate-200 dark:border-slate-700">
          <label class="block text-xs font-bold text-slate-700 dark:text-slate-300">Campos a Incluir en el Archivo</label>
          <div class="flex items-center gap-2">
            <button type="button" id="btn-select-all-cols" class="text-[11px] font-semibold text-brand hover:underline cursor-pointer">Seleccionar todos</button>
            <span class="text-slate-300 dark:text-slate-600">·</span>
            <button type="button" id="btn-unselect-all-cols" class="text-[11px] font-semibold text-slate-400 hover:text-danger cursor-pointer">Deseleccionar</button>
          </div>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
          ${availableColumns
            .map(
              (c) => `
            <label class="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700/60 cursor-pointer">
              <input type="checkbox" data-col="${c.id}" ${c.default ? 'checked' : ''} class="col-checkbox rounded text-brand focus:ring-brand" />
              <span class="text-[11px] text-slate-700 dark:text-slate-200 select-none">${escapeHtml(c.label)}</span>
            </label>
          `
            )
            .join('')}
        </div>
      </div>
    `;

    // Selección de formato
    content.querySelectorAll('.export-format-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        format = btn.dataset.format;
        content.querySelectorAll('.export-format-btn').forEach((b) => {
          if (b.dataset.format === format) {
            b.className = 'export-format-btn p-3 rounded-xl border transition flex flex-col items-center gap-1.5 cursor-pointer bg-brand text-white border-brand shadow-xs';
          } else {
            b.className = 'export-format-btn p-3 rounded-xl border transition flex flex-col items-center gap-1.5 cursor-pointer border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300';
          }
        });
      });
    });

    // Selección de alcance
    content.querySelectorAll('input[name="export-scope"]').forEach((r) => {
      r.addEventListener('change', (e) => {
        scope = e.target.value;
      });
    });

    // Seleccionar/Deseleccionar todos
    content.querySelector('#btn-select-all-cols')?.addEventListener('click', () => {
      content.querySelectorAll('.col-checkbox').forEach((cb) => (cb.checked = true));
    });
    content.querySelector('#btn-unselect-all-cols')?.addEventListener('click', () => {
      content.querySelectorAll('.col-checkbox').forEach((cb) => (cb.checked = false));
    });

    openModal({
      title: 'Descargar y Exportar Reporte de Pagos',
      content: content,
      size: 'md',
      confirmText: 'Descargar Archivo',
      cancelText: 'Cancelar',
      confirmVariant: 'primary',
      onConfirm: async ({ close }) => {
        // Filtrar columnas seleccionadas
        const checkedColsIds = Array.from(content.querySelectorAll('.col-checkbox:checked')).map((cb) => cb.dataset.col);
        const selectedCols = availableColumns.filter((c) => checkedColsIds.includes(c.id));

        if (selectedCols.length === 0) {
          toast.error('Debe seleccionar al menos una columna para exportar.');
          return false;
        }

        let dataset = [];
        if (scope === 'actual') {
          dataset = state.data;
        } else {
          try {
            const fullRes = await apiFetch('/api/pagos?page_size=all');
            if (fullRes && Array.isArray(fullRes.data)) {
              dataset = fullRes.data;
            }
          } catch (err) {
            console.error('[Error obteniendo todos los pagos]', err);
            toast.error('Error al descargar la tabla completa.');
            return false;
          }
        }

        if (dataset.length === 0) {
          toast.error('No hay registros para descargar.');
          return false;
        }

        const dateSuffix = new Date().toISOString().slice(0, 10);
        const fileNameBase = `Reporte_Pagos_${scope === 'total' ? 'General' : 'Filtrado'}_${dateSuffix}`;

        try {
          if (format === 'excel') {
            exportToExcel(dataset, selectedCols, fileNameBase);
          } else if (format === 'word') {
            exportToWord(dataset, selectedCols, fileNameBase);
          } else if (format === 'txt') {
            exportToTxt(dataset, selectedCols, fileNameBase);
          } else if (format === 'pdf') {
            exportToPdf(dataset, selectedCols, fileNameBase);
          }

          toast.success('Archivo descargado correctamente.');
          if (typeof close === 'function') close();
        } catch (err) {
          console.error('[Error generando descarga]', err);
          toast.error('Error al generar el archivo.');
          return false;
        }
      },
    });
  }

  // Generadores de archivos de exportación
  function exportToExcel(records, selectedCols, filename) {
    let csv = '\uFEFF'; // UTF-8 BOM
    csv += selectedCols.map((c) => `"${c.label.replace(/"/g, '""')}"`).join(';') + '\r\n';
    records.forEach((r) => {
      csv += selectedCols.map((c) => `"${String(c.getValue(r) || '').replace(/"/g, '""')}"`).join(';') + '\r\n';
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    downloadFileBlob(blob, `${filename}.csv`);
  }

  function exportToWord(records, selectedCols, filename) {
    const html = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>${filename}</title>
      <style>
        body { font-family: Calibri, Arial, sans-serif; font-size: 10pt; }
        h2 { color: #581c87; margin-bottom: 4px; }
        .meta { color: #64748b; font-size: 9pt; margin-bottom: 16px; }
        table { border-collapse: collapse; width: 100%; margin-top: 10px; }
        th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; font-size: 9pt; }
        th { background-color: #f1f5f9; color: #1e293b; font-weight: bold; }
        .money { text-align: right; font-family: monospace; font-weight: bold; }
      </style>
      </head>
      <body>
        <h2>Reporte de Pagos — R1 Personalizados</h2>
        <div class="meta">Fecha de emisión: ${new Date().toLocaleString('es-PY')} · Total de registros: ${records.length}</div>
        <table>
          <thead>
            <tr>${selectedCols.map((c) => `<th>${escapeHtml(c.label)}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${records
              .map(
                (r) => `
              <tr>${selectedCols.map((c) => `<td class="${c.isMoney ? 'money' : ''}">${escapeHtml(String(c.getValue(r) || '—'))}</td>`).join('')}</tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      </body></html>
    `;
    const blob = new Blob([html], { type: 'application/msword;charset=utf-8' });
    downloadFileBlob(blob, `${filename}.doc`);
  }

  function exportToTxt(records, selectedCols, filename) {
    let txt = `================================================================================\r\n`;
    txt += `REPORTE DE PAGOS — R1 PERSONALIZADOS\r\n`;
    txt += `Fecha de emisión: ${new Date().toLocaleString('es-PY')}\r\n`;
    txt += `Total de registros: ${records.length}\r\n`;
    txt += `================================================================================\r\n\r\n`;
    txt += selectedCols.map((c) => c.label).join('\t') + '\r\n';
    txt += '-'.repeat(80) + '\r\n';
    records.forEach((r) => {
      txt += selectedCols.map((c) => String(c.getValue(r) || '—').replace(/\t/g, ' ')).join('\t') + '\r\n';
    });
    const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
    downloadFileBlob(blob, `${filename}.txt`);
  }

  function exportToPdf(records, selectedCols, filename) {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Habilite las ventanas emergentes en su navegador para imprimir o guardar el PDF.');
      return;
    }
    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="utf-8" />
        <title>${filename}</title>
        <style>
          @page { size: landscape; margin: 10mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; font-size: 9pt; color: #0f172a; margin: 0; padding: 12px; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #a37cfc; padding-bottom: 8px; margin-bottom: 12px; }
          h1 { margin: 0; font-size: 15pt; color: #4c1d95; }
          .meta { font-size: 8.5pt; color: #64748b; margin-top: 2px; }
          table { width: 100%; border-collapse: collapse; font-size: 8pt; }
          th, td { border: 1px solid #e2e8f0; padding: 5px 6px; text-align: left; vertical-align: middle; }
          th { background: #f8fafc; font-weight: bold; color: #334155; }
          tr:nth-child(even) { background: #fdfdfd; }
          .money { text-align: right; font-family: monospace; font-weight: bold; color: #4c1d95; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>Reporte de Pagos — R1 Personalizados</h1>
            <div class="meta">Fecha de emisión: ${new Date().toLocaleString('es-PY')} · Total de registros: ${records.length}</div>
          </div>
        </div>
        <table>
          <thead>
            <tr>${selectedCols.map((c) => `<th>${escapeHtml(c.label)}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${records
              .map(
                (r) => `
              <tr>${selectedCols.map((c) => `<td class="${c.isMoney ? 'money' : ''}">${escapeHtml(String(c.getValue(r) || '—'))}</td>`).join('')}</tr>
            `
              )
              .join('')}
          </tbody>
        </table>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  }

  // ==========================================================================
  // 9. ANULACIÓN / BORRADO SIMULADO SEGÚN AGENTS.MD
  // ==========================================================================
  function confirmarAnularPago(pago) {
    openConfirmModal({
      title: '¿Anular este Pago?',
      message: `Está a punto de anular el pago ${pago.numeroPago} por ${formatGuaranies(pago.montoTotal)} a ${pago.proveedorNombre || pago.clienteNombre}. El registro no se borrará físicamente y se enviará al módulo de Reciclaje.`,
      confirmText: 'Sí, Anular Pago',
      confirmVariant: 'danger',
      onConfirm: async ({ close }) => {
        try {
          await apiFetch(`/api/pagos/${pago.id}`, { method: 'DELETE' });
          toast.success('Pago anulado y enviado a Reciclaje.');
          if (typeof close === 'function') close();
          await loadData();
        } catch (err) {
          console.error('[Error anulando pago]', err);
          toast.error(err.message || 'Error al anular el pago.');
        }
      },
    });
  }

  // Inicialización
  loadCatalogos();
  loadData();
  container.appendChild(moduleWrap);
}
