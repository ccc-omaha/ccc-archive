(() => {
  // Landing page search
  const q = document.getElementById('q');
  if (q) {
    const items = [...document.querySelectorAll('.shelf__item')];
    const years = [...document.querySelectorAll('.year')];
    const empty = document.querySelector('.empty');
    const run = () => {
      const terms = q.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
      let shown = 0;
      items.forEach((el) => {
        const hit = terms.every((t) => el.dataset.search.includes(t));
        el.hidden = !hit;
        if (hit) shown++;
      });
      years.forEach((y) => { y.hidden = !y.querySelector('.shelf__item:not([hidden])'); });
      empty.hidden = shown > 0;
    };
    q.addEventListener('input', run);
  }

  // Video lightbox
  const box = document.querySelector('.lightbox');
  if (box) {
    const frame = box.querySelector('.lightbox__frame');
    const close = () => { box.close(); };
    box.addEventListener('close', () => { frame.innerHTML = ''; });
    box.querySelector('.lightbox__close').addEventListener('click', close);
    box.addEventListener('click', (e) => { if (e.target === box) close(); });
    document.querySelectorAll('[data-embed]').forEach((a) => {
      a.addEventListener('click', (e) => {
        if (!box.showModal) return;
        e.preventDefault();
        const f = document.createElement('iframe');
        f.src = a.dataset.embed;
        f.title = a.dataset.title || 'Video';
        f.allow = 'autoplay; fullscreen; picture-in-picture; encrypted-media';
        f.allowFullscreen = true;
        frame.replaceChildren(f);
        box.showModal();
      });
    });
  }

  // Highlight the current section in the contents list
  const links = [...document.querySelectorAll('.toc a')];
  if (links.length && 'IntersectionObserver' in window) {
    const map = new Map(links.map((l) => [l.getAttribute('href').slice(1), l]));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          links.forEach((l) => l.classList.remove('is-on'));
          map.get(en.target.id)?.classList.add('is-on');
        }
      });
    }, { rootMargin: '-30% 0px -60% 0px' });
    map.forEach((_, id) => { const s = document.getElementById(id); if (s) io.observe(s); });
  }
})();
