/* cart.js — Cart state module.
 *
 * localStorage is the working copy: it holds the cart for guests and acts as the
 * offline cache for signed-in shoppers, so the basket survives a reload and the
 * page never waits on the network to render. For a signed-in shopper it is
 * mirrored to their account (PUT /api/user/cart), and the two are merged at
 * sign-in so a guest basket carries into the account instead of being lost. */

import { isLoggedIn, authFetch } from './auth.js';

const CART_KEY = 'rangmudra_cart';
const MAX_QTY = 10;

function getCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) || [];
  } catch {
    return [];
  }
}

function saveCart(items) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent('cart-updated', { detail: { cart: items } }));
}

/* Every piece is one-of-a-kind — a single unit of stock — so the cart holds at
   most one line per product id (regardless of size) and never a qty above 1.
   Re-adding a piece that is already in the cart is a no-op, not an increment. */
function addToCart(item) {
  const cart = getCart();
  if (cart.some(i => i.id === item.id)) return;
  cart.push({ ...item, qty: 1 });
  saveCart(cart);
}

function removeFromCart(id, size) {
  const cart = getCart().filter(i => !(i.id === id && i.size === size));
  saveCart(cart);
}

/* Kept for callers that still adjust a line, but stock is one unit per piece:
   any qty above 0 stays 1, and 0 or less removes the line. */
function updateQty(id, size, qty) {
  const cart = getCart();
  const item = cart.find(i => i.id === id && i.size === size);
  if (item) {
    if (qty <= 0) {
      removeFromCart(id, size);
    } else {
      item.qty = 1;
      saveCart(cart);
    }
  }
}

function clearCart() {
  saveCart([]);
}

function getCartTotal() {
  return getCart().reduce((sum, item) => sum + (item.price * (item.qty || 1)), 0);
}

function getCartCount() {
  return getCart().reduce((sum, item) => sum + (item.qty || 1), 0);
}

function isInCart(id, size) {
  return getCart().some(i => i.id === id && i.size === size);
}

function updateCartBadge() {
  const badge = document.getElementById('cart-count');
  if (badge) {
    const count = getCartCount();
    badge.textContent = count;
    badge.style.display = count > 0 ? 'flex' : 'none';
  }
}

/* ---------- Server sync ---------- */

// Set while syncCart() is applying the server's copy, so the resulting
// 'cart-updated' doesn't immediately queue a push of what we just pulled.
let applyingRemote = false;
let pushTimer = null;
let pushPending = false;

// Merge two carts by (id, size). Quantity is the larger of the two rather than
// the sum, so re-running a sync can never inflate the basket. Local fields win —
// they came from the page the shopper is looking at, so prices and images are
// the freshest.
function mergeCarts(local, remote) {
  const merged = new Map();
  for (const item of remote || []) {
    if (!item || !item.id) continue;
    merged.set(item.id + '|' + (item.size || ''), { ...item, qty: item.qty || 1 });
  }
  for (const item of local || []) {
    if (!item || !item.id) continue;
    const key = item.id + '|' + (item.size || '');
    const existing = merged.get(key);
    const qty = Math.min(MAX_QTY, Math.max(item.qty || 1, existing?.qty || 0));
    merged.set(key, { ...existing, ...item, qty });
  }
  return [...merged.values()];
}

async function pushCart({ keepalive = false } = {}) {
  if (!isLoggedIn()) return;
  pushPending = false;
  try {
    await authFetch('/api/user/cart', {
      method: 'PUT',
      keepalive,
      body: JSON.stringify({ items: getCart() }),
    });
  } catch {
    // Offline or the session expired — localStorage still holds the cart, and
    // the next change (or the next sign-in) will retry the push.
    pushPending = true;
  }
}

function schedulePush() {
  if (!isLoggedIn() || applyingRemote) return;
  pushPending = true;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(pushCart, 600);
}

/* Pull the account's cart, merge the local one into it, and write the result to
   both sides. Called on sign-in and on page load for a signed-in shopper. */
async function syncCart() {
  if (!isLoggedIn()) return getCart();
  let remote = [];
  try {
    remote = await authFetch('/api/user/cart');
  } catch {
    return getCart(); // Offline — keep using the local cache.
  }
  const local = getCart();
  const merged = mergeCarts(local, remote);

  applyingRemote = true;
  saveCart(merged);
  applyingRemote = false;

  // Only write back when the merge actually added something to the account.
  if (JSON.stringify(merged) !== JSON.stringify(remote)) await pushCart();
  return merged;
}

window.addEventListener('auth-changed', (e) => {
  if (e.detail?.loggedIn) {
    syncCart();
  } else {
    // The basket lives on the account now — leaving it behind would hand it to
    // whoever signs in next on this browser.
    applyingRemote = true;
    saveCart([]);
    applyingRemote = false;
  }
});

window.addEventListener('cart-updated', schedulePush);

// A tab closing mid-debounce would otherwise drop the last change.
window.addEventListener('pagehide', () => {
  if (pushPending && isLoggedIn()) {
    clearTimeout(pushTimer);
    // keepalive lets the request outlive the page being torn down.
    pushCart({ keepalive: true });
  }
});

window.addEventListener('cart-updated', updateCartBadge);
// The header is fetch-injected by components.js, which finishes AFTER
// DOMContentLoaded — so this pass usually finds no badge yet. components.js
// calls updateCartBadge() again once the partials are in place.
document.addEventListener('DOMContentLoaded', updateCartBadge);

export { getCart, addToCart, removeFromCart, updateQty, clearCart, getCartTotal, getCartCount, isInCart, updateCartBadge, syncCart };
