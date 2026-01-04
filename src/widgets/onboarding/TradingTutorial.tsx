import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useLanguage } from '@src/app/providers/useLanguage';
import './TradingTutorial.css';

interface TutorialStep {
  id: string;
  selector: string;
  title: string;
  description: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

interface TradingTutorialProps {
  forceShow?: boolean;
  onClose?: () => void;
}

export const TradingTutorial = ({ forceShow, onClose }: TradingTutorialProps = {}) => {
  const { t } = useLanguage();
  
  const getTutorialSteps = (t: (key: string) => string): TutorialStep[] => [
    {
      id: 'welcome',
      selector: '',
      title: t('onboarding.welcome.title'),
      description: t('onboarding.welcome.description'),
      position: 'center'
    },
    {
      id: 'balance',
      selector: '.balance-item--primary',
      title: t('onboarding.balance.title'),
      description: t('onboarding.balance.description'),
      position: 'bottom'
    },
    {
      id: 'trading-terminal',
      selector: '.chart-navigation-button',
      title: t('onboarding.trading.title'),
      description: t('onboarding.trading.description'),
      position: 'bottom'
    },
    {
      id: 'trading-controls',
      selector: '.trading-controls-panel',
      title: t('onboarding.tradingControls.title'),
      description: t('onboarding.tradingControls.description'),
      position: 'left'
    },
    {
      id: 'price-panel',
      selector: '.price-panel',
      title: t('onboarding.pricePanel.title'),
      description: t('onboarding.pricePanel.description'),
      position: 'left'
    }
  ];

  const TUTORIAL_STEPS = useMemo(() => getTutorialSteps(t), [t]);
  
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [highlightPosition, setHighlightPosition] = useState<{ 
    top: number; 
    left: number; 
    width: number; 
    height: number;
  } | null>(null);
  
  const [menuPosition, setMenuPosition] = useState<{ 
    top: number; 
    left: number; 
    width: number; 
    height: number;
  } | null>(null);
  
  const [pricePanelPosition, setPricePanelPosition] = useState<{ 
    top: number; 
    left: number; 
    width: number; 
    height: number;
  } | null>(null);
  
  const maskIdRef = useRef(`tutorial-mask-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);

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

  // Открываем панели и меню при переходе на соответствующие шаги
  useEffect(() => {
    if (!isVisible) return;
    
    const step = TUTORIAL_STEPS[currentStep];
    
    // Открываем панель управления торговлей
    if (step.selector === '.trading-controls-panel') {
      // Проверяем, скрыта ли панель
      const wrapper = document.querySelector('.trading-controls-panel-wrapper') as HTMLElement;
      if (wrapper && wrapper.classList.contains('trading-controls-panel-wrapper--hidden')) {
        // Отправляем событие для открытия панели
        if (typeof window !== 'undefined') {
          const openPanel = () => {
            window.dispatchEvent(new CustomEvent('showCenterPanel'));
          };
          
          openPanel();
          setTimeout(openPanel, 100);
          setTimeout(openPanel, 300);
          setTimeout(openPanel, 500);
        }
      }
      
      // Также открываем меню выбора валют
      setTimeout(() => {
        const navButton = document.querySelector('.chart-navigation-button') as HTMLElement;
        const menu = document.querySelector('.chart-navigation-menu.open') as HTMLElement;
        
        if (navButton && !menu) {
          // Открываем меню, кликая на кнопку
          navButton.click();
          
          // Повторяем попытки, если меню не открылось
          let attempts = 0;
          const tryOpen = () => {
            attempts++;
            const currentMenu = document.querySelector('.chart-navigation-menu.open') as HTMLElement;
            if (!currentMenu && attempts < 10) {
              navButton.click();
              setTimeout(tryOpen, 200);
            }
          };
          setTimeout(tryOpen, 300);
        }
      }, 600);
    }
  }, [currentStep, isVisible, TUTORIAL_STEPS]);

  // Обновляем позицию выделения при изменении шага
  useEffect(() => {
    if (!isVisible) {
      setHighlightPosition(null);
      return;
    }

    const step = TUTORIAL_STEPS[currentStep];
    
    if (!step.selector) {
      setHighlightPosition(null);
      return;
    }

    const updatePosition = () => {
      // Для trading-controls-panel ищем внутри wrapper, даже если он скрыт
      let element = document.querySelector(step.selector) as HTMLElement;
      
      if (!element && step.selector === '.trading-controls-panel') {
        const wrapper = document.querySelector('.trading-controls-panel-wrapper');
        if (wrapper) {
          element = wrapper.querySelector(step.selector) as HTMLElement;
        }
      }
      
      if (element) {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        
        // Проверяем, видим ли элемент
        if (rect.width > 0 && rect.height > 0 && 
            style.display !== 'none' && 
            style.visibility !== 'hidden' && 
            style.opacity !== '0') {
          setHighlightPosition({
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height
          });
        } else {
          setHighlightPosition(null);
        }
      } else {
        setHighlightPosition(null);
      }
      
      // Также проверяем открытое меню навигации
      const openMenu = document.querySelector('.chart-navigation-menu.open') as HTMLElement;
      if (openMenu) {
        const menuRect = openMenu.getBoundingClientRect();
        const menuStyle = window.getComputedStyle(openMenu);
        
        if (menuRect.width > 0 && menuRect.height > 0 && 
            menuStyle.display !== 'none' && 
            menuStyle.visibility !== 'hidden' && 
            menuStyle.opacity !== '0') {
          setMenuPosition({
            top: menuRect.top,
            left: menuRect.left,
            width: menuRect.width,
            height: menuRect.height
          });
        } else {
          setMenuPosition(null);
        }
      } else {
        setMenuPosition(null);
      }
      
      // Проверяем панель цен
      const pricePanel = document.querySelector('.price-panel') as HTMLElement;
      if (pricePanel) {
        const panelRect = pricePanel.getBoundingClientRect();
        const panelStyle = window.getComputedStyle(pricePanel);
        
        if (panelRect.width > 0 && panelRect.height > 0 && 
            panelStyle.display !== 'none' && 
            panelStyle.visibility !== 'hidden' && 
            panelStyle.opacity !== '0') {
          setPricePanelPosition({
            top: panelRect.top,
            left: panelRect.left,
            width: panelRect.width,
            height: panelRect.height
          });
        } else {
          setPricePanelPosition(null);
        }
      } else {
        setPricePanelPosition(null);
      }
    };

    // Даем время на рендеринг и открытие панели
    const timeoutId = setTimeout(updatePosition, step.selector === '.trading-controls-panel' ? 500 : 100);
    
    // Обновляем при изменении размера окна
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    // Для trading-controls-panel делаем повторные попытки
    let retryCount = 0;
    const maxRetries = 10;
    const retryInterval = setInterval(() => {
      if (step.selector === '.trading-controls-panel' && retryCount < maxRetries) {
        retryCount++;
        updatePosition();
      } else {
        clearInterval(retryInterval);
      }
    }, 200);
    
    // Постоянно отслеживаем открытое меню навигации и панель цен
    const menuCheckInterval = setInterval(() => {
      // Проверяем открытое меню навигации
      const openMenu = document.querySelector('.chart-navigation-menu.open') as HTMLElement;
      if (openMenu) {
        const menuRect = openMenu.getBoundingClientRect();
        const menuStyle = window.getComputedStyle(openMenu);
        
        if (menuRect.width > 0 && menuRect.height > 0 && 
            menuStyle.display !== 'none' && 
            menuStyle.visibility !== 'hidden' && 
            menuStyle.opacity !== '0') {
          setMenuPosition({
            top: menuRect.top,
            left: menuRect.left,
            width: menuRect.width,
            height: menuRect.height
          });
        } else {
          setMenuPosition(null);
        }
      } else {
        setMenuPosition(null);
      }
      
      // Проверяем панель цен
      const pricePanel = document.querySelector('.price-panel') as HTMLElement;
      if (pricePanel) {
        const panelRect = pricePanel.getBoundingClientRect();
        const panelStyle = window.getComputedStyle(pricePanel);
        
        if (panelRect.width > 0 && panelRect.height > 0 && 
            panelStyle.display !== 'none' && 
            panelStyle.visibility !== 'hidden' && 
            panelStyle.opacity !== '0') {
          setPricePanelPosition({
            top: panelRect.top,
            left: panelRect.left,
            width: panelRect.width,
            height: panelRect.height
          });
        } else {
          setPricePanelPosition(null);
        }
      } else {
        setPricePanelPosition(null);
      }
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      clearInterval(retryInterval);
      clearInterval(menuCheckInterval);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [currentStep, isVisible, TUTORIAL_STEPS]);

  const handleNext = useCallback(() => {
    if (currentStep < TUTORIAL_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleComplete();
    }
  }, [currentStep, TUTORIAL_STEPS.length]);

  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const handleSkip = useCallback(() => {
    handleComplete();
  }, []);

  const handleComplete = useCallback(() => {
    localStorage.setItem('tradingTutorialCompleted', 'true');
    setIsVisible(false);
    if (onClose) {
      onClose();
    }
  }, [onClose]);

  if (!isVisible) {
    return null;
  }

  const step = TUTORIAL_STEPS[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === TUTORIAL_STEPS.length - 1;

  // Вычисляем позицию тултипа
  let tooltipStyle: React.CSSProperties = {};
  const tooltipMaxWidth = 400;
  const margin = 20;
  
  if (step.position === 'center' || !highlightPosition) {
    tooltipStyle = {
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      maxWidth: `${Math.min(tooltipMaxWidth, window.innerWidth - margin * 2)}px`,
    };
  } else if (highlightPosition) {
    const position = step.position || 'bottom';
    
    switch (position) {
      case 'top':
        tooltipStyle = {
          bottom: window.innerHeight - highlightPosition.top + margin,
          left: Math.max(margin, Math.min(highlightPosition.left + highlightPosition.width / 2, window.innerWidth - margin)),
          transform: 'translateX(-50%)',
          maxWidth: `${Math.min(tooltipMaxWidth, window.innerWidth - margin * 2)}px`,
        };
        break;
      case 'bottom':
        tooltipStyle = {
          top: highlightPosition.top + highlightPosition.height + margin,
          left: Math.max(margin, Math.min(highlightPosition.left + highlightPosition.width / 2, window.innerWidth - margin)),
          transform: 'translateX(-50%)',
          maxWidth: `${Math.min(tooltipMaxWidth, window.innerWidth - margin * 2)}px`,
        };
        break;
      case 'left':
        tooltipStyle = {
          top: Math.max(margin, Math.min(highlightPosition.top + highlightPosition.height / 2, window.innerHeight - margin)),
          right: window.innerWidth - highlightPosition.left + margin,
          transform: 'translateY(-50%)',
          maxWidth: `${Math.min(tooltipMaxWidth, window.innerWidth - margin * 2)}px`,
        };
        break;
      case 'right':
        tooltipStyle = {
          top: Math.max(margin, Math.min(highlightPosition.top + highlightPosition.height / 2, window.innerHeight - margin)),
          left: highlightPosition.left + highlightPosition.width + margin,
          transform: 'translateY(-50%)',
          maxWidth: `${Math.min(tooltipMaxWidth, window.innerWidth - margin * 2)}px`,
        };
        break;
    }
    
    // Корректируем позицию, чтобы не выходила за границы
    if (tooltipStyle.left !== undefined) {
      const left = typeof tooltipStyle.left === 'number' ? tooltipStyle.left : 0;
      if (left < margin) {
        tooltipStyle.left = margin;
        tooltipStyle.transform = 'translateX(0)';
      } else if (left > window.innerWidth - margin) {
        tooltipStyle.left = window.innerWidth - margin;
        tooltipStyle.transform = 'translateX(-100%)';
      }
    }
    
    if (tooltipStyle.top !== undefined) {
      const top = typeof tooltipStyle.top === 'number' ? tooltipStyle.top : 0;
      if (top < margin) {
        tooltipStyle.top = margin;
      } else if (top > window.innerHeight - 200) {
        tooltipStyle.top = window.innerHeight - 200;
      }
    }
  }

  // Создаем SVG mask для выреза
  const maskParams = highlightPosition ? {
    x: highlightPosition.left,
    y: highlightPosition.top,
    width: highlightPosition.width,
    height: highlightPosition.height,
  } : null;
  
  const menuMaskParams = menuPosition ? {
    x: menuPosition.left,
    y: menuPosition.top,
    width: menuPosition.width,
    height: menuPosition.height,
  } : null;
  
  const pricePanelMaskParams = pricePanelPosition ? {
    x: pricePanelPosition.left,
    y: pricePanelPosition.top,
    width: pricePanelPosition.width,
    height: pricePanelPosition.height,
  } : null;

  return (
    <>
      {/* SVG для mask */}
      <svg 
        width="100%" 
        height="100%" 
        style={{ 
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          pointerEvents: 'none',
          zIndex: 10000
        }}
      >
        <defs>
          <mask id={maskIdRef.current}>
            <rect width="100%" height="100%" fill="white" />
            {maskParams && (
              <rect
                x={maskParams.x}
                y={maskParams.y}
                width={maskParams.width}
                height={maskParams.height}
                fill="black"
                rx="8"
              />
            )}
            {menuMaskParams && (
              <rect
                x={menuMaskParams.x}
                y={menuMaskParams.y}
                width={menuMaskParams.width}
                height={menuMaskParams.height}
                fill="black"
                rx="8"
              />
            )}
            {pricePanelMaskParams && (
              <rect
                x={pricePanelMaskParams.x}
                y={pricePanelMaskParams.y}
                width={pricePanelMaskParams.width}
                height={pricePanelMaskParams.height}
                fill="black"
                rx="8"
              />
            )}
          </mask>
        </defs>
      </svg>

      {/* Overlay с вырезом */}
      <div
        className="trading-tutorial-overlay"
        style={{
          maskImage: `url(#${maskIdRef.current})`,
          WebkitMaskImage: `url(#${maskIdRef.current})`,
        }}
      />

      {/* Highlight border */}
      {highlightPosition && (
        <div
          className="trading-tutorial-highlight"
          style={{
            top: highlightPosition.top - 4,
            left: highlightPosition.left - 4,
            width: highlightPosition.width + 8,
            height: highlightPosition.height + 8,
          }}
        />
      )}

      {/* Tooltip */}
      <div
        className={`trading-tutorial-tooltip ${step.position === 'center' ? 'trading-tutorial-tooltip--center' : ''}`}
        style={tooltipStyle}
      >
        <div className="trading-tutorial-content">
          <h3 className="trading-tutorial-title">{step.title}</h3>
          <p className="trading-tutorial-description">{step.description}</p>
          
          <div className="trading-tutorial-navigation">
            <div className="trading-tutorial-steps">
              {TUTORIAL_STEPS.map((_, index) => (
                <div
                  key={index}
                  className={`trading-tutorial-step-indicator ${
                    index === currentStep
                      ? 'active'
                      : index < currentStep
                      ? 'completed'
                      : ''
                  }`}
                />
              ))}
            </div>
            
            <div className="trading-tutorial-buttons">
              {!isFirstStep && (
                <button
                  className="trading-tutorial-button trading-tutorial-button--secondary"
                  onClick={handleBack}
                >
                  {t('common.back', { defaultValue: 'Back' })}
                </button>
              )}
              <button
                className="trading-tutorial-button trading-tutorial-button--primary"
                onClick={handleNext}
              >
                {isLastStep
                  ? t('onboarding.complete', { defaultValue: 'Complete' })
                  : t('onboarding.next', { defaultValue: 'Next' })}
              </button>
              <button
                className="trading-tutorial-button trading-tutorial-button--link"
                onClick={handleSkip}
              >
                {t('onboarding.skip', { defaultValue: 'Skip' })}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
