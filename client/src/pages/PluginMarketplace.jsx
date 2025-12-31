import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const PluginMarketplace = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [plugins, setPlugins] = useState([]);
  const [featuredPlugins, setFeaturedPlugins] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('downloads');
  const [installedPlugins, setInstalledPlugins] = useState(new Set());

  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    fetchPlugins();
  }, [selectedCategory, sortBy]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchFeaturedPlugins(),
        fetchCategories(),
        fetchInstalledPlugins(),
        fetchPlugins()
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlugins = async () => {
    try {
      let url = `${API_URL}/api/plugins?orderBy=${sortBy}`;
      if (selectedCategory !== 'all') {
        url += `&category=${selectedCategory}`;
      }

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setPlugins(data);
      }
    } catch (error) {
      console.error('Error fetching plugins:', error);
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
      console.error('Error fetching featured plugins:', error);
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
      console.error('Error fetching categories:', error);
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
        setInstalledPlugins(new Set(data.map(p => p.plugin_id)));
      }
    } catch (error) {
      console.error('Error fetching installed plugins:', error);
    }
  };

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      fetchPlugins();
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/api/plugins/search?q=${encodeURIComponent(searchQuery)}`
      );
      if (response.ok) {
        const data = await response.json();
        setPlugins(data);
      }
    } catch (error) {
      console.error('Error searching plugins:', error);
    }
  }, [searchQuery]);

  const handleInstall = async (pluginId) => {
    if (!token) {
      navigate('/login');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/plugins/${pluginId}/install`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setInstalledPlugins(prev => new Set([...prev, pluginId]));
      }
    } catch (error) {
      console.error('Error installing plugin:', error);
    }
  };

  const renderStars = (rating) => {
    return [1, 2, 3, 4, 5].map(star => (
      <span key={star} className={`star ${star <= rating ? 'filled' : ''}`}>
        &#9733;
      </span>
    ));
  };

  const PluginCard = ({ plugin, featured = false }) => (
    <div className={`plugin-card ${featured ? 'featured' : ''}`} onClick={() => navigate(`/plugins/${plugin.id}`)}>
      <div className="plugin-icon">
        {plugin.icon_url ? (
          <img src={plugin.icon_url} alt={plugin.name} />
        ) : (
          <span className="default-icon">&#129513;</span>
        )}
      </div>
      <div className="plugin-info">
        <h3 className="plugin-name">{plugin.name}</h3>
        <p className="plugin-description">{plugin.description?.substring(0, 100)}...</p>
        <div className="plugin-meta">
          <div className="plugin-rating">
            {renderStars(plugin.rating || 0)}
            <span className="rating-count">({plugin.review_count || 0})</span>
          </div>
          <span className="plugin-downloads">{(plugin.downloads || 0).toLocaleString()} downloads</span>
        </div>
        <div className="plugin-footer">
          <span className="plugin-category">{plugin.category_name || 'General'}</span>
          <div className="plugin-price">
            {plugin.is_free ? (
              <span className="free-badge">Free</span>
            ) : (
              <span className="price">${plugin.price}</span>
            )}
          </div>
        </div>
      </div>
      <button
        className={`install-btn ${installedPlugins.has(plugin.id) ? 'installed' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          if (!installedPlugins.has(plugin.id)) {
            handleInstall(plugin.id);
          }
        }}
      >
        {installedPlugins.has(plugin.id) ? 'Installed' : 'Install'}
      </button>
    </div>
  );

  if (loading) {
    return (
      <div className="marketplace-loading">
        <div className="spinner"></div>
        <p>Loading marketplace...</p>
      </div>
    );
  }

  return (
    <div className="plugin-marketplace">
      <div className="marketplace-header">
        <div className="header-content">
          <h1>{t('plugins.marketplace', 'Plugin Marketplace')}</h1>
          <p>Discover and install plugins to extend your bot capabilities</p>
        </div>
        <button className="btn-developer" onClick={() => navigate('/plugins/developer')}>
          Developer Portal &#8594;
        </button>
      </div>

      {/* Search Bar */}
      <div className="search-section">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search plugins..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button onClick={handleSearch}>Search</button>
        </div>
        <div className="filter-controls">
          <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
            <option value="all">All Categories</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.slug}>{cat.name} ({cat.plugin_count})</option>
            ))}
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="downloads">Most Popular</option>
            <option value="rating">Top Rated</option>
            <option value="created_at">Newest</option>
            <option value="name">Alphabetical</option>
          </select>
        </div>
      </div>

      {/* Featured Plugins */}
      {featuredPlugins.length > 0 && (
        <section className="featured-section">
          <h2>Featured Plugins</h2>
          <div className="featured-grid">
            {featuredPlugins.map(plugin => (
              <PluginCard key={plugin.id} plugin={plugin} featured />
            ))}
          </div>
        </section>
      )}

      {/* Categories */}
      <section className="categories-section">
        <h2>Browse by Category</h2>
        <div className="categories-grid">
          {categories.map(category => (
            <div
              key={category.id}
              className={`category-card ${selectedCategory === category.slug ? 'active' : ''}`}
              onClick={() => setSelectedCategory(category.slug)}
            >
              <span className="category-icon">{category.icon || '&#128193;'}</span>
              <span className="category-name">{category.name}</span>
              <span className="category-count">{category.plugin_count} plugins</span>
            </div>
          ))}
        </div>
      </section>

      {/* All Plugins */}
      <section className="plugins-section">
        <h2>All Plugins</h2>
        {plugins.length === 0 ? (
          <div className="empty-state">
            <span>&#128269;</span>
            <p>No plugins found</p>
          </div>
        ) : (
          <div className="plugins-grid">
            {plugins.map(plugin => (
              <PluginCard key={plugin.id} plugin={plugin} />
            ))}
          </div>
        )}
      </section>

      <style>{`
        .plugin-marketplace {
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
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }

        .header-content h1 {
          margin: 0 0 8px 0;
          font-size: 32px;
          color: #1a1a2e;
        }

        .header-content p {
          margin: 0;
          color: #6b7280;
          font-size: 16px;
        }

        .btn-developer {
          padding: 12px 24px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-developer:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }

        .search-section {
          background: white;
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 24px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }

        .search-box {
          display: flex;
          gap: 12px;
          margin-bottom: 16px;
        }

        .search-box input {
          flex: 1;
          padding: 12px 16px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          font-size: 15px;
        }

        .search-box input:focus {
          outline: none;
          border-color: #667eea;
        }

        .search-box button {
          padding: 12px 24px;
          background: #667eea;
          color: white;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
        }

        .filter-controls {
          display: flex;
          gap: 12px;
        }

        .filter-controls select {
          padding: 10px 16px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          background: white;
          font-size: 14px;
          cursor: pointer;
        }

        .featured-section,
        .categories-section,
        .plugins-section {
          margin-bottom: 32px;
        }

        .featured-section h2,
        .categories-section h2,
        .plugins-section h2 {
          margin: 0 0 16px 0;
          font-size: 20px;
          color: #1a1a2e;
        }

        .featured-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 20px;
        }

        .categories-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
          gap: 12px;
        }

        .category-card {
          background: white;
          border-radius: 12px;
          padding: 16px;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s;
          border: 2px solid transparent;
        }

        .category-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }

        .category-card.active {
          border-color: #667eea;
          background: linear-gradient(135deg, #667eea10 0%, #764ba210 100%);
        }

        .category-icon {
          font-size: 32px;
          display: block;
          margin-bottom: 8px;
        }

        .category-name {
          display: block;
          font-weight: 600;
          color: #1a1a2e;
          margin-bottom: 4px;
        }

        .category-count {
          font-size: 12px;
          color: #9ca3af;
        }

        .plugins-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 20px;
        }

        .plugin-card {
          background: white;
          border-radius: 12px;
          padding: 20px;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          flex-direction: column;
          position: relative;
        }

        .plugin-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.12);
        }

        .plugin-card.featured {
          border: 2px solid #667eea;
        }

        .plugin-icon {
          width: 56px;
          height: 56px;
          border-radius: 12px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 16px;
          overflow: hidden;
        }

        .plugin-icon img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .plugin-icon .default-icon {
          font-size: 28px;
          color: white;
        }

        .plugin-name {
          margin: 0 0 8px 0;
          font-size: 18px;
          color: #1a1a2e;
        }

        .plugin-description {
          margin: 0 0 12px 0;
          font-size: 14px;
          color: #6b7280;
          line-height: 1.5;
          flex: 1;
        }

        .plugin-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .plugin-rating {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .star {
          color: #d1d5db;
          font-size: 14px;
        }

        .star.filled {
          color: #f59e0b;
        }

        .rating-count {
          font-size: 12px;
          color: #9ca3af;
          margin-left: 4px;
        }

        .plugin-downloads {
          font-size: 12px;
          color: #6b7280;
        }

        .plugin-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 12px;
          border-top: 1px solid #f3f4f6;
        }

        .plugin-category {
          font-size: 12px;
          color: #667eea;
          background: #667eea10;
          padding: 4px 8px;
          border-radius: 4px;
        }

        .free-badge {
          color: #10b981;
          font-weight: 600;
        }

        .price {
          color: #667eea;
          font-weight: 600;
        }

        .install-btn {
          position: absolute;
          top: 20px;
          right: 20px;
          padding: 8px 16px;
          background: #667eea;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .install-btn:hover {
          background: #5a6fd6;
        }

        .install-btn.installed {
          background: #10b981;
          cursor: default;
        }

        .empty-state {
          text-align: center;
          padding: 60px 20px;
          color: #6b7280;
        }

        .empty-state span {
          font-size: 48px;
          display: block;
          margin-bottom: 16px;
        }

        @media (max-width: 768px) {
          .marketplace-header {
            flex-direction: column;
            gap: 16px;
            align-items: flex-start;
          }

          .search-box {
            flex-direction: column;
          }

          .filter-controls {
            flex-direction: column;
          }

          .plugins-grid,
          .featured-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default PluginMarketplace;
