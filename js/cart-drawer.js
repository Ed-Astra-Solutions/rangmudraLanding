/* cart-drawer.js — the slide-in cart shown right after ADD TO CART.
 *
 *   import { openCartDrawer } from '/js/cart-drawer.js';
 *   addToCart(item); openCartDrawer();
 *
 * Lists what is in the cart (each line links back to its product page), the
 * subtotal after product discounts / a live sale, and two ways on:
 *   QUICK CHECKOUT → signs a guest in first, then on to the delivery-address
 *                    step. Signing in merges the account's saved cart in, so
 *                    if that adds pieces the drawer stays open and says so,
 *                    and the next click goes on to checkout.
 *   SHOP MORE      → back to the shop
 * plus a quieter "View full cart" for the full breakdown. A coupon can be
 * applied right here; it is saved under the same key the cart page and the
 * payment step read, so it carries through checkout.
 *
 * Tax and delivery are left to checkout: delivery depends on the address.
 */

import { getCart, removeFromCart, signInForCheckout } from '/js/cart.js';
import { getSale, effectivePrice, itemPriceHTML, formatPrice } from '/js/sale.js';
import { apiUrl } from '/js/config.js';

const COUPON_KEY = 'rangmudra_coupon';
const NO_SALE = { live: false, percent: 0 };

let drawer = null;
// The applied coupon { code, discount }, or null. A preview only — the server
// re-validates it when the order is created.
let coupon = null;
let couponSeq = 0;
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
        <form class="coupon-input cart-drawer__coupon" id="cart-drawer-coupon-form" role="group" aria-label="Coupon code">
          <input type="text" class="coupon-input__field" id="cart-drawer-coupon" placeholder="Coupon code" aria-label="Enter coupon code" autocomplete="off">
          <button type="submit" class="coupon-input__apply">Apply</button>
        </form>
        <p class="cart-drawer__coupon-msg" id="cart-drawer-coupon-msg" aria-live="polite" hidden></p>
        <div class="cart-drawer__discount" id="cart-drawer-discount" hidden>
          <span id="cart-drawer-discount-label"></span>
          <span id="cart-drawer-discount-value"></span>
        </div>
        <div class="cart-drawer__subtotal">
          <span>Subtotal</span>
          <span id="cart-drawer-subtotal"></span>
        </div>
        <p class="cart-drawer__note">Tax and delivery are worked out at checkout.</p>
        <p class="cart-drawer__merge" id="cart-drawer-merge" role="status" hidden></p>
        <a href="checkout-address.html" class="btn-primary cart-drawer__checkout">QUICK CHECKOUT →</a>
        <a href="shop.html" class="cart-drawer__shop-more">SHOP MORE</a>
        <a href="cart.html" class="cart-drawer__view-cart">View full cart</a>
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
  drawer.querySelector('.cart-drawer__checkout').addEventListener('click', async (e) => {
    e.preventDefault();
    const added = await signInForCheckout();
    if (added === null) return; // dismissed the sign-in
    // Signing in closes the modal, which lets the page scroll again.
    if (!drawer.hidden) document.body.style.overflow = 'hidden';
    if (!added.length) { window.location.href = 'checkout-address.html'; return; }
    showMergeNotice(added);
  });
  drawer.querySelector('#cart-drawer-coupon-form').addEventListener('submit', (e) => {
    e.preventDefault();
    applyCoupon(drawer.querySelector('#cart-drawer-coupon').value);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawer && !drawer.hidden) closeCartDrawer();
  });
  // Stay in step with the cart while open (a line removed here, or a sync).
  // A removed line changes the subtotal, so the coupon is checked again.
  window.addEventListener('cart-updated', () => {
    if (drawer.hidden) return;
    render();
    if (coupon) applyCoupon(coupon.code, { quiet: true });
  });
  return drawer;
}

// Heads-up after sign-in pulled pieces saved on the account into the cart.
function showMergeNotice(added) {
  const names = added.map((i) => i.name).filter(Boolean);
  const list = names.length ? `: ${names.join(', ')}` : '';
  const el = drawer.querySelector('#cart-drawer-merge');
  el.textContent = added.length === 1
    ? `Heads-up — your account had 1 more piece saved in its cart, so it's been added${list}. Remove it here if you don't want it, or continue to check out.`
    : `Heads-up — your account had ${added.length} more pieces saved in its cart, so they've been added${list}. Remove any you don't want here, or continue to check out.`;
  el.hidden = false;
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

  renderTotals();
}

// Subtotal with the live sale vs. with the coupon — they never stack, and the
// better one wins (the sale takes ties), exactly as the cart page and the
// server work it out. Product discounts apply either way.
function totals() {
  const items = getCart();
  const qty = (i) => i.qty || 1;
  const saleSubtotal = items.reduce((sum, i) => sum + effectivePrice(i, sale) * qty(i), 0);
  const baseSubtotal = items.reduce((sum, i) => sum + effectivePrice(i, NO_SALE) * qty(i), 0);
  const couponSubtotal = coupon ? Math.max(0, baseSubtotal - coupon.discount) : Infinity;
  const couponWins = couponSubtotal < saleSubtotal;
  return { baseSubtotal, saleSubtotal, couponWins, subtotal: couponWins ? couponSubtotal : saleSubtotal };
}

function renderTotals() {
  const t = totals();
  const row = drawer.querySelector('#cart-drawer-discount');
  row.hidden = !t.couponWins;
  if (t.couponWins) {
    drawer.querySelector('#cart-drawer-discount-label').textContent = `Coupon (${coupon.code})`;
    drawer.querySelector('#cart-drawer-discount-value').textContent = '-' + formatPrice(coupon.discount);
  }
  drawer.querySelector('#cart-drawer-subtotal').textContent = formatPrice(t.subtotal);
}

function couponMessage(msg, ok) {
  const el = drawer.querySelector('#cart-drawer-coupon-msg');
  el.textContent = msg || '';
  el.hidden = !msg;
  el.classList.toggle('is-error', !ok);
}

// Check a code against the current cart and apply it. An empty code clears
// the coupon. `quiet` re-checks a stored code without an error for a code that
// simply no longer qualifies (it is dropped, the same as the cart page does).
async function applyCoupon(raw, { quiet = false } = {}) {
  const code = String(raw || '').trim().toUpperCase();
  const seq = ++couponSeq;
  if (!code) {
    coupon = null;
    try { localStorage.removeItem(COUPON_KEY); } catch (_) {}
    couponMessage('', true);
    renderTotals();
    return;
  }
  const { baseSubtotal } = totals();
  if (baseSubtotal <= 0) return;
  try {
    const res = await fetch(apiUrl('/api/checkout/apply-coupon'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, subtotal: baseSubtotal, itemCount: getCart().length }),
    });
    const data = await res.json().catch(() => ({}));
    if (seq !== couponSeq) return; // a newer apply already answered
    if (!res.ok) {
      coupon = null;
      try { localStorage.removeItem(COUPON_KEY); } catch (_) {}
      couponMessage(quiet ? '' : (data.error || 'Invalid coupon code'), false);
      renderTotals();
      return;
    }
    coupon = { code, discount: Number(data.discount) || 0 };
    try { localStorage.setItem(COUPON_KEY, code); } catch (_) {}
    drawer.querySelector('#cart-drawer-coupon').value = code;
    renderTotals();
    couponMessage(totals().couponWins
      ? `Code ${code} applied — you save ${formatPrice(coupon.discount)}`
      : `Code ${code} added, but your store sale saves more — we'll keep the sale price.`, true);
  } catch (_) {
    if (seq === couponSeq && !quiet) couponMessage('Could not check that code. Please try again.', false);
  }
}

export async function openCartDrawer({ status = 'Added to your cart' } = {}) {
  ensureDrawer();
  try { sale = await getSale(); } catch (_) { sale = null; }
  render(status);
  // Pick up a code applied earlier (here or on the cart page).
  let stored = null;
  try { stored = localStorage.getItem(COUPON_KEY); } catch (_) {}
  if (stored && getCart().length) applyCoupon(stored, { quiet: true });
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
  drawer.querySelector('#cart-drawer-merge').hidden = true;
  drawer.classList.remove('is-open');
  document.body.style.overflow = '';
  hideTimer = setTimeout(() => { drawer.hidden = true; }, 300);
  if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus({ preventScroll: true });
}
