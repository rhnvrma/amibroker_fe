
import type { WatchlistItem } from './types';

const baseItems: Omit<WatchlistItem, 'id' | 'dateAdded'>[] = [
  {
    name: "NIFTY",
    segment: "NFO_OPT",
    underlying_symbol: "NIFTY",
    instrument_key: "NFO_OPT|53137",
    exchange_token: "53137",
    minimum_lot: 50,
    trading_symbol: "NIFTY 28MAR24 22000 CE",
    strike_price: 22000,
  },
  {
    name: "BANKNIFTY",
    segment: "NFO_OPT",
    underlying_symbol: "BANKNIFTY",
    instrument_key: "NFO_OPT|40042",
    exchange_token: "40042",
    minimum_lot: 15,
    trading_symbol: "BANKNIFTY 27MAR24 46500 CE",
    strike_price: 46500,
  },
  {
    name: "FINNIFTY",
    segment: "NFO_OPT",
    underlying_symbol: "FINNIFTY",
    instrument_key: "NFO_OPT|41252",
    exchange_token: "41252",
    minimum_lot: 40,
    trading_symbol: "FINNIFTY 26MAR24 20750 CE",
    strike_price: 20750,
  },
  {
    name: "RELIANCE",
    segment: "NSE_EQ",
    underlying_symbol: "RELIANCE",
    instrument_key: "NSE_EQ|RELIANCE",
    exchange_token: "2885",
    minimum_lot: 1,
    trading_symbol: "RELIANCE-EQ",
    strike_price: 2900,
  },
];


export const availableItems: Omit<WatchlistItem, 'id' | 'dateAdded'>[] = [];

for (let i = 0; i < 5000; i++) {
  const base = baseItems[i % baseItems.length];
  const strikePrice = base.strike_price + Math.floor(Math.random() * 20) * 50;
  const type = i % 2 === 0 ? 'CE' : 'PE';

  availableItems.push({
    ...base,
    instrument_key: `${base.segment}|${parseInt(base.exchange_token) + i}`,
    exchange_token: `${parseInt(base.exchange_token) + i}`,
    trading_symbol: `${base.underlying_symbol} ${i % 28}APR24 ${strikePrice} ${type}`,
    strike_price: strikePrice
  });
}
