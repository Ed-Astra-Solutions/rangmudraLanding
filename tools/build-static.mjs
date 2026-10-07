// Builds the copy of the public site that GitHub Pages serves.
//
// The pages in this repo fill themselves in from the API when they load. Search
// engines and link previews do best when that content is already in the HTML,
// so this script opens every public page in headless Chrome against the live
// API, waits for it to render, and saves the finished markup — with a proper
// title, description, canonical URL and structured data for that page.
// Products, workshops, posts and gallery pieces each get their own address
// (/product/<slug>/ …). The page scripts still run in the visitor's browser
// and refresh everything from the API, so admin edits show up immediately;
// the saved HTML catches up on the next build (the workflow rebuilds daily).
//
//   cd tools && npm install && node build-static.mjs
//
// Env: API_BASE (default https://api.rangmudra.com), SITE_URL (default
// https://rangmudra.com), CHROME_PATH (default: system Chrome), OUT (default
// ../_site).

import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const OUT = path.resolve(process.env.OUT || path.join(ROOT, '_site'));
const API = (process.env.API_BASE || 'https://api.rangmudra.com').replace(/\/$/, '');
const SITE = (process.env.SITE_URL || 'https://rangmudra.com').replace(/\/$/, '');
const CHROME = process.env.CHROME_PATH || (process.platform === 'darwin'
  ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  : '/usr/bin/google-chrome');
const GOOGLE_VERIFICATION = 'google24572315a08bb058.html';

const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
const SKIP_COPY = new Set(['.git', '.github', 'tools', '_site', 'node_modules', 'README.md', '.DS_Store']);

/* ── Data ───────────────────────────────────────────────────────────────── */

const apiCache = new Map();
async function api(pathAndQuery) {
  if (!apiCache.has(pathAndQuery)) {
    apiCache.set(pathAndQuery, (async () => {
      const res = await fetch(API + pathAndQuery, { headers: { 'user-agent': 'RangMudra site build' } });
      const body = Buffer.from(await res.arrayBuffer());
      return { status: res.status, type: res.headers.get('content-type') || 'application/json', body };
    })());
  }
  return apiCache.get(pathAndQuery);
}
async function apiJson(p) {
  const r = await api(p);
  if (r.status !== 200) throw new Error(`${p} → HTTP ${r.status}`);
  return JSON.parse(r.body.toString());
}

/* ── Text helpers ───────────────────────────────────────────────────────── */

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
// Cut at a word boundary so a description never ends mid-word.
function clip(text, max = 158) {
  const t = clean(text);
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 30)).replace(/[,;:\-–—]$/, '')}…`;
}
const firstSentence = (s) => {
  const t = (clean(s).match(/^.+?[.!?](\s|$)/) || [clean(s)])[0].trim();
  return t && !/[.!?]$/.test(t) ? `${t}.` : t;
};
// "Name | Eco Printed Men's Wear | RangMudra", without repeating a print type
// the name already carries, and without the category once the title is long.
function productTitle(name, kind, cat) {
  const n = clean(name);
  const k = new RegExp(kind.split(' ')[0], 'i').test(n) ? '' : kind;
  const full = [k, cat].filter(Boolean).join(' ');
  const mid = full && n.length + full.length <= 45 ? full : (k || cat);
  return mid && n.length + mid.length <= 50 ? `${n} | ${mid} | RangMudra` : `${n} | RangMudra`;
}
const titleCase = (s) => clean(s).toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
const rupees = (n) => `₹${Number(n).toLocaleString('en-IN')}`;
const imagesOf = (rec) => (rec.media || [])
  .map((m) => (typeof m === 'string' ? { url: m, type: /\.(mp4|mov|webm)$/i.test(m) ? 'video' : 'image' } : m))
  .filter((m) => m && m.url && m.type !== 'video')
  .map((m) => m.url)
  .concat(Array.isArray(rec.images) ? rec.images : [], rec.image ? [rec.image] : [])
  .filter((u, i, a) => u && a.indexOf(u) === i);
const abs = (u) => (!u ? '' : /^https?:/i.test(u) ? u : `${SITE}${u.startsWith('/') ? '' : '/'}${u}`);

/* ── Structured data ────────────────────────────────────────────────────── */

const ORG_ID = `${SITE}/#organization`;
const WEBSITE_ID = `${SITE}/#website`;

function organization(content) {
  const f = content.footer || {};
  return {
    '@type': ['LocalBusiness', 'Organization'],
    '@id': ORG_ID,
    name: 'RangMudra',
    url: `${SITE}/`,
    logo: `${SITE}/images/logo/rangmudra-logo-192.png`,
    image: `${SITE}/images/logo/rangmudra-logo-192.png`,
    description: 'Hand block printing and eco printing studio in Bengaluru. Handmade clothing, sarees, dupattas and home textiles, plus printing workshops for individuals, schools and companies.',
    email: f.email || 'rangmudrabengaluru@gmail.com',
    telephone: '+91-89514-80256',
    priceRange: '₹₹',
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Workstation 2, Shankaraa Foundation, Kanakapura Main Road, next to Doddakalasandra Metro Station',
      addressLocality: 'Bengaluru',
      addressRegion: 'Karnataka',
      postalCode: '560062',
      addressCountry: 'IN',
    },
    openingHoursSpecification: [{
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      opens: '10:00',
      closes: '16:00',
    }],
    areaServed: 'IN',
    sameAs: [
      'https://www.instagram.com/rangmudra_bengaluru/',
      'https://www.facebook.com/profile.php?id=61555646021193',
      'https://youtube.com/@rangmudra',
      'https://www.linkedin.com/company/rangmudra',
    ],
  };
}

const website = () => ({
  '@type': 'WebSite', '@id': WEBSITE_ID, url: `${SITE}/`, name: 'RangMudra',
  inLanguage: 'en-IN', publisher: { '@id': ORG_ID },
});

const breadcrumbs = (trail) => ({
  '@type': 'BreadcrumbList',
  itemListElement: trail.map(([name, url], i) => ({
    '@type': 'ListItem', position: i + 1, name, ...(url ? { item: abs(url) } : {}),
  })),
});

const faqPage = (faqs) => (faqs.length ? {
  '@type': 'FAQPage',
  mainEntity: faqs.map((f) => ({
    '@type': 'Question', name: clean(f.q), acceptedAnswer: { '@type': 'Answer', text: clean(f.a) },
  })),
} : null);

/* ── Route list with per-page SEO ───────────────────────────────────────── */

const CAT = {
  experience: {
    name: 'Experience Workshops',
    title: 'Block Printing Classes for Individuals, Bengaluru | RangMudra',
    desc: 'Small-group block printing and eco printing sessions at our Bengaluru studio. Learn with wooden blocks, leaves and natural dyes, and take home what you print.',
  },
  corporate: {
    name: 'Corporate Workshops',
    title: 'Corporate Block Printing Workshops, Bengaluru | RangMudra',
    desc: 'Hands-on block printing for teams, run at your office or our studio in Bengaluru. Materials included, groups of any size, themes set to your event.',
  },
  curated: {
    name: 'Curated Workshops',
    title: 'Block Printing Courses for Design Students | RangMudra',
    desc: 'Longer, guided courses in hand block printing and eco printing for design students and makers who want real studio practice in Bengaluru.',
  },
};

function buildRoutes(data) {
  const { products, workshops, blogs, gallery, content, faqs } = data;
  const routes = [];
  const add = (r) => routes.push({ robots: 'index, follow, max-image-preview:large, max-snippet:-1', ...r });
  const org = organization(content);

  add({
    src: '/index.html', out: 'index.html', url: '/',
    title: 'RangMudra | Block Printing & Eco Printing Studio, Bengaluru',
    desc: 'Hand block printed and eco printed clothing, sarees, dupattas and home textiles made in our Bengaluru studio, plus weekend and corporate printing workshops.',
    jsonld: [org, website()],
  });
  add({
    src: '/shop.html', out: 'shop.html', url: '/shop.html',
    title: 'Hand Block Printed Clothing & Home Textiles | RangMudra',
    desc: `Shirts, kurtas, sarees, dupattas, bedspreads and more, each one hand printed with wooden blocks or leaves. ${products.length} one-of-a-kind pieces, made in Bengaluru.`,
    jsonld: [breadcrumbs([['Home', '/'], ['Shop']]), {
      '@type': 'ItemList',
      itemListElement: products.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: abs(`/product/${p.slug}/`) })),
    }],
  });
  add({
    src: '/workshops.html', out: 'workshops.html', url: '/workshops.html',
    title: 'Block & Eco Printing Workshops in Bengaluru | RangMudra',
    desc: 'Learn hand block printing or eco printing at our studio near Doddakalasandra Metro. Sessions for beginners, families, schools and company teams.',
    jsonld: [breadcrumbs([['Home', '/'], ['Workshops']])],
  });
  for (const [cat, meta] of Object.entries(CAT)) {
    add({
      src: `/workshop-category.html?cat=${cat}`, out: `workshops/${cat}/index.html`, url: `/workshops/${cat}/`,
      file: 'workshop-category.html', query: `?cat=${cat}`, kind: 'workshop-category', key: cat,
      title: meta.title, desc: meta.desc,
      jsonld: [breadcrumbs([['Home', '/'], ['Workshops', '/workshops.html'], [meta.name]])],
    });
  }
  for (const w of workshops) {
    const meta = CAT[w.category] || CAT.experience;
    const price = w.price != null && w.price !== '' ? `${rupees(w.price)} ${w.priceUnit || 'per person'}` : '';
    const facts = [w.duration, price].filter(Boolean).join(', ');
    const lead = w.tagline || firstSentence(w.description);
    const imgs = imagesOf(w);
    add({
      src: `/workshop-detail.html?cat=${w.category}&slug=${w.slug}`, out: `workshop/${w.slug}/index.html`,
      url: `/workshop/${w.slug}/`, file: 'workshop-detail.html', query: `?cat=${w.category}&slug=${w.slug}`,
      kind: 'workshop', key: w.slug,
      title: `${clean(w.title)} in Bengaluru | RangMudra`,
      desc: clip(`${lead}${facts ? ` ${facts}.` : ''} Book at our Bengaluru studio.`),
      image: imgs[0], ogType: 'website',
      jsonld: [
        breadcrumbs([['Home', '/'], ['Workshops', '/workshops.html'], [meta.name, `/workshops/${w.category}/`], [clean(w.title)]]),
        {
          '@type': 'Course',
          name: clean(w.title),
          description: clip(w.description, 500),
          url: abs(`/workshop/${w.slug}/`),
          image: imgs.slice(0, 4),
          provider: { '@id': ORG_ID },
          inLanguage: 'en',
          educationalLevel: w.level || undefined,
          ...(w.price != null && w.price !== '' ? {
            offers: {
              '@type': 'Offer', category: 'Paid', price: Number(w.price), priceCurrency: 'INR',
              availability: 'https://schema.org/InStock', url: abs(`/workshop/${w.slug}/`),
            },
          } : {}),
          hasCourseInstance: {
            '@type': 'CourseInstance',
            courseMode: w.category === 'corporate' ? ['Onsite', 'Blended'] : 'Onsite',
            location: { '@id': ORG_ID },
            ...(w.duration ? { courseWorkload: clean(w.duration) } : {}),
          },
        },
        faqPage(w.faqs || []),
      ],
    });
  }
  for (const p of products) {
    const imgs = imagesOf(p);
    const kind = p.printType || 'Hand Printed';
    const cat = p.category || '';
    const tags = (p.tags || []).map(titleCase).filter((t) => !new RegExp(kind, 'i').test(t));
    const soldOut = p.available === false;
    const lead = firstSentence(p.description || '');
    add({
      src: `/product.html?slug=${p.slug}`, out: `product/${p.slug}/index.html`, url: `/product/${p.slug}/`,
      file: 'product.html', query: `?slug=${p.slug}`, kind: 'product', key: p.slug,
      title: productTitle(p.name, kind, cat),
      desc: clip(`${clean(p.name)}, ${rupees(p.price)}. ${kind} by hand in our Bengaluru studio, one piece only. ${lead}`),
      image: imgs[0], ogType: 'product',
      extraMeta: [
        ['property', 'product:price:amount', String(Number(p.price))],
        ['property', 'product:price:currency', 'INR'],
        ['property', 'product:availability', soldOut ? 'out of stock' : 'in stock'],
      ],
      jsonld: [
        breadcrumbs([['Home', '/'], ['Shop', '/shop.html'], ...(cat ? [[cat, '/shop.html']] : []), [clean(p.name)]]),
        {
          '@type': 'Product',
          name: clean(p.name),
          description: clip(p.description || lead, 700),
          image: imgs.slice(0, 6),
          sku: p.id,
          brand: { '@type': 'Brand', name: 'RangMudra' },
          category: cat || undefined,
          material: (p.features || []).find((f) => /cotton|silk|linen|modal|chanderi/i.test(f)) || undefined,
          keywords: [kind, cat, ...tags].filter(Boolean).join(', '),
          offers: {
            '@type': 'Offer',
            url: abs(`/product/${p.slug}/`),
            price: Number(p.price),
            priceCurrency: 'INR',
            availability: soldOut ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
            itemCondition: 'https://schema.org/NewCondition',
            seller: { '@id': ORG_ID },
            shippingDetails: {
              '@type': 'OfferShippingDetails',
              shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'IN' },
              deliveryTime: {
                '@type': 'ShippingDeliveryTime',
                handlingTime: { '@type': 'QuantitativeValue', minValue: 3, maxValue: 5, unitCode: 'DAY' },
                transitTime: { '@type': 'QuantitativeValue', minValue: 2, maxValue: 7, unitCode: 'DAY' },
              },
            },
          },
        },
      ],
    });
  }
  add({
    src: '/blogs.html', out: 'blogs.html', url: '/blogs.html',
    title: 'Block & Eco Printing Journal | RangMudra',
    desc: 'Studio notes from RangMudra: how block printing and eco printing work, caring for hand printed fabric, natural dyes, and what we are making next.',
    jsonld: [breadcrumbs([['Home', '/'], ['Journal']])],
  });
  for (const b of blogs) {
    const img = b.image || (b.content || []).find((c) => c.type === 'img')?.src;
    add({
      src: `/blog-detail.html?slug=${b.slug}`, out: `blog/${b.slug}/index.html`, url: `/blog/${b.slug}/`,
      file: 'blog-detail.html', query: `?slug=${b.slug}`, kind: 'blog', key: b.slug,
      title: clean(b.title).length > 48 ? `${clean(b.title)} | RangMudra` : `${clean(b.title)} | RangMudra Journal`,
      desc: clip(b.excerpt || firstSentence((b.content || []).map((c) => c.text || '').join(' '))),
      image: img, ogType: 'article',
      jsonld: [
        breadcrumbs([['Home', '/'], ['Journal', '/blogs.html'], [clean(b.title)]]),
        {
          '@type': 'BlogPosting',
          headline: clean(b.title).slice(0, 110),
          description: clip(b.excerpt || '', 300),
          image: img ? [img] : undefined,
          datePublished: b.date || undefined,
          dateModified: b.updatedAt || b.date || undefined,
          author: { '@type': 'Organization', name: clean(b.author) || 'RangMudra Studio', url: `${SITE}/about.html` },
          publisher: { '@id': ORG_ID },
          mainEntityOfPage: abs(`/blog/${b.slug}/`),
          articleSection: b.category || undefined,
        },
      ],
    });
  }
  add({
    src: '/about.html', out: 'about.html', url: '/about.html',
    title: 'About RangMudra: Our Block Printing Studio in Bengaluru',
    desc: 'Who we are, how we print, and why we still carve blocks by hand. Meet the RangMudra studio on Kanakapura Main Road, Bengaluru.',
    jsonld: [breadcrumbs([['Home', '/'], ['About']]), faqPage(faqs.map((f) => ({ q: f.question || f.q, a: f.answer || f.a })).filter((f) => f.q && f.a))],
  });
  add({
    src: '/sustainability.html', out: 'sustainability.html', url: '/sustainability.html',
    title: 'Natural Dyes, Surplus Fabric & Upcycling | RangMudra',
    desc: 'The choices behind every RangMudra piece: natural and azo-free dyes, organic and surplus fabric, bring-your-own-clothes printing, and plastic-free packing.',
    jsonld: [breadcrumbs([['Home', '/'], ['Sustainability']])],
  });
  add({
    src: '/gallery.html', out: 'gallery.html', url: '/gallery.html',
    title: 'Block Print & Eco Print Design Gallery | RangMudra',
    desc: 'Browse prints from the RangMudra studio: carved block motifs, leaf and flower eco prints, finished sarees, stoles and home textiles.',
    jsonld: [breadcrumbs([['Home', '/'], ['Gallery']])],
  });
  for (const g of gallery) {
    const name = clean(g.title) || 'Design from the RangMudra studio';
    // Pieces still carrying a camera file name as their title read as empty
    // pages to a search engine: built and linked, but kept out of the index
    // (and the sitemap) until they get a real title in the admin.
    const thin = !clean(g.description) && /^(img[_ -]?\d+|edited|cropped|group \d+|dsc[_ -]?\d+|untitled|photo)\b/i.test(name);
    add({
      src: `/gallery-item.html?id=${encodeURIComponent(g.id)}`, out: `gallery/${g.id}/index.html`, url: `/gallery/${g.id}/`,
      ...(thin ? { robots: 'noindex, follow', noSitemap: true } : {}),
      file: 'gallery-item.html', query: `?id=${encodeURIComponent(g.id)}`, kind: 'gallery', key: g.id,
      title: name.length > 40 ? `${name} | RangMudra` : `${name} | RangMudra Design Gallery`,
      desc: clip(g.description || `${name}, hand printed at the RangMudra studio in Bengaluru.`),
      image: g.type === 'video' ? undefined : g.url,
      jsonld: [
        breadcrumbs([['Home', '/'], ['Gallery', '/gallery.html'], [name]]),
        g.type === 'video' ? null : {
          '@type': 'ImageObject', contentUrl: g.url, name, description: clip(g.description || name, 300),
          creator: { '@id': ORG_ID }, copyrightHolder: { '@id': ORG_ID },
          creditText: 'RangMudra', acquireLicensePage: `${SITE}/enquire.html`,
        },
      ],
    });
  }
  add({
    src: '/enquire.html', out: 'enquire.html', url: '/enquire.html',
    title: 'Contact RangMudra: Workshops, Orders & Custom Printing',
    desc: 'Write, call or visit us on Kanakapura Main Road, Bengaluru. Open Monday to Saturday, 10 am to 4 pm. +91 89514 80256.',
    jsonld: [breadcrumbs([['Home', '/'], ['Contact']])],
  });
  for (const [file, name] of [['privacy', 'Privacy Policy'], ['terms', 'Terms of Service'], ['shipping', 'Shipping Policy']]) {
    add({
      src: `/${file}.html`, out: `${file}.html`, url: `/${file}.html`,
      title: `${name} | RangMudra`,
      desc: file === 'shipping'
        ? 'Dispatch in 3 to 5 business days, delivery across India by Speed Post, and what to do if a parcel arrives damaged.'
        : `The ${name.toLowerCase()} for rangmudra.com and orders placed with the RangMudra studio, Bengaluru.`,
      jsonld: [breadcrumbs([['Home', '/'], [name]])],
    });
  }
  return routes;
}

/* ── Local server: the copied site + a caching proxy to the live API ────── */

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ico': 'image/x-icon', '.txt': 'text/plain', '.xml': 'application/xml',
};

function startServer(dir) {
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://x');
      if (url.pathname.startsWith('/api/')) {
        if (req.method !== 'GET') { res.writeHead(204).end(); return; }
        const r = await api(url.pathname + url.search);
        res.writeHead(r.status, { 'content-type': r.type }).end(r.body);
        return;
      }
      let file = path.join(dir, decodeURIComponent(url.pathname));
      if (!file.startsWith(dir)) { res.writeHead(403).end(); return; }
      if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
      if (!fs.existsSync(file)) { res.writeHead(404).end('not found'); return; }
      res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    } catch (e) {
      res.writeHead(500).end(String(e));
    }
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

/* ── Rendering ──────────────────────────────────────────────────────────── */

// Runs inside the page once it has rendered: strips what the scripts will add
// again on load (so nothing doubles up), then writes the page's own SEO head.
function finalizePage({ seo, originalScripts }) {
  const drop = (sel) => document.querySelectorAll(sel).forEach((n) => n.remove());
  drop('.sale-banner, .video-chrome, video.section-bg-video, .media-lightbox, .hold-note, iframe, .grecaptcha-badge, .cart-drawer-backdrop');
  document.documentElement.classList.remove('has-sale-banner');
  document.querySelectorAll('script[src]').forEach((s) => {
    if (!originalScripts.includes(s.getAttribute('src'))) s.remove();
  });
  document.querySelectorAll('[data-reveal]').forEach((el) => {
    el.removeAttribute('data-reveal');
    el.classList.remove('is-visible');
    el.style.removeProperty('--reveal-delay');
  });
  document.querySelectorAll('[style=""]').forEach((el) => el.removeAttribute('style'));
  document.querySelectorAll('[class=""]').forEach((el) => el.removeAttribute('class'));
  document.body.style.removeProperty('overflow');
  document.querySelector('.site-header')?.classList.remove('scrolled');
  // Mark the build: page scripts can tell a pre-rendered page from a bare template.
  document.documentElement.setAttribute('data-prerendered', '');

  // The hero photo actually on the page (an <img> or a section background).
  const heroImage = (() => {
    const scope = document.querySelector('main') || document.body;
    for (const n of scope.querySelectorAll('img[src], [style*="background-image"]')) {
      const url = n.tagName === 'IMG' ? n.getAttribute('src')
        : ((n.getAttribute('style') || '').match(/url\(["']?([^"')]+)/) || [])[1];
      if (url && /^https?:\/\//.test(url) && !/\.(svg|gif)(\?|$)/i.test(url)) return url;
    }
    return '';
  })();
  if (!seo.image) seo.image = heroImage;
  // Preload hints in the template name its placeholder art; aim them at the
  // photo the page really shows, or drop them.
  document.querySelectorAll('link[rel="preload"][as="image"]').forEach((l) => {
    const href = l.getAttribute('href');
    if (document.body.innerHTML.includes(href)) return;
    if (heroImage && !document.querySelector(`link[rel="preload"][href="${heroImage}"]`)) l.setAttribute('href', heroImage);
    else l.remove();
  });

  // Head: replace the template's generic SEO with this page's.
  const head = document.head;
  head.querySelectorAll([
    'title', 'meta[name="description"]', 'meta[name="keywords"]', 'meta[name="robots"]', 'meta[name="author"]',
    'link[rel="canonical"]', 'meta[property^="og:"]', 'meta[name^="twitter:"]', 'meta[property^="product:"]',
    'script[type="application/ld+json"]',
  ].join(',')).forEach((n) => n.remove());
  for (const node of [...head.childNodes]) {
    if (node.nodeType === Node.COMMENT_NODE && /SEO|Open Graph|Twitter|Primary SEO|Structured data/i.test(node.nodeValue)) node.remove();
  }
  const anchor = head.querySelector('meta[name="viewport"]');
  const nodes = [];
  const el = (tag, attrs, text) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== '') n.setAttribute(k, v);
    if (text) n.textContent = text;
    nodes.push(n);
  };
  // One consistent icon set on every page (Google shows the 48px+ icon in results).
  head.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"], link[rel="manifest"], meta[name="theme-color"], meta[name="application-name"], meta[name="apple-mobile-web-app-title"]').forEach((n) => n.remove());
  el('title', {}, seo.title);
  el('meta', { name: 'description', content: seo.desc });
  el('meta', { name: 'robots', content: seo.robots });
  el('link', { rel: 'canonical', href: seo.canonical });
  el('meta', { property: 'og:type', content: seo.ogType || 'website' });
  el('meta', { property: 'og:site_name', content: 'RangMudra' });
  el('meta', { property: 'og:locale', content: 'en_IN' });
  el('meta', { property: 'og:title', content: seo.ogTitle });
  el('meta', { property: 'og:description', content: seo.desc });
  el('meta', { property: 'og:url', content: seo.canonical });
  if (seo.image) {
    el('meta', { property: 'og:image', content: seo.image });
    el('meta', { property: 'og:image:alt', content: seo.ogTitle });
  }
  for (const [attr, key, value] of seo.extraMeta || []) el('meta', { [attr]: key, content: value });
  el('meta', { name: 'twitter:card', content: seo.image ? 'summary_large_image' : 'summary' });
  el('meta', { name: 'twitter:title', content: seo.ogTitle });
  el('meta', { name: 'twitter:description', content: seo.desc });
  if (seo.image) el('meta', { name: 'twitter:image', content: seo.image });
  el('link', { rel: 'icon', href: '/favicon.ico', sizes: 'any' });
  el('link', { rel: 'icon', type: 'image/png', href: '/images/logo/rangmudra-logo-48.png', sizes: '48x48' });
  el('link', { rel: 'icon', type: 'image/png', href: '/images/logo/rangmudra-logo-96.png', sizes: '96x96' });
  el('link', { rel: 'icon', type: 'image/png', href: '/images/logo/rangmudra-logo-192.png', sizes: '192x192' });
  el('link', { rel: 'apple-touch-icon', href: '/images/logo/rangmudra-logo-180.png' });
  el('link', { rel: 'manifest', href: '/site.webmanifest' });
  el('meta', { name: 'theme-color', content: '#2C1A10' });
  el('meta', { name: 'application-name', content: 'RangMudra' });
  el('meta', { name: 'apple-mobile-web-app-title', content: 'RangMudra' });
  if (seo.jsonld) el('script', { type: 'application/ld+json' }, seo.jsonld);
  let after = anchor;
  for (const n of nodes) { after.after(n); after = n; }

  if (seo.page) {
    // Detail pages live in folders (/product/<slug>/): keep relative links
    // resolving from the site root, and hand the scripts the query the
    // template expects.
    const base = document.createElement('base');
    base.setAttribute('href', '/');
    head.prepend(base);
    const s = document.createElement('script');
    s.textContent = `window.RM_PAGE=${JSON.stringify(seo.page)};`;
    base.after(s);
  }
  return '<!DOCTYPE html>\n' + document.documentElement.outerHTML;
}

function scriptSrcs(html) {
  return [...html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map((m) => m[1]);
}

/* ── Sitemaps, robots, redirects ────────────────────────────────────────── */

function writeSitemaps(routes, data) {
  const lastmod = (r) => {
    const rec = r.kind === 'product' ? data.products.find((p) => p.slug === r.key)
      : r.kind === 'workshop' ? data.workshops.find((w) => w.slug === r.key)
        : r.kind === 'blog' ? data.blogs.find((b) => b.slug === r.key)
          : r.kind === 'gallery' ? data.gallery.find((g) => g.id === r.key) : null;
    const d = rec && (rec.updatedAt || rec.date || rec.createdAt);
    return d && !Number.isNaN(Date.parse(d)) ? new Date(d).toISOString().slice(0, 10) : '';
  };
  const listed = routes.filter((r) => !r.noSitemap);
  const urls = listed.map((r) => {
    const imgs = (r.images || []).slice(0, 10)
      .map((u) => `\n    <image:image><image:loc>${esc(u)}</image:loc></image:image>`).join('');
    const lm = lastmod(r);
    return `  <url>\n    <loc>${esc(abs(r.url))}</loc>${lm ? `\n    <lastmod>${lm}</lastmod>` : ''}${imgs}\n  </url>`;
  });
  fs.writeFileSync(path.join(OUT, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls.join('\n')}\n</urlset>\n`);
  fs.writeFileSync(path.join(OUT, 'sitemaps.txt'), `${listed.map((r) => abs(r.url)).join('\n')}\n`);
  fs.writeFileSync(path.join(OUT, 'robots.txt'), [
    'User-agent: *',
    'Allow: /',
    '',
    '# Cart, checkout and account pages only make sense for a signed-in shopper.',
    'Disallow: /cart.html',
    'Disallow: /checkout-address.html',
    'Disallow: /checkout-payment.html',
    'Disallow: /order-confirmation.html',
    'Disallow: /profile.html',
    'Disallow: /profile-addresses.html',
    'Disallow: /profile-orders.html',
    'Disallow: /profile-settings.html',
    'Disallow: /profile-wishlist.html',
    'Disallow: /components-test.html',
    '',
    `Sitemap: ${SITE}/sitemap.xml`,
    '',
  ].join('\n'));
  fs.writeFileSync(path.join(OUT, GOOGLE_VERIFICATION), `google-site-verification: ${GOOGLE_VERIFICATION}`);

  // Folder roots without a page of their own point at the matching listing.
  for (const [dir, target] of [['product', '/shop.html'], ['workshop', '/workshops.html'], ['workshops', '/workshops.html'], ['blog', '/blogs.html'], ['gallery', '/gallery.html']]) {
    const file = path.join(OUT, dir, 'index.html');
    if (fs.existsSync(file)) continue;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex, follow"><link rel="canonical" href="${SITE}${target}"><meta http-equiv="refresh" content="0; url=${target}"><title>RangMudra</title></head><body><a href="${target}">Continue</a></body></html>\n`);
  }
}

/* ── Main ───────────────────────────────────────────────────────────────── */

function copyTree(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (SKIP_COPY.has(entry.name)) continue;
    const a = path.join(from, entry.name);
    const b = path.join(to, entry.name);
    if (entry.isDirectory()) copyTree(a, b);
    else fs.copyFileSync(a, b);
  }
}

async function main() {
  const started = Date.now();
  const [products, workshops, blogs, content, faqs, galleryPage] = await Promise.all([
    apiJson('/api/products'), apiJson('/api/workshops'), apiJson('/api/blogs'), apiJson('/api/content'),
    apiJson('/api/faqs').catch(() => []), apiJson('/api/gallery?pageSize=500').catch(() => ({ items: [] })),
  ]);
  const data = { products, workshops, blogs, content, faqs, gallery: galleryPage.items || [] };
  const routes = buildRoutes(data);
  for (const r of routes) {
    const rec = r.kind === 'product' ? products.find((p) => p.slug === r.key)
      : r.kind === 'workshop' ? workshops.find((w) => w.slug === r.key) : null;
    r.images = rec ? imagesOf(rec) : r.image ? [r.image] : [];
  }

  fs.rmSync(OUT, { recursive: true, force: true });
  copyTree(ROOT, OUT);
  const manifest = {};
  for (const r of routes) if (r.kind) (manifest[r.kind] ||= []).push(r.key);
  fs.writeFileSync(path.join(OUT, 'js', 'static-routes.js'),
    `// Written by tools/build-static.mjs — pages that exist at clean URLs.\nexport const STATIC_ROUTES = ${JSON.stringify(manifest)};\n`);

  const server = await startServer(OUT);
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ executablePath: CHROME });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => { window.RM_BUILD = true; });
  await context.route('**/*', (route) => {
    const req = route.request();
    const u = req.url();
    // Images are answered with a 1×1 pixel rather than blocked: a failed image
    // fires the pages' fallback handlers, which would loop on their own fallback.
    if (req.resourceType() === 'image') return route.fulfill({ status: 200, contentType: 'image/gif', body: PIXEL });
    if (['media', 'font'].includes(req.resourceType())) return route.abort();
    if (!u.startsWith(origin)) return route.abort();
    return route.continue();
  });

  const problems = [];
  let done = 0;
  // ONLY=<substring> renders just the matching routes (debugging).
  const queue = routes.filter((r) => !process.env.ONLY || r.src.includes(process.env.ONLY));
  await Promise.all(Array.from({ length: 4 }, async () => {
    const page = await context.newPage();
    page.on('pageerror', (e) => problems.push(`${page.url()}: ${e.message}`));
    if (process.env.DEBUG) {
      const pending = new Map();
      page.on('request', (q) => pending.set(q, Date.now()));
      page.on('requestfinished', (q) => pending.delete(q));
      page.on('requestfailed', (q) => pending.delete(q));
      const seen = {};
      page.on('request', (q) => { const k = q.url().replace(/\?.*/, ''); seen[k] = (seen[k] || 0) + 1; });
      setInterval(() => {
        for (const [q, t] of pending) if (Date.now() - t > 5000) console.log('pending', q.url());
        console.log('top', JSON.stringify(Object.entries(seen).sort((a, b) => b[1] - a[1]).slice(0, 4)));
      }, 10000).unref();
    }
    while (queue.length) {
      const r = queue.shift();
      const srcFile = path.join(ROOT, r.src.split('?')[0]);
      await page.goto(origin + r.src, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForTimeout(400);
      const ogTitle = r.title.replace(/\s*\|\s*RangMudra.*$/, '').replace(/^RangMudra \| /, 'RangMudra: ');
      const html = await page.evaluate(finalizePage, {
        originalScripts: scriptSrcs(fs.readFileSync(srcFile, 'utf8')),
        seo: {
          title: r.title, desc: r.desc, robots: r.robots, canonical: abs(r.url), ogTitle,
          ogType: r.ogType, image: r.image ? abs(r.image) : '', extraMeta: r.extraMeta,
          jsonld: JSON.stringify({ '@context': 'https://schema.org', '@graph': r.jsonld.filter(Boolean) }),
          page: r.file ? { file: r.file, query: r.query } : null,
        },
      });
      const outFile = path.join(OUT, r.out);
      fs.mkdirSync(path.dirname(outFile), { recursive: true });
      fs.writeFileSync(outFile, html);
      done += 1;
      if (done % 10 === 0) console.log(`  ${done}/${routes.length} pages`);
    }
    await page.close();
  }));
  await browser.close();
  server.close();

  writeSitemaps(routes, data);
  console.log(`Built ${routes.length} pages into ${path.relative(process.cwd(), OUT) || OUT} in ${((Date.now() - started) / 1000).toFixed(0)}s.`);
  if (problems.length) {
    console.log(`Script errors while rendering (${problems.length}):`);
    for (const p of [...new Set(problems)].slice(0, 20)) console.log(`  ${p}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
