import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Category, Transaction, ScheduledTransaction } from '../data/mockData';
import { dataService } from '../services/dataService';
import { useAuth } from './AuthContext';

interface FinanceContextType {
  categories: Category[];
  transactions: Transaction[];
  scheduled: ScheduledTransaction[];
  settings: { currency: string; theme: 'light' | 'dark' };
  loading: boolean;

  refreshData: () => Promise<void>;

  addCategory: (data: Omit<Category, 'id'>) => Promise<void>;
  updateCategory: (id: string, data: Partial<Category>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;

  addTransaction: (data: Omit<Transaction, 'id'>) => Promise<void>;
  updateTransaction: (id: string, data: Partial<Transaction>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;

  addScheduled: (data: Omit<ScheduledTransaction, 'id'>) => Promise<void>;
  updateScheduled: (id: string, data: Partial<ScheduledTransaction>) => Promise<void>;
  deleteScheduled: (id: string) => Promise<void>;

  updateSettings: (data: Partial<{ currency: string; theme: 'light' | 'dark' }>) => void;
  loadSampleData: () => Promise<void>;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

export const FinanceProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();

  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [scheduled, setScheduled] = useState<ScheduledTransaction[]>([]);
  const [settings, setSettings] = useState<{ currency: string; theme: 'light' | 'dark' }>({
    currency: 'BRL',
    theme: 'light',
  });
  const [loading, setLoading] = useState(true);

  const applyTheme = (theme: 'light' | 'dark') => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // Load settings immediately from localStorage (sync)
  useEffect(() => {
    const s = dataService.getSettings();
    setSettings(s);
    applyTheme(s.theme);
  }, []);

  const refreshData = useCallback(async () => {
    if (!user) {
      setCategories([]);
      setTransactions([]);
      setScheduled([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [cats, txns, sched] = await Promise.all([
        dataService.getCategories(),
        dataService.getTransactions(),
        dataService.getScheduledTransactions(),
      ]);
      setCategories(cats);
      setTransactions(txns);
      setScheduled(sched);
    } catch (err) {
      console.error('[FinanceContext] Error loading data:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // ─── Category actions ────────────────────────────────────────────────────

  const addCategory = async (data: Omit<Category, 'id'>) => {
    await dataService.addCategory(data);
    await refreshData();
  };

  const updateCategory = async (id: string, data: Partial<Category>) => {
    await dataService.updateCategory(id, data);
    await refreshData();
  };

  const deleteCategory = async (id: string) => {
    await dataService.deleteCategory(id);
    await refreshData();
  };

  // ─── Transaction actions ─────────────────────────────────────────────────

  const addTransaction = async (data: Omit<Transaction, 'id'>) => {
    await dataService.addTransaction(data);
    await refreshData();
  };

  const updateTransaction = async (id: string, data: Partial<Transaction>) => {
    await dataService.updateTransaction(id, data);
    await refreshData();
  };

  const deleteTransaction = async (id: string) => {
    await dataService.deleteTransaction(id);
    await refreshData();
  };

  // ─── Scheduled actions ───────────────────────────────────────────────────

  const addScheduled = async (data: Omit<ScheduledTransaction, 'id'>) => {
    await dataService.addScheduledTransaction(data);
    await refreshData();
  };

  const updateScheduled = async (id: string, data: Partial<ScheduledTransaction>) => {
    await dataService.updateScheduledTransaction(id, data);
    await refreshData();
  };

  const deleteScheduled = async (id: string) => {
    await dataService.deleteScheduledTransaction(id);
    await refreshData();
  };

  // ─── Settings ────────────────────────────────────────────────────────────

  const updateSettings = (data: Partial<{ currency: string; theme: 'light' | 'dark' }>) => {
    dataService.updateSettings(data);
    const updated = { ...settings, ...data };
    setSettings(updated);
    if (data.theme) applyTheme(data.theme);
  };

  // ─── Seed data ───────────────────────────────────────────────────────────

  const loadSampleData = async () => {
    await dataService.loadSampleData();
    await refreshData();
  };

  return (
    <FinanceContext.Provider
      value={{
        categories,
        transactions,
        scheduled,
        settings,
        loading,
        refreshData,
        addCategory,
        updateCategory,
        deleteCategory,
        addTransaction,
        updateTransaction,
        deleteTransaction,
        addScheduled,
        updateScheduled,
        deleteScheduled,
        updateSettings,
        loadSampleData,
      }}
    >
      {children}
    </FinanceContext.Provider>
  );
};

export const useFinance = () => {
  const context = useContext(FinanceContext);
  if (!context) throw new Error('useFinance must be used within a FinanceProvider');
  return context;
};
