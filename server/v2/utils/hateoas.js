/**
 * HATEOAS Link Generator
 * Generates hypermedia links for API responses
 */

const BASE_PATH = '/api/v2';

/**
 * Generate links for a bot resource
 */
function botLinks(bot) {
  return {
    self: `${BASE_PATH}/bots/${bot.id}`,
    messages: `${BASE_PATH}/bots/${bot.id}/messages`,
    analytics: `${BASE_PATH}/bots/${bot.id}/analytics`,
    settings: `${BASE_PATH}/bots/${bot.id}/settings`,
    channels: `${BASE_PATH}/bots/${bot.id}/channels`,
    knowledge: `${BASE_PATH}/bots/${bot.id}/knowledge`
  };
}

/**
 * Generate links for a message resource
 */
function messageLinks(message, botId) {
  return {
    self: `${BASE_PATH}/bots/${botId}/messages/${message.id}`,
    bot: `${BASE_PATH}/bots/${botId}`,
    conversation: message.conversationId
      ? `${BASE_PATH}/bots/${botId}/conversations/${message.conversationId}`
      : null
  };
}

/**
 * Generate links for an agent resource
 */
function agentLinks(agent) {
  return {
    self: `${BASE_PATH}/agents/${agent.id}`,
    tasks: `${BASE_PATH}/agents/${agent.id}/tasks`,
    logs: `${BASE_PATH}/agents/${agent.id}/logs`,
    bot: agent.botId ? `${BASE_PATH}/bots/${agent.botId}` : null
  };
}

/**
 * Generate links for a webhook resource
 */
function webhookLinks(webhook) {
  return {
    self: `${BASE_PATH}/webhooks/${webhook.id}`,
    deliveries: `${BASE_PATH}/webhooks/${webhook.id}/deliveries`,
    test: `${BASE_PATH}/webhooks/${webhook.id}/test`
  };
}

/**
 * Generate links for a knowledge base resource
 */
function knowledgeLinks(kb, botId) {
  return {
    self: `${BASE_PATH}/bots/${botId}/knowledge/${kb.id}`,
    documents: `${BASE_PATH}/bots/${botId}/knowledge/${kb.id}/documents`,
    query: `${BASE_PATH}/bots/${botId}/knowledge/${kb.id}/query`,
    bot: `${BASE_PATH}/bots/${botId}`
  };
}

/**
 * Generate collection links
 */
function collectionLinks(resourceType, pagination = {}) {
  const links = {
    self: `${BASE_PATH}/${resourceType}`
  };

  if (pagination.nextCursor) {
    links.next = `${BASE_PATH}/${resourceType}?cursor=${pagination.nextCursor}`;
  }

  if (pagination.prevCursor) {
    links.prev = `${BASE_PATH}/${resourceType}?cursor=${pagination.prevCursor}`;
  }

  return links;
}

/**
 * Add links to a single resource
 */
function addLinks(resource, linkGenerator) {
  return {
    ...resource,
    _links: linkGenerator(resource)
  };
}

/**
 * Add links to a collection
 */
function addCollectionLinks(items, resourceType, linkGenerator, pagination = {}) {
  return {
    items: items.map(item => addLinks(item, linkGenerator)),
    _links: collectionLinks(resourceType, pagination)
  };
}

module.exports = {
  botLinks,
  messageLinks,
  agentLinks,
  webhookLinks,
  knowledgeLinks,
  collectionLinks,
  addLinks,
  addCollectionLinks,
  BASE_PATH
};
