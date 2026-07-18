import React, { useEffect, useState } from 'react';
import { useFinance } from '@/context/FinanceContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { ScheduledTransaction } from '@/data/mockData';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: string[];
  onDone: () => void;
}

export const BulkEditScheduledDialog = ({ open, onOpenChange, selectedIds, onDone }: Props) => {
  const { categories, subcategories, banks, bulkUpdateScheduled } = useFinance();

  const [changeCategory, setChangeCategory]       = useState(false);
  const [changeSubcategory, setChangeSubcategory] = useState(false);
  const [changeBank, setChangeBank]               = useState(false);
  const [changeFrequency, setChangeFrequency]     = useState(false);
  const [changeActive, setChangeActive]           = useState(false);

  const [categoryId, setCategoryId]       = useState('');
  const [subcategoryId, setSubcategoryId] = useState('');
  const [bankId, setBankId]               = useState('');
  const [frequency, setFrequency]         = useState<ScheduledTransaction['frequency']>('monthly');
  const [active, setActive]               = useState(true);
  const [isSubmitting, setIsSubmitting]   = useState(false);

  const availableSubcategories = subcategories.filter(s => s.categoryId === categoryId);
  const canPickSubcategory = changeCategory && !!categoryId && availableSubcategories.length > 0;

  useEffect(() => {
    if (open) {
      setChangeCategory(false); setChangeSubcategory(false); setChangeBank(false);
      setChangeFrequency(false); setChangeActive(false);
      setCategoryId(''); setSubcategoryId(''); setBankId('');
      setFrequency('monthly'); setActive(true);
    }
  }, [open]);

  const handleSubmit = async () => {
    const updates: Partial<ScheduledTransaction> = {};
    if (changeCategory && categoryId) updates.categoryId = categoryId;
    if (changeSubcategory) {
      const validSub = availableSubcategories.find(s => s.id === subcategoryId);
      updates.subcategoryId = validSub ? subcategoryId : undefined;
    }
    if (changeBank)      updates.bankId    = bankId || undefined;
    if (changeFrequency) updates.frequency = frequency;
    if (changeActive)    updates.active    = active;

    if (Object.keys(updates).length === 0) {
      toast.info('Selecione ao menos um campo para alterar.');
      return;
    }

    setIsSubmitting(true);
    try {
      await bulkUpdateScheduled(selectedIds, updates);
      const n = selectedIds.length;
      toast.success(`${n} recorrência${n !== 1 ? 's' : ''} atualizada${n !== 1 ? 's' : ''}.`);
      onDone();
      onOpenChange(false);
    } catch {
      toast.error('Erro ao atualizar recorrências.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const FREQUENCIES: [ScheduledTransaction['frequency'], string][] = [
    ['daily', 'Diário'], ['weekly', 'Semanal'], ['monthly', 'Mensal'],
    ['yearly', 'Anual'], ['once', 'Uma vez'],
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>
            Editar {selectedIds.length} recorrência{selectedIds.length !== 1 ? 's' : ''}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground -mt-1">
          Marque os campos que deseja alterar. Os demais não serão tocados.
        </p>

        <div className="space-y-5 pt-1">

          {/* ── Categoria ─────────────────────────────────── */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="bes-cat"
                checked={changeCategory}
                onCheckedChange={(v) => {
                  setChangeCategory(!!v);
                  if (!v) { setChangeSubcategory(false); setSubcategoryId(''); }
                }}
              />
              <Label htmlFor="bes-cat" className="font-medium cursor-pointer">Alterar Categoria</Label>
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
                id="bes-subcat"
                checked={changeSubcategory}
                disabled={!canPickSubcategory}
                onCheckedChange={(v) => setChangeSubcategory(!!v)}
              />
              <Label htmlFor="bes-subcat" className={`font-medium cursor-pointer ${!canPickSubcategory ? 'text-muted-foreground' : ''}`}>
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
              <Checkbox id="bes-bank" checked={changeBank} onCheckedChange={(v) => setChangeBank(!!v)} />
              <Label htmlFor="bes-bank" className="font-medium cursor-pointer">Alterar Conta Bancária</Label>
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

          {/* ── Frequência ────────────────────────────────── */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox id="bes-freq" checked={changeFrequency} onCheckedChange={(v) => setChangeFrequency(!!v)} />
              <Label htmlFor="bes-freq" className="font-medium cursor-pointer">Alterar Frequência</Label>
            </div>
            {changeFrequency && (
              <Select value={frequency} onValueChange={(v) => setFrequency(v as ScheduledTransaction['frequency'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FREQUENCIES.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* ── Ativo ─────────────────────────────────────── */}
          <div className="flex items-center gap-3">
            <Checkbox id="bes-active" checked={changeActive} onCheckedChange={(v) => setChangeActive(!!v)} />
            <Label htmlFor="bes-active" className="font-medium cursor-pointer">Alterar Ativo</Label>
            {changeActive && (
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-sm text-muted-foreground">{active ? 'Ativo' : 'Inativo'}</span>
                <Switch checked={active} onCheckedChange={setActive} />
              </div>
            )}
          </div>

        </div>

        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Aplicar alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
