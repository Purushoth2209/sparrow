const express = require('express');
const { registerUser, loginUser, logoutUser, checkUsername, setUsername, debugSession } = require('../controllers/auth.controller');
const authAny = require('../middlewares/authAny.middleware');
const { loginLimiter, logoutLimiter } = require('../middlewares/rateLimit.middleware');

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginLimiter, loginUser);
router.get('/check-username', checkUsername);
router.post('/set-username', setUsername);

// Debug route for session troubleshooting (not protected)
router.get('/debug/session', debugSession);

router.get('/protected', authAny, (req, res) => {
  res.json({ msg: 'This is a protected route', user: req.user });
});

router.post('/logout', logoutLimiter, logoutUser);

module.exports = router;
