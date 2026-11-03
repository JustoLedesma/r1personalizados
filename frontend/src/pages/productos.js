import { createButton } from '../components/button.js';
import { createDataTable } from '../components/table.js';
import { openConfirmModal } from '../components/modal.js';
import { openImageZoomModal } from '../components/media-attachment.js?v=20261030_5';
import { toast } from '../components/toast.js';
import { apiFetch } from '../services/api.js';

const DRAFT_STORAGE_KEY = 'r1_producto_draft';

function formatDateTimeFull(isoStr) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return String(isoStr);
  const fecha = d.toLocaleDateString('es-PY', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const hora = d.toLocaleTimeString('es-PY', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  return `${fecha} a las ${hora}`;
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatGuaranies(amount) {
  const num = Math.round(Number(amount) || 0);
  return num.toLocaleString('es-PY') + ' Gs.';
}

function parseGuaranies(val) {
  if (typeof val === 'number') return val;
  const digits = String(val || '').replace(/[^\d]/g, '');
  return Number(digits) || 0;
}

function generateRandomSKU() {
  const num = Math.floor(100000 + Math.random() * 900000);
  return `PRD-${num}`;
}

/**
 * Optimiza y convierte cualquier imagen a WebP de máx. 1200px con reducción de peso
 */
async function processImageToWebP(file, maxDimension = 1200) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('El archivo no es una imagen válida.'));
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      reject(new Error('La imagen supera el límite de 50 MB.'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Error al leer el archivo.'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('No se pudo decodificar la imagen.'));
      img.onload = () => {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (width > maxDimension || height > maxDimension) {
          const ratio = Math.min(maxDimension / width, maxDimension / height);
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
        resolve({
          nombre: `${baseName}.webp`,
          formato: 'WEBP',
          data: webpDataUrl,
          sizeKb: Math.round((webpDataUrl.length * 3) / 4 / 1024),
        });
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

export function renderProductosModule(container) {
  container.innerHTML = '';

  const state = {
    view: 'list', // 'list' | 'form' | 'detail'
    displayMode: 'table', // 'table' | 'cards'
    editingId: null,
    restoredDraft: false,
    viewingProduct: null,

    // Filtros
    filters: {
      q: '',
      categoriaId: '',
      estado: '',
      stock: '',
      page: 1,
      pageSize: 20,
    },

    // Catálogos auxiliares
    categorias: [],
    marcas: [],
    unidades: [],
    proveedores: [],

    // Datos del listado
    items: [],
    total: 0,
    loading: false,

    // Formulario actual
    form: getInitialFormData(),
  };

  function getInitialFormData() {
    return {
      nombre: '',
      sku: generateRandomSKU(),
      codigoBarras: '',
      categoriaId: '',
      marcaId: '',
      unidadMedidaId: 1, // Unidad por defecto
      descripcion: '',
      proveedorId: '',
      costoCompra: 0,
      precioVenta: 0,
      iva: '10%',
      controlarStock: true,
      stockActual: 0,
      stockMinimo: 0,
      activo: true,
      mostrarEnWeb: true,
      mostrarPrecio: true,
      permitirSinStock: false,
      enPromocion: false,
      fotoPrincipal: null, // { nombre, formato, data }
      galeriaFotos: [], // array de { nombre, formato, data }
    };
  }

  // Cargar catálogos desde la BD
  async function loadCatalogs() {
    try {
      const [atrRes, provRes] = await Promise.all([
        apiFetch('/api/configuracion/atributos'),
        apiFetch('/api/proveedores?page=1&page_size=100'),
      ]);

      if (atrRes) {
        state.categorias = Array.isArray(atrRes.categorias) ? atrRes.categorias : [];
        state.marcas = Array.isArray(atrRes.marcas) ? atrRes.marcas : [];
        state.unidades = Array.isArray(atrRes.unidades) ? atrRes.unidades : [];
      }
      if (provRes && Array.isArray(provRes.data)) {
        state.proveedores = provRes.data;
      }
    } catch (err) {
      console.warn('[Productos] Error cargando catálogos:', err);
    }
  }

  // Cargar lista de productos
  async function fetchProducts() {
    state.loading = true;
    render();
    try {
      const params = new URLSearchParams();
      if (state.filters.q) params.set('q', state.filters.q);
      if (state.filters.categoriaId) params.set('categoria_id', state.filters.categoriaId);
      if (state.filters.estado) params.set('estado', state.filters.estado);
      if (state.filters.stock) params.set('stock', state.filters.stock);
      params.set('page', String(state.filters.page));
      params.set('page_size', String(state.filters.pageSize));

      const res = await apiFetch(`/api/productos?${params.toString()}`);
      if (res) {
        state.items = Array.isArray(res.data) ? res.data : [];
        state.total = Number(res.total) || 0;
      }
    } catch (err) {
      toast.error('Error al cargar productos: ' + (err.message || ''));
    } finally {
      state.loading = false;
      render();
    }
  }

  function saveDraft() {
    if (state.view !== 'form' || state.editingId) return;
    try {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(state.form));
    } catch (_) {}
  }

  function clearDraft() {
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch (_) {}
    state.restoredDraft = false;
  }

  function checkAndRestoreDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          state.form = { ...getInitialFormData(), ...parsed };
          state.restoredDraft = true;
          return true;
        }
      }
    } catch (_) {}
    return false;
  }

  function render() {
    container.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.className = 'w-full space-y-5';

    if (state.view === 'list') {
      renderListView(wrapper);
    } else if (state.view === 'detail') {
      renderDetailView(wrapper);
    } else {
      renderFormView(wrapper);
    }

    container.appendChild(wrapper);
  }

  // ============================================================================
  // VISTA 1: LISTADO DE PRODUCTOS (Tabla / Tarjetas)
  // ============================================================================
  function renderListView(parent) {
    // Barra superior con título, conmutador de vista y botón "+ Crear producto"
    const topBar = document.createElement('div');
    topBar.className =
      'flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200/80 dark:border-slate-800';

    const titleBox = document.createElement('div');
    titleBox.innerHTML = `
      <h1 class="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
        <i class="fa-solid fa-cube text-brand"></i>
        <span>Catálogo de Productos</span>
      </h1>
      <p class="text-xs text-slate-500 dark:text-slate-400">
        Gestione artículos, precios en Guaraníes (PYG), stock e imágenes optimizadas en WebP.
      </p>
    `;

    const rightActions = document.createElement('div');
    rightActions.className = 'flex items-center gap-2.5';

    // Toggle Tabla / Tarjetas
    const viewToggleBox = document.createElement('div');
    viewToggleBox.className =
      'inline-flex items-center p-0.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs shadow-2xs';

    const btnTable = document.createElement('button');
    btnTable.type = 'button';
    btnTable.className = `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
      state.displayMode === 'table'
        ? 'bg-brand text-white shadow-2xs'
        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
    }`;
    btnTable.innerHTML = '<i class="fa-solid fa-table-list text-xs"></i><span>Tabla</span>';
    btnTable.addEventListener('click', () => {
      if (state.displayMode !== 'table') {
        state.displayMode = 'table';
        render();
      }
    });

    const btnCards = document.createElement('button');
    btnCards.type = 'button';
    btnCards.className = `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
      state.displayMode === 'cards'
        ? 'bg-brand text-white shadow-2xs'
        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
    }`;
    btnCards.innerHTML = '<i class="fa-solid fa-grip text-xs"></i><span>Tarjetas</span>';
    btnCards.addEventListener('click', () => {
      if (state.displayMode !== 'cards') {
        state.displayMode = 'cards';
        render();
      }
    });

    viewToggleBox.append(btnTable, btnCards);

    // Botón "+ Crear producto"
    const createBtn = createButton({
      text: 'Crear producto',
      icon: 'fa-solid fa-plus',
      variant: 'primary',
      size: 'md',
      onClick: () => {
        state.editingId = null;
        state.restoredDraft = false;
        checkAndRestoreDraft();
        state.view = 'form';
        render();
      },
    });

    rightActions.append(viewToggleBox, createBtn);
    topBar.append(titleBox, rightActions);
    parent.appendChild(topBar);

    // Barra de filtros: Buscador + Categoría + Estado + Stock + Limpiar
    const filterCard = document.createElement('section');
    filterCard.className =
      'p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-wrap items-center gap-3';

    // Input Buscador
    const searchWrap = document.createElement('div');
    searchWrap.className = 'relative flex-1 min-w-[220px]';
    searchWrap.innerHTML = `
      <i class="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
      <input type="text" id="prod-search-input" value="${escapeHtml(state.filters.q)}"
        placeholder="Buscar por nombre, SKU o código de barras..."
        class="w-full pl-9 pr-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/50 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand" />
    `;
    const searchInput = searchWrap.querySelector('#prod-search-input');
    let searchDebounce = null;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => {
        state.filters.q = e.target.value;
        state.filters.page = 1;
        fetchProducts();
      }, 350);
    });

    // Select Categoría
    const catSelect = document.createElement('select');
    catSelect.className =
      'px-3 py-2 text-xs sm:text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand';
    catSelect.innerHTML = `<option value="">Todas las categorías</option>`;
    state.categorias.forEach((c) => {
      const opt = document.createElement('option');
      opt.value = String(c.id);
      opt.textContent = c.nombre;
      if (String(c.id) === state.filters.categoriaId) opt.selected = true;
      catSelect.appendChild(opt);
    });
    catSelect.addEventListener('change', (e) => {
      state.filters.categoriaId = e.target.value;
      state.filters.page = 1;
      fetchProducts();
    });

    // Select Estado
    const estadoSelect = document.createElement('select');
    estadoSelect.className =
      'px-3 py-2 text-xs sm:text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand';
    [
      { val: '', label: 'Todos los estados' },
      { val: 'activo', label: 'Activo' },
      { val: 'inactivo', label: 'Inactivo' },
    ].forEach((o) => {
      const opt = document.createElement('option');
      opt.value = o.val;
      opt.textContent = o.label;
      if (o.val === state.filters.estado) opt.selected = true;
      estadoSelect.appendChild(opt);
    });
    estadoSelect.addEventListener('change', (e) => {
      state.filters.estado = e.target.value;
      state.filters.page = 1;
      fetchProducts();
    });

    // Select Stock
    const stockSelect = document.createElement('select');
    stockSelect.className =
      'px-3 py-2 text-xs sm:text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand';
    [
      { val: '', label: 'Stock: Todos' },
      { val: 'con_stock', label: 'Con stock' },
      { val: 'sin_stock', label: 'Sin stock' },
      { val: 'bajo_minimo', label: 'Bajo mínimo' },
    ].forEach((o) => {
      const opt = document.createElement('option');
      opt.value = o.val;
      opt.textContent = o.label;
      if (o.val === state.filters.stock) opt.selected = true;
      stockSelect.appendChild(opt);
    });
    stockSelect.addEventListener('change', (e) => {
      state.filters.stock = e.target.value;
      state.filters.page = 1;
      fetchProducts();
    });

    // Botón Limpiar
    const clearBtn = createButton({
      text: 'Limpiar',
      icon: 'fa-solid fa-rotate-left',
      variant: 'cancel',
      size: 'sm',
      onClick: () => {
        state.filters.q = '';
        state.filters.categoriaId = '';
        state.filters.estado = '';
        state.filters.stock = '';
        state.filters.page = 1;
        fetchProducts();
      },
    });

    filterCard.append(searchWrap, catSelect, estadoSelect, stockSelect, clearBtn);
    parent.appendChild(filterCard);

    // Contenedor principal de datos (Tabla o Tarjetas)
    const contentArea = document.createElement('div');
    contentArea.className = 'w-full';

    if (state.displayMode === 'table') {
      renderTableMode(contentArea);
    } else {
      renderCardsMode(contentArea);
    }

    parent.appendChild(contentArea);
  }

  // Modo Tabla (Con thead fijo y fila vacía o de carga según capturas)
  function renderTableMode(holder) {
    const tableWrap = document.createElement('div');
    tableWrap.className =
      'w-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs';

    const overflowBox = document.createElement('div');
    overflowBox.className = 'w-full overflow-x-auto';

    const table = document.createElement('table');
    table.className = 'w-full text-left border-collapse';

    const thead = document.createElement('thead');
    thead.className =
      'bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold';
    thead.innerHTML = `
      <tr>
        <th class="px-4 py-3 select-none text-left">Foto</th>
        <th class="px-4 py-3 select-none text-left">SKU</th>
        <th class="px-4 py-3 select-none text-left">Nombre del Producto</th>
        <th class="px-4 py-3 select-none text-left">Categoría</th>
        <th class="px-4 py-3 select-none text-left">Precio Venta</th>
        <th class="px-4 py-3 select-none text-left">Stock</th>
        <th class="px-4 py-3 select-none text-left">Estado</th>
        <th class="px-4 py-3 select-none text-right">Acciones</th>
      </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    tbody.className = 'divide-y divide-slate-100 dark:divide-slate-800/80 text-xs sm:text-sm';

    if (state.loading) {
      // Skeleton loader rows
      for (let i = 0; i < 4; i++) {
        const skelRow = document.createElement('tr');
        skelRow.className = 'animate-pulse';
        skelRow.innerHTML = `
          <td class="px-4 py-3"><div class="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800"></div></td>
          <td class="px-4 py-3"><div class="h-4 w-20 rounded bg-slate-100 dark:bg-slate-800"></div></td>
          <td class="px-4 py-3"><div class="h-4 w-40 rounded bg-slate-100 dark:bg-slate-800 mb-1"></div><div class="h-3 w-24 rounded bg-slate-100 dark:bg-slate-800"></div></td>
          <td class="px-4 py-3"><div class="h-5 w-20 rounded-full bg-slate-100 dark:bg-slate-800"></div></td>
          <td class="px-4 py-3"><div class="h-4 w-24 rounded bg-slate-100 dark:bg-slate-800"></div></td>
          <td class="px-4 py-3"><div class="h-5 w-16 rounded-full bg-slate-100 dark:bg-slate-800"></div></td>
          <td class="px-4 py-3"><div class="h-5 w-16 rounded-full bg-slate-100 dark:bg-slate-800"></div></td>
          <td class="px-4 py-3 text-right"><div class="h-8 w-24 rounded-lg bg-slate-100 dark:bg-slate-800 ml-auto"></div></td>
        `;
        tbody.appendChild(skelRow);
      }
    } else if (state.items.length === 0) {
      // Estado vacío dentro de la tabla tal como se ve en la captura
      const emptyRow = document.createElement('tr');
      emptyRow.innerHTML = `
        <td colspan="8" class="py-16 px-4 text-center">
          <div class="w-12 h-12 mx-auto rounded-xl bg-brand-soft/50 dark:bg-brand/10 text-brand flex items-center justify-center text-xl mb-2">
            <i class="fa-regular fa-folder-open"></i>
          </div>
          <p class="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">
            No se encontraron productos que coincidan con los filtros.
          </p>
          <p class="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Intente modificar los términos de búsqueda o cree un nuevo artículo para su catálogo.
          </p>
        </td>
      `;
      tbody.appendChild(emptyRow);
    } else {
      // Filas con datos de productos
      state.items.forEach((item) => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors';

        // 1. Foto
        const tdFoto = document.createElement('td');
        tdFoto.className = 'px-4 py-3';
        const imgWrap = document.createElement('div');
        imgWrap.className =
          'w-11 h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-center overflow-hidden shrink-0 cursor-pointer hover:ring-2 hover:ring-brand transition';
        if (item.fotoPrincipal) {
          imgWrap.innerHTML = `<img src="${item.fotoPrincipal}" alt="${escapeHtml(
            item.nombre
          )}" class="w-full h-full object-cover">`;
          imgWrap.addEventListener('click', (e) => {
            e.stopPropagation();
            openImageZoomModal({
              src: item.fotoPrincipal,
              nombre: `${item.sku}.webp`,
              formato: 'WEBP',
            });
          });
        } else {
          imgWrap.innerHTML = `<i class="fa-solid fa-cube text-slate-300 dark:text-slate-600 text-sm"></i>`;
        }
        tdFoto.appendChild(imgWrap);

        // 2. SKU
        const tdSku = document.createElement('td');
        tdSku.className = 'px-4 py-3';
        const skuBadge = document.createElement('button');
        skuBadge.type = 'button';
        skuBadge.className =
          'font-mono text-xs font-bold text-brand hover:underline cursor-pointer focus:outline-none';
        skuBadge.textContent = item.sku;
        skuBadge.addEventListener('click', (e) => {
          e.stopPropagation();
          openProductDetail(item);
        });
        tdSku.appendChild(skuBadge);

        // 3. Nombre
        const tdNombre = document.createElement('td');
        tdNombre.className = 'px-4 py-3';
        const nameBox = document.createElement('div');
        nameBox.className = 'max-w-xs cursor-pointer';
        nameBox.innerHTML = `
          <p class="font-bold text-slate-800 dark:text-slate-100 hover:text-brand transition truncate">${escapeHtml(
            item.nombre
          )}</p>
          <p class="text-[11px] text-slate-400 truncate">${escapeHtml(
            item.marcaNombre ? `Marca: ${item.marcaNombre}` : item.descripcion || 'Sin descripción'
          )}</p>
        `;
        nameBox.addEventListener('click', () => openProductDetail(item));
        tdNombre.appendChild(nameBox);

        // 4. Categoría
        const tdCat = document.createElement('td');
        tdCat.className = 'px-4 py-3';
        tdCat.innerHTML = `<span class="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-brand-soft/70 dark:bg-brand/20 text-brand">${escapeHtml(
          item.categoriaNombre || 'General'
        )}</span>`;

        // 5. Precio Venta
        const tdPrecio = document.createElement('td');
        tdPrecio.className = 'px-4 py-3 font-bold text-xs sm:text-sm text-slate-900 dark:text-white';
        tdPrecio.textContent = formatGuaranies(item.precioVenta);

        // 6. Stock
        const tdStock = document.createElement('td');
        tdStock.className = 'px-4 py-3';
        if (!item.controlarStock) {
          tdStock.innerHTML = `<span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500">Sin límite</span>`;
        } else {
          const actual = Number(item.stockActual) || 0;
          const min = Number(item.stockMinimo) || 0;
          let badgeClass = 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400';
          if (actual <= 0) {
            badgeClass = 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400';
          } else if (actual <= min) {
            badgeClass = 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300';
          }
          tdStock.innerHTML = `
            <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${badgeClass}">
              <span>${actual}</span>
              <span class="text-[10px] font-medium opacity-80">${escapeHtml(
                item.unidadMedidaAbrev || 'un.'
              )}</span>
            </span>
          `;
        }

        // 7. Estado
        const tdEstado = document.createElement('td');
        tdEstado.className = 'px-4 py-3';
        const toggleBtn = document.createElement('button');
        toggleBtn.type = 'button';
        toggleBtn.className = `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition cursor-pointer ${
          item.activo
            ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800'
            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700'
        }`;
        toggleBtn.innerHTML = `
          <span class="w-1.5 h-1.5 rounded-full ${item.activo ? 'bg-emerald-500' : 'bg-slate-400'}"></span>
          <span>${item.activo ? 'Activo' : 'Inactivo'}</span>
        `;
        toggleBtn.title = 'Clic para alternar estado';
        toggleBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          try {
            await apiFetch(`/api/productos/${item.id}/toggle-activo`, { method: 'PATCH' });
            item.activo = !item.activo;
            toast.info(`Producto ${item.sku} marcado como ${item.activo ? 'Activo' : 'Inactivo'}.`);
            fetchProducts();
          } catch (err) {
            toast.error(err.message || 'No se pudo cambiar el estado.');
          }
        });
        tdEstado.appendChild(toggleBtn);

        // 8. Acciones
        const tdAcciones = document.createElement('td');
        tdAcciones.className = 'px-4 py-3 text-right';
        const actWrap = document.createElement('div');
        actWrap.className = 'flex items-center justify-end gap-1.5';

        const viewBtn = createButton({
          icon: 'fa-regular fa-eye',
          variant: 'ghost',
          size: 'sm',
          ariaLabel: 'Ver detalles de producto',
          onClick: () => openProductDetail(item),
        });

        const editBtn = createButton({
          icon: 'fa-regular fa-pen-to-square',
          variant: 'ghost',
          size: 'sm',
          ariaLabel: 'Editar producto',
          onClick: () => editProduct(item),
        });

        const delBtn = createButton({
          icon: 'fa-regular fa-trash-can',
          variant: 'danger',
          size: 'sm',
          ariaLabel: 'Eliminar producto',
          onClick: () => confirmDeleteProduct(item),
        });

        actWrap.append(viewBtn, editBtn, delBtn);
        tdAcciones.appendChild(actWrap);

        tr.append(tdFoto, tdSku, tdNombre, tdCat, tdPrecio, tdStock, tdEstado, tdAcciones);
        tbody.appendChild(tr);
      });
    }

    table.appendChild(tbody);
    overflowBox.appendChild(table);
    tableWrap.appendChild(overflowBox);

    // Paginación estándar si supera 20 registros (AGENTS.md Regla 6)
    if (state.total > 20) {
      const totalPages = Math.max(1, Math.ceil(state.total / state.filters.pageSize));
      const curr = state.filters.page;
      const startItem = (curr - 1) * state.filters.pageSize + 1;
      const endItem = Math.min(curr * state.filters.pageSize, state.total);

      const pager = document.createElement('div');
      pager.className =
        'p-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs';

      const info = document.createElement('span');
      info.className = 'text-slate-500 dark:text-slate-400';
      info.textContent = `Mostrando ${startItem}–${endItem} de ${state.total}`;

      const controls = document.createElement('div');
      controls.className = 'flex items-center gap-1';

      controls.appendChild(
        createButton({
          text: 'Anterior',
          variant: 'cancel',
          size: 'sm',
          disabled: curr <= 1,
          onClick: () => {
            state.filters.page -= 1;
            fetchProducts();
          },
        })
      );

      const pages = [];
      if (totalPages <= 7) {
        for (let i = 1; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        if (curr > 3) pages.push('...');
        const s = Math.max(2, curr - 1);
        const e = Math.min(totalPages - 1, curr + 1);
        for (let i = s; i <= e; i++) pages.push(i);
        if (curr < totalPages - 2) pages.push('...');
        pages.push(totalPages);
      }

      pages.forEach((p) => {
        if (p === '...') {
          const dots = document.createElement('span');
          dots.className = 'px-2 text-slate-400';
          dots.textContent = '…';
          controls.appendChild(dots);
        } else {
          controls.appendChild(
            createButton({
              text: String(p),
              variant: p === curr ? 'primary' : 'cancel',
              size: 'sm',
              onClick: () => {
                state.filters.page = p;
                fetchProducts();
              },
            })
          );
        }
      });

      controls.appendChild(
        createButton({
          text: 'Siguiente',
          variant: 'cancel',
          size: 'sm',
          disabled: curr >= totalPages,
          onClick: () => {
            state.filters.page += 1;
            fetchProducts();
          },
        })
      );

      pager.append(info, controls);
      tableWrap.appendChild(pager);
    }

    holder.appendChild(tableWrap);
  }

  // Modo Tarjetas
  function renderCardsMode(holder) {
    if (state.loading) {
      holder.innerHTML = `
        <div class="p-12 text-center text-slate-400">
          <i class="fa-solid fa-spinner fa-spin text-2xl text-brand mb-2"></i>
          <p class="text-xs">Cargando productos...</p>
        </div>
      `;
      return;
    }

    if (state.items.length === 0) {
      const emptyBox = document.createElement('div');
      emptyBox.className =
        'w-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-12 text-center space-y-3 shadow-xs';
      emptyBox.innerHTML = `
        <div class="w-12 h-12 mx-auto rounded-xl bg-brand-soft/50 dark:bg-brand/10 text-brand flex items-center justify-center text-xl">
          <i class="fa-regular fa-folder-open"></i>
        </div>
        <p class="text-sm font-semibold text-slate-700 dark:text-slate-200">
          No se encontraron productos que coincidan con los filtros.
        </p>
      `;
      holder.appendChild(emptyBox);
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4';

    state.items.forEach((item) => {
      const card = document.createElement('div');
      card.className =
        'p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-brand/50 transition shadow-xs flex flex-col justify-between space-y-3';

      const actual = Number(item.stockActual) || 0;
      const min = Number(item.stockMinimo) || 0;
      let stockBadgeClass = 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400';
      if (!item.controlarStock) {
        stockBadgeClass = 'bg-slate-100 dark:bg-slate-800 text-slate-500';
      } else if (actual <= 0) {
        stockBadgeClass = 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400';
      } else if (actual <= min) {
        stockBadgeClass = 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300';
      }

      card.innerHTML = `
        <div class="space-y-3">
          <div class="relative w-full h-44 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 flex items-center justify-center overflow-hidden group">
            ${
              item.fotoPrincipal
                ? `<img src="${item.fotoPrincipal}" alt="${escapeHtml(
                    item.nombre
                  )}" class="w-full h-full object-cover group-hover:scale-105 transition duration-300">`
                : `<i class="fa-solid fa-cube text-slate-300 dark:text-slate-600 text-4xl"></i>`
            }
            <div class="absolute top-2.5 left-2.5">
              <span class="px-2 py-0.5 rounded-md font-mono text-[10px] font-bold bg-white/95 dark:bg-slate-900/95 text-brand shadow-xs border border-brand/20">
                ${escapeHtml(item.sku)}
              </span>
            </div>
            <div class="absolute top-2.5 right-2.5">
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${
                item.activo
                  ? 'bg-emerald-500 text-white shadow-xs'
                  : 'bg-slate-500 text-white shadow-xs'
              }">
                ${item.activo ? 'Activo' : 'Inactivo'}
              </span>
            </div>
          </div>
          <div>
            <span class="text-[10px] font-bold uppercase tracking-wider text-brand">
              ${escapeHtml(item.categoriaNombre || 'General')}
            </span>
            <h3 class="text-sm font-bold text-slate-900 dark:text-white line-clamp-2 mt-0.5" title="${escapeHtml(
              item.nombre
            )}">
              ${escapeHtml(item.nombre)}
            </h3>
          </div>
        </div>
        <div class="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-[10px] text-slate-400">Precio de venta</p>
              <p class="text-sm font-black text-slate-900 dark:text-white">
                ${formatGuaranies(item.precioVenta)}
              </p>
            </div>
            <div class="text-right">
              <p class="text-[10px] text-slate-400">Existencia</p>
              <span class="px-2 py-0.5 rounded text-[11px] font-bold ${stockBadgeClass}">
                ${item.controlarStock ? `${actual} ${item.unidadMedidaAbrev || 'un.'}` : 'Ilimitado'}
              </span>
            </div>
          </div>
          <div class="flex items-center justify-end gap-1.5 pt-1">
            <button type="button" class="btn-card-view px-2.5 py-1 text-xs text-slate-500 hover:text-brand cursor-pointer" title="Ver detalle">
              <i class="fa-regular fa-eye"></i>
            </button>
            <button type="button" class="btn-card-edit px-2.5 py-1 text-xs text-slate-500 hover:text-brand cursor-pointer" title="Editar">
              <i class="fa-regular fa-pen-to-square"></i>
            </button>
            <button type="button" class="btn-card-del px-2.5 py-1 text-xs text-danger hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded cursor-pointer" title="Eliminar">
              <i class="fa-regular fa-trash-can"></i>
            </button>
          </div>
        </div>
      `;

      card.querySelector('.btn-card-view')?.addEventListener('click', () => openProductDetail(item));
      card.querySelector('.btn-card-edit')?.addEventListener('click', () => editProduct(item));
      card.querySelector('.btn-card-del')?.addEventListener('click', () => confirmDeleteProduct(item));

      grid.appendChild(card);
    });

    holder.appendChild(grid);

    // Controles de paginación si supera 20 registros
    if (state.total > state.filters.pageSize) {
      const paginWrap = document.createElement('div');
      paginWrap.className = 'flex items-center justify-between pt-4';
      paginWrap.innerHTML = `
        <span class="text-xs text-slate-500 dark:text-slate-400">
          Mostrando ${state.items.length} de ${state.total} productos
        </span>
        <div class="flex items-center gap-1.5">
          <button type="button" id="card-page-prev" class="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold ${
            state.filters.page <= 1 ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-100 cursor-pointer'
          }">Anterior</button>
          <span class="text-xs font-bold px-2">${state.filters.page}</span>
          <button type="button" id="card-page-next" class="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold ${
            state.filters.page * state.filters.pageSize >= state.total
              ? 'opacity-40 cursor-not-allowed'
              : 'hover:bg-slate-100 cursor-pointer'
          }">Siguiente</button>
        </div>
      `;
      paginWrap.querySelector('#card-page-prev')?.addEventListener('click', () => {
        if (state.filters.page > 1) {
          state.filters.page -= 1;
          fetchProducts();
        }
      });
      paginWrap.querySelector('#card-page-next')?.addEventListener('click', () => {
        if (state.filters.page * state.filters.pageSize < state.total) {
          state.filters.page += 1;
          fetchProducts();
        }
      });
      holder.appendChild(paginWrap);
    }
  }

  // ============================================================================
  // VISTA 2: FORMULARIO "NUEVO PRODUCTO" / "EDITAR PRODUCTO" (Foto 2)
  // ============================================================================
  function renderFormView(parent) {
    const isEdit = Boolean(state.editingId);

    // Cabecera superior con flecha atrás, título, badge de borrador y switch Estado Activo
    const formHeader = document.createElement('div');
    formHeader.className =
      'flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200/80 dark:border-slate-800';

    const leftTitle = document.createElement('div');
    leftTitle.className = 'flex items-center gap-3';

    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className =
      'w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-brand/60 flex items-center justify-center transition cursor-pointer shadow-2xs';
    backBtn.innerHTML = '<i class="fa-solid fa-arrow-left"></i>';
    backBtn.title = 'Volver al catálogo';
    backBtn.addEventListener('click', () => {
      state.view = 'list';
      state.editingId = null;
      render();
    });

    const titleTexts = document.createElement('div');
    titleTexts.innerHTML = `
      <div class="flex items-center gap-2.5">
        <h1 class="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
          ${isEdit ? 'Editar Producto' : 'Nuevo Producto'}
        </h1>
        ${
          state.restoredDraft && !isEdit
            ? `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 animate-pulse">
                <i class="fa-solid fa-check text-[10px]"></i>
                <span>Datos restaurados</span>
              </span>`
            : ''
        }
      </div>
      <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
        Complete los datos generales, precios e inventario para agregar un nuevo artículo al catálogo.
      </p>
    `;

    leftTitle.append(backBtn, titleTexts);

    // Switch Estado Activo / Inactivo en la cabecera
    const statusSwitchWrap = document.createElement('label');
    statusSwitchWrap.className = 'inline-flex items-center gap-3 cursor-pointer select-none';
    statusSwitchWrap.innerHTML = `
      <span class="text-xs font-bold text-slate-700 dark:text-slate-200">Estado:</span>
      <div class="relative inline-flex items-center">
        <input type="checkbox" id="form-switch-activo" class="sr-only peer" ${
          state.form.activo ? 'checked' : ''
        } />
        <div class="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand"></div>
      </div>
      <span id="form-label-activo" class="text-xs font-semibold ${
        state.form.activo ? 'text-brand' : 'text-slate-400'
      }">${state.form.activo ? 'Activo' : 'Inactivo'}</span>
    `;

    statusSwitchWrap.querySelector('#form-switch-activo').addEventListener('change', (e) => {
      state.form.activo = e.target.checked;
      const lbl = statusSwitchWrap.querySelector('#form-label-activo');
      lbl.textContent = state.form.activo ? 'Activo' : 'Inactivo';
      lbl.className = `text-xs font-semibold ${state.form.activo ? 'text-brand' : 'text-slate-400'}`;
      saveDraft();
    });

    formHeader.append(leftTitle, statusSwitchWrap);
    parent.appendChild(formHeader);

    // Formulario en rejilla de 2 columnas principales (Izquierda: Datos/Precios/Stock, Derecha: Opciones/Fotos)
    const formGrid = document.createElement('div');
    formGrid.className = 'grid grid-cols-1 lg:grid-cols-12 gap-5 items-start';

    // ==========================================================================
    // COLUMNA IZQUIERDA (lg:col-span-8): Bloques 1, 2 y 3
    // ==========================================================================
    const leftCol = document.createElement('div');
    leftCol.className = 'lg:col-span-8 space-y-5';

    // --------------------------------------------------------------------------
    // Bloque 1: Datos Generales
    // --------------------------------------------------------------------------
    const cardGenerales = document.createElement('section');
    cardGenerales.className =
      'p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4';
    cardGenerales.innerHTML = `
      <div class="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
        <span class="w-6 h-6 rounded-full bg-brand-soft dark:bg-brand/20 text-brand text-xs font-bold flex items-center justify-center">1</span>
        <h2 class="text-xs font-bold uppercase tracking-wider text-brand">Datos Generales</h2>
      </div>

      <!-- Nombre del producto -->
      <div>
        <label class="block text-xs font-bold text-slate-800 dark:text-slate-100 mb-1">
          Nombre del producto <span class="text-danger">*</span>
        </label>
        <input type="text" id="inp-nombre" value="${escapeHtml(state.form.nombre)}"
          placeholder="Ej. Taza Personalizada Cerámica Blanca 350ml"
          class="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand font-medium" />
      </div>

      <!-- Fila 2: SKU / Código interno + Código de barras -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="text-xs font-bold text-slate-800 dark:text-slate-100">
              SKU / Código interno <span class="text-danger">*</span>
            </label>
            <button type="button" id="btn-autogenerar-sku" class="text-[11px] font-bold text-brand hover:underline cursor-pointer focus:outline-none">
              Autogenerar
            </button>
          </div>
          <input type="text" id="inp-sku" value="${escapeHtml(state.form.sku)}"
            placeholder="PRD-000000"
            class="w-full px-3.5 py-2 text-xs sm:text-sm font-mono font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand" />
          <p id="sku-helper" class="text-[10px] text-slate-400 mt-0.5">Formato estándar PRD-000000.</p>
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-800 dark:text-slate-100 mb-1">
            Código de barras (EAN / UPC)
          </label>
          <input type="text" id="inp-codbarras" value="${escapeHtml(state.form.codigoBarras)}"
            placeholder="Ej. 7840001234567"
            class="w-full px-3.5 py-2 text-xs sm:text-sm font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand" />
        </div>
      </div>

      <!-- Fila 3: Categoría + Marca + Unidad de medida -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label class="block text-xs font-bold text-slate-800 dark:text-slate-100 mb-1">
            Categoría <span class="text-danger">*</span>
          </label>
          <select id="sel-categoria" class="w-full px-3 py-2 text-xs sm:text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand">
            <option value="">-- Seleccionar categoría --</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-800 dark:text-slate-100 mb-1">
            Marca
          </label>
          <select id="sel-marca" class="w-full px-3 py-2 text-xs sm:text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand">
            <option value="">-- Sin marca / Genérica --</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-800 dark:text-slate-100 mb-1">
            Unidad de medida <span class="text-danger">*</span>
          </label>
          <select id="sel-unidad" class="w-full px-3 py-2 text-xs sm:text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand">
          </select>
        </div>
      </div>

      <!-- Descripción del producto -->
      <div>
        <label class="block text-xs font-bold text-slate-800 dark:text-slate-100 mb-1">
          Descripción del producto
        </label>
        <textarea id="inp-descripcion" rows="3"
          placeholder="Detalles sobre características, materiales, especificaciones técnicas o uso..."
          class="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand resize-y">${escapeHtml(
            state.form.descripcion
          )}</textarea>
      </div>
    `;

    // Llenar selects
    const selCat = cardGenerales.querySelector('#sel-categoria');
    state.categorias.forEach((c) => {
      const opt = document.createElement('option');
      opt.value = String(c.id);
      opt.textContent = c.nombre;
      if (String(c.id) === String(state.form.categoriaId)) opt.selected = true;
      selCat.appendChild(opt);
    });

    const selMarca = cardGenerales.querySelector('#sel-marca');
    state.marcas.forEach((m) => {
      const opt = document.createElement('option');
      opt.value = String(m.id);
      opt.textContent = m.nombre;
      if (String(m.id) === String(state.form.marcaId)) opt.selected = true;
      selMarca.appendChild(opt);
    });

    const selUnidad = cardGenerales.querySelector('#sel-unidad');
    state.unidades.forEach((u) => {
      const opt = document.createElement('option');
      opt.value = String(u.id);
      opt.textContent = `${u.nombre} (${u.abreviatura})`;
      if (String(u.id) === String(state.form.unidadMedidaId)) opt.selected = true;
      selUnidad.appendChild(opt);
    });

    // Eventos generales
    const inpNombre = cardGenerales.querySelector('#inp-nombre');
    inpNombre.addEventListener('input', (e) => {
      state.form.nombre = e.target.value;
      saveDraft();
    });

    const inpSKU = cardGenerales.querySelector('#inp-sku');
    inpSKU.addEventListener('input', (e) => {
      state.form.sku = e.target.value.toUpperCase();
      inpSKU.value = state.form.sku;
      saveDraft();
    });

    cardGenerales.querySelector('#btn-autogenerar-sku')?.addEventListener('click', () => {
      state.form.sku = generateRandomSKU();
      inpSKU.value = state.form.sku;
      saveDraft();
      toast.info(`Nuevo SKU generado: ${state.form.sku}`);
    });

    cardGenerales.querySelector('#inp-codbarras')?.addEventListener('input', (e) => {
      state.form.codigoBarras = e.target.value;
      saveDraft();
    });

    selCat.addEventListener('change', (e) => {
      state.form.categoriaId = e.target.value;
      saveDraft();
    });

    selMarca.addEventListener('change', (e) => {
      state.form.marcaId = e.target.value;
      saveDraft();
    });

    selUnidad.addEventListener('change', (e) => {
      state.form.unidadMedidaId = e.target.value;
      updateStockUnitLabels();
      saveDraft();
    });

    cardGenerales.querySelector('#inp-descripcion')?.addEventListener('input', (e) => {
      state.form.descripcion = e.target.value;
      saveDraft();
    });

    leftCol.appendChild(cardGenerales);

    // --------------------------------------------------------------------------
    // Bloque 2: Precios e Impuestos (Moneda Guaraníes · PYG)
    // --------------------------------------------------------------------------
    const cardPrecios = document.createElement('section');
    cardPrecios.className =
      'p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4';
    cardPrecios.innerHTML = `
      <div class="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
        <div class="flex items-center gap-2">
          <span class="w-6 h-6 rounded-full bg-brand-soft dark:bg-brand/20 text-brand text-xs font-bold flex items-center justify-center">2</span>
          <h2 class="text-xs font-bold uppercase tracking-wider text-brand">Precios e Impuestos (Moneda Guaraníes · PYG)</h2>
        </div>
        <span id="badge-margen" class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-500">
          Margen: 0%
        </span>
      </div>

      <!-- Encima de los campos de precio: Selector de Proveedor opcional -->
      <div>
        <label class="block text-xs font-bold text-slate-800 dark:text-slate-100 mb-1">
          Proveedor de compra (Opcional)
        </label>
        <select id="sel-proveedor" class="w-full px-3.5 py-2 text-xs sm:text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand">
          <option value="">-- Sin proveedor asociado / Fabricación propia --</option>
        </select>
        <p class="text-[11px] text-slate-400 mt-1">
          Seleccione el proveedor que suministra este artículo para comparar costos de compra y compras futuras.
        </p>
      </div>

      <!-- Fila de Costo, Precio Venta e IVA -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
        <div>
          <label class="block text-xs font-bold text-slate-800 dark:text-slate-100 mb-1">
            Costo de compra (Gs.)
          </label>
          <div class="relative">
            <input type="text" id="inp-costo" value="${formatGuaranies(state.form.costoCompra).replace(' Gs.', '')}"
              placeholder="0"
              class="w-full px-3.5 py-2 pr-10 text-xs sm:text-sm font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand" />
            <span class="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Gs.</span>
          </div>
          <p class="text-[10px] text-slate-400 mt-0.5">Precio al que el proveedor vende al negocio.</p>
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-800 dark:text-slate-100 mb-1">
            Precio de venta al público <span class="text-danger">*</span>
          </label>
          <div class="relative">
            <input type="text" id="inp-precio" value="${formatGuaranies(state.form.precioVenta).replace(' Gs.', '')}"
              placeholder="0"
              class="w-full px-3.5 py-2 pr-10 text-xs sm:text-sm font-bold rounded-xl border border-brand/50 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand" />
            <span class="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-brand">Gs.</span>
          </div>
          <p class="text-[10px] text-slate-400 mt-0.5">Precio final para clientes en mostrador y web.</p>
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-800 dark:text-slate-100 mb-1">
            IVA <span class="text-danger">*</span>
          </label>
          <select id="sel-iva" class="w-full px-3 py-2 text-xs sm:text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand">
            <option value="10%" ${state.form.iva === '10%' ? 'selected' : ''}>10% (General)</option>
            <option value="5%" ${state.form.iva === '5%' ? 'selected' : ''}>5%</option>
            <option value="Exento" ${state.form.iva === 'Exento' ? 'selected' : ''}>Exento</option>
          </select>
        </div>
      </div>
    `;

    // Cargar proveedores
    const selProv = cardPrecios.querySelector('#sel-proveedor');
    state.proveedores.forEach((p) => {
      const opt = document.createElement('option');
      opt.value = String(p.id);
      opt.textContent = `${p.razonSocial || p.nombreComercial} (${p.rucDocumento || 'Sin RUC'})`;
      if (String(p.id) === String(state.form.proveedorId)) opt.selected = true;
      selProv.appendChild(opt);
    });

    selProv.addEventListener('change', (e) => {
      state.form.proveedorId = e.target.value;
      saveDraft();
    });

    const inpCosto = cardPrecios.querySelector('#inp-costo');
    const inpPrecio = cardPrecios.querySelector('#inp-precio');
    const badgeMargen = cardPrecios.querySelector('#badge-margen');

    function updateMarginBadge() {
      const costo = state.form.costoCompra || 0;
      const venta = state.form.precioVenta || 0;
      if (venta <= 0) {
        badgeMargen.className =
          'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-500';
        badgeMargen.textContent = 'Margen: 0%';
        return;
      }
      const ganancia = venta - costo;
      let pct = 0;
      if (costo > 0) {
        pct = Math.round(((venta - costo) / costo) * 1000) / 10;
      } else {
        pct = 100;
      }

      if (ganancia >= 0) {
        badgeMargen.className =
          'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800';
        badgeMargen.innerHTML = `<i class="fa-solid fa-arrow-trend-up text-[10px]"></i><span>Margen: +${pct}% (+${formatGuaranies(
          ganancia
        )})</span>`;
      } else {
        badgeMargen.className =
          'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-300 dark:border-rose-800';
        badgeMargen.innerHTML = `<i class="fa-solid fa-arrow-trend-down text-[10px]"></i><span>Margen: ${pct}% (${formatGuaranies(
          ganancia
        )})</span>`;
      }
    }

    inpCosto.addEventListener('input', (e) => {
      const parsed = parseGuaranies(e.target.value);
      state.form.costoCompra = parsed;
      e.target.value = parsed.toLocaleString('es-PY');
      updateMarginBadge();
      saveDraft();
    });

    inpPrecio.addEventListener('input', (e) => {
      const parsed = parseGuaranies(e.target.value);
      state.form.precioVenta = parsed;
      e.target.value = parsed.toLocaleString('es-PY');
      updateMarginBadge();
      saveDraft();
    });

    cardPrecios.querySelector('#sel-iva')?.addEventListener('change', (e) => {
      state.form.iva = e.target.value;
      saveDraft();
    });

    updateMarginBadge();
    leftCol.appendChild(cardPrecios);

    // --------------------------------------------------------------------------
    // Bloque 3: Inventario y Control de Existencias
    // --------------------------------------------------------------------------
    const cardStock = document.createElement('section');
    cardStock.className =
      'p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4';
    cardStock.innerHTML = `
      <div class="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
        <div class="flex items-center gap-2">
          <span class="w-6 h-6 rounded-full bg-brand-soft dark:bg-brand/20 text-brand text-xs font-bold flex items-center justify-center">3</span>
          <h2 class="text-xs font-bold uppercase tracking-wider text-brand">Inventario y Control de Existencias</h2>
        </div>
        <label class="inline-flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" id="chk-controlar-stock" class="w-4 h-4 rounded accent-brand cursor-pointer" ${
            state.form.controlarStock ? 'checked' : ''
          } />
          <span class="text-xs font-bold text-slate-800 dark:text-slate-100">Controlar stock</span>
        </label>
      </div>

      <div id="stock-inputs-row" class="grid grid-cols-1 sm:grid-cols-2 gap-4 ${
        state.form.controlarStock ? '' : 'opacity-40 pointer-events-none'
      }">
        <div>
          <label class="block text-xs font-bold text-slate-800 dark:text-slate-100 mb-1">
            Stock actual <span class="text-danger">*</span>
          </label>
          <div class="relative">
            <input type="number" id="inp-stock-actual" value="${state.form.stockActual}" step="any" min="0"
              class="w-full px-3.5 py-2 pr-12 text-xs sm:text-sm font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand" />
            <span class="unit-abrev-tag absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">un.</span>
          </div>
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-800 dark:text-slate-100 mb-1">
            Stock mínimo (Alerta de reposición)
          </label>
          <div class="relative">
            <input type="number" id="inp-stock-minimo" value="${state.form.stockMinimo}" step="any" min="0"
              class="w-full px-3.5 py-2 pr-12 text-xs sm:text-sm font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand" />
            <span class="unit-abrev-tag absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">un.</span>
          </div>
        </div>
      </div>
    `;

    const chkControlar = cardStock.querySelector('#chk-controlar-stock');
    const stockRow = cardStock.querySelector('#stock-inputs-row');
    chkControlar.addEventListener('change', (e) => {
      state.form.controlarStock = e.target.checked;
      if (state.form.controlarStock) {
        stockRow.classList.remove('opacity-40', 'pointer-events-none');
      } else {
        stockRow.classList.add('opacity-40', 'pointer-events-none');
      }
      saveDraft();
    });

    cardStock.querySelector('#inp-stock-actual')?.addEventListener('input', (e) => {
      state.form.stockActual = Number(e.target.value) || 0;
      saveDraft();
    });

    cardStock.querySelector('#inp-stock-minimo')?.addEventListener('input', (e) => {
      state.form.stockMinimo = Number(e.target.value) || 0;
      saveDraft();
    });

    function updateStockUnitLabels() {
      const found = state.unidades.find((u) => String(u.id) === String(state.form.unidadMedidaId));
      const abrev = found ? found.abreviatura : 'un.';
      cardStock.querySelectorAll('.unit-abrev-tag').forEach((el) => {
        el.textContent = abrev;
      });
    }
    updateStockUnitLabels();

    leftCol.appendChild(cardStock);
    formGrid.appendChild(leftCol);

    // ==========================================================================
    // COLUMNA DERECHA (lg:col-span-4): Opciones Web, Foto Principal y Galería
    // ==========================================================================
    const rightCol = document.createElement('div');
    rightCol.className = 'lg:col-span-4 space-y-5';

    // --------------------------------------------------------------------------
    // Card A: Opciones Web y Tienda
    // --------------------------------------------------------------------------
    const cardWeb = document.createElement('section');
    cardWeb.className =
      'p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4';
    cardWeb.innerHTML = `
      <div class="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
        <h3 class="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <i class="fa-solid fa-globe text-brand"></i>
          <span>Opciones Web y Tienda</span>
        </h3>
        <span class="text-[10px] font-bold uppercase text-brand">Online</span>
      </div>

      <div class="space-y-3.5">
        <!-- Mostrar en web -->
        <label class="flex items-center justify-between gap-3 cursor-pointer select-none">
          <div>
            <p class="text-xs font-bold text-slate-800 dark:text-slate-100">Mostrar en web</p>
            <p class="text-[11px] text-slate-400">Visible en catálogo y tienda online</p>
          </div>
          <input type="checkbox" id="switch-mostrar-web" class="w-4 h-4 rounded accent-brand cursor-pointer" ${
            state.form.mostrarEnWeb ? 'checked' : ''
          } />
        </label>

        <!-- Mostrar precio -->
        <label class="flex items-center justify-between gap-3 cursor-pointer select-none">
          <div>
            <p class="text-xs font-bold text-slate-800 dark:text-slate-100">Mostrar precio</p>
            <p class="text-[11px] text-slate-400">Publicar valor de venta al público</p>
          </div>
          <input type="checkbox" id="switch-mostrar-precio" class="w-4 h-4 rounded accent-brand cursor-pointer" ${
            state.form.mostrarPrecio ? 'checked' : ''
          } />
        </label>

        <!-- Permitir sin stock -->
        <label class="flex items-center justify-between gap-3 cursor-pointer select-none">
          <div>
            <p class="text-xs font-bold text-slate-800 dark:text-slate-100">Permitir sin stock</p>
            <p class="text-[11px] text-slate-400">Permitir pedidos o consultas aunque stock sea 0</p>
          </div>
          <input type="checkbox" id="switch-permitir-sin-stock" class="w-4 h-4 rounded accent-brand cursor-pointer" ${
            state.form.permitirSinStock ? 'checked' : ''
          } />
        </label>

        <!-- En promoción -->
        <label class="flex items-center justify-between gap-3 cursor-pointer select-none">
          <div>
            <p class="text-xs font-bold text-slate-800 dark:text-slate-100">% En promoción</p>
            <p class="text-[11px] text-slate-400">Aplicar badge y precio de oferta</p>
          </div>
          <input type="checkbox" id="switch-en-promocion" class="w-4 h-4 rounded accent-brand cursor-pointer" ${
            state.form.enPromocion ? 'checked' : ''
          } />
        </label>
      </div>
    `;

    cardWeb.querySelector('#switch-mostrar-web')?.addEventListener('change', (e) => {
      state.form.mostrarEnWeb = e.target.checked;
      saveDraft();
    });
    cardWeb.querySelector('#switch-mostrar-precio')?.addEventListener('change', (e) => {
      state.form.mostrarPrecio = e.target.checked;
      saveDraft();
    });
    cardWeb.querySelector('#switch-permitir-sin-stock')?.addEventListener('change', (e) => {
      state.form.permitirSinStock = e.target.checked;
      saveDraft();
    });
    cardWeb.querySelector('#switch-en-promocion')?.addEventListener('change', (e) => {
      state.form.enPromocion = e.target.checked;
      saveDraft();
    });

    rightCol.appendChild(cardWeb);

    // --------------------------------------------------------------------------
    // Card B: Foto Principal
    // --------------------------------------------------------------------------
    const cardFoto = document.createElement('section');
    cardFoto.className =
      'p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3';
    cardFoto.innerHTML = `
      <div class="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
        <h3 class="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <i class="fa-regular fa-image text-brand"></i>
          <span>Foto Principal</span>
        </h3>
        <span class="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">WebP 1200px</span>
      </div>

      <div id="dropzone-foto-principal" class="relative w-full min-h-[160px] p-4 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-brand/60 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col items-center justify-center text-center transition cursor-pointer group">
        <input type="file" id="inp-file-principal" accept="image/png,image/jpeg,image/webp,image/*" class="hidden" />
        <div id="preview-foto-holder" class="w-full flex flex-col items-center justify-center">
          <!-- Dinámico -->
        </div>
      </div>
    `;

    const dropzone = cardFoto.querySelector('#dropzone-foto-principal');
    const fileInp = cardFoto.querySelector('#inp-file-principal');
    const previewHolder = cardFoto.querySelector('#preview-foto-holder');

    function renderMainPhotoPreview() {
      previewHolder.innerHTML = '';
      if (state.form.fotoPrincipal) {
        const photoObj =
          typeof state.form.fotoPrincipal === 'string'
            ? { data: state.form.fotoPrincipal, nombre: 'foto_principal.webp', formato: 'WEBP' }
            : state.form.fotoPrincipal;

        const box = document.createElement('div');
        box.className = 'relative w-full flex flex-col items-center gap-2';
        box.innerHTML = `
          <div class="relative w-full h-44 rounded-xl overflow-hidden bg-slate-900 shadow-xs group/img">
            <img src="${photoObj.data}" alt="Foto Principal" class="w-full h-full object-contain cursor-zoom-in">
            <button type="button" id="btn-del-main-photo" class="absolute top-2 right-2 w-7 h-7 rounded-full bg-danger text-white text-xs flex items-center justify-center shadow-md hover:scale-110 transition cursor-pointer" title="Eliminar foto">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
          <div class="text-center">
            <p class="text-xs font-bold text-slate-800 dark:text-slate-100 truncate max-w-xs">${escapeHtml(
              photoObj.nombre || 'foto.webp'
            )}</p>
            <p class="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold uppercase">${escapeHtml(
              photoObj.formato || 'WEBP'
            )} ${photoObj.sizeKb ? `· ${photoObj.sizeKb} KB` : ''}</p>
          </div>
        `;
        box.querySelector('img')?.addEventListener('click', (e) => {
          e.stopPropagation();
          openImageZoomModal({
            src: photoObj.data,
            nombre: photoObj.nombre || 'foto.webp',
            formato: photoObj.formato || 'WEBP',
          });
        });
        box.querySelector('#btn-del-main-photo')?.addEventListener('click', (e) => {
          e.stopPropagation();
          state.form.fotoPrincipal = null;
          fileInp.value = '';
          renderMainPhotoPreview();
          saveDraft();
        });
        previewHolder.appendChild(box);
      } else {
        previewHolder.innerHTML = `
          <div class="w-10 h-10 rounded-xl bg-brand-soft dark:bg-brand/20 text-brand flex items-center justify-center text-lg mb-2 group-hover:scale-110 transition">
            <i class="fa-regular fa-image"></i>
          </div>
          <p class="text-xs font-bold text-slate-800 dark:text-slate-100">
            Haga clic o arrastre una imagen aquí
          </p>
          <p class="text-[10px] text-slate-400 mt-0.5">
            JPG, PNG o WebP (Máx. 50 MB). Optimizado a WebP.
          </p>
        `;
      }
    }

    dropzone.addEventListener('click', () => {
      if (!state.form.fotoPrincipal) fileInp.click();
    });

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('border-brand', 'bg-brand-soft/20');
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('border-brand', 'bg-brand-soft/20');
    });

    dropzone.addEventListener('drop', async (e) => {
      e.preventDefault();
      dropzone.classList.remove('border-brand', 'bg-brand-soft/20');
      const file = e.dataTransfer?.files?.[0];
      if (file) handleMainPhotoUpload(file);
    });

    fileInp.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (file) handleMainPhotoUpload(file);
    });

    async function handleMainPhotoUpload(file) {
      try {
        toast.info('Procesando y optimizando imagen a WebP...');
        const processed = await processImageToWebP(file, 1200);
        state.form.fotoPrincipal = processed;
        renderMainPhotoPreview();
        saveDraft();
        toast.success(`Foto principal guardada (${processed.nombre})`);
      } catch (err) {
        toast.error(err.message || 'Error al procesar la imagen.');
      }
    }

    renderMainPhotoPreview();
    rightCol.appendChild(cardFoto);

    // --------------------------------------------------------------------------
    // Card C: Galería de Fotos Adicionales (Hasta 10 fotos)
    // --------------------------------------------------------------------------
    const cardGaleria = document.createElement('section');
    cardGaleria.className =
      'p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3';
    cardGaleria.innerHTML = `
      <div class="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
        <h3 class="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <i class="fa-solid fa-images text-brand"></i>
          <span>Galería de Fotos Adicionales</span>
        </h3>
        <span id="galeria-counter" class="text-[10px] font-bold font-mono text-slate-400">0 / 10</span>
      </div>

      <input type="file" id="inp-file-galeria" accept="image/png,image/jpeg,image/webp,image/*" multiple class="hidden" />

      <div id="galeria-grid" class="grid grid-cols-4 gap-2.5 pt-1">
        <!-- Render dinámico -->
      </div>
      <p class="text-[10px] text-slate-400">
        Hasta 10 fotos secundarias optimizadas automáticamente a WebP. Clic en cualquier foto para verla ampliada.
      </p>
    `;

    const galeriaGrid = cardGaleria.querySelector('#galeria-grid');
    const galeriaCounter = cardGaleria.querySelector('#galeria-counter');
    const inpGaleria = cardGaleria.querySelector('#inp-file-galeria');

    function renderGalleryGrid() {
      galeriaGrid.innerHTML = '';
      const list = Array.isArray(state.form.galeriaFotos) ? state.form.galeriaFotos : [];
      galeriaCounter.textContent = `${list.length} / 10`;

      list.forEach((item, idx) => {
        const itemObj = typeof item === 'string' ? { data: item, nombre: `foto_${idx + 1}.webp` } : item;
        const box = document.createElement('div');
        box.className =
          'relative aspect-square rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs group cursor-pointer';
        box.innerHTML = `
          <img src="${itemObj.data}" alt="Foto adicional" class="w-full h-full object-cover">
          <button type="button" class="btn-del-galeria absolute top-1 right-1 w-5 h-5 rounded-full bg-danger text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition cursor-pointer" title="Quitar">
            <i class="fa-solid fa-xmark"></i>
          </button>
        `;
        box.querySelector('img')?.addEventListener('click', () => {
          openImageZoomModal({
            src: itemObj.data,
            nombre: itemObj.nombre || `galeria_${idx + 1}.webp`,
            formato: 'WEBP',
          });
        });
        box.querySelector('.btn-del-galeria')?.addEventListener('click', (e) => {
          e.stopPropagation();
          state.form.galeriaFotos.splice(idx, 1);
          renderGalleryGrid();
          saveDraft();
        });
        galeriaGrid.appendChild(box);
      });

      // Botón para agregar más fotos si no supera 10
      if (list.length < 10) {
        const addSlot = document.createElement('button');
        addSlot.type = 'button';
        addSlot.className =
          'aspect-square rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-brand/60 bg-slate-50/50 dark:bg-slate-800/40 text-slate-400 hover:text-brand flex flex-col items-center justify-center gap-1 transition cursor-pointer';
        addSlot.innerHTML = `<i class="fa-solid fa-plus text-base"></i>`;
        addSlot.title = 'Agregar fotos adicionales';
        addSlot.addEventListener('click', () => inpGaleria.click());
        galeriaGrid.appendChild(addSlot);
      }
    }

    inpGaleria.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;

      const currentList = Array.isArray(state.form.galeriaFotos) ? state.form.galeriaFotos : [];
      const remainingSlots = 10 - currentList.length;

      if (remainingSlots <= 0) {
        toast.warning('Ya has alcanzado el límite máximo de 10 fotos.');
        return;
      }

      const toProcess = files.slice(0, remainingSlots);
      toast.info(`Optimizando ${toProcess.length} foto(s) a WebP...`);

      for (const f of toProcess) {
        try {
          const proc = await processImageToWebP(f, 1200);
          currentList.push(proc);
        } catch (err) {
          toast.warning(`No se pudo procesar ${f.name}: ${err.message}`);
        }
      }
      state.form.galeriaFotos = currentList;
      renderGalleryGrid();
      saveDraft();
      toast.success('Fotos agregadas a la galería.');
      inpGaleria.value = '';
    });

    renderGalleryGrid();
    rightCol.appendChild(cardGaleria);
    formGrid.appendChild(rightCol);
    parent.appendChild(formGrid);

    // ==========================================================================
    // PIE DE ACCIONES: Cancelar y Guardar producto
    // ==========================================================================
    const footerBar = document.createElement('div');
    footerBar.className =
      'flex items-center justify-end gap-3 pt-4 border-t border-slate-200/80 dark:border-slate-800';

    const cancelBtn = createButton({
      text: 'Cancelar',
      variant: 'cancel',
      size: 'md',
      onClick: () => {
        openConfirmModal({
          title: '¿Descartar cambios?',
          message: 'Si vuelve al listado perderá los datos que no hayan sido guardados.',
          confirmText: 'Sí, descartar',
          cancelText: 'Continuar editando',
          onConfirm: () => {
            clearDraft();
            state.view = 'list';
            state.editingId = null;
            render();
          },
        });
      },
    });

    const saveBtn = createButton({
      text: isEdit ? 'Actualizar producto' : 'Guardar producto',
      icon: 'fa-regular fa-floppy-disk',
      variant: 'primary',
      size: 'md',
      onClick: async (_, btnInstance) => {
        // Validaciones
        const nombre = String(state.form.nombre || '').trim();
        if (!nombre) {
          toast.warning('El nombre del producto es obligatorio.');
          cardGenerales.querySelector('#inp-nombre')?.focus();
          return;
        }

        const sku = String(state.form.sku || '').trim().toUpperCase();
        if (!sku) {
          toast.warning('El SKU / código interno es obligatorio.');
          cardGenerales.querySelector('#inp-sku')?.focus();
          return;
        }

        if (!state.form.categoriaId) {
          toast.warning('Debe seleccionar una categoría para el producto.');
          cardGenerales.querySelector('#sel-categoria')?.focus();
          return;
        }

        const precio = Number(state.form.precioVenta) || 0;
        if (precio <= 0) {
          toast.warning('El precio de venta al público debe ser mayor a 0 Gs.');
          cardPrecios.querySelector('#inp-precio')?.focus();
          return;
        }

        btnInstance.setLoading(true);
        try {
          // Comprobar SKU único
          const checkUrl = `/api/productos/check-sku?sku=${encodeURIComponent(sku)}${
            isEdit ? `&exclude_id=${state.editingId}` : ''
          }`;
          const skuCheck = await apiFetch(checkUrl);
          if (skuCheck && skuCheck.existe) {
            toast.error(`El SKU '${sku}' ya está registrado en otro producto. Autogenere uno nuevo.`);
            cardGenerales.querySelector('#inp-sku')?.focus();
            return;
          }

          // Preparar payload
          const payload = {
            nombre,
            sku,
            codigoBarras: String(state.form.codigoBarras || '').trim(),
            categoriaId: Number(state.form.categoriaId),
            marcaId: state.form.marcaId ? Number(state.form.marcaId) : null,
            unidadMedidaId: Number(state.form.unidadMedidaId) || 1,
            descripcion: String(state.form.descripcion || '').trim(),
            proveedorId: state.form.proveedorId ? Number(state.form.proveedorId) : null,
            costoCompra: Number(state.form.costoCompra) || 0,
            precioVenta: precio,
            iva: state.form.iva || '10%',
            controlarStock: Boolean(state.form.controlarStock),
            stockActual: Number(state.form.stockActual) || 0,
            stockMinimo: Number(state.form.stockMinimo) || 0,
            activo: Boolean(state.form.activo),
            mostrarEnWeb: Boolean(state.form.mostrarEnWeb),
            mostrarPrecio: Boolean(state.form.mostrarPrecio),
            permitirSinStock: Boolean(state.form.permitirSinStock),
            enPromocion: Boolean(state.form.enPromocion),
            fotoPrincipal: state.form.fotoPrincipal ? state.form.fotoPrincipal.data || state.form.fotoPrincipal : '',
            galeriaFotos: (state.form.galeriaFotos || []).map((x) => (typeof x === 'string' ? x : x.data)),
          };

          if (isEdit) {
            await apiFetch(`/api/productos/${state.editingId}`, {
              method: 'PUT',
              body: JSON.stringify(payload),
            });
            toast.success(`Producto '${nombre}' actualizado exitosamente.`);
          } else {
            await apiFetch('/api/productos', {
              method: 'POST',
              body: JSON.stringify(payload),
            });
            toast.success(`Producto '${nombre}' creado y guardado en catálogo.`);
          }

          clearDraft();
          state.view = 'list';
          state.editingId = null;
          fetchProducts();
        } catch (err) {
          toast.error(err.message || 'Error al guardar el producto.');
        } finally {
          btnInstance.setLoading(false);
        }
      },
    });

    footerBar.append(cancelBtn, saveBtn);
    parent.appendChild(footerBar);
  }

  // ============================================================================
  // ACCIONES: Vista Previa, Editar y Eliminar
  // ============================================================================
  function editProduct(item) {
    state.editingId = item.id;
    state.restoredDraft = false;
    state.form = {
      nombre: item.nombre || '',
      sku: item.sku || '',
      codigoBarras: item.codigoBarras || '',
      categoriaId: item.categoriaId || '',
      marcaId: item.marcaId || '',
      unidadMedidaId: item.unidadMedidaId || 1,
      descripcion: item.descripcion || '',
      proveedorId: item.proveedorId || '',
      costoCompra: item.costoCompra || 0,
      precioVenta: item.precioVenta || 0,
      iva: item.iva || '10%',
      controlarStock: item.controlarStock !== false,
      stockActual: item.stockActual || 0,
      stockMinimo: item.stockMinimo || 0,
      activo: item.activo !== false,
      mostrarEnWeb: item.mostrarEnWeb !== false,
      mostrarPrecio: item.mostrarPrecio !== false,
      permitirSinStock: Boolean(item.permitirSinStock),
      enPromocion: Boolean(item.enPromocion),
      fotoPrincipal: item.fotoPrincipal ? { data: item.fotoPrincipal, nombre: `${item.sku}.webp`, formato: 'WEBP' } : null,
      galeriaFotos: (item.galeriaFotos || []).map((url, i) => ({
        data: url,
        nombre: `foto_${i + 1}.webp`,
        formato: 'WEBP',
      })),
    };
    state.view = 'form';
    render();
  }

  function confirmDeleteProduct(item) {
    openConfirmModal({
      title: '¿Enviar a Reciclaje?',
      message: `El producto '${item.nombre}' (${item.sku}) será retirado del catálogo activo y pasará al módulo de Reciclaje con fecha, hora y usuario.`,
      confirmText: 'Sí, eliminar',
      cancelText: 'Cancelar',
      onConfirm: async () => {
        try {
          await apiFetch(`/api/productos/${item.id}`, { method: 'DELETE' });
          toast.info(`Producto '${item.sku}' movido a Reciclaje.`);
          fetchProducts();
        } catch (err) {
          toast.error(err.message || 'No se pudo eliminar el producto.');
        }
      },
    });
  }

  function openProductDetail(item) {
    state.viewingProduct = item;
    state.view = 'detail';
    render();
  }

  // ============================================================================
  // VISTA 3: VISTA PREVIA DETALLADA DEL PRODUCTO (Toma toda el área del módulo)
  // ============================================================================
  function renderDetailView(parent) {
    const item = state.viewingProduct || {};

    const pageWrap = document.createElement('div');
    pageWrap.className = 'w-full space-y-6 pb-12';

    // 1. Breadcrumb de navegación
    const breadcrumb = document.createElement('div');
    breadcrumb.className = 'flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400';
    breadcrumb.innerHTML = `
      <button type="button" id="btn-bc-back" class="inline-flex items-center gap-1.5 hover:text-brand font-medium cursor-pointer">
        <i class="fa-solid fa-arrow-left text-[11px]"></i>
        <span>Catálogo de Productos</span>
      </button>
      <span>/</span>
      <span class="text-brand font-semibold">Vista Previa de Producto</span>
    `;
    breadcrumb.querySelector('#btn-bc-back')?.addEventListener('click', () => {
      state.view = 'list';
      state.viewingProduct = null;
      render();
    });
    pageWrap.appendChild(breadcrumb);

    // 2. Barra de Título Superior con acciones y estado
    const titleBar = document.createElement('div');
    titleBar.className =
      'flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs';

    const titleLeft = document.createElement('div');
    titleLeft.className = 'space-y-1.5 min-w-0';

    const actualStock = Number(item.stockActual) || 0;
    const minStock = Number(item.stockMinimo) || 0;

    titleLeft.innerHTML = `
      <div class="flex flex-wrap items-center gap-2.5">
        <span class="px-2.5 py-0.5 rounded-md font-mono text-xs font-bold bg-brand-soft text-brand border border-brand/30">
          ${escapeHtml(item.sku)}
        </span>
        <h1 class="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white truncate">
          ${escapeHtml(item.nombre)}
        </h1>
        <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${
          item.activo
            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700'
        }">
          <span class="w-1.5 h-1.5 rounded-full ${item.activo ? 'bg-emerald-500' : 'bg-slate-400'}"></span>
          <span>${item.activo ? 'Activo' : 'Inactivo'}</span>
        </span>
      </div>
      <div class="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-500 dark:text-slate-400">
        <span><strong class="text-slate-700 dark:text-slate-300">Categoría:</strong> ${escapeHtml(
          item.categoriaNombre || 'General'
        )}</span>
        ${
          item.marcaNombre
            ? `<span><strong class="text-slate-700 dark:text-slate-300">Marca:</strong> ${escapeHtml(
                item.marcaNombre
              )}</span>`
            : ''
        }
        ${
          item.proveedorNombre
            ? `<span><strong class="text-slate-700 dark:text-slate-300">Proveedor:</strong> ${escapeHtml(
                item.proveedorNombre
              )}</span>`
            : ''
        }
      </div>
      <div class="flex flex-wrap items-center gap-y-1 gap-x-4 text-[11px] text-slate-400 dark:text-slate-500 pt-0.5">
        <span class="flex items-center gap-1">
          <i class="fa-regular fa-calendar-plus text-brand"></i>
          <span>Creado: <strong>${formatDateTimeFull(item.createdAt)}</strong></span>
        </span>
        <span class="flex items-center gap-1">
          <i class="fa-regular fa-clock text-slate-400"></i>
          <span>Modificado: <strong>${formatDateTimeFull(item.updatedAt)}</strong></span>
        </span>
      </div>
    `;

    const titleActions = document.createElement('div');
    titleActions.className = 'flex items-center gap-2.5 shrink-0';

    const btnBack = createButton({
      text: 'Volver',
      icon: 'fa-solid fa-arrow-left',
      variant: 'cancel',
      size: 'md',
      onClick: () => {
        state.view = 'list';
        state.viewingProduct = null;
        render();
      },
    });

    const btnEdit = createButton({
      text: 'Editar',
      icon: 'fa-regular fa-pen-to-square',
      variant: 'primary',
      size: 'md',
      onClick: () => {
        editProduct(item);
      },
    });

    const btnDelete = createButton({
      text: 'Eliminar',
      icon: 'fa-regular fa-trash-can',
      variant: 'danger',
      size: 'md',
      onClick: () => {
        confirmDeleteProduct(item);
      },
    });

    titleActions.append(btnBack, btnEdit, btnDelete);
    titleBar.append(titleLeft, titleActions);
    pageWrap.appendChild(titleBar);

    // 3. Contenido en dos columnas (2/3 datos principales y 1/3 multimedia/opciones)
    const contentGrid = document.createElement('div');
    contentGrid.className = 'grid grid-cols-1 lg:grid-cols-3 gap-6';

    // Columna Izquierda (Principal)
    const leftCol = document.createElement('div');
    leftCol.className = 'lg:col-span-2 space-y-6';

    // Card: Precios e Impuestos
    const cost = Number(item.costoCompra) || 0;
    const price = Number(item.precioVenta) || 0;
    let marginPercent = 0;
    const marginAmount = price - cost;
    if (cost > 0) {
      marginPercent = Math.round((marginAmount / cost) * 100);
    }

    const priceCard = document.createElement('div');
    priceCard.className =
      'p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4';
    priceCard.innerHTML = `
      <div class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
        <h2 class="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <i class="fa-solid fa-tag text-brand"></i>
          <span>Precios e Impuestos (Moneda Guaraníes · PYG)</span>
        </h2>
        <span class="px-2.5 py-1 rounded-full text-xs font-bold ${
          marginAmount >= 0
            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'
            : 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400'
        }">
          Margen: ${marginPercent >= 0 ? `+${marginPercent}%` : `${marginPercent}%`} (${
      marginAmount >= 0 ? `+${formatGuaranies(marginAmount)}` : formatGuaranies(marginAmount)
    })
        </span>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
          <p class="text-[11px] font-medium text-slate-400">Precio de Venta al Público</p>
          <p class="text-lg font-black text-slate-900 dark:text-white mt-1">${formatGuaranies(
            item.precioVenta
          )}</p>
        </div>
        <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
          <p class="text-[11px] font-medium text-slate-400">Costo de Compra (Proveedor)</p>
          <p class="text-lg font-bold text-slate-700 dark:text-slate-300 mt-1">${formatGuaranies(
            item.costoCompra
          )}</p>
        </div>
        <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
          <p class="text-[11px] font-medium text-slate-400">Impuesto IVA</p>
          <p class="text-lg font-bold text-slate-800 dark:text-slate-200 mt-1">${escapeHtml(
            item.iva || '10%'
          )}</p>
        </div>
      </div>
    `;
    leftCol.appendChild(priceCard);

    // Card: Inventario y Control de Existencias
    const stockCard = document.createElement('div');
    stockCard.className =
      'p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4';
    stockCard.innerHTML = `
      <div class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
        <h2 class="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <i class="fa-solid fa-boxes-stacked text-brand"></i>
          <span>Inventario y Control de Existencias</span>
        </h2>
        <span class="text-xs font-semibold ${item.controlarStock ? 'text-brand' : 'text-slate-400'}">
          ${item.controlarStock ? '✓ Control de stock activo' : 'Stock no controlado (ilimitado)'}
        </span>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
          <p class="text-[11px] font-medium text-slate-400">Stock Actual</p>
          <p class="text-lg font-black ${
            item.controlarStock && actualStock <= minStock ? 'text-amber-600' : 'text-emerald-600'
          } mt-1">
            ${item.controlarStock ? `${actualStock} ${item.unidadMedidaAbrev || 'un.'}` : 'Sin límite'}
          </p>
        </div>
        <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
          <p class="text-[11px] font-medium text-slate-400">Stock Mínimo (Alerta reposición)</p>
          <p class="text-lg font-bold text-slate-700 dark:text-slate-300 mt-1">
            ${item.controlarStock ? `${minStock} ${item.unidadMedidaAbrev || 'un.'}` : 'No aplica'}
          </p>
        </div>
        <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
          <p class="text-[11px] font-medium text-slate-400">Código de Barras (EAN / UPC)</p>
          <p class="text-base font-mono font-bold text-slate-800 dark:text-slate-200 mt-1">${escapeHtml(
            item.codigoBarras || '—'
          )}</p>
        </div>
      </div>
    `;
    leftCol.appendChild(stockCard);

    // Card: Descripción
    const descCard = document.createElement('div');
    descCard.className =
      'p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3';
    descCard.innerHTML = `
      <h2 class="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
        <i class="fa-regular fa-file-lines text-brand"></i>
        <span>Descripción del Producto</span>
      </h2>
      <p class="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
        ${escapeHtml(item.descripcion || 'Sin descripción detallada registrada para este artículo.')}
      </p>
    `;
    leftCol.appendChild(descCard);

    // Columna Derecha (Imágenes y opciones de tienda)
    const rightCol = document.createElement('div');
    rightCol.className = 'space-y-6';

    // Card: Foto Principal
    const photoCard = document.createElement('div');
    photoCard.className =
      'p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3';
    photoCard.innerHTML = `
      <div class="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
        <h3 class="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
          <i class="fa-regular fa-image text-brand"></i>
          <span>Foto Principal</span>
        </h3>
        <span class="text-[11px] text-slate-400">WebP 1200px</span>
      </div>
      <div class="relative w-full h-64 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-center overflow-hidden cursor-pointer group">
        ${
          item.fotoPrincipal
            ? `<img src="${item.fotoPrincipal}" alt="${escapeHtml(
                item.nombre
              )}" class="w-full h-full object-contain group-hover:scale-105 transition duration-300">
               <div class="absolute inset-0 bg-slate-950/20 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-bold gap-2">
                 <i class="fa-solid fa-magnifying-glass-plus text-lg"></i>
                 <span>Clic para ampliar</span>
               </div>`
            : `<div class="text-center text-slate-400">
                 <i class="fa-solid fa-cube text-4xl mb-2"></i>
                 <p class="text-xs">Sin imagen principal</p>
               </div>`
        }
      </div>
      <div class="text-center">
        <p class="text-[11px] text-slate-400 font-medium">
          Formato: WEBP · Archivo: ${escapeHtml(item.sku)}.webp
        </p>
      </div>
    `;

    if (item.fotoPrincipal) {
      photoCard.querySelector('.cursor-pointer')?.addEventListener('click', () => {
        openImageZoomModal({
          src: item.fotoPrincipal,
          nombre: `${item.sku}.webp`,
          formato: 'WEBP',
        });
      });
    }
    rightCol.appendChild(photoCard);

    // Card: Galería Adicional (si tiene fotos)
    if (Array.isArray(item.galeriaFotos) && item.galeriaFotos.length > 0) {
      const galCard = document.createElement('div');
      galCard.className =
        'p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3';
      galCard.innerHTML = `
        <h3 class="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center justify-between gap-1.5 pb-2 border-b border-slate-100 dark:border-slate-800">
          <span class="flex items-center gap-1.5">
            <i class="fa-solid fa-images text-brand"></i>
            <span>Galería de Fotos (${item.galeriaFotos.length})</span>
          </span>
          <span class="text-[10px] text-slate-400 font-normal">Clic para ampliar</span>
        </h3>
        <div class="flex flex-wrap gap-2.5" id="detail-gallery-grid"></div>
      `;
      const galGrid = galCard.querySelector('#detail-gallery-grid');
      item.galeriaFotos.forEach((gf, idx) => {
        const thumb = document.createElement('div');
        thumb.className =
          'w-16 h-16 sm:w-20 sm:h-20 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 p-1.5 flex items-center justify-center overflow-hidden cursor-pointer hover:ring-2 hover:ring-brand hover:shadow-xs transition group shrink-0';
        thumb.innerHTML = `<img src="${gf.data || gf}" alt="Foto ${
          idx + 1
        }" class="w-full h-full object-contain group-hover:scale-105 transition">`;
        thumb.addEventListener('click', () => {
          openImageZoomModal({
            src: gf.data || gf,
            nombre: `${item.sku}_foto_${idx + 1}.webp`,
            formato: 'WEBP',
          });
        });
        galGrid.appendChild(thumb);
      });
      rightCol.appendChild(galCard);
    }

    // Card: Opciones Web y Tienda
    const webCard = document.createElement('div');
    webCard.className =
      'p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3';
    webCard.innerHTML = `
      <h3 class="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5 pb-2 border-b border-slate-100 dark:border-slate-800">
        <i class="fa-solid fa-globe text-brand"></i>
        <span>Opciones Web y Tienda</span>
      </h3>
      <div class="space-y-2.5 text-xs">
        <div class="flex items-center justify-between">
          <span class="text-slate-600 dark:text-slate-400">Mostrar en web:</span>
          <span class="font-bold ${item.mostrarEnWeb ? 'text-emerald-600' : 'text-slate-400'}">${
      item.mostrarEnWeb ? 'Sí' : 'No'
    }</span>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-slate-600 dark:text-slate-400">Mostrar precio:</span>
          <span class="font-bold ${item.mostrarPrecio ? 'text-emerald-600' : 'text-slate-400'}">${
      item.mostrarPrecio ? 'Sí' : 'No'
    }</span>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-slate-600 dark:text-slate-400">Permitir sin stock:</span>
          <span class="font-bold ${item.permitirSinStock ? 'text-emerald-600' : 'text-slate-400'}">${
      item.permitirSinStock ? 'Sí' : 'No'
    }</span>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-slate-600 dark:text-slate-400">En promoción:</span>
          <span class="font-bold ${item.enPromocion ? 'text-brand' : 'text-slate-400'}">${
      item.enPromocion ? 'Sí' : 'No'
    }</span>
        </div>
      </div>
    `;
    rightCol.appendChild(webCard);

    contentGrid.append(leftCol, rightCol);
    pageWrap.appendChild(contentGrid);
    parent.appendChild(pageWrap);
  }

  // 1. Renderizado inicial inmediato para pintar de inmediato el módulo en el workspace sin pantalla blanca
  render();

  // 2. Cargar catálogos y productos en segundo plano de manera segura
  loadCatalogs()
    .catch((err) => console.warn('[Productos] Error cargando catálogos:', err))
    .finally(() => {
      fetchProducts().catch((err) => console.warn('[Productos] Error cargando productos:', err));
    });
}

