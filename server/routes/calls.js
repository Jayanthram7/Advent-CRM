const express = require('express');
const router = express.Router();
const path = require('path');
const Call = require('../models/Call');
const Note = require('../models/Note');
const Activity = require('../models/Activity');
const sendEmail = require('../utils/mailer');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

// All routes require authentication
router.use(authMiddleware);

// GET /api/calls - list calls with filters and pagination
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 25,
      search,
      label,
      converted,
      source,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      startDate,
      endDate
    } = req.query;

    let query = {};

    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate + 'T00:00:00');
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate + 'T23:59:59.999');
      }
    }

    // Role-based filtering: Agents only see their assigned calls
    if (req.user.role === 'Agent') {
      query.assignedTo = req.user._id;
    }

    // Converted filter
    if (converted === 'true') {
      query.isConverted = true;
    } else if (converted === 'false') {
      query.isConverted = false;
    }

    // Label filter
    if (label) {
      query.labels = { $in: label.split(',') };
    }

    // Date set filter (calls with a callbackDate or followUp or installation)
    if (req.query.dateSet === 'true') {
      query.callbackDate = { $exists: true, $ne: null };
    }

    if (req.query.installation === 'true') {
      query.installationDate = { $exists: true, $ne: null };
    }

    // Today filter
    if (req.query.today === 'true') {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);
      
      query.$or = [
        { callbackDate: { $gte: startOfDay, $lte: endOfDay } },
        { followUpDate: { $gte: startOfDay, $lte: endOfDay } },
        { installationDate: { $gte: startOfDay, $lte: endOfDay } }
      ];
    }

    // Source filter
    if (source) {
      query.leadSource = source;
    }

    // Search filter
    if (search) {
      const searchOr = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
      if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: searchOr }];
        delete query.$or;
      } else {
        query.$or = searchOr;
      }
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [calls, total] = await Promise.all([
      Call.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit))
        .populate('assignedTo', 'name email')
        .populate('createdBy', 'name email'),
      Call.countDocuments(query)
    ]);

    const callsWithNotes = await Promise.all(calls.map(async (call) => {
      const noteCount = await Note.countDocuments({ call: call._id });
      return { ...call.toObject(), noteCount };
    }));

    res.json({
      calls: callsWithNotes,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      limit: parseInt(limit)
    });

  } catch (err) {
    console.error('Get calls error:', err);
    res.status(500).json({ message: 'Server error fetching calls' });
  }
});

// GET /api/calls/analytics (must be before /:id)
router.get('/analytics', async (req, res) => {
  try {
    const { range, startDate, endDate } = req.query;
    const isAgent = req.user.role === 'Agent';
    const userId = req.user._id;
    const baseQuery = isAgent ? { assignedTo: userId } : {};

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

    const [total, converted, open, followUp, installation] = await Promise.all([
      Call.countDocuments(baseQuery),
      Call.countDocuments({ ...baseQuery, isConverted: true }),
      Call.countDocuments({ ...baseQuery, isConverted: false, labels: 'Open' }),
      Call.countDocuments({ ...baseQuery, isConverted: false, labels: 'Follow Up' }),
      Call.countDocuments({ ...baseQuery, installationDate: { $exists: true, $ne: null } }),
    ]);

    const trendAgg = await Call.aggregate([
      { $match: { ...(isAgent ? { assignedTo: userId } : {}), createdAt: { $gte: start, $lte: end } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 }, converted: { $sum: { $cond: ['$isConverted', 1, 0] } } } },
      { $sort: { '_id': 1 } }
    ]);

    const trendMap = new Map(trendAgg.map(d => [d._id, d]));
    const trend = [];
    let cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
    const endUTC = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
    while (cur <= endUTC && trend.length < 1826) {
      const ds = cur.toISOString().split('T')[0];
      const d = trendMap.get(ds) || {};
      trend.push({ date: ds, count: d.count || 0, converted: d.converted || 0 });
      cur.setUTCDate(cur.getUTCDate() + 1);
    }

    const labelAgg = await Call.aggregate([
      { $match: baseQuery }, { $unwind: '$labels' },
      { $group: { _id: '$labels', count: { $sum: 1 } } }, { $sort: { count: -1 } }
    ]);

    const sourceAgg = await Call.aggregate([
      { $match: baseQuery },
      { $group: { _id: '$leadSource', count: { $sum: 1 } } }, { $sort: { count: -1 } }
    ]);

    const assignAgg = await Call.aggregate([
      { $match: { ...baseQuery, assignedTo: { $exists: true, $ne: null } } },
      { $group: { _id: '$assignedTo', count: { $sum: 1 } } },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      { $project: { name: { $ifNull: ['$user.name', 'Unassigned'] }, count: 1 } },
      { $sort: { count: -1 } }
    ]);

    const followUpStats = await Call.aggregate([
      { $match: baseQuery },
      { $project: {
          followUpsCount: { $size: { $ifNull: ["$followUpHistory", []] } }
      } },
      { $group: {
          _id: null,
          totalFollowUps: { $sum: "$followUpsCount" }
      } }
    ]);
    const totalFollowUps = followUpStats[0]?.totalFollowUps || 0;
    const followsPerLead = total > 0 ? (totalFollowUps / total).toFixed(2) : '0.00';

    const topFollowedAgg = await Call.aggregate([
      { $match: baseQuery },
      { $project: {
          name: { $concat: ["$firstName", " ", "$lastName"] },
          company: "$company",
          phone: "$phone",
          followUpsCount: { $size: { $ifNull: ["$followUpHistory", []] } }
      } },
      { $sort: { followUpsCount: -1, name: 1 } },
      { $limit: 5 }
    ]);
    const topFollowed = topFollowedAgg.map(d => ({
      id: d._id,
      name: d.name ? d.name.trim() : (d.company || d.phone || 'Unnamed Call'),
      count: d.followUpsCount
    }));

    const days = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
    const leadsInRange = trendAgg.reduce((s, d) => s + d.count, 0);
    const avgLeadsPerDay = (leadsInRange / days).toFixed(1);

    const followsAgg = await Call.aggregate([
      { $match: baseQuery },
      { $unwind: "$followUpHistory" },
      { $match: { "followUpHistory.createdAt": { $gte: start, $lte: end } } },
      { $group: { _id: null, count: { $sum: 1 } } }
    ]);
    const followsInRange = followsAgg[0]?.count || 0;
    const avgFollowsPerDay = (followsInRange / days).toFixed(1);

    const installationsInRange = await Call.countDocuments({
      ...baseQuery,
      installationDate: { $gte: start, $lte: end }
    });
    const avgInstallationsPerDay = (installationsInRange / days).toFixed(1);

    res.json({
      stats: { 
        total, converted, open, followUp, installation, 
        conversionRate: total > 0 ? ((converted / total) * 100).toFixed(1) : '0', 
        totalFollowUps, followsPerLead,
        avgLeadsPerDay, avgFollowsPerDay, avgInstallationsPerDay
      },
      trend,
      labels: labelAgg.map(d => ({ name: d._id || 'None', count: d.count })),
      sources: sourceAgg.map(d => ({ name: d._id || 'Other', count: d.count })),
      assignments: assignAgg.map(d => ({ name: d.name, count: d.count })),
      topFollowed
    });
  } catch (err) {
    console.error('Calls analytics error:', err);
    res.status(500).json({ message: 'Error fetching calls analytics' });
  }
});

// GET /api/calls/:id - get a single call
router.get('/:id', async (req, res) => {
  try {
    const call = await Call.findById(req.params.id)
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name email');
    if (!call) {
      return res.status(404).json({ message: 'Call not found' });
    }
    res.json(call);
  } catch (err) {
    console.error('Get call error:', err);
    res.status(500).json({ message: 'Server error fetching call' });
  }
});

// POST /api/calls - create call
router.post('/', async (req, res) => {
  try {
    const {
      firstName, lastName, email, phone, secondaryPhone,
      company, licenseNumber, leadSource, address, city, country, labels, reason, assignedTo
    } = req.body;

    if (!firstName || !lastName) {
      return res.status(400).json({ message: 'First name and last name are required' });
    }

    const call = await Call.create({
      firstName,
      lastName,
      email,
      phone,
      secondaryPhone,
      company,
      licenseNumber,
      leadSource,
      address,
      city,
      country,
      reason,
      labels: labels || ['Open'],
      createdBy: req.user._id,
      assignedTo: assignedTo || req.user._id
    });

    // Log Activity: Creation
    await Activity.create({
      call: call._id,
      type: 'Creation',
      content: `Call created by ${req.user.name}`,
      performedBy: req.user._id
    });

    res.status(201).json(call);
  } catch (err) {
    console.error('Create call error:', err);
    res.status(500).json({ message: 'Server error creating call' });
  }
});

// PUT /api/calls/:id - update call
router.put('/:id', async (req, res) => {
  try {
    const call = await Call.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!call) {
      return res.status(404).json({ message: 'Call not found' });
    }

    // Log Activity if assignedTo changed
    if (req.body.assignedTo) {
      const User = require('../models/User');
      const assignedUser = await User.findById(req.body.assignedTo);
      await Activity.create({
        call: call._id,
        type: 'Assignment',
        content: `Call assigned to ${assignedUser ? assignedUser.name : 'Unknown User'} by ${req.user.name}`,
        performedBy: req.user._id
      });
    } else {
      await Activity.create({
        call: call._id,
        type: 'Update',
        content: `Call details updated by ${req.user.name}`,
        performedBy: req.user._id
      });
    }

    res.json(call);

  } catch (err) {
    console.error('Update call error:', err);
    res.status(500).json({ message: 'Server error updating call' });
  }
});

// DELETE /api/calls/:id
router.delete('/:id', async (req, res) => {
  try {
    const call = await Call.findByIdAndDelete(req.params.id);
    if (!call) {
      return res.status(404).json({ message: 'Call not found' });
    }
    // Also delete associated notes
    await Note.deleteMany({ call: req.params.id });
    res.json({ message: 'Call deleted successfully' });
  } catch (err) {
    console.error('Delete call error:', err);
    res.status(500).json({ message: 'Server error deleting call' });
  }
});

// POST /api/calls/:id/labels - add/update labels
router.post('/:id/labels', async (req, res) => {
  try {
    const { labels } = req.body;
    if (labels && Array.isArray(labels) && (labels.includes('Completed') || labels.includes('Closed')) && req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Only Admins can mark records as Completed/Closed' });
    }
    const call = await Call.findByIdAndUpdate(
      req.params.id,
      { labels },
      { new: true }
    );
    if (!call) return res.status(404).json({ message: 'Call not found' });
    
    // Log Activity: Labels
    await Activity.create({
      call: call._id,
      type: 'Label',
      content: `Labels updated to: ${labels.join(', ')} by ${req.user.name}`,
      performedBy: req.user._id
    });

    res.json(call);

  } catch (err) {
    res.status(500).json({ message: 'Server error updating labels' });
  }
});

// POST /api/calls/:id/convert - mark as converted
router.post('/:id/convert', roleMiddleware('Admin'), async (req, res) => {
  try {
    const call = await Call.findByIdAndUpdate(
      req.params.id,
      { 
        isConverted: true,
        convertedAt: new Date(),
        status: 'Converted'
      },
      { new: true }
    );
    if (!call) return res.status(404).json({ message: 'Call not found' });

    // Log Activity: Conversion
    await Activity.create({
      call: call._id,
      type: 'Conversion',
      content: `Call marked as Converted by ${req.user.name}`,
      performedBy: req.user._id
    });

    res.json(call);

  } catch (err) {
    res.status(500).json({ message: 'Server error converting call' });
  }
});

// POST /api/calls/:id/notes - add note
router.post('/:id/notes', async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Note content is required' });
    }

    const note = await Note.create({
      call: req.params.id,
      content: content.trim(),
      author: req.user._id,
      authorName: req.user.name
    });

    // Log Activity: Note
    await Activity.create({
      call: req.params.id,
      type: 'Note',
      content: `New note added by ${req.user.name}: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`,
      performedBy: req.user._id
    });

    res.status(201).json(note);

  } catch (err) {
    res.status(500).json({ message: 'Server error creating note' });
  }
});

// GET /api/calls/:id/notes - get notes for a call
router.get('/:id/notes', async (req, res) => {
  try {
    const notes = await Note.find({ call: req.params.id })
      .sort({ createdAt: -1 })
      .populate('author', 'name email');
    res.json(notes);
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching notes' });
  }
});

// POST /api/calls/:id/date - set callback/followup date
router.post('/:id/date', async (req, res) => {
  try {
    const { callbackDate, followUpDate, installationDate, note } = req.body;
    
    const call = await Call.findById(req.params.id);
    if (!call) return res.status(404).json({ message: 'Call not found' });

    if (callbackDate !== undefined) {
      call.callbackDate = callbackDate ? new Date(callbackDate) : null;
    }
    if (followUpDate !== undefined) {
      call.followUpDate = followUpDate ? new Date(followUpDate) : null;
    }
    if (installationDate !== undefined) {
      call.installationDate = installationDate ? new Date(installationDate) : null;
    }

    if (note && note.trim()) {
      call.followUpHistory = call.followUpHistory || [];
      call.followUpHistory.unshift({
        date: callbackDate || followUpDate || installationDate || new Date(),
        note: note.trim(),
        updatedBy: req.user.name,
        createdAt: new Date()
      });
    }

    await call.save();

    // Log Activity: Date update
    const dateVal = callbackDate || followUpDate || installationDate;
    const dateType = callbackDate ? 'Callback' : followUpDate ? 'Follow-up' : 'Installation';
    const noteText = note ? ` (Note: ${note})` : '';
    await Activity.create({
      call: call._id,
      type: 'DateUpdate',
      content: `${dateType} date set to ${formatDate(dateVal)} by ${req.user.name}${noteText}`,
      performedBy: req.user._id
    });

    res.json(call);
  } catch (err) {
    console.error('Set date error:', err);
    res.status(500).json({ message: 'Server error setting date' });
  }
});

// Helper for date formatting in logs
function formatDate(date) {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString();
}

// GET /api/calls/:id/activities - get activity log
router.get('/:id/activities', async (req, res) => {
  try {
    const activities = await Activity.find({ call: req.params.id })
      .sort({ createdAt: -1 })
      .populate('performedBy', 'name email');
    res.json(activities);
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching activities' });
  }
});

// POST /api/calls/:id/whatsapp-log - Log WhatsApp outreach
router.post('/:id/whatsapp-log', async (req, res) => {
  try {
    await Activity.create({
      call: req.params.id,
      type: 'WhatsApp',
      content: `WhatsApp outreach initiated by ${req.user.name}`,
      performedBy: req.user._id
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Server error logging WhatsApp activity' });
  }
});

// POST /api/calls/:id/email-log - Log Email outreach
router.post('/:id/email-log', async (req, res) => {
  try {
    await Activity.create({
      call: req.params.id,
      type: 'Email',
      content: `Email outreach initiated by ${req.user.name}`,
      performedBy: req.user._id
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Server error logging Email activity' });
  }
});

module.exports = router;
