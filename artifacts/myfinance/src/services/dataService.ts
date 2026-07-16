import { supabase } from '@/lib/supabase';
import type { Category, Transaction, ScheduledTransaction } from '../data/mockData';

const SETTINGS_KEY = 'myfinance_settings';

// ─── Settings (localStorage — not user-specific server data) ───────────────

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

  // ─── Categories ──────────────────────────────────────────────────────────

  getCategories: async (): Promise<Category[]> => {
    const { data, error } = await supabase
      .from('categories')
      .select('id, name, type, color, icon')
      .order('created_at');
    if (error) throw error;
    return (data ?? []) as Category[];
  },

  addCategory: async (cat: Omit<Category, 'id'>): Promise<Category> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    const { data, error } = await supabase
      .from('categories')
      .insert({
        user_id: user.id,
        name: cat.name,
        type: cat.type,
        color: cat.color,
        icon: cat.icon,
        dre_group: cat.type === 'income' ? 'receita' : 'despesa_variavel',
      })
      .select('id, name, type, color, icon')
      .single();
    if (error) throw error;
    return data as Category;
  },

  updateCategory: async (id: string, cat: Partial<Category>): Promise<Category> => {
    const { data, error } = await supabase
      .from('categories')
      .update(cat)
      .eq('id', id)
      .select('id, name, type, color, icon')
      .single();
    if (error) throw error;
    return data as Category;
  },

  deleteCategory: async (id: string): Promise<void> => {
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) throw error;
  },

  // ─── Transactions ─────────────────────────────────────────────────────────

  getTransactions: async (): Promise<Transaction[]> => {
    const { data, error } = await supabase
      .from('transactions')
      .select('id, description, amount, type, category_id, date, status, payment_method, notes, scheduled_id')
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
    }));
  },

  addTransaction: async (tx: Omit<Transaction, 'id'>): Promise<Transaction> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
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
      })
      .select('id, description, amount, type, category_id, date, status, payment_method, notes, scheduled_id')
      .single();
    if (error) throw error;
    return {
      id: data.id,
      description: data.description,
      amount: Number(data.amount),
      type: data.type as 'income' | 'expense',
      categoryId: data.category_id,
      date: data.date,
      status: data.status as 'paid' | 'pending',
      paymentMethod: data.payment_method ?? undefined,
      notes: data.notes ?? undefined,
      scheduledId: data.scheduled_id ?? undefined,
    };
  },

  updateTransaction: async (id: string, tx: Partial<Transaction>): Promise<Transaction> => {
    const updates: Record<string, unknown> = {};
    if (tx.description !== undefined) updates.description = tx.description;
    if (tx.amount !== undefined) updates.amount = tx.amount;
    if (tx.type !== undefined) updates.type = tx.type;
    if (tx.categoryId !== undefined) updates.category_id = tx.categoryId;
    if (tx.date !== undefined) updates.date = tx.date.split('T')[0];
    if (tx.status !== undefined) updates.status = tx.status;
    if (tx.paymentMethod !== undefined) updates.payment_method = tx.paymentMethod;
    if (tx.notes !== undefined) updates.notes = tx.notes;
    if (tx.scheduledId !== undefined) updates.scheduled_id = tx.scheduledId;

    const { data, error } = await supabase
      .from('transactions')
      .update(updates)
      .eq('id', id)
      .select('id, description, amount, type, category_id, date, status, payment_method, notes, scheduled_id')
      .single();
    if (error) throw error;
    return {
      id: data.id,
      description: data.description,
      amount: Number(data.amount),
      type: data.type as 'income' | 'expense',
      categoryId: data.category_id,
      date: data.date,
      status: data.status as 'paid' | 'pending',
      paymentMethod: data.payment_method ?? undefined,
      notes: data.notes ?? undefined,
      scheduledId: data.scheduled_id ?? undefined,
    };
  },

  deleteTransaction: async (id: string): Promise<void> => {
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (error) throw error;
  },

  // ─── Scheduled Transactions ───────────────────────────────────────────────

  getScheduledTransactions: async (): Promise<ScheduledTransaction[]> => {
    const { data, error } = await supabase
      .from('scheduled_transactions')
      .select('id, description, amount, type, category_id, start_date, end_date, frequency, active')
      .order('created_at');
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id,
      description: row.description,
      amount: Number(row.amount),
      type: row.type as 'income' | 'expense',
      categoryId: row.category_id,
      startDate: row.start_date,
      endDate: row.end_date ?? undefined,
      frequency: row.frequency as ScheduledTransaction['frequency'],
      active: row.active,
    }));
  },

  addScheduledTransaction: async (st: Omit<ScheduledTransaction, 'id'>): Promise<ScheduledTransaction> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    const { data, error } = await supabase
      .from('scheduled_transactions')
      .insert({
        user_id: user.id,
        description: st.description,
        amount: st.amount,
        type: st.type,
        category_id: st.categoryId,
        start_date: st.startDate.split('T')[0],
        end_date: st.endDate ? st.endDate.split('T')[0] : null,
        frequency: st.frequency,
        active: st.active,
      })
      .select('id, description, amount, type, category_id, start_date, end_date, frequency, active')
      .single();
    if (error) throw error;
    return {
      id: data.id,
      description: data.description,
      amount: Number(data.amount),
      type: data.type as 'income' | 'expense',
      categoryId: data.category_id,
      startDate: data.start_date,
      endDate: data.end_date ?? undefined,
      frequency: data.frequency as ScheduledTransaction['frequency'],
      active: data.active,
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
      id: data.id,
      description: data.description,
      amount: Number(data.amount),
      type: data.type as 'income' | 'expense',
      categoryId: data.category_id,
      startDate: data.start_date,
      endDate: data.end_date ?? undefined,
      frequency: data.frequency as ScheduledTransaction['frequency'],
      active: data.active,
    };
  },

  deleteScheduledTransaction: async (id: string): Promise<void> => {
    const { error } = await supabase.from('scheduled_transactions').delete().eq('id', id);
    if (error) throw error;
  },

  // ─── Seed data (Settings page "Load sample data" button) ─────────────────

  loadSampleData: async (): Promise<void> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { defaultCategories, defaultTransactions, defaultScheduledTransactions } =
      await import('../data/mockData');

    // Insert categories and track ID mapping (old mock ID → new UUID)
    const idMap: Record<string, string> = {};
    for (const cat of defaultCategories) {
      const { data, error } = await supabase
        .from('categories')
        .insert({
          user_id: user.id,
          name: cat.name,
          type: cat.type,
          color: cat.color,
          icon: cat.icon,
          dre_group: cat.type === 'income' ? 'receita' : 'despesa_variavel',
        })
        .select('id')
        .single();
      if (!error && data) idMap[cat.id] = data.id;
    }

    // Insert transactions
    for (const tx of defaultTransactions) {
      const catId = idMap[tx.categoryId];
      if (!catId) continue;
      await supabase.from('transactions').insert({
        user_id: user.id,
        description: tx.description,
        amount: tx.amount,
        type: tx.type,
        category_id: catId,
        date: tx.date.split('T')[0],
        status: tx.status,
      });
    }

    // Insert scheduled transactions
    for (const st of defaultScheduledTransactions) {
      const catId = idMap[st.categoryId];
      if (!catId) continue;
      await supabase.from('scheduled_transactions').insert({
        user_id: user.id,
        description: st.description,
        amount: st.amount,
        type: st.type,
        category_id: catId,
        start_date: st.startDate.split('T')[0],
        frequency: st.frequency,
        active: st.active,
      });
    }
  },
};
