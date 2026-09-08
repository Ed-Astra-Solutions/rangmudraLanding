/* testimonials.js — "What our patrons say", rendered from the shared patron list.
 *
 * One list (/api/testimonials, managed under Admin → Home → Patron testimonials)
 * feeds every band on the site, so a patron added once appears on the home page
 * and the About page both. Each patron carries their own photo or video, which
 * lives inside the slide — that is what makes the picture move with the quote
 * instead of sitting still beside a scrolling column.
 *
 * Mount point:
 *   <div data-testimonials>            — full carousel (home page)
 *   <div data-testimonials="1">        — show only the first N (About page)
 *
 * The media entry's `fit` and `position` are honoured, so an admin who framed a
 * photo in the crop tool gets that framing here, and a portrait photo and a
 * landscape video sit in the same fixed-ratio box without the layout jumping.
 */

import { apiUrl } from '/js/config.js';
import { mediaHTML, normalizeMedia } from '/js/media.js';

const STAR = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">'
  + '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';

function escapeHTML(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

async function loadPatrons() {
  try {
    const res = await fetch(apiUrl('/api/testimonials'), { cache: 'no-store' });
    if (res.ok) return await res.json();
  } catch (_) { /* fall through to the static snapshot */ }
  try {
    const res = await fetch('/data/testimonials.json', { cache: 'no-store' });
    if (res.ok) {
      const all = await res.json();
      return all.filter((t) => t.published !== false)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }
  } catch (_) { /* nothing to render */ }
  return [];
}

/* A patron's byline: "— Priya M., Bangalore", or just the name when no place. */
function byline(patron) {
  const name = String(patron.author || '').trim();
  const place = String(patron.location || '').trim();
  return `— ${[name, place].filter(Boolean).join(', ')}`;
}

function stars(n) {
  const count = Number.isFinite(Number(n)) ? Math.max(0, Math.min(5, Math.round(n))) : 5;
  if (!count) return '';
  return `<div class="stars" aria-label="${count} out of 5 stars">${STAR.repeat(count)}</div>`;
}

function slide(patron) {
  // media[] is the ordered list; the band shows the first entry. A patron with
  // no picture still renders — the quote column simply takes the full width.
  const m = normalizeMedia((patron.media && patron.media[0]) || patron.image);
  const picture = m
    ? `<div class="testimonial-slide__media">${mediaHTML(m, {
        className: 'testimonials-image',
        alt: `${patron.author || 'A patron'} — Rangmudra`,
        width: 480,
        height: 576,
        controls: m.type === 'video',
      })}</div>`
    : '';
  return `
    <div class="carousel__slide testimonial-slide" style="width:100%;flex-shrink:0;">
      <div class="testimonials-grid${m ? '' : ' testimonials-grid--no-media'}">
        <div>
          ${stars(patron.rating)}
          <blockquote class="testimonial-quote">${escapeHTML(patron.quote)}</blockquote>
          <p class="testimonial-author">${escapeHTML(byline(patron))}</p>
        </div>
        ${picture}
      </div>
    </div>`;
}

async function render() {
  const mounts = [...document.querySelectorAll('[data-testimonials]')];
  if (!mounts.length) return;

  const patrons = await loadPatrons();

  for (const mount of mounts) {
    const limit = Number(mount.getAttribute('data-testimonials')) || 0;
    const list = limit > 0 ? patrons.slice(0, limit) : patrons;

    if (!list.length) {
      // Nothing published — drop the whole band rather than leave an empty one.
      mount.closest('section')?.remove();
      continue;
    }

    mount.innerHTML = `
      <div class="carousel" aria-live="polite" aria-label="Patron testimonials">
        <div class="carousel__track">${list.map(slide).join('')}</div>
        ${list.length > 1 ? '<div class="carousel__dots" aria-label="Testimonial indicators"></div>' : ''}
      </div>`;
  }

  // The carousel module wires arrows/dots/swipe over whatever is in the DOM, so
  // it has to run after the slides exist rather than on DOMContentLoaded.
  if (patrons.length > 1) {
    const { initCarousels } = await import('/js/carousel.js');
    initCarousels();
  }
}

render();
