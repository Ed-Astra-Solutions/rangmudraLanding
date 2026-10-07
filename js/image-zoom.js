/* image-zoom.js — Hover magnifier for a product photo, in the manner of a
   marketplace product page: a lens tracks the cursor over the photo and an
   enlarged view of the area under it fills a pane beside the photo.

   Desktop only (a fine pointer and room beside the photo); touch users get the
   full-screen viewer instead. The photo is letterboxed (object-fit: contain),
   so all the maths runs against the rectangle the picture actually occupies,
   not the element box. */

const MIN_ZOOM = 2;
const MAX_ZOOM = 4;
const GAP = 24;

const finePointer = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;

// Where the picture is drawn inside a contain-fitted <img>, in viewport px.
function renderedRect(img) {
  const box = img.getBoundingClientRect();
  const nw = img.naturalWidth;
  const nh = img.naturalHeight;
  if (!nw || !nh) return null;
  const scale = Math.min(box.width / nw, box.height / nh);
  const w = nw * scale;
  const h = nh * scale;
  return { left: box.left + (box.width - w) / 2, top: box.top + (box.height - h) / 2, width: w, height: h };
}

/* `container` wraps the photo; `getImg` returns the current <img> (the stage
   swaps elements when a thumbnail is picked, and holds a <video> for clips). */
export function attachHoverZoom(container, getImg) {
  const lens = document.createElement('div');
  lens.className = 'zoom-lens';
  lens.hidden = true;
  container.appendChild(lens);

  const pane = document.createElement('div');
  pane.className = 'zoom-pane';
  pane.hidden = true;
  pane.setAttribute('aria-hidden', 'true');
  document.body.appendChild(pane);

  const hide = () => { lens.hidden = true; pane.hidden = true; };

  function move(e) {
    const img = getImg();
    if (!finePointer() || !img || img.tagName !== 'IMG' || !img.complete) return hide();
    const r = renderedRect(img);
    const box = container.getBoundingClientRect();
    // The pane needs real room to the right of the photo, or it is pointless.
    const paneW = Math.min(box.width * 1.15, window.innerWidth - box.right - GAP * 2);
    if (!r || paneW < 280) return hide();
    if (e.clientX < r.left || e.clientX > r.left + r.width || e.clientY < r.top || e.clientY > r.top + r.height) {
      return hide();
    }

    const paneH = box.height;
    // Magnify toward the photo's real resolution, within sensible bounds.
    const zoom = Math.min(Math.max(img.naturalWidth / r.width, MIN_ZOOM), MAX_ZOOM);
    const lensW = Math.min(paneW / zoom, r.width);
    const lensH = Math.min(paneH / zoom, r.height);
    // Lens centred on the cursor, kept inside the picture.
    const x = Math.min(Math.max(e.clientX - lensW / 2, r.left), r.left + r.width - lensW);
    const y = Math.min(Math.max(e.clientY - lensH / 2, r.top), r.top + r.height - lensH);

    lens.style.width = `${lensW}px`;
    lens.style.height = `${lensH}px`;
    lens.style.transform = `translate(${x - box.left}px, ${y - box.top}px)`;

    pane.style.left = `${box.right + GAP}px`;
    pane.style.top = `${box.top}px`;
    pane.style.width = `${paneW}px`;
    pane.style.height = `${paneH}px`;
    const src = img.currentSrc || img.src;
    if (pane.dataset.src !== src) {
      pane.style.backgroundImage = `url("${src.replace(/"/g, '\\"')}")`;
      pane.dataset.src = src;
    }
    pane.style.backgroundSize = `${r.width * zoom}px ${r.height * zoom}px`;
    pane.style.backgroundPosition = `${-(x - r.left) * zoom}px ${-(y - r.top) * zoom}px`;

    lens.hidden = false;
    pane.hidden = false;
  }

  container.addEventListener('mousemove', move);
  container.addEventListener('mouseleave', hide);
  // The pane is fixed-position; anything that moves the photo invalidates it.
  window.addEventListener('scroll', hide, { passive: true });
  window.addEventListener('resize', hide);
  return { hide };
}
