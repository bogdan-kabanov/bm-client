import type { Dispatch, SetStateAction, Key } from 'react';
import { Currency, CurrencyCategory } from '@src/shared/api';
import { TradeMessage } from '@src/entities/websoket/websocket-types';

export interface UserProfile {
  id?: number;
  balance?: number;
  demo_balance?: number;
  trading_banned?: boolean;
  custom_winrate_enabled?: boolean;
  custom_winrate_percent?: number | null;
}

export interface TradingTerminalProps {
  selectedBase: string;
  onBaseChange: (base: string, quote?: string) => void;
  isTradingActive: boolean;
  onStartTrading: () => void;
  selectedDuration: string;
  onDurationSelect: (duration: string) => void;
  tradingDurations: any[];
  isProcessing: boolean;
  tradingMode: 'manual' | 'demo';
  onTradingModeChange: (mode: 'manual' | 'demo') => void;
  userProfile?: UserProfile;
  balance?: number;
  sendMessage: (message: TradeMessage) => void;
  onMessage?: (messageType: string, handler: (message: any) => void) => () => void;
  isConnected?: boolean;
  isReady?: boolean;
  onPricePanelData?: (data: PricePanelDataPayload) => void;
  onCalculatorOpen?: (position: { left: number; top: number }) => void;
  onTimeCalculatorOpen?: (position: { left: number; top: number }) => void;
  onOpenAddSignalModal?: () => void;
}

export type PricePanelDataPayload = {
  currentPrice: number | null;
  price1: number | null;
  price2: number | null;
  priceDiff: number;
  priceDiffPercent: number;
  spreadPercent: number;
  activeTrades: any[];
  tradeHistory: any[];
  manualTradeAmount: string;
  setManualTradeAmount: (value: string) => void;
  handleManualTrade: (direction: 'buy' | 'sell') => void;
  formatPrice: (price: number | null) => string;
  formatHMS: (totalSeconds: number) => string;
  parsedExpiration: number;
  changeExpiration: (delta: number) => void;
  setExpirationSeconds: (value: string) => void;
  quickPresets: Array<{ label: string; seconds: number }>;
  setHoveredButton: (button: 'buy' | 'sell' | null) => void;
  quoteCurrency: string;
  onLoadMoreHistory?: () => void;
  isLoadingMoreHistory?: boolean;
  hasMoreHistory?: boolean;
  getCurrencyInfo?: (baseCurrency: string) => Currency | undefined;
  resolveCurrencyIconUrls?: (currency?: Currency | null) => string[];
  requestActiveTrades?: () => void;
  requestTradeHistory?: () => void;
};

export interface CurrencyTableRow {
  key: Key;
  baseCurrency: string;
  quoteCurrency?: string | null;
  displayName?: string | null;
  symbol?: string | null;
  averagePrice?: number | null;
  payoutPercent?: number | null;
  iconUrls: string[];
  isFavorite: boolean;
  isActive: boolean;
  formattedPair: string;
  onSelect: () => void;
  onToggleFavorite: () => void;
}

export interface CurrencyDataContext {
  currencyCategories: CurrencyCategory[];
  currenciesLoading: boolean;
  selectedCategoryId: number | null;
  setSelectedCategoryId: (id: number | null) => void;
  favoriteCurrencies: string[];
  setFavoriteCurrencies: Dispatch<SetStateAction<string[]>>;
  getCurrencyInfo: (baseCurrency: string) => Currency | undefined;
  resolveCurrencyIconUrls: (currency?: Currency | null) => string[];
  resolveCurrencyAveragePrice: (baseCurrency: string) => number | null;
}

