/**
 * CloneBackup Service Tests
 */

// Mock dependencies
jest.mock('../../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

const db = require('../../../db');
const CloneBackup = require('../../../services/clone/CloneBackup');

describe('CloneBackup Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createBackup', () => {
    const mockClone = {
      id: 'clone-123',
      user_id: 'user-456',
      name: 'Test Clone',
      type: 'personality',
      config: { traits: { openness: 0.8 } },
      status: 'active',
      created_at: new Date('2025-01-01'),
      updated_at: new Date('2025-01-15')
    };

    const mockTrainingData = [
      { id: 'train-1', input: 'Hello', output: 'Hi!' }
    ];

    it('should create backup successfully', async () => {
      const newBackup = {
        id: 'backup-123',
        clone_id: 'clone-123',
        created_at: new Date()
      };

      db.query
        .mockResolvedValueOnce({ rows: [mockClone] })
        .mockResolvedValueOnce({ rows: mockTrainingData })
        .mockResolvedValueOnce({ rows: [newBackup] });

      const result = await CloneBackup.createBackup('clone-123', 'user-456', {
        description: 'Manual backup'
      });

      expect(result.success).toBe(true);
      expect(result.backup).toBeDefined();
      expect(result.backup.id).toBe('backup-123');
    });

    it('should include training data in backup', async () => {
      const newBackup = {
        id: 'backup-456',
        clone_id: 'clone-123',
        includes_training_data: true
      };

      db.query
        .mockResolvedValueOnce({ rows: [mockClone] })
        .mockResolvedValueOnce({ rows: mockTrainingData })
        .mockResolvedValueOnce({ rows: [newBackup] })
        .mockResolvedValueOnce({ rows: [{ count: 1 }] }); // cleanup check

      const result = await CloneBackup.createBackup('clone-123', 'user-456', {
        includeTrainingData: true
      });

      expect(result.success).toBe(true);
      expect(db.query).toHaveBeenCalled();
    });

    it('should reject backup for non-owned clone', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await CloneBackup.createBackup('clone-123', 'wrong-user', {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should handle database errors', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const result = await CloneBackup.createBackup('clone-123', 'user-456', {});

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });
  });

  describe('listBackups', () => {
    const mockBackups = [
      { id: 'backup-1', clone_id: 'clone-123', created_at: new Date('2025-01-15'), size_bytes: 1024 },
      { id: 'backup-2', clone_id: 'clone-123', created_at: new Date('2025-01-10'), size_bytes: 2048 }
    ];

    it('should list backups for a clone', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 'clone-123', user_id: 'user-456' }] })
        .mockResolvedValueOnce({ rows: mockBackups });

      const result = await CloneBackup.listBackups('clone-123', 'user-456');

      expect(result.success).toBe(true);
      expect(result.backups).toHaveLength(2);
      expect(result.backups[0].id).toBe('backup-1');
    });

    it('should return empty list for clone with no backups', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 'clone-123', user_id: 'user-456' }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await CloneBackup.listBackups('clone-123', 'user-456');

      expect(result.success).toBe(true);
      expect(result.backups).toHaveLength(0);
    });

    it('should reject for non-owned clone', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await CloneBackup.listBackups('clone-123', 'wrong-user');

      expect(result.success).toBe(false);
    });
  });

  describe('restoreBackup', () => {
    const mockBackup = {
      id: 'backup-123',
      clone_id: 'clone-123',
      data: JSON.stringify({
        clone: { name: 'Restored Clone', config: { traits: {} } },
        trainingData: []
      })
    };

    it('should restore backup successfully', async () => {
      const restoredClone = {
        id: 'clone-123',
        name: 'Restored Clone',
        status: 'active'
      };

      db.query
        .mockResolvedValueOnce({ rows: [{ id: 'clone-123', user_id: 'user-456' }] })
        .mockResolvedValueOnce({ rows: [mockBackup] })
        .mockResolvedValueOnce({ rows: [restoredClone] });

      const result = await CloneBackup.restoreBackup('clone-123', 'backup-123', 'user-456', {});

      expect(result.success).toBe(true);
      expect(result.clone).toBeDefined();
    });

    it('should create new clone from backup', async () => {
      const newClone = {
        id: 'new-clone-789',
        name: 'Restored Clone (Copy)'
      };

      db.query
        .mockResolvedValueOnce({ rows: [{ id: 'clone-123', user_id: 'user-456' }] })
        .mockResolvedValueOnce({ rows: [mockBackup] })
        .mockResolvedValueOnce({ rows: [{ organization_id: 'org-1' }] }) // get org ID
        .mockResolvedValueOnce({ rows: [newClone] });

      const result = await CloneBackup.restoreBackup('clone-123', 'backup-123', 'user-456', {
        createNew: true
      });

      expect(result.success).toBe(true);
      expect(result.clone.id).toBe('new-clone-789');
    });

    it('should reject restoring non-existent backup', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 'clone-123', user_id: 'user-456' }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await CloneBackup.restoreBackup('clone-123', 'invalid-backup', 'user-456', {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should restore with training data', async () => {
      const backupWithTraining = {
        ...mockBackup,
        data: JSON.stringify({
          clone: { name: 'Clone', config: {} },
          trainingData: [
            { input: 'Hello', output: 'Hi!' }
          ]
        })
      };

      db.query
        .mockResolvedValueOnce({ rows: [{ id: 'clone-123', user_id: 'user-456' }] })
        .mockResolvedValueOnce({ rows: [backupWithTraining] })
        .mockResolvedValueOnce({ rows: [{ id: 'clone-123' }] })
        .mockResolvedValueOnce({ rows: [] }); // Training data restore

      const result = await CloneBackup.restoreBackup('clone-123', 'backup-123', 'user-456', {
        includeTrainingData: true
      });

      expect(result.success).toBe(true);
    });
  });

  describe('deleteBackup', () => {
    it('should delete backup successfully', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 'clone-123', user_id: 'user-456' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'backup-123' }] });

      const result = await CloneBackup.deleteBackup('clone-123', 'backup-123', 'user-456');

      expect(result.success).toBe(true);
    });

    it('should reject deleting non-existent backup', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 'clone-123', user_id: 'user-456' }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await CloneBackup.deleteBackup('clone-123', 'invalid-backup', 'user-456');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('getBackupDetails', () => {
    const mockBackup = {
      id: 'backup-123',
      clone_id: 'clone-123',
      description: 'Test backup',
      size_bytes: 5120,
      created_at: new Date('2025-01-15'),
      includes_training_data: true,
      data: JSON.stringify({ clone: { name: 'Test' } })
    };

    it('should return backup details', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 'clone-123', user_id: 'user-456' }] })
        .mockResolvedValueOnce({ rows: [mockBackup] });

      const result = await CloneBackup.getBackupDetails('clone-123', 'backup-123', 'user-456');

      expect(result.success).toBe(true);
      expect(result.backup).toBeDefined();
      expect(result.backup.description).toBe('Test backup');
      expect(result.backup.sizeBytes).toBe(5120);
    });

    it('should include preview of backup data', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 'clone-123', user_id: 'user-456' }] })
        .mockResolvedValueOnce({ rows: [mockBackup] });

      const result = await CloneBackup.getBackupDetails('clone-123', 'backup-123', 'user-456', {
        includePreview: true
      });

      expect(result.success).toBe(true);
      expect(result.backup.preview).toBeDefined();
    });
  });

  describe('cleanupOldBackups', () => {
    it('should delete backups older than retention period', async () => {
      const oldBackups = [
        { id: 'old-backup-1' },
        { id: 'old-backup-2' }
      ];

      db.query.mockResolvedValueOnce({ rows: oldBackups });

      const result = await CloneBackup.cleanupOldBackups('user-456', {
        retentionDays: 30,
        maxBackupsPerClone: 10
      });

      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(2);
    });

    it('should respect max backups per clone limit', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 'excess-backup' }] });

      const result = await CloneBackup.cleanupOldBackups('user-456', {
        maxBackupsPerClone: 5
      });

      expect(result.success).toBe(true);
    });

    it('should handle no backups to clean', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await CloneBackup.cleanupOldBackups('user-456', {});

      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(0);
    });
  });

  describe('scheduleAutoBackup', () => {
    it('should schedule automatic backup', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 'clone-123', user_id: 'user-456' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'schedule-1', clone_id: 'clone-123' }] });

      const result = await CloneBackup.scheduleAutoBackup('clone-123', 'user-456', {
        frequency: 'daily',
        retentionCount: 7
      });

      expect(result.success).toBe(true);
      expect(result.schedule).toBeDefined();
    });

    it('should update existing schedule', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 'clone-123', user_id: 'user-456' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'schedule-1', frequency: 'weekly' }] });

      const result = await CloneBackup.scheduleAutoBackup('clone-123', 'user-456', {
        frequency: 'weekly',
        retentionCount: 4
      });

      expect(result.success).toBe(true);
    });

    it('should disable auto backup when frequency is none', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 'clone-123', user_id: 'user-456' }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await CloneBackup.scheduleAutoBackup('clone-123', 'user-456', {
        frequency: 'none'
      });

      expect(result.success).toBe(true);
      expect(result.schedule).toBeNull();
    });
  });

  describe('getStorageUsage', () => {
    it('should return storage usage statistics', async () => {
      const mockUsage = {
        total_backups: 15,
        total_size_bytes: 52428800,
        clones_with_backups: 5
      };

      db.query.mockResolvedValueOnce({ rows: [mockUsage] });

      const result = await CloneBackup.getStorageUsage('user-456');

      expect(result.success).toBe(true);
      expect(result.usage).toBeDefined();
      expect(result.usage.totalBackups).toBe(15);
      expect(result.usage.totalSizeBytes).toBe(52428800);
      expect(result.usage.totalSizeMB).toBeCloseTo(50, 0);
    });

    it('should return zero for users with no backups', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ total_backups: 0, total_size_bytes: 0 }] });

      const result = await CloneBackup.getStorageUsage('user-456');

      expect(result.success).toBe(true);
      expect(result.usage.totalBackups).toBe(0);
    });
  });
});
