/* sustainability.js — the Sustainability page, edited in the admin under
 * Website pages → Sustainability.
 *
 *   sustainability.eyebrow / .intro   plain copy, applied by content.js
 *   sustainability.title              the cover heading (and the tab title)
 *   sustainability.body               long copy in the rich-text format, where
 *                                     an `![alt | caption](url)` line places a
 *                                     photo or video between sections
 *   sustainability.hero (section)     the cover image or video, via sections.js
 *
 * The page ships its copy inline, so it reads correctly without JS and on
 * static hosting; this replaces the body only when there is saved text.
 */

import { getContent } from '/js/content.js';
import { escapeHtml, figureHTML, inlineHTML, textToBlocks } from '/js/rich-text.js';

function blockHTML(block) {
  if (block.type === 'h') return `<h2 class="h3-i color-sc-100">${escapeHtml(block.text)}</h2>`;
  if (block.type === 'ul') return `<ul>${block.items.map((i) => `<li>${inlineHTML(i)}</li>`).join('')}</ul>`;
  if (block.type === 'img' || block.type === 'video') return figureHTML(block);
  return `<p>${inlineHTML(block.text)}</p>`;
}

async function render() {
  const title = await getContent('sustainability.title', '');
  if (title) {
    const h1 = document.querySelector('[data-sustain-title]');
    if (h1) h1.textContent = title;
    document.title = `${title} — RangMudra`;
  }

  const body = await getContent('sustainability.body', '');
  const target = document.querySelector('[data-sustain-body]');
  if (!body.trim() || !target) return;
  target.innerHTML = textToBlocks(body).map(blockHTML).join('');
}

render();
