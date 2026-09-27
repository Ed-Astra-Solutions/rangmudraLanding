/* rich-text.js — the small formatting language admins type into long copy
 * (blog posts, the policy pages). It is a subset of Markdown:
 *
 *   ## Heading                 a section heading (own line)
 *   - item                     a bullet (consecutive lines make one list)
 *   **bold**   *italic*        inline emphasis
 *   [label](https://…)         a link
 *   name@example.com, https://…  bare email addresses and web links are linked
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

/* Split long copy into blocks: blank lines separate paragraphs, `## ` starts a
   heading, `- ` lines form a list. */
export function textToBlocks(text) {
  const blocks = [];
  let para = [];
  let list = null;
  const flushPara = () => { if (para.length) blocks.push({ type: 'p', text: para.join(' ') }); para = []; };
  const flushList = () => { if (list) blocks.push(list); list = null; };

  String(text || '').replace(/\r\n/g, '\n').split('\n').forEach((raw) => {
    const line = raw.trim();
    if (!line) { flushPara(); flushList(); return; }
    if (line.startsWith('## ')) {
      flushPara(); flushList();
      blocks.push({ type: 'h', text: line.slice(3).trim() });
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
