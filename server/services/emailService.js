/**
 * @fileoverview Email Service Module
 * @description Handles all email operations for the BotBuilder platform using Resend API.
 * In development mode without RESEND_API_KEY, falls back to console logging.
 * @module services/emailService
 * @author BotBuilder Team
 */

const log = require('../utils/logger');

/**
 * Email Service Class
 * @class EmailService
 * @description Manages email delivery for transactional emails including
 * password resets, email verification, and notifications.
 *
 * @example
 * const emailService = require('./services/emailService');
 * await emailService.sendPasswordResetEmail('user@example.com', 'reset-token', 'John');
 */
class EmailService {
  /**
   * Creates an instance of EmailService.
   * @constructor
   * @description Initializes the email service with configuration from environment variables.
   */
  constructor() {
    /** @type {string|undefined} Resend API key for email delivery */
    this.resendApiKey = process.env.RESEND_API_KEY;
    /** @type {string} Sender email address */
    this.fromEmail = process.env.EMAIL_FROM || 'noreply@botbuilder.com';
    /** @type {string} Frontend URL for email links */
    this.frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5174';
  }

  /**
   * Checks if the Resend API is configured
   * @returns {boolean} True if RESEND_API_KEY is set, false otherwise
   * @description Used to determine whether to send actual emails or fall back to console logging.
   */
  isConfigured() {
    return !!this.resendApiKey;
  }

  /**
   * Sends an email via Resend API
   * @async
   * @param {Object} options - Email options
   * @param {string} options.to - Recipient email address
   * @param {string} options.subject - Email subject line
   * @param {string} options.html - HTML content of the email
   * @param {string} [options.text] - Plain text content (fallback)
   * @returns {Promise<{success: boolean, id?: string, dev?: boolean}>} Result object
   * @throws {Error} When email sending fails
   *
   * @example
   * await emailService.sendEmail({
   *   to: 'user@example.com',
   *   subject: 'Welcome!',
   *   html: '<h1>Welcome to BotBuilder</h1>',
   *   text: 'Welcome to BotBuilder'
   * });
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
    log.info('Sending verification email', { to: email });
    const verifyUrl = `${this.frontendUrl}/verify-email?token=${token}`;

    // Log verification link in dev mode (visible in console)
    if (!this.isConfigured()) {
      log.info('========================================');
      log.info('📧 EMAIL (Development Mode - No RESEND_API_KEY)');
      log.info('========================================');
      log.info(`Verification link: ${verifyUrl}`);
      log.info('========================================');
    }

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

    const result = await this.sendEmail({ to: email, subject, html, text });
    log.info('Verification email sent successfully', { to: email });
    return result;
  }

  /**
   * Send training complete notification
   */
  async sendTrainingCompleteEmail(email, data) {
    const { modelName, fineTunedModel, trainedTokens, userName } = data;
    const dashboardUrl = `${this.frontendUrl}/fine-tuning`;

    const subject = '✅ Training Complete - BotBuilder';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0a0a0f; color: #e5e7eb; padding: 40px 20px; margin: 0;">
        <div style="max-width: 500px; margin: 0 auto; background-color: #12121a; border-radius: 16px; padding: 40px; border: 1px solid #2d2d3a;">
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="color: #22c55e; margin: 0; font-size: 28px;">🎉 Training Complete!</h1>
          </div>
          <p style="margin-bottom: 16px; font-size: 16px; line-height: 1.6;">
            Hi${userName ? ` ${userName}` : ''},
          </p>
          <p style="margin-bottom: 24px; font-size: 16px; line-height: 1.6;">
            Your fine-tuning job has completed successfully!
          </p>
          <div style="background-color: #1a1a2e; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
            <p style="margin: 0 0 8px 0; font-size: 14px; color: #9ca3af;">Model Name</p>
            <p style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600;">${modelName}</p>
            <p style="margin: 0 0 8px 0; font-size: 14px; color: #9ca3af;">Fine-tuned Model ID</p>
            <p style="margin: 0 0 16px 0; font-size: 14px; font-family: monospace; color: #8b5cf6;">${fineTunedModel}</p>
            <p style="margin: 0 0 8px 0; font-size: 14px; color: #9ca3af;">Tokens Trained</p>
            <p style="margin: 0; font-size: 16px;">${trainedTokens?.toLocaleString() || 'N/A'}</p>
          </div>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${dashboardUrl}" style="display: inline-block; background-color: #8b5cf6; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600;">
              View Dashboard
            </a>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `Your fine-tuning job "${modelName}" has completed successfully!\n\nFine-tuned Model ID: ${fineTunedModel}\nTokens Trained: ${trainedTokens?.toLocaleString() || 'N/A'}\n\nView your dashboard: ${dashboardUrl}`;

    return this.sendEmail({ to: email, subject, html, text });
  }

  /**
   * Send training failed notification
   */
  async sendTrainingFailedEmail(email, data) {
    const { modelName, error, userName } = data;
    const dashboardUrl = `${this.frontendUrl}/fine-tuning`;

    const subject = '❌ Training Failed - BotBuilder';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0a0a0f; color: #e5e7eb; padding: 40px 20px; margin: 0;">
        <div style="max-width: 500px; margin: 0 auto; background-color: #12121a; border-radius: 16px; padding: 40px; border: 1px solid #2d2d3a;">
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="color: #ef4444; margin: 0; font-size: 28px;">Training Failed</h1>
          </div>
          <p style="margin-bottom: 16px; font-size: 16px; line-height: 1.6;">
            Hi${userName ? ` ${userName}` : ''},
          </p>
          <p style="margin-bottom: 24px; font-size: 16px; line-height: 1.6;">
            Unfortunately, your fine-tuning job encountered an error.
          </p>
          <div style="background-color: #1a1a2e; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
            <p style="margin: 0 0 8px 0; font-size: 14px; color: #9ca3af;">Model Name</p>
            <p style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600;">${modelName}</p>
            <p style="margin: 0 0 8px 0; font-size: 14px; color: #9ca3af;">Error</p>
            <p style="margin: 0; font-size: 14px; color: #ef4444;">${error || 'Unknown error'}</p>
          </div>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${dashboardUrl}" style="display: inline-block; background-color: #8b5cf6; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600;">
              View Dashboard
            </a>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `Your fine-tuning job "${modelName}" has failed.\n\nError: ${error || 'Unknown error'}\n\nView your dashboard: ${dashboardUrl}`;

    return this.sendEmail({ to: email, subject, html, text });
  }

  /**
   * Send API key rotation notification
   * @param {string} email - Recipient email
   * @param {Object} data - Rotation data
   * @param {string} data.userName - User's name
   * @param {string} data.tokenName - Name of the token
   * @param {string} data.newTokenPreview - Preview of new token
   * @param {Date} data.oldTokenValidUntil - When old token expires
   * @param {boolean} data.isAutoRotation - Whether this was automatic rotation
   */
  async sendKeyRotationEmail(email, data) {
    const { userName, tokenName, newTokenPreview, oldTokenValidUntil, isAutoRotation } = data;
    const dashboardUrl = `${this.frontendUrl}/settings/api-tokens`;

    const rotationType = isAutoRotation ? 'automatically rotated' : 'rotated';
    const subject = `API Key ${isAutoRotation ? 'Auto-' : ''}Rotated - BotBuilder`;

    const validUntilStr = oldTokenValidUntil
      ? new Date(oldTokenValidUntil).toLocaleString('en-US', {
          dateStyle: 'medium',
          timeStyle: 'short'
        })
      : 'N/A';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0a0a0f; color: #e5e7eb; padding: 40px 20px; margin: 0;">
        <div style="max-width: 500px; margin: 0 auto; background-color: #12121a; border-radius: 16px; padding: 40px; border: 1px solid #2d2d3a;">
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="color: #f59e0b; margin: 0; font-size: 28px;">API Key Rotated</h1>
          </div>
          <p style="margin-bottom: 16px; font-size: 16px; line-height: 1.6;">
            Hi${userName ? ` ${userName}` : ''},
          </p>
          <p style="margin-bottom: 24px; font-size: 16px; line-height: 1.6;">
            Your API key has been ${rotationType}. A new key has been created to replace the old one.
          </p>
          <div style="background-color: #1a1a2e; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
            <p style="margin: 0 0 8px 0; font-size: 14px; color: #9ca3af;">Token Name</p>
            <p style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600;">${tokenName}</p>
            <p style="margin: 0 0 8px 0; font-size: 14px; color: #9ca3af;">New Token Preview</p>
            <p style="margin: 0 0 16px 0; font-size: 14px; font-family: monospace; color: #8b5cf6;">${newTokenPreview}</p>
            <p style="margin: 0 0 8px 0; font-size: 14px; color: #9ca3af;">Old Token Valid Until</p>
            <p style="margin: 0; font-size: 16px; color: #f59e0b;">${validUntilStr}</p>
          </div>
          <div style="background-color: #422006; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
            <p style="margin: 0; font-size: 14px; color: #fef3c7;">
              <strong>Action Required:</strong> Update your applications with the new API key before the old one expires.
            </p>
          </div>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${dashboardUrl}" style="display: inline-block; background-color: #8b5cf6; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600;">
              View API Tokens
            </a>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `Your API key "${tokenName}" has been ${rotationType}.\n\nNew Token Preview: ${newTokenPreview}\nOld Token Valid Until: ${validUntilStr}\n\nPlease update your applications with the new API key.\n\nView your API tokens: ${dashboardUrl}`;

    return this.sendEmail({ to: email, subject, html, text });
  }
}

module.exports = new EmailService();
