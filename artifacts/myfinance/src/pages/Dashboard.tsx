import React, { useMemo } from 'react';
import { useFinance } from '@/context/FinanceContext';
import { formatCurrency, formatShortDate } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { getIcon } from '@/components/IconMap';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ArrowDown, ArrowUp, Wallet, Bell, Plus, CreditCard, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import { motion } from 'framer-motion';
import { TransactionFormDialog } from '@/components/TransactionFormDialog';
import { Link } from 'wouter';
import { cn } from '@/lib/utils';

export const Dashboard = () => {
  const { transactions, scheduled, categories, cards, invoices } = useFinance();
  const [isTransactionFormOpen, setIsTransactionFormOpen] = React.useState(false);

  const {
    currentMonthIncome, currentMonthExpense, balance,
    topCategories, recentTransactions, upcomingScheduled
  } = useMemo(() => {
    const now = new Date();
    const cm = now.getMonth(), cy = now.getFullYear();

    const monthTxs = transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === cm && d.getFullYear() === cy && t.status === 'paid';
    });

    let income = 0, expense = 0;
    monthTxs.forEach(t => { if (t.type === 'income') income += t.amount; else expense += t.amount; });

    let totalBalance = 0;
    transactions.filter(t => t.status === 'paid').forEach(t => {
      if (t.type === 'income') totalBalance += t.amount; else totalBalance -= t.amount;
    });

    const catTotals: Record<string, number> = {};
    monthTxs.filter(t => t.type === 'expense').forEach(t => {
      catTotals[t.categoryId] = (catTotals[t.categoryId] || 0) + t.amount;
    });
    const topCat = Object.entries(catTotals)
      .map(([id, amount]) => { const cat = categories.find(c => c.id === id); return { id, name: cat?.name || 'Desconhecida', amount, color: cat?.color || '#cbd5e1' }; })
      .sort((a, b) => b.amount - a.amount).slice(0, 5);

    const recent = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);

    const upcoming = scheduled.filter(s => s.active).slice(0, 3);

    return { currentMonthIncome: income, currentMonthExpense: expense, balance: totalBalance, topCategories: topCat, recentTransactions: recent, upcomingScheduled: upcoming };
  }, [transactions, scheduled, categories]);

  // Credit card summary
  const { totalUsed, openInvoicesCount, highUsageCards, dueSoonInvoices } = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const in3Days = new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0];

    let used = 0;
    let openCount = 0;
    const highUsage: typeof cards = [];
    const dueSoon: Array<{ card: typeof cards[0]; invoice: typeof invoices[0] }> = [];

    for (const card of cards) {
      const cardInvoices = invoices.filter(inv => inv.cardId === card.id && inv.status !== 'paid');
      const cardUsed = cardInvoices.reduce((s, inv) => s + inv.totalAmount, 0);
      used += cardUsed;
      openCount += cardInvoices.filter(inv => inv.status !== 'paid').length;

      if (card.limit > 0 && (cardUsed / card.limit) > 0.8) highUsage.push(card);

      for (const inv of cardInvoices) {
        if (inv.dueDate <= in3Days && inv.dueDate >= today && inv.status !== 'paid') {
          dueSoon.push({ card, invoice: inv });
        }
      }
    }

    return { totalUsed: used, openInvoicesCount: openCount, highUsageCards: highUsage, dueSoonInvoices: dueSoon };
  }, [cards, invoices]);

  // DRE quick summary for current month
  const dreQuickSummary = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear(), m = String(now.getMonth() + 1).padStart(2, '0');
    const start = `${y}-${m}-01`;
    const end = `${y}-${m}-${new Date(y, now.getMonth() + 1, 0).getDate()}`;
    const catMap = new Map(categories.map(c => [c.id, c]));

    let receitaBruta = 0, deducoes = 0, despesas = 0;
    for (const tx of transactions) {
      if (tx.date < start || tx.date > end) continue;
      const cat = catMap.get(tx.categoryId);
      if (!cat) continue;
      const g = cat.dreGroup ?? (cat.type === 'income' ? 'receita' : 'despesa_variavel');
      if (g === 'receita') receitaBruta += tx.amount;
      else if (g === 'deducao') deducoes += tx.amount;
      else despesas += tx.amount;
    }
    const resultado = (receitaBruta - deducoes) - despesas;
    const margem = receitaBruta > 0 ? (resultado / receitaBruta) * 100 : 0;
    return { receitaBruta, deducoes, despesas, resultado, margem };
  }, [transactions, categories]);

  const hasAlerts = highUsageCards.length > 0 || dueSoonInvoices.length > 0;

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Visão Geral</h1>
          <p className="text-muted-foreground">Bem-vindo de volta! Aqui está o resumo das suas finanças.</p>
        </div>
        <Button onClick={() => setIsTransactionFormOpen(true)} className="w-full md:w-auto shadow-sm hover-elevate">
          <Plus className="w-4 h-4 mr-2" /> Nova Transação
        </Button>
      </div>

      {/* Alerts */}
      {hasAlerts && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="pt-4 pb-3 space-y-2">
            <div className="flex items-center gap-2 font-medium text-amber-800 dark:text-amber-400 text-sm mb-1">
              <AlertTriangle className="w-4 h-4" /> Alertas
            </div>
            {highUsageCards.map(c => (
              <div key={c.id} className="text-sm text-amber-700 dark:text-amber-300 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <strong>{c.name}</strong>: mais de 80% do limite utilizado
              </div>
            ))}
            {dueSoonInvoices.map(({ card, invoice }) => (
              <div key={invoice.id} className="text-sm text-amber-700 dark:text-amber-300 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-orange-500" />
                Fatura <strong>{card.name}</strong> vence em {formatShortDate(invoice.dueDate)} — {formatCurrency(invoice.totalAmount)}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { title: 'Saldo Atual', value: balance, sub: 'Acumulado total', icon: Wallet, colorClass: 'text-primary', borderClass: 'border-l-primary/50', bgClass: 'bg-primary/10', delay: 0.1 },
          { title: 'Receitas (Mês)', value: currentMonthIncome, sub: 'Este mês', icon: ArrowUp, colorClass: 'text-success', borderClass: 'border-l-success/50', bgClass: 'bg-success/10', delay: 0.2 },
          { title: 'Despesas (Mês)', value: currentMonthExpense, sub: 'Este mês', icon: ArrowDown, colorClass: 'text-destructive', borderClass: 'border-l-destructive/50', bgClass: 'bg-destructive/10', delay: 0.3 },
        ].map(({ title, value, sub, icon: Icon, colorClass, borderClass, bgClass, delay }) => (
          <motion.div key={title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}>
            <Card className={`hover-elevate transition-all border-l-4 ${borderClass}`}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <div className={`${bgClass} p-2 rounded-full`}><Icon className={`w-4 h-4 ${colorClass}`} /></div>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${colorClass}`}>{formatCurrency(value)}</div>
                <p className="text-xs text-muted-foreground mt-1">{sub}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* DRE quick summary + Credit cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* DRE summary */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                {dreQuickSummary.resultado >= 0
                  ? <TrendingUp className="w-4 h-4 text-success" />
                  : <TrendingDown className="w-4 h-4 text-destructive" />}
                DRE — Mês Atual
              </CardTitle>
              <Link href="/dre"><Button variant="ghost" size="sm" className="text-xs">Ver completo</Button></Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Receita Líquida</span>
              <span className="font-medium text-success">{formatCurrency(dreQuickSummary.receitaBruta - dreQuickSummary.deducoes)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Despesas</span>
              <span className="font-medium text-destructive">{formatCurrency(dreQuickSummary.despesas)}</span>
            </div>
            <div className="flex justify-between text-sm font-semibold border-t pt-2 mt-2">
              <span>Resultado</span>
              <span className={dreQuickSummary.resultado >= 0 ? 'text-success' : 'text-destructive'}>
                {formatCurrency(dreQuickSummary.resultado)}
              </span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Margem líquida</span>
              <span className={dreQuickSummary.margem >= 0 ? 'text-success' : 'text-destructive'}>
                {dreQuickSummary.margem.toFixed(1)}%
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Credit cards summary */}
        {cards.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-primary" /> Cartões de Crédito
                </CardTitle>
                <Link href="/cards"><Button variant="ghost" size="sm" className="text-xs">Ver todos</Button></Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total utilizado</span>
                <span className="font-bold">{formatCurrency(totalUsed)}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{openInvoicesCount} fatura{openInvoicesCount !== 1 ? 's' : ''} em aberto</span>
              </div>
              {dueSoonInvoices.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <p className="text-xs font-medium text-amber-600">Vencendo em breve:</p>
                  {dueSoonInvoices.slice(0, 2).map(({ card, invoice }) => (
                    <div key={invoice.id} className="flex justify-between text-xs bg-amber-50 dark:bg-amber-950/20 rounded px-2 py-1.5">
                      <span className="text-muted-foreground">{card.name} — {formatShortDate(invoice.dueDate)}</span>
                      <span className="font-medium">{formatCurrency(invoice.totalAmount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top categories chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Maiores Gastos do Mês</CardTitle>
            <CardDescription>Top 5 categorias onde você mais gastou neste mês</CardDescription>
          </CardHeader>
          <CardContent>
            {topCategories.length > 0 ? (
              <div className="h-[280px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topCategories} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="hsl(var(--border))" />
                    <XAxis type="number" tickFormatter={(v) => `R$ ${v}`} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis dataKey="name" type="category" width={100} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                      itemStyle={{ color: 'hsl(var(--foreground))' }} />
                    <Bar dataKey="amount" radius={[0, 4, 4, 0]} barSize={24}>
                      {topCategories.map((entry, i) => <Cell key={`cell-${i}`} fill={entry.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground flex-col">
                <Wallet className="w-12 h-12 mb-4 opacity-20" />
                <p>Nenhum gasto registrado neste mês.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          {/* Upcoming */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="w-4 h-4 text-warning" /> Próximos Vencimentos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {upcomingScheduled.length > 0 ? upcomingScheduled.map((s) => (
                <div key={s.id} className="flex justify-between items-center text-sm border-b last:border-0 pb-3 last:pb-0">
                  <div>
                    <p className="font-medium">{s.description}</p>
                    <p className="text-xs text-muted-foreground">{s.frequency}</p>
                  </div>
                  <p className={s.type === 'expense' ? 'text-destructive font-medium' : 'text-success font-medium'}>
                    {formatCurrency(s.amount)}
                  </p>
                </div>
              )) : <p className="text-sm text-muted-foreground text-center py-4">Nenhuma conta próxima.</p>}
            </CardContent>
          </Card>

          {/* Recent transactions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Transações Recentes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentTransactions.length > 0 ? recentTransactions.map((t) => {
                const cat = categories.find(c => c.id === t.categoryId);
                const Icon = getIcon(cat?.icon || 'more-horizontal');
                return (
                  <div key={t.id} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${cat?.color || '#64748b'}20`, color: cat?.color || '#64748b' }}>
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
              }) : <p className="text-sm text-muted-foreground text-center py-4">Nenhuma transação recente.</p>}
            </CardContent>
          </Card>
        </div>
      </div>

      <TransactionFormDialog open={isTransactionFormOpen} onOpenChange={setIsTransactionFormOpen} />
    </div>
  );
};
