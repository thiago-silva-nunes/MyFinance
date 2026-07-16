import { supabase } from '@/lib/supabase';
import type { Category, Transaction, ScheduledTransaction, CreditCard, Invoice } from '../data/mockData';

const SETTINGS_KEY = 'myfinance_settings';

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

/** Find or create the invoice for a given card + referenceMonth, and auto-update status. */
async function ensureInvoice(userId: string, card: CreditCard, referenceMonth: string): Promise<Invoice> {
  const { closingDate, dueDate } = getInvoiceDates(referenceMonth, card.closingDay, card.dueDay);
  const today = getTodayStr();

  const { data: existing, error: fetchErr } = await supabase
    .from('invoices')
    .select('*')
    .eq('card_id', card.id)
    .eq('reference_month', referenceMonth)
    .maybeSingle();

  if (fetchErr) throw fetchErr;

  if (existing) {
    const newStatus = computeInvoiceStatus(existing.closing_date, existing.due_date, existing.status, today);
    if (newStatus !== existing.status) {
      await supabase.from('invoices').update({ status: newStatus }).eq('id', existing.id);
    }
    return mapInvoiceRow({ ...existing, status: newStatus });
  }

  const status = computeInvoiceStatus(closingDate, dueDate, 'open', today);
  const { data, error } = await supabase
    .from('invoices')
    .insert({ user_id: userId, card_id: card.id, reference_month: referenceMonth, closing_date: closingDate, due_date: dueDate, status })
    .select()
    .single();
  if (error) throw error;
  return mapInvoiceRow(data as Record<string, unknown>);
}

/** Recalculate and persist the total_amount for an invoice. */
async function recalcInvoiceTotal(cardId: string, referenceMonth: string): Promise<void> {
  const { data, error } = await supabase
    .from('transactions')
    .select('amount')
    .eq('card_id', cardId)
    .eq('reference_month', referenceMonth);
  if (error) throw error;
  const total = (data ?? []).reduce((s, t) => s + Number(t.amount), 0);
  await supabase
    .from('invoices')
    .update({ total_amount: total })
    .eq('card_id', cardId)
    .eq('reference_month', referenceMonth);
}

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
    const { data, error } = await supabase
      .from('categories')
      .select('id, name, type, color, icon, dre_group')
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
    const { data: { user } } = await supabase.auth.getUser();
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

  // ─── Transactions ──────────────────────────────────────────────────────────

  getTransactions: async (): Promise<Transaction[]> => {
    const { data, error } = await supabase
      .from('transactions')
      .select('id, description, amount, type, category_id, date, status, payment_method, notes, scheduled_id, card_id, reference_month')
      .order('date', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id,
      description: row.description,
      amount: Number(row.amount),
      type: row.type as 'income' | 'expense',
      categoryId: row.category_id,
      date: row.date,
      status: row.status as 'paid' | 'pending',
      paymentMethod: row.payment_method ?? undefined,
      notes: row.notes ?? undefined,
      scheduledId: row.scheduled_id ?? undefined,
      cardId: row.card_id ?? undefined,
      referenceMonth: row.reference_month ?? undefined,
    }));
  },

  addTransaction: async (tx: Omit<Transaction, 'id'>): Promise<Transaction> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Determine referenceMonth for card transactions
    let referenceMonth: string | null = null;
    if (tx.cardId) {
      const { data: cardRow } = await supabase.from('credit_cards').select('*').eq('id', tx.cardId).single();
      if (cardRow) {
        referenceMonth = getInvoiceReferenceMonth(tx.date.split('T')[0], cardRow.closing_day);
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
        date: tx.date.split('T')[0],
        status: tx.status,
        payment_method: tx.paymentMethod ?? null,
        notes: tx.notes ?? null,
        scheduled_id: tx.scheduledId ?? null,
        card_id: tx.cardId ?? null,
        reference_month: referenceMonth,
      })
      .select('id, description, amount, type, category_id, date, status, payment_method, notes, scheduled_id, card_id, reference_month')
      .single();
    if (error) throw error;

    // Ensure invoice exists and recalculate total
    if (tx.cardId && referenceMonth) {
      const cardRow = await supabase.from('credit_cards').select('*').eq('id', tx.cardId).single();
      if (cardRow.data) {
        const card = mapCardRow(cardRow.data as Record<string, unknown>);
        await ensureInvoice(user.id, card, referenceMonth);
        await recalcInvoiceTotal(tx.cardId, referenceMonth);
      }
    }

    return {
      id: data.id, description: data.description, amount: Number(data.amount),
      type: data.type as 'income' | 'expense', categoryId: data.category_id, date: data.date,
      status: data.status as 'paid' | 'pending', paymentMethod: data.payment_method ?? undefined,
      notes: data.notes ?? undefined, scheduledId: data.scheduled_id ?? undefined,
      cardId: data.card_id ?? undefined, referenceMonth: data.reference_month ?? undefined,
    };
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
    if (tx.status !== undefined) updates.status = tx.status;
    if (tx.paymentMethod !== undefined) updates.payment_method = tx.paymentMethod;
    if (tx.notes !== undefined) updates.notes = tx.notes;
    if (tx.scheduledId !== undefined) updates.scheduled_id = tx.scheduledId;

    // Recalculate referenceMonth if date or cardId changed
    const newDate = tx.date ? tx.date.split('T')[0] : existing?.date;
    const newCardId = tx.cardId !== undefined ? tx.cardId : existing?.card_id;

    if (tx.date !== undefined) updates.date = newDate;
    if (tx.cardId !== undefined) updates.card_id = tx.cardId ?? null;

    if (newCardId) {
      const { data: cardRow } = await supabase.from('credit_cards').select('closing_day').eq('id', newCardId).single();
      if (cardRow && newDate) {
        updates.reference_month = getInvoiceReferenceMonth(newDate, cardRow.closing_day);
      }
    } else {
      updates.reference_month = null;
    }

    const { data, error } = await supabase
      .from('transactions')
      .update(updates)
      .eq('id', id)
      .select('id, description, amount, type, category_id, date, status, payment_method, notes, scheduled_id, card_id, reference_month')
      .single();
    if (error) throw error;

    // Recalculate affected invoices
    const oldCardId = existing?.card_id;
    const oldRef = existing?.reference_month;
    const newRef = data.reference_month;

    if (oldCardId && oldRef && (oldCardId !== data.card_id || oldRef !== newRef)) {
      await recalcInvoiceTotal(oldCardId, oldRef);
    }
    if (data.card_id && newRef) {
      await recalcInvoiceTotal(data.card_id, newRef);
    }

    return {
      id: data.id, description: data.description, amount: Number(data.amount),
      type: data.type as 'income' | 'expense', categoryId: data.category_id, date: data.date,
      status: data.status as 'paid' | 'pending', paymentMethod: data.payment_method ?? undefined,
      notes: data.notes ?? undefined, scheduledId: data.scheduled_id ?? undefined,
      cardId: data.card_id ?? undefined, referenceMonth: data.reference_month ?? undefined,
    };
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
      await recalcInvoiceTotal(existing.card_id, existing.reference_month);
    }
  },

  // ─── Scheduled Transactions ────────────────────────────────────────────────

  getScheduledTransactions: async (): Promise<ScheduledTransaction[]> => {
    const { data, error } = await supabase
      .from('scheduled_transactions')
      .select('id, description, amount, type, category_id, start_date, end_date, frequency, active')
      .order('created_at');
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id, description: row.description, amount: Number(row.amount),
      type: row.type as 'income' | 'expense', categoryId: row.category_id,
      startDate: row.start_date, endDate: row.end_date ?? undefined,
      frequency: row.frequency as ScheduledTransaction['frequency'], active: row.active,
    }));
  },

  addScheduledTransaction: async (st: Omit<ScheduledTransaction, 'id'>): Promise<ScheduledTransaction> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    const { data, error } = await supabase
      .from('scheduled_transactions')
      .insert({
        user_id: user.id, description: st.description, amount: st.amount, type: st.type,
        category_id: st.categoryId, start_date: st.startDate.split('T')[0],
        end_date: st.endDate ? st.endDate.split('T')[0] : null,
        frequency: st.frequency, active: st.active,
      })
      .select('id, description, amount, type, category_id, start_date, end_date, frequency, active')
      .single();
    if (error) throw error;
    return {
      id: data.id, description: data.description, amount: Number(data.amount),
      type: data.type as 'income' | 'expense', categoryId: data.category_id,
      startDate: data.start_date, endDate: data.end_date ?? undefined,
      frequency: data.frequency as ScheduledTransaction['frequency'], active: data.active,
    };
  },

  updateScheduledTransaction: async (id: string, st: Partial<ScheduledTransaction>): Promise<ScheduledTransaction> => {
    const updates: Record<string, unknown> = {};
    if (st.description !== undefined) updates.description = st.description;
    if (st.amount !== undefined) updates.amount = st.amount;
    if (st.type !== undefined) updates.type = st.type;
    if (st.categoryId !== undefined) updates.category_id = st.categoryId;
    if (st.startDate !== undefined) updates.start_date = st.startDate.split('T')[0];
    if (st.endDate !== undefined) updates.end_date = st.endDate.split('T')[0];
    if (st.frequency !== undefined) updates.frequency = st.frequency;
    if (st.active !== undefined) updates.active = st.active;

    const { data, error } = await supabase
      .from('scheduled_transactions')
      .update(updates)
      .eq('id', id)
      .select('id, description, amount, type, category_id, start_date, end_date, frequency, active')
      .single();
    if (error) throw error;
    return {
      id: data.id, description: data.description, amount: Number(data.amount),
      type: data.type as 'income' | 'expense', categoryId: data.category_id,
      startDate: data.start_date, endDate: data.end_date ?? undefined,
      frequency: data.frequency as ScheduledTransaction['frequency'], active: data.active,
    };
  },

  deleteScheduledTransaction: async (id: string): Promise<void> => {
    const { error } = await supabase.from('scheduled_transactions').delete().eq('id', id);
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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    const { data, error } = await supabase
      .from('credit_cards')
      .insert({
        user_id: user.id, name: card.name, bank: card.bank, brand: card.brand,
        limit_amount: card.limit, closing_day: card.closingDay, due_day: card.dueDay, color: card.color,
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
    if (card.closingDay !== undefined) updates.closing_day = card.closingDay;
    if (card.dueDay !== undefined) updates.due_day = card.dueDay;
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
    const { data: { user } } = await supabase.auth.getUser();
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

  // ─── Seed data ────────────────────────────────────────────────────────────

  loadSampleData: async (): Promise<void> => {
    const { data: { user } } = await supabase.auth.getUser();
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
