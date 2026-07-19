import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);
}

/**
 * Parses a pure date string (YYYY-MM-DD) as a local-timezone Date.
 * Using `new Date("YYYY-MM-DD")` interprets it as UTC midnight, which shifts
 * the displayed date by one day for users in negative UTC offsets (e.g. Brazil UTC-3).
 * This function uses the numeric constructor to create the date in local time.
 *
 * Only use for pure date strings without a time/timezone component.
 * Strings that already contain 'T' or 'Z' should use `new Date()` normally.
 */
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d); // month is 0-indexed; creates date in LOCAL timezone
}

export function formatDate(isoString: string) {
  const date = parseLocalDate(isoString);
  return new Intl.DateTimeFormat('pt-BR', { 
    day: '2-digit', 
    month: 'long', 
    year: 'numeric' 
  }).format(date);
}

export function formatShortDate(isoString: string) {
  const date = parseLocalDate(isoString);
  return new Intl.DateTimeFormat('pt-BR', { 
    day: '2-digit', 
    month: '2-digit',
    year: '2-digit'
  }).format(date);
}

/**
 * Parses a Brazilian-formatted currency string to a number.
 * Handles thousand-separator dots correctly:
 *   "1.234,56" → 1234.56
 *   "1234,56"  → 1234.56
 *   "0,99"     → 0.99
 * Steps: strip non-digit/comma/dot → remove thousand-separator dots → swap decimal comma to dot.
 */
export function parseBRLInput(raw: string): number {
  const cleaned = raw
    .replace(/[^\d,.]/g, '')  // keep only digits, commas, dots
    .replace(/\./g, '')       // remove thousand-separator dots
    .replace(',', '.');       // convert decimal comma to dot
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
}

/**
 * Formats a number as a pt-BR currency input string (e.g. 1234.56 → "1.234,56").
 * Returns '' for zero so input fields stay visually clean.
 */
export function formatBRLInput(val: number): string {
  if (val === 0) return '';
  return val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
