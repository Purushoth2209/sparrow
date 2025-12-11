import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from 'react-bootstrap';

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <div className="d-flex align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
      <div className="text-center">
        <h1>404</h1>
        <p>Page not found</p>
        <Button onClick={() => navigate('/login')}>Go to Login</Button>
      </div>
    </div>
  );
};

export default NotFound;

