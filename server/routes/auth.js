const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const LoginLog = require('../models/LoginLog');
const sendEmail = require('../utils/mailer');

const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

// Helper to generate and persist daily OTP
const ensureAndGetOTP = async (forceRefresh = false) => {
  const AdminSetting = require('../models/AdminSetting');
  let setting = await AdminSetting.findOne({ type: 'daily_otp' });
  
  const today = new Date().toISOString().split('T')[0];
  const lastUpdate = setting ? setting.updatedAt.toISOString().split('T')[0] : null;

  if (!setting || forceRefresh || lastUpdate !== today) {
    const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
    if (!setting) {
      setting = new AdminSetting({ type: 'daily_otp', password: newOtp });
    } else {
      setting.password = newOtp;
      setting.markModified('password');
    }
    await setting.save();
    return newOtp;
  }
  
  return setting.password;
};

// Helper: generate, store, and email a 6-digit OTP to the user
const generateAndSendEmailOTP = async (user) => {
  const AdminSetting = require('../models/AdminSetting');
  const emailOtp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  const otpKey = `email_otp_${user._id}`;
  await AdminSetting.findOneAndUpdate(
    { type: otpKey },
    { type: otpKey, password: emailOtp, expiresAt },
    { upsert: true, new: true }
  );

  const now = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
  sendEmail({
    to: user.email,
    subject: `Your Login OTP — ${emailOtp}`,
    html: `
      <div style="font-family:'DM Sans',Arial,sans-serif;max-width:500px;margin:0 auto;">
        <div style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);padding:32px 32px 24px;border-radius:12px 12px 0 0;text-align:center;">
          <h2 style="color:#f8fafc;margin:0;font-size:22px;font-weight:700;letter-spacing:-0.02em;">Advent CRM</h2>
          <p style="color:#94a3b8;margin:8px 0 0;font-size:13px;">Secure Login Verification</p>
        </div>
        <div style="background:#ffffff;padding:32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;">
          <p style="color:#374151;font-size:15px;margin:0 0 8px;">Hi <strong>${user.name}</strong>,</p>
          <p style="color:#64748b;font-size:13.5px;margin:0 0 24px;line-height:1.6;">
            A login attempt was made to your Advent CRM account at <strong>${now}</strong>.
            Use the OTP below to complete your login. It expires in <strong>10 minutes</strong>.
          </p>
          <div style="background:#f8fafc;border:2px dashed #e2e8f0;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
            <p style="margin:0 0 6px;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;">Your Login OTP</p>
            <div style="font-size:40px;font-weight:800;letter-spacing:0.25em;color:#0f172a;font-family:monospace;">${emailOtp}</div>
          </div>
          <p style="color:#9ca3af;font-size:12px;margin:0;text-align:center;">
            If you did not attempt to log in, please contact your administrator immediately.
          </p>
        </div>
      </div>
    `
  }).catch(err => console.error('Failed to send email OTP:', err));

  return emailOtp;
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
      const AdminSetting = require('../models/AdminSetting');
      const settings = await AdminSetting.findOne({ type: 'credentials' });
      
      const startTime = settings?.businessStartTime || '09:30';
      const endTime = settings?.businessEndTime || '17:30';

      const [startH, startM] = startTime.split(':').map(Number);
      const [endH, endM] = endTime.split(':').map(Number);
      
      const startMinutesTotal = startH * 60 + startM;
      const endMinutesTotal = endH * 60 + endM;

      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        hour: 'numeric',
        minute: 'numeric',
        hourCycle: 'h23'
      }).formatToParts(new Date());
      const hourPart = parts.find(p => p.type === 'hour');
      const minutePart = parts.find(p => p.type === 'minute');
      const nowH = hourPart ? parseInt(hourPart.value, 10) : 0;
      const nowM = minutePart ? parseInt(minutePart.value, 10) : 0;
      const timeInMinutes = nowH * 60 + nowM;
      
      if (timeInMinutes < startMinutesTotal || timeInMinutes > endMinutesTotal) {
        isOutsideHours = true;
      }
    }

    // Log the authentication attempt
    await LoginLog.create({
      user: user._id,
      userName: user.name,
      userEmail: user.email,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      status: isOutsideHours ? 'Blocked (Time)' : (user.role === 'Admin' ? 'Success' : 'OTP Pending')
    });

    if (isOutsideHours) {
      return res.status(403).json({ message: 'Login is only allowed between 9:30 AM and 5:30 PM.' });
    }
    
    // Non-Admin: trigger two-factor OTP flow
    if (user.role !== 'Admin') {
      // Fire off email OTP immediately (non-blocking)
      generateAndSendEmailOTP(user).catch(err => console.error('Email OTP error:', err));

      return res.json({
        otpRequired: true,
        userId: user._id,
        email: user.email,
        maskedEmail: user.email.replace(/(.{2})(.*)(@.*)/, '$1***$3')
      });
    }
    
    // Admin: direct JWT
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, status: user.status }
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// POST /api/auth/verify-otp — Step 1: verify the daily admin OTP
router.post('/verify-otp', async (req, res) => {
  try {
    const { userId, otp } = req.body;
    
    if (!userId || !otp) {
      return res.status(400).json({ message: 'User ID and OTP are required' });
    }
    
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    const currentOTP = await ensureAndGetOTP();
    if (otp !== currentOTP) {
      return res.status(401).json({ message: 'Invalid admin OTP. Please try again.' });
    }

    // Admin OTP verified — signal client to collect email OTP
    res.json({
      emailOtpRequired: true,
      userId: user._id,
      maskedEmail: user.email.replace(/(.{2})(.*)(@.*)/, '$1***$3')
    });

  } catch (err) {
    console.error('OTP verification error:', err);
    res.status(500).json({ message: 'Server error during OTP verification' });
  }
});

// POST /api/auth/verify-email-otp — Step 2: verify email OTP and issue JWT
router.post('/verify-email-otp', async (req, res) => {
  try {
    const { userId, emailOtp } = req.body;

    if (!userId || !emailOtp) {
      return res.status(400).json({ message: 'User ID and Email OTP are required' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const AdminSetting = require('../models/AdminSetting');
    const otpKey = `email_otp_${user._id}`;
    const otpRecord = await AdminSetting.findOne({ type: otpKey });

    if (!otpRecord) {
      return res.status(401).json({ message: 'Email OTP not found. Please restart login.' });
    }

    if (otpRecord.expiresAt && new Date() > otpRecord.expiresAt) {
      await AdminSetting.deleteOne({ type: otpKey });
      return res.status(401).json({ message: 'Email OTP has expired. Please restart login.' });
    }

    if (emailOtp !== otpRecord.password) {
      return res.status(401).json({ message: 'Invalid email OTP. Please check your inbox.' });
    }

    // Cleanup used OTP
    await AdminSetting.deleteOne({ type: otpKey });

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    await LoginLog.create({
      user: user._id,
      userName: user.name,
      userEmail: user.email,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      status: 'Success'
    });

    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, status: user.status }
    });

  } catch (err) {
    console.error('Email OTP verification error:', err);
    res.status(500).json({ message: 'Server error during email OTP verification' });
  }
});

// POST /api/auth/resend-email-otp — resend the email OTP
router.post('/resend-email-otp', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ message: 'User ID is required' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    await generateAndSendEmailOTP(user);
    res.json({ message: 'OTP resent to your email successfully' });
  } catch (err) {
    console.error('Resend OTP error:', err);
    res.status(500).json({ message: 'Server error resending OTP' });
  }
});

// GET /api/auth/daily-otp - Admin only
router.get('/daily-otp', authMiddleware, roleMiddleware('Admin'), async (req, res) => {
  try {
    const otp = await ensureAndGetOTP();
    res.json({ otp });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching daily OTP' });
  }
});

// POST /api/auth/refresh-otp - Admin only
router.post('/refresh-otp', authMiddleware, roleMiddleware('Admin'), async (req, res) => {
  try {
    const otp = await ensureAndGetOTP(true);
    res.json({ otp, message: 'OTP refreshed successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Error refreshing OTP' });
  }
});

// GET /api/auth/me - get current user from token
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
