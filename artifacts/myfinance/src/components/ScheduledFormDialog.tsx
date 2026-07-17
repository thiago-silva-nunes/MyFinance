import React from 'react';
import { useFinance } from '@/context/FinanceContext';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { AnimatePresence, motion } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { getIcon } from '@/components/IconMap';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { ScheduledTransaction } from '@/data/mockData';
import { DRE_GROUP_OPTIONS, DRE_GROUP_LABEL } from '@/services/dataService';

const scheduledSchema = z.object({
  description: z.string().min(1, 'Descrição é obrigatória'),
  amount: z.coerce.number().min(0.01, 'Valor deve ser maior que zero'),
  type: z.enum(['income', 'expense']),
  categoryId: z.string().min(1, 'Categoria é obrigatória'),
  subcategoryId: z.string().optional(),
  bankId: z.string().optional(),
  startDate: z.string().min(1, 'Data de início é obrigatória'),
  endDate: z.string().optional(),
  frequency: z.enum(['once', 'daily', 'weekly', 'monthly', 'yearly']),
  active: z.boolean(),
  dreGroupOverride: z.string().optional(),
});

type FormValues = z.infer<typeof scheduledSchema>;

interface ScheduledFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scheduled?: ScheduledTransaction | null;
}

export const ScheduledFormDialog = ({ open, onOpenChange, scheduled }: ScheduledFormProps) => {
  const { categories, subcategories, banks, addScheduled, updateScheduled } = useFinance();

  const form = useForm<FormValues>({
    resolver: zodResolver(scheduledSchema),
    defaultValues: {
      description: '',
      amount: 0,
      type: 'expense',
      categoryId: '',
      subcategoryId: '',
      bankId: '',
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
      frequency: 'monthly',
      active: true,
      dreGroupOverride: '',
    },
  });

  React.useEffect(() => {
    if (open) {
      if (scheduled) {
        form.reset({
          description: scheduled.description,
          amount: scheduled.amount,
          type: scheduled.type,
          categoryId: scheduled.categoryId,
          subcategoryId: scheduled.subcategoryId ?? '',
          bankId: scheduled.bankId ?? '',
          startDate: scheduled.startDate.split('T')[0],
          endDate: scheduled.endDate ? scheduled.endDate.split('T')[0] : '',
          frequency: scheduled.frequency,
          active: scheduled.active,
          dreGroupOverride: scheduled.dreGroupOverride ?? '',
        });
      } else {
        form.reset({
          description: '',
          amount: 0,
          type: 'expense',
          categoryId: '',
          subcategoryId: '',
          bankId: '',
          startDate: new Date().toISOString().split('T')[0],
          endDate: '',
          frequency: 'monthly',
          active: true,
          dreGroupOverride: '',
        });
      }
    }
  }, [open, scheduled, form]);

  const type = form.watch('type');
  const selectedCategoryId = form.watch('categoryId');
  const dreGroupOverride = form.watch('dreGroupOverride');

  const filteredCategories = categories.filter(c => c.type === type);

  const availableSubcategories = selectedCategoryId
    ? subcategories.filter(s => s.categoryId === selectedCategoryId)
    : [];

  // Compute the inherited DRE group (from category/subcategory hierarchy)
  const selectedSubcategoryId = form.watch('subcategoryId');
  const selectedCategory = categories.find(c => c.id === selectedCategoryId);
  const selectedSubcategory = subcategories.find(s => s.id === selectedSubcategoryId);
  const inheritedDreGroup =
    selectedSubcategory?.dreGroup ??
    selectedCategory?.dreGroup ??
    (type === 'income' ? 'receita' : 'despesa_variavel');

  const isOverriding = !!(dreGroupOverride && dreGroupOverride !== '' && dreGroupOverride !== '__inherited__');
  const dreHelperText = isOverriding
    ? 'Personalizado para esta recorrência'
    : `Herdado de ${selectedSubcategory ? `${selectedSubcategory.name} (${selectedCategory?.name ?? ''})` : (selectedCategory?.name ?? 'Categoria')}`;

  const onSubmit = async (data: FormValues) => {
    try {
      const subcategoryId = data.subcategoryId && data.subcategoryId !== '' ? data.subcategoryId : undefined;
      const bankId = data.bankId && data.bankId !== '__none__' && data.bankId !== '' ? data.bankId : undefined;
      const dreGroupOverrideVal = data.dreGroupOverride && data.dreGroupOverride !== '' && data.dreGroupOverride !== '__inherited__'
        ? data.dreGroupOverride
        : undefined;

      const payload = {
        description: data.description,
        amount: data.amount,
        type: data.type,
        categoryId: data.categoryId,
        subcategoryId,
        bankId,
        startDate: data.startDate,
        endDate: data.endDate || undefined,
        frequency: data.frequency,
        active: data.active,
        dreGroupOverride: dreGroupOverrideVal,
      };

      if (scheduled) {
        await updateScheduled(scheduled.id, payload);
        toast.success('Transação recorrente atualizada');
      } else {
        await addScheduled(payload);
        toast.success('Transação recorrente adicionada');
      }
      onOpenChange(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar recorrência');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{scheduled ? 'Editar Recorrência' : 'Nova Recorrência'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">

              {/* ── Type toggle ── */}
              <FormField control={form.control} name="type" render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Tipo</FormLabel>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={field.value === 'expense' ? 'destructive' : 'outline'}
                      className="w-full"
                      onClick={() => {
                        field.onChange('expense');
                        form.setValue('categoryId', '');
                        form.setValue('subcategoryId', '');
                        form.setValue('dreGroupOverride', '');
                      }}
                    >
                      Despesa
                    </Button>
                    <Button
                      type="button"
                      variant={field.value === 'income' ? 'default' : 'outline'}
                      className={`w-full ${field.value === 'income' ? 'bg-success text-success-foreground hover:bg-success/90' : ''}`}
                      onClick={() => {
                        field.onChange('income');
                        form.setValue('categoryId', '');
                        form.setValue('subcategoryId', '');
                        form.setValue('dreGroupOverride', '');
                      }}
                    >
                      Receita
                    </Button>
                  </div>
                </FormItem>
              )} />

              {/* Description */}
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Descrição</FormLabel>
                  <FormControl><Input placeholder="Ex: Aluguel" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Amount + Frequency */}
              <FormField control={form.control} name="amount" render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor (R$)</FormLabel>
                  <FormControl>
                    <Input
                      type="number" step="0.01" min="0" placeholder="0.00"
                      {...field}
                      value={field.value === 0 ? '' : field.value}
                      onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="frequency" render={({ field }) => (
                <FormItem>
                  <FormLabel>Frequência</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="daily">Diário</SelectItem>
                      <SelectItem value="weekly">Semanal</SelectItem>
                      <SelectItem value="monthly">Mensal</SelectItem>
                      <SelectItem value="yearly">Anual</SelectItem>
                      <SelectItem value="once">Uma vez</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Category */}
              <FormField control={form.control} name="categoryId" render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Categoria</FormLabel>
                  <Select
                    onValueChange={(v) => {
                      field.onChange(v);
                      form.setValue('subcategoryId', '');
                      form.setValue('dreGroupOverride', ''); // reset override when category changes
                    }}
                    value={field.value}
                  >
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecione uma categoria" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {filteredCategories.map((cat) => {
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

              {/* Subcategory — animated, appears only when category has subcategories */}
              <AnimatePresence>
                {availableSubcategories.length > 0 && (
                  <motion.div
                    key="subcategory-field"
                    className="col-span-2"
                    initial={{ opacity: 0, y: -6, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, y: -6, height: 0 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                    style={{ overflow: 'hidden' }}
                  >
                    <FormField control={form.control} name="subcategoryId" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subcategoria <span className="text-muted-foreground font-normal">(opcional)</span></FormLabel>
                        <Select
                          onValueChange={(v) => {
                            field.onChange(v === '__none__' ? '' : v);
                            form.setValue('dreGroupOverride', ''); // reset override when subcategory changes
                          }}
                          value={field.value && field.value !== '' ? field.value : '__none__'}
                        >
                          <FormControl><SelectTrigger><SelectValue placeholder="Selecione uma subcategoria" /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="__none__">— Nenhuma —</SelectItem>
                            {availableSubcategories.map((sub) => (
                              <SelectItem key={sub.id} value={sub.id}>{sub.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Bank Account — optional, always visible when banks exist */}
              {banks.length > 0 && (
                <FormField control={form.control} name="bankId" render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Conta bancária <span className="text-muted-foreground font-normal">(opcional)</span></FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(v === '__none__' ? '' : v)}
                      value={field.value && field.value !== '' ? field.value : '__none__'}
                    >
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecione a conta" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">— Nenhuma —</SelectItem>
                        {banks.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ backgroundColor: b.color }} />
                              {b.name}
                              <span className="text-muted-foreground text-xs">({b.type})</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              )}

              {/* Start Date + End Date */}
              <FormField control={form.control} name="startDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Data Início</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="endDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Data Fim <span className="text-muted-foreground font-normal">(opcional)</span></FormLabel>
                  <FormControl><Input type="date" {...field} value={field.value || ''} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* DRE Classification — with smart pre-fill and helper text */}
              {selectedCategoryId && (
                <FormField control={form.control} name="dreGroupOverride" render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Classificação no DRE</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(v === '__inherited__' ? '' : v)}
                      value={field.value && field.value !== '' ? field.value : '__inherited__'}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue>
                            {isOverriding
                              ? DRE_GROUP_LABEL[dreGroupOverride ?? ''] ?? dreGroupOverride
                              : `${DRE_GROUP_LABEL[inheritedDreGroup] ?? inheritedDreGroup} (herdado)`}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__inherited__">
                          {DRE_GROUP_LABEL[inheritedDreGroup] ?? inheritedDreGroup} (herdado)
                        </SelectItem>
                        {DRE_GROUP_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className={`text-xs mt-1 ${isOverriding ? 'text-amber-600' : 'text-muted-foreground'}`}>
                      {dreHelperText}
                    </p>
                    <FormMessage />
                  </FormItem>
                )} />
              )}

              {/* Active toggle */}
              <FormField control={form.control} name="active" render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 col-span-2">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Ativo</FormLabel>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )} />
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={form.formState.isSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
