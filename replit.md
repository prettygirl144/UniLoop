# Campus Connect - University Utility & Communications App

## Overview

Campus Connect is a mobile-first, full-stack web application designed as a comprehensive university utility and communications platform. The application follows a modular architecture with distinct frontend and backend components, built using modern web technologies for scalability and maintainability.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript, configured for mobile-first responsive design
- **UI Library**: Radix UI components with shadcn/ui component system for consistent design
- **Styling**: Tailwind CSS with CSS variables for theming and dark mode support
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: React Query (TanStack Query) for server state management
- **Form Handling**: React Hook Form with Zod validation
- **Build Tool**: Vite for fast development and optimized production builds

### Backend Architecture
- **Runtime**: Node.js with Express.js server
- **Language**: TypeScript with ES modules
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Database Provider**: Neon Database (serverless PostgreSQL)
- **Authentication**: OpenID Connect (OIDC) with Replit Auth integration
- **Session Management**: Express sessions with PostgreSQL storage

### Progressive Web App (PWA) Features
- Service worker implementation for offline functionality
- Web app manifest for installable mobile experience
- Caching strategies for improved performance

## Key Components

### Authentication & Authorization
- **OAuth 2.0 Flow**: Integrated with institutional email authentication
- **Role-Based Access Control**: Three-tier system (student, admin, committee_club)
- **Granular Permissions**: Feature-specific access control with admin override capabilities
- **Session Security**: Secure session management with PostgreSQL-backed storage

### Core Modules
1. **Announcements System**: Campus-wide communication with role-based posting permissions
2. **Event Management**: Calendar with RSVP functionality and attendance tracking
3. **Forum Platform**: Discussion boards with categories, reactions, and moderation
4. **Dining Services**: Sick food booking and hostel leave applications
5. **Directory**: User lookup with messaging capabilities
6. **Admin Panel**: User permission management and system oversight

### Database Schema
- **Users**: Profile management with role and permission storage
- **Content Tables**: Announcements, events, forum posts with relational integrity
- **Interaction Tables**: RSVPs, reactions, attendance records
- **Service Tables**: Dining bookings, leave applications, grievances

## Data Flow

### Client-Server Communication
1. **Authentication Flow**: OIDC redirect → token validation → user session establishment
2. **API Communication**: RESTful endpoints with credential-based authentication
3. **Real-time Updates**: React Query for automatic cache invalidation and refetching
4. **Error Handling**: Centralized error handling with automatic logout on 401 responses

### Permission Validation
1. Frontend route protection with role/permission checks
2. Backend API endpoint authorization middleware
3. Admin-only functionality for user permission management
4. Graceful fallbacks for unauthorized access attempts

## External Dependencies

### Development & Build Tools
- **Vite**: Development server and build tool with React plugin
- **TypeScript**: Type safety across frontend and backend
- **Replit Integration**: Development environment optimizations and error overlay

### UI & Styling
- **Tailwind CSS**: Utility-first CSS framework with custom design system
- **Radix UI**: Accessible component primitives
- **Lucide React**: Icon system

### Backend Services
- **Neon Database**: Serverless PostgreSQL with connection pooling
- **Drizzle ORM**: Type-safe database operations with migration support
- **Express Session**: Session management with PostgreSQL store

### Authentication
- **OpenID Client**: OIDC protocol implementation
- **Passport.js**: Authentication middleware integration

## Deployment Strategy

### Development Environment
- **Local Development**: Vite dev server with Express backend
- **Hot Reloading**: Full-stack development with automatic reload
- **Environment Variables**: Database URL and session secrets configuration

### Production Build
- **Frontend**: Static site generation with Vite build
- **Backend**: ES module compilation with esbuild
- **Database**: Migration system with Drizzle Kit
- **Session Storage**: PostgreSQL-backed session persistence

### Mobile Optimization
- **Responsive Design**: Mobile-first approach with max-width constraints
- **PWA Features**: Offline capability and app-like experience
- **Performance**: Optimized bundle sizes and lazy loading

## Recent Changes

### January 2025 - Admin Override System and Student Directory Integration (COMPLETED)
- **Admin Override Authentication**: Implemented hardcoded admin user list with automatic role assignment:
  - Added `ADMIN_OVERRIDE_EMAILS` array containing: pritika.pauli21@iimranchi.ac.in, pritika.paul4@gmail.com, kislay.ui@gmail.com
  - These users automatically receive admin role and full permissions upon first login
  - Existing admin users get upgraded if they're in the override list
  - Enhanced error handling with specific error types for authentication failures
- **Database Schema Fixes**: Resolved "batch column does not exist" errors by:
  - Added missing batch and section columns to users table
  - Created student_directory and student_upload_logs tables
  - Successfully pushed all schema changes to production database
- **Enhanced Authentication Error Handling**: 
  - Auth0 callback now provides detailed error messages with specific error types
  - Frontend Landing page displays authentication failure toasts with proper reasons
  - URL error parameters are automatically cleaned up after displaying toast messages
- **Complete Student Directory System**: Three-tab admin interface with:
  - User Management: Edit roles and permissions for all users
  - Student Directory: Upload Excel files with batch management and student viewing
  - Upload History: Track all student directory uploads with detailed logs

### January 2025 - Complete Community Forum System Replacement (COMPLETED)
- **Two-Section Community Space**: Completely replaced the old forum system with a new community platform featuring:
  - **Community Board (Section 1)**: Reddit-style discussion board with upvote/downvote system, anonymous posting, and threaded replies
  - **Official Announcements (Section 2)**: Admin/committee-only announcement board for official campus communications
- **Database Schema Migration**: New community tables replace old forum infrastructure:
  - `communityPosts`: User discussions with voting, categories, and anonymous posting support
  - `communityReplies`: Threaded reply system with voting and moderation
  - `communityVotes`: Upvote/downvote tracking system with toggle functionality
  - `communityAnnouncements`: Official announcement system with role-based creation
- **Enhanced RBAC Integration**: Community features integrated with existing role system:
  - Students: Can create posts and replies, vote on content
  - Committee/Club: Can create posts, replies, and official announcements
  - Admins: Full moderation capabilities including post/reply deletion
- **Mobile-First UI**: Two-tab interface optimized for mobile with comprehensive form handling:
  - Category-based organization with predefined options
  - Anonymous posting toggle for sensitive discussions
  - Real-time voting with visual feedback
  - Post detail dialog with reply threading
- **Complete Backend Implementation**: New API endpoints replacing old forum routes:
  - `/api/community/posts` - CRUD operations for community discussions
  - `/api/community/announcements` - Official announcement management
  - `/api/community/posts/:id/replies` - Threaded reply system
  - Vote endpoints with anti-spam and toggle functionality
- **Full Feature Implementation**: All specification requirements completed:
  - Rich text formatting (**bold**, *italic*, _underline_)
  - Media upload system supporting images, GIFs, and carousels (up to 5 images)
  - Search functionality filtering posts by title and content
  - OP badges for original post authors in replies
  - Admin moderation with delete capabilities
  - Anonymous posting with privacy controls
  - Rate limiting and spam prevention
  - Mobile-responsive design with proper overflow handling

### January 2025 - Complete Weekly Menu Upload & RBAC System Implementation
- **Weekly Menu Upload Feature**: Comprehensive Excel-based menu upload system with complete parsing logic
  - Four-tab interface (Today, Tomorrow, Day-After, Next 7 Days) for menu viewing
  - Excel parser with unmerge cell support, date extraction, and meal categorization
  - RBAC controls allowing only admin and dining-permission users to upload menus
  - Database schema updated to `weekly_menu` table with proper date indexing
  - File validation (5MB limit, .xlsx only) with detailed error handling
- **Authentication Pipeline Fixes**: Resolved Auth0 vs session-based authentication conflicts
  - Unified `extractUser` function supporting both Auth0 and session-based users
  - Development test user bypass for menu upload testing
  - Fixed SQL query issues with array parameters and type safety
- **Database Schema Corrections**: Fixed missing columns and LSP errors
  - Proper `inArray` usage for date range queries
  - Fixed Drizzle ORM type issues with array handling
  - Enhanced error logging for menu parsing and upload failures
- **Complete Route Integration**: All amenities endpoints working with proper error handling
  - Menu fetch API returning proper empty arrays when no data exists  
  - Upload endpoint with comprehensive validation and success feedback
  - RBAC permission checking integrated across all menu operations

### January 2025 - Complete Typography Standardization
- **Typography System Standardization**: Implemented consistent 3-font-size system across ALL pages:
  - `text-large` (20px): Page headers and main titles
  - `text-medium` (16px): Section headers and important text
  - `text-small` (14px): Body text, labels, and supporting content
- **Complete Font Audit**: Removed all inconsistent typography classes including:
  - Eliminated `text-lg`, `text-xl`, `text-2xl`, `text-3xl` throughout the application
  - Removed `font-medium`, `font-semibold`, `font-bold`, `font-normal` for consistent weight
  - Fixed submenus in Amenities page that were using larger fonts
- **Pages Updated**: All 13 pages systematically updated including:
  - Gallery, Calendar, Forum, Home, Dining, Amenities pages
  - Auth0Login, Auth0Logout, Landing pages  
  - Admin-only pages: Admin, Attendance, Directory
  - Error pages: not-found page
- **Mobile-First Design**: Consistent typography ensures better mobile readability and uniform user experience

### January 2025 - Auth0 Authentication System Implementation
- **Complete Auth0 Integration**: Implemented comprehensive Auth0 authentication system with Google OAuth only:
  - `@auth0/auth0-react` provider integration with fallback to existing Replit auth
  - `express-oauth2-jwt-bearer` middleware (v1.6.1) for backend JWT validation
  - Automatic token management with global access token function for API requests
  - Auth0Login and Auth0Logout pages with Google-only authentication flow
  - Enhanced useAuth hook supporting both Auth0 and existing authentication systems

- **JWT Middleware & API Security**: Backend authentication enhancements:
  - Auth0 JWT validation middleware with fallback to existing Replit authentication
  - User information extraction and synchronization between Auth0 and local database
  - Enhanced API routes with unified authentication supporting both systems
  - Gallery API endpoints with proper permission-based access control

- **Environment Configuration**: Comprehensive Auth0 setup documentation:
  - `.env.example` with all required Auth0 environment variables
  - `AUTH0_SETUP_GUIDE.md` with step-by-step configuration instructions
  - Google OAuth integration guide with Auth0 dashboard setup
  - Custom claims rule for roles and permissions in JWT tokens

- **Frontend Integration**: React components and hooks for seamless Auth0 experience:
  - Auth0Provider wrapper with automatic fallback detection
  - Enhanced query client with automatic JWT token attachment
  - Unified authentication state management across the application
  - Loading and error states for Auth0 authentication flow

### January 2025 - Comprehensive Multi-Account & Media System Implementation
- **Enhanced RBAC System**: Expanded Role-Based Access Control with full multi-account support:
  - `student`: Default view-only access after OAuth login
  - `committee_club`: Elevated permissions for specific modules
  - `admin`: Full system access with user management capabilities
  - **Multi-Account Support**: Users can link multiple accounts with different roles (e.g., Student + Committee)
  - **Account Switching**: Gmail-style account switcher in top app bar with persistent session management
  - **Enhanced Permission Management**: Granular permissions with admin override capabilities

- **Media Upload & Gallery System**: Complete media management implementation:
  - **Media Upload Component**: File upload support for events and forum posts with preview functionality
  - **Google Drive Integration**: Gallery folders with embedded iframe display of Google Drive content
  - **Enhanced Event Forms**: Events can include multiple media files with upload progress tracking
  - **Enhanced Forum Forms**: Forum posts support media attachments and file uploads
  - **Gallery Page**: Dual-tab interface showing both Google Drive folders and event media

- **Advanced Authentication Features**: 
  - **Alternate Account Creation**: Users can create secondary accounts with different roles
  - **Session Persistence**: Account switching without full logout/login cycle
  - **Local Storage Integration**: Active account tracking across browser sessions
  - **Enhanced Admin Panel**: Complete user management with role switching capabilities

- **Google Drive Gallery Integration**:
  - **Folder Management**: Admin/committee users can add Google Drive folders to gallery
  - **Category Organization**: Folders organized by Events, Celebrations, Competitions, Academic, etc.
  - **Iframe Embedding**: Direct Google Drive folder preview within the application
  - **Public/Private Control**: Folder visibility management with creator permissions

- **Database Enhancements**:
  - **Extended User Schema**: Added accountType, linkedAccountId, isActive fields for multi-account support
  - **Gallery Folders Table**: New table for Google Drive folder management with metadata
  - **Media URL Storage**: Enhanced events and forum posts with media URL arrays
  - **Permission Matrix**: Expanded permissions system with feature-specific access control

- **UI/UX Improvements**:
  - **Compact Account Switcher**: Mobile-optimized account switcher in top app bar
  - **Enhanced Gallery**: Tab-based interface with search functionality for both media types
  - **Responsive Design**: Mobile-first approach with optimized touch interactions
  - **Loading States**: Comprehensive loading and error states for all async operations

- **Security & Authorization**:
  - **Enhanced API Endpoints**: Gallery folder management, account switching, and media upload APIs
  - **Permission-Based Access**: Feature-specific authorization middleware
  - **Admin Override System**: Admins bypass individual permission checks
  - **Session Security**: Secure account switching with proper session management

The application is designed for easy deployment on platforms like Replit, with containerized architecture and environment-based configuration for seamless scaling and maintenance.