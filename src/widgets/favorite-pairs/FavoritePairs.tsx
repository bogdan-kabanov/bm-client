import React, { useState, useRef, useEffect, useMemo, useCallback, useContext } from 'react';
import { useLanguage } from '@src/app/providers/useLanguage';
import { LanguageContext } from '@src/app/providers/LanguageProvider';
import { useCurrencyData } from '@src/features/trading-terminal/hooks/useCurrencyData';
import { useAppSelector, useAppDispatch } from '@src/shared/lib/hooks';
import { selectSelectedBase, selectSelectedCurrencyId } from '@src/entities/trading/model/selectors';
import { setSelectedBase, setSelectedCurrencyId } from '@src/entities/trading/model/slice';
import type { Currency, CurrencyCategory } from '@src/shared/api';
import { formatPrice, formatPercent } from '@src/features/trading-terminal/utils/formatUtils';
import './FavoritePairs.css';

export const FavoritePairs: React.FC = () => {
  // Используем контекст напрямую с проверкой для защиты от HMR ошибок
  const languageContext = useContext(LanguageContext);
  const t = languageContext?.t || ((key: string, params?: { defaultValue?: string }) => params?.defaultValue || key);
  const dispatch = useAppDispatch();
  const selectedBase = useAppSelector(selectSelectedBase); // Только для отображения
  const selectedCurrencyId = useAppSelector(selectSelectedCurrencyId); // Основной идентификатор
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const favoritesContainerRef = useRef<HTMLDivElement>(null);
  const categoryFiltersRef = useRef<HTMLDivElement>(null);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);
  const [showCategoryLeftArrow, setShowCategoryLeftArrow] = useState(false);
  const [showCategoryRightArrow, setShowCategoryRightArrow] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState<React.CSSProperties>({});

  const {
    currencyCategories,
    currenciesLoading,
    favoriteCurrencies,
    setFavoriteCurrencies,
    getCurrencyById,
    resolveCurrencyIconUrls,
    setForcedCurrency,
    forcedCurrency,
  } = useCurrencyData();

  // Группируем валютные пары по категориям
  const currencyPairsByCategory = useMemo(() => {
    const categoriesMap = new Map<number, {
      category: CurrencyCategory;
      pairs: Array<{ base: string; quote: string; currency: Currency }>;
    }>();

    for (const category of currencyCategories) {
      // Пропускаем неактивные категории
      if (category.is_active === false) {
        continue;
      }

      const pairs: Array<{ base: string; quote: string; currency: Currency }> = [];
      const list = category.currencies ?? [];

      for (const currency of list) {
        // Показываем только активные валюты (is_active === true)
        if (!currency?.base_currency || !currency?.quote_currency || currency.is_active !== true) {
          continue;
        }

        // Добавляем все валютные пары без дедупликации по base_currency
        pairs.push({
          base: currency.base_currency,
          quote: currency.quote_currency,
          currency,
        });
      }

      // Добавляем все активные категории, даже если в них нет валют с активными котировками
      categoriesMap.set(category.id, {
        category,
        pairs,
      });
    }

    // Сортируем категории по order
    return Array.from(categoriesMap.values()).sort((a, b) => 
      (a.category.order || 0) - (b.category.order || 0)
    );
  }, [currencyCategories]);

  // Все валютные пары (без группировки по категориям)
  const allPairs = useMemo(() => {
    return currencyPairsByCategory.flatMap(categoryData => 
      categoryData.pairs.map(pair => ({
        ...pair,
        categoryId: categoryData.category.id,
      }))
    );
  }, [currencyPairsByCategory]);

  // Фильтруем валютные пары по категории и поисковому запросу
  const filteredPairs = useMemo(() => {
    let pairs = allPairs;

    // Фильтр по категории
    if (selectedCategoryId !== null) {
      pairs = pairs.filter(pair => pair.categoryId === selectedCategoryId);
    }

    // Фильтр по поиску
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      pairs = pairs.filter(
        (pair) =>
          pair.base.toLowerCase().includes(query) ||
          pair.quote.toLowerCase().includes(query) ||
          `${pair.base}/${pair.quote}`.toLowerCase().includes(query)
      );
    }

    return pairs;
  }, [allPairs, selectedCategoryId, searchQuery]);

  // Подсчет количества валют по категориям
  const categoryCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    currencyPairsByCategory.forEach(categoryData => {
      counts[categoryData.category.id] = categoryData.pairs.length;
    });
    return counts;
  }, [currencyPairsByCategory]);

  // Получаем информацию об избранных валютных парах
  // favoriteCurrencies теперь хранит пары в формате BASE_QUOTE
  const favoritePairsInfo = useMemo(() => {
    return favoriteCurrencies.map((pairKey) => {
      // Парсим формат BASE_QUOTE или BASE/QUOTE
      const parts = pairKey.includes('_') ? pairKey.split('_') : pairKey.split('/');
      const base = parts[0] || '';
      const quote = parts[1] || 'USDT';
      
      // Ищем валюту по base и quote
      let currency: Currency | null = null;
      for (const category of currencyCategories) {
        const found = category.currencies?.find(
          (c) => c.base_currency === base && c.quote_currency === quote && c.is_active
        );
        if (found) {
          currency = found;
          break;
        }
      }
      
      return {
        base,
        quote,
        currency,
        pairKey, // Сохраняем оригинальный ключ для удаления
      };
    });
  }, [favoriteCurrencies, currencyCategories]);

  // Проверяем необходимость прокрутки
  const checkScrollButtons = useCallback(() => {
    if (!favoritesContainerRef.current) return;

    const container = favoritesContainerRef.current;
    const scrollLeftValue = container.scrollLeft;
    const scrollWidth = container.scrollWidth;
    const clientWidth = container.clientWidth;

    setScrollLeft(scrollLeftValue);
    setShowLeftArrow(scrollLeftValue > 0);
    setShowRightArrow(scrollLeftValue < scrollWidth - clientWidth - 1);
  }, []);

  // Проверяем необходимость прокрутки для фильтров категорий
  const checkCategoryScrollButtons = useCallback(() => {
    if (!categoryFiltersRef.current) return;

    const container = categoryFiltersRef.current;
    const scrollLeftValue = container.scrollLeft;
    const scrollWidth = container.scrollWidth;
    const clientWidth = container.clientWidth;

    setShowCategoryLeftArrow(scrollLeftValue > 0);
    setShowCategoryRightArrow(scrollLeftValue < scrollWidth - clientWidth - 1);
  }, []);

  useEffect(() => {
    checkScrollButtons();
    const container = favoritesContainerRef.current;
    if (container) {
      container.addEventListener('scroll', checkScrollButtons);
      window.addEventListener('resize', checkScrollButtons);
      // Проверяем после небольшой задержки, чтобы убедиться, что элементы отрендерились
      const timeoutId = setTimeout(checkScrollButtons, 100);
      return () => {
        clearTimeout(timeoutId);
        container.removeEventListener('scroll', checkScrollButtons);
        window.removeEventListener('resize', checkScrollButtons);
      };
    }
  }, [checkScrollButtons, favoritePairsInfo.length]);

  useEffect(() => {
    checkCategoryScrollButtons();
    const container = categoryFiltersRef.current;
    if (container) {
      container.addEventListener('scroll', checkCategoryScrollButtons);
      window.addEventListener('resize', checkCategoryScrollButtons);
      // Проверяем после небольшой задержки, чтобы убедиться, что элементы отрендерились
      const timeoutId = setTimeout(checkCategoryScrollButtons, 100);
      return () => {
        clearTimeout(timeoutId);
        container.removeEventListener('scroll', checkCategoryScrollButtons);
        window.removeEventListener('resize', checkCategoryScrollButtons);
      };
    }
  }, [checkCategoryScrollButtons, currencyPairsByCategory.length]);

  // Прокрутка влево
  const scrollLeftHandler = useCallback(() => {
    if (!favoritesContainerRef.current) return;
    const container = favoritesContainerRef.current;
    const scrollAmount = 200;
    container.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
  }, []);

  // Прокрутка вправо
  const scrollRightHandler = useCallback(() => {
    if (!favoritesContainerRef.current) return;
    const container = favoritesContainerRef.current;
    const scrollAmount = 200;
    container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  }, []);

  // Прокрутка категорий влево
  const scrollCategoryLeftHandler = useCallback(() => {
    if (!categoryFiltersRef.current) return;
    const container = categoryFiltersRef.current;
    const scrollAmount = 200;
    container.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
  }, []);

  // Прокрутка категорий вправо
  const scrollCategoryRightHandler = useCallback(() => {
    if (!categoryFiltersRef.current) return;
    const container = categoryFiltersRef.current;
    const scrollAmount = 200;
    container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  }, []);

  // Вычисление позиции попапа относительно границ экрана
  const calculateDropdownPosition = useCallback(() => {
    if (!dropdownRef.current || !menuRef.current || !isDropdownOpen) {
      return;
    }

    const buttonRect = dropdownRef.current.getBoundingClientRect();
    const dropdownRect = menuRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const margin = 16; // Отступ от края экрана
    const gap = 8; // Отступ между кнопкой и попапом

    // Используем реальные размеры попапа, если они доступны, иначе используем значения из CSS
    const dropdownWidth = dropdownRect.width > 0 ? dropdownRect.width : 550;
    const dropdownHeight = dropdownRect.height > 0 ? dropdownRect.height : 600;

    const position: React.CSSProperties = {};

    // Горизонтальное позиционирование (в координатах viewport для position: fixed)
    const spaceOnRight = viewportWidth - buttonRect.right;
    const spaceOnLeft = buttonRect.left;

    let leftPosition = buttonRect.left;

    if (spaceOnRight >= dropdownWidth + margin) {
      // Помещается справа - выравниваем по левому краю кнопки
      leftPosition = buttonRect.left;
    } else if (spaceOnLeft >= dropdownWidth + margin) {
      // Помещается слева - выравниваем по правому краю кнопки
      leftPosition = buttonRect.right - dropdownWidth;
    } else {
      // Не помещается ни справа, ни слева - выбираем сторону с большим пространством
      if (spaceOnRight > spaceOnLeft) {
        // Больше места справа - позиционируем справа, но ограничиваем по правому краю экрана
        leftPosition = Math.max(margin, viewportWidth - dropdownWidth - margin);
      } else {
        // Больше места слева - позиционируем слева, но ограничиваем по левому краю экрана
        leftPosition = Math.max(margin, buttonRect.right - dropdownWidth);
      }
    }

    // Убеждаемся, что попап не выходит за правый край экрана
    if (leftPosition + dropdownWidth > viewportWidth - margin) {
      leftPosition = viewportWidth - dropdownWidth - margin;
    }

    // Убеждаемся, что попап не выходит за левый край экрана
    if (leftPosition < margin) {
      leftPosition = margin;
    }

    position.left = `${leftPosition}px`;
    position.right = 'auto';

    // Вертикальное позиционирование
    const spaceBelow = viewportHeight - buttonRect.bottom;
    const spaceAbove = buttonRect.top;

    if (spaceBelow >= dropdownHeight + gap + margin) {
      // Помещается снизу
      position.top = `${buttonRect.bottom + gap}px`;
      position.bottom = 'auto';
    } else if (spaceAbove >= dropdownHeight + gap + margin) {
      // Помещается сверху - позиционируем попап над кнопкой
      // top = верхний край кнопки - высота попапа - gap
      position.top = `${buttonRect.top - dropdownHeight - gap}px`;
      position.bottom = 'auto';
    } else {
      // Не помещается ни сверху, ни снизу - выбираем сторону с большим пространством
      if (spaceBelow > spaceAbove) {
        let topPosition = buttonRect.bottom + gap;
        // Ограничиваем по нижнему краю экрана
        const maxTop = viewportHeight - dropdownHeight - margin;
        if (topPosition > maxTop) {
          topPosition = maxTop;
        }
        position.top = `${topPosition}px`;
        position.bottom = 'auto';
      } else {
        // Позиционируем сверху, но ограничиваем по верхнему краю экрана
        let topPosition = buttonRect.top - dropdownHeight - gap;
        const minTop = margin;
        if (topPosition < minTop) {
          topPosition = minTop;
        }
        position.top = `${topPosition}px`;
        position.bottom = 'auto';
      }
    }

    setDropdownPosition(position);
  }, [isDropdownOpen]);

  // Пересчет позиции при открытии попапа и изменении размера окна
  useEffect(() => {
    if (!isDropdownOpen || !menuRef.current) {
      return;
    }

    // Небольшая задержка для того, чтобы попап успел отрендериться
    const timeoutId = setTimeout(() => {
      calculateDropdownPosition();
    }, 0);

    window.addEventListener('resize', calculateDropdownPosition);
    window.addEventListener('scroll', calculateDropdownPosition, true);

    // Отслеживание изменений размера попапа
    const resizeObserver = new ResizeObserver(() => {
      calculateDropdownPosition();
    });

    if (menuRef.current) {
      resizeObserver.observe(menuRef.current);
    }

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', calculateDropdownPosition);
      window.removeEventListener('scroll', calculateDropdownPosition, true);
      resizeObserver.disconnect();
    };
  }, [isDropdownOpen, calculateDropdownPosition, filteredPairs.length, selectedCategoryId]);

  // Закрытие выпадающего списка при клике вне его
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isClickInsideDropdown = dropdownRef.current?.contains(target);
      const isClickInsideMenu = menuRef.current?.contains(target);
      
      if (!isClickInsideDropdown && !isClickInsideMenu) {
        setIsDropdownOpen(false);
        setSearchQuery('');
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Фокусируем поле поиска при открытии
      if (searchInputRef.current) {
        setTimeout(() => {
          searchInputRef.current?.focus();
        }, 100);
      }
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  // Сбрасываем поиск и категорию при закрытии
  useEffect(() => {
    if (!isDropdownOpen) {
      setSearchQuery('');
      setSelectedCategoryId(null);
    }
  }, [isDropdownOpen]);

  // Добавление в избранное (теперь используем формат BASE_QUOTE)
  const handleAddFavorite = useCallback(
    (baseCurrency: string, quoteCurrency: string, event?: React.MouseEvent) => {
      if (event) {
        event.stopPropagation();
      }
      // Создаем уникальный ключ в формате BASE_QUOTE
      const pairKey = `${baseCurrency}_${quoteCurrency}`;
      if (favoriteCurrencies.includes(pairKey)) {
        return;
      }
      if (favoriteCurrencies.length >= 6) {
        return;
      }
      setFavoriteCurrencies([...favoriteCurrencies, pairKey]);
    },
    [favoriteCurrencies, setFavoriteCurrencies]
  );

  // Удаление из избранного (теперь используем формат BASE_QUOTE)
  const handleRemoveFavorite = useCallback(
    (baseCurrency: string, quoteCurrency: string) => {
      const pairKey = `${baseCurrency}_${quoteCurrency}`;
      setFavoriteCurrencies(favoriteCurrencies.filter((key) => key !== pairKey));
    },
    [favoriteCurrencies, setFavoriteCurrencies]
  );

  // Выбор валютной пары - работает ТОЛЬКО по ID
  const handlePairSelect = useCallback(
    (baseCurrency: string, quoteCurrency: string) => {
      console.log('[FavoritePairs] handlePairSelect вызван', { 
        baseCurrency, 
        quoteCurrency, 
        selectedCurrencyId,
        currentForcedCurrency: forcedCurrency
      });
      
      // Находим валюту по base+quote и получаем её ID
      let currencyId: number | null = null;
      for (const category of currencyCategories) {
        const list = category.currencies ?? [];
        const found = list.find(
          (c) => 
            c.base_currency.toUpperCase() === baseCurrency.toUpperCase() && 
            c.quote_currency.toUpperCase() === quoteCurrency.toUpperCase() && 
            c.is_active
        );
        if (found?.id) {
          currencyId = typeof found.id === 'number' ? found.id : parseInt(String(found.id), 10);
          break;
        }
      }
      
      if (currencyId) {
        console.log('[FavoritePairs] Устанавливаем currencyId', { baseCurrency, quoteCurrency, currencyId });
        // Устанавливаем ID валютной пары в Redux (основной идентификатор)
        dispatch(setSelectedCurrencyId(currencyId));
        // Также устанавливаем в локальный state для совместимости
        setForcedCurrency(currencyId);
        // Обновляем selectedBase только для отображения symbol
        dispatch(setSelectedBase(baseCurrency));
      } else {
        console.warn('[FavoritePairs] Не удалось найти валюту', { baseCurrency, quoteCurrency });
      }
      
      console.log('[FavoritePairs] handlePairSelect завершен', { 
        baseCurrency, 
        quoteCurrency,
        currencyId,
        currencyIdSet: !!currencyId
      });
    },
    [dispatch, selectedCurrencyId, setForcedCurrency, forcedCurrency, currencyCategories]
  );

  return (
    <div className="favorite-pairs" ref={dropdownRef}>
      {/* Кнопка добавления */}
      <button
        className="favorite-pairs__add-button"
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        aria-label={t('trading.addFavoritePair', { defaultValue: 'Добавить избранную пару' })}
      >
        <svg
          className="favorite-pairs__add-icon"
          width="100%"
          height="100%"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ display: "block" }}
        >
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </button>

      {/* Выпадающий список */}
      {isDropdownOpen && (
        <div 
          className="favorite-pairs__dropdown" 
          ref={menuRef}
          style={dropdownPosition}
        >
          {/* Заголовок */}
          <div className="favorite-pairs__header">
            <h3 className="favorite-pairs__title">{t('trading.favoritePairsTitle', { defaultValue: 'Избранные' })}</h3>
            <button
              className="favorite-pairs__close-button"
              onClick={() => setIsDropdownOpen(false)}
              aria-label={t('common.close', { defaultValue: 'Закрыть' })}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          {/* Поисковая строка */}
          <div className="favorite-pairs__search">
            <div className="favorite-pairs__search-wrapper">
              <svg className="favorite-pairs__search-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
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
                ref={searchInputRef}
                type="text"
                className="favorite-pairs__search-input"
                placeholder={t('trading.searchPairs', { defaultValue: 'Search currency pairs...' })}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                autoFocus
              />
              {searchQuery && (
                <button
                  className="favorite-pairs__search-clear"
                  onClick={() => setSearchQuery('')}
                >
                  ×
                </button>
              )}
            </div>
          </div>

          <div className="favorite-pairs__dropdown-content">
            {/* Фильтры-пилюли для категорий */}
            {!currenciesLoading && currencyPairsByCategory.length > 0 && (
              <div className="favorite-pairs__category-filters-wrapper">
                {showCategoryLeftArrow && (
                  <button
                    className="favorite-pairs__category-scroll-button favorite-pairs__category-scroll-button--left"
                    onClick={scrollCategoryLeftHandler}
                    aria-label={t('common.scrollLeft', { defaultValue: 'Прокрутить влево' })}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15 18 9 12 15 6"></polyline>
                    </svg>
                  </button>
                )}
                <div className="favorite-pairs__category-filters" ref={categoryFiltersRef}>
                  <button
                    className={`favorite-pairs__category-filter-pill ${selectedCategoryId === null ? 'active' : ''}`}
                    onClick={() => setSelectedCategoryId(null)}
                  >
                    All {allPairs.length}
                  </button>
                  {currencyPairsByCategory.map((categoryData) => (
                    <button
                      key={categoryData.category.id}
                      className={`favorite-pairs__category-filter-pill ${selectedCategoryId === categoryData.category.id ? 'active' : ''}`}
                      onClick={() => setSelectedCategoryId(categoryData.category.id)}
                    >
                      {categoryData.category.name_en || categoryData.category.name} {categoryCounts[categoryData.category.id] || 0}
                    </button>
                  ))}
                </div>
                {showCategoryRightArrow && (
                  <button
                    className="favorite-pairs__category-scroll-button favorite-pairs__category-scroll-button--right"
                    onClick={scrollCategoryRightHandler}
                    aria-label={t('common.scrollRight', { defaultValue: 'Прокрутить вправо' })}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                  </button>
                )}
              </div>
            )}

            {/* Таблица валют */}
            {currenciesLoading ? (
              <div className="favorite-pairs__loading">
                {t('common.loading', { defaultValue: 'Загрузка...' })}
              </div>
            ) : filteredPairs.length > 0 ? (
              <div className="favorite-pairs__table-wrapper">
                <div className="favorite-pairs__table">
                  {/* Заголовки таблицы */}
                  <div className="favorite-pairs__table-header">
                    <div className="favorite-pairs__table-header-cell favorite-pairs__table-header--asset">
                      {t('trading.currencyControls.asset', { defaultValue: 'Asset' })}
                    </div>
                    <div className="favorite-pairs__table-header-cell favorite-pairs__table-header--price">
                      {t('trading.currencyControls.averagePrice24h', { defaultValue: 'Average Price (24h)' })}
                    </div>
                    <div className="favorite-pairs__table-header-cell favorite-pairs__table-header--profit">
                      {t('trading.currencyControls.profit30s', { defaultValue: 'Profit 30s+' })}
                    </div>
                  </div>
                  {/* Строки таблицы */}
                  {filteredPairs.map((pair) => {
                    const pairKey = `${pair.base}_${pair.quote}`;
                    const isFavorite = favoriteCurrencies.includes(pairKey);
                    const iconUrls = pair.currency ? resolveCurrencyIconUrls(pair.currency) : [];
                    const averagePrice = pair.currency 
                      ? (pair.currency.average_price ?? pair.currency.avg_price ?? null)
                      : null;
                    const profitPercentage = pair.currency?.profit_percentage ?? null;
                    const displayName = pair.currency?.display_name || pair.base;
                    
                      // Проверяем, является ли эта пара активной ТОЛЬКО по ID
                      let isActive = false;
                      const currentCurrencyId = forcedCurrency || selectedCurrencyId;
                      if (currentCurrencyId && pair.currency?.id) {
                        // Сравниваем ID напрямую - это единственный надежный способ
                        const pairId = typeof pair.currency.id === 'number' ? pair.currency.id : parseInt(String(pair.currency.id), 10);
                        isActive = pairId === currentCurrencyId;
                      }
                      
                      return (
                      <div
                        key={pair.currency?.id ?? `${pair.base}_${pair.quote}`}
                        className={`favorite-pairs__table-row ${isFavorite ? 'is-favorite' : ''} ${isActive ? 'active' : ''}`}
                        onClick={() => {
                          handlePairSelect(pair.base, pair.quote);
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <div className="favorite-pairs__table-cell favorite-pairs__table-cell--asset">
                          <div className="favorite-pairs__asset-info">
                            <div className="favorite-pairs__pair-icon">
                              {iconUrls.length > 0 ? (
                                <img 
                                  src={iconUrls[0]} 
                                  alt={pair.base} 
                                  className="favorite-pairs__pair-icon-img"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                  }} 
                                />
                              ) : (
                                <span className="favorite-pairs__pair-icon-fallback">{pair.base.substring(0, 2)}</span>
                              )}
                            </div>
                            <div className="favorite-pairs__asset-details">
                              <div className="favorite-pairs__asset-name">{pair.currency?.symbol || displayName}</div>
                            </div>
                            {!isFavorite && favoriteCurrencies.length < 6 && (
                              <button
                                className="favorite-pairs__add-favorite-button"
                                onClick={(e) => handleAddFavorite(pair.base, pair.quote, e)}
                                aria-label={t('trading.addToFavorites', { defaultValue: 'Add to favorites' })}
                                title={t('trading.addToFavorites', { defaultValue: 'Add to favorites' })}
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <line x1="12" y1="5" x2="12" y2="19"></line>
                                  <line x1="5" y1="12" x2="19" y2="12"></line>
                                </svg>
                              </button>
                            )}
                            {isFavorite && (
                              <button
                                className="favorite-pairs__remove-favorite-button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveFavorite(pair.base, pair.quote);
                                }}
                                aria-label={t('trading.removeFromFavorites', { defaultValue: 'Remove from favorites' })}
                                title={t('trading.removeFromFavorites', { defaultValue: 'Remove from favorites' })}
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                                </svg>
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="favorite-pairs__table-cell favorite-pairs__table-cell--price">
                          {averagePrice !== null && averagePrice > 0 ? (
                            <span className="favorite-pairs__price-value">
                              {formatPrice(averagePrice, pair.base)}
                            </span>
                          ) : (
                            <span className="favorite-pairs__price-value">--</span>
                          )}
                        </div>
                        <div className="favorite-pairs__table-cell favorite-pairs__table-cell--profit">
                          {profitPercentage !== null ? (
                            <span className={`favorite-pairs__profit-value ${profitPercentage >= 0 ? 'positive' : 'negative'}`}>
                              {formatPercent(profitPercentage)}
                            </span>
                          ) : (
                            <span className="favorite-pairs__profit-value">—</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="favorite-pairs__no-results">
                {t('trading.noPairsFound', { defaultValue: 'Валютные пары не найдены' })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Блок избранных пар */}
      {favoritePairsInfo.length > 0 && (
        <div className="favorite-pairs__favorites-wrapper">
          {/* Стрелка влево */}
          {showLeftArrow && (
            <button
              className="favorite-pairs__scroll-button favorite-pairs__scroll-button--left"
              onClick={scrollLeftHandler}
              aria-label={t('common.scrollLeft', { defaultValue: 'Прокрутить влево' })}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </button>
          )}

          {/* Контейнер с карточками */}
          <div className="favorite-pairs__favorites-container" ref={favoritesContainerRef}>
            {favoritePairsInfo.map((pairInfo) => {
              const iconUrls = pairInfo.currency ? resolveCurrencyIconUrls(pairInfo.currency) : [];
              // Проверяем, является ли эта пара активной ТОЛЬКО по ID
              let isActive = false;
              const currentCurrencyId = forcedCurrency || selectedCurrencyId;
              if (currentCurrencyId && pairInfo.currency?.id) {
                // Сравниваем ID напрямую - это единственный надежный способ
                const pairId = typeof pairInfo.currency.id === 'number' ? pairInfo.currency.id : parseInt(String(pairInfo.currency.id), 10);
                isActive = pairId === currentCurrencyId;
              }
              
              return (
                <div
                  key={pairInfo.currency?.id ?? `${pairInfo.base}_${pairInfo.quote}`}
                  className={`favorite-pairs__favorite-card ${isActive ? 'is-active' : ''}`}
                  data-base={pairInfo.base}
                  onClick={(e) => {
                    console.log('[FavoritePairs] Клик по карточке', { base: pairInfo.base, quote: pairInfo.quote, currentBase: selectedBase });
                    handlePairSelect(pairInfo.base, pairInfo.quote);
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handlePairSelect(pairInfo.base, pairInfo.quote);
                    }
                  }}
                >
                  <div className="favorite-pairs__favorite-icon">
                    {iconUrls.length > 0 ? (
                      <img src={iconUrls[0]} alt={pairInfo.base} onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }} />
                    ) : (
                      <span className="favorite-pairs__favorite-icon-fallback">{pairInfo.base[0]}</span>
                    )}
                  </div>
                  <span className="favorite-pairs__favorite-name">{pairInfo.currency?.symbol || `${pairInfo.base}/${pairInfo.quote}`}</span>
                  <button
                    className="favorite-pairs__favorite-remove"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveFavorite(pairInfo.base, pairInfo.quote);
                    }}
                    aria-label={t('trading.removeFavorite', { defaultValue: 'Удалить из избранного' })}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>

          {/* Стрелка вправо */}
          {showRightArrow && (
            <button
              className="favorite-pairs__scroll-button favorite-pairs__scroll-button--right"
              onClick={scrollRightHandler}
              aria-label={t('common.scrollRight', { defaultValue: 'Прокрутить вправо' })}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
};


