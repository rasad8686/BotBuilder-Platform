import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import PluginBuilder from '../components/plugins/PluginBuilder';
import PluginUpload from '../components/plugins/PluginUpload';
import PluginAnalytics from '../components/plugins/PluginAnalytics';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const PluginDeveloper = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [myPlugins, setMyPlugins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlugin, setSelectedPlugin] = useState(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [stats, setStats] = useState({
    totalPlugins: 0,
    totalDownloads: 0,
    totalRevenue: 0,
    avgRating: 0
  });

  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchMyPlugins();
  }, []);

  const fetchMyPlugins = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/plugins/developer/my-plugins`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setMyPlugins(data);
        calculateStats(data);
      }
    } catch (error) {
      // Silent fail
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (plugins) => {
    const totalDownloads = plugins.reduce((sum, p) => sum + (p.downloads || 0), 0);
    const totalRevenue = plugins.reduce((sum, p) => {
      if (!p.is_free) {
        return sum + ((p.price || 0) * (p.downloads || 0) * 0.7); // 70% developer share
      }
      return sum;
    }, 0);
    const avgRating = plugins.length > 0
      ? plugins.reduce((sum, p) => sum + (p.rating || 0), 0) / plugins.length
      : 0;

    setStats({
      totalPlugins: plugins.length,
      totalDownloads,
      totalRevenue,
      avgRating: avgRating.toFixed(1)
    });
  };

  const handlePluginCreated = (newPlugin) => {
    setMyPlugins([newPlugin, ...myPlugins]);
    setShowBuilder(false);
    calculateStats([newPlugin, ...myPlugins]);
  };

  const handlePluginUpdated = (updatedPlugin) => {
    const updated = myPlugins.map(p => p.id === updatedPlugin.id ? updatedPlugin : p);
    setMyPlugins(updated);
    setShowUpload(false);
    setSelectedPlugin(null);
  };

  const handleDeletePlugin = async (pluginId) => {
    if (!confirm('Are you sure you want to delete this plugin?')) return;

    try {
      const response = await fetch(`${API_URL}/api/plugins/${pluginId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const filtered = myPlugins.filter(p => p.id !== pluginId);
        setMyPlugins(filtered);
        calculateStats(filtered);
      }
    } catch (error) {
      // Silent fail
    }
  };

  const renderStars = (rating) => {
    return [1, 2, 3, 4, 5].map(star => (
      <span key={star} className={`star ${star <= rating ? 'filled' : ''}`}>★</span>
    ));
  };

  if (loading) {
    return (
      <div className="developer-loading">
        <div className="spinner"></div>
        <p>{t('pluginDeveloper.loading')}</p>
      </div>
    );
  }

  return (
    <div className="plugin-developer-page">
      <div className="developer-header">
        <div className="header-content">
          <h1>{t('pluginDeveloper.title')}</h1>
          <p>{t('pluginDeveloper.subtitle')}</p>
        </div>
        <button className="btn-create" onClick={() => setShowBuilder(true)}>
          + {t('pluginDeveloper.createPlugin')}
        </button>
      </div>

      {/* Stats Overview */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">📦</div>
          <div className="stat-info">
            <span className="stat-value">{stats.totalPlugins}</span>
            <span className="stat-label">{t('pluginDeveloper.totalPlugins')}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">⬇️</div>
          <div className="stat-info">
            <span className="stat-value">{stats.totalDownloads.toLocaleString()}</span>
            <span className="stat-label">{t('pluginDeveloper.totalDownloads')}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">💰</div>
          <div className="stat-info">
            <span className="stat-value">${stats.totalRevenue.toFixed(2)}</span>
            <span className="stat-label">{t('pluginDeveloper.totalRevenue')}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">⭐</div>
          <div className="stat-info">
            <span className="stat-value">{stats.avgRating}</span>
            <span className="stat-label">{t('pluginDeveloper.avgRating')}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="developer-tabs">
        <button
          className={`tab ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          {t('pluginDeveloper.myPlugins')}
        </button>
        <button
          className={`tab ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          {t('analytics.title')}
        </button>
        <button
          className={`tab ${activeTab === 'docs' ? 'active' : ''}`}
          onClick={() => setActiveTab('docs')}
        >
          {t('pluginDeveloper.documentation')}
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'dashboard' && (
          <div className="plugins-dashboard">
            {myPlugins.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon">🧩</span>
                <h3>{t('pluginDeveloper.noPlugins')}</h3>
                <p>{t('pluginDeveloper.noPluginsDesc')}</p>
                <button className="btn-create" onClick={() => setShowBuilder(true)}>
                  {t('pluginDeveloper.createPlugin')}
                </button>
              </div>
            ) : (
              <div className="plugins-table">
                <table>
                  <thead>
                    <tr>
                      <th>Plugin</th>
                      <th>Status</th>
                      <th>Version</th>
                      <th>Downloads</th>
                      <th>Rating</th>
                      <th>Revenue</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myPlugins.map(plugin => (
                      <tr key={plugin.id}>
                        <td className="plugin-cell">
                          <div className="plugin-icon">
                            {plugin.icon_url ? (
                              <img src={plugin.icon_url} alt={plugin.name} />
                            ) : (
                              <span>🧩</span>
                            )}
                          </div>
                          <div className="plugin-info">
                            <span className="plugin-name">{plugin.name}</span>
                            <span className="plugin-category">{plugin.category_name || 'General'}</span>
                          </div>
                        </td>
                        <td>
                          <span className={`status-badge ${plugin.status || 'draft'}`}>
                            {plugin.status || 'draft'}
                          </span>
                        </td>
                        <td>v{plugin.version}</td>
                        <td>{(plugin.downloads || 0).toLocaleString()}</td>
                        <td className="rating-cell">
                          <div className="stars">{renderStars(plugin.rating || 0)}</div>
                          <span className="rating-count">({plugin.review_count || 0})</span>
                        </td>
                        <td>
                          {plugin.is_free ? (
                            <span className="free-badge">Free</span>
                          ) : (
                            <span className="revenue">
                              ${((plugin.price || 0) * (plugin.downloads || 0) * 0.7).toFixed(2)}
                            </span>
                          )}
                        </td>
                        <td className="actions-cell">
                          <button
                            className="btn-action edit"
                            onClick={() => {
                              setSelectedPlugin(plugin);
                              setShowBuilder(true);
                            }}
                            title="Edit"
                          >
                            ✏️
                          </button>
                          <button
                            className="btn-action upload"
                            onClick={() => {
                              setSelectedPlugin(plugin);
                              setShowUpload(true);
                            }}
                            title="Upload New Version"
                          >
                            ⬆️
                          </button>
                          <button
                            className="btn-action analytics"
                            onClick={() => {
                              setSelectedPlugin(plugin);
                              setActiveTab('analytics');
                            }}
                            title="Analytics"
                          >
                            📊
                          </button>
                          <button
                            className="btn-action delete"
                            onClick={() => handleDeletePlugin(plugin.id)}
                            title="Delete"
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'analytics' && (
          <PluginAnalytics
            plugin={selectedPlugin}
            plugins={myPlugins}
            onSelectPlugin={setSelectedPlugin}
          />
        )}

        {activeTab === 'docs' && (
          <div className="docs-section">
            <h2>Plugin Development Guide</h2>

            <div className="doc-card">
              <h3>Getting Started</h3>
              <p>Learn how to create your first plugin for the BotBuilder platform.</p>
              <ol>
                <li>Create a new plugin using the "Create New Plugin" button</li>
                <li>Define your plugin manifest with required metadata</li>
                <li>Implement your plugin logic following our SDK</li>
                <li>Upload your plugin package for review</li>
                <li>Once approved, your plugin will be live in the marketplace</li>
              </ol>
            </div>

            <div className="doc-card">
              <h3>Plugin Types</h3>
              <ul>
                <li><strong>Channel Plugins:</strong> Add new messaging platforms (WhatsApp, Telegram, etc.)</li>
                <li><strong>AI Plugins:</strong> Integrate custom AI models and providers</li>
                <li><strong>Integration Plugins:</strong> Connect to CRMs, databases, and third-party services</li>
                <li><strong>Tool Plugins:</strong> Add custom tools for AI agents to use</li>
              </ul>
            </div>

            <div className="doc-card">
              <h3>Manifest Structure</h3>
              <pre>{`{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "Plugin description",
  "type": "tool",
  "main": "index.js",
  "permissions": ["read_messages", "send_messages"],
  "config": {
    "apiKey": {
      "type": "string",
      "required": true,
      "description": "API key for the service"
    }
  }
}`}</pre>
            </div>

            <div className="doc-card">
              <h3>Revenue Share</h3>
              <p>Earn 70% of every sale. We handle payment processing, distribution, and support.</p>
              <ul>
                <li>Set your own pricing</li>
                <li>Monthly payouts via PayPal or bank transfer</li>
                <li>Real-time analytics and reporting</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showBuilder && (
        <PluginBuilder
          plugin={selectedPlugin}
          onSave={selectedPlugin ? handlePluginUpdated : handlePluginCreated}
          onClose={() => {
            setShowBuilder(false);
            setSelectedPlugin(null);
          }}
        />
      )}

      {showUpload && selectedPlugin && (
        <PluginUpload
          plugin={selectedPlugin}
          onUpload={handlePluginUpdated}
          onClose={() => {
            setShowUpload(false);
            setSelectedPlugin(null);
          }}
        />
      )}

      <style>{`
        .plugin-developer-page {
          padding: 24px;
          min-height: 100vh;
          background: #f5f6fa;
        }

        .developer-loading {
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

        .developer-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }

        .header-content h1 {
          margin: 0 0 4px 0;
          font-size: 28px;
          color: #1a1a2e;
        }

        .header-content p {
          margin: 0;
          color: #6b7280;
        }

        .btn-create {
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

        .btn-create:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }

        .stat-card {
          background: white;
          border-radius: 12px;
          padding: 20px;
          display: flex;
          align-items: center;
          gap: 16px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }

        .stat-icon {
          font-size: 32px;
          width: 56px;
          height: 56px;
          background: linear-gradient(135deg, #667eea20 0%, #764ba220 100%);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .stat-info {
          display: flex;
          flex-direction: column;
        }

        .stat-value {
          font-size: 24px;
          font-weight: 700;
          color: #1a1a2e;
        }

        .stat-label {
          font-size: 13px;
          color: #6b7280;
        }

        .developer-tabs {
          display: flex;
          gap: 4px;
          background: white;
          padding: 4px;
          border-radius: 12px;
          margin-bottom: 24px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }

        .tab {
          flex: 1;
          padding: 12px 24px;
          border: none;
          background: transparent;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          color: #6b7280;
          cursor: pointer;
          transition: all 0.2s;
        }

        .tab:hover {
          background: #f3f4f6;
        }

        .tab.active {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .tab-content {
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
          min-height: 400px;
        }

        .plugins-dashboard {
          padding: 24px;
        }

        .empty-state {
          text-align: center;
          padding: 60px 20px;
        }

        .empty-icon {
          font-size: 64px;
          display: block;
          margin-bottom: 16px;
        }

        .empty-state h3 {
          margin: 0 0 8px 0;
          color: #1a1a2e;
        }

        .empty-state p {
          margin: 0 0 20px 0;
          color: #6b7280;
        }

        .plugins-table {
          overflow-x: auto;
        }

        .plugins-table table {
          width: 100%;
          border-collapse: collapse;
        }

        .plugins-table th {
          text-align: left;
          padding: 12px 16px;
          font-size: 12px;
          font-weight: 600;
          color: #6b7280;
          text-transform: uppercase;
          border-bottom: 1px solid #e5e7eb;
        }

        .plugins-table td {
          padding: 16px;
          border-bottom: 1px solid #f3f4f6;
        }

        .plugin-cell {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .plugin-cell .plugin-icon {
          width: 40px;
          height: 40px;
          border-radius: 8px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }

        .plugin-cell .plugin-icon img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .plugin-cell .plugin-icon span {
          font-size: 20px;
        }

        .plugin-info {
          display: flex;
          flex-direction: column;
        }

        .plugin-name {
          font-weight: 600;
          color: #1a1a2e;
        }

        .plugin-category {
          font-size: 12px;
          color: #9ca3af;
        }

        .status-badge {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
        }

        .status-badge.published {
          background: #d1fae5;
          color: #059669;
        }

        .status-badge.draft {
          background: #e5e7eb;
          color: #6b7280;
        }

        .status-badge.pending {
          background: #fef3c7;
          color: #d97706;
        }

        .status-badge.rejected {
          background: #fee2e2;
          color: #dc2626;
        }

        .rating-cell {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .stars {
          display: flex;
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
        }

        .free-badge {
          color: #10b981;
          font-weight: 600;
        }

        .revenue {
          color: #667eea;
          font-weight: 600;
        }

        .actions-cell {
          display: flex;
          gap: 8px;
        }

        .btn-action {
          width: 32px;
          height: 32px;
          border: none;
          border-radius: 6px;
          background: #f3f4f6;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s;
        }

        .btn-action:hover {
          background: #e5e7eb;
        }

        .btn-action.delete:hover {
          background: #fee2e2;
        }

        .docs-section {
          padding: 24px;
        }

        .docs-section h2 {
          margin: 0 0 24px 0;
          color: #1a1a2e;
        }

        .doc-card {
          background: #f9fafb;
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 16px;
        }

        .doc-card h3 {
          margin: 0 0 12px 0;
          color: #1a1a2e;
          font-size: 16px;
        }

        .doc-card p {
          margin: 0 0 12px 0;
          color: #4b5563;
          line-height: 1.6;
        }

        .doc-card ul, .doc-card ol {
          margin: 0;
          padding-left: 20px;
          color: #4b5563;
        }

        .doc-card li {
          margin-bottom: 8px;
          line-height: 1.5;
        }

        .doc-card pre {
          background: #1a1a2e;
          color: #e5e7eb;
          padding: 16px;
          border-radius: 8px;
          overflow-x: auto;
          font-size: 13px;
          line-height: 1.5;
        }

        @media (max-width: 768px) {
          .developer-header {
            flex-direction: column;
            gap: 16px;
            align-items: flex-start;
          }

          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .developer-tabs {
            flex-wrap: wrap;
          }

          .plugins-table {
            font-size: 14px;
          }
        }
      `}</style>
    </div>
  );
};

export default PluginDeveloper;
