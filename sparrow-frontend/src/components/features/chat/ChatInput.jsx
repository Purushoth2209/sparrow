import React, { useState } from 'react';
import { Form, Button } from 'react-bootstrap';

const ChatInput = ({ onSendMessage }) => {
  const [message, setMessage] = useState('');

  const handleSend = () => {
    if (message.trim()) {
      onSendMessage(message);
      setMessage('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  return (
    <div className="message-input-container">
      <div className="d-flex gap-2">
        <Form.Control
          type="text"
          placeholder="Type your message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          className="message-input flex-grow-1"
          style={{ fontSize: '16px' }} // Prevents zoom on iOS
        />
        <Button
          className="btn-modern-primary flex-shrink-0"
          onClick={handleSend}
          style={{ minWidth: '60px' }}
        >
          Send
        </Button>
      </div>
    </div>
  );
};

export default ChatInput;

