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
  insertForumPostSchema,
  insertForumReactionSchema,
  insertSickFoodBookingSchema,
  insertHostelLeaveSchema,
  insertGrievanceSchema,
} from "@shared/schema";
import { z } from "zod";

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

  app.post('/api/forum/posts', checkAuth, async (req: any, res) => {
    try {
      const userId = req.session.user.id;
      
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

  app.post('/api/forum/posts/:id/react', checkAuth, async (req: any, res) => {
    try {
      const postId = parseInt(req.params.id);
      const userId = req.session.user.id;
      
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

  // Enhanced Amenities (Dining) routes
  
  // Get today's menu (public)
  app.get('/api/dining/menu', async (req, res) => {
    try {
      const menu = await storage.getTodaysMenu();
      res.json(menu);
    } catch (error) {
      console.error("Error fetching menu:", error);
      res.status(500).json({ message: "Failed to fetch menu" });
    }
  });

  // Get menu by date (public)
  app.get('/api/dining/menu/:date', async (req, res) => {
    try {
      const date = new Date(req.params.date);
      const menu = await storage.getMenuByDate(date);
      res.json(menu);
    } catch (error) {
      console.error("Error fetching menu:", error);
      res.status(500).json({ message: "Failed to fetch menu" });
    }
  });

  // Upload menu (admin only)
  app.post('/api/dining/menu/upload', checkAuth, async (req: any, res) => {
    try {
      const userId = req.session.user.id;
      
      // Check admin permissions
      if (req.session.user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const menuItems = req.body.menuItems; // Array of menu items
      const menuData = menuItems.map((item: any) => ({
        ...item,
        date: new Date(item.date),
        uploadedBy: userId,
      }));
      
      const menu = await storage.uploadMenu(menuData);
      res.json(menu);
    } catch (error) {
      console.error("Error uploading menu:", error);
      res.status(500).json({ message: "Failed to upload menu" });
    }
  });

  // Update menu item (admin only)
  app.put('/api/dining/menu/:date/:mealType', checkAuth, async (req: any, res) => {
    try {
      // Check admin permissions
      if (req.session.user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const date = new Date(req.params.date);
      const mealType = req.params.mealType;
      const { items } = req.body;
      
      const menu = await storage.updateMenu(date, mealType, items);
      res.json(menu);
    } catch (error) {
      console.error("Error updating menu:", error);
      res.status(500).json({ message: "Failed to update menu" });
    }
  });

  // Update menu by ID (admin only)
  app.put('/api/dining/menu/:id', checkAuth, async (req: any, res) => {
    try {
      // Check admin permissions
      if (req.session.user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { id } = req.params;
      const { items } = req.body;
      
      if (!items || !Array.isArray(items)) {
        return res.status(400).json({ message: 'Invalid menu items' });
      }

      const menu = await storage.updateMenuById(parseInt(id), items);
      res.json(menu);
    } catch (error) {
      console.error("Error updating menu:", error);
      res.status(500).json({ message: "Failed to update menu" });
    }
  });

  // Book sick food
  app.post('/api/dining/sick-food', checkAuth, async (req: any, res) => {
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
  app.get('/api/dining/sick-food', checkAuth, async (req: any, res) => {
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

  const httpServer = createServer(app);
  return httpServer;
}
