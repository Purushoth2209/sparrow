import React, { useState, useEffect } from 'react';
import { Alert } from 'react-bootstrap';
import './Toast.css';

const Toast = ({ message, type = 'info', duration = 5000, onClose }) => {
  const [show, setShow] = useState(true);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        setShow(false);
        if (onClose) {
          setTimeout(onClose, 300); // Wait for fade out
        }
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const handleClose = () => {
    setShow(false);
    if (onClose) {
      setTimeout(onClose, 300);
    }
  };

  if (!show) return null;

  const variantMap = {
    success: 'success',
    error: 'danger',
    warning: 'warning',
    info: 'info',
  };

  return (
    <Alert
      variant={variantMap[type] || 'info'}
      dismissible
      onClose={handleClose}
      className="toast-alert"
    >
      {message}
    </Alert>
  );
};

export default Toast;

