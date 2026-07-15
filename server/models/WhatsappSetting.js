const mongoose = require('mongoose');

const whatsappSettingSchema = new mongoose.Schema({
  provider: {
    type: String,
    enum: ['twilio', 'meta'],
    default: 'twilio'
  },
  metaPhoneNumberId: {
    type: String,
    default: ''
  },
  metaAccessToken: {
    type: String,
    default: ''
  },
  metaVerifyToken: {
    type: String,
    default: 'advent_verify_token'
  },
  metaBusinessAccountId: {
    type: String,
    default: ''
  },
  metaTemplateName: {
    type: String,
    default: ''
  },
  metaTemplateLanguage: {
    type: String,
    default: 'en'
  },
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
    default: 'gemini-3.1-flash-lite'
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
