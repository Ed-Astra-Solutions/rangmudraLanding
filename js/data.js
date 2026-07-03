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
