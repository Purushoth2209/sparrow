# Workers Configuration Guide

## Overview

Workers can run in two modes:
1. **Embedded Mode**: Workers start automatically with the server (same process)
2. **Standalone Mode**: Workers run as separate processes

## Configuration

### Enable Workers with Server (Embedded Mode)

Add to `.env`:
```env
ENABLE_WORKERS=true
```

When you run `npm start`, workers will automatically start in the same process as the server.

**Benefits:**
- Simple deployment (one process)
- Automatic startup
- Good for development and small-scale deployments

**Limitations:**
- Workers share resources with server
- Can't scale workers independently
- Worker crashes could affect server

### Run Workers Separately (Standalone Mode)

Don't set `ENABLE_WORKERS` (or set to `false`), then run:

```bash
# Terminal 1: Server
npm start

# Terminal 2: Message Worker
node src/workers/message.worker.js

# Terminal 3: Notification Worker
node src/workers/notification.worker.js
```

**Benefits:**
- Independent scaling
- Better resource isolation
- Production-ready architecture
- Can deploy workers on different servers

## How It Works

### Embedded Mode (`ENABLE_WORKERS=true`)

1. Server starts
2. After server listens, checks `ENABLE_WORKERS` env variable
3. If `true`, requires worker modules
4. Workers initialize in same process
5. Workers handle shutdown gracefully (don't exit process)

### Standalone Mode (`ENABLE_WORKERS=false` or unset)

1. Server starts (workers not loaded)
2. Run workers as separate processes
3. Each worker has its own process
4. Workers exit on SIGTERM/SIGINT

## Worker Behavior

### Both Modes

- **Graceful Degradation**: If Redis unavailable, workers log warning but don't crash
- **Error Handling**: Workers handle connection errors gracefully
- **Job Processing**: Workers process jobs from Redis queues
- **Retry Logic**: Configurable retries with exponential backoff

### Embedded Mode Specific

- Workers don't exit process on shutdown
- Use `process.once()` to prevent duplicate handlers
- Share process resources with server

### Standalone Mode Specific

- Workers exit process on SIGTERM/SIGINT
- Independent process management
- Can be scaled horizontally

## Environment Variables

```env
# Enable/disable workers with server
ENABLE_WORKERS=true  # or '1' to enable, false/unset to disable

# Redis configuration (required for workers)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=  # Optional

# Worker-specific (for standalone mode)
WORKER_STANDALONE=true  # Forces standalone behavior even if embedded
```

## Production Recommendations

### Option 1: Embedded (Simple)
```env
ENABLE_WORKERS=true
```
- Good for: Small deployments, single server
- Workers run in same process as server

### Option 2: Standalone (Scalable)
```env
ENABLE_WORKERS=false
```
- Good for: Production, horizontal scaling
- Use PM2 or Docker to manage workers separately:
  ```bash
  pm2 start src/workers/message.worker.js --name message-worker
  pm2 start src/workers/notification.worker.js --name notification-worker
  ```

## Troubleshooting

### Workers not starting
- Check `ENABLE_WORKERS` is set to `'true'` or `'1'`
- Check Redis is running and accessible
- Check logs for connection errors

### Workers crash server
- This shouldn't happen (workers handle errors gracefully)
- If it does, run workers in standalone mode instead

### Workers not processing jobs
- Verify Redis connection
- Check queue is initialized
- Check worker logs for errors

## Testing

### Test Embedded Mode
```bash
export ENABLE_WORKERS=true
npm start
# Check logs for "✅ Message worker started" and "✅ Notification worker started"
```

### Test Standalone Mode
```bash
# Don't set ENABLE_WORKERS
npm start
# In separate terminals:
node src/workers/message.worker.js
node src/workers/notification.worker.js
```

## Notes

- **Workers are optional**: Messages are still saved and Socket.IO delivery works without workers
- **Redis is optional**: System works without Redis, but workers can't run
- **Queue degrades gracefully**: If Redis unavailable, queue operations are skipped silently
- **Messages always saved**: Database operations don't depend on workers

