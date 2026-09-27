// Client half of the API's abuse protection (backend/security.js).
//
//   armForm(form)            — call once when a form is set up: adds a hidden
//                              honeypot field, starts the fill timer and warms
//                              up reCAPTCHA the first time the form is touched.
//   botFields(form, action)  — call on submit; spread the result into the JSON
//                              body: { _hp, _elapsed, recaptchaToken }.
//   guardedFetch(url, init)  — use instead of fetch() for those submits. When
//                              the v3 score is too low the server answers 428;
//                              this shows the v2 "I'm not a robot" checkbox and
//                              resends with its token. Resolves to the final
//                              Response either way.
//
// reCAPTCHA v3 is invisible (no puzzle), matching the brand's no-popups rule.
// Its badge is hidden in components.css; the disclosure Google requires in
// its place sits in the footer and the sign-in modal.

import { apiUrl } from './config.js';

let siteKeyPromise = null;
let scriptPromise = null;

function getSiteKey() {
  if (!siteKeyPromise) {
    siteKeyPromise = fetch(apiUrl('/api/security/config'))
      .then((r) => (r.ok ? r.json() : {}))
      .then((d) => d.recaptchaSiteKey || '')
      .catch(() => '');
  }
  return siteKeyPromise;
}

function loadRecaptcha(siteKey) {
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
      s.async = true;
      s.defer = true;
      s.onload = () => window.grecaptcha.ready(resolve);
      s.onerror = () => { scriptPromise = null; reject(new Error('reCAPTCHA failed to load')); };
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
}

// Start fetching the key + script before the user presses send, so submit
// isn't held up by a cold network round-trip.
export function warmUp() {
  getSiteKey().then((key) => { if (key) loadRecaptcha(key).catch(() => {}); });
}

// A token for `action`, or '' when reCAPTCHA is off (dev) or couldn't load —
// the server decides what to do with a missing token.
export async function getRecaptchaToken(action) {
  const key = await getSiteKey();
  if (!key) return '';
  try {
    await loadRecaptcha(key);
    return await window.grecaptcha.execute(key, { action });
  } catch {
    return '';
  }
}

const armedAt = new WeakMap();

export function armForm(form) {
  if (!form || armedAt.has(form)) return;
  armedAt.set(form, Date.now());

  // Honeypot: invisible to people and screen readers, irresistible to bots
  // that fill every input they find.
  const trap = document.createElement('div');
  trap.setAttribute('aria-hidden', 'true');
  trap.style.cssText = 'position:absolute;left:-10000px;top:auto;width:1px;height:1px;overflow:hidden;';
  trap.innerHTML = '<label>Leave this field empty<input type="text" name="_hp" tabindex="-1" autocomplete="off"></label>';
  form.appendChild(trap);

  form.addEventListener('focusin', warmUp, { once: true });
  // A reset (after a successful send) restarts the clock for the next message.
  form.addEventListener('reset', () => armedAt.set(form, Date.now()));
}

export async function botFields(form, action) {
  const started = armedAt.get(form);
  return {
    _hp: form?.querySelector('input[name="_hp"]')?.value || '',
    _elapsed: started ? Date.now() - started : null,
    recaptchaToken: await getRecaptchaToken(action),
  };
}

// ---------- v2 checkbox fallback ----------

// grecaptcha.render() is available once either script is on the page: the v3
// one (render=<key>) already supports explicit v2 widgets, so only load the
// explicit build if v3 never loaded.
function ensureWidgetApi() {
  if (window.grecaptcha?.render) return new Promise((r) => window.grecaptcha.ready(r));
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://www.google.com/recaptcha/api.js?render=explicit';
    s.async = true;
    s.onload = () => window.grecaptcha.ready(resolve);
    s.onerror = () => reject(new Error('reCAPTCHA failed to load'));
    document.head.appendChild(s);
  });
}

// Shows the checkbox in a small dialog. Resolves to the solved token, or ''
// if the visitor cancels or the widget can't load.
function showChallenge(siteKey) {
  return new Promise((resolve) => {
    const previousFocus = document.activeElement;
    const overlay = document.createElement('div');
    overlay.className = 'captcha-challenge';
    overlay.innerHTML = `
      <div class="captcha-challenge__card" role="dialog" aria-modal="true" aria-labelledby="captcha-challenge-title">
        <h2 class="h4-i captcha-challenge__title" id="captcha-challenge-title">One quick check</h2>
        <p class="h5-a captcha-challenge__text">Please tick the box below so we know it's really you.</p>
        <div class="captcha-challenge__widget"></div>
        <button type="button" class="h6-a captcha-challenge__cancel">Cancel</button>
      </div>`;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('open'));

    let settled = false;
    const finish = (token) => {
      if (settled) return;
      settled = true;
      document.removeEventListener('keydown', onKey);
      overlay.remove();
      previousFocus?.focus?.();
      resolve(token || '');
    };
    const onKey = (e) => { if (e.key === 'Escape') finish(''); };
    document.addEventListener('keydown', onKey);
    overlay.querySelector('.captcha-challenge__cancel').addEventListener('click', () => finish(''));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) finish(''); });

    ensureWidgetApi().then(() => {
      window.grecaptcha.render(overlay.querySelector('.captcha-challenge__widget'), {
        sitekey: siteKey,
        // Short pause so the tick is seen before the dialog closes.
        callback: (token) => setTimeout(() => finish(token), 300),
      });
    }).catch(() => finish(''));
  });
}

export async function guardedFetch(url, init = {}) {
  const res = await fetch(url, init);
  if (res.status !== 428) return res;
  const data = await res.clone().json().catch(() => ({}));
  if (data.challenge !== 'recaptcha_v2' || !data.siteKey) return res;
  const token = await showChallenge(data.siteKey);
  if (!token) return res; // cancelled — caller shows the 428's error message
  let body = {};
  try { body = JSON.parse(init.body || '{}'); } catch { /* not JSON; send token alone */ }
  return fetch(url, { ...init, body: JSON.stringify({ ...body, recaptchaV2Token: token }) });
}
