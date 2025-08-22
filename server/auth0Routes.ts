import express from 'express';
import { storage } from './storage';

const router = express.Router();

// Admin override users - these emails get admin role automatically
const ADMIN_OVERRIDE_EMAILS = [
  'pritika.pauli21@iimranchi.ac.in',
  'pritika.paul4@gmail.com', 
  'kislay.ui@gmail.com'
];

// Auth0 login route - redirects to Auth0 Google login
router.get('/login', (req, res) => {
  const auth0Domain = process.env.AUTH0_DOMAIN;
  const clientId = process.env.AUTH0_CLIENT_ID;
  const redirectUri = `https://${req.get('host')}/api/callback`;
  
  console.log('Login redirect URI:', redirectUri);
  
  const auth0Url = `https://${auth0Domain}/authorize?` +
    `response_type=code&` +
    `client_id=${clientId}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `scope=openid%20profile%20email&` +
    `connection=google-oauth2`;
    
  console.log('Auth0 URL:', auth0Url);
  res.redirect(auth0Url);
});

// Auth0 callback route
router.get('/callback', async (req, res) => {
  const { code } = req.query;
  
  if (!code) {
    return res.status(400).json({ error: 'No authorization code provided' });
  }

  try {
    const auth0Domain = process.env.AUTH0_DOMAIN;
    const clientId = process.env.AUTH0_CLIENT_ID;
    const clientSecret = process.env.AUTH0_CLIENT_SECRET;
    const redirectUri = `https://${req.get('host')}/api/callback`;
    
    console.log('Callback redirect URI:', redirectUri);

    // Exchange code for token
    const tokenResponse = await fetch(`https://${auth0Domain}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenResponse.json();
    
    if (!tokenResponse.ok) {
      throw new Error(`Token exchange failed: ${tokenData.error_description || tokenData.error}`);
    }

    // Get user info
    const userResponse = await fetch(`https://${auth0Domain}/userinfo`, {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    });

    const userInfo = await userResponse.json();
    
    if (!userResponse.ok) {
      throw new Error(`Failed to get user info: ${userInfo.error_description || userInfo.error}`);
    }

    // Check if user is an admin override
    const isAdminOverride = ADMIN_OVERRIDE_EMAILS.includes(userInfo.email.toLowerCase());
    
    // Try to check if user is in student directory (required for non-admin access)
    let studentRecord = null;
    let databaseError = false;
    try {
      studentRecord = await storage.getStudentByEmail(userInfo.email.toLowerCase());
      console.log(`📋 [DIRECTORY-LINK] Email lookup for ${userInfo.email.toLowerCase()}: ${studentRecord ? 'found' : 'not_found'}`);
    } catch (error) {
      console.error('Database connection error during student lookup:', error instanceof Error ? error.message : 'Unknown error');
      databaseError = true;
      // If database is unavailable and user is not admin override, allow temporary access
      if (!isAdminOverride) {
        console.warn(`Database unavailable, allowing temporary access for ${userInfo.email}`);
      }
    }
    
    if (!isAdminOverride && studentRecord === null && !databaseError) {
      // User not authorized - redirect with error
      const errorMessage = `Access denied. Email ${userInfo.email} is not in the approved student directory.`;
      return res.redirect(`/?error=unauthorized&message=${encodeURIComponent(errorMessage)}`);
    }
    
    // Create or update user in our database
    let user = null;
    try {
      user = await storage.getUser(userInfo.sub);
    } catch (error) {
      console.error('Database connection error during user lookup:', error instanceof Error ? error.message : 'Unknown error');
      databaseError = true;
    }
    
    if (!user && !databaseError) {
      // New user - create with appropriate role and student info
      const role = isAdminOverride ? 'admin' : 'student';
      const permissions = isAdminOverride ? {
        calendar: true,
        attendance: true,
        gallery: true,
        forumMod: true,
        diningHostel: true,
        postCreation: true,
      } : {};
      
      try {
        user = await storage.upsertUser({
          id: userInfo.sub,
          email: userInfo.email,
          firstName: userInfo.given_name || userInfo.name?.split(' ')[0] || '',
          lastName: userInfo.family_name || userInfo.name?.split(' ').slice(1).join(' ') || '',
          profileImageUrl: userInfo.picture,
          role: role,
          permissions: permissions,
          batch: studentRecord?.batch || null,
          section: studentRecord?.section || null,
          directoryId: studentRecord?.id || null,
        });
        
        if (studentRecord) {
          console.log(`📋 [DIRECTORY-LINK] New user ${userInfo.email} linked to directory ID ${studentRecord.id} by email`);
        } else {
          console.log(`📋 [DIRECTORY-LINK] New user ${userInfo.email} not linked - no directory record found`);
        }
      } catch (error) {
        console.error('Database connection error during user creation:', error instanceof Error ? error.message : 'Unknown error');
        databaseError = true;
      }
    } else if (user && !databaseError) {
      // Existing user - update profile info and upgrade to admin if in override list
      const shouldUpgradeToAdmin = isAdminOverride && user.role !== 'admin';
      
      try {
        // Update directory linking for existing users
        const newDirectoryId = studentRecord?.id || user.directoryId;
        user = await storage.upsertUser({
          id: userInfo.sub,
          email: userInfo.email,
          firstName: userInfo.given_name || userInfo.name?.split(' ')[0] || '',
          lastName: userInfo.family_name || userInfo.name?.split(' ').slice(1).join(' ') || '',
          profileImageUrl: userInfo.picture,
          role: shouldUpgradeToAdmin ? 'admin' : user.role,
          permissions: shouldUpgradeToAdmin ? {
            calendar: true,
            attendance: true,
            gallery: true,
            forumMod: true,
            diningHostel: true,
            postCreation: true,
          } : user.permissions,
          batch: studentRecord?.batch || user.batch,
          section: studentRecord?.section || user.section,
          directoryId: newDirectoryId,
        });
        
        if (studentRecord && !user.directoryId) {
          console.log(`📋 [DIRECTORY-LINK] Existing user ${userInfo.email} newly linked to directory ID ${studentRecord.id} by email`);
        } else if (studentRecord && user.directoryId && studentRecord.id !== user.directoryId) {
          console.log(`📋 [DIRECTORY-LINK] Existing user ${userInfo.email} directory updated from ${user.directoryId} to ${studentRecord.id}`);
        }
      } catch (error) {
        console.error('Database connection error during user update:', error instanceof Error ? error.message : 'Unknown error');
        databaseError = true;
      }
    }

    // If database is unavailable, create a temporary session user
    if (databaseError) {
      console.warn('Creating temporary session due to database unavailability');
      user = {
        id: userInfo.sub,
        email: userInfo.email,
        firstName: userInfo.given_name || userInfo.name?.split(' ')[0] || '',
        lastName: userInfo.family_name || userInfo.name?.split(' ').slice(1).join(' ') || '',
        profileImageUrl: userInfo.picture,
        role: isAdminOverride ? 'admin' : 'student',
        permissions: isAdminOverride ? {
          calendar: true,
          attendance: true,
          gallery: true,
          forumMod: true,
          diningHostel: true,
          postCreation: true,
        } : {},
        batch: null,
        section: null,
      };
    }

    // Ensure user exists before setting session
    if (!user) {
      console.error('Failed to create or retrieve user data');
      return res.redirect('/?error=auth_failed&message=Unable to process user authentication');
    }

    // Always use the fresh user data from database (after upsert)
    (req as any).session.user = {
      id: user.id,
      email: user.email,
      name: `${user.firstName} ${user.lastName}`.trim(),
      picture: user.profileImageUrl,
      role: user.role, // Use database role
      permissions: user.permissions, // Use database permissions
      firstName: user.firstName,
      lastName: user.lastName,
      profileImageUrl: user.profileImageUrl,
      batch: user.batch,
      section: user.section,
    };

    console.log('User session created:', (req as any).session.user);
    console.log('Admin access granted:', user.role === 'admin');
    console.log('Database user retrieved:', user);

    // Redirect to home page
    res.redirect('/');
    
  } catch (error: any) {
    console.error('Auth0 callback error:', error);
    
    // Create error message based on error type
    let errorType = 'auth_failed';
    let errorMessage = 'Authentication failed';
    
    if (error?.message?.includes('column') && error?.message?.includes('does not exist')) {
      errorType = 'database_error';
      errorMessage = 'Database configuration error. Please contact administrator.';
    } else if (error?.message?.includes('Token exchange failed')) {
      errorType = 'token_error';
      errorMessage = 'Authentication token error. Please try again.';
    } else if (error?.message?.includes('Failed to get user info')) {
      errorType = 'user_info_error';
      errorMessage = 'Unable to retrieve user information from Google.';
    }
    
    // Redirect with error parameters for toast display
    const errorParams = new URLSearchParams({
      error: errorType,
      message: errorMessage
    });
    
    res.redirect(`/?${errorParams.toString()}`);
  }
});

// Logout route
router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Session destruction error:', err);
    }
    
    const auth0Domain = process.env.AUTH0_DOMAIN;
    const clientId = process.env.AUTH0_CLIENT_ID;
    const returnTo = `${req.protocol}://${req.get('host')}`;
    
    console.log('Auth0 logout - Domain:', auth0Domain);
    console.log('Auth0 logout - Client ID:', clientId);
    console.log('Auth0 logout - Return To:', returnTo);
    
    // Simple logout without returnTo to avoid Auth0 configuration issues
    const logoutUrl = `https://${auth0Domain}/v2/logout?client_id=${clientId}`;
    
    console.log('Auth0 logout URL:', logoutUrl);
    res.redirect(logoutUrl);
  });
});

// Force logout route to clear session completely
router.get('/force-logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Session destruction error:', err);
    }
    res.json({ message: 'Session cleared' });
  });
});

// Current user route
router.get('/user', (req, res) => {
  const sessionUser = (req as any).session?.user;
  
  console.log('Session check - user:', sessionUser);
  
  if (!sessionUser) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  
  res.json(sessionUser);
});

export default router;