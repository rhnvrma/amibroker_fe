import type { Watchlist } from "@/lib/types";

export {};

declare global {
  interface Window {
    electron: {
      send: (channel: string, data?: any) => void;
      login: (credentials: any) => Promise<any>;
      getCredentials: () => Promise<any>;
      refreshItems: () => Promise<any>;
      clearStore: () => Promise<any>;
      exportWatchlistCsv: (watchlist: Watchlist, filename: string) => Promise<any>;
      exportWatchlistJson: (watchlist: Watchlist, filename: string) => Promise<any>;
      selectFolder: () => Promise<string | undefined>;
      saveCredentials: (data: any) => Promise<any>;
      saveAccessToken: () => Promise<any>;
    };
  }
}