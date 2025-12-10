# DEK Auto-Rotation Guide

## Overview

The Sparrow message engine implements **automatic Data Encryption Key (DEK) rotation** to ensure forward secrecy and prevent DEK reuse. DEKs are automatically rotated based on two criteria:

1. **Time-based rotation**: Every 24 hours
2. **Count-based rotation**: Every 1000 messages per session

## Why Auto-Rotation?

### Security Benefits

1. **Forward Secrecy**: If a DEK is compromised, only messages encrypted with that specific DEK are at risk
2. **Limits Exposure Window**: Reduces the time window where a compromised DEK can decrypt messages
3. **Prevents Long-term Reuse**: Ensures DEKs are not used indefinitely
4. **Industry Best Practice**: Matches security practices used by WhatsApp, Signal, and Telegram

### Problems Avoided

- ❌ **DEK reuse for too long**: Old DEKs could be compromised and used to decrypt historical messages
- ❌ **Weakening of forward secrecy**: Without rotation, all messages in a session share the same DEK
- ❌ **Compliance issues**: Many security standards require key rotation

## How It Works

### Rotation Triggers

DEK rotation happens automatically when **either** condition is met:

#### 1. Time-Based Rotation (24 hours)

```javascript
// DEK is rotated if:
const ageMs = now - dek.createdAt;
if (ageMs >= 24 * 60 * 60 * 1000) {
  // Rotate DEK
}
```

**Example:**

- DEK created: `2024-01-01 12:00:00`
- Current time: `2024-01-02 12:00:01`
- **Result**: DEK is rotated (24+ hours have passed)

#### 2. Count-Based Rotation (1000 messages)

```javascript
// DEK is rotated if:
if (dek.messageCount >= 1000) {
  // Rotate DEK
}
```

**Example:**

- DEK created with `messageCount: 0`
- After 1000 messages encrypted: `messageCount: 1000`
- **Result**: DEK is rotated (1000 messages reached)

### Rotation Process

1. **Check rotation conditions** before encryption
2. **If rotation needed**:
   - Remove old DEK from cache
   - Generate new DEK via AWS KMS
   - Cache new DEK with `messageCount: 0`
   - Log rotation event
3. **Encrypt message** with new DEK
4. **Increment message count** after encryption

### Code Flow

```javascript
// In encryptMessageOptimized()
async encryptMessageOptimized(message, sessionId) {
  // 1. Get or create DEK (checks rotation conditions)
  await this.getSessionDEK(sessionId);
  //    ↓
  //    Checks: shouldRotateDEK()
  //    - Time: age >= 24 hours?
  //    - Count: messageCount >= 1000?
  //    ↓
  //    If yes: Rotate DEK (new KMS call)
  //    If no: Use existing DEK

  // 2. Encrypt with DEK (increments messageCount)
  const encrypted = this.encryptMessageWithCachedDEK(message, sessionId);
  //    ↓
  //    cachedDEK.messageCount++

  return encrypted;
}
```

## Configuration

### Environment Variables

```env
# DEK rotation period (hours)
DEK_ROTATION_PERIOD_HOURS=24

# DEK rotation message count
DEK_ROTATION_MESSAGES=1000
```

### Default Values

- **Rotation Period**: 24 hours
- **Rotation Messages**: 1000 messages per session

### Configuration File

```javascript
// src/config/message.js
module.exports = {
  dekRotationPeriodHours: parseInt(process.env.DEK_ROTATION_PERIOD_HOURS) || 24,
  dekRotationMessages: parseInt(process.env.DEK_ROTATION_MESSAGES) || 1000,
  // ...
};
```

## Message Count Tracking

### Per-Session Tracking

Each DEK cache entry tracks:

```javascript
{
  plaintextDEK: Buffer,
  encryptedDEK: Buffer,
  keyId: 'arn:aws:kms:...',
  createdAt: 1234567890,        // Timestamp when DEK was created
  messageCount: 42,              // Number of messages encrypted with this DEK
  rotationPeriodMs: 86400000,    // 24 hours in milliseconds
  sessionId: 'user123-user456'
}
```

### Count Increment

Message count is incremented **after** each encryption:

```javascript
encryptMessageWithCachedDEK(message, sessionId) {
  const cachedDEK = this.dekCache.get(sessionId);

  // Increment count BEFORE encryption
  cachedDEK.messageCount = (cachedDEK.messageCount || 0) + 1;

  // Encrypt message...
}
```

## Rotation Examples

### Example 1: Time-Based Rotation

```
Session: user123-user456
DEK Created: 2024-01-01 12:00:00
Messages Encrypted: 500

Time: 2024-01-02 12:00:01 (24 hours later)
→ DEK is rotated (time-based)
→ New DEK created with messageCount: 0
```

### Example 2: Count-Based Rotation

```
Session: user123-user456
DEK Created: 2024-01-01 12:00:00
Messages Encrypted: 999

Next Message Encrypted:
→ messageCount becomes 1000
→ DEK is rotated (count-based)
→ New DEK created with messageCount: 0
```

### Example 3: Both Conditions Met

```
Session: user123-user456
DEK Created: 2024-01-01 12:00:00
Messages Encrypted: 1000
Age: 25 hours

Next Message Encrypted:
→ Both conditions met (time AND count)
→ DEK is rotated
→ New DEK created
```

## Statistics

### Encryption Stats

The encryption service tracks rotation statistics:

```javascript
const stats = encryptionService.getStats();
// {
//   dekRotations: 15,              // Total rotations
//   dekRotationPeriodHours: 24,     // Rotation period
//   dekRotationMessages: 1000,      // Rotation message count
//   avgMessagesPerSession: 250,     // Average messages per session
//   totalCachedMessageCount: 5000,  // Total messages across all sessions
//   cacheSize: 20,                  // Number of cached DEKs
//   cacheHitRate: 95.5              // Cache hit rate percentage
// }
```

### Monitoring

Check rotation activity in logs:

```
🔄 Auto-rotating DEK for session user123-user456 (time: 24h, count: 1000)
⏰ DEK rotation needed for session user123-user456: Age 24 hours >= 24 hours
📊 DEK rotation needed for session user123-user456: Message count 1000 >= 1000
```

## Impact on Performance

### KMS Calls

- **Without rotation**: 1 KMS call per session (cached)
- **With rotation**: 1 KMS call per session per rotation period
- **Impact**: Minimal - rotation happens infrequently (every 24h or 1000 messages)

### Encryption Speed

- **No impact**: Encryption speed remains the same (uses cached DEK)
- **Rotation overhead**: ~50-100ms per rotation (KMS API call)

### Cache Efficiency

- **Cache hit rate**: Typically 95%+ (rotations are infrequent)
- **Cache size**: Grows with number of active sessions
- **Cleanup**: Old cache entries cleaned up automatically

## Best Practices

### 1. Monitor Rotation Frequency

```javascript
// Check stats periodically
const stats = encryptionService.getStats();
console.log(`DEK Rotations: ${stats.dekRotations}`);
console.log(`Avg Messages/Session: ${stats.avgMessagesPerSession}`);
```

### 2. Adjust Rotation Periods

For high-volume sessions:

```env
DEK_ROTATION_MESSAGES=500  # Rotate more frequently
```

For low-volume sessions:

```env
DEK_ROTATION_PERIOD_HOURS=12  # Rotate more frequently by time
```

### 3. Alert on High Rotation Rates

Monitor for unusual rotation patterns:

- Sudden spike in rotations → Possible issue
- Very high message counts → Consider lowering threshold

## Troubleshooting

### Issue: DEKs Not Rotating

**Check:**

1. Verify configuration values are set correctly
2. Check logs for rotation messages
3. Verify message count is incrementing

**Solution:**

```javascript
// Manually check DEK status
const cachedDEK = encryptionService.dekCache.get(sessionId);
console.log(
  "DEK Age:",
  (Date.now() - cachedDEK.createdAt) / (60 * 60 * 1000),
  "hours"
);
console.log("Message Count:", cachedDEK.messageCount);
```

### Issue: Too Many Rotations

**Check:**

1. Verify rotation thresholds are appropriate
2. Check if sessions are being recreated unnecessarily

**Solution:**

- Increase `DEK_ROTATION_MESSAGES` if count-based rotation is too frequent
- Increase `DEK_ROTATION_PERIOD_HOURS` if time-based rotation is too frequent

## Security Considerations

### Forward Secrecy

- ✅ Old messages encrypted with rotated DEKs remain secure
- ✅ New messages use new DEK (cannot decrypt with old DEK)
- ✅ Compromised DEK only affects messages in that rotation period

### Key Management

- ✅ DEKs are encrypted with AWS KMS (Key Encryption Key)
- ✅ Old DEKs are removed from cache (not stored)
- ✅ Each rotation generates a new random DEK

### Compliance

- ✅ Meets security standards requiring key rotation
- ✅ Configurable rotation periods for different requirements
- ✅ Audit trail via rotation logs

## Summary

**Auto-rotation ensures:**

- ✅ Forward secrecy maintained
- ✅ DEKs rotated every 24 hours OR 1000 messages
- ✅ Automatic (no manual intervention needed)
- ✅ Minimal performance impact
- ✅ Configurable rotation thresholds

**Configuration:**

```env
DEK_ROTATION_PERIOD_HOURS=24
DEK_ROTATION_MESSAGES=1000
```

**Monitoring:**

```javascript
const stats = encryptionService.getStats();
// Check dekRotations, avgMessagesPerSession, etc.
```
