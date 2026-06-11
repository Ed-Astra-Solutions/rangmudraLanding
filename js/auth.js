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
    return { email: session.email, token: session.token };
  } catch {
    return null;
  }
}

function getToken() {
  const u = getUser();
  return u ? u.token : null;
}

function saveSession(email, token, expiresAt) {
  const exp = expiresAt || Date.now() + (30 * 24 * 60 * 60 * 1000);
  localStorage.setItem(SESSION_KEY, JSON.stringify({ email, token, expiresAt: exp }));
  window.dispatchEvent(new CustomEvent('auth-changed', { detail: { loggedIn: true } }));
}

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

function openAuthModal(onSuccess) {
  const backdrop = document.getElementById('auth-modal-backdrop');
  if (!backdrop) return;
  backdrop.classList.add('open');
  document.body.style.overflow = 'hidden';
  if (onSuccess) backdrop._onSuccess = onSuccess;
  showScreen('a');

  const emailInput = document.getElementById('email-input');
  if (emailInput) setTimeout(() => emailInput.focus(), 100);
}

function closeAuthModal() {
  const backdrop = document.getElementById('auth-modal-backdrop');
  if (!backdrop) return;
  backdrop.classList.remove('open');
  document.body.style.overflow = '';
  backdrop._onSuccess = null;
  showScreen('a');
}

function showScreen(screen) {
  const a = document.getElementById('auth-screen-a');
  const b = document.getElementById('auth-screen-b');
  if (!a || !b) return;
  if (screen === 'a') {
    a.style.display = 'block'; b.style.display = 'none';
  } else {
    a.style.display = 'none'; b.style.display = 'block';
  }
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
      saveSession(data.email, data.token, data.expiresAt);
      closeAuthModal();

      const onSuccess = backdrop._onSuccess;
      verifyBtn.textContent = 'VERIFY';
      verifyBtn.disabled = false;
      if (onSuccess) onSuccess();
      else window.location.href = 'profile.html';
    });
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

export { isLoggedIn, getUser, getToken, saveSession, logout, openAuthModal, closeAuthModal, initAuthModal };
