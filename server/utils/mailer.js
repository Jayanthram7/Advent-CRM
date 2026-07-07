const nodemailer = require('nodemailer');
const path = require('path');

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

const sendEmail = async ({ from, to, subject, html, attachments }) => {
  if (!emailUser || !emailPass) {
    console.warn('⚠️ SMTP credentials (EMAIL_USER/EMAIL_PASS) are not configured. Skipping email dispatch.');
    return null;
  }

  // Automatic Regards / Signature HTML
  const isTemplate = html && (html.includes('email-wrapper') || html.includes('main-card'));
  const marginStyle = 'margin: 0;';
  const paddingStyle = 'padding: 0;';
  const containerPadding = isTemplate ? 'padding: 32px 0;' : 'padding: 20px 0 0 0;';
  const borderStyle = isTemplate ? 'border-top: 1px solid #e5e7eb;' : 'border-top: 1px dashed #d1d5db;';

  const regardsHtml = `
<div style="background-color: #ffffff; ${containerPadding} ${borderStyle}">
  <div style="max-width: 600px; ${marginStyle} ${paddingStyle} font-family: 'DM Sans', Arial, sans-serif; text-align: left; box-sizing: border-box;">
    <p style="margin: 0; font-size: 14px; color: #4b5563; line-height: 1.5;">Regards,</p>
    <p style="margin: 2px 0 0 0; font-size: 16px; font-weight: bold; color: #111827; line-height: 1.5;">Advent Systems</p>
    <p style="margin: 2px 0 20px 0; font-size: 13px; color: #6b7280; line-height: 1.5;">5-Star Certified Tally Partner</p>

    <table border="0" cellpadding="0" cellspacing="0" style="margin-top: 15px; margin-bottom: 20px; border-collapse: collapse;">
      <tr>
        <td style="vertical-align: middle; padding-right: 20px;">
          <img src="cid:signaturelogo" alt="Advent Systems" style="width: 80px; max-width: 80px; height: auto; display: block; border: 0;" />
        </td>
        <td style="width: 1px; background-color: #d1d5db; padding: 0; vertical-align: middle; height: 70px;"></td>
        <td style="vertical-align: middle; padding-left: 20px; font-family: 'DM Sans', Arial, sans-serif;">
          <table border="0" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding-bottom: 8px; vertical-align: middle; font-family: 'DM Sans', Arial, sans-serif; font-size: 13.5px; color: #374151;">
                <span style="font-size: 16px; margin-right: 6px; display: inline-block; vertical-align: middle; line-height: 1;">📞</span>
                <a href="tel:+919842276297" style="color: #374151; text-decoration: none; font-weight: bold; font-family: 'DM Sans', Arial, sans-serif; vertical-align: middle;">+91 9842276297</a>
              </td>
            </tr>
            <tr>
              <td style="padding-bottom: 8px; vertical-align: middle; font-family: 'DM Sans', Arial, sans-serif; font-size: 13.5px; color: #374151;">
                <span style="font-size: 16px; margin-right: 6px; display: inline-block; vertical-align: middle; line-height: 1;">📱</span>
                <a href="tel:+919965573231" style="color: #374151; text-decoration: none; font-weight: bold; font-family: 'DM Sans', Arial, sans-serif; vertical-align: middle;">+91 9965573231</a>
              </td>
            </tr>
            <tr>
              <td style="vertical-align: middle; font-family: 'DM Sans', Arial, sans-serif; font-size: 13.5px; color: #374151;">
                <span style="font-size: 16px; margin-right: 6px; display: inline-block; vertical-align: middle; line-height: 1;">🌐</span>
                <a href="https://adventsystems.vercel.app" target="_blank" style="color: #374151; text-decoration: none; font-weight: bold; font-family: 'DM Sans', Arial, sans-serif; vertical-align: middle;">adventsystems.vercel.app</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <div style="border-top: 1px dashed #d1d5db; padding-top: 12px; margin-top: 20px; font-size: 12px; color: #6b7280; text-align: left; font-family: 'DM Sans', Arial, sans-serif; line-height: 1.5;">
      Accounting &nbsp;|&nbsp; Compliance &nbsp;|&nbsp; Cloud Access &nbsp;|&nbsp; WhatsApp for Business
    </div>
  </div>
</div>
`;

  let finalHtml = html;
  if (html && html.toLowerCase().includes('</body>')) {
    finalHtml = html.replace(/<\/body>/i, `${regardsHtml}</body>`);
  } else if (html) {
    finalHtml = `<div style="font-family: 'DM Sans', Arial, sans-serif;">${html}</div>${regardsHtml}`;
  }

  // Automatic signature logo attachment
  const signatureAttachment = {
    filename: 'images.jpg',
    path: path.join(__dirname, '../../client/public/images.jpg'),
    cid: 'signaturelogo'
  };

  const finalAttachments = attachments
    ? [...attachments, signatureAttachment]
    : [signatureAttachment];

  return transporter.sendMail({
    from: from || `"Advent Systems" <${emailUser}>`,
    to,
    subject,
    html: finalHtml,
    attachments: finalAttachments
  });
};

module.exports = sendEmail;
