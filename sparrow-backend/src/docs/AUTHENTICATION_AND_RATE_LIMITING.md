# Authentication and Rate Limiting Guide

## Unified Authentication Middleware

### `authAny.middleware.js`

A single middleware that accepts **both** session cookies (web) and JWT tokens (mobile).

**Benefits:**

- ✅ Mobile and Web unified
- ✅ No duplicated endpoints
- ✅ No separate logic for mobile
- ✅ Improved developer experience

### How It Works

```javascript
async function authAny(req, res, next) {
  // 1. Try session-based authentication first (for web)
  if (req.session && req.session.user) {
    req.user = req.session.user;
    req.authSource = "session";
    return next();
  }

  // 2. Try JWT token authentication (for mobile)
  const token = jwtService.extractTokenFromHeader(req.headers.authorization);
  if (token) {
    req.user = await authenticateWithJWT(token);
    req.authSource = "jwt";
    return next();
  }

  // 3. Neither worked → unauthorized
  return res.status(401).json({ error: "Authentication required" });
}
```

### Usage

```javascript
// All routes use authAny
router.get("/endpoint", authAny, handler);
router.post("/endpoint", authAny, handler);
```

### Authentication Flow

**Web (Session):**

```
1. User logs in → Session cookie created
2. Browser sends cookie automatically
3. req.session.user exists → Authenticated
```

**Mobile (JWT):**

```
1. User logs in → JWT token returned
2. Client sends: Authorization: Bearer <token>
3. Token verified → Authenticated
```

### All Routes Updated

All routes now use `authAny` instead of `ensureAuthenticated`:

- ✅ `/api/friends/*` - Friend routes
- ✅ `/api/messages/*` - Message routes
- ✅ `/api/user/*` - User routes
- ✅ `/api/auth/protected` - Auth routes

---

## Rate Limiting for Message Sending

### Protection Against Abuse

Rate limiting prevents:

- ❌ Chat flooding
- ❌ DDoS on message queue
- ❌ Spam messages
- ❌ Resource exhaustion

### Limits Applied

**Per User Limits:**

- **10 messages per second** per user
- **100 messages per minute** per user

### Implementation

```javascript
// In message.routes.js
router.post('/send',
  authAny,                           // Authentication
  messageSendLimiter,                // 10/sec limit
  messageSendMinuteLimiter,          // 100/min limit
  async (req, res) => { ... }
);
```

### Rate Limiters

**`messageSendLimiter`:**

- Window: 1 second
- Max: 10 messages
- Key: `req.user.profileId` (per user)
- Message: "Too many messages sent. Please slow down (max 10 messages per second)."

**`messageSendMinuteLimiter`:**

- Window: 1 minute
- Max: 100 messages
- Key: `req.user.profileId` (per user)
- Message: "Too many messages sent. Please slow down (max 100 messages per minute)."

### Error Response

When rate limit exceeded:

```json
{
  "message": "Too many messages sent. Please slow down (max 10 messages per second).",
  "statusCode": 429
}
```

### Configuration

Rate limits are hardcoded for security, but can be adjusted in:

```javascript
// src/middlewares/rateLimit.middleware.js
const messageSendLimiter = rateLimit({
  windowMs: 1000, // 1 second
  max: 10, // 10 messages
});
```

---

## Worker Retry Limits

### Explicit Retry Plan

Workers retry message delivery with **limited attempts** to avoid:

- ❌ Infinite retries
- ❌ Duplicate notifications
- ❌ Worker overload

### Retry Configuration

**Retry Plan:**

```
Attempt 1 → immediate (0s)
Retry 1   → 2 seconds
Retry 2   → 5 seconds
Stop      → No more retries
```

**Total Attempts:** 3 (1 initial + 2 retries)

### Configuration

**Hardcoded in `src/config/message.js`** (no environment variables needed):

```javascript
queueRetryLimit: 2,                    // Fixed: 2 retries = 3 total attempts
queueRetryBackoffMs: [0, 2000, 5000]   // Fixed: [0s, 2s, 5s]
```

These values are standard and unlikely to change, so they're hardcoded for simplicity.

### Why Limited Retries?

1. **Mobile Stability**: Prevents battery drain from infinite retries
2. **No Duplicate Notifications**: Stops after reasonable attempts
3. **Worker Efficiency**: Prevents worker overload
4. **User Experience**: Messages sync via API if delivery fails

### Retry Behavior

**Transient Failures:**

- Network errors → Retry with backoff
- Temporary socket errors → Retry with backoff
- Redis connection issues → Retry with backoff

**Permanent Failures:**

- Message not found → Don't retry
- Invalid token → Don't retry
- User not found → Don't retry

---

## Conversation Muting & Archiving

### Features

- **Mute Conversation**: Stop notifications for a conversation
- **Archive Conversation**: Hide conversation from main list
- **Per-User Settings**: Each user has independent mute/archive status

### Conversation Model

```javascript
{
  conversationId: "user123_user456",
  participants: ["user123", "user456"],
  userSettings: Map {
    "user123" => {
      muted: true,
      archived: false,
      mutedAt: ISODate("2024-01-01T12:00:00Z"),
      archivedAt: null
    },
    "user456" => {
      muted: false,
      archived: true,
      archivedAt: ISODate("2024-01-01T12:00:00Z")
    }
  }
}
```

### API Endpoints

#### Mute/Unmute Conversation

```javascript
POST /api/messages/conversations/:conversationId/mute
{
  "muted": true  // or false to unmute
}

Response:
{
  "message": "Conversation muted successfully",
  "conversationId": "user123_user456",
  "muted": true
}
```

#### Archive/Unarchive Conversation

```javascript
POST /api/messages/conversations/:conversationId/archive
{
  "archived": true  // or false to unarchive
}

Response:
{
  "message": "Conversation archived successfully",
  "conversationId": "user123_user456",
  "archived": true
}
```

#### Get Conversations (with mute/archive status)

```javascript
GET /api/messages/conversations?includeArchived=false

Response:
{
  "conversations": [
    {
      "conversationId": "user123_user456",
      "participants": ["user123", "user456"],
      "lastMessagePreview": "Hello!",
      "unreadCount": 2,
      "muted": false,
      "archived": false,
      "mutedAt": null,
      "archivedAt": null
    }
  ]
}
```

### Behavior

**Muted Conversations:**

- Messages still delivered
- Notifications suppressed
- Unread count still increments
- Visible in conversation list

**Archived Conversations:**

- Messages still delivered
- Hidden from main conversation list (unless `includeArchived=true`)
- Unread count still increments
- Can be unarchived anytime

**Filtering:**

- By default, archived conversations are excluded from `/conversations` endpoint
- Use `?includeArchived=true` to include archived conversations

### Repository Methods

```javascript
// Mute/unmute
await conversationRepository.setMuteStatus(conversationId, userId, muted);

// Archive/unarchive
await conversationRepository.setArchiveStatus(conversationId, userId, archived);

// Get user settings
const settings = await conversationRepository.getUserSettings(
  conversationId,
  userId
);
// Returns: { muted, archived, mutedAt, archivedAt }
```

---

## Summary

### ✅ Implemented

1. **Unified Authentication**: All routes use `authAny` (session + JWT)
2. **Rate Limiting**: 10/sec, 100/min per user for message sending
3. **Worker Retry Limits**: Explicit 3-attempt limit (0s, 2s, 5s)
4. **Conversation Muting**: Per-user mute status
5. **Conversation Archiving**: Per-user archive status

### Configuration

```javascript
// Worker retries (hardcoded in src/config/message.js - no env vars needed)
queueRetryLimit: 2,
queueRetryBackoffMs: [0, 2000, 5000]  // [0s, 2s, 5s]
```

### API Usage

```javascript
// Mute conversation
POST /api/messages/conversations/:conversationId/mute
{ "muted": true }

// Archive conversation
POST /api/messages/conversations/:conversationId/archive
{ "archived": true }

// Get conversations (archived filtered by default)
GET /api/messages/conversations?includeArchived=false
```
