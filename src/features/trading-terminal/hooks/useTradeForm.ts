import { useState, useEffect, useRef, useCallback } from 'react';
import { startTransition } from 'react';
import { convertFromUSDSync } from '@src/shared/lib/currency/exchangeRates';

export const useTradeForm = (userCurrency: string, balance: number = 0) => {
  const getDefaultAmount = useCallback(() => {
    if (balance === 0) {
      return '0.00';
    }
    const minAmountUSD = 1;
    if (userCurrency === 'USD') {
      return minAmountUSD.toFixed(2);
    }
    try {
      return convertFromUSDSync(minAmountUSD, userCurrency).toFixed(2);
    } catch (e) {
      return minAmountUSD.toFixed(2);
    }
  }, [userCurrency, balance]);
  
  const [manualTradeAmount, setManualTradeAmountState] = useState<string>(getDefaultAmount());
  const manualTradeAmountRef = useRef<string>(getDefaultAmount());
  
  useEffect(() => {
    const currentValue = parseFloat(manualTradeAmount);
    
    if (balance === 0) {
      // Если баланс 0, сбрасываем на 0
      if (currentValue !== 0) {
        manualTradeAmountRef.current = '0';
        setManualTradeAmountState('0');
      }
    }
    // Убираем автоматическую установку минимума при значении 0
    // Пользователь должен иметь возможность ввести 0
  }, [userCurrency, manualTradeAmount, balance]);
  
  const updateManualTradeAmount = useCallback((value: string) => {
    manualTradeAmountRef.current = value;
    startTransition(() => {
      setManualTradeAmountState(value);
    });
  }, []);
  
  useEffect(() => {
    manualTradeAmountRef.current = manualTradeAmount;
  }, [manualTradeAmount]);

  const [expirationSeconds, setExpirationSecondsState] = useState<string>('30');
  const expirationSecondsRef = useRef<string>(expirationSeconds);
  
  useEffect(() => {
    expirationSecondsRef.current = expirationSeconds;
  }, [expirationSeconds]);
  
  const setExpirationSecondsWithRef = useCallback((value: string) => {
    expirationSecondsRef.current = value;
    startTransition(() => {
      setExpirationSecondsState(value);
    });
  }, []);

  const parsedExpiration = Math.max(30, parseInt(expirationSeconds || '0') || 30);
  
  const changeExpiration = useCallback((delta: number) => {
    const next = Math.max(30, parsedExpiration + delta);
    const nextString = String(next);
    expirationSecondsRef.current = nextString;
    startTransition(() => {
      setExpirationSecondsState(nextString);
    });
  }, [parsedExpiration]);

  const quickPresets: Array<{ label: string; seconds: number }> = [
    { label: '30s', seconds: 30 },
    { label: '1m', seconds: 60 },
    { label: '2m', seconds: 120 },
    { label: '5m', seconds: 300 },
    { label: '10m', seconds: 600 },
    { label: '1h', seconds: 3600 },
  ];

  return {
    manualTradeAmount,
    updateManualTradeAmount,
    manualTradeAmountRef,
    expirationSeconds,
    setExpirationSeconds: setExpirationSecondsWithRef,
    expirationSecondsRef,
    parsedExpiration,
    changeExpiration,
    quickPresets,
  };
};

