# UniLoop - University Utility & Communications App

## Overview
UniLoop is a mobile-first, full-stack web application serving as a comprehensive university utility and communications platform. It provides modules for announcements, event management, discussion forums, dining services, user directories, and admin functionalities. The project aims to offer a scalable and maintainable solution for university operations, communication, and student services, built with modern web technologies.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
UniLoop follows a modular architecture with distinct frontend and backend components.

### Frontend
- **Framework**: React with TypeScript, configured for mobile-first responsive design.
- **UI/UX**: Radix UI components integrated with shadcn/ui for consistent design; Tailwind CSS for styling with dark mode support.
- **State Management & Data Flow**: React Query (TanStack Query) for server state management, and Wouter for client-side routing.
- **Form Handling**: React Hook Form with Zod validation.
- **Build Tool**: Vite for fast development and optimized production builds.
- **PWA Features**: Full Progressive Web App implementation including service worker for offline support, web app manifest, cross-platform install prompts, and a custom offline page.

### Backend
- **Runtime**: Node.js with Express.js server, written in TypeScript with ES modules.
- **Database**: PostgreSQL with Drizzle ORM for type-safe operations, leveraging Neon Database (serverless PostgreSQL).
- **Authentication**: OpenID Connect (OIDC) integrated with Replit Auth, supporting OAuth 2.0 and institutional email authentication.
- **Session Management**: Express sessions with PostgreSQL storage for secure session persistence.
- **Authorization**: Role-Based Access Control (RBAC) with a three-tier system (student, admin, committee_club) and granular, feature-specific permissions, including an admin override system.

### Core Modules & Features
- **Announcements**: Campus-wide communication with role-based posting.
- **Event Management**: Calendar with RSVP and attendance tracking, including roll number-based targeting.
- **Forum Platform**: Discussion boards with categories, reactions, moderation, and anonymous posting.
- **Dining Services**: Sick food booking, hostel leave applications, and weekly menu upload.
- **Directory**: User lookup with messaging.
- **Admin Panel**: User permission management, system oversight, and student directory management.
- **Media System**: Image upload for team logos (e.g., triathlon), and a Gallery system integrating Google Drive folders.
- **Multi-Account Support**: Users can link multiple accounts/roles (e.g., Student + Committee) with a Gmail-style account switcher.

### System Design Choices
- **Security**: XSS prevention in user-generated content, secure session management, and JWT validation.
- **Mobile Optimization**: Comprehensive mobile-first UI with enhanced touch interactions, responsive layouts, and standardized typography (3-font-size system across all pages).
- **Database Schema**: Structured for users, content, interactions, and services, supporting relational integrity and specific features like batch-section targeting and amenities permissions.

## External Dependencies
- **Development & Build**: Vite, TypeScript, Replit integration.
- **UI & Styling**: Tailwind CSS, Radix UI, Lucide React (for icons).
- **Backend Services**: Neon Database, Drizzle ORM, Express Session.
- **Authentication**: OpenID Client, Passport.js, Auth0.