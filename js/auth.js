/* auth.js — Email OTP auth modal logic (talks to the server). */

import { apiUrl } from '/js/config.js';

const SESSION_KEY = 'rangmudra_session';

function isLoggedIn() {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY));
    if (!session) return false;
    return Date.now() < session.expiresAt;
  } catch {
    return false;
  }
}

function getUser() {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY));
    if (!session || Date.now() >= session.expiresAt) return null;
    return { email: session.email, token: session.token, name: session.name || '' };
  } catch {
    return null;
  }
}

function getToken() {
  const u = getUser();
  return u ? u.token : null;
}

function saveSession(email, token, expiresAt, name) {
  const exp = expiresAt || Date.now() + (30 * 24 * 60 * 60 * 1000);
  const prev = (() => { try { return JSON.parse(localStorage.getItem(SESSION_KEY)) || {}; } catch { return {}; } })();
  const nextName = name !== undefined ? name : (prev.name || '');
  localStorage.setItem(SESSION_KEY, JSON.stringify({ email, token, expiresAt: exp, name: nextName }));
  window.dispatchEvent(new CustomEvent('auth-changed', { detail: { loggedIn: true } }));
}

// Cache the signed-in user's display name locally so headers/profile can show it
// without a round-trip. Keeps the rest of the session intact.
function setSessionName(name) {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY));
    if (!session) return;
    session.name = name || '';
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    window.dispatchEvent(new CustomEvent('auth-changed', { detail: { loggedIn: true } }));
  } catch { /* ignore */ }
}

// Authenticated fetch helper — attaches the user token and throws on non-2xx.
//
// A 401 means the server no longer honours this token while the browser still
// holds it. Clearing the stored session here is what stops the silent-failure
// mode: without it a page would just render "nothing saved yet" and the shopper
// would think their data had been lost. The thrown error is tagged so callers
// can re-open the sign-in modal instead of showing an empty state.
async function authFetch(path, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}) };
  if (token) headers['x-user-token'] = token;
  if (options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  const res = await fetch(apiUrl(path), { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    localStorage.removeItem(SESSION_KEY);
    window.dispatchEvent(new CustomEvent('auth-changed', { detail: { loggedIn: false } }));
    const err = new Error('Your session has expired. Please sign in again.');
    err.authExpired = true;
    throw err;
  }
  if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data;
}

const getUserProfile = () => authFetch('/api/user');
const updateUserProfile = (patch) => authFetch('/api/user', { method: 'PUT', body: JSON.stringify(patch) });
const getUserAddresses = () => authFetch('/api/user/addresses');
const addUserAddress = (addr) => authFetch('/api/user/addresses', { method: 'POST', body: JSON.stringify(addr) });
const updateUserAddress = (id, patch) => authFetch(`/api/user/addresses/${id}`, { method: 'PUT', body: JSON.stringify(patch) });
const deleteUserAddress = (id) => authFetch(`/api/user/addresses/${id}`, { method: 'DELETE' });

async function logout() {
  const token = getToken();
  if (token) {
    try {
      await fetch(apiUrl('/api/auth/logout'), { method: 'POST', headers: { 'x-user-token': token } });
    } catch { /* ignore network errors on logout */ }
  }
  localStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new CustomEvent('auth-changed', { detail: { loggedIn: false } }));
  window.location.href = 'index.html';
}

function openAuthModal(onSuccess, onCancel) {
  const backdrop = document.getElementById('auth-modal-backdrop');
  if (!backdrop) return;
  backdrop.classList.add('open');
  document.body.style.overflow = 'hidden';
  if (onSuccess) backdrop._onSuccess = onSuccess;
  if (onCancel) backdrop._onCancel = onCancel;
  showScreen('a');

  const emailInput = document.getElementById('email-input');
  if (emailInput) setTimeout(() => emailInput.focus(), 100);
}

function closeAuthModal() {
  const backdrop = document.getElementById('auth-modal-backdrop');
  if (!backdrop) return;
  backdrop.classList.remove('open');
  document.body.style.overflow = '';
  // finishAuth() clears _onCancel first, so this only fires when the visitor
  // dismissed the modal without signing in.
  const onCancel = backdrop._onCancel;
  backdrop._onSuccess = null;
  backdrop._onCancel = null;
  showScreen('a');
  if (onCancel) onCancel();
}

// The auth modal is injected as a partial after this module loads, so anything
// that wants to open it on page load has to wait for that markup to land.
function whenAuthModalReady() {
  if (document.getElementById('auth-modal-backdrop')) return Promise.resolve();
  return new Promise(resolve => {
    window.addEventListener('auth-modal-ready', () => resolve(), { once: true });
  });
}

/* Gate an action behind a signed-in session. Runs onSuccess straight away when
   the visitor is already signed in; otherwise opens the modal and runs it once
   they verify. onCancel fires if they dismiss the modal instead. */
async function requireAuth({ onSuccess, onCancel } = {}) {
  if (isLoggedIn()) {
    if (onSuccess) onSuccess();
    return true;
  }
  await whenAuthModalReady();
  openAuthModal(onSuccess, onCancel);
  return false;
}

function showScreen(screen) {
  const a = document.getElementById('auth-screen-a');
  const b = document.getElementById('auth-screen-b');
  const c = document.getElementById('auth-screen-c');
  if (!a || !b) return;
  a.style.display = screen === 'a' ? 'block' : 'none';
  b.style.display = screen === 'b' ? 'block' : 'none';
  if (c) c.style.display = screen === 'c' ? 'block' : 'none';
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((email || '').trim());
}

let resendTimer = null;
let currentEmail = '';

function startResendCountdown() {
  const timerEl = document.getElementById('resend-timer');
  const countdownEl = document.getElementById('resend-countdown');
  const resendBtn = document.getElementById('resend-btn');
  if (!timerEl || !countdownEl || !resendBtn) return;

  let seconds = 30;
  timerEl.style.display = 'inline';
  resendBtn.style.display = 'none';
  countdownEl.textContent = seconds;

  clearInterval(resendTimer);
  resendTimer = setInterval(() => {
    seconds--;
    countdownEl.textContent = seconds;
    if (seconds <= 0) {
      clearInterval(resendTimer);
      timerEl.style.display = 'none';
      resendBtn.style.display = 'inline';
    }
  }, 1000);
}

async function requestOtp(email) {
  const res = await fetch(apiUrl('/api/auth/request-otp'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Could not send the code. Please try again.');
  return data;
}

function initAuthModal() {
  const backdrop = document.getElementById('auth-modal-backdrop');
  if (!backdrop) return;

  const emailInput = document.getElementById('email-input');
  const continueBtn = document.getElementById('continue-btn');
  const verifyBtn = document.getElementById('verify-btn');
  const backBtn = document.getElementById('auth-back-btn');
  const closeA = document.getElementById('auth-close-a');
  const closeB = document.getElementById('auth-close-b');
  const emailError = document.getElementById('email-error');
  const otpError = document.getElementById('otp-error');
  const otpSubtext = document.getElementById('otp-subtext');
  const resendBtn = document.getElementById('resend-btn');

  if (closeA) closeA.addEventListener('click', closeAuthModal);
  if (closeB) closeB.addEventListener('click', closeAuthModal);

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeAuthModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && backdrop.classList.contains('open')) closeAuthModal();
  });

  if (emailInput) {
    emailInput.addEventListener('input', () => {
      if (continueBtn) continueBtn.disabled = !validateEmail(emailInput.value);
      if (emailError) emailError.style.display = 'none';
    });
    emailInput.addEventListener('blur', () => {
      if (emailInput.value && !validateEmail(emailInput.value) && emailError) {
        emailError.textContent = 'Please enter a valid email address';
        emailError.style.display = 'block';
      }
    });
    emailInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && validateEmail(emailInput.value)) continueBtn?.click();
    });
  }

  if (continueBtn) {
    continueBtn.addEventListener('click', async () => {
      if (!validateEmail(emailInput.value)) return;
      currentEmail = emailInput.value.trim().toLowerCase();
      continueBtn.textContent = '...';
      continueBtn.disabled = true;
      if (emailError) emailError.style.display = 'none';

      try {
        await requestOtp(currentEmail);

        if (otpSubtext) {
          otpSubtext.innerHTML = `We've sent a 6-digit code to <strong>${currentEmail}</strong> <button id="edit-email-btn" style="color:var(--pr-b2);text-decoration:underline;background:none;border:none;cursor:pointer;font-size:inherit;letter-spacing:inherit;font-family:inherit;">Edit</button>`;
          document.getElementById('edit-email-btn')?.addEventListener('click', () => showScreen('a'));
        }

        showScreen('b');
        startResendCountdown();
        const firstBox = document.querySelector('.otp-box');
        if (firstBox) setTimeout(() => firstBox.focus(), 100);
      } catch (err) {
        if (emailError) {
          emailError.textContent = err.message;
          emailError.style.display = 'block';
        }
      } finally {
        continueBtn.textContent = 'CONTINUE';
        continueBtn.disabled = false;
      }
    });
  }

  if (backBtn) backBtn.addEventListener('click', () => showScreen('a'));

  if (verifyBtn) {
    verifyBtn.addEventListener('click', async () => {
      const boxes = document.querySelectorAll('.otp-box');
      const otp = [...boxes].map(b => b.value).join('');
      if (otp.length !== 6) return;

      verifyBtn.textContent = '...';
      verifyBtn.disabled = true;
      if (otpError) otpError.style.display = 'none';

      let data, res;
      try {
        res = await fetch(apiUrl('/api/auth/verify-otp'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: currentEmail, code: otp }),
        });
        data = await res.json().catch(() => ({}));
      } catch {
        res = { ok: false };
        data = { error: 'Network error. Please try again.' };
      }

      if (!res.ok) {
        boxes.forEach(b => b.classList.add('error'));
        const grid = document.getElementById('otp-grid');
        if (grid) { grid.classList.add('shake'); setTimeout(() => grid.classList.remove('shake'), 1000); }
        if (otpError) {
          otpError.textContent = data.error || 'Incorrect code. Please try again.';
          otpError.style.display = 'block';
        }
        boxes.forEach(b => { b.value = ''; b.classList.remove('error'); });
        if (boxes[0]) boxes[0].focus();
        verifyBtn.textContent = 'VERIFY';
        verifyBtn.disabled = false;
        return;
      }

      boxes.forEach(b => b.classList.add('success'));
      await new Promise(r => setTimeout(r, 400));
      saveSession(data.email, data.token, data.expiresAt, data.name);
      verifyBtn.textContent = 'VERIFY';
      verifyBtn.disabled = false;

      // New accounts have no name yet — collect it before finishing.
      if (data.isNew) {
        showScreen('c');
        const nameInput = document.getElementById('name-input');
        if (nameInput) { nameInput.value = ''; setTimeout(() => nameInput.focus(), 100); }
        const nameBtn = document.getElementById('name-btn');
        if (nameBtn) nameBtn.disabled = true;
        return;
      }

      finishAuth();
    });
  }

  // Name screen (Screen C) — only shown for brand-new accounts.
  const nameInput = document.getElementById('name-input');
  const nameBtn = document.getElementById('name-btn');
  const nameError = document.getElementById('name-error');
  const closeC = document.getElementById('auth-close-c');
  if (closeC) closeC.addEventListener('click', () => { finishAuth(); });
  if (nameInput) {
    nameInput.addEventListener('input', () => {
      if (nameBtn) nameBtn.disabled = nameInput.value.trim().length < 2;
      if (nameError) nameError.style.display = 'none';
    });
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && nameInput.value.trim().length >= 2) nameBtn?.click();
    });
  }
  if (nameBtn) {
    nameBtn.addEventListener('click', async () => {
      const name = nameInput.value.trim();
      if (name.length < 2) return;
      nameBtn.textContent = '...';
      nameBtn.disabled = true;
      try {
        await updateUserProfile({ name });
        setSessionName(name);
      } catch (err) {
        if (nameError) { nameError.textContent = err.message; nameError.style.display = 'block'; }
        nameBtn.textContent = 'CONTINUE';
        nameBtn.disabled = false;
        return;
      }
      nameBtn.textContent = 'CONTINUE';
      finishAuth();
    });
  }

  function finishAuth() {
    // Capture the callback before closeAuthModal() clears it, and drop the
    // cancel handler so closing the modal doesn't read as a dismissal.
    const onSuccess = backdrop._onSuccess;
    backdrop._onCancel = null;
    closeAuthModal();
    if (onSuccess) onSuccess();
    else window.location.href = 'profile.html';
  }

  if (resendBtn) {
    resendBtn.addEventListener('click', async () => {
      const boxes = document.querySelectorAll('.otp-box');
      boxes.forEach(b => { b.value = ''; b.classList.remove('error', 'success'); });
      if (otpError) otpError.style.display = 'none';
      try {
        await requestOtp(currentEmail);
        startResendCountdown();
        if (boxes[0]) boxes[0].focus();
      } catch (err) {
        if (otpError) {
          otpError.textContent = err.message;
          otpError.style.display = 'block';
        }
      }
    });
  }

  /* Profile button wiring */
  const profileBtn = document.getElementById('profile-btn');
  if (profileBtn) {
    profileBtn.addEventListener('click', () => {
      if (isLoggedIn()) window.location.href = 'profile.html';
      else openAuthModal();
    });
  }
}

export {
  isLoggedIn, getUser, getToken, saveSession, setSessionName, logout,
  openAuthModal, closeAuthModal, initAuthModal, requireAuth,
  authFetch, getUserProfile, updateUserProfile,
  getUserAddresses, addUserAddress, updateUserAddress, deleteUserAddress,
};
