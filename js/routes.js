// Links to detail pages. A record that has its own built page gets its clean
// URL (/product/<slug>/); anything newer than the last site build falls back
// to the shared template with a query string, which always works.

import { STATIC_ROUTES } from '/js/static-routes.js';

const has = (kind, key) => Array.isArray(STATIC_ROUTES[kind]) && STATIC_ROUTES[kind].includes(key);
const q = encodeURIComponent;

export const productUrl = (slug) =>
  (has('product', slug) ? `/product/${slug}/` : `/product.html?slug=${q(slug)}`);

export const workshopUrl = (cat, slug) =>
  (has('workshop', slug) ? `/workshop/${slug}/` : `/workshop-detail.html?${cat ? `cat=${q(cat)}&` : ''}slug=${q(slug)}`);

export const workshopCategoryUrl = (cat) =>
  (has('workshop-category', cat) ? `/workshops/${cat}/` : `/workshop-category.html?cat=${q(cat)}`);

export const blogUrl = (slug) =>
  (has('blog', slug) ? `/blog/${slug}/` : `/blog-detail.html?slug=${q(slug)}`);

export const galleryItemUrl = (id) =>
  (has('gallery', id) ? `/gallery/${id}/` : `/gallery-item.html?id=${q(id)}`);

// The query a page should read. Built pages carry theirs in window.RM_PAGE,
// since /product/<slug>/ has no ?slug= of its own.
export const pageQuery = () => (window.RM_PAGE ? window.RM_PAGE.query : location.search);

// Someone on /product.html?slug=x when /product/x/ exists: send them to the
// clean address so there is one URL per page. Skipped while the site build
// renders the templates.
export function preferCleanUrl(cleanUrl) {
  if (window.RM_PAGE || window.RM_BUILD || !cleanUrl.startsWith('/') || cleanUrl.includes('?')) return;
  location.replace(cleanUrl + location.hash);
}
