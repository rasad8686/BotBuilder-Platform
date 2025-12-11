/**
 * Google Calendar Integration for Autonomous Agents
 * Handles calendar events and scheduling
 */

const log = require('../../../utils/logger');

class GoogleCalendarIntegration {
  constructor(credentials = {}) {
    this.type = 'google_calendar';
    this.name = 'Google Calendar';
    this.accessToken = credentials.access_token;
    this.refreshToken = credentials.refresh_token;
    this.tokenExpiry = credentials.token_expires_at;
    this.baseUrl = 'https://www.googleapis.com/calendar/v3';
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
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events'
      ],
      redirectUri: `${process.env.APP_URL}/api/integrations/google-calendar/callback`,
      accessType: 'offline',
      prompt: 'consent'
    };
  }

  /**
   * Exchange authorization code for tokens
   */
  static async exchangeCode(code) {
    const config = GoogleCalendarIntegration.getOAuthConfig();

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

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      token_expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
      scope: data.scope,
      token_type: data.token_type
    };
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken() {
    const config = GoogleCalendarIntegration.getOAuthConfig();

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
   * Make API request to Google Calendar
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
      throw new Error(error.error?.message || 'Google Calendar API error');
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return { success: true };
    }

    return await response.json();
  }

  /**
   * List calendars
   */
  async listCalendars() {
    log.info('GoogleCalendarIntegration: Listing calendars');

    const result = await this.request('users/me/calendarList');

    return {
      success: true,
      calendars: result.items.map(cal => ({
        id: cal.id,
        summary: cal.summary,
        description: cal.description,
        primary: cal.primary,
        accessRole: cal.accessRole,
        backgroundColor: cal.backgroundColor,
        timeZone: cal.timeZone
      }))
    };
  }

  /**
   * List events from a calendar
   */
  async listEvents(calendarId = 'primary', options = {}) {
    log.info('GoogleCalendarIntegration: Listing events', { calendarId });

    const params = new URLSearchParams({
      maxResults: options.maxResults || 50,
      orderBy: 'startTime',
      singleEvents: 'true',
      timeMin: options.timeMin || new Date().toISOString()
    });

    if (options.timeMax) {
      params.append('timeMax', options.timeMax);
    }

    if (options.q) {
      params.append('q', options.q);
    }

    const result = await this.request(`calendars/${encodeURIComponent(calendarId)}/events?${params}`);

    return {
      success: true,
      events: result.items.map(event => ({
        id: event.id,
        summary: event.summary,
        description: event.description,
        location: event.location,
        start: event.start,
        end: event.end,
        status: event.status,
        htmlLink: event.htmlLink,
        attendees: event.attendees?.map(a => ({
          email: a.email,
          displayName: a.displayName,
          responseStatus: a.responseStatus
        })),
        organizer: event.organizer,
        created: event.created,
        updated: event.updated
      })),
      nextPageToken: result.nextPageToken
    };
  }

  /**
   * Create a new event
   */
  async createEvent(calendarId = 'primary', eventData) {
    log.info('GoogleCalendarIntegration: Creating event', { calendarId, summary: eventData.summary });

    const event = {
      summary: eventData.summary,
      description: eventData.description,
      location: eventData.location,
      start: this.formatDateTime(eventData.startTime, eventData.timeZone),
      end: this.formatDateTime(eventData.endTime, eventData.timeZone)
    };

    // Add attendees
    if (eventData.attendees && eventData.attendees.length > 0) {
      event.attendees = eventData.attendees.map(email => ({ email }));
    }

    // Add reminders
    if (eventData.reminders) {
      event.reminders = {
        useDefault: false,
        overrides: eventData.reminders
      };
    }

    // Add recurrence
    if (eventData.recurrence) {
      event.recurrence = eventData.recurrence;
    }

    // Add conference (Google Meet)
    if (eventData.addConference) {
      event.conferenceData = {
        createRequest: {
          requestId: `meet-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' }
        }
      };
    }

    const params = eventData.addConference ? '?conferenceDataVersion=1' : '';
    const result = await this.request(`calendars/${encodeURIComponent(calendarId)}/events${params}`, 'POST', event);

    return {
      success: true,
      event: {
        id: result.id,
        summary: result.summary,
        htmlLink: result.htmlLink,
        start: result.start,
        end: result.end,
        meetLink: result.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video')?.uri
      }
    };
  }

  /**
   * Update an event
   */
  async updateEvent(calendarId = 'primary', eventId, updates) {
    log.info('GoogleCalendarIntegration: Updating event', { calendarId, eventId });

    // Get existing event first
    const existing = await this.request(`calendars/${encodeURIComponent(calendarId)}/events/${eventId}`);

    const event = {
      ...existing,
      ...updates
    };

    if (updates.startTime) {
      event.start = this.formatDateTime(updates.startTime, updates.timeZone);
    }
    if (updates.endTime) {
      event.end = this.formatDateTime(updates.endTime, updates.timeZone);
    }

    const result = await this.request(`calendars/${encodeURIComponent(calendarId)}/events/${eventId}`, 'PUT', event);

    return {
      success: true,
      event: {
        id: result.id,
        summary: result.summary,
        htmlLink: result.htmlLink,
        updated: result.updated
      }
    };
  }

  /**
   * Delete an event
   */
  async deleteEvent(calendarId = 'primary', eventId) {
    log.info('GoogleCalendarIntegration: Deleting event', { calendarId, eventId });

    await this.request(`calendars/${encodeURIComponent(calendarId)}/events/${eventId}`, 'DELETE');

    return {
      success: true,
      deleted: true,
      eventId
    };
  }

  /**
   * Get free/busy information
   */
  async getFreeBusy(timeMin, timeMax, calendars = ['primary']) {
    log.info('GoogleCalendarIntegration: Getting free/busy');

    const result = await this.request('freeBusy', 'POST', {
      timeMin,
      timeMax,
      items: calendars.map(id => ({ id }))
    });

    return {
      success: true,
      calendars: Object.entries(result.calendars).map(([id, data]) => ({
        id,
        busy: data.busy,
        errors: data.errors
      }))
    };
  }

  /**
   * Format date/time for Google Calendar API
   */
  formatDateTime(dateTime, timeZone) {
    if (typeof dateTime === 'string' && dateTime.includes('T')) {
      return { dateTime, timeZone: timeZone || 'UTC' };
    }
    // All-day event
    return { date: dateTime };
  }

  /**
   * Test connection
   */
  async testConnection() {
    try {
      const result = await this.listCalendars();
      return {
        success: true,
        calendarsCount: result.calendars.length,
        primaryCalendar: result.calendars.find(c => c.primary)?.summary
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
        name: 'list_events',
        description: 'List calendar events',
        parameters: {
          calendarId: { type: 'string', required: false, default: 'primary' },
          maxResults: { type: 'number', required: false },
          timeMin: { type: 'string', required: false },
          timeMax: { type: 'string', required: false }
        }
      },
      {
        name: 'create_event',
        description: 'Create a new calendar event',
        parameters: {
          summary: { type: 'string', required: true },
          startTime: { type: 'string', required: true },
          endTime: { type: 'string', required: true },
          description: { type: 'string', required: false },
          location: { type: 'string', required: false },
          attendees: { type: 'array', required: false }
        }
      },
      {
        name: 'delete_event',
        description: 'Delete a calendar event',
        parameters: {
          eventId: { type: 'string', required: true },
          calendarId: { type: 'string', required: false }
        }
      },
      {
        name: 'list_calendars',
        description: 'List all calendars',
        parameters: {}
      }
    ];
  }
}

module.exports = GoogleCalendarIntegration;
