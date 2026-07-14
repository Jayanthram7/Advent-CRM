const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const twilio = require('twilio');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

const WhatsappSetting = require('../models/WhatsappSetting');
const WhatsappChat = require('../models/WhatsappChat');

// Middleware to parse urlencoded for Twilio Webhooks
const urlencodedParser = express.Router();
urlencodedParser.use(express.urlencoded({ extended: true }));

// Helper function to obscure sensitive keys
function obscureKey(key) {
  if (!key) return '';
  if (key.length <= 8) return '********';
  return `${key.slice(0, 6)}...${key.slice(-4)}`;
}

// GET /api/whatsapp/settings - Admin Only
router.get('/settings', authMiddleware, roleMiddleware('Admin'), async (req, res) => {
  try {
    let settings = await WhatsappSetting.findOne();
    if (!settings) {
      settings = new WhatsappSetting();
      await settings.save();
    }
    
    // Convert to JSON and obscure keys
    const settingsJSON = settings.toJSON();
    settingsJSON.twilioAuthToken = settings.twilioAuthToken ? obscureKey(settings.twilioAuthToken) : '';
    settingsJSON.geminiApiKey = settings.geminiApiKey ? obscureKey(settings.geminiApiKey) : '';
    
    res.json(settingsJSON);
  } catch (err) {
    console.error('Error fetching WhatsApp settings:', err);
    res.status(500).json({ message: 'Server error fetching WhatsApp settings' });
  }
});

// POST /api/whatsapp/settings - Admin Only
router.post('/settings', authMiddleware, roleMiddleware('Admin'), async (req, res) => {
  try {
    const {
      twilioAccountSid,
      twilioAuthToken,
      twilioPhoneNumber,
      geminiApiKey,
      geminiModel,
      context,
      isEnabled
    } = req.body;

    let settings = await WhatsappSetting.findOne();
    if (!settings) {
      settings = new WhatsappSetting();
    }

    settings.twilioAccountSid = twilioAccountSid !== undefined ? twilioAccountSid : settings.twilioAccountSid;
    
    // Only update tokens if they are not obscured placeholders
    if (twilioAuthToken && !twilioAuthToken.includes('...')) {
      settings.twilioAuthToken = twilioAuthToken;
    }
    
    settings.twilioPhoneNumber = twilioPhoneNumber !== undefined ? twilioPhoneNumber : settings.twilioPhoneNumber;
    
    if (geminiApiKey && !geminiApiKey.includes('...')) {
      settings.geminiApiKey = geminiApiKey;
    }

    settings.geminiModel = geminiModel !== undefined ? geminiModel : settings.geminiModel;
    settings.context = context !== undefined ? context : settings.context;
    settings.isEnabled = isEnabled !== undefined ? isEnabled : settings.isEnabled;

    await settings.save();

    const responseJSON = settings.toJSON();
    responseJSON.twilioAuthToken = settings.twilioAuthToken ? obscureKey(settings.twilioAuthToken) : '';
    responseJSON.geminiApiKey = settings.geminiApiKey ? obscureKey(settings.geminiApiKey) : '';

    res.json({ message: 'Settings saved successfully', settings: responseJSON });
  } catch (err) {
    console.error('Error saving WhatsApp settings:', err);
    res.status(500).json({ message: 'Server error saving WhatsApp settings' });
  }
});

// GET /api/whatsapp/chats - Admin Only
// List all active conversations (grouped by phone number)
router.get('/chats', authMiddleware, roleMiddleware('Admin'), async (req, res) => {
  try {
    const activeChats = await WhatsappChat.aggregate([
      { $sort: { timestamp: -1 } },
      {
        $group: {
          _id: '$phoneNumber',
          lastMessage: { $first: '$message' },
          lastSender: { $first: '$sender' },
          lastTimestamp: { $first: '$timestamp' },
          count: { $sum: 1 }
        }
      },
      { $sort: { lastTimestamp: -1 } }
    ]);
    res.json(activeChats);
  } catch (err) {
    console.error('Error aggregation chats:', err);
    res.status(500).json({ message: 'Server error retrieving chat list' });
  }
});

// GET /api/whatsapp/chats/:phone - Admin Only
// Get details of a single conversation
router.get('/chats/:phone', authMiddleware, roleMiddleware('Admin'), async (req, res) => {
  try {
    const { phone } = req.params;
    const history = await WhatsappChat.find({ phoneNumber: phone })
      .sort({ timestamp: 1 })
      .limit(100);
    res.json(history);
  } catch (err) {
    console.error('Error fetching chat history:', err);
    res.status(500).json({ message: 'Server error fetching chat history' });
  }
});

// POST /api/whatsapp/simulate - Admin Only (Simulate chat exchange)
router.post('/simulate', authMiddleware, roleMiddleware('Admin'), async (req, res) => {
  try {
    const { message, phoneNumber } = req.body;
    if (!message || !phoneNumber) {
      return res.status(400).json({ message: 'Missing message or phoneNumber' });
    }

    const settings = await WhatsappSetting.findOne();
    if (!settings || !settings.geminiApiKey) {
      return res.status(400).json({ message: 'Gemini API Key is not configured. Please save it first.' });
    }

    // Save mock user's message
    await WhatsappChat.create({
      phoneNumber: phoneNumber,
      sender: 'User',
      message: message
    });

    // Retrieve last 15 messages for history context
    const history = await WhatsappChat.find({ phoneNumber: phoneNumber })
      .sort({ timestamp: -1 })
      .limit(15);
    
    history.reverse();

    // Map history to Gemini format
    const contents = history.map(chat => ({
      role: chat.sender === 'User' ? 'user' : 'model',
      parts: [{ text: chat.message }]
    }));

    // Setup Gemini
    const genAI = new GoogleGenerativeAI(settings.geminiApiKey);
    const systemInstruction = `You are an automated, helpful AI customer support representative for Advent CRM.
Below is the compressed, token-optimized context database of our business. You must read it, interpret the abbreviations, and use it to answer the user's questions in a friendly, concise, and helpful manner. Do NOT share the compressed text directly, but reply using complete, polite natural language. Keep messages short and conversational for WhatsApp (1-4 sentences).

Optimized Context:
${settings.context}

Answer the user based ONLY on the context above. If you do not know the answer, politely ask them to leave their email or phone number and tell them that a support executive will contact them.`;

    const model = genAI.getGenerativeModel({
      model: settings.geminiModel || 'gemini-1.5-flash',
      systemInstruction: systemInstruction
    });

    const result = await model.generateContent({ contents });
    const replyText = result.response.text().trim();

    // Log the AI's reply to database
    const responseChat = await WhatsappChat.create({
      phoneNumber: phoneNumber,
      sender: 'AI',
      message: replyText
    });

    res.json({ success: true, reply: replyText, chat: responseChat });
  } catch (err) {
    console.error('Error in simulation:', err);
    res.status(500).json({ message: 'Simulation failed', error: err.message });
  }
});

// POST /api/whatsapp/webhook - Public Webhook for Twilio
router.post('/webhook', urlencodedParser, async (req, res) => {
  try {
    const { From, Body } = req.body;
    if (!From || !Body) {
      console.warn('Twilio webhook called without From or Body');
      return res.status(400).send('Missing From or Body parameters');
    }

    // Retrieve active settings
    const settings = await WhatsappSetting.findOne();
    if (!settings || !settings.isEnabled) {
      console.log('WhatsApp Agent is disabled or not configured');
      res.type('text/xml');
      return res.send('<Response></Response>');
    }

    if (!settings.geminiApiKey || !settings.twilioAccountSid || !settings.twilioAuthToken || !settings.twilioPhoneNumber) {
      console.warn('WhatsApp Agent credentials not fully configured');
      res.type('text/xml');
      return res.send('<Response></Response>');
    }

    // Save user's message
    await WhatsappChat.create({
      phoneNumber: From,
      sender: 'User',
      message: Body
    });

    // Retrieve last 15 messages for context history
    const history = await WhatsappChat.find({ phoneNumber: From })
      .sort({ timestamp: -1 })
      .limit(15);
    
    // Sort chronological (oldest to newest)
    history.reverse();

    // Map history to Gemini API format
    const contents = history.map(chat => ({
      role: chat.sender === 'User' ? 'user' : 'model',
      parts: [{ text: chat.message }]
    }));

    // Setup Gemini API client
    const genAI = new GoogleGenerativeAI(settings.geminiApiKey);
    const systemInstruction = `You are an automated, helpful AI customer support representative for Advent CRM.
Below is the compressed, token-optimized context database of our business. You must read it, interpret the abbreviations, and use it to answer the user's questions in a friendly, concise, and helpful manner. Do NOT share the compressed text directly, but reply using complete, polite natural language. Keep messages short and conversational for WhatsApp (1-4 sentences).

Optimized Context:
${settings.context}

Answer the user based ONLY on the context above. If you do not know the answer, politely ask them to leave their email or phone number and tell them that a support executive will contact them.`;

    const model = genAI.getGenerativeModel({
      model: settings.geminiModel || 'gemini-1.5-flash',
      systemInstruction: systemInstruction
    });

    // Call Gemini API
    const result = await model.generateContent({ contents });
    const replyText = result.response.text().trim();

    // Send reply via Twilio WhatsApp API
    const twilioClient = twilio(settings.twilioAccountSid, settings.twilioAuthToken);
    await twilioClient.messages.create({
      body: replyText,
      from: settings.twilioPhoneNumber,
      to: From
    });

    // Log the AI's reply to database
    await WhatsappChat.create({
      phoneNumber: From,
      sender: 'AI',
      message: replyText
    });

    // Respond back to Twilio (empty response, since we sent message asynchronously)
    res.type('text/xml');
    res.send('<Response></Response>');
  } catch (err) {
    console.error('Error in WhatsApp webhook processing:', err);
    res.type('text/xml');
    res.send('<Response></Response>');
  }
});

module.exports = router;
