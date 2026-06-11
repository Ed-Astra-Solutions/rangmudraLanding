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
