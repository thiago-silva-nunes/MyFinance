import React, { useState } from 'react';
import { useFinance } from '@/context/FinanceContext';
import { formatCurrency, formatShortDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { getIcon } from '@/components/IconMap';
import { ScheduledFormDialog } from '@/components/ScheduledFormDialog';
import { ScheduledTransaction } from '@/data/mockData';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export const Scheduled = () => {
  const { scheduled, categories, deleteScheduled, updateScheduled } = useFinance();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingScheduled, setEditingScheduled] = useState<ScheduledTransaction | null>(null);

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

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Recorrentes</h1>
          <p className="text-muted-foreground">Contas a pagar e receber recorrentes.</p>
        </div>
        <Button onClick={openNewForm} className="w-full md:w-auto shadow-sm hover-elevate">
          <Plus className="w-4 h-4 mr-2" />
          Nova Recorrência
        </Button>
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
              <TableHead className="text-center">Ativo</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {scheduled.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
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
                      <Switch 
                        checked={s.active} 
                        onCheckedChange={() => toggleActive(s)} 
                        className="mx-auto"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
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