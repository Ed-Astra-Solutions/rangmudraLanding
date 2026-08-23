// On page load, fetch /api/sections (falls back to /data/sections.json for
// pure-static hosting) and swap src on every <img data-section="page.slot">.
// Also applies background-image to elements with data-section-bg="page.slot".
//
// A slot value is a media entry ({url,type,fit,position}) or, for records saved
// before the media model, a bare URL string. `fit`/`position` are set from the
// admin panel and decide how an oversized asset sits in its slot, so they are
// applied here rather than being baked into each page's CSS.

import { apiUrl } from '/js/config.js';
import { normalizeMedia, applyMedia } from '/js/media.js';

(async function applySections() {
  let sections = null;
  try {
    const res = await fetch(apiUrl('/api/sections'), { cache: 'no-store' });
    if (res.ok) sections = await res.json();
  } catch (_) { /* fall through */ }
  if (!sections) {
    try {
      const res = await fetch('/data/sections.json', { cache: 'no-store' });
      if (res.ok) sections = await res.json();
    } catch (_) { return; }
  }
  if (!sections) return;

  const resolve = (ref) => {
    if (!ref) return null;
    const [page, slot] = ref.split('.');
    const value = sections[page] && sections[page][slot];
    return value ? normalizeMedia(value) : null;
  };

  document.querySelectorAll('[data-section]').forEach((el) => {
    const m = resolve(el.getAttribute('data-section'));
    if (!m) return;
    const target = applyMedia(el, m, { controls: false });
    // Slots that offer a choice of shapes carry the chosen one; the page's CSS
    // ratio is the default for every slot that doesn't.
    if (m.aspect) target.style.aspectRatio = String(m.aspect);
  });

  // A background slot can't host a <video>, so a video-backed slot gets a muted
  // looping <video> layer behind the element's content instead.
  document.querySelectorAll('[data-section-bg]').forEach((el) => {
    const m = resolve(el.getAttribute('data-section-bg'));
    if (!m) return;
    if (m.type === 'video') {
      el.style.backgroundImage = '';
      if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
      const video = document.createElement('video');
      video.src = m.url;
      video.autoplay = true;
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      video.setAttribute('aria-hidden', 'true');
      video.className = 'section-bg-video';
      video.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:0;'
        + `object-fit:${m.fit};object-position:${m.position};`;
      el.prepend(video);
      return;
    }
    el.style.backgroundImage = `url("${m.url}")`;
    // 'contain' shows the whole photo inside the slot (letterboxed); 'cover'
    // fills the slot and crops to the chosen focal point.
    el.style.backgroundSize = m.fit === 'contain' ? 'contain' : 'cover';
    el.style.backgroundPosition = m.position;
    el.style.backgroundRepeat = 'no-repeat';
  });
})();
