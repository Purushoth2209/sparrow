import React from 'react';

const MessageStatus = ({ status, timestamp }) => {
  const getStatusIcon = () => {
    switch (status) {
      case 'sending':
        return '⏳'; // Clock icon for sending
      case 'sent':
        return '✓'; // Single tick (gray)
      case 'delivered':
        return '✓✓'; // Double tick (gray)
      case 'read':
        return '✓✓'; // Double tick (blue)
      default:
        return '✓';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'sending':
        return 'var(--message-sending-color)'; // Brand orange
      case 'sent':
        return 'var(--message-sent-color)'; // Brand gray
      case 'delivered':
        return 'var(--message-delivered-color)'; // Brand gray
      case 'read':
        return 'var(--message-read-color)'; // Brand green
      default:
        return 'var(--message-sent-color)';
    }
  };

  return (
    <span 
      style={{ 
        color: getStatusColor(),
        fontSize: '18px',
        marginLeft: '8px',
        fontWeight: 'bold',
        opacity: 1,
        textShadow: status === 'read' ? '0 0 3px rgba(5, 150, 105, 0.4)' : 'none',
        display: 'inline-block',
        minWidth: '24px',
        textAlign: 'center',
        filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.1))'
      }}
    >
      {getStatusIcon()}
    </span>
  );
};

export default MessageStatus;
