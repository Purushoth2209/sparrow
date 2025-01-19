const User = require('../models/User');

const searchUser = async (req, res) => {
  const { query } = req.query;

  if (!query) {
    return res.status(400).json({ message: 'Query parameter is required' });
  }

  try {
    const user = await User.findOne({
      $or: [{ phoneNumber: query }, { username: query }],
    });

    if (user) {
      return res.json({
        message: 'User found',
        user: { username: user.username, phoneNumber: user.phoneNumber, profileId: user.profileId },
      });
    } else {
      return res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = { searchUser };
