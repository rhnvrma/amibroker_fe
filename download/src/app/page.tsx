// src/app/page.tsx
"use client";

import { Dashboard } from "@/components/dashboard";
import { LoginForm } from "@/components/login-form";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { useToast } from "@/hooks/use-toast";
import { useWatchlist, updateAvailableItems } from "@/contexts/watchlist-context";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

function ClientPage() {
  const [showLogin, setShowLogin] = useState(false);
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { refreshItems } = useWatchlist();

  useEffect(() => {
    const autoLogin = async () => {
      const changeCredentials = searchParams.get('changeCredentials');
      if (changeCredentials === 'true') {
        setShowLogin(true);
        return;
      }

      const savedCredentials = await window.electron.getCredentials();
      if (savedCredentials) {
        try {
          const response = await window.electron.login(savedCredentials);
          if (response.success) {
            updateAvailableItems(response.refreshedItems);
            toast({
              title: "Login Successful",
              description: "Credentials saved.",
            });
            if (searchParams.get('refreshItems') === 'true') {
                refreshItems();
            }
            setShowLogin(false);
          } else {
            setShowLogin(true);
          }
        } catch (error) {
          setShowLogin(true);
        }
      } else {
        setShowLogin(true);
      }
    };

    if (typeof window.electron !== 'undefined') {
        autoLogin();
    }
  }, [searchParams, toast, refreshItems]);

  const handleLoginSuccess = () => {
    setShowLogin(false);
    refreshItems(true);
  };

  return (
    <>
      <Dashboard />
      <Dialog open={showLogin} onOpenChange={setShowLogin}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Login</DialogTitle>
            <DialogDescription>
              Enter your credentials to access your watchlist.
            </DialogDescription>
          </DialogHeader>
          <LoginForm onLoginSuccess={handleLoginSuccess} />
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ClientPage />
    </Suspense>
  );
}