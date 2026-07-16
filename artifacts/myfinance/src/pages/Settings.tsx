import React, { useEffect } from 'react';
import { useFinance } from '@/context/FinanceContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Moon, Sun, DollarSign } from 'lucide-react';
import { toast } from 'sonner';

export const Settings = () => {
  const { settings, updateSettings } = useFinance();

  const handleThemeChange = (isDark: boolean) => {
    const newTheme = isDark ? 'dark' : 'light';
    updateSettings({ theme: newTheme });
    toast.success(`Tema ${isDark ? 'escuro' : 'claro'} ativado`);
  };

  const handleCurrencyChange = (val: string) => {
    updateSettings({ currency: val });
    toast.success('Moeda atualizada (Apenas visual, o app é fixado em BRL)');
  };

  // Sync dark mode class immediately when settings change in UI
  useEffect(() => {
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.theme]);

  return (
    <div className="space-y-6 pb-20 md:pb-0 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">Gerencie suas preferências do aplicativo.</p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Aparência</CardTitle>
            <CardDescription>Personalize o visual do seu painel financeiro.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-muted p-2 rounded-lg">
                  {settings.theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                </div>
                <div>
                  <Label className="text-base">Modo Escuro</Label>
                  <p className="text-sm text-muted-foreground">Alternar entre tema claro e escuro</p>
                </div>
              </div>
              <Switch 
                checked={settings.theme === 'dark'}
                onCheckedChange={handleThemeChange}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Preferências Regionais</CardTitle>
            <CardDescription>Configure como os dados são exibidos.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-muted p-2 rounded-lg">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <Label className="text-base">Moeda Principal</Label>
                  <p className="text-sm text-muted-foreground">A formatação padrão é R$</p>
                </div>
              </div>
              <div className="w-[150px]">
                <Select value={settings.currency} onValueChange={handleCurrencyChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BRL">BRL (R$)</SelectItem>
                    <SelectItem value="USD" disabled>USD ($)</SelectItem>
                    <SelectItem value="EUR" disabled>EUR (€)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dados</CardTitle>
            <CardDescription>Gerencie os dados armazenados no seu navegador.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-4 rounded-lg">
              <h4 className="font-medium text-amber-800 dark:text-amber-500 mb-1">Armazenamento Local</h4>
              <p className="text-sm text-amber-700/80 dark:text-amber-500/80 mb-4">
                O MyFinance funciona 100% offline. Todos os seus dados são salvos no armazenamento local do seu navegador (localStorage). 
                Se você limpar os dados do navegador, suas informações serão perdidas.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};