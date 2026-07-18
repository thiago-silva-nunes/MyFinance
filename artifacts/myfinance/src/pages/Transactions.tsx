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
import { TransferFormDialog } from '@/components/TransferFormDialog';
import { Transaction, Transfer } from '@/data/mockData';
import { Search, Plus, Edit2, Trash2, CheckCircle, Layers, Loader2, ArrowRightLeft, Copy, Pencil } from 'lucide-react';
import { BulkEditTransactionsDialog } from '@/components/BulkEditTransactionsDialog';
import { toast } from 'sonner';

interface InstallmentDeleteTarget {
  id: string;
  groupId: string;
  num: number;
  total: number;
  description: string;
}

// Unified row type for rendering both transactions and transfers
type ListItem =
  | { kind: 'transaction'; data: Transaction }
  | { kind: 'transfer';    data: Transfer };

export const Transactions = () => {
  const {
    transactions, categories, banks, transfers,
    deleteTransaction, deleteTransactions, deleteInstallmentGroup, updateTransaction, bulkUpdateTransactions,
    deleteTransfer, loadMoreTransactions, hasMoreTransactions,
  } = useFinance();
  const { hideValues } = usePrivacy();
  const mask = (amount: number) => hideValues ? 'R$ ••••••' : formatCurrency(amount);

  const [searchTerm, setSearchTerm]       = useState('');
  const [typeFilter, setTypeFilter]       = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter]   = useState<string>('all');
  const [bankFilter, setBankFilter]       = useState<string>('all');

  const [isFormOpen, setIsFormOpen]               = useState(false);
  const [editingTransaction, setEditingTransaction]   = useState<Transaction | null>(null);
  const [duplicatingTransaction, setDuplicatingTransaction] = useState<Transaction | null>(null);
  const [isTransferFormOpen, setIsTransferFormOpen]   = useState(false);
  const [editingTransfer, setEditingTransfer]         = useState<Transfer | null>(null);
  const [installmentDeleteTarget, setInstallmentDeleteTarget] = useState<InstallmentDeleteTarget | null>(null);

  // ── Batch selection (transactions only) ──────────────────────────────────
  const [selectedIds, setSelectedIds]     = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [bulkEditOpen, setBulkEditOpen]   = useState(false);

  // Build lookup maps for banks
  const bankNameMap = useMemo(() => {
    const m: Record<string, string> = {};
    banks.forEach(b => { m[b.id] = b.name; });
    return m;
  }, [banks]);

  const bankColorMap = useMemo(() => {
    const m: Record<string, string> = {};
    banks.forEach(b => { m[b.id] = b.color; });
    return m;
  }, [banks]);

  // ── Filtered transactions ─────────────────────────────────────────────────
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      if (searchTerm && !t.description.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      if (typeFilter !== 'all' && t.type !== typeFilter) return false;
      if (categoryFilter !== 'all' && t.categoryId !== categoryFilter) return false;
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (bankFilter !== 'all' && t.bankId !== bankFilter) return false;
      return true;
    });
  }, [transactions, searchTerm, typeFilter, categoryFilter, statusFilter, bankFilter]);

  // ── Filtered transfers (hidden when type or status filters are active) ────
  const filteredTransfers = useMemo(() => {
    if (typeFilter !== 'all' || statusFilter !== 'all') return [];
    return transfers.filter(t => {
      if (bankFilter !== 'all' && t.fromBankId !== bankFilter && t.toBankId !== bankFilter) return false;
      if (categoryFilter !== 'all') return false; // transfers have no category
      if (searchTerm) {
        const from = bankNameMap[t.fromBankId] ?? '';
        const to   = bankNameMap[t.toBankId] ?? '';
        const combined = `transferência ${from} ${to}`.toLowerCase();
        if (!combined.includes(searchTerm.toLowerCase())) return false;
      }
      return true;
    });
  }, [transfers, bankFilter, typeFilter, statusFilter, categoryFilter, searchTerm, bankNameMap]);

  // ── Combined list sorted by date desc ────────────────────────────────────
  const combinedList = useMemo<ListItem[]>(() => {
    const txns: ListItem[] = filteredTransactions.map(data => ({ kind: 'transaction', data }));
    const tfrs: ListItem[] = filteredTransfers.map(data => ({ kind: 'transfer', data }));
    return [...txns, ...tfrs].sort((a, b) => b.data.date.localeCompare(a.data.date));
  }, [filteredTransactions, filteredTransfers]);

  // Clear selection when filters change
  useEffect(() => { setSelectedIds(new Set()); }, [searchTerm, typeFilter, categoryFilter, statusFilter, bankFilter]);

  const allSelected  = filteredTransactions.length > 0 && filteredTransactions.every(t => selectedIds.has(t.id));
  const someSelected = filteredTransactions.some(t => selectedIds.has(t.id));

  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredTransactions.map(t => t.id)));
  };
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const handleBulkDelete = async () => {
    setIsBulkDeleting(true);
    try {
      const ids = [...selectedIds];
      await deleteTransactions(ids);
      toast.success(`${ids.length} transaç${ids.length === 1 ? 'ão excluída' : 'ões excluídas'}`);
      setSelectedIds(new Set());
      setBulkDeleteOpen(false);
    } catch { toast.error('Erro ao excluir transações'); }
    finally { setIsBulkDeleting(false); }
  };

  const handleEdit = (t: Transaction) => { setEditingTransaction(t); setDuplicatingTransaction(null); setIsFormOpen(true); };
  const handleDuplicate = (t: Transaction) => { setDuplicatingTransaction(t); setEditingTransaction(null); setIsFormOpen(true); };

  const handleDelete = (t: Transaction) => {
    if (t.installmentGroupId) {
      setInstallmentDeleteTarget({ id: t.id, groupId: t.installmentGroupId, num: t.installmentNumber ?? 1, total: t.installmentTotal ?? 1, description: t.description });
    } else {
      if (confirm('Tem certeza que deseja excluir esta transação?')) {
        deleteTransaction(t.id);
        toast.success('Transação excluída');
      }
    }
  };

  const handleDeleteTransfer = async (t: Transfer) => {
    const from = bankNameMap[t.fromBankId] ?? 'origem';
    const to   = bankNameMap[t.toBankId] ?? 'destino';
    if (!confirm(`Excluir transferência de ${from} → ${to}?`)) return;
    try { await deleteTransfer(t.id); toast.success('Transferência excluída'); }
    catch { toast.error('Erro ao excluir transferência'); }
  };

  const handleEditTransfer = (t: Transfer) => { setEditingTransfer(t); setIsTransferFormOpen(true); };

  const toggleStatus = (t: Transaction) => {
    const newStatus = t.status === 'paid' ? 'pending' : 'paid';
    updateTransaction(t.id, { status: newStatus });
    toast.success(`Marcado como ${newStatus === 'paid' ? 'pago' : 'pendente'}`);
  };

  const openNewForm = () => { setEditingTransaction(null); setDuplicatingTransaction(null); setIsFormOpen(true); };
  const openNewTransfer = () => { setEditingTransfer(null); setIsTransferFormOpen(true); };

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transações</h1>
          <p className="text-muted-foreground">Gerencie todas as suas entradas, saídas e transferências.</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          {banks.length >= 2 && (
            <Button variant="outline" onClick={openNewTransfer} className="flex-1 md:flex-none">
              <ArrowRightLeft className="w-4 h-4 mr-2" />
              Transferência
            </Button>
          )}
          <Button onClick={openNewForm} className="flex-1 md:flex-none shadow-sm hover-elevate">
            <Plus className="w-4 h-4 mr-2" />
            Nova Transação
          </Button>
        </div>
      </div>

      <div className="bg-card border rounded-xl p-4 space-y-4 shadow-sm">
        {/* Filters */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="relative col-span-2 md:col-span-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
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

          <Select value={bankFilter} onValueChange={setBankFilter}>
            <SelectTrigger><SelectValue placeholder="Conta" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as contas</SelectItem>
              {banks.map(b => (
                <SelectItem key={b.id} value={b.id}>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: b.color }} />
                    {b.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Bulk action bar */}
        {someSelected && (
          <div className="flex items-center justify-between bg-primary/10 border border-primary/20 rounded-lg px-4 py-2.5 gap-3">
            <span className="text-sm font-medium">
              {selectedIds.size} selecionada{selectedIds.size !== 1 ? 's' : ''}
            </span>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set())}>
                Limpar seleção
              </Button>
              {selectedIds.size === 1 && (() => {
                const singleId = [...selectedIds][0];
                const singleTx = filteredTransactions.find(t => t.id === singleId);
                return singleTx ? (
                  <Button variant="outline" size="sm" onClick={() => handleDuplicate(singleTx)}>
                    <Copy className="w-3.5 h-3.5 mr-1.5" />
                    Duplicar selecionada
                  </Button>
                ) : null;
              })()}
              <Button variant="outline" size="sm" onClick={() => setBulkEditOpen(true)}>
                <Pencil className="w-3.5 h-3.5 mr-1.5" />
                Editar selecionadas
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setBulkDeleteOpen(true)}>
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                Excluir selecionadas
              </Button>
            </div>
          </div>
        )}

        {/* Table */}
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
                <TableHead>Conta</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {combinedList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Nenhuma transação encontrada.
                  </TableCell>
                </TableRow>
              ) : (
                combinedList.map(item => {
                  // ── Transfer row ──────────────────────────────────────────
                  if (item.kind === 'transfer') {
                    const tf = item.data;
                    const fromName = bankNameMap[tf.fromBankId] ?? 'Origem';
                    const toName   = bankNameMap[tf.toBankId] ?? 'Destino';
                    return (
                      <TableRow key={`tf-${tf.id}`} className="bg-muted/20">
                        {/* no checkbox for transfers */}
                        <TableCell />
                        <TableCell className="whitespace-nowrap text-muted-foreground">{formatShortDate(tf.date)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <ArrowRightLeft className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <span className="font-medium text-muted-foreground">Transferência</span>
                            {tf.notes && (
                              <span className="text-xs text-muted-foreground/60 truncate max-w-[120px]">· {tf.notes}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[10px]">Transferência</Badge>
                        </TableCell>
                        {/* Conta column — from → to */}
                        <TableCell>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: bankColorMap[tf.fromBankId] }} />
                            <span>{fromName}</span>
                            <span className="mx-0.5">→</span>
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: bankColorMap[tf.toBankId] }} />
                            <span>{toName}</span>
                          </div>
                        </TableCell>
                        <TableCell>—</TableCell>
                        <TableCell className="text-right font-medium text-muted-foreground whitespace-nowrap">
                          {mask(tf.amount)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => handleEditTransfer(tf)}>
                              <Edit2 className="w-4 h-4 text-muted-foreground" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteTransfer(tf)}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  }

                  // ── Transaction row ───────────────────────────────────────
                  const t = item.data;
                  const cat = categories.find(c => c.id === t.categoryId);
                  const Icon = getIcon(cat?.icon || 'more-horizontal');
                  const isInstallment = !!(t.installmentGroupId && t.installmentNumber && t.installmentTotal);
                  const isSelected = selectedIds.has(t.id);

                  return (
                    <TableRow
                      key={t.id}
                      className={`cursor-pointer transition-colors ${isSelected ? 'bg-primary/5' : 'hover:bg-muted/50'}`}
                      onClick={() => handleEdit(t)}
                    >
                      <TableCell onClick={e => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(t.id)}
                          aria-label={`Selecionar ${t.description}`}
                        />
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{formatShortDate(t.date)}</TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-1.5">
                          {isInstallment && <Layers className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                          <span>{t.description}</span>
                          {isInstallment && (
                            <span className="text-xs text-muted-foreground font-normal whitespace-nowrap">
                              ({t.installmentNumber}/{t.installmentTotal})
                            </span>
                          )}
                          {t.isBalanceAdjustment && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 shrink-0">Ajuste</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {cat ? (
                          <div className="flex items-center gap-2">
                            <Icon className="w-4 h-4" style={{ color: cat.color }} />
                            <span>{cat.name}</span>
                          </div>
                        ) : '—'}
                      </TableCell>
                      {/* Conta column */}
                      <TableCell>
                        {t.bankId && bankNameMap[t.bankId] ? (
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: bankColorMap[t.bankId] }} />
                            <span className="text-sm whitespace-nowrap">{bankNameMap[t.bankId]}</span>
                          </div>
                        ) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell onClick={e => e.stopPropagation()}>
                        <Badge variant={t.status === 'paid' ? 'success' : 'secondary'} className="cursor-pointer" onClick={() => toggleStatus(t)}>
                          {t.status === 'paid' ? 'Pago' : 'Pendente'}
                        </Badge>
                      </TableCell>
                      <TableCell className={`text-right font-medium whitespace-nowrap ${t.type === 'income' ? 'text-success' : ''}`}>
                        {t.type === 'income' ? '+' : '-'}{mask(t.amount)}
                      </TableCell>
                      <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => toggleStatus(t)} title="Alternar status">
                            <CheckCircle className={`w-4 h-4 ${t.status === 'paid' ? 'text-success' : 'text-muted-foreground'}`} />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDuplicate(t)} title="Duplicar transação">
                            <Copy className="w-4 h-4 text-muted-foreground" />
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

      {/* Load more — shown when there may be older transactions beyond the current page */}
      {hasMoreTransactions && (
        <div className="flex justify-center pt-2 pb-4">
          <Button variant="outline" onClick={loadMoreTransactions} className="gap-2">
            <Loader2 className="w-4 h-4" />
            Carregar mais transações
          </Button>
        </div>
      )}

      {/* Transaction form */}
      <TransactionFormDialog
        open={isFormOpen}
        onOpenChange={(open) => {
          setIsFormOpen(open);
          if (!open) { setEditingTransaction(null); setDuplicatingTransaction(null); }
        }}
        transaction={editingTransaction}
        duplicateFrom={duplicatingTransaction}
      />

      {/* Transfer form */}
      <TransferFormDialog
        open={isTransferFormOpen}
        onOpenChange={(open) => { setIsTransferFormOpen(open); if (!open) setEditingTransfer(null); }}
        transfer={editingTransfer}
      />

      {/* Installment delete dialog */}
      <Dialog open={!!installmentDeleteTarget} onOpenChange={open => { if (!open) setInstallmentDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader><DialogTitle>Excluir compra parcelada</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            <strong>"{installmentDeleteTarget?.description}"</strong> é a parcela{' '}
            <strong>{installmentDeleteTarget?.num}/{installmentDeleteTarget?.total}</strong>.
            O que deseja excluir?
          </p>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" className="sm:mr-auto" onClick={() => setInstallmentDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={async () => {
              if (!installmentDeleteTarget) return;
              await deleteTransaction(installmentDeleteTarget.id);
              toast.success('Parcela excluída');
              setInstallmentDeleteTarget(null);
            }}>Só esta parcela</Button>
            <Button variant="destructive" onClick={async () => {
              if (!installmentDeleteTarget) return;
              await deleteInstallmentGroup(installmentDeleteTarget.groupId);
              toast.success(`${installmentDeleteTarget.total} parcelas excluídas`);
              setInstallmentDeleteTarget(null);
            }}>Todas ({installmentDeleteTarget?.total}x)</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk edit dialog */}
      <BulkEditTransactionsDialog
        open={bulkEditOpen}
        onOpenChange={setBulkEditOpen}
        selectedIds={[...selectedIds]}
        onDone={() => setSelectedIds(new Set())}
      />

      {/* Bulk delete confirmation */}
      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader><DialogTitle>Excluir {selectedIds.size} transaç{selectedIds.size === 1 ? 'ão' : 'ões'}?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja excluir{' '}
            <strong>{selectedIds.size} transaç{selectedIds.size === 1 ? 'ão' : 'ões'}</strong>? Essa ação não pode ser desfeita.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)} disabled={isBulkDeleting}>Cancelar</Button>
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
