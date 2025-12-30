import { apiClient } from '../client';
import type { SupportTicket, SupportMessage, Notification, NotificationReply } from './types';

export const supportApi = {
  createTicket: (subject?: string, message?: string) =>
    apiClient<{ success: boolean; ticket: SupportTicket }>('/support/tickets', {
      method: 'POST',
      body: { subject, message }
    }).then(response => {
      if (Array.isArray(response)) {
        throw new Error('Failed to create ticket');
      }
      const data = response as any;
      if (data.success && data.ticket) {
        return data.ticket;
      }
      throw new Error(data.error || 'Failed to create ticket');
    }),

  getMyTickets: () =>
    apiClient<{ success: boolean; tickets: SupportTicket[] }>('/support/tickets')
      .then(response => {
        if (Array.isArray(response)) {
          return response;
        }
        const data = response as any;
        if (data.success && data.tickets) {
          return data.tickets;
        }
        throw new Error(data.error || 'Failed to load tickets');
      }),

  getTicketMessages: (ticketId: number) =>
    apiClient<{ success: boolean; messages: SupportMessage[] }>(`/support/tickets/${ticketId}/messages`)
      .then(response => {
        if (Array.isArray(response)) {
          return response;
        }
        const data = response as any;
        if (data.success && data.messages) {
          return data.messages;
        }
        throw new Error(data.error || 'Failed to load messages');
      }),

  sendUserMessage: (ticketId: number, message: string, files?: File[]) =>
    (async () => {
      if (files && files.length > 0) {
        const formData = new FormData();
        formData.append('message', message);
        files.forEach((file) => {
          formData.append('files', file);
        });
        
        return apiClient<{ success: boolean; message: SupportMessage }>(`/support/tickets/${ticketId}/messages`, {
          method: 'POST',
          body: formData
        }).then(response => {
          if (Array.isArray(response)) {
            throw new Error('Failed to send message');
          }
          const data = response as any;
          if (data.success && data.message) {
            return data.message;
          }
          throw new Error(data.error || 'Failed to send message');
        });
      } else {
        return apiClient<{ success: boolean; message: SupportMessage }>(`/support/tickets/${ticketId}/messages`, {
          method: 'POST',
          body: { message }
        }).then(response => {
          if (Array.isArray(response)) {
            throw new Error('Failed to send message');
          }
          const data = response as any;
          if (data.success && data.message) {
            return data.message;
          }
          throw new Error(data.error || 'Failed to send message');
        });
      }
    })(),
};

export const notificationApi = {
  getNotifications: () =>
    apiClient<{ success: boolean; notifications: Notification[] }>('/support/notifications')
      .then(response => {
        if (Array.isArray(response)) {
          return response;
        }
        const data = response as any;
        if (data.success && data.notifications) {
          return data.notifications;
        }
        throw new Error(data.error || 'Failed to load notifications');
      }),

  getUnreadCount: () =>
    apiClient<{ success: boolean; count: number }>('/support/notifications/unread/count')
      .then(response => {
        if (Array.isArray(response)) {
          return 0;
        }
        const data = response as any;
        if (data.success && typeof data.count === 'number') {
          return data.count;
        }
        return 0;
      }),

  markAsRead: (notificationId: number) =>
    apiClient<{ success: boolean; notification: Notification }>(`/support/notifications/${notificationId}/read`, {
      method: 'POST'
    }).then(response => {
      if (Array.isArray(response)) {
        throw new Error('Failed to mark notification as read');
      }
      const data = response as any;
      if (data.success && data.notification) {
        return data.notification;
      }
      throw new Error(data.error || 'Failed to mark notification as read');
    }),

  markAllAsRead: () =>
    apiClient<{ success: boolean }>('/support/notifications/read-all', {
      method: 'POST'
    }).then(response => {
      if (Array.isArray(response)) {
        throw new Error('Failed to mark all notifications as read');
      }
      const data = response as any;
      if (data.success) {
        return true;
      }
      throw new Error(data.error || 'Failed to mark all notifications as read');
    }),

  getNotificationReplies: (notificationId: number) =>
    apiClient<{ success: boolean; replies: NotificationReply[] }>(`/support/notifications/${notificationId}/replies`)
      .then(response => {
        if (Array.isArray(response)) {
          return response;
        }
        const data = response as any;
        if (data.success && data.replies) {
          return data.replies;
        }
        throw new Error(data.error || 'Failed to load notification replies');
      }),

  sendReply: (notificationId: number, message: string) =>
    apiClient<{ success: boolean; reply: NotificationReply }>(`/support/notifications/${notificationId}/replies`, {
      method: 'POST',
      body: { message }
    }).then(response => {
      if (Array.isArray(response)) {
        throw new Error('Failed to send reply');
      }
      const data = response as any;
      if (data.success && data.reply) {
        return data.reply;
      }
      throw new Error(data.error || 'Failed to send reply');
    }),
};
