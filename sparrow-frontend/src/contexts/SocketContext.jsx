import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import { 
  processQueueOnConnect, 
  pauseQueueProcessor, 
  resumeQueueProcessor 
} from '../queue/queueProcessor';

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
  const queueProcessorCallbackRef = useRef(null);

  // Initialize socket connection once
  useEffect(() => {
    const newSocket = io(process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000');
    socketRef.current = newSocket;
    setSocket(newSocket);
    window.socketInstance = newSocket;

    // Handle connection status
    newSocket.on('connect', async () => {
      setIsConnected(true);
      const currentProfileId = localStorage.getItem('profileId');
      if (currentProfileId) {
        newSocket.emit('register', currentProfileId);
      }

      // Resume queue processor and trigger processing
      if (queueProcessorCallbackRef.current) {
        resumeQueueProcessor(queueProcessorCallbackRef.current);
        processQueueOnConnect(queueProcessorCallbackRef.current);
      }

      // Perform sync on connect
      try {
        const { useChatStore } = await import('../store/chat.store');
        // We can't use hooks here, so we'll handle sync in a component
        // The sync will be triggered by useQueueProcessor or a dedicated sync hook
      } catch (error) {
        console.error('Error setting up sync on connect:', error);
      }
    });

    // Handle reconnect
    newSocket.on('reconnect', async () => {
      setIsConnected(true);
      const currentProfileId = localStorage.getItem('profileId');
      if (currentProfileId) {
        newSocket.emit('register', currentProfileId);
      }

      // Resume queue processor and trigger processing
      if (queueProcessorCallbackRef.current) {
        resumeQueueProcessor(queueProcessorCallbackRef.current);
        processQueueOnConnect(queueProcessorCallbackRef.current);
      }
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
      
      // Pause queue processor when disconnected
      pauseQueueProcessor();
    });

    newSocket.on('connect_error', () => {
      setIsConnected(false);
      
      // Pause queue processor on connection error
      pauseQueueProcessor();
    });

    // Set up heartbeat to maintain connection
    heartbeatIntervalRef.current = setInterval(() => {
      if (newSocket.connected) {
        const profileId = localStorage.getItem('profileId');
        newSocket.emit('ping', profileId);
      }
    }, 25000);

    newSocket.on('pong', () => {
      // Heartbeat acknowledged
    });

    // Cleanup function
    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      newSocket.disconnect();
      setSocket(null);
      setIsConnected(false);
    };
  }, []);

  // Register socket with user when profileId becomes available
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) return;

    const profileId = localStorage.getItem('profileId');
    if (profileId) {
      socket.emit('register', profileId);
    }
  }, [isConnected]);

  // Function to re-register socket when user logs in
  const reRegisterSocket = () => {
    const socket = socketRef.current;
    if (!socket) return;

    const profileId = localStorage.getItem('profileId');
    if (profileId && socket.connected) {
      socket.emit('register', profileId);
    }
  };

  // Function to set queue processor callback (called by useQueueProcessor)
  const setQueueProcessorCallback = (callback) => {
    queueProcessorCallbackRef.current = callback;
    
    // If already connected, resume queue
    if (isConnected && callback) {
      resumeQueueProcessor(callback);
      processQueueOnConnect(callback);
    }
  };

  const value = {
    socket,
    isConnected,
    reRegisterSocket,
    setQueueProcessorCallback,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};
