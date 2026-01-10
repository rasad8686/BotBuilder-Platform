import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { User } from 'lucide-react';

const statusColors = {
  draft: '#718096',
  training: '#ed8936',
  ready: '#48bb78',
  paused: '#a0aec0'
};

const statusLabels = {
  draft: 'Draft',
  training: 'Training',
  ready: 'Ready',
  paused: 'Paused'
};

const WorkClone = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [clones, setClones] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingClone, setEditingClone] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [testClone, setTestClone] = useState(null);
  const [testPrompt, setTestPrompt] = useState('');
  const [testResult, setTestResult] = useState(null);
  const [isTesting, setIsTesting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    ai_model: 'gpt-4',
    temperature: 0.7,
    max_tokens: 2048,
    personality_prompt: '',
    writing_style_prompt: '',
    tone_settings: {
      friendliness: 7,
      formality: 5,
      enthusiasm: 6,
      directness: 6
    }
  });

  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchClones();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchClones = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/clones', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch clones');
      const data = await res.json();
      setClones(data.clones || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingClone(null);
    setFormData({
      name: '',
      description: '',
      ai_model: 'gpt-4',
      temperature: 0.7,
      max_tokens: 2048,
      personality_prompt: '',
      writing_style_prompt: '',
      tone_settings: {
        friendliness: 7,
        formality: 5,
        enthusiasm: 6,
        directness: 6
      }
    });
    setShowForm(true);
  };

  const handleEdit = (clone) => {
    setEditingClone(clone);
    setFormData({
      name: clone.name,
      description: clone.description || '',
      ai_model: clone.ai_model || 'gpt-4',
      temperature: clone.temperature || 0.7,
      max_tokens: clone.max_tokens || 2048,
      personality_prompt: clone.personality_prompt || '',
      writing_style_prompt: clone.writing_style_prompt || '',
      tone_settings: clone.tone_settings || {
        friendliness: 7,
        formality: 5,
        enthusiasm: 6,
        directness: 6
      }
    });
    setShowForm(true);
  };

  const handleDelete = async (clone) => {
    if (!window.confirm(t('clone.deleteConfirm', { name: clone.name }))) return;
    try {
      const res = await fetch(`/api/clones/${clone.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to delete');
      setClones(prev => prev.filter(c => c.id !== clone.id));
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const url = editingClone ? `/api/clones/${editingClone.id}` : '/api/clones';
      const method = editingClone ? 'PUT' : 'POST';
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
        throw new Error(data.error || 'Failed to save');
      }
      const result = await res.json();
      if (editingClone) {
        setClones(prev => prev.map(c => c.id === result.clone.id ? result.clone : c));
      } else {
        setClones(prev => [...prev, result.clone]);
      }
      setShowForm(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = (clone) => {
    setTestClone(clone);
    setTestPrompt('');
    setTestResult(null);
    setShowTestModal(true);
  };

  const runTest = async () => {
    if (!testPrompt.trim() || !testClone) return;
    setIsTesting(true);
    try {
      const res = await fetch(`/api/clones/${testClone.id}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ prompt: testPrompt })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      setTestResult(data);
    } catch (err) {
      setTestResult({ error: err.message });
    } finally {
      setIsTesting(false);
    }
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

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa', padding: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#1a202c', margin: 0 }}>{t('clone.title')}</h1>
          <p style={{ color: '#718096', marginTop: '4px' }}>{t('clone.subtitle')}</p>
        </div>
        <button
          onClick={handleCreate}
          style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          + {t('clone.createNew')}
        </button>
      </div>

      {error && (
        <div style={{ background: '#fed7d7', color: '#c53030', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px' }}>
          {error}
        </div>
      )}

      {/* Clones Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
        {clones.map(clone => (
          <div key={clone.id} style={{
            background: 'white',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '20px',
                  fontWeight: 'bold'
                }}>
                  {clone.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1a202c' }}>{clone.name}</h3>
                  <span style={{
                    display: 'inline-block',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: '500',
                    background: statusColors[clone.status] + '20',
                    color: statusColors[clone.status],
                    marginTop: '4px'
                  }}>
                    {t(`clone.status.${clone.status}`) || statusLabels[clone.status]}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => handleEdit(clone)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#667eea', fontSize: '18px' }} title={t('common.edit')}>
                  ✎
                </button>
                <button onClick={() => handleDelete(clone)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e53e3e', fontSize: '18px' }} title={t('common.delete')}>
                  ×
                </button>
              </div>
            </div>

            <p style={{ color: '#718096', fontSize: '14px', margin: '0 0 16px', minHeight: '40px' }}>
              {clone.description || t('clone.noDescription')}
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div style={{ background: '#f7fafc', padding: '8px 12px', borderRadius: '6px' }}>
                <span style={{ color: '#a0aec0', fontSize: '11px', display: 'block' }}>{t('clone.trainingSamples')}</span>
                <span style={{ color: '#2d3748', fontWeight: '600' }}>{clone.training_count || 0}</span>
              </div>
              <div style={{ background: '#f7fafc', padding: '8px 12px', borderRadius: '6px' }}>
                <span style={{ color: '#a0aec0', fontSize: '11px', display: 'block' }}>{t('clone.trainingScore')}</span>
                <span style={{ color: '#2d3748', fontWeight: '600' }}>{clone.training_score || 0}%</span>
              </div>
              <div style={{ background: '#f7fafc', padding: '8px 12px', borderRadius: '6px' }}>
                <span style={{ color: '#a0aec0', fontSize: '11px', display: 'block' }}>{t('clone.model')}</span>
                <span style={{ color: '#2d3748', fontWeight: '600' }}>{clone.ai_model || 'gpt-4'}</span>
              </div>
              <div style={{ background: '#f7fafc', padding: '8px 12px', borderRadius: '6px' }}>
                <span style={{ color: '#a0aec0', fontSize: '11px', display: 'block' }}>{t('clone.responses')}</span>
                <span style={{ color: '#2d3748', fontWeight: '600' }}>{clone.response_count || 0}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => navigate(`/clone-training/${clone.id}`)}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '6px',
                  border: '1px solid #667eea',
                  background: 'white',
                  color: '#667eea',
                  fontWeight: '500',
                  cursor: 'pointer',
                  fontSize: '13px'
                }}
              >
                {t('clone.train')}
              </button>
              {clone.status === 'ready' && (
                <button
                  onClick={() => handleTest(clone)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '6px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    fontWeight: '500',
                    cursor: 'pointer',
                    fontSize: '13px'
                  }}
                >
                  {t('clone.test')}
                </button>
              )}
            </div>
          </div>
        ))}

        {clones.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}><User size={64} style={{ color: '#a0aec0', margin: '0 auto' }} /></div>
            <h3 style={{ color: '#2d3748', marginBottom: '8px' }}>{t('clone.noClones')}</h3>
            <p style={{ color: '#718096', marginBottom: '24px' }}>{t('clone.createFirst')}</p>
            <button
              onClick={handleCreate}
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              {t('clone.createNew')}
            </button>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showForm && (
        <div style={{
          position: 'fixed',
          inset: 0,
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
            <div style={{ padding: '24px', borderBottom: '1px solid #e2e8f0' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>
                {editingClone ? t('clone.editClone') : t('clone.createNew')}
              </h2>
            </div>
            <form onSubmit={handleSave} style={{ padding: '24px' }}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#4a5568' }}>
                  {t('clone.name')} *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    fontSize: '14px'
                  }}
                  placeholder={t('clone.namePlaceholder')}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#4a5568' }}>
                  {t('clone.description')}
                </label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    fontSize: '14px',
                    resize: 'vertical'
                  }}
                  placeholder={t('clone.descriptionPlaceholder')}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#4a5568' }}>
                    {t('clone.aiModel')}
                  </label>
                  <select
                    value={formData.ai_model}
                    onChange={e => setFormData(prev => ({ ...prev, ai_model: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      fontSize: '14px'
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
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#4a5568' }}>
                    {t('clone.temperature')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="2"
                    step="0.1"
                    value={formData.temperature}
                    onChange={e => setFormData(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      fontSize: '14px'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#4a5568' }}>
                    {t('clone.maxTokens')}
                  </label>
                  <input
                    type="number"
                    min="100"
                    max="8192"
                    value={formData.max_tokens}
                    onChange={e => setFormData(prev => ({ ...prev, max_tokens: parseInt(e.target.value) }))}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      fontSize: '14px'
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#4a5568' }}>
                  {t('clone.personality')}
                </label>
                <textarea
                  value={formData.personality_prompt}
                  onChange={e => setFormData(prev => ({ ...prev, personality_prompt: e.target.value }))}
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    fontSize: '14px',
                    resize: 'vertical'
                  }}
                  placeholder={t('clone.personalityPlaceholder')}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#4a5568' }}>
                  {t('clone.writingStyle')}
                </label>
                <textarea
                  value={formData.writing_style_prompt}
                  onChange={e => setFormData(prev => ({ ...prev, writing_style_prompt: e.target.value }))}
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    fontSize: '14px',
                    resize: 'vertical'
                  }}
                  placeholder={t('clone.writingStylePlaceholder')}
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '12px', fontWeight: '500', color: '#4a5568' }}>
                  {t('clone.toneSettings')}
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  {['friendliness', 'formality', 'enthusiasm', 'directness'].map(key => (
                    <div key={key}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '13px', color: '#718096' }}>{t(`clone.tone.${key}`)}</span>
                        <span style={{ fontSize: '13px', fontWeight: '600', color: '#4a5568' }}>{formData.tone_settings[key]}/10</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={formData.tone_settings[key]}
                        onChange={e => setFormData(prev => ({
                          ...prev,
                          tone_settings: { ...prev.tone_settings, [key]: parseInt(e.target.value) }
                        }))}
                        style={{ width: '100%' }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    background: 'white',
                    color: '#4a5568',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  style={{
                    padding: '10px 24px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    fontWeight: '500',
                    cursor: isSaving ? 'not-allowed' : 'pointer',
                    opacity: isSaving ? 0.7 : 1
                  }}
                >
                  {isSaving ? t('common.saving') : t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Test Modal */}
      {showTestModal && testClone && (
        <div style={{
          position: 'fixed',
          inset: 0,
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
            maxWidth: '700px',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <div style={{ padding: '24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>
                {t('clone.testClone')}: {testClone.name}
              </h2>
              <button onClick={() => setShowTestModal(false)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#a0aec0' }}>×</button>
            </div>
            <div style={{ padding: '24px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#4a5568' }}>
                  {t('clone.testPrompt')}
                </label>
                <textarea
                  value={testPrompt}
                  onChange={e => setTestPrompt(e.target.value)}
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    fontSize: '14px',
                    resize: 'vertical'
                  }}
                  placeholder={t('clone.testPromptPlaceholder')}
                />
              </div>
              <button
                onClick={runTest}
                disabled={isTesting || !testPrompt.trim()}
                style={{
                  padding: '10px 24px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  fontWeight: '500',
                  cursor: isTesting ? 'not-allowed' : 'pointer',
                  opacity: isTesting || !testPrompt.trim() ? 0.7 : 1,
                  marginBottom: '20px'
                }}
              >
                {isTesting ? t('clone.generating') : t('clone.generate')}
              </button>

              {testResult && (
                <div style={{ marginTop: '20px' }}>
                  <h4 style={{ marginBottom: '12px', color: '#4a5568' }}>{t('clone.generatedResponse')}</h4>
                  {testResult.error ? (
                    <div style={{ background: '#fed7d7', color: '#c53030', padding: '12px 16px', borderRadius: '8px' }}>
                      {testResult.error}
                    </div>
                  ) : (
                    <>
                      <div style={{
                        background: '#f7fafc',
                        padding: '16px',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        whiteSpace: 'pre-wrap',
                        fontSize: '14px',
                        color: '#2d3748',
                        marginBottom: '12px'
                      }}>
                        {testResult.response}
                      </div>
                      <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: '#718096' }}>
                        <span>{t('clone.tokens')}: {testResult.tokens?.input || 0} / {testResult.tokens?.output || 0}</span>
                        <span>{t('clone.latency')}: {testResult.latencyMs}ms</span>
                        <span>{t('clone.similarity')}: {Math.round((testResult.similarity || 0) * 100)}%</span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkClone;
