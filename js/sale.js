/* sale.js — Store-wide sale: fetch/cache the config, price helpers, top banner.
 *
 * A live sale is a single site-wide percentage off every product, applied
 * automatically (no code). The storefront strikes through each product's price
 * and shows a "Store sale" discount line at checkout. The authoritative money
 * math lives on the server (create-order) — these helpers are for display only.
 */

import { apiUrl } from '/js/config.js';

let salePromise = null;

// Compute "is this sale on right now" from the raw config (used for the static
// /data/sale.json fallback, which has no server-computed `live` flag).
function computeLive(sale) {
  if (!sale || sale.active !== true || !(Number(sale.percent) > 0)) return false;
  const now = Date.now();
  if (sale.startsAt && now < new Date(sale.startsAt).getTime()) return false;
  if (sale.endsAt && now > new Date(sale.endsAt).getTime()) return false;
  return true;
}

const INACTIVE = { live: false, percent: 0 };

// Fetch the sale once per page load; shared across every importer.
export function getSale() {
  if (salePromise) return salePromise;
  salePromise = (async () => {
    let sale = null;
    try {
      const res = await fetch(apiUrl('/api/sale'), { cache: 'no-store' });
      if (res.ok) sale = await res.json();
    } catch (_) { /* fall through to static file */ }
    if (!sale) {
      try {
        const res = await fetch('/data/sale.json', { cache: 'no-store' });
        if (res.ok) sale = await res.json();
      } catch (_) { return INACTIVE; }
    }
    if (!sale) return INACTIVE;
    if (typeof sale.live !== 'boolean') sale.live = computeLive(sale);
    return sale;
  })();
  return salePromise;
}

export function isSaleLive(sale) {
  return !!(sale && sale.live && Number(sale.percent) > 0);
}

// The per-unit discounted price when a sale is live (else the original).
export function salePrice(price, sale) {
  const p = Number(price) || 0;
  if (!isSaleLive(sale)) return p;
  let discounted = Math.round(p * (1 - sale.percent / 100));
  // Honour the per-order cap loosely at the unit level so struck prices never
  // imply a bigger cut than a capped order would actually give.
  if (sale.maxDiscount != null && sale.maxDiscount >= 0) {
    discounted = Math.max(discounted, p - sale.maxDiscount);
  }
  return Math.max(0, discounted);
}

export function formatPrice(n) {
  return '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
}

// Inner HTML for a price element. On sale: original struck through + sale price.
// Off sale: just the price. Drop this inside your existing price container.
export function priceHTML(price, sale) {
  const original = formatPrice(price);
  if (!isSaleLive(sale)) return original;
  return `<span class="price-original">${original}</span>` +
         `<span class="price-now">${formatPrice(salePrice(price, sale))}</span>`;
}

// A normalized per-product discount ({type:'percent'|'flat', value}) or null.
// Reads `.discount` off a product or cart item.
export function productDiscount(item) {
  const d = item && item.discount;
  if (!d || !(Number(d.value) > 0)) return null;
  return { type: d.type === 'flat' ? 'flat' : 'percent', value: Number(d.value) };
}

// The effective per-unit price for a product/cart item after promotions. A
// product's OWN discount takes priority over the store-wide sale — when a
// product is discounted, the sale is ignored for it (mirrors the server).
export function effectivePrice(item, sale) {
  const price = Number(item && item.price) || 0;
  const d = productDiscount(item);
  if (d) {
    const cut = d.type === 'flat' ? d.value : Math.round((price * d.value) / 100);
    return Math.max(0, price - cut);
  }
  return salePrice(price, sale);
}

// Inner HTML for a price element given a product/cart item. Strikes through the
// original when any discount (product-level or store sale) applies.
export function itemPriceHTML(item, sale) {
  const price = Number(item && item.price) || 0;
  const now = effectivePrice(item, sale);
  if (now >= price) return formatPrice(price);
  return `<span class="price-original">${formatPrice(price)}</span>` +
         `<span class="price-now">${formatPrice(now)}</span>`;
}

// Inject the announcement strip at the very top of the page when a sale is live.
// Sets `has-sale-banner` on <html> so the fixed header + layout offset by
// --banner-h (see components.css). Dismissable per sale text (sessionStorage).
export async function mountSaleBanner() {
  const sale = await getSale();
  if (!isSaleLive(sale)) return;

  const text = (sale.bannerText || '').trim() ||
    `${sale.label ? sale.label + ' — ' : ''}${sale.percent}% off everything. No code needed.`;

  const dismissKey = 'rangmudra_sale_dismissed';
  try {
    if (sessionStorage.getItem(dismissKey) === text) return;
  } catch (_) { /* sessionStorage may be unavailable */ }

  const banner = document.createElement('div');
  banner.className = 'sale-banner';
  banner.setAttribute('role', 'region');
  banner.setAttribute('aria-label', 'Store-wide sale');
  banner.innerHTML = `
    <a class="sale-banner__link" href="shop.html">
      <span class="sale-banner__dot" aria-hidden="true"></span>
      <span class="sale-banner__text">${text}</span>
      <span class="sale-banner__cta" aria-hidden="true">Shop the sale &rarr;</span>
    </a>
    <button class="sale-banner__close" type="button" aria-label="Dismiss sale banner">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>`;

  banner.querySelector('.sale-banner__close').addEventListener('click', () => {
    banner.remove();
    document.documentElement.classList.remove('has-sale-banner');
    try { sessionStorage.setItem(dismissKey, text); } catch (_) { /* ignore */ }
  });

  document.body.insertBefore(banner, document.body.firstChild);
  document.documentElement.classList.add('has-sale-banner');
}
