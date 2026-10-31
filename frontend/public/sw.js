// Service Worker for Smart Inventory Picker Alerts & Push Notifications
const CACHE_NAME = 'smart-inventory-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle incoming background push notifications (Web Push Protocol)
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'New Order Alert', body: event.data ? event.data.text() : 'A new order is available for picking.' };
  }

  const title = data.title || 'NEW ORDER AVAILABLE!';
  const options = {
    body: data.body || `Order #${data.order_id || ''} requires immediate picking.`,
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    vibrate: [200, 100, 200, 100, 400],
    data: {
      orderId: data.order_id,
      url: data.url || '/orders'
    },
    tag: `order-${data.order_id || Date.now()}`,
    renotify: true,
    requireInteraction: true,
    actions: [
      { action: 'accept', title: 'ACCEPT ORDER' },
      { action: 'view', title: 'VIEW ORDER' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Handle notification tap / action clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const orderId = event.notification.data?.orderId;
  const targetUrl = orderId ? `/orders?orderId=${orderId}` : '/orders';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          client.navigate(targetUrl);
          return;
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
