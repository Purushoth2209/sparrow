// Centralized Error Handling Service

export class AppError extends Error {
  constructor(message, code = 'UNKNOWN_ERROR', statusCode = null, details = null) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export const handleApiError = (error) => {
  // Handle axios errors
  if (error.response) {
    const { status, data } = error.response;
    
    switch (status) {
      case 400:
        return new AppError(
          data.message || 'Invalid request',
          'BAD_REQUEST',
          400,
          data
        );
      case 401:
        return new AppError(
          'Session expired. Please login again.',
          'UNAUTHORIZED',
          401
        );
      case 403:
        return new AppError(
          data.message || 'Access forbidden',
          'FORBIDDEN',
          403
        );
      case 404:
        return new AppError(
          data.message || 'Resource not found',
          'NOT_FOUND',
          404
        );
      case 409:
        return new AppError(
          data.message || 'Conflict occurred',
          'CONFLICT',
          409
        );
      case 422:
        return new AppError(
          data.message || 'Validation error',
          'VALIDATION_ERROR',
          422,
          data.errors
        );
      case 429:
        return new AppError(
          'Too many requests. Please try again later.',
          'RATE_LIMIT',
          429
        );
      case 500:
      case 502:
      case 503:
        return new AppError(
          'Server error. Please try again later.',
          'SERVER_ERROR',
          status
        );
      default:
        return new AppError(
          data.message || 'An error occurred',
          'API_ERROR',
          status
        );
    }
  }
  
  // Handle network errors
  if (error.request) {
    return new AppError(
      'Network error. Please check your connection.',
      'NETWORK_ERROR'
    );
  }
  
  // Handle other errors
  if (error instanceof AppError) {
    return error;
  }
  
  return new AppError(
    error.message || 'An unexpected error occurred',
    'UNKNOWN_ERROR'
  );
};

export const getErrorMessage = (error) => {
  if (error instanceof AppError) {
    return error.message;
  }
  if (error.response?.data?.message) {
    return error.response.data.message;
  }
  if (error.message) {
    return error.message;
  }
  return 'An unexpected error occurred';
};

export const getErrorCode = (error) => {
  if (error instanceof AppError) {
    return error.code;
  }
  if (error.response?.status) {
    return `HTTP_${error.response.status}`;
  }
  return 'UNKNOWN_ERROR';
};

