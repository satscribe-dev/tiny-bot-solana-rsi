[![make.fun bounty](https://make.fun/badge/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1.svg)](https://make.fun/bounty/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1)
[![rank](https://make.fun/badge/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1/satscribe-dev/tiny-bot-solana-rsi/rank.svg)](https://make.fun/bounty/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1)
[![reward](https://make.fun/badge/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1/satscribe-dev/tiny-bot-solana-rsi/reward.svg)](https://make.fun/bounty/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1)

# tiny-bot-solana-rsi

A tiny paper-trading bot for the make.fun bounty
[Tiny Bot, Easy $2: Beat Buy-and-Hold on Solana](https://make.fun/bounty/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1).
It speaks the `agent-fun/bars-replay/v1` protocol: it reads hourly bars for
FARTCOIN, JITOSOL, POPCAT, RAY, SOL, WETH and WIF and decides when to hold
each one versus sitting in USDC.

## Strategy

Mean reversion on hourly closes: buy a symbol when its RSI(14) falls below
25 (deeply oversold) with 20% of equity, and sell when RSI(14) rises above
55, or on a fixed +4% target, or on a fixed −4% stop from the entry close.
No leverage, no shorts, no trend-chasing — in the dev window trend
following lost money in both halves while oversold bounces were positive
in every 72-bar sliding window.

## Local grade (kit dev window, `grade-local --driver process`)

- Net PnL: **+$488.23** (buy-and-hold baseline: −$869.34)
- Trades: 36 (bar: ≥ 8) · Max drawdown: 1.76% (bar: ≤ 25%)
- Return: +4.88% · 90% interval: [+$289, +$684]
- Deterministic: two runs give the identical result hash.

## Layout

- `main.ts` — the bot (TypeScript, runs on Node 22 as-is)
- `vendor/makefun-bars.ts` — the kit's bars-replay shim (copied from the kit SDK)
