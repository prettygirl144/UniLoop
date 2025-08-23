/**
 * Migration utilities for converting legacy event data to canonical format
 * Handles conversion of targeting, date formats, and attendance containers
 */

import { adaptLegacyTargets, normalizeTargets } from './eligibility';
import { storage } from '../storage';

export interface LegacyEvent {
  id: number;
  title: string;
  description?: string;
  date: Date | null;
  startTime?: string | null;
  endTime?: string | null;
  targetBatches?: string[];
  targetSections?: string[];
  targetBatchSections?: string[];
  rollNumberAttendees?: string[];
  // ... other fields
}

export interface CanonicalEvent {
  id: number;
  title: string;
  description?: string;
  startsAt: Date;
  endsAt?: Date | null;
  targets: {
    batches: string[];
    sections: string[];
    programs: string[];
  };
  // ... other fields
}

/**
 * Convert legacy date + time fields to canonical startsAt/endsAt
 */
export function convertLegacyDates(event: LegacyEvent): { startsAt: Date; endsAt: Date | null } {
  // If event has no date, use current date as fallback
  const baseDate = event.date || new Date();
  
  let startsAt = new Date(baseDate);
  let endsAt: Date | null = null;
  
  // Parse start time if available
  if (event.startTime) {
    try {
      const [hours, minutes] = event.startTime.split(':').map(Number);
      if (!isNaN(hours) && !isNaN(minutes)) {
        startsAt.setHours(hours, minutes, 0, 0);
      }
    } catch (error) {
      console.warn(`Failed to parse start time "${event.startTime}" for event ${event.id}`);
    }
  }
  
  // Parse end time if available
  if (event.endTime) {
    try {
      const [hours, minutes] = event.endTime.split(':').map(Number);
      if (!isNaN(hours) && !isNaN(minutes)) {
        endsAt = new Date(baseDate);
        endsAt.setHours(hours, minutes, 0, 0);
        
        // Handle end time on next day if it's before start time
        if (endsAt <= startsAt) {
          endsAt.setDate(endsAt.getDate() + 1);
        }
      }
    } catch (error) {
      console.warn(`Failed to parse end time "${event.endTime}" for event ${event.id}`);
    }
  }
  
  return { startsAt, endsAt };
}

/**
 * Convert legacy event to canonical format
 */
export function convertLegacyEvent(legacyEvent: LegacyEvent): CanonicalEvent {
  const { startsAt, endsAt } = convertLegacyDates(legacyEvent);
  
  // Convert targeting using existing adapter
  const targets = adaptLegacyTargets({
    targetBatches: legacyEvent.targetBatches || [],
    targetSections: legacyEvent.targetSections || [],
    targetBatchSections: legacyEvent.targetBatchSections || [],
    rollNumberAttendees: legacyEvent.rollNumberAttendees || []
  });
  
  return {
    ...legacyEvent,
    startsAt,
    endsAt,
    targets: normalizeTargets(targets)
  };
}

/**
 * Migrate single event to canonical format
 */
export async function migrateEventToCanonical(eventId: number): Promise<boolean> {
  try {
    const event = await storage.getEventById(eventId);
    if (!event) {
      console.warn(`Event ${eventId} not found during migration`);
      return false;
    }
    
    // Check if event is already in canonical format
    if (event.startsAt && event.targets) {
      console.info(`Event ${eventId} already in canonical format`);
      return true;
    }
    
    console.info(`Migrating event ${eventId} to canonical format`);
    
    // Convert to canonical format
    const canonicalEvent = convertLegacyEvent(event as LegacyEvent);
    
    // Update event with canonical data
    await storage.updateEventCanonical(eventId, {
      startsAt: canonicalEvent.startsAt,
      endsAt: canonicalEvent.endsAt,
      targets: canonicalEvent.targets
    });
    
    // Create AttendanceContainer if it doesn't exist
    let container = await storage.getAttendanceContainer(eventId);
    if (!container) {
      await storage.createAttendanceContainer({
        eventId,
        totalStudents: 0,
        presentCount: 0,
        absentCount: 0,
        lateCount: 0,
        unmarkedCount: 0,
        excusedCount: 0
      });
      
      // Update container stats based on existing attendance data
      await storage.updateAttendanceContainerStats(eventId);
      
      console.info(`Created AttendanceContainer for event ${eventId}`);
    }
    
    console.info(`Successfully migrated event ${eventId} to canonical format`);
    return true;
  } catch (error) {
    console.error(`Failed to migrate event ${eventId}:`, error);
    return false;
  }
}

/**
 * Migrate all events to canonical format
 */
export async function migrateAllEventsToCanonical(): Promise<{
  total: number;
  migrated: number;
  failed: number;
  skipped: number;
}> {
  const stats = {
    total: 0,
    migrated: 0,
    failed: 0,
    skipped: 0
  };
  
  try {
    const allEvents = await storage.getEvents();
    stats.total = allEvents.length;
    
    console.info(`Starting migration of ${stats.total} events to canonical format`);
    
    for (const event of allEvents) {
      try {
        // Check if already canonical
        if (event.startsAt && event.targets) {
          stats.skipped++;
          continue;
        }
        
        const success = await migrateEventToCanonical(event.id);
        if (success) {
          stats.migrated++;
        } else {
          stats.failed++;
        }
        
        // Add small delay to avoid overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 10));
      } catch (error) {
        console.error(`Migration failed for event ${event.id}:`, error);
        stats.failed++;
      }
    }
    
    console.info(`Migration complete:`, stats);
    return stats;
  } catch (error) {
    console.error('Failed to get events for migration:', error);
    throw error;
  }
}

/**
 * Validate canonical event data integrity
 */
export async function validateCanonicalEvent(eventId: number): Promise<{
  valid: boolean;
  issues: string[];
}> {
  const issues: string[] = [];
  
  try {
    const event = await storage.getEventById(eventId);
    if (!event) {
      issues.push('Event not found');
      return { valid: false, issues };
    }
    
    // Check required canonical fields
    if (!event.startsAt) {
      issues.push('Missing startsAt field');
    }
    
    if (!event.targets) {
      issues.push('Missing targets field');
    } else {
      if (!event.targets.batches || event.targets.batches.length === 0) {
        issues.push('No target batches specified');
      }
    }
    
    // Check AttendanceContainer exists
    const container = await storage.getAttendanceContainer(eventId);
    if (!container) {
      issues.push('Missing AttendanceContainer');
    }
    
    return {
      valid: issues.length === 0,
      issues
    };
  } catch (error) {
    issues.push(`Validation error: ${error instanceof Error ? error.message : String(error)}`);
    return { valid: false, issues };
  }
}

/**
 * Check migration status for all events
 */
export async function checkMigrationStatus(): Promise<{
  total: number;
  canonical: number;
  legacy: number;
  invalid: number;
}> {
  const status = {
    total: 0,
    canonical: 0,
    legacy: 0,
    invalid: 0
  };
  
  try {
    const allEvents = await storage.getEvents();
    status.total = allEvents.length;
    
    for (const event of allEvents) {
      const validation = await validateCanonicalEvent(event.id);
      if (validation.valid) {
        status.canonical++;
      } else if (event.date) {
        status.legacy++;
      } else {
        status.invalid++;
      }
    }
    
    return status;
  } catch (error) {
    console.error('Failed to check migration status:', error);
    throw error;
  }
}