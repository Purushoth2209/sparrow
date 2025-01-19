import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import LeftBar from './LeftBar';
import RightBar from './RightBar';
import { Container, Row, Col } from 'react-bootstrap';
import '../styles/chat/chat.css';

function useLogout() {
  const navigate = useNavigate();

  const handleLogout = useCallback(() => {
    // Clear token from localStorage or cookies
    localStorage.removeItem('token');
    navigate('/login');
  }, [navigate]);

  return handleLogout;
}

function Chat() {
  const [contacts, setContacts] = useState([]);
  const [messages, setMessages] = useState([]);
  const [currentContact, setCurrentContact] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [contactSearchResults, setContactSearchResults] = useState([]);

  useEffect(() => {
    // Clean up token on unmount
    return () => {
      localStorage.removeItem('token');
    };
  }, []);

  return (
    <Container fluid className="chat-container">
      <Row className="chat-row">
        <Col xs={3} className="leftbar">
          <LeftBar 
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            setContactSearchResults={setContactSearchResults} 
            contactSearchResults={contactSearchResults} 
            setContacts={setContacts}
            setCurrentContact={setCurrentContact}
          />
        </Col>
        <Col xs={9} className="rightbar">
          <RightBar 
            currentContact={currentContact} 
            messages={messages} 
            setMessages={setMessages} 
            setCurrentContact={setCurrentContact} 
          />
        </Col>
      </Row>
    </Container>
  );
}

export default Chat;
