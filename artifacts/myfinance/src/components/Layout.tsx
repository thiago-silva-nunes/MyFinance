import React, { useState } from 'react';
import { Link, useLocation } from 'wouter';
import {
  LayoutDashboard, Receipt, CalendarClock, LineChart,
  Settings, Wallet, LogOut, Plus, MoreHorizontal, BarChart2,
  Eye, EyeOff, Target, CreditCard,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useFinance } from '@/context/FinanceContext';
import { useAuth } from '@/context/AuthContext';
import { usePrivacy } from '@/context/PrivacyContext';
import { TransactionFormDialog } from '@/components/TransactionFormDialog';
import { toast } from 'sonner';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';

const navItems = [
  { href: '/',             label: 'Dashboard',   icon: LayoutDashboard },
  { href: '/transactions', label: 'Transações',  icon: Receipt },
  { href: '/orcamentos',   label: 'Orçamentos',  icon: Target },
  { href: '/scheduled',    label: 'Recorrentes', icon: CalendarClock },
  { href: '/cards',        label: 'Cartões',     icon: CreditCard },
  { href: '/dre',          label: 'DRE',         icon: BarChart2 },
  { href: '/reports',      label: 'Relatórios',  icon: LineChart },
];

const moreItems = ['/orcamentos', '/scheduled', '/scheduled/analise', '/cards', '/dre', '/reports', '/settings'];

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const [location] = useLocation();
  const { settings } = useFinance();
  const { signOut } = useAuth();
  const { hideValues, toggleHideValues } = usePrivacy();
  const [addOpen, setAddOpen] = useState(false);

  const handleSignOut = async () => {
    try { await signOut(); } catch { toast.error('Erro ao sair'); }
  };

  // Mobile bottom nav shows first 4 items + "Mais"
  const mobileMainItems = navItems.slice(0, 4);

  const PrivacyButton = ({ size = 'default' }: { size?: 'default' | 'sm' }) => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={toggleHideValues}
            aria-label={hideValues ? 'Mostrar valores' : 'Ocultar valores'}
            className={cn(
              'flex items-center justify-center rounded-lg transition-colors',
              size === 'sm'
                ? 'w-8 h-8 hover:bg-muted'
                : 'w-9 h-9 hover:bg-muted/60',
              hideValues
                ? 'text-amber-500 hover:text-amber-600'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {hideValues
              ? <EyeOff className={size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'} />
              : <Eye className={size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'} />}
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">
          {hideValues ? 'Mostrar valores' : 'Ocultar valores'}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  return (
    <div className="flex min-h-[100dvh] w-full bg-background md:bg-muted/30">

      {/* ── Desktop Sidebar ──────────────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-64 border-r bg-card h-screen sticky top-0">
        <div className="p-6 flex items-center gap-3">
          <div className="bg-primary text-primary-foreground p-2 rounded-xl">
            <Wallet className="w-5 h-5" />
          </div>
          <span className="font-bold text-xl tracking-tight">MyFinance</span>
          <div className="ml-auto">
            <PrivacyButton />
          </div>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== '/' && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}
                className={cn('flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
                <item.icon className={cn('w-5 h-5', isActive ? 'text-primary' : 'text-muted-foreground')} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 mt-auto space-y-1">
          <Link href="/settings"
            className={cn('flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              location === '/settings' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
            <Settings className="w-5 h-5" /> Configurações
          </Link>
          <button onClick={handleSignOut}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors w-full">
            <LogOut className="w-5 h-5" /> Sair
          </button>
        </div>
      </aside>

      {/* ── Mobile Top Bar ───────────────────────────────────────────────── */}
      <div className="md:hidden fixed top-0 w-full z-40 bg-card border-b px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-primary text-primary-foreground p-1.5 rounded-lg">
            <Wallet className="w-4 h-4" />
          </div>
          <span className="font-bold text-lg tracking-tight">MyFinance</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-sm font-medium text-muted-foreground">
            {navItems.find(n => n.href === location || (n.href !== '/' && location.startsWith(n.href)))?.label
              ?? (location === '/settings' ? 'Configurações' : '')}
          </span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={toggleHideValues}
                  aria-label={hideValues ? 'Mostrar valores' : 'Ocultar valores'}
                  className={cn(
                    'ml-2 flex items-center justify-center w-8 h-8 rounded-lg transition-colors hover:bg-muted',
                    hideValues ? 'text-amber-500' : 'text-muted-foreground',
                  )}
                >
                  {hideValues ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {hideValues ? 'Mostrar valores' : 'Ocultar valores'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* ── Main Content ─────────────────────────────────────────────────── */}
      <main className="flex-1 w-full flex flex-col min-h-0 md:min-h-screen pt-14 md:pt-0 pb-20 md:pb-0">
        <div className="flex-1 p-4 md:p-8 max-w-6xl mx-auto w-full">
          {children}
        </div>
      </main>

      {/* ── Mobile FAB ───────────────────────────────────────────────────── */}
      <button onClick={() => setAddOpen(true)}
        className="md:hidden fixed bottom-[72px] right-4 z-50 bg-primary text-primary-foreground rounded-full w-14 h-14 flex items-center justify-center shadow-lg shadow-primary/30 active:scale-95 transition-transform"
        aria-label="Adicionar lançamento">
        <Plus className="w-7 h-7" />
      </button>
      <TransactionFormDialog open={addOpen} onOpenChange={setAddOpen} />

      {/* ── Mobile Bottom Navigation ─────────────────────────────────────── */}
      <div className="md:hidden fixed bottom-0 w-full bg-card border-t z-40 safe-area-pb">
        <div className="flex items-center justify-around h-[60px]">
          {mobileMainItems.map((item) => {
            const isActive = location === item.href || (item.href !== '/' && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}
                className={cn('flex flex-col items-center justify-center gap-0.5 flex-1 h-full min-w-0 px-1',
                  isActive ? 'text-primary' : 'text-muted-foreground')}>
                <item.icon className="w-5 h-5 shrink-0" />
                <span className="text-[10px] font-medium truncate">{item.label}</span>
              </Link>
            );
          })}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={cn('flex flex-col items-center justify-center gap-0.5 flex-1 h-full min-w-0 px-1',
                moreItems.includes(location) ? 'text-primary' : 'text-muted-foreground')}>
                <MoreHorizontal className="w-5 h-5 shrink-0" />
                <span className="text-[10px] font-medium">Mais</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="mb-2">
              <DropdownMenuItem asChild>
                <Link href="/orcamentos" className="flex items-center gap-2"><Target className="w-4 h-4" /> Orçamentos</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/scheduled" className="flex items-center gap-2"><CalendarClock className="w-4 h-4" /> Recorrentes</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/cards" className="flex items-center gap-2"><CreditCard className="w-4 h-4" /> Cartões</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/dre" className="flex items-center gap-2"><BarChart2 className="w-4 h-4" /> DRE</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/reports" className="flex items-center gap-2"><LineChart className="w-4 h-4" /> Relatórios</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings" className="flex items-center gap-2"><Settings className="w-4 h-4" /> Configurações</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                <LogOut className="w-4 h-4 mr-2" /> Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
};
