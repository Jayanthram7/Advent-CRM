const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  lead: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lead'
  },
  call: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Call'
  },
  intec: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Intec'
  },
  type: {
    type: String,
    enum: ['Creation', 'Label', 'Note', 'Assignment', 'Conversion', 'DateUpdate', 'Update', 'WhatsApp', 'Email'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  details: {
    type: mongoose.Schema.Types.Mixed
  }
}, { timestamps: true });

module.exports = mongoose.model('Activity', activitySchema);
