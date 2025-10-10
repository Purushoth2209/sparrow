const express = require('express');
const { registerUser, loginUser, logoutUser, checkUsername } = require('../controllers/authController');
const ensureAuthenticated = require('../middleware/ensureAuthenticated');

const router = express.Router();
const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/register', registerUser);
router.post('/login', loginLimiter, loginUser);
router.get('/check-username', checkUsername);

router.get('/protected', ensureAuthenticated, (req, res) => {
  res.json({ msg: 'This is a protected route', user: req.user });
});

router.post('/logout', logoutUser);

module.exports = router;
