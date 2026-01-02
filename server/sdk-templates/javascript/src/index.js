/**
 * BotBuilder SDK for JavaScript/Node.js
 * Official SDK for interacting with the BotBuilder API
 */

const axios = require('axios');
const FormData = require('form-data');

class BotBuilder {
  constructor(config = {}) {
    this.apiKey = config.apiKey || process.env.BOTBUILDER_API_KEY;
    this.baseUrl = config.baseUrl || 'https://api.botbuilder.com';
    this.timeout = config.timeout || 30000;

    if (!this.apiKey) {
      throw new Error('API key is required. Set it via config.apiKey or BOTBUILDER_API_KEY env variable.');
    }

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeout,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'BotBuilder-SDK-JS/1.0.0'
      }
    });

    // Initialize resource clients
    this.bots = new BotsClient(this.client);
    this.messages = new MessagesClient(this.client);
    this.knowledge = new KnowledgeClient(this.client);
    this.analytics = new AnalyticsClient(this.client);
    this.webhooks = new WebhooksClient(this.client);
  }
}

class BotsClient {
  constructor(client) {
    this.client = client;
  }

  async list(params = {}) {
    const response = await this.client.get('/api/bots', { params });
    return response.data;
  }

  async get(botId) {
    const response = await this.client.get(`/api/bots/${botId}`);
    return response.data;
  }

  async create(data) {
    const response = await this.client.post('/api/bots', data);
    return response.data;
  }

  async update(botId, data) {
    const response = await this.client.put(`/api/bots/${botId}`, data);
    return response.data;
  }

  async delete(botId) {
    const response = await this.client.delete(`/api/bots/${botId}`);
    return response.data;
  }
}

class MessagesClient {
  constructor(client) {
    this.client = client;
  }

  async send(data) {
    const response = await this.client.post('/api/messages', data);
    return response.data;
  }

  async list(botId, params = {}) {
    const response = await this.client.get(`/api/bots/${botId}/messages`, { params });
    return response.data;
  }

  async get(messageId) {
    const response = await this.client.get(`/api/messages/${messageId}`);
    return response.data;
  }
}

class KnowledgeClient {
  constructor(client) {
    this.client = client;
  }

  async list(params = {}) {
    const response = await this.client.get('/api/knowledge', { params });
    return response.data;
  }

  async upload(file, metadata = {}) {
    const formData = new FormData();
    formData.append('file', file);
    Object.entries(metadata).forEach(([key, value]) => {
      formData.append(key, value);
    });

    const response = await this.client.post('/api/knowledge/upload', formData, {
      headers: formData.getHeaders()
    });
    return response.data;
  }

  async delete(documentId) {
    const response = await this.client.delete(`/api/knowledge/${documentId}`);
    return response.data;
  }
}

class AnalyticsClient {
  constructor(client) {
    this.client = client;
  }

  async getOverview(params = {}) {
    const response = await this.client.get('/api/analytics/overview', { params });
    return response.data;
  }

  async getMessages(params = {}) {
    const response = await this.client.get('/api/analytics/messages', { params });
    return response.data;
  }

  async getUsers(params = {}) {
    const response = await this.client.get('/api/analytics/users', { params });
    return response.data;
  }
}

class WebhooksClient {
  constructor(client) {
    this.client = client;
  }

  async list() {
    const response = await this.client.get('/api/webhooks');
    return response.data;
  }

  async create(data) {
    const response = await this.client.post('/api/webhooks', data);
    return response.data;
  }

  async update(webhookId, data) {
    const response = await this.client.put(`/api/webhooks/${webhookId}`, data);
    return response.data;
  }

  async delete(webhookId) {
    const response = await this.client.delete(`/api/webhooks/${webhookId}`);
    return response.data;
  }
}

module.exports = BotBuilder;
module.exports.default = BotBuilder;
