import React, { useMemo, useState } from 'react';
import { useFinance } from '@/context/FinanceContext';
import { formatCurrency } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';

export const Reports = () => {
  const { transactions, categories, subcategories } = useFinance();
  const [filterCategoryId, setFilterCategoryId] = useState<string>('all');
  const [groupBy, setGroupBy] = useState<'category' | 'subcategory'>('category');

  // Expense categories that have subcategories
  const expenseCategories = categories.filter(c => c.type === 'expense');
  const selectedCategoryHasSubs = filterCategoryId !== 'all'
    ? subcategories.some(s => s.categoryId === filterCategoryId)
    : false;

  const {
    monthlyData,
    expensesByGroup,
    balanceOverTime
  } = useMemo(() => {
    // Process transactions (paid only)
    const paidTxs = transactions.filter(t => t.status === 'paid');

    // Group by month
    const monthlyMap: Record<string, { income: number, expense: number, name: string }> = {};

    paidTxs.forEach(t => {
      const d = new Date(t.date);
      const monthYear = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const monthName = d.toLocaleString('pt-BR', { month: 'short', year: '2-digit' });

      if (!monthlyMap[monthYear]) {
        monthlyMap[monthYear] = { income: 0, expense: 0, name: monthName };
      }

      if (t.type === 'income') {
        monthlyMap[monthYear].income += t.amount;
      } else {
        monthlyMap[monthYear].expense += t.amount;
      }
    });

    const sortedMonths = Object.keys(monthlyMap).sort();
    const monthlyData = sortedMonths.map(key => ({
      name: monthlyMap[key].name,
      Receitas: monthlyMap[key].income,
      Despesas: monthlyMap[key].expense
    }));

    // Balance over time (accumulative)
    let cumulative = 0;
    const balanceOverTime = sortedMonths.map(key => {
      cumulative += (monthlyMap[key].income - monthlyMap[key].expense);
      return {
        name: monthlyMap[key].name,
        Saldo: cumulative
      };
    });

    // Expenses for pie chart — current month, optionally filtered by category
    const now = new Date();
    let currentMonthTxs = paidTxs.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && t.type === 'expense';
    });

    if (filterCategoryId !== 'all') {
      currentMonthTxs = currentMonthTxs.filter(t => t.categoryId === filterCategoryId);
    }

    // Group by category or subcategory
    let expensesByGroup: { name: string; value: number; color: string }[] = [];

    if (groupBy === 'subcategory' && filterCategoryId !== 'all') {
      // Group by subcategory within a selected category
      const subMap = new Map(subcategories.filter(s => s.categoryId === filterCategoryId).map(s => [s.id, s]));
      const subTotals: Record<string, number> = {};
      let ungrouped = 0;

      currentMonthTxs.forEach(t => {
        if (t.subcategoryId && subMap.has(t.subcategoryId)) {
          subTotals[t.subcategoryId] = (subTotals[t.subcategoryId] || 0) + t.amount;
        } else {
          ungrouped += t.amount;
        }
      });

      const cat = categories.find(c => c.id === filterCategoryId);
      const catColor = cat?.color ?? '#64748b';

      const PALETTE = [catColor, '#6366f1', '#f97316', '#22c55e', '#ec4899', '#0ea5e9', '#a855f7', '#eab308'];

      expensesByGroup = [
        ...Object.entries(subTotals).map(([subId, amount], i) => ({
          name: subMap.get(subId)?.name ?? 'Subcategoria',
          value: amount,
          color: PALETTE[i % PALETTE.length],
        })),
        ...(ungrouped > 0 ? [{ name: 'Sem subcategoria', value: ungrouped, color: '#94a3b8' }] : []),
      ].sort((a, b) => b.value - a.value);
    } else {
      // Group by category
      const categoryTotals: Record<string, number> = {};
      currentMonthTxs.forEach(t => {
        categoryTotals[t.categoryId] = (categoryTotals[t.categoryId] || 0) + t.amount;
      });

      expensesByGroup = Object.entries(categoryTotals)
        .map(([id, amount]) => {
          const cat = categories.find(c => c.id === id);
          return {
            name: cat?.name || 'Desconhecida',
            value: amount,
            color: cat?.color || '#cbd5e1'
          };
        })
        .sort((a, b) => b.value - a.value);
    }

    return { monthlyData, expensesByGroup, balanceOverTime };
  }, [transactions, categories, subcategories, filterCategoryId, groupBy]);

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border p-3 rounded-lg shadow-lg">
          <p className="font-medium mb-2">{label}</p>
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-muted-foreground">{entry.name}:</span>
              <span className="font-medium">{formatCurrency(entry.value)}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Relatórios</h1>
        <p className="text-muted-foreground">Análise detalhada da sua saúde financeira.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="hover-elevate transition-all">
          <CardHeader>
            <CardTitle>Receitas vs Despesas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickMargin={10} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(val) => `R$${val/1000}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  <Bar dataKey="Receitas" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="Despesas" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="hover-elevate transition-all">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle className="text-base">
                Despesas por {groupBy === 'subcategory' ? 'Subcategoria' : 'Categoria'} (Este mês)
              </CardTitle>
              <div className="flex gap-2 flex-wrap">
                <Select value={filterCategoryId} onValueChange={(v) => { setFilterCategoryId(v); if (v === 'all') setGroupBy('category'); }}>
                  <SelectTrigger className="h-8 text-xs w-40">
                    <SelectValue placeholder="Filtrar categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as categorias</SelectItem>
                    {expenseCategories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedCategoryHasSubs && (
                  <Select value={groupBy} onValueChange={(v) => setGroupBy(v as 'category' | 'subcategory')}>
                    <SelectTrigger className="h-8 text-xs w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="category">Por categoria</SelectItem>
                      <SelectItem value="subcategory">Por subcategoria</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {expensesByGroup.length > 0 ? (
              <div className="h-[300px] w-full mt-4 flex items-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={expensesByGroup}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {expensesByGroup.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                      layout="vertical"
                      verticalAlign="middle"
                      align="right"
                      iconType="circle"
                      wrapperStyle={{ fontSize: '12px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Nenhum dado disponível.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 hover-elevate transition-all">
          <CardHeader>
            <CardTitle>Evolução do Saldo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={balanceOverTime} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <defs>
                    <linearGradient id="colorSaldo" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickMargin={10} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(val) => `R$${val/1000}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="Saldo" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorSaldo)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
