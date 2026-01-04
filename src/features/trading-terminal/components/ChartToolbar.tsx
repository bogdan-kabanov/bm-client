import React, { useState, useEffect, useRef } from 'react';
import { TIMEFRAME_OPTIONS } from '../constants/chart';
import type { ChartTimeframe } from '@/src/features/charts/ui/types';
import './ChartToolbar.css';
import carandashIcon from '@src/assets/images/tools/Carandash2.png';
import svechiIcon from '@src/assets/images/tools/Svechi.png';
import cirkulIcon from '@src/assets/images/tools/Cirkul.png';

type DrawingTool = 'line' | 'freehand' | 'eraser' | 'rectangle' | 'circle' | 'arrow' | 'horizontal' | 'vertical' | 'text' | 'parallel' | 'fibonacci' | 'channel' | 'trendline' | 'zone' | null;

interface ChartToolbarProps {
  timeframe: ChartTimeframe;
  setTimeframe: (timeframe: ChartTimeframe) => void;
  t?: (key: string) => string;
  onOpenIndicators?: () => void;
  onOpenDrawingTools?: () => void;
  showDrawingToolsMenu?: boolean;
  setShowDrawingToolsMenu?: (show: boolean) => void;
  onDrawingToolSelect?: (tool: DrawingTool) => void;
  selectedDrawingTool?: DrawingTool;
  selectionMode?: boolean;
  onSelectionModeToggle?: (enabled: boolean) => void;
  onChartViewChange?: () => void;
}

export const ChartToolbar: React.FC<ChartToolbarProps> = ({
  timeframe,
  setTimeframe,
  t = (key: string) => key,
  onOpenIndicators,
  onOpenDrawingTools,
  showDrawingToolsMenu = false,
  setShowDrawingToolsMenu,
  onDrawingToolSelect,
  selectedDrawingTool = null,
  selectionMode = false,
  onSelectionModeToggle,
  onChartViewChange,
}) => {
  const [showTimeframeMenu, setShowTimeframeMenu] = useState(false);
  const timeframeMenuRef = useRef<HTMLDivElement>(null);
  const drawingToolsWrapperRef = useRef<HTMLDivElement>(null);
  const drawingToolsRowRef = useRef<HTMLDivElement>(null);
  const drawingToolsRowContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollLeft, setShowScrollLeft] = useState(false);
  const [showScrollRight, setShowScrollRight] = useState(false);

  // Закрытие меню при клике вне его (только для timeframe меню, инструменты рисования закрываются вручную)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (timeframeMenuRef.current && !timeframeMenuRef.current.contains(event.target as Node)) {
        setShowTimeframeMenu(false);
      }
      // Убрано автоматическое закрытие панели инструментов рисования - закрывается только вручную
    };

    if (showTimeframeMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showTimeframeMenu]);

  // Инструменты рисования
  const drawingTools: Array<{ id: DrawingTool; label: string; icon: React.ReactNode }> = [
    {
      id: 'line',
      label: t('chart.drawingTools.line'),
      icon: (
        <svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="#868893" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      ),
    },
    {
      id: 'freehand',
      label: t('chart.drawingTools.freehand'),
      icon: (
        <svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="#868893" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 19l7-7 3 3-7 7-3-3z"></path>
          <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
          <path d="M2 2l7.586 7.586"></path>
        </svg>
      ),
    },
    {
      id: 'rectangle',
      label: t('chart.drawingTools.rectangle'),
      icon: (
        <svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="#868893" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        </svg>
      ),
    },
    {
      id: 'circle',
      label: t('chart.drawingTools.circle'),
      icon: (
        <svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="#868893" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
        </svg>
      ),
    },
    {
      id: 'arrow',
      label: 'Стрелка',
      icon: (
        <svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="#868893" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="5" y1="12" x2="19" y2="12"></line>
          <polyline points="12 5 19 12 12 19"></polyline>
        </svg>
      ),
    },
    {
      id: 'horizontal',
      label: 'Горизонтальная линия',
      icon: (
        <svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="#868893" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="12" x2="21" y2="12"></line>
        </svg>
      ),
    },
    {
      id: 'vertical',
      label: 'Вертикальная линия',
      icon: (
        <svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="#868893" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="3" x2="12" y2="21"></line>
        </svg>
      ),
    },
    {
      id: 'text',
      label: 'Текст',
      icon: (
        <svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="#868893" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="4 7 4 4 20 4 20 7"></polyline>
          <line x1="9" y1="20" x2="15" y2="20"></line>
          <line x1="12" y1="4" x2="12" y2="20"></line>
        </svg>
      ),
    },
    {
      id: 'trendline',
      label: 'Трендовая линия',
      icon: (
        <svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="#868893" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 21 12 3 21 21"></polyline>
        </svg>
      ),
    },
    {
      id: 'eraser',
      label: 'Ластик',
      icon: (
        <svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="#868893" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12c0 1.66-1.34 3-3 3H6c-1.66 0-3-1.34-3-3s1.34-3 3-3h12c1.66 0 3 1.34 3 3z"></path>
          <path d="M9 9l6 6"></path>
          <path d="M15 9l-6 6"></path>
        </svg>
      ),
    },
  ];

  // Проверка необходимости прокрутки
  const checkScrollButtons = React.useCallback(() => {
    if (!drawingToolsRowRef.current || !showDrawingToolsMenu) {
      setShowScrollLeft(false);
      setShowScrollRight(false);
      return;
    }

    const container = drawingToolsRowRef.current;
    const scrollLeft = container.scrollLeft;
    const scrollWidth = container.scrollWidth;
    const clientWidth = container.clientWidth;

    setShowScrollLeft(scrollLeft > 0);
    setShowScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
  }, [showDrawingToolsMenu]);

  // Прокрутка влево
  const scrollLeft = React.useCallback(() => {
    if (drawingToolsRowRef.current) {
      drawingToolsRowRef.current.scrollBy({ left: -100, behavior: 'smooth' });
    }
  }, []);

  // Прокрутка вправо
  const scrollRight = React.useCallback(() => {
    if (drawingToolsRowRef.current) {
      drawingToolsRowRef.current.scrollBy({ left: 100, behavior: 'smooth' });
    }
  }, []);

  // Ограничение ширины панели правым краем chart-toolbar
  const updatePanelMaxWidth = React.useCallback(() => {
    if (!drawingToolsWrapperRef.current || !drawingToolsRowContainerRef.current || !showDrawingToolsMenu) {
      return;
    }

    const wrapper = drawingToolsWrapperRef.current;
    const container = drawingToolsRowContainerRef.current;
    const toolbar = wrapper.closest('.chart-toolbar');
    
    if (!toolbar) return;

    const toolbarRect = toolbar.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    
    // Вычисляем максимальную ширину: от левого края панели до правого края toolbar минус отступ
    const maxWidth = toolbarRect.right - containerRect.left - 10; // 10px отступ от правого края
    
    if (maxWidth > 0) {
      container.style.maxWidth = `${maxWidth}px`;
    } else {
      container.style.maxWidth = '0px';
    }
  }, [showDrawingToolsMenu]);

  // Отслеживание изменений размера и прокрутки
  useEffect(() => {
    if (showDrawingToolsMenu) {
      // Проверяем сразу и после небольшой задержки для корректного расчета размеров
      checkScrollButtons();
      updatePanelMaxWidth();
      const container = drawingToolsRowRef.current;
      if (container) {
        container.addEventListener('scroll', checkScrollButtons);
        window.addEventListener('resize', () => {
          checkScrollButtons();
          updatePanelMaxWidth();
        });
        
        // Проверяем несколько раз для корректного расчета после рендеринга
        const timeoutId1 = setTimeout(() => {
          checkScrollButtons();
          updatePanelMaxWidth();
        }, 50);
        const timeoutId2 = setTimeout(() => {
          checkScrollButtons();
          updatePanelMaxWidth();
        }, 150);
        const timeoutId3 = setTimeout(() => {
          checkScrollButtons();
          updatePanelMaxWidth();
        }, 300);
        
        return () => {
          clearTimeout(timeoutId1);
          clearTimeout(timeoutId2);
          clearTimeout(timeoutId3);
          container.removeEventListener('scroll', checkScrollButtons);
          window.removeEventListener('resize', checkScrollButtons);
        };
      }
    } else {
      setShowScrollLeft(false);
      setShowScrollRight(false);
      if (drawingToolsRowContainerRef.current) {
        drawingToolsRowContainerRef.current.style.maxWidth = '';
      }
    }
  }, [showDrawingToolsMenu, checkScrollButtons, updatePanelMaxWidth]);

  const handleDrawingToolClick = (tool: DrawingTool) => {
    if (selectedDrawingTool === tool) {
      // Если инструмент уже выбран, отключаем его
      onDrawingToolSelect?.(null);
    } else {
      // Выбираем новый инструмент
      onDrawingToolSelect?.(tool);
    }
  };


  return (
    <div className="chart-toolbar">
      <div className="chart-toolbar-buttons">
        {/* Кнопка смены таймфрейма */}
        <div className="chart-toolbar-button-wrapper" ref={timeframeMenuRef}>
          <button
            className="chart-toolbar-button timeframe-button"
            onClick={() => {
              setShowTimeframeMenu(!showTimeframeMenu);
            }}
            title={t('trading.timeframe')}
          >
            <span className="timeframe-label">
              {TIMEFRAME_OPTIONS.find(opt => opt.value === timeframe)?.label || timeframe}
            </span>
          </button>
          {showTimeframeMenu && (
            <div className="chart-toolbar-dropdown">
              {TIMEFRAME_OPTIONS.map(option => (
                <button
                  key={option.value}
                  className={`chart-toolbar-dropdown-item ${timeframe === option.value ? 'active' : ''}`}
                  onClick={() => {
                    setTimeframe(option.value);
                    setShowTimeframeMenu(false);
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
        
        {/* Кнопка смены графика */}
        <div className="chart-toolbar-button-wrapper">
          <button
            className="chart-toolbar-button chart-tools-button"
            onClick={() => {
              onChartViewChange?.();
              setShowTimeframeMenu(false);
            }}
            title={t('trading.chartView')}
          >
            <img src={svechiIcon} alt={t('trading.chartView') || 'Смена графика'} width="27" height="27" style={{ filter: 'brightness(0) saturate(100%) invert(54%) sepia(4%) saturate(1000%) hue-rotate(202deg) brightness(95%) contrast(89%)' }} />
          </button>
        </div>
        
        {/* Кнопка режима выделения */}
        <div className="chart-toolbar-button-wrapper">
          <button
            className={`chart-toolbar-button chart-tools-button ${selectionMode ? 'active' : ''}`}
            onClick={() => {
              onSelectionModeToggle?.(!selectionMode);
            }}
            title="Режим выделения"
          >
            <svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="#868893" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <path d="M9 9h6v6H9z"></path>
            </svg>
          </button>
        </div>
        
        {/* Кнопка индикаторов */}
        <div className="chart-toolbar-button-wrapper">
          <button
            className="chart-toolbar-button chart-tools-button"
            onClick={() => {
              onOpenIndicators?.();
              setShowTimeframeMenu(false);
            }}
            title={t('trading.indicatorsTitle')}
          >
            <img src={cirkulIcon} alt={t('trading.indicatorsTitle') || 'Индикаторы'} width="27" height="27" style={{ filter: 'brightness(0) saturate(100%) invert(54%) sepia(4%) saturate(1000%) hue-rotate(202deg) brightness(95%) contrast(89%)' }} />
          </button>
        </div>

        {/* Кнопка инструментов рисования и панель инструментов */}
        <div className="chart-toolbar-button-wrapper drawing-tools-wrapper" ref={drawingToolsWrapperRef}>
          <button
            className="chart-toolbar-button chart-tools-button"
            onClick={() => {
              onOpenDrawingTools?.();
              setShowDrawingToolsMenu?.(!showDrawingToolsMenu);
              setShowTimeframeMenu(false);
            }}
            title={t('trading.drawingTools')}
          >
            <img src={carandashIcon} alt="Инструменты рисования" width="27" height="27" style={{ filter: 'brightness(0) saturate(100%) invert(54%) sepia(4%) saturate(1000%) hue-rotate(202deg) brightness(95%) contrast(89%)' }} />
          </button>
          <div 
            ref={drawingToolsRowContainerRef}
            className={`drawing-tools-row-container ${showDrawingToolsMenu ? 'drawing-tools-row-open' : ''}`}
          >
            {showScrollLeft && (
              <button
                className="drawing-tools-scroll-button drawing-tools-scroll-button-left"
                onClick={scrollLeft}
                aria-label="Прокрутить влево"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#868893" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
              </button>
            )}
            <div
              ref={drawingToolsRowRef}
              className={`drawing-tools-row ${showDrawingToolsMenu ? 'drawing-tools-row-open' : ''}`}
            >
              {drawingTools.map(tool => (
                <button
                  key={tool.id}
                  className={`chart-toolbar-button chart-tools-button drawing-tool-option ${selectedDrawingTool === tool.id ? 'active' : ''} ${tool.id === 'eraser' ? 'eraser-option' : ''}`}
                  data-tool={tool.id}
                  onClick={() => handleDrawingToolClick(tool.id)}
                  title={tool.label}
                >
                  {tool.icon}
                </button>
              ))}
            </div>
            {showScrollRight && (
              <button
                className="drawing-tools-scroll-button drawing-tools-scroll-button-right"
                onClick={scrollRight}
                aria-label="Прокрутить вправо"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#868893" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

