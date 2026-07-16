import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { FinanceProvider } from '@/context/FinanceContext';
import { Layout } from '@/components/Layout';
import { InstallPWA } from '@/components/InstallPWA';
import { isSupabaseConfigured } from '@/lib/supabase';
import { Loader2, Settings2 } from 'lucide-react';

import { Dashboard } from '@/pages/Dashboard';
import { Transactions } from '@/pages/Transactions';
import { Categories } from '@/pages/Categories';
import { Scheduled } from '@/pages/Scheduled';
import { Reports } from '@/pages/Reports';
import { Settings } from '@/pages/Settings';
import { Cards } from '@/pages/Cards';
import { CardDetail } from '@/pages/CardDetail';
import { Dre } from '@/pages/Dre';
import { Login } from '@/pages/Login';
import { Signup } from '@/pages/Signup';

const queryClient = new QueryClient();

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
          Execute também <code className="bg-muted px-1 rounded">supabase/schema.sql</code>{' '}e{' '}
          <code className="bg-muted px-1 rounded">supabase/schema_v2_cards.sql</code> no SQL Editor do Supabase.
        </p>
      </div>
    </div>
  );
}

function AppContent() {
  const { user, loading } = useAuth();

  if (!isSupabaseConfigured) return <SetupNeeded />;
  if (loading) return <LoadingScreen />;

  if (!user) {
    return (
      <Switch>
        <Route path="/signup" component={Signup} />
        <Route component={Login} />
      </Switch>
    );
  }

  return (
    <FinanceProvider>
      <Layout>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/transactions" component={Transactions} />
          <Route path="/categories" component={Categories} />
          <Route path="/cards/:id" component={CardDetail} />
          <Route path="/cards" component={Cards} />
          <Route path="/scheduled" component={Scheduled} />
          <Route path="/dre" component={Dre} />
          <Route path="/reports" component={Reports} />
          <Route path="/settings" component={Settings} />
          <Route component={NotFound} />
        </Switch>
      </Layout>
      <InstallPWA />
    </FinanceProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <AppContent />
        </WouterRouter>
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
