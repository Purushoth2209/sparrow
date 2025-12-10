# Required Improvements - Implementation Status

## ✅ All Required Improvements Implemented

### 1. ✅ Messages NOT Deleted After Delivery

**Status**: ✅ **FIXED**

- Messages persist in database until TTL expiration (7 days)
- No immediate deletion after delivery
- MongoDB TTL index handles automatic cleanup
- Messages available for sync even after delivery

**Changes**:

- Removed all `Message.findByIdAndDelete()` calls from normal flow
- Added deprecation warnings to `deleteMessage()` and `deleteMessages()` methods
- Created `MESSAGE_PERSISTENCE_POLICY.md` documentation

**Files Modified**:

- `src/repositories/message.repository.js` - Added deprecation warnings
- `src/docs/MESSAGE_PERSISTENCE_POLICY.md` - New documentation

---

### 2. ✅ Workers Do NOT Continuously Check Online Status

**Status**: ✅ **FIXED**

- Workers check online status **ONCE** per job execution
- Workers do NOT poll or wait for user to come online
- If receiver is offline, notification is sent and job completes
- Receiver fetches messages via `GET /messages/sync?since=timestamp`

**Changes**:

- Added clear comments in `message.processor.js` explaining behavior
- Workers stop after one attempt (with retries for transient failures only)
- No continuous polling or waiting logic

**Files Modified**:

- `src/queue/processors/message.processor.js` - Added documentation comments

---

### 3. ✅ Notification Job ALWAYS Added

**Status**: ✅ **ALREADY IMPLEMENTED** (Added comment for clarity)

- Notification job is **always** enqueued, even if receiver is online
- Ensures push notifications when app is backgrounded
- Socket.IO delivery is additional, not a replacement

**Changes**:

- Added comment in `message.service.js` clarifying this behavior

**Files Modified**:

- `src/services/message/message.service.js` - Added clarifying comment

---

### 4. ✅ Sync API Does NOT Requeue Messages

**Status**: ✅ **ALREADY IMPLEMENTED** (Added documentation)

- Sync API fetches directly from MongoDB
- Does NOT push messages back into queue
- Returns decrypted messages to client
- Client sorts by `serverTimestamp` (not queue order)

**Changes**:

- Added clear documentation in `sync.service.js`
- Verified no requeue logic exists

**Files Modified**:

- `src/services/message/sync.service.js` - Added documentation

---

### 5. ✅ Use serverTimestamp for Ordering

**Status**: ✅ **ALREADY IMPLEMENTED**

- All messages have `serverTimestamp` field
- Client must sort by `message.serverTimestamp`
- Queue order is NOT guaranteed
- Sync API returns messages sorted by `serverTimestamp` ascending

**Implementation**:

- `serverTimestamp` set when message is saved
- Sync API sorts by `serverTimestamp: 1` (ascending)
- Legacy `timestamp` field maintained for backward compatibility

---

### 6. ✅ Conversation Table Added

**Status**: ✅ **ALREADY IMPLEMENTED**

- `conversations` collection tracks conversation metadata
- Stores: `conversationId`, `participants`, `lastMessageId`, `lastMessagePreview`, `lastMessageTimestamp`, `unreadCounts`
- Fast chat list loading
- Unread count tracking per conversation

**Files**:

- `src/models/Conversation.js` - Conversation model
- `src/repositories/conversation.repository.js` - Conversation repository

---

### 7. ✅ Limited Retries with Exponential Backoff

**Status**: ✅ **FIXED**

- Retry configuration: `[0, 2000, 5000, 10000]` milliseconds
- First attempt: immediate (0s)
- First retry: after 2s
- Second retry: after 5s
- Third retry: after 10s (if limit allows)
- Never infinite retry

**Changes**:

- Updated `queueRetryBackoffMs` default to `[0, 2000, 5000, 10000]`
- Updated queue configuration to use correct backoff delay
- Added documentation in `message.js` config

**Files Modified**:

- `src/config/message.js` - Updated retry backoff configuration
- `src/queue/message.queue.js` - Updated backoff delay
- `src/queue/notification.queue.js` - Updated backoff delay

---

### 8. ✅ Blocking Logic Improved

**Status**: ✅ **ALREADY IMPLEMENTED**

- Bidirectional blocking check in `checkBlockingStatus()`
- If sender blocked receiver OR receiver blocked sender → message not delivered
- Blocking check applied in:
  - `sendMessage()` - Prevents sending
  - `markRead()` - Prevents marking as read
  - `getDecryptedMessages()` - Prevents accessing messages

**Implementation**:

```javascript
async function checkBlockingStatus(userId1, userId2) {
  // Check if user1 has blocked user2
  // Check if user2 has blocked user1
  // Return blocking status
}
```

**Files**:

- `src/services/message/message.service.js` - `checkBlockingStatus()` function

---

### 9. ✅ Authentication (JWT + Cookie Fallback)

**Status**: ✅ **ALREADY IMPLEMENTED**

- Unified `authAny` middleware supports both:
  - Session cookie (web)
  - Authorization: Bearer JWT (mobile)
- Checks session first, then JWT
- Sets `req.authSource` to indicate auth method

**Implementation**:

```javascript
async function authAny(req, res, next) {
  if (req.session && req.session.user) {
    req.user = req.session.user;
    req.authSource = "session";
    return next();
  }
  // Check JWT...
}
```

**Files**:

- `src/middlewares/authAny.middleware.js` - Unified auth middleware
- All routes use `authAny` middleware

---

### 10. ✅ Compression Metadata Added

**Status**: ✅ **ALREADY IMPLEMENTED**

- Stores compression metadata:
  - `compressionType`: 'gzip', 'brotli', or 'none'
  - `compressedContent`: Buffer containing compressed encrypted content
  - `uncompressedSize`: Original size before compression
- Proper decompression using stored metadata

**Implementation**:

- Compression before storage
- Decompression before delivery
- Metadata stored in message document

**Files**:

- `src/utils/compression.js` - Compression utilities
- `src/services/message/message.service.js` - Compression in sendMessage
- `src/services/message/delivery.service.js` - Decompression in delivery
- `src/services/message/sync.service.js` - Decompression in sync

---

## Optional Improvements (Recommended)

### 11. Message Previews

- ✅ Already implemented in notification processor
- ✅ Conversation previews in conversation repository

### 12. DEK Rotation

- ✅ Already implemented in `encrypt.service.js`
- ✅ Configurable via `DEK_ROTATION_MESSAGES` and `DEK_ROTATION_PERIOD_HOURS`

### 13. TempId Mappings in Separate Collection

- ✅ Already implemented
- ✅ `tempIdMappings` collection with unique index

### 14. Metrics + Logging

- ⚠️ **TODO**: Add comprehensive metrics
- ✅ Basic logging already in place
- ⚠️ **TODO**: Add queue latency tracking
- ⚠️ **TODO**: Add delivery success rate tracking

### 15. API Rate Limits

- ⚠️ **TODO**: Add rate limiting per user
- ✅ Basic rate limiting exists in `rateLimit.middleware.js`
- ⚠️ **TODO**: Add per-user rate limits for message sending

---

## Summary

**All 10 Required Improvements**: ✅ **COMPLETE**

- Messages persist until TTL (not deleted after delivery)
- Workers check online status once and stop
- Notifications always enqueued
- Sync API doesn't requeue
- serverTimestamp used for ordering
- Conversation table implemented
- Limited retries with exponential backoff
- Blocking logic improved
- Unified authentication (JWT + cookie)
- Compression metadata stored

**Optional Improvements**: 3/5 Complete

- Message previews: ✅
- DEK rotation: ✅
- TempId mappings: ✅
- Metrics + logging: ⚠️ Partial
- API rate limits: ⚠️ Partial

---

## Testing Checklist

- [ ] Verify messages persist after delivery
- [ ] Verify workers don't continuously poll
- [ ] Verify notifications always enqueued
- [ ] Verify sync API doesn't requeue
- [ ] Verify serverTimestamp ordering
- [ ] Verify conversation table works
- [ ] Verify retry backoff timing
- [ ] Verify blocking prevents delivery
- [ ] Verify authAny middleware works
- [ ] Verify compression/decompression works

---

## Configuration

Update `.env` with:

```env
# Message TTL (7 days)
MESSAGE_TTL_DAYS=7

# Retry backoff (0s, 2s, 5s, 10s)
QUEUE_RETRY_BACKOFF_MS=0,2000,5000,10000

# Retry limit (2 retries = 3 total attempts)
QUEUE_RETRY_LIMIT=2
```
