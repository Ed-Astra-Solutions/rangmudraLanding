/* carousel.js — Generic scroll-snap carousel with arrow controls.
 *
 * Optional auto-advance: <div class="carousel" data-autoplay="7000"> moves to
 * the next slide every 7s and wraps to the first. It pauses while the pointer
 * is over the carousel, while it has keyboard focus, while it is off screen
 * and while the tab is hidden, and it is off for reduced-motion users. */

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

  const interval = Number(el.dataset.autoplay) || 0;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (interval > 0 && !reduceMotion && getSlides().length > 1) {
    let hovering = false;
    let focused = false;
    let onScreen = false;
    let timer = null;
    const tick = () => {
      const slides = getSlides();
      scrollTo(current + 1 >= slides.length ? 0 : current + 1);
    };
    const update = () => {
      const run = onScreen && !hovering && !focused && !document.hidden;
      if (run && !timer) timer = setInterval(tick, interval);
      if (!run && timer) { clearInterval(timer); timer = null; }
    };
    el.addEventListener('pointerenter', () => { hovering = true; update(); });
    el.addEventListener('pointerleave', () => { hovering = false; update(); });
    el.addEventListener('focusin', () => { focused = true; update(); });
    el.addEventListener('focusout', () => { focused = false; update(); });
    document.addEventListener('visibilitychange', update);
    new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; update(); },
      { threshold: 0.4 }).observe(el);
    // A manual move (dot, arrow, swipe) restarts the countdown so the carousel
    // doesn't jump away straight after the visitor chose a slide.
    const restart = () => { if (timer) { clearInterval(timer); timer = null; update(); } };
    dotsContainer?.addEventListener('click', restart);
    prevBtn?.addEventListener('click', restart);
    nextBtn?.addEventListener('click', restart);
    track.addEventListener('touchend', restart, { passive: true });
  }

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
