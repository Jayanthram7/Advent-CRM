const mongoose = require('mongoose');

const loginLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userName: String,
  userEmail: String,
  ip: String,
  userAgent: String,
  status: {
    type: String,
    enum: ['Success', 'Failed', 'OTP Pending', 'Blocked (Time)'],
    default: 'Success'
  }
}, { timestamps: true });

module.exports = mongoose.model('LoginLog', loginLogSchema);
