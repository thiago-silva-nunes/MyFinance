import React, { useState, useMemo, useEffect } from 'react';
import { useFinance } from '@/context/FinanceContext';
import { usePrivacy } from '@/context/PrivacyContext';
import { formatCurrency, formatShortDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { getIcon } from '@/components/IconMap';
import { TransactionFormDialog } from '@/components/TransactionFormDialog';
import { Transaction } from '@/data/mockData';
import { Search, Plus, Edit2, Trash2, CheckCircle, Layers, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface InstallmentDeleteTarget {
  id: string;
  groupId: string;
  num: number;
  total: number;
  description: string;
}

export const Transactions = () => {
  const { transactions, categories, deleteTransaction, deleteTransactions, deleteInstallmentGroup, updateTransaction } = useFinance();
  const { hideValues } = usePrivacy();
  const mask = (amount: number) => hideValues ? 'R$ ••••••' : formatCurrency(amount);

  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [installmentDeleteTarget, setInstallmentDeleteTarget] = useState<InstallmentDeleteTarget | null>(null);

  // ── Batch selection ──────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const filteredTransactions = useMemo(() => {
    return transactions
      .filter(t => {
        if (searchTerm && !t.description.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        if (typeFilter !== 'all' && t.type !== typeFilter) return false;
        if (categoryFilter !== 'all' && t.categoryId !== categoryFilter) return false;
        if (statusFilter !== 'all' && t.status !== statusFilter) return false;
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions, searchTerm, typeFilter, categoryFilter, statusFilter]);

  // Clear selection whenever filters or data change
  useEffect(() => { setSelectedIds(new Set()); }, [searchTerm, typeFilter, categoryFilter, statusFilter]);

  const allSelected = filteredTransactions.length > 0 && filteredTransactions.every(t => selectedIds.has(t.id));
  const someSelected = filteredTransactions.some(t => selectedIds.has(t.id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredTransactions.map(t => t.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    setIsBulkDeleting(true);
    try {
      const ids = [...selectedIds];
      await deleteTransactions(ids);
      toast.success(`${ids.length} transaç${ids.length === 1 ? 'ão excluída' : 'ões excluídas'}`);
      setSelectedIds(new Set());
      setBulkDeleteOpen(false);
    } catch (err) {
      toast.error('Erro ao excluir transações');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setIsFormOpen(true);
  };

  const handleDelete = (t: Transaction) => {
    if (t.installmentGroupId) {
      setInstallmentDeleteTarget({
        id: t.id,
        groupId: t.installmentGroupId,
        num: t.installmentNumber ?? 1,
        total: t.installmentTotal ?? 1,
        description: t.description,
      });
    } else {
      if (confirm('Tem certeza que deseja excluir esta transação?')) {
        deleteTransaction(t.id);
        toast.success('Transação excluída');
      }
    }
  };

  const toggleStatus = (transaction: Transaction) => {
    const newStatus = transaction.status === 'paid' ? 'pending' : 'paid';
    updateTransaction(transaction.id, { status: newStatus });
    toast.success(`Marcado como ${newStatus === 'paid' ? 'pago' : 'pendente'}`);
  };

  const openNewForm = () => {
    setEditingTransaction(null);
    setIsFormOpen(true);
  };

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transações</h1>
          <p className="text-muted-foreground">Gerencie todas as suas entradas e saídas.</p>
        </div>
        <Button onClick={openNewForm} className="w-full md:w-auto shadow-sm hover-elevate">
          <Plus className="w-4 h-4 mr-2" />
          Nova Transação
        </Button>
      </div>

      <div className="bg-card border rounded-xl p-4 space-y-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar descrição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="income">Receita</SelectItem>
              <SelectItem value="expense">Despesa</SelectItem>
            </SelectContent>
          </Select>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas categorias</SelectItem>
              {categories.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="paid">Pago</SelectItem>
              <SelectItem value="pending">Pendente</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Bulk action bar */}
        {someSelected && (
          <div className="flex items-center justify-between bg-primary/10 border border-primary/20 rounded-lg px-4 py-2.5 gap-3">
            <span className="text-sm font-medium">
              {selectedIds.size} selecionada{selectedIds.size !== 1 ? 's' : ''}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set())}>
                Limpar seleção
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setBulkDeleteOpen(true)}>
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                Excluir selecionadas
              </Button>
            </div>
          </div>
        )}

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Selecionar todas"
                    className={someSelected && !allSelected ? 'opacity-60' : ''}
                  />
                </TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTransactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhuma transação encontrada.
                  </TableCell>
                </TableRow>
              ) : (
                filteredTransactions.map((t) => {
                  const cat = categories.find(c => c.id === t.categoryId);
                  const Icon = getIcon(cat?.icon || 'more-horizontal');
                  const isInstallment = !!(t.installmentGroupId && t.installmentNumber && t.installmentTotal);
                  const isSelected = selectedIds.has(t.id);
                  return (
                    <TableRow key={t.id} className={isSelected ? 'bg-primary/5' : ''}>
                      <TableCell>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(t.id)}
                          aria-label={`Selecionar ${t.description}`}
                        />
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{formatShortDate(t.date)}</TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-1.5">
                          {isInstallment && (
                            <Layers className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          )}
                          <span>{t.description}</span>
                          {isInstallment && (
                            <span className="text-xs text-muted-foreground font-normal whitespace-nowrap">
                              ({t.installmentNumber}/{t.installmentTotal})
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {cat ? (
                          <div className="flex items-center gap-2">
                            <Icon className="w-4 h-4" style={{ color: cat.color }} />
                            <span>{cat.name}</span>
                          </div>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={t.status === 'paid' ? 'success' : 'secondary'} className="cursor-pointer" onClick={() => toggleStatus(t)}>
                          {t.status === 'paid' ? 'Pago' : 'Pendente'}
                        </Badge>
                      </TableCell>
                      <TableCell className={`text-right font-medium whitespace-nowrap ${t.type === 'income' ? 'text-success' : ''}`}>
                        {t.type === 'income' ? '+' : '-'}{mask(t.amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => toggleStatus(t)} title="Alternar status">
                            <CheckCircle className={`w-4 h-4 ${t.status === 'paid' ? 'text-success' : 'text-muted-foreground'}`} />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(t)}>
                            <Edit2 className="w-4 h-4 text-muted-foreground" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(t)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <TransactionFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        transaction={editingTransaction}
      />

      {/* Installment delete dialog */}
      <Dialog
        open={!!installmentDeleteTarget}
        onOpenChange={(open) => { if (!open) setInstallmentDeleteTarget(null); }}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Excluir compra parcelada</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            <strong>"{installmentDeleteTarget?.description}"</strong> é a parcela{' '}
            <strong>{installmentDeleteTarget?.num}/{installmentDeleteTarget?.total}</strong>.
            O que deseja excluir?
          </p>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" className="sm:mr-auto" onClick={() => setInstallmentDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!installmentDeleteTarget) return;
                await deleteTransaction(installmentDeleteTarget.id);
                toast.success('Parcela excluída');
                setInstallmentDeleteTarget(null);
              }}
            >
              Só esta parcela
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!installmentDeleteTarget) return;
                await deleteInstallmentGroup(installmentDeleteTarget.groupId);
                toast.success(`${installmentDeleteTarget.total} parcelas excluídas`);
                setInstallmentDeleteTarget(null);
              }}
            >
              Todas ({installmentDeleteTarget?.total}x)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk delete confirmation dialog */}
      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Excluir {selectedIds.size} transaç{selectedIds.size === 1 ? 'ão' : 'ões'}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja excluir{' '}
            <strong>{selectedIds.size} transaç{selectedIds.size === 1 ? 'ão' : 'ões'}</strong>?
            {' '}Essa ação não pode ser desfeita.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)} disabled={isBulkDeleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={isBulkDeleting}>
              {isBulkDeleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Excluir {selectedIds.size}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
