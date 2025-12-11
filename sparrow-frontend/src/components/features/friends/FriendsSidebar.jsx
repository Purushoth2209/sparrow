import React from 'react';
import { Container, Row, Col, Alert, Spinner, Button } from 'react-bootstrap';
import FriendSearch from './FriendSearch';
import FriendItem from './FriendItem';
import UserSearchIcon from './icons/UserSearchIcon';
import { useNavigate } from 'react-router-dom';

const FriendsSidebar = ({
  friends,
  searchQuery,
  onSearchChange,
  onFriendSelect,
  activeFriendId,
  loading,
  error,
  showChatView,
}) => {
  const navigate = useNavigate();

  return (
    <Col xs={12} md={4} className={`friends-list-container ${showChatView ? 'd-none d-md-block' : ''}`}>
      <div className="p-3 h-100 d-flex flex-column">
        <FriendSearch
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
        />

        {error && (
          <Alert variant="danger" onClose={() => {}} dismissible className="flex-shrink-0">
            {error}
          </Alert>
        )}

        {loading && (
          <div className="text-center py-4 flex-shrink-0">
            <Spinner animation="border" />
            <p className="mt-2">Loading friends...</p>
          </div>
        )}

        <div className="friends-list">
          {friends.length > 0 ? (
            <div>
              {friends.map((friend) => (
                <FriendItem
                  key={friend.profileId}
                  friend={friend}
                  isActive={activeFriendId === friend.profileId}
                  onClick={() => onFriendSelect(friend)}
                />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">👥</div>
              <div className="empty-state-title">
                {searchQuery ? `No friends found matching "${searchQuery}"` : 'No friends yet'}
              </div>
              <div className="empty-state-description">
                {searchQuery ? 'Try searching with a different term' : 'Start building your network by finding friends'}
              </div>
              <Button
                className="btn-modern-primary mt-3"
                onClick={() => navigate('/global-search')}
              >
                <UserSearchIcon size={16} className="me-1" />
                Find Friends
              </Button>
            </div>
          )}
        </div>
      </div>
    </Col>
  );
};

export default FriendsSidebar;

