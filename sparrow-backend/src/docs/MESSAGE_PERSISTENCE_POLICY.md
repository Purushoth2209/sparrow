# Message Persistence Policy

## ⚠️ CRITICAL: Messages Are NOT Deleted After Delivery

### Policy

Messages **MUST** remain in the database until:

1. **TTL Expiration**: MongoDB TTL index automatically deletes messages after `expireAt` (7 days by default)
2. **OR** (Optional): Receiver explicitly marks them as read AND sender has synced

### Why This Matters

**❌ DO NOT delete messages immediately after delivery**

Dangerous scenarios if messages are deleted:
- Sender closes app / mobile offline / immediate crash → message is lost permanently
- Receiver's device crashes before saving → message is lost
- Network issues prevent client from saving → message is lost
- No way to recover or resync messages

**✅ Correct Behavior (Like WhatsApp, Telegram, Signal)**

All major messaging apps keep messages in the database until:
- User explicitly deletes them, OR
- TTL expires (for ephemeral messages), OR
- User syncs and confirms receipt

### Implementation

#### Message Lifecycle

```
1. Message Sent
   ↓
2. Saved to DB with status: 'sent'
   ↓
3. Delivered via Socket.IO (if online) → status: 'delivered'
   OR
   Delivered via sync API → status: 'delivered'
   ↓
4. Marked as read → status: 'read'
   ↓
5. Persists in DB for 7 days (TTL)
   ↓
6. MongoDB TTL index automatically deletes after expireAt
```

#### TTL Configuration

```javascript
// In Message model
expireAt: { type: Date, required: true }
// TTL index: expireAfterSeconds: 0 (deletes at expireAt time)
```

#### Default TTL: 7 Days

Configurable via `MESSAGE_TTL_DAYS` environment variable:
```env
MESSAGE_TTL_DAYS=7
```

### What Happens on Delivery

1. **Message is delivered** (via Socket.IO or sync API)
2. **Status updated** to 'delivered' or 'read'
3. **Message remains in DB** - NOT deleted
4. **Available for sync** via `GET /messages/sync?since=timestamp`
5. **Auto-deleted** after 7 days by MongoDB TTL

### Sync Behavior

When receiver calls `GET /messages/sync?since=timestamp`:

1. Fetches messages directly from MongoDB
2. Does NOT requeue messages
3. Returns decrypted messages
4. Client sorts by `serverTimestamp` (not queue order)

### Worker Behavior

Workers:
- Check online status **ONCE** per job
- Deliver if online, send notification if offline
- **STOP** after one attempt (with retries for transient failures only)
- Do NOT continuously poll or wait for user to come online

Receiver will fetch offline messages using sync API.

### Migration Notes

If you have existing code that deletes messages:

```javascript
// ❌ WRONG - Do NOT do this
await Message.findByIdAndDelete(messageId);
await Message.deleteMany({ status: 'delivered' });

// ✅ CORRECT - Let TTL handle deletion
// Messages are automatically deleted after expireAt
// No manual deletion needed
```

### Benefits

1. **Reliability**: Messages never lost due to crashes or network issues
2. **Sync Support**: Offline users can sync messages on reconnect
3. **History**: Users can access message history (within TTL period)
4. **Consistency**: Matches behavior of major messaging apps
5. **Simplicity**: No complex deletion logic needed

### Storage Considerations

- Compression reduces storage by ~60-70%
- TTL limits storage growth (7 days max)
- Automatic cleanup via MongoDB TTL index
- No manual cleanup scripts needed

### Testing

To verify messages persist:

```javascript
// 1. Send message
const message = await sendMessage({...});

// 2. Deliver message
await markDelivered(message._id);

// 3. Verify message still exists
const persisted = await Message.findById(message._id);
console.assert(persisted !== null, 'Message should still exist');

// 4. Wait for TTL expiration (or check expireAt)
// Message will be auto-deleted after expireAt
```

