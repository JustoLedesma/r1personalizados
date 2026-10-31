import { createButton } from '../components/button.js';
import { openConfirmModal, openModal } from '../components/modal.js';
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

function parseGuaranies(val) {
  if (typeof val === 'number') return val;
  const digits = String(val || '').replace(/[^\d]/g, '');
  return Number(digits) || 0;
}

function formatDateTimeFull(isoStr) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return String(isoStr);
  const fecha = d.toLocaleDateString('es-PY', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const hora = d.toLocaleTimeString('es-PY', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  return `${fecha} a las ${hora}`;
}

function formatDateOnly(dateStr) {
  if (!dateStr) return '—';
  const parts = String(dateStr).split('T')[0].split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

function getTodayIsoDate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getISOWeekNumber(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
}

/**
 * Switch tipo iOS (pista redondeada tipo píldora, perilla blanca circular, transición suave)
 */
function createIOSToggle({ label = '', checked = false, onChange = null, activeColor = 'emerald' }) {
  const wrap = document.createElement('label');
  wrap.className = 'inline-flex items-center gap-2.5 cursor-pointer select-none';

  const isEmerald = activeColor === 'emerald';
  const activeBg = isEmerald ? 'bg-emerald-500' : (activeColor === 'blue' ? 'bg-blue-600' : 'bg-brand');

  wrap.innerHTML = `
    <span class="text-xs font-semibold text-slate-700 dark:text-slate-300">${escapeHtml(label)}</span>
    <div class="relative inline-flex items-center">
      <input type="checkbox" class="sr-only peer" ${checked ? 'checked' : ''} />
      <div class="w-11 h-6 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:${activeBg}"></div>
    </div>
  `;

  const input = wrap.querySelector('input');
  input.addEventListener('change', (e) => {
    if (typeof onChange === 'function') {
      onChange(e.target.checked);
    }
  });

  return {
    element: wrap,
    isChecked: () => input.checked,
    setChecked: (val) => {
      input.checked = Boolean(val);
    },
  };
}

export function renderPedidosModule(container) {
  container.innerHTML = '';

  const state = {
    view: 'list', // 'list' | 'form' | 'detail'
    editingId: null,
    viewingOrder: null,

    // Filtros de listado
    filters: {
      q: '',
      estado: '', // '' = Todos, 'Creado', 'En Producción', 'En Pausa', 'Listo', 'Cancelado'
      financiero: 'todos', // 'todos', 'cobros_hoy', 'cobros_semanales', 'cobros_mes', 'pagos_pendientes', 'saldos_pendientes'
      semanas: [], // Array de números de semana seleccionadas (Ctrl para selección múltiple)
      page: 1,
      pageSize: 20,
    },
    totalSemanasAnio: 52,
    anioActual: new Date().getFullYear(),
    showWeeklyFilter: false, // Por defecto oculto

    // Datos del listado
    items: [],
    total: 0,
    loading: false,

    // Contadores para tarjetas
    stats: {
      total: 0,
      creados: 0,
      enProduccion: 0,
      enPausa: 0,
      listos: 0,
      cancelados: 0,
    },

    fechaHoy: new Date().toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    semanaActual: getISOWeekNumber(new Date()),

    // Catálogos para el formulario
    catalogoClientes: [],
    catalogoProductos: [],
    catalogoProveedores: [],

    // Formulario actual
    form: getInitialFormData(),
  };

  function getInitialFormData() {
    return {
      fechaPedido: getTodayIsoDate(),
      clienteCasual: false,
      clienteId: null,
      clienteNombre: '',
      clienteTelefono: '',
      clienteDocumento: '',
      clienteDireccion: '',

      // Ítems
      items: [],

      // Proveedores
      proveedores: [],

      // Condición de venta y entrega
      condicionVenta: 'Contado', // 'Contado' | 'Credito'
      tipoPago: 'Total', // 'Total' | 'Parcial'
      fechaCobro: '',
      montoAbonado: 0,
      modalidadEntrega: 'Retiro en Local', // 'Retiro en Local' | 'Envío a Domicilio' | 'Encomienda' | 'Otro'
      modalidadEntregaOtro: '',

      // Notas de producción
      notasProduccion: '',
    };
  }

  // Cargar pedidos desde la API
  async function fetchPedidos() {
    state.loading = true;
    render();
    try {
      const params = new URLSearchParams();
      if (state.filters.q) params.set('q', state.filters.q);
      if (state.filters.estado) params.set('estado', state.filters.estado);
      if (state.filters.financiero) params.set('financiero', state.filters.financiero);
      if (Array.isArray(state.filters.semanas) && state.filters.semanas.length > 0) {
        params.set('semanas', state.filters.semanas.join(','));
      }
      params.set('page', String(state.filters.page));
      params.set('page_size', String(state.filters.pageSize));

      const res = await apiFetch(`/api/pedidos?${params.toString()}`);
      if (res) {
        state.items = Array.isArray(res.data) ? res.data : [];
        state.total = Number(res.total) || 0;
        if (res.stats) state.stats = res.stats;
        if (res.fechaHoy) state.fechaHoy = res.fechaHoy;
        if (res.semanaActual) state.semanaActual = res.semanaActual;
        if (res.totalSemanasAnio) state.totalSemanasAnio = res.totalSemanasAnio;
        if (res.anioActual) state.anioActual = res.anioActual;
      }
    } catch (err) {
      console.warn('[Pedidos] Error al cargar lista:', err);
    } finally {
      state.loading = false;
      render();
    }
  }

  // Carga previa de catálogos para búsqueda rápida
  async function loadFormCatalogs() {
    try {
      const [cRes, pRes, prRes] = await Promise.all([
        apiFetch('/api/clientes?page=1&page_size=200').catch(() => ({ data: [] })),
        apiFetch('/api/productos?page=1&page_size=200').catch(() => ({ data: [] })),
        apiFetch('/api/proveedores?page=1&page_size=200').catch(() => ({ data: [] })),
      ]);
      state.catalogoClientes = Array.isArray(cRes?.data) ? cRes.data : [];
      state.catalogoProductos = Array.isArray(pRes?.data) ? pRes.data : [];
      state.catalogoProveedores = Array.isArray(prRes?.data) ? prRes.data : [];
    } catch (err) {
      console.warn('[Pedidos] Error cargando catálogos:', err);
    }
  }

  function render() {
    container.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.className = 'w-full space-y-6';

    if (state.view === 'list') {
      renderListView(wrapper);
    } else if (state.view === 'detail') {
      renderDetailView(wrapper);
    } else {
      renderFormView(wrapper);
    }

    container.appendChild(wrapper);
  }

  // ============================================================================
  // VISTA 1: LISTA DE PEDIDOS (Captura 1)
  // ============================================================================
  function renderListView(parent) {
    // 1. Barra superior: Título, Indicadores de Fecha y Semana, Botón "+ Crear Pedido"
    const topBar = document.createElement('div');
    topBar.className =
      'flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200/80 dark:border-slate-800';

    const titleLeft = document.createElement('div');
    titleLeft.className = 'flex flex-wrap items-center gap-3';
    titleLeft.innerHTML = `
      <div class="flex items-center gap-2">
        <div class="w-9 h-9 rounded-xl bg-brand-soft dark:bg-brand/20 text-brand flex items-center justify-center text-lg">
          <i class="fa-regular fa-clipboard"></i>
        </div>
        <h1 class="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
          Pedidos
        </h1>
      </div>
      <div class="flex items-center gap-2 text-xs">
        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold shadow-2xs">
          <i class="fa-regular fa-calendar text-brand text-[11px]"></i>
          <span>Fecha de hoy: <strong class="text-slate-900 dark:text-white">${state.fechaHoy}</strong></span>
        </span>
        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold shadow-2xs">
          <i class="fa-solid fa-clock-rotate-left text-brand text-[11px]"></i>
          <span>Semana actual: <strong class="text-brand">Semana ${state.semanaActual}</strong></span>
        </span>
      </div>
    `;

    const rightBtn = createButton({
      text: 'Crear Pedido',
      icon: 'fa-solid fa-plus',
      variant: 'primary',
      size: 'md',
      onClick: () => {
        state.editingId = null;
        state.form = getInitialFormData();
        state.view = 'form';
        render();
        loadFormCatalogs();
      },
    });

    topBar.append(titleLeft, rightBtn);
    parent.appendChild(topBar);

    // 2. Filtro Financiero (Chips)
    const finCard = document.createElement('div');
    finCard.className =
      'p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4';

    const finTitle = document.createElement('div');
    finTitle.className = 'flex items-center gap-3';
    finTitle.innerHTML = `
      <div class="w-8 h-8 rounded-xl bg-brand-soft/70 dark:bg-brand/15 text-brand flex items-center justify-center text-sm shrink-0">
        <i class="fa-solid fa-filter"></i>
      </div>
      <div>
        <h2 class="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">Filtro Financiero</h2>
        <p class="text-[11px] text-slate-400">Filtrar clientes, productos solicitados y estado de cuenta (pagado o saldo en deuda)</p>
      </div>
    `;

    const finChips = document.createElement('div');
    finChips.className = 'flex flex-wrap items-center gap-1.5';

    const chipsData = [
      { id: 'todos', label: 'Todos', dotColor: '' },
      { id: 'cobros_hoy', label: 'Cobros de Hoy', dotColor: 'bg-emerald-500' },
      { id: 'cobros_semanales', label: 'Cobros Semanales', dotColor: 'bg-blue-500' },
      { id: 'cobros_mes', label: 'Cobros del Mes', dotColor: 'bg-purple-500' },
      { id: 'pagos_pendientes', label: 'Pagos Pendientes', dotColor: 'bg-amber-500' },
      { id: 'saldos_pendientes', label: 'Saldos Pendientes', dotColor: 'bg-rose-500' },
    ];

    chipsData.forEach((ch) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      const isActive = state.filters.financiero === ch.id;
      btn.className = `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
        isActive
          ? 'bg-brand text-white shadow-xs'
          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
      }`;
      btn.innerHTML = `
        ${ch.dotColor ? `<span class="w-2 h-2 rounded-full ${ch.dotColor}"></span>` : ''}
        <span>${ch.label}</span>
      `;
      btn.addEventListener('click', () => {
        state.filters.financiero = ch.id;
        state.filters.page = 1;
        fetchPedidos();
      });
      finChips.appendChild(btn);
    });

    finCard.append(finTitle, finChips);
    parent.appendChild(finCard);

    // 2.1 Filtro Semanal (Tira larga de semanas ISO con selección múltiple con CTRL y Switch Mostrar/Ocultar)
    const weekCard = document.createElement('div');
    weekCard.className =
      'p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3';

    const weekCardHeader = document.createElement('div');
    weekCardHeader.className = `flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
      state.showWeeklyFilter ? 'pb-2 border-b border-slate-100 dark:border-slate-800/80' : ''
    }`;

    const selectedCount = state.filters.semanas.length;
    let badgeHtml = '';
    if (selectedCount === 1) {
      badgeHtml = `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-brand/10 text-brand text-xs font-bold border border-brand/30">Semana ${state.filters.semanas[0]}</span>`;
    } else if (selectedCount > 1) {
      badgeHtml = `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-brand/10 text-brand text-xs font-bold border border-brand/30">${selectedCount} semanas</span>`;
    }

    const headerLeft = document.createElement('div');
    headerLeft.className = 'flex items-center gap-3';
    headerLeft.innerHTML = `
      <div class="w-8 h-8 rounded-xl bg-brand-soft/70 dark:bg-brand/15 text-brand flex items-center justify-center text-sm shrink-0">
        <i class="fa-regular fa-calendar-days"></i>
      </div>
      <div>
        <div class="flex items-center gap-2">
          <h2 class="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">Filtro Semanal</h2>
          <span class="text-[10px] uppercase font-mono font-bold text-slate-400">Año ${state.anioActual || 2026}</span>
          ${badgeHtml}
        </div>
        <p class="text-[11px] text-slate-400">
          Filtro secundario por semana. Mantén presionada la tecla <strong>CTRL</strong> para seleccionar dos o más semanas a la vez.
        </p>
      </div>
    `;

    const headerRight = document.createElement('div');
    headerRight.className = 'flex items-center gap-3 shrink-0';

    if (selectedCount > 0) {
      const resetBtn = createButton({
        text: 'Todas',
        icon: 'fa-solid fa-rotate-left',
        variant: 'cancel',
        size: 'sm',
        onClick: () => {
          state.filters.semanas = [];
          state.filters.page = 1;
          fetchPedidos();
        },
      });
      headerRight.appendChild(resetBtn);
    }

    // Switch iOS para mostrar / ocultar el filtro semanal (oculto por defecto)
    const toggleWeekFilter = createIOSToggle({
      label: 'Mostrar filtro semanal',
      checked: Boolean(state.showWeeklyFilter),
      activeColor: 'blue',
      onChange: (checked) => {
        state.showWeeklyFilter = checked;
        if (checked) {
          weekCardHeader.classList.add('pb-2', 'border-b', 'border-slate-100', 'dark:border-slate-800/80');
          stripWrap.classList.remove('hidden');
          setTimeout(() => {
            const currentEl = strip.querySelector('[data-current="true"]');
            if (currentEl) {
              currentEl.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
            }
          }, 50);
        } else {
          weekCardHeader.classList.remove('pb-2', 'border-b', 'border-slate-100', 'dark:border-slate-800/80');
          stripWrap.classList.add('hidden');
        }
      },
    });
    headerRight.appendChild(toggleWeekFilter.element);

    weekCardHeader.append(headerLeft, headerRight);

    // Tira horizontal de semanas (oculta por defecto si showWeeklyFilter es false)
    const stripWrap = document.createElement('div');
    stripWrap.className = `relative flex items-center pt-1 transition-all ${
      state.showWeeklyFilter ? '' : 'hidden'
    }`;

    const strip = document.createElement('div');
    strip.className =
      'flex items-center gap-1.5 overflow-x-auto pb-2 pt-1 w-full scrollbar-thin select-none scroll-smooth';

    const totalWeeks = state.totalSemanasAnio || 52;
    const currentWeekNum = state.semanaActual || 1;

    for (let w = 1; w <= totalWeeks; w++) {
      const isCurrentWeek = w === currentWeekNum;
      const isEnabled = w <= currentWeekNum;
      const isSelected = state.filters.semanas.includes(w);

      const weekBtn = document.createElement('button');
      weekBtn.type = 'button';

      if (!isEnabled) {
        // Semanas futuras deshabilitadas
        weekBtn.disabled = true;
        weekBtn.className =
          'shrink-0 px-2.5 py-1.5 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-slate-300 dark:text-slate-600 text-xs font-mono opacity-40 cursor-not-allowed flex items-center gap-1';
        weekBtn.title = `Semana ${w} (Futura / No disponible)`;
        weekBtn.innerHTML = `<span>S${w}</span>`;
      } else {
        // Semanas habilitadas
        if (isCurrentWeek) {
          weekBtn.setAttribute('data-current', 'true');
        }

        weekBtn.className = `shrink-0 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1 ${
          isSelected
            ? 'bg-brand text-white font-black shadow-xs ring-2 ring-brand/40 border border-brand'
            : isCurrentWeek
            ? 'bg-brand/10 dark:bg-brand/20 text-brand font-bold border border-brand/50 hover:bg-brand/20'
            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
        }`;

        weekBtn.title = `Semana ${w}${isCurrentWeek ? ' (Semana Actual)' : ''} · Clic para filtrar / Ctrl+Clic para selección múltiple`;
        weekBtn.innerHTML = `
          <span class="font-mono">S${w}</span>
          ${isCurrentWeek ? '<span class="text-[9px] uppercase px-1 py-0.2 rounded bg-brand/20 text-brand font-black ml-0.5">Hoy</span>' : ''}
        `;

        weekBtn.addEventListener('click', (e) => {
          const isMulti = e.ctrlKey || e.metaKey;
          let currentSet = new Set(state.filters.semanas);

          if (isMulti) {
            if (currentSet.has(w)) {
              currentSet.delete(w);
            } else {
              currentSet.add(w);
            }
          } else {
            if (currentSet.has(w) && currentSet.size === 1) {
              currentSet.clear();
            } else {
              currentSet = new Set([w]);
            }
          }

          state.filters.semanas = Array.from(currentSet).sort((a, b) => a - b);
          state.filters.page = 1;
          fetchPedidos();
        });
      }

      strip.appendChild(weekBtn);
    }

    stripWrap.appendChild(strip);
    weekCard.append(weekCardHeader, stripWrap);
    parent.appendChild(weekCard);

    // Auto-scroll centrado a la semana actual al estar visible
    if (state.showWeeklyFilter) {
      setTimeout(() => {
        const currentEl = strip.querySelector('[data-current="true"]');
        if (currentEl) {
          currentEl.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
        }
      }, 60);
    }

    // 3. Tarjetas Contadoras por Estado (6 tarjetas con contadores reales)
    const cardsGrid = document.createElement('div');
    cardsGrid.className = 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3';

    const countersData = [
      {
        id: '',
        label: 'Total Pedidos',
        count: state.stats.total,
        icon: 'fa-regular fa-folder',
        iconColor: 'text-slate-400',
      },
      {
        id: 'Creado',
        label: 'Creados',
        count: state.stats.creados,
        icon: 'fa-solid fa-plus',
        iconColor: 'text-blue-500',
      },
      {
        id: 'En Producción',
        label: 'En Producción',
        count: state.stats.enProduccion,
        icon: 'fa-solid fa-gear',
        iconColor: 'text-amber-500',
      },
      {
        id: 'En Pausa',
        label: 'En Pausa',
        count: state.stats.enPausa,
        icon: 'fa-regular fa-circle-pause',
        iconColor: 'text-orange-500',
      },
      {
        id: 'Listo',
        label: 'Listos',
        count: state.stats.listos,
        icon: 'fa-regular fa-circle-check',
        iconColor: 'text-emerald-500',
      },
      {
        id: 'Cancelado',
        label: 'Cancelados',
        count: state.stats.cancelados,
        icon: 'fa-solid fa-ban',
        iconColor: 'text-rose-500',
      },
    ];

    countersData.forEach((cd) => {
      const card = document.createElement('div');
      const isCardActive = state.filters.estado === cd.id;
      card.className = `p-4 rounded-2xl bg-white dark:bg-slate-900 border transition cursor-pointer shadow-xs select-none ${
        isCardActive
          ? 'border-brand ring-2 ring-brand/30 dark:border-brand'
          : 'border-slate-200/80 dark:border-slate-800 hover:border-brand/40'
      }`;
      card.innerHTML = `
        <div class="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
          <span class="font-bold truncate">${cd.label}</span>
          <i class="${cd.icon} ${cd.iconColor} text-sm"></i>
        </div>
        <p class="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">${cd.count}</p>
      `;
      card.addEventListener('click', () => {
        state.filters.estado = cd.id;
        state.filters.page = 1;
        fetchPedidos();
      });
      cardsGrid.appendChild(card);
    });

    parent.appendChild(cardsGrid);

    // 4. Barra de búsqueda y título de lista
    const tableHeaderCard = document.createElement('div');
    tableHeaderCard.className =
      'p-4 rounded-t-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 border-b-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs';

    const listTitle = document.createElement('h3');
    listTitle.className = 'text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2';
    listTitle.innerHTML = `<i class="fa-solid fa-list-check text-brand"></i><span>Lista de Pedidos</span>`;

    const searchWrap = document.createElement('div');
    searchWrap.className = 'relative w-full sm:max-w-md';
    searchWrap.innerHTML = `
      <i class="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
      <input type="text" id="pedido-search-input" value="${escapeHtml(state.filters.q)}"
        placeholder="Buscar por N° pedido, cliente o teléfono..."
        class="w-full pl-9 pr-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/50 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand" />
    `;
    const searchInput = searchWrap.querySelector('#pedido-search-input');
    let searchDebounce = null;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => {
        state.filters.q = e.target.value;
        state.filters.page = 1;
        fetchPedidos();
      }, 350);
    });

    tableHeaderCard.append(listTitle, searchWrap);

    // 5. Tabla de Pedidos
    const tableWrap = document.createElement('div');
    tableWrap.className =
      'w-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-b-2xl overflow-hidden shadow-xs';

    const overflowBox = document.createElement('div');
    overflowBox.className = 'w-full overflow-x-auto';

    const table = document.createElement('table');
    table.className = 'w-full text-left border-collapse';

    const thead = document.createElement('thead');
    thead.className =
      'bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold';
    thead.innerHTML = `
      <tr>
        <th class="px-4 py-3 select-none text-left">N° Pedido</th>
        <th class="px-4 py-3 select-none text-left">Cliente</th>
        <th class="px-4 py-3 select-none text-left">Productos / Ítems</th>
        <th class="px-4 py-3 select-none text-left">Costo Total</th>
        <th class="px-4 py-3 select-none text-left">Pago</th>
        <th class="px-4 py-3 select-none text-left">Pagado / Saldo</th>
        <th class="px-4 py-3 select-none text-left">Progreso</th>
        <th class="px-4 py-3 select-none text-right">Acciones</th>
      </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    tbody.className = 'divide-y divide-slate-100 dark:divide-slate-800/80 text-xs sm:text-sm';

    if (state.loading) {
      for (let i = 0; i < 4; i++) {
        const skelRow = document.createElement('tr');
        skelRow.className = 'animate-pulse';
        skelRow.innerHTML = `
          <td class="px-4 py-3"><div class="h-4 w-20 rounded bg-slate-100 dark:bg-slate-800"></div></td>
          <td class="px-4 py-3"><div class="h-4 w-32 rounded bg-slate-100 dark:bg-slate-800 mb-1"></div><div class="h-3 w-20 rounded bg-slate-100 dark:bg-slate-800"></div></td>
          <td class="px-4 py-3"><div class="h-4 w-28 rounded bg-slate-100 dark:bg-slate-800"></div></td>
          <td class="px-4 py-3"><div class="h-4 w-24 rounded bg-slate-100 dark:bg-slate-800"></div></td>
          <td class="px-4 py-3"><div class="h-5 w-16 rounded-full bg-slate-100 dark:bg-slate-800"></div></td>
          <td class="px-4 py-3"><div class="h-4 w-24 rounded bg-slate-100 dark:bg-slate-800"></div></td>
          <td class="px-4 py-3"><div class="h-5 w-20 rounded-full bg-slate-100 dark:bg-slate-800"></div></td>
          <td class="px-4 py-3 text-right"><div class="h-8 w-24 rounded-lg bg-slate-100 dark:bg-slate-800 ml-auto"></div></td>
        `;
        tbody.appendChild(skelRow);
      }
    } else if (state.items.length === 0) {
      const emptyRow = document.createElement('tr');
      emptyRow.innerHTML = `
        <td colspan="8" class="py-16 px-4 text-center">
          <div class="w-12 h-12 mx-auto rounded-xl bg-brand-soft/50 dark:bg-brand/10 text-brand flex items-center justify-center text-xl mb-2">
            <i class="fa-regular fa-folder-open"></i>
          </div>
          <p class="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">
            No hay pedidos registrados con los filtros seleccionados.
          </p>
          <p class="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Haga clic en "+ Crear Pedido" para registrar una nueva orden de trabajo.
          </p>
        </td>
      `;
      tbody.appendChild(emptyRow);
    } else {
      state.items.forEach((p) => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors';

        // 1. N° Pedido + Semana ISO (ej. S44) + Fecha Pedido
        const tdNumero = document.createElement('td');
        tdNumero.className = 'px-4 py-3';
        tdNumero.innerHTML = `
          <div class="flex flex-col">
            <div class="flex items-center gap-1.5">
              <button type="button" class="btn-order-view font-mono text-xs font-bold text-brand hover:underline cursor-pointer focus:outline-none">
                ${escapeHtml(p.numeroPedido)}
              </button>
              <span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700" title="Semana ISO ${p.semanaIso}">
                S${p.semanaIso}
              </span>
            </div>
            <span class="text-[10px] text-slate-400 font-medium mt-0.5">${formatDateOnly(p.fechaPedido)}</span>
          </div>
        `;
        tdNumero.querySelector('.btn-order-view')?.addEventListener('click', () => openOrderDetail(p));

        // 2. Cliente (con badge Casual si aplica)
        const tdCliente = document.createElement('td');
        tdCliente.className = 'px-4 py-3';
        tdCliente.innerHTML = `
          <div class="cursor-pointer max-w-[200px]">
            <div class="flex items-center gap-1.5 truncate">
              <span class="font-bold text-slate-800 dark:text-slate-100 hover:text-brand transition truncate">${escapeHtml(p.clienteNombre)}</span>
              ${p.clienteCasual ? '<span class="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 shrink-0">Casual</span>' : ''}
            </div>
            <p class="text-[11px] text-slate-400 truncate">${escapeHtml(p.clienteTelefono || p.clienteDocumento || 'Sin contacto')}</p>
          </div>
        `;
        tdCliente.addEventListener('click', () => openOrderDetail(p));

        // 3. Productos / Ítems
        const tdItems = document.createElement('td');
        tdItems.className = 'px-4 py-3';
        const itemCount = Array.isArray(p.items) ? p.items.length : 0;
        let itemsSummary = '';
        if (itemCount > 0) {
          itemsSummary = p.items.map((it) => `${Math.round(it.cantidad)}x ${it.nombreProducto}`).join(', ');
        }
        tdItems.innerHTML = `
          <div class="max-w-[220px]">
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-brand-soft/70 dark:bg-brand/20 text-brand">
              <i class="fa-solid fa-cube text-[9px]"></i>
              <span>${itemCount} ${itemCount === 1 ? 'ítem' : 'ítems'}</span>
            </span>
            <p class="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-1" title="${escapeHtml(itemsSummary)}">
              ${escapeHtml(itemsSummary || 'Sin detalles')}
            </p>
          </div>
        `;

        // 4. Costo Total (Gs.)
        const tdTotal = document.createElement('td');
        tdTotal.className = 'px-4 py-3 font-black text-xs sm:text-sm text-slate-900 dark:text-white';
        tdTotal.textContent = formatGuaranies(p.montoTotal);

        // 5. Pago (Contado / Crédito)
        const tdPago = document.createElement('td');
        tdPago.className = 'px-4 py-3';
        const isContado = p.condicionVenta === 'Contado';
        tdPago.innerHTML = `
          <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
            isContado
              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
              : 'bg-purple-50 dark:bg-purple-950/60 text-brand dark:text-purple-300 border border-purple-200 dark:border-purple-800'
          }">
            ${escapeHtml(p.condicionVenta)}
          </span>
        `;

        // 6. Pagado / Saldo
        const tdSaldo = document.createElement('td');
        tdSaldo.className = 'px-4 py-3 text-xs';
        const saldo = Number(p.saldoPendiente) || 0;
        const pagado = Number(p.montoPagado) || 0;
        if (saldo <= 0) {
          tdSaldo.innerHTML = `
            <span class="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
              <i class="fa-solid fa-check text-[10px]"></i> Total Pagado
            </span>
          `;
        } else {
          tdSaldo.innerHTML = `
            <div>
              <p class="text-slate-500 dark:text-slate-400">Pagado: <strong>${formatGuaranies(pagado)}</strong></p>
              <p class="text-rose-600 dark:text-rose-400 font-bold">Saldo: ${formatGuaranies(saldo)}</p>
            </div>
          `;
        }

        // 7. Progreso / Estado
        const tdEstado = document.createElement('td');
        tdEstado.className = 'px-4 py-3';
        let estadoBadgeColor = 'bg-blue-50 text-blue-600 border-blue-200';
        if (p.estado === 'En Producción') estadoBadgeColor = 'bg-amber-50 text-amber-600 border-amber-200';
        else if (p.estado === 'En Pausa') estadoBadgeColor = 'bg-orange-50 text-orange-600 border-orange-200';
        else if (p.estado === 'Listo') estadoBadgeColor = 'bg-emerald-50 text-emerald-600 border-emerald-200';
        else if (p.estado === 'Cancelado') estadoBadgeColor = 'bg-rose-50 text-rose-600 border-rose-200';

        const stateBtn = document.createElement('button');
        stateBtn.type = 'button';
        stateBtn.className = `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition cursor-pointer ${estadoBadgeColor}`;
        stateBtn.innerHTML = `
          <span>${escapeHtml(p.estado)}</span>
          <i class="fa-solid fa-chevron-down text-[8px] opacity-60"></i>
        `;
        stateBtn.title = 'Clic para abrir el menú de progreso y estados';
        stateBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          openOrderProgressMenu(stateBtn, p);
        });
        tdEstado.appendChild(stateBtn);

        // 8. Acciones
        const tdAcciones = document.createElement('td');
        tdAcciones.className = 'px-4 py-3 text-right';
        const actWrap = document.createElement('div');
        actWrap.className = 'flex items-center justify-end gap-1.5';

        const viewBtn = createButton({
          icon: 'fa-regular fa-eye',
          variant: 'ghost',
          size: 'sm',
          ariaLabel: 'Ver pedido',
          onClick: () => openOrderDetail(p),
        });

        const editBtn = createButton({
          icon: 'fa-regular fa-pen-to-square',
          variant: 'ghost',
          size: 'sm',
          ariaLabel: 'Editar pedido',
          onClick: () => editOrder(p),
        });

        const delBtn = createButton({
          icon: 'fa-regular fa-trash-can',
          variant: 'danger',
          size: 'sm',
          ariaLabel: 'Cancelar y enviar pedido a reciclaje',
          onClick: () => confirmDeleteOrder(p),
        });

        actWrap.append(viewBtn, editBtn, delBtn);
        tdAcciones.appendChild(actWrap);

        tr.append(tdNumero, tdCliente, tdItems, tdTotal, tdPago, tdSaldo, tdEstado, tdAcciones);
        tbody.appendChild(tr);
      });
    }

    table.appendChild(tbody);
    overflowBox.appendChild(table);
    tableWrap.appendChild(overflowBox);

    // Paginación estándar si supera 20 registros (AGENTS.md Regla 6)
    if (state.total > 20) {
      const totalPages = Math.max(1, Math.ceil(state.total / state.filters.pageSize));
      const curr = state.filters.page;
      const startItem = (curr - 1) * state.filters.pageSize + 1;
      const endItem = Math.min(curr * state.filters.pageSize, state.total);

      const pager = document.createElement('div');
      pager.className =
        'p-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs';

      const info = document.createElement('span');
      info.className = 'text-slate-500 dark:text-slate-400';
      info.textContent = `Mostrando ${startItem}–${endItem} de ${state.total}`;

      const controls = document.createElement('div');
      controls.className = 'flex items-center gap-1';

      controls.appendChild(
        createButton({
          text: 'Anterior',
          variant: 'cancel',
          size: 'sm',
          disabled: curr <= 1,
          onClick: () => {
            state.filters.page -= 1;
            fetchPedidos();
          },
        })
      );

      const pages = [];
      if (totalPages <= 7) {
        for (let i = 1; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        if (curr > 3) pages.push('...');
        const s = Math.max(2, curr - 1);
        const e = Math.min(totalPages - 1, curr + 1);
        for (let i = s; i <= e; i++) pages.push(i);
        if (curr < totalPages - 2) pages.push('...');
        pages.push(totalPages);
      }

      pages.forEach((p) => {
        if (p === '...') {
          const dots = document.createElement('span');
          dots.className = 'px-2 text-slate-400';
          dots.textContent = '…';
          controls.appendChild(dots);
        } else {
          controls.appendChild(
            createButton({
              text: String(p),
              variant: p === curr ? 'primary' : 'cancel',
              size: 'sm',
              onClick: () => {
                state.filters.page = p;
                fetchPedidos();
              },
            })
          );
        }
      });

      controls.appendChild(
        createButton({
          text: 'Siguiente',
          variant: 'cancel',
          size: 'sm',
          disabled: curr >= totalPages,
          onClick: () => {
            state.filters.page += 1;
            fetchPedidos();
          },
        })
      );

      pager.append(info, controls);
      tableWrap.appendChild(pager);
    }

    parent.append(tableHeaderCard, tableWrap);
  }

  // Menú desplegable del botón de Progreso en la tabla de pedidos
  function openOrderProgressMenu(anchorEl, order) {
    document.querySelectorAll('.order-progress-dropdown-menu').forEach((el) => el.remove());

    const menu = document.createElement('div');
    menu.className =
      'order-progress-dropdown-menu fixed z-50 w-64 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-1.5 text-xs text-slate-700 dark:text-slate-200 animate-in fade-in zoom-in-95 duration-100 space-y-1';

    const rect = anchorEl.getBoundingClientRect();
    const top = rect.bottom + 6;
    let left = rect.left;
    if (left + 260 > window.innerWidth - 10) {
      left = window.innerWidth - 270;
    }
    menu.style.top = `${top}px`;
    menu.style.left = `${Math.max(10, left)}px`;

    const header = document.createElement('div');
    header.className =
      'px-3 py-1.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400';
    header.innerHTML = `
      <span>Flujo de Producción</span>
      <span class="font-mono text-brand font-bold">${escapeHtml(order.numeroPedido)}</span>
    `;
    menu.appendChild(header);

    const itemsWrap = document.createElement('div');
    itemsWrap.className = 'space-y-0.5';

    // 1. Creado
    const isCreado = order.estado === 'Creado';
    const btnCreado = document.createElement('button');
    btnCreado.type = 'button';
    btnCreado.className = `w-full flex items-center justify-between px-3 py-2 rounded-xl text-left hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors cursor-pointer ${
      isCreado ? 'bg-blue-50/60 dark:bg-blue-950/40 text-blue-600 font-bold' : ''
    }`;
    btnCreado.innerHTML = `
      <div class="flex items-center gap-2.5">
        <span class="w-6 h-6 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center text-xs">
          <i class="fa-regular fa-clipboard"></i>
        </span>
        <div>
          <p class="font-bold text-slate-800 dark:text-slate-100">1. Creado</p>
          <p class="text-[10px] text-slate-400">Registrado / Pendiente de taller</p>
        </div>
      </div>
      ${isCreado ? '<i class="fa-solid fa-check text-blue-600 text-xs"></i>' : ''}
    `;
    btnCreado.addEventListener('click', async () => {
      menu.remove();
      if (!isCreado) await changeOrderState(order.id, 'Creado', order.numeroPedido);
    });
    itemsWrap.appendChild(btnCreado);

    // 2. En Pausa
    const isPausa = order.estado === 'En Pausa';
    const btnPausa = document.createElement('button');
    btnPausa.type = 'button';
    btnPausa.className = `w-full flex items-center justify-between px-3 py-2 rounded-xl text-left hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors cursor-pointer ${
      isPausa ? 'bg-amber-50/60 dark:bg-amber-950/40 text-amber-600 font-bold' : ''
    }`;
    btnPausa.innerHTML = `
      <div class="flex items-center gap-2.5">
        <span class="w-6 h-6 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center text-xs">
          <i class="fa-solid fa-circle-pause"></i>
        </span>
        <div>
          <p class="font-bold text-slate-800 dark:text-slate-100">2. En Pausa</p>
          <p class="text-[10px] text-slate-400">Pausar producción temporalmente</p>
        </div>
      </div>
      ${isPausa ? '<i class="fa-solid fa-check text-amber-600 text-xs"></i>' : ''}
    `;
    btnPausa.addEventListener('click', async () => {
      menu.remove();
      if (!isPausa) await changeOrderState(order.id, 'En Pausa', order.numeroPedido);
    });
    itemsWrap.appendChild(btnPausa);

    // 3. En Producción
    const isProd = order.estado === 'En Producción';
    const btnProd = document.createElement('button');
    btnProd.type = 'button';
    btnProd.className = `w-full flex items-center justify-between px-3 py-2 rounded-xl text-left hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors cursor-pointer ${
      isProd ? 'bg-purple-50/60 dark:bg-brand/20 text-brand font-bold' : ''
    }`;
    btnProd.innerHTML = `
      <div class="flex items-center gap-2.5">
        <span class="w-6 h-6 rounded-lg bg-purple-50 dark:bg-brand/20 text-brand flex items-center justify-center text-xs">
          <i class="fa-solid fa-gears"></i>
        </span>
        <div>
          <p class="font-bold text-slate-800 dark:text-slate-100">3. En Producción</p>
          <p class="text-[10px] text-slate-400">Trabajando en el taller</p>
        </div>
      </div>
      ${isProd ? '<i class="fa-solid fa-check text-brand text-xs"></i>' : ''}
    `;
    btnProd.addEventListener('click', async () => {
      menu.remove();
      if (!isProd) await changeOrderState(order.id, 'En Producción', order.numeroPedido);
    });
    itemsWrap.appendChild(btnProd);

    // Separador
    const div1 = document.createElement('div');
    div1.className = 'my-1 border-t border-slate-100 dark:border-slate-800';
    itemsWrap.appendChild(div1);

    // 4. Listo y Guardar
    const isListo = order.estado === 'Listo';
    const btnListoGuardar = document.createElement('button');
    btnListoGuardar.type = 'button';
    btnListoGuardar.className = `w-full flex items-center justify-between px-3 py-2 rounded-xl text-left hover:bg-emerald-50/60 dark:hover:bg-emerald-950/40 transition-colors cursor-pointer ${
      isListo ? 'bg-emerald-50/70 dark:bg-emerald-950/50 text-emerald-600 font-bold' : ''
    }`;
    btnListoGuardar.innerHTML = `
      <div class="flex items-center gap-2.5">
        <span class="w-6 h-6 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center text-xs">
          <i class="fa-solid fa-check"></i>
        </span>
        <div>
          <p class="font-bold text-emerald-600 dark:text-emerald-400">4. Listo y Guardar</p>
          <p class="text-[10px] text-slate-400">Culminar pedido sin WhatsApp</p>
        </div>
      </div>
      ${isListo ? '<i class="fa-solid fa-check text-emerald-600 text-xs"></i>' : ''}
    `;
    btnListoGuardar.addEventListener('click', async () => {
      menu.remove();
      await changeOrderState(order.id, 'Listo', order.numeroPedido);
    });
    itemsWrap.appendChild(btnListoGuardar);

    // 5. Listo y Notificar (WhatsApp)
    const btnListoNotificar = document.createElement('button');
    btnListoNotificar.type = 'button';
    btnListoNotificar.className =
      'w-full flex items-center justify-between px-3 py-2 rounded-xl text-left hover:bg-purple-50/60 dark:hover:bg-brand/20 transition-colors cursor-pointer';
    btnListoNotificar.innerHTML = `
      <div class="flex items-center gap-2.5">
        <span class="w-6 h-6 rounded-lg bg-brand/10 text-brand flex items-center justify-center text-xs">
          <i class="fa-brands fa-whatsapp"></i>
        </span>
        <div>
          <p class="font-bold text-brand">Listo y Notificar (WhatsApp)</p>
          <p class="text-[10px] text-slate-400">Abrir modal de notificación</p>
        </div>
      </div>
      <i class="fa-solid fa-chevron-right text-slate-300 text-[10px]"></i>
    `;
    btnListoNotificar.addEventListener('click', async () => {
      menu.remove();
      openListoNotificarModal(order, () => fetchPedidos());
    });
    itemsWrap.appendChild(btnListoNotificar);

    // Separador
    const div2 = document.createElement('div');
    div2.className = 'my-1 border-t border-slate-100 dark:border-slate-800';
    itemsWrap.appendChild(div2);

    // 6. Cancelar Pedido
    const isCancel = order.estado === 'Cancelado';
    const btnCancel = document.createElement('button');
    btnCancel.type = 'button';
    btnCancel.className = `w-full flex items-center justify-between px-3 py-2 rounded-xl text-left hover:bg-rose-50/60 dark:hover:bg-rose-950/40 transition-colors cursor-pointer ${
      isCancel ? 'bg-rose-50/60 dark:bg-rose-950/40 text-rose-600 font-bold' : ''
    }`;
    btnCancel.innerHTML = `
      <div class="flex items-center gap-2.5">
        <span class="w-6 h-6 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center text-xs">
          <i class="fa-solid fa-ban"></i>
        </span>
        <div>
          <p class="font-bold text-rose-600 dark:text-rose-400">Cancelar Pedido</p>
          <p class="text-[10px] text-slate-400">Marcar como cancelado</p>
        </div>
      </div>
      ${isCancel ? '<i class="fa-solid fa-check text-rose-600 text-xs"></i>' : ''}
    `;
    btnCancel.addEventListener('click', async () => {
      menu.remove();
      if (!isCancel) {
        openConfirmModal({
          title: 'Cancelar Pedido',
          message: `¿Estás seguro de que deseas marcar el pedido ${order.numeroPedido} como Cancelado?`,
          confirmText: 'Sí, Cancelar Pedido',
          danger: true,
          onConfirm: async () => {
            await changeOrderState(order.id, 'Cancelado', order.numeroPedido);
          },
        });
      }
    });
    itemsWrap.appendChild(btnCancel);

    menu.appendChild(itemsWrap);

    function handleOutsideClick(e) {
      if (!menu.contains(e.target) && e.target !== anchorEl && !anchorEl.contains(e.target)) {
        menu.remove();
        document.removeEventListener('click', handleOutsideClick);
        window.removeEventListener('scroll', handleOutsideClick, true);
        window.removeEventListener('resize', handleOutsideClick);
      }
    }
    setTimeout(() => {
      document.addEventListener('click', handleOutsideClick);
      window.addEventListener('scroll', handleOutsideClick, true);
      window.addEventListener('resize', handleOutsideClick);
    }, 10);

    document.body.appendChild(menu);
  }

  async function changeOrderState(orderId, nextState, numeroPedido) {
    try {
      await apiFetch(`/api/pedidos/${orderId}/estado`, {
        method: 'PATCH',
        body: JSON.stringify({ estado: nextState }),
      });
      toast.success(`Pedido ${numeroPedido} actualizado a: ${nextState}`);
      fetchPedidos();
    } catch (err) {
      toast.error(err.message || 'No se pudo actualizar el estado');
    }
  }

  // Soft delete con confirmación
  function confirmDeleteOrder(order) {
    openConfirmModal({
      title: 'Cancelar y enviar pedido a reciclaje',
      message: `¿Está seguro de que desea cancelar el pedido <strong>${escapeHtml(
        order.numeroPedido
      )}</strong> (${escapeHtml(order.clienteNombre)})? Pasará al módulo de Reciclaje con su historial intacto.`,
      confirmText: 'Sí, cancelar pedido',
      cancelText: 'Volver',
      onConfirm: async () => {
        try {
          await apiFetch(`/api/pedidos/${order.id}`, { method: 'DELETE' });
          toast.success(`Pedido ${order.numeroPedido} enviado a reciclaje.`);
          if (state.view === 'detail') {
            state.view = 'list';
            state.viewingOrder = null;
          }
          fetchPedidos();
        } catch (err) {
          toast.error(err.message || 'Error al eliminar pedido');
        }
      },
    });
  }

  // ============================================================================
  // VISTA 2: CREAR / EDITAR PEDIDO (Captura 2)
  // ============================================================================
  function renderFormView(parent) {
    const isEdit = Boolean(state.editingId);

    const formWrap = document.createElement('div');
    formWrap.className = 'w-full space-y-6 pb-12';

    // 1. Barra superior
    const formHeader = document.createElement('div');
    formHeader.className =
      'flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200/80 dark:border-slate-800';

    const backBtn = createButton({
      text: 'Volver a la Lista',
      icon: 'fa-solid fa-arrow-left',
      variant: 'cancel',
      size: 'md',
      onClick: () => {
        state.view = 'list';
        render();
      },
    });

    const titleH1 = document.createElement('h1');
    titleH1.className = 'text-lg sm:text-xl font-bold text-slate-900 dark:text-white';
    titleH1.textContent = isEdit ? `Editar Pedido ${state.form.numeroPedido || ''}` : 'Crear Nuevo Pedido';

    formHeader.append(backBtn, titleH1);
    formWrap.appendChild(formHeader);

    // ==========================================================================
    // 0. FECHA DEL PEDIDO & ASOCIACIÓN A SEMANA ISO (AGENTS.md)
    // ==========================================================================
    const cardFecha = document.createElement('div');
    cardFecha.className =
      'p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4';

    const fechaLeft = document.createElement('div');
    fechaLeft.className = 'flex items-center gap-3';
    fechaLeft.innerHTML = `
      <div class="w-10 h-10 rounded-xl bg-brand-soft/80 dark:bg-brand/20 text-brand flex items-center justify-center text-base shrink-0">
        <i class="fa-regular fa-calendar-days"></i>
      </div>
      <div>
        <h2 class="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <span>Fecha del Pedido</span>
          <span class="text-danger">*</span>
        </h2>
        <p class="text-[11px] text-slate-400">Por defecto toma hoy; puede cambiar la fecha para asociarlo a otra semana según calendario ISO 8601.</p>
      </div>
    `;

    const fechaRight = document.createElement('div');
    fechaRight.className = 'flex items-center gap-3';

    const dateInp = document.createElement('input');
    dateInp.type = 'date';
    dateInp.id = 'form-order-date';
    dateInp.value = state.form.fechaPedido || getTodayIsoDate();
    dateInp.className =
      'px-3.5 py-2 text-xs sm:text-sm font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand cursor-pointer';

    const weekPill = document.createElement('span');
    weekPill.id = 'form-order-week-pill';
    weekPill.className =
      'inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-50 dark:bg-brand/15 text-brand text-xs font-black border border-brand/20 whitespace-nowrap shadow-2xs';

    function updateFormWeekBadge(dateStr) {
      let d = new Date();
      if (dateStr) {
        const parts = dateStr.split('-');
        if (parts.length === 3) {
          d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0);
        }
      }
      const w = getISOWeekNumber(d);
      weekPill.innerHTML = `
        <i class="fa-solid fa-clock-rotate-left text-[11px]"></i>
        <span>Semana ${w}</span>
      `;
    }

    updateFormWeekBadge(dateInp.value);

    dateInp.addEventListener('input', (e) => {
      state.form.fechaPedido = e.target.value;
      updateFormWeekBadge(e.target.value);
    });

    fechaRight.append(dateInp, weekPill);
    cardFecha.append(fechaLeft, fechaRight);
    formWrap.appendChild(cardFecha);

    // ==========================================================================
    // CARD 1: CLIENTE (con Switch iOS Cliente Casual)
    // ==========================================================================
    const cardCliente = document.createElement('div');
    cardCliente.className =
      'p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4';

    const clientHeader = document.createElement('div');
    clientHeader.className =
      'flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800';

    const clientTitleBox = document.createElement('div');
    clientTitleBox.innerHTML = `
      <h2 class="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
        <span class="w-5 h-5 rounded-full bg-brand text-white flex items-center justify-center text-[10px] font-black">1</span>
        <span>Cliente <span class="text-danger">*</span></span>
      </h2>
      <p class="text-[11px] text-slate-400">Seleccione un cliente registrado de la base o active cliente casual</p>
    `;

    const clientToggle = createIOSToggle({
      label: 'Cliente casual',
      checked: state.form.clienteCasual,
      activeColor: 'emerald',
      onChange: (checked) => {
        state.form.clienteCasual = checked;
        if (checked) {
          state.form.clienteId = null;
        }
        updateClientSectionUI();
      },
    });

    clientHeader.append(clientTitleBox, clientToggle.element);
    cardCliente.appendChild(clientHeader);

    const clientBody = document.createElement('div');
    clientBody.id = 'client-form-body';
    cardCliente.appendChild(clientBody);

    function updateClientSectionUI() {
      clientBody.innerHTML = '';
      if (state.form.clienteCasual) {
        // Modo Casual: Campos directos con WhatsApp OPCIONAL
        clientBody.innerHTML = `
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Nombre y Apellido del Cliente Casual <span class="text-danger">*</span>
              </label>
              <input type="text" id="casual-nombre" value="${escapeHtml(state.form.clienteNombre)}"
                placeholder="Ej. Juan Pérez"
                class="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Teléfono / WhatsApp <span class="text-[11px] font-normal text-slate-400">(Opcional)</span>
              </label>
              <input type="text" id="casual-tel" value="${escapeHtml(state.form.clienteTelefono)}"
                placeholder="Ej. 0981 123 456"
                class="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>

            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Documento / RUC (Opcional)
              </label>
              <input type="text" id="casual-doc" value="${escapeHtml(state.form.clienteDocumento)}"
                placeholder="Ej. 4589622-1"
                class="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Dirección / Ciudad (Opcional)
              </label>
              <input type="text" id="casual-dir" value="${escapeHtml(state.form.clienteDireccion)}"
                placeholder="Ej. San Lorenzo, Barrio Central"
                class="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
          </div>
        `;

        clientBody.querySelector('#casual-nombre')?.addEventListener('input', (e) => {
          state.form.clienteNombre = e.target.value;
        });
        clientBody.querySelector('#casual-tel')?.addEventListener('input', (e) => {
          state.form.clienteTelefono = e.target.value;
        });
        clientBody.querySelector('#casual-doc')?.addEventListener('input', (e) => {
          state.form.clienteDocumento = e.target.value;
        });
        clientBody.querySelector('#casual-dir')?.addEventListener('input', (e) => {
          state.form.clienteDireccion = e.target.value;
        });
      } else {
        // Modo Registrado: Buscador en vivo
        if (state.form.clienteId && state.form.clienteNombre) {
          // Ya tiene cliente seleccionado
          const selectedBox = document.createElement('div');
          selectedBox.className =
            'p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3';
          selectedBox.innerHTML = `
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full bg-brand-soft text-brand flex items-center justify-center font-bold">
                <i class="fa-solid fa-user"></i>
              </div>
              <div>
                <p class="text-sm font-bold text-slate-900 dark:text-white">${escapeHtml(state.form.clienteNombre)}</p>
                <p class="text-xs text-slate-400">${escapeHtml(
                  state.form.clienteTelefono || state.form.clienteDocumento || 'Cliente registrado'
                )}</p>
              </div>
            </div>
          `;
          const changeBtn = createButton({
            text: 'Cambiar cliente',
            icon: 'fa-solid fa-rotate',
            variant: 'cancel',
            size: 'sm',
            onClick: () => {
              state.form.clienteId = null;
              state.form.clienteNombre = '';
              state.form.clienteTelefono = '';
              state.form.clienteDocumento = '';
              state.form.clienteDireccion = '';
              updateClientSectionUI();
            },
          });
          selectedBox.appendChild(changeBtn);
          clientBody.appendChild(selectedBox);
        } else {
          // Buscador
          const searchBox = document.createElement('div');
          searchBox.className = 'relative';
          searchBox.innerHTML = `
            <i class="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
            <input type="text" id="client-search-input"
              placeholder="Buscar cliente activo por nombre, RUC, documento o teléfono..."
              class="w-full pl-9 pr-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand" />
            <div id="client-suggestions" class="absolute left-0 right-0 top-full mt-1 max-h-56 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-20 hidden"></div>
          `;

          const inp = searchBox.querySelector('#client-search-input');
          const sug = searchBox.querySelector('#client-suggestions');

          function renderSuggestions(q) {
            const clean = q.toLowerCase().trim();
            const filtered = state.catalogoClientes.filter((c) => {
              const nom = (c.razonSocial || `${c.nombres || ''} ${c.apellidos || ''}`).toLowerCase();
              const ruc = (c.ruc || c.numeroDocumento || '').toLowerCase();
              const tel = (c.whatsappCompleto || c.telefonoCompleto || '').toLowerCase();
              return nom.includes(clean) || ruc.includes(clean) || tel.includes(clean);
            });

            sug.innerHTML = '';
            if (filtered.length === 0) {
              sug.innerHTML = `<div class="p-3 text-xs text-slate-400 text-center">No se encontraron clientes activos.</div>`;
              sug.classList.remove('hidden');
              return;
            }

            filtered.slice(0, 8).forEach((c) => {
              const name = c.razonSocial || `${c.nombres || ''} ${c.apellidos || ''}`.trim();
              const row = document.createElement('div');
              row.className =
                'px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer border-b border-slate-100 dark:border-slate-700/50 last:border-b-0 text-xs';
              row.innerHTML = `
                <p class="font-bold text-slate-800 dark:text-slate-100">${escapeHtml(name)}</p>
                <p class="text-[11px] text-slate-400">${escapeHtml(c.ruc || c.numeroDocumento || '')} · ${escapeHtml(
                c.whatsappCompleto || c.telefonoCompleto || ''
              )}</p>
              `;
              row.addEventListener('click', () => {
                state.form.clienteId = c.id;
                state.form.clienteNombre = name;
                state.form.clienteTelefono = c.whatsappCompleto || c.telefonoCompleto || '';
                state.form.clienteDocumento = c.ruc || c.numeroDocumento || '';
                state.form.clienteDireccion = c.direccion || '';
                updateClientSectionUI();
              });
              sug.appendChild(row);
            });
            sug.classList.remove('hidden');
          }

          inp.addEventListener('focus', () => {
            renderSuggestions(inp.value);
          });
          inp.addEventListener('input', (e) => {
            renderSuggestions(e.target.value);
          });
          document.addEventListener(
            'click',
            (e) => {
              if (!searchBox.contains(e.target)) {
                sug.classList.add('hidden');
              }
            },
            { capture: true }
          );

          clientBody.appendChild(searchBox);
        }
      }
    }

    updateClientSectionUI();
    formWrap.appendChild(cardCliente);

    // ==========================================================================
    // CARD 2: PRODUCTOS Y CANTIDADES * (con Switch iOS Producto No Registrado y Edición)
    // ==========================================================================
    let updateProvInputUI = null;
    let isProdNoRegistrado = false;
    let selectedProd = null;
    let editingItemIndex = -1;

    const cardProductos = document.createElement('div');
    cardProductos.className =
      'p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4';

    const prodHeader = document.createElement('div');
    prodHeader.className =
      'flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800';

    const prodTitleBox = document.createElement('div');
    prodTitleBox.innerHTML = `
      <h2 class="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
        <span class="w-5 h-5 rounded-full bg-brand text-white flex items-center justify-center text-[10px] font-black">2</span>
        <span>Productos y Cantidades <span class="text-danger">*</span></span>
      </h2>
      <p class="text-[11px] text-slate-400">Busque productos del catálogo o agregue artículos manuales al pedido</p>
    `;

    const prodToggle = createIOSToggle({
      label: 'Producto no registrado',
      checked: false,
      activeColor: 'emerald',
      onChange: (checked) => {
        isProdNoRegistrado = checked;
        selectedProd = null;
        updateProdInputUI();
      },
    });

    prodHeader.append(prodTitleBox, prodToggle.element);
    cardProductos.appendChild(prodHeader);

    const prodInputContainer = document.createElement('div');
    prodInputContainer.id = 'prod-input-container';
    cardProductos.appendChild(prodInputContainer);

    function updateProdInputUI() {
      prodInputContainer.innerHTML = '';

      const inputGrid = document.createElement('div');
      inputGrid.className = 'space-y-3';

      if (!isProdNoRegistrado) {
        // Selector de producto del catálogo con posibilidad de edición del nombre
        const searchProdWrap = document.createElement('div');
        searchProdWrap.className = 'relative';
        searchProdWrap.innerHTML = `
          <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            Producto del Catálogo (Nombre o SKU) <span class="text-danger">*</span>
          </label>
          <div class="relative">
            <i class="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
            <input type="text" id="prod-search-input"
              value="${selectedProd ? escapeHtml(selectedProd.nombre + (selectedProd.sku ? ' (' + selectedProd.sku + ')' : '')) : ''}"
              placeholder="Buscar producto activo por nombre o SKU..."
              class="w-full pl-9 pr-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <div id="prod-suggestions" class="absolute left-0 right-0 top-full mt-1 max-h-56 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-20 hidden"></div>
        `;

        const pInp = searchProdWrap.querySelector('#prod-search-input');
        const pSug = searchProdWrap.querySelector('#prod-suggestions');

        function renderProdSug(q) {
          const clean = q.toLowerCase().trim();
          const filtered = state.catalogoProductos.filter((p) => {
            const nom = (p.nombre || '').toLowerCase();
            const sku = (p.sku || '').toLowerCase();
            return nom.includes(clean) || sku.includes(clean);
          });

          pSug.innerHTML = '';
          if (filtered.length === 0) {
            pSug.innerHTML = `<div class="p-3 text-xs text-slate-400 text-center">No se encontraron productos activos.</div>`;
            pSug.classList.remove('hidden');
            return;
          }

          filtered.slice(0, 8).forEach((p) => {
            const r = document.createElement('div');
            r.className =
              'px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer border-b border-slate-100 dark:border-slate-700/50 last:border-b-0 text-xs flex items-center justify-between';
            r.innerHTML = `
              <div>
                <p class="font-bold text-slate-800 dark:text-slate-100">${escapeHtml(p.nombre)}</p>
                <p class="text-[10px] text-slate-400 font-mono">${escapeHtml(p.sku || '')} · Stock: ${p.stockActual}</p>
              </div>
              <span class="font-black text-brand text-xs">${formatGuaranies(p.precioVenta)}</span>
            `;
            r.addEventListener('click', () => {
              selectedProd = p;
              pInp.value = `${p.nombre} (${p.sku})`;
              pSug.classList.add('hidden');
              rowInputs.querySelector('#item-price').value = formatGuaranies(p.precioVenta);
              calcSubtotal();
            });
            pSug.appendChild(r);
          });
          pSug.classList.remove('hidden');
        }

        pInp.addEventListener('focus', () => renderProdSug(pInp.value));
        pInp.addEventListener('input', (e) => {
          renderProdSug(e.target.value);
          if (selectedProd) {
            selectedProd.nombre = e.target.value;
          }
        });
        document.addEventListener(
          'click',
          (e) => {
            if (!searchProdWrap.contains(e.target)) pSug.classList.add('hidden');
          },
          { capture: true }
        );

        inputGrid.appendChild(searchProdWrap);
      } else {
        // Campo manual de producto
        const manualNameWrap = document.createElement('div');
        manualNameWrap.innerHTML = `
          <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            Nombre / Descripción del Producto No Registrado <span class="text-danger">*</span>
          </label>
          <input type="text" id="manual-prod-name"
            value="${selectedProd ? escapeHtml(selectedProd.nombre) : ''}"
            placeholder="Ej. Taza Personalizada Mágica Negra"
            class="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand" />
        `;
        inputGrid.appendChild(manualNameWrap);
      }

      // Fila: Cantidad + Precio Unitario + Subtotal + Botón "+ Agregar al Pedido" / "✓ Actualizar Ítem"
      const rowInputs = document.createElement('div');
      rowInputs.className = 'grid grid-cols-1 sm:grid-cols-4 items-end gap-3';
      rowInputs.innerHTML = `
        <div>
          <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Cantidad <span class="text-danger">*</span></label>
          <input type="number" id="item-cant" min="1" value="${selectedProd?.cantidad || 1}"
            class="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand" />
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Precio Unitario (Gs.) <span class="text-danger">*</span></label>
          <input type="text" id="item-price" value="${formatGuaranies(selectedProd?.precioVenta || 0)}"
            class="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand font-mono font-bold" />
        </div>
        <div class="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-center">
          <p class="text-[10px] text-slate-400 font-semibold">Subtotal Ítem</p>
          <p id="item-subtotal-text" class="text-xs sm:text-sm font-black text-brand mt-0.5">0 Gs.</p>
        </div>
        <div id="add-btn-holder" class="flex items-center gap-2 justify-end"></div>
      `;

      const cantInput = rowInputs.querySelector('#item-cant');
      const priceInput = rowInputs.querySelector('#item-price');
      const subtotalText = rowInputs.querySelector('#item-subtotal-text');

      function calcSubtotal() {
        const c = Number(cantInput.value) || 1;
        const p = parseGuaranies(priceInput.value);
        subtotalText.textContent = formatGuaranies(c * p);
      }

      cantInput.addEventListener('input', calcSubtotal);
      priceInput.addEventListener('input', (e) => {
        const num = parseGuaranies(e.target.value);
        e.target.value = formatGuaranies(num);
        calcSubtotal();
      });

      calcSubtotal();

      const btnHolder = rowInputs.querySelector('#add-btn-holder');

      if (editingItemIndex >= 0) {
        const cancelEditBtn = createButton({
          text: 'Cancelar',
          variant: 'cancel',
          size: 'md',
          onClick: () => {
            editingItemIndex = -1;
            selectedProd = null;
            updateProdInputUI();
          },
        });
        btnHolder.appendChild(cancelEditBtn);
      }

      const saveItemBtn = createButton({
        text: editingItemIndex >= 0 ? 'Actualizar Ítem' : 'Agregar al Pedido',
        icon: editingItemIndex >= 0 ? 'fa-solid fa-check' : 'fa-solid fa-plus',
        variant: 'primary',
        size: 'md',
        onClick: () => {
          let nombre = '';
          let sku = '';
          let prodId = null;

          if (isProdNoRegistrado) {
            const manualInp = inputGrid.querySelector('#manual-prod-name');
            nombre = manualInp ? manualInp.value.trim() : '';
            if (!nombre) {
              toast.error('Ingrese el nombre del producto.');
              return;
            }
          } else {
            const pInp = inputGrid.querySelector('#prod-search-input');
            nombre = pInp ? pInp.value.trim() : (selectedProd?.nombre || '');
            if (!nombre) {
              toast.error('Seleccione o escriba el producto.');
              return;
            }
            sku = selectedProd?.sku || '';
            prodId = selectedProd?.id || null;
          }

          const cant = Number(cantInput.value) || 1;
          const precio = parseGuaranies(priceInput.value);

          if (cant <= 0) {
            toast.error('La cantidad debe ser mayor a 0.');
            return;
          }
          if (precio < 0) {
            toast.error('El precio no puede ser negativo.');
            return;
          }

          const itemData = {
            productoId: prodId,
            esNoRegistrado: isProdNoRegistrado,
            nombreProducto: nombre,
            sku: sku,
            cantidad: cant,
            precioUnitario: precio,
            subtotal: cant * precio,
          };

          if (editingItemIndex >= 0) {
            state.form.items[editingItemIndex] = itemData;
            editingItemIndex = -1;
            toast.success('Ítem del pedido actualizado.');
          } else {
            state.form.items.push(itemData);
            toast.success('Producto agregado al pedido.');
          }

          selectedProd = null;
          updateProdInputUI();
          renderItemsTable();
          updateTotalOrderCard();
        },
      });

      btnHolder.appendChild(saveItemBtn);
      inputGrid.appendChild(rowInputs);
      prodInputContainer.appendChild(inputGrid);
    }

    updateProdInputUI();

    // Tabla de Ítems en el Pedido
    const itemsTableHolder = document.createElement('div');
    itemsTableHolder.className = 'pt-2';
    cardProductos.appendChild(itemsTableHolder);

    function renderItemsTable() {
      itemsTableHolder.innerHTML = '';
      const count = state.form.items.length;

      const title = document.createElement('h3');
      title.className = 'text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center justify-between';
      title.innerHTML = `
        <span class="flex items-center gap-1.5">
          <i class="fa-solid fa-cubes text-brand"></i>
          <span>Ítems en el pedido (${count})</span>
        </span>
      `;
      itemsTableHolder.appendChild(title);

      const tableBox = document.createElement('div');
      tableBox.className =
        'w-full rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs';

      if (count === 0) {
        tableBox.innerHTML = `
          <div class="p-8 text-center text-xs text-slate-400">
            No hay productos agregados al pedido todavía. Seleccione uno de la lista de productos activos arriba y haga clic en "+ Agregar al Pedido".
          </div>
        `;
      } else {
        const tbl = document.createElement('table');
        tbl.className = 'w-full text-left border-collapse text-xs';
        tbl.innerHTML = `
          <thead class="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
            <tr>
              <th class="px-4 py-3">Producto</th>
              <th class="px-4 py-3 text-center">Cantidad</th>
              <th class="px-4 py-3 text-right">Precio Unitario</th>
              <th class="px-4 py-3 text-right">Subtotal</th>
              <th class="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800/80"></tbody>
        `;

        const tBody = tbl.querySelector('tbody');
        state.form.items.forEach((it, idx) => {
          const row = document.createElement('tr');
          row.className = 'hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors';
          row.innerHTML = `
            <td class="px-4 py-3">
              <p class="font-bold text-slate-800 dark:text-slate-100">${escapeHtml(it.nombreProducto)}</p>
              ${it.sku ? `<span class="font-mono text-[10px] text-brand font-semibold">${escapeHtml(it.sku)}</span>` : '<span class="text-[10px] text-amber-500 font-semibold">No registrado</span>'}
            </td>
            <td class="px-4 py-3 text-center font-bold text-slate-800 dark:text-slate-200">${it.cantidad}</td>
            <td class="px-4 py-3 text-right font-mono text-slate-700 dark:text-slate-300">${formatGuaranies(it.precioUnitario)}</td>
            <td class="px-4 py-3 text-right font-black text-brand font-mono">${formatGuaranies(it.subtotal)}</td>
            <td class="px-4 py-3 text-right whitespace-nowrap">
              <button type="button" class="btn-edit-item text-slate-500 hover:text-brand hover:bg-slate-100 dark:hover:bg-slate-800 p-1.5 rounded cursor-pointer mr-1" title="Editar este ítem">
                <i class="fa-regular fa-pen-to-square"></i>
              </button>
              <button type="button" class="btn-del-item text-danger hover:bg-rose-50 dark:hover:bg-rose-950/40 p-1.5 rounded cursor-pointer" title="Eliminar ítem">
                <i class="fa-regular fa-trash-can"></i>
              </button>
            </td>
          `;

          // Acción Editar ítem
          row.querySelector('.btn-edit-item')?.addEventListener('click', () => {
            editingItemIndex = idx;
            isProdNoRegistrado = Boolean(it.esNoRegistrado);
            prodToggle.setChecked(isProdNoRegistrado);
            selectedProd = {
              id: it.productoId,
              nombre: it.nombreProducto,
              sku: it.sku || '',
              precioVenta: it.precioUnitario,
              cantidad: it.cantidad,
            };
            updateProdInputUI();
            cardProductos.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          });

          // Acción Eliminar ítem
          row.querySelector('.btn-del-item')?.addEventListener('click', () => {
            state.form.items.splice(idx, 1);
            if (editingItemIndex === idx) {
              editingItemIndex = -1;
              selectedProd = null;
              updateProdInputUI();
            }
            renderItemsTable();
            updateTotalOrderCard();
          });

          tBody.appendChild(row);
        });

        tableBox.appendChild(tbl);
      }

      itemsTableHolder.appendChild(tableBox);
      if (typeof updateProvInputUI === 'function') {
        updateProvInputUI();
      }
    }

    renderItemsTable();
    formWrap.appendChild(cardProductos);

    // ==========================================================================
    // CARD 3: PROVEEDOR (Opcional, con Switch iOS Proveedor No Registrado y Edición)
    // ==========================================================================
    let isProvNoRegistrado = false;
    let selectedProv = null;
    let selectedProvProd = '';
    let selectedProvProdId = null;
    let selectedProvEstadoPago = 'Pendiente';
    let selectedProvMontoPagado = 0;
    let editingProvIndex = -1;

    const cardProveedores = document.createElement('div');
    cardProveedores.className =
      'p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4';

    const provHeader = document.createElement('div');
    provHeader.className =
      'flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800';

    const provTitleBox = document.createElement('div');
    provTitleBox.innerHTML = `
      <h2 class="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
        <span class="w-5 h-5 rounded-full bg-brand text-white flex items-center justify-center text-[10px] font-black">3</span>
        <span>Proveedores y Costos de Compra (Opcional)</span>
      </h2>
      <p class="text-[11px] text-slate-400">Asocie compras realizadas a proveedores para este pedido</p>
    `;

    const provToggle = createIOSToggle({
      label: 'Proveedor no registrado',
      checked: false,
      activeColor: 'emerald',
      onChange: (checked) => {
        isProvNoRegistrado = checked;
        selectedProv = null;
        updateProvInputUI();
      },
    });

    provHeader.append(provTitleBox, provToggle.element);
    cardProveedores.appendChild(provHeader);

    const provInputContainer = document.createElement('div');
    cardProveedores.appendChild(provInputContainer);

    updateProvInputUI = function() {
      provInputContainer.innerHTML = '';
      const pGrid = document.createElement('div');
      pGrid.className = 'space-y-3';

      // 1. Selector / Input de Proveedor
      if (!isProvNoRegistrado) {
        // Selector con buscador de proveedores de la base
        const pSelWrap = document.createElement('div');
        pSelWrap.className = 'relative';
        pSelWrap.innerHTML = `
          <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Buscar Proveedor Registrado</label>
          <div class="relative">
            <i class="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
            <input type="text" id="prov-search-input"
              value="${selectedProv ? escapeHtml(selectedProv.razonSocial) : ''}"
              placeholder="Buscar proveedor en la base de datos..."
              class="w-full pl-9 pr-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <div id="prov-suggestions" class="absolute left-0 right-0 top-full mt-1 max-h-56 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-20 hidden"></div>
        `;

        const pvInp = pSelWrap.querySelector('#prov-search-input');
        const pvSug = pSelWrap.querySelector('#prov-suggestions');

        function renderPvSug(q) {
          const clean = q.toLowerCase().trim();
          const filtered = state.catalogoProveedores.filter((pv) => {
            const nom = (pv.razonSocial || pv.nombreComercial || '').toLowerCase();
            const ruc = (pv.rucDocumento || '').toLowerCase();
            return nom.includes(clean) || ruc.includes(clean);
          });

          pvSug.innerHTML = '';
          if (filtered.length === 0) {
            pvSug.innerHTML = `<div class="p-3 text-xs text-slate-400 text-center">No se encontraron proveedores.</div>`;
            pvSug.classList.remove('hidden');
            return;
          }

          filtered.slice(0, 8).forEach((pv) => {
            const r = document.createElement('div');
            r.className =
              'px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer border-b border-slate-100 dark:border-slate-700/50 last:border-b-0 text-xs';
            r.innerHTML = `
              <p class="font-bold text-slate-800 dark:text-slate-100">${escapeHtml(pv.razonSocial)}</p>
              <p class="text-[10px] text-slate-400">${escapeHtml(pv.rucDocumento || '')} · ${escapeHtml(pv.ciudad || '')}</p>
            `;
            r.addEventListener('click', () => {
              selectedProv = pv;
              pvInp.value = pv.razonSocial;
              pvSug.classList.add('hidden');
            });
            pvSug.appendChild(r);
          });
          pvSug.classList.remove('hidden');
        }

        pvInp.addEventListener('focus', () => renderPvSug(pvInp.value));
        pvInp.addEventListener('input', (e) => {
          renderPvSug(e.target.value);
          if (selectedProv) {
            selectedProv.razonSocial = e.target.value;
          }
        });
        document.addEventListener(
          'click',
          (e) => {
            if (!pSelWrap.contains(e.target)) pvSug.classList.add('hidden');
          },
          { capture: true }
        );

        pGrid.appendChild(pSelWrap);
      } else {
        const manualPvWrap = document.createElement('div');
        manualPvWrap.innerHTML = `
          <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Nombre del Proveedor No Registrado</label>
          <input type="text" id="manual-prov-name"
            value="${selectedProv ? escapeHtml(selectedProv.razonSocial) : ''}"
            placeholder="Ej. Distribuidora Gráfica Central"
            class="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand" />
        `;
        pGrid.appendChild(manualPvWrap);
      }

      // 2. Selección de Producto que proveyó este proveedor
      // Si solo hay 1 producto asignado al cliente/pedido, se selecciona automáticamente con opción de cambio
      // Si hay varios productos, es obligatorio seleccionar cuál proveyó
      const itemsCount = state.form.items.length;
      if (itemsCount === 1 && !selectedProvProd) {
        selectedProvProd = state.form.items[0].nombreProducto;
        selectedProvProdId = state.form.items[0].productoId || null;
      }

      const prodSelectWrap = document.createElement('div');
      prodSelectWrap.className = 'p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 space-y-1.5';
      
      let autoSelectNotice = '';
      if (itemsCount === 1) {
        autoSelectNotice = `<span class="text-[11px] text-brand font-semibold ml-2"><i class="fa-solid fa-wand-magic-sparkles mr-1"></i>Auto-seleccionado (único producto en el pedido)</span>`;
      } else if (itemsCount > 1) {
        autoSelectNotice = `<span class="text-[11px] text-amber-500 font-semibold ml-2"><i class="fa-solid fa-asterisk mr-1 text-[9px]"></i>Obligatorio: elija el producto</span>`;
      }

      prodSelectWrap.innerHTML = `
        <div class="flex items-center justify-between">
          <label class="block text-xs font-bold text-slate-700 dark:text-slate-300">
            Producto del Pedido que Proveyó ${autoSelectNotice}
          </label>
        </div>
        <select id="prov-prod-select" class="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand cursor-pointer">
          ${itemsCount === 0 ? '<option value="">(Agregue productos al pedido arriba para asignarlos aquí)</option>' : ''}
          ${itemsCount > 1 ? '<option value="">-- Seleccione qué producto proveyó este proveedor --</option>' : ''}
          ${state.form.items.map((it, idx) => {
            const isMatch = (selectedProvProd && selectedProvProd === it.nombreProducto) || (itemsCount === 1);
            return `<option value="${idx}" ${isMatch ? 'selected' : ''}>${escapeHtml(it.nombreProducto)} (Cantidad: ${it.cantidad})</option>`;
          }).join('')}
        </select>
      `;

      const prodSelect = prodSelectWrap.querySelector('#prov-prod-select');
      prodSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        if (val === '') {
          selectedProvProd = '';
          selectedProvProdId = null;
        } else {
          const itemIdx = Number(val);
          const item = state.form.items[itemIdx];
          if (item) {
            selectedProvProd = item.nombreProducto;
            selectedProvProdId = item.productoId || null;
          }
        }
      });
      pGrid.appendChild(prodSelectWrap);

      // 3. Fila: Cantidad Comprada + Costo de Compra + Estado de Pago
      const rowPvInputs = document.createElement('div');
      rowPvInputs.className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 items-end gap-3';
      rowPvInputs.innerHTML = `
        <div>
          <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Cantidad Comprada</label>
          <input type="number" id="prov-cant" min="1" value="${selectedProv?.cantidad || 1}"
            class="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand" />
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Costo Unitario (Gs.)</label>
          <input type="text" id="prov-costo" value="${formatGuaranies(selectedProv?.costo || 0)}"
            class="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand font-mono font-bold" />
        </div>
        <div class="sm:col-span-2">
          <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Estado del Pago al Proveedor</label>
          <div class="flex items-center gap-2">
            <button type="button" data-estado="Pendiente" class="prov-estado-btn flex-1 py-2 px-2.5 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${selectedProvEstadoPago === 'Pendiente' ? 'bg-amber-500 text-white border-amber-500 shadow-xs' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'}">
              <i class="fa-solid fa-clock text-[11px]"></i>
              <span>Pendiente</span>
            </button>
            <button type="button" data-estado="Pagado" class="prov-estado-btn flex-1 py-2 px-2.5 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${selectedProvEstadoPago === 'Pagado' ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'}">
              <i class="fa-solid fa-check text-[11px]"></i>
              <span>Pagado</span>
            </button>
            <button type="button" data-estado="Pago Parcial" class="prov-estado-btn flex-1 py-2 px-2.5 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${selectedProvEstadoPago === 'Pago Parcial' ? 'bg-brand text-white border-brand shadow-xs' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'}">
              <i class="fa-solid fa-circle-half-stroke text-[11px]"></i>
              <span>Pago Parcial</span>
            </button>
          </div>
        </div>
      `;

      const costoInp = rowPvInputs.querySelector('#prov-costo');
      const cantInp = rowPvInputs.querySelector('#prov-cant');
      costoInp.addEventListener('input', (e) => {
        const num = parseGuaranies(e.target.value);
        e.target.value = formatGuaranies(num);
        updatePartialMath();
      });
      cantInp.addEventListener('input', () => {
        updatePartialMath();
      });

      // Contenedor dinámico de Pago Parcial (si se activa Pago Parcial)
      const partialBox = document.createElement('div');
      partialBox.id = 'prov-partial-box';
      partialBox.className = `p-3.5 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-brand/30 space-y-2 ${selectedProvEstadoPago === 'Pago Parcial' ? '' : 'hidden'}`;
      partialBox.innerHTML = `
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
          <div>
            <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Monto Pagado / Abonado (Gs.)</label>
            <input type="text" id="prov-monto-pagado" value="${formatGuaranies(selectedProvMontoPagado)}"
              class="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand font-mono font-bold" />
          </div>
          <div class="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex flex-col justify-center">
            <span class="text-[10px] uppercase font-bold text-slate-500">Saldo Pendiente Calculado</span>
            <span id="prov-saldo-calc" class="text-sm font-mono font-black text-danger">0 Gs.</span>
          </div>
        </div>
      `;

      const montoPagadoInp = partialBox.querySelector('#prov-monto-pagado');
      const saldoCalcEl = partialBox.querySelector('#prov-saldo-calc');

      function updatePartialMath() {
        const cant = Number(cantInp.value) || 1;
        const costo = parseGuaranies(costoInp.value);
        const subtotal = cant * costo;
        const pagado = parseGuaranies(montoPagadoInp.value);
        const saldo = Math.max(0, subtotal - pagado);
        saldoCalcEl.textContent = formatGuaranies(saldo);
      }

      montoPagadoInp.addEventListener('input', (e) => {
        const num = parseGuaranies(e.target.value);
        e.target.value = formatGuaranies(num);
        selectedProvMontoPagado = num;
        updatePartialMath();
      });

      rowPvInputs.querySelectorAll('.prov-estado-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          selectedProvEstadoPago = btn.dataset.estado;
          rowPvInputs.querySelectorAll('.prov-estado-btn').forEach((b) => {
            const st = b.dataset.estado;
            if (st === selectedProvEstadoPago) {
              if (st === 'Pendiente') b.className = 'prov-estado-btn flex-1 py-2 px-2.5 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 bg-amber-500 text-white border-amber-500 shadow-xs';
              if (st === 'Pagado') b.className = 'prov-estado-btn flex-1 py-2 px-2.5 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 bg-emerald-600 text-white border-emerald-600 shadow-xs';
              if (st === 'Pago Parcial') b.className = 'prov-estado-btn flex-1 py-2 px-2.5 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 bg-brand text-white border-brand shadow-xs';
            } else {
              b.className = 'prov-estado-btn flex-1 py-2 px-2.5 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300';
            }
          });

          if (selectedProvEstadoPago === 'Pago Parcial') {
            partialBox.classList.remove('hidden');
            updatePartialMath();
          } else {
            partialBox.classList.add('hidden');
          }
        });
      });

      // Fila de botones: Cancelar y Agregar Proveedor
      const rowButtons = document.createElement('div');
      rowButtons.className = 'flex items-center justify-end gap-2 pt-1';

      if (editingProvIndex >= 0) {
        const cancelEditProvBtn = createButton({
          text: 'Cancelar',
          variant: 'cancel',
          size: 'md',
          onClick: () => {
            editingProvIndex = -1;
            selectedProv = null;
            selectedProvProd = '';
            selectedProvProdId = null;
            selectedProvEstadoPago = 'Pendiente';
            selectedProvMontoPagado = 0;
            updateProvInputUI();
          },
        });
        rowButtons.appendChild(cancelEditProvBtn);
      }

      const addPvBtn = createButton({
        text: editingProvIndex >= 0 ? 'Actualizar Proveedor' : 'Agregar Proveedor',
        icon: editingProvIndex >= 0 ? 'fa-solid fa-check' : 'fa-solid fa-plus',
        variant: 'primary',
        size: 'md',
        onClick: () => {
          let nombre = '';
          let provId = null;

          if (isProvNoRegistrado) {
            const manualInp = pGrid.querySelector('#manual-prov-name');
            nombre = manualInp ? manualInp.value.trim() : '';
          } else {
            const pvInp = pGrid.querySelector('#prov-search-input');
            nombre = pvInp ? pvInp.value.trim() : (selectedProv?.razonSocial || '');
            provId = selectedProv?.id || null;
          }

          if (!nombre) {
            toast.error('Indique el proveedor antes de agregar.');
            return;
          }

          // Validación de productos en la orden
          if (state.form.items.length === 0) {
            toast.error('Agregue primero al menos un producto a la orden antes de vincular la compra a un proveedor.');
            return;
          }

          let prodAsignado = selectedProvProd;
          let prodIdAsignado = selectedProvProdId;

          if (state.form.items.length === 1 && !prodAsignado) {
            prodAsignado = state.form.items[0].nombreProducto;
            prodIdAsignado = state.form.items[0].productoId || null;
          }

          if (state.form.items.length > 1 && !prodAsignado) {
            toast.error('Es obligatorio seleccionar qué producto proveyó este proveedor.');
            return;
          }

          const cant = Number(rowPvInputs.querySelector('#prov-cant').value) || 1;
          const costo = parseGuaranies(costoInp.value);
          const subtotal = cant * costo;

          let montoPagado = 0;
          let saldoPendiente = subtotal;

          if (selectedProvEstadoPago === 'Pagado') {
            montoPagado = subtotal;
            saldoPendiente = 0;
          } else if (selectedProvEstadoPago === 'Pendiente') {
            montoPagado = 0;
            saldoPendiente = subtotal;
          } else if (selectedProvEstadoPago === 'Pago Parcial') {
            montoPagado = parseGuaranies(montoPagadoInp.value);
            if (montoPagado < 0) montoPagado = 0;
            if (montoPagado > subtotal) montoPagado = subtotal;
            saldoPendiente = Math.max(0, subtotal - montoPagado);
          }

          const provData = {
            proveedorId: provId,
            esNoRegistrado: isProvNoRegistrado,
            nombreProveedor: nombre,
            productoId: prodIdAsignado,
            productoNombre: prodAsignado,
            cantidad: cant,
            costo: costo,
            subtotal: subtotal,
            estadoPago: selectedProvEstadoPago,
            montoPagado: montoPagado,
            saldoPendiente: saldoPendiente,
          };

          if (editingProvIndex >= 0) {
            state.form.proveedores[editingProvIndex] = provData;
            editingProvIndex = -1;
            toast.success('Proveedor actualizado.');
          } else {
            state.form.proveedores.push(provData);
            toast.success('Proveedor agregado al pedido.');
          }

          selectedProv = null;
          selectedProvProd = '';
          selectedProvProdId = null;
          selectedProvEstadoPago = 'Pendiente';
          selectedProvMontoPagado = 0;
          updateProvInputUI();
          renderProvsTable();
          updateTotalOrderCard();
        },
      });

      rowButtons.appendChild(addPvBtn);
      pGrid.appendChild(rowPvInputs);
      pGrid.appendChild(partialBox);
      pGrid.appendChild(rowButtons);
      provInputContainer.appendChild(pGrid);
      updatePartialMath();
    }

    updateProvInputUI();

    const provTableHolder = document.createElement('div');
    provTableHolder.className = 'pt-2';
    cardProveedores.appendChild(provTableHolder);

    function renderProvsTable() {
      provTableHolder.innerHTML = '';
      const count = state.form.proveedores.length;

      const title = document.createElement('h3');
      title.className = 'text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center justify-between';
      title.innerHTML = `
        <span class="flex items-center gap-1.5">
          <i class="fa-solid fa-truck-field text-brand"></i>
          <span>Proveedores y Costos Asignados (${count})</span>
        </span>
      `;
      provTableHolder.appendChild(title);

      const tableBox = document.createElement('div');
      tableBox.className =
        'w-full rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs';

      if (count === 0) {
        tableBox.innerHTML = `
          <div class="p-6 text-center text-xs text-slate-400">
            No hay compras o proveedores asociados a este pedido todavía. Si este pedido requiere insumos o compras a proveedores, selecciónelos arriba.
          </div>
        `;
      } else {
        const tbl = document.createElement('table');
        tbl.className = 'w-full text-left border-collapse text-xs';
        tbl.innerHTML = `
          <thead class="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
            <tr>
              <th class="px-4 py-3">Proveedor</th>
              <th class="px-4 py-3">Producto Asignado</th>
              <th class="px-4 py-3 text-center">Cantidad</th>
              <th class="px-4 py-3 text-right">Costo Unitario</th>
              <th class="px-4 py-3 text-right">Costo Total</th>
              <th class="px-4 py-3 text-center">Estado Pago</th>
              <th class="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800/80"></tbody>
        `;

        const tBody = tbl.querySelector('tbody');
        state.form.proveedores.forEach((pr, idx) => {
          const row = document.createElement('tr');
          row.className = 'hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors';

          let estadoBadgeHtml = '';
          const st = pr.estadoPago || 'Pendiente';
          if (st === 'Pagado') {
            estadoBadgeHtml = `
              <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                <i class="fa-solid fa-check text-[9px]"></i>
                <span>Pagado</span>
              </span>
            `;
          } else if (st === 'Pago Parcial') {
            estadoBadgeHtml = `
              <div class="flex flex-col items-center">
                <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-brand dark:bg-purple-950/60 dark:text-brand">
                  <i class="fa-solid fa-circle-half-stroke text-[9px]"></i>
                  <span>Parcial</span>
                </span>
                <span class="text-[9px] font-mono text-emerald-600 mt-0.5">Pag: ${formatGuaranies(pr.montoPagado || 0)}</span>
                <span class="text-[9px] font-mono text-danger">Sal: ${formatGuaranies(pr.saldoPendiente || 0)}</span>
              </div>
            `;
          } else {
            estadoBadgeHtml = `
              <div class="flex flex-col items-center">
                <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                  <i class="fa-solid fa-clock text-[9px]"></i>
                  <span>Pendiente</span>
                </span>
                <span class="text-[9px] font-mono text-danger mt-0.5">Saldo: ${formatGuaranies(pr.subtotal || 0)}</span>
              </div>
            `;
          }

          row.innerHTML = `
            <td class="px-4 py-3">
              <p class="font-bold text-slate-800 dark:text-slate-100">${escapeHtml(pr.nombreProveedor)}</p>
              ${pr.esNoRegistrado ? '<span class="text-[10px] text-amber-500 font-semibold">Manual / No registrado</span>' : '<span class="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">Registrado</span>'}
            </td>
            <td class="px-4 py-3">
              <span class="font-medium text-slate-700 dark:text-slate-300">${escapeHtml(pr.productoNombre || '—')}</span>
            </td>
            <td class="px-4 py-3 text-center font-bold text-slate-800 dark:text-slate-200">${pr.cantidad}</td>
            <td class="px-4 py-3 text-right font-mono text-slate-700 dark:text-slate-300">${formatGuaranies(pr.costo)}</td>
            <td class="px-4 py-3 text-right font-mono font-black text-brand">${formatGuaranies(pr.subtotal)}</td>
            <td class="px-4 py-3 text-center">${estadoBadgeHtml}</td>
            <td class="px-4 py-3 text-right whitespace-nowrap">
              <button type="button" class="btn-edit-prov text-slate-500 hover:text-brand hover:bg-slate-100 dark:hover:bg-slate-800 p-1.5 rounded cursor-pointer mr-1" title="Editar proveedor">
                <i class="fa-regular fa-pen-to-square"></i>
              </button>
              <button type="button" class="btn-del-prov text-danger hover:bg-rose-50 dark:hover:bg-rose-950/40 p-1.5 rounded cursor-pointer" title="Eliminar proveedor">
                <i class="fa-regular fa-trash-can"></i>
              </button>
            </td>
          `;

          row.querySelector('.btn-edit-prov')?.addEventListener('click', () => {
            editingProvIndex = idx;
            isProvNoRegistrado = Boolean(pr.esNoRegistrado);
            provToggle.setChecked(isProvNoRegistrado);
            selectedProv = {
              id: pr.proveedorId,
              razonSocial: pr.nombreProveedor,
              costo: pr.costo,
              cantidad: pr.cantidad,
            };
            selectedProvProd = pr.productoNombre || '';
            selectedProvProdId = pr.productoId || null;
            selectedProvEstadoPago = pr.estadoPago || 'Pendiente';
            selectedProvMontoPagado = pr.montoPagado || 0;
            updateProvInputUI();
            cardProveedores.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          });

          row.querySelector('.btn-del-prov')?.addEventListener('click', () => {
            state.form.proveedores.splice(idx, 1);
            if (editingProvIndex === idx) {
              editingProvIndex = -1;
              selectedProv = null;
              selectedProvProd = '';
              selectedProvProdId = null;
              selectedProvEstadoPago = 'Pendiente';
              selectedProvMontoPagado = 0;
              updateProvInputUI();
            }
            renderProvsTable();
            updateTotalOrderCard();
          });

          tBody.appendChild(row);
        });

        tableBox.appendChild(tbl);
      }
      provTableHolder.appendChild(tableBox);
    }

    renderProvsTable();
    formWrap.appendChild(cardProveedores);

    // ==========================================================================
    // CARD 4: CONDICIÓN DE VENTA, ENTREGA Y TOTAL (Cálculos en tiempo real)
    // ==========================================================================
    const cardCondiciones = document.createElement('div');
    cardCondiciones.className =
      'p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs';

    const condGrid = document.createElement('div');
    condGrid.className = 'grid grid-cols-1 lg:grid-cols-3 gap-6 items-center';

    const condLeft = document.createElement('div');
    condLeft.className = 'lg:col-span-2 space-y-4';

    // Fila: Condición de Venta + Modalidad de Entrega
    condLeft.innerHTML = `
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            4. CONDICIÓN DE VENTA <span class="text-danger">*</span>
          </label>
          <select id="select-condicion"
            class="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand font-bold">
            <option value="Contado" ${state.form.condicionVenta === 'Contado' ? 'selected' : ''}>Contado</option>
            <option value="Credito" ${state.form.condicionVenta === 'Credito' ? 'selected' : ''}>Crédito</option>
          </select>
          <p class="text-[10px] text-slate-400 mt-1">Cobro al contado o a crédito.</p>
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            MODALIDAD DE ENTREGA <span class="text-danger">*</span>
          </label>
          <select id="select-modalidad"
            class="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand font-bold">
            <option value="Retiro en Local" ${state.form.modalidadEntrega === 'Retiro en Local' ? 'selected' : ''}>Retiro en Local</option>
            <option value="Envío a Domicilio" ${state.form.modalidadEntrega === 'Envío a Domicilio' ? 'selected' : ''}>Envío a Domicilio</option>
            <option value="Encomienda" ${state.form.modalidadEntrega === 'Encomienda' ? 'selected' : ''}>Encomienda</option>
            <option value="Otro" ${state.form.modalidadEntrega === 'Otro' ? 'selected' : ''}>Otro</option>
          </select>
          <p class="text-[10px] text-slate-400 mt-1">Retiro en local o entrega por delivery.</p>
        </div>
      </div>
      <div id="otro-modalidad-wrap" class="hidden">
        <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Especifique modalidad de entrega</label>
        <input type="text" id="inp-modalidad-otro" value="${escapeHtml(state.form.modalidadEntregaOtro)}"
          placeholder="Ej. Transporte encomienda Asunción Express"
          class="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand" />
      </div>
      <div id="credito-options-wrap" class="p-4 rounded-xl bg-purple-50/60 dark:bg-brand/10 border border-purple-100 dark:border-brand/20 space-y-3 ${
        state.form.condicionVenta === 'Credito' ? '' : 'hidden'
      }">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
              Fecha de Vencimiento / Cobro <span class="text-[11px] font-normal text-slate-400">(Opcional)</span>
            </label>
            <input type="date" id="credito-fecha" value="${escapeHtml(state.form.fechaCobro)}"
              class="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand font-semibold" />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">Tipo de Pago <span class="text-danger">*</span></label>
            <select id="credito-tipo-pago"
              class="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand font-semibold">
              <option value="Total" ${state.form.tipoPago === 'Total' ? 'selected' : ''}>Total (Sin anticipo)</option>
              <option value="Parcial" ${state.form.tipoPago === 'Parcial' ? 'selected' : ''}>Parcial (Con seña / anticipo)</option>
            </select>
          </div>
        </div>
        <div id="parcial-wrap" class="${state.form.tipoPago === 'Parcial' ? '' : 'hidden'} grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-purple-200/60 dark:border-brand/20">
          <div>
            <label class="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">Monto Abonado (Gs.) <span class="text-danger">*</span></label>
            <input type="text" id="credito-monto-abonado" value="${formatGuaranies(state.form.montoAbonado)}"
              class="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand font-mono font-bold" />
          </div>
          <div class="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-purple-200 dark:border-brand/30 flex flex-col justify-center">
            <p class="text-[10px] text-slate-400 font-semibold">Saldo Pendiente Calculado</p>
            <p id="credito-saldo-calc" class="text-sm font-black text-rose-600 dark:text-rose-400 font-mono">0 Gs.</p>
          </div>
        </div>
      </div>
    `;

    // Tarjeta Costo Total del Pedido con vista rápida de crédito/pagado en tiempo real
    const totalCard = document.createElement('div');
    totalCard.className =
      'p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-right flex flex-col justify-center shadow-xs space-y-3';
    totalCard.innerHTML = `
      <div>
        <div class="flex items-center justify-between gap-2 mb-1.5">
          <span id="order-cond-badge" class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            Contado
          </span>
          <p class="text-[11px] uppercase tracking-wider font-bold text-slate-400">COSTO TOTAL DEL PEDIDO</p>
        </div>
        <p id="order-grand-total" class="text-3xl sm:text-4xl font-black text-brand font-mono">0 Gs.</p>
      </div>
      <div class="pt-2 border-t border-slate-200/80 dark:border-slate-700/60 text-xs flex flex-col gap-1.5 text-slate-500 dark:text-slate-400">
        <div class="flex items-center justify-between font-semibold">
          <span>Ya Pagado:</span>
          <span id="order-pagado-text" class="font-bold text-emerald-600 dark:text-emerald-400 font-mono">0 Gs.</span>
        </div>
        <div class="flex items-center justify-between font-semibold">
          <span>Saldo Pendiente:</span>
          <span id="order-saldo-text" class="font-bold text-slate-700 dark:text-slate-300 font-mono">0 Gs.</span>
        </div>
        <div class="flex items-center justify-between pt-1 border-t border-slate-200/50 dark:border-slate-700/40">
          <span>Costo Proveedores:</span>
          <span id="order-prov-cost" class="font-bold text-slate-700 dark:text-slate-300 font-mono">0 Gs.</span>
        </div>
        <div class="flex items-center justify-between">
          <span>Margen Estimado:</span>
          <span id="order-margin-est" class="font-bold text-emerald-600 dark:text-emerald-400 font-mono">0 Gs.</span>
        </div>
      </div>
    `;

    condGrid.append(condLeft, totalCard);
    cardCondiciones.appendChild(condGrid);

    function updateTotalOrderCard() {
      let totalVenta = 0;
      state.form.items.forEach((it) => {
        totalVenta += Number(it.subtotal) || 0;
      });

      let totalProvCost = 0;
      state.form.proveedores.forEach((pr) => {
        totalProvCost += Number(pr.subtotal) || 0;
      });

      const margen = totalVenta - totalProvCost;

      const gt = cardCondiciones.querySelector('#order-grand-total');
      if (gt) gt.textContent = `Gs. ${Math.round(totalVenta).toLocaleString('es-PY')}`;

      const isContado = state.form.condicionVenta === 'Contado';
      const condBadge = cardCondiciones.querySelector('#order-cond-badge');
      const pagadoEl = cardCondiciones.querySelector('#order-pagado-text');
      const saldoElCard = cardCondiciones.querySelector('#order-saldo-text');

      let montoAbonado = 0;
      let saldo = 0;

      if (isContado) {
        montoAbonado = totalVenta;
        saldo = 0;
        if (condBadge) {
          condBadge.className =
            'px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800';
          condBadge.textContent = 'Contado · Totalmente Pagado';
        }
        if (pagadoEl) pagadoEl.textContent = formatGuaranies(montoAbonado);
        if (saldoElCard) {
          saldoElCard.textContent = '0 Gs.';
          saldoElCard.className = 'font-bold text-emerald-600 dark:text-emerald-400 font-mono';
        }
      } else {
        // Crédito
        const isParcial = state.form.tipoPago === 'Parcial';
        montoAbonado = isParcial ? (Number(state.form.montoAbonado) || 0) : 0;
        saldo = Math.max(0, totalVenta - montoAbonado);

        if (condBadge) {
          condBadge.className =
            'px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 dark:bg-brand/20 text-brand border border-purple-200 dark:border-brand/40';
          condBadge.textContent = isParcial ? 'Crédito (Pago Parcial / Seña)' : 'Crédito (Total a Plazo)';
        }
        if (pagadoEl) pagadoEl.textContent = formatGuaranies(montoAbonado);
        if (saldoElCard) {
          saldoElCard.textContent = formatGuaranies(saldo);
          saldoElCard.className = saldo > 0
            ? 'font-black text-rose-600 dark:text-rose-400 font-mono'
            : 'font-bold text-emerald-600 dark:text-emerald-400 font-mono';
        }
      }

      const provCostEl = cardCondiciones.querySelector('#order-prov-cost');
      if (provCostEl) provCostEl.textContent = formatGuaranies(totalProvCost);

      const marginEl = cardCondiciones.querySelector('#order-margin-est');
      if (marginEl) {
        marginEl.textContent = formatGuaranies(margen);
        marginEl.className = margen >= 0
          ? 'font-bold text-emerald-600 dark:text-emerald-400 font-mono'
          : 'font-bold text-rose-600 dark:text-rose-400 font-mono';
      }

      // Actualizar saldo de crédito en tiempo real
      const saldoEl = condLeft.querySelector('#credito-saldo-calc');
      if (saldoEl) {
        saldoEl.textContent = formatGuaranies(saldo);
        if (saldo > 0) {
          saldoEl.className = 'text-sm font-black text-rose-600 dark:text-rose-400 font-mono';
        } else {
          saldoEl.className = 'text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono';
        }
      }
    }

    // Event listeners para condición y modalidades
    const selCond = condLeft.querySelector('#select-condicion');
    const credWrap = condLeft.querySelector('#credito-options-wrap');
    selCond.addEventListener('change', (e) => {
      state.form.condicionVenta = e.target.value;
      if (state.form.condicionVenta === 'Credito') {
        credWrap.classList.remove('hidden');
      } else {
        credWrap.classList.add('hidden');
      }
      updateTotalOrderCard();
    });

    const selMod = condLeft.querySelector('#select-modalidad');
    const otroModWrap = condLeft.querySelector('#otro-modalidad-wrap');
    selMod.addEventListener('change', (e) => {
      state.form.modalidadEntrega = e.target.value;
      if (state.form.modalidadEntrega === 'Otro') {
        otroModWrap.classList.remove('hidden');
      } else {
        otroModWrap.classList.add('hidden');
      }
    });

    condLeft.querySelector('#inp-modalidad-otro')?.addEventListener('input', (e) => {
      state.form.modalidadEntregaOtro = e.target.value;
    });

    condLeft.querySelector('#credito-fecha')?.addEventListener('input', (e) => {
      state.form.fechaCobro = e.target.value;
    });

    const selTipoPago = condLeft.querySelector('#credito-tipo-pago');
    const parcWrap = condLeft.querySelector('#parcial-wrap');
    selTipoPago.addEventListener('change', (e) => {
      state.form.tipoPago = e.target.value;
      if (state.form.tipoPago === 'Parcial') {
        parcWrap.classList.remove('hidden');
      } else {
        parcWrap.classList.add('hidden');
      }
      updateTotalOrderCard();
    });

    const abonadoInp = condLeft.querySelector('#credito-monto-abonado');
    abonadoInp?.addEventListener('input', (e) => {
      state.form.montoAbonado = parseGuaranies(e.target.value);
      e.target.value = formatGuaranies(state.form.montoAbonado);
      updateTotalOrderCard();
    });

    updateTotalOrderCard();
    formWrap.appendChild(cardCondiciones);

    // ==========================================================================
    // CARD 5: NOTAS / ESPECIFICACIONES DE PRODUCCIÓN (OPCIONAL)
    // ==========================================================================
    const cardNotas = document.createElement('div');
    cardNotas.className =
      'p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-2';
    cardNotas.innerHTML = `
      <h2 class="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
        4. NOTAS / ESPECIFICACIONES DE PRODUCCIÓN (OPCIONAL)
      </h2>
      <textarea id="notas-prod-textarea" rows="4"
        placeholder="Ej: Sublimación en taza color negro mate, diseño enviado por WhatsApp, empaque para regalo, entrega el viernes por la tarde..."
        class="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand leading-relaxed">${escapeHtml(
          state.form.notasProduccion
        )}</textarea>
    `;
    cardNotas.querySelector('#notas-prod-textarea')?.addEventListener('input', (e) => {
      state.form.notasProduccion = e.target.value;
    });
    formWrap.appendChild(cardNotas);

    // ==========================================================================
    // FOOTER ACTIONS: CANCELAR & GUARDAR PEDIDO
    // ==========================================================================
    const footerActions = document.createElement('div');
    footerActions.className = 'flex items-center justify-end gap-3 pt-2';

    const cancelBtn = createButton({
      text: 'Cancelar',
      variant: 'cancel',
      size: 'md',
      onClick: () => {
        state.view = 'list';
        render();
      },
    });

    const saveBtn = createButton({
      text: isEdit ? 'Actualizar Pedido' : 'Guardar Pedido',
      icon: 'fa-solid fa-check',
      variant: 'primary',
      size: 'md',
      onClick: async () => {
        // Validaciones
        const cliName = state.form.clienteNombre.trim();
        if (!cliName) {
          toast.error('Debe indicar o seleccionar el cliente.');
          return;
        }

        if (state.form.items.length === 0) {
          toast.error('El pedido debe tener al menos un producto agregado.');
          return;
        }

        saveBtn.setLoading(true);
        try {
          const payload = {
            clienteId: state.form.clienteId,
            clienteCasual: state.form.clienteCasual,
            clienteNombre: cliName,
            clienteTelefono: state.form.clienteTelefono.trim(),
            clienteDocumento: state.form.clienteDocumento.trim(),
            clienteDireccion: state.form.clienteDireccion.trim(),
            fechaPedido: state.form.fechaPedido || getTodayIsoDate(),
            condicionVenta: state.form.condicionVenta,
            tipoPago: state.form.condicionVenta === 'Credito' ? state.form.tipoPago : null,
            fechaCobro: state.form.condicionVenta === 'Credito' ? state.form.fechaCobro : null,
            montoAbonado: state.form.condicionVenta === 'Credito' ? state.form.montoAbonado : 0,
            modalidadEntrega: state.form.modalidadEntrega,
            modalidadEntregaOtro: state.form.modalidadEntregaOtro.trim(),
            notasProduccion: state.form.notasProduccion.trim(),
            items: state.form.items,
            proveedores: state.form.proveedores,
          };

          if (isEdit) {
            await apiFetch(`/api/pedidos/${state.editingId}`, {
              method: 'PUT',
              body: JSON.stringify(payload),
            });
            toast.success('Pedido actualizado exitosamente.');
          } else {
            const res = await apiFetch('/api/pedidos', {
              method: 'POST',
              body: JSON.stringify(payload),
            });
            toast.success(`Pedido ${res.numeroPedido || ''} registrado con éxito.`);
          }

          state.view = 'list';
          state.editingId = null;
          fetchPedidos();
        } catch (err) {
          toast.error(err.message || 'Error al guardar el pedido');
        } finally {
          saveBtn.setLoading(false);
        }
      },
    });

    footerActions.append(cancelBtn, saveBtn);
    formWrap.appendChild(footerActions);

    parent.appendChild(formWrap);
  }

  // Cargar pedido para edición
  async function editOrder(order) {
    try {
      const full = await apiFetch(`/api/pedidos/${order.id}`);
      state.editingId = order.id;
      state.form = {
        numeroPedido: full.numeroPedido,
        fechaPedido: full.fechaPedido || (full.createdAt ? full.createdAt.split('T')[0] : getTodayIsoDate()),
        clienteCasual: Boolean(full.clienteCasual),
        clienteId: full.clienteId || null,
        clienteNombre: full.clienteNombre || '',
        clienteTelefono: full.clienteTelefono || '',
        clienteDocumento: full.clienteDocumento || '',
        clienteDireccion: full.clienteDireccion || '',
        condicionVenta: full.condicionVenta || 'Contado',
        tipoPago: full.tipoPago || 'Total',
        fechaCobro: full.fechaCobro || '',
        montoAbonado: Number(full.montoPagado) || 0,
        modalidadEntrega: full.modalidadEntrega || 'Retiro en Local',
        modalidadEntregaOtro: full.modalidadEntregaOtro || '',
        notasProduccion: full.notasProduccion || '',
        items: Array.isArray(full.items) ? full.items : [],
        proveedores: Array.isArray(full.proveedores) ? full.proveedores : [],
      };
      state.view = 'form';
      render();
      loadFormCatalogs();
    } catch (err) {
      toast.error('No se pudo cargar el pedido para edición');
    }
  }

  // ============================================================================
  // BARRA DE PROGRESO DE 4 ESTADOS (Creado, En Pausa, En Producción, Listo)
  // Ubicada encima de "Productos en la Orden".
  // ============================================================================
  function createOrderStatusStepperCard(p, onRefresh) {
    const card = document.createElement('div');
    card.className =
      'p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-5';

    let historyList = [];
    try {
      historyList =
        typeof p.historialEstados === 'string'
          ? JSON.parse(p.historialEstados)
          : Array.isArray(p.historialEstados)
          ? p.historialEstados
          : [];
    } catch (_) {
      historyList = [];
    }

    function getStatusDate(statusName) {
      if (statusName === 'Creado' && p.createdAt) return formatDateTimeFull(p.createdAt);
      if (statusName === 'En Producción' && p.fechaEnProduccion) return formatDateTimeFull(p.fechaEnProduccion);
      if (statusName === 'En Pausa' && p.fechaEnPausa) return formatDateTimeFull(p.fechaEnPausa);
      if (statusName === 'Listo' && p.fechaListo) return formatDateTimeFull(p.fechaListo);

      const entry = [...historyList].reverse().find((h) => h.estado === statusName);
      if (entry && entry.fecha) return formatDateTimeFull(entry.fecha);

      if (p.estado === statusName && p.updatedAt) {
        return formatDateTimeFull(p.updatedAt);
      }
      return null;
    }

    const STEPS = [
      { id: 'Creado', label: 'Creado', stepNum: 1, icon: 'fa-regular fa-clipboard' },
      { id: 'En Pausa', label: 'En Pausa', stepNum: 2, icon: 'fa-solid fa-circle-pause' },
      { id: 'En Producción', label: 'Producción', stepNum: 3, icon: 'fa-solid fa-gears' },
      { id: 'Listo', label: 'Listo', stepNum: 4, icon: 'fa-solid fa-circle-check' },
    ];

    const isCurrentListo = p.estado === 'Listo';

    // Cabecera de la barra de progreso
    const header = document.createElement('div');
    header.className =
      'flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800';
    header.innerHTML = `
      <div class="flex items-center gap-2.5">
        <span class="w-8 h-8 rounded-xl bg-brand/10 text-brand flex items-center justify-center shrink-0">
          <i class="fa-solid fa-bars-progress text-sm"></i>
        </span>
        <div>
          <h3 class="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100">
            Flujo de Producción y Estado del Pedido
          </h3>
          <p class="text-[11px] text-slate-500 dark:text-slate-400">
            Control de 4 estados con registro de fecha y hora. Puedes marcar o retroceder el estado en cualquier momento.
          </p>
        </div>
      </div>
      <div class="shrink-0">
        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
          p.estado === 'Listo'
            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
            : p.estado === 'En Pausa'
            ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
            : p.estado === 'En Producción'
            ? 'bg-purple-50 dark:bg-brand/20 text-brand border border-purple-200 dark:border-brand/40'
            : 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
        }">
          <span class="w-2 h-2 rounded-full ${
            p.estado === 'Listo'
              ? 'bg-emerald-500 animate-pulse'
              : p.estado === 'En Pausa'
              ? 'bg-amber-500'
              : p.estado === 'En Producción'
              ? 'bg-brand animate-pulse'
              : 'bg-blue-500'
          }"></span>
          <span>Estado Actual: ${escapeHtml(p.estado)}</span>
        </span>
      </div>
    `;
    card.appendChild(header);

    // Contenedor de los 4 Pasos
    const stepsGrid = document.createElement('div');
    stepsGrid.className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3';

    STEPS.forEach((st) => {
      const isCurrent = p.estado === st.id;
      const dateText = getStatusDate(st.id);

      const stepCard = document.createElement('div');
      stepCard.className = [
        'relative p-3.5 rounded-xl border transition-all duration-200 flex flex-col justify-between gap-3 text-left',
        isCurrent
          ? 'bg-brand-soft/40 dark:bg-brand/10 border-brand shadow-xs ring-2 ring-brand/30'
          : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700',
      ].join(' ');

      const topInfo = document.createElement('div');
      topInfo.className = 'space-y-1.5';
      topInfo.innerHTML = `
        <div class="flex items-center justify-between gap-2">
          <span class="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black ${
            isCurrent
              ? 'bg-brand text-white shadow-xs'
              : dateText
              ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
          }">
            <i class="${st.icon}"></i>
          </span>
          <span class="text-[10px] font-bold uppercase tracking-wider ${
            isCurrent ? 'text-brand' : 'text-slate-400 dark:text-slate-500'
          }">
            Paso ${st.stepNum}
          </span>
        </div>
        <div class="pt-1">
          <p class="text-xs font-bold ${
            isCurrent ? 'text-brand' : 'text-slate-800 dark:text-slate-200'
          }">
            ${escapeHtml(st.label)}
          </p>
          <p class="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
            <i class="fa-regular fa-clock text-[9px] text-slate-400"></i>
            <span>${dateText ? dateText : 'Sin registrar'}</span>
          </p>
        </div>
      `;
      stepCard.appendChild(topInfo);

      const actionArea = document.createElement('div');
      actionArea.className = 'pt-2 border-t border-slate-200/50 dark:border-slate-700/50';

      if (st.id === 'Listo') {
        const listoActionsWrap = document.createElement('div');
        listoActionsWrap.className = 'flex flex-col gap-1.5 w-full';

        if (isCurrent) {
          const badgeCulminado = document.createElement('div');
          badgeCulminado.className =
            'flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 pb-0.5';
          badgeCulminado.innerHTML = `
            <i class="fa-solid fa-circle-check text-[10px]"></i>
            <span>Pedido Culminado</span>
          `;
          listoActionsWrap.appendChild(badgeCulminado);
        }

        const btnGuardar = createButton({
          text: isCurrent ? 'Guardado como Listo' : 'Listo y Guardar',
          icon: 'fa-solid fa-check',
          variant: isCurrent ? 'cancel' : 'primary',
          size: 'sm',
          disabled: isCurrent,
          onClick: async () => {
            try {
              btnGuardar.setLoading(true);
              await apiFetch(`/api/pedidos/${p.id}/estado`, {
                method: 'PATCH',
                body: JSON.stringify({ estado: 'Listo' }),
              });
              toast.success(`Pedido ${p.numeroPedido} guardado como Listo.`);
              onRefresh();
            } catch (err) {
              toast.error(err.message || 'No se pudo guardar como Listo.');
            } finally {
              btnGuardar.setLoading(false);
            }
          },
        });
        btnGuardar.className += ' w-full justify-center text-xs py-1.5';

        const btnNotif = createButton({
          text: isCurrent ? 'Reenviar WhatsApp' : 'Listo y Notificar',
          icon: 'fa-brands fa-whatsapp',
          variant: 'primary',
          size: 'sm',
          onClick: () => {
            openListoNotificarModal(p, onRefresh);
          },
        });
        btnNotif.className += ' w-full justify-center text-xs py-1.5';

        listoActionsWrap.append(btnGuardar, btnNotif);
        actionArea.appendChild(listoActionsWrap);
      } else if (isCurrent) {
        actionArea.innerHTML = `
          <span class="inline-flex items-center gap-1 text-[11px] font-bold text-brand">
            <i class="fa-solid fa-check text-[10px]"></i>
            <span>Estado actual</span>
          </span>
        `;
      } else {
        const isRevert =
          p.estado === 'Listo' ||
          (p.estado === 'En Producción' && (st.id === 'Creado' || st.id === 'En Pausa')) ||
          (p.estado === 'En Pausa' && st.id === 'Creado');

        const btnChange = createButton({
          text: isRevert ? `Retroceder a ${st.label}` : `Marcar ${st.label}`,
          icon: isRevert ? 'fa-solid fa-arrow-rotate-left' : 'fa-solid fa-chevron-right',
          variant: isRevert ? 'cancel' : 'primary',
          size: 'sm',
          onClick: async () => {
            try {
              btnChange.setLoading(true);
              await apiFetch(`/api/pedidos/${p.id}/estado`, {
                method: 'PATCH',
                body: JSON.stringify({ estado: st.id }),
              });
              toast.success(`Estado del pedido cambiado a ${st.id}.`);
              onRefresh();
            } catch (err) {
              toast.error(err.message || 'Error al cambiar el estado.');
            } finally {
              btnChange.setLoading(false);
            }
          },
        });
        btnChange.className += ' w-full justify-center text-xs py-1.5';
        actionArea.appendChild(btnChange);
      }

      stepCard.appendChild(actionArea);
      stepsGrid.appendChild(stepCard);
    });

    card.appendChild(stepsGrid);

    return card;
  }

  // ============================================================================
  // VENTANA MODAL: NOTIFICAR PEDIDO LISTO POR WHATSAPP
  // Muestra la plantilla establecida en Configuración / Pedidos (Retiro o Envío)
  // con vista previa y posibilidad de editar antes de enviar.
  // ============================================================================
  async function openListoNotificarModal(orderArg, onRefresh) {
    let p = orderArg || {};
    if (!p.items || !p.proveedores || !p.modalidadEntrega) {
      try {
        const fetched = await apiFetch(`/api/pedidos/${p.id}`);
        if (fetched) p = fetched;
      } catch (_) {}
    }

    let configs = {};
    let templates = [];

    try {
      const [cfgRes, tplRes] = await Promise.all([
        apiFetch('/api/configuracion').catch(() => null),
        apiFetch('/api/perfiles-mensajes').catch(() => null),
      ]);
      if (cfgRes) configs = cfgRes;
      if (tplRes && Array.isArray(tplRes.data)) templates = tplRes.data;
    } catch (_) {}

    const isRetiro = p.modalidadEntrega === 'Retiro en Local';
    const pedCfg = configs.pedidos_notificaciones || {};
    const tplId = isRetiro ? pedCfg.plantilla_retiro_id : pedCfg.plantilla_envio_id;

    // Buscar plantilla configurada
    const matchedTemplate = templates.find((t) => String(t.id) === String(tplId));

    // Determinar formato de nombre de cliente según configuración de WhatsApp
    const waNameCfg = configs.whatsapp_nombre_formato || {
      incluir_nombre: true,
      incluir_apellido: true,
    };
    let formattedClientName = p.clienteNombre || '';
    if (waNameCfg.incluir_apellido === false && formattedClientName) {
      formattedClientName = formattedClientName.split(' ')[0] || formattedClientName;
    }

    // Resumen de productos
    let prodSummary = '';
    if (Array.isArray(p.items) && p.items.length > 0) {
      prodSummary = p.items
        .map((it) => `${it.nombreProducto} (${it.cantidad} un.)`)
        .join(', ');
    } else {
      prodSummary = 'Productos personalizados';
    }

    let totalCant = 0;
    if (Array.isArray(p.items)) {
      p.items.forEach((it) => (totalCant += Number(it.cantidad) || 0));
    }

    const empresaName =
      configs.empresa_datos?.razon_social || 'NETZ - R1 Personalizados';

    // Plantilla base
    let baseText = '';
    if (matchedTemplate && matchedTemplate.contenido) {
      baseText = matchedTemplate.contenido;
    } else if (isRetiro) {
      baseText =
        '¡Hola {nombre}! 👋 Te informamos que tu pedido *{pedido}* ({productos}) ya está *LISTO* para ser retirado en nuestro local. ¡Te esperamos! 📍';
    } else {
      baseText =
        '¡Hola {nombre}! 👋 Te informamos que tu pedido *{pedido}* ({productos}) ya está *LISTO* y preparado para el envío a tu dirección. En breve te avisaremos cuando el repartidor esté en camino. 🚚';
    }

    // Resolver variables dinámicas
    let initialMessage = baseText
      .split('{nombre}').join(formattedClientName)
      .split('{pedido}').join(p.numeroPedido || '')
      .split('{numero_pedido}').join(p.numeroPedido || '')
      .split('{productos}').join(prodSummary)
      .split('{cantidad_productos}').join(String(totalCant))
      .split('{total}').join(formatGuaranies(p.montoTotal))
      .split('{saldo}').join(formatGuaranies(p.saldoPendiente))
      .split('{monto_pagado}').join(formatGuaranies(p.montoPagado))
      .split('{modalidad}').join(p.modalidadEntrega || 'Retiro en Local')
      .split('{direccion}').join(p.clienteDireccion || '—')
      .split('{telefono}').join(p.clienteTelefono || '')
      .split('{documento}').join(p.clienteDocumento || '')
      .split('{empresa}').join(empresaName);

    const content = document.createElement('div');
    content.className = 'space-y-4 p-1 sm:p-2';

    // Banner informativo del cliente y plantilla
    const infoBanner = document.createElement('div');
    infoBanner.className =
      'p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs';
    infoBanner.innerHTML = `
      <div>
        <span class="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Cliente Destinatario:</span>
        <strong class="text-slate-800 dark:text-slate-100 text-sm">${escapeHtml(formattedClientName)}</strong>
        <p class="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
          <i class="fa-brands fa-whatsapp text-emerald-500"></i> ${escapeHtml(p.clienteTelefono || 'Sin teléfono registrado')}
        </p>
      </div>
      <div>
        <span class="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Modalidad / Plantilla:</span>
        <strong class="text-slate-800 dark:text-slate-100">${escapeHtml(p.modalidadEntrega)}</strong>
        <p class="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5 truncate">
          ${escapeHtml(
            matchedTemplate
              ? matchedTemplate.titulo
              : isRetiro
              ? 'Plantilla Predeterminada Retiro'
              : 'Plantilla Predeterminada Envío'
          )}
        </p>
      </div>
    `;
    content.appendChild(infoBanner);

    // Campo de teléfono (editable por si requiere corrección)
    const phoneInputWrap = document.createElement('div');
    phoneInputWrap.className = 'space-y-1';
    phoneInputWrap.innerHTML = `
      <label class="block text-xs font-bold text-slate-700 dark:text-slate-200">
        Número de Teléfono / WhatsApp de Destino:
      </label>
      <input type="text" id="wa-modal-phone" value="${escapeHtml(p.clienteTelefono || '')}" placeholder="Ej. 0981 123 456"
        class="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-brand" />
    `;
    content.appendChild(phoneInputWrap);

    // Editor de texto del mensaje
    const msgWrap = document.createElement('div');
    msgWrap.className = 'space-y-2';
    msgWrap.innerHTML = `
      <div class="flex items-center justify-between gap-2">
        <label class="block text-xs font-bold text-slate-700 dark:text-slate-200">
          Mensaje de WhatsApp (Puedes editarlo antes de enviar):
        </label>
        <span id="wa-modal-char-count" class="text-[11px] text-slate-400 font-mono">
          ${initialMessage.length} caracteres
        </span>
      </div>
      <textarea id="wa-modal-msg" rows="5"
        class="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand font-normal leading-relaxed resize-y">${escapeHtml(initialMessage)}</textarea>
    `;
    content.appendChild(msgWrap);

    // Botones rápidos para insertar variables dinámicas
    const chipsWrap = document.createElement('div');
    chipsWrap.className = 'flex flex-wrap items-center gap-1.5 text-[11px]';
    chipsWrap.innerHTML = `
      <span class="text-slate-400 text-[10px] uppercase font-bold mr-1">Insertar variable:</span>
    `;

    const DYN_CHIPS = [
      { token: '{nombre}', label: 'Nombre' },
      { token: '{pedido}', label: 'N° Pedido' },
      { token: '{productos}', label: 'Productos' },
      { token: '{total}', label: 'Total' },
      { token: '{saldo}', label: 'Saldo' },
      { token: '{modalidad}', label: 'Modalidad' },
    ];

    const textarea = msgWrap.querySelector('#wa-modal-msg');
    const charCount = msgWrap.querySelector('#wa-modal-char-count');

    DYN_CHIPS.forEach((ch) => {
      const chipBtn = document.createElement('button');
      chipBtn.type = 'button';
      chipBtn.className =
        'px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono text-[10px] font-semibold transition-colors cursor-pointer';
      chipBtn.textContent = `+ ${ch.token}`;
      chipBtn.addEventListener('click', () => {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const current = textarea.value;
        textarea.value = current.substring(0, start) + ch.token + current.substring(end);
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = start + ch.token.length;
        updateBubble();
      });
      chipsWrap.appendChild(chipBtn);
    });
    content.appendChild(chipsWrap);

    // Vista Previa en Vivo estilo WhatsApp (Burbuja verde)
    const previewWrap = document.createElement('div');
    previewWrap.className = 'space-y-1.5 pt-2';
    previewWrap.innerHTML = `
      <label class="block text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
        <i class="fa-brands fa-whatsapp text-emerald-500"></i>
        <span>Vista Previa del Mensaje en WhatsApp:</span>
      </label>
      <div class="p-3.5 sm:p-4 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex justify-end">
        <div class="max-w-[92%] sm:max-w-[85%] rounded-2xl rounded-tr-xs bg-[#d9fdd3] dark:bg-[#054640] text-slate-900 dark:text-slate-100 px-3.5 py-2.5 text-xs sm:text-sm shadow-xs space-y-1">
          <div id="wa-preview-text" class="whitespace-pre-wrap leading-relaxed break-words font-sans"></div>
          <div class="flex items-center justify-end gap-1 text-[10px] text-slate-500 dark:text-emerald-300 font-mono pt-0.5">
            <span id="wa-preview-time"></span>
            <i class="fa-solid fa-check-double text-blue-500 text-[10px]"></i>
          </div>
        </div>
      </div>
    `;
    content.appendChild(previewWrap);

    const previewText = previewWrap.querySelector('#wa-preview-text');
    const previewTime = previewWrap.querySelector('#wa-preview-time');

    function updateBubble() {
      const text = textarea.value;
      charCount.textContent = `${text.length} caracteres`;

      let formatted = escapeHtml(text);
      formatted = formatted.replace(/\*([^*\n]+)\*/g, '<strong class="font-bold">$1</strong>');
      formatted = formatted.replace(/_([^_\n]+)_/g, '<em class="italic">$1</em>');
      formatted = formatted.replace(/~([^~\n]+)~/g, '<del class="line-through">$1</del>');

      previewText.innerHTML =
        formatted || '<em class="text-slate-400 italic">Escribe un mensaje para ver la vista previa...</em>';
      previewTime.textContent = new Date().toLocaleTimeString('es-PY', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
    }

    textarea.addEventListener('input', updateBubble);
    updateBubble();

    // Abrir Modal estandarizado (AGENTS.md Sección 5)
    openModal({
      title: 'Notificar Pedido Listo por WhatsApp',
      content,
      size: 'lg',
      confirmText: 'Enviar WhatsApp y Guardar',
      cancelText: 'Cancelar',
      confirmVariant: 'primary',
      onConfirm: async () => {
        const phoneField = content.querySelector('#wa-modal-phone');
        const phone = (phoneField ? phoneField.value : p.clienteTelefono || '').trim();
        const finalMsg = textarea.value.trim();

        if (!phone) {
          toast.error('Debes ingresar un número de teléfono o WhatsApp para enviar la notificación.');
          return false;
        }
        if (!finalMsg) {
          toast.error('El contenido del mensaje no puede estar vacío.');
          return false;
        }

        try {
          // 1. Guardar estado como Listo en la BD
          await apiFetch(`/api/pedidos/${p.id}/estado`, {
            method: 'PATCH',
            body: JSON.stringify({ estado: 'Listo' }),
          });

          // 2. Enviar mensaje por WhatsApp
          const cleanPhone = phone.replace(/[^\d+]/g, '');
          await apiFetch('/api/difusion-mensajes', {
            method: 'POST',
            body: JSON.stringify({
              tipo: 'Mensaje',
              contactoOrigen: 'Pedido',
              nombreDestinatario: p.clienteNombre,
              telefonoDestinatario: cleanPhone,
              plantillaTitulo: matchedTemplate
                ? matchedTemplate.titulo
                : isRetiro
                ? 'Retiro en Local'
                : 'Envío a Domicilio',
              contenido: finalMsg,
            }),
          });

          toast.success(`¡Pedido ${p.numeroPedido} marcado como Listo y notificación enviada por WhatsApp!`);
          onRefresh();
          return true;
        } catch (err) {
          toast.error(err.message || 'Error al enviar la notificación por WhatsApp.');
          return false;
        }
      },
    });
  }

  // ============================================================================
  // VISTA 3: VISTA PREVIA DETALLADA DEL PEDIDO (Toma toda el área del módulo)
  // ============================================================================
  async function openOrderDetail(order) {
    try {
      const full = await apiFetch(`/api/pedidos/${order.id}`);
      state.viewingOrder = full;
      state.view = 'detail';
      render();
    } catch (err) {
      toast.error('No se pudo abrir el detalle del pedido');
    }
  }

  function renderDetailView(parent) {
    const p = state.viewingOrder || {};

    const pageWrap = document.createElement('div');
    pageWrap.className = 'w-full space-y-6 pb-12';

    // 1. Breadcrumb
    const breadcrumb = document.createElement('div');
    breadcrumb.className = 'flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400';
    breadcrumb.innerHTML = `
      <button type="button" id="btn-bc-back-order" class="inline-flex items-center gap-1.5 hover:text-brand font-medium cursor-pointer">
        <i class="fa-solid fa-arrow-left text-[11px]"></i>
        <span>Lista de Pedidos</span>
      </button>
      <span>/</span>
      <span class="text-brand font-semibold">Vista Previa del Pedido</span>
    `;
    breadcrumb.querySelector('#btn-bc-back-order')?.addEventListener('click', () => {
      state.view = 'list';
      state.viewingOrder = null;
      render();
    });
    pageWrap.appendChild(breadcrumb);

    // 2. Barra de Título Superior
    const titleBar = document.createElement('div');
    titleBar.className =
      'flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs';

    const titleLeft = document.createElement('div');
    titleLeft.className = 'space-y-1.5 min-w-0';

    titleLeft.innerHTML = `
      <div class="flex flex-wrap items-center gap-2.5">
        <span class="px-2.5 py-0.5 rounded-md font-mono text-sm font-black bg-brand-soft text-brand border border-brand/30">
          ${escapeHtml(p.numeroPedido)}
        </span>
        <span class="px-2 py-0.5 rounded-md text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
          Semana ${p.semanaIso} (${p.anioIso})
        </span>
        <span class="px-2.5 py-0.5 rounded-full text-xs font-bold ${
          p.estado === 'Listo'
            ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
            : p.estado === 'Cancelado'
            ? 'bg-rose-50 text-rose-600 border border-rose-200'
            : 'bg-blue-50 text-blue-600 border border-blue-200'
        }">
          ${escapeHtml(p.estado)}
        </span>
      </div>
      <p class="text-xs text-slate-500 dark:text-slate-400">
        Cliente: <strong class="text-slate-800 dark:text-slate-200">${escapeHtml(p.clienteNombre)}</strong>
        ${p.clienteCasual ? '<span class="ml-1 text-[10px] text-amber-500 font-bold">(Casual)</span>' : ''}
        ${p.clienteTelefono ? ` · Tel: ${escapeHtml(p.clienteTelefono)}` : ''}
      </p>
      <div class="flex flex-wrap items-center gap-x-4 text-[11px] text-slate-400 pt-0.5">
        <span>Fecha del Pedido: <strong class="text-slate-800 dark:text-slate-200">${formatDateOnly(p.fechaPedido)} (Semana ${p.semanaIso})</strong></span>
        <span>Registro en Sistema: <strong>${formatDateTimeFull(p.createdAt)}</strong></span>
        <span>Modificado: <strong>${formatDateTimeFull(p.updatedAt)}</strong></span>
      </div>
    `;

    const titleActions = document.createElement('div');
    titleActions.className = 'flex items-center gap-2.5 shrink-0';

    const btnBack = createButton({
      text: 'Volver',
      icon: 'fa-solid fa-arrow-left',
      variant: 'cancel',
      size: 'md',
      onClick: () => {
        state.view = 'list';
        state.viewingOrder = null;
        render();
      },
    });

    const btnEdit = createButton({
      text: 'Editar',
      icon: 'fa-regular fa-pen-to-square',
      variant: 'primary',
      size: 'md',
      onClick: () => editOrder(p),
    });

    const btnDelete = createButton({
      text: 'Cancelar Pedido',
      icon: 'fa-regular fa-trash-can',
      variant: 'danger',
      size: 'md',
      onClick: () => confirmDeleteOrder(p),
    });

    titleActions.append(btnBack, btnEdit, btnDelete);
    titleBar.append(titleLeft, titleActions);
    pageWrap.appendChild(titleBar);

    // 3. Grid de detalles
    const detailGrid = document.createElement('div');
    detailGrid.className = 'grid grid-cols-1 lg:grid-cols-3 gap-6';

    const leftCol = document.createElement('div');
    leftCol.className = 'lg:col-span-2 space-y-6';

    // Función para refrescar los datos en tiempo real al cambiar estado
    async function refreshCurrentOrder() {
      try {
        const full = await apiFetch(`/api/pedidos/${p.id}`);
        state.viewingOrder = full;
        render();
      } catch (err) {
        toast.error('No se pudo actualizar el detalle del pedido');
      }
    }

    // Barra de Progreso de 4 Estados (Creado, En Pausa, En Producción, Listo)
    // ENCIMA DE "PRODUCTOS EN LA ORDEN"
    const statusCard = createOrderStatusStepperCard(p, refreshCurrentOrder);
    leftCol.appendChild(statusCard);

    // Tabla de Ítems
    const itemsCard = document.createElement('div');
    itemsCard.className =
      'p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4';
    itemsCard.innerHTML = `
      <h3 class="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
        <i class="fa-solid fa-cubes text-brand"></i>
        <span>Productos en la Orden (${Array.isArray(p.items) ? p.items.length : 0})</span>
      </h3>
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs border-collapse">
          <thead class="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-500">
            <tr>
              <th class="px-3.5 py-2">Producto</th>
              <th class="px-3.5 py-2 text-center">Cantidad</th>
              <th class="px-3.5 py-2">Precio Unitario</th>
              <th class="px-3.5 py-2 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800/80" id="order-detail-items-body"></tbody>
        </table>
      </div>
    `;

    const itemsBody = itemsCard.querySelector('#order-detail-items-body');
    if (Array.isArray(p.items)) {
      p.items.forEach((it) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="px-3.5 py-2.5">
            <p class="font-bold text-slate-800 dark:text-slate-200">${escapeHtml(it.nombreProducto)}</p>
            ${it.sku ? `<span class="font-mono text-[10px] text-brand">${escapeHtml(it.sku)}</span>` : '<span class="text-[10px] text-amber-500 font-semibold">Manual</span>'}
          </td>
          <td class="px-3.5 py-2.5 text-center font-bold">${it.cantidad}</td>
          <td class="px-3.5 py-2.5 font-mono">${formatGuaranies(it.precioUnitario)}</td>
          <td class="px-3.5 py-2.5 text-right font-mono font-black text-brand">${formatGuaranies(it.subtotal)}</td>
        `;
        itemsBody.appendChild(tr);
      });
    }
    leftCol.appendChild(itemsCard);

    // Proveedores asociados si existen
    if (Array.isArray(p.proveedores) && p.proveedores.length > 0) {
      const provCard = document.createElement('div');
      provCard.className =
        'p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4';
      provCard.innerHTML = `
        <h3 class="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
          <i class="fa-solid fa-truck-field text-brand"></i>
          <span>Proveedores y Costos Asignados</span>
        </h3>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs border-collapse">
            <thead class="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-500">
              <tr>
                <th class="px-3.5 py-2">Proveedor</th>
                <th class="px-3.5 py-2">Producto Asignado</th>
                <th class="px-3.5 py-2 text-center">Cantidad</th>
                <th class="px-3.5 py-2">Costo Unitario</th>
                <th class="px-3.5 py-2 text-right">Costo Total</th>
                <th class="px-3.5 py-2 text-center">Estado Pago</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800/80">
              ${p.proveedores
                .map(
                  (pr) => {
                    const st = pr.estadoPago || 'Pendiente';
                    let stBadge = '';
                    if (st === 'Pagado') {
                      stBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">Pagado</span>';
                    } else if (st === 'Pago Parcial') {
                      stBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-brand dark:bg-purple-950/60 dark:text-brand">Parcial (${formatGuaranies(pr.montoPagado || 0)})</span>`;
                    } else {
                      stBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">Pendiente</span>';
                    }
                    return `
                    <tr>
                      <td class="px-3.5 py-2 font-bold">${escapeHtml(pr.nombreProveedor)}</td>
                      <td class="px-3.5 py-2 text-slate-600 dark:text-slate-300">${escapeHtml(pr.productoNombre || '—')}</td>
                      <td class="px-3.5 py-2 text-center">${pr.cantidad}</td>
                      <td class="px-3.5 py-2 font-mono">${formatGuaranies(pr.costo)}</td>
                      <td class="px-3.5 py-2 text-right font-mono font-bold text-brand">${formatGuaranies(pr.subtotal)}</td>
                      <td class="px-3.5 py-2 text-center">${stBadge}</td>
                    </tr>
                    `;
                  }
                )
                .join('')}
            </tbody>
          </table>
        </div>
      `;
      leftCol.appendChild(provCard);
    }

    // Notas de producción
    if (p.notasProduccion) {
      const notasCard = document.createElement('div');
      notasCard.className =
        'p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-2';
      notasCard.innerHTML = `
        <h3 class="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
          <i class="fa-regular fa-file-lines text-brand"></i>
          <span>Notas y Especificaciones de Producción</span>
        </h3>
        <p class="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">${escapeHtml(
          p.notasProduccion
        )}</p>
      `;
      leftCol.appendChild(notasCard);
    }

    // Columna Derecha: Finanzas y Entrega
    const rightCol = document.createElement('div');
    rightCol.className = 'space-y-6';

    const finCardDet = document.createElement('div');
    finCardDet.className =
      'p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4';
    finCardDet.innerHTML = `
      <h3 class="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
        <i class="fa-solid fa-receipt text-brand"></i>
        <span>Condición Financiera</span>
      </h3>
      <div class="space-y-3 text-xs">
        <div class="flex items-center justify-between">
          <span class="text-slate-400">Condición de Venta:</span>
          <span class="font-bold text-slate-800 dark:text-slate-200">${escapeHtml(p.condicionVenta)}</span>
        </div>
        ${
          p.condicionVenta === 'Credito'
            ? `
          <div class="flex items-center justify-between">
            <span class="text-slate-400">Vencimiento / Cobro:</span>
            <span class="font-bold text-slate-800 dark:text-slate-200">${formatDateOnly(p.fechaCobro)}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-slate-400">Tipo de Pago:</span>
            <span class="font-bold text-slate-800 dark:text-slate-200">${escapeHtml(p.tipoPago || 'Total')}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-slate-400">Monto Abonado:</span>
            <span class="font-bold text-emerald-600">${formatGuaranies(p.montoPagado)}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-slate-400">Saldo Pendiente:</span>
            <span class="font-black ${Number(p.saldoPendiente) > 0 ? 'text-rose-600' : 'text-emerald-600'}">${formatGuaranies(p.saldoPendiente)}</span>
          </div>
        `
            : `
          <div class="flex items-center justify-between">
            <span class="text-slate-400">Estado de Pago:</span>
            <span class="font-bold text-emerald-600">Totalmente Pagado</span>
          </div>
        `
        }
        <div class="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-sm">
          <span class="font-bold text-slate-800 dark:text-slate-200">TOTAL DEL PEDIDO:</span>
          <span class="font-black text-brand text-base">${formatGuaranies(p.montoTotal)}</span>
        </div>
      </div>
    `;
    rightCol.appendChild(finCardDet);

    const deliveryCard = document.createElement('div');
    deliveryCard.className =
      'p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3';
    deliveryCard.innerHTML = `
      <h3 class="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
        <i class="fa-solid fa-truck text-brand"></i>
        <span>Modalidad de Entrega</span>
      </h3>
      <div class="space-y-2 text-xs">
        <p class="font-bold text-slate-800 dark:text-slate-200">${escapeHtml(p.modalidadEntrega)}</p>
        ${p.modalidadEntregaOtro ? `<p class="text-slate-500">${escapeHtml(p.modalidadEntregaOtro)}</p>` : ''}
        ${p.clienteDireccion ? `<p class="text-[11px] text-slate-400"><i class="fa-solid fa-location-dot text-brand mr-1"></i>${escapeHtml(p.clienteDireccion)}</p>` : ''}
      </div>
    `;
    rightCol.appendChild(deliveryCard);

    detailGrid.append(leftCol, rightCol);
    pageWrap.appendChild(detailGrid);
    parent.appendChild(pageWrap);
  }

  // 1. Renderizado síncrono inmediato (evita pantallas en blanco)
  render();

  // 2. Consulta asíncrona segura de pedidos
  fetchPedidos().catch((err) => console.warn('[Pedidos] Error en inicio:', err));
}

