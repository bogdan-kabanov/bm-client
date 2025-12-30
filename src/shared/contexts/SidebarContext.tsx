import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface SidebarContextType {
  isLeftPanelVisible: boolean;
  isCenterPanelVisible: boolean;
  toggleLeftPanel: () => void;
  toggleCenterPanel: () => void;
  hideLeftPanel: () => void;
  hideCenterPanel: () => void;
  showLeftPanel: () => void;
  showCenterPanel: () => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export const SidebarProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isLeftPanelVisible, setIsLeftPanelVisible] = useState(true);
  const [isCenterPanelVisible, setIsCenterPanelVisible] = useState(true);

  const toggleLeftPanel = useCallback(() => {
    setIsLeftPanelVisible(prev => !prev);
  }, []);

  const toggleCenterPanel = useCallback(() => {
    setIsCenterPanelVisible(prev => !prev);
  }, []);

  const hideLeftPanel = useCallback(() => {
    setIsLeftPanelVisible(false);
  }, []);

  const hideCenterPanel = useCallback(() => {
    setIsCenterPanelVisible(false);
  }, []);

  const showLeftPanel = useCallback(() => {
    setIsLeftPanelVisible(true);
  }, []);

  const showCenterPanel = useCallback(() => {
    setIsCenterPanelVisible(true);
  }, []);

  return (
    <SidebarContext.Provider value={{ 
      isLeftPanelVisible, 
      isCenterPanelVisible,
      toggleLeftPanel,
      toggleCenterPanel,
      hideLeftPanel,
      hideCenterPanel,
      showLeftPanel,
      showCenterPanel
    }}>
      {children}
    </SidebarContext.Provider>
  );
};

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within SidebarProvider');
  }
  return context;
};

