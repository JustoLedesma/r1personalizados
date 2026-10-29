import { createButton } from '../components/button.js';
import { createDataTable } from '../components/table.js';
import { openModal, openConfirmModal } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { apiFetch } from '../services/api.js';

const CATEGORIAS_PERFIL = [
  'General',
  'Bienvenida',
  'Saludo',
  'Recordatorio',
  'Cobranza',
  'Promoción',
  'Seguimiento',
];

const VARIABLES_DINAMICAS = [
  { token: '{nombre}', desc: 'Nombre completo o Razón Social del cliente/proveedor' },
  { token: '{telefono}', desc: 'Número de WhatsApp o teléfono registrado' },
  { token: '{documento}', desc: 'C.I. o RUC del cliente/proveedor' },
  { token: '{ciudad}', desc: 'Ciudad registrada en la ficha' },
  { token: '{empresa}', desc: 'Empresa, Razón Social o Nombre Comercial' },
  { token: '{productos}', desc: 'Productos o rubro asociado al cliente/proveedor' },
  { token: '{cantidad_productos}', desc: 'Cantidad de unidades o ítems asociados' },
];

const QUICK_EMOJIS = ['👋', '😊', '✨', '🎉', '👍', '💼', '💰', '🗓️'];

const ALL_WHATSAPP_EMOJIS = [
  '👋', '😊', '😀', '😄', '😁', '🤩', '🥳', '😎', '🤝', '🙏',
  '✨', '🎉', '🎊', '🔥', '⭐', '🌟', '💯', '✅', '☑️', '🚀',
  '👍', '👏', '🙌', '💪', '🫶', '❤️', '💜', '💙', '💚', '🧡',
  '💼', '📦', '🛍️', '🛒', '🏷️', '🧾', '📋', '📄', '📌', '📍',
  '💰', '💵', '💳', '🏦', '📈', '🗓️', '⏰', '⏳', '📲', '📞',
  '🚚', '🛵', '🏢', '🏪', '⚠️', '📢', '🔔', '💬', '➡️', '⬇️',
];

function getCategoryBadgeClasses(categoria) {
  const cat = (categoria || 'General').toLowerCase();
  if (cat === 'bienvenida') {
    return {
      pill: 'bg-brand-soft dark:bg-brand/20 text-brand',
      dot: 'bg-brand',
    };
  }
  if (cat === 'saludo') {
    return {
      pill: 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400',
      dot: 'bg-blue-500',
    };
  }
  if (cat === 'recordatorio') {
    return {
      pill: 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400',
      dot: 'bg-amber-500',
    };
  }
  if (cat === 'cobranza') {
    return {
      pill: 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400',
      dot: 'bg-rose-500',
    };
  }
  if (cat === 'promoción' || cat === 'promocion') {
    return {
      pill: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400',
      dot: 'bg-emerald-500',
    };
  }
  return {
    pill: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300',
    dot: 'bg-slate-500',
  };
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderMessageWithVariablePills(text) {
  const safe = escapeHtml(text);
  return safe.replace(
    /\{(nombre|telefono|documento|ciudad|empresa|productos|cantidad_productos)\}/g,
    (match) =>
      `<span class="inline-block px-1.5 py-0.5 mx-0.5 rounded bg-brand-soft dark:bg-brand/20 text-brand font-mono text-[11px] font-semibold">${match}</span>`
  );
}

function formatWhatsAppPreviewHtml(rawText, recipientData) {
  let text = escapeHtml(rawText || '');
  const data = recipientData || {
    nombre: 'Justo Ledesma',
    telefono: '+595986901117',
    documento: '4564525',
    ciudad: 'CDE',
    empresa: 'NETZ / R1 Personalizados',
    productos: 'Remeras y Gorras Personalizadas',
    cantidad_productos: '12',
  };

  const replacements = {
    '{nombre}': data.nombre || 'Cliente',
    '{telefono}': data.telefono || '+595986000000',
    '{documento}': data.documento || '4564525',
    '{ciudad}': data.ciudad || 'Asunción',
    '{empresa}': data.empresa || 'Empresa S.A.',
    '{productos}': data.productos || 'Productos Personalizados',
    '{cantidad_productos}': data.cantidad_productos || '1',
  };

  Object.entries(replacements).forEach(([token, val]) => {
    const safeVal = `<strong class="font-semibold text-emerald-950 dark:text-white underline decoration-emerald-500/50 decoration-dotted">${escapeHtml(
      val
    )}</strong>`;
    text = text.split(token).join(safeVal);
  });

  // Formato WhatsApp: *negrita*, _cursiva_, ~tachado~
  text = text.replace(/\*([^*\n]+)\*/g, '<strong class="font-bold">$1</strong>');
  text = text.replace(/_([^_\n]+)_/g, '<em class="italic">$1</em>');
  text = text.replace(/~([^~\n]+)~/g, '<del class="line-through">$1</del>');
  text = text.replace(/\n/g, '<br>');
  return text;
}

function resolvePlainWhatsAppMessage(rawText, recipientData) {
  let text = String(rawText || '');
  const data = recipientData || {
    nombre: 'Justo Ledesma',
    telefono: '+595986901117',
    documento: '4564525',
    ciudad: 'CDE',
    empresa: 'NETZ / R1 Personalizados',
    productos: 'Remeras y Gorras Personalizadas',
    cantidad_productos: '12',
  };
  return text
    .split('{nombre}').join(data.nombre || '')
    .split('{telefono}').join(data.telefono || '')
    .split('{documento}').join(data.documento || '')
    .split('{ciudad}').join(data.ciudad || '')
    .split('{empresa}').join(data.empresa || '')
    .split('{productos}').join(data.productos || '')
    .split('{cantidad_productos}').join(data.cantidad_productos || '');
}

export function renderPerfilesMensajesModule(container) {
  const state = {
    view: 'list', // 'list' | 'detail'
    viewingItem: null,
    data: [],
    total: 0,
    page: 1,
    pageSize: 20,
    q: '',
    categoria: '',
    estado: '',
    loading: false,
    error: '',
    recipients: [], // Lista combinada de Clientes y Proveedores reales de la BD
  };

  async function loadRealRecipients() {
    const list = [];
    try {
      const resCli = await apiFetch('/api/clientes?page=1&page_size=50');
      if (resCli && Array.isArray(resCli.data)) {
        resCli.data.forEach((c) => {
          const isEmpresa = c.tipoCliente === 'empresa';
          const nombre = isEmpresa
            ? c.razonSocial || c.nombreFantasia || 'Empresa Cliente'
            : `${c.nombres || ''} ${c.apellidos || ''}`.trim() || 'Cliente';
          const documento = isEmpresa
            ? c.rucBase || c.ruc || '-'
            : c.numeroDocumento || c.ruc || '-';
          const empresa = isEmpresa
            ? c.razonSocial || c.nombreFantasia || nombre
            : c.nombreFantasia || c.razonSocial || 'Cliente Particular';
          list.push({
            key: `cliente-${c.id}`,
            origen: 'Cliente',
            label: `Cliente: ${nombre} (${documento})`,
            nombre,
            telefono: c.whatsappCompleto || c.telefonoCompleto || '+595986901117',
            documento,
            ciudad: c.ciudad || c.departamento || 'Ciudad del Este',
            empresa,
            productos: 'Pedido R1 Personalizados',
            cantidad_productos: '10 unidades',
          });
        });
      }
    } catch (_) {
      // Continuar si clientes aún no está disponible
    }

    try {
      const resProv = await apiFetch('/api/proveedores?page=1&page_size=50');
      if (resProv && Array.isArray(resProv.data)) {
        resProv.data.forEach((p) => {
          const nombre = p.contactoNombre || p.razonSocial || 'Proveedor';
          const documento = p.rucDocumento || '-';
          const empresa = p.razonSocial || p.nombreComercial || 'Empresa Proveedora';
          list.push({
            key: `proveedor-${p.id}`,
            origen: 'Proveedor',
            label: `Proveedor: ${empresa} (${documento})`,
            nombre,
            telefono: p.contactoTelefono || p.telefonoCorporativo || '+595981000000',
            documento,
            ciudad: p.ciudad || p.pais || 'Asunción',
            empresa,
            productos: p.rubro || 'Insumos y Mercaderías',
            cantidad_productos: '25 unidades',
          });
        });
      }
    } catch (_) {
      // Continuar si proveedores aún no está disponible
    }

    if (list.length === 0) {
      list.push({
        key: 'sample-default',
        origen: 'Cliente',
        label: 'Cliente (Ejemplo): Justo Ledesma (4564525)',
        nombre: 'Justo Ledesma',
        telefono: '+595986901117',
        documento: '4564525',
        ciudad: 'CDE',
        empresa: 'NETZ / R1 Personalizados',
        productos: 'Remeras Sublimadas R1',
        cantidad_productos: '12 unidades',
      });
    }

    state.recipients = list;
  }

  async function fetchPerfiles() {
    state.loading = true;
    state.error = '';
    if (state.view === 'list') render();
    try {
      const params = new URLSearchParams({
        page: String(state.page),
        page_size: String(state.pageSize),
      });
      if (state.q) params.set('q', state.q);
      if (state.categoria) params.set('categoria', state.categoria);
      if (state.estado) params.set('estado', state.estado);

      const res = await apiFetch(`/api/perfiles-mensajes?${params.toString()}`);
      state.data = Array.isArray(res.data) ? res.data : [];
      state.total = Number(res.total || 0);
    } catch (err) {
      state.error = err.message || 'No se pudieron cargar los perfiles de mensajes.';
    } finally {
      state.loading = false;
      if (state.view === 'list') render();
    }
  }

  function formatDateTime(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    const fecha = d.toLocaleDateString('es-PY', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const hora = d.toLocaleTimeString('es-PY', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return `${fecha} ${hora}`;
  }

  function getCurrentTimeHHMM() {
    const now = new Date();
    return now.toLocaleTimeString('es-PY', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  function openDetailPreview(row) {
    state.viewingItem = row;
    state.view = 'detail';
    render();
  }

  function openWhatsAppTestModal(row) {
    const activeRecipient = state.recipients[0] || {
      nombre: 'Justo Ledesma',
      telefono: '+595986901117',
      documento: '4564525',
      ciudad: 'CDE',
      empresa: 'NETZ / R1 Personalizados',
      productos: 'Remeras Sublimadas R1',
      cantidad_productos: '12 unidades',
    };
    let selectedRec = activeRecipient;

    const modalBody = document.createElement('div');
    modalBody.className = 'space-y-4';

    const selectorGroup = document.createElement('div');
    selectorGroup.innerHTML = `
      <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
        Seleccionar Cliente o Proveedor de la Base de Datos:
      </label>
    `;
    const selectEl = document.createElement('select');
    selectEl.className =
      'w-full min-h-[40px] px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand';

    state.recipients.forEach((rec, idx) => {
      const opt = document.createElement('option');
      opt.value = String(idx);
      opt.textContent = rec.label;
      selectEl.appendChild(opt);
    });
    selectorGroup.appendChild(selectEl);

    const varsSummary = document.createElement('div');
    varsSummary.className =
      'grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 text-[11px]';

    const waPreviewBox = document.createElement('div');
    waPreviewBox.className =
      'w-full rounded-xl bg-[#e5ddd5] dark:bg-slate-800 p-4 flex items-center justify-end min-h-[120px]';

    const bubble = document.createElement('div');
    bubble.className =
      'bg-[#d9fdd3] dark:bg-emerald-950/90 border border-[#b8f2b0] dark:border-emerald-800 text-slate-800 dark:text-slate-100 rounded-xl px-4 py-2.5 max-w-[90%] shadow-xs space-y-1';

    const bubbleText = document.createElement('div');
    bubbleText.className = 'text-xs sm:text-sm leading-relaxed break-words';

    const bubbleMeta = document.createElement('div');
    bubbleMeta.className =
      'flex items-center justify-end gap-1 text-[10px] text-slate-500 dark:text-slate-400';
    bubbleMeta.innerHTML = `
      <span>${getCurrentTimeHHMM()}</span>
      <i class="fa-solid fa-check-double text-sky-500"></i>
    `;

    bubble.append(bubbleText, bubbleMeta);
    waPreviewBox.appendChild(bubble);

    function refreshTestPreview() {
      varsSummary.innerHTML = `
        <div><span class="text-slate-400">{nombre}:</span> <strong class="text-slate-700 dark:text-slate-200">${escapeHtml(selectedRec.nombre)}</strong></div>
        <div><span class="text-slate-400">{telefono}:</span> <strong class="text-slate-700 dark:text-slate-200">${escapeHtml(selectedRec.telefono)}</strong></div>
        <div><span class="text-slate-400">{documento}:</span> <strong class="text-slate-700 dark:text-slate-200">${escapeHtml(selectedRec.documento)}</strong></div>
        <div><span class="text-slate-400">{ciudad}:</span> <strong class="text-slate-700 dark:text-slate-200">${escapeHtml(selectedRec.ciudad)}</strong></div>
        <div><span class="text-slate-400">{empresa}:</span> <strong class="text-slate-700 dark:text-slate-200">${escapeHtml(selectedRec.empresa)}</strong></div>
        <div><span class="text-slate-400">{productos}:</span> <strong class="text-slate-700 dark:text-slate-200">${escapeHtml(selectedRec.productos)}</strong></div>
      `;
      bubbleText.innerHTML = formatWhatsAppPreviewHtml(row.contenido, selectedRec);
    }

    selectEl.addEventListener('change', () => {
      const idx = Number(selectEl.value);
      selectedRec = state.recipients[idx] || activeRecipient;
      refreshTestPreview();
    });

    refreshTestPreview();
    modalBody.append(selectorGroup, varsSummary, waPreviewBox);

    openModal({
      title: `Simulación WhatsApp — ${row.titulo}`,
      content: modalBody,
      size: 'lg',
      confirmText: 'Abrir en WhatsApp',
      cancelText: 'Cerrar',
      onConfirm: () => {
        const plainMsg = resolvePlainWhatsAppMessage(row.contenido, selectedRec);
        const cleanPhone = String(selectedRec.telefono || '').replace(/[^\d]/g, '');
        const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(plainMsg)}`;
        window.open(url, '_blank', 'noopener,noreferrer');
      },
    });
  }

  function openCreateOrEditModal(editingRow = null) {
    const isEdit = Boolean(editingRow && editingRow.id);
    let dirty = false;

    const formData = {
      titulo: editingRow?.titulo || '',
      categoria: editingRow?.categoria || 'General',
      descripcion: editingRow?.descripcion || '',
      contenido: editingRow?.contenido || '',
      activo: editingRow ? Boolean(editingRow.activo) : true,
    };

    let selectedRecipient = state.recipients[0] || {
      nombre: 'Justo Ledesma',
      telefono: '+595986901117',
      documento: '4564525',
      ciudad: 'CDE',
      empresa: 'NETZ / R1 Personalizados',
      productos: 'Remeras Sublimadas R1',
      cantidad_productos: '12 unidades',
    };

    const formContainer = document.createElement('div');
    formContainer.className = 'space-y-4';

    // Fila 1: Nombre / Título del Perfil * y Categoría del Perfil *
    const row1 = document.createElement('div');
    row1.className = 'grid grid-cols-1 sm:grid-cols-2 gap-4';

    const titleField = document.createElement('div');
    titleField.innerHTML = `
      <label class="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
        Nombre / Título del Perfil <span class="text-danger">*</span>
      </label>
    `;
    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.placeholder = 'Ej: Bienvenida Cliente Nuevo';
    titleInput.value = formData.titulo;
    titleInput.className =
      'w-full min-h-[42px] px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand';
    titleInput.addEventListener('input', (e) => {
      dirty = true;
      formData.titulo = e.target.value;
    });
    titleField.appendChild(titleInput);

    const catField = document.createElement('div');
    catField.innerHTML = `
      <label class="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
        Categoría del Perfil <span class="text-danger">*</span>
      </label>
    `;
    const catSelect = document.createElement('select');
    catSelect.className =
      'w-full min-h-[42px] px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand';
    CATEGORIAS_PERFIL.forEach((cat) => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      catSelect.appendChild(opt);
    });
    catSelect.value = CATEGORIAS_PERFIL.includes(formData.categoria)
      ? formData.categoria
      : 'General';
    catSelect.addEventListener('change', (e) => {
      dirty = true;
      formData.categoria = e.target.value;
    });
    catField.appendChild(catSelect);

    row1.append(titleField, catField);
    formContainer.appendChild(row1);

    // Fila 2: Descripción o cuándo usar este perfil (opcional)
    const descField = document.createElement('div');
    descField.innerHTML = `
      <label class="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
        Descripción o cuándo usar este perfil (opcional)
      </label>
    `;
    const descInput = document.createElement('input');
    descInput.type = 'text';
    descInput.placeholder = 'Ej: Enviar tras la primera compra o contacto inicial';
    descInput.value = formData.descripcion;
    descInput.className =
      'w-full min-h-[42px] px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand';
    descInput.addEventListener('input', (e) => {
      dirty = true;
      formData.descripcion = e.target.value;
    });
    descField.appendChild(descInput);
    formContainer.appendChild(descField);

    // Fila 3: Variables Dinámicas (haz clic para insertar en el mensaje)
    const varsSection = document.createElement('div');
    varsSection.className = 'space-y-2';

    const varsHeader = document.createElement('div');
    varsHeader.className = 'flex flex-wrap items-center justify-between gap-2';
    varsHeader.innerHTML = `
      <span class="text-xs font-semibold text-slate-700 dark:text-slate-200">
        Variables Dinámicas (haz clic para insertar en el mensaje):
      </span>
      <span class="text-[11px] text-slate-400 dark:text-slate-500">
        Se reemplazan automáticamente
      </span>
    `;

    const varsChips = document.createElement('div');
    varsChips.className = 'flex flex-wrap items-center gap-2';

    // Textarea reference for cursor insertion
    const msgTextarea = document.createElement('textarea');
    const charCounter = document.createElement('span');

    function insertAtCursor(snippet) {
      dirty = true;
      const start = msgTextarea.selectionStart ?? msgTextarea.value.length;
      const end = msgTextarea.selectionEnd ?? msgTextarea.value.length;
      const before = msgTextarea.value.slice(0, start);
      const after = msgTextarea.value.slice(end);
      msgTextarea.value = `${before}${snippet}${after}`;
      formData.contenido = msgTextarea.value;
      const nextPos = start + snippet.length;
      msgTextarea.focus();
      msgTextarea.setSelectionRange(nextPos, nextPos);
      updatePreviewAndCounter();
    }

    VARIABLES_DINAMICAS.forEach((v) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.title = v.desc;
      chip.className =
        'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100/90 hover:bg-brand-soft dark:bg-slate-800 dark:hover:bg-brand/20 border border-slate-200 dark:border-slate-700 text-xs font-mono font-semibold text-slate-700 dark:text-slate-200 hover:text-brand transition-colors cursor-pointer';
      chip.innerHTML = `<span class="text-brand font-bold">+</span> <span>${v.token}</span>`;
      chip.addEventListener('click', () => insertAtCursor(v.token));
      varsChips.appendChild(chip);
    });

    varsSection.append(varsHeader, varsChips);
    formContainer.appendChild(varsSection);

    // Fila 4: Contenido del Mensaje de WhatsApp * + Barra de Emojis + Contador
    const contentSection = document.createElement('div');
    contentSection.className = 'space-y-2';

    const contentLabel = document.createElement('label');
    contentLabel.className = 'block text-xs font-semibold text-slate-700 dark:text-slate-200';
    contentLabel.innerHTML = `Contenido del Mensaje de WhatsApp <span class="text-danger">*</span>`;

    const emojiToolbar = document.createElement('div');
    emojiToolbar.className = 'relative flex flex-wrap items-center gap-2';

    const emojiDropdownBtn = document.createElement('button');
    emojiDropdownBtn.type = 'button';
    emojiDropdownBtn.className =
      'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer';
    emojiDropdownBtn.innerHTML = `
      <span class="text-base leading-none">😀</span>
      <span>Emojis</span>
      <i class="fa-solid fa-chevron-down text-[10px] text-slate-400"></i>
    `;

    // Popover con todos los emojis de WhatsApp
    const emojiPopover = document.createElement('div');
    emojiPopover.className =
      'hidden absolute left-0 top-10 z-30 w-72 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl grid grid-cols-8 gap-1';

    ALL_WHATSAPP_EMOJIS.forEach((em) => {
      const emBtn = document.createElement('button');
      emBtn.type = 'button';
      emBtn.className =
        'w-7 h-7 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-base cursor-pointer transition-transform hover:scale-110';
      emBtn.textContent = em;
      emBtn.addEventListener('click', () => {
        insertAtCursor(em);
        emojiPopover.classList.add('hidden');
      });
      emojiPopover.appendChild(emBtn);
    });

    emojiDropdownBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      emojiPopover.classList.toggle('hidden');
    });

    const divider = document.createElement('span');
    divider.className = 'h-5 w-px bg-slate-200 dark:bg-slate-700 mx-0.5';

    const quickEmojiBox = document.createElement('div');
    quickEmojiBox.className = 'flex items-center gap-1';
    QUICK_EMOJIS.forEach((em) => {
      const qBtn = document.createElement('button');
      qBtn.type = 'button';
      qBtn.className =
        'w-7 h-7 flex items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-base cursor-pointer transition-transform hover:scale-110';
      qBtn.textContent = em;
      qBtn.title = `Insertar ${em}`;
      qBtn.addEventListener('click', () => insertAtCursor(em));
      quickEmojiBox.appendChild(qBtn);
    });

    charCounter.className = 'text-xs text-slate-400 dark:text-slate-500 ml-1';
    charCounter.textContent = '0 caracteres';

    emojiToolbar.append(emojiDropdownBtn, emojiPopover, divider, quickEmojiBox, charCounter);

    msgTextarea.rows = 4;
    msgTextarea.placeholder =
      'Escribe el mensaje aquí... Puedes usar *negrita*, _cursiva_ o ~tachado~';
    msgTextarea.value = formData.contenido;
    msgTextarea.className =
      'w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand resize-y';

    const tipText = document.createElement('p');
    tipText.className = 'text-[11px] text-slate-400 dark:text-slate-500';
    tipText.innerHTML = `Tip: Usa <code class="px-1.5 py-0.5 rounded bg-brand-soft dark:bg-brand/20 text-brand font-mono">*texto*</code> para negrita y <code class="px-1.5 py-0.5 rounded bg-brand-soft dark:bg-brand/20 text-brand font-mono">_texto_</code> para cursiva en WhatsApp.`;

    contentSection.append(contentLabel, emojiToolbar, msgTextarea, tipText);
    formContainer.appendChild(contentSection);

    // Fila 5: Estado del Perfil (Checkbox Activo)
    const statusRow = document.createElement('div');
    statusRow.className =
      'flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800';

    const statusLabelLeft = document.createElement('span');
    statusLabelLeft.className = 'text-xs font-semibold text-slate-700 dark:text-slate-200';
    statusLabelLeft.textContent = 'Estado del Perfil:';

    const checkWrap = document.createElement('label');
    checkWrap.className = 'inline-flex items-center gap-2 cursor-pointer select-none';

    const statusCheckbox = document.createElement('input');
    statusCheckbox.type = 'checkbox';
    statusCheckbox.checked = formData.activo;
    statusCheckbox.className = 'w-4 h-4 rounded accent-brand cursor-pointer';
    statusCheckbox.addEventListener('change', (e) => {
      dirty = true;
      formData.activo = e.target.checked;
    });

    const checkText = document.createElement('span');
    checkText.className = 'text-xs font-semibold text-slate-800 dark:text-slate-100';
    checkText.textContent = 'Activo (disponible para envíos)';

    checkWrap.append(statusCheckbox, checkText);
    statusRow.append(statusLabelLeft, checkWrap);
    formContainer.appendChild(statusRow);

    // Fila 6: Vista Previa en Vivo (Simulación WhatsApp) conectada a Clientes y Proveedores reales
    const previewSection = document.createElement('div');
    previewSection.className = 'space-y-2';

    const previewHeader = document.createElement('div');
    previewHeader.className = 'flex flex-wrap items-center justify-between gap-2';

    const previewTitleLeft = document.createElement('div');
    previewTitleLeft.className =
      'inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200';
    previewTitleLeft.innerHTML = `
      <i class="fa-brands fa-whatsapp text-emerald-500 text-sm"></i>
      <span>Vista Previa en Vivo (Simulación WhatsApp):</span>
    `;

    const recipientSelectorWrap = document.createElement('div');
    recipientSelectorWrap.className = 'flex items-center gap-1.5';

    const recipientSelect = document.createElement('select');
    recipientSelect.title =
      'Selecciona un Cliente o Proveedor real de la base de datos para probar las variables dinámicas';
    recipientSelect.className =
      'max-w-[240px] px-2 py-1 text-[11px] rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-brand';

    state.recipients.forEach((rec, idx) => {
      const opt = document.createElement('option');
      opt.value = String(idx);
      opt.textContent =
        idx === 0 ? `Ejemplo con cliente real (${rec.nombre})` : rec.label;
      recipientSelect.appendChild(opt);
    });

    recipientSelect.addEventListener('change', () => {
      const idx = Number(recipientSelect.value);
      selectedRecipient = state.recipients[idx] || state.recipients[0];
      updatePreviewAndCounter();
    });

    recipientSelectorWrap.appendChild(recipientSelect);
    previewHeader.append(previewTitleLeft, recipientSelectorWrap);

    const waSurface = document.createElement('div');
    waSurface.className =
      'w-full rounded-xl bg-[#e5ddd5] dark:bg-slate-800/90 p-4 min-h-[110px] flex items-center justify-end';

    const waBubble = document.createElement('div');
    waBubble.className =
      'bg-[#d9fdd3] dark:bg-emerald-950/90 border border-[#b8f2b0] dark:border-emerald-800 rounded-xl px-4 py-2.5 max-w-[85%] min-w-[210px] shadow-xs space-y-1';

    const waBubbleBody = document.createElement('div');
    waBubbleBody.className = 'text-xs sm:text-sm leading-relaxed break-words';

    const waBubbleTime = document.createElement('div');
    waBubbleTime.className =
      'flex items-center justify-end gap-1 text-[10px] text-slate-500 dark:text-slate-400';
    waBubbleTime.innerHTML = `
      <span>${getCurrentTimeHHMM()}</span>
      <i class="fa-solid fa-check-double text-sky-500"></i>
    `;

    waBubble.append(waBubbleBody, waBubbleTime);
    waSurface.appendChild(waBubble);
    previewSection.append(previewHeader, waSurface);
    formContainer.appendChild(previewSection);

    function updatePreviewAndCounter() {
      const raw = msgTextarea.value || '';
      charCounter.textContent = `${raw.length} caracteres`;
      if (!raw.trim()) {
        waBubbleBody.innerHTML = `<span class="italic text-slate-400 dark:text-slate-500">El mensaje se verá aquí...</span>`;
      } else {
        waBubbleBody.innerHTML = formatWhatsAppPreviewHtml(raw, selectedRecipient);
      }
    }

    msgTextarea.addEventListener('input', (e) => {
      dirty = true;
      formData.contenido = e.target.value;
      updatePreviewAndCounter();
    });

    formContainer.addEventListener('click', () => {
      emojiPopover.classList.add('hidden');
    });

    updatePreviewAndCounter();

    openModal({
      title: isEdit ? 'Editar Perfil de Mensaje' : 'Crear Perfil de Mensaje',
      content: formContainer,
      size: 'lg',
      confirmText: isEdit ? 'Guardar Cambios' : 'Crear Perfil',
      cancelText: 'Cancelar',
      hasUnsavedChanges: () => dirty,
      onConfirm: async ({ setLoading }) => {
        if (!formData.titulo.trim()) {
          toast.warning('Ingresa el Nombre / Título del Perfil.');
          titleInput.focus();
          return false;
        }
        if (!formData.contenido.trim()) {
          toast.warning('Ingresa el Contenido del Mensaje de WhatsApp.');
          msgTextarea.focus();
          return false;
        }

        setLoading(true);
        try {
          if (isEdit) {
            await apiFetch(`/api/perfiles-mensajes/${editingRow.id}`, {
              method: 'PUT',
              body: JSON.stringify(formData),
            });
            toast.success('Perfil de mensaje actualizado correctamente.');
          } else {
            await apiFetch('/api/perfiles-mensajes', {
              method: 'POST',
              body: JSON.stringify(formData),
            });
            toast.success('Perfil de mensaje creado exitosamente.');
          }
          dirty = false;
          fetchPerfiles();
        } catch (err) {
          toast.error(err.message || 'No se pudo guardar el perfil de mensaje.');
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

    // Barra superior con botón "+ Crear perfil" alineado a la derecha
    const topActions = document.createElement('div');
    topActions.className = 'flex items-center justify-end';

    const createBtn = createButton({
      text: 'Crear perfil',
      icon: 'fa-solid fa-plus',
      variant: 'primary',
      size: 'md',
      onClick: () => openCreateOrEditModal(null),
    });

    topActions.appendChild(createBtn);
    wrapper.appendChild(topActions);

    // Barra de filtros: Categoría y Estado
    const filterBar = document.createElement('div');
    filterBar.className =
      'w-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl px-4 py-3 flex flex-wrap items-center gap-4 shadow-xs';

    const catGroup = document.createElement('div');
    catGroup.className = 'flex items-center gap-2';
    const catLabel = document.createElement('label');
    catLabel.className = 'text-xs text-slate-500 dark:text-slate-400 font-medium';
    catLabel.textContent = 'Categoría:';

    const catFilterSelect = document.createElement('select');
    catFilterSelect.className =
      'min-h-[34px] px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand';
    [{ value: '', label: 'Todas las categorías' }, ...CATEGORIAS_PERFIL.map((c) => ({ value: c, label: c }))].forEach(
      (opt) => {
        const o = document.createElement('option');
        o.value = opt.value;
        o.textContent = opt.label;
        catFilterSelect.appendChild(o);
      }
    );
    catFilterSelect.value = state.categoria;
    catFilterSelect.addEventListener('change', (e) => {
      state.categoria = e.target.value;
      state.page = 1;
      fetchPerfiles();
    });
    catGroup.append(catLabel, catFilterSelect);

    const statusGroup = document.createElement('div');
    statusGroup.className = 'flex items-center gap-2';
    const statusLabel = document.createElement('label');
    statusLabel.className = 'text-xs text-slate-500 dark:text-slate-400 font-medium';
    statusLabel.textContent = 'Estado:';

    const statusFilterSelect = document.createElement('select');
    statusFilterSelect.className =
      'min-h-[34px] px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand';
    [
      { value: '', label: 'Todos los estados' },
      { value: 'activo', label: 'Activo' },
      { value: 'inactivo', label: 'Inactivo' },
    ].forEach((opt) => {
      const o = document.createElement('option');
      o.value = opt.value;
      o.textContent = opt.label;
      statusFilterSelect.appendChild(o);
    });
    statusFilterSelect.value = state.estado;
    statusFilterSelect.addEventListener('change', (e) => {
      state.estado = e.target.value;
      state.page = 1;
      fetchPerfiles();
    });
    statusGroup.append(statusLabel, statusFilterSelect);

    filterBar.append(catGroup, statusGroup);
    wrapper.appendChild(filterBar);

    const table = createDataTable({
      loading: state.loading,
      error: state.error,
      data: state.data,
      total: state.total,
      page: state.page,
      pageSize: 20,
      searchPlaceholder: 'Buscar por título o contenido...',
      emptyMessage: 'No hay perfiles de mensajes registrados.',
      onSearch: (q) => {
        state.q = q;
        state.page = 1;
        fetchPerfiles();
      },
      onPageChange: (newPage) => {
        state.page = newPage;
        fetchPerfiles();
      },
      onRetry: () => fetchPerfiles(),
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
            btn.title = 'Ver vista previa del perfil';
            btn.textContent = `#${row.id}`;
            btn.addEventListener('click', () => openDetailPreview(row));
            return btn;
          },
        },
        {
          key: 'categoria',
          label: 'CATEGORÍA',
          sortable: true,
          render: (row) => {
            const style = getCategoryBadgeClasses(row.categoria);
            const badge = document.createElement('span');
            badge.className = `inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${style.pill}`;
            badge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full ${style.dot}"></span>${escapeHtml(
              row.categoria || 'General'
            )}`;
            return badge;
          },
        },
        {
          key: 'titulo',
          label: 'PERFIL / TÍTULO',
          sortable: true,
          render: (row) => {
            const box = document.createElement('div');
            const titleBtn = document.createElement('button');
            titleBtn.type = 'button';
            titleBtn.className =
              'text-left text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 hover:text-brand dark:hover:text-brand hover:underline cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded';
            titleBtn.title = 'Ver vista previa del perfil';
            titleBtn.textContent = row.titulo || '-';
            titleBtn.addEventListener('click', () => openDetailPreview(row));
            box.appendChild(titleBtn);

            if (row.descripcion) {
              const descEl = document.createElement('p');
              descEl.className = 'text-[11px] text-slate-400 dark:text-slate-500';
              descEl.textContent = row.descripcion;
              box.appendChild(descEl);
            }
            return box;
          },
        },
        {
          key: 'contenido',
          label: 'CONTENIDO DEL MENSAJE PREDETERMINADO',
          render: (row) => {
            const cell = document.createElement('div');
            cell.className = 'flex items-center justify-between gap-3 max-w-xl';

            const msgSpan = document.createElement('div');
            msgSpan.className = 'text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-2';
            msgSpan.innerHTML = renderMessageWithVariablePills(row.contenido || '');

            const copyBtn = document.createElement('button');
            copyBtn.type = 'button';
            copyBtn.title = 'Copiar contenido del mensaje';
            copyBtn.setAttribute('aria-label', 'Copiar contenido del mensaje');
            copyBtn.className =
              'w-7 h-7 rounded-lg text-slate-400 hover:text-brand hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center shrink-0 transition-colors cursor-pointer';
            copyBtn.innerHTML = '<i class="fa-regular fa-copy text-xs"></i>';
            copyBtn.addEventListener('click', async () => {
              try {
                await navigator.clipboard.writeText(row.contenido || '');
                toast.success('Mensaje copiado al portapapeles.');
              } catch (_) {
                toast.info('Contenido listo para copiar.');
              }
            });

            cell.append(msgSpan, copyBtn);
            return cell;
          },
        },
        {
          key: 'createdAt',
          label: 'FECHA CREADA',
          sortable: true,
          render: (row) => `
            <span class="text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
              ${formatDateTime(row.createdAt)}
            </span>
          `,
        },
        {
          key: 'updatedAt',
          label: 'FECHA MODIFICADA',
          sortable: true,
          render: (row) => `
            <span class="text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
              ${formatDateTime(row.updatedAt)}
            </span>
          `,
        },
        {
          key: 'activo',
          label: 'ESTADO',
          render: (row) => {
            const active = row.activo !== false;
            return `
              <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                active
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }">
                <span class="w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-slate-400'}"></span>
                ${active ? 'Activo' : 'Inactivo'}
              </span>
            `;
          },
        },
        {
          key: 'actions',
          label: 'ACCIONES',
          align: 'right',
          render: (row) => {
            const actWrap = document.createElement('div');
            actWrap.className = 'inline-flex items-center justify-end gap-1';

            // 1. Icono WhatsApp verde (probar / simular con cliente o proveedor real)
            const waBtn = document.createElement('button');
            waBtn.type = 'button';
            waBtn.title = 'Simular y enviar por WhatsApp con datos de Cliente/Proveedor';
            waBtn.setAttribute('aria-label', 'Simular y enviar por WhatsApp');
            waBtn.className =
              'min-h-[34px] min-w-[34px] rounded-lg text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/50 inline-flex items-center justify-center transition-colors cursor-pointer';
            waBtn.innerHTML = '<i class="fa-brands fa-whatsapp text-sm"></i>';
            waBtn.addEventListener('click', () => openWhatsAppTestModal(row));

            // 2. Icono Ver (Vista Previa completa según AGENTS.md)
            const viewBtn = createButton({
              icon: 'fa-solid fa-eye',
              variant: 'icon',
              size: 'sm',
              ariaLabel: 'Ver vista previa del perfil',
              onClick: () => openDetailPreview(row),
            });

            // 3. Icono Editar (abre el Modal de Editar Perfil)
            const editBtn = createButton({
              icon: 'fa-regular fa-pen-to-square',
              variant: 'icon',
              size: 'sm',
              ariaLabel: 'Editar perfil de mensaje',
              onClick: () => openCreateOrEditModal(row),
            });

            // 4. Icono Activar / Desactivar (fa-ban / fa-check)
            const toggleBtn = createButton({
              icon: row.activo !== false ? 'fa-solid fa-ban' : 'fa-solid fa-check',
              variant: 'icon',
              size: 'sm',
              ariaLabel: row.activo !== false ? 'Desactivar perfil' : 'Activar perfil',
              onClick: async () => {
                try {
                  await apiFetch(`/api/perfiles-mensajes/${row.id}`, {
                    method: 'PATCH',
                    body: JSON.stringify({ activo: !(row.activo !== false) }),
                  });
                  toast.success(
                    row.activo !== false
                      ? `Perfil "${row.titulo}" desactivado.`
                      : `Perfil "${row.titulo}" activado.`
                  );
                  fetchPerfiles();
                } catch (err) {
                  toast.error(err.message || 'No se pudo cambiar el estado.');
                }
              },
            });

            // 5. Icono Borrar (envía a Reciclaje con confirmación)
            const delBtn = createButton({
              icon: 'fa-regular fa-trash-can',
              variant: 'danger',
              size: 'sm',
              ariaLabel: 'Eliminar perfil de mensaje',
              onClick: () => {
                openConfirmModal({
                  title: 'Enviar perfil a Reciclaje',
                  message: `¿Confirmas que deseas borrar el perfil <strong>"${escapeHtml(
                    row.titulo
                  )}"</strong>? El registro se ocultará de esta vista y pasará al módulo de <strong>Reciclaje</strong> con fecha, hora y usuario.`,
                  confirmText: 'Sí, borrar',
                  cancelText: 'Cancelar',
                  onConfirm: async ({ setLoading }) => {
                    setLoading(true);
                    try {
                      await apiFetch(`/api/perfiles-mensajes/${row.id}`, {
                        method: 'DELETE',
                      });
                      toast.success('Perfil enviado al módulo de Reciclaje.');
                      fetchPerfiles();
                    } catch (err) {
                      toast.error(err.message || 'No se pudo borrar el perfil.');
                      return false;
                    } finally {
                      setLoading(false);
                    }
                  },
                });
              },
            });

            actWrap.append(waBtn, viewBtn, editBtn, toggleBtn, delBtn);
            return actWrap;
          },
        },
      ],
    });

    wrapper.appendChild(table);
    container.appendChild(wrapper);
  }

  function renderDetailView(item) {
    let selectedRec = state.recipients[0] || {
      nombre: 'Justo Ledesma',
      telefono: '+595986901117',
      documento: '4564525',
      ciudad: 'CDE',
      empresa: 'NETZ / R1 Personalizados',
      productos: 'Remeras Sublimadas R1',
      cantidad_productos: '12 unidades',
    };

    const pageWrapper = document.createElement('div');
    pageWrapper.className = 'w-full space-y-5 pb-8';

    const topBar = document.createElement('div');
    topBar.className = 'flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4';

    const style = getCategoryBadgeClasses(item.categoria);
    const titleSide = document.createElement('div');
    titleSide.innerHTML = `
      <div class="flex items-center gap-1.5 text-xs font-medium mb-1">
        <button type="button" id="breadcrumb-back-mensajes" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 inline-flex items-center gap-1 cursor-pointer">
          <i class="fa-solid fa-arrow-left text-[10px]"></i>
          <span>Perfiles de Mensajes</span>
        </button>
        <span class="text-slate-300 dark:text-slate-600">/</span>
        <span class="text-brand font-semibold">Vista Previa del Perfil</span>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <h2 class="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
          ${escapeHtml(item.titulo)}
        </h2>
        <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${style.pill}">
          <span class="w-1.5 h-1.5 rounded-full ${style.dot}"></span>
          ${escapeHtml(item.categoria || 'General')}
        </span>
      </div>
      <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
        ${escapeHtml(item.descripcion || 'Plantilla predeterminada para mensajes automatizados y difusiones por WhatsApp.')}
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

    const editBtn = createButton({
      text: 'Editar Perfil',
      icon: 'fa-regular fa-pen-to-square',
      variant: 'primary',
      size: 'sm',
      onClick: () => openCreateOrEditModal(item),
    });

    actionSide.append(backBtn, editBtn);
    topBar.append(titleSide, actionSide);
    pageWrapper.appendChild(topBar);

    titleSide.querySelector('#breadcrumb-back-mensajes')?.addEventListener('click', () => {
      state.view = 'list';
      state.viewingItem = null;
      render();
    });

    // Tarjeta de Historial de Fechas (Fecha Creada y Fecha Modificada)
    const auditBanner = document.createElement('div');
    auditBanner.className =
      'w-full bg-brand-soft/60 dark:bg-brand/10 border border-brand/25 rounded-xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-4';
    auditBanner.innerHTML = `
      <div class="flex items-center gap-3">
        <span class="w-9 h-9 rounded-lg bg-brand text-white flex items-center justify-center shrink-0">
          <i class="fa-regular fa-calendar-check text-sm" aria-hidden="true"></i>
        </span>
        <div>
          <p class="text-[11px] font-bold uppercase tracking-wider text-brand">Registro de Alta y Modificación (#${item.id})</p>
          <div class="flex flex-wrap items-center gap-x-5 gap-y-1 mt-0.5">
            <p class="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100">
              Fecha Creada: <span class="text-brand">${formatDateTime(item.createdAt)}</span>
            </p>
            <p class="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100">
              Fecha Modificada: <span class="text-slate-700 dark:text-slate-300">${formatDateTime(item.updatedAt)}</span>
            </p>
          </div>
        </div>
      </div>
      <div>
        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
          item.activo !== false
            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
        }">
          <span class="w-2 h-2 rounded-full ${item.activo !== false ? 'bg-emerald-500' : 'bg-slate-400'}"></span>
          ${item.activo !== false ? 'Perfil Activo' : 'Perfil Inactivo'}
        </span>
      </div>
    `;
    pageWrapper.appendChild(auditBanner);

    // Contenido y Simulación en Vivo con Clientes / Proveedores Reales
    const contentGrid = document.createElement('div');
    contentGrid.className = 'grid grid-cols-1 lg:grid-cols-2 gap-5';

    const templateCard = document.createElement('section');
    templateCard.className =
      'bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-xs';
    templateCard.innerHTML = `
      <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <h3 class="text-xs font-bold uppercase tracking-wider text-brand">Plantilla con Variables Dinámicas</h3>
        <span class="text-[11px] text-slate-400">${(item.contenido || '').length} caracteres</span>
      </div>
      <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-sm text-slate-800 dark:text-slate-100 leading-relaxed whitespace-pre-wrap">${renderMessageWithVariablePills(
        item.contenido || ''
      )}</div>
    `;

    const liveCard = document.createElement('section');
    liveCard.className =
      'bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-xs';

    const liveHeader = document.createElement('div');
    liveHeader.className =
      'flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3';
    liveHeader.innerHTML = `
      <div class="inline-flex items-center gap-2">
        <i class="fa-brands fa-whatsapp text-emerald-500 text-base"></i>
        <h3 class="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
          Simulación con Datos Reales (Clientes / Proveedor)
        </h3>
      </div>
    `;

    const recSelect = document.createElement('select');
    recSelect.className =
      'px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand';
    state.recipients.forEach((rec, idx) => {
      const opt = document.createElement('option');
      opt.value = String(idx);
      opt.textContent = rec.label;
      recSelect.appendChild(opt);
    });
    liveHeader.appendChild(recSelect);

    const waBox = document.createElement('div');
    waBox.className =
      'w-full rounded-xl bg-[#e5ddd5] dark:bg-slate-800 p-4 min-h-[130px] flex items-center justify-end';

    const bubble = document.createElement('div');
    bubble.className =
      'bg-[#d9fdd3] dark:bg-emerald-950/90 border border-[#b8f2b0] dark:border-emerald-800 rounded-xl px-4 py-2.5 max-w-[90%] shadow-xs space-y-1';
    const bubbleBody = document.createElement('div');
    bubbleBody.className = 'text-xs sm:text-sm leading-relaxed break-words';
    bubbleBody.innerHTML = formatWhatsAppPreviewHtml(item.contenido, selectedRec);

    const bubbleTime = document.createElement('div');
    bubbleTime.className = 'flex items-center justify-end gap-1 text-[10px] text-slate-500';
    bubbleTime.innerHTML = `<span>${getCurrentTimeHHMM()}</span><i class="fa-solid fa-check-double text-sky-500"></i>`;

    bubble.append(bubbleBody, bubbleTime);
    waBox.appendChild(bubble);

    recSelect.addEventListener('change', () => {
      const idx = Number(recSelect.value);
      selectedRec = state.recipients[idx] || state.recipients[0];
      bubbleBody.innerHTML = formatWhatsAppPreviewHtml(item.contenido, selectedRec);
    });

    liveCard.append(liveHeader, waBox);
    contentGrid.append(templateCard, liveCard);
    pageWrapper.appendChild(contentGrid);

    container.appendChild(pageWrapper);
  }

  loadRealRecipients().then(() => fetchPerfiles());
}

