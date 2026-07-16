import React, { useMemo } from 'react';
import { useFinance } from '@/context/FinanceContext';
import { formatCurrency, formatShortDate } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getIcon } from '@/components/IconMap';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ArrowDown, ArrowUp, Wallet, Bell, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import { TransactionFormDialog } from '@/components/TransactionFormDialog';
import { Button } from '@/components/ui/button';

export const Dashboard = () => {
  const { transactions, scheduled, categories } = useFinance();
  const [isTransactionFormOpen, setIsTransactionFormOpen] = React.useState(false);

  const {
    currentMonthIncome,
    currentMonthExpense,
    balance,
    topCategories,
    recentTransactions,
    upcomingScheduled
  } = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Current month totals
    const monthTransactions = transactions.filter(t => {
      const date = new Date(t.date);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear && t.status === 'paid';
    });

    let income = 0;
    let expense = 0;
    monthTransactions.forEach(t => {
      if (t.type === 'income') income += t.amount;
      else expense += t.amount;
    });

    // All-time balance (paid only)
    let totalBalance = 0;
    transactions.filter(t => t.status === 'paid').forEach(t => {
      if (t.type === 'income') totalBalance += t.amount;
      else totalBalance -= t.amount;
    });

    // Top 5 spending categories this month
    const categoryTotals: Record<string, number> = {};
    monthTransactions.filter(t => t.type === 'expense').forEach(t => {
      categoryTotals[t.categoryId] = (categoryTotals[t.categoryId] || 0) + t.amount;
    });

    const topCat = Object.entries(categoryTotals)
      .map(([id, amount]) => {
        const cat = categories.find(c => c.id === id);
        return {
          id,
          name: cat?.name || 'Desconhecida',
          amount,
          color: cat?.color || '#cbd5e1'
        };
      })
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    // Recent 5 transactions
    const recent = [...transactions]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);

    // Upcoming scheduled (next 7 days)
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const upcoming = scheduled
      .filter(s => s.active)
      .map(s => {
        // Find next occurrence (simplified to just check if active for demo purposes)
        return { ...s, nextDate: now.toISOString() }; // Mock next date
      })
      .slice(0, 3);

    return {
      currentMonthIncome: income,
      currentMonthExpense: expense,
      balance: totalBalance,
      topCategories: topCat,
      recentTransactions: recent,
      upcomingScheduled: upcoming
    };
  }, [transactions, scheduled, categories]);

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Visão Geral</h1>
          <p className="text-muted-foreground">Bem-vindo de volta! Aqui está o resumo das suas finanças.</p>
        </div>
        <Button onClick={() => setIsTransactionFormOpen(true)} className="w-full md:w-auto shadow-sm hover-elevate">
          <Plus className="w-4 h-4 mr-2" />
          Nova Transação
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="hover-elevate transition-all border-l-4 border-l-primary/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Saldo Atual</CardTitle>
              <div className="bg-primary/10 p-2 rounded-full">
                <Wallet className="w-4 h-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(balance)}</div>
              <p className="text-xs text-muted-foreground mt-1">Acumulado total</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="hover-elevate transition-all border-l-4 border-l-success/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Receitas (Mês)</CardTitle>
              <div className="bg-success/10 p-2 rounded-full">
                <ArrowUp className="w-4 h-4 text-success" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{formatCurrency(currentMonthIncome)}</div>
              <p className="text-xs text-muted-foreground mt-1">Este mês</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="hover-elevate transition-all border-l-4 border-l-destructive/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Despesas (Mês)</CardTitle>
              <div className="bg-destructive/10 p-2 rounded-full">
                <ArrowDown className="w-4 h-4 text-destructive" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{formatCurrency(currentMonthExpense)}</div>
              <p className="text-xs text-muted-foreground mt-1">Este mês</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Maiores Gastos do Mês</CardTitle>
            <CardDescription>Top 5 categorias onde você mais gastou neste mês</CardDescription>
          </CardHeader>
          <CardContent>
            {topCategories.length > 0 ? (
              <div className="h-[300px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topCategories} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="hsl(var(--border))" />
                    <XAxis type="number" tickFormatter={(value) => `R$ ${value}`} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis dataKey="name" type="category" width={100} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                      itemStyle={{ color: 'hsl(var(--foreground))' }}
                    />
                    <Bar dataKey="amount" radius={[0, 4, 4, 0]} barSize={24}>
                      {topCategories.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground flex-col">
                <Wallet className="w-12 h-12 mb-4 opacity-20" />
                <p>Nenhum gasto registrado neste mês.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="w-4 h-4 text-warning" /> 
                Próximos Vencimentos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {upcomingScheduled.length > 0 ? (
                upcomingScheduled.map((s) => (
                  <div key={s.id} className="flex justify-between items-center text-sm border-b last:border-0 pb-3 last:pb-0">
                    <div>
                      <p className="font-medium">{s.description}</p>
                      <p className="text-xs text-muted-foreground">{s.frequency}</p>
                    </div>
                    <div className="text-right">
                      <p className={s.type === 'expense' ? 'text-destructive font-medium' : 'text-success font-medium'}>
                        {formatCurrency(s.amount)}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma conta próxima.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Transações Recentes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {recentTransactions.length > 0 ? (
                recentTransactions.map((t) => {
                  const cat = categories.find(c => c.id === t.categoryId);
                  const Icon = getIcon(cat?.icon || 'more-horizontal');
                  return (
                    <div key={t.id} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: `${cat?.color || '#64748b'}20`, color: cat?.color || '#64748b' }}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{t.description}</p>
                        <p className="text-xs text-muted-foreground">{formatShortDate(t.date)}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-medium ${t.type === 'income' ? 'text-success' : ''}`}>
                          {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                        </p>
                        {t.status === 'pending' && <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">Pendente</Badge>}
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma transação recente.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <TransactionFormDialog open={isTransactionFormOpen} onOpenChange={setIsTransactionFormOpen} />
    </div>
  );
};