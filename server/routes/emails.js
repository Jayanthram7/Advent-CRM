const express = require('express');
const router = express.Router();
const EmailTemplate = require('../models/EmailTemplate');
const Lead = require('../models/Lead');
const Claim = require('../models/Claim');
const EventRecord = require('../models/EventRecord');
const TssRecord = require('../models/TssRecord');
const sendEmail = require('../utils/mailer');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

router.use(authMiddleware);
router.use(roleMiddleware('Admin'));

// GET /api/emails/templates - Get all templates
router.get('/templates', async (req, res) => {
  try {
    const templates = await EmailTemplate.find().sort({ createdAt: -1 });
    res.json(templates);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching templates' });
  }
});

// POST /api/emails/templates - Create or update template
router.post('/templates', async (req, res) => {
  try {
    const { id, name, subject, body } = req.body;
    if (!name || !subject || !body) {
      return res.status(400).json({ message: 'Name, subject, and body are required' });
    }

    let template;
    if (id) {
      template = await EmailTemplate.findByIdAndUpdate(id, { name, subject, body }, { new: true });
    } else {
      const existing = await EmailTemplate.findOne({ name });
      if (existing) {
        return res.status(400).json({ message: 'Template name already exists' });
      }
      template = await EmailTemplate.create({ name, subject, body });
    }
    res.status(201).json(template);
  } catch (err) {
    res.status(500).json({ message: 'Error saving template' });
  }
});

// DELETE /api/emails/templates/:id - Delete template
router.delete('/templates/:id', async (req, res) => {
  try {
    await EmailTemplate.findByIdAndDelete(req.params.id);
    res.json({ message: 'Template deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting template' });
  }
});

// GET /api/emails/contacts/tss - Fetch filtered TSS contacts
router.get('/contacts/tss', async (req, res) => {
  try {
    const { label, dateField, startDate, endDate } = req.query;
    const query = {};

    if (label && label !== 'All') {
      query.labels = label;
    }

    const tssRecords = await TssRecord.find(query).lean();

    // Helper to extract email dynamically from TSS Map data
    const getTssEmail = (record) => {
      if (!record.data) return null;
      const emailKey = Object.keys(record.data).find(k =>
        k.toLowerCase().includes('email') || k.toLowerCase().includes('e-mail')
      );
      return emailKey ? String(record.data[emailKey]).trim() : null;
    };

    // Helper to get robust date value
    const getTssDateValue = (record, field) => {
      if (field === 'createdAt') {
        return record.createdAt ? new Date(record.createdAt) : null;
      }
      if (field === 'callbackDate' && record.callbackDate) {
        return new Date(record.callbackDate);
      }
      if (field === 'followUpDate' && record.followUpDate) {
        return new Date(record.followUpDate);
      }

      // For renewalDate, try renewalDate field, then fall back to expiry date keys in data
      if (field === 'renewalDate') {
        if (record.renewalDate && !isNaN(new Date(record.renewalDate).getTime())) {
          return new Date(record.renewalDate);
        }
        if (record.data) {
          const dateKey = Object.keys(record.data).find(k =>
            k.toLowerCase().includes('expiry') || k.toLowerCase().includes('renewal')
          );
          if (dateKey) {
            const parsed = new Date(record.data[dateKey]);
            if (!isNaN(parsed.getTime())) {
              return parsed;
            }
          }
        }
      }

      // Default fallback: check schema field, then custom data map keys
      if (record[field] && !isNaN(new Date(record[field]).getTime())) {
        return new Date(record[field]);
      }
      if (record.data && record.data[field]) {
        const parsed = new Date(record.data[field]);
        if (!isNaN(parsed.getTime())) {
          return parsed;
        }
      }
      return null;
    };

    const contacts = [];
    const seenEmails = new Set();

    const filterStart = startDate ? new Date(startDate) : null;
    const filterEnd = endDate ? new Date(endDate) : null;

    // Set time limits for strict day comparisons
    if (filterStart) {
      filterStart.setHours(0, 0, 0, 0);
    }
    if (filterEnd) {
      filterEnd.setHours(23, 59, 59, 999);
    }

    tssRecords.forEach(t => {
      const email = getTssEmail(t);
      if (!email) return;

      // Date filtering in memory
      if (dateField && (filterStart || filterEnd)) {
        const recordDate = getTssDateValue(t, dateField);
        if (!recordDate) return; // Skip if no date matches

        if (filterStart && recordDate < filterStart) return;
        if (filterEnd && recordDate > filterEnd) return;
      }

      const emailLower = email.toLowerCase().trim();
      if (!seenEmails.has(emailLower)) {
        seenEmails.add(emailLower);
        contacts.push({
          name: t.customerName || 'TSS Contact',
          email: email,
          phone: t.mobileNumber || '',
          source: 'TSS'
        });
      }
    });

    res.json(contacts);
  } catch (err) {
    console.error('Error fetching filtered TSS contacts:', err);
    res.status(500).json({ message: 'Error fetching filtered TSS contacts' });
  }
});

// GET /api/emails/contacts - Search contacts across Leads and Quiz Users (Claims)
router.get('/contacts', async (req, res) => {
  try {
    const { search } = req.query;
    if (!search || search.trim().length < 2) {
      return res.json([]);
    }

    const regex = new RegExp(search.trim(), 'i');

    // Query Leads
    const leads = await Lead.find({
      $or: [
        { firstName: regex },
        { lastName: regex },
        { email: regex },
        { company: regex }
      ]
    }).limit(20).lean();

    // Query Claims (Quiz Users)
    const claims = await Claim.find({
      $or: [
        { name: regex },
        { email: regex },
        { organization: regex }
      ]
    }).limit(20).lean();

    // Query Event Records
    const events = await EventRecord.find({
      $or: [
        { contactPerson: regex },
        { email: regex },
        { companyName: regex }
      ]
    }).limit(20).lean();

    // Query TSS Records
    const tss = await TssRecord.find({
      $or: [
        { customerName: regex },
        { mobileNumber: regex }
      ]
    }).limit(20).lean();

    const contacts = [];
    const seenEmails = new Set();

    // Helper to extract email dynamically from TSS Map data
    const getTssEmail = (record) => {
      if (!record.data) return null;
      // Look for any keys containing "email" or "e-mail"
      const emailKey = Object.keys(record.data).find(k =>
        k.toLowerCase().includes('email') || k.toLowerCase().includes('e-mail')
      );
      return emailKey ? String(record.data[emailKey]).trim() : null;
    };

    leads.forEach(l => {
      if (l.email) {
        const emailLower = l.email.toLowerCase().trim();
        if (!seenEmails.has(emailLower)) {
          seenEmails.add(emailLower);
          contacts.push({
            name: `${l.firstName || ''} ${l.lastName || ''}`.trim(),
            email: l.email,
            phone: l.phone || '',
            source: 'Lead'
          });
        }
      }
    });

    claims.forEach(c => {
      if (c.email) {
        const emailLower = c.email.toLowerCase().trim();
        if (!seenEmails.has(emailLower)) {
          seenEmails.add(emailLower);
          contacts.push({
            name: c.name,
            email: c.email,
            phone: c.phone || '',
            source: 'Quiz User'
          });
        }
      }
    });

    events.forEach(e => {
      if (e.email) {
        const emailLower = e.email.toLowerCase().trim();
        if (!seenEmails.has(emailLower)) {
          seenEmails.add(emailLower);
          contacts.push({
            name: e.contactPerson || e.companyName || 'Event Contact',
            email: e.email,
            phone: e.mobile1 || e.mobile2 || '',
            source: 'Event'
          });
        }
      }
    });

    tss.forEach(t => {
      const email = getTssEmail(t);
      if (email) {
        const emailLower = email.toLowerCase().trim();
        if (!seenEmails.has(emailLower)) {
          seenEmails.add(emailLower);
          contacts.push({
            name: t.customerName || 'TSS Contact',
            email: email,
            phone: t.mobileNumber || '',
            source: 'TSS'
          });
        }
      }
    });

    res.json(contacts);
  } catch (err) {
    console.error('Error searching contacts:', err);
    res.status(500).json({ message: 'Error searching contacts' });
  }
});

// POST /api/emails/send - Send bulk emails
router.post('/send', async (req, res) => {
  try {
    const { recipients, subject, body } = req.body;
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ message: 'Recipients array is required' });
    }
    if (!subject || !body) {
      return res.status(400).json({ message: 'Subject and body are required' });
    }

    let successCount = 0;
    let failCount = 0;
    const failures = [];

    for (const recipient of recipients) {
      try {
        if (!recipient.email) {
          failures.push({ recipient, error: 'No email address' });
          failCount++;
          continue;
        }

        const personalizedSubject = subject.replace(/\{\{\s*name\s*\}\}/gi, recipient.name || 'Customer');
        const personalizedBody = body.replace(/\{\{\s*name\s*\}\}/gi, recipient.name || 'Customer');

        await sendEmail({
          to: recipient.email,
          subject: personalizedSubject,
          html: personalizedBody
        });

        successCount++;
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (err) {
        failures.push({ recipient: recipient.email, error: err.message });
        failCount++;
      }
    }

    res.json({
      success: true,
      successCount,
      failCount,
      failures
    });
  } catch (err) {
    console.error('Error in send broadcast:', err);
    res.status(500).json({ message: 'Error sending broadcast' });
  }
});

module.exports = router;
module.exports = router;
