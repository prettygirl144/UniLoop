import type { RequestHandler } from 'express';

// Simplified Auth0 configuration check (no audience needed for Google OAuth only)
const isAuth0Configured = !!(
  process.env.AUTH0_DOMAIN &&
  process.env.AUTH0_CLIENT_ID &&
  process.env.AUTH0_CLIENT_SECRET
);

if (!isAuth0Configured) {
  console.warn('Auth0 environment variables not configured. Using fallback authentication.');
} else {
  console.log('Auth0 configured with simplified Google OAuth authentication.');
}

// Since we're simplifying to Google OAuth only without JWT audience validation,
// we'll use session-based authentication instead of JWT middleware
export const checkAuth0Jwt: RequestHandler = (req, res, next) => next();

// Auth0 session-based middleware
export const checkAuth: RequestHandler = async (req: any, res, next) => {
  const sessionUser = req.session?.user;
  if (!sessionUser) {
    // For testing menu upload, allow bypass with admin test user
    if (req.url.includes('/api/amenities/menu/upload') && process.env.NODE_ENV === 'development') {
      req.session = req.session || {};
      req.session.user = {
        id: 'test-admin',
        email: 'admin@test.com',
        role: 'admin',
        permissions: { diningHostel: true }
      };
      return next();
    }
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
};

// Error handler for Auth0 authentication errors
export const handleAuthError = (err: any, req: any, res: any, next: any) => {
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ 
      message: 'Unauthorized',
      error: 'Invalid or missing authentication token'
    });
  }
  next(err);
};

// Extract user information from Auth0 JWT or existing session
export const extractUser = (req: any) => {
  // If using Auth0, user info is in req.auth
  if (req.auth) {
    return {
      id: req.auth.payload.sub,
      email: req.auth.payload.email,
      name: req.auth.payload.name,
      picture: req.auth.payload.picture,
      role: req.auth.payload['https://uniloop.app/roles']?.[0] || 'student',
      permissions: req.auth.payload['https://uniloop.app/permissions'] || {},
    };
  }
  
  // Fallback to existing user session
  if (req.user && req.user.claims) {
    return {
      id: req.user.claims.sub,
      email: req.user.claims.email,
      name: req.user.claims.name || `${req.user.claims.first_name} ${req.user.claims.last_name}`.trim(),
      picture: req.user.claims.profile_image_url,
      role: req.user.role || 'student',
      permissions: req.user.permissions || {},
    };
  }
  
  // Session-based user (for development/testing)
  if (req.session?.user) {
    return {
      id: req.session.user.id,
      email: req.session.user.email,
      name: req.session.user.name || req.session.user.email,
      picture: req.session.user.picture,
      role: req.session.user.role || 'student',
      permissions: req.session.user.permissions || {},
    };
  }
  
  return null;
};

// Admin authorization middleware as per requirements
export const requireAdmin: RequestHandler = (req: any, res, next) => {
  const user = extractUser(req);
  if (!user) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  
  const isAdmin = user.role === 'admin';
  if (!isAdmin) {
    return res.status(403).json({ error: 'forbidden' });
  }
  
  next();
};

export const requireManageStudents: RequestHandler = (req: any, res, next) => {
  const user = extractUser(req);
  if (!user) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  
  // Admins have access to everything
  const isAdmin = user.role === 'admin';
  const hasManageStudents = user.permissions?.manageStudents;
  
  if (!isAdmin && !hasManageStudents) {
    return res.status(403).json({ error: 'forbidden - requires manageStudents permission' });
  }
  
  next();
};

export default {
  checkAuth,
  checkAuth0Jwt,
  handleAuthError,
  extractUser,
  requireAdmin,
  requireManageStudents,
};