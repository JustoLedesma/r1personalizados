import { createButton } from '../components/button.js';
import { createDataTable } from '../components/table.js';
import { openModal } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { apiFetch } from '../services/api.js';

export function renderReciclajeModule(container) {
  const state = {
    view: 'list', // 'list' | 'detail'
    viewingItem: null,
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
    if (state.view === 'list') render();
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
      if (state.view === 'list') render();
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

  function formatDateTimeFull(iso) {
    if (!iso) return '-';
    return `${formatDatePart(iso)} · ${formatTimePart(iso)} hs`;
  }

  function openPreview(row) {
    state.viewingItem = row;
    state.view = 'detail';
    render();
  }

  function confirmRestore(row) {
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
          state.view = 'list';
          state.viewingItem = null;
          fetchReciclaje();
        } catch (err) {
          toast.error(err.message || 'No se pudo restaurar el registro.');
          return false;
        } finally {
          setLoading(false);
        }
      },
    });
  }

  function render() {
    container.innerHTML = '';
    if (state.view === 'detail' && state.viewingItem) {
      renderDetailView(state.viewingItem);
      return;
    }
    renderListView();
  }

  function renderListView() {
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
      { value: 'mensajes', label: 'Perfiles de Mensajes' },
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
          key: 'id',
          label: 'ID',
          sortable: true,
          render: (row) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className =
              'text-left text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-brand dark:hover:text-brand hover:underline cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded';
            btn.title = 'Ver vista previa del dato borrado';
            btn.textContent = `#${row.id}`;
            btn.addEventListener('click', () => openPreview(row));
            return btn;
          },
        },
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
          label: 'DOCUMENTO / RUC',
          render: (row) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className =
              'text-left text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-brand dark:hover:text-brand hover:underline cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded';
            btn.title = 'Ver vista previa del dato borrado';
            btn.textContent = row.identificador || `#${row.id}`;
            btn.addEventListener('click', () => openPreview(row));
            return btn;
          },
        },
        {
          key: 'nombre',
          label: 'ARCHIVO / DOCUMENTO BORRADO',
          sortable: true,
          render: (row) => {
            const box = document.createElement('div');
            const nameBtn = document.createElement('button');
            nameBtn.type = 'button';
            nameBtn.className =
              'text-left text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 hover:text-brand dark:hover:text-brand hover:underline cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded';
            nameBtn.title = 'Ver vista previa del dato borrado';
            nameBtn.textContent = row.nombre || '-';
            nameBtn.addEventListener('click', () => openPreview(row));
            box.appendChild(nameBtn);

            if (row.detalle) {
              const sub = document.createElement('p');
              sub.className = 'text-[11px] text-slate-400 dark:text-slate-500';
              sub.textContent = row.detalle;
              box.appendChild(sub);
            }
            return box;
          },
        },
        {
          key: 'createdAt',
          label: 'FECHA CREADA',
          sortable: true,
          render: (row) => `
            <span class="text-xs text-slate-600 dark:text-slate-300">
              ${formatDatePart(row.createdAt)}
            </span>
          `,
        },
        {
          key: 'updatedAt',
          label: 'FECHA MODIFICADA',
          sortable: true,
          render: (row) => `
            <span class="text-xs text-slate-600 dark:text-slate-300">
              ${formatDatePart(row.updatedAt)}
            </span>
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
            const actBox = document.createElement('div');
            actBox.className = 'inline-flex items-center justify-end gap-1.5';

            const viewBtn = createButton({
              icon: 'fa-solid fa-eye',
              variant: 'icon',
              size: 'sm',
              ariaLabel: 'Ver vista previa del dato borrado',
              onClick: () => openPreview(row),
            });

            const restoreBtn = createButton({
              text: 'Restaurar',
              icon: 'fa-solid fa-rotate-left',
              variant: 'primary',
              size: 'sm',
              ariaLabel: 'Restaurar registro',
              onClick: () => confirmRestore(row),
            });

            actBox.append(viewBtn, restoreBtn);
            return actBox;
          },
        },
      ],
    });

    wrapper.appendChild(table);
    container.appendChild(wrapper);
  }

  function renderDetailView(item) {
    const pageWrapper = document.createElement('div');
    pageWrapper.className = 'w-full space-y-5 pb-8';

    // Encabezado superior con miga de pan y acciones
    const topBar = document.createElement('div');
    topBar.className = 'flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4';

    const titleSide = document.createElement('div');
    titleSide.innerHTML = `
      <div class="flex items-center gap-1.5 text-xs font-medium mb-1">
        <button type="button" id="breadcrumb-back-reciclaje" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 inline-flex items-center gap-1 cursor-pointer">
          <i class="fa-solid fa-arrow-left text-[10px]"></i>
          <span>Reciclaje</span>
        </button>
        <span class="text-slate-300 dark:text-slate-600">/</span>
        <span class="text-brand font-semibold">Vista Previa del Dato Borrado</span>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <h2 class="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
          ${item.nombre || 'Registro Borrado'}
        </h2>
        <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-soft dark:bg-brand/20 text-brand">
          <i class="fa-solid fa-recycle text-[10px]"></i>
          ${item.modulo || 'Sistema'}
        </span>
      </div>
      <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
        Vista previa detallada del archivo o documento enviado a la papelera de reciclaje.
      </p>
    `;

    const actionSide = document.createElement('div');
    actionSide.className = 'flex items-center gap-2.5 shrink-0';

    const backBtn = createButton({
      text: 'Volver',
      variant: 'cancel',
      size: 'sm',
      onClick: () => {
        state.view = 'list';
        state.viewingItem = null;
        render();
      },
    });

    const restoreBtn = createButton({
      text: 'Restaurar Registro',
      icon: 'fa-solid fa-rotate-left',
      variant: 'primary',
      size: 'sm',
      onClick: () => confirmRestore(item),
    });

    actionSide.append(backBtn, restoreBtn);
    topBar.append(titleSide, actionSide);
    pageWrapper.appendChild(topBar);

    titleSide.querySelector('#breadcrumb-back-reciclaje')?.addEventListener('click', () => {
      state.view = 'list';
      state.viewingItem = null;
      render();
    });

    // Tarjeta de Auditoría: Historial de Fechas (Creada, Modificada, Borrada) y Usuario que borró
    const auditBanner = document.createElement('div');
    auditBanner.className =
      'w-full bg-brand-soft/60 dark:bg-brand/10 border border-brand/25 rounded-xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-4';
    auditBanner.innerHTML = `
      <div class="flex items-center gap-3">
        <span class="w-9 h-9 rounded-lg bg-brand text-white flex items-center justify-center shrink-0">
          <i class="fa-solid fa-clock-rotate-left text-sm" aria-hidden="true"></i>
        </span>
        <div>
          <p class="text-[11px] font-bold uppercase tracking-wider text-brand">Historial Completo del Registro (#${item.id})</p>
          <div class="flex flex-wrap items-center gap-x-5 gap-y-1 mt-0.5">
            <p class="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100">
              Fecha Creada: <span class="text-brand">${formatDateTimeFull(item.createdAt)}</span>
            </p>
            <p class="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100">
              Fecha Modificada: <span class="text-slate-700 dark:text-slate-300">${formatDateTimeFull(item.updatedAt)}</span>
            </p>
            <p class="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100">
              Fecha y Hora del Borrado: <span class="text-red-600 dark:text-red-400">${formatDatePart(item.deletedAt)} · ${formatTimePart(item.deletedAt)} hs</span>
            </p>
          </div>
        </div>
      </div>
      <div class="text-xs text-slate-600 dark:text-slate-300 font-medium flex items-center gap-2">
        <i class="fa-regular fa-user text-brand"></i>
        <span>Borrado por: <strong class="text-slate-900 dark:text-white">${item.deletedBy || 'Operador Ventas'}</strong></span>
      </div>
    `;
    pageWrapper.appendChild(auditBanner);

    // Bloque con todos los campos exactos del dato borrado
    const fieldsCard = document.createElement('section');
    fieldsCard.className =
      'w-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4';

    const cardHeader = document.createElement('div');
    cardHeader.className =
      'flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800';
    cardHeader.innerHTML = `
      <span class="w-7 h-7 rounded-lg bg-brand-soft dark:bg-brand/20 text-brand flex items-center justify-center shrink-0">
        <i class="fa-solid fa-file-shield text-xs" aria-hidden="true"></i>
      </span>
      <h3 class="text-xs font-bold uppercase tracking-wider text-brand">
        Contenido Exacto del Registro Borrado (${item.modulo || 'Sistema'})
      </h3>
    `;
    fieldsCard.appendChild(cardHeader);

    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4';

    const campos = Array.isArray(item.campos) && item.campos.length > 0
      ? item.campos
      : [
          { label: 'ID del Registro', value: `#${item.id}` },
          { label: 'Módulo de Origen', value: item.modulo || '-' },
          { label: 'Documento / Identificador', value: item.identificador || '-' },
          { label: 'Nombre / Descripción', value: item.nombre || '-' },
          { label: 'Detalle Adicional', value: item.detalle || '-' },
        ];

    campos.forEach((f) => {
      const box = document.createElement('div');
      box.className =
        'p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800';
      box.innerHTML = `
        <p class="text-[11px] font-medium text-slate-400 dark:text-slate-500 mb-0.5">${f.label}</p>
        <p class="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 break-words">${
          f.value !== undefined && f.value !== null && String(f.value).trim() !== '' ? f.value : '-'
        }</p>
      `;
      grid.appendChild(box);
    });

    fieldsCard.appendChild(grid);
    pageWrapper.appendChild(fieldsCard);
    container.appendChild(pageWrapper);
  }

  fetchReciclaje();
}
