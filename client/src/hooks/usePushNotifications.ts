import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from './use-toast';

interface UsePushNotificationsReturn {
  isSupported: boolean;
  isSubscribed: boolean;
  isLoading: boolean;
  permission: NotificationPermission;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
  requestPermission: () => Promise<NotificationPermission>;
}

export function usePushNotifications(): UsePushNotificationsReturn {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const { user } = useAuth();
  const { toast } = useToast();

  // Check if push notifications are supported
  useEffect(() => {
    const checkSupport = () => {
      const supported = 'serviceWorker' in navigator && 
                       'PushManager' in window && 
                       'Notification' in window;
      setIsSupported(supported);
      
      if (supported && 'Notification' in window) {
        setPermission(Notification.permission);
      }
    };

    checkSupport();
  }, []);

  // Check current subscription status
  useEffect(() => {
    const checkSubscription = async () => {
      if (!isSupported || !user) return;

      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        setIsSubscribed(!!subscription);
      } catch (error) {
        console.error('Error checking subscription:', error);
      }
    };

    checkSubscription();
  }, [isSupported, user]);

  const requestPermission = async (): Promise<NotificationPermission> => {
    if (!isSupported) {
      throw new Error('Push notifications are not supported');
    }

    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  };

  const subscribe = async (): Promise<void> => {
    if (!isSupported || !user) {
      throw new Error('Push notifications are not supported or user not authenticated');
    }

    setIsLoading(true);

    try {
      // Request permission if not granted
      let currentPermission = permission;
      if (currentPermission !== 'granted') {
        currentPermission = await requestPermission();
        if (currentPermission !== 'granted') {
          throw new Error('Notification permission denied');
        }
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;
      
      // Check if already subscribed
      let subscription = await registration.pushManager.getSubscription();
      
      if (!subscription) {
        // Subscribe to push notifications
        const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
        if (!vapidPublicKey) {
          throw new Error('VAPID public key not configured');
        }

        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
        });
      }

      if (subscription) {
        // Send subscription to server
        const subscriptionData = {
          userId: (user as any).id,
          endpoint: subscription.endpoint,
          p256dh: arrayBufferToBase64(subscription.getKey('p256dh')!),
          auth: arrayBufferToBase64(subscription.getKey('auth')!),
          userAgent: navigator.userAgent
        };

        await apiRequest('POST', '/api/push/subscribe', subscriptionData);
        setIsSubscribed(true);
        
        toast({
          title: 'Notifications Enabled',
          description: 'You will now receive push notifications for events and announcements.',
        });
      }
    } catch (error: any) {
      console.error('Error subscribing to push notifications:', error);
      toast({
        title: 'Subscription Failed',
        description: error.message || 'Failed to enable push notifications.',
        variant: 'destructive',
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const unsubscribe = async (): Promise<void> => {
    if (!isSupported || !user) {
      throw new Error('Push notifications are not supported or user not authenticated');
    }

    setIsLoading(true);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Unsubscribe from push notifications
        await subscription.unsubscribe();
        
        // Notify server
        await apiRequest('POST', '/api/push/unsubscribe', { userId: (user as any).id });
        setIsSubscribed(false);
        
        toast({
          title: 'Notifications Disabled',
          description: 'You will no longer receive push notifications.',
        });
      }
    } catch (error: any) {
      console.error('Error unsubscribing from push notifications:', error);
      toast({
        title: 'Unsubscribe Failed',
        description: error.message || 'Failed to disable push notifications.',
        variant: 'destructive',
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isSupported,
    isSubscribed,
    isLoading,
    permission,
    subscribe,
    unsubscribe,
    requestPermission,
  };
}

// Helper functions
function urlBase64ToUint8Array(base64String: string): Uint8Array {
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

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach((b) => binary += String.fromCharCode(b));
  return window.btoa(binary);
}

export default usePushNotifications;