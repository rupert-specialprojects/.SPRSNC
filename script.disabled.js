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

/* Title split */
$('[data-split]').forEach((h) => {
  h.innerHTML = [...h.textContent].map((c, i) => `<span style="--i:${i}" aria-hidden="true">${c}</span>`).join('');
});

/* Sidebar nav */
const secs = $('main section'), ol = $('#nav ol')[0], hud = $('#hud')[0], scan = $('.scan')[0];
secs.forEach((s) => ol.insertAdjacentHTML('beforeend', `<li><a href="#${s.id}"><b></b><span>${s.dataset.title}</span></a></li>`));
const links = $('#nav a');

/* Scramble text */
const GL = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#/';
const scramble = (el) => {
  const txt = el.textContent, n = txt.length;
  if (reduce) return;
  let f = 0;
  const id = setInterval(() => {
    el.textContent = [...txt].map((c, i) => (c === ' ' || i < f / 1.6 ? c : GL[(Math.random() * GL.length) | 0])).join('');
    if (++f > n * 1.6) { clearInterval(id); el.textContent = txt; }
  }, 28);
};

/* Active section, HUD, scan line */
let cur = -1;
const io = new IntersectionObserver((es) => es.forEach((e) => {
  if (!e.isIntersecting) return;
  const i = secs.indexOf(e.target);
  if (i === cur) return;
  const first = cur < 0;
  cur = i;
  links.forEach((a, j) => a.classList.toggle('on', j === i));
  hud.innerHTML = `<em>${String(i + 1).padStart(2, '0')}</em> / ${String(secs.length).padStart(2, '0')} &nbsp; ${e.target.dataset.title}`;
  if (!first && !reduce) { scan.classList.remove('go'); void scan.offsetWidth; scan.classList.add('go'); }
  const h = $('[data-scr]', e.target)[0];
  if (h && !h.dataset.done) { h.dataset.done = 1; scramble(h); }
}), { rootMargin: '-50% 0px -50% 0px' });
secs.forEach((s) => io.observe(s));

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

/* Starfield streaks that stretch with scroll speed */
const cv = $('#fx')[0], cx = cv.getContext('2d');
let W, H, pts = [], lastY = scrollY, vel = 0;
const size = () => {
  W = cv.width = innerWidth; H = cv.height = innerHeight;
  pts = Array.from({ length: 120 }, () => ({ x: Math.random() * W, y: Math.random() * H, z: Math.random() * 0.9 + 0.1 }));
};
addEventListener('resize', size); size();

/* Scroll-driven wipes, progress bar, streaks */
const wipes = $('.wipe'), bar = $('.bar i')[0];
const frame = () => {
  vel += ((scrollY - lastY) - vel) * 0.12; lastY = scrollY;
  bar.style.transform = `scaleY(${scrollY / (document.documentElement.scrollHeight - innerHeight || 1)})`;
  wipes.forEach((w) => {
    const r = w.getBoundingClientRect();
    w.style.setProperty('--e', reduce ? 1 : clamp((innerHeight - r.top) / (innerHeight * 0.75)).toFixed(3));
  });
  if (!reduce) {
    cx.clearRect(0, 0, W, H);
    cx.strokeStyle = 'rgba(236,239,242,.55)';
    pts.forEach((p) => {
      p.y -= vel * p.z * 0.9 + p.z * 0.15;
      if (p.y < -60) p.y = H + 10; else if (p.y > H + 60) p.y = -10;
      cx.globalAlpha = p.z * 0.7;
      cx.lineWidth = p.z * 1.4;
      cx.beginPath(); cx.moveTo(p.x, p.y); cx.lineTo(p.x, p.y + 1 + Math.abs(vel) * p.z * 1.6); cx.stroke();
    });
  }
  requestAnimationFrame(frame);
};
frame();
