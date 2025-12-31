import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const PluginSettings = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [plugin, setPlugin] = useState(null);
  const [settings, setSettings] = useState({});
  const [configSchema, setConfigSchema] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [activeTab, setActiveTab] = useState('settings');

  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchPluginDetails();
  }, [id]);

  const fetchPluginDetails = async () => {
    setLoading(true);
    try {
      // Fetch plugin details
      const pluginRes = await fetch(`${API_URL}/api/plugins/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (pluginRes.ok) {
        const pluginData = await pluginRes.json();
        setPlugin(pluginData);

        // Parse manifest for config schema
        const manifest = typeof pluginData.manifest === 'string'
          ? JSON.parse(pluginData.manifest)
          : pluginData.manifest || {};
        setConfigSchema(manifest.config || {});
      }

      // Fetch current settings
      const settingsRes = await fetch(`${API_URL}/api/plugins/${id}/settings`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        setSettings(settingsData.settings || {});
      }
    } catch (error) {
      console.error('Error fetching plugin details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSettingChange = (key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch(`${API_URL}/api/plugins/${id}/settings`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ settings })
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Settings saved successfully!' });
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.error || 'Failed to save settings' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    // Reset to default values from schema
    const defaults = {};
    Object.entries(configSchema).forEach(([key, config]) => {
      if (config.default !== undefined) {
        defaults[key] = config.default;
      }
    });
    setSettings(defaults);
  };

  const renderConfigField = (key, config) => {
    const value = settings[key] ?? config.default ?? '';

    switch (config.type) {
      case 'string':
        return (
          <input
            type={config.secret ? 'password' : 'text'}
            value={value}
            onChange={(e) => handleSettingChange(key, e.target.value)}
            placeholder={config.placeholder}
          />
        );

      case 'number':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => handleSettingChange(key, parseFloat(e.target.value))}
            min={config.min}
            max={config.max}
            step={config.step || 1}
          />
        );

      case 'boolean':
        return (
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={!!value}
              onChange={(e) => handleSettingChange(key, e.target.checked)}
            />
            <span className="slider"></span>
          </label>
        );

      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => handleSettingChange(key, e.target.value)}
          >
            {config.options?.map(opt => (
              <option key={opt.value || opt} value={opt.value || opt}>
                {opt.label || opt}
              </option>
            ))}
          </select>
        );

      case 'array':
        return (
          <textarea
            value={Array.isArray(value) ? value.join('\n') : value}
            onChange={(e) => handleSettingChange(key, e.target.value.split('\n'))}
            placeholder="One item per line"
            rows={4}
          />
        );

      case 'object':
        return (
          <textarea
            value={typeof value === 'object' ? JSON.stringify(value, null, 2) : value}
            onChange={(e) => {
              try {
                handleSettingChange(key, JSON.parse(e.target.value));
              } catch {
                // Keep raw value if invalid JSON
              }
            }}
            placeholder="JSON object"
            rows={4}
          />
        );

      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleSettingChange(key, e.target.value)}
          />
        );
    }
  };

  if (loading) {
    return (
      <div className="settings-loading">
        <div className="spinner"></div>
        <p>Loading settings...</p>
      </div>
    );
  }

  if (!plugin) {
    return (
      <div className="settings-error">
        <h2>Plugin not found</h2>
        <button onClick={() => navigate('/plugins/installed')}>Back to Plugins</button>
      </div>
    );
  }

  return (
    <div className="plugin-settings-page">
      <div className="settings-header">
        <button className="back-btn" onClick={() => navigate('/plugins/installed')}>
          &#8592; Back
        </button>
        <div className="plugin-title">
          <div className="plugin-icon">
            {plugin.icon_url ? (
              <img src={plugin.icon_url} alt={plugin.name} />
            ) : (
              <span>&#129513;</span>
            )}
          </div>
          <div>
            <h1>{plugin.name}</h1>
            <span className="version">v{plugin.version}</span>
          </div>
        </div>
      </div>

      <div className="settings-tabs">
        <button
          className={activeTab === 'settings' ? 'active' : ''}
          onClick={() => setActiveTab('settings')}
        >
          Settings
        </button>
        <button
          className={activeTab === 'permissions' ? 'active' : ''}
          onClick={() => setActiveTab('permissions')}
        >
          Permissions
        </button>
        <button
          className={activeTab === 'logs' ? 'active' : ''}
          onClick={() => setActiveTab('logs')}
        >
          Logs
        </button>
      </div>

      <div className="settings-content">
        {activeTab === 'settings' && (
          <div className="settings-form">
            {message && (
              <div className={`message ${message.type}`}>
                {message.text}
              </div>
            )}

            {Object.keys(configSchema).length === 0 ? (
              <div className="no-settings">
                <span>&#9881;</span>
                <p>This plugin has no configurable settings.</p>
              </div>
            ) : (
              <>
                {Object.entries(configSchema).map(([key, config]) => (
                  <div key={key} className="form-group">
                    <label>
                      {config.label || key}
                      {config.required && <span className="required">*</span>}
                    </label>
                    {config.description && (
                      <p className="field-description">{config.description}</p>
                    )}
                    {renderConfigField(key, config)}
                  </div>
                ))}

                <div className="form-actions">
                  <button className="btn-reset" onClick={handleReset}>
                    Reset to Defaults
                  </button>
                  <button
                    className="btn-save"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? 'Saving...' : 'Save Settings'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'permissions' && (
          <div className="permissions-section">
            <h3>Plugin Permissions</h3>
            <p className="section-description">
              This plugin has access to the following permissions:
            </p>

            <div className="permissions-list">
              {(plugin.permissions || []).map((perm, index) => (
                <div key={index} className="permission-item">
                  <span className="permission-icon">&#9989;</span>
                  <div className="permission-info">
                    <span className="permission-name">{perm}</span>
                    <span className="permission-desc">
                      {getPermissionDescription(perm)}
                    </span>
                  </div>
                </div>
              ))}

              {(!plugin.permissions || plugin.permissions.length === 0) && (
                <p className="no-permissions">
                  This plugin does not require any special permissions.
                </p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="logs-section">
            <h3>Plugin Logs</h3>
            <p className="section-description">
              Recent activity and error logs from this plugin.
            </p>

            <div className="logs-placeholder">
              <span>&#128203;</span>
              <p>Log viewing coming soon...</p>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .plugin-settings-page {
          padding: 24px;
          min-height: 100vh;
          background: #f5f6fa;
        }

        .settings-loading,
        .settings-error {
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

        .settings-header {
          margin-bottom: 24px;
        }

        .back-btn {
          padding: 8px 16px;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          font-size: 14px;
          cursor: pointer;
          margin-bottom: 16px;
        }

        .back-btn:hover {
          background: #f3f4f6;
        }

        .plugin-title {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .plugin-icon {
          width: 64px;
          height: 64px;
          border-radius: 16px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }

        .plugin-icon img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .plugin-icon span {
          font-size: 32px;
          color: white;
        }

        .plugin-title h1 {
          margin: 0 0 4px 0;
          font-size: 24px;
          color: #1a1a2e;
        }

        .version {
          font-size: 14px;
          color: #6b7280;
        }

        .settings-tabs {
          display: flex;
          gap: 4px;
          background: white;
          padding: 4px;
          border-radius: 12px;
          margin-bottom: 24px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }

        .settings-tabs button {
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

        .settings-tabs button:hover {
          background: #f3f4f6;
        }

        .settings-tabs button.active {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .settings-content {
          background: white;
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }

        .message {
          padding: 12px 16px;
          border-radius: 8px;
          margin-bottom: 20px;
        }

        .message.success {
          background: #d1fae5;
          color: #059669;
        }

        .message.error {
          background: #fee2e2;
          color: #dc2626;
        }

        .no-settings {
          text-align: center;
          padding: 40px;
          color: #6b7280;
        }

        .no-settings span {
          font-size: 48px;
          display: block;
          margin-bottom: 12px;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-group label {
          display: block;
          font-weight: 600;
          color: #1a1a2e;
          margin-bottom: 4px;
        }

        .required {
          color: #dc2626;
          margin-left: 4px;
        }

        .field-description {
          font-size: 13px;
          color: #6b7280;
          margin: 4px 0 8px 0;
        }

        .form-group input[type="text"],
        .form-group input[type="password"],
        .form-group input[type="number"],
        .form-group select,
        .form-group textarea {
          width: 100%;
          padding: 12px 16px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          font-size: 14px;
          transition: border-color 0.2s;
        }

        .form-group input:focus,
        .form-group select:focus,
        .form-group textarea:focus {
          outline: none;
          border-color: #667eea;
        }

        .toggle-switch {
          position: relative;
          display: inline-block;
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
          background-color: #667eea;
        }

        input:checked + .slider:before {
          transform: translateX(22px);
        }

        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 24px;
          padding-top: 24px;
          border-top: 1px solid #e5e7eb;
        }

        .btn-reset {
          padding: 12px 24px;
          background: #f3f4f6;
          color: #4b5563;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
        }

        .btn-save {
          padding: 12px 24px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
        }

        .btn-save:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .permissions-section h3,
        .logs-section h3 {
          margin: 0 0 8px 0;
          color: #1a1a2e;
        }

        .section-description {
          margin: 0 0 20px 0;
          color: #6b7280;
        }

        .permissions-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .permission-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          background: #f9fafb;
          border-radius: 8px;
        }

        .permission-icon {
          font-size: 18px;
        }

        .permission-name {
          display: block;
          font-weight: 600;
          color: #1a1a2e;
        }

        .permission-desc {
          font-size: 13px;
          color: #6b7280;
        }

        .no-permissions {
          color: #6b7280;
          font-style: italic;
        }

        .logs-placeholder {
          text-align: center;
          padding: 40px;
          color: #6b7280;
        }

        .logs-placeholder span {
          font-size: 48px;
          display: block;
          margin-bottom: 12px;
        }

        @media (max-width: 768px) {
          .settings-tabs {
            flex-wrap: wrap;
          }

          .form-actions {
            flex-direction: column;
          }

          .form-actions button {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

function getPermissionDescription(permission) {
  const descriptions = {
    'read:data': 'Read plugin data storage',
    'write:data': 'Write to plugin data storage',
    'read:messages': 'Read incoming messages',
    'send:messages': 'Send messages on behalf of bot',
    'network:outbound': 'Make HTTP requests to external services',
    'network:inbound': 'Receive incoming webhooks',
    'storage:local': 'Use local file storage',
    'storage:database': 'Access database directly',
    'agent:execute': 'Execute AI agent actions',
    'flow:read': 'Read conversation flows',
    'flow:modify': 'Modify conversation flows',
    'user:read': 'Read user information',
    'user:write': 'Modify user information',
    'analytics:read': 'Read analytics data',
    'analytics:write': 'Write analytics events'
  };

  return descriptions[permission] || 'Unknown permission';
}

export default PluginSettings;
