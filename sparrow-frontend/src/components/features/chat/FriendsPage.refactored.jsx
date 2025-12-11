import React, { useState, useEffect, useMemo } from 'react';
import { Container, Row, Col, Form, Button, Badge, Spinner, Alert } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import UserSearchIcon from '../friends/icons/UserSearchIcon';
import FriendRequestIcon from '../friends/icons/FriendRequestIcon';
import LogoutIcon from '../../../assets/images/Logout.png';
import Logo from '../../../assets/images/Logo.png';
import FriendRequests from '../friends/FriendRequests';
import CustomAlert from '../../common/CustomAlert';
import NotificationBell from '../notifications/NotificationBell';
import ChatWindow from './ChatWindow';
import ChatInput from './ChatInput';
import { useFriends } from '../../../hooks/useFriends';
import { useChat } from '../../../hooks/useChat';
import { useAuthStore } from '../../../store/auth.store';
import { useChatStore } from '../../../store/chat.store';
import { useSocket } from '../../../contexts/SocketContext';
import { useToast } from '../../../contexts/ToastContext';

const FriendsPage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showFriendRequests, setShowFriendRequests] = useState(false);
  const [currentFriend, setCurrentFriend] = useState(null);
  const [showRemoveAlert, setShowRemoveAlert] = useState(false);
  const [friendToRemove, setFriendToRemove] = useState(null);
  const [showLogoutAlert, setShowLogoutAlert] = useState(false);
  const [showChatView, setShowChatView] = useState(false);
  const navigate = useNavigate();

  // Hooks
  const { 
    friends, 
    loading, 
    error, 
    friendRequestsCount,
    fetchFriends, 
    fetchFriendRequestsCount,
    removeFriend,
    updateFriend,
    moveFriendToTop,
    setError: setFriendsError
  } = useFriends();
  
  const { 
    sendMessage: sendChatMessage,
    markAsRead,
    setActiveConversation,
    getCurrentMessages,
    getUnreadCount
  } = useChat();
  
  const { logout } = useAuthStore();
  const { messages } = useChatStore();
  const { socket } = useSocket();
  const { showError, showSuccess } = useToast();

  // Load friends on mount
  useEffect(() => {
    fetchFriends();
    fetchFriendRequestsCount();
  }, [fetchFriends, fetchFriendRequestsCount]);

  // Handle responsive behavior
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setShowChatView(false);
      } else if (!currentFriend) {
        setShowChatView(false);
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, [currentFriend]);

  // Handle escape key to close chat
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && currentFriend) {
        handleBackToFriends();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [currentFriend]);

  // Set up socket listeners for friend status updates (not messages - those are in SocketHandlersSetup)
  useEffect(() => {
    if (!socket) return;

    const handleFriendOnlineStatus = (data) => {
      updateFriend(data.profileId, {
        isOnline: data.isOnline,
        lastSeen: data.lastSeen
      });
    };

    const handleFriendsStatusSnapshot = (data) => {
      data.friends.forEach(friend => {
        updateFriend(friend.profileId, {
          isOnline: friend.isOnline,
          lastSeen: friend.lastSeen
        });
      });
    };

    const handleFriendRequestReceived = () => {
      fetchFriendRequestsCount();
    };

    socket.on('friendOnlineStatus', handleFriendOnlineStatus);
    socket.on('friendsStatusSnapshot', handleFriendsStatusSnapshot);
    socket.on('friend_request_received', handleFriendRequestReceived);

    return () => {
      socket.off('friendOnlineStatus', handleFriendOnlineStatus);
      socket.off('friendsStatusSnapshot', handleFriendsStatusSnapshot);
      socket.off('friend_request_received', handleFriendRequestReceived);
    };
  }, [socket, updateFriend, fetchFriendRequestsCount]);

  // Auto-mark messages as read when chat is visible
  useEffect(() => {
    if (!currentFriend) return;

    const conversationId = currentFriend.profileId;
    setActiveConversation(conversationId);
    markAsRead(conversationId);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && currentFriend) {
        markAsRead(conversationId);
      }
    };

    const periodicMarkAsRead = setInterval(() => {
      if (document.visibilityState === 'visible' && currentFriend) {
        markAsRead(conversationId);
      }
    }, 2000);

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(periodicMarkAsRead);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentFriend, setActiveConversation, markAsRead]);

  // Filtered friends
  const filteredFriends = useMemo(() => {
    if (searchQuery.trim().length === 0) {
      return friends;
    }
    return friends.filter(friend =>
      friend.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (friend.fullName && friend.fullName.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [searchQuery, friends]);

  // Handle friend selection
  const handleSelectFriend = (friend) => {
    setCurrentFriend(friend);
    
    if (window.innerWidth < 768) {
      setShowChatView(true);
    }
    
    // Reset unread count (handled by chat store)
    const conversationId = friend.profileId;
    setActiveConversation(conversationId);
    markAsRead(conversationId);
  };

  // Handle send message
  const handleSendMessage = async (messageText) => {
    if (!currentFriend || !messageText.trim()) return;

    moveFriendToTop(currentFriend.profileId);
    
    const result = await sendChatMessage(currentFriend.profileId, messageText);
    
    if (!result.success) {
      showError(result.message || 'Failed to send message');
    }
  };

  // Handle remove friend
  const handleRemoveFriend = (friend) => {
    setFriendToRemove(friend);
    setShowRemoveAlert(true);
  };

  const confirmRemoveFriend = async () => {
    if (!friendToRemove) return;

    const result = await removeFriend(friendToRemove.profileId);

    if (result.success) {
      showSuccess('Friend removed successfully');
      
      if (currentFriend?.profileId === friendToRemove.profileId) {
        setCurrentFriend(null);
      }
    } else {
      showError(result.message || 'Failed to remove friend');
    }

    setShowRemoveAlert(false);
    setFriendToRemove(null);
  };

  const cancelRemoveFriend = () => {
    setShowRemoveAlert(false);
    setFriendToRemove(null);
  };

  // Handle logout
  const handleLogout = () => {
    setShowLogoutAlert(true);
  };

  const confirmLogout = async () => {
    try {
      await logout();
      showSuccess('Logged out successfully');
      navigate('/login');
    } catch (error) {
      showError('Logout failed');
      navigate('/login');
    } finally {
      setShowLogoutAlert(false);
    }
  };

  const cancelLogout = () => {
    setShowLogoutAlert(false);
  };

  // Handle request handled
  const handleRequestHandled = () => {
    fetchFriends();
    fetchFriendRequestsCount();
  };

  // Handle back to friends
  const handleBackToFriends = () => {
    if (window.innerWidth < 768) {
      setShowChatView(false);
    }
    setCurrentFriend(null);
  };

  // Get messages for current friend
  const currentMessages = currentFriend 
    ? (messages[currentFriend.profileId] || [])
    : [];

  return (
    <div className="modern-app">
      <Container fluid className="friends-page-container">
        {/* Header */}
        <Row className="header-row">
          <Col>
            <div className="modern-header d-flex justify-content-between align-items-center p-3">
              <div className="d-flex align-items-center">
                <img src={Logo} alt="Sparrow Logo" className="app-logo" style={{ width: '40px', height: '40px', marginRight: '12px' }} />
                <h4 className="modern-logo mb-0 me-3">Sparrow</h4>
                <Badge className="badge-modern">{friends.length} friends</Badge>
              </div>
              <div className="d-flex align-items-center">
                <Button 
                  className="btn-modern-secondary me-3 d-flex align-items-center"
                  onClick={() => navigate('/global-search')}
                >
                  <UserSearchIcon size={16} className="me-1" />
                  <span className="d-none-mobile">Find Friends</span>
                </Button>
                
                <div className="me-3">
                  <NotificationBell />
                </div>
                
                <div className="position-relative me-3">
                  <Button 
                    className="btn-modern-secondary d-flex align-items-center"
                    onClick={() => setShowFriendRequests(true)}
                  >
                    <FriendRequestIcon size={16} className="me-1" />
                    <span className="d-none-mobile">Requests</span>
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

        <Row className="content-row" style={{ height: 'calc(100vh - 80px)' }}>
          {/* Friends List */}
          <Col xs={12} md={4} className={`friends-list-container ${showChatView ? 'd-none d-md-block' : ''}`}>
            <div className="p-3 h-100 d-flex flex-column">
              <Form.Group className="mb-3 flex-shrink-0">
                <Form.Control
                  type="text"
                  placeholder="🔍 Search friends..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input"
                  style={{ fontSize: '16px' }}
                />
              </Form.Group>

              {error && (
                <Alert variant="danger" onClose={() => setFriendsError('')} dismissible className="flex-shrink-0">
                  {error}
                </Alert>
              )}

              {loading && (
                <div className="text-center py-4 flex-shrink-0">
                  <Spinner animation="border" />
                  <p className="mt-2">Loading friends...</p>
                </div>
              )}

              <div className="friends-list">
                {filteredFriends.length > 0 ? (
                  <div>
                    {filteredFriends.map((friend) => {
                      const unreadCount = getUnreadCount(friend.profileId);
                      return (
                        <div
                          key={friend.profileId}
                          onClick={() => handleSelectFriend(friend)}
                          className={`friend-item d-flex justify-content-between align-items-center ${
                            currentFriend?.profileId === friend.profileId ? 'active' : ''
                          }`}
                        >
                          <div className="d-flex align-items-center">
                            <div className="me-3">
                              {friend.profileImage ? (
                                <img
                                  src={friend.profileImage}
                                  alt={friend.username}
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
                                  {friend.username.charAt(0).toUpperCase()}
                                </div>
                              )}
                            </div>
                            <div>
                              <div className="friend-name">{friend.username}</div>
                              <div className="friend-status">
                                {friend.fullName || friend.username}
                                {friend.isOnline ? (
                                  <span className="status-online ms-1">
                                    <span className="online-indicator"></span>
                                    Online
                                  </span>
                                ) : (
                                  <span className="status-offline ms-1">
                                    Last seen: {friend.lastSeen ? new Date(friend.lastSeen).toLocaleString() : 'Unknown'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          {unreadCount > 0 && (
                            <Badge className="badge-modern" style={{ background: 'var(--error-color)' }}>
                              {unreadCount}
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="empty-state">
                    <div className="empty-state-icon">👥</div>
                    <div className="empty-state-title">
                      {searchQuery ? `No friends found matching "${searchQuery}"` : 'No friends yet'}
                    </div>
                    <div className="empty-state-description">
                      {searchQuery ? 'Try searching with a different term' : 'Start building your network by finding friends'}
                    </div>
                    <Button 
                      className="btn-modern-primary mt-3"
                      onClick={() => navigate('/global-search')}
                    >
                      <UserSearchIcon size={16} className="me-1" />
                      Find Friends
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </Col>

          {/* Chat Area */}
          <Col xs={12} md={8} className={`chat-container ${!showChatView ? 'd-none d-md-block' : ''}`}>
            {currentFriend ? (
              <div className="h-100 d-flex flex-column">
                <ChatWindow 
                  friend={currentFriend} 
                  messages={currentMessages}
                  onCloseChat={handleBackToFriends}
                  onRemoveFriend={handleRemoveFriend}
                  showBackButton={showChatView}
                />
                <ChatInput onSendMessage={handleSendMessage} />
              </div>
            ) : (
              <div className="d-flex align-items-center justify-content-center h-100">
                <div className="empty-state">
                  <div className="empty-state-icon">💬</div>
                  <div className="empty-state-title">Select a friend to start chatting</div>
                  <div className="empty-state-description">Choose a friend from the list to begin your conversation</div>
                </div>
              </div>
            )}
          </Col>
        </Row>

        {/* Friend Requests Modal */}
        <FriendRequests
          show={showFriendRequests}
          onHide={() => setShowFriendRequests(false)}
          onRequestHandled={handleRequestHandled}
        />

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

export default FriendsPage;

