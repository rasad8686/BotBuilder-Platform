import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const PluginInstalled = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [plugins, setPlugins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, active, inactive
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlugin, setSelectedPlugin] = useState(null);
  const [showUninstallModal, setShowUninstallModal] = useState(false);

  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchInstalledPlugins();
  }, []);

  const fetchInstalledPlugins = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/plugins/user/installed`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setPlugins(data);
      }
    } catch (error) {
      console.error('Error fetching installed plugins:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePlugin = async (pluginId, isActive) => {
    try {
      const endpoint = isActive ? 'disable' : 'enable';
      const response = await fetch(`${API_URL}/api/plugins/${pluginId}/${endpoint}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        setPlugins(prev =>
          prev.map(p =>
            p.plugin_id === pluginId ? { ...p, is_active: !isActive } : p
          )
        );
      }
    } catch (error) {
      console.error('Error toggling plugin:', error);
    }
  };

  const handleUninstall = async (pluginId) => {
    try {
      const response = await fetch(`${API_URL}/api/plugins/${pluginId}/uninstall`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        setPlugins(prev => prev.filter(p => p.plugin_id !== pluginId));
        setShowUninstallModal(false);
        setSelectedPlugin(null);
      }
    } catch (error) {
      console.error('Error uninstalling plugin:', error);
    }
  };

  const filteredPlugins = plugins.filter(plugin => {
    const matchesFilter =
      filter === 'all' ||
      (filter === 'active' && plugin.is_active) ||
      (filter === 'inactive' && !plugin.is_active);

    const matchesSearch =
      !searchQuery ||
      plugin.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      plugin.description?.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  const activeCount = plugins.filter(p => p.is_active).length;
  const inactiveCount = plugins.filter(p => !p.is_active).length;

  if (loading) {
    return (
      <div className="installed-loading">
        <div className="spinner"></div>
        <p>Loading your plugins...</p>
      </div>
    );
  }

  return (
    <div className="plugin-installed-page">
      <div className="page-header">
        <div className="header-content">
          <h1>{t('plugins.installed', 'Installed Plugins')}</h1>
          <p>Manage your installed plugins and their settings</p>
        </div>
        <button className="btn-marketplace" onClick={() => navigate('/plugins/marketplace')}>
          &#128722; Browse Marketplace
        </button>
      </div>

      {/* Stats */}
      <div className="stats-row">
        <div className="stat-card" onClick={() => setFilter('all')}>
          <span className="stat-value">{plugins.length}</span>
          <span className="stat-label">Total Plugins</span>
        </div>
        <div className="stat-card" onClick={() => setFilter('active')}>
          <span className="stat-value">{activeCount}</span>
          <span className="stat-label">Active</span>
        </div>
        <div className="stat-card" onClick={() => setFilter('inactive')}>
          <span className="stat-value">{inactiveCount}</span>
          <span className="stat-label">Inactive</span>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-section">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search installed plugins..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="filter-tabs">
          <button
            className={filter === 'all' ? 'active' : ''}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button
            className={filter === 'active' ? 'active' : ''}
            onClick={() => setFilter('active')}
          >
            Active
          </button>
          <button
            className={filter === 'inactive' ? 'active' : ''}
            onClick={() => setFilter('inactive')}
          >
            Inactive
          </button>
        </div>
      </div>

      {/* Plugins List */}
      <div className="plugins-list">
        {filteredPlugins.length === 0 ? (
          <div className="empty-state">
            <span>&#128268;</span>
            <h3>No plugins found</h3>
            <p>
              {plugins.length === 0
                ? "You haven't installed any plugins yet"
                : 'No plugins match your filter'
              }
            </p>
            {plugins.length === 0 && (
              <button onClick={() => navigate('/plugins/marketplace')}>
                Browse Marketplace
              </button>
            )}
          </div>
        ) : (
          filteredPlugins.map(plugin => (
            <div key={plugin.id} className={`plugin-item ${plugin.is_active ? 'active' : 'inactive'}`}>
              <div className="plugin-icon">
                {plugin.icon_url ? (
                  <img src={plugin.icon_url} alt={plugin.name} />
                ) : (
                  <span>&#129513;</span>
                )}
              </div>

              <div className="plugin-info">
                <h3>{plugin.name}</h3>
                <p>{plugin.description?.substring(0, 80)}...</p>
                <div className="plugin-meta">
                  <span className="version">v{plugin.version}</span>
                  <span className="category">{plugin.category_name || 'General'}</span>
                  <span className="installed-date">
                    Installed {new Date(plugin.installed_at).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="plugin-actions">
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={plugin.is_active}
                    onChange={() => handleTogglePlugin(plugin.plugin_id, plugin.is_active)}
                  />
                  <span className="slider"></span>
                </label>

                <button
                  className="btn-settings"
                  onClick={() => navigate(`/plugins/${plugin.plugin_id}/settings`)}
                  title="Settings"
                >
                  &#9881;
                </button>

                <button
                  className="btn-uninstall"
                  onClick={() => {
                    setSelectedPlugin(plugin);
                    setShowUninstallModal(true);
                  }}
                  title="Uninstall"
                >
                  &#128465;
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Uninstall Modal */}
      {showUninstallModal && selectedPlugin && (
        <div className="modal-overlay" onClick={() => setShowUninstallModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Uninstall Plugin</h3>
            <p>
              Are you sure you want to uninstall <strong>{selectedPlugin.name}</strong>?
              This action cannot be undone.
            </p>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setShowUninstallModal(false)}>
                Cancel
              </button>
              <button
                className="btn-confirm"
                onClick={() => handleUninstall(selectedPlugin.plugin_id)}
              >
                Uninstall
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .plugin-installed-page {
          padding: 24px;
          min-height: 100vh;
          background: #f5f6fa;
        }

        .installed-loading {
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

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }

        .header-content h1 {
          margin: 0 0 8px 0;
          font-size: 28px;
          color: #1a1a2e;
        }

        .header-content p {
          margin: 0;
          color: #6b7280;
        }

        .btn-marketplace {
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

        .btn-marketplace:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }

        .stats-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }

        .stat-card {
          background: white;
          border-radius: 12px;
          padding: 20px;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s;
        }

        .stat-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }

        .stat-value {
          display: block;
          font-size: 32px;
          font-weight: 700;
          color: #667eea;
          margin-bottom: 4px;
        }

        .stat-label {
          font-size: 14px;
          color: #6b7280;
        }

        .filters-section {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: white;
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 24px;
        }

        .search-box input {
          padding: 10px 16px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          width: 300px;
          font-size: 14px;
        }

        .search-box input:focus {
          outline: none;
          border-color: #667eea;
        }

        .filter-tabs {
          display: flex;
          gap: 8px;
        }

        .filter-tabs button {
          padding: 8px 16px;
          border: none;
          background: #f3f4f6;
          border-radius: 6px;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .filter-tabs button.active {
          background: #667eea;
          color: white;
        }

        .plugins-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .plugin-item {
          background: white;
          border-radius: 12px;
          padding: 20px;
          display: flex;
          align-items: center;
          gap: 20px;
          transition: all 0.2s;
          border-left: 4px solid #10b981;
        }

        .plugin-item.inactive {
          border-left-color: #9ca3af;
          opacity: 0.8;
        }

        .plugin-item:hover {
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        }

        .plugin-icon {
          width: 56px;
          height: 56px;
          border-radius: 12px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          overflow: hidden;
        }

        .plugin-icon img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .plugin-icon span {
          font-size: 24px;
          color: white;
        }

        .plugin-info {
          flex: 1;
        }

        .plugin-info h3 {
          margin: 0 0 4px 0;
          font-size: 16px;
          color: #1a1a2e;
        }

        .plugin-info p {
          margin: 0 0 8px 0;
          font-size: 13px;
          color: #6b7280;
        }

        .plugin-meta {
          display: flex;
          gap: 12px;
          font-size: 12px;
        }

        .plugin-meta span {
          color: #9ca3af;
        }

        .plugin-meta .version {
          background: #f3f4f6;
          padding: 2px 8px;
          border-radius: 4px;
        }

        .plugin-meta .category {
          color: #667eea;
        }

        .plugin-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .toggle-switch {
          position: relative;
          width: 48px;
          height: 26px;
        }

        .toggle-switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }

        .slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: #ccc;
          transition: 0.3s;
          border-radius: 26px;
        }

        .slider:before {
          position: absolute;
          content: "";
          height: 20px;
          width: 20px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: 0.3s;
          border-radius: 50%;
        }

        input:checked + .slider {
          background-color: #10b981;
        }

        input:checked + .slider:before {
          transform: translateX(22px);
        }

        .btn-settings,
        .btn-uninstall {
          width: 36px;
          height: 36px;
          border: none;
          border-radius: 8px;
          background: #f3f4f6;
          cursor: pointer;
          font-size: 16px;
          transition: all 0.2s;
        }

        .btn-settings:hover {
          background: #e5e7eb;
        }

        .btn-uninstall:hover {
          background: #fee2e2;
          color: #dc2626;
        }

        .empty-state {
          text-align: center;
          padding: 60px 20px;
          background: white;
          border-radius: 12px;
        }

        .empty-state span {
          font-size: 48px;
        }

        .empty-state h3 {
          margin: 16px 0 8px;
          color: #1a1a2e;
        }

        .empty-state p {
          margin: 0 0 20px;
          color: #6b7280;
        }

        .empty-state button {
          padding: 12px 24px;
          background: #667eea;
          color: white;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal-content {
          background: white;
          border-radius: 16px;
          padding: 24px;
          max-width: 400px;
          width: 90%;
        }

        .modal-content h3 {
          margin: 0 0 12px 0;
          color: #1a1a2e;
        }

        .modal-content p {
          margin: 0 0 20px 0;
          color: #6b7280;
        }

        .modal-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
        }

        .btn-cancel,
        .btn-confirm {
          padding: 10px 20px;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
        }

        .btn-cancel {
          background: #f3f4f6;
          color: #4b5563;
        }

        .btn-confirm {
          background: #dc2626;
          color: white;
        }

        @media (max-width: 768px) {
          .page-header {
            flex-direction: column;
            gap: 16px;
            align-items: flex-start;
          }

          .stats-row {
            grid-template-columns: 1fr;
          }

          .filters-section {
            flex-direction: column;
            gap: 16px;
          }

          .search-box input {
            width: 100%;
          }

          .plugin-item {
            flex-direction: column;
            text-align: center;
          }

          .plugin-actions {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
};

export default PluginInstalled;
