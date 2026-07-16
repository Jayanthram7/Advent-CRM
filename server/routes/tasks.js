const express = require('express');
const router = express.Router();
const Task = require('../models/Task');
const Note = require('../models/Note');
const Activity = require('../models/Activity');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

router.use(authMiddleware);

// POST /api/tasks - Create custom task (Admin/Manager only)
router.post('/', roleMiddleware('Admin', 'Manager'), async (req, res) => {
  try {
    const { title, description, assignedTo, label } = req.body;
    if (!title || !assignedTo) {
      return res.status(400).json({ message: 'Title and assigned employee are required' });
    }

    const task = await Task.create({
      title,
      description,
      assignedTo,
      createdBy: req.user._id,
      labels: label ? [label] : ['Open']
    });

    await Activity.create({
      task: task._id,
      type: 'Creation',
      content: `Custom task "${title}" created by ${req.user.name}`,
      performedBy: req.user._id
    });

    res.status(201).json(task);
  } catch (err) {
    console.error('Error creating custom task:', err);
    res.status(500).json({ message: 'Server error creating custom task' });
  }
});

// GET /api/tasks/:id - Get details of a single custom task
router.get('/:id', async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('assignedTo', 'name email role')
      .populate('createdBy', 'name email role');
    if (!task) return res.status(404).json({ message: 'Task not found' });
    res.json(task);
  } catch (err) {
    console.error('Error fetching task details:', err);
    res.status(500).json({ message: 'Server error fetching task details' });
  }
});

// PUT /api/tasks/:id - Update task fields (assignedTo, etc.)
router.put('/:id', async (req, res) => {
  try {
    const { assignedTo, status } = req.body;
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    if (assignedTo !== undefined) {
      task.assignedTo = assignedTo;
      await Activity.create({
        task: task._id,
        type: 'Assignment',
        content: assignedTo ? `Task assigned` : `Task unassigned`,
        performedBy: req.user._id
      });
    }

    if (status !== undefined) {
      task.status = status;
      if (status === 'Closed') {
        task.labels = ['Closed'];
      }
    }

    await task.save();
    res.json(task);
  } catch (err) {
    console.error('Error updating task:', err);
    res.status(500).json({ message: 'Server error updating task' });
  }
});

// DELETE /api/tasks/:id - Delete a task
router.delete('/:id', roleMiddleware('Admin', 'Manager'), async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    // Cleanup notes and activities
    await Note.deleteMany({ task: req.params.id });
    await Activity.deleteMany({ task: req.params.id });

    res.json({ message: 'Task deleted successfully' });
  } catch (err) {
    console.error('Error deleting task:', err);
    res.status(500).json({ message: 'Server error deleting task' });
  }
});

// POST /api/tasks/:id/labels - Update label
router.post('/:id/labels', async (req, res) => {
  try {
    const { labels } = req.body;
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    const prevLabel = task.labels[0] || 'Open';
    task.labels = labels;
    await task.save();

    await Activity.create({
      task: task._id,
      type: 'Label',
      content: `Changed label from "${prevLabel}" to "${task.labels[0]}"`,
      performedBy: req.user._id
    });

    res.json(task);
  } catch (err) {
    console.error('Error updating labels:', err);
    res.status(500).json({ message: 'Server error updating labels' });
  }
});

// POST /api/tasks/:id/date - Update date
router.post('/:id/date', async (req, res) => {
  try {
    const { callbackDate, followUpDate, installationDate } = req.body;
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    if (callbackDate !== undefined) task.callbackDate = callbackDate;
    if (followUpDate !== undefined) task.followUpDate = followUpDate;
    if (installationDate !== undefined) task.installationDate = installationDate;

    await task.save();

    await Activity.create({
      task: task._id,
      type: 'DateUpdate',
      content: `Task dates updated`,
      performedBy: req.user._id
    });

    res.json(task);
  } catch (err) {
    console.error('Error updating date:', err);
    res.status(500).json({ message: 'Server error updating date' });
  }
});

// POST /api/tasks/:id/convert - Mark task as completed/converted
router.post('/:id/convert', roleMiddleware('Admin'), async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    task.status = 'Closed';
    task.labels = ['Closed'];
    await task.save();

    await Activity.create({
      task: task._id,
      type: 'Conversion',
      content: `Task marked as completed`,
      performedBy: req.user._id
    });

    res.json(task);
  } catch (err) {
    console.error('Error converting task:', err);
    res.status(500).json({ message: 'Server error converting task' });
  }
});

// POST /api/tasks/:id/notes - Add note
router.post('/:id/notes', async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) return res.status(400).json({ message: 'Content is required' });

    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    const note = await Note.create({
      task: task._id,
      content,
      author: req.user._id,
      authorName: req.user.name
    });

    await Activity.create({
      task: task._id,
      type: 'Note',
      content: `Added a note: "${content.substring(0, 30)}..."`,
      performedBy: req.user._id
    });

    res.json(note);
  } catch (err) {
    console.error('Error adding note:', err);
    res.status(500).json({ message: 'Server error adding note' });
  }
});

// GET /api/tasks/:id/notes - Get notes
router.get('/:id/notes', async (req, res) => {
  try {
    const notes = await Note.find({ task: req.params.id })
      .populate('author', 'name role')
      .sort({ createdAt: -1 });
    res.json(notes);
  } catch (err) {
    console.error('Error fetching notes:', err);
    res.status(500).json({ message: 'Server error fetching notes' });
  }
});

// GET /api/tasks/:id/activities - Get activities
router.get('/:id/activities', async (req, res) => {
  try {
    const activities = await Activity.find({ task: req.params.id })
      .populate('performedBy', 'name role')
      .sort({ createdAt: -1 });
    res.json(activities);
  } catch (err) {
    console.error('Error fetching activities:', err);
    res.status(500).json({ message: 'Server error fetching activities' });
  }
});

module.exports = router;
