import React, { useState, useMemo } from 'react';
import { useFinance } from '@/context/FinanceContext';
import { formatCurrency, formatShortDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { getIcon } from '@/components/IconMap';
import { TransactionFormDialog } from '@/components/TransactionFormDialog';
import { BulkEditScheduledDialog } from '@/components/BulkEditScheduledDialog';
import { ScheduledTransaction } from '@/data/mockData';
import { Plus, Edit2, Trash2, RefreshCw, BarChart2, CheckCircle2, Clock, AlertCircle, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'wouter';
import { getCurrentYearMonth, getExpectedReferenceMonth, getOverdueTransactions, getTodayStr } from '@/services/recurringEngine';

export const Scheduled = () => {
  const { scheduled, categories, transactions, deleteScheduled, updateScheduled,
    updateTransaction, generatePendingTransaction, regeneratePendingTransaction } = useFinance();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingScheduled, setEditingScheduled] = useState<ScheduledTransaction | null>(null);
  const [regenerating, setRegenerating] = useState<string | null>(null);

  // ── Bulk selection ────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds]   = useState<Set<string>>(new Set());
  const [bulkEditOpen, setBulkEditOpen] = useState(false);

  const someSelected = selectedIds.size > 0;
  const allSelected  = scheduled.length > 0 && selectedIds.size === scheduled.length;

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(scheduled.map(s => s.id)));
  };

  const handleBulkDelete = () => {
    if (!selectedIds.size) return;
    if (!confirm(`Excluir ${selectedIds.size} recorrência${selectedIds.size !== 1 ? 's' : ''}? Essa ação não pode ser desfeita.`)) return;
    const ids = [...selectedIds];
    ids.forEach(id => deleteScheduled(id));
    toast.success(`${ids.length} recorrência${ids.length !== 1 ? 's' : ''} excluída${ids.length !== 1 ? 's' : ''}`);
    setSelectedIds(new Set());
  };

  // Mapa: scheduledId → { status, tx? } da transação do período atual
  const currentPeriodStatus = useMemo(() => {
    const map: Record<string, { status: 'paid' | 'pending' | 'none'; tx?: (typeof transactions)[number] }> = {};
    for (const s of scheduled) {
      const refMonth = getExpectedReferenceMonth(s);
      if (!refMonth) { map[s.id] = { status: 'none' }; continue; }
      const tx = transactions.find(t => t.scheduledId === s.id && t.referenceMonth === refMonth);
      map[s.id] = tx ? { status: tx.status as 'paid' | 'pending', tx } : { status: 'none' };
    }
    return map;
  }, [scheduled, transactions]);

  // Transações pendentes de meses anteriores (atrasadas)
  const overdueTransactions = useMemo(
    () => getOverdueTransactions(scheduled, transactions),
    [scheduled, transactions],
  );

  const handleEdit = (item: ScheduledTransaction) => {
    setEditingScheduled(item);
    setIsFormOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta recorrência?')) {
      deleteScheduled(id);
      toast.success('Recorrência excluída');
    }
  };

  const toggleActive = (item: ScheduledTransaction) => {
    updateScheduled(item.id, { active: !item.active });
    toast.success(`Recorrência ${!item.active ? 'ativada' : 'desativada'}`);
  };

  const openNewForm = () => {
    setEditingScheduled(null);
    setIsFormOpen(true);
  };

  const handleRegenerate = async (item: ScheduledTransaction) => {
    setRegenerating(item.id);
    try {
      const { status } = currentPeriodStatus[item.id] ?? { status: 'none' };
      if (status === 'none') {
        const tx = await generatePendingTransaction(item);
        if (tx) {
          toast.success('Transação pendente gerada com sucesso!');
        } else {
          toast.info('Não foi possível gerar transação para este período.');
        }
      } else {
        const { transaction, reason } = await regeneratePendingTransaction(item);
        if (reason === 'already_paid') {
          toast.info('Este período já foi pago — nada para regenerar.');
        } else if (reason === 'already_pending') {
          toast.info('Já existe uma transação pendente para este período.');
        } else if (transaction) {
          toast.success('Transação pendente gerada com sucesso!');
        } else {
          toast.info('Não foi possível regenerar a transação.');
        }
      }
    } catch {
      toast.error('Falha ao gerar transação pendente.');
    } finally {
      setRegenerating(null);
    }
  };

  const translateFrequency = (freq: string) => {
    const map: Record<string, string> = {
      'once': 'Uma vez', 'daily': 'Diário', 'weekly': 'Semanal',
      'monthly': 'Mensal', 'yearly': 'Anual'
    };
    return map[freq] || freq;
  };

  const PeriodBadge = ({ scheduledId }: { scheduledId: string }) => {
    const today = getTodayStr();
    const { status, tx } = currentPeriodStatus[scheduledId] ?? { status: 'none' as const };
    if (status === 'paid') return (
      <Badge variant="outline" className="text-success border-success/30 bg-success/10 gap-1 whitespace-nowrap">
        <CheckCircle2 className="w-3 h-3" /> Pago
      </Badge>
    );
    if (status === 'pending') {
      if (tx && tx.date < today) return (
        <Badge variant="destructive" className="gap-1 whitespace-nowrap">
          <AlertCircle className="w-3 h-3" /> Atrasado
        </Badge>
      );
      return (
        <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-900/20 gap-1 whitespace-nowrap">
          <Clock className="w-3 h-3" /> Pendente
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-muted-foreground gap-1 whitespace-nowrap">
        <AlertCircle className="w-3 h-3" /> Não gerado
      </Badge>
    );
  };

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Recorrentes</h1>
          <p className="text-muted-foreground">Contas a pagar e receber recorrentes.</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <Link href="/scheduled/analise">
            <Button variant="outline" className="gap-2 shadow-sm">
              <BarChart2 className="w-4 h-4" />
              Análise
            </Button>
          </Link>
          <Button onClick={openNewForm} className="flex-1 md:flex-none shadow-sm hover-elevate">
            <Plus className="w-4 h-4 mr-2" />
            Nova Recorrência
          </Button>
        </div>
      </div>

      {/* Bulk action bar */}
      {someSelected && (
        <div className="flex items-center justify-between bg-primary/10 border border-primary/20 rounded-lg px-4 py-2.5 gap-3">
          <span className="text-sm font-medium">
            {selectedIds.size} selecionada{selectedIds.size !== 1 ? 's' : ''}
          </span>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set())}>
              Limpar seleção
            </Button>
            <Button variant="outline" size="sm" onClick={() => setBulkEditOpen(true)}>
              <Pencil className="w-3.5 h-3.5 mr-1.5" />
              Editar selecionadas
            </Button>
            <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              Excluir selecionadas
            </Button>
          </div>
        </div>
      )}

      {/* ── Alerta de contas atrasadas ─────────────────────────────────────── */}
      {overdueTransactions.length > 0 && (
        <div className="border border-destructive/30 bg-destructive/5 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
            <h3 className="font-semibold text-destructive">
              Você tem {overdueTransactions.length} conta{overdueTransactions.length !== 1 ? 's' : ''} atrasada{overdueTransactions.length !== 1 ? 's' : ''} somando{' '}
              {formatCurrency(overdueTransactions.reduce((s, t) => s + t.amount, 0))}
            </h3>
          </div>
          <div className="divide-y divide-destructive/10">
            {overdueTransactions.map(tx => {
              const cat = categories.find(c => c.id === tx.categoryId);
              return (
                <div key={tx.id} className="flex items-center justify-between py-2 gap-3 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{tx.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {cat?.name ?? '—'} · vence {formatShortDate(tx.date)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="font-semibold text-sm text-destructive">
                      {formatCurrency(tx.amount)}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-destructive/40 text-destructive hover:bg-destructive/10 whitespace-nowrap"
                      onClick={() => updateTransaction(tx.id, { status: 'paid' })}
                    >
                      Marcar como paga
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="bg-card border rounded-xl p-0 overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Selecionar todas"
                  className={someSelected && !allSelected ? 'opacity-60' : ''}
                />
              </TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Frequência</TableHead>
              <TableHead>Data Inicial</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-center">Mês atual</TableHead>
              <TableHead className="text-center">Ativo</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {scheduled.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  Nenhuma transação recorrente configurada.
                </TableCell>
              </TableRow>
            ) : (
              scheduled.map((s) => {
                const cat = categories.find(c => c.id === s.categoryId);
                const Icon = getIcon(cat?.icon || 'more-horizontal');
                const isSelected = selectedIds.has(s.id);
                return (
                  <TableRow
                    key={s.id}
                    className={`cursor-pointer transition-colors ${!s.active ? 'opacity-50 grayscale' : ''} ${isSelected ? 'bg-primary/5' : 'hover:bg-muted/50'}`}
                    onClick={() => handleEdit(s)}
                  >
                    <TableCell onClick={e => e.stopPropagation()}>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(s.id)}
                        aria-label={`Selecionar ${s.description}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{s.description}</TableCell>
                    <TableCell>
                      {cat ? (
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4" style={{ color: cat.color }} />
                          <span>{cat.name}</span>
                        </div>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{translateFrequency(s.frequency)}</Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{formatShortDate(s.startDate)}</TableCell>
                    <TableCell className={`text-right font-medium whitespace-nowrap ${s.type === 'income' ? 'text-success' : ''}`}>
                      {s.type === 'income' ? '+' : '-'}{formatCurrency(s.amount)}
                    </TableCell>
                    <TableCell className="text-center">
                      <PeriodBadge scheduledId={s.id} />
                    </TableCell>
                    <TableCell className="text-center" onClick={e => e.stopPropagation()}>
                      <Switch
                        checked={s.active}
                        onCheckedChange={() => toggleActive(s)}
                        className="mx-auto"
                      />
                    </TableCell>
                    <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRegenerate(s)}
                          disabled={!s.active || regenerating === s.id}
                          title="Gerar/regenerar transação pendente"
                        >
                          <RefreshCw className={`w-4 h-4 text-muted-foreground ${regenerating === s.id ? 'animate-spin' : ''}`} />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(s)}>
                          <Edit2 className="w-4 h-4 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <TransactionFormDialog
        open={isFormOpen}
        onOpenChange={(open) => { setIsFormOpen(open); if (!open) setEditingScheduled(null); }}
        editingScheduled={editingScheduled}
      />

      <BulkEditScheduledDialog
        open={bulkEditOpen}
        onOpenChange={setBulkEditOpen}
        selectedIds={[...selectedIds]}
        onDone={() => setSelectedIds(new Set())}
      />
    </div>
  );
};
