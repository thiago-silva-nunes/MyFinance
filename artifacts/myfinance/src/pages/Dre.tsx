import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useFinance } from '@/context/FinanceContext';
import { dataService } from '@/services/dataService';
import { usePrivacy } from '@/context/PrivacyContext';
import { formatCurrency } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip as RechartsTooltip, LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ChevronDown, ChevronRight, TrendingUp, TrendingDown, Minus, HelpCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// ─── Helpers ────────────────────────────────────────────────────────────────

function pad(n: number) { return String(n).padStart(2, '0'); }
function lastDay(y: number, m: number) { return new Date(y, m, 0).getDate(); }

type Period = 'current_month' | 'prev_month' | 'quarter' | 'year' | 'custom';

function getPeriodRange(period: Period, customStart?: string, customEnd?: string): { start: string; end: string } {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth() + 1;
  switch (period) {
    case 'current_month': return { start: `${y}-${pad(m)}-01`, end: `${y}-${pad(m)}-${lastDay(y, m)}` };
    case 'prev_month': {
      const pm = m === 1 ? 12 : m - 1, py = m === 1 ? y - 1 : y;
      return { start: `${py}-${pad(pm)}-01`, end: `${py}-${pad(pm)}-${lastDay(py, pm)}` };
    }
    case 'quarter': {
      const qStart = Math.floor((m - 1) / 3) * 3 + 1;
      return { start: `${y}-${pad(qStart)}-01`, end: `${y}-${pad(m)}-${lastDay(y, m)}` };
    }
    case 'year': return { start: `${y}-01-01`, end: `${y}-12-31` };
    case 'custom': return { start: customStart ?? `${y}-${pad(m)}-01`, end: customEnd ?? `${y}-${pad(m)}-${lastDay(y, m)}` };
  }
}

function getPreviousPeriodRange(period: Period, current: { start: string; end: string }): { start: string; end: string } {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth() + 1;
  switch (period) {
    case 'current_month': return getPeriodRange('prev_month');
    case 'prev_month': {
      const pm = m <= 2 ? 12 + m - 2 : m - 2, py = m <= 2 ? y - 1 : y;
      return { start: `${py}-${pad(pm)}-01`, end: `${py}-${pad(pm)}-${lastDay(py, pm)}` };
    }
    case 'quarter': {
      const qStart = Math.floor((m - 1) / 3) * 3 + 1;
      const prevQStart = qStart <= 3 ? qStart + 9 : qStart - 3;
      const prevQEnd = prevQStart + 2;
      const prevY = qStart <= 3 ? y - 1 : y;
      return { start: `${prevY}-${pad(prevQStart)}-01`, end: `${prevY}-${pad(prevQEnd)}-${lastDay(prevY, prevQEnd)}` };
    }
    case 'year': return { start: `${y - 1}-01-01`, end: `${y - 1}-12-31` };
    case 'custom': {
      const ms = new Date(current.start), me = new Date(current.end);
      const dur = me.getTime() - ms.getTime();
      const ps = new Date(ms.getTime() - dur - 86400000);
      const pe = new Date(ms.getTime() - 86400000);
      return { start: ps.toISOString().split('T')[0], end: pe.toISOString().split('T')[0] };
    }
  }
}

// ─── InfoTooltip ─────────────────────────────────────────────────────────────

const InfoTooltip = ({ text }: { text: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center justify-center w-5 h-5 rounded-full text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
            onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }}
            aria-label="Mais informações"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-[260px] text-xs leading-relaxed">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const DRE_TOOLTIPS: Record<string, string> = {
  receita:            'Soma de todas as entradas (receitas) no período, antes de qualquer dedução.',
  deducao:            'Valores que reduzem a receita bruta, como impostos sobre receita, devoluções e cancelamentos.',
  despesa_fixa:       'Gastos recorrentes e previsíveis que não variam com o volume do mês, como aluguel, assinaturas e salários fixos.',
  despesa_variavel:   'Gastos que oscilam conforme o consumo do mês, como alimentação, lazer e compras.',
  despesa_financeira: 'Custos relacionados a juros, tarifas bancárias, encargos de cartão de crédito e empréstimos.',
  receita_liquida:    'Receita Bruta menos Deduções. O que sobra após descontar impostos e devoluções sobre a receita.',
  resultado_liquido:  'Receita Líquida menos todas as despesas (fixas + variáveis + financeiras). O "lucro" ou sobra do período.',
  margem_liquida:     'Percentual do Resultado Líquido em relação à Receita Bruta. Indica quanto de cada real recebido fica como resultado.',
};

const DRE_STRUCTURE = [
  { id: 'receita',            label: 'Receita Bruta',        operator: '+' as const },
  { id: 'deducao',            label: 'Deduções',             operator: '-' as const },
  { id: 'despesa_fixa',       label: 'Despesas Fixas',       operator: '-' as const },
  { id: 'despesa_variavel',   label: 'Despesas Variáveis',   operator: '-' as const },
  { id: 'despesa_financeira', label: 'Despesas Financeiras', operator: '-' as const },
];

interface DRETx { id: string; description: string; amount: number; date: string; }
interface DRESub { subcategoryId: string; name: string; total: number; transactions: DRETx[]; }
interface DRECat {
  categoryId: string;
  name: string;
  color: string;
  total: number;
  subcategories: DRESub[];
  ungroupedTransactions: DRETx[];
}
interface DREGroup { id: string; label: string; operator: '+' | '-'; total: number; categories: DRECat[]; }

type SubcategoryList = ReturnType<typeof useFinance>['subcategories'];

type DREBuckets = Record<string, Record<string, Record<string, DRETx[]>>>;

const UNGROUPED_KEY = '__none__';

function buildDRE(
  transactions: ReturnType<typeof useFinance>['transactions'],
  categories: ReturnType<typeof useFinance>['categories'],
  subcategories: SubcategoryList,
  start: string,
  end: string
): DREGroup[] {
  // Exclude balance-adjustment transactions from DRE — they affect bank balance only, not P&L.
  const inRange = transactions.filter(tx => tx.date >= start && tx.date <= end && !tx.isBalanceAdjustment);
  const catMap = new Map(categories.map(c => [c.id, c]));
  const subMap = new Map(subcategories.map(s => [s.id, s]));

  const grouped: DREBuckets = {};

  for (const tx of inRange) {
    const cat = catMap.get(tx.categoryId);
    if (!cat) continue;
    // 3-level DRE hierarchy: transaction override → subcategory dreGroup → category dreGroup
    const sub = tx.subcategoryId ? subMap.get(tx.subcategoryId) : undefined;
    const groupId = tx.dreGroupOverride ?? sub?.dreGroup ?? cat.dreGroup ?? (cat.type === 'income' ? 'receita' : 'despesa_variavel');

    if (!grouped[groupId]) grouped[groupId] = {};
    if (!grouped[groupId][cat.id]) grouped[groupId][cat.id] = {};

    const subKey = tx.subcategoryId ?? UNGROUPED_KEY;
    if (!grouped[groupId][cat.id][subKey]) grouped[groupId][cat.id][subKey] = [];
    grouped[groupId][cat.id][subKey].push({
      id: tx.id, description: tx.description, amount: tx.amount, date: tx.date
    });
  }

  return DRE_STRUCTURE.map(g => {
    const catEntries = grouped[g.id] ?? {};

    const cats: DRECat[] = Object.entries(catEntries).map(([catId, subBuckets]) => {
      const cat = catMap.get(catId);

      const subs: DRESub[] = Object.entries(subBuckets)
        .filter(([subId]) => subId !== UNGROUPED_KEY)
        .map(([subId, txs]) => {
          const sub = subMap.get(subId);
          return {
            subcategoryId: subId,
            name: sub?.name ?? 'Subcategoria',
            total: txs.reduce((s, t) => s + t.amount, 0),
            transactions: txs.slice().sort((a, b) => b.date.localeCompare(a.date)),
          };
        })
        .sort((a, b) => b.total - a.total);

      const ungrouped: DRETx[] = (subBuckets[UNGROUPED_KEY] ?? [])
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date));

      const total =
        subs.reduce((s, sub) => s + sub.total, 0) +
        ungrouped.reduce((s, t) => s + t.amount, 0);

      return {
        categoryId: catId,
        name: cat?.name ?? 'Desconhecida',
        color: cat?.color ?? '#64748b',
        total,
        subcategories: subs,
        ungroupedTransactions: ungrouped,
      };
    }).sort((a, b) => b.total - a.total);

    return { ...g, total: cats.reduce((s, c) => s + c.total, 0), categories: cats };
  });
}

function Delta({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) return null;
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  const up = pct >= 0;
  return (
    <span className={cn('text-xs flex items-center gap-0.5', up ? 'text-success' : 'text-destructive')}>
      {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: 'current_month', label: 'Mês atual' },
  { value: 'prev_month',    label: 'Mês anterior' },
  { value: 'quarter',       label: 'Trimestre' },
  { value: 'year',          label: 'Ano' },
  { value: 'custom',        label: 'Personalizado' },
];

export const Dre = () => {
  const { categories, subcategories, loading: ctxLoading } = useFinance();
  // Full transaction history — not limited to 12 months, for year/custom/12-month-chart views
  const { data: transactions = [], isPending: txPending } = useQuery({
    queryKey: ['transactions', 'all'],
    queryFn: dataService.getAllTransactionsForReports,
    staleTime: 60_000,
  });
  const loading = ctxLoading || txPending;
  const { hideValues } = usePrivacy();
  const mask = (n: number) => hideValues ? 'R$ ••••••' : formatCurrency(n);

  const [period, setPeriod] = useState<Period>('current_month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['receita', 'despesa_variavel']));
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [expandedSubs, setExpandedSubs] = useState<Set<string>>(new Set());

  const currentRange = getPeriodRange(period, customStart, customEnd);
  const prevRange = getPreviousPeriodRange(period, currentRange);

  const currentDRE = useMemo(() => buildDRE(transactions, categories, subcategories, currentRange.start, currentRange.end), [transactions, categories, subcategories, currentRange.start, currentRange.end]);
  const prevDRE    = useMemo(() => buildDRE(transactions, categories, subcategories, prevRange.start, prevRange.end), [transactions, categories, subcategories, prevRange.start, prevRange.end]);

  const prevTotals = useMemo(() => Object.fromEntries(prevDRE.map(g => [g.id, g.total])), [prevDRE]);

  const receitaBruta      = currentDRE.find(g => g.id === 'receita')?.total ?? 0;
  const deducoes          = currentDRE.find(g => g.id === 'deducao')?.total ?? 0;
  const receitaLiquida    = receitaBruta - deducoes;
  const despesasFixas     = currentDRE.find(g => g.id === 'despesa_fixa')?.total ?? 0;
  const despesasVariaveis = currentDRE.find(g => g.id === 'despesa_variavel')?.total ?? 0;
  const despesasFinanc    = currentDRE.find(g => g.id === 'despesa_financeira')?.total ?? 0;
  const despesasTotais    = despesasFixas + despesasVariaveis + despesasFinanc + deducoes;
  const resultadoLiquido  = receitaLiquida - (despesasFixas + despesasVariaveis + despesasFinanc);
  const margemLiquida     = receitaBruta > 0 ? (resultadoLiquido / receitaBruta) * 100 : 0;

  const prevReceitaBruta   = prevDRE.find(g => g.id === 'receita')?.total ?? 0;
  const prevDeducoes       = prevDRE.find(g => g.id === 'deducao')?.total ?? 0;
  const prevReceitaLiquida = prevReceitaBruta - prevDeducoes;
  const prevResultado      = prevReceitaLiquida - (prevDRE.find(g => g.id === 'despesa_fixa')?.total ?? 0) - (prevDRE.find(g => g.id === 'despesa_variavel')?.total ?? 0) - (prevDRE.find(g => g.id === 'despesa_financeira')?.total ?? 0);

  const chartData = useMemo(() => {
    const now = new Date();
    const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
      const y = d.getFullYear(), m = d.getMonth() + 1;
      const start = `${y}-${pad(m)}-01`, end = `${y}-${pad(m)}-${lastDay(y, m)}`;
      const monthly = buildDRE(transactions, categories, subcategories, start, end);
      const rec = monthly.find(g => g.id === 'receita')?.total ?? 0;
      const ded = monthly.find(g => g.id === 'deducao')?.total ?? 0;
      const exp = (monthly.find(g => g.id === 'despesa_fixa')?.total ?? 0) + (monthly.find(g => g.id === 'despesa_variavel')?.total ?? 0) + (monthly.find(g => g.id === 'despesa_financeira')?.total ?? 0);
      return { month: MONTHS[d.getMonth()], value: (rec - ded) - exp };
    });
  }, [transactions, categories, subcategories]);

  const toggleGroup = (id: string) => setExpandedGroups(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleCat   = (id: string) => setExpandedCats(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleSub   = (id: string) => setExpandedSubs(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  if (loading) return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div className="flex justify-between items-center gap-4">
        <div className="space-y-2"><Skeleton className="h-9 w-16" /><Skeleton className="h-4 w-56" /></div>
        <Skeleton className="h-9 w-44" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[0,1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
      <Skeleton className="h-[480px] rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">DRE</h1>
          <p className="text-muted-foreground">Demonstrativo de Resultado do Exercício</p>
        </div>

        {/* Period selector */}
        <div className="flex flex-wrap items-center gap-2">
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          {period === 'custom' && (
            <>
              <DatePicker value={customStart} onChange={setCustomStart} className="w-44" />
              <span className="text-muted-foreground text-sm">até</span>
              <DatePicker value={customEnd} onChange={setCustomEnd} className="w-44" />
            </>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Receita Líquida', value: receitaLiquida, prev: prevReceitaLiquida, color: 'text-success' },
          { label: 'Despesas Totais', value: despesasTotais, prev: (prevDRE.find(g=>g.id==='despesa_fixa')?.total??0)+(prevDRE.find(g=>g.id==='despesa_variavel')?.total??0)+(prevDRE.find(g=>g.id==='despesa_financeira')?.total??0)+(prevDRE.find(g=>g.id==='deducao')?.total??0), color: 'text-destructive' },
          { label: 'Resultado Líquido', value: resultadoLiquido, prev: prevResultado, color: resultadoLiquido >= 0 ? 'text-success' : 'text-destructive' },
          { label: 'Margem Líquida', value: margemLiquida, prev: 0, color: margemLiquida >= 0 ? 'text-success' : 'text-destructive', isPct: true },
        ].map(({ label, value, prev, color, isPct }) => (
          <Card key={label}>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className={cn('text-xl font-bold mt-1', color)}>
                {isPct
                  ? (hideValues ? '••••' : `${value.toFixed(1)}%`)
                  : mask(value)}
              </p>
              {!isPct && <Delta current={value} previous={prev} />}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* DRE Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Estrutura do DRE</CardTitle>
          <CardDescription>{currentRange.start} → {currentRange.end}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {currentDRE.map(group => {
              const isExpanded = expandedGroups.has(group.id);
              const prevTotal = prevTotals[group.id] ?? 0;

              return (
                <React.Fragment key={group.id}>
                  {/* Group row */}
                  <button
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors text-left"
                    onClick={() => toggleGroup(group.id)}
                  >
                    <div className="flex items-center gap-2">
                      {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                      <span className="font-semibold text-sm">
                        <span className="text-muted-foreground mr-1.5">({group.operator})</span>
                        {group.label}
                      </span>
                      {DRE_TOOLTIPS[group.id] && <InfoTooltip text={DRE_TOOLTIPS[group.id]} />}
                    </div>
                    <div className="flex items-center gap-3">
                      <Delta current={group.total} previous={prevTotal} />
                      <span className="font-bold text-sm w-28 text-right">{mask(group.total)}</span>
                    </div>
                  </button>

                  {/* Categories */}
                  {isExpanded && group.categories.map(cat => {
                    const catKey = `${group.id}:${cat.categoryId}`;
                    const isCatExpanded = expandedCats.has(catKey);
                    const hasSubs = cat.subcategories.length > 0;

                    return (
                      <React.Fragment key={cat.categoryId}>
                        {/* Category row */}
                        <button
                          className="w-full flex items-center justify-between px-4 py-2.5 pl-10 hover:bg-muted/20 transition-colors text-left bg-muted/10"
                          onClick={() => toggleCat(catKey)}
                        >
                          <div className="flex items-center gap-2">
                            {isCatExpanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                            <span className="text-sm">{cat.name}</span>
                            {hasSubs && (
                              <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{cat.subcategories.length} sub</Badge>
                            )}
                          </div>
                          <span className="text-sm font-medium w-28 text-right">{mask(cat.total)}</span>
                        </button>

                        {isCatExpanded && (
                          <>
                            {/* Subcategory rows */}
                            {cat.subcategories.map(sub => {
                              const subKey = `${catKey}:${sub.subcategoryId}`;
                              const isSubExpanded = expandedSubs.has(subKey);
                              return (
                                <React.Fragment key={sub.subcategoryId}>
                                  <button
                                    className="w-full flex items-center justify-between px-4 py-2 pl-16 hover:bg-muted/15 transition-colors text-left bg-muted/5"
                                    onClick={() => toggleSub(subKey)}
                                  >
                                    <div className="flex items-center gap-2">
                                      {isSubExpanded ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
                                      <span className="text-xs text-muted-foreground">↳</span>
                                      <span className="text-sm text-muted-foreground">{sub.name}</span>
                                    </div>
                                    <span className="text-sm font-medium text-muted-foreground w-28 text-right">{mask(sub.total)}</span>
                                  </button>

                                  {isSubExpanded && sub.transactions.map(tx => (
                                    <div key={tx.id} className="flex items-center justify-between px-4 py-1.5 pl-[72px] bg-muted/5 text-sm border-l-2 border-muted ml-16">
                                      <div className="flex-1 min-w-0">
                                        <span className="text-muted-foreground truncate text-xs">{tx.description}</span>
                                        <span className="text-xs text-muted-foreground/60 ml-2">{tx.date}</span>
                                      </div>
                                      <span className="text-muted-foreground w-28 text-right text-xs">{mask(tx.amount)}</span>
                                    </div>
                                  ))}
                                </React.Fragment>
                              );
                            })}

                            {/* Ungrouped transactions */}
                            {cat.ungroupedTransactions.map(tx => (
                              <div key={tx.id} className="flex items-center justify-between px-4 py-2 pl-16 bg-muted/5 text-sm">
                                <div className="flex-1 min-w-0">
                                  <span className="text-muted-foreground truncate">{tx.description}</span>
                                  <span className="text-xs text-muted-foreground/60 ml-2">{tx.date}</span>
                                </div>
                                <span className="text-muted-foreground w-28 text-right">{mask(tx.amount)}</span>
                              </div>
                            ))}
                          </>
                        )}
                      </React.Fragment>
                    );
                  })}

                  {/* Computed subtotals after key groups */}
                  {group.id === 'deducao' && (
                    <div className="flex items-center justify-between px-4 py-3 bg-primary/5 font-semibold text-sm border-y">
                      <span className="flex items-center gap-1.5"><Minus className="w-4 h-4" /> (=) Receita Líquida <InfoTooltip text={DRE_TOOLTIPS.receita_liquida} /></span>
                      <div className="flex items-center gap-3">
                        <Delta current={receitaLiquida} previous={prevReceitaLiquida} />
                        <span className={cn('w-28 text-right', receitaLiquida >= 0 ? 'text-success' : 'text-destructive')}>{mask(receitaLiquida)}</span>
                      </div>
                    </div>
                  )}
                </React.Fragment>
              );
            })}

            {/* Resultado Líquido */}
            <div className={cn('flex items-center justify-between px-4 py-4 font-bold text-base border-t-2',
              resultadoLiquido >= 0 ? 'bg-success/5 border-success/30' : 'bg-destructive/5 border-destructive/30')}>
              <span className="flex items-center gap-2">
                {resultadoLiquido >= 0
                  ? <TrendingUp className="w-5 h-5 text-success" />
                  : <TrendingDown className="w-5 h-5 text-destructive" />}
                (=) Resultado Líquido
                <InfoTooltip text={DRE_TOOLTIPS.resultado_liquido} />
              </span>
              <div className="flex items-center gap-3">
                <Delta current={resultadoLiquido} previous={prevResultado} />
                <span className={cn('w-28 text-right', resultadoLiquido >= 0 ? 'text-success' : 'text-destructive')}>
                  {mask(resultadoLiquido)}
                </span>
              </div>
            </div>

            {/* Margem líquida */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-muted/20 text-sm">
              <span className="text-muted-foreground flex items-center gap-1.5">Margem Líquida <InfoTooltip text={DRE_TOOLTIPS.margem_liquida} /></span>
              <span className={cn('font-semibold', margemLiquida >= 0 ? 'text-success' : 'text-destructive')}>
                {hideValues ? '••••' : `${margemLiquida.toFixed(1)}%`}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 12-month chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resultado Líquido — últimos 12 meses</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" />
                <XAxis dataKey="month" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                <YAxis
                  tickFormatter={(v) => hideValues ? '••••' : `R$${(v/1000).toFixed(0)}k`}
                  fontSize={11}
                  stroke="hsl(var(--muted-foreground))"
                />
                <RechartsTooltip
                  formatter={(v: number) => [hideValues ? 'R$ ••••••' : formatCurrency(v), 'Resultado']}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                  itemStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2}
                  dot={{ r: 4, fill: 'hsl(var(--primary))' }}
                  activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
