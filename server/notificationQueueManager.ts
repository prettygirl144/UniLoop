import { SmartNotification, NotificationBatch, InsertNotificationBatch } from "@shared/schema";
import { storage } from "./storage";
import { smartNotificationEngine, NotificationContext } from "./smartNotificationEngine";

export interface QueueConfig {
  maxBatchSize: number;
  batchTimeoutMs: number;
  maxRetries: number;
  retryDelayMs: number;
  throttleRatePerSecond: number;
}

export interface DeliveryResult {
  success: boolean;
  notificationId: number;
  channel: string;
  error?: string;
  deliveredAt?: Date;
}

export class NotificationQueueManager {
  private static instance: NotificationQueueManager;
  private processingQueue: Map<string, SmartNotification[]> = new Map();
  private batchTimers: Map<string, NodeJS.Timeout> = new Map();
  private isProcessing = false;
  private throttleQueue: SmartNotification[] = [];
  private lastProcessedTime = 0;

  private config: QueueConfig = {
    maxBatchSize: 10,
    batchTimeoutMs: 5 * 60 * 1000, // 5 minutes
    maxRetries: 3,
    retryDelayMs: 30 * 1000, // 30 seconds
    throttleRatePerSecond: 10 // Max 10 notifications per second
  };

  static getInstance(): NotificationQueueManager {
    if (!NotificationQueueManager.instance) {
      NotificationQueueManager.instance = new NotificationQueueManager();
    }
    return NotificationQueueManager.instance;
  }

  /**
   * Initialize the queue manager and start processing
   */
  async initialize(): Promise<void> {
    console.log('🔔 Initializing Smart Notification Queue Manager');
    
    // Start the main processing loop
    this.startProcessingLoop();
    
    // Process any pending notifications from database
    await this.processPendingNotifications();
    
    console.log('✅ Notification Queue Manager initialized');
  }

  /**
   * Add notification to appropriate queue based on batch eligibility
   */
  async enqueueNotification(notification: SmartNotification): Promise<void> {
    const userId = notification.recipientUserId;
    
    // Check if notification should be batched
    const isBatchEligible = notification.metadata?.batchEligible === true;
    
    if (isBatchEligible && notification.priority !== 'critical' && notification.priority !== 'high') {
      await this.addToBatchQueue(userId, notification);
    } else {
      // Add to immediate processing queue
      this.throttleQueue.push(notification);
    }
  }

  /**
   * Add notification to batch queue
   */
  private async addToBatchQueue(userId: string, notification: SmartNotification): Promise<void> {
    const queueKey = this.getBatchQueueKey(userId, notification.category);
    
    if (!this.processingQueue.has(queueKey)) {
      this.processingQueue.set(queueKey, []);
    }
    
    const queue = this.processingQueue.get(queueKey)!;
    queue.push(notification);
    
    // Check if batch is ready for processing
    if (queue.length >= this.config.maxBatchSize) {
      await this.processBatch(queueKey);
    } else if (!this.batchTimers.has(queueKey)) {
      // Set timer for batch timeout
      const timer = setTimeout(async () => {
        await this.processBatch(queueKey);
      }, this.config.batchTimeoutMs);
      
      this.batchTimers.set(queueKey, timer);
    }
  }

  /**
   * Process a batch of notifications
   */
  private async processBatch(queueKey: string): Promise<void> {
    const queue = this.processingQueue.get(queueKey);
    if (!queue || queue.length === 0) return;

    console.log(`📦 Processing batch for ${queueKey} with ${queue.length} notifications`);
    
    try {
      // Clear the timer
      const timer = this.batchTimers.get(queueKey);
      if (timer) {
        clearTimeout(timer);
        this.batchTimers.delete(queueKey);
      }
      
      // Create batch record
      const batchData: InsertNotificationBatch = {
        userId: queue[0].recipientUserId,
        title: this.generateBatchTitle(queue),
        summary: this.generateBatchSummary(queue),
        notificationCount: queue.length,
        priority: this.determineBatchPriority(queue),
        scheduledFor: new Date()
      };
      
      const batch = await storage.createNotificationBatch(batchData);
      
      // Update notifications with batch ID
      for (const notification of queue) {
        await storage.updateNotificationStatus(
          notification.id!,
          'sent',
          { 
            ...notification.metadata,
            batchId: batch.id.toString()
          }
        );
      }
      
      // Mark batch as sent
      await storage.updateNotificationBatch(batch.id, {
        status: 'sent',
        sentAt: new Date()
      });
      
      // Clear the queue
      this.processingQueue.delete(queueKey);
      
      console.log(`✅ Batch processed successfully: ${batch.id}`);
      
    } catch (error) {
      console.error(`❌ Error processing batch for ${queueKey}:`, error);
      // Re-add notifications to throttle queue for individual processing
      this.throttleQueue.push(...queue);
      this.processingQueue.delete(queueKey);
    }
  }

  /**
   * Main processing loop for individual notifications
   * DISABLED: This was running every 100ms and consuming excessive compute units
   * TODO: Convert to event-driven architecture when re-enabling
   */
  private startProcessingLoop(): void {
    // DISABLED: This loop was checking every 100ms (10x per second) consuming ~60M compute units/month
    // Will be replaced with event-driven notification system in the future
    console.log('⚠️ Notification queue processing loop is DISABLED to reduce costs');
    
    /* ORIGINAL POLLING CODE - DISABLED
    setInterval(async () => {
      if (this.isProcessing || this.throttleQueue.length === 0) return;
      
      this.isProcessing = true;
      
      try {
        // Respect throttle rate
        const now = Date.now();
        const timeSinceLastProcess = now - this.lastProcessedTime;
        const minInterval = 1000 / this.config.throttleRatePerSecond;
        
        if (timeSinceLastProcess < minInterval) {
          this.isProcessing = false;
          return;
        }
        
        // Process next notification
        const notification = this.throttleQueue.shift();
        if (notification) {
          await this.processIndividualNotification(notification);
          this.lastProcessedTime = now;
        }
        
      } catch (error) {
        console.error('❌ Error in processing loop:', error);
      } finally {
        this.isProcessing = false;
      }
    }, 100); // Check every 100ms
    */
  }

  /**
   * Process individual notification
   */
  private async processIndividualNotification(notification: SmartNotification): Promise<void> {
    console.log(`🔔 Processing notification ${notification.id} for user ${notification.recipientUserId}`);
    
    try {
      const deliveryResults: DeliveryResult[] = [];
      
      // Process each delivery channel
      for (const channel of notification.deliveryChannels) {
        const result = await this.deliverToChannel(notification, channel);
        deliveryResults.push(result);
      }
      
      // Update notification status based on delivery results
      const anySuccessful = deliveryResults.some(r => r.success);
      const allFailed = deliveryResults.every(r => !r.success);
      
      if (anySuccessful) {
        await storage.updateNotificationStatus(notification.id!, 'sent');
        
        // Track analytics
        await storage.trackNotificationEvent({
          notificationId: notification.id!,
          userId: notification.recipientUserId,
          event: 'sent',
          metadata: {
            channels: notification.deliveryChannels,
            results: deliveryResults
          }
        });
        
        console.log(`✅ Notification ${notification.id} delivered successfully`);
      } else if (allFailed) {
        await this.handleFailedNotification(notification, deliveryResults);
      }
      
    } catch (error) {
      console.error(`❌ Error processing notification ${notification.id}:`, error);
      await this.handleFailedNotification(notification, []);
    }
  }

  /**
   * Deliver notification to specific channel
   */
  private async deliverToChannel(
    notification: SmartNotification,
    channel: string
  ): Promise<DeliveryResult> {
    try {
      switch (channel) {
        case 'push':
          return await this.deliverPushNotification(notification);
        case 'email':
          return await this.deliverEmailNotification(notification);
        case 'in_app':
          return await this.deliverInAppNotification(notification);
        default:
          return {
            success: false,
            notificationId: notification.id!,
            channel,
            error: `Unknown channel: ${channel}`
          };
      }
    } catch (error) {
      return {
        success: false,
        notificationId: notification.id!,
        channel,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Deliver push notification
   */
  private async deliverPushNotification(notification: SmartNotification): Promise<DeliveryResult> {
    // TODO: Integrate with existing push notification system
    // For now, simulate delivery
    console.log(`📱 Delivering push notification to ${notification.recipientUserId}`);
    
    // Simulate some processing time
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
      success: true,
      notificationId: notification.id!,
      channel: 'push',
      deliveredAt: new Date()
    };
  }

  /**
   * Deliver email notification
   */
  private async deliverEmailNotification(notification: SmartNotification): Promise<DeliveryResult> {
    // TODO: Integrate with email service
    console.log(`📧 Delivering email notification to ${notification.recipientUserId}`);
    
    // Simulate email delivery
    await new Promise(resolve => setTimeout(resolve, 200));
    
    return {
      success: true,
      notificationId: notification.id!,
      channel: 'email',
      deliveredAt: new Date()
    };
  }

  /**
   * Deliver in-app notification (always succeeds as it's stored in DB)
   */
  private async deliverInAppNotification(notification: SmartNotification): Promise<DeliveryResult> {
    // In-app notifications are stored in database and shown in UI
    // This method always succeeds since the notification is already in the database
    
    return {
      success: true,
      notificationId: notification.id!,
      channel: 'in_app',
      deliveredAt: new Date()
    };
  }

  /**
   * Handle failed notification with retry logic
   */
  private async handleFailedNotification(
    notification: SmartNotification,
    results: DeliveryResult[]
  ): Promise<void> {
    const retryCount = (notification.metadata?.retryCount || 0) + 1;
    
    if (retryCount <= this.config.maxRetries) {
      // Schedule retry
      console.log(`🔄 Scheduling retry ${retryCount} for notification ${notification.id}`);
      
      setTimeout(() => {
        const updatedNotification = {
          ...notification,
          metadata: {
            ...notification.metadata,
            retryCount
          }
        };
        this.throttleQueue.push(updatedNotification);
      }, this.config.retryDelayMs);
      
    } else {
      // Mark as failed
      console.log(`❌ Notification ${notification.id} failed after ${retryCount} attempts`);
      
      await storage.updateNotificationStatus(notification.id!, 'failed', {
        ...notification.metadata,
        retryCount,
        failureReasons: results.map(r => r.error).filter(Boolean)
      });
      
      // Track failure analytics
      await storage.trackNotificationEvent({
        notificationId: notification.id!,
        userId: notification.recipientUserId,
        event: 'failed',
        metadata: {
          retryCount,
          failureReasons: results.map(r => r.error).filter(Boolean)
        }
      });
    }
  }

  /**
   * Process pending notifications from database
   */
  private async processPendingNotifications(): Promise<void> {
    try {
      const pendingNotifications = await storage.getPendingNotifications(100);
      
      console.log(`📋 Found ${pendingNotifications.length} pending notifications`);
      
      for (const notification of pendingNotifications) {
        await this.enqueueNotification(notification);
      }
      
    } catch (error) {
      console.error('❌ Error processing pending notifications:', error);
    }
  }

  /**
   * Utility methods
   */
  private getBatchQueueKey(userId: string, category: string): string {
    return `${userId}:${category}`;
  }

  private generateBatchTitle(notifications: SmartNotification[]): string {
    const categories = [...new Set(notifications.map(n => n.category))];
    if (categories.length === 1) {
      return `${notifications.length} ${categories[0]} updates`;
    }
    return `${notifications.length} new updates`;
  }

  private generateBatchSummary(notifications: SmartNotification[]): string {
    const summary = notifications.slice(0, 3).map(n => n.title).join(', ');
    if (notifications.length > 3) {
      return `${summary} and ${notifications.length - 3} more...`;
    }
    return summary;
  }

  private determineBatchPriority(notifications: SmartNotification[]): string {
    const priorities = notifications.map(n => n.priority);
    if (priorities.includes('high')) return 'high';
    if (priorities.includes('medium')) return 'medium';
    return 'low';
  }

  /**
   * Get queue statistics
   */
  getQueueStats(): any {
    return {
      throttleQueueSize: this.throttleQueue.length,
      batchQueues: Array.from(this.processingQueue.entries()).map(([key, queue]) => ({
        key,
        size: queue.length
      })),
      isProcessing: this.isProcessing,
      config: this.config
    };
  }
}

export const notificationQueueManager = NotificationQueueManager.getInstance();