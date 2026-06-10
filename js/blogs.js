/* blogs.js — Journal index page: featured post, search, category filter, grid. */

const grid = document.getElementById('blogs-grid');
const emptyState = document.getElementById('blogs-empty');
const filterRow = document.getElementById('blog-filter-row');
const searchInput = document.getElementById('blog-search');

let allPosts = [];
let activeCategory = 'All';
let searchQuery = '';

async function loadPosts() {
  try {
    const res = await fetch('/data/blogs.json');
    if (!res.ok) throw new Error('Failed to load blogs.json');
    allPosts = await res.json();
  } catch (e) {
    console.warn('Could not load blogs.json:', e);
    allPosts = [];
  }
}

function renderFeatured(post) {
  if (!post) return;
  const card = document.getElementById('featured-card');
  card.href = `blog-detail.html?slug=${encodeURIComponent(post.slug)}`;
  document.getElementById('featured-img').src = post.image;
  document.getElementById('featured-img').alt = post.title;
  document.getElementById('featured-cat').textContent = post.category;
  document.getElementById('featured-title').textContent = post.title;
  document.getElementById('featured-excerpt').textContent = post.excerpt;
  document.getElementById('featured-meta').textContent =
    `By ${post.author} · ${post.readTime} · ${formatDate(post.date)}`;
}

function renderFilters(posts) {
  const cats = ['All', ...new Set(posts.map(p => p.category))];
  filterRow.innerHTML = cats.map(c => `
    <button class="filter-pill ${c === activeCategory ? 'is-active' : ''}" data-cat="${c}" role="tab" aria-selected="${c === activeCategory}">
      ${c}
    </button>
  `).join('');
  filterRow.querySelectorAll('.filter-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      activeCategory = btn.dataset.cat;
      renderFilters(allPosts);
      renderGrid();
    });
  });
}

function renderGrid() {
  const matches = allPosts.filter(p => {
    const catOk = activeCategory === 'All' || p.category === activeCategory;
    const q = searchQuery.trim().toLowerCase();
    const qOk = !q || p.title.toLowerCase().includes(q) || p.excerpt.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
    return catOk && qOk;
  });

  if (!matches.length) {
    grid.innerHTML = '';
    emptyState.hidden = false;
    return;
  }
  emptyState.hidden = true;

  grid.innerHTML = matches.map(p => `
    <a href="blog-detail.html?slug=${encodeURIComponent(p.slug)}" class="blog-post-card" aria-label="Read: ${escapeAttr(p.title)}">
      <div class="blog-post-card__img-wrap">
        <img src="${p.image}" alt="${escapeAttr(p.title)}" class="blog-post-card__img" loading="lazy" width="600" height="400">
      </div>
      <div class="blog-post-card__body">
        <p class="h6-a color-pr-100" style="text-transform:uppercase;margin-bottom:8px;">${p.category}</p>
        <h3 class="h4-i color-sc-100" style="margin-bottom:12px;">${p.title}</h3>
        <p class="h5-a color-sc-l3" style="margin-bottom:16px;">${truncate(p.excerpt, 130)}</p>
        <p class="h6-a color-sc-l3" style="text-transform:uppercase;">${p.author} · ${p.readTime}</p>
      </div>
    </a>
  `).join('');
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

function truncate(s, n) {
  return s.length > n ? s.slice(0, n).trimEnd() + '…' : s;
}

function escapeAttr(s) {
  return String(s).replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

async function init() {
  await loadPosts();
  const featured = allPosts.find(p => p.featured) || allPosts[0];
  renderFeatured(featured);
  renderFilters(allPosts);
  renderGrid();

  searchInput?.addEventListener('input', e => {
    searchQuery = e.target.value;
    renderGrid();
  });
}

document.addEventListener('DOMContentLoaded', init);
