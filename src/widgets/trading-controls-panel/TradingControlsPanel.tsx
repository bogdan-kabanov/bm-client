import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@src/app/providers/useLanguage';
import { useAppSelector } from '@src/shared/lib/hooks';
import { selectProfile } from '@src/entities/user/model/selectors';
import { formatCurrency, getCurrencySymbol } from '@src/shared/lib/currency/currencyUtils';
import { convertToUSDSync, convertFromUSDSync } from '@src/shared/lib/currency/exchangeRates';
import type { Currency } from '@src/shared/api';
import { currencyApi } from '@src/shared/api';
import { LOCAL_CURRENCY_ICONS, preloadCurrencyIcon } from '@src/features/trading-terminal/constants/currencyIcons';
import { markIconUrlAsFailed, isIconUrlFailed } from '@src/features/trading-terminal/hooks/useCurrencyData';
import { useMediaQuery } from '@src/shared/lib/hooks/useMediaQuery';
import { preloadImage, isImageCached, getImagePriority, isImageUrlFailed, isImageLoading } from '@src/shared/lib/imageOptimization';
import './TradingControlsPanel.css';

const TradeButtons = ({ 
  currentPrice, 
  isProcessing, 
  handleManualTrade, 
  setHoveredButton,
  isDisabled = false,
  balance = 0,
  tradingMode = 'manual',
  onZeroBalanceClick,
  t 
}: {
  currentPrice: number | null;
  isProcessing: boolean;
  handleManualTrade: (direction: 'buy' | 'sell') => void;
  setHoveredButton: (button: 'buy' | 'sell' | null) => void;
  isDisabled?: boolean;
  balance?: number;
  tradingMode?: 'manual' | 'demo';
  onZeroBalanceClick?: () => void;
  t: (key: string) => string;
}) => {
  const isZeroBalance = balance === 0 && tradingMode !== 'demo';
  // Если баланс нулевой, кнопки должны быть активными для показа модального окна
  // Не блокируем кнопки из-за currentPrice === null, т.к. handleManualTrade сам получит цену из графика
  const buttonsDisabled = isZeroBalance ? false : (isProcessing || isDisabled);
  
  
  const handleClick = (direction: 'buy' | 'sell') => {
    if (isZeroBalance && onZeroBalanceClick) {
      onZeroBalanceClick();
    } else if (handleManualTrade) {
      handleManualTrade(direction);
    }
  };
  
  return (
    <div className="manual-trade-buttons">
      <button
        className="manual-buy-button"
        onClick={() => handleClick('buy')}
        onMouseEnter={() => setHoveredButton('buy')}
        onMouseLeave={() => setHoveredButton(null)}
        disabled={buttonsDisabled}
      >
        <span className="button-text">{t('trading.buy')}</span>
        <span className="arrow-icon-circle">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 19V5M12 5L5 12M12 5L19 12" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
      </button>
      <button
        className="manual-sell-button"
        onClick={() => handleClick('sell')}
        onMouseEnter={() => setHoveredButton('sell')}
        onMouseLeave={() => setHoveredButton(null)}
        disabled={buttonsDisabled}
      >
        <span className="button-text">{t('trading.sell')}</span>
        <span className="arrow-icon-circle">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 5V19M12 19L5 12M12 19L19 12" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
      </button>
    </div>
  );
};

interface TradingControlsPanelProps {
  balance: number;
  manualTradeAmount: string;
  setManualTradeAmount: (value: string) => void;
  handleManualTrade: (direction: 'buy' | 'sell') => void;
  formatHMS: (totalSeconds: number) => string;
  parsedExpiration: number;
  changeExpiration: (delta: number) => void;
  setExpirationSeconds: (value: string) => void;
  quickPresets: Array<{ label: string; seconds: number }>;
  setHoveredButton: (button: 'buy' | 'sell' | null) => void;
  isProcessing: boolean;
  currentPrice?: number | null;
  tradingMode: 'manual' | 'demo';
  onTradingModeChange: (mode: 'manual' | 'demo') => void;
  isTradingActive: boolean;
  onCalculatorOpen?: (position: { left: number; top: number }) => void;
  onTimeCalculatorOpen?: (position: { left: number; top: number }) => void;
  selectedBase?: string;
  getCurrencyInfo?: (baseCurrency: string) => Currency | undefined;
  resolveCurrencyIconUrls?: (currency?: Currency | null) => string[];
  currencyCategories?: Array<{ currencies?: Currency[] }>;
  currenciesLoading?: boolean;
  isOverlay?: boolean;
  isDisabled?: boolean;
}

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
  const normalizedIconUrls = React.useMemo(() => iconUrls?.filter(Boolean) ?? [], [iconUrls]);
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [exhausted, setExhausted] = React.useState(false);
  const [imageLoaded, setImageLoaded] = React.useState(false);
  const [failedUrls, setFailedUrls] = React.useState<Set<string>>(new Set());
  const imgRef = React.useRef<HTMLImageElement | null>(null);
  const iconUrlsKey = React.useMemo(() => normalizedIconUrls.join('|'), [normalizedIconUrls]);
  const currentUrl = normalizedIconUrls[currentIndex] ?? null;
  const hasAnyUrl = normalizedIconUrls.length > 0;
  const initials = fallback.trim().slice(0, 2).toUpperCase();
  
  const isCurrentUrlFailed = currentUrl ? (isIconUrlFailed(currentUrl) || isImageUrlFailed(currentUrl)) : false;
  const showImage = hasAnyUrl && currentUrl !== null && !exhausted && !failedUrls.has(currentUrl) && !isCurrentUrlFailed;

  const imagePriority = React.useMemo(() => {
    if (priority !== 'auto') return priority;
    return getImagePriority(isImportant, false);
  }, [priority, isImportant]);

  const loadingStrategy = React.useMemo(() => {
    return imagePriority === 'high' ? 'eager' : 'lazy';
  }, [imagePriority]);

  const fetchPriority = React.useMemo<'high' | undefined>(() => {
    if (imagePriority === 'high') return 'high';
    return undefined;
  }, [imagePriority]);

  React.useEffect(() => {
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

  React.useEffect(() => {
    if (currentUrl && 
        !isImageCached(currentUrl) && 
        imagePriority === 'high' && 
        !isIconUrlFailed(currentUrl) && 
        !isImageUrlFailed(currentUrl) &&
        !isImageLoading(currentUrl) &&
        !failedUrls.has(currentUrl)) {
      preloadImage(currentUrl).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUrl, imagePriority]);

  const handleImageError = React.useCallback(
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

  const handleImageLoad = React.useCallback(() => {
    setImageLoaded(true);
  }, []);

  React.useEffect(() => {
    if (normalizedIconUrls.length > 0 && currentIndex < normalizedIconUrls.length - 1) {
      const nextUrl = normalizedIconUrls[currentIndex + 1];
      if (nextUrl && 
          !failedUrls.has(nextUrl) && 
          !isIconUrlFailed(nextUrl) && 
          !isImageUrlFailed(nextUrl) &&
          !isImageLoading(nextUrl) &&
          !isImageCached(nextUrl)) {
        preloadImage(nextUrl).catch(() => {});
      }
    }
    // Removed failedUrls from dependencies to prevent infinite loop
    // failedUrls is only used for checking, not for triggering re-runs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, iconUrlsKey]);

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
          {...(fetchPriority ? { fetchpriority: fetchPriority as 'high' } : {})}
          onError={handleImageError}
          onLoad={handleImageLoad}
        />
      ) : (
        <span className="currency-icon__initials">{initials}</span>
      )}
    </span>
  );
});

export const TradingControlsPanel: React.FC<TradingControlsPanelProps> = ({
  balance,
  manualTradeAmount,
  setManualTradeAmount,
  handleManualTrade,
  formatHMS,
  parsedExpiration,
  changeExpiration,
  setExpirationSeconds,
  quickPresets,
  setHoveredButton,
  isProcessing,
  currentPrice = null,
  tradingMode,
  onTradingModeChange,
  isTradingActive,
  onCalculatorOpen,
  onTimeCalculatorOpen,
  selectedBase = 'BTC',
  getCurrencyInfo,
  resolveCurrencyIconUrls,
  currencyCategories = [],
  currenciesLoading = false,
  isOverlay = false,
  isDisabled = false
}) => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const profile = useAppSelector(selectProfile);
  const isMobile = useMediaQuery('(max-width: 1024px)');
  const userCurrency = profile?.currency || 'USD';
  
  const balanceUSD = balance || 0;
  
  const balanceInUserCurrency = userCurrency === 'USD' 
    ? balanceUSD 
    : convertFromUSDSync(balanceUSD, userCurrency);
  
  const minAmountUSD = 1;
  const minAmountInUserCurrency = userCurrency === 'USD'
    ? minAmountUSD
    : convertFromUSDSync(minAmountUSD, userCurrency);
  
  const defaultAmountInUserCurrency = userCurrency === 'USD'
    ? minAmountUSD
    : convertFromUSDSync(minAmountUSD, userCurrency);
  
  const [localManualAmount, setLocalManualAmount] = useState(manualTradeAmount);
  const [localExpiration, setLocalExpiration] = useState(parsedExpiration);
  const amountInputRef = useRef<HTMLInputElement>(null);
  const amountWrapperRef = useRef<HTMLDivElement>(null);
  const timeDisplayRef = useRef<HTMLDivElement>(null);
  const timeWrapperRef = useRef<HTMLDivElement>(null);

  const [fallbackCurrencyInfo, setFallbackCurrencyInfo] = useState<Currency | null>(null);
  
  // Используем ref для отслеживания, был ли уже сделан запрос для данной комбинации
  const requestedFallbackRef = useRef<string>('');

  // Получаем currencyInfo напрямую из getCurrencyInfo или fallback
  // Важно: проверяем наличие profit_percentage, иначе используем fallback
  // Также учитываем quote_currency, чтобы обновляться при переключении между парами с той же базовой валютой
  const currentCurrencyInfo = getCurrencyInfo ? getCurrencyInfo(selectedBase) : null;
  const currentQuoteCurrency = currentCurrencyInfo?.quote_currency ?? null;
  
  const currencyInfo = useMemo(() => {
    if (!selectedBase) return null;
    
    
    // Сначала пытаемся получить из getCurrencyInfo (если доступен)
    if (getCurrencyInfo) {
      try {
        const info = getCurrencyInfo(selectedBase);
        
        // Если getCurrencyInfo вернул данные, используем их (даже если profit_percentage = 0)
        if (info) {
          return info;
        }
      } catch (error) {
      }
    }
    
    // Иначе используем fallback
    return fallbackCurrencyInfo;
  }, [getCurrencyInfo, selectedBase, fallbackCurrencyInfo, currentQuoteCurrency]);

  // Загружаем данные о валюте из API как fallback, если getCurrencyInfo недоступен или не возвращает данные
  // ВАЖНО: не перезаписываем fallbackCurrencyInfo, если уже есть данные с profit_percentage
  // Но сбрасываем, если изменился quote_currency
  useEffect(() => {
    
    if (!selectedBase) return;
    
    const requestKey = `${selectedBase}_${currentQuoteCurrency}`;
    
    // Если изменился quote_currency, сбрасываем fallbackCurrencyInfo
    if (fallbackCurrencyInfo && 
        fallbackCurrencyInfo.base_currency === selectedBase &&
        fallbackCurrencyInfo.quote_currency !== currentQuoteCurrency) {
      setFallbackCurrencyInfo(null);
      requestedFallbackRef.current = '';
    }
    
    // Если уже есть fallback с profit_percentage и правильным quote_currency, не загружаем заново
    if (fallbackCurrencyInfo && 
        (fallbackCurrencyInfo.profit_percentage !== undefined && fallbackCurrencyInfo.profit_percentage !== null) &&
        fallbackCurrencyInfo.base_currency === selectedBase &&
        fallbackCurrencyInfo.quote_currency === currentQuoteCurrency) {
      return;
    }
    
    // Всегда пытаемся получить из getCurrencyInfo сначала
    if (getCurrencyInfo) {
      const info = getCurrencyInfo(selectedBase);
      
      // Если есть данные из getCurrencyInfo, используем их (даже если profit_percentage = 0)
      if (info) {
        setFallbackCurrencyInfo(info);
        requestedFallbackRef.current = requestKey;
        return;
      }
    }
    
    // Если getCurrencyInfo не вернул данные или нет profit_percentage, ищем в currencyCategories
    // Но только если еще нет fallback с profit_percentage
    if (!fallbackCurrencyInfo || 
        (fallbackCurrencyInfo.profit_percentage === undefined || fallbackCurrencyInfo.profit_percentage === null)) {
      // Проверка currencyCategories теперь обрабатывается в отдельном useEffect
      // Если currencyCategories уже есть, просто выходим - он обработается в отдельном useEffect
      if (currencyCategories && currencyCategories.length > 0) {
        return;
      }
      
      // Если данные еще загружаются или currencyCategories уже есть, не делаем запрос - подождем
      // currencyCategories обрабатывается в отдельном useEffect
      if (currenciesLoading || (currencyCategories && currencyCategories.length > 0)) {
        return;
      }
      
      // Проверяем, был ли уже сделан запрос для этой комбинации
      if (requestedFallbackRef.current === requestKey) {
        return;
      }
      
      // Только если currencyCategories пуст и данные загружены, делаем запрос к API (fallback)
      const loadCurrencyInfo = async () => {
        try {
          requestedFallbackRef.current = requestKey;
          
          // API теперь всегда возвращает CurrencyCategory[]
          const categories = await currencyApi.getCurrenciesGrouped();
          
          if (Array.isArray(categories)) {
            for (const category of categories) {
              if (category.currencies && Array.isArray(category.currencies)) {
                const currency = category.currencies.find(
                  (c: Currency) => c.base_currency === selectedBase || c.bybit_symbol?.includes(selectedBase)
                );
                if (currency && currency.profit_percentage !== undefined && currency.profit_percentage !== null) {
                  setFallbackCurrencyInfo(currency);
                  return;
                }
              }
            }
          }
        } catch (error) {
          // Сбрасываем флаг при ошибке, чтобы можно было повторить запрос
          requestedFallbackRef.current = '';
        }
      };
      
      loadCurrencyInfo();
    }
  }, [selectedBase, fallbackCurrencyInfo, currentQuoteCurrency, currenciesLoading, getCurrencyInfo]);
  
  // Отдельный эффект для обработки currencyCategories, когда они загружаются
  useEffect(() => {
    if (!selectedBase || currenciesLoading || !currencyCategories || currencyCategories.length === 0) {
      return;
    }
    
    // Если уже есть fallback с правильными данными, не обрабатываем
    if (fallbackCurrencyInfo && 
        fallbackCurrencyInfo.base_currency === selectedBase &&
        fallbackCurrencyInfo.quote_currency === currentQuoteCurrency &&
        (fallbackCurrencyInfo.profit_percentage !== undefined && fallbackCurrencyInfo.profit_percentage !== null)) {
      return;
    }
    
    // Ищем валюту в currencyCategories
    for (const category of currencyCategories) {
      if (category.currencies && Array.isArray(category.currencies)) {
        const currency = category.currencies.find(
          (c: Currency) => c.base_currency === selectedBase || c.bybit_symbol?.includes(selectedBase)
        );
        if (currency && currency.profit_percentage !== undefined && currency.profit_percentage !== null) {
          setFallbackCurrencyInfo(currency);
          const requestKey = `${selectedBase}_${currentQuoteCurrency}`;
          requestedFallbackRef.current = requestKey;
          return;
        }
      }
    }
  }, [selectedBase, currentQuoteCurrency, currenciesLoading, currencyCategories.length, fallbackCurrencyInfo]);

  const [iconUrls, setIconUrls] = useState<string[]>([]);
  const [userCurrencyIconUrls, setUserCurrencyIconUrls] = useState<string[]>([]);

  useEffect(() => {
    const loadIconUrls = async () => {
      if (resolveCurrencyIconUrls && currencyInfo) {
        const urls = resolveCurrencyIconUrls(currencyInfo);
        if (urls.length > 0) {
          setIconUrls(urls);
          return;
        }
      }
      
      const localIcon = LOCAL_CURRENCY_ICONS[selectedBase];
      if (localIcon) {
        setIconUrls([localIcon]);
      } else {
        const loadedIcon = await preloadCurrencyIcon(selectedBase);
        if (loadedIcon) {
          setIconUrls([loadedIcon]);
        } else {
          setIconUrls([]);
        }
      }
    };

    loadIconUrls();
  }, [resolveCurrencyIconUrls, currencyInfo, selectedBase]);

  useEffect(() => {
    const loadUserCurrencyIconUrls = async () => {
      const localIcon = LOCAL_CURRENCY_ICONS[userCurrency];
      if (localIcon) {
        setUserCurrencyIconUrls([localIcon]);
      } else {
        const loadedIcon = await preloadCurrencyIcon(userCurrency);
        if (loadedIcon) {
          setUserCurrencyIconUrls([loadedIcon]);
        } else {
          setUserCurrencyIconUrls([]);
        }
      }
    };

    loadUserCurrencyIconUrls();
  }, [userCurrency]);

  const profitPercentage = useMemo(() => {
    
    if (!currencyInfo) {
      return 0;
    }
    
    // Используем ту же логику, что и в CurrencyControls (normalizeNumberValue)
    const profitValue = currencyInfo.profit_percentage;
    if (profitValue === null || profitValue === undefined) {
      return 0;
    }
    
    const numeric = typeof profitValue === 'number' ? profitValue : Number(profitValue);
    if (!Number.isFinite(numeric)) {
      return 0;
    }
    
    return numeric;
  }, [currencyInfo]);

  const profitAmount = useMemo(() => {
    // Используем localManualAmount для немедленного обновления при вводе
    const amount = parseFloat(localManualAmount || manualTradeAmount || '0');
    if (isNaN(amount) || amount <= 0) return 0;
    const amountInUSD = userCurrency === 'USD' 
      ? amount 
      : convertToUSDSync(amount, userCurrency);
    return (profitPercentage / 100) * amountInUSD;
  }, [localManualAmount, manualTradeAmount, profitPercentage, userCurrency]);

  const profitAmountInUserCurrency = useMemo(() => {
    if (userCurrency === 'USD') return profitAmount;
    return convertFromUSDSync(profitAmount, userCurrency);
  }, [profitAmount, userCurrency]);

  const currencyPairName = useMemo(() => {
    if (!currencyInfo) return `${selectedBase}/USDT`;
    const base = currencyInfo.base_currency || selectedBase;
    const quote = currencyInfo.quote_currency || 'USDT';
    return `${base}/${quote}`;
  }, [currencyInfo, selectedBase]);

  const getTimeStep = useCallback((currentSeconds: number): number => {
    if (currentSeconds < 60) {
      return 5;
    } else if (currentSeconds < 300) {
      return 10;
    } else if (currentSeconds < 900) {
      return 30;
    } else {
      return 60;
    }
  }, []);


  useEffect(() => {
    // Синхронизируем локальное состояние с внешним manualTradeAmount
    // Просто обновляем локальное состояние, когда меняется внешнее
    setLocalManualAmount(manualTradeAmount);
  }, [manualTradeAmount]);

  useEffect(() => {
    setLocalExpiration(parsedExpiration);
  }, [parsedExpiration]);


  const handleAmountInputClick = (e: React.MouseEvent<HTMLInputElement>) => {
    
    // На мобильных устройствах предотвращаем фокус на поле ввода
    if (isMobile) {
      e.preventDefault();
      if (amountInputRef.current) {
        amountInputRef.current.blur();
      }
    }
    
    if (amountWrapperRef.current) {
      const rect = amountWrapperRef.current.getBoundingClientRect();
      
      // Используем глобальный обработчик для открытия калькулятора инвестиций внутри графика
      if ((window as any).__tradingTerminalOpenInvestmentCalculator) {
        (window as any).__tradingTerminalOpenInvestmentCalculator({
          left: rect.left,
          top: rect.top
        });
      } else if (onCalculatorOpen) {
        // Fallback на старый обработчик для обратной совместимости
        const calculatorWidth = window.innerWidth <= 1435 ? 220 : 260;
        const gap = 36;
        const minLeftMargin = 10;
        
        let left: number;
        let top: number;
        
        if (isMobile) {
          top = rect.top;
          left = rect.left - calculatorWidth - gap;
          if (left < 0) {
            left = rect.right + gap;
          }
        } else {
          left = rect.left - calculatorWidth - gap;
          top = rect.top;
          if (left < minLeftMargin) {
            left = minLeftMargin;
          }
        }
        
        onCalculatorOpen({
          left,
          top
        });
      }
    }
  };
  
  const handleAmountInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    
    // На мобильных устройствах предотвращаем фокус на поле ввода
    if (isMobile) {
      e.preventDefault();
      e.target.blur();
      handleAmountInputClick(e as any);
    }
  };

  const handleTimeDisplayClick = (e?: React.MouseEvent) => {
    
    if (timeWrapperRef.current && onTimeCalculatorOpen) {
      const rect = timeWrapperRef.current.getBoundingClientRect();
      const calculatorWidth = window.innerWidth <= 1435 ? 240 : 280;
      const gap = 36;
      const left = rect.left - calculatorWidth - gap;
      const top = rect.top;
      
      
      onTimeCalculatorOpen({
        left: left < 0 ? rect.right + gap : left,
        top: top
      });
    } else {
    }
  };

  // Вычисляем выплату (инвестиция + прибыль)
  const payoutAmount = useMemo(() => {
    const amount = parseFloat(localManualAmount || manualTradeAmount || '0');
    if (isNaN(amount) || amount <= 0) return 0;
    const amountInUSD = userCurrency === 'USD' 
      ? amount 
      : convertToUSDSync(amount, userCurrency);
    return amountInUSD + profitAmount;
  }, [localManualAmount, manualTradeAmount, profitAmount, userCurrency]);

  const payoutAmountInUserCurrency = useMemo(() => {
    if (userCurrency === 'USD') return payoutAmount;
    return convertFromUSDSync(payoutAmount, userCurrency);
  }, [payoutAmount, userCurrency]);

  // Проверяем, должна ли быть отключена кнопка на основе суммы инвестиции
  const isAmountDisabled = useMemo(() => {
    const amount = parseFloat(localManualAmount || manualTradeAmount || '0');
    if (isNaN(amount) || amount <= 0) {
      return true;
    }
    
    // Проверяем минимальную сумму ($1 в USD)
    const amountInUSD = userCurrency === 'USD' 
      ? amount 
      : convertToUSDSync(amount, userCurrency);
    
    const disabled = amountInUSD < minAmountUSD;
    
    return disabled;
  }, [localManualAmount, manualTradeAmount, userCurrency, minAmountUSD]);

  const [showZeroBalanceModal, setShowZeroBalanceModal] = useState(false);

  const handleZeroBalanceClick = useCallback(() => {
    setShowZeroBalanceModal(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setShowZeroBalanceModal(false);
  }, []);

  const handleGoToDeposit = useCallback(() => {
    navigate('/deposit');
    setShowZeroBalanceModal(false);
  }, [navigate]);

  return (
    <div className={`trading-controls-panel ${isOverlay ? 'chart-overlay-panel' : ''} ${isDisabled ? 'trading-controls-panel--disabled' : ''}`}>
      <div className={`manual-trading-controls ${isDisabled ? 'manual-trading-controls--disabled' : ''}`}>
        {/* Ряд 1: Инвестиция, Время и Выплата */}
        <div className="mobile-controls-top">
          <div className="control-field manual-trade-amount">
            <label>{t('trading.tradeAmount')}</label>
            <div 
              className="trade-amount-input-wrapper" 
              ref={amountWrapperRef}
              onClick={(e) => {
                if (isMobile || (e.target !== amountInputRef.current && !amountInputRef.current?.contains(e.target as Node))) {
                  handleAmountInputClick(e as any);
                }
              }}
            >
              <div className="input-with-currency">
                <span className="currency-prefix">{getCurrencySymbol(userCurrency)}</span>
                <input
                  ref={amountInputRef}
                  type="number"
                  min="0"
                  max={balanceInUserCurrency}
                  step="0.01"
                  value={localManualAmount}
                  readOnly={isMobile}
                  inputMode={isMobile ? "none" : "decimal"}
                  disabled={isDisabled}
                  onClick={(e) => {
                    // Открываем калькулятор при клике на поле ввода
                    e.stopPropagation();
                    handleAmountInputClick(e);
                  }}
                  onFocus={(e) => {
                    // На десктопе разрешаем обычный фокус для ввода
                    // На мобильных устройствах открываем калькулятор
                    if (isMobile) {
                      handleAmountInputFocus(e);
                    }
                    // На десктопе просто разрешаем фокус - ничего не делаем
                  }}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '' || /^\d*\.?\d*$/.test(value)) {
                      // Разрешаем пустое значение для ввода
                      if (value === '') {
                        setLocalManualAmount('');
                        setManualTradeAmount('');
                        return;
                      }
                      
                      const numValue = parseFloat(value);
                      
                      // Разрешаем ввод 0 и других значений
                      if (isNaN(numValue)) {
                        setLocalManualAmount(value);
                        setManualTradeAmount(value);
                        return;
                      }
                      
                      const amountInUSD = userCurrency === 'USD' 
                        ? numValue 
                        : convertToUSDSync(numValue, userCurrency);
                      
                      // Разрешаем ввод любых значений, включая 0, но проверяем только максимальный баланс
                      // Минимальная сумма будет проверяться при попытке сделать ставку (кнопки будут заблокированы)
                      if (amountInUSD > balanceUSD) {
                        const capped = balanceInUserCurrency.toFixed(2);
                        setLocalManualAmount(capped);
                        setManualTradeAmount(capped);
                      } else {
                        setLocalManualAmount(value);
                        setManualTradeAmount(value);
                      }
                    }
                  }}
                  onBlur={(e) => {
                    const value = e.target.value;
                    
                    // Если поле пустое, устанавливаем 0
                    if (value === '') {
                      setLocalManualAmount('0');
                      setManualTradeAmount('0');
                      return;
                    }
                    
                    const numValue = parseFloat(value);
                    
                    // Если значение невалидно, устанавливаем 0
                    if (isNaN(numValue)) {
                      setLocalManualAmount('0');
                      setManualTradeAmount('0');
                      return;
                    }
                    
                    // Сохраняем значение как введено, без принудительного форматирования
                    // Убираем только лишние нули в конце после точки (например, "56.00" -> "56", но "56.50" -> "56.5")
                    let cleanedValue = value.trim();
                    
                    // Если значение заканчивается на ".00", убираем ".00"
                    if (cleanedValue.endsWith('.00')) {
                      cleanedValue = cleanedValue.replace(/\.00$/, '');
                    } else if (cleanedValue.endsWith('.0') && !cleanedValue.match(/\d\.\d[1-9]/)) {
      // Если заканчивается на ".0" и нет значащих цифр после (например "56.0" но не "56.05")
                      cleanedValue = cleanedValue.replace(/\.0$/, '');
                    }
                    
                    setLocalManualAmount(cleanedValue);
                    setManualTradeAmount(cleanedValue);
                  }}
                  placeholder="100"
                  className="trade-amount-input"
                />
              </div>
            </div>
          </div>
          
          <div className="control-field manual-trade-expiration">
            <label>{t('trading.expirationTime')}</label>
            <div 
              className="expiration-time-advanced" 
              ref={timeWrapperRef}
              onClick={(e) => {
                // Если клик был не по time-display, вызываем обработчик
                if (e.target !== timeDisplayRef.current && !timeDisplayRef.current?.contains(e.target as Node)) {
                  handleTimeDisplayClick(e);
                }
              }}
            >
              <div className="time-arrows">
                <div className="time-with-icon">
                  <span className="time-prefix">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.0" />
                      <path d="M12 7V12L15 14" stroke="currentColor" strokeWidth="1.0" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <div 
                    ref={timeDisplayRef}
                    className="time-display"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTimeDisplayClick(e);
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    {formatHMS(localExpiration)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="control-field manual-trade-payout">
            <label>{t('trading.payout')}</label>
            <div className="payout-display-wrapper">
              <div className="payout-display">
                <span className="payout-currency-icon">
                  <CurrencyIconView
                    iconUrls={iconUrls}
                    label={currencyPairName}
                    fallback={selectedBase}
                    className="payout-currency-icon-view"
                    imageClassName="payout-currency-icon-img"
                    priority="high"
                    isImportant={true}
                  />
                </span>
                <span className="payout-value-text">
                  {formatCurrency(payoutAmountInUserCurrency, userCurrency, { noSpace: true })}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        {isOverlay && (
          <>
            {/* Ряд 2: Выплата, Процент и Прибыль в одну строку для мобильной версии */}
            <div className="profit-payout-row">
            <div className="payout-info-item">
              <div className="payout-label">{t('trading.payout')}</div>
              <div className="payout-value">
                {formatCurrency(payoutAmountInUserCurrency, userCurrency)}
              </div>
            </div>
            <div className="payout-percent-item">
              <div className="payout-percent-label">+{Math.round(profitPercentage || 0)}%</div>
            </div>
            <div className="profit-info-item">
              <div className="profit-label">{t('trading.profit')}</div>
              <div className="profit-value">+{formatCurrency(profitAmountInUserCurrency || 0, userCurrency)}</div>
            </div>
          </div>
          </>
        )}
        
        {/* Кнопки Бай и Селл снизу */}
        {(() => {
          const finalIsDisabled = isDisabled || isAmountDisabled;
          
          return !isOverlay ? (
            /* Кнопки BUY/SELL снизу на ПК версии */
            <TradeButtons
              currentPrice={currentPrice}
              isProcessing={isProcessing}
              handleManualTrade={handleManualTrade}
              setHoveredButton={setHoveredButton}
              isDisabled={finalIsDisabled}
              balance={balanceUSD}
              tradingMode={tradingMode}
              onZeroBalanceClick={handleZeroBalanceClick}
              t={t}
            />
          ) : (
            /* Кнопки Бай и Селл снизу для мобильной версии */
            <TradeButtons
              currentPrice={currentPrice}
              isProcessing={isProcessing}
              handleManualTrade={handleManualTrade}
              setHoveredButton={setHoveredButton}
              isDisabled={finalIsDisabled}
              balance={balanceUSD}
              tradingMode={tradingMode}
              onZeroBalanceClick={handleZeroBalanceClick}
              t={t}
            />
          );
        })()}
      </div>

      {/* Модальное окно о нулевом балансе - рендерим через Portal поверх всего */}
      {showZeroBalanceModal && typeof document !== 'undefined' && createPortal(
        <div className="zero-balance-modal-overlay" onClick={handleCloseModal}>
          <div className="zero-balance-modal" onClick={(e) => e.stopPropagation()}>
            <button 
              className="zero-balance-modal__close"
              onClick={handleCloseModal}
              aria-label="Close"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <div className="zero-balance-modal__content">
              <p className="zero-balance-modal__text">
                {t('trading.zeroBalanceModalText')}
              </p>
              <button
                className="zero-balance-modal__deposit-link"
                onClick={handleGoToDeposit}
                type="button"
              >
                {t('trading.goToDepositPage')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

