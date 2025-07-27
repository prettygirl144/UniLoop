import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
// Replit auth removed - using Auth0 only
import { checkAuth, handleAuthError, extractUser } from "./auth0Config";
import { registerGalleryRoutes } from "./routes/galleryRoutes";
import {
  insertAnnouncementSchema,
  insertEventSchema,
  insertEventRsvpSchema,
  insertCommunityPostSchema,
  insertCommunityVoteSchema,
  insertCommunityReplySchema,
  insertCommunityAnnouncementSchema,
  insertSickFoodBookingSchema,
  insertHostelLeaveSchema,
  insertGrievanceSchema,
  insertWeeklyMenuSchema,
  InsertGalleryFolder,
  insertStudentDirectorySchema,
  insertStudentUploadLogSchema,
} from "@shared/schema";
import { z } from "zod";
import { parseExcelMenu } from "./menuParser";
import { parseStudentExcel, parseRollNumbersForEvent } from "./studentParser";
import multer from "multer";
import path from "path";
import fs from "fs";

// Configure multer for file uploads
const multerStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Ensure uploads directory exists
    if (!fs.existsSync('uploads')) {
      fs.mkdirSync('uploads', { recursive: true });
    }
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    // Generate unique filename
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const filename = `team-logo-${timestamp}${ext}`;
    console.log("Generated filename:", filename);
    cb(null, filename);
  }
});

const upload = multer({
  storage: multerStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Helper function to check if a date is within one hour
function isWithinOneHour(dateString: string): boolean {
  const createdAt = new Date(dateString);
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  return createdAt >= oneHourAgo;
}

// Authorization middleware
function authorize(permission?: string) {
  return async (req: any, res: any, next: any) => {
    const sessionUser = req.session?.user;
    if (!sessionUser) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    const user = await storage.getUser(sessionUser.id);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }
    
    // Admin bypasses all permission checks
    if (user.role === 'admin') {
      req.currentUser = user;
      return next();
    }
    
    // If specific permission required, check it
    if (permission && (!user.permissions || !(user.permissions as any)[permission])) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    
    req.currentUser = user;
    next();
  };
}

// Admin-only middleware
function adminOnly() {
  return async (req: any, res: any, next: any) => {
    const sessionUser = req.session?.user;
    if (!sessionUser) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    const user = await storage.getUser(sessionUser.id);
    
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: "Admin access required" });
    }
    
    req.currentUser = user;
    next();
  };
}

export async function registerRoutes(app: Express): Promise<Server> {
  // CRITICAL: Serve static files FIRST for PWA installability
  const expressStaticImport = await import('express');
  app.use(expressStaticImport.default.static(path.resolve(import.meta.dirname, '..', 'client', 'public')));
  
  // Session middleware for Auth0
  const session = await import('express-session');
  app.use(session.default({
    secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // Set to true in production with HTTPS
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  }));

  // Add Auth0 routes
  const auth0Routes = (await import('./auth0Routes')).default;
  app.use('/api', auth0Routes);
  
  // Note: /api/logout is handled by Auth0 routes (auth0Routes.ts)

  // Auth0 authentication error handler
  app.use(handleAuthError);

  // Auth routes handled by auth0Routes.ts
  // But we need to override the /api/auth/user route to use session data
  app.get('/api/auth/user', (req: any, res) => {
    const sessionUser = req.session?.user;
    
    console.log('Main auth/user route - session user:', sessionUser);
    
    if (!sessionUser) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    // Return complete user information including role and permissions
    res.json({
      id: sessionUser.id,
      email: sessionUser.email,
      firstName: sessionUser.firstName,
      lastName: sessionUser.lastName,
      profileImageUrl: sessionUser.profileImageUrl,
      role: sessionUser.role,
      permissions: sessionUser.permissions,
    });
  });

  // Auth0 user sync endpoint
  app.post('/api/auth0/sync-user', checkAuth, async (req: any, res) => {
    try {
      const userInfo = extractUser(req);
      if (!userInfo) {
        return res.status(401).json({ message: "User not found" });
      }

      const { auth0Id, email, name, picture } = req.body;
      
      const userData = {
        id: auth0Id || userInfo.id,
        email: email || userInfo.email,
        firstName: name?.split(' ')[0] || '',
        lastName: name?.split(' ').slice(1).join(' ') || '',
        profileImageUrl: picture || userInfo.picture,
        role: userInfo.role || 'student',
        permissions: userInfo.permissions || {},
      };

      const user = await storage.upsertUser(userData);
      res.json(user);
    } catch (error) {
      console.error("Error syncing Auth0 user:", error);
      res.status(500).json({ message: "Failed to sync user" });
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

  app.post('/api/announcements', authorize('postCreation'), async (req: any, res) => {
    try {
      const userInfo = extractUser(req);
      const userId = userInfo?.id;
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

  // Roll number parsing endpoint for events
  app.post('/api/events/parse-roll-numbers', multer({ storage: multer.memoryStorage() }).single('file'), checkAuth, async (req: any, res) => {
    try {
      const userInfo = extractUser(req);
      const user = await storage.getUser(userInfo?.id);
      
      if (!user?.permissions?.calendar && user?.role !== 'admin') {
        return res.status(403).json({ message: "No permission to create events" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      console.log('Parsing roll numbers from uploaded file:', req.file.originalname);
      
      // Parse roll numbers from the uploaded file
      const parseResult = parseRollNumbersForEvent(req.file.buffer);
      
      // Now match the roll numbers with existing student records
      const matchedAttendees = [];
      
      for (const attendeeData of parseResult.attendees) {
        const rollNumber = attendeeData.rollNumber;
        
        // Find student by roll number
        const student = await storage.getStudentByRollNumber(rollNumber);
        
        if (student) {
          matchedAttendees.push({
            email: student.email,
            firstName: student.email.split('@')[0] || '', // Use email prefix as firstName if not available
            lastName: '', // StudentDirectory doesn't have lastName, leave empty
            rollNumber: student.rollNumber,
            batch: student.batch,
            section: student.section,
          });
        } else {
          console.log(`No student found for roll number: ${rollNumber}`);
        }
      }
      
      console.log(`Matched ${matchedAttendees.length} students out of ${parseResult.attendees.length} roll numbers`);
      
      res.json({
        attendees: matchedAttendees,
        totalRollNumbers: parseResult.attendees.length,
        matchedCount: matchedAttendees.length,
        message: `Found ${matchedAttendees.length} matching students out of ${parseResult.attendees.length} roll numbers`
      });
      
    } catch (error) {
      console.error("Error parsing roll numbers:", error);
      res.status(500).json({ message: "Failed to parse roll numbers from file" });
    }
  });

  app.post('/api/events', checkAuth, async (req: any, res) => {
    try {
      const userInfo = extractUser(req);
      const userId = userInfo?.id;
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

  // Update existing event
  app.put('/api/events/:id', checkAuth, async (req: any, res) => {
    try {
      const userInfo = extractUser(req);
      const userId = userInfo?.id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const eventId = parseInt(req.params.id);
      const existingEvent = await storage.getEventById(eventId);
      
      if (!existingEvent) {
        return res.status(404).json({ message: 'Event not found' });
      }

      // Check if user can edit this event (owner or admin)
      if (user.role !== 'admin' && existingEvent.authorId !== userId) {
        return res.status(403).json({ message: 'You can only edit events you created' });
      }

      const eventData = insertEventSchema.parse({
        ...req.body,
        authorId: existingEvent.authorId, // Keep the original author
        date: new Date(req.body.date),
      });
      
      const updatedEvent = await storage.updateEvent(eventId, eventData);
      res.json(updatedEvent);
    } catch (error) {
      console.error('Error updating event:', error);
      res.status(500).json({ message: 'Failed to update event' });
    }
  });

  // Delete event
  app.delete('/api/events/:id', checkAuth, async (req: any, res) => {
    try {
      const userInfo = extractUser(req);
      const userId = userInfo?.id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const eventId = parseInt(req.params.id);
      const existingEvent = await storage.getEventById(eventId);
      
      if (!existingEvent) {
        return res.status(404).json({ message: 'Event not found' });
      }

      // Check if user can delete this event (owner or admin)
      if (user.role !== 'admin' && existingEvent.authorId !== userId) {
        return res.status(403).json({ message: 'You can only delete events you created' });
      }
      
      await storage.deleteEvent(eventId);
      res.json({ message: 'Event deleted successfully' });
    } catch (error) {
      console.error('Error deleting event:', error);
      res.status(500).json({ message: 'Failed to delete event' });
    }
  });

  // Get sections for batches
  app.get('/api/batch-sections', checkAuth, async (req: any, res) => {
    try {
      const batches = req.query.batches as string;
      
      if (!batches) {
        return res.json([]);
      }

      const batchArray = batches.split(',').filter(Boolean);
      const sections = await storage.getSectionsForBatches(batchArray);
      res.json(sections);
    } catch (error) {
      console.error('Error fetching batch sections:', error);
      res.status(500).json({ message: 'Failed to fetch sections' });
    }
  });

  // Get all batches
  app.get('/api/batches', checkAuth, async (req: any, res) => {
    try {
      const batches = await storage.getAllBatches();
      res.json(batches);
    } catch (error) {
      console.error('Error fetching batches:', error);
      res.status(500).json({ message: 'Failed to fetch batches' });
    }
  });

  // Event RSVP routes
  app.post('/api/events/:id/rsvp', checkAuth, async (req: any, res) => {
    try {
      const eventId = parseInt(req.params.id);
      const userId = req.session.user.id;
      
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

  app.get('/api/user/rsvps', checkAuth, async (req: any, res) => {
    try {
      const userId = req.session.user.id;
      const rsvps = await storage.getUserRsvps(userId);
      res.json(rsvps);
    } catch (error) {
      console.error("Error fetching user RSVPs:", error);
      res.status(500).json({ message: "Failed to fetch RSVPs" });
    }
  });

  // Community Board routes (Section 1) - Reddit-like functionality
  app.get('/api/community/posts', async (req, res) => {
    try {
      const posts = await storage.getCommunityPosts();
      res.json(posts);
    } catch (error) {
      console.error("Error fetching community posts:", error);
      res.status(500).json({ message: "Failed to fetch community posts" });
    }
  });

  app.post('/api/community/posts', authorize(), async (req: any, res) => {
    try {
      const userId = req.session.user.id;
      const user = req.currentUser;
      
      const postData = insertCommunityPostSchema.parse({
        ...req.body,
        authorId: req.body.isAnonymous ? null : userId,
        authorName: req.body.isAnonymous ? null : (user?.firstName + ' ' + user?.lastName || user?.email || 'Anonymous'),
        mediaUrls: req.body.mediaUrls || [],
      });
      
      const post = await storage.createCommunityPost(postData);
      res.json(post);
    } catch (error) {
      console.error("Error creating community post:", error);
      res.status(500).json({ message: "Failed to create community post" });
    }
  });

  app.post('/api/community/posts/:id/vote', authorize(), async (req: any, res) => {
    try {
      const postId = parseInt(req.params.id);
      const userId = req.session.user.id;
      
      const voteData = insertCommunityVoteSchema.parse({
        postId,
        userId,
        voteType: req.body.voteType, // 'upvote' or 'downvote'
      });
      
      await storage.voteCommunityPost(voteData);
      const updatedPost = await storage.getCommunityPostById(postId);
      res.json(updatedPost);
    } catch (error) {
      console.error("Error voting on post:", error);
      res.status(500).json({ message: "Failed to vote on post" });
    }
  });

  app.delete('/api/community/posts/:id', authorize(), async (req: any, res) => {
    try {
      const postId = parseInt(req.params.id);
      const userId = req.session.user.id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // Get the post to check ownership and creation time
      const post = await storage.getCommunityPostById(postId);
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }

      // Check deletion permissions
      const canDelete = 
        user.role === 'admin' || // Admins can delete any post at any time
        (post.authorId === userId && isWithinOneHour(post.createdAt?.toISOString() ?? new Date().toISOString())); // Users can delete their own posts within 1 hour

      if (!canDelete) {
        return res.status(403).json({ 
          message: user.role === 'admin' 
            ? "Insufficient permissions" 
            : "You can only delete your own posts within 1 hour of posting"
        });
      }
      
      await storage.deleteCommunityPost(postId, userId);
      res.json({ message: "Post deleted successfully" });
    } catch (error) {
      console.error("Error deleting post:", error);
      res.status(500).json({ message: "Failed to delete post" });
    }
  });

  // Community replies routes
  app.get('/api/community/posts/:id/replies', async (req, res) => {
    try {
      const postId = parseInt(req.params.id);
      const replies = await storage.getCommunityReplies(postId);
      res.json(replies);
    } catch (error) {
      console.error("Error fetching replies:", error);
      res.status(500).json({ message: "Failed to fetch replies" });
    }
  });

  app.post('/api/community/posts/:id/replies', checkAuth, async (req: any, res) => {
    try {
      const postId = parseInt(req.params.id);
      const userId = req.session.user.id;
      
      const replyData = insertCommunityReplySchema.parse({
        postId,
        authorId: req.body.isAnonymous ? null : userId,
        content: req.body.content,
        isAnonymous: req.body.isAnonymous || false,
      });
      
      const reply = await storage.createCommunityReply(replyData);
      res.json(reply);
    } catch (error) {
      console.error("Error creating reply:", error);
      res.status(500).json({ message: "Failed to create reply" });
    }
  });

  app.post('/api/community/replies/:id/vote', checkAuth, async (req: any, res) => {
    try {
      const replyId = parseInt(req.params.id);
      const userId = req.session.user.id;
      
      const voteData = insertCommunityVoteSchema.parse({
        replyId,
        userId,
        voteType: req.body.voteType,
      });
      
      await storage.voteCommunityReply(voteData);
      res.json({ message: "Vote recorded" });
    } catch (error) {
      console.error("Error voting on reply:", error);
      res.status(500).json({ message: "Failed to vote on reply" });
    }
  });

  app.delete('/api/community/replies/:id', authorize(), async (req: any, res) => {
    try {
      const replyId = parseInt(req.params.id);
      const userId = req.session.user.id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // Get the reply to check ownership and creation time
      const reply = await storage.getCommunityReplyById(replyId);
      if (!reply) {
        return res.status(404).json({ message: "Reply not found" });
      }

      // Check deletion permissions
      const canDelete = 
        user.role === 'admin' || // Admins can delete any reply at any time
        (reply.authorId === userId && isWithinOneHour(reply.createdAt?.toISOString() ?? new Date().toISOString())); // Users can delete their own replies within 1 hour

      if (!canDelete) {
        return res.status(403).json({ 
          message: user.role === 'admin' 
            ? "Insufficient permissions" 
            : "You can only delete your own replies within 1 hour of posting"
        });
      }
      
      await storage.deleteCommunityReply(replyId, userId);
      res.json({ message: "Reply deleted successfully" });
    } catch (error) {
      console.error("Error deleting reply:", error);
      res.status(500).json({ message: "Failed to delete reply" });
    }
  });

  // Community Announcements routes (Section 2) - Admin/Committee only
  app.get('/api/community/announcements', async (req, res) => {
    try {
      const announcements = await storage.getCommunityAnnouncements();
      res.json(announcements);
    } catch (error) {
      console.error("Error fetching community announcements:", error);
      res.status(500).json({ message: "Failed to fetch announcements" });
    }
  });

  app.post('/api/community/announcements', authorize(), async (req: any, res) => {
    try {
      const userId = req.session.user.id;
      const user = req.currentUser;
      
      // Only admin or committee_club role can create announcements
      if (user?.role !== 'admin' && user?.role !== 'committee_club') {
        return res.status(403).json({ message: "Only admins and committee members can create announcements" });
      }
      
      const announcementData = insertCommunityAnnouncementSchema.parse({
        ...req.body,
        authorId: userId,
        authorName: user?.firstName + ' ' + user?.lastName || user?.email || 'Unknown',
        mediaUrls: req.body.mediaUrls || [],
      });
      
      const announcement = await storage.createCommunityAnnouncement(announcementData);
      res.json(announcement);
    } catch (error) {
      console.error("Error creating announcement:", error);
      res.status(500).json({ message: "Failed to create announcement" });
    }
  });

  app.delete('/api/community/announcements/:id', authorize(), async (req: any, res) => {
    try {
      const announcementId = parseInt(req.params.id);
      const userId = req.session.user.id;
      const user = await storage.getUser(userId);
      
      // Only admins can delete announcements
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Only admins can delete announcements" });
      }
      
      await storage.deleteCommunityAnnouncement(announcementId, userId);
      res.json({ message: "Announcement deleted successfully" });
    } catch (error) {
      console.error("Error deleting announcement:", error);
      res.status(500).json({ message: "Failed to delete announcement" });
    }
  });

  // Configure multer for file uploads (5MB limit)
  const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
  });

  // Media upload endpoints for community posts and announcements
  app.post('/api/community/posts/with-media', authorize(), upload.array('media', 5), async (req: any, res) => {
    try {
      const userId = req.session.user.id;
      const user = req.currentUser;
      
      // Handle uploaded files
      const mediaUrls: string[] = [];
      if (req.files && req.files.length > 0) {
        for (const file of req.files) {
          // Convert buffer to base64 data URL for in-memory storage
          const base64 = file.buffer.toString('base64');
          const dataUrl = `data:${file.mimetype};base64,${base64}`;
          mediaUrls.push(dataUrl);
        }
      }
      
      const postData = insertCommunityPostSchema.parse({
        title: req.body.title,
        content: req.body.content,
        category: req.body.category,
        isAnonymous: req.body.isAnonymous === 'true',
        mediaUrls: mediaUrls,
        authorId: req.body.isAnonymous === 'true' ? null : userId,
        authorName: req.body.isAnonymous === 'true' ? null : (user?.firstName + ' ' + user?.lastName || user?.email || 'Anonymous'),
      });
      
      const post = await storage.createCommunityPost(postData);
      res.json(post);
    } catch (error) {
      console.error("Error creating community post with media:", error);
      res.status(500).json({ message: "Failed to create community post with media" });
    }
  });

  app.post('/api/community/announcements/with-media', authorize(), upload.array('media', 5), async (req: any, res) => {
    try {
      const userId = req.session.user.id;
      const user = req.currentUser;
      
      // Only admin or committee_club role can create announcements
      if (user?.role !== 'admin' && user?.role !== 'committee_club') {
        return res.status(403).json({ message: "Only admins and committee members can create announcements" });
      }
      
      // Handle uploaded files
      const mediaUrls: string[] = [];
      if (req.files && req.files.length > 0) {
        for (const file of req.files) {
          // Convert buffer to base64 data URL for in-memory storage
          const base64 = file.buffer.toString('base64');
          const dataUrl = `data:${file.mimetype};base64,${base64}`;
          mediaUrls.push(dataUrl);
        }
      }
      
      const announcementData = insertCommunityAnnouncementSchema.parse({
        title: req.body.title,
        content: req.body.content,
        category: req.body.category,
        mediaUrls: mediaUrls,
        authorId: userId,
        authorName: user?.firstName + ' ' + user?.lastName || user?.email || 'Unknown',
      });
      
      const announcement = await storage.createCommunityAnnouncement(announcementData);
      res.json(announcement);
    } catch (error) {
      console.error("Error creating announcement with media:", error);
      res.status(500).json({ message: "Failed to create announcement with media" });
    }
  });

  // Enhanced Weekly Menu routes with Excel upload
  
  // Get weekly menu data (public)
  app.get('/api/amenities/menu', async (req, res) => {
    try {
      const { dates } = req.query;
      let dateList: string[] = [];
      
      if (dates) {
        dateList = Array.isArray(dates) ? dates as string[] : [dates as string];
      } else {
        // Default: return today, tomorrow, day after, and next 7 days
        const today = new Date();
        for (let i = 0; i < 10; i++) {
          const date = new Date(today);
          date.setDate(today.getDate() + i);
          dateList.push(date.toISOString().split('T')[0]);
        }
      }
      
      const menu = await storage.getWeeklyMenuRange(dateList);
      res.json(menu);
    } catch (error) {
      console.error("Error fetching menu:", error);
      res.status(500).json({ message: "Failed to fetch menu" });
    }
  });

  // Upload weekly menu via Excel file (RBAC protected)
  app.post('/api/amenities/menu/upload', checkAuth, upload.single('menuFile'), async (req: any, res) => {
    try {
      const userInfo = extractUser(req);
      if (!userInfo) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      let user = await storage.getUser(userInfo.id);
      
      if (!user && userInfo.id === 'test-admin') {
        console.log('Creating test admin user...');
        try {
          user = await storage.upsertUser({
            id: 'test-admin',
            email: 'admin@test.com',
            firstName: 'Test',
            lastName: 'Admin',
            role: 'admin',
            permissions: { diningHostel: true }
          });
          console.log('Test admin user created:', user);
        } catch (err) {
          console.error('Failed to create test user:', err);
        }
      }
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      
      // RBAC check - admin or user with diningHostel permission
      const hasMenuPermission = user.role === 'admin' || user.permissions?.diningHostel === true;
      if (!hasMenuPermission) {
        return res.status(403).json({ 
          message: 'Menu upload access denied. Admin or dining permissions required.' 
        });
      }

      if (!req.file) {
        return res.status(400).json({ message: 'No Excel file uploaded' });
      }

      // File validation
      if (req.file.size > 5 * 1024 * 1024) { // 5MB limit
        return res.status(400).json({ message: 'File size exceeds 5MB limit' });
      }

      if (!req.file.originalname.toLowerCase().endsWith('.xlsx')) {
        return res.status(400).json({ message: 'Only .xlsx files are accepted' });
      }

      // Parse Excel file
      const parseResult = parseExcelMenu(req.file.buffer);
      
      if (!parseResult.success) {
        return res.status(400).json({ 
          message: 'Failed to parse Excel file',
          error: parseResult.error,
          details: parseResult.errorDetails
        });
      }

      // Convert parsed menu to database format
      const menuData: any[] = [];
      for (const [date, meals] of Object.entries(parseResult.menu!)) {
        menuData.push({
          date,
          breakfast: (meals as any).breakfast || null,
          lunch: (meals as any).lunch || null,
          eveningSnacks: (meals as any).eveningSnacks || null,
          dinner: (meals as any).dinner || null,
        });
      }

      // Replace all existing menu data
      const uploaded = await storage.replaceAllMenu(menuData, userInfo.id);
      
      res.json({
        message: `Menu uploaded successfully with ${uploaded.length} entries`,
        data: uploaded
      });
    } catch (error) {
      console.error("Error uploading menu:", error);
      res.status(500).json({ message: "Failed to upload menu" });
    }
  });

  // Book sick food
  app.post('/api/amenities/sick-food', checkAuth, async (req: any, res) => {
    try {
      const userId = req.session.user.id;
      
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

  // Get sick food bookings (admin only)
  app.get('/api/amenities/sick-food', checkAuth, async (req: any, res) => {
    try {
      // Check admin permissions
      if (req.session.user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const date = req.query.date ? new Date(req.query.date as string) : undefined;
      const bookings = await storage.getSickFoodBookings(date);
      res.json(bookings);
    } catch (error) {
      console.error("Error fetching sick food bookings:", error);
      res.status(500).json({ message: "Failed to fetch sick food bookings" });
    }
  });

  // Apply for hostel leave
  app.post('/api/hostel/leave', checkAuth, async (req: any, res) => {
    try {
      const userId = req.session.user.id;
      
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

  // Get leave applications (admin only)
  app.get('/api/hostel/leave', checkAuth, async (req: any, res) => {
    try {
      // Check admin permissions
      if (req.session.user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const status = req.query.status as string;
      const applications = await storage.getLeaveApplications(status);
      res.json(applications);
    } catch (error) {
      console.error("Error fetching leave applications:", error);
      res.status(500).json({ message: "Failed to fetch leave applications" });
    }
  });

  // Approve leave application via token
  app.post('/api/hostel/leave/:id/approve/:token', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const token = req.params.token;
      
      const leave = await storage.approveLeave(id, token);
      res.json({ message: "Leave approved successfully", leave });
    } catch (error) {
      console.error("Error approving leave:", error);
      res.status(500).json({ message: "Failed to approve leave" });
    }
  });

  // Deny leave application via token
  app.post('/api/hostel/leave/:id/deny/:token', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const token = req.params.token;
      
      const leave = await storage.denyLeave(id, token);
      res.json({ message: "Leave denied", leave });
    } catch (error) {
      console.error("Error denying leave:", error);
      res.status(500).json({ message: "Failed to deny leave" });
    }
  });

  // Submit grievance
  app.post('/api/grievances', checkAuth, async (req: any, res) => {
    try {
      const userId = req.session.user.id;
      
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

  // Get grievances (admin only)
  app.get('/api/grievances', checkAuth, async (req: any, res) => {
    try {
      // Check admin permissions
      if (req.session.user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const category = req.query.category as string;
      const grievances = await storage.getGrievances(category);
      res.json(grievances);
    } catch (error) {
      console.error("Error fetching grievances:", error);
      res.status(500).json({ message: "Failed to fetch grievances" });
    }
  });

  // Resolve grievance (admin only)
  app.post('/api/grievances/:id/resolve', checkAuth, async (req: any, res) => {
    try {
      // Check admin permissions
      if (req.session.user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const id = parseInt(req.params.id);
      const { adminNotes } = req.body;
      
      const grievance = await storage.resolveGrievance(id, adminNotes);
      res.json(grievance);
    } catch (error) {
      console.error("Error resolving grievance:", error);
      res.status(500).json({ message: "Failed to resolve grievance" });
    }
  });

  // Attendance routes
  app.post('/api/attendance', checkAuth, async (req: any, res) => {
    try {
      const userId = req.session.user.id;
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
  app.get('/api/directory/users', checkAuth, async (req, res) => {
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
  app.get('/api/admin/users', adminOnly(), async (req, res) => {
    try {
      const users = await storage.getAllUsersForAdmin();
      res.json(users);
    } catch (error) {
      console.error("Error fetching all users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.put('/api/admin/users/:id', adminOnly(), async (req: any, res) => {
    try {
      const targetUserId = req.params.id;
      const { role, permissions } = req.body;
      
      // Validate role
      if (!['student', 'committee_club', 'admin'].includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }
      
      // Prevent admin from demoting themselves
      if (targetUserId === req.currentUser.id && role !== 'admin') {
        return res.status(400).json({ message: "Cannot change your own admin role" });
      }
      
      const updatedUser = await storage.updateUserRoleAndPermissions(targetUserId, role, permissions);
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Delete user (Admin only)
  app.delete('/api/admin/users/:id', adminOnly(), async (req: any, res) => {
    try {
      const targetUserId = req.params.id;
      
      // Prevent admin from deleting themselves
      if (targetUserId === req.currentUser.id) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }
      
      const deleted = await storage.deleteUser(targetUserId);
      if (!deleted) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Update other protected routes to use authorize middleware
  app.post('/api/events', authorize('calendar'), async (req: any, res) => {
    try {
      const userId = req.session.user.id;
      const eventData = insertEventSchema.parse({
        ...req.body,
        authorId: userId,
      });
      
      const event = await storage.createEvent(eventData);
      res.json(event);
    } catch (error) {
      console.error("Error creating event:", error);
      res.status(500).json({ message: "Failed to create event" });
    }
  });

  app.post('/api/attendance', authorize('attendance'), async (req: any, res) => {
    try {
      const userId = req.session.user.id;
      const { eventId, attendees } = req.body;
      await storage.saveAttendance(eventId, attendees, userId);
      res.json({ message: "Attendance saved successfully" });
    } catch (error) {
      console.error("Error saving attendance:", error);
      res.status(500).json({ message: "Failed to save attendance" });
    }
  });

  // Media upload endpoint
  app.post('/api/upload', checkAuth, async (req: any, res) => {
    try {
      // Mock file upload - in production, you'd use multer or similar
      const { file, fileName } = req.body;
      
      if (!file || !fileName) {
        return res.status(400).json({ message: "File and fileName are required" });
      }

      // Simulate file storage and return URL
      const mockUrl = `https://mock-storage.example.com/${Date.now()}-${fileName}`;
      
      res.json({ url: mockUrl });
    } catch (error) {
      console.error("Error uploading file:", error);
      res.status(500).json({ message: "Failed to upload file" });
    }
  });

  // Gallery endpoint for events
  app.get('/api/events/:id/gallery', checkAuth, async (req, res) => {
    try {
      const eventId = parseInt(req.params.id);
      const event = await storage.getEventById(eventId);
      
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      res.json({ mediaUrls: event.mediaUrls || [] });
    } catch (error) {
      console.error("Error fetching event gallery:", error);
      res.status(500).json({ message: "Failed to fetch gallery" });
    }
  });

  // Account switching endpoints
  app.get('/api/auth/linked-accounts', checkAuth, async (req: any, res) => {
    try {
      const userId = req.session.user.id;
      const linkedAccounts = await storage.getLinkedAccounts(userId);
      res.json(linkedAccounts);
    } catch (error) {
      console.error("Error fetching linked accounts:", error);
      res.status(500).json({ message: "Failed to fetch linked accounts" });
    }
  });

  app.post('/api/auth/create-alternate-account', checkAuth, async (req: any, res) => {
    try {
      const userId = req.session.user.id;
      const { role, permissions } = req.body;
      
      if (!['committee_club', 'admin'].includes(role)) {
        return res.status(400).json({ message: "Invalid role for alternate account" });
      }

      const alternateAccount = await storage.createAlternateAccount(userId, role, permissions);
      res.json(alternateAccount);
    } catch (error) {
      console.error("Error creating alternate account:", error);
      res.status(500).json({ message: "Failed to create alternate account" });
    }
  });

  app.post('/api/auth/switch-account', checkAuth, async (req: any, res) => {
    try {
      const { accountId } = req.body;
      const targetAccount = await storage.getUser(accountId);
      
      if (!targetAccount) {
        return res.status(404).json({ message: "Account not found" });
      }

      // Update session with new account
      req.user.currentAccountId = accountId;
      res.json(targetAccount);
    } catch (error) {
      console.error("Error switching account:", error);
      res.status(500).json({ message: "Failed to switch account" });
    }
  });

  // Gallery folder endpoints
  app.get('/api/gallery/folders', checkAuth, async (req, res) => {
    try {
      const folders = await storage.getGalleryFolders();
      res.json(folders);
    } catch (error) {
      console.error("Error fetching gallery folders:", error);
      res.status(500).json({ message: "Failed to fetch gallery folders" });
    }
  });

  app.post('/api/gallery/folders', authorize('gallery'), async (req: any, res) => {
    try {
      const userId = req.session.user.id;
      const folderData = {
        ...req.body,
        createdBy: userId,
      };
      
      const folder = await storage.createGalleryFolder(folderData);
      res.json(folder);
    } catch (error) {
      console.error("Error creating gallery folder:", error);
      res.status(500).json({ message: "Failed to create gallery folder" });
    }
  });

  app.delete('/api/gallery/folders/:id', authorize('gallery'), async (req: any, res) => {
    try {
      const folderId = parseInt(req.params.id);
      const userId = req.session.user.id;
      const userRole = req.user.role;
      
      // Only allow deletion by admin or creator
      const folder = await storage.getGalleryFolderById(folderId);
      if (!folder) {
        return res.status(404).json({ message: "Folder not found" });
      }
      
      if (userRole !== 'admin' && folder.createdBy !== userId) {
        return res.status(403).json({ message: "Not authorized to delete this folder" });
      }
      
      await storage.deleteGalleryFolder(folderId);
      res.json({ message: "Folder deleted successfully" });
    } catch (error) {
      console.error("Error deleting gallery folder:", error);
      res.status(500).json({ message: "Failed to delete gallery folder" });
    }
  });

  // Register gallery routes
  registerGalleryRoutes(app);

  // Refresh user permissions from database
  app.post('/api/auth/refresh', checkAuth, async (req: any, res) => {
    try {
      const currentUser = req.session.user;
      if (!currentUser) {
        return res.status(401).json({ message: "No active session" });
      }

      // Fetch fresh user data from database
      const freshUser = await storage.getUser(currentUser.id);
      if (!freshUser) {
        return res.status(404).json({ message: "User not found in database" });
      }

      // Update session with fresh permissions
      req.session.user = {
        id: freshUser.id,
        email: freshUser.email,
        name: `${freshUser.firstName} ${freshUser.lastName}`.trim(),
        picture: freshUser.profileImageUrl,
        role: freshUser.role,
        permissions: freshUser.permissions,
        firstName: freshUser.firstName,
        lastName: freshUser.lastName,
        profileImageUrl: freshUser.profileImageUrl,
      };

      console.log('User permissions refreshed:', req.session.user);
      res.json({ message: "Permissions refreshed successfully", user: req.session.user });
    } catch (error) {
      console.error("Error refreshing user permissions:", error);
      res.status(500).json({ message: "Failed to refresh permissions" });
    }
  });

  // Student Directory Management Routes
  
  // Get student directory (Admin only)
  app.get('/api/admin/students', adminOnly(), async (req: any, res) => {
    try {
      const students = await storage.getStudentDirectory();
      res.json(students);
    } catch (error) {
      console.error("Error fetching student directory:", error);
      res.status(500).json({ message: "Failed to fetch student directory" });
    }
  });

  // Get upload logs (Admin only)
  app.get('/api/admin/student-uploads', adminOnly(), async (req: any, res) => {
    try {
      const logs = await storage.getUploadLogs();
      res.json(logs);
    } catch (error) {
      console.error("Error fetching upload logs:", error);
      res.status(500).json({ message: "Failed to fetch upload logs" });
    }
  });

  // Student directory upload (Admin only)
  app.post('/api/admin/upload-students', adminOnly(), upload.single('studentsFile'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const { batchName } = req.body;
      if (!batchName || typeof batchName !== 'string' || batchName.trim().length === 0) {
        return res.status(400).json({ message: "Batch name is required" });
      }

      // Validate file type and size
      if (!req.file.originalname.toLowerCase().endsWith('.xlsx')) {
        return res.status(400).json({ message: "Only .xlsx files are allowed" });
      }

      if (req.file.size > 5 * 1024 * 1024) { // 5MB limit
        return res.status(400).json({ message: "File size must be less than 5MB" });
      }

      console.log(`Processing student upload: ${req.file.originalname}, Batch: ${batchName}`);

      // Parse the Excel file
      const parseResult = parseStudentExcel(req.file.buffer, batchName.trim());
      
      if (parseResult.students.length === 0) {
        return res.status(400).json({ message: "No valid email addresses found in the uploaded file" });
      }

      // Prepare student records for database
      const studentRecords = parseResult.students.map(student => ({
        email: student.email,
        batch: student.batch,
        section: student.section,
        rollNumber: student.rollNumber,
        uploadedBy: req.currentUser.id
      }));

      // Check for roll number conflicts
      const { conflicts, validStudents } = await storage.checkRollNumberConflicts(studentRecords);
      
      if (conflicts.length > 0) {
        console.log(`Found ${conflicts.length} roll number conflicts:`, conflicts);
        return res.status(400).json({
          message: `Found ${conflicts.length} roll number conflict(s)`,
          conflicts: conflicts,
          conflictDetails: conflicts.map(c => 
            `Roll number ${c.rollNumber} already exists for ${c.existingEmail}, but trying to assign to ${c.newEmail}`
          )
        });
      }

      // Batch upsert students (only valid ones without conflicts)
      const savedStudents = await storage.batchUpsertStudents(validStudents);

      // Create batch-section relationships with batch-specific section names
      const batchSectionData = parseResult.sectionsProcessed.map(section => ({
        batch: batchName.trim(),
        section: `${batchName.trim()}::${section}`, // Store as batch::section combination
      }));
      
      await storage.upsertBatchSections(batchSectionData);

      // Create upload log
      await storage.createUploadLog({
        adminUserId: req.currentUser.id,
        batchName: batchName.trim(),
        fileName: req.file.originalname,
        sheetsProcessed: parseResult.sectionsProcessed.length,
        studentsProcessed: savedStudents.length,
        sectionsCreated: parseResult.sectionsProcessed
      });

      console.log(`Successfully processed ${savedStudents.length} students from ${parseResult.sectionsProcessed.length} sections`);

      res.json({
        message: "Student directory uploaded successfully",
        studentsProcessed: savedStudents.length,
        sectionsCreated: parseResult.sectionsProcessed,
        batchName: batchName.trim()
      });

    } catch (error) {
      console.error("Error uploading student directory:", error);
      res.status(500).json({ 
        message: "Failed to upload student directory",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Check if email is in student directory (used during login)
  app.get('/api/student-check/:email', async (req, res) => {
    try {
      const { email } = req.params;
      const student = await storage.getStudentByEmail(email.toLowerCase());
      
      if (student) {
        res.json({
          isAuthorized: true,
          batch: student.batch,
          section: student.section
        });
      } else {
        res.json({
          isAuthorized: false
        });
      }
    } catch (error) {
      console.error("Error checking student authorization:", error);
      res.status(500).json({ message: "Failed to check authorization" });
    }
  });

  // Image upload route
  app.post('/api/upload/image', authorize('triathlon'), upload.single('image'), (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      console.log("File uploaded successfully:", req.file);
      console.log("req.file.filename:", req.file.filename);
      console.log("req.file.path:", req.file.path);

      // Handle both diskStorage and memoryStorage cases
      let filename: string;
      let fileUrl: string;

      if (req.file.filename) {
        // diskStorage case - file already saved
        filename = req.file.filename;
        fileUrl = `/uploads/${filename}`;
      } else {
        // memoryStorage case - need to save manually
        const timestamp = Date.now();
        const ext = path.extname(req.file.originalname);
        filename = `team-logo-${timestamp}${ext}`;
        const filepath = path.join('uploads', filename);
        
        // Ensure uploads directory exists
        if (!fs.existsSync('uploads')) {
          fs.mkdirSync('uploads', { recursive: true });
        }
        
        // Write buffer to file
        fs.writeFileSync(filepath, req.file.buffer);
        fileUrl = `/uploads/${filename}`;
      }
      
      console.log("Generated fileUrl:", fileUrl);
      
      res.json({ 
        success: true, 
        url: fileUrl,
        filename: filename
      });
    } catch (error) {
      console.error("Error uploading image:", error);
      res.status(500).json({ message: "Failed to upload image" });
    }
  });

  // Serve uploaded files
  app.use('/uploads', (req: any, res: any, next: any) => {
    res.header('Access-Control-Allow-Origin', '*');
    next();
  });
  
  const expressForUploads = await import('express');
  app.use('/uploads', expressForUploads.default.static('uploads'));

  // Triathlon routes
  app.get('/api/triathlon/teams', async (req, res) => {
    try {
      const teams = await storage.getTriathlonTeams();
      res.json(teams);
    } catch (error) {
      console.error("Error fetching triathlon teams:", error);
      res.status(500).json({ message: "Failed to fetch teams" });
    }
  });

  app.post('/api/triathlon/teams', authorize('triathlon'), async (req, res) => {
    try {
      const data = req.body;
      const team = await storage.createTriathlonTeam(data);
      res.json(team);
    } catch (error) {
      console.error("Error creating triathlon team:", error);
      res.status(500).json({ message: "Failed to create team" });
    }
  });

  app.put('/api/triathlon/teams/:teamId', authorize('triathlon'), async (req, res) => {
    try {
      const teamId = parseInt(req.params.teamId);
      const { name, logoUrl } = req.body;
      
      const updatedTeam = await storage.updateTriathlonTeam(teamId, { name, logoUrl });
      res.json(updatedTeam);
    } catch (error) {
      console.error("Error updating triathlon team:", error);
      res.status(500).json({ message: "Failed to update team" });
    }
  });

  app.delete('/api/triathlon/teams/:teamId', authorize('triathlon'), async (req, res) => {
    try {
      const teamId = parseInt(req.params.teamId);
      await storage.deleteTriathlonTeam(teamId);
      res.json({ message: "Team deleted successfully" });
    } catch (error) {
      console.error("Error deleting triathlon team:", error);
      res.status(500).json({ message: "Failed to delete team" });
    }
  });

  app.post('/api/triathlon/teams/:teamId/points', authorize('triathlon'), async (req, res) => {
    try {
      const teamId = parseInt(req.params.teamId);
      const { category, pointChange, reason } = req.body;
      
      const user = extractUser(req);
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const updatedTeam = await storage.updateTriathlonPoints(
        teamId, 
        category, 
        pointChange, 
        reason, 
        user.id
      );
      
      res.json(updatedTeam);
    } catch (error) {
      console.error("Error updating triathlon points:", error);
      res.status(500).json({ message: "Failed to update points" });
    }
  });

  app.get('/api/triathlon/history/:teamId', authorize('triathlon'), async (req, res) => {
    try {
      const teamId = parseInt(req.params.teamId);
      const history = await storage.getTriathlonPointHistory(teamId);
      res.json(history);
    } catch (error) {
      console.error("Error fetching point history:", error);
      res.status(500).json({ message: "Failed to fetch history" });
    }
  });

  // Static file serving moved to top of function to fix PWA installability

  const httpServer = createServer(app);
  return httpServer;
}
