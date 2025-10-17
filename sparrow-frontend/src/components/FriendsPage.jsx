import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Container, Row, Col, Form, Button, Badge, Spinner, Alert } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import UserSearchIcon from './icons/UserSearchIcon';
import FriendRequestIcon from './icons/FriendRequestIcon';
import LogoutIcon from '../Logout.png';
import Logo from '../Logo.png';
import FriendRequests from './FriendRequests';
import MessageStatus from './MessageStatus';
import CustomAlert from './CustomAlert';
import { useSocket } from '../contexts/SocketContext';
import './styles/modern-theme.css';

const FriendsPage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [friends, setFriends] = useState([]);
  // Store UI-only data for persistence across re-renders
  const [uiState, setUiState] = useState(() => {
    // Load from localStorage on initialization
    try {
      const saved = localStorage.getItem('sparrow_ui_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          unreadCounts: parsed.unreadCounts || {},
          lastMovedAt: parsed.lastMovedAt || {},
          readMessageIds: new Set(parsed.readMessageIds || []) // Track read messages
        };
      }
    } catch (error) {
      console.warn('Failed to load UI state from localStorage:', error);
    }
    return {
      unreadCounts: {},
      lastMovedAt: {},
      readMessageIds: new Set()
    };
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [friendRequestsCount, setFriendRequestsCount] = useState(0);
  const [showFriendRequests, setShowFriendRequests] = useState(false);
  const [currentFriend, setCurrentFriend] = useState(null);
  const [messages, setMessages] = useState({});
  const [showRemoveAlert, setShowRemoveAlert] = useState(false);
  const [friendToRemove, setFriendToRemove] = useState(null);
  const [showLogoutAlert, setShowLogoutAlert] = useState(false);
  const [showChatView, setShowChatView] = useState(false); // For mobile view switching
  const navigate = useNavigate();
  

  // Socket context
  const { socket, reRegisterSocket } = useSocket();


  const fetchFriends = useCallback(async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000'}/api/search-friends${searchQuery ? `?username=${encodeURIComponent(searchQuery)}` : ''}`,
        { 
          withCredentials: true
        }
      );
      
      if (response.data.success) {
        const friendsData = response.data.friends;
        
        // MERGE LOGIC: Preserve client-local state that is newer than fetched data
        setFriends(prevFriends => {
          const updatedFriends = friendsData.map(newFriend => {
            const existingFriend = prevFriends.find(f => f.profileId === newFriend.profileId);
            const clientUnreadCount = uiState.unreadCounts[newFriend.profileId] || 0;
            const clientLastMoved = uiState.lastMovedAt[newFriend.profileId] || 0;
            
            // Use client unread count if it's higher (newer messages received)
            const preservedUnreadCount = Math.max(
              existingFriend?.unreadMessages || 0,
              clientUnreadCount
            );
            
            // Preserve lastMovedAt from client if it's more recent
            const preservedLastMoved = clientLastMoved > (existingFriend?.lastMovedAt || 0) 
              ? clientLastMoved 
              : existingFriend?.lastMovedAt;
            
            // Use server data for online status and lastSeen (socket updates will override this)
            const preservedIsOnline = newFriend.isOnline;
            const preservedLastSeen = newFriend.lastSeen;
            
            return {
              ...newFriend,
              unreadMessages: preservedUnreadCount,
              lastMovedAt: preservedLastMoved,
              isOnline: preservedIsOnline,
              lastSeen: preservedLastSeen
            };
          });
          
          // Sort by lastMovedAt to maintain move-to-top order
          updatedFriends.sort((a, b) => {
            const aTime = a.lastMovedAt || 0;
            const bTime = b.lastMovedAt || 0;
            return bTime - aTime; // Most recent first
          });
          
          return updatedFriends;
        });
        
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
  }, [searchQuery, navigate]); // Remove uiState dependency to prevent unnecessary re-fetches

  const fetchFriendRequestsCount = useCallback(async () => {
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000'}/api/friend-requests`,
        { 
          withCredentials: true
        }
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
    
    // Re-register socket when component mounts (in case user just logged in)
    const profileId = localStorage.getItem('profileId');
    if (profileId && reRegisterSocket) {
      console.log('🔍 DEBUG: FriendsPage - Re-registering socket on mount');
      setTimeout(() => reRegisterSocket(), 100); // Small delay to ensure socket is ready
    }
  }, []); // Only run once on mount

  // Persist UI state to localStorage whenever it changes
  useEffect(() => {
    try {
      // Limit readMessageIds to last 1000 to prevent localStorage bloat
      const limitedReadIds = Array.from(uiState.readMessageIds).slice(-1000);
      
      const serializableState = {
        ...uiState,
        readMessageIds: limitedReadIds
      };
      localStorage.setItem('sparrow_ui_state', JSON.stringify(serializableState));
    } catch (error) {
      console.warn('Failed to save UI state to localStorage:', error);
    }
  }, [uiState]);

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

  // Refetch friends when search query changes
  useEffect(() => {
    if (searchQuery !== undefined) { // Only refetch if searchQuery has been set
      fetchFriends();
    }
  }, [searchQuery, fetchFriends]);

  // Memoize filtered friends to prevent unnecessary re-renders
  const filteredFriends = useMemo(() => {
    if (searchQuery.trim().length === 0) {
      return friends;
    } else {
      return friends.filter(friend =>
        friend.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (friend.fullName && friend.fullName.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }
  }, [searchQuery, friends]);

  // Handle responsive behavior on window resize
  useEffect(() => {
    const handleResize = () => {
      // On desktop/tablet, always show both views
      if (window.innerWidth >= 768) {
        setShowChatView(false);
      }
    };

    window.addEventListener('resize', handleResize);
    
    // Initial check
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Set up socket event listeners for UI updates - separate useEffect with minimal dependencies
  useEffect(() => {
    if (!socket) {
      console.log('🔍 DEBUG: FriendsPage - Socket not available yet, skipping event listener setup');
      return;
    }

    console.log('🔍 DEBUG: FriendsPage - Socket available, setting up event listeners');

    // Clean up any existing listeners first to prevent duplicates
    socket.off('receiveMessage');
    socket.off('messageSent');
    socket.off('messagesRead');
    socket.off('messageStatusUpdate');
    socket.off('friendOnlineStatus');
    socket.off('friendsStatusSnapshot');
    socket.off('friend_request_received');

    const handleReceiveMessage = (message) => {
      console.log('🔍 DEBUG: FriendsPage - received receiveMessage event:', message);
      
      // Validate sender username/id
      if (!message.senderUsername && !message.senderId) {
        console.log('⚠️ RECEIVE: No senderUsername or senderId found in message, skipping');
        return;
      }
      
      // Check if this message was already processed (deduplication)
      const messageId = message._id || message.id;
      if (messageId && uiState.readMessageIds.has(messageId)) {
        console.log(`🔄 RECEIVE: Message ${messageId} already processed, skipping duplicate`);
        return;
      }
      
      // Skip processing if this was delivered on connect (already seen)
      if (message.isDeliveredOnConnect) {
        console.log(`📭 RECEIVE: Message delivered on connect, skipping processing`);
        
        // Still add to messages
        setMessages(prev => ({
          ...prev,
          [message.senderId]: [...(prev[message.senderId] || []), message]
        }));
        
        // Mark as read since it was delivered on connect
        if (messageId) {
          setUiState(prev => ({
            ...prev,
            readMessageIds: new Set([...prev.readMessageIds, messageId])
          }));
        }
        return;
      }
      
      // Update messages state first
      setMessages(prev => ({
        ...prev,
        [message.senderId]: [...(prev[message.senderId] || []), message]
      }));

      // Send delivery acknowledgment to server (but not for messages delivered on connect)
      if (!message.isDeliveredOnConnect && message._id && socket && socket.connected) {
        console.log(`✅ Sending delivery acknowledgment for message ${message._id}`);
        socket.emit('messageDelivered', {
          messageId: message._id,
          receiverId: localStorage.getItem('profileId')
        });
      }

      // Check if this is from the currently active chat
      const currentUserId = localStorage.getItem('profileId');
      const isFromCurrentChat = currentFriend && currentFriend.profileId === message.senderId;
      
      // Move friend to top and update unread count (if not current chat)
      if (!isFromCurrentChat) {
        const currentTime = Date.now();
        
        setFriends(prevFriends => {
          const friendIndex = prevFriends.findIndex(f => f.profileId === message.senderId);
          if (friendIndex === -1) {
            console.log('⚠️ RECEIVE: Friend not found in friends list:', message.senderId);
            return prevFriends;
          }
          
          // Create updated friends array with sender moved to top
          const updatedFriends = [...prevFriends];
          const [senderFriend] = updatedFriends.splice(friendIndex, 1);
          
          // Update unread count
          const updatedSenderFriend = {
            ...senderFriend,
            unreadMessages: (senderFriend.unreadMessages || 0) + 1,
            lastMovedAt: currentTime
          };
          
          updatedFriends.unshift(updatedSenderFriend);
          
          console.log(`📋 RECEIVE: Moved friend to top and updated unread count: ${updatedSenderFriend.username}, count: ${updatedSenderFriend.unreadMessages}`);
          
          return updatedFriends;
        });
        
        // Update UI state for persistence
        setUiState(prev => ({
          ...prev,
          unreadCounts: {
            ...prev.unreadCounts,
            [message.senderId]: (prev.unreadCounts[message.senderId] || 0) + 1
          },
          lastMovedAt: {
            ...prev.lastMovedAt,
            [message.senderId]: currentTime
          }
        }));
        
      } else {
        // If message is from current chat, mark as read immediately
        console.log('📖 RECEIVE: Auto-marking received message as read (current chat)');
        setTimeout(() => {
          markMessagesAsRead(message.senderId);
        }, 100);
      }
      
      // Mark message as processed to prevent duplicates
      if (messageId) {
        setUiState(prev => ({
          ...prev,
          readMessageIds: new Set([...prev.readMessageIds, messageId])
        }));
      }
    };

    const handleMessageSent = (message) => {
      console.log('✅ FriendsPage - Message sent confirmation:', message);
      
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
    };

    const handleMessagesRead = (data) => {
      console.log('📖 FriendsPage - Messages read by:', data.receiverId);
      
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
    };

    const handleMessageStatusUpdate = (data) => {
      console.log('📊 FriendsPage - Message status update:', data);
      
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
    };

    const handleFriendOnlineStatus = (data) => {
      console.log('🔍 DEBUG: FriendsPage - Friend online status received:', data);
      console.log('🔍 DEBUG: FriendsPage - Updating friend with profileId:', data.profileId, 'to isOnline:', data.isOnline);
      
      setFriends(prevFriends => {
        const updatedFriends = prevFriends.map(f => {
          if (f.profileId === data.profileId) {
            console.log('🔍 DEBUG: FriendsPage - Found friend to update:', f.username, 'from isOnline:', f.isOnline, 'to isOnline:', data.isOnline);
            return { 
              ...f, 
              isOnline: data.isOnline, 
              lastSeen: data.lastSeen || f.lastSeen // Use provided lastSeen or keep existing
            };
          }
          return f;
        });
        
        console.log('🔍 DEBUG: FriendsPage - Updated friends list:', updatedFriends.map(f => ({ username: f.username, isOnline: f.isOnline })));
        return updatedFriends;
      });
    };

    const handleFriendRequestReceived = (data) => {
      console.log('🔍 DEBUG: FriendsPage - received friend_request_received event for count update:', data);
      // Update friend requests count
      setFriendRequestsCount(prev => prev + 1);
    };

    const handleFriendsStatusSnapshot = (data) => {
      console.log('🔍 DEBUG: FriendsPage - received friends status snapshot:', data);
      
      // Apply the snapshot to update all friends' online statuses immediately
      setFriends(prevFriends => {
        const updatedFriends = prevFriends.map(friend => {
          const snapshotFriend = data.friends.find(f => f.profileId === friend.profileId);
          if (snapshotFriend) {
            console.log(`🔍 DEBUG: Updating friend ${friend.username} status from snapshot: ${snapshotFriend.isOnline ? 'online' : 'offline'}`);
            return {
              ...friend,
              isOnline: snapshotFriend.isOnline,
              lastSeen: snapshotFriend.lastSeen || friend.lastSeen
            };
          }
          return friend;
        });
        
        console.log('🔍 DEBUG: Applied snapshot to friends list:', updatedFriends.map(f => ({ username: f.username, isOnline: f.isOnline })));
        return updatedFriends;
      });
    };

    // Register event listeners
    socket.on('receiveMessage', handleReceiveMessage);
    socket.on('messageSent', handleMessageSent);
    socket.on('messagesRead', handleMessagesRead);
    socket.on('messageStatusUpdate', handleMessageStatusUpdate);
    socket.on('friendOnlineStatus', handleFriendOnlineStatus);
    socket.on('friendsStatusSnapshot', handleFriendsStatusSnapshot);
    socket.on('friend_request_received', handleFriendRequestReceived);

    console.log('🔍 DEBUG: FriendsPage - Socket event listeners registered');
    console.log('🔍 DEBUG: FriendsPage - friendOnlineStatus listener specifically registered');

    // Cleanup function
    return () => {
      console.log('🔍 DEBUG: FriendsPage - Removing socket event listeners');
      socket.off('receiveMessage', handleReceiveMessage);
      socket.off('messageSent', handleMessageSent);
      socket.off('messagesRead', handleMessagesRead);
      socket.off('messageStatusUpdate', handleMessageStatusUpdate);
      socket.off('friendOnlineStatus', handleFriendOnlineStatus);
      socket.off('friendsStatusSnapshot', handleFriendsStatusSnapshot);
      socket.off('friend_request_received', handleFriendRequestReceived);
    };
  }, [socket]); // Only depend on socket - other dependencies will cause re-renders

  const markMessagesAsRead = useCallback((friendId) => {
    const currentUserId = localStorage.getItem('profileId');
    if (currentUserId && friendId) {
      console.log(`📖 Marking messages from ${friendId} as read`);
      
      // Mark all messages from this friend as read in local state
      const friendMessages = messages[friendId] || [];
      const messageIds = friendMessages.map(msg => msg._id || msg.id).filter(Boolean);
      
      if (messageIds.length > 0) {
        setUiState(prev => ({
          ...prev,
          readMessageIds: new Set([...prev.readMessageIds, ...messageIds])
        }));
      }
      
      if (socket) {
        socket.emit('markMessagesAsRead', {
          senderId: friendId,
          receiverId: currentUserId
        });
      }
    }
  }, [messages, socket]);

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

  // SHARED FUNCTION: Consistent move-to-top logic for both send and receive
  const moveFriendToTop = useCallback((profileId) => {
    const currentTime = Date.now();
    
    setFriends(prevFriends => {
      const friendIndex = prevFriends.findIndex(f => f.profileId === profileId);
      if (friendIndex === -1 || friendIndex === 0) {
        // Friend not found or already at top, no need to reorder
        return prevFriends;
      }
      
      // Move friend to the top
      const reorderedFriends = [...prevFriends];
      const [friendToMove] = reorderedFriends.splice(friendIndex, 1);
      
      // Update lastMovedAt timestamp
      const updatedFriend = {
        ...friendToMove,
        lastMovedAt: currentTime
      };
      
      reorderedFriends.unshift(updatedFriend);
      
      return reorderedFriends;
    });
    
    // Update UI state for persistence
    setUiState(prev => ({
      ...prev,
      lastMovedAt: {
        ...prev.lastMovedAt,
        [profileId]: currentTime
      }
    }));
    
  }, []);

  const handleSelectFriend = (friend) => {
    setCurrentFriend(friend);
    
    // Switch to chat view on mobile
    setShowChatView(true);
    
    // Reset unread messages count for the selected friend
    setFriends(prevFriends =>
      prevFriends.map(f =>
        f.profileId === friend.profileId
          ? { ...f, unreadMessages: 0 }
          : f
      )
    );
    
    // Update UI state to reset unread count
    setUiState(prev => ({
      ...prev,
      unreadCounts: {
        ...prev.unreadCounts,
        [friend.profileId]: 0
      }
    }));

    console.log('📖 Reset unread count for friend:', friend.username);

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

    // Move the current friend to the top of the friends list immediately
    moveFriendToTop(currentFriend.profileId);

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
      if (socket) {
        socket.emit('sendMessage', {
          senderId: profileId,
          receiverId: currentFriend.profileId,
          content: message
        });
        console.log('📤 Message sent via Socket.IO');
      } else {
        console.log('⚠️ Socket not available, falling back to REST API');
      }
    } catch (error) {
      console.error('Error sending message via Socket.IO:', error);
      
      // Fallback to REST API if Socket.IO fails
      try {
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000'}/api/messages/send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
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
          `${process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000'}/api/remove-friend`,
        { friendId: friendToRemove.profileId },
        { 
          withCredentials: true
        }
      );

      if (response.data.success) {
        // Remove friend from local state
        setFriends(prevFriends => prevFriends.filter(f => f.profileId !== friendToRemove.profileId));
        
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
      if (profileId && socket) {
        console.log('📡 Notifying server about logout via Socket.IO');
        socket.emit('logout', { profileId });
        
        // Wait a moment for the server to process the logout
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Disconnect Socket.IO
      if (socket) {
        socket.disconnect();
        console.log('🔌 Socket.IO disconnected');
      }
      
      // Call REST API logout
        await fetch(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000'}/api/auth/logout`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
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
      if (socket) {
        socket.disconnect();
      }
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
    console.log('🔍 DEBUG: FriendsPage - Friend request handled, refreshing data');
    fetchFriends();
    fetchFriendRequestsCount();
  };

  const handleBackToFriends = () => {
    setShowChatView(false);
    setCurrentFriend(null);
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
                  <span className="d-none-mobile">Find Friends</span>
                </Button>
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
                />
              </Form.Group>


            {error && (
              <Alert variant="danger" onClose={() => setError('')} dismissible className="flex-shrink-0">
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
          <Col xs={12} md={8} className={`chat-container ${!showChatView ? 'd-none d-md-block' : ''}`}>
            {currentFriend ? (
              <ChatArea 
                friend={currentFriend} 
                messages={messages[currentFriend.profileId] || []}
                onSendMessage={handleSendMessage}
                onCloseChat={handleBackToFriends}
                onRemoveFriend={handleRemoveFriend}
                showBackButton={showChatView}
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
const ChatArea = ({ friend, messages, onSendMessage, onCloseChat, onRemoveFriend, showBackButton = false }) => {
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
            {/* Back Button for Mobile */}
            {showBackButton && (
              <Button
                className="btn-modern-icon me-2 d-md-none"
                onClick={onCloseChat}
                title="Back to friends list"
              >
                ←
              </Button>
            )}
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
              className="me-2 d-none d-md-inline-flex"
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
              className="btn-modern-icon d-none d-md-flex"
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
