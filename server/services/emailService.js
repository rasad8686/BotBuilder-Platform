/**
 * Email Service
 * Handles sending emails via Resend API
 * Falls back to console.log in development if RESEND_API_KEY not set
 */

const log = require('../utils/logger');

class EmailService {
  constructor() {
    this.resendApiKey = process.env.RESEND_API_KEY;
    this.fromEmail = process.env.EMAIL_FROM || 'noreply@botbuilder.com';
    this.frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  }

  /**
   * Check if Resend is configured
   */
  isConfigured() {
    return !!this.resendApiKey;
  }

  /**
   * Send email via Resend API
   */
  async sendEmail({ to, subject, html, text }) {
    if (!this.isConfigured()) {
      // Development fallback - log to console
      log.info('========================================');
      log.info('📧 EMAIL (Development Mode - No RESEND_API_KEY)');
      log.info('========================================');
      log.info(`To: ${to}`);
      log.info(`Subject: ${subject}`);
      log.info(`Body: ${text || html}`);
      log.info('========================================');
      return { success: true, dev: true };
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.resendApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: this.fromEmail,
          to: [to],
          subject,
          html,
          text
        })
      });

      if (!response.ok) {
        const error = await response.json();
        log.error('Resend API error', { error, status: response.status });
        throw new Error(error.message || 'Failed to send email');
      }

      const result = await response.json();
      log.info('Email sent successfully', { to, subject, id: result.id });
      return { success: true, id: result.id };
    } catch (error) {
      log.error('Email sending failed', { error: error.message, to, subject });
      throw error;
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email, token, userName) {
    const resetUrl = `${this.frontendUrl}/reset-password?token=${token}`;

    const subject = 'Reset Your Password - BotBuilder';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; background-color: #0a0a0f; color: #e5e7eb; padding: 40px 20px; margin: 0;">
        <div style="max-width: 500px; margin: 0 auto; background-color: #12121a; border-radius: 16px; padding: 40px; border: 1px solid #2d2d3a;">
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="color: #8b5cf6; margin: 0; font-size: 28px;">🔐 Password Reset</h1>
          </div>

          <p style="margin-bottom: 16px; font-size: 16px; line-height: 1.6;">
            Hi${userName ? ` ${userName}` : ''},
          </p>

          <p style="margin-bottom: 24px; font-size: 16px; line-height: 1.6;">
            We received a request to reset your password. Click the button below to create a new password:
          </p>

          <div style="text-align: center; margin: 32px 0;">
            <a href="${resetUrl}" style="display: inline-block; background-color: #8b5cf6; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
              Reset Password
            </a>
          </div>

          <p style="margin-bottom: 16px; font-size: 14px; color: #9ca3af; line-height: 1.6;">
            This link will expire in <strong>1 hour</strong>.
          </p>

          <p style="margin-bottom: 16px; font-size: 14px; color: #9ca3af; line-height: 1.6;">
            If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.
          </p>

          <hr style="border: none; border-top: 1px solid #2d2d3a; margin: 32px 0;">

          <p style="font-size: 12px; color: #6b7280; text-align: center; margin: 0;">
            If the button doesn't work, copy and paste this link into your browser:<br>
            <a href="${resetUrl}" style="color: #8b5cf6; word-break: break-all;">${resetUrl}</a>
          </p>
        </div>

        <p style="text-align: center; margin-top: 24px; font-size: 12px; color: #6b7280;">
          © ${new Date().getFullYear()} BotBuilder. All rights reserved.
        </p>
      </body>
      </html>
    `;

    const text = `
Hi${userName ? ` ${userName}` : ''},

We received a request to reset your password.

Click the link below to create a new password:
${resetUrl}

This link will expire in 1 hour.

If you didn't request this password reset, you can safely ignore this email.

© ${new Date().getFullYear()} BotBuilder
    `.trim();

    return this.sendEmail({ to: email, subject, html, text });
  }

  /**
   * Send email verification email
   */
  async sendEmailVerificationEmail(email, token, userName) {
    const verifyUrl = `${this.frontendUrl}/verify-email?token=${token}`;

    const subject = 'Verify Your Email - BotBuilder';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your Email</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; background-color: #0a0a0f; color: #e5e7eb; padding: 40px 20px; margin: 0;">
        <div style="max-width: 500px; margin: 0 auto; background-color: #12121a; border-radius: 16px; padding: 40px; border: 1px solid #2d2d3a;">
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="color: #8b5cf6; margin: 0; font-size: 28px;">Welcome to BotBuilder!</h1>
          </div>

          <p style="margin-bottom: 16px; font-size: 16px; line-height: 1.6;">
            Hi${userName ? ` ${userName}` : ''},
          </p>

          <p style="margin-bottom: 24px; font-size: 16px; line-height: 1.6;">
            Thank you for registering! Please verify your email address by clicking the button below:
          </p>

          <div style="text-align: center; margin: 32px 0;">
            <a href="${verifyUrl}" style="display: inline-block; background-color: #8b5cf6; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
              Verify Email
            </a>
          </div>

          <p style="margin-bottom: 16px; font-size: 14px; color: #9ca3af; line-height: 1.6;">
            This link will expire in <strong>24 hours</strong>.
          </p>

          <p style="margin-bottom: 16px; font-size: 14px; color: #9ca3af; line-height: 1.6;">
            If you didn't create an account with BotBuilder, you can safely ignore this email.
          </p>

          <hr style="border: none; border-top: 1px solid #2d2d3a; margin: 32px 0;">

          <p style="font-size: 12px; color: #6b7280; text-align: center; margin: 0;">
            If the button doesn't work, copy and paste this link into your browser:<br>
            <a href="${verifyUrl}" style="color: #8b5cf6; word-break: break-all;">${verifyUrl}</a>
          </p>
        </div>

        <p style="text-align: center; margin-top: 24px; font-size: 12px; color: #6b7280;">
          © ${new Date().getFullYear()} BotBuilder. All rights reserved.
        </p>
      </body>
      </html>
    `;

    const text = `
Hi${userName ? ` ${userName}` : ''},

Welcome to BotBuilder!

Thank you for registering. Please verify your email address by clicking the link below:
${verifyUrl}

This link will expire in 24 hours.

If you didn't create an account with BotBuilder, you can safely ignore this email.

© ${new Date().getFullYear()} BotBuilder
    `.trim();

    return this.sendEmail({ to: email, subject, html, text });
  }
}

module.exports = new EmailService();
