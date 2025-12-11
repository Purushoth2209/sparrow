import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Logo from "../../../assets/images/Logo.png";
import PasswordField from '../../common/PasswordField';
import GoogleOAuthButton from '../../common/GoogleOAuthButton';
import { useAuthStore } from '../../../store/auth.store';
import { useToast } from '../../../contexts/ToastContext';

const Login = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, isAuthenticated } = useAuthStore();
  const { showError, showSuccess } = useToast();

  useEffect(() => {
    // Check if user is already authenticated
    if (isAuthenticated) {
      navigate('/friends');
      return;
    }

    // Check for authentication error from Google OAuth
    const error = searchParams.get('error');
    if (error === 'auth_failed') {
      showError('Google authentication failed. Please try again.');
      window.history.replaceState({}, document.title, '/login');
    }
  }, [searchParams, navigate, isAuthenticated, showError]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await login(identifier, password);

      if (result.success) {
        showSuccess('Login successful!');
        navigate('/friends');
      } else {
        showError(result.message || 'Login failed. Please try again.');
      }
    } catch (error) {
      showError('Login failed. Please try again.');
    } finally {
      setIsLoading(false);
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
            disabled={isLoading}
          >
            {isLoading ? 'Logging in...' : 'Login'}
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
