/**
 * @fileoverview GraphQL Resolvers Index
 * @description Combines all resolvers and adds custom scalar types
 * @module graphql/resolvers
 */

const { GraphQLScalarType, Kind } = require('graphql');
const Query = require('./query');
const Mutation = require('./mutation');
const { Subscription } = require('./subscription');

// ==========================================
// CUSTOM SCALAR TYPES
// ==========================================

const DateTimeScalar = new GraphQLScalarType({
  name: 'DateTime',
  description: 'DateTime custom scalar type',
  serialize(value) {
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value === 'string') {
      return new Date(value).toISOString();
    }
    return null;
  },
  parseValue(value) {
    if (typeof value === 'string') {
      return new Date(value);
    }
    return null;
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.STRING) {
      return new Date(ast.value);
    }
    return null;
  }
});

const JSONScalar = new GraphQLScalarType({
  name: 'JSON',
  description: 'JSON custom scalar type',
  serialize(value) {
    return value;
  },
  parseValue(value) {
    return value;
  },
  parseLiteral(ast) {
    switch (ast.kind) {
      case Kind.STRING:
        try {
          return JSON.parse(ast.value);
        } catch {
          return ast.value;
        }
      case Kind.OBJECT:
        return parseObject(ast);
      case Kind.LIST:
        return ast.values.map(v => parseLiteral(v));
      case Kind.INT:
        return parseInt(ast.value, 10);
      case Kind.FLOAT:
        return parseFloat(ast.value);
      case Kind.BOOLEAN:
        return ast.value;
      case Kind.NULL:
        return null;
      default:
        return null;
    }
  }
});

// Helper function for JSON parsing
function parseObject(ast) {
  const value = {};
  ast.fields.forEach(field => {
    value[field.name.value] = parseLiteral(field.value);
  });
  return value;
}

function parseLiteral(ast) {
  switch (ast.kind) {
    case Kind.STRING:
      return ast.value;
    case Kind.INT:
      return parseInt(ast.value, 10);
    case Kind.FLOAT:
      return parseFloat(ast.value);
    case Kind.BOOLEAN:
      return ast.value;
    case Kind.NULL:
      return null;
    case Kind.OBJECT:
      return parseObject(ast);
    case Kind.LIST:
      return ast.values.map(v => parseLiteral(v));
    default:
      return null;
  }
}

// ==========================================
// COMBINED RESOLVERS
// ==========================================

const resolvers = {
  DateTime: DateTimeScalar,
  JSON: JSONScalar,
  Query,
  Mutation,
  Subscription,

  // ==========================================
  // TYPE RESOLVERS (for nested fields)
  // ==========================================
  User: {
    organizations: async (parent, _, { loaders }) => {
      // DataLoader would be used here in production
      return [];
    },
    currentOrganization: async (parent, _, { organizationId, loaders }) => {
      if (!organizationId) return null;
      // DataLoader would be used here in production
      return null;
    }
  },

  Bot: {
    analytics: async (parent, _, { loaders }) => {
      // DataLoader would be used here in production
      return {
        totalMessages: 0,
        totalConversations: 0,
        averageResponseTime: 0,
        satisfactionRate: null,
        activeUsers: 0,
        messagesPerDay: []
      };
    },
    messageCount: async (parent, _, { loaders }) => {
      // DataLoader would be used here in production
      return 0;
    },
    conversationCount: async (parent, _, { loaders }) => {
      // DataLoader would be used here in production
      return 0;
    }
  },

  Conversation: {
    messages: async (parent, _, { loaders }) => {
      // DataLoader would be used here in production
      return [];
    }
  },

  Organization: {
    members: async (parent, _, { loaders }) => {
      // DataLoader would be used here in production
      return [];
    },
    bots: async (parent, _, { loaders }) => {
      // DataLoader would be used here in production
      return [];
    }
  }
};

module.exports = resolvers;
