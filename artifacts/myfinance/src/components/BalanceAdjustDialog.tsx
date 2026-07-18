import React, { useState, useEffect } from 'react';
import { useFinance } from '@/context/FinanceContext';
import { dataService } from '@/services/dataService';
import { BankAccount } from '@/data/mockData';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CurrencyInput } from '@/components/ui/currency-input';
import { toast } from 'sonner';
import { Loader2, ArrowUp, ArrowDown } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface BalanceAdjustDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bank: BankAccount | null;
  currentBalance: number;
}

export function BalanceAdjustDialog({ open, onOpenChange, bank, currentBalance }: BalanceAdjustDialogProps) {
  const { categories, addTransaction } = useFinance();
  const [realBalance, setRealBalance] = useState(0);
  const [touched, setTouched] = useState(false);
  const [description, setDescription] = useState('Ajuste de saldo');
  const [loading, setLoading] = useState(false);

  // Reset when dialog opens/closes
  useEffect(() => {
    if (open) {
      setRealBalance(0);
      setTouched(false);
      setDescription('Ajuste de saldo');
    }
  }, [open]);

  const diff = realBalance - currentBalance;
  const isZero = Math.abs(diff) < 0.005; // less than half a cent

  const handleBalanceChange = (val: number) => {
    setRealBalance(val);
    setTouched(true);
  };

  const handleConfirm = async () => {
    if (!bank) return;

    if (isZero) {
      toast.info('Saldo já está correto — nenhuma transação criada.');
      return;
    }

    setLoading(true);
    try {
      const type = diff > 0 ? 'income' : 'expense';

      // Find an existing "Ajustes" category of the matching type, or create one
      let adjustCat = categories.find(c => c.name === 'Ajustes' && c.type === type);
      if (!adjustCat) {
        adjustCat = await dataService.addCategory({
          name: 'Ajustes',
          type,
          color: '#64748b',
          icon: 'sliders',
          dreGroup: type === 'income' ? 'receita' : 'despesa_variavel',
        });
      }

      const today = new Date();
      const todayStr = [
        today.getFullYear(),
        String(today.getMonth() + 1).padStart(2, '0'),
        String(today.getDate()).padStart(2, '0'),
      ].join('-');

      await addTransaction({
        description: description.trim() || 'Ajuste de saldo',
        amount: Math.abs(diff),
        type,
        categoryId: adjustCat.id,
        date: todayStr,
        status: 'paid',
        bankId: bank.id,
      });

      toast.success('Ajuste de saldo registrado!');
      onOpenChange(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar ajuste de saldo');
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
            Informe o saldo real da conta. O sistema criará uma transação de ajuste automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Current balance (read-only) */}
          <div className="rounded-lg bg-muted/50 border px-4 py-3 space-y-0.5">
            <p className="text-xs text-muted-foreground">Saldo atual calculado pelo app</p>
            <p className={`text-2xl font-bold ${currentBalance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
              {formatCurrency(currentBalance)}
            </p>
          </div>

          {/* Real balance input */}
          <div className="space-y-1.5">
            <Label htmlFor="real-balance">Saldo real (correto)</Label>
            <CurrencyInput
              id="real-balance"
              value={realBalance}
              onChange={handleBalanceChange}
              placeholder="0,00"
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="adj-desc">Descrição da transação</Label>
            <Input
              id="adj-desc"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Ajuste de saldo"
            />
          </div>

          {/* Difference preview */}
          {touched && (
            isZero ? (
              <div className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground text-center">
                Saldo já está correto — nenhuma transação será criada.
              </div>
            ) : (
              <div className={`rounded-lg px-4 py-3 space-y-0.5 ${diff > 0 ? 'bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800' : 'bg-destructive/5 border border-destructive/20'}`}>
                <div className={`flex items-center gap-2 text-sm font-medium ${diff > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive'}`}>
                  {diff > 0
                    ? <><ArrowUp className="w-4 h-4" /> Receita de ajuste: {formatCurrency(Math.abs(diff))}</>
                    : <><ArrowDown className="w-4 h-4" /> Despesa de ajuste: {formatCurrency(Math.abs(diff))}</>}
                </div>
                <p className="text-xs text-muted-foreground">
                  Será criada na categoria <strong>Ajustes</strong>, status pago, data de hoje.
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
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Criando...</>
              : 'Confirmar ajuste'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
