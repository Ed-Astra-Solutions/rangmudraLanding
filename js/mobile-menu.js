/* mobile-menu.js — Hamburger menu */

export function initMobileMenu() {
  const hamburger = document.getElementById('hamburger-btn');
  const nav = document.getElementById('mobile-nav');
  const closeBtn = document.getElementById('mobile-nav-close');
  if (!hamburger || !nav) return;

  function open() {
    nav.classList.add('open');
    nav.setAttribute('aria-hidden', 'false');
    hamburger.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }

  function close() {
    nav.classList.remove('open');
    nav.setAttribute('aria-hidden', 'true');
    hamburger.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  hamburger.addEventListener('click', open);
  if (closeBtn) closeBtn.addEventListener('click', close);

  nav.querySelectorAll('.mobile-nav__link').forEach(link => {
    link.addEventListener('click', close);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('open')) close();
  });
}
