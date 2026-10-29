import { createButton } from './button.js';

/**
 * Componente estandarizado DataTable (AGENTS.md Sección 6)
 * - Hasta 20 registros: lista simple sin controles de paginación.
 * - Más de 20 registros: paginación de 20 filas por página con elipsis y "Mostrando X–Y de Z".
 */
export function createDataTable({
  columns = [],
  data = [],
  total = null,
  page = 1,
  pageSize = 20,
  loading = false,
  error = '',
  emptyMessage = 'No se encontraron registros.',
  searchable = true,
  searchPlaceholder = 'Buscar...',
  onPageChange = null,
  onSearch = null,
  onRetry = null,
} = {}) {
  const container = document.createElement('div');
  container.className =
    'w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden';

  let currentSearch = '';
  let currentPage = page;
  let sortKey = null;
  let sortAsc = true;

  function buildPageNumbers(curr, totalPages) {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages = [1];
    if (curr > 3) pages.push('...');
    const start = Math.max(2, curr - 1);
    const end = Math.min(totalPages - 1, curr + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (curr < totalPages - 2) pages.push('...');
    pages.push(totalPages);
    return pages;
  }

  function render() {
    container.innerHTML = '';

    if (searchable) {
      const toolbar = document.createElement('div');
      toolbar.className =
        'p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3';

      const searchWrap = document.createElement('div');
      searchWrap.className = 'relative w-full sm:max-w-xs';
      searchWrap.innerHTML = `
        <i class="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
      `;
      const input = document.createElement('input');
      input.type = 'search';
      input.value = currentSearch;
      input.placeholder = searchPlaceholder;
      input.className =
        'w-full min-h-[40px] pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand';
      input.addEventListener('input', (e) => {
        currentSearch = e.target.value;
        currentPage = 1;
        if (typeof onSearch === 'function') {
          onSearch(currentSearch);
        } else {
          render();
        }
      });
      searchWrap.appendChild(input);
      toolbar.appendChild(searchWrap);
      container.appendChild(toolbar);
    }

    // Estado de error
    if (error) {
      const errBox = document.createElement('div');
      errBox.className = 'p-8 text-center flex flex-col items-center gap-3';
      errBox.innerHTML = `
        <div class="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/60 text-danger flex items-center justify-center">
          <i class="fa-solid fa-circle-exclamation"></i>
        </div>
        <p class="text-sm font-medium text-slate-700 dark:text-slate-300">${error}</p>
      `;
      if (typeof onRetry === 'function') {
        errBox.appendChild(
          createButton({
            text: 'Reintentar',
            icon: 'fa-solid fa-rotate-right',
            variant: 'primary',
            size: 'sm',
            onClick: () => onRetry(),
          })
        );
      }
      container.appendChild(errBox);
      return;
    }

    // Estado cargando (skeleton)
    if (loading) {
      const skel = document.createElement('div');
      skel.className = 'p-4 space-y-3 animate-pulse';
      for (let i = 0; i < 5; i++) {
        const row = document.createElement('div');
        row.className = 'h-10 bg-slate-100 dark:bg-slate-800 rounded-lg';
        skel.appendChild(row);
      }
      container.appendChild(skel);
      return;
    }

    // Filtrado y orden local si no es paginación del servidor
    let filtered = Array.isArray(data) ? [...data] : [];
    if (currentSearch && !onSearch) {
      const q = currentSearch.toLowerCase();
      filtered = filtered.filter((row) =>
        columns.some((col) => String(row[col.key] ?? '').toLowerCase().includes(q))
      );
    }
    if (sortKey) {
      filtered.sort((a, b) => {
        const va = a[sortKey] ?? '';
        const vb = b[sortKey] ?? '';
        return sortAsc
          ? String(va).localeCompare(String(vb), 'es', { numeric: true })
          : String(vb).localeCompare(String(va), 'es', { numeric: true });
      });
    }

    const totalItems = total !== null ? total : filtered.length;
    if (totalItems === 0) {
      const emptyBox = document.createElement('div');
      emptyBox.className = 'p-10 text-center text-sm text-slate-400 dark:text-slate-500';
      emptyBox.innerHTML = `<i class="fa-regular fa-folder-open text-xl mb-2 block"></i>${emptyMessage}`;
      container.appendChild(emptyBox);
      return;
    }

    const effectivePageSize = 20;
    const usePagination = totalItems > effectivePageSize;
    const totalPages = Math.max(1, Math.ceil(totalItems / effectivePageSize));
    if (currentPage > totalPages) currentPage = totalPages;

    const startIdx = usePagination ? (currentPage - 1) * effectivePageSize : 0;
    const visibleRows =
      total !== null
        ? filtered
        : usePagination
          ? filtered.slice(startIdx, startIdx + effectivePageSize)
          : filtered;

    const tableWrap = document.createElement('div');
    tableWrap.className = 'w-full overflow-x-auto';

    const table = document.createElement('table');
    table.className = 'w-full text-left border-collapse';

    const thead = document.createElement('thead');
    thead.className =
      'bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs uppercase text-slate-500 dark:text-slate-400 font-semibold';
    const trHead = document.createElement('tr');

    columns.forEach((col) => {
      const th = document.createElement('th');
      th.className = `px-4 py-3 select-none ${col.align === 'right' ? 'text-right' : 'text-left'}`;
      th.textContent = col.label;
      if (col.sortable) {
        th.classList.add('cursor-pointer', 'hover:text-slate-800', 'dark:hover:text-slate-200');
        th.addEventListener('click', () => {
          if (sortKey === col.key) {
            sortAsc = !sortAsc;
          } else {
            sortKey = col.key;
            sortAsc = true;
          }
          render();
        });
      }
      trHead.appendChild(th);
    });

    thead.appendChild(trHead);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    tbody.className = 'divide-y divide-slate-200 dark:divide-slate-800 text-sm text-slate-700 dark:text-slate-200';

    visibleRows.forEach((row) => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors';
      columns.forEach((col) => {
        const td = document.createElement('td');
        td.className = `px-4 py-3 ${col.align === 'right' ? 'text-right' : 'text-left'}`;
        if (typeof col.render === 'function') {
          const out = col.render(row);
          if (out instanceof HTMLElement) td.appendChild(out);
          else td.innerHTML = out ?? '';
        } else {
          td.textContent = row[col.key] ?? '';
        }
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    tableWrap.appendChild(table);
    container.appendChild(tableWrap);

    // Paginación únicamente cuando hay más de 20 registros
    if (usePagination) {
      const from = startIdx + 1;
      const to = Math.min(startIdx + effectivePageSize, totalItems);

      const pager = document.createElement('div');
      pager.className =
        'px-4 py-3 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400';

      const info = document.createElement('span');
      info.textContent = `Mostrando ${from}–${to} de ${totalItems}`;

      const controls = document.createElement('div');
      controls.className = 'flex items-center gap-1.5 flex-wrap';

      controls.appendChild(
        createButton({
          text: 'Anterior',
          variant: 'cancel',
          size: 'sm',
          disabled: currentPage <= 1,
          onClick: () => {
            currentPage -= 1;
            if (typeof onPageChange === 'function') onPageChange(currentPage, pageSize);
            else render();
          },
        })
      );

      buildPageNumbers(currentPage, totalPages).forEach((p) => {
        if (p === '...') {
          const dots = document.createElement('span');
          dots.className = 'px-2 text-slate-400';
          dots.textContent = '…';
          controls.appendChild(dots);
        } else {
          controls.appendChild(
            createButton({
              text: String(p),
              variant: p === currentPage ? 'primary' : 'cancel',
              size: 'sm',
              onClick: () => {
                currentPage = p;
                if (typeof onPageChange === 'function') onPageChange(currentPage, pageSize);
                else render();
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
          disabled: currentPage >= totalPages,
          onClick: () => {
            currentPage += 1;
            if (typeof onPageChange === 'function') onPageChange(currentPage, pageSize);
            else render();
          },
        })
      );

      pager.append(info, controls);
      container.appendChild(pager);
    }
  }

  render();
  return container;
}

