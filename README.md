# UniLoop - University Communications & Utility Platform

## Table of Contents
- [Overview](#overview)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Core Modules](#core-modules)
- [Database Schema](#database-schema)
- [Authentication & Authorization](#authentication--authorization)
- [API Endpoints](#api-endpoints)
- [Frontend Components](#frontend-components)
- [Real-time Features](#real-time-features)
- [PWA Features](#pwa-features)
- [Development Setup](#development-setup)
- [File Interactions](#file-interactions)

## Overview

UniLoop is a comprehensive Progressive Web Application (PWA) designed for university campus management. It serves as a centralized platform for student communications, event management, amenities booking, and administrative functions. The application supports role-based access control, real-time notifications, and seamless mobile-first experiences.

**Technology Stack:**
- **Frontend**: React 18 + TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend**: Node.js + Express.js, TypeScript with ES modules
- **Database**: PostgreSQL with Drizzle ORM (Neon Database)
- **Authentication**: OpenID Connect (OIDC) with Replit Auth + Auth0 integration
- **Real-time**: WebSocket with ws library
- **PWA**: Service Worker, Web App Manifest, offline support

## Architecture

### High-Level Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Client (PWA)  │◄──►│   Server API    │◄──►│   PostgreSQL    │
│   React + Vite  │    │   Express.js    │    │   Drizzle ORM   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
    ┌─────────┐             ┌─────────┐             ┌─────────┐
    │Service  │             │WebSocket│             │External │
    │Worker   │             │Server   │             │Services │
    └─────────┘             └─────────┘             └─────────┘
```

### Data Flow
1. **Authentication**: OIDC → Session Management → Role-based Permissions
2. **Client Requests**: React Components → TanStack Query → Express API → Database
3. **Real-time Updates**: WebSocket connections for live notifications and updates
4. **File Uploads**: Multer middleware → Server storage → Database references

## Project Structure

```
├── 📁 client/                      # Frontend React Application
│   ├── 📁 public/                  # Static assets, PWA files
│   │   ├── manifest.json           # PWA manifest
│   │   ├── sw.js                   # Service worker
│   │   ├── offline.html            # Offline fallback page
│   │   └── icons/                  # App icons
│   └── 📁 src/
│       ├── App.tsx                 # Main router and layout
│       ├── main.tsx                # React entry point
│       ├── index.css               # Global styles, CSS variables
│       ├── 📁 auth/                # Authentication components
│       │   ├── AuthButton.tsx      # Login/logout buttons
│       │   └── ProtectedRoute.tsx  # Route protection
│       ├── 📁 components/          # Reusable UI components
│       │   ├── Layout.tsx          # Main layout wrapper
│       │   ├── Navigation.tsx      # Bottom navigation
│       │   ├── AdminGuard.tsx      # Admin route protection
│       │   └── 📁 ui/              # shadcn/ui components
│       ├── 📁 context/             # React context providers
│       │   └── AuthContext.tsx     # Authentication state
│       ├── 📁 hooks/               # Custom React hooks
│       │   ├── use-toast.ts        # Toast notifications
│       │   └── use-auth.ts         # Authentication hooks
│       ├── 📁 lib/                 # Utilities and configuration
│       │   ├── queryClient.ts      # TanStack Query setup
│       │   └── utils.ts            # Helper functions
│       ├── 📁 pages/               # Route components
│       │   ├── Home.tsx            # Dashboard with subpages
│       │   ├── Calendar.tsx        # Event management
│       │   ├── Forum.tsx           # Community discussions
│       │   ├── Amenities.tsx       # Campus services
│       │   ├── Directory.tsx       # User directory
│       │   ├── Admin.tsx           # Admin panel
│       │   ├── Attendance.tsx      # Event attendance
│       │   ├── Gallery.tsx         # Media gallery
│       │   └── Triathlon.tsx       # Triathlon-specific features
│       └── 📁 utils/               # Client utilities
│           └── formatting.ts       # Data formatting helpers
│
├── 📁 server/                      # Backend Express Application
│   ├── index.ts                    # Main server entry point
│   ├── vite.ts                     # Vite development integration
│   ├── db.ts                       # Database connection setup
│   ├── storage.ts                  # Data access layer abstraction
│   ├── 📁 routes/                  # API route handlers
│   │   ├── routes.ts               # Main API routes
│   │   ├── galleryRoutes.ts        # Gallery-specific routes
│   │   └── health.ts               # Health check endpoints
│   ├── 📁 services/                # Business logic services
│   │   └── googleFormSubmit.ts     # Google Forms integration
│   ├── 📁 config/                  # Configuration files
│   │   └── googleFormMap.json      # Form field mappings
│   ├── auth0Config.ts              # Auth0 OIDC configuration
│   ├── auth0Routes.ts              # Authentication routes
│   ├── replitAuth.ts               # Replit Auth integration
│   ├── menuParser.ts               # Excel menu parsing
│   ├── studentParser.ts            # Student data parsing
│   ├── notificationQueueManager.ts # Notification system
│   └── smartNotificationEngine.ts  # Smart notification logic
│
├── 📁 shared/                      # Shared TypeScript definitions
│   └── schema.ts                   # Database schema & types
│
├── 📁 uploads/                     # File upload storage
├── 📁 attached_assets/             # Development assets
└── 📁 Configuration Files
    ├── package.json                # Dependencies and scripts
    ├── vite.config.ts              # Vite configuration
    ├── tailwind.config.ts          # Tailwind CSS config
    ├── drizzle.config.ts           # Database configuration
    ├── tsconfig.json               # TypeScript configuration
    └── replit.md                   # Project documentation
```

## Core Modules

### 1. Authentication & User Management
**Files**: `server/auth0Config.ts`, `server/auth0Routes.ts`, `server/replitAuth.ts`, `client/src/context/AuthContext.tsx`

**Functionality**:
- OpenID Connect (OIDC) integration with Auth0
- Session-based authentication with PostgreSQL storage
- Multi-account support (primary/alternate accounts)
- Role-based access control (RBAC) with granular permissions
- Account linking and switching

**Interactions**:
```
Client AuthContext ←→ Server Auth Routes ←→ Auth0 OIDC ←→ PostgreSQL Sessions
```

### 2. Event Management & Calendar
**Files**: `client/src/pages/Calendar.tsx`, `server/routes.ts` (events endpoints)

**Functionality**:
- Event creation with batch/section targeting
- RSVP system with status tracking
- Mandatory vs optional event designation
- Media attachment support
- Smart notifications for upcoming events

**Database Tables**: `events`, `eventRsvps`, `attendanceSheets`, `attendanceRecords`

### 3. Attendance Management
**Files**: `client/src/pages/Attendance.tsx`, attendance-related schema tables

**Functionality**:
- Auto-generated attendance sheets for batch-section targeted events
- Individual student attendance tracking (Present/Absent/Late/Unmarked)
- Bulk actions for marking attendance
- CSV export capabilities
- Audit trail with marked by/at timestamps

**Workflow**:
1. Event created with batch-section targeting
2. Attendance sheets auto-generated for each batch-section pair
3. Student records populated from student directory
4. Admins mark attendance through UI
5. Real-time updates via WebSocket

### 4. Community Forum
**Files**: `client/src/pages/Forum.tsx`, community-related schema tables

**Functionality**:
- Two-section design: Discussion Posts + Community Announcements
- Anonymous posting support
- Voting system (upvote/downvote)
- Category-based organization
- Moderation capabilities

**Database Tables**: `communityPosts`, `communityReplies`, `communityVotes`, `communityAnnouncements`

### 5. Amenities & Campus Services
**Files**: `client/src/pages/Amenities.tsx`, amenities-related routes

**Functionality**:
- **Menu Management**: Weekly menu upload via Excel, daily menu editing
- **Sick Food Booking**: Request meals when unwell
- **Hostel Leave Applications**: Submit and track leave requests
- **Grievance System**: Submit campus-related complaints
- **Records Viewing**: Personal submission history

**Database Tables**: `weeklyMenu`, `sickFoodBookings`, `hostelLeaveApplications`, `grievances`

### 6. User Directory
**Files**: `client/src/pages/Directory.tsx`, `studentDirectory` table

**Functionality**:
- Student lookup by name, batch, section, roll number
- Contact information access
- Batch-wise filtering
- Admin-managed student directory

### 7. Gallery System
**Files**: `client/src/pages/Gallery.tsx`, `server/routes/galleryRoutes.ts`

**Functionality**:
- Google Drive integration for media storage
- Album-based organization
- Media upload and management
- Public/private gallery settings

### 8. Admin Panel
**Files**: `client/src/pages/Admin.tsx`, admin-specific routes

**Functionality**:
- **User Management**: Role assignment, permission management
- **Student Directory**: Bulk upload via Excel, individual management
- **System Monitoring**: Logs, statistics, system status
- **Content Moderation**: Forum posts, user reports
- **Amenities Management**: Service configuration, submission review

## Database Schema

### Core Tables

#### Users & Authentication
```typescript
users: {
  id: varchar (primary key)           # Auth0 user ID
  email: varchar (unique)
  firstName, lastName: varchar
  profileImageUrl: varchar
  role: varchar                       # student, admin, committee_club, staff
  permissions: jsonb                  # Granular permissions object
  accountType: varchar                # primary, alternate
  linkedAccountId: varchar            # For account linking
  directoryId: integer               # Link to student directory
  batch, section, rollNumber: varchar # Student info
}

sessions: {
  sid: varchar (primary key)         # Session ID
  sess: jsonb                        # Session data
  expire: timestamp                  # Expiration time
}

studentDirectory: {
  id: serial (primary key)
  email: varchar (unique)
  batch, section: varchar
  rollNumber: varchar
  uploadedBy: varchar                # Admin who uploaded
}
```

#### Events & Attendance
```typescript
events: {
  id: serial (primary key)
  title, description: text
  date: timestamp
  startTime, endTime: varchar        # HH:MM format
  location, hostCommittee: text
  category: varchar
  rsvpEnabled, isMandatory: boolean
  targetBatches: text[]              # Array of batches
  targetSections: text[]             # Array of sections
  targetBatchSections: text[]        # Array of "batch::section"
  rollNumberAttendees: jsonb         # Specific email addresses
  authorId: varchar
  mediaUrls: jsonb
}

attendanceSheets: {
  id: serial (primary key)
  eventId: integer                   # Foreign key to events
  batch, section: varchar
  createdBy: varchar
}

attendanceRecords: {
  id: serial (primary key)
  sheetId: integer                   # Foreign key to attendanceSheets
  studentEmail, studentName: varchar
  rollNumber: varchar
  status: varchar                    # UNMARKED, PRESENT, ABSENT, LATE
  note: text
  markedBy: varchar                  # Who marked attendance
  markedAt: timestamp               # When marked
}
```

#### Community Features
```typescript
communityPosts: {
  id: serial (primary key)
  title: varchar
  content: text
  category: varchar
  authorId: varchar
  authorName: varchar
  isAnonymous: boolean
  mediaUrls: text[]
  score: integer                     # upvotes - downvotes
  isDeleted: boolean
}

communityVotes: {
  id: serial (primary key)
  postId, replyId: integer          # Either post or reply vote
  userId: varchar
  voteType: varchar                 # upvote, downvote
}
```

#### Amenities
```typescript
weeklyMenu: {
  id: serial (primary key)
  date: varchar                     # YYYY-MM-DD format
  breakfast, lunch, eveningSnacks, dinner: text
  uploadedBy: varchar
}

sickFoodBookings: {
  id: serial (primary key)
  userId: varchar
  reason: text
  alternateNumber: varchar
  deliveryLocation: text
  requestedDate: timestamp
  status: varchar                   # pending, confirmed, delivered
}
```

## Authentication & Authorization

### Authentication Flow
1. **Login Initiation**: User clicks login → Redirected to Auth0
2. **OIDC Flow**: Auth0 handles Google OAuth → Returns with authorization code
3. **Token Exchange**: Server exchanges code for tokens
4. **Session Creation**: Server creates secure session in PostgreSQL
5. **User Data**: Fetch/create user record with permissions

### Authorization System
**Role Hierarchy**:
- `student`: Basic access to announcements, events, forum
- `committee_club`: Event creation, forum moderation
- `admin`: Full system access, user management
- `staff`: Similar to admin with some restrictions

**Granular Permissions**:
```typescript
permissions: {
  calendar?: boolean;              # Event creation
  attendance?: boolean;            # Attendance management
  gallery?: boolean;               # Gallery management
  forumMod?: boolean;             # Forum moderation
  diningHostel?: boolean;         # Amenities management
  postCreation?: boolean;         # Announcement creation
  triathlon?: boolean;            # Triathlon features
  manageStudents?: boolean;       # Student directory
  // Amenities specific
  sickFoodAccess?: boolean;
  leaveApplicationAccess?: boolean;
  grievanceAccess?: boolean;
  menuUpload?: boolean;
}
```

### Permission Checking
**Frontend**: `client/src/context/AuthContext.tsx`
```typescript
const { user, isAdmin } = useAuthContext();
const canEditMenu = isAdmin || user?.permissions?.diningHostel;
```

**Backend**: `server/routes.ts`
```typescript
function authorizeAmenities(permission: string) {
  return (req, res, next) => {
    if (req.user?.role === 'admin' || req.user?.permissions?.[permission]) {
      next();
    } else {
      res.status(403).json({ error: 'Access denied' });
    }
  };
}
```

## API Endpoints

### Authentication
- `GET /api/auth/user` - Get current user info
- `GET /api/auth/heartbeat` - Session validation
- `GET /api/auth/linked-accounts` - Multi-account management
- `POST /api/auth/switch-account` - Account switching

### Events & Calendar
- `GET /api/events` - List events (with query params)
- `POST /api/events` - Create event (requires calendar permission)
- `GET /api/events/:id` - Get event details
- `POST /api/events/:id/rsvp` - RSVP to event
- `GET /api/events/:id/attendance` - Get attendance data

### Attendance Management
- `GET /api/events/:id/attendance` - Get attendance sheets
- `PUT /api/attendance/records/:id` - Update attendance record
- `POST /api/attendance/bulk-action` - Bulk attendance actions
- `GET /api/attendance/export/:sheetId` - Export CSV

### Community Forum
- `GET /api/community/posts` - List posts
- `POST /api/community/posts` - Create post
- `POST /api/community/posts/:id/vote` - Vote on post
- `GET /api/community/announcements` - List announcements

### Amenities
- `GET /api/amenities/menu` - Get daily menu
- `PUT /api/amenities/menu/:date` - Update menu (requires diningHostel)
- `POST /api/amenities/menu/upload` - Upload weekly menu
- `POST /api/amenities/sick-food` - Submit sick food booking
- `GET /api/amenities/records` - Get user's submission records

### Admin
- `GET /api/admin/users` - List all users
- `PUT /api/admin/users/:id/permissions` - Update permissions
- `POST /api/admin/students/upload` - Upload student directory
- `GET /api/admin/logs` - System logs

### Notifications
- `GET /api/notifications` - Get user notifications
- `GET /api/notifications/unread` - Unread count
- `PUT /api/notifications/:id/read` - Mark as read

## Frontend Components

### Page Components
Each page represents a major module:

**Home (`client/src/pages/Home.tsx`)**
- Dashboard with subpages (Announcements, Directory, Triathlon)
- Quick access to recent events and notifications
- Triathlon leaderboard and news integration

**Calendar (`client/src/pages/Calendar.tsx`)**
- Event listing with filtering
- Event creation form (permission-gated)
- RSVP management
- Calendar view with date navigation

**Forum (`client/src/pages/Forum.tsx`)**
- Two-section layout: Posts + Announcements
- Post creation with anonymous option
- Voting system with real-time updates
- Category filtering and search

**Amenities (`client/src/pages/Amenities.tsx`)**
- Tabbed interface: Menu, Services, Records, Weekly
- Menu editing with permission checks
- Service forms (sick food, leave, grievance)
- Personal submission history

**Admin (`client/src/pages/Admin.tsx`)**
- Multi-tab admin panel
- User management with role/permission editing
- Student directory bulk upload
- System monitoring and logs

### UI Components (`client/src/components/ui/`)
Based on shadcn/ui:
- Form components with React Hook Form integration
- Dialog, Sheet, Toast for user feedback
- DataTable for admin interfaces
- Card, Badge, Button with consistent styling

### Layout Components
**Layout (`client/src/components/Layout.tsx`)**
- Main wrapper with navigation
- PWA install prompt
- Cache status indicator
- Responsive mobile-first design

**Navigation (`client/src/components/Navigation.tsx`)**
- Bottom navigation for mobile
- Permission-based menu items
- Active state management

## Real-time Features

### WebSocket Implementation
**Server**: `server/routes.ts`
```javascript
const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    // Handle real-time updates
    broadcastToClients(JSON.parse(data));
  });
});
```

**Client**: Real-time connection management
```javascript
const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
const wsUrl = `${protocol}//${window.location.host}/ws`;
const socket = new WebSocket(wsUrl);
```

### Real-time Features
- **Notifications**: Live notification updates
- **Attendance**: Real-time attendance marking
- **Forum Votes**: Live vote count updates
- **Event RSVPs**: Live RSVP count updates

### Notification System
**Components**:
- `notificationQueueManager.ts`: Queue management
- `smartNotificationEngine.ts`: Smart notification logic
- Database storage with read/unread status
- WebSocket delivery for real-time updates

## PWA Features

### Service Worker (`client/public/sw.js`)
- **Caching Strategy**: Network-first for API, cache-first for assets
- **Offline Support**: Offline page for network failures
- **Background Sync**: Queue API calls when offline
- **Cache Management**: Automatic cache cleanup and versioning

### Web App Manifest (`client/public/manifest.json`)
```json
{
  "name": "UniLoop",
  "short_name": "UniLoop",
  "display": "standalone",
  "orientation": "portrait",
  "theme_color": "#3b82f6",
  "background_color": "#ffffff",
  "start_url": "/",
  "icons": [/* Various sizes */]
}
```

### PWA Features
- **Install Prompts**: Cross-platform install buttons
- **Offline Mode**: Graceful degradation when offline
- **Push Notifications**: (Ready for implementation)
- **App-like Experience**: Full-screen, native feel

## Development Setup

### Prerequisites
- Node.js 18+ 
- PostgreSQL database (Neon Database recommended)
- Auth0 account for authentication

### Environment Variables
```bash
# Database
DATABASE_URL=postgresql://...

# Auth0 Configuration
AUTH0_DOMAIN=your-domain.auth0.com
AUTH0_CLIENT_ID=your-client-id
AUTH0_CLIENT_SECRET=your-client-secret
AUTH0_BASE_URL=http://localhost:5000
```

### Installation & Running
```bash
# Install dependencies
npm install

# Database setup
npm run db:push

# Development server
npm run dev

# Production build
npm run build
npm start
```

### Database Management
```bash
# Push schema changes
npm run db:push

# Force push (with data loss warning)
npm run db:push --force

# TypeScript checking
npm run check
```

## File Interactions

### Authentication Flow
```
Client: AuthContext.tsx
   ↓ (login request)
Server: auth0Routes.ts → auth0Config.ts
   ↓ (OIDC flow)
Auth0: Google OAuth
   ↓ (callback)
Server: Session creation → PostgreSQL
   ↓ (user data)
Client: Context update → UI re-render
```

### Data Flow Examples

**Event Creation**:
```
Calendar.tsx → useForm → TanStack Mutation
   ↓
routes.ts → validateEventData → insertEvent
   ↓
Database: events table
   ↓ (if batch-section targeting)
Attendance: Auto-generate sheets
   ↓
WebSocket: Broadcast to attendees
   ↓
Client: Update UI, show notifications
```

**Forum Post Voting**:
```
Forum.tsx → Vote button click
   ↓
TanStack Mutation → /api/community/posts/:id/vote
   ↓
routes.ts → Update vote counts → Database
   ↓
WebSocket: Broadcast vote update
   ↓
All connected clients: Update UI without refresh
```

### File Dependencies

**Frontend Dependencies**:
- `App.tsx` imports all page components
- `AuthContext.tsx` provides user state to all components
- `queryClient.ts` configures API communication
- Page components import UI components from `@/components/ui/`

**Backend Dependencies**:
- `index.ts` sets up Express app and middleware
- `routes.ts` imports all route handlers and services
- `schema.ts` defines database structure for both client and server
- `storage.ts` provides data access abstraction

**Shared Dependencies**:
- `shared/schema.ts` used by both frontend (types) and backend (database)
- TypeScript types flow from database schema to API to frontend

This comprehensive documentation covers all major aspects of the UniLoop application, from high-level architecture to specific file interactions. The modular design allows for easy maintenance and feature additions while maintaining consistency across the entire platform.