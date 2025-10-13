# Sparrow Chat Application - Comprehensive Documentation

## Table of Contents
1. [Application Overview](#application-overview)
2. [Architecture Overview](#architecture-overview)
3. [Backend Documentation](#backend-documentation)
4. [Frontend Documentation](#frontend-documentation)
5. [Authentication System](#authentication-system)
6. [Real-time Messaging System](#real-time-messaging-system)
7. [Friend Management System](#friend-management-system)
8. [Database Schema](#database-schema)
9. [API Endpoints](#api-endpoints)
10. [Security Features](#security-features)


---

## Application Overview

**Sparrow** is a modern, real-time chat application built with a Node.js backend and React frontend. It features comprehensive user authentication, friend management, and real-time messaging capabilities.

### Key Features
- **Dual Authentication**: Email/Phone/Username login + Google OAuth
- **Real-time Messaging**: Socket.IO powered instant messaging
- **Friend Management**: Send requests, accept/reject, remove friends
- **Global User Search**: Find and connect with other users
- **Message Status Tracking**: Sent, delivered, read status indicators
- **Online Status**: Real-time friend online/offline status
- **Responsive UI**: Modern, mobile-friendly interface

---

## Architecture Overview

### Technology Stack

#### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Real-time**: Socket.IO
- **Authentication**: Express-session + OpenID Connect (OIDC)
- **Security**: bcryptjs, rate limiting, CORS
- **Validation**: libphonenumber-js, DNS validation

#### Frontend
- **Framework**: React 19.0.0
- **Routing**: React Router DOM 7.1.1
- **UI Components**: React Bootstrap 2.10.7
- **HTTP Client**: Axios 1.7.9
- **Real-time**: Socket.IO Client 4.8.1
- **Styling**: Custom CSS with modern theme

### System Architecture Diagram

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Client  │    │   Node.js API   │    │    MongoDB      │
│                 │    │                 │    │                 │
│ • Login/Signup  │◄──►│ • Auth Routes   │◄──►│ • Users         │
│ • Friends Page  │    │ • User Routes   │    │ • Messages      │
│ • Global Search │    │ • Friend Routes │    │ • Friend Reqs   │
│ • Chat Interface│    │ • Message Routes│    │                 │
│                 │    │                 │    │                 │
│ • Socket.IO     │◄──►│ • Socket.IO     │    │                 │
│   Client        │    │   Server        │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │   Google OAuth  │
                    │   (OIDC)        │
                    └─────────────────┘
```

---

## Backend Documentation

### Project Structure
```
sparrow-backend/
├── config/
│   └── oidcClients.js          # OIDC provider configuration
├── controllers/
│   ├── authController.js       # Authentication logic
│   ├── friendController.js     # Friend management
│   └── messageController.js    # Message handling
├── middleware/
│   └── ensureAuthenticated.js  # Authentication middleware
├── models/
│   ├── User.js                 # User schema
│   └── Message.js              # Message schema
├── routes/
│   ├── authRoutes.js           # Authentication routes
│   ├── oidcAuthRoutes.js       # OIDC routes
│   ├── userRoutes.js           # User management routes
│   ├── friendRoutes.js         # Friend management routes
│   └── messageRoutes.js        # Message routes
├── utils/
│   └── tokenVerifier.js        # OIDC token verification
├── socketio.js                 # Socket.IO server implementation
└── server.js                   # Main server file
```

### Core Backend Components

#### 1. Server Configuration (`server.js`)

**Purpose**: Main application entry point and server configuration.

**Key Features**:
- Express server setup with CORS configuration
- Session management with express-session
- MongoDB connection with Mongoose
- Route mounting and middleware setup
- Socket.IO server initialization

**Technical Implementation**:
```javascript
// CORS Configuration
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'https://www.sparrowchat.in',
  'https://sparrowchat.in'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

// Session Configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  name: 'sparrow.sid',
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  }
}));
```

#### 2. User Model (`models/User.js`)

**Purpose**: Defines user schema and database structure.

**Schema Fields**:
```javascript
const userSchema = new mongoose.Schema({
  fullName: String,
  email: { type: String, unique: true, sparse: true },
  phoneNumber: { type: String, unique: true, sparse: true },
  password: { type: String, required: true },
  profileId: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true },
  friends: [{ type: String }], // Array of profileIds
  friendRequests: [{
    fromUserId: String,
    status: { type: String, enum: ['pending', 'accepted', 'rejected'] },
    timestamp: Date
  }],
  isOnline: { type: Boolean, default: false },
  lastSeen: { type: Date, default: Date.now },
  profileImage: { type: String, default: '' },
  accountCreationDate: { type: Date, default: Date.now },
  // Security fields
  loginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date, default: null },
  passwordChangedAt: { type: Date, default: null },
  needsUsernameSetup: { type: Boolean, default: false }
});
```

#### 3. Message Model (`models/Message.js`)

**Purpose**: Defines message schema for chat functionality.

**Schema Fields**:
```javascript
const MessageSchema = new mongoose.Schema({
  senderId: String,
  receiverId: String,
  content: String,
  timestamp: Date,
  status: {
    type: String,
    enum: ['sent', 'delivered', 'read'],
    default: 'sent'
  },
  deliveredAt: Date,
  readAt: Date
});
```

#### 4. Authentication Controller (`controllers/authController.js`)

**Purpose**: Handles all authentication-related operations.

**Key Functions**:

##### User Registration
```javascript
exports.registerUser = async (req, res) => {
  // Input validation and normalization
  // Email/phone validation with DNS MX lookup
  // Password strength validation (8+ chars, upper, lower, number, special)
  // Username uniqueness check
  // Password hashing with bcryptjs
  // User creation and session establishment
};
```

**Security Features**:
- Strong password policy enforcement
- Email domain validation with DNS MX lookup
- Phone number validation using libphonenumber-js
- Username uniqueness validation
- Password hashing with bcryptjs (salt rounds: 10)

##### User Login
```javascript
exports.loginUser = async (req, res) => {
  // Account lockout protection (5 attempts, 15 min lockout)
  // Multi-identifier login (email/phone/username)
  // Password verification
  // Session creation
  // Failed attempt tracking
};
```

**Security Features**:
- Account lockout after 5 failed attempts
- 15-minute lockout period
- Failed login attempt tracking
- Password expiry warnings (90+ days)

##### Google OAuth Integration
```javascript
exports.googleLogin = async (req, res) => {
  // OIDC client initialization
  // State and nonce generation for CSRF protection
  // Authorization URL generation
  // Redirect to Google consent screen
};

exports.googleCallback = async (req, res) => {
  // State parameter verification (CSRF protection)
  // Authorization code exchange for tokens
  // ID token verification using JWKS
  // User creation/update
  // Session establishment
};
```

#### 5. Friend Controller (`controllers/friendController.js`)

**Purpose**: Handles friend management operations.

**Key Functions**:

##### Global User Search
```javascript
exports.searchGlobal = async (req, res) => {
  // Username-based search with regex
  // Friendship status determination
  // Request status checking
  // Result filtering and formatting
};
```

##### Friend Request Management
```javascript
exports.sendFriendRequest = async (req, res) => {
  // Validation (no self-requests, no duplicate requests)
  // Request creation and storage
  // Status tracking
};

exports.acceptFriendRequest = async (req, res) => {
  // Request validation and status update
  // Bidirectional friendship establishment
  // Database updates for both users
};
```

#### 6. Socket.IO Implementation (`socketio.js`)

**Purpose**: Real-time communication and user presence management.

**Key Features**:

##### Connection Management
```javascript
socket.on('register', async (profileId) => {
  // User registration with Socket.IO
  // Online status update
  // Friend notification system
  // Undelivered message delivery
});
```

##### Message Handling
```javascript
socket.on('sendMessage', async ({ senderId, receiverId, content }) => {
  // Friendship validation
  // Message creation and storage
  // Real-time delivery to online users
  // Status tracking (sent/delivered/read)
  // Offline message queuing
});
```

##### Presence Management
```javascript
// Periodic cleanup of stale online status
setInterval(async () => {
  // Check for users marked online but not connected
  // Update offline status for inactive users
  // Notify friends of status changes
}, 15000);
```

**Real-time Features**:
- User online/offline status tracking
- Real-time message delivery
- Message status updates (sent/delivered/read)
- Friend presence notifications
- Automatic cleanup of stale connections

---

## Frontend Documentation

### Project Structure
```
sparrow-frontend/
├── public/
│   ├── index.html
│   └── manifest.json
├── src/
│   ├── components/
│   │   ├── Login.jsx                 # Login component
│   │   ├── Signup.jsx                # Registration component
│   │   ├── FriendsPage.jsx           # Main chat interface
│   │   ├── GlobalSearch.jsx          # User discovery
│   │   ├── UsernameSetup.jsx         # OAuth username setup
│   │   ├── FriendRequests.jsx        # Friend request management
│   │   ├── GoogleOAuthButton.jsx     # OAuth integration
│   │   ├── MessageStatus.jsx         # Message status indicators
│   │   ├── PasswordField.jsx         # Password input component
│   │   ├── CustomAlert.jsx           # Custom alert dialogs
│   │   ├── icons/                    # Custom icon components
│   │   └── styles/
│   │       └── modern-theme.css      # Application styling
│   ├── App.jsx                       # Main application component
│   └── index.js                      # Application entry point
```

### Core Frontend Components

#### 1. App Component (`App.jsx`)

**Purpose**: Main application router and authentication guard.

**Key Features**:
- React Router setup with protected routes
- Authentication state management
- Session validation and automatic logout
- Browser event handling (beforeunload, visibility change)

**Authentication Flow**:
```javascript
const PrivateRoute = ({ element: Component, ...rest }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  useEffect(() => {
    const checkAuth = async () => {
      const profileId = localStorage.getItem('profileId');
      if (profileId) {
        // Verify session with backend
        const response = await fetch('/api/user', {
          credentials: 'include'
        });
        if (response.ok) {
          setIsAuthenticated(true);
        } else {
          localStorage.clear();
          setIsAuthenticated(false);
        }
      }
    };
    checkAuth();
  }, []);
  
  return isAuthenticated ? Component : <Navigate to="/login" />;
};
```

#### 2. Login Component (`Login.jsx`)

**Purpose**: User authentication interface.

**Features**:
- Dual authentication options (Google OAuth + Email/Phone)
- Form validation and error handling
- Session-based authentication
- Automatic redirect for authenticated users

**Authentication Methods**:
```javascript
// Email/Phone/Username Login
const handleLogin = async (e) => {
  const { data } = await axios.post('/api/auth/login', 
    { identifier, password },
    { withCredentials: true }
  );
  
  if (data.success) {
    localStorage.setItem('profileId', data.user.profileId);
    // ... store user data
    navigate('/friends');
  }
};

// Google OAuth Login
const handleGoogleLogin = () => {
  window.location.href = `${backendUrl}/auth/google`;
};
```

#### 3. FriendsPage Component (`FriendsPage.jsx`)

**Purpose**: Main chat interface and friend management.

**Key Features**:
- Real-time Socket.IO integration
- Friend list management
- Chat interface with message history
- Message status tracking
- Online status indicators

**Socket.IO Integration**:
```javascript
useEffect(() => {
  const socket = io(process.env.REACT_APP_BACKEND_URL);
  
  // User registration
  socket.emit('register', profileId);
  
  // Message handling
  socket.on('receiveMessage', (message) => {
    setMessages(prev => ({
      ...prev,
      [message.senderId]: [...(prev[message.senderId] || []), message]
    }));
  });
  
  // Message status updates
  socket.on('messageStatusUpdate', (data) => {
    // Update message status in UI
  });
  
  // Friend presence updates
  socket.on('friendOnlineStatus', (data) => {
    setFriends(prevFriends =>
      prevFriends.map(f =>
        f.profileId === data.profileId
          ? { ...f, isOnline: data.isOnline }
          : f
      )
    );
  });
}, []);
```

**Message Handling**:
```javascript
const handleSendMessage = async (message) => {
  // Create temporary message for immediate UI update
  const tempMessage = {
    _id: `temp_${Date.now()}`,
    content: message,
    status: 'sending'
  };
  
  // Add to UI immediately
  setMessages(prev => ({
    ...prev,
    [currentFriend.profileId]: [...(prev[currentFriend.profileId] || []), tempMessage]
  }));
  
  // Send via Socket.IO
  socket.emit('sendMessage', {
    senderId: profileId,
    receiverId: currentFriend.profileId,
    content: message
  });
};
```

#### 4. GlobalSearch Component (`GlobalSearch.jsx`)

**Purpose**: User discovery and friend request management.

**Features**:
- Real-time user search with debouncing
- Friend request sending
- Request status tracking
- Friendship management

**Search Implementation**:
```javascript
useEffect(() => {
  if (searchQuery.trim().length >= 2) {
    const timeoutId = setTimeout(() => {
      searchUsers();
    }, 500); // Debounce search
    
    return () => clearTimeout(timeoutId);
  }
}, [searchQuery]);

const searchUsers = async () => {
  const response = await axios.get(
    `/api/search-global?username=${encodeURIComponent(searchQuery)}`,
    { withCredentials: true }
  );
  
  setSearchResults(response.data.users);
};
```

#### 5. UsernameSetup Component (`UsernameSetup.jsx`)

**Purpose**: Username configuration for Google OAuth users.

**Features**:
- Real-time username availability checking
- Username suggestion system
- Form validation
- Automatic redirection

---

## Authentication System

### Authentication Methods

#### 1. Traditional Authentication (Email/Phone/Username)

**Flow**:
1. User submits credentials (email/phone/username + password)
2. Server validates credentials and password strength
3. Password hashing with bcryptjs
4. Session creation with express-session
5. User data storage in MongoDB
6. Session cookie sent to client

**Security Features**:
- Strong password policy (8+ chars, upper, lower, number, special)
- Email domain validation with DNS MX lookup
- Phone number validation using libphonenumber-js
- Account lockout protection (5 attempts, 15 min lockout)
- Password expiry warnings (90+ days)

#### 2. Google OAuth (OpenID Connect)

**Flow**:
1. User clicks "Sign in with Google"
2. Redirect to `/auth/google` endpoint
3. Backend generates state and nonce for CSRF protection
4. Redirect to Google's authorization endpoint
5. User authenticates with Google
6. Google redirects to `/auth/google/callback` with authorization code
7. Backend exchanges code for tokens
8. ID token verification using Google's JWKS
9. User creation/update in database
10. Session establishment
11. Redirect to frontend

**Technical Implementation**:
```javascript
// OIDC Client Configuration
const googleClient = new googleIssuer.Client({
  client_id: process.env.GOOGLE_CLIENT_ID,
  client_secret: process.env.GOOGLE_CLIENT_SECRET,
  redirect_uris: [process.env.GOOGLE_REDIRECT_URI],
  response_types: ['code']
});

// Token Verification
const tokenSet = await client.callback(redirectUri, params, {
  state: req.session.oidcState,
  nonce: req.session.oidcNonce
});

const claims = tokenSet.claims();
```

**Security Features**:
- CSRF protection with state parameter
- Replay protection with nonce
- ID token signature verification
- Token expiration validation
- Secure redirect URI validation

### Session Management

**Session Configuration**:
```javascript
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  name: 'sparrow.sid',
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    domain: process.env.NODE_ENV === 'production' ? '.sparrowchat.in' : undefined
  }
}));
```

**Session Data Structure**:
```javascript
req.session.user = {
  profileId: user.profileId,
  username: user.username,
  email: user.email,
  phoneNumber: user.phoneNumber,
  fullName: user.fullName,
  profileImage: user.profileImage
};
```

---

## Real-time Messaging System

### Socket.IO Implementation

#### Server-Side (`socketio.js`)

**Connection Management**:
```javascript
const userSockets = new Map(); // profileId -> socketId mapping
const userLastPing = new Map(); // Last ping time tracking

io.on('connection', (socket) => {
  socket.on('register', async (profileId) => {
    // Register user with Socket.IO
    userSockets.set(profileId, socket.id);
    userLastPing.set(profileId, Date.now());
    
    // Update online status
    await User.findOneAndUpdate(
      { profileId },
      { isOnline: true, lastSeen: new Date() }
    );
    
    // Notify friends of online status
    // Deliver undelivered messages
  });
});
```

**Message Handling**:
```javascript
socket.on('sendMessage', async ({ senderId, receiverId, content }) => {
  // Validate friendship
  const sender = await User.findOne({ profileId: senderId });
  if (!sender.friends.includes(receiverId)) {
    socket.emit('error', { message: 'Cannot send message to non-friend' });
    return;
  }
  
  // Create message
  const message = await Message.create({
    senderId, receiverId, content,
    timestamp: new Date(), status: 'sent'
  });
  
  // Check if receiver is online
  const receiverSocketId = userSockets.get(receiverId);
  if (receiverSocketId) {
    // Deliver immediately
    await Message.findByIdAndUpdate(message._id, { 
      status: 'delivered', deliveredAt: new Date() 
    });
    io.to(receiverSocketId).emit('receiveMessage', message);
    
    // Notify sender of delivery
    socket.emit('messageStatusUpdate', {
      messageId: message._id,
      status: 'delivered'
    });
  } else {
    // Receiver offline - message will be delivered when they come online
    socket.emit('messageStatusUpdate', {
      messageId: message._id,
      status: 'sent'
    });
  }
});
```

**Presence Management**:
```javascript
// Periodic cleanup of stale connections
setInterval(async () => {
  const onlineUsers = await User.find({ isOnline: true });
  const currentTime = Date.now();
  const PING_TIMEOUT = 60000; // 60 seconds
  
  for (const user of onlineUsers) {
    const lastPing = userLastPing.get(user.profileId);
    const isSocketActive = userSockets.has(user.profileId);
    const isPingStale = lastPing && (currentTime - lastPing) > PING_TIMEOUT;
    
    if (!isSocketActive || isPingStale) {
      // Mark user as offline
      await User.findOneAndUpdate(
        { profileId: user.profileId },
        { isOnline: false, lastSeen: new Date() }
      );
      
      // Notify friends
      user.friends.forEach(friendId => {
        const friendSocketId = userSockets.get(friendId);
        if (friendSocketId) {
          io.to(friendSocketId).emit('friendOnlineStatus', {
            profileId: user.profileId,
            isOnline: false,
            lastSeen: new Date()
          });
        }
      });
    }
  }
}, 15000);
```

#### Client-Side Integration

**Socket Connection**:
```javascript
const socket = io(process.env.REACT_APP_BACKEND_URL);

useEffect(() => {
  // Register user
  const profileId = localStorage.getItem('profileId');
  if (profileId) {
    socket.emit('register', profileId);
  }
  
  // Set up heartbeat
  const heartbeatInterval = setInterval(() => {
    if (socket.connected) {
      socket.emit('ping', profileId);
    }
  }, 25000);
  
  return () => clearInterval(heartbeatInterval);
}, []);
```

**Message Handling**:
```javascript
useEffect(() => {
  socket.on('receiveMessage', (message) => {
    setMessages(prev => ({
      ...prev,
      [message.senderId]: [...(prev[message.senderId] || []), message]
    }));
    
    // Auto-mark as read if current chat
    if (currentFriend?.profileId === message.senderId) {
      markMessagesAsRead(message.senderId);
    }
  });
  
  socket.on('messageStatusUpdate', (data) => {
    setMessages(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(chatWithUserId => {
        updated[chatWithUserId] = updated[chatWithUserId].map(msg => {
          if (msg._id === data.messageId) {
            return { ...msg, status: data.status };
          }
          return msg;
        });
      });
      return updated;
    });
  });
}, []);
```

### Message Status System

**Status Flow**:
1. **Sent**: Message created and stored in database
2. **Delivered**: Message received by online user
3. **Read**: Message marked as read by recipient

**Implementation**:
```javascript
// Mark messages as read
const markMessagesAsRead = (friendId) => {
  socket.emit('markMessagesAsRead', {
    senderId: friendId,
    receiverId: currentUserId
  });
};

// Server-side read handling
socket.on('markMessagesAsRead', async ({ senderId, receiverId }) => {
  await Message.updateMany(
    { senderId, receiverId, status: { $ne: 'read' } },
    { status: 'read', readAt: new Date() }
  );
  
  // Notify sender
  const senderSocketId = userSockets.get(senderId);
  if (senderSocketId) {
    io.to(senderSocketId).emit('messagesRead', {
      receiverId, readAt: new Date()
    });
  }
});
```

---

## Friend Management System

### Friend Request Flow

#### 1. Sending Friend Requests

**Process**:
1. User searches for other users via GlobalSearch
2. System checks friendship status and request history
3. Friend request created and stored in target user's friendRequests array
4. Status returned to sender

**Implementation**:
```javascript
exports.sendFriendRequest = async (req, res) => {
  const { toUserId } = req.body;
  const fromUserId = req.user.profileId;
  
  // Validation checks
  if (fromUserId === toUserId) {
    return res.status(400).json({ message: 'Cannot send request to yourself' });
  }
  
  const currentUser = await User.findOne({ profileId: fromUserId });
  if (currentUser.friends.includes(toUserId)) {
    return res.status(400).json({ message: 'Already friends' });
  }
  
  // Check for existing pending request
  const targetUser = await User.findOne({ profileId: toUserId });
  const existingRequest = targetUser.friendRequests.find(
    request => request.fromUserId === fromUserId && request.status === 'pending'
  );
  
  if (existingRequest) {
    return res.status(400).json({ message: 'Request already sent' });
  }
  
  // Add friend request
  targetUser.friendRequests.push({
    fromUserId,
    status: 'pending',
    timestamp: new Date()
  });
  
  await targetUser.save();
};
```

#### 2. Managing Friend Requests

**Accepting Requests**:
```javascript
exports.acceptFriendRequest = async (req, res) => {
  const { fromUserId } = req.body;
  const currentUserId = req.user.profileId;
  
  // Find and validate request
  const currentUser = await User.findOne({ profileId: currentUserId });
  const friendRequest = currentUser.friendRequests.find(
    request => request.fromUserId === fromUserId && request.status === 'pending'
  );
  
  if (!friendRequest) {
    return res.status(400).json({ message: 'No pending request found' });
  }
  
  // Update request status
  friendRequest.status = 'accepted';
  
  // Add bidirectional friendship
  if (!currentUser.friends.includes(fromUserId)) {
    currentUser.friends.push(fromUserId);
  }
  
  const senderUser = await User.findOne({ profileId: fromUserId });
  if (!senderUser.friends.includes(currentUserId)) {
    senderUser.friends.push(currentUserId);
  }
  
  await currentUser.save();
  await senderUser.save();
};
```

#### 3. Friend Search and Discovery

**Global Search**:
```javascript
exports.searchGlobal = async (req, res) => {
  const { username } = req.query;
  const currentUserId = req.user.profileId;
  
  // Search users with partial username match
  const users = await User.find({
    username: { $regex: username.trim(), $options: 'i' },
    profileId: { $ne: currentUserId }
  }).select('username profileId profileImage isOnline fullName friendRequests');
  
  // Add friendship/request status
  const currentUser = await User.findOne({ profileId: currentUserId });
  const usersWithStatus = users.map(user => {
    let status = 'send_request';
    
    if (currentUser.friends.includes(user.profileId)) {
      status = 'already_friends';
    } else {
      const pendingRequest = user.friendRequests.find(
        request => request.fromUserId === currentUserId && request.status === 'pending'
      );
      if (pendingRequest) {
        status = 'request_sent';
      }
    }
    
    return { ...user.toObject(), status };
  });
  
  res.json({ success: true, users: usersWithStatus });
};
```

### Friend Management Features

#### 1. Friend List Management
- Real-time friend list updates
- Online status indicators
- Unread message counts
- Friend removal functionality

#### 2. Search and Discovery
- Global username search
- Friend filtering and search
- Request status tracking
- Friendship status indicators

#### 3. Request Management
- Send friend requests
- Accept/reject requests
- Request history tracking
- Automatic status updates

---

## Database Schema

### User Collection

```javascript
{
  _id: ObjectId,
  fullName: String,                    // User's full name
  email: String (unique, sparse),      // Email address (optional for OAuth)
  phoneNumber: String (unique, sparse), // Phone number (optional for OAuth)
  password: String,                    // Hashed password (required)
  profileId: String (unique),          // Unique user identifier
  username: String (unique),           // Username (required)
  friends: [String],                   // Array of friend profileIds
  friendRequests: [{                   // Incoming friend requests
    fromUserId: String,
    status: String,                    // 'pending', 'accepted', 'rejected'
    timestamp: Date
  }],
  isOnline: Boolean,                   // Current online status
  lastSeen: Date,                      // Last activity timestamp
  profileImage: String,                // Profile image URL
  accountCreationDate: Date,           // Account creation timestamp
  
  // Security fields
  loginAttempts: Number,               // Failed login attempts
  lockUntil: Date,                     // Account lockout expiration
  lastLoginAttempt: Date,              // Last login attempt timestamp
  passwordChangedAt: Date,             // Password last changed
  needsUsernameSetup: Boolean          // OAuth username setup flag
}
```

### Message Collection

```javascript
{
  _id: ObjectId,
  senderId: String,                    // Sender's profileId
  receiverId: String,                  // Receiver's profileId
  content: String,                     // Message content
  timestamp: Date,                     // Message creation time
  status: String,                      // 'sent', 'delivered', 'read'
  deliveredAt: Date,                   // Delivery timestamp
  readAt: Date                         // Read timestamp
}
```

### Indexes

**Recommended Indexes**:
```javascript
// User collection
db.users.createIndex({ "profileId": 1 }, { unique: true })
db.users.createIndex({ "username": 1 }, { unique: true })
db.users.createIndex({ "email": 1 }, { unique: true, sparse: true })
db.users.createIndex({ "phoneNumber": 1 }, { unique: true, sparse: true })
db.users.createIndex({ "friends": 1 })
db.users.createIndex({ "isOnline": 1 })

// Message collection
db.messages.createIndex({ "senderId": 1, "receiverId": 1 })
db.messages.createIndex({ "timestamp": 1 })
db.messages.createIndex({ "status": 1 })
db.messages.createIndex({ "receiverId": 1, "status": 1 })
```

---

## API Endpoints

### Authentication Endpoints

#### POST `/api/auth/register`
**Purpose**: User registration with email/phone/username

**Request Body**:
```json
{
  "identifier": "user@example.com", // or phone number
  "password": "SecurePass123!",
  "username": "johndoe",
  "fullName": "John Doe"
}
```

**Response**:
```json
{
  "success": true,
  "user": {
    "profileId": "user-1234567890",
    "username": "johndoe",
    "email": "user@example.com",
    "fullName": "John Doe"
  },
  "message": "Registration successful"
}
```

#### POST `/api/auth/login`
**Purpose**: User authentication

**Request Body**:
```json
{
  "identifier": "user@example.com", // or phone/username
  "password": "SecurePass123!"
}
```

**Response**:
```json
{
  "success": true,
  "user": {
    "profileId": "user-1234567890",
    "username": "johndoe",
    "email": "user@example.com"
  },
  "message": "Login successful"
}
```

#### GET `/auth/google`
**Purpose**: Initiate Google OAuth flow

**Response**: Redirect to Google's authorization endpoint

#### GET `/auth/google/callback`
**Purpose**: Handle Google OAuth callback

**Response**: Redirect to frontend with session established

#### POST `/api/auth/logout`
**Purpose**: User logout

**Response**:
```json
{
  "success": true,
  "message": "Logout successful"
}
```

### User Management Endpoints

#### GET `/api/user`
**Purpose**: Get current user information

**Headers**: Session cookie required

**Response**:
```json
{
  "success": true,
  "user": {
    "profileId": "user-1234567890",
    "username": "johndoe",
    "email": "user@example.com",
    "fullName": "John Doe",
    "profileImage": "https://example.com/avatar.jpg"
  }
}
```

### Friend Management Endpoints

#### GET `/api/search-global?username=johndoe`
**Purpose**: Search for users globally

**Response**:
```json
{
  "success": true,
  "users": [
    {
      "profileId": "user-9876543210",
      "username": "johndoe123",
      "profileImage": "",
      "status": "send_request" // or "already_friends", "request_sent"
    }
  ]
}
```

#### POST `/api/send-request`
**Purpose**: Send friend request

**Request Body**:
```json
{
  "toUserId": "user-9876543210"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Friend request sent successfully"
}
```

#### GET `/api/friend-requests`
**Purpose**: Get pending friend requests

**Response**:
```json
{
  "success": true,
  "friendRequests": [
    {
      "requestId": "req-123",
      "fromUserId": "user-9876543210",
      "username": "johndoe123",
      "fullName": "John Doe",
      "profileImage": "",
      "timestamp": "2024-01-01T12:00:00Z"
    }
  ]
}
```

#### POST `/api/accept-request`
**Purpose**: Accept friend request

**Request Body**:
```json
{
  "fromUserId": "user-9876543210"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Friend request accepted successfully"
}
```

#### GET `/api/friends`
**Purpose**: Get friends list

**Response**:
```json
{
  "success": true,
  "friends": [
    {
      "profileId": "user-9876543210",
      "username": "johndoe123",
      "fullName": "John Doe",
      "profileImage": "",
      "isOnline": true
    }
  ]
}
```

#### POST `/api/remove-friend`
**Purpose**: Remove friend

**Request Body**:
```json
{
  "friendId": "user-9876543210"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Friend removed successfully"
}
```

### Message Endpoints

#### GET `/api/messages/:friendId`
**Purpose**: Get message history with a friend

**Response**:
```json
{
  "messages": [
    {
      "_id": "msg-123",
      "senderId": "user-1234567890",
      "receiverId": "user-9876543210",
      "content": "Hello!",
      "timestamp": "2024-01-01T12:00:00Z",
      "status": "read"
    }
  ]
}
```

#### POST `/api/messages/send`
**Purpose**: Send message (REST fallback)

**Request Body**:
```json
{
  "receiverId": "user-9876543210",
  "content": "Hello!"
}
```

**Response**:
```json
{
  "message": {
    "_id": "msg-123",
    "senderId": "user-1234567890",
    "receiverId": "user-9876543210",
    "content": "Hello!",
    "timestamp": "12:00 PM",
    "status": "delivered"
  }
}
```

### Socket.IO Events

#### Client to Server Events

```javascript
// User registration
socket.emit('register', profileId);

// Send message
socket.emit('sendMessage', {
  senderId: 'user-1234567890',
  receiverId: 'user-9876543210',
  content: 'Hello!'
});

// Mark messages as read
socket.emit('markMessagesAsRead', {
  senderId: 'user-9876543210',
  receiverId: 'user-1234567890'
});

// Heartbeat
socket.emit('ping', profileId);

// Logout
socket.emit('logout', { profileId });
```

#### Server to Client Events

```javascript
// Receive message
socket.on('receiveMessage', (message) => {
  // message: { _id, senderId, receiverId, content, timestamp, status }
});

// Message status update
socket.on('messageStatusUpdate', (data) => {
  // data: { messageId, status, deliveredAt?, readAt? }
});

// Messages read notification
socket.on('messagesRead', (data) => {
  // data: { receiverId, readAt }
});

// Friend online status
socket.on('friendOnlineStatus', (data) => {
  // data: { profileId, isOnline, lastSeen }
});

// Heartbeat response
socket.on('pong', () => {
  // Heartbeat acknowledgment
});
```

---

## Security Features

### Authentication Security

#### 1. Password Security
- **Hashing**: bcryptjs with 10 salt rounds
- **Policy**: Minimum 8 characters, uppercase, lowercase, number, special character
- **Expiry**: Warning for passwords older than 90 days

#### 2. Account Protection
- **Lockout**: 5 failed attempts trigger 15-minute lockout
- **Tracking**: Failed login attempt tracking and timestamps
- **Session**: Secure session management with HTTP-only cookies

#### 3. OAuth Security
- **CSRF Protection**: State parameter validation
- **Replay Protection**: Nonce validation
- **Token Verification**: ID token signature verification using JWKS
- **Secure Redirects**: Validated redirect URIs

### Data Validation

#### 1. Input Validation
- **Email**: Format validation + DNS MX record verification
- **Phone**: International format validation using libphonenumber-js
- **Username**: Uniqueness validation with suggestions
- **Content**: Message content sanitization

#### 2. Authorization
- **Friendship Validation**: Messages only between friends
- **Request Validation**: No self-requests, no duplicate requests
- **Session Validation**: Protected routes require valid session

### Network Security

#### 1. CORS Configuration
```javascript
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'https://www.sparrowchat.in',
  'https://sparrowchat.in'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
```

#### 2. Rate Limiting
```javascript
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 requests per window
  standardHeaders: true,
  legacyHeaders: false
});

const logoutLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // 10 logout requests per minute
});
```

#### 3. Session Security
```javascript
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  name: 'sparrow.sid',
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    domain: process.env.NODE_ENV === 'production' ? '.sparrowchat.in' : undefined
  }
}));
```

---


### SSL/TLS Configuration

#### 1. Domain Setup
- Frontend: `https://sparrowchat.in`
- Backend API: `https://api.sparrowchat.in`
- Google OAuth: `https://api.sparrowchat.in/auth/google/callback`

#### 2. Cookie Security
- Secure flag enabled in production
- SameSite: 'lax' for cross-subdomain support
- Domain: `.sparrowchat.in` for subdomain sharing

---

## Conclusion

The Sparrow Chat Application is a comprehensive real-time messaging platform that demonstrates modern web development practices including:

- **Dual Authentication**: Traditional and OAuth integration
- **Real-time Communication**: Socket.IO implementation with presence management
- **Security**: Comprehensive security measures and validation
- **Scalability**: Modular architecture with clear separation of concerns
- **User Experience**: Modern, responsive interface with real-time updates

The application is production-ready with proper deployment configurations, security measures, and scalable architecture suitable for real-world usage.

---

*This documentation covers all aspects of the Sparrow Chat Application. For additional technical details or implementation questions, refer to the source code comments and inline documentation.*
