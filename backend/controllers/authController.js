require('dotenv').config(); // Import dotenv to load environment variables

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { userSockets, io } = require('../socketio');

const JWT_SECRET = process.env.JWT_SECRET; // Access the JWT secret from the .env file

exports.registerUser = async (req, res) => {
    const { phoneNumber, password, username } = req.body;
    if (!phoneNumber || !password || !username) {
        return res.status(400).json({ message: 'Phone number, username, and password are required' });
    }

    try {
        const existingUser = await User.findOne({ phoneNumber });
        if (existingUser) {
            return res.status(400).json({ message: 'User with this phone number already exists' });
        }

        const profileId = `user-${Date.now()}`;
        const hashedPassword = await bcrypt.hash(password, 10);

        const user = new User({
            phoneNumber,
            password: hashedPassword,
            profileId,
            username
        });

        await user.save();

        const token = jwt.sign({ profileId: user.profileId, phoneNumber: user.phoneNumber, username: user.username }, JWT_SECRET, { expiresIn: '1h' });

        res.status(201).json({ token, profileId: user.profileId, username: user.username, message: 'Registration successful' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

exports.loginUser = async (req, res) => {
    const { phoneNumber, password } = req.body;

    if (!phoneNumber || !password) {
        return res.status(400).json({ message: 'Phone number and password are required' });
    }

    try {
        const user = await User.findOne({ phoneNumber });
        if (!user) {
            return res.status(400).json({ message: 'User not found' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { profileId: user.profileId, phoneNumber: user.phoneNumber, username: user.username },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.status(200).json({ token, profileId: user.profileId, username: user.username, message: 'Login successful' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

exports.logoutUser = async (req, res) => {
    const { profileId } = req.body;

    if (!profileId) {
        return res.status(400).json({ message: 'Profile ID is required' });
    }

    try {
        const user = await User.findOne({ profileId });
        if (!user) {
            return res.status(400).json({ message: 'User not found' });
        }

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

        res.status(200).json({ message: 'Logout successful and connection terminated' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};
    