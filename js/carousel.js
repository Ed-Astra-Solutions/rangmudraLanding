/* carousel.js — Generic scroll-snap carousel with arrow controls */

export function initCarousels(container = document) {
  container.querySelectorAll('.carousel').forEach(initCarousel);
}

export function initCarousel(el) {
  const track = el.querySelector('.carousel__track');
  const prevBtn = el.querySelector('.carousel__arrow--prev');
  const nextBtn = el.querySelector('.carousel__arrow--next');
  const dotsContainer = el.querySelector('.carousel__dots');
  if (!track) return;

  let current = 0;

  function getSlides() {
    return Array.from(track.querySelectorAll('.carousel__slide'));
  }

  function getSlideWidth() {
    const slides = getSlides();
    return slides.length ? slides[0].offsetWidth + parseInt(getComputedStyle(track).gap || 0) : 0;
  }

  function scrollTo(index) {
    const slides = getSlides();
    current = Math.max(0, Math.min(index, slides.length - 1));
    track.scrollTo({ left: current * getSlideWidth(), behavior: 'smooth' });
    updateDots();
  }

  function updateDots() {
    if (!dotsContainer) return;
    dotsContainer.querySelectorAll('.carousel__dot').forEach((dot, i) => {
      dot.classList.toggle('active', i === current);
      dot.setAttribute('aria-current', i === current ? 'true' : 'false');
    });
  }

  function buildDots() {
    if (!dotsContainer) return;
    const slides = getSlides();
    dotsContainer.innerHTML = '';
    slides.forEach((_, i) => {
      const dot = document.createElement('button');
      dot.className = 'carousel__dot' + (i === 0 ? ' active' : '');
      dot.setAttribute('aria-label', `Slide ${i + 1}`);
      dot.setAttribute('aria-current', i === 0 ? 'true' : 'false');
      dot.addEventListener('click', () => scrollTo(i));
      dotsContainer.appendChild(dot);
    });
  }

  if (prevBtn) prevBtn.addEventListener('click', () => scrollTo(current - 1));
  if (nextBtn) nextBtn.addEventListener('click', () => scrollTo(current + 1));

  /* Update current on scroll */
  track.addEventListener('scroll', () => {
    const slideW = getSlideWidth();
    if (slideW > 0) {
      const newCurrent = Math.round(track.scrollLeft / slideW);
      if (newCurrent !== current) { current = newCurrent; updateDots(); }
    }
  }, { passive: true });

  buildDots();
}
