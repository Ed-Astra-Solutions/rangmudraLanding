/**
 * Delivery pricing (client side).
 *
 * The studio ships by India Post Speed Post from PIN 560062. The fee depends on
 * the destination PIN and the weight of the parcel, so it cannot be a constant —
 * the server works it out (backend/shipping.js) from India Post's Post Office
 * API plus the published Speed Post tariff, and this module is just the fetch
 * and a little formatting.
 *
 * Everything here is a PREVIEW. create-order recomputes the fee from the same
 * server code before charging, so nothing shown here can change what is paid.
 */

import { apiUrl } from '/js/config.js';

// Last-resort fee, matching the server's DEFAULT_DELIVERY_FEE. Only the payment
// step uses it — by then an address has been chosen, so a fee has to be shown,
// and if the quote itself failed this is exactly what create-order will charge.
// The cart deliberately does NOT use it: before an address exists there is no
// destination to price, and showing a placeholder would only mean quoting a
// number we then have to revise.
export const FALLBACK_DELIVERY_FEE = 99;

/** Pull a 6-digit PIN out of a free-form address block. Last match wins. */
export function pincodeFromAddress(text) {
  const found = String(text || '').match(/\b[1-9][0-9]{5}\b/g);
  return found && found.length ? found[found.length - 1] : null;
}

/** The PIN to price a saved address against. */
export function addressPincode(address) {
  if (!address) return null;
  if (typeof address === 'string') return pincodeFromAddress(address);
  const explicit = String(address.pincode || '').trim();
  if (/^[1-9][0-9]{5}$/.test(explicit)) return explicit;
  return pincodeFromAddress([address.address, address.title].filter(Boolean).join('\n'));
}

// One quote per PIN + cart shape, for the life of the page. Re-rendering the
// summary (every coupon keystroke does) must not re-hit the network.
const cache = new Map();

/**
 * Quote a delivery. Resolves to the quote object, or `null` when the PIN is
 * unusable or the request fails — the cart then shows no fee at all, the payment
 * step falls back to FALLBACK_DELIVERY_FEE.
 */
export async function quoteDelivery(pincode, items) {
  const pin = String(pincode || '').trim();
  if (!/^[1-9][0-9]{5}$/.test(pin)) return null;

  const list = (items || []).map((i) => ({ id: i.id, qty: i.qty || 1 }));
  const key = pin + '|' + list.map((i) => i.id + 'x' + i.qty).sort().join(',');
  if (cache.has(key)) return cache.get(key);

  const promise = (async () => {
    try {
      const res = await fetch(apiUrl('/api/shipping/quote'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pincode: pin, items: list }),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  })();

  cache.set(key, promise);
  const quote = await promise;
  // Don't cache a failure — the next render should try again.
  if (!quote) cache.delete(key);
  return quote;
}

/** Grams as the customer would read them: "950 g" / "1.4 kg". */
function formatWeight(grams) {
  const g = Number(grams) || 0;
  return g >= 1000 ? (g / 1000).toFixed(g % 1000 === 0 ? 0 : 1) + ' kg' : g + ' g';
}

/**
 * The muted line under the delivery fee, e.g.
 * "India Post Speed Post to Bengaluru 560078 · 950 g · incl. 18% GST".
 */
export function deliveryNote(quote) {
  if (!quote) return 'Calculated once you add a delivery address.';
  const where = [quote.district, quote.pincode].filter(Boolean).join(' ');
  const parts = ['Speed Post to ' + where, formatWeight(quote.weightGrams), `incl. ${quote.gstPercent}% GST`];
  return parts.join(' · ');
}
