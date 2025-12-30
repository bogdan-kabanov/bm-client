import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface MobileMenuContextType {
  isMobileMenuOpen: boolean;
  toggleMobileMenu: () => void;
  openMobileMenu: () => void;
  closeMobileMenu: () => void;
}

const MobileMenuContext = createContext<MobileMenuContextType | undefined>(undefined);

export const MobileMenuProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = useCallback(() => {
    setIsMobileMenuOpen(prev => !prev);
  }, []);

  const openMobileMenu = useCallback(() => {
    setIsMobileMenuOpen(true);
  }, []);

  const closeMobileMenu = useCallback(() => {
    setIsMobileMenuOpen(false);
  }, []);

  return (
    <MobileMenuContext.Provider value={{ 
      isMobileMenuOpen, 
      toggleMobileMenu,
      openMobileMenu,
      closeMobileMenu
    }}>
      {children}
    </MobileMenuContext.Provider>
  );
};

export const useMobileMenu = () => {
  const context = useContext(MobileMenuContext);
  if (!context) {
    throw new Error('useMobileMenu must be used within MobileMenuProvider');
  }
  return context;
};

