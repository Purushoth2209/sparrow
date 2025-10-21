require('dotenv').config(); // Import dotenv to load environment variables

const bcrypt = require('bcryptjs');
const dns = require('dns').promises;
const { parsePhoneNumberFromString } = require('libphonenumber-js');
const User = require('../models/User');
const { userSockets, io } = require('../socketio');

const MAX_LOGIN_ATTEMPTS = 5; // Maximum failed login attempts before lockout
const LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes lockout period

function generateUsernameSuggestions(baseUsername) {
    const suggestions = new Set();
    const normalized = String(baseUsername || '').toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (!normalized) return [];
    const baseCandidates = [normalized, `${normalized}_`, `${normalized}.`, `${normalized}_01`, `${normalized}_123`, `${normalized}${String(Date.now()).slice(-3)}`];
    baseCandidates.forEach(c => { if (c !== normalized) suggestions.add(c); });
    while (suggestions.size < 5) {
        suggestions.add(`${normalized}_${Math.floor(100 + Math.random() * 900)}`);
    }
    return Array.from(suggestions).slice(0, 5);
}

/**
 * Generate a unique username for Google OAuth users
 * @param {Object} userInfo - User information from Google
 * @returns {Promise<string>} - Unique username
 */
async function generateUniqueUsernameForGoogle(userInfo) {
    const { fullName, email, providerId } = userInfo;
    
    // Try different strategies to create a username
    const strategies = [];
    
    // Strategy 1: Use full name if available
    if (fullName) {
        const nameBased = fullName.toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .replace(/\s+/g, '_')
            .substring(0, 20);
        if (nameBased.length >= 3) {
            strategies.push(nameBased);
        }
    }
    
    // Strategy 2: Use email prefix
    if (email) {
        const emailPrefix = email.split('@')[0]
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '')
            .substring(0, 15);
        if (emailPrefix.length >= 3) {
            strategies.push(emailPrefix);
        }
    }
    
    // Strategy 3: Use provider ID with user prefix
    if (providerId) {
        strategies.push(`user_${providerId.substring(0, 8)}`);
    }
    
    // Strategy 4: Fallback with timestamp
    strategies.push(`user_${Date.now().toString().slice(-8)}`);
    
    // Try each strategy until we find a unique username
    for (const baseUsername of strategies) {
        let username = baseUsername;
        let counter = 1;
        
        while (true) {
            try {
                const existing = await User.findOne({ username });
                if (!existing) {
                    return username;
                }
                
                // If username exists, try with a number suffix
                username = `${baseUsername}_${counter}`;
                counter++;
                
                // Prevent infinite loop
                if (counter > 999) {
                    break;
                }
            } catch (error) {
                console.error('Error checking username uniqueness:', error);
                break;
            }
        }
    }
    
    // Ultimate fallback
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
}

exports.checkUsername = async (req, res) => {
    const { username } = req.query;
    if (!username || typeof username !== 'string') {
        return res.status(400).json({ available: false, message: 'Username is required', suggestions: [] });
    }
    try {
        const existing = await User.findOne({ username });
        if (existing) {
            return res.status(200).json({ available: false, message: 'Username is taken', suggestions: generateUsernameSuggestions(username) });
        }
        return res.status(200).json({ available: true, message: 'Username is available', suggestions: [] });
    } catch (error) {
        return res.status(500).json({ available: false, message: 'Server error', suggestions: [] });
    }
};

exports.registerUser = async (req, res) => {
    const { identifier, email, phoneNumber, password, username, fullName, country } = req.body;

    // Determine identifier source (prefer explicit email/phone if provided)
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

    // Require at least one of email or phoneNumber (derived from identifier)
    if ((!emailNormalized && !phoneNormalized) || !password || !username) {
        return res.status(400).json({ message: 'Username, password, and an email or phone number are required' });
    }

    // Strong password policy: 8+, upper, lower, digit, special char
    const strongPassword = typeof password === 'string' && /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,}$/.test(password);
    if (!strongPassword) {
        return res.status(400).json({ message: 'Password must be 8+ chars with upper, lower, number, and special char' });
    }

    // Email syntax + MX validation
    if (emailNormalized) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailNormalized)) {
            return res.status(400).json({ message: 'Invalid email format' });
        }
        const domain = emailNormalized.split('@')[1];
        try {
            const mxRecords = await dns.resolveMx(domain);
            if (!mxRecords || mxRecords.length === 0) {
                return res.status(400).json({ message: 'Email domain does not have valid MX records' });
            }
        } catch (e) {
            return res.status(400).json({ message: 'Email domain could not be validated (MX lookup failed)' });
        }
    }

    // E.164 phone normalization using libphonenumber-js
    if (phoneNormalized) {
        let defaultCountry = typeof country === 'string' ? country.toUpperCase() : undefined;
        if (!defaultCountry) {
            const al = String(req.headers['accept-language'] || '').split(',')[0];
            const match = /-([A-Z]{2})$/i.exec(al || '');
            if (match) defaultCountry = match[1].toUpperCase();
        }
        try {
            const parsed = parsePhoneNumberFromString(phoneNormalized, defaultCountry);
            if (!parsed || !parsed.isValid()) {
                return res.status(400).json({ message: 'Invalid phone number. Use international format or include country.' });
            }
            phoneNormalized = parsed.number; // E.164
        } catch (e) {
            return res.status(400).json({ message: 'Invalid phone number format' });
        }
    }

    try {
        // Ensure uniqueness for username, email, phone if provided
        const conflict = await User.findOne({
            $or: [
                ...(emailNormalized ? [{ email: emailNormalized }] : []),
                ...(phoneNormalized ? [{ phoneNumber: phoneNormalized }] : []),
                { username }
            ]
        });
        if (conflict) {
            const isEmail = emailNormalized && conflict.email === emailNormalized;
            const isPhone = phoneNormalized && conflict.phoneNumber === phoneNormalized;
            const which = isEmail ? 'email' : isPhone ? 'phone number' : 'username';
            return res.status(400).json({ message: `User with this ${which} already exists` });
        }

        const profileId = `user-${Date.now()}`;
        const hashedPassword = await bcrypt.hash(password, 10);

        const user = new User({
            fullName: typeof fullName === 'string' ? fullName.trim() : '',
            email: emailNormalized,
            phoneNumber: phoneNormalized,
            password: hashedPassword,
            profileId,
            username,
            passwordChangedAt: new Date() // Track password creation date
        });

        await user.save();

        // Create session (stateful authentication)
        req.session.user = {
            profileId: user.profileId,
            username: user.username,
            email: user.email || null,
            phoneNumber: user.phoneNumber || null,
            fullName: user.fullName || '',
            profileImage: user.profileImage || '',
        };

        console.log('✅ Registration successful, session created for:', user.username);

        // Explicitly tell express-session the session has been modified
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
        res.status(500).json({ message: 'Server error' });
    }
};

exports.loginUser = async (req, res) => {
    const { identifier, email, phoneNumber, password, country } = req.body;

    // Debug logging
    console.log('🔍 Login attempt - Request body:', req.body);
    console.log('🔍 Login attempt - Identifier:', identifier);
    console.log('🔍 Login attempt - Email:', email);
    console.log('🔍 Login attempt - PhoneNumber:', phoneNumber);
    console.log('🔍 Login attempt - Password present:', !!password);

    // Check for empty strings as well
    const hasValidIdentifier = identifier && identifier.trim().length > 0;
    const hasValidEmail = email && email.trim().length > 0;
    const hasValidPhone = phoneNumber && phoneNumber.trim().length > 0;
    const hasValidPassword = password && password.trim().length > 0;

    if (!hasValidPassword || (!hasValidIdentifier && !hasValidEmail && !hasValidPhone)) {
        console.log('❌ Login failed - Missing or empty credentials');
        return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Determine lookup field with validation and normalization
    const idRaw = typeof identifier === 'string' ? identifier.trim() : undefined;
    const emailRaw = typeof email === 'string' ? email.trim().toLowerCase() : undefined;
    const phoneRaw = typeof phoneNumber === 'string' ? phoneNumber.trim() : undefined;

    let query = null;
    try {
        if (emailRaw) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(emailRaw)) return res.status(400).json({ message: 'Invalid credentials' });
            query = { email: emailRaw };
        } else if (phoneRaw) {
            let defaultCountry = typeof country === 'string' ? country.toUpperCase() : undefined;
            if (!defaultCountry) {
                const al = String(req.headers['accept-language'] || '').split(',')[0];
                const match = /-([A-Z]{2})$/i.exec(al || '');
                if (match) defaultCountry = match[1].toUpperCase();
            }
            const parsed = parsePhoneNumberFromString(phoneRaw, defaultCountry);
            if (!parsed || !parsed.isValid()) return res.status(400).json({ message: 'Invalid credentials' });
            query = { phoneNumber: parsed.number };
        } else if (idRaw) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (emailRegex.test(idRaw.toLowerCase())) {
                query = { email: idRaw.toLowerCase() };
            } else {
                // Try phone, else treat as username
                let defaultCountry = typeof country === 'string' ? country.toUpperCase() : undefined;
                if (!defaultCountry) {
                    const al = String(req.headers['accept-language'] || '').split(',')[0];
                    const match = /-([A-Z]{2})$/i.exec(al || '');
                    if (match) defaultCountry = match[1].toUpperCase();
                }
                const parsed = parsePhoneNumberFromString(idRaw, defaultCountry);
                if (parsed && parsed.isValid()) {
                    query = { phoneNumber: parsed.number };
                } else {
                    query = { username: idRaw };
                }
            }
        }

        const user = await User.findOne(query || {});
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // ===== SECURITY: Check if account is locked =====
        if (user.lockUntil && user.lockUntil > Date.now()) {
            const remainingMinutes = Math.ceil((user.lockUntil - Date.now()) / (60 * 1000));
            return res.status(423).json({ 
                message: `Account is locked due to too many failed login attempts. Please try again in ${remainingMinutes} minutes.`,
                lockUntil: user.lockUntil
            });
        }

        // ===== SECURITY: Verify password =====
        const isMatch = await bcrypt.compare(password, user.password);
        
        if (!isMatch) {
            // ===== SECURITY: Track failed login attempts =====
            user.loginAttempts = (user.loginAttempts || 0) + 1;
            user.lastLoginAttempt = new Date();

            // Lock account after MAX_LOGIN_ATTEMPTS
            if (user.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
                user.lockUntil = new Date(Date.now() + LOCKOUT_TIME);
                await user.save();
                return res.status(423).json({ 
                    message: `Account locked due to ${MAX_LOGIN_ATTEMPTS} failed login attempts. Try again in 15 minutes.`,
                    lockUntil: user.lockUntil
                });
            }

            await user.save();
            const attemptsLeft = MAX_LOGIN_ATTEMPTS - user.loginAttempts;
            return res.status(400).json({ 
                message: `Invalid credentials. ${attemptsLeft} attempt(s) remaining before lockout.`
            });
        }

        // ===== SECURITY: Reset failed attempts on successful login =====
        user.loginAttempts = 0;
        user.lockUntil = null;
        user.lastLoginAttempt = new Date();
        await user.save();

        // Create session (stateful authentication)
        req.session.user = {
            profileId: user.profileId,
            username: user.username,
            email: user.email || null,
            phoneNumber: user.phoneNumber || null,
            fullName: user.fullName || '',
            profileImage: user.profileImage || '',
        };

        // ===== SECURITY: Password expiry warning (optional) =====
        let passwordWarning = null;
        if (user.passwordChangedAt) {
            const daysSinceChange = Math.floor((Date.now() - user.passwordChangedAt.getTime()) / (1000 * 60 * 60 * 24));
            if (daysSinceChange > 90) {
                passwordWarning = 'Your password is over 90 days old. Consider changing it for security.';
            }
        }

        console.log('✅ Login successful, session created for:', user.username);
        console.log('🔍 Session data after user assignment:', {
          sessionID: req.sessionID,
          hasUser: !!req.session.user,
          userProfileId: req.session.user?.profileId,
          userUsername: req.session.user?.username,
          sessionKeys: Object.keys(req.session)
        });

        // Force session modification and save with explicit marking
        req.session.touch();
        console.log('🔍 About to save session with ID:', req.sessionID);
        console.log('🔍 Session data before save:', {
          sessionID: req.sessionID,
          hasUser: !!req.session.user,
          userProfileId: req.session.user?.profileId,
          userUsername: req.session.user?.username,
          sessionKeys: Object.keys(req.session)
        });
        
        // Force session to be marked as modified
        req.session.user = req.session.user; // This should trigger modification
        
        req.session.save((err) => {
          if (err) {
            console.error('❌ Session save error:', err);
            return res.status(500).json({ message: 'Session save failed' });
          }
        
          console.log('✅ Session persisted successfully for:', user.username);
          console.log('🔍 Session data after save:', {
            sessionID: req.sessionID,
            hasUser: !!req.session.user,
            userProfileId: req.session.user?.profileId,
            userUsername: req.session.user?.username,
            sessionKeys: Object.keys(req.session)
          });
          
          // Explicitly set the session cookie to ensure it's updated
          res.cookie('sparrow.sid', req.sessionID, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            // Remove domain restriction to see if that's causing the issue
            // domain: process.env.COOKIE_DOMAIN || '.sparrowchat.in',
            maxAge: 7 * 24 * 60 * 60 * 1000,
          });
          
          console.log('🍪 Setting cookie sparrow.sid with value:', req.sessionID);
        
          res.status(200).json({
            success: true,
            user: req.session.user,
            message: 'Login successful',
          });
        });
        
         // Small delay to ensure session modification is processed
    } catch (error) {
        console.error('❌ Login error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.logoutUser = async (req, res) => {
    try {
        // Get profileId from session or request body
        const profileId = req.session?.user?.profileId || req.body?.profileId;

        console.log('🚪 User logout request:', profileId);

        if (profileId) {
            // Disconnect Socket.IO connection
            const socketId = userSockets.get(profileId);
            if (socketId) {
                if (io) {
                    const socket = io.sockets.sockets.get(socketId);
                    if (socket) {
                        socket.disconnect();
                        console.log('🔌 Socket disconnected for user:', profileId);
                    }
                }
                userSockets.delete(profileId);
                console.log('👤 User removed from active sockets:', profileId);
            }
        }

        // Destroy session (works for both Google OAuth and email/phone login)
        if (req.session) {
            req.session.destroy((err) => {
                if (err) {
                    console.error('❌ Session destroy error:', err);
                    return res.status(500).json({ 
                        success: false, 
                        message: 'Logout failed' 
                    });
                }

                // Clear session cookie
                res.clearCookie('connect.sid');
                res.clearCookie('sparrow.sid'); // Clear custom session cookie too
                
                console.log('✅ User logged out, session destroyed');
                
                res.status(200).json({ 
                    success: true, 
                    message: 'Logout successful' 
                });
            });
        } else {
            // No session to destroy, just clear cookies and respond
            res.clearCookie('connect.sid');
            res.clearCookie('sparrow.sid');
            
            console.log('✅ Logout completed (no session found)');
            
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

// Session-based authentication doesn't need refresh tokens
// Sessions are automatically refreshed on each request

// ============================================================================
// GOOGLE OAUTH / OIDC AUTHENTICATION
// ============================================================================

const { getGoogleClient } = require('../config/oidcClients');
const { extractUserInfo } = require('../utils/tokenVerifier');
const { generators } = require('openid-client');
const crypto = require('crypto');

/**
 * Initiate Google OIDC Login
 * 
 * Step 1: Redirect user to Google's authorization endpoint
 * 
 * @route GET /auth/google
 */
exports.googleLogin = async (req, res) => {
  try {
    const client = await getGoogleClient();

    // Generate state (CSRF protection) and nonce (replay protection)
    const state = generators.state();
    const nonce = generators.nonce();

    // Store state and nonce in session for verification in callback
    req.session.oidcState = state;
    req.session.oidcNonce = nonce;

    console.log('🔍 OIDC Login Initiation Debug:');
    console.log('  - Session ID:', req.sessionID);
    console.log('  - Generated state:', state);
    console.log('  - Stored state in session:', req.session.oidcState);
    console.log('  - Session exists:', !!req.session);

    // Build authorization URL
    const authorizationUrl = client.authorizationUrl({
      scope: 'openid email profile',
      state,
      nonce,
    });

    console.log('🔐 Redirecting to Google for authentication...');
    
    // Redirect user to Google's consent screen
    res.redirect(authorizationUrl);
  } catch (error) {
    console.error('❌ Google login initiation failed:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to initiate Google login' 
    });
  }
};

/**
 * Handle Google OIDC Callback
 * 
 * Step 2: Process authorization code from Google and complete authentication
 * 
 * @route GET /auth/google/callback
 */
exports.googleCallback = async (req, res) => {
  try {
    const client = await getGoogleClient();
    
    // Get authorization response from query parameters
    const params = client.callbackParams(req);
    
    // Step 1: Verify state parameter (CSRF protection)
    console.log('🔍 OIDC Callback Debug:');
    console.log('  - Session ID:', req.sessionID);
    console.log('  - Session exists:', !!req.session);
    console.log('  - Stored state:', req.session.oidcState);
    console.log('  - Received state:', params.state);
    console.log('  - Cookies:', req.headers.cookie);
    
    if (!req.session.oidcState || params.state !== req.session.oidcState) {
      console.error('❌ State mismatch - possible CSRF attack');
      console.error('  - Expected state:', req.session.oidcState);
      console.error('  - Received state:', params.state);
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid state parameter' 
      });
    }

    // Step 2: Exchange authorization code for tokens
    const tokenSet = await client.callback(
      process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/auth/google/callback',
      params,
      { 
        state: req.session.oidcState,
        nonce: req.session.oidcNonce 
      }
    );

    console.log('✅ Tokens received from Google');

    // Step 3: ID token is automatically verified by openid-client
    const claims = tokenSet.claims();
    
    console.log('✅ ID token verified, user ID:', claims.sub);

    // Step 4: Extract user information from verified claims
    const userInfo = extractUserInfo(claims);

    // Step 5: Find or create user in database
    console.log('🔍 Looking for existing user with email:', userInfo.email, 'or profileId:', `google-${userInfo.providerId}`);
    
    let user = await User.findOne({ 
      $or: [
        { email: userInfo.email },
        { profileId: `google-${userInfo.providerId}` }
      ]
    });
    
    console.log('🔍 User found:', !!user);
    if (user) {
      console.log('🔍 Existing user details:', {
        username: user.username,
        email: user.email,
        profileId: user.profileId,
        needsUsernameSetup: user.needsUsernameSetup
      });
    }

    if (!user) {
      // NEW USER: Create temporary account without username
      console.log('👤 Creating new Google OAuth user...');
      
      try {
        user = new User({
          fullName: userInfo.fullName,
          email: userInfo.email,
          // Don't set phoneNumber for Google OAuth users (leave it undefined to avoid unique constraint issues)
          password: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10),
          profileId: `google-${userInfo.providerId}`,
          username: `temp_${userInfo.providerId}`, // Temporary username, user will set real one
          profileImage: userInfo.picture,
          isOnline: false,
          socketId: null,
          passwordChangedAt: new Date(),
          needsUsernameSetup: true, // Flag to indicate user needs to set username
        });
        
        await user.save();
        console.log('✅ New Google user created successfully, needs username setup');
      } catch (error) {
        console.error('❌ Failed to create new Google user:', error);
        throw error;
      }
    } else {
      // EXISTING USER: Update profile and authenticate
      console.log('👤 Updating existing Google OAuth user...');
      
      try {
        // Update user profile with latest information from Google
        user.fullName = userInfo.fullName || user.fullName;
        user.profileImage = userInfo.picture || user.profileImage;
        user.email = userInfo.email || user.email;
        
        await user.save();
        console.log('✅ Existing Google user updated and authenticated:', user.username);
      } catch (error) {
        console.error('❌ Failed to update existing Google user:', error);
        throw error;
      }
    }

    // Step 6: Create session (same as email/phone login)
    req.session.user = {
      profileId: user.profileId,
      username: user.username,
      email: user.email,
      phoneNumber: user.phoneNumber,
      fullName: user.fullName,
      profileImage: user.profileImage,
    };

    // Clear OIDC state/nonce from session
    delete req.session.oidcState;
    delete req.session.oidcNonce;

    console.log('✅ Google authentication successful, session created');

    // Explicitly tell express-session the session has been modified
    req.session.touch();
    req.session.save((err) => {
      if (err) {
        console.error('❌ Session save error:', err);
        return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=session_failed`);
      }

      console.log('✅ Session persisted successfully for:', user.username);

      // Redirect based on whether user needs username setup
      if (user.needsUsernameSetup) {
        // New user - redirect to username setup page
        console.log('🔄 Redirecting new user to username setup page');
        res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/setup-username`);
      } else {
        // Existing user - redirect to chat page
        console.log('🔄 Redirecting existing user to friends page');
        res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/friends`);
      }
    });

  } catch (error) {
    console.error('❌ Google callback failed:', error);
    
    // Clear session state
    delete req.session.oidcState;
    delete req.session.oidcNonce;

    // Redirect to login with error flag
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=auth_failed`);
  }
};

/**
 * Set Username for Google OAuth Users
 * 
 * Allows new Google OAuth users to set their username after authentication.
 * 
 * @route POST /api/auth/set-username
 */
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

    const trimmedUsername = username.trim();

    // Check if username is available
    const existingUser = await User.findOne({ username: trimmedUsername });
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username is already taken',
        suggestions: generateUsernameSuggestions(trimmedUsername)
      });
    }

    // Find the current user
    const user = await User.findOne({ profileId });
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Update username and clear the setup flag
    user.username = trimmedUsername;
    user.needsUsernameSetup = false;
    await user.save();

    // Update session
    req.session.user.username = trimmedUsername;

    console.log('✅ Username set for Google OAuth user:', trimmedUsername);

    res.json({ 
      success: true, 
      message: 'Username set successfully',
      user: req.session.user
    });

  } catch (error) {
    console.error('❌ Set username error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

/**
 * Get Current User
 * 
 * Returns the authenticated user's information from session.
 * Protected by ensureAuthenticated middleware.
 * 
 * @route GET /api/user
 */
exports.getCurrentUser = (req, res) => {
  console.log('🔍 getCurrentUser - Request received');
  console.log('🔍 getCurrentUser - Session ID:', req.sessionID);
  console.log('🔍 getCurrentUser - User from middleware:', req.user);
  console.log('🔍 getCurrentUser - Session user:', req.session?.user);
  
  // req.user is set by ensureAuthenticated middleware
  if (!req.user) {
    console.log('❌ getCurrentUser - No user found in request object');
    return res.status(401).json({ 
      success: false, 
      error: 'User not found in request' 
    });
  }
  
  console.log('✅ getCurrentUser - Returning user data for:', req.user.username);
  res.json({ 
    success: true, 
    user: req.user 
  });
};
