import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { FinanceProvider } from '@/context/FinanceContext';
import { PrivacyProvider } from '@/context/PrivacyContext';
import { Layout } from '@/components/Layout';
import { InstallPWA } from '@/components/InstallPWA';
import { isSupabaseConfigured } from '@/lib/supabase';
import { Loader2, Settings2 } from 'lucide-react';
import React, { useEffect, lazy, Suspense } from 'react';
import { useFinance } from '@/context/FinanceContext';
import { checkAndNotify, getNotificationPermission, cacheUpcomingItems, registerPeriodicSync } from '@/services/notificationService';

// ─── Page code-splitting (reduces initial bundle size) ────────────────────────
const Dashboard        = lazy(() => import('@/pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Transactions     = lazy(() => import('@/pages/Transactions').then(m => ({ default: m.Transactions })));
const Categories       = lazy(() => import('@/pages/Categories').then(m => ({ default: m.Categories })));
const Scheduled        = lazy(() => import('@/pages/Scheduled').then(m => ({ default: m.Scheduled })));
const ScheduledAnalysis= lazy(() => import('@/pages/ScheduledAnalysis').then(m => ({ default: m.ScheduledAnalysis })));
const Reports          = lazy(() => import('@/pages/Reports').then(m => ({ default: m.Reports })));
const Settings         = lazy(() => import('@/pages/Settings').then(m => ({ default: m.Settings })));
const Cards            = lazy(() => import('@/pages/Cards').then(m => ({ default: m.Cards })));
const CardDetail       = lazy(() => import('@/pages/CardDetail').then(m => ({ default: m.CardDetail })));
const Dre              = lazy(() => import('@/pages/Dre').then(m => ({ default: m.Dre })));
const Budgets          = lazy(() => import('@/pages/Budgets').then(m => ({ default: m.Budgets })));
const Login            = lazy(() => import('@/pages/Login').then(m => ({ default: m.Login })));
const Signup           = lazy(() => import('@/pages/Signup').then(m => ({ default: m.Signup })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false, // avoid unexpected refetches when switching tabs
    },
  },
});

function NotFound() {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center text-center">
      <h1 className="text-4xl font-bold mb-4">404</h1>
      <p className="text-muted-foreground mb-6">Página não encontrada.</p>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    </div>
  );
}

function PageFallback() {
  return (
    <div className="flex items-center justify-center min-h-[30vh]">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
  );
}

function SetupNeeded() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-6">
      <div className="max-w-md w-full bg-card border rounded-2xl p-8 space-y-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-amber-100 dark:bg-amber-900/30 p-2 rounded-lg">
            <Settings2 className="w-6 h-6 text-amber-600 dark:text-amber-400" />
          </div>
          <h1 className="text-xl font-bold">Configuração necessária</h1>
        </div>
        <p className="text-muted-foreground text-sm leading-relaxed">
          O MyFinance precisa de um projeto Supabase para funcionar. Adicione as seguintes variáveis como{' '}
          <strong>Secrets</strong> no Replit (ícone de cadeado no painel lateral):
        </p>
        <div className="bg-muted rounded-lg p-4 font-mono text-sm space-y-1">
          <div className="text-primary">VITE_SUPABASE_URL</div>
          <div className="text-primary">VITE_SUPABASE_ANON_KEY</div>
        </div>
        <p className="text-xs text-muted-foreground">
          Encontre esses valores em{' '}
          <strong>supabase.com → seu projeto → Settings → API</strong>.
          Depois de adicionar os secrets, reinicie o servidor para o app funcionar.
        </p>
        <p className="text-xs text-muted-foreground">
          Execute também <code className="bg-muted px-1 rounded">supabase/schema.sql</code> no SQL Editor do Supabase.
        </p>
      </div>
    </div>
  );
}

/** Fires browser notifications for upcoming items when permission is granted. */
function NotificationChecker() {
  const { scheduled, invoices, cards, loading } = useFinance();

  useEffect(() => {
    if (loading) return;
    // Always cache upcoming items in IndexedDB so the SW can fire background notifications
    cacheUpcomingItems(scheduled, invoices, cards).catch(() => {});

    if (getNotificationPermission() !== 'granted') return;

    // Register periodic background sync (no-op if already registered or not supported)
    registerPeriodicSync().catch(() => {});

    // Also run an in-session check on load with a small delay
    const timer = setTimeout(() => {
      checkAndNotify(scheduled, invoices, cards).catch(() => {});
    }, 3000);
    return () => clearTimeout(timer);
  }, [loading, scheduled, invoices, cards]);

  return null;
}

function AppContent() {
  const { user, loading } = useAuth();

  if (!isSupabaseConfigured) return <SetupNeeded />;
  if (loading) return <LoadingScreen />;

  if (!user) {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <Switch>
          <Route path="/signup" component={Signup} />
          <Route component={Login} />
        </Switch>
      </Suspense>
    );
  }

  return (
    <FinanceProvider>
      <NotificationChecker />
      <Layout>
        <Suspense fallback={<PageFallback />}>
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/transactions" component={Transactions} />
            <Route path="/categories" component={Categories} />
            <Route path="/cards/:id" component={CardDetail} />
            <Route path="/cards" component={Cards} />
            <Route path="/scheduled/analise" component={ScheduledAnalysis} />
            <Route path="/scheduled" component={Scheduled} />
            <Route path="/dre" component={Dre} />
            <Route path="/orcamentos" component={Budgets} />
            <Route path="/reports" component={Reports} />
            <Route path="/settings" component={Settings} />
            <Route component={NotFound} />
          </Switch>
        </Suspense>
      </Layout>
      <InstallPWA />
    </FinanceProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <PrivacyProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <AppContent />
          </WouterRouter>
          <Toaster position="top-right" richColors />
        </PrivacyProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
