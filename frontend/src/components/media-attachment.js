import { createButton } from './button.js';
import { openModal } from './modal.js';
import { toast } from './toast.js';

const DIRECT_IMAGE_FORMATS = ['png', 'jpg', 'jpeg', 'ico', 'webp'];

function getFileExtension(filename) {
  const parts = String(filename || '').toLowerCase().split('.');
  return parts.length > 1 ? parts.pop() : '';
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('No se pudo leer el archivo seleccionado.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Comprime imágenes a WebP (o reduce su peso si no está en png/jpg/ico/webp o si supera 800KB)
 * manteniendo alta calidad visual (AGENTS.md línea 27).
 */
async function processImageFile(file) {
  const ext = getFileExtension(file.name);
  const isStandardAllowed = DIRECT_IMAGE_FORMATS.includes(ext);
  const rawDataUrl = await readFileAsDataURL(file);

  // Si no es png, jpg, ico, webp (ej: bmp, gif, tiff, avif, heic) o si pesa más de 600 KB (salvo ico),
  // convertimos/comprimimos a WebP sin pérdida perceptible de calidad.
  const shouldConvertToWebp = !isStandardAllowed || (ext !== 'ico' && file.size > 600 * 1024);

  if (!shouldConvertToWebp) {
    const displayFormat = ext === 'jpeg' ? 'JPG' : ext.toUpperCase();
    return {
      nombre: file.name,
      formato: displayFormat || 'PNG',
      mime: file.type || `image/${ext}`,
      data: rawDataUrl,
    };
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const maxDim = 1600;
        let width = img.naturalWidth || img.width || 800;
        let height = img.naturalHeight || img.height || 600;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const webpDataUrl = canvas.toDataURL('image/webp', 0.88);
        const baseName = file.name.replace(/\.[^.]+$/, '');
        const finalName = !isStandardAllowed ? `${baseName}.webp` : file.name;
        const finalFormat = !isStandardAllowed ? 'WEBP' : (ext === 'jpeg' ? 'JPG' : ext.toUpperCase());
        resolve({
          nombre: finalName,
          formato: finalFormat,
          mime: 'image/webp',
          data: webpDataUrl,
        });
      } catch (_) {
        resolve({
          nombre: file.name,
          formato: (ext || 'WEBP').toUpperCase(),
          mime: file.type || 'image/webp',
          data: rawDataUrl,
        });
      }
    };
    img.onerror = () => {
      resolve({
        nombre: file.name,
        formato: (ext || 'WEBP').toUpperCase(),
        mime: file.type || 'image/webp',
        data: rawDataUrl,
      });
    };
    img.src = rawDataUrl;
  });
}

/**
 * Abre una ventana modal con Zoom interactivo para ver la imagen en grande,
 * mostrando debajo el formato y el nombre de la foto (AGENTS.md línea 27).
 */
export function openImageZoomModal({ src, nombre = 'imagen.webp', formato = 'WEBP' } = {}) {
  let zoomLevel = 1;

  const wrapper = document.createElement('div');
  wrapper.className = 'flex flex-col items-center gap-4';

  const controls = document.createElement('div');
  controls.className =
    'inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700';

  const zoomOutBtn = createButton({
    icon: 'fa-solid fa-magnifying-glass-minus',
    variant: 'ghost',
    size: 'sm',
    ariaLabel: 'Alejar imagen',
    onClick: () => {
      zoomLevel = Math.max(0.5, Number((zoomLevel - 0.25).toFixed(2)));
      applyZoom();
    },
  });

  const zoomBadge = document.createElement('span');
  zoomBadge.className = 'text-xs font-bold text-slate-700 dark:text-slate-200 min-w-[52px] text-center';
  zoomBadge.textContent = '100%';

  const zoomInBtn = createButton({
    icon: 'fa-solid fa-magnifying-glass-plus',
    variant: 'ghost',
    size: 'sm',
    ariaLabel: 'Acercar imagen',
    onClick: () => {
      zoomLevel = Math.min(3, Number((zoomLevel + 0.25).toFixed(2)));
      applyZoom();
    },
  });

  const resetBtn = createButton({
    text: 'Restablecer',
    variant: 'cancel',
    size: 'sm',
    onClick: () => {
      zoomLevel = 1;
      applyZoom();
    },
  });

  controls.append(zoomOutBtn, zoomBadge, zoomInBtn, resetBtn);

  const stage = document.createElement('div');
  stage.className =
    'w-full max-h-[65vh] overflow-auto rounded-xl bg-slate-950/90 border border-slate-800 p-4 flex items-center justify-center';

  const imgEl = document.createElement('img');
  imgEl.src = src;
  imgEl.alt = nombre;
  imgEl.className =
    'max-h-[58vh] w-auto object-contain rounded-lg transition-transform duration-200 cursor-zoom-in select-none';

  function applyZoom() {
    zoomBadge.textContent = `${Math.round(zoomLevel * 100)}%`;
    imgEl.style.transform = `scale(${zoomLevel})`;
    imgEl.className = `max-h-[58vh] w-auto object-contain rounded-lg transition-transform duration-200 select-none ${
      zoomLevel > 1 ? 'cursor-zoom-out' : 'cursor-zoom-in'
    }`;
  }

  imgEl.addEventListener('click', () => {
    zoomLevel = zoomLevel === 1 ? 1.75 : 1;
    applyZoom();
  });

  stage.appendChild(imgEl);

  const metaFooter = document.createElement('div');
  metaFooter.className =
    'w-full flex flex-wrap items-center justify-center gap-3 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700 text-xs';
  metaFooter.innerHTML = `
    <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-brand-soft dark:bg-brand/20 text-brand font-bold uppercase">
      <i class="fa-regular fa-image"></i>
      Formato: ${formato || 'WEBP'}
    </span>
    <span class="font-semibold text-slate-700 dark:text-slate-200 break-all">
      Nombre: ${nombre || 'imagen'}
    </span>
  `;

  wrapper.append(controls, stage, metaFooter);

  openModal({
    title: 'Vista Previa y Zoom de Imagen',
    content: wrapper,
    size: 'xl',
    confirmText: 'Cerrar',
    cancelText: 'Volver',
  });
}

/**
 * Renderiza una tarjeta de vista previa en miniatura para Imagen (con zoom al hacer clic,
 * formato y nombre debajo), Video o PDF.
 */
export function renderMediaPreviewCard(attachment, { onRemove = null, compact = false } = {}) {
  if (!attachment || !attachment.data) return null;

  const mime = String(attachment.mime || '').toLowerCase();
  const formato = String(attachment.formato || getFileExtension(attachment.nombre) || 'ARCHIVO').toUpperCase();
  const nombre = attachment.nombre || 'archivo_adjunto';
  const isImage =
    mime.startsWith('image/') || ['PNG', 'JPG', 'JPEG', 'ICO', 'WEBP', 'GIF'].includes(formato);
  const isVideo = mime.startsWith('video/') || ['MP4', 'WEBM', 'MOV'].includes(formato);
  const isPdf = mime === 'application/pdf' || formato === 'PDF';

  const card = document.createElement('div');
  card.className = `inline-flex flex-col rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden shadow-xs ${
    compact ? 'max-w-[220px]' : 'max-w-[280px]'
  }`;

  const previewArea = document.createElement('div');
  previewArea.className =
    'relative bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden';

  if (isImage) {
    const thumbBtn = document.createElement('button');
    thumbBtn.type = 'button';
    thumbBtn.title = 'Haz clic sobre la foto para hacer Zoom y abrir en grande';
    thumbBtn.className = 'group relative w-full h-36 flex items-center justify-center cursor-zoom-in overflow-hidden';

    const img = document.createElement('img');
    img.src = attachment.data;
    img.alt = nombre;
    img.className = 'w-full h-36 object-cover group-hover:scale-105 transition-transform duration-200';

    const zoomOverlay = document.createElement('span');
    zoomOverlay.className =
      'absolute inset-0 bg-slate-950/35 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold gap-1.5';
    zoomOverlay.innerHTML = `<i class="fa-solid fa-magnifying-glass-plus"></i><span>Ver con Zoom</span>`;

    thumbBtn.append(img, zoomOverlay);
    thumbBtn.addEventListener('click', () =>
      openImageZoomModal({
        src: attachment.data,
        nombre,
        formato,
      })
    );
    previewArea.appendChild(thumbBtn);
  } else if (isVideo) {
    const video = document.createElement('video');
    video.src = attachment.data;
    video.controls = true;
    video.className = 'w-full h-36 object-cover bg-slate-950';
    previewArea.appendChild(video);
  } else if (isPdf) {
    const pdfBox = document.createElement('div');
    pdfBox.className = 'w-full h-28 px-4 flex flex-col items-center justify-center gap-2 text-center';
    pdfBox.innerHTML = `
      <i class="fa-regular fa-file-pdf text-3xl text-red-500"></i>
      <a href="${attachment.data}" target="_blank" rel="noopener noreferrer" class="text-xs font-semibold text-brand hover:underline inline-flex items-center gap-1">
        <i class="fa-solid fa-up-right-from-square text-[10px]"></i>
        <span>Abrir vista previa PDF</span>
      </a>
    `;
    previewArea.appendChild(pdfBox);
  } else {
    const fileBox = document.createElement('div');
    fileBox.className = 'w-full h-24 px-4 flex flex-col items-center justify-center gap-1.5';
    fileBox.innerHTML = `<i class="fa-regular fa-file text-2xl text-brand"></i>`;
    previewArea.appendChild(fileBox);
  }

  if (typeof onRemove === 'function') {
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.title = 'Quitar archivo adjunto';
    removeBtn.setAttribute('aria-label', 'Quitar archivo adjunto');
    removeBtn.className =
      'absolute top-2 right-2 w-6 h-6 rounded-full bg-danger text-white flex items-center justify-center shadow-md hover:bg-danger-hover cursor-pointer z-10';
    removeBtn.innerHTML = '<i class="fa-solid fa-xmark text-xs"></i>';
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      onRemove();
    });
    previewArea.appendChild(removeBtn);
  }

  // Pie obligatorio debajo de la foto/archivo: Formato y Nombre (AGENTS.md línea 27)
  const caption = document.createElement('div');
  caption.className =
    'px-3 py-2 bg-slate-50 dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800 space-y-0.5';
  caption.innerHTML = `
    <div class="flex items-center justify-between gap-2">
      <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-brand-soft dark:bg-brand/20 text-brand text-[10px] font-bold uppercase">
        ${formato}
      </span>
      ${isImage ? '<span class="text-[10px] text-slate-400"><i class="fa-solid fa-magnifying-glass-plus mr-0.5"></i>Click para zoom</span>' : ''}
    </div>
    <p class="text-[11px] font-semibold text-slate-700 dark:text-slate-200 truncate" title="${nombre}">
      ${nombre}
    </p>
  `;

  card.append(previewArea, caption);
  return card;
}

/**
 * Selector reutilizable para adjuntar Imagen (png, jpg, ico, webp o compresión automática a webp),
 * Video (mp4, webm, mov) o Documento PDF.
 */
export function createMediaAttachmentInput({
  label = 'Adjuntar Archivo (Imagen, Video o PDF — Opcional)',
  allowUrlInput = false,
  initialValue = null,
  onChange = null,
} = {}) {
  let currentAttachment = initialValue || null;

  const container = document.createElement('div');
  container.className = 'space-y-2.5';

  const headerRow = document.createElement('div');
  headerRow.className = 'flex flex-wrap items-center justify-between gap-2';
  headerRow.innerHTML = `
    <label class="block text-xs font-semibold text-slate-700 dark:text-slate-200">
      ${label}
    </label>
    <span class="text-[11px] text-slate-400 dark:text-slate-500">
      Formatos: PNG, JPG, ICO, WEBP (auto-compresión), MP4, PDF
    </span>
  `;
  container.appendChild(headerRow);

  const controlsRow = document.createElement('div');
  controlsRow.className = 'flex flex-wrap items-center gap-2.5';

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*,video/mp4,video/webm,video/quicktime,application/pdf,.ico';
  fileInput.className = 'hidden';

  const uploadBtn = createButton({
    text: 'Seleccionar Imagen, Video o PDF',
    icon: 'fa-solid fa-paperclip',
    variant: 'primary',
    size: 'sm',
    onClick: () => fileInput.click(),
  });

  controlsRow.append(fileInput, uploadBtn);

  if (allowUrlInput) {
    const urlInput = document.createElement('input');
    urlInput.type = 'url';
    urlInput.placeholder = 'O pega una URL: https://ejemplo.com/archivo.jpg';
    urlInput.className =
      'flex-1 min-w-[220px] min-h-[36px] px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand';
    urlInput.addEventListener('change', () => {
      const val = urlInput.value.trim();
      if (!val) return;
      const ext = (getFileExtension(val.split('?')[0]) || 'JPG').toUpperCase();
      const name = val.split('/').pop()?.split('?')[0] || `archivo.${ext.toLowerCase()}`;
      const isPdf = ext === 'PDF';
      const isVideo = ['MP4', 'WEBM', 'MOV'].includes(ext);
      currentAttachment = {
        nombre: name,
        formato: ext,
        mime: isPdf ? 'application/pdf' : isVideo ? `video/${ext.toLowerCase()}` : 'image/webp',
        data: val,
      };
      renderPreviewHolder();
      if (typeof onChange === 'function') onChange(currentAttachment);
    });
    controlsRow.appendChild(urlInput);
  }

  container.appendChild(controlsRow);

  const previewHolder = document.createElement('div');
  previewHolder.className = 'pt-1';
  container.appendChild(previewHolder);

  function renderPreviewHolder() {
    previewHolder.innerHTML = '';
    if (!currentAttachment || !currentAttachment.data) return;
    const card = renderMediaPreviewCard(currentAttachment, {
      onRemove: () => {
        currentAttachment = null;
        fileInput.value = '';
        renderPreviewHolder();
        if (typeof onChange === 'function') onChange(null);
      },
    });
    if (card) previewHolder.appendChild(card);
  }

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    try {
      const mime = (file.type || '').toLowerCase();
      const ext = getFileExtension(file.name);

      if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'ico', 'webp', 'bmp', 'gif', 'avif'].includes(ext)) {
        currentAttachment = await processImageFile(file);
        toast.info(`Imagen lista (${currentAttachment.formato} · ${currentAttachment.nombre})`);
      } else if (mime.startsWith('video/') || ['mp4', 'webm', 'mov'].includes(ext)) {
        if (file.size > 15 * 1024 * 1024) {
          toast.warning('El video supera los 15 MB recomendados.');
          return;
        }
        const dataUrl = await readFileAsDataURL(file);
        currentAttachment = {
          nombre: file.name,
          formato: (ext || 'MP4').toUpperCase(),
          mime: file.type || 'video/mp4',
          data: dataUrl,
        };
        toast.info(`Video adjuntado (${currentAttachment.formato})`);
      } else if (mime === 'application/pdf' || ext === 'pdf') {
        if (file.size > 12 * 1024 * 1024) {
          toast.warning('El archivo PDF supera los 12 MB recomendados.');
          return;
        }
        const dataUrl = await readFileAsDataURL(file);
        currentAttachment = {
          nombre: file.name,
          formato: 'PDF',
          mime: 'application/pdf',
          data: dataUrl,
        };
        toast.info(`Documento PDF adjuntado (${currentAttachment.nombre})`);
      } else {
        toast.warning('Formato no soportado. Selecciona una Imagen, Video o PDF.');
        return;
      }

      renderPreviewHolder();
      if (typeof onChange === 'function') onChange(currentAttachment);
    } catch (err) {
      toast.error(err.message || 'Error al procesar el archivo adjunto.');
    }
  });

  renderPreviewHolder();

  return {
    element: container,
    getValue: () => currentAttachment,
    clear: () => {
      currentAttachment = null;
      fileInput.value = '';
      renderPreviewHolder();
      if (typeof onChange === 'function') onChange(null);
    },
  };
}

