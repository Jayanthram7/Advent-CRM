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
const calendarRoutes = require('./routes/calendar');
const whatsappRoutes = require('./routes/whatsapp');

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
      await seedTemplates();
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
app.use('/api/calendar', calendarRoutes);
app.use('/api/whatsapp', whatsappRoutes);

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

async function seedTemplates() {
  try {
    const EmailTemplate = require('./models/EmailTemplate');
    const templates = [
      {
        name: 'Tally License Expiry',
        subject: 'Action Required: Your Tally License is Expiring Soon',
        body: `<p><strong>Dear {{name}},</strong></p>
<p>This is a friendly reminder that your Tally Prime license subscription is <span style="color: #dc2626; font-weight: bold;">expiring in the next few days.</span></p>
<p>To avoid any disruption to your accounting and business compliance operations, we recommend renewing your license before the expiry date.</p>
<p>Please reply to this email or contact us at our numbers below, and our team will assist you with the renewal process immediately.</p>`
      },
      {
        name: 'Tally Prime New Feature Announcement',
        subject: 'Exciting New Feature Announcement: Enhance Your Tally Workflow',
        body: `<p><strong>Dear {{name}},</strong></p>
<p>We are excited to share a new capability in Tally Prime designed to optimize your business workflow!</p>
<p>With this new update, you can now seamlessly synchronize your business data, automate manual entry, and generate advanced reports with greater ease.</p>
<p>If you'd like to schedule a quick demo or update your Tally software to enable these new features, please reach out to us. We're here to help you get the most out of Tally.</p>`
      }
    ];

    for (const t of templates) {
      const exists = await EmailTemplate.findOne({ name: t.name });
      if (!exists) {
        await EmailTemplate.create(t);
        console.log(`✅ Seeded template: ${t.name}`);
      } else {
        if (exists.body !== t.body || exists.subject !== t.subject) {
          exists.subject = t.subject;
          exists.body = t.body;
          await exists.save();
          console.log(`✅ Updated existing seeded template: ${t.name}`);
        }
      }
    }
  } catch (e) {
    console.error('Templates seed error:', e.message);
  }
}

// Database connection and seeding are now handled dynamically by request middleware

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 Backend running → http://localhost:${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/api/health`);
  });
  // Eagerly connect to MongoDB in local development for diagnostic logging
  connectDB().catch(() => { });
}

module.exports = app;
