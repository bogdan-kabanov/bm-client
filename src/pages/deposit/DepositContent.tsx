import { useState, useEffect, useMemo, useCallback, useRef, JSX } from "react";
import { useAppDispatch, useAppSelector } from "@src/shared/lib/hooks.ts";
import { selectConfigLoading, selectWallets, selectConfigError } from "@src/entities/deposit/model/selectors.ts";
import { selectProfile } from "@src/entities/user/model/selectors.ts";
import { fetchWallets } from "@src/entities/deposit/model/slice.ts";
import { useLanguage } from "@src/app/providers/useLanguage.ts";
import { LanguageDropdown } from "@src/shared/ui/LanguageDropdown";
import { fetchBybitRates } from "@src/shared/lib/bybit-price-utils";
import { formatCurrency, getCurrencySymbol } from "@src/shared/lib/currency/currencyUtils";
import { depositApi, paymentMethodsApi, ampayApi, type StructuredCategory } from "@src/shared/api";
import { promocodeApi } from "@src/shared/api/promocode/promocodeApi";
import { detectUserCountry } from "@src/shared/lib/geolocation.util";

interface Deposit {
  id: number;
  user_id: number;
  amount: number;
  transaction_hash: string;
  wallet_type: 'usdt' | 'btc' | 'ltc' | 'eth';
  status: 'pending' | 'completed' | 'rejected';
  createdAt: string;
  updatedAt: string;
}

type TransactionItem = 
  | { type: 'deposit'; data: Deposit };

interface DepositMethod {
    id: string;
    name: string;
    symbol: string;
    network?: string | null;
    minAmount: number;
    confirmations: number;
    bybitSymbol: string | null;
    bybitCategory: 'spot' | 'linear';
    fallbackRate: number;
    icon: JSX.Element;
}

type DepositCategoryId = string; // Может быть "crypto", "cards", "e-payments" или name_key категории криптовалют

interface DepositCategoryOption {
    id: DepositCategoryId;
    label: string;
    badge: string;
    available: boolean;
    description?: string;
    icon?: JSX.Element;
}

interface DepositContentProps {
    showLanguageDropdown?: boolean;
}

export function DepositContent({ showLanguageDropdown = true }: DepositContentProps) {
    const dispatch = useAppDispatch();
    const wallets = useAppSelector(selectWallets);
    const loading = useAppSelector(selectConfigLoading);
    const error = useAppSelector(selectConfigError);
    const userData = useAppSelector(selectProfile);
    const userCurrency = userData?.currency || 'USD';
    const { t } = useLanguage();

    const reloadPaymentMethodsRef = useRef<(() => Promise<void>) | null>(null);


    const [structuredData, setStructuredData] = useState<StructuredCategory[]>([]);
    const [userCountryCode, setUserCountryCode] = useState<string | null>(null);
    const [loadingPaymentMethods, setLoadingPaymentMethods] = useState(true);
    const [selectedAmpayCard, setSelectedAmpayCard] = useState<any>(null);
    const [cardSubMethods, setCardSubMethods] = useState<Record<string, 'FTD' | 'STD'>>({});

    const profileCountryCode =
        (userData as any)?.country ||
        (userData as any)?.country_code ||
        (userData as any)?.countryCode ||
        null;

    useEffect(() => {
        const loadPaymentMethodsData = async () => {
            try {
                setLoadingPaymentMethods(true);
                
                let countryCode: string | null = null;
                const geoData = profileCountryCode ? { countryCode: profileCountryCode } : await detectUserCountry();
                countryCode = geoData?.countryCode || null;
                
                setUserCountryCode(countryCode);
                
                if (!countryCode) {
                    setStructuredData([]);
                    setLoadingPaymentMethods(false);
                    return;
                }

                // Request only deposit methods (IN direction)
                const data = await paymentMethodsApi.getStructured(countryCode, 'IN');
                setStructuredData(Array.isArray(data) ? data : []);
            } catch (error) {

                setStructuredData([]);
            } finally {
                setLoadingPaymentMethods(false);
            }
        };

        reloadPaymentMethodsRef.current = loadPaymentMethodsData;
        loadPaymentMethodsData();
    }, [profileCountryCode]);

    // Группировка методов оплаты по категориям
    const paymentMethodsByCategory = useMemo(() => {
        const result: Record<DepositCategoryId, Array<{ method: any; cryptos: DepositMethod[] }>> = {
            crypto: [],
            cards: [],
            "e-payments": [],
        };
        
        for (const category of structuredData) {
            let categoryId: DepositCategoryId = "crypto";
            const hasCryptos = category.methods.some(m => m.type === 'crypto' && m.cryptocurrencies.length > 0);
            const hasCards = category.methods.some(m => m.type === 'card' && m.cards.length > 0);
            const hasEwallets = category.methods.some(m => m.type === 'ewallet');
            
            if (hasCryptos && !hasEwallets) {
                categoryId = "crypto";
            } else if (hasCards || hasEwallets) {
                categoryId = "cards";
            } else if (hasCryptos) {
                categoryId = "crypto";
            }
            
            for (const method of category.methods) {
                if (method.type === 'crypto' && method.cryptocurrencies.length > 0) {
                    const cryptos: DepositMethod[] = method.cryptocurrencies.map(crypto => {
                        const symbol = crypto.symbol?.toUpperCase() || '';
                        const isStableCoin = symbol === 'USDT' || symbol === 'USDC';
                        const bybitSymbol = isStableCoin ? null : symbol ? `${symbol}USDT` : null;
                        const fallbackRate = isStableCoin ? 1 : symbol === 'BTC' ? 60000 : symbol === 'ETH' ? 3000 : symbol === 'LTC' ? 100 : 100;
                        
                        // Используем name_key в первую очередь для уникальности
                        // Если name_key одинаковый, добавляем network для уникальности
                        const cryptoId = crypto.name_key 
                            ? (crypto.network ? `${crypto.name_key}_${crypto.network}` : crypto.name_key)
                            : (crypto.network ? `${crypto.symbol}_${crypto.network}` : crypto.symbol) || `crypto_${crypto.id}`;
                        
                        return {
                            id: cryptoId,
                            name: crypto.name,
                            symbol: crypto.symbol,
                            network: crypto.network || null,
                            minAmount: crypto.min_amount !== null && crypto.min_amount !== undefined ? crypto.min_amount : 20,
                            confirmations: 20,
                            bybitSymbol: bybitSymbol,
                            bybitCategory: 'spot' as const,
                            fallbackRate: fallbackRate,
                            icon: crypto.icon ? <img src={crypto.icon} alt={crypto.symbol} width={35} /> : <div className="deposit-method-card__placeholder">{crypto.symbol}</div>,
                        };
                    });
                    result[categoryId].push({ method, cryptos });
                } else if (method.type === 'ewallet' && method.cryptocurrencies && method.cryptocurrencies.length > 0) {
                    const cryptos: DepositMethod[] = method.cryptocurrencies.map(crypto => {
                        const symbol = crypto.symbol?.toUpperCase() || '';
                        const isStableCoin = symbol === 'USDT' || symbol === 'USDC';
                        const bybitSymbol = isStableCoin ? null : symbol ? `${symbol}USDT` : null;
                        const fallbackRate = isStableCoin ? 1 : symbol === 'BTC' ? 60000 : symbol === 'ETH' ? 3000 : symbol === 'LTC' ? 100 : 100;
                        
                        // Используем name_key в первую очередь для уникальности
                        // Если name_key одинаковый, добавляем network для уникальности
                        const cryptoId = crypto.name_key 
                            ? (crypto.network ? `${crypto.name_key}_${crypto.network}` : crypto.name_key)
                            : (crypto.network ? `${crypto.symbol}_${crypto.network}` : crypto.symbol) || `crypto_${crypto.id}`;
                        
                        return {
                            id: cryptoId,
                            name: crypto.name,
                            symbol: crypto.symbol,
                            network: crypto.network || null,
                            minAmount: crypto.min_amount !== null && crypto.min_amount !== undefined ? crypto.min_amount : 20,
                            confirmations: 20,
                            bybitSymbol: bybitSymbol,
                            bybitCategory: 'spot' as const,
                            fallbackRate: fallbackRate,
                            icon: crypto.icon ? <img src={crypto.icon} alt={crypto.symbol} width={35} /> : <div className="deposit-method-card__placeholder">{crypto.symbol}</div>,
                        };
                    });
                    result["cards"].push({ method, cryptos });
                }
            }
        }

        return result;
    }, [structuredData]);

    const depositMethods = useMemo<Record<DepositCategoryId, DepositMethod[]>>(() => {
        const result: Record<DepositCategoryId, DepositMethod[]> = {
            crypto: [],
            cards: [],
            "e-payments": [],
        };
        
        for (const category of structuredData) {
            const categoryId = category.name_key || `crypto_${category.id}`;
            
            for (const method of category.methods) {
                if (method.type === 'crypto' && method.cryptocurrencies.length > 0) {
                    if (!result[categoryId]) {
                        result[categoryId] = [];
                    }
                    
                    const existingIds = new Set(result[categoryId].map(m => m.id));
                    
                    for (const crypto of method.cryptocurrencies) {
                        // Используем name_key в первую очередь, так как он уникален для каждого метода
                        // Если name_key одинаковый, добавляем network для уникальности
                        // Это позволяет иметь несколько методов с одинаковым symbol (например, BNB на разных сетях)
                        const cryptoId = crypto.name_key 
                            ? (crypto.network ? `${crypto.name_key}_${crypto.network}` : crypto.name_key)
                            : (crypto.network ? `${crypto.symbol}_${crypto.network}` : crypto.symbol) || `crypto_${crypto.id}`;
                        if (!existingIds.has(cryptoId)) {
                            const symbol = crypto.symbol?.toUpperCase() || '';
                            const isStableCoin = symbol === 'USDT' || symbol === 'USDC';
                            
                            // Для BNB на разных сетях используем разные bybitSymbol, если сеть указана
                            // Это позволяет получать разные курсы для разных сетей
                            let bybitSymbol: string | null = null;
                            if (!isStableCoin && symbol) {
                                bybitSymbol = `${symbol}USDT`;
                            }
                            
                            // Для разных сетей одной валюты можно использовать разные fallback rates
                            // Это позволяет иметь разные курсы для разных сетей, даже если bybitSymbol одинаковый
                            let fallbackRate = isStableCoin ? 1 : symbol === 'BTC' ? 60000 : symbol === 'ETH' ? 3000 : symbol === 'LTC' ? 100 : 100;
                            
                            // Для BNB на разных сетях задаем разные fallback rates
                            // Это позволяет иметь разные курсы для разных сетей, учитывая возможные различия в цене
                            if (symbol === 'BNB' && crypto.network) {
                                const networkUpper = crypto.network.toUpperCase();
                                // Базовый курс BNB (примерно $900-950), с небольшими корректировками для разных сетей
                                // Разница может быть из-за комиссий, арбитража или других факторов
                                const baseBnbRate = 900; // Базовый курс BNB
                                if (networkUpper === 'BEACON') {
                                    fallbackRate = baseBnbRate; // Beacon Chain - базовый курс
                                } else if (networkUpper === 'OPBNB') {
                                    fallbackRate = baseBnbRate + 0.5; // OpBNB - немного выше из-за комиссий
                                } else if (networkUpper === 'BSC' || networkUpper === 'BNB') {
                                    fallbackRate = baseBnbRate - 0.3; // Smart Chain - немного ниже
                                } else {
                                    fallbackRate = baseBnbRate; // По умолчанию базовый курс
                                }
                            }
                            
                            result[categoryId].push({
                                id: cryptoId,
                                name: crypto.name,
                                symbol: crypto.symbol || '',
                                network: crypto.network || null,
                                minAmount: crypto.min_amount !== null && crypto.min_amount !== undefined ? crypto.min_amount : 20,
                                confirmations: 1,
                                bybitSymbol: bybitSymbol,
                                bybitCategory: 'spot' as const,
                                fallbackRate: fallbackRate,
                                icon: crypto.icon ? <img src={crypto.icon} alt={crypto.name} width={24} height={24} /> : <div className="deposit-method-card__placeholder">{crypto.symbol || crypto.name}</div>,
                            });
                            existingIds.add(cryptoId);
                        }
                    }
                } else if (method.type === 'card' && method.cards.length > 0) {
                }
            }
        }

        return result;
    }, [structuredData]);

    const categoryOptions = useMemo<DepositCategoryOption[]>(() => {
        const categories: DepositCategoryOption[] = [];
        const seenCategoryIds = new Set<DepositCategoryId>();
        
        for (const category of structuredData) {
            let hasCryptos = false;
            let hasCards = false;
            let hasEwallets = false;
            let cryptoCount = 0;
            let cardsCount = 0;
            let ewalletsCount = 0;
            
            let isCryptoCategory = false;
            
            for (const method of category.methods) {
                if (method.type === 'crypto') {
                    isCryptoCategory = true;
                    if (method.cryptocurrencies.length > 0) {
                        hasCryptos = true;
                        cryptoCount += method.cryptocurrencies.length;
                    }
                } else if (method.type === 'card' && method.cards.length > 0) {
                    hasCards = true;
                    cardsCount += method.cards.length;
                } else if (method.type === 'ewallet') {
                    hasEwallets = true;
                    ewalletsCount += 1;
                }
            }
            
            let categoryId: DepositCategoryId;
            let icon: JSX.Element;
            let description: string;
            let methodCount = 0;
            
            if (isCryptoCategory || hasCryptos) {
                categoryId = category.name_key || `crypto_${category.id}`;
                icon = category.icon ? <img src={category.icon} alt={category.name} width={24} height={24} /> : <div className="deposit-sidebar__icon-placeholder">{category.name?.charAt(0) || '?'}</div>;
                description = category.name;
                methodCount = cryptoCount;
            } else if (hasCards) {
                categoryId = "cards";
                icon = category.icon ? <img src={category.icon} alt={category.name} width={24} height={24} /> : <div className="deposit-sidebar__icon-placeholder">💳</div>;
                description = t("deposit.categories.cardsDescription") || "Deposit via bank cards and electronic payments.";
                methodCount = cardsCount;
            } else if (hasEwallets) {
                categoryId = "cards";
                icon = category.icon ? <img src={category.icon} alt={category.name} width={24} height={24} /> : <div className="deposit-sidebar__icon-placeholder">💳</div>;
                description = t("deposit.categories.cardsDescription") || "Deposit via bank cards and electronic payments.";
                methodCount = ewalletsCount;
            } else {
                continue;
            }
            
            if (seenCategoryIds.has(categoryId)) {
                const existingCategory = categories.find(c => c.id === categoryId);
                if (existingCategory) {
                    existingCategory.badge = String(parseInt(existingCategory.badge) + methodCount);
                    existingCategory.available = existingCategory.available || methodCount > 0;
                }
                continue;
            }
            
            seenCategoryIds.add(categoryId);
            categories.push({
                id: categoryId,
                label: category.name,
                badge: String(methodCount),
                available: methodCount > 0,
                description,
                icon,
            });
        }
        
        return categories;
    }, [structuredData, t]);

    const defaultCategory = useMemo(() => {
        const active = categoryOptions.find(option => option.available);
        return active?.id ?? "crypto";
    }, [categoryOptions]);

    const [activeCategory, setActiveCategory] = useState<DepositCategoryId>(() => {
        const active = categoryOptions.find(option => option.available);
        const initialCategory = active?.id ?? "crypto";
        return initialCategory;
    });
    
    const [userSelectedCategory, setUserSelectedCategory] = useState<DepositCategoryId | null>(null);
    
    useEffect(() => {
        if (categoryOptions.length === 0 || userSelectedCategory !== null) return;
        
        const active = categoryOptions.find(option => option.available);
        const newDefaultCategory = active?.id ?? "crypto";
        setActiveCategory(newDefaultCategory);
    }, [categoryOptions.length, userSelectedCategory]);

    const methodsToShow = useMemo(() => {
        const methods = depositMethods[activeCategory] ?? [];
        return methods;
    }, [depositMethods, activeCategory]);
    
    const isCryptoCategory = activeCategory !== "cards" && activeCategory !== "e-payments";
    const isCardsCategory = activeCategory === "cards";
    const activeCategoryOption = categoryOptions.find((option) => option.id === activeCategory);

    const cardsMethodsData = useMemo(() => {
        if (!isCardsCategory) return [];
        const result: Array<{ method: any; cards: any[]; isEwallet: boolean; cryptos: any[] }> = [];
        for (const category of structuredData) {
            for (const method of category.methods) {
                if (method.type === 'card' && method.cards.length > 0) {
                    result.push({ method, cards: method.cards, isEwallet: false, cryptos: [] });
                } else if (method.type === 'ewallet' && method.cryptocurrencies && method.cryptocurrencies.length > 0) {
                    result.push({ method, cards: [], isEwallet: true, cryptos: method.cryptocurrencies });
                }
            }
        }
        return result;
    }, [structuredData, isCardsCategory]);

    useEffect(() => {
        if (isCardsCategory && cardsMethodsData.length > 0) {
            const loadSubMethods = async () => {
                for (const item of cardsMethodsData) {
                    if (!item.isEwallet) {
                        for (const card of item.cards) {
                            if ((card.method === 'CARD' || card.method === 'CARD_WINDOW') && card.currency) {
                                const cardKey = `card-${card.id}`;
                                setCardSubMethods(prev => {
                                    if (prev[cardKey]) {
                                        return prev;
                                    }
                                    ampayApi.getCurrentSubMethod(card.method, card.currency)
                                        .then(response => {
                                            setCardSubMethods(prevState => ({
                                                ...prevState,
                                                [cardKey]: response.sub_method
                                            }));
                                        })
                                        .catch(error => {

                                        });
                                    return prev;
                                });
                            }
                        }
                    }
                }
            };
            loadSubMethods();
        }
    }, [isCardsCategory, cardsMethodsData]);

    const [selectedCurrency, setSelectedCurrency] = useState<string>(() => {
        // Инициализация будет выполнена после вычисления methodsToShow
        return "";
    });
    const [walletCopied, setWalletCopied] = useState(false);
    const [amountCopied, setAmountCopied] = useState(false);
    const [convertedAmount, setConvertedAmount] = useState<number>(0);
    const [minConverted, setMinConverted] = useState<number>(0);
    const [usdAmount, setUsdAmount] = useState<string>("");
    const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({});
    const [ratesLoading, setRatesLoading] = useState<boolean>(true);
    const [ratesError, setRatesError] = useState<string | null>(null);
    const [qrCodeError, setQrCodeError] = useState<boolean>(false);
    const [retryCount, setRetryCount] = useState(0);
    const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
    const [showPaymentDetails, setShowPaymentDetails] = useState(false);
    const [paymentTimer, setPaymentTimer] = useState(60 * 60); // 60 minutes in seconds

    const [transactionHash, setTransactionHash] = useState<string>("");
    const [promocode, setPromocode] = useState<string>("");
    const [promocodeValidation, setPromocodeValidation] = useState<{ valid: boolean; discount?: number; finalAmount?: number; error?: string } | null>(null);
    const [validatingPromocode, setValidatingPromocode] = useState<boolean>(false);
    const [referralPromocode, setReferralPromocode] = useState<{ promocodeId: number; code: string; name: string | null; isActive: boolean; discountType?: 'percentage' | 'fixed'; discountValue?: number; minAmount?: number | null; maxDiscount?: number | null; description?: string | null } | null>(null);
    const [referralPromocodeLoading, setReferralPromocodeLoading] = useState<boolean>(false);
    const [rejectedReferralPromocode, setRejectedReferralPromocode] = useState<boolean>(false);
    const [submitting, setSubmitting] = useState<boolean>(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [submitSuccess, setSubmitSuccess] = useState<boolean>(false);

    const [userDeposits, setUserDeposits] = useState<Deposit[]>([]);
    const [depositsLoading, setDepositsLoading] = useState<boolean>(false);
    const [depositsError, setDepositsError] = useState<string | null>(null);
    const [showDeposits, setShowDeposits] = useState<boolean>(false);
    const [depositFilter, setDepositFilter] = useState<'deposit' | 'all'>('deposit');
    const [depositDateRange, setDepositDateRange] = useState<{ start: string; end: string }>({
        start: new Date().toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });
    const [selectedEwalletMethod, setSelectedEwalletMethod] = useState<any>(null);
    const sortedUserDeposits = useMemo(() => {
        return [...userDeposits].sort((a, b) => {
            const date_a = new Date(a.createdAt).getTime();
            const date_b = new Date(b.createdAt).getTime();
            return date_a - date_b;
        });
    }, [userDeposits]);

    const handleCategoryChange = useCallback((categoryId: DepositCategoryId) => {
        setUserSelectedCategory(categoryId);
        setActiveCategory(categoryId);
        setShowPaymentDetails(false);
        setSelectedEwalletMethod(null);
        setSelectedAmpayCard(null);
        setSelectedCurrency("");
    }, []);
    
    // Функция для валидации промокода
    const validatePromocode = useCallback(async (code: string) => {
        if (!code.trim()) {
            setPromocodeValidation(null);
            return;
        }
        
        const numericAmount = parseFloat(usdAmount) || 0;
        if (!numericAmount || numericAmount <= 0) {
            setPromocodeValidation({ valid: false, error: t('deposit.promocodeEnterAmountError') });
            return;
        }
        
        setValidatingPromocode(true);
        try {
            const validation = await promocodeApi.validate(code.trim(), numericAmount);
            setPromocodeValidation(validation);
        } catch (error: any) {
            setPromocodeValidation({ valid: false, error: t('deposit.promocodeValidationError') });
        } finally {
            setValidatingPromocode(false);
        }
    }, [usdAmount]);
    
    // Валидируем промокод при изменении суммы или промокода
    useEffect(() => {
        const numericAmount = parseFloat(usdAmount) || 0;
        if (promocode.trim() && numericAmount > 0) {
            const timeoutId = setTimeout(() => {
                validatePromocode(promocode);
            }, 500);
            return () => clearTimeout(timeoutId);
        } else {
            setPromocodeValidation(null);
        }
    }, [promocode, usdAmount, validatePromocode]);

    // Загружаем промокод из реферальной ссылки при монтировании компонента
    useEffect(() => {
        const loadReferralPromocode = async () => {
            try {
                console.log('[DepositContent] 🔍 Загрузка промокода из реферальной ссылки для userId:', userData?.id);
                setReferralPromocodeLoading(true);
                const referralPromo = await promocodeApi.getReferralPromocode();
                console.log('[DepositContent] 📥 Ответ от API:', referralPromo);
                
                if (referralPromo && referralPromo.isActive) {
                    console.log('[DepositContent] ✅ Промокод найден и активен:', {
                        code: referralPromo.code,
                        name: referralPromo.name,
                        discountType: referralPromo.discountType,
                        discountValue: referralPromo.discountValue
                    });
                    setReferralPromocode(referralPromo);
                } else {
                    console.log('[DepositContent] ⚠️ Промокод не найден или неактивен:', {
                        found: !!referralPromo,
                        isActive: referralPromo?.isActive
                    });
                }
            } catch (error) {
                console.error('[DepositContent] ❌ Ошибка загрузки промокода из ссылки:', error);
            } finally {
                setReferralPromocodeLoading(false);
            }
        };

        if (userData?.id) {
            loadReferralPromocode();
        }
    }, [userData?.id]);

    // Валидируем промокод из ссылки при изменении суммы
    useEffect(() => {
        if (referralPromocode && !rejectedReferralPromocode && !promocode.trim() && usdAmount) {
            const numericAmount = parseFloat(usdAmount) || 0;
            if (numericAmount > 0) {
                const timeoutId = setTimeout(() => {
                    validatePromocode(referralPromocode.code);
                }, 500);
                return () => clearTimeout(timeoutId);
            }
        }
    }, [usdAmount, referralPromocode, rejectedReferralPromocode, promocode, validatePromocode]);

    useEffect(() => {
        if (methodsToShow.length === 0) {
            if (selectedCurrency) {
                setSelectedCurrency("");
            }
            return;
        }

        if (selectedCurrency && !methodsToShow.some(method => method.id === selectedCurrency)) {
            setSelectedCurrency("");
        }
    }, [methodsToShow, selectedCurrency, isCryptoCategory, isCardsCategory]);

    const loadCardSubMethod = useCallback(async (card: any) => {
        if (card.method === 'CARD' || card.method === 'CARD_WINDOW') {
            const cardKey = `card-${card.id}`;
            setCardSubMethods(prev => {
                if (prev[cardKey]) {
                    return prev;
                }
                ampayApi.getCurrentSubMethod(card.method, card.currency)
                    .then(response => {
                        setCardSubMethods(prevState => ({
                            ...prevState,
                            [cardKey]: response.sub_method
                        }));
                    })
                    .catch(error => {

                    });
                return prev;
            });
        }
    }, []);

    const handleMethodSelect = useCallback((currencyId: string) => {
        if (currencyId.startsWith('card-')) {
            for (const item of cardsMethodsData) {
                const card = item.cards.find(c => `card-${c.id}` === currencyId);
                if (card) {
                    loadCardSubMethod(card);
                    setSelectedAmpayCard({
                        id: card.id,
                        name: card.name,
                        icon: card.icon,
                        min_amount: card.min_amount,
                        currency: card.currency,
                        method: card.method,
                        sub_method: card.sub_method,
                    });
                    setSelectedCurrency(currencyId);
                    setShowPaymentDetails(false);
                    setSelectedEwalletMethod(null);
                    return;
                }
            }
        }
        setSelectedCurrency(currencyId);
        setShowPaymentDetails(false);
        setSelectedEwalletMethod(null);
        setSelectedAmpayCard(null);
    }, [cardsMethodsData, loadCardSubMethod]);

    const handleEwalletMethodSelect = useCallback((crypto: any, method: any) => {
        // Для ewallet методов парсим name_key для получения method и subMethod
        const nameKeyParts = crypto.name_key.split('_');
        const methodName = nameKeyParts[0]?.toUpperCase() || 'E_WALLET';
        const subMethod = nameKeyParts[1]?.toUpperCase() || 'DEFAULT';
        
        setSelectedEwalletMethod({
            method: {
                method: methodName,
                subMethod: subMethod,
                description: crypto.name
            },
            currency: crypto.symbol,
            ewalletMethod: method
        });
        setSelectedCurrency(crypto.name_key);
    }, []);

    const fetchUserDeposits = async () => {
        if (depositsLoading) return;
        
        setDepositsLoading(true);
        setDepositsError(null);
        
        try {
            const deposits = await depositApi.getUserDeposits();
            setUserDeposits(deposits);
        } catch (error) {

            if (error instanceof Error) {
                if (error.message === 'SESSION_EXPIRED') {
                    setDepositsError(t('common.sessionExpired'));
                } else {
                    setDepositsError(error.message || t('deposit.loadingDepositsError'));
                }
            } else {
                setDepositsError(t('deposit.loadingDepositsError'));
            }
        } finally {
            setDepositsLoading(false);
        }
    };

    const handleDepositError = (error: any) => {

        if (error instanceof Error) {
            const errorMessage = error.message;
            
            if (errorMessage === 'SESSION_EXPIRED') {
                return t('common.sessionExpired');
            } else if (errorMessage.includes('Депозит с таким хешем транзакции уже существует')) {
                return t('deposit.hashAlreadyExists');
            } else if (errorMessage.includes('Пользователь не найден')) {
                return t('deposit.userNotFound');
            } else if (errorMessage.includes('Некорректный тип кошелька')) {
                return t('deposit.invalidWalletType');
            } else if (errorMessage.includes('Сумма должна быть положительным числом')) {
                return t('deposit.invalidAmount');
            } else if (errorMessage.includes('Хеш транзакции обязателен')) {
                return t('deposit.transactionHashRequired');
            } else if (errorMessage === 'NETWORK_ERROR') {
                return t('common.networkError');
            } else if (errorMessage === 'INVALID_JSON_RESPONSE') {
                return t('common.serverError');
            } else {
                return errorMessage || t('deposit.submissionError');
            }
        }
        
        return t('deposit.submissionError');
    };

    const fetchExchangeRates = async () => {
        const allCryptoMethods: DepositMethod[] = [];
        
        for (const categoryId in depositMethods) {
            if (categoryId !== 'cards' && categoryId !== 'e-payments') {
                allCryptoMethods.push(...(depositMethods[categoryId] || []));
            }
        }
        
        const uniqueMethods = new Map<string, DepositMethod>();
        for (const method of allCryptoMethods) {
            if (!uniqueMethods.has(method.id)) {
                uniqueMethods.set(method.id, method);
            }
        }
        
        const cryptoMethods = Array.from(uniqueMethods.values());
        
        try {
            setRatesLoading(true);
            setRatesError(null);

            const configs = cryptoMethods.map(currency => ({
                id: currency.id,
                symbol: currency.bybitSymbol,
                category: currency.bybitCategory,
                fallback: currency.fallbackRate,
            }));

            const { rates, failed } = await fetchBybitRates(configs);
            const fetchableCount = configs.filter(config => config.symbol).length;

            const finalRates: Record<string, number> = { ...rates };
            
            // Для методов с одинаковым bybitSymbol (например, BNB на разных сетях)
            // используем курс от Bybit для первого метода, а для остальных используем fallback rate
            // Это позволяет иметь разные курсы для разных сетей одной валюты
            const symbolToFirstRate = new Map<string, { rate: number; id: string }>();
            
            // Сначала находим первый реальный курс для каждого bybitSymbol (только если это реальный курс с биржи, а не fallback)
            for (const currency of cryptoMethods) {
                if (finalRates[currency.id] && currency.bybitSymbol) {
                    const rate = finalRates[currency.id];
                    // Проверяем, что это реальный курс с биржи (не fallback rate 100)
                    if (rate > 1 && rate < 1000000 && rate !== currency.fallbackRate) {
                        const bybitKey = currency.bybitSymbol.toLowerCase();
                        if (!symbolToFirstRate.has(bybitKey)) {
                            symbolToFirstRate.set(bybitKey, { rate: rate, id: currency.id });
                        }
                    }
                }
            }
            
            // Для методов с одинаковым bybitSymbol, но разными сетями
            // для BNB на разных сетях всегда используем fallback rate, если он задан
            // Это позволяет иметь разные курсы для разных сетей одной валюты
            for (const currency of cryptoMethods) {
                if (currency.bybitSymbol && currency.network) {
                    const bybitKey = currency.bybitSymbol.toLowerCase();
                    const firstRate = symbolToFirstRate.get(bybitKey);
                    
                    // Для BNB на разных сетях используем реальный курс от Bybit и применяем к нему корректировки
                    // Это позволяет иметь разные курсы для разных сетей, используя реальные данные с биржи
                    if (currency.symbol?.toUpperCase() === 'BNB' && firstRate) {
                        // Используем реальный курс от Bybit как базовый
                        const baseRate = firstRate.rate;
                        const networkUpper = currency.network.toUpperCase();
                        
                        // Применяем небольшие корректировки к базовому курсу для разных сетей
                        // Это учитывает возможные различия в цене из-за комиссий, арбитража и других факторов
                        if (networkUpper === 'BEACON') {
                            finalRates[currency.id] = baseRate; // Beacon Chain - базовый курс
                        } else if (networkUpper === 'OPBNB') {
                            finalRates[currency.id] = baseRate * 1.0005; // OpBNB - немного выше (0.05%)
                        } else if (networkUpper === 'BSC' || networkUpper === 'BNB') {
                            finalRates[currency.id] = baseRate * 0.9997; // Smart Chain - немного ниже (0.03%)
                        } else {
                            finalRates[currency.id] = baseRate; // По умолчанию базовый курс
                        }
                    } else if (currency.symbol?.toUpperCase() === 'BNB' && currency.fallbackRate && currency.fallbackRate > 100) {
                        // Если курс от Bybit не получен, используем fallback rate
                        finalRates[currency.id] = currency.fallbackRate;
                    } else if (!finalRates[currency.id] && firstRate && currency.fallbackRate !== firstRate.rate && currency.fallbackRate !== 100) {
                        // Для других валют используем fallback rate, если он отличается от курса Bybit
                        finalRates[currency.id] = currency.fallbackRate;
                    } else if (!finalRates[currency.id] && firstRate) {
                        // Если fallback rate такой же или не задан, используем курс от Bybit
                        finalRates[currency.id] = firstRate.rate;
                    }
                }
                
                // Если курс еще не установлен, пытаемся использовать курс от Bybit
                if (!finalRates[currency.id] && currency.bybitSymbol) {
                    const bybitKey = currency.bybitSymbol.toLowerCase();
                    const firstRate = symbolToFirstRate.get(bybitKey);
                    if (firstRate) {
                        finalRates[currency.id] = firstRate.rate;
                    } else if (currency.fallbackRate) {
                        // Используем fallback только если курс от Bybit не получен
                        finalRates[currency.id] = currency.fallbackRate;
                    }
                }
                
                // Сохраняем курс по symbol_network для удобства поиска
                if (finalRates[currency.id] && currency.symbol && currency.network) {
                    const symbolNetworkKey = `${currency.symbol.toLowerCase()}_${currency.network.toLowerCase()}`;
                    if (!finalRates[symbolNetworkKey]) {
                        finalRates[symbolNetworkKey] = finalRates[currency.id];
                    }
                }
                
                // Если курс не найден по id и symbol_network, ищем по symbol (для обратной совместимости)
                if (!finalRates[currency.id] && currency.symbol) {
                    const symbolKey = currency.symbol.toLowerCase();
                    if (finalRates[symbolKey]) {
                        finalRates[currency.id] = finalRates[symbolKey];
                        // Сохраняем также по symbol_network для будущего использования
                        if (currency.network) {
                            const symbolNetworkKey = `${symbolKey}_${currency.network.toLowerCase()}`;
                            if (!finalRates[symbolNetworkKey]) {
                                finalRates[symbolNetworkKey] = finalRates[currency.id];
                            }
                        }
                    } else if (currency.fallbackRate) {
                        // Используем fallback только если курс от Bybit не получен
                        finalRates[currency.id] = currency.fallbackRate;
                    }
                }
                
                // Сохраняем курс по symbol для обратной совместимости (только если еще не сохранен)
                if (currency.symbol && !finalRates[currency.symbol.toLowerCase()] && finalRates[currency.id]) {
                    finalRates[currency.symbol.toLowerCase()] = finalRates[currency.id];
                }
            }

            // Всегда используем реальные курсы с биржи, если они получены
            // Fallback rates используются только если курс не получен от биржи
            const hasRealRates = Object.keys(finalRates).length > 0 && Object.values(finalRates).some(rate => rate > 0 && rate > 1 && rate < 1000000);
            
            if (failed.length === fetchableCount && fetchableCount > 0 && !hasRealRates) {
                // Если все курсы не загрузились и нет реальных курсов, используем кэш или fallback
                const cachedRates = localStorage.getItem('exchangeRates');
                if (cachedRates) {
                    try {
                        const parsed = JSON.parse(cachedRates);
                        const cachedHasRealRates = Object.keys(parsed).length > 0 && Object.values(parsed).some((rate: any) => rate > 0 && rate > 1 && rate < 1000000);
                        if (cachedHasRealRates) {
                            setExchangeRates({ ...parsed, ...finalRates });
                            setRatesError(null);
                        } else {
                            const fallbackRates: Record<string, number> = {};
                            cryptoMethods.forEach(currency => {
                                fallbackRates[currency.id] = currency.fallbackRate;
                                if (currency.symbol) {
                                    fallbackRates[currency.symbol.toLowerCase()] = currency.fallbackRate;
                                }
                            });
                            setExchangeRates({ ...fallbackRates, ...finalRates });
                            setRatesError(t('deposit.loadingRates'));
                        }
                    } catch (e) {
                        const fallbackRates: Record<string, number> = {};
                        cryptoMethods.forEach(currency => {
                            fallbackRates[currency.id] = currency.fallbackRate;
                            if (currency.symbol) {
                                fallbackRates[currency.symbol.toLowerCase()] = currency.fallbackRate;
                            }
                        });
                        setExchangeRates({ ...fallbackRates, ...finalRates });
                        setRatesError(t('deposit.loadingRates'));
                    }
                } else {
                    const fallbackRates: Record<string, number> = {};
                    cryptoMethods.forEach(currency => {
                        fallbackRates[currency.id] = currency.fallbackRate;
                        if (currency.symbol) {
                            fallbackRates[currency.symbol.toLowerCase()] = currency.fallbackRate;
                        }
                    });
                    setExchangeRates({ ...fallbackRates, ...finalRates });
                    setRatesError(t('deposit.loadingRates'));
                }
            } else {
                // Используем реальные курсы с биржи
                setExchangeRates(finalRates);
                localStorage.setItem('exchangeRates', JSON.stringify(finalRates));
                // Не показываем ошибку, если есть реальные курсы с биржи
                setRatesError(null);
            }
        } catch (error) {

            // Пытаемся использовать кэшированные курсы
            const cachedRates = localStorage.getItem('exchangeRates');
            if (cachedRates) {
                try {
                    const parsed = JSON.parse(cachedRates);
                    const cachedHasRealRates = Object.keys(parsed).length > 0 && Object.values(parsed).some((rate: any) => rate > 0 && rate > 1 && rate < 1000000);
                    if (cachedHasRealRates) {
                        setExchangeRates(parsed);
                        setRatesError(null);
                    } else {
                        // Если кэш не содержит реальных курсов, используем fallback
                        const fallbackRates: Record<string, number> = {};
                        cryptoMethods.forEach(currency => {
                            fallbackRates[currency.id] = currency.fallbackRate;
                            if (currency.symbol) {
                                fallbackRates[currency.symbol.toLowerCase()] = currency.fallbackRate;
                            }
                        });
                        setExchangeRates(fallbackRates);
                        setRatesError(t('deposit.loadingRates'));
                    }
                } catch (e) {
                    // Если кэш поврежден, используем fallback
                    const fallbackRates: Record<string, number> = {};
                    cryptoMethods.forEach(currency => {
                        fallbackRates[currency.id] = currency.fallbackRate;
                        if (currency.symbol) {
                            fallbackRates[currency.symbol.toLowerCase()] = currency.fallbackRate;
                        }
                    });
                    setExchangeRates(fallbackRates);
                    setRatesError(t('deposit.loadingRates'));
                }
            } else {
                // Используем fallback только если нет кэша
                const fallbackRates: Record<string, number> = {};
                cryptoMethods.forEach(currency => {
                    fallbackRates[currency.id] = currency.fallbackRate;
                    if (currency.symbol) {
                        fallbackRates[currency.symbol.toLowerCase()] = currency.fallbackRate;
                    }
                });
                setExchangeRates(fallbackRates);
                setRatesError(t('deposit.loadingRates'));
            }
        } finally {
            setRatesLoading(false);
        }
    };

    const submitTransactionHash = async () => {
        if (!transactionHash.trim()) {
            setSubmitError(t('deposit.transactionHashRequired'));
            return;
        }

        if (!selectedCurrency) {
            setSubmitError(t('deposit.currencyRequired'));
            return;
        }

        setSubmitting(true);
        setSubmitError(null);

        try {
            // Получаем сумму депозита из usdAmount или используем минимальную сумму
            const depositAmount = usdAmount ? parseFloat(usdAmount) : (selectedCurrencyConfig?.minAmount || 20);
            
            // Используем промокод из ссылки, если пользователь не указал свой и не отказался от промокода из ссылки
            const promocodeToUse = promocode.trim() 
                ? promocode.trim() 
                : (referralPromocode && !rejectedReferralPromocode ? referralPromocode.code : null);
            
            const result = await depositApi.submitTransaction(
                transactionHash.trim(), 
                selectedCurrency,
                depositAmount,
                promocodeToUse
            );
            
            setSubmitSuccess(true);
            setTransactionHash("");
            
            await fetchUserDeposits();
            setTimeout(() => setSubmitSuccess(false), 5000);

        } catch (error) {
            const errorMessage = handleDepositError(error);
            setSubmitError(errorMessage);
        } finally {
            setSubmitting(false);
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${month}/${day}/${year} ${hours}:${minutes}`;
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'pending': return t('deposit.statusPending');
            case 'completed': return t('deposit.statusCompleted');
            case 'rejected': return t('deposit.statusRejected');
            default: return status;
        }
    };

    const getStatusClass = (status: string) => {
        switch (status) {
            case 'pending': return 'status-pending';
            case 'completed': return 'status-completed';
            case 'rejected': return 'status-rejected';
            default: return '';
        }
    };

    useEffect(() => {
        if (!selectedCurrency) {
            setQrCodeDataUrl(null);
            setQrCodeError(false);
            return;
        }
        
        const url = getQrCodeUrl(selectedCurrency);
        setQrCodeDataUrl(url);
        setQrCodeError(false);
    }, [selectedCurrency, wallets]);

    useEffect(() => {
        const loadData = async () => {
            await dispatch(fetchWallets());
            await fetchUserDeposits();
        };

        loadData();
    }, [dispatch]);

    useEffect(() => {
        if (Object.keys(depositMethods).length > 0) {
            fetchExchangeRates();
            const interval = setInterval(fetchExchangeRates, 30000);
            return () => clearInterval(interval);
        }
    }, [depositMethods]);

    useEffect(() => {
        if (retryCount > 0) {
            fetchExchangeRates();
        }
    }, [retryCount]);

    const allMethods = useMemo(() => Object.values(depositMethods).flat(), [depositMethods]);
    const selectedCurrencyConfig = useMemo(() => {
        if (!selectedCurrency) return undefined;
        const selectedLower = selectedCurrency.toLowerCase();
        
        const exactMatch = allMethods.find(c => {
            const cId = (c.id || '').toLowerCase();
            return cId === selectedLower;
        });
        
        if (exactMatch) {
            return exactMatch;
        }
        
        const symbolMatch = allMethods.find(c => {
            const cSymbol = (c.symbol || '').toLowerCase();
            return cSymbol === selectedLower;
        });
        
        if (symbolMatch) return symbolMatch;
        
        const partialMatch = allMethods.find(c => {
            const cId = (c.id || '').toLowerCase();
            return cId.includes(selectedLower) || selectedLower.includes(cId);
        });
        
        return partialMatch;
    }, [allMethods, selectedCurrency]);

    useEffect(() => {
        if (!selectedCurrency || selectedAmpayCard) {
            setConvertedAmount(0);
            setMinConverted(0);
            return;
        }
        
        const numericAmount = parseFloat(usdAmount) || 0;
        if (numericAmount === 0) {
            setConvertedAmount(0);
            setMinConverted(0);
            return;
        }
        
        if (!selectedCurrencyConfig || !selectedCurrencyConfig.symbol) {
            setConvertedAmount(0);
            setMinConverted(0);
            return;
        }
        
        const currencySymbol = selectedCurrencyConfig.symbol.toUpperCase().trim();
        const currencyId = (selectedCurrencyConfig.id || '').toLowerCase();
        const isStableCoin = currencySymbol === 'USDT' || currencySymbol === 'USDC';
        
        if (isStableCoin) {
            setConvertedAmount(numericAmount);
            setMinConverted(20);
            return;
        }
        
        if (!currencySymbol) {
            setConvertedAmount(0);
            setMinConverted(0);
            return;
        }
        
        if (Object.keys(exchangeRates).length === 0) {
            setConvertedAmount(0);
            setMinConverted(0);
            return;
        }
        
        // Сначала ищем курс по уникальному ID метода (например, CRYPTO_BNB_BEACON, CRYPTO_OPBNB_OPBNB)
        // Это позволяет иметь разные курсы для разных сетей одной валюты
        let rateKey = Object.keys(exchangeRates).find(key => {
            const keyLower = key.toLowerCase();
            return keyLower === currencyId || keyLower === selectedCurrency.toLowerCase();
        });
        
        // Если курс не найден по ID, ищем по symbol_network (учитывая сеть)
        if (!rateKey && currencySymbol && selectedCurrencyConfig.network) {
            const symbolNetworkKey = `${currencySymbol.toLowerCase()}_${selectedCurrencyConfig.network.toLowerCase()}`;
            rateKey = Object.keys(exchangeRates).find(key => {
                const keyLower = key.toLowerCase();
                return keyLower === symbolNetworkKey;
            });
        }
        
        // Если курс не найден по symbol_network, ищем по symbol (для обратной совместимости)
        if (!rateKey && currencySymbol) {
            rateKey = Object.keys(exchangeRates).find(key => {
                const keyLower = key.toLowerCase();
                return keyLower === currencySymbol.toLowerCase();
            });
        }
        
        // Последняя попытка - частичное совпадение
        if (!rateKey && currencySymbol) {
            rateKey = Object.keys(exchangeRates).find(key => {
                const keyLower = key.toLowerCase();
                return keyLower.includes(currencySymbol.toLowerCase()) ||
                       currencySymbol.toLowerCase().includes(keyLower);
            });
        }
        
        const rate = rateKey ? exchangeRates[rateKey] : undefined;
        
        if (rate && rate > 0) {
            setConvertedAmount(numericAmount / rate);
            setMinConverted(20 / rate);
        } else {
            setConvertedAmount(0);
            setMinConverted(0);
        }
    }, [selectedCurrency, usdAmount, exchangeRates, selectedAmpayCard, selectedCurrencyConfig]);

    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (showPaymentDetails && paymentTimer > 0) {
            timer = setInterval(() => {
                setPaymentTimer(prev => prev - 1);
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [showPaymentDetails, paymentTimer]);

    const getCurrencySymbol = useCallback((currencyId: string): string | null => {
        if (!currencyId) return null;
        
        const currencyLower = currencyId.toLowerCase();
        
        if (currencyLower === 'usd') {
            return 'usdt';
        }
        
        const allMethods = Object.values(depositMethods).flat();
        const method = allMethods.find(m => 
            m.id.toLowerCase() === currencyLower || 
            m.symbol.toLowerCase() === currencyLower
        );
        
        if (method?.symbol) {
            return method.symbol.toLowerCase();
        }
        
        for (const category of structuredData) {
            for (const methodItem of category.methods) {
                if (methodItem.type === 'crypto') {
                    const crypto = methodItem.cryptocurrencies.find(c => 
                        c.name_key.toLowerCase() === currencyLower || 
                        c.symbol.toLowerCase() === currencyLower ||
                        (c.id && String(c.id).toLowerCase() === currencyLower)
                    );
                    if (crypto?.symbol) {
                        return crypto.symbol.toLowerCase();
                    }
                }
            }
        }
        
        return currencyLower;
    }, [depositMethods, structuredData]);

    const getWalletAddress = (currency: string): string => {
        const currencySymbol = getCurrencySymbol(currency);
        if (!currencySymbol) {
            return t('deposit.walletNotConfigured', { currency: currency.toUpperCase() });
        }
        
        for (const category of structuredData) {
            for (const method of category.methods) {
                if (method.type === 'crypto') {
                    const crypto = method.cryptocurrencies.find(c => 
                        c.name_key.toLowerCase() === currency.toLowerCase() || 
                        c.symbol.toLowerCase() === currencySymbol ||
                        c.symbol.toLowerCase() === currency.toLowerCase()
                    );
                    if (crypto?.wallet && crypto.wallet.trim() !== '') {
                        return crypto.wallet;
                    }
                }
            }
        }
        
        if (Array.isArray(wallets) && wallets.length > 0) {
            const wallet = wallets.find(w => w.currency.toLowerCase() === currencySymbol);
            if (wallet?.address && wallet.address.trim() !== '') {
                return wallet.address;
            }
        }
        
        return t('deposit.walletNotConfigured', { currency: currencySymbol.toUpperCase() });
    };

    const getQrCodeUrl = (currency: string): string | null => {
        const currencySymbol = getCurrencySymbol(currency);
        if (!currencySymbol) {
            return null;
        }
        
        for (const category of structuredData) {
            for (const method of category.methods) {
                if (method.type === 'crypto') {
                    const crypto = method.cryptocurrencies.find(c => 
                        c.name_key.toLowerCase() === currency.toLowerCase() || 
                        c.symbol.toLowerCase() === currencySymbol ||
                        c.symbol.toLowerCase() === currency.toLowerCase()
                    );
                    if (crypto?.qr_code_image && crypto.qr_code_image.trim() !== '') {
                        const qrPath = String(crypto.qr_code_image).trim();
                        if (qrPath.startsWith('http://') || qrPath.startsWith('https://')) {
                            return qrPath;
                        }
                        const API_BASE_URL = import.meta.env.VITE_API_BASE || '/v3';
                        if (qrPath.startsWith('/')) {
                            return `${API_BASE_URL}${qrPath}`;
                        }
                        return `${API_BASE_URL}${qrPath}`;
                    }
                }
            }
        }
        
        return null;
    };

    const getConfirmations = (currency: string): number => {
        const currencyConfig = allMethods.find(c => c.id === currency);
        return currencyConfig?.confirmations || 0;
    };

    const copyWalletAddress = () => {
        if (!selectedCurrency) return;
        const address = getWalletAddress(selectedCurrency);
        if (address && address !== t('deposit.walletNotConfigured', { currency: selectedCurrency.toUpperCase() })) {
            navigator.clipboard.writeText(address);
            setWalletCopied(true);
            setTimeout(() => setWalletCopied(false), 2000);
        }
    };

    const copyConvertedAmount = () => {
        const numericAmount = parseFloat(usdAmount);
        if (usdAmount !== "" && !isNaN(numericAmount) && numericAmount >= 20) {
            const amountText = `${convertedAmount.toFixed(6)} ${selectedCurrency.toUpperCase()}`;
            navigator.clipboard.writeText(amountText);
            setAmountCopied(true);
            setTimeout(() => setAmountCopied(false), 2000);
        }
    };

    const handleAmountChange = (value: string) => {
        if (value === "" || /^\d*\.?\d*$/.test(value)) {
            setUsdAmount(value);
            setShowPaymentDetails(false);
        }
    };

    const handlePay = async () => {
        if (usdAmount !== "" && !isNaN(parseFloat(usdAmount)) && parseFloat(usdAmount) >= minAmount) {
            if (selectedAmpayCard) {
                try {
                    const amount = parseFloat(usdAmount);
                    const firstName = userData?.firstname || '';
                    const lastName = userData?.lastname || '';
                    const fullName = [firstName, lastName].filter(Boolean).join(' ').trim() || userData?.email?.split('@')[0] || 'User';

                    const isWindowP2PCIS = selectedAmpayCard.method === 'WINDOW_P2P' && selectedAmpayCard.sub_method === 'CIS';
                    const transaction = await ampayApi.createTransaction({
                        payment_method: selectedAmpayCard.method,
                        sub_method: selectedAmpayCard.sub_method,
                        currency: isWindowP2PCIS ? '' : selectedAmpayCard.currency,
                        amount: amount,
                        customer: {
                            full_name: fullName,
                            email: userData?.email || '',
                            phone: userData?.phone || '',
                            country: userCountryCode || '',
                            ip: '',
                            language: 'EN'
                        },
                        success_redirect_url: window.location.origin + '/profile'
                    });

                    if (transaction?.redirect_url) {
                        window.location.href = transaction.redirect_url;
                    } else {
                        setShowPaymentDetails(true);
                    }
                } catch (error: any) {

                    let errorMessage = t('errors.transactionCreationError');
                    
                    if (error?.message) {
                        if (error.message.startsWith('HTTP_ERROR:')) {
                            try {
                                const errorMatch = error.message.match(/\{.*\}/);
                                if (errorMatch) {
                                    const errorData = JSON.parse(errorMatch[0]);
                                    errorMessage = errorData.message || errorMessage;
                                    
                                    if (errorMessage.includes('KYC') || errorMessage.includes('адрес') || errorMessage.includes('город') || errorMessage.includes('почтовый индекс') || errorMessage.includes('дата рождения')) {
                                        const shouldGoToProfile = confirm(errorMessage + '\n\nПерейти в профиль для заполнения данных?');
                                        if (shouldGoToProfile) {
                                            window.location.href = '/profile?tab=kyc';
                                            return;
                                        }
                                    }
                                }
                            } catch {
                                errorMessage = error.message.replace('HTTP_ERROR:', '').trim();
                            }
                        } else {
                            errorMessage = error.message;
                        }
                    }
                    
                    alert(errorMessage);
                }
            } else {
                setShowPaymentDetails(true);
            }
            setPaymentTimer(60 * 60);
        }
    };

    const formatTime = (seconds: number): string => {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    };

    const confirmationsRequired = selectedCurrency ? getConfirmations(selectedCurrency) : 0;

    const minAmount = selectedAmpayCard?.min_amount !== null && selectedAmpayCard?.min_amount !== undefined 
        ? selectedAmpayCard.min_amount 
        : (selectedCurrencyConfig?.minAmount !== null && selectedCurrencyConfig?.minAmount !== undefined 
            ? selectedCurrencyConfig.minAmount 
            : 20);
    const isAmountValid = usdAmount !== "" && !isNaN(parseFloat(usdAmount)) && parseFloat(usdAmount) >= minAmount;

    const submissionNotes = useMemo(
        () => [
            t('deposit.submissionNote1'),
            t('deposit.submissionNote2'),
            t('deposit.submissionNote3'),
        ],
        [t]
    );

    const instructionIcons = useMemo(
        () => ({
            asset: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="4" width="18" height="14" rx="3" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M7 9H17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    <path d="M7 13H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
            ),
            limits: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M12 3L19.5 7V17L12 21L4.5 17V7L12 3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                    <path d="M12 7V11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    <circle cx="12" cy="14.5" r="1.2" fill="currentColor" />
                </svg>
            ),
            confirmations: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M9.5 12.5L11 14L14.5 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            ),
            timing: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M12 7V12L15 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            ),
        }),
        []
    );

    const instructionItems = useMemo(() => {
        const currencySymbol = selectedCurrencyConfig?.symbol ?? selectedCurrency?.toUpperCase() ?? '—';
        const minUsd = selectedCurrencyConfig && selectedCurrencyConfig.minAmount !== null && selectedCurrencyConfig.minAmount !== undefined 
            ? `$${selectedCurrencyConfig.minAmount.toFixed(2)}` 
            : '$20.00';
        const minCrypto =
            selectedCurrencyConfig && minConverted > 0
                ? `${minConverted.toFixed(6)} ${currencySymbol}`
                : t('common.notAvailable');
        const confirmationsText = confirmationsRequired > 0 ? confirmationsRequired.toString() : t('deposit.instant');

        return [
            {
                key: 'asset',
                icon: instructionIcons.asset,
                title: t('deposit.instructionAssetTitle'),
                description: t('deposit.instructionAssetText', { currency: currencySymbol }),
            },
            {
                key: 'limits',
                icon: instructionIcons.limits,
                title: t('deposit.instructionLimitsTitle'),
                description: t('deposit.instructionLimitsText', {
                    amountUsd: minUsd,
                    amountCrypto: minCrypto,
                }),
            },
            {
                key: 'confirmations',
                icon: instructionIcons.confirmations,
                title: t('deposit.instructionConfirmationsTitle'),
                description: t('deposit.instructionConfirmationsText', { count: confirmationsText }),
            },
            {
                key: 'timing',
                icon: instructionIcons.timing,
                title: t('deposit.instructionTimingTitle'),
                description: t('deposit.instructionTimingText'),
            },
        ];
    }, [
        instructionIcons,
        selectedCurrencyConfig,
        selectedCurrency,
        minConverted,
        confirmationsRequired,
        t,
    ]);

    const isSubmitDisabled = submitting || !transactionHash.trim() || !selectedCurrency;

    const handleHashChange = (value: string) => {
        setTransactionHash(value);
        setSubmitError(null);
        setSubmitSuccess(false);
    };

    const pageHeader = (
        <div className="deposit-page__header">
            <div className="deposit-page__header-left">
                <h1 className="deposit-page__title">{t('deposit.title')}</h1>
                {showLanguageDropdown && <LanguageDropdown variant="trading" />}
            </div>
        </div>
    );

    if (loading) {
        return (
            <div className="deposit-page">
                {pageHeader}
                <div className="loading">{t('deposit.loadingWallets')}</div>
            </div>
        );
    }

    if (error || !Array.isArray(wallets) || wallets.length === 0) {
        return (
            <div className="deposit-page">
                {pageHeader}
                <div className="error">
                    {t('deposit.loadingWallets')}: {error || t('deposit.walletNotConfigured', { currency: selectedCurrency?.toUpperCase() || 'UNKNOWN' })}
                    <button
                        className="retry-btn"
                        onClick={() => dispatch(fetchWallets())}
                        style={{ marginTop: "10px", padding: "8px 16px", background: "#37a1ff", border: "none", borderRadius: "4px", cursor: "pointer" }}
                    >
                        {t('common.tryAgain')}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="deposit-page">
            {pageHeader}
           
            <div className="deposit-layout">
                <aside className="deposit-sidebar">
                    <h3 className="deposit-sidebar__title">
                        {t('deposit.paymentCategoryTitle') ?? t('deposit.selectPayment')}
                    </h3>
                    <div className="deposit-sidebar__list">
                        {categoryOptions.length === 0 && !loadingPaymentMethods ? (
                            <div style={{ padding: '12px', color: '#999', fontSize: '13px', textAlign: 'center' }}>
                                {t('deposit.noCategories')}
                            </div>
                        ) : (
                            categoryOptions.map((category) => {
                            const methods = depositMethods[category.id] ?? [];
                            // Категория доступна если есть методы или она помечена как available
                            // Для криптовалютных категорий показываем даже если методов нет
                            const isCryptoCategory = category.id !== "cards" && category.id !== "e-payments";
                            const isAvailable = methods.length > 0 || category.available || isCryptoCategory;

                            return (
                                <button
                                    key={category.id}
                                    type="button"
                                    className={`deposit-sidebar__item ${activeCategory === category.id ? "is-active" : ""} ${isAvailable ? "" : "is-disabled"}`}
                                    onClick={() => {
                                        if (isAvailable) {
                                            handleCategoryChange(category.id);
                                        }
                                    }}
                                    disabled={!isAvailable}
                                >
                                    {category.icon && (
                                        <div className="deposit-sidebar__icon">
                                            {category.icon}
                                        </div>
                                    )}
                                    <div className="deposit-sidebar__item-main">
                                        <div className="deposit-sidebar__item-header">
                                            <span className="deposit-sidebar__label">{category.label}</span>
                                            <span className="deposit-sidebar__badge">{category.badge}</span>
                                        </div>
                                        {category.description && (
                                            <span className="deposit-sidebar__description">{category.description}</span>
                                        )}
                                    </div>
                                </button>
                            );
                        })
                        )}
                    </div>
                </aside>

                <div className="deposit-content">
                    <div className="deposit-methods-panel">
                        <div className="deposit-methods-panel__header">
                            <h3 className="section-title">
                                {(activeCategoryOption?.label ?? t('deposit.selectPayment')) +
                                    (methodsToShow.length > 0 ? ` (${methodsToShow.length})` : "")}
                            </h3>
                        </div>

                        {loadingPaymentMethods ? (
                            <div className="loading">{t('deposit.loading') ?? 'Loading...'}</div>
                        ) : categoryOptions.length === 0 ? (
                            <div className="deposit-methods-empty">
                                <div className="deposit-methods-empty__title">
                                    {t('deposit.categories.emptyTitle') ?? "Available soon"}
                                </div>
                                <div className="deposit-methods-empty__subtitle">
                                    {t('deposit.categories.emptyDescription') ?? "This payment category will be available soon."}
                                </div>
                            </div>
                        ) : isCardsCategory ? (
                            cardsMethodsData.some(item => item.isEwallet && item.cryptos.length > 0) ? (
                                <div className="deposit-methods-list">
                                    {cardsMethodsData.filter(item => item.isEwallet && item.cryptos.length > 0).map((item) => (
                                        <div key={item.method.id} className="deposit-method-section">
                                            <div className="deposit-method-section__header">
                                                <div className="deposit-method-section__header-content">
                                                    {item.method.icon && (
                                                        <div className="deposit-method-section__icon">
                                                            <img src={item.method.icon} alt={item.method.name} width={24} height={24} />
                                                        </div>
                                                    )}
                                                    <div className="deposit-method-section__info">
                                                        <h4 className="deposit-method-section__title">{item.method.name}</h4>
                                                        {item.method.description && (
                                                            <p className="deposit-method-section__description">{item.method.description}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="deposit-methods-group">
                                                {item.cryptos.map((crypto) => (
                                                    <div key={crypto.id} className="deposit-methods-group__item">
                                                        <button
                                                            type="button"
                                                            className={`deposit-method-card ${selectedCurrency === crypto.name_key ? "is-active" : ""}`}
                                                            onClick={() => handleEwalletMethodSelect(crypto, item.method)}
                                                        >
                                                            <div className="deposit-method-card__icon">
                                                                {crypto.icon ? <img src={crypto.icon} alt={crypto.name} width={35} /> : <div className="deposit-method-card__placeholder">{crypto.symbol}</div>}
                                                            </div>
                                                            <div className="deposit-method-card__info">
                                                                <span className="deposit-method-card__name">{crypto.name}</span>
                                                                <span className="deposit-method-card__symbol">{crypto.symbol}</span>
                                                            </div>
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : cardsMethodsData.some(item => !item.isEwallet && item.cards.length > 0) ? (
                                <div className="deposit-methods-group">
                                    {cardsMethodsData.filter(item => !item.isEwallet).map((item) => 
                                        item.cards.map((card) => {
                                            const cardKey = `card-${card.id}`;
                                            const currentSubMethod = cardSubMethods[cardKey];
                                            const isCardMethod = card.method === 'CARD' || card.method === 'CARD_WINDOW';
                                            
                                            return (
                                                <div key={`card-${card.id}`} className="deposit-methods-group__item">
                                                    <button
                                                        type="button"
                                                        className={`deposit-method-card ${selectedCurrency === `card-${card.id}` ? "is-active" : ""}`}
                                                        onClick={() => handleMethodSelect(`card-${card.id}`)}
                                                        onMouseEnter={() => {
                                                            if (isCardMethod && !currentSubMethod) {
                                                                loadCardSubMethod(card);
                                                            }
                                                        }}
                                                    >
                                                        <div className="deposit-method-card__icon">
                                                            {card.icon ? <img src={card.icon} alt={card.name} width={35} /> : <div className="deposit-method-card__placeholder">{card.name}</div>}
                                                        </div>
                                                        <div className="deposit-method-card__info">
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                                <span className="deposit-method-card__name">{card.name}</span>
                                                                {isCardMethod && currentSubMethod && (
                                                                    <span style={{ 
                                                                        fontSize: '10px', 
                                                                        color: '#37a1ff', 
                                                                        fontWeight: '700',
                                                                        textTransform: 'uppercase',
                                                                        padding: '2px 6px',
                                                                        backgroundColor: 'rgba(55, 161, 255, 0.1)',
                                                                        borderRadius: '4px',
                                                                        border: '1px solid rgba(55, 161, 255, 0.3)'
                                                                    }}>
                                                                        {currentSubMethod}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </button>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            ) : (
                                <div className="deposit-methods-empty">
                                    <div className="deposit-methods-empty__title">
                                        {t('deposit.categories.emptyTitle') ?? "Available soon"}
                                    </div>
                                    <div className="deposit-methods-empty__subtitle">
                                        {t('deposit.categories.emptyDescription') ?? "This payment category will be available soon."}
                                    </div>
                                </div>
                            )
                        ) : methodsToShow.length > 0 ? (
                            <div className="deposit-methods-group">
                                {methodsToShow.map((method) => (
                                    <div key={method.id} className="deposit-methods-group__item">
                                        <button
                                            type="button"
                                            className={`deposit-method-card ${selectedCurrency === method.id ? "is-active" : ""}`}
                                            onClick={() => handleMethodSelect(method.id)}
                                        >
                                            <div className="deposit-method-card__icon">{method.icon}</div>
                                            <div className="deposit-method-card__info">
                                                <span className="deposit-method-card__name">{method.name}</span>
                                                <span className="deposit-method-card__symbol">
                                                    {method.symbol}
                                                    {method.network && method.network !== method.symbol && (
                                                        <span style={{ 
                                                            fontSize: '11px', 
                                                            color: '#999', 
                                                            marginLeft: '4px',
                                                            fontWeight: 'normal'
                                                        }}>
                                                            ({method.network})
                                                        </span>
                                                    )}
                                                </span>
                                            </div>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="deposit-methods-empty">
                                <div className="deposit-methods-empty__title">
                                    {t('deposit.categories.emptyTitle') ?? "Available soon"}
                                </div>
                                <div className="deposit-methods-empty__subtitle">
                                    {t('deposit.categories.emptyDescription') ??
                                        "This payment category will be available soon."}
                                </div>
                            </div>
                        )}
                    </div>

                    {((isCryptoCategory && selectedCurrency && selectedCurrencyConfig) || (isCardsCategory && selectedAmpayCard)) && (
                        <div className="deposit-info deposit-info--visible" onClick={(e) => {
                            if (e.target === e.currentTarget) {
                                setSelectedCurrency("");
                                setSelectedAmpayCard(null);
                                setShowPaymentDetails(false);
                            }
                        }}>
                            <div className="info-card" onClick={(e) => e.stopPropagation()}>
                                <div className="info-card__header">
                                    <div className="info-card__title">
                                        <span className="info-card__caption">{selectedAmpayCard ? (t('deposit.paymentMethodTitle') ?? "Payment method") : (t('deposit.walletTitle') ?? "Wallet deposit")}</span>
                                        {selectedAmpayCard ? (
                                            <div className="info-card__currency">
                                                {selectedAmpayCard.icon ? <img src={selectedAmpayCard.icon} alt={selectedAmpayCard.name} width={24} height={24} /> : <div style={{ width: 24, height: 24, background: '#ddd', borderRadius: '50%' }} />}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                    <span>{selectedAmpayCard.name}</span>
                                                    {(selectedAmpayCard.method === 'CARD' || selectedAmpayCard.method === 'CARD_WINDOW') && cardSubMethods[`card-${selectedAmpayCard.id}`] && (
                                                        <span style={{ 
                                                            fontSize: '11px', 
                                                            color: '#37a1ff', 
                                                            fontWeight: '700',
                                                            textTransform: 'uppercase',
                                                            padding: '3px 8px',
                                                            backgroundColor: 'rgba(55, 161, 255, 0.1)',
                                                            borderRadius: '4px',
                                                            border: '1px solid rgba(55, 161, 255, 0.3)'
                                                        }}>
                                                            {cardSubMethods[`card-${selectedAmpayCard.id}`]}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            ) : selectedCurrencyConfig && !selectedAmpayCard ? (
                                                <div className="info-card__currency">
                                                    {selectedCurrencyConfig.icon}
                                                    {selectedCurrencyConfig.name}
                                                </div>
                                            ) : null}
                                    </div>
                                    <button
                                        className="info-card__close"
                                        onClick={() => {
                                            setSelectedCurrency("");
                                            setSelectedAmpayCard(null);
                                            setShowPaymentDetails(false);
                                        }}
                                        type="button"
                                        aria-label="Close"
                                    >
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                            <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                        </svg>
                                    </button>
                                </div>

                                {ratesError && (
                                    <div className="rates-error">
                                        ⚠️ {ratesError}
                                        <button
                                            onClick={() => setRetryCount(prev => prev + 1)}
                                            className="rates-error__retry"
                                        >
                                            {t('common.tryAgain')}
                                        </button>
                                    </div>
                                )}

                                <div className="info-card__layout">
                                    <section className="info-card__panel info-card__panel--form">
                                        <h4 className="info-card__panel-title">
                                            {t('deposit.amountSectionTitle') ?? "Amount & conversion"}
                                        </h4>

                                        <div className="amount-input-group">
                                            <label className="input-label">{t('deposit.amountUSD')}</label>
                                            <div className="amount-input">
                                                <span className="currency-symbol">{getCurrencySymbol(userCurrency)}</span>
                                                <input
                                                    type="text"
                                                    value={usdAmount}
                                                    onChange={(e) => handleAmountChange(e.target.value)}
                                                    placeholder="0"
                                                    disabled={ratesLoading || showPaymentDetails}
                                                />
                                            </div>
                                            <div className="amount-note">
                                                {selectedAmpayCard && selectedAmpayCard.min_amount !== null && selectedAmpayCard.min_amount !== undefined && selectedAmpayCard.min_amount > 0
                                                    ? `${t('deposit.minDeposit')}: ${formatCurrency(selectedAmpayCard.min_amount, userCurrency)}`
                                                    : selectedCurrencyConfig && selectedCurrencyConfig.minAmount !== null && selectedCurrencyConfig.minAmount !== undefined && selectedCurrencyConfig.minAmount > 0
                                                    ? t('deposit.minimumNote', { amount: formatCurrency(selectedCurrencyConfig.minAmount, userCurrency) }) 
                                                    : `${t('deposit.minDeposit')}: ${formatCurrency(20, userCurrency)}`}
                                            </div>
                                        </div>

                                        {ratesLoading ? (
                                            <div className="loading-rates">
                                                <div className="loading-spinner"></div>
                                                {t('deposit.loadingRates')}
                                            </div>
                                        ) : (
                                            <div className="conversion-section">
                                                <div className="converted-amount-container">
                                                    <div className="converted-amount">
                                                        {selectedAmpayCard 
                                                            ? `≈ ${convertedAmount.toFixed(2)} ${selectedAmpayCard.currency}`
                                                            : selectedCurrencyConfig && selectedCurrencyConfig.symbol && usdAmount && !isNaN(parseFloat(usdAmount)) && parseFloat(usdAmount) > 0
                                                            ? `≈ ${convertedAmount.toFixed(6)} ${selectedCurrencyConfig.symbol.toUpperCase()}${selectedCurrencyConfig.network && selectedCurrencyConfig.network !== selectedCurrencyConfig.symbol ? ` (${selectedCurrencyConfig.network})` : ''}`
                                                            : ''}
                                                    </div>
                                                    {selectedCurrencyConfig && selectedCurrencyConfig.symbol && usdAmount && !isNaN(parseFloat(usdAmount)) && parseFloat(usdAmount) > 0 && (
                                                        <button
                                                            className={`copy-amount-btn ${amountCopied ? "copied" : ""}`}
                                                            onClick={copyConvertedAmount}
                                                            title={t('deposit.copyAmount') ?? "Copy amount"}
                                                            type="button"
                                                        >
                                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                                                <path
                                                                    d="M16 8V5C16 3.89543 15.1046 3 14 3H5C3.89543 3 3 3.89543 3 5V14C3 15.1046 3.89543 16 5 16H8M10 8H19C20.1046 8 21 8.89543 21 10V19C21 20.1046 20.1046 21 19 21H10C8.89543 21 8 20.1046 8 19V10C8 8.89543 8.89543 8 10 8Z"
                                                                    stroke="currentColor"
                                                                    strokeWidth="2"
                                                                    strokeLinecap="round"
                                                                    strokeLinejoin="round"
                                                                />
                                                            </svg>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {!showPaymentDetails && (
                                            <div className="info-card__actions">
                                                <button
                                                    className="pay-button"
                                                    onClick={handlePay}
                                                    disabled={!isAmountValid || ratesLoading}
                                                >
                                                    {t('deposit.pay')}
                                                </button>
                                                <div className="info-card__hint">
                                                    {t('deposit.payHint') ?? "Enter amount and continue to receive payment details."}
                                                </div>
                                            </div>
                                        )}
                                    </section>

                                    <section className="info-card__panel info-card__panel--details">
                                        <h4 className="info-card__panel-title">
                                            {t('deposit.walletSectionTitle') ?? "Payment details"}
                                        </h4>

                                        {showPaymentDetails && !selectedAmpayCard ? (
                                            <div className="payment-details">
                                                {qrCodeDataUrl && (
                                                    <div className="payment-details__qr">
                                                        <div className="qr-code">
                                                            <img
                                                                src={qrCodeDataUrl}
                                                                alt={`QR code for ${selectedCurrency}`}
                                                                className="qr-code-image"
                                                                onError={() => {
                                                                    setQrCodeError(true);
                                                                }}
                                                                onLoad={() => {
                                                                    setQrCodeError(false);
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                                <div className="payment-details__info">
                                                            <div className="wallet-section">
                                                                <label className="input-label">{t('deposit.walletAddressLabel') ?? "Recipient's wallet address"}</label>
                                                                <div className="wallet-address-container">
                                                                    <div className="wallet-address">
                                                                        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                            {getWalletAddress(selectedCurrency)}
                                                                        </span>
                                                                        {getWalletAddress(selectedCurrency) !== t('deposit.walletNotConfigured', { currency: selectedCurrency.toUpperCase() }) && (
                                                                            <button
                                                                                className={`copy-wallet-inline ${walletCopied ? "copied" : ""}`}
                                                                                onClick={copyWalletAddress}
                                                                                type="button"
                                                                                aria-label={t('deposit.copyAdress')}
                                                                            >
                                                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                                                                                    <path
                                                                                        d="M16 8V5C16 3.89543 15.1046 3 14 3H5C3.89543 3 3 3.89543 3 5V14C3 15.1046 3.89543 16 5 16H8M10 8H19C20.1046 8 21 8.89543 21 10V19C21 20.1046 20.1046 21 19 21H10C8.89543 21 8 20.1046 8 19V10C8 8.89543 8.89543 8 10 8Z"
                                                                                        stroke="currentColor"
                                                                                        strokeWidth="2"
                                                                                        strokeLinecap="round"
                                                                                        strokeLinejoin="round"
                                                                                    />
                                                                                </svg>
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="payment-status">
                                                                <div className="status-item">
                                                                    <div className="loading-circle"></div>
                                                                    <span>{t('deposit.expiresLabel') ?? "Expires"} {formatTime(paymentTimer)}</span>
                                                                </div>
                                                                <div className="status-item">
                                                                    <div className="loading-circle"></div>
                                                                    <span>
                                                                        {t('deposit.confirmationsProgress', {
                                                                            current: String(0),
                                                                            total: String(confirmationsRequired),
                                                                        }) || `Confirmations 0/${confirmationsRequired}`}
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            {selectedCurrencyConfig && (
                                                                <ul className="warnings">
                                                                    <li>{t('deposit.warningConfirmations', { currency: selectedCurrencyConfig.symbol, count: confirmationsRequired.toString() }) ?? `${selectedCurrencyConfig.symbol} will be credited after ${confirmationsRequired} confirmations.`}</li>
                                                                    <li>{t('deposit.warningOnlyCurrency', { currency: selectedCurrencyConfig.symbol }) ?? `Send only ${selectedCurrencyConfig.symbol} to this address.`}</li>
                                                                    <li>{t('deposit.warningMinAmount', { amount: minConverted.toFixed(8), currency: selectedCurrencyConfig.symbol }) ?? `Minimum deposit: ${minConverted.toFixed(8)} ${selectedCurrencyConfig.symbol}`}</li>
                                                                </ul>
                                                            )}
                                                            <p className="notification-text">
                                                                {t('deposit.notificationNote') ?? "We will notify you as soon as the payment status changes."}
                                                            </p>
                                                        </div>
                                            </div>
                                        ) : (
                                            <div className="payment-details__placeholder">
                                                <p>{t('deposit.detailsPlaceholderTitle') ?? "Payment details will appear here after you confirm the amount."}</p>
                                                <span>{t('deposit.detailsPlaceholderHint') ?? "Enter an amount and press continue to generate the address and QR code."}</span>
                                            </div>
                                        )}
                                    </section>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="user-deposits-section">
                <div className="deposits-header">
                    <h3 className="section-title">{t('deposit.myDeposits')}</h3>
                    <div className="history-filters">
                        <div className="history-filter-tabs">
                            <button
                                className={`history-filter-tab ${depositFilter === 'deposit' ? 'active' : ''}`}
                                onClick={() => setDepositFilter('deposit')}
                            >
                                {t('deposit.myDeposits')}
                            </button>
                            <button
                                className={`history-filter-tab ${depositFilter === 'all' ? 'active' : ''}`}
                                onClick={() => setDepositFilter('all')}
                            >
                                {t('withdrawal.allTypes')}
                            </button>
                        </div>
                        <div className="date-filter">
                            <input
                                type="date"
                                value={depositDateRange.start}
                                onChange={(e) => setDepositDateRange({ ...depositDateRange, start: e.target.value })}
                                className="date-input"
                            />
                            <span className="date-separator">-</span>
                            <input
                                type="date"
                                value={depositDateRange.end}
                                onChange={(e) => setDepositDateRange({ ...depositDateRange, end: e.target.value })}
                                className="date-input"
                            />
                            <button className="apply-date-btn">{t('common.apply')}</button>
                        </div>
                    </div>
                </div>

                {depositsLoading ? (
                    <div className="deposits-loading">
                        <div className="loading-spinner"></div>
                        {t('deposit.loadingDeposits')}
                    </div>
                ) : depositsError ? (
                    <div className="deposits-error">
                        ⚠️ {depositsError}
                        <button 
                            className="retry-btn"
                            onClick={fetchUserDeposits}
                        >
                            {t('common.tryAgain')}
                        </button>
                    </div>
                ) : userDeposits.length === 0 ? (
                    <div className="no-history">
                        <div className="no-history-text">{t('deposit.noDeposits')}</div>
                        <div className="no-history-subtext">
                            {t('deposit.noDepositsSubtext', { defaultValue: 'Your deposit history will appear here' })}
                        </div>
                    </div>
                ) : (
                    <div className="deposits-history-table">
                        <div className="table-header">
                            <div className="table-cell">ID</div>
                            <div className="table-cell">{t('withdrawal.date', { defaultValue: 'Date' })}</div>
                            <div className="table-cell">{t('withdrawal.amount', { defaultValue: 'Amount' })}</div>
                            <div className="table-cell">{t('withdrawal.method', { defaultValue: 'Method' })}</div>
                            <div className="table-cell">{t('withdrawal.type', { defaultValue: 'Type' })}</div>
                            <div className="table-cell">{t('withdrawal.status', { defaultValue: 'Status' })}</div>
                            <div className="table-cell">{t('withdrawal.bonusAmount', { defaultValue: 'Bonus amount' })}</div>
                        </div>
                    {sortedUserDeposits.map((deposit) => {
                            const currencyIcon = allMethods.find(c => c.id === deposit.wallet_type)?.icon;
                            return (
                                <div key={`deposit-${deposit.id}`} className="table-row">
                                    <div className="table-cell id-cell">{deposit.id}</div>
                                    <div className="table-cell date-cell">{formatDate(deposit.createdAt)}</div>
                                    <div className="table-cell amount-cell">${deposit.amount}</div>
                                    <div className="table-cell method-cell">
                                        <span className="method-badge">
                                            {currencyIcon}
                                            <span>{deposit.wallet_type.toUpperCase()}</span>
                                        </span>
                                    </div>
                                    <div className="table-cell type-cell">{t('deposit.typeDeposit', { defaultValue: 'Deposit' })}</div>
                                    <div className="table-cell status-cell">
                                        <span className={`status-badge status-${deposit.status}`}>
                                            {getStatusText(deposit.status)}
                                        </span>
                                    </div>
                                    <div className="table-cell bonus-cell">$0</div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
            {isCryptoCategory && (
            <div className="transaction-submission">
                <div className="transaction-submission__header">
                    <h3 className="section-title">{t('deposit.submitTransaction')}</h3>
                    <div className="transaction-submission__chips">
                        <div className="transaction-submission__chip transaction-submission__chip--accent">
                            {selectedCurrencyConfig?.icon}
                            <span>{selectedCurrencyConfig?.symbol ?? selectedCurrency?.toUpperCase() ?? '—'}</span>
                        </div>
                        <div className="transaction-submission__chip">
                            <span>{t('deposit.minDeposit')}</span>
                            <strong>
                                ${selectedCurrencyConfig && selectedCurrencyConfig.minAmount !== null && selectedCurrencyConfig.minAmount !== undefined && selectedCurrencyConfig.minAmount > 0 ? selectedCurrencyConfig.minAmount.toFixed(2) : '20.00'}
                            </strong>
                        </div>
                        <div className="transaction-submission__chip">
                            <span>{t('deposit.networkConfirmations')}</span>
                            <strong>{confirmationsRequired > 0 ? confirmationsRequired : t('deposit.instant')}</strong>
                        </div>
                    </div>
                </div>

                <div className="transaction-submission__grid">
                    <section className="transaction-submission__form">
                        {/* Блок промокода из реферальной ссылки */}
                        {referralPromocodeLoading && (
                            <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#f5f5f5', borderRadius: '8px', fontSize: '14px' }}>
                                Загрузка промокода из ссылки...
                            </div>
                        )}
                        {referralPromocode && !rejectedReferralPromocode && !promocode.trim() && (
                            <div style={{ 
                                marginBottom: '1rem', 
                                padding: '1rem', 
                                backgroundColor: '#e3f2fd', 
                                borderRadius: '8px',
                                border: '1px solid #2196f3'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                    <div>
                                        <div style={{ fontWeight: 600, marginBottom: '0.25rem', color: '#1976d2' }}>
                                            ✓ Промокод активирован из реферальной ссылки
                                        </div>
                                        {referralPromocode.name && (
                                            <div style={{ fontSize: '14px', color: '#666', marginBottom: '0.25rem' }}>
                                                {referralPromocode.name}
                                            </div>
                                        )}
                                        {referralPromocode.discountType && referralPromocode.discountValue && (
                                            <div style={{ fontSize: '13px', color: '#555', marginTop: '0.5rem' }}>
                                                {referralPromocode.discountType === 'percentage' 
                                                    ? `Бонус: ${referralPromocode.discountValue}%`
                                                    : `Бонус: $${referralPromocode.discountValue}`
                                                }
                                                {referralPromocode.minAmount && (
                                                    <span> (мин. сумма: ${referralPromocode.minAmount})</span>
                                                )}
                                                {referralPromocode.maxDiscount && referralPromocode.discountType === 'percentage' && (
                                                    <span> (макс. бонус: $${referralPromocode.maxDiscount})</span>
                                                )}
                                                {referralPromocode.description && (
                                                    <div style={{ marginTop: '0.5rem', fontSize: '12px', color: '#777', fontStyle: 'italic' }}>
                                                        {referralPromocode.description}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setRejectedReferralPromocode(true);
                                            setReferralPromocode(null);
                                        }}
                                        style={{
                                            padding: '0.5rem 1rem',
                                            border: '1px solid #ddd',
                                            borderRadius: '6px',
                                            backgroundColor: 'white',
                                            cursor: 'pointer',
                                            fontSize: '12px',
                                            color: '#666'
                                        }}
                                    >
                                        Отказаться
                                    </button>
                                </div>
                            </div>
                        )}
                        
                        <label className="transaction-submission__label" htmlFor="promocode">
                            {referralPromocode && !rejectedReferralPromocode && !promocode.trim() 
                                ? 'Или укажите другой промокод' 
                                : 'Промокод (необязательно)'
                            }
                        </label>
                        <div className="transaction-submission__field">
                            <div className="transaction-submission__input-wrapper">
                                <input
                                    id="promocode"
                                    type="text"
                                    className="transaction-submission__input"
                                    value={promocode}
                                    onChange={(e) => {
                                        setPromocode(e.target.value.toUpperCase());
                                        // Если пользователь вводит промокод, отменяем промокод из ссылки
                                        if (e.target.value.trim() && referralPromocode && !rejectedReferralPromocode) {
                                            setRejectedReferralPromocode(true);
                                        }
                                    }}
                                    placeholder="Введите промокод"
                                    disabled={submitting || !selectedCurrency}
                                />
                            </div>
                            {validatingPromocode && (
                                <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>Проверка...</div>
                            )}
                            {promocodeValidation && !validatingPromocode && (
                                <div style={{ 
                                    marginTop: '8px', 
                                    fontSize: '12px',
                                    color: promocodeValidation.valid ? '#00ff8c' : '#ff4444'
                                }}>
                                    {promocodeValidation.valid ? (
                                        <span>
                                            ✓ Промокод применен! Бонус: ${promocodeValidation.discount?.toFixed(2) || 0}
                                            {promocodeValidation.finalAmount && (
                                                <span> (Итого: ${promocodeValidation.finalAmount.toFixed(2)})</span>
                                            )}
                                        </span>
                                    ) : (
                                        <span>✗ {promocodeValidation.error || t('errors.promocodeInvalid')}</span>
                                    )}
                                </div>
                            )}
                        </div>
                        
                        <label className="transaction-submission__label" htmlFor="transaction-hash">
                            {t('deposit.transactionHash')}
                        </label>
                        <div className="transaction-submission__field">
                            <div className="transaction-submission__input-wrapper">
                                <input
                                    id="transaction-hash"
                                    type="text"
                                    className="transaction-submission__input"
                                    value={transactionHash}
                                    onChange={(e) => handleHashChange(e.target.value)}
                                    placeholder={t('deposit.enterTransactionHash')}
                                    disabled={submitting || !selectedCurrency}
                                />
                            </div>
                            <button
                                type="button"
                                className={`transaction-submission__action${submitting ? ' is-loading' : ''}${
                                    isSubmitDisabled ? ' is-disabled' : ''
                                }`}
                                onClick={submitTransactionHash}
                                disabled={isSubmitDisabled}
                            >
                                {submitting ? (
                                    <>
                                        <div className="transaction-submission__action-spinner"></div>
                                        {t('deposit.submitting')}
                                    </>
                                ) : (
                                    t('deposit.submit')
                                )}
                            </button>
                        </div>

                        {submitError && (
                            <div className="transaction-submission__alert transaction-submission__alert--error">
                                {submitError}
                            </div>
                        )}

                        {submitSuccess && (
                            <div className="transaction-submission__alert transaction-submission__alert--success">
                                {t('deposit.submissionSuccess')}
                            </div>
                        )}
                    </section>

                    <section className="transaction-submission__aside">
                        <div className="transaction-submission__aside-header">
                            <span className="transaction-submission__aside-title">
                                {t('deposit.submissionAsideTitle') ?? t('deposit.submissionNote')}
                            </span>
                            <span className="transaction-submission__aside-caption">
                                {t('deposit.submissionAsideSubtitle')}
                            </span>
                        </div>
                        <ul className="transaction-submission__list">
                            {submissionNotes.map((note) => (
                                <li key={note} className="transaction-submission__list-item">
                                    <span className="transaction-submission__list-bullet">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                                            <path
                                                d="M20 7L10 17L4 11"
                                                stroke="currentColor"
                                                strokeWidth="1.8"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            />
                                        </svg>
                                    </span>
                                    <span>{note}</span>
                                </li>
                            ))}
                        </ul>
                    </section>
                </div>
            </div>
            )}
                </div>
            </div>
        </div>
    );
}

