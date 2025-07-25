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
  galleryFolders,
  amenitiesPermissions,
  studentDirectory,
  studentUploadLogs,
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
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, lte, or, sql, inArray } from "drizzle-orm";
import crypto from "crypto";

export interface IStorage {
  // User operations (mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
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
  submitGrievance(grievance: InsertGrievance): Promise<Grievance>;
  getGrievances(category?: string): Promise<Grievance[]>;
  resolveGrievance(id: number, adminNotes?: string): Promise<Grievance>;
  
  // Amenities permissions
  getAmenitiesPermissions(userId: string): Promise<AmenitiesPermissions | undefined>;
  setAmenitiesPermissions(permissions: InsertAmenitiesPermissions): Promise<AmenitiesPermissions>;

  // Attendance
  saveAttendance(eventId: number, attendees: string[], markedBy: string): Promise<void>;

  // Directory
  getAllUsers(): Promise<User[]>;
  searchUsers(query: string): Promise<User[]>;
  
  // Admin functions
  getAllUsersForAdmin(): Promise<User[]>;
  updateUserRoleAndPermissions(userId: string, role: string, permissions: any): Promise<User | undefined>;

  // Student Directory operations
  getStudentDirectory(): Promise<StudentDirectory[]>;
  getStudentByEmail(email: string): Promise<StudentDirectory | undefined>;
  upsertStudentDirectory(student: InsertStudentDirectory): Promise<StudentDirectory>;
  batchUpsertStudents(students: InsertStudentDirectory[]): Promise<StudentDirectory[]>;
  createUploadLog(log: InsertStudentUploadLog): Promise<StudentUploadLog>;
  getUploadLogs(): Promise<StudentUploadLog[]>;
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
          permissions: userData.permissions || defaultPermissions,
        }])
        .returning();
      return user;
    }
  }

  async updateUserPermissions(userId: string, permissions: any): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ permissions })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async getEventById(id: number): Promise<Event | undefined> {
    const [event] = await db.select().from(events).where(eq(events.id, id));
    return event;
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
    const [created] = await db
      .insert(announcements)
      .values([announcement])
      .returning();
    return created;
  }

  // Events
  async getEvents(): Promise<Event[]> {
    return await db
      .select()
      .from(events)
      .orderBy(events.date);
  }

  async createEvent(event: InsertEvent): Promise<Event> {
    const [created] = await db
      .insert(events)
      .values([event])
      .returning();
    return created;
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
  async getCommunityPosts(): Promise<CommunityPost[]> {
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
        } as CommunityPost & { upvotes: number; downvotes: number };
      })
    );

    return postsWithVotes;
  }

  async createCommunityPost(post: InsertCommunityPost): Promise<CommunityPost> {
    const [created] = await db
      .insert(communityPosts)
      .values(post)
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
    };
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

  async getCommunityReplies(postId: number): Promise<CommunityReply[]> {
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
        } as CommunityReply & { upvotes: number; downvotes: number };
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
    };
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

  async bookSickFood(booking: InsertSickFoodBooking): Promise<SickFoodBooking> {
    const [created] = await db
      .insert(sickFoodBookings)
      .values(booking)
      .returning();
    return created;
  }

  async getSickFoodBookings(date?: Date): Promise<SickFoodBooking[]> {
    if (date) {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);
      
      return await db.select().from(sickFoodBookings).where(and(
        gte(sickFoodBookings.date, startDate),
        lte(sickFoodBookings.date, endDate)
      )).orderBy(desc(sickFoodBookings.createdAt));
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

  async submitGrievance(grievance: InsertGrievance): Promise<Grievance> {
    const [created] = await db
      .insert(grievances)
      .values(grievance)
      .returning();
    return created;
  }

  async getGrievances(category?: string): Promise<Grievance[]> {
    if (category) {
      return await db.select().from(grievances).where(eq(grievances.category, category)).orderBy(desc(grievances.createdAt));
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

  async getStudentByEmail(email: string): Promise<StudentDirectory | undefined> {
    const [student] = await db.select().from(studentDirectory).where(eq(studentDirectory.email, email));
    return student;
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
}

export const storage = new DatabaseStorage();
