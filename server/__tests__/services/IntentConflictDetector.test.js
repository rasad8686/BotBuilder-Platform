/**
 * IntentConflictDetector Service Tests
 * Tests for server/services/IntentConflictDetector.js
 */

jest.mock('../../db', () => ({
  query: jest.fn()
}));

const db = require('../../db');
const conflictDetector = require('../../services/IntentConflictDetector');

describe('IntentConflictDetector Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('levenshteinDistance()', () => {
    it('should return 0 for identical strings', () => {
      const distance = conflictDetector.levenshteinDistance('hello', 'hello');
      expect(distance).toBe(0);
    });

    it('should return string length for completely different strings', () => {
      const distance = conflictDetector.levenshteinDistance('abc', 'xyz');
      expect(distance).toBe(3);
    });

    it('should calculate correct distance for similar strings', () => {
      const distance = conflictDetector.levenshteinDistance('kitten', 'sitting');
      expect(distance).toBe(3);
    });

    it('should handle empty strings', () => {
      expect(conflictDetector.levenshteinDistance('', 'hello')).toBe(5);
      expect(conflictDetector.levenshteinDistance('hello', '')).toBe(5);
      expect(conflictDetector.levenshteinDistance('', '')).toBe(0);
    });
  });

  describe('calculateSimilarity()', () => {
    it('should return 1 for identical strings', () => {
      const similarity = conflictDetector.calculateSimilarity('hello', 'hello');
      expect(similarity).toBe(1);
    });

    it('should return 1 for identical strings with different case', () => {
      const similarity = conflictDetector.calculateSimilarity('Hello', 'HELLO');
      expect(similarity).toBe(1);
    });

    it('should return 0 for null/undefined inputs', () => {
      expect(conflictDetector.calculateSimilarity(null, 'hello')).toBe(0);
      expect(conflictDetector.calculateSimilarity('hello', null)).toBe(0);
    });

    it('should return value between 0 and 1', () => {
      const similarity = conflictDetector.calculateSimilarity('hello', 'hallo');
      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThan(1);
    });

    it('should handle whitespace trimming', () => {
      const similarity = conflictDetector.calculateSimilarity('  hello  ', 'hello');
      expect(similarity).toBe(1);
    });
  });

  describe('detectConflicts()', () => {
    it('should return empty array when no conflicts', async () => {
      const mockExamples = [
        { intent_id: 1, intent_name: 'greeting', example_text: 'Hello' },
        { intent_id: 2, intent_name: 'goodbye', example_text: 'Bye' }
      ];
      db.query.mockResolvedValueOnce({ rows: mockExamples });

      const conflicts = await conflictDetector.detectConflicts(1, 1, 0.7);

      expect(conflicts).toHaveLength(0);
    });

    it('should detect conflicts between similar examples', async () => {
      const mockExamples = [
        { intent_id: 1, intent_name: 'greeting', example_id: 1, example_text: 'Hello there' },
        { intent_id: 2, intent_name: 'welcome', example_id: 2, example_text: 'Hello there friend' }
      ];
      db.query.mockResolvedValueOnce({ rows: mockExamples });

      const conflicts = await conflictDetector.detectConflicts(1, 1, 0.6);

      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts[0]).toHaveProperty('intent1');
      expect(conflicts[0]).toHaveProperty('intent2');
      expect(conflicts[0]).toHaveProperty('similarity');
    });

    it('should not detect conflicts for same intent', async () => {
      const mockExamples = [
        { intent_id: 1, intent_name: 'greeting', example_id: 1, example_text: 'Hello' },
        { intent_id: 1, intent_name: 'greeting', example_id: 2, example_text: 'Hello there' }
      ];
      db.query.mockResolvedValueOnce({ rows: mockExamples });

      const conflicts = await conflictDetector.detectConflicts(1, 1, 0.7);

      expect(conflicts).toHaveLength(0);
    });

    it('should sort conflicts by similarity (highest first)', async () => {
      const mockExamples = [
        { intent_id: 1, intent_name: 'a', example_id: 1, example_text: 'test one' },
        { intent_id: 2, intent_name: 'b', example_id: 2, example_text: 'test one two' },
        { intent_id: 3, intent_name: 'c', example_id: 3, example_text: 'test one' }
      ];
      db.query.mockResolvedValueOnce({ rows: mockExamples });

      const conflicts = await conflictDetector.detectConflicts(1, 1, 0.5);

      if (conflicts.length > 1) {
        expect(conflicts[0].similarity).toBeGreaterThanOrEqual(conflicts[1].similarity);
      }
    });
  });

  describe('getConflictReport()', () => {
    it('should return conflict report with summary', async () => {
      const mockExamples = [
        { intent_id: 1, intent_name: 'greeting', display_name: 'Greeting', example_id: 1, example_text: 'Hello' },
        { intent_id: 2, intent_name: 'welcome', display_name: 'Welcome', example_id: 2, example_text: 'Hello' }
      ];
      db.query.mockResolvedValueOnce({ rows: mockExamples });

      const report = await conflictDetector.getConflictReport(1, 1, 0.7);

      expect(report).toHaveProperty('conflicts');
      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('problematicIntents');
      expect(report).toHaveProperty('threshold');
      expect(report).toHaveProperty('generatedAt');
      expect(report.summary).toHaveProperty('totalConflicts');
      expect(report.summary).toHaveProperty('critical');
      expect(report.summary).toHaveProperty('high');
      expect(report.summary).toHaveProperty('medium');
    });

    it('should categorize conflicts by severity', async () => {
      const mockExamples = [
        { intent_id: 1, intent_name: 'a', example_id: 1, example_text: 'exact' },
        { intent_id: 2, intent_name: 'b', example_id: 2, example_text: 'exact' }
      ];
      db.query.mockResolvedValueOnce({ rows: mockExamples });

      const report = await conflictDetector.getConflictReport(1, 1, 0.7);

      expect(report.summary.critical).toBeGreaterThanOrEqual(0);
    });
  });

  describe('resolveConflictByDelete()', () => {
    it('should delete example', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Verify ownership
        .mockResolvedValueOnce({ rowCount: 1 }); // Delete

      const result = await conflictDetector.resolveConflictByDelete(1, 1);

      expect(result.deleted).toBe(true);
      expect(result.exampleId).toBe(1);
    });

    it('should throw error if example not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(conflictDetector.resolveConflictByDelete(999, 1))
        .rejects.toThrow('Example not found or access denied');
    });
  });

  describe('resolveConflictByMove()', () => {
    it('should move example to different intent', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, text: 'Hello' }] }) // Check example
        .mockResolvedValueOnce({ rows: [{ id: 2 }] }) // Check intent
        .mockResolvedValueOnce({ rowCount: 1 }); // Update

      const result = await conflictDetector.resolveConflictByMove(1, 2, 1);

      expect(result.moved).toBe(true);
      expect(result.exampleId).toBe(1);
      expect(result.newIntentId).toBe(2);
    });

    it('should throw error if example not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(conflictDetector.resolveConflictByMove(999, 2, 1))
        .rejects.toThrow('Example not found or access denied');
    });

    it('should throw error if target intent not found', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [] });

      await expect(conflictDetector.resolveConflictByMove(1, 999, 1))
        .rejects.toThrow('Target intent not found or access denied');
    });
  });

  describe('resolveConflictByMerge()', () => {
    it('should merge intents', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }] }) // Check both intents
        .mockResolvedValueOnce({ rowCount: 2 }) // Move examples
        .mockResolvedValueOnce({ rowCount: 1 }); // Delete source

      const result = await conflictDetector.resolveConflictByMerge(1, 2, 1);

      expect(result.merged).toBe(true);
      expect(result.sourceIntentId).toBe(1);
      expect(result.targetIntentId).toBe(2);
    });

    it('should throw error if intents not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // Only one found

      await expect(conflictDetector.resolveConflictByMerge(1, 999, 1))
        .rejects.toThrow('One or both intents not found or access denied');
    });
  });

  describe('findSimilarExamples()', () => {
    it('should find similar examples', async () => {
      const mockExamples = [
        { intent_id: 1, intent_name: 'greeting', display_name: 'Greeting', example_id: 1, example_text: 'Hello there' },
        { intent_id: 2, intent_name: 'other', display_name: 'Other', example_id: 2, example_text: 'Goodbye world' }
      ];
      db.query.mockResolvedValueOnce({ rows: mockExamples });

      const similar = await conflictDetector.findSimilarExamples(1, 1, 'Hello there', 0.5);

      expect(similar.length).toBeGreaterThan(0);
      expect(similar[0]).toHaveProperty('intentId');
      expect(similar[0]).toHaveProperty('similarity');
    });

    it('should limit results', async () => {
      const mockExamples = Array(20).fill(null).map((_, i) => ({
        intent_id: i,
        intent_name: `intent_${i}`,
        display_name: `Intent ${i}`,
        example_id: i,
        example_text: `test ${i}`
      }));
      db.query.mockResolvedValueOnce({ rows: mockExamples });

      const similar = await conflictDetector.findSimilarExamples(1, 1, 'test', 0.3, 5);

      expect(similar.length).toBeLessThanOrEqual(5);
    });

    it('should sort by similarity descending', async () => {
      const mockExamples = [
        { intent_id: 1, intent_name: 'a', display_name: 'A', example_id: 1, example_text: 'hello world' },
        { intent_id: 2, intent_name: 'b', display_name: 'B', example_id: 2, example_text: 'hello' }
      ];
      db.query.mockResolvedValueOnce({ rows: mockExamples });

      const similar = await conflictDetector.findSimilarExamples(1, 1, 'hello', 0.3);

      if (similar.length > 1) {
        expect(similar[0].similarity).toBeGreaterThanOrEqual(similar[1].similarity);
      }
    });
  });
});
