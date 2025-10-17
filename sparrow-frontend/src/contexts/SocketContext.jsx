import React, { createContext, useContext, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { useNotifications } from './NotificationContext';

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const socketRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);
  const { 
    notifyMessageReceived, 
    notifyFriendRequestReceived,
    notifyFriendRequestAccepted,
    notifyFriendRequestRejected,
    notifyFriendUnfriended 
  } = useNotifications();

  // Initialize socket connection once
  useEffect(() => {
    console.log('🔍 DEBUG: Global Socket Context - Initializing socket connection');
    
    // Initialize socket connection
    const socket = io(process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000');
    socketRef.current = socket;

    // Make socket available globally for App component
    window.socketInstance = socket;

    console.log('🔍 DEBUG: Global Socket Context - Socket created:', socket.id);

    // Handle connection status
    socket.on('connect', () => {
      console.log('🔗 Global Socket Context - Socket connected with ID:', socket.id);
      const currentProfileId = localStorage.getItem('profileId');
      console.log('🔍 DEBUG: Global Socket Context - socket connected, current profileId:', currentProfileId);
      
      if (currentProfileId) {
        console.log('🔍 DEBUG: Global Socket Context - registering socket after connect');
        socket.emit('register', currentProfileId);
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 Global Socket Context - Socket disconnected, reason:', reason);
    });

    socket.on('connect_error', (error) => {
      console.error('❌ Global Socket Context - Connection error:', error);
    });

    // Set up heartbeat to maintain connection
    heartbeatIntervalRef.current = setInterval(() => {
      if (socket.connected) {
        const profileId = localStorage.getItem('profileId');
        socket.emit('ping', profileId);
      }
    }, 25000); // Send ping every 25 seconds

    socket.on('pong', () => {
      console.log('🏓 Global Socket Context - Pong received');
    });

    // Cleanup function
    return () => {
      console.log('🔍 DEBUG: Global Socket Context - cleaning up socket connection');
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      socket.disconnect();
    };
  }, []); // Empty dependency array - initialize once

  // Set up only notification-related event listeners in the global context
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    console.log('🔍 DEBUG: Global Socket Context - Setting up notification event listeners');

    // Only handle notification events in the global context
    // Message handling will be done in component-specific contexts
    const handleFriendRequestReceived = (data) => {
      console.log('🔍 DEBUG: Global Socket Context - received friend_request_received event:', data);
      console.log('🔍 DEBUG: Global Socket Context - calling notifyFriendRequestReceived with:', data.senderName || data.senderUsername);
      notifyFriendRequestReceived(data.senderName || data.senderUsername);
    };

    const handleFriendRequestAccepted = (data) => {
      console.log('🔍 DEBUG: Global Socket Context - received friend_request_accepted event:', data);
      console.log('🔍 DEBUG: Global Socket Context - calling notifyFriendRequestAccepted with:', data.accepterName || data.accepterUsername);
      notifyFriendRequestAccepted(data.accepterName || data.accepterUsername);
    };

    const handleFriendRequestRejected = (data) => {
      console.log('🔍 DEBUG: Global Socket Context - received friend_request_rejected event:', data);
      console.log('🔍 DEBUG: Global Socket Context - calling notifyFriendRequestRejected with:', data.rejecterName || data.rejecterUsername);
      notifyFriendRequestRejected(data.rejecterName || data.rejecterUsername);
    };

    const handleFriendUnfriended = (data) => {
      console.log('🔍 DEBUG: Global Socket Context - received friend_unfriended event:', data);
      console.log('🔍 DEBUG: Global Socket Context - calling notifyFriendUnfriended with:', data.unfrienderName || data.unfrienderUsername);
      notifyFriendUnfriended(data.unfrienderName || data.unfrienderUsername);
    };

    // Register only notification event listeners
    socket.on('friend_request_received', handleFriendRequestReceived);
    socket.on('friend_request_accepted', handleFriendRequestAccepted);
    socket.on('friend_request_rejected', handleFriendRequestRejected);
    socket.on('friend_unfriended', handleFriendUnfriended);

    console.log('🔍 DEBUG: Global Socket Context - Notification event listeners registered');

    // Cleanup function - remove only notification event listeners
    return () => {
      console.log('🔍 DEBUG: Global Socket Context - Removing notification event listeners');
      socket.off('friend_request_received', handleFriendRequestReceived);
      socket.off('friend_request_accepted', handleFriendRequestAccepted);
      socket.off('friend_request_rejected', handleFriendRequestRejected);
      socket.off('friend_unfriended', handleFriendUnfriended);
    };
  }, [notifyFriendRequestReceived, notifyFriendRequestAccepted, notifyFriendRequestRejected, notifyFriendUnfriended]);

  // Register socket with user when profileId becomes available
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) return;

    const profileId = localStorage.getItem('profileId');
    if (profileId) {
      console.log('🔍 DEBUG: Global Socket Context - Registering socket with profileId:', profileId);
      socket.emit('register', profileId);
    }
  }, []); // Run once when component mounts

  // Function to re-register socket when user logs in
  const reRegisterSocket = () => {
    const socket = socketRef.current;
    if (!socket) return;

    const profileId = localStorage.getItem('profileId');
    if (profileId && socket.connected) {
      console.log('🔍 DEBUG: Global Socket Context - Re-registering socket with profileId:', profileId);
      socket.emit('register', profileId);
    }
  };

  const value = {
    socket: socketRef.current,
    reRegisterSocket
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};
