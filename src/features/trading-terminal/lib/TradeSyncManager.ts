import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { getServerTime } from '@src/shared/lib/serverTime';
import { normalizeCurrencyPair } from '@src/shared/lib/currencyPairUtils';

export type TradeMode = 'manual' | 'demo';

export interface TradeHistoryEntry {
  id: string;
  price: number;
  direction: 'buy' | 'sell';
  amount: number;
  entryPrice: number;
  exitPrice: number;
  profit: number;
  profitPercent: number;
  isWin: boolean;
  createdAt: number;
  completedAt: number | null;
  expirationTime?: number | null;
  symbol?: string | null;
  baseCurrency?: string | null;
  quoteCurrency?: string | null;
  isDemo?: boolean;
  is_demo?: boolean;
}

export interface PendingTradeData {
  direction: 'buy' | 'sell';
  amount: number;
  entryPrice: number;
  expirationSeconds: number;
  createdAt: number;
  symbol?: string | null;
  baseCurrency?: string | null;
  quoteCurrency?: string | null;
  requestSentAt?: number;
}

export interface TradeCacheRecord {
  tradeHistory: TradeHistoryEntry[];
  loaded: boolean;
}

export interface TradeSyncManagerStaticDeps {
  setTradeHistory: Dispatch<SetStateAction<TradeHistoryEntry[]>>;
  setLastTrade: Dispatch<
    SetStateAction<
      | {
          price: number;
          currentPriceAtTrade: number;
          direction: 'buy' | 'sell';
          amount: number;
          timestamp: number;
        }
      | null
    >
  >;
  tradesCacheRef: MutableRefObject<Record<TradeMode, TradeCacheRecord>>;
  pendingRequestsRef: MutableRefObject<Map<string, TradeMode>>;
  processedExpiredTradesRef: MutableRefObject<Set<string>>;
  pendingTradeDataRef: MutableRefObject<PendingTradeData | null>;
  currentPriceStateRef: MutableRefObject<number | null>;
}

export interface TradeSyncManagerDynamicContext {
  getTradingMode: () => TradeMode;
  getSelectedBase: () => string;
  getCurrentPrice: () => number | null;
  getServerTime: () => number;
  updateServerTimeOffset: (offset: number) => void;
  wsSendMessage: ((message: any) => void) | null;
  wsOnMessage: ((type: string, handler: (message: any) => void) => () => void) | null;
  isConnected: () => boolean;
  getUserId: () => number | undefined;
}

type TradeSymbolSource = {
  symbol?: string | null;
  pair?: string | null;
  baseCurrency?: string | null;
  base_currency?: string | null;
  quoteCurrency?: string | null;
  quote_currency?: string | null;
};

type TradeSymbolResolution = {
  normalizedSymbol: string | null;
  displaySymbol: string | null;
  baseCurrency: string | null;
  quoteCurrency: string | null;
};

const toUpperOrNull = (value?: string | null): string | null => {
  if (value === null || value === undefined) {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed ? trimmed.toUpperCase() : null;
};

const parseSymbolParts = (symbol?: string | null): { base: string | null; quote: string | null } => {
  const normalized = symbol ? normalizeCurrencyPair(symbol) : null;
  if (!normalized) {
    return { base: null, quote: null };
  }

  const separatorIndex = normalized.indexOf('_');
  if (separatorIndex !== -1) {
    const basePart = normalized.slice(0, separatorIndex);
    const quotePart = normalized.slice(separatorIndex + 1);
    return {
      base: basePart || null,
      quote: quotePart || null,
    };
  }

  if (normalized.length >= 6) {
    const basePart = normalized.slice(0, 3);
    const quotePart = normalized.slice(3);
    return {
      base: basePart || null,
      quote: quotePart || null,
    };
  }

  return { base: normalized, quote: null };
};

const buildDisplaySymbol = (symbol?: string | null, base?: string | null, quote?: string | null): string | null => {
  const upperSymbol = toUpperOrNull(symbol);
  if (upperSymbol) {
    if (upperSymbol.includes('/')) {
      return upperSymbol;
    }
    if (upperSymbol.includes('_')) {
      return upperSymbol.replace(/_/g, '/');
    }
    if (upperSymbol.includes('-')) {
      return upperSymbol.replace(/-/g, '/');
    }
    return upperSymbol;
  }

  const upperBase = toUpperOrNull(base);
  const upperQuote = toUpperOrNull(quote);
  if (upperBase && upperQuote) {
    return `${upperBase}/${upperQuote}`;
  }
  if (upperBase) {
    return upperBase;
  }
  return null;
};

const resolveTradeSymbolInfo = (
  source: TradeSymbolSource,
  fallbackBase?: string | null,
  fallbackQuote?: string | null,
): TradeSymbolResolution => {
  const rawSymbol = source.symbol ?? source.pair ?? null;
  const parsed = parseSymbolParts(rawSymbol);
  const baseCurrency =
    toUpperOrNull(source.baseCurrency ?? source.base_currency) ??
    parsed.base ??
    toUpperOrNull(fallbackBase);
  const quoteCurrency =
    toUpperOrNull(source.quoteCurrency ?? source.quote_currency) ??
    parsed.quote ??
    toUpperOrNull(fallbackQuote);
  const normalizedSymbol = normalizeCurrencyPair(
    rawSymbol ?? (baseCurrency && quoteCurrency ? `${baseCurrency}_${quoteCurrency}` : null) ?? '',
  );
  const displaySymbol = buildDisplaySymbol(rawSymbol, baseCurrency, quoteCurrency);

  return {
    normalizedSymbol,
    displaySymbol,
    baseCurrency,
    quoteCurrency,
  };
};

export class TradeSyncManager {
  private readonly deps: TradeSyncManagerStaticDeps;
  private context: TradeSyncManagerDynamicContext | null = null;
  private unsubscribers: Array<() => void> = [];
  private periodicSyncTimer: ReturnType<typeof setInterval> | null = null;
  private lastRequestTime = 0;
  private readonly REQUEST_THROTTLE_MS = 2000;
  private isFirstSyncAfterLoad = true;
  private processedTradePlacedIds = new Set<string>();

  constructor(deps: TradeSyncManagerStaticDeps) {
    this.deps = deps;
  }

  updateContext(context: TradeSyncManagerDynamicContext): void {
    // Убрано избыточное логирование, которое вызывало проблемы производительности
    this.context = context;
  }

  registerHandlers(): void {
    this.detachHandlers();

    if (!this.context) {
      return;
    }

    const { wsOnMessage } = this.context;

    if (!wsOnMessage) {
      return;
    }

    try {
      console.log('[TRADE_HISTORY] 🔧 Регистрация обработчика trade_history');
      const unsubscribe = wsOnMessage('trade_history', (message: any) => {
        console.log('[TRADE_HISTORY] 📥 Обработчик trade_history вызван', {
          messageType: message?.type,
          messageSuccess: message?.success,
          hasData: !!message?.data,
          hasTrades: !!message?.data?.trades,
          tradesCount: message?.data?.trades?.length || 0
        });
        this.handleTradeHistory(message);
      });
      this.unsubscribers.push(unsubscribe);
      console.log('[TRADE_HISTORY] ✅ Обработчик trade_history зарегистрирован');

      this.unsubscribers.push(
        wsOnMessage('manual_trade_expired', (message: any) => {
          this.handleTradeExpired(message);
        }),
      );

      const windowEventHandler = (event: CustomEvent) => {
        this.handleTradePlaced({
          success: true,
          data: event.detail,
        });
      };

      window.addEventListener('trade_placed', windowEventHandler as EventListener);
      this.unsubscribers.push(() => {
        window.removeEventListener('trade_placed', windowEventHandler as EventListener);
      });
    } catch (error) {
      console.error('[TRADE_HISTORY] TradeSyncManager: ошибка регистрации обработчиков', { error });
    }
  }

  detachHandlers(): void {
    this.unsubscribers.forEach((unsubscribe) => {
      try {
        unsubscribe();
      } catch (error) {
      }
    });
    this.unsubscribers = [];
  }

  requestInitialData(mode?: TradeMode): void {
    if (!this.context) {
      return;
    }

    if (!this.context.isConnected()) {
      setTimeout(() => {
        if (this.context?.isConnected()) {
          this.requestInitialData(mode);
        }
      }, 100);
      return;
    }

    const targetMode = mode ?? this.context.getTradingMode();

    this.isFirstSyncAfterLoad = true;
    this.requestTradeHistory(targetMode, 50);
  }

  requestTradeHistory(modeOverride?: TradeMode, limit: number = 50, onlyNew: boolean = false): string | null {
    if (!this.context) {
      return null;
    }

    const { wsSendMessage, isConnected } = this.context;
    if (!wsSendMessage || !isConnected()) {
      return null;
    }

    const mode = modeOverride ?? this.context.getTradingMode();
    const userId = this.context.getUserId();
    
    if (!userId) {
      return null;
    }

    const cache = this.deps.tradesCacheRef.current[mode];
    let lastId: number | undefined = undefined;
    
    if (onlyNew && cache.tradeHistory.length > 0) {
      const maxId = Math.max(...cache.tradeHistory.map(t => {
        const id = typeof t.id === 'string' ? parseInt(t.id) : t.id;
        return isNaN(id) ? 0 : id;
      }));
      if (maxId > 0) {
        lastId = maxId;
      } else {
        return null;
      }
    }

    if (onlyNew && lastId) {
      (cache as any).lastRequestWasOnlyNew = true;
    } else {
      (cache as any).lastRequestWasOnlyNew = false;
    }

    // Сохраняем лимит для обработки ответа
    (cache as any).lastRequestedLimit = limit;

    const requestId = `history_${Date.now()}_${Math.random()}`;
    this.deps.pendingRequestsRef.current.set(requestId, mode);

    const messageToSend = {
      type: 'get-trade-history',
      mode,
      limit,
      lastId,
      requestId,
    };

    console.log('[TRADE_HISTORY] 📤 Отправка запроса get-trade-history', {
      requestId,
      mode,
      limit,
      lastId,
      hasWsSendMessage: !!wsSendMessage,
      isConnected: isConnected()
    });

    try {
      wsSendMessage(messageToSend as any);
      console.log('[TRADE_HISTORY] ✅ Запрос get-trade-history отправлен', { requestId });
    } catch (error) {
      console.error('[TRADE_HISTORY] ❌ Ошибка отправки', { error, requestId });
      this.deps.pendingRequestsRef.current.delete(requestId);
      return null;
    }

    return requestId;
  }

  startPeriodicSync(intervalMs: number = 10000): void {
    this.stopPeriodicSync();

    if (!this.context || !this.context.isConnected()) {
      return;
    }

    const mode = this.context.getTradingMode();

    this.periodicSyncTimer = setInterval(() => {
      this.requestTradeHistory();
    }, intervalMs);
  }

  stopPeriodicSync(): void {
    if (this.periodicSyncTimer) {
      clearInterval(this.periodicSyncTimer);
      this.periodicSyncTimer = null;
    }
  }

  getCache(mode: TradeMode): TradeCacheRecord {
    const cache = this.deps.tradesCacheRef.current[mode];
    return cache;
  }

  setCache(mode: TradeMode, cache: TradeCacheRecord): void {
    this.deps.tradesCacheRef.current[mode] = cache;
  }

  clearCacheForModes(modes: TradeMode[]): void {
    modes.forEach((mode) => {
      this.deps.tradesCacheRef.current[mode] = {
        tradeHistory: [],
        loaded: false,
      };
    });
  }

  resetModeRequestFlag(mode: TradeMode): void {
    const cache = this.deps.tradesCacheRef.current[mode];
    if (cache) {
      cache.loaded = false;
    }
  }

  resetInitialRequestFlag(): void {
  }

  private resolveModeFromMessage(message: any): TradeMode {
    const fallbackMode = this.context?.getTradingMode() ?? 'manual';
    if (!message?.data?.requestId) {
      return fallbackMode;
    }

    const requestId = message.data.requestId;
    const mode = this.deps.pendingRequestsRef.current.get(requestId);
    if (mode) {
      this.deps.pendingRequestsRef.current.delete(requestId);
      return mode;
    }

    return fallbackMode;
  }

  private handleTradeHistory(message: any): void {
    console.log('[TRADE_HISTORY] 📥 Получен ответ trade_history', {
      hasContext: !!this.context,
      messageSuccess: message?.success,
      hasData: !!message?.data,
      hasTrades: !!message?.data?.trades,
      tradesCount: message?.data?.trades?.length || 0,
      messageType: message?.type,
      fullMessage: message
    });

    if (!this.context) {
      console.warn('[TRADE_HISTORY] ⚠️ Нет контекста для обработки trade_history');
      return;
    }

    const mode = this.resolveModeFromMessage(message);
    const cache = this.deps.tradesCacheRef.current[mode];

    if (!message?.success || !Array.isArray(message?.data?.trades)) {
      console.warn('[TRADE_HISTORY] ⚠️ Некорректный формат ответа trade_history', {
        success: message?.success,
        hasData: !!message?.data,
        hasTrades: !!message?.data?.trades,
        tradesIsArray: Array.isArray(message?.data?.trades),
        message
      });
      
      if (message?.success === false) {
        return;
      }

      cache.tradeHistory = [];
      cache.loaded = true;

      if (mode === this.context.getTradingMode()) {
        this.deps.setTradeHistory([]);
      }
      return;
    }
    
    console.log('[TRADE_HISTORY] ✅ Обработка trade_history', {
      mode,
      tradesCount: message.data.trades.length
    });
    
    const trades = message.data.trades.map((trade: any) => {
      const symbolInfo = resolveTradeSymbolInfo(trade);

      let isWin: boolean;

      const riggedOutcome = trade.rigged_outcome || trade.rigging?.outcome;
      if (riggedOutcome === 'win' || riggedOutcome === 'lose') {
        isWin = riggedOutcome === 'win';
      } else if (trade.isWin !== undefined && trade.isWin !== null) {
        isWin = trade.isWin === true;
      } else {
        isWin = (trade.profit !== undefined && trade.profit > 0) ||
                (trade.profitPercent !== undefined && trade.profitPercent > 0);
      }

      return {
        id: trade.id,
        price: trade.price,
        direction: trade.direction,
        amount: trade.amount,
        entryPrice: trade.entryPrice ?? trade.price,
        exitPrice: trade.exitPrice ?? trade.price,
        profit: trade.profit ?? 0,
        profitPercent: trade.profitPercent ?? 0,
        isWin: isWin,
        // ВАЖНО: используем серверное время, а не локальное время клиента
        createdAt:
          typeof trade.createdAt === 'number'
            ? trade.createdAt
            : trade.createdAt?.getTime?.() ?? getServerTime(),
        completedAt:
          typeof trade.completedAt === 'number' && trade.completedAt > 0
            ? trade.completedAt
            : (trade.completedAt?.getTime?.() && trade.completedAt.getTime() > 0 ? trade.completedAt.getTime() : (trade.completed_at ? (typeof trade.completed_at === 'number' && trade.completed_at > 0 ? trade.completed_at : (trade.completed_at?.getTime?.() && trade.completed_at.getTime() > 0 ? trade.completed_at.getTime() : null)) : null)),
        expirationTime:
          typeof trade.expirationTime === 'number'
            ? trade.expirationTime
            : (trade.expirationTime?.getTime?.() ?? (trade.expiration_time ? (typeof trade.expiration_time === 'number' ? trade.expiration_time : (trade.expiration_time?.getTime?.() ?? null)) : null)),
        symbol: trade.symbol || symbolInfo.displaySymbol || symbolInfo.normalizedSymbol,
        baseCurrency: symbolInfo.baseCurrency,
        quoteCurrency: symbolInfo.quoteCurrency,
        isDemo: trade.isDemo === true || trade.is_demo === true,
        is_demo: trade.is_demo ?? (trade.isDemo === true || trade.is_demo === true),
      };
    });

    const requestedLimit = (cache as any).lastRequestedLimit;
    const isAppend = requestedLimit && requestedLimit > cache.tradeHistory.length;
    const isOnlyNew = (cache as any).lastRequestWasOnlyNew === true;

    if (isOnlyNew && cache.tradeHistory.length > 0) {
      const existingIds = new Set(cache.tradeHistory.map(t => String(t.id)));
      const newTrades = trades.filter(t => !existingIds.has(String(t.id)));
      if (newTrades.length > 0) {
        cache.tradeHistory = [...cache.tradeHistory, ...newTrades]
          .sort((a, b) => {
            const idA = typeof a.id === 'string' ? parseInt(a.id) : a.id;
            const idB = typeof b.id === 'string' ? parseInt(b.id) : b.id;
            return (idB || 0) - (idA || 0);
          });
      }
    } else if (isAppend && cache.tradeHistory.length > 0) {
      const existingIds = new Set(cache.tradeHistory.map(t => String(t.id)));
      const newTrades = trades.filter(t => !existingIds.has(String(t.id)));
      const MAX_CACHE_HISTORY = 500;
      const merged = [...cache.tradeHistory, ...newTrades]
        .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))
        .slice(0, MAX_CACHE_HISTORY);
      cache.tradeHistory = merged;
    } else {
      const MAX_CACHE_HISTORY = 500;
      cache.tradeHistory = trades
        .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))
        .slice(0, MAX_CACHE_HISTORY);
    }
    cache.loaded = true;

    // Обновляем Redux только если режим совпадает с текущим
    const currentMode = this.context.getTradingMode();
    
    if (mode === currentMode) {
      if (isOnlyNew) {
        this.deps.setTradeHistory((prev) => {
          const existingIds = new Set(prev.map(t => String(t.id)));
          const newTrades = trades.filter(t => !existingIds.has(String(t.id)));
          if (newTrades.length > 0) {
            const merged = [...newTrades, ...prev]
              .sort((a, b) => {
                const idA = typeof a.id === 'string' ? parseInt(a.id) : a.id;
                const idB = typeof b.id === 'string' ? parseInt(b.id) : b.id;
                return (idB || 0) - (idA || 0);
              })
              .slice(0, 100);
            return merged;
          }
          return prev;
        });
      } else if (isAppend) {
        this.deps.setTradeHistory((prev) => {
          const existingIds = new Set(prev.map(t => String(t.id)));
          const newTrades = trades.filter(t => !existingIds.has(String(t.id)));
          const merged = [...newTrades, ...prev]
            .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))
            .slice(0, 100);
          return merged;
        });
      } else {
        // Полная загрузка истории - всегда обновляем Redux
        const sortedTrades = [...trades]
          .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))
          .slice(0, 100);
        this.deps.setTradeHistory(sortedTrades);
      }
    }
    
    (cache as any).lastRequestWasOnlyNew = false;
  }

  private handleTradeExpired(message: any): void {
    console.log('[TRADE_SYNC] 📨 Получено сообщение manual_trade_expired', {
      hasContext: !!this.context,
      messageSuccess: message?.success,
      hasData: !!message?.data,
      messageType: message?.type,
    });
    
    if (!this.context || !message?.success || !message?.data) {
      console.warn('[TRADE_SYNC] ⚠️ Пропуск обработки manual_trade_expired', {
        hasContext: !!this.context,
        messageSuccess: message?.success,
        hasData: !!message?.data,
      });
      return;
    }

    const completedTrade = message.data;
    const tradeId: string = completedTrade.tradeId || completedTrade.id;
    
    console.log('[TRADE_SYNC] 🔍 Извлечение tradeId из завершенной сделки', {
      tradeId,
      completedTradeId: completedTrade.id,
      completedTradeTradeId: completedTrade.tradeId,
      completedTrade: completedTrade,
    });
    
    if (!tradeId) {
      console.warn('[TRADE_SYNC] ⚠️ Не удалось извлечь tradeId из завершенной сделки', {
        completedTrade,
      });
      return;
    }

    const isDemoTrade = completedTrade.is_demo === true || completedTrade.isDemo === true;
    const currentTradingMode = this.context.getTradingMode();

    if ((currentTradingMode === 'demo' && !isDemoTrade) || (currentTradingMode === 'manual' && isDemoTrade)) {
      return;
    }

    this.deps.processedExpiredTradesRef.current.add(tradeId);

    const cacheMode: TradeMode = isDemoTrade ? 'demo' : 'manual';
    const cache = this.deps.tradesCacheRef.current[cacheMode];

    let isWin: boolean;
    const riggedOutcome = completedTrade.rigged_outcome || completedTrade.rigging?.outcome;
    if (riggedOutcome === 'win' || riggedOutcome === 'lose') {
      isWin = riggedOutcome === 'win';
    } else if (completedTrade.isWin !== undefined && completedTrade.isWin !== null) {
      isWin = completedTrade.isWin === true;
    } else {
      isWin = (completedTrade.profit !== undefined && completedTrade.profit > 0) ||
              (completedTrade.profitPercent !== undefined && completedTrade.profitPercent > 0);
    }

    this.deps.setLastTrade(null);

    const isDemoHistory =
      completedTrade.isDemo === true ||
      completedTrade.is_demo === true;

    const rawSymbol = completedTrade.symbol ?? completedTrade.pair;

    const symbolInfo = resolveTradeSymbolInfo(
      {
        symbol: rawSymbol,
        pair: completedTrade.pair,
        baseCurrency: completedTrade.baseCurrency ?? completedTrade.base_currency,
        base_currency: completedTrade.base_currency,
        quoteCurrency: completedTrade.quoteCurrency ?? completedTrade.quote_currency,
        quote_currency: completedTrade.quote_currency,
      },
      null,
      null,
    );

    const profit = completedTrade.profit !== undefined && completedTrade.profit !== null 
      ? Number(completedTrade.profit) 
      : 0;

    console.log('[TRADE_SYNC] 📊 Запрос истории сделок после завершения', {
      tradeId,
      isDemoHistory,
      mode: isDemoHistory ? 'demo' : 'manual',
      profit,
      isWin,
      completedTrade: {
        id: completedTrade.id,
        tradeId: completedTrade.tradeId,
        profit: completedTrade.profit,
        isWin: completedTrade.isWin,
        rigged_outcome: completedTrade.rigged_outcome,
      },
    });
    
    this.requestTradeHistory(isDemoHistory ? 'demo' : 'manual');

    // Запрашиваем обновление активных сделок, чтобы завершенная сделка была удалена из списка
    if (this.context.wsSendMessage) {
      try {
        console.log('[TRADE_SYNC] 📋 Запрос активных сделок после завершения', {
          tradeId,
          mode: isDemoHistory ? 'demo' : 'manual',
        });
        this.context.wsSendMessage({
          type: 'get-active-manual-trades',
          mode: isDemoHistory ? 'demo' : 'manual',
        } as any);
      } catch (error) {
        console.error('[TRADE_SYNC] ❌ Ошибка запроса активных сделок после завершения:', error);
      }
    }

    setTimeout(() => {
      console.log('[TRADE_SYNC] 🔄 Повторный запрос истории сделок через 1 секунду', {
        tradeId,
        mode: isDemoHistory ? 'demo' : 'manual',
      });
      this.requestTradeHistory(isDemoHistory ? 'demo' : 'manual');
      // Повторно запрашиваем активные сделки через секунду
      if (this.context.wsSendMessage) {
        try {
          this.context.wsSendMessage({
            type: 'get-active-manual-trades',
            mode: isDemoHistory ? 'demo' : 'manual',
          } as any);
        } catch (error) {
          console.error('[TRADE_SYNC] ❌ Ошибка повторного запроса активных сделок:', error);
        }
      }
    }, 1000);
  }

  private handleTradePlaced(message: any): void {
    if (!this.context || !message?.success || !message?.data?.tradeId) {
      return;
    }

    const data = message.data;
    const tradeId = data.tradeId;
    
    if (this.processedTradePlacedIds.has(tradeId)) {

      return;
    }
    
    this.processedTradePlacedIds.add(tradeId);
    setTimeout(() => {
      this.processedTradePlacedIds.delete(tradeId);
    }, 5000);
    
    const { pendingTradeDataRef } = this.deps;
    const pendingData = pendingTradeDataRef.current;
    const isDemoTrade = data.is_demo === true || data.isDemo === true;
    const currentTradingMode = this.context.getTradingMode();

    if ((currentTradingMode === 'demo' && !isDemoTrade) || (currentTradingMode === 'manual' && isDemoTrade)) {

      return;
    }

    const serverTime = data.serverTime;
    const clientReceivedAt = Date.now();
    if (serverTime && pendingData?.requestSentAt) {
      const networkRTT = clientReceivedAt - pendingData.requestSentAt;
      const networkLatency = networkRTT / 2;
      const offset = serverTime - (clientReceivedAt - networkLatency);
      if (Math.abs(offset) > 100) {
        this.context.updateServerTimeOffset(offset);
      }
    }

    const created_at = data.createdAt ?? pendingData?.createdAt ?? this.context.getServerTime();
    const expiration_time = data.expirationTime ??
      (pendingData
        ? created_at + pendingData.expirationSeconds * 1000
        : this.context.getServerTime() + 60000);

    const symbolInfo = resolveTradeSymbolInfo(
      {
        symbol: data.symbol ?? pendingData?.symbol,
        pair: data.pair ?? pendingData?.symbol,
        baseCurrency: data.baseCurrency ?? data.base_currency ?? pendingData?.baseCurrency,
        base_currency: data.base_currency,
        quoteCurrency: data.quoteCurrency ?? data.quote_currency ?? pendingData?.quoteCurrency,
        quote_currency: data.quote_currency,
      },
      pendingData?.baseCurrency ?? this.context.getSelectedBase(),
      pendingData?.quoteCurrency ?? null,
    );

    const entryPrice = pendingData?.entryPrice ?? data.entryPrice;

    const cache = this.deps.tradesCacheRef.current;
    const cacheMode: TradeMode = isDemoTrade ? 'demo' : 'manual';
    const cacheForMode = cache[cacheMode];
    cacheForMode.loaded = true;

    this.deps.setLastTrade({
      price: entryPrice,
      currentPriceAtTrade: entryPrice,
      direction: (pendingData?.direction ?? data.direction) as 'buy' | 'sell',
      amount: pendingData?.amount ?? data.amount,
      timestamp: created_at,
    });

    pendingTradeDataRef.current = null;
  }
}

export default TradeSyncManager;
