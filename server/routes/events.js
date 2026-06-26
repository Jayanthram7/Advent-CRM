const express = require('express');
const router = express.Router();
const EventDataset = require('../models/EventDataset');
const EventRecord = require('../models/EventRecord');
const Note = require('../models/Note');
const Activity = require('../models/Activity');
const { Resend } = require('resend');

const resend = new Resend('re_LSfRqxrV_9dAg5rmMmoe6kHDJxzBCkThR');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

router.use(authMiddleware);

// GET /api/events/datasets - Get all events/datasets
router.get('/datasets', async (req, res) => {
  try {
    const datasets = await EventDataset.find().sort({ createdAt: -1 });
    res.json(datasets);
  } catch (err) {
    console.error('Get datasets error:', err);
    res.status(500).json({ message: 'Server error fetching event datasets' });
  }
});

// GET /api/events/datasets/:id - Get a single event dataset info
router.get('/datasets/:id', async (req, res) => {
  try {
    const dataset = await EventDataset.findById(req.params.id);
    if (!dataset) return res.status(404).json({ message: 'Event dataset not found' });
    res.json(dataset);
  } catch (err) {
    console.error('Get dataset error:', err);
    res.status(500).json({ message: 'Server error fetching event dataset' });
  }
});

// DELETE /api/events/datasets/:id - Delete an entire event dataset and all its records
router.delete('/datasets/:id', async (req, res) => {
  if (req.user.role !== 'Admin') {
    return res.status(403).json({ message: 'Only admins can delete an event dataset' });
  }

  try {
    const dataset = await EventDataset.findByIdAndDelete(req.params.id);
    if (!dataset) {
      return res.status(404).json({ message: 'Event dataset not found' });
    }

    // Find and delete all records, notes, and activities
    const records = await EventRecord.find({ datasetId: req.params.id }).select('_id');
    const recordIds = records.map(r => r._id);

    await Note.deleteMany({ eventRecord: { $in: recordIds } });
    await Activity.deleteMany({ eventRecord: { $in: recordIds } });
    await EventRecord.deleteMany({ datasetId: req.params.id });

    res.json({ message: 'Event dataset and all associated records deleted successfully' });
  } catch (err) {
    console.error('Delete dataset error:', err);
    res.status(500).json({ message: 'Server error deleting event dataset' });
  }
});

// GET /api/events/datasets/:id/records - list records of a specific dataset/event with filters & pagination
router.get('/datasets/:id/records', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 25,
      search,
      label,
      converted,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      startDate,
      endDate
    } = req.query;

    let query = { datasetId: req.params.id };

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

    // Role-based filtering: Agents only see their assigned records
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

    // Date set filter
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

    // Search filter
    if (search) {
      const searchOr = [
        { companyName: { $regex: search, $options: 'i' } },
        { contactPerson: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { mobile1: { $regex: search, $options: 'i' } },
        { mobile2: { $regex: search, $options: 'i' } },
        { hallNumber: { $regex: search, $options: 'i' } },
        { stallNumber: { $regex: search, $options: 'i' } },
        { website: { $regex: search, $options: 'i' } }
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

    const [records, total] = await Promise.all([
      EventRecord.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit))
        .populate('assignedTo', 'name email')
        .populate('createdBy', 'name email'),
      EventRecord.countDocuments(query)
    ]);

    const recordsWithNotes = await Promise.all(records.map(async (record) => {
      const noteCount = await Note.countDocuments({ eventRecord: record._id });
      return { ...record.toObject(), noteCount };
    }));

    res.json({
      records: recordsWithNotes,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      limit: parseInt(limit)
    });

  } catch (err) {
    console.error('Get event records error:', err);
    res.status(500).json({ message: 'Server error fetching event records' });
  }
});

// GET /api/events/records/:id - get a single EventRecord
router.get('/records/:id', async (req, res) => {
  try {
    const record = await EventRecord.findById(req.params.id)
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name email');
    if (!record) {
      return res.status(404).json({ message: 'Record not found' });
    }
    res.json(record);
  } catch (err) {
    console.error('Get event record error:', err);
    res.status(500).json({ message: 'Server error fetching event record' });
  }
});

// POST /api/events/records - create a record
router.post('/records', async (req, res) => {
  try {
    const {
      datasetId, hallNumber, stallNumber, companyName, contactPerson, position,
      email, mobile1, mobile2, address, country, state, pincode, website, labels
    } = req.body;

    if (!datasetId) {
      return res.status(400).json({ message: 'datasetId (Event ID) is required' });
    }
    if (!companyName || !contactPerson) {
      return res.status(400).json({ message: 'Company name and contact person are required' });
    }

    const record = await EventRecord.create({
      datasetId,
      hallNumber,
      stallNumber,
      companyName,
      contactPerson,
      position,
      email,
      mobile1,
      mobile2,
      address,
      country,
      state,
      pincode,
      website,
      labels: labels || ['Open'],
      createdBy: req.user._id,
      assignedTo: req.user._id
    });

    // Log Activity: Creation
    await Activity.create({
      eventRecord: record._id,
      type: 'Creation',
      content: `Record created by ${req.user.name}`,
      performedBy: req.user._id
    });

    // Optional: Send welcome email if email exists
    if (email) {
      try {
        await resend.emails.send({
          from: 'Advent Systems <jayanthramnithin@gmail.com>',
          to: email,
          subject: 'Welcome to Advent Systems',
          html: `<h3>Dear ${contactPerson},</h3><p>Thank you for connecting with us at event exhibition. We look forward to working with you.</p>`
        });
      } catch (emailErr) {
        console.error('Failed to send welcome email:', emailErr);
      }
    }

    res.status(201).json(record);
  } catch (err) {
    console.error('Create Event record error:', err);
    res.status(500).json({ message: 'Server error creating Event record' });
  }
});

// POST /api/events/import - bulk import Event records from parsed Excel (or create empty dataset)
router.post('/import', async (req, res) => {
  try {
    const { name, records } = req.body;
    if (!name) {
      return res.status(400).json({ message: 'Event Name is required' });
    }

    // Create Dataset
    const dataset = await EventDataset.create({ name });

    if (!records || !Array.isArray(records) || records.length === 0) {
      return res.status(201).json({ success: true, datasetId: dataset._id, count: 0 });
    }

    const bulkRecords = records.map(record => {
      const getVal = (possibleKeys) => {
        let key = Object.keys(record).find(k => 
          possibleKeys.some(pk => k.toLowerCase().replace(/\s+/g, '') === pk.toLowerCase().replace(/\s+/g, ''))
        );
        if (!key) {
          key = Object.keys(record).find(k => 
            possibleKeys.some(pk => k.toLowerCase().replace(/[^a-z0-9]/g, '').includes(pk.toLowerCase().replace(/[^a-z0-9]/g, '')) || 
                                    pk.toLowerCase().replace(/[^a-z0-9]/g, '').includes(k.toLowerCase().replace(/[^a-z0-9]/g, '')))
          );
        }
        return key ? String(record[key]).trim() : '';
      };

      return {
        datasetId: dataset._id,
        hallNumber: getVal(['Hall Number', 'HallNo', 'Hall']),
        stallNumber: getVal(['Stall Number', 'StallNo', 'Stall']),
        companyName: getVal(['Company Name', 'Company', 'CompanyName', 'Company_Name']),
        contactPerson: getVal(['Contact Person', 'ContactPerson', 'Contact', 'Name', 'Contact_Person', 'Person']),
        position: getVal(['Position', 'Designation', 'Job Title', 'Role']),
        email: getVal(['Email', 'EmailAddress', 'E-mail', 'Email_Address']),
        mobile1: getVal(['Mobile 1', 'Mobile1', 'Mobile', 'Phone', 'Contact Number', 'Mobile_1', 'MobileNo', 'Mobile Number']),
        mobile2: getVal(['Mobile 2', 'Mobile2', 'Phone 2', 'Secondary Phone', 'Mobile_2']),
        address: getVal(['Address']),
        country: getVal(['Country']),
        state: getVal(['State']),
        pincode: getVal(['Pincode', 'Pin Code', 'Zipcode', 'Zip Code', 'Pin_Code']),
        website: getVal(['Website', 'Web', 'URL', 'Link', 'Site']),
        labels: ['Open'],
        status: 'Open',
        createdBy: req.user._id,
        assignedTo: req.user._id
      };
    }).filter(r => r.companyName || r.contactPerson); // require at least company or contact to import

    if (bulkRecords.length === 0) {
      // Clean up dataset if no valid records
      await EventDataset.findByIdAndDelete(dataset._id);
      return res.status(400).json({ message: 'No valid records with Company Name or Contact Person found' });
    }

    const inserted = await EventRecord.insertMany(bulkRecords);

    // Create activity logs for imports
    const activities = inserted.map(item => ({
      eventRecord: item._id,
      type: 'Creation',
      content: `Record imported via Excel by ${req.user.name}`,
      performedBy: req.user._id
    }));
    await Activity.insertMany(activities);

    res.status(201).json({ success: true, datasetId: dataset._id, count: inserted.length });
  } catch (err) {
    console.error('Import Event records error:', err);
    res.status(500).json({ message: 'Server error during Excel import' });
  }
});

// POST /api/events/datasets/:id/import - import Excel records into an existing dataset
router.post('/datasets/:id/import', async (req, res) => {
  try {
    const { records } = req.body;
    if (!records || !Array.isArray(records)) {
      return res.status(400).json({ message: 'Records array is required' });
    }

    const dataset = await EventDataset.findById(req.params.id);
    if (!dataset) {
      return res.status(404).json({ message: 'Event dataset not found' });
    }

    const bulkRecords = records.map(record => {
      const getVal = (possibleKeys) => {
        let key = Object.keys(record).find(k => 
          possibleKeys.some(pk => k.toLowerCase().replace(/\s+/g, '') === pk.toLowerCase().replace(/\s+/g, ''))
        );
        if (!key) {
          key = Object.keys(record).find(k => 
            possibleKeys.some(pk => k.toLowerCase().replace(/[^a-z0-9]/g, '').includes(pk.toLowerCase().replace(/[^a-z0-9]/g, '')) || 
                                    pk.toLowerCase().replace(/[^a-z0-9]/g, '').includes(k.toLowerCase().replace(/[^a-z0-9]/g, '')))
          );
        }
        return key ? String(record[key]).trim() : '';
      };

      return {
        datasetId: dataset._id,
        hallNumber: getVal(['Hall Number', 'HallNo', 'Hall']),
        stallNumber: getVal(['Stall Number', 'StallNo', 'Stall']),
        companyName: getVal(['Company Name', 'Company', 'CompanyName', 'Company_Name']),
        contactPerson: getVal(['Contact Person', 'ContactPerson', 'Contact', 'Name', 'Contact_Person', 'Person']),
        position: getVal(['Position', 'Designation', 'Job Title', 'Role']),
        email: getVal(['Email', 'EmailAddress', 'E-mail', 'Email_Address']),
        mobile1: getVal(['Mobile 1', 'Mobile1', 'Mobile', 'Phone', 'Contact Number', 'Mobile_1', 'MobileNo', 'Mobile Number']),
        mobile2: getVal(['Mobile 2', 'Mobile2', 'Phone 2', 'Secondary Phone', 'Mobile_2']),
        address: getVal(['Address']),
        country: getVal(['Country']),
        state: getVal(['State']),
        pincode: getVal(['Pincode', 'Pin Code', 'Zipcode', 'Zip Code', 'Pin_Code']),
        website: getVal(['Website', 'Web', 'URL', 'Link', 'Site']),
        labels: ['Open'],
        status: 'Open',
        createdBy: req.user._id,
        assignedTo: req.user._id
      };
    }).filter(r => r.companyName || r.contactPerson);

    if (bulkRecords.length === 0) {
      return res.status(400).json({ message: 'No valid records with Company Name or Contact Person found' });
    }

    const inserted = await EventRecord.insertMany(bulkRecords);

    // Create activity logs for imports
    const activities = inserted.map(item => ({
      eventRecord: item._id,
      type: 'Creation',
      content: `Record imported via Excel by ${req.user.name}`,
      performedBy: req.user._id
    }));
    await Activity.insertMany(activities);

    res.status(201).json({ success: true, count: inserted.length });
  } catch (err) {
    console.error('Import into event error:', err);
    res.status(500).json({ message: 'Server error during Excel import' });
  }
});

// PUT /api/events/records/:id - update a record
router.put('/records/:id', async (req, res) => {
  try {
    const record = await EventRecord.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!record) {
      return res.status(404).json({ message: 'Record not found' });
    }

    // Log Activity: Assignment or Update
    if (req.body.assignedTo) {
      const User = require('../models/User');
      const assignedUser = await User.findById(req.body.assignedTo);
      await Activity.create({
        eventRecord: record._id,
        type: 'Assignment',
        content: `Record assigned to ${assignedUser ? assignedUser.name : 'Unknown User'} by ${req.user.name}`,
        performedBy: req.user._id
      });
    } else {
      await Activity.create({
        eventRecord: record._id,
        type: 'Update',
        content: `Record details updated by ${req.user.name}`,
        performedBy: req.user._id
      });
    }

    res.json(record);
  } catch (err) {
    console.error('Update Event error:', err);
    res.status(500).json({ message: 'Server error updating Event record' });
  }
});

// DELETE /api/events/records/:id
router.delete('/records/:id', async (req, res) => {
  try {
    const record = await EventRecord.findByIdAndDelete(req.params.id);
    if (!record) {
      return res.status(404).json({ message: 'Record not found' });
    }
    // Delete associated notes and activities
    await Note.deleteMany({ eventRecord: req.params.id });
    await Activity.deleteMany({ eventRecord: req.params.id });
    res.json({ message: 'Record deleted successfully' });
  } catch (err) {
    console.error('Delete Event error:', err);
    res.status(500).json({ message: 'Server error deleting Event record' });
  }
});

// POST /api/events/records/:id/labels - update labels
router.post('/records/:id/labels', async (req, res) => {
  try {
    const { labels } = req.body;
    if (labels && Array.isArray(labels) && (labels.includes('Completed') || labels.includes('Closed')) && req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Only Admins can mark records as Completed/Closed' });
    }
    const record = await EventRecord.findByIdAndUpdate(
      req.params.id,
      { labels },
      { new: true }
    );
    if (!record) return res.status(404).json({ message: 'Record not found' });

    // Log Activity: Labels
    await Activity.create({
      eventRecord: record._id,
      type: 'Label',
      content: `Labels updated to: ${labels.join(', ')} by ${req.user.name}`,
      performedBy: req.user._id
    });

    res.json(record);
  } catch (err) {
    res.status(500).json({ message: 'Server error updating labels' });
  }
});

// POST /api/events/records/:id/convert - mark as converted
router.post('/records/:id/convert', roleMiddleware('Admin'), async (req, res) => {
  try {
    const record = await EventRecord.findByIdAndUpdate(
      req.params.id,
      { 
        isConverted: true,
        convertedAt: new Date(),
        status: 'Converted'
      },
      { new: true }
    );
    if (!record) return res.status(404).json({ message: 'Record not found' });

    // Log Activity: Conversion
    await Activity.create({
      eventRecord: record._id,
      type: 'Conversion',
      content: `Record marked as Converted by ${req.user.name}`,
      performedBy: req.user._id
    });

    res.json(record);
  } catch (err) {
    res.status(500).json({ message: 'Server error converting record' });
  }
});

// POST /api/events/records/:id/notes - add note
router.post('/records/:id/notes', async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Note content is required' });
    }

    const note = await Note.create({
      eventRecord: req.params.id,
      content: content.trim(),
      author: req.user._id,
      authorName: req.user.name
    });

    // Log Activity: Note
    await Activity.create({
      eventRecord: req.params.id,
      type: 'Note',
      content: `New note added by ${req.user.name}: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`,
      performedBy: req.user._id
    });

    res.status(201).json(note);
  } catch (err) {
    res.status(500).json({ message: 'Server error creating note' });
  }
});

// GET /api/events/records/:id/notes - get notes
router.get('/records/:id/notes', async (req, res) => {
  try {
    const notes = await Note.find({ eventRecord: req.params.id })
      .sort({ createdAt: -1 })
      .populate('author', 'name email');
    res.json(notes);
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching notes' });
  }
});

// POST /api/events/records/:id/date - set callback/followup/installation date
router.post('/records/:id/date', async (req, res) => {
  try {
    const { callbackDate, followUpDate, installationDate, note } = req.body;
    
    const record = await EventRecord.findById(req.params.id);
    if (!record) return res.status(404).json({ message: 'Record not found' });

    if (callbackDate !== undefined) {
      record.callbackDate = callbackDate ? new Date(callbackDate) : null;
    }
    if (followUpDate !== undefined) {
      record.followUpDate = followUpDate ? new Date(followUpDate) : null;
    }
    if (installationDate !== undefined) {
      record.installationDate = installationDate ? new Date(installationDate) : null;
    }

    if (note && note.trim()) {
      record.followUpHistory = record.followUpHistory || [];
      record.followUpHistory.unshift({
        date: callbackDate || followUpDate || installationDate || new Date(),
        note: note.trim(),
        updatedBy: req.user.name,
        createdAt: new Date()
      });
    }

    await record.save();

    // Log Activity
    const dateVal = callbackDate || followUpDate || installationDate;
    const dateType = callbackDate ? 'Callback' : followUpDate ? 'Follow-up' : 'Installation';
    const noteText = note ? ` (Note: ${note})` : '';
    await Activity.create({
      eventRecord: record._id,
      type: 'DateUpdate',
      content: `${dateType} date set to ${formatDate(dateVal)} by ${req.user.name}${noteText}`,
      performedBy: req.user._id
    });

    res.json(record);
  } catch (err) {
    console.error('Set date error:', err);
    res.status(500).json({ message: 'Server error setting date' });
  }
});

// GET /api/events/records/:id/activities - get timeline
router.get('/records/:id/activities', async (req, res) => {
  try {
    const activities = await Activity.find({ eventRecord: req.params.id })
      .sort({ createdAt: -1 })
      .populate('performedBy', 'name email');
    res.json(activities);
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching activities' });
  }
});

// POST /api/events/records/:id/whatsapp-log - Log WhatsApp
router.post('/records/:id/whatsapp-log', async (req, res) => {
  try {
    await Activity.create({
      eventRecord: req.params.id,
      type: 'WhatsApp',
      content: `WhatsApp outreach initiated by ${req.user.name}`,
      performedBy: req.user._id
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Server error logging WhatsApp outreach' });
  }
});

// POST /api/events/records/:id/email-log - Log Email
router.post('/records/:id/email-log', async (req, res) => {
  try {
    await Activity.create({
      eventRecord: req.params.id,
      type: 'Email',
      content: `Email outreach initiated by ${req.user.name}`,
      performedBy: req.user._id
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Server error logging email outreach' });
  }
});

function formatDate(date) {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString();
}

// GET /api/events/datasets/:id/analytics
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

    const [total, converted, open, followUp, installation] = await Promise.all([
      EventRecord.countDocuments(baseQuery),
      EventRecord.countDocuments({ ...baseQuery, isConverted: true }),
      EventRecord.countDocuments({ ...baseQuery, isConverted: false, labels: 'Open' }),
      EventRecord.countDocuments({ ...baseQuery, isConverted: false, labels: 'Follow Up' }),
      EventRecord.countDocuments({ ...baseQuery, installationDate: { $exists: true, $ne: null } }),
    ]);

    const trendAgg = await EventRecord.aggregate([
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

    const labelAgg = await EventRecord.aggregate([
      { $match: aggBaseQuery }, { $unwind: { path: '$labels', preserveNullAndEmptyArrays: false } },
      { $group: { _id: '$labels', count: { $sum: 1 } } }, { $sort: { count: -1 } }
    ]);

    const countryAgg = await EventRecord.aggregate([
      { $match: aggBaseQuery },
      { $group: { _id: '$country', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }
    ]);

    const assignAgg = await EventRecord.aggregate([
      { $match: { ...aggBaseQuery, assignedTo: { $exists: true, $ne: null } } },
      { $group: { _id: '$assignedTo', count: { $sum: 1 } } },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      { $project: { name: { $ifNull: ['$user.name', 'Unassigned'] }, count: 1 } },
      { $sort: { count: -1 } }
    ]);

    const followUpStats = await EventRecord.aggregate([
      { $match: aggBaseQuery },
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

    const topFollowedAgg = await EventRecord.aggregate([
      { $match: aggBaseQuery },
      { $project: {
          name: "$contactPerson",
          companyName: "$companyName",
          mobile1: "$mobile1",
          followUpsCount: { $size: { $ifNull: ["$followUpHistory", []] } }
      } },
      { $sort: { followUpsCount: -1, name: 1 } },
      { $limit: 5 }
    ]);
    const topFollowed = topFollowedAgg.map(d => ({
      id: d._id,
      name: d.name ? d.name.trim() : (d.companyName || d.mobile1 || 'Unnamed Record'),
      count: d.followUpsCount
    }));

    const days = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
    const leadsInRange = trendAgg.reduce((s, d) => s + d.count, 0);
    const avgLeadsPerDay = (leadsInRange / days).toFixed(1);

    const followsAgg = await EventRecord.aggregate([
      { $match: aggBaseQuery },
      { $unwind: "$followUpHistory" },
      { $match: { "followUpHistory.createdAt": { $gte: start, $lte: end } } },
      { $group: { _id: null, count: { $sum: 1 } } }
    ]);
    const followsInRange = followsAgg[0]?.count || 0;
    const avgFollowsPerDay = (followsInRange / days).toFixed(1);

    const installationsInRange = await EventRecord.countDocuments({
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
      sources: countryAgg.map(d => ({ name: d._id || 'Unknown', count: d.count })),
      assignments: assignAgg.map(d => ({ name: d.name, count: d.count })),
      topFollowed
    });
  } catch (err) {
    console.error('Events analytics error:', err);
    res.status(500).json({ message: 'Error fetching events analytics' });
  }
});

module.exports = router;

