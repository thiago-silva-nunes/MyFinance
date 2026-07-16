import React, { useState } from 'react';
import { useFinance } from '@/context/FinanceContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { getIcon } from '@/components/IconMap';
import { CategoryFormDialog } from '@/components/CategoryFormDialog';
import { Category, Subcategory } from '@/data/mockData';
import { Plus, Edit2, Trash2, ChevronDown, ChevronRight, Tag } from 'lucide-react';
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

// ─── Main page ────────────────────────────────────────────────────────────────

export const Categories = () => {
  const { categories, subcategories, deleteCategory, transactions, scheduled } = useFinance();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

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

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {categories.map((cat) => {
          const Icon = getIcon(cat.icon);
          const isExpanded = expandedCats.has(cat.id);
          const subCount = getSubCount(cat.id);

          return (
            <Card key={cat.id} className={cn('hover-elevate transition-all overflow-hidden group', isExpanded && 'ring-1 ring-ring/20')}>
              <CardContent className="p-0">
                {/* Category header */}
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0"
                      style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{cat.name}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-transparent bg-muted">
                          {cat.type === 'income' ? 'Receita' : 'Despesa'}
                        </Badge>
                        {subCount > 0 && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                            {subCount} sub
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
    </div>
  );
};
