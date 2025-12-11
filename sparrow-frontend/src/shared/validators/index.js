// Shared validation functions (compatible with React Native)

export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.toLowerCase());
};

export const validateUsername = (username) => {
  // Username: 3-20 chars, alphanumeric and underscore only
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
  return usernameRegex.test(username);
};

export const validatePassword = (password) => {
  // Password: at least 6 characters
  return password && password.length >= 6;
};

export const validatePhoneNumber = (phone) => {
  // Basic phone validation (can be enhanced)
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
};

export const sanitizeInput = (input) => {
  if (typeof input !== 'string') return '';
  return input.trim().replace(/[<>]/g, '');
};

