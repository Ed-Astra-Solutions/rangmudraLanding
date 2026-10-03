/* brand.js — sets every visible mention of the studio's name as the brand
   mark: <b class="brand-name">RangMudra</b> (see .brand-name in tokens.css).

   Static markup already carries the <b>; this covers copy that arrives later —
   admin-edited content, partials, blog/product text rendered from data — by
   rewriting text nodes on the first pass and then as the DOM changes. */

const NAME = 'RangMudra';
// Whole word only, so handles and addresses (rangmudra_bengaluru,
// rangmudrabengaluru@gmail.com) are left alone.
const PATTERN = /\brangmudra\b/gi;
const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'OPTION', 'TITLE', 'svg']);

function skipped(node) {
  for (let el = node.parentElement; el; el = el.parentElement) {
    if (SKIP.has(el.tagName) || el.classList.contains('brand-name') || el.isContentEditable) return true;
  }
  return false;
}

function wrapTextNode(node) {
  const text = node.nodeValue;
  PATTERN.lastIndex = 0;
  if (!PATTERN.test(text) || skipped(node)) return;

  const frag = document.createDocumentFragment();
  let last = 0;
  text.replace(PATTERN, (match, offset) => {
    if (offset > last) frag.appendChild(document.createTextNode(text.slice(last, offset)));
    const b = document.createElement('b');
    b.className = 'brand-name';
    b.textContent = NAME;
    frag.appendChild(b);
    last = offset + match.length;
    return match;
  });
  if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
  node.replaceWith(frag);
}

export function brandify(root = document.body) {
  if (!root) return;
  if (root.nodeType === Node.TEXT_NODE) { wrapTextNode(root); return; }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(wrapTextNode);
}

export function watchBrand() {
  brandify();
  new MutationObserver((records) => {
    records.forEach((r) => {
      if (r.type === 'characterData') wrapTextNode(r.target);
      else r.addedNodes.forEach((n) => brandify(n));
    });
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
}
