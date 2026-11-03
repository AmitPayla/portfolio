import { parsePricePaise } from '@/domain/money';
import { createHolding, type Holding } from '@/domain/portfolio';

/**
 * Starting holdings, bundled with the app exactly as supplied.
 * OLDCO is deliberate: the API does not return it, so it has no price.
 */
export const SEED_HOLDINGS_CSV = `symbol,qty,avgPrice
RELIANCE,25,1319.59
TCS,40,2589.71
HDFCBANK,10,755.86
INFY,10,1114.7
ICICIBANK,5,1566.04
SBIN,15,800.62
BHARTIARTL,40,1890.8
ITC,15,225.74
LT,40,3250.32
HINDUNILVR,100,1605.15
KOTAKBANK,15,474.57
AXISBANK,100,1378.55
BAJFINANCE,100,951.52
MARUTI,5,13017.25
SUNPHARMA,5,1784.28
TITAN,12,4061.93
ASIANPAINT,12,2316.35
ULTRACEMCO,100,10181.27
WIPRO,12,169.36
NTPC,100,326
OLDCO,30,412.5`;

export interface ParsedHoldings {
  readonly holdings: Holding[];
  /** Human-readable problems with skipped lines; empty for the bundled file. */
  readonly errors: string[];
}

/** Parses `symbol,qty,avgPrice` rows. Bad rows are reported and skipped, never zero-filled. */
export function parseHoldingsCsv(csv: string): ParsedHoldings {
  const holdings: Holding[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  const lines = csv.split(/\r?\n/).map((l) => l.trim());

  lines.forEach((line, index) => {
    if (index === 0 || line === '') return; // header / blank
    const [rawSymbol, rawQty, rawAvg, ...rest] = line.split(',').map((c) => c.trim());
    const lineNo = index + 1;
    const symbol = rawSymbol?.toUpperCase() ?? '';
    const qty = Number(rawQty);
    const avg = parsePricePaise(Number(rawAvg));
    if (rest.length > 0 || !/^[A-Z0-9&-]+$/.test(symbol)) {
      errors.push(`Line ${lineNo}: malformed row "${line}"`);
    } else if (!Number.isSafeInteger(qty) || qty <= 0) {
      errors.push(`Line ${lineNo}: quantity must be a whole number above zero`);
    } else if (avg == null) {
      errors.push(`Line ${lineNo}: average price must be a positive number`);
    } else if (seen.has(symbol)) {
      errors.push(`Line ${lineNo}: duplicate symbol ${symbol}`);
    } else {
      seen.add(symbol);
      holdings.push(createHolding(symbol, qty, avg));
    }
  });
  return { holdings, errors };
}
