import { useCallback, useEffect, useMemo, useState } from 'react';

import type { ChartTimeframe } from '@/src/features/charts/ui/types';

import { CHART_VIEW_SEQUENCE, type ChartViewMode } from '../constants/chart';

type UseChartControlsResult = {
  chartView: ChartViewMode;
  setChartView: (view: ChartViewMode) => void;
  cycleChartView: () => void;
  autoFollow: boolean;
  setAutoFollow: (value: boolean) => void;
  timeframe: ChartTimeframe;
  setTimeframe: (value: ChartTimeframe) => void;
  showIndicatorsMenu: boolean;
  setShowIndicatorsMenu: (value: boolean) => void;
  activeIndicators: string[];
  toggleIndicator: (indicatorId: string) => void;
};

const readStoredChartView = (): ChartViewMode => {
  if (typeof window === 'undefined') {
    return 'candles';
  }
  const stored = localStorage.getItem('chartView');
  if (stored === 'line' || stored === 'area' || stored === 'candles') {
    return stored;
  }
  return 'candles';
};

export const useChartControls = (): UseChartControlsResult => {
  const [chartView, setChartViewState] = useState<ChartViewMode>(readStoredChartView);
  const [autoFollow, setAutoFollow] = useState<boolean>(true);
  const [timeframe, setTimeframe] = useState<ChartTimeframe>('15s');
  const [showIndicatorsMenu, setShowIndicatorsMenu] = useState(false);
  const [activeIndicators, setActiveIndicators] = useState<string[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    localStorage.setItem('chartView', chartView);
  }, [chartView]);

  const setChartView = useCallback((view: ChartViewMode) => {
    setChartViewState(view);
  }, []);

  const cycleChartView = useCallback(() => {
    setChartViewState((prev) => {
      const currentIndex = CHART_VIEW_SEQUENCE.indexOf(prev);
      const nextIndex = (currentIndex + 1) % CHART_VIEW_SEQUENCE.length;
      return CHART_VIEW_SEQUENCE[nextIndex];
    });
  }, []);


  const toggleIndicator = useCallback((indicatorId: string) => {
    setActiveIndicators((prev) =>
      prev.includes(indicatorId) ? prev.filter((id) => id !== indicatorId) : [...prev, indicatorId],
    );
  }, []);

  return {
    chartView,
    setChartView,
    cycleChartView,
    autoFollow,
    setAutoFollow,
    timeframe,
    setTimeframe,
    showIndicatorsMenu,
    setShowIndicatorsMenu,
    activeIndicators,
    toggleIndicator,
  };
};

