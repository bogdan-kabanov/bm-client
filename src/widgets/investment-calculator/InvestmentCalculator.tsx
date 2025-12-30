import React, { useState, useEffect, useRef } from 'react';
import { getCurrencySymbol } from '@src/shared/lib/currency/currencyUtils';
import './InvestmentCalculator.css';

interface InvestmentCalculatorProps {
  position: { left: number; top: number };
  onClose: () => void;
  currentAmount: string;
  onAmountChange: (amount: string) => void;
  balance: number;
  currency: string;
  minAmount: number;
}

export const InvestmentCalculator: React.FC<InvestmentCalculatorProps> = ({
  position,
  onClose,
  currentAmount,
  onAmountChange,
  balance,
  currency,
  minAmount
}) => {
  const calculatorRef = useRef<HTMLDivElement>(null);
  const [amount, setAmount] = useState(currentAmount || '0');

  useEffect(() => {
    setAmount(currentAmount || '0');
  }, [currentAmount]);

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

  const handleNumberClick = (num: string) => {
    let newAmount: string;
    
    // Если текущее значение "0" и вводится цифра (не точка), заменяем "0" на эту цифру
    if (amount === '0' && num !== '.') {
      newAmount = num;
    } else if (amount === '0' && num === '.') {
      // Если текущее значение "0" и вводится точка, получается "0."
      newAmount = '0.';
    } else {
      // Иначе добавляем символ к текущему значению
      // Проверяем, что точка не добавляется повторно
      if (num === '.' && amount.includes('.')) {
        return; // Точка уже есть, не добавляем
      }
      newAmount = amount + num;
    }
    
    // Проверяем значение
    const numValue = parseFloat(newAmount);
    
    // Если значение невалидно (NaN), разрешаем ввод промежуточных значений (например, "0.")
    if (isNaN(numValue)) {
      if (newAmount.endsWith('.')) {
        setAmount(newAmount);
        onAmountChange(newAmount);
      }
      return;
    }
    
    // Проверяем минимальную сумму ($1) - блокируем ввод значений меньше 1
    // Но разрешаем промежуточные значения (например, "0." - пользователь еще вводит)
    if (numValue < minAmount) {
      // Разрешаем только промежуточное состояние "0." (пользователь еще будет вводить цифры)
      if (newAmount !== '0.') {
        // Блокируем ввод значений меньше минимума
        return;
      }
    }
    
    // Проверяем, что значение не превышает баланс
    if (numValue <= balance) {
      setAmount(newAmount);
      onAmountChange(newAmount);
    }
  };

  const handleBackspace = () => {
    if (amount.length > 1) {
      const newAmount = amount.slice(0, -1);
      setAmount(newAmount);
      onAmountChange(newAmount);
    } else {
      setAmount('0');
      onAmountChange('0');
    }
  };

  const handleQuickAmount = (percent: number) => {
    const quickAmount = (balance * percent / 100).toFixed(2);
    setAmount(quickAmount);
    onAmountChange(quickAmount);
  };

  // Умная функция для определения шага в зависимости от текущего значения
  const getSmartStep = (value: number): number => {
    if (value <= 0) return 1;
    
    // Определяем порядок числа (количество цифр до запятой)
    const integerPart = Math.floor(value);
    if (integerPart === 0) return 1;
    
    const order = Math.floor(Math.log10(integerPart));
    
    // Вычисляем шаг: 10^order
    // Для значений 1-9: order = 0, шаг = 1
    // Для значений 10-99: order = 1, шаг = 10
    // Для значений 100-999: order = 2, шаг = 100
    // И так далее
    return Math.pow(10, order);
  };

  const handleIncrement = () => {
    const currentValue = parseFloat(amount) || 0;
    const step = getSmartStep(currentValue);
    const newValue = Math.min(currentValue + step, balance);
    const newAmount = newValue.toFixed(2);
    setAmount(newAmount);
    onAmountChange(newAmount);
  };

  const handleDecrement = () => {
    const currentValue = parseFloat(amount) || 0;
    const step = getSmartStep(currentValue);
    const newValue = Math.max(currentValue - step, minAmount);
    const newAmount = newValue.toFixed(2);
    setAmount(newAmount);
    onAmountChange(newAmount);
  };

  return (
    <div 
      className="investment-calculator"
      ref={calculatorRef}
      style={{
        left: `${position.left}px`,
        top: `${position.top}px`
      }}
    >
      <div className="investment-calculator-display">
        <div className="investment-amount-display">
          <span className="currency-symbol">{getCurrencySymbol(currency)}</span>
          <span className="amount-value">{amount}</span>
        </div>
      </div>
      
      <div className="investment-calculator-increment-buttons">
        <button className="calc-btn calc-btn-decrement" onClick={handleDecrement}>-</button>
        <button className="calc-btn calc-btn-increment" onClick={handleIncrement}>+</button>
      </div>
      
      <div className="investment-calculator-buttons">
        <div className="calculator-row">
          <button className="calc-btn" onClick={() => handleNumberClick('1')}>1</button>
          <button className="calc-btn" onClick={() => handleNumberClick('2')}>2</button>
          <button className="calc-btn" onClick={() => handleNumberClick('3')}>3</button>
        </div>
        <div className="calculator-row">
          <button className="calc-btn" onClick={() => handleNumberClick('4')}>4</button>
          <button className="calc-btn" onClick={() => handleNumberClick('5')}>5</button>
          <button className="calc-btn" onClick={() => handleNumberClick('6')}>6</button>
        </div>
        <div className="calculator-row">
          <button className="calc-btn" onClick={() => handleNumberClick('7')}>7</button>
          <button className="calc-btn" onClick={() => handleNumberClick('8')}>8</button>
          <button className="calc-btn" onClick={() => handleNumberClick('9')}>9</button>
        </div>
        <div className="calculator-row">
          <button className="calc-btn" onClick={() => handleNumberClick('.')}>.</button>
          <button className="calc-btn" onClick={() => handleNumberClick('0')}>0</button>
          <button className="calc-btn calc-btn-backspace" onClick={handleBackspace}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14zM10 11v6M14 11v6" />
            </svg>
          </button>
        </div>
      </div>
      
      <div className="investment-quick-amounts">
        <button className="quick-amount-btn" onClick={() => handleQuickAmount(25)}>25%</button>
        <button className="quick-amount-btn" onClick={() => handleQuickAmount(50)}>50%</button>
        <button className="quick-amount-btn" onClick={() => handleQuickAmount(75)}>75%</button>
        <button className="quick-amount-btn" onClick={() => handleQuickAmount(100)}>100%</button>
      </div>
    </div>
  );
};

