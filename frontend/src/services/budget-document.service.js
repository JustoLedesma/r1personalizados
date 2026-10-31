/**
 * BudgetDocumentService — Servicio centralizado de generación y exportación de presupuestos con @pdfme
 * Arquitectura 100% Client-Side: renderizado instantáneo en el navegador del usuario.
 */

import { apiFetch } from './api.js';

let pdfmeModules = null;
let pdfmeLoadingPromise = null;

/**
 * Carga perezosa y concurrente de las librerías @pdfme (generator, schemas, ui) desde CDN
 */
export async function loadPdfmeLibraries() {
  if (pdfmeModules) return pdfmeModules;
  if (pdfmeLoadingPromise) return pdfmeLoadingPromise;

  pdfmeLoadingPromise = (async () => {
    try {
      const [generatorMod, schemasMod, uiMod] = await Promise.all([
        import('https://cdn.jsdelivr.net/npm/@pdfme/generator@6/+esm'),
        import('https://cdn.jsdelivr.net/npm/@pdfme/schemas@6/+esm'),
        import('https://cdn.jsdelivr.net/npm/@pdfme/ui@6/+esm'),
      ]);

      const plugins = {
        text: schemasMod.text,
        image: schemasMod.image,
        table: schemasMod.table,
      };

      pdfmeModules = {
        generate: generatorMod.generate,
        Designer: uiMod.Designer,
        plugins,
        schemas: schemasMod,
      };

      return pdfmeModules;
    } catch (err) {
      pdfmeLoadingPromise = null;
      console.error('[BudgetDocumentService] Error al cargar dependencias de @pdfme:', err);
      throw new Error(
        'No se pudieron cargar los módulos de @pdfme. Verifique su conexión a internet para descargar las librerías.'
      );
    }
  })();

  return pdfmeLoadingPromise;
}

/**
 * Resuelve basePdf: si es una URL local/remota, la descarga como Uint8Array para pdfme
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
 * Convierte una imagen a Data URL Base64 para garantizar su inclusión offline en el documento
 */
async function toDataUrl(url) {
  if (!url || typeof url !== 'string') return '';
  if (url.startsWith('data:image/')) return url;
  try {
    const res = await fetch(url);
    if (!res.ok) return url;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve(url);
      reader.readAsDataURL(blob);
    });
  } catch (_) {
    return url;
  }
}

/**
 * Mapea la respuesta del presupuesto al formato exacto de inputs que espera el template de pdfme
 */
export async function mapBudgetToPdfmeInputs(budgetData, template) {
  const b = budgetData || {};
  const cliente = b.cliente || {};
  const totales = b.totales || {};
  const items = Array.isArray(b.items) ? b.items : [];
  const terminos = Array.isArray(b.terminos_condiciones)
    ? b.terminos_condiciones.join('\n')
    : b.terminos_condiciones || '';

  // Formato de tabla de artículos para el schema 'table' de @pdfme
  const tableRows = [
    ['DESCRIPCIÓN', 'PRECIO UNITARIO', 'CANT.', 'TOTAL'],
    ...items.map((it) => [
      it.descripcion || 'Artículo',
      it.precio_unitario_formateado || `${it.precio_unitario || 0} Gs.`,
      String(it.cantidad || 1),
      it.total_formateado || `${it.total || 0} Gs.`,
    ]),
  ];

  // Datos base compartidos entre páginas
  const pageInputs = {
    // 1. Cabecera y Cliente
    cliente_nombre: cliente.nombre || b.cliente_nombre || 'Cliente General',
    cliente_ruc: cliente.ruc || b.cliente_ruc || 'Sin RUC',
    cliente_telefono: cliente.telefono || b.cliente_telefono || '',
    fecha_emision: b.fecha_emision || new Date().toLocaleDateString('es-PY'),
    validez_dias: `${b.validez_dias || 15} días`,
    validez_fecha: b.validez_fecha || `${b.validez_dias || 15} días corridos`,
    numero_presupuesto: b.numero_presupuesto || 'PRES-2026-0001',

    // 2. Tabla de Artículos
    articulos_tabla: JSON.stringify(tableRows),

    // 3. Totales y Descuentos
    subtotal: totales.subtotal_formateado || `${totales.subtotal || 0} Gs.`,
    porcentaje_descuento: `${totales.porcentaje_descuento || 0}%`,
    monto_descuento: totales.monto_descuento_formateado || `0 Gs.`,
    total_final: totales.total_final_formateado || `${totales.total_final || 0} Gs.`,

    // 4. Términos y Condiciones
    terminos_condiciones: terminos,

    // 5. Datos Institucionales (heredados de la empresa)
    empresa_logo: b.empresa?.logo_url || '/logo/R1.png',
    empresa_redes:
      'instagram.com/r1personalizados • facebook.com/r1personalizados • tiktok.com/@r1personalizados • netz.com.py',
    empresa_telefono: '+595 981 654321',
    empresa_locacion: 'Pdte Franco, Paraguay',
  };

  // 6. Hoja de Fotos de Productos (si hay imágenes)
  const imagenes = Array.isArray(b.imagenes_productos)
    ? b.imagenes_productos
    : items.filter((it) => it.imagen_url).map((it) => ({ nombre: it.descripcion, url: it.imagen_url }));

  for (let i = 0; i < 6; i++) {
    const key = `foto_producto_${i + 1}`;
    if (imagenes[i]?.url) {
      pageInputs[key] = await toDataUrl(imagenes[i].url);
    } else {
      pageInputs[key] = '';
    }
  }

  // Si el template tiene múltiples hojas, pdfme espera un array de inputs (uno por copia)
  // Cada objeto cubre los campos de todas las páginas
  return [pageInputs];
}

/**
 * Función principal: Genera el PDF del presupuesto en memoria con @pdfme/generator
 * @param {string|number} budgetId ID o número de presupuesto (ej: 3 o 'PRES-2026-0003')
 * @param {Object} options Opciones de visualización o descarga
 * @returns {Promise<{ blob: Blob, blobUrl: string, filename: string }>}
 */
export async function generateBudgetPDF(budgetId, options = {}) {
  const { openInNewTab = true, download = false } = options;

  // 1. Cargar dependencias de @pdfme
  const { generate, plugins } = await loadPdfmeLibraries();

  // 2. Petición paralela: Plantilla activa y Datos del presupuesto
  const id = budgetId || 'PRES-2026-0003';
  const [templateRes, budgetRes] = await Promise.all([
    apiFetch('/api/config/budget-template').catch(() => null),
    apiFetch(`/api/budgets/${encodeURIComponent(id)}`).catch(() => null),
  ]);

  if (!budgetRes) {
    throw new Error(`No se pudo obtener la información del presupuesto "${id}"`);
  }

  const template = templateRes || (await getDefaultBudgetTemplate());

  // 3. Resolver basePdf a binario si es ruta
  const resolvedBasePdf = await resolveBasePdf(template.basePdf);
  const runtimeTemplate = {
    ...template,
    basePdf: resolvedBasePdf,
  };

  // 4. Mapear datos a inputs de pdfme
  const inputs = await mapBudgetToPdfmeInputs(budgetRes, runtimeTemplate);

  // 5. Ejecutar generación client-side en memoria con @pdfme/generator
  const pdfUint8Array = await generate({
    template: runtimeTemplate,
    inputs,
    plugins,
  });

  // 6. Convertir Uint8Array a Blob y Blob URL
  const blob = new Blob([pdfUint8Array], { type: 'application/pdf' });
  const blobUrl = URL.createObjectURL(blob);
  const filename = `Presupuesto-${budgetRes.numero_presupuesto || id}.pdf`;

  // 7. Descargar o abrir en pestaña nueva
  if (download) {
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
    }, 150);
  } else if (openInNewTab) {
    window.open(blobUrl, '_blank');
  }

  return { blob, blobUrl, filename, budget: budgetRes };
}

/**
 * Plantilla predeterminada de fallback si la API no estuviera disponible
 */
export async function getDefaultBudgetTemplate() {
  return {
    basePdf: '/templates/presupuesto_base.pdf',
    pageSize: 'A4',
    orientation: 'portrait',
    schemas: [
      [],
      [
        {
          name: 'cliente_nombre',
          type: 'text',
          position: { x: 33, y: 42 },
          width: 65,
          height: 5,
          fontSize: 9,
          fontColor: '#0f172a',
        },
        {
          name: 'cliente_ruc',
          type: 'text',
          position: { x: 33, y: 47 },
          width: 65,
          height: 5,
          fontSize: 9,
          fontColor: '#0f172a',
        },
        {
          name: 'validez_fecha',
          type: 'text',
          position: { x: 38, y: 52 },
          width: 65,
          height: 5,
          fontSize: 9,
          fontColor: '#0f172a',
        },
        {
          name: 'fecha_emision',
          type: 'text',
          position: { x: 128, y: 42 },
          width: 55,
          height: 5,
          fontSize: 9,
          fontColor: '#0f172a',
        },
        {
          name: 'cliente_telefono',
          type: 'text',
          position: { x: 128, y: 47 },
          width: 55,
          height: 5,
          fontSize: 9,
          fontColor: '#0f172a',
        },
        {
          name: 'numero_presupuesto',
          type: 'text',
          position: { x: 138, y: 52 },
          width: 50,
          height: 5,
          fontSize: 9,
          fontColor: '#0f172a',
        },
        {
          name: 'articulos_tabla',
          type: 'table',
          position: { x: 20, y: 62 },
          width: 170,
          height: 50,
        },
        {
          name: 'subtotal',
          type: 'text',
          position: { x: 145, y: 120 },
          width: 45,
          height: 5,
          fontSize: 9,
          alignment: 'right',
          fontColor: '#0f172a',
        },
        {
          name: 'monto_descuento',
          type: 'text',
          position: { x: 145, y: 125 },
          width: 45,
          height: 5,
          fontSize: 9,
          alignment: 'right',
          fontColor: '#dc2626',
        },
        {
          name: 'total_final',
          type: 'text',
          position: { x: 140, y: 132 },
          width: 50,
          height: 8,
          fontSize: 11,
          alignment: 'right',
          fontColor: '#ffffff',
        },
        {
          name: 'terminos_condiciones',
          type: 'text',
          position: { x: 20, y: 230 },
          width: 170,
          height: 30,
          fontSize: 7.5,
          lineHeight: 1.25,
          fontColor: '#334155',
        },
      ],
      [
        {
          name: 'foto_producto_1',
          type: 'image',
          position: { x: 30, y: 35 },
          width: 65,
          height: 55,
        },
        {
          name: 'foto_producto_2',
          type: 'image',
          position: { x: 115, y: 35 },
          width: 65,
          height: 55,
        },
        {
          name: 'foto_producto_3',
          type: 'image',
          position: { x: 30, y: 105 },
          width: 65,
          height: 55,
        },
        {
          name: 'foto_producto_4',
          type: 'image',
          position: { x: 115, y: 105 },
          width: 65,
          height: 55,
        },
        {
          name: 'foto_producto_5',
          type: 'image',
          position: { x: 30, y: 175 },
          width: 65,
          height: 55,
        },
      ],
    ],
  };
}

export const BudgetDocumentService = {
  loadPdfmeLibraries,
  generateBudgetPDF,
  mapBudgetToPdfmeInputs,
  resolveBasePdf,
  getDefaultBudgetTemplate,
};

export default BudgetDocumentService;

