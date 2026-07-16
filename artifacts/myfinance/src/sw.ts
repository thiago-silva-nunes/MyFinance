/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope;

// Inject the Workbox precache manifest (replaced by vite-plugin-pwa at build time)
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// ─── Periodic Background Sync ──────────────────────────────────────────────────
// Fires when the browser decides it is a good time (PWA installed, device online).
self.addEventListener('periodicsync', (event: any) => {
  if (event.tag === 'myfinance-check') {
    event.waitUntil(runUpcomingCheck());
  }
});

// ─── Server Push (VAPID-ready) ─────────────────────────────────────────────────
// Ready for a future push server — just send { title, body } JSON payload.
self.addEventListener('push', (event: PushEvent) => {
  if (!event.data) return;
  try {
    const data = event.data.json() as { title: string; body: string; icon?: string };
    event.waitUntil(
      self.registration.showNotification(data.title, {
        body: data.body,
        icon: data.icon ?? 'icons/icon-192.png',
        badge: 'icons/icon-192.png',
      }),
    );
  } catch {
    // non-JSON push payload — ignore
  }
});

// ─── Notification click ────────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  event.waitUntil(
    (self as unknown as { clients: Clients }).clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        if (clientList.length > 0) {
          return clientList[0].focus();
        }
        return (self as unknown as { clients: Clients }).clients.openWindow('/');
      }),
  );
});

// ─── IndexedDB helpers (no external dep; mirrored in notificationService.ts) ───

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

function getAllItems(db: IDBDatabase): Promise<UpcomingItem[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result as UpcomingItem[]);
    req.onerror = () => reject(req.error);
  });
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

/** Called by periodicsync — reads cached upcoming items from IndexedDB and fires
 *  browser notifications for any that are due within the next 2 days. */
async function runUpcomingCheck(): Promise<void> {
  try {
    const db = await openNotifDB();
    const items = await getAllItems(db);
    db.close();

    const today = new Date().toISOString().split('T')[0];
    const in2 = addDays(today, 2);

    for (const item of items) {
      if (item.dueDate >= today && item.dueDate <= in2) {
        await self.registration.showNotification(item.title, {
          body: item.body,
          icon: 'icons/icon-192.png',
          badge: 'icons/icon-192.png',
          tag: `myfinance-${item.id}`,
        });
      }
    }
  } catch (err) {
    console.error('[MyFinance SW] runUpcomingCheck error:', err);
  }
}
