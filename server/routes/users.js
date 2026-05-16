const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const AdminSetting = require('../models/AdminSetting');
const LoginLog = require('../models/LoginLog');
const authMiddleware = require('../middleware/authMiddleware');

const roleMiddleware = require('../middleware/roleMiddleware');

router.use(authMiddleware);
router.use(roleMiddleware('Admin'));

// GET /api/users
router.get('/', async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching users' });
  }
});

// POST /api/users
router.post('/', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ message: 'User with this email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      role,
      status: 'Active'
    });

    res.status(201).json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error creating user' });
  }
});

// PUT /api/users/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, role, status, password } = req.body;
    const update = {};
    if (name) update.name = name;
    if (role) update.role = role;
    if (status) update.status = status;
    if (password) update.password = await bcrypt.hash(password, 10);

    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true }).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Server error updating user' });
  }
});

// DELETE /api/users/:id
router.delete('/:id', async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error deleting user' });
  }
});

// GET /api/users/settings/credentials
router.get('/settings/credentials', async (req, res) => {
  try {
    let setting = await AdminSetting.findOne({ type: 'credentials' });
    if (!setting) {
      setting = await AdminSetting.create({ type: 'credentials', username: 'nithu', password: '181104' });
    }
    res.json(setting);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// PUT /api/users/settings/credentials
router.put('/settings/credentials', async (req, res) => {
  try {
    const { username, password } = req.body;
    let setting = await AdminSetting.findOne({ type: 'credentials' });
    if (setting) {
      setting.username = username;
      setting.password = password;
      await setting.save();
    } else {
      setting = await AdminSetting.create({ type: 'credentials', username, password });
    }
    res.json(setting);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// POST /api/users/settings/verify
router.post('/settings/verify', async (req, res) => {
  try {
    const { username, password } = req.body;
    const setting = await AdminSetting.findOne({ type: 'credentials' });
    if (!setting) {
      if (username === 'nithu' && password === '181104') return res.json({ success: true });
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    if (setting.username === username && setting.password === password) {
      res.json({ success: true });
    } else {
      res.status(401).json({ message: 'Invalid credentials' });
    }
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// GET /api/users/login-logs
router.get('/login-logs', async (req, res) => {
  try {
    const { date } = req.query;
    let query = {};
    
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      query.createdAt = { $gte: startOfDay, $lte: endOfDay };
    }

    const logs = await LoginLog.find(query)
      .sort({ createdAt: -1 })
      .limit(date ? 500 : 100) // Increase limit if searching specific date
      .populate('user', 'name email role');
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching login logs' });
  }
});



module.exports = router;
