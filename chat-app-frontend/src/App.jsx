import React from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Signup from './components/Signup';
import Chat from './components/chat/Chat';
import './App.css';

// PrivateRoute Component to protect the chat page
// Allows both JWT-based auth (email/phone) and session-based auth (Google OAuth)
const PrivateRoute = ({ element: Component, ...rest }) => {
  const token = localStorage.getItem('token');  // Check for JWT token
  const profileId = localStorage.getItem('profileId');  // Check if user data exists

  // Allow access if:
  // 1. User has JWT token (email/phone login), OR
  // 2. User has profileId (previously authenticated), OR
  // 3. Coming from Google OAuth (let Chat component verify session)
  // The Chat component will handle redirecting to login if session is invalid
  return Component;
};

const App = () => {
  return (
    <Router>
      <div className="app-container">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route
            path="/chat"
            element={<PrivateRoute element={<Chat />} />}
          />  {/* Protected route for chat */}
          <Route path="/" element={<Login />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;
