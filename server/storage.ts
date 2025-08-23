import {
  users,
  announcements,
  events,
  eventRsvps,
  communityPosts,
  communityVotes,
  communityReplies,
  communityAnnouncements,
  sickFoodBookings,
  hostelLeave,
  grievances,
  weeklyMenu,
  attendance,
  attendanceSheets,
  attendanceRecords,
  attendanceContainers,
  galleryFolders,
  amenitiesPermissions,
  studentDirectory,
  studentUploadLogs,
  triathlonTeams,
  triathlonPointHistory,
  pushSubscriptions,
  type User,
  type UpsertUser,
  type InsertAnnouncement,
  type Announcement,
  type InsertEvent,
  type Event,
  type InsertEventRsvp,
  type EventRsvp,
  type InsertCommunityPost,
  type CommunityPost,
  type InsertCommunityVote,
  type CommunityVote,
  type InsertCommunityReply,
  type CommunityReply,
  type InsertCommunityAnnouncement,
  type CommunityAnnouncement,
  type InsertSickFoodBooking,
  type SickFoodBooking,
  type InsertHostelLeave,
  type HostelLeave,
  type InsertGrievance,
  type Grievance,
  type InsertGalleryFolder,
  type GalleryFolder,
  type WeeklyMenu,
  type InsertWeeklyMenu,
  type AmenitiesPermissions,
  type InsertAmenitiesPermissions,
  type StudentDirectory,
  type InsertStudentDirectory,
  type StudentUploadLog,
  type InsertStudentUploadLog,
  type TriathlonTeam,
  type InsertTriathlonTeam,
  type TriathlonPointHistory,
  type InsertTriathlonPointHistory,
  type PushSubscription,
  type InsertPushSubscription,
  type AttendanceSheet,
  type InsertAttendanceSheet,
  type AttendanceRecord,
  type InsertAttendanceRecord,
  type AttendanceContainer,
  type NewAttendanceContainer,
  batchSections,
  type BatchSection,
  type InsertBatchSection,
  type CommunityPostWithVotes,
  type CommunityReplyWithVotes,
  smartNotifications,
  type SmartNotification,
  type InsertSmartNotification,
  notificationPreferences,
  type NotificationPreferences,
  type InsertNotificationPreferences,
  notificationAnalytics,
  type NotificationAnalytics,
  type InsertNotificationAnalytics,
  notificationBatches,
  type NotificationBatch,
  type InsertNotificationBatch,
} from "@shared/schema";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { eq, desc, and, gte, lte, or, sql, inArray, isNotNull, ne } from "drizzle-orm";
import crypto from "crypto";
import { isEligible, adaptLegacyTargets, normalizeTargets, normalizeToBatchScoped, type EligibilityTargets } from "./lib/eligibility";

// Normalize utility exactly as specified - same as in routes.ts
function norm(arr: any): string[] {
  return Array.from(new Set((arr || []).map((x: any) => String(x).trim())))
    .filter(Boolean)
    .sort() as string[];
}

export interface IStorage {
  // User operations (mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUser(userId: string, updateData: Partial<User>): Promise<User | undefined>;
  updateUserPermissions(userId: string, permissions: any): Promise<User | undefined>;

  // Announcements
  getAnnouncements(): Promise<Announcement[]>;
  createAnnouncement(announcement: InsertAnnouncement): Promise<Announcement>;

  // Events
  getEvents(): Promise<Event[]>;
  getEventsWithEligibility(user?: { batch?: string | null; section?: string | null; email?: string }): Promise<(Event & { eligible?: boolean })[]>;
  createEvent(event: InsertEvent): Promise<Event>;
  getEventById(id: number): Promise<Event | undefined>;
  updateEvent(id: number, eventData: Partial<InsertEvent>, requestId?: string): Promise<Event>;
  deleteEvent(id: number): Promise<void>;
  rsvpToEvent(rsvp: InsertEventRsvp): Promise<EventRsvp>;
  getUserRsvps(userId: string): Promise<EventRsvp[]>;
  
  // Attendance sheet management
  upsertAttendanceSheet(eventId: number, createdBy: string, requestId?: string): Promise<AttendanceSheet>;
  repairMissingAttendanceSheets(): Promise<{ repaired: number; eventIds: number[] }>;

  // Community Board (Section 1)
  getCommunityPosts(): Promise<CommunityPost[]>;
  createCommunityPost(post: InsertCommunityPost): Promise<CommunityPost>;
  getCommunityPostById(id: number): Promise<CommunityPost | undefined>;
  deleteCommunityPost(id: number, userId: string): Promise<void>;
  voteCommunityPost(vote: InsertCommunityVote): Promise<void>;
  getCommunityReplies(postId: number): Promise<CommunityReply[]>;
  createCommunityReply(reply: InsertCommunityReply): Promise<CommunityReply>;
  deleteCommunityReply(id: number, userId: string): Promise<void>;
  voteCommunityReply(vote: InsertCommunityVote): Promise<void>;
  
  // Community Announcements (Section 2)
  getCommunityAnnouncements(): Promise<CommunityAnnouncement[]>;
  createCommunityAnnouncement(announcement: InsertCommunityAnnouncement): Promise<CommunityAnnouncement>;
  deleteCommunityAnnouncement(id: number, userId: string): Promise<void>;

  // Weekly Menu Management
  getWeeklyMenuByDate(date: string): Promise<WeeklyMenu | undefined>;
  getWeeklyMenuRange(dates: string[]): Promise<WeeklyMenu[]>;
  replaceAllMenu(menuData: InsertWeeklyMenu[], uploadedBy: string): Promise<WeeklyMenu[]>;
  bookSickFood(booking: InsertSickFoodBooking): Promise<SickFoodBooking>;
  getSickFoodBookings(date?: Date): Promise<SickFoodBooking[]>;
  applyForLeave(leave: InsertHostelLeave): Promise<HostelLeave>;
  getLeaveApplications(status?: string): Promise<HostelLeave[]>;
  approveLeave(id: number, token: string): Promise<HostelLeave>;
  denyLeave(id: number, token: string): Promise<HostelLeave>;
  updateLeaveStatus(id: number, status: string): Promise<HostelLeave>;
  submitGrievance(grievance: InsertGrievance): Promise<Grievance>;
  getGrievances(category?: string): Promise<Grievance[]>;
  resolveGrievance(id: number, adminNotes?: string): Promise<Grievance>;
  
  // Amenities permissions
  getAmenitiesPermissions(userId: string): Promise<AmenitiesPermissions | undefined>;
  setAmenitiesPermissions(permissions: InsertAmenitiesPermissions): Promise<AmenitiesPermissions>;

  // Attendance (legacy)
  saveAttendance(eventId: number, attendees: string[], markedBy: string): Promise<void>;
  
  // Attendance Sheets Management
  createAttendanceSheet(sheet: InsertAttendanceSheet): Promise<AttendanceSheet>;
  getAttendanceSheetByEventId(eventId: number): Promise<AttendanceSheet | undefined>;
  getAttendanceSheetById(sheetId: number): Promise<AttendanceSheet | undefined>;
  getAttendanceRecordsBySheetId(sheetId: number): Promise<AttendanceRecord[]>;
  createAttendanceRecords(records: InsertAttendanceRecord[]): Promise<AttendanceRecord[]>;
  updateAttendanceRecord(recordId: number, status: string, note?: string, markedBy?: string): Promise<AttendanceRecord>;
  bulkUpdateAttendanceRecords(sheetId: number, status: string, markedBy: string): Promise<void>;
  syncStudentsToAttendanceSheet(sheetId: number, batch: string, section: string): Promise<AttendanceRecord[]>;

  // Directory
  getAllUsers(): Promise<User[]>;
  searchUsers(query: string): Promise<User[]>;
  
  // Admin functions
  getAllUsersForAdmin(): Promise<User[]>;
  updateUserRoleAndPermissions(userId: string, role: string, permissions: any): Promise<User | undefined>;

  // Student Directory operations
  getStudentDirectory(): Promise<StudentDirectory[]>;
  getStudentByEmail(email: string): Promise<StudentDirectory | undefined>;
  getStudentByRollNumber(rollNumber: string): Promise<StudentDirectory | undefined>;
  getStudentDirectoryById(id: number): Promise<StudentDirectory | undefined>;
  getStudentDirectoryByEmail(email: string): Promise<StudentDirectory | undefined>;
  upsertStudentDirectory(student: InsertStudentDirectory): Promise<StudentDirectory>;
  batchUpsertStudents(students: InsertStudentDirectory[]): Promise<StudentDirectory[]>;
  checkRollNumberConflicts(students: InsertStudentDirectory[]): Promise<{conflicts: {rollNumber: string, existingEmail: string, newEmail: string}[], validStudents: InsertStudentDirectory[]}>;
  createUploadLog(log: InsertStudentUploadLog): Promise<StudentUploadLog>;
  getUploadLogs(): Promise<StudentUploadLog[]>;
  
  // Batch-Section Management
  upsertBatchSections(batchSectionData: InsertBatchSection[]): Promise<BatchSection[]>;
  getSectionsForBatches(batches: string[]): Promise<{ batch: string; section: string }[]>;
  getAllBatches(): Promise<string[]>;
  
  // Event Management Extended
  deleteEvent(id: number): Promise<void>;

  // Push Subscriptions
  savePushSubscription(subscription: InsertPushSubscription): Promise<PushSubscription>;
  deletePushSubscription(endpoint: string): Promise<void>;
  renewPushSubscription(endpoint: string): Promise<void>;
  getAllActiveSubscriptions(): Promise<PushSubscription[]>;
  getSubscriptionsForUser(userEmail: string): Promise<PushSubscription[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations (mandatory for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    // Try to find existing user first
    const existingUser = await this.getUser(userData.id);
    
    if (existingUser) {
      // Update existing user
      const [user] = await db
        .update(users)
        .set({
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userData.id))
        .returning();
      return user;
    } else {
      // Insert new user with default values
      const defaultPermissions = {
        calendar: false,
        attendance: false,
        gallery: false,
        forumMod: false,
        diningHostel: false,
        postCreation: false,
      };
      
      const [user] = await db
        .insert(users)
        .values([{
          ...userData,
          permissions: defaultPermissions,
        }])
        .returning();
      return user;
    }
  }

  async updateUser(userId: string, updateData: Partial<User>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async updateUserPermissions(userId: string, permissions: any): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ permissions })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async getLinkedAccounts(userId: string): Promise<User[]> {
    // Get all accounts linked to this user (including primary)
    return await db
      .select()
      .from(users)
      .where(
        or(
          eq(users.id, userId),
          eq(users.linkedAccountId, userId),
          eq(users.id, 
            sql`(SELECT linked_account_id FROM users WHERE id = ${userId})`
          )
        )
      );
  }

  async createAlternateAccount(primaryUserId: string, role: string, permissions: any): Promise<User> {
    const primaryUser = await this.getUser(primaryUserId);
    if (!primaryUser) {
      throw new Error("Primary user not found");
    }

    const alternateId = `${primaryUserId}_${role}`;
    const alternateUserData = {
      id: alternateId,
      email: primaryUser.email,
      firstName: primaryUser.firstName,
      lastName: primaryUser.lastName,
      profileImageUrl: primaryUser.profileImageUrl,
      role,
      permissions,
      accountType: "alternate",
      linkedAccountId: primaryUserId,
    };

    const [user] = await db
      .insert(users)
      .values([alternateUserData])
      .returning();
    return user;
  }

  // Gallery folder operations
  async getGalleryFolders(): Promise<any[]> {
    return await db
      .select()
      .from(galleryFolders)
      .where(eq(galleryFolders.isPublic, true))
      .orderBy(desc(galleryFolders.createdAt));
  }

  async getGalleryFolderById(id: number): Promise<any | undefined> {
    const [folder] = await db.select().from(galleryFolders).where(eq(galleryFolders.id, id));
    return folder;
  }

  async createGalleryFolder(folderData: any): Promise<any> {
    const [folder] = await db
      .insert(galleryFolders)
      .values([folderData])
      .returning();
    return folder;
  }

  async deleteGalleryFolder(id: number): Promise<void> {
    await db.delete(galleryFolders).where(eq(galleryFolders.id, id));
  }

  // Announcements
  async getAnnouncements(): Promise<Announcement[]> {
    return await db
      .select()
      .from(announcements)
      .orderBy(desc(announcements.createdAt));
  }

  async createAnnouncement(announcement: InsertAnnouncement): Promise<Announcement> {
    const requestId = `ann_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log(`🔧 [DB-WRITE] Creating announcement - RequestID: ${requestId}`);
    console.log(`📝 [DB-WRITE] Announcement payload:`, JSON.stringify({ title: announcement.title, authorId: announcement.authorId }, null, 2));
    
    const [created] = await db
      .insert(announcements)
      .values([announcement])
      .returning();
    
    console.log(`✅ [DB-WRITE] Announcement created successfully - ID: ${created.id}, RequestID: ${requestId}`);
    return created;
  }

  // Events
  async getEvents(): Promise<Event[]> {
    return await db
      .select()
      .from(events)
      .orderBy(sql`COALESCE(${events.startsAt}, ${events.date}) DESC`);
  }

  // Events with eligibility computation for user feed - SINGLE SOURCE OF TRUTH
  async getEventsWithEligibility(user?: { batch?: string | null; section?: string | null; email?: string | null; role?: string; program?: string | null }): Promise<(Event & { eligible?: boolean })[]> {
    const events = await this.getEvents();
    
    if (!user) {
      return events.map(event => ({ ...event, eligible: false }));
    }

    return events.map(event => {
      // Adapt legacy event data to new canonical targets format
      const targets = adaptLegacyTargets({
        targetBatches: event.targetBatches || [],
        targetSections: event.targetSections || [],
        targetBatchSections: event.targetBatchSections || [],
        rollNumberAttendees: event.rollNumberAttendees || []
      });

      // Use the single source of truth eligibility helper
      const eligible = isEligible(user, targets);

      // ELIGIBILITY_EVAL log as specified in requirements
      console.log(`ELIGIBILITY_EVAL: ${JSON.stringify({ 
        user: { 
          batch: user.batch, 
          section: user.section, 
          program: user.program || null,
          email: user.email,
          role: user.role
        }, 
        eventId: event.id, 
        targets: targets, 
        eligible: eligible,
        requestId: `eval-${Date.now()}` 
      })}`);

      return { ...event, eligible };
    });
  }


  async createEvent(event: InsertEvent): Promise<Event> {
    const requestId = `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log(`🔧 [DB-WRITE] Creating event - RequestID: ${requestId}`);
    console.log(`📝 [DB-WRITE] Event payload:`, JSON.stringify({ title: event.title, date: event.date, location: event.location, authorId: event.authorId }, null, 2));
    
    // NEW: Normalize payload to batch-scoped structure
    const normalizedTargets = normalizeToBatchScoped(event);
    
    // Convert mediaUrls properly for JSONB field
    const eventData: any = {
      ...event,
      // Replace targets with normalized batch-scoped structure
      targets: normalizedTargets,
    };
    // Handle mediaUrls as JSONB array
    if (event.mediaUrls) {
      eventData.mediaUrls = Array.isArray(event.mediaUrls) ? event.mediaUrls : [];
    } else {
      eventData.mediaUrls = [];
    }

    // Log the normalization for debugging
    console.log(`BATCH_SCOPED_NORMALIZATION: ${JSON.stringify({
      eventId: 'creating',
      originalPayload: { 
        targetBatches: event.targetBatches,
        targetSections: event.targetSections, 
        targetBatchSections: event.targetBatchSections 
      },
      normalizedTargets,
      requestId
    })}`);
    
    // Legacy support - still create canonical targets for backward compatibility
    if (event.targetBatches || event.targetSections || event.targetBatchSections || event.rollNumberAttendees) {
      const canonicalTargets = adaptLegacyTargets({
        targetBatches: event.targetBatches || [],
        targetSections: event.targetSections || [],
        targetBatchSections: event.targetBatchSections || [],
        rollNumberAttendees: (event.rollNumberAttendees as string[]) || []
      });
      
      // ATTENDANCE_ROSTER_BUILD log as specified
      console.log(`ATTENDANCE_ROSTER_BUILD: ${JSON.stringify({
        eventId: 'creating',
        targetBatches: canonicalTargets.batches,
        targetSections: canonicalTargets.sections,
        rosterCount: canonicalTargets.batches.length * (canonicalTargets.sections.length || 1),
        requestId
      })}`);
    }
    
    const [created] = await db
      .insert(events)
      .values([eventData])
      .returning();
    
    console.log(`✅ [DB-WRITE] Event created successfully - ID: ${created.id}, RequestID: ${requestId}`);
    console.log(`📊 [DB-WRITE] Created event details:`, { id: created.id, title: created.title, date: created.date });

    // Auto-create attendance sheets based on new batch-scoped targeting
    if (created && created.targets) {
      const targets = created.targets as { batches: string[]; sectionsByBatch: Record<string, string[]>; programs: string[]; rollEmailAttendees?: string[] };
      
      if (targets.batches && targets.batches.length > 0) {
        // NEW: Create attendance sheets respecting batch-scoped sections
        for (const batch of targets.batches) {
          const batchSections = targets.sectionsByBatch[batch] || [];
          // Empty array means all sections for this batch
          const sectionsToProcess = batchSections.length > 0 ? batchSections : await this.getSectionsForBatch(batch);
          
          for (const section of sectionsToProcess) {
            try {
              // Check if attendance sheet already exists for this specific batch-section (idempotent)
              const existingSheets = await db
                .select()
                .from(attendanceSheets)
                .where(and(
                  eq(attendanceSheets.eventId, created.id),
                  eq(attendanceSheets.batch, batch),
                  eq(attendanceSheets.section, section || 'All')
                ));
                
              if (existingSheets.length === 0) {
              // Create attendance sheet
              const sheet = await this.createAttendanceSheet({
                eventId: created.id,
                batch,
                section,
                createdBy: event.authorId,
              });

                // Get all students in this batch-section and create attendance records
                // Use normalized format for student lookup
                const students = await db
                  .select()
                  .from(studentDirectory)
                  .where(and(
                    eq(studentDirectory.batch, batch), 
                    section ? eq(studentDirectory.section, section) : sql`true`
                  ));

                if (students.length > 0) {
                  const attendanceRecords = students.map(student => ({
                    sheetId: sheet.id,
                    studentEmail: student.email,
                    studentName: student.email.split('@')[0] || '', // Use email prefix as name
                    rollNumber: student.rollNumber || null,
                    status: 'UNMARKED' as const,
                  }));

                  await this.createAttendanceRecords(attendanceRecords);
                  console.log(`Created attendance sheet for event ${created.id} with ${students.length} students from ${batch}::${section || 'All'}`);
                }
              }
            } catch (error) {
              console.error(`Failed to create attendance sheet for event ${created.id}:`, error);
              // Don't throw - event creation should succeed even if attendance sheet fails
            }
          }
        }
      }
    }
    
    return created;
  }

  async getEventById(id: number): Promise<Event | undefined> {
    const [event] = await db.select().from(events).where(eq(events.id, id));
    return event;
  }

  // ATTENDANCE SHEET ROBUSTNESS: wrap in transaction as specified
  async updateEvent(id: number, eventData: Partial<InsertEvent>, requestId?: string): Promise<Event> {
    const reqId = requestId || `evt_update_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return await db.transaction(async (tx) => {
      // Get current event for before/after logging
      const [currentEvent] = await tx.select().from(events).where(eq(events.id, id));
      console.log(`🔧 [EVENT_PATCH_TARGETS] Before update - RequestID: ${reqId}`, {
        eventId: id,
        currentTargets: {
          targetBatches: currentEvent?.targetBatches,
          targetSections: currentEvent?.targetSections,
          targetBatchSections: currentEvent?.targetBatchSections,
          rollNumberAttendees: currentEvent?.rollNumberAttendees
        }
      });

      // NEW: Normalize update payload to batch-scoped structure
      const normalizedTargets = normalizeToBatchScoped(eventData);
      
      // ATOMIC REPLACEMENT of target arrays
      const updateData: any = {
        ...eventData,
        // Replace targets with normalized batch-scoped structure
        targets: normalizedTargets,
        updatedAt: new Date(),
      };
      
      // Log the normalization for debugging
      console.log(`BATCH_SCOPED_UPDATE_NORMALIZATION: ${JSON.stringify({
        eventId: id,
        originalPayload: { 
          targetBatches: eventData.targetBatches,
          targetSections: eventData.targetSections, 
          targetBatchSections: eventData.targetBatchSections 
        },
        normalizedTargets,
        requestId: reqId
      })}`);
      
      
      // For PATCH: do not recreate sheet; keep existing sheet by eventId as specified
      // If sheet missing, create it once (upsert by unique eventId)
      if (currentEvent) {
        try {
          const existingSheet = await tx.select().from(attendanceSheets).where(eq(attendanceSheets.eventId, id)).limit(1);
          if (existingSheet.length === 0 && ((currentEvent.targetBatchSections?.length || 0) > 0 || currentEvent.isMandatory)) {
            // Create missing attendance sheet - upsert by unique eventId
            await tx.insert(attendanceSheets).values({
              eventId: id,
              batch: 'Multiple', // For events with multiple batch-sections
              section: 'Multiple',
              createdBy: currentEvent.authorId,
            }).onConflictDoNothing(); // Upsert behavior
          }
        } catch (error) {
          console.warn(`[ATTENDANCE_SHEET_UPSERT] Non-critical error for event ${id}:`, error);
          // Continue with event update even if attendance sheet fails
        }
      }

      // Ensure mediaUrls is properly formatted for JSONB field
      if (updateData.mediaUrls !== undefined) {
        updateData.mediaUrls = Array.isArray(updateData.mediaUrls) ? updateData.mediaUrls : [];
      }

      // Perform the update
      const [event] = await tx.update(events)
        .set(updateData)
        .where(eq(events.id, id))
        .returning();

      // Log after update for verification
      console.log(`✅ [EVENT_PATCH_TARGETS] After update - RequestID: ${reqId}`, {
        eventId: id,
        newTargets: {
          targetBatches: event.targetBatches,
          targetSections: event.targetSections,
          targetBatchSections: event.targetBatchSections,
          rollNumberAttendees: event.rollNumberAttendees
        }
      });

      return event;
    });
  }

  // ROBUSTNESS: wrap in transaction and handle missing sheets as specified
  async deleteEvent(id: number): Promise<void> {
    await db.transaction(async (tx) => {
      try {
        // Get all attendance sheets for this event (missing sheet must not throw)
        const eventAttendanceSheets = await tx.select().from(attendanceSheets).where(eq(attendanceSheets.eventId, id));
        
        // Delete attendance records for each sheet (if any)
        for (const sheet of eventAttendanceSheets) {
          await tx.delete(attendanceRecords).where(eq(attendanceRecords.sheetId, sheet.id));
        }
        
        // Delete attendance sheets (if any)
        await tx.delete(attendanceSheets).where(eq(attendanceSheets.eventId, id));
      } catch (error) {
        console.warn(`[DELETE_EVENT] Non-critical attendance cleanup error for event ${id}:`, error);
        // Continue with event deletion even if attendance cleanup fails
      }
      
      // Delete related RSVPs
      await tx.delete(eventRsvps).where(eq(eventRsvps.eventId, id));
      
      // Finally delete the event
      await tx.delete(events).where(eq(events.id, id));
    });
  }

  async deleteEventWithCascade(id: number): Promise<{ sheetFound: boolean, rowsDeleted: number }> {
    return await db.transaction(async (tx) => {
      // Get all attendance sheets for this event
      const eventAttendanceSheets = await tx.select().from(attendanceSheets).where(eq(attendanceSheets.eventId, id));
      
      let totalRowsDeleted = 0;
      
      // Delete attendance records for each sheet
      for (const sheet of eventAttendanceSheets) {
        const recordsToDelete = await tx.select().from(attendanceRecords).where(eq(attendanceRecords.sheetId, sheet.id));
        totalRowsDeleted += recordsToDelete.length;
        await tx.delete(attendanceRecords).where(eq(attendanceRecords.sheetId, sheet.id));
      }
      
      // Delete attendance sheets
      await tx.delete(attendanceSheets).where(eq(attendanceSheets.eventId, id));
      
      // Delete related RSVPs
      await tx.delete(eventRsvps).where(eq(eventRsvps.eventId, id));
      
      // Finally delete the event
      await tx.delete(events).where(eq(events.id, id));
      
      return {
        sheetFound: eventAttendanceSheets.length > 0,
        rowsDeleted: totalRowsDeleted
      };
    });
  }

  async createEventAttendanceSheets(eventId: number, targetBatchSections: string[], createdBy: string): Promise<void> {
    if (!targetBatchSections || targetBatchSections.length === 0) {
      return; // No targeting, no sheets to create
    }

    for (const batchSection of targetBatchSections) {
      const [batch, section] = batchSection.split('::');
      if (batch && section) {
        try {
          // Try to insert, ignore if already exists (upsert behavior)
          await db.insert(attendanceSheets).values({
            eventId,
            batch,
            section,
            createdBy
          }).onConflictDoNothing();
        } catch (error) {
          console.log(`Attendance sheet already exists for event ${eventId}, batch ${batch}, section ${section}`);
        }
      }
    }
  }

  async getAttendanceSheetsByEventId(eventId: number): Promise<AttendanceSheet[]> {
    return await db.select().from(attendanceSheets).where(eq(attendanceSheets.eventId, eventId));
  }

  // ATTENDANCE SHEET UPSERT: Ensure every event has exactly one sheet
  async upsertAttendanceSheet(eventId: number, createdBy: string, requestId?: string): Promise<AttendanceSheet> {
    const reqId = requestId || `sheet_upsert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Check if sheet already exists
    const existingSheet = await this.getAttendanceSheetByEventId(eventId);
    
    if (existingSheet) {
      console.log(`📋 [SHEET_UPSERT] EXISTS for eventId ${eventId} - RequestID: ${reqId}`);
      return existingSheet;
    }
    
    // Create new sheet
    const newSheet = await this.createAttendanceSheet({
      eventId,
      batch: '', // Will be populated based on event targeting
      section: '', // Will be populated based on event targeting
      createdBy
    });
    
    console.log(`📋 [SHEET_UPSERT] CREATED for eventId ${eventId} - RequestID: ${reqId}`);
    return newSheet;
  }

  // REPAIR: Create missing attendance sheets for existing events
  async repairMissingAttendanceSheets(): Promise<{ repaired: number; eventIds: number[] }> {
    const allEvents = await this.getEvents();
    const repairedEventIds: number[] = [];
    
    for (const event of allEvents) {
      const existingSheet = await this.getAttendanceSheetByEventId(event.id);
      
      if (!existingSheet) {
        await this.upsertAttendanceSheet(event.id, event.authorId, 'repair_batch');
        repairedEventIds.push(event.id);
        console.log(`🔧 [REPAIRED_MISSING_SHEET] eventId: ${event.id}`);
      }
    }
    
    return {
      repaired: repairedEventIds.length,
      eventIds: repairedEventIds
    };
  }

  async rsvpToEvent(rsvp: InsertEventRsvp): Promise<EventRsvp> {
    const [created] = await db
      .insert(eventRsvps)
      .values(rsvp)
      .onConflictDoUpdate({
        target: [eventRsvps.eventId, eventRsvps.userId],
        set: { status: rsvp.status },
      })
      .returning();
    return created;
  }

  async getUserRsvps(userId: string): Promise<EventRsvp[]> {
    return await db
      .select()
      .from(eventRsvps)
      .where(eq(eventRsvps.userId, userId));
  }

  // Community Board (Section 1) - Reddit-like functionality
  async getCommunityPosts(): Promise<CommunityPostWithVotes[]> {
    const posts = await db
      .select()
      .from(communityPosts)
      .where(eq(communityPosts.isDeleted, false))
      .orderBy(desc(communityPosts.createdAt));

    // Add vote counts to each post
    const postsWithVotes = await Promise.all(
      posts.map(async (post) => {
        const upvotes = await db
          .select({ count: sql<number>`count(*)` })
          .from(communityVotes)
          .where(and(eq(communityVotes.postId, post.id), eq(communityVotes.voteType, 'upvote')));
        
        const downvotes = await db
          .select({ count: sql<number>`count(*)` })
          .from(communityVotes)
          .where(and(eq(communityVotes.postId, post.id), eq(communityVotes.voteType, 'downvote')));

        return {
          ...post,
          upvotes: Number(upvotes[0]?.count || 0),
          downvotes: Number(downvotes[0]?.count || 0),
        } as CommunityPostWithVotes;
      })
    );

    return postsWithVotes;
  }

  async createCommunityPost(post: InsertCommunityPost): Promise<CommunityPost> {
    const postData = {
      ...post,
      mediaUrls: post.mediaUrls ? (Array.isArray(post.mediaUrls) ? post.mediaUrls : []) : []
    };
    const [created] = await db
      .insert(communityPosts)
      .values(postData)
      .returning();
    return created;
  }

  async getCommunityPostById(id: number): Promise<CommunityPost | undefined> {
    const [post] = await db
      .select()
      .from(communityPosts)
      .where(and(eq(communityPosts.id, id), eq(communityPosts.isDeleted, false)));
    
    if (!post) return undefined;

    // Add vote counts
    const upvotes = await db
      .select({ count: sql<number>`count(*)` })
      .from(communityVotes)
      .where(and(eq(communityVotes.postId, post.id), eq(communityVotes.voteType, 'upvote')));
    
    const downvotes = await db
      .select({ count: sql<number>`count(*)` })
      .from(communityVotes)
      .where(and(eq(communityVotes.postId, post.id), eq(communityVotes.voteType, 'downvote')));

    return {
      ...post,
      upvotes: Number(upvotes[0]?.count || 0),
      downvotes: Number(downvotes[0]?.count || 0),
    } as CommunityPostWithVotes;
  }

  async deleteCommunityPost(id: number, userId: string): Promise<void> {
    await db
      .update(communityPosts)
      .set({ isDeleted: true })
      .where(eq(communityPosts.id, id));
  }

  async voteCommunityPost(vote: InsertCommunityVote): Promise<void> {
    // Check if user already voted on this post
    const [existingVote] = await db
      .select()
      .from(communityVotes)
      .where(
        and(
          eq(communityVotes.postId, vote.postId!),
          eq(communityVotes.userId, vote.userId)
        )
      );

    if (existingVote) {
      if (existingVote.voteType === vote.voteType) {
        // Remove vote if clicking same vote type
        await db
          .delete(communityVotes)
          .where(eq(communityVotes.id, existingVote.id));
      } else {
        // Update vote type
        await db
          .update(communityVotes)
          .set({ voteType: vote.voteType })
          .where(eq(communityVotes.id, existingVote.id));
      }
    } else {
      // Insert new vote
      await db
        .insert(communityVotes)
        .values([vote]);
    }

    // Update post score
    await this.updatePostScore(vote.postId!);
  }

  async voteCommunityReply(vote: InsertCommunityVote): Promise<void> {
    // Check if user already voted on this reply
    const [existingVote] = await db
      .select()
      .from(communityVotes)
      .where(
        and(
          eq(communityVotes.replyId, vote.replyId!),
          eq(communityVotes.userId, vote.userId)
        )
      );

    if (existingVote) {
      if (existingVote.voteType === vote.voteType) {
        // Remove vote if clicking same vote type
        await db
          .delete(communityVotes)
          .where(eq(communityVotes.id, existingVote.id));
      } else {
        // Update vote type
        await db
          .update(communityVotes)
          .set({ voteType: vote.voteType })
          .where(eq(communityVotes.id, existingVote.id));
      }
    } else {
      // Insert new vote
      await db
        .insert(communityVotes)
        .values([vote]);
    }

    // Update reply score
    await this.updateReplyScore(vote.replyId!);
  }

  async getCommunityReplies(postId: number): Promise<CommunityReplyWithVotes[]> {
    const replies = await db
      .select()
      .from(communityReplies)
      .where(and(eq(communityReplies.postId, postId), eq(communityReplies.isDeleted, false)))
      .orderBy(desc(communityReplies.createdAt));

    // Add vote counts to each reply
    const repliesWithVotes = await Promise.all(
      replies.map(async (reply) => {
        const upvotes = await db
          .select({ count: sql<number>`count(*)` })
          .from(communityVotes)
          .where(and(eq(communityVotes.replyId, reply.id), eq(communityVotes.voteType, 'upvote')));
        
        const downvotes = await db
          .select({ count: sql<number>`count(*)` })
          .from(communityVotes)
          .where(and(eq(communityVotes.replyId, reply.id), eq(communityVotes.voteType, 'downvote')));

        return {
          ...reply,
          upvotes: Number(upvotes[0]?.count || 0),
          downvotes: Number(downvotes[0]?.count || 0),
        } as CommunityReplyWithVotes;
      })
    );

    return repliesWithVotes;
  }

  async createCommunityReply(reply: InsertCommunityReply): Promise<CommunityReply> {
    const [created] = await db
      .insert(communityReplies)
      .values([reply])
      .returning();
    return created;
  }

  async getCommunityReplyById(id: number): Promise<CommunityReply | undefined> {
    const [reply] = await db
      .select()
      .from(communityReplies)
      .where(and(eq(communityReplies.id, id), eq(communityReplies.isDeleted, false)));
    
    if (!reply) return undefined;

    // Add vote counts
    const upvotes = await db
      .select({ count: sql<number>`count(*)` })
      .from(communityVotes)
      .where(and(eq(communityVotes.replyId, reply.id), eq(communityVotes.voteType, 'upvote')));
    
    const downvotes = await db
      .select({ count: sql<number>`count(*)` })
      .from(communityVotes)
      .where(and(eq(communityVotes.replyId, reply.id), eq(communityVotes.voteType, 'downvote')));

    return {
      ...reply,
      upvotes: Number(upvotes[0]?.count || 0),
      downvotes: Number(downvotes[0]?.count || 0),
    } as CommunityReplyWithVotes;
  }

  async deleteCommunityReply(id: number, userId: string): Promise<void> {
    await db
      .update(communityReplies)
      .set({ isDeleted: true })
      .where(eq(communityReplies.id, id));
  }

  // Community Announcements (Section 2) - Admin/Committee only
  async getCommunityAnnouncements(): Promise<CommunityAnnouncement[]> {
    return await db
      .select()
      .from(communityAnnouncements)
      .where(eq(communityAnnouncements.isDeleted, false))
      .orderBy(desc(communityAnnouncements.createdAt));
  }

  async createCommunityAnnouncement(announcement: InsertCommunityAnnouncement): Promise<CommunityAnnouncement> {
    const announcementData = {
      ...announcement,
      mediaUrls: announcement.mediaUrls ? (Array.isArray(announcement.mediaUrls) ? announcement.mediaUrls : []) : []
    };
    const [created] = await db
      .insert(communityAnnouncements)
      .values([announcementData])
      .returning();
    return created;
  }

  async deleteCommunityAnnouncement(id: number, userId: string): Promise<void> {
    await db
      .update(communityAnnouncements)
      .set({ isDeleted: true })
      .where(eq(communityAnnouncements.id, id));
  }

  // Helper methods for vote score calculation
  private async updatePostScore(postId: number): Promise<void> {
    const votes = await db
      .select()
      .from(communityVotes)
      .where(eq(communityVotes.postId, postId));
    
    const score = votes.reduce((acc, vote) => {
      return acc + (vote.voteType === 'upvote' ? 1 : -1);
    }, 0);

    await db
      .update(communityPosts)
      .set({ score })
      .where(eq(communityPosts.id, postId));
  }

  private async updateReplyScore(replyId: number): Promise<void> {
    const votes = await db
      .select()
      .from(communityVotes)
      .where(eq(communityVotes.replyId, replyId));
    
    const score = votes.reduce((acc, vote) => {
      return acc + (vote.voteType === 'upvote' ? 1 : -1);
    }, 0);

    await db
      .update(communityReplies)
      .set({ score })
      .where(eq(communityReplies.id, replyId));
  }

  // Weekly Menu Management - Excel Upload Implementation
  async getWeeklyMenuByDate(date: string): Promise<WeeklyMenu | undefined> {
    const [menu] = await db
      .select()
      .from(weeklyMenu)
      .where(eq(weeklyMenu.date, date));
    return menu;
  }

  async getWeeklyMenuRange(dates: string[]): Promise<WeeklyMenu[]> {
    if (dates.length === 0) return [];
    
    const menus = await db
      .select()
      .from(weeklyMenu)
      .where(inArray(weeklyMenu.date, dates));
    return menus;
  }

  async replaceAllMenu(menuData: InsertWeeklyMenu[], uploadedBy: string): Promise<WeeklyMenu[]> {
    // Delete all existing menu data
    await db.delete(weeklyMenu);
    
    // Insert new menu data with uploadedBy
    const dataWithUploader = menuData.map(item => ({
      ...item,
      uploadedBy,
    }));
    
    const created = await db
      .insert(weeklyMenu)
      .values(dataWithUploader)
      .returning();
    
    return created;
  }

  async updateWeeklyMenu(id: number, updates: { mealType?: string; items?: string }): Promise<WeeklyMenu | undefined> {
    const { mealType, items } = updates;
    
    if (mealType && items !== undefined) {
      // Update specific meal type
      const updateData: any = { updatedAt: new Date() };
      updateData[mealType] = items;
      
      const [updated] = await db
        .update(weeklyMenu)
        .set(updateData)
        .where(eq(weeklyMenu.id, id))
        .returning();
      
      return updated;
    }
    
    return undefined;
  }

  async bookSickFood(booking: InsertSickFoodBooking): Promise<SickFoodBooking> {
    const [created] = await db
      .insert(sickFoodBookings)
      .values(booking)
      .returning();
    return created;
  }

  async getSickFoodBookings(date?: Date, userId?: string): Promise<SickFoodBooking[]> {
    const conditions = [];
    
    if (date) {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);
      
      conditions.push(gte(sickFoodBookings.date, startDate));
      conditions.push(lte(sickFoodBookings.date, endDate));
    }
    
    if (userId) {
      conditions.push(eq(sickFoodBookings.userId, userId));
    }
    
    if (conditions.length > 0) {
      return await db.select().from(sickFoodBookings).where(and(...conditions)).orderBy(desc(sickFoodBookings.createdAt));
    }
    
    return await db.select().from(sickFoodBookings).orderBy(desc(sickFoodBookings.createdAt));
  }

  async applyForLeave(leave: InsertHostelLeave): Promise<HostelLeave> {
    // Generate approval token
    const approvalToken = crypto.randomUUID();
    const tokenExpiry = new Date();
    tokenExpiry.setDate(tokenExpiry.getDate() + 7); // 7 days validity

    const [created] = await db
      .insert(hostelLeave)
      .values({
        ...leave,
        approvalToken,
        tokenExpiry,
      })
      .returning();
    return created;
  }

  async getLeaveApplications(status?: string): Promise<HostelLeave[]> {
    if (status) {
      return await db.select().from(hostelLeave).where(eq(hostelLeave.status, status)).orderBy(desc(hostelLeave.createdAt));
    }
    
    return await db.select().from(hostelLeave).orderBy(desc(hostelLeave.createdAt));
  }

  async approveLeave(id: number, token: string): Promise<HostelLeave> {
    const [updated] = await db
      .update(hostelLeave)
      .set({ status: 'approved' })
      .where(and(
        eq(hostelLeave.id, id),
        eq(hostelLeave.approvalToken, token),
        gte(hostelLeave.tokenExpiry, new Date())
      ))
      .returning();
    return updated;
  }

  async denyLeave(id: number, token: string): Promise<HostelLeave> {
    const [updated] = await db
      .update(hostelLeave)
      .set({ status: 'rejected' })
      .where(and(
        eq(hostelLeave.id, id),
        eq(hostelLeave.approvalToken, token),
        gte(hostelLeave.tokenExpiry, new Date())
      ))
      .returning();
    return updated;
  }

  async updateLeaveStatus(id: number, status: string): Promise<HostelLeave> {
    const [updated] = await db
      .update(hostelLeave)
      .set({ status })
      .where(eq(hostelLeave.id, id))
      .returning();
    return updated;
  }

  async getLeaveById(id: number): Promise<HostelLeave | undefined> {
    const [leave] = await db.select().from(hostelLeave).where(eq(hostelLeave.id, id));
    return leave;
  }

  async updateLeaveGoogleStatus(id: number, googleStatus: any): Promise<HostelLeave> {
    const [updated] = await db
      .update(hostelLeave)
      .set({ googleStatus })
      .where(eq(hostelLeave.id, id))
      .returning();
    return updated;
  }

  async submitGrievance(grievance: InsertGrievance): Promise<Grievance> {
    const [created] = await db
      .insert(grievances)
      .values(grievance)
      .returning();
    return created;
  }

  async getGrievances(category?: string, userId?: string): Promise<Grievance[]> {
    const conditions = [];
    
    if (category) {
      conditions.push(eq(grievances.category, category));
    }
    
    if (userId) {
      conditions.push(eq(grievances.userId, userId));
    }
    
    if (conditions.length > 0) {
      return await db.select().from(grievances).where(and(...conditions)).orderBy(desc(grievances.createdAt));
    }
    
    return await db.select().from(grievances).orderBy(desc(grievances.createdAt));
  }

  async resolveGrievance(id: number, adminNotes?: string): Promise<Grievance> {
    const [updated] = await db
      .update(grievances)
      .set({ 
        status: 'resolved',
        resolvedAt: new Date(),
        adminNotes 
      })
      .where(eq(grievances.id, id))
      .returning();
    return updated;
  }

  // Amenities permissions
  async getAmenitiesPermissions(userId: string): Promise<AmenitiesPermissions | undefined> {
    const [permissions] = await db
      .select()
      .from(amenitiesPermissions)
      .where(eq(amenitiesPermissions.userId, userId));
    return permissions;
  }

  async setAmenitiesPermissions(permissions: InsertAmenitiesPermissions): Promise<AmenitiesPermissions> {
    const [created] = await db
      .insert(amenitiesPermissions)
      .values(permissions)
      .onConflictDoUpdate({
        target: amenitiesPermissions.userId,
        set: {
          menuUpload: permissions.menuUpload,
          sickFoodAccess: permissions.sickFoodAccess,
          leaveApplicationAccess: permissions.leaveApplicationAccess,
          grievanceAccess: permissions.grievanceAccess,
          adminAccess: permissions.adminAccess,
        },
      })
      .returning();
    return created;
  }

  // Attendance
  async saveAttendance(eventId: number, attendees: string[], markedBy: string): Promise<void> {
    await db
      .insert(attendance)
      .values({
        eventId,
        attendees,
        markedBy,
      });
  }

  // Directory
  async getAllUsers(): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .orderBy(users.firstName);
  }

  async searchUsers(query: string): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .where(
        // Note: This is a simple search, in production you might want to use full-text search
        eq(users.email, query)
      )
      .orderBy(users.firstName);
  }

  // Admin functions
  async getAllUsersForAdmin(): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .orderBy(users.email);
  }

  async updateUserRoleAndPermissions(userId: string, role: string, permissions: any): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ 
        role, 
        permissions,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async deleteUser(userId: string): Promise<boolean> {
    const result = await db
      .delete(users)
      .where(eq(users.id, userId))
      .returning();
    return result.length > 0;
  }

  // Student Directory operations
  async getStudentDirectory(): Promise<StudentDirectory[]> {
    return await db.select().from(studentDirectory).orderBy(desc(studentDirectory.createdAt));
  }

  async getStudentDirectoryBatches(): Promise<string[]> {
    const batches = await db.select({
      batch: studentDirectory.batch
    })
    .from(studentDirectory)
    .where(sql`${studentDirectory.batch} IS NOT NULL AND ${studentDirectory.batch} != ''`)
    .groupBy(studentDirectory.batch)
    .orderBy(studentDirectory.batch);

    return batches.map(b => b.batch).filter(Boolean);
  }

  async getStudentDirectoryList(params: {
    batch?: string;
    query?: string;
    section?: string;
    program?: string;
    page: number;
    limit: number;
    offset: number;
  }): Promise<{
    data: Array<{
      id: number;
      fullName: string;
      email: string;
      rollNumber: string | null;
      batch: string | null;
      section: string | null;
    }>;
    total: number;
    page: number;
    limit: number;
  }> {
    const { batch, query, section, program, page, limit, offset } = params;

    // Build the base query
    let baseQuery = db.select({
      id: studentDirectory.id,
      fullName: sql<string>`${studentDirectory.email}`.as('fullName'), // Use email as name for now
      email: studentDirectory.email,
      rollNumber: studentDirectory.rollNumber,
      batch: studentDirectory.batch,
      section: studentDirectory.section,
    }).from(studentDirectory);

    // Apply filters
    const conditions = [];

    if (batch && batch !== 'All') {
      conditions.push(eq(studentDirectory.batch, batch));
    }

    if (query) {
      const searchQuery = `%${query.toLowerCase()}%`;
      conditions.push(
        or(
          sql`LOWER(${studentDirectory.email}) LIKE ${searchQuery}`,
          sql`LOWER(${studentDirectory.rollNumber}) LIKE ${searchQuery}`
        )
      );
    }

    if (section) {
      conditions.push(eq(studentDirectory.section, section));
    }

    // Apply conditions if any
    if (conditions.length > 0) {
      baseQuery = baseQuery.where(and(...conditions)) as any;
    }

    // Get total count
    let countQuery = db.select({ count: sql<number>`count(*)` }).from(studentDirectory);
    if (conditions.length > 0) {
      countQuery = countQuery.where(and(...conditions)) as any;
    }
    
    const [{ count: total }] = await countQuery;

    // Get paginated data
    const data = await baseQuery
      .orderBy(studentDirectory.rollNumber, studentDirectory.batch, studentDirectory.section)
      .limit(limit)
      .offset(offset);

    return {
      data: data.map(row => ({
        id: row.id,
        fullName: row.fullName || row.email,
        email: row.email,
        rollNumber: row.rollNumber,
        batch: row.batch,
        section: row.section,
      })),
      total,
      page,
      limit
    };
  }

  async getStudentByEmail(email: string): Promise<StudentDirectory | undefined> {
    const [student] = await db.select().from(studentDirectory).where(eq(studentDirectory.email, email));
    return student;
  }

  async getStudentByRollNumber(rollNumber: string): Promise<StudentDirectory | undefined> {
    const [student] = await db.select().from(studentDirectory).where(eq(studentDirectory.rollNumber, rollNumber));
    return student;
  }

  async getStudentDirectoryById(id: number): Promise<StudentDirectory | undefined> {
    const [student] = await db.select().from(studentDirectory).where(eq(studentDirectory.id, id));
    return student;
  }

  async getStudentDirectoryByEmail(email: string): Promise<StudentDirectory | undefined> {
    const [student] = await db.select().from(studentDirectory).where(eq(studentDirectory.email, email));
    return student;
  }

  async checkRollNumberConflicts(students: InsertStudentDirectory[]): Promise<{conflicts: {rollNumber: string, existingEmail: string, newEmail: string}[], validStudents: InsertStudentDirectory[]}> {
    const conflicts: {rollNumber: string, existingEmail: string, newEmail: string}[] = [];
    const validStudents: InsertStudentDirectory[] = [];
    
    for (const student of students) {
      if (!student.rollNumber) {
        // If no roll number, always valid
        validStudents.push(student);
        continue;
      }
      
      // Check if roll number already exists
      const existingStudent = await this.getStudentByRollNumber(student.rollNumber);
      
      if (existingStudent && existingStudent.email !== student.email) {
        // Roll number exists for different email - conflict
        conflicts.push({
          rollNumber: student.rollNumber,
          existingEmail: existingStudent.email,
          newEmail: student.email
        });
      } else {
        // No conflict - either new roll number or same email
        validStudents.push(student);
      }
    }
    
    return { conflicts, validStudents };
  }

  async upsertStudentDirectory(student: InsertStudentDirectory): Promise<StudentDirectory> {
    const [result] = await db
      .insert(studentDirectory)
      .values(student)
      .onConflictDoUpdate({
        target: [studentDirectory.email],
        set: {
          batch: student.batch,
          section: student.section,
          uploadedBy: student.uploadedBy,
          updatedAt: sql`now()`,
        },
      })
      .returning();
    return result;
  }

  async batchUpsertStudents(students: InsertStudentDirectory[]): Promise<StudentDirectory[]> {
    if (students.length === 0) return [];
    
    const results: StudentDirectory[] = [];
    
    // Process in batches to avoid SQL statement size limits
    const batchSize = 100;
    for (let i = 0; i < students.length; i += batchSize) {
      const batch = students.slice(i, i + batchSize);
      
      const batchResults = await db
        .insert(studentDirectory)
        .values(batch)
        .onConflictDoUpdate({
          target: [studentDirectory.email],
          set: {
            batch: sql`excluded.batch`,
            section: sql`excluded.section`,
            rollNumber: sql`excluded.roll_number`,
            uploadedBy: sql`excluded.uploaded_by`,
            updatedAt: sql`now()`,
          },
        })
        .returning();
      
      results.push(...batchResults);
    }
    
    return results;
  }

  async createUploadLog(log: InsertStudentUploadLog): Promise<StudentUploadLog> {
    const [result] = await db.insert(studentUploadLogs).values(log).returning();
    return result;
  }

  async getUploadLogs(): Promise<StudentUploadLog[]> {
    return await db.select().from(studentUploadLogs).orderBy(desc(studentUploadLogs.uploadTimestamp));
  }

  // Batch-Section management
  async upsertBatchSections(batchSectionData: InsertBatchSection[]): Promise<BatchSection[]> {
    if (batchSectionData.length === 0) return [];
    
    const results: BatchSection[] = [];
    
    for (const data of batchSectionData) {
      const [result] = await db
        .insert(batchSections)
        .values(data)
        .onConflictDoNothing()
        .returning();
      
      if (result) {
        results.push(result);
      }
    }
    
    return results;
  }

  async getSectionsForBatches(batches: string[]): Promise<{ batch: string; section: string }[]> {
    if (batches.length === 0) return [];
    
    return await db
      .select({ batch: batchSections.batch, section: batchSections.section })
      .from(batchSections)
      .where(inArray(batchSections.batch, batches))
      .orderBy(batchSections.batch, batchSections.section);
  }

  async getAllBatches(): Promise<string[]> {
    const results = await db
      .selectDistinct({ batch: batchSections.batch })
      .from(batchSections)
      .orderBy(batchSections.batch);
    
    return results.map(r => r.batch);
  }

  async getAllSections(): Promise<string[]> {
    const results = await db
      .selectDistinct({ section: studentDirectory.section })
      .from(studentDirectory)
      .where(and(
        isNotNull(studentDirectory.section),
        ne(studentDirectory.section, '')
      ));
    
    // Extract section names from "batch::section" format
    const sections = results
      .map(r => {
        if (r.section?.includes('::')) {
          return r.section.split('::')[1];
        }
        return r.section;
      })
      .filter((section, index, array) => section && array.indexOf(section) === index) // Remove duplicates and nulls
      .sort();
    
    return sections;
  }

  async getSectionsForBatch(batch: string): Promise<string[]> {
    const results = await db
      .selectDistinct({ section: studentDirectory.section })
      .from(studentDirectory)
      .where(and(
        isNotNull(studentDirectory.section),
        ne(studentDirectory.section, ''),
        or(
          eq(studentDirectory.batch, batch), // Direct match
          sql`${studentDirectory.section} LIKE ${batch + '::%'}` // Handle "batch::section" format
        )
      ));
    
    // Extract section names from "batch::section" format or use direct section
    const sections = results
      .map(r => {
        if (r.section?.includes('::')) {
          const [batchPart, sectionPart] = r.section.split('::');
          return batchPart === batch ? sectionPart : null;
        }
        return r.section;
      })
      .filter((section): section is string => section !== null)
      .filter((section, index, array) => array.indexOf(section) === index) // Remove duplicates
      .sort();
    
    return sections;
  }

  // Triathlon methods
  async getTriathlonTeams(): Promise<(TriathlonTeam & { rank: number })[]> {
    const teams = await db
      .select()
      .from(triathlonTeams)
      .orderBy(desc(triathlonTeams.totalPoints), triathlonTeams.name);
    
    // Add rank to each team
    return teams.map((team, index) => ({
      ...team,
      rank: index + 1
    }));
  }

  async createTriathlonTeam(team: InsertTriathlonTeam): Promise<TriathlonTeam> {
    const [created] = await db
      .insert(triathlonTeams)
      .values(team)
      .returning();
    return created;
  }

  async updateTriathlonTeam(teamId: number, updates: Partial<Pick<InsertTriathlonTeam, 'name' | 'logoUrl'>>): Promise<TriathlonTeam> {
    const [updated] = await db
      .update(triathlonTeams)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(triathlonTeams.id, teamId))
      .returning();
    
    if (!updated) {
      throw new Error('Team not found');
    }
    
    return updated;
  }

  async deleteTriathlonTeam(teamId: number): Promise<void> {
    await db
      .delete(triathlonTeams)
      .where(eq(triathlonTeams.id, teamId));
  }

  async updateTriathlonPoints(
    teamId: number, 
    category: 'academic' | 'cultural' | 'sports' | 'surprise', 
    pointChange: number,
    reason: string | undefined,
    changedBy: string
  ): Promise<TriathlonTeam> {
    // Get current team data
    const [team] = await db
      .select()
      .from(triathlonTeams)
      .where(eq(triathlonTeams.id, teamId));
    
    if (!team) {
      throw new Error('Team not found');
    }

    // Calculate new points
    const currentPoints = team[`${category}Points` as keyof TriathlonTeam] as number;
    const newPoints = Math.max(0, currentPoints + pointChange);
    const newTotal = team.academicPoints + team.culturalPoints + team.sportsPoints + team.surprisePoints 
      - currentPoints + newPoints;

    // Update team points
    const [updatedTeam] = await db
      .update(triathlonTeams)
      .set({
        [`${category}Points`]: newPoints,
        totalPoints: newTotal,
        updatedAt: new Date()
      })
      .where(eq(triathlonTeams.id, teamId))
      .returning();

    // Record point history
    await db
      .insert(triathlonPointHistory)
      .values({
        teamId,
        category,
        pointChange,
        previousPoints: currentPoints,
        newPoints,
        reason: reason || null,
        changedBy
      });

    return updatedTeam;
  }

  async getTriathlonPointHistory(teamId: number): Promise<TriathlonPointHistory[]> {
    return await db
      .select()
      .from(triathlonPointHistory)
      .where(eq(triathlonPointHistory.teamId, teamId))
      .orderBy(desc(triathlonPointHistory.createdAt));
  }

  // Push Subscriptions Implementation
  async savePushSubscription(subscription: InsertPushSubscription): Promise<PushSubscription> {
    // Upsert subscription by endpoint
    const [result] = await db
      .insert(pushSubscriptions)
      .values({
        ...subscription,
        lastSeenAt: new Date(),
      })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
          userEmail: subscription.userEmail,
          ua: subscription.ua,
          lastSeenAt: new Date(),
        }
      })
      .returning();
    return result;
  }

  async deletePushSubscription(endpoint: string): Promise<void> {
    await db
      .delete(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, endpoint));
  }

  async renewPushSubscription(endpoint: string): Promise<void> {
    await db
      .update(pushSubscriptions)
      .set({ lastSeenAt: new Date() })
      .where(eq(pushSubscriptions.endpoint, endpoint));
  }

  async getAllActiveSubscriptions(): Promise<PushSubscription[]> {
    return await db
      .select()
      .from(pushSubscriptions)
      .orderBy(desc(pushSubscriptions.lastSeenAt));
  }

  async getSubscriptionsForUser(userEmail: string): Promise<PushSubscription[]> {
    return await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userEmail, userEmail))
      .orderBy(desc(pushSubscriptions.lastSeenAt));
  }

  // Smart Notifications Implementation
  async createSmartNotification(notification: InsertSmartNotification): Promise<SmartNotification> {
    const [created] = await db
      .insert(smartNotifications)
      .values([{
        ...notification,
        contextualData: notification.contextualData || {},
        deliveryChannels: (notification.deliveryChannels as string[]) || [],
        metadata: notification.metadata || {}
      }])
      .returning();
    return created;
  }

  async getNotificationsForUser(userId: string, limit: number = 20, offset: number = 0): Promise<SmartNotification[]> {
    return await db
      .select()
      .from(smartNotifications)
      .where(eq(smartNotifications.recipientUserId, userId))
      .orderBy(desc(smartNotifications.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getUnreadNotificationsForUser(userId: string): Promise<SmartNotification[]> {
    return await db
      .select()
      .from(smartNotifications)
      .where(
        and(
          eq(smartNotifications.recipientUserId, userId),
          eq(smartNotifications.status, 'sent'),
          sql`${smartNotifications.readAt} IS NULL`
        )
      )
      .orderBy(desc(smartNotifications.createdAt));
  }

  async markNotificationAsRead(notificationId: number, userId: string): Promise<void> {
    await db
      .update(smartNotifications)
      .set({ 
        status: 'read',
        readAt: new Date(),
        updatedAt: new Date()
      })
      .where(
        and(
          eq(smartNotifications.id, notificationId),
          eq(smartNotifications.recipientUserId, userId)
        )
      );
  }

  async markNotificationAsDismissed(notificationId: number, userId: string): Promise<void> {
    await db
      .update(smartNotifications)
      .set({ 
        status: 'dismissed',
        dismissedAt: new Date(),
        updatedAt: new Date()
      })
      .where(
        and(
          eq(smartNotifications.id, notificationId),
          eq(smartNotifications.recipientUserId, userId)
        )
      );
  }

  async updateNotificationStatus(notificationId: number, status: string, metadata?: any): Promise<void> {
    const updateData: any = { 
      status,
      updatedAt: new Date()
    };

    if (status === 'sent') {
      updateData.sentAt = new Date();
    }

    if (metadata) {
      updateData.metadata = metadata;
    }

    await db
      .update(smartNotifications)
      .set(updateData)
      .where(eq(smartNotifications.id, notificationId));
  }

  async getPendingNotifications(limit: number = 50): Promise<SmartNotification[]> {
    return await db
      .select()
      .from(smartNotifications)
      .where(
        and(
          eq(smartNotifications.status, 'pending'),
          or(
            sql`${smartNotifications.scheduledFor} IS NULL`,
            lte(smartNotifications.scheduledFor, new Date())
          )
        )
      )
      .orderBy(smartNotifications.priority, desc(smartNotifications.createdAt))
      .limit(limit);
  }

  // Notification Preferences Implementation
  async getNotificationPreferences(userId: string): Promise<NotificationPreferences | undefined> {
    const [prefs] = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId));
    return prefs;
  }

  async setNotificationPreferences(preferences: InsertNotificationPreferences): Promise<NotificationPreferences> {
    const [created] = await db
      .insert(notificationPreferences)
      .values([{
        ...preferences,
        globalSettings: preferences.globalSettings || {
          enabled: true,
          quietHours: { start: "22:00", end: "08:00" },
          maxDailyNotifications: 20,
          batchDelay: 15
        },
        categoryPreferences: preferences.categoryPreferences || {
          announcement: { enabled: true, priority: "high", channels: ["push", "in_app"] },
          event: { enabled: true, priority: "high", channels: ["push", "in_app"] },
          calendar: { enabled: true, priority: "medium", channels: ["push", "in_app"] },
          forum: { enabled: true, priority: "low", channels: ["in_app"] },
          amenities: { enabled: true, priority: "medium", channels: ["push", "in_app"] },
          system: { enabled: true, priority: "critical", channels: ["push", "in_app", "email"] }
        },
        contextualRules: preferences.contextualRules || {
          academicHours: true,
          locationBased: false,
          roleSpecific: true,
          eventProximity: true,
          engagementBased: true
        }
      }])
      .onConflictDoUpdate({
        target: notificationPreferences.userId,
        set: {
          globalSettings: preferences.globalSettings,
          categoryPreferences: preferences.categoryPreferences,
          contextualRules: preferences.contextualRules,
          updatedAt: new Date(),
        },
      })
      .returning();
    return created;
  }

  // Notification Analytics Implementation
  async trackNotificationEvent(analytics: InsertNotificationAnalytics): Promise<NotificationAnalytics> {
    const [created] = await db
      .insert(notificationAnalytics)
      .values([{
        ...analytics,
        metadata: analytics.metadata || {}
      }])
      .returning();
    return created;
  }

  async getNotificationAnalytics(notificationId: number): Promise<NotificationAnalytics[]> {
    return await db
      .select()
      .from(notificationAnalytics)
      .where(eq(notificationAnalytics.notificationId, notificationId))
      .orderBy(notificationAnalytics.timestamp);
  }

  async getUserEngagementStats(userId: string, days: number = 30): Promise<any> {
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    return await db
      .select({
        event: notificationAnalytics.event,
        count: sql<number>`count(*)::int`,
      })
      .from(notificationAnalytics)
      .where(
        and(
          eq(notificationAnalytics.userId, userId),
          gte(notificationAnalytics.timestamp, fromDate)
        )
      )
      .groupBy(notificationAnalytics.event);
  }

  // Notification Batches Implementation
  async createNotificationBatch(batch: InsertNotificationBatch): Promise<NotificationBatch> {
    const [created] = await db
      .insert(notificationBatches)
      .values([batch])
      .returning();
    return created;
  }

  async getNotificationBatch(batchId: number): Promise<NotificationBatch | undefined> {
    const [batch] = await db
      .select()
      .from(notificationBatches)
      .where(eq(notificationBatches.id, batchId));
    return batch;
  }

  async updateNotificationBatch(batchId: number, updates: Partial<NotificationBatch>): Promise<void> {
    await db
      .update(notificationBatches)
      .set(updates)
      .where(eq(notificationBatches.id, batchId));
  }

  // Attendance Sheets Management Implementation
  async createAttendanceSheet(sheet: InsertAttendanceSheet): Promise<AttendanceSheet> {
    const [created] = await db
      .insert(attendanceSheets)
      .values([sheet])
      .returning();
    return created;
  }

  async getAttendanceSheetByEventId(eventId: number): Promise<AttendanceSheet | undefined> {
    const [sheet] = await db
      .select()
      .from(attendanceSheets)
      .where(eq(attendanceSheets.eventId, eventId));
    return sheet;
  }

  async getAttendanceSheetById(sheetId: number): Promise<AttendanceSheet | undefined> {
    const [sheet] = await db
      .select()
      .from(attendanceSheets)
      .where(eq(attendanceSheets.id, sheetId));
    return sheet;
  }

  async deleteAttendanceSheetsForEvent(eventId: number): Promise<void> {
    // First, delete all attendance records for sheets belonging to this event
    const sheets = await db
      .select({ id: attendanceSheets.id })
      .from(attendanceSheets)
      .where(eq(attendanceSheets.eventId, eventId));
    
    if (sheets.length > 0) {
      const sheetIds = sheets.map(sheet => sheet.id);
      await db
        .delete(attendanceRecords)
        .where(inArray(attendanceRecords.sheetId, sheetIds));
    }
    
    // Then delete the attendance sheets
    await db
      .delete(attendanceSheets)
      .where(eq(attendanceSheets.eventId, eventId));
  }

  async getAttendanceRecordsBySheetId(sheetId: number): Promise<AttendanceRecord[]> {
    return await db
      .select()
      .from(attendanceRecords)
      .where(and(eq(attendanceRecords.sheetId, sheetId), eq(attendanceRecords.isArchived, false)))
      .orderBy(attendanceRecords.rollNumber, attendanceRecords.studentName);
  }

  async createAttendanceRecords(records: InsertAttendanceRecord[]): Promise<AttendanceRecord[]> {
    if (records.length === 0) return [];
    
    const created = await db
      .insert(attendanceRecords)
      .values(records)
      .onConflictDoNothing() // Prevent duplicates
      .returning();
    return created;
  }

  async updateAttendanceRecord(recordId: number, status: string, note?: string, markedBy?: string): Promise<AttendanceRecord> {
    const updateData: any = {
      status,
      updatedAt: new Date(),
    };
    
    if (note !== undefined) updateData.note = note;
    if (markedBy) {
      updateData.markedBy = markedBy;
      updateData.markedAt = new Date();
    }

    const [updated] = await db
      .update(attendanceRecords)
      .set(updateData)
      .where(eq(attendanceRecords.id, recordId))
      .returning();
    return updated;
  }

  async bulkUpdateAttendanceRecords(sheetId: number, status: string, markedBy: string): Promise<void> {
    await db
      .update(attendanceRecords)
      .set({
        status,
        markedBy,
        markedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(attendanceRecords.sheetId, sheetId), eq(attendanceRecords.isArchived, false)));
  }

  async syncStudentsToAttendanceSheet(sheetId: number, batch: string, section: string): Promise<AttendanceRecord[]> {
    // Get all students in the specified batch and section
    const students = await db
      .select()
      .from(studentDirectory)
      .where(and(eq(studentDirectory.batch, batch), eq(studentDirectory.section, section)));

    // Get existing records for this sheet
    const existingRecords = await db
      .select()
      .from(attendanceRecords)
      .where(eq(attendanceRecords.sheetId, sheetId));

    const existingEmails = new Set(existingRecords.map(r => r.studentEmail));
    
    // Find students to add (new students not in attendance sheet)
    const newStudents = students.filter(s => !existingEmails.has(s.email));
    
    // Create records for new students
    if (newStudents.length > 0) {
      const newRecords = newStudents.map(student => ({
        sheetId,
        studentEmail: student.email,
        studentName: student.email.split('@')[0] || '', // Use email prefix as name
        rollNumber: student.rollNumber || null,
        status: 'UNMARKED' as const,
      }));

      await this.createAttendanceRecords(newRecords);
    }

    // Archive records for students no longer in section (don't delete)
    const currentStudentEmails = new Set(students.map(s => s.email));
    const recordsToArchive = existingRecords.filter(r => !currentStudentEmails.has(r.studentEmail) && !r.isArchived);
    
    if (recordsToArchive.length > 0) {
      await db
        .update(attendanceRecords)
        .set({ isArchived: true, updatedAt: new Date() })
        .where(inArray(attendanceRecords.id, recordsToArchive.map(r => r.id)));
    }

    // Return updated attendance records
    return await this.getAttendanceRecordsBySheetId(sheetId);
  }

  // ======== CANONICAL EVENT MANAGEMENT METHODS ========
  
  /**
   * Update event with canonical fields (startsAt, endsAt, targets)
   */
  async updateEventCanonical(eventId: number, updates: {
    startsAt?: Date;
    endsAt?: Date | null;
    targets?: { batches: string[]; sections: string[]; programs: string[] };
  }): Promise<Event> {
    const [updated] = await db
      .update(events)
      .set(updates)
      .where(eq(events.id, eventId))
      .returning();
    
    if (!updated) {
      throw new Error(`Event ${eventId} not found for canonical update`);
    }
    
    return updated;
  }

  // ======== ATTENDANCE CONTAINER METHODS ========
  
  /**
   * Get attendance container for an event
   */
  async getAttendanceContainer(eventId: number): Promise<AttendanceContainer | undefined> {
    const [container] = await db
      .select()
      .from(attendanceContainers)
      .where(eq(attendanceContainers.eventId, eventId));
    return container;
  }
  
  /**
   * Create attendance container for an event
   */
  async createAttendanceContainer(data: NewAttendanceContainer): Promise<AttendanceContainer> {
    const [container] = await db
      .insert(attendanceContainers)
      .values(data)
      .returning();
    
    if (!container) {
      throw new Error('Failed to create attendance container');
    }
    
    return container;
  }
  
  /**
   * Update attendance container statistics
   */
  async updateAttendanceContainerStats(eventId: number): Promise<AttendanceContainer> {
    // Get all attendance records for this event
    const sheets = await this.getAttendanceSheetsByEventId(eventId);
    
    if (sheets.length === 0) {
      // No sheets, set all counts to 0
      const [updated] = await db
        .update(attendanceContainers)
        .set({
          totalStudents: 0,
          presentCount: 0,
          absentCount: 0,
          lateCount: 0,
          unmarkedCount: 0,
          excusedCount: 0,
          updatedAt: new Date()
        })
        .where(eq(attendanceContainers.eventId, eventId))
        .returning();
      
      return updated!;
    }
    
    // Calculate statistics from all sheets
    let totalStudents = 0;
    let presentCount = 0;
    let absentCount = 0;
    let lateCount = 0;
    let unmarkedCount = 0;
    let excusedCount = 0;
    
    for (const sheet of sheets) {
      const records = await this.getAttendanceRecordsBySheetId(sheet.id);
      
      totalStudents += records.length;
      
      for (const record of records) {
        switch (record.status) {
          case 'PRESENT':
            presentCount++;
            break;
          case 'ABSENT':
            absentCount++;
            break;
          case 'LATE':
            lateCount++;
            break;
          case 'EXCUSED':
            excusedCount++;
            break;
          default:
            unmarkedCount++;
        }
      }
    }
    
    // Update container with calculated stats
    const [updated] = await db
      .update(attendanceContainers)
      .set({
        totalStudents,
        presentCount,
        absentCount,
        lateCount,
        unmarkedCount,
        excusedCount,
        updatedAt: new Date()
      })
      .where(eq(attendanceContainers.eventId, eventId))
      .returning();
    
    return updated!;
  }
}

export const storage = new DatabaseStorage();
