const transporter = require('../config/email');

// Send Email
async function sendEmail(to, subject, text, html) {
  try {
    const info = await transporter.sendMail({
      from: `"PropertyVerify" <${process.env.SMTP_USER}>`,
      to,
      subject,
      text,
      html,
    });
    console.log('📧 Email sent:', info.messageId);
  } catch (error) {
    console.error('❌ Email error:', error);
  }
}

// Mock SMS sender (replace with real provider like Twilio or Termii)
async function sendSMS(phone, message) {
  console.log(`📱 SMS to ${phone}: ${message}`);
  return true;
}

module.exports = { sendEmail, sendSMS };
