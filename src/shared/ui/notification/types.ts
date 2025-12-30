export type NotificationType = 'error' | 'warning' | 'success';

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  timestamp: number;
}

