/* components.js — Loads partials into header/footer slots */

async function loadPartial(selector, url) {
  const el = document.querySelector(selector);
  if (!el) return;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load ${url}`);
    el.innerHTML = await res.text();
  } catch (e) {
    console.warn('Partial load failed:', e);
  }
}

async function initComponents() {
  await Promise.all([
    loadPartial('[data-partial="header"]', '/partials/header.html'),
    loadPartial('[data-partial="footer"]', '/partials/footer.html'),
    loadPartial('[data-partial="auth-modal"]', '/partials/auth-modal.html'),
  ]);

  /* Dynamically import modules that depend on DOM being ready */
  const { initMobileMenu } = await import('./mobile-menu.js');
  const { initAuthModal } = await import('./auth.js');
  const { initOTPInput } = await import('./otp-input.js');
  const { initReveal } = await import('./reveal.js');
  const { initDummyImages } = await import('./dummy-images.js');
  const { initBreadcrumbs } = await import('./breadcrumbs.js');
  const { mountSaleBanner } = await import('./sale.js');

  mountSaleBanner();
  initMobileMenu();
  initAuthModal();
  initOTPInput();

  highlightActiveNavLink();
  initScrollHeader();
  initReveal();
  initDummyImages();
  initBreadcrumbs();
  initNewsletter();
}

async function initNewsletter() {
  const form = document.querySelector('.footer__newsletter-form');
  if (!form) return;
  const { apiUrl } = await import('./config.js');
  // Replace the no-op onsubmit="return false" with a real handler.
  form.removeAttribute('onsubmit');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = form.querySelector('input[type=email]');
    const btn = form.querySelector('button[type=submit]');
    const email = (input?.value || '').trim();
    if (!email) return;
    if (btn) btn.disabled = true;
    try {
      const res = await fetch(apiUrl('/api/newsletter'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed');
      form.reset();
      if (input) { input.placeholder = '✓ Subscribed!'; }
    } catch (err) {
      if (input) { input.value = ''; input.placeholder = 'Try again'; }
    } finally {
      if (btn) btn.disabled = false;
    }
  });
}

function highlightActiveNavLink() {
  const path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.header__nav-link').forEach(link => {
    const href = link.getAttribute('href');
    if (href === path || (path === '' && href === 'index.html')) {
      link.classList.add('active');
    }
  });
}

function initScrollHeader() {
  const header = document.getElementById('site-header');
  if (!header) return;
  const threshold = 80;
  const onScroll = () => {
    header.classList.toggle('scrolled', window.scrollY > threshold);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

document.addEventListener('DOMContentLoaded', initComponents);
