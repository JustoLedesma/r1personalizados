import { createButton } from '../components/button.js';
import { createDataTable } from '../components/table.js';
import { openModal } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { apiFetch } from '../services/api.js';

export function renderReciclajeModule(container) {
  const state = {
    data: [],
    total: 0,
    page: 1,
    pageSize: 20,
    q: '',
    modulo: '',
    loading: false,
    error: '',
  };

  async function fetchReciclaje() {
    state.loading = true;
    state.error = '';
    render();
    try {
      const params = new URLSearchParams({
        page: String(state.page),
        page_size: String(state.pageSize),
      });
      if (state.q) params.set('q', state.q);
      if (state.modulo) params.set('modulo', state.modulo);
      const res = await apiFetch(`/api/reciclaje?${params.toString()}`);
      state.data = Array.isArray(res.data) ? res.data : [];
      state.total = Number(res.total || 0);
    } catch (err) {
      state.error = err.message || 'No se pudo cargar el módulo de Reciclaje.';
    } finally {
      state.loading = false;
      render();
    }
  }

  function formatDatePart(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleDateString('es-PY', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  function formatTimePart(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleTimeString('es-PY', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  }

  function render() {
    container.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.className = 'w-full space-y-4';

    // Barra de filtros por módulo de origen
    const filterBar = document.createElement('div');
    filterBar.className =
      'w-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-4 shadow-xs';

    const leftFilters = document.createElement('div');
    leftFilters.className = 'flex items-center gap-2';

    const modLabel = document.createElement('label');
    modLabel.className = 'text-xs text-slate-500 dark:text-slate-400 font-medium';
    modLabel.textContent = 'Módulo:';

    const modSelect = document.createElement('select');
    modSelect.className =
      'min-h-[34px] px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand';
    [
      { value: '', label: 'Todos los módulos' },
      { value: 'clientes', label: 'Clientes' },
      { value: 'proveedor', label: 'Proveedor' },
      { value: 'pagos', label: 'Pagos' },
      { value: 'pedidos', label: 'Pedidos' },
      { value: 'presupuestos', label: 'Presupuestos' },
      { value: 'productos', label: 'Productos' },
    ].forEach((opt) => {
      const o = document.createElement('option');
      o.value = opt.value;
      o.textContent = opt.label;
      modSelect.appendChild(o);
    });
    modSelect.value = state.modulo;
    modSelect.addEventListener('change', (e) => {
      state.modulo = e.target.value;
      state.page = 1;
      fetchReciclaje();
    });

    leftFilters.append(modLabel, modSelect);

    const refreshBtn = createButton({
      text: 'Actualizar',
      icon: 'fa-solid fa-rotate-right',
      variant: 'primary',
      size: 'sm',
      onClick: () => fetchReciclaje(),
    });

    filterBar.append(leftFilters, refreshBtn);
    wrapper.appendChild(filterBar);

    const table = createDataTable({
      loading: state.loading,
      error: state.error,
      data: state.data,
      total: state.total,
      page: state.page,
      pageSize: 20,
      searchPlaceholder: 'Buscar archivo, documento o usuario que borró...',
      emptyMessage: 'La papelera de reciclaje está vacía.',
      onSearch: (q) => {
        state.q = q;
        state.page = 1;
        fetchReciclaje();
      },
      onPageChange: (newPage) => {
        state.page = newPage;
        fetchReciclaje();
      },
      onRetry: () => fetchReciclaje(),
      columns: [
        {
          key: 'modulo',
          label: 'MÓDULO',
          render: (row) => {
            const badge = document.createElement('span');
            badge.className =
              'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-soft dark:bg-brand/20 text-brand';
            badge.innerHTML = `<i class="fa-solid fa-recycle text-[10px]"></i>${row.modulo || 'Sistema'}`;
            return badge;
          },
        },
        {
          key: 'identificador',
          label: 'DOCUMENTO / ID',
          render: (row) =>
            `<span class="text-xs font-medium text-slate-700 dark:text-slate-200">${row.identificador || `#${row.id}`}</span>`,
        },
        {
          key: 'nombre',
          label: 'ARCHIVO / DOCUMENTO BORRADO',
          sortable: true,
          render: (row) => `
            <div>
              <p class="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100">${row.nombre || '-'}</p>
              ${row.detalle ? `<p class="text-[11px] text-slate-400 dark:text-slate-500">${row.detalle}</p>` : ''}
            </div>
          `,
        },
        {
          key: 'deletedBy',
          label: 'USUARIO QUE BORRÓ',
          render: (row) => `
            <span class="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-200">
              <i class="fa-regular fa-user text-brand text-[11px]" aria-hidden="true"></i>
              <span>${row.deletedBy || 'Operador Ventas'}</span>
            </span>
          `,
        },
        {
          key: 'fechaBorrado',
          label: 'FECHA DEL BORRADO',
          render: (row) => `
            <span class="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
              <i class="fa-regular fa-calendar text-slate-400 text-[11px]" aria-hidden="true"></i>
              <span>${formatDatePart(row.deletedAt)}</span>
            </span>
          `,
        },
        {
          key: 'horaBorrado',
          label: 'HORA DEL BORRADO',
          render: (row) => `
            <span class="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
              <i class="fa-regular fa-clock text-slate-400 text-[11px]" aria-hidden="true"></i>
              <span>${formatTimePart(row.deletedAt)}</span>
            </span>
          `,
        },
        {
          key: 'actions',
          label: 'ACCIONES',
          align: 'right',
          render: (row) => {
            const restoreBtn = createButton({
              text: 'Restaurar',
              icon: 'fa-solid fa-rotate-left',
              variant: 'primary',
              size: 'sm',
              ariaLabel: 'Restaurar registro',
              onClick: () => {
                openModal({
                  title: 'Restaurar registro',
                  content: `<p class="text-sm text-slate-700 dark:text-slate-300">¿Deseas restaurar <strong>"${row.nombre}"</strong> para que vuelva a aparecer en el módulo de <strong>${row.modulo}</strong>?</p>`,
                  size: 'sm',
                  confirmText: 'Restaurar',
                  cancelText: 'Cancelar',
                  confirmVariant: 'primary',
                  onConfirm: async ({ setLoading }) => {
                    setLoading(true);
                    try {
                      await apiFetch('/api/reciclaje/restaurar', {
                        method: 'POST',
                        body: JSON.stringify({ modulo: row.modulo, id: row.id }),
                      });
                      toast.success('Registro restaurado a su vista original.');
                      fetchReciclaje();
                    } catch (err) {
                      toast.error(err.message || 'No se pudo restaurar el registro.');
                      return false;
                    } finally {
                      setLoading(false);
                    }
                  },
                });
              },
            });
            return restoreBtn;
          },
        },
      ],
    });

    wrapper.appendChild(table);
    container.appendChild(wrapper);
  }

  fetchReciclaje();
}
