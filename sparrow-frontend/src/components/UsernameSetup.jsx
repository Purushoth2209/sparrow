import React, { useState, useEffect } from 'react';
import { Container, Form, Button, Spinner } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Logo from '../Logo.png';
import './styles/modern-theme.css';

const UsernameSetup = () => {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [userInfo, setUserInfo] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is authenticated
    const checkAuth = async () => {
      try {
        const response = await axios.get(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000'}/api/user`, {
          withCredentials: true
        });
        
        if (response.data.success && response.data.user) {
          setUserInfo(response.data.user);
          
          // Check if user already has a proper username (not temporary)
          if (response.data.user.username && !response.data.user.username.startsWith('temp_')) {
            // User already has a username, redirect to friends page
            navigate('/friends');
          }
        } else {
          // Not authenticated, redirect to login
          navigate('/login');
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        navigate('/login');
      }
    };

    checkAuth();
  }, [navigate]);

  const handleUsernameChange = async (e) => {
    const value = e.target.value;
    setUsername(value);
    setError('');
    setSuccess('');

    // Check username availability if it's long enough
    if (value.length >= 3) {
      try {
        const response = await axios.get(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000'}/api/auth/check-username?username=${encodeURIComponent(value)}`, {
          withCredentials: true
        });
        
        if (response.data.available) {
          setSuccess('Username is available!');
          setSuggestions([]);
        } else {
          setError('Username is already taken');
          setSuggestions(response.data.suggestions || []);
        }
      } catch (error) {
        console.error('Username check failed:', error);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (username.length < 3) {
      setError('Username must be at least 3 characters long');
      return;
    }

    if (error) {
      return; // Don't submit if there's an error
    }

    setLoading(true);
    setError('');

    try {
      const response = await axios.post(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000'}/api/auth/set-username`, {
        username: username.trim()
      }, {
        withCredentials: true
      });

      if (response.data.success) {
        // Username set successfully, redirect to friends page
        navigate('/friends');
      } else {
        setError(response.data.message || 'Failed to set username');
        setSuggestions(response.data.suggestions || []);
      }
    } catch (error) {
      console.error('Set username error:', error);
      if (error.response?.data?.message) {
        setError(error.response.data.message);
        setSuggestions(error.response.data.suggestions || []);
      } else {
        setError('Failed to set username. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestionClick = (suggestedUsername) => {
    setUsername(suggestedUsername);
    setError('');
    setSuccess('Username is available!');
    setSuggestions([]);
  };

  if (!userInfo) {
    return (
      <div className="modern-app">
        <Container className="d-flex align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
          <div className="text-center">
            <Spinner animation="border" />
            <p className="mt-2">Loading...</p>
          </div>
        </Container>
      </div>
    );
  }

  return (
    <div className="modern-app">
      <Container className="username-setup-container">
        <div className="setup-form-wrapper">
          {/* Header */}
          <div className="text-center mb-4">
            <img src={Logo} alt="Sparrow Logo" className="app-logo" style={{ width: '60px', height: '60px', marginBottom: '20px' }} />
            <h2 className="modern-logo">Welcome to Sparrow!</h2>
            <p className="text-muted">Choose your username to get started</p>
          </div>

          {/* User Info */}
          <div className="user-info-card mb-4">
            <div className="d-flex align-items-center">
              {userInfo.profileImage ? (
                <img
                  src={userInfo.profileImage}
                  alt="Profile"
                  className="profile-image me-3"
                  style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover' }}
                />
              ) : (
                <div
                  className="profile-image me-3 d-flex align-items-center justify-content-center"
                  style={{ 
                    width: '50px', 
                    height: '50px', 
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-primary-light) 100%)',
                    color: 'white',
                    fontSize: '20px',
                    fontWeight: '600'
                  }}
                >
                  {userInfo.fullName ? userInfo.fullName.charAt(0).toUpperCase() : 'U'}
                </div>
              )}
              <div>
                <h5 className="mb-0">{userInfo.fullName || 'User'}</h5>
                <small className="text-muted">{userInfo.email}</small>
              </div>
            </div>
          </div>

          {/* Username Setup Form */}
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Choose your username</Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={handleUsernameChange}
                className="setup-input"
                disabled={loading}
                isInvalid={!!error}
                isValid={!!success}
              />
              {error && <Form.Control.Feedback type="invalid">{error}</Form.Control.Feedback>}
              {success && <Form.Control.Feedback type="valid">{success}</Form.Control.Feedback>}
              
              {/* Username Suggestions */}
              {suggestions.length > 0 && (
                <div className="mt-2">
                  <small className="text-muted">Suggested alternatives:</small>
                  <div className="suggestions-list">
                    {suggestions.map((suggestion, index) => (
                      <Button
                        key={index}
                        variant="outline-primary"
                        size="sm"
                        className="me-2 mb-1 suggestion-btn"
                        onClick={() => handleSuggestionClick(suggestion)}
                      >
                        {suggestion}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </Form.Group>

            <div className="d-grid">
              <Button
                type="submit"
                className="btn-modern-primary"
                disabled={loading || !!error || username.length < 3}
              >
                {loading ? (
                  <>
                    <Spinner size="sm" className="me-2" />
                    Setting up...
                  </>
                ) : (
                  'Complete Setup'
                )}
              </Button>
            </div>
          </Form>

          {/* Help Text */}
          <div className="text-center mt-4">
            <small className="text-muted">
              Your username will be visible to other users. Choose wisely!
            </small>
          </div>
        </div>
      </Container>
    </div>
  );
};

export default UsernameSetup;
