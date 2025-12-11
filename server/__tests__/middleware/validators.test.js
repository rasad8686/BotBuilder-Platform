/**
 * Validators Middleware Tests
 * Tests for server/middleware/validators.js
 */

const { validate, schemas } = require('../../middleware/validators');

describe('Validators Middleware', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    mockReq = { body: {} };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    mockNext = jest.fn();
  });

  describe('schemas', () => {
    it('should have register schema', () => {
      expect(schemas.register).toBeDefined();
    });

    it('should have login schema', () => {
      expect(schemas.login).toBeDefined();
    });

    it('should have createBot schema', () => {
      expect(schemas.createBot).toBeDefined();
    });

    it('should have createMessage schema', () => {
      expect(schemas.createMessage).toBeDefined();
    });
  });

  describe('validate()', () => {
    it('should call next() for unknown schema', () => {
      const middleware = validate('unknownSchema');
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    describe('register validation', () => {
      it('should pass valid registration data', () => {
        mockReq.body = {
          username: 'testuser',
          email: 'test@example.com',
          password: 'password123'
        };

        const middleware = validate('register');
        middleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
      });

      it('should fail with missing username', () => {
        mockReq.body = {
          email: 'test@example.com',
          password: 'password123'
        };

        const middleware = validate('register');
        middleware(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: false,
            message: 'Validation failed'
          })
        );
      });

      it('should fail with short username', () => {
        mockReq.body = {
          username: 'ab',
          email: 'test@example.com',
          password: 'password123'
        };

        const middleware = validate('register');
        middleware(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(400);
      });

      it('should fail with invalid email', () => {
        mockReq.body = {
          username: 'testuser',
          email: 'invalid-email',
          password: 'password123'
        };

        const middleware = validate('register');
        middleware(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(400);
      });

      it('should fail with short password', () => {
        mockReq.body = {
          username: 'testuser',
          email: 'test@example.com',
          password: '12345'
        };

        const middleware = validate('register');
        middleware(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(400);
      });
    });

    describe('login validation', () => {
      it('should pass valid login data', () => {
        mockReq.body = {
          email: 'test@example.com',
          password: 'password123'
        };

        const middleware = validate('login');
        middleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
      });

      it('should fail with missing email', () => {
        mockReq.body = {
          password: 'password123'
        };

        const middleware = validate('login');
        middleware(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(400);
      });

      it('should fail with missing password', () => {
        mockReq.body = {
          email: 'test@example.com'
        };

        const middleware = validate('login');
        middleware(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(400);
      });
    });

    describe('createBot validation', () => {
      it('should pass valid bot data', () => {
        mockReq.body = {
          name: 'Test Bot',
          platform: 'telegram'
        };

        const middleware = validate('createBot');
        middleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
      });

      it('should fail with invalid platform', () => {
        mockReq.body = {
          name: 'Test Bot',
          platform: 'invalid'
        };

        const middleware = validate('createBot');
        middleware(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(400);
      });

      it('should accept optional description', () => {
        mockReq.body = {
          name: 'Test Bot',
          platform: 'discord',
          description: 'A test bot'
        };

        const middleware = validate('createBot');
        middleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
      });
    });

    describe('createMessage validation', () => {
      it('should pass valid message data', () => {
        mockReq.body = {
          bot_id: 1,
          message_type: 'response',
          content: 'Hello!'
        };

        const middleware = validate('createMessage');
        middleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
      });

      it('should fail with invalid message_type', () => {
        mockReq.body = {
          bot_id: 1,
          message_type: 'invalid',
          content: 'Hello!'
        };

        const middleware = validate('createMessage');
        middleware(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(400);
      });

      it('should fail with empty content', () => {
        mockReq.body = {
          bot_id: 1,
          message_type: 'response',
          content: ''
        };

        const middleware = validate('createMessage');
        middleware(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(400);
      });
    });

    it('should return all validation errors', () => {
      mockReq.body = {
        username: 'ab',
        email: 'invalid',
        password: '123'
      };

      const middleware = validate('register');
      middleware(mockReq, mockRes, mockNext);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.errors.length).toBeGreaterThan(1);
      expect(response.errors[0]).toHaveProperty('field');
      expect(response.errors[0]).toHaveProperty('message');
    });
  });
});
