import React, { useEffect, useCallback, useMemo, useState } from 'react';
import './ActiveTrades.css';
import { useLanguage } from '@src/app/providers/useLanguage';
import type { Currency } from '@src/shared/api';
import { markIconUrlAsFailed, isIconUrlFailed } from '@src/features/trading-terminal/hooks/useCurrencyData';
import { LOCAL_CURRENCY_ICONS, preloadCurrencyIcon } from '@src/features/trading-terminal/constants/currencyIcons';
import { useAppSelector } from '@src/shared/lib/hooks';
import { selectTradingMode, selectCurrentMarketPrice, selectCurrentPrice } from '@src/entities/trading/model/selectors';
import { selectProfile } from '@src/entities/user/model/selectors';
import { formatCurrency } from '@src/shared/lib/currency/currencyUtils';
import { preloadImage, isImageCached, getImagePriority } from '@src/shared/lib/imageOptimization';
import { getServerTime } from '@src/shared/lib/serverTime';

interface ActiveTrade {
  id: string;
  price: number;
  direction: 'buy' | 'sell';
  amount: number;
  expirationTime: number;
  entryPrice: number;
  currentPrice: number | null;
  createdAt: number;
  symbol?: string | null;
  baseCurrency?: string | null;
  quoteCurrency?: string | null;
  profitPercentage?: number; // Процент прибыли из БД
  rigging?: {
    outcome: 'win' | 'lose';
    targetPrice: number;
    plan?: any;
  } | null;
}

interface ActiveTradesProps {
  getCurrencyInfo?: (baseCurrency: string) => Currency | undefined;
  resolveCurrencyIconUrls?: (currency?: Currency | null) => string[];
}

const KNOWN_QUOTES = ['USDT', 'USDC', 'USD', 'BTC', 'ETH', 'EUR', 'GBP', 'TRY', 'RUB', 'BNB', 'BUSD'];

type CurrencyIconViewProps = {
  iconUrls: string[];
  label: string;
  fallback: string;
  className?: string;
  imageClassName?: string;
  priority?: 'high' | 'low' | 'auto';
  isImportant?: boolean;
};

// Мемоизируем компонент, чтобы предотвратить перерендеры и перезагрузку изображений
const CurrencyIconView: React.FC<CurrencyIconViewProps> = React.memo(({
  iconUrls,
  label,
  fallback,
  className,
  imageClassName,
  priority = 'auto',
  isImportant = false,
}) => {
  const normalizedIconUrls = iconUrls?.filter(Boolean) ?? [];
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [exhausted, setExhausted] = React.useState(false);
  const [imageLoaded, setImageLoaded] = React.useState(false);
  const [failedUrls, setFailedUrls] = React.useState<Set<string>>(new Set());
  const imgRef = React.useRef<HTMLImageElement | null>(null);
  const iconUrlsKey = normalizedIconUrls.join('|');
  const currentUrl = normalizedIconUrls[currentIndex] ?? null;
  const hasAnyUrl = normalizedIconUrls.length > 0;
  const initials = fallback.trim().slice(0, 2).toUpperCase();
  
  const isCurrentUrlFailed = currentUrl ? isIconUrlFailed(currentUrl) : false;
  const showImage = hasAnyUrl && currentUrl !== null && !exhausted && !failedUrls.has(currentUrl) && !isCurrentUrlFailed;

  const imagePriority = useMemo(() => {
    if (priority !== 'auto') return priority;
    return getImagePriority(isImportant, false);
  }, [priority, isImportant]);

  const loadingStrategy = useMemo(() => {
    return imagePriority === 'high' ? 'eager' : 'lazy';
  }, [imagePriority]);

  const fetchPriority = useMemo<'high' | 'low' | 'auto' | undefined>(() => {
    if (imagePriority === 'high') return 'high';
    return undefined;
  }, [imagePriority]);

  useEffect(() => {
    let firstValidIndex = 0;
    for (let i = 0; i < normalizedIconUrls.length; i++) {
      if (!isIconUrlFailed(normalizedIconUrls[i])) {
        firstValidIndex = i;
        break;
      }
    }
    
    setCurrentIndex(firstValidIndex);
    setExhausted(false);
    setImageLoaded(false);
    setFailedUrls(new Set());
  }, [iconUrlsKey]);

  useEffect(() => {
    if (currentUrl && !isImageCached(currentUrl) && imagePriority === 'high') {
      preloadImage(currentUrl).catch(() => {});
    }
  }, [currentUrl, imagePriority]);

  const handleImageError = useCallback(
    (event: React.SyntheticEvent<HTMLImageElement, Event>) => {
      const img = event.currentTarget;
      const failedUrl = img.src;
      
      markIconUrlAsFailed(failedUrl);
      
      setFailedUrls((prev) => {
        const next = new Set(prev);
        next.add(failedUrl);
        return next;
      });

      setImageLoaded(false);

      setCurrentIndex((prev) => {
        for (let i = prev + 1; i < normalizedIconUrls.length; i++) {
          const url = normalizedIconUrls[i];
          if (url && !isIconUrlFailed(url) && !failedUrls.has(url)) {
            return i;
          }
        }
        setExhausted(true);
        return prev;
      });
    },
    [normalizedIconUrls, failedUrls],
  );

  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);
  }, []);

  useEffect(() => {
    if (normalizedIconUrls.length > 0 && currentIndex < normalizedIconUrls.length - 1) {
      const nextUrl = normalizedIconUrls[currentIndex + 1];
      if (nextUrl && !failedUrls.has(nextUrl) && !isIconUrlFailed(nextUrl) && !isImageCached(nextUrl)) {
        preloadImage(nextUrl).catch(() => {});
      }
    }
  }, [currentIndex, normalizedIconUrls, failedUrls]);

  return (
    <span
      className={[
        'currency-icon',
        showImage ? 'currency-icon--image' : 'currency-icon--placeholder',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {showImage ? (
        <img
          ref={imgRef}
          key={`currency-img-${currentUrl}`}
          src={currentUrl as string}
          alt={label}
          className={['currency-icon__img', imageClassName ?? '', imageLoaded ? 'currency-icon__img--loaded' : ''].filter(Boolean).join(' ')}
          width="20"
          height="20"
          loading={loadingStrategy}
          decoding="async"
          fetchpriority={fetchPriority}
          onError={handleImageError}
          onLoad={handleImageLoad}
        />
      ) : (
        <span className="currency-icon__initials">{initials}</span>
      )}
    </span>
  );
});

const deriveBaseFromSymbol = (symbol?: string | null): string | null => {
  if (!symbol) {
    return null;
  }
  const upper = String(symbol).trim().toUpperCase();
  if (!upper) {
    return null;
  }

  const separators = ['/', '_', '-', ':'];
  for (const separator of separators) {
    if (upper.includes(separator)) {
      const [base] = upper.split(separator);
      return base || null;
    }
  }

  for (const quote of KNOWN_QUOTES) {
    if (upper.endsWith(quote) && upper.length > quote.length) {
      return upper.slice(0, upper.length - quote.length) || null;
    }
  }

  return null;
};

const getTradeCurrency = (trade: ActiveTrade): string => {
  if (trade.baseCurrency) {
    return String(trade.baseCurrency).trim().toUpperCase();
  }

  if (trade.symbol) {
    const base = deriveBaseFromSymbol(trade.symbol);
    if (base) {
      return base;
    }
  }

  return '?';
};

const calculateIsWin = (
  trade: ActiveTrade, 
  getMarkerPrice?: (tradeId: string) => number | null,
  currentMarketPrice?: number | null
): boolean => {
  const entryPrice = trade.entryPrice;
  const direction = trade.direction;
  
  // Проверяем, истекла ли сделка (только для определения статуса, НЕ для расчета выигрыша)
  // Расчет выигрыша основан ТОЛЬКО на сравнении цен: currentPrice vs entryPrice
  const now = getServerTime();
  const expirationTime = trade.expirationTime && trade.expirationTime < 1e12 
    ? trade.expirationTime * 1000 
    : trade.expirationTime;
  const isExpired = expirationTime && expirationTime <= now;
  
  // Если сделка истекла и есть rigging.outcome, используем его (только для истекших сделок)
  if (isExpired && trade.rigging && trade.rigging.outcome) {
    return trade.rigging.outcome === 'win';
  }
  
  // ИСПОЛЬЗУЕМ ТОЛЬКО 2 ЦЕНЫ:
  // 1. entryPrice - цена ставки
  // 2. currentMarketPrice - текущая рыночная цена (та же, что используется для маркера цены на графике)
  
  let currentPrice: number | null = null;
  let priceSource = 'none';
  
  // Используем currentMarketPrice - это та же цена, что используется для маркера цены на графике
  if (currentMarketPrice !== null && currentMarketPrice !== undefined && currentMarketPrice > 0) {
    currentPrice = currentMarketPrice;
    priceSource = 'currentMarketPrice (цена маркера цены на графике)';
  } else {
    // Если currentMarketPrice нет, используем entryPrice как fallback (но это не должно происходить)
    currentPrice = entryPrice;
    priceSource = 'entryPrice (fallback - нет текущей рыночной цены)';
  }
  
  const isWin = direction === 'buy' 
    ? currentPrice > entryPrice 
    : currentPrice < entryPrice;
  
  // Логирование для отладки
  const priceDiff = currentPrice - entryPrice;
  const priceDiffPercent = entryPrice > 0 ? (priceDiff / entryPrice) * 100 : 0;
  const conditionMet = direction === 'buy' 
    ? currentPrice > entryPrice 
    : currentPrice < entryPrice;
  
  // ЛОГИРОВАНИЕ ПРИ КАЖДОМ ТИКЕ ЦЕНЫ
  // Используем currentPrice, который уже выбран с правильным приоритетом (сначала цена маркера на графике, потом общая рыночная)
  const tickPrice = currentPrice;
  
  if (tickPrice > 0) {
    const amount = trade.amount;
    const result = isWin ? '✅ WIN' : '❌ LOSS';
    const conditionMet = direction === 'buy' 
      ? tickPrice > entryPrice 
      : tickPrice < entryPrice;
    
    // Логируем информацию о ставке и тике
    // console.log(`[ТИК ЦЕНЫ] ${trade.id}`, {
    //   '💰 Сумма ставки': amount,
    //   '📊 Направление': direction.toUpperCase(),
    //   '💵 Цена ставки (entryPrice)': entryPrice.toFixed(8),
    //   '📈 Цена тика (currentPrice)': tickPrice.toFixed(8),
    //   '📉 Разница': priceDiff.toFixed(8),
    //   '🎯 Результат': result,
    //   '✅ Условие выполнено': conditionMet,
    //   '📍 Источник цены': priceSource,
    //   'Условие': direction === 'buy' 
    //     ? `tickPrice (${tickPrice.toFixed(8)}) > entryPrice (${entryPrice.toFixed(8)})`
    //     : `tickPrice (${tickPrice.toFixed(8)}) < entryPrice (${entryPrice.toFixed(8)})`
    // });
  }
  
  return isWin;
};

const calculateProfit = (
  trade: ActiveTrade,
  getMarkerPrice?: (tradeId: string) => number | null,
  currentMarketPrice?: number | null,
  currencyInfo?: Currency | null
): { profit: number; profitPercent: number; error?: string } => {
  const amount = trade.amount;
  const entryPrice = trade.entryPrice || trade.price || 0;
  
  // Проверяем, истекла ли сделка (только для определения статуса, НЕ для расчета выигрыша)
  // Расчет выигрыша основан ТОЛЬКО на сравнении цен: currentPrice vs entryPrice
  const now = getServerTime();
  const expirationTime = trade.expirationTime && trade.expirationTime < 1e12 
    ? trade.expirationTime * 1000 
    : trade.expirationTime;
  const isExpired = expirationTime && expirationTime <= now;
  
  let isWin: boolean;
  let currentPrice: number | null = null;
  let priceSource = 'none';
  
  // Если сделка истекла и есть rigging.outcome, используем его (только для истекших сделок)
  if (isExpired && trade.rigging && trade.rigging.outcome) {
    isWin = trade.rigging.outcome === 'win';
    if (trade.rigging.targetPrice) {
      currentPrice = trade.rigging.targetPrice;
      priceSource = 'rigging.targetPrice (expired)';
    }
  } else {
    // ИСПОЛЬЗУЕМ ТОЛЬКО 2 ЦЕНЫ (как в calculateIsWin):
    // 1. entryPrice - цена ставки
    // 2. currentMarketPrice - текущая рыночная цена (та же, что используется для маркера цены на графике)
    
    if (currentMarketPrice !== null && currentMarketPrice !== undefined && currentMarketPrice > 0) {
      currentPrice = currentMarketPrice;
      priceSource = 'currentMarketPrice (цена маркера цены на графике)';
    } else {
      // Если currentMarketPrice нет, используем entryPrice как fallback (но это не должно происходить)
      currentPrice = entryPrice;
      priceSource = 'entryPrice (fallback - нет текущей рыночной цены)';
    }
    
    isWin = trade.direction === 'buy' 
      ? currentPrice > entryPrice 
      : currentPrice < entryPrice;
  }
  
  let profit: number;
  let profitPercent: number;
  let profitSource = 'none';
  
  const profitPercentageFromDB = trade.profitPercentage;
  
  // Для активных сделок (не истекших) в выигрыше всегда показываем потенциальный выигрыш
  // Для завершенных сделок используем финальный результат
  if (isWin) {
    // Для активных сделок (не истекших) в выигрыше всегда показываем потенциальный выигрыш
    if (!isExpired) {
      // Сначала пробуем использовать процент из БД
      if (profitPercentageFromDB !== null && profitPercentageFromDB !== undefined && profitPercentageFromDB > 0) {
        profitPercent = profitPercentageFromDB;
        profit = (profitPercent / 100) * amount;
        profitSource = 'profitPercentageFromDB';
      } else if (currencyInfo && currencyInfo.profit_percentage !== null && currencyInfo.profit_percentage !== undefined) {
        // Если нет процента из БД, используем процент из информации о валюте
        const currencyProfitPercent = typeof currencyInfo.profit_percentage === 'number' 
          ? currencyInfo.profit_percentage 
          : Number(currencyInfo.profit_percentage);
        if (Number.isFinite(currencyProfitPercent) && currencyProfitPercent > 0) {
          // Используем процент из валюты, если он больше 0
          profitPercent = currencyProfitPercent;
          profit = (profitPercent / 100) * amount;
          profitSource = 'currencyInfo.profit_percentage';
        } else {
          // Если процент из валюты равен 0 или невалидный, используем стандартный процент для активных сделок
          profitPercent = 80; // Стандартный процент прибыли для активных сделок
          profit = (profitPercent / 100) * amount;
          profitSource = 'default 80% (currency profit_percentage is 0 or invalid)';
        }
      } else {
        // Если нет ни процента из БД, ни из валюты, используем стандартный процент для активных сделок
        profitPercent = 80; // Стандартный процент прибыли для активных сделок
        profit = (profitPercent / 100) * amount;
        profitSource = 'default 80% (no profit percentage available)';
      }
    } else {
      // Для завершенных сделок используем финальный результат
      // Сначала пробуем использовать процент из БД
      if (profitPercentageFromDB !== null && profitPercentageFromDB !== undefined && profitPercentageFromDB > 0) {
        profitPercent = profitPercentageFromDB;
        profit = (profitPercent / 100) * amount;
        profitSource = 'profitPercentageFromDB (expired)';
      } else if (currencyInfo && currencyInfo.profit_percentage !== null && currencyInfo.profit_percentage !== undefined) {
        // Если нет процента из БД, используем процент из информации о валюте
        const currencyProfitPercent = typeof currencyInfo.profit_percentage === 'number' 
          ? currencyInfo.profit_percentage 
          : Number(currencyInfo.profit_percentage);
        if (Number.isFinite(currencyProfitPercent) && currencyProfitPercent > 0) {
          // Используем процент из валюты, если он больше 0
          profitPercent = currencyProfitPercent;
          profit = (profitPercent / 100) * amount;
          profitSource = 'currencyInfo.profit_percentage (expired)';
        } else {
          // Для завершенных сделок рассчитываем на основе текущей цены
          const priceDiff = trade.direction === 'buy' 
            ? currentPrice - entryPrice 
            : entryPrice - currentPrice;
          profitPercent = entryPrice > 0 ? (priceDiff / entryPrice) * 100 : 0;
          profit = (profitPercent / 100) * amount;
          profitSource = 'calculated from price diff (expired, currency profit_percentage is 0)';
        }
      } else {
        // Для завершенных сделок рассчитываем на основе текущей цены
        const priceDiff = trade.direction === 'buy' 
          ? currentPrice - entryPrice 
          : entryPrice - currentPrice;
        profitPercent = entryPrice > 0 ? (priceDiff / entryPrice) * 100 : 0;
        profit = (profitPercent / 100) * amount;
        profitSource = 'calculated from price diff (expired, no currency info)';
      }
    }
  } else {
    // Если сделка не в выигрыше
    if (!isExpired) {
      // Для активных сделок, которые не в выигрыше, показываем 0 прибыли
      profit = 0;
      profitPercent = 0;
      profitSource = 'loss (active trade, showing 0)';
    } else {
      // Для завершенных сделок рассчитываем убыток на основе текущей цены
      const priceDiff = trade.direction === 'buy' 
        ? currentPrice - entryPrice 
        : entryPrice - currentPrice;
      profitPercent = entryPrice > 0 ? (priceDiff / entryPrice) * 100 : 0;
      profit = (profitPercent / 100) * amount;
      profitSource = 'loss (calculated from price diff)';
    }
  }
  
  // Логирование отключено для уменьшения шума в консоли
  // Раскомментируйте для отладки:
  // if (import.meta.env.DEV) {
  //   console.log(`[ActiveTrade ${trade.id}] 💵 ПРИБЫЛЬ:`, {
  //     direction: trade.direction.toUpperCase(),
  //     entryPrice: entryPrice.toFixed(2),
  //     currentPrice: currentPrice.toFixed(2),
  //     profit: profit.toFixed(2),
  //     profitPercent: profitPercent.toFixed(2) + '%',
  //     result: isWin ? 'WIN' : 'LOSS',
  //     isExpired
  //   });
  // }
  
  return { profit, profitPercent };
};

interface ActiveTradeItemComponentProps {
  trade: ActiveTrade;
  getCurrencyInfo?: (baseCurrency: string) => Currency | undefined;
  resolveCurrencyIconUrls?: (currency?: Currency | null) => string[];
  formatDate: (timestamp: number) => string;
  getTradeCurrency: (trade: ActiveTrade) => string;
  deriveBaseFromSymbol: (symbol?: string | null) => string | null;
  getMarkerPrice?: (tradeId: string) => number | null;
  currentMarketPrice?: number | null;
  userCurrency: string;
}

const ActiveTradeItemComponent: React.FC<ActiveTradeItemComponentProps> = ({
  trade,
  getCurrencyInfo,
  resolveCurrencyIconUrls,
  formatDate,
  getTradeCurrency,
  deriveBaseFromSymbol,
  getMarkerPrice,
  currentMarketPrice,
  userCurrency,
}) => {
  const markerPrice = getMarkerPrice ? (() => {
    try {
      return getMarkerPrice(trade.id);
    } catch (error) {
      return null;
    }
  })() : null;
  
  const currency = getTradeCurrency(trade);
  
  const tradeBaseCurrency = (() => {
    if (trade.baseCurrency) {
      return String(trade.baseCurrency).trim().toUpperCase();
    }
    if (trade.symbol) {
      const base = deriveBaseFromSymbol(trade.symbol);
      if (base) return base;
    }
    return currency && currency !== '?' ? currency : 'BTC';
  })();

  const currencyInfo = getCurrencyInfo ? getCurrencyInfo(tradeBaseCurrency) : null;
  
  // Для активных сделок НЕ используем useMemo, чтобы расчеты обновлялись при каждом изменении цены
  // Это гарантирует, что прибыль/убыток обновляются при каждом тике цены
  const isWin = calculateIsWin(trade, getMarkerPrice, currentMarketPrice);
  
  const profitResult = calculateProfit(trade, getMarkerPrice, currentMarketPrice, currencyInfo);
  
  const { profit, profitPercent, error: profitError } = profitResult;
  
  const profitAmount = profit;

  const [iconUrls, setIconUrls] = useState<string[]>([]);
  const [currentTime, setCurrentTime] = useState(getServerTime());

  useEffect(() => {
    const loadIconUrls = async () => {
      if (resolveCurrencyIconUrls && currencyInfo) {
        const urls = resolveCurrencyIconUrls(currencyInfo);
        if (urls.length > 0) {
          setIconUrls(urls);
          return;
        }
      }
      
      const localIcon = LOCAL_CURRENCY_ICONS[tradeBaseCurrency];
      if (localIcon) {
        setIconUrls([localIcon]);
      } else {
        const loadedIcon = await preloadCurrencyIcon(tradeBaseCurrency);
        if (loadedIcon) {
          setIconUrls([loadedIcon]);
        } else {
          setIconUrls([]);
        }
      }
    };

    loadIconUrls();
  }, [resolveCurrencyIconUrls, currencyInfo, tradeBaseCurrency]);

  // Обновляем время каждую секунду для плавного обновления прогресс-бара
  useEffect(() => {
    const timerInterval = setInterval(() => {
      setCurrentTime(getServerTime());
    }, 1000);
    
    return () => {
      clearInterval(timerInterval);
    };
  }, []);
  
  const iconUrlsKey = iconUrls.join('|');

  const currencyIcon = (
    <CurrencyIconView
      key={`currency-icon-${trade.id}-${iconUrlsKey}`}
      iconUrls={iconUrls}
      label={currencyInfo?.display_name || tradeBaseCurrency}
      fallback={tradeBaseCurrency}
      className="trade-currency-icon-view"
      imageClassName="trade-currency-icon-img"
    />
  );

  return (
    <div 
      className={`trade-history-item ${trade.direction} ${isWin ? 'win' : 'loss'}`}
    >
      <div className="trade-history-row trade-history-row-top">
        <div className="trade-currency-wrapper">
          <div className="trade-currency-icon">
            {currencyIcon}
          </div>
          <div className="trade-currency">
            {currency}
            {((trade as any).is_copied || (trade as any).isCopied) && (
              <span className="copied-trade-marker" title="Сделка через подписку на сигнал трейдера">
                📋
              </span>
            )}
          </div>
        </div>
        <div className={`trade-profit ${isWin ? 'win' : 'loss'}`}>
          {(() => {
            // Для активных сделок показываем потенциальный выигрыш если в выигрыше, иначе 0
            // Для завершенных сделок показываем финальный результат
            const now = getServerTime();
            // Проверяем, что expirationTime в миллисекундах (если меньше 1e12, то это секунды и нужно умножить на 1000)
            const expirationTime = trade.expirationTime && trade.expirationTime < 1e12 
              ? trade.expirationTime * 1000 
              : trade.expirationTime;
            const isExpired = expirationTime && expirationTime <= now;
            
            if (!isExpired && isWin && profitAmount > 0) {
              // Активная сделка в выигрыше - показываем потенциальный выигрыш
              return `+${formatCurrency(profitAmount, userCurrency)}`;
            } else if (!isExpired && !isWin) {
              // Активная сделка не в выигрыше - показываем 0 прибыли
              return formatCurrency(0, userCurrency);
            } else if (isWin && profitAmount > 0) {
              // Завершенная сделка в выигрыше
              return `+${formatCurrency(profitAmount, userCurrency)}`;
            } else if (profitAmount < 0) {
              // Завершенная сделка в убытке
              return formatCurrency(profitAmount, userCurrency);
            } else {
              // Прибыль равна 0
              return formatCurrency(0, userCurrency);
            }
          })()}
        </div>
      </div>
      <div className="trade-history-row trade-history-row-bottom">
        <div className="trade-time">
          <div className={`trade-arrow ${trade.direction === 'buy' ? 'arrow-up' : 'arrow-down'}`}>
            {trade.direction === 'buy' ? '⬆' : '⬇'}
          </div>
          {formatDate(trade.createdAt)}
        </div>
        <div className="trade-middle">
          {formatCurrency(trade.amount + profitAmount, userCurrency)}
        </div>
      </div>
      {(() => {
        // Вычисляем прогресс оставшегося времени до завершения сделки
        const now = currentTime;
        const expirationTime = trade.expirationTime && trade.expirationTime < 1e12 
          ? trade.expirationTime * 1000 
          : trade.expirationTime;
        const createdAt = trade.createdAt && trade.createdAt < 1e12 
          ? trade.createdAt * 1000 
          : trade.createdAt;
        
        if (expirationTime && createdAt) {
          const totalDuration = expirationTime - createdAt;
          const elapsed = now - createdAt;
          const remaining = expirationTime - now;
          // Изменено: показываем прошедшее время (заполнение слева направо)
          const progressPercent = totalDuration > 0 
            ? Math.max(0, Math.min(100, (elapsed / totalDuration) * 100))
            : 0;
          
          // Показываем прогресс-бар только если сделка еще не истекла
          if (remaining > 0) {
            return (
              <div className="active-trade-progress">
                <div className="active-trade-progress-bar-container">
                  <div 
                    className="active-trade-progress-bar"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            );
          }
        }
        return null;
      })()}
    </div>
  );
};

export const ActiveTrades: React.FC<ActiveTradesProps> = ({ 
  getCurrencyInfo,
  resolveCurrencyIconUrls
}) => {
  const tradingMode = useAppSelector(selectTradingMode);
  const currentMarketPrice = useAppSelector(selectCurrentMarketPrice);
  const currentPrice = useAppSelector(selectCurrentPrice);
  const markerPriceSelector = useAppSelector((state) => state.trading.prices.currentMarketPrice);
  const allActiveTrades = useAppSelector((state) => state.trading.activeTrades);
  const profile = useAppSelector(selectProfile);
  const userCurrency = profile?.currency || 'USD';
  
  const activeTrades = allActiveTrades.filter(trade => {
    const isDemo = trade.isDemo || trade.is_demo;
    
    // Фильтруем по режиму торговли
    const matchesMode = tradingMode === 'demo' ? isDemo : tradingMode === 'manual' ? !isDemo : false;
    if (!matchesMode) return false;
    
    // Фильтруем истекшие трейды - не показываем их в активных
    const now = getServerTime();
    const expirationTime = trade.expirationTime && trade.expirationTime < 1e12 
      ? trade.expirationTime * 1000 
      : trade.expirationTime;
    
    // Исключаем истекшие трейды (expirationTime <= now)
    if (expirationTime && expirationTime <= now) {
      return false;
    }
    
    return true;
  });
  
  // Используем currentMarketPrice, если он есть, иначе currentPrice как fallback
  const effectiveMarketPrice = currentMarketPrice ?? currentPrice;
  
  // Логирование обновления цены отключено для уменьшения шума в консоли
  // Раскомментируйте для отладки:
  // useEffect(() => {
  //   if (currentMarketPrice !== null && currentMarketPrice !== undefined && activeTrades.length > 0) {
  //     console.log(`[ActiveTrades] 💹 Обновление цены для ${activeTrades.length} активных сделок: ${currentMarketPrice.toFixed(8)}`);
  //   }
  // }, [currentMarketPrice, activeTrades.length]);
  
  const getMarkerPrice = useCallback((tradeId: string): number | null => {
    // Используем currentMarketPrice для всех маркеров
    // Приоритет: currentMarketPrice > currentPrice > markerPriceSelector
    const price = currentMarketPrice ?? currentPrice ?? markerPriceSelector;
    return price;
  }, [currentMarketPrice, currentPrice, markerPriceSelector]);
  const { t } = useLanguage();
  
  const trades = activeTrades;

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    // Используем UTC время для независимости от часового пояса
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(date.getUTCSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  if (trades.length === 0) {
  return (
    <div className="active-trades">
      <div className="no-active-trades">
        <p>{t('trading.noActiveTrades') || 'No active trades'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="active-trades">
      <div className="trade-history-list">
        {trades.map(trade => (
          <ActiveTradeItemComponent
            key={trade.id}
            trade={trade}
            getCurrencyInfo={getCurrencyInfo}
            resolveCurrencyIconUrls={resolveCurrencyIconUrls}
            formatDate={formatDate}
            getTradeCurrency={getTradeCurrency}
            deriveBaseFromSymbol={deriveBaseFromSymbol}
            getMarkerPrice={getMarkerPrice}
            currentMarketPrice={effectiveMarketPrice}
            userCurrency={userCurrency}
          />
        ))}
      </div>
    </div>
  );
};

ActiveTrades.displayName = 'ActiveTrades';
