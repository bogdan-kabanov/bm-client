import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { languages, LanguageInfo } from '../lib/languages';
import { useLanguage } from '@/src/app/providers/useLanguage';
import { useMediaQuery } from '../lib/hooks/useMediaQuery';
import styles from './LanguageDropdown.module.css';

interface LanguageDropdownProps {
  variant?: 'default' | 'trading';
  renderMenuInPortal?: boolean;
}

export const LanguageDropdown: React.FC<LanguageDropdownProps> = React.memo(({ variant = 'default', renderMenuInPortal = false }) => {
  const { language, setLanguage, t } = useLanguage();
  const isMobile = useMediaQuery('(max-width: 1024px)');
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [menuPosition, setMenuPosition] = useState<{ right?: number | string; left?: number | string; bottom?: string; top?: string; maxHeight?: string; width?: string }>({});
  const [portalPosition, setPortalPosition] = useState<{ top: number; left: number } | null>(null);

  // Мемоизируем currentLanguage для предотвращения ререндеров
  const currentLanguage = useMemo(() => 
    languages.find(lang => lang.code === language) || languages[0],
    [language]
  );

  // Фильтруем языки по поисковому запросу
  const filteredLanguages = useMemo(() => {
    if (!searchQuery.trim()) {
      return languages;
    }
    const query = searchQuery.toLowerCase().trim();
    return languages.filter(lang => 
      lang.name.toLowerCase().includes(query) ||
      lang.nativeName.toLowerCase().includes(query) ||
      lang.code.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  // Определяем количество колонок: на мобильных - 1, на десктопе - 3
  const columnCount = isMobile ? 1 : 3;

  // Разбиваем отфильтрованные языки на колонки
  const columns = useMemo(() => {
    const chunkSize = Math.ceil(filteredLanguages.length / columnCount);
    const newColumns: LanguageInfo[][] = [];
    for (let i = 0; i < columnCount; i++) {
      newColumns.push(filteredLanguages.slice(i * chunkSize, (i + 1) * chunkSize));
    }
    return newColumns;
  }, [filteredLanguages, columnCount]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isClickInsideDropdown = dropdownRef.current?.contains(target);
      const isClickInsideMenu = menuRef.current?.contains(target);
      
      if (!isClickInsideDropdown && !isClickInsideMenu) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Фокусируем поле поиска при открытии на мобильных
      if (isMobile && searchInputRef.current) {
        setTimeout(() => {
          searchInputRef.current?.focus();
        }, 100);
      }
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, isMobile]);

  // Сбрасываем поиск при закрытии
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setPortalPosition(null);
    }
  }, [isOpen]);

  // Вычисляем позицию для portal сразу при открытии
  useEffect(() => {
    if (isOpen && renderMenuInPortal && dropdownRef.current) {
      const calculatePortalPosition = () => {
        if (!dropdownRef.current) return;
        
        const dropdownRect = dropdownRef.current.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const menuWidth = isMobile 
          ? Math.min(viewportWidth - 16, 320)
          : Math.min(columnCount * 120 + (columnCount - 1) * 12 + 24, viewportWidth - 16);
        
        const leftPosition = Math.max(8, dropdownRect.right - menuWidth);
        
        setPortalPosition({
          top: dropdownRect.bottom + 8,
          left: leftPosition
        });
      };

      // Вычисляем сразу и с небольшой задержкой для надежности
      calculatePortalPosition();
      requestAnimationFrame(() => {
        calculatePortalPosition();
      });
    }
  }, [isOpen, renderMenuInPortal, isMobile, columnCount]);

  // Расчет позиции выпадающего списка для предотвращения выхода за пределы экрана
  useEffect(() => {
    if (!isOpen || !dropdownRef.current) {
      setMenuPosition({});
      setPortalPosition(null);
      return;
    }

    const calculatePosition = () => {
      if (!dropdownRef.current) return;

      const dropdownRect = dropdownRef.current.getBoundingClientRect();
      
      // Если рендерим через portal, вычисляем абсолютную позицию
      if (renderMenuInPortal) {
        // Вычисляем позицию относительно правого края для выравнивания
        const viewportWidth = window.innerWidth;
        const menuWidth = isMobile 
          ? Math.min(viewportWidth - 16, 320)
          : Math.min(columnCount * 120 + (columnCount - 1) * 12 + 24, viewportWidth - 16);
        
        // Выравниваем по правому краю триггера
        const leftPosition = Math.max(8, dropdownRect.right - menuWidth);
        
        setPortalPosition({
          top: dropdownRect.bottom + 8,
          left: leftPosition
        });
        
        // Для portal-режима также устанавливаем базовые стили для меню
        setMenuPosition({
          width: `${menuWidth}px`,
          maxHeight: '400px'
        });
        return; // Выходим раньше, так как для portal не нужна относительная позиция
      }

      if (!menuRef.current) return;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const padding = 8; // Отступ от края экрана
      const gap = 8; // Отступ между триггером и меню
      const itemHeight = 36; // Примерная высота одного элемента языка
      const searchHeight = isMobile ? 48 : 0; // Высота поля поиска на мобильных
      const menuPadding = 12; // padding меню
      const columnGap = isMobile ? 0 : 12; // gap между колонками

      // Рассчитываем доступное пространство
      const spaceBelow = viewportHeight - dropdownRect.bottom - gap - padding;
      const spaceOnRight = viewportWidth - dropdownRect.right - padding;
      const spaceOnLeft = dropdownRect.left - padding;
      const spaceAbove = dropdownRect.top - gap - padding;

      // На мобильных используем всю ширину экрана с отступами
      const menuWidth = isMobile 
        ? Math.min(viewportWidth - padding * 2, 320)
        : Math.min(columnCount * 120 + (columnCount - 1) * columnGap + menuPadding * 2, viewportWidth - padding * 2);

      const position: { right?: number | string; left?: number | string; bottom?: string; top?: string; maxHeight?: string; width?: string } = {};

      // Горизонтальное позиционирование
      if (isMobile) {
        // На мобильных центрируем относительно триггера, но не выходим за пределы экрана
        const triggerCenter = dropdownRect.left + dropdownRect.width / 2;
        const menuLeftOffset = Math.max(
          padding - dropdownRect.left, // Минимум - отступ от левого края экрана
          Math.min(
            triggerCenter - menuWidth / 2 - dropdownRect.left, // Центрируем относительно триггера
            viewportWidth - menuWidth - padding - dropdownRect.left // Не выходим за правый край
          )
        );
        position.left = `${menuLeftOffset}px`;
        position.right = 'auto';
        position.width = `${menuWidth}px`;
      } else {
        // На десктопе используем стандартную логику
        if (spaceOnRight >= menuWidth + padding) {
          position.left = 0;
          position.right = 'auto';
        } else if (spaceOnLeft >= menuWidth + padding) {
          position.right = 0;
          position.left = 'auto';
        } else {
          if (spaceOnRight > spaceOnLeft) {
            position.left = 0;
            position.right = 'auto';
          } else {
            position.right = 0;
            position.left = 'auto';
          }
        }
      }

      // Вертикальное позиционирование
      // Учитываем высоту поля поиска на мобильных
      const estimatedContentHeight = Math.ceil(filteredLanguages.length / columnCount) * itemHeight + searchHeight + menuPadding * 2;
      const actualMenuHeight = menuRef.current.offsetHeight || estimatedContentHeight;

      if (spaceBelow < actualMenuHeight + padding) {
        // Недостаточно места снизу
        if (spaceAbove > spaceBelow && spaceAbove > 200) {
          // Есть место сверху - открываем вверх
          position.bottom = '100%';
          position.top = 'auto';
          const availableHeight = spaceAbove - padding;
          position.maxHeight = `${Math.max(200, availableHeight)}px`;
        } else {
          // Открываем вниз, но ограничиваем высоту доступным пространством
          position.top = 'calc(100% + 8px)';
          position.bottom = 'auto';
          const availableHeight = spaceBelow - padding;
          position.maxHeight = `${Math.max(200, availableHeight)}px`;
        }
      } else {
        // Достаточно места снизу
        position.top = 'calc(100% + 8px)';
        position.bottom = 'auto';
        // Ограничиваем высоту доступным пространством для прокрутки
        position.maxHeight = `${spaceBelow - padding}px`;
      }

      setMenuPosition(position);
    };

    // Для portal-режима вычисляем позицию сразу
    if (renderMenuInPortal) {
      calculatePosition();
    }

    // Используем несколько попыток для гарантии правильного расчета
    const scheduleCalculation = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          calculatePosition();
          setTimeout(() => {
            calculatePosition();
          }, 50);
        });
      });
    };
    
    scheduleCalculation();

    // Пересчитываем при изменении размера окна, поиска и колонок
    const handleResize = () => {
      scheduleCalculation();
    };

    // Если используем portal, также обновляем позицию при скролле
    const handleScroll = () => {
      if (renderMenuInPortal && dropdownRef.current) {
        const dropdownRect = dropdownRef.current.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const menuWidth = isMobile 
          ? Math.min(viewportWidth - 16, 320)
          : Math.min(columnCount * 120 + (columnCount - 1) * 12 + 24, viewportWidth - 16);
        
        const leftPosition = Math.max(8, dropdownRect.right - menuWidth);
        
        setPortalPosition({
          top: dropdownRect.bottom + 8,
          left: leftPosition
        });
      }
      scheduleCalculation();
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isOpen, isMobile, columnCount, filteredLanguages.length, searchQuery, renderMenuInPortal]);

  const handleLanguageSelect = React.useCallback((langCode: string) => {
    // Приводим к типу Language, так как все коды из списка языков валидны
    setLanguage(langCode as any);
    setIsOpen(false);
    setSearchQuery('');
  }, [setLanguage]);

  return (
    <div className={`${styles.languageDropdown} ${variant === 'trading' ? styles.tradingVariant : ''}`} ref={dropdownRef}>
      <button
        className={styles.dropdownTrigger}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        aria-label="Select language"
      >
        {variant === 'trading' && (
          <svg className={styles.languageIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="2" y1="12" x2="22" y2="12"></line>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
          </svg>
        )}
        <span className={styles.currentLanguage}>{currentLanguage.nativeName}</span>
        <span className={styles.chevron}>{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (() => {
        const menuContent = (
          <div 
            ref={menuRef}
            className={`${styles.dropdownMenu} ${isMobile ? styles.mobileMenu : ''} ${renderMenuInPortal ? styles.dropdownMenuPortal : ''}`}
            style={renderMenuInPortal && portalPosition ? {
              position: 'fixed',
              top: `${portalPosition.top}px`,
              left: `${portalPosition.left}px`,
              zIndex: 10002,
              ...menuPosition
            } : menuPosition}
            onClick={(e) => e.stopPropagation()}
          >
            {isMobile && (
              <div className={styles.searchContainer}>
                <input
                  ref={searchInputRef}
                  type="text"
                  className={styles.searchInput}
                  placeholder={t('common.searchLanguage', { defaultValue: 'Поиск языка...' })}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            )}
            <div className={styles.dropdownContent}>
              {filteredLanguages.length > 0 ? (
                columns.map((column, columnIndex) => (
                  <div key={columnIndex} className={styles.column}>
                    {column.map((lang) => (
                      <button
                        key={lang.code}
                        className={`${styles.languageItem} ${language === lang.code ? styles.active : ''}`}
                        onClick={() => handleLanguageSelect(lang.code)}
                      >
                        {lang.nativeName}
                      </button>
                    ))}
                  </div>
                ))
              ) : (
                <div className={styles.noResults}>
                  {t('common.noLanguagesFound', { defaultValue: 'Языки не найдены' })}
                </div>
              )}
            </div>
          </div>
        );

        if (renderMenuInPortal && typeof document !== 'undefined') {
          return createPortal(menuContent, document.body);
        }

        return menuContent;
      })()}
    </div>
  );
});

