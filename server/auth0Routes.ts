import express from 'express';
import { storage } from './storage';

const router = express.Router();

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

    // Create or update user in our database - don't override existing permissions
    let user = await storage.getUser(userInfo.sub);
    
    if (!user) {
      // New user - create with default student role
      user = await storage.upsertUser({
        id: userInfo.sub,
        email: userInfo.email,
        firstName: userInfo.given_name || userInfo.name?.split(' ')[0] || '',
        lastName: userInfo.family_name || userInfo.name?.split(' ').slice(1).join(' ') || '',
        profileImageUrl: userInfo.picture,
        role: 'student',
        permissions: {},
      });
    } else {
      // Existing user - only update profile info, keep existing role/permissions
      user = await storage.upsertUser({
        id: userInfo.sub,
        email: userInfo.email,
        firstName: userInfo.given_name || userInfo.name?.split(' ')[0] || '',
        lastName: userInfo.family_name || userInfo.name?.split(' ').slice(1).join(' ') || '',
        profileImageUrl: userInfo.picture,
        role: user.role, // Keep existing role
        permissions: user.permissions, // Keep existing permissions
      });
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
    };

    console.log('User session created:', (req as any).session.user);
    console.log('Admin access granted:', user.role === 'admin');
    console.log('Database user retrieved:', user);

    // Redirect to home page
    res.redirect('/');
    
  } catch (error) {
    console.error('Auth0 callback error:', error);
    res.redirect('/?error=auth_failed');
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