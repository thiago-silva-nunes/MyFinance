import { supabase } from '@/lib/supabase';
import type { Category, Subcategory, Transaction, ScheduledTransaction, CreditCard, Invoice, BankAccount, BudgetGroup, Investment, InvestmentTransaction } from '../data/mockData';
import type { BalanceSnapshot } from '../lib/balanceUtils';

const SETTINGS_KEY = 'myfinance_settings';

// ─── Supabase error helper ────────────────────────────────────────────────────

function extractErrorMessage(err: unknown): string {
  if (!err) return 'Erro desconhecido';
  if (typeof err === 'object') {
    // PostgrestError shape: { message, code, details, hint }
    const e = err as Record<string, unknown>;
    const parts: string[] = [];
    if (typeof e.message === 'string') parts.push(e.message);
    if (typeof e.details === 'string' && e.details) parts.push(`Detalhes: ${e.details}`);
    if (typeof e.hint === 'string' && e.hint) parts.push(`Dica: ${e.hint}`);
    if (typeof e.code === 'string' && e.code) parts.push(`(código ${e.code})`);
    if (parts.length) return parts.join(' — ');
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

export { extractErrorMessage };

// ─── Auth helper (avoids network round-trip — reads local session cache) ──────

async function getSessionUser() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user ?? null;
}

// ─── DRE group resolution (3-level hierarchy) ────────────────────────────────

/**
 * Resolves the effective DRE classification for a transaction or recurring item.
 * Priority: transaction.dreGroupOverride → subcategory.dreGroup → category.dreGroup → type default
 */
export function getEffectiveDreGroup(
  item: { dreGroupOverride?: string },
  category?: { dreGroup?: string; type?: string },
  subcategory?: { dreGroup?: string },
): string {
  if (item.dreGroupOverride) return item.dreGroupOverride;
  if (subcategory?.dreGroup) return subcategory.dreGroup;
  return category?.dreGroup ?? (category?.type === 'income' ? 'receita' : 'despesa_variavel');
}

export const DRE_GROUP_OPTIONS = [
  { value: 'receita',            label: 'Receita' },
  { value: 'despesa_fixa',       label: 'Despesa Fixa' },
  { value: 'despesa_variavel',   label: 'Despesa Variável' },
  { value: 'despesa_financeira', label: 'Despesa Financeira' },
  { value: 'deducao',            label: 'Dedução' },
] as const;

export const DRE_GROUP_LABEL: Record<string, string> = {
  receita:            'Receita',
  despesa_fixa:       'Despesa Fixa',
  despesa_variavel:   'Despesa Variável',
  despesa_financeira: 'Despesa Financeira',
  deducao:            'Dedução',
};

// ─── Invoice helpers ──────────────────────────────────────────────────────────

function getTodayStr(): string {
  return new Date().toISOString().split('T')[0];
}

/** Given a purchase date and the card's closing day, return the 'YYYY-MM' of the invoice it belongs to. */
export function getInvoiceReferenceMonth(purchaseDateStr: string, closingDay: number): string {
  const [yearStr, monthStr, dayStr] = purchaseDateStr.split('-');
  const day = parseInt(dayStr);
  let year = parseInt(yearStr);
  let month = parseInt(monthStr); // 1-indexed

  if (day >= closingDay) {
    month += 1;
    if (month > 12) { month = 1; year += 1; }
  }

  return `${year}-${String(month).padStart(2, '0')}`;
}

/** Calculate closing and due dates for an invoice given the reference month and card config. */
export function getInvoiceDates(
  referenceMonth: string,
  closingDay: number,
  dueDay: number,
): { closingDate: string; dueDate: string } {
  const [yearStr, monthStr] = referenceMonth.split('-');
  const y = parseInt(yearStr), m = parseInt(monthStr); // m is 1-indexed

  // Closing: closingDay of referenceMonth (clamped to last day)
  const lastDayRef = new Date(y, m, 0).getDate();
  const cd = Math.min(closingDay, lastDayRef);
  const closingDate = `${yearStr}-${monthStr}-${String(cd).padStart(2, '0')}`;

  // Due: dueDay of the NEXT month after referenceMonth
  let dueY = y, dueM = m + 1;
  if (dueM > 12) { dueM = 1; dueY++; }
  const lastDayDue = new Date(dueY, dueM, 0).getDate();
  const dd = Math.min(dueDay, lastDayDue);
  const dueDate = `${String(dueY)}-${String(dueM).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;

  return { closingDate, dueDate };
}

/** Advance a date string (YYYY-MM-DD) by N months, clamping to the last day of the target month. */
function addMonths(dateStr: string, months: number): string {
  if (months === 0) return dateStr;
  const [y, m, d] = dateStr.split('-').map(Number);
  const totalM = (y * 12 + (m - 1)) + months;
  const newY = Math.floor(totalM / 12);
  const newM = (totalM % 12) + 1; // 1-indexed
  const lastDay = new Date(newY, newM, 0).getDate();
  const newD = Math.min(d, lastDay);
  return `${newY}-${String(newM).padStart(2, '0')}-${String(newD).padStart(2, '0')}`;
}

/** Compute the correct invoice status given dates and today. */
export function computeInvoiceStatus(
  closingDate: string,
  dueDate: string,
  currentStatus: Invoice['status'],
  today: string,
): Invoice['status'] {
  if (currentStatus === 'paid') return 'paid';
  if (today > dueDate) return 'overdue';
  if (today >= closingDate) return 'closed';
  return 'open';
}

function mapInvoiceRow(row: Record<string, unknown>): Invoice {
  return {
    id: row.id as string,
    cardId: row.card_id as string,
    referenceMonth: row.reference_month as string,
    closingDate: row.closing_date as string,
    dueDate: row.due_date as string,
    totalAmount: Number(row.total_amount),
    status: row.status as Invoice['status'],
    paidTransactionId: (row.paid_transaction_id as string) ?? undefined,
  };
}

function mapCardRow(row: Record<string, unknown>): CreditCard {
  return {
    id: row.id as string,
    name: row.name as string,
    bank: row.bank as string,
    brand: row.brand as CreditCard['brand'],
    limit: Number(row.limit_amount),
    closingDay: row.closing_day as number,
    dueDay: row.due_day as number,
    color: row.color as string,
  };
}

/** Map a transactions row to the Transaction domain type. */
function mapTxRow(row: Record<string, unknown>): Transaction {
  return {
    id: row.id as string,
    description: row.description as string,
    amount: Number(row.amount),
    type: row.type as 'income' | 'expense',
    categoryId: row.category_id as string,
    subcategoryId: (row.subcategory_id as string) ?? undefined,
    date: row.date as string,
    status: row.status as 'paid' | 'pending',
    paymentMethod: (row.payment_method as string) ?? undefined,
    notes: (row.notes as string) ?? undefined,
    scheduledId: (row.scheduled_id as string) ?? undefined,
    cardId: (row.card_id as string) ?? undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    bankId: (row as any).bank_id ?? undefined,
    referenceMonth: (row.reference_month as string) ?? undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    installmentGroupId: (row as any).installment_group_id ?? undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    installmentNumber: (row as any).installment_number ?? undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    installmentTotal: (row as any).installment_total ?? undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dreGroupOverride: (row as any).dre_group_override ?? undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    isBalanceAdjustment: (row as any).is_balance_adjustment === true ? true : undefined,
  };
}

const TX_SELECT = 'id, description, amount, type, category_id, subcategory_id, date, status, payment_method, notes, scheduled_id, card_id, bank_id, reference_month, installment_group_id, installment_number, installment_total, dre_group_override, is_balance_adjustment';

// ─── Settings (localStorage) ──────────────────────────────────────────────────

export const dataService = {
  getSettings: (): { currency: string; theme: 'light' | 'dark' } => {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      const def = { currency: 'BRL', theme: 'light' as const };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(def));
      return def;
    }
    return JSON.parse(raw);
  },

  updateSettings: (data: Partial<{ currency: string; theme: 'light' | 'dark' }>): void => {
    const settings = dataService.getSettings();
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...settings, ...data }));
  },

  // ─── Categories ────────────────────────────────────────────────────────────

  getCategories: async (): Promise<Category[]> => {
    const user = await getSessionUser();
    if (!user) throw new Error('Not authenticated');
    const { data, error } = await supabase
      .from('categories')
      .select('id, name, type, color, icon, dre_group')
      .eq('user_id', user.id)
      .order('created_at');
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type as 'income' | 'expense',
      color: row.color,
      icon: row.icon,
      dreGroup: row.dre_group ?? undefined,
    }));
  },

  addCategory: async (cat: Omit<Category, 'id'>): Promise<Category> => {
    const user = await getSessionUser();
    if (!user) throw new Error('Not authenticated');
    const dreGroup = cat.dreGroup ?? (cat.type === 'income' ? 'receita' : 'despesa_variavel');
    const { data, error } = await supabase
      .from('categories')
      .insert({ user_id: user.id, name: cat.name, type: cat.type, color: cat.color, icon: cat.icon, dre_group: dreGroup })
      .select('id, name, type, color, icon, dre_group')
      .single();
    if (error) throw error;
    return { id: data.id, name: data.name, type: data.type as 'income' | 'expense', color: data.color, icon: data.icon, dreGroup: data.dre_group };
  },

  updateCategory: async (id: string, cat: Partial<Category>): Promise<Category> => {
    const updates: Record<string, unknown> = {};
    if (cat.name !== undefined) updates.name = cat.name;
    if (cat.type !== undefined) updates.type = cat.type;
    if (cat.color !== undefined) updates.color = cat.color;
    if (cat.icon !== undefined) updates.icon = cat.icon;
    if (cat.dreGroup !== undefined) updates.dre_group = cat.dreGroup;

    const { data, error } = await supabase
      .from('categories')
      .update(updates)
      .eq('id', id)
      .select('id, name, type, color, icon, dre_group')
      .single();
    if (error) throw error;
    return { id: data.id, name: data.name, type: data.type as 'income' | 'expense', color: data.color, icon: data.icon, dreGroup: data.dre_group };
  },

  deleteCategory: async (id: string): Promise<void> => {
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) throw error;
  },

  bulkUpdateCategories: async (ids: string[], updates: Partial<Category>): Promise<void> => {
    if (ids.length === 0) return;
    const dbUpdates: Record<string, unknown> = {};
    if (updates.dreGroup !== undefined) dbUpdates.dre_group = updates.dreGroup ?? null;
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.color !== undefined) dbUpdates.color = updates.color;
    if (updates.type !== undefined) dbUpdates.type = updates.type;
    if (Object.keys(dbUpdates).length === 0) return;
    const { error } = await supabase.from('categories').update(dbUpdates).in('id', ids);
    if (error) throw error;
  },

  deleteCategories: async (ids: string[]): Promise<void> => {
    if (ids.length === 0) return;
    const { error } = await supabase.from('categories').delete().in('id', ids);
    if (error) throw error;
  },

  // ─── Subcategories ─────────────────────────────────────────────────────────

  getSubcategories: async (): Promise<Subcategory[]> => {
    const user = await getSessionUser();
    if (!user) throw new Error('Not authenticated');
    const { data, error } = await supabase
      .from('subcategories')
      .select('id, category_id, name, dre_group')
      .eq('user_id', user.id)
      .order('created_at');
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id,
      categoryId: row.category_id,
      name: row.name,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      dreGroup: (row as any).dre_group ?? undefined,
    }));
  },

  addSubcategory: async (sub: Omit<Subcategory, 'id'>): Promise<Subcategory> => {
    const user = await getSessionUser();
    if (!user) throw new Error('Not authenticated');
    const { data, error } = await supabase
      .from('subcategories')
      .insert({ user_id: user.id, category_id: sub.categoryId, name: sub.name, dre_group: sub.dreGroup ?? null })
      .select('id, category_id, name, dre_group')
      .single();
    if (error) throw error;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { id: data.id, categoryId: data.category_id, name: data.name, dreGroup: (data as any).dre_group ?? undefined };
  },

  updateSubcategory: async (id: string, sub: Partial<Omit<Subcategory, 'id'>>): Promise<Subcategory> => {
    const updates: Record<string, unknown> = {};
    if (sub.name !== undefined) updates.name = sub.name;
    if (sub.categoryId !== undefined) updates.category_id = sub.categoryId;
    if (sub.dreGroup !== undefined) updates.dre_group = sub.dreGroup ?? null;
    const { data, error } = await supabase
      .from('subcategories')
      .update(updates)
      .eq('id', id)
      .select('id, category_id, name, dre_group')
      .single();
    if (error) throw error;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { id: data.id, categoryId: data.category_id, name: data.name, dreGroup: (data as any).dre_group ?? undefined };
  },

  deleteSubcategory: async (id: string): Promise<void> => {
    // Nullify subcategory_id on transactions before deleting (DB ON DELETE SET NULL handles this)
    const { error } = await supabase.from('subcategories').delete().eq('id', id);
    if (error) throw error;
  },

  // ─── Transactions ──────────────────────────────────────────────────────────

  /**
   * Fetch paginated transactions.
   * Defaults to the last 12 months + a hard limit of 200 records to keep the initial load fast.
   * Increase `limit` (via loadMoreTransactions in FinanceContext) to load older records.
   * Use getAllTransactionsForReports() for full historical data in Reports/DRE.
   */
  getTransactions: async (opts?: { from?: string; to?: string; limit?: number }): Promise<Transaction[]> => {
    // Default from: first day of the month 12 months ago
    const defaultFrom = new Date();
    defaultFrom.setFullYear(defaultFrom.getFullYear() - 1);
    defaultFrom.setDate(1);
    const from = opts?.from ?? defaultFrom.toISOString().split('T')[0];
    const limit = opts?.limit ?? 200;

    let query = supabase
      .from('transactions')
      .select(TX_SELECT)
      .gte('date', from)
      .order('date', { ascending: false })
      .limit(limit);

    if (opts?.to) query = query.lte('date', opts.to);

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map((row) => mapTxRow(row as Record<string, unknown>));
  },

  /**
   * Fetch ALL transactions with no date filter.
   * For use in Reports, DRE and other pages that need full historical data.
   */
  getAllTransactionsForReports: async (): Promise<Transaction[]> => {
    const { data, error } = await supabase
      .from('transactions')
      .select(TX_SELECT)
      .order('date', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => mapTxRow(row as Record<string, unknown>));
  },

  addTransaction: async (tx: Omit<Transaction, 'id'>): Promise<Transaction> => {
    const user = await getSessionUser();
    if (!user) throw new Error('Not authenticated');

    // Determine referenceMonth and fetch card (needed for RPC later)
    let referenceMonth: string | null = null;
    let card: CreditCard | null = null;
    if (tx.cardId) {
      const { data: cardRow } = await supabase.from('credit_cards').select('*').eq('id', tx.cardId).single();
      if (cardRow) {
        card = mapCardRow(cardRow as Record<string, unknown>);
        referenceMonth = getInvoiceReferenceMonth(tx.date.split('T')[0], card.closingDay);
      }
    }

    const { data, error } = await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        description: tx.description,
        amount: tx.amount,
        type: tx.type,
        category_id: tx.categoryId,
        subcategory_id: tx.subcategoryId ?? null,
        date: tx.date.split('T')[0],
        status: tx.status,
        payment_method: tx.paymentMethod ?? null,
        notes: tx.notes ?? null,
        scheduled_id: tx.scheduledId ?? null,
        card_id: tx.cardId ?? null,
        bank_id: tx.bankId ?? null,
        reference_month: referenceMonth,
        dre_group_override: tx.dreGroupOverride ?? null,
        is_balance_adjustment: tx.isBalanceAdjustment ?? false,
      })
      .select(TX_SELECT)
      .single();
    if (error) throw error;

    // ── NON-CRITICAL: ensure invoice and recalc total (single RPC call) ───
    if (tx.cardId && referenceMonth && card) {
      try {
        await supabase.rpc('ensure_invoice_and_recalc', {
          p_card_id: tx.cardId,
          p_reference_month: referenceMonth,
          p_closing_day: card.closingDay,
          p_due_day: card.dueDay,
        });
      } catch (invoiceErr) {
        console.warn('[addTransaction] Falha ao atualizar fatura via RPC (não crítico):', invoiceErr);
      }
    }

    return mapTxRow(data as Record<string, unknown>);
  },

  addInstallments: async (tx: Omit<Transaction, 'id'>, totalInstallments: number): Promise<void> => {
    const user = await getSessionUser();
    if (!user) throw new Error('Not authenticated');
    if (!tx.cardId) throw new Error('Parcelamento requer um cartão de crédito');

    const { data: cardRow, error: cardErr } = await supabase
      .from('credit_cards').select('*').eq('id', tx.cardId).single();
    if (cardErr || !cardRow) throw new Error('Cartão não encontrado');
    const card = mapCardRow(cardRow as Record<string, unknown>);

    const installmentGroupId = crypto.randomUUID();
    const baseAmountCents = Math.floor((tx.amount * 100) / totalInstallments);
    const lastAmountCents = Math.round(tx.amount * 100) - baseAmountCents * (totalInstallments - 1);
    const purchaseDateStr = tx.date.split('T')[0];

    const rows: Record<string, unknown>[] = [];
    const affectedMonths = new Set<string>();

    for (let i = 1; i <= totalInstallments; i++) {
      const installmentDate = addMonths(purchaseDateStr, i - 1);
      const referenceMonth = getInvoiceReferenceMonth(installmentDate, card.closingDay);
      const amount = i < totalInstallments ? baseAmountCents / 100 : lastAmountCents / 100;
      affectedMonths.add(referenceMonth);
      rows.push({
        user_id: user.id,
        description: tx.description,
        amount,
        type: tx.type,
        category_id: tx.categoryId,
        subcategory_id: tx.subcategoryId ?? null,
        date: installmentDate,
        status: tx.status,
        payment_method: tx.paymentMethod ?? null,
        notes: tx.notes ?? null,
        card_id: tx.cardId,
        reference_month: referenceMonth,
        installment_group_id: installmentGroupId,
        installment_number: i,
        installment_total: totalInstallments,
      });
    }

    // ── CRITICAL: insert all installment rows ─────────────────────────────
    const { error } = await supabase.from('transactions').insert(rows);
    if (error) throw error;

    // ── NON-CRITICAL: update invoice totals via RPC (one call per month) ──
    for (const refMonth of affectedMonths) {
      try {
        await supabase.rpc('ensure_invoice_and_recalc', {
          p_card_id: tx.cardId!,
          p_reference_month: refMonth,
          p_closing_day: card.closingDay,
          p_due_day: card.dueDay,
        });
      } catch (invoiceErr) {
        console.warn(`[addInstallments] Falha ao atualizar fatura ${refMonth} via RPC (não crítico):`, invoiceErr);
      }
    }
  },

  updateTransaction: async (id: string, tx: Partial<Transaction>): Promise<Transaction> => {
    // Fetch the existing transaction to know its old cardId/referenceMonth
    const { data: existing } = await supabase
      .from('transactions')
      .select('card_id, reference_month, date')
      .eq('id', id)
      .single();

    const updates: Record<string, unknown> = {};
    if (tx.description !== undefined) updates.description = tx.description;
    if (tx.amount !== undefined) updates.amount = tx.amount;
    if (tx.type !== undefined) updates.type = tx.type;
    if (tx.categoryId !== undefined) updates.category_id = tx.categoryId;
    if (tx.subcategoryId !== undefined) updates.subcategory_id = tx.subcategoryId ?? null;
    if (tx.status !== undefined) updates.status = tx.status;
    if (tx.paymentMethod !== undefined) updates.payment_method = tx.paymentMethod;
    if (tx.notes !== undefined) updates.notes = tx.notes;
    if (tx.scheduledId !== undefined) updates.scheduled_id = tx.scheduledId;
    if (tx.bankId !== undefined) updates.bank_id = tx.bankId ?? null;
    if (tx.dreGroupOverride !== undefined) updates.dre_group_override = tx.dreGroupOverride ?? null;

    // Recalculate referenceMonth if date or cardId changed
    const newDate = tx.date ? tx.date.split('T')[0] : existing?.date;
    const newCardId = tx.cardId !== undefined ? tx.cardId : existing?.card_id;

    if (tx.date !== undefined) updates.date = newDate;
    if (tx.cardId !== undefined) updates.card_id = tx.cardId ?? null;

    // Only touch reference_month when date or cardId is explicitly changing.
    // This preserves reference_month set by the recurring engine when only
    // the status is being updated (e.g. marking a scheduled transaction as paid).
    const isChangingDateOrCard = tx.date !== undefined || tx.cardId !== undefined;
    if (isChangingDateOrCard) {
      if (newCardId) {
        const { data: cardRow } = await supabase.from('credit_cards').select('closing_day').eq('id', newCardId).single();
        if (cardRow && newDate) {
          updates.reference_month = getInvoiceReferenceMonth(newDate, cardRow.closing_day);
        }
      } else {
        updates.reference_month = null;
      }
    }

    const { data, error } = await supabase
      .from('transactions')
      .update(updates)
      .eq('id', id)
      .select(TX_SELECT)
      .single();
    if (error) throw error;

    // ── NON-CRITICAL: recalculate affected invoices ───────────────────────
    const oldCardId = existing?.card_id;
    const oldRef = existing?.reference_month;
    const newRef = data.reference_month;

    try {
      if (oldCardId && oldRef && (oldCardId !== data.card_id || oldRef !== newRef)) {
        const { data: cardRow } = await supabase.from('credit_cards').select('*').eq('id', oldCardId).single();
        if (cardRow) {
          const oldCard = mapCardRow(cardRow as Record<string, unknown>);
          await supabase.rpc('ensure_invoice_and_recalc', {
            p_card_id: oldCardId,
            p_reference_month: oldRef,
            p_closing_day: oldCard.closingDay,
            p_due_day: oldCard.dueDay,
          });
        }
      }
      if (data.card_id && newRef) {
        const { data: cardRow } = await supabase.from('credit_cards').select('*').eq('id', data.card_id).single();
        if (cardRow) {
          const newCard = mapCardRow(cardRow as Record<string, unknown>);
          await supabase.rpc('ensure_invoice_and_recalc', {
            p_card_id: data.card_id,
            p_reference_month: newRef,
            p_closing_day: newCard.closingDay,
            p_due_day: newCard.dueDay,
          });
        }
      }
    } catch (invoiceErr) {
      console.warn('[updateTransaction] Falha ao recalcular fatura via RPC (não crítico):', invoiceErr);
    }

    return mapTxRow(data as Record<string, unknown>);
  },

  deleteTransaction: async (id: string): Promise<void> => {
    const { data: existing } = await supabase
      .from('transactions')
      .select('card_id, reference_month')
      .eq('id', id)
      .single();

    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (error) throw error;

    if (existing?.card_id && existing?.reference_month) {
      try {
        const { data: cardRow } = await supabase.from('credit_cards').select('*').eq('id', existing.card_id).single();
        if (cardRow) {
          const card = mapCardRow(cardRow as Record<string, unknown>);
          await supabase.rpc('ensure_invoice_and_recalc', {
            p_card_id: existing.card_id,
            p_reference_month: existing.reference_month,
            p_closing_day: card.closingDay,
            p_due_day: card.dueDay,
          });
        }
      } catch (e) {
        console.warn('[deleteTransaction] Falha ao recalcular fatura (não crítico):', e);
      }
    }
  },

  deleteTransactions: async (ids: string[]): Promise<void> => {
    if (ids.length === 0) return;
    // Capture card/month info before deletion for invoice recalc
    const { data: rows } = await supabase
      .from('transactions')
      .select('card_id, reference_month')
      .in('id', ids);

    const { error } = await supabase.from('transactions').delete().in('id', ids);
    if (error) throw error;

    // Non-critical: recalc invoice totals for each affected card/month pair
    const seen = new Set<string>();
    for (const row of rows ?? []) {
      if (row.card_id && row.reference_month) {
        const key = `${row.card_id}__${row.reference_month}`;
        if (!seen.has(key)) {
          seen.add(key);
          try {
            const { data: cardRow } = await supabase.from('credit_cards').select('*').eq('id', row.card_id).single();
            if (cardRow) {
              const card = mapCardRow(cardRow as Record<string, unknown>);
              await supabase.rpc('ensure_invoice_and_recalc', {
                p_card_id: row.card_id,
                p_reference_month: row.reference_month,
                p_closing_day: card.closingDay,
                p_due_day: card.dueDay,
              });
            }
          } catch (e) {
            console.warn('[deleteTransactions] Falha ao recalcular fatura (não crítico):', e);
          }
        }
      }
    }
  },

  bulkUpdateTransactions: async (ids: string[], updates: Partial<Transaction>): Promise<void> => {
    if (ids.length === 0) return;
    const payload: Record<string, unknown> = {};
    if (updates.categoryId !== undefined) payload.category_id = updates.categoryId;
    if (updates.subcategoryId !== undefined) payload.subcategory_id = updates.subcategoryId ?? null;
    if (updates.bankId !== undefined) payload.bank_id = updates.bankId ?? null;
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.paymentMethod !== undefined) payload.payment_method = updates.paymentMethod;
    if (Object.keys(payload).length === 0) return;
    const { error } = await supabase.from('transactions').update(payload).in('id', ids);
    if (error) throw error;
  },

  deleteInstallmentGroup: async (groupId: string): Promise<void> => {
    const { data: rows, error: fetchErr } = await supabase
      .from('transactions')
      .select('card_id, reference_month')
      .eq('installment_group_id', groupId);
    if (fetchErr) throw fetchErr;

    const { error } = await supabase.from('transactions').delete().eq('installment_group_id', groupId);
    if (error) throw error;

    // Recalculate totals for all invoice months affected by the deleted installments
    const seen = new Set<string>();
    for (const row of rows ?? []) {
      if (row.card_id && row.reference_month) {
        const key = `${row.card_id}__${row.reference_month}`;
        if (!seen.has(key)) {
          seen.add(key);
          try {
            const { data: cardRow } = await supabase.from('credit_cards').select('*').eq('id', row.card_id).single();
            if (cardRow) {
              const card = mapCardRow(cardRow as Record<string, unknown>);
              await supabase.rpc('ensure_invoice_and_recalc', {
                p_card_id: row.card_id,
                p_reference_month: row.reference_month,
                p_closing_day: card.closingDay,
                p_due_day: card.dueDay,
              });
            }
          } catch (e) {
            console.warn('[deleteInstallmentGroup] Falha ao recalcular fatura (não crítico):', e);
          }
        }
      }
    }
  },

  // ─── Scheduled Transactions ────────────────────────────────────────────────

  getScheduledTransactions: async (): Promise<ScheduledTransaction[]> => {
    const { data, error } = await supabase
      .from('scheduled_transactions')
      .select('id, description, amount, type, category_id, subcategory_id, bank_id, start_date, end_date, frequency, active, dre_group_override')
      .order('created_at');
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id, description: row.description, amount: Number(row.amount),
      type: row.type as 'income' | 'expense', categoryId: row.category_id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      subcategoryId: (row as any).subcategory_id ?? undefined,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      bankId: (row as any).bank_id ?? undefined,
      startDate: row.start_date, endDate: row.end_date ?? undefined,
      frequency: row.frequency as ScheduledTransaction['frequency'], active: row.active,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      dreGroupOverride: (row as any).dre_group_override ?? undefined,
    }));
  },

  addScheduledTransaction: async (st: Omit<ScheduledTransaction, 'id'>): Promise<ScheduledTransaction> => {
    const user = await getSessionUser();
    if (!user) throw new Error('Not authenticated');
    const { data, error } = await supabase
      .from('scheduled_transactions')
      .insert({
        user_id: user.id, description: st.description, amount: st.amount, type: st.type,
        category_id: st.categoryId,
        subcategory_id: st.subcategoryId ?? null,
        bank_id: st.bankId ?? null,
        start_date: st.startDate.split('T')[0],
        end_date: st.endDate ? st.endDate.split('T')[0] : null,
        frequency: st.frequency, active: st.active,
        dre_group_override: st.dreGroupOverride ?? null,
      })
      .select('id, description, amount, type, category_id, subcategory_id, bank_id, start_date, end_date, frequency, active, dre_group_override')
      .single();
    if (error) throw error;
    return {
      id: data.id, description: data.description, amount: Number(data.amount),
      type: data.type as 'income' | 'expense', categoryId: data.category_id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      subcategoryId: (data as any).subcategory_id ?? undefined,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      bankId: (data as any).bank_id ?? undefined,
      startDate: data.start_date, endDate: data.end_date ?? undefined,
      frequency: data.frequency as ScheduledTransaction['frequency'], active: data.active,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      dreGroupOverride: (data as any).dre_group_override ?? undefined,
    };
  },

  updateScheduledTransaction: async (id: string, st: Partial<ScheduledTransaction>): Promise<ScheduledTransaction> => {
    const updates: Record<string, unknown> = {};
    if (st.description !== undefined) updates.description = st.description;
    if (st.amount !== undefined) updates.amount = st.amount;
    if (st.type !== undefined) updates.type = st.type;
    if (st.categoryId !== undefined) updates.category_id = st.categoryId;
    if (st.subcategoryId !== undefined) updates.subcategory_id = st.subcategoryId ?? null;
    if (st.bankId !== undefined) updates.bank_id = st.bankId ?? null;
    if (st.startDate !== undefined) updates.start_date = st.startDate.split('T')[0];
    if (st.endDate !== undefined) updates.end_date = st.endDate.split('T')[0];
    if (st.frequency !== undefined) updates.frequency = st.frequency;
    if (st.active !== undefined) updates.active = st.active;
    if (st.dreGroupOverride !== undefined) updates.dre_group_override = st.dreGroupOverride ?? null;

    const { data, error } = await supabase
      .from('scheduled_transactions')
      .update(updates)
      .eq('id', id)
      .select('id, description, amount, type, category_id, subcategory_id, bank_id, start_date, end_date, frequency, active, dre_group_override')
      .single();
    if (error) throw error;
    return {
      id: data.id, description: data.description, amount: Number(data.amount),
      type: data.type as 'income' | 'expense', categoryId: data.category_id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      subcategoryId: (data as any).subcategory_id ?? undefined,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      bankId: (data as any).bank_id ?? undefined,
      startDate: data.start_date, endDate: data.end_date ?? undefined,
      frequency: data.frequency as ScheduledTransaction['frequency'], active: data.active,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      dreGroupOverride: (data as any).dre_group_override ?? undefined,
    };
  },

  deleteScheduledTransaction: async (id: string): Promise<void> => {
    const { error } = await supabase.from('scheduled_transactions').delete().eq('id', id);
    if (error) throw error;
  },

  bulkUpdateScheduled: async (ids: string[], updates: Partial<ScheduledTransaction>): Promise<void> => {
    if (ids.length === 0) return;
    const payload: Record<string, unknown> = {};
    if (updates.categoryId !== undefined) payload.category_id = updates.categoryId;
    if (updates.subcategoryId !== undefined) payload.subcategory_id = updates.subcategoryId ?? null;
    if (updates.bankId !== undefined) payload.bank_id = updates.bankId ?? null;
    if (updates.frequency !== undefined) payload.frequency = updates.frequency;
    if (updates.active !== undefined) payload.active = updates.active;
    if (Object.keys(payload).length === 0) return;
    const { error } = await supabase.from('scheduled_transactions').update(payload).in('id', ids);
    if (error) throw error;
  },

  // ─── Credit Cards ─────────────────────────────────────────────────────────

  getCards: async (): Promise<CreditCard[]> => {
    const { data, error } = await supabase
      .from('credit_cards')
      .select('id, name, bank, brand, limit_amount, closing_day, due_day, color')
      .order('created_at');
    if (error) throw error;
    return (data ?? []).map((row) => mapCardRow(row as Record<string, unknown>));
  },

  addCard: async (card: Omit<CreditCard, 'id'>): Promise<CreditCard> => {
    const user = await getSessionUser();
    if (!user) throw new Error('Not authenticated');
    const { data, error } = await supabase
      .from('credit_cards')
      .insert({
        user_id: user.id,
        name: card.name,
        bank: card.bank,
        brand: card.brand,
        limit_amount: card.limit,
        closing_day: Number(card.closingDay),
        due_day: Number(card.dueDay),
        color: card.color,
      })
      .select('id, name, bank, brand, limit_amount, closing_day, due_day, color')
      .single();
    if (error) throw error;
    return mapCardRow(data as Record<string, unknown>);
  },

  updateCard: async (id: string, card: Partial<CreditCard>): Promise<CreditCard> => {
    const updates: Record<string, unknown> = {};
    if (card.name !== undefined) updates.name = card.name;
    if (card.bank !== undefined) updates.bank = card.bank;
    if (card.brand !== undefined) updates.brand = card.brand;
    if (card.limit !== undefined) updates.limit_amount = card.limit;
    if (card.closingDay !== undefined) updates.closing_day = Number(card.closingDay);
    if (card.dueDay !== undefined) updates.due_day = Number(card.dueDay);
    if (card.color !== undefined) updates.color = card.color;

    const { data, error } = await supabase
      .from('credit_cards').update(updates).eq('id', id)
      .select('id, name, bank, brand, limit_amount, closing_day, due_day, color').single();
    if (error) throw error;
    return mapCardRow(data as Record<string, unknown>);
  },

  deleteCard: async (id: string): Promise<void> => {
    const { error } = await supabase.from('credit_cards').delete().eq('id', id);
    if (error) throw error;
  },

  // ─── Invoices ─────────────────────────────────────────────────────────────

  getInvoices: async (): Promise<Invoice[]> => {
    const today = getTodayStr();
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .order('reference_month', { ascending: false });
    if (error) throw error;

    // Auto-update stale statuses
    const updates: Array<{ id: string; status: Invoice['status'] }> = [];
    const mapped = (data ?? []).map((row) => {
      const newStatus = computeInvoiceStatus(row.closing_date, row.due_date, row.status, today);
      if (newStatus !== row.status) updates.push({ id: row.id, status: newStatus });
      return mapInvoiceRow({ ...row, status: newStatus });
    });

    // Fire-and-forget status updates
    for (const u of updates) {
      supabase.from('invoices').update({ status: u.status }).eq('id', u.id).then(() => {});
    }

    return mapped;
  },

  /** Mark an invoice as paid: create the expense transaction and update the invoice. */
  payInvoice: async (invoice: Invoice, card: CreditCard): Promise<void> => {
    const user = await getSessionUser();
    if (!user) throw new Error('Not authenticated');

    // Find or create "Despesas Financeiras" category
    let { data: cats } = await supabase
      .from('categories')
      .select('id')
      .eq('user_id', user.id)
      .eq('name', 'Despesas Financeiras')
      .eq('type', 'expense')
      .maybeSingle();

    if (!cats) {
      const { data: newCat, error: catErr } = await supabase
        .from('categories')
        .insert({ user_id: user.id, name: 'Despesas Financeiras', type: 'expense', color: '#64748b', icon: 'credit-card', dre_group: 'despesa_financeira' })
        .select('id')
        .single();
      if (catErr) throw catErr;
      cats = newCat;
    }

    const [year, month] = invoice.referenceMonth.split('-');
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const label = `${monthNames[parseInt(month) - 1]}/${year}`;
    const description = `Fatura ${card.name} - ${label}`;

    // Create the payment transaction
    const { data: txRow, error: txErr } = await supabase
      .from('transactions')
      .insert({
        user_id: user.id, description, amount: invoice.totalAmount,
        type: 'expense', category_id: cats.id,
        date: getTodayStr(), status: 'paid',
      })
      .select('id')
      .single();
    if (txErr) throw txErr;

    // Mark invoice as paid
    const { error: invErr } = await supabase
      .from('invoices')
      .update({ status: 'paid', paid_transaction_id: txRow.id })
      .eq('id', invoice.id);
    if (invErr) throw invErr;
  },

  // ─── Budgets ──────────────────────────────────────────────────────────────

  getBudgets: async (): Promise<import('../data/mockData').Budget[]> => {
    const user = await getSessionUser();
    if (!user) throw new Error('Not authenticated');
    const { data, error } = await supabase
      .from('budgets')
      .select('id, category_id, name, amount, recurrence, reference_month, active, group_id')
      .eq('user_id', user.id)
      .order('created_at');
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id,
      categoryId: row.category_id,
      name: row.name,
      amount: Number(row.amount),
      recurrence: row.recurrence as 'mensal' | 'pontual',
      referenceMonth: row.reference_month ?? undefined,
      active: row.active,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      groupId: (row as any).group_id ?? undefined,
    }));
  },

  addBudget: async (b: Omit<import('../data/mockData').Budget, 'id'>): Promise<import('../data/mockData').Budget> => {
    const user = await getSessionUser();
    if (!user) throw new Error('Not authenticated');
    const { data, error } = await supabase
      .from('budgets')
      .insert({
        user_id: user.id,
        category_id: b.categoryId,
        name: b.name,
        amount: b.amount,
        recurrence: b.recurrence,
        reference_month: b.referenceMonth ?? null,
        active: b.active,
        group_id: b.groupId ?? null,
      })
      .select('id, category_id, name, amount, recurrence, reference_month, active, group_id')
      .single();
    if (error) throw error;
    return {
      id: data.id, categoryId: data.category_id, name: data.name,
      amount: Number(data.amount), recurrence: data.recurrence as 'mensal' | 'pontual',
      referenceMonth: data.reference_month ?? undefined, active: data.active,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      groupId: (data as any).group_id ?? undefined,
    };
  },

  updateBudget: async (id: string, b: Partial<import('../data/mockData').Budget>): Promise<import('../data/mockData').Budget> => {
    const updates: Record<string, unknown> = {};
    if (b.categoryId !== undefined) updates.category_id = b.categoryId;
    if (b.name !== undefined) updates.name = b.name;
    if (b.amount !== undefined) updates.amount = b.amount;
    if (b.recurrence !== undefined) updates.recurrence = b.recurrence;
    if (b.referenceMonth !== undefined) updates.reference_month = b.referenceMonth ?? null;
    if (b.active !== undefined) updates.active = b.active;
    if (b.groupId !== undefined) updates.group_id = b.groupId ?? null;
    const { data, error } = await supabase
      .from('budgets')
      .update(updates)
      .eq('id', id)
      .select('id, category_id, name, amount, recurrence, reference_month, active, group_id')
      .single();
    if (error) throw error;
    return {
      id: data.id, categoryId: data.category_id, name: data.name,
      amount: Number(data.amount), recurrence: data.recurrence as 'mensal' | 'pontual',
      referenceMonth: data.reference_month ?? undefined, active: data.active,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      groupId: (data as any).group_id ?? undefined,
    };
  },

  deleteBudget: async (id: string): Promise<void> => {
    const { error } = await supabase.from('budgets').delete().eq('id', id);
    if (error) throw error;
  },

  // ─── Banks ────────────────────────────────────────────────────────────────

  getBanks: async (): Promise<BankAccount[]> => {
    const user = await getSessionUser();
    if (!user) throw new Error('Not authenticated');
    const { data, error } = await supabase
      .from('banks')
      .select('id, name, type, initial_balance, color, icon')
      .eq('user_id', user.id)
      .order('created_at');
    if (error) throw error;
    return (data ?? []).map(row => ({
      id: row.id, name: row.name, type: row.type as BankAccount['type'],
      initialBalance: Number(row.initial_balance), color: row.color, icon: row.icon,
    }));
  },

  addBank: async (b: Omit<BankAccount, 'id'>): Promise<BankAccount> => {
    const user = await getSessionUser();
    if (!user) throw new Error('Not authenticated');
    const { data, error } = await supabase
      .from('banks')
      .insert({ user_id: user.id, name: b.name, type: b.type, initial_balance: b.initialBalance, color: b.color, icon: b.icon })
      .select('id, name, type, initial_balance, color, icon')
      .single();
    if (error) throw error;
    return { id: data.id, name: data.name, type: data.type as BankAccount['type'], initialBalance: Number(data.initial_balance), color: data.color, icon: data.icon };
  },

  updateBank: async (id: string, b: Partial<BankAccount>): Promise<BankAccount> => {
    const updates: Record<string, unknown> = {};
    if (b.name !== undefined) updates.name = b.name;
    if (b.type !== undefined) updates.type = b.type;
    if (b.initialBalance !== undefined) updates.initial_balance = b.initialBalance;
    if (b.color !== undefined) updates.color = b.color;
    if (b.icon !== undefined) updates.icon = b.icon;
    const { data, error } = await supabase
      .from('banks').update(updates).eq('id', id)
      .select('id, name, type, initial_balance, color, icon').single();
    if (error) throw error;
    return { id: data.id, name: data.name, type: data.type as BankAccount['type'], initialBalance: Number(data.initial_balance), color: data.color, icon: data.icon };
  },

  deleteBank: async (id: string): Promise<void> => {
    const { error } = await supabase.from('banks').delete().eq('id', id);
    if (error) throw error;
  },

  deleteBanks: async (ids: string[]): Promise<void> => {
    if (ids.length === 0) return;
    const { error } = await supabase.from('banks').delete().in('id', ids);
    if (error) throw error;
  },

  // ─── Budget Groups ────────────────────────────────────────────────────────

  getBudgetGroups: async (): Promise<BudgetGroup[]> => {
    const user = await getSessionUser();
    if (!user) throw new Error('Not authenticated');
    const { data, error } = await supabase
      .from('budget_groups')
      .select('id, name, total_limit')
      .eq('user_id', user.id)
      .order('created_at');
    if (error) throw error;
    return (data ?? []).map(row => ({
      id: row.id, name: row.name,
      totalLimit: row.total_limit != null ? Number(row.total_limit) : undefined,
    }));
  },

  addBudgetGroup: async (g: Omit<BudgetGroup, 'id'>): Promise<BudgetGroup> => {
    const user = await getSessionUser();
    if (!user) throw new Error('Not authenticated');
    const { data, error } = await supabase
      .from('budget_groups')
      .insert({ user_id: user.id, name: g.name, total_limit: g.totalLimit ?? null })
      .select('id, name, total_limit').single();
    if (error) throw error;
    return { id: data.id, name: data.name, totalLimit: data.total_limit != null ? Number(data.total_limit) : undefined };
  },

  updateBudgetGroup: async (id: string, g: Partial<BudgetGroup>): Promise<BudgetGroup> => {
    const updates: Record<string, unknown> = {};
    if (g.name !== undefined) updates.name = g.name;
    if (g.totalLimit !== undefined) updates.total_limit = g.totalLimit ?? null;
    const { data, error } = await supabase
      .from('budget_groups').update(updates).eq('id', id)
      .select('id, name, total_limit').single();
    if (error) throw error;
    return { id: data.id, name: data.name, totalLimit: data.total_limit != null ? Number(data.total_limit) : undefined };
  },

  deleteBudgetGroup: async (id: string): Promise<void> => {
    const { error } = await supabase.from('budget_groups').delete().eq('id', id);
    if (error) throw error;
  },

  // ─── Balance Snapshots ────────────────────────────────────────────────────

  getBalanceSnapshots: async (): Promise<BalanceSnapshot[]> => {
    const user = await getSessionUser();
    if (!user) throw new Error('Not authenticated');
    const { data, error } = await supabase
      .from('balance_snapshots')
      .select('id, bank_id, snapshot_date, balance, created_at')
      .eq('user_id', user.id)
      .order('snapshot_date', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(row => ({
      id: row.id as string,
      bankId: row.bank_id as string,
      snapshotDate: row.snapshot_date as string,
      balance: Number(row.balance),
      createdAt: row.created_at as string,
    }));
  },

  /**
   * Upsert a balance snapshot for a given bank on a given date.
   * Uses ON CONFLICT on the (user_id, bank_id, snapshot_date) unique index so
   * that running it twice on the same day safely updates the existing row.
   */
  upsertBalanceSnapshot: async (bankId: string, snapshotDate: string, balance: number): Promise<BalanceSnapshot> => {
    const user = await getSessionUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('balance_snapshots')
      .upsert(
        {
          user_id: user.id,
          bank_id: bankId,
          snapshot_date: snapshotDate,
          balance,
          created_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,bank_id,snapshot_date' },
      )
      .select('id, bank_id, snapshot_date, balance, created_at')
      .single();
    if (error) {
      // Surface the Supabase error code (e.g. 42P01 = table not found, PGRST205 = RLS block)
      // so the UI can show a meaningful message instead of a generic one.
      const code = (error as { code?: string }).code;
      const hint = (error as { hint?: string }).hint;
      const detail = [code, hint].filter(Boolean).join(' — ');
      throw new Error(
        `Erro ao salvar marco de saldo${detail ? ` [${detail}]` : ''}: ${error.message}`,
      );
    }

    const row = data as Record<string, unknown>;
    return {
      id: row.id as string,
      bankId: row.bank_id as string,
      snapshotDate: row.snapshot_date as string,
      balance: Number(row.balance),
      createdAt: row.created_at as string,
    };
  },

  // ─── Transfers ────────────────────────────────────────────────────────────

  getTransfers: async (): Promise<import('../data/mockData').Transfer[]> => {
    const user = await getSessionUser();
    if (!user) throw new Error('Not authenticated');
    const { data, error } = await supabase
      .from('transfers')
      .select('id, from_bank_id, to_bank_id, amount, date, notes')
      .eq('user_id', user.id)
      .order('date', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(row => ({
      id: row.id, fromBankId: row.from_bank_id, toBankId: row.to_bank_id,
      amount: Number(row.amount), date: row.date, notes: row.notes ?? undefined,
    }));
  },

  addTransfer: async (t: Omit<import('../data/mockData').Transfer, 'id'>): Promise<import('../data/mockData').Transfer> => {
    const user = await getSessionUser();
    if (!user) throw new Error('Not authenticated');
    const { data, error } = await supabase
      .from('transfers')
      .insert({ user_id: user.id, from_bank_id: t.fromBankId, to_bank_id: t.toBankId, amount: t.amount, date: t.date, notes: t.notes ?? null })
      .select('id, from_bank_id, to_bank_id, amount, date, notes')
      .single();
    if (error) throw error;
    return { id: data.id, fromBankId: data.from_bank_id, toBankId: data.to_bank_id, amount: Number(data.amount), date: data.date, notes: data.notes ?? undefined };
  },

  updateTransfer: async (id: string, t: Partial<import('../data/mockData').Transfer>): Promise<import('../data/mockData').Transfer> => {
    const updates: Record<string, unknown> = {};
    if (t.fromBankId !== undefined) updates.from_bank_id = t.fromBankId;
    if (t.toBankId !== undefined) updates.to_bank_id = t.toBankId;
    if (t.amount !== undefined) updates.amount = t.amount;
    if (t.date !== undefined) updates.date = t.date;
    if (t.notes !== undefined) updates.notes = t.notes ?? null;
    const { data, error } = await supabase
      .from('transfers').update(updates).eq('id', id)
      .select('id, from_bank_id, to_bank_id, amount, date, notes').single();
    if (error) throw error;
    return { id: data.id, fromBankId: data.from_bank_id, toBankId: data.to_bank_id, amount: Number(data.amount), date: data.date, notes: data.notes ?? undefined };
  },

  deleteTransfer: async (id: string): Promise<void> => {
    const { error } = await supabase.from('transfers').delete().eq('id', id);
    if (error) throw error;
  },

  // ─── Investments ──────────────────────────────────────────────────────────

  getInvestments: async (): Promise<Investment[]> => {
    const user = await getSessionUser();
    if (!user) throw new Error('Not authenticated');
    const { data, error } = await supabase
      .from('investments')
      .select('id, name, type, institution, initial_value, current_value, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(row => ({
      id: row.id,
      name: row.name,
      type: row.type as Investment['type'],
      institution: row.institution ?? undefined,
      initialValue: Number(row.initial_value),
      currentValue: Number(row.current_value),
      createdAt: row.created_at,
    }));
  },

  addInvestment: async (inv: Omit<Investment, 'id' | 'createdAt'>): Promise<Investment> => {
    const user = await getSessionUser();
    if (!user) throw new Error('Not authenticated');
    const { data, error } = await supabase
      .from('investments')
      .insert({
        user_id: user.id,
        name: inv.name,
        type: inv.type,
        institution: inv.institution ?? null,
        initial_value: inv.initialValue,
        current_value: inv.currentValue,
      })
      .select('id, name, type, institution, initial_value, current_value, created_at')
      .single();
    if (error) throw error;
    return {
      id: data.id, name: data.name, type: data.type as Investment['type'],
      institution: data.institution ?? undefined,
      initialValue: Number(data.initial_value), currentValue: Number(data.current_value),
      createdAt: data.created_at,
    };
  },

  updateInvestment: async (id: string, inv: Partial<Omit<Investment, 'id' | 'createdAt'>>): Promise<Investment> => {
    const updates: Record<string, unknown> = {};
    if (inv.name !== undefined) updates.name = inv.name;
    if (inv.type !== undefined) updates.type = inv.type;
    if (inv.institution !== undefined) updates.institution = inv.institution ?? null;
    if (inv.initialValue !== undefined) updates.initial_value = inv.initialValue;
    if (inv.currentValue !== undefined) updates.current_value = inv.currentValue;
    const { data, error } = await supabase
      .from('investments')
      .update(updates)
      .eq('id', id)
      .select('id, name, type, institution, initial_value, current_value, created_at')
      .single();
    if (error) throw error;
    return {
      id: data.id, name: data.name, type: data.type as Investment['type'],
      institution: data.institution ?? undefined,
      initialValue: Number(data.initial_value), currentValue: Number(data.current_value),
      createdAt: data.created_at,
    };
  },

  deleteInvestment: async (id: string): Promise<void> => {
    const { error } = await supabase.from('investments').delete().eq('id', id);
    if (error) throw error;
  },

  deleteInvestments: async (ids: string[]): Promise<void> => {
    if (ids.length === 0) return;
    const { error } = await supabase.from('investments').delete().in('id', ids);
    if (error) throw error;
  },

  getInvestmentTransactions: async (investmentId: string): Promise<InvestmentTransaction[]> => {
    const { data, error } = await supabase
      .from('investment_transactions')
      .select('id, investment_id, date, type, amount, notes, created_at')
      .eq('investment_id', investmentId)
      .order('date', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(row => ({
      id: row.id, investmentId: row.investment_id,
      date: row.date, type: row.type as InvestmentTransaction['type'],
      amount: Number(row.amount), notes: row.notes ?? undefined,
      createdAt: row.created_at,
    }));
  },

  addInvestmentTransaction: async (
    tx: Omit<InvestmentTransaction, 'id' | 'createdAt'>,
  ): Promise<{ tx: InvestmentTransaction; updatedInvestment: Investment }> => {
    const user = await getSessionUser();
    if (!user) throw new Error('Not authenticated');

    const { data: txData, error: txErr } = await supabase
      .from('investment_transactions')
      .insert({
        user_id: user.id,
        investment_id: tx.investmentId,
        date: tx.date,
        type: tx.type,
        amount: tx.amount,
        notes: tx.notes ?? null,
      })
      .select('id, investment_id, date, type, amount, notes, created_at')
      .single();
    if (txErr) throw txErr;

    // Update current_value based on transaction type
    const { data: inv, error: invErr } = await supabase
      .from('investments')
      .select('current_value')
      .eq('id', tx.investmentId)
      .single();
    if (invErr) throw invErr;

    let newValue = Number(inv.current_value);
    if (tx.type === 'aporte') newValue += tx.amount;
    else if (tx.type === 'resgate') newValue -= tx.amount;
    else newValue = tx.amount; // atualizacao_valor sets directly

    const { data: updInv, error: updErr } = await supabase
      .from('investments')
      .update({ current_value: newValue })
      .eq('id', tx.investmentId)
      .select('id, name, type, institution, initial_value, current_value, created_at')
      .single();
    if (updErr) throw updErr;

    return {
      tx: {
        id: txData.id, investmentId: txData.investment_id,
        date: txData.date, type: txData.type as InvestmentTransaction['type'],
        amount: Number(txData.amount), notes: txData.notes ?? undefined,
        createdAt: txData.created_at,
      },
      updatedInvestment: {
        id: updInv.id, name: updInv.name, type: updInv.type as Investment['type'],
        institution: updInv.institution ?? undefined,
        initialValue: Number(updInv.initial_value), currentValue: Number(updInv.current_value),
        createdAt: updInv.created_at,
      },
    };
  },

  // ─── Seed data ────────────────────────────────────────────────────────────

  loadSampleData: async (): Promise<void> => {
    const user = await getSessionUser();
    if (!user) throw new Error('Not authenticated');

    const { defaultCategories, defaultTransactions, defaultScheduledTransactions } =
      await import('../data/mockData');

    const idMap: Record<string, string> = {};
    for (const cat of defaultCategories) {
      const { data, error } = await supabase
        .from('categories')
        .insert({ user_id: user.id, name: cat.name, type: cat.type, color: cat.color, icon: cat.icon, dre_group: cat.dreGroup ?? (cat.type === 'income' ? 'receita' : 'despesa_variavel') })
        .select('id').single();
      if (!error && data) idMap[cat.id] = data.id;
    }

    for (const tx of defaultTransactions) {
      const catId = idMap[tx.categoryId];
      if (!catId) continue;
      await supabase.from('transactions').insert({
        user_id: user.id, description: tx.description, amount: tx.amount,
        type: tx.type, category_id: catId, date: tx.date.split('T')[0], status: tx.status,
      });
    }

    for (const st of defaultScheduledTransactions) {
      const catId = idMap[st.categoryId];
      if (!catId) continue;
      await supabase.from('scheduled_transactions').insert({
        user_id: user.id, description: st.description, amount: st.amount,
        type: st.type, category_id: catId, start_date: st.startDate.split('T')[0],
        frequency: st.frequency, active: st.active,
      });
    }
  },
};
