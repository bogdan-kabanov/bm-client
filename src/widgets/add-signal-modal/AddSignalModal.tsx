import React, { useState, useEffect, useRef } from 'react';
import { currencyApi, type Currency, type CurrencyCategory } from '@src/shared/api';
import './AddSignalModal.css';

interface AddSignalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (pair: string, value: string, direction: 'up' | 'down', time: number) => Promise<void>;
  investmentAmount?: number;
}

export const AddSignalModal: React.FC<AddSignalModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  investmentAmount = 0
}) => {
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [isLoadingCurrencies, setIsLoadingCurrencies] = useState(false);
  const [selectedPair, setSelectedPair] = useState('');
  const [newSignalValue, setNewSignalValue] = useState('');
  const [newSignalDirection, setNewSignalDirection] = useState<'up' | 'down'>('up');
  const [newSignalTime, setNewSignalTime] = useState('30'); // Время в секундах
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Загружаем валюты при открытии модалки
  useEffect(() => {
    if (isOpen && currencies.length === 0) {
      loadCurrencies();
    }
  }, [isOpen]);

  // Устанавливаем значение инвестиции при открытии модалки
  useEffect(() => {
    if (isOpen && investmentAmount > 0) {
      setNewSignalValue(investmentAmount.toFixed(2));
    } else if (isOpen) {
      setNewSignalValue('');
    }
  }, [isOpen, investmentAmount]);

  // Сбрасываем форму при закрытии
  useEffect(() => {
    if (!isOpen) {
      setSelectedPair('');
      setNewSignalValue('');
      setNewSignalDirection('up');
      setNewSignalTime('30');
      setSearchQuery('');
      setIsDropdownOpen(false);
    }
  }, [isOpen]);

  // Закрытие при клике вне модалки
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  const loadCurrencies = async () => {
    setIsLoadingCurrencies(true);
    try {
      // API теперь всегда возвращает CurrencyCategory[] и использует кеш
      const categories = await currencyApi.getCurrenciesGrouped();

      // Собираем все валюты из всех категорий
      const allCurrencies: Currency[] = [];
      categories.forEach(category => {
        if (category.currencies && Array.isArray(category.currencies)) {
          category.currencies.forEach(currency => {
            if (currency && currency.base_currency) {
              allCurrencies.push(currency);
            }
          });
        }
      });

      // Удаляем дубликаты по base_currency
      const uniqueCurrencies = Array.from(
        new Map(allCurrencies.map(c => [c.base_currency, c])).values()
      );

      setCurrencies(uniqueCurrencies);
    } catch (error) {
      console.error('Ошибка загрузки валют:', error);
      setCurrencies([]);
    } finally {
      setIsLoadingCurrencies(false);
    }
  };

  const filteredCurrencies = currencies.filter(currency => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const base = currency.base_currency?.toLowerCase() || '';
    const quote = currency.quote_currency?.toLowerCase() || '';
    const bybitSymbol = currency.bybit_symbol?.toLowerCase() || '';
    return base.includes(query) || quote.includes(query) || bybitSymbol.includes(query);
  });

  const formatCurrencyPair = (currency: Currency): string => {
    const base = currency.base_currency || '';
    const quote = currency.quote_currency || 'USDT';
    // Проверяем, является ли валюта OTC по символу или названию категории
    const isOtc = currency.bybit_symbol?.includes('OTC') || 
                  currency.symbol?.includes('OTC') ||
                  currency.category?.name?.includes('OTC') ||
                  currency.category?.name_en?.includes('OTC');
    const suffix = isOtc ? ' (OTC)' : '';
    return `${base}/${quote}${suffix}`;
  };

  const handleSelectPair = (currency: Currency) => {
    setSelectedPair(formatCurrencyPair(currency));
    setIsDropdownOpen(false);
    setSearchQuery('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedPair) {
      return;
    }

    setIsSubmitting(true);
    try {
      const timeInSeconds = parseInt(newSignalTime, 10) || 30;
      await onSubmit(selectedPair, newSignalValue, newSignalDirection, timeInSeconds);
      onClose();
    } catch (error) {
      console.error('Ошибка при добавлении сигнала:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const selectedCurrency = currencies.find(c => formatCurrencyPair(c) === selectedPair);

  return (
    <div className="add-signal-modal-overlay" onClick={onClose}>
      <div className="add-signal-modal" onClick={(e) => e.stopPropagation()}>
        <div className="add-signal-modal-header">
          <h3 className="add-signal-modal-title">Добавить свой сигнал</h3>
          <button 
            className="add-signal-modal-close"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        
        <form className="add-signal-form" onSubmit={handleSubmit}>
          <div className="add-signal-form-group">
            <label htmlFor="signal-pair" className="add-signal-label">
              Торговая пара
            </label>
            <div className="add-signal-dropdown-wrapper" ref={dropdownRef}>
              <div 
                className="add-signal-dropdown-trigger"
                onClick={() => {
                  if (!isDropdownOpen) {
                    setIsDropdownOpen(true);
                  }
                }}
              >
                <input
                  ref={searchInputRef}
                  type="text"
                  className="add-signal-dropdown-input"
                  value={isDropdownOpen ? searchQuery : selectedPair}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (!isDropdownOpen) {
                      setIsDropdownOpen(true);
                    }
                  }}
                  onFocus={() => {
                    setIsDropdownOpen(true);
                    setSearchQuery('');
                  }}
                  placeholder="Выберите валютную пару"
                  readOnly={!isDropdownOpen}
                />
                <svg 
                  className={`add-signal-dropdown-arrow ${isDropdownOpen ? 'open' : ''}`}
                  width="20" 
                  height="20" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2"
                >
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </div>
              
              {isDropdownOpen && (
                <div className="add-signal-dropdown-menu">
                  {/* Поле поиска в выпадающем списке */}
                  <div className="add-signal-dropdown-search">
                    <input
                      type="text"
                      className="add-signal-dropdown-search-input"
                      placeholder="Поиск валютной пары..."
                      value={searchQuery}
                      onChange={(e) => {
                        e.stopPropagation();
                        setSearchQuery(e.target.value);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                    />
                  </div>
                  {isLoadingCurrencies ? (
                    <div className="add-signal-dropdown-loading">Загрузка валют...</div>
                  ) : filteredCurrencies.length === 0 ? (
                    <div className="add-signal-dropdown-empty">Валюты не найдены</div>
                  ) : (
                    <div className="add-signal-dropdown-list">
                      {filteredCurrencies.map((currency) => {
                        const pair = formatCurrencyPair(currency);
                        return (
                          <div
                            key={`${currency.base_currency}-${currency.quote_currency}`}
                            className={`add-signal-dropdown-item ${selectedPair === pair ? 'selected' : ''}`}
                            onClick={() => handleSelectPair(currency)}
                          >
                            {pair}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="add-signal-form-group">
            <label htmlFor="signal-value" className="add-signal-label">
              Сумма инвестиции
            </label>
            <input
              id="signal-value"
              type="number"
              className="add-signal-input"
              value={newSignalValue}
              onChange={(e) => setNewSignalValue(e.target.value)}
              placeholder="0.00"
              min="0"
              step="0.01"
              required
            />
          </div>

          <div className="add-signal-form-group">
            <label htmlFor="signal-time" className="add-signal-label">
              Время (секунды)
            </label>
            <input
              id="signal-time"
              type="number"
              className="add-signal-input"
              value={newSignalTime}
              onChange={(e) => setNewSignalTime(e.target.value)}
              placeholder="30"
              min="30"
              step="1"
              required
            />
          </div>

          <div className="add-signal-form-group">
            <label className="add-signal-label">Направление</label>
            <div className="add-signal-direction-buttons">
              <button
                type="button"
                className={`add-signal-direction-btn ${newSignalDirection === 'up' ? 'active' : ''}`}
                onClick={() => setNewSignalDirection('up')}
              >
                <span className="signal-direction up">⇑</span>
                Вверх
              </button>
              <button
                type="button"
                className={`add-signal-direction-btn ${newSignalDirection === 'down' ? 'active' : ''}`}
                onClick={() => setNewSignalDirection('down')}
              >
                <span className="signal-direction down">⇓</span>
                Вниз
              </button>
            </div>
          </div>

          <div className="add-signal-form-actions">
            <button
              type="button"
              className="add-signal-btn add-signal-btn--cancel"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="add-signal-btn add-signal-btn--submit"
              disabled={isSubmitting || !selectedPair}
            >
              {isSubmitting ? 'Добавление...' : 'Добавить сигнал'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

