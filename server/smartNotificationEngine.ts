import { 
  SmartNotification,
  InsertSmartNotification, 
  NotificationPreferences,
  User
} from "@shared/schema";
import { storage } from "./storage";
import { broadcastToClients } from "./routes";

export interface NotificationContext {
  userId: string;
  userRole: string;
  userBatch?: string;
  userSection?: string;
  currentTime: Date;
  isAcademicHours: boolean;
  isOnCampus?: boolean;
  deviceType?: string;
  lastEngagement?: Date;
}

export interface PriorityResult {
  finalPriority: string;
  urgencyScore: number;
  scheduledFor?: Date;
  deliveryChannels: string[];
  personalizedContent?: string;
  batchEligible: boolean;
}

export class SmartNotificationEngine {
  private static instance: SmartNotificationEngine;
  
  // Priority hierarchy: critical > high > medium > low
  private priorityWeights = {
    critical: 100,
    high: 75,
    medium: 50,
    low: 25
  };

  // Time-based modifiers
  private timeModifiers = {
    academicHours: { weight: 0.8, name: "academic_hours" }, // Reduce during class time
    quietHours: { weight: 0.3, name: "quiet_hours" }, // Significantly reduce during night
    weekends: { weight: 0.9, name: "weekends" }, // Slightly reduce on weekends
    emergencyOverride: { weight: 2.0, name: "emergency" } // Boost for critical notifications
  };

  // Category urgency base scores
  private categoryUrgency = {
    system: 90,
    announcement: 80,
    event: 70,
    calendar: 60,
    amenities: 50,
    forum: 30
  };

  static getInstance(): SmartNotificationEngine {
    if (!SmartNotificationEngine.instance) {
      SmartNotificationEngine.instance = new SmartNotificationEngine();
    }
    return SmartNotificationEngine.instance;
  }

  /**
   * Main method to calculate notification priority and delivery strategy
   */
  async calculatePriority(
    notification: InsertSmartNotification,
    context: NotificationContext
  ): Promise<PriorityResult> {
    // Get user preferences
    const userPrefs = await storage.getNotificationPreferences(context.userId);
    
    // Calculate base urgency score
    let urgencyScore = this.calculateBaseUrgencyScore(notification, context);
    
    // Apply contextual modifiers
    urgencyScore = this.applyContextualModifiers(urgencyScore, notification, context, userPrefs);
    
    // Apply user engagement patterns
    urgencyScore = await this.applyEngagementModifiers(urgencyScore, context);
    
    // Determine final priority level
    const finalPriority = this.determineFinalPriority(urgencyScore, notification.priority);
    
    // Calculate delivery timing
    const scheduledFor = this.calculateDeliveryTime(notification, context, userPrefs);
    
    // Determine delivery channels
    const deliveryChannels = this.selectDeliveryChannels(notification, context, userPrefs);
    
    // Check batch eligibility
    const batchEligible = this.isBatchEligible(notification, context, userPrefs);
    
    // Generate personalized content
    const personalizedContent = this.generatePersonalizedContent(notification, context);

    return {
      finalPriority,
      urgencyScore,
      scheduledFor,
      deliveryChannels,
      personalizedContent,
      batchEligible
    };
  }

  /**
   * Calculate base urgency score based on category and content
   */
  private calculateBaseUrgencyScore(
    notification: InsertSmartNotification,
    context: NotificationContext
  ): number {
    let score = this.categoryUrgency[notification.category as keyof typeof this.categoryUrgency] || 50;
    
    // Priority boost
    score += this.priorityWeights[notification.priority as keyof typeof this.priorityWeights] || 50;
    
    // Contextual data modifiers
    if (notification.contextualData) {
      const contextData = notification.contextualData;
      
      // Action required boosts priority
      if (contextData.actionRequired) {
        score += 20;
      }
      
      // Deadline proximity
      if (contextData.deadline) {
        const deadline = new Date(contextData.deadline);
        const timeDiff = deadline.getTime() - context.currentTime.getTime();
        const hoursDiff = timeDiff / (1000 * 60 * 60);
        
        if (hoursDiff <= 1) score += 30; // Very urgent
        else if (hoursDiff <= 6) score += 20; // Urgent
        else if (hoursDiff <= 24) score += 10; // Moderately urgent
      }
      
      // User/batch targeting specificity
      if (contextData.batchTargeted?.includes(context.userBatch || '')) {
        score += 15;
      }
      if (contextData.sectionTargeted?.includes(context.userSection || '')) {
        score += 10;
      }
    }
    
    return Math.min(score, 200); // Cap at 200
  }

  /**
   * Apply contextual modifiers based on time, location, and user state
   */
  private applyContextualModifiers(
    score: number,
    notification: InsertSmartNotification,
    context: NotificationContext,
    userPrefs?: NotificationPreferences
  ): number {
    let modifiedScore = score;
    
    // Academic hours modifier
    if (context.isAcademicHours && userPrefs?.contextualRules?.academicHours) {
      if (notification.priority !== 'critical') {
        modifiedScore *= this.timeModifiers.academicHours.weight;
      }
    }
    
    // Quiet hours check
    if (userPrefs?.globalSettings) {
      const currentHour = context.currentTime.getHours();
      const quietStart = parseInt(userPrefs.globalSettings.quietHours.start.split(':')[0]);
      const quietEnd = parseInt(userPrefs.globalSettings.quietHours.end.split(':')[0]);
      
      const isQuietHours = this.isInQuietHours(currentHour, quietStart, quietEnd);
      
      if (isQuietHours && notification.priority !== 'critical') {
        modifiedScore *= this.timeModifiers.quietHours.weight;
      }
    }
    
    // Weekend modifier
    const isWeekend = context.currentTime.getDay() === 0 || context.currentTime.getDay() === 6;
    if (isWeekend && notification.category !== 'system') {
      modifiedScore *= this.timeModifiers.weekends.weight;
    }
    
    // Role-specific adjustments
    if (userPrefs?.contextualRules?.roleSpecific) {
      if (context.userRole === 'admin' && notification.category === 'system') {
        modifiedScore *= 1.2; // Boost system notifications for admins
      }
    }
    
    return modifiedScore;
  }

  /**
   * Apply engagement-based modifiers
   */
  private async applyEngagementModifiers(
    score: number,
    context: NotificationContext
  ): Promise<number> {
    try {
      const engagementStats = await storage.getUserEngagementStats(context.userId, 7);
      
      if (engagementStats && engagementStats.length > 0) {
        const totalEvents = engagementStats.reduce((sum: number, stat: any) => sum + stat.count, 0);
        const openedEvents = engagementStats.find((stat: any) => stat.event === 'opened')?.count || 0;
        
        const engagementRate = totalEvents > 0 ? openedEvents / totalEvents : 0.5;
        
        // Adjust score based on engagement
        if (engagementRate > 0.7) {
          score *= 1.1; // High engagement users get slight boost
        } else if (engagementRate < 0.3) {
          score *= 0.9; // Low engagement users get reduced priority
        }
      }
    } catch (error) {
      console.error('Error applying engagement modifiers:', error);
    }
    
    return score;
  }

  /**
   * Determine final priority level from urgency score
   */
  private determineFinalPriority(urgencyScore: number, basePriority: string): string {
    // Never downgrade critical notifications
    if (basePriority === 'critical') return 'critical';
    
    if (urgencyScore >= 150) return 'critical';
    if (urgencyScore >= 100) return 'high';
    if (urgencyScore >= 60) return 'medium';
    return 'low';
  }

  /**
   * Calculate optimal delivery time
   */
  private calculateDeliveryTime(
    notification: InsertSmartNotification,
    context: NotificationContext,
    userPrefs?: NotificationPreferences
  ): Date | undefined {
    // Immediate delivery for critical notifications
    if (notification.priority === 'critical') {
      return undefined; // Send immediately
    }
    
    // Check if we should delay for batching
    if (userPrefs?.globalSettings?.batchDelay && 
        notification.priority === 'low' && 
        !notification.contextualData?.actionRequired) {
      const delayMinutes = userPrefs.globalSettings.batchDelay;
      const scheduledTime = new Date(context.currentTime);
      scheduledTime.setMinutes(scheduledTime.getMinutes() + delayMinutes);
      return scheduledTime;
    }
    
    // Schedule for next appropriate time during quiet hours
    if (userPrefs?.globalSettings) {
      const currentHour = context.currentTime.getHours();
      const quietStart = parseInt(userPrefs.globalSettings.quietHours.start.split(':')[0]);
      const quietEnd = parseInt(userPrefs.globalSettings.quietHours.end.split(':')[0]);
      
      if (this.isInQuietHours(currentHour, quietStart, quietEnd) && 
          notification.priority !== 'high') {
        const nextMorning = new Date(context.currentTime);
        nextMorning.setHours(quietEnd, 0, 0, 0);
        if (nextMorning <= context.currentTime) {
          nextMorning.setDate(nextMorning.getDate() + 1);
        }
        return nextMorning;
      }
    }
    
    return undefined; // Send immediately
  }

  /**
   * Select appropriate delivery channels
   */
  private selectDeliveryChannels(
    notification: InsertSmartNotification,
    context: NotificationContext,
    userPrefs?: NotificationPreferences
  ): string[] {
    const channels: string[] = ['in_app']; // Always include in-app
    
    if (!userPrefs?.globalSettings?.enabled) {
      return channels; // Only in-app if notifications disabled
    }
    
    // Get category preferences
    const categoryPref = userPrefs?.categoryPreferences?.[
      notification.category as keyof typeof userPrefs.categoryPreferences
    ];
    
    if (categoryPref?.enabled) {
      // Add channels based on priority and user preferences
      if (notification.priority === 'critical') {
        channels.push('push', 'email'); // All channels for critical
      } else if (notification.priority === 'high') {
        if (categoryPref.channels.includes('push')) {
          channels.push('push');
        }
      } else {
        // Medium/low priority respects user channel preferences
        categoryPref.channels.forEach(channel => {
          if (channel !== 'in_app' && !channels.includes(channel)) {
            channels.push(channel);
          }
        });
      }
    }
    
    return [...new Set(channels)]; // Remove duplicates
  }

  /**
   * Check if notification is eligible for batching
   */
  private isBatchEligible(
    notification: InsertSmartNotification,
    context: NotificationContext,
    userPrefs?: NotificationPreferences
  ): boolean {
    // Never batch critical or high priority notifications
    if (notification.priority === 'critical' || notification.priority === 'high') {
      return false;
    }
    
    // Don't batch if action required
    if (notification.contextualData?.actionRequired) {
      return false;
    }
    
    // Check user preferences
    if (userPrefs?.globalSettings?.batchDelay && userPrefs.globalSettings.batchDelay > 0) {
      return true;
    }
    
    return false;
  }

  /**
   * Generate personalized content based on user context
   */
  private generatePersonalizedContent(
    notification: InsertSmartNotification,
    context: NotificationContext
  ): string | undefined {
    const firstName = context.userId.split(' ')[0] || 'Student';
    
    // Simple personalization for now
    if (notification.category === 'event') {
      return `Hi ${firstName}, ${notification.content}`;
    }
    
    if (notification.category === 'announcement' && context.userBatch) {
      return `${notification.content} (${context.userBatch})`;
    }
    
    return undefined;
  }

  /**
   * Check if current time is in quiet hours
   */
  private isInQuietHours(currentHour: number, quietStart: number, quietEnd: number): boolean {
    if (quietStart < quietEnd) {
      // Same day range (e.g., 22:00 to 08:00 next day)
      return currentHour >= quietStart || currentHour < quietEnd;
    } else {
      // Cross midnight range
      return currentHour >= quietStart && currentHour < quietEnd;
    }
  }

  /**
   * Create notification with calculated priority and context
   */
  async createSmartNotification(
    notification: InsertSmartNotification,
    context: NotificationContext
  ): Promise<SmartNotification> {
    const priorityResult = await this.calculatePriority(notification, context);
    
    // Update notification with calculated values
    const enhancedNotification: InsertSmartNotification = {
      ...notification,
      priority: priorityResult.finalPriority,
      scheduledFor: priorityResult.scheduledFor,
      deliveryChannels: priorityResult.deliveryChannels,
      contextualData: {
        ...notification.contextualData,
        urgencyScore: priorityResult.urgencyScore
      },
      metadata: {
        ...notification.metadata,
        personalizedContent: priorityResult.personalizedContent,
        batchEligible: priorityResult.batchEligible
      }
    };
    
    const created = await storage.createSmartNotification(enhancedNotification);
    
    // Broadcast notification to all connected clients via WebSocket
    broadcastToClients({
      type: 'NEW_NOTIFICATION',
      data: {
        notificationId: created.id,
        recipientUserId: created.recipientUserId,
        category: created.category,
        priority: created.priority
      }
    });
    
    return created;
  }

  /**
   * Batch process multiple notifications for efficiency
   */
  async batchCreateNotifications(
    notifications: { notification: InsertSmartNotification; context: NotificationContext }[]
  ): Promise<SmartNotification[]> {
    const results: SmartNotification[] = [];
    
    for (const { notification, context } of notifications) {
      try {
        const created = await this.createSmartNotification(notification, context);
        results.push(created);
      } catch (error) {
        console.error('Error creating notification:', error);
      }
    }
    
    return results;
  }
}

export const smartNotificationEngine = SmartNotificationEngine.getInstance();