require('dotenv').config();
const mongoose = require('mongoose');
const WhatsappChat = require('./models/WhatsappChat');

async function read() {
  await mongoose.connect(process.env.MONGODB_URI);
  try {
    const chats = await WhatsappChat.find().sort({ timestamp: -1 }).limit(10);
    console.log('📝 Latest 10 messages in WhatsappChat:');
    chats.forEach(c => {
      console.log(`[${c.timestamp.toISOString()}] ${c.phoneNumber} - ${c.sender}: "${c.message}"`);
    });
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.connection.close();
  }
}
read();
