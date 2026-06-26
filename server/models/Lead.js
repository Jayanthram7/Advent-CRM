const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
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
    enum: ['Open', 'Call Back', 'Interested', 'Not Interested', 'Follow Up', 'Hot Lead', 'Cold Lead', 'Review', 'Completed', 'Closed']
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
leadSchema.index({ firstName: 'text', lastName: 'text', email: 'text', company: 'text' });

// Pre-save hook to keep labels and status in sync and enforce single label
leadSchema.pre('save', function (next) {
  // 1. Enforce single label
  if (!this.labels || this.labels.length === 0) {
    this.labels = ['Open'];
  } else if (this.labels.length > 1) {
    this.labels = [this.labels[this.labels.length - 1]];
  }

  // 2. Sync status and labels
  if (this.labels[0] === 'Completed' || this.labels[0] === 'Closed') {
    this.status = this.labels[0] === 'Completed' ? 'Converted' : 'Closed';
    this.isConverted = this.labels[0] === 'Completed';
    if (this.isConverted && !this.convertedAt) {
      this.convertedAt = new Date();
    }
  } else {
    this.status = 'Open';
    this.isConverted = false;
    this.convertedAt = undefined;
  }
  next();
});

// Pre-findOneAndUpdate hook to sync on updates
leadSchema.pre('findOneAndUpdate', function (next) {
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
      update.status = labels[0] === 'Completed' ? 'Converted' : 'Closed';
      update.isConverted = labels[0] === 'Completed';
      if (update.isConverted) {
        update.convertedAt = new Date();
      }
    } else {
      update.status = 'Open';
      update.isConverted = false;
      update.convertedAt = null;
    }
  } else if (status !== undefined) {
    if (status === 'Converted' || status === 'Closed') {
      update.labels = ['Completed'];
      update.isConverted = status === 'Converted';
      if (update.isConverted) {
        update.convertedAt = new Date();
      }
    } else {
      update.labels = ['Open'];
      update.isConverted = false;
      update.convertedAt = null;
    }
  }
  next();
});

module.exports = mongoose.model('Lead', leadSchema);
