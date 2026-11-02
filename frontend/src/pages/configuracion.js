import { createButton } from '../components/button.js';
import { openModal, openConfirmModal } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { apiFetch } from '../services/api.js';
import { createPhoneInput } from '../components/phone-input.js';
import { BudgetDocumentService, loadPdfmeLibraries, resolveBasePdf } from '../services/budget-document.service.js?v=20261031_8';

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
    if (state.activeTab === 'presupuesto') {
      wrapper.className = 'w-full h-full min-h-0 flex flex-col space-y-3 pb-0';
      contentHolder.className = 'w-full flex-1 min-h-0 flex flex-col';
    } else {
      wrapper.className = 'w-full space-y-6 pb-12';
      contentHolder.className = 'w-full';
    }
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
  // COMPONENTE: Editor de Texto Enriquecido Reutilizable (WYSIWYG Ligero)
  // ============================================================================
  function createRichEditor({ container, initialHtml, placeholder = '', onUpdate, showLists = true, minHeight = '70px' }) {
    container.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden focus-within:ring-2 focus-within:ring-brand';

    // Barra de herramientas (Toolbar)
    const toolbar = document.createElement('div');
    toolbar.className = 'flex flex-wrap items-center gap-1 p-1.5 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs select-none';

    function makeBtn(iconClass, cmd, value = null, title = '') {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'p-1.5 w-7 h-7 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center transition text-slate-600 dark:text-slate-300';
      btn.title = title || cmd;
      btn.innerHTML = `<i class="${iconClass}"></i>`;
      btn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        document.execCommand(cmd, false, value);
        editor.focus();
        triggerUpdate();
      });
      return btn;
    }

    // Negrita, Cursiva, Subrayado
    toolbar.appendChild(makeBtn('fa-solid fa-bold', 'bold', null, 'Negrita'));
    toolbar.appendChild(makeBtn('fa-solid fa-italic', 'italic', null, 'Cursiva'));
    toolbar.appendChild(makeBtn('fa-solid fa-underline', 'underline', null, 'Subrayado'));

    // Separador
    const sep1 = document.createElement('div');
    sep1.className = 'w-px h-4 bg-slate-300 dark:bg-slate-600 mx-1';
    toolbar.appendChild(sep1);

    // Tamaño de fuente
    const sizeSelect = document.createElement('select');
    sizeSelect.className = 'px-1.5 py-1 text-[11px] rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-hidden';
    sizeSelect.innerHTML = `
      <option value="">Tamaño</option>
      <option value="1">7 pt (Mini)</option>
      <option value="2">8 pt (Pequeño)</option>
      <option value="3">9 pt (Normal)</option>
      <option value="4">10 pt (Mediano)</option>
      <option value="5">12 pt (Grande)</option>
      <option value="6">14 pt (Título)</option>
    `;
    sizeSelect.addEventListener('change', () => {
      if (sizeSelect.value) {
        document.execCommand('fontSize', false, sizeSelect.value);
        sizeSelect.value = '';
        editor.focus();
        triggerUpdate();
      }
    });
    toolbar.appendChild(sizeSelect);

    // Tipografía
    const fontSelect = document.createElement('select');
    fontSelect.className = 'px-1.5 py-1 text-[11px] rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-hidden';
    fontSelect.innerHTML = `
      <option value="">Tipografía</option>
      <option value="Inter, sans-serif">Sans-Serif (Inter)</option>
      <option value="Arial, sans-serif">Arial</option>
      <option value="Roboto, sans-serif">Roboto</option>
      <option value="Georgia, serif">Georgia</option>
      <option value="'Times New Roman', serif">Times New Roman</option>
      <option value="monospace">Courier (Mono)</option>
    `;
    fontSelect.addEventListener('change', () => {
      if (fontSelect.value) {
        document.execCommand('fontName', false, fontSelect.value);
        fontSelect.value = '';
        editor.focus();
        triggerUpdate();
      }
    });
    toolbar.appendChild(fontSelect);

    // Selector de color de texto
    const colorWrap = document.createElement('label');
    colorWrap.className = 'relative inline-flex items-center justify-center p-1 w-7 h-7 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer text-slate-600 dark:text-slate-300';
    colorWrap.title = 'Color de texto';
    colorWrap.innerHTML = `
      <i class="fa-solid fa-palette text-xs"></i>
      <input type="color" class="absolute inset-0 opacity-0 cursor-pointer w-full h-full" value="#0f172a" />
    `;
    const colorInput = colorWrap.querySelector('input');
    colorInput.addEventListener('input', () => {
      document.execCommand('foreColor', false, colorInput.value);
      editor.focus();
      triggerUpdate();
    });
    toolbar.appendChild(colorWrap);

    // Separador
    const sep2 = document.createElement('div');
    sep2.className = 'w-px h-4 bg-slate-300 dark:bg-slate-600 mx-1';
    toolbar.appendChild(sep2);

    // Alineación
    toolbar.appendChild(makeBtn('fa-solid fa-align-left', 'justifyLeft', null, 'Alinear a la izquierda'));
    toolbar.appendChild(makeBtn('fa-solid fa-align-center', 'justifyCenter', null, 'Centrar'));
    toolbar.appendChild(makeBtn('fa-solid fa-align-right', 'justifyRight', null, 'Alinear a la derecha'));
    toolbar.appendChild(makeBtn('fa-solid fa-align-justify', 'justifyFull', null, 'Justificar'));

    // Listas
    if (showLists) {
      const sep3 = document.createElement('div');
      sep3.className = 'w-px h-4 bg-slate-300 dark:bg-slate-600 mx-1';
      toolbar.appendChild(sep3);
      toolbar.appendChild(makeBtn('fa-solid fa-list-ol', 'insertOrderedList', null, 'Lista numerada'));
      toolbar.appendChild(makeBtn('fa-solid fa-list-ul', 'insertUnorderedList', null, 'Lista con viñetas'));
    }

    // Área editable
    const editor = document.createElement('div');
    editor.contentEditable = 'true';
    editor.className = 'w-full p-2.5 text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900 focus:outline-hidden overflow-y-auto leading-relaxed';
    editor.style.minHeight = minHeight;
    editor.style.maxHeight = '240px';
    editor.innerHTML = initialHtml || '';

    function triggerUpdate() {
      if (typeof onUpdate === 'function') {
        onUpdate(editor.innerHTML);
      }
    }

    editor.addEventListener('input', triggerUpdate);
    editor.addEventListener('blur', triggerUpdate);

    wrap.append(toolbar, editor);
    container.appendChild(wrap);

    return {
      editor,
      setHtml: (h) => {
        editor.innerHTML = h || '';
        triggerUpdate();
      },
      getHtml: () => editor.innerHTML,
    };
  }

  // ============================================================================
  // PESTAÑA 4: PRESUPUESTO — Configuración Visual y Vista Previa en Tiempo Real (Split-Screen)
  // ============================================================================
  function renderPresupuestoTab(parent) {
    const wrap = document.createElement('div');
    wrap.className = 'w-full flex-1 min-h-0 flex flex-col space-y-3';

    // Estado local de la configuración y previsualización
    let cfg = BudgetDocumentService.getDefaultBudgetConfig();
    let sampleBudget = {
      id: 3,
      numero_presupuesto: 'PRES-2026-0003',
      fecha_emision: '24/10/2026',
      validez_dias: 15,
      validez_fecha: '08/11/2026 (15 días)',
      estado: 'Aprobado',
      cliente: {
        nombre: 'Zunilda Ledesma',
        ruc: '727424',
        telefono: '+595986901117',
        email: 'zunilda@example.com',
        direccion: 'Presidente Franco, Paraguay',
      },
      items: [
        { id: 1, descripcion: 'Taza para Bebe', precio_unitario: 50000, precio_unitario_formateado: '50.000 Gs.', cantidad: 10, total: 500000, total_formateado: '500.000 Gs.', imagen_url: '/logo/R1.png' },
        { id: 2, descripcion: 'Taza Especial Sublimada R1', precio_unitario: 150000, precio_unitario_formateado: '150.000 Gs.', cantidad: 10, total: 1500000, total_formateado: '1.500.000 Gs.', imagen_url: '/logo/R1.png' },
        { id: 3, descripcion: 'Taza Magica Sublimada 350ml', precio_unitario: 45000, precio_unitario_formateado: '45.000 Gs.', cantidad: 10, total: 450000, total_formateado: '450.000 Gs.', imagen_url: '/logo/R1.png' },
        { id: 4, descripcion: 'Kepis', precio_unitario: 55000, precio_unitario_formateado: '55.000 Gs.', cantidad: 15, total: 825000, total_formateado: '825.000 Gs.', imagen_url: '/logo/R1.png' },
      ],
      totales: {
        subtotal: 3275000,
        subtotal_formateado: '3.275.000 Gs.',
        porcentaje_descuento: 2.3,
        monto_descuento: 75000,
        monto_descuento_formateado: '- 75.000 Gs.',
        total_final: 3200000,
        total_final_formateado: '3.200.000 Gs.',
      },
      imagenes_productos: [
        { nombre: 'Taza para Bebe', url: '/logo/R1.png' },
        { nombre: 'Taza para Bebe', url: '/logo/R1.png' },
        { nombre: 'Taza Especial Sublimada R1', url: '/logo/R1.png' },
        { nombre: 'Taza Magica Sublimada 350ml', url: '/logo/R1.png' },
        { nombre: 'Kepis', url: '/logo/R1.png' },
      ],
    };

    let activePageFilter = 'todas'; // 'todas' | 'portada' | 'contenido' | 'fotos'
    let currentZoom = 1;

    // Encabezado principal del módulo
    const topBar = document.createElement('div');
    topBar.className =
      'flex flex-wrap items-center justify-between gap-3 p-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs';
    topBar.innerHTML = `
      <div class="flex items-center gap-3">
        <span class="w-10 h-10 rounded-xl bg-brand-soft dark:bg-brand/20 text-brand flex items-center justify-center shrink-0">
          <i class="fa-regular fa-file-lines text-lg"></i>
        </span>
        <div>
          <div class="flex items-center gap-2">
            <h2 class="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
              Configuración de Presupuestos (PDF & Cotizaciones)
            </h2>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand-soft text-brand dark:bg-brand/20">
              • Plantilla Oficial PDF
            </span>
          </div>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            Personalice las cláusulas legales de términos y condiciones y elija qué canales de presencia web aparecerán en el pie de página de sus presupuestos en PDF.
          </p>
        </div>
      </div>
      <div id="top-budget-actions" class="flex flex-wrap items-center gap-2"></div>
    `;

    const topActions = topBar.querySelector('#top-budget-actions');
    const btnRestablecerTop = createButton({
      text: 'Restablecer',
      icon: 'fa-solid fa-rotate-left',
      variant: 'cancel',
      size: 'sm',
      onClick: () => handleRestablecerDefaults(),
    });
    const btnDescargarTop = createButton({
      text: 'Descargar Muestra PDF',
      icon: 'fa-solid fa-file-pdf',
      variant: 'primary',
      size: 'sm',
      onClick: () => handleDescargarMuestraPDF(),
    });
    const btnGuardarTop = createButton({
      text: 'Guardar configuración de presupuestos',
      icon: 'fa-solid fa-floppy-disk',
      variant: 'primary',
      size: 'sm',
      onClick: () => handleGuardarConfig(),
    });
    topActions.appendChild(btnRestablecerTop);
    topActions.appendChild(btnDescargarTop);
    topActions.appendChild(btnGuardarTop);
    wrap.appendChild(topBar);

    // Contenedor Split-Screen (Grid responsivo de 2 columnas ocupando 100% alto)
    const splitGrid = document.createElement('div');
    splitGrid.className = 'flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch';

    // =========================================================================
    // COLUMNA IZQUIERDA: Vista Previa del PDF (A4 Oficial) en Tiempo Real
    // =========================================================================
    const previewCol = document.createElement('div');
    previewCol.className = 'xl:col-span-6 2xl:col-span-6 flex flex-col h-full min-h-0';

    const previewCard = document.createElement('div');
    previewCard.className =
      'h-full flex flex-col min-h-0 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden';

    // Barra superior de visualización
    const previewToolbar = document.createElement('div');
    previewToolbar.className =
      'flex flex-wrap items-center justify-between gap-3 p-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-xs shrink-0';
    previewToolbar.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        <span class="font-bold text-slate-800 dark:text-slate-100">Vista Previa del PDF (A4 Oficial)</span>
        <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
          • Tiempo Real
        </span>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <div class="flex items-center gap-1.5 bg-white dark:bg-slate-900 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
          <i class="fa-solid fa-magnifying-glass text-slate-400 text-[10px]"></i>
          <span class="text-[11px] text-slate-500">Zoom:</span>
          <select id="preview-zoom-select" class="bg-transparent font-medium text-slate-700 dark:text-slate-200 text-[11px] focus:outline-hidden">
            <option value="0.5">50%</option>
            <option value="0.75">75%</option>
            <option value="1" selected>100% (A4 Real)</option>
            <option value="fit">Ajustar ancho</option>
          </select>
        </div>
        <div class="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-white dark:bg-slate-900" id="page-filter-btns">
          <button type="button" data-filter="todas" class="px-2.5 py-1 rounded-md text-[11px] font-semibold transition bg-brand text-white">Todas</button>
          <button type="button" data-filter="portada" class="px-2.5 py-1 rounded-md text-[11px] font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition">Portada</button>
          <button type="button" data-filter="contenido" class="px-2.5 py-1 rounded-md text-[11px] font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition">Contenido</button>
          <button type="button" data-filter="fotos" class="px-2.5 py-1 rounded-md text-[11px] font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition">Fotos</button>
        </div>
      </div>
    `;
    previewCard.appendChild(previewToolbar);

    // Contenedor con scroll para las páginas A4 ocupando todo el alto restante
    const previewViewport = document.createElement('div');
    previewViewport.id = 'preview-viewport-scroll';
    previewViewport.className =
      'w-full flex-1 min-h-0 overflow-y-auto bg-slate-200/70 dark:bg-slate-950 p-4 sm:p-6 flex flex-col items-center gap-6 rounded-b-2xl';

    const pagesWrapper = document.createElement('div');
    pagesWrapper.id = 'preview-pages-wrapper';
    pagesWrapper.className = 'flex flex-col items-center gap-6 transition-transform origin-top';
    previewViewport.appendChild(pagesWrapper);
    previewCard.appendChild(previewViewport);
    previewCol.appendChild(previewCard);
    splitGrid.appendChild(previewCol);

    // =========================================================================
    // COLUMNA DERECHA: Panel de Configuración de Presupuestos (PDF & Cotizaciones)
    // =========================================================================
    const controlsCol = document.createElement('div');
    controlsCol.className = 'xl:col-span-6 2xl:col-span-6 flex flex-col h-full min-h-0 overflow-y-auto pr-1 select-none space-y-4';

    // -------------------------------------------------------------------------
    // TARJETA 1: Tamaño de logo en carátula
    // -------------------------------------------------------------------------
    const cardCaratulaLogo = document.createElement('section');
    cardCaratulaLogo.className = 'p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4';
    cardCaratulaLogo.innerHTML = `
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="w-7 h-7 rounded-lg bg-brand-soft text-brand dark:bg-brand/20 flex items-center justify-center text-xs">
            <i class="fa-solid fa-expand"></i>
          </span>
          <div>
            <h3 class="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">Tamaño de logo en carátula</h3>
            <p class="text-[11px] text-slate-500">Ajuste el tamaño del logo central que se muestra en la carátula oficial del presupuesto en PDF (mínimo 20 mm).</p>
          </div>
        </div>
        <span class="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
          Logo Portada PDF
        </span>
      </div>

      <div class="flex items-center gap-5 pt-1">
        <!-- Miniatura carátula -->
        <div class="w-24 shrink-0 text-center">
          <div id="mini-cover-thumb" class="w-24 h-32 rounded-xl flex items-center justify-center shadow-xs transition-colors overflow-hidden border border-slate-700/20" style="background-color: ${cfg.caratula.estilo_color};">
            <img id="mini-cover-logo" src="/logo/R1.png" alt="R1" class="transition-all" style="width: ${Math.max(12, cfg.caratula.logo_ancho * 0.45)}px;" />
          </div>
          <span class="text-[10px] text-slate-400 mt-1 block">Escala en carátula</span>
        </div>

        <!-- Slider y controles -->
        <div class="flex-1 space-y-3">
          <div class="flex items-center justify-between">
            <label class="text-xs font-semibold text-slate-700 dark:text-slate-300">Ancho del logotipo:</label>
            <span class="text-xs font-mono font-bold text-brand bg-brand-soft dark:bg-brand/20 px-2 py-0.5 rounded-md" id="badge-caratula-logo-val">${cfg.caratula.logo_ancho} mm</span>
          </div>
          <input type="range" id="slider-caratula-logo" min="20" max="170" step="1" value="${cfg.caratula.logo_ancho}" class="w-full accent-brand cursor-pointer" />
          
          <div>
            <span class="text-[11px] text-slate-400 block mb-1.5">Tamaños sugeridos:</span>
            <div class="flex flex-wrap gap-2">
              <button type="button" class="btn-quick-val px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:border-brand hover:text-brand transition" data-target="slider-caratula-logo" data-val="20">20 mm</button>
              <button type="button" class="btn-quick-val px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:border-brand hover:text-brand transition" data-target="slider-caratula-logo" data-val="50">50 mm</button>
              <button type="button" class="btn-quick-val px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:border-brand hover:text-brand transition" data-target="slider-caratula-logo" data-val="80">80 mm</button>
              <button type="button" class="btn-quick-val px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:border-brand hover:text-brand transition" data-target="slider-caratula-logo" data-val="110">110 mm</button>
              <button type="button" class="btn-quick-val px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:border-brand hover:text-brand transition" data-target="slider-caratula-logo" data-val="140">140 mm</button>
              <button type="button" class="btn-quick-val px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:border-brand hover:text-brand transition" data-target="slider-caratula-logo" data-val="170">170 mm</button>
            </div>
          </div>
        </div>
      </div>
    `;
    controlsCol.appendChild(cardCaratulaLogo);

    // -------------------------------------------------------------------------
    // TARJETA 2: Tamaño de textos en Página 2
    // -------------------------------------------------------------------------
    const cardTextosP2 = document.createElement('section');
    cardTextosP2.className = 'p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4';
    cardTextosP2.innerHTML = `
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/50 flex items-center justify-center text-xs">
            <i class="fa-solid fa-font"></i>
          </span>
          <div>
            <h3 class="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">Tamaño de textos en Página 2</h3>
            <p class="text-[11px] text-slate-500">Ajuste o reduzca la escala de los textos, tablas y cláusulas aplicable únicamente a la página 2 de contenido.</p>
          </div>
        </div>
        <span class="text-xs font-mono font-bold text-brand bg-brand-soft dark:bg-brand/20 px-2 py-0.5 rounded-md" id="badge-textos-p2-val">${cfg.pagina2.tamano_textos_porcentaje}% • Normal</span>
      </div>

      <div class="space-y-3 pt-1">
        <input type="range" id="slider-textos-p2" min="70" max="100" step="5" value="${cfg.pagina2.tamano_textos_porcentaje}" class="w-full accent-brand cursor-pointer" />
        <div class="flex flex-wrap gap-2">
          <button type="button" class="btn-quick-val px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:border-brand hover:text-brand transition" data-target="slider-textos-p2" data-val="100">100% (Normal)</button>
          <button type="button" class="btn-quick-val px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:border-brand hover:text-brand transition" data-target="slider-textos-p2" data-val="90">90% (Mediano)</button>
          <button type="button" class="btn-quick-val px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:border-brand hover:text-brand transition" data-target="slider-textos-p2" data-val="80">80% (Compacto)</button>
          <button type="button" class="btn-quick-val px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:border-brand hover:text-brand transition" data-target="slider-textos-p2" data-val="70">70% (Reducido)</button>
        </div>
      </div>
    `;
    controlsCol.appendChild(cardTextosP2);

    // -------------------------------------------------------------------------
    // TARJETA 3: Separación manual entre bloques
    // -------------------------------------------------------------------------
    const cardSeparacion = document.createElement('section');
    cardSeparacion.className = 'p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4';
    cardSeparacion.innerHTML = `
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 flex items-center justify-center text-xs">
            <i class="fa-solid fa-arrows-up-down"></i>
          </span>
          <div>
            <h3 class="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">Separación manual entre bloques</h3>
            <p class="text-[11px] text-slate-500">Ajuste el espaciado vertical entre el encabezado, cliente, tabla de productos, totales y cláusulas legales.</p>
          </div>
        </div>
        <span class="text-xs font-mono font-bold text-brand bg-brand-soft dark:bg-brand/20 px-2 py-0.5 rounded-md" id="badge-separacion-val">${cfg.pagina2.separacion_bloques_px} px • Estándar</span>
      </div>

      <div class="space-y-3 pt-1">
        <input type="range" id="slider-separacion" min="12" max="40" step="2" value="${cfg.pagina2.separacion_bloques_px}" class="w-full accent-brand cursor-pointer" />
        <div class="flex flex-wrap gap-2">
          <button type="button" class="btn-quick-val px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:border-brand hover:text-brand transition" data-target="slider-separacion" data-val="12">12 px (Apretado)</button>
          <button type="button" class="btn-quick-val px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:border-brand hover:text-brand transition" data-target="slider-separacion" data-val="20">20 px (Estándar)</button>
          <button type="button" class="btn-quick-val px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:border-brand hover:text-brand transition" data-target="slider-separacion" data-val="30">30 px (Amplio)</button>
          <button type="button" class="btn-quick-val px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:border-brand hover:text-brand transition" data-target="slider-separacion" data-val="40">40 px (Extendido)</button>
        </div>
      </div>
    `;
    controlsCol.appendChild(cardSeparacion);

    // -------------------------------------------------------------------------
    // TARJETA 4: Estilo y color de presupuesto
    // -------------------------------------------------------------------------
    const cardColor = document.createElement('section');
    cardColor.className = 'p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4';
    cardColor.innerHTML = `
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/50 flex items-center justify-center text-xs">
            <i class="fa-solid fa-palette"></i>
          </span>
          <div>
            <h3 class="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">Estilo y color de presupuesto</h3>
            <p class="text-[11px] text-slate-500">Seleccione el color temático para la carátula oficial y acentos del presupuesto en PDF.</p>
          </div>
        </div>
        <span class="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
          Fondo y Acentos
        </span>
      </div>

      <div class="flex flex-wrap items-center gap-4 pt-1">
        <div class="flex items-center gap-3">
          <div class="relative">
            <input type="color" id="picker-estilo-color" value="${cfg.caratula.estilo_color}" class="w-12 h-12 rounded-xl cursor-pointer border border-slate-300 dark:border-slate-700 p-0.5 bg-transparent" />
          </div>
          <div>
            <span class="text-[11px] text-slate-400 block">Color Seleccionado</span>
            <input type="text" id="input-estilo-color-hex" value="${cfg.caratula.estilo_color}" class="w-24 px-2 py-1 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 uppercase font-semibold text-slate-800 dark:text-slate-200" />
          </div>
        </div>

        <div class="flex-1 min-w-[200px]">
          <span class="text-[11px] text-slate-400 block mb-1.5">Colores Corporativos Predefinidos:</span>
          <div class="flex flex-wrap gap-2" id="preset-colors-group">
            <button type="button" class="btn-color-preset inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:border-brand transition" data-color="#435A62">
              <span class="w-2.5 h-2.5 rounded-full" style="background-color: #435A62;"></span> #435A62 (Pizarra)
            </button>
            <button type="button" class="btn-color-preset inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:border-brand transition" data-color="#14281D">
              <span class="w-2.5 h-2.5 rounded-full" style="background-color: #14281D;"></span> #14281D (Verde)
            </button>
            <button type="button" class="btn-color-preset inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:border-brand transition" data-color="#1E293B">
              <span class="w-2.5 h-2.5 rounded-full" style="background-color: #1E293B;"></span> #1E293B (Slate)
            </button>
            <button type="button" class="btn-color-preset inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:border-brand transition" data-color="#1A1A1A">
              <span class="w-2.5 h-2.5 rounded-full" style="background-color: #1A1A1A;"></span> #1A1A1A (Negro)
            </button>
            <button type="button" class="btn-color-preset inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:border-brand transition" data-color="#2C3E50">
              <span class="w-2.5 h-2.5 rounded-full" style="background-color: #2C3E50;"></span> #2C3E50 (Navy)
            </button>
            <button type="button" class="btn-color-preset inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:border-brand transition" data-color="#4A2E75">
              <span class="w-2.5 h-2.5 rounded-full" style="background-color: #4A2E75;"></span> #4A2E75 (Violeta)
            </button>
          </div>
        </div>
      </div>
    `;
    controlsCol.appendChild(cardColor);

    // -------------------------------------------------------------------------
    // TARJETA 5: Logotipo en cabecera (Página 2)
    // -------------------------------------------------------------------------
    const cardLogoCabecera = document.createElement('section');
    cardLogoCabecera.className = 'p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4';
    cardLogoCabecera.innerHTML = `
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-950/50 flex items-center justify-center text-xs">
            <i class="fa-regular fa-image"></i>
          </span>
          <div>
            <h3 class="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">Logotipo en cabecera (Página 2)</h3>
            <p class="text-[11px] text-slate-500">Ajuste el tamaño del logo en la parte superior de la página 2 u ocúltelo si no desea mostrarlo.</p>
          </div>
        </div>
        <label class="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
          <input type="checkbox" id="chk-logo-p2-visible" ${cfg.pagina2.cabecera_logo_visible ? 'checked' : ''} class="w-4 h-4 rounded text-brand focus:ring-brand" />
          <span>Visible</span>
        </label>
      </div>

      <div class="space-y-3 pt-1">
        <div class="flex items-center justify-between">
          <label class="text-xs font-semibold text-slate-700 dark:text-slate-300">Altura / Tamaño del logo:</label>
          <span class="text-xs font-mono font-bold text-brand bg-brand-soft dark:bg-brand/20 px-2 py-0.5 rounded-md" id="badge-logo-p2-val">${cfg.pagina2.cabecera_logo_alto} mm • Estándar</span>
        </div>
        <input type="range" id="slider-logo-p2" min="16" max="52" step="2" value="${cfg.pagina2.cabecera_logo_alto}" class="w-full accent-brand cursor-pointer" />
        <div class="flex flex-wrap gap-2">
          <button type="button" class="btn-quick-val px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:border-brand hover:text-brand transition" data-target="slider-logo-p2" data-val="16">16 mm (Mini)</button>
          <button type="button" class="btn-quick-val px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:border-brand hover:text-brand transition" data-target="slider-logo-p2" data-val="22">22 mm (Compacto)</button>
          <button type="button" class="btn-quick-val px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:border-brand hover:text-brand transition" data-target="slider-logo-p2" data-val="28">28 mm (Estándar)</button>
          <button type="button" class="btn-quick-val px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:border-brand hover:text-brand transition" data-target="slider-logo-p2" data-val="38">38 mm (Mediano)</button>
          <button type="button" class="btn-quick-val px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:border-brand hover:text-brand transition" data-target="slider-logo-p2" data-val="52">52 mm (Grande)</button>
        </div>
      </div>
    `;
    controlsCol.appendChild(cardLogoCabecera);

    // -------------------------------------------------------------------------
    // TARJETA 6: Título en barra oficial (Página 2)
    // -------------------------------------------------------------------------
    const cardTituloBarra = document.createElement('section');
    cardTituloBarra.className = 'p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3';
    cardTituloBarra.innerHTML = `
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 flex items-center justify-center text-xs">
            <i class="fa-solid fa-heading"></i>
          </span>
          <div>
            <h3 class="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">Título en barra oficial (Página 2)</h3>
            <p class="text-[11px] text-slate-500">Modifique a gusto el texto de la barra oficial ("Presupuesto Oficial") o inhabilite la barra por completo.</p>
          </div>
        </div>
        <label class="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
          <input type="checkbox" id="chk-titulo-barra-visible" ${cfg.pagina2.titulo_barra_visible ? 'checked' : ''} class="w-4 h-4 rounded text-brand focus:ring-brand" />
          <span>Visible</span>
        </label>
      </div>

      <div class="space-y-1.5 pt-1">
        <label class="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Texto a mostrar en la barra:</label>
        <div class="flex items-center gap-2">
          <input type="text" id="input-titulo-barra" value="${escapeHtml(cfg.pagina2.titulo_barra_texto)}" class="flex-1 px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold tracking-wider" />
          <button type="button" id="btn-def-titulo-barra" class="px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 hover:border-brand hover:text-brand transition">Por defecto</button>
        </div>
      </div>
    `;
    controlsCol.appendChild(cardTituloBarra);

    // -------------------------------------------------------------------------
    // TARJETA 7: Foto del producto en Descripción (Página 2)
    // -------------------------------------------------------------------------
    const cardFotoDescripcion = document.createElement('section');
    cardFotoDescripcion.className = 'p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between';
    cardFotoDescripcion.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-950/50 flex items-center justify-center text-xs">
          <i class="fa-regular fa-image"></i>
        </span>
        <div>
          <h3 class="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">Foto del producto en Descripción (Página 2)</h3>
          <p class="text-[11px] text-slate-500">Permite habilitar o inhabilitar la miniatura con foto de cada producto junto a su nombre en la tabla de cotización.</p>
        </div>
      </div>
      <label class="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
        <input type="checkbox" id="chk-foto-desc-visible" ${cfg.pagina2.foto_producto_descripcion ? 'checked' : ''} class="w-4 h-4 rounded text-brand focus:ring-brand" />
        <span>Visible</span>
      </label>
    `;
    controlsCol.appendChild(cardFotoDescripcion);

    // -------------------------------------------------------------------------
    // TARJETA 8: Cuadro de Descuento / Promoción (Página 2)
    // -------------------------------------------------------------------------
    const cardDescuento = document.createElement('section');
    cardDescuento.className = 'p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4';
    cardDescuento.innerHTML = `
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-950/50 flex items-center justify-center text-xs">
            <i class="fa-solid fa-tag"></i>
          </span>
          <div>
            <h3 class="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">Cuadro de Descuento / Promoción (Página 2)</h3>
            <p class="text-[11px] text-slate-500">Habilite un texto o cuadro destacado junto a los totales para informar el motivo del descuento o porcentaje aplicable (ej. pago al contado, volumen).</p>
          </div>
        </div>
        <label class="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
          <input type="checkbox" id="chk-descuento-visible" ${cfg.pagina2.descuento.visible ? 'checked' : ''} class="w-4 h-4 rounded text-brand focus:ring-brand" />
          <span>Visible</span>
        </label>
      </div>

      <div class="space-y-3 pt-1">
        <label class="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
          <input type="checkbox" id="chk-descuento-borde" ${cfg.pagina2.descuento.mostrar_cuadro_borde ? 'checked' : ''} class="w-4 h-4 rounded text-brand focus:ring-brand" />
          <span>Mostrar dentro de un cuadro con marco/borde destacado (si se desmarca, se muestra como insignia simple)</span>
        </label>

        <div>
          <label class="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">Texto o Motivo del Descuento / % a mostrar:</label>
          <div class="flex items-center gap-2">
            <input type="text" id="input-descuento-texto" value="${escapeHtml(cfg.pagina2.descuento.texto)}" class="flex-1 px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold" />
            <button type="button" id="btn-def-descuento-texto" class="px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 hover:border-brand hover:text-brand transition">Por defecto</button>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label class="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">Color de Fondo</label>
            <div class="flex items-center gap-2">
              <input type="color" id="picker-desc-bg" value="${cfg.pagina2.descuento.color_fondo}" class="w-8 h-8 rounded-lg cursor-pointer border border-slate-300 p-0.5 bg-transparent" />
              <input type="text" id="input-desc-bg-hex" value="${cfg.pagina2.descuento.color_fondo}" class="w-full px-2 py-1 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 uppercase" />
            </div>
          </div>
          <div>
            <label class="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">Color de Texto</label>
            <div class="flex items-center gap-2">
              <input type="color" id="picker-desc-text" value="${cfg.pagina2.descuento.color_texto}" class="w-8 h-8 rounded-lg cursor-pointer border border-slate-300 p-0.5 bg-transparent" />
              <input type="text" id="input-desc-text-hex" value="${cfg.pagina2.descuento.color_texto}" class="w-full px-2 py-1 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 uppercase" />
            </div>
          </div>
          <div>
            <label class="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">Color de Borde / Marco</label>
            <div class="flex items-center gap-2">
              <input type="color" id="picker-desc-border" value="${cfg.pagina2.descuento.color_borde}" class="w-8 h-8 rounded-lg cursor-pointer border border-slate-300 p-0.5 bg-transparent" />
              <input type="text" id="input-desc-border-hex" value="${cfg.pagina2.descuento.color_borde}" class="w-full px-2 py-1 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 uppercase" />
            </div>
          </div>
        </div>

        <div>
          <span class="text-[11px] text-slate-400 block mb-1.5">Estilos sugeridos:</span>
          <div class="flex flex-wrap gap-2">
            <button type="button" class="btn-desc-preset inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:border-brand transition" data-bg="#F0FDF4" data-text="#15803D" data-border="#BBF7D0">
              <span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Verde Esmeralda (Éxito / Ahorro)
            </button>
            <button type="button" class="btn-desc-preset inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:border-brand transition" data-bg="#F5F3FF" data-text="#7C3AED" data-border="#DDD6FE">
              <span class="w-2.5 h-2.5 rounded-full bg-purple-500"></span> Violeta Marca (Elegante)
            </button>
            <button type="button" class="btn-desc-preset inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:border-brand transition" data-bg="#FFFBEB" data-text="#B45309" data-border="#FDE68A">
              <span class="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Ámbar Dorado (Promoción)
            </button>
            <button type="button" class="btn-desc-preset inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:border-brand transition" data-bg="#FEF2F2" data-text="#DC2626" data-border="#FECACA">
              <span class="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Rojo Suave (Descuento Exclusivo)
            </button>
            <button type="button" class="btn-desc-preset inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:border-brand transition" data-bg="#F8FAFC" data-text="#475569" data-border="#E2E8F0">
              <span class="w-2.5 h-2.5 rounded-full bg-slate-500"></span> Gris Neutro (Sobrio)
            </button>
          </div>
        </div>

        <div class="pt-2">
          <span class="text-[11px] text-slate-400 block mb-1">Muestra preliminar:</span>
          <div id="desc-live-preview-box" class="p-2.5 text-center font-bold text-xs rounded-lg transition-all" style="background-color: ${cfg.pagina2.descuento.color_fondo}; color: ${cfg.pagina2.descuento.color_texto}; border: 1px solid ${cfg.pagina2.descuento.color_borde};">
            ${escapeHtml(cfg.pagina2.descuento.texto)}
          </div>
        </div>
      </div>
    `;
    controlsCol.appendChild(cardDescuento);

    // -------------------------------------------------------------------------
    // TARJETA 9: Términos y Condiciones (Página 2)
    // -------------------------------------------------------------------------
    const cardTerminos = document.createElement('section');
    cardTerminos.className = 'p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4';
    cardTerminos.innerHTML = `
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="w-7 h-7 rounded-lg bg-teal-50 text-teal-600 dark:bg-teal-950/50 flex items-center justify-center text-xs">
            <i class="fa-solid fa-list-check"></i>
          </span>
          <div>
            <h3 class="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">Términos y Condiciones (Página 2)</h3>
            <p class="text-[11px] text-slate-500">Mueva libremente la posición entre la tabla/totales y el pie de página. El texto se auto-ajusta para no desbordar.</p>
          </div>
        </div>
        <span class="text-xs font-mono font-bold text-brand bg-brand-soft dark:bg-brand/20 px-2 py-0.5 rounded-md" id="badge-terminos-pos-val">${cfg.pagina2.terminos.posicion_vertical_px} px</span>
      </div>

      <div class="space-y-4 pt-1">
        <div>
          <div class="flex items-center justify-between mb-1.5">
            <label class="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Posición vertical (Mover libremente entre totales y pie de página):</label>
            <span class="text-[10px] text-slate-400">0 px = Junto a Totales (Línea roja)</span>
          </div>
          <input type="range" id="slider-terminos-pos" min="0" max="140" step="2" value="${cfg.pagina2.terminos.posicion_vertical_px}" class="w-full accent-brand cursor-pointer" />
          <div class="flex flex-wrap gap-2 mt-2">
            <button type="button" class="btn-quick-val px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:border-brand hover:text-brand transition" data-target="slider-terminos-pos" data-val="0">0 px (Junto a Totales)</button>
            <button type="button" class="btn-quick-val px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:border-brand hover:text-brand transition" data-target="slider-terminos-pos" data-val="20">20 px (Estándar)</button>
            <button type="button" class="btn-quick-val px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:border-brand hover:text-brand transition" data-target="slider-terminos-pos" data-val="50">50 px (Medio)</button>
            <button type="button" class="btn-quick-val px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:border-brand hover:text-brand transition" data-target="slider-terminos-pos" data-val="90">90 px (Bajo)</button>
            <button type="button" class="btn-quick-val px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:border-brand hover:text-brand transition" data-target="slider-terminos-pos" data-val="140">140 px (Al Pie de Página)</button>
          </div>
        </div>

        <div>
          <div class="flex items-center justify-between mb-1.5">
            <label class="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Título editable (Barra con formato, tamaño, fuente, color y alineación):</label>
            <button type="button" id="btn-def-terminos-titulo" class="text-[11px] font-semibold text-slate-500 hover:text-brand transition"><i class="fa-solid fa-rotate-left mr-1"></i>Por defecto</button>
          </div>
          <div id="container-rich-editor-titulo" class="w-full"></div>
        </div>

        <div>
          <div class="flex items-center justify-between mb-1.5">
            <label class="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Cláusulas operativas (Barra completa con listas, negrita, color y alineación):</label>
            <button type="button" id="btn-def-terminos-clausulas" class="text-[11px] font-semibold text-slate-500 hover:text-brand transition"><i class="fa-solid fa-rotate-left mr-1"></i>Restablecer Cláusulas</button>
          </div>
          <div id="container-rich-editor-clausulas" class="w-full"></div>
        </div>
      </div>
    `;
    controlsCol.appendChild(cardTerminos);

    // -------------------------------------------------------------------------
    // TARJETA 10: Página de Fotos / Galería de Productos (Página 3)
    // -------------------------------------------------------------------------
    const cardPagina3 = document.createElement('section');
    cardPagina3.className = 'p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4';
    cardPagina3.innerHTML = `
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="w-7 h-7 rounded-lg bg-pink-50 text-pink-600 dark:bg-pink-950/50 flex items-center justify-center text-xs">
            <i class="fa-solid fa-images"></i>
          </span>
          <div>
            <h3 class="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">Página de Fotos / Galería de Productos (Página 3)</h3>
            <p class="text-[11px] text-slate-500">Adjunta una página adicional al presupuesto con las fotos ampliadas de los productos seleccionados y sus nombres debajo.</p>
          </div>
        </div>
        <label class="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
          <input type="checkbox" id="chk-p3-visible" ${cfg.pagina3.visible ? 'checked' : ''} class="w-4 h-4 rounded text-brand focus:ring-brand" />
          <span>Visible</span>
        </label>
      </div>

      <div class="space-y-4 pt-1">
        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Título / Encabezado de Página 3:</label>
            <label class="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 cursor-pointer">
              <input type="checkbox" id="chk-p3-titulo-visible" ${cfg.pagina3.titulo_visible ? 'checked' : ''} class="w-3.5 h-3.5 rounded text-brand focus:ring-brand" />
              <span>Visible</span>
            </label>
          </div>
          <div class="flex items-center gap-2">
            <input type="text" id="input-p3-titulo" value="${escapeHtml(cfg.pagina3.titulo)}" class="flex-1 px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold" />
            <button type="button" id="btn-def-p3-titulo" class="px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 hover:border-brand hover:text-brand transition">Por defecto</button>
          </div>
        </div>

        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Posición vertical de las fotos (Alzar o Bajar):</label>
            <span class="text-xs font-mono font-bold text-brand bg-brand-soft dark:bg-brand/20 px-2 py-0.5 rounded-md" id="badge-p3-pos-v">${cfg.pagina3.posicion_vertical_px} px • Estándar</span>
          </div>
          <input type="range" id="slider-p3-pos-v" min="0" max="90" step="2" value="${cfg.pagina3.posicion_vertical_px}" class="w-full accent-brand cursor-pointer" />
          <div class="flex flex-wrap gap-2 mt-2">
            <button type="button" class="btn-quick-val px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:border-brand hover:text-brand transition" data-target="slider-p3-pos-v" data-val="0">0 px (Arriba)</button>
            <button type="button" class="btn-quick-val px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:border-brand hover:text-brand transition" data-target="slider-p3-pos-v" data-val="20">20 px (Estándar)</button>
            <button type="button" class="btn-quick-val px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:border-brand hover:text-brand transition" data-target="slider-p3-pos-v" data-val="50">50 px (Medio)</button>
            <button type="button" class="btn-quick-val px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:border-brand hover:text-brand transition" data-target="slider-p3-pos-v" data-val="90">90 px (Bajo)</button>
          </div>
        </div>

        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Posición horizontal de las fotos (Mover a los lados):</label>
            <span class="text-xs font-mono font-bold text-brand bg-brand-soft dark:bg-brand/20 px-2 py-0.5 rounded-md" id="badge-p3-pos-h">${cfg.pagina3.posicion_horizontal_px} px • Centrado</span>
          </div>
          <input type="range" id="slider-p3-pos-h" min="-30" max="30" step="2" value="${cfg.pagina3.posicion_horizontal_px}" class="w-full accent-brand cursor-pointer" />
          <div class="flex flex-wrap gap-2 mt-2">
            <button type="button" class="btn-quick-val px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:border-brand hover:text-brand transition" data-target="slider-p3-pos-h" data-val="-30">-30 px (Izquierda)</button>
            <button type="button" class="btn-quick-val px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:border-brand hover:text-brand transition" data-target="slider-p3-pos-h" data-val="0">0 px (Centrado)</button>
            <button type="button" class="btn-quick-val px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:border-brand hover:text-brand transition" data-target="slider-p3-pos-h" data-val="30">+30 px (Derecha)</button>
          </div>
        </div>

        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Separación entre las fotos:</label>
            <span class="text-xs font-mono font-bold text-brand bg-brand-soft dark:bg-brand/20 px-2 py-0.5 rounded-md" id="badge-p3-gap">${cfg.pagina3.separacion_fotos_px} px • Estándar</span>
          </div>
          <input type="range" id="slider-p3-gap" min="2" max="32" step="1" value="${cfg.pagina3.separacion_fotos_px}" class="w-full accent-brand cursor-pointer" />
          <div class="flex flex-wrap gap-2 mt-2">
            <button type="button" class="btn-quick-val px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:border-brand hover:text-brand transition" data-target="slider-p3-gap" data-val="2">2 px (Mínimo)</button>
            <button type="button" class="btn-quick-val px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:border-brand hover:text-brand transition" data-target="slider-p3-gap" data-val="6">6 px (Estrecho)</button>
            <button type="button" class="btn-quick-val px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:border-brand hover:text-brand transition" data-target="slider-p3-gap" data-val="12">12 px (Compacto)</button>
            <button type="button" class="btn-quick-val px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:border-brand hover:text-brand transition" data-target="slider-p3-gap" data-val="16">16 px (Estándar)</button>
            <button type="button" class="btn-quick-val px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:border-brand hover:text-brand transition" data-target="slider-p3-gap" data-val="24">24 px (Medio)</button>
            <button type="button" class="btn-quick-val px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:border-brand hover:text-brand transition" data-target="slider-p3-gap" data-val="32">32 px (Amplio)</button>
          </div>
        </div>

        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Tamaño / Altura de cada foto:</label>
            <span class="text-xs font-mono font-bold text-brand bg-brand-soft dark:bg-brand/20 px-2 py-0.5 rounded-md" id="badge-p3-altura">${cfg.pagina3.altura_foto_mm} mm</span>
          </div>
          <input type="range" id="slider-p3-altura" min="10" max="130" step="2" value="${cfg.pagina3.altura_foto_mm}" class="w-full accent-brand cursor-pointer" />
          <div class="flex flex-wrap gap-2 mt-2">
            <button type="button" class="btn-quick-val px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:border-brand hover:text-brand transition" data-target="slider-p3-altura" data-val="10">10 mm (Mini)</button>
            <button type="button" class="btn-quick-val px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:border-brand hover:text-brand transition" data-target="slider-p3-altura" data-val="25">25 mm (Muy Chico)</button>
            <button type="button" class="btn-quick-val px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:border-brand hover:text-brand transition" data-target="slider-p3-altura" data-val="50">50 mm (Compacto)</button>
            <button type="button" class="btn-quick-val px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:border-brand hover:text-brand transition" data-target="slider-p3-altura" data-val="80">80 mm (Mediano)</button>
            <button type="button" class="btn-quick-val px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:border-brand hover:text-brand transition" data-target="slider-p3-altura" data-val="105">105 mm (Grande)</button>
            <button type="button" class="btn-quick-val px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:border-brand hover:text-brand transition" data-target="slider-p3-altura" data-val="130">130 mm (Máximo)</button>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">Ajuste / Encuadre de cada foto:</label>
            <select id="select-p3-ajuste" class="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
              <option value="contain" ${cfg.pagina3.ajuste_foto === 'contain' ? 'selected' : ''}>Contener completa (Proporcional sin recortes)</option>
              <option value="cover" ${cfg.pagina3.ajuste_foto === 'cover' ? 'selected' : ''}>Cubrir contenedor (Recorte centrado)</option>
            </select>
          </div>
          <div>
            <label class="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">Columnas por fila:</label>
            <select id="select-p3-columnas" class="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
              <option value="2" ${cfg.pagina3.columnas_por_fila === 2 ? 'selected' : ''}>2 Columnas (Fotos destacadas)</option>
              <option value="3" ${cfg.pagina3.columnas_por_fila === 3 ? 'selected' : ''}>3 Columnas (Galería compacta)</option>
              <option value="1" ${cfg.pagina3.columnas_por_fila === 1 ? 'selected' : ''}>1 Columna (Fotos grandes)</option>
            </select>
          </div>
        </div>

        <label class="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
          <input type="checkbox" id="chk-p3-mostrar-nombre" ${cfg.pagina3.mostrar_nombre_producto ? 'checked' : ''} class="w-4 h-4 rounded text-brand focus:ring-brand" />
          <span>Mostrar nombre del producto debajo de la foto</span>
        </label>
      </div>
    `;
    controlsCol.appendChild(cardPagina3);

    // -------------------------------------------------------------------------
    // TARJETA 11: Pie de Página (Redes Sociales y Presencia Web)
    // -------------------------------------------------------------------------
    const cardPiePagina = document.createElement('section');
    cardPiePagina.className = 'p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4';
    cardPiePagina.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="w-7 h-7 rounded-lg bg-teal-50 text-teal-600 dark:bg-teal-950/50 flex items-center justify-center text-xs">
          <i class="fa-solid fa-share-nodes"></i>
        </span>
        <div>
          <h3 class="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">Pie de Página (Redes Sociales y Presencia Web)</h3>
          <p class="text-[11px] text-slate-500">Configure los enlaces, datos de contacto oficiales y mensaje de cierre en la base de cada hoja.</p>
        </div>
      </div>

      <div class="space-y-3 pt-1">
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <label class="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium cursor-pointer">
            <input type="checkbox" id="chk-red-facebook" ${cfg.pie_pagina.redes.facebook ? 'checked' : ''} class="w-4 h-4 rounded text-brand" />
            <i class="fa-brands fa-facebook text-blue-600"></i> Facebook
          </label>
          <label class="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium cursor-pointer">
            <input type="checkbox" id="chk-red-instagram" ${cfg.pie_pagina.redes.instagram ? 'checked' : ''} class="w-4 h-4 rounded text-brand" />
            <i class="fa-brands fa-instagram text-pink-600"></i> Instagram
          </label>
          <label class="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium cursor-pointer">
            <input type="checkbox" id="chk-red-tiktok" ${cfg.pie_pagina.redes.tiktok ? 'checked' : ''} class="w-4 h-4 rounded text-brand" />
            <i class="fa-brands fa-tiktok text-slate-900 dark:text-white"></i> TikTok
          </label>
          <label class="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium cursor-pointer">
            <input type="checkbox" id="chk-red-sitio-web" ${cfg.pie_pagina.redes.sitio_web ? 'checked' : ''} class="w-4 h-4 rounded text-brand" />
            <i class="fa-solid fa-globe text-brand"></i> Sitio Web
          </label>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <label class="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium cursor-pointer">
            <input type="checkbox" id="chk-contacto-telefonos" ${cfg.pie_pagina.contacto.incluir_telefonos ? 'checked' : ''} class="w-4 h-4 rounded text-brand" />
            <span>Incluir teléfonos / WhatsApp oficiales (+595 981 654321)</span>
          </label>
          <label class="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium cursor-pointer">
            <input type="checkbox" id="chk-contacto-direccion" ${cfg.pie_pagina.contacto.incluir_direccion ? 'checked' : ''} class="w-4 h-4 rounded text-brand" />
            <span>Incluir dirección física / ciudad (Pdte Franco, Paraguay)</span>
          </label>
        </div>

        <div>
          <label class="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">Mensaje de Cierre:</label>
          <input type="text" id="input-mensaje-cierre" value="${escapeHtml(cfg.pie_pagina.mensaje_cierre)}" class="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold" />
        </div>
      </div>
    `;
    controlsCol.appendChild(cardPiePagina);

    // Barra de Guardar inferior
    const bottomBar = document.createElement('div');
    bottomBar.className = 'sticky bottom-0 p-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border-t border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between shadow-lg';
    bottomBar.innerHTML = `
      <span class="text-xs text-slate-500"><i class="fa-solid fa-cloud-arrow-up text-brand mr-1"></i> Cambios listos para guardar</span>
      <div id="bottom-save-container"></div>
    `;
    const bottomSaveBtn = createButton({
      text: 'Guardar configuración de presupuestos',
      icon: 'fa-solid fa-floppy-disk',
      variant: 'primary',
      size: 'md',
      onClick: () => handleGuardarConfig(),
    });
    bottomBar.querySelector('#bottom-save-container').appendChild(bottomSaveBtn);
    controlsCol.appendChild(bottomBar);

    splitGrid.appendChild(controlsCol);
    wrap.appendChild(splitGrid);
    parent.appendChild(wrap);

    // =========================================================================
    // RENDERIZADO DE LA VISTA PREVIA (A4 Oficial)
    // =========================================================================
    function updatePreview() {
      pagesWrapper.innerHTML = '';

      // Ancho base del preview en píxeles (equivalente visual proporcional A4 210mm x 297mm)
      const baseA4W = 520;
      const baseA4H = Math.round(baseA4W * 1.4142); // 735px

      // Escala de zoom aplicada
      pagesWrapper.style.transform = `scale(${currentZoom})`;

      // 1. PÁGINA 1: PORTADA
      if (activePageFilter === 'todas' || activePageFilter === 'portada') {
        const p1 = document.createElement('div');
        p1.id = 'page-preview-1';
        p1.className = 'relative rounded-lg shadow-md overflow-hidden shrink-0 flex items-center justify-center transition-all duration-150';
        p1.style.width = `${baseA4W}px`;
        p1.style.height = `${baseA4H}px`;
        p1.style.backgroundColor = cfg.caratula.estilo_color;

        const logoScalePx = Math.round((cfg.caratula.logo_ancho / 210) * baseA4W);
        p1.innerHTML = `
          <img src="/logo/R1.png" alt="R1 Personalizados" class="transition-all" style="width: ${logoScalePx}px; max-width: 90%;" />
        `;
        pagesWrapper.appendChild(p1);
      }

      // 2. PÁGINA 2: CONTENIDO
      if (activePageFilter === 'todas' || activePageFilter === 'contenido') {
        const p2 = document.createElement('div');
        p2.id = 'page-preview-2';
        p2.className = 'relative rounded-lg shadow-md overflow-hidden shrink-0 bg-white text-slate-900 transition-all duration-150 flex flex-col';
        p2.style.width = `${baseA4W}px`;
        p2.style.height = `${baseA4H}px`;
        p2.style.padding = '24px 28px 30px 28px';

        const scale = (cfg.pagina2.tamano_textos_porcentaje / 100);
        const gap = cfg.pagina2.separacion_bloques_px;
        const logoH = Math.round((cfg.pagina2.cabecera_logo_alto / 297) * baseA4H);

        const desc = cfg.pagina2.descuento;
        const terminosCfg = cfg.pagina2.terminos || {};
        const terminosPosPx = Number(terminosCfg.posicion_vertical_px ?? 20);

        // Auto-shrink si hay muchos productos para garantizar que NUNCA pase de página
        const itemsCount = sampleBudget.items.length;
        let autoShrinkFactor = 1;
        if (itemsCount > 4) {
          autoShrinkFactor = Math.max(0.65, 1 - (itemsCount - 4) * 0.045);
        }
        const effectiveTermsScale = scale * autoShrinkFactor;
        const effectiveMarginPx = Math.max(0, Math.min(130, Math.round(terminosPosPx * autoShrinkFactor)));

        const tituloHtml = terminosCfg.titulo_html || `<strong>${escapeHtml(terminosCfg.titulo || 'TÉRMINOS Y CONDICIONES')}</strong>`;
        let clausulasHtml = terminosCfg.clausulas_html;
        if (!clausulasHtml) {
          const list = Array.isArray(terminosCfg.clausulas) ? terminosCfg.clausulas : [];
          clausulasHtml = `<ol class="list-decimal pl-4 space-y-0.5">${list.map(t => `<li>${escapeHtml(t)}</li>`).join('')}</ol>`;
        }

        p2.innerHTML = `
          <!-- Logo Superior -->
          <div class="text-center mb-1 shrink-0" style="${cfg.pagina2.cabecera_logo_visible ? '' : 'display: none;'}">
            <img src="/logo/R1.png" alt="R1" class="mx-auto" style="height: ${logoH}px;" />
          </div>

          <!-- Barra Oficial -->
          <div class="text-white text-center font-black tracking-widest uppercase rounded-sm py-1 shrink-0" style="background-color: ${cfg.caratula.estilo_color}; font-size: ${11 * scale}px; margin-bottom: ${gap * 0.75}px; ${cfg.pagina2.titulo_barra_visible ? '' : 'display: none;'}">
            ${escapeHtml(cfg.pagina2.titulo_barra_texto)}
          </div>

          <!-- Meta Box Cliente -->
          <div class="grid grid-cols-2 gap-x-4 gap-y-0.5 p-2 rounded-md border border-slate-300 bg-slate-50 shrink-0 text-slate-800" style="font-size: ${9.5 * scale}px; margin-bottom: ${gap * 0.75}px;">
            <div><span class="font-bold text-slate-600">CLIENTE:</span> ${escapeHtml(sampleBudget.cliente.nombre)}</div>
            <div><span class="font-bold text-slate-600">FECHA:</span> ${sampleBudget.fecha_emision}</div>
            <div><span class="font-bold text-slate-600">RUC / CI:</span> ${sampleBudget.cliente.ruc}</div>
            <div><span class="font-bold text-slate-600">TELÉFONO:</span> ${sampleBudget.cliente.telefono}</div>
            <div><span class="font-bold text-slate-600">VALIDEZ HASTA:</span> ${sampleBudget.validez_fecha}</div>
            <div><span class="font-bold text-slate-600">N° PRESUPUESTO:</span> ${sampleBudget.numero_presupuesto}</div>
          </div>

          <!-- Tabla de Artículos -->
          <table class="w-full border-collapse shrink-0" style="font-size: ${10 * scale}px; margin-bottom: ${gap * 0.75}px;">
            <thead>
              <tr class="bg-slate-100 border-b-2 border-slate-300 text-slate-600 text-[9px] font-bold">
                <th class="py-1 px-1.5 text-left">DESCRIPCIÓN</th>
                <th class="py-1 px-1.5 text-right">PRECIO UNITARIO</th>
                <th class="py-1 px-1.5 text-center">CANT.</th>
                <th class="py-1 px-1.5 text-right">TOTAL</th>
              </tr>
            </thead>
            <tbody>
              ${sampleBudget.items.map(it => `
                <tr class="border-b border-slate-200">
                  <td class="py-1 px-1.5 flex items-center gap-1.5">
                    <img src="${it.imagen_url}" class="w-4 h-4 rounded-xs object-cover" style="${cfg.pagina2.foto_producto_descripcion ? '' : 'display: none;'}" />
                    <span>${escapeHtml(it.descripcion)}</span>
                  </td>
                  <td class="py-1 px-1.5 text-right font-mono">${it.precio_unitario_formateado}</td>
                  <td class="py-1 px-1.5 text-center">${it.cantidad}</td>
                  <td class="py-1 px-1.5 text-right font-mono font-bold">${it.total_formateado}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <!-- Cuadro de Descuento -->
          <div class="py-1 px-2.5 text-center font-bold rounded-md shrink-0 transition-all" style="font-size: ${10 * scale}px; margin-bottom: ${gap * 0.75}px; background-color: ${desc.color_fondo}; color: ${desc.color_texto}; border: ${desc.mostrar_cuadro_borde ? `1px solid ${desc.color_borde}` : 'none'}; ${desc.visible ? '' : 'display: none;'}">
            ${escapeHtml(desc.texto)}
          </div>

          <!-- Totales -->
          <div class="flex justify-end shrink-0" style="margin-bottom: ${gap * 0.75}px;">
            <div class="w-52 space-y-0.5" style="font-size: ${10 * scale}px;">
              <div class="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span class="font-mono">${sampleBudget.totales.subtotal_formateado}</span>
              </div>
              <div class="flex justify-between text-rose-600">
                <span>Descuento (${sampleBudget.totales.porcentaje_descuento}%):</span>
                <span class="font-mono">${sampleBudget.totales.monto_descuento_formateado}</span>
              </div>
              <div class="flex justify-between text-white font-bold p-1 rounded-sm" style="background-color: ${cfg.caratula.estilo_color}; font-size: ${11 * scale}px;">
                <span>TOTAL CON DESC.:</span>
                <span class="font-mono">${sampleBudget.totales.total_final_formateado}</span>
              </div>
            </div>
          </div>

          <!-- Términos y Condiciones -->
          <div class="border-t border-slate-200 pt-1.5 text-slate-600 transition-all" style="margin-top: ${effectiveMarginPx}px; font-size: ${7.5 * effectiveTermsScale}px; margin-bottom: 22px; max-height: calc(100% - 25px); overflow: hidden;">
            <div class="font-bold text-slate-800 uppercase mb-0.5" style="font-size: ${8.5 * effectiveTermsScale}px;">${tituloHtml}</div>
            <div class="terms-preview-body leading-tight">${clausulasHtml}</div>
          </div>

          <!-- Pie de Página -->
          <div class="absolute bottom-0 left-0 right-0 py-1.5 px-4 text-center text-white" style="background-color: ${cfg.caratula.estilo_color}; font-size: 7.5px; line-height: 1.3;">
            <div class="font-bold">${escapeHtml(cfg.pie_pagina.mensaje_cierre)}</div>
            <div>
              ${cfg.pie_pagina.redes.instagram ? 'instagram.com/r1personalizados • ' : ''}
              ${cfg.pie_pagina.redes.facebook ? 'facebook.com/r1personalizados • ' : ''}
              ${cfg.pie_pagina.redes.tiktok ? 'tiktok.com/@r1personalizados • ' : ''}
              ${cfg.pie_pagina.redes.sitio_web ? 'netz.com.py' : ''}
            </div>
            <div>
              ${cfg.pie_pagina.contacto.incluir_telefonos ? '+595 981 654321 • ' : ''}
              ${cfg.pie_pagina.contacto.incluir_direccion ? 'Pdte Franco, Paraguay' : ''}
            </div>
          </div>
        `;
        pagesWrapper.appendChild(p2);
      }

      // 3. PÁGINA 3: FOTOS DE PRODUCTOS
      if ((activePageFilter === 'todas' || activePageFilter === 'fotos') && cfg.pagina3.visible) {
        const p3 = document.createElement('div');
        p3.id = 'page-preview-3';
        p3.className = 'relative rounded-lg shadow-md overflow-hidden shrink-0 bg-white text-slate-900 transition-all duration-150 flex flex-col';
        p3.style.width = `${baseA4W}px`;
        p3.style.height = `${baseA4H}px`;
        p3.style.padding = '24px 28px 30px 28px';

        const cols = cfg.pagina3.columnas_por_fila || 2;
        const fotoH = Math.round((cfg.pagina3.altura_foto_mm / 297) * baseA4H);
        const gap = cfg.pagina3.separacion_fotos_px;
        const posV = cfg.pagina3.posicion_vertical_px;
        const posH = cfg.pagina3.posicion_horizontal_px;

        p3.innerHTML = `
          <!-- Barra Superior Fotos -->
          <div class="text-white text-center font-black tracking-widest uppercase rounded-sm py-1 shrink-0" style="background-color: ${cfg.caratula.estilo_color}; font-size: 11px; margin-bottom: 12px; ${cfg.pagina3.titulo_visible ? '' : 'display: none;'}">
            ${escapeHtml(cfg.pagina3.titulo)}
          </div>

          <!-- Grilla de Fotos -->
          <div class="grid w-full" style="grid-template-columns: repeat(${cols}, 1fr); gap: ${gap}px; margin-top: ${posV}px; margin-left: ${posH}px;">
            ${sampleBudget.imagenes_productos.map(img => `
              <div class="bg-white border border-slate-200 rounded-md p-1.5 text-center shadow-2xs">
                <img src="${img.url}" class="w-full rounded-xs" style="height: ${fotoH}px; object-fit: ${cfg.pagina3.ajuste_foto};" />
                <div class="text-[9.5px] font-semibold text-slate-700 mt-1" style="${cfg.pagina3.mostrar_nombre_producto ? '' : 'display: none;'}">${escapeHtml(img.nombre)}</div>
              </div>
            `).join('')}
          </div>

          <!-- Pie de Página -->
          <div class="absolute bottom-0 left-0 right-0 py-1.5 px-4 text-center text-white" style="background-color: ${cfg.caratula.estilo_color}; font-size: 7.5px; line-height: 1.3;">
            <div class="font-bold">${escapeHtml(cfg.pie_pagina.mensaje_cierre)}</div>
            <div>
              ${cfg.pie_pagina.redes.instagram ? 'instagram.com/r1personalizados • ' : ''}
              ${cfg.pie_pagina.redes.facebook ? 'facebook.com/r1personalizados • ' : ''}
              ${cfg.pie_pagina.redes.tiktok ? 'tiktok.com/@r1personalizados • ' : ''}
              ${cfg.pie_pagina.redes.sitio_web ? 'netz.com.py' : ''}
            </div>
            <div>
              ${cfg.pie_pagina.contacto.incluir_telefonos ? '+595 981 654321 • ' : ''}
              ${cfg.pie_pagina.contacto.incluir_direccion ? 'Pdte Franco, Paraguay' : ''}
            </div>
          </div>
        `;
        pagesWrapper.appendChild(p3);
      }
    }

    // =========================================================================
    // VINCULACIÓN DE CONTROLES (Event Listeners de Tiempo Real)
    // =========================================================================

    // Zoom selector
    const zoomSelect = previewCard.querySelector('#preview-zoom-select');
    zoomSelect.addEventListener('change', () => {
      if (zoomSelect.value === 'fit') {
        const availableW = previewViewport.clientWidth - 48;
        currentZoom = Math.min(1, Math.max(0.4, availableW / 520));
      } else {
        currentZoom = parseFloat(zoomSelect.value) || 1;
      }
      updatePreview();
    });

    // Page filter buttons
    const filterBtns = previewCard.querySelectorAll('#page-filter-btns button');
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        filterBtns.forEach(b => {
          b.className = 'px-2.5 py-1 rounded-md text-[11px] font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition';
        });
        btn.className = 'px-2.5 py-1 rounded-md text-[11px] font-semibold transition bg-brand text-white';
        activePageFilter = btn.dataset.filter;
        updatePreview();
      });
    });

    // 1. Carátula Logo Slider & Quick Buttons
    const sliderCaratulaLogo = cardCaratulaLogo.querySelector('#slider-caratula-logo');
    const badgeCaratulaLogo = cardCaratulaLogo.querySelector('#badge-caratula-logo-val');
    const miniCoverThumb = cardCaratulaLogo.querySelector('#mini-cover-thumb');
    const miniCoverLogo = cardCaratulaLogo.querySelector('#mini-cover-logo');

    function syncCaratulaLogo(val) {
      cfg.caratula.logo_ancho = parseInt(val, 10);
      sliderCaratulaLogo.value = val;
      badgeCaratulaLogo.textContent = `${val} mm`;
      miniCoverLogo.style.width = `${val * 0.45}px`;
      updatePreview();
    }
    sliderCaratulaLogo.addEventListener('input', (e) => syncCaratulaLogo(e.target.value));

    // 2. Textos P2
    const sliderTextosP2 = cardTextosP2.querySelector('#slider-textos-p2');
    const badgeTextosP2 = cardTextosP2.querySelector('#badge-textos-p2-val');
    function syncTextosP2(val) {
      cfg.pagina2.tamano_textos_porcentaje = parseInt(val, 10);
      sliderTextosP2.value = val;
      badgeTextosP2.textContent = `${val}% • ${val >= 100 ? 'Normal' : val >= 90 ? 'Mediano' : val >= 80 ? 'Compacto' : 'Reducido'}`;
      updatePreview();
    }
    sliderTextosP2.addEventListener('input', (e) => syncTextosP2(e.target.value));

    // 3. Separación Bloques
    const sliderSeparacion = cardSeparacion.querySelector('#slider-separacion');
    const badgeSeparacion = cardSeparacion.querySelector('#badge-separacion-val');
    function syncSeparacion(val) {
      cfg.pagina2.separacion_bloques_px = parseInt(val, 10);
      sliderSeparacion.value = val;
      badgeSeparacion.textContent = `${val} px • ${val <= 12 ? 'Apretado' : val <= 20 ? 'Estándar' : val <= 30 ? 'Amplio' : 'Extendido'}`;
      updatePreview();
    }
    sliderSeparacion.addEventListener('input', (e) => syncSeparacion(e.target.value));

    // 4. Color Temático
    const pickerColor = cardColor.querySelector('#picker-estilo-color');
    const inputColorHex = cardColor.querySelector('#input-estilo-color-hex');
    function syncColor(val) {
      cfg.caratula.estilo_color = val;
      pickerColor.value = val;
      inputColorHex.value = val.toUpperCase();
      miniCoverThumb.style.backgroundColor = val;
      updatePreview();
    }
    pickerColor.addEventListener('input', (e) => syncColor(e.target.value));
    inputColorHex.addEventListener('change', (e) => {
      let val = e.target.value.trim();
      if (!val.startsWith('#')) val = '#' + val;
      if (/^#[0-9A-F]{6}$/i.test(val)) syncColor(val);
    });
    cardColor.querySelectorAll('.btn-color-preset').forEach(btn => {
      btn.addEventListener('click', () => syncColor(btn.dataset.color));
    });

    // 5. Logo Cabecera P2
    const chkLogoP2 = cardLogoCabecera.querySelector('#chk-logo-p2-visible');
    const sliderLogoP2 = cardLogoCabecera.querySelector('#slider-logo-p2');
    const badgeLogoP2 = cardLogoCabecera.querySelector('#badge-logo-p2-val');
    chkLogoP2.addEventListener('change', () => {
      cfg.pagina2.cabecera_logo_visible = chkLogoP2.checked;
      updatePreview();
    });
    function syncLogoP2(val) {
      cfg.pagina2.cabecera_logo_alto = parseInt(val, 10);
      sliderLogoP2.value = val;
      badgeLogoP2.textContent = `${val} mm • ${val <= 16 ? 'Mini' : val <= 22 ? 'Compacto' : val <= 28 ? 'Estándar' : val <= 38 ? 'Mediano' : 'Grande'}`;
      updatePreview();
    }
    sliderLogoP2.addEventListener('input', (e) => syncLogoP2(e.target.value));

    // 6. Título Barra Oficial
    const chkTituloBarra = cardTituloBarra.querySelector('#chk-titulo-barra-visible');
    const inputTituloBarra = cardTituloBarra.querySelector('#input-titulo-barra');
    chkTituloBarra.addEventListener('change', () => {
      cfg.pagina2.titulo_barra_visible = chkTituloBarra.checked;
      updatePreview();
    });
    inputTituloBarra.addEventListener('input', (e) => {
      cfg.pagina2.titulo_barra_texto = e.target.value;
      updatePreview();
    });
    cardTituloBarra.querySelector('#btn-def-titulo-barra').addEventListener('click', () => {
      inputTituloBarra.value = 'PRESUPUESTO OFICIAL';
      cfg.pagina2.titulo_barra_texto = 'PRESUPUESTO OFICIAL';
      updatePreview();
    });

    // 7. Foto en Descripción
    const chkFotoDesc = cardFotoDescripcion.querySelector('#chk-foto-desc-visible');
    chkFotoDesc.addEventListener('change', () => {
      cfg.pagina2.foto_producto_descripcion = chkFotoDesc.checked;
      updatePreview();
    });

    // 8. Descuento / Promoción
    const chkDescVis = cardDescuento.querySelector('#chk-descuento-visible');
    const chkDescBorde = cardDescuento.querySelector('#chk-descuento-borde');
    const inputDescTxt = cardDescuento.querySelector('#input-descuento-texto');
    const pickerDescBg = cardDescuento.querySelector('#picker-desc-bg');
    const pickerDescTxt = cardDescuento.querySelector('#picker-desc-text');
    const pickerDescBorder = cardDescuento.querySelector('#picker-desc-border');
    const inputDescBgHex = cardDescuento.querySelector('#input-desc-bg-hex');
    const inputDescTxtHex = cardDescuento.querySelector('#input-desc-text-hex');
    const inputDescBorderHex = cardDescuento.querySelector('#input-desc-border-hex');
    const descLivePreviewBox = cardDescuento.querySelector('#desc-live-preview-box');

    function syncDescuentoUI() {
      descLivePreviewBox.style.backgroundColor = cfg.pagina2.descuento.color_fondo;
      descLivePreviewBox.style.color = cfg.pagina2.descuento.color_texto;
      descLivePreviewBox.style.border = cfg.pagina2.descuento.mostrar_cuadro_borde ? `1px solid ${cfg.pagina2.descuento.color_borde}` : 'none';
      descLivePreviewBox.textContent = cfg.pagina2.descuento.texto;
      updatePreview();
    }

    chkDescVis.addEventListener('change', () => {
      cfg.pagina2.descuento.visible = chkDescVis.checked;
      updatePreview();
    });
    chkDescBorde.addEventListener('change', () => {
      cfg.pagina2.descuento.mostrar_cuadro_borde = chkDescBorde.checked;
      syncDescuentoUI();
    });
    inputDescTxt.addEventListener('input', (e) => {
      cfg.pagina2.descuento.texto = e.target.value;
      syncDescuentoUI();
    });
    cardDescuento.querySelector('#btn-def-descuento-texto').addEventListener('click', () => {
      inputDescTxt.value = '¡10% DE DESCUENTO POR PAGO AL CONTADO!';
      cfg.pagina2.descuento.texto = '¡10% DE DESCUENTO POR PAGO AL CONTADO!';
      syncDescuentoUI();
    });

    pickerDescBg.addEventListener('input', (e) => {
      cfg.pagina2.descuento.color_fondo = e.target.value;
      inputDescBgHex.value = e.target.value.toUpperCase();
      syncDescuentoUI();
    });
    pickerDescTxt.addEventListener('input', (e) => {
      cfg.pagina2.descuento.color_texto = e.target.value;
      inputDescTxtHex.value = e.target.value.toUpperCase();
      syncDescuentoUI();
    });
    pickerDescBorder.addEventListener('input', (e) => {
      cfg.pagina2.descuento.color_borde = e.target.value;
      inputDescBorderHex.value = e.target.value.toUpperCase();
      syncDescuentoUI();
    });

    cardDescuento.querySelectorAll('.btn-desc-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        cfg.pagina2.descuento.color_fondo = btn.dataset.bg;
        cfg.pagina2.descuento.color_texto = btn.dataset.text;
        cfg.pagina2.descuento.color_borde = btn.dataset.border;
        pickerDescBg.value = btn.dataset.bg;
        pickerDescTxt.value = btn.dataset.text;
        pickerDescBorder.value = btn.dataset.border;
        inputDescBgHex.value = btn.dataset.bg.toUpperCase();
        inputDescTxtHex.value = btn.dataset.text.toUpperCase();
        inputDescBorderHex.value = btn.dataset.border.toUpperCase();
        syncDescuentoUI();
      });
    });

    // 9. Términos y Condiciones
    const sliderTerminosPos = cardTerminos.querySelector('#slider-terminos-pos');
    const badgeTerminosPos = cardTerminos.querySelector('#badge-terminos-pos-val');

    sliderTerminosPos.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      cfg.pagina2.terminos.posicion_vertical_px = val;
      badgeTerminosPos.textContent = `${val} px`;
      updatePreview();
    });

    const defaultClausesHtml = '<ol class="list-decimal pl-4 space-y-1"><li><strong>Validez de la oferta:</strong> Este presupuesto tiene una validez de 15 días corridos a partir de su fecha de emisión.</li><li><strong>Condiciones de pago:</strong> El pedido se confirma con la entrega del 60%, por medio de efectivo o transferencia bancaria.</li><li><strong>Plazos de entrega:</strong> Tiempo estimado de 3 a 5 días hábiles posterior a la aprobación del diseño y confirmación de seña.</li><li><strong>Garantía y cambios:</strong> Tratándose de artículos personalizados, no se admiten cancelaciones una vez iniciada la producción.</li></ol>';

    const initialTitleHtml = cfg.pagina2.terminos.titulo_html || `<strong>${escapeHtml(cfg.pagina2.terminos.titulo || 'TÉRMINOS Y CONDICIONES')}</strong>`;
    const initialClausesHtml = cfg.pagina2.terminos.clausulas_html || (Array.isArray(cfg.pagina2.terminos.clausulas) && cfg.pagina2.terminos.clausulas.length ? `<ol class="list-decimal pl-4 space-y-1">${cfg.pagina2.terminos.clausulas.map(c => `<li>${escapeHtml(c)}</li>`).join('')}</ol>` : defaultClausesHtml);

    const editorTitulo = createRichEditor({
      container: cardTerminos.querySelector('#container-rich-editor-titulo'),
      initialHtml: initialTitleHtml,
      placeholder: 'Título de términos...',
      showLists: false,
      minHeight: '38px',
      onUpdate: (html) => {
        cfg.pagina2.terminos.titulo_html = html;
        updatePreview();
      },
    });

    const editorClausulas = createRichEditor({
      container: cardTerminos.querySelector('#container-rich-editor-clausulas'),
      initialHtml: initialClausesHtml,
      placeholder: 'Redacte las cláusulas aquí...',
      showLists: true,
      minHeight: '110px',
      onUpdate: (html) => {
        cfg.pagina2.terminos.clausulas_html = html;
        updatePreview();
      },
    });

    cardTerminos.querySelector('#btn-def-terminos-titulo').addEventListener('click', () => {
      const defTit = '<strong>TÉRMINOS Y CONDICIONES</strong>';
      cfg.pagina2.terminos.titulo_html = defTit;
      cfg.pagina2.terminos.titulo = 'TÉRMINOS Y CONDICIONES';
      editorTitulo.setHtml(defTit);
      updatePreview();
    });

    cardTerminos.querySelector('#btn-def-terminos-clausulas').addEventListener('click', () => {
      cfg.pagina2.terminos.clausulas_html = defaultClausesHtml;
      editorClausulas.setHtml(defaultClausesHtml);
      updatePreview();
    });

    // 10. Página 3 Fotos
    const chkP3Vis = cardPagina3.querySelector('#chk-p3-visible');
    const chkP3TitVis = cardPagina3.querySelector('#chk-p3-titulo-visible');
    const inputP3Tit = cardPagina3.querySelector('#input-p3-titulo');
    const sliderP3PosV = cardPagina3.querySelector('#slider-p3-pos-v');
    const sliderP3PosH = cardPagina3.querySelector('#slider-p3-pos-h');
    const sliderP3Gap = cardPagina3.querySelector('#slider-p3-gap');
    const sliderP3Altura = cardPagina3.querySelector('#slider-p3-altura');
    const selectP3Ajuste = cardPagina3.querySelector('#select-p3-ajuste');
    const selectP3Cols = cardPagina3.querySelector('#select-p3-columnas');
    const chkP3Nombre = cardPagina3.querySelector('#chk-p3-mostrar-nombre');

    chkP3Vis.addEventListener('change', () => {
      cfg.pagina3.visible = chkP3Vis.checked;
      updatePreview();
    });
    chkP3TitVis.addEventListener('change', () => {
      cfg.pagina3.titulo_visible = chkP3TitVis.checked;
      updatePreview();
    });
    inputP3Tit.addEventListener('input', (e) => {
      cfg.pagina3.titulo = e.target.value;
      updatePreview();
    });
    sliderP3PosV.addEventListener('input', (e) => {
      cfg.pagina3.posicion_vertical_px = parseInt(e.target.value, 10);
      cardPagina3.querySelector('#badge-p3-pos-v').textContent = `${e.target.value} px`;
      updatePreview();
    });
    sliderP3PosH.addEventListener('input', (e) => {
      cfg.pagina3.posicion_horizontal_px = parseInt(e.target.value, 10);
      cardPagina3.querySelector('#badge-p3-pos-h').textContent = `${e.target.value} px`;
      updatePreview();
    });
    sliderP3Gap.addEventListener('input', (e) => {
      cfg.pagina3.separacion_fotos_px = parseInt(e.target.value, 10);
      cardPagina3.querySelector('#badge-p3-gap').textContent = `${e.target.value} px`;
      updatePreview();
    });
    sliderP3Altura.addEventListener('input', (e) => {
      cfg.pagina3.altura_foto_mm = parseInt(e.target.value, 10);
      cardPagina3.querySelector('#badge-p3-altura').textContent = `${e.target.value} mm`;
      updatePreview();
    });
    selectP3Ajuste.addEventListener('change', () => {
      cfg.pagina3.ajuste_foto = selectP3Ajuste.value;
      updatePreview();
    });
    selectP3Cols.addEventListener('change', () => {
      cfg.pagina3.columnas_por_fila = parseInt(selectP3Cols.value, 10) || 2;
      updatePreview();
    });
    chkP3Nombre.addEventListener('change', () => {
      cfg.pagina3.mostrar_nombre_producto = chkP3Nombre.checked;
      updatePreview();
    });

    // 11. Pie de Página
    const chkRedFb = cardPiePagina.querySelector('#chk-red-facebook');
    const chkRedIg = cardPiePagina.querySelector('#chk-red-instagram');
    const chkRedTk = cardPiePagina.querySelector('#chk-red-tiktok');
    const chkRedWeb = cardPiePagina.querySelector('#chk-red-sitio-web');
    const chkTel = cardPiePagina.querySelector('#chk-contacto-telefonos');
    const chkDir = cardPiePagina.querySelector('#chk-contacto-direccion');
    const inputCierre = cardPiePagina.querySelector('#input-mensaje-cierre');

    chkRedFb.addEventListener('change', () => { cfg.pie_pagina.redes.facebook = chkRedFb.checked; updatePreview(); });
    chkRedIg.addEventListener('change', () => { cfg.pie_pagina.redes.instagram = chkRedIg.checked; updatePreview(); });
    chkRedTk.addEventListener('change', () => { cfg.pie_pagina.redes.tiktok = chkRedTk.checked; updatePreview(); });
    chkRedWeb.addEventListener('change', () => { cfg.pie_pagina.redes.sitio_web = chkRedWeb.checked; updatePreview(); });
    chkTel.addEventListener('change', () => { cfg.pie_pagina.contacto.incluir_telefonos = chkTel.checked; updatePreview(); });
    chkDir.addEventListener('change', () => { cfg.pie_pagina.contacto.incluir_direccion = chkDir.checked; updatePreview(); });
    inputCierre.addEventListener('input', (e) => { cfg.pie_pagina.mensaje_cierre = e.target.value; updatePreview(); });

    // Botones rápidos genéricos en tarjetas (data-target & data-val)
    controlsCol.querySelectorAll('.btn-quick-val').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.dataset.target;
        const val = btn.dataset.val;
        const input = controlsCol.querySelector('#' + targetId);
        if (input) {
          input.value = val;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
    });

    // =========================================================================
    // CARGA INICIAL DESDE LA API
    // =========================================================================
    async function loadConfigFromBackend() {
      try {
        const res = await apiFetch('/api/config/budget-template').catch(() => null);
        if (res && res.caratula) {
          cfg = res;
          // Sincronizar inputs
          syncCaratulaLogo(cfg.caratula.logo_ancho || 140);
          syncTextosP2(cfg.pagina2.tamano_textos_porcentaje || 100);
          syncSeparacion(cfg.pagina2.separacion_bloques_px || 20);
          syncColor(cfg.caratula.estilo_color || '#435A62');
          syncLogoP2(cfg.pagina2.cabecera_logo_alto || 28);
          chkLogoP2.checked = cfg.pagina2.cabecera_logo_visible !== false;
          chkTituloBarra.checked = cfg.pagina2.titulo_barra_visible !== false;
          inputTituloBarra.value = cfg.pagina2.titulo_barra_texto || 'PRESUPUESTO OFICIAL';
          chkFotoDesc.checked = cfg.pagina2.foto_producto_descripcion !== false;
          chkDescVis.checked = cfg.pagina2.descuento.visible !== false;
          chkDescBorde.checked = cfg.pagina2.descuento.mostrar_cuadro_borde !== false;
          inputDescTxt.value = cfg.pagina2.descuento.texto || '¡10% DE DESCUENTO POR PAGO AL CONTADO!';
          pickerDescBg.value = cfg.pagina2.descuento.color_fondo || '#FEF2F2';
          pickerDescTxt.value = cfg.pagina2.descuento.color_texto || '#DC2626';
          pickerDescBorder.value = cfg.pagina2.descuento.color_borde || '#FECACA';
          syncDescuentoUI();
          sliderTerminosPos.value = cfg.pagina2.terminos.posicion_vertical_px ?? 20;
          badgeTerminosPos.textContent = `${sliderTerminosPos.value} px`;
          if (cfg.pagina2.terminos.titulo_html) {
            editorTitulo.setHtml(cfg.pagina2.terminos.titulo_html);
          } else if (cfg.pagina2.terminos.titulo) {
            editorTitulo.setHtml(`<strong>${escapeHtml(cfg.pagina2.terminos.titulo)}</strong>`);
          }
          if (cfg.pagina2.terminos.clausulas_html) {
            editorClausulas.setHtml(cfg.pagina2.terminos.clausulas_html);
          } else if (Array.isArray(cfg.pagina2.terminos.clausulas) && cfg.pagina2.terminos.clausulas.length) {
            editorClausulas.setHtml(`<ol class="list-decimal pl-4 space-y-1">${cfg.pagina2.terminos.clausulas.map(c => `<li>${escapeHtml(c)}</li>`).join('')}</ol>`);
          }
          chkP3Vis.checked = cfg.pagina3.visible !== false;
          chkP3TitVis.checked = cfg.pagina3.titulo_visible !== false;
          inputP3Tit.value = cfg.pagina3.titulo || 'FOTOS DE PRODUCTOS';
          sliderP3PosV.value = cfg.pagina3.posicion_vertical_px || 20;
          sliderP3PosH.value = cfg.pagina3.posicion_horizontal_px || 0;
          sliderP3Gap.value = cfg.pagina3.separacion_fotos_px || 16;
          sliderP3Altura.value = cfg.pagina3.altura_foto_mm || 80;
          selectP3Ajuste.value = cfg.pagina3.ajuste_foto || 'contain';
          selectP3Cols.value = String(cfg.pagina3.columnas_por_fila || 2);
          chkP3Nombre.checked = cfg.pagina3.mostrar_nombre_producto !== false;
          chkRedFb.checked = cfg.pie_pagina.redes.facebook !== false;
          chkRedIg.checked = cfg.pie_pagina.redes.instagram !== false;
          chkRedTk.checked = cfg.pie_pagina.redes.tiktok !== false;
          chkRedWeb.checked = cfg.pie_pagina.redes.sitio_web !== false;
          chkTel.checked = cfg.pie_pagina.contacto.incluir_telefonos !== false;
          chkDir.checked = cfg.pie_pagina.contacto.incluir_direccion !== false;
          inputCierre.value = cfg.pie_pagina.mensaje_cierre || '¡Muchas gracias por su preferencia!';
        }
      } catch (err) {
        console.warn('[PresupuestoTab] Usando valores oficiales predeterminados:', err);
      } finally {
        updatePreview();
      }
    }

    loadConfigFromBackend();

    // =========================================================================
    // ACCIONES: GUARDAR, DESCARGAR, RESTABLECER
    // =========================================================================
    async function handleGuardarConfig() {
      btnGuardarTop.disabled = true;
      bottomSaveBtn.disabled = true;
      try {
        const res = await apiFetch('/api/config/budget-template', {
          method: 'POST',
          body: JSON.stringify(cfg),
        });
        toast.success(res?.message || 'Configuración de presupuestos guardada con éxito');
      } catch (err) {
        console.error('Error al guardar configuración:', err);
        toast.error('Error al guardar: ' + (err.message || 'Error desconocido'));
      } finally {
        btnGuardarTop.disabled = false;
        bottomSaveBtn.disabled = false;
      }
    }

    async function handleDescargarMuestraPDF() {
      btnDescargarTop.disabled = true;
      try {
        toast.info('Generando documento de muestra...');
        await BudgetDocumentService.generateBudgetPDF('PRES-2026-0003', {
          openInNewTab: true,
          download: false,
          customConfig: cfg,
        });
        toast.success('Muestra generada con éxito');
      } catch (err) {
        console.error('Error al generar muestra:', err);
        toast.error('Error al generar PDF: ' + err.message);
      } finally {
        btnDescargarTop.disabled = false;
      }
    }

    function handleRestablecerDefaults() {
      openConfirmModal({
        title: 'Restablecer Valores por Defecto',
        message: '¿Desea restaurar todos los parámetros de presupuestos a sus valores oficiales de fábrica?',
        confirmText: 'Restablecer',
        confirmVariant: 'danger',
        onConfirm: ({ close }) => {
          if (typeof close === 'function') close();
          cfg = BudgetDocumentService.getDefaultBudgetConfig();
          syncCaratulaLogo(140);
          syncTextosP2(100);
          syncSeparacion(20);
          syncColor('#435A62');
          syncLogoP2(28);
          chkLogoP2.checked = true;
          chkTituloBarra.checked = true;
          inputTituloBarra.value = 'PRESUPUESTO OFICIAL';
          chkFotoDesc.checked = true;
          chkDescVis.checked = true;
          chkDescBorde.checked = true;
          inputDescTxt.value = '¡10% DE DESCUENTO POR PAGO AL CONTADO!';
          pickerDescBg.value = '#FEF2F2';
          pickerDescTxt.value = '#DC2626';
          pickerDescBorder.value = '#FECACA';
          syncDescuentoUI();
          sliderTerminosPos.value = 20;
          badgeTerminosPos.textContent = '20 px';
          editorTitulo.setHtml('<strong>TÉRMINOS Y CONDICIONES</strong>');
          editorClausulas.setHtml(defaultClausesHtml);
          chkP3Vis.checked = true;
          chkP3TitVis.checked = true;
          inputP3Tit.value = 'FOTOS DE PRODUCTOS';
          sliderP3PosV.value = 20;
          sliderP3PosH.value = 0;
          sliderP3Gap.value = 16;
          sliderP3Altura.value = 80;
          selectP3Ajuste.value = 'contain';
          selectP3Cols.value = '2';
          chkP3Nombre.checked = true;
          chkRedFb.checked = true;
          chkRedIg.checked = true;
          chkRedTk.checked = true;
          chkRedWeb.checked = true;
          chkTel.checked = true;
          chkDir.checked = true;
          inputCierre.value = '¡Muchas gracias por su preferencia!';
          updatePreview();
          toast.success('Valores oficiales restablecidos');
        },
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

