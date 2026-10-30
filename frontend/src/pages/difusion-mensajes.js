import { createButton } from '../components/button.js';
import { createDataTable } from '../components/table.js';
import { openModal, openConfirmModal } from '../components/modal.js';
import { createPhoneInput } from '../components/phone-input.js?v=20261029_8';
import {
  createMediaAttachmentInput,
  renderMediaPreviewCard,
  openImageZoomModal,
} from '../components/media-attachment.js?v=20261029_8';
import { toast } from '../components/toast.js';
import { apiFetch } from '../services/api.js';
import {
  subscribeQueue,
  startBroadcastJob,
  startScheduledMessageJob,
  formatRemainingDuration,
  consumePreferredBroadcastTab,
  clearCompletedBroadcastBanner,
} from '../services/queue-manager.js?v=20261029_8';

const QUICK_EMOJIS = ['👋', '😊', '✨', '🎉', '👍', '💼', '💰', '🗓️'];

const ALL_WHATSAPP_EMOJIS = [
  '👋', '😊', '😀', '😄', '😁', '🤩', '🥳', '😎', '🤝', '🙏',
  '✨', '🎉', '🎊', '🔥', '⭐', '🌟', '💯', '✅', '☑️', '🚀',
  '👍', '👏', '🙌', '💪', '🫶', '❤️', '💜', '💙', '💚', '🧡',
  '💼', '📦', '🛍️', '🛒', '🏷️', '🧾', '📋', '📄', '📌', '📍',
  '💰', '💵', '💳', '🏦', '📈', '🗓️', '⏰', '⏳', '📲', '📞',
  '🚚', '🛵', '🏢', '🏪', '⚠️', '📢', '🔔', '💬', '➡️', '⬇️',
];

const VARIABLES_DINAMICAS = [
  '{nombre}',
  '{telefono}',
  '{documento}',
  '{ciudad}',
  '{empresa}',
  '{productos}',
  '{cantidad_productos}',
];

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeDigits(phone) {
  return String(phone || '').replace(/[^\d]/g, '');
}

function resolveDynamicMessage(rawText, contact) {
  const c = contact || {
    nombre: 'Cliente',
    telefono: '+595986000000',
    documento: '—',
    ciudad: 'Paraguay',
    empresa: 'Particular',
    productos: 'Productos R1',
    cantidad_productos: '1',
  };
  return String(rawText || '')
    .split('{nombre}').join(c.nombre || 'Cliente')
    .split('{telefono}').join(c.telefono || '')
    .split('{documento}').join(c.documento || '')
    .split('{ciudad}').join(c.ciudad || '')
    .split('{empresa}').join(c.empresa || '')
    .split('{productos}').join(c.productos || '')
    .split('{cantidad_productos}').join(c.cantidad_productos || '1');
}

function formatWhatsAppBubbleHtml(rawText, contact) {
  const resolved = resolveDynamicMessage(rawText, contact);
  let safe = escapeHtml(resolved);
  safe = safe.replace(/\*([^*\n]+)\*/g, '<strong class="font-bold">$1</strong>');
  safe = safe.replace(/_([^_\n]+)_/g, '<em class="italic">$1</em>');
  safe = safe.replace(/~([^~\n]+)~/g, '<del class="line-through">$1</del>');
  safe = safe.replace(/\n/g, '<br>');
  return safe;
}

function getCurrentTimeHHMM() {
  return new Date().toLocaleTimeString('es-PY', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * Crea la barra de herramientas de Emojis + Variables dinámicas sobre un Textarea.
 */
function createComposerToolbar(textareaEl, onContentModified) {
  const bar = document.createElement('div');
  bar.className = 'flex flex-wrap items-center justify-between gap-2';

  const varsWrap = document.createElement('div');
  varsWrap.className = 'flex flex-wrap items-center gap-1.5';

  function insertSnippet(snippet) {
    const start = textareaEl.selectionStart ?? textareaEl.value.length;
    const end = textareaEl.selectionEnd ?? textareaEl.value.length;
    const before = textareaEl.value.slice(0, start);
    const after = textareaEl.value.slice(end);
    textareaEl.value = `${before}${snippet}${after}`;
    const nextPos = start + snippet.length;
    textareaEl.focus();
    textareaEl.setSelectionRange(nextPos, nextPos);
    if (typeof onContentModified === 'function') {
      onContentModified(textareaEl.value);
    }
  }

  VARIABLES_DINAMICAS.forEach((token) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className =
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 hover:bg-brand-soft dark:bg-slate-800 dark:hover:bg-brand/20 border border-slate-200 dark:border-slate-700 text-[11px] font-mono font-semibold text-slate-700 dark:text-slate-200 hover:text-brand transition-colors cursor-pointer';
    chip.innerHTML = `<span class="text-brand font-bold">+</span><span>${token}</span>`;
    chip.addEventListener('click', () => insertSnippet(token));
    varsWrap.appendChild(chip);
  });

  const emojiRight = document.createElement('div');
  emojiRight.className = 'relative flex items-center gap-1.5';

  const emojiBtn = document.createElement('button');
  emojiBtn.type = 'button';
  emojiBtn.className =
    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer';
  emojiBtn.innerHTML = `
    <span class="text-sm leading-none">😀</span>
    <span>Emojis</span>
    <i class="fa-solid fa-chevron-down text-[10px] text-slate-400"></i>
  `;

  const popover = document.createElement('div');
  popover.className =
    'hidden absolute right-0 top-9 z-30 w-72 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl grid grid-cols-8 gap-1';

  ALL_WHATSAPP_EMOJIS.forEach((em) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className =
      'w-7 h-7 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-base cursor-pointer';
    b.textContent = em;
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      insertSnippet(em);
      popover.classList.add('hidden');
    });
    popover.appendChild(b);
  });

  emojiBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    popover.classList.toggle('hidden');
  });

  document.addEventListener('click', () => {
    popover.classList.add('hidden');
  });

  const sep = document.createElement('span');
  sep.className = 'h-4 w-px bg-slate-200 dark:bg-slate-700 mx-0.5';

  const quickWrap = document.createElement('div');
  quickWrap.className = 'flex items-center gap-0.5';
  QUICK_EMOJIS.forEach((em) => {
    const qb = document.createElement('button');
    qb.type = 'button';
    qb.className =
      'w-7 h-7 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-sm cursor-pointer';
    qb.textContent = em;
    qb.addEventListener('click', () => insertSnippet(em));
    quickWrap.appendChild(qb);
  });

  emojiRight.append(emojiBtn, popover, sep, quickWrap);
  bar.append(varsWrap, emojiRight);
  return bar;
}

/**
 * Renderiza el buscador inteligente de Clientes y Proveedores que al hacer clic
 * despliega automáticamente una vista previa de 3 contactos con su cuenta de WhatsApp.
 */
function createContactSearchPicker({ contacts = [], selectedContact = null, onSelect }) {
  const wrap = document.createElement('div');
  wrap.className = 'relative w-full';

  const inputWrap = document.createElement('div');
  inputWrap.className = 'relative';

  const icon = document.createElement('i');
  icon.className =
    'fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Escriba aquí para buscar por nombre, apellido, cédula/RUC o teléfono...';
  input.value = selectedContact
    ? `${selectedContact.nombre} (${selectedContact.telefono})`
    : '';
  input.className =
    'w-full min-h-[42px] pl-9 pr-8 py-2 text-xs sm:text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand';

  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.title = 'Limpiar selección';
  clearBtn.className = `${
    selectedContact ? 'flex' : 'hidden'
  } absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 items-center justify-center cursor-pointer`;
  clearBtn.innerHTML = '<i class="fa-solid fa-xmark text-xs"></i>';

  inputWrap.append(icon, input, clearBtn);

  const dropdown = document.createElement('div');
  dropdown.className =
    'hidden absolute left-0 right-0 top-[calc(100%+6px)] z-30 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden';

  function renderDropdownList(queryText) {
    dropdown.innerHTML = '';
    const q = String(queryText || '').trim().toLowerCase();

    const headerBanner = document.createElement('div');
    headerBanner.className =
      'px-3.5 py-2 bg-brand-soft/60 dark:bg-brand/15 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-[11px]';

    let itemsToShow = [];
    if (!q) {
      // Al hacer clic sin escribir: muestra vista previa de 3 clientes/proveedores
      itemsToShow = contacts.slice(0, 3);
      headerBanner.innerHTML = `
        <span class="font-semibold text-brand">
          <i class="fa-solid fa-wand-magic-sparkles mr-1"></i>
          Vista previa rápida (3 contactos) — Escribe el nombre o RUC para buscar en los ${contacts.length} registros
        </span>
      `;
    } else {
      itemsToShow = contacts
        .filter(
          (c) =>
            c.nombre.toLowerCase().includes(q) ||
            c.documento.toLowerCase().includes(q) ||
            c.telefono.toLowerCase().includes(q) ||
            c.empresa.toLowerCase().includes(q)
        )
        .slice(0, 12);
      headerBanner.innerHTML = `
        <span class="font-semibold text-slate-600 dark:text-slate-300">
          Resultados encontrados (${itemsToShow.length})
        </span>
      `;
    }
    dropdown.appendChild(headerBanner);

    if (itemsToShow.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'px-4 py-3 text-xs text-slate-400 dark:text-slate-500';
      empty.textContent =
        'No se encontraron coincidencias. Puedes escribir el número directamente en el campo de al lado.';
      dropdown.appendChild(empty);
      return;
    }

    const listEl = document.createElement('div');
    listEl.className = 'max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800';

    itemsToShow.forEach((c) => {
      const itemBtn = document.createElement('button');
      itemBtn.type = 'button';
      itemBtn.className =
        'w-full px-3.5 py-2.5 text-left hover:bg-brand-soft/40 dark:hover:bg-slate-800 flex items-center justify-between gap-3 transition-colors cursor-pointer';

      const isProv = c.origen === 'Proveedor';
      itemBtn.innerHTML = `
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
              isProv
                ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                : 'bg-brand-soft dark:bg-brand/20 text-brand'
            }">${c.origen}</span>
            <p class="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 truncate">${escapeHtml(
              c.nombre
            )}</p>
          </div>
          <p class="text-[11px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
            Doc/RUC: ${escapeHtml(c.documento)} · Ciudad: ${escapeHtml(c.ciudad)}
          </p>
        </div>
        <div class="shrink-0 text-right">
          <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
            <i class="fa-brands fa-whatsapp"></i>
            <span>${escapeHtml(c.telefono)}</span>
          </span>
        </div>
      `;

      itemBtn.addEventListener('click', () => {
        input.value = `${c.nombre} (${c.telefono})`;
        clearBtn.classList.remove('hidden');
        clearBtn.classList.add('flex');
        dropdown.classList.add('hidden');
        if (typeof onSelect === 'function') onSelect(c);
      });

      listEl.appendChild(itemBtn);
    });

    dropdown.appendChild(listEl);
  }

  input.addEventListener('focus', () => {
    renderDropdownList(selectedContact ? '' : input.value);
    dropdown.classList.remove('hidden');
  });

  input.addEventListener('click', (e) => {
    e.stopPropagation();
    renderDropdownList(selectedContact ? '' : input.value);
    dropdown.classList.remove('hidden');
  });

  input.addEventListener('input', () => {
    clearBtn.classList.toggle('hidden', !input.value);
    clearBtn.classList.toggle('flex', Boolean(input.value));
    renderDropdownList(input.value);
    dropdown.classList.remove('hidden');
  });

  clearBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    input.value = '';
    clearBtn.classList.add('hidden');
    clearBtn.classList.remove('flex');
    if (typeof onSelect === 'function') onSelect(null);
    renderDropdownList('');
    dropdown.classList.remove('hidden');
  });

  dropdown.addEventListener('click', (e) => e.stopPropagation());
  document.addEventListener('click', () => dropdown.classList.add('hidden'));

  wrap.append(inputWrap, dropdown);
  return { element: wrap, input };
}

/**
 * Renderiza la burbuja de Vista Previa de WhatsApp incluyendo soporte para Imagen, Video o PDF adjunto.
 */
function renderWhatsAppSimulationBox({ text, contact, attachment, timeLabel = '' }) {
  const surface = document.createElement('div');
  surface.className =
    'w-full rounded-xl bg-[#e5ddd5] dark:bg-slate-800/90 p-4 min-h-[115px] flex items-center justify-end';

  const bubble = document.createElement('div');
  bubble.className =
    'bg-[#d9fdd3] dark:bg-emerald-950/90 border border-[#b8f2b0] dark:border-emerald-800 text-slate-800 dark:text-slate-100 rounded-xl px-4 py-2.5 max-w-[88%] min-w-[230px] shadow-xs space-y-2';

  if (attachment && attachment.data) {
    const mediaBox = document.createElement('div');
    mediaBox.className = 'pb-1';
    const card = renderMediaPreviewCard(attachment, { compact: true });
    if (card) mediaBox.appendChild(card);
    bubble.appendChild(mediaBox);
  }

  const msgBody = document.createElement('div');
  msgBody.className = 'text-xs sm:text-sm leading-relaxed break-words';
  if (!String(text || '').trim() && (!attachment || !attachment.data)) {
    msgBody.innerHTML = `<span class="italic text-slate-500 dark:text-slate-400">Seleccione un contacto y mensaje para ver la vista previa...</span>`;
  } else {
    msgBody.innerHTML = formatWhatsAppBubbleHtml(text, contact);
  }

  const meta = document.createElement('div');
  meta.className =
    'flex items-center justify-end gap-1 text-[10px] text-slate-500 dark:text-slate-400';
  meta.innerHTML = `
    <span>${escapeHtml(timeLabel || getCurrentTimeHHMM())}</span>
    <i class="fa-solid fa-check-double text-sky-500"></i>
  `;

  bubble.append(msgBody, meta);
  surface.appendChild(bubble);
  return surface;
}

export function renderDifusionMensajesModule(container) {
  const initialPrefTab = consumePreferredBroadcastTab();

  const state = {
    activeTab: initialPrefTab || 'mensajes', // 'mensajes' | 'difusion' | 'programar' | 'historial'
    contacts: [],          // Clientes + Proveedores reales de la BD
    templates: [],         // Perfiles de Mensajes activos

    // Pestaña 1: Mensajes (Envío Directo)
    direct: {
      selectedContact: null,
      phoneCode: '+595',
      phoneNumber: '',
      templateId: '',
      contenido: '',
      attachment: null,
    },

    // Pestaña 2: Difusión Masiva
    broadcast: {
      intervalValue: 30,
      intervalUnit: 'segundos', // 'segundos' | 'minutos'
      groupFilter: 'todos',     // 'todos' | 'clientes' | 'proveedores'
      selectedKeys: new Set(),  // Claves únicas de contactos seleccionados (sin duplicados)
      manualNumbersText: '',
      extraPhoneCode: '+595',
      extraPhoneNum: '',
      templateId: '',
      contenido: '',
      attachment: null,
    },

    // Pestaña 3: Programar Envío Automático
    schedule: {
      selectedContact: null,
      phoneCode: '+595',
      phoneNumber: '',
      templateId: '',
      contenido: '',
      attachment: null,
      mode: 'timer', // 'timer' | 'today_time' | 'datetime'
      timerMinutes: 15,
      todayTime: '18:00',
      specificDateTime: '',
    },

    // Pestaña 4: Historial de Mensajes
    history: {
      view: 'list', // 'list' | 'detail'
      viewingItem: null,
      data: [],
      total: 0,
      page: 1,
      pageSize: 20,
      q: '',
      tipo: '',
      loading: false,
      error: '',
    },
  };

  async function loadContactsAndTemplates() {
    const combined = [];
    try {
      const resCli = await apiFetch('/api/clientes?page=1&page_size=100');
      if (resCli && Array.isArray(resCli.data)) {
        resCli.data.forEach((c) => {
          const isEmp = c.tipoCliente === 'empresa';
          const nombre = isEmp
            ? c.razonSocial || c.nombreFantasia || 'Empresa Cliente'
            : `${c.nombres || ''} ${c.apellidos || ''}`.trim() || 'Cliente';
          const tel = c.whatsappCompleto || c.telefonoCompleto || '';
          if (!tel) return;
          combined.push({
            key: `cliente-${c.id}`,
            id: c.id,
            origen: 'Cliente',
            nombre,
            telefono: tel,
            telefonoCodigo: c.whatsappCodigo || '+595',
            telefonoNumero: c.whatsappNumero || normalizeDigits(tel).replace(/^595/, ''),
            documento: isEmp ? c.rucBase || c.ruc || '—' : c.numeroDocumento || c.ruc || '—',
            ciudad: c.ciudad || c.departamento || 'Paraguay',
            empresa: isEmp ? c.razonSocial || nombre : c.nombreFantasia || 'Particular',
            productos: 'Pedido R1 Personalizados',
            cantidad_productos: '1',
          });
        });
      }
    } catch (_) {
      // Continuar
    }

    try {
      const resProv = await apiFetch('/api/proveedores?page=1&page_size=100');
      if (resProv && Array.isArray(resProv.data)) {
        resProv.data.forEach((p) => {
          const tel = p.contactoTelefono || p.telefonoCorporativo || '';
          if (!tel) return;
          const nombre = p.razonSocial || p.nombreComercial || p.contactoNombre || 'Proveedor';
          combined.push({
            key: `proveedor-${p.id}`,
            id: p.id,
            origen: 'Proveedor',
            nombre,
            telefono: tel,
            telefonoCodigo: p.whatsappCodigo || p.telefonoCodigo || '+595',
            telefonoNumero:
              p.whatsappNumero || p.telefonoNumero || normalizeDigits(tel).replace(/^595/, ''),
            documento: p.rucDocumento || '—',
            ciudad: p.ciudad || p.pais || 'Paraguay',
            empresa: p.razonSocial || p.nombreComercial || nombre,
            productos: p.rubro || 'Insumos y Proveeduría',
            cantidad_productos: '1',
          });
        });
      }
    } catch (_) {
      // Continuar
    }

    state.contacts = combined;

    try {
      const resTpl = await apiFetch('/api/perfiles-mensajes?page=1&page_size=100&estado=activo');
      if (resTpl && Array.isArray(resTpl.data)) {
        state.templates = resTpl.data;
      }
    } catch (_) {
      state.templates = [];
    }
  }

  async function fetchHistorial() {
    state.history.loading = true;
    state.history.error = '';
    if (state.activeTab === 'historial' && state.history.view === 'list') render();
    try {
      const params = new URLSearchParams({
        page: String(state.history.page),
        page_size: String(state.history.pageSize),
      });
      if (state.history.q) params.set('q', state.history.q);
      if (state.history.tipo) params.set('tipo', state.history.tipo);

      const res = await apiFetch(`/api/difusion-mensajes?${params.toString()}`);
      state.history.data = Array.isArray(res.data) ? res.data : [];
      state.history.total = Number(res.total || 0);
    } catch (err) {
      state.history.error = err.message || 'No se pudo cargar el historial de mensajes.';
    } finally {
      state.history.loading = false;
      if (state.activeTab === 'historial' && state.history.view === 'list') render();
    }
  }

  function render() {
    container.innerHTML = '';

    const pageWrap = document.createElement('div');
    pageWrap.className = 'w-full space-y-5 pb-10';

    // Barra de pestañas superior (Mensajes | Difusión | Programar | Historial de Mensajes)
    const tabsBar = document.createElement('div');
    tabsBar.className =
      'flex flex-wrap items-center gap-2 sm:gap-6 border-b border-slate-200 dark:border-slate-800 px-1';

    const tabs = [
      { id: 'mensajes', label: 'Mensajes', icon: 'fa-regular fa-comment' },
      { id: 'difusion', label: 'Difusión', icon: 'fa-solid fa-bullhorn' },
      { id: 'programar', label: 'Programar', icon: 'fa-regular fa-clock' },
      { id: 'historial', label: 'Historial de Mensajes', icon: 'fa-solid fa-clock-rotate-left' },
    ];

    tabs.forEach((t) => {
      const isActive = state.activeTab === t.id;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = [
        'inline-flex items-center gap-2 px-3 py-3 text-xs sm:text-sm font-semibold border-b-2 -mb-px transition-colors cursor-pointer',
        isActive
          ? 'border-brand text-brand'
          : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200',
      ].join(' ');
      btn.innerHTML = `<i class="${t.icon} text-xs"></i><span>${t.label}</span>`;
      btn.addEventListener('click', () => {
        state.activeTab = t.id;
        if (t.id === 'historial') {
          state.history.view = 'list';
          fetchHistorial();
        } else {
          render();
        }
      });
      tabsBar.appendChild(btn);
    });

    pageWrap.appendChild(tabsBar);

    const tabContent = document.createElement('div');
    tabContent.className = 'w-full';

    if (state.activeTab === 'mensajes') {
      renderDirectMessageTab(tabContent);
    } else if (state.activeTab === 'difusion') {
      renderBroadcastTab(tabContent);
    } else if (state.activeTab === 'programar') {
      renderScheduleTab(tabContent);
    } else if (state.activeTab === 'historial') {
      renderHistoryTab(tabContent);
    }

    pageWrap.appendChild(tabContent);
    container.appendChild(pageWrap);
  }

  // ============================================================================
  // PESTAÑA 1: MENSAJES (Envío Directo a Contacto — Foto 1)
  // ============================================================================
  function renderDirectMessageTab(parent) {
    const card = document.createElement('section');
    card.className =
      'w-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs space-y-5';

    // Cabecera de sección
    const header = document.createElement('div');
    header.className =
      'flex items-start gap-3 pb-4 border-b border-slate-100 dark:border-slate-800';
    header.innerHTML = `
      <span class="w-9 h-9 rounded-xl bg-brand-soft dark:bg-brand/20 text-brand flex items-center justify-center shrink-0">
        <i class="fa-regular fa-comment-dots text-sm"></i>
      </span>
      <div>
        <h2 class="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
          Envío Directo a Contacto
        </h2>
        <p class="text-xs text-slate-500 dark:text-slate-400">
          Busque un contacto del registro de clientes o proveedores, o escriba el número directo al lado; elija una plantilla predeterminada o redacte un mensaje personalizado.
        </p>
      </div>
    `;
    card.appendChild(header);

    // Fila de Selección de Contacto (Izquierda: Buscador con vista previa de 3 | Derecha: Teléfono directo con código de país)
    const contactGrid = document.createElement('div');
    contactGrid.className = 'grid grid-cols-1 lg:grid-cols-12 gap-4 items-start';

    const searchCol = document.createElement('div');
    searchCol.className = 'lg:col-span-7 space-y-1.5';
    searchCol.innerHTML = `
      <div class="flex items-center justify-between gap-2">
        <label class="text-xs font-semibold text-slate-700 dark:text-slate-200">
          Seleccionar Contacto del Registro de Clientes o Proveedores <span class="text-danger">*</span>
        </label>
        <span class="text-[11px] text-brand font-medium">
          ${state.contacts.length} contactos con WhatsApp disponibles
        </span>
      </div>
    `;

    const manualCol = document.createElement('div');
    manualCol.className = 'lg:col-span-5 space-y-1.5';

    let phoneComponent = null;

    function getEffectiveDirectContact() {
      const fullPhone = phoneComponent
        ? phoneComponent.getFullNumber()
        : `${state.direct.phoneCode}${state.direct.phoneNumber}`;
      const cleanDigits = normalizeDigits(fullPhone);
      if (state.direct.selectedContact) {
        return {
          ...state.direct.selectedContact,
          telefono: cleanDigits ? `+${cleanDigits}` : state.direct.selectedContact.telefono,
        };
      }
      return {
        origen: 'Manual',
        nombre: '—',
        telefono: cleanDigits ? `+${cleanDigits}` : '',
        documento: '—',
        ciudad: 'Paraguay',
        empresa: 'Particular',
        productos: 'Productos R1',
        cantidad_productos: '1',
      };
    }

    const previewContainer = document.createElement('div');
    function refreshDirectPreview() {
      previewContainer.innerHTML = '';
      previewContainer.appendChild(
        renderWhatsAppSimulationBox({
          text: state.direct.contenido,
          contact: getEffectiveDirectContact(),
          attachment: state.direct.attachment,
        })
      );
    }

    phoneComponent = createPhoneInput({
      label: 'Número de Teléfono / WhatsApp (o escribir directo si no está registrado)',
      required: true,
      initialCode: state.direct.phoneCode || '+595',
      initialNumber: state.direct.phoneNumber || '',
      placeholder: 'Ej. 986 901 117 (sin 0)',
      helperText: 'Por defecto Paraguay (+595), puedes cambiar el país o escribir un número nuevo.',
      onChange: (val) => {
        state.direct.phoneCode = val.code;
        state.direct.phoneNumber = val.number;
        refreshDirectPreview();
      },
    });
    manualCol.appendChild(phoneComponent.element);

    const picker = createContactSearchPicker({
      contacts: state.contacts,
      selectedContact: state.direct.selectedContact,
      onSelect: (c) => {
        state.direct.selectedContact = c;
        if (c) {
          state.direct.phoneCode = c.telefonoCodigo || '+595';
          state.direct.phoneNumber = c.telefonoNumero || normalizeDigits(c.telefono).replace(/^595/, '');
          render();
        } else {
          refreshDirectPreview();
        }
      },
    });
    searchCol.appendChild(picker.element);

    contactGrid.append(searchCol, manualCol);
    card.appendChild(contactGrid);

    // Mensaje Predeterminado (Plantilla) — vacío por defecto
    const tplGroup = document.createElement('div');
    tplGroup.className = 'space-y-1.5';
    tplGroup.innerHTML = `
      <div class="flex flex-wrap items-center justify-between gap-2">
        <label class="text-xs font-semibold text-slate-700 dark:text-slate-200">
          Mensaje Predeterminado (Plantilla):
        </label>
        <span class="text-[11px] italic text-slate-400 dark:text-slate-500">
          Carga el nombre del cliente y puede editar antes de enviar
        </span>
      </div>
    `;

    const tplSelect = document.createElement('select');
    tplSelect.className =
      'w-full min-h-[42px] px-3.5 py-2 text-xs sm:text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand';

    const emptyOpt = document.createElement('option');
    emptyOpt.value = '';
    emptyOpt.textContent = '-- Redactar mensaje nuevo libremente --';
    tplSelect.appendChild(emptyOpt);

    state.templates.forEach((t) => {
      const opt = document.createElement('option');
      opt.value = String(t.id);
      opt.textContent = `[${t.categoria}] ${t.titulo}`;
      tplSelect.appendChild(opt);
    });
    tplSelect.value = state.direct.templateId;

    const msgTextarea = document.createElement('textarea');

    tplSelect.addEventListener('change', (e) => {
      state.direct.templateId = e.target.value;
      if (!state.direct.templateId) {
        state.direct.contenido = '';
        msgTextarea.value = '';
      } else {
        const found = state.templates.find((x) => String(x.id) === state.direct.templateId);
        if (found) {
          state.direct.contenido = found.contenido || '';
          msgTextarea.value = state.direct.contenido;
        }
      }
      refreshDirectPreview();
    });

    tplGroup.appendChild(tplSelect);
    card.appendChild(tplGroup);

    // Contenido del Mensaje *
    const contentGroup = document.createElement('div');
    contentGroup.className = 'space-y-2';

    const contentTop = document.createElement('div');
    contentTop.className = 'flex flex-wrap items-center justify-between gap-2';
    const contentLabel = document.createElement('label');
    contentLabel.className = 'text-xs font-semibold text-slate-700 dark:text-slate-200';
    contentLabel.innerHTML = `Contenido del Mensaje <span class="text-danger">*</span>`;

    msgTextarea.rows = 4;
    msgTextarea.placeholder = 'Escriba aquí el mensaje a enviar...';
    msgTextarea.value = state.direct.contenido;
    msgTextarea.className =
      'w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand resize-y';

    const toolbar = createComposerToolbar(msgTextarea, (newVal) => {
      state.direct.contenido = newVal;
      refreshDirectPreview();
    });

    msgTextarea.addEventListener('input', (e) => {
      state.direct.contenido = e.target.value;
      refreshDirectPreview();
    });

    contentTop.append(contentLabel, toolbar);
    contentGroup.append(contentTop, msgTextarea);
    card.appendChild(contentGroup);

    // Adjuntar Imagen, Video o PDF
    const mediaPicker = createMediaAttachmentInput({
      label: 'Adjuntar Imagen, Video o PDF (Opcional):',
      allowUrlInput: true,
      initialValue: state.direct.attachment,
      onChange: (att) => {
        state.direct.attachment = att;
        refreshDirectPreview();
      },
    });
    card.appendChild(mediaPicker.element);

    // Vista Previa en WhatsApp
    const previewWrap = document.createElement('div');
    previewWrap.className = 'space-y-2';
    previewWrap.innerHTML = `
      <label class="block text-xs font-semibold text-slate-700 dark:text-slate-200">
        Vista Previa en WhatsApp:
      </label>
    `;
    previewWrap.appendChild(previewContainer);
    refreshDirectPreview();
    card.appendChild(previewWrap);

    // Pie con botón "Enviar Mensaje a Contacto"
    const footer = document.createElement('div');
    footer.className = 'flex items-center justify-end pt-2';

    const sendBtn = createButton({
      text: 'Enviar Mensaje a Contacto',
      icon: 'fa-regular fa-paper-plane',
      variant: 'primary',
      size: 'md',
      onClick: async (_, btnInstance) => {
        const eff = getEffectiveDirectContact();
        const digits = normalizeDigits(eff.telefono);
        if (!digits || digits.length < 6) {
          toast.warning('Selecciona un contacto o escribe un número de teléfono válido.');
          return;
        }
        if (!state.direct.contenido.trim()) {
          toast.warning('Escribe o selecciona el contenido del mensaje a enviar.');
          msgTextarea.focus();
          return;
        }

        const resolvedMessage = resolveDynamicMessage(state.direct.contenido, eff);
        const selectedTpl = state.templates.find(
          (x) => String(x.id) === String(state.direct.templateId)
        );

        btnInstance.setLoading(true);
        try {
          await apiFetch('/api/difusion-mensajes', {
            method: 'POST',
            body: JSON.stringify({
              tipo: 'Mensaje',
              contactoOrigen: eff.origen || 'Manual',
              nombreDestinatario: eff.nombre || '—',
              telefonoDestinatario: digits,
              plantillaTitulo: selectedTpl?.titulo || '',
              contenido: resolvedMessage,
              adjuntoNombre: state.direct.attachment?.nombre || '',
              adjuntoFormato: state.direct.attachment?.formato || '',
              adjuntoMime: state.direct.attachment?.mime || '',
              adjuntoData: state.direct.attachment?.data || '',
              estado: 'Enviado',
            }),
          });
          toast.success(`Mensaje enviado y registrado en el Historial (${digits}).`);
          state.direct.contenido = '';
          state.direct.templateId = '';
          state.direct.attachment = null;
          render();
        } catch (err) {
          toast.error(err.message || 'No se pudo guardar el mensaje en la base de datos.');
        } finally {
          btnInstance.setLoading(false);
        }
      },
    });

    footer.appendChild(sendBtn);
    card.appendChild(footer);
    parent.appendChild(card);
  }

  // ============================================================================
  // PESTAÑA 2: DIFUSIÓN (Campaña de Difusión Masiva Programable — Foto 2)
  // ============================================================================
  function renderBroadcastTab(parent) {
    const card = document.createElement('section');
    card.className =
      'w-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs space-y-5';

    function getManualPhoneList() {
      const raw = String(state.broadcast.manualNumbersText || '');
      const parts = raw
        .split(/[\n,;]+/)
        .map((s) => normalizeDigits(s))
        .filter((d) => d.length >= 6);
      // Sin duplicados
      return Array.from(new Set(parts));
    }

    function getTotalRecipientsCount() {
      const selectedPhones = new Set();
      state.contacts.forEach((c) => {
        if (state.broadcast.selectedKeys.has(c.key)) {
          selectedPhones.add(normalizeDigits(c.telefono));
        }
      });
      getManualPhoneList().forEach((d) => selectedPhones.add(d));
      return selectedPhones.size;
    }

    // Cabecera con contador de destinatarios
    const header = document.createElement('div');
    header.className =
      'flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800';

    const countBadge = document.createElement('span');
    countBadge.className =
      'inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-brand-soft dark:bg-brand/20 text-brand';

    function updateHeaderBadge() {
      countBadge.textContent = `${getTotalRecipientsCount()} destinatarios seleccionados`;
    }
    updateHeaderBadge();

    header.innerHTML = `
      <div class="flex items-start gap-3">
        <span class="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
          <i class="fa-solid fa-bullhorn text-sm"></i>
        </span>
        <div>
          <h2 class="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
            Campaña de Difusión Masiva Programable
          </h2>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            Envíe campañas masivas a múltiples números, a todos los clientes, todos los proveedores o ambos con intervalo personalizable.
          </p>
        </div>
      </div>
    `;
    header.appendChild(countBadge);
    card.appendChild(header);

    // Barra de Progreso en Vivo de la Difusión en curso (Tarea de Fondo)
    const liveProgressHolder = document.createElement('div');
    card.appendChild(liveProgressHolder);

    subscribeQueue((snap) => {
      liveProgressHolder.innerHTML = '';
      const b = snap.broadcast;
      if (!b.active && !(b.completed && b.total > 0)) return;

      const progCard = document.createElement('div');
      progCard.className =
        'w-full rounded-xl bg-brand-soft/60 dark:bg-brand/15 border border-brand/30 p-4 space-y-2.5';
      progCard.innerHTML = `
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <span class="w-8 h-8 rounded-lg bg-brand text-white flex items-center justify-center shrink-0">
              <i class="fa-solid ${b.active ? 'fa-bullhorn fa-beat-fade' : 'fa-check-double'} text-xs"></i>
            </span>
            <div>
              <p class="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                ${
                  b.active
                    ? 'Difusión en Curso (Tarea de Fondo Activa)'
                    : 'Campaña de Difusión Completada'
                }
              </p>
              <p class="text-[11px] text-slate-500 dark:text-slate-300">
                ${
                  b.active
                    ? `Enviando a: ${escapeHtml(b.currentRecipient)} · Próximo mensaje en ${b.secondsToNext}s`
                    : `Se enviaron todos los mensajes correctamente.`
                }
              </p>
            </div>
          </div>
          <div class="text-right">
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand text-white text-xs font-bold">
              <span>${b.sent} de ${b.total} personas (${b.progressPercent}%)</span>
            </span>
          </div>
        </div>
        <div class="w-full h-3 rounded-full bg-white/90 dark:bg-slate-800 border border-brand/20 overflow-hidden">
          <div class="h-full bg-brand transition-all duration-300 rounded-full" style="width: ${b.progressPercent}%"></div>
        </div>
        <div class="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
          <span><i class="fa-solid fa-circle-info text-brand mr-1"></i>Puedes cambiar de módulo y seguir usando el sistema; el conteo continúa arriba junto a <strong>WhatsApp Online</strong>.</span>
          ${
            !b.active && b.completed
              ? '<button type="button" id="close-broadcast-prog" class="text-brand font-semibold hover:underline cursor-pointer">Ocultar barra</button>'
              : ''
          }
        </div>
      `;

      progCard.querySelector('#close-broadcast-prog')?.addEventListener('click', () => {
        clearCompletedBroadcastBanner();
      });

      liveProgressHolder.appendChild(progCard);
    });

    // Bloque 1: Temporizador / Intervalo entre mensajes personalizable
    const timerBox = document.createElement('div');
    timerBox.className =
      'w-full rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/30 p-4 space-y-3';

    const timerTop = document.createElement('div');
    timerTop.className = 'flex flex-wrap items-center justify-between gap-2';
    timerTop.innerHTML = `
      <label class="text-xs font-bold text-slate-800 dark:text-slate-100">
        Temporizador / Intervalo entre mensajes <span class="text-danger">*</span> (Personalizable)
      </label>
      <span class="text-[11px] font-semibold text-brand inline-flex items-center gap-1">
        <i class="fa-regular fa-clock"></i>
        <span>Protección anti-bloqueo obligatoria</span>
      </span>
    `;

    const timerControls = document.createElement('div');
    timerControls.className = 'flex flex-wrap items-center gap-3';

    const intervalInput = document.createElement('input');
    intervalInput.type = 'number';
    intervalInput.min = '1';
    intervalInput.value = String(state.broadcast.intervalValue);
    intervalInput.className =
      'w-24 min-h-[40px] px-3 py-1.5 text-center text-sm font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand';

    const unitSelect = document.createElement('select');
    unitSelect.className =
      'min-h-[40px] px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand';
    [
      { value: 'segundos', label: 'Segundos (mín. recomendado 30s)' },
      { value: 'minutos', label: 'Minutos' },
    ].forEach((u) => {
      const o = document.createElement('option');
      o.value = u.value;
      o.textContent = u.label;
      unitSelect.appendChild(o);
    });
    unitSelect.value = state.broadcast.intervalUnit;

    const timerStatusText = document.createElement('span');
    timerStatusText.className = 'text-xs font-semibold text-emerald-600 dark:text-emerald-400';

    function updateTimerStatus() {
      const val = Math.max(1, Number(intervalInput.value) || 30);
      state.broadcast.intervalValue = val;
      state.broadcast.intervalUnit = unitSelect.value;
      const unitLabel = unitSelect.value === 'minutos' ? 'minuto(s)' : 'segundos';
      timerStatusText.textContent = `Retardo configurado: ${val} ${unitLabel} entre cada envío.`;
    }
    intervalInput.addEventListener('input', updateTimerStatus);
    unitSelect.addEventListener('change', updateTimerStatus);
    updateTimerStatus();

    timerControls.append(intervalInput, unitSelect, timerStatusText);
    timerBox.append(timerTop, timerControls);
    card.appendChild(timerBox);

    // Bloque 2: Destinatarios del Registro (Todos los Clientes | Todos los Proveedores | Ambos | Buscador múltiple sin duplicados)
    const recipientsBox = document.createElement('div');
    recipientsBox.className =
      'w-full rounded-xl border border-slate-200/80 dark:border-slate-800 p-4 space-y-3.5';

    const recHeader = document.createElement('div');
    recHeader.className = 'flex flex-wrap items-center justify-between gap-2';
    recHeader.innerHTML = `
      <label class="text-xs font-bold text-slate-800 dark:text-slate-100">
        Destinatarios del Registro (Clientes y Proveedores):
      </label>
    `;

    const quickGroupBtns = document.createElement('div');
    quickGroupBtns.className = 'flex flex-wrap items-center gap-2';

    const selectAllCliBtn = createButton({
      text: 'Todos los Clientes',
      icon: 'fa-solid fa-users',
      variant: 'primary',
      size: 'sm',
      onClick: () => {
        state.contacts
          .filter((c) => c.origen === 'Cliente')
          .forEach((c) => state.broadcast.selectedKeys.add(c.key));
        render();
      },
    });

    const selectAllProvBtn = createButton({
      text: 'Todos los Proveedores',
      icon: 'fa-solid fa-truck-field',
      variant: 'primary',
      size: 'sm',
      onClick: () => {
        state.contacts
          .filter((c) => c.origen === 'Proveedor')
          .forEach((c) => state.broadcast.selectedKeys.add(c.key));
        render();
      },
    });

    const selectBothBtn = createButton({
      text: 'Seleccionar Ambos (Todos)',
      icon: 'fa-solid fa-check-double',
      variant: 'primary',
      size: 'sm',
      onClick: () => {
        state.contacts.forEach((c) => state.broadcast.selectedKeys.add(c.key));
        render();
      },
    });

    const clearAllBtn = createButton({
      text: 'Deseleccionar',
      variant: 'cancel',
      size: 'sm',
      onClick: () => {
        state.broadcast.selectedKeys.clear();
        render();
      },
    });

    quickGroupBtns.append(selectAllCliBtn, selectAllProvBtn, selectBothBtn, clearAllBtn);
    recHeader.appendChild(quickGroupBtns);
    recipientsBox.appendChild(recHeader);

    // Barra violeta suave "Todos — Enviar a todos los contactos del registro"
    const allCheckStrip = document.createElement('label');
    allCheckStrip.className =
      'w-full px-4 py-2.5 rounded-xl bg-brand-soft/60 dark:bg-brand/15 border border-brand/20 flex items-center justify-between gap-3 cursor-pointer select-none';

    const allChecked =
      state.contacts.length > 0 &&
      state.contacts.every((c) => state.broadcast.selectedKeys.has(c.key));

    allCheckStrip.innerHTML = `
      <div class="flex items-center gap-2.5">
        <input type="checkbox" id="broadcast-all-check" ${
          allChecked ? 'checked' : ''
        } class="w-4 h-4 rounded accent-brand cursor-pointer" />
        <span class="text-xs font-semibold text-brand">
          Todos — Enviar a todos los contactos del registro (Clientes y Proveedores)
        </span>
      </div>
      <span class="text-[11px] font-semibold text-brand">
        (${state.contacts.length} contactos con teléfono)
      </span>
    `;

    allCheckStrip.querySelector('#broadcast-all-check')?.addEventListener('change', (e) => {
      if (e.target.checked) {
        state.contacts.forEach((c) => state.broadcast.selectedKeys.add(c.key));
      } else {
        state.broadcast.selectedKeys.clear();
      }
      render();
    });
    recipientsBox.appendChild(allCheckStrip);

    // Buscador para seleccionar varios Clientes / Proveedores a la vez (impide seleccionar doble)
    const multiSearchWrap = document.createElement('div');
    multiSearchWrap.className = 'relative';

    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder =
      'Filtrar por nombre, documento/RUC o teléfono para agregar destinatarios...';
    searchInput.className =
      'w-full min-h-[40px] px-3.5 py-2 text-xs sm:text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand';

    const searchResultsBox = document.createElement('div');
    searchResultsBox.className =
      'max-h-48 overflow-y-auto rounded-xl border border-slate-200/80 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900 mt-2';

    function renderSelectableContactsList(qText) {
      searchResultsBox.innerHTML = '';
      const q = String(qText || '').trim().toLowerCase();
      const filtered = state.contacts.filter(
        (c) =>
          !q ||
          c.nombre.toLowerCase().includes(q) ||
          c.documento.toLowerCase().includes(q) ||
          c.telefono.toLowerCase().includes(q) ||
          c.origen.toLowerCase().includes(q)
      );

      if (filtered.length === 0) {
        searchResultsBox.innerHTML = `
          <div class="px-4 py-3 text-xs text-slate-400">
            No hay contactos que coincidan con "${escapeHtml(qText)}".
          </div>
        `;
        return;
      }

      filtered.forEach((c) => {
        const isSelected = state.broadcast.selectedKeys.has(c.key);
        const row = document.createElement('div');
        row.className = `px-3.5 py-2 flex items-center justify-between gap-3 text-xs transition-colors ${
          isSelected
            ? 'bg-brand-soft/40 dark:bg-brand/10'
            : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
        }`;

        row.innerHTML = `
          <div class="flex items-center gap-2.5 min-w-0">
            <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
              c.origen === 'Proveedor'
                ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                : 'bg-brand-soft dark:bg-brand/20 text-brand'
            }">${c.origen}</span>
            <span class="font-bold text-slate-800 dark:text-slate-100 truncate">${escapeHtml(
              c.nombre
            )}</span>
            <span class="text-slate-400 truncate">(${escapeHtml(c.documento)})</span>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <span class="text-emerald-600 dark:text-emerald-400 font-semibold">${escapeHtml(
              c.telefono
            )}</span>
          </div>
        `;

        const actionBtn = createButton({
          text: isSelected ? 'Ya seleccionado' : 'Seleccionar',
          icon: isSelected ? 'fa-solid fa-check' : 'fa-solid fa-plus',
          variant: isSelected ? 'cancel' : 'primary',
          size: 'sm',
          disabled: isSelected,
          onClick: () => {
            if (state.broadcast.selectedKeys.has(c.key)) {
              toast.info('Este contacto ya está seleccionado en la difusión.');
              return;
            }
            // Verificar que no exista otro contacto con el mismo número exacto ya seleccionado
            const candidateDigits = normalizeDigits(c.telefono);
            const duplicatePhone = Array.from(state.broadcast.selectedKeys).some((k) => {
              const ex = state.contacts.find((item) => item.key === k);
              return ex && normalizeDigits(ex.telefono) === candidateDigits;
            });
            if (duplicatePhone) {
              toast.warning(
                `El número ${c.telefono} ya fue agregado en la lista de seleccionados.`
              );
              return;
            }
            state.broadcast.selectedKeys.add(c.key);
            render();
          },
        });

        row.querySelector('.shrink-0')?.appendChild(actionBtn);
        searchResultsBox.appendChild(row);
      });
    }

    searchInput.addEventListener('input', (e) => renderSelectableContactsList(e.target.value));
    renderSelectableContactsList('');

    multiSearchWrap.append(searchInput, searchResultsBox);
    recipientsBox.appendChild(multiSearchWrap);

    // Vista de a quiénes ya se seleccionó (con opción de quitar individualmente)
    const selectedPreviewWrap = document.createElement('div');
    selectedPreviewWrap.className = 'space-y-2 pt-1';

    const selectedItems = state.contacts.filter((c) => state.broadcast.selectedKeys.has(c.key));
    selectedPreviewWrap.innerHTML = `
      <div class="flex items-center justify-between">
        <span class="text-xs font-bold text-slate-700 dark:text-slate-200">
          Contactos Seleccionados (${selectedItems.length}):
        </span>
        <span class="text-[11px] text-slate-400">No se permiten números duplicados</span>
      </div>
    `;

    const chipsBox = document.createElement('div');
    chipsBox.className =
      'min-h-[44px] p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 flex flex-wrap items-center gap-2';

    if (selectedItems.length === 0) {
      chipsBox.innerHTML = `<span class="text-xs text-slate-400 italic">Aún no has seleccionado contactos del registro. Usa el buscador o los botones de arriba.</span>`;
    } else {
      selectedItems.forEach((c) => {
        const chip = document.createElement('span');
        chip.className =
          'inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white dark:bg-slate-900 border border-brand/30 text-xs font-semibold text-slate-800 dark:text-slate-100 shadow-2xs';
        chip.innerHTML = `
          <span class="text-[10px] font-bold uppercase text-brand">${c.origen}:</span>
          <span>${escapeHtml(c.nombre)}</span>
          <span class="text-emerald-600 dark:text-emerald-400 font-mono text-[11px]">${escapeHtml(
            c.telefono
          )}</span>
          <button type="button" class="text-slate-400 hover:text-danger cursor-pointer" title="Quitar de la selección">
            <i class="fa-solid fa-xmark"></i>
          </button>
        `;
        chip.querySelector('button')?.addEventListener('click', () => {
          state.broadcast.selectedKeys.delete(c.key);
          render();
        });
        chipsBox.appendChild(chip);
      });
    }

    selectedPreviewWrap.appendChild(chipsBox);
    recipientsBox.appendChild(selectedPreviewWrap);

    // Números Adicionales Manuales (separados por coma o salto de línea + selector rápido con código de país)
    const manualNumbersSection = document.createElement('div');
    manualNumbersSection.className =
      'pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2.5';

    const quickAddRow = document.createElement('div');
    quickAddRow.className = 'grid grid-cols-1 sm:grid-cols-12 gap-3 items-end';

    const quickPhoneWrap = document.createElement('div');
    quickPhoneWrap.className = 'sm:col-span-8';
    const quickPhoneComp = createPhoneInput({
      label: 'Agregar Número Adicional Rápido (con selector de país):',
      initialCode: state.broadcast.extraPhoneCode || '+595',
      initialNumber: state.broadcast.extraPhoneNum || '',
      placeholder: 'Ej. 981 223 344',
      onChange: (val) => {
        state.broadcast.extraPhoneCode = val.code;
        state.broadcast.extraPhoneNum = val.number;
      },
    });
    quickPhoneWrap.appendChild(quickPhoneComp.element);

    const quickAddBtnWrap = document.createElement('div');
    quickAddBtnWrap.className = 'sm:col-span-4';
    const manualTextarea = document.createElement('textarea');

    const addExtraNumBtn = createButton({
      text: 'Agregar a Números Adicionales',
      icon: 'fa-solid fa-plus',
      variant: 'primary',
      size: 'md',
      className: 'w-full',
      onClick: () => {
        const digits = normalizeDigits(quickPhoneComp.getFullNumber());
        if (digits.length < 8) {
          toast.warning('Ingresa un número adicional válido.');
          return;
        }
        const currentList = getManualPhoneList();
        if (currentList.includes(digits)) {
          toast.warning('Ese número adicional ya está en la lista.');
          return;
        }
        currentList.push(digits);
        state.broadcast.manualNumbersText = currentList.join(', ');
        state.broadcast.extraPhoneNum = '';
        manualTextarea.value = state.broadcast.manualNumbersText;
        updateHeaderBadge();
        toast.success(`Número ${digits} agregado a la difusión.`);
      },
    });
    quickAddBtnWrap.appendChild(addExtraNumBtn);
    quickAddRow.append(quickPhoneWrap, quickAddBtnWrap);

    const manualLabel = document.createElement('label');
    manualLabel.className = 'block text-xs font-semibold text-slate-700 dark:text-slate-200';
    manualLabel.textContent =
      'Números Adicionales Manuales (Opcional, separados por coma o salto de línea):';

    manualTextarea.rows = 2;
    manualTextarea.placeholder = 'Ejemplo: 595981223344, 595971998877';
    manualTextarea.value = state.broadcast.manualNumbersText;
    manualTextarea.className =
      'w-full px-3.5 py-2 text-xs sm:text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand';
    manualTextarea.addEventListener('input', (e) => {
      state.broadcast.manualNumbersText = e.target.value;
      updateHeaderBadge();
    });

    manualNumbersSection.append(quickAddRow, manualLabel, manualTextarea);
    recipientsBox.appendChild(manualNumbersSection);
    card.appendChild(recipientsBox);

    // Bloque 3: Cargar Mensaje Predeterminado (Plantilla)
    const tplGroup = document.createElement('div');
    tplGroup.className = 'space-y-1.5';
    tplGroup.innerHTML = `
      <div class="flex flex-wrap items-center justify-between gap-2">
        <label class="text-xs font-semibold text-slate-700 dark:text-slate-200">
          Cargar Mensaje Predeterminado (Plantilla):
        </label>
        <span class="text-[11px] italic text-slate-400">
          Personaliza {nombre} para cada cliente según su ficha
        </span>
      </div>
    `;

    const tplSelect = document.createElement('select');
    tplSelect.className =
      'w-full min-h-[42px] px-3.5 py-2 text-xs sm:text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand';
    const defOpt = document.createElement('option');
    defOpt.value = '';
    defOpt.textContent = '-- Seleccione una plantilla para autocompletar --';
    tplSelect.appendChild(defOpt);

    state.templates.forEach((t) => {
      const o = document.createElement('option');
      o.value = String(t.id);
      o.textContent = `[${t.categoria}] ${t.titulo}`;
      tplSelect.appendChild(o);
    });
    tplSelect.value = state.broadcast.templateId;

    const broadcastTextarea = document.createElement('textarea');
    const broadcastPreviewHolder = document.createElement('div');

    function refreshBroadcastPreview() {
      broadcastPreviewHolder.innerHTML = '';
      const sampleContact =
        selectedItems[0] ||
        state.contacts[0] || {
          nombre: 'Justo Ledesma',
          telefono: '+595986901117',
          documento: '4564525',
          ciudad: 'CDE',
          empresa: 'NETZ',
          productos: 'Productos R1',
          cantidad_productos: '12',
        };
      broadcastPreviewHolder.appendChild(
        renderWhatsAppSimulationBox({
          text: state.broadcast.contenido,
          contact: sampleContact,
          attachment: state.broadcast.attachment,
        })
      );
    }

    tplSelect.addEventListener('change', (e) => {
      state.broadcast.templateId = e.target.value;
      if (!state.broadcast.templateId) {
        state.broadcast.contenido = '';
        broadcastTextarea.value = '';
      } else {
        const found = state.templates.find((x) => String(x.id) === state.broadcast.templateId);
        if (found) {
          state.broadcast.contenido = found.contenido || '';
          broadcastTextarea.value = state.broadcast.contenido;
        }
      }
      refreshBroadcastPreview();
    });

    tplGroup.appendChild(tplSelect);
    card.appendChild(tplGroup);

    // Bloque 4: Contenido del Mensaje a Difundir *
    const contentGroup = document.createElement('div');
    contentGroup.className = 'space-y-2';

    const contentTop = document.createElement('div');
    contentTop.className = 'flex flex-wrap items-center justify-between gap-2';
    const contentLabel = document.createElement('label');
    contentLabel.className = 'text-xs font-semibold text-slate-700 dark:text-slate-200';
    contentLabel.innerHTML = `Contenido del Mensaje a Difundir <span class="text-danger">*</span>`;

    broadcastTextarea.rows = 4;
    broadcastTextarea.placeholder =
      'Escriba aquí el mensaje para la campaña masiva. La variable {nombre} se reemplazará automáticamente por el nombre de cada contacto...';
    broadcastTextarea.value = state.broadcast.contenido;
    broadcastTextarea.className =
      'w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand resize-y';

    const toolbar = createComposerToolbar(broadcastTextarea, (val) => {
      state.broadcast.contenido = val;
      refreshBroadcastPreview();
    });

    broadcastTextarea.addEventListener('input', (e) => {
      state.broadcast.contenido = e.target.value;
      refreshBroadcastPreview();
    });

    contentTop.append(contentLabel, toolbar);
    contentGroup.append(contentTop, broadcastTextarea);
    card.appendChild(contentGroup);

    // Bloque 5: Adjuntar Imagen, Video o PDF (con opción de archivo o URL como en Foto 2)
    const mediaPicker = createMediaAttachmentInput({
      label: 'Archivo Adjunto (Opcional — Imagen, Video, PDF o URL):',
      allowUrlInput: true,
      initialValue: state.broadcast.attachment,
      onChange: (att) => {
        state.broadcast.attachment = att;
        refreshBroadcastPreview();
      },
    });
    card.appendChild(mediaPicker.element);

    // Vista Previa en WhatsApp
    const prevSection = document.createElement('div');
    prevSection.className = 'space-y-2';
    prevSection.innerHTML = `
      <label class="block text-xs font-semibold text-slate-700 dark:text-slate-200">
        Vista Previa en WhatsApp:
      </label>
    `;
    refreshBroadcastPreview();
    prevSection.appendChild(broadcastPreviewHolder);
    card.appendChild(prevSection);

    // Botón "Iniciar Difusión en Cola"
    const footer = document.createElement('div');
    footer.className = 'flex items-center justify-end pt-2';

    const startBroadcastBtn = createButton({
      text: 'Iniciar Difusión en Cola',
      icon: 'fa-regular fa-paper-plane',
      variant: 'primary',
      size: 'md',
      onClick: async (_, btnInstance) => {
        if (!state.broadcast.contenido.trim()) {
          toast.warning('Ingresa o selecciona el contenido del mensaje a difundir.');
          broadcastTextarea.focus();
          return;
        }

        const intervalSecs =
          state.broadcast.intervalUnit === 'minutos'
            ? (Number(state.broadcast.intervalValue) || 1) * 60
            : Number(state.broadcast.intervalValue) || 30;

        const selectedTpl = state.templates.find(
          (x) => String(x.id) === String(state.broadcast.templateId)
        );

        const batchItems = [];
        const usedPhones = new Set();

        state.contacts.forEach((c) => {
          if (!state.broadcast.selectedKeys.has(c.key)) return;
          const clean = normalizeDigits(c.telefono);
          if (!clean || usedPhones.has(clean)) return;
          usedPhones.add(clean);
          batchItems.push({
            tipo: 'Difusión',
            contactoOrigen: c.origen,
            nombreDestinatario: c.nombre || '—',
            telefonoDestinatario: clean,
            plantillaTitulo: selectedTpl?.titulo || '',
            contenido: resolveDynamicMessage(state.broadcast.contenido, c),
            adjuntoNombre: state.broadcast.attachment?.nombre || '',
            adjuntoFormato: state.broadcast.attachment?.formato || '',
            adjuntoMime: state.broadcast.attachment?.mime || '',
            adjuntoData: state.broadcast.attachment?.data || '',
            intervaloSegundos: intervalSecs,
            estado: 'Enviado',
          });
        });

        getManualPhoneList().forEach((clean) => {
          if (usedPhones.has(clean)) return;
          usedPhones.add(clean);
          batchItems.push({
            tipo: 'Difusión',
            contactoOrigen: 'Manual',
            nombreDestinatario: '—',
            telefonoDestinatario: clean,
            plantillaTitulo: selectedTpl?.titulo || '',
            contenido: resolveDynamicMessage(state.broadcast.contenido, {
              nombre: 'Cliente',
              telefono: `+${clean}`,
              documento: '—',
              ciudad: 'Paraguay',
              empresa: 'Particular',
              productos: 'Productos R1',
              cantidad_productos: '1',
            }),
            adjuntoNombre: state.broadcast.attachment?.nombre || '',
            adjuntoFormato: state.broadcast.attachment?.formato || '',
            adjuntoMime: state.broadcast.attachment?.mime || '',
            adjuntoData: state.broadcast.attachment?.data || '',
            intervaloSegundos: intervalSecs,
            estado: 'Enviado',
          });
        });

        if (batchItems.length === 0) {
          toast.warning(
            'Selecciona al menos un Cliente/Proveedor o agrega números manuales para iniciar la difusión.'
          );
          return;
        }

        btnInstance.setLoading(true);
        try {
          await startBroadcastJob({
            items: batchItems,
            intervalSeconds: intervalSecs,
          });
          toast.info(
            `Difusión en curso en segundo plano (1 de ${batchItems.length} enviado). Puedes seguir usando cualquier módulo.`
          );
          state.broadcast.selectedKeys.clear();
          state.broadcast.manualNumbersText = '';
          state.broadcast.contenido = '';
          state.broadcast.templateId = '';
          state.broadcast.attachment = null;
          render();
        } catch (err) {
          toast.error(err.message || 'No se pudo registrar la difusión en la base de datos.');
        } finally {
          btnInstance.setLoading(false);
        }
      },
    });

    footer.appendChild(startBroadcastBtn);
    card.appendChild(footer);
    parent.appendChild(card);
  }

  // ============================================================================
  // PESTAÑA 3: PROGRAMAR (Programar Envío Automático — Foto 3)
  // ============================================================================
  function renderScheduleTab(parent) {
    const card = document.createElement('section');
    card.className =
      'w-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs space-y-5';

    const header = document.createElement('div');
    header.className =
      'flex items-start gap-3 pb-4 border-b border-slate-100 dark:border-slate-800';
    header.innerHTML = `
      <span class="w-9 h-9 rounded-xl bg-brand-soft dark:bg-brand/20 text-brand flex items-center justify-center shrink-0">
        <i class="fa-regular fa-clock text-sm"></i>
      </span>
      <div>
        <h2 class="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
          Programar Envío Automático
        </h2>
        <p class="text-xs text-slate-500 dark:text-slate-400">
          Programe el envío automático de un mensaje a un cliente o proveedor usando un temporizador (timer), una hora específica de hoy o una fecha y hora determinada.
        </p>
      </div>
    `;
    card.appendChild(header);

    // Barra de Cuenta Regresiva en Vivo para Mensajes Programados en segundo plano
    const liveSchedHolder = document.createElement('div');
    card.appendChild(liveSchedHolder);

    subscribeQueue((snap) => {
      liveSchedHolder.innerHTML = '';
      if (!snap.scheduled || snap.scheduled.length === 0) return;

      const box = document.createElement('div');
      box.className =
        'w-full rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 p-4 space-y-3';

      const topRow = document.createElement('div');
      topRow.className = 'flex flex-wrap items-center justify-between gap-2';
      topRow.innerHTML = `
        <div class="flex items-center gap-2">
          <span class="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0">
            <i class="fa-regular fa-clock text-xs"></i>
          </span>
          <div>
            <p class="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
              Mensajes Programados en Segundo Plano (${snap.scheduled.length})
            </p>
            <p class="text-[11px] text-slate-500 dark:text-slate-300">
              Puedes seguir usando el sistema en otros módulos; el tiempo restante también se muestra arriba junto a <strong>WhatsApp Online</strong>.
            </p>
          </div>
        </div>
      `;
      box.appendChild(topRow);

      const listWrap = document.createElement('div');
      listWrap.className = 'space-y-2';

      snap.scheduled.forEach((s) => {
        const dest =
          s.nombreDestinatario && s.nombreDestinatario !== '—'
            ? `${s.nombreDestinatario} (${s.telefonoDestinatario})`
            : s.telefonoDestinatario;

        const itemEl = document.createElement('div');
        itemEl.className =
          'p-3 rounded-lg bg-white dark:bg-slate-900 border border-amber-200/60 dark:border-amber-800/50 space-y-1.5';
        itemEl.innerHTML = `
          <div class="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span class="font-bold text-slate-800 dark:text-slate-100">
              <i class="fa-brands fa-whatsapp text-emerald-500 mr-1"></i>
              Destinatario: ${escapeHtml(dest)}
            </span>
            <span class="px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 font-bold">
              Falta: ${formatRemainingDuration(s.remainingSeconds)}
            </span>
          </div>
          <div class="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div class="h-full bg-amber-500 transition-all duration-300 rounded-full" style="width: ${s.progressPercent}%"></div>
          </div>
        `;
        listWrap.appendChild(itemEl);
      });

      box.appendChild(listWrap);
      liveSchedHolder.appendChild(box);
    });

    // Selección de Contacto (Buscador con vista previa de 3 + Teléfono directo con código de país)
    const contactGrid = document.createElement('div');
    contactGrid.className = 'grid grid-cols-1 lg:grid-cols-12 gap-4 items-start';

    const searchCol = document.createElement('div');
    searchCol.className = 'lg:col-span-7 space-y-1.5';
    searchCol.innerHTML = `
      <label class="block text-xs font-semibold text-slate-700 dark:text-slate-200">
        Seleccionar Contacto del Registro de Clientes o Proveedores <span class="text-danger">*</span>
      </label>
    `;

    const manualCol = document.createElement('div');
    manualCol.className = 'lg:col-span-5 space-y-1.5';

    let schedPhoneComp = null;

    function getEffectiveScheduleContact() {
      const fullPhone = schedPhoneComp
        ? schedPhoneComp.getFullNumber()
        : `${state.schedule.phoneCode}${state.schedule.phoneNumber}`;
      const cleanDigits = normalizeDigits(fullPhone);
      if (state.schedule.selectedContact) {
        return {
          ...state.schedule.selectedContact,
          telefono: cleanDigits ? `+${cleanDigits}` : state.schedule.selectedContact.telefono,
        };
      }
      return {
        origen: 'Manual',
        nombre: '—',
        telefono: cleanDigits ? `+${cleanDigits}` : '',
        documento: '—',
        ciudad: 'Paraguay',
        empresa: 'Particular',
        productos: 'Productos R1',
        cantidad_productos: '1',
      };
    }

    const schedPreviewContainer = document.createElement('div');
    function refreshSchedulePreview() {
      schedPreviewContainer.innerHTML = '';
      schedPreviewContainer.appendChild(
        renderWhatsAppSimulationBox({
          text: state.schedule.contenido,
          contact: getEffectiveScheduleContact(),
          attachment: state.schedule.attachment,
        })
      );
    }

    schedPhoneComp = createPhoneInput({
      label: 'Número de Teléfono / WhatsApp (o escribir directo):',
      required: true,
      initialCode: state.schedule.phoneCode || '+595',
      initialNumber: state.schedule.phoneNumber || '',
      placeholder: 'Ej. 986 901 117 (sin 0)',
      onChange: (val) => {
        state.schedule.phoneCode = val.code;
        state.schedule.phoneNumber = val.number;
        refreshSchedulePreview();
      },
    });
    manualCol.appendChild(schedPhoneComp.element);

    const picker = createContactSearchPicker({
      contacts: state.contacts,
      selectedContact: state.schedule.selectedContact,
      onSelect: (c) => {
        state.schedule.selectedContact = c;
        if (c) {
          state.schedule.phoneCode = c.telefonoCodigo || '+595';
          state.schedule.phoneNumber =
            c.telefonoNumero || normalizeDigits(c.telefono).replace(/^595/, '');
          render();
        } else {
          refreshSchedulePreview();
        }
      },
    });
    searchCol.appendChild(picker.element);

    contactGrid.append(searchCol, manualCol);
    card.appendChild(contactGrid);

    // Mensaje Predeterminado (Plantilla)
    const tplGroup = document.createElement('div');
    tplGroup.className = 'space-y-1.5';
    tplGroup.innerHTML = `
      <div class="flex flex-wrap items-center justify-between gap-2">
        <label class="text-xs font-semibold text-slate-700 dark:text-slate-200">
          Mensaje Predeterminado (Plantilla)
        </label>
        <span class="text-[11px] italic text-slate-400">
          Carga el nombre del cliente y puede editar antes de programar
        </span>
      </div>
    `;

    const tplSelect = document.createElement('select');
    tplSelect.className =
      'w-full min-h-[42px] px-3.5 py-2 text-xs sm:text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand';
    const emptyOpt = document.createElement('option');
    emptyOpt.value = '';
    emptyOpt.textContent = '-- Redactar mensaje nuevo libremente --';
    tplSelect.appendChild(emptyOpt);

    state.templates.forEach((t) => {
      const o = document.createElement('option');
      o.value = String(t.id);
      o.textContent = `[${t.categoria}] ${t.titulo}`;
      tplSelect.appendChild(o);
    });
    tplSelect.value = state.schedule.templateId;

    const schedTextarea = document.createElement('textarea');
    const charCountEl = document.createElement('span');

    tplSelect.addEventListener('change', (e) => {
      state.schedule.templateId = e.target.value;
      if (!state.schedule.templateId) {
        state.schedule.contenido = '';
        schedTextarea.value = '';
      } else {
        const found = state.templates.find((x) => String(x.id) === state.schedule.templateId);
        if (found) {
          state.schedule.contenido = found.contenido || '';
          schedTextarea.value = state.schedule.contenido;
        }
      }
      charCountEl.textContent = `${schedTextarea.value.length} caracteres`;
      refreshSchedulePreview();
    });

    tplGroup.appendChild(tplSelect);
    card.appendChild(tplGroup);

    // Contenido del Mensaje *
    const contentGroup = document.createElement('div');
    contentGroup.className = 'space-y-2';

    const contentTop = document.createElement('div');
    contentTop.className = 'flex flex-wrap items-center justify-between gap-2';
    const contentLabel = document.createElement('label');
    contentLabel.className = 'text-xs font-semibold text-slate-700 dark:text-slate-200';
    contentLabel.innerHTML = `Contenido del Mensaje <span class="text-danger">*</span>`;

    schedTextarea.rows = 4;
    schedTextarea.placeholder = 'Escriba aquí el mensaje a programar...';
    schedTextarea.value = state.schedule.contenido;
    schedTextarea.className =
      'w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand resize-y';

    const toolbar = createComposerToolbar(schedTextarea, (val) => {
      state.schedule.contenido = val;
      charCountEl.textContent = `${val.length} caracteres`;
      refreshSchedulePreview();
    });

    schedTextarea.addEventListener('input', (e) => {
      state.schedule.contenido = e.target.value;
      charCountEl.textContent = `${e.target.value.length} caracteres`;
      refreshSchedulePreview();
    });

    const helperRow = document.createElement('div');
    helperRow.className = 'flex items-center justify-between text-[11px] text-slate-400';
    charCountEl.textContent = `${(state.schedule.contenido || '').length} caracteres`;
    helperRow.innerHTML = `<span>Puede usar la etiqueta <code class="text-brand font-semibold">{nombre}</code> para personalizar.</span>`;
    helperRow.appendChild(charCountEl);

    contentTop.append(contentLabel, toolbar);
    contentGroup.append(contentTop, schedTextarea, helperRow);
    card.appendChild(contentGroup);

    // Adjuntar Imagen, Video o PDF
    const mediaPicker = createMediaAttachmentInput({
      label: 'Adjuntar Imagen, Video o PDF al Mensaje Programado (Opcional):',
      allowUrlInput: true,
      initialValue: state.schedule.attachment,
      onChange: (att) => {
        state.schedule.attachment = att;
        refreshSchedulePreview();
      },
    });
    card.appendChild(mediaPicker.element);

    // Bloque: OPCIONES DE PROGRAMACIÓN DE ENVÍO (Foto 3)
    const schedOptionsBox = document.createElement('div');
    schedOptionsBox.className =
      'w-full rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 p-4 space-y-4';

    const schedBoxTop = document.createElement('div');
    schedBoxTop.className = 'flex flex-wrap items-center justify-between gap-2';

    const summaryPill = document.createElement('span');
    summaryPill.className =
      'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-brand-soft dark:bg-brand/20 text-brand';

    function updateScheduleSummaryPill() {
      if (state.schedule.mode === 'timer') {
        summaryPill.innerHTML = `<i class="fa-solid fa-hourglass-half text-[11px]"></i><span>Se enviará en ${state.schedule.timerMinutes} minutos</span>`;
      } else if (state.schedule.mode === 'today_time') {
        summaryPill.innerHTML = `<i class="fa-regular fa-clock text-[11px]"></i><span>Se enviará hoy a las ${state.schedule.todayTime} hs</span>`;
      } else {
        summaryPill.innerHTML = `<i class="fa-regular fa-calendar text-[11px]"></i><span>Programado: ${
          state.schedule.specificDateTime || 'Seleccione fecha y hora'
        }</span>`;
      }
    }
    updateScheduleSummaryPill();

    schedBoxTop.innerHTML = `
      <span class="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100 inline-flex items-center gap-2">
        <i class="fa-regular fa-clock text-brand"></i>
        <span>OPCIONES DE PROGRAMACIÓN DE ENVÍO</span>
      </span>
    `;
    schedBoxTop.appendChild(summaryPill);
    schedOptionsBox.appendChild(schedBoxTop);

    // 3 botones de modo: Dentro de un tiempo (Timer) | Hora específica (Hoy) | Fecha y hora específica
    const modeButtonsGrid = document.createElement('div');
    modeButtonsGrid.className = 'grid grid-cols-1 sm:grid-cols-3 gap-2.5';

    [
      { id: 'timer', label: 'Dentro de un tiempo (Timer)', icon: 'fa-solid fa-stopwatch' },
      { id: 'today_time', label: 'Hora específica (Hoy)', icon: 'fa-regular fa-clock' },
      { id: 'datetime', label: 'Fecha y hora específica', icon: 'fa-regular fa-calendar-days' },
    ].forEach((m) => {
      const active = state.schedule.mode === m.id;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = [
        'min-h-[40px] px-4 py-2 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-2 border transition-colors cursor-pointer',
        active
          ? 'bg-brand text-white border-brand shadow-xs'
          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-brand',
      ].join(' ');
      b.innerHTML = `<i class="${m.icon}"></i><span>${m.label}</span>`;
      b.addEventListener('click', () => {
        state.schedule.mode = m.id;
        render();
      });
      modeButtonsGrid.appendChild(b);
    });
    schedOptionsBox.appendChild(modeButtonsGrid);

    const modeDetails = document.createElement('div');
    modeDetails.className = 'space-y-3 pt-1';

    if (state.schedule.mode === 'timer') {
      const shortcutsRow = document.createElement('div');
      shortcutsRow.className = 'flex flex-wrap items-center gap-2';
      shortcutsRow.innerHTML = `<span class="text-xs text-slate-500 dark:text-slate-400 mr-1">Atajos rápidos:</span>`;

      [
        { label: '+5 min', mins: 5 },
        { label: '+15 min', mins: 15 },
        { label: '+30 min', mins: 30 },
        { label: '+1 hora', mins: 60 },
        { label: '+2 horas', mins: 120 },
      ].forEach((sc) => {
        const isCurrent = Number(state.schedule.timerMinutes) === sc.mins;
        const sb = document.createElement('button');
        sb.type = 'button';
        sb.className = [
          'px-3 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer',
          isCurrent
            ? 'bg-brand-soft dark:bg-brand/25 text-brand border-brand'
            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-brand',
        ].join(' ');
        sb.textContent = sc.label;
        sb.addEventListener('click', () => {
          state.schedule.timerMinutes = sc.mins;
          render();
        });
        shortcutsRow.appendChild(sb);
      });

      const exactRow = document.createElement('div');
      exactRow.className = 'flex items-center gap-3';
      exactRow.innerHTML = `<span class="text-xs text-slate-500 dark:text-slate-400">O defina minutos exactos:</span>`;

      const minInputWrap = document.createElement('div');
      minInputWrap.className =
        'inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5';
      const minInput = document.createElement('input');
      minInput.type = 'number';
      minInput.min = '1';
      minInput.value = String(state.schedule.timerMinutes);
      minInput.className =
        'w-16 text-center text-sm font-bold text-slate-900 dark:text-white bg-transparent focus:outline-none';
      minInput.addEventListener('input', (e) => {
        state.schedule.timerMinutes = Math.max(1, Number(e.target.value) || 15);
        updateScheduleSummaryPill();
      });
      const minSuffix = document.createElement('span');
      minSuffix.className = 'text-xs text-slate-400 ml-1';
      minSuffix.textContent = 'min';
      minInputWrap.append(minInput, minSuffix);
      exactRow.appendChild(minInputWrap);

      modeDetails.append(shortcutsRow, exactRow);
    } else if (state.schedule.mode === 'today_time') {
      const timeRow = document.createElement('div');
      timeRow.className = 'flex items-center gap-3';
      timeRow.innerHTML = `<label class="text-xs font-medium text-slate-600 dark:text-slate-300">Seleccione la hora de envío de hoy:</label>`;
      const tInput = document.createElement('input');
      tInput.type = 'time';
      tInput.value = state.schedule.todayTime;
      tInput.className =
        'min-h-[38px] px-3 py-1.5 text-sm font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand';
      tInput.addEventListener('input', (e) => {
        state.schedule.todayTime = e.target.value;
        updateScheduleSummaryPill();
      });
      timeRow.appendChild(tInput);
      modeDetails.appendChild(timeRow);
    } else {
      const dtRow = document.createElement('div');
      dtRow.className = 'flex flex-wrap items-center gap-3';
      dtRow.innerHTML = `<label class="text-xs font-medium text-slate-600 dark:text-slate-300">Seleccione fecha y hora exacta de envío:</label>`;
      const dtInput = document.createElement('input');
      dtInput.type = 'datetime-local';
      dtInput.value = state.schedule.specificDateTime;
      dtInput.className =
        'min-h-[38px] px-3 py-1.5 text-sm font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand';
      dtInput.addEventListener('input', (e) => {
        state.schedule.specificDateTime = e.target.value;
        updateScheduleSummaryPill();
      });
      dtRow.appendChild(dtInput);
      modeDetails.appendChild(dtRow);
    }

    schedOptionsBox.appendChild(modeDetails);
    card.appendChild(schedOptionsBox);

    // Vista Previa en WhatsApp
    const prevWrap = document.createElement('div');
    prevWrap.className = 'space-y-2';
    prevWrap.innerHTML = `
      <label class="block text-xs font-semibold text-slate-700 dark:text-slate-200">
        Vista Previa en WhatsApp:
      </label>
    `;
    refreshSchedulePreview();
    prevWrap.appendChild(schedPreviewContainer);
    card.appendChild(prevWrap);

    // Botón "Programar Mensaje Automático"
    const footer = document.createElement('div');
    footer.className = 'flex items-center justify-end pt-2';

    function computeScheduledTarget() {
      const now = new Date();
      let target = new Date(now.getTime());
      if (state.schedule.mode === 'timer') {
        target = new Date(now.getTime() + (Number(state.schedule.timerMinutes) || 15) * 60000);
      } else if (state.schedule.mode === 'today_time') {
        const [hh, mm] = String(state.schedule.todayTime || '18:00').split(':');
        target.setHours(Number(hh) || 18, Number(mm) || 0, 0, 0);
        if (target.getTime() <= now.getTime()) {
          target = new Date(target.getTime() + 24 * 3600 * 1000);
        }
      } else if (state.schedule.specificDateTime) {
        const parsed = new Date(state.schedule.specificDateTime);
        if (!Number.isNaN(parsed.getTime())) target = parsed;
      }
      const pad = (n) => String(n).padStart(2, '0');
      const mysqlStr = `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(
        target.getDate()
      )} ${pad(target.getHours())}:${pad(target.getMinutes())}:${pad(target.getSeconds())}`;
      return { mysqlStr, targetMs: target.getTime() };
    }

    const scheduleBtn = createButton({
      text: 'Programar Mensaje Automático',
      icon: 'fa-regular fa-clock',
      variant: 'primary',
      size: 'md',
      onClick: async (_, btnInstance) => {
        const eff = getEffectiveScheduleContact();
        const digits = normalizeDigits(eff.telefono);
        if (!digits || digits.length < 6) {
          toast.warning('Selecciona un contacto o escribe un número de teléfono válido.');
          return;
        }
        if (!state.schedule.contenido.trim()) {
          toast.warning('Ingresa o selecciona el contenido del mensaje a programar.');
          schedTextarea.focus();
          return;
        }

        const resolvedMsg = resolveDynamicMessage(state.schedule.contenido, eff);
        const { mysqlStr, targetMs } = computeScheduledTarget();
        const selectedTpl = state.templates.find(
          (x) => String(x.id) === String(state.schedule.templateId)
        );

        btnInstance.setLoading(true);
        try {
          await startScheduledMessageJob(
            {
              tipo: 'Programado',
              contactoOrigen: eff.origen || 'Manual',
              nombreDestinatario: eff.nombre || '—',
              telefonoDestinatario: digits,
              plantillaTitulo: selectedTpl?.titulo || '',
              contenido: resolvedMsg,
              adjuntoNombre: state.schedule.attachment?.nombre || '',
              adjuntoFormato: state.schedule.attachment?.formato || '',
              adjuntoMime: state.schedule.attachment?.mime || '',
              adjuntoData: state.schedule.attachment?.data || '',
              programadoPara: mysqlStr,
              estado: 'Programado',
            },
            targetMs
          );
          toast.success(
            `Mensaje programado en segundo plano (${mysqlStr}). Puedes seguir usando otros módulos.`
          );
          state.schedule.contenido = '';
          state.schedule.templateId = '';
          state.schedule.attachment = null;
          render();
        } catch (err) {
          toast.error(err.message || 'No se pudo guardar el mensaje programado en la base de datos.');
        } finally {
          btnInstance.setLoading(false);
        }
      },
    });

    footer.appendChild(scheduleBtn);
    card.appendChild(footer);
    parent.appendChild(card);
  }

  // ============================================================================
  // PESTAÑA 4: HISTORIAL DE MENSAJES (Foto 4 + Vista Previa completa de mensaje y adjuntos)
  // ============================================================================
  function renderHistoryTab(parent) {
    if (state.history.view === 'detail' && state.history.viewingItem) {
      renderHistoryDetailView(parent, state.history.viewingItem);
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'w-full space-y-4';

    // Encabezado como en la Foto 4: "Historial de Envíos Recientes" + filtro por Tipo + botón "Actualizar"
    const topHeader = document.createElement('div');
    topHeader.className = 'flex flex-wrap items-center justify-between gap-3 px-1';
    topHeader.innerHTML = `
      <div class="inline-flex items-center gap-2">
        <i class="fa-regular fa-clock text-brand text-sm"></i>
        <h2 class="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
          Historial de Envíos Recientes
        </h2>
      </div>
    `;

    const rightControls = document.createElement('div');
    rightControls.className = 'flex flex-wrap items-center gap-2.5';

    const typeFilter = document.createElement('select');
    typeFilter.className =
      'min-h-[34px] px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand';
    [
      { value: '', label: 'Todos los tipos' },
      { value: 'Mensaje', label: 'Mensaje' },
      { value: 'Difusión', label: 'Difusión' },
      { value: 'Programado', label: 'Programado' },
    ].forEach((opt) => {
      const o = document.createElement('option');
      o.value = opt.value;
      o.textContent = opt.label;
      typeFilter.appendChild(o);
    });
    typeFilter.value = state.history.tipo;
    typeFilter.addEventListener('change', (e) => {
      state.history.tipo = e.target.value;
      state.history.page = 1;
      fetchHistorial();
    });

    const refreshBtn = createButton({
      text: 'Actualizar',
      icon: 'fa-solid fa-rotate-right',
      variant: 'ghost',
      size: 'sm',
      onClick: () => fetchHistorial(),
    });

    rightControls.append(typeFilter, refreshBtn);
    topHeader.appendChild(rightControls);
    wrapper.appendChild(topHeader);

    function formatTimeLine(iso) {
      if (!iso) return '-';
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return String(iso);
      return d.toLocaleTimeString('es-PY', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
    }

    function formatDateLine(iso) {
      if (!iso) return '-';
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return '';
      return d.toLocaleDateString('es-PY', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    }

    function openHistoryPreview(row) {
      state.history.viewingItem = row;
      state.history.view = 'detail';
      render();
    }

    function openEditHistoryModal(row) {
      const formWrap = document.createElement('div');
      formWrap.className = 'space-y-4';

      const nameField = document.createElement('div');
      nameField.innerHTML = `<label class="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">Nombre del Destinatario</label>`;
      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.value = row.nombreDestinatario || '—';
      nameInput.className =
        'w-full min-h-[40px] px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white';
      nameField.appendChild(nameInput);

      const phoneField = document.createElement('div');
      phoneField.innerHTML = `<label class="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">Número de Destinatario</label>`;
      const phoneInput = document.createElement('input');
      phoneInput.type = 'text';
      phoneInput.value = row.telefonoDestinatario || '';
      phoneInput.className =
        'w-full min-h-[40px] px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white';
      phoneField.appendChild(phoneInput);

      const msgField = document.createElement('div');
      msgField.innerHTML = `<label class="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">Mensaje Enviado</label>`;
      const msgArea = document.createElement('textarea');
      msgArea.rows = 4;
      msgArea.value = row.contenido || '';
      msgArea.className =
        'w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white';
      msgField.appendChild(msgArea);

      formWrap.append(nameField, phoneField, msgField);

      openModal({
        title: `Editar Registro de Envío #${row.id}`,
        content: formWrap,
        size: 'md',
        confirmText: 'Guardar Cambios',
        cancelText: 'Cancelar',
        onConfirm: async ({ setLoading }) => {
          setLoading(true);
          try {
            await apiFetch(`/api/difusion-mensajes/${row.id}`, {
              method: 'PUT',
              body: JSON.stringify({
                nombreDestinatario: nameInput.value,
                telefonoDestinatario: phoneInput.value,
                contenido: msgArea.value,
                estado: row.estado || 'Enviado',
              }),
            });
            toast.success('Registro del historial actualizado.');
            fetchHistorial();
          } catch (err) {
            toast.error(err.message || 'No se pudo actualizar el registro.');
            return false;
          } finally {
            setLoading(false);
          }
        },
      });
    }

    const table = createDataTable({
      loading: state.history.loading,
      error: state.history.error,
      data: state.history.data,
      total: state.history.total,
      page: state.history.page,
      pageSize: 20,
      searchPlaceholder: 'Buscar en historial por nombre, número o mensaje...',
      emptyMessage: 'Aún no hay envíos registrados en el historial.',
      onSearch: (q) => {
        state.history.q = q;
        state.history.page = 1;
        fetchHistorial();
      },
      onPageChange: (newPage) => {
        state.history.page = newPage;
        fetchHistorial();
      },
      onRetry: () => fetchHistorial(),
      columns: [
        {
          key: 'id',
          label: 'ID',
          sortable: true,
          render: (row) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className =
              'text-left text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-brand hover:underline cursor-pointer';
            b.textContent = `#${row.id}`;
            b.addEventListener('click', () => openHistoryPreview(row));
            return b;
          },
        },
        {
          key: 'createdAt',
          label: 'FECHA Y HORA',
          sortable: true,
          render: (row) => `
            <div>
              <p class="text-xs font-bold text-slate-800 dark:text-slate-100">${formatTimeLine(
                row.createdAt
              )}</p>
              <p class="text-[11px] text-slate-400 dark:text-slate-500">${formatDateLine(
                row.createdAt
              )}</p>
            </div>
          `,
        },
        {
          key: 'updatedAt',
          label: 'FECHA MODIFICADA',
          sortable: true,
          render: (row) => `
            <span class="text-xs text-slate-500 dark:text-slate-400">
              ${formatDateLine(row.updatedAt)} ${formatTimeLine(row.updatedAt)}
            </span>
          `,
        },
        {
          key: 'tipo',
          label: 'TIPO',
          sortable: true,
          render: (row) => {
            const t = (row.tipo || 'Mensaje').toLowerCase();
            let pillClass = 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400';
            let dotClass = 'bg-blue-500';
            if (t.includes('difus')) {
              pillClass = 'bg-brand-soft dark:bg-brand/20 text-brand';
              dotClass = 'bg-brand';
            } else if (t.includes('program')) {
              pillClass = 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400';
              dotClass = 'bg-amber-500';
            }
            return `
              <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${pillClass}">
                <span class="w-1.5 h-1.5 rounded-full ${dotClass}"></span>
                ${escapeHtml(row.tipo || 'Mensaje')}
              </span>
            `;
          },
        },
        {
          key: 'nombreDestinatario',
          label: 'NOMBRE',
          sortable: true,
          render: (row) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className =
              'text-left text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 hover:text-brand hover:underline cursor-pointer';
            b.textContent = row.nombreDestinatario || '—';
            b.addEventListener('click', () => openHistoryPreview(row));
            return b;
          },
        },
        {
          key: 'telefonoDestinatario',
          label: 'DESTINATARIO',
          render: (row) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className =
              'text-left text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer';
            b.textContent = row.telefonoDestinatario || '-';
            b.addEventListener('click', () => openHistoryPreview(row));
            return b;
          },
        },
        {
          key: 'contenido',
          label: 'MENSAJE ENVIADO',
          render: (row) => {
            const box = document.createElement('div');
            box.className = 'flex items-center gap-2.5 max-w-md';

            if (row.adjuntoData && row.adjuntoNombre) {
              const fmt = String(row.adjuntoFormato || '').toUpperCase();
              const isImg = ['PNG', 'JPG', 'JPEG', 'ICO', 'WEBP'].includes(fmt);
              if (isImg) {
                const thumb = document.createElement('img');
                thumb.src = row.adjuntoData;
                thumb.alt = row.adjuntoNombre;
                thumb.title = `${row.adjuntoNombre} (${fmt}) — Click para zoom`;
                thumb.className =
                  'w-9 h-9 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0 cursor-zoom-in';
                thumb.addEventListener('click', () =>
                  openImageZoomModal({
                    src: row.adjuntoData,
                    nombre: row.adjuntoNombre,
                    formato: fmt,
                  })
                );
                box.appendChild(thumb);
              } else {
                const badge = document.createElement('span');
                badge.className =
                  'px-2 py-0.5 rounded bg-brand-soft dark:bg-brand/20 text-brand text-[10px] font-bold uppercase shrink-0';
                badge.textContent = fmt || 'ADJUNTO';
                box.appendChild(badge);
              }
            }

            const txt = document.createElement('p');
            txt.className = 'text-xs text-slate-700 dark:text-slate-200 line-clamp-2';
            txt.textContent = row.contenido || '-';
            box.appendChild(txt);
            return box;
          },
        },
        {
          key: 'estado',
          label: 'ESTADO',
          render: (row) => {
            const isProg = (row.estado || '').toLowerCase().includes('program');
            return `
              <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                isProg
                  ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                  : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
              }">
                <span class="w-1.5 h-1.5 rounded-full ${
                  isProg ? 'bg-amber-500' : 'bg-emerald-500'
                }"></span>
                ${escapeHtml(row.estado || 'Enviado')}
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

            const viewBtn = createButton({
              icon: 'fa-solid fa-eye',
              variant: 'icon',
              size: 'sm',
              ariaLabel: 'Ver vista previa del mensaje enviado',
              onClick: () => openHistoryPreview(row),
            });

            const editBtn = createButton({
              icon: 'fa-regular fa-pen-to-square',
              variant: 'icon',
              size: 'sm',
              ariaLabel: 'Editar registro de mensaje',
              onClick: () => openEditHistoryModal(row),
            });

            const delBtn = createButton({
              icon: 'fa-regular fa-trash-can',
              variant: 'danger',
              size: 'sm',
              ariaLabel: 'Enviar mensaje a Reciclaje',
              onClick: () => {
                openConfirmModal({
                  title: 'Enviar mensaje a Reciclaje',
                  message: `¿Confirmas que deseas borrar este registro de envío para <strong>"${escapeHtml(
                    row.nombreDestinatario !== '—'
                      ? row.nombreDestinatario
                      : row.telefonoDestinatario
                  )}"</strong>? Se ocultará del historial y pasará al módulo de <strong>Reciclaje</strong>.`,
                  confirmText: 'Sí, borrar',
                  cancelText: 'Cancelar',
                  onConfirm: async ({ setLoading }) => {
                    setLoading(true);
                    try {
                      await apiFetch(`/api/difusion-mensajes/${row.id}`, {
                        method: 'DELETE',
                      });
                      toast.success('Mensaje enviado a Reciclaje.');
                      fetchHistorial();
                    } catch (err) {
                      toast.error(err.message || 'No se pudo borrar el mensaje.');
                      return false;
                    } finally {
                      setLoading(false);
                    }
                  },
                });
              },
            });

            actWrap.append(viewBtn, editBtn, delBtn);
            return actWrap;
          },
        },
      ],
    });

    wrapper.appendChild(table);
    parent.appendChild(wrapper);
  }

  function renderHistoryDetailView(parent, item) {
    const detailWrap = document.createElement('div');
    detailWrap.className = 'w-full space-y-5';

    const topBar = document.createElement('div');
    topBar.className = 'flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4';

    const leftInfo = document.createElement('div');
    leftInfo.innerHTML = `
      <div class="flex items-center gap-1.5 text-xs font-medium mb-1">
        <button type="button" id="back-to-history-list" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 inline-flex items-center gap-1 cursor-pointer">
          <i class="fa-solid fa-arrow-left text-[10px]"></i>
          <span>Historial de Mensajes</span>
        </button>
        <span class="text-slate-300 dark:text-slate-600">/</span>
        <span class="text-brand font-semibold">Vista Previa del Mensaje (#${item.id})</span>
      </div>
      <h2 class="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
        Destinatario: ${escapeHtml(
          item.nombreDestinatario && item.nombreDestinatario !== '—'
            ? `${item.nombreDestinatario} (${item.telefonoDestinatario})`
            : item.telefonoDestinatario
        )}
      </h2>
    `;

    const backBtn = createButton({
      text: 'Volver al Historial',
      variant: 'cancel',
      size: 'sm',
      onClick: () => {
        state.history.view = 'list';
        state.history.viewingItem = null;
        render();
      },
    });

    topBar.append(leftInfo, backBtn);
    detailWrap.appendChild(topBar);

    leftInfo.querySelector('#back-to-history-list')?.addEventListener('click', () => {
      state.history.view = 'list';
      state.history.viewingItem = null;
      render();
    });

    // Tarjeta de metadatos y fechas
    const metaGrid = document.createElement('div');
    metaGrid.className =
      'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs';

    const metaItems = [
      { label: 'Tipo de Envío', value: item.tipo || 'Mensaje' },
      { label: 'Nombre Destinatario', value: item.nombreDestinatario || '—' },
      { label: 'Número WhatsApp', value: item.telefonoDestinatario || '-' },
      { label: 'Estado', value: item.estado || 'Enviado' },
      {
        label: 'Fecha Creada',
        value: item.createdAt ? new Date(item.createdAt).toLocaleString('es-PY') : '-',
      },
      {
        label: 'Fecha Modificada',
        value: item.updatedAt ? new Date(item.updatedAt).toLocaleString('es-PY') : '-',
      },
      { label: 'Plantilla Usada', value: item.plantillaTitulo || 'Mensaje personalizado' },
      { label: 'Programado Para', value: item.programadoPara || 'Envío inmediato' },
    ];

    metaItems.forEach((m) => {
      const box = document.createElement('div');
      box.className =
        'p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800';
      box.innerHTML = `
        <p class="text-[11px] font-medium text-slate-400 dark:text-slate-500">${m.label}</p>
        <p class="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 mt-0.5 break-words">${escapeHtml(
          m.value
        )}</p>
      `;
      metaGrid.appendChild(box);
    });
    detailWrap.appendChild(metaGrid);

    // Vista previa del Mensaje en WhatsApp + Vista previa del Archivo Adjunto (Imagen con Zoom, Video o PDF)
    const previewCard = document.createElement('section');
    previewCard.className =
      'w-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-xs';
    previewCard.innerHTML = `
      <div class="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
        <i class="fa-brands fa-whatsapp text-emerald-500 text-base"></i>
        <h3 class="text-xs font-bold uppercase tracking-wider text-brand">
          Vista Previa del Mensaje Enviado y Archivo Adjunto
        </h3>
      </div>
    `;

    const attachmentObj =
      item.adjuntoData && item.adjuntoNombre
        ? {
            nombre: item.adjuntoNombre,
            formato: item.adjuntoFormato || 'WEBP',
            mime: item.adjuntoMime || '',
            data: item.adjuntoData,
          }
        : null;

    previewCard.appendChild(
      renderWhatsAppSimulationBox({
        text: item.contenido,
        contact: {
          nombre: item.nombreDestinatario,
          telefono: item.telefonoDestinatario,
        },
        attachment: attachmentObj,
      })
    );

    if (attachmentObj) {
      const attDetailSection = document.createElement('div');
      attDetailSection.className =
        'pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2';
      attDetailSection.innerHTML = `
        <p class="text-xs font-bold text-slate-700 dark:text-slate-200">
          Detalle del Archivo Adjunto (Haz clic sobre la imagen para abrir con Zoom):
        </p>
      `;
      const fullCard = renderMediaPreviewCard(attachmentObj);
      if (fullCard) attDetailSection.appendChild(fullCard);
      previewCard.appendChild(attDetailSection);
    }

    detailWrap.appendChild(previewCard);
    parent.appendChild(detailWrap);
  }

  // Renderizar de inmediato la interfaz y actualizar contactos/plantillas en segundo plano
  render();
  loadContactsAndTemplates().then(() => render());
}

