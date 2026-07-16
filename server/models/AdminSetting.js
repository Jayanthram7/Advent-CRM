const mongoose = require('mongoose');

const adminSettingSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    unique: true
  },
  username: {
    type: String
  },
  password: {
    type: String
  },
  businessStartTime: {
    type: String,
    default: '09:30'
  },
  businessEndTime: {
    type: String,
    default: '17:30'
  },
  expiresAt: {
    type: Date
  }
}, { timestamps: true });

module.exports = mongoose.model('AdminSetting', adminSettingSchema);
