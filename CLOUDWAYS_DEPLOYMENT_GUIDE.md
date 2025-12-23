# UniLoop@IIMR - Complete Deployment Guide: Replit to Cloudways/DigitalOcean

This guide provides step-by-step instructions to deploy your application from Replit to Cloudways managed DigitalOcean infrastructure.

## 📋 Table of Contents
1. [Pre-Deployment Code Changes](#pre-deployment-code-changes)
2. [Prepare Your GitHub Repository](#prepare-your-github-repository)
3. [Set Up Auth0 Configuration](#set-up-auth0-configuration)
4. [Set Up PostgreSQL Database](#set-up-postgresql-database)
5. [Create Cloudways Account & Server](#create-cloudways-account--server)
6. [Deploy Application to Server](#deploy-application-to-server)
7. [Configure Environment Variables](#configure-environment-variables)
8. [Build and Start Application](#build-and-start-application)
9. [Configure Nginx Reverse Proxy](#configure-nginx-reverse-proxy)
10. [Set Up SSL/TLS Certificate](#set-up-ssltls-certificate)
11. [Configure Process Management (PM2)](#configure-process-management-pm2)
12. [Post-Deployment Testing](#post-deployment-testing)
13. [Troubleshooting](#troubleshooting)

---

## 1. Pre-Deployment Code Changes

### ✅ Critical Fix: Session Configuration

**IMPORTANT**: The current code uses `server/replitAuth.ts` which requires Replit-specific environment variables. This has been fixed by creating a platform-independent session configuration.

**Status**: ✅ Already done! The codebase now uses `server/sessionConfig.ts` instead.

### Code Audit Summary

| Component | Status | Notes |
|-----------|--------|-------|
| **Authentication** | ✅ Ready | Uses Auth0 (platform-independent) |
| **Session Storage** | ✅ Fixed | Now uses platform-independent sessionConfig.ts |
| **Database** | ✅ Ready | PostgreSQL with Drizzle ORM (standard) |
| **WebSocket** | ✅ Ready | Standard `ws` library (works anywhere) |
| **Build Process** | ✅ Ready | Standard Node.js + Vite (universal) |
| **PWA Features** | ✅ Ready | Standard service worker |

### Files That Reference Replit (But Don't Affect Production)

1. **`server/replitAuth.ts`** - Old Replit OIDC auth (NO LONGER USED ✅)
2. **`@replit/vite-plugin-*`** - Dev-only plugins (don't run in production)
3. **`.env.example`** - Has legacy REPLIT_DOMAINS reference (ignore it)

These files won't cause issues - they're simply not executed in production.

---

## 2. Prepare Your GitHub Repository

### Step 2.1: Create a `.gitignore` File

Create or update `.gitignore` in your project root:

```bash
# In Replit shell or locally
cat > .gitignore << 'EOF'
# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Environment variables (CRITICAL - never commit these)
.env
.env.local
.env.production
.env.*.local

# Build outputs
dist/
server/public/
.vite/

# Database
*.db
*.sqlite

# IDE
.idea/
.vscode/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Logs
logs/
*.log

# Temporary files
tmp/
temp/

# Attached assets (optional - may contain large files)
attached_assets/
EOF
```

### Step 2.2: Initialize Git (if not already done)

```bash
# Check if git is initialized
git status

# If not initialized, run:
git init
git add .
git commit -m "Initial commit - UniLoop application ready for Cloudways deployment"
```

### Step 2.3: Create GitHub Repository

1. Go to [GitHub](https://github.com) and sign in
2. Click the **"+"** icon in top-right → **"New repository"**
3. Fill in:
   - **Repository name**: `uniloop-iimr` (or your preferred name)
   - **Description**: "University utility and communications app"
   - **Visibility**: Private (recommended for production app)
   - **DO NOT** initialize with README, .gitignore, or license (you already have code)
4. Click **"Create repository"**

### Step 2.4: Push Code to GitHub

GitHub will show you instructions. Use these commands:

```bash
# Add GitHub as remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/uniloop-iimr.git

# Rename branch to main (if needed)
git branch -M main

# Push code to GitHub
git push -u origin main
```

**Note**: You may need to authenticate. GitHub now requires Personal Access Tokens:
- Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
- Click "Generate new token (classic)"
- Select scopes: `repo` (full control)
- Use this token as password when prompted

---

## 3. Set Up Auth0 Configuration

### Step 3.1: Update Auth0 Callback URLs

1. Log in to your [Auth0 Dashboard](https://manage.auth0.com)
2. Go to **Applications** → Select your application
3. In **Application URIs** section, update:

   **Allowed Callback URLs**:
   ```
   https://yourdomain.com/auth/callback,
   https://www.yourdomain.com/auth/callback,
   http://localhost:5000/auth/callback
   ```

   **Allowed Logout URLs**:
   ```
   https://yourdomain.com,
   https://www.yourdomain.com,
   http://localhost:5000
   ```

   **Allowed Web Origins**:
   ```
   https://yourdomain.com,
   https://www.yourdomain.com,
   http://localhost:5000
   ```

4. Click **"Save Changes"**

**Note**: Replace `yourdomain.com` with your actual domain. You'll get this from Cloudways later.

### Step 3.2: Gather Auth0 Credentials

You'll need these later for environment variables:

- **Domain**: Found in Application Settings (e.g., `your-tenant.auth0.com`)
- **Client ID**: Found in Application Settings
- **Client Secret**: Found in Application Settings (click "Show" to reveal)

**Keep these safe!** You'll add them to your server in Section 7.

---

## 4. Set Up PostgreSQL Database

You have **two options** for PostgreSQL:

### Option A: Neon Database (Recommended - Easiest)

Neon is a serverless PostgreSQL provider (same as what Replit uses).

1. Go to [Neon Console](https://console.neon.tech)
2. Click **"Create a project"**
3. Configure:
   - **Project name**: `uniloop-production`
   - **PostgreSQL version**: 16 (latest)
   - **Region**: Choose closest to your server location
4. Click **"Create project"**
5. **Copy the connection string** - it looks like:
   ```
   postgresql://username:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require
   ```
6. Save this as your `DATABASE_URL`

**Pricing**: Neon has a generous free tier (0.5 GB storage, 100 hours compute/month). Paid plans start at $19/month.

### Option B: DigitalOcean Managed PostgreSQL

If you want everything on DigitalOcean:

1. Log in to [DigitalOcean](https://cloud.digitalocean.com)
2. Click **"Create"** → **"Databases"**
3. Configure:
   - **Database engine**: PostgreSQL 16
   - **Choose a plan**: Basic ($15/month for 1GB RAM, 10GB storage)
   - **Choose a datacenter region**: Same as your Cloudways server
   - **Database cluster name**: `uniloop-db`
4. Click **"Create Database Cluster"**
5. Wait 3-5 minutes for provisioning
6. Go to **"Connection Details"** tab
7. Copy **"Connection String"** in the format:
   ```
   postgresql://username:password@host:port/database?sslmode=require
   ```
8. Save this as your `DATABASE_URL`

**Recommendation**: Use **Neon** (Option A) for simplicity and cost savings.

---

## 5. Create Cloudways Account & Server

### Step 5.1: Sign Up for Cloudways

1. Go to [Cloudways](https://www.cloudways.com)
2. Click **"Start Free Trial"** (3-day free trial, no credit card required)
3. Fill in your details and verify email

### Step 5.2: Launch Your Server

1. After login, click **"Add Server"** or the **"+" icon**
2. **Select Your Application**: Choose **"Custom App"** (not WordPress/PHP)
3. **Server Configuration**:
   - **Select your cloud provider**: **DigitalOcean**
   - **Server size**: Start with **1 GB** ($12/month) or **2 GB** ($24/month) recommended
   - **Server location**: Choose closest to your users (e.g., Singapore for India)
   - **Application name**: `uniloop`
   - **Server name**: `uniloop-production`
   - **Project**: Default or create "UniLoop Production"
4. Click **"Launch Now"**
5. Wait 5-10 minutes for server provisioning

### Step 5.3: Get Server Details

After provisioning completes:

1. Go to your server dashboard
2. Note down:
   - **Public IP**: e.g., `123.456.789.012`
   - **Username**: Usually `master_xxxxxxx`
   - **Password**: Click eye icon to reveal
   - **SSH Port**: Usually `22` (may be custom)

---

## 6. Deploy Application to Server

### Step 6.1: Connect via SSH

From your local terminal (or Replit shell):

```bash
# Replace with your actual server details
ssh master_xxxxxxx@123.456.789.012 -p 22
```

Enter the password when prompted.

**Tip**: If you're on Windows, use [PuTTY](https://www.putty.org/) or Windows Terminal.

### Step 6.2: Install Node.js 20

Cloudways may have an older Node.js version. Install Node.js 20:

```bash
# Update package list
sudo apt update

# Install Node.js 20 using NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version  # Should show v20.x.x
npm --version   # Should show 10.x.x
```

### Step 6.3: Clone Your Repository

```bash
# Navigate to web root (Cloudways uses /home/master_xxx/applications/app_name/public_html)
cd /home/master_*/applications/*/public_html

# Remove default files
sudo rm -rf *

# Clone your GitHub repository
git clone https://github.com/YOUR_USERNAME/uniloop-iimr.git .

# Note the dot (.) at the end - it clones into current directory
```

If prompted for credentials:
- **Username**: Your GitHub username
- **Password**: Your Personal Access Token (not your GitHub password)

### Step 6.4: Install Dependencies

```bash
# Install all Node.js dependencies
npm install

# This will take 2-5 minutes
```

---

## 7. Configure Environment Variables

### Step 7.1: Create Production `.env` File

```bash
# Create .env file
nano .env
```

### Step 7.2: Add Environment Variables

⚠️ **CRITICAL**: All of these variables are REQUIRED. Missing any will cause the app to crash.

Copy and paste this template, replacing values with your actual credentials:

```bash
# === Node Environment ===
NODE_ENV=production
PORT=5000

# === Database Configuration ===
# Use the connection string from Neon or DigitalOcean PostgreSQL
DATABASE_URL=postgresql://username:password@host:port/database?sslmode=require

# Additional database variables (extract these from your DATABASE_URL)
# Example: postgresql://myuser:mypass@db.neon.tech:5432/mydb
PGDATABASE=mydb
PGHOST=db.neon.tech
PGPASSWORD=mypass
PGPORT=5432
PGUSER=myuser

# === Session Configuration ===
# Generate a strong random secret: openssl rand -base64 32
SESSION_SECRET=your_generated_secret_here_must_be_at_least_32_characters_long

# === Auth0 Configuration (BACKEND) ===
# These are used by the Node.js server
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_CLIENT_ID=your_auth0_client_id_here
AUTH0_CLIENT_SECRET=your_auth0_client_secret_here

# === Auth0 Configuration (FRONTEND) ===
# These MUST start with VITE_ to be available in the frontend
VITE_AUTH0_DOMAIN=your-tenant.auth0.com
VITE_AUTH0_CLIENT_ID=your_auth0_client_id_here

# === Optional: Web Push Notifications (VAPID Keys) ===
# If you're using web push notifications, generate these:
# npx web-push generate-vapid-keys
# VAPID_PUBLIC_KEY=your_public_key_here
# VAPID_PRIVATE_KEY=your_private_key_here
# VAPID_SUBJECT=mailto:your-email@example.com
```

**Save the file**: Press `Ctrl + O`, then `Enter`, then `Ctrl + X`

### Step 7.3: Generate SESSION_SECRET

```bash
# Generate a secure random secret
openssl rand -base64 32

# Copy the output and paste it as SESSION_SECRET in .env
```

### Step 7.4: Verify Environment Variables

```bash
# Check that .env file is created (should NOT output contents for security)
ls -la .env

# Make sure .env is not world-readable
chmod 600 .env

# Verify you have all required variables (this will show variable names only)
grep -E "^[A-Z]" .env | cut -d= -f1
```

Expected output should include all these variables:
```
NODE_ENV
PORT
DATABASE_URL
PGDATABASE
PGHOST
PGPASSWORD
PGPORT
PGUSER
SESSION_SECRET
AUTH0_DOMAIN
AUTH0_CLIENT_ID
AUTH0_CLIENT_SECRET
VITE_AUTH0_DOMAIN
VITE_AUTH0_CLIENT_ID
```

---

## 8. Build and Start Application

### Step 8.1: Set Up Database Schema

```bash
# Push database schema to PostgreSQL
npm run db:push

# You should see output confirming table creation including:
# - users
# - sessions (auto-created by sessionConfig.ts if missing)
# - announcements
# - events
# - (and many more tables)
```

If you get errors, try:
```bash
# Force push if needed
npm run db:push -- --force
```

### Step 8.2: Build the Application

```bash
# Build both frontend and backend
npm run build

# This will:
# 1. Build frontend with Vite → creates server/public/
# 2. Bundle backend with esbuild → creates dist/index.js
```

Expected output:
```
vite v5.x.x building for production...
✓ built in 15-30 seconds
✓ Frontend built successfully
✓ Backend bundled successfully
```

### Step 8.3: Test Production Build Locally

```bash
# Start the production server
npm start
```

Server should start on port 5000. You'll see:
```
🚀 Server Starting - 2025-XX-XXTXX:XX:XX.XXXZ
📍 Environment: production
🗄️ Database URL: [CONFIGURED]
🔑 Auth0 Domain: [CONFIGURED]
🌐 Port: 5000
Auth0 configured for simplified Google OAuth authentication.
serving on port 5000
```

**Keep this running** for now to verify it works.

### Step 8.4: Test from Another Terminal

Open a **new SSH session** (keep the first one running):

```bash
# Test the server
curl http://localhost:5000/api/health

# Expected response: {"status":"ok","database":"connected","environment":"production"}
```

If you see this, **success!** Press `Ctrl + C` in the first terminal to stop the server.

**If you see errors**, check Section 13 (Troubleshooting).

---

## 9. Configure Process Management (PM2)

PM2 will keep your application running 24/7 and auto-restart on crashes.

### Step 9.1: Install PM2 Globally

```bash
sudo npm install -g pm2
```

### Step 9.2: Create PM2 Ecosystem File

```bash
nano ecosystem.config.cjs
```

Add this configuration:

```javascript
module.exports = {
  apps: [{
    name: 'uniloop',
    script: 'npm',
    args: 'start',
    cwd: '/home/master_xxxxx/applications/xxx/public_html',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true
  }]
};
```

**IMPORTANT**: Replace `cwd` path with your actual application path:
```bash
# Get current path
pwd
# Copy the output and replace the cwd value above
```

Save: `Ctrl + O`, `Enter`, `Ctrl + X`

### Step 9.3: Create Logs Directory

```bash
mkdir -p logs
```

### Step 9.4: Start Application with PM2

```bash
# Start the application
pm2 start ecosystem.config.cjs

# Check status
pm2 status

# View logs
pm2 logs uniloop --lines 50
```

You should see:
```
┌─────┬──────────┬─────────────┬─────────┬─────────┬──────────┐
│ id  │ name     │ mode        │ ↺       │ status  │ cpu      │
├─────┼──────────┼─────────────┼─────────┼─────────┼──────────┤
│ 0   │ uniloop  │ fork        │ 0       │ online  │ 0%       │
└─────┴──────────┴─────────────┴─────────┴─────────┴──────────┘
```

### Step 9.5: Set PM2 to Start on Boot

```bash
# Generate startup script
pm2 startup

# Copy and run the command it outputs (will look like):
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u master_xxxxx --hp /home/master_xxxxx

# Save current PM2 process list
pm2 save
```

Now your app will automatically restart after server reboots!

### Step 9.6: Useful PM2 Commands

```bash
# Check application status
pm2 status

# View real-time logs
pm2 logs uniloop

# Restart application (after code changes)
pm2 restart uniloop

# Stop application
pm2 stop uniloop

# Monitor CPU/Memory
pm2 monit

# Clear logs
pm2 flush
```

---

## 10. Configure Nginx Reverse Proxy

Cloudways includes Nginx. We need to configure it to proxy requests to your Node.js app.

### Step 10.1: Find Your Application Domain

In Cloudways dashboard:
1. Go to your application
2. Look for **"Primary Domain"** - might be something like `123-456-789-012.cloudwaysapps.com`
3. Copy this domain

### Step 10.2: Create Nginx Configuration

```bash
# Create nginx config file
sudo nano /etc/nginx/sites-available/uniloop.conf
```

Add this configuration (update the server_name with your domain):

```nginx
# Upstream Node.js app
upstream nodejs_app {
    server 127.0.0.1:5000;
    keepalive 64;
}

server {
    listen 80;
    listen [::]:80;
    
    # Replace with your actual domain from Cloudways
    # Can also add your custom domain here: yourdomain.com www.yourdomain.com
    server_name 123-456-789-012.cloudwaysapps.com;
    
    # Increase timeouts for long-running requests
    proxy_connect_timeout 600s;
    proxy_send_timeout 600s;
    proxy_read_timeout 600s;
    send_timeout 600s;
    
    # Client max body size for file uploads (50MB)
    client_max_body_size 50M;
    
    # Logging
    access_log /var/log/nginx/uniloop_access.log;
    error_log /var/log/nginx/uniloop_error.log;
    
    # WebSocket support - CRITICAL for real-time features
    location /ws {
        proxy_pass http://nodejs_app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Disable buffering for WebSocket
        proxy_buffering off;
        
        # Keep connection alive
        proxy_read_timeout 86400;
    }
    
    # API routes
    location /api {
        proxy_pass http://nodejs_app;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Auth callback needs special handling
        proxy_redirect off;
    }
    
    # Static files and SPA frontend
    location / {
        proxy_pass http://nodejs_app;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Enable caching for static assets
        proxy_cache_bypass $http_upgrade;
    }
}
```

**Update**:
- Replace `server_name` with your actual Cloudways domain
- Add your custom domain if you have one

Save: `Ctrl + O`, `Enter`, `Ctrl + X`

### Step 10.3: Enable Configuration

```bash
# Create symbolic link to enable site
sudo ln -s /etc/nginx/sites-available/uniloop.conf /etc/nginx/sites-enabled/

# Test Nginx configuration
sudo nginx -t

# Expected output:
# nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
# nginx: configuration file /etc/nginx/nginx.conf test is successful

# If successful, reload Nginx
sudo systemctl reload nginx
```

### Step 10.4: Configure Firewall (if needed)

```bash
# Check if firewall is enabled
sudo ufw status

# If enabled, allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Reload firewall
sudo ufw reload
```

### Step 10.5: Test Nginx Proxy

```bash
# Test through Nginx (from server)
curl http://localhost/api/health

# Should return: {"status":"ok","database":"connected","environment":"production"}
```

---

## 11. Set Up SSL/TLS Certificate

### Option A: Using Cloudways SSL (Easiest)

Cloudways provides free Let's Encrypt SSL certificates:

1. Log in to Cloudways dashboard
2. Go to your application → **"SSL Certificate"** tab
3. Enter your domain name
4. Click **"Install Certificate"**
5. Wait 2-5 minutes for installation

### Option B: Manual Certbot Setup (If Cloudways SSL doesn't work)

### Step 11.1: Install Certbot

```bash
# Install Certbot for Let's Encrypt
sudo apt update
sudo apt install -y certbot python3-certbot-nginx
```

### Step 11.2: Point Your Domain to Server

Before getting SSL certificate:

1. Log in to your domain registrar (GoDaddy, Namecheap, etc.)
2. Go to DNS settings
3. Add/Update A records:
   - **Type**: A
   - **Host**: `@` (or yourdomain.com)
   - **Value**: Your Cloudways server IP (e.g., `123.456.789.012`)
   - **TTL**: 600

   - **Type**: A
   - **Host**: `www`
   - **Value**: Your Cloudways server IP
   - **TTL**: 600

4. Wait 5-15 minutes for DNS propagation

### Step 11.3: Verify DNS Propagation

```bash
# Check if domain points to your server
nslookup yourdomain.com

# Or
dig yourdomain.com +short

# Should show your server IP
```

### Step 11.4: Obtain SSL Certificate

```bash
# Get SSL certificate (replace with your domain and email)
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com --email your-email@example.com --agree-tos --no-eff-email

# Follow the prompts:
# - Agree to terms: Yes
# - Redirect HTTP to HTTPS: 2 (Redirect)
```

Certbot will:
1. Verify domain ownership
2. Install SSL certificate
3. Update Nginx config to use HTTPS
4. Set up auto-renewal

### Step 11.5: Test Auto-Renewal

```bash
# Test certificate renewal (dry run)
sudo certbot renew --dry-run

# If successful, certificates will auto-renew every 60 days
```

### Step 11.6: Verify HTTPS

Open your browser and visit:
- `https://yourdomain.com` - Should show green lock icon
- `http://yourdomain.com` - Should redirect to HTTPS

---

## 12. Post-Deployment Testing

### Step 12.1: Health Check

```bash
# Test health endpoint
curl https://yourdomain.com/api/health

# Expected response:
# {"status":"ok","database":"connected","environment":"production"}
```

### Step 12.2: Test in Browser

Open `https://yourdomain.com` (or your Cloudways domain) in browser:

1. **Homepage loads** ✅
2. **No console errors** in DevTools (F12)
3. **Login button visible** ✅

### Step 12.3: Test Authentication

1. Click **"Login with Google"**
2. Complete Google OAuth flow
3. Should redirect back and show you logged in
4. Check DevTools console for any errors

**If login fails**, verify:
- Auth0 callback URLs include your domain
- All AUTH0_* environment variables are set correctly
- SESSION_SECRET is set

### Step 12.4: Test WebSocket Connection

1. Open browser DevTools (F12) → Console tab
2. You should see:
   ```
   📡 [WEBSOCKET] Connected to real-time updates
   ```
3. If you see connection errors, check Nginx WebSocket config (Section 10.2)

### Step 12.5: Test Core Features

Log in as admin and test each module:
- ✅ Home page displays events
- ✅ Events/Calendar page
- ✅ Community Board/Forum
- ✅ Amenities (Menu, Sick Food)
- ✅ Directory search
- ✅ Admin panel (permissions management)
- ✅ Notifications bell icon works
- ✅ PWA install prompt appears

### Step 12.6: Monitor Application Logs

```bash
# Watch PM2 logs in real-time
pm2 logs uniloop --lines 100

# Look for errors like:
# - Database connection errors
# - Auth0 errors
# - WebSocket connection errors
# - 500 Internal Server errors
```

### Step 12.7: Performance Check

```bash
# Monitor resource usage
pm2 monit

# Check memory usage (should be under 500MB for 1GB server)
free -h

# Check disk usage
df -h
```

---

## 13. Troubleshooting

### Issue: "502 Bad Gateway" when visiting website

**Cause**: Node.js app not running or Nginx can't connect to port 5000.

**Solution**:
```bash
# Check if app is running
pm2 status

# If stopped, check logs for errors
pm2 logs uniloop --lines 100

# Common startup errors:
# 1. Missing environment variables
# 2. Database connection failed
# 3. Port 5000 already in use

# Verify port 5000 is listening
sudo netstat -tulpn | grep 5000

# Should show: tcp  0  0 127.0.0.1:5000  0.0.0.0:*  LISTEN  12345/node

# If not running, try starting manually to see errors:
cd /path/to/app
npm start
```

### Issue: Database Connection Errors

**Symptoms**: 
- "Database not connected" in health check
- Errors like "connection refused" in logs

**Solution**:
```bash
# Test database connection manually
psql "$DATABASE_URL" -c "SELECT NOW();"

# If fails, verify:
# 1. DATABASE_URL is correct in .env (check for typos)
cat .env | grep DATABASE_URL

# 2. Database allows connections from your server IP
# For Neon: Check allowed IPs in Neon console
# For DigitalOcean: Add server IP to trusted sources

# 3. SSL mode is set correctly
# Make sure DATABASE_URL ends with: ?sslmode=require

# 4. Test each component of connection string:
# Host reachable?
ping your-db-host.neon.tech

# Port open?
telnet your-db-host.neon.tech 5432
```

### Issue: Auth0 Login Fails or Redirect Loop

**Symptoms**: 
- "Callback URL mismatch" error
- Infinite redirect loop
- "Invalid state parameter" error

**Solution**:

1. **Update Auth0 Callback URLs**:
   ```
   Go to Auth0 Dashboard → Your Application → Settings
   
   Allowed Callback URLs must include:
   https://yourdomain.com/auth/callback
   
   Allowed Logout URLs must include:
   https://yourdomain.com
   
   Allowed Web Origins must include:
   https://yourdomain.com
   ```

2. **Verify Environment Variables**:
   ```bash
   # Check AUTH0 variables in .env
   cat .env | grep AUTH0
   
   # Should show BOTH server-side AND frontend (VITE_) variables:
   # AUTH0_DOMAIN=...
   # AUTH0_CLIENT_ID=...
   # AUTH0_CLIENT_SECRET=...
   # VITE_AUTH0_DOMAIN=...
   # VITE_AUTH0_CLIENT_ID=...
   ```

3. **Restart Application**:
   ```bash
   pm2 restart uniloop
   pm2 logs uniloop --lines 50
   ```

4. **Check Cookies**:
   - Clear browser cookies for your domain
   - Make sure cookies are being set (check DevTools → Application → Cookies)
   - Verify `secure: true` in sessionConfig.ts (should be true for HTTPS)

### Issue: WebSocket Connection Failed

**Symptoms**: 
- Console shows "WebSocket connection failed"
- Real-time updates don't work
- Errors like "wss://yourdomain.com/ws failed"

**Solution**:

1. **Check Nginx WebSocket Config**:
   ```bash
   # Verify /ws location block exists
   sudo grep -A 15 "location /ws" /etc/nginx/sites-available/uniloop.conf
   
   # Should include these critical lines:
   # proxy_set_header Upgrade $http_upgrade;
   # proxy_set_header Connection "upgrade";
   # proxy_buffering off;
   ```

2. **Test WebSocket from Command Line**:
   ```bash
   # Install wscat
   sudo npm install -g wscat
   
   # Test WebSocket connection
   wscat -c wss://yourdomain.com/ws
   
   # Should connect and show:
   # Connected (press CTRL+C to quit)
   ```

3. **Check Firewall**:
   ```bash
   # Make sure port 443 (HTTPS) is open
   sudo ufw status
   
   # Should show:
   # 443/tcp  ALLOW  Anywhere
   ```

4. **Reload Nginx**:
   ```bash
   sudo nginx -t
   sudo systemctl reload nginx
   ```

### Issue: Static Assets Not Loading (CSS/JS 404 errors)

**Symptoms**: 
- Page loads but no styling
- Console shows 404 errors for CSS/JS files
- Blank white page

**Solution**:

1. **Verify Build Completed**:
   ```bash
   # Check if build directory exists
   ls -la server/public/
   
   # Should show:
   # assets/  (CSS and JS files)
   # index.html
   # manifest.json
   # sw.js
   # icons/
   ```

2. **If Missing, Rebuild**:
   ```bash
   npm run build
   
   # Check for errors in build output
   # Vite should complete without errors
   ```

3. **Verify File Permissions**:
   ```bash
   # Make sure Nginx can read the files
   sudo chmod -R 755 server/public
   ```

4. **Restart PM2**:
   ```bash
   pm2 restart uniloop
   ```

### Issue: "Cannot find module" Errors

**Symptoms**:
- PM2 logs show "Cannot find module 'express'"
- Application won't start

**Solution**:
```bash
# Reinstall all dependencies
rm -rf node_modules package-lock.json
npm install

# Rebuild
npm run build

# Restart
pm2 restart uniloop
```

### Issue: High Memory Usage / Server Crashes

**Symptoms**:
- PM2 shows memory usage > 1GB
- Server becomes unresponsive
- PM2 keeps restarting app

**Solution**:

1. **Check Memory Limit**:
   ```bash
   # View current resource usage
   pm2 monit
   
   # Check server memory
   free -h
   ```

2. **Reduce PM2 Memory Limit** (temporary fix):
   ```bash
   # Edit ecosystem.config.cjs
   nano ecosystem.config.cjs
   
   # Change:
   # max_memory_restart: '1G'
   # To:
   # max_memory_restart: '800M'
   ```

3. **Clear PM2 Logs** (they can grow large):
   ```bash
   pm2 flush
   ```

4. **Upgrade Server** (permanent fix):
   - Go to Cloudways dashboard
   - Vertical scaling → Increase to 2GB or 4GB
   - This will require brief downtime

### Issue: Database Schema Mismatch

**Symptoms**:
- Errors about missing columns or tables
- "relation does not exist" errors

**Solution**:
```bash
# Force push schema to database
npm run db:push -- --force

# WARNING: This may drop data!
# Make a database backup first if you have important data

# For Neon: Use their backup feature
# For DigitalOcean: Create a snapshot first
```

### Issue: Can't Access Admin Panel

**Symptoms**:
- "Forbidden" error when accessing /admin
- Admin features not visible

**Solution**:

1. **Check User Role in Database**:
   ```bash
   # Connect to database
   psql "$DATABASE_URL"
   
   # Check your user's role
   SELECT id, email, role, permissions FROM users WHERE email = 'your-email@example.com';
   
   # Update to admin if needed
   UPDATE users SET role = 'admin' WHERE email = 'your-email@example.com';
   
   # Exit
   \q
   ```

2. **Clear Session and Re-login**:
   - Log out
   - Clear browser cookies
   - Log in again

---

## 📊 Complete Environment Variables Checklist

Use this checklist to ensure you have all required variables:

| Variable | Required? | Source | Example Value |
|----------|-----------|--------|---------------|
| `NODE_ENV` | ✅ CRITICAL | Set manually | `production` |
| `PORT` | ✅ CRITICAL | Set manually | `5000` |
| `DATABASE_URL` | ✅ CRITICAL | Neon/DigitalOcean | `postgresql://user:pass@host/db` |
| `PGDATABASE` | ✅ Recommended | Extract from DATABASE_URL | `mydb` |
| `PGHOST` | ✅ Recommended | Extract from DATABASE_URL | `db.neon.tech` |
| `PGPASSWORD` | ✅ Recommended | Extract from DATABASE_URL | `secretpass` |
| `PGPORT` | ✅ Recommended | Extract from DATABASE_URL | `5432` |
| `PGUSER` | ✅ Recommended | Extract from DATABASE_URL | `myuser` |
| `SESSION_SECRET` | ✅ CRITICAL | Generate with openssl | `random_32_char_string` |
| `AUTH0_DOMAIN` | ✅ CRITICAL | Auth0 Dashboard | `your-tenant.auth0.com` |
| `AUTH0_CLIENT_ID` | ✅ CRITICAL | Auth0 Dashboard | `abc123xyz...` |
| `AUTH0_CLIENT_SECRET` | ✅ CRITICAL | Auth0 Dashboard | `secret_xyz...` |
| `VITE_AUTH0_DOMAIN` | ✅ CRITICAL | Auth0 Dashboard | `your-tenant.auth0.com` |
| `VITE_AUTH0_CLIENT_ID` | ✅ CRITICAL | Auth0 Dashboard | `abc123xyz...` |
| `VAPID_PUBLIC_KEY` | ❌ Optional | Generate with web-push | For push notifications |
| `VAPID_PRIVATE_KEY` | ❌ Optional | Generate with web-push | For push notifications |
| ~~`REPLIT_DOMAINS`~~ | ❌ NOT NEEDED | ~~Replit~~ | ~~Removed~~ |
| ~~`REPL_ID`~~ | ❌ NOT NEEDED | ~~Replit~~ | ~~Removed~~ |

---

## 🎯 Deployment Checklist

Track your progress with this checklist:

- [ ] **1. Pre-deployment**: Code changes made (sessionConfig.ts)
- [ ] **2. GitHub**: Code pushed to GitHub repository
- [ ] **3. Auth0**: Callback URLs updated with production domain
- [ ] **4. Database**: PostgreSQL created (Neon or DigitalOcean)
- [ ] **5. Cloudways**: Server provisioned and accessible via SSH
- [ ] **6. Deployment**: Application code cloned to server
- [ ] **6. Dependencies**: `npm install` completed successfully
- [ ] **7. Environment**: All 14 required variables set in `.env`
- [ ] **7. Session Secret**: Generated with `openssl rand -base64 32`
- [ ] **8. Database Schema**: `npm run db:push` completed
- [ ] **8. Build**: `npm run build` completed without errors
- [ ] **8. Test Start**: `npm start` works and health check passes
- [ ] **9. PM2**: Application running with PM2
- [ ] **9. PM2 Startup**: Configured to start on boot
- [ ] **10. Nginx**: Reverse proxy configured
- [ ] **10. Nginx Test**: WebSocket /ws location configured
- [ ] **11. DNS**: Domain pointing to server IP
- [ ] **11. SSL**: Certificate installed (Cloudways or Certbot)
- [ ] **12. Health**: https://yourdomain.com/api/health returns OK
- [ ] **12. Auth**: Login with Google works
- [ ] **12. WebSocket**: Real-time updates connected
- [ ] **12. Features**: All modules tested and working

---

## 📞 Support Resources

- **Cloudways Support**: https://support.cloudways.com
- **Cloudways Community**: https://www.cloudways.com/blog
- **Neon Docs**: https://neon.tech/docs
- **DigitalOcean Docs**: https://docs.digitalocean.com
- **PM2 Docs**: https://pm2.keymetrics.io/docs
- **Nginx Docs**: https://nginx.org/en/docs
- **Certbot Docs**: https://eff-certbot.readthedocs.io
- **Auth0 Docs**: https://auth0.com/docs

---

## 🚀 Post-Deployment Tasks

After successful deployment, consider these next steps:

1. **Monitoring**:
   - Set up UptimeRobot or Pingdom for uptime monitoring
   - Configure PM2 Keymetrics for advanced monitoring

2. **Backups**:
   - Enable automated database backups (Neon Pro or DigitalOcean)
   - Set up weekly server snapshots in Cloudways

3. **Performance**:
   - Enable Cloudways Redis cache
   - Configure Cloudways CDN for static assets
   - Set up Varnish caching if needed

4. **Security**:
   - Enable Cloudways firewall
   - Configure fail2ban for brute-force protection
   - Set up automated security updates

5. **CI/CD Pipeline**:
   - Set up GitHub Actions for automated deployments
   - Create staging environment for testing
   - Implement database migration strategy

6. **Scaling**:
   - Monitor user growth and resource usage
   - Plan for horizontal scaling if needed
   - Consider load balancing for >10,000 users

---

## ✅ Success!

If you've completed all sections and passed all checks in the deployment checklist, congratulations! Your UniLoop application is now running on production infrastructure.

**Your app is live at**: `https://yourdomain.com`

The application is now:
- ✅ Running on dedicated Cloudways/DigitalOcean infrastructure
- ✅ Using Auth0 for secure authentication
- ✅ Connected to PostgreSQL database with proper schema
- ✅ Managed by PM2 for 24/7 uptime
- ✅ Secured with SSL/TLS certificate
- ✅ Supporting real-time WebSocket updates
- ✅ Fully independent of Replit platform

---

**Document Version**: 2.0 (Corrected)  
**Last Updated**: 2025-10-28  
**Critical Fixes Applied**:
- ✅ Session configuration made platform-independent
- ✅ All required environment variables documented
- ✅ Database schema creation instructions added
- ✅ Auth0 server-side variables included
