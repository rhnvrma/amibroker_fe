// src/lib/utils.ts

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { WatchlistItem } from "@/lib/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// New helper function to detect Electron
export function isElectron(): boolean {
  return typeof window !== 'undefined' && typeof window.electron !== 'undefined';
}

export const preprocessInstruments = (items: WatchlistItem[]) => {
  const nestedData = new Map<string, Map<string, { expiries: Set<string>, strikes: Set<number> }>>();

  for (const item of items) {
     if (item.segment && item.underlying_symbol){
    if (!nestedData.has(item.segment)) {
      nestedData.set(item.segment, new Map());
    }
    const underlyingMap = nestedData.get(item.segment)!;

    if (!underlyingMap.has(item.underlying_symbol)) {
      underlyingMap.set(item.underlying_symbol, { expiries: new Set(), strikes: new Set() });
    }
    const instrumentData = underlyingMap.get(item.underlying_symbol)!;

    if (item.expiry) {
        instrumentData.expiries.add(item.expiry);
    }
    if (item.strike_price) {
        instrumentData.strikes.add(item.strike_price);
    }
  }}

  return nestedData;
};