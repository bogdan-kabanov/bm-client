import { Currency, CurrencyCategory } from '@src/shared/api';

type FallbackCategoryKey = 'crypto';

let fallbackCurrencyIdCounter = -1;

const createFallbackCurrency = (
  base: string,
  displayName: string,
  quote: string = 'USDT',
  order: number = 0,
): Currency => ({
  id: fallbackCurrencyIdCounter--,
  category_id: -1,
  symbol: `${base}/${quote}`,
  display_name: displayName,
  base_currency: base,
  quote_currency: quote,
  bybit_symbol: null,
  exchange_source: null,
  profit_percentage: 0,
  order,
  is_active: true,
  icon: null,
});

const buildFallbackCurrencies = (items: Array<[string, string, string?, string?]>) =>
  items.map(([base, name, , quote], index) =>
    createFallbackCurrency(base, name, quote ?? 'USDT', index + 1),
  );

export const FALLBACK_CATEGORIES: Array<{ key: FallbackCategoryKey; name: string; currencies: Currency[] }> = [
  {
    key: 'crypto',
    name: 'Криптовалюты',
    currencies: buildFallbackCurrencies([
      ['BTC', 'Bitcoin', 'BTCUSDT'],
      ['ETH', 'Ethereum', 'ETHUSDT'],
      ['BNB', 'BNB', 'BNBUSDT'],
      ['XRP', 'XRP', 'XRPUSDT'],
      ['ADA', 'Cardano', 'ADAUSDT'],
      ['SOL', 'Solana', 'SOLUSDT'],
      ['DOGE', 'Dogecoin', 'DOGEUSDT'],
      ['DOT', 'Polkadot', 'DOTUSDT'],
      ['TRX', 'Tron', 'TRXUSDT'],
      ['LTC', 'Litecoin', 'LTCUSDT'],
      ['SHIB', 'Shiba Inu', 'SHIBUSDT'],
      ['AVAX', 'Avalanche', 'AVAXUSDT'],
      ['UNI', 'Uniswap', 'UNIUSDT'],
      ['ATOM', 'Cosmos', 'ATOMUSDT'],
      ['LINK', 'Chainlink', 'LINKUSDT'],
      ['XLM', 'Stellar', 'XLMUSDT'],
      ['NEAR', 'NEAR Protocol', 'NEARUSDT'],
      ['APT', 'Aptos', 'APTUSDT'],
      ['ALGO', 'Algorand', 'ALGOUSDT'],
      ['HBAR', 'Hedera', 'HBARUSDT'],
      ['VET', 'VeChain', 'VETUSDT'],
      ['ICP', 'Internet Computer', 'ICPUSDT'],
      ['FIL', 'Filecoin', 'FILUSDT'],
      ['SAND', 'The Sandbox', 'SANDUSDT'],
      ['AAVE', 'Aave', 'AAVEUSDT'],
      ['EGLD', 'MultiversX', 'EGLDUSDT'],
      ['GRT', 'The Graph', 'GRTUSDT'],
      ['FTM', 'Fantom', 'FTMUSDT'],
      ['AXS', 'Axie Infinity', 'AXSUSDT'],
      ['THETA', 'Theta Network', 'THETAUSDT'],
      ['RUNE', 'THORChain', 'RUNEUSDT'],
      ['CHZ', 'Chiliz', 'CHZUSDT'],
      ['CRV', 'Curve DAO Token', 'CRVUSDT'],
      ['DYDX', 'dYdX', 'DYDXUSDT'],
      ['GMT', 'STEPN', 'GMTUSDT'],
      ['CAKE', 'PancakeSwap', 'CAKEUSDT'],
    ]),
  },
];

export const FALLBACK_CURRENCY_MAP = new Map(
  FALLBACK_CATEGORIES.flatMap((category) =>
    category.currencies.map((currency) => [currency.base_currency, currency] as const),
  ),
);

export const getFallbackCurrency = (baseCurrency: string): Currency | undefined =>
  FALLBACK_CURRENCY_MAP.get(baseCurrency);

export const mergeServerCategoriesWithFallback = (
  categories: CurrencyCategory[],
): CurrencyCategory[] => {
  if (categories.length > 0) {
    return categories;
  }

  return FALLBACK_CATEGORIES.map((category, index) => ({
    id: -1 - index,
    name: category.name,
    currencies: category.currencies,
  }));
};

