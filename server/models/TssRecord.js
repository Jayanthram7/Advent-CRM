const mongoose = require('mongoose');

const tssRecordSchema = new mongoose.Schema({
  datasetId: { type: mongoose.Schema.Types.ObjectId, ref: 'TssDataset', required: true },
  customerName: String,
  serialNumber: String,
  flavour: String,
  mobileNumber: String,
  releaseVersion: String,
  labels: { type: [String], default: ['Open'] },
  status: { type: String, default: 'Open' },
  callbackDate: Date,
  followUpDate: Date,
  renewalDate: Date,
  data: { type: Map, of: mongoose.Schema.Types.Mixed }, // Dynamic fields for everything else
  notes: [{
    content: String,
    authorName: String,
    createdAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

module.exports = mongoose.model('TssRecord', tssRecordSchema);
