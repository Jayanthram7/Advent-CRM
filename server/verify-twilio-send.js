require('dotenv').config();
const mongoose = require('mongoose');
const twilio = require('twilio');
const WhatsappSetting = require('./models/WhatsappSetting');

async function verifyTwilio() {
  await mongoose.connect(process.env.MONGODB_URI);
  try {
    const s = await WhatsappSetting.findOne();
    if (!s) {
      console.log('❌ No settings found');
      return;
    }

    console.log('⚙️ Twilio Settings:', {
      accountSid: s.twilioAccountSid,
      hasAuthToken: !!s.twilioAuthToken,
      twilioPhoneNumber: s.twilioPhoneNumber
    });

    const testRecipient = 'whatsapp:+919965576297';
    console.log(`📞 Sending test message to ${testRecipient}...`);

    const twilioClient = twilio(s.twilioAccountSid, s.twilioAuthToken);
    const response = await twilioClient.messages.create({
      body: 'CRM Bot Test: Twilio configuration verified!',
      from: s.twilioPhoneNumber,
      to: testRecipient
    });

    console.log('✅ Twilio Success! Response SID:', response.sid);
  } catch (err) {
    console.error('❌ Twilio Send Failed:');
    console.error(err);
  } finally {
    await mongoose.connection.close();
  }
}
verifyTwilio();
