const $ = (s, e = document) => [...e.querySelectorAll(s)];
const clamp = (v) => Math.min(1, Math.max(0, v));
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Rocket profile, drawn to scale from the OpenRocket file (1 unit = 2 mm) */
(() => {
  const L = 843.5, cy = 40, r = 10.45, noseL = 81.3, bay = 312;
  const fx = L - 6.35 - 88.9; // fin root leading edge
  const p = (d, c = '') => `<path pathLength="1" class="${c}" d="${d}"/>`;
  const fin = (s) => `M${fx} ${cy + s * r}L${fx + 12.7} ${cy + s * (r + 25.4)}H${fx + 38.1}L${L - 6.35} ${cy + s * r}`;
  const t = (x, y, s) => `<text x="${x}" y="${y}" text-anchor="middle">${s}</text>`;
  $('#rocket')[0].innerHTML =
    p(`M0 ${cy}C32 36 62 ${cy - r} ${noseL} ${cy - r}H${L}V${cy + r}H${noseL}C62 ${cy + r} 32 44 0 ${cy}Z`) +
    p(`M${noseL + bay} ${cy - r}V${cy + r}`) +
    p(`M${L - 190} ${cy - 9.65}H${L}M${L - 190} ${cy + 9.65}H${L}M${L - 190} ${cy - 9.65}V${cy + 9.65}`, 'dash') +
    p(fin(-1), 'fin') + p(fin(1), 'fin') +
    p(`M0 92H${L}M0 88V96M${noseL} 88V96M${noseL + bay} 88V96M${L} 88V96`, 'dim') +
    t(noseL / 2, 106, 'NOSE 162.6 MM') + t(noseL + bay / 2, 106, 'FORWARD BAY 624 MM') + t(noseL + bay + 225, 106, 'FIN CAN 900 MM');
})();

/* Sidebar nav, header readout */
const ol = $('#nav ol')[0], hud = $('#hud')[0];
let secs = [], links = [], cur = -1;
const io = new IntersectionObserver((es) => es.forEach((e) => {
  if (!e.isIntersecting) return;
  const i = secs.indexOf(e.target);
  if (i === cur || i < 0) return;
  cur = i;
  links.forEach((a, j) => a.classList.toggle('on', j === i));
  hud.innerHTML = `<em>${String(i + 1).padStart(2, '0')}</em> / ${String(secs.length).padStart(2, '0')} &nbsp; ${e.target.dataset.title}`;
}), { rootMargin: '-50% 0px -50% 0px' });
const build = () => {
  secs = $('main section:not(.pending)');
  ol.innerHTML = secs.map((s) => `<li><a href="#${s.id}"><span>${s.dataset.title}</span><i></i></a></li>`).join('');
  links = $('#nav a');
  io.disconnect(); cur = -1;
  secs.forEach((s) => io.observe(s));
};
build();
/* The 3D section appears only when the model file loads */
$('model-viewer')[0].addEventListener('load', () => { $('#model')[0].classList.remove('pending'); build(); });

/* Reveal on enter */
const rio = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) e.target.classList.add('in'); }), { threshold: 0.25 });
$('main section').forEach((s) => rio.observe(s));

/* Counters */
const count = (el) => {
  const to = +el.dataset.count, d = +(el.dataset.dec || 0), t0 = performance.now();
  const step = (t) => {
    const k = reduce ? 1 : clamp((t - t0) / 1800), v = to * (1 - Math.pow(1 - k, 4));
    el.textContent = v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
};
const cio = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { count(e.target); cio.unobserve(e.target); } }), { threshold: 0.6 });
$('[data-count]').forEach((el) => cio.observe(el));

/* Videos play only while visible */
const vio = new IntersectionObserver((es) => es.forEach((e) => (e.isIntersecting ? e.target.play().catch(() => {}) : e.target.pause())), { threshold: 0.4 });
$('video[data-auto]').forEach((v) => vio.observe(v));

/* Scroll-driven: progress line, background parallax, frame reveals */
const bar = $('.prog')[0], bgs = $('.bg'), wipes = $('.wipe');
const frame = () => {
  bar.style.transform = `scaleX(${scrollY / (document.documentElement.scrollHeight - innerHeight || 1)})`;
  if (!reduce) {
    bgs.forEach((b) => {
      const r = b.parentElement.getBoundingClientRect();
      if (Math.abs(r.top) < innerHeight * 1.2) b.style.transform = `translate3d(0,${(-r.top * 0.12).toFixed(1)}px,0)`;
    });
    wipes.forEach((w) => {
      const r = w.getBoundingClientRect();
      w.style.setProperty('--e', clamp((innerHeight - r.top) / (innerHeight * 0.7)).toFixed(3));
    });
  }
  requestAnimationFrame(frame);
};
frame();
