import React from 'react';

interface ChartTopBarProps {
  selectedBase: string;
  onBaseChange: (base: string) => void;
  currencyData?: {
    currencyCategories: any[];
    currenciesLoading: boolean;
    selectedCategoryId: number | null;
    setSelectedCategoryId: (id: number | null) => void;
    favoriteCurrencies: any[];
    setFavoriteCurrencies: (currencies: any[]) => void;
    getCurrencyInfo?: (baseCurrency: string) => any;
    resolveCurrencyIconUrls?: (currency?: any) => string[];
    resolveCurrencyAveragePrice?: (baseCurrency: string) => number | null;
  };
}

export const ChartTopBar: React.FC<ChartTopBarProps> = ({
  selectedBase,
  onBaseChange,
  currencyData,
}) => {
  // Убрано chart-top-bar-currency, так как выбор валюты уже реализован через ChartNavigationButton
  // Этот компонент оставлен для обратной совместимости, но не отображает никакого контента
  return <div className="chart-top-bar"></div>;
};

