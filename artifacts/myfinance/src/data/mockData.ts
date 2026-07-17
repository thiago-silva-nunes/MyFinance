export interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  color: string;
  icon: string;
  dreGroup?: string; // 'receita' | 'despesa_fixa' | 'despesa_variavel' | 'despesa_financeira' | 'deducao'
}

export interface Subcategory {
  id: string;
  categoryId: string;
  name: string;
}

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  categoryId: string;
  subcategoryId?: string;    // optional subcategory
  date: string;
  status: 'paid' | 'pending';
  paymentMethod?: string;
  notes?: string;
  scheduledId?: string;
  cardId?: string;           // linked credit card
  bankId?: string;           // linked bank account (for dinheiro/pix/debito)
  referenceMonth?: string;   // 'YYYY-MM' — which invoice month this belongs to
  installmentGroupId?: string; // UUID shared by all installments of the same purchase
  installmentNumber?: number;  // 1-indexed position (e.g. 2 in a 3x purchase)
  installmentTotal?: number;   // total installment count (e.g. 3 in a 3x purchase)
}

export interface ScheduledTransaction {
  id: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  categoryId: string;
  startDate: string;
  endDate?: string;
  frequency: 'once' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  active: boolean;
}

export interface CreditCard {
  id: string;
  name: string;
  bank: string;
  brand: 'visa' | 'mastercard' | 'elo' | 'amex' | 'other';
  limit: number;
  closingDay: number;
  dueDay: number;
  color: string;
}

export interface Invoice {
  id: string;
  cardId: string;
  referenceMonth: string; // 'YYYY-MM'
  closingDate: string;    // 'YYYY-MM-DD'
  dueDate: string;        // 'YYYY-MM-DD'
  totalAmount: number;
  status: 'open' | 'closed' | 'paid' | 'overdue';
  paidTransactionId?: string;
}

export interface BankAccount {
  id: string;
  name: string;
  type: 'corrente' | 'poupança' | 'investimento';
  initialBalance: number;
  color: string;
  icon: string;
}

export interface Transfer {
  id: string;
  fromBankId: string;
  toBankId: string;
  amount: number;
  date: string;
  notes?: string;
}

export interface BudgetGroup {
  id: string;
  name: string;
  totalLimit?: number; // optional aggregate cap; undefined = sum of individual limits
}

export interface Budget {
  id: string;
  categoryId: string;
  name: string;
  amount: number;
  recurrence: 'mensal' | 'pontual';
  referenceMonth?: string; // 'YYYY-MM' — only for recurrence='pontual'
  active: boolean;
  groupId?: string; // optional — links to a BudgetGroup
}

export const defaultCategories: Category[] = [
  { id: 'cat-1', name: 'Salário', type: 'income', color: '#22c55e', icon: 'wallet', dreGroup: 'receita' },
  { id: 'cat-2', name: 'Freelance', type: 'income', color: '#10b981', icon: 'briefcase', dreGroup: 'receita' },
  { id: 'cat-3', name: 'Investimentos', type: 'income', color: '#34d399', icon: 'trending-up', dreGroup: 'receita' },
  { id: 'cat-4', name: 'Alimentação', type: 'expense', color: '#ef4444', icon: 'utensils', dreGroup: 'despesa_variavel' },
  { id: 'cat-5', name: 'Transporte', type: 'expense', color: '#f97316', icon: 'car', dreGroup: 'despesa_variavel' },
  { id: 'cat-6', name: 'Moradia', type: 'expense', color: '#8b5cf6', icon: 'home', dreGroup: 'despesa_fixa' },
  { id: 'cat-7', name: 'Saúde', type: 'expense', color: '#ec4899', icon: 'heart-pulse', dreGroup: 'despesa_fixa' },
  { id: 'cat-8', name: 'Educação', type: 'expense', color: '#3b82f6', icon: 'graduation-cap', dreGroup: 'despesa_variavel' },
  { id: 'cat-9', name: 'Lazer', type: 'expense', color: '#eab308', icon: 'party-popper', dreGroup: 'despesa_variavel' },
  { id: 'cat-10', name: 'Outros', type: 'expense', color: '#64748b', icon: 'more-horizontal', dreGroup: 'despesa_variavel' },
];

const generateMockTransactions = (): Transaction[] => {
  const now = new Date();
  const getDate = (daysAgo: number) => {
    const d = new Date();
    d.setDate(now.getDate() - daysAgo);
    return d.toISOString().split('T')[0];
  };

  return [
    { id: 't-1', description: 'Salário Tech Corp', amount: 8500, type: 'income', categoryId: 'cat-1', date: getDate(5), status: 'paid' },
    { id: 't-2', description: 'Mercado Livre', amount: 450.50, type: 'expense', categoryId: 'cat-4', date: getDate(4), status: 'paid' },
    { id: 't-3', description: 'Uber', amount: 35.00, type: 'expense', categoryId: 'cat-5', date: getDate(4), status: 'paid' },
    { id: 't-4', description: 'Aluguel', amount: 2500, type: 'expense', categoryId: 'cat-6', date: getDate(10), status: 'paid' },
    { id: 't-5', description: 'Plano de Saúde', amount: 650, type: 'expense', categoryId: 'cat-7', date: getDate(12), status: 'paid' },
    { id: 't-6', description: 'Freelance Design', amount: 1500, type: 'income', categoryId: 'cat-2', date: getDate(15), status: 'paid' },
    { id: 't-7', description: 'Restaurante', amount: 120, type: 'expense', categoryId: 'cat-4', date: getDate(2), status: 'paid' },
    { id: 't-8', description: 'Cinema', amount: 60, type: 'expense', categoryId: 'cat-9', date: getDate(1), status: 'paid' },
    { id: 't-9', description: 'Conta de Luz', amount: 185.30, type: 'expense', categoryId: 'cat-6', date: getDate(20), status: 'paid' },
    { id: 't-10', description: 'Internet', amount: 119.90, type: 'expense', categoryId: 'cat-6', date: getDate(18), status: 'paid' },
    { id: 't-11', description: 'Fatura Cartão', amount: 1850, type: 'expense', categoryId: 'cat-10', date: getDate(-2), status: 'pending' },
    { id: 't-12', description: 'Curso Online', amount: 99.90, type: 'expense', categoryId: 'cat-8', date: getDate(-5), status: 'pending' },
    { id: 't-13', description: 'Salário Tech Corp', amount: 8500, type: 'income', categoryId: 'cat-1', date: getDate(35), status: 'paid' },
    { id: 't-14', description: 'Aluguel', amount: 2500, type: 'expense', categoryId: 'cat-6', date: getDate(40), status: 'paid' },
    { id: 't-15', description: 'Mercado Extra', amount: 620, type: 'expense', categoryId: 'cat-4', date: getDate(32), status: 'paid' },
  ];
};

export const defaultTransactions = generateMockTransactions();

export const defaultScheduledTransactions: ScheduledTransaction[] = [
  { id: 's-1', description: 'Aluguel', amount: 2500, type: 'expense', categoryId: 'cat-6', startDate: new Date().toISOString().split('T')[0], frequency: 'monthly', active: true },
  { id: 's-2', description: 'Netflix', amount: 55.90, type: 'expense', categoryId: 'cat-9', startDate: new Date().toISOString().split('T')[0], frequency: 'monthly', active: true },
  { id: 's-3', description: 'Academia', amount: 120, type: 'expense', categoryId: 'cat-7', startDate: new Date().toISOString().split('T')[0], frequency: 'monthly', active: true },
  { id: 's-4', description: 'Salário Tech Corp', amount: 8500, type: 'income', categoryId: 'cat-1', startDate: new Date().toISOString().split('T')[0], frequency: 'monthly', active: true },
];
