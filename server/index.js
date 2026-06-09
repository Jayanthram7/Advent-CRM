require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const leadRoutes = require('./routes/leads');
const callRoutes = require('./routes/calls');
const intecRoutes = require('./routes/intec');
const userRoutes = require('./routes/users');
const noteRoutes = require('./routes/notes');
const dashboardRoutes = require('./routes/dashboard');
const tssRoutes = require('./routes/tss');

const app = express();

app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true
}));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/intec', intecRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/tss', tssRoutes);

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
    if (!exists) {
      const hash = await bcrypt.hash('181104', 10);
      await User.create({ name: 'Jayanth Ram Nithin', email: 'jayanthramnithin@gmail.com', password: hash, role: 'Admin', status: 'Active' });
      console.log('✅ Admin user seeded');
    } else {
      console.log('✅ Admin user already exists');
    }
  } catch (e) {
    console.error('Seed error:', e.message);
  }
}

mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 })
  .then(() => {
    console.log('✅ MongoDB connected');
    seedAdmin();
  })
  .catch(err => {
    console.error('❌ MongoDB connection failed:', err.message);
    console.error('');
    console.error('══════════════════════════════════════════════════════════════');
    console.error('  ACTION REQUIRED — Add your IP to MongoDB Atlas:');
    console.error('  1. Go to https://cloud.mongodb.com');
    console.error('  2. Security → Network Access → Add IP Address');
    console.error('  3. Select "Allow Access From Anywhere" (0.0.0.0/0)');
    console.error('  4. Save, wait ~30s, then restart this server');
    console.error('══════════════════════════════════════════════════════════════');
  });

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 Backend running → http://localhost:${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/api/health`);
  });
}

module.exports = app;
