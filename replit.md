# UniLoop - University Utility & Communications App

## Overview

UniLoop is a mobile-first, full-stack web application designed as a comprehensive university utility and communications platform. The application follows a modular architecture with distinct frontend and backend components, built using modern web technologies for scalability and maintainability.

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
- **Complete PWA Implementation**: Full-featured Progressive Web App with reliable "Add to Home Screen" functionality
- **Service Worker**: Comprehensive offline support with network-first caching and offline fallback page
- **Web App Manifest**: Proper manifest configuration with local icons (192x192, 512x512) and standalone display mode
- **Cross-Platform Install Support**: beforeinstallprompt integration for Android/Chrome and iOS-specific install guidance
- **Install Components**: Floating action button (FAB) and top banner for install prompts with accessibility features
- **Offline Experience**: Custom offline page with retry functionality and proper error handling

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

### January 2025 - Complete App Rebranding to UniLoop@IIMR with Custom Favicon (COMPLETED)
- **Comprehensive Name Update**: Systematically replaced all instances of "Campus Connect" with "UniLoop@IIMR" across the entire codebase
  - Updated main app title, manifest.json, service worker cache name, and PWA installation prompts
  - Modified HTML page titles, offline page content, and Auth0 configuration references
  - Changed API audience URLs from campusconnect.app to uniloop.app in auth configuration
  - Updated component labels, user-facing text, and documentation references
  - Modified Auth0 setup guide with new application names and API identifiers
- **Custom Favicon Implementation**: Created and integrated UniLoop logomark as favicon across all platforms
  - Generated multiple favicon sizes (16x16, 32x32, 48x48, 144x144, 192x192, 512x512) from provided UniLoop logo
  - Updated HTML favicon links with proper size attributes for optimal browser compatibility
  - Replaced PWA manifest icons with UniLoop branding for consistent app installation experience
  - Added proper Apple touch icons for iOS home screen installation
- **Cross-Platform Consistency**: Ensured unified "UniLoop@IIMR" branding across all user touchpoints
  - PWA manifest updated with institution-specific branding including IIM Ranchi identification
  - Installation prompts and app titles consistently use "UniLoop@IIMR" branding
  - Authentication flows, welcome messages, and offline pages reflect new institutional identity
  - Meta descriptions updated to include IIM Ranchi campus management context

### January 2025 - Complete PWA "Add to Home Screen" Implementation (COMPLETED)
- **Reliable PWA Installation**: Implemented all requirements for reliable "Add to Home Screen" functionality across browsers
  - Fixed web app manifest with proper `start_url: "."` and local icon paths replacing external URLs
  - Created local 192x192 and 512x512 PNG icons with UniLoop branding in `/public/icons/`
  - Added manifest link tag and iOS-specific meta tags (`apple-mobile-web-app-capable`, `apple-touch-icon`) to index.html
- **Enhanced Service Worker**: Improved offline functionality with proper network-first caching strategy
  - Updated service worker to cache essential resources including offline fallback page
  - Created custom `/offline.html` page with UniLoop branding and retry functionality
  - Proper service worker registration with feature detection and `window.load` event handling
- **Cross-Platform Install Support**: Comprehensive beforeinstallprompt integration with iOS fallback
  - New `usePWAInstall` hook with proper TypeScript typing for beforeinstallprompt event
  - Enhanced PWAInstallPrompt component with iOS-specific banner showing "Share → Add to Home Screen" instructions
  - Added floating InstallFAB component with pulse animation for non-intrusive install prompting
- **Accessibility & UX**: Keyboard-accessible components with proper ARIA labels and error handling
  - Install components only show when app is installable and hide after successful installation
  - Graceful fallback handling for different browser capabilities and installation states

### January 2025 - Image Upload System for Triathlon Team Logos (COMPLETED)
- **Backend Image Upload Route**: Added `/api/upload/image` endpoint with multer diskStorage configuration
  - 5MB file size limit with image-only validation (PNG, JPG, GIF)
  - Unique filename generation with timestamp prefix
  - Proper authorization using triathlon permission middleware
  - Auto-creation of uploads directory with proper static file serving
- **Frontend File Upload Interface**: Enhanced Add Team and Edit Team dialogs with dual upload options
  - Drag & drop file picker with upload progress and preview functionality
  - Alternative URL input option with mutual exclusivity (OR logic implementation)
  - Image preview with removal capability and clean state management
  - Fixed form validation to allow either file upload OR URL input without requiring both
- **Permission System Integration**: Added triathlon permission to admin users in database
  - Updated user permissions to include triathlon access for team logo management
  - Fixed authorization middleware to properly handle admin override for triathlon features
- **Technical Fixes**: Resolved multer configuration issues and TypeScript compatibility
  - Fixed storage variable naming conflict with app storage
  - Corrected file path handling and filename generation
  - Updated form submission logic to prioritize uploaded images over URL inputs
  - Implemented fallback logic for both diskStorage and memoryStorage scenarios
- **Landing Page Branding**: Added UniLoop logomark to Landing page hero section
  - Replaced graduation cap icon with custom UniLoop logomark image
  - Integrated attached asset using proper image path and styling

### January 2025 - Complete RBAC System with Triathlon Permissions and Color-Coded Community Categories (COMPLETED)
- **RBAC Implementation for Triathlon**: Added comprehensive role-based access control for Triathlon management
  - New `triathlon` permission in user schema and admin interface allowing specific users to manage teams
  - Updated frontend to check triathlon permissions instead of admin-only access for team creation, editing, deletion, and point management
  - Backend routes updated with proper authorization middleware using `authorize('triathlon')` instead of `adminOnly()`
  - Admin users retain full access through admin override system while designated users get granular triathlon access
- **Color-Coded Community Categories**: Enhanced visual organization in Community Forum with distinctive category colors
  - Triathlon category displays with orange theme (bg-orange-100 text-orange-800 border-orange-200)
  - Academic Help uses blue theme, Campus Life uses green, Events & Activities uses purple
  - Clubs & Societies uses indigo, Technical Support uses red, Feedback & Suggestions uses yellow
  - Color coding applies to both Community Board posts and Official Announcements for consistent visual hierarchy
- **Enhanced Admin Interface**: User Management page now includes triathlon permission controls
  - Added Triathlon column in permissions table allowing admins to grant/revoke triathlon access
  - Maintains backward compatibility with existing permission structure while adding granular control
- **Unified Permission System**: Complete alignment between frontend permission checks and backend authorization
  - Frontend checks `user.permissions?.triathlon || user.role === 'admin'` for access control
  - Backend uses `authorize('triathlon')` middleware with admin override functionality
  - Consistent behavior across all triathlon management features (team creation, editing, point management, deletion)

### January 2025 - Management Triathlon Admin Team Management (COMPLETED)
- **Complete Team CRUD Operations**: Implemented full admin controls for team management
  - Added backend API endpoints for updating (`PUT /api/triathlon/teams/:teamId`) and deleting (`DELETE /api/triathlon/teams/:teamId`) teams
  - Enhanced frontend with comprehensive dropdown menu for admin actions (Edit Team, Edit Points, View History, Delete Team)
  - Edit Team dialog allows updating team name and logo URL with validation
  - Delete confirmation dialog with warning about permanent data loss including point history
  - All operations include proper error handling and success notifications
- **Enhanced Triathlon Banner Design**: Updated the Management Triathlon banner with new visual branding
  - Added custom triathlon logo background image to replace gradient background
  - Improved spacing between quick stats section and triathlon banner (mb-8 and mt-4)
  - Fixed image asset loading by using simplified filename (triathlon-banner-bg.png)
  - Maintained text readability with subtle dark overlay (bg-black/20)

## Previous Changes

### January 2025 - Dynamic Home Page Statistics and Enhanced Roll Number Upload System (COMPLETED)
- **Dynamic Home Page Stats**: Home page cards now show real-time counts with clickable navigation
  - New Events card displays actual count of upcoming events with link to Calendar page
  - Announcements card shows real-time count with link to Community page
  - Both cards include hover effects and loading states for better user experience
- **Functional "See All" Link**: Latest Updates section now has working "See All" button linking to Community page
- **Enhanced Roll Number Upload for Events**: Complete implementation of roll number-based event targeting
  - File picker functionality with Excel/CSV support and proper validation
  - Backend API endpoint `/api/events/parse-roll-numbers` for processing uploaded files
  - Real-time attendee matching against student database with detailed information display
  - Database schema updated with `rollNumberAttendees` field to store email arrays
  - Event eligibility logic enhanced to support admin access, event creator access, and roll number attendees
- **Admin Event Visibility Fix**: Resolved issue where admin users couldn't see events they created or were invited to via roll number upload

### January 2025 - Complete Amenities Records Management System with Feature-wise RBAC (COMPLETED)
- **Status Update Functionality**: Implemented comprehensive status management for amenities records
  - Leave Applications: Added Approve/Deny buttons with real-time status updates and proper UI feedback
  - Grievance Management: Enhanced "Mark Resolved" functionality with admin access controls
  - Sick Food Bookings: Removed "pending" status system - all bookings are now automatically confirmed upon creation
- **Date Filtering System**: Added advanced date filter for Sick Food Bookings with intuitive UI
  - Calendar-style date picker with clear/reset functionality 
  - Real-time filtering with query parameter support in backend API
  - Responsive design maintaining mobile-first approach
- **Feature-wise RBAC Implementation**: Comprehensive role-based access control for granular amenities permissions
  - Database schema updated with `amenitiesPermissions` table for per-feature access control
  - New permissions: `sickFoodAccess`, `leaveApplicationAccess`, `grievanceAccess`, `menuUpload`
  - Backend middleware `authorizeAmenities()` for specific permission validation with admin override
  - Frontend permission checks integrated across all amenities features
- **Enhanced Database Schema**: Updated amenities-related tables for improved functionality
  - Removed `status` column from `sick_food_bookings` table (bookings are auto-confirmed)
  - Added `updateLeaveStatus()` method for direct admin status updates
  - Maintained backward compatibility with existing token-based approval system
- **UI/UX Improvements**: Mobile-optimized interface with consistent design patterns
  - Color-coded status badges (green for approved, red for rejected, gray for pending)
  - Responsive button layouts with proper disabled states during API calls
  - Enhanced visual feedback for all status update operations
- **API Endpoint Enhancements**: All amenities routes updated with proper RBAC middleware
  - Consistent error handling and permission validation across all endpoints
  - Support for date-based filtering in sick food bookings API
  - New endpoints for direct admin status updates (`/api/hostel/leave/:id/approve` and `/api/hostel/leave/:id/deny`)

### January 2025 - Enhanced Roll Number Detection with Hyphen-Based Logic (COMPLETED)
- **Intelligent Roll Number Detection**: Implemented advanced roll number identification logic similar to email finding
  - Header detection for roll number columns using keywords: "roll number", "roll no", "rollno", "student id", etc.
  - Mandatory hyphen requirement - cells with hyphens are prioritized for roll number detection
  - Enhanced validation filtering out false positives like "n/a", "not-applicable"
  - Two-tier detection: column header identification + cell-level hyphen pattern matching
- **Database Integration**: Successfully resolved migration issues and restored full functionality
  - Added roll_number columns to users and student_directory tables
  - Re-enabled roll number conflict detection and validation logic
  - Fixed all LSP errors and authentication system functionality
- **Comprehensive Excel Parser Enhancement**: Robust roll number extraction from Excel files
  - Supports various roll number formats with hyphens (e.g., "MBA-2024-001", "CS-21-BT-456")
  - Intelligent column identification by checking first 3 rows for headers
  - Console logging for debugging roll number detection during uploads
  - Normalized roll number storage (uppercase) with conflict prevention

### January 2025 - Enhanced Batch-Section Targeting & Mobile UI Optimization (COMPLETED)
- **Complete Batch-Section Storage System**: Fixed fundamental issue where sections were shared across batches
  - Updated database schema to store sections as "Batch::Section" format (e.g., "MBA 2024-26::A")
  - Modified student parser and upload system to maintain batch context
  - Updated 1,049+ student records and 16 batch-section relationships in production database
- **Enhanced Event Targeting**: Implemented precise batch-section relationship system
  - Events now store `targetBatchSections` array with specific batch::section pairs
  - User eligibility checking uses exact section matching to prevent cross-batch conflicts
  - Form logic generates proper batch-section combinations automatically
- **Mobile-Optimized Calendar Header**: Improved mobile responsiveness and visual design
  - Replaced "List View" and "Calendar View" text with List and Grid3X3 icons
  - Reduced toggle bar width with compact icon-only design
  - "Add Event" button shows "Add" on mobile, "Add Event" on desktop to prevent overflow
  - Consistent 8px height for all header elements

### January 2025 - Complete Events Page Calendar System with Edit/Delete Functionality (COMPLETED)
- **Fixed Delete Event Functionality**: Resolved fetch API error by correcting parameter order in queryClient.ts
  - Updated deleteEventMutation to use proper `apiRequest('DELETE', '/api/events/{id}')` syntax
  - Fixed "URL being passed as HTTP method" error that was preventing event deletion
- **Enhanced Authorization System**: Comprehensive edit/delete permissions for event creators and admins
  - Edit/Delete buttons only visible to event creators (`event.authorId === user?.id`) or admins
  - Backend authorization checks prevent unauthorized modifications
  - Frontend authorization prevents access attempts to non-owned events
- **Complete Calendar View Implementation**: Advanced calendar grid with month/week/day view options
  - Interactive calendar grid showing events as clickable tiles on specific dates
  - Month navigation with previous/next controls
  - Calendar view toggles with List View using tabs in header
  - Events displayed with proper date matching and overflow handling (max 2 events shown, "+X more" indicator)
  - Calendar integrates with existing event detail modal
- **Mobile-Optimized Event Layout**: Consistent responsive design across all views
  - Fixed height constraints with max-height 400px and internal scrolling for event containers
  - Consistent minimum height (160px) for all event cards in both Today's and All Events sections
  - Proper text wrapping and overflow handling for mobile devices
  - Optimized touch targets and spacing for mobile interaction
- **Enhanced Event Management**: Full CRUD operations with proper validation
  - Event creation, editing, and deletion with role-based permissions
  - Batch and section targeting with proper database relationships
  - Form validation and error handling with user-friendly toast notifications
  - Real-time updates using React Query cache invalidation

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

### January 2025 - Critical Security Fix: XSS Prevention in Community Posts (COMPLETED)
- **Security Vulnerability Resolution**: Fixed dangerous HTML rendering in community posts that allowed XSS attacks
  - Updated FormattedText component to escape all HTML entities before applying markdown formatting
  - Prevented execution of malicious scripts, buttons, and other HTML elements in user posts
  - Maintained safe markdown formatting (bold, italic, underline) while blocking harmful content
  - Applied HTML escaping for: `<`, `>`, `&`, `"`, `'` characters to prevent code injection
- **Safe Content Rendering**: Community posts now display user content as intended text rather than executable code
  - Users can no longer inject working HTML buttons, JavaScript, or other executable elements
  - Preserved user-friendly markdown formatting for legitimate text styling
  - Enhanced security across all post content display areas (main posts, replies, announcements)
- **Bottom Navigation Responsive Design**: Fixed mobile overflow and cleaned modern UI styling
  - Resolved admin button overflow on mobile devices with responsive flex layouts
  - Removed all button borders, background colors for clean modern appearance
  - Implemented proper touch targets and spacing for mobile-first experience

### January 2025 - Comprehensive Mobile-First PWA Optimization (COMPLETED)
- **Mobile-First UI Enhancement**: Implemented comprehensive mobile optimizations across all core pages
  - Forum page with mobile-optimized search, filters, post cards, and dialog forms
  - Home page with touch-friendly stats cards and responsive welcome section
  - Calendar page with mobile-optimized headers and larger tap targets
  - Enhanced touch interactions with 44px minimum tap targets and scale animations
- **Touch Interface Improvements**: Added proper touch feedback throughout the application
  - Active scale animations (scale-95, scale-98, scale-99) for all interactive elements
  - Focus rings with 2px ring opacity for keyboard navigation accessibility
  - Rounded corners (rounded-xl) for modern mobile design feel
  - Larger mobile input heights (h-11) transitioning to standard desktop sizes (h-10)
- **Responsive Layout System**: Mobile-first responsive design with desktop enhancements
  - Full-width mobile layouts with minimal padding transitioning to centered desktop layouts
  - Responsive text that adapts from mobile to desktop (hidden sm:inline patterns)
  - Flexible grid systems that stack on mobile and expand on larger screens
  - Optimized spacing systems (space-y-4 mobile, space-y-6 desktop)
- **Vite Development Issues**: Resolved Vite dependency optimization 404 errors
  - Cleared .vite cache directory to fix chunk file loading issues
  - Restarted development server for fresh dependency pre-bundling
  - Fixed ERR_ABORTED 404 errors for chunk-NRVXT7DT.js and similar files
- **Progressive Web App Excellence**: Enhanced PWA experience with mobile-optimized interactions
  - Consistent mobile UI patterns across all components
  - Improved loading states and skeleton animations for better perceived performance
  - Enhanced form validation and error handling with mobile-friendly toast notifications

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