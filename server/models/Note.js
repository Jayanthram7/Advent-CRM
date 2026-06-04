const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
  lead: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lead'
  },
  call: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Call'
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  authorName: {
    type: String,
    required: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Note', noteSchema);
