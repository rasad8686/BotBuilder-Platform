/**
 * @fileoverview GraphQL Schema
 * @description Type definitions for GraphQL API
 * @module graphql/schema
 */

const { gql } = require('apollo-server-express');

const typeDefs = gql`
  # ==========================================
  # SCALAR TYPES
  # ==========================================
  scalar DateTime
  scalar JSON

  # ==========================================
  # USER TYPES
  # ==========================================
  type User {
    id: ID!
    name: String!
    email: String!
    emailVerified: Boolean
    createdAt: DateTime
    updatedAt: DateTime
    organizations: [OrganizationMembership]
    currentOrganization: Organization
  }

  type OrganizationMembership {
    organization: Organization!
    role: String!
    status: String!
    joinedAt: DateTime
  }

  type Organization {
    id: ID!
    name: String!
    slug: String!
    planTier: String
    owner: User
    members: [OrganizationMember]
    bots: [Bot]
    createdAt: DateTime
  }

  type OrganizationMember {
    user: User!
    role: String!
    status: String!
    joinedAt: DateTime
  }

  # ==========================================
  # BOT TYPES
  # ==========================================
  type Bot {
    id: ID!
    name: String!
    description: String
    status: String!
    type: String
    aiProvider: String
    aiModel: String
    systemPrompt: String
    welcomeMessage: String
    isActive: Boolean!
    organization: Organization
    owner: User
    analytics: BotAnalytics
    messageCount: Int
    conversationCount: Int
    createdAt: DateTime
    updatedAt: DateTime
  }

  type BotConnection {
    nodes: [Bot!]!
    totalCount: Int!
    pageInfo: PageInfo!
  }

  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String
    endCursor: String
  }

  type BotAnalytics {
    totalMessages: Int!
    totalConversations: Int!
    averageResponseTime: Float
    satisfactionRate: Float
    activeUsers: Int
    messagesPerDay: [DailyCount]
  }

  type DailyCount {
    date: String!
    count: Int!
  }

  # ==========================================
  # MESSAGE TYPES
  # ==========================================
  type Message {
    id: ID!
    botId: ID!
    conversationId: String
    role: String!
    content: String!
    metadata: JSON
    createdAt: DateTime
  }

  type Conversation {
    id: ID!
    botId: ID!
    sessionId: String
    status: String
    messages: [Message]
    messageCount: Int
    createdAt: DateTime
    updatedAt: DateTime
  }

  # ==========================================
  # API TOKEN TYPES
  # ==========================================
  type APIToken {
    id: ID!
    name: String!
    preview: String!
    token: String
    isActive: Boolean!
    expiresAt: DateTime
    lastUsedAt: DateTime
    createdAt: DateTime
    usage: TokenUsage
  }

  type TokenUsage {
    totalRequests: Int!
    totalTokens: Int!
    totalCost: Float!
  }

  # ==========================================
  # ANALYTICS TYPES
  # ==========================================
  type Analytics {
    botId: ID!
    period: String!
    summary: AnalyticsSummary!
    dailyStats: [DailyStat]
    topIntents: [IntentStat]
    responseTimeDistribution: [ResponseTimeBucket]
  }

  type AnalyticsSummary {
    totalMessages: Int!
    totalConversations: Int!
    uniqueUsers: Int!
    averageResponseTime: Float!
    satisfactionScore: Float
    resolutionRate: Float
  }

  type DailyStat {
    date: String!
    messages: Int!
    conversations: Int!
    uniqueUsers: Int!
  }

  type IntentStat {
    intent: String!
    count: Int!
    percentage: Float!
  }

  type ResponseTimeBucket {
    range: String!
    count: Int!
  }

  # ==========================================
  # INPUT TYPES
  # ==========================================
  input CreateBotInput {
    name: String!
    description: String
    type: String
    aiProvider: String
    aiModel: String
    systemPrompt: String
    welcomeMessage: String
  }

  input UpdateBotInput {
    name: String
    description: String
    status: String
    aiProvider: String
    aiModel: String
    systemPrompt: String
    welcomeMessage: String
    isActive: Boolean
  }

  input CreateAPITokenInput {
    name: String!
    expiresInDays: Int
    botId: ID
  }

  input SendMessageInput {
    botId: ID!
    message: String!
    conversationId: String
    metadata: JSON
  }

  # ==========================================
  # QUERY TYPE
  # ==========================================
  type Query {
    # User queries
    me: User
    user(id: ID!): User

    # Bot queries
    bot(id: ID!): Bot
    bots(limit: Int, offset: Int, status: String): BotConnection

    # Analytics queries
    analytics(botId: ID!, period: String!): Analytics

    # Message queries
    messages(botId: ID!, limit: Int, offset: Int): [Message]
    conversation(id: ID!): Conversation
    conversations(botId: ID!, limit: Int, offset: Int): [Conversation]

    # API Token queries
    apiTokens: [APIToken]
    apiToken(id: ID!): APIToken

    # Organization queries
    organization(id: ID!): Organization
    organizations: [Organization]
  }

  # ==========================================
  # MUTATION TYPE
  # ==========================================
  type Mutation {
    # Bot mutations
    createBot(input: CreateBotInput!): Bot
    updateBot(id: ID!, input: UpdateBotInput!): Bot
    deleteBot(id: ID!): Boolean

    # Message mutations
    sendMessage(botId: ID!, message: String!, conversationId: String): Message

    # API Token mutations
    createAPIToken(input: CreateAPITokenInput!): APIToken
    deleteAPIToken(id: ID!): Boolean
    toggleAPIToken(id: ID!): APIToken

    # Organization mutations
    switchOrganization(organizationId: ID!): User
  }

  # ==========================================
  # SUBSCRIPTION TYPE
  # ==========================================
  type Subscription {
    # Real-time message subscription
    messageReceived(botId: ID!): Message

    # Bot status changes
    botStatusChanged(botId: ID!): Bot

    # Analytics updates
    analyticsUpdated(botId: ID!): BotAnalytics
  }
`;

module.exports = typeDefs;
