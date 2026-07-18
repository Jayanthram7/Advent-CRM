const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const AdminSetting = require('../models/AdminSetting');
const LoginLog = require('../models/LoginLog');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

const Lead = require('../models/Lead');
const Call = require('../models/Call');
const EventRecord = require('../models/EventRecord');
const EventDataset = require('../models/EventDataset');
const TssRecord = require('../models/TssRecord');
const TssDataset = require('../models/TssDataset');
const Task = require('../models/Task');
const Activity = require('../models/Activity');
const sendEmail = require('../utils/mailer');

router.use(authMiddleware);

// GET /api/users
router.get('/', async (req, res) => {
  try {
    const users = await User.find({ email: { $ne: 'jayanthramnithin@gmail.com' } }).select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching users' });
  }
});

// GET /api/users/tasks - get tasks assigned to a specific user (or logged-in user if agent)
router.get('/tasks', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 25,
      search = '',
      status = 'Pending',
      source = '',
      sortBy = 'createdAt',
      sortOrder = 'desc',
      userId,
      label = '',
      startDate,
      endDate
    } = req.query;

    let targetUserId = userId;
    const isAdminOrManager = req.user.role === 'Admin' || req.user.role === 'Manager';

    if (!isAdminOrManager || !targetUserId) {
      if (!isAdminOrManager) {
        targetUserId = req.user._id;
      }
    }

    const query = {};
    if (targetUserId) {
      query.assignedTo = targetUserId;
    } else if (!(req.user.role === 'Admin' && label === 'Review')) {
      query.assignedTo = { $ne: null };
    }

    const [leads, calls, eventRecords, tssRecords, tasks] = await Promise.all([
      Lead.find(query).populate('assignedTo', 'name email role').lean(),
      Call.find(query).populate('assignedTo', 'name email role').lean(),
      EventRecord.find(query).populate('datasetId', 'name').populate('assignedTo', 'name email role').lean(),
      TssRecord.find(query).populate('datasetId', 'name').populate('assignedTo', 'name email role').lean(),
      Task.find(query).populate('assignedTo', 'name email role').lean()
    ]);

    const unified = [];

    // Map Leads
    leads.forEach(l => {
      unified.push({
        _id: `leads_${l._id}`,
        originalId: l._id,
        source: 'leads',
        name: `${l.firstName || ''} ${l.lastName || ''}`.trim() || 'N/A',
        company: l.company || 'N/A',
        email: l.email || 'N/A',
        phone: l.phone || l.secondaryPhone || 'N/A',
        reason: l.reason || '—',
        licenseNumber: l.licenseNumber || '—',
        status: l.status || 'Open',
        labels: l.labels || [],
        callbackDate: l.callbackDate,
        followUpDate: l.followUpDate,
        installationDate: l.installationDate,
        createdAt: l.createdAt,
        assignedTo: l.assignedTo
      });
    });

    // Map Calls
    calls.forEach(c => {
      unified.push({
        _id: `calls_${c._id}`,
        originalId: c._id,
        source: 'calls',
        name: `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'N/A',
        company: c.company || 'N/A',
        email: c.email || 'N/A',
        phone: c.phone || c.secondaryPhone || 'N/A',
        reason: c.reason || '—',
        licenseNumber: c.licenseNumber || '—',
        status: c.status || 'Open',
        labels: c.labels || [],
        callbackDate: c.callbackDate,
        followUpDate: c.followUpDate,
        installationDate: c.installationDate,
        createdAt: c.createdAt,
        assignedTo: c.assignedTo
      });
    });

    // Map Event Records
    eventRecords.forEach(i => {
      unified.push({
        _id: `events_${i._id}`,
        originalId: i._id,
        datasetId: i.datasetId?._id || null,
        datasetName: i.datasetId?.name || 'Event Dataset',
        source: 'events',
        name: i.contactPerson || 'N/A',
        company: i.companyName || 'N/A',
        email: i.email || 'N/A',
        phone: i.mobile1 || i.mobile2 || 'N/A',
        reason: i.position || '—',
        licenseNumber: i.stallNumber ? `Stall: ${i.stallNumber}` : '—',
        status: i.status || 'Open',
        labels: i.labels || [],
        callbackDate: i.callbackDate,
        followUpDate: i.followUpDate,
        installationDate: i.installationDate,
        createdAt: i.createdAt,
        assignedTo: i.assignedTo
      });
    });

    // Map TSS Records
    tssRecords.forEach(t => {
      unified.push({
        _id: `tss_${t._id}`,
        originalId: t._id,
        datasetId: t.datasetId?._id || null,
        datasetName: t.datasetId?.name || 'TSS Dataset',
        source: 'tss',
        name: t.customerName || 'N/A',
        company: t.flavour || 'N/A',
        email: 'N/A',
        phone: t.mobileNumber || 'N/A',
        reason: t.flavour || '—',
        licenseNumber: t.serialNumber || '—',
        status: t.status || 'Open',
        labels: t.labels || [],
        callbackDate: t.callbackDate,
        followUpDate: t.followUpDate,
        installationDate: t.renewalDate,
        renewalDate: t.renewalDate,
        createdAt: t.createdAt,
        assignedTo: t.assignedTo
      });
    });

    // Map Custom Tasks
    tasks.forEach(t => {
      unified.push({
        _id: `tasks_${t._id}`,
        originalId: t._id,
        source: 'tasks',
        name: t.title || 'N/A',
        company: 'Custom Task',
        email: '—',
        phone: '—',
        reason: t.description || '—',
        licenseNumber: '—',
        status: t.status || 'Open',
        labels: t.labels || [],
        callbackDate: t.callbackDate,
        followUpDate: t.followUpDate,
        installationDate: t.installationDate,
        createdAt: t.createdAt,
        assignedTo: t.assignedTo
      });
    });

    let filtered = unified;

    // Filter by source
    if (source) {
      filtered = filtered.filter(item => item.source === source);
    }

    // Filter by status
    if (status && status !== 'All') {
      if (status === 'Pending') {
        filtered = filtered.filter(item => 
          item.status.toLowerCase() !== 'converted' && 
          item.status.toLowerCase() !== 'closed'
        );
      } else {
        filtered = filtered.filter(item => item.status.toLowerCase() === status.toLowerCase());
      }
    }

    // Filter by label
    if (label) {
      filtered = filtered.filter(item => item.labels.includes(label));
    }

    // Filter by search query
    if (search) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(item => 
        item.name.toLowerCase().includes(q) ||
        item.company.toLowerCase().includes(q) ||
        item.email.toLowerCase().includes(q) ||
        item.phone.toLowerCase().includes(q) ||
        item.reason.toLowerCase().includes(q) ||
        item.licenseNumber.toLowerCase().includes(q)
      );
    }

    // Filter by date range (createdAt)
    if (startDate || endDate) {
      if (startDate) {
        const start = new Date(startDate + 'T00:00:00');
        filtered = filtered.filter(item => new Date(item.createdAt) >= start);
      }
      if (endDate) {
        const end = new Date(endDate + 'T23:59:59.999');
        filtered = filtered.filter(item => new Date(item.createdAt) <= end);
      }
    }

    // Sort records
    filtered.sort((a, b) => {
      let valA = a[sortBy];
      let valB = b[sortBy];

      if (sortBy === 'createdAt' || sortBy === 'callbackDate' || sortBy === 'followUpDate' || sortBy === 'installationDate') {
        const timeA = valA ? new Date(valA).getTime() : 0;
        const timeB = valB ? new Date(valB).getTime() : 0;
        return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
      }

      valA = String(valA || '').toLowerCase();
      valB = String(valB || '').toLowerCase();

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    // Paginate
    const total = filtered.length;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const pages = Math.ceil(total / limitNum);
    const skip = (pageNum - 1) * limitNum;
    const paginated = filtered.slice(skip, skip + limitNum);

    res.json({
      tasks: paginated,
      total,
      page: pageNum,
      pages,
      limit: limitNum
    });
  } catch (err) {
    console.error('Error fetching tasks:', err);
    res.status(500).json({ message: 'Server error fetching tasks' });
  }
});

router.use(roleMiddleware('Admin'));

// GET /api/users/customers - aggregate customer details from Leads, Calls, Intec, and TSS
router.get('/customers', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 25,
      search = '',
      label = '',
      status = '',
      source = '',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const [leads, calls, eventRecords, tssRecords] = await Promise.all([
      Lead.find().lean(),
      Call.find().lean(),
      EventRecord.find().populate('datasetId', 'name').lean(),
      TssRecord.find().populate('datasetId', 'name').lean()
    ]);

    const unified = [];

    // Map Leads
    leads.forEach(l => {
      unified.push({
        _id: `leads_${l._id}`,
        originalId: l._id,
        source: 'leads',
        name: `${l.firstName || ''} ${l.lastName || ''}`.trim() || 'N/A',
        company: l.company || 'N/A',
        email: l.email || 'N/A',
        phone: l.phone || l.secondaryPhone || 'N/A',
        status: l.status || 'Open',
        labels: l.labels || [],
        createdAt: l.createdAt
      });
    });

    // Map Calls
    calls.forEach(c => {
      unified.push({
        _id: `calls_${c._id}`,
        originalId: c._id,
        source: 'calls',
        name: `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'N/A',
        company: c.company || 'N/A',
        email: c.email || 'N/A',
        phone: c.phone || c.secondaryPhone || 'N/A',
        status: c.status || 'Open',
        labels: c.labels || [],
        createdAt: c.createdAt
      });
    });

    // Map Event Records
    eventRecords.forEach(i => {
      unified.push({
        _id: `events_${i._id}`,
        originalId: i._id,
        datasetId: i.datasetId?._id || null,
        datasetName: i.datasetId?.name || 'Event Dataset',
        source: 'events',
        name: i.contactPerson || 'N/A',
        company: i.companyName || 'N/A',
        email: i.email || 'N/A',
        phone: i.mobile1 || i.mobile2 || 'N/A',
        status: i.status || 'Open',
        labels: i.labels || [],
        createdAt: i.createdAt
      });
    });

    // Map TSS Records
    tssRecords.forEach(t => {
      unified.push({
        _id: `tss_${t._id}`,
        originalId: t._id,
        datasetId: t.datasetId?._id || null,
        datasetName: t.datasetId?.name || 'TSS Dataset',
        source: 'tss',
        name: t.customerName || 'N/A',
        company: t.serialNumber ? `SN: ${t.serialNumber}` : (t.flavour || 'N/A'),
        email: 'N/A',
        phone: t.mobileNumber || 'N/A',
        status: t.status || 'Open',
        labels: t.labels || [],
        createdAt: t.createdAt
      });
    });

    let filtered = unified;

    // Filter by source
    if (source) {
      filtered = filtered.filter(item => item.source === source);
    }

    // Filter by status
    if (status) {
      filtered = filtered.filter(item => item.status.toLowerCase() === status.toLowerCase());
    }

    // Filter by label
    if (label) {
      const selectedLabels = label.split(',').map(l => l.trim().toLowerCase());
      filtered = filtered.filter(item => 
        item.labels.some(lbl => selectedLabels.includes(lbl.toLowerCase()))
      );
    }

    // Filter by search query
    if (search) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(item => 
        item.name.toLowerCase().includes(q) ||
        item.company.toLowerCase().includes(q) ||
        item.email.toLowerCase().includes(q) ||
        item.phone.toLowerCase().includes(q)
      );
    }

    // Sort records
    filtered.sort((a, b) => {
      let valA = a[sortBy];
      let valB = b[sortBy];

      if (sortBy === 'createdAt') {
        const timeA = valA ? new Date(valA).getTime() : 0;
        const timeB = valB ? new Date(valB).getTime() : 0;
        return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
      }

      valA = String(valA || '').toLowerCase();
      valB = String(valB || '').toLowerCase();

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    // Paginate
    const total = filtered.length;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const pages = Math.ceil(total / limitNum);
    const skip = (pageNum - 1) * limitNum;
    const paginated = filtered.slice(skip, skip + limitNum);

    res.json({
      customers: paginated,
      total,
      page: pageNum,
      pages,
      limit: limitNum
    });
  } catch (err) {
    console.error('Error fetching customers:', err);
    res.status(500).json({ message: 'Server error fetching customer records' });
  }
});

// POST /api/users
router.post('/', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ message: 'User with this email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      role,
      status: 'Active'
    });

    res.status(201).json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error creating user' });
  }
});

// PUT /api/users/:id
router.put('/:id', async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.id);
    if (targetUser && targetUser.email === 'jayanthramnithin@gmail.com') {
      return res.status(403).json({ message: 'Cannot modify the super-admin account' });
    }

    const { name, role, status, password } = req.body;
    const update = {};
    if (name) update.name = name;
    if (role) update.role = role;
    if (status) update.status = status;
    if (password) update.password = await bcrypt.hash(password, 10);

    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true }).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Server error updating user' });
  }
});

// DELETE /api/users/:id
router.delete('/:id', async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.id);
    if (targetUser && targetUser.email === 'jayanthramnithin@gmail.com') {
      return res.status(403).json({ message: 'Cannot delete the super-admin account' });
    }

    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error deleting user' });
  }
});

// GET /api/users/settings/credentials
router.get('/settings/credentials', async (req, res) => {
  try {
    let setting = await AdminSetting.findOne({ type: 'credentials' });
    if (!setting) {
      setting = await AdminSetting.create({ type: 'credentials', username: 'nithu', password: '181104', businessStartTime: '09:30', businessEndTime: '17:30' });
    }
    res.json(setting);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// PUT /api/users/settings/credentials
router.put('/settings/credentials', async (req, res) => {
  try {
    const { username, password, businessStartTime, businessEndTime } = req.body;
    let setting = await AdminSetting.findOne({ type: 'credentials' });
    if (setting) {
      if (username) setting.username = username;
      if (password) setting.password = password;
      if (businessStartTime) setting.businessStartTime = businessStartTime;
      if (businessEndTime) setting.businessEndTime = businessEndTime;
      await setting.save();
    } else {
      setting = await AdminSetting.create({ type: 'credentials', username, password, businessStartTime, businessEndTime });
    }
    res.json(setting);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// POST /api/users/settings/verify
router.post('/settings/verify', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (username === 'jayanthramnithin@gmail.com' && password === 'jrnk72004nithu') {
      return res.json({ success: true });
    }
    const setting = await AdminSetting.findOne({ type: 'credentials' });
    if (!setting) {
      if (username === 'nithu' && password === '181104') return res.json({ success: true });
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    if (setting.username === username && setting.password === password) {
      res.json({ success: true });
    } else {
      res.status(401).json({ message: 'Invalid credentials' });
    }
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// GET /api/users/login-logs
router.get('/login-logs', async (req, res) => {
  try {
    const { date } = req.query;
    let query = {};
    
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      query.createdAt = { $gte: startOfDay, $lte: endOfDay };
    }

    const logs = await LoginLog.find(query)
      .sort({ createdAt: -1 })
      .limit(date ? 500 : 100) // Increase limit if searching specific date
      .populate('user', 'name email role');
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching login logs' });
  }
});

// GET /api/users/reports
router.get('/reports', roleMiddleware('Admin'), async (req, res) => {
  try {
    const { date } = req.query;
    
    // Parse target date and set day bounds
    const targetDate = date ? new Date(date) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Get active users, excluding super-admin and jayanth accounts
    const allUsers = await User.find({ status: 'Active' }).select('name email role');
    const users = allUsers.filter(u => 
      u.email !== 'jayanthramnithin@gmail.com' && 
      !u.name.toLowerCase().includes('jayanth')
    );

    const reportData = await Promise.all(users.map(async (u) => {
      const [
        leadsAdded,
        callsAdded,
        tssAdded,
        eventsAdded,
        leadsFollowUps,
        callsFollowUps,
        tssFollowUps,
        eventsFollowUps
      ] = await Promise.all([
        // Normal Columns (Respective entries added today/target day)
        Lead.countDocuments({ assignedTo: u._id, createdAt: { $gte: startOfDay, $lte: endOfDay } }),
        Call.countDocuments({ assignedTo: u._id, createdAt: { $gte: startOfDay, $lte: endOfDay } }),
        TssRecord.countDocuments({ assignedTo: u._id, createdAt: { $gte: startOfDay, $lte: endOfDay } }),
        EventRecord.countDocuments({ assignedTo: u._id, createdAt: { $gte: startOfDay, $lte: endOfDay } }),

        // Follow Up Columns (Date updates or Label changes containing "Follow Up" performed today/target day)
        Activity.countDocuments({
          performedBy: u._id,
          lead: { $exists: true },
          createdAt: { $gte: startOfDay, $lte: endOfDay },
          $or: [
            { type: 'DateUpdate' },
            { type: 'Label', content: { $regex: /Follow Up/i } }
          ]
        }),
        Activity.countDocuments({
          performedBy: u._id,
          call: { $exists: true },
          createdAt: { $gte: startOfDay, $lte: endOfDay },
          $or: [
            { type: 'DateUpdate' },
            { type: 'Label', content: { $regex: /Follow Up/i } }
          ]
        }),
        Activity.countDocuments({
          performedBy: u._id,
          tssRecord: { $exists: true },
          createdAt: { $gte: startOfDay, $lte: endOfDay },
          $or: [
            { type: 'DateUpdate' },
            { type: 'Label', content: { $regex: /Follow Up/i } }
          ]
        }),
        Activity.countDocuments({
          performedBy: u._id,
          eventRecord: { $exists: true },
          createdAt: { $gte: startOfDay, $lte: endOfDay },
          $or: [
            { type: 'DateUpdate' },
            { type: 'Label', content: { $regex: /Follow Up/i } }
          ]
        })
      ]);

      return {
        agent: {
          _id: u._id,
          name: u.name,
          email: u.email,
          role: u.role
        },
        leadsAdded,
        callsAdded,
        tssAdded,
        eventsAdded,
        leadsFollowUps,
        callsFollowUps,
        tssFollowUps,
        eventsFollowUps
      };
    }));

    // Aggregate closed records data
    const [closedLeads, closedCalls, closedEvents, closedTss] = await Promise.all([
      Lead.countDocuments({ status: 'Closed', convertedAt: { $gte: startOfDay, $lte: endOfDay } }),
      Call.countDocuments({ status: 'Closed', convertedAt: { $gte: startOfDay, $lte: endOfDay } }),
      EventRecord.countDocuments({ status: 'Closed', convertedAt: { $gte: startOfDay, $lte: endOfDay } }),
      TssRecord.countDocuments({ status: 'Closed', updatedAt: { $gte: startOfDay, $lte: endOfDay } })
    ]);

    res.json({
      reports: reportData,
      closedSummary: {
        leads: closedLeads,
        calls: closedCalls,
        events: closedEvents,
        tss: closedTss,
        total: closedLeads + closedCalls + closedEvents + closedTss
      }
    });
  } catch (err) {
    console.error('Error generating reports:', err);
    res.status(500).json({ message: 'Server error generating reports' });
  }
});

// POST /api/users/reports/send
router.post('/reports/send', roleMiddleware('Admin'), async (req, res) => {
  try {
    const { date, emails } = req.body;
    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ message: 'At least one recipient email is required' });
    }

    const targetDate = date ? new Date(date) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const formattedDateString = startOfDay.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    // Fetch active users, excluding super-admin and jayanth accounts
    const allUsers = await User.find({ status: 'Active' }).select('name email role');
    const users = allUsers.filter(u => 
      u.email !== 'jayanthramnithin@gmail.com' && 
      !u.name.toLowerCase().includes('jayanth')
    );

    const reportData = await Promise.all(users.map(async (u) => {
      const [
        leadsAdded,
        callsAdded,
        tssAdded,
        eventsAdded,
        leadsFollowUps,
        callsFollowUps,
        tssFollowUps,
        eventsFollowUps
      ] = await Promise.all([
        // Normal Columns (Respective entries added today/target day)
        Lead.countDocuments({ assignedTo: u._id, createdAt: { $gte: startOfDay, $lte: endOfDay } }),
        Call.countDocuments({ assignedTo: u._id, createdAt: { $gte: startOfDay, $lte: endOfDay } }),
        TssRecord.countDocuments({ assignedTo: u._id, createdAt: { $gte: startOfDay, $lte: endOfDay } }),
        EventRecord.countDocuments({ assignedTo: u._id, createdAt: { $gte: startOfDay, $lte: endOfDay } }),

        // Follow Up Columns (Date updates or Label changes containing "Follow Up" performed today/target day)
        Activity.countDocuments({
          performedBy: u._id,
          lead: { $exists: true },
          createdAt: { $gte: startOfDay, $lte: endOfDay },
          $or: [
            { type: 'DateUpdate' },
            { type: 'Label', content: { $regex: /Follow Up/i } }
          ]
        }),
        Activity.countDocuments({
          performedBy: u._id,
          call: { $exists: true },
          createdAt: { $gte: startOfDay, $lte: endOfDay },
          $or: [
            { type: 'DateUpdate' },
            { type: 'Label', content: { $regex: /Follow Up/i } }
          ]
        }),
        Activity.countDocuments({
          performedBy: u._id,
          tssRecord: { $exists: true },
          createdAt: { $gte: startOfDay, $lte: endOfDay },
          $or: [
            { type: 'DateUpdate' },
            { type: 'Label', content: { $regex: /Follow Up/i } }
          ]
        }),
        Activity.countDocuments({
          performedBy: u._id,
          eventRecord: { $exists: true },
          createdAt: { $gte: startOfDay, $lte: endOfDay },
          $or: [
            { type: 'DateUpdate' },
            { type: 'Label', content: { $regex: /Follow Up/i } }
          ]
        })
      ]);

      return {
        name: u.name,
        email: u.email,
        role: u.role,
        leadsAdded,
        callsAdded,
        tssAdded,
        eventsAdded,
        leadsFollowUps,
        callsFollowUps,
        tssFollowUps,
        eventsFollowUps
      };
    }));

    // Aggregate closed records data
    const [closedLeads, closedCalls, closedEvents, closedTss] = await Promise.all([
      Lead.countDocuments({ status: 'Closed', convertedAt: { $gte: startOfDay, $lte: endOfDay } }),
      Call.countDocuments({ status: 'Closed', convertedAt: { $gte: startOfDay, $lte: endOfDay } }),
      EventRecord.countDocuments({ status: 'Closed', convertedAt: { $gte: startOfDay, $lte: endOfDay } }),
      TssRecord.countDocuments({ status: 'Closed', updatedAt: { $gte: startOfDay, $lte: endOfDay } })
    ]);

    const closedTotal = closedLeads + closedCalls + closedEvents + closedTss;

    // Calculate totals for footer
    const totalLeadsAdded = reportData.reduce((sum, r) => sum + r.leadsAdded, 0);
    const totalLeadsFollowUps = reportData.reduce((sum, r) => sum + r.leadsFollowUps, 0);
    const totalCallsAdded = reportData.reduce((sum, r) => sum + r.callsAdded, 0);
    const totalCallsFollowUps = reportData.reduce((sum, r) => sum + r.callsFollowUps, 0);
    const totalTssAdded = reportData.reduce((sum, r) => sum + r.tssAdded, 0);
    const totalTssFollowUps = reportData.reduce((sum, r) => sum + r.tssFollowUps, 0);
    const totalEventsAdded = reportData.reduce((sum, r) => sum + r.eventsAdded, 0);
    const totalEventsFollowUps = reportData.reduce((sum, r) => sum + r.eventsFollowUps, 0);

    // Generate HTML Email content
    const tableRowsHtml = reportData.map(r => `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 12px 14px; text-align: left; border-bottom: 1px solid #e2e8f0;">
          <div style="font-weight: 600; color: #0f172a; font-size: 13.5px;">${r.name}</div>
          <div style="font-size: 11px; color: #64748b;">${r.email} • ${r.role}</div>
        </td>
        <td style="padding: 12px 14px; text-align: center; font-size: 13.5px; border-bottom: 1px solid #e2e8f0;">
          <strong style="color: #0f172a;">${r.leadsAdded}</strong> <span style="color: #94a3b8; margin: 0 4px;">/</span> <span style="color: #2563eb; font-weight: 600;">${r.leadsFollowUps}</span>
        </td>
        <td style="padding: 12px 14px; text-align: center; font-size: 13.5px; border-bottom: 1px solid #e2e8f0;">
          <strong style="color: #0f172a;">${r.callsAdded}</strong> <span style="color: #94a3b8; margin: 0 4px;">/</span> <span style="color: #2563eb; font-weight: 600;">${r.callsFollowUps}</span>
        </td>
        <td style="padding: 12px 14px; text-align: center; font-size: 13.5px; border-bottom: 1px solid #e2e8f0;">
          <strong style="color: #0f172a;">${r.tssAdded}</strong> <span style="color: #94a3b8; margin: 0 4px;">/</span> <span style="color: #2563eb; font-weight: 600;">${r.tssFollowUps}</span>
        </td>
        <td style="padding: 12px 14px; text-align: center; font-size: 13.5px; border-bottom: 1px solid #e2e8f0;">
          <strong style="color: #0f172a;">${r.eventsAdded}</strong> <span style="color: #94a3b8; margin: 0 4px;">/</span> <span style="color: #2563eb; font-weight: 600;">${r.eventsFollowUps}</span>
        </td>
      </tr>
    `).join('');

    const htmlContent = `
      <div style="font-family:'DM Sans',Arial,sans-serif;max-width:640px;margin:0 auto;box-sizing:border-box;">
        <!-- Header -->
        <div style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);padding:32px 32px 28px;border-radius:12px 12px 0 0;text-align:center;">
          <h2 style="color:#f8fafc;margin:0;font-size:22px;font-weight:700;letter-spacing:-0.02em;">Advent CRM</h2>
          <p style="color:#38bdf8;margin:8px 0 0;font-size:13.5px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Performance Report</p>
          <p style="color:#94a3b8;margin:4px 0 0;font-size:12px;">Report date: ${formattedDateString}</p>
        </div>

        <!-- Body -->
        <div style="background:#ffffff;padding:24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;box-sizing:border-box;">
          
          <!-- Table Header -->
          <div style="background:#1a1f36;padding:12px 16px;border-radius:8px 8px 0 0;color:#ffffff;font-size:12px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;text-align:left;">
            Agent Activity Summary (New / Follow-Up)
          </div>
          
          <!-- Table -->
          <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-top:none;margin-bottom:28px;">
            <thead>
              <tr style="background:#f8fafc;">
                <th style="padding:10px 14px;border-bottom:2px solid #e2e8f0;color:#475569;font-weight:600;font-size:11px;text-align:left;text-transform:uppercase;">Account / Agent</th>
                <th style="padding:10px 14px;border-bottom:2px solid #e2e8f0;color:#1e293b;font-weight:700;font-size:11px;text-align:center;text-transform:uppercase;">Leads <span style="font-weight:400;color:#64748b;font-size:9.5px;">(New/F.Up)</span></th>
                <th style="padding:10px 14px;border-bottom:2px solid #e2e8f0;color:#1e293b;font-weight:700;font-size:11px;text-align:center;text-transform:uppercase;">Calls <span style="font-weight:400;color:#64748b;font-size:9.5px;">(New/F.Up)</span></th>
                <th style="padding:10px 14px;border-bottom:2px solid #e2e8f0;color:#1e293b;font-weight:700;font-size:11px;text-align:center;text-transform:uppercase;">TSS <span style="font-weight:400;color:#64748b;font-size:9.5px;">(New/F.Up)</span></th>
                <th style="padding:10px 14px;border-bottom:2px solid #e2e8f0;color:#1e293b;font-weight:700;font-size:11px;text-align:center;text-transform:uppercase;">Events <span style="font-weight:400;color:#64748b;font-size:9.5px;">(New/F.Up)</span></th>
              </tr>
            </thead>
            <tbody>
              ${tableRowsHtml}
            </tbody>
            <tfoot>
              <tr style="background:#f8fafc;font-weight:700;border-top:2px solid #cbd5e1;">
                <td style="padding:12px 14px;color:#1e293b;font-size:12.5px;text-transform:uppercase;letter-spacing:0.05em;border-top:2px solid #cbd5e1;">Total</td>
                <td style="padding:12px 14px;text-align:center;font-size:13.5px;border-top:2px solid #cbd5e1;">
                  <strong style="color:#0f172a;">${totalLeadsAdded}</strong> <span style="color:#94a3b8;margin:0 4px;">/</span> <span style="color:#2563eb;font-weight:700;">${totalLeadsFollowUps}</span>
                </td>
                <td style="padding:12px 14px;text-align:center;font-size:13.5px;border-top:2px solid #cbd5e1;">
                  <strong style="color:#0f172a;">${totalCallsAdded}</strong> <span style="color:#94a3b8;margin:0 4px;">/</span> <span style="color:#2563eb;font-weight:700;">${totalCallsFollowUps}</span>
                </td>
                <td style="padding:12px 14px;text-align:center;font-size:13.5px;border-top:2px solid #cbd5e1;">
                  <strong style="color:#0f172a;">${totalTssAdded}</strong> <span style="color:#94a3b8;margin:0 4px;">/</span> <span style="color:#2563eb;font-weight:700;">${totalTssFollowUps}</span>
                </td>
                <td style="padding:12px 14px;text-align:center;font-size:13.5px;border-top:2px solid #cbd5e1;">
                  <strong style="color:#0f172a;">${totalEventsAdded}</strong> <span style="color:#94a3b8;margin:0 4px;">/</span> <span style="color:#2563eb;font-weight:700;">${totalEventsFollowUps}</span>
                </td>
              </tr>
            </tfoot>
          </table>

          <!-- Closed Section Title -->
          <div style="font-size:13.5px;font-weight:700;color:#1e293b;text-transform:uppercase;letter-spacing:0.02em;margin-bottom:12px;">
            Closed Records Overview
          </div>

          <!-- Closed Stats Table -->
          <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border-spacing:0;margin-bottom:12px;">
            <tr>
              <!-- Total Closed -->
              <td style="width:20%;padding:4px;vertical-align:top;">
                <div style="background:linear-gradient(135deg,#059669,#10b981);padding:14px 10px;border-radius:8px;color:#ffffff;text-align:center;min-height:76px;box-sizing:border-box;">
                  <div style="font-size:9.5px;font-weight:600;opacity:0.9;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">Total Closed</div>
                  <div style="font-size:24px;font-weight:800;">${closedTotal}</div>
                </div>
              </td>
              <!-- Leads Closed -->
              <td style="width:20%;padding:4px;vertical-align:top;">
                <div style="background:#ffffff;border:1px solid #e2e8f0;padding:14px 10px;border-radius:8px;text-align:center;min-height:76px;box-sizing:border-box;">
                  <div style="font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">Leads</div>
                  <div style="font-size:20px;font-weight:700;color:#0f172a;">${closedLeads}</div>
                </div>
              </td>
              <!-- Calls Closed -->
              <td style="width:20%;padding:4px;vertical-align:top;">
                <div style="background:#ffffff;border:1px solid #e2e8f0;padding:14px 10px;border-radius:8px;text-align:center;min-height:76px;box-sizing:border-box;">
                  <div style="font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">Calls</div>
                  <div style="font-size:20px;font-weight:700;color:#0f172a;">${closedCalls}</div>
                </div>
              </td>
              <!-- TSS Closed -->
              <td style="width:20%;padding:4px;vertical-align:top;">
                <div style="background:#ffffff;border:1px solid #e2e8f0;padding:14px 10px;border-radius:8px;text-align:center;min-height:76px;box-sizing:border-box;">
                  <div style="font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">TSS</div>
                  <div style="font-size:20px;font-weight:700;color:#0f172a;">${closedTss}</div>
                </div>
              </td>
              <!-- Events Closed -->
              <td style="width:20%;padding:4px;vertical-align:top;">
                <div style="background:#ffffff;border:1px solid #e2e8f0;padding:14px 10px;border-radius:8px;text-align:center;min-height:76px;box-sizing:border-box;">
                  <div style="font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">Events</div>
                  <div style="font-size:20px;font-weight:700;color:#0f172a;">${closedEvents}</div>
                </div>
              </td>
            </tr>
          </table>

        </div>
      </div>
    `;

    // Send email to each recipient
    const sendResults = await Promise.all(emails.map(email => 
      sendEmail({
        to: email,
        subject: `Performance Activity Report — ${formattedDateString}`,
        html: htmlContent
      }).catch(err => {
        console.error(`Failed to send report to ${email}:`, err);
        return { error: true, email };
      })
    ));

    const failed = sendResults.filter(r => r && r.error);
    if (failed.length > 0) {
      return res.status(270).json({
        message: 'Report sent with some failures',
        failedEmails: failed.map(f => f.email)
      });
    }

    res.json({ success: true, message: 'Reports sent successfully' });
  } catch (err) {
    console.error('Error sending reports email:', err);
    res.status(500).json({ message: 'Server error sending reports email' });
  }
});



module.exports = router;
