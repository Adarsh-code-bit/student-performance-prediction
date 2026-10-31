/**
 * Notification and Web Push Utility for Picker Alerts
 */

let serviceWorkerRegistration = null;

/**
 * Registers the Service Worker for background notifications.
 */
export async function initNotificationService() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    serviceWorkerRegistration = reg;
    return reg;
  } catch (err) {
    console.warn('Service worker registration failed:', err.message);
    return null;
  }
}

/**
 * Requests notification permissions from the user.
 */
export async function requestNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }

  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (err) {
    console.warn('Error requesting notification permission:', err);
    return 'denied';
  }
}

/**
 * Checks current notification permission.
 */
export function getNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

/**
 * Shows an immediate local or service-worker notification for a new order.
 * Works even if the tab is minimized or backgrounded.
 */
export async function triggerOrderNotification(order) {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return;
  }

  if (Notification.permission !== 'granted') {
    return;
  }

  const title = `NEW ORDER AVAILABLE! ORD-${order.order_id}`;
  const itemCount = order.total_item_quantity || order.items?.reduce((s, it) => s + it.quantity, 0) || 1;
  const productCount = order.distinct_products_count || order.items?.length || 1;
  
  const body = `Order #${order.order_id} • ${productCount} products (${itemCount} units total). Tap to accept and start picking.`;

  const options = {
    body,
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    vibrate: [200, 100, 200, 100, 400],
    data: {
      orderId: order.order_id
    },
    tag: `order-${order.order_id}`,
    renotify: true,
    requireInteraction: true
  };

  try {
    if (serviceWorkerRegistration && 'showNotification' in serviceWorkerRegistration) {
      await serviceWorkerRegistration.showNotification(title, options);
    } else {
      new Notification(title, options);
    }
  } catch (err) {
    console.warn('Failed to display browser notification:', err.message);
  }
}
