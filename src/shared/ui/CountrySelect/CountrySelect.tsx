import React, { useState, useRef, useEffect } from 'react';
import './CountrySelect.css';

interface Country {
  code: string;
  name: string;
}

interface CountrySelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Country[];
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
}

export const CountrySelect: React.FC<CountrySelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Выберите страну',
  disabled = false,
  loading = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && containerRef.current && dropdownRef.current) {
      const updatePosition = () => {
        const container = containerRef.current;
        const dropdown = dropdownRef.current;
        if (!container || !dropdown) return;

        const containerRect = container.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;
        const maxDropdownHeight = 300;
        const spaceBelow = viewportHeight - containerRect.bottom;
        
        // Вычисляем максимальную высоту с учетом доступного пространства снизу
        // Минимальная высота - 150px (чтобы было видно хотя бы несколько элементов)
        // Отступ снизу - 10px от края экрана
        const minHeight = 150;
        const padding = 10;
        const availableHeight = Math.max(minHeight, spaceBelow - padding);
        const maxHeight = Math.min(maxDropdownHeight, availableHeight);

        // Проверяем горизонтальные границы
        let left = 0;
        let width = containerRect.width;

        if (containerRect.left + width > viewportWidth) {
          const overflow = (containerRect.left + width) - viewportWidth;
          left = -overflow;
          width = Math.min(width, viewportWidth - containerRect.left);
        }

        if (containerRect.left < 0) {
          const overflow = -containerRect.left;
          left = overflow;
          width = Math.min(width, containerRect.width - overflow);
        }

        dropdown.style.maxHeight = `${maxHeight}px`;
        if (left !== 0) {
          dropdown.style.left = `${left}px`;
        }
        if (width !== containerRect.width) {
          dropdown.style.width = `${width}px`;
        }
      };

      const timeoutId = setTimeout(updatePosition, 0);
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);

      return () => {
        clearTimeout(timeoutId);
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [isOpen, searchTerm]);

  const filteredOptions = options.filter(option =>
    option.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    option.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedOption = options.find(opt => opt.code === value);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearchTerm('');
  };

  if (loading) {
    return (
      <div className="country-select">
        <div className="country-select__trigger country-select__trigger--loading" disabled>
          <span className="country-select__placeholder">{placeholder}</span>
          <span className="country-select__arrow">▼</span>
        </div>
      </div>
    );
  }

  return (
    <div className="country-select" ref={containerRef}>
      <div
        className={`country-select__trigger ${disabled ? 'country-select__trigger--disabled' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <span className={selectedOption ? '' : 'country-select__placeholder'}>
          {selectedOption ? selectedOption.name : placeholder}
        </span>
        <span className="country-select__arrow">{isOpen ? '▲' : '▼'}</span>
      </div>

      {isOpen && (
        <div 
          ref={dropdownRef}
          className="country-select__dropdown"
        >
          <div className="country-select__search">
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Поиск страны..."
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div className="country-select__options">
            {filteredOptions.length === 0 ? (
              <div className="country-select__no-results">Ничего не найдено</div>
            ) : (
              filteredOptions.map((option) => (
                <div
                  key={option.code}
                  className={`country-select__option ${value === option.code ? 'country-select__option--selected' : ''}`}
                  onClick={() => handleSelect(option.code)}
                >
                  {option.name}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

