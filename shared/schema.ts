import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  serial,
  boolean,
  integer,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Session storage table (mandatory for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table (mandatory for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role").default("student").notNull(), // student, admin, committee_club
  permissions: jsonb("permissions").$type<{
    calendar?: boolean;
    attendance?: boolean;
    gallery?: boolean;
    forumMod?: boolean;
    diningHostel?: boolean;
    postCreation?: boolean;
  }>().default({}),
  accountType: varchar("account_type").default("primary"), // primary, alternate
  linkedAccountId: varchar("linked_account_id"), // References primary account for alternates
  isActive: boolean("is_active").default(true),
  // Student directory fields
  batch: varchar("batch"), // From admin upload
  section: varchar("section"), // Sheet name from Excel
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Announcements/Posts table
export const announcements = pgTable("announcements", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  imageUrl: text("image_url"),
  tag: varchar("tag").notNull(), // Academic, Event, Admin
  authorId: varchar("author_id").notNull().references(() => users.id),
  rsvpEnabled: boolean("rsvp_enabled").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Events table
export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  date: timestamp("date").notNull(),
  location: text("location").notNull(),
  hostCommittee: text("host_committee").notNull(),
  category: varchar("category").notNull(),
  rsvpEnabled: boolean("rsvp_enabled").default(false),
  authorId: varchar("author_id").notNull().references(() => users.id),
  mediaUrls: jsonb("media_urls").$type<string[]>().default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Event RSVPs table
export const eventRsvps = pgTable("event_rsvps", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => events.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  status: varchar("status").default("attending").notNull(), // attending, maybe, not_attending
  createdAt: timestamp("created_at").defaultNow(),
});

// Attendance table
export const attendance = pgTable("attendance", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => events.id),
  attendees: text("attendees").array().notNull(),
  markedBy: varchar("marked_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Community Board Posts table (Section 1)
export const communityPosts = pgTable("community_posts", {
  id: serial("id").primaryKey(),
  title: varchar("title").notNull(),
  content: text("content").notNull(),
  category: varchar("category").notNull(),
  authorId: varchar("author_id").references(() => users.id),
  authorName: varchar("author_name"),
  isAnonymous: boolean("is_anonymous").default(false),
  mediaUrls: text("media_urls").array(),
  score: integer("score").default(0), // upvotes - downvotes
  isDeleted: boolean("is_deleted").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Community Board Votes table
export const communityVotes = pgTable("community_votes", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").references(() => communityPosts.id),
  replyId: integer("reply_id").references(() => communityReplies.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  voteType: varchar("vote_type").notNull(), // upvote, downvote
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  unique("unique_user_post_vote").on(table.userId, table.postId),
  unique("unique_user_reply_vote").on(table.userId, table.replyId)
]);

// Community Board Replies table (one level deep only)
export const communityReplies = pgTable("community_replies", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull().references(() => communityPosts.id),
  authorId: varchar("author_id").references(() => users.id),
  authorName: varchar("author_name"),
  content: text("content").notNull(),
  isAnonymous: boolean("is_anonymous").default(false),
  score: integer("score").default(0), // upvotes - downvotes
  isDeleted: boolean("is_deleted").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Community Announcements table (Section 2)
export const communityAnnouncements = pgTable("community_announcements", {
  id: serial("id").primaryKey(),
  title: varchar("title").notNull(),
  content: text("content").notNull(),
  category: varchar("category").notNull(),
  authorId: varchar("author_id").notNull().references(() => users.id),
  authorName: varchar("author_name").notNull(),
  mediaUrls: text("media_urls").array(),
  isDeleted: boolean("is_deleted").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Weekly menu table - stores processed menu data from Excel uploads
export const weeklyMenu = pgTable("weekly_menu", {
  id: serial("id").primaryKey(),
  date: varchar("date").notNull(), // YYYY-MM-DD format
  breakfast: text("breakfast"), // comma-separated items
  lunch: text("lunch"),
  eveningSnacks: text("evening_snacks"),
  dinner: text("dinner"),
  uploadedBy: varchar("uploaded_by").references(() => users.id),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique("unique_date").on(table.date),
]);

// Amenities permissions table - for granular RBAC per sub-feature
export const amenitiesPermissions = pgTable("amenities_permissions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  menuUpload: boolean("menu_upload").default(false),
  sickFoodAccess: boolean("sick_food_access").default(false),
  leaveApplicationAccess: boolean("leave_application_access").default(false),
  grievanceAccess: boolean("grievance_access").default(false),
  adminAccess: boolean("admin_access").default(false), // can view all bookings/applications
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Sick food bookings table
export const sickFoodBookings = pgTable("sick_food_bookings", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  date: timestamp("date").notNull(),
  mealType: varchar("meal_type").notNull(),
  specialRequirements: text("special_requirements"),
  roomNumber: varchar("room_number").notNull(),
  status: varchar("status").default("pending"), // pending, approved, rejected
  createdAt: timestamp("created_at").defaultNow(),
});

// Hostel leave applications table
export const hostelLeave = pgTable("hostel_leave", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  reason: text("reason").notNull(),
  emergencyContact: varchar("emergency_contact").notNull(),
  roomNumber: varchar("room_number").notNull(),
  status: varchar("status").default("pending"), // pending, approved, rejected
  approvalToken: varchar("approval_token"), // for email approval links
  tokenExpiry: timestamp("token_expiry"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Grievances table
export const grievances = pgTable("grievances", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  roomNumber: varchar("room_number").notNull(),
  category: varchar("category").notNull(), // Mess, IT, Hostel, Other
  description: text("description").notNull(),
  status: varchar("status").default("pending"), // pending, in_progress, resolved
  resolvedAt: timestamp("resolved_at"),
  adminNotes: text("admin_notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  announcements: many(announcements),
  events: many(events),
  eventRsvps: many(eventRsvps),
  communityPosts: many(communityPosts),
  communityVotes: many(communityVotes),
  communityReplies: many(communityReplies),
  communityAnnouncements: many(communityAnnouncements),
  sickFoodBookings: many(sickFoodBookings),
  hostelLeave: many(hostelLeave),
  grievances: many(grievances),
}));

export const announcementsRelations = relations(announcements, ({ one }) => ({
  author: one(users, {
    fields: [announcements.authorId],
    references: [users.id],
  }),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  author: one(users, {
    fields: [events.authorId],
    references: [users.id],
  }),
  rsvps: many(eventRsvps),
}));

export const eventRsvpsRelations = relations(eventRsvps, ({ one }) => ({
  event: one(events, {
    fields: [eventRsvps.eventId],
    references: [events.id],
  }),
  user: one(users, {
    fields: [eventRsvps.userId],
    references: [users.id],
  }),
}));

// Community Board Relations
export const communityPostsRelations = relations(communityPosts, ({ one, many }) => ({
  author: one(users, {
    fields: [communityPosts.authorId],
    references: [users.id],
  }),
  votes: many(communityVotes),
  replies: many(communityReplies),
}));

export const communityVotesRelations = relations(communityVotes, ({ one }) => ({
  post: one(communityPosts, {
    fields: [communityVotes.postId],
    references: [communityPosts.id],
  }),
  reply: one(communityReplies, {
    fields: [communityVotes.replyId],
    references: [communityReplies.id],
  }),
  user: one(users, {
    fields: [communityVotes.userId],
    references: [users.id],
  }),
}));

export const communityRepliesRelations = relations(communityReplies, ({ one, many }) => ({
  post: one(communityPosts, {
    fields: [communityReplies.postId],
    references: [communityPosts.id],
  }),
  author: one(users, {
    fields: [communityReplies.authorId],
    references: [users.id],
  }),
  votes: many(communityVotes),
}));

export const communityAnnouncementsRelations = relations(communityAnnouncements, ({ one }) => ({
  author: one(users, {
    fields: [communityAnnouncements.authorId],
    references: [users.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertAnnouncementSchema = createInsertSchema(announcements).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEventSchema = createInsertSchema(events).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEventRsvpSchema = createInsertSchema(eventRsvps).omit({
  id: true,
  createdAt: true,
});

// Community Board Insert Schemas
export const insertCommunityPostSchema = createInsertSchema(communityPosts).omit({
  id: true,
  score: true,
  isDeleted: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCommunityVoteSchema = createInsertSchema(communityVotes).omit({
  id: true,
  createdAt: true,
});

export const insertCommunityReplySchema = createInsertSchema(communityReplies).omit({
  id: true,
  score: true,
  isDeleted: true,
  createdAt: true,
});

export const insertCommunityAnnouncementSchema = createInsertSchema(communityAnnouncements).omit({
  id: true,
  isDeleted: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSickFoodBookingSchema = createInsertSchema(sickFoodBookings).omit({
  id: true,
  createdAt: true,
});

export const insertHostelLeaveSchema = createInsertSchema(hostelLeave).omit({
  id: true,
  createdAt: true,
  approvalToken: true,
  tokenExpiry: true,
});

export const insertGrievanceSchema = createInsertSchema(grievances).omit({
  id: true,
  createdAt: true,
  resolvedAt: true,
  adminNotes: true,
});

export const insertWeeklyMenuSchema = createInsertSchema(weeklyMenu).omit({
  id: true,
  uploadedAt: true,
  updatedAt: true,
});

export const insertAmenitiesPermissionsSchema = createInsertSchema(amenitiesPermissions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Student directory table - stores approved students who can log in
export const studentDirectory = pgTable("student_directory", {
  id: serial("id").primaryKey(),
  email: varchar("email").notNull().unique(),
  batch: varchar("batch").notNull(),
  section: varchar("section").notNull(),
  uploadedBy: varchar("uploaded_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Student upload audit log
export const studentUploadLogs = pgTable("student_upload_logs", {
  id: serial("id").primaryKey(),
  adminUserId: varchar("admin_user_id").notNull().references(() => users.id),
  batchName: varchar("batch_name").notNull(),
  fileName: varchar("file_name").notNull(),
  sheetsProcessed: integer("sheets_processed").notNull(),
  studentsProcessed: integer("students_processed").notNull(),
  sectionsCreated: text("sections_created").array().notNull(), // Array of section names
  uploadTimestamp: timestamp("upload_timestamp").defaultNow(),
});

// Student directory schemas
export const insertStudentDirectorySchema = createInsertSchema(studentDirectory).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStudentUploadLogSchema = createInsertSchema(studentUploadLogs).omit({
  id: true,
  uploadTimestamp: true,
});

// Types
export type UpsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertStudentDirectory = z.infer<typeof insertStudentDirectorySchema>;
export type StudentDirectory = typeof studentDirectory.$inferSelect;
export type InsertStudentUploadLog = z.infer<typeof insertStudentUploadLogSchema>;
export type StudentUploadLog = typeof studentUploadLogs.$inferSelect;

// Google Drive gallery folders
export const galleryFolders = pgTable("gallery_folders", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: varchar("category").notNull(), // Events, Celebrations, Competitions, Academic
  driveUrl: text("drive_url").notNull(), // Google Drive iframe embed URL
  description: text("description"),
  isPublic: boolean("is_public").default(true),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type InsertGalleryFolder = typeof galleryFolders.$inferInsert;
export type GalleryFolder = typeof galleryFolders.$inferSelect;
export type InsertAnnouncement = z.infer<typeof insertAnnouncementSchema>;
export type Announcement = typeof announcements.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof events.$inferSelect;
export type InsertEventRsvp = z.infer<typeof insertEventRsvpSchema>;
export type EventRsvp = typeof eventRsvps.$inferSelect;
// Community Board Types
export type InsertCommunityPost = z.infer<typeof insertCommunityPostSchema>;
export type CommunityPost = typeof communityPosts.$inferSelect;
export type InsertCommunityVote = z.infer<typeof insertCommunityVoteSchema>;
export type CommunityVote = typeof communityVotes.$inferSelect;
export type InsertCommunityReply = z.infer<typeof insertCommunityReplySchema>;
export type CommunityReply = typeof communityReplies.$inferSelect;
export type InsertCommunityAnnouncement = z.infer<typeof insertCommunityAnnouncementSchema>;
export type CommunityAnnouncement = typeof communityAnnouncements.$inferSelect;
export type InsertSickFoodBooking = z.infer<typeof insertSickFoodBookingSchema>;
export type SickFoodBooking = typeof sickFoodBookings.$inferSelect;
export type InsertHostelLeave = z.infer<typeof insertHostelLeaveSchema>;
export type HostelLeave = typeof hostelLeave.$inferSelect;
export type InsertGrievance = z.infer<typeof insertGrievanceSchema>;
export type Grievance = typeof grievances.$inferSelect;
export type WeeklyMenu = typeof weeklyMenu.$inferSelect;
export type InsertWeeklyMenu = z.infer<typeof insertWeeklyMenuSchema>;
export type AmenitiesPermissions = typeof amenitiesPermissions.$inferSelect;
export type InsertAmenitiesPermissions = z.infer<typeof insertAmenitiesPermissionsSchema>;
