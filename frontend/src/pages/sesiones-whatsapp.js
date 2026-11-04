import { createButton } from '../components/button.js';
import { openModal, openConfirmModal } from '../components/modal.js';
import { openImageZoomModal } from '../components/media-attachment.js?v=20261030_5';
import { toast } from '../components/toast.js';
import { apiFetch } from '../services/api.js';
import {
  subscribeQueue,
  refreshWhatsAppStatus,
  startWhatsAppSession,
  restartWhatsAppSession,
  stopWhatsAppSession,
  deleteWhatsAppSession,
} from '../services/queue-manager.js?v=20261104_1';

function formatDateTime(isoStr) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return String(isoStr);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatPhoneDisplay(rawPhone) {
  const digits = String(rawPhone || '').replace(/\D/g, '');
  if (!digits) return 'Sin número vinculado';
  return `+${digits}`;
}

function formatTimerClock(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const mins = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}s`;
}

export function renderSesionesWhatsAppModule(container) {
  container.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'w-full space-y-5';

  let actionInProgress = false;
  let autoStartAttempted = false;

  // 1. Cabecera superior y Botonera de Control de Sesión (los 4 botones obligatorios)
  const topCard = document.createElement('div');
  topCard.className =
    'bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4';

  const topInfo = document.createElement('div');
  topInfo.className = 'space-y-1';
  topInfo.innerHTML = `
    <div class="flex items-center gap-2.5 flex-wrap">
      <span class="w-8 h-8 rounded-lg bg-brand-soft dark:bg-brand/15 text-brand inline-flex items-center justify-center shrink-0">
        <i class="fa-brands fa-whatsapp text-base"></i>
      </span>
      <h2 class="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100">
        Gestión de Sesión de WhatsApp Web
      </h2>
      <span data-role="top-status-pill"></span>
    </div>
    <p class="text-xs text-slate-500 dark:text-slate-400">
      Conecta tu cuenta escaneando el código QR. El navegador se ejecuta automáticamente en segundo plano para enviar mensajes, imágenes, videos y PDFs desde el módulo de <strong>Difusión y Mensajes</strong>.
    </p>
  `;

  const topStatusPill = topInfo.querySelector('[data-role="top-status-pill"]');

  const actionsBar = document.createElement('div');
  actionsBar.className = 'flex flex-wrap items-center gap-2.5 shrink-0';

  const btnStart = createButton({
    text: 'Iniciar Sesión',
    icon: 'fa-solid fa-play',
    variant: 'primary',
    size: 'md',
    ariaLabel: 'Iniciar sesión de WhatsApp',
    onClick: async () => {
      if (actionInProgress) return;
      actionInProgress = true;
      btnStart.setLoading(true);
      try {
        await startWhatsAppSession();
        toast.info('Iniciando sesión de WhatsApp en segundo plano...');
      } catch (err) {
        toast.error(err.message || 'No se pudo iniciar la sesión de WhatsApp.');
      } finally {
        actionInProgress = false;
        btnStart.setLoading(false);
      }
    },
  });

  function showFullRestartProgressModal() {
    const overlay = document.createElement('div');
    overlay.id = 'r1-restart-progress-overlay';
    overlay.className =
      'fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fade-in';

    overlay.innerHTML = `
      <div class="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl text-center space-y-6">
        <div class="w-16 h-16 rounded-2xl bg-brand-soft dark:bg-brand/20 text-brand mx-auto flex items-center justify-center border border-brand/30 shadow-xs">
          <i class="fa-solid fa-arrows-rotate fa-spin text-3xl"></i>
        </div>

        <div class="space-y-1">
          <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-brand-soft dark:bg-brand/20 text-brand">
            <i class="fa-solid fa-server text-[10px]"></i> Contenedor r1personalizados-backend
          </div>
          <h3 class="text-base sm:text-lg font-bold text-slate-900 dark:text-white pt-1">
            Reiniciando Contenedor y Servicio de WhatsApp
          </h3>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            Por favor no cierres ni recargues la página. Se detectará automáticamente la reconexión del servidor.
          </p>
        </div>

        <!-- Barra de Progreso -->
        <div class="space-y-2 text-left pt-2">
          <div class="flex items-center justify-between text-xs">
            <span id="restart-progress-status" class="font-semibold text-slate-700 dark:text-slate-300">
              Limpiando bloqueos Singleton en .wwebjs_auth...
            </span>
            <span id="restart-progress-percent" class="font-bold font-mono text-brand">10%</span>
          </div>
          <div class="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden shadow-inner p-0.5 border border-slate-200/60 dark:border-slate-700/60">
            <div id="restart-progress-bar" class="h-full bg-brand transition-all duration-500 rounded-full" style="width: 10%"></div>
          </div>
        </div>

        <!-- Contadores de tiempo y aviso -->
        <div class="grid grid-cols-2 gap-3 pt-1 text-center font-mono text-xs">
          <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <span class="block text-[10px] uppercase font-sans text-slate-400 font-bold">Tiempo Transcurrido</span>
            <span id="restart-elapsed-clock" class="text-slate-800 dark:text-slate-200 font-bold text-sm">00:00</span>
          </div>
          <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <span class="block text-[10px] uppercase font-sans text-slate-400 font-bold">Tiempo Estimado</span>
            <span class="text-brand font-bold text-sm">~60s</span>
          </div>
        </div>

        <div class="text-[11px] text-slate-400 dark:text-slate-500 flex items-center justify-center gap-1.5">
          <i class="fa-solid fa-spinner fa-spin text-brand"></i>
          <span>Monitoreando respuesta del servidor en segundo plano...</span>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const progressBar = overlay.querySelector('#restart-progress-bar');
    const progressPercent = overlay.querySelector('#restart-progress-percent');
    const progressStatus = overlay.querySelector('#restart-progress-status');
    const elapsedClock = overlay.querySelector('#restart-elapsed-clock');

    let seconds = 0;
    let isBackOnline = false;

    const timerInterval = setInterval(() => {
      seconds++;
      const pad = (n) => String(n).padStart(2, '0');
      if (elapsedClock) {
        elapsedClock.textContent = `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`;
      }

      if (!isBackOnline && progressBar && progressPercent && progressStatus) {
        // Cálculo gradual del porcentaje estimado (alcanza el 92% a los ~55 segundos)
        const pct = Math.min(92, Math.max(10, Math.round(10 + (seconds / 55) * 82)));
        progressBar.style.width = `${pct}%`;
        progressPercent.textContent = `${pct}%`;

        if (seconds < 12) {
          progressStatus.textContent = '1/4: Bloqueos Singleton eliminados. Reiniciando contenedor...';
        } else if (seconds < 28) {
          progressStatus.textContent = '2/4: Contenedor r1personalizados-backend reiniciándose en el servidor...';
        } else if (seconds < 45) {
          progressStatus.textContent = '3/4: Esperando disponibilidad del backend y base de datos...';
        } else {
          progressStatus.textContent = '4/4: Inicializando navegador headless de WhatsApp Web...';
        }
      }
    }, 1000);

    // Sondeo al backend cada 3 segundos a partir de los 8 segundos
    const checkInterval = setInterval(async () => {
      if (seconds < 8 || isBackOnline) return;

      try {
        const resp = await fetch('./api/whatsapp/status', {
          method: 'GET',
          cache: 'no-store',
          credentials: 'include',
        });

        if (resp.ok || resp.status === 200 || resp.status === 401 || resp.status === 403) {
          isBackOnline = true;
          clearInterval(timerInterval);
          clearInterval(checkInterval);

          if (progressBar) progressBar.style.width = '100%';
          if (progressPercent) progressPercent.textContent = '100%';
          if (progressStatus) progressStatus.textContent = '¡Sistema y contenedor restablecidos con éxito!';

          toast.success('El contenedor y el servicio de WhatsApp se reiniciaron correctamente.');

          setTimeout(() => {
            overlay.remove();
            refreshWhatsAppStatus().catch(() => {});
          }, 1200);
        }
      } catch (_) {
        // Continúa esperando a que el contenedor termine de levantar
      }
    }, 3000);
  }

  function openAdminRestartModal() {
    const modalContent = document.createElement('div');
    modalContent.className = 'space-y-4';

    modalContent.innerHTML = `
      <div class="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70 text-amber-900 dark:text-amber-200 text-xs sm:text-sm space-y-2">
        <div class="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
          <i class="fa-solid fa-triangle-exclamation text-amber-600 dark:text-amber-400 text-base"></i>
          <span>Atención: Interrupción Temporal del Sistema</span>
        </div>
        <p class="text-xs text-amber-900/90 dark:text-amber-200/90 leading-relaxed">
          Esta acción ejecutará en el servidor la limpieza forzada de bloqueos residuales de WhatsApp (<code>Singleton*</code>) y reiniciará el contenedor <strong>r1personalizados-backend</strong>.
        </p>
        <div class="p-2.5 rounded-lg bg-amber-100/70 dark:bg-amber-900/40 border border-amber-300/60 dark:border-amber-700/60 flex items-center gap-2 text-xs font-semibold text-rose-700 dark:text-rose-300">
          <i class="fa-solid fa-circle-exclamation shrink-0"></i>
          <span>Todo el sistema dejará de responder por 1 a 2 minutos mientras se reinicia.</span>
        </div>
      </div>

      <div class="space-y-2 pt-1">
        <label for="restart-admin-password" class="block text-xs font-bold text-slate-700 dark:text-slate-200">
          Contraseña de Administrador <span class="text-rose-500">*</span>
        </label>
        <div class="relative">
          <input
            type="password"
            id="restart-admin-password"
            placeholder="Ingresa tu contraseña de admin para autorizar..."
            class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand pr-10"
            autocomplete="current-password"
          />
          <button
            type="button"
            id="toggle-restart-admin-password"
            aria-label="Mostrar u ocultar contraseña"
            class="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <i class="fa-regular fa-eye"></i>
          </button>
        </div>
        <p class="text-[11px] text-slate-400 dark:text-slate-500">
          Se requiere autenticación de administrador para ejecutar el reinicio del contenedor.
        </p>
      </div>
    `;

    const pwdInput = modalContent.querySelector('#restart-admin-password');
    const toggleBtn = modalContent.querySelector('#toggle-restart-admin-password');
    toggleBtn.addEventListener('click', () => {
      const isPwd = pwdInput.type === 'password';
      pwdInput.type = isPwd ? 'text' : 'password';
      toggleBtn.innerHTML = isPwd
        ? '<i class="fa-regular fa-eye-slash"></i>'
        : '<i class="fa-regular fa-eye"></i>';
    });

    openModal({
      title: 'Reinicio de Contenedor y Servicio de WhatsApp',
      content: modalContent,
      size: 'md',
      confirmText: 'Autorizar y Reiniciar',
      cancelText: 'Cancelar',
      confirmVariant: 'danger',
      onConfirm: async ({ close, setLoading }) => {
        const password = pwdInput.value.trim();
        if (!password) {
          toast.warning('Debes ingresar la contraseña de administrador.');
          pwdInput.focus();
          return;
        }

        setLoading(true);
        try {
          const res = await apiFetch('/api/whatsapp/restart-full', {
            method: 'POST',
            body: JSON.stringify({ password }),
          });

          toast.info(res.message || 'Bloqueos eliminados. Reiniciando contenedor...');
          close();

          // Lanzar la barra de progreso de reinicio con monitoreo en vivo
          showFullRestartProgressModal();
        } catch (err) {
          toast.error(err.message || 'Contraseña de administrador incorrecta o error al reiniciar.');
          setLoading(false);
        }
      },
    });

    setTimeout(() => {
      if (pwdInput) pwdInput.focus();
    }, 150);
  }

  const btnRestart = createButton({
    text: 'Reiniciar Sesión',
    icon: 'fa-solid fa-arrows-rotate',
    variant: 'primary',
    size: 'md',
    ariaLabel: 'Reiniciar sesión de WhatsApp y contenedor',
    onClick: () => {
      openAdminRestartModal();
    },
  });

  const btnStop = createButton({
    text: 'Detener Sesión',
    icon: 'fa-solid fa-stop',
    variant: 'cancel',
    size: 'md',
    ariaLabel: 'Detener sesión de WhatsApp',
    onClick: async () => {
      if (actionInProgress) return;
      actionInProgress = true;
      btnStop.setLoading(true);
      try {
        await stopWhatsAppSession();
        toast.warning('Sesión de WhatsApp detenida. El estado se mantendrá en Detenido hasta que inicies sesión.');
      } catch (err) {
        toast.error(err.message || 'No se pudo detener la sesión de WhatsApp.');
      } finally {
        actionInProgress = false;
        btnStop.setLoading(false);
      }
    },
  });

  const btnDelete = createButton({
    text: 'Eliminar Sesión',
    icon: 'fa-regular fa-trash-can',
    variant: 'danger',
    size: 'md',
    ariaLabel: 'Eliminar sesión de WhatsApp vinculada',
    onClick: () => {
      openConfirmModal({
        title: 'Eliminar Sesión de WhatsApp',
        message:
          '¿Estás seguro de que deseas desvincular y eliminar la sesión actual de WhatsApp? Se cerrará la cuenta vinculada y se generará un nuevo código QR para escanear.',
        confirmText: 'Sí, eliminar sesión',
        onConfirm: async () => {
          actionInProgress = true;
          try {
            await deleteWhatsAppSession();
            toast.success('Sesión eliminada. Generando nuevo código QR...');
          } catch (err) {
            toast.error(err.message || 'No se pudo eliminar la sesión de WhatsApp.');
          } finally {
            actionInProgress = false;
          }
        },
      });
    },
  });

  actionsBar.append(btnStart, btnRestart, btnStop, btnDelete);
  topCard.append(topInfo, actionsBar);
  wrapper.appendChild(topCard);

  // 2. Grilla principal: Detalle de la Cuenta Vinculada + Panel de QR / Estado del Navegador
  const contentGrid = document.createElement('div');
  contentGrid.className = 'grid grid-cols-1 lg:grid-cols-12 gap-5';

  // Columna Izquierda (7 cols): Detalle de la Cuenta de WhatsApp Vinculada
  const accountCard = document.createElement('div');
  accountCard.className =
    'lg:col-span-7 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs flex flex-col justify-between';

  // Columna Derecha (5 cols): Código QR automático / Estado de Conexión / Temporizador de Reinicio
  const qrCard = document.createElement('div');
  qrCard.className =
    'lg:col-span-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs flex flex-col items-center justify-center';

  contentGrid.append(accountCard, qrCard);
  wrapper.appendChild(contentGrid);
  container.appendChild(wrapper);

  function renderState(snap) {
    const wa = snap.whatsapp || {
      status: 'DISCONNECTED',
      connected: false,
      restartElapsedSeconds: 0,
      qrDataUrl: '',
      account: null,
      lastError: '',
    };

    const isConnected = Boolean(wa.connected || wa.status === 'CONNECTED');
    const isStopped = wa.status === 'STOPPED';
    const isRestarting = wa.status === 'RESTARTING';
    const isInitializing = wa.status === 'INITIALIZING' || wa.status === 'AUTHENTICATED';
    const isQrReady = wa.status === 'QR_READY' && Boolean(wa.qrDataUrl);
    const acc = wa.account;
    const restartSecs = Math.max(1, Number(wa.restartElapsedSeconds) || 1);

    // Solo autoiniciar si está DISCONNECTED (nunca si el usuario presionó Detener Sesión -> STOPPED)
    if (!autoStartAttempted && wa.status === 'DISCONNECTED' && !isStopped && !isConnected && !wa.lastError) {
      autoStartAttempted = true;
      startWhatsAppSession().catch(() => {});
    }

    // Actualizar píldora de estado en la cabecera del módulo
    if (isConnected) {
      topStatusPill.innerHTML = `
        <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
          <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          Online
        </span>
      `;
    } else if (isRestarting) {
      topStatusPill.innerHTML = `
        <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-brand-soft dark:bg-brand/20 text-brand border border-brand/30">
          <i class="fa-solid fa-arrows-rotate fa-spin text-[10px]"></i>
          Reiniciando · ${formatTimerClock(restartSecs)}
        </span>
      `;
    } else if (isStopped) {
      topStatusPill.innerHTML = `
        <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60">
          <span class="w-2 h-2 rounded-full bg-rose-500"></span>
          Detenido
        </span>
      `;
    } else if (isQrReady) {
      topStatusPill.innerHTML = `
        <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-brand-soft dark:bg-brand/20 text-brand border border-brand/30">
          <i class="fa-solid fa-qrcode text-[10px]"></i>
          Esperando escaneo de QR
        </span>
      `;
    } else if (isInitializing) {
      topStatusPill.innerHTML = `
        <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800/60">
          <i class="fa-solid fa-circle-notch fa-spin text-[10px]"></i>
          Iniciando navegador...
        </span>
      `;
    } else {
      topStatusPill.innerHTML = `
        <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
          <span class="w-2 h-2 rounded-full bg-amber-500"></span>
          Desconectado
        </span>
      `;
    }

    // Renderizar Tarjeta de Detalle de la Cuenta Vinculada
    accountCard.innerHTML = '';

    const accHeader = document.createElement('div');
    accHeader.className =
      'flex items-center justify-between gap-2 pb-4 border-b border-slate-100 dark:border-slate-800';
    accHeader.innerHTML = `
      <div>
        <h3 class="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <i class="fa-solid fa-id-card text-brand"></i>
          Detalle de la Cuenta de WhatsApp Vinculada
        </h3>
        <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
          Información de perfil, tipo de cuenta, estadísticas de chats y última conexión sincronizada.
        </p>
      </div>
      ${
        acc && acc.wwebVersion
          ? `<span class="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">v${acc.wwebVersion}</span>`
          : ''
      }
    `;
    accountCard.appendChild(accHeader);

    const accBody = document.createElement('div');
    accBody.className = 'py-5 flex-1 flex flex-col justify-center space-y-5';

    if (acc && acc.phone) {
      const profileRow = document.createElement('div');
      profileRow.className = 'flex flex-col sm:flex-row items-center sm:items-start gap-6';

      // Foto de perfil con miniatura, zoom al hacer clic, formato y nombre debajo (Regla AGENTS.md)
      const photoCol = document.createElement('div');
      photoCol.className = 'flex flex-col items-center text-center shrink-0';

      if (acc.profilePicUrl) {
        const picBtn = document.createElement('button');
        picBtn.type = 'button';
        picBtn.title = 'Hacer clic para ampliar foto de perfil';
        picBtn.className =
          'relative group w-24 h-24 rounded-2xl overflow-hidden border-2 border-brand/40 shadow-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand';
        picBtn.innerHTML = `
          <img src="${acc.profilePicUrl}" alt="Foto de perfil WhatsApp" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
          <span class="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs">
            <i class="fa-solid fa-magnifying-glass-plus text-base"></i>
          </span>
        `;
        const picName = `perfil-${acc.phone}.jpg`;
        picBtn.addEventListener('click', () => {
          openImageZoomModal({
            src: acc.profilePicUrl,
            nombre: picName,
            formato: 'JPG',
          });
        });

        const picCaption = document.createElement('div');
        picCaption.className = 'mt-1.5 text-[10px] text-slate-500 dark:text-slate-400 leading-tight';
        picCaption.innerHTML = `
          <p class="font-bold uppercase text-brand">Formato: JPG</p>
          <p class="truncate max-w-[120px]" title="${picName}">${picName}</p>
        `;
        photoCol.append(picBtn, picCaption);
      } else {
        const avatarFallback = document.createElement('div');
        avatarFallback.className =
          'w-24 h-24 rounded-2xl bg-brand-soft dark:bg-brand/20 border-2 border-brand/30 text-brand flex flex-col items-center justify-center shadow-xs';
        avatarFallback.innerHTML = `
          <i class="fa-brands fa-whatsapp text-4xl"></i>
        `;
        const avatarCaption = document.createElement('p');
        avatarCaption.className = 'mt-1.5 text-[10px] font-medium text-slate-400';
        avatarCaption.textContent = 'Sin foto pública';
        photoCol.append(avatarFallback, avatarCaption);
      }

      // Estado visual para la tarjeta de detalle
      let statusLabelHtml = '';
      if (isConnected) {
        statusLabelHtml = `
          <span class="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
            <i class="fa-solid fa-circle-check"></i> Online (Conectada y Lista)
          </span>
        `;
      } else if (isRestarting) {
        statusLabelHtml = `
          <span class="text-brand flex items-center gap-1.5">
            <i class="fa-solid fa-arrows-rotate fa-spin"></i> Reiniciando (${formatTimerClock(restartSecs)})
          </span>
        `;
      } else if (isStopped) {
        statusLabelHtml = `
          <span class="text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
            <i class="fa-solid fa-circle-stop"></i> Detenido
          </span>
        `;
      } else {
        statusLabelHtml = `
          <span class="text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
            <i class="fa-solid fa-circle-pause"></i> Desconectado
          </span>
        `;
      }

      // Datos detallados de la cuenta vinculada
      const detailsGrid = document.createElement('div');
      detailsGrid.className = 'flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-3';

      detailsGrid.innerHTML = `
        <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800">
          <p class="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Estado de la Cuenta
          </p>
          <p class="text-xs font-bold mt-1">
            ${statusLabelHtml}
          </p>
        </div>

        <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800">
          <p class="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Número de WhatsApp
          </p>
          <p class="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-1">
            <i class="fa-brands fa-whatsapp mr-1"></i>${formatPhoneDisplay(acc.phone)}
          </p>
        </div>

        <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800">
          <p class="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Nombre del Perfil
          </p>
          <p class="text-xs font-bold text-slate-800 dark:text-slate-100 mt-1 truncate">
            ${acc.name || 'Cuenta Vinculada'}
          </p>
        </div>

        <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800">
          <p class="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Última Conexión / Actividad
          </p>
          <p class="text-xs font-semibold text-slate-700 dark:text-slate-200 mt-1">
            <i class="fa-regular fa-clock text-brand mr-1"></i>${formatDateTime(acc.lastActivityAt || acc.connectedAt)}
          </p>
        </div>

        <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800">
          <p class="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Tipo de Cuenta / Plataforma
          </p>
          <p class="text-xs font-semibold text-slate-700 dark:text-slate-200 mt-1 flex items-center gap-1.5">
            <i class="fa-solid ${acc.isBusiness ? 'fa-briefcase text-brand' : 'fa-mobile-screen text-brand'}"></i>
            <span>${acc.platformLabel || (acc.isBusiness ? 'WhatsApp Business' : 'WhatsApp Personal')}</span>
          </p>
        </div>

        <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800">
          <p class="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Info / Estado del Perfil
          </p>
          <p class="text-xs font-medium text-slate-700 dark:text-slate-200 mt-1 truncate" title="${acc.about || acc.businessDescription || 'Disponible'}">
            <i class="fa-regular fa-comment-dots text-brand mr-1"></i>${acc.about || acc.businessDescription || 'Disponible'}
          </p>
        </div>
      `;

      profileRow.append(photoCol, detailsGrid);
      accBody.appendChild(profileRow);

      // Fila de métricas sincronizadas de la cuenta (Chats, No leídos, Contactos, Grupos)
      const metricsRow = document.createElement('div');
      metricsRow.className = 'grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1';
      metricsRow.innerHTML = `
        <div class="p-2.5 rounded-xl bg-brand-soft/40 dark:bg-brand/10 border border-brand/20 text-center">
          <p class="text-sm font-extrabold text-brand">${Number(acc.chatsCount || 0)}</p>
          <p class="text-[10px] font-semibold text-slate-600 dark:text-slate-300">Chats Activos</p>
        </div>
        <div class="p-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-800/50 text-center">
          <p class="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">${Number(acc.unreadMessagesCount || 0)}</p>
          <p class="text-[10px] font-semibold text-slate-600 dark:text-slate-300">Mensajes Sin Leer (${Number(acc.unreadChatsCount || 0)} chats)</p>
        </div>
        <div class="p-2.5 rounded-xl bg-sky-50/70 dark:bg-sky-950/40 border border-sky-200/70 dark:border-sky-800/50 text-center">
          <p class="text-sm font-extrabold text-sky-600 dark:text-sky-400">${Number(acc.contactsCount || 0)}</p>
          <p class="text-[10px] font-semibold text-slate-600 dark:text-slate-300">Contactos Sincronizados</p>
        </div>
        <div class="p-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200/70 dark:border-amber-800/50 text-center">
          <p class="text-sm font-extrabold text-amber-600 dark:text-amber-400">${Number(acc.groupsCount || 0)}</p>
          <p class="text-[10px] font-semibold text-slate-600 dark:text-slate-300">Grupos de WhatsApp</p>
        </div>
      `;
      accBody.appendChild(metricsRow);

      // Si tiene datos de WhatsApp Business (categoría, dirección, email o web), mostrarlos
      if (acc.businessCategory || acc.businessAddress || acc.businessEmail || acc.businessWebsite) {
        const bizBox = document.createElement('div');
        bizBox.className =
          'p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 text-xs space-y-1';
        bizBox.innerHTML = `
          <p class="text-[10px] font-bold uppercase tracking-wider text-brand flex items-center gap-1.5">
            <i class="fa-solid fa-store"></i> Datos Comerciales de WhatsApp Business
          </p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 text-[11px] text-slate-600 dark:text-slate-300">
            ${acc.businessCategory ? `<p><strong class="text-slate-700 dark:text-slate-200">Categoría:</strong> ${acc.businessCategory}</p>` : ''}
            ${acc.businessAddress ? `<p><strong class="text-slate-700 dark:text-slate-200">Dirección:</strong> ${acc.businessAddress}</p>` : ''}
            ${acc.businessEmail ? `<p><strong class="text-slate-700 dark:text-slate-200">Email:</strong> ${acc.businessEmail}</p>` : ''}
            ${acc.businessWebsite ? `<p><strong class="text-slate-700 dark:text-slate-200">Web:</strong> ${acc.businessWebsite}</p>` : ''}
          </div>
        `;
        accBody.appendChild(bizBox);
      }
    } else {
      accBody.innerHTML = `
        <div class="text-center py-8 px-4 space-y-3">
          <div class="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
            <i class="fa-solid fa-mobile-screen-button text-2xl"></i>
          </div>
          <div class="space-y-1">
            <p class="text-sm font-bold text-slate-700 dark:text-slate-200">
              Ninguna cuenta de WhatsApp vinculada actualmente
            </p>
            <p class="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Escanea el código QR del panel derecho con tu teléfono para vincular tu cuenta. Al conectarse, verás aquí tu foto de perfil, número de teléfono, estadísticas de chats y fecha/hora de última conexión.
            </p>
          </div>
        </div>
      `;
    }

    accountCard.appendChild(accBody);

    // Pie de la tarjeta de cuenta con acceso directo a Difusión y Mensajes
    const accFooter = document.createElement('div');
    accFooter.className =
      'pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3';
    accFooter.innerHTML = `
      <div class="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
        <i class="fa-solid fa-paper-plane text-brand"></i>
        <span>Los envíos de mensajes, imágenes, videos y PDFs se realizan desde <strong>Difusión y Mensajes</strong>.</span>
      </div>
    `;

    const goToBroadcastBtn = createButton({
      text: 'Ir a Difusión y Mensajes',
      icon: 'fa-solid fa-bullhorn',
      variant: 'primary',
      size: 'sm',
      onClick: () => {
        window.location.hash = '#/broadcast';
      },
    });
    accFooter.appendChild(goToBroadcastBtn);
    accountCard.appendChild(accFooter);

    // Renderizar Tarjeta Derecha: Código QR / Estado Activo / Reiniciando con Timer / Detenido
    qrCard.innerHTML = '';

    if (isConnected) {
      qrCard.innerHTML = `
        <div class="text-center space-y-4 py-6 px-3">
          <div class="w-20 h-20 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border-2 border-emerald-300 dark:border-emerald-700 text-emerald-500 mx-auto flex items-center justify-center shadow-xs">
            <i class="fa-solid fa-check text-3xl"></i>
          </div>
          <div class="space-y-1.5">
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
              <span class="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
              WhatsApp Web Conectado
            </span>
            <h4 class="text-sm font-bold text-slate-800 dark:text-slate-100 pt-1">
              Navegador en segundo plano activo
            </h4>
            <p class="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
              Tu sesión está lista para automatizar envíos individuales, campañas de difusión con temporizador y mensajes programados.
            </p>
          </div>
        </div>
      `;
    } else if (isRestarting) {
      const estPercent = Math.min(95, Math.max(12, Math.round((restartSecs / 12) * 100)));
      qrCard.innerHTML = `
        <div class="w-full text-center space-y-4 py-8 px-4">
          <div class="w-16 h-16 rounded-2xl bg-brand-soft dark:bg-brand/20 text-brand mx-auto flex items-center justify-center border border-brand/30 shadow-xs">
            <i class="fa-solid fa-arrows-rotate fa-spin text-2xl"></i>
          </div>
          <div class="space-y-1.5">
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-brand-soft dark:bg-brand/20 text-brand">
              <i class="fa-regular fa-clock"></i>
              Tiempo transcurrido: ${formatTimerClock(restartSecs)}
            </span>
            <h4 class="text-sm font-bold text-slate-800 dark:text-slate-100 pt-1">
              Reiniciando Sesión de WhatsApp...
            </h4>
            <p class="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
              Cerrando instancia previa del navegador y reconectando credenciales guardadas en segundo plano.
            </p>
          </div>
          <div class="w-full max-w-xs mx-auto space-y-1.5 pt-2">
            <div class="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div class="h-full bg-brand transition-all duration-500 rounded-full" style="width: ${estPercent}%"></div>
            </div>
            <p class="text-[11px] font-semibold text-brand">
              Reconectando navegador headless (${estPercent}%)...
            </p>
          </div>
        </div>
      `;
    } else if (isStopped) {
      const stoppedWrap = document.createElement('div');
      stoppedWrap.className = 'text-center space-y-4 py-8 px-4';
      stoppedWrap.innerHTML = `
        <div class="w-16 h-16 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-500 mx-auto flex items-center justify-center border border-rose-200 dark:border-rose-800/60">
          <i class="fa-solid fa-stop text-2xl"></i>
        </div>
        <div class="space-y-1.5">
          <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60">
            <span class="w-2 h-2 rounded-full bg-rose-500"></span>
            Estado: Detenido
          </span>
          <h4 class="text-sm font-bold text-slate-800 dark:text-slate-100 pt-1">
            Sesión de WhatsApp Detenida Manualmente
          </h4>
          <p class="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
            El navegador en segundo plano fue detenido y se mantendrá en este estado hasta que presiones <strong>Iniciar Sesión</strong> o <strong>Reiniciar Sesión</strong>.
          </p>
        </div>
      `;
      const resumeBtn = createButton({
        text: 'Iniciar Sesión Ahora',
        icon: 'fa-solid fa-play',
        variant: 'primary',
        size: 'md',
        onClick: async () => {
          resumeBtn.setLoading(true);
          try {
            await startWhatsAppSession();
            toast.info('Reanudando sesión de WhatsApp...');
          } catch (err) {
            toast.error(err.message || 'Error al iniciar sesión.');
          } finally {
            resumeBtn.setLoading(false);
          }
        },
      });
      stoppedWrap.appendChild(resumeBtn);
      qrCard.appendChild(stoppedWrap);
    } else if (isQrReady && wa.qrDataUrl) {
      const qrWrap = document.createElement('div');
      qrWrap.className = 'w-full flex flex-col items-center text-center space-y-3';

      const qrTitle = document.createElement('div');
      qrTitle.innerHTML = `
        <h3 class="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center justify-center gap-2">
          <i class="fa-solid fa-qrcode text-brand"></i>
          Escanea el Código QR para Vincular
        </h3>
        <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
          El código QR se actualiza automáticamente en tiempo real.
        </p>
      `;

      const qrImgBtn = document.createElement('button');
      qrImgBtn.type = 'button';
      qrImgBtn.title = 'Hacer clic para ampliar el código QR';
      qrImgBtn.className =
        'p-3 bg-white rounded-2xl border-2 border-brand/40 shadow-md hover:border-brand transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand';
      qrImgBtn.innerHTML = `
        <img src="${wa.qrDataUrl}" alt="Código QR de WhatsApp" class="w-56 h-56 sm:w-64 sm:h-64 object-contain" />
      `;
      qrImgBtn.addEventListener('click', () => {
        openImageZoomModal({
          src: wa.qrDataUrl,
          nombre: 'qr-whatsapp-sesion.png',
          formato: 'PNG',
        });
      });

      const qrMeta = document.createElement('div');
      qrMeta.className = 'text-[10px] text-slate-400 dark:text-slate-500 leading-tight';
      qrMeta.innerHTML = `
        <span class="font-bold text-brand uppercase">Formato: PNG</span> · <span>qr-whatsapp-sesion.png</span>
      `;

      const stepsBox = document.createElement('div');
      stepsBox.className =
        'w-full text-left p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-300 space-y-1.5';
      stepsBox.innerHTML = `
        <p class="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
          <i class="fa-solid fa-list-check text-brand"></i> Cómo vincular tu teléfono:
        </p>
        <ol class="list-decimal list-inside space-y-1 text-slate-500 dark:text-slate-400">
          <li>Abre <strong>WhatsApp</strong> en tu teléfono.</li>
          <li>Toca <strong>Menú</strong> o <strong>Configuración</strong> y selecciona <strong>Dispositivos vinculados</strong>.</li>
          <li>Toca <strong>Vincular un dispositivo</strong> y apunta la cámara a este código QR.</li>
        </ol>
      `;

      qrWrap.append(qrTitle, qrImgBtn, qrMeta, stepsBox);
      qrCard.appendChild(qrWrap);
    } else if (isInitializing) {
      qrCard.innerHTML = `
        <div class="text-center space-y-3 py-10 px-4">
          <div class="w-14 h-14 rounded-2xl bg-brand-soft dark:bg-brand/20 text-brand mx-auto flex items-center justify-center">
            <i class="fa-solid fa-circle-notch fa-spin text-2xl"></i>
          </div>
          <div class="space-y-1">
            <p class="text-sm font-bold text-slate-800 dark:text-slate-100">
              ${wa.status === 'AUTHENTICATED' ? 'Autenticando cuenta de WhatsApp...' : 'Iniciando navegador y sesión de WhatsApp...'}
            </p>
            <p class="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
              El navegador en segundo plano está conectando con WhatsApp Web.
            </p>
          </div>
        </div>
      `;
    } else {
      const discWrap = document.createElement('div');
      discWrap.className = 'text-center space-y-4 py-8 px-4';
      discWrap.innerHTML = `
        <div class="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-500 mx-auto flex items-center justify-center border border-amber-200 dark:border-amber-800/60">
          <i class="fa-solid fa-qrcode text-2xl"></i>
        </div>
        <div class="space-y-1">
          <p class="text-sm font-bold text-slate-800 dark:text-slate-100">
            Cuenta Desconectada
          </p>
          <p class="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
            Haz clic en <strong>Iniciar Sesión</strong> para levantar el navegador en segundo plano y generar el código QR.
          </p>
          ${
            wa.lastError
              ? `<p class="text-[11px] text-danger font-medium pt-2"><i class="fa-solid fa-circle-exclamation mr-1"></i>${wa.lastError}</p>`
              : ''
          }
        </div>
      `;
      const quickStartBtn = createButton({
        text: 'Generar Código QR Ahora',
        icon: 'fa-solid fa-qrcode',
        variant: 'primary',
        size: 'md',
        onClick: async () => {
          quickStartBtn.setLoading(true);
          try {
            await startWhatsAppSession();
          } catch (err) {
            toast.error(err.message || 'Error al solicitar código QR.');
          } finally {
            quickStartBtn.setLoading(false);
          }
        },
      });
      discWrap.appendChild(quickStartBtn);
      qrCard.appendChild(discWrap);
    }
  }

  refreshWhatsAppStatus();
  subscribeQueue(renderState);
}
