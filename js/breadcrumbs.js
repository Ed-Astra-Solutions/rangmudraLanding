/* breadcrumbs.js — Site-wide breadcrumb controller.
 *
 * Looks for <nav data-breadcrumb> slots and populates them based on the
 * current URL (pathname + query params). Supports dynamic labels for
 * product, workshop, and blog detail pages by fetching the corresponding
 * JSON data file.
 *
 * Trail format: [{ label, href? }] — last item has no href (current page).
 */

const WORKSHOP_CATS = {
  experience: 'Experience Workshops',
  corporate: 'Corporate Workshops',
  curated: 'Curated Workshops',
};

const SHOP_CATEGORIES = {
  all: null,
  mens: "Men's Wear",
  womens: "Women's Wear",
  decor: 'Home Décor',
  accessories: 'Accessories',
};

const PRINT_TYPES = {
  block: 'Block Printing',
  eco: 'Eco Printing',
};

/* Map the printType value stored on each product to a URL slug + display label */
const PRINT_TYPE_FROM_PRODUCT = {
  'Block Printed': { slug: 'block', label: 'Block Printing' },
  'Eco Printed':   { slug: 'eco',   label: 'Eco Printing' },
};

const PROFILE_SUBPAGES = {
  'profile-addresses.html': 'Saved Addresses',
  'profile-wishlist.html': 'Wishlist',
  'profile-orders.html': 'My Orders',
  'profile-settings.html': 'Settings',
};

const STATIC_TRAILS = {
  'shop.html':             [{ label: 'Shop' }],
  'workshops.html':        [{ label: 'Workshops' }],
  'blogs.html':            [{ label: 'Blogs' }],
  'about.html':            [{ label: 'About Us' }],
  'enquire.html':          [{ label: 'Enquire' }],
  'cart.html':             [{ label: 'My Cart' }],
  'checkout-address.html': [{ label: 'My Cart', href: 'cart.html' }, { label: 'Delivery Address' }],
  'checkout-payment.html': [{ label: 'My Cart', href: 'cart.html' }, { label: 'Payment' }],
  'profile.html':          [{ label: 'My Profile' }],
  'privacy.html':          [{ label: 'Privacy Policy' }],
  'terms.html':            [{ label: 'Terms of Service' }],
  'shipping.html':         [{ label: 'Shipping Policy' }],
  'components-test.html':  [{ label: 'Components' }],
};

async function fetchJSON(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

function normalizePage(pathname) {
  let last = (pathname.split('/').pop() || '').toLowerCase();
  if (!last || last === '/') return 'index.html';
  if (!last.endsWith('.html')) last = `${last}.html`;
  return last;
}

async function buildTrail() {
  const page = normalizePage(window.location.pathname);
  const params = new URLSearchParams(window.location.search);
  const trail = [{ label: 'Home', href: 'index.html' }];

  if (page === 'index.html') return trail;

  if (PROFILE_SUBPAGES[page]) {
    trail.push({ label: 'My Profile', href: 'profile.html' });
    trail.push({ label: PROFILE_SUBPAGES[page] });
    return trail;
  }

  if (page === 'shop.html') {
    const print = params.get('print');
    const cat = params.get('category');
    if (print && PRINT_TYPES[print]) {
      trail.push({ label: 'Shop', href: 'shop.html' });
      trail.push({ label: PRINT_TYPES[print] });
    } else {
      trail.push({ label: 'Shop' });
    }
    if (cat && SHOP_CATEGORIES[cat]) trail.push({ label: SHOP_CATEGORIES[cat] });
    return trail;
  }

  if (page === 'product.html') {
    trail.push({ label: 'Shop', href: 'shop.html' });
    const slug = params.get('slug');
    if (slug) {
      const products = await fetchJSON('/data/products.json');
      const product = products?.find(p => p.slug === slug);
      if (product) {
        const printMeta = PRINT_TYPE_FROM_PRODUCT[product.printType];
        if (printMeta) {
          trail.push({
            label: printMeta.label,
            href: `shop.html?print=${printMeta.slug}`,
          });
        }
        trail.push({ label: product.name || product.title || 'Product' });
      } else {
        trail.push({ label: 'Product' });
      }
    }
    return trail;
  }

  if (page === 'workshop-category.html') {
    trail.push({ label: 'Workshops', href: 'workshops.html' });
    const cat = params.get('cat');
    trail.push({ label: WORKSHOP_CATS[cat] || 'Category' });
    return trail;
  }

  if (page === 'workshop-detail.html') {
    trail.push({ label: 'Workshops', href: 'workshops.html' });
    const cat = params.get('cat');
    const slug = params.get('slug');
    if (cat) {
      trail.push({
        label: WORKSHOP_CATS[cat] || 'Category',
        href: `workshop-category.html?cat=${cat}`,
      });
    }
    if (slug) {
      const workshops = await fetchJSON('/data/workshops.json');
      const w = workshops?.find(x => x.slug === slug);
      trail.push({ label: w?.title || 'Workshop' });
    }
    return trail;
  }

  if (page === 'blog-detail.html') {
    trail.push({ label: 'Blogs', href: 'blogs.html' });
    const slug = params.get('slug');
    if (slug) {
      const blogs = await fetchJSON('/data/blogs.json');
      const post = blogs?.find(b => b.slug === slug);
      trail.push({ label: post?.title || 'Article' });
    }
    return trail;
  }

  if (STATIC_TRAILS[page]) {
    trail.push(...STATIC_TRAILS[page]);
    return trail;
  }

  return trail;
}

function renderTrail(trail) {
  return trail
    .map((crumb, i) => {
      const isLast = i === trail.length - 1;
      const sep = i > 0
        ? '<span class="breadcrumb__sep" aria-hidden="true">›</span>'
        : '';
      const node = isLast || !crumb.href
        ? `<span aria-current="${isLast ? 'page' : 'false'}">${escapeHTML(crumb.label)}</span>`
        : `<a href="${escapeHTML(crumb.href)}">${escapeHTML(crumb.label)}</a>`;
      return sep + node;
    })
    .join('');
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

export async function initBreadcrumbs() {
  const slots = document.querySelectorAll('[data-breadcrumb]');
  if (!slots.length) return;
  const trail = await buildTrail();
  const html = renderTrail(trail);
  slots.forEach(slot => {
    slot.classList.add('breadcrumb');
    slot.setAttribute('aria-label', 'Breadcrumb');
    slot.innerHTML = html;
  });
}
