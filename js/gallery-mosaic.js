/* gallery-mosaic.js — Reusable masonry renderer for the design gallery.
 *
 * Two ways to use it:
 *   1. Import { renderMosaic } and drive it yourself (see gallery.js).
 *   2. Drop <div data-gallery-mosaic data-tags="indigo" data-limit="12"></div>
 *      on any page and call initGalleryMosaics() (auto-run on DOMContentLoaded).
 */

import { getGallery } from '/js/data.js';

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Build one masonry tile. Width/height set explicit attributes so the browser
// reserves the right aspect ratio in each column (no layout shift).
export function tileHTML(item) {
  const href = `gallery-item.html?id=${encodeURIComponent(item.id)}`;
  const dims = item.width && item.height ? `width="${item.width}" height="${item.height}"` : '';
  const tags = (item.tags || []).slice(0, 3).map((t) => esc(t)).join(' · ');
  return `
    <a class="gallery-tile" href="${href}" aria-label="${esc(item.title)}">
      <img class="gallery-tile__img" src="${esc(item.url)}" alt="${esc(item.alt || item.title)}"
           loading="lazy" ${dims}>
      <span class="gallery-tile__cap">
        <span class="gallery-tile__title">${esc(item.title)}</span>
        ${tags ? `<span class="gallery-tile__tags">${tags}</span>` : ''}
      </span>
    </a>`;
}

// Render (or append) items into a masonry container.
export function renderMosaic(el, items, { append = false } = {}) {
  if (!el) return;
  const markup = items.map(tileHTML).join('');
  if (append) el.insertAdjacentHTML('beforeend', markup);
  else el.innerHTML = markup;
}

// Auto-init any declarative [data-gallery-mosaic] embeds on the page.
export async function initGalleryMosaics() {
  const embeds = document.querySelectorAll('[data-gallery-mosaic]');
  for (const el of embeds) {
    const tag = el.dataset.tags || '';
    const limit = parseInt(el.dataset.limit, 10) || 12;
    try {
      const { items } = await getGallery({ tag, pageSize: limit });
      renderMosaic(el, items);
    } catch (e) {
      console.warn('Gallery mosaic failed:', e);
    }
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGalleryMosaics);
  } else {
    initGalleryMosaics();
  }
}
