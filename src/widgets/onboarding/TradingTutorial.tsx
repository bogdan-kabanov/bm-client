import { useState, useEffect, useRef, useCallback } from 'react';
import { useLanguage } from '@src/app/providers/useLanguage';
import './TradingTutorial.css';

interface TutorialStep {
  id: string;
  selector: string;
  title: string;
  description: string;
  images?: string[];
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    selector: '',
    title: 'Добро пожаловать!',
    description: 'Добро пожаловать в платформу трейдинга! Давайте пройдем краткое обучение, чтобы вы могли максимально эффективно использовать все возможности.',
    images: ['/images/tutorial-1.png', '/images/tutorial-2.png', '/images/tutorial-3.png'],
    position: 'center'
  },
  {
    id: 'balance',
    selector: '.balance-item--primary',
    title: 'Баланс',
    description: 'Здесь отображается ваш текущий баланс. Вы можете переключаться между реальным и демо-счетом, нажав на этот элемент.',
    position: 'bottom'
  },
  {
    id: 'trading-terminal',
    selector: '.chart-toolbar',
    title: 'Терминал трейдинга',
    description: 'Это основной терминал, где вы можете видеть графики цен, выбирать валютные пары и управлять торговлей.',
    position: 'right'
  },
  {
    id: 'trading-controls',
    selector: '.trading-controls-panel',
    title: 'Панель управления',
    description: 'Здесь вы можете настроить параметры торговли: сумму сделки, время экспирации и другие настройки для ручной торговли.',
    position: 'left'
  },
  {
    id: 'trade-buttons',
    selector: '.manual-trade-buttons',
    title: 'Кнопки торговли',
    description: 'Используйте кнопки "Купить" и "Продать" для совершения сделок в ручном режиме. Выберите направление и нажмите соответствующую кнопку.',
    position: 'top'
  },
  {
    id: 'price-panel',
    selector: '.price-panel',
    title: 'Панель цен',
    description: 'Здесь отображается текущая цена, разница между биржами, история сделок и активные позиции.',
    position: 'left'
  }
];

interface TradingTutorialProps {
  forceShow?: boolean;
  onClose?: () => void;
}

export const TradingTutorial = ({ forceShow, onClose }: TradingTutorialProps = {}) => {
  const { t } = useLanguage();
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [highlightedElement, setHighlightedElement] = useState<HTMLElement | null>(null);
  const [highlightPosition, setHighlightPosition] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const originalZIndexesRef = useRef<Map<HTMLElement, string>>(new Map());

  // Проверяем, был ли уже показан туториал
  useEffect(() => {
    if (forceShow) {
      setIsVisible(true);
      setCurrentStep(0);
    } else {
      const hasSeenTutorial = localStorage.getItem('tradingTutorialCompleted');
      if (!hasSeenTutorial) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    }
  }, [forceShow]);

  // Экспортируем функцию для запуска туториала глобально
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__startTradingTutorial = () => {
        setIsVisible(true);
        setCurrentStep(0);
      };
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).__startTradingTutorial;
      }
    };
  }, []);

  // Обновляем позицию выделения при изменении шага или размера окна
  useEffect(() => {
    if (!isVisible) return;

    const updateHighlight = () => {
      const step = TUTORIAL_STEPS[currentStep];
      
      if (!step.selector) {
        // Для шага welcome не выделяем элемент
        setHighlightedElement(null);
        setHighlightPosition(null);
        return;
      }

      // Небольшая задержка для того, чтобы элементы успели отрендериться
      const timeoutId = setTimeout(() => {
        // Функция для поиска элемента с несколькими попытками
        const findElement = (attempt: number = 0, maxAttempts: number = 15): void => {
          let element = document.querySelector(step.selector) as HTMLElement;
          
          // Если элемент не найден напрямую, пробуем найти через wrapper
          if (!element && step.selector === '.trading-controls-panel') {
            const wrapper = document.querySelector('.trading-controls-panel-wrapper');
            if (wrapper) {
              element = wrapper.querySelector(step.selector) as HTMLElement;
            }
          }
          
          if (element) {
            // Проверяем, что элемент действительно видим
            const rect = element.getBoundingClientRect();
            const computedStyle = window.getComputedStyle(element);
            const isVisible = rect.width > 0 && rect.height > 0 && 
                             rect.top < window.innerHeight && 
                             rect.bottom > 0 &&
                             rect.left < window.innerWidth && 
                             rect.right > 0 &&
                             computedStyle.display !== 'none' &&
                             computedStyle.visibility !== 'hidden' &&
                             computedStyle.opacity !== '0';
            
            if (isVisible) {
              updateElementHighlight(element);
              return;
            }
          }
          
          // Если элемент не найден, пробуем еще раз
          if (attempt < maxAttempts) {
            setTimeout(() => findElement(attempt + 1, maxAttempts), 200);
          } else {
            // После всех попыток, если элемент не найден, скрываем выделение
            // НЕ переходим автоматически к следующему шагу - пользователь должен нажать кнопку
            console.warn(`[TradingTutorial] Элемент не найден: ${step.selector} (шаг ${currentStep + 1})`);
            setHighlightedElement(null);
            setHighlightPosition(null);
          }
        };
        
        findElement();
      }, 100);
      
      const updateElementHighlight = (element: HTMLElement) => {
        // Восстанавливаем z-index предыдущего элемента, если был
        if (highlightedElement && originalZIndexesRef.current.has(highlightedElement)) {
          const originalZIndex = originalZIndexesRef.current.get(highlightedElement);
          highlightedElement.style.zIndex = originalZIndex || '';
          originalZIndexesRef.current.delete(highlightedElement);
        }

        const rect = element.getBoundingClientRect();
        
        // Проверяем, что элемент видим и имеет валидные размеры
        if (rect.width === 0 || rect.height === 0 || 
            rect.top < -1000 || rect.left < -1000 ||
            rect.width > window.innerWidth * 1.5 || 
            rect.height > window.innerHeight * 1.5) {
          // Элемент невидим или имеет некорректные размеры - не показываем выделение
          setHighlightedElement(null);
          setHighlightPosition(null);
          return;
        }

        setHighlightedElement(element);
        setHighlightPosition({
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height
        });

        // Сохраняем оригинальный z-index и устанавливаем новый, чтобы элемент был виден поверх overlay
        const computedZIndex = window.getComputedStyle(element).zIndex;
        const inlineZIndex = element.style.zIndex;
        const originalZIndex = inlineZIndex || computedZIndex;
        
        if (!originalZIndexesRef.current.has(element)) {
          originalZIndexesRef.current.set(element, originalZIndex);
        }
        
        if (computedZIndex === 'auto' || !computedZIndex || parseInt(computedZIndex) < 10001) {
          element.style.zIndex = '10001';
        }
      };

      return () => clearTimeout(timeoutId);
    };

    updateHighlight();
    const resizeHandler = () => updateHighlight();
    const scrollHandler = () => updateHighlight();

    window.addEventListener('resize', resizeHandler);
    window.addEventListener('scroll', scrollHandler, true);

    // Периодически проверяем наличие элемента (на случай, если он появится позже)
    const intervalId = setInterval(updateHighlight, 500);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('resize', resizeHandler);
      window.removeEventListener('scroll', scrollHandler, true);
      
      // Восстанавливаем z-index всех элементов при размонтировании
      originalZIndexesRef.current.forEach((originalZIndex, element) => {
        element.style.zIndex = originalZIndex || '';
      });
      originalZIndexesRef.current.clear();
    };
  }, [currentStep, isVisible, highlightedElement]);

  const handleNext = useCallback(() => {
    if (currentStep < TUTORIAL_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  }, [currentStep]);

  const handlePrevious = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep]);

  const handleSkip = useCallback(() => {
    handleComplete();
  }, []);

  const handleComplete = useCallback(() => {
    // Восстанавливаем z-index всех элементов
    originalZIndexesRef.current.forEach((originalZIndex, element) => {
      element.style.zIndex = originalZIndex || '';
    });
    originalZIndexesRef.current.clear();
    
    setIsVisible(false);
    setHighlightedElement(null);
    setHighlightPosition(null);
    localStorage.setItem('tradingTutorialCompleted', 'true');
    if (onClose) {
      onClose();
    }
  }, [onClose]);

  if (!isVisible) return null;

  const step = TUTORIAL_STEPS[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === TUTORIAL_STEPS.length - 1;

  // Вычисляем позицию тултипа с проверкой границ экрана
  let tooltipStyle: React.CSSProperties = {};
  const tooltipMaxWidth = 400; // Максимальная ширина тултипа
  const tooltipMinWidth = 320; // Минимальная ширина тултипа
  const tooltipHeight = 300; // Примерная высота тултипа
  const margin = 20; // Отступ от краев экрана
  
  if (step.selector && highlightPosition) {
    const scrollY = window.scrollY;
    const scrollX = window.scrollX;
    
    // Проверяем, виден ли элемент на экране
    const elementTop = highlightPosition.top - scrollY;
    const elementLeft = highlightPosition.left - scrollX;
    const elementBottom = elementTop + highlightPosition.height;
    const elementRight = elementLeft + highlightPosition.width;
    
    // Если элемент полностью за экраном, показываем тултип в центре
    if (elementBottom < 0 || elementTop > window.innerHeight || 
        elementRight < 0 || elementLeft > window.innerWidth) {
      tooltipStyle = {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        maxWidth: `${Math.min(tooltipMaxWidth, window.innerWidth - margin * 2)}px`,
        zIndex: 10002
      };
    } else {
      // Элемент виден, используем обычное позиционирование
      const position = step.position || 'bottom';
    
    let baseStyle: React.CSSProperties = {};
    
    switch (position) {
      case 'top':
        baseStyle = {
          bottom: window.innerHeight - (highlightPosition.top - scrollY) + 20,
          left: highlightPosition.left - scrollX + highlightPosition.width / 2,
          transform: 'translateX(-50%)'
        };
        break;
      case 'bottom':
        baseStyle = {
          top: highlightPosition.top - scrollY + highlightPosition.height + 20,
          left: highlightPosition.left - scrollX + highlightPosition.width / 2,
          transform: 'translateX(-50%)'
        };
        break;
      case 'left':
        baseStyle = {
          top: highlightPosition.top - scrollY + highlightPosition.height / 2,
          right: window.innerWidth - (highlightPosition.left - scrollX) + 20,
          transform: 'translateY(-50%)'
        };
        break;
      case 'right':
        baseStyle = {
          top: highlightPosition.top - scrollY + highlightPosition.height / 2,
          left: highlightPosition.left - scrollX + highlightPosition.width + 20,
          transform: 'translateY(-50%)'
        };
        break;
    }
    
    // Корректируем позицию, чтобы тултип не выходил за границы экрана
    // Используем временный элемент для измерения реальных размеров тултипа
    const tooltipWidth = tooltipMaxWidth;
    const tooltipHeightActual = tooltipHeight;
    
    if (typeof baseStyle.left === 'number') {
      // Проверяем левую границу
      if (baseStyle.left - tooltipWidth / 2 < margin) {
        baseStyle.left = margin + tooltipWidth / 2;
      }
      // Проверяем правую границу
      if (baseStyle.left + tooltipWidth / 2 > window.innerWidth - margin) {
        baseStyle.left = window.innerWidth - margin - tooltipWidth / 2;
      }
      // Если все еще выходит, центрируем
      if (baseStyle.left < margin || baseStyle.left > window.innerWidth - margin) {
        baseStyle.left = window.innerWidth / 2;
        baseStyle.transform = 'translateX(-50%)';
      }
    }
    
    if (typeof baseStyle.right === 'number') {
      // Преобразуем right в left для удобства проверки
      const rightValue = baseStyle.right;
      const leftValue = window.innerWidth - rightValue;
      if (leftValue - tooltipWidth / 2 < margin || leftValue + tooltipWidth / 2 > window.innerWidth - margin) {
        baseStyle.right = undefined;
        baseStyle.left = window.innerWidth / 2;
        baseStyle.transform = 'translateX(-50%)';
      }
    }
    
    if (typeof baseStyle.top === 'number') {
      // Проверяем верхнюю границу
      if (baseStyle.top < margin) {
        baseStyle.top = margin;
        if (baseStyle.transform && baseStyle.transform.includes('translateX')) {
          baseStyle.transform = 'translateX(-50%)';
        } else {
          baseStyle.transform = 'translate(-50%, 0)';
        }
      }
      // Проверяем нижнюю границу
      if (baseStyle.top + tooltipHeightActual > window.innerHeight - margin) {
        // Пробуем разместить выше элемента
        const newTop = elementTop - tooltipHeightActual - margin;
        if (newTop >= margin) {
          baseStyle.top = newTop;
        } else {
          // Если не помещается выше, размещаем в центре экрана
          baseStyle.top = (window.innerHeight - tooltipHeightActual) / 2;
        }
        if (baseStyle.transform && baseStyle.transform.includes('translateX')) {
          baseStyle.transform = 'translateX(-50%)';
        } else {
          baseStyle.transform = 'translate(-50%, 0)';
        }
      }
    }
    
    if (typeof baseStyle.bottom === 'number') {
      // Преобразуем bottom в top для удобства проверки
      const bottomValue = baseStyle.bottom;
      const topValue = window.innerHeight - bottomValue;
      if (topValue < margin || topValue + tooltipHeightActual > window.innerHeight - margin) {
        baseStyle.bottom = undefined;
        baseStyle.top = (window.innerHeight - tooltipHeightActual) / 2;
        baseStyle.transform = 'translateX(-50%)';
      }
    }
    
    // Финальная проверка: если тултип все еще выходит за границы, центрируем его
    if (typeof baseStyle.top === 'number' && (baseStyle.top < 0 || baseStyle.top + tooltipHeightActual > window.innerHeight)) {
      baseStyle.top = (window.innerHeight - tooltipHeightActual) / 2;
      baseStyle.left = window.innerWidth / 2;
      baseStyle.right = undefined;
      baseStyle.bottom = undefined;
      baseStyle.transform = 'translate(-50%, -50%)';
    }
    
    tooltipStyle = {
      ...baseStyle,
      maxWidth: `${Math.min(tooltipMaxWidth, window.innerWidth - margin * 2)}px`,
      zIndex: 10002
    };
    }
  } else if (isFirstStep) {
    tooltipStyle = {
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      maxWidth: `${Math.min(tooltipMaxWidth, window.innerWidth - margin * 2)}px`,
      zIndex: 10002
    };
  } else if (step.selector && !highlightPosition) {
    // Если элемент не найден, показываем тултип в позиции, указанной в step.position
    const position = step.position || 'center';
    switch (position) {
      case 'left':
        tooltipStyle = {
          top: '50%',
          right: `${margin}px`,
          transform: 'translateY(-50%)',
          maxWidth: `${Math.min(tooltipMaxWidth, window.innerWidth - margin * 2)}px`,
          zIndex: 10002
        };
        break;
      case 'right':
        tooltipStyle = {
          top: '50%',
          left: `${margin}px`,
          transform: 'translateY(-50%)',
          maxWidth: `${Math.min(tooltipMaxWidth, window.innerWidth - margin * 2)}px`,
          zIndex: 10002
        };
        break;
      case 'top':
        tooltipStyle = {
          bottom: `${margin}px`,
          left: '50%',
          transform: 'translateX(-50%)',
          maxWidth: `${Math.min(tooltipMaxWidth, window.innerWidth - margin * 2)}px`,
          zIndex: 10002
        };
        break;
      case 'bottom':
        tooltipStyle = {
          top: `${margin}px`,
          left: '50%',
          transform: 'translateX(-50%)',
          maxWidth: `${Math.min(tooltipMaxWidth, window.innerWidth - margin * 2)}px`,
          zIndex: 10002
        };
        break;
      default:
        tooltipStyle = {
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          maxWidth: `${Math.min(tooltipMaxWidth, window.innerWidth - margin * 2)}px`,
          zIndex: 10002
        };
    }
  }

  // Вычисляем позиции для overlay с дыркой
  const overlayParts = highlightPosition ? (() => {
    const top = Math.max(0, highlightPosition.top - window.scrollY);
    const left = Math.max(0, highlightPosition.left - window.scrollX);
    const bottom = top + highlightPosition.height;
    const right = left + highlightPosition.width;
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    // Проверяем, что позиции валидны
    if (top >= height || left >= width || bottom <= 0 || right <= 0) {
      return null;
    }
    
    return {
      top: { top: 0, left: 0, right: 0, height: Math.max(0, top) },
      left: { top: Math.max(0, top), left: 0, width: Math.max(0, left), height: Math.max(0, highlightPosition.height) },
      right: { top: Math.max(0, top), left: Math.min(width, right), right: 0, height: Math.max(0, highlightPosition.height) },
      bottom: { top: Math.min(height, bottom), left: 0, right: 0, bottom: 0 }
    };
  })() : null;

  return (
    <>
      {highlightPosition && overlayParts ? (
        <>
          {/* Верхняя часть overlay */}
          {overlayParts.top.height > 0 && (
            <div 
              className="trading-tutorial-overlay-part"
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                height: overlayParts.top.height,
                background: 'rgba(0, 0, 0, 0.85)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                zIndex: 10000,
                cursor: 'default',
                pointerEvents: 'none',
              }}
              // Убираем onClick={handleSkip}, чтобы туториал не закрывался автоматически
            />
          )}
          {/* Левая часть overlay */}
          {overlayParts.left.width > 0 && overlayParts.left.height > 0 && (
            <div 
              className="trading-tutorial-overlay-part"
              style={{
                position: 'fixed',
                top: overlayParts.left.top,
                left: 0,
                width: overlayParts.left.width,
                height: overlayParts.left.height,
                background: 'rgba(0, 0, 0, 0.85)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                zIndex: 10000,
                cursor: 'default',
                pointerEvents: 'none',
              }}
              // Убираем onClick={handleSkip}, чтобы туториал не закрывался автоматически
            />
          )}
          {/* Правая часть overlay */}
          {overlayParts.right.height > 0 && overlayParts.right.left < window.innerWidth && (
            <div 
              className="trading-tutorial-overlay-part"
              style={{
                position: 'fixed',
                top: overlayParts.right.top,
                left: overlayParts.right.left,
                right: 0,
                height: overlayParts.right.height,
                background: 'rgba(0, 0, 0, 0.85)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                zIndex: 10000,
                cursor: 'default',
                pointerEvents: 'none',
              }}
              // Убираем onClick={handleSkip}, чтобы туториал не закрывался автоматически
            />
          )}
          {/* Нижняя часть overlay */}
          {overlayParts.bottom.top < window.innerHeight && (
            <div 
              className="trading-tutorial-overlay-part"
              style={{
                position: 'fixed',
                top: overlayParts.bottom.top,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.85)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                zIndex: 10000,
                cursor: 'default',
                pointerEvents: 'none',
              }}
              // Убираем onClick={handleSkip}, чтобы туториал не закрывался автоматически
            />
          )}
          {/* Выделение элемента */}
          <div
            className="trading-tutorial-highlight"
            style={{
              top: `${highlightPosition.top - window.scrollY}px`,
              left: `${highlightPosition.left - window.scrollX}px`,
              width: `${highlightPosition.width}px`,
              height: `${highlightPosition.height}px`,
            }}
          />
        </>
      ) : (
        // Если элемент не найден, показываем overlay, но НЕ пропускаем туториал автоматически
        // Пользователь должен нажать кнопку "Далее" или "Пропустить"
        <div 
          ref={overlayRef}
          className="trading-tutorial-overlay"
          // Убираем onClick={handleSkip}, чтобы туториал не закрывался автоматически
          // onClick={handleSkip}
        />
      )}

      <div
        ref={tooltipRef}
        className={`trading-tutorial-tooltip trading-tutorial-tooltip--${step.position || 'center'}`}
        style={tooltipStyle}
        onClick={(e) => e.stopPropagation()}
      >
        {isFirstStep && step.images && step.images.length > 0 && (
          <div className="trading-tutorial-images">
            {step.images.map((img, index) => (
              <div key={index} className="trading-tutorial-image">
                <img 
                  src={img} 
                  alt={`Tutorial ${index + 1}`}
                  onError={(e) => {
                    // Если изображение не загрузилось, скрываем его
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
              </div>
            ))}
          </div>
        )}
        
        <div className="trading-tutorial-content">
          <h3 className="trading-tutorial-title">{step.title}</h3>
          <p className="trading-tutorial-description">{step.description}</p>
          
          <div className="trading-tutorial-navigation">
            <div className="trading-tutorial-steps">
              {TUTORIAL_STEPS.map((_, index) => (
                <div
                  key={index}
                  className={`trading-tutorial-step-indicator ${index === currentStep ? 'active' : ''} ${index < currentStep ? 'completed' : ''}`}
                />
              ))}
            </div>
            
            <div className="trading-tutorial-buttons">
              {currentStep > 0 && (
                <button
                  className="trading-tutorial-button trading-tutorial-button--secondary"
                  onClick={handlePrevious}
                >
                  Назад
                </button>
              )}
              <button
                className="trading-tutorial-button trading-tutorial-button--primary"
                onClick={handleNext}
              >
                {isLastStep ? 'Завершить' : 'Далее'}
              </button>
              {!isLastStep && (
                <button
                  className="trading-tutorial-button trading-tutorial-button--link"
                  onClick={handleSkip}
                >
                  Пропустить
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

