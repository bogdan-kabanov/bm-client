import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Notification as NotificationType } from './types';
import './Notification.css';

interface NotificationProps {
  notification: NotificationType;
  index: number;
  onClose: (id: string) => void;
}

export const Notification: React.FC<NotificationProps> = ({ notification, index, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasStartedTimer = useRef(false);
  const onCloseRef = useRef(onClose);
  const notificationIdRef = useRef(notification.id);

  useEffect(() => {
    onCloseRef.current = onClose;
    notificationIdRef.current = notification.id;
  }, [onClose, notification.id]);

  useEffect(() => {
    requestAnimationFrame(() => {
      setIsVisible(true);
    });
  }, []);

  const handleClose = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      onCloseRef.current(notificationIdRef.current);
    }, 300);
  }, []);

  useEffect(() => {
    if (isVisible && !hasStartedTimer.current) {
      hasStartedTimer.current = true;
      timeoutRef.current = setTimeout(() => {
        handleClose();
      }, 5000);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isVisible, handleClose]);

  const getTypeStyles = () => {
    switch (notification.type) {
      case 'error':
        return 'notification--error';
      case 'warning':
        return 'notification--warning';
      case 'success':
        return 'notification--success';
      default:
        return '';
    }
  };

  const topOffset = index * 90;

  return (
    <div
      className={`notification ${getTypeStyles()} ${isVisible ? 'notification--visible' : ''} ${isExiting ? 'notification--exiting' : ''}`}
      style={{ top: `${topOffset}px` }}
      onClick={handleClose}
    >
      <div className="notification__content">
        <div className="notification__message">{notification.message}</div>
      </div>
    </div>
  );
};

