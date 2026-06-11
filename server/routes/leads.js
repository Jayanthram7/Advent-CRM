const express = require('express');
const router = express.Router();
const Lead = require('../models/Lead');
const Note = require('../models/Note');
const Activity = require('../models/Activity');
const { Resend } = require('resend');


const resend = new Resend('re_LSfRqxrV_9dAg5rmMmoe6kHDJxzBCkThR');
const authMiddleware = require('../middleware/authMiddleware');

// All routes require authentication
router.use(authMiddleware);

// GET /api/leads - list leads with filters and pagination
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

    // Role-based filtering: Agents only see their assigned leads
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

    // Date set filter (leads with a callbackDate or followUp or installation)
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

    const [leads, total] = await Promise.all([
      Lead.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit))
        .populate('assignedTo', 'name email')
        .populate('createdBy', 'name email'),
      Lead.countDocuments(query)
    ]);

    const leadsWithNotes = await Promise.all(leads.map(async (lead) => {
      const noteCount = await Note.countDocuments({ lead: lead._id });
      return { ...lead.toObject(), noteCount };
    }));

    res.json({
      leads: leadsWithNotes,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      limit: parseInt(limit)
    });

  } catch (err) {
    console.error('Get leads error:', err);
    res.status(500).json({ message: 'Server error fetching leads' });
  }
});

// GET /api/leads/:id - get a single lead
router.get('/:id', async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id)
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name email');
    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }
    res.json(lead);
  } catch (err) {
    console.error('Get lead error:', err);
    res.status(500).json({ message: 'Server error fetching lead' });
  }
});

// POST /api/leads - create lead
router.post('/', async (req, res) => {
  try {
    const {
      firstName, lastName, email, phone, secondaryPhone,
      company, licenseNumber, leadSource, address, city, country, labels, reason
    } = req.body;

    if (!firstName || !lastName) {
      return res.status(400).json({ message: 'First name and last name are required' });
    }

    const lead = await Lead.create({
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
      assignedTo: req.user._id
    });

    // Log Activity: Creation
    await Activity.create({
      lead: lead._id,
      type: 'Creation',
      content: `Lead created by ${req.user.name}`,
      performedBy: req.user._id
    });


    // Send Welcome Email if lead has an email address
    if (email) {
      try {
        await resend.emails.send({
          from: 'Advent Systems <jayanthramnithin@gmail.com>',
          to: email,
          subject: 'Welcome to Advent Systems',
          html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to Advent Systems</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:wght@400;500;600&display=swap');

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      background-color: #f0f2f5;
      font-family: 'DM Sans', Arial, sans-serif;
      color: #1a1a2e;
    }

    .email-wrapper {
      max-width: 600px;
      margin: 0 auto;
      background-color: #f0f2f5;
    }

    /* View in browser */
    .top-bar {
      text-align: center;
      padding: 12px 0 8px;
      font-size: 11px;
      color: #888;
      font-family: 'DM Sans', Arial, sans-serif;
    }
    .top-bar a {
      color: #888;
      text-decoration: underline;
    }

    /* Main card */
    .main-card {
      background: #ffffff;
      border-radius: 18px;
      overflow: hidden;
      margin: 0 16px 16px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.07);
    }

    /* Header */
    .header {
      text-align: center;
      padding: 36px 32px 28px;
    }

    .logo {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 26px;
      font-weight: 700;
      color: #1a1a2e;
      letter-spacing: -0.5px;
      margin-bottom: 24px;
    }

    .logo span {
      background: linear-gradient(135deg, #4f46e5, #7c3aed);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .tally-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: linear-gradient(135deg, #fef3c7, #fde68a);
      border: 1px solid #f59e0b;
      border-radius: 20px;
      padding: 4px 14px;
      font-size: 11px;
      font-weight: 600;
      color: #92400e;
      letter-spacing: 0.3px;
      margin-bottom: 28px;
    }

    .tally-badge .star-icon {
      color: #f59e0b;
      font-size: 12px;
    }

    .header h1 {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 36px;
      font-weight: 700;
      color: #0f0f23;
      line-height: 1.15;
      letter-spacing: -0.8px;
      margin-bottom: 14px;
    }

    .header p {
      font-size: 14px;
      color: #6b7280;
      line-height: 1.6;
      max-width: 380px;
      margin: 0 auto 24px;
    }

    .cta-btn {
      display: inline-block;
      background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
      color: #ffffff !important;
      text-decoration: none;
      font-family: 'DM Sans', Arial, sans-serif;
      font-size: 13px;
      font-weight: 600;
      padding: 13px 28px;
      border-radius: 50px;
      letter-spacing: 0.3px;
      box-shadow: 0 4px 14px rgba(79, 70, 229, 0.35);
    }

    /* Benefits section */
    .benefits-section {
      padding: 0 32px 32px;
    }

    .benefits-section h2 {
      font-family: 'DM Sans', Arial, sans-serif;
      font-size: 13px;
      font-weight: 600;
      color: #6b7280;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      margin-bottom: 18px;
    }

    .benefits-grid {
      display: flex;
      flex-wrap: wrap;
      border-top: 1px solid #e5e7eb;
    }

    .benefit-item {
      width: 50%;
      padding: 16px;
      box-sizing: border-box;
    }

    .benefit-item h3 {
      font-family: 'DM Sans', Arial, sans-serif;
      font-size: 22px;
      font-weight: 700;
      color: #2563eb;
      margin-bottom: 5px;
    }

    .benefit-item p {
      font-size: 12px;
      color: #9ca3af;
      line-height: 1.5;
    }

    /* Team card */
    .team-card {
      margin: 0 32px 32px;
      background: #f9fafb;
      border-radius: 14px;
      padding: 24px;
      text-align: center;
    }

    .avatar-row {
      text-align: center;
      margin-bottom: 14px;
    }

    .avatar {
      display: inline-block;
      width: 38px;
      height: 38px;
      border-radius: 50%;
      border: 2px solid #fff;
      margin-left: -8px;
      background: linear-gradient(135deg, #a78bfa, #6366f1);
      line-height: 34px;
      font-size: 14px;
      color: #fff;
      font-weight: 700;
      overflow: hidden;
      vertical-align: middle;
    }

    .avatar:first-child { margin-left: 0; background: linear-gradient(135deg, #f472b6, #ec4899); }
    .avatar:nth-child(2) { background: linear-gradient(135deg, #34d399, #059669); }
    .avatar:nth-child(3) { background: linear-gradient(135deg, #fbbf24, #d97706); }
    .avatar:nth-child(4) { background: linear-gradient(135deg, #60a5fa, #3b82f6); }

    .team-card p {
      font-size: 13px;
      color: #6b7280;
      margin-bottom: 4px;
    }

    .team-card .company-name {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 20px;
      font-weight: 700;
      color: #4f46e5;
    }

    /* Footer */
    .footer {
      background: #f9fafb;
      border-radius: 0 0 18px 18px;
      padding: 20px 32px;
      text-align: center;
      border-top: 1px solid #e5e7eb;
    }

    .footer p {
      font-size: 11px;
      color: #9ca3af;
      line-height: 1.7;
      margin-bottom: 6px;
    }

    .footer a {
      color: #6366f1;
      text-decoration: none;
      font-weight: 500;
    }

    .footer .contact-line {
      font-size: 12px;
      color: #6b7280;
      margin: 10px 0 6px;
    }

    .footer .contact-line a {
      color: #4f46e5;
      font-weight: 600;
    }

    /* Watermark */
    .watermark {
      text-align: center;
      padding: 20px 16px 28px;
      overflow: hidden;
    }

    .watermark span {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 72px;
      font-weight: 700;
      color: rgba(79,70,229,0.06);
      letter-spacing: -2px;
      white-space: nowrap;
    }
  </style>
</head>
<body>

<div class="email-wrapper">
  <div class="top-bar">
    <a href="#">View this email in your browser</a>
  </div>

  <div class="main-card">
    <div class="header">
      <div class="logo"><span>Advent Systems</span></div>

      <div class="tally-badge">
        <span class="star-icon">★★★★★</span>
        5-Star Certified Partner of Tally
      </div>

      <h1>Hey ${firstName},<br>Welcome to<br>Advent Systems.</h1>
      <p>Promoted in the early 1980s under the leadership of <strong>Mr. Kanakaraj Chinnaswamy</strong>, Advent Systems is among the earliest IT/ITES organizations in the region — at the forefront of Sales, Support, Training, and Customization of Tally for over three decades.</p>

      <a href="https://adventsystems.vercel.app" class="cta-btn">Visit our Website</a>
    </div>

    <div class="benefits-section">
      <h2>Why choose Advent Systems:</h2>
      <div class="benefits-grid">
        <div class="benefit-item" style="border-right: 1px solid #e5e7eb;">
          <h3>5 Star</h3>
          <p>Certified Partner of Tally — trusted for quality and expertise.</p>
        </div>
        <div class="benefit-item">
          <h3>35+ years</h3>
          <p>Tally Partnership — one of the earliest partners in India.</p>
        </div>
        <div class="benefit-item" style="border-right: 1px solid #e5e7eb; border-top: 1px solid #e5e7eb;">
          <h3>3500+</h3>
          <p>Customers Supported — MSMEs, consultants, auditors & more.</p>
        </div>
        <div class="benefit-item" style="border-top: 1px solid #e5e7eb;">
          <h3>60+ years</h3>
          <p>Team Expertise — combined knowledge across Sales, Support & Training.</p>
        </div>
      </div>
    </div>

    <div class="team-card">
      <div class="avatar-row">
        <div class="avatar">A</div>
        <div class="avatar">S</div>
        <div class="avatar">T</div>
        <div class="avatar">+</div>
      </div>
      <p>Thanks from our team @</p>
      <div class="company-name">Advent Systems</div>
    </div>

    <div class="footer">
      <p>You received this email because you created an account or subscribed to updates from Advent Systems.</p>
      <p>
        <strong>Advent Systems</strong> — 5-Star Certified Tally Partner<br>
        <a href="https://adventsystems.vercel.app">adventsystems.vercel.app</a>
      </p>
      <p class="contact-line">
        📞 <a href="tel:9842276297">9842276297</a> &nbsp;/&nbsp; <a href="tel:9965573231">9965573231</a>
      </p>
      <p>
        To update your communication settings or to unsubscribe, use the links below.<br>
        <a href="#">Manage Preferences</a> | <a href="#">Unsubscribe</a>
      </p>
      <p style="margin-top:8px;">© 2025 Advent Systems. All rights reserved.</p>
    </div>
  </div>

  <div class="watermark">
    <span>Advent</span>
  </div>
</div>

</body>
</html>
          `
        });
        console.log(`Welcome email sent to ${email}`);
      } catch (emailErr) {
        console.error('Failed to send welcome email:', emailErr);
      }
    }

    res.status(201).json(lead);
  } catch (err) {
    console.error('Create lead error:', err);
    res.status(500).json({ message: 'Server error creating lead' });
  }
});

// PUT /api/leads/:id - update lead
router.put('/:id', async (req, res) => {
  try {
    const lead = await Lead.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    // Log Activity if assignedTo changed
    if (req.body.assignedTo) {
      const User = require('../models/User');
      const assignedUser = await User.findById(req.body.assignedTo);
      await Activity.create({
        lead: lead._id,
        type: 'Assignment',
        content: `Lead assigned to ${assignedUser ? assignedUser.name : 'Unknown User'} by ${req.user.name}`,
        performedBy: req.user._id
      });
    } else {
      await Activity.create({
        lead: lead._id,
        type: 'Update',
        content: `Lead details updated by ${req.user.name}`,
        performedBy: req.user._id
      });
    }

    res.json(lead);

  } catch (err) {
    console.error('Update lead error:', err);
    res.status(500).json({ message: 'Server error updating lead' });
  }
});

// DELETE /api/leads/:id
router.delete('/:id', async (req, res) => {
  try {
    const lead = await Lead.findByIdAndDelete(req.params.id);
    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }
    // Also delete associated notes
    await Note.deleteMany({ lead: req.params.id });
    res.json({ message: 'Lead deleted successfully' });
  } catch (err) {
    console.error('Delete lead error:', err);
    res.status(500).json({ message: 'Server error deleting lead' });
  }
});

// POST /api/leads/:id/labels - add/update labels
router.post('/:id/labels', async (req, res) => {
  try {
    const { labels } = req.body;
    const lead = await Lead.findByIdAndUpdate(
      req.params.id,
      { labels },
      { new: true }
    );
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    
    // Log Activity: Labels
    await Activity.create({
      lead: lead._id,
      type: 'Label',
      content: `Labels updated to: ${labels.join(', ')} by ${req.user.name}`,
      performedBy: req.user._id
    });

    res.json(lead);

  } catch (err) {
    res.status(500).json({ message: 'Server error updating labels' });
  }
});

// POST /api/leads/:id/convert - mark as converted
router.post('/:id/convert', async (req, res) => {
  try {
    const lead = await Lead.findByIdAndUpdate(
      req.params.id,
      { 
        isConverted: true,
        convertedAt: new Date(),
        status: 'Converted'
      },
      { new: true }
    );
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    // Log Activity: Conversion
    await Activity.create({
      lead: lead._id,
      type: 'Conversion',
      content: `Lead marked as Converted by ${req.user.name}`,
      performedBy: req.user._id
    });

    res.json(lead);

  } catch (err) {
    res.status(500).json({ message: 'Server error converting lead' });
  }
});

// POST /api/leads/:id/notes - add note
router.post('/:id/notes', async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Note content is required' });
    }

    const note = await Note.create({
      lead: req.params.id,
      content: content.trim(),
      author: req.user._id,
      authorName: req.user.name
    });

    // Log Activity: Note
    await Activity.create({
      lead: req.params.id,
      type: 'Note',
      content: `New note added by ${req.user.name}: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`,
      performedBy: req.user._id
    });

    res.status(201).json(note);

  } catch (err) {
    res.status(500).json({ message: 'Server error creating note' });
  }
});

// GET /api/leads/:id/notes - get notes for a lead
router.get('/:id/notes', async (req, res) => {
  try {
    const notes = await Note.find({ lead: req.params.id })
      .sort({ createdAt: -1 })
      .populate('author', 'name email');
    res.json(notes);
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching notes' });
  }
});

// POST /api/leads/:id/date - set callback/followup date
router.post('/:id/date', async (req, res) => {
  try {
    const { callbackDate, followUpDate, installationDate, note } = req.body;
    
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    if (callbackDate !== undefined) {
      lead.callbackDate = callbackDate ? new Date(callbackDate) : null;
    }
    if (followUpDate !== undefined) {
      lead.followUpDate = followUpDate ? new Date(followUpDate) : null;
    }
    if (installationDate !== undefined) {
      lead.installationDate = installationDate ? new Date(installationDate) : null;
    }

    if (note && note.trim()) {
      lead.followUpHistory = lead.followUpHistory || [];
      lead.followUpHistory.unshift({
        date: callbackDate || followUpDate || installationDate || new Date(),
        note: note.trim(),
        updatedBy: req.user.name,
        createdAt: new Date()
      });
    }

    await lead.save();

    // Log Activity: Date update
    const dateVal = callbackDate || followUpDate || installationDate;
    const dateType = callbackDate ? 'Callback' : followUpDate ? 'Follow-up' : 'Installation';
    const noteText = note ? ` (Note: ${note})` : '';
    await Activity.create({
      lead: lead._id,
      type: 'DateUpdate',
      content: `${dateType} date set to ${formatDate(dateVal)} by ${req.user.name}${noteText}`,
      performedBy: req.user._id
    });

    res.json(lead);
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

// GET /api/leads/:id/activities - get activity log
router.get('/:id/activities', async (req, res) => {
  try {
    const activities = await Activity.find({ lead: req.params.id })
      .sort({ createdAt: -1 })
      .populate('performedBy', 'name email');
    res.json(activities);
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching activities' });
  }
});

// POST /api/leads/:id/whatsapp-log - Log WhatsApp outreach
router.post('/:id/whatsapp-log', async (req, res) => {
  try {
    await Activity.create({
      lead: req.params.id,
      type: 'WhatsApp',
      content: `WhatsApp outreach initiated by ${req.user.name}`,
      performedBy: req.user._id
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Server error logging WhatsApp activity' });
  }
});


// POST /api/leads/:id/email-log - Log Email outreach
router.post('/:id/email-log', async (req, res) => {
  try {
    await Activity.create({
      lead: req.params.id,
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
