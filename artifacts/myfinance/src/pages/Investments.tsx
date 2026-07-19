import React, { useMemo, useState } from 'react';
import { useFinance } from '@/context/FinanceContext';
import { usePrivacy } from '@/context/PrivacyContext';
import { formatCurrency, formatShortDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  TrendingUp, Plus, Pencil, Trash2, ArrowUpCircle, ArrowDownCircle,
  RefreshCw, Building2,
} from 'lucide-react';
import { Investment, InvestmentTransaction, InvestmentType } from '@/data/mockData';
import { toast } from 'sonner';

// ─── Constants ────────────────────────────────────────────────────────────────

const INVESTMENT_TYPE_LABELS: Record<InvestmentType, string> = {
  renda_fixa: 'Renda Fixa',
  acoes: 'Ações',
  fundos_imobiliarios: 'Fundos Imobiliários',
  fundos: 'Fundos',
  criptomoedas: 'Criptomoedas',
  previdencia: 'Previdência',
  tesouro_direto: 'Tesouro Direto',
  outros: 'Outros',
};

const TYPE_COLORS: Record<InvestmentType, string> = {
  renda_fixa: '#22c55e',
  acoes: '#3b82f6',
  fundos_imobiliarios: '#f59e0b',
  fundos: '#8b5cf6',
  criptomoedas: '#f97316',
  previdencia: '#06b6d4',
  tesouro_direto: '#10b981',
  outros: '#94a3b8',
};

const ALL_TYPES: InvestmentType[] = [
  'renda_fixa', 'acoes', 'fundos_imobiliarios', 'fundos',
  'criptomoedas', 'previdencia', 'tesouro_direto', 'outros',
];

// ─── Currency input helper ────────────────────────────────────────────────────

function parseCurrency(raw: string): number {
  const cleaned = raw.replace(/[^\d,]/g, '').replace(',', '.');
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
}

function formatInputValue(val: number): string {
  if (val === 0) return '';
  return val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── Investment Form Dialog ───────────────────────────────────────────────────

interface InvestmentFormDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing?: Investment | null;
  onSave: (data: Omit<Investment, 'id' | 'createdAt'>) => Promise<void>;
}

const InvestmentFormDialog = ({ open, onOpenChange, editing, onSave }: InvestmentFormDialogProps) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<InvestmentType>('renda_fixa');
  const [institution, setInstitution] = useState('');
  const [initialValue, setInitialValue] = useState('');
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (open) {
      setName(editing?.name ?? '');
      setType(editing?.type ?? 'renda_fixa');
      setInstitution(editing?.institution ?? '');
      setInitialValue(editing ? formatInputValue(editing.initialValue) : '');
    }
  }, [open, editing]);

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Informe o nome do investimento'); return; }
    const initVal = parseCurrency(initialValue);
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        type,
        institution: institution.trim() || undefined,
        initialValue: initVal,
        currentValue: editing ? editing.currentValue : initVal,
      });
      onOpenChange(false);
    } catch (e: unknown) {
      toast.error((e as Error).message ?? 'Erro ao salvar investimento');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar Investimento' : 'Novo Investimento'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input placeholder="Ex: Tesouro Selic 2027" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={v => setType(v as InvestmentType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ALL_TYPES.map(t => (
                  <SelectItem key={t} value={t}>{INVESTMENT_TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Instituição (opcional)</Label>
            <Input placeholder="Ex: Nubank, XP, BTG…" value={institution} onChange={e => setInstitution(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Valor inicial investido (R$)</Label>
            <Input
              placeholder="0,00"
              value={initialValue}
              onChange={e => setInitialValue(e.target.value)}
              onBlur={e => {
                const n = parseCurrency(e.target.value);
                setInitialValue(n > 0 ? formatInputValue(n) : '');
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─── Investment Transaction Dialog ────────────────────────────────────────────

interface InvTxDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  investment: Investment | null;
  onSave: (tx: Omit<InvestmentTransaction, 'id' | 'createdAt'>) => Promise<void>;
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

const InvTxDialog = ({ open, onOpenChange, investment, onSave }: InvTxDialogProps) => {
  const [txType, setTxType] = useState<InvestmentTransaction['type']>('aporte');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayStr());
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (open) {
      setTxType('aporte');
      setAmount('');
      setDate(todayStr());
      setNotes('');
    }
  }, [open]);

  const handleSave = async () => {
    if (!investment) return;
    const val = parseCurrency(amount);
    if (val <= 0) { toast.error('Informe um valor maior que zero'); return; }
    setSaving(true);
    try {
      await onSave({
        investmentId: investment.id,
        date,
        type: txType,
        amount: val,
        notes: notes.trim() || undefined,
      });
      onOpenChange(false);
    } catch (e: unknown) {
      toast.error((e as Error).message ?? 'Erro ao registrar transação');
    } finally {
      setSaving(false);
    }
  };

  const txTypeLabel: Record<InvestmentTransaction['type'], string> = {
    aporte: 'Aporte',
    resgate: 'Resgate',
    atualizacao_valor: 'Atualização de Valor',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Registrar {investment ? `— ${investment.name}` : ''}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={txType} onValueChange={v => setTxType(v as InvestmentTransaction['type'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(['aporte', 'resgate', 'atualizacao_valor'] as const).map(t => (
                  <SelectItem key={t} value={t}>{txTypeLabel[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>
              {txType === 'atualizacao_valor' ? 'Novo valor atual (R$)' : 'Valor (R$)'}
            </Label>
            <Input
              placeholder="0,00"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              onBlur={e => {
                const n = parseCurrency(e.target.value);
                setAmount(n > 0 ? formatInputValue(n) : '');
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Data</Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Observação (opcional)</Label>
            <Textarea
              placeholder="Ex: Compra de PETR4"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Registrando…' : 'Registrar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const Investments = () => {
  const {
    investments, addInvestment, updateInvestment, deleteInvestment, deleteInvestments,
    addInvestmentTransaction,
  } = useFinance();
  const { hideValues } = usePrivacy();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Investment | null>(null);
  const [txDialogTarget, setTxDialogTarget] = useState<Investment | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const mask = (v: number) => hideValues ? 'R$ ••••••' : formatCurrency(v);

  // ── Summary ────────────────────────────────────────────────────────────────

  const { totalInitial, totalCurrent, rentabilidadeRS, rentabilidadePct } = useMemo(() => {
    const ti = investments.reduce((s, i) => s + i.initialValue, 0);
    const tc = investments.reduce((s, i) => s + i.currentValue, 0);
    const rrs = tc - ti;
    const rpct = ti > 0 ? (rrs / ti) * 100 : 0;
    return { totalInitial: ti, totalCurrent: tc, rentabilidadeRS: rrs, rentabilidadePct: rpct };
  }, [investments]);

  // ── Chart data (donut by type) ─────────────────────────────────────────────

  const chartData = useMemo(() => {
    const byType: Partial<Record<InvestmentType, number>> = {};
    for (const inv of investments) {
      byType[inv.type] = (byType[inv.type] ?? 0) + inv.currentValue;
    }
    return Object.entries(byType)
      .map(([type, value]) => ({
        name: INVESTMENT_TYPE_LABELS[type as InvestmentType],
        value: value as number,
        color: TYPE_COLORS[type as InvestmentType],
      }))
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [investments]);

  // ── Bulk selection ─────────────────────────────────────────────────────────

  const someSelected = selectedIds.size > 0;
  const allSelected = investments.length > 0 && selectedIds.size === investments.length;

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () =>
    setSelectedIds(allSelected ? new Set() : new Set(investments.map(i => i.id)));

  const handleBulkDelete = async () => {
    if (!selectedIds.size) return;
    if (!confirm(`Excluir ${selectedIds.size} investimento${selectedIds.size !== 1 ? 's' : ''}? Essa ação não pode ser desfeita.`)) return;
    try {
      await deleteInvestments([...selectedIds]);
      toast.success(`${selectedIds.size} investimento${selectedIds.size !== 1 ? 's' : ''} excluído${selectedIds.size !== 1 ? 's' : ''}`);
      setSelectedIds(new Set());
    } catch (e: unknown) {
      toast.error((e as Error).message ?? 'Erro ao excluir');
    }
  };

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleSaveInvestment = async (data: Omit<Investment, 'id' | 'createdAt'>) => {
    if (editing) {
      await updateInvestment(editing.id, data);
      toast.success('Investimento atualizado!');
    } else {
      await addInvestment(data);
      toast.success('Investimento adicionado!');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este investimento e todas as suas transações?')) return;
    try {
      await deleteInvestment(id);
      toast.success('Investimento excluído');
    } catch (e: unknown) {
      toast.error((e as Error).message ?? 'Erro ao excluir');
    }
  };

  const handleSaveTx = async (tx: Omit<InvestmentTransaction, 'id' | 'createdAt'>) => {
    await addInvestmentTransaction(tx);
    toast.success('Transação registrada!');
  };

  const openNew = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (inv: Investment) => { setEditing(inv); setFormOpen(true); };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 pb-20 md:pb-0">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Investimentos</h1>
          <p className="text-muted-foreground">Controle manual das suas posições.</p>
        </div>
        <Button onClick={openNew} className="w-full md:w-auto shadow-sm hover-elevate">
          <Plus className="w-4 h-4 mr-2" /> Novo Investimento
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-primary/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Investido</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mask(totalInitial)}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-400/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Valor Atual</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mask(totalCurrent)}</div>
          </CardContent>
        </Card>
        <Card className={cn('border-l-4', rentabilidadeRS >= 0 ? 'border-l-success/50' : 'border-l-destructive/50')}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Rentabilidade</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn('text-2xl font-bold', rentabilidadeRS >= 0 ? 'text-success' : 'text-destructive')}>
              {hideValues ? 'R$ ••••••' : (rentabilidadeRS >= 0 ? '+' : '') + formatCurrency(rentabilidadeRS)}
            </div>
            <p className={cn('text-xs mt-1', rentabilidadeRS >= 0 ? 'text-success' : 'text-destructive')}>
              {hideValues ? '••••' : `${rentabilidadeRS >= 0 ? '+' : ''}${rentabilidadePct.toFixed(2)}%`} sobre o total investido
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Donut chart — only render when there's data */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Distribuição por Tipo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%" cy="50%"
                    innerRadius={60} outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {chartData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [hideValues ? '••••••' : formatCurrency(value), 'Valor atual']}
                  />
                  <Legend
                    formatter={(value) => <span className="text-xs">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bulk action bar */}
      {someSelected && (
        <div className="flex items-center justify-between bg-primary/10 border border-primary/20 rounded-lg px-4 py-2.5 gap-3">
          <span className="text-sm font-medium">
            {selectedIds.size} selecionado{selectedIds.size !== 1 ? 's' : ''}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set())}>
              Limpar
            </Button>
            <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              Excluir selecionados
            </Button>
          </div>
        </div>
      )}

      {/* Investments list */}
      {investments.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhum investimento cadastrado</p>
          <p className="text-sm mt-1">Clique em "Novo Investimento" para começar.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Select all toggle */}
          <div className="col-span-full flex items-center gap-2 px-1">
            <Checkbox
              checked={allSelected}
              onCheckedChange={toggleSelectAll}
              className={someSelected && !allSelected ? 'opacity-60' : ''}
            />
            <span className="text-xs text-muted-foreground">Selecionar todos</span>
          </div>

          {investments.map(inv => {
            const rent = inv.currentValue - inv.initialValue;
            const rentPct = inv.initialValue > 0 ? (rent / inv.initialValue) * 100 : 0;
            const isSelected = selectedIds.has(inv.id);

            return (
              <Card
                key={inv.id}
                className={cn(
                  'relative transition-all hover-elevate',
                  isSelected && 'ring-2 ring-primary/40',
                )}
              >
                {/* Checkbox overlay */}
                <div className="absolute top-3 left-3 z-10">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleSelect(inv.id)}
                  />
                </div>

                <CardContent className="pt-5 pl-10">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-sm truncate">{inv.name}</h3>
                        <Badge
                          variant="outline"
                          className="text-xs shrink-0"
                          style={{ borderColor: TYPE_COLORS[inv.type] + '60', color: TYPE_COLORS[inv.type] }}
                        >
                          {INVESTMENT_TYPE_LABELS[inv.type]}
                        </Badge>
                      </div>
                      {inv.institution && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Building2 className="w-3 h-3" /> {inv.institution}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        variant="ghost" size="icon" className="w-7 h-7"
                        title="Registrar aporte/resgate"
                        onClick={() => setTxDialogTarget(inv)}
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => openEdit(inv)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className="w-7 h-7 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(inv.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mt-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Investido</p>
                      <p className="font-medium text-sm">{mask(inv.initialValue)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Atual</p>
                      <p className="font-semibold text-sm">{mask(inv.currentValue)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Rentab.</p>
                      <p className={cn('font-semibold text-sm', rent >= 0 ? 'text-success' : 'text-destructive')}>
                        {hideValues ? '••••' : (
                          <span className="flex items-center gap-0.5">
                            {rent >= 0
                              ? <ArrowUpCircle className="w-3 h-3" />
                              : <ArrowDownCircle className="w-3 h-3" />}
                            {rentPct.toFixed(1)}%
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t">
                    <Button
                      variant="outline" size="sm"
                      className="w-full text-xs gap-1.5"
                      onClick={() => setTxDialogTarget(inv)}
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Registrar aporte / resgate
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialogs */}
      <InvestmentFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
        onSave={handleSaveInvestment}
      />
      <InvTxDialog
        open={!!txDialogTarget}
        onOpenChange={open => { if (!open) setTxDialogTarget(null); }}
        investment={txDialogTarget}
        onSave={handleSaveTx}
      />
    </div>
  );
};
