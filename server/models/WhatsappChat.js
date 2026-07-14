const mongoose = require('mongoose');

const whatsappChatSchema = new mongoose.Schema({
  phoneNumber: {
    type: String,
    required: true,
    index: true
  },
  sender: {
    type: String,
    enum: ['User', 'AI', 'System'],
    required: true
  },
  message: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model('WhatsappChat', whatsappChatSchema);
