/**
 * RevenueShare Tests
 * Tests for server/plugins/billing/RevenueShare.js
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
    transfers: {
      create: jest.fn().mockResolvedValue({ id: 'tr_test123' })
    }
  }));
});

const db = require('../../../db');
const RevenueShare = require('../../../plugins/billing/RevenueShare');

describe('RevenueShare', () => {
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
      expect(RevenueShare.DEVELOPER_SHARE).toBe(0.70);
      expect(RevenueShare.PLATFORM_SHARE).toBe(0.30);
    });

    it('should have minimum payout amount', () => {
      expect(RevenueShare.MIN_PAYOUT_AMOUNT).toBe(50.00);
    });

    it('should have payout day', () => {
      expect(RevenueShare.PAYOUT_DAY).toBe(1);
    });
  });

  describe('calculatePayout', () => {
    it('should calculate payout for developer', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ pending_amount: '100.00', pending_count: '5' }] })
        .mockResolvedValueOnce({ rows: [{ payout_method: 'paypal', paypal_email: 'test@test.com' }] });

      const result = await RevenueShare.calculatePayout(1);

      expect(result.pendingAmount).toBe(100);
      expect(result.pendingCount).toBe(5);
      expect(result.minimumPayout).toBe(50);
      expect(result.canRequestPayout).toBe(true);
      expect(result.hasPayoutInfo).toBe(true);
      expect(result.payoutMethod).toBe('paypal');
    });

    it('should return false for canRequestPayout when below minimum', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ pending_amount: '25.00', pending_count: '2' }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await RevenueShare.calculatePayout(1);

      expect(result.canRequestPayout).toBe(false);
      expect(result.hasPayoutInfo).toBe(false);
    });

    it('should handle null pending amount', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ pending_amount: null, pending_count: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await RevenueShare.calculatePayout(1);

      expect(result.pendingAmount).toBe(0);
      expect(result.pendingCount).toBe(0);
    });
  });

  describe('getNextPayoutDate', () => {
    it('should return next payout date', () => {
      const date = RevenueShare.getNextPayoutDate();

      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('createPayout', () => {
    it('should throw error if below minimum', async () => {
      // calculatePayout is called internally using pool.query (db.query)
      db.query
        .mockResolvedValueOnce({ rows: [{ pending_amount: '25.00', pending_count: '2' }] })
        .mockResolvedValueOnce({ rows: [{ payout_method: 'paypal' }] });

      mockClient.query.mockResolvedValueOnce(); // BEGIN

      await expect(RevenueShare.createPayout(1)).rejects.toThrow('Minimum payout amount');
    });

    it('should throw error if no payout info', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ pending_amount: '100.00', pending_count: '5' }] })
        .mockResolvedValueOnce({ rows: [] }); // No payout info

      mockClient.query.mockResolvedValueOnce(); // BEGIN

      await expect(RevenueShare.createPayout(1)).rejects.toThrow('payout information');
    });

    it('should throw error if requested amount exceeds balance', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ pending_amount: '100.00', pending_count: '5' }] })
        .mockResolvedValueOnce({ rows: [{ payout_method: 'paypal', paypal_email: 'test@test.com' }] });

      mockClient.query.mockResolvedValueOnce(); // BEGIN

      await expect(RevenueShare.createPayout(1, 200)).rejects.toThrow('exceeds available balance');
    });
  });

  describe('processPayout', () => {
    it('should process payout successfully', async () => {
      const payout = {
        id: 1,
        amount: 100,
        status: 'pending',
        payout_method: 'paypal',
        developer_id: 1
      };

      mockClient.query
        .mockResolvedValueOnce() // BEGIN
        .mockResolvedValueOnce({ rows: [payout] }) // Get payout
        .mockResolvedValueOnce() // Update payout
        .mockResolvedValueOnce() // Update earnings
        .mockResolvedValueOnce(); // COMMIT

      const result = await RevenueShare.processPayout(1);

      expect(result.success).toBe(true);
      expect(result.payoutId).toBe(1);
      expect(result.amount).toBe(100);
    });

    it('should throw error if payout not found', async () => {
      mockClient.query
        .mockResolvedValueOnce() // BEGIN
        .mockResolvedValueOnce({ rows: [] }); // No payout

      await expect(RevenueShare.processPayout(999)).rejects.toThrow('Payout not found');
    });

    it('should throw error if payout not pending', async () => {
      mockClient.query
        .mockResolvedValueOnce() // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 1, status: 'completed' }] });

      await expect(RevenueShare.processPayout(1)).rejects.toThrow('not in pending status');
    });

    it('should process stripe payout', async () => {
      const payout = {
        id: 1,
        amount: 100,
        status: 'pending',
        payout_method: 'stripe',
        stripe_connect_id: 'acct_test123',
        developer_id: 1
      };

      mockClient.query
        .mockResolvedValueOnce() // BEGIN
        .mockResolvedValueOnce({ rows: [payout] })
        .mockResolvedValueOnce()
        .mockResolvedValueOnce()
        .mockResolvedValueOnce();

      const result = await RevenueShare.processPayout(1);

      expect(result.success).toBe(true);
    });

    it('should process bank payout', async () => {
      const payout = {
        id: 1,
        amount: 100,
        status: 'pending',
        payout_method: 'bank',
        developer_id: 1
      };

      mockClient.query
        .mockResolvedValueOnce() // BEGIN
        .mockResolvedValueOnce({ rows: [payout] })
        .mockResolvedValueOnce()
        .mockResolvedValueOnce()
        .mockResolvedValueOnce();

      const result = await RevenueShare.processPayout(1);

      expect(result.reference).toContain('bank_');
    });
  });

  describe('setPayoutInfo', () => {
    it('should set payout info', async () => {
      const payoutInfo = {
        payout_method: 'paypal',
        paypal_email: 'test@test.com'
      };

      db.query.mockResolvedValueOnce({ rows: [{ id: 1, ...payoutInfo }] });

      const result = await RevenueShare.setPayoutInfo(1, payoutInfo);

      expect(result.payout_method).toBe('paypal');
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO developer_payout_info'),
        expect.any(Array)
      );
    });
  });

  describe('getPayoutInfo', () => {
    it('should get payout info', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, payout_method: 'paypal', paypal_email: 'test@test.com' }]
      });

      const result = await RevenueShare.getPayoutInfo(1);

      expect(result.payout_method).toBe('paypal');
    });

    it('should return null if no info', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await RevenueShare.getPayoutInfo(999);

      expect(result).toBeNull();
    });
  });

  describe('getPendingPayouts', () => {
    it('should get pending payouts', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { id: 1, amount: 100, username: 'dev1' },
          { id: 2, amount: 200, username: 'dev2' }
        ]
      });

      const result = await RevenueShare.getPendingPayouts();

      expect(result).toHaveLength(2);
    });
  });

  describe('runMonthlyPayouts', () => {
    it('should run monthly payouts', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ developer_id: 1, pending_amount: 100 }] });

      // Mock getPayoutInfo
      db.query.mockResolvedValue({ rows: [] });

      const results = await RevenueShare.runMonthlyPayouts();

      expect(results).toBeInstanceOf(Array);
    });
  });

  describe('getPlatformRevenue', () => {
    it('should get platform revenue summary', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{
            total_transactions: '100',
            gross_revenue: '5000',
            platform_revenue: '1500',
            developer_payouts: '3500'
          }]
        })
        .mockResolvedValueOnce({
          rows: [
            { month: '2024-01-01', transactions: 20, gross: 1000, platform: 300, developer: 700 }
          ]
        });

      const result = await RevenueShare.getPlatformRevenue();

      expect(result.summary.total_transactions).toBe('100');
      expect(result.monthly).toBeInstanceOf(Array);
    });

    it('should filter by date range', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total_transactions: '50' }] })
        .mockResolvedValueOnce({ rows: [] });

      await RevenueShare.getPlatformRevenue('2024-01-01', '2024-12-31');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('created_at >='),
        expect.arrayContaining(['2024-01-01', '2024-12-31'])
      );
    });
  });
});
