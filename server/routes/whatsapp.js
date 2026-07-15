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

// Validate that a key is not a masked placeholder or empty/corrupted by copy-paste masking
function isSecretValid(key) {
  if (!key) return false;
  if (key.includes('...')) return false;
  if (/^[*\-•\s]+$/.test(key)) return false;
  return true;
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
    settingsJSON.metaAccessToken = settings.metaAccessToken ? obscureKey(settings.metaAccessToken) : '';
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
      provider,
      metaPhoneNumberId,
      metaAccessToken,
      metaVerifyToken,
      metaBusinessAccountId,
      metaTemplateName,
      metaTemplateLanguage,
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

    settings.provider = provider !== undefined ? provider : settings.provider;
    settings.metaPhoneNumberId = metaPhoneNumberId !== undefined ? metaPhoneNumberId : settings.metaPhoneNumberId;
    
    if (isSecretValid(metaAccessToken)) {
      settings.metaAccessToken = metaAccessToken;
    }
    
    settings.metaVerifyToken = metaVerifyToken !== undefined ? metaVerifyToken : settings.metaVerifyToken;
    settings.metaBusinessAccountId = metaBusinessAccountId !== undefined ? metaBusinessAccountId : settings.metaBusinessAccountId;
    settings.metaTemplateName = metaTemplateName !== undefined ? metaTemplateName : settings.metaTemplateName;
    settings.metaTemplateLanguage = metaTemplateLanguage !== undefined ? metaTemplateLanguage : settings.metaTemplateLanguage;

    settings.twilioAccountSid = twilioAccountSid !== undefined ? twilioAccountSid : settings.twilioAccountSid;
    
    // Only update tokens if they are valid, non-placeholder keys
    if (isSecretValid(twilioAuthToken)) {
      settings.twilioAuthToken = twilioAuthToken;
    }
    
    settings.twilioPhoneNumber = twilioPhoneNumber !== undefined ? twilioPhoneNumber : settings.twilioPhoneNumber;
    
    if (isSecretValid(geminiApiKey)) {
      settings.geminiApiKey = geminiApiKey;
    }

    settings.geminiModel = geminiModel !== undefined ? geminiModel : settings.geminiModel;
    settings.context = context !== undefined ? context : settings.context;
    settings.isEnabled = isEnabled !== undefined ? isEnabled : settings.isEnabled;

    await settings.save();

    const responseJSON = settings.toJSON();
    responseJSON.twilioAuthToken = settings.twilioAuthToken ? obscureKey(settings.twilioAuthToken) : '';
    responseJSON.metaAccessToken = settings.metaAccessToken ? obscureKey(settings.metaAccessToken) : '';
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

// GET /api/whatsapp/webhook - Verification endpoint for Meta Cloud API
router.get('/webhook', async (req, res) => {
  try {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const settings = await WhatsappSetting.findOne();
    const expectedToken = settings?.metaVerifyToken || 'advent_verify_token';

    if (mode && token) {
      if (mode === 'subscribe' && token === expectedToken) {
        console.log('✅ Meta Webhook verified successfully');
        return res.status(200).send(challenge);
      } else {
        console.warn('❌ Meta Webhook verification failed: Token mismatch');
        return res.status(403).send('Verification token mismatch');
      }
    }
    res.status(400).send('Missing hub parameters');
  } catch (err) {
    console.error('Error verifying Meta webhook:', err);
    res.status(500).send('Internal server error');
  }
});

// POST /api/whatsapp/webhook - Public Webhook for Twilio & Meta
router.post('/webhook', urlencodedParser, async (req, res) => {
  try {
    // 1. Retrieve active settings
    const settings = await WhatsappSetting.findOne();
    if (!settings || !settings.isEnabled) {
      console.log('WhatsApp Agent is disabled or not configured');
      if (req.body && req.body.object === 'whatsapp_business_account') {
        return res.status(200).send('Disabled');
      }
      res.type('text/xml');
      return res.send('<Response></Response>');
    }

    if (!settings.geminiApiKey) {
      console.warn('WhatsApp Agent Gemini API key not configured');
      if (req.body && req.body.object === 'whatsapp_business_account') {
        return res.status(200).send('Not configured');
      }
      res.type('text/xml');
      return res.send('<Response></Response>');
    }

    // 2. Detect Provider Payload Type
    const isMeta = req.body && req.body.object === 'whatsapp_business_account';
    let From = '';
    let Body = '';

    if (isMeta) {
      const entry = req.body.entry?.[0];
      const change = entry?.changes?.[0]?.value;
      const messageObj = change?.messages?.[0];
      
      // If it's a status callback or read receipt from Meta (no message content), return 200 OK
      if (!messageObj) {
        return res.status(200).send('Event received');
      }

      // We only support text messages
      if (messageObj.type !== 'text' || !messageObj.text?.body) {
        console.log(`Ignored non-text message type: ${messageObj.type}`);
        return res.status(200).send('Unsupported message type');
      }

      From = 'whatsapp:+' + messageObj.from; // format as whatsapp:+919965576297
      Body = messageObj.text.body;
    } else {
      // Fallback: Twilio Form Data
      From = req.body.From;
      Body = req.body.Body;

      if (!From || !Body) {
        console.warn('Twilio webhook called without From or Body');
        return res.status(400).send('Missing From or Body parameters');
      }
    }

    // 3. Save user's message
    await WhatsappChat.create({
      phoneNumber: From,
      sender: 'User',
      message: Body
    });

    // 4. Retrieve last 15 messages for context history
    const history = await WhatsappChat.find({ phoneNumber: From })
      .sort({ timestamp: -1 })
      .limit(15);
    
    history.reverse();

    // Map history to Gemini API format
    const contents = history.map(chat => ({
      role: chat.sender === 'User' ? 'user' : 'model',
      parts: [{ text: chat.message }]
    }));

    // 5. Setup Gemini API client & Prompt Context
    const genAI = new GoogleGenerativeAI(settings.geminiApiKey);
    const systemInstruction = `You are an automated, helpful AI customer support representative for Advent CRM.
Below is the compressed, token-optimized context database of our business. You must read it, interpret the abbreviations, and use it to answer the user's questions in a friendly, concise, and helpful manner. Do NOT share the compressed text directly, but reply using complete, polite natural language. Keep messages short and conversational for WhatsApp (1-4 sentences).

Optimized Context:
${settings.context}

Answer the user based ONLY on the context above. If you do not know the answer, politely ask them to leave their email or phone number and tell them that a support executive will contact them.`;

    const model = genAI.getGenerativeModel({
      model: settings.geminiModel || 'gemini-3.1-flash-lite',
      systemInstruction: systemInstruction
    });

    // Call Gemini API
    const result = await model.generateContent({ contents });
    const replyText = result.response.text().trim();

    // 6. Send reply via active provider
    if (isMeta) {
      if (!settings.metaPhoneNumberId || !settings.metaAccessToken) {
        console.warn('Meta credentials are not fully configured');
        return res.status(200).send('Credentials missing');
      }

      const metaUrl = `https://graph.facebook.com/v20.0/${settings.metaPhoneNumberId}/messages`;
      const cleanToPhone = From.replace('whatsapp:+', ''); // Meta expects plain phone number e.g. 919965576297
      
      const metaResponse = await fetch(metaUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${settings.metaAccessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanToPhone,
          type: 'text',
          text: { body: replyText }
        })
      });

      if (!metaResponse.ok) {
        const errData = await metaResponse.json();
        throw new Error(`Meta API send failed: ${JSON.stringify(errData)}`);
      }
    } else {
      // Send via Twilio
      if (!settings.twilioAccountSid || !settings.twilioAuthToken || !settings.twilioPhoneNumber) {
        console.warn('Twilio credentials are not fully configured');
        res.type('text/xml');
        return res.send('<Response></Response>');
      }

      const twilioClient = twilio(settings.twilioAccountSid, settings.twilioAuthToken);
      await twilioClient.messages.create({
        body: replyText,
        from: settings.twilioPhoneNumber,
        to: From
      });
    }

    // 7. Log the AI's reply to database
    await WhatsappChat.create({
      phoneNumber: From,
      sender: 'AI',
      message: replyText
    });

    // 8. Respond to the HTTP client (Twilio expects XML, Meta expects JSON/status 200)
    if (isMeta) {
      res.status(200).json({ success: true });
    } else {
      res.type('text/xml');
      res.send('<Response></Response>');
    }
  } catch (err) {
    console.error('Error in WhatsApp webhook processing:', err);
    if (req.body && req.body.object === 'whatsapp_business_account') {
      res.status(500).json({ error: err.message });
    } else {
      res.type('text/xml');
      res.send('<Response></Response>');
    }
  }
});

// POST /api/whatsapp/send-template - Admin/Auth User
// Send initial template message
router.post('/send-template', authMiddleware, async (req, res) => {
  try {
    const { phoneNumber, recipientName } = req.body;
    if (!phoneNumber) {
      return res.status(400).json({ success: false, message: 'Missing phoneNumber' });
    }

    const settings = await WhatsappSetting.findOne();
    if (!settings || !settings.isEnabled) {
      return res.json({ success: false, message: 'WhatsApp integration is disabled' });
    }

    if (settings.provider !== 'meta') {
      return res.json({ success: false, message: 'Template auto-sending is only supported for Meta provider' });
    }

    if (!settings.metaPhoneNumberId || !settings.metaAccessToken || !settings.metaTemplateName) {
      return res.json({ success: false, message: 'Meta credentials or template name not configured' });
    }

    // Clean phone number (Meta expects digits only without '+' or leading spaces)
    const cleanPhone = phoneNumber.replace(/\D/g, '');

    const metaUrl = `https://graph.facebook.com/v20.0/${settings.metaPhoneNumberId}/messages`;
    
    // Construct Meta Template Payload
    const bodyParams = [];
    if (recipientName) {
      bodyParams.push({
        type: 'text',
        text: recipientName
      });
    }

    const templatePayload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanPhone,
      type: 'template',
      template: {
        name: settings.metaTemplateName,
        language: {
          code: settings.metaTemplateLanguage || 'en'
        }
      }
    };

    if (bodyParams.length > 0) {
      templatePayload.template.components = [
        {
          type: 'body',
          parameters: bodyParams
        }
      ];
    }

    const metaResponse = await fetch(metaUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${settings.metaAccessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(templatePayload)
    });

    const data = await metaResponse.json();

    if (!metaResponse.ok) {
      console.error('Meta API template send failed:', data);
      return res.json({ success: false, message: 'Meta API template send failed', error: data });
    }

    // Log the sent template to our WhatsappChat database history
    await WhatsappChat.create({
      phoneNumber: 'whatsapp:+' + cleanPhone,
      sender: 'AI',
      message: `[Template outreach initiated: ${settings.metaTemplateName}]`
    });

    res.json({ success: true, provider: 'meta', messageId: data.messages?.[0]?.id });
  } catch (err) {
    console.error('Error sending WhatsApp template:', err);
    res.status(500).json({ success: false, message: 'Internal server error sending template' });
  }
});

module.exports = router;
