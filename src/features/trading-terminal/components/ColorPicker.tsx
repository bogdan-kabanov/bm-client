import React, { useState, useRef, useEffect, useCallback } from 'react';
import './ColorPicker.css';

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
}

export const ColorPicker: React.FC<ColorPickerProps> = ({ color, onChange }) => {
  const [hue, setHue] = useState(0);
  const [saturation, setSaturation] = useState(100);
  const [lightness, setLightness] = useState(50);
  const [alpha, setAlpha] = useState(1);
  const [isDragging, setIsDragging] = useState<'hue' | 'saturation' | 'lightness' | 'alpha' | null>(null);
  
  const colorSquareRef = useRef<HTMLDivElement>(null);
  const hueSliderRef = useRef<HTMLDivElement>(null);
  const alphaSliderRef = useRef<HTMLDivElement>(null);

  // Конвертируем hex в HSL
  const hexToHsl = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }

    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100),
    };
  };

  // Конвертируем HSL в hex
  const hslToHex = (h: number, s: number, l: number, a: number = 1) => {
    l /= 100;
    const sat = s * Math.min(l, 1 - l) / 100;
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      const color = l - sat * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  };

  // Инициализация из цвета (только при первом монтировании)
  const isInitialized = useRef(false);
  useEffect(() => {
    if (!isInitialized.current && color && color.startsWith('#')) {
      const hsl = hexToHsl(color);
      setHue(hsl.h);
      setSaturation(hsl.s);
      setLightness(hsl.l);
      isInitialized.current = true;
    }
  }, [color]);

  // Обновляем цвет при изменении HSL
  useEffect(() => {
    if (isInitialized.current) {
      const newColor = hslToHex(hue, saturation, lightness, alpha);
      if (newColor !== color) {
        onChange(newColor);
      }
    }
  }, [hue, saturation, lightness, alpha, color, onChange]);

  const handleColorSquareClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!colorSquareRef.current) return;
    const rect = colorSquareRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    
    setSaturation(Math.round(x * 100));
    setLightness(Math.round((1 - y) * 100));
  }, []);

  const handleHueSliderClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!hueSliderRef.current) return;
    const rect = hueSliderRef.current.getBoundingClientRect();
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    setHue(Math.round(y * 360));
  }, []);

  const handleAlphaSliderClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!alphaSliderRef.current) return;
    const rect = alphaSliderRef.current.getBoundingClientRect();
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    setAlpha(Math.round((1 - y) * 100) / 100);
  }, []);

  const handleMouseDown = (type: 'hue' | 'saturation' | 'lightness' | 'alpha') => {
    setIsDragging(type);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;

    if (isDragging === 'saturation' || isDragging === 'lightness') {
      if (colorSquareRef.current) {
        const rect = colorSquareRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
        
        if (isDragging === 'saturation') {
          setSaturation(Math.round(x * 100));
        } else {
          setLightness(Math.round((1 - y) * 100));
        }
      }
    } else if (isDragging === 'hue') {
      if (hueSliderRef.current) {
        const rect = hueSliderRef.current.getBoundingClientRect();
        const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
        setHue(Math.round(y * 360));
      }
    } else if (isDragging === 'alpha') {
      if (alphaSliderRef.current) {
        const rect = alphaSliderRef.current.getBoundingClientRect();
        const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
        setAlpha(Math.round((1 - y) * 100) / 100);
      }
    }
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(null);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Генерируем градиенты
  const hueGradient = `linear-gradient(to bottom, 
    hsl(0, 100%, 50%), 
    hsl(60, 100%, 50%), 
    hsl(120, 100%, 50%), 
    hsl(180, 100%, 50%), 
    hsl(240, 100%, 50%), 
    hsl(300, 100%, 50%), 
    hsl(360, 100%, 50%))`;
  
  const colorSquareGradient = `linear-gradient(to top, 
    hsl(${hue}, 100%, 0%), 
    hsl(${hue}, 100%, 50%)), 
    linear-gradient(to right, 
    hsl(${hue}, 0%, 50%), 
    hsl(${hue}, 100%, 50%))`;

  const alphaGradient = `linear-gradient(to bottom, 
    ${hslToHex(hue, saturation, lightness, 0)}, 
    ${hslToHex(hue, saturation, lightness, 1)})`;

  return (
    <div className="color-picker">
      <div className="color-picker-main">
        <div 
          ref={colorSquareRef}
          className="color-square"
          style={{ background: colorSquareGradient }}
          onClick={handleColorSquareClick}
          onMouseDown={() => handleMouseDown('saturation')}
        >
          <div 
            className="color-square-indicator"
            style={{
              left: `${saturation}%`,
              top: `${100 - lightness}%`,
            }}
          />
        </div>
        
        <div className="color-picker-sliders">
          <div className="slider-group">
            <div 
              ref={hueSliderRef}
              className="slider hue-slider"
              style={{ background: hueGradient }}
              onClick={handleHueSliderClick}
              onMouseDown={() => handleMouseDown('hue')}
            >
              <div 
                className="slider-indicator"
                style={{ top: `${(hue / 360) * 100}%` }}
              />
            </div>
          </div>
          
          <div className="slider-group">
            <div 
              ref={alphaSliderRef}
              className="slider alpha-slider"
              style={{ background: alphaGradient }}
              onClick={handleAlphaSliderClick}
              onMouseDown={() => handleMouseDown('alpha')}
            >
              <div 
                className="slider-indicator"
                style={{ top: `${(1 - alpha) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>
      
      <div className="color-picker-hex">
        <input 
          type="text" 
          value={hslToHex(hue, saturation, lightness, alpha).toUpperCase()}
          readOnly
          className="color-hex-input"
        />
      </div>
    </div>
  );
};

