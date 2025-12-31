import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { supportApi, notificationApi, type SupportMessage, type SupportTicket, type Notification, type NotificationReply } from '@src/shared/api';
import { useWebSocket } from '@/src/entities/websoket/useWebSocket';
import { useLanguage } from '@/src/app/providers/useLanguage';
import { FaPaperPlane, FaImage, FaTimes } from 'react-icons/fa';
import ChatIcon from '@src/assets/ChatIcon.png';
import './ChatPanel.css';

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  t: (key: string) => string;
}

type TabType = 'tickets' | 'notifications';
type ViewMode = 'list' | 'chat';

export const ChatPanel: React.FC<ChatPanelProps> = ({ isOpen, onClose, t }) => {
  const websocket = useWebSocket();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [activeTab, setActiveTab] = useState<TabType>('tickets');
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [activeTicketId, setActiveTicketId] = useState<number | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activeNotificationId, setActiveNotificationId] = useState<number | null>(null);
  const [notificationReplies, setNotificationReplies] = useState<NotificationReply[]>([]);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState<number>(0);
  const [input, setInput] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [showPopup, setShowPopup] = useState(false);
  const [showCreateTicketModal, setShowCreateTicketModal] = useState(false);
  const [newTicketMessage, setNewTicketMessage] = useState('');
  const [newTicketSubject, setNewTicketSubject] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isSendingRef = useRef(false);

  const activeTicket = useMemo(() => tickets.find(t => t.id === activeTicketId) || null, [tickets, activeTicketId]);
  const activeNotification = useMemo(() => notifications.find(n => n.id === activeNotificationId) || null, [notifications, activeNotificationId]);

  const addMessage = useCallback((message: SupportMessage) => {
    setMessages(prev => {
      if (prev.some(m => m.id === message.id)) {
        return prev;
      }
      return [...prev, message].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    });
  }, []);

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Загрузка тикетов
  useEffect(() => {
    if (!isOpen) return;
    
    (async () => {
      try {
        const list = await supportApi.getMyTickets();
        setTickets(list);
        if (list.length > 0 && !activeTicketId) {
          // Не устанавливаем активный тикет автоматически, только если его нет
        }
      } catch (error) {
        console.error('Error loading tickets:', error);
      }
    })();
  }, [isOpen]);

  // Загрузка уведомлений
  useEffect(() => {
    if (!isOpen) return;
    
    (async () => {
      try {
        const list = await notificationApi.getNotifications();
        setNotifications(list);
        const count = await notificationApi.getUnreadCount();
        setUnreadNotificationsCount(count);
      } catch (error) {
        console.error('Error loading notifications:', error);
      }
    })();
  }, [isOpen]);

  // Загрузка количества непрочитанных уведомлений
  useEffect(() => {
    if (!isOpen) return;
    
    const loadUnreadCount = async () => {
      try {
        const count = await notificationApi.getUnreadCount();
        setUnreadNotificationsCount(count);
      } catch (error) {
        console.error('Error loading unread count:', error);
      }
    };

    loadUnreadCount();
    const interval = setInterval(loadUnreadCount, 30000);
    
    return () => clearInterval(interval);
  }, [isOpen]);

  useEffect(() => {
    if (!websocket) return;

    const handleSupportTicketOpened = (message: any) => {
      if (message.success) {
        setTickets(prev => [message.ticket, ...prev]);
        setActiveTicketId(message.ticket.id);
      }
    };

    const handleSupportMessageSent = (message: any) => {
      if (message.success) {
        addMessage(message.message);
      }
    };

    const unsubscribe1 = (websocket as any).onMessage('support_ticket_opened', handleSupportTicketOpened);
    const unsubscribe2 = (websocket as any).onMessage('support_message_sent', handleSupportMessageSent);

    return () => {
      unsubscribe1?.();
      unsubscribe2?.();
    };
  }, [websocket, addMessage]);

  useEffect(() => {
    if (!activeTicketId) return;
    (async () => {
      try {
        const list = await supportApi.getTicketMessages(activeTicketId);
        const sortedMessages = list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        setMessages(sortedMessages);
      } catch (error) {
        console.error('Error loading messages:', error);
        setMessages([]);
      }
    })();
  }, [activeTicketId]);

  useEffect(() => {
    if (!activeNotificationId) return;
    (async () => {
      try {
        const replies = await notificationApi.getNotificationReplies(activeNotificationId);
        setNotificationReplies(replies);
      } catch (error) {
        console.error('Error loading notification replies:', error);
        setNotificationReplies([]);
      }
    })();
  }, [activeNotificationId]);

  useEffect(() => {
    if (!websocket) return;

    const off1 = websocket.onMessage('support_new_message', (msg: any) => {
      const m = msg.message as SupportMessage;
      if (m.ticket_id === activeTicketId) {
        addMessage(m);
      }
    });

    const off2 = websocket.onMessage('support_message_sent', (msg: any) => {
      const m = msg.message as SupportMessage;
      if (m.ticket_id === activeTicketId) {
        addMessage(m);
      }
    });

    const off3 = websocket.onMessage('support_ticket_closed', (msg: any) => {
      const updated = msg.ticket as SupportTicket;
      setTickets(prev => prev.map(t => t.id === updated.id ? { ...t, status: updated.status } : t));
    });

    const off4 = websocket.onMessage('new_notification', (msg: any) => {
      const notification = msg.data as Notification;
      setNotifications(prev => [notification, ...prev]);
      setUnreadNotificationsCount(prev => prev + 1);
    });

    const off5 = websocket.onMessage('notification_reply', (msg: any) => {
      if (msg.data && msg.data.notificationId === activeNotificationId) {
        const reply = msg.data.reply as NotificationReply;
        setNotificationReplies(prev => {
          if (prev.some(r => r.id === reply.id)) {
            return prev;
          }
          return [...prev, reply].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        });
      }
    });

    return () => {
      off1?.();
      off2?.();
      off3?.();
      off4?.();
      off5?.();
    };
  }, [websocket, activeTicketId, activeNotificationId, addMessage]);

  const handleSend = async () => {
    // Защита от двойной отправки
    if (isSendingRef.current) {
      console.log('Already sending, ignoring duplicate call');
      return;
    }

    // Handle notification reply
    if (activeNotificationId) {
      if (!input.trim()) return;
      
      // Check if notification allows replies
      const notification = notifications.find(n => n.id === activeNotificationId);
      if (!notification) {
        console.error('Notification not found');
        return;
      }
      
      if (!notification.allow_reply) {
        console.warn('Cannot send reply: notification does not allow replies', notification);
        return;
      }
      
      const messageContent = input.trim();
      setInput('');
      isSendingRef.current = true;
      
      console.log('Sending reply to notification:', activeNotificationId, 'Message:', messageContent);
      try {
        const reply = await notificationApi.sendReply(activeNotificationId, messageContent);
        console.log('Reply sent successfully:', reply);
        // Не добавляем ответ сразу - он придет через WebSocket, чтобы избежать дубликатов
        // Добавим только если WebSocket не добавит в течение 1 секунды
        setTimeout(() => {
          setNotificationReplies(prev => {
            // Проверяем, нет ли уже этого сообщения (избегаем дубликатов)
            if (prev.some(r => r.id === reply.id)) {
              return prev;
            }
            return [...prev, reply].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
          });
          setTimeout(() => {
            scrollToBottom();
          }, 100);
        }, 1000);
      } catch (error) {
        console.error('Error sending notification reply:', error);
        setInput(messageContent);
      } finally {
        isSendingRef.current = false;
      }
      return;
    }

    // Handle ticket message
    if (!activeTicketId || (!input.trim() && selectedFiles.length === 0)) return;
    
    isSendingRef.current = true;
    const messageContent = input.trim();
    setInput('');
    const filesToSend = [...selectedFiles];
    setSelectedFiles([]);
    
    try {
      if (websocket?.isConnected) {
        // Для WebSocket пока отправляем только текст, файлы через API
        websocket.sendMessage({ type: 'support_send_message', ticketId: activeTicketId, text: messageContent });
      }
      
      // Отправляем сообщение с файлами через API
      if (messageContent || filesToSend.length > 0) {
        const sentMessage = await supportApi.sendUserMessage(activeTicketId, messageContent || '', filesToSend);
        addMessage(sentMessage);
      }
      
      setTimeout(() => {
        scrollToBottom();
      }, 100);
    } catch (error) {
      console.error('Error sending message:', error);
      // Возвращаем файлы в случае ошибки
      setSelectedFiles(filesToSend);
      setInput(messageContent);
    } finally {
      isSendingRef.current = false;
    }
  };

  const handleCreateTicket = () => {
    const hasActiveTicket = tickets.some(ticket => ticket.status === 'open');
    if (hasActiveTicket) {
      setShowPopup(true);
      return;
    }
    setShowCreateTicketModal(true);
    setNewTicketMessage('');
    setNewTicketSubject('');
  };

  const handleCloseCreateModal = () => {
    setShowCreateTicketModal(false);
    setNewTicketMessage('');
    setNewTicketSubject('');
  };

  const handleSubmitCreateTicket = async () => {
    if (!newTicketMessage.trim()) {
      return;
    }

    try {
      let newTicket: SupportTicket;
      if (websocket?.isConnected) {
        (websocket as any).sendMessage({ 
          type: 'support_open_ticket', 
          subject: newTicketSubject || t('support.newTicket'),
          message: newTicketMessage 
        });
        // Ждем ответ через WebSocket, но также можем создать через API для надежности
        newTicket = await supportApi.createTicket(
          newTicketSubject || t('support.newTicket'), 
          newTicketMessage
        );
      } else {
        newTicket = await supportApi.createTicket(
          newTicketSubject || t('support.newTicket'), 
          newTicketMessage
        );
      }
      
      setTickets(prev => [newTicket, ...prev]);
      setActiveTicketId(newTicket.id);
      
      const ticketMessages = await supportApi.getTicketMessages(newTicket.id);
      setMessages(ticketMessages);
      
      handleCloseCreateModal();
      setViewMode('chat');
    } catch (error) {
      console.error('Error creating ticket:', error);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    setSelectedFiles(prev => [...prev, ...imageFiles].slice(0, 10)); // Максимум 10 файлов
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const getFilePreview = (file: File): string => {
    return URL.createObjectURL(file);
  };

  const closePopup = () => {
    setShowPopup(false);
  };

  const formatMessageTime = useCallback((created_at: string) => {
    try {
      const message_date = new Date(created_at);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const message_day = new Date(message_date.getFullYear(), message_date.getMonth(), message_date.getDate());
      
      const hours = message_date.getHours().toString().padStart(2, '0');
      const minutes = message_date.getMinutes().toString().padStart(2, '0');
      
      if (message_day.getTime() === today.getTime()) {
        return `${hours}:${minutes}`;
      }
      
      const day = message_date.getDate().toString().padStart(2, '0');
      const month = (message_date.getMonth() + 1).toString().padStart(2, '0');
      return `${day}.${month} ${hours}:${minutes}`;
    } catch {
      return '';
    }
  }, []);

  const handleNotificationClick = async (notification: Notification) => {
    console.log('Notification clicked:', { id: notification.id, allow_reply: notification.allow_reply });
    
    if (!notification.is_read) {
      try {
        await notificationApi.markAsRead(notification.id);
        setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, is_read: true } : n));
        setUnreadNotificationsCount(prev => Math.max(0, prev - 1));
      } catch (error) {
        console.error('Error marking notification as read:', error);
      }
    }

    // Always open notification as a chat to view its content
    setActiveNotificationId(notification.id);
    setActiveTicketId(null);
    setViewMode('chat');
    
    // Load replies only if notification allows replies
    if (notification.allow_reply === true) {
      console.log('Loading replies for notification:', notification.id);
      try {
        const replies = await notificationApi.getNotificationReplies(notification.id);
        console.log('Replies loaded:', replies);
        setNotificationReplies(replies);
      } catch (error) {
        console.error('Error loading notification replies:', error);
        setNotificationReplies([]);
      }
    } else {
      console.log('Notification does not allow replies');
      setNotificationReplies([]);
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    try {
      await notificationApi.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadNotificationsCount(0);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const filteredTickets = useMemo(() => {
    if (!searchQuery.trim()) return tickets;
    const query = searchQuery.toLowerCase();
    return tickets.filter(ticket => 
      ticket.subject?.toLowerCase().includes(query) || 
      ticket.id.toString().includes(query)
    );
  }, [tickets, searchQuery]);

  const handleTicketClick = async (ticketId: number) => {
    setActiveTicketId(ticketId);
    setViewMode('chat');
    // Загружаем сообщения для выбранного тикета
    try {
      const list = await supportApi.getTicketMessages(ticketId);
      const sortedMessages = list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      setMessages(sortedMessages);
    } catch (error) {
      console.error('Error loading messages:', error);
      setMessages([]);
    }
  };

  const handleBackToList = () => {
    setViewMode('list');
    setActiveNotificationId(null);
    setActiveTicketId(null);
  };

  const truncateText = (text: string, maxLength: number = 100): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  return (
    <>
      <aside
        className={`chat-panel ${isOpen ? 'open' : ''}`}
        role="dialog"
        aria-label={t('support.chatTitle')}
      >
        <div className="chat-panel__header">
          <div className="chat-panel__header-left">
            {viewMode === 'chat' ? (
              <button
                type="button"
                className="chat-panel__back-btn"
                onClick={handleBackToList}
                aria-label={t('common.back') || 'Назад'}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
              </button>
            ) : (
              <button
                type="button"
                className="chat-panel__back-btn"
                onClick={onClose}
                aria-label={t('common.close')}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
              </button>
            )}
            <div className="chat-panel__title">
              <h3>
                {viewMode === 'chat' 
                  ? (activeTicket 
                      ? `${t('support.ticketLabel')}${activeTicket.id}` 
                      : activeNotification 
                        ? activeNotification.title 
                        : t('support.chatTitle'))
                  : t('support.chatTitle')
                }
              </h3>
            </div>
          </div>
          <button
            type="button"
            className="chat-panel__close"
            onClick={onClose}
            aria-label={t('common.close')}
            title={t('common.close')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="chat-panel__body">
          {viewMode === 'list' ? (
            <>
              {/* Кнопка создания тикета */}
              <div className="chat-panel__create-ticket-section">
                <button onClick={handleCreateTicket} className="chat-panel__new-ticket-btn">
                  {t('support.createTicket') || 'Создать тикет'}
                </button>
              </div>

              {/* Поиск */}
              <div className="chat-panel__search-container">
                <input
                  type="text"
                  className="chat-panel__search-input"
                  placeholder={t('common.search') || 'Поиск...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <svg className="chat-panel__search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"></circle>
                  <path d="m21 21-4.35-4.35"></path>
                </svg>
              </div>

              {/* Фильтры в стиле chart-navigation-menu */}
              <div className="chat-panel__filters-wrapper">
                <div className="chat-panel__filters">
                  <button
                    className={`chat-panel__filter-pill ${activeTab === 'tickets' ? 'active' : ''}`}
                    onClick={() => setActiveTab('tickets')}
                  >
                    {t('support.ticketsTab')} ({tickets.length})
                  </button>
                  <button
                    className={`chat-panel__filter-pill ${activeTab === 'notifications' ? 'active' : ''}`}
                    onClick={() => setActiveTab('notifications')}
                  >
                    {t('support.notificationsTab')} ({notifications.length})
                  </button>
                </div>
              </div>

              {/* Список чатов/уведомлений */}
              {activeTab === 'tickets' && (
                <div className="chat-panel__chats-list">
                  {filteredTickets.length === 0 ? (
                    <div className="chat-panel__empty-state">
                      {tickets.length === 0 ? 'Нет тикетов' : 'Ничего не найдено'}
                    </div>
                  ) : (
                    filteredTickets.map(ticket => (
                      <div
                        key={ticket.id}
                        onClick={() => handleTicketClick(ticket.id)}
                        className="chat-panel__chat-card"
                      >
                        <img src={ChatIcon} alt="" className="chat-panel__chat-card-icon" />
                        <div className="chat-panel__chat-card-info">
                          <div className="chat-panel__chat-card-title">
                            #{ticket.id} {ticket.subject || t('support.newTicket')}
                          </div>
                          <div className="chat-panel__chat-card-status">
                            {ticket.status === 'open' ? t('support.statusOpen') : t('support.statusClosed')}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'notifications' && (
                <div className="chat-panel__chats-list">
                  {notifications.length === 0 ? (
                    <div className="chat-panel__empty-state">
                      {t('support.noNotifications')}
                    </div>
                  ) : (
                    notifications.map(notification => (
                      <div
                        key={notification.id}
                        className={`chat-panel__notification-card ${!notification.is_read ? 'unread' : ''} ${notification.allow_reply ? 'has-reply' : ''}`}
                        onClick={() => handleNotificationClick(notification)}
                      >
                        <img src={ChatIcon} alt="" className="chat-panel__chat-card-icon" />
                        <div className="chat-panel__chat-card-info">
                          <div className="chat-panel__notification-card-header">
                            <div className="chat-panel__notification-card-title">
                              {notification.title}
                              {notification.allow_reply && (
                                <span className="chat-panel__notification-reply-icon" title="You can reply to this notification">💬</span>
                              )}
                            </div>
                            {!notification.is_read && <span className="chat-panel__notification-unread-dot"></span>}
                          </div>
                          <div className="chat-panel__notification-card-message">{truncateText(notification.message, 100)}</div>
                          <div className="chat-panel__notification-card-time">{formatMessageTime(notification.createdAt)}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          ) : (
            /* Режим чата */
            (activeTicket || activeNotification) && (
              <>
                {activeTicket && (
                  <>
                    <div className="chat-panel__chat-header">
                      <span>{t('support.ticketLabel')}{activeTicket.id} ({activeTicket.status === 'open' ? t('support.statusOpen') : t('support.statusClosed')})</span>
                    </div>
                    <div className="chat-panel__messages-container" ref={messagesContainerRef}>
                      {messages.length === 0 && (
                        <div className="chat-panel__welcome-message">
                          <div className="chat-panel__welcome-icon">✓</div>
                          <div className="chat-panel__welcome-sender">System Pocket</div>
                          <div className="chat-panel__welcome-time">
                            {(() => {
                              const date = new Date();
                              const day = date.getDate().toString().padStart(2, '0');
                              const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                              const month = monthNames[date.getMonth()];
                              const hours = date.getHours().toString().padStart(2, '0');
                              const minutes = date.getMinutes().toString().padStart(2, '0');
                              return `${day} ${month}, ${hours}:${minutes}`;
                            })()}
                          </div>
                          <div className="chat-panel__message-bubble admin">
                            {t('support.welcomeMessage')}
                          </div>
                        </div>
                      )}
                      {messages.map(m => (
                        <div key={m.id} className={`chat-panel__message-item ${m.sender_role}`}>
                          <div className="chat-panel__message-sender">
                            <span>{m.sender_role === 'admin' ? t('support.admin') : t('support.you')}</span>
                            <span className="chat-panel__message-time">{formatMessageTime(m.createdAt)}</span>
                          </div>
                          <div className={`chat-panel__message-bubble ${m.sender_role === 'admin' ? 'admin' : 'user'}`}>
                            {m.message && <div className="chat-panel__message-text">{m.message}</div>}
                            {m.files && m.files.length > 0 && (
                              <div className="chat-panel__message-files">
                                {m.files.map((file) => (
                                  <img
                                    key={file.id}
                                    src={file.file_url}
                                    alt={file.file_name}
                                    className="chat-panel__message-file"
                                    onClick={() => window.open(file.file_url, '_blank')}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                    {activeTicket?.status === 'closed' && (
                      <div className="chat-panel__closed-notice">
                        {t('support.closedPlaceholder')}
                      </div>
                    )}
                    <div className="chat-panel__message-input-area" style={activeTicket?.status === 'closed' ? { opacity: 0.6 } : undefined}>
                      {selectedFiles.length > 0 && (
                        <div className="chat-panel__selected-files">
                          {selectedFiles.map((file, index) => (
                            <div key={index} className="chat-panel__selected-file">
                              <img src={getFilePreview(file)} alt="" className="chat-panel__selected-file-preview" />
                              <button
                                type="button"
                                className="chat-panel__remove-file-btn"
                                onClick={() => handleRemoveFile(index)}
                                aria-label={t('support.removeFile')}
                              >
                                <FaTimes />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="chat-panel__input-wrapper">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handleFileSelect}
                          className="chat-panel__file-input"
                          id="file-input"
                        />
                        <label htmlFor="file-input" className="chat-panel__file-label">
                          <FaImage />
                        </label>
                        <input
                          value={input}
                          onChange={e => setInput(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                          placeholder={activeTicket?.status === 'closed' ? t('support.closedPlaceholder') : t('support.typeMessage')}
                          className="chat-panel__message-input"
                          disabled={activeTicket?.status === 'closed'}
                        />
                        <button 
                          onClick={handleSend} 
                          disabled={(!input.trim() && selectedFiles.length === 0) || activeTicket?.status === 'closed'} 
                          className="chat-panel__send-btn"
                          aria-label={t('support.send')}
                        >
                          <FaPaperPlane />
                        </button>
                      </div>
                    </div>
                  </>
                )}
                {activeNotification && (
                  <>
                    <div className="chat-panel__chat-header">
                      <span>{activeNotification.title}</span>
                    </div>
                    <div className="chat-panel__messages-container" ref={messagesContainerRef}>
                      <div className="chat-panel__message-item admin">
                        <div className="chat-panel__message-sender">
                          <span>{t('support.admin')}</span>
                          <span className="chat-panel__message-time">{formatMessageTime(activeNotification.createdAt)}</span>
                        </div>
                        <div className="chat-panel__message-bubble admin">
                          <div className="chat-panel__message-text">{activeNotification.message}</div>
                        </div>
                      </div>
                      {notificationReplies.map(reply => (
                        <div key={reply.id} className={`chat-panel__message-item ${reply.sender_role}`}>
                          <div className="chat-panel__message-sender">
                            <span>{reply.sender_role === 'admin' ? t('support.admin') : t('support.you')}</span>
                            <span className="chat-panel__message-time">{formatMessageTime(reply.createdAt)}</span>
                          </div>
                          <div className={`chat-panel__message-bubble ${reply.sender_role === 'admin' ? 'admin' : 'user'}`}>
                            <div className="chat-panel__message-text">{reply.message}</div>
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                    {activeNotification.allow_reply === true ? (
                      <div className="chat-panel__message-input-area">
                        <div className="chat-panel__input-wrapper">
                          <input
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                            placeholder={t('support.typeMessage')}
                            className="chat-panel__message-input"
                          />
                          <button 
                            onClick={handleSend} 
                            disabled={!input.trim()} 
                            className="chat-panel__send-btn"
                            aria-label={t('support.send')}
                          >
                            <FaPaperPlane />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="chat-panel__closed-notice">
                        {t('support.notificationNoReply') || 'This notification does not allow replies'}
                      </div>
                    )}
                  </>
                )}
              </>
            )
          )}
        </div>
      </aside>

      {showPopup && (
        <div className="chat-panel__popup-overlay">
          <div className="chat-panel__popup">
            <h3>{t('support.error')}</h3>
            <p>{t('support.cannotCreateWhileOpen')}</p>
            <button onClick={closePopup} className="chat-panel__popup-close-btn">{t('common.close')}</button>
          </div>
        </div>
      )}

      {showCreateTicketModal && (
        <div className="chat-panel__popup-overlay">
          <div className="chat-panel__popup chat-panel__popup--create-ticket">
            <h3>{t('support.createNewTicket')}</h3>
            
            <div className="chat-panel__form-group">
              <label>{t('support.subject')} ({t('common.optional')})</label>
              <input
                type="text"
                value={newTicketSubject}
                onChange={(e) => setNewTicketSubject(e.target.value)}
                placeholder={t('support.subjectPlaceholder')}
                className="chat-panel__form-input"
              />
            </div>

            <div className="chat-panel__form-group">
              <label>{t('support.message')} *</label>
              <textarea
                value={newTicketMessage}
                onChange={(e) => setNewTicketMessage(e.target.value)}
                placeholder={t('support.messagePlaceholder')}
                rows={4}
                className="chat-panel__form-textarea"
              />
            </div>

            <div className="chat-panel__popup-actions">
              <button onClick={handleCloseCreateModal} className="chat-panel__popup-close-btn">
                {t('common.cancel')}
              </button>
              <button 
                onClick={handleSubmitCreateTicket}
                disabled={!newTicketMessage.trim()}
                className="chat-panel__popup-submit-btn"
              >
                {t('support.createTicket')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
