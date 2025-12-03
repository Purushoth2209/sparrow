const authService = require('../services/auth.service');
const identifierService = require('../services/identifier.service');
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
    const { password, username, fullName, country } = req.body;
    
    // Parse and normalize identifiers
    const { emailNormalized, phoneNormalized } = identifierService.parseIdentifier(req.body);

    // Validate required fields
    if ((!emailNormalized && !phoneNormalized) || !password || !username) {
      return errorResponse(res, 'Username, password, and an email or phone number are required', 400);
    }

    // Validate password
    const passwordValidation = authService.validatePassword(password);
    if (!passwordValidation.valid) {
      return errorResponse(res, passwordValidation.message, 400);
    }

    // Validate email if provided
    if (emailNormalized) {
      const emailValidation = await authService.validateEmail(emailNormalized);
      if (!emailValidation.valid) {
        return errorResponse(res, emailValidation.message, 400);
      }
    }

    // Validate phone if provided
    let finalPhoneNumber = phoneNormalized;
    if (phoneNormalized) {
      const phoneValidation = await authService.validatePhoneNumber(phoneNormalized, country);
      if (!phoneValidation.valid) {
        return errorResponse(res, phoneValidation.message, 400);
      }
      finalPhoneNumber = phoneValidation.normalized;
    }

    // Register user
    const user = await authService.registerUser({
      email: emailNormalized,
      phoneNumber: finalPhoneNumber,
      password,
      username,
      fullName
    });

    // Persist session
    try {
      await sessionService.saveSession(req, user);
      return res.status(201).json({
        success: true,
        user: req.session.user,
        message: 'Registration successful'
      });
    } catch (sessionError) {
      return errorResponse(res, 'Session save failed', 500);
    }
  } catch (error) {
    return errorResponse(res, error.message || 'Server error', 500);
  }
};

/**
 * Login user
 */
exports.loginUser = async (req, res) => {
  try {
    const { country } = req.body;

    // Validate credentials presence
    const validation = identifierService.validateLoginCredentials(req.body);
    if (!validation.isValid) {
      return errorResponse(res, 'Invalid credentials', 400);
    }

    // Parse identifiers
    const { identifierValue, emailRaw, phoneRaw } = identifierService.parseIdentifier(req.body);
    const { password } = req.body;

    // Attempt login
    const user = await authService.loginUser(identifierValue, emailRaw, phoneRaw, password, country);

    // Persist session and set cookie
    try {
      await sessionService.saveSession(req, user);
      sessionService.setSessionCookies(res, req.sessionID);

      return res.status(200).json({
        success: true,
        user: req.session.user,
        message: 'Login successful',
        passwordWarning: user.passwordWarning
      });
    } catch (sessionError) {
      return errorResponse(res, 'Session save failed', 500);
    }
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
    if (profileId) {
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
    }

    // Destroy session if exists
    if (req.session) {
      try {
        await sessionService.destroySession(req);
        sessionService.clearSessionCookies(res);
        return res.status(200).json({
          success: true,
          message: 'Logout successful'
        });
      } catch (destroyError) {
        return errorResponse(res, 'Logout failed', 500);
      }
    } else {
      sessionService.clearSessionCookies(res);
      return res.status(200).json({
        success: true,
        message: 'Logout successful'
      });
    }
  } catch (error) {
    return errorResponse(res, 'Server error', 500);
  }
};

/**
 * Set username for user
 */
exports.setUsername = async (req, res) => {
  try {
    const { username } = req.body;
    const profileId = req.session?.user?.profileId;

    if (!profileId) {
      return errorResponse(res, 'User not authenticated', 401);
    }

    if (!username || typeof username !== 'string' || username.trim().length < 3) {
      return errorResponse(res, 'Username must be at least 3 characters long', 400);
    }

    const user = await authService.setUsername(profileId, username);
    req.session.user.username = user.username;

    return res.status(200).json({
      success: true,
      message: 'Username set successfully',
      user: req.session.user
    });
  } catch (error) {
    return errorResponse(res, error.message || 'Server error', 500);
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
