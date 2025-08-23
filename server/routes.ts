import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { WebSocketServer, WebSocket } from 'ws';
// Replit auth removed - using Auth0 only
import { checkAuth, handleAuthError, extractUser, requireAdmin, requireManageStudents, requireEventsManage, requireAnyRole } from "./auth0Config";
import { registerGalleryRoutes } from "./routes/galleryRoutes";
import healthRoutes from "./routes/health";
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
  insertPushSubscriptionSchema,
  insertAttendanceRecordSchema,
  insertAttendanceContainerSchema,
} from "@shared/schema";
import { z } from "zod";
import { parseExcelMenu } from "./menuParser";
import { parseStudentExcel, parseRollNumbersForEvent } from "./studentParser";
import { submitToGoogleForm, generateCorrelationId, generatePrefillProbeUrl, buildGoogleFormPreview, type LeaveFormData } from "./services/googleFormSubmit";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db } from "./db";
import { studentDirectory } from "@shared/schema";
import { and, eq } from "drizzle-orm";
import { randomUUID } from 'crypto';
import assert from 'assert';
import { isEligible, adaptLegacyTargets, normalizeTargets } from './lib/eligibility';

// Configure multer for file uploads
// Normalize utility exactly as specified
function norm(arr: any): string[] {
  return Array.from(new Set((arr || []).map((x: any) => String(x).trim())))
    .filter(Boolean)
    .sort() as string[];
}

// Enhanced logging utility
function logOperation(level: 'info' | 'warn' | 'error', data: any, message: string) {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} [${level.toUpperCase()}] ${message}`, JSON.stringify(data, null, 2));
}

// REMOVED: Use imported helper instead - Single source of truth

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

// Amenities RBAC middleware - Enhanced with diagnostics
function authorizeAmenities(permission: string) {
  return async (req: any, res: any, next: any) => {
    const sessionUser = req.session?.user;
    const requestId = req.headers['x-request-id'] || 'auth_check';
    
    console.log(`🔐 [AMENITIES-AUTH] Checking permission '${permission}' - RequestID: ${requestId}`);
    console.log(`👤 [AMENITIES-AUTH] User details:`, {
      hasUser: !!sessionUser,
      userId: sessionUser?.id,
      role: sessionUser?.role,
      permissions: sessionUser?.permissions,
      requestId
    });
    
    if (!sessionUser) {
      console.log(`❌ [AMENITIES-AUTH] No session user - RequestID: ${requestId}`);
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Admin users have full access to all amenities features
    if (sessionUser.role === 'admin') {
      console.log(`✅ [AMENITIES-AUTH] Admin access granted - RequestID: ${requestId}`);
      return next();
    }

    // Check specific amenities permission
    const hasPermission = sessionUser.permissions?.[permission] === true;
    if (!hasPermission) {
      console.log(`❌ [AMENITIES-AUTH] Permission denied - Required: ${permission}, User permissions:`, sessionUser.permissions, `RequestID: ${requestId}`);
      return res.status(403).json({ message: `Access denied. Required permission: ${permission}` });
    }

    console.log(`✅ [AMENITIES-AUTH] Permission granted - RequestID: ${requestId}`);
    next();
  };
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

// Student management permission middleware
function manageStudentsOnly() {
  return async (req: any, res: any, next: any) => {
    const sessionUser = req.session?.user;
    if (!sessionUser) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    const user = await storage.getUser(sessionUser.id);
    
    if (!user) {
      return res.status(403).json({ message: "User not found" });
    }
    
    // Admins have access to everything, or users with specific manageStudents permission
    const isAdmin = user.role === 'admin';
    const hasManageStudents = user.permissions?.manageStudents;
    
    if (!isAdmin && !hasManageStudents) {
      return res.status(403).json({ message: "Student management access required" });
    }
    
    req.currentUser = user;
    next();
  };
}

// Global WebSocket connections store
let wss: WebSocketServer;
const connectedClients = new Set<WebSocket>();

// Broadcast function for real-time updates
function broadcastToClients(message: any) {
  const messageString = JSON.stringify(message);
  connectedClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(messageString);
    } else {
      connectedClients.delete(client);
    }
  });
}

export async function registerRoutes(app: Express): Promise<Server> {
  // CRITICAL: Serve static files FIRST for PWA installability
  const expressStaticImport = await import('express');
  app.use(expressStaticImport.default.static(path.resolve(import.meta.dirname, '..', 'client', 'public')));
  
  // Session middleware for Auth0 with hardened persistence
  const session = await import('express-session');
  app.use(session.default({
    secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    rolling: true, // Refresh expiry on activity
    cookie: {
      sameSite: 'none', // Allow cross-origin for PWA
      secure: true,     // Require HTTPS (trust proxy handles this)
      httpOnly: true,   // Prevent XSS attacks
      maxAge: 1000 * 60 * 60 * 24 * 14 // 14 days
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

  // Heartbeat endpoint to keep sessions alive
  app.get('/api/auth/heartbeat', (req: any, res) => {
    const sessionUser = req.session?.user;
    
    if (!sessionUser) {
      return res.json({ ok: false });
    }
    
    // Session exists and will be renewed due to rolling: true
    // Touch the session to refresh expiry
    req.session.touch();
    
    res.json({ ok: true });
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

  // Events routes - CANONICAL IMPLEMENTATION with RBAC
  app.get('/api/events', checkAuth, async (req: any, res) => {
    try {
      const userInfo = extractUser(req);
      const userId = userInfo?.id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const { tag, limit } = req.query;
      const requestId = req.headers['x-request-id'] || `canonical_events_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      logOperation('info', { 
        tag: tag || 'none', 
        limit: limit || 'none', 
        requestId,
        userId: user.id,
        userRole: user.role,
        userBatch: user.batch,
        userSection: user.section
      }, 'CANONICAL_EVENTS_GET_REQUEST');

      // Get all events from database
      const allEvents = await storage.getEvents();
      
      // Apply canonical eligibility filtering for each event
      const eventsWithEligibility = allEvents.map(event => {
        // Use canonical targets if available, otherwise adapt from legacy
        let targets;
        if (event.targets && (event.targets.batches?.length > 0 || event.targets.sections?.length > 0 || event.targets.programs?.length > 0)) {
          targets = event.targets;
        } else {
          // Adapt from legacy fields
          targets = adaptLegacyTargets({
            targetBatches: event.targetBatches || [],
            targetSections: event.targetSections || [],
            targetBatchSections: event.targetBatchSections || [],
            rollNumberAttendees: event.rollNumberAttendees || []
          });
        }
        
        const eligible = user.role === 'admin' || user.role === 'events_manager' || 
                        isEligible(user, targets);
        
        return { ...event, eligible };
      });
      
      // Filter by eligibility for non-admin users
      let filteredEvents = user.role === 'admin' || user.role === 'events_manager' 
        ? eventsWithEligibility
        : eventsWithEligibility.filter(event => event.eligible);

      // Filter by tag if specified
      if (tag) {
        const tagLower = (tag as string).toLowerCase();
        filteredEvents = filteredEvents.filter(event => 
          event.category?.toLowerCase().includes(tagLower) ||
          event.hostCommittee?.toLowerCase().includes(tagLower)
        );
      }
      
      // Apply limit if specified
      if (limit) {
        const limitNum = parseInt(limit as string, 10);
        if (!isNaN(limitNum) && limitNum > 0) {
          filteredEvents = filteredEvents.slice(0, limitNum);
        }
      }

      logOperation('info', {
        requestId,
        totalEvents: allEvents.length,
        eligibleEvents: filteredEvents.length,
        userRole: user.role
      }, 'CANONICAL_EVENTS_GET_RESPONSE');
      
      res.json(filteredEvents);
    } catch (error) {
      logOperation('error', { error: error instanceof Error ? error.message : String(error) }, 'CANONICAL_EVENTS_GET_ERROR');
      res.status(500).json({ message: "Failed to fetch events" });
    }
  });

  // GET individual event with eligibility as specified
  app.get('/api/events/:id', checkAuth, async (req: any, res) => {
    try {
      const userInfo = extractUser(req);
      const userId = userInfo?.id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const eventId = parseInt(req.params.id);
      const event = await storage.getEventById(eventId);
      
      if (!event) {
        return res.status(404).json({ message: 'Event not found' });
      }

      // Adapt legacy event data to new canonical targets format
      const targets = adaptLegacyTargets({
        targetBatches: event.targetBatches || [],
        targetSections: event.targetSections || [],
        targetBatchSections: event.targetBatchSections || [],
        rollNumberAttendees: event.rollNumberAttendees || []
      });
      
      // Include eligible computed by the same helper as specified  
      const eligible = isEligible(user, targets);

      // Add temporary debug log as specified
      logOperation('info', { 
        user: { batch: user.batch, section: user.section, program: user.program || null }, 
        eventId: event.id, 
        targets: targets, 
        eligible: eligible 
      }, 'ELIGIBILITY_EVAL');

      const eventWithEligibility = { ...event, eligible };
      
      res.json(eventWithEligibility);
    } catch (error) {
      logOperation('error', { error: error instanceof Error ? error.message : String(error) }, 'EVENT_GET_BY_ID_ERROR');
      res.status(500).json({ message: "Failed to fetch event" });
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

  app.post('/api/events', requireEventsManage, async (req: any, res) => {
    const requestId = req.headers['x-request-id'] || `api_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    try {
      const userInfo = extractUser(req);
      const userId = userInfo?.id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(401).json({ error: 'unauthorized', message: 'Authentication required' });
      }

      // Comprehensive payload validation
      if (!req.body.title || typeof req.body.title !== 'string' || req.body.title.trim().length === 0) {
        return res.status(400).json({ error: 'invalid_payload', details: { field: 'title', reason: 'must be non-empty string' } });
      }

      if (!req.body.location || typeof req.body.location !== 'string' || req.body.location.trim().length === 0) {
        return res.status(400).json({ error: 'invalid_payload', details: { field: 'location', reason: 'must be non-empty string' } });
      }

      if (!req.body.startsAt) {
        return res.status(400).json({ error: 'invalid_payload', details: { field: 'startsAt', reason: 'is required' } });
      }

      logOperation('info', {
        requestId,
        userId,
        userRole: user.role,
        eventTitle: req.body.title
      }, 'CANONICAL_EVENT_CREATE_START');

      // Canonicalize targets using helpers
      const targets = req.body.targets || {};
      const batches = normArr(targets.batches);
      const sectionsByBatch = normMap(targets.sectionsByBatch, batches);
      const programs = normArr(targets.programs);
      
      const canonicalTargets = { batches, sectionsByBatch, programs };

      // At least one batch must be specified 
      if (batches.length === 0) {
        return res.status(400).json({ error: 'invalid_payload', details: { field: 'targets.batches', reason: 'must not be empty' } });
      }

      // Log safe preview
      logOperation('info', { requestId, preview: { batches, keys: Object.keys(sectionsByBatch) } }, 'EVENT_CREATE_TARGETS');

      // Parse startsAt and endsAt dates for canonical format
      let startsAt: Date;
      let endsAt: Date | null = null;
      
      try {
        startsAt = new Date(req.body.startsAt);
        if (req.body.endsAt) {
          endsAt = new Date(req.body.endsAt);
        }
      } catch (dateError) {
        return res.status(400).json({ message: 'Invalid date format for startsAt or endsAt' });
      }

      logOperation('info', {
        requestId,
        userId,
        targets,
        eventTitle: req.body.title,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt?.toISOString()
      }, 'CANONICAL_EVENT_CREATE_DATA');

      // Build canonical event data
      const eventData = {
        title: req.body.title.trim(),
        description: req.body.description || '',
        category: req.body.category || 'Academic',
        hostCommittee: req.body.hostCommittee || '',
        location: req.body.location.trim(),
        startsAt,
        endsAt,
        date: startsAt, // Legacy field - set to same value as startsAt for backward compatibility
        targets: canonicalTargets,
        meta: req.body.meta || { mandatory: req.body.mandatory || false },
        createdBy: userId, // New canonical field
        authorId: userId, // Legacy field - keeping both during migration
        rsvpRequired: req.body.rsvpRequired || false
      };

      // Validate with insert schema
      const validatedEvent = insertEventSchema.parse(eventData);
      
      // Create the event
      const event = await storage.createEvent(validatedEvent);
      
      // Create AttendanceContainer for summary data
      try {
        const containerData = {
          eventId: event.id,
          totalStudents: 0, // Will be calculated when students are added
          presentCount: 0,
          absentCount: 0,
          lateCount: 0,
          unmarkedCount: 0,
          excusedCount: 0
        };
        
        const container = await storage.createAttendanceContainer(insertAttendanceContainerSchema.parse(containerData));
        logOperation('info', { requestId, eventId: event.id, containerId: container.id }, 'CANONICAL_EVENT_CONTAINER_CREATED');
      } catch (containerError) {
        logOperation('warn', { requestId, eventId: event.id, error: containerError instanceof Error ? containerError.message : String(containerError) }, 'CANONICAL_EVENT_CONTAINER_FAILED');
      }
      
      logOperation('info', { requestId, eventId: event.id }, 'CANONICAL_EVENT_CREATE_SUCCESS');
      res.status(201).json(event);
    } catch (error) {
      logError(requestId, error, 'EVENT_CREATE', { title: req.body?.title });
      res.status(500).json({ error: 'internal_error', message: 'Failed to create event' });
    }
  });

  // Normalization helpers
  const normArr = (a?: any[]): string[] => {
    if (!Array.isArray(a)) return [];
    return [...new Set(a.map(s => String(s).trim()))].filter(Boolean).sort();
  };

  const normMap = (m?: any, batches: string[] = []): Record<string, string[]> => {
    if (!m || typeof m !== 'object' || Array.isArray(m)) return {};
    const result: Record<string, string[]> = {};
    for (const batch of batches) {
      result[batch] = normArr(m[batch]);
    }
    return result;
  };

  // Structured error logging with requestId
  const logError = (reqId: string, error: any, operation: string, context?: any) => {
    logOperation('error', {
      reqId,
      operation,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      context
    }, `${operation}_FAILED`);
  };

  // Update existing event - CANONICAL RBAC with comprehensive validation
  app.put('/api/events/:id', requireEventsManage, async (req: any, res) => {
    const requestId = req.headers['x-request-id'] || `api_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    try {
      const userInfo = extractUser(req);
      const userId = userInfo?.id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(401).json({ error: 'unauthorized', message: 'Authentication required' });
      }

      // Validate payload structure
      if (!req.body.title || typeof req.body.title !== 'string' || req.body.title.trim().length === 0) {
        return res.status(400).json({ error: 'invalid_payload', details: { field: 'title', reason: 'must be non-empty string' } });
      }

      if (!req.body.location || typeof req.body.location !== 'string' || req.body.location.trim().length === 0) {
        return res.status(400).json({ error: 'invalid_payload', details: { field: 'location', reason: 'must be non-empty string' } });
      }

      const eventId = parseInt(req.params.id);
      const existingEvent = await storage.getEventById(eventId);
      
      if (!existingEvent) {
        return res.status(404).json({ error: 'not_found', message: 'Event not found' });
      }

      // Check if user can edit this event (owner or admin)
      if (user.role !== 'admin' && existingEvent.createdBy !== userId && existingEvent.authorId !== userId) {
        return res.status(403).json({ error: 'forbidden', message: 'You can only edit events you created' });
      }

      // Parse and validate dates
      let startsAt: Date = existingEvent.startsAt;
      let endsAt: Date | null = existingEvent.endsAt;
      let date: Date = existingEvent.date;
      
      if (req.body.startsAt) {
        try {
          startsAt = new Date(req.body.startsAt);
          date = startsAt; // Keep legacy date field in sync
          if (isNaN(startsAt.getTime())) throw new Error('Invalid date');
        } catch (dateError) {
          return res.status(400).json({ error: 'invalid_payload', details: { field: 'startsAt', reason: 'invalid date format' } });
        }
      }
      
      if (req.body.endsAt) {
        try {
          endsAt = new Date(req.body.endsAt);
          if (isNaN(endsAt.getTime())) throw new Error('Invalid date');
          if (endsAt <= startsAt) {
            return res.status(400).json({ error: 'invalid_payload', details: { field: 'endsAt', reason: 'must be after startsAt' } });
          }
        } catch (dateError) {
          return res.status(400).json({ error: 'invalid_payload', details: { field: 'endsAt', reason: 'invalid date format' } });
        }
      }

      // Handle legacy and canonical targets
      const targets = req.body.targets || {};
      const batches = normArr(targets.batches || req.body.targetBatches || existingEvent.targetBatches);
      const sectionsByBatch = normMap(targets.sectionsByBatch, batches);
      const programs = normArr(targets.programs || []);
      
      const canonicalTargets = { batches, sectionsByBatch, programs };

      // Prepare event data with proper date handling and required fields
      const eventData = {
        title: req.body.title.trim(),
        description: req.body.description || existingEvent.description,
        category: req.body.category || existingEvent.category,
        hostCommittee: req.body.hostCommittee || existingEvent.hostCommittee,
        location: req.body.location.trim(),
        startsAt,
        endsAt,
        date, // Legacy field
        targets: canonicalTargets,
        meta: req.body.meta || existingEvent.meta || {},
        createdBy: existingEvent.createdBy, // Preserve original creator
        authorId: existingEvent.authorId, // Legacy field
        rsvpRequired: req.body.rsvpRequired ?? existingEvent.rsvpRequired,
        // Legacy target fields for backward compatibility
        targetBatches: batches,
        targetSections: normArr(req.body.targetSections || existingEvent.targetSections),
        targetBatchSections: normArr(req.body.targetBatchSections || existingEvent.targetBatchSections),
        rollNumberAttendees: normArr(req.body.rollNumberAttendees || existingEvent.rollNumberAttendees)
      };

      logOperation('info', { requestId, eventId, userId }, 'EVENT_UPDATE_START');

      // Validate the request body after adding required fields
      const validatedEventData = insertEventSchema.parse(eventData);

      // Log targets update
      logOperation('info', { 
        eventId, 
        targets: canonicalTargets, 
        requestId 
      }, 'EVENT_UPDATE_TARGETS');

      // Update using atomic method
      const updatedEvent = await storage.updateEvent(eventId, validatedEventData, requestId);

      logOperation('info', { requestId, eventId }, 'EVENT_UPDATE_SUCCESS');
      
      res.status(200).json({ 
        message: 'Event updated successfully', 
        event: updatedEvent
      });
    } catch (error) {
      logError(requestId, error, 'EVENT_UPDATE', { eventId: req.params.id });
      res.status(500).json({ error: 'internal_error', message: 'Failed to update event' });
    }
  });

  // Admin repair endpoint for missing attendance sheets  
  app.post('/api/admin/events/repair-sheets', requireAdmin, async (req: any, res) => {
    try {
      const requestId = req.headers['x-request-id'] || `repair_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      console.log(`🔧 [REPAIR_SHEETS] Starting repair - RequestID: ${requestId}`);
      
      const repairResult = await storage.repairMissingAttendanceSheets();
      
      console.log(`✅ [REPAIR_SHEETS] Completed - RequestID: ${requestId}`, repairResult);
      
      res.json({
        message: `Repaired ${repairResult.repaired} events with missing attendance sheets`,
        ...repairResult
      });
    } catch (error) {
      console.error('🚨 [REPAIR_SHEETS] Error:', error);
      res.status(500).json({ message: 'Failed to repair attendance sheets' });
    }
  });

  // Delete event
  app.delete('/api/events/:id', checkAuth, async (req: any, res) => {
    try {
      const userInfo = extractUser(req);
      const userId = userInfo?.id;
      const user = await storage.getUser(userId);
      const requestId = req.headers['x-request-id'] || `evt_delete_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
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

      logOperation('info', { requestId, eventId, userId }, 'EVENT_DELETE_START');

      // Use existing delete method (already has cascade implemented)
      const deleteResult = await storage.deleteEventWithCascade(eventId);

      logOperation('info', {
        requestId,
        eventId,
        sheetFound: deleteResult.sheetFound,
        rowsDeleted: deleteResult.rowsDeleted
      }, 'EVENT_DELETE_CASCADE');
      
      res.json({ message: 'Event deleted successfully', ...deleteResult });
    } catch (error) {
      logOperation('error', { error: error instanceof Error ? error.message : String(error) }, 'EVENT_DELETE_ERROR');
      res.status(500).json({ message: 'Failed to delete event' });
    }
  });

  // Admin repair endpoint for missing attendance sheets
  app.post('/api/admin/repair-attendance-sheets', requireAdmin, async (req: any, res) => {
    try {
      const userInfo = extractUser(req);
      const userId = userInfo?.id;
      const requestId = req.headers['x-request-id'] || `repair_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      logOperation('info', { requestId, userId }, 'REPAIR_ATTENDANCE_SHEETS_START');

      const allEvents = await storage.getEvents();
      let repairedCount = 0;

      for (const event of allEvents) {
        if (event.targetBatchSections && event.targetBatchSections.length > 0) {
          // Check if attendance sheets exist
          const existingSheets = await storage.getAttendanceSheetsByEventId(event.id);
          const existingBatchSections = existingSheets.map(sheet => `${sheet.batch}::${sheet.section}`);
          
          const missingBatchSections = event.targetBatchSections.filter(
            batchSection => !existingBatchSections.includes(batchSection)
          );

          if (missingBatchSections.length > 0) {
            await storage.createEventAttendanceSheets(event.id, missingBatchSections, userId);
            repairedCount++;
            logOperation('warn', { 
              requestId, 
              eventId: event.id, 
              missingSheets: missingBatchSections.length,
              eventTitle: event.title
            }, 'REPAIRED_MISSING_SHEET');
          }
        }
      }

      logOperation('info', { requestId, totalEvents: allEvents.length, repairedCount }, 'REPAIR_ATTENDANCE_SHEETS_COMPLETE');

      res.json({ 
        message: `Repair completed. Fixed ${repairedCount} events with missing attendance sheets.`,
        totalEvents: allEvents.length,
        repairedCount
      });
    } catch (error) {
      logOperation('error', { error: error instanceof Error ? error.message : String(error) }, 'REPAIR_ATTENDANCE_SHEETS_ERROR');
      res.status(500).json({ message: 'Failed to repair attendance sheets' });
    }
  });

  // Delete event
  app.delete('/api/events/:id', checkAuth, async (req: any, res) => {
    try {
      const userInfo = extractUser(req);
      const userId = userInfo?.id;
      const user = await storage.getUser(userId);
      const requestId = req.headers['x-request-id'] || `evt_delete_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
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

      logOperation('info', { requestId, eventId, userId }, 'EVENT_DELETE_START');
      
      // Use safe deletion method that handles missing columns gracefully
      try {
        // Try cascade method first if it exists
        if (storage.deleteEventWithCascade) {
          const deleteResult = await storage.deleteEventWithCascade(eventId);
          logOperation('info', { requestId, eventId, result: deleteResult }, 'EVENT_DELETE_CASCADE_SUCCESS');
          res.json({ message: 'Event deleted successfully', ...deleteResult });
          return;
        }
        
        // Fallback: Delete event and handle attendance cleanup safely
        await storage.deleteEvent(eventId);
        
        // Try to clean up attendance data if it exists
        try {
          await storage.deleteAttendanceByEventId?.(eventId);
        } catch (attendanceError) {
          // Log but don't fail if attendance cleanup fails
          logOperation('warn', { requestId, eventId, error: attendanceError instanceof Error ? attendanceError.message : String(attendanceError) }, 'ATTENDANCE_CLEANUP_WARNING');
        }
        
        logOperation('info', { requestId, eventId }, 'EVENT_DELETE_SUCCESS');
        res.json({ message: 'Event deleted successfully' });
      } catch (deleteError) {
        throw deleteError;
      }
    } catch (error) {
      logError(requestId, error, 'EVENT_DELETE', { eventId: req.params.id });
      res.status(500).json({ error: 'internal_error', message: 'Failed to delete event' });
    }
  });

  // Admin repair endpoint for missing attendance sheets
  app.post('/api/admin/repair-attendance-sheets', requireAdmin, async (req: any, res) => {
    try {
      const userInfo = extractUser(req);
      const userId = userInfo?.id;
      const requestId = req.headers['x-request-id'] || `repair_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      logOperation('info', { requestId, userId }, 'REPAIR_ATTENDANCE_SHEETS_START');

      const allEvents = await storage.getEvents();
      let repairedCount = 0;

      for (const event of allEvents) {
        if (event.targetBatchSections && event.targetBatchSections.length > 0) {
          // Check if attendance sheets exist
          const existingSheets = await storage.getAttendanceSheetsByEventId(event.id);
          const existingBatchSections = existingSheets.map(sheet => `${sheet.batch}::${sheet.section}`);
          
          const missingBatchSections = event.targetBatchSections.filter(
            batchSection => !existingBatchSections.includes(batchSection)
          );

          if (missingBatchSections.length > 0) {
            await storage.createEventAttendanceSheets(event.id, missingBatchSections, userId);
            repairedCount++;
            logOperation('warn', { 
              requestId, 
              eventId: event.id, 
              missingSheets: missingBatchSections.length,
              eventTitle: event.title
            }, 'REPAIRED_MISSING_SHEET');
          }
        }
      }

      logOperation('info', { requestId, totalEvents: allEvents.length, repairedCount }, 'REPAIR_ATTENDANCE_SHEETS_COMPLETE');

      res.json({ 
        message: `Repair completed. Fixed ${repairedCount} events with missing attendance sheets.`,
        totalEvents: allEvents.length,
        repairedCount
      });
    } catch (error) {
      logOperation('error', { error: error instanceof Error ? error.message : String(error) }, 'REPAIR_ATTENDANCE_SHEETS_ERROR');
      res.status(500).json({ message: 'Failed to repair attendance sheets' });
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

  // Get all sections
  app.get('/api/sections', checkAuth, async (req: any, res) => {
    try {
      const sections = await storage.getAllSections();
      res.json(sections);
    } catch (error) {
      console.error('Error fetching sections:', error);
      res.status(500).json({ message: 'Failed to fetch sections' });
    }
  });

  // NEW: Get sections for a specific batch (needed for waterfall UX)
  app.get('/api/batches/:batch/sections', checkAuth, async (req: any, res) => {
    try {
      const batch = decodeURIComponent(req.params.batch);
      const sections = await storage.getSectionsForBatch(batch);
      res.json(sections);
    } catch (error) {
      console.error('Error fetching sections for batch:', error);
      res.status(500).json({ message: 'Failed to fetch sections for batch' });
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

  // ======== CANONICAL ATTENDANCE MANAGEMENT APIs ========
  
  // Get attendance summary and records for an event (managers/admin only)
  app.get('/api/events/:id/attendance', requireEventsManage, async (req: any, res) => {
    try {
      const userInfo = extractUser(req);
      const userId = userInfo?.id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const eventId = parseInt(req.params.id);
      const requestId = req.headers['x-request-id'] || `att_get_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Verify event exists
      const event = await storage.getEventById(eventId);
      if (!event) {
        return res.status(404).json({ message: 'Event not found' });
      }

      logOperation('info', {
        requestId,
        eventId,
        userId,
        userRole: user.role
      }, 'CANONICAL_ATTENDANCE_GET_REQUEST');

      // Get attendance container for summary stats
      const container = await storage.getAttendanceContainer(eventId);
      
      // Get all attendance records for this event
      const records = await storage.getAttendanceRecords(eventId);
      
      // Get attendance sheets if they exist
      const sheets = await storage.getAttendanceSheetsByEventId(eventId);
      
      const response = {
        eventId,
        eventTitle: event.title,
        container,
        records,
        sheets,
        totalRecords: records.length
      };
      
      logOperation('info', {
        requestId,
        eventId,
        recordCount: records.length,
        containerExists: !!container
      }, 'CANONICAL_ATTENDANCE_GET_RESPONSE');
      
      res.json(response);
    } catch (error) {
      logOperation('error', {
        error: error instanceof Error ? error.message : String(error),
        eventId: req.params.id
      }, 'CANONICAL_ATTENDANCE_GET_ERROR');
      res.status(500).json({ message: 'Failed to get attendance data' });
    }
  });

  // Regenerate attendance sheets for an event (admin only)
  app.post('/api/events/:id/regenerate-attendance', requireAdmin, async (req: any, res) => {
    try {
      const eventId = parseInt(req.params.id);
      const userId = req.session.user.id;
      
      // Get the event
      const event = await storage.getEventById(eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      // Delete existing attendance sheets for this event
      await storage.deleteAttendanceSheetsForEvent(eventId);

      // Recreate attendance sheets using the same logic as event creation
      if (event.targetBatchSections && event.targetBatchSections.length > 0) {
        const createdSheets = [];
        
        for (const batchSection of event.targetBatchSections) {
          const [batch, section] = batchSection.split('::');
          if (batch && section) {
            try {
              // Create attendance sheet
              const sheet = await storage.createAttendanceSheet({
                eventId: event.id,
                batch,
                section,
                createdBy: userId,
              });

              // Get all students in this batch-section and create attendance records
              const students = await db
                .select()
                .from(studentDirectory)
                .where(and(eq(studentDirectory.batch, batch), eq(studentDirectory.section, batchSection)));

              if (students.length > 0) {
                const attendanceRecords = students.map(student => ({
                  sheetId: sheet.id,
                  studentEmail: student.email,
                  studentName: student.email.split('@')[0] || '',
                  rollNumber: student.rollNumber || null,
                  status: 'UNMARKED' as const,
                }));

                await storage.createAttendanceRecords(attendanceRecords);
                console.log(`Regenerated attendance sheet for event ${eventId} with ${students.length} students from ${batchSection}`);
                createdSheets.push({ sheet, studentCount: students.length });
              }
            } catch (error) {
              console.error(`Failed to regenerate attendance sheet for event ${eventId}, batch-section ${batchSection}:`, error);
            }
          }
        }

        res.json({
          message: `Successfully regenerated attendance sheets for event "${event.title}"`,
          sheets: createdSheets,
        });
      } else {
        res.json({
          message: "Event has no target batch sections, no attendance sheets created",
        });
      }
    } catch (error) {
      console.error("Error regenerating attendance sheets:", error);
      res.status(500).json({ message: "Failed to regenerate attendance sheets" });
    }
  });

  // Mark attendance for students (bulk or individual) - managers/admin only
  app.post('/api/events/:id/attendance/mark', requireEventsManage, async (req: any, res) => {
    try {
      const userInfo = extractUser(req);
      const userId = userInfo?.id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const eventId = parseInt(req.params.id);
      const requestId = req.headers['x-request-id'] || `att_mark_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Verify event exists
      const event = await storage.getEventById(eventId);
      if (!event) {
        return res.status(404).json({ message: 'Event not found' });
      }

      const { records, bulkAction } = req.body;
      
      logOperation('info', {
        requestId,
        eventId,
        userId,
        recordCount: records?.length || 0,
        bulkAction: bulkAction || 'none'
      }, 'CANONICAL_ATTENDANCE_MARK_REQUEST');

      let updatedRecords = [];
      
      if (bulkAction) {
        // Handle bulk actions: mark-all-present, mark-all-absent, clear-all
        const allowedBulkActions = ['mark-all-present', 'mark-all-absent', 'clear-all'];
        if (!allowedBulkActions.includes(bulkAction)) {
          return res.status(400).json({ message: 'Invalid bulk action' });
        }
        
        const bulkResult = await storage.bulkUpdateAttendance(eventId, bulkAction, userId);
        updatedRecords = bulkResult.updatedRecords || [];
        
        logOperation('info', {
          requestId,
          eventId,
          bulkAction,
          updatedCount: updatedRecords.length
        }, 'CANONICAL_ATTENDANCE_BULK_ACTION');
      } else if (records && Array.isArray(records)) {
        // Handle individual record updates
        for (const recordData of records) {
          const validatedRecord = {
            ...recordData,
            eventId,
            markedBy: userId,
            markedAt: new Date()
          };
          
          const updatedRecord = await storage.updateAttendanceRecord(validatedRecord);
          if (updatedRecord) {
            updatedRecords.push(updatedRecord);
          }
        }
        
        logOperation('info', {
          requestId,
          eventId,
          individualUpdates: updatedRecords.length
        }, 'CANONICAL_ATTENDANCE_INDIVIDUAL_UPDATES');
      }

      // Update attendance container summary stats
      await storage.updateAttendanceContainerStats(eventId);
      
      // Get updated container stats
      const updatedContainer = await storage.getAttendanceContainer(eventId);
      
      res.json({
        message: 'Attendance updated successfully',
        updatedRecords,
        container: updatedContainer,
        totalUpdated: updatedRecords.length
      });
    } catch (error) {
      logOperation('error', {
        error: error instanceof Error ? error.message : String(error),
        eventId: req.params.id
      }, 'CANONICAL_ATTENDANCE_MARK_ERROR');
      res.status(500).json({ message: 'Failed to mark attendance' });
    }
  });

  // Sync attendance roster with student directory - managers/admin only
  app.post('/api/events/:id/attendance/sync', requireEventsManage, async (req: any, res) => {
    try {
      const userInfo = extractUser(req);
      const userId = userInfo?.id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const eventId = parseInt(req.params.id);
      const requestId = req.headers['x-request-id'] || `att_sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Verify event exists
      const event = await storage.getEventById(eventId);
      if (!event) {
        return res.status(404).json({ message: 'Event not found' });
      }

      logOperation('info', {
        requestId,
        eventId,
        userId
      }, 'CANONICAL_ATTENDANCE_SYNC_REQUEST');

      // Get canonical targets or adapt from legacy
      let targets;
      if (event.targets && (event.targets.batches?.length > 0 || event.targets.sections?.length > 0 || event.targets.programs?.length > 0)) {
        targets = event.targets;
      } else {
        targets = adaptLegacyTargets({
          targetBatches: event.targetBatches || [],
          targetSections: event.targetSections || [],
          targetBatchSections: event.targetBatchSections || [],
          rollNumberAttendees: event.rollNumberAttendees || []
        });
      }
      
      // Get all students from directory
      const allStudents = await storage.getStudentDirectory();
      
      // Filter eligible students using canonical eligibility
      const eligibleStudents = allStudents.filter(student => {
        return isEligible({
          batch: student.batch,
          section: student.section,
          program: student.program,
          email: student.email,
          role: 'student'
        }, targets);
      });
      
      // Sync attendance records
      const syncResult = await storage.syncAttendanceRecords(eventId, eligibleStudents, userId);
      
      // Update container stats
      await storage.updateAttendanceContainerStats(eventId);
      const updatedContainer = await storage.getAttendanceContainer(eventId);
      
      logOperation('info', {
        requestId,
        eventId,
        eligibleStudents: eligibleStudents.length,
        syncResult
      }, 'CANONICAL_ATTENDANCE_SYNC_SUCCESS');
      
      res.json({
        message: 'Attendance roster synced successfully',
        eligibleStudents: eligibleStudents.length,
        syncResult,
        container: updatedContainer
      });
    } catch (error) {
      logOperation('error', {
        error: error instanceof Error ? error.message : String(error),
        eventId: req.params.id
      }, 'CANONICAL_ATTENDANCE_SYNC_ERROR');
      res.status(500).json({ message: 'Failed to sync attendance roster' });
    }
  });

  // Legacy Update a single attendance record (keep for compatibility)
  app.put('/api/attendance/records/:id', requireEventsManage, async (req: any, res) => {
    try {
      const recordId = parseInt(req.params.id);
      const { status, note } = req.body;
      const userId = req.session.user.id;

      // Validate status
      const validStatuses = ['UNMARKED', 'PRESENT', 'ABSENT', 'LATE'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: "Invalid status. Must be one of: " + validStatuses.join(', ') });
      }

      const updatedRecord = await storage.updateAttendanceRecord(recordId, status, note, userId);
      res.json(updatedRecord);
    } catch (error) {
      console.error("Error updating attendance record:", error);
      res.status(500).json({ message: "Failed to update attendance record" });
    }
  });

  // Bulk update all records in a sheet
  app.put('/api/attendance/sheets/:id/bulk', adminOnly(), async (req: any, res) => {
    try {
      const sheetId = parseInt(req.params.id);
      const { status } = req.body;
      const userId = req.session.user.id;

      // Validate status
      const validStatuses = ['UNMARKED', 'PRESENT', 'ABSENT', 'LATE'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: "Invalid status. Must be one of: " + validStatuses.join(', ') });
      }

      await storage.bulkUpdateAttendanceRecords(sheetId, status, userId);
      const updatedRecords = await storage.getAttendanceRecordsBySheetId(sheetId);
      res.json(updatedRecords);
    } catch (error) {
      console.error("Error bulk updating attendance records:", error);
      res.status(500).json({ message: "Failed to bulk update attendance records" });
    }
  });

  // Sync students to attendance sheet (add new students, archive removed ones)
  app.post('/api/attendance/sheets/:id/sync', adminOnly(), async (req: any, res) => {
    try {
      const sheetId = parseInt(req.params.id);
      
      // Get the attendance sheet to know which batch/section to sync
      const sheet = await storage.getAttendanceSheetById(sheetId);
      if (!sheet) {
        return res.status(404).json({ message: "Attendance sheet not found" });
      }
      
      // Use sheet's batch and section for sync
      const { batch, section } = sheet;
      
      // Allow override via request body if needed
      // Optional: allow override from request body
      const batchToSync = req.body.batch || batch;
      const sectionToSync = req.body.section || section;
      
      if (!batchToSync || !sectionToSync) {
        return res.status(400).json({ message: "Could not determine batch and section for sync" });
      }

      const updatedRecords = await storage.syncStudentsToAttendanceSheet(sheetId, batchToSync, sectionToSync);
      res.json({
        message: `Synced students for ${batchToSync}::${sectionToSync}`,
        records: updatedRecords,
      });
    } catch (error) {
      console.error("Error syncing students to attendance sheet:", error);
      res.status(500).json({ message: "Failed to sync students" });
    }
  });

  // Export attendance sheet as CSV
  app.get('/api/attendance/sheets/:id/export', adminOnly(), async (req: any, res) => {
    try {
      const sheetId = parseInt(req.params.id);
      
      const records = await storage.getAttendanceRecordsBySheetId(sheetId);
      
      // Create CSV content
      const headers = ['Roll No', 'Student Name', 'Email', 'Status', 'Note', 'Marked By', 'Marked At'];
      const csvRows = [
        headers.join(','),
        ...records.map(record => [
          record.rollNumber || '',
          record.studentName,
          record.studentEmail,
          record.status,
          record.note || '',
          record.markedBy || '',
          record.markedAt ? new Date(record.markedAt).toLocaleString() : '',
        ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
      ];
      
      const csvContent = csvRows.join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="attendance-sheet-${sheetId}.csv"`);
      res.send(csvContent);
    } catch (error) {
      console.error("Error exporting attendance sheet:", error);
      res.status(500).json({ message: "Failed to export attendance sheet" });
    }
  });

  // Community Board routes (Section 1) - Reddit-like functionality
  app.get('/api/community/posts', async (req, res) => {
    try {
      const { tag, limit, scope } = req.query;
      const requestId = `posts_get_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      console.log(`🔍 [FORUM-GET] Fetching posts - Tag: ${tag || 'none'}, Limit: ${limit || 'none'}, Scope: ${scope || 'posts'}, RequestID: ${requestId}`);
      
      let allPosts = [];
      
      // If scope=all, get both community posts and announcements
      if (scope === 'all') {
        const [posts, announcements] = await Promise.all([
          storage.getCommunityPosts(),
          storage.getCommunityAnnouncements()
        ]);
        
        // Transform announcements to match post structure and add source field
        const transformedAnnouncements = announcements.map(ann => ({
          ...ann,
          source: 'announcement' as const
        }));
        
        const transformedPosts = posts.map(post => ({
          ...post,
          source: 'forum' as const
        }));
        
        allPosts = [...transformedPosts, ...transformedAnnouncements];
        console.log(`📊 [FORUM-GET] Combined ${posts.length} posts + ${announcements.length} announcements = ${allPosts.length}, RequestID: ${requestId}`);
      } else {
        const posts = await storage.getCommunityPosts();
        allPosts = posts.map(post => ({ ...post, source: 'forum' as const }));
        console.log(`📊 [FORUM-GET] Retrieved ${allPosts.length} community posts, RequestID: ${requestId}`);
      }
      
      let filteredPosts = allPosts;
      
      // Filter by tag (case-insensitive) - check title and content
      if (tag) {
        const tagLower = (tag as string).toLowerCase();
        filteredPosts = allPosts.filter(post => 
          post.title?.toLowerCase().includes(tagLower) ||
          post.content?.toLowerCase().includes(tagLower) ||
          post.category?.toLowerCase().includes(tagLower)
        );
        console.log(`🏷️ [FORUM-GET] Filtered ${allPosts.length} -> ${filteredPosts.length} posts by tag '${tag}', RequestID: ${requestId}`);
      }
      
      // Sort by creation date (newest first)
      filteredPosts.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
      
      // Apply limit if specified
      if (limit) {
        const limitNum = parseInt(limit as string, 10);
        if (!isNaN(limitNum) && limitNum > 0) {
          filteredPosts = filteredPosts.slice(0, limitNum);
          console.log(`📏 [FORUM-GET] Limited to ${limitNum} posts, RequestID: ${requestId}`);
        }
      }
      
      console.log(`✅ [FORUM-GET] Returning ${filteredPosts.length} posts, RequestID: ${requestId}`);
      res.json(filteredPosts);
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
  app.post('/api/amenities/menu/upload', authorizeAmenities('menuUpload'), upload.single('menuFile'), async (req: any, res) => {
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
      
      // RBAC middleware already handled permission check

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

  // Edit individual menu items (RBAC protected)
  app.put('/api/amenities/menu/:id', authorizeAmenities('menuUpload'), async (req: any, res) => {
    try {
      const userInfo = extractUser(req);
      if (!userInfo) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const menuId = parseInt(req.params.id);
      const { mealType, items } = req.body;

      if (!mealType || items === undefined) {
        return res.status(400).json({ message: "mealType and items are required" });
      }

      // Validate mealType
      const validMealTypes = ['breakfast', 'lunch', 'eveningSnacks', 'dinner'];
      if (!validMealTypes.includes(mealType)) {
        return res.status(400).json({ message: "Invalid meal type" });
      }

      // Convert items array to comma-separated string if needed
      const itemsString = Array.isArray(items) ? items.join(', ') : items;

      const updated = await storage.updateWeeklyMenu(menuId, { mealType, items: itemsString });
      
      if (!updated) {
        return res.status(404).json({ message: "Menu not found" });
      }

      // Broadcast the menu update to all connected clients
      broadcastToClients({
        type: 'MENU_UPDATED',
        data: {
          menuId,
          mealType,
          date: updated.date,
          updatedMenu: updated
        }
      });

      res.json({
        message: `${mealType} updated successfully`,
        data: updated
      });
    } catch (error) {
      console.error("Error updating menu:", error);
      res.status(500).json({ message: "Failed to update menu" });
    }
  });

  // Book sick food - Enhanced with comprehensive diagnostics
  app.post('/api/amenities/sick-food', checkAuth, async (req: any, res) => {
    const requestId = req.headers['x-request-id'] || `sf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    
    // 1. REQUEST ENTRY LOGGING
    console.log(`🍽️ [SICK-FOOD-BOOKING] Request entry - Method: ${req.method}, Path: ${req.path}, RequestID: ${requestId}`);
    console.log(`👤 [SICK-FOOD-BOOKING] User session:`, {
      hasSession: !!req.session,
      userId: req.session?.user?.id,
      userEmail: req.session?.user?.email,
      requestId
    });
    
    try {
      const userId = req.session.user.id;
      
      // 2. BODY SNAPSHOT (safe fields only)
      const safeBodySnapshot = {
        hasDate: !!req.body.date,
        hasMealType: !!req.body.mealType,
        hasRoomNumber: !!req.body.roomNumber,
        hasSpecialRequirements: !!req.body.specialRequirements,
        hasPhoneNumber: !!req.body.phoneNumber,
        hasParcelMode: !!req.body.parcelMode,
        bodyKeys: Object.keys(req.body || {}),
        requestId
      };
      console.log(`📝 [SICK-FOOD-BOOKING] Request body snapshot:`, safeBodySnapshot);
      
      // 3. BEFORE VALIDATION
      console.log(`🔍 [SICK-FOOD-BOOKING] Starting validation - RequestID: ${requestId}`);
      
      const bookingData = insertSickFoodBookingSchema.parse({
        ...req.body,
        userId,
        date: new Date(req.body.date),
      });
      
      // 4. BEFORE DB INSERT
      console.log(`💾 [SICK-FOOD-BOOKING] Payload validated, calling DB insert - RequestID: ${requestId}`);
      console.log(`📊 [SICK-FOOD-BOOKING] Validated payload:`, {
        userId: bookingData.userId,
        date: bookingData.date.toISOString(),
        mealType: bookingData.mealType,
        roomNumber: bookingData.roomNumber,
        hasSpecialRequirements: !!bookingData.specialRequirements,
        phoneNumber: bookingData.phoneNumber ? `***${bookingData.phoneNumber.slice(-4)}` : 'None',
        parcelMode: bookingData.parcelMode,
        requestId
      });
      
      const booking = await storage.bookSickFood(bookingData);
      
      // 5. AFTER DB CALL
      const responseTime = Date.now() - startTime;
      console.log(`✅ [SICK-FOOD-BOOKING] DB insert successful - RequestID: ${requestId}, Response time: ${responseTime}ms`);
      console.log(`🎯 [SICK-FOOD-BOOKING] Insert result:`, {
        insertedId: booking.id,
        createdAt: booking.createdAt,
        userId: booking.userId,
        requestId
      });
      
      // Enhanced response with diagnostics
      const response = {
        ...booking,
        _diagnostics: {
          requestId,
          responseTime: `${responseTime}ms`,
          timestamp: new Date().toISOString(),
          success: true
        }
      };
      
      console.log(`📤 [SICK-FOOD-BOOKING] Sending success response - RequestID: ${requestId}`);
      
      // TRIAGE: Immediate read-after-write verification
      setTimeout(async () => {
        try {
          console.log(`🔬 [TRIAGE-READ-AFTER-WRITE] Verifying booking visibility - RequestID: ${requestId}`);
          const verifyBookings = await storage.getSickFoodBookings();
          const newBooking = verifyBookings.find(b => b.id === booking.id);
          console.log(`🔬 [TRIAGE-READ-AFTER-WRITE] Found new booking:`, newBooking ? { id: newBooking.id, date: newBooking.date, mealType: newBooking.mealType } : 'NOT FOUND');
          console.log(`🔬 [TRIAGE-READ-AFTER-WRITE] Total bookings now: ${verifyBookings.length}`);
        } catch (error) {
          console.error(`❌ [TRIAGE-READ-AFTER-WRITE] Verification failed - RequestID: ${requestId}:`, error);
        }
      }, 100);
      
      res.json(response);
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      // 6. ON ERROR - FULL STACK TRACE
      console.error(`❌ [SICK-FOOD-BOOKING] ERROR - RequestID: ${requestId}, Response time: ${responseTime}ms`);
      console.error(`🚨 [SICK-FOOD-BOOKING] Error details:`, {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : 'UnknownError',
        requestId,
        userId: req.session?.user?.id,
        bodyReceived: !!req.body,
        requestHeaders: {
          contentType: req.headers['content-type'],
          userAgent: req.headers['user-agent'],
          origin: req.headers['origin']
        }
      });
      
      // Ensure logs flush immediately
      process.stdout.write('');
      
      res.status(500).json({ 
        message: "Failed to book sick food",
        _diagnostics: {
          requestId,
          responseTime: `${responseTime}ms`,
          timestamp: new Date().toISOString(),
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  });

  // Get sick food bookings with date filter - Enhanced with diagnostics
  app.get('/api/amenities/sick-food', async (req: any, res) => {
    const requestId = req.headers['x-request-id'] || `sf_get_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    
    // Check authentication first
    if (!req.session?.user?.id) {
      return res.status(401).json({ message: "Authentication required" });
    }
    
    const scope = req.query.scope as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 5;
    
    console.log(`📋 [SICK-FOOD-GET] Fetching bookings - RequestID: ${requestId}`);
    console.log(`👤 [SICK-FOOD-GET] User session:`, {
      hasSession: !!req.session,
      userId: req.session?.user?.id,
      userEmail: req.session?.user?.email,
      role: req.session?.user?.role,
      scope,
      page,
      limit,
      requestId
    });
    
    // If scope=mine, user can access their own bookings without admin permission
    if (scope !== 'mine') {
      // For admin access to all bookings, use the authorization middleware
      const authResult = await new Promise<boolean>((resolve) => {
        authorizeAmenities('sickFoodAccess')(req as any, res as any, (err: any) => {
          if (err) resolve(false);
          else resolve(true);
        });
      });
      
      if (!authResult) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
    }
    
    try {
      const date = req.query.date ? new Date(req.query.date as string) : undefined;
      const userId = scope === 'mine' ? req.session.user.id : undefined;
      
      console.log(`🔍 [SICK-FOOD-GET] Query params - Date filter: ${date ? date.toISOString() : 'None'}, UserScope: ${userId || 'All'}, RequestID: ${requestId}`);
      
      const bookings = await storage.getSickFoodBookings(date, userId);
      
      // Apply pagination for scope=mine
      let paginatedBookings = bookings;
      let total = bookings.length;
      
      if (scope === 'mine') {
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        paginatedBookings = bookings.slice(startIndex, endIndex);
      }
      
      const responseTime = Date.now() - startTime;
      
      console.log(`✅ [SICK-FOOD-GET] Bookings retrieved - Count: ${paginatedBookings.length}, Total: ${total}, RequestID: ${requestId}, Response time: ${responseTime}ms`);
      console.log(`📊 [SICK-FOOD-GET] Bookings sample:`, paginatedBookings.slice(0, 2).map(b => ({ id: b.id, date: b.date, mealType: b.mealType, userId: b.userId })));
      
      // Format response based on scope
      if (scope === 'mine') {
        const formattedData = paginatedBookings.map(booking => ({
          id: booking.id.toString(),
          createdAt: (booking.createdAt || new Date()).toISOString(),
          status: 'approved', // Sick food bookings are always approved when created
          type: 'sickFood',
          title: 'Sick Food',
          details: booking.specialRequirements || 'No special requirements',
          dateRange: { from: booking.date.toISOString() },
          meal: booking.mealType,
          hostel: `Room ${booking.roomNumber}`,
        }));
        
        res.json({
          data: formattedData,
          total,
          page,
          limit,
        });
      } else {
        // Keep original format for admin compatibility
        res.json(bookings);
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.error(`❌ [SICK-FOOD-GET] Error fetching bookings - RequestID: ${requestId}, Response time: ${responseTime}ms:`, error);
      res.status(500).json({ message: "Failed to fetch sick food bookings" });
    }
  });

  // Apply for hostel leave with Google Form integration
  app.post('/api/hostel/leave', checkAuth, async (req: any, res) => {
    const requestId = req.headers['x-request-id'] || `leave_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    
    console.log(`🏠 [LEAVE-APPLICATION] Request entry - RequestID: ${requestId}`);
    console.log(`👤 [LEAVE-APPLICATION] User session:`, {
      userId: req.session?.user?.id,
      userEmail: req.session?.user?.email,
      requestId
    });
    
    try {
      const userId = req.session.user.id;
      const correlationId = generateCorrelationId();
      
      console.log(`📝 [LEAVE-APPLICATION] Processing submission - Correlation ID: ${correlationId}, RequestID: ${requestId}`);
      
      // Validate and prepare data for local storage
      const leaveData = insertHostelLeaveSchema.parse({
        ...req.body,
        userId,
        startDate: new Date(req.body.startDate),
        endDate: new Date(req.body.endDate),
        correlationId,
      });
      
      console.log(`📊 [LEAVE-APPLICATION] Validated payload:`, {
        userId: leaveData.userId,
        email: `***${leaveData.email.slice(-4)}`,
        startDate: leaveData.startDate.toISOString(),
        endDate: leaveData.endDate.toISOString(),
        leaveCity: leaveData.leaveCity,
        correlationId,
        requestId
      });
      
      // Prepare data for Google Form submission
      const googleFormData: LeaveFormData = {
        email: leaveData.email,
        reason: leaveData.reason,
        leaveFrom: leaveData.startDate.toISOString().split('T')[0], // YYYY-MM-DD format
        leaveTo: leaveData.endDate.toISOString().split('T')[0],
        leaveCity: leaveData.leaveCity,
        correlationId,
      };
      
      // Attempt Google Form submission
      console.log(`🔗 [LEAVE-APPLICATION] Attempting Google Form submission - RequestID: ${requestId}`);
      const googleStatus = await submitToGoogleForm(googleFormData, 1);
      
      console.log(`${googleStatus.ok ? '✅' : '❌'} [LEAVE-APPLICATION] Google Form ${googleStatus.ok ? 'succeeded' : 'failed'} - Status: ${googleStatus.statusCode}, Latency: ${googleStatus.latencyMs}ms, RequestID: ${requestId}`);
      
      // Save to local database with Google status
      const leaveWithGoogleStatus = {
        ...leaveData,
        googleStatus,
      };
      
      console.log(`💾 [LEAVE-APPLICATION] Saving to database - RequestID: ${requestId}`);
      const leave = await storage.applyForLeave(leaveWithGoogleStatus);
      
      const responseTime = Date.now() - startTime;
      console.log(`✅ [LEAVE-APPLICATION] Application saved - ID: ${leave.id}, RequestID: ${requestId}, Response time: ${responseTime}ms`);
      
      // Return comprehensive response
      const response = {
        ...leave,
        _diagnostics: {
          requestId,
          correlationId,
          responseTime: `${responseTime}ms`,
          timestamp: new Date().toISOString(),
          google: googleStatus,
          success: true
        }
      };
      
      res.json(response);
      
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      console.error(`❌ [LEAVE-APPLICATION] ERROR - RequestID: ${requestId}, Response time: ${responseTime}ms:`, error);
      console.error(`🚨 [LEAVE-APPLICATION] Error details:`, {
        message: error.message,
        stack: error.stack,
        requestId,
        userId: req.session?.user?.id
      });
      
      res.status(500).json({ 
        message: "Failed to apply for leave",
        _diagnostics: {
          requestId,
          responseTime: `${responseTime}ms`,
          timestamp: new Date().toISOString(),
          success: false,
          error: error.message
        }
      });
    }
  });

  // Get leave applications
  app.get('/api/hostel/leave', authorizeAmenities('leaveApplicationAccess'), async (req: any, res) => {
    try {
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

  // Retry Google Form sync endpoint for leave applications
  app.post('/api/hostel/leave/:id/retry-google-sync', authorizeAmenities('leaveApplicationAccess'), async (req: any, res) => {
    try {
      const applicationId = parseInt(req.params.id);
      console.log(`🔄 [LEAVE-APP] Manual retry requested for application ID: ${applicationId}`);
      
      // Get the application
      const applications = await storage.getLeaveApplications();
      const application = applications.find((app: any) => app.id === applicationId);
      
      if (!application) {
        return res.status(404).json({ error: 'Leave application not found' });
      }
      
      // Check if retry is allowed
      if (application.googleStatus?.ok) {
        return res.status(400).json({ error: 'Application already synced successfully' });
      }
      
      if ((application.googleStatus?.attempts || 0) >= 5) {
        return res.status(400).json({ error: 'Maximum retry attempts reached' });
      }
      
      // Prepare data for Google Form retry
      const googleFormData: LeaveFormData = {
        email: application.email || '',
        reason: application.reason,
        leaveFrom: typeof application.startDate === 'string' ? application.startDate : application.startDate.toISOString().split('T')[0],
        leaveTo: typeof application.endDate === 'string' ? application.endDate : application.endDate.toISOString().split('T')[0],
        leaveCity: application.leaveCity || '',
        correlationId: application.correlationId || ''
      };
      
      // Attempt retry
      const nextAttempt = (application.googleStatus?.attempts || 0) + 1;
      const googleStatus = await submitToGoogleForm(googleFormData, nextAttempt);
      
      // Update the application with Google Form result
      await storage.updateLeaveGoogleStatus(applicationId, googleStatus);
      console.log(`📤 [LEAVE-APP] Google Form retry result:`, googleStatus);
      
      res.json({ 
        success: true, 
        message: 'Google Form sync retry completed',
        googleStatus,
        correlationId: application.correlationId
      });
    } catch (error) {
      console.error('Error retrying Google Form sync:', error);
      res.status(500).json({ error: 'Failed to retry Google Form sync' });
    }
  });

  // Admin approve leave application (direct admin action)
  app.post('/api/hostel/leave/:id/approve', authorizeAmenities('leaveApplicationAccess'), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const leave = await storage.updateLeaveStatus(id, 'approved');
      res.json({ message: "Leave approved successfully", leave });
    } catch (error) {
      console.error("Error approving leave:", error);
      res.status(500).json({ message: "Failed to approve leave" });
    }
  });

  // Admin deny leave application (direct admin action)
  app.post('/api/hostel/leave/:id/deny', authorizeAmenities('leaveApplicationAccess'), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const leave = await storage.updateLeaveStatus(id, 'rejected');
      res.json({ message: "Leave denied successfully", leave });
    } catch (error) {
      console.error("Error denying leave:", error);
      res.status(500).json({ message: "Failed to deny leave" });
    }
  });

  // Retry Google Form submission for leave application
  app.post('/api/hostel/leave/:id/google-sync', authorizeAmenities('leaveApplicationAccess'), async (req: any, res) => {
    const requestId = req.headers['x-request-id'] || `retry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    
    console.log(`🔄 [LEAVE-RETRY] Google sync retry - ID: ${req.params.id}, RequestID: ${requestId}`);
    
    try {
      const id = parseInt(req.params.id);
      const leave = await storage.getLeaveById(id);
      
      if (!leave) {
        return res.status(404).json({ message: "Leave application not found" });
      }
      
      if (!leave.correlationId) {
        return res.status(400).json({ message: "Leave application missing correlation ID" });
      }
      
      // Check if Google submission was already successful
      if (leave.googleStatus?.ok) {
        console.log(`✅ [LEAVE-RETRY] Already successful - ID: ${id}, RequestID: ${requestId}`);
        return res.json({ 
          message: "Google Form submission was already successful", 
          google: leave.googleStatus 
        });
      }
      
      // Prepare data for retry
      const googleFormData: LeaveFormData = {
        email: leave.email,
        reason: leave.reason,
        leaveFrom: leave.startDate.toISOString().split('T')[0],
        leaveTo: leave.endDate.toISOString().split('T')[0],
        leaveCity: leave.leaveCity,
        correlationId: leave.correlationId,
      };
      
      const currentAttempts = leave.googleStatus?.attempts || 0;
      console.log(`🔗 [LEAVE-RETRY] Retrying Google Form submission - Attempt: ${currentAttempts + 1}, RequestID: ${requestId}`);
      
      // Attempt Google Form submission
      const googleStatus = await submitToGoogleForm(googleFormData, currentAttempts + 1);
      
      console.log(`${googleStatus.ok ? '✅' : '❌'} [LEAVE-RETRY] Retry ${googleStatus.ok ? 'succeeded' : 'failed'} - Status: ${googleStatus.statusCode}, RequestID: ${requestId}`);
      
      // Update database with new Google status
      const updatedLeave = await storage.updateLeaveGoogleStatus(id, googleStatus);
      
      const responseTime = Date.now() - startTime;
      console.log(`💾 [LEAVE-RETRY] Database updated - ID: ${id}, RequestID: ${requestId}, Response time: ${responseTime}ms`);
      
      res.json({
        message: googleStatus.ok ? "Google Form submission successful" : "Google Form submission failed",
        leave: updatedLeave,
        google: googleStatus,
        _diagnostics: {
          requestId,
          responseTime: `${responseTime}ms`,
          timestamp: new Date().toISOString(),
          retryAttempt: googleStatus.attempts
        }
      });
      
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      console.error(`❌ [LEAVE-RETRY] ERROR - RequestID: ${requestId}, Response time: ${responseTime}ms:`, error);
      res.status(500).json({ 
        message: "Failed to retry Google Form submission",
        _diagnostics: {
          requestId,
          responseTime: `${responseTime}ms`,
          timestamp: new Date().toISOString(),
          error: error.message
        }
      });
    }
  });

  // Get individual leave application with Google status
  app.get('/api/hostel/leave/:id', authorizeAmenities('leaveApplicationAccess'), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const leave = await storage.getLeaveById(id);
      
      if (!leave) {
        return res.status(404).json({ message: "Leave application not found" });
      }
      
      // Mask sensitive information in response
      const sanitizedLeave = {
        ...leave,
        email: `***${leave.email.slice(-4)}`,
        googleStatus: leave.googleStatus ? {
          ...leave.googleStatus,
          error: leave.googleStatus.error ? leave.googleStatus.error.substring(0, 100) : undefined
        } : undefined
      };
      
      res.json(sanitizedLeave);
    } catch (error) {
      console.error("Error fetching leave application:", error);
      res.status(500).json({ message: "Failed to fetch leave application" });
    }
  });

  // Dry-run preview endpoint for Google Form debugging
  app.get('/api/leave/google-preview/:id', authorizeAmenities('leaveApplicationAccess'), async (req: any, res) => {
    const requestId = req.headers['x-request-id'] || `preview_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    
    try {
      const applicationId = parseInt(req.params.id);
      console.log(`🔍 [GOOGLE-PREVIEW] Generating preview for application ID: ${applicationId} - RequestID: ${requestId}`);
      
      const applications = await storage.getLeaveApplications();
      const application = applications.find((app: any) => app.id === applicationId);
      
      if (!application) {
        return res.status(404).json({ error: 'Leave application not found' });
      }
      
      // Build preview data
      const googleFormData: LeaveFormData = {
        email: application.email,
        reason: application.reason,
        leaveFrom: application.startDate.toISOString().split('T')[0],
        leaveTo: application.endDate.toISOString().split('T')[0],
        leaveCity: application.leaveCity,
        correlationId: application.correlationId || `preview-${applicationId}-${Date.now()}`
      };
      
      const preview = buildGoogleFormPreview(googleFormData);
      const prefillUrl = generatePrefillProbeUrl();
      
      const responseTime = Date.now() - startTime;
      
      console.log(`✅ [GOOGLE-PREVIEW] Preview generated - RequestID: ${requestId}, Response time: ${responseTime}ms`);
      
      res.json({
        applicationId,
        preview: {
          endpoint: preview.endpoint,
          bodyLength: preview.body.length,
          entryKeys: preview.entryKeys,
          maskedEmail: preview.maskedEmail,
          exactBody: preview.body
        },
        prefillUrl,
        mapping: {
          testInstructions: 'Open the prefillUrl in a new tab to validate field mappings. If fields appear prefilled, the IDs are correct.',
          currentMappings: preview.entryKeys
        },
        _diagnostics: {
          requestId,
          responseTime: `${responseTime}ms`,
          timestamp: new Date().toISOString()
        }
      });
      
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      console.error(`❌ [GOOGLE-PREVIEW] Error generating preview - RequestID: ${requestId}:`, error);
      res.status(500).json({ 
        error: 'Failed to generate Google Form preview',
        _diagnostics: {
          requestId,
          responseTime: `${responseTime}ms`,
          timestamp: new Date().toISOString(),
          error: error.message
        }
      });
    }
  });

  // Generate prefill probe URL for mapping validation
  app.get('/api/leave/prefill-probe', authorizeAmenities('leaveApplicationAccess'), async (req: any, res) => {
    const requestId = req.headers['x-request-id'] || `probe_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      console.log(`🔗 [PREFILL-PROBE] Generating prefill URL for mapping validation - RequestID: ${requestId}`);
      
      const prefillUrl = generatePrefillProbeUrl();
      
      res.json({
        prefillUrl,
        instructions: [
          "1. Open the prefillUrl in a new browser tab",
          "2. Check if all fields appear prefilled with test data",
          "3. If fields are empty, the entry IDs in googleFormMap.json need updating",
          "4. If you get authorization errors, ensure the form accepts public responses",
          "5. Go to Form Settings > Responses > uncheck 'Restrict to users in your domain'"
        ],
        testData: {
          email: "test@mail.com",
          reason: "Test Reason",
          leaveFrom: "25-08-2025",
          leaveTo: "28-08-2025",
          leaveCity: "Kolkata",
          correlationId: "test-mapping"
        },
        _diagnostics: {
          requestId,
          timestamp: new Date().toISOString()
        }
      });
      
    } catch (error: any) {
      console.error(`❌ [PREFILL-PROBE] Error generating prefill URL - RequestID: ${requestId}:`, error);
      res.status(500).json({ 
        error: 'Failed to generate prefill probe URL',
        _diagnostics: {
          requestId,
          timestamp: new Date().toISOString(),
          error: error.message
        }
      });
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

  // Get grievances
  app.get('/api/grievances', async (req: any, res) => {
    // Check authentication first
    if (!req.session?.user?.id) {
      return res.status(401).json({ message: "Authentication required" });
    }
    
    const scope = req.query.scope as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 5;
    
    // If scope=mine, user can access their own grievances without admin permission
    if (scope !== 'mine') {
      // For admin access to all grievances, use the authorization middleware
      const authResult = await new Promise<boolean>((resolve) => {
        authorizeAmenities('grievanceAccess')(req as any, res as any, (err: any) => {
          if (err) resolve(false);
          else resolve(true);
        });
      });
      
      if (!authResult) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
    }
    
    try {
      const category = req.query.category as string;
      const userId = scope === 'mine' ? req.session.user.id : undefined;
      
      const grievances = await storage.getGrievances(category, userId);
      
      // Apply pagination for scope=mine
      let paginatedGrievances = grievances;
      let total = grievances.length;
      
      if (scope === 'mine') {
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        paginatedGrievances = grievances.slice(startIndex, endIndex);
      }
      
      // Format response based on scope
      if (scope === 'mine') {
        const formattedData = paginatedGrievances.map(grievance => ({
          id: grievance.id.toString(),
          createdAt: (grievance.createdAt || new Date()).toISOString(),
          status: grievance.status as 'pending' | 'open' | 'resolved',
          type: 'grievance',
          title: grievance.category,
          details: grievance.description,
          hostel: `Room ${grievance.roomNumber}`,
        }));
        
        res.json({
          data: formattedData,
          total,
          page,
          limit,
        });
      } else {
        // Keep original format for admin compatibility
        res.json(grievances);
      }
    } catch (error) {
      console.error("Error fetching grievances:", error);
      res.status(500).json({ message: "Failed to fetch grievances" });
    }
  });

  // Resolve grievance
  app.post('/api/grievances/:id/resolve', authorizeAmenities('grievanceAccess'), async (req: any, res) => {
    try {
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

  // Directory cache version for invalidation
  let directoryCacheVersion = Date.now();

  // Get current user's directory information with roll number and batch
  app.get('/api/directory/me', checkAuth, async (req: any, res) => {
    try {
      const userId = req.session.user.id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Try to get linked directory information
      let directoryInfo = null;
      if (user.directoryId) {
        directoryInfo = await storage.getStudentDirectoryById(user.directoryId);
      } else {
        // Try to find by email match (normalized to lowercase)
        if (user.email) {
          directoryInfo = await storage.getStudentDirectoryByEmail(user.email.toLowerCase());
          
          // If found, link the user to the directory record
          if (directoryInfo) {
            await storage.updateUser(userId, { directoryId: directoryInfo.id });
            console.log(`📋 [DIRECTORY-LINK] User ${user.email} auto-linked to directory ID ${directoryInfo.id} by email match`);
          }
        }
      }

      // Return user directory info with cache version
      const directoryResponse = {
        name: `${user.firstName} ${user.lastName}`.trim() || user.email,
        email: user.email,
        profileImageUrl: user.profileImageUrl,
        rollNumber: directoryInfo?.rollNumber || null,
        batch: directoryInfo?.batch || null,
        cacheVersion: directoryCacheVersion
      };

      res.json(directoryResponse);
    } catch (error) {
      console.error("Error fetching user directory info:", error);
      res.status(500).json({ message: "Failed to fetch directory information" });
    }
  });

  // Get all available batches from student directory
  app.get('/api/directory/batches', checkAuth, async (req: any, res) => {
    try {
      const batches = await storage.getStudentDirectoryBatches();
      res.json(['All', ...batches]);
    } catch (error) {
      console.error('❌ [DIRECTORY-BATCHES] Error fetching batches:', error);
      res.status(500).json({ message: 'Failed to fetch batches' });
    }
  });

  // Get paginated student directory list for Directory page
  app.get('/api/directory/list', checkAuth, async (req: any, res) => {
    try {
      const {
        batch = '',
        page = '1',
        limit = '20',
        query = '',
        section = '',
        program = ''
      } = req.query;

      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
      const offset = (pageNum - 1) * limitNum;

      console.log(`📋 [DIRECTORY-LIST] Query params:`, {
        batch, page: pageNum, limit: limitNum, query, section, program
      });

      // Get the current user's batch for default filtering
      const userId = req.session.user.id;
      const user = await storage.getUser(userId);
      const userBatch = user?.batch || '';

      // Use user's batch as default if no batch specified
      const filterBatch = batch || userBatch;

      const result = await storage.getStudentDirectoryList({
        batch: filterBatch,
        query,
        section,
        program,
        page: pageNum,
        limit: limitNum,
        offset
      });

      console.log(`📋 [DIRECTORY-LIST] Returning ${result.data.length} students (total: ${result.total})`);

      res.json(result);
    } catch (error) {
      console.error("Error fetching student directory list:", error);
      res.status(500).json({ message: "Failed to fetch student directory list" });
    }
  });

  // Directory cache invalidation endpoint (admin only)
  app.post('/api/directory/invalidate', adminOnly(), async (req, res) => {
    try {
      directoryCacheVersion = Date.now();
      console.log(`📋 [DIRECTORY-CACHE] Cache invalidated - new version: ${directoryCacheVersion}`);
      res.json({ success: true, cacheVersion: directoryCacheVersion });
    } catch (error) {
      console.error("Error invalidating directory cache:", error);
      res.status(500).json({ message: "Failed to invalidate cache" });
    }
  });

  // Backfill existing users with directory links (admin only)
  app.post('/api/directory/backfill', adminOnly(), async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      let linkedCount = 0;
      let alreadyLinkedCount = 0;
      
      for (const user of users) {
        if (user.directoryId) {
          alreadyLinkedCount++;
          continue;
        }
        
        // Try to find by email match (normalized to lowercase)
        const directoryInfo = user.email ? await storage.getStudentDirectoryByEmail(user.email.toLowerCase()) : null;
        
        if (directoryInfo) {
          await storage.updateUser(user.id, { 
            directoryId: directoryInfo.id,
            batch: directoryInfo.batch,
            section: directoryInfo.section
          });
          linkedCount++;
          console.log(`📋 [DIRECTORY-BACKFILL] User ${user.email} linked to directory ID ${directoryInfo.id}`);
        }
      }
      
      // Invalidate cache after backfill
      directoryCacheVersion = Date.now();
      
      res.json({ 
        success: true, 
        linkedCount, 
        alreadyLinkedCount, 
        totalUsers: users.length,
        cacheVersion: directoryCacheVersion
      });
    } catch (error) {
      console.error("Error during directory backfill:", error);
      res.status(500).json({ message: "Failed to backfill directory links" });
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

  // Delete user (Admin or manageStudents permission for students)
  app.delete('/api/admin/users/:id', manageStudentsOnly(), async (req: any, res) => {
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

  // Remove duplicate POST route - using the one with eligibility logic above

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
  
  // Get student directory (Admin or manageStudents permission)
  app.get('/api/admin/students', manageStudentsOnly(), async (req: any, res) => {
    try {
      const students = await storage.getStudentDirectory();
      res.json(students);
    } catch (error) {
      console.error("Error fetching student directory:", error);
      res.status(500).json({ message: "Failed to fetch student directory" });
    }
  });

  // Get upload logs (Admin only)
  app.get('/api/admin/student-uploads', requireAdmin, async (req: any, res) => {
    try {
      const logs = await storage.getUploadLogs();
      res.json(logs);
    } catch (error) {
      console.error("Error fetching upload logs:", error);
      res.status(500).json({ message: "Failed to fetch upload logs" });
    }
  });

  // Student directory upload (Admin or manageStudents permission)
  app.post('/api/admin/upload-students', manageStudentsOnly(), upload.single('studentsFile'), async (req: any, res) => {
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

      // Prepare student records for database with proper normalization
      const studentRecords = parseResult.students.map(student => ({
        email: student.email.toLowerCase().trim(), // Normalize to lowercase
        batch: student.batch,
        section: student.section,
        rollNumber: student.rollNumber ? student.rollNumber.toUpperCase().trim() : null, // Normalize to uppercase
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

      // Invalidate directory cache after successful upload
      directoryCacheVersion = Date.now();
      console.log(`📋 [DIRECTORY-CACHE] Cache invalidated after student upload - new version: ${directoryCacheVersion}`);

      res.json({
        message: "Student directory uploaded successfully",
        studentsProcessed: savedStudents.length,
        sectionsCreated: parseResult.sectionsProcessed,
        batchName: batchName.trim(),
        cacheVersion: directoryCacheVersion
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

  // Push Subscription endpoints
  app.post('/api/push/subscribe', async (req: any, res) => {
    try {
      const sessionUser = req.session?.user;
      const subscriptionData = insertPushSubscriptionSchema.parse(req.body);
      
      // Associate with user email if logged in
      if (sessionUser) {
        subscriptionData.userEmail = sessionUser.email;
      }
      
      // Add user agent if present
      subscriptionData.ua = req.get('User-Agent') || '';
      
      const subscription = await storage.savePushSubscription(subscriptionData);
      res.json(subscription);
    } catch (error) {
      console.error("Error saving push subscription:", error);
      res.status(500).json({ message: "Failed to save subscription" });
    }
  });

  app.post('/api/push/unsubscribe', async (req: any, res) => {
    try {
      const { endpoint } = req.body;
      if (!endpoint) {
        return res.status(400).json({ message: "Endpoint is required" });
      }
      
      await storage.deletePushSubscription(endpoint);
      res.json({ success: true });
    } catch (error) {
      console.error("Error unsubscribing:", error);
      res.status(500).json({ message: "Failed to unsubscribe" });
    }
  });

  app.post('/api/push/renew', async (req: any, res) => {
    try {
      const { endpoint } = req.body;
      if (!endpoint) {
        return res.status(400).json({ message: "Endpoint is required" });
      }
      
      await storage.renewPushSubscription(endpoint);
      res.json({ success: true });
    } catch (error) {
      console.error("Error renewing subscription:", error);
      res.status(500).json({ message: "Failed to renew subscription" });
    }
  });

  // Test endpoint to send push notifications (admin only for testing)
  app.post('/api/push/test', requireAdmin, async (req: any, res) => {
    try {
      const { title, body, userEmail } = req.body;
      
      let subscriptions;
      if (userEmail) {
        // Send to specific user
        subscriptions = await storage.getSubscriptionsForUser(userEmail);
      } else {
        // Send to all active subscriptions
        subscriptions = await storage.getAllActiveSubscriptions();
      }

      if (subscriptions.length === 0) {
        return res.json({ message: "No subscriptions found", sent: 0 });
      }

      // For demo purposes, just return the count of subscriptions that would receive the notification
      // In a real implementation, you would use web-push library to send actual notifications
      res.json({ 
        message: `Test notification would be sent to ${subscriptions.length} subscription(s)`,
        subscriptions: subscriptions.map(s => ({ 
          endpoint: s.endpoint.substring(0, 50) + '...', 
          userEmail: s.userEmail 
        })),
        sent: subscriptions.length
      });
    } catch (error) {
      console.error("Error sending test push:", error);
      res.status(500).json({ message: "Failed to send test notification" });
    }
  });

  // Smart Notifications API Routes
  
  // Get user notifications
  app.get('/api/notifications', checkAuth, async (req: any, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const notifications = [];
      
      // Get recent announcements and convert to notifications
      const announcements = await storage.getCommunityAnnouncements();
      for (const announcement of announcements.slice(0, 5)) {
        notifications.push({
          id: `announcement_${announcement.id}`,
          title: `New Announcement: ${announcement.title}`,
          content: announcement.content.substring(0, 150) + (announcement.content.length > 150 ? '...' : ''),
          category: "announcement",
          priority: "medium" as const,
          status: "sent",
          isRead: false,
          isDismissed: false,
          createdAt: announcement.createdAt || new Date().toISOString(),
          deliveryChannels: ["in_app", "push"],
          contextualData: { 
            actionRequired: false,
            sourceId: announcement.id,
            sourceType: "announcement"
          },
          metadata: { batchEligible: false }
        });
      }
      
      // Get recent events and convert to notifications
      const events = await storage.getEvents();
      for (const event of events.slice(0, 5)) {
        const eventDate = new Date(event.date);
        const now = new Date();
        const isUpcoming = eventDate > now;
        const daysDiff = Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        let priority: "high" | "medium" | "low" = "medium";
        let actionRequired = false;
        
        if (isUpcoming) {
          if (daysDiff <= 1) {
            priority = "high";
            actionRequired = true;
          } else if (daysDiff <= 7) {
            priority = "medium";
            actionRequired = event.rsvpEnabled || false;
          }
        }
        
        notifications.push({
          id: `event_${event.id}`,
          title: isUpcoming ? `Upcoming Event: ${event.title}` : `Event Reminder: ${event.title}`,
          content: `${event.description || 'No description available'} | Date: ${eventDate.toLocaleDateString()}`,
          category: "event",
          priority,
          status: "sent",
          isRead: false,
          isDismissed: false,
          createdAt: event.createdAt?.toISOString() || new Date().toISOString(),
          deliveryChannels: ["in_app", "push"],
          contextualData: { 
            actionRequired,
            deadline: event.date.toISOString(),
            sourceId: event.id,
            sourceType: "event"
          },
          metadata: { batchEligible: !actionRequired }
        });
      }
      
      // Sort notifications by priority and date
      notifications.sort((a, b) => {
        const priorityOrder: Record<string, number> = { high: 3, medium: 2, low: 1 };
        const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      
      res.json(notifications.slice(0, limit));
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  // Get unread notifications count
  app.get('/api/notifications/unread', checkAuth, async (req: any, res) => {
    try {
      // For simplicity, get all notifications and filter unread
      // In a real implementation, this would be optimized with database queries
      const allNotifications = [];
      
      // Get recent announcements
      const announcements = await storage.getCommunityAnnouncements();
      for (const announcement of announcements.slice(0, 3)) {
        allNotifications.push({
          id: `announcement_${announcement.id}`,
          title: `New Announcement: ${announcement.title}`,
          content: announcement.content.substring(0, 100) + '...',
          category: "announcement",
          priority: "medium" as const,
          status: "sent",
          isRead: false,
          isDismissed: false,
          createdAt: announcement.createdAt || new Date().toISOString(),
          deliveryChannels: ["in_app", "push"]
        });
      }
      
      // Get upcoming events
      const events = await storage.getEvents();
      const now = new Date();
      for (const event of events.slice(0, 3)) {
        const eventDate = new Date(event.date);
        if (eventDate > now) { // Only upcoming events
          allNotifications.push({
            id: `event_${event.id}`,
            title: `Upcoming Event: ${event.title}`,
            content: `Event on ${eventDate.toLocaleDateString()}`,
            category: "event",
            priority: "medium" as const,
            status: "sent",
            isRead: false,
            isDismissed: false,
            createdAt: event.createdAt?.toISOString() || new Date().toISOString(),
            deliveryChannels: ["in_app", "push"]
          });
        }
      }
      
      // Filter unread notifications (for demo, all are unread)
      const unreadNotifications = allNotifications.filter(n => !n.isRead);
      
      res.json({ count: unreadNotifications.length, notifications: unreadNotifications });
    } catch (error) {
      console.error("Error fetching unread notifications:", error);
      res.status(500).json({ message: "Failed to fetch unread notifications" });
    }
  });

  // Mark notification as read
  app.patch('/api/notifications/:id/read', checkAuth, async (req: any, res) => {
    try {
      const notificationId = parseInt(req.params.id);
      const userId = req.user.id;
      
      console.log(`📖 [NOTIFICATIONS] Marking notification ${notificationId} as read for user ${userId}`);
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  // Dismiss notification
  app.patch('/api/notifications/:id/dismiss', checkAuth, async (req: any, res) => {
    try {
      const notificationId = parseInt(req.params.id);
      const userId = req.user.id;
      
      console.log(`❌ [NOTIFICATIONS] Dismissing notification ${notificationId} for user ${userId}`);
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error dismissing notification:", error);
      res.status(500).json({ message: "Failed to dismiss notification" });
    }
  });

  // Get user notification preferences
  app.get('/api/notifications/preferences', checkAuth, async (req: any, res) => {
    try {
      // Return default preferences for now
      const defaultPreferences = {
        globalSettings: {
          enabled: true,
          quietHours: { start: "22:00", end: "08:00" },
          maxDailyNotifications: 20,
          batchDelay: 15
        },
        categoryPreferences: {
          announcement: { enabled: true, priority: "high", channels: ["push", "in_app"] },
          event: { enabled: true, priority: "high", channels: ["push", "in_app"] },
          calendar: { enabled: true, priority: "medium", channels: ["push", "in_app"] },
          forum: { enabled: true, priority: "low", channels: ["in_app"] },
          amenities: { enabled: true, priority: "medium", channels: ["push", "in_app"] },
          system: { enabled: true, priority: "critical", channels: ["push", "in_app"] }
        },
        contextualRules: {
          academicHours: true,
          locationBased: false,
          roleSpecific: true,
          eventProximity: true,
          engagementBased: true
        }
      };
      
      res.json(defaultPreferences);
    } catch (error) {
      console.error("Error fetching notification preferences:", error);
      res.status(500).json({ message: "Failed to fetch notification preferences" });
    }
  });

  // Update user notification preferences
  app.patch('/api/notifications/preferences', checkAuth, async (req: any, res) => {
    try {
      const preferences = req.body;
      console.log('📝 [NOTIFICATIONS] Preferences updated:', preferences);
      
      // For now, just return the preferences back (simulate save)
      res.json(preferences);
    } catch (error) {
      console.error("Error updating notification preferences:", error);
      res.status(500).json({ message: "Failed to update notification preferences" });
    }
  });

  // Get user engagement analytics
  app.get('/api/notifications/analytics', checkAuth, async (req: any, res) => {
    try {
      const mockAnalytics = {
        totalNotifications: 45,
        readRate: 0.78,
        averageResponseTime: 1200,
        categoryBreakdown: {
          announcement: 15,
          event: 12,
          forum: 8,
          amenities: 6,
          system: 4
        },
        dailyActivity: [
          { date: "2025-08-15", sent: 3, opened: 2, clicked: 1 },
          { date: "2025-08-16", sent: 5, opened: 4, clicked: 2 },
          { date: "2025-08-17", sent: 2, opened: 2, clicked: 1 },
          { date: "2025-08-18", sent: 4, opened: 3, clicked: 1 },
          { date: "2025-08-19", sent: 6, opened: 5, clicked: 3 },
          { date: "2025-08-20", sent: 3, opened: 2, clicked: 0 },
          { date: "2025-08-21", sent: 7, opened: 6, clicked: 4 }
        ]
      };
      
      res.json(mockAnalytics);
    } catch (error) {
      console.error("Error fetching notification analytics:", error);
      res.status(500).json({ message: "Failed to fetch notification analytics" });
    }
  });

  // Admin: Send test smart notification
  app.post('/api/notifications/test', requireAdmin, async (req: any, res) => {
    try {
      const { recipientUserId, title, content, category, priority, contextualData } = req.body;
      
      // Import here to avoid circular dependencies
      const { smartNotificationEngine } = await import('./smartNotificationEngine');
      
      const context = {
        userId: recipientUserId,
        userRole: 'student', // Default for test
        currentTime: new Date(),
        isAcademicHours: false
      };
      
      const notification = await smartNotificationEngine.createSmartNotification({
        recipientUserId,
        title,
        content,
        category: category || 'system',
        priority: priority || 'medium',
        contextualData: contextualData || {},
        deliveryChannels: ['in_app', 'push'],
        status: 'pending'
      }, context);
      
      res.json({ 
        message: "Test notification created successfully",
        notification: {
          id: notification.id,
          title: notification.title,
          priority: notification.priority,
          scheduledFor: notification.scheduledFor
        }
      });
    } catch (error) {
      console.error("Error sending test notification:", error);
      res.status(500).json({ message: "Failed to send test notification" });
    }
  });

  // Health endpoints for database verification
  app.use('/api', healthRoutes);

  // Static file serving moved to top of function to fix PWA installability

  const httpServer = createServer(app);

  // Set up WebSocket server for real-time updates
  wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  wss.on('connection', (ws) => {
    console.log('📡 [WEBSOCKET] New client connected');
    connectedClients.add(ws);
    
    // Send welcome message
    ws.send(JSON.stringify({ type: 'CONNECTED', message: 'Connected to UniLoop real-time updates' }));
    
    ws.on('close', () => {
      console.log('📡 [WEBSOCKET] Client disconnected');
      connectedClients.delete(ws);
    });
    
    ws.on('error', (error) => {
      console.error('📡 [WEBSOCKET] Error:', error);
      connectedClients.delete(ws);
    });
  });

  return httpServer;
}
