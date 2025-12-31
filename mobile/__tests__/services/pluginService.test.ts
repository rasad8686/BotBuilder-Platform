import { pluginService } from '../../src/services/pluginService';
import api from '../../src/services/api';

jest.mock('../../src/services/api');

const mockApi = api as jest.Mocked<typeof api>;

describe('PluginService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getMarketplacePlugins', () => {
    it('should fetch marketplace plugins successfully', async () => {
      const mockPlugins = {
        data: [
          {
            id: '1',
            name: 'Analytics Plugin',
            category: 'analytics',
            rating: 4.5,
            downloads: 1000,
            price: 0,
            isInstalled: false,
          },
        ],
        total: 1,
      };

      mockApi.get.mockResolvedValueOnce({ data: mockPlugins });

      const result = await pluginService.getMarketplacePlugins();

      expect(mockApi.get).toHaveBeenCalledWith('/plugins/marketplace', { params: undefined });
      expect(result).toEqual(mockPlugins);
    });

    it('should filter by category', async () => {
      const params = { category: 'ai', sort: 'popular' as const };
      mockApi.get.mockResolvedValueOnce({ data: { data: [], total: 0 } });

      await pluginService.getMarketplacePlugins(params);

      expect(mockApi.get).toHaveBeenCalledWith('/plugins/marketplace', { params });
    });
  });

  describe('getPlugin', () => {
    it('should fetch a single plugin', async () => {
      const mockPlugin = {
        id: '1',
        name: 'Analytics Plugin',
        description: 'Track your bot metrics',
      };

      mockApi.get.mockResolvedValueOnce({ data: mockPlugin });

      const result = await pluginService.getPlugin('1');

      expect(mockApi.get).toHaveBeenCalledWith('/plugins/1');
      expect(result).toEqual(mockPlugin);
    });
  });

  describe('getPluginReviews', () => {
    it('should fetch plugin reviews', async () => {
      const mockReviews = {
        data: [
          { id: 'r1', rating: 5, comment: 'Great plugin!', userName: 'User1' },
        ],
        total: 1,
      };

      mockApi.get.mockResolvedValueOnce({ data: mockReviews });

      const result = await pluginService.getPluginReviews('1');

      expect(mockApi.get).toHaveBeenCalledWith('/plugins/1/reviews', { params: undefined });
      expect(result.data).toHaveLength(1);
    });
  });

  describe('getInstalledPlugins', () => {
    it('should fetch installed plugins', async () => {
      const mockPlugins = {
        data: [
          { id: '1', name: 'Installed Plugin', isInstalled: true, isEnabled: true },
        ],
      };

      mockApi.get.mockResolvedValueOnce({ data: mockPlugins });

      const result = await pluginService.getInstalledPlugins();

      expect(mockApi.get).toHaveBeenCalledWith('/plugins/installed');
      expect(result.data[0].isInstalled).toBe(true);
    });
  });

  describe('installPlugin', () => {
    it('should install a plugin successfully', async () => {
      const mockResult = { status: 'installed', plugin: { id: '1', isInstalled: true } };
      mockApi.post.mockResolvedValueOnce({ data: mockResult });

      const result = await pluginService.installPlugin('1');

      expect(mockApi.post).toHaveBeenCalledWith('/plugins/1/install');
      expect(result.status).toBe('installed');
    });
  });

  describe('uninstallPlugin', () => {
    it('should uninstall a plugin successfully', async () => {
      mockApi.delete.mockResolvedValueOnce({ data: { status: 'uninstalled' } });

      const result = await pluginService.uninstallPlugin('1');

      expect(mockApi.delete).toHaveBeenCalledWith('/plugins/1/uninstall');
      expect(result.status).toBe('uninstalled');
    });
  });

  describe('togglePlugin', () => {
    it('should enable a plugin', async () => {
      mockApi.patch.mockResolvedValueOnce({ data: { status: 'enabled' } });

      const result = await pluginService.togglePlugin('1', true);

      expect(mockApi.patch).toHaveBeenCalledWith('/plugins/1/toggle', { enabled: true });
      expect(result.status).toBe('enabled');
    });

    it('should disable a plugin', async () => {
      mockApi.patch.mockResolvedValueOnce({ data: { status: 'disabled' } });

      const result = await pluginService.togglePlugin('1', false);

      expect(mockApi.patch).toHaveBeenCalledWith('/plugins/1/toggle', { enabled: false });
      expect(result.status).toBe('disabled');
    });
  });

  describe('getPluginConfig', () => {
    it('should get plugin configuration', async () => {
      const mockConfig = { apiKey: '***', refreshInterval: 300 };
      mockApi.get.mockResolvedValueOnce({ data: mockConfig });

      const result = await pluginService.getPluginConfig('1');

      expect(mockApi.get).toHaveBeenCalledWith('/plugins/1/config');
      expect(result.refreshInterval).toBe(300);
    });
  });

  describe('updatePluginConfig', () => {
    it('should update plugin configuration', async () => {
      const newConfig = { refreshInterval: 600 };
      mockApi.put.mockResolvedValueOnce({ data: { status: 'updated' } });

      const result = await pluginService.updatePluginConfig('1', newConfig);

      expect(mockApi.put).toHaveBeenCalledWith('/plugins/1/config', newConfig);
      expect(result.status).toBe('updated');
    });
  });

  describe('submitReview', () => {
    it('should submit a plugin review', async () => {
      const reviewData = { rating: 5, comment: 'Excellent!' };
      const mockReview = { id: 'r1', ...reviewData, userName: 'User1' };
      mockApi.post.mockResolvedValueOnce({ data: mockReview });

      const result = await pluginService.submitReview('1', reviewData);

      expect(mockApi.post).toHaveBeenCalledWith('/plugins/1/reviews', reviewData);
      expect(result.rating).toBe(5);
    });
  });

  describe('markReviewHelpful', () => {
    it('should mark review as helpful', async () => {
      mockApi.post.mockResolvedValueOnce({ data: { status: 'marked' } });

      const result = await pluginService.markReviewHelpful('1', 'r1');

      expect(mockApi.post).toHaveBeenCalledWith('/plugins/1/reviews/r1/helpful');
      expect(result.status).toBe('marked');
    });
  });

  describe('getCategories', () => {
    it('should get plugin categories', async () => {
      const mockCategories = {
        data: [
          { key: 'ai', label: 'AI', count: 10 },
          { key: 'analytics', label: 'Analytics', count: 5 },
        ],
      };
      mockApi.get.mockResolvedValueOnce({ data: mockCategories });

      const result = await pluginService.getCategories();

      expect(mockApi.get).toHaveBeenCalledWith('/plugins/categories');
      expect(result.data).toHaveLength(2);
    });
  });

  describe('checkForUpdates', () => {
    it('should check for plugin updates', async () => {
      const mockUpdates = {
        data: [
          { plugin: { id: '1', name: 'Plugin 1' }, newVersion: '2.0.0' },
        ],
      };
      mockApi.get.mockResolvedValueOnce({ data: mockUpdates });

      const result = await pluginService.checkForUpdates();

      expect(mockApi.get).toHaveBeenCalledWith('/plugins/updates');
      expect(result.data).toHaveLength(1);
    });
  });

  describe('updatePlugin', () => {
    it('should update a plugin', async () => {
      const mockResult = { status: 'updated', plugin: { id: '1', version: '2.0.0' } };
      mockApi.post.mockResolvedValueOnce({ data: mockResult });

      const result = await pluginService.updatePlugin('1');

      expect(mockApi.post).toHaveBeenCalledWith('/plugins/1/update');
      expect(result.status).toBe('updated');
    });
  });

  describe('updateAllPlugins', () => {
    it('should update all plugins', async () => {
      const mockResult = { updated: ['1', '2'], failed: ['3'] };
      mockApi.post.mockResolvedValueOnce({ data: mockResult });

      const result = await pluginService.updateAllPlugins();

      expect(mockApi.post).toHaveBeenCalledWith('/plugins/update-all');
      expect(result.updated).toHaveLength(2);
      expect(result.failed).toHaveLength(1);
    });
  });

  describe('getFeaturedPlugins', () => {
    it('should get featured plugins', async () => {
      const mockPlugins = { data: [{ id: '1', name: 'Featured Plugin' }] };
      mockApi.get.mockResolvedValueOnce({ data: mockPlugins });

      const result = await pluginService.getFeaturedPlugins();

      expect(mockApi.get).toHaveBeenCalledWith('/plugins/featured');
      expect(result.data).toHaveLength(1);
    });
  });

  describe('getRecommendedPlugins', () => {
    it('should get recommended plugins', async () => {
      const mockPlugins = { data: [{ id: '1', name: 'Recommended Plugin' }] };
      mockApi.get.mockResolvedValueOnce({ data: mockPlugins });

      const result = await pluginService.getRecommendedPlugins();

      expect(mockApi.get).toHaveBeenCalledWith('/plugins/recommended');
      expect(result.data).toHaveLength(1);
    });
  });
});
