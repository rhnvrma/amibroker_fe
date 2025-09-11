import type { Watchlist } from "@/lib/types";


// Initial watchlist data
export const initialData: Watchlist[] = [
  {
    id: "wl1",
    name: "NIFTY Options",
    isDefault: true,
    items: [
      {
        id: "item1",
        name: "NIFTY",
        segment: "NFO_OPT",
        underlying_symbol: "NIFTY",
        instrument_key: "NFO_OPT|53137",
        exchange_token: "53137",
        minimum_lot: 50,
        trading_symbol: "NIFTY 28MAR24 22000 CE",
        strike_price: 22000,
        expiry: new Date("2024-03-28T10:00:00Z").toISOString(),
        dateAdded: new Date().toISOString(),
        expiry_int: 20240328,
      }
    ],
  },
  {
    id: "wl3",
    name: "Empty Watchlist",
    isDefault: false,
    items: [],
  },
];