import api from './api';

export interface Plugin {
  id: string;
  name: string;
  description: string;
  icon?: string;
  category: string;
  version: string;
  author: string;
  authorUrl?: string;
  rating: number;
  downloads: number;
  price: number;
  isInstalled: boolean;
  isEnabled: boolean;
  tags: string[];
  permissions: string[];
  screenshots?: string[];
  changelog?: ChangelogEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

export interface PluginReview {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  rating: number;
  comment: string;
  helpful: number;
  createdAt: string;
}

export interface PluginConfig {
  [key: string]: any;
}

class PluginService {
  // Marketplace
  async getMarketplacePlugins(params?: {
    category?: string;
    search?: string;
    sort?: 'popular' | 'newest' | 'rating';
    page?: number;
    limit?: number;
  }): Promise<{ data: Plugin[]; total: number }> {
    const response = await api.get('/plugins/marketplace', { params });
    return response.data;
  }

  async getPlugin(id: string): Promise<Plugin> {
    const response = await api.get(`/plugins/${id}`);
    return response.data;
  }

  async getPluginReviews(id: string, params?: {
    page?: number;
    limit?: number;
    sort?: 'newest' | 'helpful';
  }): Promise<{ data: PluginReview[]; total: number }> {
    const response = await api.get(`/plugins/${id}/reviews`, { params });
    return response.data;
  }

  // Installed plugins
  async getInstalledPlugins(): Promise<{ data: Plugin[] }> {
    const response = await api.get('/plugins/installed');
    return response.data;
  }

  async installPlugin(pluginId: string): Promise<{ status: string; plugin: Plugin }> {
    const response = await api.post(`/plugins/${pluginId}/install`);
    return response.data;
  }

  async uninstallPlugin(pluginId: string): Promise<{ status: string }> {
    const response = await api.delete(`/plugins/${pluginId}/uninstall`);
    return response.data;
  }

  async togglePlugin(pluginId: string, enabled: boolean): Promise<{ status: string }> {
    const response = await api.patch(`/plugins/${pluginId}/toggle`, { enabled });
    return response.data;
  }

  // Plugin configuration
  async getPluginConfig(pluginId: string): Promise<PluginConfig> {
    const response = await api.get(`/plugins/${pluginId}/config`);
    return response.data;
  }

  async updatePluginConfig(pluginId: string, config: PluginConfig): Promise<{ status: string }> {
    const response = await api.put(`/plugins/${pluginId}/config`, config);
    return response.data;
  }

  // Reviews
  async submitReview(pluginId: string, data: {
    rating: number;
    comment: string;
  }): Promise<PluginReview> {
    const response = await api.post(`/plugins/${pluginId}/reviews`, data);
    return response.data;
  }

  async markReviewHelpful(pluginId: string, reviewId: string): Promise<{ status: string }> {
    const response = await api.post(`/plugins/${pluginId}/reviews/${reviewId}/helpful`);
    return response.data;
  }

  // Categories
  async getCategories(): Promise<{ data: Array<{ key: string; label: string; count: number }> }> {
    const response = await api.get('/plugins/categories');
    return response.data;
  }

  // Updates
  async checkForUpdates(): Promise<{ data: Array<{ plugin: Plugin; newVersion: string }> }> {
    const response = await api.get('/plugins/updates');
    return response.data;
  }

  async updatePlugin(pluginId: string): Promise<{ status: string; plugin: Plugin }> {
    const response = await api.post(`/plugins/${pluginId}/update`);
    return response.data;
  }

  async updateAllPlugins(): Promise<{ updated: string[]; failed: string[] }> {
    const response = await api.post('/plugins/update-all');
    return response.data;
  }

  // Featured & recommendations
  async getFeaturedPlugins(): Promise<{ data: Plugin[] }> {
    const response = await api.get('/plugins/featured');
    return response.data;
  }

  async getRecommendedPlugins(): Promise<{ data: Plugin[] }> {
    const response = await api.get('/plugins/recommended');
    return response.data;
  }
}

export const pluginService = new PluginService();
export default pluginService;
