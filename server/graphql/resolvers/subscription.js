/**
 * @fileoverview GraphQL Subscription Resolvers
 * @description Resolvers for real-time GraphQL subscriptions
 * @module graphql/resolvers/subscription
 */

const { PubSub, withFilter } = require('graphql-subscriptions');
const log = require('../../utils/logger');

// Create PubSub instance for subscriptions
const pubsub = new PubSub();

// Subscription event types
const EVENTS = {
  MESSAGE_RECEIVED: 'MESSAGE_RECEIVED',
  BOT_STATUS_CHANGED: 'BOT_STATUS_CHANGED',
  ANALYTICS_UPDATED: 'ANALYTICS_UPDATED'
};

const Subscription = {
  // ==========================================
  // MESSAGE SUBSCRIPTION
  // ==========================================
  messageReceived: {
    subscribe: withFilter(
      () => pubsub.asyncIterator([EVENTS.MESSAGE_RECEIVED]),
      (payload, variables, context) => {
        // Filter by botId
        if (variables.botId && payload.messageReceived.botId !== variables.botId) {
          return false;
        }
        // Check if user has access to this bot
        // In production, add proper authorization check here
        return true;
      }
    )
  },

  // ==========================================
  // BOT STATUS SUBSCRIPTION
  // ==========================================
  botStatusChanged: {
    subscribe: withFilter(
      () => pubsub.asyncIterator([EVENTS.BOT_STATUS_CHANGED]),
      (payload, variables, context) => {
        // Filter by botId
        if (variables.botId && payload.botStatusChanged.id !== variables.botId) {
          return false;
        }
        return true;
      }
    )
  },

  // ==========================================
  // ANALYTICS SUBSCRIPTION
  // ==========================================
  analyticsUpdated: {
    subscribe: withFilter(
      () => pubsub.asyncIterator([EVENTS.ANALYTICS_UPDATED]),
      (payload, variables, context) => {
        // Filter by botId
        if (variables.botId && payload.analyticsUpdated.botId !== variables.botId) {
          return false;
        }
        return true;
      }
    )
  }
};

// ==========================================
// PUBLISH FUNCTIONS
// ==========================================

/**
 * Publish a new message event
 * @param {Object} message - The message object
 */
const publishMessage = (message) => {
  pubsub.publish(EVENTS.MESSAGE_RECEIVED, {
    messageReceived: {
      id: message.id,
      botId: message.bot_id || message.botId,
      conversationId: message.conversation_id || message.conversationId,
      role: message.role,
      content: message.content,
      metadata: message.metadata,
      createdAt: message.created_at || message.createdAt
    }
  });
  log.debug('[GRAPHQL] Published message event', { messageId: message.id });
};

/**
 * Publish a bot status change event
 * @param {Object} bot - The bot object
 */
const publishBotStatusChange = (bot) => {
  pubsub.publish(EVENTS.BOT_STATUS_CHANGED, {
    botStatusChanged: {
      id: bot.id,
      name: bot.name,
      status: bot.status,
      isActive: bot.is_active || bot.isActive
    }
  });
  log.debug('[GRAPHQL] Published bot status change', { botId: bot.id });
};

/**
 * Publish an analytics update event
 * @param {Object} analytics - The analytics object
 */
const publishAnalyticsUpdate = (analytics) => {
  pubsub.publish(EVENTS.ANALYTICS_UPDATED, {
    analyticsUpdated: {
      botId: analytics.botId,
      totalMessages: analytics.totalMessages,
      totalConversations: analytics.totalConversations,
      averageResponseTime: analytics.averageResponseTime,
      satisfactionRate: analytics.satisfactionRate,
      activeUsers: analytics.activeUsers
    }
  });
  log.debug('[GRAPHQL] Published analytics update', { botId: analytics.botId });
};

module.exports = {
  Subscription,
  pubsub,
  EVENTS,
  publishMessage,
  publishBotStatusChange,
  publishAnalyticsUpdate
};
