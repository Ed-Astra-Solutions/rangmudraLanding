/* content.js — Admin-editable page copy.
 *
 * Every editable string on the site is marked up as:
 *
 *   <h2 data-content="homepage.intro-heading">Immerse in the Spectrum…</h2>
 *
 * The text stays inline in the HTML so the page reads correctly with no JS and
 * on pure-static hosting; this module fetches /api/content (falling back to
 * /data/content.json) and overwrites it with whatever the admin has saved.
 *
 * Two extra hooks, for copy that isn't the element's own text:
 *   data-content-attr="href:footer.instagram-url"   — set an attribute
 *   data-content-lines="footer.address"             — newlines become <br>
 *
 * Values are always written as text, never as HTML, so nothing an admin types
 * can inject markup.
 */

import { apiUrl } from '/js/config.js';

let cached = null;
let pending = null;

async function loadContent() {
  if (cached) return cached;
  if (pending) return pending;
  pending = (async () => {
    try {
      const res = await fetch(apiUrl('/api/content'), { cache: 'no-store' });
      if (res.ok) cached = await res.json();
    } catch (_) { /* fall through to the static snapshot */ }
    if (!cached) {
      try {
        const res = await fetch('/data/content.json', { cache: 'no-store' });
        if (res.ok) cached = await res.json();
      } catch (_) { /* leave the inline copy alone */ }
    }
    return cached;
  })();
  return pending;
}

/* Look up "page.field". Returns undefined when the field isn't set, so callers
   can tell "no value" from "deliberately blank". */
function lookup(content, ref) {
  if (!content || !ref) return undefined;
  const dot = ref.indexOf('.');
  if (dot < 0) return undefined;
  const page = content[ref.slice(0, dot)];
  if (!page) return undefined;
  return page[ref.slice(dot + 1)];
}

/* Read one field. Exported so a page that renders copy from JS (the workshop
   category page builds its heading from ?cat=) can ask for a single string. */
export async function getContent(ref, fallback = '') {
  const value = lookup(await loadContent(), ref);
  return value === undefined ? fallback : value;
}

/* The whole map, for pages that need several fields at once. */
export async function getContentMap() {
  return (await loadContent()) || {};
}

function applyLines(el, value) {
  el.textContent = '';
  value.split('\n').forEach((line, i) => {
    if (i) el.appendChild(document.createElement('br'));
    el.appendChild(document.createTextNode(line));
  });
}

/* Exported and re-runnable: components.js calls it again once the header and
   footer partials have been injected, since those carry copy too. */
export async function applyContent(root = document) {
  const content = await loadContent();
  if (!content) return;

  root.querySelectorAll('[data-content]').forEach((el) => {
    const value = lookup(content, el.getAttribute('data-content'));
    if (value !== undefined) el.textContent = value;
  });

  root.querySelectorAll('[data-content-lines]').forEach((el) => {
    const value = lookup(content, el.getAttribute('data-content-lines'));
    if (value !== undefined) applyLines(el, value);
  });

  root.querySelectorAll('[data-content-attr]').forEach((el) => {
    // "href:footer.instagram-url" or "href:footer.x, title:footer.y"
    el.getAttribute('data-content-attr').split(',').forEach((pair) => {
      const [attr, ref] = pair.split(':').map((s) => s.trim());
      if (!attr || !ref) return;
      const value = lookup(content, ref);
      if (value === undefined || value === '') return;
      // Contact links carry the scheme in the markup, not in the copy field,
      // so the admin types a plain phone number or email address.
      const prefix = el.getAttribute('data-content-attr-prefix') || '';
      // A dialled number is typed with spaces for legibility; a tel: URI must
      // not carry them.
      const clean = prefix === 'tel:' ? value.replace(/[\s-]/g, '') : value;
      el.setAttribute(attr, prefix + clean);
    });
  });
}

applyContent();
