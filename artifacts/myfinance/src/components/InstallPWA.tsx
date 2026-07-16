import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, X, Share } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'myfinance_pwa_dismissed';

export const InstallPWA = () => {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Already dismissed this session
    if (sessionStorage.getItem(DISMISSED_KEY)) {
      setDismissed(true);
      return;
    }

    // Check if already installed (standalone mode)
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    setIsInstalled(standalone);

    // Detect iOS Safari
    const iOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) &&
      !(window as { MSStream?: unknown }).MSStream;
    setIsIOS(iOS);

    // Listen for Android/Chrome install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const dismiss = () => {
    sessionStorage.setItem(DISMISSED_KEY, '1');
    setDismissed(true);
  };

  const handleInstall = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === 'accepted') {
      setInstallEvent(null);
      setIsInstalled(true);
    } else {
      dismiss();
    }
  };

  if (isInstalled || dismissed) return null;

  // Android/Chrome — native install prompt available
  if (installEvent) {
    return (
      <div className="fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-card border rounded-xl shadow-lg p-4 z-50 flex items-start gap-3">
        <div className="bg-primary/10 p-2 rounded-lg shrink-0">
          <Download className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">Instale o MyFinance</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            Acesse suas finanças rapidamente pelo celular, sem abrir o navegador.
          </p>
          <div className="flex gap-2 mt-3">
            <Button size="sm" className="h-8 text-xs" onClick={handleInstall}>
              Instalar app
            </Button>
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={dismiss}>
              Agora não
            </Button>
          </div>
        </div>
        <button onClick={dismiss} className="text-muted-foreground hover:text-foreground shrink-0 mt-0.5">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // iOS Safari — manual instructions
  if (isIOS) {
    return (
      <div className="fixed bottom-20 left-4 right-4 bg-card border rounded-xl shadow-lg p-4 z-50">
        <div className="flex items-start gap-3">
          <div className="bg-primary/10 p-2 rounded-lg shrink-0">
            <Share className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-sm">Instale o MyFinance</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Toque em{' '}
              <span className="inline-flex items-center gap-0.5 font-medium">
                <Share className="w-3 h-3" /> Compartilhar
              </span>{' '}
              e depois em <strong>"Adicionar à Tela de Início"</strong>.
            </p>
          </div>
          <button onClick={dismiss} className="shrink-0 text-muted-foreground hover:text-foreground mt-0.5">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return null;
};
