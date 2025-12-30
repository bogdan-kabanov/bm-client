import React from 'react';
import ReactCountryFlag from 'react-country-flag';
import './CountryFlag.css';

interface CountryFlagProps {
  countryCode: string;
  size?: number;
  className?: string;
}

/**
 * Компонент для отображения флага страны
 * Использует react-country-flag для надежного отображения SVG флагов во всех браузерах
 */
export const CountryFlag: React.FC<CountryFlagProps> = ({ 
  countryCode, 
  size = 20,
  className = '' 
}) => {
  if (!countryCode || countryCode.length !== 2) {
    return null;
  }

  const code = countryCode.toUpperCase();
  
  return (
    <span 
      className={`country-flag ${className}`}
      style={{ 
        display: 'inline-block',
        lineHeight: '1',
        width: `${size}px`,
        height: `${size}px`,
        flexShrink: 0
      }}
      aria-label={`Flag of ${code}`}
      role="img"
      data-country={code}
      title={`Flag of ${code}`}
    >
      <ReactCountryFlag
        countryCode={code}
        svg
        style={{
          width: `${size}px`,
          height: `${size}px`,
          display: 'block'
        }}
        title={code}
      />
    </span>
  );
};

