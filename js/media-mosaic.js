// media-mosaic.js — Mosaic layout for an ad-hoc list of media entries.
//
// Distinct from gallery-mosaic.js: that one renders the central design library
// (records with ids, linking to per-image SEO pages). This renders a media list
// that belongs to one record — a corporate workshop's photo wall, say — and
// opens entries in a lightbox rather than navigating away.
//
// Tiles are laid out on a dense 4-column grid with a repeating span rhythm, so
// a plain list of uploads reads as a composed wall instead of a uniform table.

import { normalizeMediaList } from '/js/media.js';

// Span pattern per tile index (col span, row span). The cycle length is 6 and
// coprime with the 4-column grid, so the wall doesn't visibly repeat.
const SPANS = [
  [2, 2], [1, 1], [1, 1],
  [1, 1], [1, 1], [2, 2],
];

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function tileHTML(m, i) {
  const [cs, rs] = SPANS[i % SPANS.length];
  const style = `grid-column:span ${cs};grid-row:span ${rs};`;
  const fit = `object-fit:${m.fit};object-position:${m.position};`;
  const inner = m.type === 'video'
    ? `<video class="media-mosaic__media" src="${esc(m.url)}#t=0.1" style="${fit}" muted playsinline preload="metadata"></video>
       <span class="media-mosaic__play" aria-hidden="true">▶</span>`
    : `<img class="media-mosaic__media" src="${esc(m.url)}" alt="${esc(m.alt)}" style="${fit}" loading="lazy">`;
  return `<button type="button" class="media-mosaic__tile" style="${style}" data-index="${i}"
            aria-label="Open ${m.type === 'video' ? 'video' : 'photo'} ${i + 1}">${inner}</button>`;
}

// One lightbox is shared by every mosaic on the page.
let lightbox = null;

function ensureLightbox() {
  if (lightbox) return lightbox;
  lightbox = document.createElement('div');
  lightbox.className = 'media-lightbox';
  lightbox.hidden = true;
  lightbox.setAttribute('role', 'dialog');
  lightbox.setAttribute('aria-modal', 'true');
  lightbox.setAttribute('aria-label', 'Media viewer');
  lightbox.innerHTML = `
    <button type="button" class="media-lightbox__close" aria-label="Close">×</button>
    <button type="button" class="media-lightbox__nav media-lightbox__nav--prev" aria-label="Previous">‹</button>
    <div class="media-lightbox__stage"></div>
    <button type="button" class="media-lightbox__nav media-lightbox__nav--next" aria-label="Next">›</button>
  `;
  document.body.appendChild(lightbox);
  return lightbox;
}

// Exported so a page with a single feature video (the workshop PLAY NOW block)
// can open the same viewer instead of rolling its own.
export function openMediaLightbox(raw, startIndex = 0) {
  const items = normalizeMediaList(raw);
  if (items.length) openLightbox(items, Math.min(startIndex, items.length - 1));
}

function openLightbox(items, startIndex) {
  const box = ensureLightbox();
  const stage = box.querySelector('.media-lightbox__stage');
  const opener = document.activeElement;
  let index = startIndex;

  const show = () => {
    const m = items[index];
    stage.innerHTML = m.type === 'video'
      ? `<video src="${esc(m.url)}" controls autoplay playsinline class="media-lightbox__media"></video>`
      : `<img src="${esc(m.url)}" alt="${esc(m.alt)}" class="media-lightbox__media">`;
  };
  const step = (delta) => { index = (index + delta + items.length) % items.length; show(); };
  const close = () => {
    box.hidden = true;
    stage.innerHTML = '';           // stops any playing video
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKey);
    // Send focus back to the tile that opened the viewer.
    if (opener && typeof opener.focus === 'function') opener.focus();
  };
  function onKey(e) {
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowRight') step(1);
    if (e.key === 'ArrowLeft') step(-1);
  }

  box.onclick = (e) => {
    if (e.target === box || e.target.closest('.media-lightbox__close')) close();
    else if (e.target.closest('.media-lightbox__nav--next')) step(1);
    else if (e.target.closest('.media-lightbox__nav--prev')) step(-1);
  };
  document.addEventListener('keydown', onKey);
  box.querySelectorAll('.media-lightbox__nav').forEach((b) => { b.hidden = items.length < 2; });
  box.hidden = false;
  document.body.style.overflow = 'hidden';   // don't scroll the page behind
  show();
  box.querySelector('.media-lightbox__close').focus();
}

// Render `raw` (media entries or bare URLs) into `el`. Returns the number of
// tiles drawn so the caller can hide an empty section.
export function renderMediaMosaic(el, raw) {
  if (!el) return 0;
  const items = normalizeMediaList(raw);
  el.innerHTML = items.map(tileHTML).join('');
  el.classList.add('media-mosaic');
  if (items.length) {
    el.onclick = (e) => {
      const tile = e.target.closest('.media-mosaic__tile');
      if (tile) openLightbox(items, Number(tile.dataset.index) || 0);
    };
  }
  return items.length;
}
