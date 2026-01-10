import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import PluginCard from '../components/plugins/PluginCard';
import PluginFilters from '../components/plugins/PluginFilters';
import PluginDetails from '../components/plugins/PluginDetails';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const Marketplace = () => {
  const { t } = useTranslation();
  const [plugins, setPlugins] = useState([]);
  const [featuredPlugins, setFeaturedPlugins] = useState([]);
  const [categories, setCategories] = useState([]);
  const [installedIds, setInstalledIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [selectedPlugin, setSelectedPlugin] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [priceFilter, setPriceFilter] = useState('all');
  const [sortBy, setSortBy] = useState('downloads');

  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchPlugins();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, sortBy]);

  useEffect(() => {
    if (searchQuery.length >= 2) {
      searchPlugins();
    } else if (searchQuery.length === 0) {
      fetchPlugins();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchCategories(),
        fetchFeaturedPlugins(),
        fetchInstalledPlugins()
      ]);
      await fetchPlugins();
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch(`${API_URL}/api/plugins/categories`);
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      }
    } catch (error) {
      // Silent fail
    }
  };

  const fetchFeaturedPlugins = async () => {
    try {
      const response = await fetch(`${API_URL}/api/plugins/featured?limit=4`);
      if (response.ok) {
        const data = await response.json();
        setFeaturedPlugins(data);
      }
    } catch (error) {
      // Silent fail
    }
  };

  const fetchPlugins = async () => {
    try {
      let url = `${API_URL}/api/plugins?orderBy=${sortBy}`;
      if (selectedCategory) {
        url += `&category=${selectedCategory}`;
      }

      const response = await fetch(url);
      if (response.ok) {
        let data = await response.json();

        // Apply price filter client-side
        if (priceFilter === 'free') {
          data = data.filter(p => p.is_free);
        } else if (priceFilter === 'paid') {
          data = data.filter(p => !p.is_free);
        }

        setPlugins(data);
      }
    } catch (error) {
      // Silent fail
    }
  };

  const searchPlugins = async () => {
    try {
      const response = await fetch(
        `${API_URL}/api/plugins/search?q=${encodeURIComponent(searchQuery)}`
      );
      if (response.ok) {
        const data = await response.json();
        setPlugins(data);
      }
    } catch (error) {
      // Silent fail
    }
  };

  const fetchInstalledPlugins = async () => {
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/api/plugins/user/installed`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setInstalledIds(new Set(data.map(p => p.plugin_id)));
      }
    } catch (error) {
      // Silent fail
    }
  };

  const handleInstall = async (plugin) => {
    if (!token) {
      alert('Please log in to install plugins');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/plugins/${plugin.id}/install`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setInstalledIds(prev => new Set([...prev, plugin.id]));
        alert(`${plugin.name} installed successfully!`);
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to install plugin');
      }
    } catch (error) {
      // Silent fail
      alert('Failed to install plugin');
    }
  };

  const handleUninstall = async (plugin) => {
    if (!confirm(`Uninstall ${plugin.name}?`)) return;

    try {
      const response = await fetch(`${API_URL}/api/plugins/${plugin.id}/uninstall`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        setInstalledIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(plugin.id);
          return newSet;
        });
        alert(`${plugin.name} uninstalled successfully!`);
      }
    } catch (error) {
      // Silent fail
    }
  };

  if (loading) {
    return (
      <div className="marketplace-loading">
        <div className="spinner"></div>
        <p>{t('marketplace.loading')}</p>
      </div>
    );
  }

  return (
    <div className="marketplace-page">
      <div className="marketplace-header">
        <h1>{t('marketplace.title')}</h1>
        <p>{t('marketplace.subtitle')}</p>
      </div>

      {featuredPlugins.length > 0 && !searchQuery && !selectedCategory && (
        <div className="featured-section">
          <h2>{t('marketplace.featuredPlugins')}</h2>
          <div className="featured-grid">
            {featuredPlugins.map(plugin => (
              <PluginCard
                key={plugin.id}
                plugin={plugin}
                isInstalled={installedIds.has(plugin.id)}
                onInstall={handleInstall}
                onUninstall={handleUninstall}
                onViewDetails={setSelectedPlugin}
              />
            ))}
          </div>
        </div>
      )}

      <PluginFilters
        categories={categories}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        priceFilter={priceFilter}
        onPriceChange={setPriceFilter}
        sortBy={sortBy}
        onSortChange={setSortBy}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <div className="plugins-section">
        <h2>
          {searchQuery
            ? `${t('marketplace.searchResults')} "${searchQuery}"`
            : selectedCategory
              ? categories.find(c => c.slug === selectedCategory)?.name || t('marketplace.plugins')
              : t('marketplace.allPlugins')
          }
          <span className="plugin-count">({plugins.length})</span>
        </h2>

        {plugins.length === 0 ? (
          <div className="no-plugins">
            <span className="empty-icon"><Search size={48} /></span>
            <p>{t('marketplace.noPlugins')}</p>
            <p className="hint">{t('marketplace.noPluginsHint')}</p>
          </div>
        ) : (
          <div className="plugins-grid">
            {plugins.map(plugin => (
              <PluginCard
                key={plugin.id}
                plugin={plugin}
                isInstalled={installedIds.has(plugin.id)}
                onInstall={handleInstall}
                onUninstall={handleUninstall}
                onViewDetails={setSelectedPlugin}
              />
            ))}
          </div>
        )}
      </div>

      {selectedPlugin && (
        <PluginDetails
          plugin={selectedPlugin}
          isInstalled={installedIds.has(selectedPlugin.id)}
          onInstall={handleInstall}
          onUninstall={handleUninstall}
          onClose={() => setSelectedPlugin(null)}
        />
      )}

      <style>{`
        .marketplace-page {
          padding: 24px;
          min-height: 100vh;
          background: #f5f6fa;
        }

        .marketplace-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 60vh;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid #e5e7eb;
          border-top-color: #667eea;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .marketplace-header {
          margin-bottom: 32px;
        }

        .marketplace-header h1 {
          margin: 0 0 8px 0;
          font-size: 32px;
          color: #1a1a2e;
        }

        .marketplace-header p {
          margin: 0;
          color: #6b7280;
          font-size: 16px;
        }

        .featured-section {
          margin-bottom: 32px;
        }

        .featured-section h2 {
          margin: 0 0 16px 0;
          font-size: 20px;
          color: #1a1a2e;
        }

        .featured-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 20px;
        }

        .plugins-section h2 {
          margin: 0 0 20px 0;
          font-size: 20px;
          color: #1a1a2e;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .plugin-count {
          font-size: 14px;
          font-weight: 400;
          color: #9ca3af;
        }

        .plugins-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 20px;
        }

        .no-plugins {
          text-align: center;
          padding: 60px 20px;
          background: white;
          border-radius: 12px;
        }

        .empty-icon {
          font-size: 48px;
          display: block;
          margin-bottom: 16px;
        }

        .no-plugins p {
          margin: 0;
          color: #6b7280;
        }

        .no-plugins .hint {
          font-size: 14px;
          margin-top: 8px;
          color: #9ca3af;
        }

        @media (max-width: 768px) {
          .marketplace-page {
            padding: 16px;
          }

          .marketplace-header h1 {
            font-size: 24px;
          }

          .featured-grid, .plugins-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default Marketplace;
