import { useCallback, useRef, useEffect } from 'react';
import { startTransition } from 'react';
import { useAppDispatch, useAppSelector } from '@src/shared/lib/hooks';
import { useNotification } from '@src/shared/ui/notification';
import { useLanguage } from '@src/app/providers/useLanguage';
import { normalizeCurrencyPair } from '@src/shared/lib/currencyPairUtils';
import { convertToUSDSync } from '@src/shared/lib/currency/exchangeRates';
import { validateTrade } from '@src/shared/lib/utils/tradeValidation';
import { getServerTime as getGlobalServerTime } from '@src/shared/lib/serverTime';
import { demoLog } from '@src/entities/demo-trading';
import { addActiveTrade, setCurrentPrice, setCurrentMarketPrice } from '@src/entities/trading/model/slice';
import { selectSelectedBase, selectTradingMode, selectCurrentPrice } from '@src/entities/trading/model/selectors';
import { tradePlacementService } from '../services/tradePlacementService';

interface UseTradingOperationsProps {
  wsSendMessage: ((message: any) => void) | null;
  manualTradeAmountRef: React.MutableRefObject<string>;
  expirationSecondsRef: React.MutableRefObject<string>;
  timeframe: string;
  userProfile?: {
    id?: number;
    currency?: string;
    balance?: number;
    demo_balance?: number;
  } | null;
  balance?: number;
  getPriceFromChart?: (() => number | null) | null;
  chartHandleRef?: React.MutableRefObject<{ addBetMarker?: (time: number, price: number, direction: 'buy' | 'sell', expirationTime?: number, tradeId?: string, amount?: number) => void } | null> | React.RefObject<{ addBetMarker?: (time: number, price: number, direction: 'buy' | 'sell', expirationTime?: number, tradeId?: string, amount?: number) => void } | null>;
  getCurrencyInfo?: ((baseCurrency: string) => { id?: number; base_currency?: string; quote_currency?: string } | undefined) | null;
}

export const useTradingOperations = ({
  wsSendMessage,
  manualTradeAmountRef,
  expirationSecondsRef,
  timeframe,
  userProfile,
  balance,
  getPriceFromChart,
  chartHandleRef,
  getCurrencyInfo,
}: UseTradingOperationsProps) => {
  const { t } = useLanguage();
  const { showError } = useNotification();
  const dispatch = useAppDispatch();
  const selectedBase = useAppSelector(selectSelectedBase);
  const tradingMode = useAppSelector(selectTradingMode);
  const currentPrice = useAppSelector(selectCurrentPrice);
  
  const tradingModeRef = useRef(tradingMode);
  const selectedBaseRef = useRef(selectedBase);
  
  useEffect(() => {
    tradingModeRef.current = tradingMode;
  }, [tradingMode]);
  
  useEffect(() => {
    selectedBaseRef.current = selectedBase;
  }, [selectedBase]);
  
  const getServerTime = useCallback(() => getGlobalServerTime(), []);

  const handleManualTrade = useCallback((direction: 'buy' | 'sell') => {
    console.log('[MANUAL_TRADE] ========== НАЧАЛО ОБРАБОТКИ ОБЫЧНОЙ СТАВКИ ==========');
    const currentTradingMode = tradingModeRef.current;
    const currentSelectedBase = selectedBaseRef.current;
    
    console.log('[MANUAL_TRADE] Начальные параметры:', {
      direction,
      tradingMode: currentTradingMode,
      selectedBase: currentSelectedBase,
      amount: manualTradeAmountRef.current,
      expirationSeconds: expirationSecondsRef.current,
    });
    
    if (currentTradingMode === 'demo') {
      demoLog('TradingTerminal.handleManualTrade() demo mode', {
        direction,
        tradingMode: currentTradingMode,
        selectedBase: currentSelectedBase,
        amount: manualTradeAmountRef.current,
        balanceProp: balance,
        demoBalance: userProfile?.demo_balance,
      });
    }

    const amountInUserCurrency = parseFloat(manualTradeAmountRef.current || '0');
    const userCurrency = userProfile?.currency || 'USD';
    const amount = userCurrency === 'USD' 
      ? amountInUserCurrency 
      : convertToUSDSync(amountInUserCurrency, userCurrency);
    
    console.log('[MANUAL_TRADE] Обработка суммы:', {
      amountInUserCurrency,
      userCurrency,
      amountInUSD: amount,
    });
    
    const currentBalance = currentTradingMode === 'demo' 
      ? (userProfile?.demo_balance ?? 0)
      : (balance ?? userProfile?.balance ?? 0);
    
    console.log('[MANUAL_TRADE] Баланс:', {
      tradingMode: currentTradingMode,
      demoBalance: userProfile?.demo_balance,
      realBalance: userProfile?.balance,
      balanceProp: balance,
      currentBalance,
    });
    
    const expirationSec = parseInt(expirationSecondsRef.current || '30');
    
    console.log('[MANUAL_TRADE] Время экспирации:', {
      expirationSecondsRef: expirationSecondsRef.current,
      expirationSeconds: expirationSec,
    });
    
    console.log('[MANUAL_TRADE] handleManualTrade вызван', {
      direction,
      currentTradingMode,
      currentSelectedBase,
      currentPrice,
      hasGetPriceFromChart: !!getPriceFromChart,
      timestamp: Date.now()
    });
    
    // ВСЕГДА получаем актуальную цену из графика, а не из Redux
    // Redux может содержать устаревшую цену
    let price = 0;
    let priceSource = 'none';
    
    console.log('[TRADE_PLACEMENT] Получение актуальной цены из графика', {
      currentPriceFromRedux: currentPrice,
      hasGetPriceFromChart: !!getPriceFromChart
    });
    
    // Приоритет: всегда получаем цену из графика (актуальная цена)
    if (getPriceFromChart) {
      try {
        const chartPrice = getPriceFromChart();
        console.log('[TRADE_PLACEMENT] Результат getPriceFromChart', {
          chartPrice,
          isValid: chartPrice && chartPrice > 0 && Number.isFinite(chartPrice)
        });
        
        if (chartPrice && chartPrice > 0 && Number.isFinite(chartPrice)) {
          price = chartPrice;
          priceSource = 'Chart (getAnimatedPrice/loadedCandles)';
          
          // ВАЖНО: НЕ обновляем currentMarketPrice при создании ставки!
          // currentMarketPrice должна обновляться ТОЛЬКО из WebSocket сообщений (custom_quote),
          // чтобы она всегда была актуальной рыночной ценой, а не ценой входа в ставку
          // Обновляем только currentPrice (для других целей), но НЕ currentMarketPrice
          startTransition(() => {
            dispatch(setCurrentPrice(chartPrice));
            // НЕ обновляем currentMarketPrice здесь - она обновляется только из WebSocket!
          });
          
          console.log('[TRADE_PLACEMENT] ✅ Цена получена из графика (НЕ обновляем currentMarketPrice - она обновляется только из WebSocket)', {
            chartPrice,
            currentPriceFromRedux: currentPrice,
            price,
            source: priceSource,
            note: 'currentMarketPrice обновляется только из WebSocket custom_quote сообщений'
          });
        } else {
          console.log('[TRADE_PLACEMENT] ⚠️ getPriceFromChart вернул невалидную цену, используем Redux как fallback', {
            chartPrice,
            type: typeof chartPrice,
            currentPriceFromRedux: currentPrice
          });
          // Fallback: используем цену из Redux, если график не вернул цену
          if (currentPrice && currentPrice > 0) {
            price = currentPrice;
            priceSource = 'Redux (fallback)';
          }
        }
      } catch (error) {
        console.error('[TRADE_PLACEMENT] ❌ Ошибка получения цены из графика, используем Redux как fallback', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          currentPriceFromRedux: currentPrice
        });
        // Fallback: используем цену из Redux при ошибке
        if (currentPrice && currentPrice > 0) {
          price = currentPrice;
          priceSource = 'Redux (fallback after error)';
        }
      }
    } else {
      // Если getPriceFromChart недоступен, используем Redux
      console.log('[TRADE_PLACEMENT] getPriceFromChart не передан, используем Redux');
      if (currentPrice && currentPrice > 0) {
        price = currentPrice;
        priceSource = 'Redux (getPriceFromChart unavailable)';
      }
    }
    
    // Проверяем, что цена доступна
    if (!price || price <= 0) {
      console.log('[MANUAL_TRADE] ❌ Цена все еще недоступна, собираем диагностическую информацию');
      
      let chartPrice: number | null = null;
      if (getPriceFromChart) {
        try {
          console.log('[MANUAL_TRADE] Повторный вызов getPriceFromChart для диагностики');
          chartPrice = getPriceFromChart();
          console.log('[MANUAL_TRADE] Повторный результат getPriceFromChart', {
            chartPrice,
            type: typeof chartPrice
          });
        } catch (error) {
          console.error('[MANUAL_TRADE] ❌ Ошибка при повторном получении цены из графика', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
          });
          chartPrice = null;
        }
      }
      
      console.error('[MANUAL_TRADE] ========== ОШИБКА: ЦЕНА НЕДОСТУПНА ==========');
      showError(t('trading.priceNotAvailable') || 'Цена недоступна. Дождитесь загрузки графика.');
      return;
    }
    console.log('[MANUAL_TRADE] ✅ Цена получена:', { price, priceSource });
    
    console.log('[MANUAL_TRADE] Запуск валидации сделки...');
    const validation = validateTrade({
      amount,
      amountInUserCurrency,
      userCurrency,
      balance: currentBalance,
      expirationSeconds: expirationSec,
      price,
      tradingMode: currentTradingMode,
    });
    console.log('[MANUAL_TRADE] Результат валидации:', { valid: validation.valid, error: validation.error, errorParams: validation.errorParams });

    if (!validation.valid) {
      if (validation.error) {
        const errorMessage = validation.errorParams 
          ? t(validation.error, validation.errorParams)
          : t(validation.error);
        console.error('[MANUAL_TRADE] ❌ Валидация не прошла:', errorMessage);
        showError(errorMessage);
      }
      return;
    }
    console.log('[MANUAL_TRADE] ✅ Валидация прошла успешно');

    // Получаем ID валюты из currencyInfo
    if (!getCurrencyInfo) {
      console.error('[MANUAL_TRADE] ❌ getCurrencyInfo не доступен');
      showError(t('trading.errorCreatingTrade') || 'Информация о валюте недоступна');
      return;
    }

    const currencyInfo = getCurrencyInfo(selectedBaseRef.current);
    if (!currencyInfo || !currencyInfo.id) {
      console.error('[MANUAL_TRADE] ❌ Не удалось получить ID валюты', {
        selectedBase: selectedBaseRef.current,
        currencyInfo
      });
      showError(t('trading.errorCreatingTrade') || 'Не удалось получить информацию о валюте');
      return;
    }

    const currencyId = currencyInfo.id;
    const now = Math.floor(getServerTime());
    const tradeTimestamp = now;

    const currentMode = tradingModeRef.current;
    
    console.log('[MANUAL_TRADE] Параметры сделки:', {
      id: currencyId,
      selectedBase: selectedBaseRef.current,
      direction,
      amount,
      price,
      expirationSeconds: expirationSec,
      mode: currentMode,
      timeframe,
      tradeTimestamp,
    });
    
    // Используем новый сервис для создания ставки
    // Маркер и активный трейд будут созданы ТОЛЬКО после подтверждения от сервера
    if (!wsSendMessage) {
      console.error('[MANUAL_TRADE] ❌ WebSocket не подключен');
      showError(t('trading.errorCreatingTrade') || 'WebSocket не подключен');
      return;
    }
    console.log('[MANUAL_TRADE] ✅ WebSocket подключен');

    try {
      const params = {
        id: currencyId,
        direction,
        amount,
        price,
        expirationSeconds: expirationSec,
        mode: currentMode as 'manual' | 'demo',
        timeframe,
        trade_timestamp: tradeTimestamp,
      };

      console.log('[MANUAL_TRADE] ========== ОТПРАВКА ЗАПРОСА НА СОЗДАНИЕ СДЕЛКИ ==========');
      console.log('[MANUAL_TRADE] Финальные параметры сделки:', params);
      
      // Отправляем запрос через сервис
      // Маркер и трейд будут созданы только после успешного ответа от сервера
      console.log('[MANUAL_TRADE] Вызов tradePlacementService.placeTrade...');
      tradePlacementService.placeTrade(
        params,
        wsSendMessage,
        // Callback успеха - создаем маркер и активный трейд
        (result) => {
          console.log('[MANUAL_TRADE] ========== CALLBACK УСПЕХА ==========');
          console.log('[MANUAL_TRADE] ✅ Callback успеха вызван', {
            hasResult: !!result,
            resultSuccess: result?.success,
            hasTrade: !!result?.trade,
            tradeId: result?.tradeId,
            result: result
          });
          
          try {
            if (result && result.success && result.trade) {
              console.log('[MANUAL_TRADE] Условие выполнено, добавляем трейд и маркер', {
                trade: result.trade
              });
              
              // Добавляем активный трейд (добавляем к существующим, не заменяем)
              console.log('[MANUAL_TRADE] ✅ Сделка успешно создана, добавляем в Redux:', result.trade);
              dispatch(addActiveTrade(result.trade));
              console.log('[MANUAL_TRADE] ========== СДЕЛКА УСПЕШНО СОЗДАНА ==========');
              
              // Создаем маркер ставки на графике
              console.log('[TRADE_PLACEMENT] Попытка создать маркер ставки', {
                hasChartHandleRef: !!chartHandleRef,
                hasCurrent: !!chartHandleRef?.current,
                hasAddBetMarker: !!chartHandleRef?.current?.addBetMarker,
                entryPrice: result.trade.entryPrice,
                createdAt: result.trade.createdAt,
                direction: result.trade.direction,
                trade: result.trade
              });
              
              if (chartHandleRef?.current?.addBetMarker) {
                if (result.trade.entryPrice && result.trade.createdAt) {
                  try {
                    // ВАЖНО: Используем entryPrice (цена ставки) для позиционирования, amount (сумма ставки) для отображения
                    console.log('[TRADE_PLACEMENT] 📊 Данные для создания маркера', {
                      time: result.trade.createdAt,
                      entryPrice: result.trade.entryPrice,
                      amount: result.trade.amount,
                      hasAmount: result.trade.amount !== undefined && result.trade.amount !== null,
                      direction: result.trade.direction,
                      tradeId: result.trade.id,
                      trade: result.trade
                    });
                    
                    chartHandleRef.current.addBetMarker(
                      result.trade.createdAt,
                      result.trade.entryPrice, // Цена ставки для позиционирования на графике
                      result.trade.direction,
                      result.trade.expirationTime,
                      result.trade.id,
                      result.trade.amount // Сумма ставки для отображения на метке
                    );
                    
                    console.log('[TRADE_PLACEMENT] ✅ Маркер ставки создан', {
                      time: result.trade.createdAt,
                      price: result.trade.entryPrice,
                      amount: result.trade.amount,
                      direction: result.trade.direction,
                      tradeId: result.trade.id
                    });
                  } catch (error) {
                    console.error('[TRADE_PLACEMENT] ❌ Ошибка создания маркера ставки', error);
                  }
                } else {
                  console.warn('[TRADE_PLACEMENT] ⚠️ Недостаточно данных для создания маркера', {
                    hasEntryPrice: !!result.trade.entryPrice,
                    hasCreatedAt: !!result.trade.createdAt
                  });
                }
              } else {
                console.warn('[TRADE_PLACEMENT] ⚠️ Метод addBetMarker недоступен', {
                  hasChartHandleRef: !!chartHandleRef,
                  hasCurrent: !!chartHandleRef?.current,
                  hasAddBetMarker: !!chartHandleRef?.current?.addBetMarker
                });
              }
            } else {
              console.error('[MANUAL_TRADE] ❌ Сделка не создана, результат невалиден:', result);
              showError(t('trading.errorCreatingTrade') || 'Ошибка создания ставки');
            }
          } catch (error: any) {
            console.error('[MANUAL_TRADE] ========== ИСКЛЮЧЕНИЕ В CALLBACK УСПЕХА ==========');
            console.error('[MANUAL_TRADE] Исключение:', {
              message: error.message,
              error,
              stack: error.stack,
            });
            showError(error.message || t('trading.errorCreatingTrade') || 'Ошибка создания ставки');
          }
        },
        // Callback ошибки
        (errorMessage) => {
          console.error('[MANUAL_TRADE] ========== CALLBACK ОШИБКИ ==========');
          console.error('[MANUAL_TRADE] Ошибка создания сделки:', errorMessage);
          showError(errorMessage);
        }
      );
      console.log('[MANUAL_TRADE] Запрос отправлен, ожидаем ответ...');

    } catch (error: any) {
      console.error('[MANUAL_TRADE] ========== ИСКЛЮЧЕНИЕ ПРИ СОЗДАНИИ СДЕЛКИ ==========');
      console.error('[MANUAL_TRADE] Исключение:', {
        message: error.message,
        error,
        stack: error.stack,
      });
      showError(error.message || t('trading.errorCreatingTrade') || 'Ошибка создания ставки');
    }
  }, [
    wsSendMessage,
    manualTradeAmountRef,
    expirationSecondsRef,
    timeframe,
    userProfile,
    balance,
    currentPrice,
    dispatch,
    t,
    showError,
    getServerTime,
    getPriceFromChart,
    getCurrencyInfo,
  ]);

  return {
    handleManualTrade,
    tradingModeRef,
    selectedBaseRef,
  };
};

