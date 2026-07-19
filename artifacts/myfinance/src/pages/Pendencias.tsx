import React, { useMemo, useState } from 'react';
import { useFinance } from '@/context/FinanceContext';
import { usePrivacy } from '@/context/PrivacyContext';
import { computeBankBalanceAtDate } from '@/lib/balanceUtils';
import { formatCurrency, formatShortDate } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  AlertCircle, TrendingDown, TrendingUp, Wallet,
  CheckCircle2, CreditCard, CalendarClock, ArrowDownCircle,
} from 'lucide-react';
import { ConfirmPaymentDialog } from '@/components/ConfirmPaymentDialog';
import { Transaction, Invoice, CreditCard as CreditCardType } from '@/data/mockData';
import { toast } from 'sonner';

// ─── helpers ─────────────────────────────────────────────────────────────────

function getTodayStr() {
  return new Date().toISOString().split('T')[0];
}

function getCurrentMonthPrefix(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const Pendencias = () => {
  const {
    transactions, invoices, cards, categories,
    banks, transfers, balanceSnapshots,
    updateTransaction, payInvoice,
  } = useFinance();
  const { hideValues } = usePrivacy();

  const [receiveFilter, setReceiveFilter] = useState<'month' | 'all'>('month');
  const [dueFilter, setDueFilter] = useState<'month' | 'all'>('month');
  const [confirmTarget, setConfirmTarget] = useState<Transaction | null>(null);

  const mask = (v: number) => hideValues ? 'R$ ••••••' : formatCurrency(v);

  const today = getTodayStr();
  const monthPrefix = getCurrentMonthPrefix();
  // Last calendar day of the current month as YYYY-MM-DD
  const endOfMonth = (() => {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return `${monthPrefix}-${String(lastDay).padStart(2, '0')}`;
  })();

  // ── Derived lists ──────────────────────────────────────────────────────────

  const {
    overdueExpenses, dueSoon, openInvoices, pendingIncome,
    totalEmAberto, projectionExpensesSum, projectionIncomeSum, projectionInvoicesSum,
    totalToReceive,
  } = useMemo(() => {
    // All pending expense transactions, date < today → overdue
    const overdue = transactions.filter(
      t => t.type === 'expense' && t.status === 'pending' && t.date < today,
    ).sort((a, b) => a.date.localeCompare(b.date)); // oldest first

    // All upcoming pending expenses from today onward (no upper bound)
    const soon = transactions.filter(
      t => t.type === 'expense' && t.status === 'pending' && t.date >= today,
    ).sort((a, b) => a.date.localeCompare(b.date));

    // Invoices with status 'closed' or 'overdue' (not paid)
    const invOpen = invoices.filter(
      inv => inv.status === 'closed' || inv.status === 'overdue',
    ).sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    // Pending income (all, for display)
    const income = transactions.filter(
      t => t.type === 'income' && t.status === 'pending',
    ).sort((a, b) => a.date.localeCompare(b.date));

    // ── Projection components (bounded to end of current month) ──────────────

    // All pending expenses with date <= end-of-month (overdue + upcoming)
    const monthExpenseSum = transactions
      .filter(t => t.type === 'expense' && t.status === 'pending' && t.date <= endOfMonth)
      .reduce((s, t) => s + t.amount, 0);

    // Open invoices with dueDate <= end-of-month
    const monthInvoiceSum = invOpen
      .filter(inv => inv.dueDate <= endOfMonth)
      .reduce((s, inv) => s + inv.totalAmount, 0);

    // Pending income with date <= end-of-month
    const monthIncomeSum = income
      .filter(t => t.date <= endOfMonth)
      .reduce((s, t) => s + t.amount, 0);

    const sumIncome = income.reduce((s, t) => s + t.amount, 0);

    return {
      overdueExpenses: overdue,
      dueSoon: soon,
      openInvoices: invOpen,
      pendingIncome: income,
      // Unified: "Total em aberto" = all pending within month (matches projection)
      totalEmAberto: monthExpenseSum + monthInvoiceSum,
      projectionExpensesSum: monthExpenseSum,
      projectionIncomeSum: monthIncomeSum,
      projectionInvoicesSum: monthInvoiceSum,
      totalToReceive: sumIncome,
    };
  }, [transactions, invoices, today, endOfMonth]);

  // Filtered income for the toggle (display only)
  const filteredIncome = useMemo(() => {
    if (receiveFilter === 'month') {
      return pendingIncome.filter(t => t.date.startsWith(monthPrefix));
    }
    return pendingIncome;
  }, [pendingIncome, receiveFilter, monthPrefix]);

  const filteredToReceive = filteredIncome.reduce((s, t) => s + t.amount, 0);

  // Filtered upcoming expenses for the toggle ("Este mês" vs "Todos")
  const filteredDueSoon = useMemo(() => {
    if (dueFilter === 'month') return dueSoon.filter(t => t.date <= endOfMonth);
    return dueSoon;
  }, [dueSoon, dueFilter, endOfMonth]);

  // Real current balance = only paid transactions, bounded to today
  // (pending transactions are not yet in the bank — they're projected separately)
  const realBankBalance = useMemo(() => {
    const paidTxs = transactions.filter(t => t.status === 'paid');
    return banks.reduce((sum, bank) => {
      return sum + computeBankBalanceAtDate(bank.id, bank, paidTxs, transfers, balanceSnapshots, today);
    }, 0);
  }, [banks, transactions, transfers, balanceSnapshots, today]);

  // Projection = real paid balance + expected income this month − expected expenses this month
  const projection = realBankBalance + projectionIncomeSum - (projectionExpensesSum + projectionInvoicesSum);
  const totalOpenCount = overdueExpenses.length + openInvoices.length;

  // ── Helpers ────────────────────────────────────────────────────────────────

  const getCategoryName = (categoryId: string) =>
    categories.find(c => c.id === categoryId)?.name ?? '—';

  const getCard = (cardId: string): CreditCardType | undefined =>
    cards.find(c => c.id === cardId);

  const handleMarkPaid = (tx: Transaction) => setConfirmTarget(tx);

  const handlePayInvoice = async (inv: Invoice) => {
    const card = getCard(inv.cardId);
    if (!card) { toast.error('Cartão não encontrado'); return; }
    try {
      await payInvoice(inv, card);
      toast.success('Fatura marcada como paga!');
    } catch (e) {
      toast.error('Erro ao pagar fatura');
    }
  };

  const invoiceStatusLabel = (status: Invoice['status']) => {
    if (status === 'overdue') return { label: 'Vencida', cls: 'bg-destructive/10 text-destructive border-destructive/30' };
    return { label: 'Fechada', cls: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-300' };
  };

  return (
    <div className="space-y-6 pb-20 md:pb-0">

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Pendências</h1>
        <p className="text-muted-foreground">Mapa geral do que está em aberto ou vencido.</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Total a pagar */}
        <Card className={cn('border-l-4', totalOpenCount > 0 ? 'border-l-destructive/60' : 'border-l-muted')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total a pagar no mês</CardTitle>
            <div className="bg-destructive/10 p-2 rounded-full">
              <TrendingDown className="w-4 h-4 text-destructive" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {mask(totalEmAberto)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {overdueExpenses.length > 0 && (
                <span className="text-destructive font-medium">{overdueExpenses.length} vencida{overdueExpenses.length !== 1 ? 's' : ''}</span>
              )}
              {overdueExpenses.length > 0 && (filteredDueSoon.length > 0 || openInvoices.length > 0) && ' · '}
              {filteredDueSoon.length > 0 && `${filteredDueSoon.length} a vencer`}
              {filteredDueSoon.length > 0 && openInvoices.length > 0 && ' · '}
              {openInvoices.length > 0 && `${openInvoices.length} fatura${openInvoices.length !== 1 ? 's' : ''}`}
              {overdueExpenses.length === 0 && filteredDueSoon.length === 0 && openInvoices.length === 0 && 'Nenhuma pendência este mês'}
            </p>
          </CardContent>
        </Card>

        {/* A receber */}
        <Card className="border-l-4 border-l-success/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">A receber</CardTitle>
            <div className="bg-success/10 p-2 rounded-full">
              <TrendingUp className="w-4 h-4 text-success" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{mask(filteredToReceive)}</div>
            <div className="flex items-center gap-2 mt-2">
              <Switch
                id="receive-toggle"
                checked={receiveFilter === 'month'}
                onCheckedChange={v => setReceiveFilter(v ? 'month' : 'all')}
                className="scale-75"
              />
              <Label htmlFor="receive-toggle" className="text-xs text-muted-foreground cursor-pointer">
                {receiveFilter === 'month' ? 'Só este mês' : 'Tudo em aberto'}
              </Label>
            </div>
          </CardContent>
        </Card>

        {/* Projeção de saldo */}
        <Card className={cn('border-l-4', projection >= 0 ? 'border-l-primary/50' : 'border-l-destructive/60')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Projeção ao fim do mês</CardTitle>
            <div className={cn('p-2 rounded-full', projection >= 0 ? 'bg-primary/10' : 'bg-destructive/10')}>
              <Wallet className={cn('w-4 h-4', projection >= 0 ? 'text-primary' : 'text-destructive')} />
            </div>
          </CardHeader>
          <CardContent>
            <div className={cn('text-2xl font-bold', projection >= 0 ? 'text-primary' : 'text-destructive')}>
              {mask(projection)}
            </div>
            {projection < 0 && (
              <div className="flex items-center gap-1.5 mt-2 text-xs text-destructive font-medium bg-destructive/10 rounded px-2 py-1">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                Atenção: você pode fechar o mês no negativo
              </div>
            )}
            {projection >= 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Saldo atual + a receber − pendências
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Contas atrasadas ─────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-destructive" />
          <h2 className="font-semibold text-lg">Contas atrasadas</h2>
          {overdueExpenses.length > 0 && (
            <Badge variant="destructive" className="ml-1">{overdueExpenses.length}</Badge>
          )}
        </div>

        {overdueExpenses.length === 0 ? (
          <div className="text-sm text-muted-foreground bg-muted/40 rounded-xl px-5 py-6 text-center">
            Nenhuma conta vencida. 🎉
          </div>
        ) : (
          <div className="bg-card border rounded-xl divide-y overflow-hidden shadow-sm">
            {overdueExpenses.map(tx => (
              <div key={tx.id} className="flex items-center justify-between px-4 py-3 gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{tx.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {getCategoryName(tx.categoryId)} · venceu {formatShortDate(tx.date)}
                    {tx.scheduledId && <span className="ml-1 italic">(recorrente)</span>}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="font-semibold text-sm text-destructive">{mask(tx.amount)}</span>
                  <Button
                    size="sm" variant="outline"
                    className="border-destructive/40 text-destructive hover:bg-destructive/10 whitespace-nowrap text-xs"
                    onClick={() => handleMarkPaid(tx)}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                    Marcar como paga
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── A vencer este mês ────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <CalendarClock className="w-5 h-5 text-amber-500" />
          <h2 className="font-semibold text-lg">A vencer este mês</h2>
          {filteredDueSoon.length > 0 && (
            <Badge className="ml-1 bg-amber-100 text-amber-700 border-amber-300">{filteredDueSoon.length}</Badge>
          )}
          <div className="ml-auto flex items-center gap-2">
            <Switch
              id="due-section-toggle"
              checked={dueFilter === 'month'}
              onCheckedChange={v => setDueFilter(v ? 'month' : 'all')}
              className="scale-75"
            />
            <Label htmlFor="due-section-toggle" className="text-xs text-muted-foreground cursor-pointer">
              {dueFilter === 'month' ? 'Só este mês' : 'Tudo em aberto'}
            </Label>
          </div>
        </div>

        {filteredDueSoon.length === 0 ? (
          <div className="text-sm text-muted-foreground bg-muted/40 rounded-xl px-5 py-6 text-center">
            Nada vencendo {dueFilter === 'month' ? 'este mês' : 'a partir de hoje'}.
          </div>
        ) : (
          <div className="bg-card border rounded-xl divide-y overflow-hidden shadow-sm">
            {filteredDueSoon.map(tx => (
              <div key={tx.id} className="flex items-center justify-between px-4 py-3 gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{tx.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {getCategoryName(tx.categoryId)} · vence {formatShortDate(tx.date)}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="font-semibold text-sm text-amber-600">{mask(tx.amount)}</span>
                  <Button
                    size="sm" variant="outline"
                    className="border-amber-400/60 text-amber-700 hover:bg-amber-50 whitespace-nowrap text-xs"
                    onClick={() => handleMarkPaid(tx)}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                    Marcar como paga
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── A receber ─────────────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <ArrowDownCircle className="w-5 h-5 text-success" />
          <h2 className="font-semibold text-lg">A receber</h2>
          {filteredIncome.length > 0 && (
            <Badge className="ml-1 bg-green-100 text-green-700 border-green-300">{filteredIncome.length}</Badge>
          )}
          <div className="ml-auto flex items-center gap-2">
            <Switch
              id="receive-section-toggle"
              checked={receiveFilter === 'month'}
              onCheckedChange={v => setReceiveFilter(v ? 'month' : 'all')}
              className="scale-75"
            />
            <Label htmlFor="receive-section-toggle" className="text-xs text-muted-foreground cursor-pointer">
              {receiveFilter === 'month' ? 'Só este mês' : 'Tudo em aberto'}
            </Label>
          </div>
        </div>

        {filteredIncome.length === 0 ? (
          <div className="text-sm text-muted-foreground bg-muted/40 rounded-xl px-5 py-6 text-center">
            Nenhuma receita pendente {receiveFilter === 'month' ? 'neste mês' : 'em aberto'}.
          </div>
        ) : (
          <div className="bg-card border rounded-xl divide-y overflow-hidden shadow-sm">
            {filteredIncome.map(tx => (
              <div key={tx.id} className="flex items-center justify-between px-4 py-3 gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{tx.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {getCategoryName(tx.categoryId)} · previsto {formatShortDate(tx.date)}
                  </p>
                </div>
                <span className="font-semibold text-sm text-success flex-shrink-0">{mask(tx.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Faturas de cartão em aberto ──────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-amber-600" />
          <h2 className="font-semibold text-lg">Faturas em aberto</h2>
          {openInvoices.length > 0 && (
            <Badge className="ml-1 bg-amber-100 text-amber-700 border-amber-300">{openInvoices.length}</Badge>
          )}
        </div>

        {openInvoices.length === 0 ? (
          <div className="text-sm text-muted-foreground bg-muted/40 rounded-xl px-5 py-6 text-center">
            Nenhuma fatura em aberto.
          </div>
        ) : (
          <div className="bg-card border rounded-xl divide-y overflow-hidden shadow-sm">
            {openInvoices.map(inv => {
              const card = getCard(inv.cardId);
              if (!card) return null;
              const { label, cls } = invoiceStatusLabel(inv.status);
              return (
                <div key={inv.id} className="flex items-center justify-between px-4 py-3 gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm">{card.name}</p>
                      <Badge variant="outline" className={cn('text-xs', cls)}>{label}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Ref. {inv.referenceMonth} · vence {formatShortDate(inv.dueDate)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="font-semibold text-sm">{mask(inv.totalAmount)}</span>
                    <Button
                      size="sm" variant="outline"
                      className="border-amber-400/60 text-amber-700 hover:bg-amber-50 whitespace-nowrap text-xs"
                      onClick={() => handlePayInvoice(inv)}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                      Pagar fatura
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Payment confirmation dialog */}
      <ConfirmPaymentDialog
        open={!!confirmTarget}
        transaction={confirmTarget}
        onOpenChange={(open) => { if (!open) setConfirmTarget(null); }}
        onConfirm={async (amount, date) => {
          if (!confirmTarget) return;
          await updateTransaction(confirmTarget.id, { status: 'paid', amount, date });
          toast.success('Pagamento confirmado!');
          setConfirmTarget(null);
        }}
      />
    </div>
  );
};
