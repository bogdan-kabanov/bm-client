import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface ChatDropdownContextType {
  isOpen: boolean;
  openChat: () => void;
  closeChat: () => void;
  toggleChat: () => void;
}

const ChatDropdownContext = createContext<ChatDropdownContextType | undefined>(undefined);

export const useChatDropdown = () => {
  const context = useContext(ChatDropdownContext);
  if (!context) {
    throw new Error('useChatDropdown must be used within ChatDropdownProvider');
  }
  return context;
};

interface ChatDropdownProviderProps {
  children: ReactNode;
}

export const ChatDropdownProvider: React.FC<ChatDropdownProviderProps> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);

  const openChat = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeChat = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggleChat = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  return (
    <ChatDropdownContext.Provider value={{ isOpen, openChat, closeChat, toggleChat }}>
      {children}
    </ChatDropdownContext.Provider>
  );
};

