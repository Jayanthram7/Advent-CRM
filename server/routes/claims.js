const express = require('express');
const router = express.Router();
const Claim = require('../models/Claim');
const Lead = require('../models/Lead');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

// Public route to post data from the external quiz app
// POST /api/claims
router.post('/', async (req, res) => {
  try {
    const { name, phone, email, organization, score, totalQuestions } = req.body;
    
    // Basic validation
    if (!name || !phone || !email || organization === undefined || score === undefined || totalQuestions === undefined) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Upsert based on email
    const claim = await Claim.findOneAndUpdate(
      { email: email.toLowerCase().trim() },
      { 
        name: name.trim(), 
        phone: phone.trim(), 
        email: email.toLowerCase().trim(), 
        organization: organization.trim(), 
        score: Number(score), 
        totalQuestions: Number(totalQuestions) 
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.status(201).json(claim);
  } catch (err) {
    console.error('Error posting claim:', err);
    res.status(500).json({ message: 'Server error saving claim data', error: err.message });
  }
});

// Protected route to fetch quiz users (Admin only)
// GET /api/claims
router.get('/', authMiddleware, roleMiddleware('Admin'), async (req, res) => {
  try {
    const { search } = req.query;
    let query = {};
    if (search) {
      const searchRegex = { $regex: search, $options: 'i' };
      query = {
        $or: [
          { name: searchRegex },
          { email: searchRegex },
          { phone: searchRegex },
          { organization: searchRegex }
        ]
      };
    }
    const claims = await Claim.find(query).sort({ createdAt: -1 }).lean();
    
    // Check if leads with the same emails exist in the database
    const emails = claims.map(c => c.email).filter(Boolean);
    const existingLeads = await Lead.find({ email: { $in: emails } }).select('email');
    const leadEmails = new Set(existingLeads.map(l => l.email.toLowerCase().trim()));

    const claimsWithStatus = claims.map(c => ({
      ...c,
      isConverted: c.email ? leadEmails.has(c.email.toLowerCase().trim()) : false
    }));

    res.json(claimsWithStatus);
  } catch (err) {
    console.error('Error fetching claims:', err);
    res.status(500).json({ message: 'Server error fetching claim data', error: err.message });
  }
});

// Protected route to delete a quiz user (Admin only)
// DELETE /api/claims/:id
router.delete('/:id', authMiddleware, roleMiddleware('Admin'), async (req, res) => {
  try {
    const claim = await Claim.findByIdAndDelete(req.params.id);
    if (!claim) {
      return res.status(404).json({ message: 'Quiz user not found' });
    }
    res.json({ message: 'Quiz user deleted successfully' });
  } catch (err) {
    console.error('Error deleting claim:', err);
    res.status(500).json({ message: 'Server error deleting claim data', error: err.message });
  }
});

module.exports = router;
