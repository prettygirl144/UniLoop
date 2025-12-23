import session from "express-session";
import connectPg from "connect-pg-simple";

/**
 * Platform-independent session configuration for production deployment
 * This replaces the Replit-specific session setup in replitAuth.ts
 */
export function getSession() {
  const sessionTtl = 14 * 24 * 60 * 60 * 1000; // 14 days (2 weeks) in milliseconds
  const pgStore = connectPg(session);
  
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is required for session storage");
  }
  
  if (!process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET environment variable is required");
  }
  
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true, // Will auto-create sessions table on first run
    ttl: Math.floor(sessionTtl / 1000), // TTL in seconds for connect-pg-simple
    tableName: "sessions",
  });
  
  return session({
    secret: process.env.SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: sessionTtl,
      sameSite: 'lax',
    },
  });
}
