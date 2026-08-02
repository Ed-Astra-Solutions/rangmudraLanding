// media.js — one vocabulary for every photo/video the CMS can point at.
//
// A media entry is `{ url, type:'image'|'video', fit:'cover'|'contain', position:'x% y%' }`.
// Records written before the media model (and the static /data/*.json snapshots
// used on pure-static hosting) store bare URL strings, so every helper here
// accepts either shape and always hands back the object form.
//
//   fit      — 'cover' fills the slot and crops the overflow; 'contain' fits the
//              whole asset inside the slot, letterboxing the leftover space.
//   position — the focal point kept in frame when 'cover' crops. Set from the
//              admin panel so an oversized photo can be re-framed without a
//              re-upload.

const VIDEO_URL_RE = /\.(mp4|webm|mov|ogg|ogv|mkv)(\?|#|$)/i;

export function isVideoUrl(url) {
  return VIDEO_URL_RE.test(String(url || ''));
}

// Normalize one entry. Returns null for empty/absent values so callers can
// `.filter(Boolean)` a sparse list.
export function normalizeMedia(raw) {
  if (!raw) return null;
  const o = typeof raw === 'string' ? { url: raw } : raw;
  const url = String(o.url || '').trim();
  if (!url) return null;
  return {
    url,
    type: o.type === 'video' || (!o.type && isVideoUrl(url)) ? 'video' : 'image',
    fit: o.fit === 'contain' ? 'contain' : 'cover',
    position: o.position || '50% 50%',
    alt: o.alt || '',
  };
}

export function normalizeMediaList(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeMedia).filter(Boolean);
}

// The ordered gallery for a product or workshop. Prefers the `media` array and
// falls back to the legacy single-field/`images` shape, so a record that has
// not been re-saved since the media model landed still renders.
export function entityMedia(entity, legacyKey = 'images') {
  if (!entity) return [];
  if (Array.isArray(entity.media) && entity.media.length) return normalizeMediaList(entity.media);
  const legacy = entity[legacyKey];
  return normalizeMediaList(Array.isArray(legacy) ? legacy : (legacy ? [legacy] : []));
}

// The URL to use wherever a single still is needed (cards, cart lines, OG tags).
// Videos are skipped — a <video> poster is not a substitute for a product photo.
export function primaryImage(entity, legacyKey = 'images') {
  const first = entityMedia(entity, legacyKey).find((m) => m.type === 'image');
  return first ? first.url : '';
}

function escapeAttr(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Render an entry as markup. Videos get the inline-playback attributes mobile
// Safari needs (`playsinline` + `muted`, or iOS takes the video fullscreen).
export function mediaHTML(raw, opts = {}) {
  const m = normalizeMedia(raw);
  if (!m) return '';
  const {
    className = '', alt = '', width, height, eager = false, controls = true, loop = false,
  } = opts;
  const style = `object-fit:${m.fit};object-position:${m.position};`;
  const dims = `${width ? ` width="${width}"` : ''}${height ? ` height="${height}"` : ''}`;
  if (m.type === 'video') {
    return `<video class="${escapeAttr(className)}" src="${escapeAttr(m.url)}" style="${style}"${dims}`
      + `${controls ? ' controls' : ''}${loop ? ' loop autoplay muted' : ''} playsinline muted`
      + ` preload="${eager ? 'auto' : 'metadata'}"></video>`;
  }
  return `<img class="${escapeAttr(className)}" src="${escapeAttr(m.url)}" alt="${escapeAttr(m.alt || alt)}"`
    + ` style="${style}"${dims} loading="${eager ? 'eager' : 'lazy'}"${eager ? ' fetchpriority="high"' : ''}>`;
}

// Point an existing element at a media entry, swapping the tag when the type
// changes (an <img> slot that is now a video, or vice versa). Returns the
// element actually in the DOM afterwards — it may be a replacement node.
export function applyMedia(el, raw, opts = {}) {
  const m = normalizeMedia(raw);
  if (!el || !m) return el;
  // Product and workshop imagery is never auto-cropped: the caller passes
  // fit:'contain' so the whole photo is shown, letterboxed by the CSS backdrop.
  // A stored `position` still means something under 'contain' (it aligns the
  // letterboxed image), so it is only discarded when the caller's override is
  // what changed the fit — a focal point chosen for a crop is meaningless once
  // nothing is being cropped.
  const fit = opts.fit || m.fit;
  const fitOverridden = !!opts.fit && opts.fit !== m.fit;
  const wantVideo = m.type === 'video';
  const isVideo = el.tagName === 'VIDEO';
  let target = el;
  if (wantVideo !== isVideo) {
    target = document.createElement(wantVideo ? 'video' : 'img');
    // Carry every authored attribute across — id, class, width/height (so the
    // reserved box survives and nothing shifts), data-section, data-reveal,
    // aria-*. Only the attributes this function owns are left off, plus `alt`
    // when the replacement is a <video>, where it isn't valid.
    const OWNED = new Set(['src', 'style', 'loading', 'fetchpriority', 'decoding',
      'controls', 'autoplay', 'loop', 'muted', 'playsinline', 'preload', 'poster']);
    Array.from(el.attributes).forEach(({ name, value }) => {
      if (OWNED.has(name)) return;
      if (name === 'alt' && wantVideo) return;
      target.setAttribute(name, value);
    });
    if (wantVideo) {
      target.controls = opts.controls !== false;
      target.playsInline = true;
      target.muted = true;
      target.preload = 'metadata';
      // A slot with no controls is decorative (a hero band, a section image), so
      // it behaves like a moving photograph rather than a player.
      if (opts.controls === false) {
        target.autoplay = true;
        target.loop = true;
      }
    } else {
      target.alt = el.alt || m.alt || '';
      target.loading = el.loading || 'lazy';
    }
    el.replaceWith(target);
  }
  target.src = m.url;
  target.style.objectFit = fit;
  target.style.objectPosition = fitOverridden ? '50% 50%' : m.position;
  return target;
}
