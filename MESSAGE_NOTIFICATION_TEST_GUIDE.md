# Message Notification System Test Guide

## Overview
This guide provides comprehensive testing instructions for the enhanced message notification system that ensures 100% reliable in-app and browser notifications.

## Features Implemented

### 1. Backend Notification Trigger
- ✅ New `messageReceivedNotification` socket event fires after message encryption and save
- ✅ Emits for both real-time messages and undelivered messages on connection
- ✅ Includes sender info, message preview (30 chars), and timestamp
- ✅ Debug logging for verification

### 2. Frontend Notification Handling
- ✅ Listens for `messageReceivedNotification` event with duplicate prevention
- ✅ Maintains backward compatibility with `receiveMessage` event
- ✅ Processes notifications regardless of chat window state

### 3. In-App Notifications
- ✅ Follows app theme (blue colors, rounded corners)
- ✅ Shows sender name, message preview, and time
- ✅ 3.5-second duration with smooth fade-in/fade-out animations
- ✅ Click to dismiss functionality

### 4. Browser Notifications
- ✅ Only shows when app is not focused (tab minimized/background)
- ✅ Requests permission on login
- ✅ Custom title: "New message from {sender name}"
- ✅ Click to focus app
- ✅ Uses sender profile image as icon (if available)

### 5. Duplicate Prevention
- ✅ Tracks processed notifications by messageId + senderId
- ✅ Prevents duplicate notifications on reconnection
- ✅ Cleans up old tracking data

## Test Scenarios

### Test 1: Basic Message Notifications
**Setup:**
1. Open two browser windows/tabs with different users logged in
2. Ensure both users are friends
3. Open browser console for debugging

**Steps:**
1. Send a message from User A to User B
2. Verify User B receives:
   - In-app notification (toast in top-right)
   - Console log: "🔔 messageReceivedNotification event received"
   - Console log: "🔔 Adding message notification"

**Expected Results:**
- ✅ In-app notification appears with sender name and message preview
- ✅ Notification shows for 3.5 seconds then fades out
- ✅ No duplicate notifications

### Test 2: Browser Notifications (App Not Focused)
**Setup:**
1. User B has the chat app open but tab is not active
2. Browser notification permission is granted

**Steps:**
1. Send message from User A to User B
2. Switch to User B's tab
3. Check for browser notification

**Expected Results:**
- ✅ Browser notification appears with title "New message from {User A}"
- ✅ Notification body shows message preview
- ✅ Clicking notification focuses the app
- ✅ Console log: "📱 App is focused, skipping browser notification" (when focused)

### Test 3: Chat Window Open vs Closed
**Setup:**
1. User B has chat open with User A
2. Send message from User A

**Expected Results:**
- ✅ Notification still appears even when chat is open
- ✅ No duplicate notifications
- ✅ Console shows notification processing

### Test 4: Multiple Messages Rapidly
**Setup:**
1. Send 5 messages quickly from User A to User B

**Expected Results:**
- ✅ Each message triggers separate notification
- ✅ No duplicate notifications
- ✅ All notifications show correctly
- ✅ Console shows duplicate prevention working

### Test 5: Reconnection Handling
**Setup:**
1. User B disconnects and reconnects
2. Send message from User A while User B is offline
3. User B reconnects

**Expected Results:**
- ✅ Undelivered message triggers notification on reconnect
- ✅ Console log: "🔔 Emitting messageReceivedNotification event for undelivered message"
- ✅ No duplicate notifications

### Test 6: Browser Permission Handling
**Setup:**
1. Deny browser notification permission
2. Send message

**Expected Results:**
- ✅ In-app notification still works
- ✅ No browser notification
- ✅ Console log: "📱 App is focused, skipping browser notification"

### Test 7: Mobile Responsiveness
**Setup:**
1. Test on mobile device or narrow browser window

**Expected Results:**
- ✅ Notifications adapt to screen size
- ✅ Touch interactions work properly
- ✅ Animations are smooth

## Debug Console Commands

### Check Notification State
```javascript
// Check current notifications
console.log('Current notifications:', JSON.parse(localStorage.getItem('sparrow_notifications')));

// Check browser permission
console.log('Browser permission:', Notification.permission);

// Check if app is focused
console.log('App focused:', !document.hidden && document.hasFocus());
```

### Test Notification Manually
```javascript
// Trigger test notification
window.testNotification = () => {
  const { addNotification } = window.notificationContext;
  addNotification({
    type: 'message_received',
    title: 'Test Message',
    message: 'Test User: This is a test message',
    username: 'Test User',
    senderId: 'test123',
    timestamp: new Date().toLocaleTimeString()
  });
};
```

## Verification Checklist

### Backend Verification
- [ ] Console shows "🔔 Emitting messageReceivedNotification event" for each message
- [ ] Event includes senderId, senderName, messagePreview, timestamp
- [ ] Event fires for both real-time and undelivered messages

### Frontend Verification
- [ ] Console shows "🔔 messageReceivedNotification event received"
- [ ] Console shows "🔔 Adding message notification"
- [ ] No "⚠️ Duplicate notification prevented" messages (unless testing duplicates)
- [ ] In-app notifications appear with correct styling
- [ ] Browser notifications only show when app not focused
- [ ] Notifications persist in localStorage

### UI/UX Verification
- [ ] Notifications follow app theme (blue colors)
- [ ] Smooth animations (fade-in/fade-out)
- [ ] Proper duration (3.5 seconds)
- [ ] Click to dismiss works
- [ ] Mobile responsive
- [ ] No visual glitches

## Troubleshooting

### Notifications Not Appearing
1. Check browser console for errors
2. Verify socket connection: `socket.connected`
3. Check notification permission: `Notification.permission`
4. Verify user is authenticated: `localStorage.getItem('profileId')`

### Duplicate Notifications
1. Check console for "⚠️ Duplicate notification prevented"
2. Verify duplicate prevention is working
3. Check if multiple socket listeners are registered

### Browser Notifications Not Working
1. Check permission: `Notification.permission`
2. Verify app focus detection: `document.hidden && document.hasFocus()`
3. Check browser notification settings
4. Test in different browsers

### Performance Issues
1. Check processed notifications cleanup
2. Monitor localStorage size
3. Verify notification limit (50 max)

## Success Criteria

The notification system is working correctly when:
- ✅ Every incoming message triggers exactly one notification
- ✅ In-app notifications appear regardless of chat state
- ✅ Browser notifications only appear when app not focused
- ✅ No duplicate notifications on reconnection
- ✅ Smooth animations and proper styling
- ✅ All test scenarios pass
- ✅ Console logs show proper event flow

## Notes

- The system maintains backward compatibility with existing `receiveMessage` events
- Debug logging can be removed in production
- Notifications are stored in localStorage for persistence
- The system handles edge cases like rapid messages and reconnections
- Mobile responsiveness is included
