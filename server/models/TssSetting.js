const mongoose = require('mongoose');

const tssSettingSchema = new mongoose.Schema({
  type: { type: String, default: 'credentials', unique: true },
  username: { type: String, required: true },
  password: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('TssSetting', tssSettingSchema);
