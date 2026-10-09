import { h } from '../ui.js';
import { pageHead } from '../components.js';
import { DOCS, FAQ } from '../docs-content.js';

export const title = 'Whitepaper';

export function render(params) {
  const toc = h('nav', { class: 'toc panel', 'aria-label': 'Whitepaper sections' },
    h('ol', {}, DOCS.map(([t], i) => h('li', {}, h('a', { href: `#/docs?s=${i + 1}`, 'aria-current': String(params.s) === String(i + 1) ? 'true' : null }, t))),
      h('li', { class: 'faq-link' }, h('a', { href: '#/docs?s=faq' }, 'FAQ'))));
  const body = h('div', { class: 'doc-body' },
    DOCS.map(([t, paras, table], i) => h('section', { id: `sec-${i + 1}`, class: 'doc-sec', 'aria-labelledby': `sec-${i + 1}-h` },
      h('h2', { id: `sec-${i + 1}-h` }, h('span', { class: 'sec-n' }, `${i + 1}.`), ' ', t),
      paras.map((p) => h('p', {}, p)),
      table ? h('div', { class: 'table-wrap' }, h('table', {}, h('thead', {}, h('tr', {}, table[0].map((c) => h('th', { scope: 'col' }, c)))), h('tbody', {}, table.slice(1).map((r) => h('tr', {}, r.map((c) => h('td', {}, c))))))) : null,
      [5, 7, 9, 11].includes(i + 1) ? h('p', { class: 'small muted' }, 'Each market\'s exact parameters are shown on its page in Markets.') : null)),
    h('section', { id: 'sec-faq', class: 'doc-sec', 'aria-labelledby': 'faq-h' }, h('h2', { id: 'faq-h' }, 'FAQ'),
      FAQ.map(([q, a]) => h('details', { class: 'faq', open: q === 'Is it live?' }, h('summary', {}, q), h('p', {}, a)))));
  const el = h('div', { class: 'page' },
    pageHead({ title: 'Meloan whitepaper', eyebrow: 'Version 1.0 · summary', sim: false, lead: 'A faithful summary of all 18 sections. Fees, parameters and the network are proposals until published as final.' }),
    h('div', { class: 'docs-grid' }, toc, body));
  if (params.s) requestAnimationFrame(() => { const t = el.querySelector(`#sec-${params.s}`); if (t) t.scrollIntoView({ block: 'start' }); });
  return { el };
}
