const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided, authorization denied' });
    }
    
    const token = authHeader.split(' ')[1];
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }
    
    if (user.status === 'Inactive') {
      return res.status(403).json({ message: 'Account is deactivated. Please contact admin.' });
    }

    // Enforce business hours for non-admins (Dynamic from DB)
    if (user.role !== 'Admin') {
      const AdminSetting = require('../models/AdminSetting');
      const settings = await AdminSetting.findOne({ type: 'credentials' });
      
      const startTime = settings?.businessStartTime || '09:30';
      const endTime = settings?.businessEndTime || '17:30';

      const [startH, startM] = startTime.split(':').map(Number);
      const [endH, endM] = endTime.split(':').map(Number);
      
      const startMinutesTotal = startH * 60 + startM;
      const endMinutesTotal = endH * 60 + endM;

      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const timeInMinutes = hours * 60 + minutes;
      
      if (timeInMinutes < startMinutesTotal || timeInMinutes > endMinutesTotal) {
        return res.status(403).json({ 
          message: `Access denied. The platform is only available between ${startTime} and ${endTime}.`,
          logout: true 
        });
      }
    }
    
    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token has expired' });
    }
    res.status(500).json({ message: 'Server error in auth middleware' });
  }
};

module.exports = authMiddleware;
