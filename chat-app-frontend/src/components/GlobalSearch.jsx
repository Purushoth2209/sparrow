import React, { useState, useEffect, useCallback } from 'react';
import { Container, Row, Col, Form, Button, ListGroup, Badge, Spinner, Alert } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import UserSearchIcon from './icons/UserSearchIcon';
import FriendRequestIcon from './icons/FriendRequestIcon';
import LogoutIcon from '../Logout.png';
import Logo from '../Logo.png';
import CustomAlert from './CustomAlert';
import './styles/modern-theme.css';

const GlobalSearch = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [requestStatus, setRequestStatus] = useState({});
  const [friendRequestsCount, setFriendRequestsCount] = useState(0);
  const [showRemoveAlert, setShowRemoveAlert] = useState(false);
  const [friendToRemove, setFriendToRemove] = useState(null);
  const [showLogoutAlert, setShowLogoutAlert] = useState(false);
  const navigate = useNavigate();

  const searchUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await axios.get(
        `http://localhost:5000/api/search-global?username=${encodeURIComponent(searchQuery)}`,
        { withCredentials: true }
      );
      
      if (response.data.success) {
        setSearchResults(response.data.users);
      } else {
        setError(response.data.message || 'Search failed');
      }
    } catch (error) {
      console.error('Error searching users:', error);
      if (error.response?.status === 401) {
        // User is not authenticated, redirect to login
        console.log('User not authenticated, redirecting to login');
        navigate('/login');
        return;
      }
      setError(error.response?.data?.message || 'Failed to search users');
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    if (searchQuery.trim().length >= 2) {
      const timeoutId = setTimeout(() => {
        searchUsers();
      }, 500); // Debounce search

      return () => clearTimeout(timeoutId);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, searchUsers]);

  useEffect(() => {
    fetchFriendRequestsCount();
  }, []);

  const fetchFriendRequestsCount = async () => {
    try {
      const response = await axios.get(
        'http://localhost:5000/api/friend-requests',
        { withCredentials: true }
      );
      
      if (response.data.success) {
        setFriendRequestsCount(response.data.friendRequests.length);
      }
    } catch (error) {
      console.error('Error fetching friend requests count:', error);
    }
  };

  const sendFriendRequest = async (targetUserId) => {
    try {
      setRequestStatus(prev => ({ ...prev, [targetUserId]: 'sending' }));
      
      const response = await axios.post(
        'http://localhost:5000/api/send-request',
        { toUserId: targetUserId },
        { withCredentials: true }
      );
      
      if (response.data.success) {
        setRequestStatus(prev => ({ ...prev, [targetUserId]: 'sent' }));
        // Update search results to reflect new status
        setSearchResults(prev => prev.map(user => 
          user.profileId === targetUserId 
            ? { ...user, status: 'request_sent' }
            : user
        ));
        fetchFriendRequestsCount();
      } else {
        setError(response.data.message || 'Failed to send friend request');
        setRequestStatus(prev => ({ ...prev, [targetUserId]: 'error' }));
      }
    } catch (error) {
      console.error('Error sending friend request:', error);
      setError(error.response?.data?.message || 'Failed to send friend request');
      setRequestStatus(prev => ({ ...prev, [targetUserId]: 'error' }));
    }
  };

  const handleRemoveFriend = (user) => {
    setFriendToRemove(user);
    setShowRemoveAlert(true);
  };

  const confirmRemoveFriend = async () => {
    if (!friendToRemove) return;

    try {
      const response = await axios.post(
        'http://localhost:5000/api/remove-friend',
        { friendId: friendToRemove.profileId },
        { withCredentials: true }
      );

      if (response.data.success) {
        // Remove friend from search results
        setSearchResults(prevResults => 
          prevResults.filter(user => user.profileId !== friendToRemove.profileId)
        );
        
        console.log(`✅ Friend ${friendToRemove.username} removed successfully`);
      } else {
        setError(response.data.message || 'Failed to remove friend');
      }
    } catch (error) {
      console.error('Error removing friend:', error);
      if (error.response?.status === 401) {
        navigate('/login');
        return;
      }
      setError(error.response?.data?.message || 'Failed to remove friend');
    } finally {
      setShowRemoveAlert(false);
      setFriendToRemove(null);
    }
  };

  const cancelRemoveFriend = () => {
    setShowRemoveAlert(false);
    setFriendToRemove(null);
  };

  const getActionButton = (user) => {
    const status = requestStatus[user.profileId];
    
    switch (user.status) {
      case 'already_friends':
        return (
          <div className="d-flex align-items-center gap-2">
            <Badge className="badge-modern">Friends</Badge>
            <Button
              variant="outline-primary"
              size="sm"
              onClick={() => handleRemoveFriend(user)}
              title="Remove friend"
              style={{ 
                padding: '4px 8px',
                fontSize: '12px',
                border: '1px solid var(--brand-primary)',
                color: 'var(--brand-primary)'
              }}
            >
              ✕
            </Button>
          </div>
        );
      case 'request_sent':
        return <Badge className="badge-modern" style={{ background: 'var(--warning-color)' }}>Request Sent</Badge>;
      default:
        if (status === 'sending') {
          return (
            <Button className="btn-modern-secondary" size="sm" disabled>
              <Spinner animation="border" size="sm" className="me-1" />
              Sending...
            </Button>
          );
        }
        if (status === 'error') {
          return (
            <Button 
              className="btn-modern-secondary" 
              size="sm"
              onClick={() => sendFriendRequest(user.profileId)}
            >
              Retry
            </Button>
          );
        }
        return (
          <Button 
            className="btn-modern-primary" 
            size="sm"
            onClick={() => sendFriendRequest(user.profileId)}
          >
            Send Request
          </Button>
        );
    }
  };

  const handleLogout = () => {
    setShowLogoutAlert(true);
  };

  const confirmLogout = async () => {
    try {
      await fetch('http://localhost:5000/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      localStorage.clear();
      navigate('/login');
    } catch (error) {
      console.error('Error during logout:', error);
      localStorage.clear();
      navigate('/login');
    } finally {
      setShowLogoutAlert(false);
    }
  };

  const cancelLogout = () => {
    setShowLogoutAlert(false);
  };


  return (
    <div className="modern-app">
      <Container fluid className="global-search-container">
        {/* Header */}
        <Row className="header-row">
          <Col>
            <div className="modern-header d-flex justify-content-between align-items-center p-3">
              <div className="d-flex align-items-center">
                <img src={Logo} alt="Sparrow Logo" className="app-logo" style={{ width: '40px', height: '40px', marginRight: '12px' }} />
                <h4 className="modern-logo mb-0 me-3">Sparrow</h4>
                <Badge className="badge-modern" style={{ background: 'var(--info-color)' }}>Find new friends</Badge>
              </div>
              <div className="d-flex align-items-center">
                <div className="position-relative me-3">
                  <Button 
                    className="btn-modern-secondary d-flex align-items-center"
                    onClick={() => navigate('/friends')}
                  >
                    <FriendRequestIcon size={16} className="me-1" />
                    Friends
                    {friendRequestsCount > 0 && (
                      <Badge 
                        className="badge-modern ms-1"
                        style={{ fontSize: '0.7rem', background: 'var(--error-color)' }}
                      >
                        {friendRequestsCount}
                      </Badge>
                    )}
                  </Button>
                </div>
                <Button
                  className="btn-modern-icon"
                  onClick={handleLogout}
                  title="Logout"
                >
                  <img
                    src={LogoutIcon}
                    alt="Logout"
                    style={{ width: '20px', height: '20px' }}
                  />
                </Button>
              </div>
            </div>
          </Col>
        </Row>

        {/* Search Section */}
        <Row className="search-row">
          <Col>
            <div className="p-4">
              <div className="modern-card p-4">
                <Form.Group className="mb-4">
                  <Form.Label className="h5" style={{ color: 'var(--text-primary)', fontWeight: '600' }}>
                    <UserSearchIcon size={20} className="me-2" />
                    Search All Users
                  </Form.Label>
                  <div className="simple-search-container">
                    <Form.Control
                      type="text"
                      placeholder="Enter username to search..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="simple-search-input"
                      size="lg"
                    />
                  </div>
                  <Form.Text style={{ color: 'var(--text-secondary)' }}>
                    Enter at least 2 characters to search for users
                  </Form.Text>
                </Form.Group>
              </div>

            {error && (
              <Alert variant="danger" onClose={() => setError('')} dismissible>
                {error}
              </Alert>
            )}

            {loading && (
              <div className="text-center py-4">
                <Spinner animation="border" />
                <p className="mt-2">Searching users...</p>
              </div>
            )}

              {searchResults.length > 0 && (
                <div className="mt-4">
                  <h6 className="mb-3" style={{ color: 'var(--text-primary)', fontWeight: '600' }}>
                    Search Results ({searchResults.length}):
                  </h6>
                  <div className="modern-card">
                    {searchResults.map((user) => (
                      <div
                        key={user.profileId}
                        className="friend-item d-flex justify-content-between align-items-center"
                      >
                        <div className="d-flex align-items-center">
                          <div className="me-3">
                            {user.profileImage ? (
                              <img
                                src={user.profileImage}
                                alt={user.username}
                                className="friend-avatar"
                                style={{ width: '48px', height: '48px', objectFit: 'cover' }}
                              />
                            ) : (
                              <div
                                className="friend-avatar d-flex align-items-center justify-content-center"
                                style={{ 
                                  width: '48px', 
                                  height: '48px', 
                                  fontSize: '18px',
                                  background: 'linear-gradient(135deg, var(--primary-color) 0%, var(--primary-light) 100%)',
                                  color: 'white',
                                  fontWeight: '600'
                                }}
                              >
                                {user.username.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="friend-name">{user.username}</div>
                            <div className="friend-status text-muted">
                              Username: {user.username}
                            </div>
                          </div>
                        </div>
                        <div>
                          {getActionButton(user)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
            )}

              {searchQuery.length >= 2 && !loading && searchResults.length === 0 && (
                <div className="empty-state">
                  <div className="empty-state-icon">🔍</div>
                  <div className="empty-state-title">No users found</div>
                  <div className="empty-state-description">No users match "{searchQuery}"</div>
                </div>
              )}

              {searchQuery.length === 0 && (
                <div className="empty-state">
                  <div className="empty-state-icon">🔍</div>
                  <div className="empty-state-title">Discover New Friends</div>
                  <div className="empty-state-description">Search for users by username to send friend requests</div>
                </div>
              )}
            </div>
          </Col>
        </Row>

        {/* Remove Friend Confirmation Alert */}
        <CustomAlert
          show={showRemoveAlert}
          title="Remove Friend"
          message={`Are you sure you want to remove ${friendToRemove?.username} from your friends? This action cannot be undone.`}
          confirmText="Remove"
          cancelText="Cancel"
          variant="primary"
          onConfirm={confirmRemoveFriend}
          onCancel={cancelRemoveFriend}
        />

        {/* Logout Confirmation Alert */}
        <CustomAlert
          show={showLogoutAlert}
          title="Logout"
          message="Are you sure you want to logout? You will be redirected to the login page."
          confirmText="Logout"
          cancelText="Cancel"
          variant="primary"
          onConfirm={confirmLogout}
          onCancel={cancelLogout}
        />
      </Container>
    </div>
  );
};

export default GlobalSearch;
