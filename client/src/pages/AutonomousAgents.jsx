import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bot, ClipboardList, Pencil, Trash2 } from 'lucide-react';

const statusColors = {
  active: '#48bb78',
  inactive: '#718096',
  paused: '#ed8936'
};

const AutonomousAgents = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [agents, setAgents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingAgent, setEditingAgent] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    model: 'gpt-4',
    temperature: 0.7,
    max_tokens: 4096,
    system_prompt: '',
    capabilities: []
  });

  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchAgents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchAgents = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/autonomous/agents', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) {
        throw new Error('Failed to fetch agents');
      }

      const data = await res.json();
      setAgents(data.agents || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingAgent(null);
    setFormData({
      name: '',
      description: '',
      model: 'gpt-4',
      temperature: 0.7,
      max_tokens: 4096,
      system_prompt: '',
      capabilities: []
    });
    setShowForm(true);
  };

  const handleEdit = (agent) => {
    setEditingAgent(agent);
    setFormData({
      name: agent.name,
      description: agent.description || '',
      model: agent.model || 'gpt-4',
      temperature: agent.temperature || 0.7,
      max_tokens: agent.max_tokens || 4096,
      system_prompt: agent.system_prompt || '',
      capabilities: agent.capabilities || []
    });
    setShowForm(true);
  };

  const handleDelete = async (agent) => {
    if (!window.confirm(t('autonomous.deleteConfirm', { name: agent.name }))) {
      return;
    }

    try {
      const res = await fetch(`/api/autonomous/agents/${agent.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) {
        throw new Error('Failed to delete agent');
      }

      setAgents(prev => prev.filter(a => a.id !== agent.id));
    } catch (err) {
      alert(err.message);
    }
  };

  const handleViewTasks = (agent) => {
    navigate(`/autonomous/${agent.id}/tasks`);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const url = editingAgent
        ? `/api/autonomous/agents/${editingAgent.id}`
        : '/api/autonomous/agents';

      const method = editingAgent ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save agent');
      }

      const result = await res.json();
      const savedAgent = result.agent;

      if (editingAgent) {
        setAgents(prev => prev.map(a => a.id === savedAgent.id ? savedAgent : a));
      } else {
        setAgents(prev => [...prev, savedAgent]);
      }

      setShowForm(false);
      setEditingAgent(null);
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingAgent(null);
  };

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f7fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '48px', height: '48px', border: '4px solid #e9ecef', borderTopColor: '#667eea', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }}></div>
          <p style={{ color: '#6c757d' }}>{t('common.loading')}</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f7fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', padding: '40px', background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <h2 style={{ color: '#c53030', marginBottom: '8px' }}>{t('common.error')}</h2>
          <p style={{ color: '#6c757d' }}>{error}</p>
          <button onClick={fetchAgents} style={{ marginTop: '16px', padding: '10px 20px', background: '#667eea', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
            {t('common.retry')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa', padding: '32px' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#1a1a2e', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Bot style={{ width: '32px', height: '32px', color: '#667eea' }} />
              {t('autonomous.title', 'Autonomous Agents')}
            </h1>
            <p style={{ color: '#6c757d', margin: 0 }}>
              {t('autonomous.subtitle', 'AI agents that can think, plan, and execute complex tasks autonomously')}
            </p>
          </div>
          <button
            onClick={handleCreate}
            style={{
              padding: '12px 24px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)'
            }}
          >
            <span style={{ fontSize: '18px' }}>+</span>
            {t('autonomous.createAgent', 'Create Agent')}
          </button>
        </div>

        {/* Agents Grid */}
        {agents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 40px', background: 'white', borderRadius: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
              <Bot style={{ width: '64px', height: '64px', color: '#667eea' }} />
            </div>
            <h2 style={{ color: '#1a1a2e', marginBottom: '8px' }}>{t('autonomous.noAgents', 'No Agents Yet')}</h2>
            <p style={{ color: '#6c757d', marginBottom: '24px' }}>{t('autonomous.noAgentsDesc', 'Create your first autonomous agent to start automating complex tasks')}</p>
            <button
              onClick={handleCreate}
              style={{
                padding: '12px 24px',
                background: '#667eea',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              {t('autonomous.createFirstAgent', 'Create Your First Agent')}
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '24px' }}>
            {agents.map(agent => (
              <div key={agent.id} style={{
                background: 'white',
                borderRadius: '16px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                overflow: 'hidden',
                transition: 'all 0.2s'
              }}>
                {/* Card Header */}
                <div style={{ padding: '20px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '12px',
                      background: 'linear-gradient(135deg, #667eea20 0%, #764ba220 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '24px'
                    }}>
                      <Bot style={{ width: '24px', height: '24px', color: '#667eea' }} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1a1a2e' }}>{agent.name}</h3>
                      <span style={{ fontSize: '12px', color: '#6c757d' }}>{agent.model || 'gpt-4'}</span>
                    </div>
                  </div>
                  <span style={{
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: '600',
                    background: `${statusColors[agent.status] || statusColors.active}20`,
                    color: statusColors[agent.status] || statusColors.active
                  }}>
                    {agent.status || 'active'}
                  </span>
                </div>

                {/* Card Body */}
                <div style={{ padding: '20px' }}>
                  <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#6c757d', lineHeight: '1.5', minHeight: '42px' }}>
                    {agent.description || t('autonomous.noDescription', 'No description')}
                  </p>

                  {/* Stats */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
                    <div style={{ textAlign: 'center', padding: '12px', background: '#f8f9fa', borderRadius: '8px' }}>
                      <div style={{ fontSize: '20px', fontWeight: '700', color: '#1a1a2e' }}>{agent.total_tasks || 0}</div>
                      <div style={{ fontSize: '11px', color: '#6c757d', textTransform: 'uppercase' }}>{t('autonomous.tasks', 'Tasks')}</div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '12px', background: '#e8f5e9', borderRadius: '8px' }}>
                      <div style={{ fontSize: '20px', fontWeight: '700', color: '#2e7d32' }}>{agent.successful_tasks || 0}</div>
                      <div style={{ fontSize: '11px', color: '#6c757d', textTransform: 'uppercase' }}>{t('autonomous.success', 'Success')}</div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '12px', background: '#ffebee', borderRadius: '8px' }}>
                      <div style={{ fontSize: '20px', fontWeight: '700', color: '#c62828' }}>{agent.failed_tasks || 0}</div>
                      <div style={{ fontSize: '11px', color: '#6c757d', textTransform: 'uppercase' }}>{t('autonomous.failed', 'Failed')}</div>
                    </div>
                  </div>

                  {/* Capabilities */}
                  {agent.capabilities && agent.capabilities.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
                      {agent.capabilities.slice(0, 3).map((cap, i) => (
                        <span key={i} style={{
                          padding: '4px 8px',
                          background: '#e3f2fd',
                          color: '#1565c0',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: '500'
                        }}>
                          {cap}
                        </span>
                      ))}
                      {agent.capabilities.length > 3 && (
                        <span style={{ padding: '4px 8px', color: '#6c757d', fontSize: '11px' }}>
                          +{agent.capabilities.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Actions */}
                <div style={{ display: 'flex', gap: '8px', padding: '16px', background: '#f8f9fa', borderTop: '1px solid #f0f0f0' }}>
                  <button
                    onClick={() => handleViewTasks(agent)}
                    style={{
                      flex: 1,
                      padding: '10px',
                      background: '#667eea',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: '500'
                    }}
                  >
                    <ClipboardList style={{ width: '14px', height: '14px', marginRight: '4px', display: 'inline' }} /> {t('autonomous.viewTasks', 'Tasks')}
                  </button>
                  <button
                    onClick={() => handleEdit(agent)}
                    style={{
                      padding: '10px 16px',
                      background: '#e3f2fd',
                      color: '#1565c0',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: '500'
                    }}
                  >
                    <Pencil style={{ width: '14px', height: '14px' }} />
                  </button>
                  <button
                    onClick={() => handleDelete(agent)}
                    style={{
                      padding: '10px 16px',
                      background: '#ffebee',
                      color: '#c62828',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '13px'
                    }}
                  >
                    <Trash2 style={{ width: '14px', height: '14px' }} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showForm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '600px',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <div style={{ padding: '24px', borderBottom: '1px solid #e9ecef' }}>
              <h2 style={{ margin: 0, fontSize: '20px', color: '#1a1a2e' }}>
                {editingAgent ? t('autonomous.editAgent', 'Edit Agent') : t('autonomous.createAgent', 'Create Agent')}
              </h2>
            </div>

            <form onSubmit={handleSave} style={{ padding: '24px' }}>
              {/* Name */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#1a1a2e' }}>
                  {t('autonomous.name', 'Name')} *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #e9ecef',
                    borderRadius: '8px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                  placeholder={t('autonomous.namePlaceholder', 'Enter agent name')}
                />
              </div>

              {/* Description */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#1a1a2e' }}>
                  {t('autonomous.description', 'Description')}
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #e9ecef',
                    borderRadius: '8px',
                    fontSize: '14px',
                    resize: 'vertical',
                    boxSizing: 'border-box'
                  }}
                  placeholder={t('autonomous.descriptionPlaceholder', 'Describe what this agent does')}
                />
              </div>

              {/* Model Selection */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#1a1a2e' }}>
                    {t('autonomous.model', 'Model')}
                  </label>
                  <select
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid #e9ecef',
                      borderRadius: '8px',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                  >
                    <option value="gpt-4">GPT-4</option>
                    <option value="gpt-4-turbo">GPT-4 Turbo</option>
                    <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                    <option value="claude-3-opus">Claude 3 Opus</option>
                    <option value="claude-3-sonnet">Claude 3 Sonnet</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#1a1a2e' }}>
                    {t('autonomous.temperature', 'Temperature')}: {formData.temperature}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={formData.temperature}
                    onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
                    style={{ width: '100%', marginTop: '8px' }}
                  />
                </div>
              </div>

              {/* System Prompt */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#1a1a2e' }}>
                  {t('autonomous.systemPrompt', 'System Prompt')}
                </label>
                <textarea
                  value={formData.system_prompt}
                  onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
                  rows={5}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #e9ecef',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontFamily: 'monospace',
                    resize: 'vertical',
                    boxSizing: 'border-box'
                  }}
                  placeholder={t('autonomous.systemPromptPlaceholder', 'Define agent behavior and capabilities...')}
                />
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', paddingTop: '16px', borderTop: '1px solid #e9ecef' }}>
                <button
                  type="button"
                  onClick={handleCloseForm}
                  style={{
                    padding: '12px 24px',
                    background: '#e9ecef',
                    color: '#495057',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '500'
                  }}
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  style={{
                    padding: '12px 24px',
                    background: '#667eea',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: isSaving ? 'not-allowed' : 'pointer',
                    fontWeight: '500',
                    opacity: isSaving ? 0.7 : 1
                  }}
                >
                  {isSaving ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AutonomousAgents;
