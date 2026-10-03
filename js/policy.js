/* policy.js — Privacy / Terms / Shipping pages, editable from the admin.
 *
 *   <main data-policy="privacy">
 *     <h1 data-policy-title>…</h1>
 *     <div data-policy-body>…inline copy…</div>
 *
 * The inline copy is what a JS-less or static render shows. When the admin has
 * saved the page (content `<page>.title` / `<page>.body`), the body is rebuilt
 * from that text using the formatting in rich-text.js.
 */

import { getContent } from '/js/content.js';
import { escapeHtml, figureHTML, inlineHTML, textToBlocks } from '/js/rich-text.js';

function blockHTML(block) {
  if (block.type === 'h') {
    return `<h2 class="h4-i color-sc-100 policy__heading">${escapeHtml(block.text)}</h2>`;
  }
  if (block.type === 'img' || block.type === 'video') return figureHTML(block);
  if (block.type === 'ul') {
    return `<ul class="h5-a color-sc-l3 policy__list">${block.items.map((i) => `<li>${inlineHTML(i)}</li>`).join('')}</ul>`;
  }
  return `<p class="h5-a color-sc-l3">${inlineHTML(block.text)}</p>`;
}

async function renderPolicy() {
  const root = document.querySelector('[data-policy]');
  if (!root) return;
  const page = root.getAttribute('data-policy');

  const title = await getContent(`${page}.title`, '');
  if (title) {
    const h1 = root.querySelector('[data-policy-title]');
    if (h1) h1.textContent = title;
    document.title = `${title} — RangMudra`;
  }

  const body = await getContent(`${page}.body`, '');
  const target = root.querySelector('[data-policy-body]');
  if (!body.trim() || !target) return;
  target.innerHTML = textToBlocks(body).map(blockHTML).join('');
}

renderPolicy();
