const mongoose = require('mongoose');

const callSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    trim: true
  },
  secondaryPhone: {
    type: String,
    trim: true
  },
  company: {
    type: String,
    trim: true
  },
  licenseNumber: {
    type: String,
    trim: true
  },
  leadSource: {
    type: String,
    enum: ['Website', 'Cold Call', 'Referral', 'Social Media', 'Email Campaign', 'Walk-in', 'Other'],
    default: 'Other'
  },
  address: {
    type: String,
    trim: true
  },
  reason: {
    type: String,
    trim: true
  },
  city: {
    type: String,
    trim: true
  },
  country: {
    type: String,
    trim: true
  },
  labels: [{
    type: String,
    enum: ['Open', 'Call Back', 'Interested', 'Not Interested', 'Follow Up', 'Hot Lead', 'Cold Lead', 'Review']
  }],
  status: {
    type: String,
    enum: ['Open', 'Converted', 'Closed'],
    default: 'Open'
  },
  isConverted: {
    type: Boolean,
    default: false
  },
  convertedAt: {
    type: Date
  },
  callbackDate: {
    type: Date
  },
  followUpDate: {
    type: Date
  },
  installationDate: {
    type: Date
  },
  followUpHistory: [{
    date: { type: Date },
    note: { type: String },
    updatedBy: { type: String },
    createdAt: { type: Date, default: Date.now }
  }],
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

// Full text search index
callSchema.index({ firstName: 'text', lastName: 'text', email: 'text', company: 'text' });

module.exports = mongoose.model('Call', callSchema);
