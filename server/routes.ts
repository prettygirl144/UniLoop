import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import {
  insertAnnouncementSchema,
  insertEventSchema,
  insertEventRsvpSchema,
  insertForumPostSchema,
  insertForumReactionSchema,
  insertSickFoodBookingSchema,
  insertHostelLeaveSchema,
  insertGrievanceSchema,
} from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Announcements routes
  app.get('/api/announcements', async (req, res) => {
    try {
      const announcements = await storage.getAnnouncements();
      res.json(announcements);
    } catch (error) {
      console.error("Error fetching announcements:", error);
      res.status(500).json({ message: "Failed to fetch announcements" });
    }
  });

  app.post('/api/announcements', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user?.permissions?.postCreation && user?.role !== 'admin') {
        return res.status(403).json({ message: "No permission to create announcements" });
      }

      const announcementData = insertAnnouncementSchema.parse({
        ...req.body,
        authorId: userId,
      });
      
      const announcement = await storage.createAnnouncement(announcementData);
      res.json(announcement);
    } catch (error) {
      console.error("Error creating announcement:", error);
      res.status(500).json({ message: "Failed to create announcement" });
    }
  });

  // Events routes
  app.get('/api/events', async (req, res) => {
    try {
      const events = await storage.getEvents();
      res.json(events);
    } catch (error) {
      console.error("Error fetching events:", error);
      res.status(500).json({ message: "Failed to fetch events" });
    }
  });

  app.post('/api/events', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user?.permissions?.calendar && user?.role !== 'admin') {
        return res.status(403).json({ message: "No permission to create events" });
      }

      const eventData = insertEventSchema.parse({
        ...req.body,
        authorId: userId,
        date: new Date(req.body.date),
      });
      
      const event = await storage.createEvent(eventData);
      res.json(event);
    } catch (error) {
      console.error("Error creating event:", error);
      res.status(500).json({ message: "Failed to create event" });
    }
  });

  // Event RSVP routes
  app.post('/api/events/:id/rsvp', isAuthenticated, async (req: any, res) => {
    try {
      const eventId = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      
      const rsvpData = insertEventRsvpSchema.parse({
        eventId,
        userId,
        status: req.body.status || 'attending',
      });
      
      const rsvp = await storage.rsvpToEvent(rsvpData);
      res.json(rsvp);
    } catch (error) {
      console.error("Error creating RSVP:", error);
      res.status(500).json({ message: "Failed to RSVP to event" });
    }
  });

  app.get('/api/user/rsvps', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const rsvps = await storage.getUserRsvps(userId);
      res.json(rsvps);
    } catch (error) {
      console.error("Error fetching user RSVPs:", error);
      res.status(500).json({ message: "Failed to fetch RSVPs" });
    }
  });

  // Forum routes
  app.get('/api/forum/posts', async (req, res) => {
    try {
      const posts = await storage.getForumPosts();
      res.json(posts);
    } catch (error) {
      console.error("Error fetching forum posts:", error);
      res.status(500).json({ message: "Failed to fetch forum posts" });
    }
  });

  app.post('/api/forum/posts', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      const postData = insertForumPostSchema.parse({
        ...req.body,
        authorId: req.body.isAnonymous ? null : userId,
      });
      
      const post = await storage.createForumPost(postData);
      res.json(post);
    } catch (error) {
      console.error("Error creating forum post:", error);
      res.status(500).json({ message: "Failed to create forum post" });
    }
  });

  app.post('/api/forum/posts/:id/react', isAuthenticated, async (req: any, res) => {
    try {
      const postId = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      
      const reactionData = insertForumReactionSchema.parse({
        postId,
        userId,
        type: req.body.type,
      });
      
      await storage.reactToPost(reactionData);
      const reactions = await storage.getPostReactions(postId);
      res.json(reactions);
    } catch (error) {
      console.error("Error reacting to post:", error);
      res.status(500).json({ message: "Failed to react to post" });
    }
  });

  app.get('/api/forum/posts/:id/reactions', async (req, res) => {
    try {
      const postId = parseInt(req.params.id);
      const reactions = await storage.getPostReactions(postId);
      res.json(reactions);
    } catch (error) {
      console.error("Error fetching reactions:", error);
      res.status(500).json({ message: "Failed to fetch reactions" });
    }
  });

  // Dining routes
  app.get('/api/dining/menu', async (req, res) => {
    try {
      const menu = await storage.getTodaysMenu();
      res.json(menu);
    } catch (error) {
      console.error("Error fetching menu:", error);
      res.status(500).json({ message: "Failed to fetch menu" });
    }
  });

  app.post('/api/dining/sick-food', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      const bookingData = insertSickFoodBookingSchema.parse({
        ...req.body,
        userId,
        date: new Date(req.body.date),
      });
      
      const booking = await storage.bookSickFood(bookingData);
      res.json(booking);
    } catch (error) {
      console.error("Error booking sick food:", error);
      res.status(500).json({ message: "Failed to book sick food" });
    }
  });

  app.post('/api/hostel/leave', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      const leaveData = insertHostelLeaveSchema.parse({
        ...req.body,
        userId,
        startDate: new Date(req.body.startDate),
        endDate: new Date(req.body.endDate),
      });
      
      const leave = await storage.applyForLeave(leaveData);
      res.json(leave);
    } catch (error) {
      console.error("Error applying for leave:", error);
      res.status(500).json({ message: "Failed to apply for leave" });
    }
  });

  app.post('/api/grievances', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      const grievanceData = insertGrievanceSchema.parse({
        ...req.body,
        userId,
      });
      
      const grievance = await storage.submitGrievance(grievanceData);
      res.json(grievance);
    } catch (error) {
      console.error("Error submitting grievance:", error);
      res.status(500).json({ message: "Failed to submit grievance" });
    }
  });

  // Attendance routes
  app.post('/api/attendance', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user?.permissions?.attendance && user?.role !== 'admin') {
        return res.status(403).json({ message: "No permission to mark attendance" });
      }

      const { eventId, attendees } = req.body;
      await storage.saveAttendance(eventId, attendees, userId);
      res.json({ message: "Attendance saved successfully" });
    } catch (error) {
      console.error("Error saving attendance:", error);
      res.status(500).json({ message: "Failed to save attendance" });
    }
  });

  // Directory routes
  app.get('/api/directory/users', isAuthenticated, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      // Remove sensitive information
      const publicUsers = users.map(user => ({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImageUrl: user.profileImageUrl,
      }));
      res.json(publicUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Admin routes
  app.put('/api/admin/users/:id/permissions', isAuthenticated, async (req: any, res) => {
    try {
      const adminUserId = req.user.claims.sub;
      const adminUser = await storage.getUser(adminUserId);
      
      if (adminUser?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const targetUserId = req.params.id;
      const { permissions } = req.body;
      
      const updatedUser = await storage.updateUserPermissions(targetUserId, permissions);
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating permissions:", error);
      res.status(500).json({ message: "Failed to update permissions" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
