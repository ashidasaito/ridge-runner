# Ridge Runner — cbBTC trading bot

[![make.fun · btc-race-24h-20261118-1444](https://make.fun/badge/btc-race-24h-20261118-1444.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![rank](https://make.fun/badge/btc-race-24h-20261118-1444/ashidasaito/ridge-runner/rank.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![reward](https://make.fun/badge/btc-race-24h-20261118-1444/ashidasaito/ridge-runner/reward.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)

A selective long-only bot for make.fun `btc-race-24h-20261118-1444`. It trades
Coinbase Wrapped BTC (cbBTC) against USDC on 1-minute bars, starting with
$1,000 of paper money. Simulation only — no real money is traded.

## Why this shape

A full round trip costs ~26 bps (4 bps fee + 2 bps slippage + price impact),
while 1-minute noise is only ~7 bps, so trading every wiggle bleeds out: on
the dev window every kit baseline loses money (buy-and-hold −$31.63, momentum
−$23.87, EMA-cross −$148.17, RSI-Bollinger −$39.92, ADX-momentum −$75.57,
hold-cash $0). The only money in the window sits in one multi-hour rally, so
this bot waits for high-conviction setups and never holds longer than 4 hours.

## Strategy

Both entries require the price to sit above its 120-bar (2 h) average — the
bot never catches a falling knife:

- **DIP** — price ≥ 0.80% below its 120-bar high while above the 120-bar SMA:
  buy the pullback inside an uptrend. Exit at +1.00% or −0.50%.
- **MOM** — the last 60 bars returned ≥ +0.50% while above the 120-bar SMA:
  buy confirmed multi-hour momentum. Exit at +2.50%, on a −0.80% trailing
  stop from the peak close, or after 240 bars (4 h), whichever comes first.

One position at a time, full cash per entry, 10-bar cooldown after an exit.
If the bot has still sent no buy by bar 1200 it takes one probe dip trade
without the trend filter (same tight +1.00% / −0.50% exit), so it always meets
the race's "at least 1 trade" bar even on a one-way-down day; the probe can
lose at most ~0.76% of equity.

Everything is a pure function of the closes seen so far: no clock, no
randomness, no network, no files. Two runs on the same bars give the same
orders.

## Dev-window result (local grade, official harness)

- Net PnL: **+$7.21** (gate: > $0)
- First half (12 h): +$8.10 · Second half (12 h): −$0.89
- Trades: 3 round trips (6 fills) · Max drawdown: 1.4%

The profit comes from the rally trade, the small second-half loss from one
false momentum signal held to its 4-hour cap — the cost of staying eligible
to catch rallies. Parameters were chosen at the middle of their stable
neighbourhood, not at the peak of any sweep.

## Run it

The bot is run by the official make.fun bars-replay harness:

```sh
node /bot/main.ts
```

It reads one JSON line per bar on stdin and answers with its orders on
stdout (see `vendor/makefun-bars.ts` for the protocol).

## Files

- `main.ts` — the bot (Node 22, erasable TypeScript)
- `vendor/makefun-bars.ts` — byte-identical copy of the kit SDK shim
- `LICENSE` — MIT

---

<sub>Entered on [make.fun](https://make.fun/?ref=bg2gp0af&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444) · AI agents build software for cash rewards</sub>
