import type { ScheduledTransaction, Invoice, CreditCard } from '@/data/mockData';

// ─── Permission helpers ────────────────────────────────────────────────────────

export function isNotificationSupported(): boolean {
  return 'Notification' in window;
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) throw new Error('Notificações não suportadas neste navegador');
  const perm = await Notification.requestPermission();
  if (perm === 'granted') {
    await registerPeriodicSync();
  }
  return perm;
}

// ─── Periodic Background Sync registration ────────────────────────────────────
// Fires the service worker's `periodicsync` handler every ~1 day when the PWA
// is installed and the device is online — even if the app tab is closed.

export async function registerPeriodicSync(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  if (!('periodicSync' in ServiceWorkerRegistration.prototype)) return; // Chrome/Edge only
  try {
    const reg = await navigator.serviceWorker.ready;
    const ps = (reg as unknown as { periodicSync: { register(tag: string, opts: object): Promise<void>; getTags(): Promise<string[]> } }).periodicSync;
    const tags = await ps.getTags();
    if (!tags.includes('myfinance-check')) {
      await ps.register('myfinance-check', { minInterval: 24 * 60 * 60 * 1000 }); // ~1 day
    }
  } catch (err) {
    // periodicSync requires PWA installed + HTTPS — silently ignore in dev/desktop
    console.debug('[notificationService] periodicSync registration skipped:', err);
  }
}

// ─── IndexedDB cache ──────────────────────────────────────────────────────────
// The service worker (sw.ts) cannot import from the app bundle, so both sides
// share the same DB_NAME / STORE_NAME convention. The app writes; the SW reads.

const DB_NAME = 'myfinance-notifications';
const STORE_NAME = 'upcoming';

interface UpcomingItem {
  id: string;
  title: string;
  body: string;
  dueDate: string; // 'YYYY-MM-DD'
}

function openNotifDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Writes upcoming scheduled transactions and invoices into IndexedDB so the
 *  service worker can read them during a periodicsync event (app closed). */
export async function cacheUpcomingItems(
  scheduled: ScheduledTransaction[],
  invoices: Invoice[],
  cards: CreditCard[],
): Promise<void> {
  if (!('indexedDB' in window)) return;
  try {
    const db = await openNotifDB();
    const items: UpcomingItem[] = [];

    for (const s of scheduled) {
      if (!s.active) continue;
      items.push({
        id: `sched-${s.id}`,
        title: `${s.type === 'expense' ? 'Despesa' : 'Receita'} programada: ${s.description}`,
        body: `R$ ${s.amount.toFixed(2).replace('.', ',')} — ${s.frequency}`,
        dueDate: s.startDate,
      });
    }

    for (const inv of invoices) {
      if (inv.status === 'paid') continue;
      const card = cards.find(c => c.id === inv.cardId);
      if (!card) continue;
      items.push({
        id: `inv-${inv.id}`,
        title: `Fatura ${card.name} vence em breve`,
        body: `Vencimento: ${inv.dueDate} — R$ ${inv.totalAmount.toFixed(2).replace('.', ',')}`,
        dueDate: inv.dueDate,
      });
    }

    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    for (const item of items) store.put(item);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (err) {
    console.debug('[notificationService] cacheUpcomingItems failed:', err);
  }
}

// ─── In-session notification helper ───────────────────────────────────────────
// Shows a notification immediately (for the Settings "verify now" button or the
// on-load check). Uses the SW registration when available, falls back to new
// Notification() for browsers without SW.

async function showNotification(title: string, body: string, id: string): Promise<void> {
  if (Notification.permission !== 'granted') return;
  const opts: NotificationOptions = {
    body,
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-192.png',
    tag: `myfinance-${id}`,
  };
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, opts);
      return;
    } catch { /* fall through */ }
  }
  new Notification(title, opts);
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

/** In-session check: shows notifications for items due within the next 2 days. */
export async function checkAndNotify(
  scheduled: ScheduledTransaction[],
  invoices: Invoice[],
  cards: CreditCard[],
): Promise<void> {
  if (Notification.permission !== 'granted') return;

  const today = todayStr();
  const in2Days = addDays(today, 2);

  for (const s of scheduled) {
    if (!s.active) continue;
    if (s.startDate >= today && s.startDate <= in2Days) {
      const tipo = s.type === 'expense' ? 'Despesa' : 'Receita';
      await showNotification(
        `${tipo} programada: ${s.description}`,
        `Vence em ${s.startDate} — R$ ${s.amount.toFixed(2).replace('.', ',')}`,
        `sched-${s.id}`,
      );
    }
  }

  for (const inv of invoices) {
    if (inv.status === 'paid') continue;
    if (inv.dueDate >= today && inv.dueDate <= in2Days) {
      const card = cards.find(c => c.id === inv.cardId);
      if (card) {
        await showNotification(
          `Fatura ${card.name} vence em breve`,
          `Vencimento: ${inv.dueDate} — R$ ${inv.totalAmount.toFixed(2).replace('.', ',')}`,
          `inv-${inv.id}`,
        );
      }
    }
  }
}
