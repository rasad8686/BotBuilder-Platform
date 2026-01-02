/**
 * API Documentation Routes
 * Provides OpenAPI/Swagger specification for API Playground
 */

const express = require('express');
const router = express.Router();

/**
 * OpenAPI 3.0 Specification
 */
const openApiSpec = {
  openapi: '3.0.0',
  info: {
    title: 'BotBuilder API',
    version: '1.0.0',
    description: 'Complete API for BotBuilder platform - AI chatbots, channels, clone, voice, and more'
  },
  servers: [
    { url: '/api', description: 'API Server' }
  ],
  tags: [
    { name: 'Auth', description: 'Authentication endpoints' },
    { name: 'Bots', description: 'Bot management' },
    { name: 'AI', description: 'AI and chat operations' },
    { name: 'Channels', description: 'Channel integrations' },
    { name: 'Clone', description: 'Voice and personality cloning' },
    { name: 'Knowledge', description: 'Knowledge base management' },
    { name: 'Analytics', description: 'Analytics and metrics' },
    { name: 'Plugins', description: 'Plugin marketplace' },
    { name: 'Webhooks', description: 'Webhook management' },
    { name: 'Users', description: 'User management' },
    { name: 'Organizations', description: 'Organization management' }
  ],
  paths: {
    // Auth endpoints
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'User login',
        description: 'Authenticate user and get JWT token',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email', example: 'user@example.com' },
                  password: { type: 'string', example: 'password123' }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Login successful', content: { 'application/json': { schema: { type: 'object', properties: { token: { type: 'string' }, user: { type: 'object' } } } } } },
          '401': { description: 'Invalid credentials' }
        }
      }
    },
    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'User registration',
        description: 'Create new user account',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password', 'name'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 8 },
                  name: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '201': { description: 'User created' },
          '400': { description: 'Validation error' }
        }
      }
    },
    '/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Get current user',
        description: 'Get authenticated user profile',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'User profile' },
          '401': { description: 'Unauthorized' }
        }
      }
    },

    // Bots endpoints
    '/bots': {
      get: {
        tags: ['Bots'],
        summary: 'List all bots',
        description: 'Get all bots for the authenticated user',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['active', 'inactive', 'draft'] } }
        ],
        responses: {
          '200': { description: 'List of bots' }
        }
      },
      post: {
        tags: ['Bots'],
        summary: 'Create bot',
        description: 'Create a new bot',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string', example: 'My Bot' },
                  description: { type: 'string' },
                  ai_model: { type: 'string', enum: ['gpt-4', 'gpt-3.5-turbo', 'claude-3-opus', 'claude-3-sonnet'] },
                  system_prompt: { type: 'string' },
                  temperature: { type: 'number', minimum: 0, maximum: 2 }
                }
              }
            }
          }
        },
        responses: {
          '201': { description: 'Bot created' },
          '400': { description: 'Validation error' }
        }
      }
    },
    '/bots/{id}': {
      get: {
        tags: ['Bots'],
        summary: 'Get bot by ID',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: {
          '200': { description: 'Bot details' },
          '404': { description: 'Bot not found' }
        }
      },
      put: {
        tags: ['Bots'],
        summary: 'Update bot',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' },
                  ai_model: { type: 'string' },
                  system_prompt: { type: 'string' },
                  temperature: { type: 'number' },
                  status: { type: 'string', enum: ['active', 'inactive'] }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Bot updated' }
        }
      },
      delete: {
        tags: ['Bots'],
        summary: 'Delete bot',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: {
          '200': { description: 'Bot deleted' }
        }
      }
    },

    // AI endpoints
    '/ai/chat': {
      post: {
        tags: ['AI'],
        summary: 'Send chat message',
        description: 'Send message to AI and get response',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['bot_id', 'message'],
                properties: {
                  bot_id: { type: 'integer' },
                  message: { type: 'string', example: 'Hello, how are you?' },
                  conversation_id: { type: 'string' },
                  context: { type: 'object' }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'AI response', content: { 'application/json': { schema: { type: 'object', properties: { response: { type: 'string' }, conversation_id: { type: 'string' } } } } } }
        }
      }
    },
    '/ai/models': {
      get: {
        tags: ['AI'],
        summary: 'List available AI models',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'List of AI models' }
        }
      }
    },
    '/ai/completions': {
      post: {
        tags: ['AI'],
        summary: 'Text completion',
        description: 'Generate text completion',
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['prompt'],
                properties: {
                  prompt: { type: 'string' },
                  model: { type: 'string' },
                  max_tokens: { type: 'integer', default: 500 },
                  temperature: { type: 'number', default: 0.7 }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Completion result' }
        }
      }
    },

    // Channels endpoints
    '/channels': {
      get: {
        tags: ['Channels'],
        summary: 'List channels',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'List of channels' }
        }
      },
      post: {
        tags: ['Channels'],
        summary: 'Create channel',
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['type', 'bot_id'],
                properties: {
                  type: { type: 'string', enum: ['telegram', 'slack', 'discord', 'whatsapp', 'facebook', 'web'] },
                  bot_id: { type: 'integer' },
                  config: { type: 'object' }
                }
              }
            }
          }
        },
        responses: {
          '201': { description: 'Channel created' }
        }
      }
    },
    '/channels/{id}': {
      get: {
        tags: ['Channels'],
        summary: 'Get channel',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: {
          '200': { description: 'Channel details' }
        }
      },
      put: {
        tags: ['Channels'],
        summary: 'Update channel',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        requestBody: {
          content: { 'application/json': { schema: { type: 'object' } } }
        },
        responses: {
          '200': { description: 'Channel updated' }
        }
      },
      delete: {
        tags: ['Channels'],
        summary: 'Delete channel',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: {
          '200': { description: 'Channel deleted' }
        }
      }
    },

    // Clone endpoints
    '/clone/voice': {
      post: {
        tags: ['Clone'],
        summary: 'Create voice clone',
        description: 'Clone a voice from audio samples',
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  audio_files: { type: 'array', items: { type: 'string', format: 'binary' } }
                }
              }
            }
          }
        },
        responses: {
          '201': { description: 'Voice clone created' }
        }
      },
      get: {
        tags: ['Clone'],
        summary: 'List voice clones',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'List of voice clones' }
        }
      }
    },
    '/clone/personality': {
      post: {
        tags: ['Clone'],
        summary: 'Create personality clone',
        description: 'Clone personality from text samples',
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  samples: { type: 'array', items: { type: 'string' } },
                  description: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '201': { description: 'Personality clone created' }
        }
      },
      get: {
        tags: ['Clone'],
        summary: 'List personality clones',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'List of personality clones' }
        }
      }
    },
    '/clone/style': {
      post: {
        tags: ['Clone'],
        summary: 'Create style clone',
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  writing_samples: { type: 'array', items: { type: 'string' } }
                }
              }
            }
          }
        },
        responses: {
          '201': { description: 'Style clone created' }
        }
      }
    },

    // Knowledge endpoints
    '/knowledge': {
      get: {
        tags: ['Knowledge'],
        summary: 'List knowledge bases',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'List of knowledge bases' }
        }
      },
      post: {
        tags: ['Knowledge'],
        summary: 'Create knowledge base',
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' },
                  bot_id: { type: 'integer' }
                }
              }
            }
          }
        },
        responses: {
          '201': { description: 'Knowledge base created' }
        }
      }
    },
    '/knowledge/{id}/documents': {
      post: {
        tags: ['Knowledge'],
        summary: 'Upload document',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        requestBody: {
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  file: { type: 'string', format: 'binary' }
                }
              }
            }
          }
        },
        responses: {
          '201': { description: 'Document uploaded' }
        }
      },
      get: {
        tags: ['Knowledge'],
        summary: 'List documents',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: {
          '200': { description: 'List of documents' }
        }
      }
    },
    '/knowledge/{id}/search': {
      post: {
        tags: ['Knowledge'],
        summary: 'Search knowledge base',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['query'],
                properties: {
                  query: { type: 'string' },
                  limit: { type: 'integer', default: 5 }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Search results' }
        }
      }
    },

    // Analytics endpoints
    '/analytics/overview': {
      get: {
        tags: ['Analytics'],
        summary: 'Get analytics overview',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'start_date', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'end_date', in: 'query', schema: { type: 'string', format: 'date' } }
        ],
        responses: {
          '200': { description: 'Analytics overview' }
        }
      }
    },
    '/analytics/conversations': {
      get: {
        tags: ['Analytics'],
        summary: 'Conversation analytics',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'bot_id', in: 'query', schema: { type: 'integer' } },
          { name: 'period', in: 'query', schema: { type: 'string', enum: ['day', 'week', 'month'] } }
        ],
        responses: {
          '200': { description: 'Conversation metrics' }
        }
      }
    },
    '/analytics/usage': {
      get: {
        tags: ['Analytics'],
        summary: 'API usage analytics',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Usage statistics' }
        }
      }
    },

    // Plugins endpoints
    '/plugins': {
      get: {
        tags: ['Plugins'],
        summary: 'List plugins',
        parameters: [
          { name: 'category', in: 'query', schema: { type: 'string' } },
          { name: 'search', in: 'query', schema: { type: 'string' } }
        ],
        responses: {
          '200': { description: 'List of plugins' }
        }
      }
    },
    '/plugins/{id}': {
      get: {
        tags: ['Plugins'],
        summary: 'Get plugin details',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: {
          '200': { description: 'Plugin details' }
        }
      }
    },
    '/plugins/{id}/install': {
      post: {
        tags: ['Plugins'],
        summary: 'Install plugin',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: {
          '201': { description: 'Plugin installed' }
        }
      }
    },
    '/plugins/user/installed': {
      get: {
        tags: ['Plugins'],
        summary: 'List installed plugins',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Installed plugins' }
        }
      }
    },

    // Webhooks endpoints
    '/webhooks': {
      get: {
        tags: ['Webhooks'],
        summary: 'List webhooks',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'List of webhooks' }
        }
      },
      post: {
        tags: ['Webhooks'],
        summary: 'Create webhook',
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['url', 'events'],
                properties: {
                  url: { type: 'string', format: 'uri' },
                  events: { type: 'array', items: { type: 'string' } },
                  secret: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '201': { description: 'Webhook created' }
        }
      }
    },
    '/webhooks/{id}': {
      delete: {
        tags: ['Webhooks'],
        summary: 'Delete webhook',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: {
          '200': { description: 'Webhook deleted' }
        }
      }
    },

    // Users endpoints
    '/users/profile': {
      get: {
        tags: ['Users'],
        summary: 'Get user profile',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'User profile' }
        }
      },
      put: {
        tags: ['Users'],
        summary: 'Update profile',
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  avatar_url: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Profile updated' }
        }
      }
    },
    '/users/api-keys': {
      get: {
        tags: ['Users'],
        summary: 'List API keys',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'List of API keys' }
        }
      },
      post: {
        tags: ['Users'],
        summary: 'Create API key',
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string' },
                  scopes: { type: 'array', items: { type: 'string' } }
                }
              }
            }
          }
        },
        responses: {
          '201': { description: 'API key created' }
        }
      }
    },

    // Organizations endpoints
    '/organizations': {
      get: {
        tags: ['Organizations'],
        summary: 'List organizations',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'List of organizations' }
        }
      },
      post: {
        tags: ['Organizations'],
        summary: 'Create organization',
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '201': { description: 'Organization created' }
        }
      }
    },
    '/organizations/{id}/members': {
      get: {
        tags: ['Organizations'],
        summary: 'List members',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: {
          '200': { description: 'List of members' }
        }
      },
      post: {
        tags: ['Organizations'],
        summary: 'Add member',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'role'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  role: { type: 'string', enum: ['admin', 'member', 'viewer'] }
                }
              }
            }
          }
        },
        responses: {
          '201': { description: 'Member added' }
        }
      }
    }
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      },
      apiKey: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key'
      }
    }
  }
};

/**
 * GET /api/docs/openapi.json
 * Returns OpenAPI specification
 */
router.get('/openapi.json', (req, res) => {
  res.json(openApiSpec);
});

module.exports = router;
