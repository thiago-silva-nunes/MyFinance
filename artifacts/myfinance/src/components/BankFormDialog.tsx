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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { toast } from 'sonner';
import { BankAccount } from '@/data/mockData';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Loader2, ChevronsUpDown, Check } from 'lucide-react';
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

/** Top 20 bancos mais usados no Brasil — nome + cor de marca aproximada (sem logos) */
const POPULAR_BANKS: { name: string; color: string }[] = [
  { name: 'Banco do Brasil',        color: '#FFDD00' },
  { name: 'Itaú Unibanco',          color: '#EC7000' },
  { name: 'Bradesco',               color: '#CC092F' },
  { name: 'Caixa Econômica Federal',color: '#0070AF' },
  { name: 'Santander',              color: '#EC0000' },
  { name: 'Nubank',                 color: '#8A05BE' },
  { name: 'Inter',                  color: '#FF8700' },
  { name: 'C6 Bank',                color: '#2D2D2D' },
  { name: 'BTG Pactual',            color: '#00205B' },
  { name: 'Banco Original',         color: '#007B40' },
  { name: 'Sicoob',                 color: '#005CA9' },
  { name: 'Sicredi',                color: '#00813D' },
  { name: 'Safra',                  color: '#1D3557' },
  { name: 'Banco Votorantim',       color: '#003399' },
  { name: 'Neon',                   color: '#00E5CE' },
  { name: 'PagBank',                color: '#F5A623' },
  { name: 'Mercado Pago',           color: '#009EE3' },
  { name: 'Next',                   color: '#00C851' },
  { name: 'Banco Pan',              color: '#0066CC' },
  { name: 'Banco XP',               color: '#111827' },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface BankFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bank?: BankAccount | null;
}

export const BankFormDialog = ({ open, onOpenChange, bank }: BankFormDialogProps) => {
  const { addBank, updateBank } = useFinance();
  const [popularOpen, setPopularOpen] = useState(false);

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

  const handleSelectPopularBank = (popular: { name: string; color: string }) => {
    form.setValue('name', popular.name, { shouldValidate: true });
    form.setValue('color', popular.color, { shouldValidate: true });
    setPopularOpen(false);
  };

  const currentColor = form.watch('color');
  const currentName  = form.watch('name');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>{bank ? 'Editar Banco / Conta' : 'Novo Banco / Conta'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

            {/* Popular banks quick-select (only for new accounts) */}
            {!bank && (
              <div className="space-y-1.5">
                <p className="text-sm font-medium">Seleção rápida</p>
                <Popover open={popularOpen} onOpenChange={setPopularOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      type="button"
                      className="w-full justify-between font-normal"
                    >
                      {currentName && POPULAR_BANKS.some(b => b.name === currentName)
                        ? (
                          <span className="flex items-center gap-2">
                            <span
                              className="w-4 h-4 rounded-full flex-shrink-0"
                              style={{ backgroundColor: currentColor }}
                            />
                            {currentName}
                          </span>
                        )
                        : <span className="text-muted-foreground">Escolha um banco popular...</span>
                      }
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar banco..." />
                      <CommandList>
                        <CommandEmpty>Banco não encontrado. Digite o nome manualmente abaixo.</CommandEmpty>
                        <CommandGroup heading="Bancos populares no Brasil">
                          {POPULAR_BANKS.map(b => (
                            <CommandItem
                              key={b.name}
                              value={b.name}
                              onSelect={() => handleSelectPopularBank(b)}
                              className="flex items-center gap-2 cursor-pointer"
                            >
                              <span
                                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                                style={{ backgroundColor: b.color }}
                              >
                                {b.name.charAt(0)}
                              </span>
                              <span className="flex-1">{b.name}</span>
                              <Check
                                className={cn('w-4 h-4 text-primary', currentName === b.name ? 'opacity-100' : 'opacity-0')}
                              />
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <p className="text-xs text-muted-foreground">
                  Pré-preenche nome e cor. Você pode editar livremente nos campos abaixo.
                </p>
              </div>
            )}

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
                  <CurrencyInput value={field.value} onChange={field.onChange} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {/* Color */}
            <FormField control={form.control} name="color" render={({ field }) => (
              <FormItem>
                <FormLabel>Cor</FormLabel>
                <div className="flex flex-wrap gap-2 items-center">
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
                  {/* Current color swatch (if from popular banks, not in BANK_COLORS) */}
                  {!BANK_COLORS.includes(field.value) && (
                    <span
                      className="w-7 h-7 rounded-full border-2 border-foreground scale-110 flex-shrink-0"
                      style={{ backgroundColor: field.value }}
                      title={field.value}
                    />
                  )}
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
