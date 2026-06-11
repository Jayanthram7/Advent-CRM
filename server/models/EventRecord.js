const mongoose = require('mongoose');

const eventRecordSchema = new mongoose.Schema({
  datasetId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EventDataset',
    required: true
  },
  hallNumber: {
    type: String,
    trim: true
  },
  stallNumber: {
    type: String,
    trim: true
  },
  companyName: {
    type: String,
    trim: true
  },
  contactPerson: {
    type: String,
    trim: true
  },
  position: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  mobile1: {
    type: String,
    trim: true
  },
  mobile2: {
    type: String,
    trim: true
  },
  address: {
    type: String,
    trim: true
  },
  country: {
    type: String,
    trim: true
  },
  state: {
    type: String,
    trim: true
  },
  pincode: {
    type: String,
    trim: true
  },
  website: {
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
eventRecordSchema.index({ companyName: 'text', contactPerson: 'text', email: 'text', hallNumber: 'text', stallNumber: 'text' });

module.exports = mongoose.model('EventRecord', eventRecordSchema);
