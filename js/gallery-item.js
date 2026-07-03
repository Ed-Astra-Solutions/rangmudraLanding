/* gallery-item.js — Design detail page. Reads ?id=<id|slug>, renders the image
 * and metadata. On Express hosting the <head> is already server-rendered with
 * SEO meta; this fills the visible body (and titles on static hosting). Importing
 * gallery-mosaic.js auto-inits the "More from the gallery" [data-gallery-mosaic]. */

import { getGalleryItem } from '/js/data.js';
import '/js/gallery-mosaic.js';

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function init() {
  const id = new URLSearchParams(location.search).get('id')
    || location.pathname.split('/gallery/')[1];
  const wrap = document.getElementById('gallery-detail');
  const missing = document.getElementById('detail-missing');

  if (!id) { missing.hidden = false; return; }

  let item;
  try {
    item = await getGalleryItem(decodeURIComponent(id));
  } catch (_) { item = null; }

  if (!item) { missing.hidden = false; return; }

  const img = document.getElementById('detail-img');
  img.src = item.url;
  img.alt = item.alt || item.title;
  if (item.width) img.width = item.width;
  if (item.height) img.height = item.height;

  document.getElementById('detail-title').textContent = item.title;
  document.getElementById('detail-desc').textContent = item.description || '';

  const tags = item.tags || [];
  document.getElementById('detail-tags-eyebrow').textContent = tags.slice(0, 3).join(' · ');
  document.getElementById('detail-tags').innerHTML =
    tags.map((t) => `<span class="gallery-detail__tag">${esc(t)}</span>`).join('');

  // Fallback for static hosting where the server didn't inject <head> meta.
  if (!document.title || /Design Gallery — Rangmudra/.test(document.title)) {
    document.title = `${item.title} · Rangmudra`;
  }

  wrap.hidden = false;
}

init();
