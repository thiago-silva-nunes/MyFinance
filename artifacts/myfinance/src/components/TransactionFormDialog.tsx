import React, { useState } from 'react';
import { useFinance } from '@/context/FinanceContext';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getIcon } from '@/components/IconMap';
import { toast } from 'sonner';
import { Transaction } from '@/data/mockData';

const transactionSchema = z.object({
  description: z.string().min(1, 'Descrição é obrigatória'),
  amount: z.coerce.number().min(0.01, 'Valor deve ser maior que zero'),
  type: z.enum(['income', 'expense']),
  categoryId: z.string().min(1, 'Categoria é obrigatória'),
  date: z.string().min(1, 'Data é obrigatória'),
  status: z.enum(['paid', 'pending']),
  notes: z.string().optional()
});

interface TransactionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: Transaction | null;
}

export const TransactionFormDialog = ({ open, onOpenChange, transaction }: TransactionFormProps) => {
  const { categories, addTransaction, updateTransaction } = useFinance();
  
  const form = useForm<z.infer<typeof transactionSchema>>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      description: '',
      amount: 0,
      type: 'expense',
      categoryId: '',
      date: new Date().toISOString().split('T')[0],
      status: 'paid',
      notes: ''
    }
  });

  // Reset form when opened with new transaction
  React.useEffect(() => {
    if (open) {
      if (transaction) {
        form.reset({
          description: transaction.description,
          amount: transaction.amount,
          type: transaction.type,
          categoryId: transaction.categoryId,
          date: transaction.date.split('T')[0],
          status: transaction.status,
          notes: transaction.notes || ''
        });
      } else {
        form.reset({
          description: '',
          amount: 0,
          type: 'expense',
          categoryId: '',
          date: new Date().toISOString().split('T')[0],
          status: 'paid',
          notes: ''
        });
      }
    }
  }, [open, transaction, form]);

  const type = form.watch('type');
  const filteredCategories = categories.filter(c => c.type === type);

  const onSubmit = async (data: z.infer<typeof transactionSchema>) => {
    try {
      const payload = { ...data, date: data.date };
      if (transaction) {
        await updateTransaction(transaction.id, payload);
        toast.success('Transação atualizada com sucesso');
      } else {
        await addTransaction(payload);
        toast.success('Transação adicionada com sucesso');
      }
      onOpenChange(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar transação');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{transaction ? 'Editar Transação' : 'Nova Transação'}</DialogTitle>
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
                        className="w-full bg-success text-success-foreground hover:bg-success/90"
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
                      <Input placeholder="Ex: Mercado" {...field} />
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
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
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
                name="status"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="paid">Pago / Recebido</SelectItem>
                        <SelectItem value="pending">Pendente</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
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