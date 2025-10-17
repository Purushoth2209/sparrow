import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './styles/modern-theme.css';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Logo from "../Logo.png";
import PasswordField from './PasswordField';
import GoogleOAuthButton from './GoogleOAuthButton';
import { useSocket } from '../contexts/SocketContext';

const Login = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { socket, reRegisterSocket } = useSocket();

  useEffect(() => {
    // Check if user is already authenticated (session-based)
    const profileId = localStorage.getItem('profileId');
    
    if (profileId) {
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
  }, [searchParams, navigate]);

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
        // Store user info in localStorage (session-based auth)
        localStorage.setItem('profileId', data.user.profileId);
        localStorage.setItem('username', data.user.username);
        localStorage.setItem('email', data.user.email || '');
        localStorage.setItem('fullName', data.user.fullName || '');
        localStorage.setItem('profileImage', data.user.profileImage || '');
        console.log('✅ Session-based authentication successful');

        // Register with Socket.IO using the global socket context
        if (socket && socket.connected) {
          console.log('🔍 DEBUG: Login - Registering socket with profileId:', data.user.profileId);
          socket.emit('register', data.user.profileId);
          
          // Wait a moment for the registration to complete before navigating
          setTimeout(() => {
            console.log('🔥 SESSION AUTHENTICATION WORKING - ' + new Date().toISOString());
            navigate('/friends');
          }, 100);
        } else {
          console.log('🔍 DEBUG: Login - Socket not ready, navigating anyway (SocketContext will handle registration)');
          console.log('🔥 SESSION AUTHENTICATION WORKING - ' + new Date().toISOString());
          navigate('/friends');
        }
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
            style={{ fontSize: '16px' }} // Prevents zoom on iOS
            autoComplete="username"
          />
          <PasswordField
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            inputClassName="login-input"
            containerClassName="password-field"
            inputStyle={{ fontSize: '16px' }} // Prevents zoom on iOS
          />
          <button 
            type="submit" 
            className="login-btn"
            style={{ minHeight: '48px' }}
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
