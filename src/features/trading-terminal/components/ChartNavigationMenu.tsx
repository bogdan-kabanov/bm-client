import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { CurrencyCategory, Currency } from '@src/shared/api';
import { formatPercent, formatPrice } from '../utils/formatUtils';
import { useLanguage } from '@src/app/providers/useLanguage';
import { useAppDispatch } from '@src/shared/lib/hooks';
import { setSelectedCurrencyId } from '@src/entities/trading/model/slice';
import './ChartNavigationMenu.css';

interface ChartNavigationMenuProps {
  isOpen: boolean;
  onClose: () => void;
  selectedBase: string;
  onBaseChange: (base: string, quote?: string) => void;
  currencyCategories: CurrencyCategory[];
  currenciesLoading: boolean;
  selectedCategoryId: number | null;
  setSelectedCategoryId: (id: number | null) => void;
  getCurrencyInfo?: (baseCurrency: string) => Currency | undefined;
  resolveCurrencyIconUrls?: (currency?: Currency | null) => string[];
  resolveCurrencyAveragePrice?: (baseCurrency: string) => number | null;
  favoriteCurrencies?: string[];
  setFavoriteCurrencies?: (currencies: string[] | ((prev: string[]) => string[])) => void;
  setForcedCurrency?: (currencyId: number) => void;
  forcedCurrency?: number | null;
}

export const ChartNavigationMenu: React.FC<ChartNavigationMenuProps> = ({
  isOpen,
  onClose,
  selectedBase,
  onBaseChange,
  currencyCategories,
  currenciesLoading,
  selectedCategoryId,
  setSelectedCategoryId,
  getCurrencyInfo,
  resolveCurrencyIconUrls,
  resolveCurrencyAveragePrice,
  favoriteCurrencies = [],
  setFavoriteCurrencies,
  setForcedCurrency,
  forcedCurrency,
}) => {
  const { t } = useLanguage();
  const dispatch = useAppDispatch();
  const [searchQuery, setSearchQuery] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const filtersRef = useRef<HTMLDivElement>(null);
  const [showFiltersLeftArrow, setShowFiltersLeftArrow] = useState(false);
  const [showFiltersRightArrow, setShowFiltersRightArrow] = useState(false);

  // Закрытие меню при клике вне его
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // Не закрываем, если клик был на кнопке навигации
      if (target.closest('.chart-navigation-button')) {
        return;
      }
      // Не закрываем, если клик был внутри меню
      if (menuRef.current && menuRef.current.contains(target)) {
        return;
      }
      // Закрываем только если клик был действительно вне меню
      onClose();
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Закрытие по Escape
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
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

  // Активные категории
  const activeCategories = useMemo(() => {
    const filtered = currencyCategories.filter(cat => {
      if (!cat.is_active || !cat.currencies) return false;
      // Проверяем, что есть хотя бы одна активная валюта в категории
      const activeCurrencies = cat.currencies.filter(curr => curr.is_active);
      return activeCurrencies.length > 0;
    });
    
    return filtered;
  }, [currencyCategories]);

  // Все валюты из активных категорий (только активные валюты)
  const allCurrencies = useMemo(() => {
    const allFromCategories = activeCategories.flatMap(cat => cat.currencies || []);
    
    const activeCurrenciesList = allFromCategories.filter(curr => curr.is_active);
    
    // Убираем дубликаты по base_currency, оставляя валюту с большим profit_percentage
    const uniqueCurrenciesMap = new Map<string, Currency>();
    activeCurrenciesList.forEach(currency => {
      const existing = uniqueCurrenciesMap.get(currency.base_currency);
      if (!existing || (currency.profit_percentage ?? 0) > (existing.profit_percentage ?? 0)) {
        uniqueCurrenciesMap.set(currency.base_currency, currency);
      }
    });
    
    return Array.from(uniqueCurrenciesMap.values());
  }, [activeCategories]);

  // Подсчет валют по категориям (только активные валюты, с дедупликацией по base_currency)
  const categoryCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    activeCategories.forEach(cat => {
      const activeCurrencies = cat.currencies?.filter(curr => curr.is_active) || [];
      
      // Убираем дубликаты по base_currency (берем первую валюту для каждой базы)
      const seenBases = new Set<string>();
      const uniqueCurrencies = activeCurrencies.filter(curr => {
        const baseCurrency = curr.base_currency.toUpperCase();
        if (seenBases.has(baseCurrency)) {
          return false;
        }
        seenBases.add(baseCurrency);
        return true;
      });
      
      counts[cat.id] = uniqueCurrencies.length;
    });
    return counts;
  }, [activeCategories]);

  // Группировка валют по категориям для режима "All"
  const currenciesByCategory = useMemo(() => {
    if (selectedCategoryId !== null) {
      return null; // Не группируем, если выбрана конкретная категория
    }

    const grouped = new Map<number, { category: CurrencyCategory; currencies: Currency[] }>();
    
    activeCategories.forEach(category => {
      const categoryCurrencies = (category.currencies || [])
        .filter(curr => curr.is_active)
        .filter(curr => {
          // Фильтр по поиску
          if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            return curr.base_currency.toLowerCase().includes(query) ||
                   curr.display_name.toLowerCase().includes(query) ||
                   curr.symbol.toLowerCase().includes(query);
          }
          return true;
        });

      if (categoryCurrencies.length > 0) {
        // Сортировка по пейауту (по убыванию)
        categoryCurrencies.sort((a, b) => {
          const payoutA = a.profit_1m !== null && a.profit_1m !== undefined 
            ? a.profit_1m 
            : (a.profit_percentage !== null && a.profit_percentage !== undefined ? a.profit_percentage : -Infinity);
          
          const payoutB = b.profit_1m !== null && b.profit_1m !== undefined 
            ? b.profit_1m 
            : (b.profit_percentage !== null && b.profit_percentage !== undefined ? b.profit_percentage : -Infinity);
          
          return payoutB - payoutA;
        });

        grouped.set(category.id, {
          category,
          currencies: categoryCurrencies
        });
      }
    });

    // Сортируем категории по order
    return Array.from(grouped.values()).sort((a, b) => 
      (a.category.order || 0) - (b.category.order || 0)
    );
  }, [activeCategories, selectedCategoryId, searchQuery]);

  // Фильтрация валют по поиску и категории (для режима с выбранной категорией)
  const filteredCurrencies = useMemo(() => {
    if (selectedCategoryId === null) {
      return []; // В режиме "All" используем currenciesByCategory
    }

    let currencies = allCurrencies.filter(curr => curr.category_id === selectedCategoryId);

    // Фильтр по поиску
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      currencies = currencies.filter(curr => 
        curr.base_currency.toLowerCase().includes(query) ||
        curr.display_name.toLowerCase().includes(query) ||
        curr.symbol.toLowerCase().includes(query)
      );
    }

    // Сортировка по пейауту (по убыванию)
    currencies = [...currencies].sort((a, b) => {
      // Получаем пейаут для первой валюты (приоритет profit_1m, затем profit_percentage)
      const payoutA = a.profit_1m !== null && a.profit_1m !== undefined 
        ? a.profit_1m 
        : (a.profit_percentage !== null && a.profit_percentage !== undefined ? a.profit_percentage : -Infinity);
      
      // Получаем пейаут для второй валюты
      const payoutB = b.profit_1m !== null && b.profit_1m !== undefined 
        ? b.profit_1m 
        : (b.profit_percentage !== null && b.profit_percentage !== undefined ? b.profit_percentage : -Infinity);
      
      // Сортировка по убыванию (больший пейаут выше)
      return payoutB - payoutA;
    });

    return currencies;
  }, [allCurrencies, selectedCategoryId, searchQuery]);

  const handleCurrencySelect = (currency: Currency, event: React.MouseEvent) => {
    event.stopPropagation();
    // Устанавливаем currencyId в Redux и локальный state
    if (currency.id) {
      const currencyId = typeof currency.id === 'number' ? currency.id : parseInt(String(currency.id), 10);
      console.log('[ChartNavigationMenu] Устанавливаем currencyId', { 
        currency: `${currency.base_currency}_${currency.quote_currency}`, 
        currencyId 
      });
      // Устанавливаем в Redux (основной идентификатор)
      dispatch(setSelectedCurrencyId(currencyId));
      // Также устанавливаем в локальный state для совместимости
      if (setForcedCurrency) {
        setForcedCurrency(currencyId);
      }
    }
    // Передаем и base, и quote в onBaseChange для точной идентификации валютной пары
    if (currency.base_currency && currency.quote_currency) {
      onBaseChange(currency.base_currency, currency.quote_currency);
    } else {
      onBaseChange(currency.base_currency);
    }
    setSearchQuery('');
    // Меню не закрывается при выборе валютной пары
  };

  const handleCategorySelect = (categoryId: number | null) => {
    setSelectedCategoryId(categoryId);
  };

  // Проверяем необходимость прокрутки для фильтров
  const checkFiltersScrollButtons = React.useCallback(() => {
    if (!filtersRef.current) return;

    const container = filtersRef.current;
    const scrollLeftValue = container.scrollLeft;
    const scrollWidth = container.scrollWidth;
    const clientWidth = container.clientWidth;

    setShowFiltersLeftArrow(scrollLeftValue > 0);
    setShowFiltersRightArrow(scrollLeftValue < scrollWidth - clientWidth - 1);
  }, []);

  // Прокрутка фильтров влево
  const scrollFiltersLeft = React.useCallback(() => {
    if (!filtersRef.current) return;
    const container = filtersRef.current;
    const scrollAmount = 200;
    container.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
  }, []);

  // Прокрутка фильтров вправо
  const scrollFiltersRight = React.useCallback(() => {
    if (!filtersRef.current) return;
    const container = filtersRef.current;
    const scrollAmount = 200;
    container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    checkFiltersScrollButtons();
    const container = filtersRef.current;
    if (container) {
      container.addEventListener('scroll', checkFiltersScrollButtons);
      window.addEventListener('resize', checkFiltersScrollButtons);
      // Проверяем после небольшой задержки, чтобы убедиться, что элементы отрендерились
      const timeoutId = setTimeout(checkFiltersScrollButtons, 100);
      return () => {
        clearTimeout(timeoutId);
        container.removeEventListener('scroll', checkFiltersScrollButtons);
        window.removeEventListener('resize', checkFiltersScrollButtons);
      };
    }
  }, [checkFiltersScrollButtons, activeCategories.length]);

  const getCurrencyIcon = (currency: Currency): string | null => {
    if (resolveCurrencyIconUrls && getCurrencyInfo) {
      const info = getCurrencyInfo(currency.base_currency);
      const urls = resolveCurrencyIconUrls(info);
      return urls[0] || null;
    }
    return currency.icon || null;
  };

  return (
    <div className={`chart-navigation-menu ${isOpen ? 'open' : ''}`} ref={menuRef}>
      <div className="chart-navigation-menu__header">
        <h3 className="chart-navigation-menu__title">{t('trading.currencyControls.assetsTitle')}</h3>
        <button
          className="chart-navigation-menu__close"
          onClick={onClose}
          aria-label={t('trading.currencyControls.closeMenu')}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M12 4L4 12M4 4L12 12"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      <div className="chart-navigation-menu__content">
        {currenciesLoading ? (
          <div className="chart-navigation-menu__loading">{t('trading.currencyControls.loading')}</div>
        ) : (
          <>
            <div className="chart-navigation-menu__search">
              <div className="chart-navigation-menu__search-wrapper">
                <svg className="chart-navigation-menu__search-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M7.33333 12.6667C10.2789 12.6667 12.6667 10.2789 12.6667 7.33333C12.6667 4.38781 10.2789 2 7.33333 2C4.38781 2 2 4.38781 2 7.33333C2 10.2789 4.38781 12.6667 7.33333 12.6667Z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M14 14L11.1 11.1"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <input
                  type="text"
                  className="chart-navigation-menu__search-input"
                  placeholder={t('trading.currencyControls.searchCurrencyPair')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                />
                {searchQuery && (
                  <button
                    className="chart-navigation-menu__search-clear"
                    onClick={() => setSearchQuery('')}
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            {/* Фильтры-пилюли */}
            <div className="chart-navigation-menu__filters-wrapper">
              {showFiltersLeftArrow && (
                <button
                  className="chart-navigation-menu__filters-scroll-button chart-navigation-menu__filters-scroll-button--left"
                  onClick={scrollFiltersLeft}
                  aria-label={t('trading.currencyControls.scrollLeft')}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6"></polyline>
                  </svg>
                </button>
              )}
              <div className="chart-navigation-menu__filters" ref={filtersRef}>
                <button
                  className={`chart-navigation-menu__filter-pill ${
                    selectedCategoryId === null ? 'active' : ''
                  }`}
                  onClick={() => handleCategorySelect(null)}
                >
                  {t('trading.currencyControls.all')} ({allCurrencies.length})
                </button>
                {activeCategories.map(category => (
                  <button
                    key={category.id}
                    className={`chart-navigation-menu__filter-pill ${
                      selectedCategoryId === category.id ? 'active' : ''
                    }`}
                    onClick={() => handleCategorySelect(category.id)}
                  >
                    {category.name_en || category.name} ({categoryCounts[category.id] || 0})
                  </button>
                ))}
              </div>
              {showFiltersRightArrow && (
                <button
                  className="chart-navigation-menu__filters-scroll-button chart-navigation-menu__filters-scroll-button--right"
                  onClick={scrollFiltersRight}
                  aria-label={t('trading.currencyControls.scrollRight')}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </button>
              )}
            </div>

            {/* Список валют */}
            <div className="chart-navigation-menu__body">
              <div className="chart-navigation-menu__list">
                {/* Заголовки таблицы */}
                <div className="chart-navigation-menu__table-header">
                  <div className="chart-navigation-menu__header-cell chart-navigation-menu__header-cell--name">
                    {t('trading.currencyControls.asset')}
                  </div>
                  <div className="chart-navigation-menu__header-cell chart-navigation-menu__header-cell--price">
                    {t('trading.currencyControls.averagePrice24h')}
                  </div>
                  <div className="chart-navigation-menu__header-cell chart-navigation-menu__header-cell--profit">
                    {t('trading.currencyControls.profit30s')}
                  </div>
                </div>
                {selectedCategoryId === null && currenciesByCategory ? (
                  // Режим "All" - группировка по категориям
                  currenciesByCategory.length === 0 ? (
                    <div className="chart-navigation-menu__empty">
                      {searchQuery ? t('trading.currencyControls.currenciesNotFound') : t('trading.currencyControls.currenciesUnavailable')}
                    </div>
                  ) : (
                    currenciesByCategory.map(({ category, currencies }) => (
                      <div key={category.id} className="chart-navigation-menu__category-group">
                        <div className="chart-navigation-menu__category-header">
                          {category.name_en || category.name}
                        </div>
                        {currencies.map(currency => {
                          // Проверяем активное состояние: если есть forcedCurrency, используем ID, иначе base_currency
                          const isActive = forcedCurrency 
                            ? currency.id === forcedCurrency
                            : currency.base_currency === selectedBase;
                          
                          return (
                          <div
                            key={currency.id}
                            className={`chart-navigation-menu__item ${
                              isActive ? 'active' : ''
                            }`}
                            onClick={(e) => handleCurrencySelect(currency, e)}
                            onMouseDown={(e) => e.stopPropagation()}
                          >
                            <div className="chart-navigation-menu__item-cell chart-navigation-menu__item-cell--name">
                              <div className="chart-navigation-menu__item-icon">
                                {getCurrencyIcon(currency) ? (
                                  <img
                                    src={getCurrencyIcon(currency)!}
                                    alt={currency.base_currency}
                                    className="chart-navigation-menu__item-icon-img"
                                  />
                                ) : (
                                  <span className="chart-navigation-menu__item-icon-placeholder">
                                    {currency.base_currency.substring(0, 2)}
                                  </span>
                                )}
                              </div>
                              <div className="chart-navigation-menu__item-info">
                                <div className="chart-navigation-menu__item-name">{currency.symbol}</div>
                              </div>
                            </div>
                            <div className="chart-navigation-menu__item-cell chart-navigation-menu__item-cell--price">
                              {(() => {
                                // Сначала проверяем данные напрямую из объекта currency (данные с сервера)
                                const averagePrice = currency.average_price ?? currency.avg_price;
                                if (averagePrice !== null && averagePrice !== undefined && averagePrice > 0) {
                                  return formatPrice(averagePrice, currency.base_currency);
                                }
                                // Затем используем resolveCurrencyAveragePrice как fallback
                                if (resolveCurrencyAveragePrice) {
                                  const resolvedPrice = resolveCurrencyAveragePrice(currency.base_currency);
                                  if (resolvedPrice !== null && resolvedPrice > 0) {
                                    return formatPrice(resolvedPrice, currency.base_currency);
                                  }
                                }
                                return '--';
                              })()}
                            </div>
                            <div className="chart-navigation-menu__item-cell chart-navigation-menu__item-cell--profit">
                              {(() => {
                                // Сначала проверяем profit_1m (данные с сервера)
                                if (currency.profit_1m !== null && currency.profit_1m !== undefined) {
                                  return (
                                    <div className={`chart-navigation-menu__item-profit ${
                                      currency.profit_1m >= 0 ? 'positive' : 'negative'
                                    }`}>
                                      {formatPercent(currency.profit_1m)}
                                    </div>
                                  );
                                }
                                // Затем используем profit_percentage как fallback
                                if (currency.profit_percentage !== null && currency.profit_percentage !== undefined) {
                                  return (
                                    <div className={`chart-navigation-menu__item-profit ${
                                      currency.profit_percentage >= 0 ? 'positive' : 'negative'
                                    }`}>
                                      {formatPercent(currency.profit_percentage)}
                                    </div>
                                  );
                                }
                                return '—';
                              })()}
                            </div>
                          </div>
                          );
                        })}
                      </div>
                    ))
                  )
                ) : (
                  // Режим с выбранной категорией
                  filteredCurrencies.length === 0 ? (
                    <div className="chart-navigation-menu__empty">
                      {searchQuery ? t('trading.currencyControls.currenciesNotFound') : t('trading.currencyControls.currenciesUnavailable')}
                    </div>
                  ) : (
                    filteredCurrencies.map(currency => {
                      // Проверяем активное состояние: если есть forcedCurrency, используем ID, иначе base_currency
                      const isActive = forcedCurrency 
                        ? currency.id === forcedCurrency
                        : currency.base_currency === selectedBase;
                      
                      return (
                        <div
                          key={currency.id}
                          className={`chart-navigation-menu__item ${
                            isActive ? 'active' : ''
                          }`}
                          onClick={(e) => handleCurrencySelect(currency, e)}
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          <div className="chart-navigation-menu__item-cell chart-navigation-menu__item-cell--name">
                            <div className="chart-navigation-menu__item-icon">
                              {getCurrencyIcon(currency) ? (
                                <img
                                  src={getCurrencyIcon(currency)!}
                                  alt={currency.base_currency}
                                  className="chart-navigation-menu__item-icon-img"
                                />
                              ) : (
                                <span className="chart-navigation-menu__item-icon-placeholder">
                                  {currency.base_currency.substring(0, 2)}
                                </span>
                              )}
                            </div>
                            <div className="chart-navigation-menu__item-info">
                              <div className="chart-navigation-menu__item-name">{currency.symbol}</div>
                            </div>
                          </div>
                          <div className="chart-navigation-menu__item-cell chart-navigation-menu__item-cell--price">
                            {(() => {
                              // Сначала проверяем данные напрямую из объекта currency (данные с сервера)
                              const averagePrice = currency.average_price ?? currency.avg_price;
                              if (averagePrice !== null && averagePrice !== undefined && averagePrice > 0) {
                                return formatPrice(averagePrice, currency.base_currency);
                              }
                              // Затем используем resolveCurrencyAveragePrice как fallback
                              if (resolveCurrencyAveragePrice) {
                                const resolvedPrice = resolveCurrencyAveragePrice(currency.base_currency);
                                if (resolvedPrice !== null && resolvedPrice > 0) {
                                  return formatPrice(resolvedPrice, currency.base_currency);
                                }
                              }
                              return '--';
                            })()}
                          </div>
                          <div className="chart-navigation-menu__item-cell chart-navigation-menu__item-cell--profit">
                            {(() => {
                              // Сначала проверяем profit_1m (данные с сервера)
                              if (currency.profit_1m !== null && currency.profit_1m !== undefined) {
                                return (
                                  <div className={`chart-navigation-menu__item-profit ${
                                    currency.profit_1m >= 0 ? 'positive' : 'negative'
                                  }`}>
                                    {formatPercent(currency.profit_1m)}
                                  </div>
                                );
                              }
                              // Затем используем profit_percentage как fallback
                              if (currency.profit_percentage !== null && currency.profit_percentage !== undefined) {
                                return (
                                  <div className={`chart-navigation-menu__item-profit ${
                                    currency.profit_percentage >= 0 ? 'positive' : 'negative'
                                  }`}>
                                    {formatPercent(currency.profit_percentage)}
                                  </div>
                                );
                              }
                              return '—';
                            })()}
                          </div>
                        </div>
                      );
                    })
                  )
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

