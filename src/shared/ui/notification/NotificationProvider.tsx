import React, { useState, useCallback, useEffect, useMemo, useRef, createContext, useContext } from 'react';
import { NotificationContainer } from './NotificationContainer';
import { Notification, NotificationType } from './types';

interface NotificationContextType {
  showNotification: (type: NotificationType, message: string) => void;
  showError: (message: string) => void;
  showWarning: (message: string) => void;
  showSuccess: (message: string) => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

interface NotificationProviderProps {
  children: React.ReactNode;
}

const notificationRefs = {
  showNotification: null as ((type: NotificationType, message: string) => void) | null,
  showError: null as ((message: string) => void) | null,
  showWarning: null as ((message: string) => void) | null,
  showSuccess: null as ((message: string) => void) | null,
};

export const NotificationProvider: React.FC<NotificationProviderProps> = React.memo(({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const showNotification = useCallback((type: NotificationType, message: string) => {
    setNotifications((prev) => {
    const id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const notification: Notification = {
      id,
      type,
      message,
      timestamp: Date.now(),
    };
      return [...prev, notification];
    });
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => {
      const filtered = prev.filter((n) => n.id !== id);
      return filtered;
    });
  }, []);

  const showError = useCallback((message: string) => {
    showNotification('error', message);
  }, [showNotification]);

  const showWarning = useCallback((message: string) => {
    showNotification('warning', message);
  }, [showNotification]);

  const showSuccess = useCallback((message: string) => {
    showNotification('success', message);
  }, [showNotification]);

  const stableShowNotification = useRef(showNotification);
  const stableShowError = useRef(showError);
  const stableShowWarning = useRef(showWarning);
  const stableShowSuccess = useRef(showSuccess);

  useEffect(() => {
    stableShowNotification.current = showNotification;
    stableShowError.current = showError;
    stableShowWarning.current = showWarning;
    stableShowSuccess.current = showSuccess;
  }, [showNotification, showError, showWarning, showSuccess]);


  const contextValue = useMemo<NotificationContextType>(() => {
    return {
      showNotification,
      showError,
      showWarning,
      showSuccess,
    };
  }, [showNotification, showError, showWarning, showSuccess]);

  if (typeof window === 'undefined') {
    return <>{children}</>;
  }


  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
      {notifications.length > 0 && (
      <NotificationContainer notifications={notifications} onClose={removeNotification} />
      )}
    </NotificationContext.Provider>
  );
});

export const useNotification = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider');
  }
  return context;
};


