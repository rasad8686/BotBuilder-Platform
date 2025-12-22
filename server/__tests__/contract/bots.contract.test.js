/**
 * Bots API Contract Tests using Pact
 *
 * These tests define the contract between the client and server
 * for bot management endpoints.
 */

let Pact, like, eachLike, regex;
let pactAvailable = false;

try {
  const pact = require('@pact-foundation/pact');
  Pact = pact.Pact;
  like = pact.Matchers.like;
  eachLike = pact.Matchers.eachLike;
  regex = pact.Matchers.regex;
  pactAvailable = true;
} catch (e) {
  // Pact not installed - tests will be skipped
}

const path = require('path');

// Skip all tests if Pact is not installed
const describeIfPact = pactAvailable ? describe : describe.skip;

const provider = pactAvailable ? new Pact({
  consumer: 'BotBuilder-Client',
  provider: 'BotBuilder-Bots-API',
  port: 1235,
  log: path.resolve(process.cwd(), 'logs', 'pact-bots.log'),
  dir: path.resolve(process.cwd(), 'pacts'),
  logLevel: 'warn',
}) : null;

// Mock API client
const mockBotsApi = {
  getBots: async (token) => {
    const response = await fetch(`${provider.mockService.baseUrl}/api/bots`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },

  getBot: async (token, botId) => {
    const response = await fetch(`${provider.mockService.baseUrl}/api/bots/${botId}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },

  createBot: async (token, botData) => {
    const response = await fetch(`${provider.mockService.baseUrl}/api/bots`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(botData),
    });
    return response.json();
  },

  updateBot: async (token, botId, botData) => {
    const response = await fetch(`${provider.mockService.baseUrl}/api/bots/${botId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(botData),
    });
    return response.json();
  },

  deleteBot: async (token, botId) => {
    const response = await fetch(`${provider.mockService.baseUrl}/api/bots/${botId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },
};

describeIfPact('Bots API Contract', () => {
  beforeAll(() => provider.setup());
  afterAll(() => provider.finalize());
  afterEach(() => provider.verify());

  describe('GET /api/bots', () => {
    it('should return list of bots', async () => {
      await provider.addInteraction({
        state: 'user has bots',
        uponReceiving: 'a request for all bots',
        withRequest: {
          method: 'GET',
          path: '/api/bots',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': regex({ generate: 'Bearer valid-token', matcher: 'Bearer .*' }),
          },
        },
        willRespondWith: {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            success: true,
            bots: eachLike({
              id: like(1),
              name: like('My Bot'),
              platform: like('telegram'),
              status: like('active'),
              created_at: like('2024-01-01T00:00:00.000Z'),
            }),
          },
        },
      });

      const result = await mockBotsApi.getBots('valid-token');

      expect(result.success).toBe(true);
      expect(result.bots).toBeDefined();
      expect(Array.isArray(result.bots)).toBe(true);
    });

    it('should return empty array when no bots', async () => {
      await provider.addInteraction({
        state: 'user has no bots',
        uponReceiving: 'a request for all bots when none exist',
        withRequest: {
          method: 'GET',
          path: '/api/bots',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': regex({ generate: 'Bearer valid-token', matcher: 'Bearer .*' }),
          },
        },
        willRespondWith: {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            success: true,
            bots: [],
          },
        },
      });

      const result = await mockBotsApi.getBots('valid-token');

      expect(result.success).toBe(true);
      expect(result.bots).toEqual([]);
    });
  });

  describe('GET /api/bots/:id', () => {
    it('should return a single bot', async () => {
      await provider.addInteraction({
        state: 'bot with id 1 exists',
        uponReceiving: 'a request for bot with id 1',
        withRequest: {
          method: 'GET',
          path: '/api/bots/1',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': regex({ generate: 'Bearer valid-token', matcher: 'Bearer .*' }),
          },
        },
        willRespondWith: {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            success: true,
            bot: {
              id: 1,
              name: like('My Bot'),
              platform: like('telegram'),
              description: like('A test bot'),
              status: like('active'),
              settings: like({}),
              created_at: like('2024-01-01T00:00:00.000Z'),
              updated_at: like('2024-01-01T00:00:00.000Z'),
            },
          },
        },
      });

      const result = await mockBotsApi.getBot('valid-token', 1);

      expect(result.success).toBe(true);
      expect(result.bot).toBeDefined();
      expect(result.bot.id).toBe(1);
    });

    it('should return 404 for non-existent bot', async () => {
      await provider.addInteraction({
        state: 'no bot with id 999',
        uponReceiving: 'a request for non-existent bot',
        withRequest: {
          method: 'GET',
          path: '/api/bots/999',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': regex({ generate: 'Bearer valid-token', matcher: 'Bearer .*' }),
          },
        },
        willRespondWith: {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            success: false,
            message: like('Bot not found'),
          },
        },
      });

      // This would throw or return error
      try {
        await mockBotsApi.getBot('valid-token', 999);
      } catch (error) {
        // Expected
      }
    });
  });

  describe('POST /api/bots', () => {
    it('should create a new bot', async () => {
      await provider.addInteraction({
        state: 'user can create bots',
        uponReceiving: 'a request to create a new bot',
        withRequest: {
          method: 'POST',
          path: '/api/bots',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': regex({ generate: 'Bearer valid-token', matcher: 'Bearer .*' }),
          },
          body: {
            name: 'New Bot',
            platform: 'telegram',
            description: 'A new bot',
          },
        },
        willRespondWith: {
          status: 201,
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            success: true,
            bot: {
              id: like(1),
              name: 'New Bot',
              platform: 'telegram',
              description: 'A new bot',
              status: like('active'),
              created_at: like('2024-01-01T00:00:00.000Z'),
            },
          },
        },
      });

      const result = await mockBotsApi.createBot('valid-token', {
        name: 'New Bot',
        platform: 'telegram',
        description: 'A new bot',
      });

      expect(result.success).toBe(true);
      expect(result.bot.name).toBe('New Bot');
    });
  });

  describe('PUT /api/bots/:id', () => {
    it('should update an existing bot', async () => {
      await provider.addInteraction({
        state: 'bot with id 1 exists',
        uponReceiving: 'a request to update bot with id 1',
        withRequest: {
          method: 'PUT',
          path: '/api/bots/1',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': regex({ generate: 'Bearer valid-token', matcher: 'Bearer .*' }),
          },
          body: {
            name: 'Updated Bot Name',
          },
        },
        willRespondWith: {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            success: true,
            bot: {
              id: 1,
              name: 'Updated Bot Name',
              platform: like('telegram'),
              updated_at: like('2024-01-01T00:00:00.000Z'),
            },
          },
        },
      });

      const result = await mockBotsApi.updateBot('valid-token', 1, {
        name: 'Updated Bot Name',
      });

      expect(result.success).toBe(true);
      expect(result.bot.name).toBe('Updated Bot Name');
    });
  });

  describe('DELETE /api/bots/:id', () => {
    it('should delete a bot', async () => {
      await provider.addInteraction({
        state: 'bot with id 1 exists',
        uponReceiving: 'a request to delete bot with id 1',
        withRequest: {
          method: 'DELETE',
          path: '/api/bots/1',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': regex({ generate: 'Bearer valid-token', matcher: 'Bearer .*' }),
          },
        },
        willRespondWith: {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            success: true,
            message: like('Bot deleted successfully'),
          },
        },
      });

      const result = await mockBotsApi.deleteBot('valid-token', 1);

      expect(result.success).toBe(true);
    });
  });
});
