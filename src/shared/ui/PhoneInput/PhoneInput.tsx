import React, { useState, useEffect } from 'react';
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';
import { useLanguage } from '@src/app/providers/useLanguage';
import { CountryFlag } from '@src/shared/ui/CountryFlag/CountryFlag';
import { detectUserCountry } from '@src/shared/lib/geolocation.util';
import { paymentMethodsApi } from '@src/shared/api';
import './PhoneInput.css';

interface PhoneInputProps {
  value?: string | null;
  onChange: (phone: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  error?: string;
  onValidationChange?: (isValid: boolean) => void;
  validateOnMount?: boolean;
}

interface CountryData {
  code: string;
  name: string;
  dialCode: string;
}

// Countries will be loaded from API

export const PhoneInput: React.FC<PhoneInputProps> = ({
  value,
  onChange,
  placeholder,
  required = false,
  disabled = false,
  className = '',
  error,
  onValidationChange,
  validateOnMount = false
}) => {
  const { t } = useLanguage();
  // Гарантируем, что value всегда строка с самого начала для контролируемого input
  const normalizedValue = value != null && value !== undefined ? String(value) : '';
  const [countries, setCountries] = useState<CountryData[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<CountryData | null>(null);
  // Гарантируем, что phoneNumber всегда строка, чтобы input был контролируемым
  // Используем пустую строку по умолчанию, чтобы избежать undefined
  const [phoneNumber, setPhoneNumber] = useState<string>(() => {
    const initialValue = value != null && value !== undefined ? String(value) : '';
    return initialValue || '';
  });
  const [showDropdown, setShowDropdown] = useState(false);
  const [isValid, setIsValid] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [validationError, setValidationError] = useState<string>('');
  const [hasBlurred, setHasBlurred] = useState(false);
  const [shouldValidate, setShouldValidate] = useState(false);
  const countryDetectionAttempted = React.useRef(false);

  // Синхронизируем phoneNumber с value prop
  useEffect(() => {
    const newValue = value != null && value !== undefined ? String(value) : '';
    // Обновляем только если значение действительно изменилось
    if (newValue !== phoneNumber) {
      setPhoneNumber(newValue || '');
    }
  }, [value]); // Убираем phoneNumber из зависимостей, чтобы избежать циклов

  // Инициализация страны по умолчанию с геолокацией (выполняется только при монтировании)
  // Load countries from API
  useEffect(() => {
    const loadCountries = async () => {
      try {
        const countriesList = await paymentMethodsApi.getAllCountries(true);
        // Filter out countries without dialCode
        const countriesWithDialCode = countriesList
          .filter((country): country is CountryData => !!country.dialCode)
          .map(country => ({
            code: country.code,
            name: country.name,
            dialCode: country.dialCode!
          }));
        setCountries(countriesWithDialCode);
      } catch (error) {
        console.error('Error loading countries for phone input:', error);
        // Fallback: set empty array, component will handle gracefully
        setCountries([]);
      }
    };
    loadCountries();
  }, []);

  useEffect(() => {
    // Если страна уже установлена или уже была попытка определения, не делаем ничего
    if (selectedCountry || countryDetectionAttempted.current || countries.length === 0) {
      return;
    }

    countryDetectionAttempted.current = true;
    
    const detectCountry = async () => {
      try {
        // Устанавливаем таймаут для геолокации (3 секунды)
        const geoPromise = detectUserCountry();
        const timeoutPromise = new Promise<null>((resolve) => 
          setTimeout(() => resolve(null), 3000)
        );
        
        const geoData = await Promise.race([geoPromise, timeoutPromise]);
        
        if (geoData?.countryCode) {
          const foundCountry = countries.find(c => c.code === geoData.countryCode);
          if (foundCountry) {
            setSelectedCountry(foundCountry);
            return;
          }
        }
        // Если геолокация не дала результата или превысила таймаут,
        // используем первую страну из списка (US) как fallback
        // чтобы пользователь мог сразу начать вводить номер
        if (countries.length > 0) {
          setSelectedCountry(countries[0]); // US по умолчанию
        }
      } catch (error) {
        console.error('Ошибка при определении страны:', error);
        // В случае ошибки используем первую страну из списка
        if (countries.length > 0) {
          setSelectedCountry(countries[0]);
        }
      }
    };
    
    detectCountry();
     
  }, [selectedCountry, countries]); // Добавляем countries в зависимости

  // Закрытие dropdown при клике вне его
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (showDropdown && !target.closest('.country-selector')) {
        setShowDropdown(false);
        setSearchQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  useEffect(() => {
    if (normalizedValue && selectedCountry && countries.length > 0) {
      try {
        const parsed = parsePhoneNumber(normalizedValue);
        if (parsed && parsed.country) {
          const country = countries.find(c => c.code === parsed.country);
          if (country) {
            setSelectedCountry(country);
          }
        }
      } catch (error) {
        // Ignore parsing errors
      }
    }
  }, [normalizedValue, selectedCountry, countries]);

  // Валидация номера телефона
  const validatePhoneNumber = React.useCallback((input: string, showErrors: boolean = false): { valid: boolean; error: string } => {
    if (!input || input.trim().length === 0) {
      if (required) {
        return { valid: false, error: showErrors ? 'Phone number is required' : '' };
      }
      return { valid: true, error: '' };
    }

    if (!selectedCountry) {
      if (showErrors) {
        return { valid: false, error: 'Please select a country first' };
      }
      return { valid: true, error: '' };
    }

    try {
      let numberToValidate = input;
      if (!input.startsWith('+')) {
        numberToValidate = selectedCountry.dialCode + input;
      }

      if (input.trim().length < 3) {
        if (showErrors) {
          return { valid: false, error: 'Phone number is too short' };
        }
        return { valid: true, error: '' };
      }

      const valid = isValidPhoneNumber(numberToValidate);
      if (!valid && showErrors) {
        if (!/^[\d\s\-\(\)]+$/.test(input)) {
          return { valid: false, error: 'Phone number contains invalid characters' };
        }
        return { valid: false, error: 'Invalid phone number format' };
      }

      return { valid, error: valid ? '' : (showErrors ? 'Invalid phone number format' : '') };
    } catch (error) {
      return { valid: false, error: showErrors ? 'Invalid phone number' : '' };
    }
  }, [selectedCountry, required]);

  // Обработка изменения номера
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    
    // Обновляем внутреннее состояние для отображения
    setPhoneNumber(input);

    // Автоматическое определение страны по номеру
    if (input.startsWith('+') && countries.length > 0) {
      try {
        const parsed = parsePhoneNumber(input);
        if (parsed && parsed.country) {
          const country = countries.find(c => c.code === parsed.country);
          if (country) {
            setSelectedCountry(country);
          }
        }
      } catch (error) {
        // Ignore parsing errors
      }
    }

    // Валидируем только если поле было в фокусе или требуется валидация
    // Но не показываем ошибки во время ввода, только после blur
    const showErrors = hasBlurred || shouldValidate;
    const validation = validatePhoneNumber(input, showErrors);

    setIsValid(validation.valid);
    setValidationError(validation.error);
    
    // Вызов callback с полным номером (включая код страны если нужно)
    let fullNumber = input;
    if (!input.startsWith('+') && selectedCountry && input !== '' && input.trim().length > 0) {
      fullNumber = selectedCountry.dialCode + input;
    } else if (input === '' || input.trim().length === 0) {
      fullNumber = '';
    }
    onChange(fullNumber);
    
    // Обновляем валидность для родительского компонента
    if (onValidationChange) {
      onValidationChange(validation.valid);
    }
  };

  // Обработка потери фокуса
  const handleBlur = () => {
    setHasBlurred(true);
    const validation = validatePhoneNumber(phoneNumber, true);
    setIsValid(validation.valid);
    setValidationError(validation.error);
    if (onValidationChange) {
      onValidationChange(validation.valid);
    }
  };

  // Валидация при попытке submit
  useEffect(() => {
    if (shouldValidate) {
      const validation = validatePhoneNumber(phoneNumber, true);
      setIsValid(validation.valid);
      setValidationError(validation.error);
      onValidationChange?.(validation.valid);
    }
  }, [shouldValidate, phoneNumber, validatePhoneNumber, onValidationChange]);

  // Метод для внешней валидации (вызывается из формы при submit)
  useEffect(() => {
    if (validateOnMount) {
      setShouldValidate(true);
    }
  }, [validateOnMount]);

  // Метод для внешней валидации (будет вызываться из формы)
  const validate = React.useCallback(() => {
    setShouldValidate(true);
    setHasBlurred(true);
    const validation = validatePhoneNumber(phoneNumber, true);
    setIsValid(validation.valid);
    setValidationError(validation.error);
    onValidationChange?.(validation.valid);
    return validation.valid;
  }, [phoneNumber, validatePhoneNumber, onValidationChange]);

  // Экспортируем метод валидации
  React.useEffect(() => {
    if (validateOnMount) {
      validate();
    }
  }, [validateOnMount, validate]);

  // Фильтрация стран по поисковому запросу
  const filteredCountries = countries.filter(country =>
    country.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    country.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    country.dialCode.includes(searchQuery)
  );

  // Обработка смены страны
  const handleCountryChange = (country: CountryData) => {
    setSelectedCountry(country);
    setShowDropdown(false);
    setSearchQuery('');
    
    // Получаем номер без кода страны
    // phoneNumber содержит либо полный номер с кодом, либо только номер без кода
    let numberWithoutCountry = '';
    
    if (phoneNumber.startsWith('+')) {
      // Если номер начинается с +, убираем старый код страны
      const oldDialCode = selectedCountry?.dialCode || '';
      if (phoneNumber.startsWith(oldDialCode)) {
        numberWithoutCountry = phoneNumber.substring(oldDialCode.length).trim();
      } else {
        // Пытаемся найти код страны в номере
        numberWithoutCountry = phoneNumber.replace(/^\+\d+/, '').trim();
      }
    } else {
      // Если номер не начинается с +, это уже номер без кода страны
      numberWithoutCountry = phoneNumber.trim();
    }
    
    // Если номер был пустым или содержал только код страны, просто обновляем код страны
    // и не валидируем, чтобы не показывать ошибку
    if (!numberWithoutCountry || numberWithoutCountry === '') {
      // Сбрасываем ошибки валидации при смене страны, если номер не введен
      setIsValid(true);
      setValidationError('');
      // Сбрасываем phoneNumber, чтобы поле было пустым
      setPhoneNumber('');
      onChange('');
      return;
    }
    
    // Если номер был введен, обновляем его с новым кодом страны
    const newNumber = country.dialCode + numberWithoutCountry;
    setPhoneNumber(newNumber);
    
    // Валидируем новый номер только если он был введен
    let valid = true;
    let errorMessage = '';
    
    if (numberWithoutCountry.length > 0) {
      try {
        valid = isValidPhoneNumber(newNumber);
        if (!valid) {
          errorMessage = 'Invalid phone number format';
        }
      } catch (error) {
        valid = false;
        errorMessage = 'Invalid phone number';
      }
    }
    
    setIsValid(valid);
    setValidationError(errorMessage);
    onChange(newNumber);
  };

  const formatDisplayNumber = (number: string | undefined | null): string => {
    // Гарантируем, что всегда возвращаем строку для контролируемого input
    if (!number || number === null || number === undefined || typeof number !== 'string') {
      return '';
    }
    try {
      if (selectedCountry && number.startsWith(selectedCountry.dialCode)) {
        const nationalNumber = number.substring(selectedCountry.dialCode.length);
        return typeof nationalNumber === 'string' ? nationalNumber : '';
      }
      const cleaned = number.replace(/^\+\d+\s*/, '');
      return typeof cleaned === 'string' ? cleaned : '';
    } catch (error) {
      return '';
    }
  };

  // Если страна ещё не определена, показываем загрузку
  if (!selectedCountry) {
    return (
      <div className={`phone-input-container ${className} loading`}>
        <div className="phone-input-wrapper">
          <div className="country-selector">
            <button type="button" className="country-button" disabled>
              <span className="flag">🌍</span>
              <span className="dial-code">+</span>
              <span className="arrow">▼</span>
            </button>
          </div>
          <input
            type="tel"
            placeholder="Loading..."
            disabled
            className="phone-input"
          />
        </div>
      </div>
    );
  }

  return (
    <div className={`phone-input-container ${className} ${error ? 'error' : ''} ${!isValid ? 'invalid' : ''}`}>
      <div className="phone-input-wrapper">
        {/* Dropdown для выбора страны */}
        <div className="country-selector">
          <button
            type="button"
            className="country-button"
            onClick={() => setShowDropdown(!showDropdown)}
            disabled={disabled}
            title={`Selected: ${selectedCountry.name} ${selectedCountry.dialCode}. Click to change country.`}
          >
            <CountryFlag countryCode={selectedCountry.code} size={20} className="flag" />
            <span className="country-code">{selectedCountry.code}</span>
            <span className="dial-code">{selectedCountry.dialCode}</span>
            <span className="arrow">▼</span>
          </button>

          {showDropdown && (
            <div className="country-dropdown">
              <div className="country-search">
                <input
                  type="text"
                  value={searchQuery ?? ''}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('common.search') || 'Search...'}
                  className="search-input"
                />
              </div>
              <div className="country-list">
                {filteredCountries.length > 0 ? (
                  filteredCountries.map((country) => (
                    <button
                      key={country.code}
                      type="button"
                      className={`country-option ${selectedCountry.code === country.code ? 'selected' : ''}`}
                      onClick={() => handleCountryChange(country)}
                    >
                      <CountryFlag countryCode={country.code} size={18} className="flag" />
                      <span className="country-name">{country.name}</span>
                      <span className="dial-code">{country.dialCode}</span>
                    </button>
                  ))
                ) : (
                  <div className="no-results">
                    No countries found
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Поле ввода номера */}
        <input
          type="tel"
          autoComplete="tel"
          value={formatDisplayNumber(phoneNumber ?? '')}
          onChange={handlePhoneChange}
          onBlur={handleBlur}
          placeholder={placeholder || t('profile.enterPhone') || 'Enter phone number'}
          required={required}
          disabled={disabled}
          className="phone-input"
        />
      </div>

      {/* Отображение ошибки */}
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {/* Отображение ошибки валидации */}
      {!isValid && phoneNumber && validationError && (
        <div className="error-message">
          {validationError}
        </div>
      )}
    </div>
  );
};
