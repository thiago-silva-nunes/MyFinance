import React, { useState, useEffect } from 'react';
import { useFinance } from '@/context/FinanceContext';
import { BankAccount } from '@/data/mockData';
import { computeBankBalanceAtDate } from '@/lib/balanceUtils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface BalanceAdjustDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bank: BankAccount | null;
  currentBalance: number;
}

export function BalanceAdjustDialog({ open, onOpenChange, bank, currentBalance }: BalanceAdjustDialogProps) {
  const { upsertBalanceSnapshot, transactions, transfers, banks, balanceSnapshots } = useFinance();
  const [realBalance, setRealBalance] = useState(0);
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      setRealBalance(0);
      setTouched(false);
    }
  }, [open]);

  // Recompute the "live" current balance from context data (same formula as Dashboard)
  const liveBalance = bank
    ? computeBankBalanceAtDate(bank.id, bank, transactions, transfers, balanceSnapshots)
    : currentBalance;

  const diff = realBalance - liveBalance;
  const isZero = Math.abs(diff) < 0.005;

  const handleConfirm = async () => {
    if (!bank) return;
    if (isZero) {
      toast.info('Saldo já está correto — nenhum marco de saldo criado.');
      return;
    }

    setLoading(true);
    try {
      const today = new Date();
      const todayStr = [
        today.getFullYear(),
        String(today.getMonth() + 1).padStart(2, '0'),
        String(today.getDate()).padStart(2, '0'),
      ].join('-');

      await upsertBalanceSnapshot(bank.id, todayStr, realBalance);

      toast.success('Marco de saldo registrado!');
      onOpenChange(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar marco de saldo');
    } finally {
      setLoading(false);
    }
  };

  if (!bank) return null;

  const canConfirm = touched && !loading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Ajustar saldo — {bank.name}</DialogTitle>
          <DialogDescription>
            Informe o saldo real da conta. O sistema registrará um marco de saldo — nenhuma transação será criada.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Current balance (read-only) */}
          <div className="rounded-lg bg-muted/50 border px-4 py-3 space-y-0.5">
            <p className="text-xs text-muted-foreground">Saldo atual calculado pelo app</p>
            <p className={`text-2xl font-bold ${liveBalance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
              {formatCurrency(liveBalance)}
            </p>
          </div>

          {/* Real balance input */}
          <div className="space-y-1.5">
            <Label htmlFor="real-balance">Saldo real (correto)</Label>
            <CurrencyInput
              id="real-balance"
              value={realBalance}
              onChange={(val) => { setRealBalance(val); setTouched(true); }}
              placeholder="0,00"
              autoFocus
            />
          </div>

          {/* Preview */}
          {touched && (
            isZero ? (
              <div className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground text-center">
                Saldo já está correto — nenhum marco de saldo será criado.
              </div>
            ) : (
              <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 px-4 py-3 space-y-1">
                <p className="text-sm font-medium text-blue-700 dark:text-blue-400">
                  Marco de saldo: {formatCurrency(realBalance)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Diferença de {formatCurrency(Math.abs(diff))} {diff > 0 ? 'a mais' : 'a menos'} em relação ao calculado.
                  Nenhuma transação será criada.
                </p>
              </div>
            )
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!canConfirm || (touched && isZero)}>
            {loading
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...</>
              : 'Confirmar ajuste'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
