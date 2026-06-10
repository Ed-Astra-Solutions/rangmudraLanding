/* category-card.js — Workshop category card hover state */

export function initCategoryCards(container = document) {
  /* CSS handles the hover transition; this module adds keyboard accessibility */
  container.querySelectorAll('.category-card').forEach(card => {
    card.setAttribute('tabindex', '0');
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const href = card.getAttribute('href') || card.dataset.href;
        if (href) window.location.href = href;
      }
    });
  });
}
