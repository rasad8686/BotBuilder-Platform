/**
 * Tour Service Unit Tests
 */

const tourService = require('../../services/tour.service');

// Mock database
jest.mock('../../config/db', () => {
  const mockKnex = jest.fn(() => mockKnex);
  mockKnex.where = jest.fn(() => mockKnex);
  mockKnex.first = jest.fn(() => mockKnex);
  mockKnex.insert = jest.fn(() => mockKnex);
  mockKnex.update = jest.fn(() => mockKnex);
  mockKnex.del = jest.fn(() => mockKnex);
  mockKnex.returning = jest.fn(() => mockKnex);
  mockKnex.orderBy = jest.fn(() => mockKnex);
  mockKnex.limit = jest.fn(() => mockKnex);
  mockKnex.offset = jest.fn(() => mockKnex);
  mockKnex.clone = jest.fn(() => mockKnex);
  mockKnex.count = jest.fn(() => mockKnex);
  mockKnex.select = jest.fn(() => mockKnex);
  mockKnex.join = jest.fn(() => mockKnex);
  mockKnex.groupBy = jest.fn(() => mockKnex);
  mockKnex.max = jest.fn(() => mockKnex);
  mockKnex.increment = jest.fn(() => mockKnex);
  mockKnex.decrement = jest.fn(() => mockKnex);
  mockKnex.raw = jest.fn((sql) => sql);
  mockKnex.transaction = jest.fn();
  mockKnex.fn = { now: jest.fn(() => 'NOW()') };
  return mockKnex;
});

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-1234')
}));

const db = require('../../config/db');

describe('TourService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==================== CREATE TOUR ====================
  describe('createTour', () => {
    it('should create a tour with default settings', async () => {
      const mockTour = {
        id: 'test-uuid-1234',
        workspace_id: 'workspace-1',
        name: 'Welcome Tour',
        status: 'draft'
      };

      db.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([mockTour])
        })
      });

      const result = await tourService.createTour('workspace-1', {
        name: 'Welcome Tour'
      });

      expect(result).toEqual(mockTour);
      expect(db).toHaveBeenCalledWith('tours');
    });

    it('should create a tour with custom settings', async () => {
      const mockTour = {
        id: 'test-uuid-1234',
        workspace_id: 'workspace-1',
        name: 'Custom Tour',
        settings: { dismissible: false }
      };

      db.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([mockTour])
        })
      });

      const result = await tourService.createTour('workspace-1', {
        name: 'Custom Tour',
        settings: { dismissible: false },
        trigger_type: 'auto'
      });

      expect(result).toEqual(mockTour);
    });
  });

  // ==================== GET TOUR ====================
  describe('getTourById', () => {
    it('should return tour with steps and targeting', async () => {
      const mockTour = {
        id: 'tour-1',
        name: 'Welcome Tour',
        workspace_id: 'workspace-1'
      };

      const mockSteps = [
        { id: 'step-1', step_order: 1, title: 'Step 1' },
        { id: 'step-2', step_order: 2, title: 'Step 2' }
      ];

      const mockTargeting = [
        { id: 'target-1', target_type: 'url', value: '/dashboard' }
      ];

      db.mockReturnValueOnce({
        where: jest.fn().mockReturnValue({
          first: jest.fn().mockResolvedValue(mockTour)
        })
      });

      db.mockReturnValueOnce({
        where: jest.fn().mockReturnValue({
          orderBy: jest.fn().mockResolvedValue(mockSteps)
        })
      });

      db.mockReturnValueOnce({
        where: jest.fn().mockResolvedValue(mockTargeting)
      });

      const result = await tourService.getTourById('tour-1', 'workspace-1');

      expect(result).toEqual({
        ...mockTour,
        steps: mockSteps,
        targeting: mockTargeting
      });
    });

    it('should return null if tour not found', async () => {
      db.mockReturnValue({
        where: jest.fn().mockReturnValue({
          first: jest.fn().mockResolvedValue(null)
        })
      });

      const result = await tourService.getTourById('nonexistent', 'workspace-1');

      expect(result).toBeNull();
    });
  });

  // ==================== UPDATE TOUR ====================
  describe('updateTour', () => {
    it('should update tour fields', async () => {
      const mockUpdatedTour = {
        id: 'tour-1',
        name: 'Updated Tour Name',
        updated_at: new Date()
      };

      db.mockReturnValue({
        where: jest.fn().mockReturnValue({
          update: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([mockUpdatedTour])
          })
        })
      });

      const result = await tourService.updateTour('tour-1', 'workspace-1', {
        name: 'Updated Tour Name'
      });

      expect(result).toEqual(mockUpdatedTour);
    });
  });

  // ==================== DELETE TOUR ====================
  describe('deleteTour', () => {
    it('should delete tour and return true', async () => {
      db.mockReturnValue({
        where: jest.fn().mockReturnValue({
          del: jest.fn().mockResolvedValue(1)
        })
      });

      const result = await tourService.deleteTour('tour-1', 'workspace-1');

      expect(result).toBe(true);
    });

    it('should return false if tour not found', async () => {
      db.mockReturnValue({
        where: jest.fn().mockReturnValue({
          del: jest.fn().mockResolvedValue(0)
        })
      });

      const result = await tourService.deleteTour('nonexistent', 'workspace-1');

      expect(result).toBe(false);
    });
  });

  // ==================== DUPLICATE TOUR ====================
  describe('duplicateTour', () => {
    it('should duplicate tour with steps and targeting', async () => {
      const originalTour = {
        id: 'tour-1',
        name: 'Original Tour',
        workspace_id: 'workspace-1',
        description: 'Test description',
        settings: { dismissible: true },
        theme: { primaryColor: '#000' },
        trigger_type: 'manual',
        trigger_config: null,
        priority: 1,
        steps: [
          { id: 'step-1', step_order: 1, title: 'Step 1', content: 'Content 1' }
        ],
        targeting: [
          { id: 'target-1', target_type: 'url', value: '/home' }
        ]
      };

      // Mock getTourById
      jest.spyOn(tourService, 'getTourById').mockResolvedValue(originalTour);

      // Mock insert operations
      db.mockReturnValue({
        insert: jest.fn().mockResolvedValue([1])
      });

      const duplicatedTour = {
        ...originalTour,
        id: 'test-uuid-1234',
        name: 'Original Tour (Copy)',
        status: 'draft'
      };

      jest.spyOn(tourService, 'getTourById')
        .mockResolvedValueOnce(originalTour)
        .mockResolvedValueOnce(duplicatedTour);

      const result = await tourService.duplicateTour('tour-1', 'workspace-1');

      expect(result.name).toBe('Original Tour (Copy)');
    });

    it('should return null if original tour not found', async () => {
      jest.spyOn(tourService, 'getTourById').mockResolvedValue(null);

      const result = await tourService.duplicateTour('nonexistent', 'workspace-1');

      expect(result).toBeNull();
    });
  });

  // ==================== PUBLISH TOUR ====================
  describe('publishTour', () => {
    it('should set tour status to active', async () => {
      const mockTour = {
        id: 'tour-1',
        status: 'active',
        published_at: new Date()
      };

      db.mockReturnValue({
        where: jest.fn().mockReturnValue({
          update: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([mockTour])
          })
        })
      });

      const result = await tourService.publishTour('tour-1', 'workspace-1');

      expect(result.status).toBe('active');
      expect(result.published_at).toBeDefined();
    });
  });

  // ==================== PAUSE TOUR ====================
  describe('pauseTour', () => {
    it('should set tour status to paused', async () => {
      const mockTour = {
        id: 'tour-1',
        status: 'paused'
      };

      db.mockReturnValue({
        where: jest.fn().mockReturnValue({
          update: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([mockTour])
          })
        })
      });

      const result = await tourService.pauseTour('tour-1', 'workspace-1');

      expect(result.status).toBe('paused');
    });
  });

  // ==================== ADD STEP ====================
  describe('createStep', () => {
    it('should add step with correct order', async () => {
      const mockStep = {
        id: 'test-uuid-1234',
        tour_id: 'tour-1',
        step_order: 3,
        title: 'New Step'
      };

      db.mockReturnValueOnce({
        where: jest.fn().mockReturnValue({
          max: jest.fn().mockReturnValue({
            first: jest.fn().mockResolvedValue({ max: 2 })
          })
        })
      });

      db.mockReturnValueOnce({
        insert: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([mockStep])
        })
      });

      db.mockReturnValueOnce({
        where: jest.fn().mockReturnValue({
          update: jest.fn().mockResolvedValue(1)
        })
      });

      const result = await tourService.createStep('tour-1', {
        title: 'New Step',
        content: 'Step content'
      });

      expect(result.step_order).toBe(3);
    });
  });

  // ==================== UPDATE STEP ====================
  describe('updateStep', () => {
    it('should update step fields', async () => {
      const mockStep = {
        id: 'step-1',
        title: 'Updated Title',
        content: 'Updated Content'
      };

      db.mockReturnValueOnce({
        where: jest.fn().mockReturnValue({
          update: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([mockStep])
          })
        })
      });

      db.mockReturnValueOnce({
        where: jest.fn().mockReturnValue({
          update: jest.fn().mockResolvedValue(1)
        })
      });

      const result = await tourService.updateStep('tour-1', 'step-1', {
        title: 'Updated Title',
        content: 'Updated Content'
      });

      expect(result.title).toBe('Updated Title');
    });
  });

  // ==================== DELETE STEP ====================
  describe('deleteStep', () => {
    it('should delete step and reorder remaining', async () => {
      const mockStep = { id: 'step-2', step_order: 2 };

      db.mockReturnValueOnce({
        where: jest.fn().mockReturnValue({
          first: jest.fn().mockResolvedValue(mockStep)
        })
      });

      db.mockReturnValueOnce({
        where: jest.fn().mockReturnValue({
          del: jest.fn().mockResolvedValue(1)
        })
      });

      db.mockReturnValueOnce({
        where: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            decrement: jest.fn().mockResolvedValue(1)
          })
        })
      });

      db.mockReturnValueOnce({
        where: jest.fn().mockReturnValue({
          update: jest.fn().mockResolvedValue(1)
        })
      });

      const result = await tourService.deleteStep('tour-1', 'step-2');

      expect(result).toBe(true);
    });

    it('should return false if step not found', async () => {
      db.mockReturnValue({
        where: jest.fn().mockReturnValue({
          first: jest.fn().mockResolvedValue(null)
        })
      });

      const result = await tourService.deleteStep('tour-1', 'nonexistent');

      expect(result).toBe(false);
    });
  });

  // ==================== REORDER STEPS ====================
  describe('reorderSteps', () => {
    it('should reorder steps according to new order', async () => {
      const mockTransaction = {
        commit: jest.fn(),
        rollback: jest.fn()
      };
      mockTransaction.mockReturnValue = mockTransaction;

      db.transaction = jest.fn().mockResolvedValue(mockTransaction);

      const mockSteps = [
        { id: 'step-3', step_order: 1 },
        { id: 'step-1', step_order: 2 },
        { id: 'step-2', step_order: 3 }
      ];

      jest.spyOn(tourService, 'getSteps').mockResolvedValue(mockSteps);

      const result = await tourService.reorderSteps('tour-1', ['step-3', 'step-1', 'step-2']);

      expect(result).toEqual(mockSteps);
    });
  });
});
