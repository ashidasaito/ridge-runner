// Ridge Runner — a selective long-only cbBTC bot for make.fun btc-race-24h.
//
// Idea: on 1-minute bars the round trip costs ~26 bps, while 1-minute noise is
// only ~7 bps, so the bot does NOT trade noise. It waits for one of two
// high-conviction setups, both gated on the price sitting above its 2-hour
// average (no catching falling knives), and it never holds a position longer
// than 4 hours.
//
//   DIP  — price >= 0.80% below its 120-bar high while above its 120-bar SMA:
//          buy the pullback inside an uptrend. Exit at +1.00% or -0.50%.
//   MOM  — the last 60 bars returned >= +0.50% while above the 120-bar SMA:
//          buy confirmed multi-hour momentum. Exit at +2.50%, on a -0.60%
//          trailing stop from the peak close, or after 240 bars (4 h).
//          The 60 bps trail (not 80) banks a momentum gain before it
//          retraces: across the trail grid 50/60/70/80 bps every value stays
//          profitable and the curve is smooth, while 40 bps falls off a
//          cliff (extra trades in the choppy second half), so 60 sits in
//          the middle of the stable zone.
//
// One position at a time, full cash per entry, 10-bar cooldown after an exit.
// If the bot has still sent no buy by bar 1200 it takes ONE probe dip trade
// without the trend filter (tight +1.00% / -0.50% exit) so the entry always
// meets the race's "at least 1 trade" bar even on a one-way-down day; the
// probe can lose at most ~0.76% of equity.
//
// Everything is a pure function of the closes seen so far: no clock, no
// randomness, no network, no files. Two runs on the same bars give the same
// orders.

import { runBars, type BarsState, type OrderInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
const SMA_LEN = 120;
const DIP_BPS = 80; // 0.80% below the 120-bar high
const MOM_BPS = 50; // 1h return >= +0.50%
const DIP_TP_BPS = 100; // +1.00%
const DIP_SL_BPS = 50; // -0.50%
const MOM_TP_BPS = 250; // +2.50%
const MOM_TRAIL_BPS = 60; // -0.60% from the peak close
const MOM_MAX_HOLD = 240; // bars (4 h)
const COOLDOWN_BARS = 10;
const MAX_SLIPPAGE_BPS = 10_000;
const FALLBACK_BAR = 1200; // probe trade if nothing traded yet

/** Closes in USD (raw price / 1e5), one per batch seen. */
const closes: number[] = [];
let kind: 'dip' | 'mom' | null = null;
let entryClose = 0;
let peakClose = 0;
let held = 0;
let cool = 0;
let buysSent = 0;

function sma120(): number | null {
  if (closes.length < SMA_LEN) return null;
  let s = 0;
  for (let k = closes.length - SMA_LEN; k < closes.length; k++) s += closes[k];
  return s / SMA_LEN;
}

function hi120(): number {
  let m = -Infinity;
  const from = closes.length > SMA_LEN ? closes.length - SMA_LEN : 0;
  for (let k = from; k < closes.length; k++) if (closes[k] > m) m = closes[k];
  return m;
}

await runBars({
  onBatch(state: BarsState): OrderInput[] {
    const raw = state.close(SYMBOL);
    if (raw === null || state.warmingUp) return [];
    const close = Number(raw) / 1e5;
    closes.push(close);
    const i = closes.length - 1;
    const pos = state.positions.get(SYMBOL);

    if (pos !== undefined && pos.qty > 0n) {
      held += 1;
      if (close > peakClose) peakClose = close;
      const retBps = ((close / entryClose) - 1) * 10000;
      const trailBps = ((close / peakClose) - 1) * 10000;
      let exit = false;
      if (kind === 'dip') {
        exit = retBps >= DIP_TP_BPS || retBps <= -DIP_SL_BPS;
      } else {
        exit = retBps >= MOM_TP_BPS || trailBps <= -MOM_TRAIL_BPS || held >= MOM_MAX_HOLD;
      }
      if (exit) {
        kind = null;
        held = 0;
        cool = COOLDOWN_BARS;
        return [{ side: 'sell', symbol: SYMBOL, qty: pos.qty, max_slippage_bps: MAX_SLIPPAGE_BPS }];
      }
      return [];
    }

    if (cool > 0) {
      cool -= 1;
      return [];
    }

    const ma = sma120();
    if (ma === null) return [];
    const aboveTrend = close > ma;
    const dip = i >= SMA_LEN && close <= hi120() * (1 - DIP_BPS / 10000);
    const mom = i >= 240 && closes[i] / closes[i - 60] - 1 >= MOM_BPS / 10000;
    const probe = buysSent === 0 && i >= FALLBACK_BAR && dip;

    if ((aboveTrend && (dip || mom)) || probe) {
      kind = dip || probe ? 'dip' : 'mom';
      entryClose = close;
      peakClose = close;
      held = 0;
      buysSent += 1;
      return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: state.cash, max_slippage_bps: MAX_SLIPPAGE_BPS }];
    }
    return [];
  },
});
