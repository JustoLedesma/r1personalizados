import { createButton } from '../components/button.js';
import { createModal, createConfirmModal } from '../components/modal.js';
import { createDataTable } from '../components/table.js';
import { toast } from '../components/toast.js';
import { apiFetch } from '../services/api.js';

const SYSTEM_MODULES = [
  { id: 'dashboard', name: 'Panel General', icon: 'fa-chart-pie' },
  { id: 'pedidos', name: 'Pedidos', icon: 'fa-box' },
  { id: 'presupuestos', name: 'Presupuestos', icon: 'fa-file-invoice' },
  { id: 'clientes', name: 'Clientes', icon: 'fa-users' },
  { id: 'proveedores', name: 'Proveedor', icon: 'fa-truck' },
  { id: 'pagos', name: 'Pagos', icon: 'fa-money-bill-wave' },
  { id: 'productos', name: 'Productos', icon: 'fa-tag' },
  { id: 'perfiles-mensajes', name: 'Perfiles de Mensajes', icon: 'fa-comment-dots' },
  { id: 'sesiones-whatsapp', name: 'Sesiones WhatsApp', icon: 'fa-brands fa-whatsapp' },
  { id: 'difusion-mensajes', name: 'Difusión y Mensajes', icon: 'fa-paper-plane' },
  { id: 'reciclaje', name: 'Reciclaje', icon: 'fa-recycle' },
  { id: 'configuracion', name: 'Configuración', icon: 'fa-gear' },
];

export function renderUsuariosRolesPage(container) {
  container.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'w-full space-y-6 pb-12';

  // Cabecera del módulo (toma todo el ancho)
  const headerCard = document.createElement('div');
  headerCard.className =
    'w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-sm';

  const titleWrap = document.createElement('div');
  titleWrap.innerHTML = `
    <div class="flex items-center gap-3">
      <div class="w-10 h-10 rounded-lg bg-brand-soft text-brand flex items-center justify-center text-lg">
        <i class="fa-solid fa-users-gear"></i>
      </div>
      <div>
        <h1 class="text-xl font-bold text-slate-800 dark:text-slate-100">Usuarios y Roles</h1>
        <p class="text-xs text-slate-500 dark:text-slate-400">Gestión centralizada de operadores, privilegios de acceso y modo Solo Vista por módulo.</p>
      </div>
    </div>
  `;

  const newBtn = createButton({
    text: 'Nuevo Usuario',
    icon: '<i class="fa-solid fa-user-plus mr-2"></i>',
    variant: 'primary',
    onClick: () => openUserModal({ onSave: loadUsers }),
  });

  headerCard.append(titleWrap, newBtn);
  wrapper.appendChild(headerCard);

  // Contenedor de la Tabla
  const tableContainer = document.createElement('div');
  tableContainer.className = 'w-full';
  wrapper.appendChild(tableContainer);

  container.appendChild(wrapper);

  async function loadUsers() {
    tableContainer.innerHTML = `
      <div class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center text-slate-400">
        <i class="fa-solid fa-circle-notch fa-spin text-2xl mb-2 text-brand"></i>
        <p class="text-xs">Cargando usuarios del sistema...</p>
      </div>
    `;

    try {
      const res = await apiFetch('/api/users');
      const users = res.data || [];
      renderTable(users);
    } catch (err) {
      tableContainer.innerHTML = `
        <div class="w-full bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/50 rounded-xl p-8 text-center text-red-600 dark:text-red-400">
          <i class="fa-solid fa-triangle-exclamation text-2xl mb-2"></i>
          <p class="text-sm font-semibold">Error al cargar usuarios</p>
          <p class="text-xs text-slate-500 mt-1">${err.message}</p>
          <div class="mt-4">
            <button id="retry-users-btn" class="px-4 py-2 bg-brand text-white rounded-lg text-xs font-semibold hover:bg-brand-hover">Reintentar</button>
          </div>
        </div>
      `;
      const retryBtn = tableContainer.querySelector('#retry-users-btn');
      if (retryBtn) retryBtn.addEventListener('click', loadUsers);
    }
  }

  function renderTable(users) {
    tableContainer.innerHTML = '';

    const columns = [
      {
        key: 'id',
        title: 'ID',
        sortable: true,
        render: (u) => `<span class="text-xs font-bold text-slate-500">#${u.id}</span>`,
      },
      {
        key: 'fullName',
        title: 'Nombre y Apellido',
        sortable: true,
        render: (u) => `
          <div>
            <div class="text-xs font-semibold text-slate-800 dark:text-slate-100">${escapeHTML(u.fullName)}</div>
            <div class="text-[11px] text-slate-400">${escapeHTML(u.email)}</div>
          </div>
        `,
      },
      {
        key: 'username',
        title: 'Usuario',
        sortable: true,
        render: (u) => `<span class="inline-block px-2 py-0.5 rounded text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono">${escapeHTML(u.username)}</span>`,
      },
      {
        key: 'role',
        title: 'Tipo / Rol',
        sortable: true,
        render: (u) => {
          const isAdmin = u.role === 'admin';
          return `
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
              isAdmin
                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
            }">
              <i class="fa-solid ${isAdmin ? 'fa-shield-halved' : 'fa-user'} text-[10px]"></i>
              ${isAdmin ? 'Administrador' : 'Usuario Común'}
            </span>
          `;
        },
      },
      {
        key: 'permissions',
        title: 'Permisos por Módulo',
        render: (u) => {
          if (u.role === 'admin') {
            return `<span class="text-xs text-brand font-semibold"><i class="fa-solid fa-check-double mr-1"></i>Acceso Total (Todos)</span>`;
          }
          const perms = u.permissions || {};
          const keys = Object.keys(perms);
          if (keys.length === 0) {
            return `<span class="text-xs text-slate-400 italic">Sin módulos asignados</span>`;
          }
          const editorCount = keys.filter((k) => perms[k] === 'editor').length;
          const viewerCount = keys.filter((k) => perms[k] === 'viewer').length;
          return `
            <div class="text-xs space-x-1">
              <span class="inline-block px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-medium">${editorCount} Editor</span>
              <span class="inline-block px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 font-medium">${viewerCount} Solo Vista</span>
            </div>
          `;
        },
      },
      {
        key: 'active',
        title: 'Estado',
        render: (u) => {
          // Switch tipo iOS obligatorio por AGENTS.md
          const isChecked = !!u.active;
          return `
            <label class="relative inline-flex items-center cursor-pointer select-none">
              <input type="checkbox" data-user-id="${u.id}" class="sr-only user-status-toggle" ${isChecked ? 'checked' : ''}>
              <div class="ios-switch w-11 h-6 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer transition-colors duration-300 ease-in-out ${
                isChecked ? '!bg-blue-600' : ''
              }">
                <div class="ios-switch-knob absolute top-[2px] left-[2px] bg-white rounded-full h-5 w-5 transition-transform duration-300 ease-in-out shadow-sm ${
                  isChecked ? 'translate-x-5' : 'translate-x-0'
                }"></div>
              </div>
            </label>
          `;
        },
      },
      {
        key: 'actions',
        title: 'Acciones',
        align: 'right',
        render: (u) => `
          <div class="flex items-center justify-end gap-1.5">
            <button data-action="edit-user" data-user-id="${u.id}" class="p-2 text-slate-500 hover:text-brand hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition" title="Editar usuario y permisos" aria-label="Editar usuario">
              <i class="fa-solid fa-pen-to-square"></i>
            </button>
            <button data-action="delete-user" data-user-id="${u.id}" data-user-name="${escapeHTML(u.fullName)}" class="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition" title="Eliminar usuario" aria-label="Eliminar usuario">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        `,
      },
    ];

    const dt = createDataTable({
      columns,
      data: users,
      pageSize: 20,
      searchPlaceholder: 'Buscar por nombre, usuario o correo...',
      emptyMessage: 'No se encontraron usuarios registrados.',
    });

    tableContainer.appendChild(dt);

    // Eventos de estado iOS
    tableContainer.querySelectorAll('.user-status-toggle').forEach((toggle) => {
      toggle.addEventListener('change', async (e) => {
        const uid = e.target.getAttribute('data-user-id');
        const active = e.target.checked;
        const knob = e.target.nextElementSibling.querySelector('.ios-switch-knob');
        const track = e.target.nextElementSibling;

        if (active) {
          track.classList.add('!bg-blue-600');
          knob.classList.add('translate-x-5');
          knob.classList.remove('translate-x-0');
        } else {
          track.classList.remove('!bg-blue-600');
          knob.classList.remove('translate-x-5');
          knob.classList.add('translate-x-0');
        }

        try {
          await apiFetch(`/api/users/${uid}`, {
            method: 'PUT',
            body: JSON.stringify({ active }),
          });
          toast.success(active ? 'Usuario activado' : 'Usuario desactivado');
        } catch (err) {
          // Revertir switch
          e.target.checked = !active;
          if (!active) {
            track.classList.add('!bg-blue-600');
            knob.classList.add('translate-x-5');
            knob.classList.remove('translate-x-0');
          } else {
            track.classList.remove('!bg-blue-600');
            knob.classList.remove('translate-x-5');
            knob.classList.add('translate-x-0');
          }
          toast.error(err.message || 'Error al cambiar estado');
        }
      });
    });

    // Eventos de editar
    tableContainer.querySelectorAll('[data-action="edit-user"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const uid = parseInt(btn.getAttribute('data-user-id'), 10);
        const user = users.find((u) => u.id === uid);
        if (user) {
          openUserModal({ user, onSave: loadUsers });
        }
      });
    });

    // Eventos de eliminar
    tableContainer.querySelectorAll('[data-action="delete-user"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const uid = btn.getAttribute('data-user-id');
        const uname = btn.getAttribute('data-user-name');
        createConfirmModal({
          title: '¿Mover usuario a Reciclaje?',
          message: `El usuario "${uname}" será desactivado y enviado a la Papelera de Reciclaje. Podrá ser restaurado posteriormente si es necesario.`,
          confirmText: 'Sí, mover a reciclaje',
          onConfirm: async () => {
            try {
              await apiFetch(`/api/users/${uid}`, { method: 'DELETE' });
              toast.success('Usuario enviado a la papelera de reciclaje');
              loadUsers();
              return true;
            } catch (err) {
              toast.error(err.message || 'Error al eliminar usuario');
              return false;
            }
          },
        });
      });
    });
  }

  loadUsers();
}

/**
 * Modal estandarizado para Creación y Edición de Usuarios y Roles.
 */
function openUserModal({ user = null, onSave } = {}) {
  const isEdit = !!user;

  const content = document.createElement('div');
  content.className = 'space-y-5 text-xs sm:text-sm';

  content.innerHTML = `
    <!-- Datos Básicos -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <label class="block font-semibold text-slate-700 dark:text-slate-200 mb-1">Nombre Completo *</label>
        <input type="text" id="modal-user-fullname" value="${isEdit ? escapeHTML(user.fullName) : ''}" placeholder="ej. María González" required class="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-brand focus:outline-none">
      </div>
      <div>
        <label class="block font-semibold text-slate-700 dark:text-slate-200 mb-1">Nombre de Usuario *</label>
        <input type="text" id="modal-user-username" value="${isEdit ? escapeHTML(user.username) : ''}" ${isEdit ? 'disabled' : ''} placeholder="ej. mgonzalez" required class="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-brand focus:outline-none ${isEdit ? 'opacity-60 cursor-not-allowed' : ''}">
      </div>
      <div>
        <label class="block font-semibold text-slate-700 dark:text-slate-200 mb-1">Correo Electrónico *</label>
        <input type="email" id="modal-user-email" value="${isEdit ? escapeHTML(user.email) : ''}" placeholder="ej. usuario@netz.com.py" required class="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-brand focus:outline-none">
      </div>
      <div>
        <label class="block font-semibold text-slate-700 dark:text-slate-200 mb-1">${isEdit ? 'Nueva Contraseña (dejar en blanco para conservar)' : 'Contraseña *'}</label>
        <input type="password" id="modal-user-password" placeholder="${isEdit ? '••••••••' : 'Mínimo 6 caracteres'}" ${isEdit ? '' : 'required'} class="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-brand focus:outline-none">
      </div>
    </div>

    <!-- Tipo de Usuario (Rol) -->
    <div class="pt-2 border-t border-slate-200 dark:border-slate-800">
      <label class="block font-semibold text-slate-700 dark:text-slate-200 mb-2">Tipo de Usuario</label>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label class="flex items-center gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 cursor-pointer hover:border-brand transition">
          <input type="radio" name="user-role-choice" value="admin" ${isEdit && user.role === 'admin' ? 'checked' : ''} class="text-brand focus:ring-brand">
          <div>
            <div class="font-semibold text-slate-800 dark:text-slate-100"><i class="fa-solid fa-shield-halved text-brand mr-1"></i> Administrador</div>
            <div class="text-[11px] text-slate-500">Acceso total a todos los módulos y gestión de usuarios.</div>
          </div>
        </label>
        <label class="flex items-center gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 cursor-pointer hover:border-brand transition">
          <input type="radio" name="user-role-choice" value="editor" ${!isEdit || user.role !== 'admin' ? 'checked' : ''} class="text-brand focus:ring-brand">
          <div>
            <div class="font-semibold text-slate-800 dark:text-slate-100"><i class="fa-solid fa-user text-blue-500 mr-1"></i> Usuario Común</div>
            <div class="text-[11px] text-slate-500">Acceso personalizado según la matriz de módulos inferior.</div>
          </div>
        </label>
      </div>
    </div>

    <!-- Matriz de Módulos (solo visible si no es admin) -->
    <div id="matrix-container" class="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
      <div class="flex items-center justify-between">
        <div>
          <h4 class="font-bold text-slate-800 dark:text-slate-100">Matriz de Acceso por Módulo</h4>
          <p class="text-[11px] text-slate-500">Seleccione el nivel de permiso independiente para cada módulo del panel.</p>
        </div>
        <div class="flex items-center gap-2 text-xs">
          <button type="button" id="btn-all-editor" class="text-brand hover:underline font-semibold">Todos Editor</button>
          <span class="text-slate-300">|</span>
          <button type="button" id="btn-all-viewer" class="text-brand hover:underline font-semibold">Todos Solo Vista</button>
          <span class="text-slate-300">|</span>
          <button type="button" id="btn-all-none" class="text-slate-500 hover:underline">Sin Acceso</button>
        </div>
      </div>

      <div class="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden max-h-[280px] overflow-y-auto">
        <table class="w-full text-left text-xs">
          <thead class="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
            <tr>
              <th class="p-2.5">Módulo</th>
              <th class="p-2.5 text-center">Sin Acceso</th>
              <th class="p-2.5 text-center">Solo Vista</th>
              <th class="p-2.5 text-center">Editor</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
            ${SYSTEM_MODULES.map((m) => {
              const currentPerm = isEdit && user.permissions ? user.permissions[m.id] : null;
              const isNone = !currentPerm;
              const isViewer = currentPerm === 'viewer';
              const isEditor = currentPerm === 'editor';
              return `
                <tr class="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                  <td class="p-2.5 font-medium text-slate-700 dark:text-slate-200 flex items-center gap-2">
                    <i class="fa-solid ${m.icon} text-slate-400 w-4 text-center"></i>
                    ${m.name}
                  </td>
                  <td class="p-2.5 text-center">
                    <input type="radio" name="perm-${m.id}" value="none" ${isNone ? 'checked' : ''} class="text-slate-400 focus:ring-brand">
                  </td>
                  <td class="p-2.5 text-center">
                    <input type="radio" name="perm-${m.id}" value="viewer" ${isViewer ? 'checked' : ''} class="text-amber-500 focus:ring-brand">
                  </td>
                  <td class="p-2.5 text-center">
                    <input type="radio" name="perm-${m.id}" value="editor" ${isEditor ? 'checked' : ''} class="text-brand focus:ring-brand">
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Toggle visibilidad de la matriz según rol
  const roleRadios = content.querySelectorAll('input[name="user-role-choice"]');
  const matrixContainer = content.querySelector('#matrix-container');

  function updateMatrixVisibility() {
    const selected = content.querySelector('input[name="user-role-choice"]:checked')?.value;
    if (selected === 'admin') {
      matrixContainer.classList.add('hidden');
    } else {
      matrixContainer.classList.remove('hidden');
    }
  }

  roleRadios.forEach((r) => r.addEventListener('change', updateMatrixVisibility));
  updateMatrixVisibility();

  // Acciones rápidas de matriz
  content.querySelector('#btn-all-editor')?.addEventListener('click', () => {
    SYSTEM_MODULES.forEach((m) => {
      const radio = content.querySelector(`input[name="perm-${m.id}"][value="editor"]`);
      if (radio) radio.checked = true;
    });
  });

  content.querySelector('#btn-all-viewer')?.addEventListener('click', () => {
    SYSTEM_MODULES.forEach((m) => {
      const radio = content.querySelector(`input[name="perm-${m.id}"][value="viewer"]`);
      if (radio) radio.checked = true;
    });
  });

  content.querySelector('#btn-all-none')?.addEventListener('click', () => {
    SYSTEM_MODULES.forEach((m) => {
      const radio = content.querySelector(`input[name="perm-${m.id}"][value="none"]`);
      if (radio) radio.checked = true;
    });
  });

  createModal({
    title: isEdit ? 'Editar Usuario y Permisos' : 'Crear Nuevo Usuario',
    size: 'lg',
    content,
    confirmText: 'Guardar Usuario',
    onConfirm: async ({ setLoading }) => {
      const fullName = content.querySelector('#modal-user-fullname').value.trim();
      const username = content.querySelector('#modal-user-username').value.trim();
      const email = content.querySelector('#modal-user-email').value.trim();
      const password = content.querySelector('#modal-user-password').value;
      const roleChoice = content.querySelector('input[name="user-role-choice"]:checked')?.value || 'editor';

      if (!fullName || !username || !email) {
        toast.warning('Por favor completa todos los campos requeridos.');
        return false;
      }
      if (!isEdit && !password) {
        toast.warning('Debes ingresar una contraseña para el nuevo usuario.');
        return false;
      }

      const permissions = {};
      if (roleChoice !== 'admin') {
        SYSTEM_MODULES.forEach((m) => {
          const val = content.querySelector(`input[name="perm-${m.id}"]:checked`)?.value;
          if (val === 'editor' || val === 'viewer') {
            permissions[m.id] = val;
          }
        });
      }

      const payload = {
        fullName,
        username,
        email,
        role: roleChoice,
        permissions,
      };
      if (password) {
        payload.password = password;
      }

      if (typeof setLoading === 'function') setLoading(true);
      try {
        if (isEdit) {
          await apiFetch(`/api/users/${user.id}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
          });
          toast.success('Usuario actualizado correctamente');
        } else {
          await apiFetch('/api/users', {
            method: 'POST',
            body: JSON.stringify(payload),
          });
          toast.success('Usuario creado correctamente');
        }
        if (typeof onSave === 'function') onSave();
        return true;
      } catch (err) {
        toast.error(err.message || 'Error al guardar usuario');
        return false;
      } finally {
        if (typeof setLoading === 'function') setLoading(false);
      }
    },
  });
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

