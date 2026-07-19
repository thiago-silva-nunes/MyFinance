import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Category, Subcategory, Transaction, ScheduledTransaction, CreditCard, Invoice, Budget, BankAccount, BudgetGroup, Transfer } from '../data/mockData';
import type { BalanceSnapshot } from '../lib/balanceUtils';
import { dataService } from '../services/dataService';
import { useAuth } from './AuthContext';
import {
  generateAllPendingForCurrentPeriod,
  generatePendingIfNeeded,
  regeneratePendingForScheduled,
  getPendingPeriodsToGenerate,
  type RegenerateResult,
} from '../services/recurringEngine';

// ─── Query Keys ──────────────────────────────────────────────────────────────

const QK = {
  categories:       () => ['categories']       as const,
  subcategories:    () => ['subcategories']    as const,
  transactions:     () => ['transactions']     as const,
  scheduled:        () => ['scheduled']        as const,
  cards:            () => ['cards']            as const,
  invoices:         () => ['invoices']         as const,
  budgets:          () => ['budgets']          as const,
  budgetGroups:     () => ['budgetGroups']     as const,
  banks:            () => ['banks']            as const,
  transfers:        () => ['transfers']        as const,
  balanceSnapshots: () => ['balanceSnapshots'] as const,
};

export { QK as FINANCE_QUERY_KEYS };

const STALE_TIME = 30_000; // 30 seconds

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
  balanceSnapshots: BalanceSnapshot[];
  settings: { currency: string; theme: 'light' | 'dark' };
  loading: boolean;

  refreshData: () => Promise<void>;
  /** Load 200 more transactions older than the current window. */
  loadMoreTransactions: () => void;
  /** True when the current transaction set is at the fetch limit — more may exist. */
  hasMoreTransactions: boolean;
  generatePendingTransaction: (scheduled: ScheduledTransaction) => Promise<Transaction | null>;
  regeneratePendingTransaction: (scheduled: ScheduledTransaction) => Promise<RegenerateResult>;

  addCategory: (data: Omit<Category, 'id'>) => Promise<void>;
  updateCategory: (id: string, data: Partial<Category>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  bulkUpdateCategories: (ids: string[], updates: Partial<Category>) => Promise<void>;
  deleteCategories: (ids: string[]) => Promise<void>;

  addSubcategory: (data: Omit<Subcategory, 'id'>) => Promise<void>;
  updateSubcategory: (id: string, data: Partial<Omit<Subcategory, 'id'>>) => Promise<void>;
  deleteSubcategory: (id: string) => Promise<void>;

  addTransaction: (data: Omit<Transaction, 'id'>) => Promise<void>;
  addInstallments: (data: Omit<Transaction, 'id'>, totalInstallments: number) => Promise<void>;
  updateTransaction: (id: string, data: Partial<Transaction>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  deleteTransactions: (ids: string[]) => Promise<void>;
  bulkUpdateTransactions: (ids: string[], updates: Partial<Transaction>) => Promise<void>;
  deleteInstallmentGroup: (groupId: string) => Promise<void>;

  addScheduled: (data: Omit<ScheduledTransaction, 'id'>) => Promise<void>;
  updateScheduled: (id: string, data: Partial<ScheduledTransaction>) => Promise<void>;
  deleteScheduled: (id: string) => Promise<void>;
  bulkUpdateScheduled: (ids: string[], updates: Partial<ScheduledTransaction>) => Promise<void>;

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
  deleteBanks: (ids: string[]) => Promise<void>;

  upsertBalanceSnapshot: (bankId: string, snapshotDate: string, balance: number) => Promise<void>;

  addTransfer: (data: Omit<Transfer, 'id'>) => Promise<void>;
  updateTransfer: (id: string, data: Partial<Transfer>) => Promise<void>;
  deleteTransfer: (id: string) => Promise<void>;

  updateSettings: (data: Partial<{ currency: string; theme: 'light' | 'dark' }>) => void;
  loadSampleData: () => Promise<void>;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

export const FinanceProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const enabled = !!user;

  // ─── Transaction pagination ───────────────────────────────────────────────
  const PAGE_SIZE = 200;
  const [transactionLimit, setTransactionLimit] = useState(PAGE_SIZE);

  const loadMoreTransactions = useCallback(() => {
    setTransactionLimit(prev => prev + PAGE_SIZE);
  }, []);

  // ─── Settings (localStorage — no network call) ────────────────────────────
  const [settings, setSettings] = useState<{ currency: string; theme: 'light' | 'dark' }>({ currency: 'BRL', theme: 'light' });

  const applyTheme = (theme: 'light' | 'dark') => {
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  };

  useEffect(() => {
    const s = dataService.getSettings();
    setSettings(s);
    applyTheme(s.theme);
  }, []);

  // ─── Clear cache on logout ────────────────────────────────────────────────
  useEffect(() => {
    if (!user) {
      queryClient.clear();
    }
  }, [user, queryClient]);

  // ─── Queries (React Query — cached, staleTime 30 s) ───────────────────────

  const { data: categories = [], isPending: catsPending } = useQuery({
    queryKey: QK.categories(),
    queryFn: dataService.getCategories,
    enabled,
    staleTime: STALE_TIME,
  });

  const { data: subcategories = [], isPending: subcatsPending } = useQuery({
    queryKey: QK.subcategories(),
    queryFn: () => dataService.getSubcategories().catch(() => [] as Subcategory[]),
    enabled,
    staleTime: STALE_TIME,
  });

  const { data: transactions = [], isPending: txnsPending } = useQuery<Transaction[]>({
    queryKey: [...QK.transactions(), { limit: transactionLimit }],
    queryFn: () => dataService.getTransactions({ limit: transactionLimit }),
    enabled,
    staleTime: STALE_TIME,
  });

  // True when the last fetch returned exactly the limit — more records may exist
  const hasMoreTransactions = useMemo(
    () => transactions.length >= transactionLimit,
    [transactions.length, transactionLimit],
  );

  const { data: scheduled = [], isPending: schedPending } = useQuery({
    queryKey: QK.scheduled(),
    queryFn: dataService.getScheduledTransactions,
    enabled,
    staleTime: STALE_TIME,
  });

  const { data: cards = [], isPending: cardsPending } = useQuery({
    queryKey: QK.cards(),
    queryFn: dataService.getCards,
    enabled,
    staleTime: STALE_TIME,
  });

  const { data: invoices = [], isPending: invoicesPending } = useQuery({
    queryKey: QK.invoices(),
    queryFn: dataService.getInvoices,
    enabled,
    staleTime: STALE_TIME,
  });

  const { data: budgets = [], isPending: budgetsPending } = useQuery({
    queryKey: QK.budgets(),
    queryFn: () => dataService.getBudgets().catch(() => [] as Budget[]),
    enabled,
    staleTime: STALE_TIME,
  });

  const { data: budgetGroups = [], isPending: budgetGroupsPending } = useQuery({
    queryKey: QK.budgetGroups(),
    queryFn: () => dataService.getBudgetGroups().catch(() => [] as BudgetGroup[]),
    enabled,
    staleTime: STALE_TIME,
  });

  const { data: banks = [], isPending: banksPending } = useQuery({
    queryKey: QK.banks(),
    queryFn: () => dataService.getBanks().catch(() => [] as BankAccount[]),
    enabled,
    staleTime: STALE_TIME,
  });

  const { data: transfers = [], isPending: transfersPending } = useQuery({
    queryKey: QK.transfers(),
    queryFn: () => dataService.getTransfers().catch(() => [] as Transfer[]),
    enabled,
    staleTime: STALE_TIME,
  });

  const { data: balanceSnapshots = [], isPending: snapshotsPending } = useQuery({
    queryKey: QK.balanceSnapshots(),
    queryFn: () => dataService.getBalanceSnapshots().catch(() => [] as BalanceSnapshot[]),
    enabled,
    staleTime: STALE_TIME,
  });

  // Loading = true only while user is logged in AND any query hasn't resolved yet
  const loading = enabled && (
    catsPending || subcatsPending || txnsPending || schedPending ||
    cardsPending || invoicesPending || budgetsPending ||
    budgetGroupsPending || banksPending || transfersPending || snapshotsPending
  );

  // ─── Auto-geração de pendentes recorrentes (backfill completo) ────────────
  // Roda toda vez que os dados carregam/atualizam.
  // A deduplicação é feita no próprio engine (query em memória), então é seguro
  // rodar com frequência sem risco de criar transações duplicadas.
  useEffect(() => {
    if (loading || !user || scheduled.length === 0) return;

    generateAllPendingForCurrentPeriod(user.id, scheduled).then((generated) => {
      if (generated.length > 0) {
        queryClient.invalidateQueries({ queryKey: QK.transactions() });
      }
    }).catch(e => console.warn('[FinanceContext] Auto-geração de pendentes falhou:', e));
  }, [loading, user, scheduled]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── refreshData: invalidate all queries ─────────────────────────────────
  const refreshData = useCallback(async () => {
    await queryClient.invalidateQueries();
  }, [queryClient]);

  // ─── Category actions ─────────────────────────────────────────────────────
  const addCategory = async (data: Omit<Category, 'id'>) => {
    const c = await dataService.addCategory(data);
    queryClient.setQueryData(QK.categories(), (old: Category[] = []) => [...old, c]);
  };
  const updateCategory = async (id: string, data: Partial<Category>) => {
    const c = await dataService.updateCategory(id, data);
    queryClient.setQueryData(QK.categories(), (old: Category[] = []) => old.map(x => x.id === id ? c : x));
  };
  const deleteCategory = async (id: string) => {
    await dataService.deleteCategory(id);
    queryClient.setQueryData(QK.categories(), (old: Category[] = []) => old.filter(x => x.id !== id));
  };
  const bulkUpdateCategories = async (ids: string[], updates: Partial<Category>) => {
    if (ids.length === 0) return;
    await dataService.bulkUpdateCategories(ids, updates);
    queryClient.setQueryData(QK.categories(), (old: Category[] = []) =>
      old.map(x => ids.includes(x.id) ? { ...x, ...updates } : x)
    );
  };
  const deleteCategories = async (ids: string[]) => {
    if (ids.length === 0) return;
    await dataService.deleteCategories(ids);
    queryClient.setQueryData(QK.categories(), (old: Category[] = []) => old.filter(x => !ids.includes(x.id)));
    // Also remove subcategories that belonged to these categories
    queryClient.setQueryData(QK.subcategories(), (old: Subcategory[] = []) => old.filter(x => !ids.includes(x.categoryId)));
  };

  // ─── Subcategory actions ──────────────────────────────────────────────────
  const addSubcategory = async (data: Omit<Subcategory, 'id'>) => {
    const c = await dataService.addSubcategory(data);
    queryClient.setQueryData(QK.subcategories(), (old: Subcategory[] = []) => [...old, c]);
  };
  const updateSubcategory = async (id: string, data: Partial<Omit<Subcategory, 'id'>>) => {
    const c = await dataService.updateSubcategory(id, data);
    queryClient.setQueryData(QK.subcategories(), (old: Subcategory[] = []) => old.map(x => x.id === id ? c : x));
  };
  const deleteSubcategory = async (id: string) => {
    await dataService.deleteSubcategory(id);
    queryClient.setQueryData(QK.subcategories(), (old: Subcategory[] = []) => old.filter(x => x.id !== id));
  };

  // ─── Transaction actions ───────────────────────────────────────────────────
  const addTransaction = async (data: Omit<Transaction, 'id'>) => {
    const created = await dataService.addTransaction(data);
    // Invalidate with prefix so all paginated variants (keyed with limit) refresh
    await queryClient.invalidateQueries({ queryKey: QK.transactions() });
    if (created.cardId) {
      queryClient.invalidateQueries({ queryKey: QK.invoices() });
    }
  };

  const addInstallments = async (data: Omit<Transaction, 'id'>, n: number) => {
    await dataService.addInstallments(data, n);
    // Installments create many rows across multiple months — full refetch
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: QK.transactions() }),
      queryClient.invalidateQueries({ queryKey: QK.invoices() }),
    ]);
  };

  const updateTransaction = async (id: string, data: Partial<Transaction>) => {
    // Read old card from the in-scope transactions array (already paginated + cached)
    const oldCardId = transactions.find(t => t.id === id)?.cardId;
    const updated = await dataService.updateTransaction(id, data);
    // Prefix invalidate covers all paginated variants
    await queryClient.invalidateQueries({ queryKey: QK.transactions() });
    if (updated.cardId || oldCardId) {
      queryClient.invalidateQueries({ queryKey: QK.invoices() });
    }
  };

  const deleteTransaction = async (id: string) => {
    const existing = transactions.find(t => t.id === id);
    await dataService.deleteTransaction(id);
    await queryClient.invalidateQueries({ queryKey: QK.transactions() });
    if (existing?.cardId) {
      queryClient.invalidateQueries({ queryKey: QK.invoices() });
    }
  };

  const deleteTransactions = async (ids: string[]) => {
    if (ids.length === 0) return;
    const affectedHasCard = transactions.some(t => ids.includes(t.id) && !!t.cardId);
    await dataService.deleteTransactions(ids);
    await queryClient.invalidateQueries({ queryKey: QK.transactions() });
    if (affectedHasCard) {
      queryClient.invalidateQueries({ queryKey: QK.invoices() });
    }
  };

  const bulkUpdateTransactions = async (ids: string[], updates: Partial<Transaction>) => {
    if (ids.length === 0) return;
    await dataService.bulkUpdateTransactions(ids, updates);
    await queryClient.invalidateQueries({ queryKey: QK.transactions() });
  };

  const deleteInstallmentGroup = async (groupId: string) => {
    const hasCard = transactions.some(t => t.installmentGroupId === groupId && !!t.cardId);
    await dataService.deleteInstallmentGroup(groupId);
    await queryClient.invalidateQueries({ queryKey: QK.transactions() });
    if (hasCard) {
      queryClient.invalidateQueries({ queryKey: QK.invoices() });
    }
  };

  // ─── Scheduled actions ────────────────────────────────────────────────────
  const addScheduled = async (data: Omit<ScheduledTransaction, 'id'>) => {
    const c = await dataService.addScheduledTransaction(data);
    queryClient.setQueryData(QK.scheduled(), (old: ScheduledTransaction[] = []) => [...old, c]);
    // Immediately generate a pending transaction for the current period (if applicable)
    if (user) {
      try {
        const tx = await generatePendingIfNeeded(user.id, c);
        if (tx) {
          queryClient.invalidateQueries({ queryKey: QK.transactions() });
        }
      } catch (e) {
        console.warn('[FinanceContext] Falha ao gerar transação pendente para nova recorrência:', e);
      }
    }
  };
  const updateScheduled = async (id: string, data: Partial<ScheduledTransaction>) => {
    const c = await dataService.updateScheduledTransaction(id, data);
    queryClient.setQueryData(QK.scheduled(), (old: ScheduledTransaction[] = []) => old.map(x => x.id === id ? c : x));
    // Run full backfill after update — covers reactivation, frequency/date changes
    if (user && c.active) {
      try {
        const periods = getPendingPeriodsToGenerate(c);
        if (periods.length > 0) {
          const generated = await Promise.all(
            periods.map(period => generatePendingIfNeeded(user.id, c, period))
          );
          if (generated.some(Boolean)) {
            queryClient.invalidateQueries({ queryKey: QK.transactions() });
          }
        }
      } catch (e) {
        console.warn('[FinanceContext] Backfill após updateScheduled falhou:', e);
      }
    }
  };
  const deleteScheduled = async (id: string) => {
    await dataService.deleteScheduledTransaction(id);
    queryClient.setQueryData(QK.scheduled(), (old: ScheduledTransaction[] = []) => old.filter(x => x.id !== id));
  };

  const bulkUpdateScheduled = async (ids: string[], updates: Partial<ScheduledTransaction>) => {
    await dataService.bulkUpdateScheduled(ids, updates);
    await queryClient.invalidateQueries({ queryKey: QK.scheduled() });
  };

  const generatePendingTransaction = async (sched: ScheduledTransaction): Promise<Transaction | null> => {
    if (!user) return null;
    try {
      const tx = await generatePendingIfNeeded(user.id, sched);
      if (tx) {
        await queryClient.invalidateQueries({ queryKey: QK.transactions() });
      }
      return tx;
    } catch (e) {
      console.warn('[FinanceContext] Falha ao gerar transação pendente:', e);
      return null;
    }
  };

  const regeneratePendingTransaction = async (sched: ScheduledTransaction): Promise<RegenerateResult> => {
    if (!user) return { transaction: null };
    try {
      const result = await regeneratePendingForScheduled(user.id, sched);
      if (result.transaction) {
        await queryClient.invalidateQueries({ queryKey: QK.transactions() });
      }
      return result;
    } catch (e) {
      console.warn('[FinanceContext] Falha ao regenerar transação pendente:', e);
      return { transaction: null };
    }
  };

  // ─── Card actions ─────────────────────────────────────────────────────────
  const addCard = async (data: Omit<CreditCard, 'id'>) => {
    const c = await dataService.addCard(data);
    queryClient.setQueryData(QK.cards(), (old: CreditCard[] = []) => [...old, c]);
  };
  const updateCard = async (id: string, data: Partial<CreditCard>) => {
    const c = await dataService.updateCard(id, data);
    queryClient.setQueryData(QK.cards(), (old: CreditCard[] = []) => old.map(x => x.id === id ? c : x));
  };
  const deleteCard = async (id: string) => {
    await dataService.deleteCard(id);
    queryClient.setQueryData(QK.cards(), (old: CreditCard[] = []) => old.filter(x => x.id !== id));
  };
  const payInvoice = async (invoice: Invoice, card: CreditCard) => {
    await dataService.payInvoice(invoice, card);
    // payInvoice creates a transaction AND modifies an invoice
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: QK.transactions() }),
      queryClient.invalidateQueries({ queryKey: QK.invoices() }),
    ]);
  };

  // ─── Budget actions ───────────────────────────────────────────────────────
  const addBudget = async (data: Omit<Budget, 'id'>) => {
    const c = await dataService.addBudget(data);
    queryClient.setQueryData(QK.budgets(), (old: Budget[] = []) => [...old, c]);
  };
  const updateBudget = async (id: string, data: Partial<Budget>) => {
    const c = await dataService.updateBudget(id, data);
    queryClient.setQueryData(QK.budgets(), (old: Budget[] = []) => old.map(x => x.id === id ? c : x));
  };
  const deleteBudget = async (id: string) => {
    await dataService.deleteBudget(id);
    queryClient.setQueryData(QK.budgets(), (old: Budget[] = []) => old.filter(x => x.id !== id));
  };

  // ─── Budget Group actions ─────────────────────────────────────────────────
  const addBudgetGroup = async (data: Omit<BudgetGroup, 'id'>) => {
    const c = await dataService.addBudgetGroup(data);
    queryClient.setQueryData(QK.budgetGroups(), (old: BudgetGroup[] = []) => [...old, c]);
  };
  const updateBudgetGroup = async (id: string, data: Partial<BudgetGroup>) => {
    const c = await dataService.updateBudgetGroup(id, data);
    queryClient.setQueryData(QK.budgetGroups(), (old: BudgetGroup[] = []) => old.map(x => x.id === id ? c : x));
  };
  const deleteBudgetGroup = async (id: string) => {
    await dataService.deleteBudgetGroup(id);
    queryClient.setQueryData(QK.budgetGroups(), (old: BudgetGroup[] = []) => old.filter(x => x.id !== id));
    // Also clear groupId from any budget that referenced this group
    queryClient.setQueryData(QK.budgets(), (old: Budget[] = []) =>
      old.map(b => b.groupId === id ? { ...b, groupId: undefined } : b)
    );
  };

  // ─── Bank actions ─────────────────────────────────────────────────────────
  const addBank = async (data: Omit<BankAccount, 'id'>) => {
    const c = await dataService.addBank(data);
    queryClient.setQueryData(QK.banks(), (old: BankAccount[] = []) => [...old, c]);
  };
  const updateBank = async (id: string, data: Partial<BankAccount>) => {
    const c = await dataService.updateBank(id, data);
    queryClient.setQueryData(QK.banks(), (old: BankAccount[] = []) => old.map(x => x.id === id ? c : x));
  };
  const deleteBank = async (id: string) => {
    await dataService.deleteBank(id);
    queryClient.setQueryData(QK.banks(), (old: BankAccount[] = []) => old.filter(x => x.id !== id));
  };
  const deleteBanks = async (ids: string[]) => {
    if (ids.length === 0) return;
    await dataService.deleteBanks(ids);
    queryClient.setQueryData(QK.banks(), (old: BankAccount[] = []) => old.filter(x => !ids.includes(x.id)));
  };

  // ─── Balance Snapshot actions ──────────────────────────────────────────────
  const upsertBalanceSnapshot = async (bankId: string, snapshotDate: string, balance: number) => {
    const snap = await dataService.upsertBalanceSnapshot(bankId, snapshotDate, balance);
    // Optimistic update: replace/prepend in the cache immediately so all
    // subscribers (Dashboard, Settings, Reports) re-render without waiting
    // for a network round-trip.
    queryClient.setQueryData(QK.balanceSnapshots(), (old: BalanceSnapshot[] = []) => {
      const filtered = old.filter(s => !(s.bankId === bankId && s.snapshotDate === snapshotDate));
      return [snap, ...filtered];
    });
    // Invalidate so React Query confirms the full list from the server in the
    // background. This is the safety net that catches any edge cases where
    // setQueryData alone doesn't trigger a re-render (e.g. stale observers).
    await queryClient.invalidateQueries({ queryKey: QK.balanceSnapshots() });
  };

  // ─── Transfer actions ─────────────────────────────────────────────────────
  const addTransfer = async (data: Omit<Transfer, 'id'>) => {
    const created = await dataService.addTransfer(data);
    queryClient.setQueryData(QK.transfers(), (old: Transfer[] = []) => [created, ...old]);
  };
  const updateTransfer = async (id: string, data: Partial<Transfer>) => {
    const updated = await dataService.updateTransfer(id, data);
    queryClient.setQueryData(QK.transfers(), (old: Transfer[] = []) => old.map(t => t.id === id ? updated : t));
  };
  const deleteTransfer = async (id: string) => {
    await dataService.deleteTransfer(id);
    queryClient.setQueryData(QK.transfers(), (old: Transfer[] = []) => old.filter(t => t.id !== id));
  };

  // ─── Settings ─────────────────────────────────────────────────────────────
  const updateSettings = (data: Partial<{ currency: string; theme: 'light' | 'dark' }>) => {
    dataService.updateSettings(data);
    const updated = { ...settings, ...data };
    setSettings(updated);
    if (data.theme) applyTheme(data.theme);
  };

  const loadSampleData = async () => {
    await dataService.loadSampleData();
    await queryClient.invalidateQueries();
  };

  return (
    <FinanceContext.Provider value={{
      categories, subcategories, transactions, scheduled, cards, invoices,
      budgets, budgetGroups, banks, transfers, balanceSnapshots,
      settings, loading,
      refreshData, loadMoreTransactions, hasMoreTransactions,
      addCategory, updateCategory, deleteCategory, bulkUpdateCategories, deleteCategories,
      addSubcategory, updateSubcategory, deleteSubcategory,
      addTransaction, addInstallments, updateTransaction, deleteTransaction, deleteTransactions, bulkUpdateTransactions, deleteInstallmentGroup,
      addScheduled, updateScheduled, deleteScheduled, bulkUpdateScheduled,
      generatePendingTransaction, regeneratePendingTransaction,
      addCard, updateCard, deleteCard, payInvoice,
      addBudget, updateBudget, deleteBudget,
      addBudgetGroup, updateBudgetGroup, deleteBudgetGroup,
      addBank, updateBank, deleteBank, deleteBanks,
      upsertBalanceSnapshot,
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
