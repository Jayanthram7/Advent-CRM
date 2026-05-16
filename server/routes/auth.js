const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const LoginLog = require('../models/LoginLog');
const crypto = require('crypto');

const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

// Helper to generate daily OTP
const getDailyOTP = () => {
  const date = new Date().toISOString().split('T')[0];
  const secret = process.env.JWT_SECRET || 'fallback_secret';
  const hash = crypto.createHmac('sha256', secret)
    .update(date)
    .digest('hex');
  
  // Extract a 6-digit number from the hash
  const otp = (parseInt(hash.substring(0, 8), 16) % 1000000).toString().padStart(6, '0');
  return otp;
};


// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    
    if (user.status === 'Inactive') {
      return res.status(403).json({ message: 'Your account has been deactivated. Contact admin.' });
    }
    
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    
    // Check if within office hours for non-admins
    let isOutsideHours = false;
    if (user.role !== 'Admin') {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const timeInMinutes = hours * 60 + minutes;
      
      const startMinutes = 9 * 60 + 30; // 9:30 AM
      const endMinutes = 17 * 60 + 30; // 5:30 PM
      
      if (timeInMinutes < startMinutes || timeInMinutes > endMinutes) {
        isOutsideHours = true;
      }
    }

    // Log the successful password authentication attempt
    await LoginLog.create({
      user: user._id,
      userName: user.name,
      userEmail: user.email,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      status: isOutsideHours ? 'Blocked (Time)' : (user.role === 'Admin' ? 'Success' : 'OTP Pending')
    });

    // If outside hours, block the login now (after logging)
    if (isOutsideHours) {
      return res.status(403).json({ message: 'Login is only allowed between 9:30 AM and 5:30 PM.' });
    }
    
    // If not Admin, require OTP
    if (user.role !== 'Admin') {
      return res.json({
        otpRequired: true,
        userId: user._id,
        email: user.email
      });
    }
    
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status
      }
    });


  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// POST /api/auth/verify-otp
router.post('/verify-otp', async (req, res) => {
  try {
    const { userId, otp } = req.body;
    
    if (!userId || !otp) {
      return res.status(400).json({ message: 'User ID and OTP are required' });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const currentOTP = getDailyOTP();
    if (otp !== currentOTP) {
      return res.status(401).json({ message: 'Invalid OTP' });
    }
    
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    // Log Activity: Login
    await LoginLog.create({
      user: user._id,
      userName: user.name,
      userEmail: user.email,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status
      }
    });

  } catch (err) {
    console.error('OTP verification error:', err);
    res.status(500).json({ message: 'Server error during OTP verification' });
  }
});

// GET /api/auth/daily-otp - Admin only
router.get('/daily-otp', authMiddleware, roleMiddleware('Admin'), (req, res) => {
  try {
    const otp = getDailyOTP();
    res.json({ otp });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching daily OTP' });
  }
});


// POST /api/auth/me - get current user from token
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
});

module.exports = router;
