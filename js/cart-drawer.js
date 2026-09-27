/* cart-drawer.js — the slide-in cart shown right after ADD TO CART.
 *
 *   import { openCartDrawer } from '/js/cart-drawer.js';
 *   addToCart(item); openCartDrawer();
 *
 * Lists what is in the cart (each line links back to its product page), the
 * subtotal after product discounts / a live sale, and two ways on:
 *   QUICK CHECKOUT → straight to the delivery-address step (which asks a guest
 *                    to sign in first)
 *   SHOP MORE      → back to the shop
 * plus a quieter "View full cart" for coupons and the full breakdown.
 *
 * Tax and delivery are left to checkout: delivery depends on the address.
 */

import { getCart, removeFromCart } from '/js/cart.js';
import { getSale, effectivePrice, itemPriceHTML, formatPrice } from '/js/sale.js';

let drawer = null;
let lastFocus = null;
let hideTimer = null;
let sale = null;

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// A product's id is its slug (both set from the slug when it is created), so
// the id alone is enough to link a cart line back to its page.
const productHref = (item) => `product.html?slug=${encodeURIComponent(item.id)}`;

function ensureDrawer() {
  if (drawer) return drawer;
  drawer = document.createElement('div');
  drawer.className = 'cart-drawer';
  drawer.hidden = true;
  drawer.innerHTML = `
    <div class="cart-drawer__scrim" data-drawer-close></div>
    <aside class="cart-drawer__panel" role="dialog" aria-modal="true" aria-labelledby="cart-drawer-title">
      <div class="cart-drawer__head">
        <div>
          <p class="cart-drawer__eyebrow" id="cart-drawer-status" aria-live="polite"></p>
          <h2 class="cart-drawer__title" id="cart-drawer-title">Your Cart</h2>
        </div>
        <button type="button" class="cart-drawer__close" data-drawer-close aria-label="Close cart">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="cart-drawer__items" id="cart-drawer-items"></div>
      <div class="cart-drawer__foot" id="cart-drawer-foot">
        <div class="cart-drawer__subtotal">
          <span>Subtotal</span>
          <span id="cart-drawer-subtotal"></span>
        </div>
        <p class="cart-drawer__note">Tax and delivery are worked out at checkout.</p>
        <a href="checkout-address.html" class="btn-primary cart-drawer__checkout">QUICK CHECKOUT →</a>
        <a href="shop.html" class="cart-drawer__shop-more">SHOP MORE</a>
        <a href="cart.html" class="cart-drawer__view-cart">View full cart &amp; apply a coupon</a>
      </div>
    </aside>`;
  document.body.appendChild(drawer);

  drawer.addEventListener('click', (e) => {
    if (e.target.closest('[data-drawer-close]')) { closeCartDrawer(); return; }
    const remove = e.target.closest('[data-remove-id]');
    if (remove) {
      // Pass the line's stored size as-is: removeFromCart matches it exactly,
      // and a line saved without a size would never equal ''.
      const line = getCart().find((i) => i.id === remove.dataset.removeId);
      if (line) removeFromCart(line.id, line.size);
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawer && !drawer.hidden) closeCartDrawer();
  });
  // Stay in step with the cart while open (a line removed here, or a sync).
  window.addEventListener('cart-updated', () => { if (!drawer.hidden) render(); });
  return drawer;
}

function render(status = '') {
  const items = getCart();
  const list = drawer.querySelector('#cart-drawer-items');
  const foot = drawer.querySelector('#cart-drawer-foot');
  drawer.querySelector('#cart-drawer-status').textContent = status;
  drawer.querySelector('#cart-drawer-title').textContent =
    items.length ? `Your Cart (${items.length})` : 'Your Cart';

  if (!items.length) {
    list.innerHTML = `
      <div class="cart-drawer__empty">
        <p>Your cart is empty.</p>
        <a href="shop.html" class="btn-primary">SHOP NOW</a>
      </div>`;
    foot.hidden = true;
    return;
  }
  foot.hidden = false;

  list.innerHTML = items.map((item) => `
    <div class="cart-drawer__item">
      <a class="cart-drawer__thumb" href="${productHref(item)}" aria-label="View ${esc(item.name)}">
        ${item.image ? `<img src="${esc(item.image)}" alt="" width="72" height="90" loading="lazy">` : ''}
      </a>
      <div class="cart-drawer__info">
        <a class="cart-drawer__name" href="${productHref(item)}">${esc(item.name)}</a>
        ${item.size ? `<p class="cart-drawer__size">Size ${esc(item.size)}</p>` : ''}
        <p class="cart-drawer__price">${itemPriceHTML(item, sale)}</p>
      </div>
      <button type="button" class="cart-drawer__remove" data-remove-id="${esc(item.id)}" aria-label="Remove ${esc(item.name)}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/></svg>
      </button>
    </div>`).join('');

  const subtotal = items.reduce((sum, item) => sum + effectivePrice(item, sale), 0);
  drawer.querySelector('#cart-drawer-subtotal').textContent = formatPrice(subtotal);
}

export async function openCartDrawer({ status = 'Added to your cart' } = {}) {
  ensureDrawer();
  try { sale = await getSale(); } catch (_) { sale = null; }
  render(status);
  // SHOP MORE returns to the shop listing the visitor came from (keeping its
  // category, filters and page) when there is one, otherwise the shop's top.
  try {
    const ref = new URL(document.referrer);
    if (ref.origin === location.origin && /\/shop\.html$/.test(ref.pathname)) {
      drawer.querySelector('.cart-drawer__shop-more').href = ref.pathname.slice(1) + ref.search;
    }
  } catch (_) { /* no referrer — keep shop.html */ }
  clearTimeout(hideTimer);
  lastFocus = document.activeElement;
  drawer.hidden = false;
  document.body.style.overflow = 'hidden';
  // Next frame, so the slide-in transition runs from the closed position.
  requestAnimationFrame(() => {
    drawer.classList.add('is-open');
    drawer.querySelector('.cart-drawer__checkout, .cart-drawer__empty .btn-primary')?.focus({ preventScroll: true });
  });
}

export function closeCartDrawer() {
  if (!drawer || drawer.hidden) return;
  drawer.classList.remove('is-open');
  document.body.style.overflow = '';
  hideTimer = setTimeout(() => { drawer.hidden = true; }, 300);
  if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus({ preventScroll: true });
}
