require('dotenv').config({ path: '../server/.env' });
const mongoose = require('mongoose');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const WhatsappSetting = require('../server/models/WhatsappSetting');
const WhatsappChat = require('../server/models/WhatsappChat');

async function testWhatsappIntegration() {
  console.log('🔄 Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/advent_leads');
  console.log('✅ MongoDB connected.');

  try {
    // 1. Check or seed settings
    console.log('🔍 Checking settings...');
    let settings = await WhatsappSetting.findOne();
    if (!settings) {
      console.log('🌱 Seeding default settings...');
      settings = await WhatsappSetting.create({
        twilioAccountSid: 'AC_MOCK_SID',
        twilioAuthToken: 'MOCK_TOKEN',
        twilioPhoneNumber: 'whatsapp:+14155238886',
        geminiApiKey: process.env.GEMINI_API_KEY || '',
        context: 'Hours: M-F 09:30-17:30.\nServices: CRM Setup, Tally License.\nPrice: Tally Prime is $100.',
        isEnabled: true
      });
    }
    console.log('⚙️ Current Settings:', {
      isEnabled: settings.isEnabled,
      geminiModel: settings.geminiModel,
      twilioPhoneNumber: settings.twilioPhoneNumber,
      hasGeminiKey: !!settings.geminiApiKey,
      contextLength: settings.context?.length
    });

    // 2. Chat history operations test
    console.log('📝 Testing Chat Log writes...');
    const testPhone = 'whatsapp:+15550100';
    
    // Clear old tests
    await WhatsappChat.deleteMany({ phoneNumber: testPhone });

    await WhatsappChat.create({
      phoneNumber: testPhone,
      sender: 'User',
      message: 'Hello, what services do you provide?'
    });

    const history = await WhatsappChat.find({ phoneNumber: testPhone }).sort({ timestamp: 1 });
    console.log(`✅ Logged & fetched ${history.length} test chat messages.`);

    // 3. Gemini integration test (if key is set)
    const apiKey = settings.geminiApiKey || process.env.GEMINI_API_KEY;
    if (apiKey) {
      console.log('🧠 Testing Gemini API connection...');
      const genAI = new GoogleGenerativeAI(apiKey);
      const systemInstruction = `You are an AI customer support bot.
Context:
${settings.context}

Answer the user based on the context above. Keep replies under 2 sentences.`;

      const model = genAI.getGenerativeModel({
        model: settings.geminiModel || 'gemini-1.5-flash',
        systemInstruction: systemInstruction
      });

      const contents = history.map(chat => ({
        role: chat.sender === 'User' ? 'user' : 'model',
        parts: [{ text: chat.message }]
      }));

      console.log('🤖 Sending content to Gemini model...');
      const result = await model.generateContent({ contents });
      const reply = result.response.text().trim();
      console.log('💬 Gemini Response:', reply);

      // Save AI reply
      await WhatsappChat.create({
        phoneNumber: testPhone,
        sender: 'AI',
        message: reply
      });
      console.log('✅ AI reply logged successfully.');
    } else {
      console.log('⚠️ Skipping Gemini test (no API key configured). Please add GEMINI_API_KEY to your env or Settings.');
    }

  } catch (err) {
    console.error('❌ Test failed with error:', err);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Disconnected from MongoDB.');
  }
}

testWhatsappIntegration();
