import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './styles/modern-theme.css';
import PasswordField from './PasswordField';
import GoogleOAuthButton from './GoogleOAuthButton';
import CountryCodeSelector from './CountryCodeSelector';
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
  
  // Phone number specific states
  const [countryCode, setCountryCode] = useState('+91'); // Default to India
  const [phoneNumber, setPhoneNumber] = useState('');
  const [showPhoneInput, setShowPhoneInput] = useState(false);

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
      const res = await axios.get(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000'}/api/auth/check-username`, { params: { username: value } });
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
      setShowPhoneInput(false);
      setPhoneNumber(''); // Clear phone number when input is empty
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailRegex.test(value.toLowerCase())) {
      setIdentifierType('email');
      setIdentifierValid(true);
      setShowPhoneInput(false);
    } else {
      // If it's not an email, show phone input
      setIdentifierType('phone');
      setShowPhoneInput(true);
      setIdentifierValid(true); // Will be validated when form is submitted
      
      // Extract phone number from the typed value
      // Remove country code if present (starts with +)
      let phoneNumber = value;
      let detectedCountryCode = '+91'; // Default to India
      
      if (value.startsWith('+')) {
        // Find the first space or extract everything after the country code
        const spaceIndex = value.indexOf(' ');
        if (spaceIndex > 0) {
          detectedCountryCode = value.substring(0, spaceIndex);
          phoneNumber = value.substring(spaceIndex + 1);
        } else {
          // If no space, try to extract after common country codes
          const commonCodes = ['+91', '+1', '+44', '+86', '+81', '+82', '+61', '+49', '+33', '+39', '+34', '+7', '+55', '+52', '+54', '+27', '+20', '+234', '+254', '+92', '+880', '+94', '+977', '+93', '+98', '+90', '+966', '+971', '+974', '+965', '+973', '+968', '+60', '+65', '+66', '+84', '+63', '+62', '+64'];
          for (const code of commonCodes) {
            if (value.startsWith(code)) {
              detectedCountryCode = code;
              phoneNumber = value.substring(code.length);
              break;
            }
          }
        }
      }
      
      // Clean the phone number (remove spaces, hyphens, parentheses)
      phoneNumber = phoneNumber.replace(/[\s\-\(\)]/g, '');
      setPhoneNumber(phoneNumber);
      setCountryCode(detectedCountryCode);
      
      // Focus the phone number input after a short delay to allow rendering
      setTimeout(() => {
        const phoneInput = document.querySelector('.phone-number-input');
        if (phoneInput) {
          phoneInput.focus();
        }
      }, 100);
    }
  };

  const handlePhoneNumberChange = (value) => {
    setPhoneNumber(value);
    // Update the main identifier with the full phone number
    if (value.trim()) {
      setIdentifier(`${countryCode}${value}`);
    } else {
      setIdentifier('');
    }
  };

  const handleCountryCodeChange = (code) => {
    setCountryCode(code);
    // Update the main identifier with the new country code
    if (phoneNumber.trim()) {
      setIdentifier(`${code}${phoneNumber}`);
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
            style={{ fontSize: '16px' }} // Prevents zoom on iOS
            autoComplete="name"
          />
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => checkUsername(e.target.value)}
            className="signup-input"
            style={{ fontSize: '16px' }} // Prevents zoom on iOS
            autoComplete="username"
          />
          {usernameStatus === 'available' && <div className="validation-message validation-success">Username is available</div>}
          {usernameStatus && usernameStatus !== 'available' && <div className="validation-message validation-error">Suggestions: {usernameStatus}</div>}
          {!showPhoneInput ? (
            <input
              type="text"
              placeholder="Email or Phone Number"
              value={identifier}
              onChange={(e) => detectIdentifier(e.target.value)}
              className="signup-input"
              style={{ fontSize: '16px' }} // Prevents zoom on iOS
              autoComplete="email"
            />
          ) : (
            <div className="phone-input-container">
              <div className="phone-input-row">
                <CountryCodeSelector
                  value={countryCode}
                  onChange={handleCountryCodeChange}
                  placeholder="Country"
                />
                <input
                  type="tel"
                  placeholder="Phone Number"
                  value={phoneNumber}
                  onChange={(e) => handlePhoneNumberChange(e.target.value)}
                  className="signup-input phone-number-input"
                  style={{ fontSize: '16px' }} // Prevents zoom on iOS
                  autoComplete="tel"
                />
              </div>
              <button
                type="button"
                className="switch-to-email-btn"
                onClick={() => {
                  setShowPhoneInput(false);
                  setIdentifier('');
                  setPhoneNumber('');
                  setCountryCode('+91'); // Reset to default
                }}
              >
                Use email instead
              </button>
            </div>
          )}
          {identifier && !showPhoneInput && (
            <div className={`validation-message ${identifierValid ? 'validation-success' : 'validation-error'}`}>
              {identifierType === 'email' ? 'Detected email' : identifierType === 'phone' ? 'Detected phone' : ''} {identifierValid ? '' : '(format looks invalid)'}
            </div>
          )}
          {showPhoneInput && (
            <div className="validation-message validation-info">
              Enter your phone number without the country code
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
