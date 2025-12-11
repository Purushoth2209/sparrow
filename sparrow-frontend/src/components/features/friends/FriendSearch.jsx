import React from 'react';
import { Form } from 'react-bootstrap';

const FriendSearch = ({ searchQuery, onSearchChange, placeholder = '🔍 Search friends...' }) => {
  return (
    <Form.Group className="mb-3 flex-shrink-0">
      <Form.Control
        type="text"
        placeholder={placeholder}
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        className="search-input"
        style={{ fontSize: '16px' }} // Prevents zoom on iOS
      />
    </Form.Group>
  );
};

export default FriendSearch;

