/**
 * Version Service Tests
 * Tests for model version management: create, update, activate, rollback
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
const versionService = require('../../services/versionService');

describe('Version Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ========================================
  // CREATE VERSION
  // ========================================
  describe('createVersion()', () => {
    it('should create version with auto-incremented number', async () => {
      // No existing versions
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ model_id: 'ft:gpt-3.5:test' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, version_number: 'v1.0', is_active: false }] })
        .mockResolvedValueOnce({ rowCount: 1 }); // Set active

      const result = await versionService.createVersion(1, {
        description: 'Initial version'
      });

      expect(result.version_number).toBe('v1.0');
      expect(result.is_active).toBe(true); // First version becomes active
    });

    it('should increment minor version', async () => {
      // Existing version v1.2
      db.query
        .mockResolvedValueOnce({ rows: [{ version_number: 'v1.2' }] })
        .mockResolvedValueOnce({ rows: [{ model_id: 'ft:gpt-3.5:test' }] })
        .mockResolvedValueOnce({ rows: [{ id: 2, version_number: 'v1.3', is_active: false }] });

      const result = await versionService.createVersion(1, {
        description: 'Minor update'
      });

      expect(result.version_number).toBe('v1.3');
    });

    it('should use provided version number', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 1, version_number: 'v2.0', is_active: false }] })
        .mockResolvedValueOnce({ rowCount: 1 });

      const result = await versionService.createVersion(1, {
        version_number: 'v2.0',
        description: 'Major update'
      });

      expect(result.version_number).toBe('v2.0');
    });

    it('should get openai_model_id from model if not provided', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ model_id: 'ft:gpt-3.5:custom' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, openai_model_id: 'ft:gpt-3.5:custom' }] })
        .mockResolvedValueOnce({ rowCount: 1 });

      await versionService.createVersion(1, { description: 'Test' });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO model_versions'),
        expect.arrayContaining(['ft:gpt-3.5:custom'])
      );
    });

    it('should use provided openai_model_id', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 1, openai_model_id: 'custom-id' }] })
        .mockResolvedValueOnce({ rowCount: 1 });

      await versionService.createVersion(1, {
        openai_model_id: 'custom-id'
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['custom-id'])
      );
    });

    it('should throw error on database failure', async () => {
      db.query.mockRejectedValueOnce(new Error('DB error'));

      await expect(
        versionService.createVersion(1, { description: 'Test' })
      ).rejects.toThrow('DB error');
    });
  });

  // ========================================
  // GET VERSIONS
  // ========================================
  describe('getVersions()', () => {
    it('should return all versions for model', async () => {
      const mockVersions = [
        { id: 1, version_number: 'v1.0', is_active: false, model_name: 'Test Model' },
        { id: 2, version_number: 'v1.1', is_active: true, model_name: 'Test Model' }
      ];

      db.query.mockResolvedValueOnce({ rows: mockVersions });

      const result = await versionService.getVersions(1);

      expect(result).toHaveLength(2);
      expect(result[0].version_number).toBe('v1.0');
    });

    it('should return empty array if no versions', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await versionService.getVersions(1);

      expect(result).toEqual([]);
    });

    it('should order by created_at DESC', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await versionService.getVersions(1);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY v.created_at DESC'),
        [1]
      );
    });
  });

  // ========================================
  // GET VERSION
  // ========================================
  describe('getVersion()', () => {
    it('should return single version', async () => {
      const mockVersion = {
        id: 1,
        version_number: 'v1.0',
        model_name: 'Test Model',
        base_model: 'gpt-3.5-turbo'
      };

      db.query.mockResolvedValueOnce({ rows: [mockVersion] });

      const result = await versionService.getVersion(1);

      expect(result).toEqual(mockVersion);
    });

    it('should return null if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await versionService.getVersion(999);

      expect(result).toBeNull();
    });
  });

  // ========================================
  // UPDATE VERSION
  // ========================================
  describe('updateVersion()', () => {
    it('should update description', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, description: 'Updated description' }]
      });

      const result = await versionService.updateVersion(1, {
        description: 'Updated description'
      });

      expect(result.description).toBe('Updated description');
    });

    it('should update performance_score', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, performance_score: 0.95 }]
      });

      const result = await versionService.updateVersion(1, {
        performance_score: 0.95
      });

      expect(result.performance_score).toBe(0.95);
    });

    it('should update metrics', async () => {
      const metrics = { loss: 0.25, accuracy: 0.92 };

      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, metrics }]
      });

      const result = await versionService.updateVersion(1, { metrics });

      expect(result.metrics).toEqual(metrics);
    });

    it('should return existing version if no updates', async () => {
      const mockVersion = { id: 1, version_number: 'v1.0' };

      db.query.mockResolvedValueOnce({ rows: [mockVersion] });

      const result = await versionService.updateVersion(1, {});

      expect(result).toEqual(mockVersion);
    });
  });

  // ========================================
  // SET ACTIVE VERSION
  // ========================================
  describe('setActiveVersion()', () => {
    it('should set version as active', async () => {
      // Get version
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, fine_tune_model_id: 1 }]
      });
      // Deactivate others
      db.query.mockResolvedValueOnce({ rowCount: 2 });
      // Activate this one
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, is_active: true }]
      });

      const result = await versionService.setActiveVersion(1);

      expect(result.is_active).toBe(true);
    });

    it('should throw error if version not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        versionService.setActiveVersion(999)
      ).rejects.toThrow('Version not found');
    });

    it('should deactivate other versions first', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, fine_tune_model_id: 5 }] })
        .mockResolvedValueOnce({ rowCount: 3 })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await versionService.setActiveVersion(1);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('SET is_active = false'),
        [5]
      );
    });
  });

  // ========================================
  // SET PRODUCTION VERSION
  // ========================================
  describe('setProductionVersion()', () => {
    it('should set version as production', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, fine_tune_model_id: 1 }] })
        .mockResolvedValueOnce({ rowCount: 2 })
        .mockResolvedValueOnce({ rows: [{ id: 1, is_production: true }] });

      const result = await versionService.setProductionVersion(1);

      expect(result.is_production).toBe(true);
    });

    it('should throw error if version not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        versionService.setProductionVersion(999)
      ).rejects.toThrow('Version not found');
    });

    it('should remove production flag from other versions', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, fine_tune_model_id: 5 }] })
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await versionService.setProductionVersion(1);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('SET is_production = false'),
        [5]
      );
    });
  });

  // ========================================
  // COMPARE VERSIONS
  // ========================================
  describe('compareVersions()', () => {
    it('should compare multiple versions', async () => {
      const mockComparison = [
        {
          id: 1,
          version_number: 'v1.0',
          description: 'Initial',
          is_active: false,
          is_production: false,
          performance_score: '0.85',
          metrics: { loss: 0.3 },
          created_at: new Date(),
          model_name: 'Test Model',
          base_model: 'gpt-3.5-turbo',
          avg_response_time: '150',
          avg_rating: '4.5',
          preference_count: '25'
        },
        {
          id: 2,
          version_number: 'v1.1',
          description: 'Improved',
          is_active: true,
          is_production: true,
          performance_score: '0.92',
          metrics: { loss: 0.25 },
          created_at: new Date(),
          model_name: 'Test Model',
          base_model: 'gpt-3.5-turbo',
          avg_response_time: '120',
          avg_rating: '4.8',
          preference_count: '40'
        }
      ];

      db.query.mockResolvedValueOnce({ rows: mockComparison });

      const result = await versionService.compareVersions([1, 2]);

      expect(result).toHaveLength(2);
      expect(result[0].performanceScore).toBe(0.85);
      expect(result[1].performanceScore).toBe(0.92);
      expect(result[0].avgResponseTime).toBe(150);
      expect(result[1].avgRating).toBe(4.8);
    });

    it('should return empty array for empty input', async () => {
      const result = await versionService.compareVersions([]);

      expect(result).toEqual([]);
      expect(db.query).not.toHaveBeenCalled();
    });

    it('should return empty array for null input', async () => {
      const result = await versionService.compareVersions(null);

      expect(result).toEqual([]);
    });
  });

  // ========================================
  // ROLLBACK VERSION
  // ========================================
  describe('rollbackVersion()', () => {
    it('should rollback to specified version', async () => {
      // Verify version belongs to model
      db.query.mockResolvedValueOnce({
        rows: [{ id: 5, fine_tune_model_id: 1, openai_model_id: 'ft:gpt-3.5:old' }]
      });
      // setActiveVersion - get version
      db.query.mockResolvedValueOnce({
        rows: [{ id: 5, fine_tune_model_id: 1 }]
      });
      // Deactivate others
      db.query.mockResolvedValueOnce({ rowCount: 2 });
      // Activate
      db.query.mockResolvedValueOnce({ rows: [{ id: 5, is_active: true }] });
      // setProductionVersion - get version
      db.query.mockResolvedValueOnce({
        rows: [{ id: 5, fine_tune_model_id: 1 }]
      });
      // Remove production from others
      db.query.mockResolvedValueOnce({ rowCount: 1 });
      // Set production
      db.query.mockResolvedValueOnce({ rows: [{ id: 5, is_production: true }] });
      // Update model
      db.query.mockResolvedValueOnce({ rowCount: 1 });

      const result = await versionService.rollbackVersion(1, 5);

      expect(result.is_production).toBe(true);
    });

    it('should throw error if version not found for model', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        versionService.rollbackVersion(1, 999)
      ).rejects.toThrow('Version not found for this model');
    });

    it('should update model with version openai_model_id', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 5, openai_model_id: 'ft:gpt-3.5:rollback' }] })
        .mockResolvedValueOnce({ rows: [{ id: 5, fine_tune_model_id: 1 }] })
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ id: 5 }] })
        .mockResolvedValueOnce({ rows: [{ id: 5, fine_tune_model_id: 1 }] })
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ id: 5 }] })
        .mockResolvedValueOnce({ rowCount: 1 });

      await versionService.rollbackVersion(1, 5);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE fine_tune_models SET model_id'),
        ['ft:gpt-3.5:rollback', 1]
      );
    });
  });

  // ========================================
  // DELETE VERSION
  // ========================================
  describe('deleteVersion()', () => {
    it('should delete version', async () => {
      // Get version
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, fine_tune_model_id: 1, is_active: false, is_production: false }]
      });
      // Count versions
      db.query.mockResolvedValueOnce({ rows: [{ count: '3' }] });
      // Delete
      db.query.mockResolvedValueOnce({ rowCount: 1 });

      const result = await versionService.deleteVersion(1);

      expect(result).toBe(true);
    });

    it('should throw error if version not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        versionService.deleteVersion(999)
      ).rejects.toThrow('Version not found');
    });

    it('should throw error if trying to delete only version', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, fine_tune_model_id: 1, is_active: false, is_production: false }]
      });
      db.query.mockResolvedValueOnce({ rows: [{ count: '1' }] });

      await expect(
        versionService.deleteVersion(1)
      ).rejects.toThrow('Cannot delete the only version');
    });

    it('should throw error if trying to delete active version', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, is_active: true, is_production: false }]
      });
      db.query.mockResolvedValueOnce({ rows: [{ count: '3' }] });

      await expect(
        versionService.deleteVersion(1)
      ).rejects.toThrow('Cannot delete active or production version');
    });

    it('should throw error if trying to delete production version', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, is_active: false, is_production: true }]
      });
      db.query.mockResolvedValueOnce({ rows: [{ count: '3' }] });

      await expect(
        versionService.deleteVersion(1)
      ).rejects.toThrow('Cannot delete active or production version');
    });
  });

  // ========================================
  // GET ACTIVE VERSION
  // ========================================
  describe('getActiveVersion()', () => {
    it('should return active version', async () => {
      const mockVersion = { id: 2, version_number: 'v1.1', is_active: true };

      db.query.mockResolvedValueOnce({ rows: [mockVersion] });

      const result = await versionService.getActiveVersion(1);

      expect(result).toEqual(mockVersion);
    });

    it('should return null if no active version', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await versionService.getActiveVersion(1);

      expect(result).toBeNull();
    });
  });

  // ========================================
  // GET PRODUCTION VERSION
  // ========================================
  describe('getProductionVersion()', () => {
    it('should return production version', async () => {
      const mockVersion = { id: 3, version_number: 'v2.0', is_production: true };

      db.query.mockResolvedValueOnce({ rows: [mockVersion] });

      const result = await versionService.getProductionVersion(1);

      expect(result).toEqual(mockVersion);
    });

    it('should return null if no production version', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await versionService.getProductionVersion(1);

      expect(result).toBeNull();
    });
  });
});
