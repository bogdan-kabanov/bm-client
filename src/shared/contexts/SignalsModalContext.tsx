import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface SignalsModalContextType {
  isSignalsModalOpen: boolean;
  openSignalsModal: () => void;
  closeSignalsModal: () => void;
  toggleSignalsModal: () => void;
}

const SignalsModalContext = createContext<SignalsModalContextType | undefined>(undefined);

export const SignalsModalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isSignalsModalOpen, setIsSignalsModalOpen] = useState(false);

  const openSignalsModal = useCallback(() => {
    setIsSignalsModalOpen(true);
  }, []);

  const closeSignalsModal = useCallback(() => {
    setIsSignalsModalOpen(false);
  }, []);

  const toggleSignalsModal = useCallback(() => {
    setIsSignalsModalOpen(prev => {
      const newValue = !prev;
      return newValue;
    });
  }, []);

  return (
    <SignalsModalContext.Provider value={{ 
      isSignalsModalOpen, 
      openSignalsModal,
      closeSignalsModal,
      toggleSignalsModal
    }}>
      {children}
    </SignalsModalContext.Provider>
  );
};

export const useSignalsModal = () => {
  const context = useContext(SignalsModalContext);
  if (!context) {
    throw new Error('useSignalsModal must be used within SignalsModalProvider');
  }
  return context;
};

