import React, { useMemo } from 'react';
import { Notification } from './Notification';
import { Notification as NotificationType } from './types';
import './NotificationContainer.css';

interface NotificationContainerProps {
  notifications: NotificationType[];
  onClose: (id: string) => void;
}

export const NotificationContainer: React.FC<NotificationContainerProps> = React.memo(({
  notifications,
  onClose,
}) => {
  const notificationElements = useMemo(() => {
    return notifications.map((notification, index) => (
      <Notification
        key={notification.id}
        notification={notification}
        index={index}
        onClose={onClose}
      />
    ));
  }, [notifications, onClose]);
  return (
    <div className="notification-container">
      {notificationElements}
    </div>
  );
});

