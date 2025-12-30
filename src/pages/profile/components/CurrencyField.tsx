import React, { memo, useRef, useEffect } from 'react';
import { CURRENCY_INFO, SupportedCurrency, getCurrencyInfo } from "@src/shared/lib/currency/currencyUtils";

interface CurrencyFieldProps {
    fieldKey: string;
    currentCurrency: SupportedCurrency;
    isFieldEditing: boolean;
    isSaving: boolean;
    error?: string;
    onFieldChange: (fieldKey: string, value: string) => void;
    onFieldSubmit: (fieldKey: string, value?: string) => void;
    onCancelEditing: (fieldKey: string) => void;
    onStartEditing: (fieldKey: string) => void;
    getDisplayValue: (fieldKey: string) => string;
}

export const CurrencyField = memo<CurrencyFieldProps>(({
    fieldKey,
    currentCurrency,
    isFieldEditing,
    isSaving,
    error,
    onFieldChange,
    onFieldSubmit,
    onCancelEditing,
    onStartEditing,
    getDisplayValue
}) => {
    const currencySelectRef = useRef<HTMLSelectElement>(null);
    const shouldOpenSelectRef = useRef(false);

    // Автоматически открываем select при начале редактирования валюты
    useEffect(() => {
        if (isFieldEditing && currencySelectRef.current && shouldOpenSelectRef.current) {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    if (currencySelectRef.current) {
                        currencySelectRef.current.focus();
                        try {
                            if (typeof (currencySelectRef.current as any).showPicker === 'function') {
                                (currencySelectRef.current as any).showPicker();
                            } else {
                                const mousedownEvent = new MouseEvent('mousedown', {
                                    bubbles: true,
                                    cancelable: true,
                                    view: window,
                                    button: 0
                                });
                                currencySelectRef.current.dispatchEvent(mousedownEvent);
                                setTimeout(() => {
                                    if (currencySelectRef.current) {
                                        const clickEvent = new MouseEvent('click', {
                                            bubbles: true,
                                            cancelable: true,
                                            view: window,
                                            button: 0
                                        });
                                        currencySelectRef.current.dispatchEvent(clickEvent);
                                    }
                                }, 50);
                            }
                        } catch (e) {
                        }
                        shouldOpenSelectRef.current = false;
                    }
                });
            });
        }
    }, [isFieldEditing]);

    const handleCurrencyClick = (e: React.MouseEvent) => {
        e.preventDefault();
        shouldOpenSelectRef.current = true;
        onStartEditing(fieldKey);
    };

    const currencyInfo = getCurrencyInfo(currentCurrency);

    return (
        <div className={`profile-field editable ${isFieldEditing ? 'editing' : ''}`}>
            <span className="profile-field-label">Валюта</span>
            <div className="profile-field-value">
            {isFieldEditing ? (
                <div className="editable-input">
                    <select
                        ref={currencySelectRef}
                        value={currentCurrency}
                        onChange={(e) => {
                            const newValue = e.target.value;
                            onFieldChange(fieldKey, newValue);
                            setTimeout(() => {
                                onFieldSubmit(fieldKey, newValue);
                            }, 100);
                        }}
                        autoFocus
                        className="currency-select"
                    >
                        {Object.values(CURRENCY_INFO).map((currency) => (
                            <option key={currency.code} value={currency.code}>
                                {currency.symbol} {currency.name} ({currency.code})
                            </option>
                        ))}
                    </select>
                    <button
                        type="button"
                        className="confirm-btn"
                        onClick={() => onFieldSubmit(fieldKey)}
                        disabled={isSaving}
                    >
                        {isSaving ? (
                            <span className="inline-loader" />
                        ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                                <path d="M5 13L9 17L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        )}
                    </button>
                    <button
                        type="button"
                        className="cancel-inline-btn"
                        onClick={() => onCancelEditing(fieldKey)}
                        disabled={isSaving}
                    >
                        ×
                    </button>
                </div>
            ) : (
                <button
                    type="button"
                    className="editable-display"
                    onClick={handleCurrencyClick}
                >
                    <span>{getDisplayValue(fieldKey)}</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <path d="M12 20H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M16.5 3.5C16.8978 3.10218 17.4374 2.87868 18 2.87868C18.5626 2.87868 19.1022 3.10218 19.5 3.5C19.8978 3.89782 20.1213 4.43739 20.1213 5C20.1213 5.56261 19.8978 6.10218 19.5 6.5L8 18L4 19L5 15L16.5 3.5Z"
                              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </button>
            )}
            </div>
            {error && <span className="error-text">{error}</span>}
        </div>
    );
});

CurrencyField.displayName = 'CurrencyField';

