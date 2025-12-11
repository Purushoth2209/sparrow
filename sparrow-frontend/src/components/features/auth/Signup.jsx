import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PasswordField from '../../common/PasswordField';
import GoogleOAuthButton from '../../common/GoogleOAuthButton';
import Logo from "../../../assets/images/Logo.png";
import { authApi } from '../../../services/api/auth.api';
import { useAuthStore } from '../../../store/auth.store';
import { useToast } from '../../../contexts/ToastContext';

const Signup = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [emailValid, setEmailValid] = useState(true);
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { isAuthenticated } = useAuthStore();
  const { showError, showSuccess } = useToast();

  useEffect(() => {
    // Check if user is already authenticated
    if (isAuthenticated) {
      navigate('/friends');
      return;
    }
  }, [navigate, isAuthenticated]);

  const handleSignup = async (e) => {
    e.preventDefault();

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.toLowerCase())) {
      setEmailValid(false);
      showError('Please enter a valid email address');
      return;
    }
    setEmailValid(true);
    setIsLoading(true);

    try {
      const data = await authApi.register(email, password, username, fullName);

      if (data.success) {
        showSuccess('Registration successful! Redirecting...');
        
        // Store user info in localStorage (auth store will handle this on login)
        localStorage.setItem('profileId', data.user.profileId);
        localStorage.setItem('username', data.user.username);
        localStorage.setItem('email', data.user.email || '');
        localStorage.setItem('fullName', data.user.fullName || '');
        localStorage.setItem('profileImage', data.user.profileImage || '');

        // Redirect to friends page
        setTimeout(() => navigate('/friends'), 1000);
      }
    } catch (error) {
      if (error.response) {
        showError(error.response.data.message || 'Registration failed');
      } else {
        showError('Something went wrong. Please try again later.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const checkUsername = async (value) => {
    setUsername(value);
    if (!value) {
      setUsernameStatus('');
      return;
    }
    try {
      const res = await authApi.checkUsername(value);
      setUsernameStatus(res.available ? 'available' : (res.suggestions && res.suggestions.length ? res.suggestions.join(', ') : 'taken'));
    } catch (e) {
      setUsernameStatus('error');
    }
  };

  const handleEmailChange = (value) => {
    setEmail(value);
    if (!value) {
      setEmailValid(true);
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    setEmailValid(emailRegex.test(value.toLowerCase()));
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

        {/* Email Registration Form */}
        <form onSubmit={handleSignup} className="signup-form">
          <input
            type="text"
            placeholder="Full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="signup-input"
            style={{ fontSize: '16px' }} // Prevents zoom on iOS
            autoComplete="name"
            required
          />
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => checkUsername(e.target.value)}
            className="signup-input"
            style={{ fontSize: '16px' }} // Prevents zoom on iOS
            autoComplete="username"
            required
          />
          {usernameStatus === 'available' && <div className="validation-message validation-success">Username is available</div>}
          {usernameStatus && usernameStatus !== 'available' && <div className="validation-message validation-error">Suggestions: {usernameStatus}</div>}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => handleEmailChange(e.target.value)}
            className="signup-input"
            style={{ fontSize: '16px' }} // Prevents zoom on iOS
            autoComplete="email"
            required
          />
          {email && (
            <div className={`validation-message ${emailValid ? 'validation-success' : 'validation-error'}`}>
              {emailValid ? 'Valid email format' : 'Please enter a valid email address'}
            </div>
          )}
          <PasswordField
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            inputClassName="signup-input"
            containerClassName="password-field"
            inputStyle={{ fontSize: '16px' }} // Prevents zoom on iOS
          />
          <button 
            type="submit" 
            className="signup-btn"
            style={{ minHeight: '48px' }}
            disabled={isLoading}
          >
            {isLoading ? 'Signing up...' : 'Signup'}
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
