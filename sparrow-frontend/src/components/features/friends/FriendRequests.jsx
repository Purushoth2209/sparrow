import React, { useState, useEffect } from 'react';
import { Modal, ListGroup, Button, Spinner, Alert } from 'react-bootstrap';
import { friendsApi } from '../../../services/api/friends.api';

const FriendRequests = ({ show, onHide, onRequestHandled }) => {
  const [friendRequests, setFriendRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionStatus, setActionStatus] = useState({}); // Track action status per request

  useEffect(() => {
    if (show) {
      fetchFriendRequests();
    }
  }, [show]);

  const fetchFriendRequests = async () => {
    setLoading(true);
    setError('');
    
    try {
      const data = await friendsApi.getFriendRequests();
      
      if (data.success) {
        setFriendRequests(data.friendRequests);
      } else {
        setError(data.message || 'Failed to fetch friend requests');
      }
    } catch (error) {
      console.error('Error fetching friend requests:', error);
      setError('Failed to fetch friend requests');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptRequest = async (fromUserId) => {
    try {
      setActionStatus(prev => ({ ...prev, [fromUserId]: 'accepting' }));
      
      const data = await friendsApi.acceptFriendRequest(fromUserId);
      
      if (data.success) {
        // Remove the accepted request from the list
        setFriendRequests(prev => 
          prev.filter(request => request.fromUserId !== fromUserId)
        );
        setActionStatus(prev => ({ ...prev, [fromUserId]: 'accepted' }));
        
        if (onRequestHandled) {
          onRequestHandled();
        }
      } else {
        setError(data.message || 'Failed to accept friend request');
        setActionStatus(prev => ({ ...prev, [fromUserId]: 'error' }));
      }
    } catch (error) {
      console.error('Error accepting friend request:', error);
      setError(error.response?.data?.message || 'Failed to accept friend request');
      setActionStatus(prev => ({ ...prev, [fromUserId]: 'error' }));
    }
  };

  const handleRejectRequest = async (fromUserId) => {
    try {
      setActionStatus(prev => ({ ...prev, [fromUserId]: 'rejecting' }));
      
      const data = await friendsApi.rejectFriendRequest(fromUserId);
      
      if (data.success) {
        // Remove the rejected request from the list
        setFriendRequests(prev => 
          prev.filter(request => request.fromUserId !== fromUserId)
        );
        setActionStatus(prev => ({ ...prev, [fromUserId]: 'rejected' }));
      } else {
        setError(data.message || 'Failed to reject friend request');
        setActionStatus(prev => ({ ...prev, [fromUserId]: 'error' }));
      }
    } catch (error) {
      console.error('Error rejecting friend request:', error);
      setError(error.response?.data?.message || 'Failed to reject friend request');
      setActionStatus(prev => ({ ...prev, [fromUserId]: 'error' }));
    }
  };

  const getActionButtons = (request) => {
    const status = actionStatus[request.fromUserId];
    
    if (status === 'accepting' || status === 'rejecting') {
      return (
        <Button size="sm" disabled>
          <Spinner animation="border" size="sm" className="me-1" />
          {status === 'accepting' ? 'Accepting...' : 'Rejecting...'}
        </Button>
      );
    }
    
    if (status === 'error') {
      return (
        <div>
          <Button 
            size="sm" 
            variant="primary"
            onClick={() => handleAcceptRequest(request.fromUserId)}
            className="me-2"
          >
            Retry Accept
          </Button>
          <Button 
            size="sm" 
            variant="primary"
            onClick={() => handleRejectRequest(request.fromUserId)}
          >
            Retry Reject
          </Button>
        </div>
      );
    }
    
    return (
      <div>
        <Button 
          size="sm" 
          variant="primary"
          onClick={() => handleAcceptRequest(request.fromUserId)}
          className="me-2"
        >
          Accept
        </Button>
        <Button 
          size="sm" 
          variant="primary"
          onClick={() => handleRejectRequest(request.fromUserId)}
        >
          Reject
        </Button>
      </div>
    );
  };

  const handleClose = () => {
    setFriendRequests([]);
    setError('');
    setActionStatus({});
    onHide();
  };

  return (
    <Modal show={show} onHide={handleClose} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Friend Requests</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && (
          <Alert variant="danger" onClose={() => setError('')} dismissible>
            {error}
          </Alert>
        )}

        {loading && (
          <div className="text-center">
            <Spinner animation="border" />
            <p>Loading friend requests...</p>
          </div>
        )}

        {!loading && friendRequests.length === 0 && (
          <div className="text-center text-muted">
            <p>No pending friend requests</p>
          </div>
        )}

        {!loading && friendRequests.length > 0 && (
          <div>
            <h6>Pending Requests ({friendRequests.length}):</h6>
            <ListGroup>
              {friendRequests.map((request) => (
                <ListGroup.Item
                  key={request.requestId}
                  className="d-flex justify-content-between align-items-center"
                >
                  <div className="d-flex align-items-center">
                    <div className="me-3">
                      {request.profileImage ? (
                        <img
                          src={request.profileImage}
                          alt={request.username}
                          className="rounded-circle"
                          style={{ width: '50px', height: '50px', objectFit: 'cover' }}
                        />
                      ) : (
                        <div
                          className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center"
                          style={{ width: '50px', height: '50px' }}
                        >
                          {request.username.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="fw-bold">{request.username}</div>
                      {request.fullName && (
                        <div className="text-muted small">{request.fullName}</div>
                      )}
                      <div className="text-muted small">
                        Request sent: {new Date(request.timestamp).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div>
                    {getActionButtons(request)}
                  </div>
                </ListGroup.Item>
              ))}
            </ListGroup>
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="primary" onClick={handleClose}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default FriendRequests;