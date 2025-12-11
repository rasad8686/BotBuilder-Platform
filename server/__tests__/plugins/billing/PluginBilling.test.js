/**
 * PluginBilling Tests
 * Tests for server/plugins/billing/PluginBilling.js
 */

jest.mock('../../../db', () => {
  const mockClient = {
    query: jest.fn(),
    release: jest.fn()
  };
  return {
    query: jest.fn(),
    connect: jest.fn().mockResolvedValue(mockClient)
  };
});

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    paymentIntents: {
      create: jest.fn().mockResolvedValue({
        id: 'pi_test123',
        status: 'succeeded'
      })
    },
    checkout: {
      sessions: {
        create: jest.fn().mockResolvedValue({
          id: 'cs_test123',
          url: 'https://checkout.stripe.com/test'
        })
      }
    }
  }));
});

const db = require('../../../db');
const PluginBilling = require('../../../plugins/billing/PluginBilling');

describe('PluginBilling', () => {
  let mockClient;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = {
      query: jest.fn(),
      release: jest.fn()
    };
    db.connect.mockResolvedValue(mockClient);
  });

  describe('static properties', () => {
    it('should have correct revenue split', () => {
      expect(PluginBilling.DEVELOPER_SHARE).toBe(0.70);
      expect(PluginBilling.PLATFORM_SHARE).toBe(0.30);
    });
  });

  describe('createPluginPurchase', () => {
    it('should create a plugin purchase successfully', async () => {
      const plugin = { id: 1, price: 29.99, developer_id: 2 };

      mockClient.query
        .mockResolvedValueOnce() // BEGIN
        .mockResolvedValueOnce({ rows: [plugin] }) // Get plugin
        .mockResolvedValueOnce({ rows: [] }) // Check existing
        .mockResolvedValueOnce({ rows: [{ id: 1, user_id: 1, plugin_id: 1 }] }) // Insert
        .mockResolvedValueOnce(); // COMMIT

      const result = await PluginBilling.createPluginPurchase(1, 1, {
        method: 'stripe',
        paymentId: 'pi_test'
      });

      expect(result.id).toBe(1);
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should throw error if plugin not found', async () => {
      mockClient.query
        .mockResolvedValueOnce() // BEGIN
        .mockResolvedValueOnce({ rows: [] }); // No plugin

      await expect(
        PluginBilling.createPluginPurchase(1, 999, {})
      ).rejects.toThrow('Plugin not found');
    });

    it('should throw error if already purchased', async () => {
      const plugin = { id: 1, price: 29.99, developer_id: 2 };

      mockClient.query
        .mockResolvedValueOnce() // BEGIN
        .mockResolvedValueOnce({ rows: [plugin] }) // Get plugin
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }); // Existing purchase

      await expect(
        PluginBilling.createPluginPurchase(1, 1, {})
      ).rejects.toThrow('Plugin already purchased');
    });
  });

  describe('processPayment', () => {
    it('should process mock payment when stripe not configured', async () => {
      const purchase = {
        id: 1,
        gross_amount: 29.99,
        plugin_id: 1,
        user_id: 1,
        developer_id: 2,
        developer_revenue: 20.99,
        status: 'pending',
        plugin_name: 'Test Plugin'
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [purchase] }) // Get purchase
        .mockResolvedValueOnce() // BEGIN
        .mockResolvedValueOnce() // Update purchase
        .mockResolvedValueOnce() // Create installation
        .mockResolvedValueOnce() // Update downloads
        .mockResolvedValueOnce() // Add earnings
        .mockResolvedValueOnce(); // COMMIT

      const result = await PluginBilling.processPayment(1, 'pm_test');

      expect(result.success).toBe(true);
      expect(result.purchaseId).toBe(1);
    });

    it('should throw error if purchase not found', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        PluginBilling.processPayment(999, 'pm_test')
      ).rejects.toThrow('Purchase not found');
    });

    it('should throw error if purchase already completed', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 1, status: 'completed' }]
      });

      await expect(
        PluginBilling.processPayment(1, 'pm_test')
      ).rejects.toThrow('Purchase already completed');
    });
  });

  describe('createCheckoutSession', () => {
    it('should create mock checkout session', async () => {
      const plugin = { id: 1, name: 'Test', price: 29.99, is_free: false };
      const user = { id: 1, email: 'test@test.com' };

      db.query
        .mockResolvedValueOnce({ rows: [plugin] }) // Get plugin
        .mockResolvedValueOnce({ rows: [user] }); // Get user

      // Mock createPluginPurchase
      mockClient.query
        .mockResolvedValueOnce() // BEGIN
        .mockResolvedValueOnce({ rows: [plugin] }) // Get plugin
        .mockResolvedValueOnce({ rows: [] }) // No existing
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Insert
        .mockResolvedValueOnce(); // COMMIT

      const result = await PluginBilling.createCheckoutSession(
        1, 1, 'http://success.com', 'http://cancel.com'
      );

      expect(result.sessionId).toBeDefined();
      expect(result.url).toContain('http://success.com');
    });

    it('should throw error if plugin not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        PluginBilling.createCheckoutSession(1, 999, 'http://success', 'http://cancel')
      ).rejects.toThrow('Plugin not found');
    });

    it('should throw error if plugin is free', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, is_free: true }]
      });

      await expect(
        PluginBilling.createCheckoutSession(1, 1, 'http://success', 'http://cancel')
      ).rejects.toThrow('This plugin is free');
    });
  });

  describe('handleCheckoutComplete', () => {
    it('should handle completed checkout', async () => {
      const purchase = {
        id: 1,
        plugin_id: 1,
        user_id: 1,
        developer_id: 2,
        developer_revenue: 20.99,
        status: 'pending'
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [purchase] }) // Find purchase
        .mockResolvedValueOnce() // BEGIN
        .mockResolvedValueOnce() // Update purchase
        .mockResolvedValueOnce() // Create installation
        .mockResolvedValueOnce() // Update downloads
        .mockResolvedValueOnce() // Add earnings
        .mockResolvedValueOnce(); // COMMIT

      const result = await PluginBilling.handleCheckoutComplete('cs_test');

      expect(result.success).toBe(true);
      expect(result.purchaseId).toBe(1);
    });

    it('should return success if already processed', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 1, status: 'completed' }]
      });

      const result = await PluginBilling.handleCheckoutComplete('cs_test');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Already processed');
    });

    it('should throw error if session not found', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        PluginBilling.handleCheckoutComplete('cs_invalid')
      ).rejects.toThrow('Purchase not found for session');
    });
  });

  describe('calculateRevenue', () => {
    it('should calculate revenue for developer', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          total_sales: 10,
          gross_revenue: 299.90,
          net_revenue: 209.93,
          platform_fees: 89.97
        }]
      });

      const result = await PluginBilling.calculateRevenue(1);

      expect(result.total_sales).toBe(10);
      expect(result.gross_revenue).toBe(299.90);
    });

    it('should calculate revenue with date filters', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          total_sales: 5,
          gross_revenue: 149.95,
          net_revenue: 104.96,
          platform_fees: 44.98
        }]
      });

      const result = await PluginBilling.calculateRevenue(
        1,
        new Date('2024-01-01'),
        new Date('2024-12-31')
      );

      expect(result.total_sales).toBe(5);
    });
  });

  describe('getEarnings', () => {
    it('should get developer earnings summary', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{ total_earned: 1000, total_paid: 500, pending_balance: 500 }]
        })
        .mockResolvedValueOnce({ rows: [{ month: '2024-01', sales: 5, earnings: 100 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Plugin', sales: 5, earnings: 100 }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await PluginBilling.getEarnings(1);

      expect(result.summary.total_earned).toBe(1000);
      expect(result.summary.pending_balance).toBe(500);
      expect(result.monthly.length).toBeGreaterThanOrEqual(0);
      expect(result.byPlugin.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getPurchaseHistory', () => {
    it('should get purchase history for user', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { id: 1, plugin_name: 'Plugin 1', status: 'completed' },
          { id: 2, plugin_name: 'Plugin 2', status: 'completed' }
        ]
      });

      const result = await PluginBilling.getPurchaseHistory(1);

      expect(result.length).toBe(2);
      expect(result[0].plugin_name).toBe('Plugin 1');
    });
  });

  describe('hasPurchased', () => {
    it('should return true if user has purchased plugin', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const result = await PluginBilling.hasPurchased(1, 1);

      expect(result).toBe(true);
    });

    it('should return false if user has not purchased plugin', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await PluginBilling.hasPurchased(1, 999);

      expect(result).toBe(false);
    });
  });
});
