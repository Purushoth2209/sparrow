import React from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Signup from './components/Signup';
import FriendsPage from './components/FriendsPage';
import GlobalSearch from './components/GlobalSearch';
import UsernameSetup from './components/UsernameSetup';
import './components/styles/modern-theme.css';

// PrivateRoute Component to protect authenticated pages
// Allows both JWT-based auth (email/phone) and session-based auth (Google OAuth)
const PrivateRoute = ({ element: Component, ...rest }) => {
  const [isCheckingAuth, setIsCheckingAuth] = React.useState(true);
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);

  React.useEffect(() => {
    const checkAuth = async (retryCount = 0) => {
      const token = localStorage.getItem('token');
      const profileId = localStorage.getItem('profileId');

      console.log('🔍 Auth check - Local storage:', { token: !!token, profileId: !!profileId, retry: retryCount });

      // If we have local auth data, verify it's still valid with backend
      if (token && profileId) {
        try {
          const response = await fetch('http://localhost:5000/api/user', {
            method: 'GET',
            credentials: 'include',
            headers: { 
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            },
            cache: 'no-store',
          });

          console.log('🔍 Backend session check response:', response.status);

          if (response.ok) {
            const data = await response.json();
            if (data.success && data.user) {
              console.log('✅ Session valid, user authenticated');
              // Update local storage with fresh data
              localStorage.setItem('profileId', data.user.profileId);
              localStorage.setItem('username', data.user.username);
              localStorage.setItem('email', data.user.email || '');
              localStorage.setItem('fullName', data.user.fullName || '');
              localStorage.setItem('profileImage', data.user.profileImage || '');
              localStorage.setItem('token', 'session-authenticated');
              setIsAuthenticated(true);
            } else {
              console.log('❌ Invalid session data, clearing local storage');
              localStorage.clear();
              setIsAuthenticated(false);
            }
          } else if (response.status === 401) {
            console.log('❌ Session expired, clearing local storage');
            localStorage.clear();
            setIsAuthenticated(false);
          } else {
            console.log('❌ Session check failed, keeping local auth');
            // Keep local auth if backend is unreachable
            setIsAuthenticated(true);
          }
        } catch (error) {
          console.error('❌ Auth check failed:', error);
          // Retry logic for Firefox network issues
          if (retryCount < 2 && error.name === 'TypeError') {
            console.log(`🔄 Retrying auth check (${retryCount + 1}/2)...`);
            setTimeout(() => checkAuth(retryCount + 1), 1000);
            return;
          }
          // Keep local auth if backend is unreachable (network error)
          setIsAuthenticated(true);
        }
      } else {
        // No local auth data, check if there's a backend session
        try {
          const response = await fetch('http://localhost:5000/api/user', {
            method: 'GET',
            credentials: 'include',
            headers: { 
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            },
            cache: 'no-store',
          });

          if (response.ok) {
            const data = await response.json();
            if (data.success && data.user) {
              console.log('✅ Backend session found, storing local data');
              // Store user data and mark as authenticated
              localStorage.setItem('profileId', data.user.profileId);
              localStorage.setItem('username', data.user.username);
              localStorage.setItem('email', data.user.email || '');
              localStorage.setItem('fullName', data.user.fullName || '');
              localStorage.setItem('profileImage', data.user.profileImage || '');
              localStorage.setItem('token', 'session-authenticated');
              setIsAuthenticated(true);
            } else {
              console.log('❌ No valid session found');
              setIsAuthenticated(false);
            }
          } else {
            console.log('❌ No backend session');
            setIsAuthenticated(false);
          }
        } catch (error) {
          console.error('❌ Backend check failed:', error);
          // Retry logic for Firefox network issues
          if (retryCount < 2 && error.name === 'TypeError') {
            console.log(`🔄 Retrying backend check (${retryCount + 1}/2)...`);
            setTimeout(() => checkAuth(retryCount + 1), 1000);
            return;
          }
          setIsAuthenticated(false);
        }
      }
      
      setIsCheckingAuth(false);
    };

    checkAuth();
  }, []);

  if (isCheckingAuth) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontFamily: 'Roboto, sans-serif',
        fontSize: '1.2rem',
        color: '#555'
      }}>
        <div className="text-center">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-2">Verifying authentication...</p>
        </div>
      </div>
    );
  }

  return isAuthenticated ? Component : <Navigate to="/login" replace />;
};

const App = () => {
  // Handle automatic logout functionality
  React.useEffect(() => {
    // Function to perform logout
    const performLogout = async () => {
      try {
        console.log('🚪 Performing automatic logout...');
        
        // Notify Socket.IO server about logout if available
        const profileId = localStorage.getItem('profileId');
        if (profileId && window.io) {
          // Try to get the socket instance from FriendsPage
          const socket = window.socketInstance;
          if (socket && socket.connected) {
            console.log('📡 Notifying server about logout via Socket.IO');
            socket.emit('logout', { profileId });
            // Give a small delay for the server to process
            await new Promise(resolve => setTimeout(resolve, 50));
            socket.disconnect();
          }
        }
        
        // Call backend logout endpoint
        await fetch('http://localhost:5000/api/auth/logout', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });
        
        console.log('✅ Logout completed');
      } catch (error) {
        console.error('Logout error:', error);
      } finally {
        // Always clear local data
        localStorage.clear();
        sessionStorage.clear();
      }
    };

    // Handle browser back button from friends page
    const handlePopState = (event) => {
      const currentPath = window.location.pathname;
      const token = localStorage.getItem('token');
      
      // If user goes back from friends page and is authenticated, logout
      if (token && (currentPath === '/login' || currentPath === '/signup')) {
        // Clear local data immediately to prevent auth issues
        localStorage.clear();
        sessionStorage.clear();
        
        // Try to logout from server, but don't wait for it
        performLogout().catch(error => {
          console.log('Logout request failed (server might be restarting):', error);
        });
        
        // Redirect to login to prevent access to auth pages while logged in
        window.location.href = '/login';
      }
    };

    // Handle tab/browser close
    const handleBeforeUnload = (event) => {
      console.log('🚪 Browser/tab closing detected');
      
      // Clear local storage first to prevent auth issues
      const profileId = localStorage.getItem('profileId');
      localStorage.clear();
      sessionStorage.clear();
      
      // Try to notify server, but don't let it block the page unload
      if (profileId && window.socketInstance) {
        try {
          window.socketInstance.emit('logout', { profileId });
          console.log('📡 Logout notification sent via Socket.IO');
        } catch (error) {
          console.error('Error sending logout notification:', error);
        }
      }
      
      // Send synchronous logout request to backend (with timeout)
      if (profileId) {
        try {
          const xhr = new XMLHttpRequest();
          xhr.timeout = 500; // 500ms timeout to prevent hanging
          xhr.open('POST', 'http://localhost:5000/api/auth/logout', false);
          xhr.setRequestHeader('Content-Type', 'application/json');
          xhr.withCredentials = true;
          xhr.send(JSON.stringify({}));
          console.log('📡 Synchronous logout request sent');
        } catch (error) {
          console.error('Error sending synchronous logout (server might be down):', error);
        }
      }
    };

    // Handle visibility change (tab switching)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        const token = localStorage.getItem('token');
        if (token) {
          // Verify session is still valid
          fetch('http://localhost:5000/api/user', {
            method: 'GET',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
          }).then(response => {
            if (!response.ok) {
              // Session invalid, logout
              performLogout();
              window.location.href = '/login';
            }
          }).catch(() => {
            // Network error, logout
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
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/setup-username" element={<UsernameSetup />} />
          <Route
            path="/friends"
            element={<PrivateRoute element={<FriendsPage />} />}
          />  {/* Protected route for friends page (default) */}
          <Route
            path="/global-search"
            element={<PrivateRoute element={<GlobalSearch />} />}
          />  {/* Protected route for global search */}
          <Route path="/" element={<Navigate to="/friends" replace />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;
