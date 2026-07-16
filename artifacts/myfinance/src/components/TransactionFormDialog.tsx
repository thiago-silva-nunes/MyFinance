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
import { getIcon } from '@/components/IconMap';
import { toast } from 'sonner';
import { Transaction } from '@/data/mockData';
import { CreditCard } from 'lucide-react';

const transactionSchema = z.object({
  description: z.string().min(1, 'Descrição é obrigatória'),
  amount: z.coerce.number().min(0.01, 'Valor deve ser maior que zero'),
  type: z.enum(['income', 'expense']),
  categoryId: z.string().min(1, 'Categoria é obrigatória'),
  subcategoryId: z.string().optional(),
  date: z.string().min(1, 'Data é obrigatória'),
  status: z.enum(['paid', 'pending']),
  paymentMethod: z.string().optional(),
  cardId: z.string().optional(),
  notes: z.string().optional(),
});

interface TransactionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: Transaction | null;
  defaultCardId?: string;
}

export const TransactionFormDialog = ({ open, onOpenChange, transaction, defaultCardId }: TransactionFormProps) => {
  const { categories, subcategories, cards, addTransaction, updateTransaction } = useFinance();

  const form = useForm<z.infer<typeof transactionSchema>>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      description: '', amount: 0, type: 'expense', categoryId: '',
      subcategoryId: '',
      date: new Date().toISOString().split('T')[0], status: 'paid',
      paymentMethod: defaultCardId ? 'cartao_credito' : 'dinheiro_pix_debito',
      cardId: defaultCardId ?? '',
      notes: '',
    },
  });

  React.useEffect(() => {
    if (open) {
      if (transaction) {
        const isCard = !!transaction.cardId;
        form.reset({
          description: transaction.description, amount: transaction.amount,
          type: transaction.type, categoryId: transaction.categoryId,
          subcategoryId: transaction.subcategoryId ?? '',
          date: transaction.date.split('T')[0], status: transaction.status,
          paymentMethod: isCard ? 'cartao_credito' : (transaction.paymentMethod || 'dinheiro_pix_debito'),
          cardId: transaction.cardId ?? '',
          notes: transaction.notes || '',
        });
      } else {
        form.reset({
          description: '', amount: 0, type: 'expense', categoryId: '',
          subcategoryId: '',
          date: new Date().toISOString().split('T')[0], status: 'paid',
          paymentMethod: defaultCardId ? 'cartao_credito' : 'dinheiro_pix_debito',
          cardId: defaultCardId ?? '',
          notes: '',
        });
      }
    }
  }, [open, transaction, defaultCardId, form]);

  const type = form.watch('type');
  const paymentMethod = form.watch('paymentMethod');
  const selectedCategoryId = form.watch('categoryId');
  const isCardPayment = type === 'expense' && paymentMethod === 'cartao_credito';
  const filteredCategories = categories.filter(c => c.type === type);

  // Subcategories belonging to the selected category
  const availableSubcategories = selectedCategoryId
    ? subcategories.filter(s => s.categoryId === selectedCategoryId)
    : [];

  const onSubmit = async (data: z.infer<typeof transactionSchema>) => {
    try {
      const cardId = isCardPayment && data.cardId ? data.cardId : undefined;
      const subcategoryId = data.subcategoryId && data.subcategoryId !== '' ? data.subcategoryId : undefined;
      const payload: Omit<Transaction, 'id'> = {
        description: data.description, amount: data.amount, type: data.type,
        categoryId: data.categoryId,
        subcategoryId,
        date: data.date, status: data.status,
        paymentMethod: data.paymentMethod || undefined,
        cardId, notes: data.notes || undefined,
      };
      if (transaction) {
        await updateTransaction(transaction.id, { ...payload, cardId: cardId ?? null as unknown as undefined });
        toast.success('Transação atualizada com sucesso');
      } else {
        await addTransaction(payload);
        toast.success('Transação adicionada com sucesso');
      }
      onOpenChange(false);
    } catch (err: unknown) {
      const { extractErrorMessage } = await import('@/services/dataService');
      toast.error(`Erro ao salvar transação: ${extractErrorMessage(err)}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{transaction ? 'Editar Transação' : 'Nova Transação'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Type toggle */}
              <FormField control={form.control} name="type" render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Tipo</FormLabel>
                  <div className="flex gap-2">
                    <Button type="button" variant={field.value === 'expense' ? 'destructive' : 'outline'}
                      className="w-full" onClick={() => { field.onChange('expense'); form.setValue('categoryId', ''); form.setValue('subcategoryId', ''); }}>
                      Despesa
                    </Button>
                    <Button type="button" variant={field.value === 'income' ? 'default' : 'outline'}
                      className="w-full bg-success text-success-foreground hover:bg-success/90"
                      onClick={() => { field.onChange('income'); form.setValue('categoryId', ''); form.setValue('subcategoryId', ''); form.setValue('paymentMethod', 'dinheiro_pix_debito'); }}>
                      Receita
                    </Button>
                  </div>
                </FormItem>
              )} />

              {/* Description */}
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Descrição</FormLabel>
                  <FormControl><Input placeholder="Ex: Mercado" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Amount */}
              <FormField control={form.control} name="amount" render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor (R$)</FormLabel>
                  <FormControl><Input type="number" step="0.01" min="0" placeholder="0.00" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Date */}
              <FormField control={form.control} name="date" render={({ field }) => (
                <FormItem>
                  <FormLabel>Data</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Category */}
              <FormField control={form.control} name="categoryId" render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Categoria</FormLabel>
                  <Select onValueChange={(v) => { field.onChange(v); form.setValue('subcategoryId', ''); }} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecione uma categoria" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {filteredCategories.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                          Nenhuma categoria cadastrada para este tipo.
                        </div>
                      ) : (
                        filteredCategories.map((cat) => {
                          const Icon = getIcon(cat.icon);
                          return (
                            <SelectItem key={cat.id} value={cat.id}>
                              <div className="flex items-center gap-2">
                                <Icon className="w-4 h-4" style={{ color: cat.color }} />
                                {cat.name}
                              </div>
                            </SelectItem>
                          );
                        })
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Subcategory — only when a category with subcategories is selected */}
              {availableSubcategories.length > 0 && (
                <FormField control={form.control} name="subcategoryId" render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Subcategoria <span className="text-muted-foreground font-normal">(opcional)</span></FormLabel>
                    <Select
                        onValueChange={(v) => field.onChange(v === '__none__' ? '' : v)}
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
              )}

              {/* Payment method — only for expenses */}
              {type === 'expense' && (
                <FormField control={form.control} name="paymentMethod" render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Forma de pagamento</FormLabel>
                    <Select onValueChange={(v) => { field.onChange(v); if (v !== 'cartao_credito') form.setValue('cardId', ''); }}
                      value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="dinheiro_pix_debito">Dinheiro / PIX / Débito</SelectItem>
                        <SelectItem value="cartao_credito">
                          <div className="flex items-center gap-2"><CreditCard className="w-4 h-4" /> Cartão de Crédito</div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              )}

              {/* Card selector — only when credit card is selected */}
              {isCardPayment && (
                <FormField control={form.control} name="cardId" render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Cartão</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={cards.length === 0 ? 'Nenhum cartão cadastrado' : 'Selecione o cartão'} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {cards.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            <div className="flex items-center gap-2">
                              <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: c.color }} />
                              {c.name} — {c.bank}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              )}

              {/* Status */}
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="paid">Pago / Recebido</SelectItem>
                      <SelectItem value="pending">Pendente</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit">Salvar</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
