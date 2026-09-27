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
      <label class="input-label" for="addr-line1">Address Line 1</label>
      <input type="text" id="addr-line1" class="input-field" placeholder="Rangmudra Studio, No. 12" required>
      <p class="input-hint" data-addr-hint hidden>Add your flat or house number to Address Line 1.</p>
    </div>
    <div class="input-wrap" style="margin-bottom:16px;">
      <label class="input-label" for="addr-line2">Address Line 2</label>
      <input type="text" id="addr-line2" class="input-field" placeholder="Doddakalasandra">
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

  // Google address search on Line 1 — picking a suggestion fills the rest.
  const line1 = form.querySelector('#addr-line1');
  const hint = form.querySelector('[data-addr-hint]');
  attachPlacesAutocomplete(line1, (addr) => {
    const set = (id, v) => { const el = form.querySelector('#' + id); if (el && v) el.value = v; };
    line1.value = addr.line1;
    form.querySelector('#addr-line2').value = addr.line2;
    set('addr-city', addr.city);
    set('addr-pin', addr.pincode);
    hint.hidden = false;
    line1.focus();
    line1.setSelectionRange(0, 0);
  }).then((on) => {
    if (on) line1.placeholder = 'Search your building, street or area';
  });
  form.addEventListener('reset', () => { hint.hidden = true; });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errEl.style.display = 'none';
    if (!isLoggedIn()) { openAuthModal(); return; }

    const val = (id) => (form.querySelector('#' + id)?.value || '').trim();
    const name = val('addr-name');
    const phone = val('addr-phone');
    const lines = [val('addr-line1'), val('addr-line2'), [val('addr-city'), val('addr-pin')].filter(Boolean).join(' ')]
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
