import React, { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const PluginBuilder = ({ plugin, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    category_id: '',
    version: '1.0.0',
    is_free: true,
    price: 0,
    manifest: {
      name: '',
      version: '1.0.0',
      description: '',
      type: 'tool',
      main: 'index.js',
      permissions: [],
      config: {}
    },
    permissions: []
  });

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [activeSection, setActiveSection] = useState('basic');

  const token = localStorage.getItem('token');

  const availablePermissions = [
    { id: 'read_messages', label: 'Read Messages', description: 'Access to read incoming messages' },
    { id: 'send_messages', label: 'Send Messages', description: 'Ability to send messages' },
    { id: 'read_users', label: 'Read Users', description: 'Access to user data' },
    { id: 'read_bots', label: 'Read Bots', description: 'Access to bot configurations' },
    { id: 'modify_bots', label: 'Modify Bots', description: 'Ability to modify bot settings' },
    { id: 'execute_flows', label: 'Execute Flows', description: 'Trigger and manage flows' },
    { id: 'access_knowledge', label: 'Access Knowledge Base', description: 'Read from knowledge base' },
    { id: 'modify_knowledge', label: 'Modify Knowledge Base', description: 'Write to knowledge base' },
    { id: 'external_api', label: 'External API Access', description: 'Make external HTTP requests' },
    { id: 'file_access', label: 'File Access', description: 'Read and write files' },
    { id: 'webhook_access', label: 'Webhook Access', description: 'Create and manage webhooks' },
    { id: 'analytics_access', label: 'Analytics Access', description: 'Access analytics data' }
  ];

  const pluginTypes = [
    { value: 'channel', label: 'Channel Plugin', description: 'Add new messaging platforms' },
    { value: 'ai', label: 'AI Plugin', description: 'Integrate AI models and providers' },
    { value: 'integration', label: 'Integration Plugin', description: 'Connect to external services' },
    { value: 'tool', label: 'Tool Plugin', description: 'Add tools for AI agents' }
  ];

  useEffect(() => {
    fetchCategories();
    if (plugin) {
      setFormData({
        name: plugin.name || '',
        slug: plugin.slug || '',
        description: plugin.description || '',
        category_id: plugin.category_id || '',
        version: plugin.version || '1.0.0',
        is_free: plugin.is_free !== false,
        price: plugin.price || 0,
        manifest: plugin.manifest || {
          name: plugin.name || '',
          version: plugin.version || '1.0.0',
          description: plugin.description || '',
          type: 'tool',
          main: 'index.js',
          permissions: [],
          config: {}
        },
        permissions: plugin.permissions || []
      });
    }
  }, [plugin]);

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

  const generateSlug = (name) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const handleChange = (field, value) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };

      // Auto-generate slug from name
      if (field === 'name' && !plugin) {
        updated.slug = generateSlug(value);
        updated.manifest = {
          ...prev.manifest,
          name: generateSlug(value),
          description: prev.description || value
        };
      }

      // Sync description to manifest
      if (field === 'description') {
        updated.manifest = {
          ...prev.manifest,
          description: value
        };
      }

      // Sync version to manifest
      if (field === 'version') {
        updated.manifest = {
          ...prev.manifest,
          version: value
        };
      }

      return updated;
    });
    setErrors(prev => ({ ...prev, [field]: null }));
  };

  const handleManifestChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      manifest: { ...prev.manifest, [field]: value }
    }));
  };

  const handlePermissionToggle = (permId) => {
    setFormData(prev => {
      const permissions = prev.permissions.includes(permId)
        ? prev.permissions.filter(p => p !== permId)
        : [...prev.permissions, permId];

      return {
        ...prev,
        permissions,
        manifest: { ...prev.manifest, permissions }
      };
    });
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Plugin name is required';
    }

    if (!formData.slug.trim()) {
      newErrors.slug = 'Plugin slug is required';
    } else if (!/^[a-z0-9-]+$/.test(formData.slug)) {
      newErrors.slug = 'Slug can only contain lowercase letters, numbers, and hyphens';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }

    if (!formData.category_id) {
      newErrors.category_id = 'Category is required';
    }

    if (!formData.is_free && (!formData.price || formData.price <= 0)) {
      newErrors.price = 'Price must be greater than 0 for paid plugins';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const url = plugin
        ? `${API_URL}/api/plugins/${plugin.id}`
        : `${API_URL}/api/plugins`;

      const method = plugin ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const savedPlugin = await response.json();
        onSave(savedPlugin);
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to save plugin');
      }
    } catch (error) {
      console.error('Error saving plugin:', error);
      alert('Failed to save plugin');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="builder-overlay" onClick={onClose}>
      <div className="builder-modal" onClick={(e) => e.stopPropagation()}>
        <div className="builder-header">
          <h2>{plugin ? 'Edit Plugin' : 'Create New Plugin'}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="builder-nav">
          <button
            className={`nav-btn ${activeSection === 'basic' ? 'active' : ''}`}
            onClick={() => setActiveSection('basic')}
          >
            Basic Info
          </button>
          <button
            className={`nav-btn ${activeSection === 'manifest' ? 'active' : ''}`}
            onClick={() => setActiveSection('manifest')}
          >
            Manifest
          </button>
          <button
            className={`nav-btn ${activeSection === 'permissions' ? 'active' : ''}`}
            onClick={() => setActiveSection('permissions')}
          >
            Permissions
          </button>
          <button
            className={`nav-btn ${activeSection === 'pricing' ? 'active' : ''}`}
            onClick={() => setActiveSection('pricing')}
          >
            Pricing
          </button>
        </div>

        <div className="builder-content">
          {activeSection === 'basic' && (
            <div className="section-basic">
              <div className="form-group">
                <label>Plugin Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="My Awesome Plugin"
                  className={errors.name ? 'error' : ''}
                />
                {errors.name && <span className="error-text">{errors.name}</span>}
              </div>

              <div className="form-group">
                <label>Slug *</label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => handleChange('slug', e.target.value)}
                  placeholder="my-awesome-plugin"
                  className={errors.slug ? 'error' : ''}
                />
                {errors.slug && <span className="error-text">{errors.slug}</span>}
                <span className="hint">Used in URLs and as unique identifier</span>
              </div>

              <div className="form-group">
                <label>Description *</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  placeholder="Describe what your plugin does..."
                  rows={4}
                  className={errors.description ? 'error' : ''}
                />
                {errors.description && <span className="error-text">{errors.description}</span>}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Category *</label>
                  <select
                    value={formData.category_id}
                    onChange={(e) => handleChange('category_id', e.target.value)}
                    className={errors.category_id ? 'error' : ''}
                  >
                    <option value="">Select Category</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {cat.icon} {cat.name}
                      </option>
                    ))}
                  </select>
                  {errors.category_id && <span className="error-text">{errors.category_id}</span>}
                </div>

                <div className="form-group">
                  <label>Version *</label>
                  <input
                    type="text"
                    value={formData.version}
                    onChange={(e) => handleChange('version', e.target.value)}
                    placeholder="1.0.0"
                  />
                </div>
              </div>
            </div>
          )}

          {activeSection === 'manifest' && (
            <div className="section-manifest">
              <div className="form-group">
                <label>Plugin Type</label>
                <div className="type-grid">
                  {pluginTypes.map(type => (
                    <div
                      key={type.value}
                      className={`type-card ${formData.manifest.type === type.value ? 'selected' : ''}`}
                      onClick={() => handleManifestChange('type', type.value)}
                    >
                      <span className="type-label">{type.label}</span>
                      <span className="type-desc">{type.description}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>Entry Point</label>
                <input
                  type="text"
                  value={formData.manifest.main}
                  onChange={(e) => handleManifestChange('main', e.target.value)}
                  placeholder="index.js"
                />
                <span className="hint">Main file that will be executed</span>
              </div>

              <div className="form-group">
                <label>Manifest JSON (Advanced)</label>
                <textarea
                  value={JSON.stringify(formData.manifest, null, 2)}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value);
                      setFormData(prev => ({ ...prev, manifest: parsed }));
                    } catch (err) {
                      // Invalid JSON, ignore
                    }
                  }}
                  rows={12}
                  className="code-editor"
                />
              </div>
            </div>
          )}

          {activeSection === 'permissions' && (
            <div className="section-permissions">
              <p className="section-intro">
                Select the permissions your plugin requires. Request only what you need.
              </p>
              <div className="permissions-grid">
                {availablePermissions.map(perm => (
                  <div
                    key={perm.id}
                    className={`permission-item ${formData.permissions.includes(perm.id) ? 'selected' : ''}`}
                    onClick={() => handlePermissionToggle(perm.id)}
                  >
                    <div className="perm-checkbox">
                      {formData.permissions.includes(perm.id) ? '✓' : ''}
                    </div>
                    <div className="perm-info">
                      <span className="perm-label">{perm.label}</span>
                      <span className="perm-desc">{perm.description}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSection === 'pricing' && (
            <div className="section-pricing">
              <div className="pricing-toggle">
                <button
                  className={`pricing-btn ${formData.is_free ? 'active' : ''}`}
                  onClick={() => handleChange('is_free', true)}
                >
                  <span className="pricing-icon">🆓</span>
                  <span className="pricing-label">Free</span>
                  <span className="pricing-desc">Available at no cost</span>
                </button>
                <button
                  className={`pricing-btn ${!formData.is_free ? 'active' : ''}`}
                  onClick={() => handleChange('is_free', false)}
                >
                  <span className="pricing-icon">💰</span>
                  <span className="pricing-label">Paid</span>
                  <span className="pricing-desc">Set your own price</span>
                </button>
              </div>

              {!formData.is_free && (
                <div className="price-input-group">
                  <div className="form-group">
                    <label>Price (USD) *</label>
                    <div className="price-input">
                      <span className="currency">$</span>
                      <input
                        type="number"
                        value={formData.price}
                        onChange={(e) => handleChange('price', parseFloat(e.target.value) || 0)}
                        min="0.99"
                        step="0.01"
                        className={errors.price ? 'error' : ''}
                      />
                    </div>
                    {errors.price && <span className="error-text">{errors.price}</span>}
                  </div>

                  <div className="revenue-preview">
                    <h4>Revenue Preview</h4>
                    <div className="revenue-item">
                      <span>Plugin Price:</span>
                      <span>${formData.price.toFixed(2)}</span>
                    </div>
                    <div className="revenue-item">
                      <span>Platform Fee (30%):</span>
                      <span>-${(formData.price * 0.3).toFixed(2)}</span>
                    </div>
                    <div className="revenue-item total">
                      <span>Your Earnings:</span>
                      <span>${(formData.price * 0.7).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="builder-footer">
          <button className="btn-cancel" onClick={onClose}>Cancel</button>
          <button
            className="btn-save"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? 'Saving...' : (plugin ? 'Update Plugin' : 'Create Plugin')}
          </button>
        </div>

        <style>{`
          .builder-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.6);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            padding: 20px;
          }

          .builder-modal {
            background: white;
            border-radius: 16px;
            width: 100%;
            max-width: 700px;
            max-height: 90vh;
            display: flex;
            flex-direction: column;
            overflow: hidden;
          }

          .builder-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px 24px;
            border-bottom: 1px solid #e5e7eb;
          }

          .builder-header h2 {
            margin: 0;
            font-size: 20px;
            color: #1a1a2e;
          }

          .close-btn {
            background: none;
            border: none;
            font-size: 28px;
            color: #6b7280;
            cursor: pointer;
          }

          .builder-nav {
            display: flex;
            padding: 0 24px;
            border-bottom: 1px solid #e5e7eb;
          }

          .nav-btn {
            padding: 14px 20px;
            border: none;
            background: none;
            font-size: 14px;
            font-weight: 500;
            color: #6b7280;
            cursor: pointer;
            border-bottom: 2px solid transparent;
            margin-bottom: -1px;
          }

          .nav-btn:hover {
            color: #667eea;
          }

          .nav-btn.active {
            color: #667eea;
            border-bottom-color: #667eea;
          }

          .builder-content {
            flex: 1;
            overflow-y: auto;
            padding: 24px;
          }

          .form-group {
            margin-bottom: 20px;
          }

          .form-group label {
            display: block;
            font-size: 13px;
            font-weight: 600;
            color: #374151;
            margin-bottom: 8px;
          }

          .form-group input,
          .form-group select,
          .form-group textarea {
            width: 100%;
            padding: 12px;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            font-size: 14px;
            transition: all 0.2s;
          }

          .form-group input:focus,
          .form-group select:focus,
          .form-group textarea:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
          }

          .form-group input.error,
          .form-group select.error,
          .form-group textarea.error {
            border-color: #dc2626;
          }

          .error-text {
            color: #dc2626;
            font-size: 12px;
            margin-top: 4px;
            display: block;
          }

          .hint {
            color: #9ca3af;
            font-size: 12px;
            margin-top: 4px;
            display: block;
          }

          .form-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
          }

          .code-editor {
            font-family: 'Monaco', 'Consolas', monospace;
            font-size: 13px;
            background: #1a1a2e;
            color: #e5e7eb;
          }

          .type-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
          }

          .type-card {
            padding: 16px;
            border: 2px solid #e5e7eb;
            border-radius: 12px;
            cursor: pointer;
            transition: all 0.2s;
          }

          .type-card:hover {
            border-color: #667eea;
          }

          .type-card.selected {
            border-color: #667eea;
            background: rgba(102, 126, 234, 0.05);
          }

          .type-label {
            display: block;
            font-weight: 600;
            color: #1a1a2e;
            margin-bottom: 4px;
          }

          .type-desc {
            font-size: 12px;
            color: #6b7280;
          }

          .section-intro {
            color: #6b7280;
            margin-bottom: 20px;
          }

          .permissions-grid {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }

          .permission-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s;
          }

          .permission-item:hover {
            border-color: #667eea;
          }

          .permission-item.selected {
            border-color: #667eea;
            background: rgba(102, 126, 234, 0.05);
          }

          .perm-checkbox {
            width: 24px;
            height: 24px;
            border: 2px solid #e5e7eb;
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            color: white;
            flex-shrink: 0;
          }

          .permission-item.selected .perm-checkbox {
            background: #667eea;
            border-color: #667eea;
          }

          .perm-info {
            display: flex;
            flex-direction: column;
          }

          .perm-label {
            font-weight: 500;
            color: #1a1a2e;
          }

          .perm-desc {
            font-size: 12px;
            color: #6b7280;
          }

          .pricing-toggle {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            margin-bottom: 24px;
          }

          .pricing-btn {
            padding: 24px;
            border: 2px solid #e5e7eb;
            border-radius: 12px;
            background: white;
            cursor: pointer;
            text-align: center;
            transition: all 0.2s;
          }

          .pricing-btn:hover {
            border-color: #667eea;
          }

          .pricing-btn.active {
            border-color: #667eea;
            background: rgba(102, 126, 234, 0.05);
          }

          .pricing-icon {
            font-size: 32px;
            display: block;
            margin-bottom: 8px;
          }

          .pricing-label {
            display: block;
            font-size: 18px;
            font-weight: 600;
            color: #1a1a2e;
            margin-bottom: 4px;
          }

          .pricing-desc {
            font-size: 13px;
            color: #6b7280;
          }

          .price-input-group {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 24px;
          }

          .price-input {
            display: flex;
            align-items: center;
          }

          .currency {
            background: #f3f4f6;
            padding: 12px 16px;
            border: 1px solid #e5e7eb;
            border-right: none;
            border-radius: 8px 0 0 8px;
            color: #6b7280;
            font-weight: 600;
          }

          .price-input input {
            border-radius: 0 8px 8px 0;
          }

          .revenue-preview {
            background: #f9fafb;
            padding: 20px;
            border-radius: 12px;
          }

          .revenue-preview h4 {
            margin: 0 0 16px 0;
            color: #1a1a2e;
          }

          .revenue-item {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            font-size: 14px;
            color: #6b7280;
          }

          .revenue-item.total {
            border-top: 1px solid #e5e7eb;
            margin-top: 8px;
            padding-top: 16px;
            font-weight: 600;
            color: #10b981;
            font-size: 16px;
          }

          .builder-footer {
            display: flex;
            justify-content: flex-end;
            gap: 12px;
            padding: 20px 24px;
            border-top: 1px solid #e5e7eb;
          }

          .btn-cancel {
            padding: 12px 24px;
            border: 1px solid #e5e7eb;
            background: white;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
          }

          .btn-save {
            padding: 12px 24px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
          }

          .btn-save:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }

          @media (max-width: 640px) {
            .form-row,
            .type-grid,
            .pricing-toggle,
            .price-input-group {
              grid-template-columns: 1fr;
            }
          }
        `}</style>
      </div>
    </div>
  );
};

export default PluginBuilder;
