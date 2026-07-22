const mongoose = require('mongoose');

const claimSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  organization: {
    type: String,
    required: true,
    trim: true
  },
  userDescription: {
    type: String,
    trim: true
  },
  helpWith: {
    type: String,
    trim: true
  },
  score: {
    type: Number,
    required: true
  },
  totalQuestions: {
    type: Number,
    required: true
  },
  level: {
    type: Number
  },
  attempt: {
    type: Number
  }
}, { 
  timestamps: { createdAt: true, updatedAt: false }
});

module.exports = mongoose.model('Claim', claimSchema);
