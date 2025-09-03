
import { WatchlistProvider } from "@/contexts/watchlist-context";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <WatchlistProvider>{children}</WatchlistProvider>;
}
