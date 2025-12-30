import React from 'react';
import type { ChartViewMode } from '../constants/chart';

// Иконка свечей (восходящий тренд - левая свеча выше)
export const CandlesUpIcon: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
    {/* Левая свеча (выше) - восходящая */}
    <line x1="4" y1="2" x2="4" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <rect x="3" y="6" width="2" height="5" rx="0.5" fill="currentColor" />
    {/* Правая свеча (ниже) - нисходящая */}
    <line x1="14" y1="8" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
    <rect x="13" y="11" width="2" height="3" rx="0.5" fill="currentColor" opacity="0.6" />
  </svg>
);

// Иконка свечей (равные - нейтральный)
export const CandlesEqualIcon: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
    {/* Левая свеча */}
    <line x1="4" y1="5" x2="4" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <rect x="3" y="9" width="2" height="5" rx="0.5" fill="currentColor" />
    {/* Правая свеча (такая же) */}
    <line x1="14" y1="5" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <rect x="13" y="9" width="2" height="5" rx="0.5" fill="currentColor" />
  </svg>
);

// Иконка свечей (нисходящий тренд - правая свеча выше)
export const CandlesDownIcon: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
    {/* Левая свеча (ниже) - нисходящая */}
    <line x1="4" y1="8" x2="4" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
    <rect x="3" y="11" width="2" height="3" rx="0.5" fill="currentColor" opacity="0.6" />
    {/* Правая свеча (выше) - восходящая */}
    <line x1="14" y1="2" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <rect x="13" y="6" width="2" height="5" rx="0.5" fill="currentColor" />
  </svg>
);

// Иконка разделенного макета (split layout)
export const SplitLayoutIcon: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
    <rect x="2" y="2" width="14" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" />
    <line x1="2" y1="9" x2="16" y2="9" stroke="currentColor" strokeWidth="1.5" />
    <rect x="2" y="10" width="14" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" />
  </svg>
);

// Иконка одного макета (single layout)
export const SingleLayoutIcon: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
    <rect x="2" y="2" width="14" height="14" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" />
  </svg>
);

export const renderChartViewIcon = (mode: ChartViewMode): React.ReactNode => {
  switch (mode) {
    case 'candles':
      // Используем иконку с восходящим трендом для режима свечей
      return <CandlesUpIcon size={18} />;
    case 'line':
      return (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <polyline
            points="2 12 6.5 8.5 10.5 11 16 5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="2" cy="12" r="1.2" fill="currentColor" />
          <circle cx="6.5" cy="8.5" r="1.1" fill="currentColor" opacity="0.85" />
          <circle cx="10.5" cy="11" r="1.1" fill="currentColor" opacity="0.7" />
          <circle cx="16" cy="5" r="1.2" fill="currentColor" />
        </svg>
      );
    case 'area':
      return (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path
            d="M2 12L6.2 7.4C6.5 7 7.08 6.95 7.5 7.28L10.2 9.36C10.6 9.67 11.15 9.63 11.5 9.27L16 5V14H2V12Z"
            fill="currentColor"
            opacity="0.25"
          />
          <polyline
            points="2 12 6.2 7.4 10.2 10 16 5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    default:
      return null;
  }
};

export const isTradeDemo = (trade: any): boolean => trade?.isDemo === true || trade?.is_demo === true;

