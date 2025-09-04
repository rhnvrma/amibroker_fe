// src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { WatchlistProvider } from "@/contexts/watchlist-context";
import { LoginDialogProvider } from "@/contexts/login-dialog-context";

export const metadata: Metadata = {
  title: "Watchtower",
  description: "A modern Watchlist Manager",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        {/*
          This CSP is configured for development.
          It allows inline scripts and styles, and loading fonts from Google.
          For production, you should consider a more restrictive policy.
        */}
        <meta
          httpEquiv="Content-Security-Policy"
          content="
            default-src 'self';
            script-src 'self' 'unsafe-inline' 'unsafe-eval';
            style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
            font-src 'self' https://fonts.gstatic.com;
          "
        />
      </head>
      <body className="font-body antialiased">
        <WatchlistProvider>
          <LoginDialogProvider>{children}</LoginDialogProvider>
        </WatchlistProvider>
        <Toaster />
      </body>
    </html>
  );
}