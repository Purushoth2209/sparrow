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

        res.status(201).json({ 
            success: true,
            user: req.session.user,
            message: 'Registration successful' 
        });
    } catch (error) {
        console.error('❌ Registration error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.loginUser = async (req, res) => {
    const { identifier, email, phoneNumber, password, country } = req.body;

    if (!password || (!identifier && !email && !phoneNumber)) {
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

        res.status(200).json({ 
            success: true,
            user: req.session.user,
            message: 'Login successful',
            passwordWarning
        });
    } catch (error) {
        console.error('❌ Login error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.logoutUser = async (req, res) => {
    try {
        // Get profileId from session or request body
        const profileId = req.session?.user?.profileId || req.body?.profileId;

        if (profileId) {
            // Disconnect Socket.IO connection
            const socketId = userSockets.get(profileId);
            if (socketId) {
                if (io) {
                    const socket = io.sockets.sockets.get(socketId);
                    if (socket) {
                        socket.disconnect();
                    }
                }
                userSockets.delete(profileId);
            }
        }

        // Destroy session (works for both Google OAuth and email/phone login)
        req.session.destroy((err) => {
            if (err) {
                console.error('❌ Logout error:', err);
                return res.status(500).json({ 
                    success: false, 
                    message: 'Logout failed' 
                });
            }

            // Clear session cookie
            res.clearCookie('connect.sid');
            
            console.log('✅ User logged out, session destroyed');
            
            res.status(200).json({ 
                success: true, 
                message: 'Logout successful' 
            });
        });
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
    if (!req.session.oidcState || params.state !== req.session.oidcState) {
      console.error('❌ State mismatch - possible CSRF attack');
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
    let user = await User.findOne({ 
      $or: [
        { email: userInfo.email },
        { profileId: `google-${userInfo.providerId}` }
      ]
    });

    if (!user) {
      // New user - create account
      user = new User({
        fullName: userInfo.fullName,
        email: userInfo.email,
        phoneNumber: undefined,
        password: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10),
        profileId: `google-${userInfo.providerId}`,
        username: userInfo.email ? userInfo.email.split('@')[0] : `user_${userInfo.providerId}`,
        profileImage: userInfo.picture,
        isOnline: false,
        socketId: null,
        passwordChangedAt: new Date(),
      });
      
      console.log('✅ New Google user created:', user.username);
    } else {
      // Existing user - update profile
      user.fullName = userInfo.fullName || user.fullName;
      user.profileImage = userInfo.picture || user.profileImage;
      user.email = userInfo.email || user.email;
      
      console.log('✅ Existing Google user updated:', user.username);
    }

    await user.save();

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

    // Redirect directly to chat page
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/friends`);

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
 * Get Current User
 * 
 * Returns the authenticated user's information from session.
 * Protected by ensureAuthenticated middleware.
 * 
 * @route GET /api/user
 */
exports.getCurrentUser = (req, res) => {
  // req.user is set by ensureAuthenticated middleware
  res.json({ 
    success: true, 
    user: req.user 
  });
};
