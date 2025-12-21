import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const CloneSettings = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();

  const [clone, setClone] = useState(null);
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('general');

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    ai_model: 'gpt-4',
    temperature: 0.7,
    max_tokens: 2048,
    personality_prompt: '',
    writing_style_prompt: '',
    base_system_prompt: '',
    tone_settings: {
      friendliness: 7,
      formality: 5,
      enthusiasm: 6,
      directness: 6
    },
    is_active: true
  });

  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [cloneRes, statsRes] = await Promise.all([
        fetch(`/api/clones/${id}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`/api/clones/${id}/stats`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      if (!cloneRes.ok) throw new Error('Clone not found');

      const cloneData = await cloneRes.json();
      const statsData = await statsRes.json();

      setClone(cloneData.clone);
      setStats(statsData);
      setFormData({
        name: cloneData.clone.name || '',
        description: cloneData.clone.description || '',
        ai_model: cloneData.clone.ai_model || 'gpt-4',
        temperature: cloneData.clone.temperature || 0.7,
        max_tokens: cloneData.clone.max_tokens || 2048,
        personality_prompt: cloneData.clone.personality_prompt || '',
        writing_style_prompt: cloneData.clone.writing_style_prompt || '',
        base_system_prompt: cloneData.clone.base_system_prompt || '',
        tone_settings: cloneData.clone.tone_settings || {
          friendliness: 7,
          formality: 5,
          enthusiasm: 6,
          directness: 6
        },
        is_active: cloneData.clone.is_active !== false
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/clones/${id}`, {
        method: 'PUT',
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
      setClone(result.clone);
      alert(t('clone.settingsSaved'));
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(t('clone.deleteConfirm', { name: clone.name }))) return;
    if (!window.confirm(t('clone.deleteConfirmFinal'))) return;

    try {
      const res = await fetch(`/api/clones/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to delete');
      navigate('/work-clone');
    } catch (err) {
      alert(err.message);
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

  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f7fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>❌</div>
          <p style={{ color: '#e53e3e' }}>{error}</p>
          <button onClick={() => navigate('/work-clone')} style={{ marginTop: '16px', padding: '10px 24px', borderRadius: '8px', background: '#667eea', color: 'white', border: 'none', cursor: 'pointer' }}>
            {t('common.back')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa', padding: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#667eea' }}>
            ←
          </button>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1a202c', margin: 0 }}>
              {t('clone.settingsTitle')}: {clone?.name}
            </h1>
            <p style={{ color: '#718096', marginTop: '4px' }}>{t('clone.settingsSubtitle')}</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '8px',
            fontWeight: '500',
            cursor: isSaving ? 'not-allowed' : 'pointer',
            opacity: isSaving ? 0.7 : 1
          }}
        >
          {isSaving ? t('common.saving') : t('common.saveChanges')}
        </button>
      </div>

      {/* Stats Overview */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <div style={{ color: '#a0aec0', fontSize: '13px', marginBottom: '4px' }}>{t('clone.totalResponses')}</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#2d3748' }}>{stats?.usage?.total_responses || 0}</div>
        </div>
        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <div style={{ color: '#a0aec0', fontSize: '13px', marginBottom: '4px' }}>{t('clone.avgRating')}</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#48bb78' }}>{stats?.usage?.avg_rating || '-'}</div>
        </div>
        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <div style={{ color: '#a0aec0', fontSize: '13px', marginBottom: '4px' }}>{t('clone.totalTokens')}</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#2d3748' }}>
            {((stats?.usage?.total_input_tokens || 0) + (stats?.usage?.total_output_tokens || 0)).toLocaleString()}
          </div>
        </div>
        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <div style={{ color: '#a0aec0', fontSize: '13px', marginBottom: '4px' }}>{t('clone.avgSimilarity')}</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#667eea' }}>
            {stats?.usage?.avg_similarity ? `${Math.round(stats.usage.avg_similarity * 100)}%` : '-'}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
        {['general', 'personality', 'advanced'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '10px 20px',
              borderRadius: '8px 8px 0 0',
              border: 'none',
              background: activeTab === tab ? '#667eea' : 'transparent',
              color: activeTab === tab ? 'white' : '#4a5568',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            {t(`clone.tabs.${tab}`)}
          </button>
        ))}
      </div>

      {/* Settings Form */}
      <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', padding: '24px' }}>
        {activeTab === 'general' && (
          <div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#4a5568' }}>
                {t('clone.name')} *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  fontSize: '14px'
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#4a5568' }}>
                {t('clone.description')}
              </label>
              <textarea
                value={formData.description}
                onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  fontSize: '14px',
                  resize: 'vertical'
                }}
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
              <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={e => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                  style={{ width: '18px', height: '18px' }}
                />
                <span style={{ fontWeight: '500', color: '#4a5568' }}>{t('clone.isActive')}</span>
              </label>
              <p style={{ margin: '4px 0 0 30px', fontSize: '13px', color: '#a0aec0' }}>
                {t('clone.isActiveDescription')}
              </p>
            </div>
          </div>
        )}

        {activeTab === 'personality' && (
          <div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#4a5568' }}>
                {t('clone.personality')}
              </label>
              <textarea
                value={formData.personality_prompt}
                onChange={e => setFormData(prev => ({ ...prev, personality_prompt: e.target.value }))}
                rows={5}
                style={{
                  width: '100%',
                  padding: '12px 14px',
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
                rows={5}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  fontSize: '14px',
                  resize: 'vertical'
                }}
                placeholder={t('clone.writingStylePlaceholder')}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '12px', fontWeight: '500', color: '#4a5568' }}>
                {t('clone.toneSettings')}
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                {['friendliness', 'formality', 'enthusiasm', 'directness'].map(key => (
                  <div key={key}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '14px', color: '#718096' }}>{t(`clone.tone.${key}`)}</span>
                      <span style={{ fontSize: '14px', fontWeight: '600', color: '#4a5568' }}>{formData.tone_settings[key]}/10</span>
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
          </div>
        )}

        {activeTab === 'advanced' && (
          <div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#4a5568' }}>
                {t('clone.systemPrompt')}
              </label>
              <textarea
                value={formData.base_system_prompt}
                onChange={e => setFormData(prev => ({ ...prev, base_system_prompt: e.target.value }))}
                rows={10}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  fontSize: '14px',
                  resize: 'vertical',
                  fontFamily: 'monospace'
                }}
                placeholder={t('clone.systemPromptPlaceholder')}
              />
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#a0aec0' }}>
                {t('clone.systemPromptHint')}
              </p>
            </div>

            {clone?.style_profile && Object.keys(clone.style_profile).length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '12px', fontWeight: '500', color: '#4a5568' }}>
                  {t('clone.learnedStyleProfile')}
                </label>
                <div style={{ background: '#f7fafc', padding: '16px', borderRadius: '8px' }}>
                  <pre style={{ margin: 0, fontSize: '13px', color: '#4a5568', whiteSpace: 'pre-wrap' }}>
                    {JSON.stringify(clone.style_profile, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid #e2e8f0' }}>
              <h4 style={{ color: '#e53e3e', marginBottom: '12px' }}>{t('clone.dangerZone')}</h4>
              <p style={{ color: '#718096', fontSize: '14px', marginBottom: '16px' }}>
                {t('clone.deleteWarning')}
              </p>
              <button
                onClick={handleDelete}
                style={{
                  padding: '10px 24px',
                  borderRadius: '8px',
                  border: '1px solid #e53e3e',
                  background: 'white',
                  color: '#e53e3e',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                {t('clone.deleteClone')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CloneSettings;
