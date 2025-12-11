import React, { createContext, useContext, useState, useCallback } from 'react';
import Toast from '../components/common/Toast';

const ToastContext = createContext();

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'info', duration = 5000) => {
    const id = Date.now() + Math.random();
    const newToast = { id, message, type, duration };
    
    setToasts(prev => [...prev, newToast]);
    
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const showSuccess = useCallback((message, duration = 5000) => {
    return showToast(message, 'success', duration);
  }, [showToast]);

  const showError = useCallback((message, duration = 5000) => {
    return showToast(message, 'error', duration);
  }, [showToast]);

  const showWarning = useCallback((message, duration = 5000) => {
    return showToast(message, 'warning', duration);
  }, [showToast]);

  const showInfo = useCallback((message, duration = 5000) => {
    return showToast(message, 'info', duration);
  }, [showToast]);

  const value = {
    showToast,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    removeToast,
  };

  const ToastContainer = () => (
    <div className="toast-container">
      {toasts.map((toast, index) => (
        <div
          key={toast.id}
          style={{
            position: 'fixed',
            top: `${20 + index * 80}px`,
            right: '20px',
            zIndex: 9999 + index,
          }}
        >
          <Toast
            message={toast.message}
            type={toast.type}
            duration={toast.duration}
            onClose={() => removeToast(toast.id)}
          />
        </div>
      ))}
    </div>
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  );
};

