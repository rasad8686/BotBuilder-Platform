/**
 * Auth API Contract Tests using Pact
 *
 * These tests define the contract between the client and server
 * for authentication endpoints.
 *
 * Installation:
 *   npm install -D @pact-foundation/pact
 *
 * Usage:
 *   npm run test:contract
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

// Mock the auth service for contract testing
const mockAuthService = {
  login: async (email, password) => {
    const response = await fetch(`${provider.mockService.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return response.json();
  },

  register: async (userData) => {
    const response = await fetch(`${provider.mockService.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });
    return response.json();
  },

  getProfile: async (token) => {
    const response = await fetch(`${provider.mockService.baseUrl}/api/auth/profile`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },
};

const provider = pactAvailable ? new Pact({
  consumer: 'BotBuilder-Client',
  provider: 'BotBuilder-Auth-API',
  port: 1234,
  log: path.resolve(process.cwd(), 'logs', 'pact.log'),
  dir: path.resolve(process.cwd(), 'pacts'),
  logLevel: 'warn',
}) : null;

describeIfPact('Auth API Contract', () => {
  beforeAll(() => provider.setup());
  afterAll(() => provider.finalize());
  afterEach(() => provider.verify());

  describe('POST /api/auth/login', () => {
    it('should return token on successful login', async () => {
      // Define the expected interaction
      await provider.addInteraction({
        state: 'user exists with email test@example.com',
        uponReceiving: 'a valid login request',
        withRequest: {
          method: 'POST',
          path: '/api/auth/login',
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            email: 'test@example.com',
            password: 'Password123!',
          },
        },
        willRespondWith: {
          status: 200,
          headers: {
            'Content-Type': regex({ generate: 'application/json', matcher: 'application/json.*' }),
          },
          body: {
            success: true,
            token: like('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'),
            user: {
              id: like(1),
              email: 'test@example.com',
              username: like('testuser'),
            },
          },
        },
      });

      // Execute the test
      const result = await mockAuthService.login('test@example.com', 'Password123!');

      expect(result.success).toBe(true);
      expect(result.token).toBeDefined();
      expect(result.user.email).toBe('test@example.com');
    });

    it('should return 401 on invalid credentials', async () => {
      await provider.addInteraction({
        state: 'user exists with email test@example.com',
        uponReceiving: 'a login request with wrong password',
        withRequest: {
          method: 'POST',
          path: '/api/auth/login',
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            email: 'test@example.com',
            password: 'wrongpassword',
          },
        },
        willRespondWith: {
          status: 401,
          headers: {
            'Content-Type': regex({ generate: 'application/json', matcher: 'application/json.*' }),
          },
          body: {
            success: false,
            message: like('Invalid credentials'),
          },
        },
      });

      try {
        await mockAuthService.login('test@example.com', 'wrongpassword');
      } catch (error) {
        expect(error.status).toBe(401);
      }
    });
  });

  describe('POST /api/auth/register', () => {
    it('should create a new user', async () => {
      await provider.addInteraction({
        state: 'no user exists with email new@example.com',
        uponReceiving: 'a valid registration request',
        withRequest: {
          method: 'POST',
          path: '/api/auth/register',
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            username: 'newuser',
            email: 'new@example.com',
            password: 'NewPassword123!',
          },
        },
        willRespondWith: {
          status: 201,
          headers: {
            'Content-Type': regex({ generate: 'application/json', matcher: 'application/json.*' }),
          },
          body: {
            success: true,
            message: like('User registered successfully'),
            user: {
              id: like(1),
              email: 'new@example.com',
              username: 'newuser',
            },
          },
        },
      });

      const result = await mockAuthService.register({
        username: 'newuser',
        email: 'new@example.com',
        password: 'NewPassword123!',
      });

      expect(result.success).toBe(true);
      expect(result.user.email).toBe('new@example.com');
    });
  });

  describe('GET /api/auth/profile', () => {
    it('should return user profile with valid token', async () => {
      await provider.addInteraction({
        state: 'user is authenticated',
        uponReceiving: 'a request for user profile',
        withRequest: {
          method: 'GET',
          path: '/api/auth/profile',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': regex({ generate: 'Bearer valid-token', matcher: 'Bearer .*' }),
          },
        },
        willRespondWith: {
          status: 200,
          headers: {
            'Content-Type': regex({ generate: 'application/json', matcher: 'application/json.*' }),
          },
          body: {
            success: true,
            user: {
              id: like(1),
              email: like('test@example.com'),
              username: like('testuser'),
              created_at: like('2024-01-01T00:00:00.000Z'),
            },
          },
        },
      });

      const result = await mockAuthService.getProfile('valid-token');

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
    });
  });
});
