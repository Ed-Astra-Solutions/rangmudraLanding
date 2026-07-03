/* gallery.js — Design gallery index: search, tag filters, masonry, load-more. */

import { getGallery } from '/js/data.js';
import { renderMosaic } from '/js/gallery-mosaic.js';

const grid = document.getElementById('gallery-grid');
const emptyState = document.getElementById('gallery-empty');
const searchInput = document.getElementById('gallery-search');
const tagRow = document.getElementById('gallery-tags');
const countEl = document.getElementById('gallery-count');
const loadMoreBtn = document.getElementById('gallery-loadmore');
const loadMoreWrap = document.getElementById('gallery-loadmore-wrap');

const PAGE_SIZE = 24;
let state = { q: '', tag: '', page: 1, total: 0, loaded: 0 };
let allTags = [];

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderTagChips() {
  if (!tagRow) return;
  const chip = (label, value) =>
    `<button class="gallery-chip ${state.tag === value ? 'is-active' : ''}" data-tag="${esc(value)}">${esc(label)}</button>`;
  tagRow.innerHTML = [chip('All', ''), ...allTags.map((t) => chip(t, t))].join('');
  tagRow.querySelectorAll('.gallery-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.tag = btn.dataset.tag;
      reload();
    });
  });
}

function updateCount() {
  if (!countEl) return;
  countEl.textContent = state.total
    ? `${state.total} ${state.total === 1 ? 'image' : 'images'}`
    : '';
}

// Fetch page 1 fresh (on search/filter change).
async function reload() {
  state.page = 1;
  renderTagChips();
  try {
    const res = await getGallery({ q: state.q, tag: state.tag, page: 1, pageSize: PAGE_SIZE });
    state.total = res.total;
    state.loaded = res.items.length;
    // Only refresh the tag universe from an unfiltered response so chips don't
    // vanish as the user narrows down.
    if (!state.q && !state.tag && res.tags) { allTags = res.tags; renderTagChips(); }
    renderMosaic(grid, res.items);
    emptyState.hidden = res.items.length > 0;
    grid.hidden = res.items.length === 0;
    updateCount();
    loadMoreWrap.hidden = state.loaded >= state.total;
  } catch (e) {
    console.warn('Gallery load failed:', e);
    emptyState.hidden = false;
    grid.hidden = true;
  }
}

async function loadMore() {
  state.page += 1;
  try {
    const res = await getGallery({ q: state.q, tag: state.tag, page: state.page, pageSize: PAGE_SIZE });
    state.loaded += res.items.length;
    renderMosaic(grid, res.items, { append: true });
    loadMoreWrap.hidden = state.loaded >= state.total;
  } catch (e) {
    console.warn('Gallery load-more failed:', e);
  }
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

if (searchInput) {
  searchInput.addEventListener('input', debounce(() => {
    state.q = searchInput.value.trim();
    reload();
  }, 250));
}
if (loadMoreBtn) loadMoreBtn.addEventListener('click', loadMore);

// Seed tag universe once, then render.
(async () => {
  try {
    const seed = await getGallery({ pageSize: 1 });
    allTags = seed.tags || [];
  } catch (_) { /* reload() will still render */ }
  reload();
})();
