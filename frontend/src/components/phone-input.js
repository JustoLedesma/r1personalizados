/**
 * Selector de código telefónico internacional con buscador de todos los países
 * Por defecto selecciona Paraguay (PY +595).
 */
export const COUNTRIES = [
  { iso: 'PY', name: 'Paraguay', dial: '+595' },
  { iso: 'AR', name: 'Argentina', dial: '+54' },
  { iso: 'BR', name: 'Brasil', dial: '+55' },
  { iso: 'UY', name: 'Uruguay', dial: '+598' },
  { iso: 'BO', name: 'Bolivia', dial: '+591' },
  { iso: 'CL', name: 'Chile', dial: '+56' },
  { iso: 'AF', name: 'Afganistán', dial: '+93' },
  { iso: 'AL', name: 'Albania', dial: '+355' },
  { iso: 'DE', name: 'Alemania', dial: '+49' },
  { iso: 'AD', name: 'Andorra', dial: '+376' },
  { iso: 'AO', name: 'Angola', dial: '+244' },
  { iso: 'AG', name: 'Antigua y Barbuda', dial: '+1268' },
  { iso: 'SA', name: 'Arabia Saudita', dial: '+966' },
  { iso: 'DZ', name: 'Argelia', dial: '+213' },
  { iso: 'AM', name: 'Armenia', dial: '+374' },
  { iso: 'AU', name: 'Australia', dial: '+61' },
  { iso: 'AT', name: 'Austria', dial: '+43' },
  { iso: 'AZ', name: 'Azerbaiyán', dial: '+994' },
  { iso: 'BS', name: 'Bahamas', dial: '+1242' },
  { iso: 'BD', name: 'Bangladés', dial: '+880' },
  { iso: 'BB', name: 'Barbados', dial: '+1246' },
  { iso: 'BH', name: 'Baréin', dial: '+973' },
  { iso: 'BE', name: 'Bélgica', dial: '+32' },
  { iso: 'BZ', name: 'Belice', dial: '+501' },
  { iso: 'BJ', name: 'Benín', dial: '+229' },
  { iso: 'BY', name: 'Bielorrusia', dial: '+375' },
  { iso: 'MM', name: 'Birmania (Myanmar)', dial: '+95' },
  { iso: 'BA', name: 'Bosnia y Herzegovina', dial: '+387' },
  { iso: 'BW', name: 'Botsuana', dial: '+267' },
  { iso: 'BN', name: 'Brunéi', dial: '+673' },
  { iso: 'BG', name: 'Bulgaria', dial: '+359' },
  { iso: 'BF', name: 'Burkina Faso', dial: '+226' },
  { iso: 'BI', name: 'Burundi', dial: '+257' },
  { iso: 'BT', name: 'Bután', dial: '+975' },
  { iso: 'CV', name: 'Cabo Verde', dial: '+238' },
  { iso: 'KH', name: 'Camboya', dial: '+855' },
  { iso: 'CM', name: 'Camerún', dial: '+237' },
  { iso: 'CA', name: 'Canadá', dial: '+1' },
  { iso: 'QA', name: 'Catar', dial: '+974' },
  { iso: 'TD', name: 'Chad', dial: '+235' },
  { iso: 'CN', name: 'China', dial: '+86' },
  { iso: 'CY', name: 'Chipre', dial: '+357' },
  { iso: 'CO', name: 'Colombia', dial: '+57' },
  { iso: 'KM', name: 'Comoras', dial: '+269' },
  { iso: 'CG', name: 'Congo', dial: '+242' },
  { iso: 'CD', name: 'Congo (R.D.)', dial: '+243' },
  { iso: 'KP', name: 'Corea del Norte', dial: '+850' },
  { iso: 'KR', name: 'Corea del Sur', dial: '+82' },
  { iso: 'CI', name: 'Costa de Marfil', dial: '+225' },
  { iso: 'CR', name: 'Costa Rica', dial: '+506' },
  { iso: 'HR', name: 'Croacia', dial: '+385' },
  { iso: 'CU', name: 'Cuba', dial: '+53' },
  { iso: 'DK', name: 'Dinamarca', dial: '+45' },
  { iso: 'DM', name: 'Dominica', dial: '+1767' },
  { iso: 'EC', name: 'Ecuador', dial: '+593' },
  { iso: 'EG', name: 'Egipto', dial: '+20' },
  { iso: 'SV', name: 'El Salvador', dial: '+503' },
  { iso: 'AE', name: 'Emiratos Árabes Unidos', dial: '+971' },
  { iso: 'ER', name: 'Eritrea', dial: '+291' },
  { iso: 'SK', name: 'Eslovaquia', dial: '+421' },
  { iso: 'SI', name: 'Eslovenia', dial: '+386' },
  { iso: 'ES', name: 'España', dial: '+34' },
  { iso: 'US', name: 'Estados Unidos', dial: '+1' },
  { iso: 'EE', name: 'Estonia', dial: '+372' },
  { iso: 'ET', name: 'Etiopía', dial: '+251' },
  { iso: 'PH', name: 'Filipinas', dial: '+63' },
  { iso: 'FI', name: 'Finlandia', dial: '+358' },
  { iso: 'FJ', name: 'Fiyi', dial: '+679' },
  { iso: 'FR', name: 'Francia', dial: '+33' },
  { iso: 'GA', name: 'Gabón', dial: '+241' },
  { iso: 'GM', name: 'Gambia', dial: '+220' },
  { iso: 'GE', name: 'Georgia', dial: '+995' },
  { iso: 'GH', name: 'Ghana', dial: '+233' },
  { iso: 'GD', name: 'Granada', dial: '+1473' },
  { iso: 'GR', name: 'Grecia', dial: '+30' },
  { iso: 'GT', name: 'Guatemala', dial: '+502' },
  { iso: 'GN', name: 'Guinea', dial: '+224' },
  { iso: 'GQ', name: 'Guinea Ecuatorial', dial: '+240' },
  { iso: 'GW', name: 'Guinea-Bisáu', dial: '+245' },
  { iso: 'GY', name: 'Guyana', dial: '+592' },
  { iso: 'HT', name: 'Haití', dial: '+509' },
  { iso: 'HN', name: 'Honduras', dial: '+504' },
  { iso: 'HU', name: 'Hungría', dial: '+36' },
  { iso: 'IN', name: 'India', dial: '+91' },
  { iso: 'ID', name: 'Indonesia', dial: '+62' },
  { iso: 'IQ', name: 'Irak', dial: '+964' },
  { iso: 'IR', name: 'Irán', dial: '+98' },
  { iso: 'IE', name: 'Irlanda', dial: '+353' },
  { iso: 'IS', name: 'Islandia', dial: '+354' },
  { iso: 'IL', name: 'Israel', dial: '+972' },
  { iso: 'IT', name: 'Italia', dial: '+39' },
  { iso: 'JM', name: 'Jamaica', dial: '+1876' },
  { iso: 'JP', name: 'Japón', dial: '+81' },
  { iso: 'JO', name: 'Jordania', dial: '+962' },
  { iso: 'KZ', name: 'Kazajistán', dial: '+7' },
  { iso: 'KE', name: 'Kenia', dial: '+254' },
  { iso: 'KG', name: 'Kirguistán', dial: '+996' },
  { iso: 'KI', name: 'Kiribati', dial: '+686' },
  { iso: 'KW', name: 'Kuwait', dial: '+965' },
  { iso: 'LA', name: 'Laos', dial: '+856' },
  { iso: 'LS', name: 'Lesoto', dial: '+266' },
  { iso: 'LV', name: 'Letonia', dial: '+371' },
  { iso: 'LB', name: 'Líbano', dial: '+961' },
  { iso: 'LR', name: 'Liberia', dial: '+231' },
  { iso: 'LY', name: 'Libia', dial: '+218' },
  { iso: 'LI', name: 'Liechtenstein', dial: '+423' },
  { iso: 'LT', name: 'Lituania', dial: '+370' },
  { iso: 'LU', name: 'Luxemburgo', dial: '+352' },
  { iso: 'MK', name: 'Macedonia del Norte', dial: '+389' },
  { iso: 'MG', name: 'Madagascar', dial: '+261' },
  { iso: 'MY', name: 'Malasia', dial: '+60' },
  { iso: 'MW', name: 'Malaui', dial: '+265' },
  { iso: 'MV', name: 'Maldivas', dial: '+960' },
  { iso: 'ML', name: 'Malí', dial: '+223' },
  { iso: 'MT', name: 'Malta', dial: '+356' },
  { iso: 'MA', name: 'Marruecos', dial: '+212' },
  { iso: 'MU', name: 'Mauricio', dial: '+230' },
  { iso: 'MR', name: 'Mauritania', dial: '+222' },
  { iso: 'MX', name: 'México', dial: '+52' },
  { iso: 'FM', name: 'Micronesia', dial: '+691' },
  { iso: 'MD', name: 'Moldavia', dial: '+373' },
  { iso: 'MC', name: 'Mónaco', dial: '+377' },
  { iso: 'MN', name: 'Mongolia', dial: '+976' },
  { iso: 'ME', name: 'Montenegro', dial: '+382' },
  { iso: 'MZ', name: 'Mozambique', dial: '+258' },
  { iso: 'NA', name: 'Namibia', dial: '+264' },
  { iso: 'NR', name: 'Nauru', dial: '+674' },
  { iso: 'NP', name: 'Nepal', dial: '+977' },
  { iso: 'NI', name: 'Nicaragua', dial: '+505' },
  { iso: 'NE', name: 'Níger', dial: '+227' },
  { iso: 'NG', name: 'Nigeria', dial: '+234' },
  { iso: 'NO', name: 'Noruega', dial: '+47' },
  { iso: 'NZ', name: 'Nueva Zelanda', dial: '+64' },
  { iso: 'OM', name: 'Omán', dial: '+968' },
  { iso: 'NL', name: 'Países Bajos', dial: '+31' },
  { iso: 'PK', name: 'Pakistán', dial: '+92' },
  { iso: 'PW', name: 'Palaos', dial: '+680' },
  { iso: 'PA', name: 'Panamá', dial: '+507' },
  { iso: 'PG', name: 'Papúa Nueva Guinea', dial: '+675' },
  { iso: 'PE', name: 'Perú', dial: '+51' },
  { iso: 'PL', name: 'Polonia', dial: '+48' },
  { iso: 'PT', name: 'Portugal', dial: '+351' },
  { iso: 'PR', name: 'Puerto Rico', dial: '+1787' },
  { iso: 'GB', name: 'Reino Unido', dial: '+44' },
  { iso: 'CF', name: 'República Centroafricana', dial: '+236' },
  { iso: 'CZ', name: 'República Checa', dial: '+420' },
  { iso: 'DO', name: 'República Dominicana', dial: '+1809' },
  { iso: 'RW', name: 'Ruanda', dial: '+250' },
  { iso: 'RO', name: 'Rumania', dial: '+40' },
  { iso: 'RU', name: 'Rusia', dial: '+7' },
  { iso: 'WS', name: 'Samoa', dial: '+685' },
  { iso: 'KN', name: 'San Cristóbal y Nieves', dial: '+1869' },
  { iso: 'SM', name: 'San Marino', dial: '+378' },
  { iso: 'VC', name: 'San Vicente y las Granadinas', dial: '+1784' },
  { iso: 'LC', name: 'Santa Lucía', dial: '+1758' },
  { iso: 'ST', name: 'Santo Tomé y Príncipe', dial: '+239' },
  { iso: 'SN', name: 'Senegal', dial: '+221' },
  { iso: 'RS', name: 'Serbia', dial: '+381' },
  { iso: 'SC', name: 'Seychelles', dial: '+248' },
  { iso: 'SL', name: 'Sierra Leona', dial: '+232' },
  { iso: 'SG', name: 'Singapur', dial: '+65' },
  { iso: 'SY', name: 'Siria', dial: '+963' },
  { iso: 'SO', name: 'Somalia', dial: '+252' },
  { iso: 'LK', name: 'Sri Lanka', dial: '+94' },
  { iso: 'ZA', name: 'Sudáfrica', dial: '+27' },
  { iso: 'SD', name: 'Sudán', dial: '+249' },
  { iso: 'SS', name: 'Sudán del Sur', dial: '+211' },
  { iso: 'SE', name: 'Suecia', dial: '+46' },
  { iso: 'CH', name: 'Suiza', dial: '+41' },
  { iso: 'SR', name: 'Surinam', dial: '+597' },
  { iso: 'TH', name: 'Tailandia', dial: '+66' },
  { iso: 'TW', name: 'Taiwán', dial: '+886' },
  { iso: 'TZ', name: 'Tanzania', dial: '+255' },
  { iso: 'TJ', name: 'Tayikistán', dial: '+992' },
  { iso: 'TL', name: 'Timor Oriental', dial: '+670' },
  { iso: 'TG', name: 'Togo', dial: '+228' },
  { iso: 'TO', name: 'Tonga', dial: '+676' },
  { iso: 'TT', name: 'Trinidad y Tobago', dial: '+1868' },
  { iso: 'TN', name: 'Túnez', dial: '+216' },
  { iso: 'TM', name: 'Turkmenistán', dial: '+993' },
  { iso: 'TR', name: 'Turquía', dial: '+90' },
  { iso: 'TV', name: 'Tuvalu', dial: '+688' },
  { iso: 'UA', name: 'Ucrania', dial: '+380' },
  { iso: 'UG', name: 'Uganda', dial: '+256' },
  { iso: 'UZ', name: 'Uzbekistán', dial: '+998' },
  { iso: 'VU', name: 'Vanuatu', dial: '+678' },
  { iso: 'VA', name: 'Vaticano', dial: '+379' },
  { iso: 'VE', name: 'Venezuela', dial: '+58' },
  { iso: 'VN', name: 'Vietnam', dial: '+84' },
  { iso: 'YE', name: 'Yemen', dial: '+967' },
  { iso: 'DJ', name: 'Yibuti', dial: '+253' },
  { iso: 'ZM', name: 'Zambia', dial: '+260' },
  { iso: 'ZW', name: 'Zimbabue', dial: '+263' },
];

export function createPhoneInput({
  defaultDial = '+595',
  defaultNumber = '',
  placeholder = 'Ej. 986 901 117 (sin 0)',
  showHelper = true,
  required = false,
  idPrefix = 'phone',
} = {}) {
  let selectedCountry =
    COUNTRIES.find((c) => c.dial === defaultDial) || COUNTRIES[0];

  const root = document.createElement('div');
  root.className = 'relative w-full';

  // Contenedor unido (botón de país + input de número)
  const inputGroup = document.createElement('div');
  inputGroup.className =
    'flex items-stretch w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 focus-within:ring-2 focus-within:ring-brand focus-within:border-transparent transition overflow-hidden';

  const triggerBtn = document.createElement('button');
  triggerBtn.type = 'button';
  triggerBtn.setAttribute('aria-label', 'Seleccionar código de país');
  triggerBtn.className =
    'min-h-[40px] px-3 py-2 bg-slate-50 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex items-center gap-1.5 text-xs hover:bg-slate-100 dark:hover:bg-slate-700/80 transition shrink-0 focus:outline-none';

  function updateTriggerLabel() {
    triggerBtn.innerHTML = `
      <span class="text-[11px] font-bold uppercase text-slate-600 dark:text-slate-300">${selectedCountry.iso}</span>
      <span class="text-xs font-bold text-slate-800 dark:text-slate-100">${selectedCountry.dial}</span>
      <i class="fa-solid fa-chevron-down text-[10px] text-slate-400 ml-0.5" aria-hidden="true"></i>
    `;
  }
  updateTriggerLabel();

  const numberInput = document.createElement('input');
  numberInput.id = `${idPrefix}-number`;
  numberInput.type = 'tel';
  numberInput.value = defaultNumber;
  numberInput.placeholder = placeholder;
  numberInput.required = required;
  numberInput.className =
    'flex-1 min-w-0 min-h-[40px] px-3.5 py-2 text-xs sm:text-sm bg-transparent text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none';

  inputGroup.append(triggerBtn, numberInput);
  root.appendChild(inputGroup);

  // Texto de ayuda inferior
  const helperEl = document.createElement('p');
  helperEl.className = 'mt-1.5 text-[11px] text-slate-500 dark:text-slate-400';
  function updateHelperText() {
    helperEl.innerHTML = `Escriba el número sin el 0 inicial (ej: <strong class="font-semibold text-slate-600 dark:text-slate-300">986901117</strong>). Se guardará con código <strong class="font-semibold text-slate-600 dark:text-slate-300">${selectedCountry.dial}</strong>.`;
  }
  if (showHelper) {
    updateHelperText();
    root.appendChild(helperEl);
  }

  // Dropdown flotante de países
  const dropdown = document.createElement('div');
  dropdown.className =
    'hidden absolute left-0 top-[44px] z-30 w-full sm:w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-2';

  const searchBox = document.createElement('div');
  searchBox.className = 'relative mb-2';
  searchBox.innerHTML = `
    <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" aria-hidden="true"></i>
  `;
  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = 'Buscar país o código...';
  searchInput.className =
    'w-full min-h-[36px] pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand';
  searchBox.appendChild(searchInput);

  const listEl = document.createElement('div');
  listEl.className = 'max-h-56 overflow-y-auto space-y-0.5 pr-1';

  function renderCountryList(filter = '') {
    listEl.innerHTML = '';
    const q = filter.trim().toLowerCase();
    const matches = COUNTRIES.filter(
      (c) =>
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.iso.toLowerCase().includes(q) ||
        c.dial.includes(q)
    );

    if (matches.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'py-4 text-center text-xs text-slate-400';
      empty.textContent = 'No se encontraron países';
      listEl.appendChild(empty);
      return;
    }

    matches.forEach((c) => {
      const isSelected = c.iso === selectedCountry.iso && c.dial === selectedCountry.dial;
      const item = document.createElement('button');
      item.type = 'button';
      item.className = [
        'w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors text-left',
        isSelected
          ? 'bg-brand-soft dark:bg-brand/20 text-brand font-semibold'
          : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800',
      ].join(' ');

      item.innerHTML = `
        <span class="flex items-center gap-2.5 min-w-0">
          <span class="text-[11px] font-bold uppercase w-5 shrink-0 ${isSelected ? 'text-brand' : 'text-slate-500 dark:text-slate-400'}">${c.iso}</span>
          <span class="truncate">${c.name}</span>
        </span>
        <span class="text-xs font-medium shrink-0 ml-2 ${isSelected ? 'text-brand' : 'text-slate-500 dark:text-slate-400'}">${c.dial}</span>
      `;

      item.addEventListener('click', () => {
        selectedCountry = c;
        updateTriggerLabel();
        if (showHelper) updateHelperText();
        closeDropdown();
        numberInput.focus();
      });

      listEl.appendChild(item);
    });
  }

  dropdown.append(searchBox, listEl);
  root.appendChild(dropdown);

  function openDropdown() {
    searchInput.value = '';
    renderCountryList('');
    dropdown.classList.remove('hidden');
    setTimeout(() => searchInput.focus(), 20);
  }

  function closeDropdown() {
    dropdown.classList.add('hidden');
  }

  triggerBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (dropdown.classList.contains('hidden')) {
      openDropdown();
    } else {
      closeDropdown();
    }
  });

  searchInput.addEventListener('input', (e) => {
    renderCountryList(e.target.value);
  });

  document.addEventListener('click', (e) => {
    if (!root.contains(e.target)) {
      closeDropdown();
    }
  });

  return {
    element: root,
    getCodigo: () => selectedCountry.dial,
    getNumero: () => numberInput.value.trim().replace(/^0+/, ''),
    setValues: (dial = '+595', num = '') => {
      selectedCountry = COUNTRIES.find((c) => c.dial === dial) || COUNTRIES[0];
      numberInput.value = num || '';
      updateTriggerLabel();
      if (showHelper) updateHelperText();
    },
    inputElement: numberInput,
  };
}

