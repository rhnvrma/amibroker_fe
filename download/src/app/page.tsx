import { Dashboard } from "@/components/dashboard";
import { WatchlistProvider } from "@/contexts/watchlist-context";

export default function Home() {
  return (
    <WatchlistProvider>
      <Dashboard />
    </WatchlistProvider>
  );
}
