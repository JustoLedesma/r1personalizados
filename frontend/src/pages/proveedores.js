import { createButton } from '../components/button.js';
import { createDataTable } from '../components/table.js';
import { openConfirmModal } from '../components/modal.js';
import { createPhoneInput } from '../components/phone-input.js';
import { toast } from '../components/toast.js';
import { apiFetch } from '../services/api.js';

const inputClass =
  'w-full min-h-[40px] px-3.5 py-2 text-xs sm:text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition';

const labelClass = 'block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5';

function createFieldLabel(text, required = false, iconHtml = '') {
  const label = document.createElement('label');
  label.className = labelClass;
  label.innerHTML = `${iconHtml}${text}${required ? ' <span class="text-danger">*</span>' : ''}`;
  return label;
}

function buildField(labelText, controlEl, required = false, iconHtml = '') {
  const wrap = document.createElement('div');
  wrap.append(createFieldLabel(labelText, required, iconHtml), controlEl);
  return wrap;
}

function createCardBlock(iconClass, titleText, subtitleText = '') {
  const card = document.createElement('section');
  card.className =
    'w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-4';

  const header = document.createElement('div');
  header.className =
    'flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800';
  header.innerHTML = `
    <div class="w-9 h-9 rounded-lg bg-brand-soft dark:bg-brand/15 text-brand flex items-center justify-center shrink-0">
      <i class="${iconClass} text-sm" aria-hidden="true"></i>
    </div>
    <div>
      <h3 class="text-xs sm:text-sm font-bold uppercase tracking-wider text-brand">${titleText}</h3>
      ${subtitleText ? `<p class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">${subtitleText}</p>` : ''}
    </div>
  `;

  const body = document.createElement('div');
  body.className = 'space-y-4';

  card.append(header, body);
  return { card, body };
}

function formatShortDateTime(isoStr) {
  if (!isoStr) return '-';
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return String(isoStr);
  return d.toLocaleString('es-PY', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatDateTimeFull(isoStr) {
  if (!isoStr) return '-';
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

export function renderProveedoresModule(container, { subRoute = 'lista' } = {}) {
  let currentView = subRoute === 'nuevo' ? 'form' : 'lista';
  let editingProveedor = null;
  let viewingProveedor = null;

  const listState = {
    data: [],
    total: 0,
    page: 1,
    pageSize: 20,
    q: '',
    tipo: '',
    estado: '',
    loading: false,
    error: '',
  };

  function openDetailView(prov) {
    viewingProveedor = prov;
    currentView = 'detalle';
    render();
  }

  async function fetchProveedores() {
    listState.loading = true;
    listState.error = '';
    render();
    try {
      const params = new URLSearchParams({
        page: String(listState.page),
        page_size: String(listState.pageSize),
      });
      if (listState.q) params.set('q', listState.q);
      if (listState.tipo) params.set('tipo', listState.tipo);
      if (listState.estado) params.set('estado', listState.estado);
      const res = await apiFetch(`/api/proveedores?${params.toString()}`);
      listState.data = Array.isArray(res.data) ? res.data : [];
      listState.total = Number(res.total || 0);
    } catch (err) {
      listState.error = err.message || 'Base de datos no disponible.';
    } finally {
      listState.loading = false;
      render();
    }
  }

  function confirmAndDeleteProveedor(row, onAfterDelete) {
    openConfirmModal({
      title: 'Confirmar eliminación de proveedor',
      message: `¿Estás seguro de que deseas borrar al proveedor "${row.razonSocial}"? El registro se ocultará de esta vista y se moverá al módulo de Reciclaje.`,
      confirmText: 'Borrar proveedor',
      onConfirm: async ({ setLoading }) => {
        setLoading(true);
        try {
          await apiFetch(`/api/proveedores/${row.id}`, { method: 'DELETE' });
          toast.success('Proveedor movido al módulo de Reciclaje.');
          if (typeof onAfterDelete === 'function') {
            onAfterDelete();
          }
        } catch (err) {
          toast.error(err.message || 'Error al mover el proveedor a Reciclaje.');
          return false;
        } finally {
          setLoading(false);
        }
      },
    });
  }

  function renderListView() {
    container.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.className = 'w-full space-y-4';

    // Barra superior con botón "+ Crear proveedor" a la derecha
    const topBar = document.createElement('div');
    topBar.className = 'flex items-center justify-end';

    const newBtn = createButton({
      text: 'Crear proveedor',
      icon: 'fa-solid fa-plus',
      variant: 'primary',
      size: 'sm',
      onClick: () => {
        editingProveedor = null;
        currentView = 'form';
        render();
      },
    });

    topBar.appendChild(newBtn);
    wrapper.appendChild(topBar);

    // Barra de filtros: Tipo y Estado
    const filterBar = document.createElement('div');
    filterBar.className =
      'w-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl px-4 py-3 flex flex-wrap items-center gap-4 shadow-xs';

    const tipoGroup = document.createElement('div');
    tipoGroup.className = 'flex items-center gap-2';
    const tipoLabel = document.createElement('label');
    tipoLabel.className = 'text-xs text-slate-500 dark:text-slate-400 font-medium';
    tipoLabel.textContent = 'Tipo:';

    const tipoSelect = document.createElement('select');
    tipoSelect.className =
      'min-h-[34px] px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand';
    [
      { value: '', label: 'Todos los tipos' },
      { value: 'Empresa', label: 'Empresa' },
      { value: 'Persona Física', label: 'Persona Física' },
    ].forEach((opt) => {
      const o = document.createElement('option');
      o.value = opt.value;
      o.textContent = opt.label;
      tipoSelect.appendChild(o);
    });
    tipoSelect.value = listState.tipo;
    tipoSelect.addEventListener('change', (e) => {
      listState.tipo = e.target.value;
      listState.page = 1;
      fetchProveedores();
    });
    tipoGroup.append(tipoLabel, tipoSelect);

    const estadoGroup = document.createElement('div');
    estadoGroup.className = 'flex items-center gap-2';
    const estadoLabel = document.createElement('label');
    estadoLabel.className = 'text-xs text-slate-500 dark:text-slate-400 font-medium';
    estadoLabel.textContent = 'Estado:';

    const estadoSelect = document.createElement('select');
    estadoSelect.className =
      'min-h-[34px] px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand';
    [
      { value: '', label: 'Todos los estados' },
      { value: 'Activo', label: 'Activo' },
      { value: 'Inactivo', label: 'Inactivo' },
    ].forEach((opt) => {
      const o = document.createElement('option');
      o.value = opt.value;
      o.textContent = opt.label;
      estadoSelect.appendChild(o);
    });
    estadoSelect.value = listState.estado;
    estadoSelect.addEventListener('change', (e) => {
      listState.estado = e.target.value;
      listState.page = 1;
      fetchProveedores();
    });
    estadoGroup.append(estadoLabel, estadoSelect);

    filterBar.append(tipoGroup, estadoGroup);
    wrapper.appendChild(filterBar);

    const table = createDataTable({
      loading: listState.loading,
      error: listState.error,
      data: listState.data,
      total: listState.total,
      page: listState.page,
      pageSize: 20,
      searchPlaceholder: 'Buscar por RUC, razón social, rubro, contacto...',
      emptyMessage: 'No hay proveedores registrados actualmente.',
      onSearch: (q) => {
        listState.q = q;
        listState.page = 1;
        fetchProveedores();
      },
      onPageChange: (newPage) => {
        listState.page = newPage;
        fetchProveedores();
      },
      onRetry: () => fetchProveedores(),
      columns: [
        {
          key: 'id',
          label: 'ID',
          sortable: true,
          render: (row) => {
            const idBtn = document.createElement('button');
            idBtn.type = 'button';
            idBtn.title = 'Ver vista previa del proveedor';
            idBtn.className =
              'text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-brand dark:hover:text-brand hover:underline cursor-pointer focus:outline-none';
            idBtn.textContent = `#${row.id}`;
            idBtn.addEventListener('click', () => openDetailView(row));
            return idBtn;
          },
        },
        {
          key: 'tipoProveedor',
          label: 'TIPO',
          render: (row) => {
            const isEmpresa = row.tipoProveedor !== 'Persona Física';
            const badge = document.createElement('span');
            badge.className = isEmpresa
              ? 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-soft dark:bg-brand/20 text-brand'
              : 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300';
            badge.innerHTML = `<i class="${isEmpresa ? 'fa-regular fa-building' : 'fa-regular fa-user'} text-[10px]"></i>${row.tipoProveedor || 'Empresa'}`;
            return badge;
          },
        },
        {
          key: 'rucDocumento',
          label: 'RUC / DOCUMENTO',
          render: (row) => {
            const docBtn = document.createElement('button');
            docBtn.type = 'button';
            docBtn.title = 'Ver vista previa del proveedor';
            docBtn.className =
              'text-xs font-semibold text-slate-800 dark:text-slate-100 hover:text-brand dark:hover:text-brand hover:underline transition-colors text-left cursor-pointer focus:outline-none';
            docBtn.textContent = row.rucDocumento || '-';
            docBtn.addEventListener('click', () => openDetailView(row));
            return docBtn;
          },
        },
        {
          key: 'razonSocial',
          label: 'RAZÓN SOCIAL / COMERCIAL',
          sortable: true,
          render: (row) => {
            const div = document.createElement('div');
            const nameBtn = document.createElement('button');
            nameBtn.type = 'button';
            nameBtn.title = 'Ver vista previa del proveedor';
            nameBtn.className =
              'font-semibold text-slate-800 dark:text-slate-100 hover:text-brand dark:hover:text-brand hover:underline text-xs sm:text-sm text-left cursor-pointer transition-colors focus:outline-none block';
            nameBtn.textContent = row.razonSocial || '-';
            nameBtn.addEventListener('click', () => openDetailView(row));
            div.appendChild(nameBtn);

            if (row.nombreComercial) {
              const subEl = document.createElement('p');
              subEl.className = 'text-[11px] text-slate-400 dark:text-slate-500';
              subEl.textContent = row.nombreComercial;
              div.appendChild(subEl);
            }
            return div;
          },
        },
        {
          key: 'rubro',
          label: 'RUBRO',
          render: (row) => `<span class="text-xs text-slate-600 dark:text-slate-300">${row.rubro || '-'}</span>`,
        },
        {
          key: 'contacto',
          label: 'CONTACTO / WHATSAPP',
          render: (row) => {
            const phone = row.contactoTelefono || row.telefonoCorporativo || '-';
            const contact = row.contactoNombre
              ? `<div class="text-[11px] text-slate-400">${row.contactoNombre}${row.contactoCargo ? ` (${row.contactoCargo})` : ''}</div>`
              : '';
            return `<div class="text-xs font-medium">${phone}${contact}</div>`;
          },
        },
        {
          key: 'createdAt',
          label: 'FECHA CREADA',
          sortable: true,
          render: (row) => `<span class="text-xs text-slate-500 dark:text-slate-400">${formatShortDateTime(row.createdAt)}</span>`,
        },
        {
          key: 'updatedAt',
          label: 'FECHA MODIFICADA',
          sortable: true,
          render: (row) => `<span class="text-xs text-slate-500 dark:text-slate-400">${formatShortDateTime(row.updatedAt)}</span>`,
        },
        {
          key: 'estado',
          label: 'ESTADO',
          render: (row) => {
            const isActive = row.estado !== 'Inactivo';
            const badge = document.createElement('span');
            badge.className = isActive
              ? 'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
              : 'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400';
            badge.innerHTML = `<i class="fa-solid fa-circle text-[6px]"></i>${isActive ? 'Activo' : 'Inactivo'}`;
            return badge;
          },
        },
        {
          key: 'actions',
          label: 'ACCIONES',
          align: 'right',
          render: (row) => {
            const group = document.createElement('div');
            group.className = 'inline-flex items-center justify-end gap-1.5';

            // Botón Ver (vista previa)
            const viewBtn = createButton({
              variant: 'ghost',
              size: 'sm',
              icon: 'fa-regular fa-eye',
              ariaLabel: 'Ver vista previa del proveedor',
              onClick: () => openDetailView(row),
            });

            // Botón Editar
            const editBtn = createButton({
              variant: 'ghost',
              size: 'sm',
              icon: 'fa-regular fa-pen-to-square',
              ariaLabel: 'Editar proveedor',
              onClick: () => {
                editingProveedor = row;
                currentView = 'form';
                render();
              },
            });

            // Botón Borrar
            const delBtn = createButton({
              variant: 'danger',
              size: 'sm',
              icon: 'fa-regular fa-trash-can',
              ariaLabel: 'Borrar proveedor',
              onClick: () => {
                confirmAndDeleteProveedor(row, () => fetchProveedores());
              },
            });

            group.append(viewBtn, editBtn, delBtn);
            return group;
          },
        },
      ],
    });

    wrapper.appendChild(table);
    container.appendChild(wrapper);
  }

  // ==========================================================================
  // VISTA PREVIA DEL PROVEEDOR (Solo lectura, toma toda el área asignada)
  // ==========================================================================
  function renderDetailView() {
    container.innerHTML = '';

    const p = viewingProveedor || {};
    const isEmpresa = p.tipoProveedor !== 'Persona Física';
    const isActive = p.estado !== 'Inactivo';

    const pageWrap = document.createElement('div');
    pageWrap.className = 'w-full space-y-5 pb-10';

    const topHeader = document.createElement('div');
    topHeader.className = 'space-y-2';

    const breadcrumb = document.createElement('div');
    breadcrumb.className = 'flex items-center gap-1.5 text-xs';

    const backLink = document.createElement('button');
    backLink.type = 'button';
    backLink.className =
      'inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400 hover:text-brand transition-colors font-medium';
    backLink.innerHTML = '<i class="fa-solid fa-arrow-left text-[10px]" aria-hidden="true"></i><span>Proveedores</span>';
    backLink.addEventListener('click', () => {
      currentView = 'lista';
      fetchProveedores();
    });

    const sep = document.createElement('span');
    sep.className = 'text-slate-300 dark:text-slate-600';
    sep.textContent = '/';

    const currentCrumb = document.createElement('span');
    currentCrumb.className = 'text-brand font-semibold';
    currentCrumb.textContent = 'Vista Previa del Proveedor';

    breadcrumb.append(backLink, sep, currentCrumb);

    const titleBar = document.createElement('div');
    titleBar.className = 'flex flex-col sm:flex-row sm:items-center justify-between gap-3';

    const titleLeft = document.createElement('div');
    titleLeft.className = 'space-y-1';
    titleLeft.innerHTML = `
      <div class="flex flex-wrap items-center gap-2.5">
        <h2 class="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">${p.razonSocial || 'Proveedor'}</h2>
        <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-soft dark:bg-brand/20 text-brand">
          <i class="${isEmpresa ? 'fa-regular fa-building' : 'fa-regular fa-user'} text-[10px]"></i>
          ${p.tipoProveedor || 'Empresa'}
        </span>
        <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
          isActive
            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
        }">
          <i class="fa-solid fa-circle text-[6px]"></i>${isActive ? 'Activo' : 'Inactivo'}
        </span>
      </div>
      <p class="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-3">
        <span><i class="fa-regular fa-calendar-check text-brand mr-1"></i>Fecha creada: <strong class="font-semibold text-slate-700 dark:text-slate-200">${formatDateTimeFull(p.createdAt)}</strong></span>
        <span><i class="fa-regular fa-clock text-brand mr-1"></i>Fecha modificada: <strong class="font-semibold text-slate-700 dark:text-slate-200">${formatDateTimeFull(p.updatedAt)}</strong></span>
      </p>
    `;

    const actionButtons = document.createElement('div');
    actionButtons.className = 'flex items-center gap-2.5 shrink-0';

    const backBtn = createButton({
      text: 'Volver',
      icon: 'fa-solid fa-arrow-left',
      variant: 'cancel',
      size: 'sm',
      onClick: () => {
        currentView = 'lista';
        fetchProveedores();
      },
    });

    const editBtn = createButton({
      text: 'Editar proveedor',
      icon: 'fa-regular fa-pen-to-square',
      variant: 'primary',
      size: 'sm',
      onClick: () => {
        editingProveedor = p;
        currentView = 'form';
        render();
      },
    });

    actionButtons.append(backBtn, editBtn);
    titleBar.append(titleLeft, actionButtons);
    topHeader.append(breadcrumb, titleBar);
    pageWrap.appendChild(topHeader);

    function createReadOnlyItem(label, value) {
      const box = document.createElement('div');
      box.className =
        'p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800';
      box.innerHTML = `
        <p class="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">${label}</p>
        <p class="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 mt-1 break-words">${value || '-'}</p>
      `;
      return box;
    }

    // Tarjeta de auditoría de fechas
    const metaCard = document.createElement('div');
    metaCard.className =
      'w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 shadow-xs';
    const metaGrid = document.createElement('div');
    metaGrid.className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5';
    metaGrid.append(
      createReadOnlyItem('ID de Proveedor', `#${p.id || '-'}`),
      createReadOnlyItem('Fecha Creada (Alta)', formatDateTimeFull(p.createdAt)),
      createReadOnlyItem('Fecha Modificada', formatDateTimeFull(p.updatedAt)),
      createReadOnlyItem('Estado Actual', p.estado || 'Activo')
    );
    metaCard.appendChild(metaGrid);
    pageWrap.appendChild(metaCard);

    // Bloque 1
    const b1 = createCardBlock('fa-solid fa-id-card-clip', 'Bloque 1: Identificación Legal y Fiscal');
    const g1 = document.createElement('div');
    g1.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4';
    g1.append(
      createReadOnlyItem('Tipo de Proveedor', p.tipoProveedor),
      createReadOnlyItem('Razón Social / Nombre', p.razonSocial),
      createReadOnlyItem('Nombre Comercial', p.nombreComercial),
      createReadOnlyItem('RUC / Documento de Identidad', p.rucDocumento)
    );
    b1.body.appendChild(g1);
    pageWrap.appendChild(b1.card);

    // Bloque 2
    const b2 = createCardBlock('fa-solid fa-location-dot', 'Bloque 2: Contacto y Ubicación');
    const g2 = document.createElement('div');
    g2.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4';
    g2.append(
      createReadOnlyItem('Dirección Física', p.direccion),
      createReadOnlyItem('Ciudad', p.ciudad),
      createReadOnlyItem('País', p.pais || 'Paraguay'),
      createReadOnlyItem('Teléfono Corporativo', p.telefonoCorporativo),
      createReadOnlyItem('Correo Electrónico General', p.emailGeneral),
      createReadOnlyItem('Sitio Web', p.sitioWeb)
    );
    b2.body.appendChild(g2);
    pageWrap.appendChild(b2.card);

    // Bloque 3
    const b3 = createCardBlock('fa-solid fa-user-tie', 'Bloque 3: Persona de Contacto (Representante / Vendedor)');
    const g3 = document.createElement('div');
    g3.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4';
    g3.append(
      createReadOnlyItem('Nombre del Contacto', p.contactoNombre),
      createReadOnlyItem('Cargo', p.contactoCargo),
      createReadOnlyItem('Teléfono Directo / WhatsApp', p.contactoTelefono),
      createReadOnlyItem('Correo Electrónico Directo', p.contactoEmail)
    );
    b3.body.appendChild(g3);
    pageWrap.appendChild(b3.card);

    // Bloque 4
    const b4 = createCardBlock('fa-solid fa-building-columns', 'Bloque 4: Información Financiera');
    const g4 = document.createElement('div');
    g4.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4';
    g4.append(
      createReadOnlyItem('Banco', p.banco),
      createReadOnlyItem('Número de Cuenta Bancaria', p.numeroCuenta),
      createReadOnlyItem('Moneda de Operación', p.moneda),
      createReadOnlyItem('Condición de Pago', p.condicionPago)
    );
    b4.body.appendChild(g4);
    pageWrap.appendChild(b4.card);

    // Bloque 5
    const b5 = createCardBlock('fa-solid fa-boxes-stacked', 'Bloque 5: Datos Operativos');
    const g5 = document.createElement('div');
    g5.className = 'grid grid-cols-1 md:grid-cols-3 gap-4';
    g5.append(
      createReadOnlyItem('Rubro / Categoría de Productos', p.rubro),
      createReadOnlyItem('Tiempo Estimado de Entrega', `${p.tiempoEntregaDias || 0} días`),
      createReadOnlyItem('Estado', p.estado || 'Activo')
    );
    b5.body.appendChild(g5);
    pageWrap.appendChild(b5.card);

    container.appendChild(pageWrap);
  }

  function renderFormView() {
    container.innerHTML = '';

    const data = editingProveedor || {};

    const form = document.createElement('form');
    form.noValidate = true;
    form.className = 'w-full space-y-5 pb-6';

    // Cabecera con Breadcrumb
    const topHeader = document.createElement('div');
    topHeader.className = 'space-y-2';

    const breadcrumb = document.createElement('div');
    breadcrumb.className = 'flex items-center gap-1.5 text-xs';

    const backLink = document.createElement('button');
    backLink.type = 'button';
    backLink.className =
      'inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400 hover:text-brand transition-colors font-medium';
    backLink.innerHTML = '<i class="fa-solid fa-arrow-left text-[10px]" aria-hidden="true"></i><span>Proveedores</span>';
    backLink.addEventListener('click', () => {
      currentView = 'lista';
      fetchProveedores();
    });

    const sep = document.createElement('span');
    sep.className = 'text-slate-300 dark:text-slate-600';
    sep.textContent = '/';

    const currentCrumb = document.createElement('span');
    currentCrumb.className = 'text-brand font-semibold';
    currentCrumb.textContent = editingProveedor ? 'Editar Proveedor' : 'Crear Nuevo Proveedor';

    breadcrumb.append(backLink, sep, currentCrumb);

    const titleBar = document.createElement('div');
    titleBar.className = 'flex flex-col sm:flex-row sm:items-center justify-between gap-3';
    titleBar.innerHTML = `
      <div>
        <h2 class="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">${editingProveedor ? 'Editar Proveedor' : 'Crear Nuevo Proveedor'}</h2>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Complete los bloques de información legal, contacto, datos bancarios y condiciones operativas del proveedor.</p>
      </div>
    `;

    topHeader.append(breadcrumb, titleBar);
    form.appendChild(topHeader);

    // ========================================================================
    // BLOQUE 1: Identificación Legal y Fiscal
    // ========================================================================
    const b1 = createCardBlock(
      'fa-solid fa-id-card-clip',
      'Bloque 1: Identificación Legal y Fiscal',
      'Datos tributarios y denominación oficial del proveedor'
    );

    const selTipoProveedor = document.createElement('select');
    selTipoProveedor.className = inputClass;
    ['Empresa', 'Persona Física'].forEach((opt) => {
      const o = document.createElement('option');
      o.value = opt;
      o.textContent = opt;
      selTipoProveedor.appendChild(o);
    });
    selTipoProveedor.value = data.tipoProveedor || 'Empresa';

    const inpRazonSocial = document.createElement('input');
    inpRazonSocial.type = 'text';
    inpRazonSocial.required = true;
    inpRazonSocial.placeholder = 'Ej. Importadora Textil del Sur S.A.';
    inpRazonSocial.value = data.razonSocial || '';
    inpRazonSocial.className = inputClass;

    const inpNombreComercial = document.createElement('input');
    inpNombreComercial.type = 'text';
    inpNombreComercial.placeholder = 'Ej. TextilSur';
    inpNombreComercial.value = data.nombreComercial || '';
    inpNombreComercial.className = inputClass;

    const inpRucDocumento = document.createElement('input');
    inpRucDocumento.type = 'text';
    inpRucDocumento.required = true;
    inpRucDocumento.placeholder = 'Ej. 80012345-6 o C.I. 3456789';
    inpRucDocumento.value = data.rucDocumento || '';
    inpRucDocumento.className = inputClass;

    const gridB1 = document.createElement('div');
    gridB1.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4';
    gridB1.append(
      buildField('Tipo de Proveedor', selTipoProveedor, true),
      buildField('Razón Social / Nombre', inpRazonSocial, true),
      buildField('Nombre Comercial', inpNombreComercial, false),
      buildField('RUC / Documento de Identidad', inpRucDocumento, true)
    );
    b1.body.appendChild(gridB1);
    form.appendChild(b1.card);

    // ========================================================================
    // BLOQUE 2: Contacto y Ubicación
    // ========================================================================
    const b2 = createCardBlock(
      'fa-solid fa-location-dot',
      'Bloque 2: Contacto y Ubicación',
      'Dirección física, teléfonos corporativos y canales digitales'
    );

    const inpDireccion = document.createElement('input');
    inpDireccion.type = 'text';
    inpDireccion.placeholder = 'Ej. Avda. Eusebio Ayala 2450 c/ Choferes del Chaco';
    inpDireccion.value = data.direccion || '';
    inpDireccion.className = inputClass;

    const inpCiudad = document.createElement('input');
    inpCiudad.type = 'text';
    inpCiudad.placeholder = 'Ej. Asunción, Luque, Ciudad del Este';
    inpCiudad.value = data.ciudad || '';
    inpCiudad.className = inputClass;

    const inpPais = document.createElement('input');
    inpPais.type = 'text';
    inpPais.placeholder = 'Ej. Paraguay';
    inpPais.value = data.pais || 'Paraguay';
    inpPais.className = inputClass;

    const telCorporativo = createPhoneInput({
      defaultDial: data.telefonoCodigo || '+595',
      defaultNumber: data.telefonoNumero || '',
      placeholder: 'Ej. 21 600 000 / 981 000 000 (sin 0)',
      showHelper: false,
      required: false,
      idPrefix: 'prov-tel-corp',
    });

    const inpEmailGeneral = document.createElement('input');
    inpEmailGeneral.type = 'email';
    inpEmailGeneral.placeholder = 'contacto@proveedor.com.py';
    inpEmailGeneral.value = data.emailGeneral || '';
    inpEmailGeneral.className = inputClass;

    const inpSitioWeb = document.createElement('input');
    inpSitioWeb.type = 'url';
    inpSitioWeb.placeholder = 'https://www.proveedor.com.py';
    inpSitioWeb.value = data.sitioWeb || '';
    inpSitioWeb.className = inputClass;

    const gridB2 = document.createElement('div');
    gridB2.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4';
    gridB2.append(
      buildField('Dirección Física', inpDireccion, false),
      buildField('Ciudad', inpCiudad, false),
      buildField('País', inpPais, false),
      buildField(
        'Teléfono Corporativo',
        telCorporativo.element,
        false,
        '<i class="fa-solid fa-phone text-slate-400 mr-1.5 text-xs" aria-hidden="true"></i>'
      ),
      buildField('Correo Electrónico General', inpEmailGeneral, false),
      buildField('Sitio Web (Opcional)', inpSitioWeb, false)
    );
    b2.body.appendChild(gridB2);
    form.appendChild(b2.card);

    // ========================================================================
    // BLOQUE 3: Persona de Contacto (Representante/Vendedor)
    // ========================================================================
    const b3 = createCardBlock(
      'fa-solid fa-user-tie',
      'Bloque 3: Persona de Contacto (Representante / Vendedor)',
      'Ejecutivo comercial o representante directo asignado a la cuenta'
    );

    const inpContactoNombre = document.createElement('input');
    inpContactoNombre.type = 'text';
    inpContactoNombre.placeholder = 'Ej. Carlos Villalba';
    inpContactoNombre.value = data.contactoNombre || '';
    inpContactoNombre.className = inputClass;

    const inpContactoCargo = document.createElement('input');
    inpContactoCargo.type = 'text';
    inpContactoCargo.placeholder = 'Ej. Ejecutivo de Ventas Mayoristas';
    inpContactoCargo.value = data.contactoCargo || '';
    inpContactoCargo.className = inputClass;

    const telDirectoWhatsapp = createPhoneInput({
      defaultDial: data.whatsappCodigo || '+595',
      defaultNumber: data.whatsappNumero || '',
      placeholder: 'Ej. 986 901 117 (sin 0)',
      showHelper: false,
      required: false,
      idPrefix: 'prov-whatsapp',
    });

    const inpContactoEmail = document.createElement('input');
    inpContactoEmail.type = 'email';
    inpContactoEmail.placeholder = 'cvillalba@proveedor.com.py';
    inpContactoEmail.value = data.contactoEmail || '';
    inpContactoEmail.className = inputClass;

    const gridB3 = document.createElement('div');
    gridB3.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start';
    gridB3.append(
      buildField('Nombre del Contacto', inpContactoNombre, false),
      buildField('Cargo', inpContactoCargo, false),
      buildField(
        'Teléfono Directo / WhatsApp',
        telDirectoWhatsapp.element,
        false,
        '<i class="fa-brands fa-whatsapp text-emerald-500 mr-1.5 text-sm" aria-hidden="true"></i>'
      ),
      buildField('Correo Electrónico Directo', inpContactoEmail, false)
    );
    b3.body.appendChild(gridB3);
    form.appendChild(b3.card);

    // ========================================================================
    // BLOQUE 4: Información Financiera
    // ========================================================================
    const b4 = createCardBlock(
      'fa-solid fa-building-columns',
      'Bloque 4: Información Financiera',
      'Datos bancarios, moneda de facturación y plazos de pago acordados'
    );

    const inpBanco = document.createElement('input');
    inpBanco.type = 'text';
    inpBanco.placeholder = 'Ej. Banco Itaú / Continental / Ueno';
    inpBanco.value = data.banco || '';
    inpBanco.className = inputClass;

    const inpNumeroCuenta = document.createElement('input');
    inpNumeroCuenta.type = 'text';
    inpNumeroCuenta.placeholder = 'Ej. 700123456';
    inpNumeroCuenta.value = data.numeroCuenta || '';
    inpNumeroCuenta.className = inputClass;

    const selMoneda = document.createElement('select');
    selMoneda.className = inputClass;
    [
      { value: 'Gs', label: 'Gs (Guaraníes)' },
      { value: 'USD', label: 'USD (Dólares)' },
      { value: 'Reales', label: 'Reales (BRL)' },
    ].forEach((opt) => {
      const o = document.createElement('option');
      o.value = opt.value;
      o.textContent = opt.label;
      selMoneda.appendChild(o);
    });
    selMoneda.value = data.moneda || 'Gs';

    const selCondicionPago = document.createElement('select');
    selCondicionPago.className = inputClass;
    ['Contado', 'Crédito 15 días', 'Crédito 30 días'].forEach((opt) => {
      const o = document.createElement('option');
      o.value = opt;
      o.textContent = opt;
      selCondicionPago.appendChild(o);
    });
    selCondicionPago.value = data.condicionPago || 'Contado';

    const gridB4 = document.createElement('div');
    gridB4.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4';
    gridB4.append(
      buildField('Banco', inpBanco, false),
      buildField('Número de Cuenta Bancaria', inpNumeroCuenta, false),
      buildField('Moneda de Operación', selMoneda, false),
      buildField('Condición de Pago', selCondicionPago, false)
    );
    b4.body.appendChild(gridB4);
    form.appendChild(b4.card);

    // ========================================================================
    // BLOQUE 5: Datos Operativos
    // ========================================================================
    const b5 = createCardBlock(
      'fa-solid fa-boxes-stacked',
      'Bloque 5: Datos Operativos',
      'Clasificación comercial, tiempos de abastecimiento y estado del proveedor'
    );

    const rubroWrap = document.createElement('div');
    const inpRubro = document.createElement('input');
    inpRubro.type = 'text';
    inpRubro.setAttribute('list', 'rubros-proveedor-list');
    inpRubro.placeholder = 'Seleccione o escriba el rubro (Ej. Insumos Textiles)';
    inpRubro.value = data.rubro || '';
    inpRubro.className = inputClass;

    const datalist = document.createElement('datalist');
    datalist.id = 'rubros-proveedor-list';
    [
      'Insumos Textiles y Confección',
      'Serigrafía, Sublimación y DTF',
      'Artículos Publicitarios y Merchandising',
      'Papelería, Cartonería e Imprenta',
      'Empaques y Embalajes',
      'Maquinaria, Equipos y Repuestos',
      'Transporte y Logística',
      'Servicios Generales',
    ].forEach((r) => {
      const o = document.createElement('option');
      o.value = r;
      datalist.appendChild(o);
    });
    rubroWrap.append(inpRubro, datalist);

    const inpTiempoEntrega = document.createElement('input');
    inpTiempoEntrega.type = 'number';
    inpTiempoEntrega.min = '0';
    inpTiempoEntrega.max = '365';
    inpTiempoEntrega.placeholder = 'Ej. 3';
    inpTiempoEntrega.value =
      data.tiempoEntregaDias !== undefined && data.tiempoEntregaDias !== null
        ? String(data.tiempoEntregaDias)
        : '';
    inpTiempoEntrega.className = inputClass;

    const selEstado = document.createElement('select');
    selEstado.className = inputClass;
    ['Activo', 'Inactivo'].forEach((opt) => {
      const o = document.createElement('option');
      o.value = opt;
      o.textContent = opt;
      selEstado.appendChild(o);
    });
    selEstado.value = data.estado || 'Activo';

    const gridB5 = document.createElement('div');
    gridB5.className = 'grid grid-cols-1 md:grid-cols-3 gap-4';
    gridB5.append(
      buildField('Rubro / Categoría de Productos', rubroWrap, false),
      buildField('Tiempo Estimado de Entrega (Días)', inpTiempoEntrega, false),
      buildField('Estado', selEstado, false)
    );
    b5.body.appendChild(gridB5);
    form.appendChild(b5.card);

    // ========================================================================
    // Sticky Footer con Acciones del Formulario
    // ========================================================================
    const stickyFooter = document.createElement('div');
    stickyFooter.className =
      'sticky bottom-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border border-slate-200/80 dark:border-slate-800 rounded-xl px-5 py-3.5 shadow-lg flex flex-wrap items-center justify-between gap-3';

    const footerLeft = document.createElement('div');
    footerLeft.className = 'flex items-center gap-2';

    if (editingProveedor && editingProveedor.id) {
      const deleteInFormBtn = createButton({
        text: 'Borrar Proveedor',
        icon: 'fa-regular fa-trash-can',
        variant: 'danger',
        size: 'md',
        onClick: () => {
          confirmAndDeleteProveedor(editingProveedor, () => {
            editingProveedor = null;
            currentView = 'lista';
            fetchProveedores();
          });
        },
      });
      footerLeft.appendChild(deleteInFormBtn);
    } else {
      footerLeft.innerHTML =
        '<span class="text-xs text-slate-400 dark:text-slate-500"><span class="text-danger font-bold">*</span> Campos obligatorios (Razón Social y RUC / Documento)</span>';
    }

    const footerRight = document.createElement('div');
    footerRight.className = 'flex items-center gap-3 ml-auto';

    const cancelBtn = createButton({
      text: 'Cancelar',
      variant: 'cancel',
      size: 'md',
      onClick: () => {
        editingProveedor = null;
        currentView = 'lista';
        fetchProveedores();
      },
    });

    const saveBtn = createButton({
      text: 'Guardar Proveedor',
      icon: 'fa-solid fa-check',
      variant: 'primary',
      size: 'md',
      type: 'submit',
    });

    footerRight.append(cancelBtn, saveBtn);
    stickyFooter.append(footerLeft, footerRight);
    form.appendChild(stickyFooter);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const payload = {
        tipoProveedor: selTipoProveedor.value,
        razonSocial: inpRazonSocial.value.trim(),
        nombreComercial: inpNombreComercial.value.trim(),
        rucDocumento: inpRucDocumento.value.trim(),
        direccion: inpDireccion.value.trim(),
        ciudad: inpCiudad.value.trim(),
        pais: inpPais.value.trim() || 'Paraguay',
        telefonoCodigo: telCorporativo.getCodigo(),
        telefonoNumero: telCorporativo.getNumero(),
        emailGeneral: inpEmailGeneral.value.trim(),
        sitioWeb: inpSitioWeb.value.trim(),
        contactoNombre: inpContactoNombre.value.trim(),
        contactoCargo: inpContactoCargo.value.trim(),
        whatsappCodigo: telDirectoWhatsapp.getCodigo(),
        whatsappNumero: telDirectoWhatsapp.getNumero(),
        contactoEmail: inpContactoEmail.value.trim(),
        banco: inpBanco.value.trim(),
        numeroCuenta: inpNumeroCuenta.value.trim(),
        moneda: selMoneda.value,
        condicionPago: selCondicionPago.value,
        rubro: inpRubro.value.trim(),
        tiempoEntregaDias: parseInt(inpTiempoEntrega.value || '0', 10) || 0,
        estado: selEstado.value,
      };

      if (!payload.razonSocial) {
        toast.warning('La Razón Social / Nombre es obligatoria.');
        inpRazonSocial.focus();
        return;
      }

      if (!payload.rucDocumento) {
        toast.warning('El RUC / Documento de Identidad es obligatorio.');
        inpRucDocumento.focus();
        return;
      }

      saveBtn.setLoading(true);
      try {
        if (editingProveedor && editingProveedor.id) {
          await apiFetch(`/api/proveedores/${editingProveedor.id}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
          });
          toast.success('Proveedor actualizado correctamente.');
        } else {
          await apiFetch('/api/proveedores', {
            method: 'POST',
            body: JSON.stringify(payload),
          });
          toast.success('Proveedor guardado correctamente.');
        }
        editingProveedor = null;
        currentView = 'lista';
        fetchProveedores();
      } catch (err) {
        toast.error(err.message || 'No se pudo guardar el proveedor.');
      } finally {
        saveBtn.setLoading(false);
      }
    });

    container.appendChild(form);
  }

  function render() {
    if (currentView === 'lista') {
      renderListView();
    } else if (currentView === 'detalle') {
      renderDetailView();
    } else {
      renderFormView();
    }
  }

  if (currentView === 'lista') {
    fetchProveedores();
  } else {
    render();
  }
}
