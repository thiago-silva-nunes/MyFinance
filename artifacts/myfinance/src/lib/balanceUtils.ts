import type { BankAccount, Transaction, Transfer } from '@/data/mockData';

export interface BalanceSnapshot {
  id: string;
  bankId: string;
  snapshotDate: string; // YYYY-MM-DD
  balance: number;
  createdAt: string;   // ISO timestamptz
}

/**
 * Compute the balance of a bank account at a given date (or "now" if omitted).
 *
 * Logic:
 *  1. Find the most recent snapshot for the bank with snapshotDate <= atDate.
 *  2. If found: start from snapshot.balance + net of transactions/transfers
 *     with date STRICTLY AFTER snapshot.snapshotDate (and <= atDate).
 *  3. If not found: legacy formula — initialBalance + net of all transactions
 *     (with date <= atDate if provided).
 */
export function computeBankBalanceAtDate(
  bankId: string,
  bank: BankAccount,
  transactions: Transaction[],
  transfers: Transfer[],
  snapshots: BalanceSnapshot[],
  atDate?: string, // YYYY-MM-DD; undefined = no upper bound
): number {
  // Filter snapshots for this bank, on or before atDate
  const eligible = snapshots.filter(s =>
    s.bankId === bankId && (!atDate || s.snapshotDate <= atDate),
  );

  if (eligible.length > 0) {
    // Most recent by snapshot_date, then by created_at (both DESC)
    eligible.sort((a, b) =>
      b.snapshotDate.localeCompare(a.snapshotDate) ||
      b.createdAt.localeCompare(a.createdAt),
    );
    const snap = eligible[0];
    let bal = snap.balance;

    for (const t of transactions) {
      if (t.bankId !== bankId) continue;
      if (t.date <= snap.snapshotDate) continue; // strictly after snapshot
      if (atDate && t.date > atDate) continue;
      bal += t.type === 'income' ? t.amount : -t.amount;
    }
    for (const tr of transfers) {
      if (tr.date <= snap.snapshotDate) continue;
      if (atDate && tr.date > atDate) continue;
      if (tr.fromBankId === bankId) bal -= tr.amount;
      if (tr.toBankId === bankId) bal += tr.amount;
    }
    return bal;
  }

  // Legacy: initialBalance + all transactions (optionally bounded by atDate)
  let bal = bank.initialBalance;
  for (const t of transactions) {
    if (t.bankId !== bankId) continue;
    if (atDate && t.date > atDate) continue;
    bal += t.type === 'income' ? t.amount : -t.amount;
  }
  for (const tr of transfers) {
    if (atDate && tr.date > atDate) continue;
    if (tr.fromBankId === bankId) bal -= tr.amount;
    if (tr.toBankId === bankId) bal += tr.amount;
  }
  return bal;
}
