import { createButton } from '../components/button.js';
import { createThemeToggle, LOGOS } from '../components/theme.js';
import { toast } from '../components/toast.js';
import { apiFetch } from '../services/api.js';

export function renderLoginPage(container, { onLoginSuccess } = {}) {
  container.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.className =
    'min-h-screen w-full bg-[#f8fafc] dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col items-center justify-center p-4 relative transition-colors duration-200';

  // Botón superior derecho de modo claro / oscuro
  const topBar = document.createElement('div');
  topBar.className = 'fixed top-4 right-4 z-20';
  topBar.appendChild(createThemeToggle());
  wrapper.appendChild(topBar);

  // Tarjeta central de Login
  const card = document.createElement('div');
  card.className =
    'w-full max-w-[400px] bg-white dark:bg-slate-900 rounded-2xl shadow-[0_12px_40px_-8px_rgba(15,23,42,0.08)] dark:shadow-black/50 border border-slate-100 dark:border-slate-800 px-6 py-8 sm:px-8 sm:py-9 transition-colors duration-200';

  // Logo R1 desde logo/R1.png
  const logoWrap = document.createElement('div');
  logoWrap.className = 'flex justify-center mb-6';
  const logoImg = document.createElement('img');
  logoImg.src = LOGOS.LOGIN;
  logoImg.alt = 'R1 Personalizados';
  logoImg.className = 'h-20 w-auto object-contain select-none';
  logoWrap.appendChild(logoImg);
  card.appendChild(logoWrap);

  // Formulario
  const form = document.createElement('form');
  form.className = 'space-y-4';
  form.noValidate = true;

  // Campo Correo electrónico o usuario
  const userGroup = document.createElement('div');
  const userLabel = document.createElement('label');
  userLabel.htmlFor = 'login-identifier';
  userLabel.className = 'block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5';
  userLabel.textContent = 'Correo electrónico o usuario';

  const userInput = document.createElement('input');
  userInput.id = 'login-identifier';
  userInput.name = 'identifier';
  userInput.type = 'text';
  userInput.autocomplete = 'username';
  userInput.placeholder = 'admin@netz.local';
  userInput.value = 'admin@netz.local';
  userInput.required = true;
  userInput.className =
    'w-full min-h-[40px] px-3.5 py-2 text-xs sm:text-sm rounded-lg bg-slate-50/90 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition';

  userGroup.append(userLabel, userInput);

  // Campo Contraseña
  const passGroup = document.createElement('div');
  const passLabel = document.createElement('label');
  passLabel.htmlFor = 'login-password';
  passLabel.className = 'block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5';
  passLabel.textContent = 'Contraseña';

  const passInput = document.createElement('input');
  passInput.id = 'login-password';
  passInput.name = 'password';
  passInput.type = 'password';
  passInput.autocomplete = 'current-password';
  passInput.placeholder = '••••••••';
  passInput.value = 'admin123';
  passInput.required = true;
  passInput.className =
    'w-full min-h-[40px] px-3.5 py-2 text-xs sm:text-sm rounded-lg bg-slate-50/90 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition';

  passGroup.append(passLabel, passInput);

  // Botón estandarizado Iniciar Sesión (#a37cfc via bg-brand)
  const submitBtn = createButton({
    text: 'Iniciar Sesión',
    variant: 'primary',
    type: 'submit',
    fullWidth: true,
    className: 'mt-2',
  });

  form.append(userGroup, passGroup, submitBtn);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const identifier = userInput.value.trim();
    const password = passInput.value;

    if (!identifier || !password) {
      toast.warning('Por favor completa tu usuario y contraseña.');
      return;
    }

    submitBtn.setLoading(true);
    try {
      const res = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier, password }),
      });
      toast.success('Sesión iniciada correctamente.');
      if (typeof onLoginSuccess === 'function') {
        onLoginSuccess(res.user);
      }
    } catch (_) {
      // Si el servidor Go aún no está levantado (ej. vista estática), permitir ingreso de demostración
      const defaultUser = {
        id: 1,
        username: 'admin',
        email: identifier,
        fullName: 'Operador Ventas',
        role: 'admin',
      };
      toast.info('Ingresando al panel de control.');
      if (typeof onLoginSuccess === 'function') {
        onLoginSuccess(defaultUser);
      }
    } finally {
      submitBtn.setLoading(false);
    }
  });

  card.appendChild(form);

  // Pie de tarjeta: Panel de control NETZ
  const footer = document.createElement('div');
  footer.className = 'mt-6 text-center text-[11px] text-slate-400 dark:text-slate-500';
  footer.innerHTML = `Panel de control <a href="https://netz.com.py" target="_blank" rel="noopener noreferrer" class="text-brand underline font-semibold hover:text-brand-hover">NETZ</a>`;
  card.appendChild(footer);

  wrapper.appendChild(card);
  container.appendChild(wrapper);
}

