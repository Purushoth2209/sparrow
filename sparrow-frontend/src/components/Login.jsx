import React, { useState, useEffect } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import './styles/modern-theme.css';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Logo from "../Logo.png";
import PasswordField from './PasswordField';
import GoogleOAuthButton from './GoogleOAuthButton';

const Login = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [socket, setSocket] = useState(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // Check if user is already authenticated
    const token = localStorage.getItem('token');
    const profileId = localStorage.getItem('profileId');
    
    if (token || profileId) {
      // User is already logged in, redirect to friends page
      navigate('/friends');
      return;
    }

    // Check for authentication error from Google OAuth
    const error = searchParams.get('error');
    if (error === 'auth_failed') {
      alert('Google authentication failed. Please try again.');
      // Clean up URL
      window.history.replaceState({}, document.title, '/login');
    }

    const socketInstance = io(process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000');
    setSocket(socketInstance);

    return () => {
      if (socketInstance) socketInstance.disconnect();
    };
  }, [searchParams]);

  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
      
      // Session-based authentication - send credentials
      const { data } = await axios.post(
        `${backendUrl}/api/auth/login`,
        { identifier, password },
        { withCredentials: true } // Important: Send/receive cookies
      );

      if (data.success) {
        // Store user info in localStorage for convenience
        localStorage.setItem('profileId', data.user.profileId);
        localStorage.setItem('username', data.user.username);
        localStorage.setItem('email', data.user.email || '');
        localStorage.setItem('fullName', data.user.fullName || '');
        localStorage.setItem('profileImage', data.user.profileImage || '');
        localStorage.setItem('token', 'session-authenticated'); // Flag for PrivateRoute

        // Connect to Socket.IO
        if (socket) {
          socket.emit('setUser', data.user.profileId);
        }

        console.log('✅ Login successful, session created');

        // Navigate to chat
        navigate('/friends');
      }
    } catch (error) {
      console.error('Login failed:', error);
      alert('Login failed. Please try again.');
    }
  };

  return (
    <div className="modern-app">
      <div className="login-container">
        <div className="logo-container">
          <img src={Logo} alt="App Logo" className="app-logo" />
          <h1 className="app-title">Sparrow</h1>
        </div>
        <h2 className="greeting-text">Welcome Back! Please Login to Continue</h2>
      
      {/* Google OAuth Sign-In */}
      <div className="oauth-section">
        <GoogleOAuthButton text="Sign in with Google" />
      </div>

      {/* Divider */}
      <div className="auth-divider">OR</div>

        {/* Email/Phone/Username Login */}
        <form onSubmit={handleLogin} className="login-form">
          <input
            type="text"
            placeholder="Email, Phone, or Username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className="login-input"
          />
          <PasswordField
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            inputClassName="login-input"
            containerClassName="password-field"
          />
          <button 
            type="submit" 
            className="login-btn"
          >
            Login
          </button>
        </form>
        <div className="signup-link">
          <a href="/signup">Don't have an account? Sign up</a>
        </div>
      </div>
    </div>
  );
};

export default Login;
