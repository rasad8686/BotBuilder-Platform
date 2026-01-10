import React, { useState, useEffect } from 'react';
import { Globe, Database, Code, Bug, Mail } from 'lucide-react';

const ToolForm = ({ tool, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    tool_type: 'http_request',
    is_active: true,
    configuration: {},
    input_schema: null,
    output_schema: null
  });

  const [errors, setErrors] = useState({});

  const toolTypes = [
    { value: 'http_request', label: 'HTTP/API Request', Icon: Globe },
    { value: 'database_query', label: 'Database Query', Icon: Database },
    { value: 'code_execution', label: 'Code Execution', Icon: Code },
    { value: 'web_scraper', label: 'Web Scraper', Icon: Bug },
    { value: 'email', label: 'Email (SMTP)', Icon: Mail }
  ];

  useEffect(() => {
    if (tool) {
      setFormData({
        name: tool.name || '',
        description: tool.description || '',
        tool_type: tool.tool_type || 'http_request',
        is_active: tool.is_active !== false,
        configuration: tool.configuration || {},
        input_schema: tool.input_schema || null,
        output_schema: tool.output_schema || null
      });
    }
  }, [tool]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    setErrors(prev => ({ ...prev, [name]: null }));
  };

  const handleConfigChange = (key, value) => {
    setFormData(prev => ({
      ...prev,
      configuration: {
        ...prev.configuration,
        [key]: value
      }
    }));
  };

  const handleTypeChange = (e) => {
    const newType = e.target.value;
    setFormData(prev => ({
      ...prev,
      tool_type: newType,
      configuration: getDefaultConfig(newType)
    }));
  };

  const getDefaultConfig = (type) => {
    switch (type) {
      case 'http_request':
        return { url: '', method: 'GET', headers: {}, timeout: 30000 };
      case 'database_query':
        return { type: 'postgresql', query: '' };
      case 'code_execution':
        return { code: '', timeout: 5000 };
      case 'web_scraper':
        return { url: '', selectors: {} };
      case 'email':
        return { smtp: { host: '', port: 587 } };
      default:
        return {};
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    if (!formData.tool_type) {
      newErrors.tool_type = 'Tool type is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) {
      onSave(formData);
    }
  };

  const renderHttpConfig = () => (
    <div className="config-section">
      <h4>HTTP Configuration</h4>
      <div className="form-row">
        <div className="form-group">
          <label>URL</label>
          <input
            type="text"
            value={formData.configuration.url || ''}
            onChange={(e) => handleConfigChange('url', e.target.value)}
            placeholder="https://api.example.com/endpoint"
          />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group" style={{ flex: 1 }}>
          <label>Method</label>
          <select
            value={formData.configuration.method || 'GET'}
            onChange={(e) => handleConfigChange('method', e.target.value)}
          >
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="DELETE">DELETE</option>
            <option value="PATCH">PATCH</option>
          </select>
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label>Timeout (ms)</label>
          <input
            type="number"
            value={formData.configuration.timeout || 30000}
            onChange={(e) => handleConfigChange('timeout', parseInt(e.target.value))}
          />
        </div>
      </div>
      <div className="form-group">
        <label>Headers (JSON)</label>
        <textarea
          value={JSON.stringify(formData.configuration.headers || {}, null, 2)}
          onChange={(e) => {
            try {
              handleConfigChange('headers', JSON.parse(e.target.value));
            } catch {}
          }}
          placeholder='{"Authorization": "Bearer {{token}}"}'
          rows={3}
        />
      </div>
      <div className="form-group">
        <label>Body Template (JSON)</label>
        <textarea
          value={formData.configuration.bodyTemplate || ''}
          onChange={(e) => handleConfigChange('bodyTemplate', e.target.value)}
          placeholder='{"key": "{{value}}"}'
          rows={4}
        />
      </div>
    </div>
  );

  const renderDatabaseConfig = () => (
    <div className="config-section">
      <h4>Database Configuration</h4>
      <div className="form-row">
        <div className="form-group">
          <label>Database Type</label>
          <select
            value={formData.configuration.type || 'postgresql'}
            onChange={(e) => handleConfigChange('type', e.target.value)}
          >
            <option value="postgresql">PostgreSQL</option>
            <option value="mysql">MySQL</option>
          </select>
        </div>
      </div>
      <div className="form-group">
        <label>Query Template</label>
        <textarea
          value={formData.configuration.query || ''}
          onChange={(e) => handleConfigChange('query', e.target.value)}
          placeholder="SELECT * FROM users WHERE id = $1"
          rows={5}
          className="code-input"
        />
      </div>
      <div className="form-group">
        <label>Parameters (comma-separated)</label>
        <input
          type="text"
          value={(formData.configuration.params || []).join(', ')}
          onChange={(e) => handleConfigChange('params', e.target.value.split(',').map(p => p.trim()))}
          placeholder="userId, status"
        />
      </div>
    </div>
  );

  const renderCodeConfig = () => (
    <div className="config-section">
      <h4>Code Execution Configuration</h4>
      <div className="form-group">
        <label>JavaScript Code</label>
        <textarea
          value={formData.configuration.code || ''}
          onChange={(e) => handleConfigChange('code', e.target.value)}
          placeholder={`// Access input via 'input' variable
const result = input.value * 2;
return result;`}
          rows={10}
          className="code-input"
        />
      </div>
      <div className="form-group">
        <label>Timeout (ms)</label>
        <input
          type="number"
          value={formData.configuration.timeout || 5000}
          onChange={(e) => handleConfigChange('timeout', parseInt(e.target.value))}
        />
      </div>
    </div>
  );

  const renderScraperConfig = () => (
    <div className="config-section">
      <h4>Web Scraper Configuration</h4>
      <div className="form-group">
        <label>Target URL</label>
        <input
          type="text"
          value={formData.configuration.url || ''}
          onChange={(e) => handleConfigChange('url', e.target.value)}
          placeholder="https://example.com/page"
        />
      </div>
      <div className="form-group">
        <label>CSS Selectors (JSON)</label>
        <textarea
          value={JSON.stringify(formData.configuration.selectors || {}, null, 2)}
          onChange={(e) => {
            try {
              handleConfigChange('selectors', JSON.parse(e.target.value));
            } catch {}
          }}
          placeholder='{"title": "h1", "content": ".article-body"}'
          rows={5}
        />
      </div>
      <div className="form-row">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={formData.configuration.extractLinks || false}
            onChange={(e) => handleConfigChange('extractLinks', e.target.checked)}
          />
          Extract Links
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={formData.configuration.extractImages || false}
            onChange={(e) => handleConfigChange('extractImages', e.target.checked)}
          />
          Extract Images
        </label>
      </div>
    </div>
  );

  const renderEmailConfig = () => (
    <div className="config-section">
      <h4>Email (SMTP) Configuration</h4>
      <div className="form-row">
        <div className="form-group" style={{ flex: 2 }}>
          <label>SMTP Host</label>
          <input
            type="text"
            value={formData.configuration.smtp?.host || ''}
            onChange={(e) => handleConfigChange('smtp', { ...formData.configuration.smtp, host: e.target.value })}
            placeholder="smtp.gmail.com"
          />
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label>Port</label>
          <input
            type="number"
            value={formData.configuration.smtp?.port || 587}
            onChange={(e) => handleConfigChange('smtp', { ...formData.configuration.smtp, port: parseInt(e.target.value) })}
          />
        </div>
      </div>
      <div className="form-group">
        <label>Default From Address</label>
        <input
          type="email"
          value={formData.configuration.defaultFrom || ''}
          onChange={(e) => handleConfigChange('defaultFrom', e.target.value)}
          placeholder="noreply@example.com"
        />
      </div>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={formData.configuration.smtp?.secure || false}
          onChange={(e) => handleConfigChange('smtp', { ...formData.configuration.smtp, secure: e.target.checked })}
        />
        Use TLS/SSL (port 465)
      </label>
    </div>
  );

  const renderConfigSection = () => {
    switch (formData.tool_type) {
      case 'http_request':
        return renderHttpConfig();
      case 'database_query':
        return renderDatabaseConfig();
      case 'code_execution':
        return renderCodeConfig();
      case 'web_scraper':
        return renderScraperConfig();
      case 'email':
        return renderEmailConfig();
      default:
        return null;
    }
  };

  return (
    <div className="tool-form">
      <h2>{tool ? 'Edit Tool' : 'Create New Tool'}</h2>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Tool Name *</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="My API Tool"
            className={errors.name ? 'error' : ''}
          />
          {errors.name && <span className="error-text">{errors.name}</span>}
        </div>

        <div className="form-group">
          <label>Description</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Describe what this tool does..."
            rows={3}
          />
        </div>

        <div className="form-group">
          <label>Tool Type *</label>
          <div className="type-selector">
            {toolTypes.map(type => (
              <label
                key={type.value}
                className={`type-option ${formData.tool_type === type.value ? 'selected' : ''}`}
              >
                <input
                  type="radio"
                  name="tool_type"
                  value={type.value}
                  checked={formData.tool_type === type.value}
                  onChange={handleTypeChange}
                />
                <span className="type-icon"><type.Icon size={28} /></span>
                <span className="type-label">{type.label}</span>
              </label>
            ))}
          </div>
        </div>

        {renderConfigSection()}

        <div className="form-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              name="is_active"
              checked={formData.is_active}
              onChange={handleChange}
            />
            Tool is Active
          </label>
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            {tool ? 'Save Changes' : 'Create Tool'}
          </button>
        </div>
      </form>

      <style>{`
        .tool-form {
          padding: 24px;
        }

        .tool-form h2 {
          margin: 0 0 24px 0;
          color: #1a1a2e;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-group label {
          display: block;
          margin-bottom: 6px;
          font-weight: 500;
          color: #374151;
        }

        .form-group input[type="text"],
        .form-group input[type="email"],
        .form-group input[type="number"],
        .form-group textarea,
        .form-group select {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          font-size: 14px;
          transition: border-color 0.2s;
        }

        .form-group input:focus,
        .form-group textarea:focus,
        .form-group select:focus {
          outline: none;
          border-color: #667eea;
        }

        .form-group input.error {
          border-color: #dc2626;
        }

        .error-text {
          color: #dc2626;
          font-size: 12px;
          margin-top: 4px;
        }

        .code-input {
          font-family: 'Fira Code', 'Monaco', monospace;
          font-size: 13px;
        }

        .form-row {
          display: flex;
          gap: 16px;
        }

        .form-row .form-group {
          flex: 1;
        }

        .type-selector {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 12px;
        }

        .type-option {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 16px 12px;
          border: 2px solid #e5e7eb;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .type-option:hover {
          border-color: #667eea;
        }

        .type-option.selected {
          border-color: #667eea;
          background: #f0f4ff;
        }

        .type-option input {
          display: none;
        }

        .type-icon {
          font-size: 28px;
          margin-bottom: 8px;
        }

        .type-label {
          font-size: 13px;
          font-weight: 500;
          text-align: center;
          color: #374151;
        }

        .config-section {
          background: #f9fafb;
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 20px;
        }

        .config-section h4 {
          margin: 0 0 16px 0;
          color: #1a1a2e;
          font-size: 16px;
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          font-weight: normal;
        }

        .checkbox-label input {
          width: auto;
        }

        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
        }

        .btn {
          padding: 10px 24px;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .btn-primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }

        .btn-secondary {
          background: #f3f4f6;
          color: #374151;
        }

        .btn-secondary:hover {
          background: #e5e7eb;
        }
      `}</style>
    </div>
  );
};

export default ToolForm;
