const nodemailer = require('nodemailer');

const mailConfig = {};

const emailUser = process.env.EMAIL_USER || process.env.SMTP_USER;
const emailPass = process.env.EMAIL_PASS || process.env.SMTP_PASS;

if (emailUser && emailUser.endsWith('@gmail.com')) {
  mailConfig.service = 'gmail';
  mailConfig.auth = {
    user: emailUser,
    pass: emailPass
  };
} else {
  mailConfig.host = process.env.SMTP_HOST || 'smtp.gmail.com';
  mailConfig.port = parseInt(process.env.SMTP_PORT) || 587;
  mailConfig.secure = process.env.SMTP_SECURE === 'true';
  mailConfig.auth = {
    user: emailUser,
    pass: emailPass
  };
}

const transporter = nodemailer.createTransport(mailConfig);

const sendEmail = async ({ from, to, subject, html }) => {
  if (!emailUser || !emailPass) {
    console.warn('⚠️ SMTP credentials (EMAIL_USER/EMAIL_PASS) are not configured. Skipping email dispatch.');
    return null;
  }
  return transporter.sendMail({
    from: from || `"Advent Systems" <${emailUser}>`,
    to,
    subject,
    html
  });
};

module.exports = sendEmail;
