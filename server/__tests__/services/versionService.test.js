/**
 * Version Service Tests
 * Tests for server/services/versionService.js
 */

jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const db = require('../../db');
const {
  createVersion,
  getVersions,
  getVersion,
  updateVersion,
  setActiveVersion,
  setProductionVersion,
  compareVersions,
  rollbackVersion,
  deleteVersion,
  getActiveVersion,
  getProductionVersion
} = require('../../services/versionService');

describe('Version Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createVersion', () => {
    it('should create first version as v1.0', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] }) // No previous versions
        .mockResolvedValueOnce({ rows: [{ model_id: 'ft:gpt-3.5' }] }) // Get model
        .mockResolvedValueOnce({ rows: [{ id: 1, version_number: 'v1.0' }] }) // Insert
        .mockResolvedValueOnce({}); // Set active

      const result = await createVersion(1, { description: 'First version' });

      expect(result.version_number).toBe('v1.0');
      expect(result.is_active).toBe(true);
    });

    it('should increment version number', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ version_number: 'v1.2' }] }) // Last version
        .mockResolvedValueOnce({ rows: [{ model_id: 'ft:gpt-3.5' }] }) // Get model
        .mockResolvedValueOnce({ rows: [{ id: 2, version_number: 'v1.3' }] }); // Insert

      const result = await createVersion(1, {});

      expect(result.version_number).toBe('v1.3');
    });

    it('should use custom version number', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ version_number: 'v1.0' }] }) // Last version
        .mockResolvedValueOnce({ rows: [{ model_id: 'ft:gpt-3.5' }] }) // Get model
        .mockResolvedValueOnce({ rows: [{ id: 2, version_number: 'v2.0' }] }); // Insert

      const result = await createVersion(1, { version_number: 'v2.0' });

      expect(result.version_number).toBe('v2.0');
    });

    it('should use provided openai_model_id', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] }) // No previous versions
        .mockResolvedValueOnce({ rows: [{ id: 1, version_number: 'v1.0' }] }) // Insert
        .mockResolvedValueOnce({}); // Set active

      await createVersion(1, { openai_model_id: 'ft:custom-model' });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO model_versions'),
        expect.arrayContaining(['ft:custom-model'])
      );
    });

    it('should handle invalid version format', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ version_number: 'invalid' }] }) // Last version with bad format
        .mockResolvedValueOnce({ rows: [{ model_id: 'ft:gpt-3.5' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, version_number: 'v1.0' }] });

      const result = await createVersion(1, {});

      expect(result.version_number).toBe('v1.0');
    });

    it('should throw on database error', async () => {
      db.query.mockRejectedValue(new Error('DB error'));

      await expect(createVersion(1, {}))
        .rejects.toThrow('DB error');
    });
  });

  describe('getVersions', () => {
    it('should return all versions for a model', async () => {
      db.query.mockResolvedValue({
        rows: [
          { id: 2, version_number: 'v1.1', model_name: 'Test Model' },
          { id: 1, version_number: 'v1.0', model_name: 'Test Model' }
        ]
      });

      const result = await getVersions(1);

      expect(result).toHaveLength(2);
      expect(result[0].version_number).toBe('v1.1');
    });

    it('should return empty array if no versions', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await getVersions(1);

      expect(result).toEqual([]);
    });
  });

  describe('getVersion', () => {
    it('should return version by ID', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, version_number: 'v1.0', model_name: 'Test', base_model: 'gpt-3.5' }]
      });

      const result = await getVersion(1);

      expect(result.id).toBe(1);
      expect(result.model_name).toBe('Test');
    });

    it('should return null if not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await getVersion(999);

      expect(result).toBeNull();
    });
  });

  describe('updateVersion', () => {
    it('should update version description', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, description: 'Updated description' }]
      });

      const result = await updateVersion(1, { description: 'Updated description' });

      expect(result.description).toBe('Updated description');
    });

    it('should update performance score', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, performance_score: 0.95 }]
      });

      const result = await updateVersion(1, { performance_score: 0.95 });

      expect(result.performance_score).toBe(0.95);
    });

    it('should update metrics', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, metrics: { loss: 0.3 } }]
      });

      const result = await updateVersion(1, { metrics: { loss: 0.3 } });

      expect(result.metrics).toEqual({ loss: 0.3 });
    });

    it('should return existing version if no updates', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, version_number: 'v1.0' }]
      });

      const result = await updateVersion(1, {});

      expect(db.query).toHaveBeenCalledTimes(1);
    });
  });

  describe('setActiveVersion', () => {
    it('should set version as active', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, fine_tune_model_id: 1 }] }) // getVersion
        .mockResolvedValueOnce({}) // Deactivate all
        .mockResolvedValueOnce({ rows: [{ id: 1, is_active: true }] }); // Activate

      const result = await setActiveVersion(1);

      expect(result.is_active).toBe(true);
    });

    it('should throw if version not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(setActiveVersion(999))
        .rejects.toThrow('Version not found');
    });
  });

  describe('setProductionVersion', () => {
    it('should set version as production', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, fine_tune_model_id: 1 }] }) // getVersion
        .mockResolvedValueOnce({}) // Remove production from all
        .mockResolvedValueOnce({ rows: [{ id: 1, is_production: true }] }); // Set production

      const result = await setProductionVersion(1);

      expect(result.is_production).toBe(true);
    });

    it('should throw if version not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(setProductionVersion(999))
        .rejects.toThrow('Version not found');
    });
  });

  describe('compareVersions', () => {
    it('should return empty array for empty input', async () => {
      const result = await compareVersions([]);
      expect(result).toEqual([]);
    });

    it('should return empty array for null input', async () => {
      const result = await compareVersions(null);
      expect(result).toEqual([]);
    });

    it('should compare multiple versions', async () => {
      db.query.mockResolvedValue({
        rows: [
          {
            id: 1,
            version_number: 'v1.0',
            description: 'First',
            is_active: true,
            is_production: false,
            performance_score: '0.85',
            metrics: { loss: 0.3 },
            created_at: new Date(),
            model_name: 'Test',
            base_model: 'gpt-3.5',
            avg_response_time: '150',
            avg_rating: '4.5',
            preference_count: '10'
          },
          {
            id: 2,
            version_number: 'v1.1',
            description: 'Second',
            is_active: false,
            is_production: true,
            performance_score: '0.90',
            metrics: { loss: 0.25 },
            created_at: new Date(),
            model_name: 'Test',
            base_model: 'gpt-3.5',
            avg_response_time: '140',
            avg_rating: '4.7',
            preference_count: '15'
          }
        ]
      });

      const result = await compareVersions([1, 2]);

      expect(result).toHaveLength(2);
      expect(result[0].performanceScore).toBe(0.85);
      expect(result[1].avgRating).toBe(4.7);
    });
  });

  describe('rollbackVersion', () => {
    it('should rollback to specified version', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, openai_model_id: 'ft:gpt-3.5:v1' }] }) // Verify version
        .mockResolvedValueOnce({ rows: [{ id: 1, fine_tune_model_id: 1 }] }) // setActiveVersion - getVersion
        .mockResolvedValueOnce({}) // Deactivate all
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Activate
        .mockResolvedValueOnce({ rows: [{ id: 1, fine_tune_model_id: 1 }] }) // setProductionVersion - getVersion
        .mockResolvedValueOnce({}) // Remove production from all
        .mockResolvedValueOnce({ rows: [{ id: 1, is_production: true }] }) // Set production
        .mockResolvedValueOnce({}); // Update model

      const result = await rollbackVersion(1, 1);

      expect(result.is_production).toBe(true);
    });

    it('should throw if version not found for model', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(rollbackVersion(1, 999))
        .rejects.toThrow('Version not found for this model');
    });
  });

  describe('deleteVersion', () => {
    it('should delete version', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 2, fine_tune_model_id: 1, is_active: false, is_production: false }] }) // getVersion
        .mockResolvedValueOnce({ rows: [{ count: '3' }] }) // Count versions
        .mockResolvedValueOnce({}); // Delete

      const result = await deleteVersion(2);

      expect(result).toBe(true);
    });

    it('should throw if version not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(deleteVersion(999))
        .rejects.toThrow('Version not found');
    });

    it('should throw if only version', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, fine_tune_model_id: 1 }] }) // getVersion
        .mockResolvedValueOnce({ rows: [{ count: '1' }] }); // Count versions

      await expect(deleteVersion(1))
        .rejects.toThrow('Cannot delete the only version');
    });

    it('should throw if active version', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, fine_tune_model_id: 1, is_active: true }] }) // getVersion
        .mockResolvedValueOnce({ rows: [{ count: '2' }] }); // Count versions

      await expect(deleteVersion(1))
        .rejects.toThrow('Cannot delete active or production version');
    });

    it('should throw if production version', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, fine_tune_model_id: 1, is_active: false, is_production: true }] })
        .mockResolvedValueOnce({ rows: [{ count: '2' }] });

      await expect(deleteVersion(1))
        .rejects.toThrow('Cannot delete active or production version');
    });
  });

  describe('getActiveVersion', () => {
    it('should return active version', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, version_number: 'v1.0', is_active: true }]
      });

      const result = await getActiveVersion(1);

      expect(result.is_active).toBe(true);
    });

    it('should return null if no active version', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await getActiveVersion(1);

      expect(result).toBeNull();
    });
  });

  describe('getProductionVersion', () => {
    it('should return production version', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, version_number: 'v1.0', is_production: true }]
      });

      const result = await getProductionVersion(1);

      expect(result.is_production).toBe(true);
    });

    it('should return null if no production version', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await getProductionVersion(1);

      expect(result).toBeNull();
    });
  });
});
