import React, { useMemo } from 'react';
import type { CurrencyCategory, Currency } from '@src/shared/api';
import './CurrencySelector.css';

interface CurrencySelectorProps {
  currencyCategories: CurrencyCategory[];
  selectedBase: string;
  onBaseChange: (base: string) => void;
  selectedCategoryId: number | null;
  setSelectedCategoryId: (id: number | null) => void;
  currenciesLoading: boolean;
  getCurrencyInfo?: (baseCurrency: string) => Currency | undefined;
  resolveCurrencyIconUrls?: (currency?: Currency | null) => string[];
}

export const CurrencySelector: React.FC<CurrencySelectorProps> = ({
  currencyCategories,
  selectedBase,
  getCurrencyInfo,
  resolveCurrencyIconUrls,
}) => {
  // Активные категории
  const activeCategories = useMemo(() => {
    return currencyCategories.filter(cat => cat.is_active && cat.currencies && cat.currencies.length > 0);
  }, [currencyCategories]);

  // Все валюты из активных категорий
  const allCurrencies = useMemo(() => {
    return activeCategories.flatMap(cat => cat.currencies || []);
  }, [activeCategories]);

  // Выбранная валюта
  const selectedCurrency = useMemo(() => {
    return allCurrencies.find(curr => curr.base_currency === selectedBase);
  }, [allCurrencies, selectedBase]);

  const getCurrencyIcon = (currency: Currency): string | null => {
    if (resolveCurrencyIconUrls && getCurrencyInfo) {
      const info = getCurrencyInfo(currency.base_currency);
      const urls = resolveCurrencyIconUrls(info);
      return urls[0] || null;
    }
    return currency.icon || null;
  };

  return (
    <div className="base-currency-selector">
      <div className="dropdown-trigger" style={{ cursor: 'default', pointerEvents: 'none' }}>
        <div className="currency-label">
          {selectedCurrency && (
            <div className="currency-label__icon">
              {getCurrencyIcon(selectedCurrency) ? (
                <img
                  src={getCurrencyIcon(selectedCurrency)!}
                  alt={selectedCurrency.base_currency}
                  className="currency-label__icon-img"
                />
              ) : (
                <span className="currency-label__icon-initials">
                  {selectedCurrency.base_currency.substring(0, 2)}
                </span>
              )}
            </div>
          )}
          <span className="currency-label__text">{selectedBase}</span>
        </div>
      </div>
    </div>
  );
};

