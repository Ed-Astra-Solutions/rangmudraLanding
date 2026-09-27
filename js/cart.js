/* cart.js — Cart state module.
 *
 * localStorage is the working copy: it holds the cart for guests and acts as the
 * offline cache for signed-in shoppers, so the basket survives a reload and the
 * page never waits on the network to render. For a signed-in shopper it is
 * mirrored to their account (PUT /api/user/cart), and the two are merged at
 * sign-in so a guest basket carries into the account instead of being lost. */

import { isLoggedIn, authFetch } from './auth.js';

const CART_KEY = 'rangmudra_cart';

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

// The cart as this browser last saw it on the server. Syncing is a three-way
// merge against it, so a piece removed on another device — or bought there,
// which clears it from the account's cart server-side — is dropped here rather
// than resurrected from this browser's stale copy (a plain union of local and
// remote put bought pieces straight back into the cart as "out of stock").
const BASE_KEY = 'rangmudra_cart_base';

// null when this browser has never synced (it predates the base).
function getBase() {
  try {
    return JSON.parse(localStorage.getItem(BASE_KEY));
  } catch {
    return null;
  }
}

function setBase(items) {
  localStorage.setItem(BASE_KEY, JSON.stringify(items || []));
}

// Set while syncCart() is applying the server's copy, so the resulting
// 'cart-updated' doesn't immediately queue a push of what we just pulled.
let applyingRemote = false;
let pushTimer = null;
let pushPending = false;

function applyRemote(items) {
  applyingRemote = true;
  saveCart(items);
  applyingRemote = false;
}

// Merge by product id — the same rule the server applies to PUT {items, base}.
// Every piece is one-of-a-kind, so a product appears at most once whatever its
// size and its qty is always 1. A piece in `base` that is missing from one side
// was removed on that side and stays removed; a piece new to either side is
// kept. Where both hold a piece, local fields win — they came from the page the
// shopper is looking at, so the size, price and image are freshest. With an
// empty base (a guest basket meeting the account at sign-in) this is a union.
function mergeCarts(local, remote, base = []) {
  const baseIds = new Set(base.map(i => i && i.id));
  const localById = new Map();
  for (const item of local || []) if (item && item.id) localById.set(item.id, item);
  const merged = new Map();
  for (const item of remote || []) {
    if (!item || !item.id) continue;
    if (baseIds.has(item.id) && !localById.has(item.id)) continue; // removed here
    merged.set(item.id, { ...item, ...localById.get(item.id), qty: 1 });
  }
  for (const [id, item] of localById) {
    if (merged.has(id) || baseIds.has(id)) continue; // kept, or removed elsewhere
    merged.set(id, { ...item, qty: 1 });
  }
  return [...merged.values()];
}

async function pushCart({ keepalive = false } = {}) {
  if (!isLoggedIn()) return;
  pushPending = false;
  const sent = getCart();
  try {
    // The server merges against its stored copy using `base`, so a stale tab
    // can't overwrite a removal made on another device.
    const saved = await authFetch('/api/user/cart', {
      method: 'PUT',
      keepalive,
      body: JSON.stringify({ items: sent, base: getBase() || [] }),
    });
    if (!Array.isArray(saved)) return;
    setBase(saved);
    // Adopt the merged result unless the shopper changed the cart meanwhile
    // (that change has its own push queued).
    if (JSON.stringify(getCart()) === JSON.stringify(sent) && JSON.stringify(saved) !== JSON.stringify(sent)) {
      applyRemote(saved);
    }
  } catch {
    // Offline or the session expired — localStorage still holds the cart, and
    // the next change (or the next sync) will retry the push.
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
   both sides. Called on sign-in, on page load for a signed-in shopper, and when
   a tab comes back into view. `signIn` marks the first sync after signing in,
   when the local cart is a guest basket to carry into the account. */
let syncing = null;
function syncCart({ signIn = false } = {}) {
  if (!isLoggedIn()) return Promise.resolve(getCart());
  // Collapse overlapping calls (page load + auth-changed + visibilitychange).
  syncing = syncing || (async () => {
    let remote = [];
    try {
      remote = await authFetch('/api/user/cart');
    } catch {
      return getCart(); // Offline — keep using the local cache.
    }
    if (!Array.isArray(remote)) return getCart();
    const local = getCart();
    // No base yet: a guest basket at sign-in unions in; otherwise it's a copy
    // from before the base existed, so trust the server for what was removed.
    const base = getBase() || (signIn ? [] : local);
    const merged = mergeCarts(local, remote, base);
    setBase(remote);
    applyRemote(merged);
    // Only write back when the merge actually changed the account's cart.
    if (JSON.stringify(merged) !== JSON.stringify(remote)) await pushCart();
    return getCart();
  })().finally(() => { syncing = null; });
  return syncing;
}

window.addEventListener('auth-changed', (e) => {
  if (e.detail?.loggedIn) {
    syncCart({ signIn: true });
  } else {
    // The basket lives on the account now — leaving it behind would hand it to
    // whoever signs in next on this browser.
    setBase([]);
    applyRemote([]);
  }
});

// Another device may have changed (or checked out) the cart while this tab sat
// in the background.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && isLoggedIn() && !pushPending) syncCart();
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
