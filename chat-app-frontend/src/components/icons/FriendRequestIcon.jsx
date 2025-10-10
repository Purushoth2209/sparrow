import React from 'react';

const FriendRequestIcon = ({ size = 24, color = "#666666" }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <path 
      d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 6.5V9C15 10.66 13.66 12 12 12S9 10.66 9 9V6.5L3 7V9L9 8.5V9C9 11.76 10.79 13.66 13 14.12V16H11V18H13V20H15V18H17V16H15V14.12C17.21 13.66 19 11.76 19 9V8.5L21 9Z" 
      fill={color}
    />
  </svg>
);

export default FriendRequestIcon;
