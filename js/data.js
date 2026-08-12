// Site data access. Fetches from the backend API (served from MongoDB) first,
// and falls back to the static JSON snapshots in /data so the site still works
// when hosted on a static server with no backend (e.g. GitHub Pages).

import { apiUrl } from '/js/config.js';

const FALLBACK = {
  products: '/data/products.json',
  workshops: '/data/workshops.json',
  blogs: '/data/blogs.json',
  addresses: '/data/addresses.json',
};

export async function getData(resource) {
  const fallback = FALLBACK[resource];
  try {
    const res = await fetch(apiUrl(`/api/${resource}`), { cache: 'no-store' });
    if (res.ok) return await res.json();
  } catch (_) {
    // API unreachable — fall through to the static snapshot.
  }
  const res = await fetch(fallback, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load ${resource}`);
  return res.json();
}

export const getProducts = () => getData('products');

// Server-side search / filter / sort / pagination for the shop grid.
// Mirrors getGallery: hits the API first and replicates the same logic against
// the static snapshot when there's no backend (GitHub Pages hosting).
const PRODUCT_CATEGORIES = {
  mens: "Men's Wear",
  womens: "Women's Wear",
  decor: 'Home Decor',
  accessories: 'Accessories',
};
const PRODUCT_PRINT_TYPES = { block: 'Block Printed', eco: 'Eco Printed' };

// Keep in step with the server's discountedUnitPrice so both sides sort alike.
function effectiveUnitPrice(p) {
  const price = Math.max(0, Number(p && p.price) || 0);
  const d = p && p.discount;
  if (!d || !d.value) return price;
  const cut = d.type === 'flat' ? Number(d.value) : Math.round((price * Number(d.value)) / 100);
  return Math.max(0, price - cut);
}

export async function getProductsPage({
  q = '', category = 'all', print = 'all', sort = 'featured', page = 1, pageSize = 12,
} = {}) {
  const params = new URLSearchParams();
  if (q.trim()) params.set('q', q.trim());
  if (category && category !== 'all') params.set('category', category);
  if (print && print !== 'all') params.set('print', print);
  params.set('sort', sort);
  params.set('page', String(page));
  params.set('pageSize', String(pageSize));
  try {
    const res = await fetch(apiUrl(`/api/products?${params.toString()}`), { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      // A backend predating this endpoint still answers with a bare array —
      // fall through to the local path rather than rendering nothing.
      if (data && Array.isArray(data.items)) return data;
    }
  } catch (_) {
    // API unreachable — fall through to the static snapshot.
  }

  const all = await getProducts();
  let items = all;
  const cat = PRODUCT_CATEGORIES[category];
  if (cat) items = items.filter((p) => p.category === cat);
  const pt = PRODUCT_PRINT_TYPES[print];
  if (pt) items = items.filter((p) => p.printType === pt);
  const ql = q.trim().toLowerCase();
  if (ql) {
    items = items.filter((p) => [p.name, p.description, p.category, p.printType, ...(p.tags || [])]
      .filter(Boolean).join(' ').toLowerCase().includes(ql));
  }
  items = [...items].sort((a, b) => {
    if ((a.available !== false) !== (b.available !== false)) return a.available === false ? 1 : -1;
    if (sort === 'price-asc') return effectiveUnitPrice(a) - effectiveUnitPrice(b);
    if (sort === 'price-desc') return effectiveUnitPrice(b) - effectiveUnitPrice(a);
    if (sort === 'newest') return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    if (!!b.featured !== !!a.featured) return b.featured ? 1 : -1;
    return String(a.name || '').localeCompare(String(b.name || ''));
  });
  const total = items.length;
  const pages = Math.max(Math.ceil(total / pageSize), 1);
  const safePage = Math.min(Math.max(page, 1), pages);
  const start = (safePage - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), total, page: safePage, pageSize, pages };
}
export const getWorkshops = () => getData('workshops');
export const getBlogs = () => getData('blogs');
export const getAddresses = () => getData('addresses');

// Gallery has a richer API shape ({ items, total, page, pageSize, tags }) plus
// server-side search/filter/pagination. On static hosting (no backend) we fall
// back to the /data/gallery.json snapshot and replicate the filtering here so
// the mosaic still works.
export async function getGallery({ q = '', tag = '', page = 1, pageSize = 60 } = {}) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (tag) params.set('tag', tag);
  params.set('page', String(page));
  params.set('pageSize', String(pageSize));
  try {
    const res = await fetch(apiUrl(`/api/gallery?${params.toString()}`), { cache: 'no-store' });
    if (res.ok) return await res.json();
  } catch (_) {
    // API unreachable — fall through to the static snapshot.
  }
  const res = await fetch('/data/gallery.json', { cache: 'no-store' });
  const all = (res.ok ? await res.json() : []).filter((g) => g.public);
  const ql = q.trim().toLowerCase();
  const tl = tag.trim().toLowerCase();
  let items = all;
  if (tl) items = items.filter((g) => (g.tags || []).includes(tl));
  if (ql) items = items.filter((g) =>
    [g.title, g.description, (g.tags || []).join(' ')].join(' ').toLowerCase().includes(ql));
  const start = (page - 1) * pageSize;
  const tags = [...new Set(all.flatMap((g) => g.tags || []))].sort();
  return { items: items.slice(start, start + pageSize), total: items.length, page, pageSize, tags };
}

// A single public gallery record by id or slug (detail-page client fallback).
export async function getGalleryItem(idOrSlug) {
  try {
    const res = await fetch(apiUrl(`/api/gallery/${encodeURIComponent(idOrSlug)}`), { cache: 'no-store' });
    if (res.ok) return await res.json();
  } catch (_) { /* fall through */ }
  const res = await fetch('/data/gallery.json', { cache: 'no-store' });
  const all = res.ok ? await res.json() : [];
  return all.find((g) => (g.id === idOrSlug || g.slug === idOrSlug) && g.public) || null;
}
