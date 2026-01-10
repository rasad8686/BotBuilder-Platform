/**
 * Comprehensive API Routes Tests
 * Testing routes with potentially low coverage
 */

const request = require('supertest');
const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

// ==================== MOCKS ====================

// Mock database
jest.mock('../../db', () => ({
  query: jest.fn()
}));

// Mock Stripe
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    webhooks: {
      constructEvent: jest.fn()
    },
    checkout: {
      sessions: {
        create: jest.fn()
      }
    },
    subscriptions: {
      retrieve: jest.fn(),
      update: jest.fn()
    },
    customers: {
      create: jest.fn()
    },
    billingPortal: {
      sessions: {
        create: jest.fn()
      }
    },
    invoices: {
      list: jest.fn()
    }
  }));
});

// Mock services
jest.mock('../../services/emailService', () => ({
  sendEmailVerificationEmail: jest.fn(),
  sendPasswordResetEmail: jest.fn()
}));

jest.mock('../../services/webhookService', () => ({
  trigger: jest.fn()
}));

jest.mock('../../services/OrchestrationManager', () => ({
  listOrchestrations: jest.fn(),
  createOrchestration: jest.fn(),
  getOrchestration: jest.fn(),
  updateOrchestration: jest.fn(),
  deleteOrchestration: jest.fn(),
  getTransitions: jest.fn(),
  addTransition: jest.fn(),
  removeTransition: jest.fn(),
  getVariables: jest.fn(),
  addVariable: jest.fn(),
  executeOrchestration: jest.fn()
}));

jest.mock('../../services/autonomous/integrations', () => ({
  SlackIntegration: {
    getOAuthConfig: jest.fn(),
    exchangeCode: jest.fn()
  },
  GoogleCalendarIntegration: {
    getOAuthConfig: jest.fn(),
    exchangeCode: jest.fn()
  },
  GmailIntegration: {
    getOAuthConfig: jest.fn(),
    exchangeCode: jest.fn()
  },
  CRMIntegration: {
    getOAuthConfig: jest.fn(),
    exchangeCode: jest.fn()
  },
  createIntegration: jest.fn(),
  getAvailableIntegrations: jest.fn()
}));

// Mock controllers
jest.mock('../../controllers/billingController', () => ({
  handleWebhook: jest.fn((req, res) => res.status(200).json({ received: true })),
  getSubscription: jest.fn(),
  createCheckoutSession: jest.fn(),
  createPortalSession: jest.fn(),
  getInvoices: jest.fn(),
  getUsage: jest.fn(),
  cancelSubscription: jest.fn(),
  getPlans: jest.fn(),
  PLANS: {
    free: { name: 'Free', price: 0 },
    pro: { name: 'Pro', price: 29 },
    enterprise: { name: 'Enterprise', price: 99 }
  }
}));

jest.mock('../../controllers/whitelabelController', () => ({
  getSettings: jest.fn(),
  updateSettings: jest.fn(),
  uploadLogo: jest.fn(),
  uploadFavicon: jest.fn(),
  getPublicSettings: jest.fn()
}));

// Mock middleware
jest.mock('../../middleware/auth', () => {
  return (req, res, next) => {
    req.user = { id: 1, email: 'test@example.com', organization_id: 1 };
    next();
  };
});

jest.mock('../../middleware/organizationContext', () => ({
  organizationContext: (req, res, next) => {
    req.organization = { id: 1, name: 'Test Org' };
    next();
  },
  requireOrganization: (req, res, next) => {
    if (!req.organization) {
      return res.status(403).json({ error: 'Organization required' });
    }
    next();
  }
}));

jest.mock('../../middleware/checkPermission', () => ({
  checkPermission: (permission) => (req, res, next) => {
    next();
  }
}));

jest.mock('../../middleware/upload', () => ({
  uploadLogo: jest.fn((req, res, cb) => cb()),
  uploadFavicon: jest.fn((req, res, cb) => cb())
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

jest.mock('../../utils/passwordValidator', () => ({
  validatePassword: jest.fn((password) => {
    if (password.length < 8) {
      return { valid: false, message: 'Password must be at least 8 characters' };
    }
    return { valid: true };
  })
}));

const db = require('../../db');
const emailService = require('../../services/emailService');
const OrchestrationManager = require('../../services/OrchestrationManager');
const {
  SlackIntegration,
  GoogleCalendarIntegration,
  GmailIntegration,
  CRMIntegration,
  createIntegration,
  getAvailableIntegrations
} = require('../../services/autonomous/integrations');

// ==================== SETUP ====================

describe('Comprehensive API Routes Tests', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(express.raw({ type: 'application/json' }));

    jest.clearAllMocks();

    // Set up environment variables
    process.env.STRIPE_SECRET_KEY = 'sk_test_12345';
    process.env.STRIPE_PRO_PRICE_ID = 'price_pro123';
    process.env.STRIPE_ENTERPRISE_PRICE_ID = 'price_ent123';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test123';
    process.env.FRONTEND_URL = 'http://localhost:5174';
  });

  // ==================== BILLING ROUTES ====================

  describe('Billing Routes', () => {
    beforeEach(() => {
      const billingRouter = require('../../routes/billing');
      app.use('/api/billing', billingRouter);
    });

    describe('POST /api/billing/webhook', () => {
      it('should handle webhook successfully', async () => {
        const response = await request(app)
          .post('/api/billing/webhook')
          .set('stripe-signature', 'test-signature')
          .send(Buffer.from('test'));

        expect(response.status).toBe(200);
      });
    });

    describe('POST /api/billing/checkout', () => {
      it('should create checkout session successfully', async () => {
        db.query.mockResolvedValueOnce({
          rows: [{ id: 1, email: 'test@example.com', name: 'Test User' }]
        });

        const stripe = require('stripe');
        const mockStripe = stripe();
        mockStripe.checkout.sessions.create.mockResolvedValue({
          id: 'cs_test123',
          url: 'https://checkout.stripe.com/test',
          mode: 'subscription',
          status: 'open'
        });

        const response = await request(app)
          .post('/api/billing/checkout')
          .send({
            planType: 'pro',
            successUrl: 'http://localhost/success',
            cancelUrl: 'http://localhost/cancel'
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.checkoutUrl).toBeDefined();
      });

      it('should return 400 for missing fields', async () => {
        const response = await request(app)
          .post('/api/billing/checkout')
          .send({
            planType: 'pro'
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      });

      it('should return 400 for invalid plan type', async () => {
        const response = await request(app)
          .post('/api/billing/checkout')
          .send({
            planType: 'invalid',
            successUrl: 'http://localhost/success',
            cancelUrl: 'http://localhost/cancel'
          });

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('Invalid plan type');
      });

      it('should return 404 if user not found', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        const response = await request(app)
          .post('/api/billing/checkout')
          .send({
            planType: 'pro',
            successUrl: 'http://localhost/success',
            cancelUrl: 'http://localhost/cancel'
          });

        expect(response.status).toBe(404);
        expect(response.body.message).toContain('User not found');
      });

      it('should handle Stripe errors gracefully', async () => {
        db.query.mockResolvedValueOnce({
          rows: [{ id: 1, email: 'test@example.com', name: 'Test User' }]
        });

        const stripe = require('stripe');
        const mockStripe = stripe();
        mockStripe.checkout.sessions.create.mockRejectedValue({
          type: 'StripeInvalidRequestError',
          message: 'Invalid price'
        });

        const response = await request(app)
          .post('/api/billing/checkout')
          .send({
            planType: 'pro',
            successUrl: 'http://localhost/success',
            cancelUrl: 'http://localhost/cancel'
          });

        expect(response.status).toBe(500);
      });
    });

    describe('GET /api/billing/subscription', () => {
      it('should get subscription for user with organization', async () => {
        db.query.mockResolvedValueOnce({
          rows: [{
            id: 1,
            plan_tier: 'pro',
            stripe_subscription_id: 'sub_123',
            subscription_status: 'active',
            stripe_customer_id: 'cus_123',
            subscription_current_period_end: new Date()
          }]
        });

        const stripe = require('stripe');
        const mockStripe = stripe();
        mockStripe.subscriptions.retrieve.mockResolvedValue({
          status: 'active',
          cancel_at_period_end: false,
          current_period_end: Math.floor(Date.now() / 1000)
        });

        const response = await request(app).get('/api/billing/subscription');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.subscription.plan).toBe('pro');
      });

      it('should return free plan for user without organization', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        const response = await request(app).get('/api/billing/subscription');

        expect(response.status).toBe(200);
        expect(response.body.subscription.plan).toBe('free');
      });

      it('should handle Stripe errors when fetching subscription', async () => {
        db.query.mockResolvedValueOnce({
          rows: [{
            id: 1,
            plan_tier: 'pro',
            stripe_subscription_id: 'sub_123',
            subscription_status: 'active'
          }]
        });

        const stripe = require('stripe');
        const mockStripe = stripe();
        mockStripe.subscriptions.retrieve.mockRejectedValue(new Error('Stripe error'));

        const response = await request(app).get('/api/billing/subscription');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });

    describe('POST /api/billing/cancel', () => {
      it('should cancel subscription successfully', async () => {
        db.query.mockResolvedValueOnce({
          rows: [{ id: 1, stripe_subscription_id: 'sub_123' }]
        });

        const stripe = require('stripe');
        const mockStripe = stripe();
        mockStripe.subscriptions.update.mockResolvedValue({
          cancel_at_period_end: true,
          current_period_end: Math.floor(Date.now() / 1000) + 86400
        });

        const response = await request(app).post('/api/billing/cancel');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.cancelAtPeriodEnd).toBe(true);
      });

      it('should return 400 if no active subscription', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        const response = await request(app).post('/api/billing/cancel');

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('No active subscription');
      });

      it('should handle Stripe errors', async () => {
        db.query.mockResolvedValueOnce({
          rows: [{ id: 1, stripe_subscription_id: 'sub_123' }]
        });

        const stripe = require('stripe');
        const mockStripe = stripe();
        mockStripe.subscriptions.update.mockRejectedValue(new Error('Stripe error'));

        const response = await request(app).post('/api/billing/cancel');

        expect(response.status).toBe(500);
      });
    });

    describe('GET /api/billing/usage', () => {
      it('should return usage for organization', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1, plan_tier: 'pro' }] })
          .mockResolvedValueOnce({ rows: [{ message_count: 1500 }] });

        const response = await request(app).get('/api/billing/usage');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.current).toBeDefined();
      });

      it('should return free plan defaults if no organization', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        const response = await request(app).get('/api/billing/usage');

        expect(response.status).toBe(200);
        expect(response.body.plan).toBe('free');
        expect(response.body.limit).toBe(1000);
      });

      it('should handle database errors', async () => {
        db.query.mockRejectedValueOnce(new Error('Database error'));

        const response = await request(app).get('/api/billing/usage');

        expect(response.status).toBe(500);
      });
    });

    describe('GET /api/billing/plans', () => {
      it('should return all available plans', async () => {
        const response = await request(app).get('/api/billing/plans');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.plans).toBeDefined();
      });

      it('should include plan features', async () => {
        const response = await request(app).get('/api/billing/plans');

        expect(response.body.plans.free).toBeDefined();
        expect(response.body.plans.pro).toBeDefined();
        expect(response.body.plans.enterprise).toBeDefined();
      });
    });
  });

  // ==================== API TOKENS ROUTES ====================

  describe('API Tokens Routes', () => {
    beforeEach(() => {
      const apiTokensRouter = require('../../routes/api-tokens');
      app.use('/api/api-tokens', apiTokensRouter);
    });

    describe('GET /api/api-tokens', () => {
      it('should get all API tokens for organization', async () => {
        db.query.mockResolvedValueOnce({
          rows: [
            {
              id: 1,
              token_name: 'Test Token',
              token_preview: 'abc123...xyz',
              is_active: true,
              created_at: new Date()
            }
          ]
        });

        const response = await request(app).get('/api/api-tokens');

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBe(1);
      });

      it('should handle database errors', async () => {
        db.query.mockRejectedValueOnce(new Error('Database error'));

        const response = await request(app).get('/api/api-tokens');

        expect(response.status).toBe(500);
      });
    });

    describe('POST /api/api-tokens', () => {
      it('should create new API token', async () => {
        db.query.mockResolvedValueOnce({
          rows: [{
            id: 1,
            token_name: 'New Token',
            token_preview: 'abc123...xyz',
            is_active: true,
            created_at: new Date()
          }]
        });

        const response = await request(app)
          .post('/api/api-tokens')
          .send({
            tokenName: 'New Token',
            expiresInDays: 30
          });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.token).toBeDefined();
      });

      it('should return 400 if token name is missing', async () => {
        const response = await request(app)
          .post('/api/api-tokens')
          .send({});

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('Token name is required');
      });

      it('should verify bot belongs to organization', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        const response = await request(app)
          .post('/api/api-tokens')
          .send({
            tokenName: 'Bot Token',
            botId: 999
          });

        expect(response.status).toBe(404);
        expect(response.body.message).toContain('Bot not found');
      });

      it('should create token with bot association', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Bot check
          .mockResolvedValueOnce({ // Token creation
            rows: [{
              id: 1,
              token_name: 'Bot Token',
              bot_id: 1,
              token_preview: 'abc123...xyz',
              is_active: true,
              created_at: new Date()
            }]
          });

        const response = await request(app)
          .post('/api/api-tokens')
          .send({
            tokenName: 'Bot Token',
            botId: 1
          });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
      });
    });

    describe('DELETE /api/api-tokens/:id', () => {
      it('should delete API token', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1 }] });

        const response = await request(app).delete('/api/api-tokens/1');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      it('should return 404 if token not found', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        const response = await request(app).delete('/api/api-tokens/999');

        expect(response.status).toBe(404);
      });
    });

    describe('PATCH /api/api-tokens/:id/toggle', () => {
      it('should toggle token status', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1, is_active: true }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, is_active: false }] });

        const response = await request(app).patch('/api/api-tokens/1/toggle');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      it('should return 404 if token not found', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        const response = await request(app).patch('/api/api-tokens/999/toggle');

        expect(response.status).toBe(404);
      });
    });

    describe('PUT /api/api-tokens/:id/deactivate', () => {
      it('should deactivate token', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, is_active: false }] });

        const response = await request(app).put('/api/api-tokens/1/deactivate');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.is_active).toBe(false);
      });
    });
  });

  // ==================== EMAIL VERIFICATION ROUTES ====================

  describe('Email Verification Routes', () => {
    beforeEach(() => {
      // Remove auth middleware for email verification routes
      jest.doMock('../../middleware/auth', () => (req, res, next) => next());

      const emailVerificationRouter = require('../../routes/emailVerification');
      app.use('/api/auth', emailVerificationRouter);
    });

    describe('POST /api/auth/send-verification', () => {
      it('should send verification email', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });
        emailService.sendEmailVerificationEmail.mockResolvedValue();

        const response = await request(app)
          .post('/api/auth/send-verification')
          .send({
            userId: 1,
            email: 'test@example.com',
            userName: 'Test User'
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      it('should return 400 if userId or email missing', async () => {
        const response = await request(app)
          .post('/api/auth/send-verification')
          .send({});

        expect(response.status).toBe(400);
        expect(response.body.error).toBeDefined();
      });

      it('should handle email service errors gracefully', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });
        emailService.sendEmailVerificationEmail.mockRejectedValue(
          new Error('Email service error')
        );

        const response = await request(app)
          .post('/api/auth/send-verification')
          .send({
            userId: 1,
            email: 'test@example.com',
            userName: 'Test User'
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });

    describe('GET /api/auth/verify-email', () => {
      it('should verify email with valid token', async () => {
        db.query
          .mockResolvedValueOnce({
            rows: [{
              id: 1,
              email: 'test@example.com',
              email_verified: false,
              verification_token_expires_at: new Date(Date.now() + 86400000)
            }]
          })
          .mockResolvedValueOnce({ rows: [] });

        const response = await request(app)
          .get('/api/auth/verify-email')
          .query({ token: 'valid-token' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      it('should return error for missing token', async () => {
        const response = await request(app).get('/api/auth/verify-email');

        expect(response.status).toBe(400);
        expect(response.body.error).toBeDefined();
      });

      it('should return error for invalid token', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        const response = await request(app)
          .get('/api/auth/verify-email')
          .query({ token: 'invalid-token' });

        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('Invalid or expired');
      });

      it('should handle already verified email', async () => {
        db.query.mockResolvedValueOnce({
          rows: [{
            id: 1,
            email: 'test@example.com',
            email_verified: true
          }]
        });

        const response = await request(app)
          .get('/api/auth/verify-email')
          .query({ token: 'valid-token' });

        expect(response.body.success).toBe(true);
        expect(response.body.alreadyVerified).toBe(true);
      });

      it('should handle expired token', async () => {
        db.query.mockResolvedValueOnce({
          rows: [{
            id: 1,
            email: 'test@example.com',
            email_verified: false,
            verification_token_expires_at: new Date(Date.now() - 86400000)
          }]
        });

        const response = await request(app)
          .get('/api/auth/verify-email')
          .query({ token: 'expired-token' });

        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('expired');
      });
    });

    describe('POST /api/auth/resend-verification', () => {
      it('should resend verification email', async () => {
        db.query
          .mockResolvedValueOnce({
            rows: [{
              id: 1,
              email: 'test@example.com',
              name: 'Test User',
              email_verified: false
            }]
          })
          .mockResolvedValueOnce({ rows: [] });

        emailService.sendEmailVerificationEmail.mockResolvedValue();

        const response = await request(app)
          .post('/api/auth/resend-verification')
          .send({ email: 'test@example.com' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      it('should return 400 if email missing', async () => {
        const response = await request(app)
          .post('/api/auth/resend-verification')
          .send({});

        expect(response.status).toBe(400);
      });

      it('should prevent email enumeration for non-existent user', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        const response = await request(app)
          .post('/api/auth/resend-verification')
          .send({ email: 'nonexistent@example.com' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      it('should handle already verified email', async () => {
        db.query.mockResolvedValueOnce({
          rows: [{
            id: 1,
            email: 'test@example.com',
            email_verified: true
          }]
        });

        const response = await request(app)
          .post('/api/auth/resend-verification')
          .send({ email: 'test@example.com' });

        expect(response.body.alreadyVerified).toBe(true);
      });

      it('should handle database errors gracefully', async () => {
        db.query.mockRejectedValueOnce({ code: 'ECONNREFUSED' });

        const response = await request(app)
          .post('/api/auth/resend-verification')
          .send({ email: 'test@example.com' });

        expect(response.status).toBe(503);
      });
    });
  });

  // ==================== PASSWORD RESET ROUTES ====================

  describe('Password Reset Routes', () => {
    beforeEach(() => {
      jest.doMock('../../middleware/auth', () => (req, res, next) => next());

      const passwordResetRouter = require('../../routes/passwordReset');
      app.use('/api/auth', passwordResetRouter);
    });

    describe('POST /api/auth/forgot-password', () => {
      it('should send password reset email', async () => {
        db.query
          .mockResolvedValueOnce({ // Find user
            rows: [{
              id: 1,
              email: 'test@example.com',
              name: 'Test User'
            }]
          })
          .mockResolvedValueOnce({ rows: [] }) // Invalidate old tokens
          .mockResolvedValueOnce({ rows: [] }); // Create new token

        emailService.sendPasswordResetEmail.mockResolvedValue();

        const response = await request(app)
          .post('/api/auth/forgot-password')
          .send({ email: 'test@example.com' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      it('should return 400 if email missing', async () => {
        const response = await request(app)
          .post('/api/auth/forgot-password')
          .send({});

        expect(response.status).toBe(400);
      });

      it('should prevent email enumeration', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        const response = await request(app)
          .post('/api/auth/forgot-password')
          .send({ email: 'nonexistent@example.com' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      it('should return token in development mode', async () => {
        process.env.NODE_ENV = 'development';

        db.query
          .mockResolvedValueOnce({
            rows: [{
              id: 1,
              email: 'test@example.com',
              name: 'Test User'
            }]
          })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [] });

        const response = await request(app)
          .post('/api/auth/forgot-password')
          .send({ email: 'test@example.com' });

        expect(response.body.devMode).toBe(true);
        expect(response.body.token).toBeDefined();

        delete process.env.NODE_ENV;
      });
    });

    describe('GET /api/auth/verify-reset-token', () => {
      it('should verify valid token', async () => {
        db.query.mockResolvedValueOnce({
          rows: [{
            id: 1,
            user_id: 1,
            email: 'test@example.com',
            expires_at: new Date(Date.now() + 3600000),
            used_at: null
          }]
        });

        const response = await request(app)
          .get('/api/auth/verify-reset-token')
          .query({ token: 'valid-token' });

        expect(response.status).toBe(200);
        expect(response.body.valid).toBe(true);
      });

      it('should return 400 if token missing', async () => {
        const response = await request(app)
          .get('/api/auth/verify-reset-token');

        expect(response.status).toBe(400);
      });

      it('should reject invalid token', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        const response = await request(app)
          .get('/api/auth/verify-reset-token')
          .query({ token: 'invalid-token' });

        expect(response.body.valid).toBe(false);
      });

      it('should reject used token', async () => {
        db.query.mockResolvedValueOnce({
          rows: [{
            id: 1,
            used_at: new Date()
          }]
        });

        const response = await request(app)
          .get('/api/auth/verify-reset-token')
          .query({ token: 'used-token' });

        expect(response.body.valid).toBe(false);
        expect(response.body.error).toContain('already been used');
      });

      it('should reject expired token', async () => {
        db.query.mockResolvedValueOnce({
          rows: [{
            id: 1,
            expires_at: new Date(Date.now() - 3600000),
            used_at: null
          }]
        });

        const response = await request(app)
          .get('/api/auth/verify-reset-token')
          .query({ token: 'expired-token' });

        expect(response.body.valid).toBe(false);
        expect(response.body.error).toContain('expired');
      });
    });

    describe('POST /api/auth/reset-password', () => {
      it('should reset password with valid token', async () => {
        db.query
          .mockResolvedValueOnce({ // Find token
            rows: [{
              id: 1,
              user_id: 1,
              email: 'test@example.com',
              name: 'Test User',
              expires_at: new Date(Date.now() + 3600000),
              used_at: null
            }]
          })
          .mockResolvedValueOnce({ rows: [] }) // Update password
          .mockResolvedValueOnce({ rows: [] }); // Mark token used

        const response = await request(app)
          .post('/api/auth/reset-password')
          .send({
            token: 'valid-token',
            password: 'NewPassword123!'
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      it('should return 400 if token or password missing', async () => {
        const response = await request(app)
          .post('/api/auth/reset-password')
          .send({ token: 'test' });

        expect(response.status).toBe(400);
      });

      it('should validate password strength', async () => {
        const response = await request(app)
          .post('/api/auth/reset-password')
          .send({
            token: 'valid-token',
            password: 'weak'
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('at least 8 characters');
      });

      it('should reject invalid token', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        const response = await request(app)
          .post('/api/auth/reset-password')
          .send({
            token: 'invalid-token',
            password: 'ValidPassword123!'
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Invalid or expired');
      });

      it('should reject used token', async () => {
        db.query.mockResolvedValueOnce({
          rows: [{
            id: 1,
            used_at: new Date()
          }]
        });

        const response = await request(app)
          .post('/api/auth/reset-password')
          .send({
            token: 'used-token',
            password: 'ValidPassword123!'
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('already been used');
      });

      it('should reject expired token', async () => {
        db.query.mockResolvedValueOnce({
          rows: [{
            id: 1,
            expires_at: new Date(Date.now() - 3600000),
            used_at: null
          }]
        });

        const response = await request(app)
          .post('/api/auth/reset-password')
          .send({
            token: 'expired-token',
            password: 'ValidPassword123!'
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('expired');
      });
    });
  });

  // ==================== ORCHESTRATION ROUTES ====================

  describe('Orchestration Routes', () => {
    beforeEach(() => {
      const orchestrationsRouter = require('../../routes/orchestrations');
      app.use('/api/orchestrations', orchestrationsRouter);
    });

    describe('GET /api/orchestrations', () => {
      it('should list orchestrations', async () => {
        OrchestrationManager.listOrchestrations.mockResolvedValue([
          { id: 1, name: 'Test Orchestration', bot_id: 1 }
        ]);

        const response = await request(app)
          .get('/api/orchestrations')
          .query({ bot_id: 1 });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(1);
      });

      it('should return 400 if bot_id missing', async () => {
        const response = await request(app).get('/api/orchestrations');

        expect(response.status).toBe(400);
      });

      it('should handle errors', async () => {
        OrchestrationManager.listOrchestrations.mockRejectedValue(
          new Error('Database error')
        );

        const response = await request(app)
          .get('/api/orchestrations')
          .query({ bot_id: 1 });

        expect(response.status).toBe(500);
      });
    });

    describe('POST /api/orchestrations', () => {
      it('should create orchestration', async () => {
        OrchestrationManager.createOrchestration.mockResolvedValue({
          id: 1,
          name: 'New Orchestration',
          bot_id: 1
        });

        const response = await request(app)
          .post('/api/orchestrations')
          .send({
            bot_id: 1,
            name: 'New Orchestration',
            entry_flow_id: 1
          });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
      });

      it('should return 400 if required fields missing', async () => {
        const response = await request(app)
          .post('/api/orchestrations')
          .send({});

        expect(response.status).toBe(400);
      });
    });

    describe('GET /api/orchestrations/:id', () => {
      it('should get orchestration by id', async () => {
        OrchestrationManager.getOrchestration.mockResolvedValue({
          id: 1,
          name: 'Test Orchestration'
        });

        const response = await request(app).get('/api/orchestrations/1');

        expect(response.status).toBe(200);
        expect(response.body.data.id).toBe(1);
      });

      it('should return 404 if not found', async () => {
        OrchestrationManager.getOrchestration.mockResolvedValue(null);

        const response = await request(app).get('/api/orchestrations/999');

        expect(response.status).toBe(404);
      });
    });

    describe('PUT /api/orchestrations/:id', () => {
      it('should update orchestration', async () => {
        OrchestrationManager.updateOrchestration.mockResolvedValue({
          id: 1,
          name: 'Updated Orchestration'
        });

        const response = await request(app)
          .put('/api/orchestrations/1')
          .send({ name: 'Updated Orchestration' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      it('should return 404 if not found', async () => {
        OrchestrationManager.updateOrchestration.mockResolvedValue(null);

        const response = await request(app)
          .put('/api/orchestrations/999')
          .send({ name: 'Updated' });

        expect(response.status).toBe(404);
      });
    });

    describe('DELETE /api/orchestrations/:id', () => {
      it('should delete orchestration', async () => {
        OrchestrationManager.deleteOrchestration.mockResolvedValue(true);

        const response = await request(app).delete('/api/orchestrations/1');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      it('should return 404 if not found', async () => {
        OrchestrationManager.deleteOrchestration.mockResolvedValue(false);

        const response = await request(app).delete('/api/orchestrations/999');

        expect(response.status).toBe(404);
      });
    });

    describe('Transition Routes', () => {
      it('should get transitions', async () => {
        OrchestrationManager.getTransitions.mockResolvedValue([
          { id: 1, from_flow_id: 1, to_flow_id: 2 }
        ]);

        const response = await request(app).get('/api/orchestrations/1/transitions');

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(1);
      });

      it('should add transition', async () => {
        OrchestrationManager.addTransition.mockResolvedValue({
          id: 1,
          from_flow_id: 1,
          to_flow_id: 2
        });

        const response = await request(app)
          .post('/api/orchestrations/1/transitions')
          .send({
            from_flow_id: 1,
            to_flow_id: 2,
            trigger_type: 'intent'
          });

        expect(response.status).toBe(201);
      });

      it('should return 400 if required fields missing', async () => {
        const response = await request(app)
          .post('/api/orchestrations/1/transitions')
          .send({});

        expect(response.status).toBe(400);
      });

      it('should remove transition', async () => {
        OrchestrationManager.removeTransition.mockResolvedValue(true);

        const response = await request(app)
          .delete('/api/orchestrations/1/transitions/1');

        expect(response.status).toBe(200);
      });
    });

    describe('Variable Routes', () => {
      it('should get variables', async () => {
        OrchestrationManager.getVariables.mockResolvedValue([
          { id: 1, name: 'user_name', type: 'string' }
        ]);

        const response = await request(app).get('/api/orchestrations/1/variables');

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(1);
      });

      it('should add variable', async () => {
        OrchestrationManager.addVariable.mockResolvedValue({
          id: 1,
          name: 'user_name',
          type: 'string'
        });

        const response = await request(app)
          .post('/api/orchestrations/1/variables')
          .send({
            name: 'user_name',
            type: 'string'
          });

        expect(response.status).toBe(201);
      });

      it('should return 400 if name missing', async () => {
        const response = await request(app)
          .post('/api/orchestrations/1/variables')
          .send({});

        expect(response.status).toBe(400);
      });
    });

    describe('Execution Routes', () => {
      it('should execute orchestration', async () => {
        OrchestrationManager.executeOrchestration.mockResolvedValue({
          success: true,
          output: 'Result'
        });

        const response = await request(app)
          .post('/api/orchestrations/1/execute')
          .send({
            session_id: 'session-123',
            input: { message: 'Hello' }
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      it('should return 400 if session_id missing', async () => {
        const response = await request(app)
          .post('/api/orchestrations/1/execute')
          .send({});

        expect(response.status).toBe(400);
      });
    });
  });

  // ==================== INTEGRATION ROUTES ====================

  describe('Integration Routes', () => {
    beforeEach(() => {
      const integrationsRouter = require('../../routes/integrations');
      app.use('/api/integrations', integrationsRouter);
    });

    describe('GET /api/integrations/available', () => {
      it('should get available integrations', async () => {
        getAvailableIntegrations.mockReturnValue([
          { type: 'slack', name: 'Slack' },
          { type: 'google_calendar', name: 'Google Calendar' }
        ]);

        const response = await request(app).get('/api/integrations/available');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.integrations).toHaveLength(2);
      });
    });

    describe('GET /api/integrations', () => {
      it('should get user integrations', async () => {
        db.query.mockResolvedValueOnce({
          rows: [
            {
              id: 1,
              type: 'slack',
              name: 'My Slack',
              status: 'connected',
              config: '{}',
              metadata: '{}'
            }
          ]
        });

        const response = await request(app).get('/api/integrations');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      it('should parse JSON config and metadata', async () => {
        db.query.mockResolvedValueOnce({
          rows: [
            {
              id: 1,
              type: 'slack',
              config: JSON.stringify({ team: 'test' }),
              metadata: JSON.stringify({ workspace: 'test-ws' })
            }
          ]
        });

        const response = await request(app).get('/api/integrations');

        expect(response.body.integrations[0].config).toEqual({ team: 'test' });
      });
    });

    describe('GET /api/integrations/:id', () => {
      it('should get single integration', async () => {
        db.query.mockResolvedValueOnce({
          rows: [{
            id: 1,
            type: 'slack',
            name: 'My Slack',
            config: '{}',
            metadata: '{}'
          }]
        });

        const response = await request(app).get('/api/integrations/1');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      it('should return 404 if not found', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        const response = await request(app).get('/api/integrations/999');

        expect(response.status).toBe(404);
      });
    });

    describe('DELETE /api/integrations/:id', () => {
      it('should delete integration', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

        const response = await request(app).delete('/api/integrations/1');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      it('should return 404 if not found', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        const response = await request(app).delete('/api/integrations/999');

        expect(response.status).toBe(404);
      });
    });

    describe('OAuth Flow', () => {
      it('should get Slack auth URL', async () => {
        SlackIntegration.getOAuthConfig.mockReturnValue({
          clientId: 'test-client-id',
          redirectUri: 'http://localhost/callback',
          scopes: ['chat:write'],
          authorizationUrl: 'https://slack.com/oauth/authorize'
        });

        const response = await request(app).get('/api/integrations/slack/auth');

        expect(response.status).toBe(200);
        expect(response.body.authUrl).toContain('slack.com');
      });

      it('should get Google Calendar auth URL', async () => {
        GoogleCalendarIntegration.getOAuthConfig.mockReturnValue({
          clientId: 'test-client-id',
          redirectUri: 'http://localhost/callback',
          scopes: ['calendar.readonly'],
          authorizationUrl: 'https://accounts.google.com/o/oauth2/auth',
          accessType: 'offline',
          prompt: 'consent'
        });

        const response = await request(app).get('/api/integrations/google_calendar/auth');

        expect(response.status).toBe(200);
        expect(response.body.authUrl).toContain('google.com');
      });

      it('should handle OAuth callback', async () => {
        SlackIntegration.exchangeCode.mockResolvedValue({
          access_token: 'token',
          refresh_token: 'refresh',
          team_name: 'Test Team',
          scope: 'chat:write'
        });

        db.query.mockResolvedValueOnce({ rows: [] });

        const response = await request(app)
          .get('/api/integrations/slack/callback')
          .query({
            code: 'auth-code',
            state: JSON.stringify({ userId: 1, type: 'slack' })
          });

        expect(response.status).toBe(302);
        expect(response.header.location).toContain('success=slack');
      });

      it('should handle OAuth errors', async () => {
        const response = await request(app)
          .get('/api/integrations/slack/callback')
          .query({ error: 'access_denied' });

        expect(response.status).toBe(302);
        expect(response.header.location).toContain('error=access_denied');
      });

      it('should validate callback params', async () => {
        const response = await request(app)
          .get('/api/integrations/slack/callback')
          .query({});

        expect(response.status).toBe(302);
        expect(response.header.location).toContain('error=missing_params');
      });
    });

    describe('POST /api/integrations/:id/test', () => {
      it('should test integration connection', async () => {
        db.query.mockResolvedValueOnce({
          rows: [{
            id: 1,
            type: 'slack',
            credentials: '{"access_token":"token"}'
          }]
        }).mockResolvedValueOnce({ rows: [] });

        const mockInstance = {
          testConnection: jest.fn().mockResolvedValue({ success: true })
        };
        createIntegration.mockReturnValue(mockInstance);

        const response = await request(app).post('/api/integrations/1/test');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      it('should return 404 if integration not found', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        const response = await request(app).post('/api/integrations/999/test');

        expect(response.status).toBe(404);
      });
    });

    describe('POST /api/integrations/:id/execute', () => {
      it('should execute Slack send_message action', async () => {
        db.query.mockResolvedValueOnce({
          rows: [{
            id: 1,
            type: 'slack',
            status: 'connected',
            credentials: '{}'
          }]
        }).mockResolvedValueOnce({ rows: [] });

        const mockInstance = {
          sendMessage: jest.fn().mockResolvedValue({ success: true })
        };
        createIntegration.mockReturnValue(mockInstance);

        const response = await request(app)
          .post('/api/integrations/1/execute')
          .send({
            action: 'send_message',
            params: { channel: 'general', text: 'Hello' }
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      it('should return 400 if action missing', async () => {
        const response = await request(app)
          .post('/api/integrations/1/execute')
          .send({});

        expect(response.status).toBe(400);
      });

      it('should return 404 if integration not found', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        const response = await request(app)
          .post('/api/integrations/999/execute')
          .send({ action: 'test' });

        expect(response.status).toBe(404);
      });

      it('should return 400 if integration not connected', async () => {
        db.query.mockResolvedValueOnce({
          rows: [{
            id: 1,
            type: 'slack',
            status: 'error',
            credentials: '{}'
          }]
        });

        const response = await request(app)
          .post('/api/integrations/1/execute')
          .send({ action: 'test' });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('not connected');
      });

      it('should handle unknown action', async () => {
        db.query.mockResolvedValueOnce({
          rows: [{
            id: 1,
            type: 'slack',
            status: 'connected',
            credentials: '{}'
          }]
        });

        const response = await request(app)
          .post('/api/integrations/1/execute')
          .send({ action: 'unknown_action' });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Unknown action');
      });
    });

    describe('GET /api/integrations/:id/logs', () => {
      it('should get integration logs', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({
            rows: [{
              id: 1,
              action: 'send_message',
              request_data: '{}',
              response_data: '{}',
              result: 'success'
            }]
          });

        const response = await request(app).get('/api/integrations/1/logs');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      it('should support pagination', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [] });

        const response = await request(app)
          .get('/api/integrations/1/logs')
          .query({ limit: 10, offset: 20 });

        expect(response.status).toBe(200);
      });

      it('should return 404 if integration not found', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        const response = await request(app).get('/api/integrations/999/logs');

        expect(response.status).toBe(404);
      });
    });
  });

  // ==================== WHITELABEL ROUTES ====================

  describe('Whitelabel Routes', () => {
    beforeEach(() => {
      const whitelabelRouter = require('../../routes/whitelabel');
      app.use('/api/whitelabel', whitelabelRouter);
    });

    describe('GET /api/whitelabel/public/:domain', () => {
      it('should get public settings', async () => {
        const { getPublicSettings } = require('../../controllers/whitelabelController');
        getPublicSettings.mockImplementation((req, res) => {
          res.json({ success: true, settings: {} });
        });

        const response = await request(app).get('/api/whitelabel/public/example.com');

        expect(response.status).toBe(200);
      });
    });

    describe('GET /api/whitelabel/settings', () => {
      it('should get whitelabel settings', async () => {
        const { getSettings } = require('../../controllers/whitelabelController');
        getSettings.mockImplementation((req, res) => {
          res.json({ success: true, settings: {} });
        });

        const response = await request(app).get('/api/whitelabel/settings');

        expect(response.status).toBe(200);
      });
    });

    describe('PUT /api/whitelabel/settings', () => {
      it('should update whitelabel settings', async () => {
        const { updateSettings } = require('../../controllers/whitelabelController');
        updateSettings.mockImplementation((req, res) => {
          res.json({ success: true });
        });

        const response = await request(app)
          .put('/api/whitelabel/settings')
          .send({ brandName: 'Test Brand' });

        expect(response.status).toBe(200);
      });
    });

    describe('POST /api/whitelabel/upload-logo', () => {
      it('should upload logo', async () => {
        const { uploadLogo } = require('../../controllers/whitelabelController');
        uploadLogo.mockImplementation((req, res) => {
          res.json({ success: true, url: '/uploads/logo.png' });
        });

        const response = await request(app)
          .post('/api/whitelabel/upload-logo')
          .attach('logo', Buffer.from('test'), 'logo.png');

        expect(response.status).toBe(200);
      });

      it('should handle upload errors', async () => {
        const { uploadLogo } = require('../../middleware/upload');
        uploadLogo.mockImplementation((req, res, cb) => {
          cb(new Error('File too large'));
        });

        const response = await request(app)
          .post('/api/whitelabel/upload-logo');

        expect(response.status).toBe(400);
      });
    });

    describe('POST /api/whitelabel/upload-favicon', () => {
      it('should upload favicon', async () => {
        const { uploadFavicon: uploadFaviconController } = require('../../controllers/whitelabelController');
        uploadFaviconController.mockImplementation((req, res) => {
          res.json({ success: true, url: '/uploads/favicon.ico' });
        });

        const response = await request(app)
          .post('/api/whitelabel/upload-favicon');

        expect(response.status).toBe(200);
      });
    });
  });
});
