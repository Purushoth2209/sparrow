import React, { useState, useEffect, useCallback } from 'react';
import io from 'socket.io-client';
import '../styles/chat/rightbar.css';
import logo from '../../Logo.png';

const socket = io('http://localhost:5000');

function RightBar({ currentContact, setCurrentContact }) {
  const [message, setMessage] = useState('');
  const [messagesByContact, setMessagesByContact] = useState({});
  
  useEffect(() => {
    const profileId = localStorage.getItem('profileId');
    if (profileId) {
      socket.emit('register', profileId);
    }
  }, []);

  const handleSendMessage = () => {
    if (!message.trim()) return;

    const senderId = localStorage.getItem('profileId');
    const receiverId = currentContact ? currentContact.profileId : null;

    if (!senderId || !receiverId) return;

    const localTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newMessage = { sender: 'User 1', content: message, senderId, receiverId, timestamp: localTime };

    setMessagesByContact((prev) => ({
      ...prev,
      [receiverId]: [...(prev[receiverId] || []), newMessage],
    }));

    socket.emit('sendMessage', { senderId, receiverId, content: message });
    setMessage('');
  };

  useEffect(() => {
    socket.on('receiveMessage', (message) => {
      const updatedMessage = { ...message, timestamp: message.timestamp };
      const { senderId } = updatedMessage;

      setMessagesByContact((prev) => ({
        ...prev,
        [senderId]: [...(prev[senderId] || []), updatedMessage],
      }));
    });

    return () => {
      socket.off('receiveMessage');
    };
  }, []);

  const handleEscapeKey = useCallback(
    (e) => {
      if (e.key === 'Escape') setCurrentContact(null);
    },
    [setCurrentContact]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleEscapeKey);
    return () => {
      window.removeEventListener('keydown', handleEscapeKey);
    };
  }, [handleEscapeKey]);

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  const currentMessages = currentContact ? messagesByContact[currentContact.profileId] || [] : [];

  return (
    <div className="rightbar-container">
      {currentContact ? (
        <>
          <h4 className="contact-name">{currentContact.username}</h4>
          <div className="messages-container">
            {currentMessages.map((msg, index) => (
              <div
                key={index}
                className={`message ${msg.sender === 'User 1' ? 'message-sent' : 'message-received'}`}
              >
                <div className="message-content">
                  {msg.content}
                  <span className="message-time">{msg.timestamp}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="message-input-container">
            <input
              type="text"
              placeholder="Type your message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              className="message-input"
            />
            <button onClick={handleSendMessage} className="send-message-btn">
              Send
            </button>
          </div>
        </>
      ) : (
        <div className="no-contact-selected">
          <img src={logo} alt="App Logo" className="rightbar-logo" />
          <p className="text-muted">Select a contact to start chatting.</p>
        </div>
      )}
    </div>
  );
}

export default RightBar;
