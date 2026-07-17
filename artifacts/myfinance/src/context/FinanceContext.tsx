import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Category, Subcategory, Transaction, ScheduledTransaction, CreditCard, Invoice, Budget, BankAccount, BudgetGroup, Transfer } from '../data/mockData';
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
  budgetGroups: BudgetGroup[];
  banks: BankAccount[];
  transfers: Transfer[];
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

  addBudgetGroup: (data: Omit<BudgetGroup, 'id'>) => Promise<void>;
  updateBudgetGroup: (id: string, data: Partial<BudgetGroup>) => Promise<void>;
  deleteBudgetGroup: (id: string) => Promise<void>;

  addBank: (data: Omit<BankAccount, 'id'>) => Promise<void>;
  updateBank: (id: string, data: Partial<BankAccount>) => Promise<void>;
  deleteBank: (id: string) => Promise<void>;

  addTransfer: (data: Omit<Transfer, 'id'>) => Promise<void>;
  updateTransfer: (id: string, data: Partial<Transfer>) => Promise<void>;
  deleteTransfer: (id: string) => Promise<void>;

  updateSettings: (data: Partial<{ currency: string; theme: 'light' | 'dark' }>) => void;
  loadSampleData: () => Promise<void>;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

export const FinanceProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();

  const [categories, setCategories]       = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [transactions, setTransactions]   = useState<Transaction[]>([]);
  const [scheduled, setScheduled]         = useState<ScheduledTransaction[]>([]);
  const [cards, setCards]                 = useState<CreditCard[]>([]);
  const [invoices, setInvoices]           = useState<Invoice[]>([]);
  const [budgets, setBudgets]             = useState<Budget[]>([]);
  const [budgetGroups, setBudgetGroups]   = useState<BudgetGroup[]>([]);
  const [banks, setBanks]                 = useState<BankAccount[]>([]);
  const [transfers, setTransfers]         = useState<Transfer[]>([]);
  const [settings, setSettings]           = useState<{ currency: string; theme: 'light' | 'dark' }>({ currency: 'BRL', theme: 'light' });
  const [loading, setLoading]             = useState(true);

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
      setCards([]); setInvoices([]); setBanks([]); setTransfers([]); setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [cats, subs, txns, sched, crds, invs, bdgs, bgrps, bnks, tfs] = await Promise.all([
        dataService.getCategories(),
        dataService.getSubcategories().catch(() => [] as Subcategory[]),
        dataService.getTransactions(),
        dataService.getScheduledTransactions(),
        dataService.getCards(),
        dataService.getInvoices(),
        dataService.getBudgets().catch(() => [] as Budget[]),
        dataService.getBudgetGroups().catch(() => [] as BudgetGroup[]),
        dataService.getBanks().catch(() => [] as BankAccount[]),
        dataService.getTransfers().catch(() => [] as Transfer[]),
      ]);
      setCategories(cats);
      setSubcategories(subs);
      setTransactions(txns);
      setScheduled(sched);
      setCards(crds);
      setInvoices(invs);
      setBudgets(bdgs);
      setBudgetGroups(bgrps);
      setBanks(bnks);
      setTransfers(tfs);
    } catch (err) {
      console.error('[FinanceContext] Error loading data:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { refreshData(); }, [refreshData]);

  const refreshTransactionsAndInvoices = useCallback(async () => {
    const [txns, invs] = await Promise.all([dataService.getTransactions(), dataService.getInvoices()]);
    setTransactions(txns);
    setInvoices(invs);
  }, []);

  // ─── Category actions ─────────────────────────────────────────────────────
  const addCategory = async (data: Omit<Category, 'id'>) => { const c = await dataService.addCategory(data); setCategories(p => [...p, c]); };
  const updateCategory = async (id: string, data: Partial<Category>) => { const c = await dataService.updateCategory(id, data); setCategories(p => p.map(x => x.id === id ? c : x)); };
  const deleteCategory = async (id: string) => { await dataService.deleteCategory(id); setCategories(p => p.filter(x => x.id !== id)); };

  // ─── Subcategory actions ──────────────────────────────────────────────────
  const addSubcategory = async (data: Omit<Subcategory, 'id'>) => { const c = await dataService.addSubcategory(data); setSubcategories(p => [...p, c]); };
  const updateSubcategory = async (id: string, data: Partial<Omit<Subcategory, 'id'>>) => { const c = await dataService.updateSubcategory(id, data); setSubcategories(p => p.map(x => x.id === id ? c : x)); };
  const deleteSubcategory = async (id: string) => { await dataService.deleteSubcategory(id); setSubcategories(p => p.filter(x => x.id !== id)); };

  // ─── Transaction actions ───────────────────────────────────────────────────
  const addTransaction = async (data: Omit<Transaction, 'id'>) => {
    const created = await dataService.addTransaction(data);
    setTransactions(prev => [created, ...prev]);
    if (created.cardId) { const invs = await dataService.getInvoices(); setInvoices(invs); }
  };

  const addInstallments = async (data: Omit<Transaction, 'id'>, n: number) => {
    await dataService.addInstallments(data, n);
    await refreshTransactionsAndInvoices();
  };

  const updateTransaction = async (id: string, data: Partial<Transaction>) => {
    const oldCardId = transactions.find(t => t.id === id)?.cardId;
    const updated = await dataService.updateTransaction(id, data);
    setTransactions(prev => prev.map(t => t.id === id ? updated : t));
    if (updated.cardId || oldCardId) { const invs = await dataService.getInvoices(); setInvoices(invs); }
  };

  const deleteTransaction = async (id: string) => {
    const existing = transactions.find(t => t.id === id);
    await dataService.deleteTransaction(id);
    setTransactions(prev => prev.filter(t => t.id !== id));
    if (existing?.cardId) { const invs = await dataService.getInvoices(); setInvoices(invs); }
  };

  const deleteTransactions = async (ids: string[]) => {
    if (ids.length === 0) return;
    const affectedHasCard = transactions.some(t => ids.includes(t.id) && !!t.cardId);
    await dataService.deleteTransactions(ids);
    setTransactions(prev => prev.filter(t => !ids.includes(t.id)));
    if (affectedHasCard) { const invs = await dataService.getInvoices(); setInvoices(invs); }
  };

  const deleteInstallmentGroup = async (groupId: string) => {
    const hasCard = transactions.some(t => t.installmentGroupId === groupId && !!t.cardId);
    await dataService.deleteInstallmentGroup(groupId);
    setTransactions(prev => prev.filter(t => t.installmentGroupId !== groupId));
    if (hasCard) { const invs = await dataService.getInvoices(); setInvoices(invs); }
  };

  // ─── Scheduled actions ────────────────────────────────────────────────────
  const addScheduled = async (data: Omit<ScheduledTransaction, 'id'>) => { const c = await dataService.addScheduledTransaction(data); setScheduled(p => [...p, c]); };
  const updateScheduled = async (id: string, data: Partial<ScheduledTransaction>) => { const c = await dataService.updateScheduledTransaction(id, data); setScheduled(p => p.map(x => x.id === id ? c : x)); };
  const deleteScheduled = async (id: string) => { await dataService.deleteScheduledTransaction(id); setScheduled(p => p.filter(x => x.id !== id)); };

  // ─── Card actions ─────────────────────────────────────────────────────────
  const addCard = async (data: Omit<CreditCard, 'id'>) => { const c = await dataService.addCard(data); setCards(p => [...p, c]); };
  const updateCard = async (id: string, data: Partial<CreditCard>) => { const c = await dataService.updateCard(id, data); setCards(p => p.map(x => x.id === id ? c : x)); };
  const deleteCard = async (id: string) => { await dataService.deleteCard(id); setCards(p => p.filter(x => x.id !== id)); };
  const payInvoice = async (invoice: Invoice, card: CreditCard) => { await dataService.payInvoice(invoice, card); await refreshTransactionsAndInvoices(); };

  // ─── Budget actions ───────────────────────────────────────────────────────
  const addBudget = async (data: Omit<Budget, 'id'>) => { const c = await dataService.addBudget(data); setBudgets(p => [...p, c]); };
  const updateBudget = async (id: string, data: Partial<Budget>) => { const c = await dataService.updateBudget(id, data); setBudgets(p => p.map(x => x.id === id ? c : x)); };
  const deleteBudget = async (id: string) => { await dataService.deleteBudget(id); setBudgets(p => p.filter(x => x.id !== id)); };

  // ─── Budget Group actions ─────────────────────────────────────────────────
  const addBudgetGroup = async (data: Omit<BudgetGroup, 'id'>) => { const c = await dataService.addBudgetGroup(data); setBudgetGroups(p => [...p, c]); };
  const updateBudgetGroup = async (id: string, data: Partial<BudgetGroup>) => { const c = await dataService.updateBudgetGroup(id, data); setBudgetGroups(p => p.map(x => x.id === id ? c : x)); };
  const deleteBudgetGroup = async (id: string) => {
    await dataService.deleteBudgetGroup(id);
    setBudgetGroups(p => p.filter(x => x.id !== id));
    setBudgets(p => p.map(b => b.groupId === id ? { ...b, groupId: undefined } : b));
  };

  // ─── Bank actions ─────────────────────────────────────────────────────────
  const addBank = async (data: Omit<BankAccount, 'id'>) => { const c = await dataService.addBank(data); setBanks(p => [...p, c]); };
  const updateBank = async (id: string, data: Partial<BankAccount>) => { const c = await dataService.updateBank(id, data); setBanks(p => p.map(x => x.id === id ? c : x)); };
  const deleteBank = async (id: string) => { await dataService.deleteBank(id); setBanks(p => p.filter(x => x.id !== id)); };

  // ─── Transfer actions ─────────────────────────────────────────────────────
  const addTransfer = async (data: Omit<Transfer, 'id'>) => {
    const created = await dataService.addTransfer(data);
    setTransfers(prev => [created, ...prev]);
  };
  const updateTransfer = async (id: string, data: Partial<Transfer>) => {
    const updated = await dataService.updateTransfer(id, data);
    setTransfers(prev => prev.map(t => t.id === id ? updated : t));
  };
  const deleteTransfer = async (id: string) => {
    await dataService.deleteTransfer(id);
    setTransfers(prev => prev.filter(t => t.id !== id));
  };

  // ─── Settings ─────────────────────────────────────────────────────────────
  const updateSettings = (data: Partial<{ currency: string; theme: 'light' | 'dark' }>) => {
    dataService.updateSettings(data);
    const updated = { ...settings, ...data };
    setSettings(updated);
    if (data.theme) applyTheme(data.theme);
  };

  const loadSampleData = async () => { await dataService.loadSampleData(); await refreshData(); };

  return (
    <FinanceContext.Provider value={{
      categories, subcategories, transactions, scheduled, cards, invoices,
      budgets, budgetGroups, banks, transfers,
      settings, loading,
      refreshData,
      addCategory, updateCategory, deleteCategory,
      addSubcategory, updateSubcategory, deleteSubcategory,
      addTransaction, addInstallments, updateTransaction, deleteTransaction, deleteTransactions, deleteInstallmentGroup,
      addScheduled, updateScheduled, deleteScheduled,
      addCard, updateCard, deleteCard, payInvoice,
      addBudget, updateBudget, deleteBudget,
      addBudgetGroup, updateBudgetGroup, deleteBudgetGroup,
      addBank, updateBank, deleteBank,
      addTransfer, updateTransfer, deleteTransfer,
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
