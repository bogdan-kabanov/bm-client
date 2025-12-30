import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface TradesHistoryModalContextType {
  isTradesHistoryModalOpen: boolean;
  openTradesHistoryModal: () => void;
  closeTradesHistoryModal: () => void;
  toggleTradesHistoryModal: () => void;
}

const TradesHistoryModalContext = createContext<TradesHistoryModalContextType | undefined>(undefined);

export const TradesHistoryModalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isTradesHistoryModalOpen, setIsTradesHistoryModalOpen] = useState(false);

  const openTradesHistoryModal = useCallback(() => {
    setIsTradesHistoryModalOpen(true);
  }, []);

  const closeTradesHistoryModal = useCallback(() => {
    setIsTradesHistoryModalOpen(false);
  }, []);

  const toggleTradesHistoryModal = useCallback(() => {
    setIsTradesHistoryModalOpen(prev => {
      const newValue = !prev;
      return newValue;
    });
  }, []);

  return (
    <TradesHistoryModalContext.Provider value={{ 
      isTradesHistoryModalOpen, 
      openTradesHistoryModal,
      closeTradesHistoryModal,
      toggleTradesHistoryModal
    }}>
      {children}
    </TradesHistoryModalContext.Provider>
  );
};

export const useTradesHistoryModal = () => {
  const context = useContext(TradesHistoryModalContext);
  if (!context) {
    throw new Error('useTradesHistoryModal must be used within TradesHistoryModalProvider');
  }
  return context;
};

