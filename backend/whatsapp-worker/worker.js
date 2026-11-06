const http = require('http');
const fs = require('fs');
const path = require('path');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const QRCode = require('qrcode');

// --- PARCHE OFICIAL WWEBJS MAIN PARA ESPERAR MÓDULOS INTERNOS Y GENERAR QR ---
try {
  const { Events } = require('whatsapp-web.js/src/util/Constants');
  const { ExposeAuthStore } = require('whatsapp-web.js/src/util/Injected/AuthStore/AuthStore');
  const { LoadUtils } = require('whatsapp-web.js/src/util/Injected/Utils');
  const WebCacheFactory = require('whatsapp-web.js/src/webCache/WebCacheFactory');
  const { ClientInfo } = require('whatsapp-web.js/src/structures');
  const InterfaceController = require('whatsapp-web.js/src/util/InterfaceController');
  const { exposeFunctionIfAbsent } = require('whatsapp-web.js/src/util/Puppeteer');

  Client.prototype.inject = async function () {
    if (this._injectAbort) this._injectAbort.abort();
    const abort = new AbortController();
    this._injectAbort = abort;

    try {
      const authTimeout = this.options.authTimeoutMs || 60000;
      await this.pupPage
        .waitForFunction('window.Debug?.VERSION != undefined', {
          timeout: authTimeout
        })
        .catch((err) => {
          if (abort.signal.aborted) throw err;
          throw new Error('Tiempo de espera agotado esperando Debug.VERSION de WhatsApp Web');
        });
      if (abort.signal.aborted) return;

      // 1. Esperar primero a que el DOM inicial de WhatsApp Web (#app) renderice sus módulos base.
      // IMPORTANTE: En WhatsApp Web 2.3000.1053430300+, llamar a window.require('WAWebSocketModel')
      // antes de que #app termine su carga diferida hace que el cargador de módulos de Meta
      // guarde en caché `exports = null` permanentemente durante toda la vida de la página.
      await this.pupPage
        .waitForFunction(
          () => {
            const app = document.querySelector('#app');
            if (!app || app.children.length === 0) return false;
            return Boolean(
              app.querySelector('canvas') ||
                app.querySelector('[data-ref]') ||
                app.querySelector('#side') ||
                app.querySelector('[data-testid]') ||
                (app.innerText && app.innerText.trim().length > 20)
            );
          },
          { timeout: authTimeout }
        )
        .catch((err) => {
          if (abort.signal.aborted) throw err;
          throw new Error('Tiempo de espera agotado esperando renderizado inicial de WhatsApp Web');
        });
      if (abort.signal.aborted) return;

      await this.setDeviceName(this.options.deviceName, this.options.browserName);
      const pairWithPhoneNumber = this.options.pairWithPhoneNumber;
      const version = await this.getWWebVersion();

      // 2. Esperar a que WAWebSocketModel y los módulos de autenticación estén listos.
      // En WhatsApp Web 2.3000.1053430300+, cuando la sesión NO está vinculada (!isRegistered),
      // WAWebSocketModel.Socket.state permanece en 'PAIRING' mientras muestra el código QR.
      const needAuthHandle = await this.pupPage.waitForFunction(
        () => {
          try {
            if (typeof window.require !== 'function') return false;
            const ws = window.require('WAWebSocketModel');
            const conn = window.require('WAWebConnModel');
            const cmd = window.require('WAWebCmd');
            const sig = window.require('WAWebSignalStoreApi');
            const info = window.require('WAWebUserPrefsInfoStore');
            const b64 = window.require('WABase64');
            const md = window.require('WAWebUserPrefsMultiDevice');
            if (
              !ws ||
              !ws.Socket ||
              !conn ||
              !conn.Conn ||
              !cmd ||
              !cmd.Cmd ||
              !sig ||
              !sig.waSignalStore ||
              !info ||
              !info.waNoiseInfo ||
              !b64 ||
              !md
            ) {
              return false;
            }
            const state = ws.Socket.state;
            const isRegistered = Boolean(typeof md.isRegistered === 'function' && md.isRegistered());
            if (!state || state === 'OPENING' || state === 'UNLAUNCHED' || (state === 'PAIRING' && isRegistered)) {
              return false;
            }
            return {
              need: !isRegistered || state === 'UNPAIRED' || state === 'UNPAIRED_IDLE' || state === 'PAIRING',
              state,
              isRegistered
            };
          } catch (_) {
            return false;
          }
        },
        { timeout: authTimeout }
      );
      if (abort.signal.aborted) return;
      const needAuthentication = await needAuthHandle.jsonValue();

      // Exponer window.AuthStore cuando todos los módulos reales ya están listos
      await this.pupPage.evaluate(ExposeAuthStore);

      if (needAuthentication.need) {
        const { failed, failureEventPayload, restart } = await this.authStrategy.onAuthenticationNeeded();

        if (failed) {
          this.emit(Events.AUTHENTICATION_FAILURE, failureEventPayload);
          await this.destroy();
          if (restart) {
            return this.initialize();
          }
          return;
        }

        if (pairWithPhoneNumber && pairWithPhoneNumber.phoneNumber) {
          await exposeFunctionIfAbsent(this.pupPage, 'onCodeReceivedEvent', async (code) => {
            this.emit(Events.CODE_RECEIVED, code);
            return code;
          });
          this.requestPairingCode(
            pairWithPhoneNumber.phoneNumber,
            pairWithPhoneNumber.showNotification,
            pairWithPhoneNumber.intervalMs
          );
        } else {
          let qrRetries = 0;

          await exposeFunctionIfAbsent(this.pupPage, 'onQRChangedEvent', async (qr) => {
            if (!qr || String(qr).startsWith('undefined,') || String(qr).startsWith('null,')) return;
            this.emit(Events.QR_RECEIVED, qr);
            if (this.options.qrMaxRetries > 0) {
              qrRetries++;
              if (qrRetries > this.options.qrMaxRetries) {
                this.emit(Events.DISCONNECTED, 'Max qrcode retries reached');
                await this.destroy();
              }
            }
          });

          await this.pupPage.evaluate(async () => {
            const registrationInfo = await window.require('WAWebSignalStoreApi').waSignalStore.getRegistrationInfo();
            const noiseKeyPair = await window.require('WAWebUserPrefsInfoStore').waNoiseInfo.get();
            const staticKeyB64 = window.require('WABase64').encodeB64(noiseKeyPair.staticKeyPair.pubKey);
            const identityKeyB64 = window.require('WABase64').encodeB64(registrationInfo.identityKeyPair.pubKey);
            const advSecretKey = await window.require('WAWebUserPrefsMultiDevice').getADVSecretKey();
            const platform = window.require('WAWebCompanionRegClientUtils').DEVICE_PLATFORM;
            const getQR = (ref) =>
              ref + ',' + staticKeyB64 + ',' + identityKeyB64 + ',' + advSecretKey + ',' + platform;

            const conn = window.require('WAWebConnModel').Conn;
            const onRefChange = (_, ref) => {
              if (ref == null) return;
              window.onQRChangedEvent(getQR(ref));
            };

            if (conn.ref != null) {
              window.onQRChangedEvent(getQR(conn.ref));
            } else {
              try {
                window.require('WAWebCmd').Cmd.refreshQR();
              } catch (_) {}
            }
            conn.on('change:ref', onRefChange);

            window.require('WAWebSocketModel').Socket.on('change:hasSynced', () => {
              conn.off('change:ref', onRefChange);
            });
          });
        }
      }

      await exposeFunctionIfAbsent(this.pupPage, 'onAuthAppStateChangedEvent', async (state) => {
        if (state == 'UNPAIRED_IDLE' && !(pairWithPhoneNumber && pairWithPhoneNumber.phoneNumber)) {
          await this.pupPage
            .evaluate(() => {
              try {
                window.require('WAWebCmd').Cmd.refreshQR();
              } catch (_) {}
            })
            .catch(() => {});
        }
      });

      await exposeFunctionIfAbsent(this.pupPage, 'onAppStateHasSyncedEvent', async () => {
        const authEventPayload = await this.authStrategy.getAuthEventPayload();
        this.emit(Events.AUTHENTICATED, authEventPayload);

        const injected = await this.pupPage.evaluate(async () => {
          return typeof window.WWebJS !== 'undefined';
        });

        if (!injected) {
          if (this.options.webVersionCache.type === 'local' && this.currentIndexHtml) {
            const { type: webCacheType, ...webCacheOptions } = this.options.webVersionCache;
            const webCache = WebCacheFactory.createWebCache(webCacheType, webCacheOptions);
            await webCache.persist(this.currentIndexHtml, version);
          }

          await this.pupPage.evaluate(LoadUtils);

          await this.pupPage
            .waitForFunction('typeof window.WWebJS !== "undefined"', { timeout: 30000 })
            .catch(() => {
              throw 'ready timeout';
            });

          this.info = new ClientInfo(
            this,
            await this.pupPage.evaluate(() => {
              return {
                ...window.require('WAWebConnModel').Conn.serialize(),
                wid:
                  window.require('WAWebUserPrefsMeUser').getMaybeMePnUser() ||
                  window.require('WAWebUserPrefsMeUser').getMaybeMeLidUser()
              };
            })
          );

          this.interface = new InterfaceController(this);
          await this.attachEventListeners();
        }
        this.emit(Events.READY);
        this.authStrategy.afterAuthReady();
      });

      let lastPercent = null;
      await exposeFunctionIfAbsent(this.pupPage, 'onOfflineProgressUpdateEvent', async (percent) => {
        if (lastPercent !== percent) {
          lastPercent = percent;
          this.emit(Events.LOADING_SCREEN, percent, 'WhatsApp');
        }
      });

      await exposeFunctionIfAbsent(this.pupPage, 'onLogoutEvent', async () => {
        this.lastLoggedOut = true;
        await this.pupPage.waitForNavigation({ waitUntil: 'load', timeout: 5000 }).catch((_) => _);
      });

      await this.pupPage.evaluate(() => {
        const Socket = window.require('WAWebSocketModel').Socket;
        const Cmd = window.require('WAWebCmd').Cmd;

        const listeners = [
          [
            Socket,
            'change:state',
            (_AppState, state) => {
              window.onAuthAppStateChangedEvent(state);
            }
          ],
          [
            Socket,
            'change:hasSynced',
            () => {
              window.onAppStateHasSyncedEvent();
            }
          ],
          [
            Cmd,
            'offline_progress_update_from_bridge',
            () => {
              window.onOfflineProgressUpdateEvent(
                window.require('WAWebOfflineHandler').OfflineMessageHandler.getOfflineDeliveryProgress()
              );
            }
          ],
          [
            Cmd,
            'logout',
            async () => {
              await window.onLogoutEvent();
            }
          ],
          [
            Cmd,
            'logout_from_bridge',
            async () => {
              await window.onLogoutEvent();
            }
          ]
        ];

        if (window._wwjsListeners) {
          for (const [obj, event, handler] of window._wwjsListeners) {
            obj.off(event, handler);
          }
        }

        for (const [obj, event, handler] of listeners) {
          obj.on(event, handler);
        }
        window._wwjsListeners = listeners;

        const storeInjected = typeof window.WWebJS !== 'undefined';
        if (Socket.hasSynced === true && !storeInjected) {
          window.onAppStateHasSyncedEvent();
        }
      });
    } catch (err) {
      if (abort.signal.aborted) return;
      throw err;
    } finally {
      if (this._injectAbort === abort) {
        this._injectAbort = null;
      }
    }
  };
  console.log('[WA-WORKER] Parche oficial de inject() y sincronización de WAWebSocketModel aplicado.');
} catch (err) {
  console.warn('[WA-WORKER] Error al aplicar parche de inject():', err.message);
}

const PORT = parseInt(process.env.WA_WORKER_PORT || '3009', 10);
const AUTH_DIR = path.join(__dirname, '.wwebjs_auth');

let client = null;
let isStarting = false;
let manualStopped = false;
let isRestartingMode = false;
let wwebjsVersion = 'desconocido';
try {
  wwebjsVersion = require('whatsapp-web.js/package.json').version;
} catch (_) {}

let state = {
  status: 'DISCONNECTED', // DISCONNECTED | STOPPED | RESTARTING | INITIALIZING | QR_READY | AUTHENTICATED | CONNECTED
  connected: false,
  restartStartedAt: null,
  qrRaw: '',
  qrDataUrl: '',
  qrUpdatedAt: null,
  account: null,
  lastError: '',
  browserPath: '',
  installedVersion: wwebjsVersion
};

function findBrowserExecutable() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH && fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable'
  ];
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    } catch (_) {}
  }
  return '';
}

function nowISO() {
  return new Date().toISOString();
}

function formatPlatformLabel(platform) {
  const p = String(platform || '').toLowerCase();
  if (p === 'smba') return 'WhatsApp Business (Android)';
  if (p === 'smbi') return 'WhatsApp Business (iPhone)';
  if (p === 'android') return 'WhatsApp Personal (Android)';
  if (p === 'iphone' || p === 'ios') return 'WhatsApp Personal (iPhone)';
  return platform ? `WhatsApp (${platform})` : 'WhatsApp Web';
}

async function fetchImageAsDataUrl(url) {
  if (!url) return '';
  if (url.startsWith('data:image/')) return url;
  try {
    const res = await fetch(url);
    if (!res.ok) return url;
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const arrayBuffer = await res.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    return `data:${contentType};base64,${base64}`;
  } catch (_) {
    return url;
  }
}

/**
 * Aplica parches de compatibilidad en el contexto de WhatsApp Web (pupPage)
 * para corregir el error de memoización de getters (`id` requerido en `msgToMediaType`)
 * y garantizar el envío real de texto, imágenes, videos y PDFs.
 */
async function ensureWWebJSPatched() {
  if (!client || !client.pupPage) return;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await client.pupPage.evaluate(() => {
      if (!window.WWebJS) return;

      window.WWebJS.mediaInfoToFile = ({ data, mimetype, filename }) => {
        let str = String(data || '').trim().replace(/[\s\r\n]+/g, '');
        const commaIdx = str.indexOf(',');
        if (commaIdx !== -1) {
          str = str.substring(commaIdx + 1);
        }
        if (str.includes('%')) {
          try { str = decodeURIComponent(str); } catch (_) {}
        }
        const unpadded = str.replace(/[^A-Za-z0-9+/]/g, '');
        const rem = unpadded.length % 4;
        let clean = unpadded;
        if (rem === 2) clean += '==';
        else if (rem === 3) clean += '=';
        else if (rem === 1) clean = clean.slice(0, -1);

        const binaryData = window.atob(clean);
        const buffer = new ArrayBuffer(binaryData.length);
        const view = new Uint8Array(buffer);
        for (let i = 0; i < binaryData.length; i++) {
          view[i] = binaryData.charCodeAt(i);
        }
        const mime = mimetype || 'application/pdf';
        const blob = new Blob([buffer], { type: mime });
        return new File([blob], filename || 'Presupuesto.pdf', {
          type: mime,
          lastModified: Date.now(),
        });
      };

      window.WWebJS.processMediaData = async (
        mediaInfo,
        {
          forceSticker,
          forceGif,
          forceVoice,
          forceDocument,
          forceMediaHd,
          sendToChannel,
          sendToStatus,
        } = {}
      ) => {
        const file = window.WWebJS.mediaInfoToFile(mediaInfo);
        const OpaqueData = window.require('WAWebMediaOpaqueData');
        const opaqueData = await OpaqueData.createFromData(file, mediaInfo.mimetype);
        const isDoc = Boolean(forceDocument || mediaInfo.mimetype === 'application/pdf');
        const mediaParams = {
          asSticker: forceSticker,
          asGif: forceGif,
          isPtt: forceVoice,
          asDocument: isDoc,
        };

        if (forceMediaHd && file.type.indexOf('image/') === 0) {
          mediaParams.maxDimension = 2560;
        }

        const mediaPrep = window.require('WAWebPrepRawMedia').prepRawMedia(opaqueData, mediaParams);
        const mediaData = await mediaPrep.waitForPrep();
        const mediaObject = window.require('WAWebMediaStorage').getOrCreateMediaObject(mediaData.filehash);

        const tempId = mediaData.filehash || 'media_' + Date.now() + '_' + Math.random().toString(36).slice(2);
        if (mediaObject && !mediaObject.id) {
          mediaObject.id = tempId;
        }

        let mediaType = 'image';
        try {
          mediaType = window.require('WAWebMmsMediaTypes').msgToMediaType({
            id: tempId,
            type: mediaData.type,
            isGif: Boolean(mediaData.isGif),
            isNewsletter: Boolean(sendToChannel),
          });
        } catch (_) {
          mediaType = mediaData.type || 'document';
        }

        if (!mediaData.filehash) {
          throw new Error('media-fault: sendToChat filehash undefined');
        }

        if ((forceVoice && mediaData.type === 'ptt') || (sendToStatus && mediaData.type === 'audio')) {
          const waveform = mediaObject.contentInfo && mediaObject.contentInfo.waveform;
          mediaData.waveform = waveform || (await window.WWebJS.generateWaveform(file));
        }

        if (!(mediaData.mediaBlob instanceof OpaqueData)) {
          mediaData.mediaBlob = await OpaqueData.createFromData(
            mediaData.mediaBlob,
            mediaData.mediaBlob.type
          );
        }

        mediaData.renderableUrl = mediaData.mediaBlob.url();
        mediaObject.consolidate(mediaData.toJSON());
        mediaData.mediaBlob.autorelease();

        try {
          const shouldUseMediaCache = window
            .require('WAWebMediaDataUtils')
            .shouldUseMediaCache(
              window.require('WAWebMmsMediaTypes').castToV4(mediaObject.type)
            );
          if (shouldUseMediaCache && mediaData.mediaBlob instanceof OpaqueData) {
            const formData = mediaData.mediaBlob.formData();
            window.require('WAWebMediaInMemoryBlobCache').InMemoryMediaBlobCache.put(
              mediaObject.filehash,
              formData
            );
          }
        } catch (_) {}

        const dataToUpload = {
          mimetype: mediaData.mimetype,
          mediaObject,
          mediaType,
          ...(sendToChannel
            ? {
                calculateToken: window.require('WAMediaCalculateFilehash').getRandomFilehash,
              }
            : {}),
        };

        const { uploadMedia, uploadUnencryptedMedia } = window.require('WAWebMediaMmsV4Upload');
        const uploadedMedia = !sendToChannel
          ? await uploadMedia(dataToUpload)
          : await uploadUnencryptedMedia(dataToUpload);

        const mediaEntry = uploadedMedia.mediaEntry;
        if (!mediaEntry) {
          throw new Error('upload failed: media entry was not created');
        }

        mediaData.set({
          clientUrl: mediaEntry.mmsUrl,
          deprecatedMms3Url: mediaEntry.deprecatedMms3Url,
          directPath: mediaEntry.directPath,
          mediaKey: mediaEntry.mediaKey,
          mediaKeyTimestamp: mediaEntry.mediaKeyTimestamp,
          filehash: mediaObject.filehash,
          encFilehash: mediaEntry.encFilehash,
          uploadhash: mediaEntry.uploadHash,
          size: mediaObject.size,
          streamingSidecar: mediaEntry.sidecar,
          firstFrameSidecar: mediaEntry.firstFrameSidecar,
          mediaHandle: sendToChannel ? mediaEntry.handle : null,
        });

        // Limpiar __x_id e id de mediaData para evitar colisión en los getters de memoización de WhatsApp Web
        // y asegurar que el caption no sea sobrescrito con null por toJSON()
        try {
          delete mediaData.__x_id;
          delete mediaData.id;
          if (typeof mediaData.toJSON === 'function') {
            const origToJSON = mediaData.toJSON.bind(mediaData);
            mediaData.toJSON = function () {
              const res = origToJSON() || {};
              delete res.__x_id;
              delete res.id;
              // Si mediaData tiene caption asignado, conservarlo; de lo contrario eliminar la propiedad
              // para evitar que res.caption: null sobrescriba options.caption en el spread {...options, ...mediaOptions, ...mediaJson}
              if (mediaData.caption) {
                res.caption = mediaData.caption;
              } else if (!res.caption) {
                delete res.caption;
              }
              return res;
            };
          }
        } catch (_) {}

        return mediaData;
      };

      window.WWebJS.getChat = async (chatId, { getAsModel = true } = {}) => {
        const isChannel = /@\w*newsletter\b/.test(chatId);
        const chatWid = window.require('WAWebWidFactory').createWid(chatId);
        let chat;

        if (isChannel) {
          try {
            chat = window.require('WAWebCollections').WAWebNewsletterCollection.get(chatId);
            if (!chat) {
              await window.require('WAWebLoadNewsletterPreviewChatAction').loadNewsletterPreviewChat(chatId);
              chat = await window.require('WAWebCollections').WAWebNewsletterCollection.find(chatWid);
            }
          } catch (_) {
            chat = null;
          }
        } else {
          chat = window.require('WAWebCollections').Chat.get(chatWid);
          if (!chat) {
            const found = await window.require('WAWebFindChatAction').findOrCreateLatestChat(chatWid);
            chat = (found && found.chat) ? found.chat : found;
          }
        }

        return getAsModel && chat
          ? await window.WWebJS.getChatModel(chat, { isChannel })
          : chat;
      };

      // Hook en sendMessage para garantizar que options.caption se propague a media
      if (window.WWebJS && window.WWebJS.sendMessage && !window.WWebJS._origSendMessage) {
        window.WWebJS._origSendMessage = window.WWebJS.sendMessage;
        window.WWebJS.sendMessage = async function (chat, content, options = {}) {
          const cap = options.caption || (options.media && options.media.caption);
          if (cap && options.media && typeof options.media === 'object') {
            options.media.caption = cap;
          }
          return await window.WWebJS._origSendMessage.apply(this, arguments);
        };
      }

      // Parchear WAWebSendMsgChatAction para sanitizar el payload del mensaje antes de la memoización de WhatsApp
      // y garantizar que el caption del documento nunca se pierda
      try {
        const sendModule = window.require('WAWebSendMsgChatAction');
        if (sendModule && sendModule.addAndSendMsgToChat && !sendModule._origAddAndSend) {
          sendModule._origAddAndSend = sendModule.addAndSendMsgToChat;
          sendModule.addAndSendMsgToChat = function (chat, msg) {
            if (msg && typeof msg === 'object') {
              try {
                delete msg.__x_id;
                if (msg.mediaData && typeof msg.mediaData === 'object') {
                  delete msg.mediaData.__x_id;
                  delete msg.mediaData.id;
                }
                // Si existe caption en el mensaje o en mediaData, sincronizar ambos para que WhatsApp Web lo adjunte al documento
                const cap = msg.caption || (msg.mediaData && msg.mediaData.caption);
                if (cap) {
                  msg.caption = cap;
                  if (msg.mediaData && typeof msg.mediaData === 'object') {
                    msg.mediaData.caption = cap;
                    if (typeof msg.mediaData.set === 'function') {
                      msg.mediaData.set('caption', cap);
                    }
                  }
                }
              } catch (_) {}
            }
            return sendModule._origAddAndSend.apply(this, arguments);
          };
        }
      } catch (_) {}
    });
    return;
  } catch (err) {
    if (err.message && (err.message.includes('detached Frame') || err.message.includes('Execution context was destroyed'))) {
      console.log(`[WA-WORKER] Frame detached detectado al aplicar parche (intento ${attempt}/3). Esperando 1s...`);
      await new Promise((r) => setTimeout(r, 1000));
      continue;
    }
    console.error('[WA-WORKER] Error aplicando parche WWebJS:', err.message || err);
    break;
  }
}
}

async function populateAccountInfo() {
  if (!client || !client.info) return;
  const info = client.info;
  const userNum = (info.wid && info.wid.user) ? String(info.wid.user) : '';
  const serializedWid = (info.wid && info.wid._serialized) ? info.wid._serialized : `${userNum}@c.us`;
  const pushname = info.pushname || 'Cuenta vinculada';
  const rawPlatform = info.platform || 'web';
  const platformLabel = formatPlatformLabel(rawPlatform);
  const isBusiness = rawPlatform === 'smba' || rawPlatform === 'smbi';

  let profilePicUrl = (state.account && state.account.profilePicUrl) || '';
  if (!profilePicUrl) {
    try {
      const rawUrl = await client.getProfilePicUrl(serializedWid);
      if (rawUrl) {
        profilePicUrl = await fetchImageAsDataUrl(rawUrl);
      }
    } catch (_) {}
  }

  // Extraer datos extendidos desde WhatsApp Web (Acerca de, Perfil Business, Contadores de Chats, Contactos, Grupos, No leídos, Versión)
  let extra = {
    about: '',
    isBusiness,
    businessDescription: '',
    businessAddress: '',
    businessEmail: '',
    businessWebsite: '',
    businessCategory: '',
    chatsCount: 0,
    groupsCount: 0,
    unreadChatsCount: 0,
    unreadMessagesCount: 0,
    contactsCount: 0,
    wwebVersion: '',
    thumbBase64: ''
  };

  try {
    if (client.pupPage) {
      const pageExtra = await client.pupPage.evaluate(async (widStr) => {
        const out = {
          about: '',
          isBusiness: false,
          businessDescription: '',
          businessAddress: '',
          businessEmail: '',
          businessWebsite: '',
          businessCategory: '',
          chatsCount: 0,
          groupsCount: 0,
          unreadChatsCount: 0,
          unreadMessagesCount: 0,
          contactsCount: 0,
          wwebVersion: (window.Debug && window.Debug.VERSION) ? String(window.Debug.VERSION) : '',
          thumbBase64: ''
        };

        try {
          const collections = window.require('WAWebCollections');
          if (collections && collections.Chat) {
            const allChats = collections.Chat.getModelsArray() || [];
            out.chatsCount = allChats.length;
            let groups = 0;
            let unreadChats = 0;
            let unreadMsgs = 0;
            for (const c of allChats) {
              if (c.isGroup || (c.id && c.id.server === 'g.us')) groups++;
              const u = Number(c.unreadCount || 0);
              if (u > 0) {
                unreadChats++;
                unreadMsgs += u;
              }
            }
            out.groupsCount = groups;
            out.unreadChatsCount = unreadChats;
            out.unreadMessagesCount = unreadMsgs;
          }

          if (collections && collections.Contact) {
            const allContacts = collections.Contact.getModelsArray() || [];
            out.contactsCount = allContacts.filter((c) => c && c.isMyContact).length || allContacts.length;
          }

          const wid = window.require('WAWebWidFactory').createWid(widStr);

          // Intentar miniatura en base64 si no hay URL directa
          if (window.WWebJS && typeof window.WWebJS.getProfilePicThumbToBase64 === 'function') {
            try {
              const t = await window.WWebJS.getProfilePicThumbToBase64(wid);
              if (t) out.thumbBase64 = `data:image/jpeg;base64,${t}`;
            } catch (_) {}
          }

          // Intentar estado / Acerca de
          try {
            const statusRes = await window.require('WAWebContactStatusBridge').getStatus(wid);
            if (statusRes && statusRes.status) {
              out.about = String(statusRes.status);
            }
          } catch (_) {}

          // Intentar Perfil de Empresa (WhatsApp Business)
          try {
            if (collections && collections.BusinessProfile) {
              const bp = await collections.BusinessProfile.find(wid);
              if (bp) {
                out.isBusiness = true;
                out.businessDescription = bp.description || '';
                out.businessAddress = bp.address || '';
                out.businessEmail = bp.email || '';
                if (Array.isArray(bp.website) && bp.website.length > 0) {
                  out.businessWebsite = bp.website[0].url || bp.website[0] || '';
                }
                if (Array.isArray(bp.categories) && bp.categories.length > 0) {
                  out.businessCategory = bp.categories.map((cat) => cat.localized_display_name || cat.name || '').filter(Boolean).join(', ');
                }
              }
            }
          } catch (_) {}
        } catch (_) {}

        return out;
      }, serializedWid);

      if (pageExtra) {
        extra = { ...extra, ...pageExtra };
      }
    }
  } catch (_) {}

  if (!profilePicUrl && extra.thumbBase64) {
    profilePicUrl = extra.thumbBase64;
  }

  const prevConnectedAt = state.account && state.account.connectedAt ? state.account.connectedAt : nowISO();
  state.account = {
    phone: userNum,
    name: pushname,
    platform: rawPlatform,
    platformLabel,
    isBusiness: Boolean(isBusiness || extra.isBusiness),
    about: extra.about || '',
    businessDescription: extra.businessDescription || '',
    businessAddress: extra.businessAddress || '',
    businessEmail: extra.businessEmail || '',
    businessWebsite: extra.businessWebsite || '',
    businessCategory: extra.businessCategory || '',
    chatsCount: extra.chatsCount || 0,
    groupsCount: extra.groupsCount || 0,
    unreadChatsCount: extra.unreadChatsCount || 0,
    unreadMessagesCount: extra.unreadMessagesCount || 0,
    contactsCount: extra.contactsCount || 0,
    wwebVersion: extra.wwebVersion || '',
    profilePicUrl,
    connectedAt: prevConnectedAt,
    lastActivityAt: (state.account && state.account.lastActivityAt) ? state.account.lastActivityAt : nowISO()
  };
}

function killOrphanedChromium() {
  if (process.platform === 'linux') {
    try {
      const { execSync } = require('child_process');
      execSync('pkill -9 -f chromium || true', { stdio: 'ignore' });
    } catch (_) {}
  }
}

async function safeDestroyClient(targetClient, { withLogout = false } = {}) {
  if (!targetClient) return;
  const withTimeout = (promise, ms) =>
    Promise.race([promise, new Promise((resolve) => setTimeout(resolve, ms))]);

  if (withLogout) {
    try {
      await withTimeout(targetClient.logout(), 3000);
    } catch (_) {}
  }
  try {
    await withTimeout(targetClient.destroy(), 3500);
  } catch (_) {}
}

function removeSingletonLocks(targetDir = AUTH_DIR) {
  try {
    if (!fs.existsSync(targetDir)) return;
    const entries = fs.readdirSync(targetDir, { withFileTypes: true });
    for (const ent of entries) {
      const full = path.join(targetDir, ent.name);
      if (ent.isDirectory()) {
        removeSingletonLocks(full);
      } else if (ent.name.startsWith('Singleton')) {
        try {
          fs.unlinkSync(full);
          console.log(`[WA-WORKER] Bloqueo residual eliminado: ${full}`);
        } catch (_) {}
      }
    }
  } catch (err) {
    console.warn('[WA-WORKER] Error limpiando bloqueos Singleton:', err.message);
  }
}

async function startClient({ asRestart = false } = {}) {
  // Limpiar preventivamente cualquier archivo de bloqueo de Chromium antes de inicializar
  removeSingletonLocks(AUTH_DIR);

  if (isStarting) {
    return;
  }
  if (!asRestart && client && (state.status === 'CONNECTED' || state.status === 'QR_READY' || state.status === 'INITIALIZING' || state.status === 'AUTHENTICATED' || state.status === 'RESTARTING')) {
    return;
  }

  manualStopped = false;
  isStarting = true;
  isRestartingMode = Boolean(asRestart);
  state.status = asRestart ? 'RESTARTING' : 'INITIALIZING';
  state.restartStartedAt = asRestart ? nowISO() : null;
  state.connected = false;
  state.qrRaw = '';
  state.qrDataUrl = '';
  state.lastError = '';

  const executablePath = findBrowserExecutable();
  state.browserPath = executablePath;

  const puppeteerOpts = {
    headless: true,
    timeout: 60000,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-site-isolation-trials'
    ]
  };
  if (executablePath) {
    puppeteerOpts.executablePath = executablePath;
  }

  try {
    if (client) {
      const oldClient = client;
      client = null;
      await safeDestroyClient(oldClient);
    }
    killOrphanedChromium();

    client = new Client({
      authStrategy: new LocalAuth({
        clientId: 'netz-r1-main',
        dataPath: AUTH_DIR
      }),
      authTimeoutMs: 60000,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      puppeteer: puppeteerOpts
    });

    client.on('qr', async (qr) => {
      if (manualStopped) return;
      if (!qr || String(qr).startsWith('undefined,') || String(qr).startsWith('null,')) return;
      try {
        const dataUrl = await QRCode.toDataURL(qr, {
          errorCorrectionLevel: 'M',
          margin: 2,
          width: 320,
          color: {
            dark: '#0f172a',
            light: '#ffffff'
          }
        });
        isRestartingMode = false;
        state.restartStartedAt = null;
        state.status = 'QR_READY';
        state.connected = false;
        state.qrRaw = qr;
        state.qrDataUrl = dataUrl;
        state.qrUpdatedAt = nowISO();
        state.lastError = '';
        console.log('[WA-WORKER] Código QR generado y listo para escanear.');
      } catch (err) {
        state.lastError = 'Error al generar imagen QR: ' + (err.message || String(err));
      }
    });

    client.on('authenticated', () => {
      if (manualStopped) return;
      state.status = isRestartingMode ? 'RESTARTING' : 'AUTHENTICATED';
      state.qrRaw = '';
      state.qrDataUrl = '';
      state.lastError = '';
    });

    client.on('auth_failure', (msg) => {
      isRestartingMode = false;
      state.restartStartedAt = null;
      state.status = 'DISCONNECTED';
      state.connected = false;
      state.lastError = 'Fallo de autenticación: ' + (msg || 'Sesión expirada');
    });

    client.on('ready', async () => {
      if (manualStopped) return;
      isRestartingMode = false;
      state.restartStartedAt = null;
      state.status = 'CONNECTED';
      state.connected = true;
      state.qrRaw = '';
      state.qrDataUrl = '';
      state.lastError = '';
      await ensureWWebJSPatched();
      await populateAccountInfo();
      if (state.account) {
        state.account.connectedAt = nowISO();
        state.account.lastActivityAt = nowISO();
      }
      console.log('[WA-WORKER] Cliente WhatsApp conectado y listo.');
    });

    client.on('disconnected', async (reason) => {
      isRestartingMode = false;
      state.restartStartedAt = null;
      state.status = manualStopped ? 'STOPPED' : 'DISCONNECTED';
      state.connected = false;
      state.qrRaw = '';
      state.qrDataUrl = '';
      if (state.account) {
        state.account.lastActivityAt = nowISO();
      }
      if (!manualStopped) {
        state.lastError = reason ? `Sesión desconectada (${reason})` : '';
      }
      const oldClient = client;
      client = null;
      await safeDestroyClient(oldClient);
    });

    client.initialize().catch((err) => {
      if (manualStopped) return;
      isRestartingMode = false;
      state.restartStartedAt = null;
      state.status = 'DISCONNECTED';
      state.connected = false;
      state.lastError = `No se pudo iniciar el navegador en segundo plano (v${wwebjsVersion}): ` + (err.message || String(err));
      client = null;
    });
  } catch (err) {
    isRestartingMode = false;
    state.restartStartedAt = null;
    state.status = 'DISCONNECTED';
    state.connected = false;
    state.lastError = 'Error inicializando cliente WhatsApp: ' + (err.message || String(err));
    client = null;
  } finally {
    isStarting = false;
  }
}

async function stopClient() {
  manualStopped = true;
  isStarting = false;
  isRestartingMode = false;
  state.restartStartedAt = null;
  state.status = 'STOPPED';
  state.connected = false;
  state.qrRaw = '';
  state.qrDataUrl = '';
  state.lastError = '';
  if (state.account) {
    state.account.lastActivityAt = nowISO();
  }
  if (client) {
    const oldClient = client;
    client = null;
    await safeDestroyClient(oldClient);
  }
  killOrphanedChromium();
}

async function restartClient() {
  isStarting = false;
  manualStopped = false;
  isRestartingMode = true;
  state.status = 'RESTARTING';
  state.restartStartedAt = nowISO();
  state.connected = false;
  state.qrRaw = '';
  state.qrDataUrl = '';
  state.lastError = '';

  if (client) {
    const oldClient = client;
    client = null;
    await safeDestroyClient(oldClient);
  }
  await startClient({ asRestart: true });
}

async function deleteSessionAndRestart() {
  manualStopped = false;
  isStarting = false;
  isRestartingMode = false;
  state.restartStartedAt = null;
  state.status = 'INITIALIZING';
  state.connected = false;
  state.qrRaw = '';
  state.qrDataUrl = '';
  state.account = null;
  state.lastError = '';

  if (client) {
    const oldClient = client;
    client = null;
    await safeDestroyClient(oldClient, { withLogout: true });
  }

  // Matar procesos Chromium colgados y liberar descriptores
  killOrphanedChromium();
  await new Promise((r) => setTimeout(r, 800));

  try {
    if (fs.existsSync(AUTH_DIR)) {
      fs.rmSync(AUTH_DIR, { recursive: true, force: true });
    }
  } catch (err) {
    state.lastError = 'Aviso al limpiar credenciales locales: ' + (err.message || String(err));
  }

  removeSingletonLocks(AUTH_DIR);

  // Iniciar automáticamente una nueva sesión para mostrar el QR de inmediato
  await startClient({ asRestart: false });
}

function normalizePhoneDigits(raw) {
  let digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('09')) {
    digits = '595' + digits.slice(1);
  } else if (digits.length === 9 && digits.startsWith('9')) {
    digits = '595' + digits;
  }
  return digits;
}

function parseDataUrl(dataUrl, fallbackMime) {
  let str = String(dataUrl || '').trim();
  if (!str) return null;

  let mime = fallbackMime || 'application/octet-stream';
  let base64 = str;

  const base64Marker = ';base64,';
  const markerIdx = str.indexOf(base64Marker);

  if (markerIdx !== -1) {
    const prefix = str.substring(0, markerIdx);
    if (prefix.startsWith('data:')) {
      const mimePart = prefix.substring(5).split(';')[0].trim();
      if (mimePart) mime = mimePart;
    }
    base64 = str.substring(markerIdx + base64Marker.length);
  } else if (str.startsWith('data:')) {
    const commaIdx = str.indexOf(',');
    if (commaIdx !== -1) {
      base64 = str.substring(commaIdx + 1);
    }
  }

  base64 = base64.replace(/[\s\r\n]+/g, '');
  if (base64.includes('%')) {
    try { base64 = decodeURIComponent(base64); } catch (_) {}
  }

  const unpadded = base64.replace(/[^A-Za-z0-9+/]/g, '');
  const rem = unpadded.length % 4;
  let clean = unpadded;
  if (rem === 2) clean += '==';
  else if (rem === 3) clean += '=';
  else if (rem === 1) clean = clean.slice(0, -1);

  return {
    mime,
    base64: clean
  };
}

async function resolveTargetChatId(digits) {
  const defaultCUs = `${digits}@c.us`;
  try {
    const numberDetails = await client.getNumberId(digits);
    if (!numberDetails) {
      throw new Error(`El número +${digits} no está registrado en WhatsApp.`);
    }
    if (numberDetails._serialized) {
      return numberDetails._serialized;
    }
  } catch (err) {
    if (err.message && err.message.includes('no está registrado')) {
      throw err;
    }
  }
  return defaultCUs;
}

async function sendWhatsAppMessage(payload) {
  if (!client || state.status !== 'CONNECTED') {
    throw new Error('La cuenta de WhatsApp no está conectada. Vincula o inicia tu cuenta en Sesiones WhatsApp.');
  }

  const digits = normalizePhoneDigits(payload.phone);
  if (!digits || digits.length < 7) {
    throw new Error('Número de teléfono de destinatario inválido.');
  }

  const text = String(payload.message || '').trim();
  const mediaObj = payload.media && payload.media.data ? payload.media : null;

  if (!text && !mediaObj) {
    throw new Error('Debes indicar un mensaje de texto o un archivo adjunto.');
  }

  const fallbackChatId = `${digits}@c.us`;
  let targetChatId = fallbackChatId;

  try {
    targetChatId = await resolveTargetChatId(digits);
  } catch (idErr) {
    if (idErr.message && idErr.message.includes('no está registrado')) {
      throw idErr;
    }
    targetChatId = fallbackChatId;
  }

  let sentMsg = null;
  const baseSendOptions = {
    sendSeen: false,
    waitUntilMsgSent: true,
    linkPreview: false
  };

  const executeSend = async (chatId) => {
    if (mediaObj && mediaObj.data) {
      const parsed = parseDataUrl(mediaObj.data, mediaObj.mime);
      if (!parsed || !parsed.base64) {
        throw new Error('El archivo adjunto no tiene un formato Base64 válido.');
      }
      const filename = mediaObj.filename || 'adjunto';
      const media = new MessageMedia(parsed.mime, parsed.base64, filename);
      const sendOptions = { ...baseSendOptions };
      if (text) {
        media.caption = text;
        sendOptions.caption = text;
      }
      if (parsed.mime === 'application/pdf') {
        sendOptions.sendMediaAsDocument = true;
      }
      console.log(`[WA-WORKER] Enviando mensaje con adjunto (${filename}) a ${chatId}. Longitud texto: ${text ? text.length : 0} caracteres.`);
      return await client.sendMessage(chatId, media, sendOptions);
    } else {
      console.log(`[WA-WORKER] Enviando mensaje de solo texto a ${chatId}. Longitud texto: ${text ? text.length : 0} caracteres.`);
      return await client.sendMessage(chatId, text, baseSendOptions);
    }
  };

  let lastErr = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await ensureWWebJSPatched();
      sentMsg = await executeSend(targetChatId);
      lastErr = null;
      break;
    } catch (err) {
      lastErr = err;
      console.log(`[WA-WORKER] Intento ${attempt} de envío a ${targetChatId} falló:`, err.message);

      if (err.message && err.message.includes('no está registrado')) {
        throw err;
      }

      if (
        err.message &&
        (err.message.includes('detached Frame') ||
          err.message.includes('Execution context was destroyed') ||
          err.message.includes('Session closed'))
      ) {
        console.log(`[WA-WORKER] Error transitorio de frame/contexto en WhatsApp Web. Esperando 1.5s antes del intento ${attempt + 1}...`);
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }

      // Probar con fallbackChatId si targetChatId falló
      if (targetChatId !== fallbackChatId) {
        try {
          sentMsg = await executeSend(fallbackChatId);
          targetChatId = fallbackChatId;
          lastErr = null;
          break;
        } catch (fbErr) {
          lastErr = fbErr;
        }
      }

      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  if (lastErr) {
    throw lastErr;
  }

  if (state.account) {
    state.account.lastActivityAt = nowISO();
  }

  return {
    ok: true,
    chatId: targetChatId,
    messageId: (sentMsg && sentMsg.id && (sentMsg.id._serialized || sentMsg.id.id)) || 'sent_' + Date.now(),
    timestamp: nowISO()
  };
}

function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(data));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      if (chunks.length === 0) return resolve({});
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

let isBackgroundChecking = false;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const pathname = url.pathname;

  try {
    if (req.method === 'GET' && pathname === '/status') {
      // Si hay un código QR emitido y el cliente aún no tiene credenciales autenticadas, el estado real es QR_READY
      if (state.qrRaw && (!client || !client.info || !client.info.wid)) {
        if (state.status !== 'STOPPED' && state.status !== 'RESTARTING') {
          state.status = 'QR_READY';
          state.connected = false;
        }
      }

      // Ejecutar chequeos de sincronización en segundo plano sin bloquear jamás la respuesta HTTP de /status
      if (!isBackgroundChecking) {
        if (client && client.pupPage && (state.status === 'QR_READY' || state.status === 'AUTHENTICATED')) {
          isBackgroundChecking = true;
          Promise.race([
            client.pupPage.evaluate(() => {
              try {
                const conn = window.require('WAWebConnModel')?.Conn;
                return Boolean(conn && conn.isRegistered === true && conn.wid);
              } catch (_) {
                return false;
              }
            }),
            new Promise((r) => setTimeout(() => r(false), 1200))
          ])
            .then(async (isRegistered) => {
              if (isRegistered && client && client.info && client.info.wid) {
                state.status = 'CONNECTED';
                state.connected = true;
                state.qrRaw = '';
                state.qrDataUrl = '';
                await ensureWWebJSPatched();
                await populateAccountInfo();
              }
            })
            .catch(() => {})
            .finally(() => {
              isBackgroundChecking = false;
            });
        } else if (state.status === 'CONNECTED' && (!state.account || !state.account.phone || !state.account.profilePicUrl || !state.account.wwebVersion)) {
          isBackgroundChecking = true;
          populateAccountInfo()
            .catch(() => {})
            .finally(() => {
              isBackgroundChecking = false;
            });
        }
      }

      return sendJSON(res, 200, state);
    }

    if (req.method === 'POST' && pathname === '/start') {
      startClient({ asRestart: false }).catch((err) => {
        console.error('[WA-WORKER START ERROR]', err);
      });
      return sendJSON(res, 200, state);
    }

    if (req.method === 'POST' && pathname === '/restart') {
      restartClient().catch((err) => {
        console.error('[WA-WORKER RESTART ERROR]', err);
      });
      return sendJSON(res, 200, state);
    }

    if (req.method === 'POST' && pathname === '/stop') {
      stopClient().catch((err) => {
        console.error('[WA-WORKER STOP ERROR]', err);
      });
      return sendJSON(res, 200, state);
    }

    if (req.method === 'POST' && pathname === '/delete-session') {
      deleteSessionAndRestart().catch((err) => {
        console.error('[WA-WORKER DELETE-SESSION ERROR]', err);
      });
      return sendJSON(res, 200, state);
    }

    if (req.method === 'POST' && pathname === '/send') {
      const body = await readJsonBody(req);
      console.log(`[WA-WORKER /send] Solicitud recibida para destinatario: ${body.phone}, Mensaje: "${String(body.message || '').substring(0, 50)}...", Adjunto: ${body.media ? (body.media.filename || 'sí') : 'no'}`);
      const result = await sendWhatsAppMessage(body);
      return sendJSON(res, 200, result);
    }

    if (req.method === 'POST' && pathname === '/render-pdf') {
      const body = await readJsonBody(req);
      const html = body.html || '';
      if (!html) {
        return sendJSON(res, 400, { error: 'HTML es requerido' });
      }

      let preparedHtml = html;
      if (!preparedHtml.includes('<base ') && preparedHtml.includes('<head>')) {
        preparedHtml = preparedHtml.replace('<head>', '<head><base href="http://127.0.0.1:8081/">');
      }

      let browserToUse = null;
      let closeBrowserAfter = false;

      if (client && client.pupBrowser && client.pupBrowser.isConnected()) {
        browserToUse = client.pupBrowser;
      } else {
        const puppeteer = require('puppeteer');
        browserToUse = await puppeteer.launch({
          headless: 'new',
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
        });
        closeBrowserAfter = true;
      }

      try {
        const page = await browserToUse.newPage();
        await page.setViewport({ width: 1240, height: 1754, deviceScaleFactor: 2 });
        await page.setContent(preparedHtml, { waitUntil: ['load', 'networkidle0'], timeout: 20000 }).catch(() => {});
        await new Promise((r) => setTimeout(r, 400));
        const pdfBuffer = await page.pdf({
          format: 'A4',
          printBackground: true,
          preferCSSPageSize: true,
          margin: { top: '0', right: '0', bottom: '0', left: '0' }
        });
        await page.close();
        if (closeBrowserAfter) {
          await browserToUse.close().catch(() => {});
        }
        const base64Data = Buffer.from(pdfBuffer).toString('base64');
        return sendJSON(res, 200, {
          success: true,
          dataUri: `data:application/pdf;base64,${base64Data}`,
          sizeBytes: pdfBuffer.length
        });
      } catch (err) {
        if (closeBrowserAfter && browserToUse) {
          try { await browserToUse.close(); } catch (_) {}
        }
        console.error('[RENDER-PDF ERROR]', err);
        return sendJSON(res, 500, { error: err.message || 'Error renderizando PDF' });
      }
    }

    return sendJSON(res, 404, { error: 'Ruta de worker WhatsApp no encontrada' });
  } catch (err) {
    console.error('[WA-WORKER ERROR]', err);
    return sendJSON(res, 500, {
      error: err.message || 'Error interno en el worker de WhatsApp',
      state
    });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[WA-WORKER] Escuchando en http://127.0.0.1:${PORT}`);
  startClient({ asRestart: false });
});
