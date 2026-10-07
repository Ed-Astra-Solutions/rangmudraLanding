/* rich-text.js — the small formatting language admins type into long copy
 * (blog posts, the policy pages). It is a subset of Markdown:
 *
 *   ## Heading                 a section heading (own line)
 *   - item                     a bullet (consecutive lines make one list)
 *   **bold**   *italic*        inline emphasis
 *   [label](https://…)         a link
 *   name@example.com, https://…  bare email addresses and web links are linked
 *   ![alt | caption](url)      a photo or video on its own line (the blog syntax;
 *                              a video file's extension makes it a video)
 *
 * Everything is escaped before any formatting is applied, so nothing an admin
 * types can inject markup — only the tags below are ever produced.
 */

export function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const SAFE_URL = /^(https?:\/\/|mailto:|tel:|\/|#)/i;

/* Inline formatting for one run of text. Links are pulled out first so their
   URLs aren't touched by the emphasis or auto-link passes. */
export function inlineHTML(text) {
  const links = [];
  const stash = (html) => `\u0000${links.push(html) - 1}\u0000`;

  let out = escapeHtml(text)
    // [label](url)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, url) => {
      const href = url.replace(/&amp;/g, '&');
      if (!SAFE_URL.test(href)) return m;
      const external = /^https?:/i.test(href);
      return stash(`<a href="${escapeHtml(href)}"${external ? ' target="_blank" rel="noopener"' : ''}>${label}</a>`);
    })
    // bare web links
    .replace(/\bhttps?:\/\/[^\s<]+[^\s<.,;:!?)]/g, (url) => {
      const href = url.replace(/&amp;/g, '&');
      return stash(`<a href="${escapeHtml(href)}" target="_blank" rel="noopener">${url}</a>`);
    })
    // bare email addresses
    .replace(/\b[\w.+-]+@[\w-]+(\.[\w-]+)+\b/g, (email) => stash(`<a href="mailto:${email}">${email}</a>`));

  out = out
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, '$1<em>$2</em>');

  return out.replace(/\u0000(\d+)\u0000/g, (_, i) => links[Number(i)]);
}

const MEDIA_LINE = /^!\[(.*?)\]\((\S+?)\)$/;
const VIDEO_URL = /\.(mp4|webm|mov|ogg|ogv|m4v|mkv)(\?|#|$)/i;
const SAFE_SRC = /^(https?:\/\/|\/)/i;

/* A media block as a <figure>, the same markup the blog template draws. Only
   site-relative and http(s) sources are allowed, so a typed `javascript:` URL
   renders nothing. */
export function figureHTML(block) {
  if (!SAFE_SRC.test(block.src || '')) return '';
  const src = escapeHtml(block.src);
  const media = block.type === 'video'
    ? `<video src="${src}" controls playsinline preload="metadata"${block.alt ? ` aria-label="${escapeHtml(block.alt)}"` : ''}></video>`
    : `<img src="${src}" alt="${escapeHtml(block.alt || '')}" loading="lazy">`;
  const caption = block.caption ? `<figcaption>${inlineHTML(block.caption)}</figcaption>` : '';
  return `<figure>${media}${caption}</figure>`;
}

/* Split long copy into blocks: blank lines separate paragraphs, `## ` starts a
   heading, `- ` lines form a list, and an `![alt | caption](url)` line is a
   photo or video ({ type: 'img' | 'video', src, alt, caption }). */
export function textToBlocks(text) {
  const blocks = [];
  let para = [];
  let list = null;
  const flushPara = () => { if (para.length) blocks.push({ type: 'p', text: para.join(' ') }); para = []; };
  const flushList = () => { if (list) blocks.push(list); list = null; };

  String(text || '').replace(/\r\n/g, '\n').split('\n').forEach((raw) => {
    const line = raw.trim();
    if (!line) { flushPara(); flushList(); return; }
    const media = line.match(MEDIA_LINE);
    if (line.startsWith('## ')) {
      flushPara(); flushList();
      blocks.push({ type: 'h', text: line.slice(3).trim() });
    } else if (media) {
      flushPara(); flushList();
      const [alt = '', caption = ''] = media[1].split('|').map((s) => s.trim());
      blocks.push({ type: VIDEO_URL.test(media[2]) ? 'video' : 'img', src: media[2], alt, caption });
    } else if (/^[-•]\s+/.test(line)) {
      flushPara();
      if (!list) list = { type: 'ul', items: [] };
      list.items.push(line.replace(/^[-•]\s+/, ''));
    } else {
      flushList();
      para.push(line);
    }
  });
  flushPara();
  flushList();
  return blocks;
}
