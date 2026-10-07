/* Google Places address search for the shared address form.
   attachPlacesAutocomplete(input, onPick) turns a text input into a search box:
   typing shows Google suggestions (India only) in a site-styled dropdown, and
   picking one resolves it into { full, city, state, pincode } — `full` is the
   whole address as Google formats it (India dropped). Google stops at the
   building, so the shopper adds the door number / floor to it by hand.

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

/* Turn a Place into the form's fields: the full formatted address, plus the
   city and PIN on their own (the PIN prices delivery). */
function parsePlace(place) {
  const comps = place.addressComponents || [];
  const get = (type) => comps.find((c) => c.types.includes(type))?.longText || '';
  const isNamedPlace = (place.types || []).some((t) => t === 'establishment' || t === 'premise' || t === 'point_of_interest');
  let full = String(place.formattedAddress || '').replace(/,\s*India$/i, '').trim();
  // Google leaves a building's own name out of its formatted address.
  const name = String(place.displayName || '').trim();
  if (isNamedPlace && name && !full.toLowerCase().includes(name.toLowerCase())) full = full ? `${name}, ${full}` : name;
  return {
    full,
    city: get('locality') || get('administrative_area_level_3') || get('administrative_area_level_2'),
    state: get('administrative_area_level_1'),
    pincode: get('postal_code'),
  };
}

const PIN_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>';

// Text with the parts Google matched against the query wrapped in <strong>.
function highlighted(formattable) {
  const frag = document.createDocumentFragment();
  const text = formattable?.text || '';
  let at = 0;
  for (const m of formattable?.matches || []) {
    const start = m.startOffset ?? 0;
    const end = m.endOffset ?? start;
    if (start < at || end <= start) continue;
    frag.append(text.slice(at, start));
    const b = document.createElement('strong');
    b.textContent = text.slice(start, end);
    frag.append(b);
    at = end;
  }
  frag.append(text.slice(at));
  return frag;
}

// Characters needed before a search runs, and the pause that folds a burst of
// keystrokes into one request. Every change still ends in a search.
const MIN_CHARS = 1;
const DEBOUNCE_MS = 200;

export async function attachPlacesAutocomplete(input, onPick) {
  if (!GOOGLE_MAPS_API_KEY) return false;
  // Start loading now, but wire the field up straight away: anything typed
  // before Google is ready is searched as soon as it is.
  const placesReady = loadPlaces();
  let lib = null;
  let token = null;
  let disabled = false;

  let suggestions = [];
  let lastQuery = '';
  let active = -1;
  let timer = null;
  let requestSeq = 0;
  // Set once an address is picked: the shopper is now adding their door
  // number / floor to it, and re-searching on those edits would pop the list
  // over the text (and a stray click would overwrite it). Emptying the field,
  // or pressing ↓, searches again.
  let picked = false;

  // The browser's own address autofill pops up over our list. Chrome ignores
  // autocomplete="off" on fields it takes for addresses, but neither Chrome nor
  // Safari offers address autofill on a search input; the data-* attributes do
  // the same for the common password managers.
  input.type = 'search';
  input.setAttribute('autocomplete', 'off');
  input.setAttribute('autocorrect', 'off');
  input.setAttribute('spellcheck', 'false');
  input.setAttribute('data-lpignore', 'true');
  input.setAttribute('data-1p-ignore', '');
  input.setAttribute('data-form-type', 'other');
  input.setAttribute('enterkeyhint', 'search');
  input.classList.add('places-input');

  // Field + spinner + menu share a positioned wrapper so both sit on the input.
  const field = document.createElement('div');
  field.className = 'places-field';
  input.replaceWith(field);
  const spinner = document.createElement('span');
  spinner.className = 'places-spinner';
  spinner.hidden = true;
  spinner.setAttribute('aria-hidden', 'true');

  const menuId = input.id + '-places';
  const menu = document.createElement('div');
  menu.className = 'places-menu';
  menu.hidden = true;
  menu.innerHTML = `<ul class="places-menu__list" role="listbox" id="${menuId}" aria-label="Address suggestions"></ul>
    <p class="places-menu__status" aria-live="polite" hidden></p>
    <p class="places-menu__attribution">Powered by Google</p>`;
  field.append(input, spinner, menu);
  const list = menu.querySelector('ul');
  const status = menu.querySelector('.places-menu__status');

  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-controls', menuId);
  input.setAttribute('aria-expanded', 'false');

  const setLoading = (on) => {
    spinner.hidden = !on;
    input.setAttribute('aria-busy', String(on));
  };

  const open = () => {
    menu.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  };

  const close = () => {
    menu.hidden = true;
    active = -1;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  };

  // A single line in place of the list: "Searching…" or "No matches".
  const showStatus = (text, { busy = false } = {}) => {
    list.innerHTML = '';
    status.textContent = text;
    status.hidden = false;
    status.classList.toggle('is-busy', busy);
    open();
  };

  const highlight = (i) => {
    active = i;
    list.querySelectorAll('li').forEach((li, n) => li.setAttribute('aria-selected', String(n === i)));
    if (i >= 0) {
      input.setAttribute('aria-activedescendant', `${menuId}-${i}`);
      list.children[i]?.scrollIntoView({ block: 'nearest' });
    }
  };

  const render = () => {
    status.hidden = true;
    if (!suggestions.length) {
      showStatus('No matches — keep typing, or enter the address yourself.');
      return;
    }
    list.innerHTML = '';
    suggestions.forEach((s, i) => {
      const p = s.placePrediction;
      const li = document.createElement('li');
      li.id = `${menuId}-${i}`;
      li.className = 'places-menu__item';
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', 'false');
      const icon = document.createElement('span');
      icon.className = 'places-menu__icon';
      icon.innerHTML = PIN_ICON;
      const text = document.createElement('span');
      text.className = 'places-menu__text';
      const main = document.createElement('span');
      main.className = 'places-menu__main';
      main.append(highlighted(p.mainText || p.text));
      const sub = document.createElement('span');
      sub.className = 'places-menu__sub';
      sub.textContent = p.secondaryText?.text || '';
      text.append(main, sub);
      li.append(icon, text);
      // mousedown so the pick lands before the input's blur closes the menu
      li.addEventListener('mousedown', (e) => { e.preventDefault(); pick(i); });
      li.addEventListener('mousemove', () => { if (active !== i) highlight(i); });
      list.appendChild(li);
    });
    open();
    highlight(-1);
  };

  // Google failed to load or refused the key: fall back to a plain field.
  const giveUp = () => {
    disabled = true;
    clearTimeout(timer);
    setLoading(false);
    close();
    input.removeAttribute('role');
    input.removeAttribute('aria-expanded');
  };

  async function ensureLib() {
    if (!lib) {
      lib = await placesReady;
      if (!lib) { giveUp(); return null; }
    }
    if (!token) token = new lib.AutocompleteSessionToken();
    return lib;
  }

  async function fetchSuggestions(query) {
    const seq = ++requestSeq;
    const L = await ensureLib();
    if (!L || seq !== requestSeq) return;
    try {
      const res = await L.AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: query,
        sessionToken: token,
        includedRegionCodes: ['in'],
        language: 'en-IN',
      });
      if (seq !== requestSeq) return; // a newer keystroke already answered
      suggestions = (res.suggestions || []).filter((s) => s.placePrediction);
      lastQuery = query;
      setLoading(false);
      // Only show the list if the shopper is still in the field; otherwise
      // don't leave "Searching…" hanging open.
      if (document.activeElement === input) render();
      else close();
    } catch (err) {
      if (seq !== requestSeq) return;
      console.warn('[places] suggestions failed', err);
      setLoading(false);
      showStatus('Address search is unavailable right now — please type the address.');
    }
  }

  async function pick(i) {
    const prediction = suggestions[i]?.placePrediction;
    if (!prediction) return;
    requestSeq++; // drop any suggestion request still in flight
    clearTimeout(timer);
    input.value = prediction.text?.text || prediction.mainText?.text || '';
    close();
    setLoading(true);
    try {
      const place = prediction.toPlace();
      await place.fetchFields({ fields: ['displayName', 'addressComponents', 'formattedAddress', 'types'] });
      onPick(parsePlace(place));
    } catch (err) {
      console.warn('[places] place details failed', err);
    } finally {
      setLoading(false);
      token = null; // the details fetch ends the billing session
      suggestions = [];
      lastQuery = '';
      picked = true;
    }
  }

  // Runs on every change to the field — typing, deleting, pasting, autofill.
  function search({ force = false } = {}) {
    if (disabled) return;
    clearTimeout(timer);
    const q = input.value.trim();
    if (!q) picked = false;
    if (force) picked = false;
    if (picked) return;
    if (q.length < MIN_CHARS) {
      requestSeq++;
      suggestions = [];
      lastQuery = '';
      setLoading(false);
      close();
      return;
    }
    // Feedback from the first keystroke, not after the pause + round trip.
    setLoading(true);
    if (menu.hidden || !suggestions.length) showStatus('Searching addresses…', { busy: true });
    timer = setTimeout(() => fetchSuggestions(q), DEBOUNCE_MS);
  }

  input.addEventListener('input', () => search());

  // Coming back to the field brings the list back: the last results if the
  // text hasn't changed since, otherwise a fresh search. After a pick the
  // text is the chosen address, so nothing reopens.
  input.addEventListener('focus', () => {
    if (disabled || picked) return;
    const q = input.value.trim();
    if (q.length < MIN_CHARS) return;
    if (q === lastQuery) render();
    else search();
  });

  input.addEventListener('keydown', (e) => {
    if (disabled) return;
    if (e.key === 'Enter' && !menu.hidden) e.preventDefault(); // never submit mid-search
    if (e.key === 'ArrowDown' && menu.hidden && input.value.trim().length >= MIN_CHARS) {
      e.preventDefault();
      search({ force: true });
      return;
    }
    if (menu.hidden || !suggestions.length || !status.hidden) {
      if (e.key === 'Escape' && !menu.hidden) { e.preventDefault(); close(); }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); highlight(Math.min(active + 1, suggestions.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); highlight(Math.max(active - 1, 0)); }
    else if (e.key === 'Enter' && active >= 0) pick(active);
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
  });

  input.addEventListener('blur', () => { close(); });
  // A form reset (after saving) empties the field without an input event.
  input.form?.addEventListener('reset', () => {
    picked = false;
    suggestions = [];
    lastQuery = '';
    requestSeq++;
    clearTimeout(timer);
    setLoading(false);
    close();
  });

  const ok = !!(await placesReady);
  if (!ok) giveUp();
  return ok;
}
