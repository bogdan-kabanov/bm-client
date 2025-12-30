import { useState, useEffect, useRef } from 'react';

export const useAnimatedNumber = (targetValue: number, duration: number = 1000, forceReset?: boolean) => {
  const [displayValue, setDisplayValue] = useState(targetValue.toFixed(2));
  const previousValueRef = useRef(targetValue);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    // Если требуется принудительный сброс, сразу устанавливаем новое значение
    if (forceReset) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      setDisplayValue(targetValue.toFixed(2));
      previousValueRef.current = targetValue;
      return;
    }

    // Если значение сильно изменилось (например, при переключении режимов), сразу обновляем
    const difference = Math.abs(targetValue - previousValueRef.current);
    const prevValue = previousValueRef.current;
    // Изменение больше 10% или абсолютное изменение больше 1000 (для больших чисел)
    const isLargeChange = prevValue > 0 ? (difference > prevValue * 0.1 || difference > 1000) : difference > 1000;
    
    if (targetValue !== previousValueRef.current) {
      const oldValue = previousValueRef.current;
      const startTime = Date.now();

      // Отменяем предыдущую анимацию, если она еще идет
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      
      // Если изменение большое, сразу устанавливаем новое значение без анимации
      if (isLargeChange) {
        setDisplayValue(targetValue.toFixed(2));
        previousValueRef.current = targetValue;
        return;
      }

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const currentValue = oldValue + (targetValue - oldValue) * easeOut;

        setDisplayValue(currentValue.toFixed(2));

        if (progress < 1) {
          animationFrameRef.current = requestAnimationFrame(animate);
        } else {
          previousValueRef.current = targetValue;
          animationFrameRef.current = null;
        }
      };

      animationFrameRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [targetValue, duration, forceReset]);

  return displayValue;
};