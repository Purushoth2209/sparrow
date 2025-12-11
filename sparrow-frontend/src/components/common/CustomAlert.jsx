import React from 'react';
import { Modal, Button } from 'react-bootstrap';

const CustomAlert = ({ 
  show, 
  title, 
  message, 
  confirmText = 'Yes', 
  cancelText = 'Cancel',
  variant = 'danger',
  onConfirm, 
  onCancel 
}) => {
  const getConfirmButtonStyle = () => {
    switch (variant) {
      case 'danger':
        return {
          backgroundColor: 'var(--error-color)',
          borderColor: 'var(--error-color)',
          color: 'white'
        };
      case 'warning':
        return {
          backgroundColor: 'var(--warning-color)',
          borderColor: 'var(--warning-color)',
          color: 'white'
        };
      default:
        return {
          backgroundColor: 'var(--brand-primary)',
          borderColor: 'var(--brand-primary)',
          color: 'white'
        };
    }
  };

  return (
    <Modal show={show} onHide={onCancel} centered backdrop="static" className="custom-alert-modal">
      <Modal.Header closeButton className="border-0" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <Modal.Title style={{ color: `var(--${variant}-color)` }}>
          {title}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body className="py-3" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <p className="mb-0" style={{ color: 'var(--text-primary)' }}>
          {message}
        </p>
      </Modal.Body>
      <Modal.Footer className="border-0" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <Button 
          variant="outline-secondary" 
          onClick={onCancel}
          className="me-2"
          style={{
            borderColor: 'var(--border-medium)',
            color: 'var(--text-secondary)'
          }}
        >
          {cancelText}
        </Button>
        <Button 
          onClick={onConfirm}
          style={getConfirmButtonStyle()}
          className="custom-confirm-btn"
        >
          {confirmText}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default CustomAlert;
