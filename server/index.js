require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
mongoose.set('bufferCommands', false);
const cors = require('cors');

const authRoutes = require('./routes/auth');
const leadRoutes = require('./routes/leads');
const callRoutes = require('./routes/calls');
const eventRoutes = require('./routes/events');
const userRoutes = require('./routes/users');
const noteRoutes = require('./routes/notes');
const dashboardRoutes = require('./routes/dashboard');
const tssRoutes = require('./routes/tss');
const claimRoutes = require('./routes/claims');
const emailRoutes = require('./routes/emails');

const app = express();

app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    process.env.CLIENT_URL,
    'https://advent-leads.vercel.app'
  ].filter(Boolean),
  credentials: true
}));

let dbPromise = null;
const connectDB = async () => {
  if (mongoose.connection.readyState >= 1) return;
  if (!dbPromise) {
    dbPromise = mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000
    }).then(async (m) => {
      console.log('✅ MongoDB connected');
      await seedAdmin();
      return m;
    }).catch(err => {
      dbPromise = null;
      console.error('❌ MongoDB connection failed:', err.message);
      throw err;
    });
  }
  return dbPromise;
};

app.use(async (req, res, next) => {
  if (req.path === '/api/health') return next();
  try {
    await connectDB();
    next();
  } catch (err) {
    res.status(500).json({ message: 'Database connection failed', error: err.message });
  }
});
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/tss', tssRoutes);
app.use('/api/claims', claimRoutes);
app.use('/api/emails', emailRoutes);

app.get('/api/health', (req, res) => {
  const states = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
  res.json({ status: 'ok', db: states[mongoose.connection.readyState], ts: new Date().toISOString() });
});

const PORT = process.env.PORT || 5000;

async function seedAdmin() {
  try {
    const User = require('./models/User');
    const bcrypt = require('bcryptjs');
    const exists = await User.findOne({ email: 'jayanthramnithin@gmail.com' });
    const hash = await bcrypt.hash('jrnk72004nithu', 10);
    if (!exists) {
      await User.create({ name: 'Jayanth Ram Nithin', email: 'jayanthramnithin@gmail.com', password: hash, role: 'Admin', status: 'Active' });
      console.log('✅ Admin user seeded');
    } else {
      const isMatch = await bcrypt.compare('jrnk72004nithu', exists.password);
      if (!isMatch || exists.status !== 'Active' || exists.role !== 'Admin') {
        exists.password = hash;
        exists.role = 'Admin';
        exists.status = 'Active';
        await exists.save();
        console.log('✅ Admin user updated with correct credentials');
      } else {
        console.log('✅ Admin user already exists and credentials are correct');
      }
    }
  } catch (e) {
    console.error('Seed error:', e.message);
  }
}

// Database connection and seeding are now handled dynamically by request middleware

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 Backend running → http://localhost:${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/api/health`);
  });
  // Eagerly connect to MongoDB in local development for diagnostic logging
  connectDB().catch(() => {});
}

module.exports = app;
