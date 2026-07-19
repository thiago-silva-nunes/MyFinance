import React, { useMemo, useState } from 'react';
import { useFinance } from '@/context/FinanceContext';
import { usePrivacy } from '@/context/PrivacyContext';
import { computeBankBalanceAtDate } from '@/lib/balanceUtils';
import { formatCurrency, formatShortDate } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { getIcon } from '@/components/IconMap';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { ArrowDown, ArrowUp, TrendingUp as TrendingBalance, Bell, Plus, CreditCard, AlertTriangle, TrendingUp, TrendingDown, CalendarRange, Target, Building2, SlidersHorizontal } from 'lucide-react';
import { motion } from 'framer-motion';
import { TransactionFormDialog } from '@/components/TransactionFormDialog';
import { BalanceAdjustDialog } from '@/components/BalanceAdjustDialog';
import { Link } from 'wouter';
import { cn } from '@/lib/utils';
import { BankAccount } from '@/data/mockData';

// ─── Period helpers ────────────────────────────────────────────────────────────

type DashPeriod = 'current_month' | 'prev_month' | 'last_3_months' | 'year' | 'custom_month';

const PERIOD_OPTIONS: { value: DashPeriod; label: string }[] = [
  { value: 'current_month', label: 'Este mês' },
  { value: 'prev_month',    label: 'Mês passado' },
  { value: 'last_3_months', label: 'Últimos 3 meses' },
  { value: 'year',          label: 'Este ano' },
  { value: 'custom_month',  label: 'Mês específico' },
];

function pad(n: number) { return String(n).padStart(2, '0'); }
function lastDay(y: number, m: number) { return new Date(y, m, 0).getDate(); }

function getPeriodRange(period: DashPeriod, customMonth: string): { start: string; end: string; label: string } {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth() + 1;
  switch (period) {
    case 'current_month':
      return { start: `${y}-${pad(m)}-01`, end: `${y}-${pad(m)}-${lastDay(y, m)}`, label: 'Este mês' };
    case 'prev_month': {
      const pm = m === 1 ? 12 : m - 1, py = m === 1 ? y - 1 : y;
      return { start: `${py}-${pad(pm)}-01`, end: `${py}-${pad(pm)}-${lastDay(py, pm)}`, label: 'Mês passado' };
    }
    case 'last_3_months': {
      // Go back 2 full months from current
      const totalM = y * 12 + (m - 1) - 2;
      const sy = Math.floor(totalM / 12), sm = (totalM % 12) + 1;
      return { start: `${sy}-${pad(sm)}-01`, end: `${y}-${pad(m)}-${lastDay(y, m)}`, label: 'Últimos 3 meses' };
    }
    case 'year':
      return { start: `${y}-01-01`, end: `${y}-12-31`, label: `${y}` };
    case 'custom_month': {
      if (customMonth) {
        const [cy, cm] = customMonth.split('-').map(Number);
        return { start: `${cy}-${pad(cm)}-01`, end: `${cy}-${pad(cm)}-${lastDay(cy, cm)}`, label: customMonth };
      }
      return { start: `${y}-${pad(m)}-01`, end: `${y}-${pad(m)}-${lastDay(y, m)}`, label: 'Este mês' };
    }
  }
}

// ─── Custom chart label ───────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ValueLabel(props: any) {
  const { x, y, width, height, value, hideValues } = props;
  if (value === undefined || value === null) return null;
  const text = hideValues ? '••••••' : formatCurrency(value as number);
  return (
    <text
      x={(x as number) + (width as number) + 6}
      y={(y as number) + (height as number) / 2}
      fill="hsl(var(--foreground))"
      fontSize={11}
      dominantBaseline="middle"
    >
      {text}
    </text>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

const BANK_TYPE_LABELS: Record<string, string> = {
  corrente: 'Conta Corrente',
  poupanca: 'Poupança',
  investimento: 'Investimento',
};

export const Dashboard = () => {
  const { transactions, scheduled, categories, cards, invoices, budgets, banks, transfers, balanceSnapshots, investments, loading } = useFinance();
  const { hideValues } = usePrivacy();
  const [isTransactionFormOpen, setIsTransactionFormOpen] = React.useState(false);
  const [period, setPeriod] = useState<DashPeriod>('current_month');
  const [customMonth, setCustomMonth] = useState('');
  const [adjustBank, setAdjustBank] = useState<BankAccount | null>(null);
  const [adjustOpen, setAdjustOpen] = useState(false);

  const mask = (amount: number) => hideValues ? 'R$ ••••••' : formatCurrency(amount);

  const range = useMemo(() => getPeriodRange(period, customMonth), [period, customMonth]);

  const {
    periodIncome, periodExpense, periodBalance,
    topCategories, recentTransactions, upcomingScheduled,
  } = useMemo(() => {
    // Use direct string comparison to avoid timezone issues with new Date()
    // Exclude balance-adjustment transactions from P&L — they affect bank balance only.
    const periodTxs = transactions.filter(t =>
      t.date >= range.start && t.date <= range.end && t.status === 'paid' && !t.isBalanceAdjustment,
    );

    let income = 0, expense = 0;
    periodTxs.forEach(t => { if (t.type === 'income') income += t.amount; else expense += t.amount; });

    // Group expenses by category, summing amounts
    const catTotals: Record<string, number> = {};
    periodTxs.filter(t => t.type === 'expense').forEach(t => {
      if (!t.categoryId) return;
      catTotals[t.categoryId] = (catTotals[t.categoryId] || 0) + t.amount;
    });
    const topCat = Object.entries(catTotals)
      .map(([id, amount]) => {
        const cat = categories.find(c => c.id === id);
        return { id, name: cat?.name || 'Desconhecida', amount, color: cat?.color || '#cbd5e1' };
      })
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    // Recent transactions in the selected period, sorted by date desc
    const recent = transactions
      .filter(t => t.date >= range.start && t.date <= range.end)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5);

    // Upcoming scheduled items within selected period.
    // For recurring items: show if they were/are active during the period
    // (startDate <= range.end and either no endDate or endDate >= range.start).
    // For once-off items: show only if startDate is within the period.
    const upcoming = scheduled
      .filter(s => {
        if (!s.active) return false;
        if (s.frequency === 'once') {
          return s.startDate >= range.start && s.startDate <= range.end;
        }
        // Recurring: overlaps with period
        const afterStart = s.startDate <= range.end;
        const beforeEnd = !s.endDate || s.endDate >= range.start;
        return afterStart && beforeEnd;
      })
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .slice(0, 3);

    return {
      periodIncome: income,
      periodExpense: expense,
      periodBalance: income - expense,
      topCategories: topCat,
      recentTransactions: recent,
      upcomingScheduled: upcoming,
    };
  }, [transactions, scheduled, categories, range]);

  // Credit card summary — total used and high-usage alerts are always current state
  // (reflects live debt). Period filter applies to "due within period" invoice list.
  const { totalUsed, openInvoicesCount, highUsageCards, dueSoonInvoices } = useMemo(() => {
    let used = 0, openCount = 0;
    const highUsage: typeof cards = [];

    for (const card of cards) {
      const cardInvoices = invoices.filter(inv => inv.cardId === card.id && inv.status !== 'paid');
      const cardUsed = cardInvoices.reduce((s, inv) => s + inv.totalAmount, 0);
      used += cardUsed;
      openCount += cardInvoices.length;
      if (card.limit > 0 && (cardUsed / card.limit) > 0.8) highUsage.push(card);
    }

    // "Due soon" invoices: those whose dueDate falls within the selected period range
    const dueSoon: Array<{ card: typeof cards[0]; invoice: typeof invoices[0] }> = [];
    for (const inv of invoices) {
      if (inv.status === 'paid') continue;
      if (inv.dueDate >= range.start && inv.dueDate <= range.end) {
        const card = cards.find(c => c.id === inv.cardId);
        if (card) dueSoon.push({ card, invoice: inv });
      }
    }

    return { totalUsed: used, openInvoicesCount: openCount, highUsageCards: highUsage, dueSoonInvoices: dueSoon };
  }, [cards, invoices, range]);

  // DRE quick summary for selected period
  const dreQuickSummary = useMemo(() => {
    const catMap = new Map(categories.map(c => [c.id, c]));
    let receitaBruta = 0, deducoes = 0, despesas = 0;
    for (const tx of transactions) {
      if (tx.date < range.start || tx.date > range.end) continue;
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
  }, [transactions, categories, range]);

  // Budget summary for current month (mensal budgets only)
  const budgetSummary = useMemo(() => {
    const now = new Date();
    const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return budgets
      .filter(b => b.active && b.recurrence === 'mensal')
      .map(b => {
        const spent = transactions
          .filter(t =>
            t.type === 'expense' &&
            t.categoryId === b.categoryId &&
            (t.status === 'paid' || t.status === 'pending') &&
            t.date.startsWith(monthPrefix) &&
            !t.isBalanceAdjustment,
          )
          .reduce((s, t) => s + t.amount, 0);
        const pct = b.amount > 0 ? Math.round((spent / b.amount) * 100) : 0;
        const cat = categories.find(c => c.id === b.categoryId);
        return { budget: b, spent, pct, cat };
      })
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 3);
  }, [budgets, transactions, categories]);

  // Bank balances — actual (paid txs only, bounded to today) + projected (actual + pending txs within period end)
  const { bankBalances, bankProjections, totalBankBalance, totalBankProjection } = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const paidTxs = transactions.filter(t => t.status === 'paid');
    const periodEnd = range.end;

    const balMap: Record<string, number> = {};
    const projMap: Record<string, number> = {};

    for (const bank of banks) {
      // Actual: only paid transactions, bounded to today
      const actual = computeBankBalanceAtDate(bank.id, bank, paidTxs, transfers, balanceSnapshots, today);
      balMap[bank.id] = actual;

      // Projected: actual + pending transactions in (today, periodEnd] + future transfers in (today, periodEnd]
      let proj = actual;
      for (const t of transactions) {
        if (t.bankId !== bank.id || t.status !== 'pending') continue;
        if (t.date <= today || t.date > periodEnd) continue;
        proj += t.type === 'income' ? t.amount : -t.amount;
      }
      // Transfers have no status — treat future ones as scheduled
      for (const tr of transfers) {
        if (tr.date <= today || tr.date > periodEnd) continue;
        if (tr.fromBankId === bank.id) proj -= tr.amount;
        if (tr.toBankId === bank.id) proj += tr.amount;
      }
      projMap[bank.id] = proj;
    }

    const totalActual = Object.values(balMap).reduce((s, v) => s + v, 0);
    const totalProj = Object.values(projMap).reduce((s, v) => s + v, 0);
    return { bankBalances: balMap, bankProjections: projMap, totalBankBalance: totalActual, totalBankProjection: totalProj };
  }, [banks, transactions, transfers, balanceSnapshots, range]);

  const hasAlerts = highUsageCards.length > 0 || dueSoonInvoices.length > 0;
  const isCurrentMonth = period === 'current_month';

  if (loading) return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div className="flex justify-between items-center gap-4">
        <div className="space-y-2"><Skeleton className="h-9 w-40" /><Skeleton className="h-4 w-64" /></div>
        <Skeleton className="h-9 w-36" />
      </div>
      <Skeleton className="h-14 w-full rounded-xl" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[0,1,2].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Skeleton className="h-72 rounded-xl" /><Skeleton className="h-72 rounded-xl" />
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );

  if (!loading && transactions.length === 0) return (
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
      <Card>
        <CardContent className="py-20 flex flex-col items-center gap-4 text-center">
          <TrendingBalance className="w-16 h-16 text-muted-foreground/20" />
          <div>
            <h3 className="font-semibold text-xl mb-2">Nenhuma transação ainda</h3>
            <p className="text-muted-foreground text-sm max-w-sm">
              Registre sua primeira entrada ou saída para começar a acompanhar suas finanças em tempo real.
            </p>
          </div>
          <Button onClick={() => setIsTransactionFormOpen(true)} size="lg" className="mt-1">
            <Plus className="w-4 h-4 mr-2" /> Registrar primeira transação
          </Button>
        </CardContent>
      </Card>
      <TransactionFormDialog open={isTransactionFormOpen} onOpenChange={setIsTransactionFormOpen} />
    </div>
  );

  return (
    <div className="space-y-6 pb-20 md:pb-0">

      {/* Header + period selector */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Visão Geral</h1>
          <p className="text-muted-foreground">Bem-vindo de volta! Aqui está o resumo das suas finanças.</p>
        </div>
        <Button onClick={() => setIsTransactionFormOpen(true)} className="w-full md:w-auto shadow-sm hover-elevate">
          <Plus className="w-4 h-4 mr-2" /> Nova Transação
        </Button>
      </div>

      {/* Period filter */}
      <div className="flex flex-wrap items-center gap-2 bg-card border rounded-xl px-4 py-3">
        <CalendarRange className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className="text-sm text-muted-foreground mr-1">Período:</span>
        <Select value={period} onValueChange={(v) => setPeriod(v as DashPeriod)}>
          <SelectTrigger className="w-44 h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {period === 'custom_month' && (
          <Input
            type="month"
            value={customMonth}
            onChange={e => setCustomMonth(e.target.value)}
            className="w-40 h-8 text-sm"
          />
        )}
        {range.label && (
          <span className="text-xs text-muted-foreground ml-1 hidden sm:block">
            {range.start} → {range.end}
          </span>
        )}
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
                Fatura <strong>{card.name}</strong> vence em {formatShortDate(invoice.dueDate)} — {mask(invoice.totalAmount)}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            title: isCurrentMonth ? 'Resultado do Mês' : `Resultado (${range.label})`,
            value: periodBalance,
            sub: periodBalance >= 0 ? 'Sobrou no período' : 'Deficit no período',
            icon: TrendingBalance,
            colorClass: periodBalance >= 0 ? 'text-primary' : 'text-destructive',
            borderClass: periodBalance >= 0 ? 'border-l-primary/50' : 'border-l-destructive/50',
            bgClass: periodBalance >= 0 ? 'bg-primary/10' : 'bg-destructive/10',
            delay: 0.1,
          },
          {
            title: 'Receitas',
            value: periodIncome,
            sub: range.label,
            icon: ArrowUp,
            colorClass: 'text-success',
            borderClass: 'border-l-success/50',
            bgClass: 'bg-success/10',
            delay: 0.2,
          },
          {
            title: 'Despesas',
            value: periodExpense,
            sub: range.label,
            icon: ArrowDown,
            colorClass: 'text-destructive',
            borderClass: 'border-l-destructive/50',
            bgClass: 'bg-destructive/10',
            delay: 0.3,
          },
        ].map(({ title, value, sub, icon: Icon, colorClass, borderClass, bgClass, delay }) => (
          <motion.div key={title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}>
            <Card className={`hover-elevate transition-all border-l-4 ${borderClass}`}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <div className={`${bgClass} p-2 rounded-full`}><Icon className={`w-4 h-4 ${colorClass}`} /></div>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${colorClass}`}>{mask(value)}</div>
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
                DRE — {range.label}
              </CardTitle>
              <Link href="/dre"><Button variant="ghost" size="sm" className="text-xs">Ver completo</Button></Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Receita Líquida</span>
              <span className="font-medium text-success">{mask(dreQuickSummary.receitaBruta - dreQuickSummary.deducoes)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Despesas</span>
              <span className="font-medium text-destructive">{mask(dreQuickSummary.despesas)}</span>
            </div>
            <div className="flex justify-between text-sm font-semibold border-t pt-2 mt-2">
              <span>Resultado</span>
              <span className={dreQuickSummary.resultado >= 0 ? 'text-success' : 'text-destructive'}>
                {mask(dreQuickSummary.resultado)}
              </span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Margem líquida</span>
              <span className={dreQuickSummary.margem >= 0 ? 'text-success' : 'text-destructive'}>
                {hideValues ? '••••' : `${dreQuickSummary.margem.toFixed(1)}%`}
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
                <span className="font-bold">{mask(totalUsed)}</span>
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
                      <span className="font-medium">{mask(invoice.totalAmount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Budget summary */}
      {budgetSummary.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" /> Orçamentos do mês
              </CardTitle>
              <Link href="/orcamentos"><Button variant="ghost" size="sm" className="text-xs">Ver todos</Button></Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {budgetSummary.map(({ budget, spent, pct, cat }) => {
              const Icon = getIcon(cat?.icon ?? 'circle');
              const barColor = pct >= 100 ? 'bg-destructive' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500';
              return (
                <div key={budget.id} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: cat?.color }} />
                      <span className="truncate font-medium">{budget.name}</span>
                    </div>
                    <span className={cn('text-xs font-medium shrink-0 ml-2',
                      pct >= 100 ? 'text-destructive' : pct >= 80 ? 'text-amber-600' : 'text-muted-foreground',
                    )}>
                      {mask(spent)} / {mask(budget.amount)}
                    </span>
                  </div>
                  <Progress value={Math.min(pct, 100)} className="h-1.5" indicatorClassName={barColor} />
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Patrimônio Total — bank balance + investment current value */}
      {(banks.length > 0 || investments.length > 0) && (() => {
        const totalInvestmentValue = investments.reduce((s, i) => s + i.currentValue, 0);
        const patrimonio = totalBankBalance + totalInvestmentValue;
        return (
          <Card className="border-l-4 border-l-primary/50">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" /> Patrimônio Total
                </CardTitle>
                <span className="text-xs text-muted-foreground">contas + investimentos</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${patrimonio >= 0 ? 'text-primary' : 'text-destructive'}`}>
                {mask(patrimonio)}
              </div>
              <div className="flex gap-4 mt-2">
                <div>
                  <p className="text-xs text-muted-foreground">Saldo em contas</p>
                  <p className="text-sm font-medium">{mask(totalBankBalance)}</p>
                </div>
                {investments.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground">Investimentos</p>
                    <p className="text-sm font-medium">{mask(totalInvestmentValue)}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Bank accounts — actual (paid txs up to today) + projected (end of selected period) */}
      {banks.length > 0 && (() => {
        const [, pm, pd] = range.end.split('-');
        const periodEndLabel = `${pd}/${pm}`;
        const projDiffers = totalBankProjection !== totalBankBalance;
        const projWorse = totalBankProjection < totalBankBalance;
        return (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-primary" /> Contas Bancárias
                </CardTitle>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Saldo total atual</p>
                  <p className={`text-lg font-bold leading-tight ${totalBankBalance >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {mask(totalBankBalance)}
                  </p>
                  {projDiffers && (
                    <p className={`text-xs font-medium leading-tight ${projWorse ? 'text-destructive' : 'text-muted-foreground'}`}>
                      Prev. {periodEndLabel}: {mask(totalBankProjection)}
                    </p>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {banks.map(bank => {
                  const balance = bankBalances[bank.id] ?? bank.initialBalance;
                  const projection = bankProjections[bank.id] ?? balance;
                  const bankProjDiffers = projection !== balance;
                  const bankProjWorse = projection < balance;
                  const Icon = getIcon(bank.icon);
                  return (
                    <div key={bank.id} className="group flex items-center gap-3 p-3 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${bank.color}22`, color: bank.color }}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{bank.name}</p>
                        <p className="text-xs text-muted-foreground">{BANK_TYPE_LABELS[bank.type] ?? bank.type}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-semibold ${balance >= 0 ? 'text-success' : 'text-destructive'}`}>
                          {mask(balance)}
                        </p>
                        {bankProjDiffers && (
                          <p className={`text-xs ${bankProjWorse ? 'text-destructive' : 'text-muted-foreground'}`}>
                            Prev: {mask(projection)}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Ajustar saldo"
                        onClick={() => { setAdjustBank(bank); setAdjustOpen(true); }}
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-3 text-center">
                Saldo atual (transações pagas até hoje) · previsão considera pendências até {periodEndLabel}
              </p>
            </CardContent>
          </Card>
        );
      })()}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top categories chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Maiores Gastos</CardTitle>
            <CardDescription>Top 5 categorias com maiores despesas — {range.label}</CardDescription>
          </CardHeader>
          <CardContent>
            {topCategories.length > 0 ? (
              <div className="h-[260px] w-full mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={topCategories}
                    layout="vertical"
                    margin={{ top: 4, right: hideValues ? 80 : 120, left: 8, bottom: 4 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      horizontal={false}
                      vertical={true}
                      stroke="hsl(var(--border))"
                    />
                    <XAxis
                      type="number"
                      tickFormatter={(v) => hideValues ? '••••' : `R$${(v / 1000).toFixed(0)}k`}
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={90}
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      formatter={(v: number) => [hideValues ? 'R$ ••••••' : formatCurrency(v), 'Gasto']}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        borderColor: 'hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      itemStyle={{ color: 'hsl(var(--foreground))' }}
                      cursor={{ fill: 'hsl(var(--muted))', opacity: 0.5 }}
                    />
                    <Bar dataKey="amount" radius={[0, 6, 6, 0]} barSize={28} isAnimationActive={true}>
                      {topCategories.map((entry, i) => (
                        <Cell key={`cell-${i}`} fill={entry.color} fillOpacity={0.9} />
                      ))}
                      <LabelList content={(props) => <ValueLabel {...props} hideValues={hideValues} />} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[260px] flex items-center justify-center text-muted-foreground flex-col">
                <ArrowDown className="w-12 h-12 mb-4 opacity-20" />
                <p>Nenhum gasto registrado neste período.</p>
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
                    {mask(s.amount)}
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
                        {t.type === 'income' ? '+' : '-'}{mask(t.amount)}
                      </p>
                      {t.status === 'pending' && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">Pendente</Badge>
                      )}
                    </div>
                  </div>
                );
              }) : <p className="text-sm text-muted-foreground text-center py-4">Nenhuma transação neste período.</p>}
            </CardContent>
          </Card>
        </div>
      </div>

      <TransactionFormDialog open={isTransactionFormOpen} onOpenChange={setIsTransactionFormOpen} />
      <BalanceAdjustDialog
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        bank={adjustBank}
        currentBalance={adjustBank ? (bankBalances[adjustBank.id] ?? adjustBank.initialBalance) : 0}
      />
    </div>
  );
};
