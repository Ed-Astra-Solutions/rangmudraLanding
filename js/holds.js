/* Checkout holds on one-of-a-kind pieces.
 *
 * While a shopper is paying, the server holds each piece in their order so no
 * one else can check it out (like a table booking); the catalogue reports it
 * as `reservedUntil`. This browser remembers the holds it took itself, so a
 * shopper who steps back to their cart mid-payment isn't told their own piece
 * is taken — the server lets them restart checkout on it.
 */

const MY_HOLD_KEY = 'rangmudra_my_hold';

export function rememberMyHold(productIds, until) {
  try { localStorage.setItem(MY_HOLD_KEY, JSON.stringify({ ids: productIds, until })); } catch (_) {}
}

export function forgetMyHold() {
  try { localStorage.removeItem(MY_HOLD_KEY); } catch (_) {}
}

function myHeldIds() {
  try {
    const h = JSON.parse(localStorage.getItem(MY_HOLD_KEY) || 'null');
    if (h && new Date(h.until) > new Date()) return new Set(h.ids || []);
  } catch (_) {}
  return new Set();
}

/* The Date another shopper's hold on this product ends, or null when the
   piece is free (or held by this browser). */
export function heldUntil(product) {
  if (!product || !product.reservedUntil || product.available === false) return null;
  const until = new Date(product.reservedUntil);
  if (!(until > new Date()) || myHeldIds().has(product.id)) return null;
  return until;
}

export function holdTime(until) {
  return until.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}
