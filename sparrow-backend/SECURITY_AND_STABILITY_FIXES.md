# Security and Stability Fixes - Implementation Summary

## ✅ 1. TTL + Persistence Policy

### MongoDB TTL Index Configuration

- **Message Model**: TTL index on `expireAt` field with `expireAfterSeconds: 0`

  - Messages automatically deleted 7 days after `expireAt` timestamp
  - Index name: `expireAt_ttl` with background creation
  - Location: `src/models/Message.js`

- **TempIdMapping Model**: TTL index on `expireAt` field matching message TTL
  - TempId mappings expire 7 days after creation (matches message TTL)
  - Index name: `expireAt_ttl` with background creation
  - Location: `src/models/TempIdMapping.js`

### Removed Immediate Deletion Code

- ✅ `deleteMapping()` in `tempId.repository.js` - marked as deprecated, TTL handles deletion
- ✅ `deleteMessage()` and `deleteMessages()` in `message.repository.js` - already marked as deprecated
- All message deletion is now handled by MongoDB TTL index only

### Configuration

- TTL duration: 7 days (configurable via `MESSAGE_TTL_DAYS` env var)
- Default: `src/config/message.js` → `messageTTLDays: 7`

---

## ✅ 2. Retry & Worker Behavior Hardened

### Queue Retry Configuration

- **Retry Limit**: 2 retries = 3 total attempts
- **Exponential Backoff**: Base delay 1s → 2s → 4s

  - Attempt 1: immediate (0s)
  - Retry 1: 2^1 \* 1000ms = 2s
  - Retry 2: 2^2 \* 1000ms = 4s
  - Then stop (no more retries)

- **Configuration**: `src/config/message.js`

  - `queueRetryLimit: 2`
  - `queueRetryBaseDelayMs: 1000`

- **Implementation**:
  - `src/queue/message.queue.js` - uses exponential backoff
  - `src/queue/notification.queue.js` - uses exponential backoff

### Worker Behavior

- ✅ **Online Status Check**: Workers check online status ONCE at job execution time

  - Location: `src/queue/processors/message.processor.js` (line 46)
  - No continuous polling or waiting for user to come online
  - If receiver is offline, job completes and receiver syncs via API

- ✅ **Notification Jobs Always Enqueued**:
  - Location: `src/services/message/message.service.js` (line 181-187)
  - Notification jobs are ALWAYS enqueued, even if receiver is online
  - This ensures push notifications when app is backgrounded
  - Socket.IO delivery is additional, not a replacement

---

## ✅ 3. Authentication Middleware Unified

### authAny Middleware

- **Location**: `src/middlewares/authAny.middleware.js`
- **Functionality**: Accepts either session cookie OR Bearer JWT token
  - Tries session-based auth first (web)
  - Falls back to JWT token auth (mobile)
  - Sets `req.user` for both methods

### Protected Routes Verification

All protected routes now use `authAny`:

- ✅ `/api/conversations/*` - conversation routes
- ✅ `/api/messages/*` - message routes (send, sync, markAsRead, updateStatus)
- ✅ `/api/user/*` - user routes (search, update, etc.)
- ✅ `/api/friends/*` - friend routes
- ✅ `/api/search-friends` - search route

### JWT Validation

- ✅ **Token Verification**: `src/services/jwt.service.js`

  - Verifies signature using `JWT_ACCESS_SECRET`
  - Checks expiration (15 minutes for access tokens)
  - Validates algorithm: `HS256`
  - Validates refresh token type

- ✅ **User Validation**: After token verification, checks user exists in database
  - Location: `src/middlewares/authJWT.middleware.js` (line 22-25)

---

## ✅ 4. API Contract Docs + Swagger

### Swagger Configuration

- ✅ **Production Check**: Swagger disabled in production

  - Location: `src/app.js` (line 79-82)
  - Only enabled when `NODE_ENV !== 'production'`

- ✅ **Conversation Endpoints**: Added Swagger docs
  - Location: `src/docs/conversation.yaml`
  - Includes all endpoints with sample request/response bodies
  - Added to `src/docs/swagger.js` endpoint files list

### Sample Request/Response Bodies

Swagger docs include examples for:

- ✅ **Send Message**: `src/docs/message.yaml` - POST /api/messages/send
- ✅ **Sync Messages**: `src/docs/message.yaml` - GET /api/messages/sync
- ✅ **Mark as Read**: `src/docs/message.yaml` - POST /api/messages/markAsRead
- ✅ **Auth**: `src/docs/auth.yaml` - Login, Register endpoints
- ✅ **Conversations**: `src/docs/conversation.yaml` - All conversation endpoints

---

## ✅ 5. Critical Security Checks

### Encryption Flows

- ✅ **KMS Calls**: Verified in `src/services/message/encrypt.service.js`

  - Uses AWS KMS for DEK encryption
  - DEK caching with session-based optimization
  - Encryption context includes purpose

- ✅ **DEK Caching**: Implemented in `src/utils/optimizedKmsEncryption.js`

  - Session-based caching reduces KMS calls
  - TTL-based cache expiration

- ✅ **Rotation**: DEK rotation policy configured
  - `dekRotationMessages: 1000` (configurable)
  - `dekRotationPeriodHours: 24` (configurable)

### Sensitive Fields Protection

- ✅ **Message Responses**: Sensitive fields removed

  - `encryptedDEK` - Always excluded (Message.toJSON())
  - `encryptionContext` - Excluded in production
  - `compressedContent` - Excluded from responses
  - Location: `src/models/Message.js` (line 233-246)
  - Location: `src/services/message/message.service.js` (line 191-193)

- ✅ **Decrypted Messages**: All encryption fields set to `undefined`
  - Location: `src/services/message/sync.service.js` (line 66-76)
  - Location: `src/services/message/message.service.js` (line 247-257)

### JWT Validation

- ✅ **Signing Keys**: Uses environment variables

  - `JWT_ACCESS_SECRET` - for access tokens
  - `JWT_REFRESH_SECRET` - for refresh tokens
  - Default values warn about production usage

- ✅ **Expiration**:

  - Access tokens: 15 minutes
  - Refresh tokens: 30 days

- ✅ **Algorithm**: Fixed to `HS256` (prevents algorithm confusion attacks)

- ✅ **Refresh Flow**:
  - Refresh tokens validated separately
  - Type check ensures refresh token type
  - Location: `src/services/jwt.service.js` (line 75-90)

---

## 📋 Verification Checklist

### TTL & Persistence

- [x] MongoDB TTL index exists on Message.expireAt (7 days)
- [x] MongoDB TTL index exists on TempIdMapping.expireAt (7 days)
- [x] No immediate deletion code in message flow
- [x] deleteMapping() marked as deprecated

### Retry & Workers

- [x] Queue retry limit set to 2 retries (3 total attempts)
- [x] Exponential backoff configured (1s → 2s → 4s)
- [x] Workers check online status at execution time only
- [x] Notification jobs always enqueued (even if receiver online)

### Authentication

- [x] All protected routes use authAny middleware
- [x] authAny supports both session and JWT
- [x] JWT validation includes expiration check
- [x] JWT validation includes signature verification
- [x] JWT validation includes user existence check

### Swagger

- [x] Swagger disabled in production (NODE_ENV check)
- [x] Conversation endpoints documented
- [x] Sample request/response bodies included
- [x] All key endpoints documented (send, sync, markAsRead, auth)

### Security

- [x] encryptedDEK never returned in API responses
- [x] encryptionContext excluded in production
- [x] compressedContent excluded from responses
- [x] JWT signing keys use environment variables
- [x] JWT algorithm fixed to HS256
- [x] JWT expiration validated
- [x] Refresh token type validated

---

## 🔒 Security Notes

1. **Production Environment Variables Required**:

   - `JWT_ACCESS_SECRET` - Must be set in production
   - `JWT_REFRESH_SECRET` - Must be set in production
   - `AWS_KMS_KEY_ID` - For encryption (optional but recommended)

2. **Sensitive Data Never Exposed**:

   - `encryptedDEK` - Always excluded from JSON
   - `encryptionContext` - Excluded in production
   - `compressedContent` - Never returned to clients

3. **Authentication**:
   - All protected routes require authentication
   - Both session and JWT supported
   - User existence validated after token verification

---

## 📝 Next Steps (Optional)

1. **Add Tests**: Create tests for authAny middleware (session + JWT)
2. **Monitor TTL**: Verify TTL indexes are working correctly
3. **Queue Monitoring**: Monitor retry behavior and success rates
4. **Security Audit**: Periodic review of encryption flows
