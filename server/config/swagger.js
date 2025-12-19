/**
 * Swagger/OpenAPI Configuration
 *
 * This file contains the OpenAPI 3.0 specification for the BotBuilder API.
 * Documentation is auto-generated from JSDoc comments in route files.
 */

const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'BotBuilder API',
      version: '1.0.0',
      description: `
# BotBuilder API Documentation

BotBuilder is a comprehensive chatbot building platform with AI integration,
multi-channel deployment, and enterprise features.

## Features
- **Bot Management**: Create, configure, and deploy chatbots
- **AI Integration**: OpenAI and Anthropic Claude support
- **Multi-Channel**: Telegram, Slack, Discord, WhatsApp, Web Widget
- **Knowledge Base**: RAG-powered document retrieval
- **Fine-Tuning**: Custom AI model training
- **Enterprise SSO**: SAML, OIDC, and SCIM support
- **Team Collaboration**: Role-based access control
- **Analytics**: Usage tracking and insights

## Authentication
Most endpoints require JWT authentication. Include the token in the Authorization header:
\`\`\`
Authorization: Bearer <your_jwt_token>
\`\`\`

## Rate Limiting
- Authentication endpoints: 5 requests per 15 minutes
- General API: 100 requests per minute
- AI endpoints: 30 requests per minute
      `,
      contact: {
        name: 'BotBuilder Support',
        email: 'support@botbuilder.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Development server'
      },
      {
        url: 'https://api.botbuilder.com',
        description: 'Production server'
      }
    ],
    tags: [
      { name: 'Authentication', description: 'User authentication and registration' },
      { name: 'Admin', description: 'Admin panel operations' },
      { name: 'AI', description: 'AI configuration, chat, and flow generation' },
      { name: 'Analytics', description: 'Usage analytics and reporting' },
      { name: 'Autonomous', description: 'Autonomous AI agents' },
      { name: 'Billing', description: 'Subscription and billing' },
      { name: 'Bots', description: 'Bot management operations' },
      { name: 'Channels', description: 'Channel integrations (Telegram, Slack, WhatsApp, Instagram)' },
      { name: 'Clone', description: 'Voice and personality cloning' },
      { name: 'Fine-Tuning', description: 'AI model fine-tuning' },
      { name: 'Flows', description: 'Bot conversation flows' },
      { name: 'Integrations', description: 'Third-party integrations' },
      { name: 'Knowledge Base', description: 'Document and knowledge management' },
      { name: 'Messages', description: 'Message history and management' },
      { name: 'NLU', description: 'Natural Language Understanding (Intents & Entities)' },
      { name: 'Organizations', description: 'Organization management' },
      { name: 'Plugins', description: 'Bot plugins and extensions' },
      { name: 'Roles', description: 'Role-based access control' },
      { name: 'SCIM', description: 'SCIM user provisioning' },
      { name: 'Sessions', description: 'Chat session management' },
      { name: 'SSO', description: 'Single Sign-On (SAML, OIDC)' },
      { name: 'Superadmin', description: 'Superadmin operations' },
      { name: 'Team', description: 'Team and member management' },
      { name: 'Tools', description: 'Bot tools and actions' },
      { name: 'Versions', description: 'Bot version management' },
      { name: 'Voice', description: 'Voice-to-bot functionality' },
      { name: 'Webhooks', description: 'Webhook management' },
      { name: 'Widget', description: 'Embeddable chat widget' },
      { name: 'Whitelabel', description: 'White-label customization' },
      { name: 'Workflows', description: 'Multi-agent workflows and orchestrations' }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT authentication token'
        },
        apiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'API key for external integrations'
        }
      },
      schemas: {
        // User schemas
        User: {
          type: 'object',
          properties: {
            id: { type: 'integer', description: 'User ID' },
            email: { type: 'string', format: 'email', description: 'User email' },
            name: { type: 'string', description: 'User name' },
            avatar_url: { type: 'string', description: 'Avatar URL' },
            is_verified: { type: 'boolean', description: 'Email verified status' },
            created_at: { type: 'string', format: 'date-time' }
          }
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email', example: 'user@example.com' },
            password: { type: 'string', format: 'password', minLength: 8 }
          }
        },
        RegisterRequest: {
          type: 'object',
          required: ['email', 'password', 'name'],
          properties: {
            email: { type: 'string', format: 'email', example: 'user@example.com' },
            password: { type: 'string', format: 'password', minLength: 8 },
            name: { type: 'string', example: 'John Doe' }
          }
        },
        AuthResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            token: { type: 'string', description: 'JWT access token (15 min)' },
            refreshToken: { type: 'string', description: 'Refresh token (7 days)' },
            expiresIn: { type: 'integer', description: 'Access token expiry in seconds', example: 900 },
            refreshExpiresAt: { type: 'string', format: 'date-time', description: 'Refresh token expiry time' },
            user: { $ref: '#/components/schemas/User' }
          }
        },
        TokenResponse: {
          type: 'object',
          description: 'JWT token response with refresh token rotation',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            token: { type: 'string', description: 'JWT access token (expires in 15 minutes)' },
            refreshToken: { type: 'string', description: 'Refresh token (expires in 7 days, single use)' },
            expiresIn: { type: 'integer', description: 'Access token expiry in seconds', example: 900 },
            refreshExpiresAt: { type: 'string', format: 'date-time', description: 'Refresh token expiry timestamp' },
            user: { $ref: '#/components/schemas/User' }
          }
        },

        // Bot schemas
        Bot: {
          type: 'object',
          properties: {
            id: { type: 'integer', description: 'Bot ID' },
            name: { type: 'string', description: 'Bot name' },
            description: { type: 'string', description: 'Bot description' },
            system_prompt: { type: 'string', description: 'AI system prompt' },
            language: { type: 'string', description: 'Bot language code' },
            status: { type: 'string', enum: ['active', 'inactive', 'draft'] },
            organization_id: { type: 'integer' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' }
          }
        },
        CreateBotRequest: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', example: 'Customer Support Bot' },
            description: { type: 'string', example: 'Handles customer inquiries' },
            system_prompt: { type: 'string', example: 'You are a helpful customer support agent.' },
            language: { type: 'string', example: 'en', default: 'en' }
          }
        },

        // AI Configuration schemas
        AIConfiguration: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            bot_id: { type: 'integer' },
            provider: { type: 'string', enum: ['openai', 'claude'] },
            model: { type: 'string', example: 'gpt-4o-mini' },
            temperature: { type: 'number', minimum: 0, maximum: 2, default: 0.7 },
            max_tokens: { type: 'integer', default: 1024 },
            system_prompt: { type: 'string' },
            context_window: { type: 'integer', default: 10 },
            is_enabled: { type: 'boolean', default: true }
          }
        },
        ChatRequest: {
          type: 'object',
          required: ['message'],
          properties: {
            message: { type: 'string', example: 'Hello, how can you help me?' },
            sessionId: { type: 'string', example: 'session_abc123' }
          }
        },
        ChatResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string', description: 'AI response' },
            usage: {
              type: 'object',
              properties: {
                prompt_tokens: { type: 'integer' },
                completion_tokens: { type: 'integer' },
                total_tokens: { type: 'integer' }
              }
            },
            cost: { type: 'number', description: 'Cost in USD' }
          }
        },

        // Knowledge Base schemas
        KnowledgeDocument: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            bot_id: { type: 'integer' },
            title: { type: 'string' },
            content: { type: 'string' },
            file_url: { type: 'string' },
            file_type: { type: 'string' },
            chunk_count: { type: 'integer' },
            status: { type: 'string', enum: ['pending', 'processing', 'ready', 'failed'] },
            created_at: { type: 'string', format: 'date-time' }
          }
        },

        // Fine-Tuning schemas
        FineTuningModel: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            name: { type: 'string' },
            base_model: { type: 'string', enum: ['gpt-4o-mini-2024-07-18', 'gpt-4o-2024-08-06'] },
            status: { type: 'string', enum: ['draft', 'training', 'ready', 'failed'] },
            fine_tuned_model: { type: 'string', description: 'OpenAI model ID after training' },
            training_file_id: { type: 'string' },
            training_examples: { type: 'integer' },
            training_cost: { type: 'number' },
            created_at: { type: 'string', format: 'date-time' }
          }
        },
        TrainingExample: {
          type: 'object',
          required: ['messages'],
          properties: {
            messages: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  role: { type: 'string', enum: ['system', 'user', 'assistant'] },
                  content: { type: 'string' }
                }
              }
            }
          }
        },

        // Organization schemas
        Organization: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            name: { type: 'string' },
            slug: { type: 'string' },
            plan: { type: 'string', enum: ['free', 'starter', 'professional', 'enterprise'] },
            owner_id: { type: 'integer' },
            created_at: { type: 'string', format: 'date-time' }
          }
        },
        TeamMember: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            user_id: { type: 'integer' },
            organization_id: { type: 'integer' },
            role: { type: 'string', enum: ['owner', 'admin', 'member', 'viewer'] },
            user: { $ref: '#/components/schemas/User' }
          }
        },

        // Channel schemas
        Channel: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            bot_id: { type: 'integer' },
            type: { type: 'string', enum: ['telegram', 'slack', 'discord', 'whatsapp', 'web'] },
            name: { type: 'string' },
            config: { type: 'object' },
            is_active: { type: 'boolean' },
            created_at: { type: 'string', format: 'date-time' }
          }
        },

        // SSO schemas
        SSOConfig: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            organization_id: { type: 'integer' },
            provider: { type: 'string', enum: ['saml', 'oidc'] },
            is_enabled: { type: 'boolean' },
            idp_entity_id: { type: 'string' },
            idp_sso_url: { type: 'string' },
            idp_certificate: { type: 'string' },
            created_at: { type: 'string', format: 'date-time' }
          }
        },

        // Analytics schemas
        AnalyticsOverview: {
          type: 'object',
          properties: {
            total_messages: { type: 'integer' },
            total_sessions: { type: 'integer' },
            total_users: { type: 'integer' },
            avg_session_duration: { type: 'number' },
            ai_cost: { type: 'number' }
          }
        },

        // Billing schemas
        Subscription: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            organization_id: { type: 'integer' },
            plan: { type: 'string' },
            status: { type: 'string', enum: ['active', 'cancelled', 'past_due'] },
            current_period_start: { type: 'string', format: 'date-time' },
            current_period_end: { type: 'string', format: 'date-time' }
          }
        },

        // Common response schemas
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string' }
          }
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string' },
            message: { type: 'string' }
          }
        },
        PaginatedResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'array', items: {} },
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'integer' },
                limit: { type: 'integer' },
                total: { type: 'integer' },
                totalPages: { type: 'integer' }
              }
            }
          }
        }
      },
      responses: {
        UnauthorizedError: {
          description: 'Access token is missing or invalid',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: { success: false, error: 'Unauthorized', message: 'Invalid or expired token' }
            }
          }
        },
        ForbiddenError: {
          description: 'Insufficient permissions',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: { success: false, error: 'Forbidden', message: 'You do not have permission to perform this action' }
            }
          }
        },
        NotFoundError: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: { success: false, error: 'Not Found', message: 'The requested resource was not found' }
            }
          }
        },
        ValidationError: {
          description: 'Validation error',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: { success: false, error: 'Validation Error', message: 'Invalid input data' }
            }
          }
        },
        RateLimitError: {
          description: 'Too many requests',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: { success: false, error: 'Too Many Requests', message: 'Rate limit exceeded. Please try again later.' }
            }
          }
        }
      }
    },
    security: [
      { bearerAuth: [] }
    ]
  },
  apis: [
    './server/routes/*.js',
    './server/server.js',
    './server/docs/*.yaml'
  ]
};

const specs = swaggerJsdoc(options);

/**
 * Setup Swagger UI middleware
 * @param {Express} app - Express application
 */
function setupSwagger(app) {
  // Swagger UI options
  const uiOptions = {
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info { margin: 30px 0 }
      .swagger-ui .info .title { color: #8b5cf6 }
    `,
    customSiteTitle: 'BotBuilder API Documentation',
    customfavIcon: '/favicon.ico'
  };

  // Serve Swagger UI
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, uiOptions));

  // Serve OpenAPI JSON
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(specs);
  });

  console.log('Swagger documentation available at /api-docs');
}

module.exports = { setupSwagger, specs };
