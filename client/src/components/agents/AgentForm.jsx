import React, { useState, useEffect } from 'react';

const roles = [
  { value: 'orchestrator', label: 'Orchestrator', description: 'Routes tasks and manages workflow' },
  { value: 'researcher', label: 'Researcher', description: 'Gathers and synthesizes information' },
  { value: 'writer', label: 'Writer', description: 'Creates content based on input' },
  { value: 'analyzer', label: 'Analyzer', description: 'Analyzes data and provides insights' },
  { value: 'reviewer', label: 'Reviewer', description: 'Reviews and improves content' },
  { value: 'router', label: 'Router', description: 'Intent detection and routing' },
  { value: 'assistant', label: 'Assistant', description: 'General conversational agent' },
  { value: 'custom', label: 'Custom', description: 'User-defined behavior' }
];

const providers = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' }
];

const models = {
  openai: [
    { value: 'gpt-4', label: 'GPT-4' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' }
  ],
  anthropic: [
    { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
    { value: 'claude-3-sonnet-20240229', label: 'Claude 3 Sonnet' },
    { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku' }
  ]
};

const capabilities = [
  { value: 'web_search', label: 'Web Search' },
  { value: 'code_execution', label: 'Code Execution' },
  { value: 'file_analysis', label: 'File Analysis' },
  { value: 'image_generation', label: 'Image Generation' },
  { value: 'data_extraction', label: 'Data Extraction' }
];

const AgentForm = ({ agent, onSave, onCancel, isLoading }) => {
  const [formData, setFormData] = useState({
    name: '',
    role: 'assistant',
    system_prompt: '',
    model_provider: 'openai',
    model_name: 'gpt-4',
    temperature: 0.7,
    max_tokens: 2048,
    capabilities: [],
    is_active: true
  });

  useEffect(() => {
    if (agent) {
      setFormData({
        name: agent.name || '',
        role: agent.role || 'assistant',
        system_prompt: agent.system_prompt || '',
        model_provider: agent.model_provider || 'openai',
        model_name: agent.model_name || 'gpt-4',
        temperature: agent.temperature ?? 0.7,
        max_tokens: agent.max_tokens || 2048,
        capabilities: agent.capabilities || [],
        is_active: agent.is_active !== false
      });
    }
  }, [agent]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleProviderChange = (e) => {
    const provider = e.target.value;
    setFormData(prev => ({
      ...prev,
      model_provider: provider,
      model_name: models[provider][0].value
    }));
  };

  const handleCapabilityToggle = (capability) => {
    setFormData(prev => ({
      ...prev,
      capabilities: prev.capabilities.includes(capability)
        ? prev.capabilities.filter(c => c !== capability)
        : [...prev.capabilities, capability]
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="agent-form-overlay">
      <div className="agent-form-modal">
        <div className="agent-form-header">
          <h2>{agent ? 'Edit Agent' : 'Create New Agent'}</h2>
          <button className="close-btn" onClick={onCancel}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-body">
            <div className="form-section">
              <h3>Basic Information</h3>

              <div className="form-group">
                <label htmlFor="name">Agent Name *</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g., Customer Support Agent"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="role">Role *</label>
                <select
                  id="role"
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  required
                >
                  {roles.map(role => (
                    <option key={role.value} value={role.value}>
                      {role.label} - {role.description}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="system_prompt">System Prompt *</label>
                <textarea
                  id="system_prompt"
                  name="system_prompt"
                  value={formData.system_prompt}
                  onChange={handleChange}
                  placeholder="Define the agent's behavior, personality, and instructions..."
                  rows={6}
                  required
                />
              </div>
            </div>

            <div className="form-section">
              <h3>Model Settings</h3>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="model_provider">Provider</label>
                  <select
                    id="model_provider"
                    name="model_provider"
                    value={formData.model_provider}
                    onChange={handleProviderChange}
                  >
                    {providers.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="model_name">Model</label>
                  <select
                    id="model_name"
                    name="model_name"
                    value={formData.model_name}
                    onChange={handleChange}
                  >
                    {models[formData.model_provider].map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="temperature">
                    Temperature: {formData.temperature}
                  </label>
                  <input
                    type="range"
                    id="temperature"
                    name="temperature"
                    min="0"
                    max="1"
                    step="0.1"
                    value={formData.temperature}
                    onChange={handleChange}
                  />
                  <div className="range-labels">
                    <span>Precise</span>
                    <span>Creative</span>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="max_tokens">Max Tokens</label>
                  <input
                    type="number"
                    id="max_tokens"
                    name="max_tokens"
                    value={formData.max_tokens}
                    onChange={handleChange}
                    min="256"
                    max="8192"
                  />
                </div>
              </div>
            </div>

            <div className="form-section">
              <h3>Capabilities</h3>
              <div className="capabilities-grid">
                {capabilities.map(cap => (
                  <label key={cap.value} className="capability-item">
                    <input
                      type="checkbox"
                      checked={formData.capabilities.includes(cap.value)}
                      onChange={() => handleCapabilityToggle(cap.value)}
                    />
                    <span>{cap.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="form-section">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={formData.is_active}
                  onChange={handleChange}
                />
                <span>Agent is active</span>
              </label>
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isLoading}>
              {isLoading ? 'Saving...' : (agent ? 'Update Agent' : 'Create Agent')}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        .agent-form-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }

        .agent-form-modal {
          background: white;
          border-radius: 16px;
          width: 100%;
          max-width: 640px;
          max-height: 90vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .agent-form-modal form {
          display: flex;
          flex-direction: column;
          flex: 1;
          overflow: hidden;
        }

        .agent-form-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          border-bottom: 1px solid #e9ecef;
        }

        .agent-form-header h2 {
          margin: 0;
          font-size: 20px;
          color: #1a1a2e;
        }

        .close-btn {
          background: none;
          border: none;
          font-size: 28px;
          color: #6c757d;
          cursor: pointer;
          padding: 0;
          line-height: 1;
        }

        .close-btn:hover {
          color: #1a1a2e;
        }

        .form-body {
          padding: 24px;
          overflow-y: auto;
          flex: 1;
        }

        .form-section {
          margin-bottom: 24px;
        }

        .form-section h3 {
          margin: 0 0 16px 0;
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #6c757d;
        }

        .form-group {
          margin-bottom: 16px;
        }

        .form-group label {
          display: block;
          margin-bottom: 6px;
          font-size: 14px;
          font-weight: 500;
          color: #495057;
        }

        .form-group input[type="text"],
        .form-group input[type="number"],
        .form-group select,
        .form-group textarea {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #dee2e6;
          border-radius: 8px;
          font-size: 14px;
          transition: border-color 0.2s;
        }

        .form-group input:focus,
        .form-group select:focus,
        .form-group textarea:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        .form-group textarea {
          resize: vertical;
          font-family: inherit;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .range-labels {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          color: #6c757d;
          margin-top: 4px;
        }

        .capabilities-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }

        .capability-item {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          font-size: 14px;
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          font-size: 14px;
        }

        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding: 16px 24px;
          border-top: 1px solid #e9ecef;
          background: #f8f9fa;
          flex-shrink: 0;
        }

        .btn {
          padding: 10px 20px;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-secondary {
          background: #e9ecef;
          color: #495057;
        }

        .btn-secondary:hover {
          background: #dee2e6;
        }

        .btn-primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .btn-primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }

        .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }
      `}</style>
    </div>
  );
};

export default AgentForm;
