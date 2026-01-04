import React, { useState, useEffect, useRef, startTransition, useCallback, useMemo } from 'react';
import { TopPartnersPanel } from './components/TopPartnersPanel';
import { SubscriptionsPanel } from './components/SubscriptionsPanel';
import { ChartHistory } from '@/src/features/charts/ui/components/ChartHistory';
import CandlesCanvas, { CandlesCanvasHandle } from '@/src/features/charts/ui/components/CandlesCanvas';
import './TradingTerminal.css';
import { useLanguage } from '@src/app/providers/useLanguage';
import { useNotification } from '@src/shared/ui/notification';
import backgroundChartImage from '@src/assets/images/backgrounds/background_chart.png';
import { useWebSocket } from '@src/entities/websoket/useWebSocket';
import { getServerTime as getGlobalServerTime } from '@src/shared/lib/serverTime';
import { getTimeframeDurationMs } from '@/src/features/charts/ui/utils';
import {
  PendingTradeData,
  TradeMode,
  type TradeHistoryEntry,
} from './lib/TradeSyncManager';
import { ChartTopBar } from './components/ChartTopBar';
import { ChartToolbar } from './components/ChartToolbar';
import { IndicatorsSidebar } from './components/IndicatorsSidebar';
import { EraserSizeSlider } from './components/EraserSizeSlider';
import { DrawingToolSettings } from './components/DrawingToolSettings';
import { ChartNavigationButton } from './components/ChartNavigationButton';
import { ChartNavigationMenu } from './components/ChartNavigationMenu';
import { ChatPanel } from './components/ChatPanel';
import { TradingControlsPanel } from '@src/widgets/trading-controls-panel/TradingControlsPanel';
import { useCurrencyData } from './hooks/useCurrencyData';
import { useChartControls } from './hooks/useChartControls';
import { useTradingOperations } from './hooks/useTradingOperations';
import { usePriceManagement } from './hooks/usePriceManagement';
import { useTradeForm } from './hooks/useTradeForm';
import { useTradeHistory } from './hooks/useTradeHistory';
import { useWebSocketSubscriptions } from './hooks/useWebSocketSubscriptions';
import { useTradeSync } from './hooks/useTradeSync';
import { useChartReconnection } from './hooks/useChartReconnection';
import { TIMEFRAME_OPTIONS, type ChartViewMode } from './constants/chart';
import { formatPrice, formatPercent, formatHMS, normalizeNumberValue } from './utils/formatUtils';
import { isTradeDemo, renderChartViewIcon } from './utils/chartUtils';
import type { Currency } from '@src/shared/api';
import type { TradeMessage } from '@src/entities/websoket/websocket-types';
import type { TradingTerminalProps } from './types';
import { useAppDispatch, useAppSelector } from '@src/shared/lib/hooks';
import { selectCopyTradingSignalsMenuOpen, selectCopyTradingSubscriptions, selectTopPartnersMenuOpen, selectSubscriptionsMenuOpen } from '@src/entities/copy-trading-signals/model/selectors';
import { setMenuOpen, setTopPartnersMenuOpen, setSubscriptionsMenuOpen } from '@src/entities/copy-trading-signals/model/slice';
import { tradingService } from '@src/entities/trading/services/TradingService';
import { apiClient } from '@src/shared/api';
import { normalizeCurrencyPair } from '@src/shared/lib/currencyPairUtils';
import { convertToUSDSync, convertFromUSDSync } from '@src/shared/lib/currency/exchangeRates';
import { formatCurrency } from '@src/shared/lib/currency/currencyUtils';
import { syntheticQuotesApi } from '@src/shared/api/synthetic-quotes/syntheticQuotesApi';
import { loadCandlesFromCache, saveCandlesToCache } from '@src/shared/lib/utils/candlesCache';
import { createCurrencyPairSymbol } from '@src/shared/lib/currencyPairUtils';
import { AddSignalModal } from '@src/widgets/add-signal-modal/AddSignalModal';
import { TimeCalculator } from '@src/widgets/time-calculator/TimeCalculator';
import { InvestmentCalculator } from '@src/widgets/investment-calculator/InvestmentCalculator';
import { useChatDropdown } from '@src/shared/contexts/ChatDropdownContext';
import { safeLocalStorage } from '@src/shared/lib/utils/localStorage';
import { validateTrade } from '@src/shared/lib/utils/tradeValidation';
import { safeExecute } from '@src/shared/lib/utils/safeError';
import {
  setCurrentPrice,
  setCurrentMarketPrice,
  setPrices,
  setTradeHistory,
  setNewTradesCount,
  addTradeHistory,
  setActiveTrades,
  setSelectedBase,
  setSelectedCurrencyId,
  setQuoteCurrency,
  setTradingMode,
  setSpreadPercent,
  setHoveredButton,
} from '@src/entities/trading/model/slice';
import {
  selectCurrentPrice,
  selectCurrentMarketPrice,
  selectTradingPrices,
  selectTradeHistory,
  selectSelectedBase,
  selectSelectedCurrencyId,
  selectQuoteCurrency,
  selectTradingMode,
  selectTradeHistoryByMode,
  selectActiveTrades,
  selectActiveTradesByMode,
  selectSpreadPercent,
  selectHoveredButton,
} from '@src/entities/trading/model/selectors';

const ChatPanelWrapper: React.FC = () => {
  const { isOpen, closeChat } = useChatDropdown();
  const { t } = useLanguage();
  
  return (
    <ChatPanel
      isOpen={isOpen}
      onClose={closeChat}
      t={t}
    />
  );
};

export const TradingTerminal = (props: TradingTerminalProps) => {
  const { t } = useLanguage();
  const { showError } = useNotification();
  // Используем WebSocket ТОЛЬКО из props (из useTradingWebSocket)
  // Не используем fallback на старый useWebSocket, так как нужен отдельный канал для торговли
  if (!props.sendMessage || !props.onMessage || props.isConnected === undefined) {
    // WebSocket props не переданы
  }
  const wsSendMessage = props.sendMessage!;
  const wsOnMessage = props.onMessage!;
  const isConnected = props.isConnected!;
  const isReady = props.isReady ?? false;
  const dispatch = useAppDispatch();
  
  // Состояние готовности: график загружен и WebSocket подключен
  const [isChartReady, setIsChartReady] = useState<boolean>(false);
  const [isWebSocketReady, setIsWebSocketReady] = useState<boolean>(false);
  const chartReadyRef = useRef<boolean>(false);
  const webSocketReadyRef = useRef<boolean>(false);
  const [loadedCandles, setLoadedCandles] = useState<Array<{ x: number; o: number; h: number; l: number; c: number }>>([]);
  const [chartReloadTrigger, setChartReloadTrigger] = useState<number>(0);
  
  // UI состояние
  const showBaseCurrencyMenuState = useState<boolean>(false);
  const showBaseCurrencyMenu = showBaseCurrencyMenuState[0];
  const setShowBaseCurrencyMenu = showBaseCurrencyMenuState[1];
  const showDurationMenuState = useState<boolean>(false);
  const showDurationMenu = showDurationMenuState[0];
  const setShowDurationMenu = showDurationMenuState[1];
  // Сервер автоматически отправляет кастомные котировки для активных ставок
  // Клиенту не нужно управлять этим - все котировки приходят через один WebSocket
  const {
    chartView,
    setChartView,
    cycleChartView,
    autoFollow,
    setAutoFollow,
    timeframe,
    setTimeframe,
    showIndicatorsMenu,
    setShowIndicatorsMenu,
    activeIndicators,
    toggleIndicator,
  } = useChartControls();
  const [showDrawingToolsMenu, setShowDrawingToolsMenu] = useState(false);
  const [selectedDrawingTool, setSelectedDrawingTool] = useState<'line' | 'freehand' | 'eraser' | 'rectangle' | 'circle' | 'arrow' | 'horizontal' | 'vertical' | 'text' | 'parallel' | 'fibonacci' | 'channel' | 'trendline' | 'zone' | null>(null);
  const [eraserRadius, setEraserRadius] = useState<number>(10);
  const [drawingColor, setDrawingColor] = useState<string>('#ffa500');
  const [drawingLineWidth, setDrawingLineWidth] = useState<number>(2);
  const [selectionMode, setSelectionMode] = useState(false);
  const tradingTerminalRef = useRef<HTMLDivElement | null>(null);
  const mainChartContainerRef = useRef<HTMLDivElement | null>(null);
  
  // Redux селекторы
  const selectedBase = useAppSelector(selectSelectedBase); // Только для отображения
  const selectedCurrencyId = useAppSelector(selectSelectedCurrencyId); // Основной идентификатор
  const tradingMode = useAppSelector(selectTradingMode);
  const currentPrice = useAppSelector(selectCurrentPrice);
  const tradeHistory = useAppSelector(selectTradeHistory);
  const currentMarketPrice = useAppSelector(selectCurrentMarketPrice);
  const showCopyTradingSignalsMenu = useAppSelector(selectCopyTradingSignalsMenuOpen);
  const showTopPartnersMenu = useAppSelector(selectTopPartnersMenuOpen);
  const showSubscriptionsMenu = useAppSelector(selectSubscriptionsMenuOpen);
  const spreadPercent = useAppSelector(selectSpreadPercent);
  const hoveredButton = useAppSelector(selectHoveredButton);
  
  // Получаем состояние чата для взаимного исключения с панелями
  const { isOpen: isChatOpen, closeChat } = useChatDropdown();
  
  // Refs для отслеживания предыдущих состояний
  const prevChatOpenRef = useRef(isChatOpen);
  const prevTopPartnersOpenRef = useRef(showTopPartnersMenu);
  const prevSubscriptionsOpenRef = useRef(showSubscriptionsMenu);
  
  // Взаимное исключение: при открытии чата закрываем панели
  useEffect(() => {
    const chatJustOpened = isChatOpen && !prevChatOpenRef.current;
    if (chatJustOpened) {
      if (showTopPartnersMenu) {
        dispatch(setTopPartnersMenuOpen(false));
      }
      if (showSubscriptionsMenu) {
        dispatch(setSubscriptionsMenuOpen(false));
      }
      // Закрываем другие попапы
      window.dispatchEvent(new CustomEvent('closeLanguageCurrencyModal'));
      window.dispatchEvent(new CustomEvent('closeBonusPopup'));
    }
    prevChatOpenRef.current = isChatOpen;
  }, [isChatOpen, showTopPartnersMenu, showSubscriptionsMenu, dispatch]);
  
  // Взаимное исключение: при открытии панелей закрываем чат и другие панели
  useEffect(() => {
    const topPartnersJustOpened = showTopPartnersMenu && !prevTopPartnersOpenRef.current;
    if (topPartnersJustOpened) {
      if (isChatOpen) {
        closeChat();
      }
      if (showSubscriptionsMenu) {
        dispatch(setSubscriptionsMenuOpen(false));
      }
      // Закрываем другие попапы
      window.dispatchEvent(new CustomEvent('closeLanguageCurrencyModal'));
      window.dispatchEvent(new CustomEvent('closeBonusPopup'));
    }
    prevTopPartnersOpenRef.current = showTopPartnersMenu;
  }, [showTopPartnersMenu, isChatOpen, showSubscriptionsMenu, closeChat, dispatch]);

  useEffect(() => {
    const subscriptionsJustOpened = showSubscriptionsMenu && !prevSubscriptionsOpenRef.current;
    if (subscriptionsJustOpened) {
      if (isChatOpen) {
        closeChat();
      }
      if (showTopPartnersMenu) {
        dispatch(setTopPartnersMenuOpen(false));
      }
      // Закрываем другие попапы
      window.dispatchEvent(new CustomEvent('closeLanguageCurrencyModal'));
      window.dispatchEvent(new CustomEvent('closeBonusPopup'));
    }
    prevSubscriptionsOpenRef.current = showSubscriptionsMenu;
  }, [showSubscriptionsMenu, isChatOpen, showTopPartnersMenu, closeChat, dispatch]);

  // Закрываем сайдбары при получении события
  useEffect(() => {
    const handleCloseSidebars = () => {
      if (showTopPartnersMenu) {
        dispatch(setTopPartnersMenuOpen(false));
      }
      if (showSubscriptionsMenu) {
        dispatch(setSubscriptionsMenuOpen(false));
      }
      if (isChatOpen) {
        closeChat();
      }
    };
    window.addEventListener('closeSidebars', handleCloseSidebars);
    return () => {
      window.removeEventListener('closeSidebars', handleCloseSidebars);
    };
  }, [showTopPartnersMenu, showSubscriptionsMenu, isChatOpen, closeChat, dispatch]);

  
  // Отслеживаем состояние WebSocket
  useEffect(() => {
    const wasReady = webSocketReadyRef.current;
    const nowReady = isConnected === true;
    
    if (nowReady && !wasReady) {
      webSocketReadyRef.current = true;
      setIsWebSocketReady(true);
    } else if (!nowReady && wasReady) {
      webSocketReadyRef.current = false;
      setIsWebSocketReady(false);
    }
  }, [isConnected, selectedBase, timeframe]);
  
  // Котировки начинают приходить сразу после подключения WebSocket
  
  // Хуки для функциональности
  // Refs для хранения актуальных значений
  // ВАЖНО: Refs обновляются СИНХРОННО в теле компонента (не в useEffect),
  // чтобы WebSocket callback всегда имел актуальные значения
  const tradingModeRef = useRef(tradingMode);
  tradingModeRef.current = tradingMode;
  
  const selectedBaseRef = useRef(selectedBase);
  selectedBaseRef.current = selectedBase;
  
  const timeframeRef = useRef(timeframe);
  timeframeRef.current = timeframe;
  
  
  const {
    currencyCategories,
    currenciesLoading,
    selectedCategoryId,
    setSelectedCategoryId,
    favoriteCurrencies,
    setFavoriteCurrencies,
    getCurrencyById,
    setForcedCurrency,
    forcedCurrency,
    resolveCurrencyIconUrls,
    resolveCurrencyAveragePrice,
  } = useCurrencyData();
  
  // Инициализация selectedCurrencyId при первой загрузке валют
  const hasInitializedCurrencyIdRef = useRef(false);
  useEffect(() => {
    // Если валюты загружены и selectedCurrencyId уже установлен - проверяем валидность
    if (
      !currenciesLoading &&
      currencyCategories.length > 0 &&
      selectedCurrencyId &&
      !hasInitializedCurrencyIdRef.current
    ) {
      // Проверяем, что валюта с таким ID существует
      const currency = getCurrencyById(selectedCurrencyId);
      if (currency) {
        console.log('[TradingTerminal] ✅ selectedCurrencyId валиден', {
          currencyId: selectedCurrencyId,
          currency: `${currency.base_currency}_${currency.quote_currency}`
        });
        setForcedCurrency(selectedCurrencyId);
        hasInitializedCurrencyIdRef.current = true;
        return;
      } else {
        console.warn('[TradingTerminal] ⚠️ selectedCurrencyId не найден, сбрасываем', {
          currencyId: selectedCurrencyId
        });
        dispatch(setSelectedCurrencyId(null));
      }
    }
    
    // Если валюты загружены, selectedCurrencyId не установлен, но selectedBase есть - инициализируем
    if (
      !currenciesLoading &&
      currencyCategories.length > 0 &&
      !selectedCurrencyId &&
      !hasInitializedCurrencyIdRef.current &&
      selectedBase
    ) {
      // Ищем валюту по selectedBase (приоритет USDT, затем USD, затем максимальный profit_percentage)
      let foundCurrency: Currency | null = null;
      for (const category of currencyCategories) {
        const list = category.currencies ?? [];
        const matching = list.filter(
          (c) => c.base_currency.toUpperCase() === selectedBase.toUpperCase() && c.is_active
        );
        
        if (matching.length > 0) {
          // Приоритет: USDT > USD > максимальный profit_percentage
          const usdtCurrency = matching.find(c => c.quote_currency === 'USDT');
          if (usdtCurrency) {
            foundCurrency = usdtCurrency;
            break;
          }
          const usdCurrency = matching.find(c => c.quote_currency === 'USD');
          if (usdCurrency) {
            foundCurrency = usdCurrency;
            break;
          }
          foundCurrency = matching.reduce((prev, curr) => {
            const prevProfit = prev.profit_percentage ?? 0;
            const currProfit = curr.profit_percentage ?? 0;
            return currProfit > prevProfit ? curr : prev;
          });
          break;
        }
      }
      
      if (foundCurrency?.id) {
        const currencyId = typeof foundCurrency.id === 'number' ? foundCurrency.id : parseInt(String(foundCurrency.id), 10);
        console.log('[TradingTerminal] Инициализация selectedCurrencyId', {
          selectedBase,
          currencyId,
          currency: `${foundCurrency.base_currency}_${foundCurrency.quote_currency}`
        });
        dispatch(setSelectedCurrencyId(currencyId));
        setForcedCurrency(currencyId);
        hasInitializedCurrencyIdRef.current = true;
      }
    }
  }, [currenciesLoading, currencyCategories, selectedCurrencyId, selectedBase, dispatch, setForcedCurrency, getCurrencyById]);
  
  const handleBaseChange = (base: string, quote?: string) => {
    // Находим валюту по base+quote и устанавливаем её ID
    let currencyId: number | null = null;
    if (quote) {
      for (const category of currencyCategories) {
        const list = category.currencies ?? [];
        const found = list.find(
          (c) => 
            c.base_currency.toUpperCase() === base.toUpperCase() && 
            c.quote_currency.toUpperCase() === quote.toUpperCase() && 
            c.is_active
        );
        if (found?.id) {
          currencyId = typeof found.id === 'number' ? found.id : parseInt(String(found.id), 10);
          break;
        }
      }
    }
    
    if (currencyId) {
      dispatch(setSelectedCurrencyId(currencyId));
      setForcedCurrency(currencyId);
    }
    
    // Обновляем selectedBase только для отображения symbol
    dispatch(setSelectedBase(base));
    props.onBaseChange(base);
  };
  const userCurrency = 'USD'; // UserProfile не содержит поле currency
  const balance = props.balance || 0;
  const [isAddSignalModalOpen, setIsAddSignalModalOpen] = useState(false);
  const [showTimeCalculator, setShowTimeCalculator] = useState(false);
  const [timeCalculatorPosition, setTimeCalculatorPosition] = useState<{ left: number; top: number }>({ left: 259, top: 175 });
  const [showInvestmentCalculator, setShowInvestmentCalculator] = useState(false);
  const [investmentCalculatorPosition, setInvestmentCalculatorPosition] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  const [isChartNarrow, setIsChartNarrow] = useState(false);
  const [isChartNavigationMenuOpen, setIsChartNavigationMenuOpen] = useState(false);
  
  // Функция для вычисления позиции калькулятора внутри графика
  // СТРОГО ограничивает калькулятор границами chart-section-wrapper
  const calculateCalculatorPosition = useCallback((inputPosition: { left: number; top: number }, calculatorWidth: number) => {
    // Используем requestAnimationFrame для получения актуальных размеров после рендера
    return new Promise<{ left: number; top: number }>((resolve) => {
      requestAnimationFrame(() => {
        const chartContainer = mainChartContainerRef.current;
        if (!chartContainer) {
          console.warn('[TradingTerminal] chartContainer не найден, используем позицию по умолчанию');
          resolve({ left: 16, top: 16 });
          return;
        }
        
        // Получаем границы контейнера относительно viewport
        const wrapperRect = chartContainer.getBoundingClientRect();
        
        // inputPosition содержит координаты относительно viewport (из getBoundingClientRect)
        // Преобразуем их в координаты относительно chart-section-wrapper
        // Важно: используем scrollLeft и scrollTop для учета прокрутки
        const scrollLeft = chartWrapper.scrollLeft || 0;
        const scrollTop = chartWrapper.scrollTop || 0;
        
        const inputRelativeLeft = inputPosition.left - wrapperRect.left + scrollLeft;
        const inputRelativeTop = inputPosition.top - wrapperRect.top + scrollTop;
        
        console.log('[TradingTerminal] Вычисление позиции калькулятора', {
          inputPosition,
          wrapperRect: { 
            left: wrapperRect.left, 
            top: wrapperRect.top, 
            width: wrapperRect.width, 
            height: wrapperRect.height 
          },
          scrollLeft,
          scrollTop,
          inputRelativeLeft,
          inputRelativeTop,
          calculatorWidth
        });
        
        // Определяем, узкий ли график
        const narrow = wrapperRect.width < 600;
        setIsChartNarrow(narrow);
        
        // СТРОГИЕ ОГРАНИЧЕНИЯ: калькулятор НЕ ДОЛЖЕН выходить за границы wrapper
        const rightMargin = 16;
        const leftMargin = 16;
        const topMargin = 16;
        const bottomMargin = 16;
        const calculatorHeight = 350; // Реальная высота калькулятора
        
        // Максимально допустимые значения
        const maxLeft = wrapperRect.width - calculatorWidth - rightMargin;
        const maxTop = wrapperRect.height - calculatorHeight - bottomMargin;
        
        // Позиция по X: прижимаем к правой части графика, НО СТРОГО внутри границ
        let finalLeft: number;
        if (narrow) {
          // Для узких графиков - слева
          finalLeft = leftMargin;
        } else {
          // Для широких графиков - справа от инпута или справа от графика
          // Пытаемся разместить слева от инпута
          finalLeft = inputRelativeLeft - calculatorWidth - 16;
          // Если не помещается слева, размещаем справа
          if (finalLeft < leftMargin) {
            finalLeft = Math.min(inputRelativeLeft + 200, maxLeft);
          }
        }
        
        // ЖЕСТКАЯ ПРОВЕРКА: калькулятор должен быть полностью внутри wrapper
        finalLeft = Math.max(leftMargin, Math.min(finalLeft, maxLeft));
        
        // Позиция по Y: выравниваем по высоте инпута, НО СТРОГО внутри границ
        let finalTop = Math.max(topMargin, Math.min(inputRelativeTop, maxTop));
        
        // Если калькулятор не помещается по вертикали, размещаем выше инпута
        if (finalTop + calculatorHeight > wrapperRect.height - bottomMargin) {
          finalTop = Math.max(topMargin, inputRelativeTop - calculatorHeight - 16);
          // Если все еще не помещается, центрируем вертикально
          if (finalTop < topMargin) {
            finalTop = Math.max(topMargin, (wrapperRect.height - calculatorHeight) / 2);
          }
        }
        
        // Финальная проверка границ
        finalLeft = Math.max(leftMargin, Math.min(finalLeft, maxLeft));
        finalTop = Math.max(topMargin, Math.min(finalTop, maxTop));
        
        const result = { left: finalLeft, top: finalTop };
        console.log('[TradingTerminal] Финальная позиция калькулятора', {
          result,
          wrapperSize: { width: wrapperRect.width, height: wrapperRect.height },
          calculatorSize: { width: calculatorWidth, height: calculatorHeight },
          fits: finalLeft + calculatorWidth <= wrapperRect.width && finalTop + calculatorHeight <= wrapperRect.height
        });
        
        resolve(result);
      });
    });
  }, []);
  
  // Функция для вычисления позиции калькулятора инвестиций внутри графика
  // Калькулятор должен быть слева на графике, прижат к правой стенке графика, выровнен по высоте с инпутом
  const calculateInvestmentCalculatorPosition = useCallback((inputPosition: { left: number; top: number }, calculatorWidth: number) => {
    return new Promise<{ left: number; top: number }>((resolve) => {
      requestAnimationFrame(() => {
        const chartContainer = mainChartContainerRef.current;
        if (!chartContainer) {
          console.warn('[TradingTerminal] chart-section-wrapper не найден, используем позицию по умолчанию');
          resolve({ left: 16, top: 16 });
          return;
        }
        
        const wrapperRect = chartContainer.getBoundingClientRect();
        const scrollLeft = chartContainer.scrollLeft || 0;
        const scrollTop = chartContainer.scrollTop || 0;
        
        // Преобразуем координаты инпута в координаты относительно графика
        const inputRelativeTop = inputPosition.top - wrapperRect.top + scrollTop;
        
        // Позиция по X: прижимаем к правой стенке графика (не правее)
        const rightMargin = 16;
        const finalLeft = wrapperRect.width - calculatorWidth - rightMargin;
        
        // Позиция по Y: выравниваем по высоте инпута
        const topMargin = 16;
        const calculatorHeight = 400; // Примерная высота калькулятора
        const maxTop = wrapperRect.height - calculatorHeight - topMargin;
        let finalTop = Math.max(topMargin, Math.min(inputRelativeTop, maxTop));
        
        // Если калькулятор не помещается по вертикали, размещаем выше
        if (finalTop + calculatorHeight > wrapperRect.height - topMargin) {
          finalTop = Math.max(topMargin, inputRelativeTop - calculatorHeight - 16);
          if (finalTop < topMargin) {
            finalTop = Math.max(topMargin, (wrapperRect.height - calculatorHeight) / 2);
          }
        }
        
        resolve({ left: finalLeft, top: finalTop });
      });
    });
  }, []);

  // Обработчик открытия TimeCalculator
  const handleTimeCalculatorOpen = useCallback(async (position: { left: number; top: number }) => {
    // Сначала открываем калькулятор (чтобы он был в DOM для вычисления размеров)
    setShowTimeCalculator(true);
    
    // Также вызываем оригинальный обработчик из props, если он есть (для обратной совместимости)
    if (props.onTimeCalculatorOpen) {
      props.onTimeCalculatorOpen(position);
    }
    
    // Вычисляем позицию внутри графика: слева на графике, прижат к правой стенке, выровнен по высоте с инпутом
    const calculatorWidth = 320; // Ширина TimeCalculator (такая же как у InvestmentCalculator)
    const calculatedPosition = await calculateInvestmentCalculatorPosition(position, calculatorWidth);
    setTimeCalculatorPosition(calculatedPosition);
  }, [calculateInvestmentCalculatorPosition, props]);

  // Обработчик открытия InvestmentCalculator
  const handleInvestmentCalculatorOpen = useCallback(async (position: { left: number; top: number }) => {
    // Открываем калькулятор
    setShowInvestmentCalculator(true);
    
    // Вычисляем позицию внутри графика: слева на графике, прижат к правой стенке, выровнен по высоте с инпутом
    const calculatorWidth = 320; // Ширина InvestmentCalculator
    const calculatedPosition = await calculateInvestmentCalculatorPosition(position, calculatorWidth);
    setInvestmentCalculatorPosition(calculatedPosition);
  }, [calculateInvestmentCalculatorPosition]);
  
  // Убираем useEffect с глобальным обработчиком, так как используем прямой вызов через props
  
  // Открываем модалку при вызове onOpenAddSignalModal
  useEffect(() => {
    if (props.onOpenAddSignalModal) {
      // Переопределяем функцию, чтобы она открывала модалку в TradingTerminal
      const originalFn = props.onOpenAddSignalModal;
      // Сохраняем функцию открытия в глобальный объект для доступа из TradingPage
      (window as any).__tradingTerminalOpenAddSignalModal = () => {
        setIsAddSignalModalOpen(true);
      };
    }
    return () => {
      delete (window as any).__tradingTerminalOpenAddSignalModal;
    };
  }, [props.onOpenAddSignalModal]);
  
  // Сохраняем handleTimeCalculatorOpen в глобальный объект для доступа из десктоп TradingControlsPanel
  useEffect(() => {
    (window as any).__tradingTerminalOpenTimeCalculator = (position: { left: number; top: number }) => {
      handleTimeCalculatorOpen(position);
    };
    return () => {
      delete (window as any).__tradingTerminalOpenTimeCalculator;
    };
  }, [handleTimeCalculatorOpen]);

  // Глобальная функция для открытия сайдбара с данными сделки
  useEffect(() => {
    (window as any).__tradingTerminalOpenTradeSidebar = (trade: any) => {
      if (chartHandleRef.current?.openTradeSidebar) {
        chartHandleRef.current.openTradeSidebar(trade);
      }
    };
    return () => {
      delete (window as any).__tradingTerminalOpenTradeSidebar;
    };
  }, []);

  // Сохраняем handleInvestmentCalculatorOpen в глобальный объект для доступа из TradingControlsPanel
  useEffect(() => {
    (window as any).__tradingTerminalOpenInvestmentCalculator = (position: { left: number; top: number }) => {
      handleInvestmentCalculatorOpen(position);
    };
    return () => {
      delete (window as any).__tradingTerminalOpenInvestmentCalculator;
    };
  }, [handleInvestmentCalculatorOpen]);
  
  // Вычисление высоты интерфейса ставок для отступа графика
  const [tradingControlsHeight, setTradingControlsHeight] = useState<number>(0);
  const tradingControlsRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
      const updateHeight = () => {
        if (tradingControlsRef.current) {
          const height = tradingControlsRef.current.offsetHeight;
          // Вычисляем отступ так, чтобы активная область свечей заканчивалась ровно над панелью
          // Получаем позицию панели относительно контейнера графика
          const chartSectionWrapper = tradingControlsRef.current.closest('.chart-section-wrapper');
          let newHeight = 0;
          
          if (chartSectionWrapper && tradingControlsRef.current) {
            const wrapperRect = chartSectionWrapper.getBoundingClientRect();
            const panelRect = tradingControlsRef.current.getBoundingClientRect();
            // Вычисляем расстояние от верха контейнера до начала панели
            const panelTop = panelRect.top - wrapperRect.top;
            // bottomPadding должен быть таким, чтобы chartAreaHeight = panelTop
            // Если height контейнера = 624px, а панель на top=457px, то:
            // chartAreaHeight = panelTop = 457px
            // bottomPadding = wrapperHeight - panelTop = 624 - 457 = 167px
            const wrapperHeight = wrapperRect.height;
            newHeight = panelTop > 0 && wrapperHeight > 0 ? wrapperHeight - panelTop : (height > 0 ? height : 0);
          } else {
            // Fallback: используем высоту панели, если не удалось вычислить позицию
            newHeight = height > 0 ? height : 0;
          }
          
          setTradingControlsHeight(newHeight);
          
          // Устанавливаем CSS переменную для адаптивного позиционирования chart-top-bar-inner
          if (chartSectionWrapper) {
            (chartSectionWrapper as HTMLElement).style.setProperty('--trading-controls-panel-height', `${height}px`);
          }
        } else {
        }
      };
    
    // Задержка для того, чтобы элемент успел отрендериться
    const timeoutId = setTimeout(() => {
      updateHeight();
    }, 100);
    updateHeight();
    
    const resizeObserver = new ResizeObserver((entries) => {
      updateHeight();
    });
    if (tradingControlsRef.current) {
      resizeObserver.observe(tradingControlsRef.current);
    }
    
    return () => {
      clearTimeout(timeoutId);
      resizeObserver.disconnect();
    };
  }, []);
  
  // Хук для управления формой торговли
  const {
    manualTradeAmount,
    updateManualTradeAmount,
    manualTradeAmountRef,
    expirationSeconds,
    setExpirationSeconds: setExpirationSecondsWithRef,
    expirationSecondsRef,
    parsedExpiration,
    changeExpiration,
    quickPresets,
  } = useTradeForm(userCurrency, balance);

  const formatPriceWithBase = useCallback((price: number | string | null | undefined) => {
    return formatPrice(price, selectedBase);
  }, [selectedBase]);
  
  // Хук для управления ценами
  const {
    handlePriceUpdate,
  } = usePriceManagement({
    tradingMode,
    spreadPercent,
    setSpreadPercent: (value: number) => dispatch(setSpreadPercent(value)),
  });
  const ohlcTickerState = useState<{ open: number; high: number; low: number; close: number; timestamp: number } | null>(null);
  const setOhlcTicker = ohlcTickerState[1];
  const last15sBucketRef = useRef<number | null>(null);
  const current15sCandleRef = useRef<{ open: number; high: number; low: number; close: number; timestamp: number } | null>(null);
  const ohlcTickerUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!showIndicatorsMenu) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowIndicatorsMenu(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showIndicatorsMenu, setShowIndicatorsMenu]);

  const lastTradeState = useState<{
    price: number;
    currentPriceAtTrade: number;
    direction: 'buy' | 'sell';
    amount: number;
    timestamp: number;
  } | null>(null);
  const setLastTrade = lastTradeState[1];
  
  // Хук для истории сделок
  const {
    isLoadingMoreHistory,
    hasMoreHistory,
    loadMoreTradeHistory,
    setTradeHistoryNonBlocking,
    tradesCacheRef,
  } = useTradeHistory(tradingMode);

  const getCurrentPriceFromChartRef = useRef<(() => number | null) | null>(null);
  const chartHandleRef = useRef<CandlesCanvasHandle | any>(null);
  const tradeHistoryRef = useRef<TradeHistoryEntry[]>([]);
  const autoFollowTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingTradeDataRef = useRef<PendingTradeData | null>(null);
  
  useEffect(() => {
    tradeHistoryRef.current = tradeHistory;
  }, [tradeHistory, tradingMode]);
  
  
  // Управление hoveredButton через Redux
  const setHoveredButtonCallback = useCallback((button: 'buy' | 'sell' | null) => {
    dispatch(setHoveredButton(button));
  }, [dispatch]);
  
  // Используем глобальный сервис времени для единообразия
  const getServerTime = useCallback(() => {
    return getGlobalServerTime();
  }, []);
  
  const handle15sPriceUpdate = useCallback((data: {
    open: number;
    high: number;
    low: number;
    close: number;
    timestamp?: number;
  }) => {
    try {
      // Обновляем цену в Redux через handlePriceUpdate
      handlePriceUpdate(data);
      if (timeframe !== '15s') {
        last15sBucketRef.current = null;
        current15sCandleRef.current = null;
        setOhlcTicker(null);
        return;
      }

      const ts = data.timestamp ?? getServerTime();
      const bucket = Math.floor(ts / 15000);
      const bucketStart = bucket * 15000;

      if (last15sBucketRef.current === null || last15sBucketRef.current !== bucket) {
        last15sBucketRef.current = bucket;
        current15sCandleRef.current = {
          open: data.open,
          high: data.high,
          low: data.low,
          close: data.close,
          timestamp: bucketStart,
        };
        if (ohlcTickerUpdateTimeoutRef.current) {
          clearTimeout(ohlcTickerUpdateTimeoutRef.current);
        }
        setOhlcTicker({ ...current15sCandleRef.current });
      } else {
        if (current15sCandleRef.current) {
          current15sCandleRef.current.high = Math.max(current15sCandleRef.current.high, data.high);
          current15sCandleRef.current.low = Math.min(current15sCandleRef.current.low, data.low);
          current15sCandleRef.current.close = data.close;
          
          if (ohlcTickerUpdateTimeoutRef.current) {
            clearTimeout(ohlcTickerUpdateTimeoutRef.current);
          }
          ohlcTickerUpdateTimeoutRef.current = setTimeout(() => {
            if (current15sCandleRef.current) {
              setOhlcTicker({ ...current15sCandleRef.current });
            }
          }, 100);
        }
      }
    } catch (error) {
      console.error('[TRADING_TERMINAL] ❌ Ошибка обработки синтетической котировки', {
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : String(error),
        data: data
      });
    }
  }, [getServerTime, handlePriceUpdate, timeframe, isChartReady, isWebSocketReady]);
  
  const handleUserInteraction = useCallback(() => {
    if (autoFollowTimeoutRef.current) {
      clearTimeout(autoFollowTimeoutRef.current);
      autoFollowTimeoutRef.current = null;
    }
    
    if (autoFollow && chartHandleRef.current) {
      autoFollowTimeoutRef.current = setTimeout(() => {
        if (autoFollow && chartHandleRef.current) {
          if (chartHandleRef.current.resetUserInteractionAndFollow) {
            chartHandleRef.current.resetUserInteractionAndFollow();
          } else if (chartHandleRef.current.setFollowPrice) {
            chartHandleRef.current.setFollowPrice(true);
            if (chartHandleRef.current.stickToRight) {
              chartHandleRef.current.stickToRight();
            }
          }
        }
      }, 20000);
    }
  }, [autoFollow]);
  
  useEffect(() => {
    if (!autoFollow) {
      if (autoFollowTimeoutRef.current) {
        clearTimeout(autoFollowTimeoutRef.current);
        autoFollowTimeoutRef.current = null;
      }
      return;
    }
    
    if (chartHandleRef.current && chartHandleRef.current.setFollowPrice) {
      chartHandleRef.current.setFollowPrice(true);
    }
    
    return () => {
      if (autoFollowTimeoutRef.current) {
        clearTimeout(autoFollowTimeoutRef.current);
      }
    };
  }, [autoFollow]);
  
  // Смещение времени сервера для синхронизации с WebSocket сообщениями
  const serverTimeOffsetRef = useRef<number>(0);
  const previousServerTimeOffsetRef = useRef<number>(0);

  const adjustTimesForServerOffset = (offsetDelta: number) => {
    if (!offsetDelta) {
      return;
    }

    (['manual', 'demo'] as TradeMode[]).forEach(mode => {
      const cache = tradesCacheRef.current[mode];
      if (cache.tradeHistory.length > 0) {
        cache.tradeHistory = cache.tradeHistory.map(entry => ({
          ...entry,
          createdAt: entry.createdAt + offsetDelta,
          completedAt: entry.completedAt + offsetDelta
        }));
      }
    });

    if (pendingTradeDataRef.current) {
      pendingTradeDataRef.current = {
        ...pendingTradeDataRef.current,
        createdAt: (pendingTradeDataRef.current.createdAt ?? 0) + offsetDelta
      };
    }
  };

  
  // Получаем вычисленные цены из Redux
  const { price1, price2, priceDiff, priceDiffPercent } = useAppSelector(selectTradingPrices);


  // Закрываем дропдауны при клике вне их
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.base-currency-selector')) {
        setShowBaseCurrencyMenu(false);
      }
      if (!target.closest('.duration-selector')) {
        setShowDurationMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Закрываем панели при переходе на другую вкладку браузера
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (showTopPartnersMenu) {
          dispatch(setTopPartnersMenuOpen(false));
        }
        if (showSubscriptionsMenu) {
          dispatch(setSubscriptionsMenuOpen(false));
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [showTopPartnersMenu, showSubscriptionsMenu, dispatch]);

  // Периодическое обновление цены из графика в Redux для активных сделок
  useEffect(() => {
    if (!chartHandleRef.current?.getAnimatedPrice) {
      return;
    }

    const updatePriceFromChart = () => {
      try {
        const chartPrice = chartHandleRef.current?.getAnimatedPrice?.();
        if (chartPrice && chartPrice > 0 && Number.isFinite(chartPrice)) {
          // ВАЖНО: НЕ обновляем currentMarketPrice здесь!
          // currentMarketPrice должна обновляться ТОЛЬКО из WebSocket сообщений (custom_quote),
          // чтобы она всегда была актуальной рыночной ценой для расчета выигрыша/проигрыша
          startTransition(() => {
            dispatch(setCurrentPrice(chartPrice));
            // НЕ обновляем currentMarketPrice - она обновляется только из WebSocket!
          });
        }
      } catch (error) {
        // Игнорируем ошибки при обновлении цены
      }
    };

    // Обновляем цену каждые 200ms для плавной реакции активных сделок
    const intervalId = setInterval(updatePriceFromChart, 200);

    return () => {
      clearInterval(intervalId);
    };
  }, [dispatch, chartHandleRef]);

  // Хук для торговых операций
  const { handleManualTrade } = useTradingOperations({
    wsSendMessage,
    manualTradeAmountRef,
    expirationSecondsRef,
    timeframe,
    userProfile: props.userProfile,
    balance: props.balance,
    chartHandleRef,
    getCurrencyById,
    getPriceFromChart: useCallback(() => {
      console.log('[TRADE_PLACEMENT] getPriceFromChart вызван', {
        hasChartHandle: !!chartHandleRef.current,
        hasGetAnimatedPrice: !!chartHandleRef.current?.getAnimatedPrice,
        loadedCandlesLength: loadedCandles?.length || 0,
        loadedCandles: loadedCandles?.slice(-3) // Последние 3 свечи для отладки
      });

      // Сначала пытаемся получить цену из графика через getAnimatedPrice
      if (chartHandleRef.current?.getAnimatedPrice) {
        try {
          const chartPrice = chartHandleRef.current.getAnimatedPrice();
          console.log('[TRADE_PLACEMENT] getAnimatedPrice результат', {
            chartPrice,
            isValid: chartPrice && chartPrice > 0 && Number.isFinite(chartPrice)
          });
          if (chartPrice && chartPrice > 0 && Number.isFinite(chartPrice)) {
            return chartPrice;
          }
        } catch (error) {
          console.error('[TRADE_PLACEMENT] Ошибка при вызове getAnimatedPrice', error);
        }
      } else {
        console.log('[TRADE_PLACEMENT] getAnimatedPrice недоступен', {
          hasChartHandle: !!chartHandleRef.current,
          hasMethod: !!chartHandleRef.current?.getAnimatedPrice
        });
      }

      // Fallback: получаем цену из последней загруженной свечи
      console.log('[TRADE_PLACEMENT] Пытаемся получить цену из loadedCandles', {
        hasLoadedCandles: !!loadedCandles,
        length: loadedCandles?.length || 0
      });
      
      if (loadedCandles && loadedCandles.length > 0) {
        const lastCandle = loadedCandles[loadedCandles.length - 1];
        console.log('[TRADE_PLACEMENT] Последняя свеча из loadedCandles', {
          lastCandle,
          hasClose: !!lastCandle?.c,
          closePrice: lastCandle?.c,
          isValid: lastCandle && lastCandle.c && lastCandle.c > 0 && Number.isFinite(lastCandle.c)
        });
        
        if (lastCandle && lastCandle.c && lastCandle.c > 0 && Number.isFinite(lastCandle.c)) {
          console.log('[TRADE_PLACEMENT] ✅ Цена получена из loadedCandles:', lastCandle.c);
          return lastCandle.c;
        }
      } else {
        console.log('[TRADE_PLACEMENT] ❌ loadedCandles пуст или не определен');
      }
      
      console.log('[TRADE_PLACEMENT] ❌ Все методы получения цены не дали результата');
      return null;
    }, [loadedCandles]),
  });

  // Сохраняем getPriceFromChart в глобальный объект для доступа из CopyTradingSignalsList
  useEffect(() => {
    const getPriceFromChartFn = () => {
      // Сначала пытаемся получить цену из графика через getAnimatedPrice
      if (chartHandleRef.current?.getAnimatedPrice) {
        try {
          const chartPrice = chartHandleRef.current.getAnimatedPrice();
          if (chartPrice && chartPrice > 0 && Number.isFinite(chartPrice)) {
            return chartPrice;
          }
        } catch (error) {
          console.error('[TRADE_PLACEMENT] Ошибка при вызове getAnimatedPrice', error);
        }
      }
      
      // Fallback: пытаемся получить из последней свечи
      if (loadedCandles && loadedCandles.length > 0) {
        const lastCandle = loadedCandles[loadedCandles.length - 1];
        if (lastCandle && lastCandle.c && lastCandle.c > 0 && Number.isFinite(lastCandle.c)) {
          return lastCandle.c;
        }
      }
      
      return null;
    };
    
    (window as any).__tradingTerminalGetPriceFromChart = getPriceFromChartFn;
    return () => {
      delete (window as any).__tradingTerminalGetPriceFromChart;
    };
  }, [chartHandleRef, loadedCandles]);

  // Хук для синхронизации сделок
  const processedExpiredTradesRef = useRef<Set<string>>(new Set());
  const setLastTradeNonBlocking = useCallback((updater: React.SetStateAction<{
    price: number;
    currentPriceAtTrade: number;
    direction: 'buy' | 'sell';
    amount: number;
    timestamp: number;
  } | null>) => {
    startTransition(() => {
      setLastTrade(updater);
    });
  }, []);

  const {
    tradeSyncManagerRef,
    requestTradeHistory,
  } = useTradeSync({
    userProfile: props.userProfile,
    tradesCacheRef,
    pendingTradeDataRef,
    processedExpiredTradesRef,
    setTradeHistoryNonBlocking,
    setLastTradeNonBlocking,
    chartHandleRef,
    wsSendMessage,
    wsOnMessage,
    isConnected,
    handleTradesWithRigging: useCallback((trades: any[]) => {
      if (trades.length > 0 && wsSendMessage) {
        const currencyIds = new Set<number>();
        trades.forEach((trade: any) => {
          // Получаем id из сделки или ищем по символу
          let currencyId: number | undefined = trade.id;
          
          if (!currencyId && trade.symbol) {
            // Парсим символ (например, "BTC_USDT" -> base="BTC", quote="USDT")
            const symbol = trade.symbol.replace(/[^a-zA-Z0-9_]/g, '').toUpperCase();
            const parts = symbol.split('_');
            if (parts.length === 2) {
              const [base, quote] = parts;
              // Ищем валюту по base_currency и quote_currency
              for (const category of currencyCategories) {
                const list = category.currencies ?? [];
                const found = list.find(
                  (c) => c.base_currency === base && c.quote_currency === quote
                );
                if (found?.id) {
                  currencyId = found.id;
                  break;
                }
              }
              // Работаем только по ID - если ID не найден, пропускаем
            }
          }
          // Работаем только по ID - если ID не найден, пропускаем
          
          // Validate currencyId before adding to set
          if (currencyId) {
            const currencyIdNum = typeof currencyId === 'number' ? currencyId : Number(currencyId);
            if (Number.isInteger(currencyIdNum) && currencyIdNum > 0) {
              currencyIds.add(currencyIdNum);
            } else {
              console.warn('[TradingTerminal] Invalid currency ID for subscription:', {
                currencyId,
                currencyIdType: typeof currencyId,
                tradeSymbol: trade.symbol,
                tradeBaseCurrency: trade.baseCurrency
              });
            }
          }
        });
        
        currencyIds.forEach(currencyId => {
          // Double-check validation before subscribing
          const currencyIdNum = typeof currencyId === 'number' ? currencyId : Number(currencyId);
          if (!Number.isInteger(currencyIdNum) || currencyIdNum <= 0) {
            console.warn('[TradingTerminal] Skipping invalid currency ID:', currencyId);
            return;
          }
          
          const key = `currency_${currencyIdNum}`;
          if (!customQuotesSubscribedRef.current.has(key)) {
            try {
              wsSendMessage({ type: 'subscribe-custom-quotes', id: currencyIdNum, timeframe } as any);
              customQuotesSubscribedRef.current.add(key);
            } catch (error) {
              console.error('[TradingTerminal] Ошибка подписки на котировки для сделки:', error);
            }
          }
        });
      }
    }, [wsSendMessage, timeframe, currencyCategories]),
  });

  // Запрос данных при монтировании компонента
  // Запрос данных при монтировании компонента через HTTP (не WebSocket!)
  useEffect(() => {
    // Запрашиваем данные через HTTP, если есть userId и режим manual/demo
    if (props.userProfile?.id && (tradingMode === 'manual' || tradingMode === 'demo')) {
      // Запрашиваем историю сделок через HTTP используя apiClient и dispatch напрямую
      (async () => {
        try {
          const params = new URLSearchParams({
            limit: '50',
            offset: '0',
          });
          params.append('mode', tradingMode);
          
          const response = await apiClient<{ trades: any[]; count: number; newTradesCount?: number }>(
            `/trading/history?${params.toString()}`
          );
          
          const tradesData = response?.data?.trades || response?.trades;
          const newTradesCount = response?.data?.newTradesCount ?? response?.newTradesCount ?? 0;
          
          // Сохраняем счетчик новых сделок
          dispatch(setNewTradesCount(newTradesCount));
          
          if (tradesData && Array.isArray(tradesData)) {
            const transformedTrades: TradeHistoryEntry[] = tradesData.map((trade: any) => {
              const isDemo = trade.isDemo === true || trade.is_demo === true;
              return {
                id: String(trade.id ?? ''),
                price: trade.price ?? trade.entryPrice ?? 0,
                direction: trade.direction,
                amount: trade.amount ?? 0,
                entryPrice: trade.entryPrice ?? trade.price ?? 0,
                exitPrice: trade.exitPrice ?? trade.price ?? 0,
                profit: trade.profit ?? 0,
                profitPercent: trade.profitPercent ?? trade.profit_percent ?? 0,
                isWin: trade.isWin ?? trade.is_win ?? false,
                createdAt: typeof trade.createdAt === 'number' 
                  ? trade.createdAt 
                  : (trade.created_at ? (typeof trade.created_at === 'number' ? trade.created_at : new Date(trade.created_at).getTime()) : Date.now()),
                completedAt: typeof trade.completedAt === 'number' && trade.completedAt > 0
                  ? trade.completedAt
                  : (trade.completed_at ? (typeof trade.completed_at === 'number' && trade.completed_at > 0 ? trade.completed_at : (trade.completed_at ? new Date(trade.completed_at).getTime() : null)) : null),
                expirationTime: typeof trade.expirationTime === 'number'
                  ? trade.expirationTime
                  : (trade.expiration_time ? (typeof trade.expiration_time === 'number' ? trade.expiration_time : new Date(trade.expiration_time).getTime()) : null),
                symbol: trade.symbol ?? trade.pair ?? null,
                baseCurrency: trade.baseCurrency ?? trade.base_currency ?? null,
                quoteCurrency: trade.quoteCurrency ?? trade.quote_currency ?? null,
                isDemo: isDemo,
                is_demo: trade.is_demo ?? isDemo,
                is_copied: trade.is_copied ?? trade.isCopied ?? false,
                copy_subscription_id: trade.copy_subscription_id ?? trade.copySubscriptionId ?? null,
                copied_from_user_id: trade.copied_from_user_id ?? trade.copiedFromUserId ?? null,
              };
            });
            
            const sortedTrades = transformedTrades.sort((a, b) => b.completedAt - a.completedAt);
            dispatch(setTradeHistory(sortedTrades));
          }
        } catch (error) {
          console.error('[TRADE_HISTORY] Ошибка HTTP запроса истории:', error);
        }
      })();
      
      // Запрашиваем активные сделки через HTTP и обновляем Redux напрямую
      // serverTime из ответа уже используется для синхронизации в requestActiveTrades
      tradingService.requestActiveTrades(tradingMode).then((activeTrades) => {
        // Время обновляется автоматически через useTime() hook - использует UTC напрямую
        
        if (activeTrades.length > 0) {
          dispatch(setActiveTrades(activeTrades));
        }
      }).catch((error) => {
        console.error('[TRADE_HISTORY] Ошибка HTTP запроса активных сделок:', error);
      });
    }
  }, [tradingMode, props.userProfile?.id, dispatch]);

  // Хук для переподключения графика
  // Используем selectedCurrencyId или forcedCurrency
  const currencyIdForReconnect = forcedCurrency || selectedCurrencyId;
  
  useChartReconnection({
    wsSendMessage,
    isConnected,
    selectedBase,
    timeframe,
    currentPrice,
    currencyId: currencyIdForReconnect,
    onReconnect: useCallback(() => {
    }, []),
    onReloadData: useCallback(() => {
      setChartReloadTrigger(prev => prev + 1);
    }, []),
  });

  // Хук для WebSocket подписок
  const activeTrades = useAppSelector(selectActiveTradesByMode);
  // Для отслеживания маркеров используем ВСЕ активные сделки (независимо от режима)
  const allActiveTrades = useAppSelector(selectActiveTrades);
  
  // Отслеживаем изменения активных сделок и удаляем маркеры только для действительно завершенных сделок
  const prevAllActiveTradesRef = useRef<typeof allActiveTrades>([]);
  useEffect(() => {
    if (chartHandleRef.current?.removeBetMarkerByTradeId) {
      const prevTradeIds = new Set(prevAllActiveTradesRef.current.map(t => t.id));
      const currentTradeIds = new Set(allActiveTrades.map(t => t.id));
      const now = Date.now();
      
      // Находим сделки, которые были удалены из ВСЕХ активных сделок
      prevTradeIds.forEach(tradeId => {
        if (!currentTradeIds.has(tradeId)) {
          // Проверяем, действительно ли сделка истекла, а не просто была отфильтрована по режиму
          const prevTrade = prevAllActiveTradesRef.current.find(t => t.id === tradeId);
          if (prevTrade && prevTrade.expirationTime) {
            const expirationTime = prevTrade.expirationTime < 1e12 
              ? prevTrade.expirationTime * 1000 
              : prevTrade.expirationTime;
            
            // Удаляем маркер только если сделка действительно истекла
            if (expirationTime <= now) {
              chartHandleRef.current?.removeBetMarkerByTradeId?.(tradeId);
              console.log('[TradingTerminal] Маркер удален для завершенной сделки', { tradeId, expirationTime, now });
            }
          }
        }
      });
    }
    
    prevAllActiveTradesRef.current = allActiveTrades;
  }, [allActiveTrades]);


  
  const { customQuotesSubscribedRef } = useWebSocketSubscriptions({
    wsSendMessage,
    wsOnMessage,
    isConnected,
    selectedBase,
    timeframe,
    tradingMode,
    activeTrades,
    handleTradesWithRigging: useCallback((trades: any[]) => {
      if (trades.length > 0 && wsSendMessage) {
        const currencyIds = new Set<number>();
        trades.forEach((trade: any) => {
          // Получаем id из сделки или ищем по символу
          let currencyId: number | undefined = trade.id;
          
          if (!currencyId && trade.symbol) {
            // Парсим символ (например, "BTC_USDT" -> base="BTC", quote="USDT")
            const symbol = trade.symbol.replace(/[^a-zA-Z0-9_]/g, '').toUpperCase();
            const parts = symbol.split('_');
            if (parts.length === 2) {
              const [base, quote] = parts;
              // Ищем валюту по base_currency и quote_currency
              for (const category of currencyCategories) {
                const list = category.currencies ?? [];
                const found = list.find(
                  (c) => c.base_currency === base && c.quote_currency === quote
                );
                if (found?.id) {
                  currencyId = found.id;
                  break;
                }
              }
              // Работаем только по ID - если ID не найден, пропускаем
            }
          }
          // Работаем только по ID - если ID не найден, пропускаем
          
          // Validate currencyId before adding to set
          if (currencyId) {
            const currencyIdNum = typeof currencyId === 'number' ? currencyId : Number(currencyId);
            if (Number.isInteger(currencyIdNum) && currencyIdNum > 0) {
              currencyIds.add(currencyIdNum);
            } else {
              console.warn('[TradingTerminal] Invalid currency ID for subscription:', {
                currencyId,
                currencyIdType: typeof currencyId,
                tradeSymbol: trade.symbol,
                tradeBaseCurrency: trade.baseCurrency
              });
            }
          }
        });
        
        currencyIds.forEach(currencyId => {
          // Double-check validation before subscribing
          const currencyIdNum = typeof currencyId === 'number' ? currencyId : Number(currencyId);
          if (!Number.isInteger(currencyIdNum) || currencyIdNum <= 0) {
            console.warn('[TradingTerminal] Skipping invalid currency ID:', currencyId);
            return;
          }
          
          const key = `currency_${currencyIdNum}`;
          if (!customQuotesSubscribedRef.current.has(key)) {
            try {
              wsSendMessage({ type: 'subscribe-custom-quotes', id: currencyIdNum, timeframe } as any);
              customQuotesSubscribedRef.current.add(key);
            } catch (error) {
              console.error('[TradingTerminal] Ошибка подписки на котировки для сделки:', error);
            }
          }
        });
      }
    }, [wsSendMessage, timeframe, currencyCategories]),
  });

  // Очищаем маркеры и активные сделки при смене пары или таймфрейма
  // Используем ref для отслеживания предыдущего символа, чтобы не очищать при каждом рендере
  const prevSymbolRef = useRef<string | undefined>(selectedBase);
  const prevTimeframeRef = useRef<string | undefined>(timeframe);
  
  useEffect(() => {
    const symbolChanged = prevSymbolRef.current !== selectedBase;
    const timeframeChanged = prevTimeframeRef.current !== timeframe;
    
    if (symbolChanged) {
      // Очищаем свечи только при смене валютной пары
      // Это гарантирует, что график не будет показывать старые данные для новой пары
      setLoadedCandles([]);
      
      // Обновляем ref
      prevSymbolRef.current = selectedBase;
    }
    
    if (timeframeChanged) {
      // При смене таймфрейма не очищаем данные сразу
      // ChartHistory сам обновит данные через onCandlesLoaded
      // Это предотвращает мигание графика при переключении таймфреймов
      prevTimeframeRef.current = timeframe;
    }
    // Очищаем только визуальные маркеры, но не активные сделки (они могут быть для других символов)
    // Активные сделки будут обновлены при следующем получении данных с сервера
  }, [selectedBase, timeframe, dispatch]);

  // Мемоизируем колбэк для загрузки свечей, чтобы он не пересоздавался при каждом рендере
  const handleCandlesLoaded = useCallback((candles: Array<{ x: number; o: number; h: number; l: number; c: number }>) => {
    console.log('[TradingTerminal] История свечей загружена:', candles.length);
    setLoadedCandles(candles);
  }, []);

  // Колбэк для загрузки дополнительных свечей при прокрутке влево
  const handleLoadMoreCandles = useCallback(async (currentCandlesCount: number): Promise<number> => {
    console.log('[TradingTerminal] Запрос на загрузку дополнительных свечей. Текущее количество:', currentCandlesCount);
    
    try {
      const currencyId = forcedCurrency || selectedCurrencyId;
      if (!currencyId) {
        console.error('[TradingTerminal] ❌ Не удалось получить ID валюты для запроса свечей');
        return 0;
      }


      // Используем новый метод getCandlesByRange
      // 0 - самая свежая свеча, для получения более старых увеличиваем индексы
      // Запрашиваем 200 свечей начиная с currentCandlesCount
      const startIndex = currentCandlesCount;
      const endIndex = currentCandlesCount + 200;
      
      console.log('[TradingTerminal] Запрашиваем диапазон индексов:', { startIndex, endIndex });
      
      // Для диапазонов не проверяем кеш, так как индексы относительны и могут не совпадать
      // Кеш более полезен для полных наборов свечей (как в ChartHistory)
      console.log(`[TradingTerminal] 🔍 Запрос свечей с сервера: id=${currencyId}, timeframe=${timeframe}, startIndex=${startIndex}, endIndex=${endIndex}`);
      
      const response = await syntheticQuotesApi.getCandlesByRange(currencyId, timeframe, startIndex, endIndex);
      
      let candlesData: any[] = [];
      
      if (Array.isArray(response)) {
        candlesData = response;
      } else if (response && typeof response === 'object' && 'data' in response) {
        if (response.success === false) {
          throw new Error('Failed to fetch synthetic candles: server returned error');
        }
        if (Array.isArray(response.data)) {
          candlesData = response.data;
        } else {
          throw new Error('Failed to fetch synthetic candles: invalid response format - data is not array');
        }
      } else {
        console.error('[TradingTerminal] Неожиданный формат ответа:', response);
        throw new Error('Failed to fetch synthetic candles: invalid response format');
      }
      
      console.log(`[TradingTerminal] ✅ Найдено свечей в кеше: ${candlesData.length} для id=${currencyId}:${timeframe}${candlesData.length > 0 ? `, первая: ${new Date(candlesData[0].time || candlesData[0].start).toISOString()}, последняя: ${new Date(candlesData[candlesData.length - 1].time || candlesData[candlesData.length - 1].start).toISOString()}` : ''}`);
      
      if (candlesData.length === 0) {
        console.log(`[TradingTerminal] ⚠️ В кеше нет свечей для id=${currencyId}:${timeframe}`);
        return 0;
      }
      
      const processedCandles: Array<{ x: number; o: number; h: number; l: number; c: number }> = [];
      const invalidCandles: Array<{ reason: string; data: any }> = [];
      const thinCandles: Array<{ time: string; high: number; low: number; range: number; rangePercent: number }> = [];
      
      candlesData.forEach((c) => {
        if (!c || typeof c !== 'object') {
          invalidCandles.push({ reason: 'Не объект или null', data: c });
          return;
        }
        
        const timeValue = c.time !== undefined ? c.time : c.start;
        if (timeValue === undefined) {
          invalidCandles.push({ reason: 'Нет поля time/start', data: c });
          return;
        }
        
        const timestamp = typeof timeValue === 'number' ? timeValue : new Date(timeValue).getTime();
        const open = parseFloat(c.open);
        const high = parseFloat(c.high);
        const low = parseFloat(c.low);
        const close = parseFloat(c.close);
        
        if (!Number.isFinite(timestamp) || !Number.isFinite(open) || !Number.isFinite(high) || 
            !Number.isFinite(low) || !Number.isFinite(close)) {
          invalidCandles.push({ reason: 'Нечисловые значения', data: { open, high, low, close, timestamp } });
          return;
        }
        
        if (open <= 0 || high <= 0 || low <= 0 || close <= 0) {
          invalidCandles.push({ reason: 'Отрицательные или нулевые значения', data: { open, high, low, close } });
          return;
        }
        
        if (high < low || high < open || high < close || low > open || low > close) {
          invalidCandles.push({ reason: 'Некорректные OHLC значения', data: { open, high, low, close } });
          return;
        }
        
        const range = high - low;
        const avgPrice = (high + low) / 2;
        const rangePercent = avgPrice > 0 ? (range / avgPrice) * 100 : 0;
        
        // Проверяем на "тонкие" свечи (диапазон меньше 0.001% от средней цены)
        if (rangePercent < 0.001) {
          thinCandles.push({
            time: new Date(timestamp).toISOString(),
            high,
            low,
            range,
            rangePercent
          });
        }
        
        processedCandles.push({
          x: timestamp,
          o: open,
          h: high,
          l: low,
          c: close,
        });
      });
      
      // Сортируем по времени
      processedCandles.sort((a, b) => a.x - b.x);

      console.log(`[TradingTerminal] ✅ Загружено новых свечей: ${processedCandles.length} для id=${currencyId}:${timeframe}`);
      
      // Сохраняем в кеш для диапазона (только memory cache, не localStorage)
      if (processedCandles.length > 0) {
        saveCandlesToCache(currencyId, timeframe, processedCandles, { 
          startIndex, 
          endIndex,
          useLocalStorage: false // диапазоны не сохраняем в localStorage
        });
        console.log(`[TradingTerminal] 💾 Сохранено в кеш: ${processedCandles.length} свечей для диапазона id=${currencyId}:${timeframe}`);
      }
      
      if (invalidCandles.length > 0) {
        console.warn(`[TradingTerminal] ⚠️ Найдено невалидных свечей: ${invalidCandles.length}`, invalidCandles.slice(0, 10));
      }
      
      if (thinCandles.length > 0) {
        console.warn(`[TradingTerminal] ⚠️ Найдено тонких свечей (range < 0.001%): ${thinCandles.length}`, thinCandles.slice(0, 10));
      }
      
      // Логируем детали первых и последних свечей
      if (processedCandles.length > 0) {
        const firstCandle = processedCandles[0];
        const lastCandle = processedCandles[processedCandles.length - 1];
        console.log(`[TradingTerminal] 📊 Детали загруженных свечей:`, {
          first: {
            time: new Date(firstCandle.x).toISOString(),
            o: firstCandle.o,
            h: firstCandle.h,
            l: firstCandle.l,
            c: firstCandle.c,
            range: firstCandle.h - firstCandle.l,
            rangePercent: ((firstCandle.h - firstCandle.l) / ((firstCandle.h + firstCandle.l) / 2)) * 100
          },
          last: {
            time: new Date(lastCandle.x).toISOString(),
            o: lastCandle.o,
            h: lastCandle.h,
            l: lastCandle.l,
            c: lastCandle.c,
            range: lastCandle.h - lastCandle.l,
            rangePercent: ((lastCandle.h - lastCandle.l) / ((lastCandle.h + lastCandle.l) / 2)) * 100
          },
          totalCount: processedCandles.length,
          thinCandlesCount: thinCandles.length,
          requestedRange: { startIndex, endIndex }
        });
      }
      
      if (processedCandles.length > 0) {
        // Используем функциональное обновление, чтобы получить текущее состояние и отфильтровать свечи
        let actuallyAddedCount = 0;
        
        setLoadedCandles((prev) => {
          const firstOldTime = prev.length > 0 ? prev[0].x : Infinity;
          const lastOldTime = prev.length > 0 ? prev[prev.length - 1].x : -Infinity;
          
          console.log('[TradingTerminal] Существующие свечи:', {
            count: prev.length,
            firstOldTime: firstOldTime !== Infinity ? new Date(firstOldTime).toISOString() : 'нет',
            lastOldTime: lastOldTime !== -Infinity ? new Date(lastOldTime).toISOString() : 'нет'
          });
          
          // Фильтруем свечи - оставляем только те, которые старше первой (самой старой) существующей свечи
          const candlesToAdd = processedCandles.filter(c => c.x < firstOldTime);
          actuallyAddedCount = candlesToAdd.length;
          
          if (candlesToAdd.length === 0) {
            console.log('[TradingTerminal] Все загруженные свечи новее существующих или дублируют их, не добавляем', {
              loadedCount: processedCandles.length,
              oldestLoaded: processedCandles[0] ? new Date(processedCandles[0].x).toISOString() : 'нет',
              newestLoaded: processedCandles[processedCandles.length - 1] ? new Date(processedCandles[processedCandles.length - 1].x).toISOString() : 'нет',
              firstOldTime: firstOldTime !== Infinity ? new Date(firstOldTime).toISOString() : 'нет',
              lastOldTime: lastOldTime !== -Infinity ? new Date(lastOldTime).toISOString() : 'нет'
            });
            return prev;
          }
          
          console.log('[TradingTerminal] Фильтруем свечи для добавления:', {
            загружено: processedCandles.length,
            будетДобавлено: candlesToAdd.length,
            oldestNewTime: new Date(candlesToAdd[0].x).toISOString(),
            firstOldTime: firstOldTime !== Infinity ? new Date(firstOldTime).toISOString() : 'нет'
          });
          
          const combined = [...candlesToAdd, ...prev];
          const unique = combined.filter((candle, index, self) => 
            index === self.findIndex((c) => c.x === candle.x)
          );
          const sorted = unique.sort((a, b) => a.x - b.x);
          
          console.log('[TradingTerminal] Обновлены свечи после загрузки дополнительных. Всего:', sorted.length);
          
          return sorted;
        });
        
        // Возвращаем количество добавленных свечей для корректировки viewport
        return actuallyAddedCount;
      }
      
      return 0;
    } catch (error) {
      console.error('[TradingTerminal] Ошибка загрузки дополнительных свечей:', error);
      return 0;
    }
  }, [selectedCurrencyId, forcedCurrency, timeframe]);

  // Ref для хранения текущего id для правильной отписки
  const currencyIdRef = useRef<number | null>(null);

  // Подписка на котировки для текущей валютной пары (по ID)
  useEffect(() => {
    if (!isConnected || !wsSendMessage) {
      console.log('[TradingTerminal] ⏳ Ожидание WebSocket подключения...', { isConnected, hasWsSendMessage: !!wsSendMessage });
      return;
    }

    // Используем selectedCurrencyId или forcedCurrency (приоритет forcedCurrency)
    const currencyId = forcedCurrency || selectedCurrencyId;
    
    console.log('[TradingTerminal] Подписка на котировки', {
      selectedCurrencyId,
      forcedCurrency,
      currencyId,
      previousId: currencyIdRef.current
    });
    
    if (!currencyId) {
      console.warn('[TradingTerminal] ❌ Не удалось получить id для подписки:', {
        selectedCurrencyId,
        forcedCurrency
      });
      currencyIdRef.current = null;
      return;
    }
    
    // Сохраняем предыдущий id для отписки
    const previousId = currencyIdRef.current;
    currencyIdRef.current = currencyId;
    
    // Отписываемся от предыдущей валюты перед подпиской на новую
    if (previousId && previousId !== currencyId) {
      try {
        wsSendMessage({ 
          type: 'unsubscribe-custom-quotes', 
          id: previousId, 
          timeframe 
        } as any);
      } catch (error) {
        console.error('[TradingTerminal] ❌ Ошибка отписки от предыдущей валюты:', error);
      }
    }
    
    // Подписываемся на котировки для текущей валютной пары по ID
    try {
      console.log('[TradingTerminal] 📤 Отправка подписки на котировки:', {
        type: 'subscribe-custom-quotes',
        id: currencyId,
        timeframe: timeframe
      });
      wsSendMessage({ 
        type: 'subscribe-custom-quotes', 
        id: currencyId, 
        timeframe 
      } as any);
      console.log('[TradingTerminal] ✅ Подписка на котировки отправлена');
    } catch (error) {
      console.error('[TradingTerminal] ❌ Ошибка подписки на котировки:', error);
    }

    // Отписываемся при размонтировании или изменении пары/таймфрейма
    return () => {
      try {
        const currentId = currencyIdRef.current;
        if (currentId && isConnected && wsSendMessage) {
          wsSendMessage({ 
            type: 'unsubscribe-custom-quotes', 
            id: currentId, 
            timeframe 
          } as any);
        }
      } catch (error) {
        // Игнорируем ошибки при отписке
      }
    };
  }, [isConnected, wsSendMessage, selectedCurrencyId, forcedCurrency, timeframe]);

  // Сохраняем handlePriceUpdate в ref для стабильной ссылки
  const handlePriceUpdateRef = useRef(handlePriceUpdate);
  useEffect(() => {
    handlePriceUpdateRef.current = handlePriceUpdate;
  }, [handlePriceUpdate]);

  // Обработка WebSocket обновлений свечей для анимации
  useEffect(() => {
    if (!isConnected || !wsOnMessage) {
      return;
    }
    
    const unsubscribe = wsOnMessage('custom_quote', (message: any) => {
      const klineData = message.data || message;
      const topic = klineData?.topic || 'unknown';
      
      // Log removed to reduce console noise
      
      if (!klineData || !klineData.topic || !klineData.topic.startsWith('kline.')) {
        // Log removed to reduce console noise
        return;
      }

      const topicParts = klineData.topic.split('.');
      if (topicParts.length < 3) {
        // Log removed to reduce console noise
        return;
      }

      const topicSymbol = topicParts[2];
      const quoteTimeframe = topicParts[1];

      // Проверяем, что сообщение относится к текущей валютной паре и таймфрейму
      // Используем актуальные значения из refs для избежания stale closures
      // Получаем валюту по ID для сравнения
      const currentCurrencyId = forcedCurrency || selectedCurrencyId;
      if (!currentCurrencyId) {
        // Log removed to reduce console noise
        return;
      }
      
      // Получаем информацию о валюте по ID
      const currentCurrency = getCurrencyById(currentCurrencyId);
      if (!currentCurrency || !currentCurrency.symbol) {
        console.warn('[TradingTerminal] ⚠️ Валюта не найдена для ID:', currentCurrencyId);
        return;
      }
      
      // Нормализуем символ из БД (может быть в формате EUR/USD+ или EURUSD)
      const symbolFromDb = currentCurrency.symbol.replace(/\+$/, ''); // Убираем + в конце
      const currentSymbol = normalizeCurrencyPair(symbolFromDb);
      const currentTimeframe = timeframeRef.current;
      
      // Сравниваем нормализованные символы
      const normalizedTopicSymbol = normalizeCurrencyPair(topicSymbol);
      
      const symbolMismatch = normalizedTopicSymbol !== currentSymbol;
      const timeframeMismatch = quoteTimeframe !== currentTimeframe;
      
      if (symbolMismatch || timeframeMismatch) {
        console.log('[TradingTerminal] ⚠️ Пропуск сообщения - несоответствие:', {
          topicSymbol,
          normalizedTopicSymbol,
          currentSymbol,
          symbolFromDb,
          quoteTimeframe,
          currentTimeframe,
          currencyId: currentCurrencyId,
          currency: `${currentCurrency.base_currency}_${currentCurrency.quote_currency}`
        });
        return;
      }
      
      console.log('[TradingTerminal] ✅ Обработка WebSocket сообщения:', {
        topicSymbol,
        normalizedTopicSymbol,
        currentSymbol,
        quoteTimeframe,
        currentTimeframe,
        currencyId: currentCurrencyId
      });
      
      // Log removed to reduce console noise

      if (!Array.isArray(klineData.data) || klineData.data.length === 0) {
        return;
      }

      const kline = klineData.data[klineData.data.length - 1];
      
      // Парсим значения свечи
      const openPrice = parseFloat(kline.open);
      const closePrice = parseFloat(kline.close);
      const highPrice = parseFloat(kline.high);
      const lowPrice = parseFloat(kline.low);

      if (!Number.isFinite(openPrice) || !Number.isFinite(closePrice) || 
          !Number.isFinite(highPrice) || !Number.isFinite(lowPrice)) {
        return;
      }

      // Обновляем свечи
      // ВАЖНО: Дополнительная проверка актуальных значений перед обновлением состояния
      // Это защита от race condition, когда валютная пара меняется во время обработки сообщения
      const checkCurrencyId = forcedCurrency || selectedCurrencyId;
      if (!checkCurrencyId) {
        return;
      }
      
      // Получаем информацию о валюте для проверки
      const checkCurrency = getCurrencyById(checkCurrencyId);
      if (!checkCurrency || !checkCurrency.symbol) {
        return;
      }
      
      const checkSymbolFromDb = checkCurrency.symbol.replace(/\+$/, ''); // Убираем + в конце
      const checkNormalizedSymbol = normalizeCurrencyPair(checkSymbolFromDb);
      const normalizedTopicSymbolCheck = normalizeCurrencyPair(topicSymbol);
      const checkTimeframe = timeframeRef.current;
      if (normalizedTopicSymbolCheck !== checkNormalizedSymbol || quoteTimeframe !== checkTimeframe) {
        // Валютная пара или таймфрейм изменились во время обработки - игнорируем сообщение
        return;
      }

      // ВАЖНО: Обновляем currentMarketPrice из цены закрытия свечи
      // Это та же цена, что используется для маркера цены на графике
      // Вызываем handlePriceUpdate ПЕРЕД обновлением свечей через ref для стабильной ссылки
      const klineStart = typeof kline.start === 'number' ? kline.start : parseInt(kline.start, 10);
      
      if (handlePriceUpdateRef.current) {
        handlePriceUpdateRef.current({
          open: openPrice,
          high: highPrice,
          low: lowPrice,
          close: closePrice,
          timestamp: klineStart
        });
      }
      
      setLoadedCandles(prev => {
        // ВАЖНО: Если массив пустой, не обновляем - это означает, что валютная пара только что изменилась
        // и мы ждем загрузки новых данных
        if (prev.length === 0) {
          return prev;
        }

        const lastCandle = prev[prev.length - 1];
        
        // Если это обновление последней свечи (та же временная метка)
        // Используем более гибкое сравнение с допуском в 1 секунду
        const timeDiff = Math.abs(lastCandle.x - klineStart);
        if (timeDiff < 1000) {
          const updated = [...prev];
          updated[updated.length - 1] = {
            x: klineStart,
            o: openPrice,
            h: highPrice,
            l: lowPrice,
            c: closePrice,
          };
          return updated;
        }
        
        // Если это новая свеча, добавляем её
        return [...prev, {
          x: klineStart,
          o: openPrice,
          h: highPrice,
          l: lowPrice,
          c: closePrice,
        }];
      });
    });

    return () => {
      unsubscribe();
    };
  }, [isConnected, wsOnMessage, forcedCurrency, selectedCurrencyId, getCurrencyById]);

  // Ref to track loadedCandles without causing interval restarts
  const loadedCandlesRef = useRef(loadedCandles);
  useEffect(() => {
    loadedCandlesRef.current = loadedCandles;
  }, [loadedCandles]);

  // DISABLED: Create new candle immediately when new period starts (client-side)
  // This is disabled to test behavior without client-side candle creation
  // New candles will be created only when received from server via WebSocket
  /*
  useEffect(() => {
    if (!isConnected) {
      return;
    }

    const timeframeDuration = getTimeframeDurationMs(timeframe) ?? 60_000;
    const checkInterval = 10; // Check every 10ms for immediate creation

    const intervalId = setInterval(() => {
      const candles = loadedCandlesRef.current;
      if (candles.length === 0) {
        return;
      }

      const now = getGlobalServerTime();
      const lastCandle = candles[candles.length - 1];
      const lastCandleEnd = lastCandle.x + timeframeDuration;
      const timeUntilNewCandle = lastCandleEnd - now;

      // Create new candle 200ms before period ends to account for rendering delay
      if (timeUntilNewCandle <= 200 || timeUntilNewCandle < 0) {
        const alignedCurrentTime = Math.floor(now / timeframeDuration) * timeframeDuration;
        const expectedNextCandleTime = lastCandle.x + timeframeDuration;
        const newCandleOpenTime = alignedCurrentTime >= expectedNextCandleTime ? alignedCurrentTime : expectedNextCandleTime;

        // Check if candle already exists
        const existingCandle = candles.find(c => Math.abs(c.x - newCandleOpenTime) < 1000);
        if (!existingCandle) {
          // Find the last REAL candle (not a flat temporary one)
          // A flat candle is one where open=close=high=low (temporary placeholder)
          const isFlatCandle = (c: typeof lastCandle) => {
            const range = c.h - c.l;
            const priceScale = Math.max(1e-12, Math.abs(c.c || 1));
            const relativeRange = range / priceScale;
            return relativeRange < 1e-10 && Math.abs(c.o - c.c) < 1e-10;
          };
          
          // Find last non-flat candle to get the real close price
          let realLastCandle = lastCandle;
          for (let i = candles.length - 1; i >= 0; i--) {
            if (!isFlatCandle(candles[i])) {
              realLastCandle = candles[i];
              break;
            }
          }
          
          const newCandlePrice = realLastCandle.c;

          setLoadedCandles(prev => {
            // Check again to avoid duplicates
            const alreadyExists = prev.find(c => Math.abs(c.x - newCandleOpenTime) < 1000);
            if (alreadyExists) {
              return prev;
            }

            return [...prev, {
              x: newCandleOpenTime,
              o: newCandlePrice,
              h: newCandlePrice,
              l: newCandlePrice,
              c: newCandlePrice,
            }];
          });
        }
      }
    }, checkInterval);

    return () => {
      clearInterval(intervalId);
    };
  }, [isConnected, timeframe]);
  */

  const currentPriceForLastTradeRef = useRef<number | null>(null);
  const lastTradeDataRef = useRef<{
    price: number;
    currentPriceAtTrade: number;
    direction: 'buy' | 'sell';
    amount: number;
    timestamp: number;
  } | null>(null);
  const lastTradeLengthRef = useRef<number>(0);

  useEffect(() => {
    currentPriceForLastTradeRef.current = currentPrice;
  }, [currentPrice]);
  
  useEffect(() => {
    if (props.tradingMode !== 'manual' && props.tradingMode !== 'demo') {
      if (lastTradeDataRef.current !== null) {
        lastTradeDataRef.current = null;
        startTransition(() => {
          setLastTrade(null);
        });
      }
      return;
    }
    
    const now = getServerTime();
    const validTradesForSymbol: any[] = [];
    
    const currentPriceValue = currentPriceForLastTradeRef.current;
    if (validTradesForSymbol.length > 0 && currentPriceValue) {
      const lastTradeData = validTradesForSymbol[0];
      const newLastTrade = {
        price: lastTradeData.entryPrice || lastTradeData.price,
        currentPriceAtTrade: lastTradeData.currentPriceAtTrade || lastTradeData.entryPrice || currentPriceValue,
        direction: lastTradeData.direction,
        amount: lastTradeData.amount,
        timestamp: lastTradeData.createdAt
      };

      const prevLastTrade = lastTradeDataRef.current;
      if (!prevLastTrade ||
          prevLastTrade.price !== newLastTrade.price ||
          prevLastTrade.currentPriceAtTrade !== newLastTrade.currentPriceAtTrade ||
          prevLastTrade.direction !== newLastTrade.direction ||
          prevLastTrade.amount !== newLastTrade.amount ||
          prevLastTrade.timestamp !== newLastTrade.timestamp) {
        lastTradeDataRef.current = newLastTrade;
        startTransition(() => {
          setLastTrade(newLastTrade);
        });
      }
    } else {
      if (lastTradeDataRef.current !== null) {
        lastTradeDataRef.current = null;
        startTransition(() => {
          setLastTrade(null);
        });
      }
    }
    lastTradeLengthRef.current = validTradesForSymbol.length;
  }, [props.tradingMode, getServerTime]);

  // Спред управляется через usePriceManagement хук

  useEffect(() => {
    return () => {
      if (wsSendMessage && customQuotesSubscribedRef.current.size > 0) {
        customQuotesSubscribedRef.current.forEach(key => {
          try {
            // Ключ в формате "currency_123", извлекаем ID
            const currencyIdMatch = key.match(/^currency_(\d+)$/);
            if (currencyIdMatch) {
              const currencyId = parseInt(currencyIdMatch[1], 10);
              wsSendMessage({ type: 'unsubscribe-custom-quotes', id: currencyId, timeframe } as any);
            }
          } catch (error) {
            console.error('[TradingTerminal] Ошибка отписки от котировок при размонтировании:', error);
          }
        });
        customQuotesSubscribedRef.current.clear();
      }
    };
  }, [wsSendMessage, timeframe]);

  // Передаем данные для PricePanel с throttle для уменьшения перерендеров
  const lastPricePanelUpdateRef = useRef<number>(0);
  const lastPricePanelDataRef = useRef<any>(null);
  
  // Используем селектор для фильтрации по режиму
  const filteredActiveTrades = useAppSelector(selectActiveTradesByMode);

  // Синхронизация флага по факту наличия активных сделок с катировками
  const lastRiggedTradesRef = useRef<string>('');
  useEffect(() => {
    const trades = (filteredActiveTrades as any) || [];
    if (!trades || typeof trades.filter !== 'function') {
      return;
    }
    
    const riggedTradesIds = trades
      .filter((trade: any) => trade.rigging && trade.rigging.outcome && trade.rigging.outcome !== 'none')
      .map((trade: any) => trade.id)
      .sort()
      .join(',');
    
    if (riggedTradesIds !== lastRiggedTradesRef.current) {
      lastRiggedTradesRef.current = riggedTradesIds;
    }
    
    // Сервер сам определяет какие котировки отправлять на основе активных ставок
  }, [filteredActiveTrades, tradingMode]);

  // Сервер сам решает какие котировки отправлять - кастомные или синтетические
  // Клиенту не нужно управлять подпиской, котировки приходят автоматически

  // История сделок управляется через useTradeHistory хук
  const loadMoreTradeHistoryWrapper = useCallback(() => {
    loadMoreTradeHistory(requestTradeHistory);
  }, [loadMoreTradeHistory, requestTradeHistory]);

  // Получаем валюту котировки для отображения
  const currencyForQuote = getCurrencyById(forcedCurrency || selectedCurrencyId);
  const quoteCurrency = currencyForQuote?.quote_currency || 'USDT';

  // Мемоизируем объект данных для PricePanel, чтобы не создавать новый при каждом вызове
  // Теперь используем данные из Redux
  // Используем currentMarketPrice как fallback для currentPrice, чтобы кнопки были активны сразу при получении тиков
  const pricePanelDataMemo = useMemo(() => {
    const effective_current_price = currentPrice ?? currentMarketPrice;
    return {
    currentPrice: effective_current_price,
    price1: price1,
    price2: price2,
    priceDiff: priceDiff,
    priceDiffPercent: priceDiffPercent,
    spreadPercent: spreadPercent,
    activeTrades: [],
    tradeHistory: tradeHistory,
    manualTradeAmount,
    setManualTradeAmount: updateManualTradeAmount,
    handleManualTrade,
    formatPrice: (price: number | null) => formatPrice(price, selectedBase),
    formatHMS,
    parsedExpiration,
    changeExpiration,
    setExpirationSeconds: setExpirationSecondsWithRef,
    quickPresets,
    onLoadMoreHistory: loadMoreTradeHistoryWrapper,
    isLoadingMoreHistory,
    hasMoreHistory,
    setHoveredButton: setHoveredButtonCallback,
    quoteCurrency,
    getCurrencyById,
    resolveCurrencyIconUrls,
    currentMarketPrice: currentMarketPrice,
    requestTradeHistory: requestTradeHistory,
    };
  }, [
    currentPrice, currentMarketPrice, price1, price2, priceDiff, priceDiffPercent, spreadPercent,
    tradeHistory, manualTradeAmount, updateManualTradeAmount, handleManualTrade,
    formatPrice, formatHMS, parsedExpiration, changeExpiration, setExpirationSecondsWithRef,
    quickPresets, loadMoreTradeHistoryWrapper, isLoadingMoreHistory, hasMoreHistory,
    setHoveredButtonCallback, quoteCurrency, resolveCurrencyIconUrls,
    requestTradeHistory, selectedBase
  ]);
  
  useEffect(() => {
    if (!props.onPricePanelData) {
      return;
    }

    const now = getServerTime();
    const lastData = lastPricePanelDataRef.current;

    const dataChanged =
      !lastData ||
      lastData.currentPrice !== pricePanelDataMemo.currentPrice ||
      lastData.tradeHistory?.length !== pricePanelDataMemo.tradeHistory?.length;

    const manualControlsChanged =
      !lastData ||
      lastData.manualTradeAmount !== pricePanelDataMemo.manualTradeAmount ||
      lastData.parsedExpiration !== pricePanelDataMemo.parsedExpiration;

    const currentPriceChanged = 
      !lastData ||
      (lastData.currentPrice === null && pricePanelDataMemo.currentPrice !== null) ||
      (lastData.currentPrice !== null && pricePanelDataMemo.currentPrice === null);

    const timeElapsed = now - lastPricePanelUpdateRef.current >= 2000;

    if ((timeElapsed && dataChanged) || manualControlsChanged || currentPriceChanged) {
      props.onPricePanelData(pricePanelDataMemo);
      lastPricePanelUpdateRef.current = now;
      lastPricePanelDataRef.current = pricePanelDataMemo;
    }
  }, [pricePanelDataMemo, props.onPricePanelData]);

  // Active trades loading is managed through useTradeSync hook

  return (
    <div className="trading-terminal trading-terminal--disabled" ref={tradingTerminalRef}>
      {/* Overlay для отключения всех взаимодействий */}
      <div className="trading-terminal-overlay" />
      {/* Main Chart Section */}
      <div className="terminal-main">
        <div 
          className={`chart-section-wrapper ${isChartNavigationMenuOpen ? 'chart-navigation-active' : ''} ${showIndicatorsMenu ? 'indicators-sidebar-open' : ''}`}
          ref={mainChartContainerRef}
          data-gradient={hoveredButton || undefined}
          style={{
            '--bg-image': `url(${backgroundChartImage})`,
            backgroundImage: `url(${backgroundChartImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
          } as React.CSSProperties}
        >
          <ChartTopBar
            selectedBase={selectedBase}
            onBaseChange={handleBaseChange}
            currencyData={{
              currencyCategories,
              currenciesLoading,
              selectedCategoryId,
              setSelectedCategoryId,
              favoriteCurrencies,
              setFavoriteCurrencies,
              getCurrencyById,
              resolveCurrencyIconUrls,
              resolveCurrencyAveragePrice,
            }}
          />
          <div className="chart-content-wrapper">
              <ChartHistory
                key={`chart-history-${selectedCurrencyId || forcedCurrency}-${timeframe}`}
                selectedBase={selectedBase}
                currencyId={forcedCurrency || selectedCurrencyId}
                timeframe={timeframe}
                onCandlesLoaded={handleCandlesLoaded}
                reloadTrigger={chartReloadTrigger}
              />
              {loadedCandles.length > 0 && (
                <CandlesCanvas
                  ref={chartHandleRef}
                  key={`candles-canvas-${selectedBase}-${timeframe}`}
                  candles={loadedCandles}
                  timeframe={timeframe}
                  hoveredButton={hoveredButton}
                  drawingMode={selectedDrawingTool}
                  selectionMode={selectionMode}
                  currencyPair={selectedBase}
                  activeIndicators={activeIndicators}
                  eraserRadius={eraserRadius}
                  drawingColor={drawingColor}
                  drawingLineWidth={drawingLineWidth}
                  chartView={chartView}
                  onLoadMore={handleLoadMoreCandles}
                  onCandleUpdate={(candle) => {
                    // Обновляем активную свечу в loadedCandles
                    // ВАЖНО: Компонент CandlesCanvas перемонтируется при смене валютной пары (через key prop),
                    // поэтому этот callback не должен вызываться для старой валютной пары.
                    // Но для дополнительной защиты проверяем, что массив не пустой.
                    setLoadedCandles(prev => {
                      if (prev.length === 0) return prev;
                      const lastCandle = prev[prev.length - 1];
                      // Если это обновление последней свечи (та же временная метка)
                      if (lastCandle.x === candle.x) {
                        const updated = [...prev];
                        updated[updated.length - 1] = candle;
                        return updated;
                      }
                      return prev;
                    });
                  }}
                />
              )}
              {/* Chart component removed */}
              
              {/* Time Calculator внутри chart-section-wrapper */}
              {showTimeCalculator && (
                <TimeCalculator
                  position={timeCalculatorPosition}
                  onClose={() => setShowTimeCalculator(false)}
                  currentSeconds={parsedExpiration}
                  onTimeChange={(seconds) => {
                    setExpirationSecondsWithRef(String(seconds));
                  }}
                  quickPresets={quickPresets}
                  isNarrow={isChartNarrow}
                />
              )}
              
              {/* Investment Calculator внутри chart-section-wrapper */}
              {showInvestmentCalculator && (
                <InvestmentCalculator
                  position={investmentCalculatorPosition}
                  onClose={() => setShowInvestmentCalculator(false)}
                  currentAmount={manualTradeAmount}
                  onAmountChange={(amount) => {
                    updateManualTradeAmount(amount);
                  }}
                  balance={balance}
                  currency={userCurrency}
                  minAmount={1}
                />
              )}
              
              {/* Chart Navigation Button and Menu */}
              {(() => {
                // Получаем валюту по ID для отображения
                const selectedCurrency = getCurrencyById(forcedCurrency || selectedCurrencyId);
                const currencyIcon = selectedCurrency && resolveCurrencyIconUrls
                  ? resolveCurrencyIconUrls(selectedCurrency)[0] || null
                  : selectedCurrency?.icon || null;
                
                
                return (
                  <>
                    <ChartNavigationButton
                      selectedBase={selectedBase}
                      currencyIcon={currencyIcon}
                      isMenuOpen={isChartNavigationMenuOpen}
                      onClick={() => setIsChartNavigationMenuOpen(!isChartNavigationMenuOpen)}
                      displayName={selectedCurrency?.display_name}
                      quoteCurrency={selectedCurrency?.quote_currency}
                    />
                    <ChartNavigationMenu
                      isOpen={isChartNavigationMenuOpen}
                      onClose={() => setIsChartNavigationMenuOpen(false)}
                      selectedBase={selectedBase}
                      onBaseChange={handleBaseChange}
                      currencyCategories={currencyCategories}
                      currenciesLoading={currenciesLoading}
                      selectedCategoryId={selectedCategoryId}
                      setForcedCurrency={setForcedCurrency}
                      forcedCurrency={forcedCurrency}
                      setSelectedCategoryId={setSelectedCategoryId}
                      getCurrencyById={getCurrencyById}
                      resolveCurrencyIconUrls={resolveCurrencyIconUrls}
                      resolveCurrencyAveragePrice={resolveCurrencyAveragePrice}
                      favoriteCurrencies={favoriteCurrencies}
                      setFavoriteCurrencies={setFavoriteCurrencies}
                    />
                  </>
                );
              })()}
              
              {/* Trading Controls Panel overlay at the bottom of chart */}
              <div ref={tradingControlsRef} className="chart-bottom-trading-controls-overlay">
                    <TradingControlsPanel
                      balance={balance}
                      manualTradeAmount={manualTradeAmount}
                      setManualTradeAmount={updateManualTradeAmount}
                      handleManualTrade={handleManualTrade}
                      formatHMS={formatHMS}
                      parsedExpiration={parsedExpiration}
                      changeExpiration={changeExpiration}
                      setExpirationSeconds={setExpirationSecondsWithRef}
                      quickPresets={quickPresets}
                      setHoveredButton={setHoveredButtonCallback}
                      isProcessing={props.isProcessing}
                      currentPrice={pricePanelDataMemo.currentPrice}
                      tradingMode={tradingMode}
                      onTradingModeChange={props.onTradingModeChange}
                      isTradingActive={props.isTradingActive}
                      selectedBase={selectedBase}
                      getCurrencyById={getCurrencyById}
                      resolveCurrencyIconUrls={resolveCurrencyIconUrls}
                      currencyCategories={currencyCategories}
                      currenciesLoading={currenciesLoading}
                      isOverlay={true}
                      onTimeCalculatorOpen={handleTimeCalculatorOpen}
                      isDisabled={isAddSignalModalOpen}
                    />
              </div>
              
              {/* Chart Toolbar */}
              <ChartToolbar
                timeframe={timeframe}
                setTimeframe={setTimeframe}
                t={t}
                onOpenIndicators={() => setShowIndicatorsMenu(true)}
                onOpenDrawingTools={() => {
                  // Обработчик для инструментов рисования
                }}
                showDrawingToolsMenu={showDrawingToolsMenu}
                setShowDrawingToolsMenu={setShowDrawingToolsMenu}
                onDrawingToolSelect={(tool) => {
                  setSelectedDrawingTool(tool);
                  // Отключаем режим выделения при выборе инструмента рисования
                  if (tool) {
                    setSelectionMode(false);
                  }
                }}
                selectedDrawingTool={selectedDrawingTool}
                selectionMode={selectionMode}
                onSelectionModeToggle={(enabled) => {
                  setSelectionMode(enabled);
                  // Отключаем инструмент рисования при включении режима выделения
                  if (enabled) {
                    setSelectedDrawingTool(null);
                  }
                }}
                onChartViewChange={cycleChartView}
              />
          </div>
            
            <IndicatorsSidebar
              isOpen={showIndicatorsMenu}
              onClose={() => setShowIndicatorsMenu(false)}
              activeIndicators={activeIndicators}
              toggleIndicator={toggleIndicator}
              t={t}
            />

            <TopPartnersPanel
              isOpen={showTopPartnersMenu}
              onClose={() => dispatch(setTopPartnersMenuOpen(false))}
              t={t}
            />
            
            <SubscriptionsPanel
              isOpen={showSubscriptionsMenu}
              onClose={() => dispatch(setSubscriptionsMenuOpen(false))}
              t={t}
            />
            
            <ChatPanelWrapper />
        </div>
        
        {/* Eraser Size Slider */}
        <EraserSizeSlider
          isOpen={selectedDrawingTool === 'eraser'}
          eraserRadius={eraserRadius}
          onRadiusChange={(radius) => {
            setEraserRadius(radius);
          }}
        />
        
        {/* Drawing Tool Settings */}
        <DrawingToolSettings
          is_open={selectedDrawingTool !== null && selectedDrawingTool !== 'eraser'}
          line_width={drawingLineWidth}
          color={drawingColor}
          on_line_width_change={(width) => {
            setDrawingLineWidth(width);
          }}
          on_color_change={(color) => {
            setDrawingColor(color);
          }}
        />
            
        {/* Add Signal Modal */}
        {props.onOpenAddSignalModal && (
          <AddSignalModal
                  isOpen={isAddSignalModalOpen}
                  onClose={() => setIsAddSignalModalOpen(false)}
                  onSubmit={async (pair: string, value: string, direction: 'up' | 'down', time: number) => {
                    const { apiClient } = await import('@src/shared/api/client');
                    const numValue = parseFloat(value);
                    
                    // Парсим валютную пару (например, "BTC/USDT (OTC)" -> baseCurrency = "BTC")
                    const pairWithoutOtc = pair.trim().replace(/\s*\(OTC\)\s*$/i, '');
                    const [baseCurrency] = pairWithoutOtc.split('/');
                    
                    // Преобразуем direction: 'up' -> 'buy', 'down' -> 'sell'
                    const tradeDirection = direction === 'up' ? 'buy' : 'sell';
                    
                    // Сохраняем текущие значения
                    const originalAmount = manualTradeAmountRef.current;
                    const originalExpiration = expirationSecondsRef.current;
                    const originalBase = selectedBase;
                    
                    try {
                      // Если валюта не совпадает, переключаемся на валюту сигнала
                      if (baseCurrency && baseCurrency.toUpperCase() !== selectedBase.toUpperCase()) {
                        props.onBaseChange(baseCurrency.toUpperCase());
                        // Ждем немного, чтобы валюта переключилась
                        await new Promise(resolve => setTimeout(resolve, 100));
                      }
                      
                      // Устанавливаем значения из сигнала
                      manualTradeAmountRef.current = numValue.toString();
                      expirationSecondsRef.current = time.toString();
                      
                      // Создаем сигнал
                      await apiClient('/copy-trading/signals', {
                        method: 'POST',
                        body: {
                          pair: pair.trim(),
                          direction: direction,
                          value: numValue,
                          expiration_seconds: time,
                        },
                      });
                      
                      // Автоматически открываем сделку для автора сигнала
                      // Используем setTimeout, чтобы убедиться, что валюта переключилась и сигнал создан
                      setTimeout(() => {
                        try {
                          handleManualTrade(tradeDirection);
                        } catch (error) {
                        }
                      }, 300);
                      
                    } catch (error) {
                      // Восстанавливаем значения при ошибке
                      manualTradeAmountRef.current = originalAmount;
                      expirationSecondsRef.current = originalExpiration;
                      if (originalBase !== selectedBase) {
                        props.onBaseChange(originalBase);
                      }
                      throw error;
                    }
                    
                    // Восстанавливаем оригинальные значения после успешного создания
                    // Делаем это с задержкой, чтобы сделка успела открыться
                    setTimeout(() => {
                      manualTradeAmountRef.current = originalAmount;
                      expirationSecondsRef.current = originalExpiration;
                      // Не восстанавливаем валюту автоматически, так как пользователь может хотеть торговать этой валютой
                    }, 1000);
                  }}
                  investmentAmount={manualTradeAmount ? parseFloat(manualTradeAmount.replace(',', '.')) || 0 : 0}
          />
        )}

      </div>
    </div>
  );
};

