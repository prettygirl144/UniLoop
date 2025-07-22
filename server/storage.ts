import {
  users,
  announcements,
  events,
  eventRsvps,
  forumPosts,
  forumReactions,
  forumComments,
  sickFoodBookings,
  hostelLeave,
  grievances,
  weeklyMenu,
  attendance,
  galleryFolders,
  type User,
  type UpsertUser,
  type InsertAnnouncement,
  type Announcement,
  type InsertEvent,
  type Event,
  type InsertEventRsvp,
  type EventRsvp,
  type InsertForumPost,
  type ForumPost,
  type InsertForumReaction,
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
  amenitiesPermissions,
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

  // Forum
  getForumPosts(): Promise<ForumPost[]>;
  createForumPost(post: InsertForumPost): Promise<ForumPost>;
  getForumPostById(id: number): Promise<ForumPost | undefined>;
  reactToPost(reaction: InsertForumReaction): Promise<void>;
  getPostReactions(postId: number): Promise<{ type: string; count: number }[]>;

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
      const [user] = await db
        .insert(users)
        .values(userData)
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
      .values(alternateUserData)
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
      .values(folderData)
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
      .values(announcement)
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
    const eventData = {
      ...event,
      mediaUrls: event.mediaUrls ? (Array.isArray(event.mediaUrls) ? event.mediaUrls : []) : []
    };
    const [created] = await db
      .insert(events)
      .values(eventData)
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

  // Forum
  async getForumPosts(): Promise<ForumPost[]> {
    return await db
      .select()
      .from(forumPosts)
      .where(eq(forumPosts.isHidden, false))
      .orderBy(desc(forumPosts.createdAt));
  }

  async createForumPost(post: InsertForumPost): Promise<ForumPost> {
    const postData = {
      ...post,
      mediaUrls: post.mediaUrls ? (Array.isArray(post.mediaUrls) ? post.mediaUrls : []) : []
    };
    const [created] = await db
      .insert(forumPosts)
      .values(postData)
      .returning();
    return created;
  }

  async getForumPostById(id: number): Promise<ForumPost | undefined> {
    const [post] = await db
      .select()
      .from(forumPosts)
      .where(eq(forumPosts.id, id));
    return post;
  }

  async reactToPost(reaction: InsertForumReaction): Promise<void> {
    // Check if reaction exists first
    const [existingReaction] = await db
      .select()
      .from(forumReactions)
      .where(
        and(
          eq(forumReactions.postId, reaction.postId),
          eq(forumReactions.userId, reaction.userId)
        )
      );

    if (existingReaction) {
      // Update existing reaction
      await db
        .update(forumReactions)
        .set({ type: reaction.type })
        .where(
          and(
            eq(forumReactions.postId, reaction.postId),
            eq(forumReactions.userId, reaction.userId)
          )
        );
    } else {
      // Insert new reaction
      await db
        .insert(forumReactions)
        .values(reaction);
    }
  }

  async getPostReactions(postId: number): Promise<{ type: string; count: number }[]> {
    const reactions = await db
      .select()
      .from(forumReactions)
      .where(eq(forumReactions.postId, postId));
    
    const grouped = reactions.reduce((acc, reaction) => {
      acc[reaction.type] = (acc[reaction.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(grouped).map(([type, count]) => ({ type, count }));
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
        permissions
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }
}

export const storage = new DatabaseStorage();
