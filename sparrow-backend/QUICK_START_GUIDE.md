# Quick Start Guide - Messaging Engine Improvements

## 🚀 Quick Setup

### 1. Environment Variables

Add to `.env`:

```env
# Message Persistence
MESSAGE_TTL_DAYS=7

# Compression
COMPRESSION_ALGORITHM=gzip

# Note: Queue retry limits are hardcoded in src/config/message.js
# (2 retries, [0s, 2s, 5s] backoff) - no env vars needed

# DEK Rotation
DEK_ROTATION_MESSAGES=1000
DEK_ROTATION_PERIOD_HOURS=24

# Redis (optional - system works without it)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

### 2. Run Migration

```bash
cd sparrow-backend
node src/scripts/migrate_add_message_compression_and_ttl.js
```

This will:

- Add `expireAt` to existing messages
- Compress existing messages
- Create TTL index
- Create tempIdMappings indexes
- Create conversations indexes

### 3. Start Server

```bash
npm start
```

**Workers are now optional and can start automatically with the server!**

#### Option A: Auto-start workers with server (Recommended for development)

Add to `.env`:
```env
ENABLE_WORKERS=true
```

Workers will start automatically when you run `npm start`.

#### Option B: Run workers separately (Recommended for production)

Don't set `ENABLE_WORKERS` (or set it to `false`), then run:

```bash
# Terminal 1: Message Worker
node src/workers/message.worker.js

# Terminal 2: Notification Worker
node src/workers/notification.worker.js
```

**Note:** Workers are optional - messages are still saved and Socket.IO delivery works without them. Workers only add async offline delivery capability.

## 📡 API Usage

### Send Message (with tempId for deduplication)

```javascript
// HTTP
POST /api/messages/send
{
  "receiverId": "user123",
  "content": "Hello!",
  "tempId": "client-temp-id-123" // Optional, for deduplication
}

// Socket.IO
socket.emit('sendMessage', {
  senderId: "user456",
  receiverId: "user123",
  content: "Hello!",
  tempId: "client-temp-id-123" // Optional
});
```

### Sync Messages (Mobile)

```javascript
GET /api/messages/sync?since=2024-01-01T00:00:00.000Z

Response:
{
  "messages": [...], // Decrypted, decompressed messages
  "conversations": [...], // With unread counts
  "syncTimestamp": "2024-01-01T12:00:00.000Z",
  "count": 10
}
```

### Get Conversations

```javascript
GET /api/messages/conversations?limit=50&offset=0

Response:
{
  "conversations": [
    {
      "conversationId": "user1_user2",
      "participants": ["user1", "user2"],
      "lastMessageId": "...",
      "lastMessagePreview": "Hello...",
      "lastMessageTimestamp": "...",
      "unreadCount": 5
    }
  ]
}
```

## 🔑 Authentication

All endpoints now support both:

**Web (Session):**

```javascript
// Cookie-based (automatic with session)
GET / api / messages / sync;
```

**Mobile (JWT):**

```javascript
// Bearer token
GET /api/messages/sync
Authorization: Bearer <jwt-token>
```

## 📊 What Changed

### Before

- ❌ Messages deleted immediately after delivery
- ❌ No compression
- ❌ No deduplication
- ❌ No conversation tracking
- ❌ No sync API
- ❌ Session-only auth

### After

- ✅ Messages persist 7 days (TTL)
- ✅ Compression (60-70% storage reduction)
- ✅ TempId deduplication
- ✅ Conversation metadata & unread counts
- ✅ Sync API for mobile
- ✅ Session OR JWT auth

## 🧪 Testing

### Test Deduplication

```bash
# Send same message twice with same tempId
curl -X POST http://localhost:5000/api/messages/send \
  -H "Cookie: connect.sid=..." \
  -d '{"receiverId":"user123","content":"Test","tempId":"test-123"}'

# Second call should return existing message
```

### Test Compression

```bash
# Check DB
db.messages.findOne({}, {compressedContent: 1, compressionType: 1, uncompressedSize: 1})
```

### Test Sync

```bash
curl "http://localhost:5000/api/messages/sync?since=2024-01-01T00:00:00.000Z" \
  -H "Authorization: Bearer <token>"
```

## 📝 Notes

- **Messages are NOT deleted** - They auto-delete after 7 days via TTL
- **Queue is optional** - System works without Redis (degraded mode)
- **Compression is automatic** - All new messages compressed
- **Sync does NOT requeue** - Fetches directly from DB
- **Notifications always sent** - Even if receiver is online (for background push)

## 🐛 Troubleshooting

**Redis connection errors:**

- System works without Redis
- Queue features disabled, but messages still saved
- Start Redis to enable async delivery

**Compression errors:**

- Check `COMPRESSION_ALGORITHM` is 'gzip' or 'brotli'
- Legacy messages without compression still work

**TTL not working:**

- Verify TTL index created: `db.messages.getIndexes()`
- Check `expireAt` field exists on messages

**Sync returns empty:**

- Check `since` parameter format (ISO 8601)
- Verify messages have `serverTimestamp` > `since`

## 📚 Full Documentation

See `src/docs/messaging_engine_improvements.md` for complete details.
