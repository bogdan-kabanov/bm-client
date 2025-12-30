import React from 'react';
import { getIndicatorsLibrary, getIndicatorBadge } from '../utils/indicators';

interface IndicatorsSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeIndicators: string[];
  toggleIndicator: (id: string) => void;
  t: (key: string) => string;
}

export const IndicatorsSidebar: React.FC<IndicatorsSidebarProps> = React.memo(({
  isOpen,
  onClose,
  activeIndicators,
  toggleIndicator,
  t,
}) => {
  React.useEffect(() => {
    // Состояние isOpen изменилось
  }, [isOpen, activeIndicators]);

  const handleClose = React.useCallback(() => {
    onClose();
  }, [onClose, activeIndicators.length]);

  const handleBackdropClick = React.useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    handleClose();
  }, [handleClose]);

  const handleIndicatorClick = React.useCallback((indicatorId: string) => {
    try {
      toggleIndicator(indicatorId);
    } catch (error) {
      // Ошибка при переключении индикатора
    }
  }, [toggleIndicator, activeIndicators]);

  if (!isOpen) {
    return null;
  }

  return (
    <>
      <div
        className="chart-indicators-sidebar-backdrop visible"
        aria-hidden="true"
        onClick={handleBackdropClick}
      />
      <aside
        className="chart-indicators-sidebar open"
        role="dialog"
        aria-label="Панель индикаторов"
      >
        <div className="chart-indicators-sidebar__header">
          <div className="chart-indicators-sidebar__title">
            <h3>{t('trading.indicatorsTitle')}</h3>
            <span>
              {activeIndicators.length > 0
                ? `${activeIndicators.length} ${t('trading.indicatorsSelected')}`
                : t('trading.indicatorsSelectHint')}
            </span>
          </div>
          <button
            type="button"
            className="chart-indicators-sidebar__close"
            onClick={() => {
              handleClose();
            }}
            aria-label={t('trading.closeIndicatorsPanel')}
            title={t('trading.closeIndicatorsPanel')}
          >
            <svg 
              width="20" 
              height="20" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div className="chart-indicators-sidebar__content">
          {getIndicatorsLibrary(t).map((indicator) => {
            const isActive = activeIndicators.includes(indicator.id);
            const badge = getIndicatorBadge(indicator.id);
            return (
              <button
                key={indicator.id}
                type="button"
                className={`indicator-item ${isActive ? 'indicator-item--active' : ''}`}
                onClick={() => handleIndicatorClick(indicator.id)}
              >
                <div
                  className="indicator-item__icon"
                  style={badge.style}
                  aria-hidden="true"
                >
                  {badge.label}
                </div>
                <div className="indicator-item__info">
                  <span className="indicator-item__name">{indicator.name}</span>
                  <span className="indicator-item__desc">{indicator.desc}</span>
                </div>
                <span className="indicator-item__toggle" aria-hidden="true">
                  {isActive ? t('trading.indicatorDisable') : t('trading.indicatorAdd')}
                </span>
              </button>
            );
          })}
        </div>
      </aside>
    </>
  );
}, (prevProps, nextProps) => {
  // Оптимизация: не ререндерим, если isOpen не изменился и компонент закрыт
  if (!nextProps.isOpen && !prevProps.isOpen) {
    return true; // пропускаем ререндер
  }
  // Ререндерим только если изменились важные пропсы
  return (
    prevProps.isOpen === nextProps.isOpen &&
    prevProps.activeIndicators.length === nextProps.activeIndicators.length &&
    prevProps.activeIndicators.every((id, idx) => id === nextProps.activeIndicators[idx]) &&
    prevProps.t === nextProps.t &&
    prevProps.onClose === nextProps.onClose &&
    prevProps.toggleIndicator === nextProps.toggleIndicator
  );
});

IndicatorsSidebar.displayName = 'IndicatorsSidebar';
