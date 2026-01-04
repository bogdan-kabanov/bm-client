/**
 * Сервис для управления созданием ставок
 * 
 * Правила работы:
 * 1. Ставка отправляется на сервер через WebSocket (безопаснее, т.к. пользователь авторизован через WebSocket)
 * 2. Маркер и активный трейд создаются ТОЛЬКО после подтверждения от сервера
 * 3. Все операции логируются
 * 4. Все ошибки обрабатываются через try-catch
 * 5. ВСЕГДА используется серверное время, НИКОГДА не используется локальное время клиента
 */

import type { ActiveTrade } from '@src/entities/trading/model/types';
import { getServerTime } from '@src/shared/lib/serverTime';

export interface PlaceTradeParams {
  id: number;
  direction: 'buy' | 'sell';
  amount: number;
  price: number;
  expirationSeconds: number;
  mode: 'manual' | 'demo';
  timeframe?: string;
  trade_timestamp?: number;
}

export interface PlaceTradeResult {
  success: boolean;
  tradeId?: string;
  trade?: ActiveTrade;
  error?: string;
  errorCode?: string;
}

interface PendingTrade {
  params: PlaceTradeParams;
  timestamp: number;
  timeoutId?: NodeJS.Timeout;
  onSuccess: (result: PlaceTradeResult) => void;
  onError: (error: string) => void;
}

class TradePlacementService {
  private pendingTrades = new Map<string, PendingTrade>();
  private readonly TRADE_TIMEOUT = 10000; // 10 секунд таймаут на ответ от сервера
  private requestIdCounter = 0;

  /**
   * Логирование с префиксом
   */
  private log(level: 'INFO' | 'WARN' | 'ERROR', message: string, data?: any): void {
    if (level === 'ERROR') {
      console.error(`[TRADE_PLACEMENT] ${message}`, data);
    } else if (level === 'WARN') {
      console.warn(`[TRADE_PLACEMENT] ${message}`, data);
    } else if (level === 'INFO') {
      console.log(`[TRADE_PLACEMENT] ${message}`, data);
    }
  }

  /**
   * Генерация уникального ID для запроса
   */
  private generateRequestId(): string {
    this.requestIdCounter += 1;
    return `trade_req_${Date.now()}_${this.requestIdCounter}`;
  }

  /**
   * Создание ставки через WebSocket
   * 
   * @param params - Параметры ставки
   * @param sendMessage - Функция для отправки сообщения через WebSocket
   * @param onSuccess - Callback при успешном создании
   * @param onError - Callback при ошибке
   * @returns ID запроса для отслеживания
   */
  async placeTrade(
    params: PlaceTradeParams,
    sendMessage: (message: any) => void,
    onSuccess: (result: PlaceTradeResult) => void,
    onError: (error: string) => void
  ): Promise<string> {
    const requestId = this.generateRequestId();
    
    try {
      this.log('INFO', `🎯 Начало создания ставки через WebSocket`, { requestId, params });

      // Валидация параметров
      const validationError = this.validateParams(params);
      if (validationError) {
        this.log('ERROR', `❌ Ошибка валидации параметров`, { requestId, error: validationError });
        onError(validationError);
        return requestId;
      }

      // Проверяем, что sendMessage доступен
      if (!sendMessage || typeof sendMessage !== 'function') {
        const errorMsg = 'WebSocket is not connected. Cannot send trade.';
        this.log('ERROR', `❌ ${errorMsg}`, { requestId, hasSendMessage: !!sendMessage });
        onError(errorMsg);
        return requestId;
      }

      // Сохраняем pending trade для отслеживания
      const pendingTrade: PendingTrade = {
        params,
        timestamp: params.trade_timestamp || getServerTime(),
        onSuccess,
        onError,
      };
      this.pendingTrades.set(requestId, pendingTrade);

      // Устанавливаем таймаут (onError уже сохранен в pendingTrade)
      const timeoutId = setTimeout(() => {
        this.handleTimeout(requestId, onError);
      }, this.TRADE_TIMEOUT);
      pendingTrade.timeoutId = timeoutId;

      // Формируем сообщение для отправки через WebSocket
      const wsMessage = {
        type: 'place-trade',
        data: {
          id: params.id,  // ID валюты
          direction: params.direction,
          amount: params.amount,
          price: params.price,
          expirationSeconds: params.expirationSeconds,
          mode: params.mode,
          timeframe: params.timeframe,
          trade_timestamp: params.trade_timestamp || getServerTime(),
        }
      };

      this.log('INFO', `📤 Отправка ставки через WebSocket`, { 
        requestId, 
        message: wsMessage,
        userId: 'определяется на сервере через WebSocket авторизацию'
      });

      // Отправляем сообщение через WebSocket
      try {
        sendMessage(wsMessage);
        this.log('INFO', `✅ Сообщение отправлено через WebSocket`, { requestId });
        
        // Ожидаем ответ через handleTradePlaced (который будет вызван из обработчика WebSocket сообщений)
        // Ответ будет обработан асинхронно через handleTradePlaced
      } catch (wsError: any) {
        this.log('ERROR', `❌ Ошибка отправки через WebSocket`, { requestId, error: wsError });
        
        // Очищаем pending trade при ошибке
        if (pendingTrade.timeoutId) {
          clearTimeout(pendingTrade.timeoutId);
        }
        this.pendingTrades.delete(requestId);
        
        onError(`Error sending request: ${wsError.message || 'Unknown error'}`);
      }

      return requestId;

    } catch (error: any) {
      this.log('ERROR', `Critical error creating trade`, { requestId, error });
      onError(`Critical error: ${error.message || 'Unknown error'}`);
      return requestId;
    }
  }

  /**
   * Обработка успешного ответа от сервера
   */
  handleTradePlaced(message: any, fallbackOnSuccess?: (result: PlaceTradeResult) => void): void {
    try {
      this.log('INFO', `Received trade_placed response from server`, { message });

      // Проверяем формат сообщения: { type: 'trade_placed', data: trade }
      // Сервер может отправлять как { type: 'trade_placed', data: trade }, так и { type: 'trade_placed', success: true, data: trade }
      if (!message || message.type !== 'trade_placed') {
        this.log('WARN', `trade_placed response does not have correct type`, { message });
        return;
      }

      const data = message.data;
      if (!data) {
        this.log('ERROR', `trade_placed response does not contain data`, { message });
        return;
      }

      // Ищем соответствующий pending trade по параметрам
      const requestId = this.findMatchingPendingTrade(data);
      
      if (!requestId) {
        // Пытаемся найти по любому pending trade (берем последний)
        // Это fallback на случай, если matching не сработал из-за небольших различий в параметрах
        const pendingTradesArray = Array.from(this.pendingTrades.entries());
        if (pendingTradesArray.length > 0 && fallbackOnSuccess) {
          const [lastRequestId, lastPendingTrade] = pendingTradesArray[pendingTradesArray.length - 1];
          this.log('WARN', `Using fallback: last pending trade for response`, { 
            lastRequestId, 
            pendingTradesCount: pendingTradesArray.length,
            data 
          });
          
          // Очищаем таймаут
          if (lastPendingTrade.timeoutId) {
            clearTimeout(lastPendingTrade.timeoutId);
          }
          
          // Сохраняем callback перед удалением
          const { onSuccess } = lastPendingTrade;
          this.pendingTrades.delete(lastRequestId);
          
          // Обрабатываем ответ
          this.processTradePlacedResponse(data, onSuccess || fallbackOnSuccess);
          return;
        }
        
        this.log('WARN', `No matching pending trade found for response`, { 
          pendingTradesCount: this.pendingTrades.size,
          data 
        });
        // Если есть fallback callback, используем его (для совместимости со старым кодом)
        if (fallbackOnSuccess) {
          this.processTradePlacedResponse(data, fallbackOnSuccess);
        }
        return;
      }

      const pendingTrade = this.pendingTrades.get(requestId);
      if (!pendingTrade) {
        this.log('WARN', `Pending trade not found for requestId`, { requestId });
        if (fallbackOnSuccess) {
          this.processTradePlacedResponse(data, fallbackOnSuccess);
        }
        return;
      }

      // Очищаем таймаут
      if (pendingTrade.timeoutId) {
        clearTimeout(pendingTrade.timeoutId);
      }

      // Сохраняем callbacks перед удалением
      const { onSuccess, onError } = pendingTrade;

      // Удаляем из pending
      this.pendingTrades.delete(requestId);

      this.log('INFO', `Processing successful response`, { requestId, data });

      // Создаем результат используя сохраненный callback
      const result = this.processTradePlacedResponse(data, onSuccess);
      
      this.log('INFO', `Trade successfully created`, { requestId, result });

    } catch (error: any) {
      this.log('ERROR', `Error processing trade_placed`, { error, message });
    }
  }

  /**
   * Обработка ошибки от сервера
   */
  handleTradeError(message: any, fallbackOnError?: (error: string) => void): void {
    try {
      // Улучшенное логирование для отладки
      console.error('[TRADE_PLACEMENT] ========== ERROR FROM SERVER ==========');
      console.error('[TRADE_PLACEMENT] Full error message:', JSON.stringify(message, null, 2));
      console.error('[TRADE_PLACEMENT] Error type:', message?.type);
      console.error('[TRADE_PLACEMENT] Error message field:', message?.message);
      console.error('[TRADE_PLACEMENT] Error error field:', message?.error);
      console.error('[TRADE_PLACEMENT] Error data:', message?.data);
      
      this.log('ERROR', `Received error from server`, { 
        message,
        type: message?.type,
        errorMessage: message?.message,
        errorField: message?.error,
        data: message?.data,
        fullMessage: JSON.stringify(message, null, 2)
      });

      const errorMessage = message?.message || message?.error || message?.data?.error || 'Unknown server error';
      
      // Пытаемся найти соответствующий pending trade
      // Если не находим, просто показываем ошибку
      const requestIds = Array.from(this.pendingTrades.keys());
      if (requestIds.length > 0) {
        // Берем последний pending trade
        const lastRequestId = requestIds[requestIds.length - 1];
        const pendingTrade = this.pendingTrades.get(lastRequestId);
        
        if (pendingTrade) {
          if (pendingTrade.timeoutId) {
            clearTimeout(pendingTrade.timeoutId);
          }
          
          // Используем сохраненный callback
          const { onError } = pendingTrade;
          this.pendingTrades.delete(lastRequestId);
          this.log('INFO', `Removed pending trade after error`, { lastRequestId });
          
          onError(errorMessage);
          return;
        }
      }

      // Если не нашли pending trade, используем fallback callback
      if (fallbackOnError) {
        fallbackOnError(errorMessage);
      }

    } catch (error: any) {
      this.log('ERROR', `Error processing server error`, { error, message });
      if (fallbackOnError) {
        fallbackOnError('Error processing server response');
      }
    }
  }

  /**
   * Обработка таймаута
   */
  private handleTimeout(requestId: string, onError: (error: string) => void): void {
    try {
      const pendingTrade = this.pendingTrades.get(requestId);
      
      if (pendingTrade) {
        this.log('ERROR', `Timeout waiting for server response`, { requestId, timeout: this.TRADE_TIMEOUT });
        
        // Используем сохраненный callback
        const { onError: savedOnError } = pendingTrade;
        this.pendingTrades.delete(requestId);
        
        savedOnError('Server response timeout exceeded. The trade may have been created, please check active trades.');
      }

    } catch (error: any) {
      this.log('ERROR', `Error processing timeout`, { requestId, error });
    }
  }

  /**
   * Поиск соответствующего pending trade
   */
  private findMatchingPendingTrade(data: any): string | null {
    try {
      // В ответе от сервера нет data.id, используем другие поля для проверки
      if (!data || !data.direction || !data.amount) {
        this.log('WARN', `Insufficient data to find pending trade`, { data });
        return null;
      }

      this.log('INFO', `Searching for pending trade`, { 
        pendingTradesCount: this.pendingTrades.size,
        dataDirection: data.direction,
        dataAmount: data.amount,
        dataEntryPrice: data.entryPrice,
        dataPrice: data.price,
        dataSymbol: data.symbol,
        dataTradeTimestamp: data.trade_timestamp || data.tradeTimestamp || data.createdAt
      });

      for (const [requestId, pendingTrade] of this.pendingTrades.entries()) {
        const params = pendingTrade.params;
        
        // Проверяем совпадение основных параметров
        // ВАЖНО: в ответе сервера нет data.id, поэтому не проверяем idMatch
        const directionMatch = params.direction === data.direction;
        const amountMatch = Math.abs(params.amount - data.amount) < 0.01;
        const priceMatch = Math.abs(params.price - (data.entryPrice || data.price || 0)) < 0.01;
        
        // Проверяем временную близость (в пределах 10 секунд)
        // ВАЖНО: используем серверное время для сравнения, а не локальное время клиента
        const serverTime = getServerTime();
        const data_timestamp = data.trade_timestamp || data.tradeTimestamp || data.createdAt || serverTime;
        const time_diff = Math.abs(data_timestamp - pendingTrade.timestamp);
        const time_match = time_diff < 10000;

        this.log('INFO', `Checking pending trade`, { 
          requestId,
          directionMatch,
          amountMatch,
          priceMatch,
          time_match,
          time_diff,
          paramsDirection: params.direction,
          dataDirection: data.direction,
          paramsAmount: params.amount,
          dataAmount: data.amount,
          paramsPrice: params.price,
          dataEntryPrice: data.entryPrice,
          dataPrice: data.price,
          pendingTimestamp: pendingTrade.timestamp,
          data_timestamp
        });

        // Убираем проверку idMatch, так как в ответе сервера нет data.id
        if (directionMatch && amountMatch && priceMatch && time_match) {
          this.log('INFO', `✅ Found matching pending trade`, { requestId, params, data });
          return requestId;
        }
      }

      this.log('WARN', `No matching pending trade found`, { 
        pendingTradesCount: this.pendingTrades.size,
        data
      });
      return null;

    } catch (error: any) {
      this.log('ERROR', `Ошибка поиска pending trade`, { error, data });
      return null;
    }
  }

  /**
   * Обработка ответа trade_placed и создание результата
   */
  private processTradePlacedResponse(data: any, onSuccess: (result: PlaceTradeResult) => void): PlaceTradeResult {
    try {
      // ВАЖНО: используем серверное время для генерации ID, если нужно
      const tradeId = data.tradeId || `trade_${data.id || getServerTime()}`;
      
      // Логируем источник entryPrice из данных сервера
      // ВАЖНО: createdAt должен быть зафиксирован на момент создания сделки на сервере
      // Используем только данные с сервера, НИКОГДА не используем Date.now() как fallback
      const created_at = data.createdAt || data.trade_timestamp || data.tradeTimestamp;
      
      if (!created_at || !Number.isFinite(created_at) || created_at <= 0) {
        this.log('ERROR', `Отсутствует валидный createdAt в данных сервера`, {
          tradeId: tradeId,
          dataCreatedAt: data.createdAt,
          dataTradeTimestamp: data.trade_timestamp,
          dataTradeTimestamp2: data.tradeTimestamp,
          data: data
        });
        // Если createdAt отсутствует, это критическая ошибка - не создаем трейд
        throw new Error('Missing valid createdAt in server data');
      }
      
      console.log('[TRADE_PLACEMENT] Источник entryPrice и createdAt из данных сервера', {
        tradeId: tradeId,
        dataEntryPrice: data.entryPrice,
        dataPrice: data.price,
        dataCurrentPrice: data.currentPrice,
        dataCurrentPriceAtTrade: data.currentPriceAtTrade,
        finalEntryPrice: data.entryPrice || data.price,
        entryPriceSource: data.entryPrice ? 'data.entryPrice' : 'data.price',
        createdAt: created_at,
        createdAtSource: data.createdAt ? 'data.createdAt' : (data.trade_timestamp ? 'data.trade_timestamp' : 'data.tradeTimestamp'),
        serverTime: getServerTime(),
        time_diff: getServerTime() - created_at
      });
      
      // Создаем активный трейд
      // ВАЖНО: entryPrice должна быть ценой ставки, а не ценой на момент времени ставки
      const entryPrice = data.entryPrice || data.price;
      const trade: ActiveTrade = {
        id: tradeId,
        symbol: data.symbol,
        direction: data.direction,
        amount: data.amount,
        price: entryPrice, // Цена ставки (для совместимости)
        entryPrice: entryPrice, // Цена ставки
        currentPrice: data.currentPrice || entryPrice,
        currentPriceAtTrade: data.currentPriceAtTrade || entryPrice,
        expirationTime: data.expirationTime,
        createdAt: created_at, // ВАЖНО: используем только данные с сервера, без fallback
        baseCurrency: data.baseCurrency || data.symbol?.split('_')[0],
        quoteCurrency: data.quoteCurrency || data.symbol?.split('_')[1] || 'USDT',
        isDemo: data.isDemo || data.is_demo || false,
        is_demo: data.isDemo || data.is_demo || false,
      };

      const result: PlaceTradeResult = {
        success: true,
        tradeId,
        trade,
      };

      this.log('INFO', `Создан результат для ставки`, { result });
      
      console.log('[TRADE_PLACEMENT] Вызываем onSuccess callback', {
        hasOnSuccess: !!onSuccess,
        resultSuccess: result.success,
        hasTrade: !!result.trade,
        tradeId: result.tradeId,
        entryPrice: result.trade?.entryPrice,
        createdAt: result.trade?.createdAt
      });
      
      // Вызываем callback только после успешного создания всех данных
      onSuccess(result);
      
      console.log('[TRADE_PLACEMENT] onSuccess callback вызван');

      return result;

    } catch (error: any) {
      this.log('ERROR', `Ошибка обработки ответа trade_placed`, { error, data });
      throw error;
    }
  }

  /**
   * Валидация параметров
   */
  private validateParams(params: PlaceTradeParams): string | null {
    try {
      if (!params.id || typeof params.id !== 'number' || params.id <= 0) {
        return 'Currency ID is required';
      }

      if (!params.direction || (params.direction !== 'buy' && params.direction !== 'sell')) {
        return 'Direction must be "buy" or "sell"';
      }

      if (!params.amount || params.amount <= 0) {
        return 'Trade amount must be greater than zero';
      }

      if (!params.price || params.price <= 0) {
        return 'Price must be greater than zero';
      }

      if (!params.expirationSeconds || params.expirationSeconds < 30) {
        return 'Expiration time must be at least 30 seconds';
      }

      if (!params.mode || !['manual', 'demo'].includes(params.mode)) {
        return 'Mode must be "manual" or "demo"';
      }

      return null;

    } catch (error: any) {
      return `Validation error: ${error.message || 'Unknown error'}`;
    }
  }

  /**
   * Очистка всех pending trades
   */
  clearPendingTrades(): void {
    try {
      this.log('INFO', `Clearing all pending trades`, { count: this.pendingTrades.size });
      
      for (const [requestId, pendingTrade] of this.pendingTrades.entries()) {
        if (pendingTrade.timeoutId) {
          clearTimeout(pendingTrade.timeoutId);
        }
      }
      
      this.pendingTrades.clear();
      this.log('INFO', `All pending trades cleared`);

    } catch (error: any) {
      this.log('ERROR', `Error clearing pending trades`, { error });
    }
  }

  /**
   * Получение количества pending trades
   */
  getPendingTradesCount(): number {
    return this.pendingTrades.size;
  }
}

// Экспортируем singleton инстанс
export const tradePlacementService = new TradePlacementService();

