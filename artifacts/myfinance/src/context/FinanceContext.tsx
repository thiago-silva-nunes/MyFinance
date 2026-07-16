import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Category, Subcategory, Transaction, ScheduledTransaction, CreditCard, Invoice, Budget } from '../data/mockData';
import { dataService } from '../services/dataService';
import { useAuth } from './AuthContext';

interface FinanceContextType {
  categories: Category[];
  subcategories: Subcategory[];
  transactions: Transaction[];
  scheduled: ScheduledTransaction[];
  cards: CreditCard[];
  invoices: Invoice[];
  budgets: Budget[];
  settings: { currency: string; theme: 'light' | 'dark' };
  loading: boolean;

  refreshData: () => Promise<void>;

  addCategory: (data: Omit<Category, 'id'>) => Promise<void>;
  updateCategory: (id: string, data: Partial<Category>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;

  addSubcategory: (data: Omit<Subcategory, 'id'>) => Promise<void>;
  updateSubcategory: (id: string, data: Partial<Omit<Subcategory, 'id'>>) => Promise<void>;
  deleteSubcategory: (id: string) => Promise<void>;

  addTransaction: (data: Omit<Transaction, 'id'>) => Promise<void>;
  addInstallments: (data: Omit<Transaction, 'id'>, totalInstallments: number) => Promise<void>;
  updateTransaction: (id: string, data: Partial<Transaction>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  deleteTransactions: (ids: string[]) => Promise<void>;
  deleteInstallmentGroup: (groupId: string) => Promise<void>;

  addScheduled: (data: Omit<ScheduledTransaction, 'id'>) => Promise<void>;
  updateScheduled: (id: string, data: Partial<ScheduledTransaction>) => Promise<void>;
  deleteScheduled: (id: string) => Promise<void>;

  addCard: (data: Omit<CreditCard, 'id'>) => Promise<void>;
  updateCard: (id: string, data: Partial<CreditCard>) => Promise<void>;
  deleteCard: (id: string) => Promise<void>;
  payInvoice: (invoice: Invoice, card: CreditCard) => Promise<void>;

  addBudget: (data: Omit<Budget, 'id'>) => Promise<void>;
  updateBudget: (id: string, data: Partial<Budget>) => Promise<void>;
  deleteBudget: (id: string) => Promise<void>;

  updateSettings: (data: Partial<{ currency: string; theme: 'light' | 'dark' }>) => void;
  loadSampleData: () => Promise<void>;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

export const FinanceProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();

  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [scheduled, setScheduled] = useState<ScheduledTransaction[]>([]);
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [settings, setSettings] = useState<{ currency: string; theme: 'light' | 'dark' }>({ currency: 'BRL', theme: 'light' });
  const [loading, setLoading] = useState(true);

  const applyTheme = (theme: 'light' | 'dark') => {
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  };

  useEffect(() => {
    const s = dataService.getSettings();
    setSettings(s);
    applyTheme(s.theme);
  }, []);

  const refreshData = useCallback(async () => {
    if (!user) {
      setCategories([]); setSubcategories([]); setTransactions([]); setScheduled([]);
      setCards([]); setInvoices([]); setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [cats, subs, txns, sched, crds, invs, bdgs] = await Promise.all([
        dataService.getCategories(),
        dataService.getSubcategories().catch(() => [] as Subcategory[]),
        dataService.getTransactions(),
        dataService.getScheduledTransactions(),
        dataService.getCards(),
        dataService.getInvoices(),
        dataService.getBudgets().catch(() => [] as Budget[]),
      ]);
      setCategories(cats);
      setSubcategories(subs);
      setTransactions(txns);
      setScheduled(sched);
      setCards(crds);
      setInvoices(invs);
      setBudgets(bdgs);
    } catch (err) {
      console.error('[FinanceContext] Error loading data:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { refreshData(); }, [refreshData]);

  // ─── Partial refresh helpers ───────────────────────────────────────────────

  /** Refetch only transactions + invoices — used after card-related writes that trigger server-side recalcInvoiceTotal. */
  const refreshTransactionsAndInvoices = useCallback(async () => {
    const [txns, invs] = await Promise.all([
      dataService.getTransactions(),
      dataService.getInvoices(),
    ]);
    setTransactions(txns);
    setInvoices(invs);
  }, []);

  // ─── Category actions — optimistic ────────────────────────────────────────

  const addCategory = async (data: Omit<Category, 'id'>) => {
    const created = await dataService.addCategory(data);
    setCategories(prev => [...prev, created]);
  };
  const updateCategory = async (id: string, data: Partial<Category>) => {
    const updated = await dataService.updateCategory(id, data);
    setCategories(prev => prev.map(c => c.id === id ? updated : c));
  };
  const deleteCategory = async (id: string) => {
    await dataService.deleteCategory(id);
    setCategories(prev => prev.filter(c => c.id !== id));
  };

  // ─── Subcategory actions — optimistic ─────────────────────────────────────

  const addSubcategory = async (data: Omit<Subcategory, 'id'>) => {
    const created = await dataService.addSubcategory(data);
    setSubcategories(prev => [...prev, created]);
  };
  const updateSubcategory = async (id: string, data: Partial<Omit<Subcategory, 'id'>>) => {
    const updated = await dataService.updateSubcategory(id, data);
    setSubcategories(prev => prev.map(s => s.id === id ? updated : s));
  };
  const deleteSubcategory = async (id: string) => {
    await dataService.deleteSubcategory(id);
    setSubcategories(prev => prev.filter(s => s.id !== id));
  };

  // ─── Transaction actions ───────────────────────────────────────────────────

  const addTransaction = async (data: Omit<Transaction, 'id'>) => {
    const created = await dataService.addTransaction(data);
    setTransactions(prev => [created, ...prev]);
    // If it's a card transaction, invoice totals were recalculated server-side
    if (created.cardId) {
      const invs = await dataService.getInvoices();
      setInvoices(invs);
    }
  };

  const addInstallments = async (data: Omit<Transaction, 'id'>, n: number) => {
    // dataService doesn't return rows for installments — refetch transactions + invoices only
    await dataService.addInstallments(data, n);
    await refreshTransactionsAndInvoices();
  };

  const updateTransaction = async (id: string, data: Partial<Transaction>) => {
    const oldCardId = transactions.find(t => t.id === id)?.cardId;
    const updated = await dataService.updateTransaction(id, data);
    setTransactions(prev => prev.map(t => t.id === id ? updated : t));
    if (updated.cardId || oldCardId) {
      const invs = await dataService.getInvoices();
      setInvoices(invs);
    }
  };

  const deleteTransaction = async (id: string) => {
    const existing = transactions.find(t => t.id === id);
    await dataService.deleteTransaction(id);
    setTransactions(prev => prev.filter(t => t.id !== id));
    if (existing?.cardId) {
      const invs = await dataService.getInvoices();
      setInvoices(invs);
    }
  };

  const deleteTransactions = async (ids: string[]) => {
    if (ids.length === 0) return;
    const affectedHasCard = transactions.some(t => ids.includes(t.id) && !!t.cardId);
    await dataService.deleteTransactions(ids);
    setTransactions(prev => prev.filter(t => !ids.includes(t.id)));
    if (affectedHasCard) {
      const invs = await dataService.getInvoices();
      setInvoices(invs);
    }
  };

  const deleteInstallmentGroup = async (groupId: string) => {
    const hasCard = transactions.some(t => t.installmentGroupId === groupId && !!t.cardId);
    await dataService.deleteInstallmentGroup(groupId);
    setTransactions(prev => prev.filter(t => t.installmentGroupId !== groupId));
    if (hasCard) {
      const invs = await dataService.getInvoices();
      setInvoices(invs);
    }
  };

  // ─── Scheduled actions — optimistic ───────────────────────────────────────

  const addScheduled = async (data: Omit<ScheduledTransaction, 'id'>) => {
    const created = await dataService.addScheduledTransaction(data);
    setScheduled(prev => [...prev, created]);
  };
  const updateScheduled = async (id: string, data: Partial<ScheduledTransaction>) => {
    const updated = await dataService.updateScheduledTransaction(id, data);
    setScheduled(prev => prev.map(s => s.id === id ? updated : s));
  };
  const deleteScheduled = async (id: string) => {
    await dataService.deleteScheduledTransaction(id);
    setScheduled(prev => prev.filter(s => s.id !== id));
  };

  // ─── Card actions — optimistic ─────────────────────────────────────────────

  const addCard = async (data: Omit<CreditCard, 'id'>) => {
    const created = await dataService.addCard(data);
    setCards(prev => [...prev, created]);
  };
  const updateCard = async (id: string, data: Partial<CreditCard>) => {
    const updated = await dataService.updateCard(id, data);
    setCards(prev => prev.map(c => c.id === id ? updated : c));
  };
  const deleteCard = async (id: string) => {
    await dataService.deleteCard(id);
    setCards(prev => prev.filter(c => c.id !== id));
  };
  const payInvoice = async (invoice: Invoice, card: CreditCard) => {
    // Creates a payment transaction + updates invoice status — refetch both
    await dataService.payInvoice(invoice, card);
    await refreshTransactionsAndInvoices();
  };

  // ─── Budget actions — optimistic ───────────────────────────────────────────

  const addBudget = async (data: Omit<Budget, 'id'>) => {
    const created = await dataService.addBudget(data);
    setBudgets(prev => [...prev, created]);
  };
  const updateBudget = async (id: string, data: Partial<Budget>) => {
    const updated = await dataService.updateBudget(id, data);
    setBudgets(prev => prev.map(b => b.id === id ? updated : b));
  };
  const deleteBudget = async (id: string) => {
    await dataService.deleteBudget(id);
    setBudgets(prev => prev.filter(b => b.id !== id));
  };

  // ─── Settings ──────────────────────────────────────────────────────────────

  const updateSettings = (data: Partial<{ currency: string; theme: 'light' | 'dark' }>) => {
    dataService.updateSettings(data);
    const updated = { ...settings, ...data };
    setSettings(updated);
    if (data.theme) applyTheme(data.theme);
  };

  const loadSampleData = async () => { await dataService.loadSampleData(); await refreshData(); };

  return (
    <FinanceContext.Provider value={{
      categories, subcategories, transactions, scheduled, cards, invoices, budgets, settings, loading,
      refreshData,
      addCategory, updateCategory, deleteCategory,
      addSubcategory, updateSubcategory, deleteSubcategory,
      addTransaction, addInstallments, updateTransaction, deleteTransaction, deleteTransactions, deleteInstallmentGroup,
      addScheduled, updateScheduled, deleteScheduled,
      addCard, updateCard, deleteCard, payInvoice,
      addBudget, updateBudget, deleteBudget,
      updateSettings, loadSampleData,
    }}>
      {children}
    </FinanceContext.Provider>
  );
};

export const useFinance = () => {
  const context = useContext(FinanceContext);
  if (!context) throw new Error('useFinance must be used within a FinanceProvider');
  return context;
};
