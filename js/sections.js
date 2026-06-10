// On page load, fetch /api/sections (falls back to /data/sections.json for
// pure-static hosting) and swap src on every <img data-section="page.slot">.
// Also applies background-image to elements with data-section-bg="page.slot".

(async function applySections() {
  let sections = null;
  try {
    const res = await fetch('/api/sections', { cache: 'no-store' });
    if (res.ok) sections = await res.json();
  } catch (_) { /* fall through */ }
  if (!sections) {
    try {
      const res = await fetch('/data/sections.json', { cache: 'no-store' });
      if (res.ok) sections = await res.json();
    } catch (_) { return; }
  }
  if (!sections) return;

  const resolve = (ref) => {
    if (!ref) return null;
    const [page, slot] = ref.split('.');
    return sections[page] && sections[page][slot] ? sections[page][slot] : null;
  };

  document.querySelectorAll('[data-section]').forEach((el) => {
    const url = resolve(el.getAttribute('data-section'));
    if (url) el.setAttribute('src', url);
  });
  document.querySelectorAll('[data-section-bg]').forEach((el) => {
    const url = resolve(el.getAttribute('data-section-bg'));
    if (url) el.style.backgroundImage = `url("${url}")`;
  });
})();
