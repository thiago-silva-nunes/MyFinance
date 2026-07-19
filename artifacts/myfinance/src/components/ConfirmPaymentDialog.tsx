import React, { useState, useEffect } from 'react';
import { Transaction } from '@/data/mockData';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { CurrencyInput } from '@/components/ui/currency-input';
import { DatePicker } from '@/components/ui/date-picker';
import { formatCurrency } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface ConfirmPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction | null;
  /** Called with the final amount and date when the user confirms payment. */
  onConfirm: (amount: number, date: string) => Promise<void> | void;
}

function getTodayStr(): string {
  return new Date().toISOString().split('T')[0];
}

export function ConfirmPaymentDialog({
  open,
  onOpenChange,
  transaction,
  onConfirm,
}: ConfirmPaymentDialogProps) {
  const [amount, setAmount] = useState(0);
  const [date, setDate]     = useState('');
  const [loading, setLoading] = useState(false);

  // Reset fields every time the dialog opens (or the target transaction changes)
  useEffect(() => {
    if (open && transaction) {
      setAmount(transaction.amount);
      setDate(getTodayStr());
    }
  }, [open, transaction]);

  const handleConfirm = async () => {
    if (!transaction) return;
    setLoading(true);
    try {
      await onConfirm(amount, date);
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  if (!transaction) return null;

  const amountChanged = Math.abs(amount - transaction.amount) >= 0.005;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Confirmar pagamento</DialogTitle>
          <DialogDescription className="truncate">
            {transaction.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Expected amount (read-only reference) */}
          <div className="rounded-lg bg-muted/50 border px-4 py-3 space-y-0.5">
            <p className="text-xs text-muted-foreground">Valor previsto</p>
            <p className="text-lg font-semibold">{formatCurrency(transaction.amount)}</p>
          </div>

          {/* Editable amount */}
          <div className="space-y-1.5">
            <Label htmlFor="confirm-amount">Valor pago</Label>
            <CurrencyInput
              id="confirm-amount"
              value={amount}
              onChange={setAmount}
              autoFocus
            />
            {amountChanged && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Diferença de {formatCurrency(Math.abs(amount - transaction.amount))} em relação ao previsto.
              </p>
            )}
          </div>

          {/* Payment date */}
          <div className="space-y-1.5">
            <Label>Data de pagamento</Label>
            <DatePicker value={date} onChange={setDate} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={loading || amount <= 0 || !date}>
            {loading
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</>
              : 'Confirmar pagamento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
