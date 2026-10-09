// Home: the mission console. Interactive Buddy, live market counters, a scroll-driven flight path,
// the loan preview (Buddy reacts to health), a typed terminal, a mission patch maker and a warp launch.
import { h, s, numberField, range, kv, money, pct, healthText, healthChip, gauge, qs, coinImg } from '../ui.js';
import { pageHead, marketSelect, bayCard, marketList, blockList, btn, marketStatus, pickMarket, unitsForValue, liveStatus, isLive, usd } from '../components.js';
import { getState, scenarioOf, isPaused } from '../store.js';
import { previewBorrow, utilization, borrowAPR, fmtPrice } from '../engine.js';
import { CONFIG } from '../config.js';
import { buddy } from '../buddy.js';
import { play } from '../sfx.js';
import { motionOn, reveal, onReveal, countUp, scramble, splitWords, typeLines, starfield, tilt, magnetic } from '../fx.js';
import { patchMaker } from '../patch.js';

export const title = 'Mission console';

export function render() {
  const cleanups = [];
  const live = () => marketList().filter(isLive);

  // ================= HERO =================
  const stars = h('canvas', { class: 'hero-stars', 'aria-hidden': 'true' });
  const eyebrow = h('span', { class: 'eyebrow scramble' }, 'MISSION CONSOLE · ROBINHOOD CHAIN × USDG');
  const h1 = h('h1', { class: 'hero-title' }, h('span', { class: 'line' }, ...splitWords('Keep the meme.')), h('span', { class: 'line accent' }, ...splitWords('Unlock the liquidity.', 'late')));
  const statEls = {};
  const stat = (key, label) => h('div', { class: 'hstat' }, statEls[key] = h('strong', {}, '—'), h('span', {}, label));
  const statsRow = h('div', { class: 'hstats' }, stat('n', 'USDG markets'), stat('liq', 'Pool liquidity'), stat('vol', '24h volume'), stat('fee', 'Opening fee'));
  const statsSrc = h('p', { class: 'hstats-src small muted' });

  const bd = buddy({ size: 340, sleeping: true });
  cleanups.push(() => bd.destroy());
  const orbit = h('div', { class: 'orbit', 'aria-label': 'Top markets' });
  const drawOrbs = () => {
    const ms = live().slice(0, 6);
    orbit.replaceChildren(...ms.map((m, i) => h('a', { class: 'orb', href: `#/market?m=${m.id}`, style: `--i:${i};--n:${ms.length}`, 'aria-label': `${m.symbol} market` },
      h('span', { class: 'orb-in' }, coinImg(m, 24), h('b', {}, m.symbol), h('i', { class: (m.stats.change?.h24 ?? 0) >= 0 ? 'up' : 'down' }, `${(m.stats.change?.h24 ?? 0) >= 0 ? '+' : ''}${(m.stats.change?.h24 ?? 0).toFixed(1)}%`)))));
  };
  drawOrbs();
  const cue = h('button', { type: 'button', class: 'scroll-cue', 'data-sfx': 'own', onclick: () => { bd.wake(); hero.classList.add('awake'); document.getElementById('h-preview')?.scrollIntoView({ behavior: motionOn() ? 'smooth' : 'auto' }); } }, h('span', { class: 'mouse', 'aria-hidden': 'true' }), 'Scroll to wake Buddy');

  const hero = h('section', { class: 'hero2 bleed no-rv', 'aria-labelledby': 'hero-h' },
    stars,
    h('div', { class: 'hero-floor', 'aria-hidden': 'true' }, h('div', { class: 'floor-grid' }), h('div', { class: 'floor-glow' })),
    h('div', { class: 'hero2-grid' },
      h('div', { class: 'hero2-copy' },
        h('div', { class: 'eyebrow-row' }, eyebrow),
        Object.assign(h1, { id: 'hero-h' }),
        h('p', { class: 'lead' }, 'Borrow USDG against a Robinhood Chain memecoin without selling it, or lend to the one market you choose. Every market is isolated, with its own limits and reserve.'),
        h('div', { class: 'btn-row hero-cta' },
          btn('Try a loan', { kind: 'primary', href: '#/borrow' }), btn('Lend', { href: '#/lend' }),
          h('a', { class: 'btn ghost', href: CONFIG.storyUrl, target: '_blank', rel: 'noopener' }, "▶ Buddy's story")),
        statsRow, statsSrc),
      h('div', { class: 'hero2-stage' },
        h('div', { class: 'rings', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')),
        orbit, bd.el,
        h('p', { class: 'stage-hint small' }, 'Tap him. He has opinions.'))),
    cue);

  bd.el.addEventListener('wake', () => hero.classList.add('awake'));
  const sf = starfield(stars); cleanups.push(() => sf.destroy());
  // wake Buddy on first scroll (or tap); his eye then follows the pointer
  const onScroll = () => { if (scrollY > 40 && !bd.awake) bd.wake(); hero.classList.toggle('awake', bd.awake); hero.style.setProperty('--hs', Math.min(1, scrollY / 600).toFixed(3)); };
  addEventListener('scroll', onScroll, { passive: true }); cleanups.push(() => removeEventListener('scroll', onScroll));
  const idleWake = setTimeout(() => { if (!bd.awake) bd.say('Zzz… (scroll or tap to wake me)', 3000); }, 4500); cleanups.push(() => clearTimeout(idleWake));

  function fillStats(animate) {
    const ms = live(); const L = getState().live || {};
    const liq = ms.reduce((a, m) => a + (m.stats.liquidityUsd || 0), 0), vol = ms.reduce((a, m) => a + (m.stats.volume24 || 0), 0);
    const set = (k, v, f) => (animate ? countUp(statEls[k], v, f) : (statEls[k].textContent = f(v)));
    set('n', ms.length, (v) => String(Math.round(v)));
    set('liq', liq, usd); set('vol', vol, usd);
    set('fee', 0.5, (v) => `${v.toFixed(1)}%`);
    const snap = ms.some((m) => m.snapshot);
    statsSrc.textContent = ms.length ? `${snap ? 'Market data from' : 'Live from'} DexScreener · ${new Date(L.fetchedAt || Date.now()).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : '';
  }
  requestAnimationFrame(() => { scramble(eyebrow, eyebrow.textContent, 1100); fillStats(true); hero.classList.add('ready'); });

  // ================= MARQUEE =================
  const band = (items, cls) => h('div', { class: `band ${cls}`, 'aria-hidden': 'true' }, h('div', { class: 'band-track' }, ...items, ...items));
  const tickItems = () => marketList().map((m) => { const c = m.stats?.change?.h24; return h('span', { class: 'tk' }, h('b', {}, m.symbol), ` ${fmtPrice(m.price)} USDG `, c == null ? '' : h('em', { class: c >= 0 ? 'up' : 'down' }, `${c >= 0 ? '▲' : '▼'} ${Math.abs(c).toFixed(1)}%`), h('i', {}, '·')); });
  const band2 = band(tickItems(), 'band-b');
  const bands = h('div', { class: 'bands no-rv' }, band2);
  hero.append(bands);   // the ticker sits on the hero's bottom edge

  // ================= LOAN PREVIEW (Buddy reacts) =================
  let mId = pickMarket(null), shock = 0, cap = 0, touched = false;
  const m = () => getState().markets[mId];
  const out = h('div', { class: 'preview-out' });
  const blocks = h('div');
  const g = gauge();
  const healthLabel = h('p', { class: 'gauge-label' });
  const go = btn('Continue in Borrow', { kind: 'primary', href: '#/borrow' });
  const unitsF = numberField({ label: 'Collateral', suffix: getState().markets[mId].symbol, value: unitsForValue(getState().markets[mId]), decimals: 2, onInput: () => { touched = true; calc(); } });
  const debtF = numberField({ label: 'Borrow (gross debt)', suffix: 'USDG', value: '200', decimals: 2, onInput: () => { touched = true; calc(); }, max: () => cap });
  const shockR = range({ label: 'Collateral price change', min: -90, max: 100, step: 5, value: 0, format: (v) => `${v > 0 ? '+' : ''}${v}%`, onInput: (v) => { touched = true; shock = v / 100; calc(); } });
  const switchTo = (v) => { mId = v; const mm = m(); unitsF.el.querySelector('.field-suffix').textContent = mm.symbol; unitsF.set(unitsForValue(mm)); ms.sel.value = v; calc(); };
  const ms = marketSelect({ value: mId, onChange: (v) => { touched = true; switchTo(v); } });
  const mini = buddy({ size: 150, label: 'Buddy reacts to your loan health. Tap him.' });
  cleanups.push(() => mini.destroy());
  let lastState = null;

  function calc() {
    const mm = m();
    const u = unitsF.read({ decimals: mm.unitDecimals });
    const d = debtF.read();
    const sc = { ...scenarioOf(mm.id), priceShock: (scenarioOf(mm.id).priceShock || 0) + shock };
    const pv = previewBorrow(mm, { units: u.ok ? u.value : 0, gross: d.ok ? d.value : 0, scenario: sc, paused: isPaused(mm) });
    cap = pv.capacity.value;
    const lim = pv.capacity.limits.find((l) => l.key === pv.capacity.binding);
    out.replaceChildren(kv([
      ['Accepted price', `${fmtPrice(pv.price.price)} USDG`],
      ['Collateral value', money(pv.C)],
      ['You can borrow up to', `${money(pv.capacity.value)}`, 'strong'],
      ['Limited by', lim.label],
      ['Opening fee (0.5%)', money(pv.fee)],
      ['You receive', money(Math.max(0, pv.proceeds)), 'strong'],
      ['Borrow APR (est.)', pct(pv.apr)],
      ['Liquidation price', pv.liqPrice ? `${fmtPrice(pv.liqPrice)} USDG` : '—'],
    ]));
    g.set(pv.health);
    healthLabel.replaceChildren(h('strong', {}, healthText(pv.health)), ' ', healthChip(pv.health));
    blocks.replaceChildren(blockList(u.ok && d.ok ? pv.blocks : []) || '');
    go.href = `#/borrow${qs({ market: mm.id, units: u.ok ? u.value : '', debt: d.ok ? d.value : '' })}`;
    const st = pv.health.state; const moodNow = st === 'liq' ? 'panic' : st === 'edge' || st === 'warn' ? 'nervous' : 'calm';
    if (touched) { if (lastState && moodNow !== lastState && moodNow === 'panic') play('warn'); mini.setMood(moodNow); }
    preview.dataset.mood = moodNow; lastState = moodNow;
  }
  const preview = h('section', { class: 'panel preview', id: 'h-preview', 'aria-labelledby': 'pv-h' },
    h('div', { class: 'panel-head' }, h('h2', { id: 'pv-h' }, 'Try a loan'), h('span', { class: 'muted small' }, 'Live price · loan preview')),
    h('div', { class: 'preview-grid' },
      h('div', { class: 'preview-in' }, ms.el, unitsF.el, debtF.el, shockR.el, h('p', { class: 'small muted' }, 'Drag the price down and watch Buddy.')),
      h('div', { class: 'preview-gauge' }, mini.el, g.el, healthLabel, blocks),
      out),
    h('div', { class: 'btn-row' }, go, btn('Lend instead', { href: '#/lend' })));

  // ================= FLIGHT PATH (scroll-driven) =================
  const STEPS = [
    ['01', 'Lock one meme', 'Deposit a memecoin into its own market. You keep the upside.', '#/borrow'],
    ['02', 'Borrow USDG', 'Up to the opening LTV. The 0.5% fee is shown before you confirm.', '#/borrow'],
    ['03', 'Watch your health', 'Above 1.0 is safe. Below it, the loan can be liquidated.', '#/positions'],
    ['04', 'Repay, get it back', 'Repay any time. Full repayment releases your collateral.', '#/positions'],
  ];
  const path = s('path', { class: 'fp-path', d: 'M40 160 C 200 20, 360 20, 500 100 S 800 180, 960 40' });
  const trail = s('path', { class: 'fp-trail', d: 'M40 160 C 200 20, 360 20, 500 100 S 800 180, 960 40' });
  const ship = s('g', { class: 'fp-ship' }, s('circle', { r: 26, class: 'fp-halo' }), s('image', { href: 'assets/buddy-face.webp', x: -22, y: -22, width: 44, height: 44 }));
  const nodes = STEPS.map((_, i) => s('circle', { class: 'fp-node', r: 9 }));
  const fpSvg = s('svg', { class: 'fp-svg', viewBox: '0 0 1000 200', 'aria-hidden': 'true' }, path, trail, ...nodes, ship);
  const cards = STEPS.map(([n, t, b, href]) => h('a', { class: 'fp-card panel', href }, h('span', { class: 'fp-n' }, n), h('strong', {}, t), h('span', { class: 'muted' }, b)));
  const flight = h('section', { class: 'flight no-rv', 'aria-labelledby': 'fp-h' },
    h('div', { class: 'flight-sticky' },
      h('div', { class: 'section-head' }, h('h2', { id: 'fp-h' }, 'How a loan flies'), h('a', { href: '#/how-it-works' }, 'Full briefing →')),
      fpSvg, h('div', { class: 'fp-cards' }, cards)));
  let fpStep = -1, len = 0;
  function fpUpdate() {
    if (!len) { len = path.getTotalLength(); trail.style.strokeDasharray = `${len}`; STEPS.forEach((_, i) => { const p = path.getPointAtLength(len * (i / (STEPS.length - 1))); nodes[i].setAttribute('cx', p.x); nodes[i].setAttribute('cy', p.y); }); }
    let p = 1;
    const sticky = flight.firstChild; const fits = motionOn() && innerWidth > 760 && sticky.offsetHeight <= innerHeight - 90;
    flight.classList.toggle('flat', !fits);
    if (fits) { const r = flight.getBoundingClientRect(); p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - innerHeight))); }
    trail.style.strokeDashoffset = `${len * (1 - p)}`;
    const pt = path.getPointAtLength(len * p); const pt2 = path.getPointAtLength(Math.min(len, len * p + 2));
    ship.setAttribute('transform', `translate(${pt.x} ${pt.y}) rotate(${(Math.atan2(pt2.y - pt.y, pt2.x - pt.x) * 180) / Math.PI * 0.25})`);
    const step = Math.min(STEPS.length - 1, Math.floor(p * (STEPS.length - 1) + 0.15));
    cards.forEach((c, i) => c.classList.toggle('on', i <= step)); nodes.forEach((nd, i) => nd.classList.toggle('on', i <= step));
    if (step !== fpStep) { if (fpStep >= 0 && motionOn()) play('tick', 0.4 + step * 0.15); fpStep = step; }
  }
  const onFp = () => requestAnimationFrame(fpUpdate);
  addEventListener('scroll', onFp, { passive: true }); addEventListener('resize', onFp);
  cleanups.push(() => { removeEventListener('scroll', onFp); removeEventListener('resize', onFp); });
  requestAnimationFrame(fpUpdate);

  // ================= MARKET BAYS =================
  const status = liveStatus();
  const bays = h('div', { class: 'bays' });
  const drawBays = () => { bays.replaceChildren(...marketList().slice(0, 8).map((mm) => bayCard(mm))); bays.querySelectorAll('.bay').forEach((b) => { tilt(b); b.classList.add('rv', 'in'); }); };
  drawBays();

  // ================= TERMINAL =================
  const pre = h('pre', { class: 'term-out', 'aria-live': 'off' });
  const termLines = () => {
    const n = live().length;
    return ['$ meloan status --network robinhood',
      `network       ${CONFIG.network.name} (${CONFIG.network.chainId})`,
      'loan asset    USDG · Global Dollar (Paxos)',
      `markets       ${n} Robinhood meme markets · USDG loans`,
      'opening fee   0.5%, financed into the loan',
      'interest      15% to protocol → 60% reserve / 40% ops',
      'loss order    market reserve → that market’s lenders',
      'listing       one market per meme · no auto-listing',
      'oracle        deepest USDG / ETH / WETH pool · stale after 5 min',
      '$ ▍'];
  };
  const term = h('section', { class: 'term panel', 'aria-labelledby': 'term-h' },
    h('div', { class: 'term-bar' }, h('i'), h('i'), h('i'), h('span', { id: 'term-h' }, 'meloan — protocol status')), pre,
    h('p', { class: 'sr' }, termLines().slice(1, -1).join('. ')));
  onReveal(reveal(term), () => typeLines(pre, termLines()));

  // ================= PATCH + LAUNCH =================
  const patch = h('section', { class: 'panel patch-sec', 'aria-labelledby': 'patch-h' },
    h('div', { class: 'section-head' }, h('h2', { id: 'patch-h' }, 'Join the crew'), h('span', { class: 'muted small' }, 'Make your mission patch')),
    patchMaker());
  const warp = h('div', { class: 'warp', 'aria-hidden': 'true' });
  const launchBtn = h('button', { type: 'button', class: 'btn primary launch-btn', 'data-sfx': 'own', 'data-magnetic': '', onclick: () => {
    play('warp'); sf.warp(true);
    if (!motionOn()) { location.hash = '#/borrow'; return; }
    document.body.append(warp); requestAnimationFrame(() => warp.classList.add('go'));
    setTimeout(() => { location.hash = '#/borrow'; }, 900); setTimeout(() => warp.remove(), 1500);
  } }, 'Start borrowing');
  magnetic(launchBtn, 0.35);
  const launch = h('section', { class: 'launch', 'aria-labelledby': 'launch-h' },
    h('div', { class: 'launch-glow', 'aria-hidden': 'true' }),
    h('h2', { id: 'launch-h' }, 'Ready for liftoff?'),
    h('p', { class: 'muted' }, 'Pick a Robinhood Chain token, borrow USDG against it, and see every fee and risk before you confirm.'),
    h('div', { class: 'btn-row' }, launchBtn, btn('Read the risks', { kind: 'ghost', href: '#/docs?s=17' })));

  const el = h('div', { class: 'page home home2' },
    hero, preview, flight,
    h('section', { 'aria-labelledby': 'bays-h' },
      h('div', { class: 'section-head' }, h('h2', { id: 'bays-h' }, 'Market bays'), h('a', { href: '#/markets' }, `All ${marketList().length} markets →`)),
      status.el, bays),
    term, patch, launch);
  calc();
  return {
    el,
    update() {
      ms.refresh(mId); if (!getState().markets[mId]) switchTo(pickMarket(null));
      drawBays(); drawOrbs(); status.update(); fillStats(false);
      band2.firstChild.replaceChildren(...tickItems(), ...tickItems());
      calc();
    },
    destroy() { cleanups.forEach((f) => f()); warp.remove(); },
  };
}
