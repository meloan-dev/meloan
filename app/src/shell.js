// Site shell: header, navigation, footer, router (PRD MLN 26, 29, 31, 33).
import { h, toast } from './ui.js';
import { CONFIG } from './config.js';
import { connect, disconnect, onAccount, getAccount, short } from './wallet.js';
import { prefs, setPref, subscribe, getState } from './store.js';
import { play, setSound, soundOn } from './sfx.js';
import { enhance } from './fx.js';

export const NAV = [
  { path: '/', label: 'Home' },
  { path: '/markets', label: 'Markets' },
  { path: '/borrow', label: 'Borrow' },
  { path: '/lend', label: 'Lend' },
  { path: '/positions', label: 'Positions' },
  { path: '/analytics', label: 'Analytics' },
  { path: '/how-it-works', label: 'How it works' },
  { path: '/docs', label: 'Docs' },
];

export function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, q] = raw.split('?');
  return { path: path || '/', params: Object.fromEntries(new URLSearchParams(q || '')) };
}

function tipBtn({ label, tip, cls = '', onclick, disabled, icon }) {
  const id = `tip-${Math.random().toString(36).slice(2, 8)}`;
  return h('span', { class: 'tipwrap' },
    h('button', { type: 'button', class: `hbtn ${cls}`, 'aria-disabled': disabled ? 'true' : null, 'aria-describedby': tip ? id : null, onclick: disabled ? (e) => e.preventDefault() : onclick }, icon, label),
    tip ? h('span', { role: 'tooltip', id, class: 'tip' }, tip) : null);
}

export function buildHeader() {
  const wordmark = document.getElementById('wordmark-tpl').content.cloneNode(true);
  const navMotion = h('button', { type: 'button', class: 'hbtn ghost', onclick: () => motionBtn.click() });
  const navSound = h('button', { type: 'button', class: 'hbtn ghost', 'data-sfx': 'own', onclick: () => soundBtn.click() });
  const nav = h('nav', { class: 'nav', id: 'nav', 'aria-label': 'Main' }, h('ul', {}, NAV.map((n) => h('li', {}, h('a', { href: `#${n.path}`, 'data-path': n.path }, n.label))), h('li', { class: 'nav-extra' }, navMotion), h('li', { class: 'nav-extra' }, navSound)));
  const menuBtn = h('button', { class: 'hbtn menu-btn', 'aria-expanded': 'false', 'aria-controls': 'nav', onclick: () => { const open = document.body.classList.toggle('nav-open'); menuBtn.setAttribute('aria-expanded', String(open)); } }, h('span', { class: 'burger', 'aria-hidden': 'true' }), h('span', { class: 'sr' }, 'Menu'));

  // motion
  const motionBtn = h('button', { type: 'button', class: 'hbtn ghost motion-btn', 'aria-pressed': 'true', onclick: () => applyMotion(!document.documentElement.classList.contains('motion')) });
  const applyMotion = (on, save = true) => {
    document.documentElement.classList.toggle('motion', on);
    motionBtn.setAttribute('aria-pressed', String(on));
    motionBtn.textContent = on ? 'Motion on' : 'Motion off';
    if (typeof navMotion !== 'undefined') { navMotion.textContent = motionBtn.textContent; navMotion.setAttribute('aria-pressed', String(on)); }
    if (save) setPref('motion', on);
  };
  applyMotion(prefs().motion, false);

  // sound (on by default; browsers start audio after the first tap)
  const icon = (on) => h('span', { class: `snd-ico ${on ? 'on' : ''}`, 'aria-hidden': 'true' }, h('i'), h('i'), h('i'), h('i'));
  const soundBtn = h('button', { type: 'button', class: 'hbtn ghost snd-btn', 'data-sfx': 'own', onclick: () => applySound(!soundOn()) });
  const applySound = (on, save = true) => {
    if (save && !on) play('toggleOff');
    setSound(on);
    if (save && on) setTimeout(() => play('toggleOn'), 30);
    for (const b of [soundBtn, navSound]) { b.replaceChildren(icon(on), h('span', { class: 'snd-label' }, on ? 'Sound on' : 'Sound off')); b.setAttribute('aria-pressed', String(on)); }
    if (save) setPref('sound', on);
  };
  applySound(prefs().sound !== false, false);

  // X and contract address: driven by the one token config (MLN 31)
  const xBtn = CONFIG.xUrl ? h('a', { class: 'hbtn ghost', href: CONFIG.xUrl, target: '_blank', rel: 'noopener', 'aria-label': 'Meloan on X' }, 'X') : null;
  const caBtn = CONFIG.contractAddress
    ? tipBtn({ label: `CA ${short(CONFIG.contractAddress)}`, tip: 'Copy contract address', cls: 'ca', onclick: async () => { try { await navigator.clipboard.writeText(CONFIG.contractAddress); toast('Contract address copied.'); } catch (e) { toast('Copy failed. Select and copy the address manually.', 'bad'); } } })
    : null;

  // wallet
  const walletBtn = h('button', { type: 'button', class: 'hbtn primary', onclick: onWallet });
  const renderWallet = (pending) => {
    const a = getAccount();
    walletBtn.disabled = !!pending;
    walletBtn.textContent = pending ? 'Waiting for wallet…' : a ? short(a) : 'Connect wallet';
    walletBtn.setAttribute('aria-label', a ? `Connected as ${a}. Select to disconnect.` : 'Connect wallet to read your token balances');
  };
  async function onWallet() {
    if (getAccount()) { disconnect(); toast('Wallet disconnected.'); return; }
    renderWallet(true);
    try { await connect(); toast(`Connected ${short(getAccount())}.`); }
    catch (e) { toast(e.message, 'bad'); }
    finally { renderWallet(false); }
  }
  onAccount(() => renderWallet(false));
  renderWallet(false);

  return h('header', { class: 'site-header' },
    h('a', { class: 'brand', href: '#/', 'aria-label': 'Meloan home' },
      h('img', { class: 'brand-icon', src: 'assets/buddy-face.webp', alt: '', width: 34, height: 34, 'aria-hidden': 'true' }), wordmark),
    nav,
    h('div', { class: 'hactions' }, soundBtn, motionBtn, xBtn, caBtn, walletBtn, menuBtn));
}

export function buildFooter() {
  const n = CONFIG.network;
  return h('footer', { class: 'site-footer' },
    h('div', { class: 'foot-grid' },
      h('div', {},
        h('p', { class: 'foot-tag' }, CONFIG.tagline),
        h('p', {}, 'Isolated memecoin lending on Robinhood Chain. Borrow USDG against your memes, or lend to the one market you choose.'),
        h('p', { class: 'muted' }, `Network: ${n.name} (chain ID ${n.chainId}) · Loan asset: USDG`)),
      h('div', {},
        h('h2', {}, 'Risks'),
        h('ul', {},
          h('li', {}, 'Borrowers can lose collateral through liquidation.'),
          h('li', {}, 'Lenders can lose principal when collateral and the market reserve do not cover bad debt.'),
          h('li', {}, 'Withdrawals depend on unborrowed liquidity and may be partial.'),
          h('li', {}, 'Rates and yields shown are estimates, never promises.'))),
      h('div', {},
        h('h2', {}, 'More'),
        h('ul', {},
          h('li', {}, h('a', { href: CONFIG.storyUrl, target: '_blank', rel: 'noopener' }, "Buddy's story")),
          h('li', {}, h('a', { href: '#/docs' }, 'Whitepaper')),
          h('li', {}, h('a', { href: '#/docs?s=faq' }, 'FAQ')),
          h('li', {}, h('a', { href: '#/how-it-works' }, 'How it works'))))),
    h('p', { class: 'muted foot-legal' }, 'Meloan is independent and is not affiliated with Loan Meme, Scrooge or Robinhood. Nothing here is financial advice.'));
}

export function startRouter(routes, main) {
  let current = null, first = true;
  const go = () => {
    const { path, params } = parseHash();
    const route = routes[path] || routes['/404'];
    current?.destroy?.();
    document.body.classList.remove('nav-open');
    document.querySelector('.menu-btn')?.setAttribute('aria-expanded', 'false');
    current = route.render(params);
    main.replaceChildren(current.el);
    enhance(main);
    if (!first) play('nav');
    first = false;
    main.classList.remove('page-in'); void main.offsetWidth; main.classList.add('page-in');
    const t = typeof route.title === 'function' ? route.title(params) : route.title;
    document.title = t ? `${t} · Meloan` : 'Meloan';
    const navPath = path === '/market' ? '/markets' : path;
    for (const a of document.querySelectorAll('.nav a')) a.setAttribute('aria-current', a.dataset.path === navPath ? 'page' : 'false');
    window.scrollTo(0, 0);
    const h1 = main.querySelector('h1');
    if (h1) { h1.setAttribute('tabindex', '-1'); h1.focus({ preventScroll: true }); }
  };
  subscribe(() => current?.update?.(getState()));
  addEventListener('hashchange', go);
  go();
}
