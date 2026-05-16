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
  }
}, { timestamps: true });

module.exports = mongoose.model('AdminSetting', adminSettingSchema);
