const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['Open', 'Completed', 'Closed'],
    default: 'Open'
  },
  labels: [{
    type: String,
    enum: ['Open', 'Call Back', 'Follow Up', 'Review', 'Closed'],
    default: ['Open']
  }],
  callbackDate: {
    type: Date
  },
  followUpDate: {
    type: Date
  },
  installationDate: {
    type: Date
  }
}, { timestamps: true });

// Pre-save hook to keep labels and status in sync
taskSchema.pre('save', function (next) {
  if (!this.labels || this.labels.length === 0) {
    this.labels = ['Open'];
  } else if (this.labels.length > 1) {
    this.labels = [this.labels[this.labels.length - 1]];
  }

  if (this.labels[0] === 'Closed') {
    this.status = 'Closed';
  } else {
    this.status = 'Open';
  }
  next();
});

module.exports = mongoose.model('Task', taskSchema);
