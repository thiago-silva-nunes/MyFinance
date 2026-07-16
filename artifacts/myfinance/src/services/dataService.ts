import { 
  Category, 
  Transaction, 
  ScheduledTransaction, 
  defaultCategories, 
  defaultTransactions, 
  defaultScheduledTransactions 
} from '../data/mockData';

const STORAGE_KEYS = {
  CATEGORIES: 'myfinance_categories',
  TRANSACTIONS: 'myfinance_transactions',
  SCHEDULED: 'myfinance_scheduled',
  SETTINGS: 'myfinance_settings'
};

const generateId = () => Math.random().toString(36).substring(2, 9);

export const dataService = {
  // Categories
  getCategories: (): Category[] => {
    const data = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(defaultCategories));
      return defaultCategories;
    }
    return JSON.parse(data);
  },
  addCategory: (data: Omit<Category, 'id'>): Category => {
    const categories = dataService.getCategories();
    const newCategory = { ...data, id: generateId() };
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify([...categories, newCategory]));
    return newCategory;
  },
  updateCategory: (id: string, data: Partial<Category>): Category => {
    const categories = dataService.getCategories();
    const index = categories.findIndex(c => c.id === id);
    if (index === -1) throw new Error('Category not found');
    const updated = { ...categories[index], ...data };
    categories[index] = updated;
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
    return updated;
  },
  deleteCategory: (id: string): void => {
    const categories = dataService.getCategories();
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories.filter(c => c.id !== id)));
  },

  // Transactions
  getTransactions: (): Transaction[] => {
    const data = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(defaultTransactions));
      return defaultTransactions;
    }
    return JSON.parse(data);
  },
  addTransaction: (data: Omit<Transaction, 'id'>): Transaction => {
    const transactions = dataService.getTransactions();
    const newTransaction = { ...data, id: generateId() };
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify([...transactions, newTransaction]));
    return newTransaction;
  },
  updateTransaction: (id: string, data: Partial<Transaction>): Transaction => {
    const transactions = dataService.getTransactions();
    const index = transactions.findIndex(t => t.id === id);
    if (index === -1) throw new Error('Transaction not found');
    const updated = { ...transactions[index], ...data };
    transactions[index] = updated;
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
    return updated;
  },
  deleteTransaction: (id: string): void => {
    const transactions = dataService.getTransactions();
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions.filter(t => t.id !== id)));
  },

  // Scheduled
  getScheduledTransactions: (): ScheduledTransaction[] => {
    const data = localStorage.getItem(STORAGE_KEYS.SCHEDULED);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.SCHEDULED, JSON.stringify(defaultScheduledTransactions));
      return defaultScheduledTransactions;
    }
    return JSON.parse(data);
  },
  addScheduledTransaction: (data: Omit<ScheduledTransaction, 'id'>): ScheduledTransaction => {
    const scheduled = dataService.getScheduledTransactions();
    const newScheduled = { ...data, id: generateId() };
    localStorage.setItem(STORAGE_KEYS.SCHEDULED, JSON.stringify([...scheduled, newScheduled]));
    return newScheduled;
  },
  updateScheduledTransaction: (id: string, data: Partial<ScheduledTransaction>): ScheduledTransaction => {
    const scheduled = dataService.getScheduledTransactions();
    const index = scheduled.findIndex(s => s.id === id);
    if (index === -1) throw new Error('Scheduled transaction not found');
    const updated = { ...scheduled[index], ...data };
    scheduled[index] = updated;
    localStorage.setItem(STORAGE_KEYS.SCHEDULED, JSON.stringify(scheduled));
    return updated;
  },
  deleteScheduledTransaction: (id: string): void => {
    const scheduled = dataService.getScheduledTransactions();
    localStorage.setItem(STORAGE_KEYS.SCHEDULED, JSON.stringify(scheduled.filter(s => s.id !== id)));
  },

  // Settings
  getSettings: (): { currency: string; theme: 'light' | 'dark' } => {
    const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!data) {
      const defaultSettings = { currency: 'BRL', theme: 'light' as const };
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(defaultSettings));
      return defaultSettings;
    }
    return JSON.parse(data);
  },
  updateSettings: (data: Partial<{ currency: string; theme: 'light' | 'dark' }>): void => {
    const settings = dataService.getSettings();
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify({ ...settings, ...data }));
  }
};
