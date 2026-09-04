/* tax.js — Per-product tax rates.
 *
 * Each product can carry its own `taxPercent` (set in the admin console);
 * anything without one is taxed at the store default. The rate is copied onto
 * the cart line when the item is added, so the cart can price itself without
 * re-fetching the catalogue.
 *
 * This mirrors the server's computeLineTax() in backend/server.js — the server
 * is authoritative and recomputes every total from the catalogue at checkout,
 * so keep the two in step.
 */

import { effectivePrice } from '/js/sale.js';

export const DEFAULT_TAX_PERCENT = 8;

// Product discounts only — the store-wide sale is part of the promo discount
// that gets allocated across lines below.
const NO_SALE = { live: false, percent: 0 };

// Mirrors the server's normalizeTaxPercent(): only null/undefined/'' mean "the
// admin set no rate", and those fall back to the store default. Coercing with
// Number() alone is wrong — Number(null) is 0, so a product with no rate set
// (the cart line stores taxPercent: null) would preview at 0% tax while the
// server charged the 8% default. A deliberate 0 is still honoured.
export function taxPercentFor(item) {
  const raw = item ? item.taxPercent : null;
  if (raw === null || raw === undefined || raw === '') return DEFAULT_TAX_PERCENT;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.min(100, n) : DEFAULT_TAX_PERCENT;
}

/* Tax for a cart, with each line charged at its own rate.
 *
 * `promoDiscount` is the order-level discount (winning sale or coupon, never
 * both) in rupees; it is spread across the lines in proportion to their share
 * of the subtotal so it lowers the taxable value of every item. Per-product
 * discounts are already netted out of the line amounts. */
export function computeCartTax(items, promoDiscount = 0) {
  const lines = (items || []).map((item) => ({
    amount: effectivePrice(item, NO_SALE) * (item.qty || 1),
    percent: taxPercentFor(item),
  })).filter((l) => l.amount > 0);

  const gross = lines.reduce((sum, l) => sum + l.amount, 0);
  if (gross <= 0) return 0;
  const disc = Math.max(0, Math.min(Number(promoDiscount) || 0, gross));

  return lines.reduce((sum, l) => {
    const taxable = l.amount - (disc * l.amount) / gross;
    return sum + Math.round((taxable * l.percent) / 100);
  }, 0);
}

/* Label for the tax row. A single rate across the cart names itself ("Tax
   (12%)"); a mix of rates can't, so it stays generic. */
export function taxRowLabel(items) {
  const rates = [...new Set((items || []).map(taxPercentFor))];
  return rates.length === 1 ? `Tax (${+rates[0].toFixed(2)}%)` : 'Tax';
}
