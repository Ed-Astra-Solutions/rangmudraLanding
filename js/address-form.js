/* Shared "Add new address" form — used by checkout-address.html and
   profile-addresses.html so both collect and save addresses identically.
   mountAddressForm(container, { onSaved }) renders the form into `container`
   and saves to the signed-in user's account on submit. */

import { isLoggedIn, openAuthModal, addUserAddress } from '/js/auth.js';
import { attachPlacesAutocomplete } from '/js/google-places.js';

const FORM_HTML = `
  <form>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
      <div class="input-wrap">
        <label class="input-label" for="addr-name">Full Name</label>
        <input type="text" id="addr-name" class="input-field" placeholder="First Name Last Name" required>
      </div>
      <div class="input-wrap">
        <label class="input-label" for="addr-phone">Phone</label>
        <input type="tel" id="addr-phone" class="input-field" placeholder="+91 98765 43210" required autocomplete="off" autocorrect="off" spellcheck="false" data-lpignore="true" data-form-type="other">
      </div>
    </div>
    <div class="input-wrap" style="margin-bottom:16px;">
      <label class="input-label" for="addr-line1">Building / Area</label>
      <input type="text" id="addr-line1" class="input-field" placeholder="Building, locality, area" required>
    </div>
    <div class="input-wrap" style="margin-bottom:16px;">
      <label class="input-label" for="addr-door">Door No / Floor / Street</label>
      <input type="text" id="addr-door" class="input-field" placeholder="Flat 402, 4th Floor, 12th Cross" required>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px;">
      <div class="input-wrap">
        <label class="input-label" for="addr-city">City</label>
        <input type="text" id="addr-city" class="input-field" placeholder="Bangalore" required>
      </div>
      <div class="input-wrap">
        <label class="input-label" for="addr-pin">PIN Code</label>
        <input type="text" id="addr-pin" class="input-field" placeholder="560062" pattern="\\d{6}" required>
      </div>
    </div>
    <div class="input-error" data-addr-error style="display:none;margin-bottom:16px;"></div>
    <button type="submit" class="btn-gold">Save Address</button>
  </form>
`;

export function mountAddressForm(container, { onSaved } = {}) {
  container.innerHTML = FORM_HTML;
  const form = container.querySelector('form');
  const errEl = form.querySelector('[data-addr-error]');
  const btn = form.querySelector('[type=submit]');
  const showError = (msg) => { errEl.textContent = msg; errEl.style.display = 'block'; };

  // Google address search on the Building / Area field — picking a suggestion
  // fills in the whole address, the city and the PIN. Google stops at the
  // building, so the door number and floor go in their own field below it.
  const line1 = form.querySelector('#addr-line1');
  const door = form.querySelector('#addr-door');
  attachPlacesAutocomplete(line1, (addr) => {
    const set = (id, v) => { const el = form.querySelector('#' + id); if (el && v) el.value = v; };
    line1.value = addr.full;
    set('addr-city', addr.city);
    set('addr-pin', addr.pincode);
    if (!door.value.trim()) door.focus();
  }).then((on) => {
    if (on) line1.placeholder = 'Search your building or area';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errEl.style.display = 'none';
    if (!isLoggedIn()) { openAuthModal(); return; }

    const val = (id) => (form.querySelector('#' + id)?.value || '').trim();
    const name = val('addr-name');
    const phone = val('addr-phone');
    // A full address picked from Google already ends in the city and PIN, so
    // they are only added as their own line when it doesn't.
    const full = val('addr-line1');
    const cityPin = [val('addr-city'), val('addr-pin')].filter(Boolean).join(' ');
    const lines = [val('addr-door'), full, full.includes(val('addr-pin')) ? '' : cityPin]
      .filter(Boolean);
    if (phone) lines.push('Phone: ' + phone);

    const label = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Saving…';
    try {
      const saved = await addUserAddress({
        label: 'Home',
        title: name || 'New address',
        address: lines.join('\n'),
        pincode: val('addr-pin'),
        phone,
      });
      form.reset();
      onSaved?.(saved);
    } catch (err) {
      if (err.authExpired) openAuthModal(() => location.reload());
      else showError(err.message || 'Sorry, we couldn\'t save your address. Please try again.');
    } finally {
      btn.disabled = false;
      btn.textContent = label;
    }
  });

  return form;
}
