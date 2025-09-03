import { ReactNode } from "react";
import { WatchlistProvider } from "@/contexts/watchlist-context";

export default function DashboardLayout({ children }: React.PropsWithChildren) {
  return <WatchlistProvider>{children}</WatchlistProvider>;
}
