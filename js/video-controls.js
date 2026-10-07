// video-controls.js — play/pause + expand buttons on decorative videos.
//
// Section slots, hero bands and the product process strip play their videos as
// silent looping "moving photographs" with no native controls. This gives each
// one a small control pair in its bottom-right corner: play/pause for the
// inline loop, and expand, which opens the clip in the shared lightbox with
// sound and full controls.
//
// Videos are picked up wherever and whenever they appear (applyMedia swaps
// <img> for <video> after the CMS loads), so pages don't have to opt in.

import { openMediaLightbox } from '/js/media-mosaic.js';

const PLAY = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="6 3 20 12 6 21 6 3"/></svg>';
const PAUSE = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/></svg>';
const EXPAND = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6"/><path d="m21 3-7 7"/><path d="m3 21 7-7"/><path d="M9 21H3v-6"/></svg>';

const chromes = new WeakMap();

// Players with native controls already have both; a video inside a link or
// button (gallery thumbnails, mosaic tiles) can't host more buttons and opens
// its own viewer anyway.
function wantsControls(video) {
  return !video.controls && !video.closest('button, a, .media-lightbox');
}

function attach(video) {
  if (chromes.has(video) || !wantsControls(video)) return;
  const host = video.parentElement;
  if (!host) return;
  if (getComputedStyle(host).position === 'static') host.style.position = 'relative';

  const chrome = document.createElement('div');
  chrome.className = 'video-chrome';
  chrome.innerHTML = `
    <button type="button" class="video-chrome__btn" data-video-toggle></button>
    <button type="button" class="video-chrome__btn" data-video-expand aria-label="Expand video">${EXPAND}</button>`;
  host.appendChild(chrome);
  chromes.set(video, chrome);

  const toggle = chrome.querySelector('[data-video-toggle]');
  const sync = () => {
    toggle.innerHTML = video.paused ? PLAY : PAUSE;
    toggle.setAttribute('aria-label', video.paused ? 'Play video' : 'Pause video');
  };
  sync();
  video.addEventListener('play', sync);
  video.addEventListener('pause', sync);

  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  });
  chrome.querySelector('[data-video-expand]').addEventListener('click', (e) => {
    e.stopPropagation();
    video.pause();
    openMediaLightbox([{ url: video.currentSrc || video.src, type: 'video' }]);
  });
}

function detach(video) {
  const chrome = chromes.get(video);
  if (!chrome) return;
  chrome.remove();
  chromes.delete(video);
}

function scan(node) {
  if (node.nodeType !== 1) return;
  if (node.tagName === 'VIDEO') attach(node);
  else node.querySelectorAll?.('video').forEach(attach);
}

function unscan(node) {
  if (node.nodeType !== 1) return;
  if (node.tagName === 'VIDEO') detach(node);
  else node.querySelectorAll?.('video').forEach(detach);
}

export function initVideoControls() {
  scan(document.body);
  new MutationObserver((records) => {
    records.forEach((r) => {
      r.removedNodes.forEach(unscan);
      r.addedNodes.forEach(scan);
    });
  }).observe(document.body, { childList: true, subtree: true });
}
