const express = require('express');
const { registerUser, loginUser, logoutUser, checkUsername, setUsername, debugSession } = require('../controllers/auth.controller');
const ensureAuthenticated = require('../middlewares/ensureAuthenticated');

const router = express.Router();
const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

const logoutLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // Allow max 10 logout requests per minute
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/register', registerUser);
router.post('/login', loginLimiter, loginUser);
router.get('/check-username', checkUsername);
router.post('/set-username', setUsername);

// Debug route for session troubleshooting (not protected)
router.get('/debug/session', debugSession);

router.get('/protected', ensureAuthenticated, (req, res) => {
  res.json({ msg: 'This is a protected route', user: req.user });
});

router.post('/logout', logoutLimiter, logoutUser);

module.exports = router;
