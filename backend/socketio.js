const { Server } = require('socket.io');
const Message = require('./models/Message');

const userSockets = new Map();
let io;

const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on('connection', (socket) => {
    socket.on('register', async (profileId) => {
      userSockets.set(profileId, socket.id);

      const undeliveredMessages = await Message.find({ receiverId: profileId }).sort({ timestamp: 1 });
      undeliveredMessages.forEach((msg) => {
        const messageWithTime = {
          ...msg.toObject(),
          timestamp: new Date(msg.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        };
        socket.emit('receiveMessage', messageWithTime);
      });

      await Message.deleteMany({ receiverId: profileId });
    });

    socket.on('sendMessage', async ({ senderId, receiverId, content }) => {
      try {
        const savedMessage = await Message.create({
          senderId,
          receiverId,
          content,
          timestamp: new Date(),
        });

        const fetchedMessage = await Message.findById(savedMessage._id);

        const messageWithTime = {
          ...fetchedMessage.toObject(),
          timestamp: new Date(fetchedMessage.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        };

        const receiverSocketId = userSockets.get(receiverId);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit('receiveMessage', messageWithTime);
        }
      } catch (error) {
        console.error('Error saving or delivering message:', error);
      }
    });

    socket.on('disconnect', () => {
      for (let [profileId, socketId] of userSockets) {
        if (socketId === socket.id) {
          userSockets.delete(profileId);
          break;
        }
      }
    });
  });

  return io;
};

module.exports = { initializeSocket, userSockets, io };
