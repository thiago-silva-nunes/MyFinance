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
import { BankAccount } from '@/data/mockData';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Schema ───────────────────────────────────────────────────────────────────

const bankSchema = z.object({
  name:           z.string().min(1, 'Nome é obrigatório'),
  type:           z.enum(['corrente', 'poupança', 'investimento']),
  initialBalance: z.coerce.number().default(0),
  color:          z.string().min(4, 'Cor é obrigatória'),
  icon:           z.string().min(1, 'Ícone é obrigatório'),
});

type BankFormData = z.infer<typeof bankSchema>;

// ─── Constants ────────────────────────────────────────────────────────────────

const BANK_COLORS = [
  '#6366f1', '#3b82f6', '#0ea5e9', '#06b6d4', '#14b8a6',
  '#22c55e', '#10b981', '#84cc16', '#eab308', '#f97316',
  '#ef4444', '#ec4899', '#8b5cf6', '#a855f7', '#64748b',
];

const BANK_ICONS = [
  { value: 'building-2',   label: 'Banco' },
  { value: 'landmark',     label: 'Instituição' },
  { value: 'piggy-bank',   label: 'Poupança' },
  { value: 'briefcase',    label: 'Trabalho' },
  { value: 'trending-up',  label: 'Investimento' },
  { value: 'wallet',       label: 'Carteira' },
  { value: 'credit-card',  label: 'Cartão' },
  { value: 'coins',        label: 'Dinheiro' },
];

const ACCOUNT_TYPES = [
  { value: 'corrente',     label: 'Conta Corrente' },
  { value: 'poupança',     label: 'Poupança' },
  { value: 'investimento', label: 'Investimento' },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface BankFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bank?: BankAccount | null;
}

export const BankFormDialog = ({ open, onOpenChange, bank }: BankFormDialogProps) => {
  const { addBank, updateBank } = useFinance();

  const form = useForm<BankFormData>({
    resolver: zodResolver(bankSchema),
    defaultValues: {
      name: '', type: 'corrente', initialBalance: 0, color: '#6366f1', icon: 'building-2',
    },
  });

  React.useEffect(() => {
    if (open) {
      if (bank) {
        form.reset({
          name: bank.name,
          type: bank.type,
          initialBalance: bank.initialBalance,
          color: bank.color,
          icon: bank.icon,
        });
      } else {
        form.reset({ name: '', type: 'corrente', initialBalance: 0, color: '#6366f1', icon: 'building-2' });
      }
    }
  }, [open, bank, form]);

  const onSubmit = async (data: BankFormData) => {
    try {
      if (bank) {
        await updateBank(bank.id, data);
        toast.success('Banco atualizado');
      } else {
        await addBank(data);
        toast.success('Banco criado');
      }
      onOpenChange(false);
    } catch {
      toast.error('Erro ao salvar banco');
    }
  };

  const currentColor = form.watch('color');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>{bank ? 'Editar Banco / Conta' : 'Novo Banco / Conta'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

            {/* Name */}
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Nome</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: Nubank, Bradesco Corrente..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {/* Type */}
            <FormField control={form.control} name="type" render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo de conta</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {ACCOUNT_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            {/* Initial Balance */}
            <FormField control={form.control} name="initialBalance" render={({ field }) => (
              <FormItem>
                <FormLabel>Saldo inicial (R$)</FormLabel>
                <FormControl>
                  <Input
                    type="number" step="0.01" placeholder="0.00"
                    {...field}
                    value={field.value === 0 ? '' : field.value}
                    onChange={e => field.onChange(e.target.valueAsNumber || 0)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {/* Color */}
            <FormField control={form.control} name="color" render={({ field }) => (
              <FormItem>
                <FormLabel>Cor</FormLabel>
                <div className="flex flex-wrap gap-2">
                  {BANK_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      className={cn(
                        'w-7 h-7 rounded-full border-2 transition-all',
                        field.value === c ? 'border-foreground scale-110' : 'border-transparent',
                      )}
                      style={{ backgroundColor: c }}
                      onClick={() => field.onChange(c)}
                    />
                  ))}
                  {/* Custom color input */}
                  <input
                    type="color"
                    value={currentColor}
                    onChange={e => field.onChange(e.target.value)}
                    className="w-7 h-7 rounded-full cursor-pointer border-2 border-border"
                    title="Cor personalizada"
                  />
                </div>
                <FormMessage />
              </FormItem>
            )} />

            {/* Icon */}
            <FormField control={form.control} name="icon" render={({ field }) => (
              <FormItem>
                <FormLabel>Ícone</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {BANK_ICONS.map(icon => (
                      <SelectItem key={icon.value} value={icon.value}>{icon.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {bank ? 'Salvar' : 'Criar'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
