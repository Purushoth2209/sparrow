const User = require('../models/User');

const addContact = async (req, res) => {
  const { profileId, contactName, contactProfileId, contactPhoneNumber } = req.body;

  if (!profileId || !contactName || !contactProfileId || !contactPhoneNumber) {
    return res.status(400).json({ message: 'profileId and contact information (contactName, contactProfileId, contactPhoneNumber) are required' });
  }

  try {
    const user = await User.findOne({ profileId });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const contactExists = user.contacts.some(contact => contact.profileId === contactProfileId);
    if (contactExists) {
      return res.status(400).json({ message: 'Contact already exists in the contact list' });
    }

    const newContact = {
      username: contactName,
      profileId: contactProfileId,
      phoneNumber: contactPhoneNumber,
    };

    user.contacts.push(newContact);

    await user.save();

    return res.status(200).json({ message: 'Contact added successfully' });
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = { addContact };
