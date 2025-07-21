# Auth0 Setup Guide for Campus Connect

This guide will help you set up Auth0 authentication for the Campus Connect application with Google OAuth only.

## Prerequisites

1. An Auth0 account (sign up at [auth0.com](https://auth0.com))
2. A Google Developer account for OAuth credentials

## Step 1: Create Auth0 Application

1. **Login to Auth0 Dashboard**
   - Go to [auth0.com](https://auth0.com) and sign in

2. **Create a New Application**
   - Click "Applications" in the left sidebar
   - Click "Create Application"
   - Name: "Campus Connect"
   - Type: "Single Page Web Applications"
   - Click "Create"

3. **Configure Application Settings**
   - Go to the "Settings" tab of your new application
   - Set the following URLs (replace with your actual domain):
     ```
     Allowed Callback URLs: https://your-replit-domain.replit.app, http://localhost:5000
     Allowed Logout URLs: https://your-replit-domain.replit.app, http://localhost:5000
     Allowed Web Origins: https://your-replit-domain.replit.app, http://localhost:5000
     ```
   - Set "JWT Signature Algorithm" to "RS256"
   - Save changes

## Step 2: Create Auth0 API

1. **Create API**
   - Go to "APIs" in the left sidebar
   - Click "Create API"
   - Name: "Campus Connect API"
   - Identifier: `https://campusconnect.app/api` (this will be your audience)
   - Signing Algorithm: "RS256"
   - Click "Create"

2. **Configure API Settings**
   - Enable "Allow Offline Access" if you want refresh tokens
   - Save settings

## Step 3: Configure Google Social Connection

1. **Set up Google OAuth App**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing
   - Enable "Google+ API"
   - Go to "Credentials" > "Create Credentials" > "OAuth 2.0 Client IDs"
   - Application type: "Web application"
   - Authorized redirect URIs: 
     ```
     https://your-auth0-domain.auth0.com/login/callback
     ```
   - Save and note down Client ID and Client Secret

2. **Configure in Auth0**
   - In Auth0 Dashboard, go to "Authentication" > "Social"
   - Click "Create Connection"
   - Select "Google"
   - Enter your Google Client ID and Client Secret
   - Set Attributes: `email`, `email_verified`, `name`, `picture`
   - Set Permissions (Scopes): `email`, `profile`
   - Save

3. **Enable for Application**
   - Go to "Applications" tab in the Google connection
   - Enable it for your "Campus Connect" application

## Step 4: Configure Environment Variables

### For Replit (Production)
Add these secrets in Replit's Secrets tab:

```env
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_AUDIENCE=https://campusconnect.app/api
AUTH0_CLIENT_ID=your-client-id-from-auth0-app

VITE_AUTH0_DOMAIN=your-tenant.auth0.com
VITE_AUTH0_CLIENT_ID=your-client-id-from-auth0-app
VITE_AUTH0_AUDIENCE=https://campusconnect.app/api
```

### For Local Development
Create a `.env` file in the project root:

```env
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_AUDIENCE=https://campusconnect.app/api
AUTH0_CLIENT_ID=your-client-id-from-auth0-app

VITE_AUTH0_DOMAIN=your-tenant.auth0.com
VITE_AUTH0_CLIENT_ID=your-client-id-from-auth0-app
VITE_AUTH0_AUDIENCE=https://campusconnect.app/api
```

## Step 5: Customize User Roles and Permissions

1. **Create Custom Claims Rule**
   - Go to "Auth Pipeline" > "Rules" in Auth0 Dashboard
   - Click "Create Rule"
   - Choose "Empty Rule"
   - Name: "Add roles and permissions to tokens"
   - Code:
   ```javascript
   function(user, context, callback) {
     const namespace = 'https://campusconnect.app/';
     
     // Default role for all users
     const assignedRoles = user.app_metadata?.roles || ['student'];
     const permissions = user.app_metadata?.permissions || {};
     
     // Add roles and permissions to tokens
     context.idToken[namespace + 'roles'] = assignedRoles;
     context.accessToken[namespace + 'roles'] = assignedRoles;
     context.idToken[namespace + 'permissions'] = permissions;
     context.accessToken[namespace + 'permissions'] = permissions;
     
     callback(null, user, context);
   }
   ```
   - Save

2. **Set User Roles**
   - Go to "User Management" > "Users"
   - Select a user
   - Go to "Metadata" section
   - Add to `app_metadata`:
   ```json
   {
     "roles": ["admin"],
     "permissions": {
       "calendar": true,
       "attendance": true,
       "gallery": true,
       "forumMod": true,
       "diningHostel": true,
       "postCreation": true
     }
   }
   ```

## Step 6: Restrict to Google Only

1. **Force Google Connection**
   - In your application settings, you can force Google connection by:
   - Going to "Authentication" > "Social"
   - Disable all other social connections
   - Only keep Google enabled

2. **Application Configuration**
   - The app is already configured to force `connection: 'google-oauth2'` in login requests

## Step 7: Test Authentication

1. **Start the Application**
   ```bash
   npm run dev
   ```

2. **Test Login Flow**
   - Visit your app URL
   - Click "Sign in with Google"
   - Complete Google OAuth flow
   - Verify you're logged in and JWT tokens are working

## Troubleshooting

### Common Issues

1. **"Callback URL mismatch"**
   - Ensure callback URLs in Auth0 match your application URL exactly
   - Include both production and development URLs

2. **"Invalid audience"**
   - Verify `VITE_AUTH0_AUDIENCE` matches your API identifier exactly
   - Check that the API is created in Auth0

3. **"Access denied"**
   - Check that Google connection is enabled for your application
   - Verify Google OAuth credentials are correct

4. **Roles not appearing**
   - Check that the custom claims rule is active
   - Verify user metadata is set correctly

### Debugging

1. **Check JWT Tokens**
   - Use [jwt.io](https://jwt.io) to decode tokens
   - Verify custom claims are present

2. **Network Tab**
   - Check browser network tab for Auth0 API calls
   - Look for 401/403 responses

3. **Auth0 Logs**
   - Check Auth0 Dashboard > Monitoring > Logs for authentication errors

## Support

If you need help:
- Check Auth0 Documentation: [auth0.com/docs](https://auth0.com/docs)
- Auth0 Community: [community.auth0.com](https://community.auth0.com)
- Google OAuth Documentation: [developers.google.com/identity/protocols/oauth2](https://developers.google.com/identity/protocols/oauth2)