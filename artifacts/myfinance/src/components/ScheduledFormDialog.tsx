import React from 'react';
import { useFinance } from '@/context/FinanceContext';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { getIcon } from '@/components/IconMap';
import { toast } from 'sonner';
import { ScheduledTransaction } from '@/data/mockData';

const scheduledSchema = z.object({
  description: z.string().min(1, 'Descrição é obrigatória'),
  amount: z.coerce.number().min(0.01, 'Valor deve ser maior que zero'),
  type: z.enum(['income', 'expense']),
  categoryId: z.string().min(1, 'Categoria é obrigatória'),
  startDate: z.string().min(1, 'Data de início é obrigatória'),
  endDate: z.string().optional(),
  frequency: z.enum(['once', 'daily', 'weekly', 'monthly', 'yearly']),
  active: z.boolean()
});

interface ScheduledFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scheduled?: ScheduledTransaction | null;
}

export const ScheduledFormDialog = ({ open, onOpenChange, scheduled }: ScheduledFormProps) => {
  const { categories, addScheduled, updateScheduled } = useFinance();
  
  const form = useForm<z.infer<typeof scheduledSchema>>({
    resolver: zodResolver(scheduledSchema),
    defaultValues: {
      description: '',
      amount: 0,
      type: 'expense',
      categoryId: '',
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
      frequency: 'monthly',
      active: true
    }
  });

  React.useEffect(() => {
    if (open) {
      if (scheduled) {
        form.reset({
          description: scheduled.description,
          amount: scheduled.amount,
          type: scheduled.type,
          categoryId: scheduled.categoryId,
          startDate: scheduled.startDate.split('T')[0],
          endDate: scheduled.endDate ? scheduled.endDate.split('T')[0] : '',
          frequency: scheduled.frequency,
          active: scheduled.active
        });
      } else {
        form.reset({
          description: '',
          amount: 0,
          type: 'expense',
          categoryId: '',
          startDate: new Date().toISOString().split('T')[0],
          endDate: '',
          frequency: 'monthly',
          active: true
        });
      }
    }
  }, [open, scheduled, form]);

  const type = form.watch('type');
  const filteredCategories = categories.filter(c => c.type === type);

  const onSubmit = async (data: z.infer<typeof scheduledSchema>) => {
    try {
      const payload = {
        ...data,
        startDate: data.startDate,
        endDate: data.endDate || undefined,
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
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{scheduled ? 'Editar Recorrência' : 'Nova Recorrência'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
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
                        }}
                      >
                        Receita
                      </Button>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Descrição</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Aluguel" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor (R$)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" min="0" placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="frequency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Frequência</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
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
                )}
              />

              <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Categoria</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma categoria" />
                        </SelectTrigger>
                      </FormControl>
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
                )}
              />

              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data Início</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data Fim (Opcional)</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 col-span-2">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Ativo</FormLabel>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit">Salvar</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};