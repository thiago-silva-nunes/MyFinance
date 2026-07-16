import React from 'react';
import { useFinance } from '@/context/FinanceContext';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { IconMap, getIcon } from '@/components/IconMap';
import { toast } from 'sonner';
import { Category } from '@/data/mockData';

const categorySchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  type: z.enum(['income', 'expense']),
  color: z.string().min(4, 'Cor é obrigatória'),
  icon: z.string().min(1, 'Ícone é obrigatório'),
});

interface CategoryFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: Category | null;
}

const AVAILABLE_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', 
  '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e', '#64748b'
];

export const CategoryFormDialog = ({ open, onOpenChange, category }: CategoryFormProps) => {
  const { addCategory, updateCategory } = useFinance();
  
  const form = useForm<z.infer<typeof categorySchema>>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: '',
      type: 'expense',
      color: '#ef4444',
      icon: 'more-horizontal'
    }
  });

  React.useEffect(() => {
    if (open) {
      if (category) {
        form.reset(category);
      } else {
        form.reset({
          name: '',
          type: 'expense',
          color: '#ef4444',
          icon: 'more-horizontal'
        });
      }
    }
  }, [open, category, form]);

  const onSubmit = (data: z.infer<typeof categorySchema>) => {
    if (category) {
      updateCategory(category.id, data);
      toast.success('Categoria atualizada com sucesso');
    } else {
      addCategory(data);
      toast.success('Categoria adicionada com sucesso');
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{category ? 'Editar Categoria' : 'Nova Categoria'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo</FormLabel>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={field.value === 'expense' ? 'destructive' : 'outline'}
                      className="w-full"
                      onClick={() => field.onChange('expense')}
                    >
                      Despesa
                    </Button>
                    <Button
                      type="button"
                      variant={field.value === 'income' ? 'default' : 'outline'}
                      className="w-full bg-success text-success-foreground hover:bg-success/90"
                      onClick={() => field.onChange('income')}
                    >
                      Receita
                    </Button>
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Viagens" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cor</FormLabel>
                  <div className="flex flex-wrap gap-2 pt-2">
                    {AVAILABLE_COLORS.map(color => (
                      <button
                        key={color}
                        type="button"
                        className={`w-6 h-6 rounded-full transition-transform ${field.value === color ? 'scale-125 ring-2 ring-ring ring-offset-2' : 'hover:scale-110'}`}
                        style={{ backgroundColor: color }}
                        onClick={() => field.onChange(color)}
                      />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="icon"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ícone</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <div className="grid grid-cols-4 gap-2 p-2">
                        {Object.keys(IconMap).map((iconName) => {
                          const Icon = IconMap[iconName];
                          return (
                    <SelectItem
                      key={iconName}
                      value={iconName}
                      className="justify-center cursor-pointer"
                    >
                      <Icon className="w-5 h-5 mx-auto" />
                    </SelectItem>
                          );
                        })}
                      </div>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit">Salvar</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
