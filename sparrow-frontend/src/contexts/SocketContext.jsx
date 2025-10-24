import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';

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
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const heartbeatIntervalRef = useRef(null);

  // Initialize socket connection once
  useEffect(() => {
    console.log('🔍 DEBUG: Global Socket Context - Initializing socket connection');
    
    // Initialize socket connection
    const newSocket = io(process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000');
    socketRef.current = newSocket;
    setSocket(newSocket); // Set state to trigger re-render

    // Make socket available globally for App component
    window.socketInstance = newSocket;

    console.log('🔍 DEBUG: Global Socket Context - Socket created:', newSocket.id);

    // Handle connection status
    newSocket.on('connect', () => {
      console.log('🔗 Global Socket Context - Socket connected with ID:', newSocket.id);
      setIsConnected(true);
      const currentProfileId = localStorage.getItem('profileId');
      console.log('🔍 DEBUG: Global Socket Context - socket connected, current profileId:', currentProfileId);
      
      if (currentProfileId) {
        console.log('🔍 DEBUG: Global Socket Context - registering socket after connect');
        newSocket.emit('register', currentProfileId);
      }
    });

    newSocket.on('disconnect', (reason) => {
      console.log('🔌 Global Socket Context - Socket disconnected, reason:', reason);
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ Global Socket Context - Connection error:', error);
      setIsConnected(false);
    });

    // Set up heartbeat to maintain connection
    heartbeatIntervalRef.current = setInterval(() => {
      if (newSocket.connected) {
        const profileId = localStorage.getItem('profileId');
        newSocket.emit('ping', profileId);
      }
    }, 25000); // Send ping every 25 seconds

    newSocket.on('pong', () => {
      console.log('🏓 Global Socket Context - Pong received');
    });

    // Cleanup function
    return () => {
      console.log('🔍 DEBUG: Global Socket Context - cleaning up socket connection');
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      newSocket.disconnect();
      setSocket(null);
      setIsConnected(false);
    };
  }, []); // Empty dependency array - initialize once


  // Register socket with user when profileId becomes available
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) return;

    const profileId = localStorage.getItem('profileId');
    if (profileId) {
      console.log('🔍 DEBUG: Global Socket Context - Registering socket with profileId:', profileId);
      socket.emit('register', profileId);
    }
  }, [isConnected]); // Re-run when connection status changes

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
    socket,
    isConnected,
    reRegisterSocket
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};
