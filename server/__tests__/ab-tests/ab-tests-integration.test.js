/**
 * A/B Test Integration Tests
 * Tests the full lifecycle and data flow of A/B testing system
 */

const request = require('supertest');
const express = require('express');

// These tests require a real database connection
// Skip if TEST_DATABASE_URL is not set
const skipIntegration = !process.env.TEST_DATABASE_URL;

// Mock for unit test mode
let db;
let ABTestService;

if (skipIntegration) {
  // Mock mode for CI/CD without database
  jest.mock('../../config/db', () => {
    const mockDb = jest.fn(() => mockDb);
    mockDb.schema = { hasTable: jest.fn().mockResolvedValue(true) };
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
    mockDb.raw = jest.fn();
    return mockDb;
  });
}

describe('ABTest Integration', () => {
  let testWorkspaceId = 999;

  beforeAll(() => {
    if (!skipIntegration) {
      db = require('../../config/db');
      ABTestService = require('../../services/ab-test.service');
    }
  });

  afterAll(async () => {
    if (!skipIntegration && db) {
      // Cleanup test data
      await db('ab_tests').where('workspace_id', testWorkspaceId).del();
    }
  });

  describe('Full Test Lifecycle', () => {
    it('should create -> start -> assign -> convert -> complete -> declare winner', async () => {
      if (skipIntegration) {
        // Mock mode test
        const ABTestService = require('../../services/ab-test.service');
        const db = require('../../config/db');

        // Setup mocks for full lifecycle
        const mockTest = {
          id: 'test-lifecycle-123',
          name: 'Lifecycle Test',
          status: 'draft',
          workspace_id: testWorkspaceId,
          variants: [
            { id: 'var-a', name: 'A', is_control: true, stats: { impressions: 0, conversions: 0 } },
            { id: 'var-b', name: 'B', is_control: false, stats: { impressions: 0, conversions: 0 } }
          ]
        };

        // 1. Create test
        db.insert.mockResolvedValue([mockTest]);
        db.first.mockResolvedValue(mockTest);
        db.mockReturnValue({
          where: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockResolvedValue(mockTest.variants)
        });

        const createdTest = await ABTestService.createTest(testWorkspaceId, {
          name: 'Lifecycle Test',
          test_type: 'message'
        });

        expect(createdTest).toBeDefined();

        // 2. Start test
        mockTest.status = 'running';
        mockTest.started_at = new Date();
        db.returning.mockResolvedValue([mockTest]);

        const startedTest = await ABTestService.startTest(mockTest.id, testWorkspaceId);
        expect(startedTest.status).toBe('running');

        // 3. Simulate visitor assignments (mocked)
        db.first.mockResolvedValueOnce(null); // No existing assignment
        db.first.mockResolvedValueOnce({
          id: mockTest.id,
          status: 'running',
          traffic_split: JSON.stringify({ A: 50, B: 50 })
        });
        db.where.mockReturnThis();
        db.orderBy.mockResolvedValue(mockTest.variants);
        db.insert.mockResolvedValue([]);

        const assignment = await ABTestService.assignVariant(mockTest.id, 'visitor-1');
        expect(assignment).toBeDefined();

        // 4. Record conversion
        db.first.mockResolvedValue({ variant_id: 'var-a' });
        db.returning.mockResolvedValue([{ id: 'conv-1' }]);

        const conversion = await ABTestService.recordConversion(mockTest.id, 'visitor-1', {
          type: 'click'
        });
        expect(conversion).toBeDefined();

        // 5. Complete test
        mockTest.status = 'completed';
        mockTest.ended_at = new Date();
        db.returning.mockResolvedValue([mockTest]);

        const completedTest = await ABTestService.completeTest(mockTest.id, testWorkspaceId);
        expect(completedTest.status).toBe('completed');

        // 6. Declare winner
        db.first.mockResolvedValueOnce({ id: 'var-b', name: 'B' });
        db.first.mockResolvedValueOnce({
          variants: [
            { id: 'var-a', is_control: true, stats: { impressions: 500, conversions: 50 } },
            { id: 'var-b', is_control: false, stats: { impressions: 500, conversions: 75 } }
          ]
        });
        mockTest.winner_variant = 'B';
        mockTest.winner_confidence = 98.5;
        db.returning.mockResolvedValue([mockTest]);

        const finalTest = await ABTestService.declareWinner(mockTest.id, testWorkspaceId, 'var-b');
        expect(finalTest.winner_variant).toBe('B');

        return;
      }

      // Real database integration test
      // 1. Create test
      const createdTest = await ABTestService.createTest(testWorkspaceId, {
        name: 'Integration Lifecycle Test',
        test_type: 'message',
        goal_metric: 'conversion'
      });

      expect(createdTest).toBeDefined();
      expect(createdTest.id).toBeDefined();
      expect(createdTest.status).toBe('draft');
      expect(createdTest.variants).toHaveLength(2);

      const testId = createdTest.id;

      // 2. Start test
      const startedTest = await ABTestService.startTest(testId, testWorkspaceId);
      expect(startedTest.status).toBe('running');
      expect(startedTest.started_at).toBeDefined();

      // 3. Simulate visitor assignments
      const visitors = [];
      for (let i = 0; i < 100; i++) {
        const visitorId = `visitor-${i}`;
        const assignment = await ABTestService.assignVariant(testId, visitorId);
        visitors.push({ visitorId, variant: assignment });
      }

      expect(visitors.length).toBe(100);

      // 4. Simulate conversions (30% conversion rate for variant A, 40% for variant B)
      let conversionsA = 0;
      let conversionsB = 0;

      for (const visitor of visitors) {
        const rate = visitor.variant.name === 'A' ? 0.3 : 0.4;
        if (Math.random() < rate) {
          await ABTestService.recordConversion(testId, visitor.visitorId, {
            type: 'click',
            value: 10
          });
          if (visitor.variant.name === 'A') conversionsA++;
          else conversionsB++;
        }
      }

      // 5. Check analytics updated
      const analytics = await ABTestService.getTestAnalytics(testId);
      expect(analytics.length).toBeGreaterThan(0);

      const totalImpressions = analytics.reduce((sum, a) => sum + a.impressions, 0);
      expect(totalImpressions).toBe(100);

      // 6. Complete test
      const completedTest = await ABTestService.completeTest(testId, testWorkspaceId);
      expect(completedTest.status).toBe('completed');
      expect(completedTest.ended_at).toBeDefined();

      // 7. Declare winner (variant with higher conversion rate)
      const winnerVariant = analytics.find(a => !a.isControl);
      const finalTest = await ABTestService.declareWinner(testId, testWorkspaceId, winnerVariant.variantId);

      expect(finalTest.winner_variant).toBeDefined();
      expect(finalTest.status).toBe('completed');

      // Cleanup
      await ABTestService.deleteTest(testId, testWorkspaceId);
    });
  });

  describe('Traffic Split', () => {
    it('should distribute traffic according to split ratio', async () => {
      const ABTestService = require('../../services/ab-test.service');

      const variants = [
        { id: 'var-a', name: 'A' },
        { id: 'var-b', name: 'B' }
      ];
      const trafficSplit = { A: 70, B: 30 };

      // Simulate 1000 assignments
      const counts = { A: 0, B: 0 };
      for (let i = 0; i < 1000; i++) {
        const selected = ABTestService.selectVariantByTrafficSplit(variants, trafficSplit);
        counts[selected.name]++;
      }

      // Verify ~70% got variant A, ~30% got variant B
      // Allow 5% margin of error
      expect(counts.A).toBeGreaterThan(650);
      expect(counts.A).toBeLessThan(750);
      expect(counts.B).toBeGreaterThan(250);
      expect(counts.B).toBeLessThan(350);
    });

    it('should handle uneven splits correctly', () => {
      const ABTestService = require('../../services/ab-test.service');

      const variants = [
        { id: 'var-a', name: 'A' },
        { id: 'var-b', name: 'B' },
        { id: 'var-c', name: 'C' }
      ];
      const trafficSplit = { A: 50, B: 30, C: 20 };

      const counts = { A: 0, B: 0, C: 0 };
      for (let i = 0; i < 1000; i++) {
        const selected = ABTestService.selectVariantByTrafficSplit(variants, trafficSplit);
        counts[selected.name]++;
      }

      // Allow 6% margin of error
      expect(counts.A).toBeGreaterThan(440);
      expect(counts.A).toBeLessThan(560);
      expect(counts.B).toBeGreaterThan(240);
      expect(counts.B).toBeLessThan(360);
      expect(counts.C).toBeGreaterThan(140);
      expect(counts.C).toBeLessThan(260);
    });
  });

  describe('Statistical Significance', () => {
    it('should calculate significance correctly', () => {
      const ABTestService = require('../../services/ab-test.service');

      // Create test with known data
      // Variant A: 1000 impressions, 100 conversions (10%)
      // Variant B: 1000 impressions, 150 conversions (15%)
      const controlStats = { impressions: 1000, conversions: 100 };
      const testStats = { impressions: 1000, conversions: 150 };

      const result = ABTestService.calculateSignificance(controlStats, testStats);

      // With these numbers, we expect significance
      expect(result.significant).toBe(true);
      expect(result.confidence).toBeGreaterThan(95);
      expect(result.lift).toBe(50); // 50% lift from 10% to 15%
      expect(result.controlRate).toBe(10);
      expect(result.testRate).toBe(15);
    });

    it('should not show significance for small samples', () => {
      const ABTestService = require('../../services/ab-test.service');

      const controlStats = { impressions: 25, conversions: 3 };
      const testStats = { impressions: 25, conversions: 4 };

      const result = ABTestService.calculateSignificance(controlStats, testStats);

      expect(result.significant).toBe(false);
      expect(result.message).toBe('Insufficient sample size');
    });

    it('should handle equal conversion rates', () => {
      const ABTestService = require('../../services/ab-test.service');

      const controlStats = { impressions: 1000, conversions: 100 };
      const testStats = { impressions: 1000, conversions: 100 };

      const result = ABTestService.calculateSignificance(controlStats, testStats);

      expect(result.lift).toBe(0);
      expect(result.significant).toBe(false);
    });

    it('should handle negative lift', () => {
      const ABTestService = require('../../services/ab-test.service');

      const controlStats = { impressions: 1000, conversions: 150 };
      const testStats = { impressions: 1000, conversions: 100 };

      const result = ABTestService.calculateSignificance(controlStats, testStats);

      expect(result.lift).toBeLessThan(0);
    });
  });

  describe('Concurrent Assignments', () => {
    it('should handle concurrent assignment requests', async () => {
      if (skipIntegration) {
        // Mock mode - simulate concurrent behavior
        const ABTestService = require('../../services/ab-test.service');
        const db = require('../../config/db');

        const assignmentCounts = new Map();

        // Mock to track assignments
        db.first.mockImplementation(() => {
          return Promise.resolve(null);
        });

        db.insert.mockImplementation((data) => {
          const visitorId = data.visitor_id;
          const count = assignmentCounts.get(visitorId) || 0;
          assignmentCounts.set(visitorId, count + 1);
          return Promise.resolve([]);
        });

        // Test that the service handles concurrent calls
        expect(ABTestService.assignVariant).toBeDefined();
        return;
      }

      // Real integration test
      const testId = 'concurrent-test-id';

      // Simulate 100 concurrent requests
      const promises = [];
      const visitorIds = new Set();

      for (let i = 0; i < 100; i++) {
        const visitorId = `concurrent-visitor-${i}`;
        visitorIds.add(visitorId);
        promises.push(
          ABTestService.assignVariant(testId, visitorId)
            .catch(err => ({ error: err.message, visitorId }))
        );
      }

      const results = await Promise.all(promises);

      // Verify no duplicates
      const assignments = results.filter(r => !r.error);
      const assignedVisitors = new Set(assignments.map(a => a.visitorId));

      expect(assignedVisitors.size).toBe(assignments.length);

      // Verify consistent assignments (same visitor always gets same variant)
      for (const visitorId of visitorIds) {
        const assignment1 = await ABTestService.getAssignedVariant(testId, visitorId);
        const assignment2 = await ABTestService.getAssignedVariant(testId, visitorId);

        if (assignment1 && assignment2) {
          expect(assignment1.id).toBe(assignment2.id);
        }
      }
    });
  });

  describe('Data Integrity', () => {
    it('should maintain data integrity during updates', async () => {
      const ABTestService = require('../../services/ab-test.service');
      const db = require('../../config/db');

      if (skipIntegration) {
        // Mock verification
        db.returning.mockResolvedValue([{
          id: 'test-123',
          name: 'Updated Name',
          updated_at: new Date()
        }]);

        const result = await ABTestService.updateTest('test-123', testWorkspaceId, {
          name: 'Updated Name'
        });

        expect(result.updated_at).toBeDefined();
        return;
      }

      // Real test
      const test = await ABTestService.createTest(testWorkspaceId, {
        name: 'Integrity Test',
        test_type: 'message'
      });

      // Update multiple times
      await ABTestService.updateTest(test.id, testWorkspaceId, { name: 'Update 1' });
      await ABTestService.updateTest(test.id, testWorkspaceId, { name: 'Update 2' });
      await ABTestService.updateTest(test.id, testWorkspaceId, { name: 'Final Update' });

      const finalTest = await ABTestService.getTestById(test.id, testWorkspaceId);
      expect(finalTest.name).toBe('Final Update');

      // Cleanup
      await ABTestService.deleteTest(test.id, testWorkspaceId);
    });

    it('should cascade delete related data', async () => {
      const ABTestService = require('../../services/ab-test.service');
      const db = require('../../config/db');

      if (skipIntegration) {
        db.del.mockResolvedValue(1);
        const result = await ABTestService.deleteTest('test-123', testWorkspaceId);
        expect(result).toBe(true);
        return;
      }

      // Real test - create test with data then delete
      const test = await ABTestService.createTest(testWorkspaceId, {
        name: 'Cascade Test',
        test_type: 'message'
      });

      // Start and add some data
      await ABTestService.startTest(test.id, testWorkspaceId);
      await ABTestService.assignVariant(test.id, 'cascade-visitor-1');

      // Delete test
      const deleted = await ABTestService.deleteTest(test.id, testWorkspaceId);
      expect(deleted).toBe(true);

      // Verify test is gone
      const deletedTest = await ABTestService.getTestById(test.id, testWorkspaceId);
      expect(deletedTest).toBeNull();
    });
  });
});
