import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Category, Transaction, ScheduledTransaction } from '../data/mockData';
import { dataService } from '../services/dataService';

interface FinanceContextType {
  categories: Category[];
  transactions: Transaction[];
  scheduled: ScheduledTransaction[];
  settings: { currency: string; theme: 'light' | 'dark' };
  
  refreshData: () => void;
  
  addCategory: (data: Omit<Category, 'id'>) => void;
  updateCategory: (id: string, data: Partial<Category>) => void;
  deleteCategory: (id: string) => void;
  
  addTransaction: (data: Omit<Transaction, 'id'>) => void;
  updateTransaction: (id: string, data: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;
  
  addScheduled: (data: Omit<ScheduledTransaction, 'id'>) => void;
  updateScheduled: (id: string, data: Partial<ScheduledTransaction>) => void;
  deleteScheduled: (id: string) => void;
  
  updateSettings: (data: Partial<{ currency: string; theme: 'light' | 'dark' }>) => void;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

export const FinanceProvider = ({ children }: { children: ReactNode }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [scheduled, setScheduled] = useState<ScheduledTransaction[]>([]);
  const [settings, setSettings] = useState<{ currency: string; theme: 'light' | 'dark' }>({ currency: 'BRL', theme: 'light' });

  const refreshData = () => {
    setCategories(dataService.getCategories());
    setTransactions(dataService.getTransactions());
    setScheduled(dataService.getScheduledTransactions());
    const storedSettings = dataService.getSettings();
    setSettings(storedSettings);
    
    if (storedSettings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  const addCategory = (data: Omit<Category, 'id'>) => {
    dataService.addCategory(data);
    refreshData();
  };

  const updateCategory = (id: string, data: Partial<Category>) => {
    dataService.updateCategory(id, data);
    refreshData();
  };

  const deleteCategory = (id: string) => {
    dataService.deleteCategory(id);
    refreshData();
  };

  const addTransaction = (data: Omit<Transaction, 'id'>) => {
    dataService.addTransaction(data);
    refreshData();
  };

  const updateTransaction = (id: string, data: Partial<Transaction>) => {
    dataService.updateTransaction(id, data);
    refreshData();
  };

  const deleteTransaction = (id: string) => {
    dataService.deleteTransaction(id);
    refreshData();
  };

  const addScheduled = (data: Omit<ScheduledTransaction, 'id'>) => {
    dataService.addScheduledTransaction(data);
    refreshData();
  };

  const updateScheduled = (id: string, data: Partial<ScheduledTransaction>) => {
    dataService.updateScheduledTransaction(id, data);
    refreshData();
  };

  const deleteScheduled = (id: string) => {
    dataService.deleteScheduledTransaction(id);
    refreshData();
  };

  const updateSettings = (data: Partial<{ currency: string; theme: 'light' | 'dark' }>) => {
    dataService.updateSettings(data);
    refreshData();
  };

  return (
    <FinanceContext.Provider
      value={{
        categories,
        transactions,
        scheduled,
        settings,
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
        updateSettings
      }}
    >
      {children}
    </FinanceContext.Provider>
  );
};

export const useFinance = () => {
  const context = useContext(FinanceContext);
  if (!context) {
    throw new Error('useFinance must be used within a FinanceProvider');
  }
  return context;
};
