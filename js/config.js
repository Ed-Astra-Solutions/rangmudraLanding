// Landing-site runtime config: where the backend REST API lives.
//
// The public site is hosted on GitHub Pages (landing.rangmudra.com) while the
// API runs on EC2 (https://api.rangmudra.com), so API calls must go cross-origin
// to the EC2 host. When the Node backend serves these pages itself (local dev),
// we want same-origin instead so nothing has to be reconfigured.
//
// Resolution order:
//   1. An explicit `window.RANGMUDRA_API_BASE` override (string), if set.
//   2. Same-origin ('') on localhost / 127.0.0.1 — local `npm start`.
//   3. The production EC2 API origin otherwise (GitHub Pages, custom domains).
//
// The backend must list this page's origin in its CORS_ORIGINS env var, and the
// API origin must be HTTPS (Pages is HTTPS — a plain http:// endpoint would be
// blocked as mixed content).
function resolveBase() {
  if (typeof window !== 'undefined' && typeof window.RANGMUDRA_API_BASE === 'string') {
    return window.RANGMUDRA_API_BASE;
  }
  const host = (typeof location !== 'undefined' && location.hostname) || '';
  if (host === 'localhost' || host === '127.0.0.1' || host === '') {
    return '';
  }
  return 'https://api.rangmudra.com';
}

export const API_BASE = resolveBase().replace(/\/$/, '');

// Build an absolute API URL from an "/api/..." path.
export const apiUrl = (path) => API_BASE + path;
