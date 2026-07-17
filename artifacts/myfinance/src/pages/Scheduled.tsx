import React, { useState, useMemo } from 'react';
import { useFinance } from '@/context/FinanceContext';
import { formatCurrency, formatShortDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { getIcon } from '@/components/IconMap';
import { ScheduledFormDialog } from '@/components/ScheduledFormDialog';
import { ScheduledTransaction } from '@/data/mockData';
import { Plus, Edit2, Trash2, RefreshCw, BarChart2, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'wouter';
import { getCurrentYearMonth, getExpectedReferenceMonth } from '@/services/recurringEngine';

export const Scheduled = () => {
  const { scheduled, categories, transactions, deleteScheduled, updateScheduled,
    generatePendingTransaction, regeneratePendingTransaction } = useFinance();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingScheduled, setEditingScheduled] = useState<ScheduledTransaction | null>(null);
  const [regenerating, setRegenerating] = useState<string | null>(null);

  // Mapa: scheduledId → status da transação do período atual
  const currentPeriodStatus = useMemo(() => {
    const currentMonth = getCurrentYearMonth();
    const map: Record<string, 'paid' | 'pending' | 'none'> = {};
    for (const s of scheduled) {
      const refMonth = getExpectedReferenceMonth(s);
      if (!refMonth) { map[s.id] = 'none'; continue; }
      const tx = transactions.find(t => t.scheduledId === s.id && t.referenceMonth === refMonth);
      map[s.id] = tx ? tx.status : 'none';
    }
    return map;
  }, [scheduled, transactions]);

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
      const status = currentPeriodStatus[item.id];
      let tx;
      if (status === 'none') {
        tx = await generatePendingTransaction(item);
      } else {
        tx = await regeneratePendingTransaction(item);
      }
      if (tx) {
        toast.success('Transação pendente gerada com sucesso!');
      } else if (status === 'pending') {
        toast.info('Já existe uma transação pendente para este período.');
      } else {
        toast.info('Nova transação pendente criada para este período.');
      }
    } catch {
      toast.error('Falha ao gerar transação pendente.');
    } finally {
      setRegenerating(null);
    }
  };

  const translateFrequency = (freq: string) => {
    const map: Record<string, string> = {
      'once': 'Uma vez',
      'daily': 'Diário',
      'weekly': 'Semanal',
      'monthly': 'Mensal',
      'yearly': 'Anual'
    };
    return map[freq] || freq;
  };

  const PeriodBadge = ({ scheduledId }: { scheduledId: string }) => {
    const status = currentPeriodStatus[scheduledId];
    if (status === 'paid') return (
      <Badge variant="outline" className="text-success border-success/30 bg-success/10 gap-1 whitespace-nowrap">
        <CheckCircle2 className="w-3 h-3" /> Pago
      </Badge>
    );
    if (status === 'pending') return (
      <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-900/20 gap-1 whitespace-nowrap">
        <Clock className="w-3 h-3" /> Pendente
      </Badge>
    );
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

      <div className="bg-card border rounded-xl p-0 overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
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
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Nenhuma transação recorrente configurada.
                </TableCell>
              </TableRow>
            ) : (
              scheduled.map((s) => {
                const cat = categories.find(c => c.id === s.categoryId);
                const Icon = getIcon(cat?.icon || 'more-horizontal');
                return (
                  <TableRow key={s.id} className={!s.active ? 'opacity-50 grayscale' : ''}>
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
                    <TableCell className="text-center">
                      <Switch
                        checked={s.active}
                        onCheckedChange={() => toggleActive(s)}
                        className="mx-auto"
                      />
                    </TableCell>
                    <TableCell className="text-right">
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

      <ScheduledFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        scheduled={editingScheduled}
      />
    </div>
  );
};
