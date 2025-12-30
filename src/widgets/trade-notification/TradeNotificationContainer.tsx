import React, { useState, useCallback, useEffect } from 'react';
import { TradeNotification, TradeNotificationData } from './TradeNotification';
import './TradeNotificationContainer.css';

interface TradeNotificationContainerProps {
  children?: React.ReactNode;
}

export const TradeNotificationContext = React.createContext<{
  showNotification: (data: Omit<TradeNotificationData, 'id'>) => void;
}>({
  showNotification: () => {},
});


export const TradeNotificationProvider: React.FC<TradeNotificationContainerProps> = ({ children }) => {
  const [notifications, setNotifications] = useState<TradeNotificationData[]>([]);

  const showNotification = useCallback((data: Omit<TradeNotificationData, 'id'>) => {
    const id = `trade-notification-${Date.now()}-${Math.random()}`;
    const notification: TradeNotificationData = {
      ...data,
      id,
    };

    setNotifications((prev) => {
      return [...prev, notification];
    });
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => {
      const filtered = prev.filter((n) => n.id !== id);
      return filtered;
    });
  }, []);


  return (
    <TradeNotificationContext.Provider value={{ showNotification }}>
      {children}
      <div className="trade-notification-container">
        {notifications.map((notification) => (
          <TradeNotification
            key={notification.id}
            notification={notification}
            onClose={removeNotification}
          />
        ))}
      </div>
    </TradeNotificationContext.Provider>
  );
};

export const useTradeNotification = () => {
  const context = React.useContext(TradeNotificationContext);
  if (!context) {
    throw new Error('useTradeNotification must be used within TradeNotificationProvider');
  }
  return context;
};


