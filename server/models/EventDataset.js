const mongoose = require('mongoose');

const eventDatasetSchema = new mongoose.Schema({
  name: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('EventDataset', eventDatasetSchema);
