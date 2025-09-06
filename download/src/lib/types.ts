export interface WatchlistItem {
  id: string; // Internal ID for UI state
  name: string;
  segment: string;
  underlying_symbol: string;
  instrument_key: string;
  exchange_token: string;
  minimum_lot: number;
  trading_symbol: string;
  strike_price: number;
  expiry: string; 
  dateAdded: string;
  expiry_int:number;
}

export interface Watchlist {
  id: string;
  name: string;
  items: WatchlistItem[];
  isDefault?: boolean;
}
