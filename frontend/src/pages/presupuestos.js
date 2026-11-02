/**
 * Presupuestos y Cotizaciones — R1 Personalizados
 * Módulo completo con gestión de estados, cliente casual con selector mundial de países,
 * productos casuales, proveedores con vista previa de 3 recientes,
 * galería con drag-and-drop, exportación y envío WhatsApp.
 * Cumple estrictamente con AGENTS.md.
 */

import { createButton } from '../components/button.js';
import { openModal, openConfirmModal } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { apiFetch } from '../services/api.js';
import {
  generateBudgetPDF,
  printOrDownloadBudgetDocument,
  getDefaultBudgetConfig,
  openInteractivePDFPreviewModal,
  formatPercentage,
  resolveDiscountText,
  getBudgetPdfFilename,
  getWhatsAppNameFormatConfig,
  formatClientDisplayName,
  buildBudgetMessageText,
  generateBudgetPDFBlob,
  downloadBudgetPDFFile,
} from '../services/budget-document.service.js?v=20261102_02';

/**
 * Normaliza cualquier formato de fecha a YYYY-MM-DD para <input type="date"> y MySQL
 */
function toIsoDate(val) {
  if (!val) return new Date().toISOString().slice(0, 10);
  val = String(val).trim();
  if (val.includes('/')) {
    const parts = val.split('/');
    if (parts.length === 3) {
      if (parts[2].length === 4) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
      if (parts[0].length === 4) {
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      }
    }
  }
  if (val.includes('-')) {
    const parts = val.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return val;
      }
      if (parts[2].length === 4) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
  }
  return val;
}

/**
 * Convierte y comprime una imagen a formato WebP en el navegador
 */
function compressImageToWebP(file, maxDimension = 1200, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const webpDataUrl = canvas.toDataURL('image/webp', quality);
        resolve(webpDataUrl);
      };
      img.onerror = () => reject(new Error('No se pudo decodificar la imagen'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Error al leer el archivo de imagen'));
    reader.readAsDataURL(file);
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

function unformatGs(val) {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  return Number(String(val).replace(/[^0-9]/g, '')) || 0;
}

// Switch iOS estandarizado según AGENTS.md
function createIOSToggle({ label = '', checked = false, onChange = null, activeColor = 'brand' }) {
  const wrap = document.createElement('label');
  wrap.className = 'inline-flex items-center gap-2.5 cursor-pointer select-none';
  const activeBg = activeColor === 'emerald' ? 'peer-checked:bg-emerald-500' : 'peer-checked:bg-brand';

  wrap.innerHTML = `
    <span class="text-xs font-semibold text-slate-700 dark:text-slate-300 toggle-label">${escapeHtml(label)}</span>
    <div class="relative inline-flex items-center">
      <input type="checkbox" class="sr-only peer" ${checked ? 'checked' : ''} />
      <div class="w-11 h-6 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${activeBg}"></div>
    </div>
  `;

  const input = wrap.querySelector('input');
  const labelSpan = wrap.querySelector('.toggle-label');
  input.addEventListener('change', () => {
    if (typeof onChange === 'function') onChange(input.checked);
  });

  return {
    element: wrap,
    isChecked: () => input.checked,
    setChecked: (val) => {
      input.checked = Boolean(val);
    },
    setLabel: (txt) => {
      if (labelSpan) labelSpan.textContent = txt;
    },
  };
}

// Contador numérico estandarizado según AGENTS.md
function createQuantityCounter({ value = 1, min = 1, onChange = null } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'inline-flex items-center rounded-xl bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700 shadow-xs';

  wrap.innerHTML = `
    <button type="button" class="btn-qty-minus w-8 h-8 rounded-lg bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 text-white flex items-center justify-center transition active:scale-95 cursor-pointer" aria-label="Disminuir cantidad">
      <i class="fa-solid fa-minus text-xs"></i>
    </button>
    <input type="text" class="input-qty-val w-12 text-center text-xs font-bold font-mono bg-transparent text-slate-900 dark:text-white focus:outline-none" value="${value}" />
    <button type="button" class="btn-qty-plus w-8 h-8 rounded-lg bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 text-white flex items-center justify-center transition active:scale-95 cursor-pointer" aria-label="Aumentar cantidad">
      <i class="fa-solid fa-plus text-xs"></i>
    </button>
  `;

  const minusBtn = wrap.querySelector('.btn-qty-minus');
  const plusBtn = wrap.querySelector('.btn-qty-plus');
  const inputVal = wrap.querySelector('.input-qty-val');

  let currentVal = Math.max(min, Math.floor(Number(value) || min));
  inputVal.value = currentVal;

  function updateVal(newVal) {
    currentVal = Math.max(min, Math.floor(Number(newVal) || min));
    inputVal.value = currentVal;
    if (typeof onChange === 'function') onChange(currentVal);
  }

  let intervalId = null;
  function startRepeat(delta) {
    updateVal(currentVal + delta);
    intervalId = setInterval(() => {
      updateVal(currentVal + delta);
    }, 180);
  }
  function stopRepeat() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  minusBtn.addEventListener('mousedown', () => startRepeat(-1));
  minusBtn.addEventListener('mouseup', stopRepeat);
  minusBtn.addEventListener('mouseleave', stopRepeat);

  plusBtn.addEventListener('mousedown', () => startRepeat(1));
  plusBtn.addEventListener('mouseup', stopRepeat);
  plusBtn.addEventListener('mouseleave', stopRepeat);

  inputVal.addEventListener('change', () => {
    updateVal(inputVal.value);
  });
  inputVal.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      updateVal(inputVal.value);
      inputVal.blur();
    }
  });

  return {
    element: wrap,
    getValue: () => currentVal,
    setValue: (val) => {
      updateVal(val);
    },
  };
}

// Lista completa de países del mundo con bandera, código ISO y prefijo telefónico
const WORLD_COUNTRIES = [
  { code: '+595', name: 'Paraguay', flag: '🇵🇾', iso: 'PY' },
  { code: '+54', name: 'Argentina', flag: '🇦🇷', iso: 'AR' },
  { code: '+55', name: 'Brasil', flag: '🇧🇷', iso: 'BR' },
  { code: '+591', name: 'Bolivia', flag: '🇧🇴', iso: 'BO' },
  { code: '+598', name: 'Uruguay', flag: '🇺🇾', iso: 'UY' },
  { code: '+56', name: 'Chile', flag: '🇨🇱', iso: 'CL' },
  { code: '+57', name: 'Colombia', flag: '🇨🇴', iso: 'CO' },
  { code: '+51', name: 'Perú', flag: '🇵🇪', iso: 'PE' },
  { code: '+593', name: 'Ecuador', flag: '🇪🇨', iso: 'EC' },
  { code: '+58', name: 'Venezuela', flag: '🇻🇪', iso: 'VE' },
  { code: '+52', name: 'México', flag: '🇲🇽', iso: 'MX' },
  { code: '+34', name: 'España', flag: '🇪🇸', iso: 'ES' },
  { code: '+1', name: 'Estados Unidos', flag: '🇺🇸', iso: 'US' },
  { code: '+1', name: 'Canadá', flag: '🇨🇦', iso: 'CA' },
  { code: '+507', name: 'Panamá', flag: '🇵🇦', iso: 'PA' },
  { code: '+506', name: 'Costa Rica', flag: '🇨🇷', iso: 'CR' },
  { code: '+502', name: 'Guatemala', flag: '🇬🇹', iso: 'GT' },
  { code: '+504', name: 'Honduras', flag: '🇭🇳', iso: 'HN' },
  { code: '+503', name: 'El Salvador', flag: '🇸🇻', iso: 'SV' },
  { code: '+505', name: 'Nicaragua', flag: '🇳🇮', iso: 'NI' },
  { code: '+1809', name: 'República Dominicana', flag: '🇩🇴', iso: 'DO' },
  { code: '+53', name: 'Cuba', flag: '🇨🇺', iso: 'CU' },
  { code: '+49', name: 'Alemania', flag: '🇩🇪', iso: 'DE' },
  { code: '+33', name: 'Francia', flag: '🇫🇷', iso: 'FR' },
  { code: '+39', name: 'Italia', flag: '🇮🇹', iso: 'IT' },
  { code: '+44', name: 'Reino Unido', flag: '🇬🇧', iso: 'GB' },
  { code: '+351', name: 'Portugal', flag: '🇵🇹', iso: 'PT' },
  { code: '+31', name: 'Países Bajos', flag: '🇳🇱', iso: 'NL' },
  { code: '+32', name: 'Bélgica', flag: '🇧🇪', iso: 'BE' },
  { code: '+41', name: 'Suiza', flag: '🇨🇭', iso: 'CH' },
  { code: '+43', name: 'Austria', flag: '🇦🇹', iso: 'AT' },
  { code: '+46', name: 'Suecia', flag: '🇸🇪', iso: 'SE' },
  { code: '+47', name: 'Noruega', flag: '🇳🇴', iso: 'NO' },
  { code: '+45', name: 'Dinamarca', flag: '🇩🇰', iso: 'DK' },
  { code: '+358', name: 'Finlandia', flag: '🇫🇮', iso: 'FI' },
  { code: '+48', name: 'Polonia', flag: '🇵🇱', iso: 'PL' },
  { code: '+7', name: 'Rusia', flag: '🇷🇺', iso: 'RU' },
  { code: '+90', name: 'Turquía', flag: '🇹🇷', iso: 'TR' },
  { code: '+86', name: 'China', flag: '🇨🇳', iso: 'CN' },
  { code: '+81', name: 'Japón', flag: '🇯🇵', iso: 'JP' },
  { code: '+82', name: 'Corea del Sur', flag: '🇰🇷', iso: 'KR' },
  { code: '+91', name: 'India', flag: '🇮🇳', iso: 'IN' },
  { code: '+61', name: 'Australia', flag: '🇦🇺', iso: 'AU' },
  { code: '+64', name: 'Nueva Zelanda', flag: '🇳🇿', iso: 'NZ' },
  { code: '+971', name: 'Emiratos Árabes', flag: '🇦🇪', iso: 'AE' },
  { code: '+966', name: 'Arabia Saudita', flag: '🇸🇦', iso: 'SA' },
  { code: '+972', name: 'Israel', flag: '🇮🇱', iso: 'IL' },
  { code: '+27', name: 'Sudáfrica', flag: '🇿🇦', iso: 'ZA' },
  { code: '+20', name: 'Egipto', flag: '🇪🇬', iso: 'EG' },
];

/**
 * Componente interactivo de selección de país con buscador interno
 */
function createCountryCodePicker({ defaultCode = '+595', onSelect = null } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'relative inline-block';

  let selected = WORLD_COUNTRIES.find((c) => c.code === defaultCode) || WORLD_COUNTRIES[0];

  wrap.innerHTML = `
    <button type="button" class="btn-country-picker flex items-center gap-1.5 px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-brand transition cursor-pointer select-none">
      <span class="flag-icon text-sm">${selected.flag}</span>
      <span class="font-mono font-bold text-xs">${selected.code}</span>
      <i class="fa-solid fa-chevron-down text-[10px] text-slate-400 ml-0.5"></i>
    </button>
    <div class="dropdown-country-menu hidden absolute left-0 top-full mt-1.5 z-30 w-72 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden p-2 space-y-2">
      <div class="relative">
        <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
        <input type="text" placeholder="Buscar país o prefijo (+595, Paraguay...)" class="inp-search-country w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand" />
      </div>
      <div class="country-list max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
      </div>
    </div>
  `;

  const btnPicker = wrap.querySelector('.btn-country-picker');
  const dropdownMenu = wrap.querySelector('.dropdown-country-menu');
  const inpSearch = wrap.querySelector('.inp-search-country');
  const listWrap = wrap.querySelector('.country-list');

  function renderList(filter = '') {
    const q = filter.toLowerCase().trim();
    const filtered = WORLD_COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.includes(q) || c.iso.toLowerCase().includes(q)
    );

    if (filtered.length === 0) {
      listWrap.innerHTML = `<div class="p-3 text-center text-xs text-slate-400">No se encontraron países</div>`;
      return;
    }

    listWrap.innerHTML = filtered
      .map(
        (c) => `
        <div class="country-item px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition flex items-center justify-between text-xs select-none ${c.code === selected.code && c.name === selected.name ? 'bg-brand-soft/50 dark:bg-brand/20 font-bold text-brand' : 'text-slate-700 dark:text-slate-200'}"
          data-code="${c.code}" data-name="${escapeHtml(c.name)}" data-flag="${c.flag}">
          <div class="flex items-center gap-2">
            <span class="text-base">${c.flag}</span>
            <span>${escapeHtml(c.name)}</span>
          </div>
          <span class="font-mono font-bold text-slate-500">${c.code}</span>
        </div>
      `
      )
      .join('');

    listWrap.querySelectorAll('.country-item').forEach((el) => {
      el.addEventListener('click', () => {
        const code = el.getAttribute('data-code');
        const name = el.getAttribute('data-name');
        const flag = el.getAttribute('data-flag');
        selected = { code, name, flag };

        wrap.querySelector('.flag-icon').textContent = flag;
        wrap.querySelector('.btn-country-picker .font-mono').textContent = code;
        dropdownMenu.classList.add('hidden');
        if (typeof onSelect === 'function') onSelect(selected);
      });
    });
  }

  btnPicker.addEventListener('click', (e) => {
    e.stopPropagation();
    const isHidden = dropdownMenu.classList.contains('hidden');
    if (isHidden) {
      dropdownMenu.classList.remove('hidden');
      inpSearch.value = '';
      renderList('');
      inpSearch.focus();
    } else {
      dropdownMenu.classList.add('hidden');
    }
  });

  inpSearch.addEventListener('input', (e) => {
    renderList(e.target.value);
  });

  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target)) {
      dropdownMenu.classList.add('hidden');
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      dropdownMenu.classList.add('hidden');
    }
  });

  renderList('');

  return {
    element: wrap,
    getSelected: () => selected,
    setSelected: (code) => {
      const found = WORLD_COUNTRIES.find((c) => c.code === code);
      if (found) {
        selected = found;
        wrap.querySelector('.flag-icon').textContent = found.flag;
        wrap.querySelector('.btn-country-picker .font-mono').textContent = found.code;
      }
    },
  };
}

/**
 * Helper reutilizable para buscadores con vista previa de 3 ítems al hacer clic (Requisitos 4, 5, 6)
 */
function setupAutocompleteDropdown({ inputEl, dropdownEl, fetchItems, renderItemHtml, onSelectItem }) {
  let timer = null;

  async function openAndLoad(query = '') {
    try {
      const res = await fetchItems(query);
      const items = Array.isArray(res?.data) ? res.data : [];
      if (items.length === 0) {
        dropdownEl.innerHTML = `<div class="p-3.5 text-xs text-slate-400 text-center">No se encontraron resultados</div>`;
        dropdownEl.classList.remove('hidden');
        return;
      }

      // Si query está vacío, encabezado indicativo de registros recientes
      let html = '';
      if (!query.trim()) {
        html += `<div class="px-3 py-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider bg-slate-50/70 dark:bg-slate-800/40">Recientes / Activos</div>`;
      }

      html += items.map((it) => renderItemHtml(it)).join('');
      dropdownEl.innerHTML = html;
      dropdownEl.classList.remove('hidden');

      dropdownEl.querySelectorAll('.autocomplete-item').forEach((el) => {
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          const rawId = el.getAttribute('data-item-id');
          const found = items.find((i) => String(i.id) === String(rawId));
          if (found) {
            onSelectItem(found);
            dropdownEl.classList.add('hidden');
          }
        });
      });
    } catch (_) {
      dropdownEl.classList.add('hidden');
    }
  }

  // Al hacer clic o focus, si está vacío despliega 3 registros recientes
  inputEl.addEventListener('focus', () => {
    openAndLoad(inputEl.value.trim());
  });

  inputEl.addEventListener('click', (e) => {
    e.stopPropagation();
    openAndLoad(inputEl.value.trim());
  });

  // Al escribir, filtra en tiempo real
  inputEl.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      openAndLoad(inputEl.value.trim());
    }, 200);
  });

  // Cerrar al hacer clic fuera o con Esc
  document.addEventListener('click', (e) => {
    if (!inputEl.contains(e.target) && !dropdownEl.contains(e.target)) {
      dropdownEl.classList.add('hidden');
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      dropdownEl.classList.add('hidden');
    }
  });
}

/**
 * Renderiza el módulo completo de Presupuestos
 */
export function renderPresupuestosModule(container, onNavigate) {
  container.innerHTML = '';
  // Área asignada con scroll propio y espacio interno uniforme de 24px a 32px (p-6 sm:p-8) con espacio libre al final (pb-24)
  container.className = 'app-module-area w-full h-full min-h-0 overflow-y-auto p-6 sm:p-8 pb-24 space-y-6';

  let currentView = 'list'; // 'list' | 'create' | 'edit'
  let editingBudgetId = null;
  let activeStatusFilter = '';
  let searchQuery = '';
  let fechaDesdeVal = '';
  let fechaHastaVal = '';
  let currentPage = 1;
  const pageSize = 20;

  let budgetsData = [];
  let countersData = { total: 0, borrador: 0, enviados: 0, aprobados: 0, rechazados: 0, vencidos: 0 };
  let totalRecords = 0;

  const viewContainer = document.createElement('div');
  viewContainer.className = 'w-full space-y-6';
  container.appendChild(viewContainer);

  loadListView();

  // ==========================================================================
  // VISTA 1: LISTA DE PRESUPUESTOS (List View)
  // ==========================================================================
  async function loadListView() {
    currentView = 'list';
    editingBudgetId = null;
    viewContainer.innerHTML = '';

    // Encabezado
    const header = document.createElement('div');
    header.className = 'flex flex-wrap items-center justify-between gap-4';
    header.innerHTML = `
      <div class="flex items-center gap-3">
        <span class="w-10 h-10 rounded-xl bg-brand-soft dark:bg-brand/20 text-brand flex items-center justify-center text-lg">
          <i class="fa-regular fa-file-lines"></i>
        </span>
        <div>
          <h1 class="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">Presupuestos y Cotizaciones</h1>
          <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Genere, personalice y gestione presupuestos en formato PDF con control de estados y catálogo integrado.
          </p>
        </div>
      </div>
      <div id="btn-nuevo-container"></div>
    `;

    const btnNuevoContainer = header.querySelector('#btn-nuevo-container');
    const btnNuevo = createButton({
      text: 'Nuevo Presupuesto',
      icon: 'fa-solid fa-plus',
      variant: 'primary',
      size: 'md',
      onClick: () => loadCreateOrEditView(null),
    });
    btnNuevoContainer.appendChild(btnNuevo);
    viewContainer.appendChild(header);

    // Contenedor de Tarjetas de Contadores Superiores
    const countersWrap = document.createElement('div');
    countersWrap.className = 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3';
    countersWrap.id = 'budgets-counters';
    viewContainer.appendChild(countersWrap);

    // Barra de Filtros
    const filtersWrap = document.createElement('div');
    filtersWrap.className = 'bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-wrap items-center gap-3 justify-between';
    filtersWrap.innerHTML = `
      <div class="flex-1 min-w-[240px] relative">
        <i class="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
        <input type="text" id="filter-search" placeholder="Buscar por N°, cliente, RUC o teléfono..." 
          class="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand transition"
          value="${escapeHtml(searchQuery)}" />
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <select id="filter-status" class="py-2 px-3 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand transition">
          <option value="">Todos los Estados Activos</option>
          <option value="Borrador" ${activeStatusFilter === 'Borrador' ? 'selected' : ''}>Borrador</option>
          <option value="Enviado" ${activeStatusFilter === 'Enviado' ? 'selected' : ''}>Enviados</option>
          <option value="Aprobado" ${activeStatusFilter === 'Aprobado' ? 'selected' : ''}>Aprobados</option>
          <option value="Rechazado" ${activeStatusFilter === 'Rechazado' ? 'selected' : ''}>Rechazados</option>
          <option value="Vencido" ${activeStatusFilter === 'Vencido' ? 'selected' : ''}>Vencidos</option>
          <option value="Anulado" ${activeStatusFilter === 'Anulado' ? 'selected' : ''}>Anulados</option>
          <option value="todos" ${activeStatusFilter === 'todos' ? 'selected' : ''}>Todos (incluye Anulados)</option>
        </select>
        <div class="flex items-center gap-1.5 text-xs text-slate-500">
          <input type="date" id="filter-fecha-desde" class="py-1.5 px-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none text-xs" value="${fechaDesdeVal}" />
          <span>a</span>
          <input type="date" id="filter-fecha-hasta" class="py-1.5 px-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none text-xs" value="${fechaHastaVal}" />
        </div>
        <button type="button" id="btn-clear-filters" class="px-3 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center gap-1.5 cursor-pointer">
          <i class="fa-solid fa-xmark"></i>
          <span>Limpiar Filtros</span>
        </button>
      </div>
    `;
    viewContainer.appendChild(filtersWrap);

    // Contenedor de Tabla
    const tableCard = document.createElement('div');
    tableCard.className = 'bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden';
    tableCard.id = 'budgets-table-container';
    viewContainer.appendChild(tableCard);

    // Eventos de Filtros
    let searchTimer = null;
    filtersWrap.querySelector('#filter-search')?.addEventListener('input', (e) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        searchQuery = e.target.value.trim();
        currentPage = 1;
        fetchBudgets();
      }, 300);
    });

    filtersWrap.querySelector('#filter-status')?.addEventListener('change', (e) => {
      activeStatusFilter = e.target.value;
      currentPage = 1;
      fetchBudgets();
    });

    filtersWrap.querySelector('#filter-fecha-desde')?.addEventListener('change', (e) => {
      fechaDesdeVal = e.target.value;
      currentPage = 1;
      fetchBudgets();
    });

    filtersWrap.querySelector('#filter-fecha-hasta')?.addEventListener('change', (e) => {
      fechaHastaVal = e.target.value;
      currentPage = 1;
      fetchBudgets();
    });

    filtersWrap.querySelector('#btn-clear-filters')?.addEventListener('click', () => {
      searchQuery = '';
      activeStatusFilter = '';
      fechaDesdeVal = '';
      fechaHastaVal = '';
      currentPage = 1;
      const inpS = filtersWrap.querySelector('#filter-search');
      if (inpS) inpS.value = '';
      const selS = filtersWrap.querySelector('#filter-status');
      if (selS) selS.value = '';
      const inpFd = filtersWrap.querySelector('#filter-fecha-desde');
      if (inpFd) inpFd.value = '';
      const inpFh = filtersWrap.querySelector('#filter-fecha-hasta');
      if (inpFh) inpFh.value = '';
      fetchBudgets();
    });

    fetchBudgets();
  }

  // Renderizado de Contadores Superiores
  function renderCounters(countersWrap) {
    if (!countersWrap) return;
    const cards = [
      { key: '', label: 'TOTAL', count: countersData.total || 0, color: 'brand' },
      { key: 'Borrador', label: 'BORRADOR', count: countersData.borrador || 0, color: 'slate' },
      { key: 'Enviado', label: 'ENVIADOS', count: countersData.enviados || 0, color: 'blue' },
      { key: 'Aprobado', label: 'APROBADOS', count: countersData.aprobados || 0, color: 'emerald' },
      { key: 'Rechazado', label: 'RECHAZADOS', count: countersData.rechazados || 0, color: 'danger' },
      { key: 'Vencido', label: 'VENCIDOS', count: countersData.vencidos || 0, color: 'amber' },
      { key: 'Anulado', label: 'ANULADOS', count: countersData.anulados || 0, color: 'slate' },
    ];

    countersWrap.innerHTML = cards
      .map((c) => {
        const isActive = activeStatusFilter === c.key;
        let activeBorder = isActive
          ? 'border-brand dark:border-brand ring-2 ring-brand/30'
          : 'border-slate-200/80 dark:border-slate-800 hover:border-brand/40';
        let numColor = 'text-slate-900 dark:text-white';
        if (c.color === 'emerald') numColor = 'text-emerald-600 dark:text-emerald-400';
        if (c.color === 'danger') numColor = 'text-red-600 dark:text-red-400';
        if (c.color === 'blue') numColor = 'text-blue-600 dark:text-blue-400';
        if (c.color === 'amber') numColor = 'text-amber-600 dark:text-amber-400';

        return `
          <div class="counter-card p-4 rounded-2xl bg-white dark:bg-slate-900 border ${activeBorder} shadow-xs cursor-pointer transition select-none" data-status="${c.key}">
            <div class="text-[10px] font-bold tracking-wider uppercase text-slate-400 dark:text-slate-500">${c.label}</div>
            <div class="text-2xl font-black ${numColor} mt-1">${c.count}</div>
          </div>
        `;
      })
      .join('');

    countersWrap.querySelectorAll('.counter-card').forEach((el) => {
      el.addEventListener('click', () => {
        const status = el.getAttribute('data-status');
        activeStatusFilter = status;
        const sel = document.getElementById('filter-status');
        if (sel) sel.value = status;
        currentPage = 1;
        fetchBudgets();
      });
    });
  }

  // Consulta de presupuestos al Backend
  async function fetchBudgets() {
    const tableContainer = document.getElementById('budgets-table-container');
    if (tableContainer) {
      tableContainer.innerHTML = `
        <div class="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
          <i class="fa-solid fa-spinner fa-spin text-2xl text-brand"></i>
          <span class="text-xs">Cargando presupuestos...</span>
        </div>
      `;
    }

    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set('q', searchQuery);
      if (activeStatusFilter) params.set('estado', activeStatusFilter);
      if (fechaDesdeVal) params.set('fecha_desde', fechaDesdeVal);
      if (fechaHastaVal) params.set('fecha_hasta', fechaHastaVal);
      params.set('page', String(currentPage));
      params.set('page_size', String(pageSize));

      const res = await apiFetch(`/api/budgets?${params.toString()}`);
      budgetsData = res.data || [];
      countersData = res.counters || { total: 0, borrador: 0, enviados: 0, aprobados: 0, rechazados: 0, vencidos: 0 };
      totalRecords = res.total ?? budgetsData.length;

      const countersWrap = document.getElementById('budgets-counters');
      renderCounters(countersWrap);
      renderTable();
    } catch (err) {
      console.error('[Error al cargar presupuestos]', err);
      if (tableContainer) {
        tableContainer.innerHTML = `
          <div class="p-12 text-center flex flex-col items-center justify-center gap-3">
            <span class="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center text-xl">
              <i class="fa-solid fa-triangle-exclamation"></i>
            </span>
            <p class="text-sm font-bold text-red-600 dark:text-red-400">Error al cargar la lista de presupuestos</p>
            <p class="text-xs text-slate-400 max-w-md">${escapeHtml(err.message || 'Internal Server Error')}</p>
            <div id="btn-retry-container" class="mt-2"></div>
          </div>
        `;
        const btnRetry = createButton({
          text: 'Reintentar',
          variant: 'primary',
          size: 'sm',
          onClick: () => fetchBudgets(),
        });
        tableContainer.querySelector('#btn-retry-container')?.appendChild(btnRetry);
      }
    }
  }

  // Renderizado de Tabla estandarizada según AGENTS.md
  function renderTable() {
    const tableContainer = document.getElementById('budgets-table-container');
    if (!tableContainer) return;

    if (budgetsData.length === 0) {
      tableContainer.innerHTML = `
        <div class="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
          <span class="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center text-xl">
            <i class="fa-regular fa-file-lines"></i>
          </span>
          <p class="text-sm font-bold text-slate-700 dark:text-slate-300">No se encontraron presupuestos</p>
          <p class="text-xs text-slate-400 max-w-sm">No hay cotizaciones que coincidan con los filtros seleccionados o aún no se han creado presupuestos.</p>
        </div>
      `;
      return;
    }

    const tableWrap = document.createElement('div');
    tableWrap.className = 'w-full overflow-x-auto';

    tableWrap.innerHTML = `
      <table class="w-full text-left text-xs border-collapse">
        <thead>
          <tr class="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            <th class="py-3.5 px-4">N° PRESUPUESTO</th>
            <th class="py-3.5 px-4">CLIENTE</th>
            <th class="py-3.5 px-4">PRODUCTOS / ÍTEMS</th>
            <th class="py-3.5 px-4">TOTAL</th>
            <th class="py-3.5 px-4">VALIDEZ</th>
            <th class="py-3.5 px-4">ESTADO</th>
            <th class="py-3.5 px-4 text-right">
              <div class="flex items-center justify-end gap-2">
                <span>ACCIONES</span>
                <button type="button" id="btn-export-table" class="w-7 h-7 rounded-lg text-slate-500 hover:text-brand hover:bg-brand-soft/50 dark:hover:bg-brand/20 flex items-center justify-center transition cursor-pointer" title="Descargar / Exportar tabla">
                  <i class="fa-solid fa-download text-xs"></i>
                </button>
              </div>
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 dark:divide-slate-800/60">
        </tbody>
      </table>
    `;

    const tbody = tableWrap.querySelector('tbody');

    budgetsData.forEach((b) => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition group';

      let badgeBg = 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300';
      if (b.estado === 'Aprobado' || b.estado === 'Aceptado') {
        badgeBg = 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800';
      } else if (b.estado === 'Enviado' || b.estado === 'Pendiente') {
        badgeBg = 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800';
      } else if (b.estado === 'Rechazado') {
        badgeBg = 'bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800';
      } else if (b.estado === 'Vencido') {
        badgeBg = 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800';
      } else if (b.estado === 'Anulado') {
        badgeBg = 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-slate-700';
      }

      const isAnulado = b.estado === 'Anulado';

      tr.innerHTML = `
        <td class="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white">
          <div class="hover:text-brand cursor-pointer btn-open-preview">
            ${escapeHtml(b.numero_presupuesto)}
          </div>
          <div class="text-[10px] text-slate-400 font-normal mt-0.5">${escapeHtml(b.fecha_emision)}</div>
        </td>
        <td class="py-3.5 px-4">
          <div class="font-bold text-slate-800 dark:text-slate-200">${escapeHtml(b.cliente_nombre)}</div>
          <div class="text-[10px] text-slate-400">${escapeHtml(b.cliente_telefono || b.cliente_ruc || 'Sin contacto')}</div>
        </td>
        <td class="py-3.5 px-4 max-w-xs">
          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-soft text-brand dark:bg-brand/20 mb-1">
            <i class="fa-solid fa-cube text-[9px]"></i>
            ${b.items_count || 1} Ítems
          </span>
          <div class="text-[11px] text-slate-500 dark:text-slate-400 truncate" title="${escapeHtml(b.items_resumen || '')}">
            ${escapeHtml(b.items_resumen || 'Detalle en PDF')}
          </div>
        </td>
        <td class="py-3.5 px-4 font-bold font-mono text-slate-900 dark:text-white">
          ${formatGs(b.total_final)}
        </td>
        <td class="py-3.5 px-4 text-slate-600 dark:text-slate-400">
          <div>${b.validez_dias || 15} días</div>
          <div class="text-[10px] text-slate-400">${escapeHtml(b.validez_fecha || '')}</div>
        </td>
        <td class="py-3.5 px-4">
          <span class="inline-block px-2.5 py-1 rounded-full text-[10px] font-bold ${badgeBg}">
            ${escapeHtml(b.estado)}
          </span>
        </td>
        <td class="py-3.5 px-4 text-right">
          <div class="inline-flex items-center gap-1 justify-end">
            <button type="button" class="btn-row-preview w-8 h-8 rounded-xl text-slate-500 hover:text-brand hover:bg-brand-soft/50 dark:hover:bg-brand/20 transition flex items-center justify-center cursor-pointer" title="Vista previa y PDF">
              <i class="fa-regular fa-eye text-xs"></i>
            </button>
            ${!isAnulado ? `
            <button type="button" class="btn-row-edit w-8 h-8 rounded-xl text-slate-500 hover:text-brand hover:bg-brand-soft/50 dark:hover:bg-brand/20 transition flex items-center justify-center cursor-pointer" title="Editar presupuesto">
              <i class="fa-regular fa-pen-to-square text-xs"></i>
            </button>
            <button type="button" class="btn-row-whatsapp w-8 h-8 rounded-xl text-slate-500 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition flex items-center justify-center cursor-pointer" title="Enviar por WhatsApp">
              <i class="fa-brands fa-whatsapp text-xs"></i>
            </button>
            <button type="button" class="btn-row-anular w-8 h-8 rounded-xl text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition flex items-center justify-center cursor-pointer" title="Anular presupuesto (sin borrado)">
              <i class="fa-solid fa-ban text-xs"></i>
            </button>
            ` : `
            <span class="text-[11px] font-semibold text-slate-400 italic px-2">Archivado</span>
            `}
          </div>
        </td>
      `;

      tr.querySelector('.btn-open-preview')?.addEventListener('click', () => loadCreateOrEditView(b.id || b.numero_presupuesto, { isPreview: true }));
      tr.querySelector('.btn-row-preview')?.addEventListener('click', () => loadCreateOrEditView(b.id || b.numero_presupuesto, { isPreview: true }));
      tr.querySelector('.btn-row-edit')?.addEventListener('click', () => loadCreateOrEditView(b.id || b.numero_presupuesto, { isPreview: false }));
      tr.querySelector('.btn-row-whatsapp')?.addEventListener('click', () => openWhatsAppSendModal(b.id || b.numero_presupuesto));
      tr.querySelector('.btn-row-anular')?.addEventListener('click', () => confirmAnularBudget(b));

      tbody.appendChild(tr);
    });

    tableWrap.querySelector('#btn-export-table')?.addEventListener('click', () => openExportModal());

    tableContainer.innerHTML = '';
    tableContainer.appendChild(tableWrap);

    // Paginación si hay más de 20 registros
    if (totalRecords > pageSize) {
      const paginator = document.createElement('div');
      paginator.className = 'p-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500';
      const totalPages = Math.ceil(totalRecords / pageSize);
      const startItem = (currentPage - 1) * pageSize + 1;
      const endItem = Math.min(currentPage * pageSize, totalRecords);

      paginator.innerHTML = `
        <div>Mostrando ${startItem}–${endItem} de ${totalRecords} presupuestos</div>
        <div class="flex items-center gap-1">
          <button type="button" id="btn-page-prev" class="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed" ${currentPage === 1 ? 'disabled' : ''}>
            <i class="fa-solid fa-chevron-left text-[10px]"></i>
          </button>
          <span class="px-2 font-mono font-bold text-slate-800 dark:text-slate-200">Página ${currentPage} de ${totalPages}</span>
          <button type="button" id="btn-page-next" class="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed" ${currentPage === totalPages ? 'disabled' : ''}>
            <i class="fa-solid fa-chevron-right text-[10px]"></i>
          </button>
        </div>
      `;

      paginator.querySelector('#btn-page-prev')?.addEventListener('click', () => {
        if (currentPage > 1) {
          currentPage--;
          fetchBudgets();
        }
      });
      paginator.querySelector('#btn-page-next')?.addEventListener('click', () => {
        if (currentPage < totalPages) {
          currentPage++;
          fetchBudgets();
        }
      });

      tableContainer.appendChild(paginator);
    }
  }

  // ==========================================================================
  // VISTA 2: CREAR / EDITAR / VISTA PREVIA COMPLETA DE PRESUPUESTO
  // ==========================================================================
  async function loadCreateOrEditView(budgetId, { isPreview = false } = {}) {
    currentView = isPreview ? 'preview' : (budgetId ? 'edit' : 'create');
    editingBudgetId = budgetId;
    viewContainer.innerHTML = `
      <div class="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
        <i class="fa-solid fa-spinner fa-spin text-2xl text-brand"></i>
        <span class="text-xs">Cargando presupuesto...</span>
      </div>
    `;

    let initialBudget = null;
    let baseTemplateConfig = null;

    try {
      const [tplRes, budRes] = await Promise.all([
        apiFetch('/api/config/budget-template').catch(() => null),
        budgetId ? apiFetch(`/api/budgets/${encodeURIComponent(budgetId)}`).catch(() => null) : Promise.resolve(null),
      ]);
      baseTemplateConfig = tplRes || getDefaultBudgetConfig();
      initialBudget = budRes;
    } catch (err) {
      console.warn('[Presupuestos] Error cargando plantilla base:', err);
    }

    try {
      renderBudgetForm(initialBudget, baseTemplateConfig, { isPreview });
    } catch (renderErr) {
      console.error('[Presupuestos] Error renderizando formulario:', renderErr);
      toast.error('Error al abrir presupuesto: ' + (renderErr.message || 'Error desconocido'));
    }
  }

  function renderBudgetForm(existingData, templateConfig, { isPreview = false } = {}) {
    viewContainer.innerHTML = '';
    let isBuildingForm = true;

    const isEdit = Boolean(existingData && existingData.id);
    let formTitle = 'Crear Presupuesto';
    if (isPreview) {
      formTitle = `Presupuesto ${existingData?.numero_presupuesto || ''}`;
    } else if (isEdit) {
      formTitle = `Editar Presupuesto ${existingData?.numero_presupuesto || ''}`;
    }

    const formData = {
      id: existingData?.id || null,
      numero_presupuesto: existingData?.numero_presupuesto || '',
      fecha_emision: toIsoDate(existingData?.fecha_emision),
      validez_dias: existingData?.validez_dias || 15,
      validez_fecha: existingData?.validez_fecha || '',
      moneda: existingData?.moneda || 'Gs.',
      regimen_iva: existingData?.regimen_iva || 'Exento de IVA',
      estado: existingData?.estado || 'Borrador',
      cliente_id: existingData?.cliente?.id || existingData?.cliente_id || null,
      cliente_casual: Boolean(existingData?.cliente?.casual || existingData?.cliente_casual),
      cliente_nombre: String(existingData?.cliente?.nombre || existingData?.cliente_nombre || '').trim(),
      cliente_ruc: (() => {
        const nd = String(existingData?.cliente?.numeroDocumento || existingData?.cliente?.numero_documento || '').trim();
        const r = String(existingData?.cliente?.ruc || '').trim();
        const rb = String(existingData?.cliente?.rucBase || existingData?.cliente?.ruc_base || '').trim();
        const cr = String(existingData?.cliente_ruc || '').trim();
        if (existingData?.cliente?.tipoCliente === 'empresa' || existingData?.cliente?.tipo_cliente === 'empresa') {
          return r || rb || nd || cr || '';
        }
        return nd || r || rb || cr || '';
      })(),
      cliente_telefono: String(existingData?.cliente?.telefono || existingData?.cliente_telefono || '').trim(),
      cliente_email: String(existingData?.cliente?.email || existingData?.cliente_email || '').trim(),
      cliente_direccion: String(existingData?.cliente?.direccion || existingData?.cliente_direccion || '').trim(),
      country_code: '+595',
      items: existingData?.items ? JSON.parse(JSON.stringify(existingData.items)) : [],
      servicios_opcionales: existingData?.servicios_opcionales ? JSON.parse(JSON.stringify(existingData.servicios_opcionales)) : [],
      monto_descuento: existingData?.totales?.monto_descuento || 0,
      porcentaje_descuento: existingData?.totales?.porcentaje_descuento || 0,
      leyenda_descuento: existingData?.totales?.leyenda_descuento || '¡{descuento_porcentaje}% DE DESCUENTO POR PAGO AL CONTADO!',
      mostrar_descuento_pdf: existingData?.totales?.mostrar_descuento_pdf !== false,
      terminos_condiciones: existingData?.terminos_condiciones || [
        '1. Validez de la oferta: Este presupuesto tiene una validez de 15 días corridos a partir de su fecha de emisión.',
        '2. Condiciones de pago: El pedido se confirma con la entrega del 60%, por medio de efectivo o transferencia bancaria.',
        '3. Plazos de entrega: Tiempo estimado de 3 a 5 días hábiles posterior a la aprobación del diseño y confirmación de seña.',
        '4. Garantía y cambios: Tratándose de artículos personalizados, no se admiten cancelaciones una vez iniciada la producción.',
      ],
      observaciones: existingData?.observaciones || '',
      galeria_fotos: existingData?.imagenes_productos ? JSON.parse(JSON.stringify(existingData.imagenes_productos)) : [],
      mostrar_galeria_pdf: existingData?.mostrar_galeria_pdf !== false,
      galeria_layout: existingData?.galeria_layout || '2x3',
      pedido_id: existingData?.pedido_id || null,
      numero_pedido: existingData?.numero_pedido || '',
    };

    // Barra superior: Breadcrumb y Acciones principales
    const topBar = document.createElement('div');
    topBar.className = 'flex flex-wrap items-center justify-between gap-4';
    topBar.innerHTML = `
      <div>
        <div class="flex items-center gap-2 text-xs text-slate-400 mb-1">
          <button type="button" id="btn-back-breadcrumb" class="hover:text-brand transition cursor-pointer flex items-center gap-1">
            <i class="fa-solid fa-chevron-left text-[10px]"></i>
            Presupuestos
          </button>
          <span>/</span>
          <span class="text-slate-600 dark:text-slate-300 font-semibold">${isPreview ? 'Vista Previa' : (isEdit ? 'Editar' : 'Nuevo Presupuesto')}</span>
        </div>
        <div class="flex items-center gap-3">
          <h1 class="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">${formTitle}</h1>
          ${isPreview ? `<span class="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1.5"><i class="fa-regular fa-eye"></i> Vista Previa</span>` : ''}
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-2" id="top-actions-container">
      </div>
    `;

    topBar.querySelector('#btn-back-breadcrumb')?.addEventListener('click', loadListView);

    const topActions = topBar.querySelector('#top-actions-container');

    if (isPreview) {
      const btnVolver = createButton({
        text: 'Volver a la Lista',
        icon: 'fa-solid fa-arrow-left',
        variant: 'cancel',
        size: 'md',
        onClick: loadListView,
      });
      topActions.appendChild(btnVolver);

      const btnVerPDF = createButton({
        text: 'Ver PDF',
        icon: 'fa-regular fa-file-pdf',
        variant: 'cancel',
        size: 'md',
        onClick: () => handlePreviewDraftPDF(formData, templateConfig),
      });
      topActions.appendChild(btnVerPDF);

      const btnWhatsApp = createButton({
        text: 'Enviar WhatsApp',
        icon: 'fa-brands fa-whatsapp',
        variant: 'cancel',
        size: 'md',
        onClick: () => openWhatsAppSendModal(formData.id || formData.numero_presupuesto, () => loadCreateOrEditView(formData.id, { isPreview: true })),
      });
      topActions.appendChild(btnWhatsApp);

      // Botón principal de editar en la cabecera (AGENTS.md: botón primary #a37cfc)
      const btnEditar = createButton({
        text: 'Editar Presupuesto',
        icon: 'fa-solid fa-pen-to-square',
        variant: 'primary',
        size: 'md',
        onClick: () => loadCreateOrEditView(formData.id || formData.numero_presupuesto, { isPreview: false }),
      });
      topActions.appendChild(btnEditar);
    } else {
      const btnCancel = createButton({
        text: 'Cancelar',
        variant: 'cancel',
        size: 'md',
        onClick: loadListView,
      });
      topActions.appendChild(btnCancel);

      const btnVerPDF = createButton({
        text: 'Ver PDF',
        icon: 'fa-regular fa-eye',
        variant: 'cancel',
        size: 'md',
        onClick: () => handlePreviewDraftPDF(formData, templateConfig),
      });
      topActions.appendChild(btnVerPDF);

      const btnBorrador = createButton({
        text: 'Solo Guardar Borrador',
        variant: 'cancel',
        size: 'md',
        onClick: () => saveBudget('Borrador'),
      });
      topActions.appendChild(btnBorrador);

      // UN SOLO BOTÓN "Guardar y Enviar"
      const btnGuardarEnviar = createButton({
        text: 'Guardar y Enviar',
        icon: 'fa-solid fa-paper-plane',
        variant: 'primary',
        size: 'md',
        onClick: () => saveBudgetAndSend(),
      });
      topActions.appendChild(btnGuardarEnviar);
    }

    viewContainer.appendChild(topBar);

    // Acciones de Estado si ya está creado
    if (isEdit || formData.id) {
      const statusActionsBar = document.createElement('div');
      statusActionsBar.className = 'p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-4';
      statusActionsBar.innerHTML = `
        <div class="flex items-center gap-3">
          <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Estado Actual:</span>
          <span class="px-3 py-1 rounded-full text-xs font-bold bg-brand-soft text-brand dark:bg-brand/20">
            ${escapeHtml(formData.estado)}
          </span>
          ${formData.numero_pedido ? `<span class="text-xs text-emerald-600 font-semibold flex items-center gap-1"><i class="fa-solid fa-check"></i> Pedido asociado: <b>${escapeHtml(formData.numero_pedido)}</b></span>` : ''}
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button type="button" id="btn-status-aceptado" class="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition flex items-center gap-1.5 cursor-pointer">
            <i class="fa-solid fa-check"></i>
            <span>Aceptado (Crear Pedido)</span>
          </button>
          <button type="button" id="btn-status-cambios" class="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition flex items-center gap-1.5 cursor-pointer">
            <i class="fa-solid fa-pen-to-square"></i>
            <span>Aceptado con Cambios</span>
          </button>
          <button type="button" id="btn-status-rechazado" class="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-xs transition flex items-center gap-1.5 cursor-pointer">
            <i class="fa-solid fa-xmark"></i>
            <span>Rechazado</span>
          </button>
        </div>
      `;

      statusActionsBar.querySelector('#btn-status-aceptado')?.addEventListener('click', () => handleAceptarPresupuesto(formData.id));
      statusActionsBar.querySelector('#btn-status-cambios')?.addEventListener('click', () => handleAceptarConCambios(formData));
      statusActionsBar.querySelector('#btn-status-rechazado')?.addEventListener('click', () => handleRechazarPresupuesto(formData.id));

      viewContainer.appendChild(statusActionsBar);
    }

    // Grid principal: 2 columnas con espacio y scroll fluido
    const mainGrid = document.createElement('div');
    mainGrid.className = 'grid grid-cols-1 lg:grid-cols-12 gap-6 items-start';

    const colLeft = document.createElement('div');
    colLeft.className = 'lg:col-span-8 space-y-6';

    const colRight = document.createElement('div');
    colRight.className = 'lg:col-span-4 lg:sticky lg:top-4 space-y-4';

    // ------------------------------------------------------------------------
    // CARD 1: CLIENTE (Buscador con 3 recientes al hacer clic y selector mundial de país)
    // ------------------------------------------------------------------------
    const cardCliente = document.createElement('div');
    cardCliente.className = 'p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4';
    cardCliente.innerHTML = `
      <div class="flex items-center justify-between gap-4">
        <div class="flex items-center gap-2.5">
          <span class="w-7 h-7 rounded-lg bg-brand-soft dark:bg-brand/20 text-brand flex items-center justify-center text-sm font-bold">
            <i class="fa-regular fa-user"></i>
          </span>
          <h2 class="text-sm font-bold text-slate-900 dark:text-white">Cliente *</h2>
        </div>
        <div id="toggle-cliente-casual-container"></div>
      </div>

      <!-- Buscador de clientes registrados -->
      <div id="section-cliente-registrado" class="space-y-3 ${formData.cliente_casual ? 'hidden' : ''}">
        <div class="relative">
          <i class="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
          <input type="text" id="inp-buscar-cliente" placeholder="Buscar cliente por nombre, RUC o teléfono..." autocomplete="off"
            class="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand transition" />
          <div id="dropdown-clientes-results" class="hidden absolute z-30 left-0 right-0 top-full mt-1.5 max-h-60 overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl divide-y divide-slate-100 dark:divide-slate-800"></div>
        </div>

        <div id="card-cliente-seleccionado" class="${formData.cliente_nombre ? '' : 'hidden'} p-4 rounded-xl bg-brand-soft/40 dark:bg-brand/10 border border-brand/30 flex items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <span class="w-10 h-10 rounded-full bg-brand text-white flex items-center justify-center font-bold text-sm">
              <i class="fa-solid fa-user"></i>
            </span>
            <div>
              <div class="text-xs font-bold text-slate-900 dark:text-white" id="lbl-cliente-nombre">${escapeHtml(formData.cliente_nombre)}</div>
              <div class="text-[11px] text-slate-500" id="lbl-cliente-detalles">
                ${escapeHtml(formData.cliente_telefono || '')} ${formData.cliente_ruc ? `· RUC: ${escapeHtml(formData.cliente_ruc)}` : ''}
              </div>
            </div>
          </div>
          <button type="button" id="btn-cambiar-cliente" class="text-xs font-semibold text-brand hover:underline cursor-pointer">
            Cambiar cliente
          </button>
        </div>
      </div>

      <!-- Sección Cliente Casual -->
      <div id="section-cliente-casual" class="grid grid-cols-1 sm:grid-cols-2 gap-4 ${formData.cliente_casual ? '' : 'hidden'}">
        <div class="sm:col-span-2">
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Nombre Completo del Cliente *</label>
          <input type="text" id="inp-casual-nombre" placeholder="Nombre y apellido o razón social..." 
            class="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand transition"
            value="${escapeHtml(formData.cliente_nombre)}" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">WhatsApp del Cliente (Internacional) *</label>
          <div class="flex items-center gap-2">
            <div id="country-picker-container"></div>
            <input type="tel" id="inp-casual-telefono" placeholder="Ej: 986901117 (sin 0)" 
              class="flex-1 px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand transition font-mono"
              value="${escapeHtml(String(formData.cliente_telefono || '').replace(/^\+[0-9]{1,4}|^0+/, ''))}" />
          </div>
          <span class="text-[10px] text-slate-400 mt-1 block">Prefijo seleccionado con número sin 0 inicial</span>
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">RUC o Documento (Opcional)</label>
          <input type="text" id="inp-casual-ruc" placeholder="Ej: 4589622-1" 
            class="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand transition"
            value="${escapeHtml(formData.cliente_ruc)}" />
        </div>
      </div>
    `;

    // Selector Mundial de País para WhatsApp
    let selectedCountryCode = '+595';
    const countryPicker = createCountryCodePicker({
      defaultCode: '+595',
      onSelect: (c) => {
        selectedCountryCode = c.code;
        formData.country_code = c.code;
        const raw = cardCliente.querySelector('#inp-casual-telefono')?.value.trim().replace(/^0+/, '') || '';
        formData.cliente_telefono = raw ? `${selectedCountryCode}${raw}` : '';
      },
    });
    cardCliente.querySelector('#country-picker-container')?.appendChild(countryPicker.element);

    // Switch Cliente Casual
    const toggleCasual = createIOSToggle({
      label: 'Cliente casual',
      checked: formData.cliente_casual,
      onChange: (checked) => {
        formData.cliente_casual = checked;
        const secReg = cardCliente.querySelector('#section-cliente-registrado');
        const secCas = cardCliente.querySelector('#section-cliente-casual');
        if (checked) {
          secReg?.classList.add('hidden');
          secCas?.classList.remove('hidden');
        } else {
          secReg?.classList.remove('hidden');
          secCas?.classList.add('hidden');
        }
      },
    });
    cardCliente.querySelector('#toggle-cliente-casual-container')?.appendChild(toggleCasual.element);

    // Requisito 4: Buscador de Cliente con vista previa de 3 clientes al hacer clic o filtrar
    const inpSearchClient = cardCliente.querySelector('#inp-buscar-cliente');
    const dropdownClientResults = cardCliente.querySelector('#dropdown-clientes-results');

    setupAutocompleteDropdown({
      inputEl: inpSearchClient,
      dropdownEl: dropdownClientResults,
      fetchItems: async (q) => {
        const url = q ? `/api/clientes?q=${encodeURIComponent(q)}&page_size=5` : `/api/clientes?page_size=3`;
        return apiFetch(url);
      },
      renderItemHtml: (c) => {
        const nom = c.nombres ? `${c.nombres} ${c.apellidos || ''}`.trim() : c.razon_social || 'Cliente';
        const doc = c.numero_documento || c.ruc || 'S/D';
        const wa = c.whatsappCompleto || c.whatsapp_completo ||
                   (c.whatsappNumero ? ((c.whatsappCodigo || '+595') + ' ' + c.whatsappNumero) : '') ||
                   c.celular || c.whatsapp || c.telefono || 'Sin WhatsApp';
        return `
          <div class="autocomplete-item p-3 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition flex items-center justify-between gap-3"
            data-item-id="${c.id}">
            <div>
              <div class="text-xs font-bold text-slate-800 dark:text-slate-200">${escapeHtml(nom)}</div>
              <div class="text-[11px] text-slate-400">RUC: ${escapeHtml(doc)} · WhatsApp: <span class="text-emerald-600 font-mono font-bold">${escapeHtml(wa)}</span></div>
            </div>
            <i class="fa-solid fa-chevron-right text-slate-300 text-xs"></i>
          </div>
        `;
      },
      onSelectItem: (c) => {
        const nom = c.nombres ? `${c.nombres} ${c.apellidos || ''}`.trim() : c.razon_social || 'Cliente';
        const wa = c.whatsappCompleto || c.whatsapp_completo ||
                   (c.whatsappNumero ? ((c.whatsappCodigo || '+595') + c.whatsappNumero) : '') ||
                   c.celular || c.whatsapp || c.telefono || '';

        formData.cliente_id = c.id;
        formData.cliente_nombre = nom;

        // RUC / CI: Si no tiene RUC registrado, tomar el Número de Documento (CI)
        let docCliente = '';
        const rucVal = (c.ruc && typeof c.ruc === 'string' && c.ruc.trim() !== '') ? c.ruc.trim() : '';
        const numDocVal = (c.numeroDocumento || c.numero_documento || '').trim();
        const rucBaseVal = (c.rucBase || c.ruc_base || '').trim();

        if (c.tipoCliente === 'empresa' || c.tipo_cliente === 'empresa') {
          docCliente = rucVal || rucBaseVal || numDocVal;
        } else {
          // Persona física: si no tiene RUC registrado, tomar el Número de documento (CI)
          docCliente = rucVal || numDocVal || rucBaseVal;
        }

        formData.cliente_ruc = docCliente;
        formData.cliente_telefono = wa;
        formData.cliente_direccion = c.direccion || '';

        cardCliente.querySelector('#lbl-cliente-nombre').textContent = formData.cliente_nombre;
        cardCliente.querySelector('#lbl-cliente-detalles').textContent = `${formData.cliente_telefono || 'Sin número'} · RUC / CI: ${formData.cliente_ruc || 'S/D'}`;
        cardCliente.querySelector('#card-cliente-seleccionado')?.classList.remove('hidden');
        inpSearchClient.value = '';
      },
    });

    cardCliente.querySelector('#btn-cambiar-cliente')?.addEventListener('click', () => {
      formData.cliente_id = null;
      formData.cliente_nombre = '';
      formData.cliente_ruc = '';
      formData.cliente_telefono = '';
      formData.cliente_direccion = '';
      cardCliente.querySelector('#card-cliente-seleccionado')?.classList.add('hidden');
      inpSearchClient?.focus();
    });

    // Inputs de cliente casual
    cardCliente.querySelector('#inp-casual-nombre')?.addEventListener('input', (e) => {
      formData.cliente_nombre = e.target.value.trim();
    });
    cardCliente.querySelector('#inp-casual-ruc')?.addEventListener('input', (e) => {
      formData.cliente_ruc = e.target.value.trim();
    });
    cardCliente.querySelector('#inp-casual-telefono')?.addEventListener('input', (e) => {
      const raw = e.target.value.trim().replace(/^0+/, '');
      formData.cliente_telefono = raw ? `${selectedCountryCode}${raw}` : '';
    });

    colLeft.appendChild(cardCliente);

    // ------------------------------------------------------------------------
    // CARD 2: PARÁMETROS Y CONDICIONES DE EMISIÓN
    // ------------------------------------------------------------------------
    const cardParametros = document.createElement('div');
    cardParametros.className = 'p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4';
    cardParametros.innerHTML = `
      <div class="flex items-center gap-2.5">
        <span class="w-7 h-7 rounded-lg bg-brand-soft dark:bg-brand/20 text-brand flex items-center justify-center text-sm font-bold">
          <i class="fa-regular fa-calendar"></i>
        </span>
        <h2 class="text-sm font-bold text-slate-900 dark:text-white">Parámetros y Condiciones de Emisión</h2>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
        <div>
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Fecha de Emisión *</label>
          <input type="date" id="inp-fecha-emision" class="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand transition"
            value="${formData.fecha_emision}" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Validez de la Oferta (días)</label>
          <div id="counter-validez-container"></div>
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Moneda Oficial</label>
          <input type="text" readonly value="Guaraníes (Gs.) — Sin decimales" class="w-full px-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-500 font-semibold cursor-not-allowed" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Régimen IVA (Paraguay)</label>
          <select id="sel-regimen-iva" class="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand transition">
            <option value="Exento de IVA" ${formData.regimen_iva === 'Exento de IVA' ? 'selected' : ''}>Exento de IVA</option>
            <option value="IVA 10%" ${formData.regimen_iva === 'IVA 10%' ? 'selected' : ''}>IVA 10% Incluido</option>
            <option value="IVA 5%" ${formData.regimen_iva === 'IVA 5%' ? 'selected' : ''}>IVA 5% Incluido</option>
          </select>
        </div>
      </div>
    `;

    const validezCounter = createQuantityCounter({
      value: formData.validez_dias || 15,
      min: 1,
      onChange: (val) => {
        formData.validez_dias = val;
      },
    });
    cardParametros.querySelector('#counter-validez-container')?.appendChild(validezCounter.element);

    cardParametros.querySelector('#inp-fecha-emision')?.addEventListener('change', (e) => {
      formData.fecha_emision = e.target.value;
    });
    cardParametros.querySelector('#sel-regimen-iva')?.addEventListener('change', (e) => {
      formData.regimen_iva = e.target.value;
    });

    colLeft.appendChild(cardParametros);

    // ------------------------------------------------------------------------
    // CARD 3: ÍTEMS Y PRODUCTOS (Buscador con 3 productos al hacer clic; Proveedor con 3)
    // ------------------------------------------------------------------------
    const cardItems = document.createElement('div');
    cardItems.className = 'p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4';
    cardItems.innerHTML = `
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-center gap-2.5">
          <span class="w-7 h-7 rounded-lg bg-brand-soft dark:bg-brand/20 text-brand flex items-center justify-center text-sm font-bold">
            <i class="fa-solid fa-cube"></i>
          </span>
          <h2 class="text-sm font-bold text-slate-900 dark:text-white">Ítems y Productos del Presupuesto</h2>
        </div>
        <div id="toggle-producto-casual-container"></div>
      </div>

      <!-- Buscador de productos del catálogo (Requisito 5) -->
      <div id="section-item-catalogo" class="space-y-3">
        <div class="relative">
          <i class="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
          <input type="text" id="inp-buscar-producto" placeholder="Buscar producto por nombre, SKU o código de barras para agregar..." autocomplete="off"
            class="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand transition" />
          <div id="dropdown-productos-results" class="hidden absolute z-30 left-0 right-0 top-full mt-1.5 max-h-60 overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl divide-y divide-slate-100 dark:divide-slate-800"></div>
        </div>
      </div>

      <!-- Formulario para agregar producto casual o libre -->
      <div id="section-item-casual" class="hidden p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 space-y-3">
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div class="sm:col-span-3">
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Descripción / Nombre del Ítem *</label>
            <input type="text" id="inp-casual-item-nombre" placeholder="Ej: Taza blanca sublimada personalizada..." 
              class="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand transition" />
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Precio Unitario (Gs.) *</label>
            <input type="text" id="inp-casual-item-precio" placeholder="0 Gs." 
              class="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand transition font-mono font-bold" />
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Cantidad *</label>
            <div id="counter-casual-item-qty"></div>
          </div>
          <div class="flex items-end">
            <button type="button" id="btn-add-casual-item" class="w-full py-2 px-4 rounded-xl bg-brand text-white text-xs font-bold hover:bg-brand-hover active:bg-brand-active shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer">
              <i class="fa-solid fa-plus"></i>
              <span>Agregar Ítem</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Tarjeta opcional de Proveedor y Costo (Requisito 6 y Selección Múltiple) -->
      <div id="box-proveedor-card" class="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-800/30 border border-slate-200/80 dark:border-slate-700/50 space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-3 pb-2.5 border-b border-slate-200/60 dark:border-slate-800">
          <div class="flex items-center gap-2">
            <span class="w-6 h-6 rounded-lg bg-brand-soft dark:bg-brand/20 text-brand flex items-center justify-center text-xs">
              <i class="fa-solid fa-truck-field"></i>
            </span>
            <span class="text-xs font-bold text-slate-800 dark:text-slate-200">Proveedor y Costos de Compra (Opcional)</span>
          </div>
          <div class="flex flex-wrap items-center gap-3">
            <div id="item-target-selector-box" class="flex items-center gap-1.5 text-xs">
              <label for="sel-prov-target-item" class="text-[11px] text-slate-500 font-medium">Asignar a:</label>
              <select id="sel-prov-target-item" class="px-2.5 py-1 text-xs rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-semibold focus:outline-none focus:border-brand">
              </select>
            </div>
            <div id="toggle-prov-casual-container"></div>
          </div>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div class="sm:col-span-1 relative" id="box-prov-search">
            <label class="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Proveedor Registrado</label>
            <input type="text" id="inp-buscar-proveedor" placeholder="Buscar proveedor en base de datos..." autocomplete="off"
              class="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand transition" />
            <div id="dropdown-proveedores-results" class="hidden absolute z-30 left-0 right-0 top-full mt-1.5 max-h-56 overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl divide-y divide-slate-100 dark:divide-slate-800"></div>
          </div>
          <div class="sm:col-span-1 hidden" id="box-prov-casual">
            <label class="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Proveedor Casual</label>
            <input type="text" id="inp-prov-casual-nombre" placeholder="Nombre de proveedor casual..." 
              class="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand transition" />
          </div>
          <div>
            <label class="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Costo Unitario de Compra</label>
            <input type="text" id="inp-prov-costo" placeholder="0 Gs." 
              class="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand transition font-mono font-bold" />
          </div>
          <div>
            <label class="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Cantidad a Comprar</label>
            <div id="counter-prov-qty"></div>
          </div>
        </div>
      </div>

      <!-- Tabla de ítems agregados con bordes definidos -->
      <div class="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs">
        <table class="w-full text-left text-xs border-collapse">
          <thead>
            <tr class="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              <th class="py-2.5 px-3 w-8 border-r border-slate-200 dark:border-slate-800">#</th>
              <th class="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800">ÍTEM / PRODUCTO</th>
              <th class="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800">PRECIO UNITARIO</th>
              <th class="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800">CANTIDAD</th>
              <th class="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800">SUBTOTAL</th>
              <th class="py-2.5 px-3 text-right">ACCIONES</th>
            </tr>
          </thead>
          <tbody id="tbody-budget-items" class="divide-y divide-slate-100 dark:divide-slate-800">
          </tbody>
        </table>
      </div>
    `;

    // Toggle Producto Casual
    let isCasualProductActive = false;
    const toggleProdCasual = createIOSToggle({
      label: 'Producto casual',
      checked: false,
      onChange: (checked) => {
        isCasualProductActive = checked;
        const secCat = cardItems.querySelector('#section-item-catalogo');
        const secCas = cardItems.querySelector('#section-item-casual');
        if (checked) {
          secCat?.classList.add('hidden');
          secCas?.classList.remove('hidden');
        } else {
          secCat?.classList.remove('hidden');
          secCas?.classList.add('hidden');
        }
      },
    });
    cardItems.querySelector('#toggle-producto-casual-container')?.appendChild(toggleProdCasual.element);

    // Toggle Proveedor Casual y Sincronización Multi-Proveedor
    let isCasualProvActive = false;
    let selectedProvId = null;
    let selectedProvNombre = '';
    let selectedProvRuc = '';
    let activeProvItemIndex = 0;

    function updateTargetItemDropdown() {
      const selTarget = cardItems.querySelector('#sel-prov-target-item');
      if (!selTarget) return;
      if (formData.items.length === 0) {
        selTarget.innerHTML = '<option value="-1">(Agregue un ítem al presupuesto)</option>';
        selTarget.disabled = true;
        return;
      }
      selTarget.disabled = false;
      if (activeProvItemIndex >= formData.items.length) {
        activeProvItemIndex = formData.items.length - 1;
      }
      if (activeProvItemIndex < 0) {
        activeProvItemIndex = 0;
      }
      selTarget.innerHTML = formData.items
        .map((it, idx) => {
          const provTag = it.proveedor_nombre ? ` [Prov: ${escapeHtml(it.proveedor_nombre)}]` : '';
          return `<option value="${idx}" ${idx === activeProvItemIndex ? 'selected' : ''}>#${idx + 1}: ${escapeHtml(it.descripcion || 'Ítem ' + (idx + 1))}${provTag}</option>`;
        })
        .join('');
    }

    function loadProviderForActiveItem() {
      if (activeProvItemIndex < 0 || activeProvItemIndex >= formData.items.length) {
        selectedProvId = null;
        selectedProvNombre = '';
        selectedProvRuc = '';
        const inpP = cardItems.querySelector('#inp-buscar-proveedor');
        if (inpP) inpP.value = '';
        const inpC = cardItems.querySelector('#inp-prov-casual-nombre');
        if (inpC) inpC.value = '';
        const inpCosto = cardItems.querySelector('#inp-prov-costo');
        if (inpCosto) inpCosto.value = '';
        counterProvQty.setValue(1);
        return;
      }
      const it = formData.items[activeProvItemIndex];
      selectedProvId = it.proveedor_id || null;
      selectedProvNombre = it.proveedor_nombre || '';
      isCasualProvActive = Boolean(it.proveedor_casual);
      toggleProvCasual.setChecked(isCasualProvActive);

      const boxS = cardItems.querySelector('#box-prov-search');
      const boxC = cardItems.querySelector('#box-prov-casual');
      if (isCasualProvActive) {
        boxS?.classList.add('hidden');
        boxC?.classList.remove('hidden');
        const inpC = cardItems.querySelector('#inp-prov-casual-nombre');
        if (inpC) inpC.value = selectedProvNombre;
      } else {
        boxS?.classList.remove('hidden');
        boxC?.classList.add('hidden');
        const inpP = cardItems.querySelector('#inp-buscar-proveedor');
        if (inpP) inpP.value = selectedProvNombre;
      }

      const inpCosto = cardItems.querySelector('#inp-prov-costo');
      if (inpCosto) {
        inpCosto.value = it.proveedor_costo > 0 ? formatGs(it.proveedor_costo) : '';
      }

      provItemQty = it.proveedor_cantidad > 0 ? it.proveedor_cantidad : (it.cantidad || 1);
      counterProvQty.setValue(provItemQty);
    }

    function syncProviderToCurrentItem() {
      if (isBuildingForm) return;
      if (!formData.items || formData.items.length === 0) return;
      if (activeProvItemIndex < 0 || activeProvItemIndex >= formData.items.length) return;

      const targetItem = formData.items[activeProvItemIndex];
      const prNom = isCasualProvActive
        ? cardItems.querySelector('#inp-prov-casual-nombre')?.value.trim()
        : selectedProvNombre;
      const prID = isCasualProvActive ? null : selectedProvId;
      const prCosto = unformatGs(cardItems.querySelector('#inp-prov-costo')?.value);
      const prCant = provItemQty > 0 ? provItemQty : (targetItem.cantidad || 1);

      targetItem.proveedor_id = prID;
      targetItem.proveedor_casual = isCasualProvActive;
      targetItem.proveedor_nombre = prNom || '';
      targetItem.proveedor_costo = prCosto;
      targetItem.proveedor_cantidad = prCant;

      updateTargetItemDropdown();
      renderItemsTable(false);
    }

    const toggleProvCasual = createIOSToggle({
      label: 'Proveedor casual',
      checked: false,
      onChange: (checked) => {
        isCasualProvActive = checked;
        const boxS = cardItems.querySelector('#box-prov-search');
        const boxC = cardItems.querySelector('#box-prov-casual');
        if (checked) {
          boxS?.classList.add('hidden');
          boxC?.classList.remove('hidden');
        } else {
          boxS?.classList.remove('hidden');
          boxC?.classList.add('hidden');
        }
        syncProviderToCurrentItem();
      },
    });
    cardItems.querySelector('#toggle-prov-casual-container')?.appendChild(toggleProvCasual.element);

    let casualItemQty = 1;
    const counterCasualQty = createQuantityCounter({
      value: 1,
      min: 1,
      onChange: (val) => {
        casualItemQty = val;
      },
    });
    cardItems.querySelector('#counter-casual-item-qty')?.appendChild(counterCasualQty.element);

    let provItemQty = 1;
    const counterProvQty = createQuantityCounter({
      value: 1,
      min: 1,
      onChange: (val) => {
        provItemQty = val;
        syncProviderToCurrentItem();
      },
    });
    cardItems.querySelector('#counter-prov-qty')?.appendChild(counterProvQty.element);

    cardItems.querySelector('#sel-prov-target-item')?.addEventListener('change', (e) => {
      activeProvItemIndex = Number(e.target.value);
      loadProviderForActiveItem();
    });

    // Requisito 5: Buscador de Productos con vista previa de 3 al hacer clic
    const inpSearchProd = cardItems.querySelector('#inp-buscar-producto');
    const dropdownProdResults = cardItems.querySelector('#dropdown-productos-results');

    setupAutocompleteDropdown({
      inputEl: inpSearchProd,
      dropdownEl: dropdownProdResults,
      fetchItems: async (q) => {
        const url = q ? `/api/productos?q=${encodeURIComponent(q)}&page_size=5` : `/api/productos?page_size=3`;
        return apiFetch(url);
      },
      renderItemHtml: (p) => {
        const precio = Number(p.precioVenta ?? p.precio_venta ?? p.precio ?? 0);
        const img = p.fotoPrincipal || p.foto_principal || p.imagenPrincipal || p.imagen_principal || p.imagenUrl || p.imagen_url || '';
        const sku = p.sku || p.SKU || '';
        return `
          <div class="autocomplete-item p-3 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition flex items-center justify-between gap-3"
            data-item-id="${p.id}">
            <div class="flex items-center gap-3">
              <img src="${escapeHtml(img || '/logo/R1.png')}" class="w-10 h-10 rounded-lg object-contain bg-white dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700 shadow-2xs" onerror="this.src='/logo/R1.png'" />
              <div>
                <div class="text-xs font-bold text-slate-800 dark:text-slate-200">${escapeHtml(p.nombre)}</div>
                <div class="text-[10px] text-slate-400">
                  ${sku ? `SKU: ${escapeHtml(sku)} · ` : ''}
                  <span class="font-bold text-brand font-mono">${formatGs(precio)}</span>
                </div>
              </div>
            </div>
            <span class="px-2.5 py-1 rounded-lg bg-brand text-white text-[10px] font-bold">Agregar</span>
          </div>
        `;
      },
      onSelectItem: (p) => {
        const precio = Number(p.precioVenta ?? p.precio_venta ?? p.precio ?? 0);
        const img = p.fotoPrincipal || p.foto_principal || p.imagenPrincipal || p.imagen_principal || p.imagenUrl || p.imagen_url || '';
        const sku = p.sku || p.SKU || '';
        const fotosGaleria = Array.isArray(p.galeriaFotos) ? p.galeriaFotos : (Array.isArray(p.galeria_fotos) ? p.galeria_fotos : []);

        let prID = selectedProvId;
        let prNom = selectedProvNombre;
        let prCosto = unformatGs(cardItems.querySelector('#inp-prov-costo')?.value);
        if (isCasualProvActive) {
          prNom = cardItems.querySelector('#inp-prov-casual-nombre')?.value.trim() || '';
          prID = null;
        }

        addItemToBudget({
          producto_id: p.id,
          es_no_registrado: false,
          descripcion: p.nombre,
          sku: sku,
          precio_unitario: precio,
          cantidad: 1,
          total: precio,
          imagen_url: img || '/logo/R1.png',
          proveedor_id: prID,
          proveedor_casual: isCasualProvActive,
          proveedor_nombre: prNom,
          proveedor_costo: prCosto,
          proveedor_cantidad: provItemQty,
        });

        // Requisito 7: Traer automáticamente las fotos de la galería del producto a la Hoja 3
        if (img) {
          addPhotoToGallery({
            producto_id: p.id,
            nombre: p.nombre,
            url: img,
            visible: true,
            visible_pdf: true,
          });
        }
        fotosGaleria.forEach((fotoUrl, fIdx) => {
          if (fotoUrl && fotoUrl !== img) {
            addPhotoToGallery({
              producto_id: p.id,
              nombre: `${p.nombre} (Foto ${fIdx + 1})`,
              url: fotoUrl,
              visible: true,
              visible_pdf: true,
            });
          }
        });

        inpSearchProd.value = '';
      },
    });

    // Requisito 6: Buscador de Proveedor con vista previa de 3 al hacer clic (Muestra Razón Social y RUC)
    const inpSearchProv = cardItems.querySelector('#inp-buscar-proveedor');
    const dropdownProvResults = cardItems.querySelector('#dropdown-proveedores-results');

    setupAutocompleteDropdown({
      inputEl: inpSearchProv,
      dropdownEl: dropdownProvResults,
      fetchItems: async (q) => {
        const url = q ? `/api/proveedores?q=${encodeURIComponent(q)}&page_size=5` : `/api/proveedores?page_size=3`;
        return apiFetch(url);
      },
      renderItemHtml: (pr) => {
        const nom = (pr.razonSocial || pr.razon_social || pr.nombreComercial || pr.nombre_comercial || pr.nombre || pr.contactoNombre || pr.contacto_nombre || pr.rubro || (pr.id ? `Proveedor #${pr.id}` : 'Proveedor')).trim();
        const doc = (pr.rucDocumento || pr.ruc_documento || pr.ruc || pr.documento || pr.numeroDocumento || pr.numero_documento || '').trim() || 'S/D';
        return `
          <div class="autocomplete-item p-3 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition flex items-center justify-between gap-2"
            data-item-id="${pr.id}">
            <div>
              <div class="text-xs font-bold text-slate-800 dark:text-slate-200">${escapeHtml(nom)}</div>
              <div class="text-[10px] text-slate-400">RUC: <span class="font-mono font-bold">${escapeHtml(doc)}</span></div>
            </div>
            <i class="fa-solid fa-check text-slate-300 text-xs"></i>
          </div>
        `;
      },
      onSelectItem: (pr) => {
        const nom = (pr.razonSocial || pr.razon_social || pr.nombreComercial || pr.nombre_comercial || pr.nombre || pr.contactoNombre || pr.contacto_nombre || 'Proveedor').trim();
        const doc = (pr.rucDocumento || pr.ruc_documento || pr.ruc || pr.documento || pr.numeroDocumento || pr.numero_documento || '').trim();
        selectedProvId = pr.id;
        selectedProvNombre = nom;
        selectedProvRuc = doc;
        inpSearchProv.value = `${nom}${doc && doc !== 'S/D' ? ` (${doc})` : ''}`;
        syncProviderToCurrentItem();
      },
    });

    // Listeners de cambios en proveedor casual y costo
    cardItems.querySelector('#inp-prov-casual-nombre')?.addEventListener('input', () => {
      syncProviderToCurrentItem();
    });

    cardItems.querySelector('#inp-prov-costo')?.addEventListener('input', (e) => {
      const v = unformatGs(e.target.value);
      e.target.value = v > 0 ? formatGs(v) : '';
      syncProviderToCurrentItem();
    });

    // Agregar producto casual
    cardItems.querySelector('#btn-add-casual-item')?.addEventListener('click', () => {
      const desc = cardItems.querySelector('#inp-casual-item-nombre')?.value.trim();
      const precio = unformatGs(cardItems.querySelector('#inp-casual-item-precio')?.value);
      if (!desc) {
        toast.error('Ingrese la descripción del ítem');
        return;
      }
      if (precio <= 0) {
        toast.error('Ingrese un precio unitario válido');
        return;
      }

      let prID = selectedProvId;
      let prNom = selectedProvNombre;
      let prCosto = unformatGs(cardItems.querySelector('#inp-prov-costo')?.value);
      if (isCasualProvActive) {
        prNom = cardItems.querySelector('#inp-prov-casual-nombre')?.value.trim() || '';
        prID = null;
      }

      addItemToBudget({
        producto_id: null,
        es_no_registrado: true,
        descripcion: desc,
        sku: 'CASUAL',
        precio_unitario: precio,
        cantidad: casualItemQty,
        total: precio * casualItemQty,
        imagen_url: '/logo/R1.png',
        proveedor_id: prID,
        proveedor_casual: isCasualProvActive,
        proveedor_nombre: prNom,
        proveedor_costo: prCosto,
        proveedor_cantidad: provItemQty,
      });

      cardItems.querySelector('#inp-casual-item-nombre').value = '';
      cardItems.querySelector('#inp-casual-item-precio').value = '';
      counterCasualQty.setValue(1);
    });

    // Precargar datos del proveedor del ítem seleccionado si ya estuvieran guardados
    if (formData.items.length > 0) {
      activeProvItemIndex = 0;
      updateTargetItemDropdown();
      loadProviderForActiveItem();
    }

    colLeft.appendChild(cardItems);

    // ------------------------------------------------------------------------
    // CARD 4: SERVICIOS OPCIONALES
    // ------------------------------------------------------------------------
    const cardServicios = document.createElement('div');
    cardServicios.className = 'p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4';
    cardServicios.innerHTML = `
      <div class="flex items-center justify-between gap-4">
        <div class="flex items-center gap-2.5">
          <span class="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-sm font-bold">
            <i class="fa-solid fa-list-check"></i>
          </span>
          <div>
            <h2 class="text-sm font-bold text-slate-900 dark:text-white">Servicios Opcionales</h2>
            <p class="text-[11px] text-slate-400">Ítems adicionales o complementarios que se listan en una tabla separada en el PDF.</p>
          </div>
        </div>
        <button type="button" id="btn-add-servicio" class="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer">
          <i class="fa-solid fa-plus"></i>
          <span>Agregar Servicio Opcional</span>
        </button>
      </div>

      <div class="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs">
        <table class="w-full text-left text-xs border-collapse">
          <thead>
            <tr class="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              <th class="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800">DESCRIPCIÓN DEL SERVICIO / ÍTEM</th>
              <th class="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800">PRECIO UNITARIO</th>
              <th class="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800">CANTIDAD</th>
              <th class="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800">SUBTOTAL</th>
              <th class="py-2.5 px-3 text-right">ACCIONES</th>
            </tr>
          </thead>
          <tbody id="tbody-servicios-items" class="divide-y divide-slate-100 dark:divide-slate-800">
          </tbody>
        </table>
      </div>
    `;

    cardServicios.querySelector('#btn-add-servicio')?.addEventListener('click', () => {
      openAddServicioModal();
    });

    colLeft.appendChild(cardServicios);

    // ------------------------------------------------------------------------
    // CARD 5: CUADRO DE DESCUENTO / PROMOCIÓN (PDF)
    // ------------------------------------------------------------------------
    const cardDescuento = document.createElement('div');
    cardDescuento.className = 'p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4';
    cardDescuento.innerHTML = `
      <div class="flex items-center justify-between gap-4">
        <div class="flex items-center gap-2.5">
          <span class="w-7 h-7 rounded-lg bg-brand-soft dark:bg-brand/20 text-brand flex items-center justify-center text-sm font-bold">
            <i class="fa-solid fa-tag"></i>
          </span>
          <div>
            <h2 class="text-sm font-bold text-slate-900 dark:text-white">Cuadro de Descuento / Promoción (PDF)</h2>
            <p class="text-[11px] text-slate-400">Insignia o recuadro promocional destacado junto a los totales en la Página 2 del PDF.</p>
          </div>
        </div>
        <div id="toggle-visible-descuento-container"></div>
      </div>

      <div>
        <div class="flex items-center justify-between mb-1.5">
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">Texto del Descuento / Promoción a mostrar en el PDF:</label>
          <div class="flex items-center gap-1.5 text-[10px]">
            <span class="text-slate-400">Variables:</span>
            <button type="button" class="btn-insert-tag px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-brand-soft hover:text-brand font-mono font-bold transition cursor-pointer" data-tag="{descuento_porcentaje}">{descuento_porcentaje}</button>
            <button type="button" class="btn-insert-tag px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-brand-soft hover:text-brand font-mono font-bold transition cursor-pointer" data-tag="{descuento_monto}">{descuento_monto}</button>
            <button type="button" id="btn-reset-desc-tpl" class="text-brand hover:underline font-semibold cursor-pointer">Restablecer</button>
          </div>
        </div>
        <input type="text" id="inp-texto-descuento" class="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand transition font-bold text-brand"
          value="${escapeHtml(formData.leyenda_descuento)}" />
      </div>

      <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 flex flex-wrap items-center justify-between gap-2">
        <div>
          <span class="text-[11px] text-slate-400 block">Aspecto visual en el PDF:</span>
          <span class="text-[10px] text-slate-400" id="badge-descuento-hint"></span>
        </div>
        <span class="px-3 py-1 rounded-md text-xs font-black tracking-wider uppercase border border-red-300 text-red-600 bg-red-50 dark:bg-red-950/40" id="preview-badge-descuento">
          ${escapeHtml(formData.leyenda_descuento)}
        </span>
      </div>
    `;

    const toggleDesc = createIOSToggle({
      label: 'Visible en PDF',
      checked: formData.mostrar_descuento_pdf,
      onChange: (checked) => {
        formData.mostrar_descuento_pdf = checked;
      },
    });
    cardDescuento.querySelector('#toggle-visible-descuento-container')?.appendChild(toggleDesc.element);

    cardDescuento.querySelector('#inp-texto-descuento')?.addEventListener('input', (e) => {
      formData.leyenda_descuento = e.target.value;
      recalculateTotals();
    });

    cardDescuento.querySelectorAll('.btn-insert-tag').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tag = btn.getAttribute('data-tag');
        const inp = cardDescuento.querySelector('#inp-texto-descuento');
        if (inp && tag) {
          const start = inp.selectionStart ?? inp.value.length;
          const end = inp.selectionEnd ?? inp.value.length;
          const val = inp.value;
          inp.value = val.substring(0, start) + tag + val.substring(end);
          formData.leyenda_descuento = inp.value;
          inp.focus();
          inp.setSelectionRange(start + tag.length, start + tag.length);
          recalculateTotals();
        }
      });
    });

    cardDescuento.querySelector('#btn-reset-desc-tpl')?.addEventListener('click', () => {
      const inp = cardDescuento.querySelector('#inp-texto-descuento');
      const def = '¡{descuento_porcentaje}% DE DESCUENTO POR PAGO AL CONTADO!';
      if (inp) inp.value = def;
      formData.leyenda_descuento = def;
      recalculateTotals();
    });

    colLeft.appendChild(cardDescuento);

    // ------------------------------------------------------------------------
    // CARD 6: TÉRMINOS Y CONDICIONES DE PAGO (PDF)
    // ------------------------------------------------------------------------
    const cardTerminos = document.createElement('div');
    cardTerminos.className = 'p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4';
    cardTerminos.innerHTML = `
      <div class="flex items-center justify-between gap-4">
        <div class="flex items-center gap-2.5">
          <span class="w-7 h-7 rounded-lg bg-brand-soft dark:bg-brand/20 text-brand flex items-center justify-center text-sm font-bold">
            <i class="fa-regular fa-file-shield"></i>
          </span>
          <h2 class="text-sm font-bold text-slate-900 dark:text-white">Términos y Condiciones de Pago (PDF)</h2>
        </div>
        <button type="button" id="btn-reset-terminos" class="text-xs font-semibold text-brand hover:underline cursor-pointer">
          Restablecer de Configuración
        </button>
      </div>

      <textarea id="txt-terminos-condiciones" rows="4" class="w-full p-3 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand transition leading-relaxed">${escapeHtml(formData.terminos_condiciones.join('\n'))}</textarea>
    `;

    cardTerminos.querySelector('#txt-terminos-condiciones')?.addEventListener('input', (e) => {
      formData.terminos_condiciones = e.target.value.split('\n').filter((l) => l.trim().length > 0);
    });

    cardTerminos.querySelector('#btn-reset-terminos')?.addEventListener('click', () => {
      formData.terminos_condiciones = [
        '1. Validez de la oferta: Este presupuesto tiene una validez de 15 días corridos a partir de su fecha de emisión.',
        '2. Condiciones de pago: El pedido se confirma con la entrega del 60%, por medio de efectivo o transferencia bancaria.',
        '3. Plazos de entrega: Tiempo estimado de 3 a 5 días hábiles posterior a la aprobación del diseño y confirmación de seña.',
        '4. Garantía y cambios: Tratándose de artículos personalizados, no se admiten cancelaciones una vez iniciada la producción.',
      ];
      const ta = cardTerminos.querySelector('#txt-terminos-condiciones');
      if (ta) ta.value = formData.terminos_condiciones.join('\n');
      toast.info('Términos restablecidos');
    });

    colLeft.appendChild(cardTerminos);

    // ------------------------------------------------------------------------
    // CARD 7: OBSERVACIONES O NOTAS ADICIONALES
    // ------------------------------------------------------------------------
    const cardObservaciones = document.createElement('div');
    cardObservaciones.className = 'p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4';
    cardObservaciones.innerHTML = `
      <div class="flex items-center gap-2.5">
        <span class="w-7 h-7 rounded-lg bg-brand-soft dark:bg-brand/20 text-brand flex items-center justify-center text-sm font-bold">
          <i class="fa-regular fa-comment-dots"></i>
        </span>
        <h2 class="text-sm font-bold text-slate-900 dark:text-white">Observaciones o Notas Adicionales</h2>
      </div>

      <textarea id="txt-observaciones" rows="3" placeholder="Comentarios internos o instrucciones especiales para el pedido..." class="w-full p-3 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand transition">${escapeHtml(formData.observaciones)}</textarea>
    `;

    cardObservaciones.querySelector('#txt-observaciones')?.addEventListener('input', (e) => {
      formData.observaciones = e.target.value;
    });

    colLeft.appendChild(cardObservaciones);

    // ------------------------------------------------------------------------
    // CARD 8: HOJA 3: GALERÍA DE FOTOS (con Drag and Drop)
    // ------------------------------------------------------------------------
    const cardGaleria = document.createElement('div');
    cardGaleria.className = 'p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4';
    cardGaleria.innerHTML = `
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-center gap-2.5">
          <span class="w-7 h-7 rounded-lg bg-brand-soft dark:bg-brand/20 text-brand flex items-center justify-center text-sm font-bold">
            <i class="fa-regular fa-images"></i>
          </span>
          <div>
            <h2 class="text-sm font-bold text-slate-900 dark:text-white">Hoja 3: Galería de Fotos de Productos</h2>
            <p class="text-[11px] text-slate-400">Genera una página visual con las fotos de los productos cotizados y fotos adicionales en grilla.</p>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-4">
          <div class="flex items-center gap-1.5">
            <span class="text-xs font-semibold text-slate-600 dark:text-slate-300">Columnas:</span>
            <div id="counter-galeria-cols"></div>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="text-xs font-semibold text-slate-600 dark:text-slate-300">Filas:</span>
            <div id="counter-galeria-rows"></div>
          </div>
          <div id="toggle-visible-galeria-container"></div>
        </div>
      </div>

      <div class="flex items-center justify-between text-xs text-slate-500 border-b border-slate-100 dark:border-slate-800 pb-2">
        <div>
          <span class="font-bold tracking-wider uppercase text-slate-700 dark:text-slate-300" id="lbl-galeria-count">
            GALERÍA DE FOTOS PARA EL PDF (0 FOTOS)
          </span>
          <p class="text-[10px] text-slate-400 mt-0.5">Arrastre y suelte las tarjetas para definir el orden en la Hoja 3. Puede editar el nombre que se imprimirá debajo de cada foto.</p>
        </div>
        <button type="button" id="btn-add-foto-adicional" class="px-3 py-1.5 rounded-xl bg-brand text-white text-xs font-bold hover:bg-brand-hover active:bg-brand-active shadow-xs transition flex items-center gap-1.5 cursor-pointer">
          <i class="fa-solid fa-plus"></i>
          <span>Agregar Foto Adicional</span>
        </button>
      </div>

      <div id="grid-galeria-fotos" class="grid grid-cols-2 sm:grid-cols-4 gap-4 min-h-[120px]">
      </div>
    `;

    // Distribución de fotos: 2 contadores numéricos (columnas y filas, 1 a 6) por defecto 2x4
    let currentCols = formData.galeria_cols || (parseInt(formData.galeria_layout?.split('x')[0]) || 2);
    let currentRows = formData.galeria_rows || (parseInt(formData.galeria_layout?.split('x')[1]) || 4);
    formData.galeria_cols = currentCols;
    formData.galeria_rows = currentRows;
    formData.galeria_layout = `${currentCols}x${currentRows}`;

    const counterCols = createQuantityCounter({
      value: currentCols,
      min: 1,
      onChange: (v) => {
        currentCols = Math.min(6, Math.max(1, v));
        formData.galeria_cols = currentCols;
        formData.galeria_layout = `${currentCols}x${currentRows}`;
      },
    });
    cardGaleria.querySelector('#counter-galeria-cols')?.appendChild(counterCols.element);

    const counterRows = createQuantityCounter({
      value: currentRows,
      min: 1,
      onChange: (v) => {
        currentRows = Math.min(6, Math.max(1, v));
        formData.galeria_rows = currentRows;
        formData.galeria_layout = `${currentCols}x${currentRows}`;
      },
    });
    cardGaleria.querySelector('#counter-galeria-rows')?.appendChild(counterRows.element);

    const toggleGaleria = createIOSToggle({
      label: 'Mostrar Hoja 3 en PDF',
      checked: formData.mostrar_galeria_pdf,
      onChange: (checked) => {
        formData.mostrar_galeria_pdf = checked;
      },
    });
    cardGaleria.querySelector('#toggle-visible-galeria-container')?.appendChild(toggleGaleria.element);

    cardGaleria.querySelector('#btn-add-foto-adicional')?.addEventListener('click', () => {
      openAddAdditionalPhotoModal();
    });

    colLeft.appendChild(cardGaleria);

    // ------------------------------------------------------------------------
    // COLUMNA DERECHA: RESUMEN DE LIQUIDACIÓN Y BOTONES
    // ------------------------------------------------------------------------
    const cardLiquidacion = document.createElement('div');
    cardLiquidacion.className = 'p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-5';
    cardLiquidacion.innerHTML = `
      <div class="flex items-center gap-2.5">
        <span class="w-7 h-7 rounded-lg bg-brand-soft dark:bg-brand/20 text-brand flex items-center justify-center text-sm font-bold">
          <i class="fa-solid fa-calculator"></i>
        </span>
        <h2 class="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">RESUMEN DE LIQUIDACIÓN</h2>
      </div>

      <div class="space-y-3 divide-y divide-slate-100 dark:divide-slate-800 text-xs">
        <div class="flex items-center justify-between pt-2">
          <span class="text-slate-500">Subtotal Ítems:</span>
          <span class="font-bold font-mono text-slate-800 dark:text-slate-200" id="lbl-subtotal-items">0 Gs.</span>
        </div>
        <div class="flex items-center justify-between pt-3">
          <span class="text-slate-500">Servicios Opcionales:</span>
          <span class="font-bold font-mono text-slate-800 dark:text-slate-200" id="lbl-subtotal-servicios">0 Gs.</span>
        </div>
        <div class="flex items-center justify-between pt-3">
          <div>
            <span class="text-slate-500">Descuento en Guaraníes:</span>
            <span class="text-[10px] text-red-500 font-mono font-bold block" id="lbl-desc-porcentaje"></span>
          </div>
          <input type="text" id="inp-descuento-guaranies" class="w-32 px-2.5 py-1.5 text-right font-mono font-bold text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-red-600 dark:text-red-400 focus:outline-none focus:border-brand" 
            value="${formatGs(formData.monto_descuento)}" />
        </div>
        <div class="pt-4 p-4 rounded-xl bg-slate-900 dark:bg-slate-950 text-white flex items-center justify-between">
          <div>
            <div class="text-[10px] font-bold uppercase tracking-wider text-slate-400">TOTAL FINAL</div>
            <div class="text-[10px] text-slate-400">Moneda en Guaraníes</div>
          </div>
          <div class="text-2xl font-black font-mono text-white" id="lbl-total-final">0 Gs.</div>
        </div>
      </div>

      <div class="space-y-2 pt-2">
        ${
          isPreview
            ? `
        <button type="button" id="btn-side-editar-presupuesto" class="w-full py-3 px-4 rounded-xl bg-brand text-white text-xs font-bold hover:bg-brand-hover active:bg-brand-active shadow-md transition flex items-center justify-center gap-2 cursor-pointer">
          <i class="fa-solid fa-pen-to-square"></i>
          <span>Editar Presupuesto</span>
        </button>
        <div class="grid grid-cols-2 gap-2">
          <button type="button" id="btn-side-wa" class="py-2.5 px-3 rounded-xl border border-emerald-500/40 text-emerald-600 dark:text-emerald-400 text-xs font-semibold hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition flex items-center justify-center gap-1.5 cursor-pointer">
            <i class="fa-brands fa-whatsapp"></i>
            <span>WhatsApp</span>
          </button>
          <button type="button" id="btn-side-ver-pdf" class="py-2.5 px-3 rounded-xl border border-brand/40 text-brand text-xs font-semibold hover:bg-brand-soft/40 transition flex items-center justify-center gap-1.5 cursor-pointer">
            <i class="fa-regular fa-eye"></i>
            <span>Ver PDF</span>
          </button>
        </div>
        `
            : `
        <button type="button" id="btn-side-guardar-enviar" class="w-full py-3 px-4 rounded-xl bg-brand text-white text-xs font-bold hover:bg-brand-hover active:bg-brand-active shadow-md transition flex items-center justify-center gap-2 cursor-pointer">
          <i class="fa-solid fa-paper-plane"></i>
          <span>Guardar y Enviar</span>
        </button>
        <div class="grid grid-cols-2 gap-2">
          <button type="button" id="btn-side-borrador" class="py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition flex items-center justify-center cursor-pointer">
            Solo Guardar Borrador
          </button>
          <button type="button" id="btn-side-ver-pdf" class="py-2.5 px-3 rounded-xl border border-brand/40 text-brand text-xs font-semibold hover:bg-brand-soft/40 transition flex items-center justify-center gap-1.5 cursor-pointer">
            <i class="fa-regular fa-eye"></i>
            <span>Ver PDF</span>
          </button>
        </div>
        `
        }
      </div>
    `;

    cardLiquidacion.querySelector('#inp-descuento-guaranies')?.addEventListener('input', (e) => {
      formData.monto_descuento = unformatGs(e.target.value);
      recalculateTotals();
    });

    cardLiquidacion.querySelector('#inp-descuento-guaranies')?.addEventListener('change', (e) => {
      formData.monto_descuento = unformatGs(e.target.value);
      e.target.value = formatGs(formData.monto_descuento);
      recalculateTotals();
    });

    cardLiquidacion.querySelector('#btn-side-editar-presupuesto')?.addEventListener('click', () => {
      loadCreateOrEditView(formData.id || formData.numero_presupuesto, { isPreview: false });
    });
    cardLiquidacion.querySelector('#btn-side-wa')?.addEventListener('click', () => {
      openWhatsAppSendModal(formData.id || formData.numero_presupuesto, () => loadCreateOrEditView(formData.id, { isPreview: true }));
    });
    cardLiquidacion.querySelector('#btn-side-guardar-enviar')?.addEventListener('click', saveBudgetAndSend);
    cardLiquidacion.querySelector('#btn-side-borrador')?.addEventListener('click', () => saveBudget('Borrador'));
    cardLiquidacion.querySelector('#btn-side-ver-pdf')?.addEventListener('click', () => handlePreviewDraftPDF(formData, templateConfig));

    colRight.appendChild(cardLiquidacion);

    mainGrid.appendChild(colLeft);
    mainGrid.appendChild(colRight);
    viewContainer.appendChild(mainGrid);

    if (isPreview) {
      // En modo Vista Previa, mostrar los datos completos y ocultar barras de inserción
      if (formData.cliente_nombre) {
        cardCliente.querySelector('#inp-buscar-cliente')?.closest('.relative')?.classList.add('hidden');
        cardCliente.querySelector('#btn-cambiar-cliente')?.classList.add('hidden');
        cardCliente.querySelector('#toggle-cliente-casual-container')?.classList.add('hidden');
        cardCliente.querySelector('#country-picker-container')?.classList.add('pointer-events-none');
        cardCliente.querySelector('#inp-casual-nombre')?.setAttribute('readonly', 'true');
        cardCliente.querySelector('#inp-casual-telefono')?.setAttribute('readonly', 'true');
        cardCliente.querySelector('#inp-casual-ruc')?.setAttribute('readonly', 'true');
      }
      cardItems.querySelector('#section-item-catalogo')?.classList.add('hidden');
      cardItems.querySelector('#section-item-casual')?.classList.add('hidden');
      cardItems.querySelector('#toggle-producto-casual-container')?.classList.add('hidden');
      
      // En modo Vista Previa, mostrar los proveedores asignados a los ítems en una tarjeta informativa
      const boxProv = cardItems.querySelector('#box-proveedor-card');
      if (boxProv) {
        const provItems = formData.items.filter(it => it.proveedor_nombre || (it.proveedor_costo && it.proveedor_costo > 0));
        let totalCostoCompra = 0;
        provItems.forEach(it => {
          const c = (it.proveedor_costo || 0) * (it.proveedor_cantidad || it.cantidad || 1);
          totalCostoCompra += c;
        });

        if (provItems.length > 0) {
          boxProv.innerHTML = `
            <div class="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-slate-800">
              <span class="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <i class="fa-solid fa-truck-field text-brand"></i>
                Proveedores y Costos de Compra Asignados
              </span>
              <span class="text-[11px] font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 px-2.5 py-0.5 rounded-lg border border-purple-200 dark:border-purple-800/40">
                ${provItems.length} producto(s) con costo asignado
              </span>
            </div>
            <div class="divide-y divide-slate-100 dark:divide-slate-800">
              ${provItems.map((it, pIdx) => `
                <div class="py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div class="flex items-center gap-2.5">
                    <span class="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-500 flex items-center justify-center">${pIdx + 1}</span>
                    <div>
                      <div class="font-bold text-slate-800 dark:text-slate-200">${escapeHtml(it.descripcion)}</div>
                      <div class="text-[10px] text-slate-400">Cantidad: ${it.proveedor_cantidad || it.cantidad || 1} unid.</div>
                    </div>
                  </div>
                  <div class="flex items-center gap-3 text-right">
                    <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-brand text-xs font-bold border border-purple-200/60 dark:border-purple-800/40">
                      <i class="fa-solid fa-building text-[10px]"></i> ${escapeHtml(it.proveedor_nombre || 'Proveedor')}
                    </span>
                    <div class="text-right">
                      <div class="font-mono font-bold text-slate-900 dark:text-white text-xs">${formatGs((it.proveedor_costo || 0) * (it.proveedor_cantidad || it.cantidad || 1))}</div>
                      <div class="text-[10px] text-slate-400 font-mono">(${formatGs(it.proveedor_costo || 0)} c/u)</div>
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
            <div class="pt-3 border-t border-slate-200/60 dark:border-slate-800 flex justify-between items-center text-xs">
              <span class="text-slate-500 font-semibold">Total Costo de Compra Estimado:</span>
              <span class="font-mono font-bold text-slate-900 dark:text-white text-sm">${formatGs(totalCostoCompra)}</span>
            </div>
          `;
        } else {
          boxProv.innerHTML = `
            <div class="flex items-center gap-2 text-xs text-slate-500 py-1">
              <i class="fa-solid fa-circle-info text-slate-400"></i>
              <span>No se han definido proveedores ni costos de compra para este presupuesto.</span>
            </div>
          `;
        }
      }

      cardServicios.querySelector('#btn-add-servicio')?.classList.add('hidden');
      cardGaleria.querySelector('#btn-add-foto-adicional')?.classList.add('hidden');
    }

    // ========================================================================
    // HELPERS DEL FORMULARIO Y TABLAS
    // ========================================================================

    function renderItemsTable(syncDropdown = true) {
      if (syncDropdown) {
        updateTargetItemDropdown();
      }
      const tbody = cardItems.querySelector('#tbody-budget-items');
      if (!tbody) return;
      tbody.innerHTML = '';

      if (formData.items.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" class="p-8 text-center text-slate-400 text-xs">
              No se han agregado productos aún. Busque en el catálogo o agregue un ítem libre.
            </td>
          </tr>
        `;
        recalculateTotals();
        return;
      }

      formData.items.forEach((it, idx) => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition group';
        tr.setAttribute('draggable', 'true');
        tr.setAttribute('data-index', String(idx));

        const subt = it.cantidad * it.precio_unitario;
        it.total = subt;

        const hasProv = Boolean(it.proveedor_nombre || (it.proveedor_costo && it.proveedor_costo > 0));
        const provQty = it.proveedor_cantidad || it.cantidad || 1;
        const provCostUnit = it.proveedor_costo || 0;
        const provCostTotal = provCostUnit * provQty;

        tr.innerHTML = `
          <td class="py-3 px-3 text-slate-400 cursor-grab handle-drag-item border-r border-slate-100 dark:border-slate-800">
            <i class="fa-solid fa-grip-vertical"></i>
          </td>
          <td class="py-3 px-3 border-r border-slate-100 dark:border-slate-800">
            <div class="flex items-center gap-2.5">
              <img src="${escapeHtml(it.imagen_url || '/logo/R1.png')}" class="w-8 h-8 rounded-lg object-contain bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700 shadow-2xs" onerror="this.src='/logo/R1.png'" />
              <div>
                <div class="font-bold text-slate-800 dark:text-slate-200">${escapeHtml(it.descripcion)}</div>
                <div class="text-[10px] text-slate-400 flex flex-wrap items-center gap-1.5 mt-0.5">
                  ${it.sku ? `<span>SKU: ${escapeHtml(it.sku)}</span>` : ''}
                  ${hasProv ? `
                    <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/40 text-brand text-[10px] font-semibold border border-purple-200 dark:border-purple-800/50">
                      <i class="fa-solid fa-truck-field text-[9px]"></i>
                      <b>Prov:</b> ${escapeHtml(it.proveedor_nombre || 'Proveedor')} · <b>Costo:</b> ${formatGs(provCostUnit)} × ${provQty} = ${formatGs(provCostTotal)}
                    </span>
                    ${!isPreview ? `
                      <button type="button" class="btn-change-prov-row text-[10px] text-brand hover:underline font-bold cursor-pointer flex items-center gap-1" data-row-idx="${idx}">
                        <i class="fa-solid fa-pen-to-square"></i> Editar Prov.
                      </button>
                    ` : ''}
                  ` : `
                    ${!isPreview ? `
                      <button type="button" class="btn-change-prov-row text-[10px] text-slate-400 hover:text-brand flex items-center gap-1 font-medium cursor-pointer" data-row-idx="${idx}">
                        <i class="fa-solid fa-truck-field"></i> + Asignar Proveedor
                      </button>
                    ` : ''}
                  `}
                </div>
              </div>
            </div>
          </td>
          <td class="py-3 px-3 font-mono font-bold text-slate-800 dark:text-slate-200 border-r border-slate-100 dark:border-slate-800">
            ${formatGs(it.precio_unitario)}
          </td>
          <td class="py-3 px-3 border-r border-slate-100 dark:border-slate-800" id="td-qty-${idx}">
          </td>
          <td class="py-3 px-3 font-mono font-bold text-brand border-r border-slate-100 dark:border-slate-800" id="td-subtotal-${idx}">
            ${formatGs(subt)}
          </td>
          <td class="py-3 px-3 text-right">
            <button type="button" class="btn-del-item w-8 h-8 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition flex items-center justify-center cursor-pointer" title="Eliminar ítem">
              <i class="fa-regular fa-trash-can text-xs"></i>
            </button>
          </td>
        `;

        const rowQty = createQuantityCounter({
          value: it.cantidad,
          min: 1,
          onChange: (newQty) => {
            it.cantidad = newQty;
            it.total = newQty * it.precio_unitario;
            const subCell = tr.querySelector(`#td-subtotal-${idx}`);
            if (subCell) subCell.textContent = formatGs(it.total);
            recalculateTotals();
          },
        });
        tr.querySelector(`#td-qty-${idx}`)?.appendChild(rowQty.element);

        if (isPreview) {
          tr.querySelector('.btn-del-item')?.classList.add('hidden');
          tr.querySelector('.handle-drag-item')?.classList.add('opacity-0');
          rowQty.element.classList.add('pointer-events-none');
          tr.removeAttribute('draggable');
        }

        tr.querySelector('.btn-change-prov-row')?.addEventListener('click', () => {
          activeProvItemIndex = idx;
          updateTargetItemDropdown();
          loadProviderForActiveItem();
          const pBox = cardItems.querySelector('#box-proveedor-card');
          pBox?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          if (isCasualProvActive) {
            cardItems.querySelector('#inp-prov-casual-nombre')?.focus();
          } else {
            cardItems.querySelector('#inp-buscar-proveedor')?.focus();
          }
        });

        tr.querySelector('.btn-del-item')?.addEventListener('click', () => {
          formData.items.splice(idx, 1);
          if (activeProvItemIndex >= formData.items.length) {
            activeProvItemIndex = Math.max(0, formData.items.length - 1);
          }
          renderItemsTable();
          loadProviderForActiveItem();
        });

        // Eventos Drag and Drop para ítems
        tr.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('text/plain', String(idx));
          tr.classList.add('opacity-40');
        });
        tr.addEventListener('dragend', () => {
          tr.classList.remove('opacity-40');
        });
        tr.addEventListener('dragover', (e) => {
          e.preventDefault();
        });
        tr.addEventListener('drop', (e) => {
          e.preventDefault();
          const fromIndex = Number(e.dataTransfer.getData('text/plain'));
          const toIndex = idx;
          if (!isNaN(fromIndex) && fromIndex !== toIndex) {
            const moved = formData.items.splice(fromIndex, 1)[0];
            formData.items.splice(toIndex, 0, moved);
            formData.items.forEach((item, pos) => {
              item.orden = pos;
            });
            activeProvItemIndex = toIndex;
            renderItemsTable();
            loadProviderForActiveItem();
          }
        });

        tbody.appendChild(tr);
      });

      recalculateTotals();
    }

    function addItemToBudget(item) {
      item.orden = formData.items.length;
      formData.items.push(item);
      activeProvItemIndex = formData.items.length - 1;
      renderItemsTable();
      loadProviderForActiveItem();
    }

    function renderServiciosTable() {
      const tbody = cardServicios.querySelector('#tbody-servicios-items');
      if (!tbody) return;
      tbody.innerHTML = '';

      if (formData.servicios_opcionales.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="5" class="p-6 text-center text-slate-400 text-xs">
              Ningún servicio opcional añadido. Si no agrega ninguno, este bloque se omitirá en el PDF.
            </td>
          </tr>
        `;
        recalculateTotals();
        return;
      }

      formData.servicios_opcionales.forEach((srv, idx) => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition';
        const subt = srv.cantidad * srv.precio_unitario;
        srv.subtotal = subt;

        tr.innerHTML = `
          <td class="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200 border-r border-slate-100 dark:border-slate-800">
            ${escapeHtml(srv.descripcion)}
          </td>
          <td class="py-2.5 px-3 font-mono font-bold text-slate-800 dark:text-slate-200 border-r border-slate-100 dark:border-slate-800">
            ${formatGs(srv.precio_unitario)}
          </td>
          <td class="py-2.5 px-3 border-r border-slate-100 dark:border-slate-800" id="td-srv-qty-${idx}">
          </td>
          <td class="py-2.5 px-3 font-mono font-bold text-emerald-600 border-r border-slate-100 dark:border-slate-800" id="td-srv-subtotal-${idx}">
            ${formatGs(subt)}
          </td>
          <td class="py-2.5 px-3 text-right">
            <button type="button" class="btn-del-srv w-7 h-7 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition flex items-center justify-center cursor-pointer">
              <i class="fa-regular fa-trash-can text-xs"></i>
            </button>
          </td>
        `;

        const rowQty = createQuantityCounter({
          value: srv.cantidad,
          min: 1,
          onChange: (newQty) => {
            srv.cantidad = newQty;
            srv.subtotal = newQty * srv.precio_unitario;
            const subCell = tr.querySelector(`#td-srv-subtotal-${idx}`);
            if (subCell) subCell.textContent = formatGs(srv.subtotal);
            recalculateTotals();
          },
        });
        tr.querySelector(`#td-srv-qty-${idx}`)?.appendChild(rowQty.element);

        if (isPreview) {
          tr.querySelector('.btn-del-srv')?.classList.add('hidden');
          rowQty.element.classList.add('pointer-events-none');
        }

        tr.querySelector('.btn-del-srv')?.addEventListener('click', () => {
          formData.servicios_opcionales.splice(idx, 1);
          renderServiciosTable();
        });

        tbody.appendChild(tr);
      });

      recalculateTotals();
    }

    function openAddServicioModal() {
      const modal = openModal({
        title: 'Agregar Servicio Opcional',
        content: `
          <div class="space-y-4">
            <div>
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Descripción del Servicio *</label>
              <input type="text" id="modal-srv-desc" placeholder="Ej: Diseño Gráfico Personalizado, Delivery Premium..." class="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand" />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Precio Unitario (Gs.) *</label>
                <input type="text" id="modal-srv-precio" placeholder="0 Gs." class="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand font-mono font-bold" />
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Cantidad</label>
                <div id="modal-srv-qty-container"></div>
              </div>
            </div>
          </div>
        `,
        actions: [
          {
            text: 'Cancelar',
            variant: 'cancel',
            onClick: () => modal.close(),
          },
          {
            text: 'Agregar al Presupuesto',
            variant: 'primary',
            onClick: () => {
              const desc = modal.element.querySelector('#modal-srv-desc')?.value.trim();
              const precio = unformatGs(modal.element.querySelector('#modal-srv-precio')?.value);
              if (!desc) {
                toast.error('Ingrese la descripción del servicio');
                return;
              }
              formData.servicios_opcionales.push({
                descripcion: desc,
                precio_unitario: precio,
                cantidad: srvQty,
                subtotal: precio * srvQty,
              });
              modal.close();
              renderServiciosTable();
            },
          },
        ],
      });

      let srvQty = 1;
      const counterSrv = createQuantityCounter({
        value: 1,
        min: 1,
        onChange: (v) => {
          srvQty = v;
        },
      });
      modal.element.querySelector('#modal-srv-qty-container')?.appendChild(counterSrv.element);
    }

    function renderGalleryGrid() {
      const grid = cardGaleria.querySelector('#grid-galeria-fotos');
      const lblCount = cardGaleria.querySelector('#lbl-galeria-count');
      if (!grid) return;
      grid.innerHTML = '';

      const visibleCount = formData.galeria_fotos.filter((f) => f.visible !== false).length;
      if (lblCount) {
        lblCount.textContent = `GALERÍA DE FOTOS PARA EL PDF (${formData.galeria_fotos.length} FOTOS (${visibleCount} VISIBLES EN PDF))`;
      }

      if (formData.galeria_fotos.length === 0) {
        grid.innerHTML = `
          <div class="col-span-4 p-8 text-center text-slate-400 text-xs border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
            No hay fotos en la galería de la Hoja 3. Agregue productos con fotos en la lista de ítems o use el botón "+ Agregar Foto Adicional".
          </div>
        `;
        return;
      }

      formData.galeria_fotos.forEach((foto, idx) => {
        const card = document.createElement('div');
        card.className = 'group relative p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 shadow-xs space-y-2 select-none';
        card.setAttribute('draggable', 'true');
        card.setAttribute('data-photo-index', String(idx));

        card.innerHTML = `
          <div class="relative w-full aspect-square rounded-lg overflow-hidden bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center justify-center cursor-pointer btn-zoom-photo">
            <img src="${escapeHtml(foto.url || '/logo/R1.png')}" class="w-full h-full object-contain p-2 group-hover:scale-105 transition" onerror="this.src='/logo/R1.png'" />
            <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white gap-2 text-xs">
              <i class="fa-solid fa-magnifying-glass-plus"></i>
              <span>Ampliar</span>
            </div>
          </div>
          <div class="space-y-1.5">
            <input type="text" class="inp-photo-name w-full px-2 py-1 text-[11px] rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand font-semibold"
              value="${escapeHtml(foto.nombre || 'Producto cotizado')}" placeholder="Título en Hoja 3..." />
            <div class="flex items-center justify-between gap-1 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
              <div class="toggle-photo-visible"></div>
              <button type="button" class="btn-del-photo w-6 h-6 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition flex items-center justify-center cursor-pointer" title="Eliminar foto">
                <i class="fa-regular fa-trash-can text-[11px]"></i>
              </button>
            </div>
          </div>
        `;

        card.querySelector('.btn-zoom-photo')?.addEventListener('click', () => {
          openPhotoZoomModal(foto.url, foto.nombre);
        });

        if (isPreview) {
          card.querySelector('.btn-del-photo')?.classList.add('hidden');
          card.querySelector('.inp-photo-name')?.setAttribute('readonly', 'true');
          card.removeAttribute('draggable');
        }

        card.querySelector('.inp-photo-name')?.addEventListener('input', (e) => {
          foto.nombre = e.target.value;
        });

        const tVisible = createIOSToggle({
          label: 'PDF',
          checked: foto.visible !== false && foto.visible_pdf !== false,
          onChange: (checked) => {
            foto.visible = checked;
            foto.visible_pdf = checked;
            renderGalleryGrid();
          },
        });
        card.querySelector('.toggle-photo-visible')?.appendChild(tVisible.element);

        card.querySelector('.btn-del-photo')?.addEventListener('click', () => {
          formData.galeria_fotos.splice(idx, 1);
          renderGalleryGrid();
        });

        card.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('text/photo-index', String(idx));
          card.classList.add('opacity-40');
        });
        card.addEventListener('dragend', () => {
          card.classList.remove('opacity-40');
        });
        card.addEventListener('dragover', (e) => {
          e.preventDefault();
        });
        card.addEventListener('drop', (e) => {
          e.preventDefault();
          const fromIdx = Number(e.dataTransfer.getData('text/photo-index'));
          const toIdx = idx;
          if (!isNaN(fromIdx) && fromIdx !== toIdx) {
            const moved = formData.galeria_fotos.splice(fromIdx, 1)[0];
            formData.galeria_fotos.splice(toIdx, 0, moved);
            formData.galeria_fotos.forEach((foto, pos) => {
              foto.orden = pos;
            });
            renderGalleryGrid();
          }
        });

        grid.appendChild(card);
      });
    }

    function addPhotoToGallery(photo) {
      const exists = formData.galeria_fotos.some((f) => f.url === photo.url);
      if (!exists) {
        photo.orden = formData.galeria_fotos.length;
        photo.visible = photo.visible !== false;
        photo.visible_pdf = photo.visible_pdf !== false;
        formData.galeria_fotos.push(photo);
        renderGalleryGrid();
      }
    }

    function openAddAdditionalPhotoModal() {
      let webpDataUrl = '';
      let selectedFileName = '';

      const modal = openModal({
        title: 'Agregar Foto Adicional a la Hoja 3',
        content: `
          <div class="space-y-4">
            <!-- Zona de Carga / Drag and Drop -->
            <div>
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Archivo de Imagen *</label>
              <div id="dropzone-foto" class="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-brand rounded-2xl p-5 text-center cursor-pointer transition bg-slate-50/60 dark:bg-slate-800/40 select-none">
                <input type="file" id="inp-foto-file" accept="image/*" class="hidden" />
                <div id="dropzone-placeholder" class="space-y-2">
                  <div class="w-10 h-10 rounded-full bg-brand-soft text-brand flex items-center justify-center mx-auto text-base">
                    <i class="fa-solid fa-cloud-arrow-up"></i>
                  </div>
                  <div class="text-xs font-bold text-slate-700 dark:text-slate-200">Haga clic o arrastre una imagen aquí</div>
                  <div class="text-[10px] text-slate-400">Conversión y compresión automática a formato WebP optimizado</div>
                </div>
                <div id="dropzone-preview" class="hidden space-y-2">
                  <img id="img-adicional-preview" class="max-h-44 mx-auto rounded-xl object-contain bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-1 shadow-xs" />
                  <div id="lbl-foto-info" class="text-[10px] font-mono text-emerald-600 font-bold"></div>
                  <button type="button" id="btn-cambiar-foto" class="text-xs text-brand font-semibold hover:underline cursor-pointer">Cambiar archivo</button>
                </div>
              </div>
            </div>

            <!-- Nombre de la foto (escrito a mano o elegido de un producto de la base) -->
            <div class="space-y-1.5 relative">
              <div class="flex items-center justify-between">
                <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">Nombre o Título de la Foto *</label>
                <span class="text-[10px] text-slate-400">Escriba o busque en el catálogo</span>
              </div>
              <div class="relative">
                <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                <input type="text" id="modal-foto-nombre" placeholder="Nombre a mano o escriba para buscar producto..." 
                  class="w-full pl-8 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand font-semibold" autocomplete="off" />
                <div id="dropdown-prod-nombre-results" class="hidden absolute left-0 right-0 top-full mt-1 z-30 max-h-44 overflow-y-auto rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl divide-y divide-slate-100 dark:divide-slate-800"></div>
              </div>
            </div>
          </div>
        `,
        actions: [
          {
            text: 'Cancelar',
            variant: 'cancel',
            onClick: () => modal.close(),
          },
          {
            text: 'Agregar a Galería',
            variant: 'primary',
            onClick: async (_, btnInstance) => {
              const nom = modal.element.querySelector('#modal-foto-nombre')?.value.trim();
              if (!webpDataUrl) {
                toast.error('Debe seleccionar o arrastrar un archivo de imagen');
                return;
              }
              if (!nom) {
                toast.error('Ingrese el nombre o título de la foto para el presupuesto');
                return;
              }

              let finalUrl = webpDataUrl;
              try {
                btnInstance?.setLoading?.(true);
                const uploadRes = await apiFetch('/api/budgets/upload-image', {
                  method: 'POST',
                  body: JSON.stringify({
                    image: webpDataUrl,
                    name: nom,
                  }),
                });
                if (uploadRes?.url) {
                  finalUrl = uploadRes.url;
                }
              } catch (_) {
                // Si el upload falla, el backend procesará el base64 al guardar
              } finally {
                btnInstance?.setLoading?.(false);
              }

              formData.galeria_fotos.push({
                id: 'foto_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
                orden: formData.galeria_fotos.length,
                nombre: nom,
                url: finalUrl,
                visible: true,
                visible_pdf: true,
              });
              toast.success('Foto adicional agregada y optimizada en WebP');
              modal.close();
              renderGalleryGrid();
            },
          },
        ],
      });

      const dropzone = modal.element.querySelector('#dropzone-foto');
      const fileInput = modal.element.querySelector('#inp-foto-file');
      const placeholder = modal.element.querySelector('#dropzone-placeholder');
      const previewWrap = modal.element.querySelector('#dropzone-preview');
      const previewImg = modal.element.querySelector('#img-adicional-preview');
      const lblInfo = modal.element.querySelector('#lbl-foto-info');
      const inpNombre = modal.element.querySelector('#modal-foto-nombre');
      const dropdownResults = modal.element.querySelector('#dropdown-prod-nombre-results');

      async function processFile(file) {
        if (!file || !file.type.startsWith('image/')) {
          toast.error('Seleccione un archivo de imagen válido');
          return;
        }
        try {
          lblInfo.textContent = 'Procesando y convirtiendo a WebP...';
          webpDataUrl = await compressImageToWebP(file);
          previewImg.src = webpDataUrl;
          placeholder.classList.add('hidden');
          previewWrap.classList.remove('hidden');
          selectedFileName = file.name.replace(/\.[^/.]+$/, '');
          lblInfo.textContent = `Formato: WebP optimizado · ${file.name}`;
          if (!inpNombre.value.trim()) {
            inpNombre.value = selectedFileName;
          }
        } catch (err) {
          toast.error('Error al procesar imagen: ' + err.message);
        }
      }

      dropzone.addEventListener('click', (e) => {
        if (e.target.id === 'btn-cambiar-foto' || !previewWrap.contains(e.target)) {
          fileInput.click();
        }
      });
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file) processFile(file);
      });

      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('border-brand', 'bg-brand-soft/20');
      });
      dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('border-brand', 'bg-brand-soft/20');
      });
      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('border-brand', 'bg-brand-soft/20');
        const file = e.dataTransfer.files?.[0];
        if (file) processFile(file);
      });

      // Autocomplete de productos para asignar nombre
      setupAutocompleteDropdown({
        inputEl: inpNombre,
        dropdownEl: dropdownResults,
        fetchItems: async (q) => {
          const url = q ? `/api/productos?q=${encodeURIComponent(q)}&page_size=5` : `/api/productos?page_size=3`;
          return apiFetch(url);
        },
        renderItemHtml: (p) => {
          const precio = Number(p.precioVenta ?? p.precio_venta ?? p.precio ?? 0);
          return `
            <div class="autocomplete-item p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition flex items-center justify-between text-xs"
              data-item-id="${p.id}">
              <div>
                <div class="font-bold text-slate-800 dark:text-slate-200">${escapeHtml(p.nombre)}</div>
                <div class="text-[10px] text-slate-400 font-mono">${formatGs(precio)}</div>
              </div>
              <span class="text-[10px] text-brand font-semibold">Usar nombre</span>
            </div>
          `;
        },
        onSelectItem: (p) => {
          inpNombre.value = p.nombre;
          dropdownResults.classList.add('hidden');
        },
      });
    }

    function openPhotoZoomModal(imgUrl, title) {
      openModal({
        title: title || 'Vista Previa Ampliada',
        content: `
          <div class="flex flex-col items-center justify-center p-4">
            <img src="${escapeHtml(imgUrl || '/logo/R1.png')}" class="max-h-[70vh] max-w-full rounded-xl object-contain shadow-md" onerror="this.src='/logo/R1.png'" />
            <div class="mt-3 text-xs text-slate-500 font-semibold">${escapeHtml(title || '')}</div>
          </div>
        `,
        cancelText: 'Cerrar',
        hideFooter: false,
        confirmText: 'Aceptar',
        onConfirm: ({ close }) => close(),
      });
    }

    function recalculateTotals() {
      let subItems = 0;
      formData.items.forEach((it) => {
        subItems += it.cantidad * it.precio_unitario;
      });

      let subServ = 0;
      formData.servicios_opcionales.forEach((s) => {
        subServ += s.cantidad * s.precio_unitario;
      });

      const subtotalTotal = subItems + subServ;
      const desc = Math.min(formData.monto_descuento, subtotalTotal);
      const totalFinal = Math.max(0, subtotalTotal - desc);

      formData.subtotal = subtotalTotal;
      formData.total_final = totalFinal;

      // Calcular porcentaje de descuento automáticamente sobre el total de ítems + servicios
      let pct = 0;
      if (subtotalTotal > 0 && desc > 0) {
        pct = (desc / subtotalTotal) * 100;
      }
      formData.porcentaje_descuento = Math.round(pct * 100) / 100;
      const pctStr = formatPercentage(formData.porcentaje_descuento);

      const lblSubItems = cardLiquidacion.querySelector('#lbl-subtotal-items');
      if (lblSubItems) lblSubItems.textContent = formatGs(subItems);

      const lblSubServ = cardLiquidacion.querySelector('#lbl-subtotal-servicios');
      if (lblSubServ) lblSubServ.textContent = formatGs(subServ);

      const lblDescPct = cardLiquidacion.querySelector('#lbl-desc-porcentaje');
      if (lblDescPct) lblDescPct.textContent = desc > 0 ? `(${pctStr}%)` : '';

      const lblTot = cardLiquidacion.querySelector('#lbl-total-final');
      if (lblTot) lblTot.textContent = formatGs(totalFinal);

      // Actualizar tarjeta del Cuadro de Descuento (Card 5)
      const badge = cardDescuento?.querySelector('#preview-badge-descuento');
      const badgeHint = cardDescuento?.querySelector('#badge-descuento-hint');
      if (badge) {
        const resolved = resolveDiscountText(formData.leyenda_descuento, pctStr, desc);
        badge.textContent = resolved;
        if (desc <= 0) {
          badge.classList.add('opacity-40', 'border-slate-300', 'text-slate-400');
          badge.classList.remove('border-red-300', 'text-red-600', 'bg-red-50');
          if (badgeHint) badgeHint.innerHTML = '<span class="text-amber-500 font-semibold"><i class="fa-solid fa-triangle-exclamation mr-1"></i> Descuento en 0 Gs.: este cuadro NO se mostrará en el PDF</span>';
        } else {
          badge.classList.remove('opacity-40', 'border-slate-300', 'text-slate-400');
          badge.classList.add('border-red-300', 'text-red-600', 'bg-red-50');
          if (badgeHint) badgeHint.innerHTML = `<span class="text-emerald-600 font-semibold"><i class="fa-solid fa-check mr-1"></i> Descuento calculado: <b>${pctStr}%</b> (${formatGs(desc)})</span>`;
        }
      }
    }

    isBuildingForm = false;
    renderItemsTable();
    renderServiciosTable();
    renderGalleryGrid();
    recalculateTotals();

    // ========================================================================
    // GUARDADO DE PRESUPUESTO
    // ========================================================================
    async function saveBudget(targetEstado = 'Borrador') {
      if (!formData.cliente_nombre.trim()) {
        toast.error('Debe indicar o seleccionar un cliente para el presupuesto');
        return null;
      }
      if (formData.items.length === 0) {
        toast.error('Debe agregar al menos un producto o ítem al presupuesto');
        return null;
      }

      formData.estado = targetEstado;
      formData.fecha_emision = toIsoDate(formData.fecha_emision);

      // Asegurar que los datos de proveedor de la tarjeta se guarden en el ítem activo si están cargados
      if (formData.items.length > 0 && activeProvItemIndex >= 0 && activeProvItemIndex < formData.items.length) {
        const prNom = isCasualProvActive
          ? cardItems.querySelector('#inp-prov-casual-nombre')?.value.trim()
          : selectedProvNombre;
        const prID = isCasualProvActive ? null : selectedProvId;
        const prCosto = unformatGs(cardItems.querySelector('#inp-prov-costo')?.value);
        const targetIt = formData.items[activeProvItemIndex];
        const prCant = provItemQty > 0 ? provItemQty : (targetIt.cantidad || 1);
        if (prNom || prCosto > 0) {
          targetIt.proveedor_id = prID;
          targetIt.proveedor_casual = isCasualProvActive;
          targetIt.proveedor_nombre = prNom || '';
          targetIt.proveedor_costo = prCosto;
          targetIt.proveedor_cantidad = prCant;
        }
      }

      recalculateTotals();

      try {
        let res;
        if (formData.id) {
          res = await apiFetch(`/api/budgets/${encodeURIComponent(formData.id)}`, {
            method: 'PUT',
            body: JSON.stringify(formData),
          });
        } else {
          res = await apiFetch('/api/budgets', {
            method: 'POST',
            body: JSON.stringify(formData),
          });
          if (res?.id) {
            formData.id = res.id;
            formData.numero_presupuesto = res.numero_presupuesto;
          }
        }

        toast.success(res?.message || 'Presupuesto guardado exitosamente');
        if (targetEstado !== 'Enviado') {
          loadListView();
        }
        return res;
      } catch (err) {
        console.error('[Presupuesto] Error al guardar:', err);
        toast.error(err.message || 'Error al guardar presupuesto');
        return null;
      }
    }

    async function saveBudgetAndSend() {
      const res = await saveBudget('Enviado');
      const bId = formData.id || res?.id;
      if (res && bId) {
        await openWhatsAppSendModal(bId, () => {
          loadListView();
        });
      }
    }
  }

  // ==========================================================================
  // MODALES DE ACCIÓN: WHATSAPP, PDF, ESTADOS Y EXPORTACIÓN
  // ==========================================================================

  async function handlePreviewDraftPDF(formData, templateConfig) {
    try {
      const mockBudget = {
        numero_presupuesto: formData.numero_presupuesto || 'PRES-BORRADOR',
        fecha_emision: formData.fecha_emision,
        validez_dias: formData.validez_dias,
        validez_fecha: formData.validez_fecha || `${formData.validez_dias} días`,
        estado: formData.estado || 'Borrador',
        cliente: {
          nombre: formData.cliente_nombre || 'Cliente Particular',
          ruc: formData.cliente_ruc || '',
          telefono: formData.cliente_telefono || '',
          direccion: formData.cliente_direccion || 'Paraguay',
        },
        items: formData.items || [],
        servicios_opcionales: formData.servicios_opcionales || [],
        totales: {
          subtotal: formData.subtotal || 0,
          subtotal_formateado: formatGs(formData.subtotal || 0),
          monto_descuento: formData.monto_descuento || 0,
          monto_descuento_formateado: '- ' + formatGs(formData.monto_descuento || 0),
          total_final: formData.total_final || 0,
          total_final_formateado: formatGs(formData.total_final || 0),
          leyenda_descuento: formData.leyenda_descuento,
          mostrar_descuento_pdf: formData.mostrar_descuento_pdf,
        },
        terminos_condiciones: formData.terminos_condiciones || [],
        observaciones: formData.observaciones || '',
        galeria_fotos: formData.galeria_fotos || [],
        mostrar_galeria_pdf: formData.mostrar_galeria_pdf,
        galeria_cols: formData.galeria_cols || 2,
        galeria_rows: formData.galeria_rows || 4,
        galeria_layout: formData.galeria_layout || '2x4',
        empresa: {
          logo_url: templateConfig?.caratula?.logo_url || '/logo/R1.png',
          razon_social: 'R1 Personalizados',
          ruc: '00012345-0',
          telefonos: ['+595 981 654321'],
          direccion: 'Pdte Franco, Paraguay',
          sitio_web: 'netz.com.py',
          redes: {
            instagram: 'instagram.com/r1personalizados',
            facebook: 'facebook.com/r1personalizados',
            tiktok: 'tiktok.com/@r1personalizados',
            sitio_web: 'netz.com.py',
          },
        },
      };

      openInteractivePDFPreviewModal({
        budget: mockBudget,
        config: templateConfig || getDefaultBudgetConfig(),
      });
    } catch (err) {
      toast.error('Error al renderizar vista previa: ' + err.message);
    }
  }

  async function openBudgetPreviewModal(budgetId) {
    try {
      const budget = await apiFetch(`/api/budgets/${encodeURIComponent(budgetId)}`);
      const modal = openModal({
        title: `Presupuesto ${budget.numero_presupuesto} — ${budget.cliente?.nombre || ''}`,
        content: `
          <div class="space-y-4">
            <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div class="text-xs text-slate-400">Cliente:</div>
                <div class="text-sm font-bold text-slate-800 dark:text-slate-200">${escapeHtml(budget.cliente?.nombre || '')}</div>
                <div class="text-[11px] text-slate-500">${escapeHtml(budget.cliente?.telefono || '')} ${budget.cliente?.ruc ? `· RUC: ${escapeHtml(budget.cliente.ruc)}` : ''}</div>
              </div>
              <div>
                <div class="text-xs text-slate-400">Total Presupuestado:</div>
                <div class="text-lg font-black font-mono text-brand">${formatGs(budget.totales?.total_final || 0)}</div>
                <div class="text-[10px] text-slate-400">Validez: ${budget.validez_dias || 15} días (${budget.validez_fecha || ''})</div>
              </div>
              <div>
                <span class="px-3 py-1 rounded-full text-xs font-bold bg-brand-soft text-brand dark:bg-brand/20">
                  Estado: ${escapeHtml(budget.estado || 'Pendiente')}
                </span>
              </div>
            </div>

            <!-- Acciones de Estado -->
            <div class="flex flex-wrap items-center justify-center gap-3 py-2 border-y border-slate-100 dark:border-slate-800">
              <button type="button" id="modal-btn-aceptar" class="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition flex items-center gap-1.5 cursor-pointer">
                <i class="fa-solid fa-check"></i>
                <span>Aceptado (Crear Pedido)</span>
              </button>
              <button type="button" id="modal-btn-cambios" class="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition flex items-center gap-1.5 cursor-pointer">
                <i class="fa-solid fa-pen-to-square"></i>
                <span>Aceptado con Cambios</span>
              </button>
              <button type="button" id="modal-btn-rechazar" class="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-xs transition flex items-center gap-1.5 cursor-pointer">
                <i class="fa-solid fa-xmark"></i>
                <span>Rechazado</span>
              </button>
            </div>

            <div class="flex items-center justify-center gap-3">
              <button type="button" id="modal-btn-open-pdf" class="px-4 py-2 rounded-xl border border-brand text-brand hover:bg-brand-soft/40 text-xs font-bold transition flex items-center gap-2 cursor-pointer">
                <i class="fa-regular fa-file-pdf"></i>
                <span>Ver / Imprimir Documento PDF Oficial</span>
              </button>
            </div>
          </div>
        `,
        cancelText: 'Cerrar',
        hideFooter: true,
      });

      modal.element.querySelector('#modal-btn-aceptar')?.addEventListener('click', async () => {
        modal.close();
        await handleAceptarPresupuesto(budget.id || budgetId);
      });
      modal.element.querySelector('#modal-btn-cambios')?.addEventListener('click', () => {
        modal.close();
        handleAceptarConCambios(budget);
      });
      modal.element.querySelector('#modal-btn-rechazar')?.addEventListener('click', async () => {
        modal.close();
        await handleRechazarPresupuesto(budget.id || budgetId);
      });
      modal.element.querySelector('#modal-btn-open-pdf')?.addEventListener('click', async () => {
        const templateConfig = await apiFetch('/api/config/budget-template').catch(() => null);
        openInteractivePDFPreviewModal({
          budget: budget,
          config: templateConfig || getDefaultBudgetConfig(),
        });
      });
    } catch (err) {
      toast.error('Error al abrir presupuesto: ' + err.message);
    }
  }

  async function handleAceptarPresupuesto(budgetId) {
    try {
      const res = await apiFetch(`/api/budgets/${encodeURIComponent(budgetId)}/convert-to-order`, {
        method: 'POST',
      });
      toast.success(res.message || 'Presupuesto aprobado y convertido a Pedido');
      if (currentView === 'list') {
        fetchBudgets();
      } else {
        loadListView();
      }
    } catch (err) {
      toast.error('Error al convertir a pedido: ' + err.message);
    }
  }

  function handleAceptarConCambios(budget) {
    const modal = openModal({
      title: `Aceptado con Cambios — ${budget.numero_presupuesto}`,
      content: `
        <div class="space-y-4">
          <p class="text-xs text-slate-500">
            Indique qué modificaciones solicitó el cliente. Se abrirá el presupuesto en modo de edición para ajustar cantidades, precios o productos antes de pasarlo a Pedidos.
          </p>
          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Motivo o Ajustes Requeridos *</label>
            <textarea id="inp-cambios-motivo" rows="3" placeholder="Ej: Cliente solicitó agregar 5 tazas adicionales y ajustar el precio a 45.000 Gs..." class="w-full p-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand"></textarea>
          </div>
        </div>
      `,
      actions: [
        {
          text: 'Cancelar',
          variant: 'cancel',
          onClick: () => modal.close(),
        },
        {
          text: 'Continuar a Edición',
          variant: 'primary',
          onClick: () => {
            const motivo = modal.element.querySelector('#inp-cambios-motivo')?.value.trim();
            modal.close();
            loadCreateOrEditView(budget.id || budget.numero_presupuesto);
            if (motivo) {
              toast.info('Modifique los ítems y guarde el presupuesto para emitir el pedido.');
            }
          },
        },
      ],
    });
  }

  async function handleRechazarPresupuesto(budgetId) {
    openConfirmModal({
      title: 'Rechazar Presupuesto',
      message: '¿Está seguro de marcar este presupuesto como Rechazado por el cliente?',
      confirmText: 'Sí, Rechazar Presupuesto',
      onConfirm: async () => {
        try {
          await apiFetch(`/api/budgets/${encodeURIComponent(budgetId)}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ estado: 'Rechazado' }),
          });
          toast.success('Presupuesto marcado como Rechazado');
          if (currentView === 'list') {
            fetchBudgets();
          } else {
            loadListView();
          }
        } catch (err) {
          toast.error('Error al rechazar presupuesto: ' + err.message);
        }
      },
    });
  }

  async function openWhatsAppSendModal(budgetId, onClose = null) {
    try {
      const [budget, templateConfig] = await Promise.all([
        apiFetch(`/api/budgets/${encodeURIComponent(budgetId)}`),
        apiFetch('/api/config/budget-template').catch(() => null),
      ]);
      const pdfFilename = getBudgetPdfFilename(budget);

      let perfiles = [];
      try {
        const perfRes = await apiFetch('/api/perfiles-mensajes');
        perfiles = perfRes.data || [];
      } catch (_) {}

      let preselectedProfile = perfiles.find((p) => p.titulo?.toLowerCase().includes('presupuesto')) || perfiles[0];

      // Tomar número del campo WhatsApp / Celular del cliente
      let clientPhone = budget.cliente?.whatsapp || budget.cliente?.telefono || budget.cliente_telefono || '';
      let cliDetails = budget.cliente || {};
      const cliId = budget.cliente?.id || budget.cliente_id;
      if (cliId) {
        try {
          const cliData = await apiFetch(`/api/clientes/${cliId}`);
          if (cliData) {
            cliDetails = cliData;
            const foundWa = cliData.whatsappCompleto || cliData.whatsapp_completo ||
                          (cliData.whatsappNumero ? ((cliData.whatsappCodigo || '+595') + cliData.whatsappNumero) : '') ||
                          cliData.celular || cliData.whatsapp || cliData.telefono || '';
            if (foundWa) clientPhone = foundWa;
          }
        } catch (_) {}
      }

      // Obtener formato de nombre configurado en Configuración > WhatsApp
      let waNameCfg = getWhatsAppNameFormatConfig();
      try {
        const sysCfg = await apiFetch('/api/configuracion').catch(() => null);
        if (sysCfg && sysCfg.whatsapp_nombre_formato) {
          waNameCfg = sysCfg.whatsapp_nombre_formato;
          try {
            localStorage.setItem('r1_whatsapp_nombre_formato', JSON.stringify(waNameCfg));
          } catch (_) {}
        }
      } catch (_) {}

      const formattedRecipientName = formatClientDisplayName(
        budget.cliente?.nombre || budget.cliente_nombre || '',
        waNameCfg,
        cliDetails
      );

      let cleanPhone = String(clientPhone || '').replace(/[^0-9+]/g, '').trim();
      if (cleanPhone && !cleanPhone.startsWith('+')) {
        if (cleanPhone.startsWith('595')) {
          cleanPhone = '+' + cleanPhone;
        } else {
          cleanPhone = '+595' + cleanPhone.replace(/^0+/, '');
        }
      }

      // Reemplazar de antemano todas las variables del perfil de mensaje ({nombre}, {total}, {fecha}, etc.)
      let currentMsg = buildBudgetMessageText(preselectedProfile?.contenido, budget, templateConfig, formattedRecipientName);

      let pdfAttachment = null;
      let pdfGenerationError = null;

      const modal = openModal({
        title: `Enviar Presupuesto por WhatsApp`,
        onClose: () => {
          if (typeof onClose === 'function') {
            onClose();
          } else if (currentView === 'list') {
            fetchBudgets();
          }
        },
        content: `
          <div class="space-y-4">
            <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between gap-3">
              <div>
                <div class="text-xs font-bold text-slate-800 dark:text-slate-200">${escapeHtml(formattedRecipientName)}</div>
                <div class="text-[11px] font-mono text-emerald-600 font-bold">${escapeHtml(cleanPhone || 'Sin número')}</div>
              </div>
              <span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-brand-soft text-brand dark:bg-brand/20">
                ${escapeHtml(budget.numero_presupuesto)}
              </span>
            </div>

            <!-- Indicador claro del archivo PDF adjunto que acompaña el mensaje -->
            <div id="modal-wa-attachment-box" class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between gap-3">
              <div class="flex items-center gap-2.5 min-w-0">
                <span class="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                  <i class="fa-regular fa-file-pdf text-sm"></i>
                </span>
                <div class="min-w-0">
                  <div class="text-xs font-bold text-slate-800 dark:text-slate-200 truncate" title="${escapeHtml(pdfFilename)}">
                    ${escapeHtml(pdfFilename)}
                  </div>
                  <div class="text-[10px] text-slate-400 flex items-center gap-1.5" id="modal-wa-pdf-status">
                    <i class="fa-solid fa-spinner fa-spin text-brand"></i> Generando documento PDF para adjuntar...
                  </div>
                </div>
              </div>
              <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 shrink-0">
                application/pdf
              </span>
            </div>

            <div>
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Perfil de Mensaje (Plantilla)</label>
              <select id="modal-sel-perfil" class="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand">
                ${
                  perfiles.length > 0
                    ? perfiles.map((p) => `<option value="${p.id}" ${p.id === preselectedProfile?.id ? 'selected' : ''}>${escapeHtml(p.titulo)}</option>`).join('')
                    : `<option value="">Plantilla estándar de presupuesto</option>`
                }
              </select>
            </div>

            <div>
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Vista Previa del Mensaje (Editable antes de enviar):</label>
              <textarea id="modal-txt-whatsapp-msg" rows="5" class="w-full p-3 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand leading-relaxed font-sans">${escapeHtml(currentMsg)}</textarea>
            </div>
          </div>
        `,
        actions: [
          {
            text: 'Cancelar',
            variant: 'cancel',
            onClick: () => modal.close(),
          },
          {
            text: 'Enviar por WhatsApp',
            icon: 'fa-brands fa-whatsapp',
            variant: 'primary',
            onClick: async () => {
              const textToSend = modal.element.querySelector('#modal-txt-whatsapp-msg')?.value.trim();
              if (!textToSend) {
                toast.error('El mensaje no puede estar vacío');
                return;
              }

              // Reemplazar cualquier variable remanente ({nombre}, {total}, etc.) para garantizar que ninguna llegue sin reemplazar
              const finalMessageToSend = buildBudgetMessageText(textToSend, budget, templateConfig, formattedRecipientName);
              if (!cleanPhone) {
                toast.error('El cliente no posee un número de WhatsApp registrado');
                return;
              }

              const sendBtn = modal.element.querySelector('.btn-primary') || modal.element.querySelector('button[class*="bg-brand"]');
              const prevSendText = sendBtn ? sendBtn.innerHTML : '';
              if (sendBtn) {
                sendBtn.disabled = true;
                sendBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1.5"></i> Preparando adjunto...';
              }

              // Esperar a que el PDF termine de generarse si aún está en curso
              try {
                if (!pdfAttachment) {
                  pdfAttachment = await pdfGenerationPromise;
                }
              } catch (err) {
                if (sendBtn) {
                  sendBtn.disabled = false;
                  sendBtn.innerHTML = prevSendText;
                }
                toast.error('No se pudo generar el PDF adjunto: ' + (err.message || 'Error desconocido'));
                return;
              }

              if (!pdfAttachment || !pdfAttachment.dataUri) {
                if (sendBtn) {
                  sendBtn.disabled = false;
                  sendBtn.innerHTML = prevSendText;
                }
                toast.error('No se pudo preparar el PDF adjunto para el envío');
                return;
              }

              try {
                if (sendBtn) {
                  sendBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1.5"></i> Enviando por WhatsApp...';
                }

                await apiFetch('/api/whatsapp/send', {
                  method: 'POST',
                  body: JSON.stringify({
                    phone: cleanPhone,
                    message: finalMessageToSend,
                    media: {
                      data: pdfAttachment.dataUri,
                      mime: 'application/pdf',
                      filename: pdfFilename,
                    },
                  }),
                });

                toast.success('Presupuesto y PDF enviados correctamente por WhatsApp');

                // Actualizar estado a 'Enviado' SOLO si el envío fue exitoso
                if (budget.estado === 'Borrador') {
                  await apiFetch(`/api/budgets/${encodeURIComponent(budgetId)}/status`, {
                    method: 'PATCH',
                    body: JSON.stringify({ estado: 'Enviado' }),
                  }).catch(() => null);
                }

                modal.close();
              } catch (err) {
                if (sendBtn) {
                  sendBtn.disabled = false;
                  sendBtn.innerHTML = prevSendText;
                }
                // Si falla el adjunto / envío: mostrar error y NUNCA marcar como enviado
                toast.error('Error al enviar WhatsApp: ' + (err.message || 'Fallo en el servicio de WhatsApp'));
              }
            },
          },
        ],
      });

      // Generación inmediata del PDF en segundo plano al abrir el modal
      const pdfGenerationPromise = generateBudgetPDFBlob(budget, templateConfig)
        .then((res) => {
          pdfAttachment = res;
          const statusEl = modal.element.querySelector('#modal-wa-pdf-status');
          if (statusEl) {
            statusEl.innerHTML = `<span class="text-emerald-600 dark:text-emerald-400 font-semibold"><i class="fa-solid fa-circle-check mr-1"></i> Documento adjunto preparado (${res.sizeKb} KB)</span>`;
          }
          return res;
        })
        .catch((err) => {
          pdfGenerationError = err;
          const statusEl = modal.element.querySelector('#modal-wa-pdf-status');
          if (statusEl) {
            statusEl.innerHTML = `<span class="text-danger font-semibold"><i class="fa-solid fa-triangle-exclamation mr-1"></i> Error generando PDF: ${escapeHtml(err.message)}</span>`;
          }
          throw err;
        });

      modal.element.querySelector('#modal-sel-perfil')?.addEventListener('change', (e) => {
        const perf = perfiles.find((p) => String(p.id) === e.target.value);
        const ta = modal.element.querySelector('#modal-txt-whatsapp-msg');
        if (ta && perf) {
          ta.value = buildBudgetMessageText(perf.contenido, budget, templateConfig, formattedRecipientName);
        }
      });
    } catch (err) {
      toast.error('Error al preparar envío WhatsApp: ' + err.message);
    }
  }

  function confirmAnularBudget(budget) {
    openConfirmModal({
      title: 'Anular Presupuesto',
      message: `¿Está seguro de que desea anular el presupuesto <b>${escapeHtml(budget.numero_presupuesto)}</b> correspondiente a <b>"${escapeHtml(budget.cliente_nombre)}"</b>?<br><br><span class="text-xs text-slate-500 dark:text-slate-400">El presupuesto pasará al estado <b>Anulado</b> para conservarlo archivado sin borrar ningún dato de la base de datos.</span>`,
      confirmText: 'Anular Presupuesto',
      confirmVariant: 'danger',
      onConfirm: async () => {
        try {
          await apiFetch(`/api/budgets/${encodeURIComponent(budget.id || budget.numero_presupuesto)}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ estado: 'Anulado' }),
          });
          toast.success(`Presupuesto ${budget.numero_presupuesto} marcado como Anulado`);
          fetchBudgets();
        } catch (err) {
          toast.error('Error al anular presupuesto: ' + err.message);
        }
      },
    });
  }

  function openExportModal() {
    const modal = openModal({
      title: 'Exportar Lista de Presupuestos',
      content: `
        <div class="space-y-4">
          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">Alcance de la Descarga:</label>
            <div class="space-y-2">
              <label class="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input type="radio" name="export-scope" value="filtered" checked class="accent-brand" />
                <span>Vista actual filtrada (${budgetsData.length} registros)</span>
              </label>
              <label class="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input type="radio" name="export-scope" value="all" class="accent-brand" />
                <span>Tabla general completa (${totalRecords} registros)</span>
              </label>
            </div>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">Campos a incluir en el reporte:</label>
            <div class="grid grid-cols-2 gap-2 text-xs text-slate-700 dark:text-slate-300" id="export-fields-box">
              <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked value="numero_presupuesto" class="accent-brand" /> N° Presupuesto</label>
              <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked value="fecha_emision" class="accent-brand" /> Fecha de Emisión</label>
              <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked value="cliente_nombre" class="accent-brand" /> Cliente</label>
              <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked value="cliente_telefono" class="accent-brand" /> Teléfono / RUC</label>
              <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked value="total_final" class="accent-brand" /> Total Final</label>
              <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked value="estado" class="accent-brand" /> Estado</label>
            </div>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">Formato de Exportación:</label>
            <div class="grid grid-cols-4 gap-2">
              <label class="p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-brand flex flex-col items-center justify-center gap-1.5 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-200 transition">
                <input type="radio" name="export-format" value="excel" checked class="sr-only" />
                <i class="fa-regular fa-file-excel text-emerald-600 text-lg"></i>
                <span>Excel (CSV)</span>
              </label>
              <label class="p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-brand flex flex-col items-center justify-center gap-1.5 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-200 transition">
                <input type="radio" name="export-format" value="pdf" class="sr-only" />
                <i class="fa-regular fa-file-pdf text-red-600 text-lg"></i>
                <span>PDF</span>
              </label>
              <label class="p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-brand flex flex-col items-center justify-center gap-1.5 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-200 transition">
                <input type="radio" name="export-format" value="word" class="sr-only" />
                <i class="fa-regular fa-file-word text-blue-600 text-lg"></i>
                <span>Word</span>
              </label>
              <label class="p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-brand flex flex-col items-center justify-center gap-1.5 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-200 transition">
                <input type="radio" name="export-format" value="txt" class="sr-only" />
                <i class="fa-regular fa-file-lines text-slate-600 text-lg"></i>
                <span>Texto (TXT)</span>
              </label>
            </div>
          </div>
        </div>
      `,
      actions: [
        {
          text: 'Cancelar',
          variant: 'cancel',
          onClick: () => modal.close(),
        },
        {
          text: 'Descargar Archivo',
          icon: 'fa-solid fa-download',
          variant: 'primary',
          onClick: () => {
            const format = modal.element.querySelector('input[name="export-format"]:checked')?.value || 'excel';
            downloadTableFile(format, budgetsData);
            modal.close();
          },
        },
      ],
    });

    modal.element.querySelectorAll('input[name="export-format"]').forEach((r) => {
      r.addEventListener('change', () => {
        modal.element.querySelectorAll('input[name="export-format"]').forEach((inp) => {
          inp.parentElement.classList.toggle('border-brand', inp.checked);
          inp.parentElement.classList.toggle('bg-brand-soft/30', inp.checked);
        });
      });
    });
  }

  function downloadTableFile(format, data) {
    if (!data || data.length === 0) {
      toast.error('No hay datos para exportar');
      return;
    }

    if (format === 'excel') {
      const headers = ['N° Presupuesto', 'Fecha', 'Cliente', 'Teléfono', 'RUC', 'Total (Gs.)', 'Estado'];
      const rows = data.map((b) => [
        `"${b.numero_presupuesto || ''}"`,
        `"${b.fecha_emision || ''}"`,
        `"${(b.cliente_nombre || '').replace(/"/g, '""')}"`,
        `"${b.cliente_telefono || ''}"`,
        `"${b.cliente_ruc || ''}"`,
        b.total_final || 0,
        `"${b.estado || ''}"`,
      ]);
      const csv = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
      downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), 'Presupuestos-R1.csv');
    } else if (format === 'txt') {
      const txt = data
        .map(
          (b) =>
            `[${b.numero_presupuesto}] ${b.fecha_emision} | Cliente: ${b.cliente_nombre} | Tel: ${b.cliente_telefono || 'S/N'} | Total: ${formatGs(b.total_final)} | Estado: ${b.estado}`
        )
        .join('\n');
      downloadBlob(new Blob([txt], { type: 'text/plain;charset=utf-8;' }), 'Presupuestos-R1.txt');
    } else if (format === 'word') {
      const html = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head><title>Presupuestos</title></head>
        <body>
          <h2>Reporte de Presupuestos — R1 Personalizados</h2>
          <table border="1" cellpadding="5" cellspacing="0" style="border-collapse:collapse;width:100%;">
            <tr style="background:#f0f0f0;">
              <th>N° Presupuesto</th><th>Fecha</th><th>Cliente</th><th>Total</th><th>Estado</th>
            </tr>
            ${data.map((b) => `<tr><td>${escapeHtml(b.numero_presupuesto)}</td><td>${escapeHtml(b.fecha_emision)}</td><td>${escapeHtml(b.cliente_nombre)}</td><td>${formatGs(b.total_final)}</td><td>${escapeHtml(b.estado)}</td></tr>`).join('')}
          </table>
        </body></html>
      `;
      downloadBlob(new Blob([html], { type: 'application/msword;charset=utf-8;' }), 'Presupuestos-R1.doc');
    } else if (format === 'pdf') {
      window.print();
    }
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }
}
