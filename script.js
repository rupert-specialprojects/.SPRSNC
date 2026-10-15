/* ---------------------------------------------------------------
   Supersonic L1
   1. Draws the rocket to scale from the OpenRocket geometry.
   2. Turns vertical scrolling into travel along the rocket.
   3. Draws the three simulation charts and the flight profile.
---------------------------------------------------------------- */
(() => {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fmt = (n, d = 0) => Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

  // One broken piece should never take the whole page down with it.
  const safe = (fn, label) => { try { fn(); } catch (err) { console.error('[portfolio]', label || '', err); } };

  function svgEl(name, attrs, parent) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const COLORS = { red: '#f0515a', blue: '#4aa3f0', amber: '#e6b84a', ink: '#f3f4f5' };

  /* ----------------------------------------------------------
     Geometry in millimetres, read from supersonic.ork
  ----------------------------------------------------------- */
  const G = {
    noseL: 162.56, noseR: 20.5, shoulderR: 19.27, shoulderL: 50.8,
    tubeR: 20.8915, wall: 1.5875,
    bayL: 624, canL: 900,
    fin: { root: 177.8, tip: 50.8, sweep: 25.4, h: 50.8, fromEnd: 12.7 },
    motor: { r: 19.0, len: 367 },
    mount: { r: 19.3, len: 380 },
    chute: { len: 250, r: 17.5 },
    rail: [{ fromCanTop: 450 + 17 }, { fromCanTop: 450 - 220.4 }]
  };
  G.bayStart = G.noseL;
  G.canStart = G.noseL + G.bayL;
  G.L = G.noseL + G.bayL + G.canL; // 1686.56

  const rho = (G.noseR ** 2 + G.noseL ** 2) / (2 * G.noseR);
  const noseRadius = x => Math.sqrt(Math.max(0, rho * rho - (G.noseL - x) ** 2)) + G.noseR - rho;

  /* ----------------------------------------------------------
     State
  ----------------------------------------------------------- */
  const stage = $('#stage'), track = $('#track'), rocketHost = $('#rocket'),
        rulerWrap = $('.ruler-wrap'), ruler = $('#ruler'), scroller = $('#scroller'),
        stationEl = $('#station'), stationVal = $('#station-val'), progressEl = $('#progress');
  const L = {};            // layout numbers
  let curX = 0, targetX = 0, raf = 0;

  /* ----------------------------------------------------------
     Layout
  ----------------------------------------------------------- */
  function layout() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const compact = vw <= 760;
    const D = clamp(vh * (compact ? 0.085 : 0.105), 54, 104);   // drawn tube diameter in px
    const k = D / (G.tubeR * 2);
    const cy = compact ? vh * 0.66 : vh * 0.55;
    const gutter = Math.max(vw * 0.06, 20);
    const top = compact ? 84 : clamp(vh * 0.14, 96, 136);
    const panelH = vh - top - 96;

    const x0 = compact ? vw * 0.1 : clamp(vw * 0.58, 520, 1500);
    const introW = compact ? vw * 0.88 : Math.min(x0 - gutter - 48, 760);
    const rocketW = G.L * k;

    const pw = compact ? Math.min(vw * 0.84, 380) : clamp(vw * 0.42, 440, 620);
    const panelGap = compact ? 36 : 64;
    const xS = x0 + rocketW + (compact ? 56 : Math.max(120, vw * 0.09));
    const simsW = pw * 3 + panelGap * 2;

    const photoH = compact ? panelH * 0.32 : panelH;
    const photoW = photoH * 0.75;
    const lbW = compact ? Math.min(vw - gutter * 2, 420) : clamp(vw * 0.32, 400, 520);
    const launchGap = clamp(vw * 0.035, 32, 64);
    const launchW = compact ? Math.max(lbW, photoW) : photoW + launchGap + lbW;
    const secGap = compact ? 56 : 112;
    const xV = xS + simsW + secGap;
    const vCopyW = 248, vGap = clamp(vw * 0.035, 32, 56);
    const videoW = compact ? Math.min(vw * 0.88, 620) : clamp(Math.min(vw * 0.5, (panelH - 24) * 16 / 9), 420, 960);
    const vlogW = compact ? videoW : vCopyW + vGap + videoW;
    const xL = xV + vlogW + secGap;
    const siteGap = compact ? 56 : 112;
    const siteW = compact ? Math.min(vw * 0.88, 620) : clamp(vw * 0.80, 1060, 1240);
    const xM = xL + launchW + siteGap;
    const trackW = xM + siteW + (compact ? gutter : Math.max(vw * 0.08, 40));

    Object.assign(L, { vw, vh, compact, k, cy, x0, rocketW, xS, xV, xL, xM, siteW, trackW, gutter,
      maxX: Math.max(1, trackW - vw), pw, top });

    const root = document.documentElement.style;
    root.setProperty('--k', k.toFixed(4));
    root.setProperty('--cy', cy + 'px');
    root.setProperty('--pw', pw + 'px');
    root.setProperty('--top', top + 'px');
    root.setProperty('--gutter', gutter + 'px');
    root.setProperty('--panel-gap', panelGap + 'px');
    root.setProperty('--intro-w', introW + 'px');
    root.setProperty('--lb-w', lbW + 'px');
    root.setProperty('--site-w', siteW + 'px');
    root.setProperty('--vlog-w', vlogW + 'px');
    root.setProperty('--video-w', videoW + 'px');

    track.style.width = trackW + 'px';
    rulerWrap.style.width = trackW + 'px';
    rocketHost.style.left = x0 + 'px';
    rocketHost.style.width = rocketW + 'px';
    $('#simulation').style.left = xS + 'px';
    $('#vlog').style.left = xV + 'px';
    $('#vlog').style.width = vlogW + 'px';
    $('#launch').style.left = xL + 'px';
    $('#launch').style.width = launchW + 'px';
    $('#site-reveal').style.left = xM + 'px';
    $('#site-reveal').style.width = siteW + 'px';

    // Fewer vertical pixels of scroll than horizontal travel keeps the page short.
    const ratio = 0.62;
    scroller.style.height = (L.maxX * ratio + vh) + 'px';
    L.ratio = ratio;
  }

  /* ----------------------------------------------------------
     Rocket drawing
  ----------------------------------------------------------- */
  function buildRocket() {
    rocketHost.innerHTML = '';
    const { k, cy, vh } = L;
    const HALF = 85; // mm above and below the axis kept in the viewBox
    const svg = svgEl('svg', {
      viewBox: `0 ${-HALF} ${G.L} ${HALF * 2}`,
      width: G.L * k, height: HALF * 2 * k,
      'aria-hidden': 'true', 'shape-rendering': 'geometricPrecision'
    }, rocketHost);
    svg.style.top = (cy - HALF * k) + 'px';

    const line = (w, c, extra = {}) => Object.assign({ stroke: c, 'stroke-width': w, 'vector-effect': 'non-scaling-stroke' }, extra);
    const ink = a => `rgba(243,244,245,${a})`;
    const redA = a => `rgba(240,81,90,${a})`;
    const R = G.tubeR;

    // fins: one in the plane of the view, two foreshortened behind the tube
    const f = G.fin;
    const finTE = G.L - f.fromEnd, finLE = finTE - f.root;
    const finPts = (sign, scale) => {
      const d0 = R * scale, d1 = (R + f.h) * scale;
      return [[finLE, sign * d0], [finTE, sign * d0], [finTE - (f.root - f.sweep - f.tip), sign * d1], [finLE + f.sweep, sign * d1]]
        .map(p => p.join(',')).join(' ');
    };
    svgEl('polygon', Object.assign({ points: finPts(1, 0.5), fill: ink(0.03) }, line(1, ink(0.28))), svg);

    // airframe tubes
    svgEl('rect', Object.assign({ x: G.bayStart, y: -R, width: G.bayL, height: R * 2, fill: '#1c0609' }, line(1.4, COLORS.red)), svg);
    svgEl('rect', Object.assign({ x: G.canStart, y: -R, width: G.canL, height: R * 2, fill: '#000' }, line(1.4, ink(0.6))), svg);
    const ir = R - G.wall;
    svgEl('line', Object.assign({ x1: G.bayStart, x2: G.canStart, y1: -ir, y2: -ir }, line(1, redA(0.4))), svg);
    svgEl('line', Object.assign({ x1: G.bayStart, x2: G.canStart, y1: ir, y2: ir }, line(1, redA(0.4))), svg);
    svgEl('line', Object.assign({ x1: G.canStart, x2: G.L, y1: -ir, y2: -ir }, line(1, ink(0.22))), svg);
    svgEl('line', Object.assign({ x1: G.canStart, x2: G.L, y1: ir, y2: ir }, line(1, ink(0.22))), svg);

    // nose cone with its shoulder
    const n = 70, top = [], bot = [];
    for (let i = 0; i <= n; i++) {
      const x = G.noseL * (i / n), r = noseRadius(x);
      top.push([x, -r]); bot.unshift([x, r]);
    }
    svgEl('rect', Object.assign({ x: G.noseL, y: -G.shoulderR, width: G.shoulderL, height: G.shoulderR * 2, fill: 'none' }, line(1, ink(0.4))), svg);
    svgEl('polygon', Object.assign({ points: top.concat(bot).map(p => p.join(',')).join(' '), fill: '#000' }, line(1.4, ink(0.9))), svg);

    // avionics bay: a flat sled carrying the three masses listed in the file
    const sled = G.noseL + 119.6, pnut = G.noseL + 180, wire = G.noseL + 300;
    svgEl('rect', Object.assign({ x: sled - 10, y: -2, width: wire + 25 - sled + 20, height: 4, fill: ink(0.14) }, line(1, ink(0.45))), svg);
    const bayBlock = (x, s) => svgEl('rect', Object.assign({ x, y: -15, width: 25, height: 13, fill: ink(0.06) }, line(1, s)), svg);
    bayBlock(sled, COLORS.red);
    bayBlock(pnut, ink(0.7));
    bayBlock(wire, ink(0.7));
    // inner tube at the bay's aft end
    svgEl('rect', Object.assign({ x: G.canStart - 23 - 49, y: -G.mount.r, width: 49, height: G.mount.r * 2, fill: ink(0.05) }, line(1, ink(0.4))), svg);

    // recovery: parachute and its protector
    svgEl('rect', Object.assign({ x: G.canStart, y: -G.chute.r, width: G.chute.len, height: G.chute.r * 2, rx: 6, fill: ink(0.05) }, line(1, ink(0.55))), svg);
    for (let i = 1; i < 5; i++) {
      const x = G.canStart + (G.chute.len / 5) * i;
      svgEl('path', Object.assign({ d: `M${x - 6},${-G.chute.r + 2} Q${x + 8},0 ${x - 6},${G.chute.r - 2}`, fill: 'none' }, line(1, ink(0.2))), svg);
    }
    svgEl('rect', Object.assign({ x: G.canStart + 260, y: -10, width: 25, height: 20, fill: ink(0.05) }, line(1, ink(0.5))), svg);

    // motor mount and motor
    const mStart = G.L - G.mount.len;
    svgEl('rect', Object.assign({ x: mStart, y: -G.mount.r, width: G.mount.len, height: G.mount.r * 2, fill: 'none' }, line(1, ink(0.4))), svg);
    const mo = G.L - G.motor.len;
    svgEl('rect', Object.assign({ x: mo, y: -G.motor.r, width: G.motor.len, height: G.motor.r * 2, fill: redA(0.14) }, line(1.4, COLORS.red)), svg);
    [mo + 14, G.L - 16].forEach(x => svgEl('line', Object.assign({ x1: x, x2: x, y1: -G.motor.r, y2: G.motor.r }, line(1, redA(0.55))), svg));
    svgEl('rect', Object.assign({ x: G.L - 8, y: -R, width: 8, height: R * 2, fill: '#000' }, line(1, ink(0.7))), svg);

    // rail buttons on the lower side
    G.rail.forEach(b => {
      const cx = G.canStart + b.fromCanTop;
      svgEl('rect', Object.assign({ x: cx - 5.56, y: R, width: 11.1, height: 1.85, fill: ink(0.5) }, line(0.5, ink(0.5))), svg);
      svgEl('rect', Object.assign({ x: cx - 2.9, y: R + 1.85, width: 5.8, height: 5.7, fill: ink(0.5) }, line(0.5, ink(0.5))), svg);
    });

    // the fin in the plane of the view, on top
    svgEl('polygon', Object.assign({ points: finPts(-1, 1), fill: '#050505' }, line(1.4, ink(0.9))), svg);
    svgEl('polygon', Object.assign({ points: finPts(-1, 1), fill: ink(0.07) }, line(0, 'none')), svg);

    buildCallouts();
    buildRuler();
  }

  function buildCallouts() {
    const { k, cy, vh, compact } = L;
    const lead = compact ? 38 : clamp(vh * 0.075, 44, 78);
    const R = G.tubeR;
    const defs = [
      { x: 92,  side: 'down', target: noseRadius(92), lead: lead,
        h: 'Fiberglass ogive nose', p: '163 mm long with a 1 mm wall. A slender profile keeps drag low as the airflow goes supersonic.' },
      { x: G.noseL + 119.6 + 12, side: 'up', target: 15, lead: lead * 0.85, accent: true,
        h: 'Avionics bay', p: 'Altimeter, switch and battery on a removable sled. I arranged a student discount to get the altimeter.' },
      { x: 590, side: 'down', target: R, lead: lead * 1.4,
        h: 'G12 fiberglass airframe', p: 'Filament wound, 41.8 mm outer diameter, 1.6 mm wall. Chosen for stiffness and heat tolerance at Mach\u00a01.1.' },
      { x: G.canStart + 40, side: 'up', target: G.chute.r, lead: lead * 1.2,
        h: '36 in recovery parachute', p: 'Ripstop nylon behind a Nomex protector. Predicted touchdown at 6.4\u00a0m/s.' },
      { x: G.L - G.motor.len + 70, side: 'down', target: G.motor.r, lead: lead, accent: true,
        h: 'Cesaroni I540 motor', p: '38 mm, 634 N·s total impulse. Burns for 1.2\u00a0s at up to 626\u00a0N, held by an AeroPack retainer.' },
      { x: 1544, side: 'up', target: R + G.fin.h, lead: lead * 0.5, accent: true,
        tag: 'Flutter margin / marginal', h: 'Three printed fins',
        p: `PETG at 100% infill, 4 mm thick. Conservative flutter estimate: ${fmt(window.FLUTTER.flutterSpeed)} m/s (${fmt(window.FLUTTER.safetyFactor, 2)}× at a ${fmt(window.FLUTTER.peakSpeed)} m/s peak; ${fmt(window.FLUTTER.required, 1)}× target). Simulation assessment: marginal, but still flyable; calculated margin is below target.` }
    ];
    const H = stage.clientHeight || vh;
    defs.forEach(d => {
      const c = document.createElement('div');
      c.className = `callout ${d.side}${d.accent ? ' accent' : ''}`;
      c.innerHTML = `${d.tag ? `<span class="callout-tag">${d.tag}</span>` : ''}<h3>${d.h}</h3><p>${d.p}</p><span class="lead"></span>`;
      c.style.left = (d.x * k) + 'px';
      const leadEl = c.querySelector('.lead');
      leadEl.style.height = d.lead + 'px';
      if (d.side === 'up') {
        const yEnd = cy - d.target * k - d.lead;        // bottom edge of the text block
        c.style.bottom = (H - yEnd) + 'px';
      } else {
        const yStart = cy + d.target * k + d.lead;      // top edge of the text block
        c.style.top = yStart + 'px';
      }
      c.dataset.lead = d.lead; c.dataset.target = d.target;
      rocketHost.appendChild(c);
    });
    fitCallouts();
  }

  /* Pull a callout's leader shorter when its text would run into the ruler or the header. */
  function fitCallouts() {
    const { k, cy } = L, H = stage.clientHeight || L.vh;
    const floor = H - 96, ceil = 70;
    $$('.callout', rocketHost).forEach(c => {
      const up = c.classList.contains('up'), target = +c.dataset.target, h = c.offsetHeight;
      if (!h) return;
      let lead = +c.dataset.lead;
      if (up) {
        const bottom = cy - target * k - lead, over = ceil - (bottom - h);
        if (over > 0) lead = Math.max(10, lead - over);
        c.style.bottom = (H - (cy - target * k - lead)) + 'px';
      } else {
        const top = cy + target * k + lead, over = top + h - floor;
        if (over > 0) lead = Math.max(10, lead - over);
        c.style.top = (cy + target * k + lead) + 'px';
      }
      c.querySelector('.lead').style.height = lead + 'px';
    });
  }

  function buildRuler() {
    const { k, x0 } = L;
    ruler.innerHTML = '';
    ruler.style.left = x0 + 'px';
    const w = G.L * k;
    const svg = svgEl('svg', { width: w + 40, height: 26, viewBox: `0 0 ${w + 40} 26` }, ruler);
    svgEl('line', { x1: 0, x2: w, y1: .5, y2: .5 }, svg);
    for (let mm = 0; mm <= G.L; mm += 50) {
      const x = mm * k, major = mm % 100 === 0;
      svgEl('line', { x1: x, x2: x, y1: .5, y2: major ? 9 : 5 }, svg);
      if (mm % 200 === 0) {
        const t = svgEl('text', { x, y: 23, 'text-anchor': mm === 0 ? 'start' : 'middle' }, svg);
        t.textContent = mm === 0 ? '0 mm' : fmt(mm);
      }
    }
    svgEl('line', { x1: w, x2: w, y1: .5, y2: 9 }, svg);
    const t = svgEl('text', { x: w, y: 23, 'text-anchor': 'middle' }, svg);
    t.textContent = fmt(G.L);
  }

  /* ----------------------------------------------------------
     Scroll to travel
  ----------------------------------------------------------- */
  function readScroll() {
    const range = Math.max(1, scroller.offsetHeight - L.vh);
    const p = clamp(window.scrollY / range, 0, 1);
    targetX = p * L.maxX;
  }

  function tick() {
    raf = 0;
    const d = targetX - curX;
    curX = reduceMotion || Math.abs(d) < 0.15 ? targetX : curX + d * 0.14;
    const t = `translate3d(${-curX}px,0,0)`;
    track.style.transform = t;
    rulerWrap.style.transform = t;
    progressEl.style.transform = `scaleX(${curX / L.maxX})`;

    // station readout: the point of the rocket at the middle of the screen
    const st = (L.vw / 2 + curX - L.x0) / L.k;
    const on = st >= 0 && st <= G.L;
    stationEl.classList.toggle('on', on);
    if (on) stationVal.textContent = fmt(Math.round(st));

    // active section
    const probe = curX + L.vw * 0.55;
    const active = probe > L.xM ? 'site' : probe > L.xL ? 'launch' : probe > L.xV ? 'vlog' : probe > L.xS ? 'simulation' : 'design';
    $$('.nav button').forEach(b => b.setAttribute('aria-current', String(b.dataset.section === active)));

    if (Math.abs(targetX - curX) > 0.15) raf = requestAnimationFrame(tick);
  }
  function queue() { if (!raf) raf = requestAnimationFrame(tick); }

  function goTo(xTrack) {
    const range = scroller.offsetHeight - L.vh;
    const p = clamp(xTrack / L.maxX, 0, 1);
    window.scrollTo({ top: p * range, behavior: reduceMotion ? 'auto' : 'smooth' });
  }

  /* ----------------------------------------------------------
     Charts
  ----------------------------------------------------------- */
  const niceStep = (span, n) => {
    const raw = span / n, mag = 10 ** Math.floor(Math.log10(raw)), r = raw / mag;
    return (r >= 5 ? 5 : r >= 2 ? 2 : 1) * mag;
  };
  const interp = (s, x) => {
    if (x <= s[0][0]) return s[0][1];
    for (let i = 1; i < s.length; i++) {
      if (x <= s[i][0]) { const [x0, y0] = s[i - 1], [x1, y1] = s[i]; return y0 + (y1 - y0) * (x - x0) / (x1 - x0 || 1); }
    }
    return s[s.length - 1][1];
  };

  function frame(host) {
    host.querySelectorAll('svg, .tip, .legend').forEach(n => n.remove());
    return { w: host.clientWidth, h: host.clientHeight };
  }

  function tipEl(host) {
    const t = document.createElement('div'); t.className = 'tip'; host.appendChild(t); return t;
  }
  function placeTip(tip, host, px, py) {
    const tw = tip.offsetWidth, th = tip.offsetHeight, w = host.clientWidth;
    let x = px + 16; if (x + tw > w) x = px - tw - 16;
    tip.style.left = Math.max(0, x) + 'px';
    tip.style.top = clamp(py - th / 2, 0, host.clientHeight - th) + 'px';
  }

  /* A line chart with a hover crosshair. series: [{name,color,pts,key}] */
  function lineChart(host, o) {
    const { w, h } = frame(host);
    if (w < 40 || h < 40) return;
    const m = { l: 40, r: 14, t: 22, b: 26 };
    const pw = w - m.l - m.r, ph = h - m.t - m.b;
    const X = x => m.l + (x - o.x[0]) / (o.x[1] - o.x[0]) * pw;
    const Y = y => m.t + ph - (y - o.y[0]) / (o.y[1] - o.y[0]) * ph;

    const svg = svgEl('svg', { viewBox: `0 0 ${w} ${h}`, role: 'img', 'aria-label': o.label }, host);
    const grid = svgEl('g', { class: 'g' }, svg), ax = svgEl('g', { class: 'ax' }, svg);

    const ys = niceStep(o.y[1] - o.y[0], 4);
    for (let v = o.y[0]; v <= o.y[1] + 1e-9; v += ys) {
      svgEl('line', { x1: m.l, x2: w - m.r, y1: Y(v), y2: Y(v) }, grid);
      const t = svgEl('text', { x: m.l - 8, y: Y(v) + 4, 'text-anchor': 'end' }, ax); t.textContent = fmt(v);
    }
    const xs = o.xStep || niceStep(o.x[1] - o.x[0], 6);
    for (let v = o.x[0]; v <= o.x[1] + 1e-9; v += xs) {
      const last = v + xs > o.x[1] + 1e-9;
      const t = svgEl('text', { x: X(v), y: h - 6, 'text-anchor': last ? 'end' : 'middle' }, ax);
      t.textContent = fmt(v, xs < 1 ? 1 : 0) + (last ? ' ' + o.xUnit : '');
    }
    svgEl('line', { class: 'base', x1: m.l, x2: w - m.r, y1: Y(o.y[0]), y2: Y(o.y[0]) }, ax);
    const yu = svgEl('text', { x: m.l - 8, y: 9, 'text-anchor': 'end' }, ax); yu.textContent = o.yUnit;

    // bands and vertical markers
    (o.bands || []).forEach(b => {
      svgEl('rect', { x: X(b.x0), y: m.t, width: Math.max(2, X(b.x1) - X(b.x0)), height: ph, fill: 'rgba(74,163,240,.14)' }, svg);
      if (b.label) { const t = svgEl('text', { class: 'lbl ink', x: X(b.x1) + 8, y: m.t + 12 }, svg); t.textContent = b.label; }
    });
    (o.vlines || []).forEach(v => {
      svgEl('line', { class: 'ref', x1: X(v.x), x2: X(v.x), y1: m.t, y2: m.t + ph }, svg);
      if (v.label) { const t = svgEl('text', { class: 'lbl', x: X(v.x) + 6, y: m.t + ph - 8 }, svg); t.textContent = v.label; }
    });
    (o.hlines || []).forEach(r => {
      svgEl('line', { class: 'ref', x1: m.l, x2: w - m.r, y1: Y(r.y), y2: Y(r.y) }, svg);
      const t = svgEl('text', { class: 'lbl ink', x: w - m.r, y: Y(r.y) - 7, 'text-anchor': 'end' }, svg); t.textContent = r.label;
    });

    // series
    o.series.forEach(s => {
      const d = s.pts.map((p, i) => (i ? 'L' : 'M') + X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1)).join('');
      if (s.area) svgEl('path', { d: d + `L${X(s.pts[s.pts.length - 1][0])},${Y(o.y[0])}L${X(s.pts[0][0])},${Y(o.y[0])}Z`, fill: s.color, opacity: .1 }, svg);
      svgEl('path', { d, class: 'line', stroke: s.color, pathLength: 1 }, svg);
    });

    // call-outs on specific points
    (o.marks || []).forEach(mk => {
      const cx = X(mk.x), cy = Y(mk.y);
      svgEl('circle', { cx, cy, r: 4.5, fill: mk.color, class: 'dotring' }, svg);
      if (mk.text) {
        const t = svgEl('text', { class: 'lbl ink', x: cx + (mk.dx ?? 10), y: cy + (mk.dy ?? -8), 'text-anchor': mk.anchor || 'start' }, svg);
        t.textContent = mk.text;
      }
    });
    if (o.bracket) {
      const b = o.bracket, x = X(b.x);
      svgEl('line', { x1: x, x2: x, y1: Y(b.y0), y2: Y(b.y1), stroke: COLORS.ink, 'stroke-width': 1, opacity: .7 }, svg);
      const t = svgEl('text', { class: 'lbl ink', x: x + 10, y: (Y(b.y0) + Y(b.y1)) / 2 + 4 }, svg); t.textContent = b.text;
    }

    // legend, only when there is more than one series
    if (o.series.length > 1) {
      const lg = document.createElement('div'); lg.className = 'legend';
      lg.style.cssText = `position:absolute;left:${m.l}px;top:-4px;display:flex;gap:18px;font-size:12px;color:var(--dim);flex-wrap:wrap`;
      o.series.forEach(s => {
        const i = document.createElement('span');
        i.style.cssText = 'display:inline-flex;align-items:center;gap:7px;white-space:nowrap';
        i.innerHTML = `<i style="display:inline-block;width:14px;height:2px;background:${s.color};border-radius:2px"></i>${s.name}`;
        lg.appendChild(i);
      });
      host.appendChild(lg);
    }

    // hover
    const tip = tipEl(host);
    const cross = svgEl('line', { class: 'cross', y1: m.t, y2: m.t + ph, opacity: 0 }, svg);
    const dots = o.series.map(s => svgEl('circle', { r: 4.5, fill: s.color, class: 'dotring', opacity: 0 }, svg));
    const hit = svgEl('rect', { x: m.l, y: m.t, width: pw, height: ph, fill: 'transparent' }, svg);
    const move = e => {
      const r = svg.getBoundingClientRect();
      const px = clamp(e.clientX - r.left, m.l, w - m.r);
      const xv = o.x[0] + (px - m.l) / pw * (o.x[1] - o.x[0]);
      cross.setAttribute('x1', px); cross.setAttribute('x2', px); cross.setAttribute('opacity', 1);
      let rows = '';
      o.series.forEach((s, i) => {
        if (xv < s.pts[0][0] || xv > s.pts[s.pts.length - 1][0]) {
          dots[i].setAttribute('opacity', 0);
          return;
        }
        const v = interp(s.pts, xv);
        dots[i].setAttribute('cx', px); dots[i].setAttribute('cy', Y(v)); dots[i].setAttribute('opacity', 1);
        rows += `<div><span class="k" style="background:${s.color}"></span>${s.name} ${fmt(v, o.yDec || 0)} ${o.yUnit}</div>`;
      });
      tip.innerHTML = `<div class="t">${o.xName} ${fmt(xv, 2)} ${o.xUnit}</div>${rows}`;
      tip.classList.add('on');
      placeTip(tip, host, px, e.clientY - r.top);
    };
    const leave = () => { cross.setAttribute('opacity', 0); dots.forEach(d => d.setAttribute('opacity', 0)); tip.classList.remove('on'); };
    hit.addEventListener('pointermove', move);
    hit.addEventListener('pointerleave', leave);
  }

  /* Shared bits for the bar charts */
  const roundTop = (x, y, w, h, r) => {
    r = Math.min(r, w / 2, h);
    return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
  };
  const roundEnd = (x, y, w, h, r) => {
    r = Math.min(r, h / 2, w);
    return `M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x}Z`;
  };
  function legendRow(host, items, left) {
    const lg = document.createElement('div'); lg.className = 'legend';
    lg.style.cssText = `position:absolute;left:${left}px;top:-4px;display:flex;gap:18px;font-size:12px;color:var(--dim);flex-wrap:wrap`;
    items.forEach(s => {
      const i = document.createElement('span');
      i.style.cssText = 'display:inline-flex;align-items:center;gap:7px;white-space:nowrap';
      i.innerHTML = `<i style="display:inline-block;width:10px;height:10px;background:${s.color};border-radius:2px"></i>${s.name}`;
      lg.appendChild(i);
    });
    host.appendChild(lg);
  }
  /* Show a tooltip while the pointer is over `target`. */
  function bindTip(host, tip, target, html) {
    target.addEventListener('pointermove', e => {
      const r = host.getBoundingClientRect();
      tip.innerHTML = typeof html === 'function' ? html() : html;
      tip.classList.add('on');
      placeTip(tip, host, e.clientX - r.left, e.clientY - r.top);
    });
    target.addEventListener('pointerleave', () => tip.classList.remove('on'));
  }

  /* Vertical bars, one per category. cats: [{name, value, color, tip}] */
  function barChart(host, o) {
    const { w, h } = frame(host);
    if (w < 80 || h < 80) return;
    const m = { l: 40, r: 10, t: 24, b: 40 };
    const pw = w - m.l - m.r, ph = h - m.t - m.b;
    const Y = y => m.t + ph - (y - o.y[0]) / (o.y[1] - o.y[0]) * ph;
    const svg = svgEl('svg', { viewBox: `0 0 ${w} ${h}`, role: 'img', 'aria-label': o.label }, host);
    const grid = svgEl('g', { class: 'g' }, svg), ax = svgEl('g', { class: 'ax' }, svg);
    const ys = niceStep(o.y[1] - o.y[0], 4);
    for (let v = o.y[0]; v <= o.y[1] + 1e-9; v += ys) {
      svgEl('line', { x1: m.l, x2: w - m.r, y1: Y(v), y2: Y(v) }, grid);
      const t = svgEl('text', { x: m.l - 8, y: Y(v) + 4, 'text-anchor': 'end' }, ax); t.textContent = fmt(v);
    }
    svgEl('line', { class: 'base', x1: m.l, x2: w - m.r, y1: Y(o.y[0]), y2: Y(o.y[0]) }, ax);
    const yu = svgEl('text', { x: m.l - 8, y: 9, 'text-anchor': 'end' }, ax); yu.textContent = o.yUnit;
    (o.hlines || []).forEach(r => {
      svgEl('line', { class: 'ref', x1: m.l, x2: w - m.r, y1: Y(r.y), y2: Y(r.y) }, svg);
      const t = svgEl('text', { class: 'lbl ink', x: w - m.r, y: Y(r.y) - 7, 'text-anchor': 'end' }, svg); t.textContent = r.label;
    });
    const tip = tipEl(host);
    const slot = pw / o.cats.length, bw = Math.min(24, slot * 0.6);
    o.cats.forEach((c, i) => {
      const cx = m.l + slot * (i + 0.5), top = Y(c.value), bh = Y(o.y[0]) - top;
      const bar = svgEl('path', { d: roundTop(cx - bw / 2, top, bw, bh, 4), fill: c.color, class: 'bar' }, svg);
      const v = svgEl('text', { class: 'lbl ink', x: cx, y: top - 8, 'text-anchor': 'middle' }, svg); v.textContent = fmt(c.value);
      const parts = c.name.split(' ');
      const first = parts.shift();
      [first, parts.join(' ')].forEach((line, j) => {
        if (!line) return;
        const t = svgEl('text', { x: cx, y: h - 22 + j * 14, 'text-anchor': 'middle' }, ax); t.textContent = line;
      });
      const hit = svgEl('rect', { x: cx - slot / 2, y: m.t, width: slot, height: ph + m.b, fill: 'transparent' }, svg);
      bindTip(host, tip, hit, c.tip);
    });
    if (o.legend) legendRow(host, o.legend, m.l);
  }

  /* Horizontal bars on one shared axis, each with its label above it.
     rows: [{label, value, color, opacity, tip}] */
  function compareChart(host, o) {
    const { w, h } = frame(host);
    if (w < 120 || h < 100) return;
    const m = { l: 10, r: 14, t: 26, b: 26 };
    const pw = w - m.l - m.r, ph = h - m.t - m.b;
    const X = x => m.l + (x - o.x[0]) / (o.x[1] - o.x[0]) * pw;
    const svg = svgEl('svg', { viewBox: `0 0 ${w} ${h}`, role: 'img', 'aria-label': o.label }, host);
    const grid = svgEl('g', { class: 'g' }, svg), ax = svgEl('g', { class: 'ax' }, svg);
    const xs = niceStep(o.x[1] - o.x[0], 5);
    for (let v = o.x[0]; v <= o.x[1] + 1e-9; v += xs) {
      svgEl('line', { x1: X(v), x2: X(v), y1: m.t, y2: m.t + ph }, grid);
      const last = v + xs > o.x[1] + 1e-9;
      const t = svgEl('text', { x: X(v), y: h - 6, 'text-anchor': v === o.x[0] ? 'start' : last ? 'end' : 'middle' }, ax);
      t.textContent = fmt(v) + (last ? ' ' + o.xUnit : '');
    }
    svgEl('line', { class: 'base', x1: m.l, x2: m.l, y1: m.t, y2: m.t + ph }, ax);
    if (o.target) {
      svgEl('line', { class: 'ref', x1: X(o.target.x), x2: X(o.target.x), y1: m.t - 4, y2: m.t + ph }, svg);
      const t = svgEl('text', { class: 'lbl ink', x: X(o.target.x) - 6, y: m.t - 9, 'text-anchor': 'end' }, svg); t.textContent = o.target.label;
    }
    const tip = tipEl(host);
    const rh = ph / o.rows.length, bh = Math.min(22, rh * 0.38);
    o.rows.forEach((r, i) => {
      const y0 = m.t + rh * i;
      const lab = svgEl('text', { class: 'lbl ink', x: m.l + 10, y: y0 + rh * 0.34 }, svg); lab.textContent = r.label;
      const by = y0 + rh * 0.34 + 8, bw = X(r.value) - X(o.x[0]);
      svgEl('path', { d: roundEnd(m.l, by, bw, bh, 4), fill: r.color, 'fill-opacity': r.opacity ?? 1, class: 'barh' }, svg);
      const v = svgEl('text', { class: 'lbl ink', x: m.l + bw + 8, y: by + bh / 2 + 4 }, svg); v.textContent = `${fmt(r.value)} m/s`;
      const hit = svgEl('rect', { x: m.l, y: y0, width: pw, height: rh, fill: 'transparent' }, svg);
      bindTip(host, tip, hit, r.tip);
    });
  }

  /* Histogram. counts[i] is the number of runs in bin i. */
  function histChart(host, V) {
    const { w, h } = frame(host);
    if (w < 120 || h < 100) return;
    const m = { l: 40, r: 14, t: 24, b: 26 };
    const pw = w - m.l - m.r, ph = h - m.t - m.b;
    const x0 = 1.35, x1 = 1.65, y1 = Math.ceil((Math.max(...V.counts) + 4) / 10) * 10;
    const X = x => m.l + (x - x0) / (x1 - x0) * pw;
    const Y = y => m.t + ph - y / y1 * ph;
    const svg = svgEl('svg', { viewBox: `0 0 ${w} ${h}`, role: 'img',
      'aria-label': `Histogram of top speed over ${V.N} simulated flights, centred near Mach ${fmt(V.mean, 2)}` }, host);
    const grid = svgEl('g', { class: 'g' }, svg), ax = svgEl('g', { class: 'ax' }, svg);
    const ys = niceStep(y1, 4);
    for (let v = 0; v <= y1 + 1e-9; v += ys) {
      svgEl('line', { x1: m.l, x2: w - m.r, y1: Y(v), y2: Y(v) }, grid);
      const t = svgEl('text', { x: m.l - 8, y: Y(v) + 4, 'text-anchor': 'end' }, ax); t.textContent = fmt(v);
    }
    for (let v = x0; v <= x1 + 1e-9; v += 0.05) {
      const last = v + 0.05 > x1 + 1e-9;
      const t = svgEl('text', { x: X(v), y: h - 6, 'text-anchor': v === x0 ? 'start' : last ? 'end' : 'middle' }, ax);
      t.textContent = fmt(v, 2) + (last ? ' Mach' : '');
    }
    svgEl('line', { class: 'base', x1: m.l, x2: w - m.r, y1: Y(0), y2: Y(0) }, ax);
    const yu = svgEl('text', { x: m.l - 8, y: 9, 'text-anchor': 'end' }, ax); yu.textContent = 'runs';

    const tip = tipEl(host);
    V.counts.forEach((n, i) => {
      const lo = V.binStart + i * V.binWidth, hi = lo + V.binWidth;
      const bx = X(lo) + 1, bw = Math.max(1, X(hi) - X(lo) - 2);
      if (n > 0) svgEl('path', { d: roundTop(bx, Y(n), bw, Y(0) - Y(n), 3), fill: COLORS.red, 'fill-opacity': .9, class: 'bar' }, svg);
      const hit = svgEl('rect', { x: X(lo), y: m.t, width: X(hi) - X(lo), height: ph, fill: 'transparent' }, svg);
      bindTip(host, tip, hit, () => `<div class="t">Mach ${fmt(lo, 2)} to ${fmt(hi, 2)}</div><div>${n} run${n === 1 ? '' : 's'}</div>`);
    });
    svgEl('line', { class: 'ref', x1: X(V.mean), x2: X(V.mean), y1: m.t - 4, y2: m.t + ph }, svg);
    const t = svgEl('text', { class: 'lbl ink', x: X(V.mean) + 8, y: m.t - 8 }, svg); t.textContent = `Mean Mach ${fmt(V.mean, 2)}`;
  }

  /* ----------------------------------------------------------
     Content that comes from data.js
  ----------------------------------------------------------- */
  function fillText() {
    const H = window.HEAT, V = window.VELOCITY, FL = window.FLIGHT, S = window.SITE;

    safe(() => {
    const hottest = H.components.reduce((p, c) => (c.peakC > p.peakC ? c : p));
    const finMax = Math.max(...H.components.filter(c => c.group === 'fin').map(c => c.peakC));
    $('#heat-result').innerHTML =
      `Nothing gets hotter than <b>${fmt(hottest.peakC)} °C</b>, at the ${hottest.name.toLowerCase()}. The fins peak at ${fmt(finMax)} °C, well under the ${H.petgTg} °C where PETG starts to soften.`;
    $('#heat-method').textContent =
      `Peak temperature at seven points along the rocket, from the MATLAB heat model. Air brought fully to rest at peak speed would reach about ${fmt(H.stagC)} °C.`;

    $('#station-heat-result').innerHTML =
      `The nose reaches <b>${fmt(hottest.peakC, 1)} °C</b>; the fins peak near <b>${fmt(finMax, 1)} °C</b>, below the nominal ${fmt(H.petgTg)} °C PETG softening point.`;
    $('#station-heat-method').textContent =
      `MATLAB peak-temperature results plotted by station, measured aft from the nose tip. The dashed reference marks the nominal PETG softening temperature.`;

    const speeds = V.counts.map((n, i) => (n ? i : -1)).filter(i => i >= 0);
    const lo = V.binStart + speeds[0] * V.binWidth, hi = V.binStart + (speeds[speeds.length - 1] + 1) * V.binWidth;
    $('#velocity-result').innerHTML =
      `Across ${fmt(V.N)} runs the top speed averages <b>Mach ${fmt(V.mean, 2)}</b> and stays between ${fmt(lo, 2)} and ${fmt(hi, 2)}.`;
    $('#velocity-method').textContent = `${fmt(V.N)}-run Monte Carlo of the flight, built in MATLAB.`;
    }, 'simulation text');

    safe(() => {
    const g = FL.maxAccel / 9.80665;
    $('#flight').innerHTML = [
      ['Predicted apogee', `${fmt(FL.apogee)} m`],
      ['Peak speed', `Mach ${fmt(FL.maxMach, 2)}`],
      ['Peak acceleration', `${fmt(g)} g`],
      ['Time to apogee', `${fmt(FL.timeToApogee, 1)} s`]
    ].map(([t, v]) => `<div><dt>${t}</dt><dd>${v}</dd></div>`).join('');
    }, 'flight stats');

    // launch status and contact
    safe(() => {
    const st = $('#status');
    if (S.launchDate) {
      const days = Math.ceil((new Date(S.launchDate + 'T12:00:00') - Date.now()) / 864e5);
      if (days > 0) st.textContent = `Launch set for ${new Date(S.launchDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}. ${days} day${days === 1 ? '' : 's'} to go.`;
    }
    const c = $('#contact');
    c.textContent = '';
    if (S.name) c.append(`${S.name}. `);
    if (S.contact) { const a = document.createElement('a'); a.href = 'mailto:' + S.contact; a.textContent = S.contact; c.append(a); }
    }, 'contact');
  }

  function renderCharts() {
    const H = window.HEAT, V = window.VELOCITY, FL = window.FLIGHT, P = window.PROFILE;

    safe(() => {
    const GC = { airframe: COLORS.blue, fin: COLORS.amber };
    barChart($('#heat-chart'), {
      label: 'Peak temperature of each component',
      y: [0, 100], yUnit: '°C',
      legend: [{ name: 'Fiberglass airframe', color: COLORS.blue }, { name: 'PETG fins', color: COLORS.amber }],
      hlines: [{ y: H.petgTg, label: `PETG softens at about ${H.petgTg} °C` }],
      cats: H.components.map(c => ({
        name: c.name, value: c.peakC, color: GC[c.group],
        tip: `<div class="t">${c.name}</div><div>${fmt(c.peakC, 1)} °C peak</div><div>${fmt(c.station, 2)} m from the nose</div>`
      }))
    });

    }, 'heat chart');

    safe(() => {
    const airframe = H.components.filter(c => c.group === 'airframe').sort((a, b) => a.station - b.station);
    const fins = H.components.filter(c => c.group === 'fin').sort((a, b) => a.station - b.station);
    const nose = H.components.find(c => c.name === 'Nose tip');
    const finEdge = H.components.find(c => c.name === 'Fin edge');
    lineChart($('#station-heat-chart'), {
      label: 'Peak temperature by station along the rocket, measured in metres aft of the nose',
      x: [0, 1.7], xStep: 0.4, xUnit: 'm', xName: 'Station',
      y: [0, 100], yUnit: '°C', yDec: 1,
      series: [
        { name: 'Fiberglass airframe', color: COLORS.blue, pts: airframe.map(c => [c.station, c.peakC]) },
        { name: 'PETG fins', color: COLORS.amber, pts: fins.map(c => [c.station, c.peakC]) }
      ],
      hlines: [{ y: H.petgTg, label: `PETG softens at about ${fmt(H.petgTg)} °C` }],
      marks: H.components.map(c => ({
        x: c.station, y: c.peakC, color: c.group === 'fin' ? COLORS.amber : COLORS.blue,
        text: c.name === nose.name ? 'Nose tip' : c.name === finEdge.name ? 'Fin edge' : '',
        dx: c.name === 'Nose tip' ? 9 : 9,
        dy: c.name === 'Nose tip' ? -8 : -8
      }))
    });

    }, 'station heat chart');

    safe(() => histChart($('#velocity-chart'), V), 'speed chart');

    safe(() => {

    const [m0, m1] = FL.machWindow;
    lineChart($('#flight-chart'), {
      label: 'Predicted altitude against time',
      x: [0, 16], xStep: 4, y: [0, 2000], yUnit: 'm', xUnit: 's', xName: 'Time',
      series: [{ name: 'Altitude', color: COLORS.red, pts: P.map(r => [r[0], r[1]]) }],
      bands: [{ x0: m0, x1: m1, label: `Supersonic for ${fmt(m1 - m0, 1)} s` }],
      marks: [{ x: FL.timeToApogee, y: FL.apogee, color: COLORS.red, text: 'Apogee', dx: -10, dy: 18, anchor: 'end' }]
    });
    }, 'flight chart');

    // one reveal: lines draw in as each chart arrives on screen
    $$('.chart').forEach(h => {
      h.classList.add('draw');
      if (reduceMotion || !('IntersectionObserver' in window)) { h.classList.add('in'); return; }
      if (h._io) h._io.disconnect();
      const wasIn = h.dataset.seen === '1';
      if (wasIn) { h.classList.add('in'); return; }
      h._io = new IntersectionObserver(es => es.forEach(e => {
        if (e.isIntersecting) { h.classList.add('in'); h.dataset.seen = '1'; h._io.disconnect(); }
      }), { threshold: 0.35 });
      h._io.observe(h);
    });
  }

  function initSiteReveal() {
    const site = $('#site-reveal');
    if (!site) return;
    if (reduceMotion || !('IntersectionObserver' in window)) {
      site.classList.add('is-visible');
      return;
    }
    if (site._revealObserver) site._revealObserver.disconnect();
    site._revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          site.classList.add('is-visible');
          site._revealObserver.disconnect();
        }
      });
    }, { threshold: 0.18 });
    site._revealObserver.observe(site);
  }

  /* Build vlog: YouTube thumbnail + red play button. The player only loads after the click. */
  function initVlog() {
    const player = $('#player'), cover = $('#vlog-cover'), btn = $('#vlog-play');
    if (!player || !cover || !btn) return;
    const V = window.VLOG || {};
    const raw = String(V.video || '').trim();
    // Accept a bare ID or any common YouTube link.
    const m = raw.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/|\/live\/)([\w-]{11})/) || raw.match(/^([\w-]{11})$/);
    const id = m && m[1];

    if (!id) {
      btn.hidden = true;
      cover.remove();
      const note = document.createElement('p');
      note.className = 'player-empty';
      note.textContent = 'Video coming soon';
      player.appendChild(note);
      return;
    }

    // Thumbnail: your own image if given, otherwise YouTube's (best size, falling back to a smaller one).
    if (V.thumbnail) {
      cover.src = V.thumbnail;
    } else {
      cover.src = `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;
      cover.addEventListener('error', () => { cover.src = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`; }, { once: true });
    }

    let frame = null;
    btn.addEventListener('click', () => {
      if (!frame) {
        frame = document.createElement('iframe');
        frame.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1&enablejsapi=1`;
        frame.title = 'Build vlog';
        frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen';
        frame.allowFullscreen = true;
        frame.referrerPolicy = 'strict-origin-when-cross-origin';
        player.appendChild(frame);
      }
      player.classList.add('playing');
    });

    // Pause when the section scrolls out of view.
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(es => es.forEach(e => {
        if (!e.isIntersecting && frame) {
          frame.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }), '*');
        }
      }), { threshold: 0.2 }).observe(player);
    }
  }

  /* ----------------------------------------------------------
     Wire up
  ----------------------------------------------------------- */
  function build() {
    layout();
    safe(buildRocket, 'rocket');
    safe(renderCharts, 'charts');
    readScroll();
    curX = targetX;
    tick();
  }

  let resizeT;
  window.addEventListener('resize', () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => {
      const p = L.maxX ? curX / L.maxX : 0;
      build();
      window.scrollTo(0, p * (scroller.offsetHeight - L.vh));
      readScroll(); curX = targetX; tick();
    }, 120);
  });

  window.addEventListener('scroll', () => { readScroll(); queue(); }, { passive: true });

  // trackpad swipes sideways move the rocket too
  window.addEventListener('wheel', e => {
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && !e.ctrlKey) { e.preventDefault(); window.scrollBy(0, e.deltaX * L.ratio); }
  }, { passive: false });

  window.addEventListener('keydown', e => {
    if (e.target.closest && e.target.closest('input, textarea, video')) return;
    if (e.key === 'ArrowRight') { window.scrollBy({ top: L.vh * 0.5, behavior: 'smooth' }); }
    if (e.key === 'ArrowLeft') { window.scrollBy({ top: -L.vh * 0.5, behavior: 'smooth' }); }
  });

  $$('.nav button').forEach(b => b.addEventListener('click', () => {
    const s = b.dataset.section;
    goTo(s === 'design' ? 0 : s === 'simulation' ? L.xS - L.gutter : s === 'vlog' ? L.xV - L.gutter : s === 'launch' ? L.xL - L.gutter : L.xM - L.gutter);
  }));
  $('.mark').addEventListener('click', e => { e.preventDefault(); goTo(0); });

  safe(fillText, 'text');
  build();
  safe(initSiteReveal, 'site reveal');
  safe(initVlog, 'vlog');
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { safe(fitCallouts, 'callouts'); safe(renderCharts, 'charts'); });
  window.addEventListener('load', () => { safe(fitCallouts, 'callouts'); safe(renderCharts, 'charts'); });
})();
