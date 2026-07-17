import React, { useMemo, useState } from 'react';
import { useFinance } from '@/context/FinanceContext';
import { usePrivacy } from '@/context/PrivacyContext';
import { formatCurrency } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { getIcon } from '@/components/IconMap';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { ArrowLeft, TrendingUp, TrendingDown, AlertTriangle, Star } from 'lucide-react';
import { Link } from 'wouter';
import { monthlyEquivalent } from '@/services/recurringEngine';

// ─── Period helpers ────────────────────────────────────────────────────────────

type Period = 'current_month' | 'prev_month' | 'last_3_months' | 'year' | 'custom_month' | 'custom_range';

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: 'current_month', label: 'Este mês' },
  { value: 'prev_month',    label: 'Mês passado' },
  { value: 'last_3_months', label: 'Últimos 3 meses' },
  { value: 'year',          label: 'Este ano' },
  { value: 'custom_month',  label: 'Mês específico' },
  { value: 'custom_range',  label: 'Intervalo personalizado' },
];

function pad(n: number) { return String(n).padStart(2, '0'); }
function lastDay(y: number, m: number) { return new Date(y, m, 0).getDate(); }

function getPeriodRange(
  period: Period,
  customMonth: string,
  customStart: string,
  customEnd: string,
) {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth() + 1;
  switch (period) {
    case 'current_month':
      return { start: `${y}-${pad(m)}-01`, end: `${y}-${pad(m)}-${lastDay(y, m)}` };
    case 'prev_month': {
      const pm = m === 1 ? 12 : m - 1, py = m === 1 ? y - 1 : y;
      return { start: `${py}-${pad(pm)}-01`, end: `${py}-${pad(pm)}-${lastDay(py, pm)}` };
    }
    case 'last_3_months': {
      const totalM = y * 12 + (m - 1) - 2;
      const sy = Math.floor(totalM / 12), sm = (totalM % 12) + 1;
      return { start: `${sy}-${pad(sm)}-01`, end: `${y}-${pad(m)}-${lastDay(y, m)}` };
    }
    case 'year':
      return { start: `${y}-01-01`, end: `${y}-12-31` };
    case 'custom_month': {
      if (customMonth) {
        const [cy, cm] = customMonth.split('-').map(Number);
        return { start: `${cy}-${pad(cm)}-01`, end: `${cy}-${pad(cm)}-${lastDay(cy, cm)}` };
      }
      return { start: `${y}-${pad(m)}-01`, end: `${y}-${pad(m)}-${lastDay(y, m)}` };
    }
    case 'custom_range': {
      const s = customStart || `${y}-${pad(m)}-01`;
      const e = customEnd   || `${y}-${pad(m)}-${lastDay(y, m)}`;
      return { start: s, end: e };
    }
  }
}

/** Returns YYYY-MM N months before (or after) a reference month string */
function offsetMonth(ym: string, delta: number): string {
  const [y, mo] = ym.split('-').map(Number);
  const totalM = y * 12 + (mo - 1) + delta;
  const newY = Math.floor(totalM / 12);
  const newM = (totalM % 12) + 1;
  return `${newY}-${pad(newM)}`;
}

/** Current month as YYYY-MM */
function currentYM(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
}

const CHART_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#3b82f6',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#84cc16',
];

// ─── Component ────────────────────────────────────────────────────────────────

export const ScheduledAnalysis = () => {
  const { transactions, scheduled, categories } = useFinance();
  const { hideValues } = usePrivacy();
  const [period, setPeriod] = useState<Period>('current_month');
  const [customMonth, setCustomMonth] = useState('');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const mv = (amount: number) => hideValues ? 'R$ ••••••' : formatCurrency(amount);

  const range = useMemo(() => getPeriodRange(period, customMonth, customStart, customEnd), [period, customMonth, customStart, customEnd]);

  // Transactions from recurring schedules within the range
  const recurringTxns = useMemo(() =>
    transactions.filter(t =>
      t.scheduledId &&
      t.type === 'expense' &&
      t.date >= range.start &&
      t.date <= range.end,
    ),
    [transactions, range],
  );

  // Total for current period
  const totalCurrent = useMemo(() =>
    recurringTxns.reduce((s, t) => s + t.amount, 0),
    [recurringTxns],
  );

  // Total for previous equivalent period (for % comparison)
  const totalPrev = useMemo(() => {
    const prevStart = range.start.replace(/\d{4}/, (y) => String(Number(y) - (period === 'year' ? 1 : 0)));
    // Simple approach: shift the date range back by the same number of days
    const startD = new Date(range.start);
    const endD = new Date(range.end);
    const diffMs = endD.getTime() - startD.getTime();
    const prevEndD = new Date(startD.getTime() - 1); // day before start
    const prevStartD = new Date(prevEndD.getTime() - diffMs);
    const pStart = prevStartD.toISOString().split('T')[0];
    const pEnd = prevEndD.toISOString().split('T')[0];
    return transactions
      .filter(t => t.scheduledId && t.type === 'expense' && t.date >= pStart && t.date <= pEnd)
      .reduce((s, t) => s + t.amount, 0);
  }, [transactions, range, period]);

  const pctChange = totalPrev > 0 ? ((totalCurrent - totalPrev) / totalPrev) * 100 : null;

  // Total all expenses in period (for % share)
  const totalAllExpenses = useMemo(() =>
    transactions.filter(t =>
      t.type === 'expense' && t.date >= range.start && t.date <= range.end && t.status === 'paid',
    ).reduce((s, t) => s + t.amount, 0),
    [transactions, range],
  );

  // Category breakdown
  const categoryBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of recurringTxns) {
      map[t.categoryId] = (map[t.categoryId] ?? 0) + t.amount;
    }
    return Object.entries(map)
      .map(([catId, total]) => {
        const cat = categories.find(c => c.id === catId);
        return { catId, name: cat?.name ?? 'Sem categoria', color: cat?.color ?? '#6366f1', total };
      })
      .sort((a, b) => b.total - a.total);
  }, [recurringTxns, categories]);

  // Historical data: last 12 months
  const historicalData = useMemo(() => {
    const cur = currentYM();
    return Array.from({ length: 12 }, (_, i) => {
      const ym = offsetMonth(cur, -(11 - i));
      const [y, mo] = ym.split('-').map(Number);
      const monthStart = `${y}-${pad(mo)}-01`;
      const monthEnd = `${y}-${pad(mo)}-${lastDay(y, mo)}`;
      const total = transactions
        .filter(t => t.scheduledId && t.type === 'expense' && t.date >= monthStart && t.date <= monthEnd)
        .reduce((s, t) => s + t.amount, 0);
      const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      return { month: monthNames[mo - 1], ym, total };
    });
  }, [transactions]);

  // Per-item detail: active scheduled with monthly equivalent
  const itemDetail = useMemo(() => {
    const totalMonthly = scheduled
      .filter(s => s.active && s.type === 'expense')
      .reduce((sum, s) => sum + monthlyEquivalent(s), 0);

    return scheduled
      .filter(s => s.active && s.type === 'expense')
      .map(s => {
        const cat = categories.find(c => c.id === s.categoryId);
        const equiv = monthlyEquivalent(s);
        const pct = totalMonthly > 0 ? (equiv / totalMonthly) * 100 : 0;
        const timesPaid = transactions.filter(t => t.scheduledId === s.id && t.status === 'paid').length;
        return { ...s, catName: cat?.name ?? '-', catColor: cat?.color ?? '#6366f1', catIcon: cat?.icon ?? 'more-horizontal', equiv, pct, timesPaid };
      })
      .sort((a, b) => b.equiv - a.equiv);
  }, [scheduled, categories, transactions]);

  const topItem = itemDetail[0];
  const shareOfTotal = totalAllExpenses > 0 ? (totalCurrent / totalAllExpenses) * 100 : 0;

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <Link href="/scheduled">
            <Button variant="ghost" size="icon" className="shrink-0">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Análise de Recorrentes</h1>
            <p className="text-muted-foreground">Gastos fixos e recorrentes detalhados.</p>
          </div>
        </div>

        {/* Period selector */}
        <div className="flex flex-wrap items-center gap-2">
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="w-48">
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
              className="w-40"
              value={customMonth}
              onChange={e => setCustomMonth(e.target.value)}
            />
          )}
          {period === 'custom_range' && (
            <>
              <Input
                type="date"
                className="w-40"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
                placeholder="Data início"
              />
              <span className="text-muted-foreground text-sm">até</span>
              <Input
                type="date"
                className="w-40"
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
                placeholder="Data fim"
              />
            </>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total de gastos recorrentes</CardDescription>
            <CardTitle className="text-2xl">{mv(totalCurrent)}</CardTitle>
          </CardHeader>
          <CardContent>
            {pctChange !== null ? (
              <div className={`flex items-center gap-1 text-sm font-medium ${pctChange > 0 ? 'text-destructive' : 'text-success'}`}>
                {pctChange > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                {Math.abs(pctChange).toFixed(1)}% vs período anterior
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Sem dados do período anterior</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>% das despesas totais</CardDescription>
            <CardTitle className="text-2xl">{shareOfTotal.toFixed(1)}%</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {mv(totalAllExpenses)} em despesas totais no período
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Maior gasto fixo</CardDescription>
            <CardTitle className="text-2xl truncate">{topItem?.description ?? '—'}</CardTitle>
          </CardHeader>
          <CardContent>
            {topItem ? (
              <div className="flex items-center gap-2">
                <Star className="w-3 h-3 text-amber-500" />
                <span className="text-sm font-medium text-muted-foreground">
                  {mv(topItem.equiv)}/mês · {topItem.catName}
                </span>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Nenhum ativo</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Category breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Por categoria</CardTitle>
            <CardDescription>Gastos recorrentes agrupados por categoria no período</CardDescription>
          </CardHeader>
          <CardContent>
            {categoryBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Nenhum gasto recorrente encontrado no período.
              </p>
            ) : (
              <div className="space-y-4">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={categoryBreakdown}
                      dataKey="total"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={85}
                      label={hideValues ? false : ({ name, percent }) =>
                        percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''
                      }
                    >
                      {categoryBreakdown.map((entry, i) => (
                        <Cell key={entry.catId} fill={entry.color || CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: number) => [mv(val), 'Total']}
                      contentStyle={{ fontSize: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>

                {/* Legend list */}
                <div className="space-y-1.5">
                  {categoryBreakdown.map((entry, i) => {
                    const pct = totalCurrent > 0 ? (entry.total / totalCurrent) * 100 : 0;
                    return (
                      <div key={entry.catId} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className="w-3 h-3 rounded-sm shrink-0"
                            style={{ background: entry.color || CHART_COLORS[i % CHART_COLORS.length] }}
                          />
                          <span className="truncate text-muted-foreground">{entry.name}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-xs text-muted-foreground">{pct.toFixed(1)}%</span>
                          <span className="font-medium">{mv(entry.total)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Historical evolution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Evolução histórica</CardTitle>
            <CardDescription>Total de gastos recorrentes mês a mês (últimos 12 meses)</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={historicalData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => hideValues ? '••' : (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
                />
                <Tooltip
                  formatter={(val: number) => [mv(val), 'Recorrentes']}
                  contentStyle={{ fontSize: 12 }}
                />
                <Bar dataKey="total" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Per-item detail table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detalhamento por item</CardTitle>
          <CardDescription>
            Recorrências ativas com custo mensal equivalente e histórico de pagamentos
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {itemDetail.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6 text-center">
              Nenhuma recorrência de despesa ativa.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Descrição</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Categoria</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Equiv./mês</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">% do total</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Vezes pago</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {itemDetail.map((item, i) => {
                    const Icon = getIcon(item.catIcon);
                    const isHighest = i === 0;
                    return (
                      <tr key={item.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium">
                          <div className="flex items-center gap-2">
                            {isHighest && (
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" aria-label="Maior gasto fixo" />
                            )}
                            <span className="truncate max-w-[160px]">{item.description}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <div className="flex items-center gap-1.5">
                            <Icon className="w-3.5 h-3.5" style={{ color: item.catColor }} />
                            <span className="text-muted-foreground text-xs">{item.catName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-medium">
                          {mv(item.equiv)}
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground hidden md:table-cell">
                          {item.pct.toFixed(1)}%
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Badge variant="secondary">{item.timesPaid}×</Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isHighest && (
                            <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0 text-xs">
                              Maior fixo
                            </Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Opportunities callout */}
      {itemDetail.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                  Oportunidades de redução
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  Seus gastos recorrentes representam{' '}
                  <strong>{shareOfTotal.toFixed(1)}%</strong> das despesas totais do período.{' '}
                  {topItem && (
                    <>
                      O maior gasto fixo individual é <strong>{topItem.description}</strong>{' '}
                      ({mv(topItem.equiv)}/mês).{' '}
                    </>
                  )}
                  {itemDetail.filter(i => i.timesPaid === 0).length > 0 && (
                    <>
                      {itemDetail.filter(i => i.timesPaid === 0).length} recorrência(s) nunca foram pagas —
                      verifique se ainda são necessárias.
                    </>
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
