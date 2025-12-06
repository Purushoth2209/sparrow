const authService = require('../services/auth.service');
const sessionService = require('../services/session.service');
const { userSockets, io: getIO } = require('../socket');
const { errorResponse } = require('../utils/response');

/**
 * Auth Controller
 * Handles HTTP request/response for web session-based authentication
 */

/**
 * Check username availability
 */
exports.checkUsername = async (req, res) => {
  try {
    const { username } = req.query;
    const result = await authService.checkUsernameAvailability(username);
    return res.status(200).json(result);
  } catch (error) {
    // Maintain original response format for this endpoint
    return res.status(500).json({ available: false, message: 'Server error', suggestions: [] });
  }
};

/**
 * Register new user
 */
exports.registerUser = async (req, res) => {
  try {
    const { password, username, fullName, email } = req.body;
    
    // Register user - all validation and logic in service
    const user = await authService.registerUser({
      email,
      password,
      username,
      fullName
    });

    // Persist session
    await sessionService.saveSession(req, user);
    return res.status(201).json({
      success: true,
      user: req.session.user,
      message: 'Registration successful'
    });
  } catch (error) {
    const statusCode = error.message.includes('required') || error.message.includes('Invalid') || error.message.includes('already exists') ? 400 : 500;
    return errorResponse(res, error.message || 'Server error', statusCode);
  }
};

/**
 * Login user
 */
exports.loginUser = async (req, res) => {
  try {
    const { identifier, email, phoneNumber, password, country } = req.body;

    // All validation and logic in service
    const user = await authService.loginUser(identifier, email, phoneNumber, password, country);

    // Persist session and set cookie
    await sessionService.saveSession(req, user);
    sessionService.setSessionCookies(res, req.sessionID);

    return res.status(200).json({
      success: true,
      user: req.session.user,
      message: 'Login successful',
      passwordWarning: user.passwordWarning
    });
  } catch (error) {
    // Handle account lockout (423 status)
    if (error.message && error.message.includes('locked')) {
      return errorResponse(res, error.message, 423);
    }
    return errorResponse(res, error.message || 'Server error', 400);
  }
};

/**
 * Logout user
 */
exports.logoutUser = async (req, res) => {
  try {
    const profileId = req.session?.user?.profileId || req.body?.profileId;

    // Disconnect socket if connected
    const disconnectSocket = (profileId) => {
      if (!profileId) return;
      const socketId = userSockets.get(profileId);
      if (socketId) {
        const socketIO = getIO();
        if (socketIO) {
          const socket = socketIO.sockets.sockets.get(socketId);
          if (socket) {
            socket.disconnect();
          }
        }
        userSockets.delete(profileId);
      }
    };

    // All logic in service
    await authService.logoutUser(profileId, disconnectSocket);

    // Destroy session if exists
    if (req.session) {
      await sessionService.destroySession(req);
    }
    sessionService.clearSessionCookies(res);

    return res.status(200).json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    return errorResponse(res, error.message || 'Server error', 500);
  }
};

/**
 * Set username for user
 */
exports.setUsername = async (req, res) => {
  try {
    const { username } = req.body;
    const profileId = req.session?.user?.profileId;

    // All validation and logic in service
    const user = await authService.setUsername(profileId, username);
    req.session.user.username = user.username;

    return res.status(200).json({
      success: true,
      message: 'Username set successfully',
      user: req.session.user
    });
  } catch (error) {
    const statusCode = error.message.includes('not authenticated') ? 401 : 
                      error.message.includes('must be') || error.message.includes('already taken') ? 400 : 500;
    return errorResponse(res, error.message || 'Server error', statusCode);
  }
};

/**
 * Get current authenticated user
 */
exports.getCurrentUser = (req, res) => {
  if (!req.user) {
    return errorResponse(res, 'User not found in request', 401);
  }

  return res.status(200).json({
    success: true,
    user: req.user
  });
};

/**
 * Debug session information
 */
exports.debugSession = (req, res) => {
  return res.status(200).json({
    success: true,
    debug: {
      sessionID: req.sessionID,
      sessionExists: !!req.session,
      hasUser: !!req.session?.user,
      user: req.session?.user || null,
      cookies: req.headers.cookie,
      parsedCookies: req.cookies,
      sessionKeys: req.session ? Object.keys(req.session) : [],
      timestamp: new Date().toISOString()
    }
  });
};
