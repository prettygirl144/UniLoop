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
  galleryFolders,
  amenitiesPermissions,
  studentDirectory,
  studentUploadLogs,
  triathlonTeams,
  triathlonPointHistory,
  triathlonState,
  triathlonPastWinners,
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
  type TriathlonPastWinner,
  type AttendanceSheet,
  type InsertAttendanceSheet,
  type AttendanceRecord,
  type InsertAttendanceRecord,
  batchSections,
  archivedBatches,
  type BatchSection,
  type InsertBatchSection,
  type CommunityPostWithVotes,
  type CommunityReplyWithVotes,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, lte, or, sql, inArray, notInArray } from "drizzle-orm";
import crypto from "crypto";

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
  createEvent(event: InsertEvent): Promise<Event>;
  getEventById(id: number): Promise<Event | undefined>;
  rsvpToEvent(rsvp: InsertEventRsvp): Promise<EventRsvp>;
  getUserRsvps(userId: string): Promise<EventRsvp[]>;

  // Community Board (Section 1)
  getCommunityPosts(userId?: string): Promise<CommunityPostWithVotes[]>;
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
  upsertMenuEntry(date: string, mealType: string, items: string, uploadedBy: string): Promise<WeeklyMenu>;
  bookSickFood(booking: InsertSickFoodBooking): Promise<SickFoodBooking>;
  getSickFoodBookings(date?: Date): Promise<SickFoodBooking[]>;
  getSickFoodBookingsWithUserData(startDate?: Date, endDate?: Date, userId?: string): Promise<Array<SickFoodBooking & { user: { firstName: string | null; lastName: string | null; rollNumber: string | null; email: string | null } }>>;
  updateSickFoodBookingStatus(id: number, status: 'pending' | 'approved' | 'rejected', approvedBy: string, adminNotes?: string): Promise<SickFoodBooking | undefined>;
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
  getAttendanceSheetsByEventId(eventId: number): Promise<AttendanceSheet[]>;
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
      .orderBy(events.date);
  }

  async getEventsFiltered(options: {
    status?: 'current' | 'past' | 'all';
    search?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<{ events: Event[], total: number, hasMore: boolean }> {
    const { status = 'current', search, page = 1, limit = 20 } = options;
    
    // Get current date and time for filtering
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    // Build query conditions
    let whereConditions = [];
    
    // Status-based filtering
    if (status === 'current') {
      // Current: event date > today OR (event date is today AND endTime >= now)
      whereConditions.push(sql`(DATE(${events.date}) > CURRENT_DATE OR 
                           (DATE(${events.date}) = CURRENT_DATE AND ${events.endTime} >= ${currentTime}))`);
    } else if (status === 'past') {
      // Past: event date < today OR (event date is today AND endTime < now)
      whereConditions.push(sql`(DATE(${events.date}) < CURRENT_DATE OR 
                           (DATE(${events.date}) = CURRENT_DATE AND ${events.endTime} < ${currentTime}))`);
    }
    
    // Search filtering
    if (search && search.trim() !== '') {
      const searchTerm = `%${search.trim()}%`;
      whereConditions.push(sql`(
        LOWER(${events.title}) LIKE LOWER(${searchTerm}) OR
        LOWER(${events.description}) LIKE LOWER(${searchTerm}) OR
        LOWER(${events.location}) LIKE LOWER(${searchTerm}) OR
        LOWER(${events.hostCommittee}) LIKE LOWER(${searchTerm}) OR
        LOWER(${events.category}) LIKE LOWER(${searchTerm})
      )`);
    }
    
    // Combine all conditions
    const whereCondition = whereConditions.length > 0 
      ? whereConditions.reduce((acc, condition) => sql`${acc} AND ${condition}`)
      : sql`1=1`;
    
    // Get total count for pagination
    const [{ count: total }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(events)
      .where(whereCondition);
    
    // Build main query with pagination and ordering
    const offset = (page - 1) * limit;
    let orderBy;
    
    if (status === 'current') {
      // Sort current events ascending by date (upcoming first)
      orderBy = [events.date, events.startTime];
    } else {
      // Sort past and all events descending by date (recent first)
      orderBy = [desc(events.date), desc(events.startTime)];
    }
    
    const eventsResult = await db
      .select()
      .from(events)
      .where(whereCondition)
      .orderBy(...orderBy)
      .limit(limit)
      .offset(offset);
    
    const hasMore = offset + eventsResult.length < total;
    
    return {
      events: eventsResult,
      total,
      hasMore
    };
  }

  async createEvent(event: InsertEvent): Promise<Event> {
    const requestId = `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log(`🔧 [DB-WRITE] Creating event - RequestID: ${requestId}`);
    console.log(`📝 [DB-WRITE] Event payload:`, JSON.stringify({ title: event.title, date: event.date, location: event.location, authorId: event.authorId }, null, 2));
    
    // Convert mediaUrls properly for JSONB field
    const eventData: any = {
      ...event,
    };
    // Handle mediaUrls as JSONB array
    if (event.mediaUrls) {
      eventData.mediaUrls = Array.isArray(event.mediaUrls) ? event.mediaUrls : [];
    } else {
      eventData.mediaUrls = [];
    }
    
    const [created] = await db
      .insert(events)
      .values([eventData])
      .returning();
    
    console.log(`✅ [DB-WRITE] Event created successfully - ID: ${created.id}, RequestID: ${requestId}`);
    console.log(`📊 [DB-WRITE] Created event details:`, { id: created.id, title: created.title, date: created.date });

    // Auto-create attendance sheet if event has batch-section targeting
    await this.createAttendanceSheetsForEvent(created);
    
    return created;
  }

  async createAttendanceSheetsForEvent(event: Event): Promise<void> {
    // Create attendance sheets if event has batch-section targeting OR roll number attendees
    const hasTargetBatchSections = event?.targetBatchSections && event.targetBatchSections.length > 0;
    const hasRollNumberAttendees = event?.rollNumberAttendees && Array.isArray(event.rollNumberAttendees) && event.rollNumberAttendees.length > 0;
    
    if (event && (hasTargetBatchSections || hasRollNumberAttendees)) {
      console.log(`🎯 [ATTENDANCE] === ROBUST ATTENDANCE SHEET CREATION START ===`);
      console.log(`🎯 [ATTENDANCE] Event ID: ${event.id}, Title: "${event.title}"`);
      console.log(`🎯 [ATTENDANCE] Has target batch-sections: ${hasTargetBatchSections}, Has roll number attendees: ${hasRollNumberAttendees}`);
      
      if (hasTargetBatchSections) {
        console.log(`🎯 [ATTENDANCE] Processing ${event.targetBatchSections.length} batch-section combinations`);
        console.log(`🎯 [ATTENDANCE] Target batch sections:`, JSON.stringify(event.targetBatchSections, null, 2));
      }
      
      if (hasRollNumberAttendees) {
        console.log(`🎯 [ATTENDANCE] Roll number attendees count: ${event.rollNumberAttendees.length}`);
      }
      
      let successCount = 0;
      let errorCount = 0;
      const results: Array<{batchSection: string, status: 'success' | 'error' | 'skipped', message: string}> = [];
      
      // ✅ Handle roll-number-only events (no batch-section targeting)
      if (!hasTargetBatchSections && hasRollNumberAttendees) {
        console.log(`📋 [ATTENDANCE] Creating generic attendance sheet for roll-number-only event`);
        
        try {
          // Create a generic attendance sheet for roll number attendees
          const sheet = await this.createAttendanceSheet({
            eventId: event.id,
            batch: 'Roll Number Upload',
            section: 'Manual Selection',
            createdBy: event.authorId,
          });

          console.log(`✅ [ATTENDANCE] Generic sheet created with ID: ${sheet.id}`);

          // Add all roll number attendees to this sheet
          const rollNumberRecords = [];
          for (const email of event.rollNumberAttendees) {
            // Try to get additional info from student directory
            const studentInfo = await db
              .select()
              .from(studentDirectory)
              .where(eq(studentDirectory.email, email))
              .limit(1);

            const rollNumberRecord = {
              sheetId: sheet.id,
              studentEmail: email,
              studentName: studentInfo.length > 0 ? 
                (studentInfo[0].email.split('@')[0] || '') : 
                email.split('@')[0] || '',
              rollNumber: studentInfo.length > 0 ? studentInfo[0].rollNumber : null,
              status: 'UNMARKED' as const,
            };

            rollNumberRecords.push(rollNumberRecord);
            console.log(`📝 [ATTENDANCE] Added roll number attendee: ${email}`);
          }

          if (rollNumberRecords.length > 0) {
            const createdRecords = await this.createAttendanceRecords(rollNumberRecords);
            console.log(`✅ [ATTENDANCE] Created generic attendance sheet ${sheet.id} for event ${event.id} with ${createdRecords.length} roll number attendees`);
          }

          console.log(`🏁 [ATTENDANCE] === ROLL-NUMBER-ONLY EVENT PROCESSING COMPLETE ===`);
          console.log(`🏁 [ATTENDANCE] Event ${event.id}: Successfully created sheet with ${event.rollNumberAttendees.length} roll number attendees`);
          return;
        } catch (error: any) {
          console.error(`❌ [ATTENDANCE] Failed to create generic attendance sheet for roll-number-only event ${event.id}:`, error);
          console.log(`ℹ️ [ATTENDANCE] No attendance sheets created for event ${event.id}`);
          return;
        }
      }

      // ✅ FIXED: Process each batch-section with comprehensive error handling
      const batchSections = event.targetBatchSections || [];
      for (let i = 0; i < batchSections.length; i++) {
        const batchSection = batchSections[i];
        console.log(`📋 [ATTENDANCE] >> PROCESSING ${i + 1}/${batchSections.length}: "${batchSection}"`);
        
        try {
          // ✅ FIXED: Validate batch-section format before processing
          if (!batchSection || typeof batchSection !== 'string') {
            throw new Error(`Invalid batch-section: not a string - got ${typeof batchSection}: ${batchSection}`);
          }
          
          const parts = batchSection.split('::');
          if (parts.length !== 2) {
            throw new Error(`Invalid batch-section format: expected "batch::section", got "${batchSection}"`);
          }
          
          const [batch, section] = parts;
          if (!batch || !section) {
            throw new Error(`Invalid batch-section parts: batch="${batch}", section="${section}"`);
          }
          
          console.log(`📋 [ATTENDANCE] Parsed - batch: "${batch}", section: "${section}"`);
          
          // ✅ FIXED: Add database connection check
          console.log(`🔍 [ATTENDANCE] Checking for existing sheets...`);
          
          // Check if attendance sheet already exists for this specific batch-section (idempotent)
          const existingSheets = await db
            .select()
            .from(attendanceSheets)
            .where(and(
              eq(attendanceSheets.eventId, event.id),
              eq(attendanceSheets.batch, batch),
              eq(attendanceSheets.section, section)
            ));
            
          console.log(`🔍 [ATTENDANCE] Found ${existingSheets.length} existing sheets`);
            
          if (existingSheets.length === 0) {
            console.log(`✨ [ATTENDANCE] Creating new sheet for batch: "${batch}", section: "${section}"`);
            
            // ✅ FIXED: Create attendance sheet with validation
            const sheet = await this.createAttendanceSheet({
              eventId: event.id,
              batch,
              section,
              createdBy: event.authorId,
            });

            console.log(`✅ [ATTENDANCE] Sheet created with ID: ${sheet.id}`);

            // ✅ FIXED: Get students with better error handling
            console.log(`🔍 [ATTENDANCE] Searching for students with batch="${batch}" AND section="${batchSection}"`);
            
            const students = await db
              .select()
              .from(studentDirectory)
              .where(and(eq(studentDirectory.batch, batch), eq(studentDirectory.section, batchSection)));

            console.log(`👥 [ATTENDANCE] Found ${students.length} students for ${batchSection}`);

            // ✅ FIXED: Create attendance records ONLY for batch-section students (no roll number attendees here)
            if (students.length > 0) {
              console.log(`📝 [ATTENDANCE] Creating ${students.length} attendance records for batch-section students only...`);
              
              const batchSectionRecords = students.map(student => ({
                sheetId: sheet.id,
                studentEmail: student.email,
                studentName: student.email.split('@')[0] || '', // Use email prefix as name
                rollNumber: student.rollNumber || null,
                status: 'UNMARKED' as const,
              }));

              const createdRecords = await this.createAttendanceRecords(batchSectionRecords);
              console.log(`✅ [ATTENDANCE] Created attendance sheet ${sheet.id} for event ${event.id} with ${createdRecords.length} students from ${batch}::${section}`);
              
              results.push({
                batchSection,
                status: 'success',
                message: `Created sheet ${sheet.id} with ${createdRecords.length} students from batch-section`
              });
              successCount++;
            } else {
              console.log(`⚠️ [ATTENDANCE] No students found for ${batchSection} - sheet created but empty`);
              results.push({
                batchSection,
                status: 'success',
                message: `Created empty sheet ${sheet.id} - no students found`
              });
              successCount++;
            }
          } else {
            console.log(`ℹ️ [ATTENDANCE] Sheet already exists for ${batch}::${section}, skipping`);
            results.push({
              batchSection,
              status: 'skipped',
              message: `Sheet already exists (ID: ${existingSheets[0].id})`
            });
          }
          
          console.log(`📋 [ATTENDANCE] << COMPLETED Processing ${i + 1}/${event.targetBatchSections.length}: ${batchSection}`);
          
        } catch (error: any) {
          errorCount++;
          const errorMessage = error?.message || 'Unknown error';
          
          console.error(`❌ [ATTENDANCE] CRITICAL ERROR for "${batchSection}" in event ${event.id}:`);
          console.error(`❌ [ATTENDANCE] Error type:`, typeof error);
          console.error(`❌ [ATTENDANCE] Error name:`, error?.name);
          console.error(`❌ [ATTENDANCE] Error message:`, errorMessage);
          console.error(`❌ [ATTENDANCE] Error stack:`, error?.stack);
          
          if (error?.code) {
            console.error(`❌ [ATTENDANCE] Database error code:`, error.code);
          }
          
          console.error(`❌ [ATTENDANCE] Loop state: i=${i}, total=${event.targetBatchSections.length}`);
          console.error(`❌ [ATTENDANCE] Failed batch-section: "${batchSection}"`);
          
          results.push({
            batchSection,
            status: 'error',
            message: errorMessage
          });
          
          // ✅ FIXED: Continue processing other sections even after error
          console.error(`❌ [ATTENDANCE] CONTINUING to process remaining sections...`);
        }
        
        // ✅ FIXED: Add small delay between processing to prevent resource issues
        if (i < batchSections.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
        }
      }
      
      // ✅ NEW: After creating all batch-section sheets, handle roll number attendees separately
      if (hasRollNumberAttendees) {
        console.log(`🎯 [ATTENDANCE] === PROCESSING ROLL NUMBER ATTENDEES ===`);
        
        // Collect all students already included in batch-section sheets to avoid duplicates
        const allBatchSectionStudents = new Set<string>();
        
        for (const batchSection of batchSections) {
          const [batch, section] = batchSection.split('::');
          if (batch && section) {
            const students = await db
              .select()
              .from(studentDirectory)
              .where(and(eq(studentDirectory.batch, batch), eq(studentDirectory.section, batchSection)));
            
            students.forEach(student => {
              allBatchSectionStudents.add(student.email.toLowerCase());
            });
          }
        }
        
        console.log(`👥 [ATTENDANCE] Found ${allBatchSectionStudents.size} students in batch-sections`);
        
        // Filter roll number attendees to only include those NOT in any batch-section
        const uniqueRollNumberAttendees = event.rollNumberAttendees.filter(email => 
          !allBatchSectionStudents.has(email.toLowerCase())
        );
        
        console.log(`📋 [ATTENDANCE] Roll number attendees: ${event.rollNumberAttendees.length} total, ${uniqueRollNumberAttendees.length} unique (not in batch-sections)`);
        
        // Create separate sheet for unique roll number attendees only if there are any
        if (uniqueRollNumberAttendees.length > 0) {
          try {
            console.log(`✨ [ATTENDANCE] Creating separate sheet for ${uniqueRollNumberAttendees.length} unique roll number attendees`);
            
            const rollNumberSheet = await this.createAttendanceSheet({
              eventId: event.id,
              batch: 'Roll Number Upload',
              section: 'Manual Selection',
              createdBy: event.authorId,
            });
            
            console.log(`✅ [ATTENDANCE] Roll number sheet created with ID: ${rollNumberSheet.id}`);
            
            // Create records for unique roll number attendees
            const rollNumberRecords = [];
            for (const email of uniqueRollNumberAttendees) {
              // Try to get additional info from student directory
              const studentInfo = await db
                .select()
                .from(studentDirectory)
                .where(eq(studentDirectory.email, email))
                .limit(1);

              const rollNumberRecord = {
                sheetId: rollNumberSheet.id,
                studentEmail: email,
                studentName: studentInfo.length > 0 ? 
                  (studentInfo[0].email.split('@')[0] || '') : 
                  email.split('@')[0] || '',
                rollNumber: studentInfo.length > 0 ? studentInfo[0].rollNumber : null,
                status: 'UNMARKED' as const,
              };

              rollNumberRecords.push(rollNumberRecord);
            }

            const createdRollNumberRecords = await this.createAttendanceRecords(rollNumberRecords);
            console.log(`✅ [ATTENDANCE] Created ${createdRollNumberRecords.length} roll number attendance records`);
            
            results.push({
              batchSection: 'Roll Number Upload::Manual Selection',
              status: 'success',
              message: `Created separate sheet ${rollNumberSheet.id} with ${createdRollNumberRecords.length} unique roll number attendees`
            });
            successCount++;
          } catch (error: any) {
            console.error(`❌ [ATTENDANCE] Failed to create roll number sheet:`, error);
            results.push({
              batchSection: 'Roll Number Upload::Manual Selection',
              status: 'error',
              message: `Failed to create roll number sheet: ${error.message}`
            });
            errorCount++;
          }
        } else {
          console.log(`ℹ️ [ATTENDANCE] All roll number attendees are already in batch-sections, no separate sheet needed`);
        }
        
        console.log(`🏁 [ATTENDANCE] === ROLL NUMBER PROCESSING COMPLETE ===`);
      }
      
      // ✅ FIXED: Comprehensive completion summary
      console.log(`🏁 [ATTENDANCE] === PROCESSING COMPLETE ===`);
      console.log(`🏁 [ATTENDANCE] Event ${event.id}: ${successCount} success, ${errorCount} errors, ${results.filter(r => r.status === 'skipped').length} skipped`);
      console.log(`🏁 [ATTENDANCE] Detailed results:`);
      results.forEach((result, index) => {
        const statusIcon = result.status === 'success' ? '✅' : result.status === 'error' ? '❌' : 'ℹ️';
        console.log(`🏁 [ATTENDANCE]   ${statusIcon} ${index + 1}/${results.length}: ${result.batchSection} - ${result.message}`);
      });
      
      if (errorCount > 0) {
        console.error(`🚨 [ATTENDANCE] ATTENTION: ${errorCount} batch-sections failed to process for event ${event.id}`);
      }
      
    } else {
      console.log(`ℹ️ [ATTENDANCE] No target batch sections for event ${event.id}, skipping attendance sheet creation`);
    }
  }

  async getEventById(id: number): Promise<Event | undefined> {
    const [event] = await db.select().from(events).where(eq(events.id, id));
    return event;
  }

  async updateEvent(id: number, eventData: Partial<InsertEvent>): Promise<Event> {
    const updateData: any = {
      ...eventData,
      updatedAt: new Date(),
    };
    // Ensure mediaUrls is properly formatted for JSONB field
    if (updateData.mediaUrls !== undefined) {
      updateData.mediaUrls = Array.isArray(updateData.mediaUrls) ? updateData.mediaUrls : [];
    }
    const [event] = await db.update(events)
      .set(updateData)
      .where(eq(events.id, id))
      .returning();
    return event;
  }

  async deleteEvent(id: number): Promise<void> {
    console.log(`🗑️ [DELETE] Starting deletion of event ${id} and all associated data...`);
    
    // First, get all attendance sheets for this event
    const eventAttendanceSheets = await db.select().from(attendanceSheets).where(eq(attendanceSheets.eventId, id));
    console.log(`🗑️ [DELETE] Found ${eventAttendanceSheets.length} attendance sheets to delete`);
    
    // Delete all attendance records for each sheet
    for (const sheet of eventAttendanceSheets) {
      const recordsDeleted = await db.delete(attendanceRecords).where(eq(attendanceRecords.sheetId, sheet.id));
      console.log(`🗑️ [DELETE] Deleted attendance records for sheet ${sheet.id}`);
    }
    
    // Delete all attendance sheets for this event
    await db.delete(attendanceSheets).where(eq(attendanceSheets.eventId, id));
    console.log(`🗑️ [DELETE] Deleted ${eventAttendanceSheets.length} attendance sheets`);
    
    // Delete related RSVPs
    await db.delete(eventRsvps).where(eq(eventRsvps.eventId, id));
    console.log(`🗑️ [DELETE] Deleted event RSVPs`);
    
    // Finally delete the event itself
    await db.delete(events).where(eq(events.id, id));
    console.log(`🗑️ [DELETE] Successfully deleted event ${id} and all associated data`);
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
  async getCommunityPosts(userId?: string): Promise<CommunityPostWithVotes[]> {
    // Get all posts
    const posts = await db
      .select()
      .from(communityPosts)
      .where(eq(communityPosts.isDeleted, false))
      .orderBy(desc(communityPosts.createdAt));

    if (posts.length === 0) return [];

    // Get all vote counts in a single aggregated query
    const voteCounts = await db
      .select({
        postId: communityVotes.postId,
        voteType: communityVotes.voteType,
        count: sql<number>`count(*)::int`,
      })
      .from(communityVotes)
      .where(inArray(communityVotes.postId, posts.map(p => p.id)))
      .groupBy(communityVotes.postId, communityVotes.voteType);

    // Get user's votes in a single query if userId is provided
    let userVotes: Map<number, string> = new Map();
    if (userId) {
      const userVoteRecords = await db
        .select()
        .from(communityVotes)
        .where(
          and(
            eq(communityVotes.userId, userId),
            inArray(communityVotes.postId, posts.map(p => p.id))
          )
        );
      userVoteRecords.forEach(vote => {
        userVotes.set(vote.postId, vote.voteType);
      });
    }

    // Create a map of vote counts for efficient lookup
    const voteMap = new Map<number, { upvotes: number; downvotes: number }>();
    posts.forEach(post => {
      voteMap.set(post.id, { upvotes: 0, downvotes: 0 });
    });
    
    voteCounts.forEach(vote => {
      const current = voteMap.get(vote.postId)!;
      if (vote.voteType === 'upvote') {
        current.upvotes = Number(vote.count);
      } else if (vote.voteType === 'downvote') {
        current.downvotes = Number(vote.count);
      }
    });

    // Combine all data
    return posts.map(post => {
      const votes = voteMap.get(post.id)!;
      return {
        ...post,
        upvotes: votes.upvotes,
        downvotes: votes.downvotes,
        userVote: userVotes.get(post.id) || null,
      } as CommunityPostWithVotes;
    });
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

    // Get vote counts in a single aggregated query
    const voteCounts = await db
      .select({
        voteType: communityVotes.voteType,
        count: sql<number>`count(*)::int`,
      })
      .from(communityVotes)
      .where(eq(communityVotes.postId, post.id))
      .groupBy(communityVotes.voteType);

    let upvotes = 0;
    let downvotes = 0;
    voteCounts.forEach(vote => {
      if (vote.voteType === 'upvote') upvotes = Number(vote.count);
      else if (vote.voteType === 'downvote') downvotes = Number(vote.count);
    });

    return {
      ...post,
      upvotes,
      downvotes,
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

    if (replies.length === 0) return [];

    // Get all vote counts in a single aggregated query
    const voteCounts = await db
      .select({
        replyId: communityVotes.replyId,
        voteType: communityVotes.voteType,
        count: sql<number>`count(*)::int`,
      })
      .from(communityVotes)
      .where(inArray(communityVotes.replyId, replies.map(r => r.id)))
      .groupBy(communityVotes.replyId, communityVotes.voteType);

    // Create a map of vote counts for efficient lookup
    const voteMap = new Map<number, { upvotes: number; downvotes: number }>();
    replies.forEach(reply => {
      voteMap.set(reply.id, { upvotes: 0, downvotes: 0 });
    });
    
    voteCounts.forEach(vote => {
      if (vote.replyId) {
        const current = voteMap.get(vote.replyId)!;
        if (vote.voteType === 'upvote') {
          current.upvotes = Number(vote.count);
        } else if (vote.voteType === 'downvote') {
          current.downvotes = Number(vote.count);
        }
      }
    });

    // Combine all data
    return replies.map(reply => {
      const votes = voteMap.get(reply.id)!;
      return {
        ...reply,
        upvotes: votes.upvotes,
        downvotes: votes.downvotes,
      } as CommunityReplyWithVotes;
    });
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

  async upsertMenuEntry(date: string, mealType: string, items: string, uploadedBy: string): Promise<WeeklyMenu> {
    // Build the data object with only the specified meal type
    const mealData: any = {
      date,
      uploadedBy,
      uploadedAt: new Date(),
      updatedAt: new Date(),
    };
    
    // Set the specific meal type field
    mealData[mealType] = items;
    
    // Build the update object for conflict resolution
    const updateData: any = {
      updatedAt: new Date(),
    };
    updateData[mealType] = items;
    
    // Upsert: insert if date doesn't exist, update the meal type if it does
    const [result] = await db
      .insert(weeklyMenu)
      .values(mealData)
      .onConflictDoUpdate({
        target: weeklyMenu.date,
        set: updateData,
      })
      .returning();
    
    return result;
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

  async getSickFoodBookingsWithUserData(startDate?: Date, endDate?: Date, userId?: string): Promise<Array<SickFoodBooking & { user: { firstName: string | null; lastName: string | null; rollNumber: string | null; email: string | null } }>> {
    const conditions = [];
    
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      conditions.push(gte(sickFoodBookings.date, start));
    }
    
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      conditions.push(lte(sickFoodBookings.date, end));
    }
    
    if (userId) {
      conditions.push(eq(sickFoodBookings.userId, userId));
    }
    
    const query = db
      .select({
        id: sickFoodBookings.id,
        userId: sickFoodBookings.userId,
        date: sickFoodBookings.date,
        mealType: sickFoodBookings.mealType,
        specialRequirements: sickFoodBookings.specialRequirements,
        roomNumber: sickFoodBookings.roomNumber,
        phoneNumber: sickFoodBookings.phoneNumber,
        parcelMode: sickFoodBookings.parcelMode,
        status: sickFoodBookings.status,
        approvedBy: sickFoodBookings.approvedBy,
        approvedAt: sickFoodBookings.approvedAt,
        adminNotes: sickFoodBookings.adminNotes,
        createdAt: sickFoodBookings.createdAt,
        user: {
          firstName: users.firstName,
          lastName: users.lastName,
          rollNumber: sql<string>`COALESCE(${studentDirectory.rollNumber}, ${users.rollNumber})`.as('rollNumber'),
          email: users.email,
        },
      })
      .from(sickFoodBookings)
      .leftJoin(users, eq(sickFoodBookings.userId, users.id))
      .leftJoin(studentDirectory, eq(users.directoryId, studentDirectory.id));
    
    if (conditions.length > 0) {
      return await query.where(and(...conditions)).orderBy(desc(sickFoodBookings.createdAt));
    }
    
    return await query.orderBy(desc(sickFoodBookings.createdAt));
  }

  async updateSickFoodBookingStatus(
    id: number, 
    status: 'pending' | 'approved' | 'rejected', 
    approvedBy: string, 
    adminNotes?: string
  ): Promise<SickFoodBooking | undefined> {
    const [updated] = await db
      .update(sickFoodBookings)
      .set({ 
        status, 
        approvedBy, 
        approvedAt: new Date(), 
        adminNotes 
      })
      .where(eq(sickFoodBookings.id, id))
      .returning();
    return updated;
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

  async getArchivedBatches(): Promise<string[]> {
    const rows = await db.select({ batch: archivedBatches.batch }).from(archivedBatches).orderBy(archivedBatches.batch);
    return rows.map(r => r.batch);
  }

  async archiveBatch(batch: string, archivedBy: string): Promise<void> {
    await db.insert(archivedBatches).values({ batch: batch.trim(), archivedBy }).onConflictDoNothing();
  }

  async getStudentDirectoryBatches(): Promise<string[]> {
    const archived = await this.getArchivedBatches();
    const batches = await db.select({
      batch: studentDirectory.batch
    })
    .from(studentDirectory)
    .where(and(
      sql`${studentDirectory.batch} IS NOT NULL AND ${studentDirectory.batch} != ''`,
      archived.length > 0 ? notInArray(studentDirectory.batch, archived) : sql`1=1`
    ))
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
      phone: string | null;
      linkedIn: string | null;
      isAlumni?: boolean;
    }>;
    total: number;
    page: number;
    limit: number;
  }> {
    const { batch, query, section, program, page, limit, offset } = params;
    const isAlumniView = batch === 'Alumni';
    const archived = await this.getArchivedBatches();

    let baseQuery = db.select({
      id: studentDirectory.id,
      fullName: sql<string>`${studentDirectory.email}`.as('fullName'),
      email: studentDirectory.email,
      rollNumber: studentDirectory.rollNumber,
      batch: studentDirectory.batch,
      section: studentDirectory.section,
      phone: studentDirectory.phone,
      linkedIn: studentDirectory.linkedIn,
    }).from(studentDirectory);

    const conditions = [];

    if (isAlumniView) {
      if (archived.length === 0) {
        return { data: [], total: 0, page, limit };
      }
      conditions.push(inArray(studentDirectory.batch, archived));
    } else {
      if (batch && batch !== 'All') {
        conditions.push(eq(studentDirectory.batch, batch));
      } else if (archived.length > 0) {
        conditions.push(notInArray(studentDirectory.batch, archived));
      }
    }

    if (query) {
      const searchQuery = `%${query.toLowerCase()}%`;
      conditions.push(
        or(
          sql`LOWER(${studentDirectory.email}) LIKE ${searchQuery}`,
          sql`LOWER(${studentDirectory.rollNumber}) LIKE ${searchQuery}`,
          sql`LOWER(COALESCE(${studentDirectory.phone}, '')) LIKE ${searchQuery}`,
          sql`LOWER(COALESCE(${studentDirectory.linkedIn}, '')) LIKE ${searchQuery}`
        )
      );
    }

    if (section) {
      conditions.push(eq(studentDirectory.section, section));
    }

    if (conditions.length > 0) {
      baseQuery = baseQuery.where(and(...conditions)) as any;
    }

    let countQuery = db.select({ count: sql<number>`count(*)` }).from(studentDirectory);
    if (conditions.length > 0) {
      countQuery = countQuery.where(and(...conditions)) as any;
    }
    const [{ count: total }] = await countQuery;

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
        phone: isAlumniView ? null : (row.phone ?? null),
        linkedIn: row.linkedIn ?? null,
        isAlumni: isAlumniView,
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
          rollNumber: student.rollNumber ?? null,
          phone: student.phone ?? null,
          linkedIn: (student as any).linkedIn ?? undefined,
          uploadedBy: student.uploadedBy,
          updatedAt: sql`now()`,
        },
      })
      .returning();
    return result;
  }

  async updateStudentDirectory(id: number, updates: { linkedIn?: string | null }): Promise<StudentDirectory | undefined> {
    const [updated] = await db
      .update(studentDirectory)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(studentDirectory.id, id))
      .returning();
    return updated;
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
            phone: sql`excluded.phone`,
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
    const archived = await this.getArchivedBatches();
    let query = db.selectDistinct({ batch: batchSections.batch }).from(batchSections);
    if (archived.length > 0) {
      query = query.where(notInArray(batchSections.batch, archived)) as typeof query;
    }
    const results = await query.orderBy(batchSections.batch);
    return results.map(r => r.batch);
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
    category: 'academic' | 'cultural' | 'sports' | 'surprise' | 'penalty', 
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

    // Calculate new points (handle numeric database values)
    const getCategoryPoints = (team: TriathlonTeam, category: string): number => {
      switch (category) {
        case 'academic': return parseFloat(team.academicPoints as string) || 0;
        case 'cultural': return parseFloat(team.culturalPoints as string) || 0;
        case 'sports': return parseFloat(team.sportsPoints as string) || 0;
        case 'surprise': return parseFloat(team.surprisePoints as string) || 0;
        case 'penalty': return parseFloat(team.penaltyPoints as string) || 0;
        default: return 0;
      }
    };

    const currentPoints = getCategoryPoints(team, category);
    const newPoints = Math.max(0, currentPoints + pointChange);
    
    // Calculate new total: academic + cultural + sports + surprise - penalty
    let newAcademic = parseFloat(team.academicPoints as string) || 0;
    let newCultural = parseFloat(team.culturalPoints as string) || 0;
    let newSports = parseFloat(team.sportsPoints as string) || 0;
    let newSurprise = parseFloat(team.surprisePoints as string) || 0;
    let newPenalty = parseFloat(team.penaltyPoints as string) || 0;
    
    // Update the specific category
    switch (category) {
      case 'academic': newAcademic = newPoints; break;
      case 'cultural': newCultural = newPoints; break;
      case 'sports': newSports = newPoints; break;
      case 'surprise': newSurprise = newPoints; break;
      case 'penalty': newPenalty = newPoints; break;
    }
    
    const newTotal = newAcademic + newCultural + newSports + newSurprise - newPenalty;

    // Prepare update object with proper column mapping
    const updateData: any = {
      totalPoints: newTotal.toFixed(2),
      updatedAt: new Date()
    };

    // Set the specific category column
    switch (category) {
      case 'academic': updateData.academicPoints = newPoints.toFixed(2); break;
      case 'cultural': updateData.culturalPoints = newPoints.toFixed(2); break;
      case 'sports': updateData.sportsPoints = newPoints.toFixed(2); break;
      case 'surprise': updateData.surprisePoints = newPoints.toFixed(2); break;
      case 'penalty': updateData.penaltyPoints = newPoints.toFixed(2); break;
    }

    // Update team points
    const [updatedTeam] = await db
      .update(triathlonTeams)
      .set(updateData)
      .where(eq(triathlonTeams.id, teamId))
      .returning();

    // Record point history
    await db
      .insert(triathlonPointHistory)
      .values({
        teamId,
        category,
        pointChange: pointChange.toFixed(2),
        previousPoints: currentPoints.toFixed(2),
        newPoints: newPoints.toFixed(2),
        reason: reason || null,
        changedBy
      });

    return updatedTeam;
  }

  async setTriathlonPoints(
    teamId: number, 
    category: 'academic' | 'cultural' | 'sports' | 'surprise' | 'penalty', 
    points: number,
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

    // Get current points for this category
    const getCategoryPoints = (team: TriathlonTeam, category: string): number => {
      switch (category) {
        case 'academic': return parseFloat(team.academicPoints as string) || 0;
        case 'cultural': return parseFloat(team.culturalPoints as string) || 0;
        case 'sports': return parseFloat(team.sportsPoints as string) || 0;
        case 'surprise': return parseFloat(team.surprisePoints as string) || 0;
        case 'penalty': return parseFloat(team.penaltyPoints as string) || 0;
        default: return 0;
      }
    };

    const currentPoints = getCategoryPoints(team, category);
    const newPoints = Math.max(0, points); // Ensure points are not negative
    
    // Calculate new total: academic + cultural + sports + surprise - penalty
    let newAcademic = parseFloat(team.academicPoints as string) || 0;
    let newCultural = parseFloat(team.culturalPoints as string) || 0;
    let newSports = parseFloat(team.sportsPoints as string) || 0;
    let newSurprise = parseFloat(team.surprisePoints as string) || 0;
    let newPenalty = parseFloat(team.penaltyPoints as string) || 0;
    
    // Update the specific category
    switch (category) {
      case 'academic': newAcademic = newPoints; break;
      case 'cultural': newCultural = newPoints; break;
      case 'sports': newSports = newPoints; break;
      case 'surprise': newSurprise = newPoints; break;
      case 'penalty': newPenalty = newPoints; break;
    }
    
    const newTotal = newAcademic + newCultural + newSports + newSurprise - newPenalty;

    // Prepare update object with proper column mapping
    const updateData: any = {
      totalPoints: newTotal.toFixed(2),
      updatedAt: new Date()
    };

    // Set the specific category column
    switch (category) {
      case 'academic': updateData.academicPoints = newPoints.toFixed(2); break;
      case 'cultural': updateData.culturalPoints = newPoints.toFixed(2); break;
      case 'sports': updateData.sportsPoints = newPoints.toFixed(2); break;
      case 'surprise': updateData.surprisePoints = newPoints.toFixed(2); break;
      case 'penalty': updateData.penaltyPoints = newPoints.toFixed(2); break;
    }

    // Update team points
    const [updatedTeam] = await db
      .update(triathlonTeams)
      .set(updateData)
      .where(eq(triathlonTeams.id, teamId))
      .returning();

    // Record point history (calculate the point change)
    const pointChange = newPoints - currentPoints;
    await db
      .insert(triathlonPointHistory)
      .values({
        teamId,
        category,
        pointChange: pointChange.toFixed(2),
        previousPoints: currentPoints.toFixed(2),
        newPoints: newPoints.toFixed(2),
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

  async getTriathlonState(): Promise<{ frozen: boolean }> {
    const [row] = await db.select().from(triathlonState).limit(1);
    return row ? { frozen: !!row.frozen } : { frozen: false };
  }

  async setTriathlonFrozen(frozen: boolean): Promise<void> {
    const [existing] = await db.select().from(triathlonState).limit(1);
    if (existing) {
      await db
        .update(triathlonState)
        .set({
          frozen,
          frozenAt: frozen ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(triathlonState.id, existing.id));
    } else {
      await db.insert(triathlonState).values({
        frozen,
        frozenAt: frozen ? new Date() : null,
        updatedAt: new Date(),
      });
    }
  }

  async resetTriathlonLeaderboard(): Promise<void> {
    const zero = "0.00";
    await db
      .update(triathlonTeams)
      .set({
        academicPoints: zero,
        culturalPoints: zero,
        sportsPoints: zero,
        surprisePoints: zero,
        penaltyPoints: zero,
        totalPoints: zero,
        updatedAt: new Date(),
      });
    await db.delete(triathlonPointHistory);
    await this.setTriathlonFrozen(false);
  }

  async announceTriathlonWinners(announcedBy: string): Promise<TriathlonPastWinner> {
    const teams = await this.getTriathlonTeams();
    if (teams.length === 0) {
      throw new Error("No teams to announce winners for");
    }
    const parse = (v: string | number | null | undefined) => parseFloat(String(v ?? 0)) || 0;
    const byAcademic = [...teams].sort((a, b) => parse(b.academicPoints) - parse(a.academicPoints));
    const byCultural = [...teams].sort((a, b) => parse(b.culturalPoints) - parse(a.culturalPoints));
    const bySports = [...teams].sort((a, b) => parse(b.sportsPoints) - parse(a.sportsPoints));
    const byOverall = [...teams].sort((a, b) => parse(b.totalPoints) - parse(a.totalPoints));
    const academicFirst = byAcademic[0];
    const culturalFirst = byCultural[0];
    const sportsFirst = bySports[0];
    const overallFirst = byOverall[0];
    const [inserted] = await db
      .insert(triathlonPastWinners)
      .values({
        academicFirstPlaceTeamId: academicFirst.id,
        academicFirstPlaceName: academicFirst.name,
        culturalFirstPlaceTeamId: culturalFirst.id,
        culturalFirstPlaceName: culturalFirst.name,
        sportsFirstPlaceTeamId: sportsFirst.id,
        sportsFirstPlaceName: sportsFirst.name,
        overallFirstPlaceTeamId: overallFirst.id,
        overallFirstPlaceName: overallFirst.name,
        announcedBy,
      })
      .returning();
    await this.setTriathlonFrozen(true);
    return inserted;
  }

  async getTriathlonPastWinners(): Promise<TriathlonPastWinner[]> {
    return await db
      .select()
      .from(triathlonPastWinners)
      .orderBy(desc(triathlonPastWinners.announcedAt));
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

  // ✅ NEW: Get ALL attendance sheets for an event (for multi-section events)
  async getAttendanceSheetsByEventId(eventId: number): Promise<AttendanceSheet[]> {
    return await db
      .select()
      .from(attendanceSheets)
      .where(eq(attendanceSheets.eventId, eventId))
      .orderBy(attendanceSheets.batch, attendanceSheets.section);
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
}

export const storage = new DatabaseStorage();
