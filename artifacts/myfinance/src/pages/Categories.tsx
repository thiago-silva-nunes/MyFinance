import React, { useState } from 'react';
import { useFinance } from '@/context/FinanceContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getIcon } from '@/components/IconMap';
import { CategoryFormDialog } from '@/components/CategoryFormDialog';
import { Category } from '@/data/mockData';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export const Categories = () => {
  const { categories, deleteCategory, transactions, scheduled } = useFinance();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setIsFormOpen(true);
  };

  const handleDelete = (id: string) => {
    // Check if category is in use
    const isUsedInTransactions = transactions.some(t => t.categoryId === id);
    const isUsedInScheduled = scheduled.some(s => s.categoryId === id);

    if (isUsedInTransactions || isUsedInScheduled) {
      toast.error('Não é possível excluir uma categoria que está em uso.');
      return;
    }

    if (confirm('Tem certeza que deseja excluir esta categoria?')) {
      deleteCategory(id);
      toast.success('Categoria excluída');
    }
  };

  const openNewForm = () => {
    setEditingCategory(null);
    setIsFormOpen(true);
  };

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Categorias</h1>
          <p className="text-muted-foreground">Personalize as categorias para organizar seus gastos.</p>
        </div>
        <Button onClick={openNewForm} className="w-full md:w-auto shadow-sm hover-elevate">
          <Plus className="w-4 h-4 mr-2" />
          Nova Categoria
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {categories.map((cat) => {
          const Icon = getIcon(cat.icon);
          return (
            <Card key={cat.id} className="hover-elevate transition-all overflow-hidden group">
              <CardContent className="p-0">
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm" 
                      style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{cat.name}</p>
                      <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 mt-1 border-transparent bg-muted">
                        {cat.type === 'income' ? 'Receita' : 'Despesa'}
                      </Badge>
                    </div>
                  </div>
                </div>
                
                <div className="bg-muted/50 px-4 py-2 flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(cat)}>
                    <Edit2 className="w-4 h-4 text-muted-foreground" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive" onClick={() => handleDelete(cat.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
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