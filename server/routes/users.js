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
    } else {
      query.assignedTo = { $ne: null };
    }

    const [leads, calls, eventRecords, tssRecords] = await Promise.all([
      Lead.find(query).populate('assignedTo', 'name email role').lean(),
      Call.find(query).populate('assignedTo', 'name email role').lean(),
      EventRecord.find(query).populate('datasetId', 'name').populate('assignedTo', 'name email role').lean(),
      TssRecord.find(query).populate('datasetId', 'name').populate('assignedTo', 'name email role').lean()
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



module.exports = router;
