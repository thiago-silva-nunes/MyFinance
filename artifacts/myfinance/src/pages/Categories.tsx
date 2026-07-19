import React, { useState } from 'react';
import { useFinance } from '@/context/FinanceContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { getIcon } from '@/components/IconMap';
import { CategoryFormDialog } from '@/components/CategoryFormDialog';
import { Category, Subcategory } from '@/data/mockData';
import { DRE_GROUP_OPTIONS, DRE_GROUP_LABEL } from '@/services/dataService';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Plus, Edit2, Trash2, ChevronDown, ChevronRight, Tag, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ─── Subcategory inline form ──────────────────────────────────────────────────

interface SubcategoryRowFormProps {
  categoryId: string;
  sub?: Subcategory | null;
  onSave: () => void;
  onCancel: () => void;
}

const SubcategoryRowForm = ({ categoryId, sub, onSave, onCancel }: SubcategoryRowFormProps) => {
  const { addSubcategory, updateSubcategory } = useFinance();
  const [name, setName] = useState(sub?.name ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) { toast.error('Nome é obrigatório'); return; }
    setSaving(true);
    try {
      if (sub) {
        await updateSubcategory(sub.id, { name: trimmed });
        toast.success('Subcategoria atualizada');
      } else {
        await addSubcategory({ categoryId, name: trimmed });
        toast.success('Subcategoria adicionada');
      }
      onSave();
    } catch (err: unknown) {
      const { extractErrorMessage } = await import('@/services/dataService');
      toast.error(`Erro: ${extractErrorMessage(err)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-2 px-3 py-1.5">
      <Input
        autoFocus
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onCancel(); }}
        placeholder="Nome da subcategoria"
        className="h-7 text-sm"
      />
      <Button size="sm" className="h-7 px-2 text-xs" onClick={handleSave} disabled={saving}>
        {saving ? '...' : 'Salvar'}
      </Button>
      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onCancel}>
        Cancelar
      </Button>
    </div>
  );
};

// ─── Subcategory list inside a category card ─────────────────────────────────

interface SubcategoryPanelProps {
  category: Category;
}

const SubcategoryPanel = ({ category }: SubcategoryPanelProps) => {
  const { subcategories, deleteSubcategory, transactions } = useFinance();
  const [editingSub, setEditingSub] = useState<Subcategory | null>(null);
  const [addingNew, setAddingNew] = useState(false);

  const catSubs = subcategories.filter(s => s.categoryId === category.id);

  const handleDeleteSub = async (sub: Subcategory) => {
    const inUse = transactions.some(t => t.subcategoryId === sub.id);
    if (!confirm(
      inUse
        ? `A subcategoria "${sub.name}" possui lançamentos vinculados. Eles continuarão na categoria pai. Excluir mesmo assim?`
        : `Excluir subcategoria "${sub.name}"?`
    )) return;
    try {
      await deleteSubcategory(sub.id);
      toast.success('Subcategoria excluída');
    } catch (err: unknown) {
      const { extractErrorMessage } = await import('@/services/dataService');
      toast.error(`Erro: ${extractErrorMessage(err)}`);
    }
  };

  return (
    <div className="bg-muted/30 border-t divide-y divide-border/50">
      {catSubs.map(sub => (
        <div key={sub.id}>
          {editingSub?.id === sub.id ? (
            <SubcategoryRowForm
              categoryId={category.id}
              sub={sub}
              onSave={() => setEditingSub(null)}
              onCancel={() => setEditingSub(null)}
            />
          ) : (
            <div className="flex items-center justify-between px-4 py-2 group/sub">
              <div className="flex items-center gap-2">
                <Tag className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-sm">{sub.name}</span>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover/sub:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingSub(sub)}>
                  <Edit2 className="w-3 h-3 text-muted-foreground" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-destructive/10" onClick={() => handleDeleteSub(sub)}>
                  <Trash2 className="w-3 h-3 text-destructive" />
                </Button>
              </div>
            </div>
          )}
        </div>
      ))}

      {addingNew ? (
        <SubcategoryRowForm
          categoryId={category.id}
          onSave={() => setAddingNew(false)}
          onCancel={() => setAddingNew(false)}
        />
      ) : (
        <button
          className="w-full flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          onClick={() => setAddingNew(true)}
        >
          <Plus className="w-3.5 h-3.5" />
          Adicionar subcategoria
        </button>
      )}
    </div>
  );
};

// ─── Bulk DRE edit dialog ─────────────────────────────────────────────────────

interface BulkDreDialogProps {
  open: boolean;
  count: number;
  onConfirm: (dreGroup: string) => Promise<void>;
  onClose: () => void;
}

const BulkDreDialog = ({ open, count, onConfirm, onClose }: BulkDreDialogProps) => {
  const [selected, setSelected] = useState('');
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    if (!selected) { toast.error('Selecione uma classificação'); return; }
    setSaving(true);
    try {
      await onConfirm(selected);
      setSelected('');
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { setSelected(''); onClose(); } }}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Editar classificação DRE</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Alterar classificação de <strong>{count}</strong> {count === 1 ? 'categoria selecionada' : 'categorias selecionadas'}.
        </p>
        <div className="py-2">
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione a classificação..." />
            </SelectTrigger>
            <SelectContent>
              {DRE_GROUP_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { setSelected(''); onClose(); }}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={saving || !selected}>
            {saving ? 'Salvando...' : 'Confirmar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────

export const Categories = () => {
  const { categories, subcategories, deleteCategory, deleteCategories, bulkUpdateCategories, transactions, scheduled } = useFinance();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

  // Bulk selection
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dreDialogOpen, setDreDialogOpen] = useState(false);

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelected(s => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const clearSelection = () => setSelected(new Set());

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    const isUsedInTransactions = transactions.some(t => t.categoryId === id);
    const isUsedInScheduled = scheduled.some(s => s.categoryId === id);

    if (isUsedInTransactions || isUsedInScheduled) {
      toast.error('Não é possível excluir uma categoria que está em uso.');
      return;
    }

    if (!confirm('Tem certeza que deseja excluir esta categoria?')) return;
    try {
      await deleteCategory(id);
      toast.success('Categoria excluída');
    } catch (err: unknown) {
      const { extractErrorMessage } = await import('@/services/dataService');
      toast.error(`Erro: ${extractErrorMessage(err)}`);
    }
  };

  const handleBulkDelete = async () => {
    const ids = [...selected];

    // Integrity check: same rule as individual delete
    const blocked = ids.filter(id =>
      transactions.some(t => t.categoryId === id) ||
      scheduled.some(s => s.categoryId === id)
    );

    if (blocked.length > 0) {
      const names = blocked.map(id => categories.find(c => c.id === id)?.name ?? id).join(', ');
      toast.error(`Não é possível excluir categorias em uso: ${names}`);
      return;
    }

    if (!confirm(`Tem certeza? Isso também removerá as subcategorias associadas das ${ids.length} categorias selecionadas.`)) return;

    try {
      await deleteCategories(ids);
      toast.success(`${ids.length} ${ids.length === 1 ? 'categoria excluída' : 'categorias excluídas'}`);
      clearSelection();
    } catch (err: unknown) {
      const { extractErrorMessage } = await import('@/services/dataService');
      toast.error(`Erro: ${extractErrorMessage(err)}`);
    }
  };

  const handleBulkDre = async (dreGroup: string) => {
    const ids = [...selected];
    await bulkUpdateCategories(ids, { dreGroup });
    toast.success(`Classificação DRE atualizada para ${ids.length} ${ids.length === 1 ? 'categoria' : 'categorias'}: ${DRE_GROUP_LABEL[dreGroup] ?? dreGroup}`);
    clearSelection();
  };

  const openNewForm = () => {
    setEditingCategory(null);
    setIsFormOpen(true);
  };

  const toggleExpand = (id: string) => {
    setExpandedCats(s => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const getSubCount = (catId: string) => subcategories.filter(s => s.categoryId === catId).length;

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Categorias</h1>
          <p className="text-muted-foreground">Personalize as categorias e subcategorias para organizar seus gastos.</p>
        </div>
        <Button onClick={openNewForm} className="w-full md:w-auto shadow-sm hover-elevate">
          <Plus className="w-4 h-4 mr-2" />
          Nova Categoria
        </Button>
      </div>

      {/* ── Bulk action bar ─────────────────────────────────────────────── */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-primary/5 border border-primary/20 rounded-xl">
          <span className="text-sm font-medium text-primary flex-1">
            {selected.size} {selected.size === 1 ? 'categoria selecionada' : 'categorias selecionadas'}
          </span>
          <Button size="sm" variant="outline" onClick={() => setDreDialogOpen(true)}>
            Editar classificação DRE
          </Button>
          <Button size="sm" variant="destructive" onClick={handleBulkDelete}>
            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
            Excluir selecionadas
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={clearSelection}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {categories.map((cat) => {
          const Icon = getIcon(cat.icon);
          const isExpanded = expandedCats.has(cat.id);
          const isChecked = selected.has(cat.id);
          const subCount = getSubCount(cat.id);

          return (
            <Card key={cat.id} className={cn(
              'hover-elevate transition-all overflow-hidden group',
              isExpanded && 'ring-1 ring-ring/20',
              isChecked && 'ring-2 ring-primary/40',
            )}>
              <CardContent className="p-0">
                {/* Category header */}
                <div className="p-4 flex items-center justify-between">
                  {/* Checkbox — stops propagation so it doesn't trigger expand */}
                  <div
                    className="flex items-center gap-3 min-w-0 flex-1"
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="relative flex-shrink-0">
                      {/* Checkbox overlaid on icon, visible on hover or when selected */}
                      <div className={cn(
                        'absolute inset-0 flex items-center justify-center rounded-xl transition-opacity z-10',
                        isChecked || selected.size > 0 ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
                      )}>
                        <Checkbox
                          checked={isChecked}
                          onClick={e => toggleSelect(cat.id, e)}
                          className="bg-background border-2 shadow-sm"
                        />
                      </div>
                      <div
                        className={cn(
                          'w-10 h-10 rounded-xl flex items-center justify-center shadow-sm transition-opacity',
                          isChecked || selected.size > 0 ? 'opacity-0' : 'opacity-100 group-hover:opacity-0',
                        )}
                        style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{cat.name}</p>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-transparent bg-muted">
                          {cat.type === 'income' ? 'Receita' : 'Despesa'}
                        </Badge>
                        {subCount > 0 && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                            {subCount} sub
                          </Badge>
                        )}
                        {cat.dreGroup && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-primary/30 text-primary/70">
                            {DRE_GROUP_LABEL[cat.dreGroup] ?? cat.dreGroup}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action bar (edit/delete/expand) */}
                <div className="bg-muted/50 px-3 py-2 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => toggleExpand(cat.id)}
                  >
                    {isExpanded
                      ? <><ChevronDown className="w-3.5 h-3.5" /> Ocultar subcategorias</>
                      : <><ChevronRight className="w-3.5 h-3.5" /> {subCount > 0 ? `Ver ${subCount} subcategoria${subCount > 1 ? 's' : ''}` : 'Adicionar subcategorias'}</>
                    }
                  </button>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(cat)}>
                      <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive" onClick={() => handleDelete(cat.id)}>
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>

                {/* Subcategory panel */}
                {isExpanded && <SubcategoryPanel category={cat} />}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {categories.length === 0 && (
        <div className="text-center py-12 bg-card rounded-xl border border-dashed">
          <p className="text-muted-foreground">Nenhuma categoria encontrada.</p>
          <Button variant="link" onClick={openNewForm} className="mt-2">
            Criar primeira categoria
          </Button>
        </div>
      )}

      <CategoryFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        category={editingCategory}
      />

      <BulkDreDialog
        open={dreDialogOpen}
        count={selected.size}
        onConfirm={handleBulkDre}
        onClose={() => setDreDialogOpen(false)}
      />
    </div>
  );
};
