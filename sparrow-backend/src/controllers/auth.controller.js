const authService = require('../services/auth.service');
const { userSockets, io: getIO } = require('../socket');

/**
 * Auth Controller
 * Handles HTTP request/response for authentication
 */

exports.checkUsername = async (req, res) => {
  try {
    const { username } = req.query;
    const result = await authService.checkUsernameAvailability(username);
    return res.status(result.available ? 200 : 200).json(result);
  } catch (error) {
    return res.status(500).json({ available: false, message: 'Server error', suggestions: [] });
  }
};

exports.registerUser = async (req, res) => {
  try {
    const { identifier, email, phoneNumber, password, username, fullName, country } = req.body;

    const idRaw = typeof identifier === 'string' ? identifier.trim() : undefined;
    let emailNormalized = typeof email === 'string' ? email.trim().toLowerCase() : undefined;
    let phoneNormalized = typeof phoneNumber === 'string' ? phoneNumber.trim() : undefined;

    if (!emailNormalized && !phoneNormalized && idRaw) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (emailRegex.test(idRaw.toLowerCase())) {
        emailNormalized = idRaw.toLowerCase();
      } else {
        phoneNormalized = idRaw;
      }
    }

    if ((!emailNormalized && !phoneNormalized) || !password || !username) {
      return res.status(400).json({ message: 'Username, password, and an email or phone number are required' });
    }

    const passwordValidation = authService.validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ message: passwordValidation.message });
    }

    if (emailNormalized) {
      const emailValidation = await authService.validateEmail(emailNormalized);
      if (!emailValidation.valid) {
        return res.status(400).json({ message: emailValidation.message });
      }
    }

    if (phoneNormalized) {
      const phoneValidation = await authService.validatePhoneNumber(phoneNormalized, country);
      if (!phoneValidation.valid) {
        return res.status(400).json({ message: phoneValidation.message });
      }
      phoneNormalized = phoneValidation.normalized;
    }

    const user = await authService.registerUser({
      email: emailNormalized,
      phoneNumber: phoneNormalized,
      password,
      username,
      fullName
    });

    req.session.user = user;
    req.session.touch();
    req.session.save((err) => {
      if (err) {
        console.error('❌ Session save error:', err);
        return res.status(500).json({ message: 'Session save failed' });
      }

      console.log('✅ Session persisted successfully for:', user.username);
      
      res.status(201).json({ 
        success: true,
        user: req.session.user,
        message: 'Registration successful' 
      });
    });
  } catch (error) {
    console.error('❌ Registration error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

exports.loginUser = async (req, res) => {
  try {
    const { identifier, email, phoneNumber, password, country } = req.body;

    const hasValidIdentifier = identifier && identifier.trim().length > 0;
    const hasValidEmail = email && email.trim().length > 0;
    const hasValidPhone = phoneNumber && phoneNumber.trim().length > 0;
    const hasValidPassword = password && password.trim().length > 0;

    if (!hasValidPassword || (!hasValidIdentifier && !hasValidEmail && !hasValidPhone)) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const idRaw = typeof identifier === 'string' ? identifier.trim() : undefined;
    const emailRaw = typeof email === 'string' ? email.trim().toLowerCase() : undefined;
    const phoneRaw = typeof phoneNumber === 'string' ? phoneNumber.trim() : undefined;

    const user = await authService.loginUser(idRaw || emailRaw || phoneRaw, emailRaw, phoneRaw, password, country);

    req.session.user = {
      profileId: user.profileId,
      username: user.username,
      email: user.email,
      phoneNumber: user.phoneNumber,
      fullName: user.fullName,
      profileImage: user.profileImage,
    };

    req.session.touch();
    req.session.save((err) => {
      if (err) {
        console.error('❌ Session save error:', err);
        return res.status(500).json({ message: 'Session save failed' });
      }

      console.log('✅ Session persisted successfully for:', user.username);
      
      res.clearCookie('sparrow.sid');
      res.cookie('sparrow.sid', req.sessionID, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
      
      res.status(200).json({
        success: true,
        user: req.session.user,
        message: 'Login successful',
        passwordWarning: user.passwordWarning
      });
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    if (error.message.includes('locked')) {
      return res.status(423).json({ message: error.message });
    }
    res.status(400).json({ message: error.message || 'Server error' });
  }
};

exports.logoutUser = async (req, res) => {
  try {
    const profileId = req.session?.user?.profileId || req.body?.profileId;

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

    if (req.session) {
      req.session.destroy((err) => {
        if (err) {
          console.error('❌ Session destroy error:', err);
          return res.status(500).json({ 
            success: false, 
            message: 'Logout failed' 
          });
        }

        res.clearCookie('connect.sid');
        res.clearCookie('sparrow.sid');
        
        res.status(200).json({ 
          success: true, 
          message: 'Logout successful' 
        });
      });
    } else {
      res.clearCookie('connect.sid');
      res.clearCookie('sparrow.sid');
      
      res.status(200).json({ 
        success: true, 
        message: 'Logout successful' 
      });
    }
  } catch (error) {
    console.error('❌ Logout error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

exports.googleLogin = async (req, res) => {
  try {
    const authorizationUrl = await authService.initiateGoogleLogin(req);
    console.log('🔐 Redirecting to Google for authentication...');
    res.redirect(authorizationUrl);
  } catch (error) {
    console.error('❌ Google login initiation failed:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to initiate Google login' 
    });
  }
};

exports.googleCallback = async (req, res) => {
  try {
    const user = await authService.handleGoogleCallback(req);

    req.session.user = {
      profileId: user.profileId,
      username: user.username,
      email: user.email,
      phoneNumber: user.phoneNumber,
      fullName: user.fullName,
      profileImage: user.profileImage,
    };

    delete req.session.oidcState;
    delete req.session.oidcNonce;

    req.session.touch();
    req.session.save((err) => {
      if (err) {
        console.error('❌ Session save error:', err);
        return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=session_failed`);
      }

      if (user.needsUsernameSetup) {
        res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/setup-username`);
      } else {
        res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/friends`);
      }
    });
  } catch (error) {
    console.error('❌ Google callback failed:', error);
    delete req.session.oidcState;
    delete req.session.oidcNonce;
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=auth_failed`);
  }
};

exports.setUsername = async (req, res) => {
  try {
    const { username } = req.body;
    const profileId = req.session?.user?.profileId;

    if (!profileId) {
      return res.status(401).json({ 
        success: false, 
        message: 'User not authenticated' 
      });
    }

    if (!username || typeof username !== 'string' || username.trim().length < 3) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username must be at least 3 characters long' 
      });
    }

    const user = await authService.setUsername(profileId, username);
    req.session.user.username = user.username;

    res.json({ 
      success: true, 
      message: 'Username set successfully',
      user: req.session.user
    });
  } catch (error) {
    console.error('❌ Set username error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Server error' 
    });
  }
};

exports.getCurrentUser = (req, res) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      error: 'User not found in request' 
    });
  }
  
  res.json({ 
    success: true, 
    user: req.user 
  });
};

exports.debugSession = (req, res) => {
  res.json({
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

