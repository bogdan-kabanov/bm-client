import React, { memo, useState, useEffect } from 'react';
import { CountrySelect } from '@src/shared/ui/CountrySelect';
import { paymentMethodsApi } from '@src/shared/api';
import { useLanguage } from '@src/app/providers/useLanguage';

interface Country {
    code: string;
    name: string;
}

interface CountryFieldProps {
    fieldKey: string;
    currentCountry: string;
    isFieldEditing: boolean;
    isSaving: boolean;
    error?: string;
    onFieldChange: (fieldKey: string, value: string) => void;
    onFieldSubmit: (fieldKey: string, value?: string) => void;
    onCancelEditing: (fieldKey: string) => void;
    onStartEditing: (fieldKey: string) => void;
    getDisplayValue: (fieldKey: string) => string;
}

export const CountryField = memo<CountryFieldProps>(({
    fieldKey,
    currentCountry,
    isFieldEditing,
    isSaving,
    error,
    onFieldChange,
    onFieldSubmit,
    onCancelEditing,
    onStartEditing,
    getDisplayValue
}) => {
    const { t } = useLanguage();
    const [countries, setCountries] = useState<Country[]>([]);
    const [loadingCountries, setLoadingCountries] = useState(true);

    useEffect(() => {
        const loadCountries = async () => {
            try {
                setLoadingCountries(true);
                const countriesList = await paymentMethodsApi.getAllCountries();
                if (countriesList && countriesList.length > 0) {
                    setCountries(countriesList);
                }
            } catch (err) {
                console.error('Error loading countries:', err);
            } finally {
                setLoadingCountries(false);
            }
        };

        loadCountries();
    }, []);

    const handleCountryChange = (value: string) => {
        onFieldChange(fieldKey, value);
        setTimeout(() => {
            onFieldSubmit(fieldKey, value);
        }, 100);
    };

    const handleCountryClick = (e: React.MouseEvent) => {
        e.preventDefault();
        onStartEditing(fieldKey);
    };

    const selectedCountry = countries.find(c => c.code === currentCountry);

    return (
        <div className={`profile-field editable ${isFieldEditing ? 'editing' : ''}`}>
            <span className="profile-field-label">{t('profile.country', { defaultValue: 'Страна' })}</span>
            <div className="profile-field-value">
            {isFieldEditing ? (
                <div className="editable-input">
                    <CountrySelect
                        value={currentCountry}
                        onChange={handleCountryChange}
                        options={countries}
                        placeholder={t('profile.selectCountry', { defaultValue: 'Выберите страну' })}
                        loading={loadingCountries}
                        disabled={isSaving}
                    />
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
                    onClick={handleCountryClick}
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

CountryField.displayName = 'CountryField';




