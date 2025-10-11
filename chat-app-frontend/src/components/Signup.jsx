import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './styles/modern-theme.css';
import PasswordField from './PasswordField';
import GoogleOAuthButton from './GoogleOAuthButton';
import Logo from "../Logo.png";
import { useNavigate } from 'react-router-dom';

const Signup = () => {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [fullName, setFullName] = useState('');
  const [identifierType, setIdentifierType] = useState(''); // 'email' | 'phone' | ''
  const [identifierValid, setIdentifierValid] = useState(true);
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState('');

  useEffect(() => {
    // Check if user is already authenticated
    const token = localStorage.getItem('token');
    const profileId = localStorage.getItem('profileId');
    
    if (token || profileId) {
      // User is already logged in, redirect to friends page
      navigate('/friends');
      return;
    }
  }, [navigate]);

  const handleSignup = async (e) => {
    e.preventDefault();

    try {
      const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
      
      // Session-based authentication - send credentials
      const { data } = await axios.post(
        `${backendUrl}/api/auth/register`,
        {
          identifier,
          password,
          username,
          fullName,
        },
        { withCredentials: true } // Important: Send/receive cookies
      );

      if (data.success) {
        alert('Registration successful! Redirecting to chat...');
        
        // Store user info in localStorage
        localStorage.setItem('profileId', data.user.profileId);
        localStorage.setItem('username', data.user.username);
        localStorage.setItem('email', data.user.email || '');
        localStorage.setItem('fullName', data.user.fullName || '');
        localStorage.setItem('profileImage', data.user.profileImage || '');
        localStorage.setItem('token', 'session-authenticated'); // Flag for PrivateRoute

        console.log('✅ Registration successful, session created');

        // Redirect to friends page
        navigate('/friends');
      }
    } catch (error) {
      if (error.response) {
        alert(error.response.data.message);
      } else {
        alert('Something went wrong. Please try again later.');
      }
    }
  };

  const checkUsername = async (value) => {
    setUsername(value);
    if (!value) {
      setUsernameStatus('');
      return;
    }
    try {
      const res = await axios.get('http://localhost:5000/api/auth/check-username', { params: { username: value } });
      setUsernameStatus(res.data.available ? 'available' : (res.data.suggestions && res.data.suggestions.length ? res.data.suggestions.join(', ') : 'taken'));
    } catch (e) {
      setUsernameStatus('error');
    }
  };

  const detectIdentifier = (value) => {
    setIdentifier(value);
    if (!value) {
      setIdentifierType('');
      setIdentifierValid(true);
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailRegex.test(value.toLowerCase())) {
      setIdentifierType('email');
      setIdentifierValid(true);
    } else {
      // Rough phone check: digits, +, spaces, hyphens allowed
      const phoneRegex = /^[+]?[- 0-9()]{6,}$/;
      setIdentifierType('phone');
      setIdentifierValid(phoneRegex.test(value));
    }
  };

  return (
    <div className="modern-app">
      <div className="signup-container">
        <div className="logo-container">
          <img src={Logo} alt="App Logo" className="app-logo" />
          <h1 className="app-title">Sparrow</h1>
        </div>
        <h2 className="greeting-text">Create your account</h2>
      
      {/* Google OAuth Sign-In */}
      <div className="oauth-section">
        <GoogleOAuthButton text="Sign up with Google" />
      </div>

      {/* Divider */}
      <div className="auth-divider">OR</div>

        {/* Email/Phone Registration Form */}
        <form onSubmit={handleSignup} className="signup-form">
          <input
            type="text"
            placeholder="Full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="signup-input"
          />
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => checkUsername(e.target.value)}
            className="signup-input"
          />
          {usernameStatus === 'available' && <div className="validation-message validation-success">Username is available</div>}
          {usernameStatus && usernameStatus !== 'available' && <div className="validation-message validation-error">Suggestions: {usernameStatus}</div>}
          <input
            type="text"
            placeholder="Email or Phone Number"
            value={identifier}
            onChange={(e) => detectIdentifier(e.target.value)}
            className="signup-input"
          />
          {identifier && (
            <div className={`validation-message ${identifierValid ? 'validation-success' : 'validation-error'}`}>
              {identifierType === 'email' ? 'Detected email' : identifierType === 'phone' ? 'Detected phone' : ''} {identifierValid ? '' : '(format looks invalid)'}
            </div>
          )}
          <PasswordField
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            inputClassName="signup-input"
            containerClassName="password-field"
          />
          <button 
            type="submit" 
            className="signup-btn"
          >
            Signup
          </button>
        </form>
        <div className="login-link">
          <a href="/login">Already have an account? Login</a>
        </div>
      </div>
    </div>
  );
};

export default Signup;
