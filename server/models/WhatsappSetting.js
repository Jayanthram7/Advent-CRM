const mongoose = require('mongoose');

const whatsappSettingSchema = new mongoose.Schema({
  twilioAccountSid: {
    type: String,
    default: ''
  },
  twilioAuthToken: {
    type: String,
    default: ''
  },
  twilioPhoneNumber: {
    type: String,
    default: ''
  },
  geminiApiKey: {
    type: String,
    default: ''
  },
  geminiModel: {
    type: String,
    default: 'gemini-2.0-flash'
  },
  context: {
    type: String,
    default: ''
  },
  isEnabled: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

module.exports = mongoose.model('WhatsappSetting', whatsappSettingSchema);
