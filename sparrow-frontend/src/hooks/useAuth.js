import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../services/api/auth.api';
import { userApi } from '../services/api/user.api';
import { useSocket } from '../contexts/SocketContext';

export const useAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const { socket, reRegisterSocket } = useSocket();

  const checkAuth = async (retryCount = 0) => {
    const profileId = localStorage.getItem('profileId');

    if (profileId) {
      try {
        const data = await userApi.getCurrentUser();

        if (data.success && data.user) {
          // Update local storage with fresh data
          localStorage.setItem('profileId', data.user.profileId);
          localStorage.setItem('username', data.user.username);
          localStorage.setItem('email', data.user.email || '');
          localStorage.setItem('fullName', data.user.fullName || '');
          localStorage.setItem('profileImage', data.user.profileImage || '');
          
          setUser(data.user);
          setIsAuthenticated(true);

          // Register socket for authenticated user
          if (socket && socket.connected) {
            socket.emit('register', data.user.profileId);
          } else if (reRegisterSocket) {
            setTimeout(() => reRegisterSocket(), 100);
          }
        } else {
          localStorage.clear();
          setIsAuthenticated(false);
          setUser(null);
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        // Retry logic for network issues
        if (retryCount < 2 && error.name === 'TypeError') {
          setTimeout(() => checkAuth(retryCount + 1), 1000);
          return;
        }
        // Keep local auth if backend is unreachable
        setIsAuthenticated(true);
      }
    } else {
      // No local auth data, check backend session
      try {
        const data = await userApi.getCurrentUser();

        if (data.success && data.user) {
          // Store user data and mark as authenticated
          localStorage.setItem('profileId', data.user.profileId);
          localStorage.setItem('username', data.user.username);
          localStorage.setItem('email', data.user.email || '');
          localStorage.setItem('fullName', data.user.fullName || '');
          localStorage.setItem('profileImage', data.user.profileImage || '');
          
          setUser(data.user);
          setIsAuthenticated(true);

          // Register socket for authenticated user
          if (socket && socket.connected) {
            socket.emit('register', data.user.profileId);
          } else if (reRegisterSocket) {
            setTimeout(() => reRegisterSocket(), 100);
          }
        } else {
          setIsAuthenticated(false);
          setUser(null);
        }
      } catch (error) {
        console.error('Backend check failed:', error);
        // Retry logic
        if (retryCount < 2 && error.name === 'TypeError') {
          setTimeout(() => checkAuth(retryCount + 1), 1000);
          return;
        }
        setIsAuthenticated(false);
        setUser(null);
      }
    }

    setIsCheckingAuth(false);
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const login = async (identifier, password) => {
    const data = await authApi.login(identifier, password);
    
    if (data.success) {
      localStorage.setItem('profileId', data.user.profileId);
      localStorage.setItem('username', data.user.username);
      localStorage.setItem('email', data.user.email || '');
      localStorage.setItem('fullName', data.user.fullName || '');
      localStorage.setItem('profileImage', data.user.profileImage || '');
      
      setUser(data.user);
      setIsAuthenticated(true);

      // Register with Socket.IO
      if (socket && socket.connected) {
        socket.emit('register', data.user.profileId);
      } else if (reRegisterSocket) {
        setTimeout(() => reRegisterSocket(), 100);
      }

      return { success: true };
    }
    
    return { success: false, message: data.message };
  };

  const logout = async () => {
    try {
      const profileId = localStorage.getItem('profileId');
      
      // Notify Socket.IO server about logout
      if (profileId && socket) {
        socket.emit('logout', { profileId });
        await new Promise(resolve => setTimeout(resolve, 100));
        socket.disconnect();
      }

      // Call REST API logout
      await authApi.logout();

      // Clear local storage
      localStorage.clear();
      sessionStorage.clear();
      
      setIsAuthenticated(false);
      setUser(null);
    } catch (error) {
      console.error('Error during logout:', error);
      // Force disconnect and clear data even if API fails
      if (socket) {
        socket.disconnect();
      }
      localStorage.clear();
      sessionStorage.clear();
      setIsAuthenticated(false);
      setUser(null);
    }
  };

  return {
    isAuthenticated,
    isCheckingAuth,
    user,
    login,
    logout,
    checkAuth,
  };
};

