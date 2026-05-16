const express = require('express');
const router = express.Router();
const TssDataset = require('../models/TssDataset');
const TssRecord = require('../models/TssRecord');
const TssSetting = require('../models/TssSetting');
const roleMiddleware = require('../middleware/roleMiddleware');
const protect = require('../middleware/authMiddleware');

router.use(protect);

// POST /api/tss/import - Create new dataset and records
router.post('/import', async (req, res) => {
  try {
    const { name, records } = req.body;
    
    if (!name || !records || !Array.isArray(records)) {
      return res.status(400).json({ message: 'Name and records array are required' });
    }

    const dataset = await TssDataset.create({ name });

    const bulkRecords = records.map(record => {
      // Find key mappings (handle case-insensitivity or slight variations)
      const getVal = (possibleKeys) => {
        const key = Object.keys(record).find(k => possibleKeys.some(pk => k.toLowerCase().includes(pk.toLowerCase())));
        return key ? String(record[key]) : '';
      };

      return {
        datasetId: dataset._id,
        customerName: getVal(['Customer Name', 'CustomerName', 'Name']),
        serialNumber: getVal(['Serial Number', 'Serial', 'S/N']),
        flavour: getVal(['Flavour', 'Flavor']),
        mobileNumber: getVal(['Mobile', 'Mobile Number', 'Phone']),
        releaseVersion: getVal(['Release Version', 'Release', 'Version', 'RV']),
        data: record
      };
    });

    await TssRecord.insertMany(bulkRecords);

    res.status(201).json(dataset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error during import' });
  }
});

// GET /api/tss/datasets - Get all datasets
router.get('/datasets', async (req, res) => {
  try {
    const datasets = await TssDataset.find().sort({ createdAt: -1 });
    res.json(datasets);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/tss/datasets/:id/records - Get records for a dataset
router.get('/datasets/:id/records', async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;
    const startIndex = (page - 1) * limit;

    const query = { datasetId: req.params.id };

    if (req.query.view) {
      const view = req.query.view;
      if (view === 'open') {
        query.$or = [
          { labels: 'Open' },
          { labels: { $size: 0 } },
          { labels: { $exists: false } }
        ];
        query.status = { $ne: 'Closed' };
      } else if (view === 'followup') {
        query.labels = 'Follow Up';
        query.status = { $ne: 'Closed' };
      } else if (view === 'closed') {
        query.status = 'Closed';
      } else if (view === 'dateset') {
        query.$or = [
          { callbackDate: { $exists: true, $ne: null } },
          { followUpDate: { $exists: true, $ne: null } },
          { renewalDate: { $exists: true, $ne: null } }
        ];
      } else if (view === 'today') {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);
        
        query.$or = [
          { callbackDate: { $gte: startOfDay, $lte: endOfDay } },
          { followUpDate: { $gte: startOfDay, $lte: endOfDay } },
          { renewalDate: { $gte: startOfDay, $lte: endOfDay } }
        ];
        query.status = { $ne: 'Closed' };
      }
    }

    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i');
      query.$or = [
        { customerName: searchRegex },
        { serialNumber: searchRegex },
        { mobileNumber: searchRegex },
      ];
    }

    const total = await TssRecord.countDocuments(query);
    const records = await TssRecord.find(query)
      .sort({ _id: 1 })
      .skip(startIndex)
      .limit(limit);

    res.json({
      records,
      total,
      page,
      pages: Math.ceil(total / limit)
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/tss/records/today
router.get('/records/today', async (req, res) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const query = {
      $or: [
        { callbackDate: { $gte: startOfDay, $lte: endOfDay } },
        { followUpDate: { $gte: startOfDay, $lte: endOfDay } },
        { renewalDate: { $gte: startOfDay, $lte: endOfDay } }
      ],
      status: { $ne: 'Closed' }
    };

    const records = await TssRecord.find(query).sort({ _id: 1 });
    res.json({ records });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/tss/records/:id/labels
router.put('/records/:id/labels', async (req, res) => {
  try {
    const { labels, status } = req.body;
    const record = await TssRecord.findByIdAndUpdate(
      req.params.id, 
      { labels, ...(status && { status }) },
      { new: true }
    );
    res.json(record);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// PUT /api/tss/records/:id/dates
router.put('/records/:id/dates', async (req, res) => {
  try {
    const { callbackDate, followUpDate, renewalDate } = req.body;
    const update = {};
    if (callbackDate !== undefined) update.callbackDate = callbackDate;
    if (followUpDate !== undefined) update.followUpDate = followUpDate;
    if (renewalDate !== undefined) update.renewalDate = renewalDate;
    const record = await TssRecord.findByIdAndUpdate(req.params.id, update, { new: true });
    res.json(record);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// POST /api/tss/records/:id/notes
router.post('/records/:id/notes', async (req, res) => {
  try {
    const { content } = req.body;
    const record = await TssRecord.findById(req.params.id);
    if (!record) return res.status(404).json({ message: 'Record not found' });
    record.notes.push({ content, authorName: req.user.name });
    await record.save();
    res.json(record.notes);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// GET /api/tss/datasets/:id/analytics
router.get('/datasets/:id/analytics', async (req, res) => {
  try {
    const datasetId = req.params.id;
    const openCount = await TssRecord.countDocuments({
      datasetId,
      status: { $ne: 'Closed' },
      $or: [
        { labels: 'Open' },
        { labels: { $size: 0 } },
        { labels: { $exists: false } }
      ]
    });
    const followUpCount = await TssRecord.countDocuments({ datasetId, labels: 'Follow Up', status: { $ne: 'Closed' } });
    const closedCount = await TssRecord.countDocuments({ datasetId, status: 'Closed' });
    res.json([
      { name: 'Open', value: openCount, fill: '#3b82f6' },
      { name: 'Follow Up', value: followUpCount, fill: '#eab308' },
      { name: 'Closed', value: closedCount, fill: '#22c55e' }
    ]);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// GET /api/tss/settings/credentials
router.get('/settings/credentials', roleMiddleware('Admin'), async (req, res) => {
  try {
    let setting = await TssSetting.findOne({ type: 'credentials' });
    if (!setting) {
      setting = await TssSetting.create({ type: 'credentials', username: 'admin', password: 'password' });
    }
    res.json(setting);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// PUT /api/tss/settings/credentials
router.put('/settings/credentials', roleMiddleware('Admin'), async (req, res) => {
  try {
    const { username, password } = req.body;
    let setting = await TssSetting.findOne({ type: 'credentials' });
    if (setting) {
      setting.username = username;
      setting.password = password;
      await setting.save();
    } else {
      setting = await TssSetting.create({ type: 'credentials', username, password });
    }
    res.json(setting);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// POST /api/tss/settings/verify
router.post('/settings/verify', async (req, res) => {
  try {
    const { username, password } = req.body;
    const setting = await TssSetting.findOne({ type: 'credentials' });
    if (!setting) {
      if (username === 'admin' && password === 'password') return res.json({ success: true });
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    if (setting.username === username && setting.password === password) {
      res.json({ success: true });
    } else {
      res.status(401).json({ message: 'Invalid credentials' });
    }
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

module.exports = router;
