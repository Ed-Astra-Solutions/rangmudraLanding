/* quick-reads.js — Homepage "Quick Reads" strip.
 *
 * The three cards used to be hard-coded with fixed slugs, which meant a renamed
 * or deleted post sent the reader to the Blogs index instead of the article
 * they clicked. They are now built from the live blog list: one large card
 * (the featured post, else the newest) plus the next two.
 */

import { getBlogs } from '/js/data.js';

const grid = document.getElementById('quick-reads-grid');

function escapeHTML(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function byNewest(a, b) {
  return String(b.date || '').localeCompare(String(a.date || ''));
}

function card(post, { large }) {
  const href = `blog-detail.html?slug=${encodeURIComponent(post.slug)}`;
  const title = escapeHTML(post.title);
  const meta = escapeHTML([post.author && `By ${post.author}`, post.readTime].filter(Boolean).join(' · '));
  const img = escapeHTML(post.image || '/images/uploads/home-quickreads-large.jpg');
  const titleStyle = large ? '' : ' style="font-size:24px;line-height:32px;"';
  const read = large
    ? '<span class="btn-primary pill" style="height:44px;font-size:11px;padding-inline:24px;display:inline-flex;align-items:center;">Read</span>'
    : '';
  return `
    <a href="${href}" class="blog-card${large ? ' blog-card--large' : ''}" aria-label="Read: ${title}">
      <img src="${img}" alt="${title}" class="blog-card__image" loading="lazy"
           width="${large ? 720 : 480}" height="${large ? 540 : 300}">
      <div class="blog-card__overlay">
        <h3 class="blog-card__title"${titleStyle}>${title}</h3>
        <p class="blog-card__author">${meta}</p>
        ${read}
      </div>
    </a>`;
}

async function render() {
  if (!grid) return;
  let posts = [];
  try {
    posts = (await getBlogs()) || [];
  } catch (_) {
    posts = [];
  }
  if (!posts.length) {
    // Nothing published yet — drop the strip rather than showing empty frames.
    grid.closest('section')?.remove();
    return;
  }

  const sorted = [...posts].sort(byNewest);
  const lead = sorted.find((p) => p.featured) || sorted[0];
  const rest = sorted.filter((p) => p.slug !== lead.slug).slice(0, 2);

  grid.innerHTML = card(lead, { large: true })
    + `<div class="reads-grid__stacked">${rest.map((p) => card(p, { large: false })).join('')}</div>`;
}

render();
