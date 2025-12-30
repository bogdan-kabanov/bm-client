import React, { useMemo, useState, useCallback, useEffect } from 'react';
import './TradeHistory.css';
import { useLanguage } from '@src/app/providers/useLanguage';
import type { Currency } from '@src/shared/api';
import { markIconUrlAsFailed, isIconUrlFailed } from '@src/features/trading-terminal/hooks/useCurrencyData';
import { LOCAL_CURRENCY_ICONS, preloadCurrencyIcon } from '@src/features/trading-terminal/constants/currencyIcons';
import { useAppSelector } from '@src/shared/lib/hooks';
import { selectProfile } from '@src/entities/user/model/selectors';
import { formatCurrency } from '@src/shared/lib/currency/currencyUtils';
import { preloadImage, isImageCached, getImagePriority } from '@src/shared/lib/imageOptimization';

interface TradeHistoryItem {
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
  completedAt: number;
  symbol?: string | null;
  baseCurrency?: string | null;
  quoteCurrency?: string | null;
}

interface TradeHistoryProps {
  trades: TradeHistoryItem[];
  selectedBase?: string; // Оставлено для обратной совместимости, но больше не используется
  quoteCurrency?: string;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  hasMore?: boolean;
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
  const [currentIndex, setCurrentIndex] = useState(0);
  const [exhausted, setExhausted] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [failedUrls, setFailedUrls] = useState<Set<string>>(new Set());
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

  const fetchPriority = useMemo(() => {
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

const getTradeCurrency = (trade: TradeHistoryItem): string => {
  // Если есть baseCurrency, используем его напрямую
  if (trade.baseCurrency) {
    return String(trade.baseCurrency).trim().toUpperCase();
  }

  // Если нет baseCurrency, но есть symbol, извлекаем базовую валюту из symbol
  if (trade.symbol) {
    const base = deriveBaseFromSymbol(trade.symbol);
    if (base) {
      return base;
    }
  }

  // Если ничего не найдено, возвращаем "?"
  return '?';
};

interface TradeHistoryItemComponentProps {
  trade: TradeHistoryItem;
  getCurrencyInfo?: (baseCurrency: string) => Currency | undefined;
  resolveCurrencyIconUrls?: (currency?: Currency | null) => string[];
  formatDate: (timestamp: number) => string;
  getTradeCurrency: (trade: TradeHistoryItem) => string;
  deriveBaseFromSymbol: (symbol?: string | null) => string | null;
  userCurrency: string;
}

const TradeHistoryItemComponent: React.FC<TradeHistoryItemComponentProps> = ({
  trade,
  getCurrencyInfo,
  resolveCurrencyIconUrls,
  formatDate,
  getTradeCurrency,
  deriveBaseFromSymbol,
  userCurrency,
}) => {
  // profit может быть отрицательным при проигрыше
  // ВАЖНО: проверяем на undefined/null, но не на 0, так как 0 - это валидное значение
  const profitAmount = trade.profit !== undefined && trade.profit !== null ? trade.profit : 0;
  const currency = getTradeCurrency(trade);
  
  const tradeBaseCurrency = useMemo(() => {
    if (trade.baseCurrency) {
      return String(trade.baseCurrency).trim().toUpperCase();
    }
    if (trade.symbol) {
      const base = deriveBaseFromSymbol(trade.symbol);
      if (base) return base;
    }
    // Используем currency только если он не "?"
    return currency && currency !== '?' ? currency : 'BTC';
  }, [trade.baseCurrency, trade.symbol, currency, deriveBaseFromSymbol]);

  const currencyInfo = useMemo(() => {
    if (!getCurrencyInfo) return null;
    return getCurrencyInfo(tradeBaseCurrency);
  }, [getCurrencyInfo, tradeBaseCurrency]);

  const [iconUrls, setIconUrls] = useState<string[]>([]);

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

  return (
    <div 
      className={`trade-history-item ${trade.direction} ${trade.isWin ? 'win' : 'loss'}`}
    >
      <div className="trade-history-row trade-history-row-top">
        <div className="trade-currency-wrapper">
          <div className="trade-currency-icon">
            <CurrencyIconView
              iconUrls={iconUrls}
              label={currencyInfo?.display_name || tradeBaseCurrency}
              fallback={tradeBaseCurrency}
              className="trade-currency-icon-view"
              imageClassName="trade-currency-icon-img"
            />
          </div>
          <div className="trade-currency">
            {currency}
            {trade.is_copied && (
              <span className="copied-trade-marker" title="Сделка через подписку на сигнал трейдера">
                📋
              </span>
            )}
          </div>
        </div>
        <div className={`trade-profit ${trade.isWin ? 'win' : 'loss'}`}>
          {trade.isWin 
            ? `+${formatCurrency(profitAmount, userCurrency)}` 
            : profitAmount < 0 
              ? formatCurrency(profitAmount, userCurrency)
              : `-${formatCurrency(trade.amount, userCurrency)}`}
        </div>
      </div>
      <div className="trade-history-row trade-history-row-bottom">
        <div className="trade-time">
          <div className={`trade-arrow ${trade.direction === 'buy' ? 'arrow-up' : 'arrow-down'}`}>
            {trade.direction === 'buy' ? '⬆' : '⬇'}
          </div>
          {formatDate(trade.completedAt)}
        </div>
        <div className="trade-middle">
          {trade.isWin ? formatCurrency(trade.amount + profitAmount, userCurrency) : formatCurrency(0, userCurrency)}
        </div>
      </div>
    </div>
  );
};

export const TradeHistory: React.FC<TradeHistoryProps> = ({ 
  trades, 
  quoteCurrency = 'USDT',
  onLoadMore,
  isLoadingMore = false,
  hasMore = false,
  getCurrencyInfo,
  resolveCurrencyIconUrls
}) => {

  const { t } = useLanguage();
  const listRef = React.useRef<HTMLDivElement>(null);
  const profile = useAppSelector(selectProfile);
  const userCurrency = profile?.currency || 'USD';


  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // Автоматическая догрузка при скролле вниз
  React.useEffect(() => {
    const listElement = listRef.current;
    if (!listElement || !onLoadMore || !hasMore) {
      return;
    }

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = listElement;
      // Загружаем больше, когда пользователь прокрутил до 80% списка
      if (scrollTop + clientHeight >= scrollHeight * 0.8) {
        onLoadMore();
      }
    };

    listElement.addEventListener('scroll', handleScroll);
    return () => {
      listElement.removeEventListener('scroll', handleScroll);
    };
  }, [onLoadMore, hasMore]);

  // Сортируем сделки по времени завершения (новые сверху)
  // ВАЖНО: useMemo должен быть вызван до любого раннего возврата, чтобы соблюдать правила хуков React
  const sortedTrades = useMemo(() => {
    return [...trades].sort((a, b) => {
      // Сортируем по completedAt в порядке убывания (новые сверху)
      return b.completedAt - a.completedAt;
    });
  }, [trades]);

  if (trades.length === 0) {
    return (
      <div className="trade-history">
        <h3 className="trade-history-title">{t('trading.tradeHistory') || 'Trade History'}</h3>
        <div className="no-trades">
          <p>{t('trading.noTradeHistory') || 'No completed trades yet'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="trade-history">
      <div className="trade-history-list" ref={listRef}>
        {sortedTrades.map(trade => (
          <TradeHistoryItemComponent
            key={trade.id}
            trade={trade}
            getCurrencyInfo={getCurrencyInfo}
            resolveCurrencyIconUrls={resolveCurrencyIconUrls}
            formatDate={formatDate}
            getTradeCurrency={getTradeCurrency}
            deriveBaseFromSymbol={deriveBaseFromSymbol}
            userCurrency={userCurrency}
          />
        ))}
      </div>
    </div>
  );
};