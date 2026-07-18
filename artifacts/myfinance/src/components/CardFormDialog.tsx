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
import { toast } from 'sonner';
import { CreditCard } from '@/data/mockData';
import { CurrencyInput } from '@/components/ui/currency-input';

const BRAND_OPTIONS = [
  { value: 'visa', label: 'Visa' },
  { value: 'mastercard', label: 'Mastercard' },
  { value: 'elo', label: 'Elo' },
  { value: 'amex', label: 'American Express' },
  { value: 'other', label: 'Outra' },
] as const;

const AVAILABLE_COLORS = [
  '#1e40af', '#7c3aed', '#be185d', '#b91c1c',
  '#047857', '#0369a1', '#92400e', '#374151',
  '#0f766e', '#9333ea', '#c2410c', '#166534',
];

const cardSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  bank: z.string().min(1, 'Banco é obrigatório'),
  brand: z.enum(['visa', 'mastercard', 'elo', 'amex', 'other']),
  limit: z.coerce.number().min(1, 'Limite deve ser maior que zero'),
  closingDay: z.coerce.number().min(1).max(31),
  dueDay: z.coerce.number().min(1).max(31),
  color: z.string().min(4),
});

interface CardFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card?: CreditCard | null;
}

export const CardFormDialog = ({ open, onOpenChange, card }: CardFormProps) => {
  const { addCard, updateCard } = useFinance();

  const form = useForm<z.infer<typeof cardSchema>>({
    resolver: zodResolver(cardSchema),
    defaultValues: { name: '', bank: '', brand: 'visa', limit: 0, closingDay: 10, dueDay: 5, color: '#1e40af' },
  });

  React.useEffect(() => {
    if (open) {
      if (card) {
        form.reset({ name: card.name, bank: card.bank, brand: card.brand, limit: card.limit, closingDay: card.closingDay, dueDay: card.dueDay, color: card.color });
      } else {
        form.reset({ name: '', bank: '', brand: 'visa', limit: 0, closingDay: 10, dueDay: 5, color: '#1e40af' });
      }
    }
  }, [open, card, form]);

  const onSubmit = async (data: z.infer<typeof cardSchema>) => {
    try {
      if (card) {
        await updateCard(card.id, data);
        toast.success('Cartão atualizado com sucesso');
      } else {
        await addCard(data);
        toast.success('Cartão adicionado com sucesso');
      }
      onOpenChange(false);
    } catch (err: unknown) {
      const { extractErrorMessage } = await import('@/services/dataService');
      toast.error(`Erro ao salvar cartão: ${extractErrorMessage(err)}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{card ? 'Editar Cartão' : 'Novo Cartão de Crédito'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Apelido do cartão</FormLabel>
                  <FormControl><Input placeholder="Ex: Nubank Gold" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="bank" render={({ field }) => (
                <FormItem>
                  <FormLabel>Banco emissor</FormLabel>
                  <FormControl><Input placeholder="Ex: Nubank" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="brand" render={({ field }) => (
                <FormItem>
                  <FormLabel>Bandeira</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {BRAND_OPTIONS.map(b => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="limit" render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Limite total (R$)</FormLabel>
                  <FormControl>
                    <CurrencyInput value={field.value} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="closingDay" render={({ field }) => (
                <FormItem>
                  <FormLabel>Dia de fechamento</FormLabel>
                  <FormControl><Input type="number" min="1" max="31" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="dueDay" render={({ field }) => (
                <FormItem>
                  <FormLabel>Dia de vencimento</FormLabel>
                  <FormControl><Input type="number" min="1" max="31" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="color" render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Cor do cartão</FormLabel>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {AVAILABLE_COLORS.map(color => (
                      <button key={color} type="button"
                        className={`w-7 h-7 rounded-full transition-transform ${field.value === color ? 'scale-125 ring-2 ring-ring ring-offset-2' : 'hover:scale-110'}`}
                        style={{ backgroundColor: color }}
                        onClick={() => field.onChange(color)}
                      />
                    ))}
                  </div>
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
