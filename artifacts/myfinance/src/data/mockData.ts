export interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  color: string;
  icon: string;
}

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  categoryId: string;
  date: string;
  status: 'paid' | 'pending';
  paymentMethod?: string;
  notes?: string;
  scheduledId?: string;
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

export const defaultCategories: Category[] = [
  { id: 'cat-1', name: 'Salário', type: 'income', color: '#22c55e', icon: 'wallet' },
  { id: 'cat-2', name: 'Freelance', type: 'income', color: '#10b981', icon: 'briefcase' },
  { id: 'cat-3', name: 'Investimentos', type: 'income', color: '#34d399', icon: 'trending-up' },
  { id: 'cat-4', name: 'Alimentação', type: 'expense', color: '#ef4444', icon: 'utensils' },
  { id: 'cat-5', name: 'Transporte', type: 'expense', color: '#f97316', icon: 'car' },
  { id: 'cat-6', name: 'Moradia', type: 'expense', color: '#8b5cf6', icon: 'home' },
  { id: 'cat-7', name: 'Saúde', type: 'expense', color: '#ec4899', icon: 'heart-pulse' },
  { id: 'cat-8', name: 'Educação', type: 'expense', color: '#3b82f6', icon: 'graduation-cap' },
  { id: 'cat-9', name: 'Lazer', type: 'expense', color: '#eab308', icon: 'party-popper' },
  { id: 'cat-10', name: 'Outros', type: 'expense', color: '#64748b', icon: 'more-horizontal' },
];

const generateMockTransactions = (): Transaction[] => {
  const transactions: Transaction[] = [];
  const now = new Date();
  
  // A helper to get dates in the past months
  const getDate = (daysAgo: number) => {
    const d = new Date();
    d.setDate(now.getDate() - daysAgo);
    return d.toISOString();
  };

  transactions.push(
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
    
    // Future/Pending
    { id: 't-11', description: 'Fatura Cartão', amount: 1850, type: 'expense', categoryId: 'cat-10', date: getDate(-2), status: 'pending' },
    { id: 't-12', description: 'Curso Online', amount: 99.90, type: 'expense', categoryId: 'cat-8', date: getDate(-5), status: 'pending' },
    
    // Older
    { id: 't-13', description: 'Salário Tech Corp', amount: 8500, type: 'income', categoryId: 'cat-1', date: getDate(35), status: 'paid' },
    { id: 't-14', description: 'Aluguel', amount: 2500, type: 'expense', categoryId: 'cat-6', date: getDate(40), status: 'paid' },
    { id: 't-15', description: 'Mercado Extra', amount: 620, type: 'expense', categoryId: 'cat-4', date: getDate(32), status: 'paid' }
  );

  return transactions;
};

export const defaultTransactions = generateMockTransactions();

export const defaultScheduledTransactions: ScheduledTransaction[] = [
  { id: 's-1', description: 'Aluguel', amount: 2500, type: 'expense', categoryId: 'cat-6', startDate: new Date().toISOString(), frequency: 'monthly', active: true },
  { id: 's-2', description: 'Netflix', amount: 55.90, type: 'expense', categoryId: 'cat-9', startDate: new Date().toISOString(), frequency: 'monthly', active: true },
  { id: 's-3', description: 'Academia', amount: 120, type: 'expense', categoryId: 'cat-7', startDate: new Date().toISOString(), frequency: 'monthly', active: true },
  { id: 's-4', description: 'Salário Tech Corp', amount: 8500, type: 'income', categoryId: 'cat-1', startDate: new Date().toISOString(), frequency: 'monthly', active: true },
];
