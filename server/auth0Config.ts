import { auth } from 'express-oauth2-jwt-bearer';
import type { RequestHandler } from 'express';

const isAuth0Configured = !!(process.env.AUTH0_DOMAIN && process.env.AUTH0_AUDIENCE);

if (!isAuth0Configured) {
  console.warn('Auth0 environment variables not configured. Using fallback authentication.');
}

// Auth0 JWT validation middleware - only create if Auth0 is configured
export const checkAuth0Jwt: RequestHandler = isAuth0Configured ? auth({
  issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}`,
  audience: process.env.AUTH0_AUDIENCE,
}) : (req, res, next) => next(); // Passthrough middleware if Auth0 not configured

// Custom Auth0 middleware that handles both Auth0 JWT and fallback to existing auth
export const checkAuth: RequestHandler = async (req, res, next) => {
  // If Auth0 is configured, use Auth0 JWT validation
  if (isAuth0Configured) {
    return checkAuth0Jwt(req, res, next);
  }
  
  // Fallback to existing authentication if Auth0 is not configured
  const { isAuthenticated } = await import('./replitAuth');
  return isAuthenticated(req, res, next);
};

// Error handler for Auth0 authentication errors
export const handleAuthError: RequestHandler = (err, req, res, next) => {
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
      role: req.auth.payload['https://campusconnect.app/roles']?.[0] || 'student',
      permissions: req.auth.payload['https://campusconnect.app/permissions'] || {},
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
  
  return null;
};

export default {
  checkAuth,
  checkAuth0Jwt,
  handleAuthError,
  extractUser,
};