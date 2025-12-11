import React from 'react';

const UserSearchIcon = ({ size = 24, color = "#666666" }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <path 
      d="M15.5 14H14.71L14.43 13.73C15.41 12.59 16 11.11 16 9.5C16 5.91 12.59 2.5 9 2.5S2 5.91 2 9.5C2 13.09 5.41 16.5 9 16.5C10.61 16.5 12.09 15.91 13.23 14.93L13.5 15.29L15.5 14Z" 
      fill={color}
    />
    <path 
      d="M20.5 19L15.5 14L20.5 19Z" 
      fill={color}
    />
  </svg>
);

export default UserSearchIcon;
