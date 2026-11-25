// Tiny mean-reversion bot for agent-fun/bars-replay/v1 (make.fun bounty
// u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1).
//
// Idea: buy deep hourly oversold bounces, sit in USDC otherwise.
//  - Per symbol, RSI(14) of closes. Enter when RSI < 25 (deeply oversold);
//    exit when RSI > 55 (bounce faded), or on a fixed +4% target, or on a
//    fixed -4% stop from the entry close.
//  - One fixed slice of equity per symbol (20%), capped by the harness
//    weight limit and by the cash actually on hand. No leverage, no shorts,
//    no randomness, no clock, no network: the same bars always give the
//    same orders, so the two grading runs agree byte for byte.
//
// Why this shape: on the kit dev window (136 hourly bars) trend-following
// loses in both halves (EMA 8/24 about -$200, faster EMAs worse), while
// this oversold-bounce rule is positive in every 72-bar sliding window
// (+$9 to +$464, 14-21 trades each) with max drawdown under 2% — it
// clears the 8-trade bar with margin and stays far under the 25% cap.
// A trend leg was tried and dropped: adding EMA entries turned the same
// window negative (-$147), so the bot is mean-reversion only.
// Fees are 10 bps + 5 bps slippage per side plus pool impact, so entries
// need a real dislocation (RSI < 25), not every small dip.

import { runBars } from './vendor/makefun-bars.ts';
import type { BarsState, Batch, OrderInput } from './vendor/makefun-bars.ts';

// --- tunables ---
const RSI_PERIOD = 14; // RSI lookback, bars
const RSI_ENTRY = 25; // buy when RSI falls below this
const RSI_EXIT = 55; // sell when RSI rises above this
const SIZE_BPS = 2000; // target weight per symbol, bps of equity (20%)
const STOP_LOSS = 0.04; // sell if close falls 4% below entry close
const TAKE_PROFIT = 0.04; // sell if close rises 4% above entry close
const BUY_SLIPPAGE_BPS = 100;
const SELL_SLIPPAGE_BPS = 200;

interface SymState {
  closes: number[];
  entryPrice: number;
}

const perSymbol = new Map<string, SymState>();

function stateFor(symbol: string): SymState {
  let s = perSymbol.get(symbol);
  if (s === undefined) {
    s = { closes: [], entryPrice: 0 };
    perSymbol.set(symbol, s);
  }
  return s;
}

/** Classic RSI over the closes so far (needs RSI_PERIOD + 1 closes). */
function rsi(closes: number[]): number | null {
  if (closes.length < RSI_PERIOD + 1) return null;
  let gain = 0;
  let loss = 0;
  for (let j = closes.length - RSI_PERIOD; j < closes.length; j++) {
    const d = closes[j] - closes[j - 1];
    if (d > 0) gain += d;
    else loss -= d;
  }
  if (loss === 0) return 100;
  return 100 - 100 / (1 + gain / loss);
}

await runBars({
  onBatch(state: BarsState, batch: Batch): OrderInput[] {
    const orders: OrderInput[] = [];
    // Warm-up bars build indicator history only; orders on them are rejected.
    const trading = !state.warmingUp;
    // Cash budget for this reply's buys, in quote units.
    let cashLeft = state.cash;

    for (const bar of batch.bars) {
      const sym = bar.symbol;
      const meta = state.symbols.get(sym);
      if (meta === undefined) continue;
      const price = Number(bar.c) / 10 ** meta.price_scale;
      const s = stateFor(sym);
      s.closes.push(price);
      const r = rsi(s.closes);
      if (!trading || r === null) continue;

      const held = state.positions.get(sym);
      const qty = held?.qty ?? 0n;

      if (qty > 0n) {
        // --- manage an open long ---
        const stopped = price < s.entryPrice * (1 - STOP_LOSS);
        const targetHit = price > s.entryPrice * (1 + TAKE_PROFIT);
        if (r > RSI_EXIT || stopped || targetHit) {
          orders.push({ side: 'sell', symbol: sym, qty, max_slippage_bps: SELL_SLIPPAGE_BPS });
          s.entryPrice = 0;
        }
        continue;
      }

      // --- flat: buy only a deep oversold bounce ---
      if (r >= RSI_ENTRY) continue;
      const target = (state.equity * BigInt(SIZE_BPS)) / 10000n;
      const room = state.weightRoom(sym);
      let spend = target < room ? target : room;
      if (spend > cashLeft) spend = cashLeft;
      if (spend <= 0n) continue;
      orders.push({ side: 'buy', symbol: sym, notional_quote_units: spend, max_slippage_bps: BUY_SLIPPAGE_BPS });
      cashLeft -= spend;
      s.entryPrice = price;
    }
    return orders;
  },
});
