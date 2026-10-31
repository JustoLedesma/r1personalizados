import { createButton } from '../components/button.js';
import { openModal, openConfirmModal } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { apiFetch } from '../services/api.js';
import { createPhoneInput } from '../components/phone-input.js';
import { BudgetDocumentService, loadPdfmeLibraries, resolveBasePdf } from '../services/budget-document.service.js?v=20261031_3';

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderConfiguracionModule(container) {
  container.innerHTML = '';

  const state = {
    activeTab: 'whatsapp', // 'whatsapp' | 'pedidos' | 'productos' | 'presupuesto' | 'perfil' | 'general' | 'logs'
    loading: true,
    configs: {
      whatsapp_nombre_formato: { incluir_nombre: true, incluir_apellido: true },
      pedidos_notificaciones: {
        notificar_automatico: false,
        plantilla_retiro_id: '',
        plantilla_envio_id: '',
        plantilla_presupuesto_id: '',
      },
      empresa_datos: {
        logo_url: './logo/r1.png',
        razon_social: 'NETZ - R1 Personalizados',
        ruc: '00012345-0',
        propietario: 'Juan Pérez',
        email: 'contacto@netz.com.py',
        telefonos: ['+595 981 123456'],
        direccion: 'Asunción, Paraguay',
        horario_atencion: 'Lunes a Viernes de 08:00 a 18:00 hs - Sábados de 08:00 a 12:00 hs',
        gps_enlace: 'https://maps.google.com/?q=-25.285,-57.6470',
        redes: {
          facebook: 'https://facebook.com/r1personalizados',
          instagram: 'https://instagram.com/r1personalizados',
          tiktok: 'https://tiktok.com/@r1personalizados',
          sitio_web: 'https://netz.com.py',
        },
      },
    },
    perfil: {
      id: 1,
      username: 'admin',
      email: 'admin@netz.local',
      fullName: 'Operador Ventas',
      role: 'admin',
      fechaNacimiento: '1994-05-15',
      fotoPerfil: '',
      autoLogoutMinutes: 0,
    },
    atributos: {
      categorias: [],
      marcas: [],
      unidades: [],
    },
    templates: [],
  };

  const wrapper = document.createElement('div');
  wrapper.className = 'w-full space-y-6 pb-12';

  // Barra de Pestañas Superior (WhatsApp | Pedidos | Productos | Presupuesto | Perfil | General | Logs)
  const tabsBar = document.createElement('div');
  tabsBar.className =
    'flex flex-wrap items-center gap-2 sm:gap-6 border-b border-slate-200 dark:border-slate-800 px-1';

  const TABS = [
    { id: 'whatsapp', label: 'WhatsApp', icon: 'fa-brands fa-whatsapp' },
    { id: 'pedidos', label: 'Pedidos', icon: 'fa-regular fa-clipboard' },
    { id: 'productos', label: 'Productos', icon: 'fa-solid fa-cube' },
    { id: 'presupuesto', label: 'Presupuesto', icon: 'fa-regular fa-file-lines' },
    { id: 'perfil', label: 'Perfil', icon: 'fa-regular fa-user' },
    { id: 'general', label: 'General', icon: 'fa-regular fa-building' },
    { id: 'logs', label: 'Logs', icon: 'fa-solid fa-clock-rotate-left' },
  ];

  const contentHolder = document.createElement('div');
  contentHolder.className = 'w-full';

  function renderTabsHeader() {
    tabsBar.innerHTML = '';
    TABS.forEach((t) => {
      const isActive = state.activeTab === t.id;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `flex items-center gap-2 py-3 px-3 text-xs sm:text-sm font-semibold transition-all border-b-2 cursor-pointer ${
        isActive
          ? 'border-brand text-brand'
          : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
      }`;
      btn.innerHTML = `<i class="${t.icon}"></i> <span>${t.label}</span>`;
      btn.addEventListener('click', () => {
        state.activeTab = t.id;
        renderTabsHeader();
        renderActiveTab();
      });
      tabsBar.appendChild(btn);
    });
  }

  function renderActiveTab() {
    contentHolder.innerHTML = '';
    if (state.activeTab === 'whatsapp') {
      renderWhatsAppTab(contentHolder);
    } else if (state.activeTab === 'pedidos') {
      renderPedidosTab(contentHolder);
    } else if (state.activeTab === 'productos') {
      renderProductosTab(contentHolder);
    } else if (state.activeTab === 'presupuesto') {
      renderPresupuestoTab(contentHolder);
    } else if (state.activeTab === 'perfil') {
      renderPerfilTab(contentHolder);
    } else if (state.activeTab === 'general') {
      renderGeneralTab(contentHolder);
    } else if (state.activeTab === 'logs') {
      renderLogsTab(contentHolder);
    }
  }

  // ============================================================================
  // PESTAÑA 1: WHATSAPP (Ajustes de Envíos de Mensajes en WhatsApp — Foto 1)
  // ============================================================================
  function renderWhatsAppTab(parent) {
    const card = document.createElement('section');
    card.className =
      'w-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 sm:p-7 shadow-xs space-y-6';

    const header = document.createElement('div');
    header.className =
      'flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800';
    header.innerHTML = `
      <div class="flex items-start gap-3">
        <span class="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
          <i class="fa-brands fa-whatsapp text-lg"></i>
        </span>
        <div>
          <h2 class="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
            Ajustes de Envíos de Mensajes en WhatsApp
          </h2>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            Configure el comportamiento y formato dinámico de los mensajes enviados a clientes.
          </p>
        </div>
      </div>
      <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-brand-soft dark:bg-brand/20 text-brand">
        <span class="w-1.5 h-1.5 rounded-full bg-brand"></span>
        Global para todos los envíos
      </span>
    `;
    card.appendChild(header);

    // Bloque: Nombre de Destinatario ({nombre})
    const secWrap = document.createElement('div');
    secWrap.className = 'space-y-4';

    secWrap.innerHTML = `
      <div>
        <h3 class="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">
          Nombre de Destinatario ({nombre})
        </h3>
        <p class="text-xs text-slate-500 dark:text-slate-400">
          Seleccione qué datos del cliente se deben incluir al reemplazar la etiqueta <code class="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-brand font-mono">{nombre}</code> en los perfiles de mensaje y envíos.
        </p>
      </div>
    `;

    const checksGrid = document.createElement('div');
    checksGrid.className = 'grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl';

    const waCfg = state.configs.whatsapp_nombre_formato || {
      incluir_nombre: true,
      incluir_apellido: true,
    };

    // Card 1: Nombre
    const nameCard = document.createElement('label');
    nameCard.className =
      'flex items-start gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:border-brand/40 transition cursor-pointer select-none';
    nameCard.innerHTML = `
      <input type="checkbox" class="mt-0.5 rounded border-slate-300 text-brand focus:ring-brand accent-brand cursor-pointer" ${
        waCfg.incluir_nombre ? 'checked' : ''
      }>
      <div class="space-y-0.5">
        <p class="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">Nombre</p>
        <p class="text-[11px] text-slate-500 dark:text-slate-400">Toma únicamente los nombres registrados del cliente.</p>
      </div>
    `;
    const nameChk = nameCard.querySelector('input');

    // Card 2: Apellido
    const lastCard = document.createElement('label');
    lastCard.className =
      'flex items-start gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:border-brand/40 transition cursor-pointer select-none';
    lastCard.innerHTML = `
      <input type="checkbox" class="mt-0.5 rounded border-slate-300 text-brand focus:ring-brand accent-brand cursor-pointer" ${
        waCfg.incluir_apellido ? 'checked' : ''
      }>
      <div class="space-y-0.5">
        <p class="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">Apellido</p>
        <p class="text-[11px] text-slate-500 dark:text-slate-400">Toma únicamente los apellidos registrados del cliente.</p>
      </div>
    `;
    const lastChk = lastCard.querySelector('input');

    checksGrid.append(nameCard, lastCard);
    secWrap.appendChild(checksGrid);

    // Vista previa con cliente de ejemplo
    const prevBox = document.createElement('div');
    prevBox.className =
      'p-4 rounded-xl border border-brand/20 bg-brand-soft/40 dark:bg-brand/10 space-y-2.5 max-w-2xl';

    const prevHeader = document.createElement('div');
    prevHeader.className = 'flex items-center justify-between gap-2';

    const prevTitle = document.createElement('span');
    prevTitle.className = 'text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5';
    prevTitle.innerHTML = `<i class="fa-solid fa-eye text-brand"></i> Vista previa con cliente de ejemplo (<strong>Juan Pérez</strong>):`;

    const prevBadge = document.createElement('span');
    prevBadge.className =
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white dark:bg-slate-900 border border-brand/30 text-brand shadow-2xs';

    prevHeader.append(prevTitle, prevBadge);
    prevBox.appendChild(prevHeader);

    const prevCodeBox = document.createElement('div');
    prevCodeBox.className =
      'p-3 rounded-lg bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-700 dark:text-slate-300 space-y-1';
    prevBox.appendChild(prevCodeBox);

    function updatePreview() {
      const incN = nameChk.checked;
      const incA = lastChk.checked;

      let formattedName = 'Juan Pérez';
      let badgeLabel = 'Nombre + Apellido';

      if (incN && incA) {
        formattedName = 'Juan Pérez';
        badgeLabel = 'Nombre + Apellido';
      } else if (incN && !incA) {
        formattedName = 'Juan';
        badgeLabel = 'Solo Nombre';
      } else if (!incN && incA) {
        formattedName = 'Pérez';
        badgeLabel = 'Solo Apellido';
      } else {
        formattedName = 'Cliente';
        badgeLabel = 'Sin nombre ni apellido';
      }

      prevBadge.textContent = badgeLabel;
      prevCodeBox.innerHTML = `
        <div><span class="text-slate-400">Plantilla:</span> <span class="text-slate-900 dark:text-white">"¡Hola {nombre}! Su pedido está listo."</span></div>
        <div><span class="text-slate-400">Resultado:</span> <span class="text-brand font-bold">"¡Hola ${escapeHtml(
          formattedName
        )}! Su pedido está listo."</span></div>
      `;
    }

    nameChk.addEventListener('change', () => {
      if (!nameChk.checked && !lastChk.checked) {
        nameChk.checked = true;
        toast.warning('Debe estar seleccionada al menos una opción (Nombre o Apellido).');
      }
      updatePreview();
    });

    lastChk.addEventListener('change', () => {
      if (!nameChk.checked && !lastChk.checked) {
        lastChk.checked = true;
        toast.warning('Debe estar seleccionada al menos una opción (Nombre o Apellido).');
      }
      updatePreview();
    });

    updatePreview();
    secWrap.appendChild(prevBox);
    card.appendChild(secWrap);

    // Botón Guardar
    const footer = document.createElement('div');
    footer.className = 'flex items-center justify-end pt-3 border-t border-slate-100 dark:border-slate-800';

    const saveBtn = createButton({
      text: 'Guardar ajustes',
      icon: 'fa-solid fa-check',
      variant: 'primary',
      size: 'md',
      onClick: async (_, btn) => {
        btn.setLoading(true);
        try {
          const newCfg = {
            incluir_nombre: nameChk.checked,
            incluir_apellido: lastChk.checked,
          };
          await apiFetch('/api/configuracion', {
            method: 'PUT',
            body: JSON.stringify({
              clave: 'whatsapp_nombre_formato',
              valor: newCfg,
            }),
          });
          state.configs.whatsapp_nombre_formato = newCfg;
          try {
            localStorage.setItem('r1_whatsapp_nombre_formato', JSON.stringify(newCfg));
          } catch (_) {}
          toast.success('Ajustes de WhatsApp guardados exitosamente.');
        } catch (err) {
          toast.error(err.message || 'No se pudieron guardar los ajustes.');
        } finally {
          btn.setLoading(false);
        }
      },
    });

    footer.appendChild(saveBtn);
    card.appendChild(footer);
    parent.appendChild(card);
  }

  // ============================================================================
  // PESTAÑA 2: PEDIDOS (Notificación al Cliente: Modalidad de Entrega — Foto 2)
  // ============================================================================
  function renderPedidosTab(parent) {
    const card = document.createElement('section');
    card.className =
      'w-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 sm:p-7 shadow-xs space-y-6';

    const pCfg = state.configs.pedidos_notificaciones || {
      notificar_automatico: false,
      plantilla_retiro_id: '',
      plantilla_envio_id: '',
      plantilla_presupuesto_id: '',
    };

    const header = document.createElement('div');
    header.className =
      'flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800';
    header.innerHTML = `
      <div class="flex items-start gap-3">
        <span class="w-10 h-10 rounded-xl bg-brand-soft dark:bg-brand/20 text-brand flex items-center justify-center shrink-0">
          <i class="fa-regular fa-clipboard text-lg"></i>
        </span>
        <div>
          <h2 class="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
            Notificación al Cliente: Modalidad de Entrega
          </h2>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            Controla el comportamiento del envío de mensajes de WhatsApp una vez que el producto/pedido pasa al estado Listo.
          </p>
        </div>
      </div>
      <span class="badge-status inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold ${
        pCfg.notificar_automatico
          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
      }">
        <span class="w-1.5 h-1.5 rounded-full ${pCfg.notificar_automatico ? 'bg-emerald-500' : 'bg-slate-400'}"></span>
        ${pCfg.notificar_automatico ? 'Automático (Activo)' : 'Manual (Inactivo)'}
      </span>
    `;
    card.appendChild(header);

    // Switch Card Principal
    const switchCard = document.createElement('div');
    switchCard.className =
      'flex items-center justify-between gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40';

    const switchLabel = document.createElement('div');
    switchLabel.className = 'space-y-0.5';
    switchLabel.innerHTML = `
      <h3 class="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
        Notificar automáticamente al marcar Pedido como Listo
      </h3>
      <p class="text-xs text-slate-500 dark:text-slate-400">
        Cuando este switch esté activado, al marcar un pedido en estado Listo el sistema enviará de forma automática el mensaje de WhatsApp al cliente según su modalidad de entrega.
      </p>
    `;

    const toggleWrap = document.createElement('label');
    toggleWrap.className = 'relative inline-flex items-center cursor-pointer shrink-0';
    toggleWrap.innerHTML = `
      <input type="checkbox" class="sr-only peer" ${pCfg.notificar_automatico ? 'checked' : ''}>
      <div class="w-11 h-6 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand"></div>
    `;
    const toggleInput = toggleWrap.querySelector('input');
    const badgeEl = header.querySelector('.badge-status');

    toggleInput.addEventListener('change', () => {
      pCfg.notificar_automatico = toggleInput.checked;
      if (badgeEl) {
        badgeEl.className = `badge-status inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold ${
          pCfg.notificar_automatico
            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
        }`;
        badgeEl.innerHTML = `
          <span class="w-1.5 h-1.5 rounded-full ${pCfg.notificar_automatico ? 'bg-emerald-500' : 'bg-slate-400'}"></span>
          ${pCfg.notificar_automatico ? 'Automático (Activo)' : 'Manual (Inactivo)'}
        `;
      }
    });

    switchCard.append(switchLabel, toggleWrap);
    card.appendChild(switchCard);

    // 3 Cards de modalidades
    const modesGrid = document.createElement('div');
    modesGrid.className = 'grid grid-cols-1 lg:grid-cols-3 gap-4';

    function buildTemplateOptions(selectedVal) {
      let html = `<option value="">-- Usar plantilla predeterminada del sistema --</option>`;
      state.templates.forEach((t) => {
        const isSel = String(t.id) === String(selectedVal);
        html += `<option value="${t.id}" ${isSel ? 'selected' : ''}>[${escapeHtml(t.categoria)}] ${escapeHtml(
          t.titulo
        )}</option>`;
      });
      return html;
    }

    // Modalidad 1: Retiro en Local
    const cardRetiro = document.createElement('div');
    cardRetiro.className =
      'p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 space-y-3';
    cardRetiro.innerHTML = `
      <div class="flex items-start gap-2.5">
        <span class="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
          <i class="fa-solid fa-store text-sm"></i>
        </span>
        <div>
          <h4 class="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">Si el pedido es: Retiro en Local</h4>
          <p class="text-[11px] text-slate-500 dark:text-slate-400">Mensaje que se enviará automáticamente cuando el pedido esté listo para ser retirado en el local.</p>
        </div>
      </div>
      <div>
        <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
          Perfil de Mensaje para Retiro:
        </label>
        <select class="sel-retiro w-full min-h-[38px] px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand">
          ${buildTemplateOptions(pCfg.plantilla_retiro_id)}
        </select>
      </div>
    `;

    // Modalidad 2: Envío a Domicilio
    const cardEnvio = document.createElement('div');
    cardEnvio.className =
      'p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 space-y-3';
    cardEnvio.innerHTML = `
      <div class="flex items-start gap-2.5">
        <span class="w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
          <i class="fa-solid fa-truck text-sm"></i>
        </span>
        <div>
          <h4 class="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">Si el pedido es: Envío a Domicilio</h4>
          <p class="text-[11px] text-slate-500 dark:text-slate-400">Mensaje que se enviará automáticamente para coordinar o avisar del despacho / encomienda.</p>
        </div>
      </div>
      <div>
        <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
          Perfil de Mensaje para Envío:
        </label>
        <select class="sel-envio w-full min-h-[38px] px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand">
          ${buildTemplateOptions(pCfg.plantilla_envio_id)}
        </select>
      </div>
      <div class="preview-envio p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/60 text-[11px] text-slate-600 dark:text-slate-300">
        <span class="font-bold text-slate-500 block mb-0.5">Vista previa:</span>
        <span class="prev-envio-txt italic">Seleccione una plantilla para ver su previsualización...</span>
      </div>
    `;

    const selEnvio = cardEnvio.querySelector('.sel-envio');
    const prevEnvioTxt = cardEnvio.querySelector('.prev-envio-txt');
    function updateEnvioPreview() {
      const found = state.templates.find((t) => String(t.id) === String(selEnvio.value));
      if (found && found.contenido) {
        prevEnvioTxt.textContent = found.contenido;
      } else {
        prevEnvioTxt.textContent =
          '¡Hola Juan Pérez! Te damos una cordial bienvenida a NETZ. Tu pedido está en camino a tu domicilio.';
      }
    }
    selEnvio.addEventListener('change', updateEnvioPreview);
    updateEnvioPreview();

    // Modalidad 3: Envío de Presupuesto
    const cardPresupuesto = document.createElement('div');
    cardPresupuesto.className =
      'p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 space-y-3';
    cardPresupuesto.innerHTML = `
      <div class="flex items-start gap-2.5">
        <span class="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-brand flex items-center justify-center shrink-0">
          <i class="fa-regular fa-file-pdf text-sm"></i>
        </span>
        <div>
          <h4 class="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">Si el pedido es: Envío de Presupuesto</h4>
          <p class="text-[11px] text-slate-500 dark:text-slate-400">Mensaje predeterminado que acompañará al archivo PDF del presupuesto al enviarlo por WhatsApp al cliente.</p>
        </div>
      </div>
      <div>
        <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
          Perfil de Mensaje para Presupuesto:
        </label>
        <select class="sel-presupuesto w-full min-h-[38px] px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand">
          ${buildTemplateOptions(pCfg.plantilla_presupuesto_id)}
        </select>
      </div>
    `;

    modesGrid.append(cardRetiro, cardEnvio, cardPresupuesto);
    card.appendChild(modesGrid);

    // Aviso informativo amarillo (exacto a la foto 2)
    const alertBox = document.createElement('div');
    alertBox.className =
      'flex items-center gap-2 p-3.5 rounded-xl border border-amber-300 dark:border-amber-700/60 bg-amber-50/70 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 text-xs';
    alertBox.innerHTML = `
      <i class="fa-solid fa-circle-info text-amber-600 shrink-0"></i>
      <span><strong>Si la opción no está activa:</strong> Se mostrarán los botones manuales en el pedido para elegir cuándo enviar el mensaje de Retiro o Envío.</span>
    `;
    card.appendChild(alertBox);

    // Botón Guardar
    const footer = document.createElement('div');
    footer.className = 'flex items-center justify-end pt-3 border-t border-slate-100 dark:border-slate-800';

    const saveBtn = createButton({
      text: 'Guardar configuración de pedidos',
      icon: 'fa-solid fa-check',
      variant: 'primary',
      size: 'md',
      onClick: async (_, btn) => {
        btn.setLoading(true);
        try {
          const newCfg = {
            notificar_automatico: toggleInput.checked,
            plantilla_retiro_id: cardRetiro.querySelector('.sel-retiro').value || null,
            plantilla_envio_id: cardEnvio.querySelector('.sel-envio').value || null,
            plantilla_presupuesto_id: cardPresupuesto.querySelector('.sel-presupuesto').value || null,
          };
          await apiFetch('/api/configuracion', {
            method: 'PUT',
            body: JSON.stringify({
              clave: 'pedidos_notificaciones',
              valor: newCfg,
            }),
          });
          state.configs.pedidos_notificaciones = newCfg;
          toast.success('Configuración de pedidos guardada exitosamente.');
        } catch (err) {
          toast.error(err.message || 'No se pudo guardar la configuración de pedidos.');
        } finally {
          btn.setLoading(false);
        }
      },
    });

    footer.appendChild(saveBtn);
    card.appendChild(footer);
    parent.appendChild(card);
  }

  // ============================================================================
  // PESTAÑA 3: PRODUCTOS (Atributos y Catálogo de Productos — Foto 3)
  // ============================================================================
  function renderProductosTab(parent) {
    const card = document.createElement('section');
    card.className =
      'w-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 sm:p-7 shadow-xs space-y-6';

    const header = document.createElement('div');
    header.className =
      'flex items-start gap-3 pb-4 border-b border-slate-100 dark:border-slate-800';
    header.innerHTML = `
      <span class="w-10 h-10 rounded-xl bg-brand-soft dark:bg-brand/20 text-brand flex items-center justify-center shrink-0">
        <i class="fa-solid fa-cube text-lg"></i>
      </span>
      <div>
        <h2 class="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
          Atributos y Catálogo de Productos
        </h2>
        <p class="text-xs text-slate-500 dark:text-slate-400">
          Gestione las categorías, marcas y unidades de medida que alimentan las opciones del catálogo y los formularios de creación.
        </p>
      </div>
    `;
    card.appendChild(header);

    const colsGrid = document.createElement('div');
    colsGrid.className = 'grid grid-cols-1 lg:grid-cols-3 gap-6';

    // ---------------------------------------------------------
    // Columna 1: Categorías
    // ---------------------------------------------------------
    const catBox = document.createElement('div');
    catBox.className =
      'p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-3';

    const catHeader = document.createElement('div');
    catHeader.className = 'flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700/60';
    catHeader.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="w-2 h-2 rounded-full bg-brand"></span>
        <h3 class="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">Categorías</h3>
        <span class="cat-count text-[11px] font-mono font-bold text-slate-400">(${state.atributos.categorias.length})</span>
      </div>
    `;

    const addCatBtn = createButton({
      text: 'Nueva',
      icon: 'fa-solid fa-plus',
      variant: 'primary',
      size: 'sm',
      onClick: () => openAddCategoriaModal(),
    });
    catHeader.appendChild(addCatBtn);
    catBox.appendChild(catHeader);

    const catList = document.createElement('div');
    catList.className = 'space-y-2';

    function refreshCategoriasList() {
      catList.innerHTML = '';
      const countEl = catBox.querySelector('.cat-count');
      if (countEl) countEl.textContent = `(${state.atributos.categorias.length})`;

      if (state.atributos.categorias.length === 0) {
        catList.innerHTML = `<p class="text-xs text-slate-400 italic text-center py-4">No hay categorías registradas.</p>`;
        return;
      }

      state.atributos.categorias.forEach((c) => {
        const item = document.createElement('div');
        item.className =
          'flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs';
        item.innerHTML = `
          <div class="space-y-0.5">
            <p class="text-xs font-bold text-slate-900 dark:text-white">${escapeHtml(c.nombre)}</p>
            <span class="inline-flex items-center gap-1 text-[10px] font-semibold ${
              c.activo ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
            }">
              <span class="w-1.5 h-1.5 rounded-full ${c.activo ? 'bg-emerald-500' : 'bg-slate-400'}"></span>
              ${c.activo ? 'Activa' : 'Inactiva'}
            </span>
          </div>
          <div class="flex items-center gap-1">
            <button type="button" class="btn-edit p-1.5 text-slate-400 hover:text-brand transition cursor-pointer" title="Editar">
              <i class="fa-regular fa-pen-to-square text-xs"></i>
            </button>
            <button type="button" class="btn-toggle text-[11px] px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer">
              ${c.activo ? 'Desactivar' : 'Activar'}
            </button>
            <button type="button" class="btn-del p-1.5 text-slate-400 hover:text-danger transition cursor-pointer" title="Enviar a Reciclaje">
              <i class="fa-regular fa-trash-can text-xs"></i>
            </button>
          </div>
        `;

        item.querySelector('.btn-edit').addEventListener('click', () => openEditCategoriaModal(c));
        item.querySelector('.btn-toggle').addEventListener('click', async (e) => {
          e.target.disabled = true;
          try {
            await apiFetch(`/api/configuracion/categorias/${c.id}`, { method: 'PATCH' });
            c.activo = !c.activo;
            refreshCategoriasList();
            toast.success(`Categoría ${c.activo ? 'activada' : 'desactivada'}.`);
          } catch (err) {
            toast.error(err.message || 'No se pudo cambiar el estado.');
          } finally {
            e.target.disabled = false;
          }
        });
        item.querySelector('.btn-del').addEventListener('click', () => {
          openConfirmModal({
            title: 'Enviar Categoría a Reciclaje',
            message: `¿Desea enviar la categoría <strong>"${escapeHtml(c.nombre)}"</strong> a Reciclaje?`,
            confirmText: 'Sí, enviar a reciclaje',
            cancelText: 'Cancelar',
            onConfirm: async ({ setLoading }) => {
              setLoading(true);
              try {
                await apiFetch(`/api/configuracion/categorias/${c.id}`, { method: 'DELETE' });
                state.atributos.categorias = state.atributos.categorias.filter((x) => x.id !== c.id);
                refreshCategoriasList();
                toast.success('Categoría enviada a Reciclaje.');
              } catch (err) {
                toast.error(err.message || 'No se pudo borrar.');
                return false;
              } finally {
                setLoading(false);
              }
            },
          });
        });

        catList.appendChild(item);
      });
    }

    refreshCategoriasList();
    catBox.appendChild(catList);

    // ---------------------------------------------------------
    // Columna 2: Marcas
    // ---------------------------------------------------------
    const mrcBox = document.createElement('div');
    mrcBox.className =
      'p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-3';

    const mrcHeader = document.createElement('div');
    mrcHeader.className = 'flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700/60';
    mrcHeader.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="w-2 h-2 rounded-full bg-brand"></span>
        <h3 class="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">Marcas</h3>
        <span class="mrc-count text-[11px] font-mono font-bold text-slate-400">(${state.atributos.marcas.length})</span>
      </div>
    `;

    const addMrcBtn = createButton({
      text: 'Nueva',
      icon: 'fa-solid fa-plus',
      variant: 'primary',
      size: 'sm',
      onClick: () => openAddMarcaModal(),
    });
    mrcHeader.appendChild(addMrcBtn);
    mrcBox.appendChild(mrcHeader);

    const mrcList = document.createElement('div');
    mrcList.className = 'space-y-2';

    function refreshMarcasList() {
      mrcList.innerHTML = '';
      const countEl = mrcBox.querySelector('.mrc-count');
      if (countEl) countEl.textContent = `(${state.atributos.marcas.length})`;

      if (state.atributos.marcas.length === 0) {
        mrcList.innerHTML = `<p class="text-xs text-slate-400 italic text-center py-4">No hay marcas registradas.</p>`;
        return;
      }

      state.atributos.marcas.forEach((m) => {
        const item = document.createElement('div');
        item.className =
          'flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs';
        item.innerHTML = `
          <div class="space-y-0.5">
            <p class="text-xs font-bold text-slate-900 dark:text-white">${escapeHtml(m.nombre)}</p>
            <span class="inline-flex items-center gap-1 text-[10px] font-semibold ${
              m.activo ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
            }">
              <span class="w-1.5 h-1.5 rounded-full ${m.activo ? 'bg-emerald-500' : 'bg-slate-400'}"></span>
              ${m.activo ? 'Activa' : 'Inactiva'}
            </span>
          </div>
          <div class="flex items-center gap-1">
            <button type="button" class="btn-edit p-1.5 text-slate-400 hover:text-brand transition cursor-pointer" title="Editar">
              <i class="fa-regular fa-pen-to-square text-xs"></i>
            </button>
            <button type="button" class="btn-toggle text-[11px] px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer">
              ${m.activo ? 'Desactivar' : 'Activar'}
            </button>
            <button type="button" class="btn-del p-1.5 text-slate-400 hover:text-danger transition cursor-pointer" title="Enviar a Reciclaje">
              <i class="fa-regular fa-trash-can text-xs"></i>
            </button>
          </div>
        `;

        item.querySelector('.btn-edit').addEventListener('click', () => openEditMarcaModal(m));
        item.querySelector('.btn-toggle').addEventListener('click', async (e) => {
          e.target.disabled = true;
          try {
            await apiFetch(`/api/configuracion/marcas/${m.id}`, { method: 'PATCH' });
            m.activo = !m.activo;
            refreshMarcasList();
            toast.success(`Marca ${m.activo ? 'activada' : 'desactivada'}.`);
          } catch (err) {
            toast.error(err.message || 'No se pudo cambiar el estado.');
          } finally {
            e.target.disabled = false;
          }
        });
        item.querySelector('.btn-del').addEventListener('click', () => {
          openConfirmModal({
            title: 'Enviar Marca a Reciclaje',
            message: `¿Desea enviar la marca <strong>"${escapeHtml(m.nombre)}"</strong> a Reciclaje?`,
            confirmText: 'Sí, enviar a reciclaje',
            cancelText: 'Cancelar',
            onConfirm: async ({ setLoading }) => {
              setLoading(true);
              try {
                await apiFetch(`/api/configuracion/marcas/${m.id}`, { method: 'DELETE' });
                state.atributos.marcas = state.atributos.marcas.filter((x) => x.id !== m.id);
                refreshMarcasList();
                toast.success('Marca enviada a Reciclaje.');
              } catch (err) {
                toast.error(err.message || 'No se pudo borrar.');
                return false;
              } finally {
                setLoading(false);
              }
            },
          });
        });

        mrcList.appendChild(item);
      });
    }

    refreshMarcasList();
    mrcBox.appendChild(mrcList);

    // ---------------------------------------------------------
    // Columna 3: Unidades de Medida
    // ---------------------------------------------------------
    const uniBox = document.createElement('div');
    uniBox.className =
      'p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-3';

    const uniHeader = document.createElement('div');
    uniHeader.className = 'flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700/60';
    uniHeader.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="w-2 h-2 rounded-full bg-brand"></span>
        <h3 class="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">Unidades de Medida</h3>
        <span class="uni-count text-[11px] font-mono font-bold text-slate-400">(${state.atributos.unidades.length})</span>
      </div>
    `;

    const addUniBtn = createButton({
      text: 'Nueva',
      icon: 'fa-solid fa-plus',
      variant: 'primary',
      size: 'sm',
      onClick: () => openAddUnidadModal(),
    });
    uniHeader.appendChild(addUniBtn);
    uniBox.appendChild(uniHeader);

    const uniList = document.createElement('div');
    uniList.className = 'space-y-2';

    function refreshUnidadesList() {
      uniList.innerHTML = '';
      const countEl = uniBox.querySelector('.uni-count');
      if (countEl) countEl.textContent = `(${state.atributos.unidades.length})`;

      if (state.atributos.unidades.length === 0) {
        uniList.innerHTML = `<p class="text-xs text-slate-400 italic text-center py-4">No hay unidades registradas.</p>`;
        return;
      }

      state.atributos.unidades.forEach((u) => {
        const item = document.createElement('div');
        item.className =
          'flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs';
        item.innerHTML = `
          <div class="space-y-0.5">
            <div class="flex items-center gap-1.5">
              <p class="text-xs font-bold text-slate-900 dark:text-white">${escapeHtml(u.nombre)}</p>
              <span class="px-1.5 py-0.2 rounded bg-brand-soft dark:bg-brand/20 text-brand text-[10px] font-mono font-bold">${escapeHtml(
                u.abreviatura
              )}</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="inline-flex items-center gap-1 text-[10px] font-semibold ${
                u.activo ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
              }">
                <span class="w-1.5 h-1.5 rounded-full ${u.activo ? 'bg-emerald-500' : 'bg-slate-400'}"></span>
                ${u.activo ? 'Activa' : 'Inactiva'}
              </span>
              <span class="text-[10px] text-slate-400">· ${u.permiteDecimales ? 'Admite decimales' : 'Solo enteros'}</span>
            </div>
          </div>
          <div class="flex items-center gap-1">
            <button type="button" class="btn-edit p-1.5 text-slate-400 hover:text-brand transition cursor-pointer" title="Editar">
              <i class="fa-regular fa-pen-to-square text-xs"></i>
            </button>
            <button type="button" class="btn-toggle text-[11px] px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer">
              ${u.activo ? 'Desactivar' : 'Activar'}
            </button>
            <button type="button" class="btn-del p-1.5 text-slate-400 hover:text-danger transition cursor-pointer" title="Enviar a Reciclaje">
              <i class="fa-regular fa-trash-can text-xs"></i>
            </button>
          </div>
        `;

        item.querySelector('.btn-edit').addEventListener('click', () => openEditUnidadModal(u));
        item.querySelector('.btn-toggle').addEventListener('click', async (e) => {
          e.target.disabled = true;
          try {
            await apiFetch(`/api/configuracion/unidades/${u.id}`, { method: 'PATCH' });
            u.activo = !u.activo;
            refreshUnidadesList();
            toast.success(`Unidad ${u.activo ? 'activada' : 'desactivada'}.`);
          } catch (err) {
            toast.error(err.message || 'No se pudo cambiar el estado.');
          } finally {
            e.target.disabled = false;
          }
        });
        item.querySelector('.btn-del').addEventListener('click', () => {
          openConfirmModal({
            title: 'Enviar Unidad a Reciclaje',
            message: `¿Desea enviar la unidad <strong>"${escapeHtml(u.nombre)}"</strong> a Reciclaje?`,
            confirmText: 'Sí, enviar a reciclaje',
            cancelText: 'Cancelar',
            onConfirm: async ({ setLoading }) => {
              setLoading(true);
              try {
                await apiFetch(`/api/configuracion/unidades/${u.id}`, { method: 'DELETE' });
                state.atributos.unidades = state.atributos.unidades.filter((x) => x.id !== u.id);
                refreshUnidadesList();
                toast.success('Unidad enviada a Reciclaje.');
              } catch (err) {
                toast.error(err.message || 'No se pudo borrar.');
                return false;
              } finally {
                setLoading(false);
              }
            },
          });
        });

        uniList.appendChild(item);
      });
    }

    refreshUnidadesList();
    uniBox.appendChild(uniList);

    colsGrid.append(catBox, mrcBox, uniBox);
    card.appendChild(colsGrid);
    parent.appendChild(card);

    // Helpers modales Categorías
    function openAddCategoriaModal() {
      const content = document.createElement('div');
      content.className = 'space-y-4';
      content.innerHTML = `
        <div>
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">Nombre de la Categoría *</label>
          <input type="text" class="inp-nom w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand" placeholder="Ej. Impresión Digital">
        </div>
      `;
      openModal({
        title: 'Nueva Categoría de Productos',
        content,
        confirmText: 'Crear Categoría',
        cancelText: 'Cancelar',
        onConfirm: async ({ setLoading, close }) => {
          const val = content.querySelector('.inp-nom').value.trim();
          if (!val) {
            toast.warning('Ingresa el nombre de la categoría.');
            return false;
          }
          setLoading(true);
          try {
            const res = await apiFetch('/api/configuracion/categorias', {
              method: 'POST',
              body: JSON.stringify({ nombre: val, activo: true }),
            });
            state.atributos.categorias.push({ id: res.id, nombre: val, activo: true });
            refreshCategoriasList();
            toast.success('Categoría creada exitosamente.');
            close();
          } catch (err) {
            toast.error(err.message || 'No se pudo crear la categoría.');
            return false;
          } finally {
            setLoading(false);
          }
        },
      });
    }

    function openEditCategoriaModal(c) {
      const content = document.createElement('div');
      content.className = 'space-y-4';
      content.innerHTML = `
        <div>
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">Nombre de la Categoría *</label>
          <input type="text" class="inp-nom w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand" value="${escapeHtml(
            c.nombre
          )}">
        </div>
      `;
      openModal({
        title: 'Editar Categoría',
        content,
        confirmText: 'Guardar Cambios',
        cancelText: 'Cancelar',
        onConfirm: async ({ setLoading, close }) => {
          const val = content.querySelector('.inp-nom').value.trim();
          if (!val) {
            toast.warning('Ingresa el nombre de la categoría.');
            return false;
          }
          setLoading(true);
          try {
            await apiFetch(`/api/configuracion/categorias/${c.id}`, {
              method: 'PUT',
              body: JSON.stringify({ nombre: val }),
            });
            c.nombre = val;
            refreshCategoriasList();
            toast.success('Categoría actualizada.');
            close();
          } catch (err) {
            toast.error(err.message || 'No se pudo actualizar.');
            return false;
          } finally {
            setLoading(false);
          }
        },
      });
    }

    // Helpers modales Marcas
    function openAddMarcaModal() {
      const content = document.createElement('div');
      content.className = 'space-y-4';
      content.innerHTML = `
        <div>
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">Nombre de la Marca *</label>
          <input type="text" class="inp-nom w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand" placeholder="Ej. Brother">
        </div>
      `;
      openModal({
        title: 'Nueva Marca',
        content,
        confirmText: 'Crear Marca',
        cancelText: 'Cancelar',
        onConfirm: async ({ setLoading, close }) => {
          const val = content.querySelector('.inp-nom').value.trim();
          if (!val) {
            toast.warning('Ingresa el nombre de la marca.');
            return false;
          }
          setLoading(true);
          try {
            const res = await apiFetch('/api/configuracion/marcas', {
              method: 'POST',
              body: JSON.stringify({ nombre: val, activo: true }),
            });
            state.atributos.marcas.push({ id: res.id, nombre: val, activo: true });
            refreshMarcasList();
            toast.success('Marca creada exitosamente.');
            close();
          } catch (err) {
            toast.error(err.message || 'No se pudo crear la marca.');
            return false;
          } finally {
            setLoading(false);
          }
        },
      });
    }

    function openEditMarcaModal(m) {
      const content = document.createElement('div');
      content.className = 'space-y-4';
      content.innerHTML = `
        <div>
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">Nombre de la Marca *</label>
          <input type="text" class="inp-nom w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand" value="${escapeHtml(
            m.nombre
          )}">
        </div>
      `;
      openModal({
        title: 'Editar Marca',
        content,
        confirmText: 'Guardar Cambios',
        cancelText: 'Cancelar',
        onConfirm: async ({ setLoading, close }) => {
          const val = content.querySelector('.inp-nom').value.trim();
          if (!val) {
            toast.warning('Ingresa el nombre de la marca.');
            return false;
          }
          setLoading(true);
          try {
            await apiFetch(`/api/configuracion/marcas/${m.id}`, {
              method: 'PUT',
              body: JSON.stringify({ nombre: val }),
            });
            m.nombre = val;
            refreshMarcasList();
            toast.success('Marca actualizada.');
            close();
          } catch (err) {
            toast.error(err.message || 'No se pudo actualizar.');
            return false;
          } finally {
            setLoading(false);
          }
        },
      });
    }

    // Helpers modales Unidades
    function openAddUnidadModal() {
      const content = document.createElement('div');
      content.className = 'space-y-3';
      content.innerHTML = `
        <div>
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">Nombre de la Unidad *</label>
          <input type="text" class="inp-nom w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand" placeholder="Ej. Metro Cuadrado">
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">Abreviatura / Símbolo *</label>
          <input type="text" class="inp-abr w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand" placeholder="Ej. m²">
        </div>
        <div class="pt-1">
          <label class="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" class="chk-dec rounded border-slate-300 text-brand focus:ring-brand accent-brand cursor-pointer">
            <span class="text-xs text-slate-700 dark:text-slate-300 font-medium">Permite fracciones / admite decimales</span>
          </label>
        </div>
      `;
      openModal({
        title: 'Nueva Unidad de Medida',
        content,
        confirmText: 'Crear Unidad',
        cancelText: 'Cancelar',
        onConfirm: async ({ setLoading, close }) => {
          const nom = content.querySelector('.inp-nom').value.trim();
          const abr = content.querySelector('.inp-abr').value.trim();
          const dec = content.querySelector('.chk-dec').checked;
          if (!nom || !abr) {
            toast.warning('Ingresa el nombre y la abreviatura.');
            return false;
          }
          setLoading(true);
          try {
            const res = await apiFetch('/api/configuracion/unidades', {
              method: 'POST',
              body: JSON.stringify({ nombre: nom, abreviatura: abr, permiteDecimales: dec, activo: true }),
            });
            state.atributos.unidades.push({ id: res.id, nombre: nom, abreviatura: abr, permiteDecimales: dec, activo: true });
            refreshUnidadesList();
            toast.success('Unidad de medida creada.');
            close();
          } catch (err) {
            toast.error(err.message || 'No se pudo crear la unidad.');
            return false;
          } finally {
            setLoading(false);
          }
        },
      });
    }

    function openEditUnidadModal(u) {
      const content = document.createElement('div');
      content.className = 'space-y-3';
      content.innerHTML = `
        <div>
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">Nombre de la Unidad *</label>
          <input type="text" class="inp-nom w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand" value="${escapeHtml(
            u.nombre
          )}">
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">Abreviatura / Símbolo *</label>
          <input type="text" class="inp-abr w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand" value="${escapeHtml(
            u.abreviatura
          )}">
        </div>
        <div class="pt-1">
          <label class="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" class="chk-dec rounded border-slate-300 text-brand focus:ring-brand accent-brand cursor-pointer" ${
              u.permiteDecimales ? 'checked' : ''
            }>
            <span class="text-xs text-slate-700 dark:text-slate-300 font-medium">Permite fracciones / admite decimales</span>
          </label>
        </div>
      `;
      openModal({
        title: 'Editar Unidad de Medida',
        content,
        confirmText: 'Guardar Cambios',
        cancelText: 'Cancelar',
        onConfirm: async ({ setLoading, close }) => {
          const nom = content.querySelector('.inp-nom').value.trim();
          const abr = content.querySelector('.inp-abr').value.trim();
          const dec = content.querySelector('.chk-dec').checked;
          if (!nom || !abr) {
            toast.warning('Ingresa el nombre y la abreviatura.');
            return false;
          }
          setLoading(true);
          try {
            await apiFetch(`/api/configuracion/unidades/${u.id}`, {
              method: 'PUT',
              body: JSON.stringify({ nombre: nom, abreviatura: abr, permiteDecimales: dec }),
            });
            u.nombre = nom;
            u.abreviatura = abr;
            u.permiteDecimales = dec;
            refreshUnidadesList();
            toast.success('Unidad de medida actualizada.');
            close();
          } catch (err) {
            toast.error(err.message || 'No se pudo actualizar.');
            return false;
          } finally {
            setLoading(false);
          }
        },
      });
    }
  }

  // ============================================================================
  // PESTAÑA 4: PRESUPUESTO — Diseñador de Plantillas Interactivo con @pdfme
  // ============================================================================
  let activeBudgetDesigner = null;

  function renderPresupuestoTab(parent) {
    if (activeBudgetDesigner) {
      try {
        activeBudgetDesigner.destroy();
      } catch (_) {}
      activeBudgetDesigner = null;
    }

    const card = document.createElement('section');
    card.className =
      'w-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 sm:p-7 shadow-xs space-y-6';

    // 1. Cabecera informativa
    const header = document.createElement('div');
    header.className =
      'flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800';
    header.innerHTML = `
      <div class="flex items-start gap-3">
        <span class="w-10 h-10 rounded-xl bg-brand-soft dark:bg-brand/20 text-brand flex items-center justify-center shrink-0">
          <i class="fa-regular fa-file-lines text-lg"></i>
        </span>
        <div>
          <div class="flex items-center gap-2">
            <h2 class="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
              Diseñador de Plantillas de Presupuestos
            </h2>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
              @pdfme Client-Side
            </span>
          </div>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            Diseñe visualmente la plantilla de cotización para R1 personalizados. Renderizado 100% en el navegador con soporte de variables dinámicas y tablas.
          </p>
        </div>
      </div>
      <div id="budget-actions-top" class="flex flex-wrap items-center gap-2"></div>
    `;
    card.appendChild(header);

    // Barra de acciones superiores
    const actionsTop = header.querySelector('#budget-actions-top');

    const btnRestablecer = createButton({
      text: 'Restablecer Base',
      icon: 'fa-solid fa-rotate-left',
      variant: 'cancel',
      size: 'sm',
      onClick: () => handleRestablecerBase(),
    });

    const btnPreview = createButton({
      text: 'Previsualizar PDF',
      icon: 'fa-regular fa-eye',
      variant: 'primary',
      size: 'sm',
      onClick: () => handlePrevisualizarPDF(),
    });

    const btnGuardar = createButton({
      text: 'Guardar Configuración',
      icon: 'fa-solid fa-floppy-disk',
      variant: 'primary',
      size: 'sm',
      onClick: () => handleGuardarTemplate(),
    });

    actionsTop.appendChild(btnRestablecer);
    actionsTop.appendChild(btnPreview);
    actionsTop.appendChild(btnGuardar);

    // 2. Barra de configuración de página y opciones
    const configBar = document.createElement('div');
    configBar.className =
      'grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 text-xs';
    configBar.innerHTML = `
      <div>
        <label class="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
          <i class="fa-solid fa-ruler-combined mr-1 text-brand"></i> Tamaño de Página
        </label>
        <select id="budget-page-size" class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-brand">
          <option value="A4" selected>A4 (210 × 297 mm)</option>
          <option value="Letter">Carta / Letter (215.9 × 279.4 mm)</option>
          <option value="Legal">Oficio / Legal (215.9 × 355.6 mm)</option>
          <option value="Custom">Personalizado (mm)</option>
        </select>
      </div>

      <div id="custom-size-container" class="hidden flex items-center gap-2">
        <div class="flex-1">
          <label class="block font-medium text-slate-600 dark:text-slate-400 mb-1">Ancho (mm)</label>
          <input type="number" id="budget-custom-w" value="210" min="50" max="600" class="w-full px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-xs" />
        </div>
        <div class="flex-1">
          <label class="block font-medium text-slate-600 dark:text-slate-400 mb-1">Alto (mm)</label>
          <input type="number" id="budget-custom-h" value="297" min="50" max="600" class="w-full px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-xs" />
        </div>
      </div>

      <div>
        <label class="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
          <i class="fa-solid fa-arrows-spin mr-1 text-brand"></i> Orientación
        </label>
        <select id="budget-orientation" class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-brand">
          <option value="portrait" selected>Vertical (Portrait)</option>
          <option value="landscape">Horizontal (Landscape)</option>
        </select>
      </div>

      <div class="flex flex-col justify-center">
        <span class="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
          <i class="fa-regular fa-image mr-1 text-brand"></i> Hoja 2 de Fotos
        </span>
        <div class="flex items-center justify-between">
          <span class="text-slate-500 dark:text-slate-400 text-[11px]">Grilla de imágenes presupuestadas</span>
          <label class="relative inline-flex items-center cursor-pointer select-none">
            <input type="checkbox" id="budget-toggle-fotos" class="sr-only peer" checked />
            <div class="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
          </label>
        </div>
      </div>
    `;
    card.appendChild(configBar);

    // 3. Panel de Variables Disponibles (Acordeón Cheatsheet)
    const varsPanel = document.createElement('details');
    varsPanel.className =
      'group rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-4 transition-all duration-150';
    varsPanel.innerHTML = `
      <summary class="flex items-center justify-between cursor-pointer list-none select-none text-xs font-semibold text-slate-800 dark:text-slate-200">
        <span class="flex items-center gap-2">
          <i class="fa-solid fa-code text-brand"></i>
          Mapeo de Variables Disponibles en el Diseñador (Haga clic sobre una variable para copiar)
        </span>
        <span class="text-slate-400 group-open:rotate-180 transition-transform duration-200">
          <i class="fa-solid fa-chevron-down text-xs"></i>
        </span>
      </summary>
      <div class="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-800 space-y-3 text-xs">
        <div>
          <span class="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
            <i class="fa-regular fa-building mr-1 text-slate-400"></i> Datos Institucionales:
          </span>
          <div class="flex flex-wrap gap-1.5" data-vars-group="institucional">
            <button type="button" class="var-badge" data-var="{{empresa_logo}}">{{empresa_logo}}</button>
            <button type="button" class="var-badge" data-var="{{empresa_redes}}">{{empresa_redes}}</button>
            <button type="button" class="var-badge" data-var="{{empresa_web}}">{{empresa_web}}</button>
            <button type="button" class="var-badge" data-var="{{empresa_telefono}}">{{empresa_telefono}}</button>
            <button type="button" class="var-badge" data-var="{{empresa_locacion}}">{{empresa_locacion}}</button>
          </div>
        </div>

        <div>
          <span class="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
            <i class="fa-regular fa-user mr-1 text-slate-400"></i> Cabecera y Cliente:
          </span>
          <div class="flex flex-wrap gap-1.5" data-vars-group="cabecera">
            <button type="button" class="var-badge" data-var="{{cliente_nombre}}">{{cliente_nombre}}</button>
            <button type="button" class="var-badge" data-var="{{cliente_ruc}}">{{cliente_ruc}}</button>
            <button type="button" class="var-badge" data-var="{{cliente_telefono}}">{{cliente_telefono}}</button>
            <button type="button" class="var-badge" data-var="{{fecha_emision}}">{{fecha_emision}}</button>
            <button type="button" class="var-badge" data-var="{{validez_dias}}">{{validez_dias}}</button>
            <button type="button" class="var-badge" data-var="{{validez_fecha}}">{{validez_fecha}}</button>
            <button type="button" class="var-badge" data-var="{{numero_presupuesto}}">{{numero_presupuesto}}</button>
          </div>
        </div>

        <div>
          <span class="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
            <i class="fa-solid fa-table-list mr-1 text-slate-400"></i> Tabla de Artículos:
          </span>
          <div class="flex flex-wrap gap-1.5" data-vars-group="tabla">
            <button type="button" class="var-badge" data-var="{{articulos_tabla}}">{{articulos_tabla}} (Tabla Completa)</button>
            <button type="button" class="var-badge" data-var="{{item_descripcion}}">{{item_descripcion}}</button>
            <button type="button" class="var-badge" data-var="{{item_precio_unitario}}">{{item_precio_unitario}}</button>
            <button type="button" class="var-badge" data-var="{{item_cantidad}}">{{item_cantidad}}</button>
            <button type="button" class="var-badge" data-var="{{item_total}}">{{item_total}}</button>
          </div>
        </div>

        <div>
          <span class="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
            <i class="fa-solid fa-calculator mr-1 text-slate-400"></i> Descuentos y Totales:
          </span>
          <div class="flex flex-wrap gap-1.5" data-vars-group="totales">
            <button type="button" class="var-badge" data-var="{{subtotal}}">{{subtotal}}</button>
            <button type="button" class="var-badge" data-var="{{porcentaje_descuento}}">{{porcentaje_descuento}}</button>
            <button type="button" class="var-badge" data-var="{{monto_descuento}}">{{monto_descuento}}</button>
            <button type="button" class="var-badge" data-var="{{total_final}}">{{total_final}}</button>
          </div>
        </div>

        <div>
          <span class="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
            <i class="fa-regular fa-file-lines mr-1 text-slate-400"></i> Bloque de Términos y Hoja de Fotos:
          </span>
          <div class="flex flex-wrap gap-1.5" data-vars-group="otros">
            <button type="button" class="var-badge" data-var="{{terminos_condiciones}}">{{terminos_condiciones}}</button>
            <button type="button" class="var-badge" data-var="{{foto_producto_1}}">{{foto_producto_1}}</button>
            <button type="button" class="var-badge" data-var="{{foto_producto_2}}">{{foto_producto_2}}</button>
            <button type="button" class="var-badge" data-var="{{foto_producto_3}}">{{foto_producto_3}}</button>
            <button type="button" class="var-badge" data-var="{{foto_producto_4}}">{{foto_producto_4}}</button>
            <button type="button" class="var-badge" data-var="{{foto_producto_5}}">{{foto_producto_5}}</button>
          </div>
        </div>
      </div>
    `;

    // Eventos de copiado rápido al hacer clic en un badge de variable
    varsPanel.querySelectorAll('.var-badge').forEach((btn) => {
      btn.className =
        'inline-flex items-center px-2 py-1 rounded-md text-[11px] font-mono font-medium bg-slate-200/80 dark:bg-slate-800 text-brand dark:text-brand-hover hover:bg-brand-soft dark:hover:bg-brand/20 transition-colors border border-slate-300/60 dark:border-slate-700/60';
      btn.addEventListener('click', () => {
        const text = btn.getAttribute('data-var');
        if (navigator.clipboard) {
          navigator.clipboard.writeText(text).then(() => {
            toast.success(`Copiado: ${text}`);
          });
        }
      });
    });

    card.appendChild(varsPanel);

    // 4. Bloque de Términos y Condiciones editable
    const termsBlock = document.createElement('details');
    termsBlock.className =
      'group rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-4 transition-all duration-150';
    termsBlock.innerHTML = `
      <summary class="flex items-center justify-between cursor-pointer list-none select-none text-xs font-semibold text-slate-800 dark:text-slate-200">
        <span class="flex items-center gap-2">
          <i class="fa-solid fa-list-check text-brand"></i>
          Cláusulas de Términos y Condiciones Operativas (Texto precargado en {{terminos_condiciones}})
        </span>
        <span class="text-slate-400 group-open:rotate-180 transition-transform duration-200">
          <i class="fa-solid fa-chevron-down text-xs"></i>
        </span>
      </summary>
      <div class="mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-800 space-y-2">
        <p class="text-[11px] text-slate-500 dark:text-slate-400">
          Estas cláusulas se insertan automáticamente en el bloque inferior del presupuesto oficial:
        </p>
        <textarea id="budget-terms-input" rows="4" class="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-brand font-sans leading-relaxed">1. Validez de la oferta: Este presupuesto tiene una validez de 15 días corridos a partir de su fecha de emisión.
2. Condiciones de pago: El pedido se confirma con la entrega del 60%, por medio de efectivo o transferencia bancaria.
3. Plazos de entrega: Tiempo estimado de 3 a 5 días hábiles posterior a la aprobación del diseño y confirmación de seña.
4. Garantía y cambios: Tratándose de artículos personalizados, no se admiten cancelaciones una vez iniciada la producción.</textarea>
      </div>
    `;
    card.appendChild(termsBlock);

    // 5. Contenedor interactivo del Diseñador (@pdfme/ui)
    const designerWrapper = document.createElement('div');
    designerWrapper.className = 'w-full space-y-2';

    const designerCanvas = document.createElement('div');
    designerCanvas.id = 'pdfme-designer-holder';
    designerCanvas.className =
      'w-full h-[760px] min-h-[600px] rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 overflow-hidden relative shadow-inner';

    // Spinner de carga inicial
    designerCanvas.innerHTML = `
      <div class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xs z-10" id="designer-loading-overlay">
        <i class="fa-solid fa-circle-notch fa-spin text-3xl text-brand"></i>
        <div class="text-center">
          <p class="text-sm font-semibold text-slate-800 dark:text-slate-200">
            Cargando Diseñador @pdfme...
          </p>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            Descargando plantilla base y módulos interactivos
          </p>
        </div>
      </div>
    `;

    designerWrapper.appendChild(designerCanvas);
    card.appendChild(designerWrapper);
    parent.appendChild(card);

    // =========================================================================
    // Lógica de Inicialización de @pdfme/ui Designer
    // =========================================================================
    let currentTemplate = null;

    async function initDesigner() {
      try {
        const { Designer, plugins } = await loadPdfmeLibraries();

        // 1. Obtener plantilla desde backend o fallback
        const templateData = await apiFetch('/api/config/budget-template').catch(() => null);
        currentTemplate = templateData || (await BudgetDocumentService.getDefaultBudgetTemplate());

        // 2. Resolver basePdf
        const resolvedBase = await resolveBasePdf(currentTemplate.basePdf);
        const designerTemplate = {
          ...currentTemplate,
          basePdf: resolvedBase,
        };

        // 3. Limpiar contenedor
        designerCanvas.innerHTML = '';

        // 4. Instanciar @pdfme Designer
        activeBudgetDesigner = new Designer({
          domContainer: designerCanvas,
          template: designerTemplate,
          plugins,
        });

        // 5. Sincronizar selectores de tamaño y orientación
        const selectSize = card.querySelector('#budget-page-size');
        const selectOrient = card.querySelector('#budget-orientation');
        if (currentTemplate.pageSize && selectSize) {
          selectSize.value = currentTemplate.pageSize;
        }
        if (currentTemplate.orientation && selectOrient) {
          selectOrient.value = currentTemplate.orientation;
        }

        toast.info('Diseñador cargado exitosamente');
      } catch (err) {
        console.error('Error al inicializar diseñador @pdfme:', err);
        designerCanvas.innerHTML = `
          <div class="p-8 text-center text-slate-500 dark:text-slate-400 space-y-3">
            <i class="fa-solid fa-triangle-exclamation text-3xl text-amber-500"></i>
            <p class="text-sm font-semibold text-slate-800 dark:text-slate-200">
              No se pudo inicializar el Diseñador interactivo
            </p>
            <p class="text-xs max-w-md mx-auto">
              ${escapeHtml(err.message || 'Verifique la conexión a internet para descargar las librerías de @pdfme')}
            </p>
            <div class="pt-2">
              <button type="button" id="btn-reintentar-designer" class="px-4 py-2 rounded-lg bg-brand text-white text-xs font-semibold hover:bg-brand-hover">
                Reintentar
              </button>
            </div>
          </div>
        `;
        const retryBtn = designerCanvas.querySelector('#btn-reintentar-designer');
        if (retryBtn) retryBtn.addEventListener('click', () => initDesigner());
      }
    }

    // Iniciar carga del diseñador
    initDesigner();

    // =========================================================================
    // Handlers de Acciones (Guardar, Previsualizar, Restablecer)
    // =========================================================================

    async function handleGuardarTemplate() {
      if (!activeBudgetDesigner) {
        toast.error('El diseñador aún no está activo');
        return;
      }
      btnGuardar.disabled = true;
      try {
        const updated = activeBudgetDesigner.getTemplate();
        const termsInput = card.querySelector('#budget-terms-input');
        const pageSize = card.querySelector('#budget-page-size')?.value || 'A4';
        const orientation = card.querySelector('#budget-orientation')?.value || 'portrait';

        // Serializar estructura del template asegurando persistencia de basePdf
        const payload = {
          ...updated,
          basePdf: currentTemplate?.basePdf || '/templates/presupuesto_base.pdf',
          pageSize,
          orientation,
          terminos_condiciones_default: termsInput?.value || '',
        };

        const res = await apiFetch('/api/config/budget-template', {
          method: 'POST',
          body: JSON.stringify(payload),
        });

        toast.success(res?.message || 'Plantilla de presupuesto guardada con éxito');
      } catch (err) {
        console.error('Error al guardar plantilla:', err);
        toast.error('Error al guardar la plantilla: ' + (err.message || 'Error desconocido'));
      } finally {
        btnGuardar.disabled = false;
      }
    }

    async function handlePrevisualizarPDF() {
      btnPreview.disabled = true;
      try {
        toast.info('Generando documento de presupuesto con @pdfme...');
        await BudgetDocumentService.generateBudgetPDF('PRES-2026-0003', {
          openInNewTab: true,
          download: false,
        });
        toast.success('Documento generado en nueva pestaña');
      } catch (err) {
        console.error('Error al previsualizar presupuesto:', err);
        toast.error('Error al generar PDF: ' + (err.message || 'Error desconocido'));
      } finally {
        btnPreview.disabled = false;
      }
    }

    async function handleRestablecerBase() {
      openConfirmModal({
        title: 'Restablecer Plantilla Base',
        message:
          '¿Desea restablecer el diseñador a la plantilla base oficial predeterminada de R1 Personalizados?',
        confirmText: 'Restablecer',
        confirmVariant: 'danger',
        onConfirm: async ({ close }) => {
          if (typeof close === 'function') close();
          try {
            const defaultTpl = await BudgetDocumentService.getDefaultBudgetTemplate();
            currentTemplate = defaultTpl;
            const resolvedBase = await resolveBasePdf(defaultTpl.basePdf);
            if (activeBudgetDesigner) {
              activeBudgetDesigner.updateTemplate({
                ...defaultTpl,
                basePdf: resolvedBase,
              });
              toast.success('Plantilla base restablecida');
            }
          } catch (err) {
            toast.error('Error al restablecer plantilla: ' + err.message);
          }
        },
      });
    }

    // Eventos de Selectores de Tamaño y Orientación
    const selectSize = card.querySelector('#budget-page-size');
    const customContainer = card.querySelector('#custom-size-container');
    const selectOrient = card.querySelector('#budget-orientation');

    if (selectSize) {
      selectSize.addEventListener('change', () => {
        if (selectSize.value === 'Custom') {
          customContainer.classList.remove('hidden');
        } else {
          customContainer.classList.add('hidden');
        }
      });
    }
  }

  // ============================================================================
  // PESTAÑA 5: PERFIL (Configuración del Perfil — Foto 4)
  // ============================================================================
  function renderPerfilTab(parent) {
    const card = document.createElement('section');
    card.className =
      'w-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 sm:p-7 shadow-xs space-y-6';

    const p = state.perfil;

    function calculateAge(birthDateStr) {
      if (!birthDateStr) return '';
      const birth = new Date(birthDateStr);
      if (isNaN(birth.getTime())) return '';
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
        age--;
      }
      return `${Math.max(0, age)} años`;
    }

    const header = document.createElement('div');
    header.className =
      'flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800';
    header.innerHTML = `
      <div class="flex items-start gap-3">
        <span class="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-brand flex items-center justify-center shrink-0">
          <i class="fa-regular fa-user text-lg"></i>
        </span>
        <div>
          <h2 class="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
            Configuración del Perfil
          </h2>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            Consulte y edite su información de usuario, fotografía de perfil, datos de cuenta y credenciales de acceso.
          </p>
        </div>
      </div>
      <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-brand-soft dark:bg-brand/20 text-brand">
        <span class="w-1.5 h-1.5 rounded-full bg-brand"></span>
        Rol: ${escapeHtml(p.role ? p.role.charAt(0).toUpperCase() + p.role.slice(1) : 'Administrador')}
      </span>
    `;
    card.appendChild(header);

    // Formulario principal de perfil
    const formGrid = document.createElement('div');
    formGrid.className = 'grid grid-cols-1 lg:grid-cols-12 gap-6 items-start';

    // Foto de perfil
    const photoBox = document.createElement('div');
    photoBox.className =
      'lg:col-span-4 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col items-center justify-center text-center space-y-3';

    let currentFotoData = p.fotoPerfil || '';

    const avatarCircle = document.createElement('div');
    avatarCircle.className =
      'w-24 h-24 rounded-full border-2 border-brand/40 bg-brand-soft dark:bg-brand/20 flex items-center justify-center text-brand font-bold text-2xl overflow-hidden shadow-xs relative';

    function refreshAvatarPreview() {
      if (currentFotoData) {
        avatarCircle.innerHTML = `<img src="${currentFotoData}" alt="Foto Perfil" class="w-full h-full object-cover">`;
      } else {
        const initials = (p.fullName || p.username || 'AD')
          .split(' ')
          .map((n) => n[0])
          .slice(0, 2)
          .join('')
          .toUpperCase();
        avatarCircle.innerHTML = `<span>${initials}</span>`;
      }
    }
    refreshAvatarPreview();

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/jpeg,image/png,image/webp';
    fileInput.className = 'hidden';

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) {
        toast.warning('La imagen supera el tamaño máximo permitido de 10 MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        currentFotoData = ev.target.result;
        refreshAvatarPreview();
        toast.info('Fotografía cargada. Haz clic en "Guardar Perfil" para aplicar.');
      };
      reader.readAsDataURL(file);
    });

    const choosePhotoBtn = createButton({
      text: 'Elegir foto',
      icon: 'fa-regular fa-image',
      variant: 'primary',
      size: 'sm',
      onClick: () => fileInput.click(),
    });

    photoBox.append(
      avatarCircle,
      choosePhotoBtn,
      fileInput,
      (() => {
        const hint = document.createElement('p');
        hint.className = 'text-[11px] text-slate-400 dark:text-slate-500';
        hint.innerHTML = 'Formatos admitidos: JPG, PNG o WebP.<br>Tamaño máx: 10 MB';
        return hint;
      })()
    );

    // Campos de datos personales
    const fieldsBox = document.createElement('div');
    fieldsBox.className = 'lg:col-span-8 space-y-4';

    fieldsBox.innerHTML = `
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
            NOMBRE DE USUARIO <span class="text-danger">*</span>
          </label>
          <input type="text" class="inp-username w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand" value="${escapeHtml(
            p.username
          )}">
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
            FECHA DE NACIMIENTO
          </label>
          <input type="date" class="inp-birth w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand" value="${escapeHtml(
            p.fechaNacimiento || ''
          )}">
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
            EDAD (calculada automáticamente)
          </label>
          <div class="relative">
            <input type="text" readonly class="inp-age w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-brand font-semibold cursor-not-allowed" value="${escapeHtml(
              calculateAge(p.fechaNacimiento)
            )}">
            <span class="absolute right-2.5 top-2.5 text-[10px] font-bold uppercase text-slate-400">Automático</span>
          </div>
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
            CORREO ELECTRÓNICO
          </label>
          <div class="relative">
            <input type="text" readonly class="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-500 cursor-not-allowed" value="${escapeHtml(
              p.email
            )}">
            <span class="absolute right-2.5 top-2.5 text-[10px] font-bold uppercase text-slate-400">SOLO LECTURA</span>
          </div>
        </div>
      </div>
    `;

    const inpBirth = fieldsBox.querySelector('.inp-birth');
    const inpAge = fieldsBox.querySelector('.inp-age');
    inpBirth.addEventListener('input', () => {
      inpAge.value = calculateAge(inpBirth.value);
    });

    formGrid.append(photoBox, fieldsBox);
    card.appendChild(formGrid);

    // Card 2: Cambio de Contraseña (Opcional)
    const passCard = document.createElement('div');
    passCard.className =
      'p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-4';
    passCard.innerHTML = `
      <div>
        <h3 class="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <i class="fa-solid fa-lock text-brand"></i>
          Cambio de Contraseña (Opcional)
        </h3>
        <p class="text-xs text-slate-500 dark:text-slate-400">
          Si no desea modificar su contraseña actual, deje estos campos vacíos. Para cambiarla, ingrese su contraseña actual y la nueva contraseña deseada.
        </p>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">Contraseña Actual</label>
          <div class="relative">
            <input type="password" class="inp-cur-pass w-full px-3.5 py-2 pr-9 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand" placeholder="••••••••">
            <button type="button" class="btn-toggle-cur-pass absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer">
              <i class="fa-regular fa-eye text-xs"></i>
            </button>
          </div>
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">Nueva Contraseña</label>
          <div class="relative">
            <input type="password" class="inp-new-pass w-full px-3.5 py-2 pr-9 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand" placeholder="Mínimo 6 caracteres">
            <button type="button" class="btn-toggle-new-pass absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer">
              <i class="fa-regular fa-eye text-xs"></i>
            </button>
          </div>
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">Confirmar Contraseña</label>
          <div class="relative">
            <input type="password" class="inp-conf-pass w-full px-3.5 py-2 pr-9 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand" placeholder="Repetir nueva contraseña">
            <button type="button" class="btn-toggle-conf-pass absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer">
              <i class="fa-regular fa-eye text-xs"></i>
            </button>
          </div>
        </div>
      </div>
    `;

    function bindTogglePass(btnSelector, inpSelector) {
      const btn = passCard.querySelector(btnSelector);
      const inp = passCard.querySelector(inpSelector);
      btn?.addEventListener('click', () => {
        const isPass = inp.type === 'password';
        inp.type = isPass ? 'text' : 'password';
        btn.innerHTML = `<i class="fa-regular ${isPass ? 'fa-eye-slash' : 'fa-eye'} text-xs"></i>`;
      });
    }
    bindTogglePass('.btn-toggle-cur-pass', '.inp-cur-pass');
    bindTogglePass('.btn-toggle-new-pass', '.inp-new-pass');
    bindTogglePass('.btn-toggle-conf-pass', '.inp-conf-pass');

    card.appendChild(passCard);

    // Card 3: Cierre Automático de Sesión por Inactividad
    const timeoutCard = document.createElement('div');
    timeoutCard.className =
      'p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-4';
    timeoutCard.innerHTML = `
      <div>
        <h3 class="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <i class="fa-regular fa-clock text-brand"></i>
          Cierre Automático de Sesión por Inactividad
        </h3>
        <p class="text-xs text-slate-500 dark:text-slate-400">
          Cierra la sesión automáticamente cuando no se detecta interacción en el sistema (teclado, mouse o pantalla), protegiendo su cuenta.
        </p>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
        <div class="sm:col-span-8">
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
            Tiempo de Espera antes de Cerrar Sesión
          </label>
          <select class="sel-timeout w-full min-h-[40px] px-3.5 py-2 text-xs sm:text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand">
            <option value="0" ${p.autoLogoutMinutes === 0 ? 'selected' : ''}>Desactivado (Sin límite de tiempo)</option>
            <option value="15" ${p.autoLogoutMinutes === 15 ? 'selected' : ''}>15 minutos</option>
            <option value="30" ${p.autoLogoutMinutes === 30 ? 'selected' : ''}>30 minutos</option>
            <option value="60" ${p.autoLogoutMinutes === 60 ? 'selected' : ''}>1 hora</option>
            <option value="120" ${p.autoLogoutMinutes === 120 ? 'selected' : ''}>2 horas</option>
          </select>
        </div>
        <div class="sm:col-span-4 flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
          <div>
            <p class="text-[10px] font-bold uppercase text-slate-400">Tiempo restante de inactividad</p>
            <p class="txt-rem-time text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
              ${p.autoLogoutMinutes === 0 ? 'Desactivado sin límite' : `${p.autoLogoutMinutes} min`}
            </p>
          </div>
          <button type="button" class="btn-reset-timer px-2.5 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
            <i class="fa-solid fa-rotate-right text-[10px]"></i> Reiniciar
          </button>
        </div>
      </div>
    `;

    const selTimeout = timeoutCard.querySelector('.sel-timeout');
    const txtRemTime = timeoutCard.querySelector('.txt-rem-time');
    selTimeout.addEventListener('change', () => {
      const v = Number(selTimeout.value);
      txtRemTime.textContent = v === 0 ? 'Desactivado sin límite' : `${v} min`;
    });

    timeoutCard.querySelector('.btn-reset-timer')?.addEventListener('click', () => {
      const v = Number(selTimeout.value);
      txtRemTime.textContent = v === 0 ? 'Desactivado sin límite' : `${v} min`;
      toast.info('Temporizador de inactividad reiniciado.');
    });

    card.appendChild(timeoutCard);

    // Botón Guardar Perfil
    const footer = document.createElement('div');
    footer.className = 'flex items-center justify-end pt-3 border-t border-slate-100 dark:border-slate-800';

    const saveBtn = createButton({
      text: 'Guardar Perfil',
      icon: 'fa-solid fa-check',
      variant: 'primary',
      size: 'md',
      onClick: async (_, btn) => {
        const newUsername = fieldsBox.querySelector('.inp-username').value.trim();
        const curPass = passCard.querySelector('.inp-cur-pass').value;
        const newPass = passCard.querySelector('.inp-new-pass').value;
        const confPass = passCard.querySelector('.inp-conf-pass').value;

        if (!newUsername) {
          toast.warning('El nombre de usuario es obligatorio.');
          return;
        }

        if (newPass || confPass || curPass) {
          if (!curPass) {
            toast.warning('Ingresa tu contraseña actual para confirmar el cambio.');
            return;
          }
          if (newPass.length < 6) {
            toast.warning('La nueva contraseña debe tener al menos 6 caracteres.');
            return;
          }
          if (newPass !== confPass) {
            toast.warning('La nueva contraseña y su confirmación no coinciden.');
            return;
          }
        }

        btn.setLoading(true);
        try {
          await apiFetch('/api/configuracion/perfil', {
            method: 'PUT',
            body: JSON.stringify({
              username: newUsername,
              fechaNacimiento: inpBirth.value,
              fotoPerfil: currentFotoData,
              autoLogoutMinutes: Number(selTimeout.value),
              currentPassword: curPass,
              newPassword: newPass,
            }),
          });
          p.username = newUsername;
          p.fechaNacimiento = inpBirth.value;
          p.fotoPerfil = currentFotoData;
          p.autoLogoutMinutes = Number(selTimeout.value);

          passCard.querySelector('.inp-cur-pass').value = '';
          passCard.querySelector('.inp-new-pass').value = '';
          passCard.querySelector('.inp-conf-pass').value = '';

          toast.success('Perfil de usuario actualizado exitosamente.');
        } catch (err) {
          toast.error(err.message || 'No se pudo actualizar el perfil.');
        } finally {
          btn.setLoading(false);
        }
      },
    });

    footer.appendChild(saveBtn);
    card.appendChild(footer);
    parent.appendChild(card);
  }

  // ============================================================================
  // PESTAÑA 6: GENERAL (Datos Generales de la Empresa — Foto 5)
  // ============================================================================
  function renderGeneralTab(parent) {
    const card = document.createElement('section');
    card.className =
      'w-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 sm:p-7 shadow-xs space-y-6';

    const emp = state.configs.empresa_datos || {
      logo_url: './logo/r1.png',
      razon_social: 'NETZ - R1 Personalizados',
      ruc: '00012345-0',
      propietario: 'Juan Pérez',
      email: 'contacto@netz.com.py',
      telefonos: ['+595 981 123456'],
      direccion: 'Asunción, Paraguay',
      horario_atencion: 'Lunes a Viernes de 08:00 a 18:00 hs - Sábados de 08:00 a 12:00 hs',
      gps_enlace: 'https://maps.google.com/?q=-25.285,-57.6470',
      redes: {
        facebook: 'https://facebook.com/r1personalizados',
        instagram: 'https://instagram.com/r1personalizados',
        tiktok: 'https://tiktok.com/@r1personalizados',
        sitio_web: 'https://netz.com.py',
      },
    };

    const header = document.createElement('div');
    header.className =
      'flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800';
    header.innerHTML = `
      <div class="flex items-start gap-3">
        <span class="w-10 h-10 rounded-xl bg-brand-soft dark:bg-brand/20 text-brand flex items-center justify-center shrink-0">
          <i class="fa-regular fa-building text-lg"></i>
        </span>
        <div>
          <h2 class="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
            Datos Generales de la Empresa
          </h2>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            Configure la información oficial, canales de contacto, horarios y la identidad corporativa de su empresa.
          </p>
        </div>
      </div>
      <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-brand-soft dark:bg-brand/20 text-brand">
        <span class="w-1.5 h-1.5 rounded-full bg-brand"></span>
        Identidad Oficial
      </span>
    `;
    card.appendChild(header);

    // Bloque 1: Logo de la Empresa (Foto 5)
    const logoSection = document.createElement('div');
    logoSection.className =
      'p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-4';
    logoSection.innerHTML = `
      <div>
        <h3 class="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <i class="fa-regular fa-image text-brand"></i>
          Logo de la Empresa
        </h3>
        <p class="text-xs text-slate-500 dark:text-slate-400">
          Logotipo corporativo exclusivo para generación de presupuestos, facturas y comprobantes oficiales (no altera el logotipo del sistema).
        </p>
      </div>

      <div class="flex flex-col sm:flex-row items-center gap-5">
        <div class="logo-preview-box w-36 h-28 p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-center shrink-0 shadow-2xs overflow-hidden">
          <img src="${escapeHtml(emp.logo_url || './logo/r1.png')}" alt="Logo Empresa" class="max-w-full max-h-full object-contain">
        </div>

        <div class="space-y-3 flex-1 w-full">
          <div class="flex flex-wrap items-center gap-2">
            <input type="file" accept="image/*" class="inp-logo-file hidden">
            <button type="button" class="btn-subir-logo px-3 py-1.5 text-xs font-semibold rounded-lg bg-brand hover:bg-brand-hover text-white transition cursor-pointer">
              <i class="fa-solid fa-arrow-up-from-bracket mr-1"></i> Subir nuevo logo
            </button>
            <button type="button" class="btn-logo-netz px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer">
              Usar Logo NETZ
            </button>
            <button type="button" class="btn-logo-r1 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer">
              Usar Logo R1
            </button>
          </div>
          <div>
            <label class="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Ruta o Enlace directo del Logo:</label>
            <input type="text" class="inp-logo-url w-full px-3.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand font-mono" value="${escapeHtml(
              emp.logo_url || './logo/r1.png'
            )}">
          </div>
        </div>
      </div>
    `;

    const imgPreview = logoSection.querySelector('.logo-preview-box img');
    const inpLogoUrl = logoSection.querySelector('.inp-logo-url');
    const inpLogoFile = logoSection.querySelector('.inp-logo-file');

    logoSection.querySelector('.btn-subir-logo').addEventListener('click', () => inpLogoFile.click());
    inpLogoFile.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        imgPreview.src = ev.target.result;
        inpLogoUrl.value = ev.target.result;
      };
      reader.readAsDataURL(file);
    });

    logoSection.querySelector('.btn-logo-netz').addEventListener('click', () => {
      const netzUrl = 'https://netz.com.py/route1/img/header/NETZ-IA.svg';
      imgPreview.src = netzUrl;
      inpLogoUrl.value = netzUrl;
    });

    logoSection.querySelector('.btn-logo-r1').addEventListener('click', () => {
      const r1Url = './logo/r1.png';
      imgPreview.src = r1Url;
      inpLogoUrl.value = r1Url;
    });

    inpLogoUrl.addEventListener('input', () => {
      imgPreview.src = inpLogoUrl.value;
    });

    card.appendChild(logoSection);

    // Bloque 2: Campos Principales de la Empresa
    const infoGrid = document.createElement('div');
    infoGrid.className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4';

    infoGrid.innerHTML = `
      <div>
        <label class="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
          Nombre Completo / Razón Social <span class="text-danger">*</span>
        </label>
        <div class="relative">
          <input type="text" class="inp-razon w-full pl-8 pr-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand" value="${escapeHtml(
            emp.razon_social
          )}">
          <i class="fa-regular fa-building absolute left-2.5 top-2.5 text-xs text-slate-400"></i>
        </div>
      </div>

      <div>
        <label class="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
          RUC (Registro Único de Contribuyente) <span class="text-danger">*</span>
        </label>
        <div class="relative">
          <input type="text" class="inp-ruc w-full pl-8 pr-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand font-mono" value="${escapeHtml(
            emp.ruc
          )}">
          <i class="fa-regular fa-id-card absolute left-2.5 top-2.5 text-xs text-slate-400"></i>
        </div>
      </div>

      <div>
        <label class="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
          Propietario / Titular <span class="text-danger">*</span>
        </label>
        <div class="relative">
          <input type="text" class="inp-prop w-full pl-8 pr-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand" value="${escapeHtml(
            emp.propietario
          )}">
          <i class="fa-regular fa-user absolute left-2.5 top-2.5 text-xs text-slate-400"></i>
        </div>
      </div>

      <div class="sm:col-span-2">
        <label class="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
          Correo Electrónico Oficial
        </label>
        <div class="relative">
          <input type="email" class="inp-email w-full pl-8 pr-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand" value="${escapeHtml(
            emp.email
          )}">
          <i class="fa-regular fa-envelope absolute left-2.5 top-2.5 text-xs text-slate-400"></i>
        </div>
        <p class="text-[11px] text-slate-400 mt-1">Para consultas generales, comprobantes y notificaciones de clientes.</p>
      </div>

      <div class="phones-wrap sm:col-span-1 space-y-1.5">
        <div class="flex items-center justify-between">
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-200">
            Números de Teléfono <span class="text-danger">*</span>
          </label>
          <button type="button" class="btn-add-phone text-[11px] font-semibold text-brand hover:underline cursor-pointer">
            + Agregar Teléfono
          </button>
        </div>
        <div class="phones-list space-y-1.5"></div>
        <p class="text-[11px] text-slate-400">Por defecto se incluye al menos un número; puede añadir todas las líneas que posea la empresa.</p>
      </div>

      <div class="sm:col-span-1">
        <label class="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">Dirección Física</label>
        <div class="relative">
          <input type="text" class="inp-dir w-full pl-8 pr-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand" value="${escapeHtml(
            emp.direccion
          )}">
          <i class="fa-solid fa-location-dot absolute left-2.5 top-2.5 text-xs text-slate-400"></i>
        </div>
      </div>

      <div class="sm:col-span-1">
        <label class="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">Horario de Atención</label>
        <div class="relative">
          <input type="text" class="inp-horario w-full pl-8 pr-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand" value="${escapeHtml(
            emp.horario_atencion
          )}">
          <i class="fa-regular fa-clock absolute left-2.5 top-2.5 text-xs text-slate-400"></i>
        </div>
      </div>

      <div class="sm:col-span-1">
        <div class="flex items-center justify-between mb-1">
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-200">GPS / Enlace de Ubicación</label>
          <a href="${escapeHtml(emp.gps_enlace || '#')}" target="_blank" class="link-map text-[11px] text-brand hover:underline">
            Abrir Mapa <i class="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
          </a>
        </div>
        <div class="relative">
          <input type="text" class="inp-gps w-full pl-8 pr-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand text-xs font-mono" value="${escapeHtml(
            emp.gps_enlace
          )}">
          <i class="fa-solid fa-map-location-dot absolute left-2.5 top-2.5 text-xs text-slate-400"></i>
        </div>
      </div>
    `;

    // Manejo de teléfonos dinámicos
    const phonesList = infoGrid.querySelector('.phones-list');
    const currentPhones = Array.isArray(emp.telefonos) && emp.telefonos.length > 0 ? [...emp.telefonos] : ['+595 981 123456'];

    function renderPhones() {
      phonesList.innerHTML = '';
      currentPhones.forEach((phoneStr, idx) => {
        const row = document.createElement('div');
        row.className = 'flex items-center gap-1.5';
        row.innerHTML = `
          <input type="text" class="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-brand" value="${escapeHtml(
            phoneStr
          )}">
          ${
            currentPhones.length > 1
              ? `<button type="button" class="btn-del-phone text-slate-400 hover:text-danger p-1 cursor-pointer" title="Quitar">
                  <i class="fa-regular fa-trash-can text-xs"></i>
                </button>`
              : ''
          }
        `;
        row.querySelector('input').addEventListener('input', (e) => {
          currentPhones[idx] = e.target.value;
        });
        row.querySelector('.btn-del-phone')?.addEventListener('click', () => {
          currentPhones.splice(idx, 1);
          renderPhones();
        });
        phonesList.appendChild(row);
      });
    }

    renderPhones();
    infoGrid.querySelector('.btn-add-phone').addEventListener('click', () => {
      currentPhones.push('+595 9');
      renderPhones();
    });

    const inpGps = infoGrid.querySelector('.inp-gps');
    const linkMap = infoGrid.querySelector('.link-map');
    inpGps.addEventListener('input', () => {
      linkMap.href = inpGps.value || '#';
    });

    card.appendChild(infoGrid);

    // Bloque 3: Redes Sociales y Presencia Web
    const redesCard = document.createElement('div');
    redesCard.className =
      'p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-4';

    const r = emp.redes || {};
    redesCard.innerHTML = `
      <div>
        <h3 class="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <i class="fa-solid fa-share-nodes text-brand"></i>
          Redes Sociales y Presencia Web
        </h3>
        <p class="text-xs text-slate-500 dark:text-slate-400">
          Vincule las cuentas y perfiles oficiales de la empresa para difusión y contacto directo.
        </p>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
            <i class="fa-brands fa-facebook text-blue-600 mr-1"></i> Facebook
          </label>
          <input type="text" class="inp-fb w-full px-3.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand" value="${escapeHtml(
            r.facebook || ''
          )}">
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
            <i class="fa-brands fa-instagram text-pink-500 mr-1"></i> Instagram
          </label>
          <input type="text" class="inp-ig w-full px-3.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand" value="${escapeHtml(
            r.instagram || ''
          )}">
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
            <i class="fa-brands fa-tiktok text-slate-800 dark:text-slate-100 mr-1"></i> TikTok
          </label>
          <input type="text" class="inp-tk w-full px-3.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand" value="${escapeHtml(
            r.tiktok || ''
          )}">
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
            <i class="fa-solid fa-globe text-emerald-600 mr-1"></i> Sitio Web Oficial
          </label>
          <input type="text" class="inp-web w-full px-3.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand" value="${escapeHtml(
            r.sitio_web || ''
          )}">
        </div>
      </div>
    `;

    card.appendChild(redesCard);

    // Botón Guardar Datos de la Empresa
    const footer = document.createElement('div');
    footer.className = 'flex items-center justify-end pt-3 border-t border-slate-100 dark:border-slate-800';

    const saveBtn = createButton({
      text: 'Guardar datos de la empresa',
      icon: 'fa-solid fa-check',
      variant: 'primary',
      size: 'md',
      onClick: async (_, btn) => {
        const razon = infoGrid.querySelector('.inp-razon').value.trim();
        const ruc = infoGrid.querySelector('.inp-ruc').value.trim();
        const prop = infoGrid.querySelector('.inp-prop').value.trim();

        if (!razon || !ruc || !prop) {
          toast.warning('La Razón Social, el RUC y el Propietario son obligatorios.');
          return;
        }

        btn.setLoading(true);
        try {
          const newEmp = {
            logo_url: inpLogoUrl.value.trim(),
            razon_social: razon,
            ruc,
            propietario: prop,
            email: infoGrid.querySelector('.inp-email').value.trim(),
            telefonos: currentPhones.filter((p) => p.trim() !== ''),
            direccion: infoGrid.querySelector('.inp-dir').value.trim(),
            horario_atencion: infoGrid.querySelector('.inp-horario').value.trim(),
            gps_enlace: inpGps.value.trim(),
            redes: {
              facebook: redesCard.querySelector('.inp-fb').value.trim(),
              instagram: redesCard.querySelector('.inp-ig').value.trim(),
              tiktok: redesCard.querySelector('.inp-tk').value.trim(),
              sitio_web: redesCard.querySelector('.inp-web').value.trim(),
            },
          };

          await apiFetch('/api/configuracion', {
            method: 'PUT',
            body: JSON.stringify({
              clave: 'empresa_datos',
              valor: newEmp,
            }),
          });
          state.configs.empresa_datos = newEmp;
          toast.success('Datos de la empresa guardados exitosamente.');
        } catch (err) {
          toast.error(err.message || 'No se pudieron guardar los datos.');
        } finally {
          btn.setLoading(false);
        }
      },
    });

    footer.appendChild(saveBtn);
    card.appendChild(footer);
    parent.appendChild(card);
  }

  // ============================================================================
  // PESTAÑA 7: LOGS (Queda vacía como solicitó el usuario)
  // ============================================================================
  function renderLogsTab(parent) {
    const card = document.createElement('section');
    card.className =
      'w-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-10 sm:p-14 shadow-xs text-center space-y-3';
    card.innerHTML = `
      <div class="w-14 h-14 mx-auto rounded-2xl bg-brand-soft dark:bg-brand/20 text-brand flex items-center justify-center">
        <i class="fa-solid fa-clock-rotate-left text-2xl"></i>
      </div>
      <h3 class="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
        Historial de Logs del Sistema
      </h3>
      <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
        El registro detallado de eventos, auditorías de accesos y logs de seguridad del sistema se habilitará en las próximas versiones.
      </p>
    `;
    parent.appendChild(card);
  }

  // ============================================================================
  // Carga Inicial de Datos desde el Servidor
  // ============================================================================
  async function loadData() {
    wrapper.innerHTML = `
      <div class="w-full flex items-center justify-center py-20 text-slate-400">
        <i class="fa-solid fa-circle-notch fa-spin text-2xl text-brand mr-3"></i>
        <span class="text-xs font-semibold">Cargando configuraciones del sistema...</span>
      </div>
    `;

    try {
      const [cfgRes, perfRes, atrRes, tplRes] = await Promise.all([
        apiFetch('/api/configuracion').catch(() => ({})),
        apiFetch('/api/configuracion/perfil').catch(() => null),
        apiFetch('/api/configuracion/atributos').catch(() => ({ categorias: [], marcas: [], unidades: [] })),
        apiFetch('/api/perfiles-mensajes?page=1&page_size=100').catch(() => ({ data: [] })),
      ]);

      if (cfgRes) {
        if (cfgRes.whatsapp_nombre_formato) state.configs.whatsapp_nombre_formato = cfgRes.whatsapp_nombre_formato;
        if (cfgRes.pedidos_notificaciones) state.configs.pedidos_notificaciones = cfgRes.pedidos_notificaciones;
        if (cfgRes.empresa_datos) state.configs.empresa_datos = cfgRes.empresa_datos;
      }
      if (perfRes) {
        state.perfil = { ...state.perfil, ...perfRes };
      }
      if (atrRes) {
        state.atributos = {
          categorias: atrRes.categorias || [],
          marcas: atrRes.marcas || [],
          unidades: atrRes.unidades || [],
        };
      }
      if (tplRes && Array.isArray(tplRes.data)) {
        state.templates = tplRes.data;
      }
    } catch (err) {
      console.warn('[Configuración] Error al cargar datos:', err);
    } finally {
      state.loading = false;
      wrapper.innerHTML = '';
      wrapper.append(tabsBar, contentHolder);
      renderTabsHeader();
      renderActiveTab();
    }
  }

  container.appendChild(wrapper);
  loadData();
}

