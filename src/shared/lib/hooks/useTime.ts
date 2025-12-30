import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '@src/app/store';
import { updateTime } from '../timeSlice';
import { useEffect, useRef } from 'react';
import { syncServerTime } from '../serverTime';

export const useTime = () => {
  const dispatch = useDispatch();
  const currentTime = useSelector((state: RootState) => state.time.currentTime);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Получаем время с сервера при инициализации
    syncServerTime().then(() => {
      dispatch(updateTime());
    }).catch(() => {
      dispatch(updateTime());
    });
    
    // Обновляем время каждую секунду (интерполированное серверное время)
    intervalRef.current = setInterval(() => {
      dispatch(updateTime());
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [dispatch]);

  return currentTime;
};

export const useTimeSelector = () => {
  return useSelector((state: RootState) => state.time.currentTime);
};

