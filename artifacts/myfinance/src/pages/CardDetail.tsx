import React, { useMemo, useState } from 'react';
import { useParams, Link } from 'wouter';
import { useFinance } from '@/context/FinanceContext';
import { usePrivacy } from '@/context/PrivacyContext';
import { formatCurrency, formatShortDate } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { TransactionFormDialog } from '@/components/TransactionFormDialog';
import { Invoice } from '@/data/mockData';
import {
  ArrowLeft, Plus, CheckCircle2, AlertCircle, Clock, XCircle,
  ChevronDown, ChevronRight, Loader2, Receipt
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getIcon } from '@/components/IconMap';

const STATUS_CONFIG: Record<Invoice['status'], { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ElementType }> = {
  open:    { label: 'Em aberto',  variant: 'default',     icon: Clock },
  closed:  { label: 'Fechada',   variant: 'secondary',   icon: ChevronRight },
  paid:    { label: 'Paga',      variant: 'outline',      icon: CheckCircle2 },
  overdue: { label: 'Vencida',   variant: 'destructive',  icon: XCircle },
};

const MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function formatMonth(refMonth: string) {
  const [y, m] = refMonth.split('-');
  return `${MONTH_NAMES[parseInt(m) - 1]} ${y}`;
}

export const CardDetail = () => {
  const params = useParams<{ id: string }>();
  const cardId = params.id;
  const { cards, invoices, transactions, categories, payInvoice } = useFinance();
  const { hideValues } = usePrivacy();
  const mask = (n: number) => hideValues ? 'R$ ••••••' : formatCurrency(n);

  const [expandedInvoice, setExpandedInvoice] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [txDialogOpen, setTxDialogOpen] = useState(false);

  const card = cards.find(c => c.id === cardId);
  const cardInvoices = invoices
    .filter(inv => inv.cardId === cardId)
    .sort((a, b) => b.referenceMonth.localeCompare(a.referenceMonth));

  const usedAmount = useMemo(() => {
    return cardInvoices
      .filter(inv => inv.status !== 'paid')
      .reduce((s, inv) => s + inv.totalAmount, 0);
  }, [cardInvoices]);

  // Compute invoice totals from transactions (for real-time accuracy)
  const invoiceTotals = useMemo(() => {
    const map: Record<string, number> = {};
    for (const tx of transactions) {
      if (tx.cardId === cardId && tx.referenceMonth) {
        map[tx.referenceMonth] = (map[tx.referenceMonth] ?? 0) + tx.amount;
      }
    }
    return map;
  }, [transactions, cardId]);

  const getInvoiceTransactions = (refMonth: string) => {
    return transactions.filter(tx => tx.cardId === cardId && tx.referenceMonth === refMonth)
      .sort((a, b) => b.date.localeCompare(a.date));
  };

  const handlePay = async (inv: Invoice) => {
    if (!card) return;
    if (!confirm(`Marcar fatura de ${formatMonth(inv.referenceMonth)} como paga? Isso criará uma transação de despesa de ${formatCurrency(inv.totalAmount)}.`)) return;
    setPayingId(inv.id);
    try {
      await payInvoice(inv, card);
      toast.success('Fatura marcada como paga e transação criada.');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao pagar fatura');
    } finally {
      setPayingId(null);
    }
  };

  if (!card) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-muted-foreground">Cartão não encontrado.</p>
        <Link href="/cards"><Button variant="outline"><ArrowLeft className="w-4 h-4 mr-2" />Voltar</Button></Link>
      </div>
    );
  }

  const pct = card.limit > 0 ? Math.min((usedAmount / card.limit) * 100, 100) : 0;
  const availableAmount = Math.max(0, card.limit - usedAmount);

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/cards">
          <Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{card.name}</h1>
          <p className="text-sm text-muted-foreground">{card.bank} · Fecha dia {card.closingDay} · Vence dia {card.dueDay}</p>
        </div>
      </div>

      {/* Limit card */}
      <Card style={{ borderTop: `4px solid ${card.color}` }}>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-muted-foreground">Limite Total</p>
              <p className="font-bold text-lg">{mask(card.limit)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Utilizado</p>
              <p className={cn('font-bold text-lg', !hideValues && pct > 80 ? 'text-destructive' : !hideValues && pct > 50 ? 'text-amber-600' : '')}>
                {mask(usedAmount)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Disponível</p>
              <p className="font-bold text-lg text-success">{mask(availableAmount)}</p>
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{hideValues ? '••%' : `${pct.toFixed(0)}%`} utilizado</span>
              <span>Disponível: {hideValues ? '••%' : `${((1 - pct / 100) * 100).toFixed(0)}%`}</span>
            </div>
            <Progress value={hideValues ? 0 : pct} className={cn('h-3', !hideValues && pct > 80 ? '[&>*]:bg-destructive' : !hideValues && pct > 50 ? '[&>*]:bg-amber-500' : '')} />
          </div>
        </CardContent>
      </Card>

      {/* Invoice list */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Faturas</h2>
          <Button size="sm" onClick={() => setTxDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> Nova compra
          </Button>
        </div>

        {cardInvoices.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Receipt className="w-10 h-10 text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground text-sm">Nenhuma fatura gerada ainda.</p>
              <p className="text-xs text-muted-foreground mt-1">Adicione uma compra para criar a primeira fatura.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {cardInvoices.map(inv => {
              const cfg = STATUS_CONFIG[inv.status];
              const StatusIcon = cfg.icon;
              const isExpanded = expandedInvoice === inv.id;
              const invTxs = getInvoiceTransactions(inv.referenceMonth);
              const realTotal = invoiceTotals[inv.referenceMonth] ?? inv.totalAmount;
              const isPaying = payingId === inv.id;

              return (
                <Card key={inv.id} className={cn('overflow-hidden transition-all', inv.status === 'overdue' && 'border-destructive/50')}>
                  <button
                    className="w-full text-left px-4 py-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
                    onClick={() => setExpandedInvoice(isExpanded ? null : inv.id)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <StatusIcon className={cn('w-5 h-5 shrink-0',
                        inv.status === 'open' ? 'text-blue-500' :
                        inv.status === 'closed' ? 'text-amber-500' :
                        inv.status === 'paid' ? 'text-success' : 'text-destructive'
                      )} />
                      <div className="min-w-0">
                        <p className="font-medium truncate">{formatMonth(inv.referenceMonth)}</p>
                        <p className="text-xs text-muted-foreground">
                          Fecha: {formatShortDate(inv.closingDate)} · Vence: {formatShortDate(inv.dueDate)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      <div className="text-right">
                        <p className="font-bold">{mask(realTotal)}</p>
                        <Badge variant={cfg.variant} className="text-[10px] h-4">{cfg.label}</Badge>
                      </div>
                      {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t bg-muted/20">
                      {/* Pay button */}
                      {(inv.status === 'closed' || inv.status === 'overdue') && (
                        <div className="px-4 py-3 border-b">
                          <Button size="sm" className="gap-2" onClick={() => handlePay(inv)} disabled={isPaying}>
                            {isPaying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                            Pagar fatura ({mask(realTotal)})
                          </Button>
                        </div>
                      )}

                      {/* Transactions */}
                      {invTxs.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-6">Nenhum lançamento nesta fatura.</p>
                      ) : (
                        <div className="divide-y">
                          {invTxs.map(tx => {
                            const cat = categories.find(c => c.id === tx.categoryId);
                            const Icon = getIcon(cat?.icon || 'more-horizontal');
                            return (
                              <div key={tx.id} className="flex items-center gap-3 px-4 py-3">
                                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                                  style={{ backgroundColor: `${cat?.color || '#64748b'}20`, color: cat?.color || '#64748b' }}>
                                  <Icon className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">
                                    {tx.description}
                                    {tx.installmentNumber && tx.installmentTotal && (
                                      <span className="ml-1 text-xs text-muted-foreground font-normal">
                                        ({tx.installmentNumber}/{tx.installmentTotal})
                                      </span>
                                    )}
                                  </p>
                                  <p className="text-xs text-muted-foreground">{formatShortDate(tx.date)}</p>
                                </div>
                                <p className="text-sm font-medium">{mask(tx.amount)}</p>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <TransactionFormDialog open={txDialogOpen} onOpenChange={setTxDialogOpen} defaultCardId={cardId} />
    </div>
  );
};
