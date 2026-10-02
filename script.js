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
    p(`M-4 ${cy}H${L + 4}`, 'dash') +
    p(`M0 92H${L}M0 88V96M${noseL} 88V96M${noseL + bay} 88V96M${L} 88V96`, 'dim') +
    t(noseL / 2, 106, 'NOSE 162.6 MM') + t(noseL + bay / 2, 106, 'FORWARD BAY 624 MM') + t(noseL + bay + 225, 106, 'FIN CAN 900 MM');
})();

/* Sidebar nav and section labels */
const ol = $('#nav ol')[0], nav = $('#nav')[0];
let secs = [], links = [], cur = -1;
const io = new IntersectionObserver((es) => es.forEach((e) => {
  if (!e.isIntersecting) return;
  const i = secs.indexOf(e.target);
  if (i === cur || i < 0) return;
  cur = i;
  links.forEach((a, j) => a.classList.toggle('on', j === i));
}), { rootMargin: '-45% 0px -55% 0px' });
const build = () => {
  secs = $('main section:not(.pending)');
  const nn = (i) => String(i + 1).padStart(2, '0');
  ol.innerHTML = secs.map((s, i) => `<li><a href="#${s.id}"><em>${nn(i)}</em>${s.dataset.title}</a></li>`).join('');
  secs.forEach((s, i) => { const l = $('.sh .lab', s)[0]; if (l) l.textContent = `${nn(i)} / ${s.dataset.title}`; });
  links = $('#nav a');
  io.disconnect(); cur = -1;
  secs.forEach((s) => io.observe(s));
};
build();
/* The 3D section appears only when the model file loads */
$('model-viewer')[0].addEventListener('load', () => { $('#model')[0].classList.remove('pending'); build(); });

/* Reveal on enter: anything at or above the viewport is revealed, so reloads and jumps never leave hidden content */
const panels = $('main section');
let tick = false;
const reveal = () => {
  tick = false;
  panels.forEach((s) => { if (!s.classList.contains('in') && s.getBoundingClientRect().top < innerHeight * 0.85) s.classList.add('in'); });
};
const queue = () => { if (!tick) { tick = true; requestAnimationFrame(reveal); } };
addEventListener('scroll', queue, { passive: true });
addEventListener('resize', queue);
addEventListener('load', queue);
reveal();
setTimeout(reveal, 400);

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
$('[data-count]').forEach((el) => {
  if (!reduce) el.textContent = (0).toFixed(+(el.dataset.dec || 0));
  cio.observe(el);
});

/* Videos play only while visible */
const vio = new IntersectionObserver((es) => es.forEach((e) => (e.isIntersecting ? e.target.play().catch(() => {}) : e.target.pause())), { threshold: 0.4 });
$('video[data-auto]').forEach((v) => vio.observe(v));

/* Rail progress */
const prog = () => nav.style.setProperty('--p', (scrollY / (document.documentElement.scrollHeight - innerHeight || 1)).toFixed(3));
addEventListener('scroll', prog, { passive: true }); prog();

/* Deterministic reloads: reveal fonts only when ready, and always land on the hash section or the top */
document.fonts && document.fonts.ready.then(() => document.documentElement.classList.add('ready'));
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
let moved = false;
['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach((t) => addEventListener(t, () => { moved = true; }, { once: true, passive: true }));
const land = () => {
  if (moved) return;
  const t = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
  if (t && !t.classList.contains('pending')) t.scrollIntoView({ behavior: 'instant', block: 'start' });
  else scrollTo({ top: 0, behavior: 'instant' });
  reveal(); prog();
};
land();
addEventListener('load', () => { land(); setTimeout(land, 300); }, { once: true });
/* Keep the URL hash in step with the active section so a reload returns to it */
ol.addEventListener('click', (e) => { const a = e.target.closest('a'); if (a) history.replaceState(null, '', a.getAttribute('href')); });

/* Design: play the simulation once, settle back on the still, replay on click */
(() => {
  const mk = $('.sim')[0];
  if (!mk) return;
  const v = $('video', mk)[0];
  const play = () => {
    if (mk.classList.contains('playing')) return;
    v.currentTime = 0;
    v.play().then(() => mk.classList.add('playing')).catch(() => {});
  };
  v.addEventListener('ended', () => mk.classList.remove('playing'));
  v.addEventListener('error', () => mk.classList.remove('playing'));
  mk.addEventListener('click', play);
  mk.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); play(); } });
  const o = new IntersectionObserver((es) => {
    if (es[0].isIntersecting) { o.disconnect(); if (!reduce) setTimeout(play, 1200); }
  }, { threshold: 0.5 });
  o.observe(mk);
})();
