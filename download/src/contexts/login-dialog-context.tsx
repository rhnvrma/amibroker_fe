"use client";

import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';

type LoginDialogContextType = {
  isLoginDialogOpen: boolean;
  openLoginDialog: () => void;
  closeLoginDialog: () => void;
};

const LoginDialogContext = createContext<LoginDialogContextType | undefined>(undefined);

export function LoginDialogProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const openLoginDialog = useCallback(() => setIsOpen(true), []);
  const closeLoginDialog = useCallback(() => setIsOpen(false), []);

  return (
    <LoginDialogContext.Provider value={{ isLoginDialogOpen: isOpen, openLoginDialog, closeLoginDialog }}>
      {children}
    </LoginDialogContext.Provider>
  );
}

export function useLoginDialog() {
  const context = useContext(LoginDialogContext);
  if (context === undefined) {
    throw new Error("useLoginDialog must be used within a LoginDialogProvider");
  }
  return context;
}
