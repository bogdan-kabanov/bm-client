import React from 'react';
import { RollingSquareLoader } from '@src/shared/ui/loader/RollingSquareLoader';
import { useLanguage } from '@src/app/providers/useLanguage';

interface LoadingOverlayProps {
  isLoading?: boolean;
  isLoadingHistory?: boolean;
  errorMessage?: string | null;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ isLoading, isLoadingHistory, errorMessage }) => {
  const { t } = useLanguage();
  
  if (!isLoading) return null;

  return (
    <div className="lightweight-chart">
      <div className="chart-loading-overlay">
        <RollingSquareLoader 
          message={t('trading.loadingTransactions', { defaultValue: 'Loading market data...' })} 
          size="medium" 
        />
        {errorMessage && (
          <div style={{ marginTop: '10px', fontSize: '12px', color: '#ff6b6b' }}>
            {errorMessage}
          </div>
        )}
      </div>
      {isLoadingHistory && (
        <div
          style={{
            position: 'absolute',
            left: '10px',
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 10,
            backgroundColor: 'rgba(20, 22, 30, 0.9)',
            padding: '8px 16px',
            borderRadius: '4px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '12px',
            color: '#fff',
          }}
        >
          <RollingSquareLoader size="small" />
          <span>{t('trading.loadingHistory', { defaultValue: 'Загрузка истории...' })}</span>
        </div>
      )}
    </div>
  );
};

