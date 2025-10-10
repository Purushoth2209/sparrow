# OpenID Connect (OIDC) Authentication Setup

## 🎯 Overview

This project implements **Google authentication using OpenID Connect (OIDC)** directly, without Passport.js. The implementation is modular and extensible, making it easy to add more identity providers (GitHub, Microsoft, etc.).

---

## 🏗️ Architecture

### Modular Structure

```
backend/
├── config/
│   └── oidcClients.js          # OIDC client configuration (Google, future providers)
├── controllers/
│   ├── authController.js       # Email/phone/username authentication
│   └── oidcAuthController.js   # OIDC authentication flow handlers
├── middleware/
│   ├── authMiddleware.js       # JWT validation (existing)
│   └── ensureAuthenticated.js  # Session/JWT validation (OIDC)
├── routes/
│   ├── authRoutes.js           # Email/phone/username auth routes
│   ├── oidcAuthRoutes.js       # OIDC auth routes (Google)
│   └── userRoutes.js           # Protected user endpoints
├── utils/
│   └── tokenVerifier.js        # ID token verification helpers
└── server.js                   # Express app with sessions
```

---

## 🔐 OIDC Flow Explained

### What is OpenID Connect?

**OpenID Connect (OIDC)** is an authentication layer on top of OAuth 2.0. It provides:
- **ID Token**: A JWT containing user identity (email, name, picture)
- **UserInfo Endpoint**: Additional user profile data
- **Standardized Discovery**: Automatic endpoint configuration

**Key Difference from OAuth:**
- OAuth 2.0 = **Authorization** (what can you access?)
- OIDC = **Authentication** (who are you?)

---

### Google OIDC Flow

```
1. User clicks "Login with Google"
   ↓
2. App redirects to /auth/google
   ↓
3. Server generates state (CSRF protection) and nonce (replay protection)
   ↓
4. Server redirects to Google's authorization endpoint:
   https://accounts.google.com/o/oauth2/v2/auth?
     client_id=YOUR_CLIENT_ID
     &redirect_uri=http://localhost:5000/auth/google/callback
     &response_type=code
     &scope=openid email profile
     &state=RANDOM_STATE
     &nonce=RANDOM_NONCE
   ↓
5. User logs in at Google and approves permissions
   ↓
6. Google redirects to: /auth/google/callback?code=AUTH_CODE&state=RANDOM_STATE
   ↓
7. Server validates state parameter (CSRF check)
   ↓
8. Server exchanges authorization code for tokens (POST to Google):
   Request:
   {
     code: "AUTH_CODE",
     client_id: "YOUR_CLIENT_ID",
     client_secret: "YOUR_CLIENT_SECRET",
     redirect_uri: "http://localhost:5000/auth/google/callback",
     grant_type: "authorization_code"
   }
   
   Response:
   {
     access_token: "ya29.a0AfH6SMBx...",  // Access Google APIs
     id_token: "eyJhbGciOiJSUzI1NiIs...", // User identity (JWT)
     expires_in: 3599,
     token_type: "Bearer",
     scope: "openid email profile",
     refresh_token: "..." // optional
   }
   ↓
9. Server verifies ID token signature using Google's public keys (JWKS)
   ↓
10. Server decodes ID token to get user info:
    {
      sub: "102938475638291",      // Google user ID
      email: "user@gmail.com",
      email_verified: true,
      name: "John Doe",
      picture: "https://...",
      given_name: "John",
      family_name: "Doe",
      locale: "en",
      iat: 1234567890,
      exp: 1234571490
    }
   ↓
11. Server creates/updates user in MongoDB
   ↓
12. Server creates session (req.session.user = {...})
   ↓
13. Server redirects to frontend with success
```

---

## 📋 Setup Instructions

### 1. Install Dependencies

```bash
cd backend
npm install
```

**New dependency added:**
- `openid-client` - Official OpenID Connect client library

**Removed dependencies:**
- `passport`
- `passport-google-oauth20`

---

### 2. Get Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth 2.0 Client ID**
5. Configure:
   - Application type: **Web application**
   - Authorized redirect URIs:
     - `http://localhost:5000/auth/google/callback` (development)
     - `https://yourdomain.com/auth/google/callback` (production)
6. Copy **Client ID** and **Client Secret**

---

### 3. Environment Variables

Add to `backend/.env`:

```env
# MongoDB
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/database

# JWT Secret (for email/phone auth)
JWT_SECRET=your-jwt-secret-key

# Session Secret (for OIDC)
SESSION_SECRET=your-session-secret-key

# Google OIDC
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:5000/auth/google/callback

# Frontend URL (for redirects after auth)
FRONTEND_URL=http://localhost:3000

# Environment
NODE_ENV=development
```

---

### 4. Start the Server

```bash
npm start
```

You should see:
```
✅ Connected to MongoDB
🚀 Server running on http://localhost:5000
🔐 Google OIDC login: http://localhost:5000/auth/google
📊 API endpoints:
   - POST /api/auth/register → Email/phone registration
   - POST /api/auth/login → Email/phone login
   - GET  /auth/google → Google OIDC login
   - GET  /api/user → Get current user (protected)
   - GET  /auth/logout → Logout
```

---

## 🔌 API Endpoints

### OIDC Endpoints

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/auth/google` | Initiate Google login | Public |
| GET | `/auth/google/callback` | Google callback (receives code) | Public |
| GET | `/auth/logout` | Logout user | Public |

### User Endpoints

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/user` | Get current user profile | Protected |
| GET | `/api/profile` | Get current user profile (alt) | Protected |

### Email/Phone Auth (Existing)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/api/auth/register` | Register with email/phone | Public |
| POST | `/api/auth/login` | Login with email/phone | Public |
| POST | `/api/auth/refresh-token` | Refresh access token | Public |
| POST | `/api/auth/logout` | Logout (JWT-based) | Public |

---

## 🧪 Testing

### Test Google OIDC Login

#### Method 1: Browser
1. Open: `http://localhost:5000/auth/google`
2. You'll be redirected to Google
3. Log in and approve permissions
4. You'll be redirected back to your app
5. Check session: `http://localhost:5000/api/user`

#### Method 2: Postman (for callback testing)
```bash
# Step 1: Get authorization URL
GET http://localhost:5000/auth/google
# → Copy the redirect URL and open in browser
# → After Google login, copy the callback URL with code

# Step 2: Test callback
GET http://localhost:5000/auth/google/callback?code=...&state=...
```

### Test Protected Endpoint

```javascript
// With session cookie (after OIDC login)
fetch('http://localhost:5000/api/user', {
  credentials: 'include' // Send session cookie
})
.then(res => res.json())
.then(data => console.log(data));

// With JWT (after email/phone login)
fetch('http://localhost:5000/api/user', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
.then(res => res.json())
.then(data => console.log(data));
```

---

## 🔧 Frontend Integration

### React Example

```jsx
// Login with Google button
<button onClick={() => {
  window.location.href = 'http://localhost:5000/auth/google';
}}>
  Login with Google
</button>

// Create a route to handle success redirect
// Route: /auth/success
useEffect(() => {
  // Check if user is authenticated
  fetch('http://localhost:5000/api/user', {
    credentials: 'include' // Send session cookie
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      // User is authenticated
      setUser(data.user);
      navigate('/dashboard');
    }
  });
}, []);

// Logout
const logout = () => {
  fetch('http://localhost:5000/auth/logout', {
    credentials: 'include'
  })
  .then(() => {
    setUser(null);
    navigate('/');
  });
};
```

---

## 🚀 Adding More Providers

### Example: Add GitHub

1. **Get GitHub OAuth App credentials** from GitHub Developer Settings

2. **Add to `config/oidcClients.js`:**

```javascript
let githubClient = null;

async function getGitHubClient() {
  if (githubClient) return githubClient;
  
  const githubIssuer = await Issuer.discover('https://token.actions.githubusercontent.com');
  
  githubClient = new githubIssuer.Client({
    client_id: process.env.GITHUB_CLIENT_ID,
    client_secret: process.env.GITHUB_CLIENT_SECRET,
    redirect_uris: ['http://localhost:5000/auth/github/callback'],
    response_types: ['code'],
  });
  
  return githubClient;
}

module.exports = {
  getGoogleClient,
  getGitHubClient, // Export
};
```

3. **Add to `controllers/oidcAuthController.js`:**

```javascript
const { getGitHubClient } = require('../config/oidcClients');

exports.githubLogin = async (req, res) => {
  try {
    const client = await getGitHubClient();
    const state = generators.state();
    req.session.oidcState = state;
    
    const authUrl = client.authorizationUrl({
      scope: 'openid email profile',
      state,
    });
    
    res.redirect(authUrl);
  } catch (error) {
    res.status(500).json({ success: false, error: 'GitHub login failed' });
  }
};

exports.githubCallback = async (req, res) => {
  // Same flow as googleCallback but with GitHub client
  const client = await getGitHubClient();
  // ... rest of callback logic
};
```

4. **Add to `routes/oidcAuthRoutes.js`:**

```javascript
router.get('/github', oidcAuthController.githubLogin);
router.get('/github/callback', oidcAuthController.githubCallback);
```

5. **Add to `.env`:**

```env
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
```

---

## 🔐 Security Features

### Implemented
✅ **State parameter** - CSRF protection  
✅ **Nonce parameter** - Replay attack prevention  
✅ **ID token verification** - Signature validation with Google's public keys  
✅ **Secure session cookies** - HttpOnly, SameSite, Secure (in production)  
✅ **Token expiration checks** - Automatic by openid-client  
✅ **Issuer validation** - Ensures token is from Google  
✅ **Audience validation** - Ensures token is for your app  

### Best Practices
- Session secret stored in environment variable
- HTTPS enforced in production (`secure: true`)
- SameSite cookies prevent CSRF
- Sessions expire after 7 days
- Authorization codes are single-use

---

## 📊 Comparison: Passport vs Direct OIDC

| Feature | Passport.js | Direct OIDC (openid-client) |
|---------|-------------|------------------------------|
| **Dependencies** | passport + strategy packages | openid-client only |
| **Complexity** | Higher (serialize/deserialize) | Lower (explicit flow) |
| **Control** | Abstracted | Full control over flow |
| **Extensibility** | Add strategies | Add clients |
| **Learning Curve** | Moderate | Lower (follows spec) |
| **OIDC Compliance** | Depends on strategy | Full OIDC compliance |
| **Token Verification** | Strategy-dependent | Built-in JWKS validation |

---

## 🐛 Troubleshooting

### Error: "Invalid state parameter"
- **Cause:** State mismatch (CSRF protection triggered)
- **Fix:** Ensure cookies are enabled, session middleware is configured

### Error: "OIDC client initialization failed"
- **Cause:** Missing or invalid Google credentials
- **Fix:** Check `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`

### Error: "redirect_uri_mismatch"
- **Cause:** Callback URL doesn't match Google Console configuration
- **Fix:** Ensure `GOOGLE_REDIRECT_URI` matches exactly in Google Console

### Session not persisting
- **Cause:** Cookies not being sent
- **Fix:** Use `credentials: 'include'` in fetch, enable CORS credentials

### ID token verification fails
- **Cause:** Clock skew or invalid token
- **Fix:** Ensure system time is correct, check token expiration

---

## 📚 Resources

- [OpenID Connect Spec](https://openid.net/specs/openid-connect-core-1_0.html)
- [Google OpenID Connect](https://developers.google.com/identity/protocols/oauth2/openid-connect)
- [openid-client Documentation](https://github.com/panva/node-openid-client)
- [JWT.io](https://jwt.io) - Decode ID tokens

---

## ✅ Summary

Your authentication system now supports:
- ✅ **Email/Phone/Username** auth with JWT (existing)
- ✅ **Google OIDC** auth with sessions (new)
- ✅ Modular structure for adding more providers
- ✅ Session and JWT-based authentication
- ✅ Secure token verification
- ✅ CSRF and replay attack protection
- ✅ Production-ready configuration

**No Passport.js dependency!** 🎉

