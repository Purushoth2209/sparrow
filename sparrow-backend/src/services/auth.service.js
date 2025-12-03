const bcrypt = require('bcryptjs');
const dns = require('dns').promises;
const { parsePhoneNumberFromString } = require('libphonenumber-js');
const userRepository = require('../repositories/user.repository');
const authRepository = require('../repositories/auth.repository');

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000;

/**
 * Auth Service
 * Contains business logic for authentication
 */

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

async function generateUniqueUsernameForGoogle(userInfo) {
  const { fullName, email, providerId } = userInfo;
  
  const strategies = [];
  
  if (fullName) {
    const nameBased = fullName.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 20);
    if (nameBased.length >= 3) {
      strategies.push(nameBased);
    }
  }
  
  if (email) {
    const emailPrefix = email.split('@')[0]
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .substring(0, 15);
    if (emailPrefix.length >= 3) {
      strategies.push(emailPrefix);
    }
  }
  
  if (providerId) {
    strategies.push(`user_${providerId.substring(0, 8)}`);
  }
  
  strategies.push(`user_${Date.now().toString().slice(-8)}`);
  
  for (const baseUsername of strategies) {
    let username = baseUsername;
    let counter = 1;
    
    while (true) {
      try {
        const existing = await userRepository.findUserByUsername(username);
        if (!existing) {
          return username;
        }
        
        username = `${baseUsername}_${counter}`;
        counter++;
        
        if (counter > 999) {
          break;
        }
      } catch (error) {
        console.error('Error checking username uniqueness:', error);
        break;
      }
    }
  }
  
  return `user_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
}

async function checkUsernameAvailability(username) {
  if (!username || typeof username !== 'string') {
    return { available: false, message: 'Username is required', suggestions: [] };
  }
  
  try {
    const existing = await userRepository.findUserByUsername(username);
    if (existing) {
      return { 
        available: false, 
        message: 'Username is taken', 
        suggestions: generateUsernameSuggestions(username) 
      };
    }
    return { available: true, message: 'Username is available', suggestions: [] };
  } catch (error) {
    return { available: false, message: 'Server error', suggestions: [] };
  }
}

async function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, message: 'Invalid email format' };
  }
  
  const domain = email.split('@')[1];
  try {
    const mxRecords = await dns.resolveMx(domain);
    if (!mxRecords || mxRecords.length === 0) {
      return { valid: false, message: 'Email domain does not have valid MX records' };
    }
  } catch (e) {
    return { valid: false, message: 'Email domain could not be validated (MX lookup failed)' };
  }
  
  return { valid: true };
}

async function validatePhoneNumber(phoneNumber, country) {
  let defaultCountry = typeof country === 'string' ? country.toUpperCase() : undefined;
  if (!defaultCountry) {
    const al = String(process.env.DEFAULT_COUNTRY || '').split(',')[0];
    const match = /-([A-Z]{2})$/i.exec(al || '');
    if (match) defaultCountry = match[1].toUpperCase();
  }
  
  try {
    const parsed = parsePhoneNumberFromString(phoneNumber, defaultCountry);
    if (!parsed || !parsed.isValid()) {
      return { valid: false, normalized: null, message: 'Invalid phone number. Use international format or include country.' };
    }
    return { valid: true, normalized: parsed.number };
  } catch (e) {
    return { valid: false, normalized: null, message: 'Invalid phone number format' };
  }
}

function validatePassword(password) {
  const strongPassword = typeof password === 'string' && /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,}$/.test(password);
  if (!strongPassword) {
    return { valid: false, message: 'Password must be 8+ chars with upper, lower, number, and special char' };
  }
  return { valid: true };
}

async function registerUser(userData) {
  const { email, phoneNumber, password, username, fullName } = userData;
  
  // Check for conflicts
  const conflict = await userRepository.findUserByEmailOrPhoneOrUsername(email, phoneNumber, username);
  if (conflict) {
    const isEmail = email && conflict.email === email;
    const isPhone = phoneNumber && conflict.phoneNumber === phoneNumber;
    const which = isEmail ? 'email' : isPhone ? 'phone number' : 'username';
    throw new Error(`User with this ${which} already exists`);
  }
  
  const profileId = `user-${Date.now()}`;
  const hashedPassword = await bcrypt.hash(password, 10);
  
  const user = await userRepository.createUser({
    fullName: typeof fullName === 'string' ? fullName.trim() : '',
    email,
    phoneNumber,
    password: hashedPassword,
    profileId,
    username,
    passwordChangedAt: new Date()
  });
  
  return {
    profileId: user.profileId,
    username: user.username,
    email: user.email || null,
    phoneNumber: user.phoneNumber || null,
    fullName: user.fullName || '',
    profileImage: user.profileImage || ''
  };
}

async function loginUser(identifier, email, phoneNumber, password, country) {
  let query = null;
  
  if (email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Invalid credentials');
    }
    query = { email: email.toLowerCase() };
  } else if (phoneNumber) {
    const phoneValidation = await validatePhoneNumber(phoneNumber, country);
    if (!phoneValidation.valid) {
      throw new Error('Invalid credentials');
    }
    query = { phoneNumber: phoneValidation.normalized };
  } else if (identifier) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailRegex.test(identifier.toLowerCase())) {
      query = { email: identifier.toLowerCase() };
    } else {
      const phoneValidation = await validatePhoneNumber(identifier, country);
      if (phoneValidation.valid) {
        query = { phoneNumber: phoneValidation.normalized };
      } else {
        query = { username: identifier };
      }
    }
  }
  
  const user = await authRepository.findUserForLogin(query);
  if (!user) {
    throw new Error('Invalid credentials');
  }
  
  // Check if account is locked
  if (user.lockUntil && user.lockUntil > Date.now()) {
    const remainingMinutes = Math.ceil((user.lockUntil - Date.now()) / (60 * 1000));
    throw new Error(`Account is locked due to too many failed login attempts. Please try again in ${remainingMinutes} minutes.`);
  }
  
  // Verify password
  const isMatch = await bcrypt.compare(password, user.password);
  
  if (!isMatch) {
    user.loginAttempts = (user.loginAttempts || 0) + 1;
    user.lastLoginAttempt = new Date();
    
    if (user.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
      user.lockUntil = new Date(Date.now() + LOCKOUT_TIME);
      await user.save();
      throw new Error(`Account locked due to ${MAX_LOGIN_ATTEMPTS} failed login attempts. Try again in 15 minutes.`);
    }
    
    await user.save();
    const attemptsLeft = MAX_LOGIN_ATTEMPTS - user.loginAttempts;
    throw new Error(`Invalid credentials. ${attemptsLeft} attempt(s) remaining before lockout.`);
  }
  
  // Reset failed attempts on successful login
  await authRepository.resetLoginAttempts(user.profileId);
  
  // Check password expiry
  let passwordWarning = null;
  if (user.passwordChangedAt) {
    const daysSinceChange = Math.floor((Date.now() - user.passwordChangedAt.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceChange > 90) {
      passwordWarning = 'Your password is over 90 days old. Consider changing it for security.';
    }
  }
  
  return {
    profileId: user.profileId,
    username: user.username,
    email: user.email || null,
    phoneNumber: user.phoneNumber || null,
    fullName: user.fullName || '',
    profileImage: user.profileImage || '',
    passwordWarning
  };
}

async function setUsername(profileId, username) {
  const trimmedUsername = username.trim();
  
  const existingUser = await userRepository.findUserByUsername(trimmedUsername);
  if (existingUser) {
    throw new Error('Username is already taken');
  }
  
  const user = await userRepository.findUserByProfileId(profileId);
  if (!user) {
    throw new Error('User not found');
  }
  
  user.username = trimmedUsername;
  user.needsUsernameSetup = false;
  await user.save();
  
  return {
    profileId: user.profileId,
    username: user.username,
    email: user.email || null,
    phoneNumber: user.phoneNumber || null,
    fullName: user.fullName || '',
    profileImage: user.profileImage || ''
  };
}

module.exports = {
  checkUsernameAvailability,
  validateEmail,
  validatePhoneNumber,
  validatePassword,
  registerUser,
  loginUser,
  setUsername,
  generateUsernameSuggestions,
  generateUniqueUsernameForGoogle
};

