const User = require('../models/User');
const Message = require('../models/Message');

const fetchContact = async (req, res) => {
  const { profileId } = req.query;

  if (!profileId) {
    return res.status(400).json({ message: 'profileId is required' });
  }

  try {
    const user = await User.findOne({ profileId });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const contactsWithUnreadCounts = await Promise.all(
      user.contacts.map(async (contact) => {
        const unreadCount = await Message.countDocuments({
          senderId: contact.profileId,
          receiverId: profileId,
          isRead: false,
        });

        return {
          ...contact.toObject(),
          unreadCount,
        };
      })
    );

    res.status(200).json({ contacts: contactsWithUnreadCounts });
  } catch (error) {
    res.status(500).json({ message: 'An error occurred while fetching contacts' });
  }
};

module.exports = { fetchContact };
