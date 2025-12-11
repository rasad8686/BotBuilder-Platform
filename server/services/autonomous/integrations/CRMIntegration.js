/**
 * CRM Integration for Autonomous Agents
 * Generic CRM integration supporting HubSpot, Salesforce, Pipedrive
 */

const log = require('../../../utils/logger');

class CRMIntegration {
  constructor(credentials = {}) {
    this.type = 'crm';
    this.name = 'CRM';
    this.provider = credentials.provider || 'hubspot';
    this.accessToken = credentials.access_token;
    this.refreshToken = credentials.refresh_token;
    this.tokenExpiry = credentials.token_expires_at;
    this.apiKey = credentials.api_key;

    // Set base URL based on provider
    this.baseUrls = {
      hubspot: 'https://api.hubapi.com',
      salesforce: credentials.instance_url || 'https://login.salesforce.com',
      pipedrive: 'https://api.pipedrive.com/v1'
    };

    this.baseUrl = this.baseUrls[this.provider];
  }

  /**
   * Get OAuth2 configuration for HubSpot
   */
  static getOAuthConfig(provider = 'hubspot') {
    const configs = {
      hubspot: {
        authorizationUrl: 'https://app.hubspot.com/oauth/authorize',
        tokenUrl: 'https://api.hubapi.com/oauth/v1/token',
        clientId: process.env.HUBSPOT_CLIENT_ID,
        clientSecret: process.env.HUBSPOT_CLIENT_SECRET,
        scopes: ['crm.objects.contacts.read', 'crm.objects.contacts.write', 'crm.objects.deals.read', 'crm.objects.deals.write'],
        redirectUri: `${process.env.APP_URL}/api/integrations/crm/callback`
      },
      pipedrive: {
        authorizationUrl: 'https://oauth.pipedrive.com/oauth/authorize',
        tokenUrl: 'https://oauth.pipedrive.com/oauth/token',
        clientId: process.env.PIPEDRIVE_CLIENT_ID,
        clientSecret: process.env.PIPEDRIVE_CLIENT_SECRET,
        scopes: ['deals:read', 'deals:write', 'contacts:read', 'contacts:write'],
        redirectUri: `${process.env.APP_URL}/api/integrations/crm/callback`
      }
    };

    return configs[provider] || configs.hubspot;
  }

  /**
   * Exchange authorization code for tokens
   */
  static async exchangeCode(code, provider = 'hubspot') {
    const config = CRMIntegration.getOAuthConfig(provider);

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      code: code
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
      token_expires_at: new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString(),
      provider
    };
  }

  /**
   * Make API request to CRM
   */
  async request(endpoint, method = 'GET', body = null) {
    if (!this.accessToken && !this.apiKey) {
      throw new Error('No access token or API key available');
    }

    const headers = {
      'Content-Type': 'application/json'
    };

    // Set authorization based on provider
    if (this.provider === 'hubspot') {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    } else if (this.provider === 'pipedrive') {
      endpoint += (endpoint.includes('?') ? '&' : '?') + `api_token=${this.apiKey || this.accessToken}`;
    }

    const options = { method, headers };

    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }

    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}/${endpoint}`;
    const response = await fetch(url, options);

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || error.error || 'CRM API error');
    }

    if (response.status === 204) {
      return { success: true };
    }

    return await response.json();
  }

  // ==========================================
  // CONTACTS
  // ==========================================

  /**
   * Create a contact
   */
  async createContact(contactData) {
    log.info('CRMIntegration: Creating contact', { provider: this.provider });

    if (this.provider === 'hubspot') {
      const result = await this.request('crm/v3/objects/contacts', 'POST', {
        properties: {
          email: contactData.email,
          firstname: contactData.firstName,
          lastname: contactData.lastName,
          phone: contactData.phone,
          company: contactData.company,
          ...contactData.customFields
        }
      });

      return {
        success: true,
        contact: {
          id: result.id,
          email: result.properties.email,
          firstName: result.properties.firstname,
          lastName: result.properties.lastname
        }
      };
    }

    if (this.provider === 'pipedrive') {
      const result = await this.request('persons', 'POST', {
        name: `${contactData.firstName} ${contactData.lastName}`,
        email: [{ value: contactData.email, primary: true }],
        phone: contactData.phone ? [{ value: contactData.phone, primary: true }] : undefined,
        org_id: contactData.organizationId
      });

      return {
        success: true,
        contact: {
          id: result.data.id,
          name: result.data.name,
          email: result.data.email?.[0]?.value
        }
      };
    }

    throw new Error(`Provider ${this.provider} not supported`);
  }

  /**
   * Get contact by ID
   */
  async getContact(contactId) {
    log.info('CRMIntegration: Getting contact', { contactId, provider: this.provider });

    if (this.provider === 'hubspot') {
      const result = await this.request(`crm/v3/objects/contacts/${contactId}`);

      return {
        success: true,
        contact: {
          id: result.id,
          email: result.properties.email,
          firstName: result.properties.firstname,
          lastName: result.properties.lastname,
          phone: result.properties.phone,
          company: result.properties.company,
          createdAt: result.properties.createdate
        }
      };
    }

    if (this.provider === 'pipedrive') {
      const result = await this.request(`persons/${contactId}`);

      return {
        success: true,
        contact: {
          id: result.data.id,
          name: result.data.name,
          email: result.data.email?.[0]?.value,
          phone: result.data.phone?.[0]?.value,
          organization: result.data.org_name
        }
      };
    }

    throw new Error(`Provider ${this.provider} not supported`);
  }

  /**
   * List contacts
   */
  async listContacts(options = {}) {
    log.info('CRMIntegration: Listing contacts', { provider: this.provider });

    if (this.provider === 'hubspot') {
      const params = new URLSearchParams({
        limit: options.limit || 50
      });

      if (options.after) {
        params.append('after', options.after);
      }

      const result = await this.request(`crm/v3/objects/contacts?${params}`);

      return {
        success: true,
        contacts: result.results.map(c => ({
          id: c.id,
          email: c.properties.email,
          firstName: c.properties.firstname,
          lastName: c.properties.lastname
        })),
        paging: result.paging
      };
    }

    if (this.provider === 'pipedrive') {
      const params = new URLSearchParams({
        limit: options.limit || 50,
        start: options.start || 0
      });

      const result = await this.request(`persons?${params}`);

      return {
        success: true,
        contacts: (result.data || []).map(c => ({
          id: c.id,
          name: c.name,
          email: c.email?.[0]?.value
        })),
        hasMore: result.additional_data?.pagination?.more_items_in_collection
      };
    }

    throw new Error(`Provider ${this.provider} not supported`);
  }

  /**
   * Update contact
   */
  async updateContact(contactId, updates) {
    log.info('CRMIntegration: Updating contact', { contactId, provider: this.provider });

    if (this.provider === 'hubspot') {
      const properties = {};
      if (updates.firstName) properties.firstname = updates.firstName;
      if (updates.lastName) properties.lastname = updates.lastName;
      if (updates.email) properties.email = updates.email;
      if (updates.phone) properties.phone = updates.phone;
      if (updates.company) properties.company = updates.company;

      const result = await this.request(`crm/v3/objects/contacts/${contactId}`, 'PATCH', { properties });

      return {
        success: true,
        contact: {
          id: result.id,
          email: result.properties.email
        }
      };
    }

    if (this.provider === 'pipedrive') {
      const body = {};
      if (updates.firstName || updates.lastName) {
        body.name = `${updates.firstName || ''} ${updates.lastName || ''}`.trim();
      }
      if (updates.email) body.email = [{ value: updates.email, primary: true }];
      if (updates.phone) body.phone = [{ value: updates.phone, primary: true }];

      const result = await this.request(`persons/${contactId}`, 'PUT', body);

      return {
        success: true,
        contact: {
          id: result.data.id,
          name: result.data.name
        }
      };
    }

    throw new Error(`Provider ${this.provider} not supported`);
  }

  // ==========================================
  // DEALS
  // ==========================================

  /**
   * Create a deal
   */
  async createDeal(dealData) {
    log.info('CRMIntegration: Creating deal', { provider: this.provider });

    if (this.provider === 'hubspot') {
      const result = await this.request('crm/v3/objects/deals', 'POST', {
        properties: {
          dealname: dealData.name,
          amount: dealData.amount,
          dealstage: dealData.stage || 'appointmentscheduled',
          pipeline: dealData.pipeline || 'default',
          closedate: dealData.closeDate,
          ...dealData.customFields
        }
      });

      return {
        success: true,
        deal: {
          id: result.id,
          name: result.properties.dealname,
          amount: result.properties.amount,
          stage: result.properties.dealstage
        }
      };
    }

    if (this.provider === 'pipedrive') {
      const result = await this.request('deals', 'POST', {
        title: dealData.name,
        value: dealData.amount,
        currency: dealData.currency || 'USD',
        stage_id: dealData.stageId,
        person_id: dealData.contactId,
        org_id: dealData.organizationId,
        expected_close_date: dealData.closeDate
      });

      return {
        success: true,
        deal: {
          id: result.data.id,
          title: result.data.title,
          value: result.data.value,
          status: result.data.status
        }
      };
    }

    throw new Error(`Provider ${this.provider} not supported`);
  }

  /**
   * Update deal
   */
  async updateDeal(dealId, updates) {
    log.info('CRMIntegration: Updating deal', { dealId, provider: this.provider });

    if (this.provider === 'hubspot') {
      const properties = {};
      if (updates.name) properties.dealname = updates.name;
      if (updates.amount) properties.amount = updates.amount;
      if (updates.stage) properties.dealstage = updates.stage;
      if (updates.closeDate) properties.closedate = updates.closeDate;

      const result = await this.request(`crm/v3/objects/deals/${dealId}`, 'PATCH', { properties });

      return {
        success: true,
        deal: {
          id: result.id,
          name: result.properties.dealname,
          stage: result.properties.dealstage
        }
      };
    }

    if (this.provider === 'pipedrive') {
      const body = {};
      if (updates.name) body.title = updates.name;
      if (updates.amount) body.value = updates.amount;
      if (updates.stageId) body.stage_id = updates.stageId;
      if (updates.status) body.status = updates.status;

      const result = await this.request(`deals/${dealId}`, 'PUT', body);

      return {
        success: true,
        deal: {
          id: result.data.id,
          title: result.data.title,
          status: result.data.status
        }
      };
    }

    throw new Error(`Provider ${this.provider} not supported`);
  }

  /**
   * List deals
   */
  async listDeals(options = {}) {
    log.info('CRMIntegration: Listing deals', { provider: this.provider });

    if (this.provider === 'hubspot') {
      const params = new URLSearchParams({
        limit: options.limit || 50
      });

      if (options.after) {
        params.append('after', options.after);
      }

      const result = await this.request(`crm/v3/objects/deals?${params}`);

      return {
        success: true,
        deals: result.results.map(d => ({
          id: d.id,
          name: d.properties.dealname,
          amount: d.properties.amount,
          stage: d.properties.dealstage,
          closeDate: d.properties.closedate
        })),
        paging: result.paging
      };
    }

    if (this.provider === 'pipedrive') {
      const params = new URLSearchParams({
        limit: options.limit || 50,
        start: options.start || 0
      });

      if (options.status) {
        params.append('status', options.status);
      }

      const result = await this.request(`deals?${params}`);

      return {
        success: true,
        deals: (result.data || []).map(d => ({
          id: d.id,
          title: d.title,
          value: d.value,
          currency: d.currency,
          status: d.status,
          stageId: d.stage_id
        })),
        hasMore: result.additional_data?.pagination?.more_items_in_collection
      };
    }

    throw new Error(`Provider ${this.provider} not supported`);
  }

  /**
   * Test connection
   */
  async testConnection() {
    try {
      if (this.provider === 'hubspot') {
        const result = await this.request('crm/v3/objects/contacts?limit=1');
        return { success: true, provider: this.provider };
      }

      if (this.provider === 'pipedrive') {
        const result = await this.request('users/me');
        return {
          success: true,
          provider: this.provider,
          user: result.data?.name
        };
      }

      return { success: false, error: 'Unknown provider' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get available actions for this integration
   */
  static getAvailableActions() {
    return [
      {
        name: 'create_contact',
        description: 'Create a new contact in CRM',
        parameters: {
          email: { type: 'string', required: true },
          firstName: { type: 'string', required: true },
          lastName: { type: 'string', required: true },
          phone: { type: 'string', required: false },
          company: { type: 'string', required: false }
        }
      },
      {
        name: 'update_contact',
        description: 'Update an existing contact',
        parameters: {
          contactId: { type: 'string', required: true },
          firstName: { type: 'string', required: false },
          lastName: { type: 'string', required: false },
          email: { type: 'string', required: false },
          phone: { type: 'string', required: false }
        }
      },
      {
        name: 'create_deal',
        description: 'Create a new deal',
        parameters: {
          name: { type: 'string', required: true },
          amount: { type: 'number', required: false },
          stage: { type: 'string', required: false },
          contactId: { type: 'string', required: false }
        }
      },
      {
        name: 'update_deal',
        description: 'Update an existing deal',
        parameters: {
          dealId: { type: 'string', required: true },
          name: { type: 'string', required: false },
          amount: { type: 'number', required: false },
          stage: { type: 'string', required: false },
          status: { type: 'string', required: false }
        }
      },
      {
        name: 'list_contacts',
        description: 'List contacts from CRM',
        parameters: {
          limit: { type: 'number', required: false }
        }
      },
      {
        name: 'list_deals',
        description: 'List deals from CRM',
        parameters: {
          limit: { type: 'number', required: false },
          status: { type: 'string', required: false }
        }
      }
    ];
  }
}

module.exports = CRMIntegration;
