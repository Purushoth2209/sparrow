import React from 'react';
import { Navigate } from 'react-router-dom';
import Cookies from 'js-cookie';

const PrivateRoute = ({ component: Component }) => {
  const isAuthenticated = localStorage.getItem('token') || sessionStorage.getItem('token') || Cookies.get('jwtToken');

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Component />;
};

export default PrivateRoute;
