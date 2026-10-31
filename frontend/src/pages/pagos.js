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

function getISOWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
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
    page: 1,
    pageSize: 20,
    data: [],
    total: 0,
    stats: {
      total: 0,
      pendientes: 0,
      pagadosHoy: 0,
      pagadosSemana: 0,
      pagadosMes: 0,
      montoPendiente: 0,
      montoPagado: 0,
    },
    loading: false,
    catalogoProveedores: [],
    catalogoClientes: [],
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
          Control de pagos a proveedores, pagos a clientes y vinculación de compras por pedido
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
        <p class="text-[11px] text-slate-400 mt-0.5">Vista general</p>
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
        <p class="text-[11px] text-slate-400 mt-0.5">Fecha actual</p>
      </div>

      <div data-filter="semana" class="stat-card p-4 rounded-2xl bg-white dark:bg-slate-900 border transition shadow-xs cursor-pointer ${state.filter === 'semana' ? 'border-blue-500 ring-2 ring-blue-500/30 bg-blue-50/20 dark:bg-blue-950/20' : 'border-slate-200/80 dark:border-slate-800 hover:border-blue-400'}">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Esta Semana</span>
          <span class="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center text-sm">
            <i class="fa-solid fa-calendar-week"></i>
          </span>
        </div>
        <p class="text-2xl font-black text-blue-600 dark:text-blue-400 mt-2 font-mono">${state.stats.pagadosSemana}</p>
        <p class="text-[11px] text-slate-400 mt-0.5">Semana ${weekNum}</p>
      </div>

      <div data-filter="mes" class="stat-card p-4 rounded-2xl bg-white dark:bg-slate-900 border transition shadow-xs cursor-pointer ${state.filter === 'mes' ? 'border-purple-500 ring-2 ring-purple-500/30 bg-purple-50/20 dark:bg-purple-950/20' : 'border-slate-200/80 dark:border-slate-800 hover:border-purple-400'} col-span-2 sm:col-span-1">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">Este Mes</span>
          <span class="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-950/50 text-purple-600 flex items-center justify-center text-sm">
            <i class="fa-solid fa-calendar-days"></i>
          </span>
        </div>
        <p class="text-2xl font-black text-purple-600 dark:text-purple-400 mt-2 font-mono">${state.stats.pagadosMes}</p>
        <p class="text-[11px] text-slate-400 mt-0.5">Mes en curso</p>
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
            <option value="Cliente" ${state.headerBeneficiario === 'Cliente' ? 'selected' : ''}>Clientes</option>
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

        ${
          state.search || state.headerBeneficiario !== 'todos' || state.headerEstado !== 'todos' || state.headerSemana !== 'todas'
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

    minimalBar.querySelector('#btn-limpiar-filtros')?.addEventListener('click', () => {
      state.search = '';
      state.headerBeneficiario = 'todos';
      state.headerEstado = 'todos';
      state.headerSemana = 'todas';
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

  function renderTable() {
    tableHolder.innerHTML = '';

    const columns = [
      {
        key: 'numeroPago',
        label: 'N° Pago',
        render: (row) => {
          const wrap = document.createElement('div');
          wrap.className = 'cursor-pointer group flex flex-col items-start';
          wrap.innerHTML = `
            <span class="font-mono font-bold text-brand group-hover:underline">${escapeHtml(row.numeroPago)}</span>
            <span class="text-[10px] text-slate-400">${formatDateDisplay(row.fechaPago)}</span>
          `;
          wrap.addEventListener('click', () => openDetallePagoModal(row));
          return wrap;
        },
      },
      {
        key: 'fechaPago',
        label: 'Semana',
        render: (row) => {
          const badge = document.createElement('span');
          badge.className =
            'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono';
          badge.textContent = `S${row.semanaIso || weekNum}`;
          return badge;
        },
      },
      {
        key: 'beneficiario',
        label: 'Beneficiario',
        render: (row) => {
          const isProv = row.tipoBeneficiario === 'Proveedor';
          const nom = isProv ? row.proveedorNombre : (row.clienteNombre || '—');
          const doc = isProv ? row.proveedorRuc : (row.clienteDocumento || '');
          const isTemporal = isProv ? row.esProveedorTemporal : false;

          const wrap = document.createElement('div');
          wrap.className = 'space-y-0.5';
          wrap.innerHTML = `
            <div class="flex items-center gap-1.5">
              <span class="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${isProv ? 'bg-purple-100 text-brand dark:bg-brand/20 dark:text-brand' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'}">${isProv ? 'Proveedor' : 'Cliente'}</span>
              <span class="font-bold text-slate-800 dark:text-slate-100 text-xs">${escapeHtml(nom)}</span>
            </div>
            <div class="text-[10px] text-slate-400">
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

      const res = await apiFetch(`/api/pagos?${q.toString()}`);
      if (res) {
        state.data = Array.isArray(res.data) ? res.data : [];
        state.total = Number(res.total) || 0;
        if (res.stats) {
          state.stats = {
            total: res.stats.total || 0,
            pendientes: res.stats.pendientes || 0,
            pagadosHoy: res.stats.pagadosHoy || 0,
            pagadosSemana: res.stats.pagadosSemana || 0,
            pagadosMes: res.stats.pagadosMes || 0,
            montoPendiente: res.stats.montoPendiente || 0,
            montoPagado: res.stats.montoPagado || 0,
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
    }
  }

  // Pre-carga de catálogos para modales
  async function loadCatalogos() {
    try {
      const [provs, clis, prods, peds] = await Promise.all([
        apiFetch('/api/proveedores').catch(() => null),
        apiFetch('/api/clientes').catch(() => null),
        apiFetch('/api/productos').catch(() => null),
        apiFetch('/api/pedidos').catch(() => null),
      ]);

      if (provs && Array.isArray(provs.data)) state.catalogoProveedores = provs.data;
      if (clis && Array.isArray(clis.data)) state.catalogoClientes = clis.data;
      if (prods && Array.isArray(prods.data)) state.catalogoProductos = prods.data;
      if (peds && Array.isArray(peds.data)) state.catalogoPedidos = peds.data;
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

    const isProv = p.tipoBeneficiario === 'Proveedor';

    const content = document.createElement('div');
    content.className = 'space-y-4 text-xs';

    content.innerHTML = `
      <!-- Encabezado de la ficha -->
      <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3">
        <div>
          <span class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Comprobante de Pago</span>
          <h3 class="text-base font-black text-brand font-mono">${escapeHtml(p.numeroPago)}</h3>
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
            <i class="${isProv ? 'fa-solid fa-truck-field' : 'fa-solid fa-user'} text-brand"></i>
            <span>Beneficiario (${isProv ? 'Proveedor' : 'Cliente'})</span>
          </h4>
          <p class="text-sm font-black text-slate-900 dark:text-white">${escapeHtml(isProv ? p.proveedorNombre : p.clienteNombre)}</p>
          <div class="space-y-1 text-slate-600 dark:text-slate-300">
            <p><strong>Documento / RUC:</strong> ${escapeHtml(isProv ? p.proveedorRuc || 'No registrado' : p.clienteDocumento || 'No registrado')}</p>
            ${!isProv && p.clienteTelefono ? `<p><strong>Teléfono / WhatsApp:</strong> ${escapeHtml(p.clienteTelefono)}</p>` : ''}
            <p><strong>Tipo:</strong> ${isProv && p.esProveedorTemporal ? '<span class="text-amber-500 font-semibold">Temporal / Manual</span>' : '<span class="text-emerald-600 font-semibold">Registrado en Base de Datos</span>'}</p>
          </div>
        </div>

        <!-- Producto -->
        <div class="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
          <h4 class="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 pb-1 border-b border-slate-100 dark:border-slate-800">
            <i class="fa-solid fa-box text-brand"></i>
            <span>Producto Suministrado / Involucrado</span>
          </h4>
          <p class="text-sm font-black text-slate-900 dark:text-white">${escapeHtml(p.productoNombre)}</p>
          <div class="space-y-1 text-slate-600 dark:text-slate-300">
            <p><strong>Cantidad Comprada:</strong> <span class="font-bold">${p.cantidad}</span></p>
            <p><strong>Costo Total Asignado:</strong> <span class="font-mono font-bold text-brand">${formatGuaranies(p.montoTotal)}</span></p>
            <p><strong>Tipo de Producto:</strong> ${p.esProductoTemporal ? '<span class="text-amber-500 font-semibold">Temporal / Manual</span>' : '<span class="text-emerald-600 font-semibold">Catálogo Oficial</span>'}</p>
          </div>
        </div>
      </div>

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

    const content = document.createElement('div');
    content.className = 'space-y-4 text-xs';

    content.innerHTML = `
      <!-- 1. Tipo de Beneficiario -->
      <div>
        <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Tipo de Beneficiario</label>
        <div class="grid grid-cols-2 gap-2">
          <button type="button" id="btn-tipo-prov" class="py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-2 bg-brand text-white border-brand shadow-xs">
            <i class="fa-solid fa-truck-field"></i>
            <span>Proveedor</span>
          </button>
          <button type="button" id="btn-tipo-cli" class="py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            <i class="fa-solid fa-user"></i>
            <span>Cliente</span>
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

      <!-- Cuadro dinámico de Pago Parcial -->
      <div id="modal-partial-box" class="p-3.5 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-brand/30 space-y-2 hidden">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
          <div>
            <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Monto Abonado / Pagado (Gs.)</label>
            <input type="text" id="modal-monto-pagado" value="0 Gs."
              class="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-bold focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <div class="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex flex-col justify-center">
            <span class="text-[10px] uppercase font-bold text-slate-500">Saldo Pendiente Calculado</span>
            <span id="modal-saldo-calc" class="text-sm font-mono font-black text-danger">0 Gs.</span>
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
          <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Fecha del Pago</label>
          <input type="date" id="pago-fecha" value="${getTodayISODate()}"
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

    // Contador numérico
    const counter = createQuantityCounter({ value: 1, min: 1 });
    content.querySelector('#counter-holder').appendChild(counter.element);

    const btnTipoProv = content.querySelector('#btn-tipo-prov');
    const btnTipoCli = content.querySelector('#btn-tipo-cli');
    const benBox = content.querySelector('#beneficiario-box');
    const prodBox = content.querySelector('#producto-box');

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
      } else {
        benBox.innerHTML = `
          <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Seleccionar o Escribir Cliente *</label>
          <div class="relative">
            <i class="fa-solid fa-user absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
            <input type="text" id="modal-cli-input" placeholder="Nombre del cliente o empresa..."
              class="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <div id="modal-cli-sug" class="mt-1 max-h-40 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg hidden"></div>
        `;

        const inp = benBox.querySelector('#modal-cli-input');
        const sug = benBox.querySelector('#modal-cli-sug');

        inp.addEventListener('input', (e) => {
          const clean = e.target.value.toLowerCase().trim();
          if (!clean) {
            sug.classList.add('hidden');
            return;
          }
          const filtered = state.catalogoClientes.filter((c) => {
            const nom = (c.nombres || c.razonSocial || c.nombreFantasia || '').toLowerCase();
            const tel = (c.whatsappCompleto || '').toLowerCase();
            return nom.includes(clean) || tel.includes(clean);
          });
          sug.innerHTML = '';
          if (filtered.length > 0) {
            filtered.slice(0, 5).forEach((c) => {
              const r = document.createElement('div');
              r.className = 'px-3.5 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer text-xs border-b border-slate-100 dark:border-slate-700/50 last:border-b-0';
              const nom = c.tipoCliente === 'empresa' ? c.razonSocial : `${c.nombres || ''} ${c.apellidos || ''}`.trim();
              r.innerHTML = `<span class="font-bold">${escapeHtml(nom)}</span> <span class="text-slate-400 text-[10px]">(${escapeHtml(c.whatsappCompleto || '')})</span>`;
              r.addEventListener('click', () => {
                inp.value = nom;
                sug.classList.add('hidden');
              });
              sug.appendChild(r);
            });
            sug.classList.remove('hidden');
          } else {
            sug.classList.add('hidden');
          }
        });
      }
    }

    btnTipoProv.addEventListener('click', () => {
      tipoBeneficiario = 'Proveedor';
      btnTipoProv.className = 'py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-2 bg-brand text-white border-brand shadow-xs';
      btnTipoCli.className = 'py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300';
      renderBeneficiarioUI();
    });

    btnTipoCli.addEventListener('click', () => {
      tipoBeneficiario = 'Cliente';
      btnTipoCli.className = 'py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-2 bg-brand text-white border-brand shadow-xs';
      btnTipoProv.className = 'py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300';
      renderBeneficiarioUI();
    });

    renderBeneficiarioUI();

    // UI de Producto (Catálogo o Temporal)
    function renderProductoUI() {
      prodBox.innerHTML = '';
      const topRow = document.createElement('div');
      topRow.className = 'flex items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-700';
      topRow.innerHTML = `<span class="text-xs font-bold text-slate-800 dark:text-slate-100">Producto o Insumo</span>`;

      const prodToggle = createIOSToggle({
        label: 'Producto temporal / manual',
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
              if (p.costoCompra) {
                const totalInp = content.querySelector('#pago-monto-total');
                totalInp.value = formatGuaranies(p.costoCompra * counter.getValue());
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
          <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Nombre del Producto / Insumo Temporal *</label>
          <input type="text" id="modal-prod-temp-name" placeholder="Ej. Tinta para sublimación negra 1L"
            class="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand" />
        `;
        prodBox.appendChild(wrap);
      }
    }
    renderProductoUI();

    // Cálculos de montos y saldo
    const totalInp = content.querySelector('#pago-monto-total');
    const montoPagadoInp = content.querySelector('#modal-monto-pagado');
    const saldoCalcEl = content.querySelector('#modal-saldo-calc');
    const partialBox = content.querySelector('#modal-partial-box');

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
      const n = parseGuaranies(e.target.value);
      e.target.value = formatGuaranies(n);
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
        } else {
          partialBox.classList.add('hidden');
        }
        updateMath();
      });
    });

    openModal({
      title: 'Generar Nuevo Pago',
      content: content,
      size: 'lg',
      confirmText: 'Guardar Pago',
      cancelText: 'Cancelar',
      confirmVariant: 'primary',
      onConfirm: async ({ close }) => {
        let provNombre = '';
        let provRuc = '';
        let provId = null;
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
            return false;
          }
        } else {
          const cliInp = content.querySelector('#modal-cli-input');
          cliNombre = cliInp ? cliInp.value.trim() : '';
          if (!cliNombre) {
            toast.error('Indique el nombre del cliente.');
            return false;
          }
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

        if (!prodNombre) {
          toast.error('Indique el nombre del producto.');
          return false;
        }

        const montoTotal = parseGuaranies(totalInp.value);
        if (montoTotal <= 0) {
          toast.error('El monto total debe ser mayor a 0 Gs.');
          return false;
        }

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
          if (montoPagado < 0) montoPagado = 0;
          if (montoPagado > montoTotal) montoPagado = montoTotal;
          saldoPendiente = Math.max(0, montoTotal - montoPagado);
        }

        const metodo = content.querySelector('#pago-metodo').value;
        const fecha = content.querySelector('#pago-fecha').value || getTodayISODate();
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
          proveedorId: provId,
          proveedorNombre: provNombre,
          proveedorRuc: provRuc,
          esProveedorTemporal: isProvTemporal,
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
          pedidoId: pedidoIdVal,
          notas: notasVal,
        };

        try {
          const res = await apiFetch('/api/pagos', {
            method: 'POST',
            body: JSON.stringify(payload),
          });

          toast.success(res?.message || 'Pago registrado exitosamente.');
          if (typeof close === 'function') close();
          await loadData();
        } catch (err) {
          console.error('[Error creando pago]', err);
          toast.error(err.message || 'Error al guardar el pago.');
          return false;
        }
      },
    });
  }

  // ==========================================================================
  // 7. MODAL: EDITAR PAGO EXISTENTE (Con auto-actualización inmediata)
  // ==========================================================================
  function openEditarPagoModal(pago) {
    let estadoPago = pago.estadoPago || 'Pendiente';

    const content = document.createElement('div');
    content.className = 'space-y-4 text-xs';

    content.innerHTML = `
      <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
        <div>
          <span class="text-[10px] uppercase font-bold text-slate-500">Editando Pago</span>
          <p class="text-sm font-black text-brand font-mono">${escapeHtml(pago.numeroPago)}</p>
        </div>
        <div class="text-right">
          <span class="text-[10px] text-slate-400">Beneficiario</span>
          <p class="font-bold text-slate-800 dark:text-slate-100">${escapeHtml(pago.proveedorNombre || pago.clienteNombre)}</p>
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

      <div id="edit-partial-box" class="p-3.5 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-brand/30 space-y-2 ${estadoPago === 'Pago Parcial' ? '' : 'hidden'}">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
          <div>
            <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Monto Abonado / Pagado (Gs.)</label>
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
          <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Fecha del Pago</label>
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
    const saldoCalcEl = content.querySelector('#edit-saldo-calc');
    const partialBox = content.querySelector('#edit-partial-box');

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
          if (montoPagado < 0) montoPagado = 0;
          if (montoPagado > montoTotal) montoPagado = montoTotal;
          saldoPendiente = Math.max(0, montoTotal - montoPagado);
        }

        const payload = {
          ...pago,
          montoTotal: montoTotal,
          montoPagado: montoPagado,
          saldoPendiente: saldoPendiente,
          estadoPago: estadoPago,
          metodoPago: content.querySelector('#edit-metodo').value,
          fechaPago: content.querySelector('#edit-fecha').value || pago.fechaPago,
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
      { id: 'beneficiario', label: 'Beneficiario', default: true, getValue: (r) => (r.tipoBeneficiario === 'Proveedor' ? r.proveedorNombre : r.clienteNombre) },
      { id: 'documento', label: 'Documento / RUC', default: true, getValue: (r) => (r.tipoBeneficiario === 'Proveedor' ? r.proveedorRuc : r.clienteDocumento) },
      { id: 'productoNombre', label: 'Producto / Insumo', default: true, getValue: (r) => r.productoNombre },
      { id: 'cantidad', label: 'Cantidad', default: true, getValue: (r) => r.cantidad },
      { id: 'destino', label: 'Destinado a (Cliente / Pedido)', default: true, getValue: (r) => (r.numeroPedido || r.clienteNombre ? `${r.numeroPedido || ''} - ${r.clienteNombre || ''}`.trim() : 'Compra directa') },
      { id: 'montoTotal', label: 'Monto Total (Gs.)', default: true, isMoney: true, getValue: (r) => formatGuaranies(r.montoTotal) },
      { id: 'montoPagado', label: 'Monto Pagado (Gs.)', default: true, isMoney: true, getValue: (r) => formatGuaranies(r.montoPagado) },
      { id: 'saldoPendiente', label: 'Saldo Pendiente (Gs.)', default: true, isMoney: true, getValue: (r) => formatGuaranies(r.saldoPendiente) },
      { id: 'estadoPago', label: 'Estado del Pago', default: true, getValue: (r) => r.estadoPago },
      { id: 'metodoPago', label: 'Método de Pago', default: true, getValue: (r) => r.metodoPago || 'Efectivo' },
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
