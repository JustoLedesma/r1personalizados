import { apiFetch } from './api.js';
import { toast } from '../components/toast.js';

const listeners = new Set();

const queueState = {
  // Estado en tiempo real de la sesión de WhatsApp Web en segundo plano
  whatsapp: {
    status: 'DISCONNECTED', // DISCONNECTED | STOPPED | RESTARTING | INITIALIZING | QR_READY | AUTHENTICATED | CONNECTED
    connected: false,
    restartStartedAt: null,
    restartElapsedSeconds: 0,
    qrDataUrl: '',
    qrUpdatedAt: null,
    account: null,
    lastError: '',
  },
  // Estado de campaña de Difusión en segundo plano
  broadcast: {
    active: false,
    completed: false,
    total: 0,
    sent: 0,
    intervalSeconds: 30,
    secondsToNext: 0,
    currentRecipient: '',
    items: [],
  },
  // Lista de mensajes programados pendientes de envío
  scheduled: [],
  preferredTab: null, // 'mensajes' | 'difusion' | 'programar' | 'historial'
};

let tickerId = null;
let tickCounter = 0;
let initializedFromDB = false;
let isPollingWA = false;

function notify() {
  const snapshot = getQueueSnapshot();
  listeners.forEach((fn) => {
    try {
      fn(snapshot);
    } catch (_) {
      // Ignorar errores de listener desmontado
    }
  });
}

export function formatRemainingDuration(totalSeconds) {
  const secs = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hours = Math.floor(secs / 3600);
  const minutes = Math.floor((secs % 3600) / 60);
  const remSecs = secs % 60;
  const pad = (n) => String(n).padStart(2, '0');

  if (hours > 0) {
    return `${hours}h ${pad(minutes)}m ${pad(remSecs)}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${pad(remSecs)}s`;
  }
  return `${remSecs}s`;
}

export function getQueueSnapshot() {
  const b = queueState.broadcast;
  const pct = b.total > 0 ? Math.min(100, Math.round((b.sent / b.total) * 100)) : 0;
  b.progressPercent = pct;

  return {
    whatsapp: {
      ...queueState.whatsapp,
      account: queueState.whatsapp.account ? { ...queueState.whatsapp.account } : null,
    },
    broadcast: {
      ...b,
      progressPercent: pct,
    },
    scheduled: queueState.scheduled.map((s) => ({ ...s })),
  };
}

export function subscribeQueue(listenerFn) {
  listeners.add(listenerFn);
  listenerFn(getQueueSnapshot());
  ensureTickerRunning();
  refreshWhatsAppStatus();
  return () => {
    listeners.delete(listenerFn);
  };
}

function applyWhatsAppState(res) {
  if (!res || typeof res !== 'object') return false;
  const nextStatus = res.status || 'DISCONNECTED';
  const nextConnected = Boolean(res.connected || nextStatus === 'CONNECTED');
  const nextQr = res.qrDataUrl || '';
  const nextErr = res.lastError || '';
  const nextAcc = res.account || null;
  const nextRestartAt = res.restartStartedAt || null;

  let elapsedSecs = queueState.whatsapp.restartElapsedSeconds || 0;
  if (nextStatus === 'RESTARTING') {
    if (nextRestartAt) {
      const startMs = new Date(nextRestartAt).getTime();
      if (!Number.isNaN(startMs)) {
        elapsedSecs = Math.max(elapsedSecs, Math.max(1, Math.floor((Date.now() - startMs) / 1000)));
      }
    }
  } else {
    elapsedSecs = 0;
  }

  const prev = queueState.whatsapp;
  const prevAccJson = JSON.stringify(prev.account);
  const nextAccJson = JSON.stringify(nextAcc);

  const hasChanged =
    prev.status !== nextStatus ||
    prev.connected !== nextConnected ||
    prev.qrDataUrl !== nextQr ||
    prev.lastError !== nextErr ||
    prev.restartElapsedSeconds !== elapsedSecs ||
    prevAccJson !== nextAccJson;

  queueState.whatsapp = {
    status: nextStatus,
    connected: nextConnected,
    restartStartedAt: nextRestartAt,
    restartElapsedSeconds: elapsedSecs,
    qrDataUrl: nextQr,
    qrUpdatedAt: res.qrUpdatedAt || null,
    account: nextAcc,
    lastError: nextErr,
  };

  if (hasChanged) {
    notify();
  }
  return hasChanged;
}

export async function refreshWhatsAppStatus() {
  if (isPollingWA) return queueState.whatsapp;
  isPollingWA = true;
  try {
    const res = await apiFetch('/api/whatsapp/status');
    applyWhatsAppState(res);
  } catch (_) {
    // Ignorar error puntual de red
  } finally {
    isPollingWA = false;
  }
  return queueState.whatsapp;
}

export async function startWhatsAppSession() {
  queueState.whatsapp.status = 'INITIALIZING';
  queueState.whatsapp.connected = false;
  queueState.whatsapp.restartElapsedSeconds = 0;
  notify();
  const res = await apiFetch('/api/whatsapp/start', { method: 'POST' });
  applyWhatsAppState(res);
  return res;
}

export async function restartWhatsAppSession() {
  queueState.whatsapp.status = 'RESTARTING';
  queueState.whatsapp.connected = false;
  queueState.whatsapp.restartStartedAt = new Date().toISOString();
  queueState.whatsapp.restartElapsedSeconds = 1;
  ensureTickerRunning();
  notify();
  const res = await apiFetch('/api/whatsapp/restart', { method: 'POST' });
  applyWhatsAppState(res);
  return res;
}

export async function stopWhatsAppSession() {
  queueState.whatsapp.status = 'STOPPED';
  queueState.whatsapp.connected = false;
  queueState.whatsapp.restartElapsedSeconds = 0;
  notify();
  const res = await apiFetch('/api/whatsapp/stop', { method: 'POST' });
  applyWhatsAppState(res);
  return res;
}

export async function deleteWhatsAppSession() {
  queueState.whatsapp.status = 'INITIALIZING';
  queueState.whatsapp.connected = false;
  queueState.whatsapp.account = null;
  queueState.whatsapp.restartElapsedSeconds = 0;
  notify();
  const res = await apiFetch('/api/whatsapp/delete-session', { method: 'POST' });
  applyWhatsAppState(res);
  return res;
}

export function setPreferredBroadcastTab(tabId) {
  queueState.preferredTab = tabId;
}

export function consumePreferredBroadcastTab() {
  const t = queueState.preferredTab;
  queueState.preferredTab = null;
  return t;
}

function parseMySQLDateTimeToMs(str) {
  if (!str) return Date.now() + 60000;
  const normalized = String(str).trim().replace(' ', 'T');
  const d = new Date(normalized);
  if (!Number.isNaN(d.getTime())) return d.getTime();
  return Date.now() + 60000;
}

export async function syncPendingTasksFromDB() {
  if (initializedFromDB) return;
  initializedFromDB = true;
  try {
    // 1. Sincronizar mensajes programados pendientes
    const res = await apiFetch('/api/difusion-mensajes?page=1&page_size=50&estado=Programado');
    if (res && Array.isArray(res.data)) {
      const now = Date.now();
      res.data.forEach((m) => {
        if (!m.id) return;
        if (queueState.scheduled.some((x) => x.id === m.id)) return;
        const targetMs = parseMySQLDateTimeToMs(m.programadoPara);
        const createdMs = m.createdAt ? new Date(m.createdAt).getTime() : now;
        const totalDuration = Math.max(10, Math.round((targetMs - createdMs) / 1000));
        const remSecs = Math.max(1, Math.ceil((targetMs - now) / 1000));
        queueState.scheduled.push({
          id: m.id,
          nombreDestinatario: m.nombreDestinatario || '—',
          telefonoDestinatario: m.telefonoDestinatario || '',
          contenido: m.contenido || '',
          programadoPara: m.programadoPara || '',
          createdTimeMs: createdMs,
          targetTimeMs: targetMs,
          totalSeconds: totalDuration,
          remainingSeconds: remSecs,
          progressPercent: Math.min(
            99,
            Math.max(5, Math.round(((totalDuration - remSecs) / totalDuration) * 100))
          ),
        });
      });
      queueState.scheduled.sort((a, b) => a.targetTimeMs - b.targetTimeMs);
    }

    // 2. Sincronizar campaña de difusión si quedaron mensajes en cola en BD
    if (!queueState.broadcast.active) {
      const resCola = await apiFetch('/api/difusion-mensajes?page=1&page_size=100&estado=En%20Cola&tipo=Difusi%C3%B3n');
      if (resCola && Array.isArray(resCola.data) && resCola.data.length > 0) {
        const queuedItems = resCola.data;
        const safeInterval = queuedItems[0].intervaloSegundos || 30;
        queueState.broadcast = {
          active: true,
          completed: false,
          total: queuedItems.length + 1,
          sent: 1,
          intervalSeconds: safeInterval,
          secondsToNext: safeInterval,
          currentRecipient: queuedItems[0].nombreDestinatario && queuedItems[0].nombreDestinatario !== '—'
            ? `${queuedItems[0].nombreDestinatario} (${queuedItems[0].telefonoDestinatario})`
            : queuedItems[0].telefonoDestinatario,
          items: queuedItems,
        };
        ensureTickerRunning();
      }
    }

    notify();
  } catch (_) {
    // Continuar si el backend o tabla aún no está lista
  }
}

export async function startBroadcastJob({ items = [], intervalSeconds = 30 } = {}) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('No hay destinatarios para iniciar la difusión.');
  }

  const safeInterval = Math.max(1, Number(intervalSeconds) || 30);

  const payloadItems = items.map((item, idx) => ({
    ...item,
    tipo: 'Difusión',
    intervaloSegundos: safeInterval,
    estado: idx === 0 ? 'Enviado' : 'En Cola',
  }));

  const res = await apiFetch('/api/difusion-mensajes', {
    method: 'POST',
    body: JSON.stringify({ items: payloadItems }),
  });

  const savedItems = Array.isArray(res?.items) ? res.items : payloadItems;
  const firstRec = savedItems[0];
  const firstLabel =
    firstRec?.nombreDestinatario && firstRec.nombreDestinatario !== '—'
      ? `${firstRec.nombreDestinatario} (${firstRec.telefonoDestinatario})`
      : firstRec?.telefonoDestinatario || 'Destinatario #1';

  if (savedItems.length === 1) {
    queueState.broadcast = {
      active: false,
      completed: true,
      total: 1,
      sent: 1,
      progressPercent: 100,
      intervalSeconds: safeInterval,
      secondsToNext: 0,
      currentRecipient: firstLabel,
      items: savedItems,
    };
    notify();
    return savedItems;
  }

  const initialPct = Math.round((1 / savedItems.length) * 100);
  queueState.broadcast = {
    active: true,
    completed: false,
    total: savedItems.length,
    sent: 1,
    progressPercent: initialPct,
    intervalSeconds: safeInterval,
    secondsToNext: safeInterval,
    currentRecipient: firstLabel,
    items: savedItems,
  };

  ensureTickerRunning();
  notify();
  return savedItems;
}

export function clearCompletedBroadcastBanner() {
  if (!queueState.broadcast.active) {
    queueState.broadcast.completed = false;
    queueState.broadcast.total = 0;
    queueState.broadcast.sent = 0;
    notify();
  }
}

export async function startScheduledMessageJob(payload, targetTimestampMs) {
  const saved = await apiFetch('/api/difusion-mensajes', {
    method: 'POST',
    body: JSON.stringify({
      ...payload,
      tipo: 'Programado',
      estado: 'Programado',
    }),
  });

  const now = Date.now();
  const targetMs =
    targetTimestampMs && targetTimestampMs > now
      ? targetTimestampMs
      : parseMySQLDateTimeToMs(payload.programadoPara);

  const totalSecs = Math.max(5, Math.ceil((targetMs - now) / 1000));

  queueState.scheduled.push({
    id: saved.id,
    nombreDestinatario: saved.nombreDestinatario || payload.nombreDestinatario || '—',
    telefonoDestinatario: saved.telefonoDestinatario || payload.telefonoDestinatario || '',
    contenido: saved.contenido || payload.contenido || '',
    programadoPara: saved.programadoPara || payload.programadoPara || '',
    createdTimeMs: now,
    targetTimeMs: targetMs,
    totalSeconds: totalSecs,
    remainingSeconds: totalSecs,
    progressPercent: 0,
  });

  queueState.scheduled.sort((a, b) => a.targetTimeMs - b.targetTimeMs);
  ensureTickerRunning();
  notify();
  return saved;
}

async function processTick() {
  let changed = false;
  tickCounter += 1;

  // Si está en modo RESTARTING o INITIALIZING, actualizar el timer cada segundo y consultar estado cada segundo
  if (queueState.whatsapp.status === 'RESTARTING') {
    queueState.whatsapp.restartElapsedSeconds = (queueState.whatsapp.restartElapsedSeconds || 0) + 1;
    changed = true;
    refreshWhatsAppStatus();
  } else if (queueState.whatsapp.status === 'INITIALIZING' || queueState.whatsapp.status === 'AUTHENTICATED') {
    refreshWhatsAppStatus();
  } else if (tickCounter % 3 === 0) {
    refreshWhatsAppStatus();
  }

  // 1. Procesar Difusión Masiva activa en segundo plano
  const b = queueState.broadcast;
  if (b.active && b.sent < b.total) {
    b.secondsToNext = Math.max(0, b.secondsToNext - 1);
    changed = true;

    if (b.secondsToNext <= 0) {
      const nextIndex = b.sent;
      const nextItem = b.items[nextIndex];
      b.sent += 1;

      if (nextItem) {
        b.currentRecipient =
          nextItem.nombreDestinatario && nextItem.nombreDestinatario !== '—'
            ? `${nextItem.nombreDestinatario} (${nextItem.telefonoDestinatario})`
            : nextItem.telefonoDestinatario || `Destinatario #${b.sent}`;

        if (nextItem.id) {
          try {
            await apiFetch(`/api/difusion-mensajes/${nextItem.id}`, {
              method: 'PUT',
              body: JSON.stringify({
                nombreDestinatario: nextItem.nombreDestinatario || '—',
                telefonoDestinatario: nextItem.telefonoDestinatario || '',
                contenido: nextItem.contenido || '',
                adjuntoNombre: nextItem.adjuntoNombre || '',
                adjuntoMime: nextItem.adjuntoMime || '',
                adjuntoData: nextItem.adjuntoData || '',
                estado: 'Enviado',
              }),
            });
          } catch (err) {
            const destLabel =
              nextItem.nombreDestinatario && nextItem.nombreDestinatario !== '—'
                ? `${nextItem.nombreDestinatario} (+${nextItem.telefonoDestinatario})`
                : `+${nextItem.telefonoDestinatario}`;
            toast.warning(`Aviso en difusión (${destLabel}): ${err.message || 'No se pudo entregar por WhatsApp (marcado como Fallido)'}`);
          }
        }
      }

      if (b.sent >= b.total) {
        b.active = false;
        b.completed = true;
        b.secondsToNext = 0;
        toast.success(
          `Campaña de difusión completada: ${b.total} de ${b.total} mensajes enviados.`
        );
      } else {
        b.secondsToNext = b.intervalSeconds;
      }
    }
  }

  // 2. Procesar Mensajes Programados en segundo plano
  if (queueState.scheduled.length > 0) {
    const now = Date.now();
    const remainingList = [];

    for (const item of queueState.scheduled) {
      const remSecs = Math.max(0, Math.ceil((item.targetTimeMs - now) / 1000));
      item.remainingSeconds = remSecs;
      const elapsed = Math.max(0, item.totalSeconds - remSecs);
      item.progressPercent = Math.min(
        100,
        Math.max(2, Math.round((elapsed / Math.max(1, item.totalSeconds)) * 100))
      );
      changed = true;

      if (remSecs <= 0) {
        if (item.id) {
          try {
            await apiFetch(`/api/difusion-mensajes/${item.id}`, {
              method: 'PUT',
              body: JSON.stringify({
                nombreDestinatario: item.nombreDestinatario || '—',
                telefonoDestinatario: item.telefonoDestinatario || '',
                contenido: item.contenido || '',
                estado: 'Enviado',
              }),
            });
          } catch (_) {
            // Continuar
          }
        }
        const label =
          item.nombreDestinatario && item.nombreDestinatario !== '—'
            ? `${item.nombreDestinatario} (${item.telefonoDestinatario})`
            : item.telefonoDestinatario;
        toast.success(`Mensaje programado enviado automáticamente a ${label}.`);
      } else {
        remainingList.push(item);
      }
    }

    queueState.scheduled = remainingList;
  }

  if (changed) {
    notify();
  }
}

function ensureTickerRunning() {
  if (tickerId !== null) return;
  tickerId = window.setInterval(() => {
    processTick();
  }, 1000);
}
