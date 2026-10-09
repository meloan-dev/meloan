// Wallet connection and read-only token balances; no signatures or transactions here.
const TIMEOUT_MS = 10000;
let account = null;
const subs = new Set();
const emit = () => subs.forEach((f) => f(account));

export const getAccount = () => account;
export const onAccount = (f) => { subs.add(f); return () => subs.delete(f); };
export const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '');

function provider() { return typeof window !== 'undefined' ? window.ethereum : null; }
export const getProvider = provider;

let bound = false;
function bind(p) {
  if (bound || !p || !p.on) return;
  bound = true;
  p.on('accountsChanged', (accs) => { account = accs && accs[0] ? accs[0] : null; emit(); });
  p.on('disconnect', () => { account = null; emit(); });
  p.on('chainChanged', () => emit());
}

export async function connect() {
  const p = provider();
  if (!p || !p.request) {
    const e = new Error('No browser wallet was found. Install a wallet extension such as MetaMask or Rabby, then reload this page.');
    e.code = 'NO_PROVIDER'; throw e;
  }
  bind(p);
  let timer;
  const timeout = new Promise((_, rej) => { timer = setTimeout(() => { const e = new Error('The wallet did not answer within 10 seconds. Check for a pending request in your wallet and try again.'); e.code = 'TIMEOUT'; rej(e); }, TIMEOUT_MS); });
  try {
    const accs = await Promise.race([p.request({ method: 'eth_requestAccounts' }), timeout]);
    account = accs && accs[0] ? accs[0] : null;
    emit();
    return account;
  } catch (err) {
    if (err && err.code === 4001) { const e = new Error('The connection request was rejected in your wallet. Nothing changed.'); e.code = 'REJECTED'; throw e; }
    if (err && err.code === -32002) { const e = new Error('Your wallet already has a pending request. Open it to approve or reject, then try again.'); e.code = 'PENDING'; throw e; }
    throw err;
  } finally { clearTimeout(timer); }
}
export function disconnect() { account = null; emit(); }
