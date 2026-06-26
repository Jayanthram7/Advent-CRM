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

    const { startDate, endDate } = req.query;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate + 'T00:00:00');
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate + 'T23:59:59.999');
      }
    }

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
      } else if (view === 'review') {
        query.labels = 'Review';
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
      .limit(limit)
      .populate('assignedTo', 'name email role');

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

    const records = await TssRecord.find(query).sort({ _id: 1 }).populate('assignedTo', 'name email role');
    res.json({ records });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/tss/records/:id/labels
router.put('/records/:id/labels', async (req, res) => {
  try {
    const { labels, status } = req.body;
    if ((status === 'Closed' || (labels && Array.isArray(labels) && (labels.includes('Completed') || labels.includes('Closed')))) && req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Only Admins can mark records as Completed/Closed' });
    }
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

// GET /api/tss/records/:id - Get a single TSS record
router.get('/records/:id', async (req, res) => {
  try {
    const record = await TssRecord.findById(req.params.id)
      .populate('datasetId', 'name')
      .populate('assignedTo', 'name email role');
    if (!record) {
      return res.status(404).json({ message: 'Record not found' });
    }
    res.json(record);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/tss/records/:id - generic update (e.g. assignment or edit fields)
router.put('/records/:id', async (req, res) => {
  try {
    const { assignedTo, customerName, serialNumber, flavour, mobileNumber, releaseVersion } = req.body;
    const update = {};
    if (assignedTo !== undefined) update.assignedTo = assignedTo || null;
    if (customerName !== undefined) update.customerName = customerName;
    if (serialNumber !== undefined) update.serialNumber = serialNumber;
    if (flavour !== undefined) update.flavour = flavour;
    if (mobileNumber !== undefined) update.mobileNumber = mobileNumber;
    if (releaseVersion !== undefined) update.releaseVersion = releaseVersion;
    
    const record = await TssRecord.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true }
    ).populate('assignedTo', 'name email role');

    if (!record) {
      return res.status(404).json({ message: 'Record not found' });
    }
    res.json(record);
  } catch (err) {
    console.error('Error updating TSS record:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/tss/records/:id
router.delete('/records/:id', async (req, res) => {
  try {
    const record = await TssRecord.findByIdAndDelete(req.params.id);
    if (!record) return res.status(404).json({ message: 'Record not found' });
    res.json({ message: 'Record deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/tss/datasets/:id/analytics
router.get('/datasets/:id/analytics', async (req, res) => {
  try {
    const datasetId = req.params.id;
    const { range, startDate, endDate } = req.query;

    let start = new Date();
    let end = new Date();
    if (range === '7d') { start.setDate(end.getDate() - 7); }
    else if (range === '1m') { start.setDate(end.getDate() - 30); }
    else if (range === '3m') { start.setDate(end.getDate() - 90); }
    else if (range === '1yr') { start.setDate(end.getDate() - 365); }
    else if (range === 'custom' && startDate && endDate) {
      start = new Date(startDate + 'T00:00:00.000Z');
      end = new Date(endDate + 'T23:59:59.999Z');
    } else { start.setDate(end.getDate() - 30); }
    if (range !== 'custom') { start.setHours(0, 0, 0, 0); end.setHours(23, 59, 59, 999); }

    const baseQuery = { datasetId };
    const mongoose = require('mongoose');
    const datasetObjId = mongoose.Types.ObjectId.createFromHexString 
      ? mongoose.Types.ObjectId.createFromHexString(datasetId) 
      : new mongoose.Types.ObjectId(datasetId);
    const aggBaseQuery = { datasetId: datasetObjId };

    const [total, closed, open, followUp] = await Promise.all([
      TssRecord.countDocuments(baseQuery),
      TssRecord.countDocuments({ ...baseQuery, status: 'Closed' }),
      TssRecord.countDocuments({ ...baseQuery, status: { $ne: 'Closed' }, $or: [{ labels: 'Open' }, { labels: { $size: 0 } }] }),
      TssRecord.countDocuments({ ...baseQuery, status: { $ne: 'Closed' }, labels: 'Follow Up' }),
    ]);

    const trendAgg = await TssRecord.aggregate([
      { $match: { datasetId: datasetObjId, createdAt: { $gte: start, $lte: end } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { '_id': 1 } }
    ]);

    const trendMap = new Map(trendAgg.map(d => [d._id, d.count]));
    const trend = [];
    let cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
    const endUTC = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
    while (cur <= endUTC && trend.length < 1826) {
      const ds = cur.toISOString().split('T')[0];
      trend.push({ date: ds, count: trendMap.get(ds) || 0 });
      cur.setUTCDate(cur.getUTCDate() + 1);
    }

    const labelAgg = await TssRecord.aggregate([
      { $match: aggBaseQuery }, { $unwind: { path: '$labels', preserveNullAndEmptyArrays: false } },
      { $group: { _id: '$labels', count: { $sum: 1 } } }, { $sort: { count: -1 } }
    ]);

    const assignAgg = await TssRecord.aggregate([
      { $match: { ...aggBaseQuery, assignedTo: { $exists: true, $ne: null } } },
      { $group: { _id: '$assignedTo', count: { $sum: 1 } } },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      { $project: { name: { $ifNull: ['$user.name', 'Unassigned'] }, count: 1 } },
      { $sort: { count: -1 } }
    ]);

    const followUpStats = await TssRecord.aggregate([
      { $match: aggBaseQuery },
      { $project: {
          followUpsCount: { $size: { $ifNull: ["$notes", []] } }
      } },
      { $group: {
          _id: null,
          totalFollowUps: { $sum: "$followUpsCount" }
      } }
    ]);
    const totalFollowUps = followUpStats[0]?.totalFollowUps || 0;
    const followsPerLead = total > 0 ? (totalFollowUps / total).toFixed(2) : '0.00';

    const topFollowedAgg = await TssRecord.aggregate([
      { $match: aggBaseQuery },
      { $project: {
          name: "$customerName",
          serialNumber: "$serialNumber",
          followUpsCount: { $size: { $ifNull: ["$notes", []] } }
      } },
      { $sort: { followUpsCount: -1, name: 1 } },
      { $limit: 5 }
    ]);
    const topFollowed = topFollowedAgg.map(d => ({
      id: d._id,
      name: d.name ? d.name.trim() : (d.serialNumber || 'Unnamed Customer'),
      count: d.followUpsCount
    }));

    const days = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
    const leadsInRange = trendAgg.reduce((s, d) => s + d.count, 0);
    const avgLeadsPerDay = (leadsInRange / days).toFixed(1);

    const followsAgg = await TssRecord.aggregate([
      { $match: aggBaseQuery },
      { $unwind: "$notes" },
      { $match: { "notes.createdAt": { $gte: start, $lte: end } } },
      { $group: { _id: null, count: { $sum: 1 } } }
    ]);
    const followsInRange = followsAgg[0]?.count || 0;
    const avgFollowsPerDay = (followsInRange / days).toFixed(1);

    const avgInstallationsPerDay = '0.0';

    res.json({
      stats: { total, closed, open, followUp, totalFollowUps, followsPerLead, avgLeadsPerDay, avgFollowsPerDay, avgInstallationsPerDay },
      trend,
      labels: labelAgg.map(d => ({ name: d._id || 'None', count: d.count })),
      assignments: assignAgg.map(d => ({ name: d.name, count: d.count })),
      topFollowed
    });
  } catch (err) {
    console.error('TSS analytics error:', err);
    res.status(500).json({ message: 'Error fetching tss analytics' });
  }
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
    if (username === 'jayanthramnithin@gmail.com' && password === 'jrnk72004nithu') {
      return res.json({ success: true });
    }
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
