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
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Transfer } from '@/data/mockData';
import { extractErrorMessage } from '@/services/dataService';
import { Loader2, ArrowRightLeft } from 'lucide-react';
import { getIcon } from '@/components/IconMap';

// ─── Schema ───────────────────────────────────────────────────────────────────

const transferSchema = z.object({
  fromBankId: z.string().min(1, 'Conta de origem é obrigatória'),
  toBankId:   z.string().min(1, 'Conta de destino é obrigatória'),
  amount:     z.coerce.number().min(0.01, 'Valor deve ser maior que zero'),
  date:       z.string().min(1, 'Data é obrigatória'),
  notes:      z.string().optional(),
}).refine(data => data.fromBankId !== data.toBankId, {
  message: 'Origem e destino devem ser contas diferentes',
  path: ['toBankId'],
});

type TransferFormData = z.infer<typeof transferSchema>;

// ─── Component ────────────────────────────────────────────────────────────────

interface TransferFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transfer?: Transfer | null;
}

export const TransferFormDialog = ({ open, onOpenChange, transfer }: TransferFormDialogProps) => {
  const { banks, addTransfer, updateTransfer } = useFinance();

  const form = useForm<TransferFormData>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      fromBankId: '', toBankId: '',
      amount: 0,
      date: new Date().toISOString().split('T')[0],
      notes: '',
    },
  });

  React.useEffect(() => {
    if (open) {
      form.reset(transfer ? {
        fromBankId: transfer.fromBankId,
        toBankId:   transfer.toBankId,
        amount:     transfer.amount,
        date:       transfer.date,
        notes:      transfer.notes ?? '',
      } : {
        fromBankId: '', toBankId: '',
        amount: 0,
        date: new Date().toISOString().split('T')[0],
        notes: '',
      });
    }
  }, [open, transfer, form]);

  const fromBankId = form.watch('fromBankId');

  const onSubmit = async (data: TransferFormData) => {
    try {
      if (transfer) {
        await updateTransfer(transfer.id, data);
        toast.success('Transferência atualizada');
      } else {
        await addTransfer(data);
        const from = banks.find(b => b.id === data.fromBankId)?.name ?? 'origem';
        const to   = banks.find(b => b.id === data.toBankId)?.name ?? 'destino';
        toast.success(`Transferência de ${from} → ${to} registrada`);
      }
      onOpenChange(false);
    } catch (err: unknown) {
      toast.error(`Erro ao salvar transferência: ${extractErrorMessage(err)}`);
    }
  };

  if (banks.length < 2) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Nova Transferência</DialogTitle>
          </DialogHeader>
          <div className="py-6 text-center text-muted-foreground text-sm space-y-2">
            <ArrowRightLeft className="w-8 h-8 mx-auto text-muted-foreground/40" />
            <p>Você precisa de pelo menos <strong>2 contas bancárias</strong> para registrar uma transferência.</p>
            <p>Cadastre suas contas em <strong>Configurações → Bancos</strong>.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4" />
            {transfer ? 'Editar Transferência' : 'Nova Transferência'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

            {/* From */}
            <FormField control={form.control} name="fromBankId" render={({ field }) => (
              <FormItem>
                <FormLabel>Conta de origem</FormLabel>
                <Select onValueChange={(v) => {
                  field.onChange(v);
                  // Clear toBankId if same as new fromBankId
                  if (form.getValues('toBankId') === v) form.setValue('toBankId', '');
                }} value={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="De qual conta sai o dinheiro?" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {banks.map(b => {
                      const Icon = getIcon(b.icon);
                      return (
                        <SelectItem key={b.id} value={b.id}>
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: b.color }} />
                            {b.name}
                            <span className="text-muted-foreground text-xs">({b.type})</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            {/* To */}
            <FormField control={form.control} name="toBankId" render={({ field }) => (
              <FormItem>
                <FormLabel>Conta de destino</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Para qual conta vai o dinheiro?" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {banks
                      .filter(b => b.id !== fromBankId)
                      .map(b => {
                        const Icon = getIcon(b.icon);
                        return (
                          <SelectItem key={b.id} value={b.id}>
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: b.color }} />
                              {b.name}
                              <span className="text-muted-foreground text-xs">({b.type})</span>
                            </div>
                          </SelectItem>
                        );
                      })}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            {/* Amount + Date */}
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="amount" render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor (R$)</FormLabel>
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

              <FormField control={form.control} name="date" render={({ field }) => (
                <FormItem>
                  <FormLabel>Data</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {/* Notes */}
            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Observação <span className="text-muted-foreground font-normal">(opcional)</span></FormLabel>
                <FormControl>
                  <Textarea placeholder="Ex: Pagamento da fatura do cartão..." className="resize-none" rows={2} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {transfer ? 'Salvar' : 'Registrar transferência'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
