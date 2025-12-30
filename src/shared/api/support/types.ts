export interface SupportTicket {
  id: number;
  user_id: number;
  status: 'open' | 'closed';
  subject?: string | null;
}

export interface SupportMessageFile {
  id: number;
  message_id: number;
  file_url: string;
  file_name: string;
  file_type: string;
  file_size: number;
  createdAt: string;
}

export interface SupportMessage {
  id: number;
  ticket_id: number;
  sender_id: number;
  sender_role: 'user' | 'admin';
  message: string;
  files?: SupportMessageFile[];
  createdAt: string;
}

export interface Notification {
  id: number;
  user_id: number | null;
  sender_id: number;
  title: string;
  message: string;
  is_read: boolean;
  allow_reply: boolean;
  createdAt: string;
  updatedAt: string;
  sender?: {
    id: number;
    email: string;
    username: string | null;
  };
}

export interface NotificationReply {
  id: number;
  notification_id: number;
  sender_id: number;
  sender_role: 'user' | 'admin';
  message: string;
  createdAt: string;
  updatedAt: string;
}
