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
  }],
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// Pre-save hook to keep labels and status in sync and enforce single label
tssRecordSchema.pre('save', function (next) {
  // 1. Enforce single label
  if (!this.labels || this.labels.length === 0) {
    this.labels = ['Open'];
  } else if (this.labels.length > 1) {
    this.labels = [this.labels[this.labels.length - 1]];
  }

  // 2. Sync status and labels
  if (this.labels[0] === 'Completed' || this.labels[0] === 'Closed') {
    this.status = 'Closed';
  } else {
    this.status = 'Open';
  }
  next();
});

// Pre-findOneAndUpdate hook to sync on updates
tssRecordSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate();
  if (!update) return next();

  let labels = update.labels;
  let status = update.status;

  if (labels !== undefined) {
    if (!Array.isArray(labels)) {
      labels = labels ? [labels] : ['Open'];
    }
    if (labels.length > 1) {
      labels = [labels[labels.length - 1]];
    }
    if (labels.length === 0) {
      labels = ['Open'];
    }
    update.labels = labels;

    if (labels[0] === 'Completed' || labels[0] === 'Closed') {
      update.status = 'Closed';
    } else {
      update.status = 'Open';
    }
  } else if (status !== undefined) {
    if (status === 'Closed') {
      update.labels = ['Completed'];
    } else {
      update.labels = ['Open'];
    }
  }
  next();
});

module.exports = mongoose.model('TssRecord', tssRecordSchema);
