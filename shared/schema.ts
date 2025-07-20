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

// Forum posts table
export const forumPosts = pgTable("forum_posts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  authorId: varchar("author_id").references(() => users.id),
  isAnonymous: boolean("is_anonymous").default(false),
  imageUrl: text("image_url"),
  category: varchar("category").default("general"), // questions, discussions, events, general
  isHidden: boolean("is_hidden").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Forum reactions table
export const forumReactions = pgTable("forum_reactions", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull().references(() => forumPosts.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: varchar("type").notNull(), // like, heart, laugh
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("unique_post_user_reaction").on(table.postId, table.userId)
]);

// Forum comments table
export const forumComments = pgTable("forum_comments", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull().references(() => forumPosts.id),
  authorId: varchar("author_id").references(() => users.id),
  content: text("content").notNull(),
  isAnonymous: boolean("is_anonymous").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Dining menu table
export const diningMenu = pgTable("dining_menu", {
  id: serial("id").primaryKey(),
  date: timestamp("date").notNull(),
  mealType: varchar("meal_type").notNull(), // breakfast, lunch, dinner
  items: text("items").array().notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Sick food bookings table
export const sickFoodBookings = pgTable("sick_food_bookings", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  date: timestamp("date").notNull(),
  mealType: varchar("meal_type").notNull(),
  specialRequirements: text("special_requirements"),
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
  status: varchar("status").default("pending"), // pending, approved, rejected
  createdAt: timestamp("created_at").defaultNow(),
});

// Grievances table
export const grievances = pgTable("grievances", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: varchar("type").notNull(), // food_quality, hostel_maintenance, other
  description: text("description").notNull(),
  category: varchar("category"), // undercooked, item_missing, etc.
  status: varchar("status").default("pending"), // pending, in_progress, resolved
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  announcements: many(announcements),
  events: many(events),
  eventRsvps: many(eventRsvps),
  forumPosts: many(forumPosts),
  forumReactions: many(forumReactions),
  forumComments: many(forumComments),
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

export const forumPostsRelations = relations(forumPosts, ({ one, many }) => ({
  author: one(users, {
    fields: [forumPosts.authorId],
    references: [users.id],
  }),
  reactions: many(forumReactions),
  comments: many(forumComments),
}));

export const forumReactionsRelations = relations(forumReactions, ({ one }) => ({
  post: one(forumPosts, {
    fields: [forumReactions.postId],
    references: [forumPosts.id],
  }),
  user: one(users, {
    fields: [forumReactions.userId],
    references: [users.id],
  }),
}));

export const forumCommentsRelations = relations(forumComments, ({ one }) => ({
  post: one(forumPosts, {
    fields: [forumComments.postId],
    references: [forumPosts.id],
  }),
  author: one(users, {
    fields: [forumComments.authorId],
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

export const insertForumPostSchema = createInsertSchema(forumPosts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertForumReactionSchema = createInsertSchema(forumReactions).omit({
  id: true,
  createdAt: true,
});

export const insertSickFoodBookingSchema = createInsertSchema(sickFoodBookings).omit({
  id: true,
  createdAt: true,
});

export const insertHostelLeaveSchema = createInsertSchema(hostelLeave).omit({
  id: true,
  createdAt: true,
});

export const insertGrievanceSchema = createInsertSchema(grievances).omit({
  id: true,
  createdAt: true,
});

// Types
export type UpsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertAnnouncement = z.infer<typeof insertAnnouncementSchema>;
export type Announcement = typeof announcements.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof events.$inferSelect;
export type InsertEventRsvp = z.infer<typeof insertEventRsvpSchema>;
export type EventRsvp = typeof eventRsvps.$inferSelect;
export type InsertForumPost = z.infer<typeof insertForumPostSchema>;
export type ForumPost = typeof forumPosts.$inferSelect;
export type InsertForumReaction = z.infer<typeof insertForumReactionSchema>;
export type ForumReaction = typeof forumReactions.$inferSelect;
export type InsertSickFoodBooking = z.infer<typeof insertSickFoodBookingSchema>;
export type SickFoodBooking = typeof sickFoodBookings.$inferSelect;
export type InsertHostelLeave = z.infer<typeof insertHostelLeaveSchema>;
export type HostelLeave = typeof hostelLeave.$inferSelect;
export type InsertGrievance = z.infer<typeof insertGrievanceSchema>;
export type Grievance = typeof grievances.$inferSelect;
