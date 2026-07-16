const express = require('express');
const router = express.Router();
const TeamMessage = require('../models/TeamMessage');
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

// GET /api/team-chat/users - Get list of users with their last message
router.get('/users', async (req, res) => {
  try {
    const currentUserId = req.user._id;
    
    // Build query filter
    let queryFilter = { 
      _id: { $ne: currentUserId },
      status: 'Active'
    };

    // Employees (Managers, Agents) should only be able to chat with Admins
    if (req.user.role !== 'Admin') {
      queryFilter.role = 'Admin';
    }

    // Get all matching users
    const users = await User.find(queryFilter).select('name email role');

    const usersWithLastMsg = await Promise.all(users.map(async (u) => {
      const lastMsg = await TeamMessage.findOne({
        $or: [
          { sender: currentUserId, receiver: u._id },
          { sender: u._id, receiver: currentUserId }
        ]
      })
      .sort({ createdAt: -1 })
      .lean();

      const unreadCount = await TeamMessage.countDocuments({
        sender: u._id,
        receiver: currentUserId,
        read: false
      });

      return {
        ...u.toObject(),
        lastMessage: lastMsg ? lastMsg.content : '',
        lastMessageTime: lastMsg ? lastMsg.createdAt : null,
        unreadCount
      };
    }));

    // Sort by last message time (most recent first)
    usersWithLastMsg.sort((a, b) => {
      if (!a.lastMessageTime) return 1;
      if (!b.lastMessageTime) return -1;
      return new Date(b.lastMessageTime) - new Date(a.lastMessageTime);
    });

    res.json(usersWithLastMsg);
  } catch (err) {
    console.error('Error fetching chat users:', err);
    res.status(500).json({ message: 'Server error fetching chat users' });
  }
});

// GET /api/team-chat/history/:userId - Get chat history with a specific user
router.get('/history/:userId', async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const otherUserId = req.params.userId;

    const otherUser = await User.findById(otherUserId);
    if (!otherUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Enforce role filter: Non-admin can only chat with admin
    if (req.user.role !== 'Admin' && otherUser.role !== 'Admin') {
      return res.status(403).json({ message: 'Access denied: Employees can only chat with Admins' });
    }

    const messages = await TeamMessage.find({
      $or: [
        { sender: currentUserId, receiver: otherUserId },
        { sender: otherUserId, receiver: currentUserId }
      ]
    })
    .sort({ createdAt: 1 })
    .populate('sender', 'name email role')
    .populate('receiver', 'name email role')
    .lean();

    res.json(messages);
  } catch (err) {
    console.error('Error fetching chat history:', err);
    res.status(500).json({ message: 'Server error fetching chat history' });
  }
});

// POST /api/team-chat/send - Send message
router.post('/send', async (req, res) => {
  try {
    const { receiverId, content } = req.body;
    if (!receiverId || !content) {
      return res.status(400).json({ message: 'Receiver and content are required' });
    }

    const otherUser = await User.findById(receiverId);
    if (!otherUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Enforce role filter: Non-admin can only chat with admin
    if (req.user.role !== 'Admin' && otherUser.role !== 'Admin') {
      return res.status(403).json({ message: 'Access denied: Employees can only chat with Admins' });
    }

    const message = await TeamMessage.create({
      sender: req.user._id,
      receiver: receiverId,
      content
    });

    const populatedMessage = await TeamMessage.findById(message._id)
      .populate('sender', 'name email role')
      .populate('receiver', 'name email role')
      .lean();

    res.json(populatedMessage);
  } catch (err) {
    console.error('Error sending message:', err);
    res.status(500).json({ message: 'Server error sending message' });
  }
});

// POST /api/team-chat/read/:userId - Mark messages from user as read
router.post('/read/:userId', async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const otherUserId = req.params.userId;

    await TeamMessage.updateMany(
      { sender: otherUserId, receiver: currentUserId, read: false },
      { read: true }
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Error marking messages as read:', err);
    res.status(500).json({ message: 'Server error marking messages as read' });
  }
});

module.exports = router;
