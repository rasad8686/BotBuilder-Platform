/**
 * MessageBus - Handles agent-to-agent messaging
 */

const AgentMessage = require('../../models/AgentMessage');

class MessageBus {
  constructor(executionId) {
    this.executionId = executionId;
    this.subscribers = new Map();
    this.messageQueue = [];
  }

  /**
   * Send a message from one agent to another
   * @param {number} fromAgentId - Sender agent ID
   * @param {number} toAgentId - Recipient agent ID (or '*' for broadcast)
   * @param {string} messageType - Type of message (data, request, response, error)
   * @param {any} content - Message content
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} - Created message
   */
  async send(fromAgentId, toAgentId, messageType, content, metadata = {}) {
    const message = await AgentMessage.create({
      execution_id: this.executionId,
      from_agent_id: fromAgentId,
      to_agent_id: toAgentId,
      message_type: messageType,
      content,
      metadata
    });

    // Add to local queue
    this.messageQueue.push(message);

    // Notify subscribers
    await this.notifySubscribers(message);

    return message;
  }

  /**
   * Receive messages for an agent
   * @param {number} agentId - Agent ID
   * @param {Object} options - Filter options
   * @returns {Promise<Array>} - Messages for the agent
   */
  async receive(agentId, options = {}) {
    const messages = await AgentMessage.findByToAgentId(this.executionId, agentId);

    // Apply filters
    let filtered = messages;

    if (options.messageType) {
      filtered = filtered.filter(m => m.message_type === options.messageType);
    }

    if (options.fromAgentId) {
      filtered = filtered.filter(m => m.from_agent_id === options.fromAgentId);
    }

    if (options.since) {
      filtered = filtered.filter(m => new Date(m.timestamp) > new Date(options.since));
    }

    if (options.limit) {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  }

  /**
   * Get message history for the execution
   * @param {Object} options - Filter options
   * @returns {Promise<Array>} - All messages
   */
  async getHistory(options = {}) {
    let messages = await AgentMessage.findByExecutionId(this.executionId);

    // Apply filters
    if (options.messageType) {
      messages = messages.filter(m => m.message_type === options.messageType);
    }

    if (options.fromAgentId) {
      messages = messages.filter(m => m.from_agent_id === options.fromAgentId);
    }

    if (options.toAgentId) {
      messages = messages.filter(m => m.to_agent_id === options.toAgentId);
    }

    return messages;
  }

  /**
   * Broadcast message to all agents
   * @param {number} fromAgentId - Sender agent ID
   * @param {string} messageType - Type of message
   * @param {any} content - Message content
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} - Created message
   */
  async broadcast(fromAgentId, messageType, content, metadata = {}) {
    return this.send(fromAgentId, '*', messageType, content, {
      ...metadata,
      broadcast: true
    });
  }

  /**
   * Subscribe to messages
   * @param {number} agentId - Agent ID to subscribe
   * @param {Function} callback - Callback function
   */
  subscribe(agentId, callback) {
    if (!this.subscribers.has(agentId)) {
      this.subscribers.set(agentId, []);
    }
    this.subscribers.get(agentId).push(callback);
  }

  /**
   * Unsubscribe from messages
   * @param {number} agentId - Agent ID to unsubscribe
   * @param {Function} callback - Callback to remove
   */
  unsubscribe(agentId, callback) {
    if (this.subscribers.has(agentId)) {
      const callbacks = this.subscribers.get(agentId);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * Notify subscribers of new message
   * @param {Object} message - The message
   */
  async notifySubscribers(message) {
    const toAgentId = message.to_agent_id;

    // Notify specific agent
    if (this.subscribers.has(toAgentId)) {
      for (const callback of this.subscribers.get(toAgentId)) {
        await callback(message);
      }
    }

    // Notify broadcast subscribers
    if (toAgentId === '*') {
      for (const [agentId, callbacks] of this.subscribers) {
        if (agentId !== message.from_agent_id) {
          for (const callback of callbacks) {
            await callback(message);
          }
        }
      }
    }
  }

  /**
   * Wait for a response message
   * @param {number} fromAgentId - Expected sender
   * @param {number} toAgentId - Expected recipient
   * @param {number} timeout - Timeout in ms
   * @returns {Promise<Object>} - Response message
   */
  async waitForResponse(fromAgentId, toAgentId, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.unsubscribe(toAgentId, handler);
        reject(new Error('Response timeout'));
      }, timeout);

      const handler = (message) => {
        if (message.from_agent_id === fromAgentId && message.message_type === 'response') {
          clearTimeout(timeoutId);
          this.unsubscribe(toAgentId, handler);
          resolve(message);
        }
      };

      this.subscribe(toAgentId, handler);
    });
  }

  /**
   * Send request and wait for response
   * @param {number} fromAgentId - Sender
   * @param {number} toAgentId - Recipient
   * @param {any} content - Request content
   * @param {number} timeout - Timeout in ms
   * @returns {Promise<Object>} - Response
   */
  async request(fromAgentId, toAgentId, content, timeout = 30000) {
    await this.send(fromAgentId, toAgentId, 'request', content);
    return this.waitForResponse(toAgentId, fromAgentId, timeout);
  }

  /**
   * Get message count
   * @returns {Promise<number>} - Message count
   */
  async getMessageCount() {
    return AgentMessage.countByExecutionId(this.executionId);
  }

  /**
   * Clear local queue
   */
  clearQueue() {
    this.messageQueue = [];
  }

  /**
   * Clear all subscribers
   */
  clearSubscribers() {
    this.subscribers.clear();
  }
}

module.exports = MessageBus;
