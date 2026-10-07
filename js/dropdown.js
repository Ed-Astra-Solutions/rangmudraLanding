/* dropdown.js — Reusable dropdown open/close/select */

export function initDropdowns(container = document) {
  container.querySelectorAll('.dropdown').forEach(initDropdown);
}

export function initDropdown(el) {
  const trigger = el.querySelector('.dropdown__trigger');
  const menu = el.querySelector('.dropdown__menu');
  const options = el.querySelectorAll('.dropdown__option');
  if (!trigger || !menu) return;

  function open() {
    el.classList.add('open');
    trigger.setAttribute('aria-expanded', 'true');
  }

  function close() {
    el.classList.remove('open');
    trigger.setAttribute('aria-expanded', 'false');
  }

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    el.classList.contains('open') ? close() : open();
  });

  options.forEach(opt => {
    opt.addEventListener('click', () => {
      const value = opt.dataset.value || opt.textContent.trim();
      const label = opt.textContent.trim();

      /* Update trigger label (first text node) */
      const triggerLabel = trigger.querySelector('[data-label]') || trigger.childNodes[0];
      if (triggerLabel && triggerLabel.nodeType === Node.TEXT_NODE) {
        triggerLabel.textContent = label;
      } else if (triggerLabel && triggerLabel.dataset) {
        triggerLabel.textContent = label;
      }

      options.forEach(o => o.classList.remove('active'));
      opt.classList.add('active');

      el.dispatchEvent(new CustomEvent('dropdown-select', { detail: { value, label }, bubbles: true }));
      close();
    });
  });

  document.addEventListener('click', close);
  el.addEventListener('click', (e) => e.stopPropagation());

  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
}
