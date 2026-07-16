import React, { useEffect, useState } from 'react';
import { useFinance } from '@/context/FinanceContext';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Moon, Sun, DollarSign, Database, LogOut, Loader2, Cloud, Bell, BellOff, BellRing } from 'lucide-react';
import { toast } from 'sonner';
import {
  isNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
  checkAndNotify,
  registerPeriodicSync,
} from '@/services/notificationService';

export const Settings = () => {
  const { settings, updateSettings, loadSampleData, scheduled, invoices, cards } = useFinance();
  const { user, signOut } = useAuth();
  const [seedLoading, setSeedLoading] = useState(false);
  const [notifPermission, setNotifPermission] = useState<string>(() => getNotificationPermission());
  const [notifLoading, setNotifLoading] = useState(false);

  const handleThemeChange = (isDark: boolean) => {
    updateSettings({ theme: isDark ? 'dark' : 'light' });
    toast.success(`Tema ${isDark ? 'escuro' : 'claro'} ativado`);
  };

  const handleCurrencyChange = (val: string) => {
    updateSettings({ currency: val });
    toast.success('Moeda atualizada');
  };

  const handleSeedData = async () => {
    setSeedLoading(true);
    try {
      await loadSampleData();
      toast.success('Dados de exemplo carregados com sucesso!');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar dados de exemplo');
    } finally {
      setSeedLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch {
      toast.error('Erro ao sair');
    }
  };

  const handleRequestNotifications = async () => {
    if (!isNotificationSupported()) {
      toast.error('Notificações não são suportadas neste navegador.');
      return;
    }
    setNotifLoading(true);
    try {
      const perm = await requestNotificationPermission();
      setNotifPermission(perm);
      if (perm === 'granted') {
        toast.success('Notificações ativadas! Você receberá avisos sobre vencimentos.');
        // Fire a quick check immediately
        await checkAndNotify(scheduled, invoices, cards);
      } else if (perm === 'denied') {
        toast.error('Permissão negada. Para ativar, altere as configurações do seu navegador.');
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao solicitar permissão');
    } finally {
      setNotifLoading(false);
    }
  };

  const handleTestNotification = async () => {
    if (notifPermission !== 'granted') return;
    await checkAndNotify(scheduled, invoices, cards);
    toast.info('Verificação de notificações executada. Se houver vencimentos próximos, você verá as notificações.');
  };

  // If permission is already granted, (re-)register periodic sync on mount
  useEffect(() => {
    if (notifPermission === 'granted') {
      registerPeriodicSync().catch(() => {});
    }
  }, [notifPermission]);

  useEffect(() => {
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.theme]);

  const notifIcon = notifPermission === 'granted' ? BellRing : notifPermission === 'denied' ? BellOff : Bell;
  const NotifIcon = notifIcon;

  return (
    <div className="space-y-6 pb-20 md:pb-0 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">Gerencie suas preferências do aplicativo.</p>
      </div>

      <div className="grid gap-6">

        {/* Aparência */}
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
              <Switch checked={settings.theme === 'dark'} onCheckedChange={handleThemeChange} />
            </div>
          </CardContent>
        </Card>

        {/* Preferências Regionais */}
        <Card>
          <CardHeader>
            <CardTitle>Preferências Regionais</CardTitle>
            <CardDescription>Configure como os dados são exibidos.</CardDescription>
          </CardHeader>
          <CardContent>
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

        {/* Notificações */}
        <Card>
          <CardHeader>
            <CardTitle>Notificações</CardTitle>
            <CardDescription>
              Receba alertas no navegador sobre vencimentos de faturas e lançamentos programados.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isNotificationSupported() ? (
              <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                <BellOff className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Não suportado</p>
                  <p className="text-xs text-muted-foreground">Este navegador não suporta notificações push.</p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                  <NotifIcon className={`w-5 h-5 shrink-0 mt-0.5 ${notifPermission === 'granted' ? 'text-success' : notifPermission === 'denied' ? 'text-destructive' : 'text-muted-foreground'}`} />
                  <div>
                    <p className="text-sm font-medium">
                      {notifPermission === 'granted' && 'Notificações ativas'}
                      {notifPermission === 'denied' && 'Notificações bloqueadas'}
                      {notifPermission === 'default' && 'Notificações desativadas'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {notifPermission === 'granted' && 'Você receberá alertas de vencimentos até 2 dias antes.'}
                      {notifPermission === 'denied' && 'Vá em Configurações do Navegador → Notificações para desbloquear.'}
                      {notifPermission === 'default' && 'Ative para receber avisos de faturas e lançamentos programados.'}
                    </p>
                  </div>
                </div>

                {notifPermission !== 'granted' && notifPermission !== 'denied' && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleRequestNotifications}
                    disabled={notifLoading}
                  >
                    {notifLoading ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Aguardando permissão...</>
                    ) : (
                      <><Bell className="w-4 h-4 mr-2" /> Ativar Notificações</>
                    )}
                  </Button>
                )}

                {notifPermission === 'granted' && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleTestNotification}
                  >
                    <BellRing className="w-4 h-4 mr-2" /> Verificar vencimentos agora
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Conta */}
        <Card>
          <CardHeader>
            <CardTitle>Conta</CardTitle>
            <CardDescription>Informações da sua conta e armazenamento.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <Cloud className="w-5 h-5 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Sincronizado na nuvem</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
            </div>
            <Button variant="outline" className="w-full text-destructive border-destructive/30 hover:bg-destructive/5" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Sair da conta
            </Button>
          </CardContent>
        </Card>

        {/* Dados */}
        <Card>
          <CardHeader>
            <CardTitle>Dados</CardTitle>
            <CardDescription>Importe dados de exemplo para explorar o app.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 border rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Database className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-sm mb-1">Dados de exemplo</h4>
                  <p className="text-sm text-muted-foreground">
                    Carrega categorias, lançamentos e recorrentes de exemplo na sua conta para explorar todas as funcionalidades do app.
                    Os dados serão inseridos com a sua conta e podem ser editados ou excluídos depois.
                  </p>
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={handleSeedData}
              disabled={seedLoading}
              className="w-full"
            >
              {seedLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Carregando...
                </>
              ) : (
                <>
                  <Database className="w-4 h-4 mr-2" />
                  Carregar dados de exemplo
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
