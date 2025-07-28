import webpush from 'web-push';
import { storage } from './storage';

// Configure VAPID keys
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidContactEmail = process.env.VAPID_CONTACT_EMAIL || 'admin@uniloop.app';
const vapidSubject = vapidContactEmail.startsWith('mailto:') ? vapidContactEmail : `mailto:${vapidContactEmail}`;

if (!vapidPublicKey || !vapidPrivateKey) {
  throw new Error('VAPID keys are required for push notifications. Please set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in your environment variables.');
}

webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  url?: string;
  tag?: string;
  data?: any;
}

export interface NotificationTarget {
  type: 'all' | 'batch' | 'section' | 'users';
  value?: string | string[]; // batch name, section name, user email, or array of user IDs
}

export class PushNotificationService {
  /**
   * Send push notification to specific targets
   */
  static async sendNotification(
    payload: PushNotificationPayload,
    target: NotificationTarget
  ): Promise<{ success: number; failed: number; errors: any[] }> {
    try {
      // Get target user IDs based on criteria
      const userIds = await this.getTargetUserIds(target);
      
      if (userIds.length === 0) {
        console.log('No users found for target:', target);
        return { success: 0, failed: 0, errors: [] };
      }

      console.log(`Sending push notification to ${userIds.length} users`);

      // Get active push subscriptions for target users
      const subscriptions = await storage.getActivePushSubscriptions(userIds);
      
      if (subscriptions.length === 0) {
        console.log('No active push subscriptions found for target users');
        return { success: 0, failed: 0, errors: [] };
      }

      // Prepare notification data
      const notificationData = {
        title: payload.title,
        body: payload.body,
        icon: payload.icon || '/icons/192.png',
        badge: payload.badge || '/icons/144.png',
        image: payload.image,
        data: {
          url: payload.url || '/',
          tag: payload.tag || 'default',
          timestamp: Date.now(),
          ...payload.data
        },
        actions: payload.url ? [
          {
            action: 'open',
            title: 'Open',
            icon: '/icons/192.png'
          }
        ] : undefined,
        requireInteraction: true,
        vibrate: [200, 100, 200]
      };

      // Send notifications in parallel
      const results = await Promise.allSettled(
        subscriptions.map(async (subscription: any) => {
          try {
            const pushSubscription = {
              endpoint: subscription.endpoint,
              keys: {
                p256dh: subscription.p256dh,
                auth: subscription.auth
              }
            };

            await webpush.sendNotification(
              pushSubscription,
              JSON.stringify(notificationData),
              {
                TTL: 24 * 60 * 60, // 24 hours
                urgency: 'normal'
              }
            );

            return { success: true, subscriptionId: subscription.id };
          } catch (error: any) {
            console.error(`Failed to send push notification to subscription ${subscription.id}:`, error);
            
            // Remove invalid subscriptions
            if (error.statusCode === 410 || error.statusCode === 404) {
              await storage.deactivatePushSubscription(subscription.id);
              console.log(`Deactivated invalid subscription ${subscription.id}`);
            }
            
            return { success: false, subscriptionId: subscription.id, error };
          }
        })
      );

      // Count results
      const successCount = results.filter((r: any) => r.status === 'fulfilled' && r.value.success).length;
      const failedCount = results.length - successCount;
      const errors = results
        .filter((r: any) => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success))
        .map((r: any) => r.status === 'rejected' ? r.reason : r.value.error);

      console.log(`Push notification sent: ${successCount} success, ${failedCount} failed`);

      return { success: successCount, failed: failedCount, errors };
    } catch (error) {
      console.error('Error sending push notifications:', error);
      throw error;
    }
  }

  /**
   * Send event reminder notification
   */
  static async sendEventReminder(eventId: string, reminderMinutes: number): Promise<any> {
    try {
      const event = await storage.getEventById(eventId);
      if (!event) {
        throw new Error('Event not found');
      }

      const payload: PushNotificationPayload = {
        title: `Event Reminder: ${event.title}`,
        body: `Your event "${event.title}" starts in ${reminderMinutes} minutes`,
        icon: '/icons/192.png',
        url: `/calendar?event=${eventId}`,
        tag: `event-${eventId}`,
        data: {
          type: 'event_reminder',
          eventId: eventId,
          reminderMinutes: reminderMinutes
        }
      };

      // Get event attendees
      const attendees = await storage.getEventAttendees(eventId);
      const userIds = attendees.map((a: any) => a.userId);

      if (userIds.length === 0) {
        console.log('No attendees found for event:', eventId);
        return { success: 0, failed: 0, errors: [] };
      }

      return await this.sendNotification(payload, { type: 'user', value: userIds.join(',') });
    } catch (error) {
      console.error('Error sending event reminder:', error);
      throw error;
    }
  }

  /**
   * Send announcement notification
   */
  static async sendAnnouncementNotification(
    title: string,
    body: string,
    target: NotificationTarget,
    url?: string,
    imageUrl?: string
  ): Promise<any> {
    const payload: PushNotificationPayload = {
      title: title,
      body: body,
      icon: '/icons/192.png',
      image: imageUrl,
      url: url || '/community',
      tag: 'announcement',
      data: {
        type: 'announcement',
        timestamp: Date.now()
      }
    };

    return await this.sendNotification(payload, target);
  }

  /**
   * Get target user IDs based on criteria
   */
  private static async getTargetUserIds(target: NotificationTarget): Promise<string[]> {
    switch (target.type) {
      case 'all':
        const allUsers = await storage.getAllActiveUsers();
        return allUsers.map((u: any) => u.id);

      case 'batch':
        if (!target.value) throw new Error('Batch name is required');
        const batchUsers = await storage.getUsersByBatch(target.value);
        return batchUsers.map((u: any) => u.id);

      case 'section':
        if (!target.value) throw new Error('Section name is required');
        const sectionUsers = await storage.getUsersBySection(target.value);
        return sectionUsers.map((u: any) => u.id);

      case 'user':
        if (!target.value) throw new Error('User identifier is required');
        // Handle comma-separated user IDs or single email
        if (target.value.includes(',')) {
          return target.value.split(',').map(id => id.trim());
        } else if (target.value.includes('@')) {
          // Email provided, get user ID
          const user = await storage.getUserByEmail(target.value);
          return user ? [user.id] : [];
        } else {
          // Assume it's a user ID
          return [target.value];
        }

      default:
        throw new Error(`Unknown target type: ${target.type}`);
    }
  }
}

export default PushNotificationService;