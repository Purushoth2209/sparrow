/**
 * Session Service
 * Handles all session operations: save, destroy, and cookie management
 */

/**
 * Build user session object from user data
 * @param {Object} user - User object from service
 * @returns {Object} Session user object
 */
function buildSessionUser(user) {
  return {
    profileId: user.profileId,
    username: user.username,
    email: user.email,
    phoneNumber: user.phoneNumber,
    fullName: user.fullName,
    profileImage: user.profileImage,
  };
}

/**
 * Save user session
 * @param {Object} req - Express request object
 * @param {Object} user - User object to store in session
 * @returns {Promise<void>}
 */
function saveSession(req, user) {
  return new Promise((resolve, reject) => {
    const sessionUser = buildSessionUser(user);
    req.session.user = sessionUser;
    req.session.touch();
    req.session.save((err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Destroy user session
 * @param {Object} req - Express request object
 * @returns {Promise<void>}
 */
function destroySession(req) {
  return new Promise((resolve, reject) => {
    if (!req.session) {
      resolve();
      return;
    }
    
    req.session.destroy((err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Set session cookie for login
 * @param {Object} res - Express response object
 * @param {string} sessionID - Session ID
 */
function setSessionCookies(res, sessionID) {
  res.clearCookie('sparrow.sid');
  res.cookie('sparrow.sid', sessionID, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

/**
 * Clear session cookies
 * @param {Object} res - Express response object
 */
function clearSessionCookies(res) {
  res.clearCookie('connect.sid');
  res.clearCookie('sparrow.sid');
}

module.exports = {
  buildSessionUser,
  saveSession,
  destroySession,
  setSessionCookies,
  clearSessionCookies
};

