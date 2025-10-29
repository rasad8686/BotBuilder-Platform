const nodemailer = require('nodemailer');
const pool = require('../db');

// Create transporter (configure with your email provider)
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: process.env.EMAIL_PORT || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// Email templates
const emailTemplates = {
  welcome: (name) => ({
    subject: 'Welcome to BotBuilder! 🚀',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #6B46C1;">Welcome to BotBuilder, ${name}!</h1>
        <p>Thank you for signing up! Your account has been created successfully.</p>
        <p>With BotBuilder, you can:</p>
        <ul>
          <li>Create and manage bots for Telegram, WhatsApp, and Discord</li>
          <li>Customize bot responses and behavior</li>
          <li>Monitor bot activity and analytics</li>
          <li>Integrate via webhooks and API</li>
        </ul>
        <p><strong>Your Free Plan includes:</strong></p>
        <ul>
          <li>1 Bot</li>
          <li>1,000 Messages per month</li>
          <li>Webhook support</li>
        </ul>
        <p>Ready to upgrade? Check out our Pro and Enterprise plans for more features!</p>
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard"
           style="display: inline-block; background: #6B46C1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px;">
          Get Started
        </a>
        <p style="margin-top: 30px; color: #666;">
          If you have any questions, feel free to reply to this email.
        </p>
        <p style="color: #666;">
          Best regards,<br>
          The BotBuilder Team
        </p>
      </div>
    `
  }),

  passwordReset: (name, resetLink) => ({
    subject: 'Reset Your Password - BotBuilder',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #6B46C1;">Password Reset Request</h1>
        <p>Hello ${name},</p>
        <p>We received a request to reset your password. Click the button below to create a new password:</p>
        <a href="${resetLink}"
           style="display: inline-block; background: #6B46C1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px;">
          Reset Password
        </a>
        <p style="margin-top: 20px;">This link will expire in 1 hour.</p>
        <p style="color: #666;">
          If you didn't request this, you can safely ignore this email.
        </p>
        <p style="color: #666;">
          Best regards,<br>
          The BotBuilder Team
        </p>
      </div>
    `
  }),

  botAlert: (name, botName, message) => ({
    subject: `Bot Alert: ${botName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #6B46C1;">Bot Activity Alert</h1>
        <p>Hello ${name},</p>
        <p>Your bot <strong>${botName}</strong> has an important update:</p>
        <div style="background: #F3F4F6; padding: 15px; border-radius: 6px; margin: 20px 0;">
          ${message}
        </div>
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard"
           style="display: inline-block; background: #6B46C1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px;">
          View Dashboard
        </a>
        <p style="color: #666;">
          Best regards,<br>
          The BotBuilder Team
        </p>
      </div>
    `
  }),

  subscriptionUpgraded: (name, planName) => ({
    subject: `Welcome to ${planName}! 🎉`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #6B46C1;">Subscription Upgraded!</h1>
        <p>Hello ${name},</p>
        <p>Congratulations! Your subscription has been upgraded to <strong>${planName}</strong>.</p>
        <p>Your new plan features are now active!</p>
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/billing"
           style="display: inline-block; background: #6B46C1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px;">
          View Billing
        </a>
        <p style="color: #666;">
          Thank you for your continued support!
        </p>
        <p style="color: #666;">
          Best regards,<br>
          The BotBuilder Team
        </p>
      </div>
    `
  }),

  paymentReceived: (name, amount, planName) => ({
    subject: 'Payment Received - BotBuilder',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #6B46C1;">Payment Received ✓</h1>
        <p>Hello ${name},</p>
        <p>We've received your payment of <strong>$${amount}</strong> for the <strong>${planName}</strong>.</p>
        <p>Your subscription is active and you have full access to all features.</p>
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/billing"
           style="display: inline-block; background: #6B46C1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px;">
          View Invoice
        </a>
        <p style="color: #666;">
          Thank you for your business!
        </p>
        <p style="color: #666;">
          Best regards,<br>
          The BotBuilder Team
        </p>
      </div>
    `
  }),

  usageLimitWarning: (name, usage, limit) => ({
    subject: 'Usage Limit Warning - BotBuilder',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #EF4444;">Usage Limit Warning ⚠️</h1>
        <p>Hello ${name},</p>
        <p>You've used <strong>${usage}</strong> out of <strong>${limit}</strong> messages this month (${Math.round((usage / limit) * 100)}%).</p>
        <p>Consider upgrading your plan to avoid service interruptions.</p>
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/billing"
           style="display: inline-block; background: #6B46C1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px;">
          Upgrade Plan
        </a>
        <p style="color: #666;">
          Best regards,<br>
          The BotBuilder Team
        </p>
      </div>
    `
  })
};

// Send email function
async function sendEmail(userId, emailType, templateData) {
  try {
    // Get user email
    const user = await pool.query('SELECT email, name FROM users WHERE id = $1', [userId]);
    if (user.rows.length === 0) {
      throw new Error('User not found');
    }

    const { email, name } = user.rows[0];
    const template = emailTemplates[emailType](name, ...Object.values(templateData || {}));

    // Log to database
    await pool.query(
      `INSERT INTO email_notifications (user_id, email_type, recipient_email, subject, body, status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, emailType, email, template.subject, template.html, 'pending']
    );

    // Only send if EMAIL_USER is configured
    if (!process.env.EMAIL_USER) {
      console.log('📧 Email queued (not sent - EMAIL_USER not configured):', template.subject);
      return { success: true, queued: true };
    }

    // Send email
    const info = await transporter.sendMail({
      from: `"BotBuilder" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: template.subject,
      html: template.html
    });

    // Update status
    await pool.query(
      `UPDATE email_notifications
       SET status = $1, sent_at = NOW()
       WHERE user_id = $2 AND email_type = $3 AND status = 'pending'`,
      ['sent', userId, emailType]
    );

    console.log('✅ Email sent:', template.subject, '→', email);
    return { success: true, messageId: info.messageId };

  } catch (error) {
    console.error('❌ Email error:', error.message);

    // Update status to failed
    await pool.query(
      `UPDATE email_notifications
       SET status = $1, error_message = $2
       WHERE user_id = $3 AND email_type = $4 AND status = 'pending'`,
      ['failed', error.message, userId, emailType]
    );

    return { success: false, error: error.message };
  }
}

// Send welcome email on registration
async function sendWelcomeEmail(userId) {
  return sendEmail(userId, 'welcome', {});
}

// Send password reset email
async function sendPasswordResetEmail(userId, resetToken) {
  const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;
  return sendEmail(userId, 'passwordReset', { resetLink });
}

// Send bot alert
async function sendBotAlert(userId, botName, message) {
  return sendEmail(userId, 'botAlert', { botName, message });
}

// Send subscription upgraded notification
async function sendSubscriptionUpgradedEmail(userId, planName) {
  return sendEmail(userId, 'subscriptionUpgraded', { planName });
}

// Send payment received notification
async function sendPaymentReceivedEmail(userId, amount, planName) {
  return sendEmail(userId, 'paymentReceived', { amount, planName });
}

// Send usage limit warning
async function sendUsageLimitWarning(userId, usage, limit) {
  return sendEmail(userId, 'usageLimitWarning', { usage, limit });
}

module.exports = {
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendBotAlert,
  sendSubscriptionUpgradedEmail,
  sendPaymentReceivedEmail,
  sendUsageLimitWarning
};
