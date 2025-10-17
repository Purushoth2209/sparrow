# Friend Request Notification Testing Guide

## Debug Logs Added

I've added comprehensive debug logs to help identify why friend request notifications aren't triggering. Here's what to look for:

### Backend Debug Logs (in server console)
- `🔍 DEBUG: sendFriendRequest` - Shows socket ID mapping and emission data
- `🔍 DEBUG: acceptFriendRequest` - Shows socket ID mapping and emission data  
- `🔍 DEBUG: rejectFriendRequest` - Shows socket ID mapping and emission data
- `🔍 DEBUG: removeFriend` - Shows socket ID mapping and emission data

### Frontend Debug Logs (in browser console)
- `🔍 DEBUG: Frontend registering socket` - Shows socket registration
- `🔍 DEBUG: Frontend socket connected` - Shows socket connection status
- `🔍 DEBUG: Frontend received friend_request_* event` - Shows received socket events
- `🔍 DEBUG: NotificationContext notifyFriendRequest* called` - Shows notification function calls

## Testing Steps

### 1. Start the Application
```bash
# Terminal 1: Start Backend
cd sparrow-backend
npm start

# Terminal 2: Start Frontend  
cd sparrow-frontend
npm start
```

### 2. Test Friend Request Received Notification

1. **Open two browser windows/tabs:**
   - Window 1: Login as User A
   - Window 2: Login as User B (different user)

2. **Check Backend Console:**
   - Look for socket registration logs when users connect
   - Note the userSockets map showing active connections

3. **Send Friend Request:**
   - In Window 1, go to Global Search
   - Find User B and send a friend request
   - **Check Backend Console for:**
     ```
     🔍 DEBUG: sendFriendRequest - targetSocketId: [socket_id]
     🔍 DEBUG: sendFriendRequest - userSockets map: [array of connections]
     🔍 DEBUG: sendFriendRequest - emitting friend_request_received with data: [data]
     ```

4. **Check Frontend Console (Window 2):**
   - Look for:
     ```
     🔍 DEBUG: Frontend received friend_request_received event: [data]
     🔍 DEBUG: Frontend calling notifyFriendRequestReceived with: [username]
     🔍 DEBUG: NotificationContext notifyFriendRequestReceived called with: [username]
     🔍 DEBUG: NotificationContext browserPermission: [permission_status]
     ```

5. **Expected Results:**
   - In-app notification toast should appear in Window 2
   - Browser notification should appear (if permission granted)
   - Friend request count badge should increment

### 3. Test Friend Request Accepted Notification

1. **In Window 2 (User B):**
   - Go to Friend Requests
   - Accept the request from User A

2. **Check Backend Console:**
   ```
   🔍 DEBUG: acceptFriendRequest - senderSocketId: [socket_id]
   🔍 DEBUG: acceptFriendRequest - emitting friend_request_accepted with data: [data]
   ```

3. **Check Frontend Console (Window 1):**
   ```
   🔍 DEBUG: Frontend received friend_request_accepted event: [data]
   🔍 DEBUG: Frontend calling notifyFriendRequestAccepted with: [username]
   🔍 DEBUG: NotificationContext notifyFriendRequestAccepted called with: [username]
   ```

### 4. Test Friend Request Rejected Notification

1. **In Window 2 (User B):**
   - Go to Friend Requests  
   - Reject the request from User A

2. **Check for similar debug logs as above**

### 5. Test Friend Unfriended Notification

1. **In Window 1 (User A):**
   - Go to Friends list
   - Remove User B as a friend

2. **Check for similar debug logs as above**

## Common Issues to Check

### Issue 1: Socket ID Not Found
**Backend logs show:** `❌ DEBUG: Failed to emit: targetSocketId=undefined`

**Possible causes:**
- User is not connected to socket
- Socket registration failed
- User logged out before notification

**Solutions:**
- Check if both users are online
- Verify socket registration in backend logs
- Ensure users are on the friends page (where socket is active)

### Issue 2: Frontend Not Receiving Events
**Backend emits successfully but frontend shows no logs**

**Possible causes:**
- Socket connection lost
- Event listeners not registered
- User switched to different page

**Solutions:**
- Check socket connection status
- Verify users are on friends page
- Check browser network tab for socket connection

### Issue 3: Notification Functions Not Called
**Frontend receives socket events but no notification logs**

**Possible causes:**
- Notification context not available
- Event data format incorrect
- Missing username in event data

**Solutions:**
- Check if NotificationProvider is wrapping the app
- Verify event data structure
- Check browser permission status

### Issue 4: Browser Notifications Not Working
**In-app notifications work but browser notifications don't**

**Possible causes:**
- Browser permission denied
- Browser doesn't support notifications
- Focus/visibility issues

**Solutions:**
- Check browser permission status in logs
- Request permission explicitly
- Test in different browser

## Expected Debug Output

### Successful Friend Request Flow:
```
Backend:
✅ Friend request sent from UserA to UserB
🔍 DEBUG: sendFriendRequest - targetSocketId: abc123, toUserId: userB_id, io exists: true
🔍 DEBUG: sendFriendRequest - userSockets map: [["userA_id", "socket1"], ["userB_id", "abc123"]]
🔍 DEBUG: sendFriendRequest - emitting friend_request_received with data: {senderName: "UserA", ...}
📡 Notified user userB_id about friend request from UserA

Frontend (User B):
🔍 DEBUG: Frontend registering socket with profileId: userB_id
🔍 DEBUG: Frontend socket connected, current profileId: userB_id
🔍 DEBUG: Frontend received friend_request_received event: {senderName: "UserA", ...}
🔍 DEBUG: Frontend calling notifyFriendRequestReceived with: UserA
🔍 DEBUG: NotificationContext notifyFriendRequestReceived called with: UserA
🔍 DEBUG: NotificationContext browserPermission: granted
🔔 NotificationContext: Creating notification: {type: "FRIEND_REQUEST_RECEIVED", ...}
🔔 NotificationContext: Showing browser notification
```

## Next Steps

After testing, please share:
1. Which notifications work/don't work
2. Any error messages in console
3. Debug log output for failed notifications
4. Browser and device information

This will help identify the exact issue and implement the appropriate fix.
