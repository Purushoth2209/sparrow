import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from '../pages/LoginPage';
import SignupPage from '../pages/SignupPage';
import ChatPage from '../pages/ChatPage';
import GlobalSearch from '../components/features/friends/GlobalSearch';
import UsernameSetup from '../components/features/auth/UsernameSetup';
import { useAuth } from '../hooks/useAuth';
import NotFound from '../pages/NotFound';

// PrivateRoute Component to protect authenticated pages
const PrivateRoute = ({ element: Component, ...rest }) => {
  const { isAuthenticated, isCheckingAuth } = useAuth();

  if (isCheckingAuth) {
    return (
      <div className="auth-loading-container">
        <div className="auth-loading-content">
          <div className="spinner-border auth-spinner" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="auth-loading-text">Verifying authentication...</p>
        </div>
      </div>
    );
  }

  return isAuthenticated ? Component : <Navigate to="/login" replace />;
};

export const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/setup-username" element={<UsernameSetup />} />
      <Route
        path="/friends"
        element={<PrivateRoute element={<ChatPage />} />}
      />
      <Route
        path="/global-search"
        element={<PrivateRoute element={<GlobalSearch />} />}
      />
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

