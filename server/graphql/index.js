/**
 * @fileoverview Apollo Server Setup
 * @description GraphQL server configuration with authentication,
 * rate limiting, and query complexity limiting
 * @module graphql
 */

const { ApolloServer } = require('apollo-server-express');
const {
  ApolloServerPluginLandingPageGraphQLPlayground,
  ApolloServerPluginLandingPageDisabled
} = require('apollo-server-core');
const { makeExecutableSchema } = require('@graphql-tools/schema');
const { WebSocketServer } = require('ws');
const { useServer } = require('graphql-ws/use/ws');
const jwt = require('jsonwebtoken');
const typeDefs = require('./schema');
const resolvers = require('./resolvers');
const db = require('../db');
const log = require('../utils/logger');

// ==========================================
// QUERY COMPLEXITY PLUGIN
// ==========================================
const queryComplexityPlugin = {
  requestDidStart: () => ({
    didResolveOperation({ request, document }) {
      // Simple complexity calculation based on field count
      // In production, use graphql-query-complexity package
      const complexity = estimateComplexity(document);
      const maxComplexity = 1000;

      if (complexity > maxComplexity) {
        throw new Error(
          `Query complexity ${complexity} exceeds maximum allowed complexity of ${maxComplexity}`
        );
      }

      log.debug('[GRAPHQL] Query complexity', { complexity });
    }
  })
};

// Simple complexity estimator
function estimateComplexity(document) {
  let complexity = 0;

  const countFields = (node) => {
    if (node.kind === 'Field') {
      complexity += 1;
      if (node.selectionSet) {
        node.selectionSet.selections.forEach(countFields);
      }
    } else if (node.kind === 'OperationDefinition' && node.selectionSet) {
      node.selectionSet.selections.forEach(countFields);
    } else if (node.kind === 'FragmentSpread') {
      complexity += 5; // Fragments add complexity
    }
  };

  if (document.definitions) {
    document.definitions.forEach(countFields);
  }

  return complexity;
}

// ==========================================
// RATE LIMITING PLUGIN
// ==========================================
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 100; // 100 requests per minute

const rateLimitPlugin = {
  requestDidStart: ({ context }) => {
    const userId = context.user?.id || context.ip || 'anonymous';
    const now = Date.now();

    // Clean old entries
    const userLimit = rateLimitStore.get(userId) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW };

    if (now > userLimit.resetAt) {
      userLimit.count = 0;
      userLimit.resetAt = now + RATE_LIMIT_WINDOW;
    }

    userLimit.count++;
    rateLimitStore.set(userId, userLimit);

    if (userLimit.count > RATE_LIMIT_MAX) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }

    return {};
  }
};

// ==========================================
// LOGGING PLUGIN
// ==========================================
const loggingPlugin = {
  requestDidStart: ({ request, context }) => {
    const start = Date.now();
    const operationName = request.operationName || 'unknown';

    return {
      willSendResponse: ({ response }) => {
        const duration = Date.now() - start;
        log.info('[GRAPHQL] Request completed', {
          operation: operationName,
          duration: `${duration}ms`,
          userId: context.user?.id,
          errors: response.errors?.length || 0
        });
      },
      didEncounterErrors: ({ errors }) => {
        errors.forEach(error => {
          log.error('[GRAPHQL] Error', {
            message: error.message,
            path: error.path,
            userId: context.user?.id
          });
        });
      }
    };
  }
};

// ==========================================
// CONTEXT BUILDER
// ==========================================
const buildContext = async ({ req, connection }) => {
  // For WebSocket connections
  if (connection) {
    return connection.context;
  }

  const context = {
    ip: req.ip,
    user: null,
    organizationId: null
  };

  // Get token from Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      context.user = {
        id: decoded.id,
        email: decoded.email,
        name: decoded.username || decoded.name
      };
      context.organizationId = decoded.current_organization_id || decoded.organization_id;
    } catch (error) {
      log.debug('[GRAPHQL] Invalid token', { error: error.message });
    }
  }

  // Also check x-organization-id header
  const orgHeader = req.headers['x-organization-id'];
  if (orgHeader && context.user) {
    // Verify user is member of this organization
    try {
      const memberCheck = await db.query(
        `SELECT org_id FROM organization_members
         WHERE user_id = $1 AND org_id = $2 AND status = 'active'`,
        [context.user.id, orgHeader]
      );

      if (memberCheck.rows.length > 0) {
        context.organizationId = parseInt(orgHeader);
      }
    } catch (error) {
      log.error('[GRAPHQL] Error checking organization membership', { error: error.message });
    }
  }

  return context;
};

// ==========================================
// CREATE APOLLO SERVER
// ==========================================
const createApolloServer = async (httpServer) => {
  const schema = makeExecutableSchema({ typeDefs, resolvers });

  // Determine if we're in production
  const isProduction = process.env.NODE_ENV === 'production';

  const server = new ApolloServer({
    schema,
    context: buildContext,
    plugins: [
      // Logging
      loggingPlugin,
      // Rate limiting
      rateLimitPlugin,
      // Query complexity
      queryComplexityPlugin,
      // Playground control
      isProduction
        ? ApolloServerPluginLandingPageDisabled()
        : ApolloServerPluginLandingPageGraphQLPlayground({
            settings: {
              'editor.theme': 'dark',
              'request.credentials': 'include'
            }
          })
    ],
    introspection: !isProduction, // Disable introspection in production
    formatError: (error) => {
      // Don't expose internal errors in production
      if (isProduction && error.extensions?.code === 'INTERNAL_SERVER_ERROR') {
        return {
          message: 'An internal error occurred',
          extensions: { code: 'INTERNAL_SERVER_ERROR' }
        };
      }
      return error;
    }
  });

  await server.start();

  // Setup WebSocket server for subscriptions
  const wsServer = new WebSocketServer({
    server: httpServer,
    path: '/graphql'
  });

  useServer(
    {
      schema,
      context: async (ctx) => {
        // Get token from connection params
        const token = ctx.connectionParams?.authorization?.replace('Bearer ', '') ||
                      ctx.connectionParams?.token;

        const context = {
          user: null,
          organizationId: null
        };

        if (token) {
          try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            context.user = {
              id: decoded.id,
              email: decoded.email,
              name: decoded.username || decoded.name
            };
            context.organizationId = decoded.current_organization_id || decoded.organization_id;
          } catch (error) {
            log.debug('[GRAPHQL WS] Invalid token', { error: error.message });
          }
        }

        return context;
      },
      onConnect: (ctx) => {
        log.info('[GRAPHQL WS] Client connected');
      },
      onDisconnect: (ctx) => {
        log.info('[GRAPHQL WS] Client disconnected');
      }
    },
    wsServer
  );

  log.info('[GRAPHQL] Apollo Server initialized', {
    playground: !isProduction,
    introspection: !isProduction
  });

  return server;
};

// ==========================================
// APPLY MIDDLEWARE
// ==========================================
const applyGraphQLMiddleware = async (app, httpServer) => {
  const server = await createApolloServer(httpServer);

  server.applyMiddleware({
    app,
    path: '/graphql',
    cors: false // We handle CORS at the app level
  });

  log.info('[GRAPHQL] Middleware applied', { path: '/graphql' });

  return server;
};

module.exports = {
  createApolloServer,
  applyGraphQLMiddleware
};
