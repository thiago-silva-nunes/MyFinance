import React, { useMemo, useState } from 'react';
import { useFinance } from '@/context/FinanceContext';
import { usePrivacy } from '@/context/PrivacyContext';
import { formatCurrency } from '@/lib/utils';
import { getIcon } from '@/components/IconMap';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { Target, Pencil, Trash2, Plus, TrendingUp, AlertTriangle } from 'lucide-react';
import { Budget } from '@/data/mockData';
import { cn } from '@/lib/utils';

// ─── Schema ───────────────────────────────────────────────────────────────────

const budgetSchema = z.object({
  name:           z.string().min(1, 'Nome é obrigatório'),
  categoryId:     z.string().min(1, 'Categoria é obrigatória'),
  amount:         z.coerce.number().min(0.01, 'Valor deve ser maior que zero'),
  recurrence:     z.enum(['mensal', 'pontual']),
  referenceMonth: z.string().optional(),
});

type BudgetFormData = z.infer<typeof budgetSchema>;

// ─── Budget Dialog ─────────────────────────────────────────────────────────────

interface BudgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budget?: Budget | null;
}

function BudgetDialog({ open, onOpenChange, budget }: BudgetDialogProps) {
  const { categories, addBudget, updateBudget } = useFinance();
  const expenseCategories = categories.filter(c => c.type === 'expense');

  const form = useForm<BudgetFormData>({
    resolver: zodResolver(budgetSchema),
    defaultValues: {
      name: '', categoryId: '', amount: 0,
      recurrence: 'mensal', referenceMonth: '',
    },
  });

  React.useEffect(() => {
    if (open) {
      form.reset(budget ? {
        name: budget.name,
        categoryId: budget.categoryId,
        amount: budget.amount,
        recurrence: budget.recurrence,
        referenceMonth: budget.referenceMonth ?? '',
      } : {
        name: '', categoryId: '', amount: 0,
        recurrence: 'mensal', referenceMonth: '',
      });
    }
  }, [open, budget, form]);

  const recurrence = form.watch('recurrence');

  const onSubmit = async (data: BudgetFormData) => {
    try {
      const payload: Omit<Budget, 'id'> = {
        name: data.name,
        categoryId: data.categoryId,
        amount: data.amount,
        recurrence: data.recurrence,
        referenceMonth: data.recurrence === 'pontual' && data.referenceMonth
          ? data.referenceMonth
          : undefined,
        active: true,
      };
      if (budget) {
        await updateBudget(budget.id, payload);
        toast.success('Orçamento atualizado');
      } else {
        await addBudget(payload);
        toast.success('Orçamento criado');
      }
      onOpenChange(false);
    } catch {
      toast.error('Erro ao salvar orçamento');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{budget ? 'Editar Orçamento' : 'Novo Orçamento'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

            {/* Name */}
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Nome do orçamento</FormLabel>
                <FormControl><Input placeholder="Ex: Lazer mensal" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {/* Category */}
            <FormField control={form.control} name="categoryId" render={({ field }) => (
              <FormItem>
                <FormLabel>Categoria</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Selecione uma categoria" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {expenseCategories.map(cat => {
                      const Icon = getIcon(cat.icon);
                      return (
                        <SelectItem key={cat.id} value={cat.id}>
                          <div className="flex items-center gap-2">
                            <Icon className="w-4 h-4" style={{ color: cat.color }} />
                            {cat.name}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            {/* Amount */}
            <FormField control={form.control} name="amount" render={({ field }) => (
              <FormItem>
                <FormLabel>Valor limite (R$)</FormLabel>
                <FormControl>
                  <Input
                    type="number" step="0.01" min="0" placeholder="0.00"
                    {...field}
                    value={field.value === 0 ? '' : field.value}
                    onChange={e => field.onChange(e.target.valueAsNumber || 0)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {/* Recurrence */}
            <FormField control={form.control} name="recurrence" render={({ field }) => (
              <FormItem>
                <FormLabel>Recorrência</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="mensal">Mensal (repete todo mês)</SelectItem>
                    <SelectItem value="pontual">Pontual (mês específico)</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            {/* Reference month — only for pontual */}
            {recurrence === 'pontual' && (
              <FormField control={form.control} name="referenceMonth" render={({ field }) => (
                <FormItem>
                  <FormLabel>Mês de referência</FormLabel>
                  <FormControl>
                    <Input type="month" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            )}

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit">{budget ? 'Salvar' : 'Criar orçamento'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Progress bar color helper ─────────────────────────────────────────────────

function progressColor(pct: number) {
  if (pct >= 100) return 'bg-destructive';
  if (pct >= 80) return 'bg-amber-500';
  return 'bg-emerald-500';
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export const Budgets = () => {
  const { budgets, categories, transactions, deleteBudget } = useFinance();
  const { hideValues } = usePrivacy();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Budget | null>(null);

  // Current month YYYY-MM for filtering mensal budgets
  const now = new Date();
  const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const activeBudgets = useMemo(() => budgets.filter(b => b.active), [budgets]);

  // For each budget, compute how much was spent
  const budgetsWithSpent = useMemo(() => {
    return activeBudgets.map(budget => {
      let spent = 0;

      if (budget.recurrence === 'mensal') {
        // Transactions whose date starts with YYYY-MM for the current month
        spent = transactions
          .filter(t =>
            t.type === 'expense' &&
            t.categoryId === budget.categoryId &&
            (t.status === 'paid' || t.status === 'pending') &&
            t.date.startsWith(currentMonthPrefix),
          )
          .reduce((s, t) => s + t.amount, 0);
      } else if (budget.recurrence === 'pontual' && budget.referenceMonth) {
        spent = transactions
          .filter(t =>
            t.type === 'expense' &&
            t.categoryId === budget.categoryId &&
            (t.status === 'paid' || t.status === 'pending') &&
            t.date.startsWith(budget.referenceMonth!),
          )
          .reduce((s, t) => s + t.amount, 0);
      }

      const pct = budget.amount > 0 ? Math.round((spent / budget.amount) * 100) : 0;
      return { budget, spent, pct };
    });
  }, [activeBudgets, transactions, currentMonthPrefix]);

  // Summary
  const totalBudgeted = activeBudgets
    .filter(b => b.recurrence === 'mensal')
    .reduce((s, b) => s + b.amount, 0);
  const totalSpent = budgetsWithSpent
    .filter(({ budget }) => budget.recurrence === 'mensal')
    .reduce((s, { spent }) => s + spent, 0);
  const overallPct = totalBudgeted > 0 ? Math.round((totalSpent / totalBudgeted) * 100) : 0;

  const mask = (v: number) => hideValues ? 'R$ ••••••' : formatCurrency(v);

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este orçamento?')) return;
    try {
      await deleteBudget(id);
      toast.success('Orçamento excluído');
    } catch {
      toast.error('Erro ao excluir orçamento');
    }
  };

  const openNew = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (b: Budget) => { setEditing(b); setDialogOpen(true); };

  return (
    <div className="space-y-6 pb-20 md:pb-0">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Orçamentos</h1>
          <p className="text-muted-foreground">Defina limites de gasto por categoria e acompanhe o progresso.</p>
        </div>
        <Button onClick={openNew} className="w-full md:w-auto">
          <Plus className="w-4 h-4 mr-2" /> Novo Orçamento
        </Button>
      </div>

      {/* Summary */}
      {activeBudgets.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Resumo do mês atual (orçamentos mensais)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Total orçado</p>
                <p className="text-lg font-bold">{mask(totalBudgeted)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Total gasto</p>
                <p className={cn('text-lg font-bold', overallPct >= 100 ? 'text-destructive' : overallPct >= 80 ? 'text-amber-600' : 'text-foreground')}>
                  {mask(totalSpent)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Utilizado</p>
                <p className={cn('text-lg font-bold', overallPct >= 100 ? 'text-destructive' : overallPct >= 80 ? 'text-amber-600' : 'text-emerald-600')}>
                  {overallPct}%
                </p>
              </div>
            </div>
            <Progress value={Math.min(overallPct, 100)} className="h-2" indicatorClassName={progressColor(overallPct)} />
          </CardContent>
        </Card>
      )}

      {/* Budget list */}
      {activeBudgets.length === 0 ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center gap-3 text-center">
            <Target className="w-12 h-12 text-muted-foreground/40" />
            <p className="font-medium text-muted-foreground">Nenhum orçamento ainda</p>
            <p className="text-sm text-muted-foreground max-w-sm">
              Crie orçamentos por categoria para acompanhar quanto você está gastando.
            </p>
            <Button onClick={openNew} variant="outline" className="mt-2">
              <Plus className="w-4 h-4 mr-2" /> Criar primeiro orçamento
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {budgetsWithSpent.map(({ budget, spent, pct }) => {
            const cat = categories.find(c => c.id === budget.categoryId);
            const Icon = getIcon(cat?.icon ?? 'circle');
            const overflow = spent - budget.amount;
            const isOver = pct >= 100;
            const isWarning = pct >= 80 && pct < 100;

            return (
              <Card key={budget.id} className={cn(
                'transition-all',
                isOver ? 'border-destructive/40' : isWarning ? 'border-amber-300' : '',
              )}>
                <CardContent className="pt-4 pb-4 space-y-3">
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="p-1.5 rounded-lg shrink-0" style={{ backgroundColor: `${cat?.color}20` }}>
                        <Icon className="w-4 h-4 shrink-0" style={{ color: cat?.color }} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm leading-tight truncate">{budget.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {cat?.name ?? 'Categoria'} ·{' '}
                          {budget.recurrence === 'mensal' ? 'Mensal' : `Pontual (${budget.referenceMonth})`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {isOver && (
                        <Badge variant="destructive" className="text-xs">Estourado</Badge>
                      )}
                      {isWarning && (
                        <Badge className="text-xs bg-amber-100 text-amber-800 border-amber-300">Atenção</Badge>
                      )}
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(budget)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(budget.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{mask(spent)} gastos</span>
                      <span>limite: {mask(budget.amount)}</span>
                    </div>
                    <Progress value={Math.min(pct, 100)} className="h-2" indicatorClassName={progressColor(pct)} />
                    <div className="flex justify-between items-center">
                      <span className={cn('text-xs font-medium',
                        isOver ? 'text-destructive' : isWarning ? 'text-amber-600' : 'text-emerald-600',
                      )}>
                        {pct}% utilizado
                      </span>
                      {isOver && (
                        <span className="text-xs text-destructive font-medium flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          {mask(overflow)} acima do limite
                        </span>
                      )}
                      {!isOver && (
                        <span className="text-xs text-muted-foreground">
                          {mask(budget.amount - spent)} restantes
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <BudgetDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        budget={editing}
      />
    </div>
  );
};
