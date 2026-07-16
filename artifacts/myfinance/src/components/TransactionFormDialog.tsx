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
import { getIcon } from '@/components/IconMap';
import { toast } from 'sonner';
import { Transaction } from '@/data/mockData';
import { CreditCard, Info, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  purchaseType: z.enum(['avista', 'parcelado']).default('avista'),
  installments: z.coerce.number().min(2).max(24).default(2),
});

interface TransactionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: Transaction | null;
  defaultCardId?: string;
}

export const TransactionFormDialog = ({ open, onOpenChange, transaction, defaultCardId }: TransactionFormProps) => {
  const { categories, subcategories, cards, addTransaction, updateTransaction, addInstallments } = useFinance();

  const form = useForm<z.infer<typeof transactionSchema>>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      description: '', amount: 0, type: 'expense', categoryId: '',
      subcategoryId: '',
      date: new Date().toISOString().split('T')[0], status: 'paid',
      paymentMethod: defaultCardId ? 'cartao_credito' : 'dinheiro',
      cardId: defaultCardId ?? '',
      notes: '',
      purchaseType: 'avista',
      installments: 2,
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
          paymentMethod: isCard ? 'cartao_credito' : (transaction.paymentMethod || 'dinheiro'),
          cardId: transaction.cardId ?? '',
          notes: transaction.notes || '',
          purchaseType: 'avista',
          installments: 2,
        });
      } else {
        form.reset({
          description: '', amount: 0, type: 'expense', categoryId: '',
          subcategoryId: '',
          date: new Date().toISOString().split('T')[0], status: 'paid',
          paymentMethod: defaultCardId ? 'cartao_credito' : 'dinheiro',
          cardId: defaultCardId ?? '',
          notes: '',
          purchaseType: 'avista',
          installments: 2,
        });
      }
    }
  }, [open, transaction, defaultCardId, form]);

  const type = form.watch('type');
  const paymentMethod = form.watch('paymentMethod');
  const purchaseType = form.watch('purchaseType');
  const selectedCategoryId = form.watch('categoryId');
  const isCardPayment = type === 'expense' && paymentMethod === 'cartao_credito';
  const filteredCategories = categories.filter(c => c.type === type);
  const isNewInstallment = isCardPayment && !transaction && purchaseType === 'parcelado';

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
      } else if (isCardPayment && data.purchaseType === 'parcelado' && data.installments > 1) {
        await addInstallments(payload, data.installments);
        toast.success(`Compra parcelada em ${data.installments}x lançada com sucesso`);
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
              {/* ── Type toggle ── */}
              <FormField control={form.control} name="type" render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Tipo</FormLabel>
                  <div className="flex gap-2">
                    {/* Despesa button — destructive (red) when selected, outline when not */}
                    <button
                      type="button"
                      onClick={() => {
                        field.onChange('expense');
                        form.setValue('categoryId', '');
                        form.setValue('subcategoryId', '');
                      }}
                      className={cn(
                        'flex-1 h-9 px-3 rounded-md border text-sm font-medium transition-colors',
                        field.value === 'expense'
                          ? 'bg-destructive text-destructive-foreground border-destructive hover:bg-destructive/90'
                          : 'bg-background text-foreground border-input hover:bg-muted',
                      )}
                    >
                      Despesa
                    </button>

                    {/* Receita button — green when selected, outline when not */}
                    <button
                      type="button"
                      onClick={() => {
                        field.onChange('income');
                        form.setValue('categoryId', '');
                        form.setValue('subcategoryId', '');
                        form.setValue('paymentMethod', 'dinheiro');
                      }}
                      className={cn(
                        'flex-1 h-9 px-3 rounded-md border text-sm font-medium transition-colors',
                        field.value === 'income'
                          ? 'bg-green-500 text-white border-green-500 hover:bg-green-600'
                          : 'bg-background text-foreground border-input hover:bg-muted',
                      )}
                    >
                      Receita
                    </button>
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
                  <FormLabel>
                    {isNewInstallment ? 'Valor total (R$)' : 'Valor (R$)'}
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      {...field}
                      value={field.value === 0 ? '' : field.value}
                      onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Date */}
              <FormField control={form.control} name="date" render={({ field }) => (
                <FormItem>
                  <FormLabel>Data da compra</FormLabel>
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

              {/* Subcategory — animated, only when a category with subcategories is selected */}
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
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Payment method — only for expenses */}
              {type === 'expense' && (
                <FormField control={form.control} name="paymentMethod" render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Forma de pagamento</FormLabel>
                    <Select onValueChange={(v) => {
                      field.onChange(v);
                      if (v !== 'cartao_credito') { form.setValue('cardId', ''); form.setValue('purchaseType', 'avista'); }
                    }} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {/* Legacy value — displayed only when editing old transactions */}
                        {field.value === 'dinheiro_pix_debito' && (
                          <SelectItem value="dinheiro_pix_debito">Dinheiro / PIX / Débito (legado)</SelectItem>
                        )}
                        <SelectItem value="dinheiro">Dinheiro</SelectItem>
                        <SelectItem value="pix">PIX</SelectItem>
                        <SelectItem value="debito">Débito</SelectItem>
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

              {/* Purchase type — only for new card transactions */}
              {isCardPayment && !transaction && (
                <FormField control={form.control} name="purchaseType" render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Tipo de compra</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="avista">À vista</SelectItem>
                        <SelectItem value="parcelado">Parcelado</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              )}

              {/* Installment count — only when parcelado */}
              {isCardPayment && !transaction && purchaseType === 'parcelado' && (
                <FormField control={form.control} name="installments" render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Número de parcelas</FormLabel>
                    <Select onValueChange={(v) => field.onChange(Number(v))} value={String(field.value)}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {Array.from({ length: 23 }, (_, i) => i + 2).map(n => (
                          <SelectItem key={n} value={String(n)}>{n}x</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              )}

              {/* Notice when editing an installment transaction */}
              {transaction?.installmentGroupId && (
                <div className="col-span-2 flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                  <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>
                    Parcela <strong>{transaction.installmentNumber}/{transaction.installmentTotal}</strong> de uma compra parcelada.
                    A edição afeta apenas esta parcela.
                  </span>
                </div>
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
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={form.formState.isSubmitting}>Cancelar</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isNewInstallment ? 'Lançar parcelado' : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
