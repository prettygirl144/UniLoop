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
  numeric,
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

// Student directory table - stores approved students who can log in (moved before users table)
export const studentDirectory = pgTable("student_directory", {
  id: serial("id").primaryKey(),
  email: varchar("email").notNull().unique(),
  batch: varchar("batch").notNull(),
  section: varchar("section").notNull(),
  rollNumber: varchar("roll_number"), // Optional secondary identifier
  uploadedBy: varchar("uploaded_by").notNull(), // Will be a user ID but not a foreign key due to circular refs
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User storage table (mandatory for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role").default("student").notNull(), // student, admin, committee_club, staff
  permissions: jsonb("permissions").$type<{
    calendar?: boolean;
    attendance?: boolean;
    gallery?: boolean;
    forumMod?: boolean;
    diningHostel?: boolean;
    postCreation?: boolean;
    triathlon?: boolean;
    manageStudents?: boolean;
    // Amenities granular permissions
    sickFoodAccess?: boolean;
    leaveApplicationAccess?: boolean;
    grievanceAccess?: boolean;
    menuUpload?: boolean;
  }>().default({}),
  accountType: varchar("account_type").default("primary"), // primary, alternate
  linkedAccountId: varchar("linked_account_id"), // References primary account for alternates
  isActive: boolean("is_active").default(true),
  // Student directory linking
  directoryId: integer("directory_id").references(() => studentDirectory.id), // Link to student directory record
  // Legacy fields kept for backward compatibility
  batch: varchar("batch"), // From admin upload
  section: varchar("section"), // Sheet name from Excel
  rollNumber: varchar("roll_number"), // Optional secondary identifier for students
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
  startTime: varchar("start_time").notNull(), // HH:MM format
  endTime: varchar("end_time").notNull(), // HH:MM format
  location: text("location").notNull(),
  hostCommittee: text("host_committee").notNull(),
  category: varchar("category").notNull(),
  rsvpEnabled: boolean("rsvp_enabled").default(false),
  isMandatory: boolean("is_mandatory").default(false),
  targetBatches: text("target_batches").array().default([]), // Array of batches
  targetSections: text("target_sections").array().default([]), // Array of sections
  targetBatchSections: text("target_batch_sections").array().default([]), // Array of "batch::section" pairs
  rollNumberAttendees: jsonb("roll_number_attendees").$type<string[]>().default([]), // Array of email addresses from roll number upload
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

// Legacy attendance table (keeping for backward compatibility)
export const attendance = pgTable("attendance", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => events.id),
  attendees: text("attendees").array().notNull(),
  markedBy: varchar("marked_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Attendance Sheets - multiple sheets per event (one per batch-section pair)
export const attendanceSheets = pgTable("attendance_sheets", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => events.id),
  batch: varchar("batch").notNull(),
  section: varchar("section").notNull(),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique("unique_event_batch_section").on(table.eventId, table.batch, table.section),
]);

// Attendance Records - individual student records within a sheet
export const attendanceRecords = pgTable("attendance_records", {
  id: serial("id").primaryKey(),
  sheetId: integer("sheet_id").notNull().references(() => attendanceSheets.id, { onDelete: "cascade" }),
  studentEmail: varchar("student_email").notNull(),
  studentName: varchar("student_name").notNull(),
  rollNumber: varchar("roll_number"),
  status: varchar("status").default("UNMARKED").notNull(), // UNMARKED, PRESENT, ABSENT, LATE
  note: text("note"),
  markedBy: varchar("marked_by").references(() => users.id),
  markedAt: timestamp("marked_at"),
  isArchived: boolean("is_archived").default(false), // for sync functionality
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique("unique_sheet_student").on(table.sheetId, table.studentEmail),
]);

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
  phoneNumber: varchar("phone_number").notNull(),
  parcelMode: varchar("parcel_mode").notNull().default("dine_in"), // 'dine_in' | 'takeaway'
  // Removed status field - sick food bookings are always confirmed when created
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
  // Google Form integration fields
  email: varchar("email").notNull(),
  leaveCity: varchar("leave_city").notNull(),
  correlationId: varchar("correlation_id"),
  googleStatus: jsonb("google_status").$type<{
    ok: boolean;
    statusCode?: number;
    attempts: number;
    lastTriedAt?: string;
    latencyMs?: number;
    error?: string;
  }>().default({ ok: false, attempts: 0 }),
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
  attendanceSheet: one(attendanceSheets, {
    fields: [events.id],
    references: [attendanceSheets.eventId],
  }),
}));

export const attendanceSheetsRelations = relations(attendanceSheets, ({ one, many }) => ({
  event: one(events, {
    fields: [attendanceSheets.eventId],
    references: [events.id],
  }),
  createdBy: one(users, {
    fields: [attendanceSheets.createdBy],
    references: [users.id],
  }),
  records: many(attendanceRecords),
}));

export const attendanceRecordsRelations = relations(attendanceRecords, ({ one }) => ({
  sheet: one(attendanceSheets, {
    fields: [attendanceRecords.sheetId],
    references: [attendanceSheets.id],
  }),
  markedBy: one(users, {
    fields: [attendanceRecords.markedBy],
    references: [users.id],
  }),
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

export const insertAttendanceSheetSchema = createInsertSchema(attendanceSheets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAttendanceRecordSchema = createInsertSchema(attendanceRecords).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
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
}).extend({
  date: z.string()
    .refine((dateStr) => {
      const date = new Date(dateStr);
      return !isNaN(date.getTime());
    }, {
      message: "Invalid date format",
    })
    .transform((dateStr) => new Date(dateStr)),
});

export const insertHostelLeaveSchema = createInsertSchema(hostelLeave).omit({
  id: true,
  createdAt: true,
  approvalToken: true,
  tokenExpiry: true,
  correlationId: true, // Generated server-side
  googleStatus: true, // Managed server-side
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

// Batch-Section relationship table to track which sections belong to which batches
export const batchSections = pgTable("batch_sections", {
  id: serial("id").primaryKey(),
  batch: varchar("batch").notNull(),
  section: varchar("section").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  uniqueBatchSection: unique().on(table.batch, table.section),
}));

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

export const insertBatchSectionSchema = createInsertSchema(batchSections).omit({
  id: true,
  createdAt: true,
});

// Types
export type UpsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertStudentDirectory = z.infer<typeof insertStudentDirectorySchema>;
export type StudentDirectory = typeof studentDirectory.$inferSelect;
export type InsertStudentUploadLog = z.infer<typeof insertStudentUploadLogSchema>;
export type StudentUploadLog = typeof studentUploadLogs.$inferSelect;
export type InsertBatchSection = z.infer<typeof insertBatchSectionSchema>;
export type BatchSection = typeof batchSections.$inferSelect;

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

// Extended types for community posts and replies with vote counts
export type CommunityPostWithVotes = CommunityPost & {
  upvotes: number;
  downvotes: number;
};

export type CommunityReplyWithVotes = CommunityReply & {
  upvotes: number;
  downvotes: number;
};
export type Announcement = typeof announcements.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof events.$inferSelect;
export type InsertEventRsvp = z.infer<typeof insertEventRsvpSchema>;
export type EventRsvp = typeof eventRsvps.$inferSelect;
export type InsertAttendanceSheet = z.infer<typeof insertAttendanceSheetSchema>;
export type AttendanceSheet = typeof attendanceSheets.$inferSelect;
export type InsertAttendanceRecord = z.infer<typeof insertAttendanceRecordSchema>;
export type AttendanceRecord = typeof attendanceRecords.$inferSelect;
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

// Management Triathlon tables
export const triathlonTeams = pgTable("triathlon_teams", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  logoUrl: text("logo_url"), // URL to team logo image
  academicPoints: numeric("academic_points", { precision: 10, scale: 2 }).default("0").notNull(),
  culturalPoints: numeric("cultural_points", { precision: 10, scale: 2 }).default("0").notNull(),
  sportsPoints: numeric("sports_points", { precision: 10, scale: 2 }).default("0").notNull(),
  surprisePoints: numeric("surprise_points", { precision: 10, scale: 2 }).default("0").notNull(),
  penaltyPoints: numeric("penalty_points", { precision: 10, scale: 2 }).default("0").notNull(),
  totalPoints: numeric("total_points", { precision: 10, scale: 2 }).default("0").notNull(), // Computed field
  rank: integer("rank").default(0).notNull(), // Computed field - keep as integer for ranking
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const triathlonPointHistory = pgTable("triathlon_point_history", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull().references(() => triathlonTeams.id, { onDelete: "cascade" }),
  category: varchar("category", { length: 20 }).notNull(), // academic, cultural, sports, surprise, penalty
  pointChange: numeric("point_change", { precision: 10, scale: 2 }).notNull(), // Can be positive or negative
  previousPoints: numeric("previous_points", { precision: 10, scale: 2 }).notNull(),
  newPoints: numeric("new_points", { precision: 10, scale: 2 }).notNull(),
  reason: text("reason"), // Optional description of why points were changed
  changedBy: varchar("changed_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations for triathlon tables
export const triathlonTeamsRelations = relations(triathlonTeams, ({ one, many }) => ({
  creator: one(users, {
    fields: [triathlonTeams.createdBy],
    references: [users.id],
  }),
  pointHistory: many(triathlonPointHistory),
}));

export const triathlonPointHistoryRelations = relations(triathlonPointHistory, ({ one }) => ({
  team: one(triathlonTeams, {
    fields: [triathlonPointHistory.teamId],
    references: [triathlonTeams.id],
  }),
  changedBy: one(users, {
    fields: [triathlonPointHistory.changedBy],
    references: [users.id],
  }),
}));

// Triathlon schemas
export const insertTriathlonTeamSchema = createInsertSchema(triathlonTeams).omit({
  id: true,
  totalPoints: true,
  rank: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTriathlonPointHistorySchema = createInsertSchema(triathlonPointHistory).omit({
  id: true,
  createdAt: true,
});

// Push subscriptions table
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  endpoint: text("endpoint").unique().notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  userEmail: varchar("user_email"), // nullable - can have anonymous subscriptions
  ua: text("ua"), // user agent
  createdAt: timestamp("created_at").defaultNow(),
  lastSeenAt: timestamp("last_seen_at").defaultNow(),
});

// Smart Notifications Schema
export const smartNotifications = pgTable("smart_notifications", {
  id: serial("id").primaryKey(),
  recipientUserId: varchar("recipient_user_id").notNull().references(() => users.id),
  title: varchar("title").notNull(),
  content: text("content").notNull(),
  category: varchar("category").notNull(), // announcement, event, calendar, forum, amenities, system
  priority: varchar("priority").notNull().default("medium"), // critical, high, medium, low
  contextualData: jsonb("contextual_data").$type<{
    entityType?: string; // event, announcement, post, etc.
    entityId?: number;
    actionRequired?: boolean;
    deadline?: string;
    batchTargeted?: string[];
    sectionTargeted?: string[];
    relatedUser?: string;
    location?: string;
    urgencyScore?: number;
  }>().default({}),
  status: varchar("status").notNull().default("pending"), // pending, sent, delivered, read, dismissed, failed
  scheduledFor: timestamp("scheduled_for"),
  sentAt: timestamp("sent_at"),
  readAt: timestamp("read_at"),
  dismissedAt: timestamp("dismissed_at"),
  deliveryChannels: text("delivery_channels").array().default([]), // push, email, in_app
  metadata: jsonb("metadata").$type<{
    source?: string;
    groupId?: string;
    batchId?: string;
    retryCount?: number;
    engagementScore?: number;
    personalizedContent?: string;
  }>().default({}),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Notification Preferences Schema
export const notificationPreferences = pgTable("notification_preferences", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id).unique(),
  globalSettings: jsonb("global_settings").$type<{
    enabled: boolean;
    quietHours: { start: string; end: string };
    maxDailyNotifications: number;
    batchDelay: number; // minutes to wait before batching
  }>().default({
    enabled: true,
    quietHours: { start: "22:00", end: "08:00" },
    maxDailyNotifications: 20,
    batchDelay: 15
  }),
  categoryPreferences: jsonb("category_preferences").$type<{
    announcement: { enabled: boolean; priority: string; channels: string[] };
    event: { enabled: boolean; priority: string; channels: string[] };
    calendar: { enabled: boolean; priority: string; channels: string[] };
    forum: { enabled: boolean; priority: string; channels: string[] };
    amenities: { enabled: boolean; priority: string; channels: string[] };
    system: { enabled: boolean; priority: string; channels: string[] };
  }>().default({
    announcement: { enabled: true, priority: "high", channels: ["push", "in_app"] },
    event: { enabled: true, priority: "high", channels: ["push", "in_app"] },
    calendar: { enabled: true, priority: "medium", channels: ["push", "in_app"] },
    forum: { enabled: true, priority: "low", channels: ["in_app"] },
    amenities: { enabled: true, priority: "medium", channels: ["push", "in_app"] },
    system: { enabled: true, priority: "critical", channels: ["push", "in_app", "email"] }
  }),
  contextualRules: jsonb("contextual_rules").$type<{
    academicHours: boolean; // reduce notifications during class hours
    locationBased: boolean; // campus vs off-campus notifications
    roleSpecific: boolean; // admin vs student notification differences
    eventProximity: boolean; // increase priority for nearby events
    engagementBased: boolean; // adjust based on past engagement
  }>().default({
    academicHours: true,
    locationBased: false,
    roleSpecific: true,
    eventProximity: true,
    engagementBased: true
  }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Notification Analytics Schema
export const notificationAnalytics = pgTable("notification_analytics", {
  id: serial("id").primaryKey(),
  notificationId: integer("notification_id").notNull().references(() => smartNotifications.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  event: varchar("event").notNull(), // sent, delivered, opened, clicked, dismissed, timeout
  timestamp: timestamp("timestamp").defaultNow(),
  metadata: jsonb("metadata").$type<{
    channel?: string;
    deviceType?: string;
    location?: string;
    sessionId?: string;
    engagementTime?: number;
    clickTarget?: string;
  }>().default({}),
});

// Notification Batches Schema for grouping related notifications
export const notificationBatches = pgTable("notification_batches", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  title: varchar("title").notNull(),
  summary: text("summary"),
  notificationCount: integer("notification_count").notNull().default(0),
  priority: varchar("priority").notNull().default("medium"),
  status: varchar("status").notNull().default("pending"), // pending, sent, delivered, read
  scheduledFor: timestamp("scheduled_for"),
  sentAt: timestamp("sent_at"),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Push subscription relations
export const pushSubscriptionsRelations = relations(pushSubscriptions, ({ one }) => ({
  user: one(users, {
    fields: [pushSubscriptions.userEmail],
    references: [users.email],
  }),
}));

// Smart Notification relations
export const smartNotificationsRelations = relations(smartNotifications, ({ one, many }) => ({
  recipient: one(users, {
    fields: [smartNotifications.recipientUserId],
    references: [users.id],
  }),
  analytics: many(notificationAnalytics),
}));

export const notificationPreferencesRelations = relations(notificationPreferences, ({ one }) => ({
  user: one(users, {
    fields: [notificationPreferences.userId],
    references: [users.id],
  }),
}));

export const notificationAnalyticsRelations = relations(notificationAnalytics, ({ one }) => ({
  notification: one(smartNotifications, {
    fields: [notificationAnalytics.notificationId],
    references: [smartNotifications.id],
  }),
  user: one(users, {
    fields: [notificationAnalytics.userId],
    references: [users.id],
  }),
}));

export const notificationBatchesRelations = relations(notificationBatches, ({ one }) => ({
  user: one(users, {
    fields: [notificationBatches.userId],
    references: [users.id],
  }),
}));

// Push subscription schemas
export const insertPushSubscriptionSchema = createInsertSchema(pushSubscriptions).omit({
  id: true,
  createdAt: true,
  lastSeenAt: true,
});

// Smart Notification schemas
export const insertSmartNotificationSchema = createInsertSchema(smartNotifications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  sentAt: true,
  readAt: true,
  dismissedAt: true,
});

export const insertNotificationPreferencesSchema = createInsertSchema(notificationPreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertNotificationAnalyticsSchema = createInsertSchema(notificationAnalytics).omit({
  id: true,
  timestamp: true,
});

export const insertNotificationBatchSchema = createInsertSchema(notificationBatches).omit({
  id: true,
  createdAt: true,
  sentAt: true,
  readAt: true,
});

// Push subscription types
export type InsertPushSubscription = z.infer<typeof insertPushSubscriptionSchema>;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;

// Smart Notification types
export type InsertSmartNotification = z.infer<typeof insertSmartNotificationSchema>;
export type SmartNotification = typeof smartNotifications.$inferSelect;
export type InsertNotificationPreferences = z.infer<typeof insertNotificationPreferencesSchema>;
export type NotificationPreferences = typeof notificationPreferences.$inferSelect;
export type InsertNotificationAnalytics = z.infer<typeof insertNotificationAnalyticsSchema>;
export type NotificationAnalytics = typeof notificationAnalytics.$inferSelect;
export type InsertNotificationBatch = z.infer<typeof insertNotificationBatchSchema>;
export type NotificationBatch = typeof notificationBatches.$inferSelect;

// Triathlon types
export type InsertTriathlonTeam = z.infer<typeof insertTriathlonTeamSchema>;
export type TriathlonTeam = typeof triathlonTeams.$inferSelect;
export type InsertTriathlonPointHistory = z.infer<typeof insertTriathlonPointHistorySchema>;
export type TriathlonPointHistory = typeof triathlonPointHistory.$inferSelect;
