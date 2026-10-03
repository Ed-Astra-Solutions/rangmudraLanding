/* home-enquiry.js — the enquiry box at the foot of the homepage.
 *
 * Posts to /api/enquiry like the Enquire page form. Fields are checked inline
 * (message under the field, red border) instead of with browser bubbles, and
 * the result shows as a line above the button rather than in the button. */

import { apiUrl } from '/js/config.js';
import { armForm, botFields, guardedFetch } from '/js/bot-guard.js';

const form = document.getElementById('home-enquiry-form');

if (form) {
  armForm(form);
  const status = form.querySelector('.home-enquiry__status');
  const btn = form.querySelector('[type=submit]');
  const label = btn.textContent;

  const showStatus = (text, kind) => {
    status.textContent = text;
    status.dataset.kind = kind;
    status.hidden = false;
  };

  const fieldError = (input, message) => {
    const field = input.closest('.home-enquiry__field');
    field.classList.toggle('is-invalid', !!message);
    let hint = field.querySelector('.home-enquiry__error');
    if (!message) { hint?.remove(); return; }
    if (!hint) {
      hint = document.createElement('p');
      hint.className = 'h6-a home-enquiry__error';
      hint.id = `${input.id}-error`;
      field.appendChild(hint);
      input.setAttribute('aria-describedby', hint.id);
    }
    hint.textContent = message;
    input.setAttribute('aria-invalid', 'true');
  };

  const validate = (input) => {
    const value = input.value.trim();
    let message = '';
    if (input.required && !value) message = 'This field is required.';
    else if (input.type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) message = 'Please enter a valid email address.';
    else if (input.type === 'tel' && value && value.replace(/[\s\-()+]/g, '').length < 7) message = 'Please enter a valid phone number.';
    fieldError(input, message);
    if (!message) input.removeAttribute('aria-invalid');
    return !message;
  };

  const inputs = [...form.querySelectorAll('input:not([type=hidden]):not([tabindex="-1"]), textarea')]
    .filter((el) => el.closest('.home-enquiry__field'));
  inputs.forEach((input) => {
    input.addEventListener('blur', () => validate(input));
    input.addEventListener('input', () => {
      if (input.closest('.is-invalid')) validate(input);
    });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    status.hidden = true;
    const invalid = inputs.filter((input) => !validate(input));
    if (invalid.length) {
      invalid[0].focus();
      showStatus('Please fix the highlighted fields.', 'error');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Sending…';
    const val = (id) => form.querySelector(id).value.trim();
    try {
      const res = await guardedFetch(apiUrl('/api/enquiry'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: val('#he-name'),
          email: val('#he-email'),
          phone: val('#he-phone'),
          message: `Interested in: ${val('#he-topic')}\n\n${val('#he-message')}`,
          ...(await botFields(form, 'enquiry')),
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed');
      form.reset();
      showStatus("Thank you — your enquiry has been sent. We'll be in touch soon.", 'success');
    } catch (err) {
      showStatus('Sorry, something went wrong. Please try again, or email us directly.', 'error');
    }
    btn.textContent = label;
    btn.disabled = false;
  });
}
