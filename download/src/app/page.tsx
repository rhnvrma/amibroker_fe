"use client";

import { LoginForm } from "@/components/login-form";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const [showLogin, setShowLogin] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

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
            toast({
              title: "Login Successful",
              description: "Redirecting to dashboard...",
            });
            setTimeout(() => router.push('/dashboard'), 1000);
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