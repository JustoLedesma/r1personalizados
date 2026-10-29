import { createButton } from '../components/button.js';
import { createDataTable } from '../components/table.js';
import { openConfirmModal } from '../components/modal.js';
import { createPhoneInput } from '../components/phone-input.js';
import { toast } from '../components/toast.js';
import { apiFetch } from '../services/api.js';

const DEPARTAMENTOS_PY = [
  'Capital (Asunción)',
  'Concepción',
  'San Pedro',
  'Cordillera',
  'Guairá',
  'Caaguazú',
  'Caazapá',
  'Itapúa',
  'Misiones',
  'Paraguarí',
  'Alto Paraná',
  'Central',
  'Ñeembucú',
  'Amambay',
  'Canindeyú',
  'Presidente Hayes',
  'Boquerón',
  'Alto Paraguay',
];

const inputClass =
  'w-full min-h-[40px] px-3.5 py-2 text-xs sm:text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition';

const labelClass = 'block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5';

function createFieldLabel(text, required = false, iconHtml = '') {
  const label = document.createElement('label');
  label.className = labelClass;
  label.innerHTML = `${iconHtml}${text}${required ? ' <span class="text-danger">*</span>' : ''}`;
  return label;
}

function createSectionHeader(iconClass, titleText) {
  const header = document.createElement('div');
  header.className =
    'flex items-center gap-2 pb-2.5 mb-4 border-b border-slate-100 dark:border-slate-800 text-brand text-xs font-bold uppercase tracking-wider';
  header.innerHTML = `<i class="${iconClass}" aria-hidden="true"></i><span>${titleText}</span>`;
  return header;
}

export function renderClientesModule(container, { subRoute = 'lista' } = {}) {
  let currentView = subRoute === 'nuevo' ? 'form' : 'lista';
  let editingCliente = null;
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

  async function fetchClientes() {
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
      const res = await apiFetch(`/api/clientes?${params.toString()}`);
      listState.data = Array.isArray(res.data) ? res.data : [];
      listState.total = Number(res.total || 0);
    } catch (err) {
      listState.error = err.message || 'Base de datos no disponible.';
    } finally {
      listState.loading = false;
      render();
    }
  }

  function renderListView() {
    container.innerHTML = '';

    // Toma toda el área asignada (w-full sin restricción max-w)
    const wrapper = document.createElement('div');
    wrapper.className = 'w-full space-y-4';

    // Barra superior con botón "+ Crear cliente" a la derecha (idéntico a Foto 1)
    const topBar = document.createElement('div');
    topBar.className = 'flex items-center justify-end';

    const newBtn = createButton({
      text: 'Crear cliente',
      icon: 'fa-solid fa-plus',
      variant: 'primary',
      size: 'sm',
      onClick: () => {
        editingCliente = null;
        currentView = 'form';
        render();
      },
    });

    topBar.appendChild(newBtn);
    wrapper.appendChild(topBar);

    // Barra de filtros: Tipo y Estado (idéntico a Foto 1)
    const filterBar = document.createElement('div');
    filterBar.className =
      'w-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl px-4 py-3 flex flex-wrap items-center gap-4 shadow-xs';

    // Filtro Tipo
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
      { value: 'persona_fisica', label: 'Persona física' },
      { value: 'empresa', label: 'Empresa' },
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
      fetchClientes();
    });
    tipoGroup.append(tipoLabel, tipoSelect);

    // Filtro Estado
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
      { value: 'activo', label: 'Activo' },
      { value: 'inactivo', label: 'Inactivo' },
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
      render();
    });
    estadoGroup.append(estadoLabel, estadoSelect);

    filterBar.append(tipoGroup, estadoGroup);
    wrapper.appendChild(filterBar);

    // Tabla de clientes con tope de 20 registros antes de activar paginación
    const table = createDataTable({
      loading: listState.loading,
      error: listState.error,
      data: listState.data,
      total: listState.total,
      page: listState.page,
      pageSize: 20,
      searchPlaceholder: 'Buscar por documento, nombre, RUC...',
      emptyMessage: 'No hay clientes registrados actualmente.',
      onSearch: (q) => {
        listState.q = q;
        listState.page = 1;
        fetchClientes();
      },
      onPageChange: (newPage) => {
        listState.page = newPage;
        fetchClientes();
      },
      onRetry: () => fetchClientes(),
      columns: [
        {
          key: 'tipoCliente',
          label: 'TIPO',
          render: (row) => {
            const isEmpresa = row.tipoCliente === 'empresa';
            const badge = document.createElement('span');
            badge.className = isEmpresa
              ? 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-soft dark:bg-brand/20 text-brand'
              : 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300';
            badge.innerHTML = `<i class="${isEmpresa ? 'fa-regular fa-building' : 'fa-regular fa-user'} text-[10px]"></i>${isEmpresa ? 'Empresa' : 'Persona física'}`;
            return badge;
          },
        },
        {
          key: 'documento',
          label: 'DOCUMENTO',
          render: (row) => {
            if (row.tipoCliente === 'empresa') {
              return `<span class="text-xs font-medium">${row.rucBase || row.ruc || '-'}</span>`;
            }
            const extraRuc = row.ruc ? `<div class="text-[11px] text-slate-400">RUC: ${row.ruc}</div>` : '';
            return `<div class="text-xs font-medium">${row.numeroDocumento || '-'}${extraRuc}</div>`;
          },
        },
        {
          key: 'nombre',
          label: 'NOMBRE / RAZÓN SOCIAL',
          sortable: true,
          render: (row) => {
            const div = document.createElement('div');
            const mainName =
              row.tipoCliente === 'empresa'
                ? row.razonSocial
                : `${row.nombres || ''} ${row.apellidos || ''}`.trim();
            const sub =
              row.tipoCliente === 'empresa' && row.nombreFantasia ? row.nombreFantasia : '';
            div.innerHTML = `
              <p class="font-semibold text-slate-800 dark:text-slate-100 text-xs sm:text-sm">${mainName || '-'}</p>
              ${sub ? `<p class="text-[11px] text-slate-400 dark:text-slate-500">${sub}</p>` : ''}
            `;
            return div;
          },
        },
        {
          key: 'whatsappCompleto',
          label: 'WHATSAPP',
          render: (row) => {
            const wa = row.whatsappCompleto || '-';
            const tel = row.telefonoCompleto
              ? `<div class="text-[11px] text-slate-400">Tel: ${row.telefonoCompleto}</div>`
              : '';
            return `<div class="text-xs font-medium">${wa}${tel}</div>`;
          },
        },
        {
          key: 'email',
          label: 'CORREO',
          render: (row) => `<span class="text-xs text-slate-600 dark:text-slate-300">${row.email || '-'}</span>`,
        },
        {
          key: 'ciudad',
          label: 'CIUDAD',
          render: (row) => `<span class="text-xs text-slate-600 dark:text-slate-300">${row.ciudad || '-'}</span>`,
        },
        {
          key: 'estado',
          label: 'ESTADO',
          render: () => {
            const badge = document.createElement('span');
            badge.className =
              'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400';
            badge.innerHTML = '<i class="fa-solid fa-circle text-[6px]"></i>Activo';
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

            const editBtn = createButton({
              variant: 'ghost',
              size: 'sm',
              icon: 'fa-regular fa-pen-to-square',
              ariaLabel: 'Editar cliente',
              onClick: () => {
                editingCliente = row;
                currentView = 'form';
                render();
              },
            });

            const delBtn = createButton({
              variant: 'danger',
              size: 'sm',
              icon: 'fa-regular fa-trash-can',
              ariaLabel: 'Eliminar cliente',
              onClick: () => {
                const displayName =
                  row.tipoCliente === 'empresa'
                    ? row.razonSocial
                    : `${row.nombres || ''} ${row.apellidos || ''}`.trim();
                openConfirmModal({
                  title: 'Eliminar cliente',
                  message: `¿Estás seguro de que deseas eliminar a "${displayName}"? Esta acción no se puede deshacer.`,
                  confirmText: 'Eliminar',
                  onConfirm: async ({ setLoading }) => {
                    setLoading(true);
                    try {
                      await apiFetch(`/api/clientes/${row.id}`, { method: 'DELETE' });
                      toast.success('Cliente eliminado correctamente.');
                      fetchClientes();
                    } catch (err) {
                      toast.error(err.message || 'Error al eliminar el cliente.');
                      return false;
                    } finally {
                      setLoading(false);
                    }
                  },
                });
              },
            });

            group.append(editBtn, delBtn);
            return group;
          },
        },
      ],
    });

    wrapper.appendChild(table);
    container.appendChild(wrapper);
  }

  function renderFormView() {
    container.innerHTML = '';

    const initialData = editingCliente || {};
    let categoria = initialData.tipoCliente === 'empresa' ? 'empresa' : 'persona_fisica';

    // Toma el 100% de toda el área asignada (w-full sin max-w-6xl)
    const pageWrap = document.createElement('div');
    pageWrap.className = 'w-full space-y-5 pb-10';

    // Cabecera superior con Breadcrumb + Título + Botones Cancelar y Guardar cliente
    const topHeader = document.createElement('div');
    topHeader.className = 'space-y-2';

    const breadcrumb = document.createElement('div');
    breadcrumb.className = 'flex items-center gap-1.5 text-xs';

    const backLink = document.createElement('button');
    backLink.type = 'button';
    backLink.className =
      'inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400 hover:text-brand transition-colors font-medium';
    backLink.innerHTML = '<i class="fa-solid fa-arrow-left text-[10px]" aria-hidden="true"></i><span>Clientes</span>';
    backLink.addEventListener('click', () => {
      currentView = 'lista';
      fetchClientes();
    });

    const sep = document.createElement('span');
    sep.className = 'text-slate-300 dark:text-slate-600';
    sep.textContent = '/';

    const currentCrumb = document.createElement('span');
    currentCrumb.className = 'text-brand font-semibold';
    currentCrumb.textContent = editingCliente ? 'Editar Cliente' : 'Crear Nuevo Cliente';

    breadcrumb.append(backLink, sep, currentCrumb);

    const titleBar = document.createElement('div');
    titleBar.className = 'flex flex-col sm:flex-row sm:items-center justify-between gap-3';

    const titleTexts = document.createElement('div');
    titleTexts.innerHTML = `
      <h2 class="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">${editingCliente ? 'Editar Cliente' : 'Crear Nuevo Cliente'}</h2>
      <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Complete el formulario para dar de alta un cliente en Paraguay (persona física o empresa).</p>
    `;

    const actionButtons = document.createElement('div');
    actionButtons.className = 'flex items-center gap-2.5 shrink-0';

    const cancelBtn = createButton({
      text: 'Cancelar',
      variant: 'cancel',
      size: 'sm',
      onClick: () => {
        currentView = 'lista';
        fetchClientes();
      },
    });

    const saveBtn = createButton({
      text: 'Guardar cliente',
      icon: 'fa-solid fa-check',
      variant: 'primary',
      size: 'sm',
      onClick: () => submitForm(),
    });

    actionButtons.append(cancelBtn, saveBtn);
    titleBar.append(titleTexts, actionButtons);
    topHeader.append(breadcrumb, titleBar);
    pageWrap.appendChild(topHeader);

    // Tarjeta principal del formulario a ancho completo
    const card = document.createElement('div');
    card.className =
      'w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-6 shadow-xs space-y-6';

    // Selector de TIPO DE CLIENTE (Persona física | Empresa)
    const categoryBanner = document.createElement('div');
    categoryBanner.className =
      'bg-slate-50/90 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 rounded-xl px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3';

    const categoryLeft = document.createElement('div');
    categoryLeft.innerHTML = `
      <p class="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">TIPO DE CLIENTE</p>
      <p class="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 mt-0.5">Seleccione la categoría</p>
    `;

    const toggleWrap = document.createElement('div');
    toggleWrap.className =
      'inline-flex items-center bg-white dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-700 self-start sm:self-auto';

    const btnPersona = createButton({
      text: 'Persona física',
      variant: categoria === 'persona_fisica' ? 'primary' : 'ghost',
      size: 'sm',
      className: 'min-h-[34px] sm:min-h-[32px] px-3 py-1 text-xs rounded-md',
      onClick: () => {
        if (categoria !== 'persona_fisica') {
          categoria = 'persona_fisica';
          updateCategoryUI();
        }
      },
    });

    const btnEmpresa = createButton({
      text: 'Empresa',
      variant: categoria === 'empresa' ? 'primary' : 'ghost',
      size: 'sm',
      className: 'min-h-[34px] sm:min-h-[32px] px-3 py-1 text-xs rounded-md',
      onClick: () => {
        if (categoria !== 'empresa') {
          categoria = 'empresa';
          updateCategoryUI();
        }
      },
    });

    toggleWrap.append(btnPersona, btnEmpresa);
    categoryBanner.append(categoryLeft, toggleWrap);
    card.appendChild(categoryBanner);

    // Contenedor dinámico de las secciones del formulario
    const sectionsContainer = document.createElement('div');
    sectionsContainer.className = 'space-y-7';
    card.appendChild(sectionsContainer);

    // ========================================================================
    // Controles de formulario compartidos y específicos
    // ========================================================================
    const selTipoDoc = document.createElement('select');
    selTipoDoc.className = inputClass;
    ['Cédula de Identidad (C.I.)', 'Pasaporte', 'Documento Extranjero', 'Sin documento'].forEach((opt) => {
      const o = document.createElement('option');
      o.value = opt;
      o.textContent = opt;
      selTipoDoc.appendChild(o);
    });
    selTipoDoc.value = initialData.tipoDocumento || 'Cédula de Identidad (C.I.)';

    const inpNumDoc = document.createElement('input');
    inpNumDoc.type = 'text';
    inpNumDoc.placeholder = 'Ej. 1234567';
    inpNumDoc.value = initialData.numeroDocumento || '';
    inpNumDoc.className = inputClass;

    const inpNombres = document.createElement('input');
    inpNombres.type = 'text';
    inpNombres.placeholder = 'Ej. Juan Carlos';
    inpNombres.value = initialData.nombres || '';
    inpNombres.className = inputClass;

    const inpApellidos = document.createElement('input');
    inpApellidos.type = 'text';
    inpApellidos.placeholder = 'Ej. González Benítez';
    inpApellidos.value = initialData.apellidos || '';
    inpApellidos.className = inputClass;

    const inpFechaNac = document.createElement('input');
    inpFechaNac.type = 'date';
    inpFechaNac.value = initialData.fechaNacimiento || '';
    inpFechaNac.className = inputClass;

    const selSexo = document.createElement('select');
    selSexo.className = inputClass;
    ['No especifica', 'Masculino', 'Femenino'].forEach((opt) => {
      const o = document.createElement('option');
      o.value = opt;
      o.textContent = opt;
      selSexo.appendChild(o);
    });
    selSexo.value = initialData.sexo || 'No especifica';

    const inpNacionalidad = document.createElement('input');
    inpNacionalidad.type = 'text';
    inpNacionalidad.placeholder = 'Paraguay';
    inpNacionalidad.value = initialData.nacionalidad || 'Paraguay';
    inpNacionalidad.className = inputClass;

    // 1B. Controles Empresa (Persona Jurídica) — SIN campo DV, todo en RUC Base
    const inpRucBase = document.createElement('input');
    inpRucBase.type = 'text';
    inpRucBase.placeholder = 'Ej. 80012345';
    inpRucBase.value = initialData.rucBase || '';
    inpRucBase.className = inputClass;

    const inpRazonSocial = document.createElement('input');
    inpRazonSocial.type = 'text';
    inpRazonSocial.placeholder = 'Ej. Distribuidores del Este S.A.';
    inpRazonSocial.value = initialData.razonSocial || '';
    inpRazonSocial.className = inputClass;

    const inpNombreFantasia = document.createElement('input');
    inpNombreFantasia.type = 'text';
    inpNombreFantasia.placeholder = 'Ej. Supermercado El Ahorro';
    inpNombreFantasia.value = initialData.nombreFantasia || '';
    inpNombreFantasia.className = inputClass;

    // 2. Datos Fiscales — SOLO RUC y opcional
    const inpRucOpcional = document.createElement('input');
    inpRucOpcional.type = 'text';
    inpRucOpcional.placeholder = 'Ej. 1234567-8';
    inpRucOpcional.value = initialData.ruc || '';
    inpRucOpcional.className = inputClass;

    // 3. Representante y Contacto
    const inpRepNombre = document.createElement('input');
    inpRepNombre.type = 'text';
    inpRepNombre.placeholder = 'Ej. Roberto Mendoza';
    inpRepNombre.value = initialData.representanteNombre || '';
    inpRepNombre.className = inputClass;

    const inpRepDoc = document.createElement('input');
    inpRepDoc.type = 'text';
    inpRepDoc.placeholder = 'Ej. C.I. 3456789';
    inpRepDoc.value = initialData.representanteDocumento || '';
    inpRepDoc.className = inputClass;

    const inpPersonaContacto = document.createElement('input');
    inpPersonaContacto.type = 'text';
    inpPersonaContacto.placeholder = 'Ej. Lic. Ana Rojas (Compras)';
    inpPersonaContacto.value = initialData.personaContacto || '';
    inpPersonaContacto.className = inputClass;

    // WhatsApp con todos los países y Paraguay (+595) por defecto
    const whatsappPhone = createPhoneInput({
      defaultDial: initialData.whatsappCodigo || '+595',
      defaultNumber: initialData.whatsappNumero || '',
      placeholder: 'Ej. 986 901 117 (sin 0)',
      showHelper: true,
      required: true,
      idPrefix: 'cliente-whatsapp',
    });

    // Teléfono adicional debajo de WhatsApp
    const telefonoAdicional = createPhoneInput({
      defaultDial: initialData.telefonoCodigo || '+595',
      defaultNumber: initialData.telefonoNumero || '',
      placeholder: 'Ej. 21 600 000 / 981 000 000 (opcional)',
      showHelper: false,
      required: false,
      idPrefix: 'cliente-telefono',
    });

    const inpEmail = document.createElement('input');
    inpEmail.type = 'email';
    inpEmail.value = initialData.email || '';
    inpEmail.className = inputClass;

    // 4. Domicilio / Ubicación
    const inpDireccion = document.createElement('input');
    inpDireccion.type = 'text';
    inpDireccion.placeholder = 'Ej. Avda. Mariscal López 1234 c/ San Martín';
    inpDireccion.value = initialData.direccion || '';
    inpDireccion.className = inputClass;

    const selDepartamento = document.createElement('select');
    selDepartamento.className = inputClass;
    const defDep = document.createElement('option');
    defDep.value = '';
    defDep.textContent = 'Seleccione departamento';
    selDepartamento.appendChild(defDep);
    DEPARTAMENTOS_PY.forEach((dep) => {
      const o = document.createElement('option');
      o.value = dep;
      o.textContent = dep;
      selDepartamento.appendChild(o);
    });
    selDepartamento.value = initialData.departamento || '';

    const inpCiudad = document.createElement('input');
    inpCiudad.type = 'text';
    inpCiudad.placeholder = 'Ej. Asunción, Luque, Ciudad del Este';
    inpCiudad.value = initialData.ciudad || '';
    inpCiudad.className = inputClass;

    const inpBarrio = document.createElement('input');
    inpBarrio.type = 'text';
    inpBarrio.placeholder = 'Ej. Villa Morra, Sajonia';
    inpBarrio.value = initialData.barrio || '';
    inpBarrio.className = inputClass;

    const inpReferencia = document.createElement('input');
    inpReferencia.type = 'text';
    inpReferencia.placeholder = 'Ej. Frente al supermercado, Portón azul';
    inpReferencia.value = initialData.referencia || '';
    inpReferencia.className = inputClass;

    function buildFieldBlock(labelText, controlEl, required = false, iconHtml = '') {
      const wrap = document.createElement('div');
      wrap.append(createFieldLabel(labelText, required, iconHtml), controlEl);
      return wrap;
    }

    function updateCategoryUI() {
      const activeClasses =
        'inline-flex items-center justify-center gap-2 font-semibold transition-all duration-150 select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-brand bg-brand hover:bg-brand-hover active:bg-brand-active text-white shadow-sm min-h-[34px] sm:min-h-[32px] px-3.5 py-1 text-xs rounded-md';
      const inactiveClasses =
        'inline-flex items-center justify-center gap-2 font-medium transition-all duration-150 select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-brand bg-transparent text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[34px] sm:min-h-[32px] px-3.5 py-1 text-xs rounded-md';

      btnPersona.className = categoria === 'persona_fisica' ? activeClasses : inactiveClasses;
      btnEmpresa.className = categoria === 'empresa' ? activeClasses : inactiveClasses;

      sectionsContainer.innerHTML = '';

      // ======================================================================
      // SECCIÓN 1: Identificación Personal o Identificación de la Empresa
      // ======================================================================
      const sec1 = document.createElement('section');
      if (categoria === 'persona_fisica') {
        sec1.appendChild(createSectionHeader('fa-regular fa-user', '1. IDENTIFICACIÓN PERSONAL'));

        const grid1 = document.createElement('div');
        grid1.className = 'grid grid-cols-1 md:grid-cols-2 gap-4 mb-4';
        grid1.append(
          buildFieldBlock('Tipo de documento', selTipoDoc, true),
          buildFieldBlock('Número de documento', inpNumDoc, true)
        );

        const grid2 = document.createElement('div');
        grid2.className = 'grid grid-cols-1 md:grid-cols-2 gap-4 mb-4';
        grid2.append(
          buildFieldBlock('Nombres', inpNombres, true),
          buildFieldBlock('Apellidos', inpApellidos, true)
        );

        const grid3 = document.createElement('div');
        grid3.className = 'grid grid-cols-1 md:grid-cols-3 gap-4';
        grid3.append(
          buildFieldBlock('Fecha de nacimiento', inpFechaNac, false),
          buildFieldBlock('Sexo', selSexo, false),
          buildFieldBlock('Nacionalidad', inpNacionalidad, false)
        );

        sec1.append(grid1, grid2, grid3);
      } else {
        sec1.appendChild(
          createSectionHeader('fa-regular fa-building', '1. IDENTIFICACIÓN DE LA EMPRESA (PERSONA JURÍDICA)')
        );

        const grid1 = document.createElement('div');
        grid1.className = 'grid grid-cols-1 md:grid-cols-2 gap-4 mb-4';
        grid1.append(
          buildFieldBlock('RUC Base', inpRucBase, true),
          buildFieldBlock('Razón Social', inpRazonSocial, true)
        );

        const grid2 = document.createElement('div');
        grid2.className = 'grid grid-cols-1 gap-4';
        grid2.appendChild(buildFieldBlock('Nombre de fantasía (opcional)', inpNombreFantasia, false));

        sec1.append(grid1, grid2);
      }
      sectionsContainer.appendChild(sec1);

      // ======================================================================
      // SECCIÓN 2: DATOS FISCALES (Solo RUC y como campo opcional)
      // ======================================================================
      const sec2 = document.createElement('section');
      sec2.appendChild(createSectionHeader('fa-regular fa-file-lines', '2. DATOS FISCALES'));
      const gridFiscal = document.createElement('div');
      gridFiscal.className = 'grid grid-cols-1 gap-4';
      gridFiscal.appendChild(buildFieldBlock('RUC (opcional)', inpRucOpcional, false));
      sec2.appendChild(gridFiscal);
      sectionsContainer.appendChild(sec2);

      // ======================================================================
      // SECCIÓN 3: INFORMACIÓN DE CONTACTO / REPRESENTANTE Y CONTACTO
      // ======================================================================
      const sec3 = document.createElement('section');
      const whatsappIconHtml =
        '<i class="fa-brands fa-whatsapp text-emerald-500 mr-1.5 text-sm" aria-hidden="true"></i>';
      const phoneIconHtml =
        '<i class="fa-solid fa-phone text-slate-400 mr-1.5 text-xs" aria-hidden="true"></i>';

      if (categoria === 'persona_fisica') {
        sec3.appendChild(createSectionHeader('fa-solid fa-phone', '3. INFORMACIÓN DE CONTACTO'));
        inpEmail.placeholder = 'cliente@correo.com';

        const contactGrid = document.createElement('div');
        contactGrid.className = 'grid grid-cols-1 md:grid-cols-2 gap-4 items-start';

        const leftPhonesCol = document.createElement('div');
        leftPhonesCol.className = 'space-y-4';
        leftPhonesCol.append(
          buildFieldBlock('WhatsApp / Celular', whatsappPhone.element, true, whatsappIconHtml),
          buildFieldBlock('Teléfono', telefonoAdicional.element, false, phoneIconHtml)
        );

        const rightEmailCol = document.createElement('div');
        rightEmailCol.appendChild(buildFieldBlock('Correo electrónico', inpEmail, true));

        contactGrid.append(leftPhonesCol, rightEmailCol);
        sec3.appendChild(contactGrid);
      } else {
        sec3.appendChild(createSectionHeader('fa-solid fa-users', '3. REPRESENTANTE Y CONTACTO'));
        inpEmail.placeholder = 'facturacion@empresa.com.py';

        const repGrid = document.createElement('div');
        repGrid.className = 'grid grid-cols-1 md:grid-cols-2 gap-4 mb-4';
        repGrid.append(
          buildFieldBlock('Representante legal (Nombre)', inpRepNombre, false),
          buildFieldBlock('Representante legal (Documento / C.I.)', inpRepDoc, false)
        );

        const corpContactGrid = document.createElement('div');
        corpContactGrid.className = 'grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 items-start';

        const colContacto = document.createElement('div');
        colContacto.appendChild(buildFieldBlock('Persona de contacto', inpPersonaContacto, false));

        const colPhones = document.createElement('div');
        colPhones.className = 'space-y-4';
        colPhones.append(
          buildFieldBlock('WhatsApp / Teléfono corporativo', whatsappPhone.element, true, whatsappIconHtml),
          buildFieldBlock('Teléfono', telefonoAdicional.element, false, phoneIconHtml)
        );

        corpContactGrid.append(colContacto, colPhones);

        const emailRow = document.createElement('div');
        emailRow.className = 'grid grid-cols-1 gap-4';
        emailRow.appendChild(
          buildFieldBlock('Correo electrónico (Facturación / Empresa)', inpEmail, true)
        );

        sec3.append(repGrid, corpContactGrid, emailRow);
      }
      sectionsContainer.appendChild(sec3);

      // ======================================================================
      // SECCIÓN 4: DOMICILIO / UBICACIÓN
      // ======================================================================
      const sec4 = document.createElement('section');
      sec4.appendChild(createSectionHeader('fa-solid fa-location-dot', '4. DOMICILIO / UBICACIÓN'));

      const dirRow = document.createElement('div');
      dirRow.className = 'mb-4';
      dirRow.appendChild(buildFieldBlock('Dirección (Calle y número)', inpDireccion, false));

      const depRow = document.createElement('div');
      depRow.className = 'grid grid-cols-1 md:grid-cols-2 gap-4 mb-4';
      depRow.append(
        buildFieldBlock('Departamento', selDepartamento, false),
        buildFieldBlock('Ciudad', inpCiudad, false)
      );

      const barrioRow = document.createElement('div');
      barrioRow.className = 'grid grid-cols-1 md:grid-cols-2 gap-4';
      barrioRow.append(
        buildFieldBlock('Barrio', inpBarrio, false),
        buildFieldBlock('Referencia / Ubicación', inpReferencia, false)
      );

      sec4.append(dirRow, depRow, barrioRow);
      sectionsContainer.appendChild(sec4);
    }

    async function submitForm() {
      const payload = {
        tipoCliente: categoria,
        tipoDocumento: selTipoDoc.value,
        numeroDocumento: inpNumDoc.value.trim(),
        nombres: inpNombres.value.trim(),
        apellidos: inpApellidos.value.trim(),
        fechaNacimiento: inpFechaNac.value,
        sexo: selSexo.value,
        nacionalidad: inpNacionalidad.value.trim() || 'Paraguay',
        rucBase: inpRucBase.value.trim(),
        razonSocial: inpRazonSocial.value.trim(),
        nombreFantasia: inpNombreFantasia.value.trim(),
        ruc: inpRucOpcional.value.trim(),
        representanteNombre: inpRepNombre.value.trim(),
        representanteDocumento: inpRepDoc.value.trim(),
        personaContacto: inpPersonaContacto.value.trim(),
        whatsappCodigo: whatsappPhone.getCodigo(),
        whatsappNumero: whatsappPhone.getNumero(),
        telefonoCodigo: telefonoAdicional.getCodigo(),
        telefonoNumero: telefonoAdicional.getNumero(),
        email: inpEmail.value.trim(),
        direccion: inpDireccion.value.trim(),
        departamento: selDepartamento.value,
        ciudad: inpCiudad.value.trim(),
        barrio: inpBarrio.value.trim(),
        referencia: inpReferencia.value.trim(),
      };

      if (categoria === 'persona_fisica') {
        if (!payload.numeroDocumento) {
          toast.warning('Ingresa el número de documento del cliente.');
          inpNumDoc.focus();
          return;
        }
        if (!payload.nombres || !payload.apellidos) {
          toast.warning('Ingresa los nombres y apellidos del cliente.');
          inpNombres.focus();
          return;
        }
      } else {
        if (!payload.rucBase) {
          toast.warning('Ingresa el RUC Base de la empresa.');
          inpRucBase.focus();
          return;
        }
        if (!payload.razonSocial) {
          toast.warning('Ingresa la Razón Social de la empresa.');
          inpRazonSocial.focus();
          return;
        }
      }

      if (!payload.whatsappNumero) {
        toast.warning('Ingresa el número de WhatsApp del cliente.');
        whatsappPhone.inputElement.focus();
        return;
      }

      if (!payload.email) {
        toast.warning('Ingresa el correo electrónico del cliente.');
        inpEmail.focus();
        return;
      }

      saveBtn.setLoading(true);
      try {
        if (editingCliente && editingCliente.id) {
          await apiFetch(`/api/clientes/${editingCliente.id}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
          });
          toast.success('Cliente actualizado correctamente.');
        } else {
          await apiFetch('/api/clientes', {
            method: 'POST',
            body: JSON.stringify(payload),
          });
          toast.success('Cliente guardado correctamente.');
        }
        editingCliente = null;
        currentView = 'lista';
        fetchClientes();
      } catch (err) {
        toast.error(err.message || 'No se pudo guardar el cliente.');
      } finally {
        saveBtn.setLoading(false);
      }
    }

    updateCategoryUI();
    pageWrap.appendChild(card);

    const footerNote = document.createElement('p');
    footerNote.className = 'text-xs text-slate-400 dark:text-slate-500 px-1';
    footerNote.innerHTML = '<span class="text-danger font-bold">*</span> Campos obligatorios según la categoría seleccionada';
    pageWrap.appendChild(footerNote);

    container.appendChild(pageWrap);
  }

  function render() {
    if (currentView === 'lista') {
      renderListView();
    } else {
      renderFormView();
    }
  }

  if (currentView === 'lista') {
    fetchClientes();
  } else {
    render();
  }
}
