/* reveal.js — IntersectionObserver-based scroll reveal for sections and elements */

const REVEAL_SELECTORS = [
  /* Major page sections */
  'main > section',
  'main > div > section',
  'section',
  /* Headings */
  'h1', 'h2', 'h3',
  /* Cards */
  '.shop-card',
  '.workshop-card',
  '.category-card',
  '.profile-tile',
  '.contact-card',
  '.address-card',
  '.payment-row',
  '.cart-item',
  '.blog-card',
  '.stat-block',
  '.tile',
  /* Common content blocks */
  '.intro-grid',
  '.testimonials-grid',
  '.reads-grid',
  '.shop-grid',
  '.category-grid',
  '.workshop-zigzag > *',
  '.profile-tiles-grid > *',
  '.contact-cards-grid > *',
  '.stats-strip',
  '.promo-section',
  '.workshop-cta-bar',
  '.process-strip',
  '.product-layout',
  '.cart-layout',
  '.faq-list',
  /* Hero children for stagger */
  '.home-hero__title',
  '.home-hero__rule',
  /* Form blocks */
  '.contact-form',
];

const STAGGER_PARENTS = [
  '.shop-grid',
  '.category-grid',
  '.profile-tiles-grid',
  '.contact-cards-grid',
  '.reads-grid',
  '.workshop-zigzag',
  '.stats-strip',
  '.tile-grid',
];

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const SKIP_SELECTOR = '.home-hero, .home-hero *, .site-header, .site-header *, .site-footer, .site-footer *, .auth-modal-backdrop, .auth-modal-backdrop *, .mobile-nav, .mobile-nav *, .whatsapp-fab, .mobile-cta-bar, .mobile-summary-bar, .enquire-panel, .enquire-panel *';

function tagReveal(el, variant = 'up', delay = 0) {
  if (el.dataset.reveal) return;
  if (el.matches(SKIP_SELECTOR)) return;
  el.dataset.reveal = variant;
  if (delay) el.style.setProperty('--reveal-delay', `${delay}ms`);
}

function tagAll(root = document) {
  /* Tag staggered children first so they don't get overwritten */
  STAGGER_PARENTS.forEach(sel => {
    root.querySelectorAll(sel).forEach(parent => {
      [...parent.children].forEach((child, i) => {
        tagReveal(child, 'up', Math.min(i * 80, 600));
      });
    });
  });

  /* Tag everything else */
  REVEAL_SELECTORS.forEach(sel => {
    root.querySelectorAll(sel).forEach(el => tagReveal(el, 'up'));
  });
}

let observer = null;

function ensureObserver() {
  if (observer) return observer;
  observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.08,
    rootMargin: '0px 0px -40px 0px',
  });
  return observer;
}

function observeAll(root = document) {
  const obs = ensureObserver();
  root.querySelectorAll('[data-reveal]').forEach(el => {
    /* Skip elements already visible (above the fold on first paint) */
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.95 && rect.bottom > 0) {
      requestAnimationFrame(() => el.classList.add('is-visible'));
    } else {
      obs.observe(el);
    }
  });
}

export function initReveal() {
  if (prefersReducedMotion()) {
    /* Honour reduced motion: instantly mark all reveals visible */
    tagAll();
    document.querySelectorAll('[data-reveal]').forEach(el => el.classList.add('is-visible'));
    return;
  }

  tagAll();
  observeAll();

  /* Re-scan when new content is dynamically inserted (e.g. shop grid render) */
  const rescan = () => {
    tagAll();
    observeAll();
  };
  window.addEventListener('content-loaded', rescan);

  /* Watch DOM for big additions (shop grid render, wishlist, etc.) */
  const mo = new MutationObserver((muts) => {
    let added = false;
    muts.forEach(m => { if (m.addedNodes.length) added = true; });
    if (added) {
      clearTimeout(initReveal._t);
      initReveal._t = setTimeout(rescan, 100);
    }
  });
  mo.observe(document.body, { childList: true, subtree: true });
}
