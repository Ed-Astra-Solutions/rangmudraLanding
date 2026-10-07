/* filter-pills.js — Shop filter pill active-state toggling */

export function initFilterPills(containerSelector, onChange, datasetKey = 'filter') {
  const container = document.querySelector(containerSelector);
  if (!container) return;

  const pills = container.querySelectorAll('.filter-pill');

  pills.forEach(pill => {
    pill.addEventListener('click', () => {
      const wasActive = pill.classList.contains('active');

      /* Single-select: deactivate all */
      pills.forEach(p => p.classList.remove('active'));

      /* Toggle or set active */
      if (!wasActive) pill.classList.add('active');

      const active = container.querySelector('.filter-pill.active');
      const value = active ? (active.dataset[datasetKey] || active.textContent.trim()) : null;
      if (onChange) onChange(value);
    });
  });
}
