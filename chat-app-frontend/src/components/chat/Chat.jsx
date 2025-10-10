import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import LeftBar from './LeftBar';
import RightBar from './RightBar';
import { Container, Row, Col } from 'react-bootstrap';
import '../styles/chat/chat.css';

function useLogout() {
  const navigate = useNavigate();

  const handleLogout = useCallback(async () => {
    try {
      const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
      
      // Call backend to destroy session
      await fetch(`${backendUrl}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include', // Send session cookie
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // Clear localStorage
      localStorage.clear();
      
      console.log('✅ Logout successful');
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
      // Even if backend fails, clear local data and redirect
      localStorage.clear();
      navigate('/login');
    }
  }, [navigate]);

  return handleLogout;
}

function Chat() {
  const [contacts, setContacts] = useState([]);
  const [messages, setMessages] = useState([]);
  const [currentContact, setCurrentContact] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [contactSearchResults, setContactSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user data exists in localStorage
    // If not (Google OAuth redirect), fetch from backend session
    const checkAuthAndFetchUser = async () => {
      const profileId = localStorage.getItem('profileId');
      
      if (!profileId) {
        // User might be coming from Google OAuth redirect
        // Try to fetch user data from backend session
        try {
          const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
          const response = await fetch(`${backendUrl}/api/user`, {
            method: 'GET',
            credentials: 'include', // Send session cookie
            headers: {
              'Content-Type': 'application/json',
            },
          });

          const data = await response.json();

          if (response.ok && data.success && data.user) {
            // Store user info in localStorage
            localStorage.setItem('profileId', data.user.profileId);
            localStorage.setItem('username', data.user.username);
            localStorage.setItem('email', data.user.email || '');
            localStorage.setItem('fullName', data.user.fullName || '');
            localStorage.setItem('profileImage', data.user.profileImage || '');
            localStorage.setItem('token', 'session-authenticated');
            
            // Connect to Socket.IO for real-time chat
            const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
            const socketInstance = io(backendUrl);
            socketInstance.emit('setUser', data.user.profileId);
            
            console.log('✅ Session verified, user data loaded');
            setIsLoading(false);
          } else {
            // Not authenticated, redirect to login
            console.log('❌ Session invalid, redirecting to login');
            navigate('/login');
          }
        } catch (error) {
          console.error('Failed to fetch user data:', error);
          navigate('/login');
        }
      } else {
        // User data already in localStorage
        setIsLoading(false);
      }
    };

    checkAuthAndFetchUser();

    // Clean up token on unmount
    return () => {
      localStorage.removeItem('token');
    };
  }, [navigate]);

  if (isLoading) {
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
        Loading...
      </div>
    );
  }

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
