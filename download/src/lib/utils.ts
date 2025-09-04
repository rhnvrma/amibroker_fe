// src/lib/utils.ts

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// New helper function to detect Electron
export function isElectron(): boolean {
  return typeof window !== 'undefined' && typeof window.electron !== 'undefined';
}