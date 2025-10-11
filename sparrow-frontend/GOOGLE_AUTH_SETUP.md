# 🔐 Google OAuth Frontend Setup Guide

This guide explains the Google OAuth integration in your React frontend.

---

## 📋 What Was Added

### **New Components:**

1. **`GoogleOAuthButton.jsx`** - Reusable Google sign-in button
2. **`AuthSuccess.jsx`** - Handles redirect after Google authentication
3. **CSS files** - Styling for Google button and auth flow

### **Updated Components:**

1. **`Login.jsx`** - Added Google sign-in option
2. **`Signup.jsx`** - Added Google sign-up option
3. **`App.jsx`** - Added `/auth/success` route

---

## 🎯 How It Works

### **Authentication Flow:**

```
1. User clicks "Sign in with Google" button
   ↓
2. Button redirects to: http://localhost:5000/auth/google
   ↓
3. Backend redirects to Google's consent screen
   ↓
4. User logs in at Google and approves permissions
   ↓
5. Google redirects back to backend: /auth/google/callback?code=...
   ↓
6. Backend exchanges code for tokens and creates session
   ↓
7. Backend redirects to frontend: http://localhost:3000/auth/success
   ↓
8. AuthSuccess component fetches user data from backend
   ↓
9. If authenticated, stores user info in localStorage
   ↓
10. Connects to Socket.IO
   ↓
11. Redirects to /chat
```

---

## 🔧 Configuration

### **1. Create `.env` in frontend directory**

Create `/chat-app-frontend/.env`:

```env
# Backend API URL
REACT_APP_BACKEND_URL=http://localhost:5000
```

This allows you to easily change the backend URL for production.

---

## 📁 File Structure

```
chat-app-frontend/src/
├── components/
│   ├── GoogleOAuthButton.jsx    (NEW - Google button component)
│   ├── AuthSuccess.jsx          (NEW - Handles OAuth callback)
│   ├── Login.jsx                (UPDATED - Added Google button)
│   ├── Signup.jsx               (UPDATED - Added Google button)
│   └── styles/
│       ├── GoogleOAuthButton.css (NEW - Google button styles)
│       ├── AuthSuccess.css       (NEW - Auth success page styles)
│       ├── Login.css             (Existing)
│       └── Signup.css            (Existing)
├── App.jsx                       (UPDATED - Added /auth/success route)
└── .env                          (NEW - Environment variables)
```

---

## 🎨 Component Details

### **1. GoogleOAuthButton Component**

**Usage:**
```jsx
import GoogleOAuthButton from './GoogleOAuthButton';

// In your component
<GoogleOAuthButton text="Sign in with Google" />
```

**Props:**
- `text` (optional): Button text (default: "Continue with Google")
- `className` (optional): Additional CSS classes

**What it does:**
- Renders a beautiful Google-style button
- On click, redirects to `{BACKEND_URL}/auth/google`
- Backend handles the entire OAuth flow

---

### **2. AuthSuccess Component**

**Purpose:** Handles the redirect after successful Google authentication.

**Flow:**
1. Component mounts when user lands on `/auth/success`
2. Fetches user data from backend: `GET /api/user`
3. Uses `credentials: 'include'` to send session cookie
4. If authenticated:
   - Stores user info in localStorage
   - Connects to Socket.IO
   - Redirects to `/chat`
5. If not authenticated:
   - Shows error message
   - Redirects to `/login`

---

### **3. Updated Login Page**

**New UI:**
```
┌─────────────────────────────┐
│       Logo & Title          │
│  "Welcome Back! Please..."  │
│                             │
│  ┌─────────────────────┐   │
│  │ [G] Sign in with    │   │
│  │     Google          │   │
│  └─────────────────────┘   │
│                             │
│  ─────────  OR  ──────────  │
│                             │
│  [Email/Phone/Username]     │
│  [Password]                 │
│  [Login Button]             │
│                             │
│  Don't have an account?     │
└─────────────────────────────┘
```

---

### **4. Updated Signup Page**

**New UI:**
```
┌─────────────────────────────┐
│       Logo & Title          │
│  "Create your account"      │
│                             │
│  ┌─────────────────────┐   │
│  │ [G] Sign up with    │   │
│  │     Google          │   │
│  └─────────────────────┘   │
│                             │
│  ─────────  OR  ──────────  │
│                             │
│  [Full Name]                │
│  [Username]                 │
│  [Email or Phone]           │
│  [Password]                 │
│  [Signup Button]            │
│                             │
│  Already have an account?   │
└─────────────────────────────┘
```

---

## 🧪 Testing

### **Test 1: Start Frontend**

```bash
cd chat-app-frontend
npm start
```

Frontend should run on: `http://localhost:3000`

---

### **Test 2: Test Google Login**

1. Open: `http://localhost:3000/login`
2. Click **"Sign in with Google"**
3. You should be redirected to Google
4. Log in with your Google account
5. After approval, you'll see "Completing authentication..."
6. You should be redirected to `/chat`

---

### **Test 3: Check LocalStorage**

After successful Google login, open browser DevTools (F12):

**Console:**
```javascript
localStorage.getItem('profileId')    // Should show: google-102938475638291
localStorage.getItem('username')     // Should show: yourusername
localStorage.getItem('email')        // Should show: you@gmail.com
localStorage.getItem('fullName')     // Should show: Your Full Name
localStorage.getItem('token')        // Should show: google-oauth-session
```

---

### **Test 4: Test Email/Phone Login**

The existing email/phone/username login still works:

1. Enter email, phone, or username
2. Enter password
3. Click "Login"
4. Should redirect to `/chat`

Both authentication methods work side-by-side! 🎉

---

## 🔐 Session Management

### **Two Auth Methods:**

#### **1. Email/Phone/Username (JWT-based)**
- Uses JWT tokens
- Token stored in localStorage
- Token sent in `Authorization` header or `x-auth-token` header
- Short-lived access token (15 min)
- Long-lived refresh token (7 days)

#### **2. Google OIDC (Session-based)**
- Uses Express sessions
- Session ID stored in cookie
- Cookie sent automatically by browser
- Session expires after 7 days

---

## 🚨 Troubleshooting

### **Issue 1: "Authentication failed" on /auth/success**

**Cause:** Backend session cookie not being sent

**Fix:**
1. Ensure backend has CORS configured with credentials:
   ```javascript
   app.use(cors({
     origin: 'http://localhost:3000',
     credentials: true
   }));
   ```

2. Ensure frontend uses `credentials: 'include'`:
   ```javascript
   fetch(url, { credentials: 'include' })
   ```

---

### **Issue 2: Button redirects but nothing happens**

**Cause:** Backend not running or wrong URL

**Fix:**
1. Ensure backend is running: `cd backend && npm start`
2. Check backend URL in `.env`:
   ```env
   REACT_APP_BACKEND_URL=http://localhost:5000
   ```
3. Check browser console for errors

---

### **Issue 3: Google login works but chat doesn't load**

**Cause:** Socket.IO not connecting

**Fix:**
1. Check if Socket.IO is initialized in AuthSuccess.jsx
2. Ensure backend Socket.IO is running
3. Check browser DevTools → Network → WS tab for WebSocket connection

---

### **Issue 4: "redirect_uri_mismatch" error**

**Cause:** Frontend URL doesn't match Google Console configuration

**Fix:**
1. Go to Google Cloud Console → Credentials
2. Add `http://localhost:3000` to **Authorized JavaScript origins**
3. Ensure `http://localhost:5000/auth/google/callback` is in **Authorized redirect URIs**

---

## 🎯 Production Deployment

### **Frontend Changes:**

Update `.env.production`:

```env
REACT_APP_BACKEND_URL=https://api.yourdomain.com
```

### **Google Console Changes:**

Add production URLs:
- **Authorized JavaScript origins:**
  - `https://yourdomain.com`
  - `https://api.yourdomain.com`
- **Authorized redirect URIs:**
  - `https://api.yourdomain.com/auth/google/callback`

### **Backend Changes:**

Update `backend/.env`:

```env
FRONTEND_URL=https://yourdomain.com
GOOGLE_REDIRECT_URI=https://api.yourdomain.com/auth/google/callback
NODE_ENV=production
```

---

## 🔒 Security Notes

### **✅ What's Secure:**

1. **No client-side secrets** - Google Client Secret stays on backend
2. **Session cookies** - HttpOnly, SameSite, Secure in production
3. **CSRF protection** - State parameter validated on backend
4. **Token verification** - ID tokens verified with Google's public keys
5. **No password storage** - Google users don't have passwords in your DB

### **⚠️ Important:**

1. **Never expose** `GOOGLE_CLIENT_SECRET` in frontend
2. **Always use HTTPS** in production
3. **Enable secure cookies** in production (`secure: true`)
4. **Validate user data** from Google before storing

---

## 📊 User Data Flow

### **What's stored in localStorage:**

```javascript
{
  profileId: "google-102938475638291",  // Unique ID
  username: "john_doe",                 // Generated or from email
  email: "john@gmail.com",              // From Google
  fullName: "John Doe",                 // From Google
  profileImage: "https://...",          // Google profile picture
  token: "google-oauth-session"         // Flag for PrivateRoute
}
```

### **What's stored in MongoDB:**

```javascript
{
  fullName: "John Doe",
  email: "john@gmail.com",
  profileId: "google-102938475638291",
  username: "john_doe",
  profileImage: "https://...",
  password: "[hashed-random-string]",   // Not used for Google login
  isOnline: false,
  socketId: null,
  contacts: [],
  accountCreationDate: "2025-10-10T12:00:00Z"
}
```

---

## 🎨 Customization

### **Change Button Text:**

```jsx
<GoogleOAuthButton text="Login with Google" />
<GoogleOAuthButton text="Sign up with Google" />
<GoogleOAuthButton text="Continue with Google" />
```

### **Change Button Style:**

Edit `GoogleOAuthButton.css`:

```css
.google-oauth-btn {
  background-color: #4285f4; /* Google Blue */
  color: white;
  /* ... other styles ... */
}
```

### **Add More OAuth Providers:**

To add GitHub, create `GitHubOAuthButton.jsx`:

```jsx
const GitHubOAuthButton = () => {
  const handleGitHubLogin = () => {
    window.location.href = 'http://localhost:5000/auth/github';
  };
  
  return (
    <button onClick={handleGitHubLogin}>
      Sign in with GitHub
    </button>
  );
};
```

Then add backend support for GitHub OIDC (see `backend/OIDC_SETUP.md`).

---

## ✅ Summary

Your frontend now supports:

- ✅ **Google OAuth login** - One-click sign-in
- ✅ **Email/Phone/Username login** - Traditional method
- ✅ **Beautiful UI** - Google-style buttons with dividers
- ✅ **Session handling** - Automatic redirect after auth
- ✅ **Error handling** - User-friendly error messages
- ✅ **localStorage integration** - Works with existing chat app
- ✅ **Socket.IO integration** - Real-time chat after Google login

Both authentication methods work seamlessly side-by-side! 🚀

---

## 📚 Next Steps

1. ✅ Test Google login flow
2. ✅ Test email/phone login flow
3. ✅ Test chat functionality after Google login
4. ✅ Add logout functionality (clear localStorage + destroy session)
5. ✅ Deploy to production and update Google Console URLs

Need help? Check:
- `backend/OIDC_SETUP.md` - Backend implementation guide
- `backend/ENV_SETUP_GUIDE.md` - Environment variables setup
- [React Router Docs](https://reactrouter.com/) - Routing
- [Google OIDC Docs](https://developers.google.com/identity/protocols/oauth2/openid-connect) - OAuth details

