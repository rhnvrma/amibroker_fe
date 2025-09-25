import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { WatchlistProvider } from "@/contexts/watchlist-context";
import { LoginDialogProvider } from "@/contexts/login-dialog-context";
import TitleBar from "@/components/titlebar";

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
      {/* The <head> tag should be the first child of <html> */}
      <head>
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

      {/* The <body> tag comes after <head> */}
      <body className="font-body antialiased">
        <TitleBar /> {/* TitleBar should be the first item in the body */}
        <div className="content-area">
          <WatchlistProvider>
            <LoginDialogProvider>{children}</LoginDialogProvider>
          </WatchlistProvider>
          <Toaster />
        </div>
      </body>
    </html>
  );
}