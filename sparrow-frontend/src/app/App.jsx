import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { AppProviders } from './providers';
import { AppRoutes } from './routes';
import { userApi } from '../services/api/user.api';
import '../styles/modern-theme.css';

const AppContent = () => {

  // Handle automatic logout functionality
  React.useEffect(() => {
    // Function to perform logout
    const performLogout = async () => {
      try {
        // Notify Socket.IO server about logout if available
        const profileId = localStorage.getItem('profileId');
        if (profileId && window.socketInstance) {
          const socket = window.socketInstance;
          if (socket && socket.connected) {
            socket.emit('logout', { profileId });
            await new Promise(resolve => setTimeout(resolve, 50));
            socket.disconnect();
          }
        }

        // Call backend logout endpoint (session-based)
        await fetch(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000'}/api/auth/logout`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          },
        });
      } catch (error) {
        // Silently handle logout errors
      } finally {
        // Always clear local data
        localStorage.clear();
        sessionStorage.clear();
      }
    };

    // Handle browser back button from friends page
    const handlePopState = () => {
      const currentPath = window.location.pathname;
      const profileId = localStorage.getItem('profileId');

      // If user goes back from friends page and is authenticated, logout
      if (profileId && (currentPath === '/login' || currentPath === '/signup')) {
        // Clear local data immediately to prevent auth issues
        localStorage.clear();
        sessionStorage.clear();

        // Try to logout from server, but don't wait for it
        performLogout().catch(() => {
          // Ignore errors
        });

        // Redirect to login to prevent access to auth pages while logged in
        window.location.href = '/login';
      }
    };

    // Handle tab/browser close
    const handleBeforeUnload = () => {
      // Clear local storage first to prevent auth issues
      const profileId = localStorage.getItem('profileId');
      localStorage.clear();
      sessionStorage.clear();

      // Try to notify server, but don't let it block the page unload
      if (profileId && window.socketInstance) {
        try {
          window.socketInstance.emit('logout', { profileId });
        } catch (error) {
          // Ignore errors
        }
      }

      // Send synchronous logout request to backend (with timeout)
      if (profileId) {
        try {
          const xhr = new XMLHttpRequest();
          xhr.timeout = 500; // 500ms timeout to prevent hanging
          xhr.open('POST', `${process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000'}/api/auth/logout`, false);
          xhr.setRequestHeader('Content-Type', 'application/json');
          xhr.withCredentials = true;
          xhr.send(JSON.stringify({}));
        } catch (error) {
          // Ignore errors
        }
      }
    };

    // Handle visibility change (tab switching)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        const profileId = localStorage.getItem('profileId');
        if (profileId) {
          // Verify session is still valid using API service
          userApi.getCurrentUser()
            .then(() => {
              // Session valid
            })
            .catch(() => {
              // Session invalid or network error, logout
              performLogout();
              window.location.href = '/login';
            });
        }
      }
    };

    // Add event listeners
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return (
    <Router>
      <div className="app-container">
        <AppRoutes />
      </div>
    </Router>
  );
};

const App = () => {
  return (
    <AppProviders>
      <AppContent />
    </AppProviders>
  );
};

export default App;

