const VAPID_PUBLIC_KEY = 'BCpi2jJwr6V53ehBut_4eZnc9v9YB4z575FYB7vefBDZXV1dviJDSEMNHroL_2mqxpIlPNn9zfb4GL5DKo2tWvQ';

export class PushNotificationManager {
  private registration: ServiceWorkerRegistration | null = null;

  async initialize(): Promise<void> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('Push messaging is not supported');
      return;
    }

    try {
      // Register service worker if not already registered
      this.registration = await navigator.serviceWorker.ready;
      console.log('Service Worker registered for push notifications');
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  }

  async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      console.log('This browser does not support notifications');
      return 'denied';
    }

    let permission = Notification.permission;

    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }

    return permission;
  }

  async subscribe(): Promise<PushSubscription | null> {
    if (!this.registration) {
      console.log('Service Worker not registered');
      return null;
    }

    try {
      // Check if already subscribed
      let subscription = await this.registration.pushManager.getSubscription();
      
      if (!subscription) {
        // Subscribe to push notifications
        subscription = await this.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: this.urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
      }

      // Send subscription to server
      await this.saveSubscriptionToServer(subscription);
      
      return subscription;
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      return null;
    }
  }

  async unsubscribe(): Promise<boolean> {
    if (!this.registration) {
      return false;
    }

    try {
      const subscription = await this.registration.pushManager.getSubscription();
      
      if (subscription) {
        // Unsubscribe from push notifications
        await subscription.unsubscribe();
        
        // Remove subscription from server
        await this.removeSubscriptionFromServer(subscription);
        
        return true;
      }
    } catch (error) {
      console.error('Failed to unsubscribe from push notifications:', error);
    }
    
    return false;
  }

  async renewSubscription(): Promise<void> {
    if (!this.registration) {
      return;
    }

    try {
      const subscription = await this.registration.pushManager.getSubscription();
      
      if (subscription) {
        // Renew subscription on server
        await fetch('/api/push/renew', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            endpoint: subscription.endpoint
          }),
          credentials: 'include',
        });
      }
    } catch (error) {
      console.error('Failed to renew push subscription:', error);
    }
  }

  private async saveSubscriptionToServer(subscription: PushSubscription): Promise<void> {
    const subscriptionData = {
      endpoint: subscription.endpoint,
      p256dh: this.arrayBufferToBase64(subscription.getKey('p256dh')),
      auth: this.arrayBufferToBase64(subscription.getKey('auth')),
    };

    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(subscriptionData),
      credentials: 'include',
    });
  }

  private async removeSubscriptionFromServer(subscription: PushSubscription): Promise<void> {
    await fetch('/api/push/unsubscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        endpoint: subscription.endpoint
      }),
      credentials: 'include',
    });
  }

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }

    return outputArray;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer | null): string {
    if (!buffer) return '';
    
    const bytes = new Uint8Array(buffer);
    let binary = '';
    
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    
    return window.btoa(binary);
  }
}

export const pushManager = new PushNotificationManager();