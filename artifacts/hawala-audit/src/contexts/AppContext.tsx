import React, { createContext, useContext, useState } from 'react';

interface AppContextType {
  isSidebarOpen: boolean;
  setSidebarOpen: (isOpen: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setSidebarOpen] = useState(true);

  return (
    <AppContext.Provider value={{ isSidebarOpen, setSidebarOpen }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}
