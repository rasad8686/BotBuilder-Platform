import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Target, Search, PenTool, BarChart3, CheckSquare, MessageSquare, Globe, FileText, ClipboardList, Hash, List, Save, FileEdit, Theater, Bot, Zap, Check } from 'lucide-react';

const roleOptions = [
  { value: 'orchestrator', label: 'Orchestrator', Icon: Target, description: 'Coordinates multiple agents' },
  { value: 'researcher', label: 'Researcher', Icon: Search, description: 'Gathers and analyzes information' },
  { value: 'writer', label: 'Writer', Icon: PenTool, description: 'Creates content and documents' },
  { value: 'analyzer', label: 'Analyzer', Icon: BarChart3, description: 'Analyzes data and provides insights' },
  { value: 'reviewer', label: 'Reviewer', Icon: CheckSquare, description: 'Reviews and validates work' },
  { value: 'assistant', label: 'Assistant', Icon: MessageSquare, description: 'General purpose assistant' }
];

const modelOptions = [
  { value: 'gpt-4', label: 'GPT-4', provider: 'OpenAI' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo', provider: 'OpenAI' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo', provider: 'OpenAI' },
  { value: 'claude-3-opus', label: 'Claude 3 Opus', provider: 'Anthropic' },
  { value: 'claude-3-sonnet', label: 'Claude 3 Sonnet', provider: 'Anthropic' }
];

const capabilityOptions = [
  { id: 'web_search', label: 'Web Search', Icon: Globe },
  { id: 'analyze_text', label: 'Text Analysis', Icon: FileText },
  { id: 'format_data', label: 'Data Formatting', Icon: ClipboardList },
  { id: 'calculate', label: 'Calculations', Icon: Hash },
  { id: 'generate_list', label: 'List Generation', Icon: List },
  { id: 'save_note', label: 'Notes/Memory', Icon: Save }
];

const AgentBuilder = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const [isLoading, setIsLoading] = useState(isEditing);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [activeStep, setActiveStep] = useState(0);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    role: 'assistant',
    model: 'gpt-4',
    temperature: 0.7,
    max_tokens: 4096,
    system_prompt: '',
    capabilities: [],
    settings: {
      max_iterations: 10,
      output_format: 'markdown'
    }
  });

  const token = localStorage.getItem('token');

  useEffect(() => {
    if (isEditing) {
      fetchAgent();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchAgent = async () => {
    try {
      const res = await fetch(`/api/autonomous/agents/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) {
        throw new Error('Agent not found');
      }

      const data = await res.json();
      setFormData({
        name: data.agent.name || '',
        description: data.agent.description || '',
        role: data.agent.role || 'assistant',
        model: data.agent.model || 'gpt-4',
        temperature: data.agent.temperature || 0.7,
        max_tokens: data.agent.max_tokens || 4096,
        system_prompt: data.agent.system_prompt || '',
        capabilities: data.agent.capabilities || [],
        settings: data.agent.settings || {}
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCapabilityToggle = (capId) => {
    setFormData(prev => ({
      ...prev,
      capabilities: prev.capabilities.includes(capId)
        ? prev.capabilities.filter(c => c !== capId)
        : [...prev.capabilities, capId]
    }));
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert(t('agentBuilder.nameRequired', 'Agent name is required'));
      return;
    }

    setIsSaving(true);

    try {
      const url = isEditing
        ? `/api/autonomous/agents/${id}`
        : '/api/autonomous/agents';

      const method = isEditing ? 'PUT' : 'POST';

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

      const data = await res.json();
      navigate(`/autonomous/agents/${data.agent.id}/tasks`);
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const steps = [
    { id: 'basics', label: t('agentBuilder.basics', 'Basics'), Icon: FileEdit },
    { id: 'role', label: t('agentBuilder.role', 'Role'), Icon: Theater },
    { id: 'model', label: t('agentBuilder.model', 'Model'), Icon: Bot },
    { id: 'capabilities', label: t('agentBuilder.capabilities', 'Capabilities'), Icon: Zap },
    { id: 'review', label: t('agentBuilder.review', 'Review'), Icon: CheckSquare }
  ];

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f7fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '48px', height: '48px', border: '4px solid #e9ecef', borderTopColor: '#667eea', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }}></div>
          <p style={{ color: '#6c757d' }}>{t('common.loading', 'Loading...')}</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f7fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', padding: '40px', background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <h2 style={{ color: '#c53030', marginBottom: '8px' }}>{t('common.error', 'Error')}</h2>
          <p style={{ color: '#6c757d' }}>{error}</p>
          <button onClick={() => navigate('/autonomous')} style={{ marginTop: '16px', padding: '10px 20px', background: '#667eea', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
            {t('autonomous.backToAgents', 'Back to Agents')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa' }}>
      {/* Header */}
      <div style={{ background: 'white', borderBottom: '1px solid #e9ecef', padding: '16px 32px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <Link to="/autonomous" style={{ color: '#667eea', textDecoration: 'none', fontSize: '14px', fontWeight: '500' }}>
            ← {t('autonomous.backToAgents', 'Back to Agents')}
          </Link>
          <h1 style={{ margin: '12px 0 0 0', fontSize: '24px', color: '#1a1a2e' }}>
            {isEditing ? t('agentBuilder.editAgent', 'Edit Agent') : t('agentBuilder.createAgent', 'Create Agent')}
          </h1>
        </div>
      </div>

      {/* Progress Steps */}
      <div style={{ background: 'white', borderBottom: '1px solid #e9ecef', padding: '20px 32px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', justifyContent: 'space-between' }}>
          {steps.map((step, index) => (
            <button
              key={step.id}
              onClick={() => setActiveStep(index)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 20px',
                background: activeStep === index ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : index < activeStep ? '#d4edda' : '#f8f9fa',
                color: activeStep === index ? 'white' : index < activeStep ? '#155724' : '#6c757d',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '500',
                fontSize: '14px',
                transition: 'all 0.2s'
              }}
            >
              <step.Icon size={16} />
              {step.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '32px' }}>
        <div style={{ background: 'white', borderRadius: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', padding: '32px' }}>

          {/* Step 0: Basics */}
          {activeStep === 0 && (
            <div>
              <h2 style={{ margin: '0 0 24px 0', fontSize: '20px', color: '#1a1a2e' }}>
                {t('agentBuilder.basicInfo', 'Basic Information')}
              </h2>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#1a1a2e' }}>
                  {t('agentBuilder.agentName', 'Agent Name')} *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder={t('agentBuilder.namePlaceholder', 'e.g., Research Assistant')}
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    border: '2px solid #e9ecef',
                    borderRadius: '10px',
                    fontSize: '15px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#1a1a2e' }}>
                  {t('agentBuilder.description', 'Description')}
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  placeholder={t('agentBuilder.descriptionPlaceholder', 'Describe what this agent does...')}
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    border: '2px solid #e9ecef',
                    borderRadius: '10px',
                    fontSize: '15px',
                    resize: 'vertical',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>
          )}

          {/* Step 1: Role */}
          {activeStep === 1 && (
            <div>
              <h2 style={{ margin: '0 0 24px 0', fontSize: '20px', color: '#1a1a2e' }}>
                {t('agentBuilder.selectRole', 'Select Agent Role')}
              </h2>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                {roleOptions.map(role => (
                  <button
                    key={role.value}
                    onClick={() => handleChange('role', role.value)}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '16px',
                      padding: '20px',
                      background: formData.role === role.value ? 'linear-gradient(135deg, #667eea10 0%, #764ba210 100%)' : '#f8f9fa',
                      border: formData.role === role.value ? '2px solid #667eea' : '2px solid transparent',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.2s'
                    }}
                  >
                    <role.Icon size={32} />
                    <div>
                      <div style={{ fontWeight: '600', color: '#1a1a2e', fontSize: '16px' }}>{role.label}</div>
                      <div style={{ color: '#6c757d', fontSize: '14px', marginTop: '4px' }}>{role.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Model */}
          {activeStep === 2 && (
            <div>
              <h2 style={{ margin: '0 0 24px 0', fontSize: '20px', color: '#1a1a2e' }}>
                {t('agentBuilder.configureModel', 'Configure Model')}
              </h2>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#1a1a2e' }}>
                  {t('agentBuilder.selectModel', 'Select Model')}
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                  {modelOptions.map(model => (
                    <button
                      key={model.value}
                      onClick={() => handleChange('model', model.value)}
                      style={{
                        padding: '16px',
                        background: formData.model === model.value ? '#667eea' : '#f8f9fa',
                        color: formData.model === model.value ? 'white' : '#1a1a2e',
                        border: 'none',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{ fontWeight: '600' }}>{model.label}</div>
                      <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '4px' }}>{model.provider}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#1a1a2e' }}>
                  {t('agentBuilder.temperature', 'Temperature')}: {formData.temperature}
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={formData.temperature}
                  onChange={(e) => handleChange('temperature', parseFloat(e.target.value))}
                  style={{ width: '100%' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#6c757d' }}>
                  <span>{t('agentBuilder.precise', 'Precise')}</span>
                  <span>{t('agentBuilder.creative', 'Creative')}</span>
                </div>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#1a1a2e' }}>
                  {t('agentBuilder.systemPrompt', 'System Prompt')}
                </label>
                <textarea
                  value={formData.system_prompt}
                  onChange={(e) => handleChange('system_prompt', e.target.value)}
                  placeholder={t('agentBuilder.systemPromptPlaceholder', 'Define the agent\'s behavior and instructions...')}
                  rows={6}
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    border: '2px solid #e9ecef',
                    borderRadius: '10px',
                    fontSize: '15px',
                    resize: 'vertical',
                    fontFamily: 'monospace',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>
          )}

          {/* Step 3: Capabilities */}
          {activeStep === 3 && (
            <div>
              <h2 style={{ margin: '0 0 24px 0', fontSize: '20px', color: '#1a1a2e' }}>
                {t('agentBuilder.selectCapabilities', 'Select Capabilities')}
              </h2>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                {capabilityOptions.map(cap => (
                  <button
                    key={cap.id}
                    onClick={() => handleCapabilityToggle(cap.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '16px',
                      background: formData.capabilities.includes(cap.id) ? 'linear-gradient(135deg, #667eea10 0%, #764ba210 100%)' : '#f8f9fa',
                      border: formData.capabilities.includes(cap.id) ? '2px solid #667eea' : '2px solid transparent',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.2s'
                    }}
                  >
                    <cap.Icon size={24} />
                    <span style={{ fontWeight: '500', color: '#1a1a2e' }}>{cap.label}</span>
                    {formData.capabilities.includes(cap.id) && (
                      <span style={{ marginLeft: 'auto', color: '#667eea' }}><Check size={18} /></span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {activeStep === 4 && (
            <div>
              <h2 style={{ margin: '0 0 24px 0', fontSize: '20px', color: '#1a1a2e' }}>
                {t('agentBuilder.reviewAgent', 'Review Agent Configuration')}
              </h2>

              <div style={{ background: '#f8f9fa', borderRadius: '12px', padding: '24px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: '#6c757d', textTransform: 'uppercase', marginBottom: '4px' }}>Name</div>
                    <div style={{ fontSize: '16px', fontWeight: '600', color: '#1a1a2e' }}>{formData.name || '-'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#6c757d', textTransform: 'uppercase', marginBottom: '4px' }}>Role</div>
                    <div style={{ fontSize: '16px', fontWeight: '600', color: '#1a1a2e' }}>
                      {roleOptions.find(r => r.value === formData.role)?.label || formData.role}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#6c757d', textTransform: 'uppercase', marginBottom: '4px' }}>Model</div>
                    <div style={{ fontSize: '16px', fontWeight: '600', color: '#1a1a2e' }}>{formData.model}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#6c757d', textTransform: 'uppercase', marginBottom: '4px' }}>Temperature</div>
                    <div style={{ fontSize: '16px', fontWeight: '600', color: '#1a1a2e' }}>{formData.temperature}</div>
                  </div>
                </div>

                <div style={{ marginTop: '20px' }}>
                  <div style={{ fontSize: '12px', color: '#6c757d', textTransform: 'uppercase', marginBottom: '8px' }}>Capabilities</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {formData.capabilities.length > 0 ? (
                      formData.capabilities.map(cap => (
                        <span key={cap} style={{ padding: '6px 12px', background: '#667eea20', color: '#667eea', borderRadius: '16px', fontSize: '13px', fontWeight: '500' }}>
                          {capabilityOptions.find(c => c.id === cap)?.label || cap}
                        </span>
                      ))
                    ) : (
                      <span style={{ color: '#6c757d' }}>No capabilities selected</span>
                    )}
                  </div>
                </div>

                {formData.system_prompt && (
                  <div style={{ marginTop: '20px' }}>
                    <div style={{ fontSize: '12px', color: '#6c757d', textTransform: 'uppercase', marginBottom: '8px' }}>System Prompt</div>
                    <div style={{ background: 'white', padding: '12px', borderRadius: '8px', fontSize: '14px', color: '#495057', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                      {formData.system_prompt.substring(0, 200)}
                      {formData.system_prompt.length > 200 ? '...' : ''}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '32px', paddingTop: '24px', borderTop: '1px solid #e9ecef' }}>
            <button
              onClick={() => setActiveStep(prev => Math.max(0, prev - 1))}
              disabled={activeStep === 0}
              style={{
                padding: '12px 24px',
                background: activeStep === 0 ? '#e9ecef' : 'white',
                color: activeStep === 0 ? '#adb5bd' : '#495057',
                border: '2px solid #e9ecef',
                borderRadius: '8px',
                cursor: activeStep === 0 ? 'not-allowed' : 'pointer',
                fontWeight: '500'
              }}
            >
              {t('common.back', 'Back')}
            </button>

            {activeStep < steps.length - 1 ? (
              <button
                onClick={() => setActiveStep(prev => prev + 1)}
                style={{
                  padding: '12px 24px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                {t('common.next', 'Next')}
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={isSaving}
                style={{
                  padding: '12px 32px',
                  background: isSaving ? '#a0aec0' : 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {isSaving ? (
                  <>
                    <span style={{ width: '16px', height: '16px', border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></span>
                    {t('common.saving', 'Saving...')}
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    {isEditing ? t('common.save', 'Save Changes') : t('agentBuilder.createAgent', 'Create Agent')}
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default AgentBuilder;
