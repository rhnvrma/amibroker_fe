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
      },
      {
        id: "item2",
        name: "NIFTY",
        segment: "NFO_OPT",
        underlying_symbol: "NIFTY",
        instrument_key: "NFO_OPT|53138",
        exchange_token: "53138",
        minimum_lot: 50,
        trading_symbol: "NIFTY 28MAR24 22000 PE",
        strike_price: 22000,
        expiry: new Date("2024-03-28T11:30:00Z").toISOString(),
      },
    ],
  },
  {
    id: "wl2",
    name: "BANKNIFTY Options",
    isDefault: false,
    items: [
       {
        id: "item3",
        name: "BANKNIFTY",
        segment: "NFO_OPT",
        underlying_symbol: "BANKNIFTY",
        instrument_key: "NFO_OPT|40042",
        exchange_token: "40042",
        minimum_lot: 15,
        trading_symbol: "BANKNIFTY 27MAR24 46500 CE",
        strike_price: 46500,
        expiry: new Date("2024-03-27T14:00:00Z").toISOString(),
      },
    ],
  },
  {
    id: "wl3",
    name: "Empty Watchlist",
    isDefault: false,
    items: [],
  },
];