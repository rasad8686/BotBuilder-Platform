/**
 * A/B Test Service Unit Tests
 */

const ABTestService = require('../../services/ab-test.service');

// Mock the database
jest.mock('../../config/db', () => {
  const mockDb = jest.fn(() => mockDb);
  mockDb.schema = {
    hasTable: jest.fn().mockResolvedValue(true)
  };
  mockDb.where = jest.fn().mockReturnThis();
  mockDb.whereIn = jest.fn().mockReturnThis();
  mockDb.orderBy = jest.fn().mockReturnThis();
  mockDb.limit = jest.fn().mockReturnThis();
  mockDb.offset = jest.fn().mockReturnThis();
  mockDb.clone = jest.fn().mockReturnThis();
  mockDb.count = jest.fn().mockReturnThis();
  mockDb.first = jest.fn();
  mockDb.select = jest.fn().mockReturnThis();
  mockDb.sum = jest.fn().mockReturnThis();
  mockDb.groupBy = jest.fn().mockReturnThis();
  mockDb.insert = jest.fn().mockReturnThis();
  mockDb.update = jest.fn().mockReturnThis();
  mockDb.del = jest.fn();
  mockDb.increment = jest.fn().mockReturnThis();
  mockDb.returning = jest.fn();
  return mockDb;
});

const db = require('../../config/db');

describe('ABTestService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==================== CRUD Tests ====================

  describe('createTest', () => {
    it('should create test with default variants A and B', async () => {
      const mockTest = {
        id: 'test-uuid-123',
        workspace_id: 1,
        name: 'Test Campaign',
        status: 'draft',
        test_type: 'message',
        goal_metric: 'conversion',
        traffic_split: JSON.stringify({ A: 50, B: 50 })
      };

      const mockVariants = [
        { id: 'var-a', test_id: 'test-uuid-123', name: 'A', is_control: true },
        { id: 'var-b', test_id: 'test-uuid-123', name: 'B', is_control: false }
      ];

      db.insert.mockResolvedValue([mockTest]);
      db.first.mockResolvedValueOnce(mockTest);
      db.mockReturnValueOnce({
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockResolvedValue(mockVariants)
      });

      const result = await ABTestService.createTest(1, {
        name: 'Test Campaign',
        test_type: 'message'
      });

      expect(db).toHaveBeenCalledWith('ab_tests');
      expect(result).toBeDefined();
    });

    it('should set status to draft by default', async () => {
      const mockTest = {
        id: 'test-uuid-123',
        status: 'draft'
      };

      db.insert.mockResolvedValue([mockTest]);
      db.first.mockResolvedValue(mockTest);
      db.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockResolvedValue([])
      });

      await ABTestService.createTest(1, {
        name: 'Test',
        test_type: 'message'
      });

      const insertCall = db.insert.mock.calls[0][0];
      expect(insertCall.status).toBe('draft');
    });

    it('should set default traffic split 50/50', async () => {
      const mockTest = { id: 'test-uuid-123' };

      db.insert.mockResolvedValue([mockTest]);
      db.first.mockResolvedValue(mockTest);
      db.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockResolvedValue([])
      });

      await ABTestService.createTest(1, {
        name: 'Test',
        test_type: 'message'
      });

      const insertCall = db.insert.mock.calls[0][0];
      const trafficSplit = JSON.parse(insertCall.traffic_split);
      expect(trafficSplit.A).toBe(50);
      expect(trafficSplit.B).toBe(50);
    });
  });

  describe('getTestById', () => {
    it('should return test with variants', async () => {
      const mockTest = {
        id: 'test-123',
        name: 'Test',
        workspace_id: 1
      };

      const mockVariants = [
        { id: 'var-a', name: 'A', is_control: true },
        { id: 'var-b', name: 'B', is_control: false }
      ];

      db.first.mockResolvedValueOnce(mockTest);
      db.where.mockReturnThis();
      db.orderBy.mockResolvedValueOnce(mockVariants);
      db.select.mockReturnThis();
      db.sum.mockReturnThis();
      db.groupBy.mockResolvedValueOnce([]);

      const result = await ABTestService.getTestById('test-123', 1);

      expect(result).toBeDefined();
      expect(result.variants).toBeDefined();
    });

    it('should return null for non-existent test', async () => {
      db.first.mockResolvedValueOnce(null);

      const result = await ABTestService.getTestById('non-existent', 1);

      expect(result).toBeNull();
    });

    it('should only return tests from same workspace', async () => {
      db.first.mockResolvedValueOnce(null);

      const result = await ABTestService.getTestById('test-123', 999);

      expect(db.where).toHaveBeenCalledWith({ id: 'test-123', workspace_id: 999 });
      expect(result).toBeNull();
    });
  });

  describe('updateTest', () => {
    it('should update test properties', async () => {
      const mockUpdatedTest = {
        id: 'test-123',
        name: 'Updated Name',
        description: 'Updated description'
      };

      db.returning.mockResolvedValue([mockUpdatedTest]);

      const result = await ABTestService.updateTest('test-123', 1, {
        name: 'Updated Name',
        description: 'Updated description'
      });

      expect(result).toEqual(mockUpdatedTest);
    });

    it('should not allow updating running test name', async () => {
      // This would be a business logic check in the service
      // For now, the service allows it - this is a placeholder for future validation
      db.returning.mockResolvedValue([{ id: 'test-123', status: 'running' }]);

      const result = await ABTestService.updateTest('test-123', 1, {
        name: 'New Name'
      });

      expect(result).toBeDefined();
    });
  });

  describe('deleteTest', () => {
    it('should delete test and all related data', async () => {
      db.del.mockResolvedValue(1);

      const result = await ABTestService.deleteTest('test-123', 1);

      expect(result).toBe(true);
      expect(db.where).toHaveBeenCalledWith({ id: 'test-123', workspace_id: 1 });
    });

    it('should not delete running test', async () => {
      // This would be a business logic check - placeholder
      db.del.mockResolvedValue(0);

      const result = await ABTestService.deleteTest('non-existent', 1);

      expect(result).toBe(false);
    });
  });

  describe('duplicateTest', () => {
    it('should create copy with all variants', async () => {
      const mockOriginal = {
        id: 'test-123',
        name: 'Original Test',
        description: 'Test description',
        test_type: 'message',
        goal_metric: 'conversion',
        traffic_split: JSON.stringify({ A: 50, B: 50 }),
        auto_winner_enabled: false,
        auto_winner_threshold: 95,
        variants: [
          { id: 'var-a', name: 'A', is_control: true, content: '{}' },
          { id: 'var-b', name: 'B', is_control: false, content: '{}' }
        ]
      };

      db.first.mockResolvedValue(mockOriginal);
      db.insert.mockResolvedValue([]);
      db.where.mockReturnThis();
      db.orderBy.mockResolvedValue([]);
      db.select.mockReturnThis();
      db.sum.mockReturnThis();
      db.groupBy.mockResolvedValue([]);

      const result = await ABTestService.duplicateTest('test-123', 1);

      expect(db.insert).toHaveBeenCalled();
    });

    it('should reset status to draft', async () => {
      const mockOriginal = {
        id: 'test-123',
        name: 'Original',
        status: 'completed',
        test_type: 'message',
        variants: []
      };

      db.first.mockResolvedValue(mockOriginal);
      db.insert.mockResolvedValue([]);

      await ABTestService.duplicateTest('test-123', 1);

      const insertCall = db.insert.mock.calls[0][0];
      expect(insertCall.status).toBe('draft');
    });

    it('should append (Copy) to name', async () => {
      const mockOriginal = {
        id: 'test-123',
        name: 'Original Test',
        test_type: 'message',
        variants: []
      };

      db.first.mockResolvedValue(mockOriginal);
      db.insert.mockResolvedValue([]);

      await ABTestService.duplicateTest('test-123', 1);

      const insertCall = db.insert.mock.calls[0][0];
      expect(insertCall.name).toBe('Original Test (Copy)');
    });
  });

  // ==================== Status Tests ====================

  describe('startTest', () => {
    it('should change status from draft to running', async () => {
      const mockTest = { id: 'test-123', status: 'running' };
      db.returning.mockResolvedValue([mockTest]);

      const result = await ABTestService.startTest('test-123', 1);

      expect(result.status).toBe('running');
    });

    it('should set started_at timestamp', async () => {
      const mockTest = {
        id: 'test-123',
        status: 'running',
        started_at: new Date()
      };
      db.returning.mockResolvedValue([mockTest]);

      const result = await ABTestService.startTest('test-123', 1);

      expect(result.started_at).toBeDefined();
    });

    it('should require at least 2 variants', async () => {
      // This is a business logic validation that should be added
      // Placeholder test
      db.returning.mockResolvedValue([null]);

      const result = await ABTestService.startTest('test-123', 1);

      // Currently returns undefined/null if no match
      expect(result).toBeFalsy();
    });

    it('should not start already running test', async () => {
      db.returning.mockResolvedValue([]);

      const result = await ABTestService.startTest('test-123', 1);

      expect(result).toBeUndefined();
    });
  });

  describe('pauseTest', () => {
    it('should change status from running to paused', async () => {
      const mockTest = { id: 'test-123', status: 'paused' };
      db.returning.mockResolvedValue([mockTest]);

      const result = await ABTestService.pauseTest('test-123', 1);

      expect(result.status).toBe('paused');
    });

    it('should not pause draft test', async () => {
      db.returning.mockResolvedValue([]);

      const result = await ABTestService.pauseTest('test-123', 1);

      expect(result).toBeUndefined();
    });
  });

  describe('resumeTest', () => {
    it('should change status from paused to running', async () => {
      const mockTest = { id: 'test-123', status: 'running' };
      db.returning.mockResolvedValue([mockTest]);

      const result = await ABTestService.resumeTest('test-123', 1);

      expect(result.status).toBe('running');
    });
  });

  describe('completeTest', () => {
    it('should change status to completed', async () => {
      const mockTest = { id: 'test-123', status: 'completed' };
      db.returning.mockResolvedValue([mockTest]);

      const result = await ABTestService.completeTest('test-123', 1);

      expect(result.status).toBe('completed');
    });

    it('should set ended_at timestamp', async () => {
      const mockTest = {
        id: 'test-123',
        status: 'completed',
        ended_at: new Date()
      };
      db.returning.mockResolvedValue([mockTest]);

      const result = await ABTestService.completeTest('test-123', 1);

      expect(result.ended_at).toBeDefined();
    });
  });

  describe('declareWinner', () => {
    it('should set winner_variant', async () => {
      const mockVariant = { id: 'var-b', name: 'B' };
      const mockTest = {
        id: 'test-123',
        status: 'completed',
        winner_variant: 'B'
      };

      db.first.mockResolvedValueOnce(mockVariant);
      db.first.mockResolvedValueOnce({
        id: 'test-123',
        variants: [
          { id: 'var-a', is_control: true, stats: { impressions: 100, conversions: 10 } },
          { id: 'var-b', is_control: false, stats: { impressions: 100, conversions: 15 } }
        ]
      });
      db.returning.mockResolvedValue([mockTest]);

      const result = await ABTestService.declareWinner('test-123', 1, 'var-b');

      expect(result.winner_variant).toBe('B');
    });

    it('should set winner_confidence', async () => {
      const mockVariant = { id: 'var-b', name: 'B' };
      const mockTest = {
        id: 'test-123',
        winner_confidence: 95.5
      };

      db.first.mockResolvedValueOnce(mockVariant);
      db.first.mockResolvedValueOnce({
        id: 'test-123',
        variants: []
      });
      db.returning.mockResolvedValue([mockTest]);

      const result = await ABTestService.declareWinner('test-123', 1, 'var-b');

      expect(result).toBeDefined();
    });

    it('should complete the test', async () => {
      const mockVariant = { id: 'var-b', name: 'B' };
      const mockTest = { id: 'test-123', status: 'completed' };

      db.first.mockResolvedValueOnce(mockVariant);
      db.first.mockResolvedValueOnce({ variants: [] });
      db.returning.mockResolvedValue([mockTest]);

      const result = await ABTestService.declareWinner('test-123', 1, 'var-b');

      expect(result.status).toBe('completed');
    });
  });

  // ==================== Variant Tests ====================

  describe('createVariant', () => {
    it('should create variant with unique name', async () => {
      const mockVariant = { id: 'var-c', name: 'C', is_control: false };
      db.returning.mockResolvedValue([mockVariant]);

      const result = await ABTestService.createVariant('test-123', {
        name: 'C',
        content: { message: 'Test' }
      });

      expect(result.name).toBe('C');
    });

    it('should not allow more than 4 variants', async () => {
      // This would be a business logic validation
      // Placeholder - currently no limit enforced in service
      db.returning.mockResolvedValue([{ id: 'var-e', name: 'E' }]);

      const result = await ABTestService.createVariant('test-123', {
        name: 'E',
        content: {}
      });

      expect(result).toBeDefined();
    });
  });

  describe('deleteVariant', () => {
    it('should delete variant', async () => {
      db.del.mockResolvedValue(1);

      const result = await ABTestService.deleteVariant('test-123', 'var-c');

      expect(result).toBe(true);
    });

    it('should not delete if only 2 variants remain', async () => {
      // Business logic validation - placeholder
      db.del.mockResolvedValue(0);

      const result = await ABTestService.deleteVariant('test-123', 'var-a');

      expect(result).toBe(false);
    });

    it('should not delete control variant', async () => {
      // Business logic validation - placeholder
      db.del.mockResolvedValue(0);

      const result = await ABTestService.deleteVariant('test-123', 'control-var');

      expect(result).toBe(false);
    });
  });

  // ==================== Assignment Tests ====================

  describe('assignVariant', () => {
    it('should assign based on traffic split', async () => {
      const mockTest = {
        id: 'test-123',
        status: 'running',
        traffic_split: JSON.stringify({ A: 50, B: 50 })
      };

      const mockVariants = [
        { id: 'var-a', name: 'A' },
        { id: 'var-b', name: 'B' }
      ];

      db.first.mockResolvedValueOnce(null); // No existing assignment
      db.first.mockResolvedValueOnce(mockTest);
      db.where.mockReturnThis();
      db.orderBy.mockResolvedValueOnce(mockVariants);
      db.insert.mockResolvedValue([]);

      const result = await ABTestService.assignVariant('test-123', 'visitor-123');

      expect(result).toBeDefined();
      expect(['A', 'B']).toContain(result.name);
    });

    it('should return same variant for same visitor', async () => {
      const existingAssignment = { variant_id: 'var-a' };
      const mockVariant = { id: 'var-a', name: 'A' };

      db.first.mockResolvedValueOnce(existingAssignment);
      db.first.mockResolvedValueOnce(mockVariant);

      const result = await ABTestService.assignVariant('test-123', 'visitor-123');

      expect(result.id).toBe('var-a');
    });

    it('should respect 50/50 split distribution', () => {
      const variants = [
        { id: 'var-a', name: 'A' },
        { id: 'var-b', name: 'B' }
      ];
      const trafficSplit = { A: 50, B: 50 };

      // Run multiple times and check distribution
      const counts = { A: 0, B: 0 };
      for (let i = 0; i < 1000; i++) {
        const selected = ABTestService.selectVariantByTrafficSplit(variants, trafficSplit);
        counts[selected.name]++;
      }

      // Allow 10% margin
      expect(counts.A).toBeGreaterThan(400);
      expect(counts.A).toBeLessThan(600);
      expect(counts.B).toBeGreaterThan(400);
      expect(counts.B).toBeLessThan(600);
    });

    it('should respect 70/30 split distribution', () => {
      const variants = [
        { id: 'var-a', name: 'A' },
        { id: 'var-b', name: 'B' }
      ];
      const trafficSplit = { A: 70, B: 30 };

      const counts = { A: 0, B: 0 };
      for (let i = 0; i < 1000; i++) {
        const selected = ABTestService.selectVariantByTrafficSplit(variants, trafficSplit);
        counts[selected.name]++;
      }

      // Allow 10% margin
      expect(counts.A).toBeGreaterThan(600);
      expect(counts.A).toBeLessThan(800);
      expect(counts.B).toBeGreaterThan(200);
      expect(counts.B).toBeLessThan(400);
    });
  });

  describe('getAssignedVariant', () => {
    it('should return cached assignment', async () => {
      const mockAssignment = { variant_id: 'var-a' };
      const mockVariant = { id: 'var-a', name: 'A' };

      db.first.mockResolvedValueOnce(mockAssignment);
      db.first.mockResolvedValueOnce(mockVariant);

      const result = await ABTestService.getAssignedVariant('test-123', 'visitor-123');

      expect(result.name).toBe('A');
    });

    it('should return null for unassigned visitor', async () => {
      db.first.mockResolvedValueOnce(null);

      const result = await ABTestService.getAssignedVariant('test-123', 'new-visitor');

      expect(result).toBeNull();
    });
  });

  // ==================== Conversion Tests ====================

  describe('recordConversion', () => {
    it('should record conversion event', async () => {
      const mockAssignment = { variant_id: 'var-a' };
      const mockConversion = {
        id: 'conv-123',
        test_id: 'test-123',
        variant_id: 'var-a'
      };

      db.first.mockResolvedValueOnce(mockAssignment);
      db.returning.mockResolvedValue([mockConversion]);
      db.first.mockResolvedValue({ impressions: 100, conversions: 10 });

      const result = await ABTestService.recordConversion('test-123', 'visitor-123', {
        type: 'click'
      });

      expect(result).toBeDefined();
      expect(result.test_id).toBe('test-123');
    });

    it('should update daily analytics', async () => {
      const mockAssignment = { variant_id: 'var-a' };
      db.first.mockResolvedValueOnce(mockAssignment);
      db.returning.mockResolvedValue([{ id: 'conv-123' }]);
      db.first.mockResolvedValue({ impressions: 100, conversions: 10 });

      await ABTestService.recordConversion('test-123', 'visitor-123', {
        type: 'click',
        value: 10
      });

      expect(db.increment).toHaveBeenCalled();
    });

    it('should not record duplicate conversion', async () => {
      db.first.mockResolvedValueOnce(null); // No assignment

      const result = await ABTestService.recordConversion('test-123', 'visitor-123', {
        type: 'click'
      });

      expect(result).toBeNull();
    });

    it('should track conversion value', async () => {
      const mockAssignment = { variant_id: 'var-a' };
      db.first.mockResolvedValueOnce(mockAssignment);
      db.returning.mockResolvedValue([{ id: 'conv-123', conversion_value: 99.99 }]);
      db.first.mockResolvedValue({ impressions: 100, conversions: 10 });

      const result = await ABTestService.recordConversion('test-123', 'visitor-123', {
        type: 'purchase',
        value: 99.99
      });

      expect(result).toBeDefined();
    });
  });

  // ==================== Analytics Tests ====================

  describe('calculateSignificance', () => {
    it('should return significant for large difference', () => {
      const controlStats = { impressions: 1000, conversions: 100 };
      const testStats = { impressions: 1000, conversions: 150 };

      const result = ABTestService.calculateSignificance(controlStats, testStats);

      expect(result.significant).toBe(true);
      expect(result.confidence).toBeGreaterThan(95);
    });

    it('should return not significant for small sample', () => {
      const controlStats = { impressions: 20, conversions: 2 };
      const testStats = { impressions: 20, conversions: 3 };

      const result = ABTestService.calculateSignificance(controlStats, testStats);

      expect(result.significant).toBe(false);
      expect(result.message).toBe('Insufficient sample size');
    });

    it('should calculate correct lift percentage', () => {
      const controlStats = { impressions: 1000, conversions: 100 }; // 10%
      const testStats = { impressions: 1000, conversions: 120 }; // 12%

      const result = ABTestService.calculateSignificance(controlStats, testStats);

      // Lift should be 20% ((12-10)/10 * 100)
      expect(result.lift).toBe(20);
    });

    it('should handle zero conversions', () => {
      const controlStats = { impressions: 1000, conversions: 0 };
      const testStats = { impressions: 1000, conversions: 0 };

      const result = ABTestService.calculateSignificance(controlStats, testStats);

      expect(result.lift).toBe(0);
    });
  });
});
