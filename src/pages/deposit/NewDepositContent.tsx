import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useAppDispatch, useAppSelector } from "@src/shared/lib/hooks.ts";
import { selectConfigLoading, selectWallets, selectConfigError } from "@src/entities/deposit/model/selectors.ts";
import { selectProfile } from "@src/entities/user/model/selectors.ts";
import { fetchWallets } from "@src/entities/deposit/model/slice.ts";
import { useLanguage } from "@src/app/providers/useLanguage.ts";
import { paymentMethodsApi, ampayApi, type StructuredCategory } from "@src/shared/api";
import type { AmpayTransaction } from "@src/shared/api/ampay/types";
import { detectUserCountry } from "@src/shared/lib/geolocation.util";
import { CountrySelect } from "@src/shared/ui/CountrySelect";
import { promocodeApi, type ReferralPromocode, type PromocodeValidation } from "@src/shared/api/promocode/promocodeApi";
import { useSearchParams } from "react-router-dom";
import bonusImage from "@src/assets/images/bonus/Bonus125.png";
import { convertFromUSDSync, convertToUSDSync, hasRealExchangeRates, initializeExchangeRates, type SupportedCurrency } from "@src/shared/lib/currency/exchangeRates";
import { formatCurrency, getCurrencySymbol, getCurrencyInfo, CURRENCY_INFO } from "@src/shared/lib/currency/currencyUtils";
import { getMinAmountForMethod, getCurrencyForMethod } from "@src/shared/lib/payment-methods/min-amounts";
import { checkAndRegisterUser } from "@src/features/auth/authCheck";
import { Container, Row, Col } from "@src/shared/ui/grid";
import "./NewDepositContent.css";

interface SavedPromocode {
  code: string;
  validatedAt: string;
  discountType?: 'percentage' | 'fixed';
  discountValue?: number;
  minAmount?: number | null;
  maxDiscount?: number | null;
  description?: string | null;
  name?: string | null;
  validFrom?: string | null;
  validUntil?: string | null;
  isActive?: boolean;
  isValid: boolean;
  error?: string;
}

const STORAGE_KEY = 'user_promocodes';

export function NewDepositContent() {
    const { t } = useLanguage();
    const dispatch = useAppDispatch();
    const loading = useAppSelector(selectConfigLoading);
    const error = useAppSelector(selectConfigError);
    const wallets = useAppSelector(selectWallets);
    const userData = useAppSelector(selectProfile);
    
    // State to force re-render when exchange rates are loaded
    const [ratesRefreshKey, setRatesRefreshKey] = useState(0);
    
    // Initialize exchange rates on component mount
    // Always fetches fresh rates from server (no cache)
    useEffect(() => {
        initializeExchangeRates()
            .then(() => {
                console.log('[NewDepositContent] Exchange rates initialized, forcing re-render');
                setRatesRefreshKey(prev => prev + 1); // Force re-render
            })
            .catch((error) => {
                console.error('[NewDepositContent] Failed to initialize exchange rates:', error);
            });
    }, []);

    // Debug: Log currency changes (only when currency actually changes)
    const prevCurrencyRef2 = useRef<string>('');
    useEffect(() => {
        const currency = (userData as any)?.currency || 'USD';
        if (prevCurrencyRef2.current !== currency) {
            console.log('[NewDepositContent] Currency changed:', prevCurrencyRef2.current, '->', currency);
            prevCurrencyRef2.current = currency;
        }
    }, [userData]);
    
    // Force re-render when currency changes by using a key or state
    const currencyKey = ((userData as any)?.currency || 'USD') as SupportedCurrency;
    
    const [searchParams, setSearchParams] = useSearchParams();
    const profileCountryCode = 
        (userData as any)?.country || 
        (userData as any)?.country_code || 
        (userData as any)?.countryCode || 
        null;
    
    const [paymentMethods, setPaymentMethods] = useState<StructuredCategory[]>([]);
    const [loadingPaymentMethods, setLoadingPaymentMethods] = useState(true);
    const [selectedCountry, setSelectedCountry] = useState<string>("");
    const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
    const [selectedMethodData, setSelectedMethodData] = useState<any>(null);
    const [showDepositForm, setShowDepositForm] = useState(false);
    const [depositAmount, setDepositAmount] = useState<number | null>(500);
    // Use user's currency from profile (global currency) - this is synced with LanguageCurrencyModal
    // Get currency directly from userData using useMemo to ensure reactivity
    const selectedCurrency = useMemo(() => {
        const currency = ((userData as any)?.currency || 'USD') as SupportedCurrency;
        return currency;
    }, [(userData as any)?.currency, userData]);
    
    // Sync deposit amount when currency changes
    const prevCurrencyRef = useRef<SupportedCurrency>(selectedCurrency);
    useEffect(() => {
        if (prevCurrencyRef.current !== selectedCurrency) {
            // Convert current deposit amount to new currency
            if (depositAmount !== null) {
                const amountInUSD = convertToUSDSync(depositAmount, prevCurrencyRef.current);
                const amountInNewCurrency = convertFromUSDSync(amountInUSD, selectedCurrency);
                if (amountInNewCurrency !== null) {
                    setDepositAmount(Math.round(amountInNewCurrency * 100) / 100);
                }
            }
            prevCurrencyRef.current = selectedCurrency;
        }
    }, [selectedCurrency, depositAmount]);
    const [promoCode, setPromoCode] = useState<string>('');
    const [withoutPromo, setWithoutPromo] = useState<boolean>(true);
    const [promoCodeInfoOpen, setPromoCodeInfoOpen] = useState<boolean>(false);
    const [referralPromocode, setReferralPromocode] = useState<ReferralPromocode | null>(null);
    const [referralPromocodeLoading, setReferralPromocodeLoading] = useState<boolean>(false);
    const [promocodeValidation, setPromocodeValidation] = useState<PromocodeValidation | null>(null);
    const [validatingPromocode, setValidatingPromocode] = useState<boolean>(false);
    const [savedPromocodes, setSavedPromocodes] = useState<SavedPromocode[]>([]);
    const [showPromocodeDropdown, setShowPromocodeDropdown] = useState<boolean>(false);
    const [firstName, setFirstName] = useState<string>('');
    const [lastName, setLastName] = useState<string>('');
    const [wallet, setWallet] = useState<string>(''); // Номер телефона/кошелька для H2H_DEPOSIT методов
    const [walletFromProfile, setWalletFromProfile] = useState<boolean>(false); // Флаг, что wallet взят из профиля
    const [userCountryCode, setUserCountryCode] = useState<string | null>(null);
    const [errorModal, setErrorModal] = useState<{ open: boolean; message: string; kycRequired?: boolean }>({ open: false, message: '' });
    const [amountInputTouched, setAmountInputTouched] = useState<boolean>(false); // Флаг, что поле суммы было в фокусе
    // Состояние для показа страницы с деталями платежа (вместо модального окна)
    const [paymentDetailsPage, setPaymentDetailsPage] = useState<{ 
        show: boolean; 
        transaction: AmpayTransaction | null;
        paymentData: any | null;
    }>({ show: false, transaction: null, paymentData: null });
    // Поля для карты (только для CARD методов)
    const [cardNumber, setCardNumber] = useState<string>('');
    const [cardExpire, setCardExpire] = useState<string>('');
    const [cardCvc, setCardCvc] = useState<string>('');
    // Загруженные изображения для подтверждения оплаты (до 4-х)
    const [uploadedImages, setUploadedImages] = useState<Array<{ file: File; preview: string; id: string }>>([]);
    const [uploadingImages, setUploadingImages] = useState<boolean>(false);
    
    // Состояния для криптовалютных пополнений
    const [cryptoTransactionGenerated, setCryptoTransactionGenerated] = useState<boolean>(false);
    const [timerSeconds, setTimerSeconds] = useState<number>(0);
    const [checkProgress1, setCheckProgress1] = useState<number>(0); // Первая проверка
    const [checkProgress2, setCheckProgress2] = useState<number>(0); // Вторая проверка
    const [checkStatus1, setCheckStatus1] = useState<'pending' | 'checking' | 'completed'>('pending');
    const [checkStatus2, setCheckStatus2] = useState<'pending' | 'checking' | 'completed'>('pending');
    
    // Заполняем имя, фамилию и телефон из профиля при загрузке данных
    useEffect(() => {
        if (userData) {
            const userFirstName = (userData as any)?.firstname || (userData as any)?.first_name || (userData as any)?.firstName || '';
            const userLastName = (userData as any)?.lastname || (userData as any)?.last_name || (userData as any)?.lastName || '';
            const userPhone = (userData as any)?.phone || (userData as any)?.phone_number || '';
            if (userFirstName) setFirstName(userFirstName);
            if (userLastName) setLastName(userLastName);
            if (userPhone) setWallet(userPhone);
        }
    }, [userData]);
    
    // Отслеживаем изменения состояния страницы платежа для отладки
    useEffect(() => {
        if (paymentDetailsPage.show) {
            console.log('[NewDepositContent] paymentDetailsPage state changed:', {
                show: paymentDetailsPage.show,
                hasTransaction: !!paymentDetailsPage.transaction,
                transactionId: paymentDetailsPage.transaction?.id,
                hasPaymentData: !!paymentDetailsPage.paymentData
            });
        }
    }, [paymentDetailsPage]);
    
    const [countries, setCountries] = useState<Array<{ code: string; name: string }>>([]);
    const [loadingCountries, setLoadingCountries] = useState(true);
    const hasAutoSelectedCountry = useRef(false); // Флаг, что страна была установлена автоматически
    const hasLoadedReferralPromocode = useRef(false); // Флаг, что реферальный промокод был загружен
    const hasProcessedUrlParams = useRef(false); // Флаг, что URL параметры были обработаны

    // Функция загрузки методов оплаты
    // Используем AmPay API getStructuredMethods, который возвращает структурированные данные
    // с полями method, sub_method, currency из AmPayPaymentMethods
    const loadPaymentMethods = useCallback(async (countryCode: string | null) => {
        if (!countryCode) {
            setPaymentMethods([]);
            setLoadingPaymentMethods(false);
            return;
        }

        try {
            setLoadingPaymentMethods(true);
            // Use AmPay API to get structured methods with method, sub_method, currency fields
            const response = await ampayApi.getStructuredMethods(countryCode, 'IN');
            
            console.log('[loadPaymentMethods] Raw response from API:', {
                response,
                hasData: !!response?.data,
                dataType: typeof response?.data,
                isArray: Array.isArray(response?.data),
                dataLength: Array.isArray(response?.data) ? response.data.length : 'not array'
            });
            
            const methodsArray = Array.isArray(response?.data) ? response.data : [];
            setPaymentMethods(methodsArray);
            
            // Логируем методы для отладки
            console.log('[loadPaymentMethods] Loaded AmPay methods for country:', countryCode, {
                categoriesCount: methodsArray.length,
                totalMethods: methodsArray.reduce((sum: number, cat: any) => sum + (cat.methods?.length || 0), 0),
                totalCards: methodsArray.reduce((sum: number, cat: any) => 
                    sum + (cat.methods?.reduce((s: number, m: any) => s + (m.cards?.length || 0), 0) || 0), 0
                ),
                methods: methodsArray.map(cat => ({
                    category: cat.name,
                    methods: cat.methods?.map((m: any) => ({
                        type: m.type,
                        name: m.name,
                        cardsCount: m.cards?.length || 0,
                        cards: m.cards?.map((c: any) => ({
                            id: c.id,
                            method: c.method,
                            sub_method: c.sub_method,
                            currency: c.currency,
                            name: c.name
                        })) || []
                    })) || []
                })) || []
            });
        } catch (err) {
            console.error("Error loading payment methods:", err);
            setPaymentMethods([]);
        } finally {
            setLoadingPaymentMethods(false);
        }
    }, []);

    // Load countries list from API
    useEffect(() => {
        const loadCountries = async () => {
            try {
                setLoadingCountries(true);
                const countriesList = await paymentMethodsApi.getAllCountries();
                
                if (countriesList && countriesList.length > 0) {
                    setCountries(countriesList);
                } else {
                    console.warn("No countries returned from API");
                }
            } catch (err) {
                console.error("Error loading countries:", err);
            } finally {
                setLoadingCountries(false);
            }
        };

        loadCountries();
    }, []);

    // Определение страны пользователя (без установки selectedCountry, т.к. страны еще не загружены)
    useEffect(() => {
        dispatch(fetchWallets());
        
        const detectCountry = async () => {
            let countryCode: string | null = null;
            const geoData = profileCountryCode ? { countryCode: profileCountryCode } : await detectUserCountry();
            countryCode = geoData?.countryCode || null;
            
            setUserCountryCode(countryCode);
        };

        detectCountry();
    }, [dispatch, profileCountryCode]);

    // Функция для валидации промокода
    const validatePromocode = useCallback(async (code: string, amount: number) => {
        if (!code.trim()) {
            setPromocodeValidation(null);
            return;
        }
        
        if (!amount || amount <= 0) {
            setPromocodeValidation({ valid: false, error: t('deposit.promocodeEnterAmountError') });
            return;
        }
        
        // Convert amount from selected currency to USD for API
        const amountInUSD = selectedCurrency === 'USD' ? amount : convertToUSDSync(amount, selectedCurrency);
        
        if (amountInUSD === null) {
            setPromocodeValidation({ valid: false, error: t('deposit.ratesUnavailable', { defaultValue: 'Exchange rates unavailable. Please try again later.' }) });
            setValidatingPromocode(false);
            return;
        }
        
        console.log('[NewDepositContent] Валидация промокода:', { code, amount, selectedCurrency, amountInUSD });
        setValidatingPromocode(true);
        try {
            const validation = await promocodeApi.validate(code.trim(), amountInUSD);
            console.log('[NewDepositContent] Результат валидации:', validation);
            
            // Проверяем правильность расчета для отладки
            // ВАЖНО: validation.discount и validation.finalAmount в USD, а amount в выбранной валюте
            if (validation.valid && validation.finalAmount && validation.discount) {
                // Конвертируем amount в USD для сравнения (уже есть amountInUSD выше)
                const expectedFinal = amountInUSD + validation.discount;
                console.log('[NewDepositContent] Проверка расчета (в USD):', {
                    amountInUSD,
                    discount: validation.discount,
                    finalAmount: validation.finalAmount,
                    expectedFinal,
                    match: Math.abs(validation.finalAmount - expectedFinal) < 0.01
                });
            }
            
            setPromocodeValidation(validation);
        } catch (error: any) {
            console.error('[NewDepositContent] Ошибка валидации промокода:', error);
            setPromocodeValidation({ valid: false, error: t('deposit.promocodeValidationError') });
        } finally {
            setValidatingPromocode(false);
        }
    }, [selectedCurrency]);

    // Функция для выбора промокода из списка
    const handleSelectPromocode = useCallback(async (selectedPromocode: SavedPromocode) => {
        setPromoCode(selectedPromocode.code);
        setWithoutPromo(false);
        setShowPromocodeDropdown(false);
        
        // Валидируем промокод, если есть сумма депозита
        if (depositAmount !== null && depositAmount > 0) {
            await validatePromocode(selectedPromocode.code, depositAmount);
        }
    }, [depositAmount, validatePromocode]);

    // Валидируем промокод при изменении суммы или промокода
    useEffect(() => {
        if (promoCode.trim() && depositAmount !== null && depositAmount > 0 && !withoutPromo) {
            const timeoutId = setTimeout(() => {
                validatePromocode(promoCode, depositAmount);
            }, 500);
            return () => clearTimeout(timeoutId);
        } else {
            setPromocodeValidation(null);
        }
    }, [promoCode, depositAmount, withoutPromo, validatePromocode]);

    // REMOVED: parseNameKey function - no longer needed, all data comes structured from API

    // Обработка URL параметров для автоматического заполнения промокода и суммы
    useEffect(() => {
        // Обрабатываем параметры только один раз при монтировании
        if (hasProcessedUrlParams.current) {
            return;
        }
        
        const promoCodeParam = searchParams.get('promoCode');
        const amountParam = searchParams.get('amount');
        
        if (promoCodeParam || amountParam) {
            hasProcessedUrlParams.current = true;
            
            if (promoCodeParam) {
                const promoCodeValue = promoCodeParam.toUpperCase();
                setPromoCode(promoCodeValue);
                setWithoutPromo(false);
                console.log('[NewDepositContent] Promo code from URL:', promoCodeValue);
            }
            
            if (amountParam) {
                const amountValue = parseFloat(amountParam);
                if (!isNaN(amountValue) && amountValue > 0) {
                    setDepositAmount(amountValue);
                    console.log('[NewDepositContent] Amount from URL:', amountValue);
                }
            }
            
            // Очищаем параметры из URL после использования
            const newSearchParams = new URLSearchParams(searchParams);
            newSearchParams.delete('promoCode');
            newSearchParams.delete('amount');
            setSearchParams(newSearchParams, { replace: true });
        }
    }, [searchParams, setSearchParams]);

    // Загрузка реферального промокода при монтировании компонента
    useEffect(() => {
        const loadReferralPromocode = async () => {
            if (!userData?.id || hasLoadedReferralPromocode.current) {
                return;
            }
            
            try {
                setReferralPromocodeLoading(true);
                
                // Сначала проверяем localStorage на наличие промокода из URL при регистрации
                const savedPromocode = localStorage.getItem('referral_promocode');
                if (savedPromocode) {
                    console.log('[NewDepositContent] Промокод найден в localStorage:', savedPromocode);
                    setPromoCode(savedPromocode.toUpperCase());
                    setWithoutPromo(false);
                    // Удаляем промокод из localStorage после использования
                    localStorage.removeItem('referral_promocode');
                    console.log('[NewDepositContent] ✅ Промокод из localStorage установлен и удален:', savedPromocode);
                    hasLoadedReferralPromocode.current = true;
                    return;
                }
                
                // Если промокода в localStorage нет, загружаем из API
                const referralPromo = await promocodeApi.getReferralPromocode();
                
                console.log('[NewDepositContent] Реферальный промокод получен:', referralPromo);
                console.log('[NewDepositContent] Детали промокода:', {
                    exists: !!referralPromo,
                    isActive: referralPromo?.isActive,
                    hasCode: !!referralPromo?.code,
                    code: referralPromo?.code,
                    name: referralPromo?.name,
                    discountType: referralPromo?.discountType,
                    discountValue: referralPromo?.discountValue
                });
                
                if (referralPromo && referralPromo.code) {
                    console.log('[NewDepositContent] Промокод найден, проверяем активность:', {
                        code: referralPromo.code,
                        isActive: referralPromo.isActive
                    });
                    
                    setReferralPromocode(referralPromo);
                    
                    // Автоматически заполняем поле промокода, если оно пустое и нет промокода из URL
                    // Показываем промокод даже если isActive = false, чтобы пользователь мог его видеть
                    setPromoCode(prevCode => {
                        // Заполняем только если поле пустое и нет промокода из URL
                        const urlPromoCode = searchParams.get('promoCode');
                        if (urlPromoCode) {
                            return prevCode.trim() || urlPromoCode.toUpperCase();
                        }
                        const newCode = prevCode.trim() || referralPromo.code;
                        console.log('[NewDepositContent] Устанавливаем промокод в поле:', { prevCode, newCode });
                        return newCode;
                    });
                    
                    // Снимаем галочку "Without promo", так как промокод найден
                    setWithoutPromo(false);
                    
                    console.log('[NewDepositContent] ✅ Реферальный промокод успешно установлен:', referralPromo.code);
                } else {
                    console.log('[NewDepositContent] ❌ Реферальный промокод не найден или невалидный:', {
                        hasPromo: !!referralPromo,
                        hasCode: !!referralPromo?.code,
                        code: referralPromo?.code
                    });
                }
                hasLoadedReferralPromocode.current = true;
            } catch (error) {
                console.error('Ошибка загрузки реферального промокода:', error);
            } finally {
                setReferralPromocodeLoading(false);
            }
        };

        loadReferralPromocode();
    }, [userData?.id, searchParams]);

    // Загрузка сохраненных промокодов из localStorage
    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                setSavedPromocodes(Array.isArray(parsed) ? parsed : []);
            }
        } catch (error) {
            console.error('[NewDepositContent] Error loading saved promocodes:', error);
        }
    }, []);

    // Закрытие выпадающего списка при клике вне его
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (showPromocodeDropdown && 
                !target.closest('.deposit-promocode-dropdown') && 
                !target.closest('.deposit-promocode-select-btn')) {
                setShowPromocodeDropdown(false);
            }
        };

        if (showPromocodeDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => {
                document.removeEventListener('mousedown', handleClickOutside);
            };
        }
    }, [showPromocodeDropdown]);

    // Автоматическая установка страны после загрузки списка стран
    useEffect(() => {
        // Устанавливаем страну автоматически, когда:
        // 1. Страны загружены
        // 2. Страна еще не была установлена (пустая строка)
        // 3. userCountryCode определен (или определен позже)
        if (countries.length > 0 && !loadingCountries && (!selectedCountry || selectedCountry === "")) {
            let countryToSet: string | null = null;
            
            // Приоритет 1: страна пользователя из профиля/геолокации
            if (userCountryCode) {
                const userCountryExists = countries.some(c => c.code === userCountryCode);
                if (userCountryExists) {
                    countryToSet = userCountryCode;
                }
            }
            
            // Приоритет 2: UA, если есть в списке
            if (!countryToSet) {
                const uaCountry = countries.find(c => c.code === "UA");
                if (uaCountry) {
                    countryToSet = uaCountry.code;
                }
            }
            
            // Приоритет 3: первая страна из списка
            if (!countryToSet && countries.length > 0) {
                countryToSet = countries[0].code;
            }
            
            // Устанавливаем страну и загружаем методы оплаты
            if (countryToSet) {
                setSelectedCountry(countryToSet);
                loadPaymentMethods(countryToSet);
                hasAutoSelectedCountry.current = true; // Отмечаем, что страна была установлена автоматически
            }
        }
    }, [countries, loadingCountries, userCountryCode, selectedCountry, loadPaymentMethods]);
    
    // Дополнительный эффект: если userCountryCode определился после загрузки стран,
    // и страна была установлена автоматически (не пользователем), обновляем её
    useEffect(() => {
        if (countries.length > 0 && !loadingCountries && userCountryCode && hasAutoSelectedCountry.current) {
            const userCountryExists = countries.some(c => c.code === userCountryCode);
            // Обновляем только если страна пользователя существует в списке и отличается от текущей
            if (userCountryExists && selectedCountry !== userCountryCode) {
                setSelectedCountry(userCountryCode);
                loadPaymentMethods(userCountryCode);
            }
        }
    }, [userCountryCode, countries, loadingCountries, selectedCountry, loadPaymentMethods]);

    // Обновление методов оплаты при изменении выбранной страны пользователем
    useEffect(() => {
        // Загружаем методы только если страна была изменена вручную (не при инициализации)
        // Проверяем, что userCountryCode уже установлен (инициализация прошла)
        if (selectedCountry && userCountryCode !== null && selectedCountry !== userCountryCode) {
            loadPaymentMethods(selectedCountry);
        }
    }, [selectedCountry, userCountryCode, loadPaymentMethods]);

    // Группируем методы по категориям
    const groupedMethods = useMemo(() => {
        const popular: any[] = [];
        const bankCards: any[] = [];
        const crypto: any[] = [];
        
        // Map для группировки методов по method + sub_method (игнорируя валюту и страну)
        const methodGroups = new Map<string, any>();

        console.log('[groupedMethods] Processing paymentMethods:', {
            categoriesCount: paymentMethods.length,
            categories: paymentMethods.map(cat => ({
                name: cat.name,
                methodsCount: cat.methods?.length || 0,
                methods: cat.methods?.map((m: any) => ({
                    id: m.id,
                    type: m.type,
                    name: m.name,
                    cryptocurrenciesCount: m.cryptocurrencies?.length || 0,
                    cardsCount: m.cards?.length || 0
                })) || []
            }))
        });

        paymentMethods.forEach(category => {
            category.methods.forEach(method => {
                // Обрабатываем методы типа 'card'
                if (method.type === 'card') {
                    // Если есть карты, обрабатываем их
                    if (method.cards.length > 0) {
                        method.cards.forEach(card => {
                            // Создаем ключ для группировки: method + sub_method (без валюты и страны)
                            // Используем any для доступа к полям, которые могут быть в данных
                            const cardAny = card as any;
                            const methodKey = `${(cardAny.method || '').toUpperCase()}_${(cardAny.sub_method || '').toUpperCase()}`;
                            
                            if (!methodGroups.has(methodKey)) {
                                // Создаем объединенную карточку метода
                                const cardData = {
                                    ...card,
                                    methodName: method.name,
                                    methodIcon: method.icon,
                                    type: 'card',
                                    // Сохраняем все варианты валют и стран для этого метода
                                    variants: [card],
                                    // Используем первый вариант как основной для отображения
                                    method: cardAny.method,
                                    sub_method: cardAny.sub_method,
                                    // Убираем валюту и страну из отображаемого названия
                                    name: cardAny.method && cardAny.sub_method 
                                        ? `${cardAny.method}/${cardAny.sub_method}` 
                                        : (card.name || 'Visa / Mastercard')
                                };
                                methodGroups.set(methodKey, cardData);
                                bankCards.push(cardData);
                                
                                // Visa/Mastercard в Popular
                                if (card.name && (card.name.toLowerCase().includes('visa') || card.name.toLowerCase().includes('mastercard'))) {
                                    popular.push(cardData);
                                }
                            } else {
                                // Добавляем вариант к существующей группе
                                const existingCard = methodGroups.get(methodKey);
                                if (existingCard && !existingCard.variants.find((v: any) => v.id === card.id)) {
                                    existingCard.variants.push(card);
                                }
                            }
                        });
                    } else {
                        // Метод типа 'card' без карт - добавляем сам метод как карточку
                        const methodData = {
                            id: method.id,
                            name: method.name || method.name_key || 'Card Payment',
                            methodName: method.name,
                            methodIcon: method.icon,
                            type: 'card',
                            variants: [],
                            method: (method as any).method_code,
                            sub_method: (method as any).sub_method_code,
                            min_amount: method.min_amount,
                            max_amount: method.max_amount
                        };
                        bankCards.push(methodData);
                    }
                } else if (method.type === 'crypto') {
                    // Handle crypto methods from AmPay API
                    // AmPay returns crypto methods with type='crypto' and cryptocurrencies array
                    console.log('[groupedMethods] Processing crypto method:', {
                        id: method.id,
                        name: method.name,
                        symbol: method.symbol,
                        cryptocurrenciesCount: method.cryptocurrencies?.length || 0,
                        cryptocurrencies: method.cryptocurrencies
                    });
                    
                    if (method.cryptocurrencies && method.cryptocurrencies.length > 0) {
                        method.cryptocurrencies.forEach(c => {
                            const cryptoData = {
                                ...c,
                                // Ensure name, symbol, and network have fallback values
                                name: c.name || c.name_key || c.symbol || method.name || `Crypto ${c.id || ''}`,
                                symbol: c.symbol || method.symbol || c.name_key || 'CRYPTO',
                                network: c.network || method.network || '',
                                methodName: method.name,
                                methodIcon: method.icon || c.icon,
                                type: 'crypto'
                            };
                            console.log('[groupedMethods] Added crypto from cryptocurrencies array:', cryptoData);
                            crypto.push(cryptoData);
                            // USDT в Popular
                            if (c.name_key && (c.name_key.toLowerCase() === 'usdt' || c.symbol?.toUpperCase() === 'USDT' || method.symbol?.toUpperCase() === 'USDT')) {
                                popular.push(cryptoData);
                            }
                        });
                    } else {
                        // If no cryptocurrencies array, treat the method itself as crypto
                        const cryptoData = {
                            id: method.id,
                            name: method.name || method.symbol || `Crypto ${method.id || ''}`,
                            symbol: method.symbol || 'CRYPTO',
                            name_key: method.name_key || `crypto_${(method.symbol || 'unknown').toLowerCase()}`,
                            network: method.network || '',
                            icon: method.icon,
                            wallet: (method as any).wallet,
                            qr_code_image: (method as any).qr_code_image,
                            min_amount: method.min_amount,
                            max_amount: method.max_amount,
                            order: method.order || 0,
                            methodName: method.name,
                            methodIcon: method.icon,
                            type: 'crypto'
                        };
                        console.log('[groupedMethods] Added crypto from method itself:', cryptoData);
                        crypto.push(cryptoData);
                        // USDT в Popular
                        if (method.symbol?.toUpperCase() === 'USDT' || method.name_key?.toLowerCase() === 'usdt') {
                            popular.push(cryptoData);
                        }
                    }
                } else if (method.type === 'ewallet' && method.cryptocurrencies && method.cryptocurrencies.length > 0) {
                    method.cryptocurrencies.forEach(c => {
                        const cryptoData = {
                            ...c,
                            // Ensure name, symbol, and network have fallback values
                            name: c.name || c.name_key || c.symbol || `Crypto ${c.id || ''}`,
                            symbol: c.symbol || c.name_key || 'CRYPTO',
                            network: c.network || '',
                            methodName: method.name,
                            methodIcon: method.icon,
                            type: 'crypto'
                        };
                        crypto.push(cryptoData);
                        // USDT в Popular
                        if (c.name_key && (c.name_key.toLowerCase() === 'usdt' || c.symbol?.toUpperCase() === 'USDT')) {
                            popular.push(cryptoData);
                        }
                    });
                } else if (method.cryptocurrencies && method.cryptocurrencies.length > 0) {
                    method.cryptocurrencies.forEach(c => {
                        crypto.push({
                            ...c,
                            // Ensure name, symbol, and network have fallback values
                            name: c.name || c.name_key || c.symbol || `Crypto ${c.id || ''}`,
                            symbol: c.symbol || c.name_key || 'CRYPTO',
                            network: c.network || '',
                            methodName: method.name,
                            methodIcon: method.icon,
                            type: 'crypto'
                        });
                    });
                } else if (method.type === 'ewallet' || method.type === 'bank_transfer' || method.type === 'other') {
                    // Сервер уже отфильтровал методы, просто добавляем их как есть
                    // Обрабатываем e-wallet методы с криптовалютами, если они есть
                    if (method.cryptocurrencies && method.cryptocurrencies.length > 0) {
                        method.cryptocurrencies.forEach(c => {
                            const cryptoData = {
                                ...c,
                                name: c.name || c.name_key || c.symbol || method.name || `Crypto ${c.id || ''}`,
                                symbol: c.symbol || c.name_key || 'CRYPTO',
                                network: c.network || '',
                                methodName: method.name,
                                methodIcon: method.icon,
                                type: 'crypto'
                            };
                            crypto.push(cryptoData);
                        });
                    } else {
                        // E-wallet/bank_transfer/other методы без криптовалют - добавляем как методы для банковских карт
                        const methodData = {
                            id: method.id,
                            name: method.name || method.name_key || 'Payment Method',
                            methodName: method.name,
                            methodIcon: method.icon,
                            type: method.type,
                            min_amount: method.min_amount,
                            max_amount: method.max_amount
                        };
                        // Добавляем в соответствующий массив в зависимости от типа
                        if (method.type === 'ewallet') {
                            // E-wallets можно добавлять в bankCards или отдельный массив
                            bankCards.push(methodData);
                        } else {
                            bankCards.push(methodData);
                        }
                    }
                }
            });
        });

        console.log('[groupedMethods] Final grouped methods:', {
            popularCount: popular.length,
            bankCardsCount: bankCards.length,
            cryptoCount: crypto.length,
            crypto: crypto.map(c => ({ id: c.id, name: c.name, symbol: c.symbol }))
        });

        return { popular, bankCards, crypto };
    }, [paymentMethods]);

    const handleMethodSelect = (methodId: string) => {
        setSelectedMethod(methodId);
        
        // Находим данные выбранного метода из groupedMethods
        let methodData = null;
        
        // Проверяем, что groupedMethods доступен
        if (groupedMethods) {
            // Ищем в popular
            const popularMethod = groupedMethods.popular.find(m => m.id?.toString() === methodId);
            if (popularMethod) {
                methodData = popularMethod;
            } else {
                // Ищем в bankCards
                const bankCardMethod = groupedMethods.bankCards.find(c => c.id?.toString() === methodId);
                if (bankCardMethod) {
                    methodData = bankCardMethod;
                } else {
                    // Ищем в crypto
                    const cryptoMethod = groupedMethods.crypto.find(c => c.id?.toString() === methodId);
                    if (cryptoMethod) {
                        methodData = cryptoMethod;
                    }
                }
            }
        }
        
        // Если метод не найден в groupedMethods, ищем напрямую в paymentMethods
        if (!methodData && paymentMethods.length > 0) {
            for (const category of paymentMethods) {
                for (const method of category.methods) {
                    if (method.type === 'crypto') {
                        // Handle crypto methods from AmPay API
                        if (method.cryptocurrencies && method.cryptocurrencies.length > 0) {
                            const crypto = method.cryptocurrencies.find(c => c.id?.toString() === methodId);
                            if (crypto) {
                                methodData = {
                                    ...crypto,
                                    methodName: method.name,
                                    methodIcon: method.icon,
                                    type: 'crypto'
                                };
                                break;
                            }
                        } else if (method.id?.toString() === methodId) {
                            // If method itself is crypto and matches ID
                            methodData = {
                                id: method.id,
                                name: method.name || method.symbol || `Crypto ${method.id || ''}`,
                                symbol: method.symbol || 'CRYPTO',
                                name_key: method.name_key || `crypto_${(method.symbol || 'unknown').toLowerCase()}`,
                                network: method.network || '',
                                icon: method.icon,
                                wallet: (method as any).wallet,
                                qr_code_image: (method as any).qr_code_image,
                                min_amount: method.min_amount,
                                max_amount: method.max_amount,
                                methodName: method.name,
                                methodIcon: method.icon,
                                type: 'crypto'
                            };
                            break;
                        }
                    } else if (method.type === 'card' && method.cards.length > 0) {
                        const card = method.cards.find(c => c.id?.toString() === methodId);
                        if (card) {
                            methodData = {
                                ...card,
                                methodName: method.name,
                                methodIcon: method.icon,
                                type: 'card'
                            };
                            break;
                        }
                    } else if (method.cryptocurrencies && method.cryptocurrencies.length > 0) {
                        const crypto = method.cryptocurrencies.find(c => c.id?.toString() === methodId);
                        if (crypto) {
                            methodData = {
                                ...crypto,
                                methodName: method.name,
                                methodIcon: method.icon,
                                type: 'crypto'
                            };
                            break;
                        }
                    }
                }
                if (methodData) break;
            }
        }
        
        if (methodData) {
            // Если у метода есть варианты (variants), выбираем подходящий вариант на основе страны
            if (methodData.variants && methodData.variants.length > 0) {
                const countryCode = selectedCountry || userCountryCode || '';
                
                // Ищем вариант, который соответствует выбранной стране
                let selectedVariant = methodData.variants.find((v: any) => {
                    // Проверяем, есть ли у варианта страна, которая соответствует выбранной
                    // Или используем первый доступный вариант
                    return !countryCode || !v.country || v.country === countryCode;
                });
                
                // Если не нашли подходящий вариант, берем первый
                if (!selectedVariant) {
                    selectedVariant = methodData.variants[0];
                }
                
                // Объединяем данные метода с выбранным вариантом
                methodData = {
                    ...methodData,
                    ...selectedVariant,
                    // Сохраняем все варианты для использования при создании транзакции
                    variants: methodData.variants
                };
            }
            
            // Auto-determine FTD/STD based on user deposit history
            // Only for methods that support FTD/STD sub-methods
            const paymentMethod = methodData.method;
            const methodCurrency = methodData.currency || getCurrencyForMethod(selectedCountry || userCountryCode || '', paymentMethod, methodData.sub_method);
            
            // Check if method supports FTD/STD (CARD, CARD_WINDOW, WINDOW_P2P, etc.)
            const methodsWithFTDSTD = ['CARD', 'CARD_WINDOW', 'WINDOW_P2P'];
            if (paymentMethod && methodsWithFTDSTD.includes(paymentMethod) && methodCurrency) {
                // Use async function to get sub-method
                (async () => {
                    try {
                        const subMethodResponse = await ampayApi.getCurrentSubMethod(paymentMethod, methodCurrency);
                        if (subMethodResponse && subMethodResponse.sub_method) {
                            // Update methodData with correct sub_method (FTD or STD)
                            setSelectedMethodData((prev: any) => ({
                                ...(prev || methodData),
                                sub_method: subMethodResponse.sub_method
                            }));
                            console.log('[NewDepositContent] Auto-selected sub-method:', {
                                paymentMethod,
                                methodCurrency,
                                subMethod: subMethodResponse.sub_method,
                                reason: subMethodResponse.sub_method === 'STD' ? 'User has successful deposits' : 'First time deposit'
                            });
                        }
                    } catch (error) {
                        console.warn('[NewDepositContent] Failed to get current sub-method, using default:', error);
                        // If API call fails, keep original sub_method or default to FTD
                        setSelectedMethodData((prev: any) => ({
                            ...(prev || methodData),
                            sub_method: methodData.sub_method || 'FTD'
                        }));
                    }
                })();
            }
            
            setSelectedMethodData(methodData);
            setShowDepositForm(true);
            // Устанавливаем имя и фамилию из профиля, если доступно
            if (userData) {
                const userFirstName = (userData as any)?.firstname || (userData as any)?.first_name || (userData as any)?.firstName || '';
                const userLastName = (userData as any)?.lastname || (userData as any)?.last_name || (userData as any)?.lastName || '';
                if (userFirstName) setFirstName(userFirstName);
                if (userLastName) setLastName(userLastName);
            }
        }
    };

    // Автоматически обновляем вариант метода при изменении страны
    useEffect(() => {
        if (selectedMethodData && selectedMethodData.variants && selectedMethodData.variants.length > 0) {
            const countryCode = selectedCountry || userCountryCode || '';
            
            // Ищем вариант, который соответствует выбранной стране
            let selectedVariant = selectedMethodData.variants.find((v: any) => {
                return !countryCode || !v.country || v.country === countryCode;
            });
            
            // Если не нашли подходящий вариант, берем первый
            if (!selectedVariant) {
                selectedVariant = selectedMethodData.variants[0];
            }
            
            // Обновляем selectedMethodData с выбранным вариантом
            if (selectedVariant) {
                setSelectedMethodData({
                    ...selectedMethodData,
                    ...selectedVariant,
                    variants: selectedMethodData.variants // Сохраняем все варианты
                });
            }
        }
    }, [selectedCountry, userCountryCode]);

    const handleBackToMethodSelection = () => {
        setShowDepositForm(false);
        setSelectedMethod(null);
        setSelectedMethodData(null);
    };

    // Функция для проверки и применения промокода на основе суммы
    const checkAndApplyPromocodeForAmount = useCallback((amount: number) => {
        // Конвертируем amount в USD для сравнения
        const amountInUSD = selectedCurrency === 'USD' ? amount : convertToUSDSync(amount, selectedCurrency);
        
        // Если конвертация не удалась, не применяем промокод
        if (amountInUSD === null) {
            return null;
        }
        
        // Диапазоны сумм с промокодами (в USD)
        // От 1 до 49: промокод не добавляется
        // От 50 до 149: промокод FROM50
        // От 150 до 499: промокод FROM150
        // От 500 до 20000: промокод FROM500
        // От 20000 и выше: промокод не применяется
        
        let matchingPromocode: string | null = null;
        
        if (amountInUSD >= 500 && amountInUSD < 20000) {
            matchingPromocode = 'FROM500';
        } else if (amountInUSD >= 150 && amountInUSD < 500) {
            matchingPromocode = 'FROM150';
        } else if (amountInUSD >= 50 && amountInUSD < 150) {
            matchingPromocode = 'FROM50';
        } else if (amountInUSD < 50 || amountInUSD >= 20000) {
            // Не применяем промокод для сумм < 50 или >= 20000
            matchingPromocode = null;
        }
        
        // Если нашли подходящий промокод
        if (matchingPromocode) {
            // Проверяем, есть ли уже введенный промокод и валиден ли он
            const hasValidPromocode = promocodeValidation?.valid === true;
            
            // Если промокод не введен или невалидный, вставляем промокод из диапазона
            if (!promoCode.trim() || !hasValidPromocode) {
                console.log('[NewDepositContent] Автоматически применяем промокод:', matchingPromocode, 'для суммы:', amountInUSD, 'USD');
                setPromoCode(matchingPromocode);
                setWithoutPromo(false);
                // Валидируем промокод
                validatePromocode(matchingPromocode, amount);
            }
        } else {
            // Если сумма не соответствует ни одному диапазону, очищаем промокод
            if (promoCode.trim() && !promocodeValidation?.valid) {
                console.log('[NewDepositContent] Сумма', amountInUSD, 'USD не соответствует диапазонам, очищаем невалидный промокод');
                setPromoCode('');
                setWithoutPromo(true);
                setPromocodeValidation(null);
            } else if (!promoCode.trim()) {
                // Если промокод не введен и сумма не в диапазоне, просто сбрасываем
                setWithoutPromo(true);
                setPromocodeValidation(null);
            }
        }
    }, [selectedCurrency, promoCode, promocodeValidation, validatePromocode]);

    const handleAmountSelect = (amount: number, promocode?: string) => {
        setDepositAmount(amount);
        // Автоматически заполняем промокод при выборе карточки
        if (promocode && promocode.trim()) {
            console.log('[NewDepositContent] Выбрана карточка с суммой:', amount, 'и промокодом:', promocode);
            setPromoCode(promocode.trim());
            setWithoutPromo(false);
        } else {
            // Если промокод не передан, проверяем автоматически
            checkAndApplyPromocodeForAmount(amount);
        }
    };

    const showError = (message: string) => {
        console.log('[NewDepositContent] showError called with message:', message);
        setErrorModal({ open: true, message });
    };

    const closeErrorModal = () => {
        setErrorModal({ open: false, message: '', kycRequired: false });
    };

    const goToProfile = () => {
        window.location.href = '/profile?tab=kyc';
    };

    // Проверяем, является ли метод криптовалютным
    const isCryptoMethod = selectedMethodData?.type === 'crypto' || selectedMethodData?.method === 'CRYPTO';

    // Функция генерации ссылки для криптовалютных пополнений
    const handleGenerateCryptoLink = () => {
        if (!selectedMethodData || depositAmount === null || depositAmount <= 0) {
            showError(t('deposit.enterAmount', { defaultValue: 'Please enter deposit amount' }));
            return;
        }

        // Проверяем, что есть wallet или qr_code_image
        if (!selectedMethodData.wallet && !selectedMethodData.qr_code_image) {
            showError(t('deposit.cryptoWalletNotConfigured', { defaultValue: 'Wallet address or QR code is not configured for this payment method' }));
            return;
        }

        // Для криптовалютных методов просто показываем QR и кошелек из данных метода
        // Не нужно создавать транзакцию через AmPay
        console.log('[NewDepositContent] Generating crypto link with method data:', selectedMethodData);

        // Устанавливаем состояние для показа QR и кошелька
        setCryptoTransactionGenerated(true);
        
        // Устанавливаем таймер на 15 минут (900 секунд)
        setTimerSeconds(900);
        
        // Запускаем проверки (без transactionId, так как транзакция не создается)
        startCryptoChecks();
    };

    // Функция запуска проверок для криптовалютной транзакции
    const startCryptoChecks = () => {
        // Первая проверка - начинаем сразу
        setCheckStatus1('checking');
        setCheckProgress1(0);
        
        // Симуляция первой проверки (0-100% за 30 секунд)
        const check1Interval = setInterval(() => {
            setCheckProgress1(prev => {
                if (prev >= 100) {
                    clearInterval(check1Interval);
                    setCheckStatus1('completed');
                    // Запускаем вторую проверку
                    setCheckStatus2('checking');
                    setCheckProgress2(0);
                    
                    // Вторая проверка (0-100% за 60 секунд)
                    const check2Interval = setInterval(() => {
                        setCheckProgress2(prev => {
                            if (prev >= 100) {
                                clearInterval(check2Interval);
                                setCheckStatus2('completed');
                                return 100;
                            }
                            return prev + (100 / 60); // 60 шагов за 60 секунд
                        });
                    }, 1000); // Обновляем каждую секунду
                    
                    return 100;
                }
                return prev + (100 / 30); // 30 шагов за 30 секунд
            });
        }, 1000); // Обновляем каждую секунду
    };

    // Таймер для криптовалютных пополнений
    useEffect(() => {
        if (!cryptoTransactionGenerated) {
            return;
        }
        
        const timer = setInterval(() => {
            setTimerSeconds(prev => {
                if (prev <= 1) {
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [cryptoTransactionGenerated]);

    // Get minimum amount for selected method in method's currency
    // Priority: 1) min_amount from API (selectedMethodData.min_amount), 2) static min-amounts.ts file
    const methodMinAmount = useMemo(() => {
        if (!selectedMethodData || !selectedCountry) return null;
        
        // First, try to use min_amount from API (if available)
        // IMPORTANT: min_amount from API is ALREADY in the method's currency (from name_key), NOT in USD!
        if (selectedMethodData.min_amount !== null && selectedMethodData.min_amount !== undefined && selectedMethodData.min_amount > 0) {
            return selectedMethodData.min_amount;
        }
        
        // Fallback to static min-amounts.ts file
        // Use structured data from API - NO PARSING
        let method = selectedMethodData.method || '';
        let subMethod = selectedMethodData.sub_method || undefined;
        let methodCurrency = selectedMethodData.currency;
        
        if (!methodCurrency) {
            methodCurrency = getCurrencyForMethod(selectedCountry, method, subMethod);
        }
        
        const staticMinAmount = getMinAmountForMethod(selectedCountry, method, subMethod, methodCurrency);
        if (staticMinAmount) {
            console.log('[NewDepositContent] Using min_amount from static file:', staticMinAmount, 'for method:', method, subMethod, methodCurrency);
        }
        return staticMinAmount;
    }, [selectedMethodData, selectedCountry]);

    // Convert deposit amount from selected currency to USD for API
    const depositAmountInUSD = useMemo(() => {
        const amount = depositAmount ?? 0;
        if (selectedCurrency === 'USD') {
            console.log('[NewDepositContent] depositAmountInUSD: Already in USD:', amount);
            return amount;
        }
        const converted = convertToUSDSync(amount, selectedCurrency);
        const result = converted !== null ? converted : amount; // Fallback to original amount if conversion fails
        console.log('[NewDepositContent] depositAmountInUSD: Converted:', {
            depositAmount: amount,
            selectedCurrency,
            converted,
            result
        });
        return result;
    }, [depositAmount, selectedCurrency]);

    // Get method currency (currency required by payment method)
    const methodCurrency = useMemo(() => {
        if (!selectedMethodData) return null;
        return selectedMethodData.currency || getCurrencyForMethod(selectedCountry, selectedMethodData.method || '', selectedMethodData.sub_method);
    }, [selectedMethodData, selectedCountry]);

    // Convert deposit amount to method currency (for transaction creation)
    const depositAmountInMethodCurrency = useMemo(() => {
        if (!methodCurrency || !depositAmount) return null;
        if (selectedCurrency === methodCurrency) return depositAmount;
        
        // Convert from selected currency to USD, then to method currency
        const amountInUSD = convertToUSDSync(depositAmount, selectedCurrency);
        if (amountInUSD === null) {
            console.warn('[NewDepositContent] depositAmountInMethodCurrency: convertToUSDSync returned null', {
                depositAmount,
                selectedCurrency
            });
            return null;
        }
        const converted = convertFromUSDSync(amountInUSD, methodCurrency);
        if (converted === null) {
            console.warn('[NewDepositContent] depositAmountInMethodCurrency: convertFromUSDSync returned null', {
                amountInUSD,
                methodCurrency
            });
            return null;
        }
        
        console.log('[NewDepositContent] depositAmountInMethodCurrency calculation:', {
            depositAmount,
            selectedCurrency,
            methodCurrency,
            amountInUSD,
            converted,
            calculation: `${depositAmount} ${selectedCurrency} -> ${amountInUSD} USD -> ${converted} ${methodCurrency}`
        });
        
        return converted;
    }, [depositAmount, selectedCurrency, methodCurrency]);

    // Check if currency conversion is needed
    const needsCurrencyConversion = useMemo(() => {
        return methodCurrency && selectedCurrency && methodCurrency !== selectedCurrency;
    }, [methodCurrency, selectedCurrency]);

    // Check if selected payment method requires phone number
    const requiresPhone = useMemo(() => {
        if (!selectedMethodData) return false;
        const method = selectedMethodData.method;
        // Methods that require phone number
        const phoneRequiredMethods = [
            'WINDOW_P2P',
            'WINDOW_INDIA',
            'INDIA_H2H',
            'H2H_DEPOSIT',
            'E_WALLET', // Some e-wallet methods may require phone
            'BANK_TRANSFER' // Some bank transfer methods may require phone
        ];
        return phoneRequiredMethods.includes(method);
    }, [selectedMethodData]);

    // Check if user has phone number
    const userPhone = useMemo(() => {
        return (userData as any)?.phone || (userData as any)?.phone_number || '';
    }, [userData]);

    // Check if phone is missing for methods that require it
    const isPhoneMissing = useMemo(() => {
        return requiresPhone && !userPhone;
    }, [requiresPhone, userPhone]);

    // Convert method min amount from method currency to selected currency for display
    const methodMinAmountInSelectedCurrency = useMemo(() => {
        if (!methodMinAmount || !selectedMethodData || !selectedCountry) return null;
        
        // Determine method currency - use structured data from API
        let methodCurrency: string | null = selectedMethodData.currency || null;
        
        // If not found in name_key, try getCurrencyForMethod
        if (!methodCurrency) {
            const method = selectedMethodData.method || '';
            const subMethod = selectedMethodData.sub_method || undefined;
            methodCurrency = getCurrencyForMethod(selectedCountry, method, subMethod);
        }
        
        // Last resort: use selectedMethodData.currency (but this might not be set for ewallet methods)
        if (!methodCurrency && selectedMethodData.currency) {
            methodCurrency = selectedMethodData.currency;
        }
        
        if (!methodCurrency) {
            return null;
        }
        
        // If method currency is the same as selected currency, no conversion needed
        if (methodCurrency === selectedCurrency) {
            return methodMinAmount;
        }
        
        // Convert from method currency to USD, then to selected currency
        // IMPORTANT: min_amount is ALREADY in methodCurrency, not in USD!
        const minAmountInUSD = convertToUSDSync(methodMinAmount, methodCurrency);
        if (minAmountInUSD === null) {
            return null;
        }
        const converted = convertFromUSDSync(minAmountInUSD, selectedCurrency);
        return converted;
    }, [methodMinAmount, selectedMethodData, selectedCountry, selectedCurrency]);

    // Validate amount - show error only if field was touched or on submit
    const amountValidationError = useMemo(() => {
        // Don't show error if field wasn't touched yet
        if (!amountInputTouched) {
            return null;
        }
        
        if (!selectedMethodData || depositAmount === null || depositAmount <= 0) {
            return null;
        }
        
        if (methodMinAmountInSelectedCurrency && depositAmount < methodMinAmountInSelectedCurrency) {
            return {
                message: t('deposit.minAmountRequired', {
                    defaultValue: 'Minimum deposit amount is {{amount}}',
                    amount: formatCurrency(methodMinAmountInSelectedCurrency, selectedCurrency, { decimals: 0, convertFromUSD: false })
                }),
                minAmount: methodMinAmountInSelectedCurrency
            };
        }
        
        return null;
    }, [depositAmount, methodMinAmountInSelectedCurrency, selectedCurrency, selectedMethodData, amountInputTouched, t]);

    // Convert promo code amounts from USD to selected currency (MUST be at top level, not in conditional)
    const totalAmount = useMemo(() => {
        if (promocodeValidation?.valid && promocodeValidation?.finalAmount) {
            // finalAmount в USD, конвертируем в выбранную валюту
            if (selectedCurrency === 'USD') return promocodeValidation.finalAmount;
            const converted = convertFromUSDSync(promocodeValidation.finalAmount, selectedCurrency);
            return converted !== null ? converted : depositAmount ?? 0;
        }
        return depositAmount ?? 0;
    }, [promocodeValidation, selectedCurrency, depositAmount]);
    
    // Конвертируем discount из USD в выбранную валюту для отображения
    const discountInSelectedCurrency = useMemo(() => {
        if (promocodeValidation?.valid && promocodeValidation?.discount) {
            if (selectedCurrency === 'USD') return promocodeValidation.discount;
            const converted = convertFromUSDSync(promocodeValidation.discount, selectedCurrency);
            return converted !== null ? converted : 0;
        }
        return 0;
    }, [promocodeValidation, selectedCurrency]);

    const handleDeposit = async () => {
        // Mark amount field as touched when user tries to submit
        setAmountInputTouched(true);
        
        if (!selectedMethodData) {
            showError(t('deposit.selectMethod', { defaultValue: 'Please select a payment method' }));
            return;
        }

        if (depositAmount === null || depositAmount <= 0) {
            showError(t('deposit.enterAmount', { defaultValue: 'Please enter deposit amount' }));
            return;
        }

        // Validate minimum amount in selected currency
        if (methodMinAmountInSelectedCurrency && depositAmount < methodMinAmountInSelectedCurrency) {
            const minAmountFormatted = formatCurrency(methodMinAmountInSelectedCurrency, selectedCurrency, { decimals: 0, convertFromUSD: false });
            showError(
                t('deposit.minAmountRequired', { 
                    defaultValue: `Minimum deposit amount is ${minAmountFormatted}`,
                    amount: minAmountFormatted
                })
            );
            return;
        }

        // Для криптовалютных методов не требуем имя и фамилию
        if (!isCryptoMethod && (!firstName || !lastName)) {
            showError(t('deposit.enterName', { defaultValue: 'Please enter your first and last name' }));
            return;
        }

        // Проверяем, является ли метод CARD (не CARD_WINDOW)
        const isCardMethod = selectedMethodData.method === 'CARD';
        
        // Для CARD методов проверяем поля карты
        if (isCardMethod) {
            const cardNumberClean = cardNumber.replace(/\s/g, '');
            if (!cardNumberClean || cardNumberClean.length < 13) {
                showError(t('deposit.enterCardNumber', { defaultValue: 'Please enter a valid card number' }));
                return;
            }
            if (!cardExpire || !/^\d{2}\/\d{2}$/.test(cardExpire)) {
                showError(t('deposit.enterCardExpire', { defaultValue: 'Please enter card expiration date in MM/YY format' }));
                return;
            }
            
            // Валидация месяца и года
            const [month, year] = cardExpire.split('/');
            const monthNum = parseInt(month, 10);
            const yearNum = parseInt(year, 10);
            const currentYear = new Date().getFullYear() % 100; // Последние 2 цифры года
            const currentMonth = new Date().getMonth() + 1;
            
            if (monthNum < 1 || monthNum > 12) {
                showError(t('deposit.invalidCardMonth', { defaultValue: 'Card expiration month must be between 01 and 12' }));
                return;
            }
            
            // Год должен быть не меньше текущего года (если месяц уже прошел в текущем году, то год должен быть больше)
            if (yearNum < currentYear || (yearNum === currentYear && monthNum < currentMonth)) {
                showError(t('deposit.cardExpired', { defaultValue: 'Card expiration date cannot be in the past' }));
                return;
            }
            
            // Год не должен быть слишком далеко в будущем (например, не больше текущего + 20 лет)
            if (yearNum > (currentYear + 20) % 100) {
                showError(t('deposit.invalidCardYear', { defaultValue: 'Card expiration year is too far in the future' }));
                return;
            }
            if (!cardCvc || cardCvc.length !== 3) {
                showError(t('deposit.enterCardCvc', { defaultValue: 'Please enter card CVC code (3 digits)' }));
                return;
            }
        }

        try {
            // Для криптовалютных методов используем отдельную обработку
            if (isCryptoMethod) {
                // Для криптовалютных методов генерируем транзакцию
                await handleGenerateCryptoLink();
                return;
            }

            // Для всех остальных методов пытаемся создать транзакцию через AmPay API
            // Сервер сам проверит, поддерживается ли метод, и вернет ошибку, если нет
            {
                // ALWAYS send amount in USD - server will convert to method currency
                // This avoids double conversion issues on client
                let amount = depositAmountInUSD;
                
                if (!amount || amount <= 0) {
                    showError(t('deposit.enterAmount', { defaultValue: 'Please enter deposit amount' }));
                    return;
                }
                
                // Validate amount is reasonable (should be in USD, not already converted)
                if (amount > 10000) {
                    console.error('[NewDepositContent] ⚠️ SUSPICIOUS AMOUNT - Amount seems too large for USD:', {
                        depositAmount,
                        selectedCurrency,
                        depositAmountInUSD: amount,
                        methodCurrency,
                        warning: 'Amount might already be in method currency, not USD!'
                    });
                }
                
                console.log('[NewDepositContent] Sending amount in USD (server will convert):', {
                    depositAmount,
                    selectedCurrency,
                    methodCurrency,
                    amountInUSD: amount,
                    note: 'Server will convert USD to method currency',
                    validation: amount > 10000 ? 'WARNING: Amount seems too large!' : 'OK'
                });
                
                const fullName = [firstName, lastName].filter(Boolean).join(' ').trim() || userData?.email?.split('@')[0] || 'User';

                // Используем структурированные данные из метода
                // НЕ используем name_key - все данные должны быть в отдельных полях
                let paymentMethod = selectedMethodData.method;
                // Use method currency (required by payment method), not user's selected currency
                let currency = methodCurrency || selectedMethodData.currency || 'USD';
                let subMethod = selectedMethodData.sub_method;
                
                // Валидация: если paymentMethod содержит дефисы (старый формат), это ошибка
                if (paymentMethod && paymentMethod.includes('-')) {
                    console.error('[NewDepositContent] ERROR: paymentMethod contains dashes (old format):', paymentMethod);
                    showError('Invalid payment method format. Please refresh the page and try again.');
                    return;
                }
                
                // Валидация: paymentMethod обязателен
                if (!paymentMethod) {
                    console.error('[NewDepositContent] ERROR: paymentMethod is missing from selectedMethodData:', selectedMethodData);
                    showError('Payment method is not properly configured. Please select another method.');
                    return;
                }
                
                // Если у метода есть варианты (variants), выбираем подходящий вариант на основе выбранной страны
                if (selectedMethodData.variants && selectedMethodData.variants.length > 0) {
                    const countryCode = selectedCountry || userCountryCode || '';
                    
                    // Ищем вариант, который соответствует выбранной стране
                    let selectedVariant = selectedMethodData.variants.find((v: any) => {
                        // Проверяем, есть ли у варианта страна, которая соответствует выбранной
                        return !countryCode || !v.country || v.country === countryCode;
                    });
                    
                    // Если не нашли подходящий вариант, берем первый
                    if (!selectedVariant) {
                        selectedVariant = selectedMethodData.variants[0];
                    }
                    
                    // Используем валюту и другие данные из выбранного варианта
                    if (selectedVariant.currency) {
                        currency = selectedVariant.currency;
                        // amount уже в USD (depositAmountInUSD), не нужно конвертировать
                        // Сервер сам конвертирует USD в валюту метода
                    }
                    if (selectedVariant.sub_method) {
                        subMethod = selectedVariant.sub_method;
                    }
                    if (selectedVariant.method) {
                        paymentMethod = selectedVariant.method;
                    }
                }
                
                // Если method не указан, но есть type === 'card' - это карточный метод AmPay
                if (!paymentMethod && selectedMethodData.type === 'card') {
                    // Для карточных методов из API используем 'CARD' по умолчанию
                    paymentMethod = 'CARD';
                }
                
                // Если валюта не указана, пытаемся определить по типу метода или payment_method
                if (!currency) {
                    if (selectedMethodData.type === 'card') {
                        // Для карточных методов по умолчанию используем EUR
                        currency = 'EUR';
                    } else if (paymentMethod) {
                        // Определяем валюту по методу оплаты
                        if (paymentMethod === 'WINDOW_INDIA' || paymentMethod === 'SETTLEMENT' || paymentMethod === 'INDIA_H2H') {
                            currency = 'INR';
                        } else if (paymentMethod === 'WINDOW_P2P') {
                            // Для WINDOW_P2P определяем валюту по стране
                            const countryCode = selectedCountry || userCountryCode || '';
                            if (countryCode === 'IN') {
                                currency = 'INR';
                            } else if (countryCode === 'KZ') {
                                currency = 'KZT';
                            } else if (countryCode === 'KG') {
                                currency = 'KGS';
                            } else if (countryCode === 'AZ') {
                                currency = 'AZN';
                            } else if (countryCode === 'UZ') {
                                currency = 'UZS';
                            } else if (countryCode === 'TJ') {
                                currency = 'TJS';
                            } else if (countryCode === 'AR') {
                                currency = 'ARS';
                            } else if (countryCode === 'ID') {
                                currency = 'IDR';
                            } else if (countryCode === 'VE') {
                                currency = 'VES';
                            } else if (countryCode === 'CO') {
                                currency = 'COP';
                            } else if (countryCode === 'MX') {
                                currency = 'MXN';
                            } else if (countryCode === 'PE') {
                                currency = 'PEN';
                            } else if (countryCode === 'CL') {
                                currency = 'CLP';
                            } else if (countryCode === 'VN') {
                                currency = 'VND';
                            } else if (countryCode === 'BR') {
                                currency = 'BRL';
                            } else {
                                // По умолчанию используем валюту пользователя
                                currency = selectedCurrency || 'USD';
                            }
                        } else {
                            // По умолчанию используем валюту пользователя
                            currency = selectedCurrency || 'USD';
                        }
                    } else {
                        // По умолчанию используем валюту пользователя
                        currency = selectedCurrency || 'USD';
                    }
                }
                
                // Для OPENBANKING валюта всегда EUR
                if (paymentMethod === 'OPENBANKING') {
                    currency = 'EUR';
                    // Если sub_method не указан, используем FOR по умолчанию
                    if (!subMethod) {
                        subMethod = 'FOR';
                    }
                }
                
                // Если paymentMethod все еще не определен, это ошибка
                if (!paymentMethod) {
                    throw new Error('Failed to determine payment method');
                }
                
                // Для CARD методов sub_method определяется автоматически на бэкенде
                // Но можно передать явно, если он есть в selectedMethodData
                const isWindowP2PCIS = paymentMethod === 'WINDOW_P2P' && subMethod === 'CIS';
                
                // Для OPENBANKING обязательно нужна страна
                const countryForTransaction = paymentMethod === 'OPENBANKING' 
                    ? (selectedCountry || userCountryCode || '')
                    : (selectedCountry || userCountryCode || '');
                
                if (paymentMethod === 'OPENBANKING' && !countryForTransaction) {
                    showError(t('deposit.selectCountry', { defaultValue: 'Please select a country for Open Banking payment' }));
                    return;
                }
                
                // Определяем, нужен ли success_redirect_url
                // Для методов с payment_data (P2P_CIS/CARD) не нужен редирект, так как показываем модальное окно на странице депозита
                // Для WINDOW_P2P/CIS нужен редирект на страницу оплаты
                const isP2PCISWithPaymentData = paymentMethod === 'P2P_CIS' && (subMethod === 'CARD' || !subMethod);
                const needsRedirect = !isP2PCISWithPaymentData;
                
                console.log('[NewDepositContent] Final transaction data before sending:', {
                    payment_method: paymentMethod,
                    sub_method: subMethod,
                    currency,
                    amount,
                    amountType: typeof amount,
                    depositAmount,
                    selectedCurrency,
                    methodCurrency,
                    depositAmountInUSD,
                    depositAmountInMethodCurrency,
                    '⚠️ IMPORTANT': 'Amount should be in USD, server will convert to method currency',
                    '✅ Amount in USD (sending to server)': amount,
                    '📍 Method currency': currency,
                    '🔄 Server will convert': `${amount} USD -> ${currency}`
                });
                
                const transactionData: any = {
                    payment_method: paymentMethod || 'CARD',
                    sub_method: subMethod || undefined, // Бэкенд определит автоматически для CARD, для OPENBANKING передаем FOR/GAM
                    currency: isWindowP2PCIS ? '' : (currency || 'EUR'),
                    amount: amount,
                    customer: {
                        full_name: fullName,
                        email: userData?.email || '',
                        phone: userData?.phone || '',
                        country: countryForTransaction,
                        ip: '',
                        language: 'EN'
                    }
                };
                
                // Добавляем success_redirect_url только если нужен редирект
                // Для P2P_CIS/CARD оставляем пользователя на странице депозита с модальным окном
                if (needsRedirect) {
                    transactionData.success_redirect_url = window.location.origin + '/profile';
                } else {
                    // Для методов с payment_data используем текущую страницу, чтобы модальное окно осталось открытым
                    transactionData.success_redirect_url = window.location.origin + window.location.pathname;
                }

                // Для CARD методов добавляем данные карты
                if (isCardMethod && paymentMethod === 'CARD') {
                    transactionData.card = {
                        card_number: cardNumber.replace(/\s/g, ''), // Убираем пробелы
                        card_holder: fullName.toUpperCase(), // Имя держателя в UPPERCASE
                        card_expire: cardExpire, // MM/YY
                        card_cvc: cardCvc // 3 цифры
                    };
                }

                // Для H2H_DEPOSIT методов добавляем wallet (номер телефона/кошелька)
                if (paymentMethod === 'H2H_DEPOSIT') {
                    if (!wallet || wallet.trim() === '') {
                        showError(t('deposit.walletRequired', { defaultValue: 'Phone number or wallet is required for this payment method' }));
                        return;
                    }
                    transactionData.wallet = wallet.trim();
                }

                console.log('[NewDepositContent] Creating transaction with data:', transactionData);

                const transaction = await ampayApi.createTransaction(transactionData);

                console.log('[NewDepositContent] Transaction created:', {
                    id: transaction?.id,
                    tracker_id: transaction?.tracker_id,
                    redirect_url: transaction?.redirect_url,
                    status: transaction?.status,
                    payment_data: transaction?.payment_data,
                    payment_data_type: typeof transaction?.payment_data,
                    payment_data_keys: transaction?.payment_data ? Object.keys(transaction.payment_data) : null,
                    payment_method: transaction?.payment_method,
                    sub_method: transaction?.sub_method,
                    behavior_type: (transaction as any)?.behavior_type,
                    fullTransaction: JSON.stringify(transaction, null, 2)
                });

                // Determine payment method behavior type from server response
                // Server returns behavior_type: 'window' for WINDOW methods, 'form' for others
                // Fallback to determining by payment_method if behavior_type not provided
                const behaviorType = (transaction as any)?.behavior_type || 
                                    (paymentMethod && paymentMethod.startsWith('WINDOW_') ? 'window' : 'form');
                const isWindowMethod = behaviorType === 'window';
                
                console.log('[NewDepositContent] Payment method behavior:', {
                    paymentMethod,
                    behaviorType,
                    isWindowMethod,
                    hasRedirectUrl: !!transaction?.redirect_url,
                    redirectUrlValue: transaction?.redirect_url,
                    hasPaymentData: !!transaction?.payment_data,
                    transactionKeys: transaction ? Object.keys(transaction) : []
                });

                // For WINDOW methods (behavior_type === 'window') - open redirect_url in new tab/window
                if (isWindowMethod) {
                    // WINDOW methods MUST have redirect_url from payment gateway
                    // If redirect_url is missing, it means the payment gateway hasn't returned it yet
                    if (transaction?.redirect_url) {
                        console.log('[NewDepositContent] Opening WINDOW method in new tab:', transaction.redirect_url);
                        window.open(transaction.redirect_url, '_blank', 'noopener,noreferrer');
                        // Show success message and stay on current page
                        // User can close the payment window after payment
                        return;
                    } else {
                        // For WINDOW methods, redirect_url is REQUIRED from payment gateway
                        // If it's missing, show error - don't fallback to payment page
                        console.error('[NewDepositContent] WINDOW method missing redirect_url from payment gateway:', {
                            transactionId: transaction?.id,
                            paymentMethod,
                            transaction
                        });
                        showError(t('deposit.windowMethodNoRedirect', { 
                            defaultValue: 'Payment gateway did not return payment form URL. Please try again or contact support.' 
                        }));
                        return;
                    }
                }
                
                // For non-WINDOW methods with payment_data - show payment details page
                // Check payment_data BEFORE redirect_url to prioritize modal/page view
                if (transaction?.payment_data) {
                    const paymentData = transaction.payment_data;
                    const hasValidPaymentData = typeof paymentData === 'object' && 
                                               paymentData !== null && 
                                               !Array.isArray(paymentData) && 
                                               Object.keys(paymentData).length > 0;
                    
                    if (hasValidPaymentData) {
                        console.log('[NewDepositContent] Showing payment details page with payment_data:', paymentData);
                        console.log('[NewDepositContent] Setting paymentDetailsPage state...');
                        console.log('[NewDepositContent] Transaction object:', transaction);
                        console.log('[NewDepositContent] Transaction keys:', transaction ? Object.keys(transaction) : 'null');
                        
                        // Switch to payment details page instead of modal
                        const pageState = {
                            show: true,
                            transaction: transaction,
                            paymentData: paymentData
                        };
                        console.log('[NewDepositContent] Page state to set:', pageState);
                        
                        // Set state to show payment details page
                        setPaymentDetailsPage(pageState);
                        
                        console.log('[NewDepositContent] paymentDetailsPage state set, page should be visible now');
                        // Important: Do NOT redirect and do NOT execute further code
                        // Payment details page should replace all content
                        return;
                    } else {
                        console.log('[NewDepositContent] payment_data is not a valid object:', paymentData);
                    }
                } 
                
                // If there's redirect_url from AmPay (but no payment_data) - redirect to it
                // This is for non-WINDOW methods that still need redirect
                if (transaction?.redirect_url) {
                    console.log('[NewDepositContent] Redirecting to:', transaction.redirect_url);
                    window.location.href = transaction.redirect_url;
                    return;
                } 
                
                // Если ничего нет - показываем ошибку
                console.log('[NewDepositContent] No payment_data or redirect_url in transaction:', {
                    hasTransaction: !!transaction,
                    hasPaymentData: !!transaction?.payment_data,
                    hasRedirectUrl: !!transaction?.redirect_url,
                    transactionKeys: transaction ? Object.keys(transaction) : []
                });
                showError(t('deposit.transactionCreatedNoData', { defaultValue: 'Transaction created, but payment details are not available. Please check your transactions.' }));
            }
        } catch (error: any) {
            console.error('[NewDepositContent] Transaction creation error:', error);
            
            // Обработка ошибки истекшей сессии
            if (error?.message === 'SESSION_EXPIRED' || error?.message?.includes('SESSION_EXPIRED')) {
                // Пытаемся обновить токен через authCheck
                try {
                    const result = await dispatch(checkAndRegisterUser());
                    // Если токен обновлен успешно, показываем информационное сообщение
                    if (checkAndRegisterUser.fulfilled.match(result)) {
                        showError(t('errors.sessionRefreshed', { defaultValue: 'Your session has been refreshed. Please try again.' }));
                    } else {
                        // Если не удалось обновить токен, перенаправляем на страницу входа
                        showError(t('errors.sessionExpired', { defaultValue: 'Your session has expired. Please log in again.' }));
                        setTimeout(() => {
                            window.location.href = '/login';
                        }, 2000);
                    }
                } catch (refreshError) {
                    // Если произошла ошибка при обновлении токена, перенаправляем на страницу входа
                    showError(t('errors.sessionExpired', { defaultValue: 'Your session has expired. Please log in again.' }));
                    setTimeout(() => {
                        window.location.href = '/login';
                    }, 2000);
                }
                return;
            }
            
            let errorMessage = t('errors.transactionCreationError', { defaultValue: 'Error creating transaction' });
            
            if (error?.message) {
                if (error.message.startsWith('HTTP_ERROR:')) {
                    try {
                        const errorMatch = error.message.match(/\{.*\}/);
                        if (errorMatch) {
                            const errorData = JSON.parse(errorMatch[0]);
                            const rawMessage = errorData.message || errorMessage;
                            
                            // Логируем детали ошибки
                            console.error('[NewDepositContent] Error details:', {
                                message: errorData.message,
                                errors: errorData.errors,
                                fullError: errorData
                            });
                            
                            // Переводим сообщения об ошибках
                            if (rawMessage.includes('временно недоступен') || rawMessage.includes('temporarily unavailable')) {
                                errorMessage = t('errors.paymentMethodUnavailable', { defaultValue: 'Payment method is temporarily unavailable. Please try again later or choose another payment method.' });
                            } else if (rawMessage.includes('нет свободных реквизитов') || rawMessage.includes('no free requisites')) {
                                errorMessage = t('errors.noFreeRequisites', { defaultValue: 'No free payment details available at the moment. Please try again later or choose another payment method.' });
                            } else if (rawMessage.includes('wallet') || rawMessage.includes('кошелька') || rawMessage.includes('телефона')) {
                                // Ошибка о wallet - переводим на язык пользователя
                                errorMessage = t('deposit.walletRequired', { defaultValue: 'Phone number or wallet is required for this payment method' });
                            } else if (rawMessage.includes('KYC') || rawMessage.includes('адрес') || rawMessage.includes('город') || rawMessage.includes('почтовый индекс') || rawMessage.includes('дата рождения')) {
                                // Это ошибка KYC - показываем модальное окно с предложением перейти в профиль
                                setErrorModal({ 
                                    open: true, 
                                    message: rawMessage,
                                    kycRequired: true
                                });
                                return;
                            } else if (rawMessage.includes('Платежный шлюз') || rawMessage.includes('payment gateway') || rawMessage.includes('gateway')) {
                                errorMessage = t('errors.paymentGatewayUnavailable', { defaultValue: 'Payment gateway is temporarily unavailable. Please try again later or choose another payment method.' });
                            } else {
                                // Используем оригинальное сообщение, если нет специального перевода
                                // Но переводим его, если оно на русском, а язык пользователя другой
                                errorMessage = rawMessage;
                            }
                        }
                    } catch {
                        errorMessage = error.message.replace('HTTP_ERROR:', '').trim();
                    }
                } else {
                    errorMessage = error.message;
                }
            }
            
            showError(errorMessage);
        }
    };

    // Предопределенные суммы для карточек депозита
    const predefinedAmounts = [
        { amount: 10, bonus: '', status: 'STANDARD', promocode: '' },
        { amount: 50, bonus: '+50%', status: 'SHLAK', promocode: 'FROM50' },
        { amount: 150, bonus: '+100%', status: 'VOVAPIDUR LOX', promocode: 'FROM150' },
        { amount: 500, bonus: '+125%', status: 'GOLD', promocode: 'FROM500' }
    ];

    // Мемоизируем вычисления для карточек сумм, чтобы избежать избыточных вызовов convertFromUSDSync
    // ВАЖНО: Этот хук должен быть на верхнем уровне, до всех условных возвратов
    const amountCardsData = useMemo(() => {
        const ratesAvailable = hasRealExchangeRates() || selectedCurrency === 'USD';
        const depositAmountInUSD = selectedCurrency === 'USD' 
            ? depositAmount 
            : (depositAmount !== null ? convertToUSDSync(depositAmount, selectedCurrency) : null);

        return predefinedAmounts.map((item) => {
            const amountInSelectedCurrency = selectedCurrency === 'USD' 
                ? item.amount 
                : convertFromUSDSync(item.amount, selectedCurrency);
            
            const isDisabled = selectedCurrency !== 'USD' && (!ratesAvailable || amountInSelectedCurrency === null);
            
            let isActive = false;
            if (!isDisabled && depositAmount !== null && depositAmount > 0 && depositAmountInUSD !== null) {
                if (item.promocode === 'FROM500') {
                    isActive = depositAmountInUSD >= 500 && depositAmountInUSD < 20000;
                } else if (item.promocode === 'FROM150') {
                    isActive = depositAmountInUSD >= 150 && depositAmountInUSD < 500;
                } else if (item.promocode === 'FROM50') {
                    isActive = depositAmountInUSD >= 50 && depositAmountInUSD < 150;
                } else {
                    if (amountInSelectedCurrency !== null) {
                        isActive = Math.abs(depositAmount - amountInSelectedCurrency) < 0.01;
                    }
                }
            }
            
            return {
                ...item,
                amountInSelectedCurrency,
                isDisabled,
                isActive
            };
        });
    }, [selectedCurrency, depositAmount, ratesRefreshKey]);

    if (loading || loadingPaymentMethods) {
        return (
            <div className="new-deposit-content">
                <div className="new-deposit-loading">
                    <div className="loading-spinner"></div>
                    <p>{t('deposit.loading', { defaultValue: 'Loading...' })}</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="new-deposit-content">
                <div className="new-deposit-error">
                    <p>⚠️ {error}</p>
                </div>
            </div>
        );
    }

    // Если нужно показать страницу с деталями платежа - показываем её вместо всего остального
    if (paymentDetailsPage.show && paymentDetailsPage.paymentData) {
        return (
            <div className="new-deposit-content new-deposit-content--payment-details">
                <div className="payment-details-page">
                    <div className="payment-details-page__header">
                        <button 
                            className="payment-details-page__back-button"
                            onClick={() => {
                                setPaymentDetailsPage({ show: false, transaction: null, paymentData: null });
                                setShowDepositForm(false);
                                setSelectedMethod(null);
                                setSelectedMethodData(null);
                                setUploadedImages([]);
                            }}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            {t('common.back', { defaultValue: 'Back' })}
                        </button>
                        <h1 className="payment-details-page__title">
                            {t('deposit.paymentDetails', { defaultValue: 'Payment details' })}
                        </h1>
                    </div>

                    <div className="payment-details-page__body">
                        <div className="payment-details-info">
                            {paymentDetailsPage.transaction && (
                            <div className="payment-details-info__section">
                                <h4 className="payment-details-info__section-title">
                                    {t('deposit.transactionInfo', { defaultValue: 'Transaction information' })}
                                </h4>
                                <div className="payment-details-info__row">
                                    <span className="payment-details-info__label">
                                        {t('deposit.amount', { defaultValue: 'Amount' })}:
                                    </span>
                                    <span className="payment-details-info__value">
                                        {paymentDetailsPage.transaction.amount_to_pay || paymentDetailsPage.transaction.amount} {paymentDetailsPage.transaction.currency}
                                    </span>
                                </div>
                                {paymentDetailsPage.transaction.commission && (
                                    <div className="payment-details-info__row">
                                        <span className="payment-details-info__label">
                                            {t('deposit.commission', { defaultValue: 'Commission' })}:
                                        </span>
                                        <span className="payment-details-info__value">
                                            {paymentDetailsPage.transaction.commission} {paymentDetailsPage.transaction.currency}
                                        </span>
                                    </div>
                                )}
                                {paymentDetailsPage.transaction.amount_after_commission && (
                                    <div className="payment-details-info__row">
                                        <span className="payment-details-info__label">
                                            {t('deposit.amountAfterCommission', { defaultValue: 'Amount after commission' })}:
                                        </span>
                                        <span className="payment-details-info__value">
                                            {paymentDetailsPage.transaction.amount_after_commission} {paymentDetailsPage.transaction.currency}
                                        </span>
                                    </div>
                                )}
                                <div className="payment-details-info__row">
                                    <span className="payment-details-info__label">
                                        {t('deposit.status', { defaultValue: 'Status' })}:
                                    </span>
                                    <span className="payment-details-info__value payment-details-info__value--status">
                                        {paymentDetailsPage.transaction.status}
                                    </span>
                                </div>
                            </div>
                            )}

                            <div className="payment-details-info__section">
                                <h4 className="payment-details-info__section-title">
                                    {t('deposit.paymentRequisites', { defaultValue: 'Payment requisites' })}
                                </h4>
                                
                                {/* QR код */}
                                {paymentDetailsPage.paymentData.qr_code_base64 && (
                                    <div className="payment-details-info__row payment-details-info__row--qr">
                                        <span className="payment-details-info__label">
                                            {t('deposit.qrCode', { defaultValue: 'QR Code' })}:
                                        </span>
                                        <div className="payment-details-info__qr-container">
                                            <img 
                                                src={paymentDetailsPage.paymentData.qr_code_base64} 
                                                alt="QR Code" 
                                                className="payment-details-info__qr-image"
                                            />
                                            <button
                                                className="payment-details-info__qr-download"
                                                onClick={() => {
                                                    const link = document.createElement('a');
                                                    link.href = paymentDetailsPage.paymentData.qr_code_base64;
                                                    link.download = `qr-code-${paymentDetailsPage.transaction?.id || 'qr'}.png`;
                                                    link.click();
                                                }}
                                            >
                                                {t('deposit.downloadQr', { defaultValue: 'Download QR Code' })}
                                            </button>
                                        </div>
                                    </div>
                                )}
                                
                                {/* VA Code */}
                                {paymentDetailsPage.paymentData.va_code && (
                                    <div className="payment-details-info__row payment-details-info__row--highlight">
                                        <span className="payment-details-info__label">
                                            {t('deposit.vaCode', { defaultValue: 'VA Code' })}:
                                        </span>
                                        <span className="payment-details-info__value payment-details-info__value--copyable" 
                                              onClick={() => {
                                                  navigator.clipboard.writeText(String(paymentDetailsPage.paymentData.va_code));
                                                  alert(t('deposit.copied', { defaultValue: 'Copied to clipboard' }));
                                              }}>
                                            {String(paymentDetailsPage.paymentData.va_code)}
                                        </span>
                                    </div>
                                )}
                                
                                {/* Match Code */}
                                {paymentDetailsPage.paymentData.match_code && (
                                    <div className="payment-details-info__row">
                                        <span className="payment-details-info__label">
                                            {t('deposit.matchCode', { defaultValue: 'Match Code' })}:
                                        </span>
                                        <span className="payment-details-info__value payment-details-info__value--copyable"
                                              onClick={() => {
                                                  navigator.clipboard.writeText(String(paymentDetailsPage.paymentData.match_code));
                                                  alert(t('deposit.copied', { defaultValue: 'Copied to clipboard' }));
                                              }}>
                                            {String(paymentDetailsPage.paymentData.match_code)}
                                        </span>
                                    </div>
                                )}
                                
                                {/* Bank Name */}
                                {paymentDetailsPage.paymentData.bank_name && (
                                    <div className="payment-details-info__row">
                                        <span className="payment-details-info__label">
                                            {t('deposit.bankName', { defaultValue: 'Bank Name' })}:
                                        </span>
                                        <span className="payment-details-info__value">
                                            {paymentDetailsPage.paymentData.bank_name}
                                        </span>
                                    </div>
                                )}
                                
                                {/* Recipient */}
                                {paymentDetailsPage.paymentData.recipient && (
                                    <div className="payment-details-info__row">
                                        <span className="payment-details-info__label">
                                            {t('deposit.recipient', { defaultValue: 'Recipient' })}:
                                        </span>
                                        <span className="payment-details-info__value payment-details-info__value--copyable"
                                              onClick={() => {
                                                  navigator.clipboard.writeText(paymentDetailsPage.paymentData.recipient);
                                                  alert(t('deposit.copied', { defaultValue: 'Copied to clipboard' }));
                                              }}>
                                            {paymentDetailsPage.paymentData.recipient}
                                        </span>
                                    </div>
                                )}
                                
                                {/* Payment Requisite (Card Number) */}
                                {paymentDetailsPage.paymentData.payment_requisite && (
                                    <div className="payment-details-info__row payment-details-info__row--highlight">
                                        <span className="payment-details-info__label">
                                            {t('deposit.cardNumber', { defaultValue: 'Card number' })}:
                                        </span>
                                        <span className="payment-details-info__value payment-details-info__value--copyable" 
                                              onClick={() => {
                                                  navigator.clipboard.writeText(String(paymentDetailsPage.paymentData.payment_requisite));
                                                  alert(t('deposit.copied', { defaultValue: 'Copied to clipboard' }));
                                              }}>
                                            {String(paymentDetailsPage.paymentData.payment_requisite)}
                                        </span>
                                    </div>
                                )}
                                
                                {/* Payment Holder */}
                                {paymentDetailsPage.paymentData.payment_holder && (
                                    <div className="payment-details-info__row">
                                        <span className="payment-details-info__label">
                                            {t('deposit.cardHolder', { defaultValue: 'Card holder' })}:
                                        </span>
                                        <span className="payment-details-info__value payment-details-info__value--copyable"
                                              onClick={() => {
                                                  navigator.clipboard.writeText(paymentDetailsPage.paymentData.payment_holder);
                                                  alert(t('deposit.copied', { defaultValue: 'Copied to clipboard' }));
                                              }}>
                                            {paymentDetailsPage.paymentData.payment_holder}
                                        </span>
                                    </div>
                                )}
                                
                                {/* Payment System */}
                                {paymentDetailsPage.paymentData.payment_system && (
                                    <div className="payment-details-info__row">
                                        <span className="payment-details-info__label">
                                            {t('deposit.paymentSystem', { defaultValue: 'Payment system' })}:
                                        </span>
                                        <span className="payment-details-info__value">
                                            {paymentDetailsPage.paymentData.payment_system}
                                        </span>
                                    </div>
                                )}
                                
                                {/* Payment Expires At */}
                                {paymentDetailsPage.paymentData.payment_expires_at && (
                                    <div className="payment-details-info__row payment-details-info__row--warning">
                                        <span className="payment-details-info__label">
                                            {t('deposit.paymentExpiresAt', { defaultValue: 'Payment expires at' })}:
                                        </span>
                                        <span className="payment-details-info__value">
                                            {new Date(paymentDetailsPage.paymentData.payment_expires_at).toLocaleString()}
                                        </span>
                                    </div>
                                )}
                            </div>

                             <div className="payment-details-info__instructions">
                                 <p className="payment-details-info__instructions-text">
                                     {paymentDetailsPage.paymentData.qr_code_base64 
                                         ? t('deposit.qrPaymentInstructions', { 
                                             defaultValue: 'Please use the provided QR code with your bank application to complete the payment. Scan the QR code or use the VA Code to make a transfer. The transaction will be processed automatically after the payment is received.' 
                                         })
                                         : t('deposit.paymentInstructions', { 
                                             defaultValue: 'Please transfer the specified amount to the provided card number using your bank application. The transaction will be processed automatically after the payment is received.' 
                                         })
                                     }
                                 </p>
                             </div>

                            {/* Секция загрузки изображений */}
                            <div className="payment-details-info__section payment-details-info__section--images">
                                <h4 className="payment-details-info__section-title">
                                    {t('deposit.uploadImages', { defaultValue: 'Upload images' })}
                                </h4>
                                <p className="payment-details-info__section-description">
                                    {t('deposit.uploadImagesDescription', { defaultValue: 'Upload up to 4 images to confirm payment (screenshot of transfer, receipt, etc.)' })}
                                </p>
                                
                                <div className="payment-details-images">
                                    <div className="payment-details-images__grid">
                                        {uploadedImages.map((image, index) => (
                                            <div key={image.id} className="payment-details-images__item">
                                                <img src={image.preview} alt={`Upload ${index + 1}`} className="payment-details-images__preview" />
                                                <button
                                                    type="button"
                                                    className="payment-details-images__remove"
                                                    onClick={() => {
                                                        setUploadedImages(prev => prev.filter(img => img.id !== image.id));
                                                    }}
                                                    aria-label={t('deposit.removeImage', { defaultValue: 'Remove' })}
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        ))}
                                        
                                        {uploadedImages.length < 4 && (
                                            <label className="payment-details-images__upload">
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    multiple={false}
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) {
                                                            if (file.size > 10 * 1024 * 1024) {
                                                                alert(t('deposit.uploadError', { defaultValue: 'Error uploading image' }) + ': ' + t('deposit.imageTooLarge', { defaultValue: 'Image size should not exceed 10MB' }));
                                                                return;
                                                            }
                                                            const reader = new FileReader();
                                                            reader.onload = (event) => {
                                                                const preview = event.target?.result as string;
                                                                setUploadedImages(prev => [...prev, {
                                                                    file,
                                                                    preview,
                                                                    id: Date.now().toString() + Math.random().toString()
                                                                }]);
                                                            };
                                                            reader.readAsDataURL(file);
                                                        }
                                                        e.target.value = '';
                                                    }}
                                                    style={{ display: 'none' }}
                                                />
                                                <div className="payment-details-images__upload-icon">+</div>
                                                <div className="payment-details-images__upload-text">
                                                    {t('deposit.uploadImage', { defaultValue: 'Upload image' })}
                                                </div>
                                            </label>
                                        )}
                                    </div>
                                    {uploadedImages.length > 0 && (
                                        <div className="payment-details-images__info">
                                            {t('deposit.maxImages', { defaultValue: 'Maximum 4 images' })} ({uploadedImages.length}/4)
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="payment-details-page__footer">
                        <button 
                            className="payment-details-page__button payment-details-page__button--secondary"
                            onClick={() => {
                                setPaymentDetailsPage({ show: false, transaction: null, paymentData: null });
                                setShowDepositForm(false);
                                setSelectedMethod(null);
                                setSelectedMethodData(null);
                                setUploadedImages([]);
                            }}
                        >
                            {t('common.close', { defaultValue: 'Close' })}
                        </button>
                        {uploadedImages.length > 0 && paymentDetailsPage.transaction?.id && (
                            <button 
                                className="payment-details-page__button payment-details-page__button--primary" 
                                onClick={async () => {
                                    if (!paymentDetailsPage.transaction?.id) {
                                        alert(t('deposit.uploadError', { defaultValue: 'Error uploading image' }));
                                        return;
                                    }
                                    try {
                                        setUploadingImages(true);
                                        const imageFiles = uploadedImages.map(img => img.file);
                                        await ampayApi.uploadPaymentProof(paymentDetailsPage.transaction.id, imageFiles);
                                        alert(t('deposit.imageUploaded', { defaultValue: 'Image uploaded' }));
                                        setUploadedImages([]);
                                    } catch (error: any) {
                                        const errorMessage = error?.message || t('deposit.uploadError', { defaultValue: 'Error uploading image' });
                                        alert(errorMessage);
                                    } finally {
                                        setUploadingImages(false);
                                    }
                                }}
                                disabled={uploadingImages}
                            >
                                {uploadingImages ? t('deposit.uploading', { defaultValue: 'Uploading...' }) : t('deposit.uploadImages', { defaultValue: 'Upload images' })}
                            </button>
                        )}
                        <button 
                            className="payment-details-page__button payment-details-page__button--primary" 
                            onClick={() => {
                                window.location.href = '/profile?tab=transactions';
                            }}
                        >
                            {t('deposit.viewTransactions', { defaultValue: 'View transactions' })}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Если выбрана форма депозита, показываем её
    if (showDepositForm && selectedMethodData) {

        return (
            <div className="new-deposit-content new-deposit-content--form">
                <Container>
                    <div className="deposit-form-header">
                        <button 
                            className="deposit-form-back-button"
                            onClick={handleBackToMethodSelection}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </button>

                        <h1 className="new-deposit-title">
                            {t('deposit.chooseAmount', { defaultValue: 'Choose amount' })}
                        </h1>
                    </div>

                    <Row>
                        <Col md={8} lg={8}>
                        {/* Предустановленные суммы */}
                        <div className="deposit-amounts-grid">
                            {amountCardsData.map((cardData, index) => (
                                <button
                                    key={index}
                                    className={`deposit-amount-card ${cardData.isActive ? 'is-active' : ''} ${cardData.isDisabled ? 'is-disabled' : ''}`}
                                    onClick={() => {
                                        if (!cardData.isDisabled && cardData.amountInSelectedCurrency !== null) {
                                            handleAmountSelect(cardData.amountInSelectedCurrency, cardData.promocode);
                                        }
                                    }}
                                    disabled={cardData.isDisabled}
                                >
                                    <div className="deposit-amount-card__amount">
                                        {cardData.isDisabled 
                                            ? t('deposit.ratesUnavailable', { defaultValue: 'Rates unavailable' })
                                            : cardData.amountInSelectedCurrency !== null 
                                                ? formatCurrency(cardData.amountInSelectedCurrency, selectedCurrency, { decimals: 0, convertFromUSD: false })
                                                : '...'
                                        }
                                    </div>
                                    {cardData.bonus && !cardData.isDisabled && (
                                        <div className="deposit-amount-card__bonus">{cardData.bonus}</div>
                                    )}
                                    <div className="deposit-amount-card__status">{cardData.status}</div>
                                </button>
                            ))}
                        </div>

                        {/* Произвольная сумма */}
                        <div className="deposit-custom-amount">
                            <div className="deposit-custom-amount__label">
                                {t('deposit.enterAmount', { defaultValue: 'Enter amount' })}
                            </div>
                            <div className={`deposit-custom-amount__input-wrapper ${amountValidationError ? 'deposit-custom-amount__input-wrapper--error' : ''}`}>
                                <span className="deposit-custom-amount__currency">{getCurrencySymbol(selectedCurrency)}</span>
                                    <input
                                        type="number"
                                        className={`deposit-custom-amount__input ${amountValidationError ? 'deposit-custom-amount__input--error' : ''}`}
                                        value={depositAmount === null || depositAmount === 0 ? '' : depositAmount}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            if (value === '' || value === null || value === undefined) {
                                                setDepositAmount(null);
                                                checkAndApplyPromocodeForAmount(0);
                                            } else {
                                                const newAmount = Number(value);
                                                if (!isNaN(newAmount) && newAmount >= 0) {
                                                    setDepositAmount(newAmount);
                                                    // Проверяем и применяем промокод при изменении суммы
                                                    checkAndApplyPromocodeForAmount(newAmount);
                                                }
                                            }
                                        }}
                                        onBlur={() => {
                                            // Mark field as touched when user leaves the input
                                            setAmountInputTouched(true);
                                        }}
                                        min="0"
                                        step="0.01"
                                    />
                            </div>
                            {/* Always show minimum amount info if method is selected */}
                            {selectedMethodData && methodMinAmountInSelectedCurrency && !amountValidationError && (
                                <div className="deposit-custom-amount__note">
                                    {t('deposit.minimumAmountIs', {
                                        defaultValue: 'Minimum amount is: {{amount}}',
                                        amount: formatCurrency(methodMinAmountInSelectedCurrency, selectedCurrency, { decimals: 0, convertFromUSD: false })
                                    })}
                                </div>
                            )}
                            {/* Show error message if validation failed (replaces note) */}
                            {amountValidationError && (
                                <div className="deposit-custom-amount__error">
                                    {t('deposit.minimumAmountIs', {
                                        defaultValue: 'Minimum amount is: {{amount}}',
                                        amount: formatCurrency(amountValidationError.minAmount, selectedCurrency, { decimals: 0, convertFromUSD: false })
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Промокод */}
                        <div className="deposit-bonuses">
                            <div className="deposit-bonuses__header">
                                <span>{t('deposit.promoCode', { defaultValue: 'Promo code' })}</span>
                            </div>
                            <div className="deposit-bonuses__options">
                                <label className="deposit-bonus-option deposit-bonus-option--checkbox">
                                    <input
                                        type="checkbox"
                                        checked={withoutPromo && !promoCode.trim()}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setWithoutPromo(true);
                                                setPromoCode('');
                                            }
                                        }}
                                    />
                                    <span className="deposit-checkbox-custom"></span>
                                    <span>{t('deposit.withoutPromo', { defaultValue: 'Without promo' })}</span>
                                    <span className="deposit-bonus-option__amount">$0.00</span>
                                </label>
                            </div>
                            <div className="deposit-promocode-field">
                                <div className="deposit-promocode-input-wrapper">
                                    <input
                                        type="text"
                                        className="deposit-promocode-input"
                                        placeholder={t('deposit.enterPromoCode', { defaultValue: 'Enter promo code' })}
                                        value={promoCode}
                                        onChange={(e) => {
                                            const value = e.target.value.toUpperCase();
                                            setPromoCode(value);
                                            if (value.trim()) {
                                                setWithoutPromo(false);
                                            } else {
                                                setWithoutPromo(true);
                                            }
                                        }}
                                    />
                                    {savedPromocodes.length > 0 && (
                                        <button
                                            type="button"
                                            className="deposit-promocode-select-btn"
                                            onClick={() => setShowPromocodeDropdown(!showPromocodeDropdown)}
                                            title={t('deposit.selectFromSaved', { defaultValue: 'Select from saved promocodes' })}
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M6 9l6 6 6-6"/>
                                            </svg>
                                        </button>
                                    )}
                                </div>
                                {showPromocodeDropdown && savedPromocodes.length > 0 && (
                                    <div className="deposit-promocode-dropdown">
                                        <div className="deposit-promocode-dropdown-header">
                                            <span>{t('deposit.savedPromocodes', { defaultValue: 'Saved promocodes' })}</span>
                                            <button
                                                type="button"
                                                className="deposit-promocode-dropdown-close"
                                                onClick={() => setShowPromocodeDropdown(false)}
                                            >
                                                ×
                                            </button>
                                        </div>
                                        <div className="deposit-promocode-dropdown-list">
                                            {savedPromocodes.map((savedPromo) => (
                                                <button
                                                    key={savedPromo.code}
                                                    type="button"
                                                    className={`deposit-promocode-dropdown-item ${promoCode === savedPromo.code ? 'active' : ''}`}
                                                    onClick={() => handleSelectPromocode(savedPromo)}
                                                >
                                                    <div className="deposit-promocode-dropdown-item-code">{savedPromo.code}</div>
                                                    {savedPromo.isValid && (
                                                        <div className="deposit-promocode-dropdown-item-status valid">
                                                            {t('promocodes.statusValid', { defaultValue: 'Valid' })}
                                                        </div>
                                                    )}
                                                    {savedPromo.discountValue !== undefined && (
                                                        <div className="deposit-promocode-dropdown-item-discount">
                                                            {savedPromo.discountType === 'percentage' 
                                                                ? `${savedPromo.discountValue}%`
                                                                : `$${savedPromo.discountValue.toFixed(2)}`}
                                                        </div>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {validatingPromocode && (
                                    <div className="deposit-promocode-validating">
                                        {t('deposit.validating', { defaultValue: 'Validating...' })}
                                    </div>
                                )}
                                {promocodeValidation && !validatingPromocode && (
                                    <div className={`deposit-promocode-status ${promocodeValidation.valid ? 'valid' : 'invalid'}`}>
                                        {promocodeValidation.valid ? (
                                            <span>✓ {t('deposit.promoCodeValid', { defaultValue: 'Promo code is valid' })}</span>
                                        ) : (
                                            <span>✗ {promocodeValidation.error || t('deposit.promoCodeInvalid', { defaultValue: 'Invalid promo code' })}</span>
                                        )}
                                    </div>
                                )}
                            </div>
                            {/* Аккордеон с информацией о промокоде */}
                            <div className="deposit-promocode-info">
                                <button
                                    type="button"
                                    className="deposit-promocode-info__header"
                                    onClick={() => setPromoCodeInfoOpen(!promoCodeInfoOpen)}
                                >
                                    <span>{t('deposit.promoCodeInfo', { defaultValue: 'Promo code details' })}</span>
                                    <svg 
                                        className={`deposit-promocode-info__arrow ${promoCodeInfoOpen ? 'open' : ''}`}
                                        width="16" 
                                        height="16" 
                                        viewBox="0 0 24 24" 
                                        fill="none"
                                    >
                                        <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                </button>
                                {promoCodeInfoOpen && (
                                    <div className="deposit-promocode-info__content">
                                        <p>{t('deposit.promoCodeDescription', { 
                                            defaultValue: 'Enter a promo code to get a bonus on your deposit. Promo codes provide bonuses to your deposit amount.' 
                                        })}</p>
                                        {referralPromocode && (
                                            <div className="deposit-promocode-info__referral">
                                                <strong>{t('deposit.referralPromoCode', { defaultValue: 'Referral promo code:' })}</strong>
                                                <span>{referralPromocode.code}</span>
                                                {referralPromocode.name && (
                                                    <div className="deposit-promocode-info__referral-name">{referralPromocode.name}</div>
                                                )}
                                                {referralPromocode.discountType && referralPromocode.discountValue && (
                                                    <div className="deposit-promocode-info__referral-discount">
                                                        {referralPromocode.discountType === 'percentage' 
                                                            ? `${referralPromocode.discountValue}%`
                                                            : `$${referralPromocode.discountValue}`
                                                        }
                                                    </div>
                                                )}
                                                {referralPromocode.description && (
                                                    <div className="deposit-promocode-info__referral-description">
                                                        {referralPromocode.description}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                            
                            <div className="deposit-total">
                                <div className="deposit-total__left">
                                    <span>{t('deposit.willBeCredited', { defaultValue: 'Will be credited' })}</span>
                                    {promocodeValidation?.valid && depositAmount !== null && totalAmount > depositAmount && (
                                        <div className="deposit-total__bonus">
                                            {t('deposit.bonusApplied', { defaultValue: 'Bonus applied' })}: +{formatCurrency(discountInSelectedCurrency, selectedCurrency, { convertFromUSD: false })}
                                        </div>
                                    )}
                                </div>
                                <span className="deposit-total__amount">{formatCurrency(totalAmount, selectedCurrency, { convertFromUSD: false })}</span>
                            </div>
                        </Col>
                        
                        <Col md={4} lg={4}>
                            <div className="deposit-details">
                                <h3 className="deposit-details__title">
                                {t('deposit.yourDepositDetails', { defaultValue: 'Your deposit details' })}
                            </h3>
                            {/* Поля Имя и Фамилия - только для не криптовалютных методов */}
                            {!isCryptoMethod && (
                                <>
                                    <div className="deposit-details__field">
                                        <label>{t('deposit.firstName', { defaultValue: 'First name' })}</label>
                                        <input
                                            type="text"
                                            value={firstName}
                                            onChange={(e) => setFirstName(e.target.value)}
                                        />
                                    </div>
                                    <div className="deposit-details__field">
                                        <label>{t('deposit.lastName', { defaultValue: 'Last name' })}</label>
                                        <input
                                            type="text"
                                            value={lastName}
                                            onChange={(e) => setLastName(e.target.value)}
                                        />
                                    </div>
                                </>
                            )}
                            
                            {/* Поле для wallet (только для H2H_DEPOSIT методов) */}
                            {selectedMethodData.method === 'H2H_DEPOSIT' && (
                                <div className="deposit-details__field">
                                    <label>
                                        {t('deposit.phoneOrWallet', { defaultValue: 'Phone number or wallet' })}
                                        <span className="required">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={wallet}
                                        onChange={(e) => {
                                            if (!walletFromProfile) {
                                                setWallet(e.target.value);
                                            }
                                        }}
                                        disabled={walletFromProfile}
                                        placeholder={t('deposit.phoneOrWalletPlaceholder', { defaultValue: 'Enter phone number or wallet' })}
                                        required
                                        className={walletFromProfile ? 'deposit-details__field--from-profile' : ''}
                                    />
                                    {walletFromProfile && (
                                        <span className="deposit-details__field-hint">
                                            {t('deposit.dataFromProfile', { defaultValue: 'Data from your profile' })}
                                        </span>
                                    )}
                                </div>
                            )}
                            
                            {/* Поля для карты (только для CARD методов) */}
                            {selectedMethodData.method === 'CARD' && (
                                <>
                                    <div className="deposit-details__field">
                                        <label>{t('deposit.cardNumber', { defaultValue: 'Card number' })}</label>
                                        <input
                                            type="text"
                                            value={cardNumber}
                                            onChange={(e) => {
                                                // Убираем все нецифровые символы и форматируем
                                                const value = e.target.value.replace(/\D/g, '');
                                                // Форматируем как XXXX XXXX XXXX XXXX
                                                const formatted = value.match(/.{1,4}/g)?.join(' ') || value;
                                                setCardNumber(formatted.substring(0, 19)); // Максимум 16 цифр + 3 пробела
                                            }}
                                            placeholder="1234 5678 9012 3456"
                                            maxLength={19}
                                        />
                                    </div>
                                    <div className="deposit-details__field-row">
                                        <div className="deposit-details__field">
                                            <label>{t('deposit.cardExpire', { defaultValue: 'Expiry date' })}</label>
                                            <input
                                                type="text"
                                                value={cardExpire}
                                                onChange={(e) => {
                                                    // Форматируем как MM/YY
                                                    let value = e.target.value.replace(/\D/g, '');
                                                    if (value.length >= 2) {
                                                        value = value.substring(0, 2) + '/' + value.substring(2, 4);
                                                    }
                                                    setCardExpire(value.substring(0, 5));
                                                }}
                                                placeholder="MM/YY"
                                                maxLength={5}
                                            />
                                        </div>
                                        <div className="deposit-details__field">
                                            <label>{t('deposit.cardCvc', { defaultValue: 'CVC' })}</label>
                                            <input
                                                type="text"
                                                value={cardCvc}
                                                onChange={(e) => {
                                                    // Только цифры, максимум 3
                                                    const value = e.target.value.replace(/\D/g, '').substring(0, 3);
                                                    setCardCvc(value);
                                                }}
                                                placeholder="123"
                                                maxLength={3}
                                            />
                                        </div>
                                    </div>
                                </>
                            )}
                            
                            <div className="deposit-details__payment-method">
                                <label>{t('deposit.paymentMethod', { defaultValue: 'Payment method' })}</label>
                                <div className="deposit-details__payment-method-value">
                                    {selectedMethodData.name || 'Visa / Mastercard'}
                                    {/* Development: Show method and sub_method for debugging */}
                                    {(import.meta.env.DEV || import.meta.env.MODE === 'development') && (
                                        <div style={{ 
                                            fontSize: '11px', 
                                            color: '#999', 
                                            marginTop: '4px',
                                            fontWeight: 'normal',
                                            fontFamily: 'monospace'
                                        }}>
                                            {selectedMethodData.method && (
                                                <div>Method: {selectedMethodData.method}</div>
                                            )}
                                            {selectedMethodData.sub_method && (
                                                <div>Sub-method: {selectedMethodData.sub_method}</div>
                                            )}
                                            {selectedMethodData.currency && (
                                                <div>Currency: {selectedMethodData.currency}</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Currency conversion display */}
                            {needsCurrencyConversion && depositAmountInMethodCurrency !== null && depositAmount && (
                                <div className="deposit-details__currency-conversion">
                                    <label>{t('deposit.paymentAmount', { defaultValue: 'Payment amount' })}</label>
                                    <div className="deposit-details__currency-conversion-value">
                                        <span className="currency-conversion__from">
                                            {formatCurrency(depositAmount, selectedCurrency, { convertFromUSD: false })}
                                        </span>
                                        <span className="currency-conversion__arrow">→</span>
                                        <span className="currency-conversion__to">
                                            {formatCurrency(depositAmountInMethodCurrency, methodCurrency as SupportedCurrency, { convertFromUSD: false })}
                                        </span>
                                    </div>
                                    <div className="deposit-details__currency-conversion-hint">
                                        {t('deposit.currencyConversionHint', { 
                                            defaultValue: 'Amount will be converted to {{currency}} for payment',
                                            currency: methodCurrency
                                        })}
                                    </div>
                                </div>
                            )}
                            
                            {/* Для криптовалютных методов показываем кнопку генерации или QR/кошелек */}
                            {isCryptoMethod ? (
                                !cryptoTransactionGenerated ? (
                                    <button
                                        className="deposit-button"
                                        onClick={handleGenerateCryptoLink}
                                    >
                                        {t('deposit.generateLink', { defaultValue: 'Generate link' })}
                                    </button>
                                ) : (
                                    <div className="crypto-payment-info">
                                        {/* QR код */}
                                        {selectedMethodData.qr_code_image && (
                                            <div className="crypto-payment-info__qr">
                                                <label>{t('deposit.qrCode', { defaultValue: 'QR Code' })}</label>
                                                <div className="crypto-payment-info__qr-container">
                                                    <img 
                                                        src={selectedMethodData.qr_code_image} 
                                                        alt="QR Code" 
                                                        className="crypto-payment-info__qr-image"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                        
                                        {/* Кошелек для копирования */}
                                        {selectedMethodData.wallet && (
                                            <div className="crypto-payment-info__wallet">
                                                <label>{t('deposit.walletAddress', { defaultValue: 'Wallet address' })}</label>
                                                <div 
                                                    className="crypto-payment-info__wallet-address"
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(selectedMethodData.wallet);
                                                        alert(t('deposit.copied', { defaultValue: 'Copied to clipboard' }));
                                                    }}
                                                >
                                                    {selectedMethodData.wallet}
                                                    <span className="crypto-payment-info__copy-icon">📋</span>
                                                </div>
                                            </div>
                                        )}
                                        
                                        {/* Таймер */}
                                        {timerSeconds > 0 && (
                                            <div className="crypto-payment-info__timer">
                                                <label>{t('deposit.timeRemaining', { defaultValue: 'Time remaining' })}</label>
                                                <div className="crypto-payment-info__timer-value">
                                                    {Math.floor(timerSeconds / 60)}:{(timerSeconds % 60).toString().padStart(2, '0')}
                                                </div>
                                            </div>
                                        )}
                                        
                                        {/* Две загрузки с проверками */}
                                        <div className="crypto-payment-info__checks">
                                            <div className="crypto-payment-info__check">
                                                <label>
                                                    {t('deposit.check1', { defaultValue: 'Verification 1' })}
                                                    {checkStatus1 === 'completed' && ' ✓'}
                                                </label>
                                                <div className="crypto-payment-info__progress">
                                                    <div 
                                                        className="crypto-payment-info__progress-bar"
                                                        style={{ width: `${checkProgress1}%` }}
                                                    />
                                                </div>
                                            </div>
                                            <div className="crypto-payment-info__check">
                                                <label>
                                                    {t('deposit.check2', { defaultValue: 'Verification 2' })}
                                                    {checkStatus2 === 'completed' && ' ✓'}
                                                </label>
                                                <div className="crypto-payment-info__progress">
                                                    <div 
                                                        className="crypto-payment-info__progress-bar"
                                                        style={{ width: `${checkProgress2}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            ) : (
                                <>
                                    {/* Warning if phone is missing for methods that require it */}
                                    {isPhoneMissing && (
                                        <div className="deposit-details__phone-warning">
                                            {t('deposit.phoneRequiredMessage', { 
                                                defaultValue: 'Phone number is required for this payment method. Please fill in your phone number in your' 
                                            })}
                                            {' '}
                                            <button
                                                className="deposit-details__phone-warning-link"
                                                onClick={() => {
                                                    window.location.href = '/profile?tab=personal';
                                                }}
                                            >
                                                {t('deposit.profile', { defaultValue: 'profile' })}
                                            </button>
                                            .
                                        </div>
                                    )}
                                    <button
                                        className={`deposit-button ${isPhoneMissing ? 'deposit-button--disabled' : ''}`}
                                        onClick={handleDeposit}
                                        disabled={loading || !selectedMethodData || depositAmount === null || depositAmount <= 0 || !!amountValidationError || isPhoneMissing}
                                    >
                                        {needsCurrencyConversion && depositAmountInMethodCurrency !== null ? (
                                            <>
                                                {t('deposit.depositButton', { defaultValue: 'Deposit' })} {formatCurrency(depositAmountInMethodCurrency, methodCurrency as SupportedCurrency, { convertFromUSD: false })}
                                            </>
                                        ) : (
                                            <>
                                                {t('deposit.depositButton', { defaultValue: 'Deposit' })} {formatCurrency(totalAmount, selectedCurrency, { convertFromUSD: false })}
                                            </>
                                        )}
                                    </button>
                                </>
                            )}
                            </div>
                            
                            {/* Информация о безопасности */}
                            <div className="security-info">
                                    <div className="security-info__item">
                                    <div className="security-info__icon">3D</div>
                                    <div className="security-info__text">
                                        <strong>3D SECURE</strong>
                                        <span>{t('deposit.security3d', { defaultValue: 'Additional level of security for payments' })}</span>
                                    </div>
                                </div>
                                <div className="security-info__item">
                                    <div className="security-info__icon">$</div>
                                    <div className="security-info__text">
                                        <strong>{t('deposit.europeanBanks', { defaultValue: 'European banks' })}</strong>
                                        <span>{t('deposit.securityBanks', { defaultValue: 'The security of your funds is provided by European banks' })}</span>
                                    </div>
                                </div>
                                <div className="security-info__item">
                                    <div className="security-info__icon">🔒</div>
                                    <div className="security-info__text">
                                        <strong>SSL</strong>
                                        <span>{t('deposit.sslProtection', { defaultValue: '2048 bit robust SSL protection' })}</span>
                                    </div>
                                </div>
                            </div>
                        </Col>
                    </Row>
                </Container>

                {/* Модальное окно для ошибок */}
                {errorModal.open && (
                    <div className="error-modal-overlay" onClick={closeErrorModal} style={{ zIndex: 10000 }}>
                        <div className="error-modal" onClick={(e) => e.stopPropagation()}>
                            <div className="error-modal__header">
                                <h3 className="error-modal__title">
                                    {t('errors.error', { defaultValue: 'Error' })}
                                </h3>
                                <button 
                                    className="error-modal__close" 
                                    onClick={closeErrorModal}
                                    aria-label={t('common.close', { defaultValue: 'Close' })}
                                >
                                    ×
                                </button>
                            </div>
                            <div className="error-modal__body">
                                <p className="error-modal__message">{errorModal.message}</p>
                                {errorModal.kycRequired && (
                                    <a 
                                        href="/profile?tab=kyc" 
                                        className="error-modal__kyc-link"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            goToProfile();
                                        }}
                                    >
                                        {t('deposit.goToProfile', { defaultValue: 'Go to profile to fill in the data' })}
                                    </a>
                                )}
                            </div>
                            <div className="error-modal__footer">
                                <button 
                                    className="error-modal__button" 
                                    onClick={closeErrorModal}
                                >
                                    {t('common.ok', { defaultValue: 'OK' })}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <Container>
            <div className="new-deposit-content">
                <h1 className="new-deposit-title">
                    {t('deposit.chooseMethod', { defaultValue: 'Choose deposit method' })}
                </h1>

                {/* Баннер Secret key */}
                <div 
                    className="secret-key-banner"
                    style={{
                        backgroundImage: `url("${bonusImage}")`,
                        backgroundSize: '100% 100%',
                        backgroundPosition: 'center',
                        backgroundRepeat: 'no-repeat',
                        minHeight: '220px',
                        padding: '0px 60px'
                    }}
                >
                    <div className="secret-key-banner__snow">
                        {Array.from({ length: 50 }).map((_, i) => (
                            <div
                                key={i}
                                className="secret-key-banner__snowflake"
                                style={{
                                    left: `${Math.random() * 100}%`,
                                    animationDelay: `${Math.random() * 5}s`,
                                    animationDuration: `${3 + Math.random() * 4}s`,
                                    opacity: 0.7 + Math.random() * 0.3
                                }}
                            />
                        ))}
                    </div>
                    <div className="secret-key-banner__content">
                        <div className="secret-key-banner__text">
                            <h3 className="secret-key-banner__title">Secret key</h3>
                            <p className="secret-key-banner__description">
                                {t('deposit.secretKeyDescription', { defaultValue: 'Deposit and take your chance in prize draw' })}
                            </p>
                        </div>
                       
                        <button className="secret-key-banner__button">
                            {t('deposit.joinForFree', { defaultValue: 'Join for free' })}
                        </button>
                    </div>
                </div>

                {/* Выбор страны */}
                <Row>
                    <Col xs={12} sm={8} md={6} lg={4}>
                        <div className="country-selector">
                            <label className="country-selector__label">
                                {t('deposit.country', { defaultValue: 'Country' })}
                            </label>
                            <CountrySelect
                                value={selectedCountry}
                                onChange={(value) => {
                                    setSelectedCountry(value);
                                    hasAutoSelectedCountry.current = false; // Пользователь выбрал страну вручную
                                }}
                                options={countries}
                                placeholder={t('deposit.selectCountry', { defaultValue: 'Select country' })}
                                disabled={loadingPaymentMethods || loadingCountries}
                                loading={loadingCountries}
                            />
                        </div>
                    </Col>
                </Row>

            {/* Секция Popular */}
            {groupedMethods.popular.length > 0 && (
                <div className="deposit-section">
                    <div className="deposit-section__header">
                        <svg className="deposit-section__icon" width="20" height="20" viewBox="0 0 24 24" fill="none">
                            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="currentColor"/>
                        </svg>
                        <h2 className="deposit-section__title">
                            {t('deposit.popular', { defaultValue: 'Popular' })}
                        </h2>
                    </div>
                    <Row gutter="md">
                        {groupedMethods.popular.map((method, index) => (
                            <Col key={index} xs={12} sm={6} md={4} lg={3}>
                                <button
                                    className={`deposit-method-card ${selectedMethod === method.id?.toString() ? 'is-active' : ''}`}
                                    onClick={() => handleMethodSelect(method.id?.toString() || '')}
                                >
                                    <div className="deposit-method-card__icon">
                                        {method.icon ? (
                                            <img src={method.icon} alt={method.name} />
                                        ) : method.type === 'card' ? (
                                            <div className="deposit-method-card__placeholder">VISA</div>
                                        ) : (
                                            <div className="deposit-method-card__placeholder">{method.symbol || 'T'}</div>
                                        )}
                                    </div>
                                    <div className="deposit-method-card__name">
                                        {method.name || (method.type === 'card' ? 'Visa / Mastercard' : 'Tether (USDT TRC-20)')}
                                    </div>
                                </button>
                            </Col>
                        ))}
                    </Row>
                </div>
            )}

            {/* Секция Bank cards */}
            {groupedMethods.bankCards.length > 0 && (
                <div className="deposit-section">
                    <div className="deposit-section__header">
                        <svg className="deposit-section__icon" width="20" height="20" viewBox="0 0 24 24" fill="none">
                            <rect x="2" y="6" width="20" height="12" rx="2" stroke="currentColor" strokeWidth="2"/>
                            <path d="M2 10H22" stroke="currentColor" strokeWidth="2"/>
                        </svg>
                        <h2 className="deposit-section__title">
                            {t('deposit.bankCards', { defaultValue: 'Bank cards' })}
                        </h2>
                    </div>
                    <Row gutter="md">
                        {groupedMethods.bankCards.map((card, index) => (
                            <Col key={index} xs={12} sm={6} md={4} lg={3}>
                                <button
                                    className={`deposit-method-card ${selectedMethod === card.id?.toString() ? 'is-active' : ''}`}
                                    onClick={() => handleMethodSelect(card.id?.toString() || '')}
                                >
                                    <div className="deposit-method-card__icon">
                                        {card.icon ? (
                                            <img src={card.icon} alt={card.name} />
                                        ) : (
                                            <div className="deposit-method-card__placeholder">VISA</div>
                                        )}
                                    </div>
                                    <div className="deposit-method-card__name">
                                        {(() => {
                                            const cardAny = card as any;
                                            // Показываем оригинальное название
                                            const displayName = card.name || 'Visa / Mastercard';
                                            
                                            // В режиме разработки добавляем method и sub_method под названием
                                            if (import.meta.env.DEV || import.meta.env.MODE === 'development') {
                                                // Логируем для отладки
                                                console.log('[deposit-method-card] Card data:', {
                                                    id: card.id,
                                                    name: card.name,
                                                    method: cardAny.method,
                                                    sub_method: cardAny.sub_method,
                                                    subMethod: cardAny.subMethod,
                                                    currency: cardAny.currency,
                                                    allKeys: Object.keys(cardAny)
                                                });
                                                
                                                return (
                                                    <>
                                                        <div>{displayName}</div>
                                                        <div style={{ 
                                                            fontSize: '10px', 
                                                            color: '#999', 
                                                            marginTop: '4px',
                                                            fontWeight: 'normal',
                                                            fontFamily: 'monospace'
                                                        }}>
                                                            {cardAny.method && <div>Method: {cardAny.method}</div>}
                                                            {(cardAny.sub_method || cardAny.subMethod) && (
                                                                <div>Sub: {cardAny.sub_method || cardAny.subMethod}</div>
                                                            )}
                                                            {cardAny.currency && <div>Currency: {cardAny.currency}</div>}
                                                        </div>
                                                    </>
                                                );
                                            }
                                            
                                            return displayName;
                                        })()}
                                    </div>
                                </button>
                            </Col>
                        ))}
                    </Row>
                </div>
            )}

            {/* Секция Crypto */}
            {groupedMethods.crypto.length > 0 && (
                <div className="deposit-section">
                    <div className="deposit-section__header">
                        <svg className="deposit-section__icon" width="20" height="20" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                            <path d="M12 6V12L16 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                        <h2 className="deposit-section__title">
                            {t('deposit.crypto', { defaultValue: 'Crypto' })}
                        </h2>
                    </div>
                    <Row gutter="md">
                        {groupedMethods.crypto.map((crypto, index) => (
                            <Col key={index} xs={12} sm={6} md={4} lg={3}>
                                <button
                                    className={`deposit-method-card ${selectedMethod === crypto.id?.toString() ? 'is-active' : ''}`}
                                    onClick={() => handleMethodSelect(crypto.id?.toString() || '')}
                                >
                                    <div className="deposit-method-card__icon">
                                        {crypto.icon ? (
                                            <img src={crypto.icon} alt={crypto.name} />
                                        ) : (
                                            <div className="deposit-method-card__placeholder">{crypto.symbol || 'C'}</div>
                                        )}
                                    </div>
                                    <div className="deposit-method-card__name">
                                        {crypto.name || crypto.name_key || crypto.symbol || `Crypto ${crypto.id || ''}`}
                                        {crypto.network && crypto.network !== crypto.symbol && ` (${crypto.network})`}
                                    </div>
                                </button>
                            </Col>
                        ))}
                    </Row>
                </div>
            )}

            {/* Модальное окно для ошибок */}
            {errorModal.open && (
                <div className="error-modal-overlay" onClick={closeErrorModal}>
                    <div className="error-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="error-modal__header">
                            <h3 className="error-modal__title">
                                {t('errors.error', { defaultValue: 'Error' })}
                            </h3>
                            <button 
                                className="error-modal__close" 
                                onClick={closeErrorModal}
                                aria-label={t('common.close', { defaultValue: 'Close' })}
                            >
                                ×
                            </button>
                        </div>
                        <div className="error-modal__body">
                            <p className="error-modal__message">{errorModal.message}</p>
                            {errorModal.kycRequired && (
                                <a 
                                    href="/profile?tab=kyc" 
                                    className="error-modal__kyc-link"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        goToProfile();
                                    }}
                                >
                                    {t('deposit.goToProfile', { defaultValue: 'Go to profile to fill in the data' })}
                                </a>
                            )}
                        </div>
                        <div className="error-modal__footer">
                            <button 
                                className="error-modal__button" 
                                onClick={closeErrorModal}
                            >
                                {t('common.ok', { defaultValue: 'OK' })}
                            </button>
                        </div>
                    </div>
                </div>
            )}

                {/* Информация о безопасности */}
                <Row gutter="md" className="security-info-row">
                    <Col xs={12} md={4}>
                        <div className="security-info__item">
                            <div className="security-info__icon">3D</div>
                            <div className="security-info__text">
                                <strong>3D SECURE</strong>
                                <span>{t('deposit.security3d', { defaultValue: 'Additional level of security for payments' })}</span>
                            </div>
                        </div>
                    </Col>
                    <Col xs={12} md={4}>
                        <div className="security-info__item">
                            <div className="security-info__icon">$</div>
                            <div className="security-info__text">
                                <strong>{t('deposit.europeanBanks', { defaultValue: 'European banks' })}</strong>
                                <span>{t('deposit.securityBanks', { defaultValue: 'The security of your funds is provided by European banks' })}</span>
                            </div>
                        </div>
                    </Col>
                    <Col xs={12} md={4}>
                        <div className="security-info__item">
                            <div className="security-info__icon">🔒</div>
                            <div className="security-info__text">
                                <strong>SSL</strong>
                                <span>{t('deposit.sslProtection', { defaultValue: '2048 bit robust SSL protection' })}</span>
                            </div>
                        </div>
                    </Col>
                </Row>
            </div>
        </Container>
    );
}

