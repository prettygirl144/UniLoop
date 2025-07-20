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
  diningMenu,
  attendance,
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
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, lte } from "drizzle-orm";

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

  // Dining & Hostel
  getTodaysMenu(): Promise<any[]>;
  bookSickFood(booking: InsertSickFoodBooking): Promise<SickFoodBooking>;
  applyForLeave(leave: InsertHostelLeave): Promise<HostelLeave>;
  submitGrievance(grievance: InsertGrievance): Promise<Grievance>;

  // Attendance
  saveAttendance(eventId: number, attendees: string[], markedBy: string): Promise<void>;

  // Directory
  getAllUsers(): Promise<User[]>;
  searchUsers(query: string): Promise<User[]>;
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
      // Insert new user
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
      .set({ permissions, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user;
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
    const [created] = await db
      .insert(events)
      .values(event)
      .returning();
    return created;
  }

  async getEventById(id: number): Promise<Event | undefined> {
    const [event] = await db
      .select()
      .from(events)
      .where(eq(events.id, id));
    return event;
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
    const [created] = await db
      .insert(forumPosts)
      .values(post)
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

  // Dining & Hostel
  async getTodaysMenu(): Promise<any[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return await db
      .select()
      .from(diningMenu)
      .where(and(
        gte(diningMenu.date, today),
        lte(diningMenu.date, tomorrow)
      ));
  }

  async bookSickFood(booking: InsertSickFoodBooking): Promise<SickFoodBooking> {
    const [created] = await db
      .insert(sickFoodBookings)
      .values(booking)
      .returning();
    return created;
  }

  async applyForLeave(leave: InsertHostelLeave): Promise<HostelLeave> {
    const [created] = await db
      .insert(hostelLeave)
      .values(leave)
      .returning();
    return created;
  }

  async submitGrievance(grievance: InsertGrievance): Promise<Grievance> {
    const [created] = await db
      .insert(grievances)
      .values(grievance)
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
}

export const storage = new DatabaseStorage();
