/**
 * Gmail Integration for Autonomous Agents
 * Handles email reading and sending via Gmail API
 */

const log = require('../../../utils/logger');

class GmailIntegration {
  constructor(credentials = {}) {
    this.type = 'gmail';
    this.name = 'Gmail';
    this.accessToken = credentials.access_token;
    this.refreshToken = credentials.refresh_token;
    this.tokenExpiry = credentials.token_expires_at;
    this.userEmail = credentials.email;
    this.baseUrl = 'https://gmail.googleapis.com/gmail/v1';
  }

  /**
   * Get OAuth2 configuration
   */
  static getOAuthConfig() {
    return {
      authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      scopes: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.compose',
        'https://www.googleapis.com/auth/gmail.labels'
      ],
      redirectUri: `${process.env.APP_URL}/api/integrations/gmail/callback`,
      accessType: 'offline',
      prompt: 'consent'
    };
  }

  /**
   * Exchange authorization code for tokens
   */
  static async exchangeCode(code) {
    const config = GmailIntegration.getOAuthConfig();

    const params = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: config.redirectUri
    });

    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error_description || data.error);
    }

    // Get user email
    const userInfo = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { 'Authorization': `Bearer ${data.access_token}` }
    }).then(r => r.json());

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      token_expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
      scope: data.scope,
      email: userInfo.email
    };
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken() {
    const config = GmailIntegration.getOAuthConfig();

    const params = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: this.refreshToken,
      grant_type: 'refresh_token'
    });

    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error_description || data.error);
    }

    this.accessToken = data.access_token;
    this.tokenExpiry = new Date(Date.now() + data.expires_in * 1000).toISOString();

    return {
      access_token: data.access_token,
      token_expires_at: this.tokenExpiry
    };
  }

  /**
   * Make API request to Gmail
   */
  async request(endpoint, method = 'GET', body = null) {
    // Check if token needs refresh
    if (this.tokenExpiry && new Date(this.tokenExpiry) < new Date()) {
      await this.refreshAccessToken();
    }

    if (!this.accessToken) {
      throw new Error('No access token available');
    }

    const options = {
      method,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      }
    };

    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }

    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}/${endpoint}`;
    const response = await fetch(url, options);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Gmail API error');
    }

    if (response.status === 204) {
      return { success: true };
    }

    return await response.json();
  }

  /**
   * List emails
   */
  async listEmails(options = {}) {
    log.info('GmailIntegration: Listing emails');

    const params = new URLSearchParams({
      maxResults: options.maxResults || 20
    });

    if (options.q) {
      params.append('q', options.q);
    }
    if (options.labelIds) {
      options.labelIds.forEach(id => params.append('labelIds', id));
    }
    if (options.pageToken) {
      params.append('pageToken', options.pageToken);
    }

    const result = await this.request(`users/me/messages?${params}`);

    // Fetch message details
    const messages = [];
    for (const msg of (result.messages || []).slice(0, options.maxResults || 20)) {
      const detail = await this.getEmail(msg.id, 'metadata');
      messages.push(detail);
    }

    return {
      success: true,
      messages,
      nextPageToken: result.nextPageToken,
      resultSizeEstimate: result.resultSizeEstimate
    };
  }

  /**
   * Get single email
   */
  async getEmail(messageId, format = 'full') {
    log.info('GmailIntegration: Getting email', { messageId });

    const result = await this.request(`users/me/messages/${messageId}?format=${format}`);

    const headers = {};
    result.payload?.headers?.forEach(h => {
      headers[h.name.toLowerCase()] = h.value;
    });

    return {
      id: result.id,
      threadId: result.threadId,
      labelIds: result.labelIds,
      snippet: result.snippet,
      from: headers.from,
      to: headers.to,
      subject: headers.subject,
      date: headers.date,
      body: this.extractBody(result.payload),
      internalDate: result.internalDate
    };
  }

  /**
   * Extract body from message payload
   */
  extractBody(payload) {
    if (!payload) return null;

    // Simple text/html body
    if (payload.body?.data) {
      return Buffer.from(payload.body.data, 'base64').toString('utf-8');
    }

    // Multipart message
    if (payload.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          return Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
        if (part.mimeType === 'text/html' && part.body?.data) {
          return Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
        // Nested parts
        if (part.parts) {
          const nested = this.extractBody(part);
          if (nested) return nested;
        }
      }
    }

    return null;
  }

  /**
   * Send email
   */
  async sendEmail(to, subject, body, options = {}) {
    log.info('GmailIntegration: Sending email', { to, subject });

    const from = this.userEmail || 'me';

    // Build email
    const emailLines = [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0'
    ];

    if (options.cc) {
      emailLines.push(`Cc: ${options.cc}`);
    }
    if (options.bcc) {
      emailLines.push(`Bcc: ${options.bcc}`);
    }
    if (options.replyTo) {
      emailLines.push(`Reply-To: ${options.replyTo}`);
    }

    // HTML or plain text
    if (options.html) {
      emailLines.push('Content-Type: text/html; charset=utf-8');
    } else {
      emailLines.push('Content-Type: text/plain; charset=utf-8');
    }

    emailLines.push('');
    emailLines.push(body);

    const email = emailLines.join('\r\n');
    const encodedEmail = Buffer.from(email).toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const requestBody = { raw: encodedEmail };

    // Thread reply
    if (options.threadId) {
      requestBody.threadId = options.threadId;
    }

    const result = await this.request('users/me/messages/send', 'POST', requestBody);

    return {
      success: true,
      messageId: result.id,
      threadId: result.threadId,
      labelIds: result.labelIds
    };
  }

  /**
   * Reply to email
   */
  async replyToEmail(messageId, body, options = {}) {
    log.info('GmailIntegration: Replying to email', { messageId });

    // Get original message
    const original = await this.getEmail(messageId);

    const to = original.from;
    const subject = original.subject.startsWith('Re:')
      ? original.subject
      : `Re: ${original.subject}`;

    return await this.sendEmail(to, subject, body, {
      ...options,
      threadId: original.threadId
    });
  }

  /**
   * List labels
   */
  async listLabels() {
    log.info('GmailIntegration: Listing labels');

    const result = await this.request('users/me/labels');

    return {
      success: true,
      labels: result.labels.map(l => ({
        id: l.id,
        name: l.name,
        type: l.type,
        messageListVisibility: l.messageListVisibility,
        labelListVisibility: l.labelListVisibility
      }))
    };
  }

  /**
   * Modify labels on a message
   */
  async modifyLabels(messageId, addLabels = [], removeLabels = []) {
    log.info('GmailIntegration: Modifying labels', { messageId });

    const result = await this.request(`users/me/messages/${messageId}/modify`, 'POST', {
      addLabelIds: addLabels,
      removeLabelIds: removeLabels
    });

    return {
      success: true,
      messageId: result.id,
      labelIds: result.labelIds
    };
  }

  /**
   * Mark as read
   */
  async markAsRead(messageId) {
    return await this.modifyLabels(messageId, [], ['UNREAD']);
  }

  /**
   * Mark as unread
   */
  async markAsUnread(messageId) {
    return await this.modifyLabels(messageId, ['UNREAD'], []);
  }

  /**
   * Search emails
   */
  async searchEmails(query, options = {}) {
    return await this.listEmails({
      ...options,
      q: query
    });
  }

  /**
   * Test connection
   */
  async testConnection() {
    try {
      const result = await this.request('users/me/profile');
      return {
        success: true,
        email: result.emailAddress,
        messagesTotal: result.messagesTotal,
        threadsTotal: result.threadsTotal
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get available actions for this integration
   */
  static getAvailableActions() {
    return [
      {
        name: 'list_emails',
        description: 'List emails from inbox',
        parameters: {
          maxResults: { type: 'number', required: false },
          q: { type: 'string', required: false, description: 'Search query' },
          labelIds: { type: 'array', required: false }
        }
      },
      {
        name: 'get_email',
        description: 'Get a single email by ID',
        parameters: {
          messageId: { type: 'string', required: true }
        }
      },
      {
        name: 'send_email',
        description: 'Send a new email',
        parameters: {
          to: { type: 'string', required: true },
          subject: { type: 'string', required: true },
          body: { type: 'string', required: true },
          html: { type: 'boolean', required: false }
        }
      },
      {
        name: 'reply_to_email',
        description: 'Reply to an existing email',
        parameters: {
          messageId: { type: 'string', required: true },
          body: { type: 'string', required: true }
        }
      },
      {
        name: 'search_emails',
        description: 'Search emails with query',
        parameters: {
          query: { type: 'string', required: true },
          maxResults: { type: 'number', required: false }
        }
      }
    ];
  }
}

module.exports = GmailIntegration;
