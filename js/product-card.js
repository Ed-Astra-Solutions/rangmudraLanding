/* product-card.js — Hover caption-strip reveal + wishlist wiring */

import { toggleWishlist, isInWishlist } from './wishlist.js';

export function initProductCards(container = document) {
  container.querySelectorAll('.shop-card').forEach(card => {
    const wishlistBtn = card.querySelector('.shop-card__wishlist');
    const productId = card.dataset.productId;

    /* Sync wishlist state */
    if (wishlistBtn && productId) {
      if (isInWishlist(productId)) wishlistBtn.classList.add('active');

      wishlistBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const item = {
          id: productId,
          name: card.querySelector('.shop-card__name')?.textContent,
          price: parseInt(card.querySelector('.shop-card__price')?.textContent.replace(/[^\d]/g, '') || '0'),
          image: card.querySelector('.shop-card__image')?.src,
        };
        const added = toggleWishlist(item);
        wishlistBtn.classList.toggle('active', added);
      });
    }
  });

  /* IntersectionObserver for caption reveal on scroll */
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) e.target.classList.add('caption-visible');
      });
    }, { threshold: 0.5 });

    container.querySelectorAll('.product-card').forEach(card => observer.observe(card));
  }
}
