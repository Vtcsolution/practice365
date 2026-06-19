/**
 * Email service stub — logs to console in development.
 * Replace with SendGrid/Mailgun/SES when credentials are available.
 * Firm branding (Section 9.2) is auto-applied to all outgoing emails.
 */

async function getFirmBranding() {
  try {
    const FirmSettings = require('../models/FirmSettings');
    const settings = await FirmSettings.findOne();
    return {
      firmName: settings?.firmName || 'Practice365',
      email: settings?.email || 'noreply@practice365.com',
      phone: settings?.phone || '',
      logoUrl: settings?.logoUrl || ''
    };
  } catch (e) {
    return { firmName: 'Practice365', email: 'noreply@practice365.com', phone: '', logoUrl: '' };
  }
}

async function sendEmail({ to, subject, text, html }) {
  const brand = await getFirmBranding();
  const brandedSubject = `${subject} — ${brand.firmName}`;
  const brandedText = `${text}\n\n--\n${brand.firmName}${brand.phone ? ' | ' + brand.phone : ''}${brand.email ? ' | ' + brand.email : ''}`;
  subject = brandedSubject;
  text = brandedText;
  if (process.env.NODE_ENV === 'production' && process.env.SMTP_HOST) {
    // Future: wire real SMTP/SendGrid here
    console.log(`[EMAIL] Would send to ${to}: ${subject}`);
    return { success: true, provider: 'smtp' };
  }

  console.log('━'.repeat(50));
  console.log(`📧 EMAIL STUB`);
  console.log(`   To: ${to}`);
  console.log(`   Subject: ${subject}`);
  console.log(`   Preview: ${(text || '').substring(0, 120)}...`);
  console.log('━'.repeat(50));

  return { success: true, provider: 'console-stub' };
}

async function sendMessageNotification({ recipientEmail, senderName, matterName, messagePreview }) {
  return sendEmail({
    to: recipientEmail,
    subject: `New message on ${matterName} — Practice365`,
    text: `${senderName} sent a message regarding ${matterName}:\n\n"${messagePreview.substring(0, 100)}..."\n\nLog in to your portal to view the full message.`
  });
}

async function sendSignatureRequest({ recipientEmail, recipientName, documentName, signingUrl, senderName }) {
  return sendEmail({
    to: recipientEmail,
    subject: `Signature requested: ${documentName}`,
    text: `${senderName} has requested your signature on "${documentName}".\n\nClick here to review and sign: ${signingUrl}\n\nThis is a single-use link.`
  });
}

async function sendPaymentReceipt({ recipientEmail, invoiceNumber, amount, matterName }) {
  return sendEmail({
    to: recipientEmail,
    subject: `Payment received — ${invoiceNumber}`,
    text: `Your payment of $${amount.toFixed(2)} for ${matterName} (${invoiceNumber}) has been received. Thank you.`
  });
}

async function sendPaymentFailedNotification({ attorneyEmail, clientName, invoiceNumber, amount, reason }) {
  return sendEmail({
    to: attorneyEmail,
    subject: `Payment FAILED — ${invoiceNumber} (${clientName})`,
    text: `Payment of $${amount.toFixed(2)} for ${invoiceNumber} from ${clientName} has FAILED.\nReason: ${reason}\n\nInvoice status has been reverted. Please follow up.`
  });
}

async function sendDeadlineReminder({ recipientEmail, eventTitle, matterName, dueDate, intervalLabel }) {
  return sendEmail({
    to: recipientEmail,
    subject: `Deadline reminder (${intervalLabel}): ${eventTitle}`,
    text: `Reminder: "${eventTitle}"${matterName ? ` on matter ${matterName}` : ''} is due on ${new Date(dueDate).toLocaleDateString()}.\n\nThis reminder was triggered ${intervalLabel} before the deadline.`
  });
}

module.exports = {
  sendEmail,
  sendMessageNotification,
  sendSignatureRequest,
  sendPaymentReceipt,
  sendPaymentFailedNotification,
  sendDeadlineReminder
};
