/* Google Places address search for the shared address form.
   attachPlacesAutocomplete(input, onPick) turns a text input into a search box:
   typing shows Google suggestions (India only) in a site-styled dropdown, and
   picking one resolves it into { line1, line2, city, state, pincode }.

   Uses the Places API (New) data classes — AutocompleteSuggestion + Place —
   rather than the legacy Autocomplete widget, which Google no longer enables
   for new projects. Does nothing (the input stays a plain field) when no key is
   configured or the Maps script fails to load. */

import { GOOGLE_MAPS_API_KEY } from '/js/config.js';

let placesPromise = null;

function loadPlaces() {
  if (!GOOGLE_MAPS_API_KEY) return Promise.resolve(null);
  if (placesPromise) return placesPromise;
  placesPromise = new Promise((resolve, reject) => {
    if (window.google?.maps?.importLibrary) return resolve();
    const cb = '__rangmudraMapsReady';
    window[cb] = () => { delete window[cb]; resolve(); };
    const s = document.createElement('script');
    s.src = 'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(GOOGLE_MAPS_API_KEY) +
      '&loading=async&v=weekly&callback=' + cb;
    s.async = true;
    s.onerror = () => reject(new Error('Google Maps failed to load'));
    document.head.appendChild(s);
  })
    .then(() => window.google.maps.importLibrary('places'))
    .catch((err) => {
      console.warn('[places]', err);
      placesPromise = null;
      return null;
    });
  return placesPromise;
}

/* Turn a Place's address components into the form's fields. Google rarely
   knows the flat number, so line1 starts with the building/place name and the
   shopper adds their unit themselves. */
function parsePlace(place) {
  const comps = place.addressComponents || [];
  const get = (type) => comps.find((c) => c.types.includes(type))?.longText || '';
  const uniq = (parts) => parts.filter((p, i) => p && parts.indexOf(p) === i);

  const isNamedPlace = (place.types || []).some((t) => t === 'establishment' || t === 'premise' || t === 'point_of_interest');
  const street = [get('street_number'), get('route')].filter(Boolean).join(' ');
  let line1Parts = uniq([get('subpremise'), get('premise'), isNamedPlace ? place.displayName : '', street]);
  if (!line1Parts.length) line1Parts = [(place.formattedAddress || '').split(',')[0].trim()];

  const line2Parts = uniq([
    get('neighborhood'), get('sublocality_level_3'), get('sublocality_level_2'), get('sublocality_level_1'),
  ]).filter((p) => !line1Parts.includes(p));

  return {
    line1: line1Parts.join(', '),
    line2: line2Parts.join(', '),
    city: get('locality') || get('administrative_area_level_3') || get('administrative_area_level_2'),
    state: get('administrative_area_level_1'),
    pincode: get('postal_code'),
  };
}

export async function attachPlacesAutocomplete(input, onPick) {
  const places = await loadPlaces();
  if (!places) return false;
  const { AutocompleteSuggestion, AutocompleteSessionToken } = places;

  // One session token spans the keystrokes + the final details fetch, which
  // Google bills as a single session.
  let token = new AutocompleteSessionToken();
  let suggestions = [];
  let active = -1;
  let timer = null;
  let requestSeq = 0;

  const menuId = input.id + '-places';
  const menu = document.createElement('div');
  menu.className = 'places-menu';
  menu.hidden = true;
  menu.innerHTML = `<ul class="places-menu__list" role="listbox" id="${menuId}"></ul>
    <p class="places-menu__attribution">Powered by Google</p>`;
  input.insertAdjacentElement('afterend', menu);
  const list = menu.querySelector('ul');

  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-controls', menuId);
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('autocomplete', 'off');

  const close = () => {
    menu.hidden = true;
    active = -1;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  };

  const highlight = (i) => {
    active = i;
    list.querySelectorAll('li').forEach((li, n) => li.setAttribute('aria-selected', String(n === i)));
    if (i >= 0) input.setAttribute('aria-activedescendant', `${menuId}-${i}`);
  };

  const render = () => {
    if (!suggestions.length) return close();
    list.innerHTML = '';
    suggestions.forEach((s, i) => {
      const p = s.placePrediction;
      const li = document.createElement('li');
      li.id = `${menuId}-${i}`;
      li.className = 'places-menu__item';
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', 'false');
      const main = document.createElement('span');
      main.className = 'places-menu__main';
      main.textContent = p.mainText?.text || p.text.text;
      const sub = document.createElement('span');
      sub.className = 'places-menu__sub';
      sub.textContent = p.secondaryText?.text || '';
      li.append(main, sub);
      // mousedown so the pick lands before the input's blur closes the menu
      li.addEventListener('mousedown', (e) => { e.preventDefault(); pick(i); });
      list.appendChild(li);
    });
    menu.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    highlight(-1);
  };

  async function fetchSuggestions(query) {
    const seq = ++requestSeq;
    try {
      const res = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: query,
        sessionToken: token,
        includedRegionCodes: ['in'],
        language: 'en-IN',
      });
      if (seq !== requestSeq) return; // a newer keystroke already answered
      suggestions = (res.suggestions || []).filter((s) => s.placePrediction);
      render();
    } catch (err) {
      console.warn('[places] suggestions failed', err);
      close();
    }
  }

  async function pick(i) {
    const prediction = suggestions[i]?.placePrediction;
    if (!prediction) return;
    close();
    try {
      const place = prediction.toPlace();
      await place.fetchFields({ fields: ['displayName', 'addressComponents', 'formattedAddress', 'types'] });
      onPick(parsePlace(place));
    } catch (err) {
      console.warn('[places] place details failed', err);
    } finally {
      token = new AutocompleteSessionToken();
      suggestions = [];
    }
  }

  input.addEventListener('input', () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (q.length < 3) { requestSeq++; suggestions = []; close(); return; }
    timer = setTimeout(() => fetchSuggestions(q), 250);
  });

  input.addEventListener('keydown', (e) => {
    if (menu.hidden) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); highlight(Math.min(active + 1, suggestions.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); highlight(Math.max(active - 1, 0)); }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); pick(active); }
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
  });

  input.addEventListener('blur', close);
  return true;
}
