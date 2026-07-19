import React, { useState, useMemo } from 'react';
import { useFinance } from '@/context/FinanceContext';
import { computeBankBalanceAtDate } from '@/lib/balanceUtils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { BankFormDialog } from '@/components/BankFormDialog';
import { BalanceAdjustDialog } from '@/components/BalanceAdjustDialog';
import { BankAccount } from '@/data/mockData';
import { getIcon } from '@/components/IconMap';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2, Building2, SlidersHorizontal, X } from 'lucide-react';

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  'corrente': 'Corrente',
  'poupança': 'Poupança',
  'investimento': 'Investimento',
};

export function Banks() {
  const { banks, deleteBank, deleteBanks, transactions, transfers, balanceSnapshots } = useFinance();

  const bankBalances = useMemo(() => {
    const map: Record<string, number> = {};
    for (const bank of banks) {
      map[bank.id] = computeBankBalanceAtDate(bank.id, bank, transactions, transfers, balanceSnapshots);
    }
    return map;
  }, [banks, transactions, transfers, balanceSnapshots]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing]       = useState<BankAccount | null>(null);
  const [adjustBank, setAdjustBank] = useState<BankAccount | null>(null);
  const [adjustOpen, setAdjustOpen] = useState(false);

  // Bulk selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelected(s => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const clearSelection = () => setSelected(new Set());

  const handleDelete = async (bank: BankAccount) => {
    if (!confirm(`Excluir a conta "${bank.name}"? As transações vinculadas a ela continuarão existindo.`)) return;
    try {
      await deleteBank(bank.id);
      toast.success('Conta removida');
    } catch {
      toast.error('Erro ao remover conta');
    }
  };

  const handleBulkDelete = async () => {
    const ids = [...selected];
    const names = ids.map(id => banks.find(b => b.id === id)?.name ?? id).join(', ');
    if (!confirm(`Excluir ${ids.length} ${ids.length === 1 ? 'conta' : 'contas'} (${names})? As transações vinculadas continuarão existindo.`)) return;
    try {
      await deleteBanks(ids);
      toast.success(`${ids.length} ${ids.length === 1 ? 'conta removida' : 'contas removidas'}`);
      clearSelection();
    } catch {
      toast.error('Erro ao remover contas');
    }
  };

  const openNew    = () => { setEditing(null); setDialogOpen(true); };
  const openEdit   = (b: BankAccount) => { setEditing(b); setDialogOpen(true); };
  const openAdjust = (b: BankAccount) => { setAdjustBank(b); setAdjustOpen(true); };

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bancos / Contas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gerencie suas contas bancárias e acompanhe os saldos.
          </p>
        </div>
        <Button onClick={openNew} className="shrink-0">
          <Plus className="w-4 h-4 mr-2" /> Nova Conta
        </Button>
      </div>

      {/* ── Bulk action bar ──────────────────────────────────────────────── */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-primary/5 border border-primary/20 rounded-xl">
          <span className="text-sm font-medium text-primary flex-1">
            {selected.size} {selected.size === 1 ? 'conta selecionada' : 'contas selecionadas'}
          </span>
          <Button size="sm" variant="destructive" onClick={handleBulkDelete}>
            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
            Excluir selecionadas
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={clearSelection}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* ── List / Empty state ──────────────────────────────────────────── */}
      {banks.length === 0 ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center gap-3 text-center">
            <Building2 className="w-12 h-12 text-muted-foreground/30" />
            <p className="font-medium text-muted-foreground">Nenhuma conta cadastrada</p>
            <p className="text-sm text-muted-foreground max-w-sm">
              Cadastre seus bancos e contas para identificar de qual conta saiu cada gasto.
            </p>
            <Button variant="outline" onClick={openNew} className="mt-2">
              <Plus className="w-4 h-4 mr-2" /> Cadastrar primeira conta
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {banks.map(bank => {
            const Icon = getIcon(bank.icon);
            const bal  = bankBalances[bank.id] ?? bank.initialBalance;
            const isChecked = selected.has(bank.id);
            return (
              <Card key={bank.id} className={`group hover-elevate transition-all ${isChecked ? 'ring-2 ring-primary/40' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Avatar with checkbox overlay */}
                      <div className="relative flex-shrink-0 w-11 h-11">
                        <div className={`absolute inset-0 flex items-center justify-center rounded-xl z-10 transition-opacity ${isChecked || selected.size > 0 ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                          <Checkbox
                            checked={isChecked}
                            onClick={e => toggleSelect(bank.id, e)}
                            className="bg-background border-2 shadow-sm"
                          />
                        </div>
                        <div
                          className={`w-11 h-11 rounded-xl flex items-center justify-center transition-opacity ${isChecked || selected.size > 0 ? 'opacity-0' : 'opacity-100 group-hover:opacity-0'}`}
                          style={{ backgroundColor: `${bank.color}20` }}
                        >
                          <Icon className="w-5 h-5" style={{ color: bank.color }} />
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm truncate">{bank.name}</p>
                        <Badge variant="secondary" className="text-[10px] h-4 px-1.5 mt-0.5">
                          {ACCOUNT_TYPE_LABELS[bank.type] ?? bank.type}
                        </Badge>
                        <p className={`text-xs font-semibold mt-1 ${bal >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                          {formatCurrency(bal)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7"
                        title="Ajustar saldo" onClick={() => openAdjust(bank)}
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(bank)}>
                        <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7 hover:bg-destructive/10"
                        onClick={() => handleDelete(bank)}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <BankFormDialog open={dialogOpen} onOpenChange={setDialogOpen} bank={editing} />
      <BalanceAdjustDialog
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        bank={adjustBank}
        currentBalance={adjustBank ? (bankBalances[adjustBank.id] ?? adjustBank.initialBalance) : 0}
      />
    </div>
  );
}
