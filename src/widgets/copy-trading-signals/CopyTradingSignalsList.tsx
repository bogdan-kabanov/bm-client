import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useLanguage } from '@src/app/providers/useLanguage';
import { apiClient } from '@src/shared/api/client';
import { useNotification } from '@src/shared/ui/notification/NotificationProvider';
import { useAnimatedNumber } from '@src/shared/hooks/useAnimatedNumber';
import { Flipper, Flipped } from 'react-flip-toolkit';
import { getServerTime } from '@src/shared/lib/serverTime';
import { normalizeCurrencyPair } from '@src/shared/lib/currencyPairUtils';
import { useAppSelector, useAppDispatch } from '@src/shared/lib/hooks';
import { selectCurrentPrice, selectTradingMode, selectSelectedBase } from '@src/entities/trading/model/selectors';
import { selectProfile } from '@src/entities/user/model/selectors';
import { useWebSocket } from '@src/entities/websoket/useWebSocket';
import { convertToUSDSync } from '@src/shared/lib/currency/exchangeRates';
import { validateTrade } from '@src/shared/lib/utils/tradeValidation';
import { tradePlacementService } from '@src/features/trading-terminal/services/tradePlacementService';
import { addActiveTrade } from '@src/entities/trading/model/slice';
import { useCurrencyData } from '@src/features/trading-terminal/hooks/useCurrencyData';
import arrowUpIcon from '@src/assets/icons/arrow-up.svg';
import arrowDownIcon from '@src/assets/icons/arrow-down.svg';
import './CopyTradingSignalsList.css';

interface Signal {
  id: string;
  pair: string;
  value: number;
  copied: number;
  direction: 'up' | 'down';
  profit: number;
  timer: string;
  timestamp: string;
  expires_at?: string;
  created_at_unix?: number; // Unix timestamp начала сигнала
  expires_at_unix?: number; // Unix timestamp окончания сигнала
  expiration_seconds?: number;
  remaining_seconds?: number;
  can_copy?: boolean;
  user_id?: number;
  username?: string;
  is_subscribed?: boolean; // Подписан ли текущий пользователь на автора сигнала
}

// Функция для извлечения базовой валюты из пары
const deriveBaseFromPair = (pair: string): string | null => {
  if (!pair) return null;
  const upper = String(pair).trim().toUpperCase();
  if (!upper) return null;

  const separators = ['/', '_', '-', ':'];
  for (const separator of separators) {
    if (upper.includes(separator)) {
      const [base] = upper.split(separator);
      return base ? base.trim() : null;
    }
  }
  return null;
};

// Функция для расчета прибыли от ставки
const calculateProfitFromInvestment = (investmentAmount: number, profitPercentage: number = 80): number => {
  if (investmentAmount <= 0) return 0;
  return (profitPercentage / 100) * investmentAmount;
};

const SignalItem = React.memo<{
  signal: Signal;
  canCopy: boolean;
  investmentAmount: number;
  progress: number;
  onCopy: (signalId: string) => void;
  onSubscribe?: (userId: number | undefined, signalId: string) => void;
  animatedCopied: number;
  isActive: boolean;
  timer: string;
  getCurrencyInfo?: (baseCurrency: string) => any;
  t: (key: string, params?: any) => string;
}>(({ signal, canCopy, investmentAmount, progress, onCopy, onSubscribe, animatedCopied, isActive, timer, getCurrencyInfo, t }) => {
  // Извлекаем базовую валюту из пары
  const baseCurrency = useMemo(() => {
    return deriveBaseFromPair(signal.pair);
  }, [signal.pair]);

  // Получаем информацию о валюте
  const currencyInfo = useMemo(() => {
    if (!getCurrencyInfo || !baseCurrency) return null;
    return getCurrencyInfo(baseCurrency);
  }, [getCurrencyInfo, baseCurrency]);

  // Получаем процент прибыли из информации о валюте
  const profitPercentage = useMemo(() => {
    if (currencyInfo && currencyInfo.profit_percentage !== null && currencyInfo.profit_percentage !== undefined) {
      const profitValue = typeof currencyInfo.profit_percentage === 'number' 
        ? currencyInfo.profit_percentage 
        : Number(currencyInfo.profit_percentage);
      if (Number.isFinite(profitValue) && profitValue > 0) {
        return profitValue;
      }
    }
    // Используем стандартный процент 80% если нет информации о валюте
    return 80;
  }, [currencyInfo]);

  // Рассчитываем прибыль от ставки
  const profitFromInvestment = calculateProfitFromInvestment(investmentAmount, profitPercentage);
  
  return (
    <Flipped flipId={signal.id}>
      <div 
        className={`signal-item ${!canCopy ? 'signal-item-disabled' : ''} ${!isActive ? 'signal-item-inactive' : ''}`}
      >
      <div className="signal-left">
        <div className="signal-pair">{signal.pair}</div>
        <div className="signal-timer">{timer}</div>
        <div className="signal-progress-wrapper">
          <div className="signal-progress">
            <div className="signal-progress-bar" style={{ width: `${progress}%` }}></div>
          </div>
          {signal.user_id && onSubscribe && (
            <button
              className={`signal-subscribe-btn ${signal.is_subscribed ? 'subscribed' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                if (onSubscribe) {
                  onSubscribe(signal.user_id, signal.id);
                }
              }}
              title={signal.is_subscribed ? t('copyTrading.unsubscribeFromUserSignals') : t('copyTrading.subscribeToUserSignals')}
            >
              {signal.is_subscribed ? t('copyTrading.subscribed') : t('copyTrading.subscribe')}
            </button>
          )}
        </div>
      </div>
      <div className="signal-right">
        <div className="signal-right-top">
          <button
            className="signal-copy-btn"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (canCopy && onCopy) {
                onCopy(signal.id);
              }
            }}
            type="button"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4.66653 3.99998V1.99998C4.66653 1.63179 4.96501 1.33331 5.3332 1.33331H13.3332C13.7014 1.33331 13.9999 1.63179 13.9999 1.99998V11.3333C13.9999 11.7015 13.7014 12 13.3332 12H11.3332V13.9994C11.3332 14.3679 11.0333 14.6666 10.662 14.6666H2.67111C2.30039 14.6666 2 14.3702 2 13.9994L2.00173 4.66723C2.0018 4.29872 2.30176 3.99998 2.67295 3.99998H4.66653ZM3.33495 5.33331L3.33346 13.3333H9.99987V5.33331H3.33495ZM5.99987 3.99998H11.3332V10.6666H12.6665V2.66665H5.99987V3.99998Z" fill="#F9F9F9"/>
            </svg>
            <span>{t('copyTrading.copySignal')}</span>
          </button>
        </div>
        <div className="signal-right-bottom">
          <div className="signal-copied">{t('copyTrading.copiedTimes', { count: Math.floor(animatedCopied) })}</div>
          <div className={`signal-direction ${signal.direction}`}>
            <img 
              src={signal.direction === 'up' ? arrowUpIcon : arrowDownIcon}
              alt={signal.direction === 'up' ? 'up' : 'down'}
              className={`signal-arrow ${signal.direction === 'up' ? 'arrow-up' : 'arrow-down'}`}
              width="16"
              height="16"
            />
          </div>
          <div className="signal-profit positive">
            +${profitFromInvestment.toFixed(2)}
          </div>
        </div>
      </div>
      </div>
    </Flipped>
  );
});

SignalItem.displayName = 'SignalItem';

// Компонент-обертка для анимации значения copied
const SignalItemWithAnimation = React.memo<{
  signal: Signal;
  canCopy: boolean;
  investmentAmount: number;
  progress: number;
  onCopy: (signalId: string) => void;
  onSubscribe?: (userId: number | undefined, signalId: string) => void;
  currentCopied: number;
  isActive: boolean;
  timer: string;
  getCurrencyInfo?: (baseCurrency: string) => any;
  t: (key: string, params?: any) => string;
}>(({ signal, canCopy, investmentAmount, progress, onCopy, onSubscribe, currentCopied, isActive, timer, getCurrencyInfo, t }) => {
  const animatedCopied = useAnimatedNumber(currentCopied, 1000);
  const animatedCopiedNum = typeof animatedCopied === 'string' ? parseFloat(animatedCopied) : animatedCopied;
  
  return (
    <SignalItem
      signal={signal}
      canCopy={canCopy}
      investmentAmount={investmentAmount}
      progress={progress}
      onCopy={onCopy}
      onSubscribe={onSubscribe}
      animatedCopied={animatedCopiedNum}
      isActive={isActive}
      timer={timer}
      getCurrencyInfo={getCurrencyInfo}
      t={t}
    />
  );
}, (prevProps, nextProps) => {
  // Оптимизация: перерендериваем только если изменились важные пропсы
  return (
    prevProps.signal.id === nextProps.signal.id &&
    prevProps.timer === nextProps.timer &&
    prevProps.currentCopied === nextProps.currentCopied &&
    prevProps.isActive === nextProps.isActive &&
    prevProps.canCopy === nextProps.canCopy &&
    prevProps.progress === nextProps.progress &&
    prevProps.investmentAmount === nextProps.investmentAmount
  );
});

SignalItemWithAnimation.displayName = 'SignalItemWithAnimation';

interface CopyTradingSignalsListProps {
  investmentAmount?: number;
  onOpenAddSignalModal?: () => void;
  selectedBase?: string;
}

export const CopyTradingSignalsList: React.FC<CopyTradingSignalsListProps> = ({ 
  investmentAmount = 0,
  onOpenAddSignalModal,
  selectedBase
}) => {
  const { t } = useLanguage();
  const { showError } = useNotification();
  const dispatch = useAppDispatch();
  const currentPrice = useAppSelector(selectCurrentPrice);
  const tradingMode = useAppSelector(selectTradingMode);
  const selectedBaseFromStore = useAppSelector(selectSelectedBase);
  const userProfile = useAppSelector(selectProfile);
  const { sendMessage } = useWebSocket();
  const [signals, setSignals] = useState<Signal[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInfoVisible, setIsInfoVisible] = useState(false);
  const infoRef = useRef<HTMLDivElement>(null);
  
  // Храним локальные изменения copied (увеличения при копировании)
  // Ключ - signalId, значение - дополнительное количество скопированных
  const [localCopiedIncrements, setLocalCopiedIncrements] = useState<Record<string, number>>({});
  
  // Время сервера для плавного обновления таймеров (в секундах, unix timestamp)
  const [currentTime, setCurrentTime] = useState(() => Math.floor(getServerTime() / 1000));
  
  // Используем selectedBase из пропсов или из store
  const effectiveSelectedBase = selectedBase || selectedBaseFromStore;
  
  // Получаем данные о валютах для расчета процента прибыли
  const { getCurrencyInfo } = useCurrencyData(effectiveSelectedBase || 'BTC');

  useEffect(() => {
    let isMounted = true;
    let retryCount = 0;
    const MAX_RETRIES = 3;
    let hasLoadedOnce = false;

    const fetchSignals = async () => {
      if (!isMounted) return;
      
      if (!hasLoadedOnce) {
        setIsLoading(true);
      }
      
      try {
        // Если выбрана валютная пара, передаем currencyId в запросе
        let url = '/copy-trading/signals';
        if (selectedBase && getCurrencyInfo) {
          const currencyInfo = getCurrencyInfo(selectedBase);
          if (currencyInfo && currencyInfo.id) {
            url = `/copy-trading/signals?currencyId=${currencyInfo.id}`;
          }
        }
        
        const response = await apiClient<Signal[]>(url);
        
        if (!isMounted) return;
        
        if (Array.isArray(response)) {
          // Используем сигналы в том порядке, в котором они приходят с сервера
          // Это гарантирует одинаковый порядок у всех пользователей
          // Обновляем список, сохраняя существующие элементы для плавного обновления прогресс-баров
          setSignals(prevSignals => {
            // Создаем карту существующих сигналов для быстрого поиска
            const existingSignalsMap = new Map(prevSignals.map(s => [s.id, s]));
            // Обновляем только данные существующих сигналов, новые добавляем как есть
            return response.map(newSignal => {
              const existingSignal = existingSignalsMap.get(newSignal.id);
              // Если сигнал уже существует, сохраняем его данные для плавного обновления
              // Это помогает избежать "сброса" прогресс-баров
              if (existingSignal) {
                return {
                  ...newSignal,
                  // Сохраняем timestamp если он не изменился значительно
                  timestamp: existingSignal.timestamp || newSignal.timestamp,
                };
              }
              return newSignal;
            });
          });
          retryCount = 0;
          hasLoadedOnce = true;
        } else {
          setSignals([]);
        }
      } catch (error: any) {
        if (!isMounted) return;
        
        retryCount++;
        if (retryCount < MAX_RETRIES) {
          console.warn(`Error loading signals (attempt ${retryCount}/${MAX_RETRIES}):`, error.message || error);
        } else if (retryCount === MAX_RETRIES) {
          console.error('Failed to load signals after several attempts');
        }
        
        if (!hasLoadedOnce) {
          setSignals([]);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchSignals();
    const interval = setInterval(fetchSignals, 10000);
    
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [selectedBase, getCurrencyInfo]);

  // Обновляем время сервера каждую секунду для плавного таймера
  useEffect(() => {
    const timerInterval = setInterval(() => {
      setCurrentTime(Math.floor(getServerTime() / 1000)); // Unix timestamp в секундах
    }, 1000);
    
    return () => {
      clearInterval(timerInterval);
    };
  }, []);

  // Вычисляем таймер на основе unix timestamp
  const getTimer = useCallback((signal: Signal): string => {
    const expiresAt = signal.expires_at_unix;
    if (!expiresAt) {
      // Fallback на expires_at если unix нет
      if (signal.expires_at) {
        const expiresAtMs = new Date(signal.expires_at).getTime();
        const serverTimeMs = getServerTime();
        const remaining = Math.floor((expiresAtMs - serverTimeMs) / 1000);
        if (remaining <= 0) return '00:00';
        const minutes = Math.floor(remaining / 60);
        const seconds = remaining % 60;
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      }
      return signal.timer || '00:00';
    }
    
    const remaining = expiresAt - currentTime;
    if (remaining <= 0) return '00:00';
    
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }, [currentTime]);

  // Фильтруем только активные сигналы (сервер сам управляет удалением истекших)
  // Используем сигналы в том порядке, в котором они приходят с сервера

  // Вычисляем прогресс от 0% до 100% на основе unix timestamp
  const calculateProgress = useCallback((signal: Signal): number => {
    const created_at = signal.created_at_unix;
    const expires_at = signal.expires_at_unix;
    
    if (!created_at || !expires_at) {
      // Fallback на timestamp/expires_at если unix нет
      if (!signal.expires_at || !signal.timestamp) {
        return 0;
      }
      const expires_at_ms = new Date(signal.expires_at).getTime();
      const created_at_ms = new Date(signal.timestamp).getTime();
      const now = getServerTime();
      
      if (expires_at_ms <= now) return 100;
      if (created_at_ms > now) return 0;
      
      const total_duration = expires_at_ms - created_at_ms;
      const elapsed = now - created_at_ms;
      
      if (total_duration <= 0) return 0;
      return Math.min(100, Math.max(0, (elapsed / total_duration) * 100));
    }
    
    // Используем unix timestamp в секундах
    const now = currentTime;
    
    if (expires_at <= now) {
      return 100; // Сигнал истек
    }
    
    if (created_at > now) {
      return 0; // Сигнал еще не начался
    }
    
    const total_duration = expires_at - created_at;
    const elapsed = now - created_at;
    
    if (total_duration <= 0) {
      return 0;
    }
    
    // Прогресс от 0% до 100% от начала до окончания
    return Math.min(100, Math.max(0, (elapsed / total_duration) * 100));
  }, [currentTime]);

  // Вычисляем оставшееся время в секундах для сигнала
  const getRemainingSeconds = useCallback((signal: Signal): number => {
    const expiresAt = signal.expires_at_unix;
    
    if (expiresAt) {
      const remaining = expiresAt - currentTime;
      return Math.max(0, remaining);
    }
    
    // Fallback на expires_at если unix нет
    if (!signal.expires_at) {
      return 0;
    }
    
    const expiresAtMs = new Date(signal.expires_at).getTime();
    const now = getServerTime();
    const remaining = expiresAtMs - now;
    return Math.max(0, Math.floor(remaining / 1000));
  }, [currentTime]);

  // Вычисляем анимированное значение copied:
  // - Если осталось >= 30 секунд: начинаем с 0 и постепенно увеличиваем до реального значения
  // - Если осталось < 30 секунд: показываем реальное значение
  const getCurrentCopied = useCallback((signal: Signal): number => {
    const remainingSeconds = getRemainingSeconds(signal);
    // Добавляем локальные изменения к значению с сервера
    const localIncrement = localCopiedIncrements[signal.id] || 0;
    const realCopied = (signal.copied || 0) + localIncrement;
    
    // Если осталось меньше 30 секунд, показываем реальное значение
    if (remainingSeconds < 30) {
      return realCopied;
    }
    
    // Если осталось >= 30 секунд, вычисляем прогрессивное значение
    // Нужно знать общее время жизни сигнала для расчета прогресса
    const created_at = signal.created_at_unix;
    const expires_at = signal.expires_at_unix;
    
    if (!created_at || !expires_at) {
      // Fallback: если нет unix timestamp, используем expiration_seconds
      if (signal.expiration_seconds) {
        const total_duration = signal.expiration_seconds;
        const elapsed = total_duration - remainingSeconds;
        // Прогресс от 0 до 1 (0% до 100%)
        const linear_progress = Math.min(1, Math.max(0, elapsed / Math.max(1, total_duration - 30)));
        // Используем квадратичную функцию для более медленного роста
        const smooth_progress = Math.pow(linear_progress, 2.5);
        return Math.floor(realCopied * smooth_progress);
      }
      // Если нет данных, возвращаем 0
      return 0;
    }
    
    // Вычисляем общую длительность сигнала
    const total_duration = expires_at - created_at;
    if (total_duration <= 0) {
      return 0;
    }
    
    // Вычисляем, сколько времени прошло с момента создания
    const elapsed = total_duration - remainingSeconds;
    
    // Вычисляем прогресс от 0 до момента, когда останется 30 секунд
    // То есть прогресс от 0% до момента (total_duration - 30) секунд
    const maxElapsedForAnimation = Math.max(1, total_duration - 30);
    const linearProgress = Math.min(1, Math.max(0, elapsed / maxElapsedForAnimation));
    
    // Используем квадратичную функцию для более медленного роста
    // Степень 2.5 дает медленный рост в начале и ускорение ближе к концу
    const smoothProgress = Math.pow(linearProgress, 2.5);
    
    // Возвращаем значение от 0 до realCopied в зависимости от прогресса
    return Math.floor(realCopied * smoothProgress);
  }, [getRemainingSeconds, localCopiedIncrements]);

  // Проверка, является ли сигнал активным (>= 30 секунд осталось)
  // Используем unix timestamp для вычисления
  const isSignalActive = useCallback((signal: Signal): boolean => {
    const expiresAt = signal.expires_at_unix;
    
    if (expiresAt) {
      const remaining = expiresAt - currentTime;
      return remaining >= 30;
    }
    
    // Fallback на expires_at если unix нет
    if (!signal.expires_at) {
      return false;
    }
    
    const expiresAtMs = new Date(signal.expires_at).getTime();
    const now = getServerTime();
    const remaining = expiresAtMs - now;
    const remainingSeconds = Math.floor(remaining / 1000);
    
    return remainingSeconds >= 30;
  }, [currentTime]);

  const handleCopySignal = useCallback(async (signalId: string) => {
    console.log('[COPY_SIGNAL] 🎯 ========== НАЧАЛО ОБРАБОТКИ КОПИ-СИГНАЛА ==========');
    console.log('[COPY_SIGNAL] 🎯 handleCopySignal вызван', { signalId, signalsCount: signals.length });
    
    const signal = signals.find(s => s.id === signalId);
    if (!signal) {
      console.error('[COPY_SIGNAL] ❌ Signal not found', { signalId, availableIds: signals.map(s => s.id) });
      showError('Signal not found');
      return;
    }
    
    console.log('[COPY_SIGNAL] ✅ Сигнал найден', { signalId, signal });

    // Проверяем, что сигнал активен (>= 30 секунд осталось)
    const isActive = isSignalActive(signal);
    if (!isActive) {
      showError('Not enough time to copy signal (minimum 30 seconds)');
      return;
    }

    // Получаем оставшееся время экспирации из сигнала
    // ВАЖНО: Всегда вычисляем оставшееся время на основе актуального времени сервера на момент клика
    // НЕ используем remaining_seconds, так как это значение может быть устаревшим
    let expirationSeconds: number;
    
    // Получаем актуальное время сервера на момент клика (в секундах, unix timestamp)
    const nowSeconds = Math.floor(getServerTime() / 1000);
    
    // Приоритет 1: вычисляем оставшееся время из unix timestamp используя актуальное время
    // Это самый надежный способ, так как всегда использует текущее время
    if (signal.expires_at_unix) {
      expirationSeconds = signal.expires_at_unix - nowSeconds;
    } 
    // Приоритет 2: вычисляем оставшееся время из expires_at используя актуальное время
    else if (signal.expires_at) {
      const expiresAtMs = new Date(signal.expires_at).getTime();
      const nowMs = getServerTime();
      expirationSeconds = Math.floor((expiresAtMs - nowMs) / 1000);
    } 
    // Приоритет 3: используем remaining_seconds только если нет expires_at_unix и expires_at
    // Но это значение может быть устаревшим, поэтому предпочтительнее использовать вычисление
    else if (signal.remaining_seconds !== undefined && signal.remaining_seconds !== null) {
      expirationSeconds = signal.remaining_seconds;
    } 
    // Fallback: если ничего не доступно, выдаем ошибку
    else {
      showError('Failed to determine signal expiration time');
      return;
    }

    // Проверяем минимальное время экспирации (>= 30 секунд)
    if (expirationSeconds < 30) {
      showError('Signal expiration time must be at least 30 seconds');
      return;
    }

    // Преобразуем направление сигнала: 'up' -> 'buy', 'down' -> 'sell'
    const direction: 'buy' | 'sell' = signal.direction === 'up' ? 'buy' : 'sell';

    // Получаем сумму ставки
    const amountInUserCurrency = investmentAmount || 0;
    if (amountInUserCurrency <= 0) {
      showError('Bet amount must be greater than zero');
      return;
    }

    const userCurrency = userProfile?.currency || 'USD';
    const amount = userCurrency === 'USD' 
      ? amountInUserCurrency 
      : convertToUSDSync(amountInUserCurrency, userCurrency) ?? amountInUserCurrency;

    // Получаем баланс в зависимости от режима торговли
    const currentBalance = tradingMode === 'demo' 
      ? (userProfile?.demo_balance ?? 0)
      : (userProfile?.balance ?? 0);

    // Пытаемся получить цену из Redux, если null - пытаемся получить из графика
    let price = currentPrice || 0;
    
    // Если цена из Redux недоступна, пытаемся получить из графика
    // Используем глобальный объект, если он доступен
    if ((!price || price <= 0) && (window as any).__tradingTerminalGetPriceFromChart) {
      try {
        const chartPrice = (window as any).__tradingTerminalGetPriceFromChart();
        if (chartPrice && chartPrice > 0 && Number.isFinite(chartPrice)) {
          price = chartPrice;
        }
      } catch (error) {
        // Игнорируем ошибку получения цены из графика
      }
    }
    
    // Проверяем, что цена доступна
    if (!price || price <= 0) {
      showError(t('trading.priceNotAvailable') || 'Price is not available. Please wait for the chart to load.');
      return;
    }

    // Валидация сделки
    const validation = validateTrade({
      amount,
      amountInUserCurrency,
      userCurrency,
      balance: currentBalance,
      expirationSeconds,
      price,
      tradingMode: tradingMode as 'manual' | 'demo',
    });

    if (!validation.valid) {
      if (validation.error) {
        const errorMessage = validation.errorParams 
          ? t(validation.error, validation.errorParams)
          : t(validation.error);
        showError(errorMessage);
      }
      return;
    }

    // Извлекаем базовую валюту из сигнала
    // signal.pair может быть в формате "BTC/USDT (OTC)" или "BTC/USDT"
    let baseCurrency: string = '';
    if (signal.pair) {
      // Убираем "(OTC)" и другие суффиксы, разделяем по "/"
      const pairWithoutSuffix = signal.pair.replace(/\s*\([^)]*\)\s*$/, '').trim();
      const parts = pairWithoutSuffix.split('/');
      baseCurrency = parts[0]?.trim().toUpperCase() || '';
    }
    
    // Если не удалось извлечь из сигнала, используем effectiveSelectedBase или fallback
    if (!baseCurrency) {
      baseCurrency = effectiveSelectedBase || 'BTC';
    }

    // Получаем ID валюты из currencyInfo
    if (!getCurrencyInfo) {
      console.error('[COPY_SIGNAL] ❌ getCurrencyInfo is not available');
      showError(t('trading.errorCreatingTrade') || 'Currency information is not available');
      return;
    }

    const currencyInfo = getCurrencyInfo(baseCurrency);
    if (!currencyInfo || !currencyInfo.id) {
      console.error('[COPY_SIGNAL] ❌ Failed to get currency ID', {
        baseCurrency,
        currencyInfo
      });
      showError(t('trading.errorCreatingTrade') || 'Failed to get currency information');
      return;
    }

    // ВАЖНО: Убеждаемся, что ID является числом
    const currencyId = typeof currencyInfo.id === 'number' ? currencyInfo.id : parseInt(String(currencyInfo.id), 10);
    
    if (!currencyId || isNaN(currencyId) || currencyId <= 0) {
      console.error('[COPY_SIGNAL] ❌ Невалидный ID валюты', {
        baseCurrency,
        currencyInfoId: currencyInfo.id,
        currencyId,
        currencyInfoType: typeof currencyInfo.id
      });
      showError(t('trading.errorCreatingTrade') || 'Invalid currency ID');
      return;
    }
    
    const now = Math.floor(getServerTime());
    const tradeTimestamp = now;
    const timeframe = '1m'; // Используем значение по умолчанию

    if (!sendMessage) {
      showError(t('trading.errorCreatingTrade') || 'WebSocket is not connected');
      return;
    }

    try {
      // Преобразуем режим: 'automatic' -> 'manual' (так как валидация не принимает 'automatic')
      // tradingMode может быть 'manual' | 'demo' | 'automatic'
      const tradeMode: 'manual' | 'demo' = (tradingMode as string) === 'automatic' ? 'manual' : (tradingMode as 'manual' | 'demo');
      
      console.log('[COPY_SIGNAL] 📤 Параметры для создания ставки:', {
        currencyId,
        currencyIdType: typeof currencyId,
        baseCurrency,
        direction,
        amount,
        price,
        expirationSeconds,
        mode: tradeMode,
        timeframe,
        trade_timestamp: tradeTimestamp,
        currencyInfo: currencyInfo ? { id: currencyInfo.id, symbol: currencyInfo.symbol } : null
      });
      
      // ВАЖНО: Работаем ТОЛЬКО через ID, не передаем symbol
      // Убеждаемся, что ID передается как число
      const params = {
        id: Number(currencyId), // Явно преобразуем в число
        direction,
        amount,
        price,
        expirationSeconds,
        mode: tradeMode,
        timeframe,
        trade_timestamp: tradeTimestamp,
      };

      console.log('[COPY_SIGNAL] 🚀 Вызов tradePlacementService.placeTrade', {
        params,
        hasSendMessage: !!sendMessage,
        sendMessageType: typeof sendMessage
      });
      
      // Используем сервис для создания ставки
      const requestId = await tradePlacementService.placeTrade(
        params,
        sendMessage,
        // Callback успеха
        (result) => {
          console.log('[COPY_SIGNAL] ✅ Callback успеха вызван', { result });
          if (result && result.success && result.trade) {
            // Добавляем активный трейд
            dispatch(addActiveTrade(result.trade));
            console.log('[COPY_SIGNAL] ✅ Ставка добавлена в Redux', { tradeId: result.trade.id });
            
            // Увеличиваем локальное значение copied для этого сигнала на 1
            setLocalCopiedIncrements(prev => {
              const currentIncrement = prev[signalId] || 0;
              const newIncrement = currentIncrement + 1;
              console.log('[COPY_SIGNAL] 📈 Увеличиваем copied для сигнала', { 
                signalId, 
                currentIncrement,
                newIncrement 
              });
              return {
                ...prev,
                [signalId]: newIncrement
              };
            });
          } else {
            console.error('[COPY_SIGNAL] ❌ Unexpected result format', { result });
            showError(t('trading.errorCreatingTrade') || 'Error creating trade');
          }
        },
        // Callback ошибки
        (errorMessage) => {
          console.error('[COPY_SIGNAL] ❌ Callback ошибки вызван', { errorMessage });
          showError(errorMessage);
        }
      );
      
      console.log('[COPY_SIGNAL] ✅ tradePlacementService.placeTrade called, requestId:', requestId);
    } catch (error: any) {
      showError(error.message || t('trading.errorCreatingTrade') || 'Error creating trade');
    }
  }, [signals, isSignalActive, investmentAmount, userProfile, tradingMode, currentPrice, effectiveSelectedBase, sendMessage, dispatch, t, showError, currentTime, getCurrencyInfo]);

  // Сортируем сигналы:
  // - Сигналы с remaining_seconds >= 30: новые сверху (по timestamp)
  // - Сигналы с remaining_seconds < 30: внизу списка (также по timestamp)
  const sortedSignals = useMemo(() => {
    return [...signals].sort((a, b) => {
      const aRemaining = getRemainingSeconds(a);
      const bRemaining = getRemainingSeconds(b);
      
      const aIsActive = aRemaining >= 30;
      const bIsActive = bRemaining >= 30;
      
      // Если один активный (>= 30 сек), а другой нет (< 30 сек)
      // Активный всегда идет выше
      if (aIsActive && !bIsActive) {
        return -1; // a идет выше
      }
      if (!aIsActive && bIsActive) {
        return 1; // b идет выше
      }
      
      // Если оба в одной категории (оба активные или оба неактивные)
      // Сортируем по timestamp: новые (более поздние) первыми
      const aTime = new Date(a.timestamp).getTime();
      const bTime = new Date(b.timestamp).getTime();
      
      // Если timestamp одинаковый, используем ID для стабильности
      if (aTime === bTime) {
        if (a.id < b.id) return -1;
        if (a.id > b.id) return 1;
        return 0;
      }
      
      return bTime - aTime; // Новые первыми
    });
  }, [signals, getRemainingSeconds]);

  // Создаем уникальный ключ для Flipper на основе порядка сигналов с сервера
  const flipKey = useMemo(() => {
    return sortedSignals.map(s => s.id).join(',');
  }, [sortedSignals]);

  // Закрытие информационного окна при клике вне его
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (infoRef.current && !infoRef.current.contains(event.target as Node)) {
        setIsInfoVisible(false);
      }
    };

    if (isInfoVisible) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isInfoVisible]);

  const handleAddSignalClick = useCallback(() => {
    if (onOpenAddSignalModal) {
      onOpenAddSignalModal();
    }
  }, [onOpenAddSignalModal]);

  // Функция подписки на сигналы пользователя
  const handleSubscribeToUser = useCallback(async (userId: number | undefined, signalId: string) => {
    if (!userId) {
      showError('Failed to determine user');
      return;
    }

    try {
      await apiClient(`/copy-trading/signals/${signalId}/subscribe`, {
        method: 'POST',
        body: { user_id: userId },
      });
      
      // Обновляем список сигналов с учетом текущей валютной пары
      let url = '/copy-trading/signals';
      if (selectedBase && getCurrencyInfo) {
        const currencyInfo = getCurrencyInfo(selectedBase);
        if (currencyInfo && currencyInfo.id) {
          url = `/copy-trading/signals?currencyId=${currencyInfo.id}`;
        }
      }
      
      const response = await apiClient<Signal[]>(url);
      if (Array.isArray(response)) {
        // Используем ту же логику плавного обновления для сохранения прогресс-баров
        setSignals(prevSignals => {
          const existingSignalsMap = new Map(prevSignals.map(s => [s.id, s]));
          return response.map(newSignal => {
            const existingSignal = existingSignalsMap.get(newSignal.id);
            if (existingSignal) {
              return {
                ...newSignal,
                timestamp: existingSignal.timestamp || newSignal.timestamp,
              };
            }
            return newSignal;
          });
        });
      }
    } catch (error: any) {
      console.error('Failed to subscribe to user signals:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Error subscribing';
      showError(errorMessage);
    }
  }, [showError, selectedBase, getCurrencyInfo]);

  return (
    <div className="copy-trading-signals-list">
      <div className="signals-header">
        <h3 className="signals-title">{t('copyTrading.signalsTitle')}</h3>
        {false && (
          <div className="signals-actions" ref={infoRef}>
            <button 
              className="signals-action-btn" 
              title={t('copyTrading.info.title') || 'Информация о сигналах'}
              onClick={(e) => {
                e.stopPropagation();
                setIsInfoVisible(!isInfoVisible);
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
              </svg>
            </button>
            <button 
              className="signals-action-btn" 
              title={t('copyTrading.addYourSignal')}
              onClick={(e) => {
                e.stopPropagation();
                handleAddSignalClick();
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
            {isInfoVisible && (
              <div className="signals-description">
                <h4>{t('copyTrading.info.title') || 'О сигналах'}</h4>
                <p>{t('copyTrading.info.description') || 'Сигналы - это торговые рекомендации от других пользователей. Вы можете копировать их сигналы, чтобы автоматически повторять их сделки, или создать свой собственный сигнал для других пользователей.'}</p>
                <p><strong>{t('copyTrading.info.howToCopy') || 'Как копировать:'}</strong> {t('copyTrading.info.copyInstructions') || 'Нажмите кнопку "Скопировать" на любом активном сигнале. Ваша сделка будет автоматически открыта с теми же параметрами.'}</p>
                <p><strong>{t('copyTrading.info.howToCreate') || 'Как создать:'}</strong> {t('copyTrading.info.createInstructions') || 'Нажмите кнопку "+" и заполните форму: выберите валютную пару, сумму инвестиции и направление (вверх или вниз).'}</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="signals-content">
        {isLoading ? (
          <div className="signals-loading">{t('copyTrading.loadingSignals')}</div>
        ) : sortedSignals.length === 0 ? (
          <div className="signals-empty">{t('copyTrading.noActiveSignals')}</div>
        ) : (
          <Flipper 
            flipKey={flipKey}
            spring="gentle"
            staggerConfig={{
              default: {
                reverse: true,
                speed: 1
              }
            }}
            decisionData={flipKey}
          >
            <div className="signals-items">
              {sortedSignals.map((signal) => {
                // Проверяем, можно ли копировать сигнал (должно быть >= 30 секунд осталось)
                const isActive = isSignalActive(signal);
                const canCopy = signal.can_copy !== false && isActive;
                const progress = calculateProgress(signal);
                const currentCopied = getCurrentCopied(signal);
                const timer = getTimer(signal);
                return (
                  <SignalItemWithAnimation
                    key={signal.id}
                    signal={signal}
                    canCopy={canCopy}
                    investmentAmount={investmentAmount}
                    progress={progress}
                    onCopy={handleCopySignal}
                    onSubscribe={handleSubscribeToUser}
                    currentCopied={currentCopied}
                    isActive={isActive}
                    timer={timer}
                    getCurrencyInfo={getCurrencyInfo}
                    t={t}
                  />
                );
              })}
            </div>
          </Flipper>
        )}
      </div>

    </div>
  );
};

