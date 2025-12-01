# 🐦 Sparrow - Real-Time Chat Application

A modern, full-stack real-time chat application built with React, Node.js, MongoDB, and Socket.IO. Sparrow provides secure messaging with multiple authentication methods, friend management, and real-time communication features.

## ✨ Features

### 🔐 Authentication & Security
- **Multiple Login Methods**: Email/phone registration, Google OAuth (OpenID Connect)
- **Session Management**: Secure session-based authentication with MongoDB storage
- **JWT Tokens**: For API authentication and user verification
- **Password Security**: Bcrypt hashing for password protection
- **CORS Protection**: Configured for secure cross-origin requests

### 💬 Real-Time Messaging
- **Socket.IO Integration**: Real-time bidirectional communication
- **Message Status**: Read receipts and delivery confirmations
- **Notification System**: Browser notifications for new messages
- **Audio Alerts**: Custom notification sounds for new messages

### 👥 Social Features
- **Friend Management**: Send/receive friend requests
- **Global User Search**: Find and connect with other users
- **User Profiles**: Customizable usernames and profile information
- **Online Status**: Real-time user presence indicators

### 🎨 Modern UI/UX
- **Responsive Design**: Works on desktop and mobile devices
- **Modern Theme**: Clean, contemporary interface
- **Country Code Selector**: International phone number support
- **Custom Components**: Reusable UI components with consistent styling

## 🏗️ Architecture

### Backend (`sparrow-backend/`)
- **Framework**: Express.js with Node.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: Express-session with MongoDB store
- **Real-time**: Socket.IO for WebSocket connections
- **Security**: CORS, rate limiting, secure cookies

### Frontend (`sparrow-frontend/`)
- **Framework**: React 19 with React Router
- **State Management**: React Context API
- **Styling**: Bootstrap 5 + Custom CSS
- **Real-time**: Socket.IO client integration
- **Notifications**: Browser Notification API

## 🚀 Quick Start

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (local or cloud instance)
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd sparrow
   ```

2. **Backend Setup**
   ```bash
   cd sparrow-backend
   npm install
   ```

3. **Frontend Setup**
   ```bash
   cd ../sparrow-frontend
   npm install
   ```

4. **Environment Configuration**
   
   Create `.env` files in both directories:

   **Backend (sparrow-backend/.env)**:
   ```env
   MONGO_URI=mongodb://localhost:27017/sparrow
   SESSION_SECRET=your-super-secret-session-key
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   NODE_ENV=development
   ```

   **Frontend (sparrow-frontend/.env)**:
   ```env
   REACT_APP_BACKEND_URL=http://localhost:5000
   ```

### Running the Application

1. **Start MongoDB** (if running locally)
   ```bash
   mongod
   ```

2. **Start the Backend**
   ```bash
   cd sparrow-backend
   npm run dev
   ```
   Backend will run on `http://localhost:5000`

3. **Start the Frontend**
   ```bash
   cd sparrow-frontend
   npm start
   ```
   Frontend will run on `http://localhost:3000`

## 📁 Project Structure

```
sparrow/
├── sparrow-backend/           # Node.js backend
│   ├── controllers/          # Route controllers
│   ├── middleware/           # Authentication middleware
│   ├── models/              # MongoDB models
│   ├── routes/              # API routes
│   ├── utils/               # Utility functions
│   └── server.js            # Main server file
├── sparrow-frontend/         # React frontend
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── contexts/        # React contexts
│   │   └── utils/           # Frontend utilities
│   └── public/              # Static assets
└── README.md
```

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /auth/google` - Google OAuth login
- `GET /auth/logout` - OAuth logout

### User Management
- `GET /api/user` - Get current user profile
- `PUT /api/user` - Update user profile

### Friends
- `GET /api/friends` - Get friends list
- `POST /api/friends/request` - Send friend request
- `PUT /api/friends/accept` - Accept friend request
- `DELETE /api/friends/remove` - Remove friend

### Messages
- `GET /api/messages/:friendId` - Get messages with friend
- `POST /api/messages` - Send message

## 🌐 Deployment

### Backend Deployment (AWS Elastic Beanstalk)
1. Create deployment package:
   ```bash
   cd sparrow-backend
   zip -r sparrow-backend-deploy.zip . -x node_modules/\*
   ```

2. Deploy using AWS EB CLI or upload to AWS Console

### Frontend Deployment (Vercel)
1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on git push

### Environment Variables for Production

**Backend**:
- `MONGO_URI` - MongoDB connection string
- `SESSION_SECRET` - Secure session secret
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `NODE_ENV=production`

**Frontend**:
- `REACT_APP_BACKEND_URL` - Backend API URL

## 🛠️ Development

### Available Scripts

**Backend**:
- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon

**Frontend**:
- `npm start` - Start development server
- `npm run build` - Build for production
- `npm test` - Run tests

### Code Structure

- **Controllers**: Handle HTTP requests and responses
- **Models**: Define MongoDB schemas and validation
- **Middleware**: Authentication and request processing
- **Routes**: Define API endpoints and route handlers
- **Utils**: Helper functions for encryption, logging, etc.

## 🔒 Security Features

- **Session Security**: HttpOnly, Secure, SameSite cookies
- **CORS Configuration**: Restricted origins for production
- **Rate Limiting**: API rate limiting to prevent abuse
- **Input Validation**: Server-side validation for all inputs
- **Password Hashing**: Bcrypt for secure password storage
- **JWT Tokens**: Secure token-based authentication

## 📱 Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the ISC License.

## 🆘 Support

For support and questions:
- Create an issue in the GitHub repository
- Check the documentation in the `/docs` folder
- Review the API endpoints in the code

## 🚀 Live Demo

Visit the live application at: [https://sparrowchat.in](https://sparrowchat.in)

---

**Built with ❤️ using React, Node.js, MongoDB, and Socket.IO**
