/* blog-detail.js — Renders a single blog post from data/blogs.json,
   keyed by ?slug=... in the URL. Falls back to the first post if no slug. */

async function loadPost() {
  const slug = new URLSearchParams(window.location.search).get('slug');
  try {
    const res = await fetch('/data/blogs.json');
    if (!res.ok) throw new Error('Failed to load blogs.json');
    const posts = await res.json();
    const post = posts.find(p => p.slug === slug) || posts[0];
    return { post, posts };
  } catch (e) {
    console.warn('Could not load blogs.json:', e);
    return { post: null, posts: [] };
  }
}

function renderHero(post) {
  document.title = `${post.title} — Rangmudra`;
  document.getElementById('cover-img').src = post.image;
  document.getElementById('cover-img').alt = post.title;
  document.getElementById('cover-cat').textContent = post.category;
  document.getElementById('cover-title').textContent = post.title;
  document.getElementById('cover-meta').textContent =
    `By ${post.author} · ${post.readTime} · ${formatDate(post.date)}`;
}

function renderBody(post) {
  document.getElementById('article-excerpt').textContent = post.excerpt;
  const bodyEl = document.getElementById('article-body');
  bodyEl.innerHTML = (post.content || []).map(block => {
    if (block.type === 'p') return `<p>${escapeHtml(block.text)}</p>`;
    if (block.type === 'h') return `<h2 class="h3-i color-sc-100">${escapeHtml(block.text)}</h2>`;
    if (block.type === 'ul') {
      const items = block.items.map(i => `<li>${escapeHtml(i)}</li>`).join('');
      return `<ul>${items}</ul>`;
    }
    if (block.type === 'img') {
      return `<figure><img src="${block.src}" alt="${escapeAttr(block.alt || '')}" loading="lazy"></figure>`;
    }
    return '';
  }).join('');
}

function renderRelated(post, posts) {
  const related = posts
    .filter(p => p.slug !== post.slug)
    .sort((a, b) => (a.category === post.category ? -1 : 1))
    .slice(0, 3);
  const grid = document.getElementById('related-grid');
  grid.innerHTML = related.map(p => `
    <a href="blog-detail.html?slug=${encodeURIComponent(p.slug)}" class="blog-post-card" aria-label="Read: ${escapeAttr(p.title)}">
      <div class="blog-post-card__img-wrap">
        <img src="${p.image}" alt="${escapeAttr(p.title)}" class="blog-post-card__img" loading="lazy" width="600" height="400">
      </div>
      <div class="blog-post-card__body">
        <p class="h6-a color-pr-100" style="text-transform:uppercase;margin-bottom:8px;">${p.category}</p>
        <h3 class="h4-i color-sc-100" style="margin-bottom:12px;">${p.title}</h3>
        <p class="h6-a color-sc-l3" style="text-transform:uppercase;">${p.author} · ${p.readTime}</p>
      </div>
    </a>
  `).join('');
}

function wireShare(post) {
  const url = window.location.href;
  const text = encodeURIComponent(`${post.title} — Rangmudra Journal`);
  document.getElementById('share-twitter').href =
    `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${text}`;
  document.getElementById('share-facebook').href =
    `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
  /* Instagram has no share-by-URL; link to brand profile. */
  document.getElementById('share-instagram').href = 'https://instagram.com/';
  document.getElementById('share-copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(url);
      const btn = document.getElementById('share-copy');
      btn.setAttribute('aria-label', 'Link copied');
      btn.style.borderColor = 'var(--ac-100)';
      setTimeout(() => { btn.style.borderColor = ''; btn.setAttribute('aria-label', 'Copy link'); }, 1800);
    } catch {}
  });
}

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeAttr(s) {
  return String(s).replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

async function init() {
  const { post, posts } = await loadPost();
  if (!post) return;
  renderHero(post);
  renderBody(post);
  renderRelated(post, posts);
  wireShare(post);
}

document.addEventListener('DOMContentLoaded', init);
