/* dummy-images.js — Swap local placeholder SVGs to themed internet images.
   The original src is preserved on `data-placeholder` and used as onerror fallback,
   so the SVG files in /images stay intact and the page degrades cleanly offline. */

/* Loremflickr serves themed Creative-Commons photos that match the brand
   (block-print textiles, sarees, artisan workshops, eco printing). The `lock`
   parameter pins each placeholder to a specific photo so renders are stable. */
const LF = (tags, w, h, lock) =>
  `https://loremflickr.com/${w}/${h}/${tags}?lock=${lock}`;

const MAP = {
  /* Products — portrait 4:5 crops to match the shop grid */
  '/images/products/placeholder.svg':       LF('textile,fabric,handloom',     800, 1000, 100),
  '/images/products/ajrakh-corset-1.svg':   LF('saree,blockprint,fabric',     800, 1000, 101),
  '/images/products/ajrakh-corset-2.svg':   LF('blockprint,textile,indian',   800, 1000, 102),
  '/images/products/ajrakh-corset-3.svg':   LF('saree,handloom,red',          800, 1000, 103),
  '/images/products/flora-set-1.svg':       LF('floral,kurta,fabric',         800, 1000, 104),
  '/images/products/flora-set-2.svg':       LF('floral,textile,pattern',      800, 1000, 105),
  '/images/products/shiro-shirt-1.svg':     LF('linen,shirt,white',           800, 1000, 106),
  '/images/products/eco-dupatta-1.svg':     LF('scarf,dye,fabric',            800, 1000, 107),
  '/images/products/indigo-saree-1.svg':    LF('indigo,saree,blue',           800, 1000, 108),
  '/images/products/runner-1.svg':          LF('runner,textile,table',        800, 1000, 109),

  /* Workshops — taller portrait for category cards, wide for hero/banner */
  '/images/workshops/block-print-party.svg': LF('blockprint,workshop,artisan', 1200, 1500, 200),
  '/images/workshops/children.svg':          LF('children,art,workshop',       1200, 1500, 201),
  '/images/workshops/corporate-block.svg':   LF('team,workshop,studio',        1600, 1000, 202),
  '/images/workshops/curated-course.svg':    LF('art,class,students',          1200, 1500, 203),
  '/images/workshops/eco-print.svg':         LF('leaves,botanical,nature',     1200, 1500, 204),

  /* Textures / process imagery — block carving, dye prep, printing */
  '/images/textures/process-1.svg':         LF('carving,wood,artisan',        800, 1000, 300),
  '/images/textures/process-2.svg':         LF('dye,pigment,bowl',            800, 1000, 301),
  '/images/textures/process-3.svg':         LF('printing,fabric,hands',       800, 1000, 302),
  '/images/textures/placeholder.svg':       LF('textile,fabric,handloom',     800, 1000, 303),
};

function normalize(src) {
  if (!src) return '';
  try {
    const url = new URL(src, window.location.origin);
    return url.pathname;
  } catch {
    return src;
  }
}

function swapImage(img) {
  if (img.dataset.dummySwapped) return;
  const path = normalize(img.getAttribute('src'));
  const target = MAP[path];
  if (!target) return;
  img.dataset.placeholder = path;
  img.dataset.dummySwapped = '1';
  /* Preserve any pre-existing onerror, but ensure our fallback runs first. */
  const existing = img.getAttribute('onerror');
  img.setAttribute(
    'onerror',
    `this.onerror=null;this.src='${path}';${existing ? existing : ''}`
  );
  img.src = target;
}

function swapAll(root = document) {
  root.querySelectorAll('img[src]').forEach(swapImage);
}

export function initDummyImages() {
  swapAll();

  /* Catch dynamically rendered images (shop grid, cart line items, wishlist, etc.) */
  const observer = new MutationObserver(mutations => {
    for (const m of mutations) {
      m.addedNodes.forEach(node => {
        if (node.nodeType !== 1) return;
        if (node.tagName === 'IMG') swapImage(node);
        else if (node.querySelectorAll) swapAll(node);
      });
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
