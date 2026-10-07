/* accordion.js — FAQ accordion toggle */

export function initAccordions(container = document) {
  container.querySelectorAll('.accordion-item').forEach(item => {
    const trigger = item.querySelector('.accordion-trigger');
    const content = item.querySelector('.accordion-content');
    if (!trigger || !content) return;

    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', content.id || '');

    trigger.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');

      /* Close all others in same parent */
      item.closest('.accordion-list')?.querySelectorAll('.accordion-item.open').forEach(other => {
        if (other !== item) {
          other.classList.remove('open');
          other.querySelector('.accordion-trigger')?.setAttribute('aria-expanded', 'false');
        }
      });

      item.classList.toggle('open', !isOpen);
      trigger.setAttribute('aria-expanded', (!isOpen).toString());
    });
  });
}
