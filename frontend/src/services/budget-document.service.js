/**
 * BudgetDocumentService — Servicio centralizado de generación y exportación de presupuestos
 * Arquitectura 100% Client-Side con resolución de Web Worker CORS via Blob URL.
 */

import { apiFetch } from './api.js';

/**
 * Shim de Web Worker para resolver de raíz el error de CORS al cargar scripts desde CDN
 * Intercepta new Worker(scriptURL) externo y lo convierte en un Blob URL local del mismo origen.
 */
export function initWorkerCorsShim() {
  if (typeof window === 'undefined' || window.__workerCorsShimmed) return;
  window.__workerCorsShimmed = true;

  const NativeWorker = window.Worker;
  window.Worker = function (scriptURL, options) {
    const urlStr = String(scriptURL || '');
    if ((urlStr.startsWith('http://') || urlStr.startsWith('https://')) && !urlStr.startsWith(window.location.origin)) {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', urlStr, false); // Síncrono para instanciación inmediata del constructor
        xhr.send();
        if (xhr.status >= 200 && xhr.status < 300) {
          const blob = new Blob([xhr.responseText], { type: 'application/javascript' });
          const blobUrl = URL.createObjectURL(blob);
          return new NativeWorker(blobUrl, options);
        }
      } catch (err) {
        console.warn('[WorkerCorsShim] Fallback a Worker nativo:', err);
      }
    }
    return new NativeWorker(scriptURL, options);
  };
}

// Inicializar inmediatamente el shim de Worker
initWorkerCorsShim();

let pdfmeModules = null;
let pdfmeLoadingPromise = null;

/**
 * Carga concurrente de librerías @pdfme protegidas contra CORS
 */
export async function loadPdfmeLibraries() {
  initWorkerCorsShim();
  if (pdfmeModules) return pdfmeModules;
  if (pdfmeLoadingPromise) return pdfmeLoadingPromise;

  pdfmeLoadingPromise = (async () => {
    try {
      const [generatorMod, schemasMod] = await Promise.all([
        import('https://cdn.jsdelivr.net/npm/@pdfme/generator@6/+esm'),
        import('https://cdn.jsdelivr.net/npm/@pdfme/schemas@6/+esm'),
      ]);

      const plugins = {
        text: schemasMod.text,
        image: schemasMod.image,
        table: schemasMod.table,
      };

      pdfmeModules = {
        generate: generatorMod.generate,
        plugins,
        schemas: schemasMod,
      };

      return pdfmeModules;
    } catch (err) {
      pdfmeLoadingPromise = null;
      console.error('[BudgetDocumentService] Error al cargar dependencias de @pdfme:', err);
      throw new Error('No se pudieron cargar los módulos de @pdfme. Verifique su conexión a internet.');
    }
  })();

  return pdfmeLoadingPromise;
}

/**
 * Configuración oficial predeterminada de R1 Personalizados
 */
export function getDefaultBudgetConfig() {
  return {
    basePdf: '/templates/presupuesto_base.pdf',
    caratula: {
      logo_ancho: 140,
      estilo_color: '#435A62',
      logo_url: './logo/r1.png',
    },
    pagina2: {
      cabecera_logo_visible: true,
      cabecera_logo_alto: 28,
      titulo_barra_visible: true,
      titulo_barra_texto: 'PRESUPUESTO OFICIAL',
      tamano_textos_porcentaje: 100,
      separacion_bloques_px: 20,
      foto_producto_descripcion: true,
      descuento: {
        visible: true,
        mostrar_cuadro_borde: true,
        texto: '¡10% DE DESCUENTO POR PAGO AL CONTADO!',
        color_fondo: '#FEF2F2',
        color_texto: '#DC2626',
        color_borde: '#FECACA',
      },
      terminos: {
        titulo: 'TÉRMINOS Y CONDICIONES',
        titulo_html: '<strong>TÉRMINOS Y CONDICIONES</strong>',
        posicion_vertical_px: 20,
        clausulas: [
          '1. Validez de la oferta: Este presupuesto tiene una validez de 15 días corridos a partir de su fecha de emisión.',
          '2. Condiciones de pago: El pedido se confirma con la entrega del 60%, por medio de efectivo o transferencia bancaria.',
          '3. Plazos de entrega: Tiempo estimado de 3 a 5 días hábiles posterior a la aprobación del diseño y confirmación de seña.',
          '4. Garantía y cambios: Tratándose de artículos personalizados, no se admiten cancelaciones una vez iniciada la producción.',
        ],
        clausulas_html: '<ol class="list-decimal pl-4 space-y-1"><li><strong>Validez de la oferta:</strong> Este presupuesto tiene una validez de 15 días corridos a partir de su fecha de emisión.</li><li><strong>Condiciones de pago:</strong> El pedido se confirma con la entrega del 60%, por medio de efectivo o transferencia bancaria.</li><li><strong>Plazos de entrega:</strong> Tiempo estimado de 3 a 5 días hábiles posterior a la aprobación del diseño y confirmación de seña.</li><li><strong>Garantía y cambios:</strong> Tratándose de artículos personalizados, no se admiten cancelaciones una vez iniciada la producción.</li></ol>',
      },
    },
    pagina3: {
      visible: true,
      titulo: 'FOTOS DE PRODUCTOS',
      titulo_visible: true,
      posicion_vertical_px: 20,
      posicion_horizontal_px: 0,
      separacion_fotos_px: 16,
      altura_foto_mm: 80,
      ajuste_foto: 'contain',
      columnas_por_fila: 2,
      mostrar_nombre_producto: true,
    },
    pie_pagina: {
      redes: {
        facebook: true,
        instagram: true,
        tiktok: true,
        sitio_web: true,
      },
      contacto: {
        incluir_telefonos: true,
        incluir_direccion: true,
      },
      mensaje_cierre: '¡Muchas gracias por su preferencia!',
    },
  };
}

/**
 * Resuelve basePdf: si es una URL local/remota, la descarga como Uint8Array
 */
export async function resolveBasePdf(basePdf) {
  if (!basePdf) return null;
  if (basePdf instanceof Uint8Array) return basePdf;
  if (typeof basePdf === 'object' && basePdf.width) return basePdf;

  if (typeof basePdf === 'string') {
    if (basePdf.startsWith('data:application/pdf')) {
      return basePdf;
    }
    const res = await fetch(basePdf);
    if (!res.ok) {
      throw new Error(`No se pudo obtener el PDF base desde "${basePdf}" (${res.status} ${res.statusText})`);
    }
    const arrayBuf = await res.arrayBuffer();
    return new Uint8Array(arrayBuf);
  }
  return basePdf;
}

/**
 * Resuelve y estandariza el nombre oficial del archivo PDF:
 * "Presupuesto - Nombre_del_cliente - Fecha.pdf"
 * Nombre_del_cliente: espacios reemplazados por guión bajo sin caracteres especiales.
 * Fecha: formato dd-mm-aaaa.
 */
export function getBudgetPdfFilename(budget) {
  const b = budget || {};
  let rawName = (b.cliente?.nombre || b.cliente_nombre || 'Cliente').trim();
  let cleanName = rawName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!cleanName) cleanName = 'Cliente';

  const fechaStr = String(b.fecha_emision || b.fecha || '').trim();
  let formattedFecha = '';
  const m1 = fechaStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (m1) {
    formattedFecha = `${m1[1].padStart(2, '0')}-${m1[2].padStart(2, '0')}-${m1[3]}`;
  } else {
    const m2 = fechaStr.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (m2) {
      formattedFecha = `${m2[3].padStart(2, '0')}-${m2[2].padStart(2, '0')}-${m2[1]}`;
    } else {
      const now = new Date();
      const d = String(now.getDate()).padStart(2, '0');
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const y = now.getFullYear();
      formattedFecha = `${d}-${m}-${y}`;
    }
  }

  return `Presupuesto - ${cleanName} - ${formattedFecha}.pdf`;
}

/**
 * Obtiene la configuración de formato de nombre para WhatsApp desde localStorage o valores por defecto
 */
export function getWhatsAppNameFormatConfig() {
  try {
    const raw = localStorage.getItem('r1_whatsapp_nombre_formato');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed.incluir_nombre === 'boolean' || typeof parsed.incluir_apellido === 'boolean') {
        return parsed;
      }
    }
  } catch (_) {}
  return { incluir_nombre: true, incluir_apellido: true };
}

/**
 * Resuelve el nombre del cliente según el ajuste en Configuración / WhatsApp:
 * - Solo nombre: "Justo"
 * - Solo apellido: "Ledesma"
 * - Nombre y apellido: "Justo Ledesma"
 */
export function formatClientDisplayName(fullName, nameConfig, clientDetails) {
  if (clientDetails?.tipoCliente === 'empresa' || clientDetails?.tipo_cliente === 'empresa') {
    return clientDetails.nombre || fullName || 'Cliente';
  }

  const cfg = nameConfig || getWhatsAppNameFormatConfig();
  const incNombre = cfg.incluir_nombre !== false;
  const incApellido = cfg.incluir_apellido !== false;

  let first = String(clientDetails?.nombres || '').trim();
  let last = String(clientDetails?.apellidos || '').trim();

  if (!first && !last) {
    const full = String(fullName || clientDetails?.nombre || '').trim();
    if (!full || full === 'Cliente' || full === '—') return full || 'Cliente';
    const parts = full.split(/\s+/);
    if (parts.length > 1) {
      first = parts[0];
      last = parts.slice(1).join(' ');
    } else {
      first = parts[0];
      last = '';
    }
  }

  if (incNombre && incApellido) {
    return [first, last].filter(Boolean).join(' ') || fullName || 'Cliente';
  }
  if (incNombre && !incApellido) {
    return first || fullName || 'Cliente';
  }
  if (!incNombre && incApellido) {
    return last || first || fullName || 'Cliente';
  }
  return [first, last].filter(Boolean).join(' ') || fullName || 'Cliente';
}

/**
 * Reemplaza todas las variables de un perfil de mensaje por los datos reales del presupuesto
 * Asegura que ninguna variable ({nombre}, {total}, {fecha}, etc.) llegue sin reemplazar.
 */
export function buildBudgetMessageText(templateText, budget, config, clientDisplayName) {
  const b = budget || {};
  let txt = templateText || `Hola {nombre}\nTe adjunto el {numero_presupuesto} de R1 Personalizados por un total de {total}. Validez: {validez}. ¡Aguardamos tu confirmación!`;

  const rawName = (b.cliente?.nombre || b.cliente_nombre || 'Cliente').trim();
  const clientName = clientDisplayName || formatClientDisplayName(rawName, null, b.cliente);
  const numPres = b.numero_presupuesto || 'Presupuesto';
  const totalGs = formatGs(b.totales?.total_final ?? b.total_final ?? 0);

  const fechaStr = String(b.fecha_emision || b.fecha || '').trim();
  let fechaMsg = '';
  const m1 = fechaStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (m1) {
    fechaMsg = `${m1[1].padStart(2, '0')}-${m1[2].padStart(2, '0')}-${m1[3]}`;
  } else {
    const m2 = fechaStr.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (m2) {
      fechaMsg = `${m2[3].padStart(2, '0')}-${m2[2].padStart(2, '0')}-${m2[1]}`;
    } else {
      const now = new Date();
      fechaMsg = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
    }
  }

  const validezText = b.validez_dias ? `${b.validez_dias} días` : '15 días';

  const subtotal = Number(b.totales?.subtotal ?? b.subtotal ?? 0);
  const montoDesc = Number(b.totales?.monto_descuento ?? b.monto_descuento ?? 0);
  let pct = Number(b.totales?.porcentaje_descuento ?? b.porcentaje_descuento ?? 0);
  if ((!pct || pct === 0) && subtotal > 0 && montoDesc > 0) {
    pct = (montoDesc / subtotal) * 100;
  }
  const pctStr = formatPercentage(pct);
  const descGs = formatGs(montoDesc);

  txt = txt
    .replace(/\{+\s*(?:nombre|cliente|nombre_cliente|cliente_nombre|name)\s*\}+/gi, clientName)
    .replace(/\{+\s*(?:numero_presupuesto|nro_presupuesto|presupuesto|numero)\s*\}+/gi, numPres)
    .replace(/\{+\s*(?:total|total_final|monto_total|monto)\s*\}+/gi, totalGs)
    .replace(/\{+\s*(?:fecha|fecha_emision)\s*\}+/gi, fechaMsg)
    .replace(/\{+\s*(?:validez|validez_dias)\s*\}+/gi, validezText)
    .replace(/\{+\s*(?:descuento_porcentaje|porcentaje_descuento)\s*\}+/gi, pctStr ? `${pctStr}%` : '0%')
    .replace(/\{+\s*(?:descuento_monto|monto_descuento)\s*\}+/gi, descGs)
    .replace(/\{+\s*(?:enlace_pdf|link_pdf|pdf)\s*\}+/gi, `${window.location.origin}/#/presupuestos`);

  return txt;
}

/**
 * Genera el archivo PDF físico en formato Blob y DataURL base64.
 * Prioriza el motor Chromium Headless del backend (/api/whatsapp/render-pdf) para generar
 * un documento A4 vectorial idéntico a la Vista Previa, con fallback transparente en navegador.
 */
export async function generateBudgetPDFBlob(budget, config) {
  const c = config || getDefaultBudgetConfig();
  const b = budget || {};
  const filename = getBudgetPdfFilename(b);
  const htmlContent = generateBudgetHtml(b, c);

  // 1. Motor principal: Chromium Headless en backend (resolución nativa A4, imágenes locales y vector exacto)
  try {
    const backendRes = await apiFetch('/api/whatsapp/render-pdf', {
      method: 'POST',
      body: JSON.stringify({ html: htmlContent, filename }),
    });

    if (backendRes && backendRes.dataUri && (backendRes.sizeBytes > 5000 || backendRes.dataUri.length > 5000)) {
      const commaIdx = backendRes.dataUri.indexOf(',');
      const b64 = commaIdx !== -1 ? backendRes.dataUri.substring(commaIdx + 1) : backendRes.dataUri;
      const byteChars = atob(b64);
      const byteNumbers = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteNumbers[i] = byteChars.charCodeAt(i);
      }
      const blob = new Blob([byteNumbers], { type: 'application/pdf' });
      return {
        filename,
        dataUri: backendRes.dataUri,
        blob,
        sizeBytes: blob.size,
        sizeKb: Math.max(1, Math.round(blob.size / 1024)),
      };
    }
  } catch (backendErr) {
    console.warn('[PDF] Renderizado en servidor no disponible, usando motor local en navegador:', backendErr);
  }

  // 2. Motor secundario (Fallback): Iframe aislado en navegador para preservar estilos CSS y dimensiones
  const iframe = document.createElement('iframe');
  iframe.id = 'temp-pdf-render-frame-' + Date.now();
  iframe.style.position = 'fixed';
  iframe.style.left = '0';
  iframe.style.top = '0';
  iframe.style.width = '210mm';
  iframe.style.height = '1000px';
  iframe.style.opacity = '0.01';
  iframe.style.pointerEvents = 'none';
  iframe.style.zIndex = '-9999';
  document.body.appendChild(iframe);

  try {
    const idoc = iframe.contentWindow.document;
    idoc.open();
    idoc.write(htmlContent);
    idoc.close();

    // Esperar a que imágenes y tipografías se carguen en el iframe
    await new Promise((r) => setTimeout(r, 600));

    if (!window.html2pdf) {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = './src/vendor/html2pdf.bundle.min.js';
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      });
    }

    const opt = {
      margin: 0,
      filename: filename,
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        letterRendering: true,
        logging: false,
        backgroundColor: '#ffffff',
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'legacy'] },
    };

    const worker = window.html2pdf().set(opt).from(idoc.body);
    const blob = await worker.output('blob');

    // Convertir el blob a DataURL Base64 limpio mediante FileReader nativo
    const cleanDataUri = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const res = reader.result;
        resolve(typeof res === 'string' ? res : '');
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    return {
      filename,
      dataUri: cleanDataUri,
      blob,
      sizeBytes: blob?.size || 0,
      sizeKb: Math.max(1, Math.round((blob?.size || 0) / 1024)),
    };
  } finally {
    if (iframe.parentNode) {
      iframe.parentNode.removeChild(iframe);
    }
  }
}

/**
 * Descarga directamente el archivo PDF en el navegador con el nombre estandarizado
 */
export async function downloadBudgetPDFFile(budget, config) {
  const res = await generateBudgetPDFBlob(budget, config);
  const blob = res.blob;
  const filename = res.filename;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1500);
  return res;
}

/**
 * Genera el documento del presupuesto y abre el visor o descarga en el navegador
 */
export async function generateBudgetPDF(budgetId, options = {}) {
  const { openInNewTab = true, download = false, customConfig = null } = options;
  initWorkerCorsShim();

  const id = budgetId || 'PRES-2026-0003';
  const [templateRes, budgetRes] = await Promise.all([
    customConfig ? Promise.resolve(customConfig) : apiFetch('/api/config/budget-template').catch(() => null),
    apiFetch(`/api/budgets/${encodeURIComponent(id)}`).catch(() => null),
  ]);

  if (!budgetRes) {
    throw new Error(`No se pudo obtener la información del presupuesto "${id}"`);
  }

  const config = templateRes || getDefaultBudgetConfig();

  if (download) {
    return downloadBudgetPDFFile(budgetRes, config);
  }

  // Generación nativa de alta fidelidad vector A4
  return printOrDownloadBudgetDocument(budgetRes, config, { openInNewTab, download });
}

/**
 * Renderiza el documento de presupuesto de forma limpia y directa para visualización / descarga PDF
 */
export function printOrDownloadBudgetDocument(budget, config, { openInNewTab = true, download = false } = {}) {
  const filename = getBudgetPdfFilename(budget);

  if (download) {
    return downloadBudgetPDFFile(budget, config);
  }

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(generateBudgetHtml(budget, config));
  doc.close();

  return new Promise((resolve) => {
    iframe.onload = () => {
      setTimeout(() => {
        try {
          if (!openInNewTab) {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
          } else {
            // Abrir en ventana nueva
            const win = window.open('', '_blank');
            if (win) {
              win.document.open();
              win.document.write(generateBudgetHtml(budget, config));
              win.document.close();
            } else {
              iframe.contentWindow.focus();
              iframe.contentWindow.print();
            }
          }
        } catch (_) {}
        setTimeout(() => document.body.removeChild(iframe), 1000);
        resolve({ filename });
      }, 300);
    };
  });
}

function renderDocumentFooterHtml(c, themeColor) {
  const redesList = [];
  if (c.pie_pagina?.redes?.instagram) redesList.push('instagram.com/r1personalizados');
  if (c.pie_pagina?.redes?.facebook) redesList.push('facebook.com/r1personalizados');
  if (c.pie_pagina?.redes?.tiktok) redesList.push('tiktok.com/@r1personalizados');
  if (c.pie_pagina?.redes?.sitio_web) redesList.push('netz.com.py');

  const contactoList = [];
  if (c.pie_pagina?.contacto?.incluir_telefonos) contactoList.push('+595 981 654321');
  if (c.pie_pagina?.contacto?.incluir_direccion) contactoList.push('Pdte Franco, Paraguay');

  return `
    <div class="page-footer">
      <div class="footer-close">${c.pie_pagina?.mensaje_cierre || '¡Muchas gracias por su preferencia!'}</div>
      ${redesList.length > 0 ? `<div>${redesList.join(' • ')}</div>` : ''}
      ${contactoList.length > 0 ? `<div>${contactoList.join(' • ')}</div>` : ''}
    </div>
  `;
}

/**
 * Genera el HTML/CSS A4 exacto según la configuración visual
 */
export function generateBudgetHtml(budget, config) {
  const c = config || getDefaultBudgetConfig();
  const b = budget || {};
  const cliente = b.cliente || {};
  const totales = b.totales || {};
  const items = Array.isArray(b.items) ? b.items : [];
  const fotos = Array.isArray(b.imagenes_productos) ? b.imagenes_productos : (Array.isArray(b.galeria_fotos) ? b.galeria_fotos : []);
  const serviciosOpcionales = Array.isArray(b.servicios_opcionales) ? b.servicios_opcionales : [];

  const themeColor = c.caratula?.estilo_color || '#435A62';
  const logoAncho = c.caratula?.logo_ancho || 140;
  const logoAltoP2 = c.pagina2?.cabecera_logo_alto || 28;
  const companyLogoUrl = c.caratula?.logo_url || b.empresa?.logo_url || './logo/r1.png';
  const textScale = (c.pagina2?.tamano_textos_porcentaje || 100) / 100;
  const blockGap = c.pagina2?.separacion_bloques_px || 20;

  const descConfig = c.pagina2?.descuento || {};
  const terminosCfg = c.pagina2?.terminos || {};
  const terminosPosPx = Number(terminosCfg.posicion_vertical_px ?? 20);

  // Auto-shrink si hay muchos productos para garantizar que NUNCA pase de página
  const itemsCount = items.length;
  let autoShrinkFactor = 1;
  if (itemsCount > 4) {
    autoShrinkFactor = Math.max(0.65, 1 - (itemsCount - 4) * 0.045);
  }
  const effectiveTermsScale = textScale * autoShrinkFactor;
  // Margen superior en mm entre totales y términos
  const termsMarginTopMm = Math.max(1, Math.min(65, Math.round(terminosPosPx * 0.35 * autoShrinkFactor)));

  // HTML enriquecido para título y cláusulas operativas
  const tituloTerminosHtml = terminosCfg.titulo_html || `<strong>${terminosCfg.titulo || 'TÉRMINOS Y CONDICIONES'}</strong>`;
  let clausulasHtml = terminosCfg.clausulas_html;
  if (!clausulasHtml) {
    const terminosList = Array.isArray(terminosCfg.clausulas) ? terminosCfg.clausulas : [];
    clausulasHtml = `<ol style="padding-left: 15px; margin: 0;">${terminosList.map((t) => `<li style="margin-bottom: 2px;">${t}</li>`).join('')}</ol>`;
  }

  const montoDesc = Number(totales.monto_descuento || b.monto_descuento || 0);
  const hasDiscount = montoDesc > 0;

  // Calcular porcentaje de descuento automáticamente sobre subtotal ítems + servicios
  const subtotalTotal = Number(totales.subtotal || b.subtotal || 0);
  let calcPct = Number(totales.porcentaje_descuento || b.porcentaje_descuento || 0);
  if ((!calcPct || calcPct === 0) && subtotalTotal > 0 && montoDesc > 0) {
    calcPct = (montoDesc / subtotalTotal) * 100;
  }
  const pctStr = formatPercentage(calcPct);

  // Descuento / Promoción: respetar switch visible en PDF y que el descuento sea > 0
  const showDiscountInPdf = Boolean(
    hasDiscount &&
    b.mostrar_descuento_pdf !== false &&
    totales.mostrar_descuento_pdf !== false &&
    descConfig.visible !== false
  );
  const rawDiscountText = totales.leyenda_descuento || b.leyenda_descuento || descConfig.texto || '¡{descuento_porcentaje}% DE DESCUENTO POR PAGO AL CONTADO!';
  const discountText = resolveDiscountText(rawDiscountText, pctStr, montoDesc);

  // Hoja 3: Distribución dinámica (columnas x filas) y paginación
  const showGalleryInPdf = Boolean(
    b.mostrar_galeria_pdf !== false &&
    c.pagina3?.visible !== false
  );
  const fotosVisibles = fotos.filter((f) => f.visible !== false && f.visible_pdf !== false);

  const cols = Math.max(1, Math.min(6, Number(b.galeria_cols || parseInt(b.galeria_layout?.split('x')[0]) || c.pagina3?.columnas_por_fila || 2)));
  const rows = Math.max(1, Math.min(6, Number(b.galeria_rows || parseInt(b.galeria_layout?.split('x')[1]) || 4)));
  const perPage = cols * rows;

  let galleryPagesHtml = '';
  if (showGalleryInPdf && fotosVisibles.length > 0) {
    const totalPages = Math.ceil(fotosVisibles.length / perPage);
    const photoCardHeightMm = Math.max(22, Math.floor((210 - (rows - 1) * 6) / rows));

    for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
      const pagePhotos = fotosVisibles.slice(pageIdx * perPage, (pageIdx + 1) * perPage);
      galleryPagesHtml += `
        <div class="page page-3" style="padding: 16mm 18mm 20mm 18mm; display: flex; flex-direction: column;">
          <div class="official-bar" style="${c.pagina3?.titulo_visible !== false ? '' : 'display: none;'}">
            ${c.pagina3?.titulo || 'FOTOS DE PRODUCTOS'}${totalPages > 1 ? ` (${pageIdx + 1}/${totalPages})` : ''}
          </div>
          <div class="photo-grid" style="display: grid; grid-template-columns: repeat(${cols}, 1fr); gap: 10px; margin-top: 10px; margin-bottom: auto;">
            ${pagePhotos.map((f) => `
              <div class="photo-card" style="text-align: center; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); display: flex; flex-direction: column; align-items: center; justify-content: center;">
                <img src="${f.url || './logo/r1.png'}" style="height: ${photoCardHeightMm}mm; max-height: ${photoCardHeightMm}mm; width: 100%; object-fit: contain; border-radius: 4px;" onerror="this.src='./logo/r1.png'" />
                <div class="title" style="font-size: 9px; font-weight: 600; margin-top: 4px; color: #334155; line-height: 1.2;">
                  ${f.nombre || 'Producto cotizado'}
                </div>
              </div>
            `).join('')}
          </div>
          ${renderDocumentFooterHtml(c, themeColor)}
        </div>
      `;
    }
  }

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Presupuesto Oficial ${b.numero_presupuesto || 'R1'}</title>
  <style>
    @page { size: A4 portrait; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #e2e8f0; color: #0f172a; }
    .page { width: 210mm; min-height: 297mm; height: 297mm; page-break-after: always; position: relative; background: #ffffff; overflow: hidden; margin: 0 auto; }
    
    /* PÁGINA 1: PORTADA */
    .page-1 { background: ${themeColor}; display: flex; align-items: center; justify-content: center; }
    .page-1 img { width: ${logoAncho}mm; max-width: 90%; height: auto; }

    /* PÁGINA 2: CONTENIDO */
    .page-2 { padding: 16mm 18mm 20mm 18mm; display: flex; flex-direction: column; font-size: calc(11px * ${textScale}); }
    .header-logo { text-align: center; margin-bottom: 3mm; ${c.pagina2?.cabecera_logo_visible ? '' : 'display: none;'} }
    .header-logo img { height: ${logoAltoP2}mm; max-width: 100%; }
    .official-bar { background: ${themeColor}; color: #ffffff; text-align: center; padding: 6px; font-weight: 800; letter-spacing: 2px; font-size: calc(12px * ${textScale}); border-radius: 4px; margin-bottom: ${blockGap}px; ${c.pagina2?.titulo_barra_visible ? '' : 'display: none;'} }
    
    .meta-box { border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 12px; margin-bottom: ${blockGap}px; display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; font-size: calc(10px * ${textScale}); background: #f8fafc; }
    .meta-box strong { color: #334155; }

    .items-table { width: 100%; border-collapse: collapse; margin-bottom: ${blockGap}px; font-size: calc(10.5px * ${textScale}); border: 1px solid #cbd5e1; }
    .items-table th { background: #f1f5f9; padding: 6px 8px; text-align: left; font-size: calc(9.5px * ${textScale}); font-weight: 700; color: #475569; border: 1px solid #cbd5e1; }
    .items-table td { padding: 6px 8px; border: 1px solid #cbd5e1; vertical-align: middle; }
    .items-table .text-right { text-align: right; }
    .items-table .text-center { text-align: center; }
    .item-thumb { width: 22px; height: 22px; border-radius: 3px; object-fit: cover; margin-right: 6px; vertical-align: middle; ${c.pagina2?.foto_producto_descripcion ? '' : 'display: none;'} }

    .services-table { width: 100%; border-collapse: collapse; margin-bottom: ${blockGap}px; font-size: calc(10px * ${textScale}); border: 1px solid #cbd5e1; }
    .services-table th { background: #f8fafc; padding: 5px 8px; text-align: left; font-size: calc(9px * ${textScale}); font-weight: 700; color: #475569; border: 1px solid #cbd5e1; }
    .services-table td { padding: 5px 8px; border: 1px solid #cbd5e1; vertical-align: middle; }
    .services-table .text-right { text-align: right; }
    .services-table .text-center { text-align: center; }

    .promo-box { padding: 8px 12px; text-align: center; font-weight: 800; font-size: calc(10.5px * ${textScale}); border-radius: 6px; margin-bottom: ${blockGap}px; background: ${descConfig.color_fondo || '#FEF2F2'}; color: ${descConfig.color_texto || '#DC2626'}; border: ${descConfig.mostrar_cuadro_borde ? `1px solid ${descConfig.color_borde || '#FECACA'}` : 'none'}; ${descConfig.visible ? '' : 'display: none;'} }

    .totals-area { display: flex; justify-content: flex-end; margin-bottom: ${blockGap}px; }
    .totals-box { width: 230px; font-size: calc(10.5px * ${textScale}); }
    .totals-row { display: flex; justify-content: space-between; padding: 2px 0; }
    .totals-row.grand-total { background: ${themeColor}; color: #ffffff; padding: 6px 8px; border-radius: 4px; font-weight: 800; font-size: calc(12px * ${textScale}); margin-top: 4px; }

    .terms-box {
      margin-top: ${termsMarginTopMm}mm;
      font-size: calc(8px * ${effectiveTermsScale});
      color: #334155;
      border-top: 1px solid #e2e8f0;
      padding-top: 4px;
      margin-bottom: 12mm;
      line-height: 1.3;
      max-height: calc(100% - 15mm);
      overflow: hidden;
    }
    .terms-box .terms-title, .terms-box h4 {
      font-size: calc(9px * ${effectiveTermsScale});
      font-weight: 700;
      margin-bottom: 3px;
      color: #0f172a;
    }
    .terms-box ol, .terms-box ul {
      padding-left: 15px;
      margin: 0;
    }
    .terms-box li {
      margin-bottom: 2px;
    }

    .page-footer { position: absolute; bottom: 0; left: 0; right: 0; background: ${themeColor}; color: #ffffff; padding: 6px 14mm; font-size: 8px; text-align: center; line-height: 1.4; }
    .footer-close { font-weight: 700; margin-bottom: 2px; }

    /* PÁGINA 3: FOTOS */
    .page-3 { padding: 16mm 18mm 20mm 18mm; display: flex; flex-direction: column; ${c.pagina3?.visible ? '' : 'display: none;'} }
    .photo-grid { display: grid; grid-template-columns: repeat(${c.pagina3?.columnas_por_fila || 2}, 1fr); gap: ${c.pagina3?.separacion_fotos_px || 16}px; margin-top: ${c.pagina3?.posicion_vertical_px || 20}px; margin-left: ${c.pagina3?.posicion_horizontal_px || 0}px; }
    .photo-card { text-align: center; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .photo-card img { height: ${c.pagina3?.altura_foto_mm || 80}mm; width: 100%; object-fit: ${c.pagina3?.ajuste_foto || 'contain'}; border-radius: 4px; }
    .photo-card .title { font-size: 10px; font-weight: 600; margin-top: 4px; color: #334155; ${c.pagina3?.mostrar_nombre_producto ? '' : 'display: none;'} }
  </style>
</head>
<body>
  <!-- HOJA 1: PORTADA -->
  <div class="page page-1">
    <img src="${companyLogoUrl}" alt="Logo Carátula" onerror="this.src='./logo/r1.png'" />
  </div>

  <!-- HOJA 2: PRESUPUESTO OFICIAL -->
  <div class="page page-2">
    <div class="header-logo">
      <img src="${companyLogoUrl}" alt="Logo Cabecera" onerror="this.src='./logo/r1.png'" />
    </div>
    <div class="official-bar">
      ${c.pagina2?.titulo_barra_texto || 'PRESUPUESTO OFICIAL'}
    </div>

    <div class="meta-box">
      <div><strong>CLIENTE:</strong> ${cliente.nombre || b.cliente_nombre || 'Cliente General'}</div>
      <div><strong>FECHA:</strong> ${b.fecha_emision || '24/10/2026'}</div>
      <div><strong>RUC / CI:</strong> ${(() => {
        const nd = (cliente?.numeroDocumento || cliente?.numero_documento || '').trim();
        const r = (cliente?.ruc || '').trim();
        const rb = (cliente?.rucBase || cliente?.ruc_base || '').trim();
        const cr = (b.cliente_ruc || '').trim();
        if (cliente?.tipoCliente === 'empresa' || cliente?.tipo_cliente === 'empresa') {
          return r || rb || nd || cr || '—';
        }
        return nd || r || rb || cr || '—';
      })()}</div>
      <div><strong>TELÉFONO:</strong> ${cliente.telefono || b.cliente_telefono || '+595 981 654321'}</div>
      <div><strong>VALIDEZ HASTA:</strong> ${b.validez_fecha || '08/11/2026 (15 días)'}</div>
      <div><strong>N° PRESUPUESTO:</strong> ${b.numero_presupuesto || 'PRES-2026-0003'}</div>
    </div>

    <table class="items-table">
      <thead>
        <tr>
          <th>DESCRIPCIÓN</th>
          <th class="text-right">PRECIO UNITARIO</th>
          <th class="text-center">CANT.</th>
          <th class="text-right">TOTAL</th>
        </tr>
      </thead>
      <tbody>
        ${items
          .map(
            (it) => `
          <tr>
            <td>
              <img src="${it.imagen_url || './logo/r1.png'}" class="item-thumb" onerror="this.src='./logo/r1.png'" />
              ${it.descripcion}
            </td>
            <td class="text-right">${it.precio_unitario_formateado || `${it.precio_unitario || 0} Gs.`}</td>
            <td class="text-center">${it.cantidad}</td>
            <td class="text-right font-bold">${it.total_formateado || `${it.total || 0} Gs.`}</td>
          </tr>
        `
          )
          .join('')}
      </tbody>
    </table>

    ${
      serviciosOpcionales.length > 0
        ? `
    <div style="margin-top: ${Math.round(blockGap * 0.7)}px; margin-bottom: ${blockGap}px;">
      <div style="font-size: calc(10px * ${textScale}); font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #cbd5e1; padding-bottom: 3px; margin-bottom: 4px;">
        Servicios Opcionales
      </div>
      <table class="items-table" style="margin-bottom: 0;">
        <thead>
          <tr>
            <th>DESCRIPCIÓN</th>
            <th class="text-right">PRECIO UNITARIO</th>
            <th class="text-center">CANT.</th>
            <th class="text-right">SUBTOTAL</th>
          </tr>
        </thead>
        <tbody>
          ${serviciosOpcionales
            .map(
              (s) => `
            <tr>
              <td>${s.descripcion || s.nombre || 'Servicio Opcional'}</td>
              <td class="text-right">${s.precio_unitario_formateado || (s.precio_unitario ? s.precio_unitario + ' Gs.' : '0 Gs.')}</td>
              <td class="text-center">${s.cantidad || 1}</td>
              <td class="text-right font-bold">${s.subtotal_formateado || (s.subtotal ? s.subtotal + ' Gs.' : '0 Gs.')}</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    </div>
    `
        : ''
    }

    ${
      showDiscountInPdf
        ? `
    <div class="promo-box">
      ${discountText}
    </div>
    `
        : ''
    }

    <div class="totals-area">
      <div class="totals-box">
        <div class="totals-row">
          <span>Subtotal:</span>
          <span>${totales.subtotal_formateado || (totales.subtotal ? totales.subtotal + ' Gs.' : '0 Gs.')}</span>
        </div>
        ${
          hasDiscount
            ? `
        <div class="totals-row" style="color: #dc2626;">
          <span>Descuento (${pctStr}%):</span>
          <span>${totales.monto_descuento_formateado || ('- ' + formatGs(montoDesc))}</span>
        </div>
        `
            : ''
        }
        <div class="totals-row grand-total">
          <span>${hasDiscount ? 'TOTAL CON DESC.:' : 'TOTAL FINAL:'}</span>
          <span>${totales.total_final_formateado || (totales.total_final ? totales.total_final + ' Gs.' : '0 Gs.')}</span>
        </div>
      </div>
    </div>

    <div class="terms-box">
      <div class="terms-title">${tituloTerminosHtml}</div>
      <div class="terms-content">${clausulasHtml}</div>
    </div>

    ${renderDocumentFooterHtml(c, themeColor)}
  </div>

  <!-- HOJA 3: FOTOS DE PRODUCTOS (Distribución dinámica cols x rows con paginación) -->
  ${galleryPagesHtml}
</body>
</html>
  `;
}

/**
 * Abre un modal redimensionable y maximizable en la misma pantalla con la vista previa del PDF
 */
export function openInteractivePDFPreviewModal({ budget, config, onStatusChange = null }) {
  const c = config || getDefaultBudgetConfig();
  const b = budget || {};
  const numPresupuesto = b.numero_presupuesto || 'R1';
  const htmlContent = generateBudgetHtml(b, c);

  // Overlay oscuro
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-2 sm:p-4 select-none';

  // Contenedor modal redimensionable
  const dialog = document.createElement('div');
  dialog.className = 'relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden transition-all duration-150';
  dialog.style.width = '92vw';
  dialog.style.height = '90vh';
  dialog.style.maxWidth = '1300px';
  dialog.style.maxHeight = '94vh';
  dialog.style.minWidth = '360px';
  dialog.style.minHeight = '420px';
  dialog.style.resize = 'both';

  // Cabecera del modal
  const header = document.createElement('div');
  header.className = 'flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-800 shrink-0 bg-slate-50/80 dark:bg-slate-900/80';
  header.innerHTML = `
    <div class="flex items-center gap-2.5 min-w-0">
      <span class="w-8 h-8 rounded-lg bg-brand-soft text-brand flex items-center justify-center text-sm font-bold">
        <i class="fa-regular fa-file-pdf"></i>
      </span>
      <div>
        <h2 class="text-sm font-bold text-slate-900 dark:text-white truncate">Vista Previa del Presupuesto — ${escapeHtml(numPresupuesto)}</h2>
        <p class="text-[10px] text-slate-400">Documento Oficial A4 · Listo para imprimir o descargar</p>
      </div>
    </div>
    <div class="flex items-center gap-1.5 shrink-0">
      <button type="button" class="btn-pdf-print px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer">
        <i class="fa-solid fa-print"></i>
        <span class="hidden sm:inline">Imprimir</span>
      </button>
      <button type="button" class="btn-pdf-download px-3 py-1.5 rounded-xl bg-brand hover:bg-brand-hover text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer">
        <i class="fa-solid fa-download"></i>
        <span class="hidden sm:inline">Descargar PDF</span>
      </button>
      <button type="button" class="btn-pdf-maximize w-8 h-8 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center justify-center cursor-pointer" title="Maximizar / Restaurar">
        <i class="fa-solid fa-expand text-xs"></i>
      </button>
      <button type="button" class="btn-pdf-close w-8 h-8 rounded-xl text-slate-400 hover:text-danger hover:bg-red-50 dark:hover:bg-red-950/40 transition flex items-center justify-center cursor-pointer" title="Cerrar vista previa">
        <i class="fa-solid fa-xmark text-sm"></i>
      </button>
    </div>
  `;

  // Cuerpo con iframe responsive
  const body = document.createElement('div');
  body.className = 'flex-1 w-full h-full overflow-hidden bg-slate-200 dark:bg-slate-950 p-2 sm:p-4 flex items-center justify-center';

  const iframe = document.createElement('iframe');
  iframe.className = 'w-full h-full rounded-xl border border-slate-300 dark:border-slate-800 shadow-inner bg-white';
  iframe.setAttribute('title', `Vista Previa ${numPresupuesto}`);
  body.appendChild(iframe);

  dialog.appendChild(header);
  dialog.appendChild(body);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  // Escribir HTML al iframe
  const idoc = iframe.contentWindow.document;
  idoc.open();
  idoc.write(htmlContent);
  idoc.close();

  let isMax = false;
  const originalWidth = dialog.style.width;
  const originalHeight = dialog.style.height;

  function toggleMaximize() {
    isMax = !isMax;
    const icon = header.querySelector('.btn-pdf-maximize i');
    if (isMax) {
      dialog.style.width = '99vw';
      dialog.style.height = '98vh';
      dialog.style.maxWidth = '100vw';
      dialog.style.maxHeight = '100vh';
      if (icon) icon.className = 'fa-solid fa-compress text-xs';
    } else {
      dialog.style.width = originalWidth;
      dialog.style.height = originalHeight;
      dialog.style.maxWidth = '1300px';
      dialog.style.maxHeight = '94vh';
      if (icon) icon.className = 'fa-solid fa-expand text-xs';
    }
  }

  function closeModal() {
    document.removeEventListener('keydown', handleKey);
    overlay.remove();
  }

  function handleKey(e) {
    if (e.key === 'Escape') closeModal();
  }
  document.addEventListener('keydown', handleKey);

  header.querySelector('.btn-pdf-maximize').addEventListener('click', toggleMaximize);
  header.querySelector('.btn-pdf-close').addEventListener('click', closeModal);
  header.querySelector('.btn-pdf-print').addEventListener('click', () => {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
  });
  header.querySelector('.btn-pdf-download').addEventListener('click', async () => {
    const btn = header.querySelector('.btn-pdf-download');
    const prevHtml = btn.innerHTML;
    try {
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span class="hidden sm:inline">Generando PDF...</span>';
      await downloadBudgetPDFFile(b, c);
      btn.innerHTML = '<i class="fa-solid fa-check"></i> <span class="hidden sm:inline">Descargado</span>';
      setTimeout(() => {
        btn.disabled = false;
        btn.innerHTML = prevHtml;
      }, 2000);
    } catch (err) {
      console.warn('[PDF Preview] Descarga con fallback a print:', err);
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      btn.disabled = false;
      btn.innerHTML = prevHtml;
    }
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatGs(val) {
  const num = Math.round(Number(val) || 0);
  const str = String(num);
  let res = '';
  const len = str.length;
  for (let i = 0; i < len; i++) {
    if (i > 0 && (len - i) % 3 === 0) res += '.';
    res += str[i];
  }
  return res + ' Gs.';
}

export function formatPercentage(val) {
  const p = Number(val) || 0;
  if (p <= 0) return '0';
  const rounded = Math.round(p * 100) / 100;
  if (Math.abs(rounded - Math.round(rounded)) < 0.001) {
    return String(Math.round(rounded));
  }
  return rounded.toFixed(2).replace('.', ',');
}

export function resolveDiscountText(rawText, pctString, montoGs) {
  let t = rawText || '¡{descuento_porcentaje}% DE DESCUENTO POR PAGO AL CONTADO!';
  t = t.replace(/\{descuento_porcentaje\}/g, pctString);
  t = t.replace(/\{porcentaje\}/g, pctString);
  t = t.replace(/\{descuento_monto\}/g, formatGs(montoGs));
  t = t.replace(/\{monto\}/g, formatGs(montoGs));
  return t;
}

export const BudgetDocumentService = {
  initWorkerCorsShim,
  loadPdfmeLibraries,
  generateBudgetPDF,
  getDefaultBudgetConfig,
  printOrDownloadBudgetDocument,
  generateBudgetHtml,
  openInteractivePDFPreviewModal,
  formatPercentage,
  resolveDiscountText,
  getBudgetPdfFilename,
  getWhatsAppNameFormatConfig,
  formatClientDisplayName,
  buildBudgetMessageText,
  generateBudgetPDFBlob,
  downloadBudgetPDFFile,
};

export default BudgetDocumentService;
