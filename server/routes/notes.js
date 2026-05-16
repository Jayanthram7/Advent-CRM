const express = require('express');
const router = express.Router();
const Note = require('../models/Note');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

// GET /api/notes/:leadId
router.get('/:leadId', async (req, res) => {
  try {
    const notes = await Note.find({ lead: req.params.leadId })
      .sort({ createdAt: -1 })
      .populate('author', 'name email');
    res.json(notes);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching notes' });
  }
});

module.exports = router;
