import { Suspense, lazy, useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from "@src/shared/lib/hooks";
import { selectSelectedBase, setSelectedBase } from "@src/entities/trading/model";
import { fetchTransactions } from "@src/entities/transactions/model/slice";
import { fetchTradingDurations, clearTradingError } from "@src/entities/trading/model/slice";
import { selectTradingDurations } from "@src/entities/trading/model/selectors";
import { selectTradingMode, setTradingMode } from '@src/entities/trading/model';
import { selectProfile, selectProfileLoading } from "@src/entities/user/model/selectors";
import { fetchProfile } from "@src/entities/user/model/slice";
import { fetchCurrencyCategories } from "@src/entities/currency/model/slice";
import { selectCurrencyCategories, selectCurrencyCategoriesLoading, selectCurrencyCategoriesError } from "@src/entities/currency/model/selectors";
import { apiClient, currencyApi, type CurrencyCategory, type Currency } from "@src/shared/api";
import { setTradeHistory, setNewTradesCount } from "@src/entities/trading/model/slice";
import type { TradeHistoryEntry } from "@src/entities/trading/model/types";
import { useTradingWebSocket } from "@src/entities/websoket/useTradingWebSocket";
import {
    WebSocketStartTradingRequest,
    WebSocketForceStopTradingMessage,
    WebSocketMessage,
    isTradingStartedMessage,
    isTradingForceStoppedMessage,
    isErrorMessage,
    isTradingStoppedMessage,
    isTransactionMessage,
} from "@src/entities/websoket/websocket-types";
import { tradingStore } from "@src/entities/trading/model/trading-store";
import "./TradingPage.css";
import { selectBots } from "@src/entities/bots/model/selectors.ts";
import { useLanguage } from "@src/app/providers/useLanguage.ts";
import { useNotification } from "@src/shared/ui/notification";
import { websocketStore } from "@/src/entities/websoket/websocket.store";
import { TradingDuration } from "@/src/entities/trading/model/types";
import { demoLog } from "@src/entities/demo-trading";
import { useSidebar, SidebarProvider } from '@src/shared/contexts/SidebarContext';
import { TradesHistoryModal } from '@src/widgets/trades-history-modal/TradesHistoryModal';
import { SignalsModal } from '@src/widgets/signals-modal/SignalsModal';
import { TradingHeader } from '@src/widgets/trading-header/TradingHeader';
import { Sidebar } from '@src/widgets/sidebar/Sidebar';
import { MobileMenuProvider } from '@src/shared/contexts/MobileMenuContext';
import { useMediaQuery } from '@src/shared/lib/hooks/useMediaQuery';
import { Header } from '@src/widgets/header/Header';
import { TradingTutorial } from '@src/widgets/onboarding/TradingTutorial';
import { RightSidebar } from '@src/features/trading-terminal/components/RightSidebar';
import { SignalsPanel } from '@src/features/trading-terminal/components/SignalsPanel';
import { TradesHistoryPanel } from '@src/features/trading-terminal/components/TradesHistoryPanel';
import { convertFromUSDSync } from '@src/shared/lib/currency/exchangeRates';
import './TradingPage.css';

const PricePanelWrapper = ({ children }: { children: React.ReactNode }) => {
    return <div className="price-panel-wrapper">{children}</div>;
};

const TradingControlsPanelWrapper = ({ children }: { children: React.ReactNode }) => {
    const { isCenterPanelVisible } = useSidebar();
    return <div className={`trading-controls-panel-wrapper ${!isCenterPanelVisible ? 'trading-controls-panel-wrapper--hidden' : ''}`}>{children}</div>;
};


const createRetryableLazyImport = <T,>(importFn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
        let attempts = 0;
        
        const attemptImport = () => {
            attempts++;
            importFn()
                .then(resolve)
                .catch((error) => {
                    const errorMessage = error?.message || String(error);
                    const statusCode = error?.status || error?.statusCode || '';
                    const isTimeoutError = 
                        errorMessage.includes("524") ||
                        errorMessage.includes("timeout") ||
                        errorMessage.includes("Timeout") ||
                        errorMessage.includes("Failed to fetch dynamically imported module") ||
                        statusCode === 524 ||
                        statusCode === 504;
                    
                    const isNetworkError = 
                        errorMessage.includes("Failed to fetch") ||
                        errorMessage.includes("CORS") ||
                        errorMessage.includes("NetworkError") ||
                        errorMessage.includes("NETWORK_ERROR") ||
                        errorMessage.includes("ERR_ABORTED") ||
                        errorMessage.includes("500") ||
                        errorMessage.includes("502") ||
                        errorMessage.includes("503");
                    
                    if (isTimeoutError && attempts < retries) {
                        console.warn(`[Lazy Import] Retry attempt ${attempts}/${retries} after timeout error:`, errorMessage);
                        setTimeout(attemptImport, delay * attempts);
                        return;
                    }
                    
                    if (isTimeoutError && attempts >= retries) {
                        console.error(`[Lazy Import] Max retries reached for timeout error. Reloading page...`);
                        setTimeout(() => {
                            window.location.reload();
                        }, 1000);
                        return;
                    }
                    
                    if (!isNetworkError && !isTimeoutError && (errorMessage.includes("Failed to fetch dynamically imported module") || errorMessage.includes("ERR_ABORTED"))) {
                        setTimeout(() => {
                            window.location.reload();
                        }, 1000);
                        return;
                    }
                    
                    if (isNetworkError) {
                        reject(new Error(`Network error: ${errorMessage}`));
                        return;
                    }
                    
                    reject(error);
                });
        };
        
        attemptImport();
    });
};

const TradingTerminalLazy = lazy(() =>
    createRetryableLazyImport(() => 
        import("@src/features/trading-terminal/TradingTerminal")
            .then((module) => ({
                default: module.TradingTerminal,
            }))
    )
);

const PricePanelLazy = lazy(() =>
    createRetryableLazyImport(() => 
        import("@src/widgets/price-panel/PricePanel")
            .then((module) => ({
                default: module.PricePanel,
            }))
    )
);

const TradingControlsPanelLazy = lazy(() =>
    createRetryableLazyImport(() => 
        import("@src/widgets/trading-controls-panel/TradingControlsPanel")
            .then((module) => ({
                default: module.TradingControlsPanel,
            }))
    )
);

const TradingPageComponent = () => {
    const dispatch = useAppDispatch();
    const { t } = useLanguage();
    const { showError } = useNotification();
    const location = useLocation();
    const selectedBase = useAppSelector(selectSelectedBase);
    const tradingDurations = useAppSelector(selectTradingDurations);
    const userProfile = useAppSelector(selectProfile);
    const profileLoading = useAppSelector(selectProfileLoading);
    const currencyCategories = useAppSelector(selectCurrencyCategories);
    const currenciesLoading = useAppSelector(selectCurrencyCategoriesLoading);
    const currenciesError = useAppSelector(selectCurrencyCategoriesError);
    const hasAttemptedLoadRef = useRef(false);
    const { sendMessage, isConnected, isReady, onMessage } = useTradingWebSocket();
    const store = tradingStore;
    const isMobile = useMediaQuery('(max-width: 1024px)');
    const dropdownRef = useRef<HTMLDivElement>(null);
    const durationDropdownRef = useRef<HTMLDivElement>(null);
    const [selectedDuration, setSelectedDuration] = useState<string>('1m');
    const [tradingStatus, setTradingStatus] = useState<{ is_trading: boolean }>({ is_trading: false });
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const bots = useAppSelector(selectBots);
    const [connectionMessage, setConnectionMessage] = useState<string | null>(null);
    const tradingMode = useAppSelector(selectTradingMode);
    const setTradingModeStore = (mode: 'manual' | 'demo') => {
        dispatch(setTradingMode(mode));
    };
    const [tradingModeLocal, setTradingModeLocal] = useState<'manual' | 'demo'>(() => {
        const saved = localStorage.getItem('tradingMode');
        return (saved === 'manual' || saved === 'demo') ? saved : 'manual';
    });
    
    useEffect(() => {
        if (tradingModeLocal !== tradingMode) {
            setTradingModeStore(tradingModeLocal);
        }
    }, [tradingModeLocal, tradingMode, setTradingModeStore]);
    
    useEffect(() => {
        if (tradingMode !== tradingModeLocal) {
            setTradingModeLocal(tradingMode);
        }
    }, [tradingMode]);
    const [showTimeCalculator, setShowTimeCalculator] = useState(false);
    const [timeCalculatorPosition, setTimeCalculatorPosition] = useState({ left: 0, top: 0 });
    const [showTutorial, setShowTutorial] = useState(false);
    const [isSignalsPanelOpen, setIsSignalsPanelOpen] = useState(true);
    const [isTradesHistoryPanelOpen, setIsTradesHistoryPanelOpen] = useState(true);
    const [isSignalsPanelClosing, setIsSignalsPanelClosing] = useState(false);
    const [isTradesHistoryPanelClosing, setIsTradesHistoryPanelClosing] = useState(false);
    const [shouldRenderSignalsPanel, setShouldRenderSignalsPanel] = useState(true);
    const [shouldRenderTradesHistoryPanel, setShouldRenderTradesHistoryPanel] = useState(true);

    // Обработка плавного закрытия панели сигналов
    useEffect(() => {
        if (!isSignalsPanelOpen && shouldRenderSignalsPanel) {
            setIsSignalsPanelClosing(true);
            const timer = setTimeout(() => {
                setShouldRenderSignalsPanel(false);
                setIsSignalsPanelClosing(false);
            }, 300); // Время анимации
            return () => clearTimeout(timer);
        } else if (isSignalsPanelOpen && !shouldRenderSignalsPanel) {
            setShouldRenderSignalsPanel(true);
            setIsSignalsPanelClosing(false);
        }
    }, [isSignalsPanelOpen, shouldRenderSignalsPanel]);

    // Обработка плавного закрытия панели истории
    useEffect(() => {
        if (!isTradesHistoryPanelOpen && shouldRenderTradesHistoryPanel) {
            setIsTradesHistoryPanelClosing(true);
            const timer = setTimeout(() => {
                setShouldRenderTradesHistoryPanel(false);
                setIsTradesHistoryPanelClosing(false);
            }, 300); // Время анимации
            return () => clearTimeout(timer);
        } else if (isTradesHistoryPanelOpen && !shouldRenderTradesHistoryPanel) {
            setShouldRenderTradesHistoryPanel(true);
            setIsTradesHistoryPanelClosing(false);
        }
    }, [isTradesHistoryPanelOpen, shouldRenderTradesHistoryPanel]);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }
        window.dispatchEvent(new CustomEvent<'manual' | 'demo'>('tradingModeChange', { detail: tradingModeLocal }));
    }, [tradingModeLocal]);

    const demoBalance = Number(userProfile?.demo_balance ?? 0);

    useEffect(() => {
        if (!location.pathname.startsWith('/trading') && tradingModeLocal === 'demo') {
            setTradingModeLocal('manual');
            localStorage.setItem('tradingMode', 'manual');
        }
    }, [location.pathname, tradingModeLocal]);

    // Загружаем категории валют один раз при монтировании страницы
    useEffect(() => {
        // Не загружаем, если:
        // 1. Данные уже загружены
        // 2. Загрузка уже выполняется
        // 3. Уже была попытка загрузки
        // Если была ошибка, пробуем еще раз (но только один раз)
        if (currencyCategories.length > 0 || currenciesLoading || hasAttemptedLoadRef.current) {
            return;
        }
        
        // Если была ошибка, сбрасываем состояние и пробуем загрузить снова
        if (currenciesError) {
            // Пробуем только один раз даже при ошибке
            if (hasAttemptedLoadRef.current) {
                return;
            }
        }
        
        hasAttemptedLoadRef.current = true;
        dispatch(fetchCurrencyCategories());
    }, [dispatch, currencyCategories.length, currenciesLoading, currenciesError]);

    // Загружаем профиль при переключении на демо режим, но только если демо баланс не загружен
    useEffect(() => {
        if (tradingModeLocal === 'demo' && (!userProfile?.demo_balance && userProfile?.demo_balance !== 0)) {
            dispatch(fetchProfile());
        }
    }, [dispatch, tradingModeLocal, userProfile?.demo_balance]);
    
    useEffect(() => {
        if (tradingModeLocal === 'demo') {
            demoLog('TradingPage demo balance state changed', { demoBalance });
        }
    }, [demoBalance, tradingModeLocal]);
    
    const [pricePanelData, setPricePanelData] = useState<any>(null);
    const pricePanelDataRef = useRef<any>(null);
    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        const originalSetAttribute = HTMLElement.prototype.setAttribute;
        const originalToggleAttribute = HTMLElement.prototype.toggleAttribute;
        const originalPopoverDescriptor = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'popover');
        const originalShowPopover = (HTMLElement.prototype as any).showPopover;
        const originalHidePopover = (HTMLElement.prototype as any).hidePopover;

        const isPopoverAttr = (element: HTMLElement, name: string) =>
            element instanceof HTMLCanvasElement && name.toLowerCase() === 'popover';

        HTMLElement.prototype.setAttribute = function(name: string, value: string) {
            if (isPopoverAttr(this, name)) {
                return;
            }
            return originalSetAttribute.call(this, name, value);
        };

        HTMLElement.prototype.toggleAttribute = function(name: string, force?: boolean) {
            if (isPopoverAttr(this, name)) {
                return this.hasAttribute(name);
            }
            return originalToggleAttribute.call(this, name, force);
        };

        Object.defineProperty(HTMLCanvasElement.prototype, 'popover', {
            configurable: true,
            enumerable: false,
            get() {
                return undefined;
            },
            set() {
                // Игнорируем попытки установить popover
            },
        });

        if (typeof originalShowPopover === 'function') {
            (HTMLElement.prototype as any).showPopover = function (...args: any[]) {
                try {
                    if (!(this instanceof HTMLElement)) {
                        return;
                    }
                    if (!document.contains(this as Node)) {
                        return;
                    }
                    if (!this.isConnected) {
                        return;
                    }
                    if (this instanceof HTMLCanvasElement) {
                        return;
                    }
                    const popoverAttr = this.getAttribute('popover');
                    if (!popoverAttr) {
                        return;
                    }
                    if ((this as any).popover === undefined && popoverAttr === null) {
                        return;
                    }
                    return originalShowPopover.apply(this, args);
                } catch (error) {
                    if (error instanceof DOMException) {
                        if (
                            error.name === 'NotSupportedError' || 
                            error.name === 'InvalidStateError' ||
                            error.message?.includes('disconnected') ||
                            error.message?.includes('Invalid on disconnected') ||
                            error.message?.includes('Not supported on elements that are not popovers')
                        ) {
                            return;
                        }
                    }
                    if (error instanceof Error && (
                        error.message?.includes('popover') ||
                        error.message?.includes('Not supported')
                    )) {
                        return;
                    }
                    return;
                }
            };
        }

        if (typeof originalHidePopover === 'function') {
            (HTMLElement.prototype as any).hidePopover = function (...args: any[]) {
                try {
                    if (!(this instanceof HTMLElement)) {
                        return;
                    }
                    if (!document.contains(this as Node)) {
                        return;
                    }
                    if (!this.isConnected) {
                        return;
                    }
                    if (this instanceof HTMLCanvasElement) {
                        return;
                    }
                    const popoverAttr = this.getAttribute('popover');
                    if (!popoverAttr) {
                        return;
                    }
                    if ((this as any).popover === undefined && popoverAttr === null) {
                        return;
                    }
                    return originalHidePopover.apply(this, args);
                } catch (error) {
                    if (error instanceof DOMException) {
                        if (
                            error.name === 'NotSupportedError' || 
                            error.name === 'InvalidStateError' ||
                            error.message?.includes('disconnected') ||
                            error.message?.includes('Invalid on disconnected') ||
                            error.message?.includes('Not supported on elements that are not popovers')
                        ) {
                            return;
                        }
                    }
                    if (error instanceof Error && (
                        error.message?.includes('popover') ||
                        error.message?.includes('Not supported')
                    )) {
                        return;
                    }
                    return;
                }
            };
        }

        return () => {
            HTMLElement.prototype.setAttribute = originalSetAttribute;
            HTMLElement.prototype.toggleAttribute = originalToggleAttribute;

            if (originalPopoverDescriptor) {
                Object.defineProperty(HTMLCanvasElement.prototype, 'popover', originalPopoverDescriptor);
            } else {
                delete (HTMLCanvasElement.prototype as any).popover;
            }

            if (typeof originalShowPopover === 'function') {
                (HTMLElement.prototype as any).showPopover = originalShowPopover;
            }

            if (typeof originalHidePopover === 'function') {
                (HTMLElement.prototype as any).hidePopover = originalHidePopover;
            }
        };
    }, []);

    // Обновляем ref при изменении pricePanelData, но не вызываем ререндер
    useEffect(() => {
      pricePanelDataRef.current = pricePanelData;
      if (pricePanelData) {
      }
    }, [pricePanelData]);
    
    const handleTradingModeChange = (mode: 'manual' | 'demo') => {
        console.log('[TradingPage] 🔄 ========== ПЕРЕКЛЮЧЕНИЕ РЕЖИМА ТОРГОВЛИ ==========');
        console.log('[TradingPage] 🔄 Старый режим:', tradingModeLocal);
        console.log('[TradingPage] 🔄 Новый режим:', mode);
        console.log('[TradingPage] 🔄 Демо баланс:', userProfile?.demo_balance);
        console.log('[TradingPage] 🔄 Реальный баланс:', userProfile?.balance);
        
        // Обновляем Redux сразу, чтобы избежать задержки
        dispatch(setTradingMode(mode));
        setTradingModeLocal(mode);
        localStorage.setItem('tradingMode', mode);
        
        console.log('[TradingPage] 🔄 Redux и localStorage обновлены');
        
        if (isConnected && sendMessage) {
            sendMessage({
                type: 'set-trading-mode',
                mode: mode
            });
            console.log('[TradingPage] 🔄 Сообщение set-trading-mode отправлено через WebSocket');
        } else {
            console.log('[TradingPage] 🔄 WebSocket не подключен, пропуск отправки сообщения');
        }
        
        console.log('[TradingPage] 🔄 ========== ПЕРЕКЛЮЧЕНИЕ РЕЖИМА ЗАВЕРШЕНО ==========');
    };
    
    // Объявляем handleDurationSelect перед handleDurationSelectCallback
    const handleDurationSelect = (duration: TradingDuration) => {
        setSelectedDuration(duration.duration);
        store.setIntervalMs(duration.seconds * 1000);
        store.closeDurationDropdown();
    };
    
    const handleDurationSelectCallback = (duration: string) => {
        const tradingDuration = tradingDurations.find(d => d.duration === duration);
        if (tradingDuration) {
            handleDurationSelect(tradingDuration);
        }
    };

    const handleRequestActiveTrades = () => {
        if (pricePanelData?.requestActiveTrades) {
            pricePanelData.requestActiveTrades();
        } else if (isConnected && sendMessage) {
            const currentMode = tradingMode;
            if (currentMode === 'manual' || currentMode === 'demo') {
                sendMessage({
                    type: 'get-active-manual-trades',
                    mode: currentMode,
                    requestId: `active_${Date.now()}_${Math.random()}`,
                } as any);
            }
        }
    };

    const handleRequestTradeHistory = () => {
        console.log('[TradingPage] handleRequestTradeHistory вызван', { 
            hasPricePanelData: !!pricePanelData, 
            hasRequestTradeHistory: !!pricePanelData?.requestTradeHistory,
            isConnected,
            hasSendMessage: !!sendMessage,
            tradingMode
        });
        
        // Всегда выполняем HTTP запрос для получения истории
        if (userProfile?.id && (tradingMode === 'manual' || tradingMode === 'demo')) {
            (async () => {
                try {
                    const params = new URLSearchParams({
                        limit: '50',
                        offset: '0',
                    });
                    params.append('mode', tradingMode);
                    
                    console.log('[TradingPage] handleRequestTradeHistory: HTTP запрос истории', { mode: tradingMode, userId: userProfile.id });
                    
                    const response = await apiClient<{ trades: any[]; count: number }>(
                        `/trading/history?${params.toString()}`
                    );
                    
                    console.log('[TradingPage] handleRequestTradeHistory: HTTP ответ', { 
                        hasResponse: !!response, 
                        hasTrades: !!response?.trades, 
                        tradesCount: response?.trades?.length ?? 0,
                        firstTrade: response?.trades?.[0],
                        responseData: response
                    });
                    
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
                        
                        console.log('[TradingPage] handleRequestTradeHistory: обновлено в Redux', { count: sortedTrades.length });
                    }
                } catch (error) {
                    console.error('[TradingPage] handleRequestTradeHistory: HTTP ошибка', error);
                }
            })();
        }
        
        // Также отправляем WebSocket запрос для синхронизации
        if (pricePanelData?.requestTradeHistory) {
            // Всегда загружаем полную историю, не только новые сделки
            console.log('[TradingPage] handleRequestTradeHistory: вызов pricePanelData.requestTradeHistory');
            try {
                const result = pricePanelData.requestTradeHistory(undefined, 50, false);
                console.log('[TradingPage] handleRequestTradeHistory: результат вызова', { result });
            } catch (error) {
                console.error('[TradingPage] handleRequestTradeHistory: ошибка при вызове', error);
            }
        } else if (isConnected && sendMessage) {
            console.log('[TradingPage] handleRequestTradeHistory: отправка через sendMessage');
            const currentMode = tradingMode;
            if (currentMode === 'manual' || currentMode === 'demo') {
                try {
                    sendMessage({
                        type: 'get-trade-history',
                        mode: currentMode,
                        limit: 50,
                        requestId: `history_${Date.now()}_${Math.random()}`,
                    } as any);
                    console.log('[TradingPage] handleRequestTradeHistory: сообщение отправлено через sendMessage');
                } catch (error) {
                    console.error('[TradingPage] handleRequestTradeHistory: ошибка отправки через sendMessage', error);
                }
            } else {
                console.warn('[TradingPage] handleRequestTradeHistory: режим не manual/demo', { currentMode });
            }
        }
    };
    
    const handleManualTradeRef = useRef<((direction: 'buy' | 'sell') => void) | null>(null);
    
    useEffect(() => {
        if (pricePanelData?.handleManualTrade) {
            handleManualTradeRef.current = pricePanelData.handleManualTrade;
        }
    }, [pricePanelData?.handleManualTrade]);
    
    const handleManualTradeWrapper = (direction: 'buy' | 'sell') => {
        if (handleManualTradeRef.current) {
            handleManualTradeRef.current(direction);
        } else {
        }
    };
    
    // Мемоизируем пропсы для PricePanel, чтобы предотвратить ререндеры
    if (!pricePanelData) {
    }
    // Используем currentMarketPrice как fallback, если currentPrice равен null
    // Это гарантирует, что кнопки будут активны, как только придут тики
    const effective_current_price = pricePanelData?.currentPrice ?? pricePanelData?.currentMarketPrice ?? null;
    const pricePanelProps = {
        currentPrice: effective_current_price,
        price1: pricePanelData?.price1 ?? null,
        price2: pricePanelData?.price2 ?? null,
        priceDiff: pricePanelData?.priceDiff ?? 0,
        priceDiffPercent: pricePanelData?.priceDiffPercent ?? 0,
        spreadPercent: pricePanelData?.spreadPercent ?? 0,
        activeTrades: pricePanelData?.activeTrades || [],
        tradeHistory: pricePanelData?.tradeHistory || [],
        manualTradeAmount: pricePanelData?.manualTradeAmount ?? '1.00',
        setManualTradeAmount: pricePanelData?.setManualTradeAmount ?? (() => {}),
        handleManualTrade: handleManualTradeWrapper,
        formatPrice: pricePanelData?.formatPrice ?? ((price: number | null) => price?.toFixed(2) || '0.00'),
        formatHMS: pricePanelData?.formatHMS ?? ((totalSeconds: number) => {
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;
            return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }),
        parsedExpiration: pricePanelData?.parsedExpiration ?? 30,
        changeExpiration: pricePanelData?.changeExpiration ?? (() => {}),
        setExpirationSeconds: pricePanelData?.setExpirationSeconds ?? (() => {}),
        quickPresets: pricePanelData?.quickPresets ?? [],
        setHoveredButton: pricePanelData?.setHoveredButton ?? (() => {}),
        quoteCurrency: pricePanelData?.quoteCurrency ?? 'USDT',
        onLoadMoreHistory: pricePanelData?.onLoadMoreHistory,
        isLoadingMoreHistory: pricePanelData?.isLoadingMoreHistory ?? false,
        hasMoreHistory: pricePanelData?.hasMoreHistory ?? false,
        getCurrencyInfo: pricePanelData?.getCurrencyInfo,
        resolveCurrencyIconUrls: pricePanelData?.resolveCurrencyIconUrls,
        onRequestActiveTrades: handleRequestActiveTrades,
        onRequestTradeHistory: handleRequestTradeHistory,
    };
    
    // В демо режиме показываем демо баланс, иначе реальный
    // Используем useMemo с ключом режима для принудительного обновления при смене режима
    // КРИТИЧЕСКИ ВАЖНО: В демо режиме ИГНОРИРУЕМ userProfile?.balance полностью
    // Это предотвращает переключение баланса на реальный при любых обновлениях профиля
    const actualBalance = tradingModeLocal === 'demo' ? demoBalance : Number(userProfile?.balance || 0);
    
    // Логирование баланса отключено для уменьшения спама
    
    // Отслеживаем предыдущий режим для определения переключения
    const prevTradingModeRef = useRef(tradingModeLocal);
    
    useEffect(() => {
        console.log('[TradingPage] 🔍 useEffect для обновления суммы ставки:', {
            tradingModeLocal,
            prevTradingMode: prevTradingModeRef.current,
            actualBalance,
            hasSetManualTradeAmount: !!pricePanelData?.setManualTradeAmount,
            currentManualAmount: pricePanelData?.manualTradeAmount
        });
        
        if (pricePanelData?.setManualTradeAmount) {
            const modeChanged = prevTradingModeRef.current !== tradingModeLocal;
            const switchedToDemo = modeChanged && tradingModeLocal === 'demo';
            const switchedToManual = modeChanged && tradingModeLocal === 'manual';
            
            // При переключении на демо режим с балансом > 0 устанавливаем минимальную сумму
            if (switchedToDemo && actualBalance > 0) {
                const minAmountUSD = 1;
                const minAmountInUserCurrency = userProfile?.currency === 'USD'
                    ? minAmountUSD
                    : convertFromUSDSync(minAmountUSD, userProfile?.currency || 'USD');
                const formattedAmount = minAmountInUserCurrency.toFixed(2);
                console.log('[TradingPage] 🔄 Переключение на демо режим - устанавливаем минимальную сумму:', {
                    minAmountUSD,
                    minAmountInUserCurrency,
                    formattedAmount,
                    userCurrency: userProfile?.currency || 'USD'
                });
                pricePanelData.setManualTradeAmount(formattedAmount);
            }
            // Сбрасываем только если баланс действительно 0 в manual режиме
            else if (actualBalance === 0 && tradingModeLocal !== 'demo') {
                console.log('[TradingPage] 🔄 Сброс суммы ставки на 0.00 (баланс = 0 в manual режиме)');
                pricePanelData.setManualTradeAmount('0.00');
            } else {
                console.log('[TradingPage] ✅ Сумма ставки не изменяется:', {
                    actualBalance,
                    tradingModeLocal,
                    modeChanged,
                    switchedToDemo,
                    switchedToManual,
                    reason: tradingModeLocal === 'demo' ? 'demo режим' : 'баланс > 0'
                });
            }
            
            // Обновляем предыдущий режим
            prevTradingModeRef.current = tradingModeLocal;
        }
    }, [tradingModeLocal, actualBalance, pricePanelData?.setManualTradeAmount, userProfile?.currency]);
    
    // Убрано логирование баланса для уменьшения нагрузки
    
    // Отслеживаем изменение режима для принудительного сброса анимации
    const prevTradingModeForBalance = useRef(tradingModeLocal);
    const [forceResetBalance, setForceResetBalance] = useState(false);
    
    useEffect(() => {
        if (prevTradingModeForBalance.current !== tradingModeLocal) {
            setForceResetBalance(true);
            prevTradingModeForBalance.current = tradingModeLocal;
            // Сбрасываем флаг после обновления
            setTimeout(() => setForceResetBalance(false), 0);
        }
    }, [tradingModeLocal]);




    const isTradingActive = store.isTradingActive || tradingStatus.is_trading;
    const allBotsDeactivated = bots.length > 0 && bots.every(bot => bot.status === 'DEACTIVATED');

    useEffect(() => {
        dispatch(fetchTradingDurations());
        dispatch(fetchTransactions());
        return () => {
            dispatch(clearTradingError());
        };
    }, [dispatch]);

    // Автоматически устанавливаем первый доступный duration при загрузке
    useEffect(() => {
        if (tradingDurations.length > 0) {
            // Сортируем и берем самый дешевый duration
            const sortedDurations = [...tradingDurations].sort((a, b) => {
                const costA = a.coin_cost || 0;
                const costB = b.coin_cost || 0;
                return costA - costB;
            });
            const firstDuration = sortedDurations[0];
            
            // Проверяем, не установлен ли уже правильный duration
            if (!tradingDurations.find(d => d.duration === selectedDuration)) {
                setSelectedDuration(firstDuration.duration);
                store.setIntervalMs(firstDuration.seconds * 1000);
            }
        }
    }, [tradingDurations, selectedDuration, store]);

    useEffect(() => {
        const checkTradingStatus = async () => {
            try {
                const status = await apiClient<{ is_trading: boolean }>(
                    `/trading/status`
                );
                setTradingStatus(status);
                store.setTradingActive(status.is_trading);
            } catch (error) {
            }
        };
        checkTradingStatus();
    }, [userProfile?.telegram_id, store]);

    // Удалено: больше не используем currencySlice.currentPair
    // Используем только tradingSlice.selectedBase из Redux

    useEffect(() => {
        const handleTradingMessages = (message: WebSocketMessage) => {
            if (isErrorMessage(message)) {
                const text = (message.message || '').toLowerCase();
                if (text.includes('аутентифика')) {
                    if (!websocketStore.hasUserId && userProfile?.id) {
                        websocketStore.setUserId(userProfile.id);
                    }
                    websocketStore.setAuthenticated(false);
                    websocketStore.retryAuthentication();
                    setIsProcessing(false);
                    return;
                }
            }
            if (isTradingStartedMessage(message)) {
                if (message.success) {
                    store.setTradingActive(true);
                    setTradingStatus({ is_trading: true });
                    setIsProcessing(false);
                } else {
                    showError(message.message || t('trading.userNotAuthenticated'));
                    setIsProcessing(false);
                }
            } else if (isTradingStoppedMessage(message)) {
                if (message.success) {
                    store.setTradingActive(false);
                    setTradingStatus({ is_trading: false });
                    setIsProcessing(false);
                    if (message.data?.finalProfit !== undefined) {
                        store.triggerPriceDifferenceFlash(message.data.finalProfit >= 0 ? 'green' : 'red');
                    }
                } else {
                    showError(message.message || 'Failed to stop trading');
                    setIsProcessing(false);
                }
            } else if (isTradingForceStoppedMessage(message)) {
                store.setTradingActive(false);
                setTradingStatus({ is_trading: false });
                setIsProcessing(false);
            } else if (isErrorMessage(message) && message.type === 'trading_error') {
                store.setTradingActive(false);
                setTradingStatus({ is_trading: false });
                setIsProcessing(false);
                showError(message.message);
            }
            else if (isTransactionMessage(message)) {
                const transactionType = message.transaction.type;
                store.triggerPriceDifferenceFlash(transactionType === 'REPLENISHMENT' ? 'green' : 'red');
                store.addNewTransaction(message.transaction.id);
            }
        };

        const unsubscribe = onMessage('*', handleTradingMessages);
        return () => {
            unsubscribe();
        };
    }, [onMessage, store, t, userProfile?.id]);

    // Удалено: автоматическое переключение валютных пар через setNextPair
    // Эта функциональность использовала устаревший currencySlice.currentPair
    // Если нужна автоматическая смена пар, её нужно реализовать через tradingSlice.selectedBase

    // Удален бесполезный setInterval с forceUpdate() - метод пустой и вызывал лишние ререндеры

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                store.closeDropdown();
            }
            if (durationDropdownRef.current && !durationDropdownRef.current.contains(event.target as Node)) {
                store.closeDurationDropdown();
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [store]);

    const allowedSeconds = [10, 30, 60, 120, 300, 600, 3600, 7200, 14400];
    const filtered = tradingDurations.filter(d => {
        const seconds = d.seconds || 0;
        return allowedSeconds.includes(seconds);
    });
    const sortedTradingDurations = filtered.sort((a, b) => {
        const secondsA = a.seconds || 0;
        const secondsB = b.seconds || 0;
        return secondsA - secondsB;
    });

    // handleDurationSelect перемещен выше, перед handleDurationSelectCallback

    const handleBaseChange = useCallback((base: string, quote?: string) => {
        // Используем Redux для обновления выбранной валютной пары
        // quote передается через TradingTerminal, который устанавливает forcedCurrency
        dispatch(setSelectedBase(base));
    }, [dispatch]);

    const handleStartTrading = useCallback(async () => {
        const userId = userProfile?.id;
        
        if (isTradingActive) {
            if (!userId) {
                showError(t('trading.userNotAuthenticated'));
                return;
            }
            
            const forceStopMessage: WebSocketForceStopTradingMessage = {
                type: 'force_stop_trading',
                userId: userId
            };
            sendMessage(forceStopMessage);
            setIsProcessing(true);
            return;
        }


        if (!isConnected) {
            showError(t('trading.websocketError'));
            return;
        }
        
        if (websocketStore.error?.includes('аутентификация')) {
            showError(t('trading.websocketAuthError'));
            return;
        }

        if (!userId) {
            showError(t('trading.userNotAuthenticated'));
            return;
        }

        if (userProfile?.trading_banned) {
            showError(t('trading.tradingBanned'));
            return;
        }
        
        if (tradingModeLocal !== 'demo' && Number(userProfile?.balance || 0) < 50) {
            showError(t('trading.minimumBalance'));
            return;
        }
        
        const duration = tradingDurations.find(d => d.duration === selectedDuration);
        if (!duration) {
            showError(t('trading.selectDuration'));
            return;
        }
        
        if (tradingModeLocal !== 'demo' && duration.coin_cost > Number(userProfile?.coins || 0)) {
            showError(t('trading.insufficientCoins'));
            return;
        }
        
        if (tradingModeLocal !== 'demo' && allBotsDeactivated) {
            showError(t('trading.trialEnded'));
            return;
        }

        setIsProcessing(true);

        const startMessage: WebSocketStartTradingRequest = {
            type: 'start_trading',
            duration: selectedDuration,
            userId: userId,
            mode: tradingMode
        };
        sendMessage(startMessage);
    }, [isConnected, store, selectedDuration, sendMessage, userProfile, tradingDurations, allBotsDeactivated, t, isTradingActive, tradingModeLocal, tradingMode]);

    if (profileLoading) {
        return (
            <div className="trading-page wrapper-page">
                <div className="loading-overlay">
                    <div className="loading-spinner-large"></div>
                    <p>{t('profile.loading')}</p>
                </div>
            </div>
        );
    }

    return (
        <MobileMenuProvider>
            <SidebarProvider>
                <div className="wrapper-body">
                        <TradingHeader onStartTutorial={() => setShowTutorial(true)} />
                        <div className="app-layout-wrapper">
                            <Sidebar />
                            <div className="page-content">
                                <div className="trading-page wrapper-page">

                    {connectionMessage && (
                        <div className="connection-message-overlay">
                            <span>{connectionMessage}</span>
                        </div>
                    )}

                    <Suspense fallback={<div className="trading-terminal__loading" />}>
                <div className="trading-terminal-wrapper">
                    <TradingTerminalLazy 
                        selectedBase={selectedBase}
                        onBaseChange={handleBaseChange}
                        isTradingActive={isTradingActive}
                        onStartTrading={handleStartTrading}
                        onOpenAddSignalModal={() => {
                            // Открываем модалку через глобальную функцию из TradingTerminal
                            if ((window as any).__tradingTerminalOpenAddSignalModal) {
                                (window as any).__tradingTerminalOpenAddSignalModal();
                            }
                        }}
                        selectedDuration={selectedDuration}
                        onDurationSelect={(duration) => {
                            const tradingDuration = tradingDurations.find(d => d.duration === duration);
                            if (tradingDuration) {
                                handleDurationSelect(tradingDuration);
                            }
                        }}
                        tradingDurations={sortedTradingDurations}
                        isProcessing={isProcessing}
                        tradingMode={tradingModeLocal}
                        onTradingModeChange={handleTradingModeChange}
                        userProfile={userProfile}
                        balance={actualBalance}
                        sendMessage={sendMessage}
                        onMessage={onMessage}
                        isConnected={isConnected}
                        isReady={isReady}
                        onPricePanelData={setPricePanelData}
                        onTimeCalculatorOpen={(position) => {
                            console.log('[TradingPage] onTimeCalculatorOpen вызван (TradingTerminal overlay) - передаем в TradingTerminal', {
                                position,
                                isMobile
                            });
                            // TimeCalculator теперь открывается внутри TradingTerminal
                            // Не устанавливаем состояние здесь, чтобы избежать конфликтов
                        }}
                    />
                    
                    {!isMobile && (
                        <div className="mobile-trading-controls-container">
                            <TradingControlsPanelLazy
                                balance={actualBalance}
                                manualTradeAmount={pricePanelProps.manualTradeAmount}
                                setManualTradeAmount={pricePanelProps.setManualTradeAmount}
                                handleManualTrade={pricePanelProps.handleManualTrade}
                                formatHMS={pricePanelProps.formatHMS}
                                parsedExpiration={pricePanelProps.parsedExpiration}
                                changeExpiration={pricePanelProps.changeExpiration}
                                setExpirationSeconds={pricePanelProps.setExpirationSeconds}
                                quickPresets={pricePanelProps.quickPresets}
                                setHoveredButton={pricePanelProps.setHoveredButton}
                                isProcessing={isProcessing}
                                currentPrice={pricePanelProps.currentPrice}
                                tradingMode={tradingModeLocal}
                                onTradingModeChange={handleTradingModeChange}
                                isTradingActive={isTradingActive}
                                onTimeCalculatorOpen={(position) => {
                                    console.log('[TradingPage] onTimeCalculatorOpen вызван (мобильная версия)', {
                                        position,
                                        isMobile
                                    });
                                    setTimeCalculatorPosition(position);
                                    setShowTimeCalculator(true);
                                }}
                                selectedBase={selectedBase}
                                getCurrencyInfo={pricePanelProps.getCurrencyInfo}
                                resolveCurrencyIconUrls={pricePanelProps.resolveCurrencyIconUrls}
                            />
                        </div>
                    )}
                </div>
            </Suspense>
            
            {!isMobile && (
                <>
                    <Suspense fallback={<div className="price-panel__loading" />}>
                        <TradingControlsPanelWrapper>
                        <TradingControlsPanelLazy
                            balance={actualBalance}
                            manualTradeAmount={pricePanelProps.manualTradeAmount}
                            setManualTradeAmount={pricePanelProps.setManualTradeAmount}
                            handleManualTrade={pricePanelProps.handleManualTrade}
                            formatHMS={pricePanelProps.formatHMS}
                            parsedExpiration={pricePanelProps.parsedExpiration}
                            changeExpiration={pricePanelProps.changeExpiration}
                            setExpirationSeconds={pricePanelProps.setExpirationSeconds}
                            quickPresets={pricePanelProps.quickPresets}
                            setHoveredButton={pricePanelProps.setHoveredButton}
                            isProcessing={isProcessing}
                            currentPrice={pricePanelProps.currentPrice}
                            tradingMode={tradingModeLocal}
                            onTradingModeChange={handleTradingModeChange}
                            isTradingActive={isTradingActive}
                            onTimeCalculatorOpen={(position) => {
                                console.log('[TradingPage] onTimeCalculatorOpen вызван (десктоп версия) - вызываем глобальную функцию', {
                                    position,
                                    isMobile
                                });
                                // Вызываем глобальную функцию из TradingTerminal для открытия TimeCalculator
                                if ((window as any).__tradingTerminalOpenTimeCalculator) {
                                    (window as any).__tradingTerminalOpenTimeCalculator(position);
                                } else {
                                    console.warn('[TradingPage] __tradingTerminalOpenTimeCalculator не доступна');
                                }
                            }}
                            selectedBase={selectedBase}
                            getCurrencyInfo={pricePanelProps.getCurrencyInfo}
                            resolveCurrencyIconUrls={pricePanelProps.resolveCurrencyIconUrls}
                        />
                        </TradingControlsPanelWrapper>
                    </Suspense>
                    
                    {/* Панели выезжают между trading-controls-panel-wrapper и right-sidebar-wrapper (вместо price-panel-wrapper) */}
                    <div className={`panels-wrapper ${(shouldRenderSignalsPanel || shouldRenderTradesHistoryPanel) ? 'panels-wrapper--visible' : ''}`}>
                        {shouldRenderTradesHistoryPanel && (
                            <TradesHistoryPanel
                                isOpen={isTradesHistoryPanelOpen}
                                onClose={() => {}}
                                selectedBase={selectedBase}
                                quoteCurrency={pricePanelProps.quoteCurrency}
                                onLoadMoreHistory={pricePanelProps.onLoadMoreHistory}
                                isLoadingMoreHistory={pricePanelProps.isLoadingMoreHistory}
                                hasMoreHistory={pricePanelProps.hasMoreHistory}
                                getCurrencyInfo={pricePanelProps.getCurrencyInfo}
                                resolveCurrencyIconUrls={pricePanelProps.resolveCurrencyIconUrls}
                                onRequestActiveTrades={pricePanelProps.onRequestActiveTrades}
                                onRequestTradeHistory={pricePanelProps.onRequestTradeHistory}
                                isBothOpen={isSignalsPanelOpen && isTradesHistoryPanelOpen}
                                onOpenTradeSidebar={(trade: any) => {
                                  if ((window as any).__tradingTerminalOpenTradeSidebar) {
                                    (window as any).__tradingTerminalOpenTradeSidebar(trade);
                                  }
                                }}
                            />
                        )}
                        
                        {shouldRenderSignalsPanel && (
                            <SignalsPanel
                                isOpen={isSignalsPanelOpen}
                                onClose={() => {}}
                                selectedBase={selectedBase}
                                investmentAmount={pricePanelProps.manualTradeAmount ? parseFloat(String(pricePanelProps.manualTradeAmount).replace(',', '.')) || 0 : 0}
                                onOpenAddSignalModal={() => {
                                    if ((window as any).__tradingTerminalOpenAddSignalModal) {
                                        (window as any).__tradingTerminalOpenAddSignalModal();
                                    }
                                }}
                                isBothOpen={isSignalsPanelOpen && isTradesHistoryPanelOpen}
                            />
                        )}
                    </div>
                    
                    {/* Right Sidebar Column - стилизован как sidebar-menu */}
                    <div className="right-sidebar-wrapper">
                        <RightSidebar
                            onToggleSignals={() => {
                                setIsSignalsPanelOpen(prev => !prev);
                            }}
                            onToggleHistory={() => {
                                setIsTradesHistoryPanelOpen(prev => !prev);
                            }}
                            isSignalsOpen={isSignalsPanelOpen}
                            isHistoryOpen={isTradesHistoryPanelOpen}
                        />
                        <button
                            className="tutorial-button tutorial-button--sidebar"
                            onClick={() => {
                                // Закрываем все открытые меню перед запуском обучения
                                const chartMenu = document.querySelector('.chart-navigation-menu.open') as HTMLElement;
                                if (chartMenu) {
                                    const closeButton = chartMenu.querySelector('.chart-navigation-menu__close') as HTMLElement;
                                    if (closeButton) {
                                        closeButton.click();
                                    }
                                }
                                const navButton = document.querySelector('.chart-navigation-button.menu-open') as HTMLElement;
                                if (navButton) {
                                    navButton.click();
                                }
                                
                                setShowTutorial(true);
                                if (typeof window !== 'undefined' && (window as any).__startTradingTutorial) {
                                    (window as any).__startTradingTutorial();
                                }
                            }}
                            aria-label="Show tutorial"
                            title="Show tutorial"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none"/>
                                <path d="M12 16V12M12 8H12.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                            </svg>
                        </button>
                    </div>
                </>
            )}


            <TradesHistoryModal
                selectedBase={selectedBase}
                quoteCurrency={pricePanelProps.quoteCurrency}
                onLoadMoreHistory={pricePanelProps.onLoadMoreHistory}
                isLoadingMoreHistory={pricePanelProps.isLoadingMoreHistory}
                hasMoreHistory={pricePanelProps.hasMoreHistory}
                getCurrencyInfo={pricePanelProps.getCurrencyInfo}
                resolveCurrencyIconUrls={pricePanelProps.resolveCurrencyIconUrls}
                onRequestActiveTrades={pricePanelProps.onRequestActiveTrades}
                onRequestTradeHistory={pricePanelProps.onRequestTradeHistory}
                manualTradeAmount={pricePanelProps.manualTradeAmount}
            />
            
            <SignalsModal
                manualTradeAmount={pricePanelProps.manualTradeAmount}
            />
            
            <TradingTutorial forceShow={showTutorial} onClose={() => setShowTutorial(false)} />

                                </div>
                            </div>
                        </div>
                        <Header />
                    </div>
            </SidebarProvider>
        </MobileMenuProvider>
    );
};

export const TradingPage = TradingPageComponent;
