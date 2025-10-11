import React, { useState, useEffect, useCallback } from 'react';
import { Container, Row, Col, Form, Button, ListGroup, Badge, Spinner, Alert } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import io from 'socket.io-client';
import UserSearchIcon from './icons/UserSearchIcon';
import FriendRequestIcon from './icons/FriendRequestIcon';
import LogoutIcon from '../Logout.png';
import Logo from '../Logo.png';
import FriendRequests from './FriendRequests';
import MessageStatus from './MessageStatus';
import CustomAlert from './CustomAlert';
import './styles/modern-theme.css';

const socket = io('http://localhost:5000');

// Make socket available globally for App component
window.socketInstance = socket;

const FriendsPage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [friends, setFriends] = useState([]);
  const [filteredFriends, setFilteredFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [friendRequestsCount, setFriendRequestsCount] = useState(0);
  const [showFriendRequests, setShowFriendRequests] = useState(false);
  const [currentFriend, setCurrentFriend] = useState(null);
  const [messages, setMessages] = useState({});
  const [showRemoveAlert, setShowRemoveAlert] = useState(false);
  const [friendToRemove, setFriendToRemove] = useState(null);
  const [showLogoutAlert, setShowLogoutAlert] = useState(false);
  const navigate = useNavigate();

  const fetchFriends = useCallback(async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await axios.get(
        `http://localhost:5000/api/search-friends${searchQuery ? `?username=${encodeURIComponent(searchQuery)}` : ''}`,
        { withCredentials: true }
      );
      
      if (response.data.success) {
        const friendsData = response.data.friends;
        setFriends(friendsData);
        setFilteredFriends(friendsData);
      } else {
        setError(response.data.message || 'Failed to fetch friends');
      }
    } catch (error) {
      console.error('Error fetching friends:', error);
      if (error.response?.status === 401) {
        // User is not authenticated, redirect to login
        console.log('User not authenticated, redirecting to login');
        navigate('/login');
        return;
      }
      setError(error.response?.data?.message || 'Failed to fetch friends');
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  const fetchFriendRequestsCount = useCallback(async () => {
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
      if (error.response?.status === 401) {
        // User is not authenticated, redirect to login
        console.log('User not authenticated, redirecting to login');
        navigate('/login');
        return;
      }
    }
  }, []);

  useEffect(() => {
    fetchFriends();
    fetchFriendRequestsCount();
  }, [fetchFriends, fetchFriendRequestsCount]);

  // Handle escape key to close chat
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && currentFriend) {
        setCurrentFriend(null);
        console.log('🚪 Chat closed via Escape key');
      }
    };

    // Add event listener
    document.addEventListener('keydown', handleKeyDown);

    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentFriend]);

  useEffect(() => {
    // Filter friends based on search query
    if (searchQuery.trim().length === 0) {
      setFilteredFriends(friends);
    } else {
      const filtered = friends.filter(friend =>
        friend.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (friend.fullName && friend.fullName.toLowerCase().includes(searchQuery.toLowerCase()))
      );
      setFilteredFriends(filtered);
    }
  }, [searchQuery, friends]);

  useEffect(() => {
    // Socket.IO setup for real-time messaging
    const profileId = localStorage.getItem('profileId');
    if (profileId) {
      socket.emit('register', profileId);
    }

    // Set up heartbeat to maintain connection
    const heartbeatInterval = setInterval(() => {
      if (socket.connected) {
        const profileId = localStorage.getItem('profileId');
        socket.emit('ping', profileId);
      }
    }, 25000); // Send ping every 25 seconds

    // Handle connection status
    socket.on('connect', () => {
      console.log('🔗 Socket connected');
      if (profileId) {
        socket.emit('register', profileId);
      }
    });

    socket.on('disconnect', () => {
      console.log('🔌 Socket disconnected');
    });

    socket.on('pong', () => {
      console.log('🏓 Pong received');
    });

    socket.on('receiveMessage', (message) => {
      console.log('📨 Message received:', message);
      
      // Update messages state
      setMessages(prev => ({
        ...prev,
        [message.senderId]: [...(prev[message.senderId] || []), message]
      }));

      // Check if this is from the currently active chat
      const currentUserId = localStorage.getItem('profileId');
      const isFromCurrentChat = currentFriend && currentFriend.profileId === message.senderId;
      
      if (isFromCurrentChat) {
        // If message is from current chat, mark as read immediately
        console.log('📖 Auto-marking received message as read (current chat)');
        setTimeout(() => {
          markMessagesAsRead(message.senderId);
        }, 100); // Reduced delay for faster response
      } else {
        // Update unread count for friends
        setFriends(prevFriends =>
          prevFriends.map(friend => {
            if (friend.profileId === message.senderId) {
              return {
                ...friend,
                unreadMessages: (friend.unreadMessages || 0) + 1,
              };
            }
            return friend;
          })
        );
      }
    });

    socket.on('messageSent', (message) => {
      console.log('✅ Message sent confirmation:', message);
      
      // Replace any temporary messages with the real message
      setMessages(prev => {
        const updated = { ...prev };
        const chatMessages = updated[message.receiverId] || [];
        
        // Check if there's a temporary message to replace
        const tempMessageIndex = chatMessages.findIndex(msg => 
          msg._id && msg._id.startsWith('temp_') && msg.content === message.content
        );
        
        if (tempMessageIndex !== -1) {
          // Replace temporary message with real message
          chatMessages[tempMessageIndex] = message;
        } else {
          // Add new message if no temporary message found
          chatMessages.push(message);
        }
        
        updated[message.receiverId] = chatMessages;
        return updated;
      });
    });

    socket.on('messagesRead', (data) => {
      console.log('📖 Messages read by:', data.receiverId);
      
      // Update message status to read for messages sent to this receiver
      setMessages(prev => {
        const updated = { ...prev };
        
        // Find messages sent to the receiver (data.receiverId is the person who read the messages)
        Object.keys(updated).forEach(chatWithUserId => {
          if (chatWithUserId === data.receiverId) {
            // Update messages in this chat to 'read' status
            updated[chatWithUserId] = updated[chatWithUserId].map(msg => {
              if (msg.senderId === localStorage.getItem('profileId') && msg.status !== 'read') {
                return {
                  ...msg,
                  status: 'read',
                  readAt: data.readAt
                };
              }
              return msg;
            });
          }
        });
        
        return updated;
      });
    });

    socket.on('messageStatusUpdate', (data) => {
      console.log('📊 Message status update:', data);
      
      // Update specific message status
      setMessages(prev => {
        const updated = { ...prev };
        
        // Find and update the specific message by ID
        Object.keys(updated).forEach(chatWithUserId => {
          updated[chatWithUserId] = updated[chatWithUserId].map(msg => {
            if (msg._id === data.messageId) {
              return {
                ...msg,
                status: data.status,
                ...(data.deliveredAt && { deliveredAt: data.deliveredAt }),
                ...(data.readAt && { readAt: data.readAt }),
                ...(data.sentAt && { sentAt: data.sentAt })
              };
            }
            return msg;
          });
        });
        
        return updated;
      });
    });

    socket.on('friendOnlineStatus', (data) => {
      console.log('Friend online status:', data);
      setFriends(prevFriends =>
        prevFriends.map(f =>
          f.profileId === data.profileId
            ? { ...f, isOnline: data.isOnline, lastSeen: data.lastSeen }
            : f
        )
      );
    });

    return () => {
      clearInterval(heartbeatInterval);
      socket.off('receiveMessage');
      socket.off('messageSent');
      socket.off('messagesRead');
      socket.off('messageStatusUpdate');
      socket.off('friendOnlineStatus');
      socket.off('connect');
      socket.off('disconnect');
      socket.off('pong');
    };
  }, []);

  const markMessagesAsRead = (friendId) => {
    const currentUserId = localStorage.getItem('profileId');
    if (currentUserId && friendId) {
      console.log(`📖 Marking messages from ${friendId} as read`);
      socket.emit('markMessagesAsRead', {
        senderId: friendId,
        receiverId: currentUserId
      });
    }
  };

  // Auto-mark messages as read when chat is visible and user is active
  useEffect(() => {
    if (!currentFriend) return;

    // Mark as read immediately when friend is selected
    markMessagesAsRead(currentFriend.profileId);

    // Mark as read when page becomes visible (user switches back to tab)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && currentFriend) {
        markMessagesAsRead(currentFriend.profileId);
      }
    };

    // Mark as read when user scrolls to bottom of chat (messages are visible)
    const handleScroll = () => {
      const chatMessages = document.querySelector('.chat-messages');
      if (chatMessages) {
        const { scrollTop, scrollHeight, clientHeight } = chatMessages;
        // If user is at or near the bottom of the chat
        if (scrollTop + clientHeight >= scrollHeight - 100) {
          markMessagesAsRead(currentFriend.profileId);
        }
      }
    };

    // Periodic check to mark messages as read when chat is visible
    const periodicMarkAsRead = setInterval(() => {
      if (document.visibilityState === 'visible' && currentFriend) {
        markMessagesAsRead(currentFriend.profileId);
      }
    }, 2000); // Check every 2 seconds

    // Add event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    const chatMessagesElement = document.querySelector('.chat-messages');
    if (chatMessagesElement) {
      chatMessagesElement.addEventListener('scroll', handleScroll);
    }

    // Cleanup
    return () => {
      clearInterval(periodicMarkAsRead);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (chatMessagesElement) {
        chatMessagesElement.removeEventListener('scroll', handleScroll);
      }
    };
  }, [currentFriend]);

  const updateMessageStatus = (messageId, newStatus) => {
    console.log(`🔄 Manually updating message ${messageId} to status: ${newStatus}`);
    setMessages(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(chatWithUserId => {
        updated[chatWithUserId] = updated[chatWithUserId].map(msg => {
          if (msg._id === messageId) {
            return {
              ...msg,
              status: newStatus,
              ...(newStatus === 'read' && { readAt: new Date() }),
              ...(newStatus === 'delivered' && { deliveredAt: new Date() })
            };
          }
          return msg;
        });
      });
      return updated;
    });
  };

  const handleSelectFriend = (friend) => {
    setCurrentFriend(friend);
    
    // Reset unread messages count for the selected friend
    setFriends(prevFriends =>
      prevFriends.map(f =>
        f.profileId === friend.profileId
          ? { ...f, unreadMessages: 0 }
          : f
      )
    );

    // Mark messages as read when friend is selected
    markMessagesAsRead(friend.profileId);
  };

  const handleSendMessage = async (message) => {
    if (!currentFriend || !message.trim()) return;

    const profileId = localStorage.getItem('profileId');
    if (!profileId) {
      console.error('No profile ID found');
      return;
    }

    // Create temporary message for immediate UI update
    const tempMessage = {
      _id: `temp_${Date.now()}`,
      senderId: profileId,
      receiverId: currentFriend.profileId,
      content: message,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'sending'
    };

    // Add temporary message to UI immediately
    setMessages(prev => ({
      ...prev,
      [currentFriend.profileId]: [...(prev[currentFriend.profileId] || []), tempMessage]
    }));

    try {
      // Send via Socket.IO for real-time updates
      socket.emit('sendMessage', {
        senderId: profileId,
        receiverId: currentFriend.profileId,
        content: message
      });

      console.log('📤 Message sent via Socket.IO');
    } catch (error) {
      console.error('Error sending message via Socket.IO:', error);
      
      // Fallback to REST API if Socket.IO fails
      try {
        const response = await fetch('http://localhost:5000/api/messages/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            receiverId: currentFriend.profileId,
            content: message,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const newMessage = data.message;
          
          // Replace temporary message with real message
          setMessages(prev => ({
            ...prev,
            [currentFriend.profileId]: prev[currentFriend.profileId].map(msg => 
              msg._id === tempMessage._id ? newMessage : msg
            )
          }));
        }
      } catch (restError) {
        console.error('Error with REST API fallback:', restError);
        
        // Remove temporary message on complete failure
        setMessages(prev => ({
          ...prev,
          [currentFriend.profileId]: prev[currentFriend.profileId].filter(msg => 
            msg._id !== tempMessage._id
          )
        }));
      }
    }
  };

  const handleRemoveFriend = (friend) => {
    setFriendToRemove(friend);
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
        // Remove friend from local state
        setFriends(prevFriends => prevFriends.filter(f => f.profileId !== friendToRemove.profileId));
        setFilteredFriends(prevFriends => prevFriends.filter(f => f.profileId !== friendToRemove.profileId));
        
        // If the removed friend was currently selected, clear the selection
        if (currentFriend?.profileId === friendToRemove.profileId) {
          setCurrentFriend(null);
          setMessages({});
        }

        // Remove messages with this friend
        setMessages(prevMessages => {
          const newMessages = { ...prevMessages };
          delete newMessages[friendToRemove.profileId];
          return newMessages;
        });

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

  const handleLogout = () => {
    setShowLogoutAlert(true);
  };

  const confirmLogout = async () => {
    try {
      console.log('🚪 User logging out...');
      
      // Notify Socket.IO server about logout
      const profileId = localStorage.getItem('profileId');
      if (profileId) {
        console.log('📡 Notifying server about logout via Socket.IO');
        socket.emit('logout', { profileId });
        
        // Wait a moment for the server to process the logout
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Disconnect Socket.IO
      socket.disconnect();
      console.log('🔌 Socket.IO disconnected');
      
      // Call REST API logout
      await fetch('http://localhost:5000/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      
      // Clear local storage
      localStorage.clear();
      console.log('🧹 Local storage cleared');
      
      // Navigate to login
      navigate('/login');
    } catch (error) {
      console.error('Error during logout:', error);
      
      // Force disconnect and clear data even if API fails
      socket.disconnect();
      localStorage.clear();
      navigate('/login');
    } finally {
      setShowLogoutAlert(false);
    }
  };

  const cancelLogout = () => {
    setShowLogoutAlert(false);
  };

  const handleRequestHandled = () => {
    // Refresh friends list when a request is accepted
    fetchFriends();
    fetchFriendRequestsCount();
  };


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
                  Find Friends
                </Button>
                <div className="position-relative me-3">
                  <Button 
                    className="btn-modern-secondary d-flex align-items-center"
                    onClick={() => setShowFriendRequests(true)}
                  >
                    <FriendRequestIcon size={16} className="me-1" />
                    Requests
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
          <Col xs={4} className="friends-list-container">
            <div className="p-3 h-100 d-flex flex-column">
              <Form.Group className="mb-3">
                <Form.Control
                  type="text"
                  placeholder="🔍 Search friends..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input"
                />
              </Form.Group>

            {error && (
              <Alert variant="danger" onClose={() => setError('')} dismissible>
                {error}
              </Alert>
            )}

            {loading && (
              <div className="text-center py-4">
                <Spinner animation="border" />
                <p className="mt-2">Loading friends...</p>
              </div>
            )}

              <div className="flex-grow-1 overflow-auto">
                {filteredFriends.length > 0 ? (
                  <div className="friends-list">
                    {filteredFriends.map((friend) => (
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
                        {friend.unreadMessages > 0 && (
                          <Badge className="badge-modern" style={{ background: 'var(--error-color)' }}>
                            {friend.unreadMessages}
                          </Badge>
                        )}
                      </div>
                    ))}
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
          <Col xs={8} className="chat-container">
            {currentFriend ? (
              <ChatArea 
                friend={currentFriend} 
                messages={messages[currentFriend.profileId] || []}
                onSendMessage={handleSendMessage}
                onCloseChat={() => setCurrentFriend(null)}
                onRemoveFriend={handleRemoveFriend}
              />
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

// Chat Area Component
const ChatArea = ({ friend, messages, onSendMessage, onCloseChat, onRemoveFriend }) => {
  const [message, setMessage] = useState('');

  const handleSend = () => {
    if (message.trim()) {
      onSendMessage(message);
      setMessage('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  // Handle escape key to close chat
  React.useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && onCloseChat) {
        onCloseChat();
        console.log('🚪 Chat closed via Escape key from ChatArea');
      }
    };

    // Add event listener
    document.addEventListener('keydown', handleKeyDown);

    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onCloseChat]);

  return (
    <div className="chat-container h-100 d-flex flex-column">
      {/* Chat Header */}
      <div className="chat-header">
        <div className="d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center">
            <div className="me-3">
              {friend.profileImage ? (
                <img
                  src={friend.profileImage}
                  alt={friend.username}
                  className="friend-avatar"
                  style={{ width: '40px', height: '40px', objectFit: 'cover' }}
                />
              ) : (
                <div
                  className="friend-avatar d-flex align-items-center justify-content-center"
                  style={{ 
                    width: '40px', 
                    height: '40px', 
                    fontSize: '16px',
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
              <h5 className="mb-0 friend-name">{friend.username}</h5>
              <small className="friend-status">
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
              </small>
            </div>
          </div>
          <div className="d-flex align-items-center">
            <Button
              variant="outline-primary"
              size="sm"
              onClick={() => onRemoveFriend(friend)}
              title="Remove friend"
              className="me-2"
              style={{ 
                padding: '6px 12px',
                fontSize: '12px',
                border: '1px solid var(--brand-primary)',
                color: 'var(--brand-primary)'
              }}
            >
              Remove Friend
            </Button>
            <Button
              className="btn-modern-icon"
              onClick={onCloseChat}
              title="Close chat (Escape)"
            >
              ✕
            </Button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {messages.length > 0 ? (
          messages.map((msg, index) => (
            <div
              key={index}
              className={`d-flex ${msg.senderId === localStorage.getItem('profileId') ? 'justify-content-end' : 'justify-content-start'} mb-3`}
            >
              <div
                className={`message-bubble ${
                  msg.senderId === localStorage.getItem('profileId')
                    ? 'message-sent'
                    : 'message-received'
                }`}
              >
                <div className="message-content">{msg.content}</div>
                <div className="message-time">
                  <span>{msg.timestamp}</span>
                  {msg.senderId === localStorage.getItem('profileId') && (
                    <MessageStatus status={msg.status} timestamp={msg.timestamp} />
                  )}
                </div>
              </div>
            </div>
          ))
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">💭</div>
              <div className="empty-state-title">No messages yet</div>
              <div className="empty-state-description">Start the conversation!</div>
            </div>
          )}
        </div>

        {/* Message Input */}
        <div className="message-input-container">
          <div className="d-flex">
            <Form.Control
              type="text"
              placeholder="Type your message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              className="message-input me-2"
            />
            <Button className="btn-modern-primary" onClick={handleSend}>
              Send
            </Button>
          </div>
        </div>
      </div>
  );
};

export default FriendsPage;
