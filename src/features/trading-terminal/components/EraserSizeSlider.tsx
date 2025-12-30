import React from 'react';
import './EraserSizeSlider.css';

interface EraserSizeSliderProps {
  isOpen: boolean;
  eraserRadius: number;
  onRadiusChange: (radius: number) => void;
  min?: number;
  max?: number;
}

export const EraserSizeSlider: React.FC<EraserSizeSliderProps> = ({
  isOpen,
  eraserRadius,
  onRadiusChange,
  min = 5,
  max = 50,
}) => {
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newRadius = parseInt(e.target.value, 10);
    onRadiusChange(newRadius);
  };

  return (
    <div className={`eraser-size-slider ${isOpen ? 'eraser-size-slider--open' : ''}`}>
      <div className="eraser-size-slider__content">
        <label className="eraser-size-slider__label">Размер ластика</label>
        <div className="eraser-size-slider__control">
          <input
            type="range"
            min={min}
            max={max}
            value={eraserRadius}
            onChange={handleSliderChange}
            className="eraser-size-slider__input"
          />
          <span className="eraser-size-slider__value">{eraserRadius}px</span>
        </div>
        <div className="eraser-size-slider__preview">
          <div
            className="eraser-size-slider__preview-circle"
            style={{ width: `${(eraserRadius / max) * 100}%`, height: `${(eraserRadius / max) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
};

