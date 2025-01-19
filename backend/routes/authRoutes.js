const express = require('express');
const { registerUser, loginUser, logoutUser } = require('../controllers/authController');
const { addContact } = require('../controllers/addContact');
const { searchUser } = require('../controllers/searchUser');
const authMiddleware = require('../middleware/authMiddleware');
const { fetchContact } = require('../controllers/fetchContact');

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);

router.get('/protected', authMiddleware, (req, res) => {
  res.json({ msg: 'This is a protected route', user: req.user });
});

router.post('/logout', logoutUser);
router.get('/search', searchUser);
router.post('/addContact', addContact);
router.get('/fetchContact', fetchContact);

module.exports = router;
