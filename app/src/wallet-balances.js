import { CONFIG } from './config.js';
import { getAccount, getProvider } from './wallet.js';
import { isMemeToken } from './meme-tokens.js';

export const BALANCE_MAX_AGE_MS = 30000;
const isAddress = value => /^0x[0-9a-fA-F]{40}$/.test(String(value));
const same = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
const uint = value => {
  if (!/^0x[0-9a-fA-F]{64}$/.test(String(value))) throw new Error('The token returned an invalid balance response.');
  return BigInt(value);
};
async function request(provider, method, params = []) {
  let timer;
  try {
    return await Promise.race([
      provider.request({ method, params }),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Wallet balance request timed out. Refresh and try again.')), 10000); }),
    ]);
  } finally { clearTimeout(timer); }
}

export function formatTokenUnits(raw, decimals, precision = decimals) {
  const divisor = 10n ** BigInt(decimals);
  const whole = raw / divisor;
  const fraction = (raw % divisor).toString().padStart(decimals, '0').slice(0, Math.min(decimals, precision)).replace(/0+$/, '');
  return whole.toString() + (fraction ? '.' + fraction : '');
}
export function amountToTokenUnits(amount, decimals) {
  const text = String(amount).trim().replace(/,/g, '');
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) throw new Error('Enter a valid collateral amount.');
  const [whole, fraction = ''] = text.split('.');
  if (fraction.length > decimals) throw new Error(`This token supports at most ${decimals} decimal places.`);
  return BigInt(whole || '0') * 10n ** BigInt(decimals) + BigInt((fraction.padEnd(decimals, '0')) || '0');
}

export async function readTokenBalance(token, { provider = getProvider(), account = getAccount() } = {}) {
  if (!provider?.request || !isAddress(account)) throw new Error('Connect your wallet to read its balance.');
  if (!isAddress(token) || !isMemeToken(token)) throw new Error('This token is not a listed Robinhood meme.');
  const checkWallet = async () => {
    const [chain, accounts] = await Promise.all([request(provider, 'eth_chainId'), request(provider, 'eth_accounts')]);
    if (Number(BigInt(chain)) !== CONFIG.network.chainId) throw new Error(`Switch your wallet to ${CONFIG.network.name} to read this balance.`);
    if (!accounts?.[0] || !same(accounts[0], account)) throw new Error('Your wallet account changed. Refresh the balance.');
  };
  await checkWallet();
  const [balanceHex, decimalsHex] = await Promise.all([
    request(provider, 'eth_call', [{ to: token, data: '0x70a08231' + account.slice(2).toLowerCase().padStart(64, '0') }, 'latest']),
    request(provider, 'eth_call', [{ to: token, data: '0x313ce567' }, 'latest']),
  ]);
  const raw = uint(balanceHex), decimalsValue = uint(decimalsHex);
  if (decimalsValue > 255n) throw new Error('The token returned invalid decimal precision.');
  const decimals = Number(decimalsValue);
  await checkWallet(); // discard responses after an account/network change
  return { account: account.toLowerCase(), token: token.toLowerCase(), raw, decimals, amount: formatTokenUnits(raw, decimals), fetchedAt: Date.now() };
}

export function validateCollateralBalance(balance, amount, now = Date.now()) {
  if (!balance) return { ok: false, error: 'Your wallet balance has not been verified yet.' };
  if (now - balance.fetchedAt > BALANCE_MAX_AGE_MS) return { ok: false, error: 'Your wallet balance needs a refresh before borrowing.' };
  try {
    const requested = amountToTokenUnits(amount, balance.decimals);
    if (requested <= 0n) return { ok: false, error: 'Enter collateral above zero.' };
    if (requested > balance.raw) return { ok: false, error: `Insufficient wallet balance. You hold ${formatTokenUnits(balance.raw, balance.decimals, 6)} tokens.` };
    return { ok: true };
  } catch (error) { return { ok: false, error: error.message }; }
}
