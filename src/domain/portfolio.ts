import {
  addPaise,
  divRoundPaise,
  mulQty,
  paise,
  ratio,
  subPaise,
  ZERO_PAISE,
  type Paise,
} from './money';
import type { Quote, QuoteMap } from './quote';

/** The only quote fields position maths needs. Rows subscribe to just these two. */
export type PriceView = Pick<Quote, 'ltp' | 'prevClose'>;

/**
 * A position. We store the total cost basis rather than an average price:
 * the cost is an exact integer, and the average is derived (cost / qty) and
 * rounded only for display. That keeps Invested and P&L exact after any
 * sequence of buys and sells.
 */
export interface Holding {
  readonly symbol: string;
  /** Whole shares, always > 0 (a fully sold position is removed). */
  readonly qty: number;
  /** Total cost basis of the shares currently held. */
  readonly costPaise: Paise;
  /** Shares bought today that are still held (0 ≤ todayQty ≤ qty). */
  readonly todayQty: number;
  /** Cost basis of those shares. */
  readonly todayCostPaise: Paise;
}

export function createHolding(symbol: string, qty: number, avgPricePaise: Paise): Holding {
  return { symbol, qty, costPaise: mulQty(avgPricePaise, qty), todayQty: 0, todayCostPaise: ZERO_PAISE };
}

/** Average buy price rounded to the paisa, for display. */
export function averagePricePaise(holding: Holding): Paise {
  return divRoundPaise(holding.costPaise, holding.qty);
}

export interface HoldingMetrics {
  readonly investedPaise: Paise;
  readonly avgPricePaise: Paise;
  /** null when the symbol has no price: never treated as zero. */
  readonly ltpPaise: Paise | null;
  readonly valuePaise: Paise | null;
  readonly pnlPaise: Paise | null;
  readonly pnlPct: number | null;
  /** Day's P&L on the shares held now (null without a price or previous close). */
  readonly dayPnlPaise: Paise | null;
  /** What those shares were worth at the start of the day: the base for Today's P&L %. */
  readonly dayBasePaise: Paise | null;
}

/**
 * Today's P&L compares each share with where it started the day: previous
 * close for shares held overnight, the fill price for shares bought today.
 * Without that split, buying today would show a fake day gain or loss of
 * qty × (ltp − prevClose) the instant the order fills.
 */
function dayBase(holding: Holding, quote: PriceView): Paise | null {
  const overnightQty = holding.qty - holding.todayQty;
  if (overnightQty === 0) return holding.todayCostPaise;
  if (quote.prevClose == null) return null;
  return addPaise(mulQty(quote.prevClose, overnightQty), holding.todayCostPaise);
}

export function computeHoldingMetrics(holding: Holding, quote: PriceView | undefined): HoldingMetrics {
  const investedPaise = holding.costPaise;
  const avgPricePaise = averagePricePaise(holding);
  if (!quote) {
    return {
      investedPaise,
      avgPricePaise,
      ltpPaise: null,
      valuePaise: null,
      pnlPaise: null,
      pnlPct: null,
      dayPnlPaise: null,
      dayBasePaise: null,
    };
  }
  const valuePaise = mulQty(quote.ltp, holding.qty);
  const pnlPaise = subPaise(valuePaise, investedPaise);
  const dayBasePaise = dayBase(holding, quote);
  return {
    investedPaise,
    avgPricePaise,
    ltpPaise: quote.ltp,
    valuePaise,
    pnlPaise,
    pnlPct: ratio(pnlPaise, investedPaise),
    dayPnlPaise: dayBasePaise == null ? null : subPaise(valuePaise, dayBasePaise),
    dayBasePaise,
  };
}

export interface PortfolioSummary {
  readonly holdingsCount: number;
  /** Holdings with a live price; only these are in the totals below. */
  readonly pricedCount: number;
  readonly currentValuePaise: Paise;
  readonly investedPaise: Paise;
  readonly pnlPaise: Paise;
  readonly pnlPct: number | null;
  readonly dayPnlPaise: Paise;
  readonly dayPnlPct: number | null;
  /** Priced holdings whose day change is unknown (no previous close), left out of Today's P&L. */
  readonly dayExcludedCount: number;
  /** Holdings left out of every total because they have no price. */
  readonly unpriced: readonly { readonly symbol: string; readonly investedPaise: Paise }[];
  readonly unpricedInvestedPaise: Paise;
}

/**
 * Totals over the priced holdings only. An unpriced holding is neither counted
 * as zero (that would show a fake -100% loss) nor guessed; it is listed in
 * `unpriced` so the UI can say exactly what is missing from the totals.
 * Because every row figure is an exact integer, each total equals the sum of
 * the rows on screen to the paisa: value − invested = P&L by construction.
 */
export function summarizePortfolio(holdings: readonly Holding[], quotes: QuoteMap): PortfolioSummary {
  let currentValue = 0;
  let invested = 0;
  let dayPnl = 0;
  let dayBaseTotal = 0;
  let pricedCount = 0;
  let dayExcludedCount = 0;
  let unpricedInvested = 0;
  const unpriced: { symbol: string; investedPaise: Paise }[] = [];

  for (const holding of holdings) {
    const metrics = computeHoldingMetrics(holding, quotes[holding.symbol]);
    if (metrics.valuePaise == null) {
      unpriced.push({ symbol: holding.symbol, investedPaise: metrics.investedPaise });
      unpricedInvested += metrics.investedPaise;
      continue;
    }
    pricedCount += 1;
    currentValue += metrics.valuePaise;
    invested += metrics.investedPaise;
    if (metrics.dayPnlPaise == null || metrics.dayBasePaise == null) {
      dayExcludedCount += 1;
    } else {
      dayPnl += metrics.dayPnlPaise;
      dayBaseTotal += metrics.dayBasePaise;
    }
  }

  const currentValuePaise = paise(currentValue);
  const investedPaise = paise(invested);
  const pnlPaise = subPaise(currentValuePaise, investedPaise);
  const dayPnlPaise = paise(dayPnl);
  return {
    holdingsCount: holdings.length,
    pricedCount,
    currentValuePaise,
    investedPaise,
    pnlPaise,
    pnlPct: ratio(pnlPaise, investedPaise),
    dayPnlPaise,
    dayPnlPct: ratio(dayPnlPaise, paise(dayBaseTotal)),
    dayExcludedCount,
    unpriced,
    unpricedInvestedPaise: paise(unpricedInvested),
  };
}
