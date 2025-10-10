# 🔐 Environment Variables Setup Guide

This guide will walk you through setting up all required environment variables for your chat app.

---

## 📋 Step 1: Create `.env` File

Create a file named `.env` in the `backend/` directory:

```bash
cd /home/purushothaman/All/Projects/sample_projects/chat-app/backend
touch .env
```

---

## 📝 Step 2: Add Environment Variables

Copy this template into your `.env` file:

```env
# ======================================
# MONGODB DATABASE
# ======================================
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/database

# ======================================
# JWT SECRETS
# ======================================
# For email/phone/username authentication
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# For OIDC sessions
SESSION_SECRET=your-super-secret-session-key-change-this-in-production

# ======================================
# GOOGLE OAUTH CREDENTIALS
# ======================================
# Get these from: https://console.cloud.google.com/
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:5000/auth/google/callback

# ======================================
# FRONTEND URL
# ======================================
# Your React app URL (for redirects after authentication)
FRONTEND_URL=http://localhost:3000

# ======================================
# SERVER CONFIG
# ======================================
PORT=5000
NODE_ENV=development
```

---

## 🔧 Step 3: Configure Each Variable

### 1️⃣ **MONGO_URI** (You already have this)

✅ Keep your existing MongoDB connection string.

Example:
```env
MONGO_URI=mongodb+srv://myuser:mypassword@cluster0.mongodb.net/chatapp?retryWrites=true&w=majority
```

---

### 2️⃣ **JWT_SECRET** (You already have this)

✅ Keep your existing JWT secret.

If you need a new one, generate a secure random string:
```bash
# Method 1: OpenSSL
openssl rand -base64 32

# Method 2: Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Example:
```env
JWT_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
```

---

### 3️⃣ **SESSION_SECRET** (New - for OIDC)

Generate a different random string than JWT_SECRET:

```bash
# Generate secure session secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Example:
```env
SESSION_SECRET=9z8y7x6w5v4u3t2s1r0q9p8o7n6m5l4k3j2i1h0g9f8e7d6c5b4a3
```

---

### 4️⃣ **GOOGLE_CLIENT_ID** and **GOOGLE_CLIENT_SECRET** (New - for Google Login)

#### 📌 **How to Get Google OAuth Credentials:**

**Step A: Go to Google Cloud Console**

1. Visit: [https://console.cloud.google.com/](https://console.cloud.google.com/)
2. Sign in with your Google account

**Step B: Create or Select Project**

1. Click the project dropdown at the top
2. Click **"New Project"**
3. Enter project name: `chat-app` (or any name)
4. Click **"Create"**
5. Wait for project creation (takes ~10 seconds)
6. Select your new project from the dropdown

**Step C: Enable Google+ API (Required for OIDC)**

1. Go to: **APIs & Services** → **Library**
2. Search for: **"Google+ API"** or **"Google Identity Platform"**
3. Click on it and click **"Enable"**

**Step D: Configure OAuth Consent Screen**

1. Go to: **APIs & Services** → **OAuth consent screen**
2. Select **"External"** (unless you have Google Workspace)
3. Click **"Create"**
4. Fill in required fields:
   - **App name**: `Chat App`
   - **User support email**: Your email
   - **Developer contact email**: Your email
5. Click **"Save and Continue"**
6. **Scopes**: Click **"Add or Remove Scopes"**
   - Select: `openid`, `email`, `profile`
   - Click **"Update"** → **"Save and Continue"**
7. **Test users** (for development):
   - Click **"Add Users"**
   - Add your Gmail address
   - Click **"Save and Continue"**
8. Click **"Back to Dashboard"**

**Step E: Create OAuth 2.0 Credentials**

1. Go to: **APIs & Services** → **Credentials**
2. Click **"+ Create Credentials"** at the top
3. Select **"OAuth 2.0 Client ID"**
4. Choose **Application type**: `Web application`
5. Enter name: `Chat App Web Client`
6. Under **Authorized JavaScript origins**, click **"+ Add URI"**:
   - Add: `http://localhost:5000`
   - Add: `http://localhost:3000` (your React app)
7. Under **Authorized redirect URIs**, click **"+ Add URI"**:
   - Add: `http://localhost:5000/auth/google/callback`
8. Click **"Create"**

**Step F: Copy Credentials**

A popup will show your credentials:
- **Client ID**: `384957446717-xxxxxxxxxxxxxxxxxx.apps.googleusercontent.com`
- **Client Secret**: `GOCSPX-xxxxxxxxxxxxxxxxxxxx`

✅ **Copy these to your `.env` file!**

```env
GOOGLE_CLIENT_ID=384957446717-abc123def456.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-aBcDeFgHiJkLmNoPqRsTuVwXyZ
```

**📸 Visual Guide:**
```
Google Cloud Console
  └─ Select Project: "chat-app"
      └─ APIs & Services
          ├─ OAuth consent screen → Configure
          └─ Credentials
              └─ Create Credentials → OAuth 2.0 Client ID
                  ├─ Application type: Web application
                  ├─ Name: Chat App Web Client
                  ├─ Authorized JavaScript origins:
                  │   ├─ http://localhost:5000
                  │   └─ http://localhost:3000
                  └─ Authorized redirect URIs:
                      └─ http://localhost:5000/auth/google/callback
```

---

### 5️⃣ **GOOGLE_REDIRECT_URI** (New)

This should match the redirect URI you added in Google Cloud Console:

```env
GOOGLE_REDIRECT_URI=http://localhost:5000/auth/google/callback
```

**For production**, change to your production domain:
```env
GOOGLE_REDIRECT_URI=https://yourdomain.com/auth/google/callback
```

---

### 6️⃣ **FRONTEND_URL** (New)

This is your React app's URL. After Google authentication, the backend redirects users here:

```env
FRONTEND_URL=http://localhost:3000
```

**For production**, change to your production frontend URL:
```env
FRONTEND_URL=https://yourdomain.com
```

---

### 7️⃣ **PORT** (Optional)

Default is 5000. Only change if port 5000 is already in use:

```env
PORT=5000
```

---

### 8️⃣ **NODE_ENV** (Optional)

Set to `development` for local development:

```env
NODE_ENV=development
```

**For production**, change to:
```env
NODE_ENV=production
```

---

## ✅ Step 4: Verify Your `.env` File

Your final `.env` file should look like this:

```env
# MongoDB (you already have this)
MONGO_URI=mongodb+srv://youruser:yourpass@cluster0.mongodb.net/chatapp

# JWT Secrets (you already have JWT_SECRET, add SESSION_SECRET)
JWT_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
SESSION_SECRET=9z8y7x6w5v4u3t2s1r0q9p8o7n6m5l4k3j2i1h0g9f8e7d6c5b4a3

# Google OAuth (NEW - from Google Cloud Console)
GOOGLE_CLIENT_ID=384957446717-abc123def456.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-aBcDeFgHiJkLmNoPqRsTuVwXyZ
GOOGLE_REDIRECT_URI=http://localhost:5000/auth/google/callback

# Frontend URL (NEW)
FRONTEND_URL=http://localhost:3000

# Server Config (optional)
PORT=5000
NODE_ENV=development
```

---

## 🧪 Step 5: Test the Setup

### Test 1: Check if variables are loaded

```bash
cd backend
node -e "require('dotenv').config(); console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID); console.log('SESSION_SECRET:', process.env.SESSION_SECRET ? 'SET' : 'NOT SET');"
```

Expected output:
```
GOOGLE_CLIENT_ID: 384957446717-abc123def456.apps.googleusercontent.com
SESSION_SECRET: SET
```

### Test 2: Start the server

```bash
npm start
```

Expected output:
```
✅ Connected to MongoDB
✅ Google OIDC Issuer discovered: https://accounts.google.com
✅ Google OIDC Client initialized
🚀 Server running on http://localhost:5000
🔐 Google OIDC login: http://localhost:5000/auth/google
```

### Test 3: Try Google login

Open in your browser:
```
http://localhost:5000/auth/google
```

You should be redirected to Google's login page!

---

## 🔒 Security Best Practices

### ✅ DO:
- Generate unique random strings for JWT_SECRET and SESSION_SECRET
- Keep `.env` file in `.gitignore` (already done)
- Use different secrets for development and production
- Use strong secrets (at least 32 characters)

### ❌ DON'T:
- Commit `.env` file to Git
- Share your secrets publicly
- Use the same secret for JWT_SECRET and SESSION_SECRET
- Use simple passwords like "secret123"

---

## 🚨 Troubleshooting

### Error: "OIDC client initialization failed"
**Cause:** Missing or invalid Google credentials  
**Fix:** Check `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`

### Error: "redirect_uri_mismatch"
**Cause:** Redirect URI doesn't match Google Console configuration  
**Fix:** Ensure `http://localhost:5000/auth/google/callback` is added in Google Console → Credentials → Authorized redirect URIs

### Error: "Access blocked: This app's request is invalid"
**Cause:** OAuth consent screen not configured  
**Fix:** Complete Step D (Configure OAuth Consent Screen) above

### Error: "Cannot find module 'dotenv'"
**Cause:** Dependencies not installed  
**Fix:** Run `npm install` in backend directory

---

## 📚 Quick Reference

| Variable | Required? | Where to Get |
|----------|-----------|--------------|
| `MONGO_URI` | ✅ Yes | MongoDB Atlas Dashboard |
| `JWT_SECRET` | ✅ Yes | Generate: `openssl rand -base64 32` |
| `SESSION_SECRET` | ✅ Yes | Generate: `openssl rand -base64 32` |
| `GOOGLE_CLIENT_ID` | ✅ Yes | Google Cloud Console → Credentials |
| `GOOGLE_CLIENT_SECRET` | ✅ Yes | Google Cloud Console → Credentials |
| `GOOGLE_REDIRECT_URI` | ✅ Yes | Set to: `http://localhost:5000/auth/google/callback` |
| `FRONTEND_URL` | ✅ Yes | Your React app URL: `http://localhost:3000` |
| `PORT` | ⚪ Optional | Default: `5000` |
| `NODE_ENV` | ⚪ Optional | Default: `development` |

---

## 🎯 Next Steps

After setting up `.env`:

1. ✅ Restart your backend server
2. ✅ Test Google login: `http://localhost:5000/auth/google`
3. ✅ Add Google login button to React frontend
4. ✅ Create `/auth/success` route in React to handle redirect

---

Need help? Check:
- `backend/OIDC_SETUP.md` for complete implementation guide
- Google Cloud Console: [https://console.cloud.google.com/](https://console.cloud.google.com/)
- OIDC documentation: [https://openid.net/connect/](https://openid.net/connect/)

