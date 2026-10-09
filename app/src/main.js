import { buildHeader, buildFooter, startRouter } from './shell.js';
import { h } from './ui.js';
import { startLive } from './store.js';
import { installUiSounds } from './sfx.js';
import { cursorGlow } from './fx.js';
import * as home from './pages/home.js';
import * as markets from './pages/markets.js';
import * as market from './pages/market.js';
import * as borrow from './pages/borrow.js';
import * as lend from './pages/lend.js';
import * as positions from './pages/positions.js';
import * as analytics from './pages/analytics.js';
import * as how from './pages/how.js';
import * as docs from './pages/docs.js';

const notFound = { title: 'Not found', render: () => ({ el: h('div', { class: 'page' }, h('h1', {}, 'Lost in space'), h('p', {}, 'That page does not exist.'), h('a', { class: 'btn primary', href: '#/' }, 'Back to the console')) }) };

const routes = {
  '/': home, '/markets': markets, '/market': market, '/borrow': borrow, '/lend': lend, '/positions': positions,
  '/analytics': analytics, '/how-it-works': how, '/docs': docs, '/404': notFound,
};

const app = document.getElementById('app');
const main = h('main', { id: 'main', tabindex: '-1' });
app.replaceChildren(buildHeader(), main, buildFooter());
document.getElementById('boot')?.remove();
startRouter(routes, main);
startLive();
installUiSounds();
cursorGlow();
