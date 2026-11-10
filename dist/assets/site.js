// Sections fade up as they scroll in. Content is visible without this script.
(() => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
  const els = document.querySelectorAll('main section, body > section');
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }, { rootMargin: '0px 0px -8% 0px' });
  for (const el of els) { if (el.getBoundingClientRect().top > innerHeight) { el.classList.add('reveal'); io.observe(el); } }
})();
