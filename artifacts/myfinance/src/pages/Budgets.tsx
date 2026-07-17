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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { Target, Pencil, Trash2, Plus, TrendingUp, AlertTriangle, ChevronDown, ChevronRight, Layers, Loader2 } from 'lucide-react';
import { Budget, BudgetGroup } from '@/data/mockData';
import { cn } from '@/lib/utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function progressColor(pct: number) {
  if (pct >= 100) return 'bg-destructive';
  if (pct >= 80)  return 'bg-amber-500';
  return 'bg-emerald-500';
}

// ─── Budget Dialog ─────────────────────────────────────────────────────────────

const budgetSchema = z.object({
  name:           z.string().min(1, 'Nome é obrigatório'),
  categoryId:     z.string().min(1, 'Categoria é obrigatória'),
  amount:         z.coerce.number().min(0.01, 'Valor deve ser maior que zero'),
  recurrence:     z.enum(['mensal', 'pontual']),
  referenceMonth: z.string().optional(),
  groupId:        z.string().optional(),
});

type BudgetFormData = z.infer<typeof budgetSchema>;

interface BudgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budget?: Budget | null;
  defaultGroupId?: string;
}

function BudgetDialog({ open, onOpenChange, budget, defaultGroupId }: BudgetDialogProps) {
  const { categories, budgetGroups, addBudget, updateBudget } = useFinance();
  const expenseCategories = categories.filter(c => c.type === 'expense');

  const form = useForm<BudgetFormData>({
    resolver: zodResolver(budgetSchema),
    defaultValues: { name: '', categoryId: '', amount: 0, recurrence: 'mensal', referenceMonth: '', groupId: '' },
  });

  React.useEffect(() => {
    if (open) {
      form.reset(budget ? {
        name: budget.name, categoryId: budget.categoryId, amount: budget.amount,
        recurrence: budget.recurrence, referenceMonth: budget.referenceMonth ?? '',
        groupId: budget.groupId ?? '',
      } : {
        name: '', categoryId: '', amount: 0, recurrence: 'mensal', referenceMonth: '',
        groupId: defaultGroupId ?? '',
      });
    }
  }, [open, budget, defaultGroupId, form]);

  const recurrence = form.watch('recurrence');

  const onSubmit = async (data: BudgetFormData) => {
    try {
      const payload: Omit<Budget, 'id'> = {
        name: data.name, categoryId: data.categoryId, amount: data.amount,
        recurrence: data.recurrence,
        referenceMonth: data.recurrence === 'pontual' && data.referenceMonth ? data.referenceMonth : undefined,
        active: true,
        groupId: data.groupId && data.groupId !== '' ? data.groupId : undefined,
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
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{budget ? 'Editar Orçamento' : 'Novo Orçamento'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Nome do orçamento</FormLabel>
                <FormControl><Input placeholder="Ex: Lazer mensal" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

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

            <FormField control={form.control} name="recurrence" render={({ field }) => (
              <FormItem>
                <FormLabel>Recorrência</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="mensal">Mensal (repete todo mês)</SelectItem>
                    <SelectItem value="pontual">Pontual (mês específico)</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            {recurrence === 'pontual' && (
              <FormField control={form.control} name="referenceMonth" render={({ field }) => (
                <FormItem>
                  <FormLabel>Mês de referência</FormLabel>
                  <FormControl><Input type="month" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            )}

            {budgetGroups.length > 0 && (
              <FormField control={form.control} name="groupId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Grupo <span className="text-muted-foreground font-normal">(opcional)</span></FormLabel>
                  <Select
                    onValueChange={(v) => field.onChange(v === '__none__' ? '' : v)}
                    value={field.value && field.value !== '' ? field.value : '__none__'}
                  >
                    <FormControl><SelectTrigger><SelectValue placeholder="Sem grupo" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">— Sem grupo —</SelectItem>
                      {budgetGroups.map(g => (
                        <SelectItem key={g.id} value={g.id}>
                          <div className="flex items-center gap-2">
                            <Layers className="w-3.5 h-3.5 text-muted-foreground" />
                            {g.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            )}

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {budget ? 'Salvar' : 'Criar orçamento'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Budget Group Dialog ───────────────────────────────────────────────────────

const groupSchema = z.object({
  name:       z.string().min(1, 'Nome é obrigatório'),
  totalLimit: z.coerce.number().optional(),
});

type GroupFormData = z.infer<typeof groupSchema>;

interface GroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group?: BudgetGroup | null;
}

function GroupDialog({ open, onOpenChange, group }: GroupDialogProps) {
  const { addBudgetGroup, updateBudgetGroup } = useFinance();

  const form = useForm<GroupFormData>({
    resolver: zodResolver(groupSchema),
    defaultValues: { name: '', totalLimit: undefined },
  });

  React.useEffect(() => {
    if (open) {
      form.reset(group
        ? { name: group.name, totalLimit: group.totalLimit }
        : { name: '', totalLimit: undefined });
    }
  }, [open, group, form]);

  const onSubmit = async (data: GroupFormData) => {
    try {
      const payload = {
        name: data.name,
        totalLimit: data.totalLimit && data.totalLimit > 0 ? data.totalLimit : undefined,
      };
      if (group) {
        await updateBudgetGroup(group.id, payload);
        toast.success('Grupo atualizado');
      } else {
        await addBudgetGroup(payload);
        toast.success('Grupo criado');
      }
      onOpenChange(false);
    } catch {
      toast.error('Erro ao salvar grupo');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle>{group ? 'Editar Grupo' : 'Novo Grupo de Orçamentos'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Nome do grupo</FormLabel>
                <FormControl><Input placeholder="Ex: Casa, Lazer, Trabalho..." {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="totalLimit" render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Limite total do grupo (R$) <span className="text-muted-foreground font-normal">(opcional)</span>
                </FormLabel>
                <FormControl>
                  <Input
                    type="number" step="0.01" min="0" placeholder="Deixe em branco para usar a soma dos limites individuais"
                    value={field.value === undefined || field.value === 0 ? '' : field.value}
                    onChange={e => field.onChange(e.target.value === '' ? undefined : e.target.valueAsNumber)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {group ? 'Salvar' : 'Criar grupo'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Budget Card (individual) ─────────────────────────────────────────────────

interface BudgetCardProps {
  budget: Budget;
  spent: number;
  pct: number;
  compact?: boolean;
  onEdit: (b: Budget) => void;
  onDelete: (id: string) => void;
  mask: (v: number) => string;
}

function BudgetCard({ budget, spent, pct, compact, onEdit, onDelete, mask }: BudgetCardProps) {
  const { categories } = useFinance();
  const cat = categories.find(c => c.id === budget.categoryId);
  const Icon = getIcon(cat?.icon ?? 'circle');
  const overflow = spent - budget.amount;
  const isOver = pct >= 100;
  const isWarning = pct >= 80 && pct < 100;

  return (
    <Card className={cn('transition-all', isOver ? 'border-destructive/40' : isWarning ? 'border-amber-300' : '', compact && 'shadow-none border-0 bg-muted/30')}>
      <CardContent className={cn('space-y-3', compact ? 'pt-3 pb-3 px-4' : 'pt-4 pb-4')}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 rounded-lg shrink-0" style={{ backgroundColor: `${cat?.color}20` }}>
              <Icon className="w-4 h-4" style={{ color: cat?.color }} />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-sm leading-tight truncate">{budget.name}</p>
              <p className="text-xs text-muted-foreground truncate">
                {cat?.name ?? 'Categoria'} · {budget.recurrence === 'mensal' ? 'Mensal' : `Pontual (${budget.referenceMonth})`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {isOver && <Badge variant="destructive" className="text-xs">Estourado</Badge>}
            {isWarning && <Badge className="text-xs bg-amber-100 text-amber-800 border-amber-300">Atenção</Badge>}
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(budget)}>
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onDelete(budget.id)}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{mask(spent)} gastos</span>
            <span>limite: {mask(budget.amount)}</span>
          </div>
          <Progress value={Math.min(pct, 100)} className="h-2" indicatorClassName={progressColor(pct)} />
          <div className="flex justify-between items-center">
            <span className={cn('text-xs font-medium', isOver ? 'text-destructive' : isWarning ? 'text-amber-600' : 'text-emerald-600')}>
              {pct}% utilizado
            </span>
            {isOver
              ? <span className="text-xs text-destructive font-medium flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{mask(overflow)} acima</span>
              : <span className="text-xs text-muted-foreground">{mask(budget.amount - spent)} restantes</span>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export const Budgets = () => {
  const { budgets, budgetGroups, transactions, deleteBudget, deleteBudgetGroup } = useFinance();
  const { hideValues } = usePrivacy();

  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
  const [groupDialogOpen, setGroupDialogOpen]   = useState(false);
  const [editing, setEditing]       = useState<Budget | null>(null);
  const [editingGroup, setEditingGroup] = useState<BudgetGroup | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [addToBudgetGroupId, setAddToBudgetGroupId] = useState<string | undefined>();

  const now = new Date();
  const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const activeBudgets = useMemo(() => budgets.filter(b => b.active), [budgets]);

  const mask = (v: number) => hideValues ? 'R$ ••••••' : formatCurrency(v);

  // Compute spent per budget
  const budgetsWithSpent = useMemo(() => {
    return activeBudgets.map(budget => {
      let spent = 0;
      const month = budget.recurrence === 'mensal' ? currentMonthPrefix : (budget.referenceMonth ?? '');
      if (month) {
        spent = transactions
          .filter(t => t.type === 'expense' && t.categoryId === budget.categoryId && t.date.startsWith(month))
          .reduce((s, t) => s + t.amount, 0);
      }
      const pct = budget.amount > 0 ? Math.round((spent / budget.amount) * 100) : 0;
      return { budget, spent, pct };
    });
  }, [activeBudgets, transactions, currentMonthPrefix]);

  // Summary (mensal only)
  const mensalBudgetsWithSpent = useMemo(
    () => budgetsWithSpent.filter(({ budget }) => budget.recurrence === 'mensal'),
    [budgetsWithSpent],
  );
  const totalBudgeted = mensalBudgetsWithSpent.reduce((s, { budget }) => s + budget.amount, 0);
  const totalSpent    = mensalBudgetsWithSpent.reduce((s, { spent }) => s + spent, 0);
  const overallPct    = totalBudgeted > 0 ? Math.round((totalSpent / totalBudgeted) * 100) : 0;

  // Grouped / ungrouped split
  const groupedBudgetsMap = useMemo(() => {
    const map: Record<string, typeof budgetsWithSpent> = {};
    for (const bws of budgetsWithSpent) {
      if (bws.budget.groupId) {
        if (!map[bws.budget.groupId]) map[bws.budget.groupId] = [];
        map[bws.budget.groupId].push(bws);
      }
    }
    return map;
  }, [budgetsWithSpent]);

  const ungrouped = useMemo(() => budgetsWithSpent.filter(({ budget }) => !budget.groupId), [budgetsWithSpent]);

  const toggleGroup = (id: string) => {
    setExpandedGroups(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const handleDeleteBudget = async (id: string) => {
    if (!confirm('Excluir este orçamento?')) return;
    try { await deleteBudget(id); toast.success('Orçamento excluído'); }
    catch { toast.error('Erro ao excluir orçamento'); }
  };

  const handleDeleteGroup = async (group: BudgetGroup) => {
    const count = groupedBudgetsMap[group.id]?.length ?? 0;
    if (!confirm(`Excluir grupo "${group.name}"? Os ${count} orçamento${count !== 1 ? 's' : ''} dentro dele ficarão sem grupo.`)) return;
    try { await deleteBudgetGroup(group.id); toast.success('Grupo excluído'); }
    catch { toast.error('Erro ao excluir grupo'); }
  };

  const openNewBudget = (groupId?: string) => {
    setEditing(null);
    setAddToBudgetGroupId(groupId);
    setBudgetDialogOpen(true);
  };
  const openEditBudget = (b: Budget) => { setEditing(b); setAddToBudgetGroupId(undefined); setBudgetDialogOpen(true); };
  const openNewGroup   = () => { setEditingGroup(null); setGroupDialogOpen(true); };
  const openEditGroup  = (g: BudgetGroup) => { setEditingGroup(g); setGroupDialogOpen(true); };

  return (
    <div className="space-y-6 pb-20 md:pb-0">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Orçamentos</h1>
          <p className="text-muted-foreground">Defina limites de gasto por categoria e acompanhe o progresso.</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <Button variant="outline" onClick={openNewGroup} className="flex-1 md:flex-none">
            <Layers className="w-4 h-4 mr-2" /> Novo Grupo
          </Button>
          <Button onClick={() => openNewBudget()} className="flex-1 md:flex-none">
            <Plus className="w-4 h-4 mr-2" /> Novo Orçamento
          </Button>
        </div>
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

      {/* Empty state */}
      {activeBudgets.length === 0 && budgetGroups.length === 0 && (
        <Card>
          <CardContent className="py-16 flex flex-col items-center gap-3 text-center">
            <Target className="w-12 h-12 text-muted-foreground/40" />
            <p className="font-medium text-muted-foreground">Nenhum orçamento ainda</p>
            <p className="text-sm text-muted-foreground max-w-sm">
              Crie orçamentos por categoria para acompanhar quanto você está gastando.
              Use grupos para organizar categorias relacionadas (ex: "Casa").
            </p>
            <div className="flex gap-2 mt-2">
              <Button onClick={openNewGroup} variant="outline">
                <Layers className="w-4 h-4 mr-2" /> Criar grupo
              </Button>
              <Button onClick={() => openNewBudget()}>
                <Plus className="w-4 h-4 mr-2" /> Criar orçamento
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Groups */}
      {budgetGroups.length > 0 && (
        <div className="space-y-3">
          {budgetGroups.map(group => {
            const groupItems = groupedBudgetsMap[group.id] ?? [];
            const isExpanded = expandedGroups.has(group.id);

            // Aggregate spend for this group
            const groupTotalSpent  = groupItems.reduce((s, { spent }) => s + spent, 0);
            const groupTotalLimit  = group.totalLimit ?? groupItems.reduce((s, { budget }) => s + budget.amount, 0);
            const groupPct         = groupTotalLimit > 0 ? Math.round((groupTotalSpent / groupTotalLimit) * 100) : 0;
            const groupOver        = groupPct >= 100;
            const groupWarning     = groupPct >= 80 && groupPct < 100;

            return (
              <Card key={group.id} className={cn(
                'overflow-hidden transition-all',
                groupOver ? 'border-destructive/40' : groupWarning ? 'border-amber-300' : '',
              )}>
                {/* Group header row */}
                <button
                  className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-muted/30 transition-colors text-left"
                  onClick={() => toggleGroup(group.id)}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                    <Layers className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{group.name}</span>
                        <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{groupItems.length} orç.</Badge>
                        {groupOver && <Badge variant="destructive" className="text-[10px] h-4 px-1.5">Estourado</Badge>}
                        {groupWarning && <Badge className="text-[10px] h-4 px-1.5 bg-amber-100 text-amber-800 border-amber-300">Atenção</Badge>}
                      </div>
                      <div className="mt-1.5 space-y-0.5">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{mask(groupTotalSpent)} gastos</span>
                          <span>limite: {mask(groupTotalLimit)}</span>
                        </div>
                        <Progress value={Math.min(groupPct, 100)} className="h-1.5" indicatorClassName={progressColor(groupPct)} />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-4 shrink-0" onClick={e => e.stopPropagation()}>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditGroup(group)} title="Editar grupo">
                      <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDeleteGroup(group)} title="Excluir grupo">
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </div>
                </button>

                {/* Expanded: individual budgets in group */}
                {isExpanded && (
                  <div className="border-t divide-y divide-border/50">
                    {groupItems.length === 0 ? (
                      <div className="px-4 py-4 text-sm text-muted-foreground text-center">
                        Nenhum orçamento neste grupo.
                      </div>
                    ) : (
                      groupItems.map(({ budget, spent, pct }) => (
                        <div key={budget.id} className="px-4 py-3">
                          <BudgetCard
                            budget={budget} spent={spent} pct={pct} compact
                            onEdit={openEditBudget}
                            onDelete={handleDeleteBudget}
                            mask={mask}
                          />
                        </div>
                      ))
                    )}
                    <div className="px-4 py-2.5 bg-muted/20">
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openNewBudget(group.id)}>
                        <Plus className="w-3.5 h-3.5 mr-1.5" /> Adicionar orçamento a este grupo
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Ungrouped budgets */}
      {ungrouped.length > 0 && (
        <div className="space-y-3">
          {budgetGroups.length > 0 && (
            <p className="text-sm font-medium text-muted-foreground px-1">Sem grupo</p>
          )}
          {ungrouped.map(({ budget, spent, pct }) => (
            <BudgetCard
              key={budget.id}
              budget={budget} spent={spent} pct={pct}
              onEdit={openEditBudget}
              onDelete={handleDeleteBudget}
              mask={mask}
            />
          ))}
        </div>
      )}

      <BudgetDialog
        open={budgetDialogOpen}
        onOpenChange={setBudgetDialogOpen}
        budget={editing}
        defaultGroupId={addToBudgetGroupId}
      />
      <GroupDialog
        open={groupDialogOpen}
        onOpenChange={setGroupDialogOpen}
        group={editingGroup}
      />
    </div>
  );
};
