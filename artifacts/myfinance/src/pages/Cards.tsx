import React, { useMemo, useState } from 'react';
import { useFinance } from '@/context/FinanceContext';
import { formatCurrency } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CardFormDialog } from '@/components/CardFormDialog';
import { CreditCard as CreditCardType } from '@/data/mockData';
import { Plus, CreditCard, Pencil, Trash2, ChevronRight, AlertTriangle } from 'lucide-react';
import { Link } from 'wouter';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

const BRAND_LABELS: Record<string, string> = {
  visa: 'VISA', mastercard: 'Mastercard', elo: 'Elo', amex: 'Amex', other: '●●●●',
};

function VisualCard({ card, usedAmount }: { card: CreditCardType; usedAmount: number }) {
  const pct = card.limit > 0 ? Math.min((usedAmount / card.limit) * 100, 100) : 0;
  const barColor = pct > 80 ? 'bg-red-400' : pct > 50 ? 'bg-yellow-400' : 'bg-white/60';

  return (
    <div className="relative rounded-2xl overflow-hidden aspect-[86/54] w-full select-none shadow-xl"
      style={{ background: `linear-gradient(135deg, ${card.color}ee, ${card.color}88)` }}>
      {/* Shine overlay */}
      <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent" />

      {/* Brand */}
      <div className="absolute top-4 right-4 text-white/90 font-bold text-sm tracking-widest">
        {BRAND_LABELS[card.brand] ?? card.brand}
      </div>

      {/* Card icon */}
      <div className="absolute top-4 left-4 w-8 h-6 rounded bg-yellow-300/80 flex items-center justify-center">
        <div className="w-4 h-4 bg-yellow-500/60 rounded-sm" />
      </div>

      {/* Bank + Name */}
      <div className="absolute bottom-12 left-4 right-4">
        <p className="text-white/70 text-[10px] uppercase tracking-widest">{card.bank}</p>
        <p className="text-white font-semibold text-base truncate">{card.name}</p>
      </div>

      {/* Limit bar */}
      <div className="absolute bottom-3 left-4 right-4 space-y-0.5">
        <div className="flex justify-between text-white/70 text-[9px]">
          <span>{formatCurrency(usedAmount)} usado</span>
          <span>lim. {formatCurrency(card.limit)}</span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-white/20">
          <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}

export const Cards = () => {
  const { cards, invoices, deleteCard } = useFinance();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editCard, setEditCard] = useState<CreditCardType | null>(null);

  // Compute used limit per card = sum of open + closed (non-paid) invoices
  const usedByCard = useMemo(() => {
    const map: Record<string, number> = {};
    for (const inv of invoices) {
      if (inv.status !== 'paid') {
        map[inv.cardId] = (map[inv.cardId] ?? 0) + inv.totalAmount;
      }
    }
    return map;
  }, [invoices]);

  const handleDelete = async (card: CreditCardType) => {
    if (!confirm(`Excluir o cartão "${card.name}"? Todas as faturas serão removidas.`)) return;
    try {
      await deleteCard(card.id);
      toast.success('Cartão removido');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao remover cartão');
    }
  };

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cartões de Crédito</h1>
          <p className="text-muted-foreground">Gerencie seus cartões e acompanhe as faturas.</p>
        </div>
        <Button onClick={() => { setEditCard(null); setDialogOpen(true); }} className="w-full md:w-auto">
          <Plus className="w-4 h-4 mr-2" /> Novo Cartão
        </Button>
      </div>

      {cards.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <CreditCard className="w-12 h-12 text-muted-foreground/30 mb-4" />
          <h3 className="font-semibold mb-1">Nenhum cartão cadastrado</h3>
          <p className="text-sm text-muted-foreground mb-4">Adicione seu primeiro cartão de crédito.</p>
          <Button onClick={() => { setEditCard(null); setDialogOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Adicionar Cartão
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {cards.map((card, i) => {
            const used = usedByCard[card.id] ?? 0;
            const pct = card.limit > 0 ? (used / card.limit) * 100 : 0;
            const openInvoices = invoices.filter(inv => inv.cardId === card.id && inv.status !== 'paid').length;

            return (
              <motion.div key={card.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
                <Card className="hover-elevate transition-all">
                  <CardContent className="p-4 space-y-4">
                    {/* Visual card */}
                    <VisualCard card={card} usedAmount={used} />

                    {/* Stats */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Disponível</span>
                        <span className="font-semibold">{formatCurrency(Math.max(0, card.limit - used))}</span>
                      </div>
                      <Progress value={pct} className="h-2" />
                      {pct > 80 && (
                        <div className="flex items-center gap-1 text-destructive text-xs">
                          <AlertTriangle className="w-3 h-3" />
                          Mais de 80% do limite utilizado
                        </div>
                      )}
                      <div className="flex justify-between text-xs text-muted-foreground pt-1">
                        <span>{openInvoices} fatura{openInvoices !== 1 ? 's' : ''} em aberto</span>
                        <span>Fecha dia {card.closingDay} · Vence dia {card.dueDay}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-1">
                      <Link href={`/cards/${card.id}`} className="flex-1">
                        <Button variant="outline" className="w-full gap-2">
                          Ver faturas <ChevronRight className="w-4 h-4" />
                        </Button>
                      </Link>
                      <Button variant="ghost" size="icon" onClick={() => { setEditCard(card); setDialogOpen(true); }}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDelete(card)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      <CardFormDialog open={dialogOpen} onOpenChange={setDialogOpen} card={editCard} />
    </div>
  );
};
