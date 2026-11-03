/** The 25 symbols the app streams and offers in the watchlist picker. */
export const MARKET_SYMBOLS = [
  'RELIANCE',
  'TCS',
  'HDFCBANK',
  'INFY',
  'ICICIBANK',
  'SBIN',
  'BHARTIARTL',
  'ITC',
  'LT',
  'HINDUNILVR',
  'KOTAKBANK',
  'AXISBANK',
  'BAJFINANCE',
  'MARUTI',
  'SUNPHARMA',
  'TITAN',
  'ASIANPAINT',
  'ULTRACEMCO',
  'WIPRO',
  'NTPC',
  'POWERGRID',
  'ONGC',
  'TATASTEEL',
  'ADANIENT',
  'HCLTECH',
] as const;

/** Display names only; nothing depends on them for pricing. */
const COMPANY_NAMES: Readonly<Record<string, string>> = {
  RELIANCE: 'Reliance Industries',
  TCS: 'Tata Consultancy Services',
  HDFCBANK: 'HDFC Bank',
  INFY: 'Infosys',
  ICICIBANK: 'ICICI Bank',
  SBIN: 'State Bank of India',
  BHARTIARTL: 'Bharti Airtel',
  ITC: 'ITC',
  LT: 'Larsen & Toubro',
  HINDUNILVR: 'Hindustan Unilever',
  KOTAKBANK: 'Kotak Mahindra Bank',
  AXISBANK: 'Axis Bank',
  BAJFINANCE: 'Bajaj Finance',
  MARUTI: 'Maruti Suzuki',
  SUNPHARMA: 'Sun Pharmaceutical',
  TITAN: 'Titan Company',
  ASIANPAINT: 'Asian Paints',
  ULTRACEMCO: 'UltraTech Cement',
  WIPRO: 'Wipro',
  NTPC: 'NTPC',
  POWERGRID: 'Power Grid Corp.',
  ONGC: 'Oil & Natural Gas Corp.',
  TATASTEEL: 'Tata Steel',
  ADANIENT: 'Adani Enterprises',
  HCLTECH: 'HCL Technologies',
};

export function companyName(symbol: string): string {
  return COMPANY_NAMES[symbol] ?? 'Not listed on the feed';
}

const MARKET_SYMBOL_SET: ReadonlySet<string> = new Set(MARKET_SYMBOLS);

export function isMarketSymbol(symbol: string): boolean {
  return MARKET_SYMBOL_SET.has(symbol);
}
