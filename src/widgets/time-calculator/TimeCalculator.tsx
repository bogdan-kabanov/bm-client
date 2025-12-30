import React, { useState, useEffect, useRef } from 'react';
import './TimeCalculator.css';

interface TimeCalculatorProps {
  position: { left: number; top: number };
  onClose: () => void;
  currentSeconds: number;
  onTimeChange: (seconds: number) => void;
  quickPresets: Array<{ label: string; seconds: number }>;
  isNarrow?: boolean;
}

export const TimeCalculator: React.FC<TimeCalculatorProps> = ({
  position,
  onClose,
  currentSeconds,
  onTimeChange,
  quickPresets,
  isNarrow = false
}) => {
  const calculatorRef = useRef<HTMLDivElement>(null);
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const totalSeconds = currentSeconds || 0;
    setHours(Math.floor(totalSeconds / 3600));
    setMinutes(Math.floor((totalSeconds % 3600) / 60));
    setSeconds(totalSeconds % 60);
  }, [currentSeconds]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (calculatorRef.current && !calculatorRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const updateTime = (newHours: number, newMinutes: number, newSeconds: number) => {
    const totalSeconds = newHours * 3600 + newMinutes * 60 + newSeconds;
    onTimeChange(totalSeconds);
  };

  const handleIncrement = (type: 'hours' | 'minutes' | 'seconds') => {
    if (type === 'hours') {
      const newHours = hours + 1;
      updateTime(newHours, minutes, seconds);
    } else if (type === 'minutes') {
      const newMinutes = minutes >= 59 ? 0 : minutes + 1;
      const newHours = minutes >= 59 ? hours + 1 : hours;
      updateTime(newHours, newMinutes, seconds);
    } else {
      const newSeconds = seconds >= 59 ? 0 : seconds + 1;
      const newMinutes = seconds >= 59 ? (minutes >= 59 ? 0 : minutes + 1) : minutes;
      const newHours = seconds >= 59 && minutes >= 59 ? hours + 1 : hours;
      updateTime(newHours, newMinutes, newSeconds);
    }
  };

  const handleDecrement = (type: 'hours' | 'minutes' | 'seconds') => {
    if (type === 'hours') {
      const newHours = Math.max(0, hours - 1);
      updateTime(newHours, minutes, seconds);
    } else if (type === 'minutes') {
      const newMinutes = minutes <= 0 ? 59 : minutes - 1;
      const newHours = minutes <= 0 ? Math.max(0, hours - 1) : hours;
      updateTime(newHours, newMinutes, seconds);
    } else {
      const newSeconds = seconds <= 0 ? 59 : seconds - 1;
      const newMinutes = seconds <= 0 ? (minutes <= 0 ? 59 : minutes - 1) : minutes;
      const newHours = seconds <= 0 && minutes <= 0 ? Math.max(0, hours - 1) : hours;
      updateTime(newHours, newMinutes, newSeconds);
    }
  };

  const handleQuickSelect = (presetSeconds: number) => {
    onTimeChange(presetSeconds);
  };

  const formatTime = (value: number) => {
    return value.toString().padStart(2, '0');
  };


  return (
    <div 
      className={`time-calculator ${isNarrow ? 'time-calculator--narrow' : ''}`}
      ref={calculatorRef}
      style={{
        left: `${position.left}px`,
        top: `${position.top}px`
      }}
    >
      <div className="time-calculator-display">
        <div className="time-input-group">
          <div className="time-input-control">
            <button className="time-operator-btn" onClick={() => handleIncrement('hours')}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
            <input
              type="text"
              className="time-input"
              value={formatTime(hours)}
              readOnly
            />
            <button className="time-operator-btn" onClick={() => handleDecrement('hours')}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
          </div>
          <span className="time-separator">:</span>
          <div className="time-input-control">
            <button className="time-operator-btn" onClick={() => handleIncrement('minutes')}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
            <input
              type="text"
              className="time-input"
              value={formatTime(minutes)}
              readOnly
            />
            <button className="time-operator-btn" onClick={() => handleDecrement('minutes')}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
          </div>
          <span className="time-separator">:</span>
          <div className="time-input-control">
            <button className="time-operator-btn" onClick={() => handleIncrement('seconds')}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
            <input
              type="text"
              className="time-input"
              value={formatTime(seconds)}
              readOnly
            />
            <button className="time-operator-btn" onClick={() => handleDecrement('seconds')}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
          </div>
        </div>
      </div>
      <div className="time-quick-buttons">
        {quickPresets.map(preset => (
          <button
            key={preset.label}
            className={`time-quick-btn ${currentSeconds === preset.seconds ? 'active' : ''}`}
            onClick={() => handleQuickSelect(preset.seconds)}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
};

