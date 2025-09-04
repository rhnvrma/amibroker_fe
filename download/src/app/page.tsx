// src/app/page.tsx
"use client";

import { LoginForm } from "@/components/login-form";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { useToast } from "@/hooks/use-toast";
import { useWatchlist, updateAvailableItems } from "@/contexts/watchlist-context";

function ClientPage() {
  const [showLogin, setShowLogin] = useState(false);
  const router = useRouter();
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
              description: "Credentials saved. Redirecting to dashboard...",
            });
            setTimeout(() => router.push('/dashboard?refreshItems=true'), 2000);
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

    autoLogin();
  }, [router, searchParams, toast]);

  if (!showLogin) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-4">
        <p>Attempting to log in automatically...</p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <LoginForm />
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ClientPage />
    </Suspense>
  );
}