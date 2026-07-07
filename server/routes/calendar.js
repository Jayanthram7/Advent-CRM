const express = require('express');
const router = express.Router();
const CalendarEvent = require('../models/CalendarEvent');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

// GET /api/calendar
router.get('/', async (req, res) => {
  try {
    const isAgent = req.user.role === 'Agent';
    const userId = req.user._id;

    // Build filter query
    const query = {};
    if (isAgent) {
      query.assignedTo = userId;
    }

    const events = await CalendarEvent.find(query).sort({ date: 1, time: 1 });
    res.json(events);
  } catch (err) {
    console.error('Error fetching calendar events:', err);
    res.status(500).json({ message: 'Error fetching calendar events' });
  }
});

// POST /api/calendar
router.post('/', async (req, res) => {
  try {
    const { title, description, date, time, type, assignedTo } = req.body;
    
    if (!title || !date || !type) {
      return res.status(400).json({ message: 'Title, date, and type are required' });
    }

    // Default assignee to current user if none provided
    const assignee = assignedTo || req.user._id;

    const newEvent = new CalendarEvent({
      title,
      description,
      date,
      time,
      type,
      assignedTo: assignee
    });

    await newEvent.save();
    res.status(201).json(newEvent);
  } catch (err) {
    console.error('Error creating calendar event:', err);
    res.status(500).json({ message: 'Error creating calendar event' });
  }
});

// PUT /api/calendar/:id
router.put('/:id', async (req, res) => {
  try {
    const { title, description, date, time, type, isCompleted, assignedTo } = req.body;
    const event = await CalendarEvent.findById(req.params.id);

    if (!event) {
      return res.status(444).json({ message: 'Event not found' });
    }

    // Authorization check for agent
    if (req.user.role === 'Agent' && event.assignedTo.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    if (title !== undefined) event.title = title;
    if (description !== undefined) event.description = description;
    if (date !== undefined) event.date = date;
    if (time !== undefined) event.time = time;
    if (type !== undefined) event.type = type;
    if (isCompleted !== undefined) event.isCompleted = isCompleted;
    if (assignedTo !== undefined) event.assignedTo = assignedTo;

    await event.save();
    res.json(event);
  } catch (err) {
    console.error('Error updating calendar event:', err);
    res.status(500).json({ message: 'Error updating calendar event' });
  }
});

// DELETE /api/calendar/:id
router.delete('/:id', async (req, res) => {
  try {
    const event = await CalendarEvent.findById(req.params.id);

    if (!event) {
      return res.status(444).json({ message: 'Event not found' });
    }

    // Authorization check for agent
    if (req.user.role === 'Agent' && event.assignedTo.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    await event.deleteOne();
    res.json({ message: 'Event deleted successfully' });
  } catch (err) {
    console.error('Error deleting calendar event:', err);
    res.status(500).json({ message: 'Error deleting calendar event' });
  }
});

module.exports = router;
