import React from 'react';
import { Form } from 'react-bootstrap';

/**
 * ConversationSearch Component
 * Search input for filtering conversations
 */
const ConversationSearch = ({ 
  searchQuery, 
  onSearchChange, 
  placeholder = '🔍 Search conversations...' 
}) => {
  return (
    <Form.Group className="mb-3">
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

export default ConversationSearch;

