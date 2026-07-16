import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Category, Subcategory, Transaction, ScheduledTransaction, CreditCard, Invoice } from '../data/mockData';
import { dataService } from '../services/dataService';
import { useAuth } from './AuthContext';

interface FinanceContextType {
  categories: Category[];
  subcategories: Subcategory[];
  transactions: Transaction[];
  scheduled: ScheduledTransaction[];
  cards: CreditCard[];
  invoices: Invoice[];
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
  deleteInstallmentGroup: (groupId: string) => Promise<void>;

  addScheduled: (data: Omit<ScheduledTransaction, 'id'>) => Promise<void>;
  updateScheduled: (id: string, data: Partial<ScheduledTransaction>) => Promise<void>;
  deleteScheduled: (id: string) => Promise<void>;

  addCard: (data: Omit<CreditCard, 'id'>) => Promise<void>;
  updateCard: (id: string, data: Partial<CreditCard>) => Promise<void>;
  deleteCard: (id: string) => Promise<void>;
  payInvoice: (invoice: Invoice, card: CreditCard) => Promise<void>;

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
      const [cats, subs, txns, sched, crds, invs] = await Promise.all([
        dataService.getCategories(),
        dataService.getSubcategories().catch(() => [] as Subcategory[]),
        dataService.getTransactions(),
        dataService.getScheduledTransactions(),
        dataService.getCards(),
        dataService.getInvoices(),
      ]);
      setCategories(cats);
      setSubcategories(subs);
      setTransactions(txns);
      setScheduled(sched);
      setCards(crds);
      setInvoices(invs);
    } catch (err) {
      console.error('[FinanceContext] Error loading data:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { refreshData(); }, [refreshData]);

  // ─── Category actions ──────────────────────────────────────────────────────

  const addCategory = async (data: Omit<Category, 'id'>) => { await dataService.addCategory(data); await refreshData(); };
  const updateCategory = async (id: string, data: Partial<Category>) => { await dataService.updateCategory(id, data); await refreshData(); };
  const deleteCategory = async (id: string) => { await dataService.deleteCategory(id); await refreshData(); };

  // ─── Subcategory actions ───────────────────────────────────────────────────

  const addSubcategory = async (data: Omit<Subcategory, 'id'>) => { await dataService.addSubcategory(data); await refreshData(); };
  const updateSubcategory = async (id: string, data: Partial<Omit<Subcategory, 'id'>>) => { await dataService.updateSubcategory(id, data); await refreshData(); };
  const deleteSubcategory = async (id: string) => { await dataService.deleteSubcategory(id); await refreshData(); };

  // ─── Transaction actions ───────────────────────────────────────────────────

  const addTransaction = async (data: Omit<Transaction, 'id'>) => { await dataService.addTransaction(data); await refreshData(); };
  const addInstallments = async (data: Omit<Transaction, 'id'>, n: number) => { await dataService.addInstallments(data, n); await refreshData(); };
  const updateTransaction = async (id: string, data: Partial<Transaction>) => { await dataService.updateTransaction(id, data); await refreshData(); };
  const deleteTransaction = async (id: string) => { await dataService.deleteTransaction(id); await refreshData(); };
  const deleteInstallmentGroup = async (groupId: string) => { await dataService.deleteInstallmentGroup(groupId); await refreshData(); };

  // ─── Scheduled actions ─────────────────────────────────────────────────────

  const addScheduled = async (data: Omit<ScheduledTransaction, 'id'>) => { await dataService.addScheduledTransaction(data); await refreshData(); };
  const updateScheduled = async (id: string, data: Partial<ScheduledTransaction>) => { await dataService.updateScheduledTransaction(id, data); await refreshData(); };
  const deleteScheduled = async (id: string) => { await dataService.deleteScheduledTransaction(id); await refreshData(); };

  // ─── Card actions ──────────────────────────────────────────────────────────

  const addCard = async (data: Omit<CreditCard, 'id'>) => { await dataService.addCard(data); await refreshData(); };
  const updateCard = async (id: string, data: Partial<CreditCard>) => { await dataService.updateCard(id, data); await refreshData(); };
  const deleteCard = async (id: string) => { await dataService.deleteCard(id); await refreshData(); };
  const payInvoice = async (invoice: Invoice, card: CreditCard) => { await dataService.payInvoice(invoice, card); await refreshData(); };

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
      categories, subcategories, transactions, scheduled, cards, invoices, settings, loading,
      refreshData,
      addCategory, updateCategory, deleteCategory,
      addSubcategory, updateSubcategory, deleteSubcategory,
      addTransaction, addInstallments, updateTransaction, deleteTransaction, deleteInstallmentGroup,
      addScheduled, updateScheduled, deleteScheduled,
      addCard, updateCard, deleteCard, payInvoice,
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
