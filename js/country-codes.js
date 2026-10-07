/* country-codes.js — Country code dropdown */

const PRIORITY_COUNTRIES = [
  { flag: '🇮🇳', name: 'India', code: '+91' },
  { flag: '🇺🇸', name: 'United States', code: '+1' },
  { flag: '🇬🇧', name: 'United Kingdom', code: '+44' },
  { flag: '🇦🇪', name: 'UAE', code: '+971' },
  { flag: '🇸🇬', name: 'Singapore', code: '+65' },
  { flag: '🇦🇺', name: 'Australia', code: '+61' },
];

const ALL_COUNTRIES = [
  { flag: '🇦🇫', name: 'Afghanistan', code: '+93' },
  { flag: '🇦🇱', name: 'Albania', code: '+355' },
  { flag: '🇩🇿', name: 'Algeria', code: '+213' },
  { flag: '🇦🇩', name: 'Andorra', code: '+376' },
  { flag: '🇦🇴', name: 'Angola', code: '+244' },
  { flag: '🇦🇷', name: 'Argentina', code: '+54' },
  { flag: '🇦🇲', name: 'Armenia', code: '+374' },
  { flag: '🇦🇹', name: 'Austria', code: '+43' },
  { flag: '🇦🇿', name: 'Azerbaijan', code: '+994' },
  { flag: '🇧🇭', name: 'Bahrain', code: '+973' },
  { flag: '🇧🇩', name: 'Bangladesh', code: '+880' },
  { flag: '🇧🇾', name: 'Belarus', code: '+375' },
  { flag: '🇧🇪', name: 'Belgium', code: '+32' },
  { flag: '🇧🇷', name: 'Brazil', code: '+55' },
  { flag: '🇧🇳', name: 'Brunei', code: '+673' },
  { flag: '🇧🇬', name: 'Bulgaria', code: '+359' },
  { flag: '🇨🇦', name: 'Canada', code: '+1' },
  { flag: '🇨🇱', name: 'Chile', code: '+56' },
  { flag: '🇨🇳', name: 'China', code: '+86' },
  { flag: '🇨🇴', name: 'Colombia', code: '+57' },
  { flag: '🇨🇷', name: 'Costa Rica', code: '+506' },
  { flag: '🇭🇷', name: 'Croatia', code: '+385' },
  { flag: '🇨🇾', name: 'Cyprus', code: '+357' },
  { flag: '🇨🇿', name: 'Czech Republic', code: '+420' },
  { flag: '🇩🇰', name: 'Denmark', code: '+45' },
  { flag: '🇪🇬', name: 'Egypt', code: '+20' },
  { flag: '🇪🇪', name: 'Estonia', code: '+372' },
  { flag: '🇪🇹', name: 'Ethiopia', code: '+251' },
  { flag: '🇫🇮', name: 'Finland', code: '+358' },
  { flag: '🇫🇷', name: 'France', code: '+33' },
  { flag: '🇬🇪', name: 'Georgia', code: '+995' },
  { flag: '🇩🇪', name: 'Germany', code: '+49' },
  { flag: '🇬🇭', name: 'Ghana', code: '+233' },
  { flag: '🇬🇷', name: 'Greece', code: '+30' },
  { flag: '🇭🇰', name: 'Hong Kong', code: '+852' },
  { flag: '🇭🇺', name: 'Hungary', code: '+36' },
  { flag: '🇮🇸', name: 'Iceland', code: '+354' },
  { flag: '🇮🇩', name: 'Indonesia', code: '+62' },
  { flag: '🇮🇷', name: 'Iran', code: '+98' },
  { flag: '🇮🇶', name: 'Iraq', code: '+964' },
  { flag: '🇮🇪', name: 'Ireland', code: '+353' },
  { flag: '🇮🇱', name: 'Israel', code: '+972' },
  { flag: '🇮🇹', name: 'Italy', code: '+39' },
  { flag: '🇯🇲', name: 'Jamaica', code: '+1876' },
  { flag: '🇯🇵', name: 'Japan', code: '+81' },
  { flag: '🇯🇴', name: 'Jordan', code: '+962' },
  { flag: '🇰🇿', name: 'Kazakhstan', code: '+7' },
  { flag: '🇰🇪', name: 'Kenya', code: '+254' },
  { flag: '🇰🇷', name: 'South Korea', code: '+82' },
  { flag: '🇰🇼', name: 'Kuwait', code: '+965' },
  { flag: '🇱🇧', name: 'Lebanon', code: '+961' },
  { flag: '🇲🇾', name: 'Malaysia', code: '+60' },
  { flag: '🇲🇻', name: 'Maldives', code: '+960' },
  { flag: '🇲🇽', name: 'Mexico', code: '+52' },
  { flag: '🇳🇱', name: 'Netherlands', code: '+31' },
  { flag: '🇳🇿', name: 'New Zealand', code: '+64' },
  { flag: '🇳🇬', name: 'Nigeria', code: '+234' },
  { flag: '🇳🇴', name: 'Norway', code: '+47' },
  { flag: '🇴🇲', name: 'Oman', code: '+968' },
  { flag: '🇵🇰', name: 'Pakistan', code: '+92' },
  { flag: '🇵🇭', name: 'Philippines', code: '+63' },
  { flag: '🇵🇱', name: 'Poland', code: '+48' },
  { flag: '🇵🇹', name: 'Portugal', code: '+351' },
  { flag: '🇶🇦', name: 'Qatar', code: '+974' },
  { flag: '🇷🇴', name: 'Romania', code: '+40' },
  { flag: '🇷🇺', name: 'Russia', code: '+7' },
  { flag: '🇸🇦', name: 'Saudi Arabia', code: '+966' },
  { flag: '🇷🇸', name: 'Serbia', code: '+381' },
  { flag: '🇿🇦', name: 'South Africa', code: '+27' },
  { flag: '🇪🇸', name: 'Spain', code: '+34' },
  { flag: '🇱🇰', name: 'Sri Lanka', code: '+94' },
  { flag: '🇸🇪', name: 'Sweden', code: '+46' },
  { flag: '🇨🇭', name: 'Switzerland', code: '+41' },
  { flag: '🇹🇼', name: 'Taiwan', code: '+886' },
  { flag: '🇹🇭', name: 'Thailand', code: '+66' },
  { flag: '🇹🇷', name: 'Turkey', code: '+90' },
  { flag: '🇺🇦', name: 'Ukraine', code: '+380' },
  { flag: '🇺🇿', name: 'Uzbekistan', code: '+998' },
  { flag: '🇻🇳', name: 'Vietnam', code: '+84' },
  { flag: '🇾🇪', name: 'Yemen', code: '+967' },
  { flag: '🇿🇲', name: 'Zambia', code: '+260' },
  { flag: '🇿🇼', name: 'Zimbabwe', code: '+263' },
].sort((a, b) => a.name.localeCompare(b.name));

function buildDropdown(selector, codeEl, flagEl) {
  const btn = document.getElementById(selector);
  if (!btn) return;

  let selectedCode = '+91';
  let selectedFlag = '🇮🇳';

  const dropdown = document.createElement('div');
  dropdown.className = 'country-dropdown';
  dropdown.setAttribute('role', 'listbox');
  dropdown.setAttribute('aria-label', 'Country code');

  const searchInput = document.createElement('input');
  searchInput.className = 'country-dropdown__search';
  searchInput.type = 'search';
  searchInput.placeholder = 'Search country';
  searchInput.setAttribute('aria-label', 'Search country');

  const list = document.createElement('div');
  list.className = 'country-dropdown__list';

  dropdown.appendChild(searchInput);
  dropdown.appendChild(list);
  btn.appendChild(dropdown);

  function renderList(filter = '') {
    list.innerHTML = '';
    const q = filter.toLowerCase();

    const addItem = (country, isSelected) => {
      const item = document.createElement('div');
      item.className = 'country-dropdown__item' + (isSelected ? ' selected' : '');
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      item.innerHTML = `
        <span class="country-dropdown__flag">${country.flag}</span>
        <span class="country-dropdown__name">${country.name}</span>
        <span class="country-dropdown__code">${country.code}</span>
      `;
      item.addEventListener('click', () => {
        selectedCode = country.code;
        selectedFlag = country.flag;
        if (codeEl) codeEl.textContent = country.code;
        if (flagEl) flagEl.textContent = country.flag;
        close();
      });
      list.appendChild(item);
    };

    const filteredPriority = PRIORITY_COUNTRIES.filter(c =>
      !q || c.name.toLowerCase().startsWith(q) || c.code.includes(q)
    );
    const filteredAll = ALL_COUNTRIES.filter(c =>
      !q || c.name.toLowerCase().startsWith(q) || c.code.includes(q)
    );

    filteredPriority.forEach(c => addItem(c, c.code === selectedCode && c.flag === selectedFlag));

    if (filteredPriority.length && filteredAll.length && !q) {
      const divider = document.createElement('div');
      divider.className = 'country-dropdown__divider';
      list.appendChild(divider);
    }

    filteredAll.forEach(c => addItem(c, c.code === selectedCode && c.flag === selectedFlag));

    if (!filteredPriority.length && !filteredAll.length) {
      const empty = document.createElement('div');
      empty.className = 'country-dropdown__item';
      empty.style.justifyContent = 'center';
      empty.style.color = 'var(--sc-l4x)';
      empty.textContent = 'No results';
      list.appendChild(empty);
    }
  }

  function open() {
    dropdown.classList.add('open');
    btn.setAttribute('aria-expanded', 'true');
    renderList();
    searchInput.focus();
  }

  function close() {
    dropdown.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
    searchInput.value = '';
  }

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.contains('open') ? close() : open();
  });

  searchInput.addEventListener('input', () => renderList(searchInput.value));
  searchInput.addEventListener('click', (e) => e.stopPropagation());

  document.addEventListener('click', close);
  dropdown.addEventListener('click', (e) => e.stopPropagation());
}

export function initCountryCodes() {
  buildDropdown(
    'country-selector',
    document.getElementById('selected-code'),
    document.getElementById('selected-flag')
  );
}
