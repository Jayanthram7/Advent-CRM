const express = require('express');
const router = express.Router();
const Intec = require('../models/Intec');
const Note = require('../models/Note');
const Activity = require('../models/Activity');
const { Resend } = require('resend');

const resend = new Resend('re_LSfRqxrV_9dAg5rmMmoe6kHDJxzBCkThR');
const authMiddleware = require('../middleware/authMiddleware');

// All routes require authentication
router.use(authMiddleware);

// GET /api/intec - list records with filters and pagination
router.get('/', async (req, res) => {
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
      Intec.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit))
        .populate('assignedTo', 'name email')
        .populate('createdBy', 'name email'),
      Intec.countDocuments(query)
    ]);

    const recordsWithNotes = await Promise.all(records.map(async (record) => {
      const noteCount = await Note.countDocuments({ intec: record._id });
      return { ...record.toObject(), noteCount };
    }));

    res.json({
      intec: recordsWithNotes,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      limit: parseInt(limit)
    });

  } catch (err) {
    console.error('Get intec records error:', err);
    res.status(500).json({ message: 'Server error fetching Intec records' });
  }
});

// POST /api/intec - create a record
router.post('/', async (req, res) => {
  try {
    const {
      hallNumber, stallNumber, companyName, contactPerson, position,
      email, mobile1, mobile2, address, country, state, pincode, website, labels
    } = req.body;

    if (!companyName || !contactPerson) {
      return res.status(400).json({ message: 'Company name and contact person are required' });
    }

    const record = await Intec.create({
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
      intec: record._id,
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
          html: `<h3>Dear ${contactPerson},</h3><p>Thank you for connecting with us at Intec exhibition. We look forward to working with you.</p>`
        });
      } catch (emailErr) {
        console.error('Failed to send welcome email:', emailErr);
      }
    }

    res.status(201).json(record);
  } catch (err) {
    console.error('Create Intec record error:', err);
    res.status(500).json({ message: 'Server error creating Intec record' });
  }
});

// POST /api/intec/import - bulk import Intec records from parsed Excel
router.post('/import', async (req, res) => {
  try {
    const { records } = req.body;
    if (!records || !Array.isArray(records)) {
      return res.status(400).json({ message: 'Records array is required' });
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
      return res.status(400).json({ message: 'No valid records with Company Name or Contact Person found' });
    }

    const inserted = await Intec.insertMany(bulkRecords);

    // Create activity logs for imports
    const activities = inserted.map(item => ({
      intec: item._id,
      type: 'Creation',
      content: `Record imported via Excel by ${req.user.name}`,
      performedBy: req.user._id
    }));
    await Activity.insertMany(activities);

    res.status(201).json({ success: true, count: inserted.length });
  } catch (err) {
    console.error('Import Intec records error:', err);
    res.status(500).json({ message: 'Server error during Excel import' });
  }
});

// PUT /api/intec/:id - update a record
router.put('/:id', async (req, res) => {
  try {
    const record = await Intec.findByIdAndUpdate(
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
        intec: record._id,
        type: 'Assignment',
        content: `Record assigned to ${assignedUser ? assignedUser.name : 'Unknown User'} by ${req.user.name}`,
        performedBy: req.user._id
      });
    } else {
      await Activity.create({
        intec: record._id,
        type: 'Update',
        content: `Record details updated by ${req.user.name}`,
        performedBy: req.user._id
      });
    }

    res.json(record);
  } catch (err) {
    console.error('Update Intec error:', err);
    res.status(500).json({ message: 'Server error updating Intec record' });
  }
});

// DELETE /api/intec/:id
router.delete('/:id', async (req, res) => {
  try {
    const record = await Intec.findByIdAndDelete(req.params.id);
    if (!record) {
      return res.status(404).json({ message: 'Record not found' });
    }
    // Delete associated notes and activities
    await Note.deleteMany({ intec: req.params.id });
    await Activity.deleteMany({ intec: req.params.id });
    res.json({ message: 'Record deleted successfully' });
  } catch (err) {
    console.error('Delete Intec error:', err);
    res.status(500).json({ message: 'Server error deleting Intec record' });
  }
});

// POST /api/intec/:id/labels - update labels
router.post('/:id/labels', async (req, res) => {
  try {
    const { labels } = req.body;
    const record = await Intec.findByIdAndUpdate(
      req.params.id,
      { labels },
      { new: true }
    );
    if (!record) return res.status(404).json({ message: 'Record not found' });

    // Log Activity: Labels
    await Activity.create({
      intec: record._id,
      type: 'Label',
      content: `Labels updated to: ${labels.join(', ')} by ${req.user.name}`,
      performedBy: req.user._id
    });

    res.json(record);
  } catch (err) {
    res.status(500).json({ message: 'Server error updating labels' });
  }
});

// POST /api/intec/:id/convert - mark as converted
router.post('/:id/convert', async (req, res) => {
  try {
    const record = await Intec.findByIdAndUpdate(
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
      intec: record._id,
      type: 'Conversion',
      content: `Record marked as Converted by ${req.user.name}`,
      performedBy: req.user._id
    });

    res.json(record);
  } catch (err) {
    res.status(500).json({ message: 'Server error converting record' });
  }
});

// POST /api/intec/:id/notes - add note
router.post('/:id/notes', async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Note content is required' });
    }

    const note = await Note.create({
      intec: req.params.id,
      content: content.trim(),
      author: req.user._id,
      authorName: req.user.name
    });

    // Log Activity: Note
    await Activity.create({
      intec: req.params.id,
      type: 'Note',
      content: `New note added by ${req.user.name}: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`,
      performedBy: req.user._id
    });

    res.status(201).json(note);
  } catch (err) {
    res.status(500).json({ message: 'Server error creating note' });
  }
});

// GET /api/intec/:id/notes - get notes
router.get('/:id/notes', async (req, res) => {
  try {
    const notes = await Note.find({ intec: req.params.id })
      .sort({ createdAt: -1 })
      .populate('author', 'name email');
    res.json(notes);
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching notes' });
  }
});

// POST /api/intec/:id/date - set callback/followup/installation date
router.post('/:id/date', async (req, res) => {
  try {
    const { callbackDate, followUpDate, installationDate, note } = req.body;
    
    const record = await Intec.findById(req.params.id);
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
      intec: record._id,
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

// GET /api/intec/:id/activities - get timeline
router.get('/:id/activities', async (req, res) => {
  try {
    const activities = await Activity.find({ intec: req.params.id })
      .sort({ createdAt: -1 })
      .populate('performedBy', 'name email');
    res.json(activities);
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching activities' });
  }
});

// POST /api/intec/:id/whatsapp-log - Log WhatsApp
router.post('/:id/whatsapp-log', async (req, res) => {
  try {
    await Activity.create({
      intec: req.params.id,
      type: 'WhatsApp',
      content: `WhatsApp outreach initiated by ${req.user.name}`,
      performedBy: req.user._id
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Server error logging WhatsApp outreach' });
  }
});

// POST /api/intec/:id/email-log - Log Email
router.post('/:id/email-log', async (req, res) => {
  try {
    await Activity.create({
      intec: req.params.id,
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

module.exports = router;
