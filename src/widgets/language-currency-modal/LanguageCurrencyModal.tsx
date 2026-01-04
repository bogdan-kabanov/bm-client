import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '@src/app/providers/useLanguage';
import { languages, LanguageInfo } from '@src/shared/lib/languages';
import { CURRENCY_INFO, SupportedCurrency, getCurrencyInfo } from '@src/shared/lib/currency/currencyUtils';
import { useAppDispatch } from '@src/shared/lib/hooks';
import { updateUserProfile, setUser } from '@src/entities/user/model/slice';
import { useAppSelector } from '@src/shared/lib/hooks';
import { selectProfile } from '@src/entities/user/model/selectors';
import './LanguageCurrencyModal.css';

interface LanguageCurrencyModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialTab?: 'language' | 'currency';
}

const POPULAR_LANGUAGES = ['en', 'ru', 'es', 'vi', 'tr'];

export function LanguageCurrencyModal({ isOpen, onClose, initialTab = 'language' }: LanguageCurrencyModalProps) {
    const { language, setLanguage, t } = useLanguage();
    const dispatch = useAppDispatch();
    const profile = useAppSelector(selectProfile);
    const [activeTab, setActiveTab] = useState<'language' | 'currency'>(initialTab);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const modalRef = useRef<HTMLDivElement>(null);
    const userCurrency = profile?.currency || 'USD';

    const popularLanguages = useMemo(() => {
        return POPULAR_LANGUAGES
            .map(code => languages.find(lang => lang.code === code))
            .filter((lang): lang is LanguageInfo => lang !== undefined);
    }, []);

    const allLanguages = useMemo(() => {
        const popularCodesSet = new Set(POPULAR_LANGUAGES);
        const all = languages.filter(lang => !popularCodesSet.has(lang.code));
        
        if (!searchQuery.trim()) {
            return all;
        }
        const query = searchQuery.toLowerCase().trim();
        return all.filter(lang =>
            lang.name.toLowerCase().includes(query) ||
            lang.nativeName.toLowerCase().includes(query) ||
            lang.code.toLowerCase().includes(query)
        );
    }, [searchQuery]);

    const popularCurrencies = useMemo(() => {
        const popularCodes: SupportedCurrency[] = ['USD', 'EUR', 'CNY', 'INR', 'TRY'];
        return popularCodes
            .map(code => {
                const currency = getCurrencyInfo(code);
                // Проверяем, что валюта действительно существует в CURRENCY_INFO
                return CURRENCY_INFO[code as SupportedCurrency] ? currency : null;
            })
            .filter((currency): currency is ReturnType<typeof getCurrencyInfo> => currency !== null);
    }, []);

    const allCurrencies = useMemo(() => {
        const popularCodes = new Set(['USD', 'EUR', 'GBP', 'JPY', 'CNY']);
        const all = Object.values(CURRENCY_INFO).filter(currency => !popularCodes.has(currency.code));
        
        if (!searchQuery.trim()) {
            return all;
        }
        const query = searchQuery.toLowerCase().trim();
        return all.filter(currency =>
            currency.name.toLowerCase().includes(query) ||
            currency.code.toLowerCase().includes(query) ||
            currency.symbol.toLowerCase().includes(query)
        );
    }, [searchQuery]);

    const handleLanguageSelect = useCallback(async (e: React.MouseEvent, langCode: string) => {
        e.stopPropagation();
        if (langCode === language) {
            onClose();
            return;
        }
        setLanguage(langCode as any);
        onClose();
    }, [language, setLanguage, onClose]);

    const handleCurrencySelect = useCallback(async (e: React.MouseEvent, currencyCode: string) => {
        e.stopPropagation();
        if (currencyCode === userCurrency || isSaving) {
            onClose();
            return;
        }

        try {
            setIsSaving(true);
            console.log('[LanguageCurrencyModal] Updating currency from', userCurrency, 'to', currencyCode);
            console.log('[LanguageCurrencyModal] Sending to API:', { currency: currencyCode });
            const updatedUser = await dispatch(updateUserProfile({
                profileData: { currency: currencyCode }
            })).unwrap();
            console.log('[LanguageCurrencyModal] ✅ Currency updated successfully:', updatedUser?.currency);
            console.log('[LanguageCurrencyModal] Full response:', updatedUser);
            
            // Force profile refresh to ensure Redux state is updated
            if (updatedUser) {
                console.log('[LanguageCurrencyModal] Dispatching setUser to update Redux state');
                dispatch(setUser(updatedUser));
            }
            
            onClose();
        } catch (error) {
            console.error('[LanguageCurrencyModal] ❌ Error updating currency:', error);
        } finally {
            setIsSaving(false);
        }
    }, [userCurrency, isSaving, dispatch, onClose]);

    useEffect(() => {
        if (isOpen) {
            setActiveTab(initialTab);
            setSearchQuery('');
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }

        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen, initialTab]);

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const chartContainer = typeof document !== 'undefined' 
        ? document.querySelector('.chart-section-wrapper') as HTMLElement | null
        : null;
    const container = chartContainer || (typeof document !== 'undefined' ? document.body : null);
    const isInChart = container && chartContainer !== null;
    const overlayClassName = `language-currency-modal-overlay ${isInChart ? 'language-currency-modal-overlay--in-chart' : ''}`;

    const modalContent = (
        <div className={overlayClassName} onClick={onClose}>
            <div className="language-currency-modal" ref={modalRef} onClick={(e) => e.stopPropagation()}>
                <div className="language-currency-modal__header">
                    <div className="language-currency-modal__tabs">
                        <button
                            className={`language-currency-modal__tab ${activeTab === 'language' ? 'active' : ''}`}
                            onClick={() => {
                                setActiveTab('language');
                                setSearchQuery('');
                            }}
                        >
                            {t('common.language') || 'Language'}
                        </button>
                        <button
                            className={`language-currency-modal__tab ${activeTab === 'currency' ? 'active' : ''}`}
                            onClick={() => {
                                setActiveTab('currency');
                                setSearchQuery('');
                            }}
                        >
                            {t('profile.currency') || 'Currency'}
                        </button>
                    </div>
                    <button
                        className="language-currency-modal__close"
                        onClick={onClose}
                        aria-label={t('common.close') || 'Close'}
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>

                <div className="language-currency-modal__search">
                    <svg className="language-currency-modal__search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8"></circle>
                        <path d="m21 21-4.35-4.35"></path>
                    </svg>
                    <input
                        type="text"
                        className="language-currency-modal__search-input"
                        placeholder={t('common.search') || 'Search'}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="language-currency-modal__content">
                    {activeTab === 'language' ? (
                        <>
                            {!searchQuery && (
                                <div className="language-currency-modal__section">
                                    <h3 className="language-currency-modal__section-title">
                                        {t('common.popularLanguages', { defaultValue: 'Popular languages' }) || 'Popular languages'}
                                    </h3>
                                    <div className="language-currency-modal__list">
                                        {popularLanguages.map((lang) => (
                                            <button
                                                key={lang.code}
                                                className={`language-currency-modal__item ${language === lang.code ? 'active' : ''}`}
                                                onClick={(e) => handleLanguageSelect(e, lang.code)}
                                            >
                                                <span className="language-currency-modal__item-name">{lang.nativeName}</span>
                                                <span className="language-currency-modal__item-code">({lang.code.toUpperCase()})</span>
                                                {language === lang.code && (
                                                    <svg className="language-currency-modal__check" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <polyline points="20 6 9 17 4 12"></polyline>
                                                    </svg>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="language-currency-modal__section">
                                <h3 className="language-currency-modal__section-title">
                                    {t('common.allLanguages', { defaultValue: 'All languages' }) || 'All languages'}
                                </h3>
                                <div className="language-currency-modal__list language-currency-modal__list--columns">
                                    {allLanguages.map((lang) => (
                                        <button
                                            key={lang.code}
                                            className={`language-currency-modal__item ${language === lang.code ? 'active' : ''}`}
                                            onClick={(e) => handleLanguageSelect(e, lang.code)}
                                        >
                                            <span className="language-currency-modal__item-name">{lang.nativeName}</span>
                                            <span className="language-currency-modal__item-code">({lang.code.toUpperCase()})</span>
                                            {language === lang.code && (
                                                <svg className="language-currency-modal__check" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="20 6 9 17 4 12"></polyline>
                                                </svg>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            {!searchQuery && (
                                <div className="language-currency-modal__section">
                                    <h3 className="language-currency-modal__section-title">
                                        {t('common.popularCurrencies', { defaultValue: 'Popular currencies' }) || 'Popular currencies'}
                                    </h3>
                                    <div className="language-currency-modal__list">
                                        {popularCurrencies.map((currency) => (
                                            <button
                                                key={currency.code}
                                                className={`language-currency-modal__item ${userCurrency === currency.code ? 'active' : ''}`}
                                                onClick={(e) => handleCurrencySelect(e, currency.code)}
                                                disabled={isSaving}
                                            >
                                                <span className="language-currency-modal__item-symbol">{currency.symbol}</span>
                                                <span className="language-currency-modal__item-name">{currency.name}</span>
                                                <span className="language-currency-modal__item-code">({currency.code})</span>
                                                {userCurrency === currency.code && (
                                                    <svg className="language-currency-modal__check" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <polyline points="20 6 9 17 4 12"></polyline>
                                                    </svg>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="language-currency-modal__section">
                                <h3 className="language-currency-modal__section-title">
                                    {t('common.allCurrencies', { defaultValue: 'All currencies' }) || 'All currencies'}
                                </h3>
                                <div className="language-currency-modal__list language-currency-modal__list--columns">
                                    {allCurrencies.map((currency) => (
                                        <button
                                            key={currency.code}
                                            className={`language-currency-modal__item ${userCurrency === currency.code ? 'active' : ''}`}
                                            onClick={() => handleCurrencySelect(currency.code)}
                                            disabled={isSaving}
                                        >
                                            <span className="language-currency-modal__item-symbol">{currency.symbol}</span>
                                            <span className="language-currency-modal__item-name">{currency.name}</span>
                                            <span className="language-currency-modal__item-code">({currency.code})</span>
                                            {userCurrency === currency.code && (
                                                <svg className="language-currency-modal__check" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="20 6 9 17 4 12"></polyline>
                                                </svg>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );

    return container && typeof document !== 'undefined' ? createPortal(modalContent, container) : null;
}

