# Queue Architecture

## 🎯 Architectural Rules

### Rule 1: Local DB is always the source of truth for UI

**Implementation:**

- Messages are stored in IndexedDB `messages` store
- UI always loads from IndexedDB first (instant display)
- Even after app reload, messages persist and are loaded from IndexedDB
- Server sync updates IndexedDB, which then updates UI

**Files:**

- `src/store/chat.store.js` - Loads all messages from IndexedDB on mount
- `src/hooks/useChat.js` - `loadMessages()` loads from DB first, then server

### Rule 2: Queue only transports messages

**Implementation:**

- Queue (`outboundQueue` store) is ONLY for sending messages
- Queue does NOT store message history
- Messages are removed from queue after successful send
- Failed messages remain in queue for retry, but are NOT part of history

**Files:**

- `src/queue/outboundQueue.service.js` - Adds to queue for transport
- `src/queue/queueProcessor.js` - Processes queue and removes on success
- `src/client-db/queue.db.js` - Queue CRUD operations

**Queue Lifecycle:**

1. Message sent → Added to queue
2. Queue processor sends message
3. Server responds → Message removed from queue
4. Message stored in `messages` store (history)

### Rule 3: Sync API never pushes messages into queue

**Implementation:**

- Sync service (`sync.service.js`) fetches from server
- Sync saves directly to IndexedDB `messages` store
- Sync never touches the queue
- Queue and sync are completely independent

**Files:**

- `src/services/sync.service.js` - Fetches from server, saves to IndexedDB
- `src/services/api/messages.api.js` - `sync()` endpoint

**Sync Flow:**

1. Call `/api/messages/sync?since=timestamp`
2. Server returns messages
3. Save to IndexedDB `messages` store
4. Merge into chat store
5. Never touches queue

### Rule 4: Queue must be mobile-compatible

**Implementation:**

- Queue logic is abstracted from database layer
- Database operations use async functions that can be swapped
- For React Native, replace IndexedDB with:
  - **SQLite**: Use `react-native-sqlite-storage` or `expo-sqlite`
  - **MMKV**: Use `react-native-mmkv` for key-value storage
  - **WatermelonDB**: Use `@nozbe/watermelondb` for reactive database

**Abstraction Points:**

- `src/client-db/queue.db.js` - Queue database operations
- `src/client-db/message.db.js` - Message database operations
- `src/client-db/tempId.db.js` - TempId mapping operations
- `src/client-db/sync.db.js` - Sync state operations

**Mobile Migration:**

1. Replace `indexedDB.client.js` with mobile DB adapter
2. Implement same interface for:
   - `addToQueue()`, `getNextQueueItem()`, `deleteQueueItem()`
   - `addMessage()`, `getMessagesByConversation()`, `updateMessageByTempId()`
   - `addTempIdMapping()`, `getMessageIdByTempId()`
   - `setLastSyncTimestamp()`, `getLastSyncTimestamp()`
3. Queue processor logic remains unchanged

## Data Flow

### Sending a Message

```
User sends message
  ↓
Generate tempId (UUID)
  ↓
Save to IndexedDB messages store (history)
  ↓
Add to outboundQueue (transport)
  ↓
Show in UI immediately (from messages store)
  ↓
Queue processor sends to server
  ↓
Server responds with messageId
  ↓
Update messages store (tempId → messageId)
  ↓
Remove from queue (transport complete)
```

### Receiving Messages (Sync)

```
App opens / Socket reconnects
  ↓
Call /api/messages/sync?since=timestamp
  ↓
Server returns messages
  ↓
Save to IndexedDB messages store (history)
  ↓
Merge into chat store
  ↓
Display in UI
  ↓
(Queue is never involved)
```

### App Reload

```
App reloads
  ↓
Chat store initializes
  ↓
Load ALL messages from IndexedDB (Rule 1)
  ↓
Display messages immediately
  ↓
Sync in background (updates IndexedDB)
  ↓
Merge new messages into store
```

## Database Schema

### messages Store (History)

- Primary key: `id` (auto-increment)
- Indexes: `messageId`, `tempId`, `senderId`, `receiverId`, `conversationId`, `timestamp`, `status`
- Purpose: Store all message history
- Persists: Yes, forever (until user clears)

### outboundQueue Store (Transport)

- Primary key: `id` (auto-increment)
- Indexes: `tempId`, `senderId`, `receiverId`, `timestamp`, `retryCount`
- Purpose: Transport messages to server
- Persists: Only until sent successfully

### tempIdMappings Store

- Primary key: `tempId`
- Indexes: `messageId`, `timestamp`
- Purpose: Map tempId → messageId
- Persists: Yes, for deduplication

### syncState Store

- Primary key: `key`
- Purpose: Store sync metadata
- Persists: Yes

## Mobile Compatibility

### SQLite Implementation Example

```javascript
// src/client-db/sqlite-adapter.js
import SQLite from "react-native-sqlite-storage";

export const addToQueue = async (item) => {
  const db = await SQLite.openDatabase({ name: "sparrow.db" });
  return new Promise((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql(
        "INSERT INTO outboundQueue (tempId, senderId, receiverId, content, timestamp, retryCount) VALUES (?, ?, ?, ?, ?, ?)",
        [
          item.tempId,
          item.senderId,
          item.receiverId,
          item.content,
          item.timestamp,
          item.retryCount,
        ],
        (tx, results) => resolve(results.insertId),
        (tx, error) => reject(error)
      );
    });
  });
};
```

### MMKV Implementation Example

```javascript
// src/client-db/mmkv-adapter.js
import { MMKV } from "react-native-mmkv";

const storage = new MMKV({ id: "sparrow" });

export const addToQueue = async (item) => {
  const queue = storage.getString("outboundQueue")
    ? JSON.parse(storage.getString("outboundQueue"))
    : [];
  queue.push({ ...item, id: Date.now() });
  storage.set("outboundQueue", JSON.stringify(queue));
  return item.id;
};
```

### WatermelonDB Implementation Example

```javascript
// src/client-db/watermelon-adapter.js
import { database } from "./database";
import { QueueItem, Message } from "./schema";

export const addToQueue = async (item) => {
  await database.write(async () => {
    await database.collections.get("queue_items").create((queueItem) => {
      queueItem.tempId = item.tempId;
      queueItem.senderId = item.senderId;
      queueItem.receiverId = item.receiverId;
      queueItem.content = item.content;
      queueItem.timestamp = item.timestamp;
      queueItem.retryCount = item.retryCount;
    });
  });
};
```

## Key Principles

1. **Separation of Concerns**

   - Queue = Transport layer
   - Messages store = History layer
   - Sync = Server fetch layer

2. **Local-First**

   - UI always reads from local DB
   - Server sync updates local DB
   - Queue processes from local DB

3. **Mobile-Ready**
   - Database layer is swappable
   - Queue logic is platform-agnostic
   - Same architecture works on web and mobile
