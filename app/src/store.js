// Sample portfolio state: persisted per browser where storage allows; Reset restores the fixtures (MLN 20).
import { freshState } from './fixtures.js';
import { CONFIG } from './config.js';
import { fetchUsdgMarkets, mergeLive, ageLive, snapshotMarkets, enforceMemeMarkets } from './live.js';

const KEY = 'meloan-app-state-v3';
const PREF = 'meloan-app-prefs-v1';
let state = withMarkets(load());
// first paint already shows the real tokens (from the bundled snapshot) instead of example markets
function withMarkets(s) {
  if (!CONFIG.live.enabled) return s;
  s = enforceMemeMarkets(s);
  return !Object.values(s.markets).some(m => m.source === 'live' && !m.retired) ? mergeLive(s, snapshotMarkets()) : s;
}
const subs = new Set();

function load() {
  try { const raw = localStorage.getItem(KEY); if (raw) { const s = JSON.parse(raw); if (s && s.v === 3) return s; } } catch (e) { /* storage unavailable */ }
  return freshState();
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable: keep in memory */ } }

export const getState = () => state;
export function setState(next) { state = next; save(); subs.forEach((f) => f(state)); }
export function subscribe(f) { subs.add(f); return () => subs.delete(f); }
export function reset() { setState(withMarkets(freshState())); refreshLive(); }

// scenario controls: per-market price state, price shock, pause (demo controls, MLN 11 / 17)
export function setScenario(marketId, patch) {
  const s = JSON.parse(JSON.stringify(state));
  s.scenario[marketId] = { ...(s.scenario[marketId] || {}), ...patch };
  setState(s);
}
export const scenarioOf = (marketId) => state.scenario[marketId] || {};
export const isPaused = (m) => m.retired || (state.scenario[m.id]?.paused ?? m.paused);

// preferences (Motion Off persists, reduced-motion applies on first load — MLN 27)
export function prefs() {
  let p = {};
  try { p = JSON.parse(localStorage.getItem(PREF) || '{}'); } catch (e) { /* ignore */ }
  if (p.motion == null) p.motion = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  return p;
}
export function setPref(k, v) {
  const p = prefs(); p[k] = v;
  try { localStorage.setItem(PREF, JSON.stringify(p)); } catch (e) { /* ignore */ }
  return p;
}

// ---------- live market data (Robinhood Chain × USDG) ----------
let liveTimer = null, inflight = null;
export function refreshLive() {
  if (!CONFIG.live.enabled) return Promise.resolve();
  if (inflight) return inflight;
  setState({ ...state, live: { ...(state.live || {}), status: 'loading', error: '' } });
  inflight = fetchUsdgMarkets()
    .then((r) => { setState(mergeLive(state, r)); })
    .catch((e) => {
      // live feed unreachable: keep fresh live data if we have it (it will age into Stale), otherwise use the bundled snapshot
      const haveLive = Object.values(state.markets).some((m) => m.source === 'live' && !m.snapshot);
      if (haveLive) setState({ ...state, live: { ...(state.live || {}), status: 'error', error: e.message } });
      else setState(mergeLive(state, snapshotMarkets(), e.message));
    })
    .finally(() => { inflight = null; });
  return inflight;
}
export function startLive() {
  if (!CONFIG.live.enabled || liveTimer) return;
  refreshLive();
  liveTimer = setInterval(() => { if (!document.hidden) refreshLive(); }, CONFIG.live.refreshMs);
  setInterval(() => { const n = ageLive(state); if (n) setState(n); }, 15000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - (state.live?.fetchedAt || 0) > CONFIG.live.refreshMs) refreshLive(); });
}
export const hasLive = () => Object.values(state.markets).some((m) => m.source === 'live');
