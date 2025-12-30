import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useAppSelector } from "@src/shared/lib/hooks.ts";
import { selectProfile } from "@src/entities/user/model/selectors.ts";
import { useLanguage } from "@src/app/providers/useLanguage.ts";
import { ampayApi } from "@src/shared/api/ampay/ampayApi";
import { paymentMethodsApi } from "@src/shared/api";
import { CountrySelect } from "@src/shared/ui/CountrySelect";
import { detectUserCountry } from "@src/shared/lib/geolocation.util";
import "./NewWithdrawalContent.css";

export function NewWithdrawalContent() {
    const { t } = useLanguage();
    const userData = useAppSelector(selectProfile);
    const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
    const [selectedMethodData, setSelectedMethodData] = useState<any>(null);
    const [showWithdrawalForm, setShowWithdrawalForm] = useState(false);
    const [withdrawalAmount, setWithdrawalAmount] = useState<number>(100);
    const [walletAddress, setWalletAddress] = useState<string>("");
    const [isEditingWallet, setIsEditingWallet] = useState(false);
    const [withdrawalMethods, setWithdrawalMethods] = useState<any[]>([]);
    const [loadingMethods, setLoadingMethods] = useState<boolean>(true);
    const [hasDeposits, setHasDeposits] = useState<boolean>(false);
    const [needsKYC, setNeedsKYC] = useState<boolean>(false);
    const [selectedCountry, setSelectedCountry] = useState<string>("");
    const [countries, setCountries] = useState<Array<{ code: string; name: string }>>([]);
    const [loadingCountries, setLoadingCountries] = useState(true);
    const [userCountryCode, setUserCountryCode] = useState<string | null>(null);
    const hasAutoSelectedCountry = useRef(false);

    const userBalance = typeof userData?.balance === "number"
        ? userData.balance
        : parseFloat(String(userData?.balance || "0"));

    // Определяем страну пользователя из KYC данных или используем дефолтную
    // Преобразуем полное название страны в код (например, "Россия" -> "RU")
    const getCountryCode = (country: string | undefined): string => {
        if (!country) return 'RU';
        // Если это уже код (2 символа) - возвращаем как есть
        if (country.length === 2) return country.toUpperCase();
        // Маппинг полных названий на коды
        const countryMap: { [key: string]: string } = {
            'Россия': 'RU',
            'Russia': 'RU',
            'Российская Федерация': 'RU',
            'Russian Federation': 'RU',
            'Украина': 'UA',
            'Ukraine': 'UA',
            'Беларусь': 'BY',
            'Belarus': 'BY',
            'Казахстан': 'KZ',
            'Kazakhstan': 'KZ',
        };
        return countryMap[country] || country.toUpperCase().slice(0, 2) || 'RU';
    };
    
    const profileCountryCode = 
        (userData as any)?.country || 
        (userData as any)?.country_code || 
        (userData as any)?.countryCode || 
        null;

    // Загрузка методов вывода
    const loadWithdrawalMethods = useCallback(async (countryCode: string | null) => {
        if (!countryCode) {
            setWithdrawalMethods([]);
            setLoadingMethods(false);
            setHasDeposits(false);
            return;
        }

        try {
            setLoadingMethods(true);
            console.log('[NewWithdrawalContent] Загрузка методов вывода для страны:', countryCode);
            console.log('[NewWithdrawalContent] User ID из профиля:', userData?.id);
            console.log('[NewWithdrawalContent] User данные:', { 
                id: userData?.id, 
                kyc_country: (userData as any)?.kyc_country,
                email: userData?.email 
            });
            
            const response = await ampayApi.getStructuredMethods(countryCode, 'OUT');
            // Если response содержит meta, значит это полный ответ { success, data, meta }
            // Иначе это просто data (для обратной совместимости)
            let data: any[] = [];
            let meta: any = undefined;
            
            if (response && typeof response === 'object' && 'data' in response) {
                // Полный ответ с meta
                data = Array.isArray((response as any).data) ? (response as any).data : [];
                meta = (response as any).meta;
            } else if (Array.isArray(response)) {
                // Просто массив данных (старый формат)
                data = response;
            } else {
                // Попытка извлечь data из объекта
                data = (response as any)?.data || [];
            }
            
            const hasDepositsFromApi = meta?.hasDeposits;
            const needsKYCFromApi = meta?.needsKYC;
            const kycVerifiedFromApi = meta?.kycVerified;
            
            console.log('[NewWithdrawalContent] Получено методов вывода:', data.length);
            console.log('[NewWithdrawalContent] Meta информация:', meta);
            console.log('[NewWithdrawalContent] Структура данных:', JSON.stringify(data, null, 2));
            
            // Сначала проверяем наличие депозитов
            const hasDeposits = hasDepositsFromApi === true || data.length > 0;
            
            // Если депозитов нет - показываем сообщение о необходимости пополнения
            if (hasDepositsFromApi === false || (!hasDepositsFromApi && data.length === 0)) {
                console.log('[NewWithdrawalContent] ❌ Нет подтвержденных депозитов');
                setHasDeposits(false);
                setNeedsKYC(false);
                setWithdrawalMethods([]);
                return;
            }
            
            // Только если депозиты есть - проверяем KYC
            if (needsKYCFromApi === true || kycVerifiedFromApi === false) {
                console.log('[NewWithdrawalContent] ❌ KYC не пройден - требуется верификация');
                setNeedsKYC(true);
                setHasDeposits(true); // Депозиты есть, но нужен KYC
                setWithdrawalMethods([]);
                return;
            }
            
            setNeedsKYC(false);
            
            // Если методы есть - значит есть депозиты и KYC пройден
            if (data.length > 0) {
                console.log('[NewWithdrawalContent] ✅ Методы вывода найдены - есть подтвержденные депозиты');
                setHasDeposits(true);
                setWithdrawalMethods(data);
            } else {
                // Если методов нет, но депозиты есть - значит нет методов для страны
                console.log('[NewWithdrawalContent] ⚠️ Есть депозиты, но нет доступных методов вывода для страны:', countryCode);
                setHasDeposits(true); // Есть депозиты, но нет методов
                setWithdrawalMethods([]);
            }
        } catch (error) {
            console.error('[NewWithdrawalContent] Ошибка загрузки методов вывода:', error);
            setHasDeposits(false);
            setWithdrawalMethods([]);
        } finally {
            setLoadingMethods(false);
        }
    }, [userData]);

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

    // Определение страны пользователя
    useEffect(() => {
        const detectCountry = async () => {
            let countryCode: string | null = null;
            const geoData = profileCountryCode ? { countryCode: profileCountryCode } : await detectUserCountry();
            countryCode = geoData?.countryCode || null;
            
            setUserCountryCode(countryCode);
        };

        detectCountry();
    }, [profileCountryCode]);

    // Автоматический выбор страны при загрузке
    useEffect(() => {
        if (countries.length > 0 && !hasAutoSelectedCountry.current && userCountryCode) {
            const countryCode = getCountryCode((userData as any)?.kyc_country) || userCountryCode;
            const countryExists = countries.some(c => c.code === countryCode);
            
            if (countryExists) {
                setSelectedCountry(countryCode);
                hasAutoSelectedCountry.current = true;
            }
        }
    }, [countries, userCountryCode, userData]);

    // Загрузка методов вывода при изменении выбранной страны
    useEffect(() => {
        if (selectedCountry) {
            loadWithdrawalMethods(selectedCountry);
        }
    }, [selectedCountry, loadWithdrawalMethods]);

    // Группируем методы по категориям
    const groupedMethods = useMemo(() => {
        const popular: any[] = [];
        const bankCards: any[] = [];
        const crypto: any[] = [];

        withdrawalMethods.forEach((category: any) => {
            if (category.methods && Array.isArray(category.methods)) {
                category.methods.forEach((method: any) => {
                    // Обрабатываем криптовалюты
                    if (method.cryptocurrencies && Array.isArray(method.cryptocurrencies) && method.cryptocurrencies.length > 0) {
                        method.cryptocurrencies.forEach((cryptoMethod: any) => {
                            const methodData = {
                                id: `crypto_${cryptoMethod.id || cryptoMethod.symbol || Math.random()}`,
                                name: cryptoMethod.name || `${cryptoMethod.symbol || ''}`,
                                icon: cryptoMethod.icon || '💎',
                                type: 'crypto' as const,
                                minAmount: cryptoMethod.min_amount || 20,
                                fee: 0,
                                network: cryptoMethod.network || cryptoMethod.symbol || '',
                                processingTime: '1-3 часа',
                                category: category.name_key || category.name || '',
                                wallet: cryptoMethod.wallet || null, // Кошелек из метода
                                qrCodeImage: cryptoMethod.qr_code_image || null, // QR-код из метода
                                originalData: cryptoMethod
                            };
                            crypto.push(methodData);
                            // Первые 2 криптовалюты добавляем в popular
                            if (popular.length < 2) {
                                popular.push(methodData);
                            }
                        });
                    }

                    // Обрабатываем карты
                    if (method.cards && Array.isArray(method.cards) && method.cards.length > 0) {
                        method.cards.forEach((cardMethod: any) => {
                            const methodData = {
                                id: `card_${cardMethod.id || cardMethod.name_key || Math.random()}`,
                                name: cardMethod.name || cardMethod.display_name || '',
                                icon: cardMethod.icon || '💳',
                                type: 'card' as const,
                                minAmount: cardMethod.min_amount || 50,
                                fee: 2.5,
                                network: '',
                                processingTime: '1-3 дня',
                                category: category.name_key || category.name || '',
                                originalData: cardMethod
                            };
                            bankCards.push(methodData);
                            // Первые 2 карты добавляем в popular
                            if (popular.length < 2) {
                                popular.push(methodData);
                            }
                        });
                    }
                });
            }
        });

        return { popular, bankCards, crypto };
    }, [withdrawalMethods]);

    const handleMethodSelect = (methodId: string) => {
        setSelectedMethod(methodId);
        
        // Находим данные выбранного метода
        let methodData = null;
        
        const allMethods = [
            ...groupedMethods.popular,
            ...groupedMethods.bankCards,
            ...groupedMethods.crypto
        ];
        
        methodData = allMethods.find(m => m.id === methodId);
        
        if (methodData) {
            setSelectedMethodData(methodData);
            setShowWithdrawalForm(true);
            
            // Устанавливаем адрес кошелька из метода, если он есть (для криптометодов)
            if (methodData.type === "crypto" && methodData.wallet) {
                setWalletAddress(methodData.wallet);
                setIsEditingWallet(false); // Если адрес из метода - показываем как сохраненный
            } else {
                setWalletAddress("");
                setIsEditingWallet(true); // Если адреса нет - сразу разрешаем редактирование
            }
        }
    };

    const handleBackToMethodSelection = () => {
        setShowWithdrawalForm(false);
        setSelectedMethod(null);
        setSelectedMethodData(null);
        setWalletAddress("");
        setIsEditingWallet(false);
    };

    const handleAmountSelect = (amount: number) => {
        setWithdrawalAmount(amount);
    };

    const handleWithdraw = () => {
        // Здесь будет логика отправки вывода
        console.log('Withdraw:', {
            method: selectedMethodData,
            amount: withdrawalAmount,
            walletAddress
        });
        // TODO: Реализовать отправку вывода
    };

    // Если выбрана форма вывода, показываем её
    if (showWithdrawalForm && selectedMethodData) {
        const predefinedAmounts = [
            { amount: 50 },
            { amount: 100 },
            { amount: 250 },
            { amount: 500 }
        ];

        const fee = selectedMethodData.fee || 0;
        const totalAmount = withdrawalAmount + fee;
        const receivedAmount = withdrawalAmount;

        return (
            <div className="new-withdrawal-content new-withdrawal-content--form">
                <div className="withdrawal-form-header">
                    <button 
                        className="withdrawal-form-back-button"
                        onClick={handleBackToMethodSelection}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                            <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                    </button>

                    <h1 className="new-withdrawal-title">
                        {t('withdrawal.chooseAmount', { defaultValue: 'Choose withdrawal amount' })}
                    </h1>
                </div>

                <div className="withdrawal-form-container">
                    <div className="withdrawal-form-left">
                        {/* Предустановленные суммы */}
                        <div className="withdrawal-amounts-grid">
                            {predefinedAmounts.map((item, index) => (
                                <button
                                    key={index}
                                    className={`withdrawal-amount-card ${withdrawalAmount === item.amount ? 'is-active' : ''}`}
                                    onClick={() => handleAmountSelect(item.amount)}
                                >
                                    <div className="withdrawal-amount-card__amount">
                                        ${item.amount.toLocaleString()}
                                    </div>
                                </button>
                            ))}
                        </div>

                        {/* Произвольная сумма */}
                        <div className="withdrawal-custom-amount">
                            <div className="withdrawal-custom-amount__label">
                                {t('withdrawal.enterAmount', { defaultValue: 'Enter amount' })}
                            </div>
                            <div className="withdrawal-custom-amount__input-wrapper">
                                <span className="withdrawal-custom-amount__currency">$</span>
                                <input
                                    type="number"
                                    className="withdrawal-custom-amount__input"
                                    value={withdrawalAmount}
                                    onChange={(e) => handleAmountSelect(Number(e.target.value) || 0)}
                                    min={selectedMethodData.minAmount || 1}
                                    max={userBalance}
                                />
                            </div>
                            <div className="withdrawal-custom-amount__note">
                                {t('withdrawal.minAmount', { defaultValue: 'Min' })}: ${selectedMethodData.minAmount || 20} | 
                                {t('withdrawal.maxAmount', { defaultValue: 'Max' })}: ${userBalance.toFixed(2)}
                            </div>
                        </div>

                        {/* Информация о комиссии и итоговой сумме */}
                        <div className="withdrawal-summary">
                            <div className="withdrawal-summary__item">
                                <span>{t('withdrawal.amount', { defaultValue: 'Amount' })}</span>
                                <span className="withdrawal-summary__value">${withdrawalAmount.toFixed(2)}</span>
                            </div>
                            <div className="withdrawal-summary__item">
                                <span>{t('withdrawal.fee', { defaultValue: 'Fee' })}</span>
                                <span className="withdrawal-summary__value">
                                    {selectedMethodData.type === "crypto" 
                                        ? `${fee} ${selectedMethodData.network || ''}`
                                        : `$${fee.toFixed(2)}`
                                    }
                                </span>
                            </div>
                            <div className="withdrawal-summary__item withdrawal-summary__item--total">
                                <span>{t('withdrawal.youWillReceive', { defaultValue: 'You will receive' })}</span>
                                <span className="withdrawal-summary__value withdrawal-summary__value--total">
                                    {selectedMethodData.type === "crypto" 
                                        ? `${receivedAmount.toFixed(2)} ${selectedMethodData.network || 'USDT'}`
                                        : `$${receivedAmount.toFixed(2)}`
                                    }
                                </span>
                            </div>
                        </div>

                        {/* Поле для адреса кошелька (только для криптовалют) */}
                        {selectedMethodData.type === "crypto" && (
                            <div className="withdrawal-wallet-section">
                                <div className="withdrawal-wallet-section__header">
                                    <span>{t('withdrawal.walletAddress', { defaultValue: 'Wallet address' })}</span>
                                    {walletAddress && !isEditingWallet && (
                                        <button
                                            className="withdrawal-edit-wallet-btn"
                                            onClick={() => setIsEditingWallet(true)}
                                        >
                                            {t('withdrawal.edit', { defaultValue: 'Edit' })}
                                        </button>
                                    )}
                                </div>
                                {walletAddress && !isEditingWallet ? (
                                    <div className="withdrawal-wallet-address">
                                        {walletAddress}
                                        {selectedMethodData.wallet && walletAddress === selectedMethodData.wallet && (
                                        <span className="withdrawal-wallet-saved-badge">
                                            {t('withdrawal.saved', { defaultValue: 'Saved' })}
                                        </span>
                                        )}
                                    </div>
                                ) : (
                                    <div className="withdrawal-wallet-input-container">
                                        <input
                                            type="text"
                                            className="withdrawal-wallet-input"
                                            placeholder={t('withdrawal.enterWalletAddress', { defaultValue: 'Enter wallet address' })}
                                            value={walletAddress}
                                            onChange={(e) => {
                                                setWalletAddress(e.target.value);
                                                // Автоматически разрешаем редактирование при вводе
                                                if (!isEditingWallet) {
                                                    setIsEditingWallet(true);
                                                }
                                            }}
                                        />
                                        {isEditingWallet && walletAddress && (
                                            <button
                                                className="withdrawal-save-wallet-btn"
                                                onClick={() => setIsEditingWallet(false)}
                                            >
                                                {t('withdrawal.save', { defaultValue: 'Save' })}
                                            </button>
                                        )}
                                    </div>
                                )}
                                {/* QR-код кошелька, если есть */}
                                {selectedMethodData.qrCodeImage && (
                                    <div className="withdrawal-wallet-qr" style={{ marginTop: '16px', textAlign: 'center' }}>
                                        <img 
                                            src={selectedMethodData.qrCodeImage} 
                                            alt="QR Code" 
                                            style={{ maxWidth: '200px', height: 'auto', border: '1px solid #ddd', borderRadius: '8px' }}
                                        />
                                        <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
                                            {t('withdrawal.scanQR', { defaultValue: 'Scan QR code to copy address' })}
                                        </div>
                                    </div>
                                )}
                                <div className="withdrawal-wallet-note">
                                    {t('withdrawal.walletNote', { defaultValue: 'Make sure the address is correct. Transactions cannot be reversed.' })}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="withdrawal-form-right">
                        <div className="withdrawal-details">
                            <h3 className="withdrawal-details__title">
                                {t('withdrawal.withdrawalDetails', { defaultValue: 'Withdrawal details' })}
                            </h3>
                            <div className="withdrawal-details__field">
                                <label>{t('withdrawal.method', { defaultValue: 'Withdrawal method' })}</label>
                                <div className="withdrawal-details__method-value">
                                    {selectedMethodData.name || 'USDT (TRC-20)'}
                                </div>
                            </div>
                            <div className="withdrawal-details__field">
                                <label>{t('withdrawal.amount', { defaultValue: 'Amount' })}</label>
                                <div className="withdrawal-details__amount-value">
                                    ${withdrawalAmount.toFixed(2)}
                                </div>
                            </div>
                            {selectedMethodData.processingTime && (
                                <div className="withdrawal-details__field">
                                    <label>{t('withdrawal.processingTime', { defaultValue: 'Processing time' })}</label>
                                    <div className="withdrawal-details__time-value">
                                        {selectedMethodData.processingTime}
                                    </div>
                                </div>
                            )}
                            <button
                                className="withdrawal-button"
                                onClick={handleWithdraw}
                                disabled={withdrawalAmount < (selectedMethodData.minAmount || 20) || withdrawalAmount > userBalance || (selectedMethodData.type === "crypto" && !walletAddress.trim())}
                            >
                                {t('withdrawal.withdrawButton', { defaultValue: 'Withdraw' })} ${withdrawalAmount.toFixed(2)}
                            </button>
                        </div>

                        {/* Информация о безопасности */}
                        <div className="security-info">
                            <div className="security-info__item">
                                <div className="security-info__icon">🔒</div>
                                <div className="security-info__text">
                                    <strong>{t('withdrawal.secure', { defaultValue: 'Secure' })}</strong>
                                    <span>{t('withdrawal.secureDescription', { defaultValue: 'All transactions are encrypted and secure' })}</span>
                                </div>
                            </div>
                            <div className="security-info__item">
                                <div className="security-info__icon">⚡</div>
                                <div className="security-info__text">
                                    <strong>{t('withdrawal.fast', { defaultValue: 'Fast processing' })}</strong>
                                    <span>{t('withdrawal.fastDescription', { defaultValue: 'Withdrawals are processed within 24 hours' })}</span>
                                </div>
                            </div>
                            <div className="security-info__item">
                                <div className="security-info__icon">✓</div>
                                <div className="security-info__text">
                                    <strong>{t('withdrawal.verified', { defaultValue: 'Verified' })}</strong>
                                    <span>{t('withdrawal.verifiedDescription', { defaultValue: 'All withdrawal methods are verified and trusted' })}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Если загрузка - показываем индикатор
    if (loadingMethods) {
        return (
            <div className="new-withdrawal-content">
                <h1 className="new-withdrawal-title">
                    {t('withdrawal.chooseMethod', { defaultValue: 'Choose withdrawal method' })}
                </h1>
                <div style={{ textAlign: 'center', padding: '40px' }}>
                    <div>{t('withdrawal.loading', { defaultValue: 'Loading...' })}</div>
                </div>
            </div>
        );
    }

    // Если нет методов вывода - показываем соответствующее сообщение
    if (withdrawalMethods.length === 0) {
        // Если требуется KYC - показываем сообщение о необходимости пройти верификацию
        if (needsKYC) {
            return (
                <div className="new-withdrawal-content">
                    <h1 className="new-withdrawal-title">
                        {t('withdrawal.chooseMethod', { defaultValue: 'Choose withdrawal method' })}
                    </h1>
                    <div style={{ marginBottom: '24px', maxWidth: '400px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#333' }}>
                            {t('withdrawal.country', { defaultValue: 'Country' })}
                        </label>
                        <CountrySelect
                            value={selectedCountry}
                            onChange={(value) => {
                                setSelectedCountry(value);
                                hasAutoSelectedCountry.current = false;
                            }}
                            options={countries}
                            placeholder={t('withdrawal.selectCountry', { defaultValue: 'Select country' })}
                            disabled={loadingMethods || loadingCountries}
                            loading={loadingCountries}
                        />
                    </div>
                    <div style={{ 
                        textAlign: 'center', 
                        padding: '60px 20px',
                        background: '#f8f9fa',
                        borderRadius: '12px',
                        marginTop: '20px'
                    }}>
                        <div style={{ fontSize: '48px', marginBottom: '20px' }}>🔐</div>
                        <h2 style={{ fontSize: '24px', marginBottom: '16px', color: '#333' }}>
                            {t('withdrawal.kycRequiredTitle', { defaultValue: 'Для вывода средств необходимо пройти KYC верификацию' })}
                        </h2>
                        <p style={{ fontSize: '16px', color: '#666', marginBottom: '24px', maxWidth: '500px', margin: '0 auto 24px' }}>
                            {t('withdrawal.kycRequiredMessage', { 
                                defaultValue: 'Для вывода средств необходимо пройти процедуру верификации личности (KYC). Пожалуйста, заполните данные KYC в настройках профиля и дождитесь подтверждения.' 
                            })}
                        </p>
                        <a 
                            href="/profile?tab=verification" 
                            style={{
                                display: 'inline-block',
                                padding: '12px 24px',
                                background: '#007bff',
                                color: 'white',
                                borderRadius: '8px',
                                textDecoration: 'none',
                                fontSize: '16px',
                                fontWeight: '500'
                            }}
                        >
                            {t('withdrawal.goToKYC', { defaultValue: 'Пройти KYC верификацию' })}
                        </a>
                    </div>
                </div>
            );
        }
        
        // Если нет депозитов - показываем сообщение о необходимости пополнить баланс
        if (!hasDeposits) {
            return (
                <div className="new-withdrawal-content">
                    <h1 className="new-withdrawal-title">
                        {t('withdrawal.chooseMethod', { defaultValue: 'Choose withdrawal method' })}
                    </h1>
                    <div style={{ marginBottom: '24px', maxWidth: '400px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#333' }}>
                            {t('withdrawal.country', { defaultValue: 'Country' })}
                        </label>
                        <CountrySelect
                            value={selectedCountry}
                            onChange={(value) => {
                                setSelectedCountry(value);
                                hasAutoSelectedCountry.current = false;
                            }}
                            options={countries}
                            placeholder={t('withdrawal.selectCountry', { defaultValue: 'Select country' })}
                            disabled={loadingMethods || loadingCountries}
                            loading={loadingCountries}
                        />
                    </div>
                    <div style={{ 
                        textAlign: 'center', 
                        padding: '60px 20px',
                        background: '#f8f9fa',
                        borderRadius: '12px',
                        marginTop: '20px'
                    }}>
                        <div style={{ fontSize: '48px', marginBottom: '20px' }}>💳</div>
                        <h2 style={{ fontSize: '24px', marginBottom: '16px', color: '#333' }}>
                            {t('withdrawal.noDepositsTitle', { defaultValue: 'Для вывода средств необходимо пополнить баланс' })}
                        </h2>
                        <p style={{ fontSize: '16px', color: '#666', marginBottom: '24px', maxWidth: '500px', margin: '0 auto 24px' }}>
                            {t('withdrawal.noDepositsMessage', { 
                                defaultValue: 'Пожалуйста, внесите депозит и дождитесь его подтверждения. После этого вы сможете вывести средства.' 
                            })}
                        </p>
                        <a 
                            href="/deposit" 
                            style={{
                                display: 'inline-block',
                                padding: '12px 24px',
                                background: '#007bff',
                                color: 'white',
                                borderRadius: '8px',
                                textDecoration: 'none',
                                fontSize: '16px',
                                fontWeight: '500'
                            }}
                        >
                            {t('withdrawal.goToDeposit', { defaultValue: 'Пополнить баланс' })}
                        </a>
                    </div>
                </div>
            );
        }
        
        // Если есть депозиты, но нет методов вывода для страны
        return (
            <div className="new-withdrawal-content">
                <h1 className="new-withdrawal-title">
                    {t('withdrawal.chooseMethod', { defaultValue: 'Choose withdrawal method' })}
                </h1>
                <div style={{ marginBottom: '24px', maxWidth: '400px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#333' }}>
                        {t('withdrawal.country', { defaultValue: 'Country' })}
                    </label>
                    <CountrySelect
                        value={selectedCountry}
                        onChange={(value) => {
                            setSelectedCountry(value);
                            hasAutoSelectedCountry.current = false;
                        }}
                        options={countries}
                        placeholder={t('withdrawal.selectCountry', { defaultValue: 'Select country' })}
                        disabled={loadingMethods || loadingCountries}
                        loading={loadingCountries}
                    />
                </div>
                <div style={{ 
                    textAlign: 'center', 
                    padding: '60px 20px',
                    background: '#f8f9fa',
                    borderRadius: '12px',
                    marginTop: '20px'
                }}>
                    <div style={{ fontSize: '48px', marginBottom: '20px' }}>🌍</div>
                    <h2 style={{ fontSize: '24px', marginBottom: '16px', color: '#333' }}>
                        {t('withdrawal.noMethodsTitle', { defaultValue: 'Нет доступных методов вывода для вашей страны' })}
                    </h2>
                    <p style={{ fontSize: '16px', color: '#666', marginBottom: '24px', maxWidth: '500px', margin: '0 auto 24px' }}>
                        {t('withdrawal.noMethodsMessage', { 
                            defaultValue: 'К сожалению, для вашей страны в данный момент нет доступных методов вывода средств. Пожалуйста, свяжитесь с поддержкой для уточнения доступных методов вывода.' 
                        })}
                    </p>
                    <a 
                        href="/support" 
                        style={{
                            display: 'inline-block',
                            padding: '12px 24px',
                            background: '#007bff',
                            color: 'white',
                            borderRadius: '8px',
                            textDecoration: 'none',
                            fontSize: '16px',
                            fontWeight: '500'
                        }}
                    >
                        {t('withdrawal.contactSupport', { defaultValue: 'Связаться с поддержкой' })}
                    </a>
                </div>
            </div>
        );
    }

    return (
        <div className="new-withdrawal-content">
            <h1 className="new-withdrawal-title">
                {t('withdrawal.chooseMethod', { defaultValue: 'Choose withdrawal method' })}
            </h1>

            {/* Секция Popular */}
            {groupedMethods.popular.length > 0 && (
                <div className="withdrawal-section">
                    <div className="withdrawal-section__header">
                        <svg className="withdrawal-section__icon" width="20" height="20" viewBox="0 0 24 24" fill="none">
                            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="currentColor"/>
                        </svg>
                        <h2 className="withdrawal-section__title">
                            {t('withdrawal.popular', { defaultValue: 'Popular' })}
                        </h2>
                    </div>
                    <div className="withdrawal-methods-grid">
                        {groupedMethods.popular.map((method, index) => (
                            <button
                                key={index}
                                className={`withdrawal-method-card ${selectedMethod === method.id ? 'is-active' : ''}`}
                                onClick={() => handleMethodSelect(method.id)}
                            >
                                <div className="withdrawal-method-card__icon">
                                    {method.icon}
                                </div>
                                <div className="withdrawal-method-card__name">
                                    {method.name}
                                </div>
                                {method.minAmount && (
                                    <div className="withdrawal-method-card__min">
                                        Min: ${method.minAmount}
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Секция Bank cards */}
            {groupedMethods.bankCards.length > 0 && (
                <div className="withdrawal-section">
                    <div className="withdrawal-section__header">
                        <svg className="withdrawal-section__icon" width="20" height="20" viewBox="0 0 24 24" fill="none">
                            <rect x="2" y="6" width="20" height="12" rx="2" stroke="currentColor" strokeWidth="2"/>
                            <path d="M2 10H22" stroke="currentColor" strokeWidth="2"/>
                        </svg>
                        <h2 className="withdrawal-section__title">
                            {t('withdrawal.bankCards', { defaultValue: 'Bank cards' })}
                        </h2>
                    </div>
                    <div className="withdrawal-methods-grid">
                        {groupedMethods.bankCards.map((card, index) => (
                            <button
                                key={index}
                                className={`withdrawal-method-card ${selectedMethod === card.id ? 'is-active' : ''}`}
                                onClick={() => handleMethodSelect(card.id)}
                            >
                                <div className="withdrawal-method-card__icon">
                                    {card.icon}
                                </div>
                                <div className="withdrawal-method-card__name">
                                    {card.name}
                                </div>
                                {card.minAmount && (
                                    <div className="withdrawal-method-card__min">
                                        Min: ${card.minAmount}
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Секция Crypto */}
            {groupedMethods.crypto.length > 0 && (
                <div className="withdrawal-section">
                    <div className="withdrawal-section__header">
                        <svg className="withdrawal-section__icon" width="20" height="20" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                            <path d="M12 6V12L16 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                        <h2 className="withdrawal-section__title">
                            {t('withdrawal.crypto', { defaultValue: 'Cryptocurrency' })}
                        </h2>
                    </div>
                    <div className="withdrawal-methods-grid">
                        {groupedMethods.crypto.map((crypto, index) => (
                            <button
                                key={index}
                                className={`withdrawal-method-card ${selectedMethod === crypto.id ? 'is-active' : ''}`}
                                onClick={() => handleMethodSelect(crypto.id)}
                            >
                                <div className="withdrawal-method-card__icon">
                                    {crypto.icon}
                                </div>
                                <div className="withdrawal-method-card__name">
                                    {crypto.name}
                                </div>
                                {crypto.minAmount && (
                                    <div className="withdrawal-method-card__min">
                                        Min: {crypto.minAmount} {crypto.network || ''}
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Информация о безопасности */}
            <div className="security-info">
                <div className="security-info__item">
                    <div className="security-info__icon">🔒</div>
                    <div className="security-info__text">
                        <strong>{t('withdrawal.secure', { defaultValue: 'Secure' })}</strong>
                        <span>{t('withdrawal.secureDescription', { defaultValue: 'All transactions are encrypted and secure' })}</span>
                    </div>
                </div>
                <div className="security-info__item">
                    <div className="security-info__icon">⚡</div>
                    <div className="security-info__text">
                        <strong>{t('withdrawal.fast', { defaultValue: 'Fast processing' })}</strong>
                        <span>{t('withdrawal.fastDescription', { defaultValue: 'Withdrawals are processed within 24 hours' })}</span>
                    </div>
                </div>
                <div className="security-info__item">
                    <div className="security-info__icon">✓</div>
                    <div className="security-info__text">
                        <strong>{t('withdrawal.verified', { defaultValue: 'Verified' })}</strong>
                        <span>{t('withdrawal.verifiedDescription', { defaultValue: 'All withdrawal methods are verified and trusted' })}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

