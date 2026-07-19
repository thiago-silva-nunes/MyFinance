import React, { useEffect, useState } from 'react';
import { useFinance } from '@/context/FinanceContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: string[];
  onDone: () => void;
}

export const BulkEditTransactionsDialog = ({ open, onOpenChange, selectedIds, onDone }: Props) => {
  const { categories, subcategories, banks, bulkUpdateTransactions } = useFinance();

  const [changeCategory, setChangeCategory]           = useState(false);
  const [changeSubcategory, setChangeSubcategory]     = useState(false);
  const [changeBank, setChangeBank]                   = useState(false);
  const [changeStatus, setChangeStatus]               = useState(false);
  const [changePaymentMethod, setChangePaymentMethod] = useState(false);

  const [categoryId, setCategoryId]         = useState('');
  const [subcategoryId, setSubcategoryId]   = useState('');
  const [bankId, setBankId]                 = useState('');
  const [status, setStatus]                 = useState<'paid' | 'pending'>('paid');
  const [paymentMethod, setPaymentMethod]   = useState('dinheiro');
  const [isSubmitting, setIsSubmitting]     = useState(false);

  const availableSubcategories = subcategories.filter(s => s.categoryId === categoryId);
  const canPickSubcategory = changeCategory && !!categoryId && availableSubcategories.length > 0;

  // Reset fields whenever dialog opens
  useEffect(() => {
    if (open) {
      setChangeCategory(false); setChangeSubcategory(false); setChangeBank(false);
      setChangeStatus(false); setChangePaymentMethod(false);
      setCategoryId(''); setSubcategoryId(''); setBankId('');
      setStatus('paid'); setPaymentMethod('dinheiro');
    }
  }, [open]);

  const handleSubmit = async () => {
    const updates: Record<string, unknown> = {};
    if (changeCategory && categoryId) updates.categoryId = categoryId;
    if (changeSubcategory) {
      // Only apply subcategory if the selected sub belongs to the chosen category
      const validSub = availableSubcategories.find(s => s.id === subcategoryId);
      updates.subcategoryId = validSub ? subcategoryId : null;
    }
    if (changeBank)          updates.bankId         = bankId || null;
    if (changeStatus)        updates.status         = status;
    if (changePaymentMethod) updates.paymentMethod  = paymentMethod;

    if (Object.keys(updates).length === 0) {
      toast.info('Selecione ao menos um campo para alterar.');
      return;
    }

    setIsSubmitting(true);
    try {
      await bulkUpdateTransactions(selectedIds, updates as Parameters<typeof bulkUpdateTransactions>[1]);
      const n = selectedIds.length;
      toast.success(`${n} transaç${n !== 1 ? 'ões' : 'ão'} atualizad${n !== 1 ? 'as' : 'a'}.`);
      onDone();
      onOpenChange(false);
    } catch {
      toast.error('Erro ao atualizar transações.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] max-h-[90vh] p-0 flex flex-col gap-0">
        <div className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogHeader>
            <DialogTitle>
              Editar {selectedIds.length} transaç{selectedIds.length !== 1 ? 'ões' : 'ão'}
            </DialogTitle>
          </DialogHeader>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <p className="text-sm text-muted-foreground mb-4">
            Marque os campos que deseja alterar. Os demais não serão tocados.
          </p>

          <div className="space-y-5">

          {/* ── Categoria ─────────────────────────────────── */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="be-cat"
                checked={changeCategory}
                onCheckedChange={(v) => {
                  setChangeCategory(!!v);
                  if (!v) { setChangeSubcategory(false); setSubcategoryId(''); }
                }}
              />
              <Label htmlFor="be-cat" className="font-medium cursor-pointer">Alterar Categoria</Label>
            </div>
            {changeCategory && (
              <Select value={categoryId} onValueChange={(v) => { setCategoryId(v); setSubcategoryId(''); setChangeSubcategory(false); }}>
                <SelectTrigger><SelectValue placeholder="Selecione a categoria" /></SelectTrigger>
                <SelectContent>
                  {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* ── Subcategoria ──────────────────────────────── */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="be-subcat"
                checked={changeSubcategory}
                disabled={!canPickSubcategory}
                onCheckedChange={(v) => setChangeSubcategory(!!v)}
              />
              <Label htmlFor="be-subcat" className={`font-medium cursor-pointer ${!canPickSubcategory ? 'text-muted-foreground' : ''}`}>
                Alterar Subcategoria
              </Label>
            </div>
            {changeCategory && changeSubcategory && categoryId && (
              <Select value={subcategoryId || '__none__'} onValueChange={(v) => setSubcategoryId(v === '__none__' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione a subcategoria" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Nenhuma —</SelectItem>
                  {availableSubcategories.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* ── Conta Bancária ────────────────────────────── */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox id="be-bank" checked={changeBank} onCheckedChange={(v) => setChangeBank(!!v)} />
              <Label htmlFor="be-bank" className="font-medium cursor-pointer">Alterar Conta Bancária</Label>
            </div>
            {changeBank && (
              <Select value={bankId || '__none__'} onValueChange={(v) => setBankId(v === '__none__' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione a conta" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Nenhuma —</SelectItem>
                  {banks.map(b => (
                    <SelectItem key={b.id} value={b.id}>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ backgroundColor: b.color }} />
                        {b.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* ── Status ───────────────────────────────────── */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox id="be-status" checked={changeStatus} onCheckedChange={(v) => setChangeStatus(!!v)} />
              <Label htmlFor="be-status" className="font-medium cursor-pointer">Alterar Status</Label>
            </div>
            {changeStatus && (
              <div className="flex gap-2">
                {(['paid', 'pending'] as const).map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={`flex-1 h-9 rounded-md border text-sm font-medium transition-colors ${
                      status === s
                        ? s === 'paid'
                          ? 'bg-success text-white border-success'
                          : 'bg-amber-500 text-white border-amber-500'
                        : 'bg-background border-input hover:bg-muted'
                    }`}
                  >
                    {s === 'paid' ? 'Pago' : 'Pendente'}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Forma de Pagamento ────────────────────────── */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox id="be-pm" checked={changePaymentMethod} onCheckedChange={(v) => setChangePaymentMethod(!!v)} />
              <Label htmlFor="be-pm" className="font-medium cursor-pointer">Alterar Forma de Pagamento</Label>
            </div>
            {changePaymentMethod && (
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[
                    ['dinheiro', 'Dinheiro'],
                    ['pix', 'PIX'],
                    ['debito', 'Débito'],
                    ['credito', 'Crédito'],
                    ['boleto', 'Boleto'],
                    ['ted', 'TED/DOC'],
                  ].map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>

          </div>
        </div>

        <div className="px-6 py-4 border-t shrink-0 bg-background">
          <DialogFooter className="pt-0">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Aplicar alterações
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
};
