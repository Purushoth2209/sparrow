import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../services/api/auth.api';
import { userApi } from '../services/api/user.api';

const AuthContext = createContext();

export const useAuthStore = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthStore must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [authToken, setAuthToken] = useState(null); // For mobile JWT support later
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Load auth state from localStorage on mount
  useEffect(() => {
    const loadAuthState = () => {
      try {
        const profileId = localStorage.getItem('profileId');
        const token = localStorage.getItem('authToken');
        const username = localStorage.getItem('username');
        const email = localStorage.getItem('email');
        const fullName = localStorage.getItem('fullName');
        const profileImage = localStorage.getItem('profileImage');

        if (profileId) {
          setCurrentUser({
            profileId,
            username,
            email,
            fullName,
            profileImage,
          });
          setIsAuthenticated(true);
          if (token) {
            setAuthToken(token);
          }
        }
      } catch (error) {
        // Silently handle auth state loading errors
      } finally {
        setIsLoading(false);
      }
    };

    loadAuthState();
  }, []);

  // Persist auth state to localStorage
  const persistAuthState = useCallback((user, token = null) => {
    if (user) {
      localStorage.setItem('profileId', user.profileId);
      localStorage.setItem('username', user.username || '');
      localStorage.setItem('email', user.email || '');
      localStorage.setItem('fullName', user.fullName || '');
      localStorage.setItem('profileImage', user.profileImage || '');
      
      if (token) {
        localStorage.setItem('authToken', token);
        setAuthToken(token);
      }
    }
  }, []);

  // Clear auth state from localStorage
  const clearAuthState = useCallback(() => {
    localStorage.removeItem('profileId');
    localStorage.removeItem('authToken');
    localStorage.removeItem('username');
    localStorage.removeItem('email');
    localStorage.removeItem('fullName');
    localStorage.removeItem('profileImage');
    setCurrentUser(null);
    setAuthToken(null);
    setIsAuthenticated(false);
  }, []);

  // Get current user from API
  const getCurrentUser = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await userApi.getCurrentUser();
      
      if (data.success && data.user) {
        setCurrentUser(data.user);
        setIsAuthenticated(true);
        persistAuthState(data.user);
        return { success: true, user: data.user };
      }
      
      clearAuthState();
      return { success: false };
    } catch (error) {
      clearAuthState();
      return { success: false, error };
    } finally {
      setIsLoading(false);
    }
  }, [persistAuthState, clearAuthState]);

  // Login
  const login = useCallback(async (identifier, password) => {
    try {
      setIsLoading(true);
      const data = await authApi.login(identifier, password);
      
      if (data.success && data.user) {
        setCurrentUser(data.user);
        setIsAuthenticated(true);
        persistAuthState(data.user, data.token); // token for mobile later
        
        // Register socket (will be handled by SocketContext)
        const socket = window.socketInstance;
        if (socket && socket.connected) {
          socket.emit('register', data.user.profileId);
        }
        
        return { success: true, user: data.user };
      }
      
      return { success: false, message: data.message || 'Login failed' };
    } catch (error) {
      return { 
        success: false, 
        message: error.response?.data?.message || 'Login failed' 
      };
    } finally {
      setIsLoading(false);
    }
  }, [persistAuthState]);

  // Logout
  const logout = useCallback(async () => {
    try {
      const profileId = localStorage.getItem('profileId');
      
      // Notify socket
      const socket = window.socketInstance;
      if (profileId && socket) {
        socket.emit('logout', { profileId });
        await new Promise(resolve => setTimeout(resolve, 100));
        socket.disconnect();
      }
      
      // Call API
      await authApi.logout();
      
      // Clear state
      clearAuthState();
    } catch (error) {
      // Force clear even if API fails
      const socket = window.socketInstance;
      if (socket) {
        socket.disconnect();
      }
      clearAuthState();
    }
  }, [clearAuthState]);

  // Refresh auth (for token refresh in mobile later)
  const refresh = useCallback(async () => {
    return await getCurrentUser();
  }, [getCurrentUser]);

  const value = {
    // State
    currentUser,
    authToken,
    isLoading,
    isAuthenticated,
    
    // Actions
    login,
    logout,
    refresh,
    getCurrentUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

