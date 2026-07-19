import React, { useEffect, useState, useMemo } from 'react';
import { useFinance } from '@/context/FinanceContext';
import { computeBankBalanceAtDate } from '@/lib/balanceUtils';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Moon, Sun, DollarSign, Database, LogOut, Loader2, Cloud, Bell, BellOff, BellRing, Plus, Edit2, Trash2, Building2, TrendingUp, TrendingDown, SlidersHorizontal } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import {
  isNotificationSupported, getNotificationPermission,
  requestNotificationPermission, checkAndNotify, registerPeriodicSync,
} from '@/services/notificationService';
import { Categories } from '@/pages/Categories';
import { Cards } from '@/pages/Cards';
import { BankFormDialog } from '@/components/BankFormDialog';
import { BalanceAdjustDialog } from '@/components/BalanceAdjustDialog';
import { BankAccount } from '@/data/mockData';
import { getIcon } from '@/components/IconMap';

// ─── Banks panel ──────────────────────────────────────────────────────────────

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  'corrente': 'Corrente',
  'poupança': 'Poupança',
  'investimento': 'Investimento',
};

function BanksPanel() {
  const { banks, deleteBank, transactions, transfers, balanceSnapshots } = useFinance();

  // Snapshot-aware balance: uses latest balance snapshot per bank when available
  const bankBalances = useMemo(() => {
    const map: Record<string, number> = {};
    for (const bank of banks) {
      map[bank.id] = computeBankBalanceAtDate(bank.id, bank, transactions, transfers, balanceSnapshots);
    }
    return map;
  }, [banks, transactions, transfers, balanceSnapshots]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BankAccount | null>(null);
  const [adjustBank, setAdjustBank] = useState<BankAccount | null>(null);
  const [adjustOpen, setAdjustOpen] = useState(false);

  const handleDelete = async (bank: BankAccount) => {
    if (!confirm(`Excluir a conta "${bank.name}"? As transações vinculadas a ela continuarão existindo.`)) return;
    try {
      await deleteBank(bank.id);
      toast.success('Conta removida');
    } catch {
      toast.error('Erro ao remover conta');
    }
  };

  const openNew = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (b: BankAccount) => { setEditing(b); setDialogOpen(true); };
  const openAdjust = (b: BankAccount) => { setAdjustBank(b); setAdjustOpen(true); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Bancos / Contas</h2>
          <p className="text-sm text-muted-foreground">Gerencie suas contas bancárias para rastrear de onde vêm e para onde vão seus recursos.</p>
        </div>
        <Button onClick={openNew} className="shrink-0">
          <Plus className="w-4 h-4 mr-2" /> Nova Conta
        </Button>
      </div>

      {banks.length === 0 ? (
        <Card>
          <CardContent className="py-12 flex flex-col items-center gap-3 text-center">
            <Building2 className="w-10 h-10 text-muted-foreground/30" />
            <p className="font-medium text-muted-foreground">Nenhuma conta cadastrada</p>
            <p className="text-sm text-muted-foreground max-w-sm">
              Cadastre seus bancos e contas para identificar de qual conta saiu cada gasto.
            </p>
            <Button variant="outline" onClick={openNew} className="mt-1">
              <Plus className="w-4 h-4 mr-2" /> Cadastrar primeira conta
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {banks.map(bank => {
            const Icon = getIcon(bank.icon);
            return (
              <Card key={bank.id} className="group hover-elevate transition-all">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${bank.color}20` }}>
                        <Icon className="w-5 h-5" style={{ color: bank.color }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm truncate">{bank.name}</p>
                        <Badge variant="secondary" className="text-[10px] h-4 px-1.5 mt-0.5">
                          {ACCOUNT_TYPE_LABELS[bank.type] ?? bank.type}
                        </Badge>
                        {/* Calculated balance */}
                        {(() => {
                          const bal = bankBalances[bank.id] ?? bank.initialBalance;
                          const isPositive = bal >= 0;
                          return (
                            <p className={`text-xs font-semibold mt-1 ${isPositive ? 'text-emerald-600' : 'text-destructive'}`}>
                              {formatCurrency(bal)}
                            </p>
                          );
                        })()}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Ajustar saldo"
                        onClick={() => openAdjust(bank)}
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(bank)}>
                        <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-destructive/10" onClick={() => handleDelete(bank)}>
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

// ─── Main Settings page ───────────────────────────────────────────────────────

export const Settings = () => {
  const { settings, updateSettings, loadSampleData, scheduled, invoices, cards } = useFinance();
  const { user, signOut } = useAuth();
  const [seedLoading, setSeedLoading]     = useState(false);
  const [notifPermission, setNotifPermission] = useState<string>(() => getNotificationPermission());
  const [notifLoading, setNotifLoading]   = useState(false);

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
    try { await signOut(); } catch { toast.error('Erro ao sair'); }
  };

  const handleRequestNotifications = async () => {
    if (!isNotificationSupported()) { toast.error('Notificações não são suportadas neste navegador.'); return; }
    setNotifLoading(true);
    try {
      const perm = await requestNotificationPermission();
      setNotifPermission(perm);
      if (perm === 'granted') {
        toast.success('Notificações ativadas!');
        await checkAndNotify(scheduled, invoices, cards);
      } else if (perm === 'denied') {
        toast.error('Permissão negada. Altere as configurações do seu navegador.');
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
    toast.info('Verificação de notificações executada.');
  };

  useEffect(() => {
    if (notifPermission === 'granted') registerPeriodicSync().catch(() => {});
  }, [notifPermission]);

  useEffect(() => {
    if (settings.theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [settings.theme]);

  const NotifIcon = notifPermission === 'granted' ? BellRing : notifPermission === 'denied' ? BellOff : Bell;

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">Gerencie preferências, cadastros e dados do app.</p>
      </div>

      <Tabs defaultValue="geral" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-flex">
          <TabsTrigger value="geral">Geral</TabsTrigger>
          <TabsTrigger value="categorias">Categorias</TabsTrigger>
          <TabsTrigger value="cartoes">Cartões</TabsTrigger>
          <TabsTrigger value="bancos">Bancos</TabsTrigger>
        </TabsList>

        {/* ── Geral ────────────────────────────────────────────────────────── */}
        <TabsContent value="geral" className="space-y-6 max-w-3xl">

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
                  <div className="bg-muted p-2 rounded-lg"><DollarSign className="w-5 h-5" /></div>
                  <div>
                    <Label className="text-base">Moeda Principal</Label>
                    <p className="text-sm text-muted-foreground">A formatação padrão é R$</p>
                  </div>
                </div>
                <div className="w-[150px]">
                  <Select value={settings.currency} onValueChange={handleCurrencyChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
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
              <CardDescription>Receba alertas no navegador sobre vencimentos de faturas e lançamentos programados.</CardDescription>
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
                    <Button variant="outline" className="w-full" onClick={handleRequestNotifications} disabled={notifLoading}>
                      {notifLoading
                        ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Aguardando permissão...</>
                        : <><Bell className="w-4 h-4 mr-2" /> Ativar Notificações</>}
                    </Button>
                  )}
                  {notifPermission === 'granted' && (
                    <Button variant="outline" className="w-full" onClick={handleTestNotification}>
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
                <LogOut className="w-4 h-4 mr-2" /> Sair da conta
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
                      Carrega categorias, lançamentos e recorrentes de exemplo na sua conta.
                    </p>
                  </div>
                </div>
              </div>
              <Button variant="outline" onClick={handleSeedData} disabled={seedLoading} className="w-full">
                {seedLoading
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Carregando...</>
                  : <><Database className="w-4 h-4 mr-2" /> Carregar dados de exemplo</>}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Categorias ───────────────────────────────────────────────────── */}
        <TabsContent value="categorias">
          <Categories />
        </TabsContent>

        {/* ── Cartões ──────────────────────────────────────────────────────── */}
        <TabsContent value="cartoes">
          <Cards />
        </TabsContent>

        {/* ── Bancos ───────────────────────────────────────────────────────── */}
        <TabsContent value="bancos">
          <BanksPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
};
