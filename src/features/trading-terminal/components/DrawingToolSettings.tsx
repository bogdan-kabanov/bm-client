import React from 'react';
import { ColorPicker } from './ColorPicker';
import './DrawingToolSettings.css';

interface DrawingToolSettingsProps {
  is_open: boolean;
  line_width: number;
  color: string;
  on_line_width_change: (width: number) => void;
  on_color_change: (color: string) => void;
  min_width?: number;
  max_width?: number;
}

export const DrawingToolSettings: React.FC<DrawingToolSettingsProps> = ({
  is_open,
  line_width,
  color,
  on_line_width_change,
  on_color_change,
  min_width = 1,
  max_width = 10,
}) => {
  const handle_slider_change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const new_width = parseInt(e.target.value, 10);
    on_line_width_change(new_width);
  };

  return (
    <div className={`drawing-tool-settings ${is_open ? 'drawing-tool-settings--open' : ''}`}>
      <div className="drawing-tool-settings__content">
        <label className="drawing-tool-settings__label">Настройки линии</label>
        
        {/* Толщина линии */}
        <div className="drawing-tool-settings__section">
          <label className="drawing-tool-settings__section-label">Толщина</label>
          <div className="drawing-tool-settings__control">
            <input
              type="range"
              min={min_width}
              max={max_width}
              value={line_width}
              onChange={handle_slider_change}
              className="drawing-tool-settings__input"
            />
            <span className="drawing-tool-settings__value">{line_width}px</span>
          </div>
          <div className="drawing-tool-settings__preview">
            <div
              className="drawing-tool-settings__preview-line"
              style={{ 
                width: `${(line_width / max_width) * 100}%`, 
                height: `${line_width * 2}px`,
                backgroundColor: color,
              }}
            />
          </div>
        </div>

        {/* Цвет линии */}
        <div className="drawing-tool-settings__section">
          <label className="drawing-tool-settings__section-label">Цвет</label>
          <ColorPicker color={color} onChange={on_color_change} />
        </div>
      </div>
    </div>
  );
};

