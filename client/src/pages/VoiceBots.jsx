import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axiosInstance from '../api/axios';

const statusColors = {
  active: '#48bb78',
  inactive: '#718096',
  paused: '#ed8936'
};

const VoiceBots = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [bots, setBots] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingBot, setEditingBot] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    voice_provider: 'elevenlabs',
    voice_id: '',
    stt_provider: 'whisper',
    tts_provider: 'elevenlabs',
    ai_model: 'gpt-4',
    system_prompt: '',
    greeting_message: 'Hello! How can I help you today?',
    fallback_message: "I'm sorry, I didn't understand that. Could you please repeat?",
    max_call_duration: 600,
    language: 'en-US'
  });

  useEffect(() => {
    fetchBots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchBots = async () => {
    setIsLoading(true);
    try {
      const response = await axiosInstance.get('/api/voice/bots');
      setBots(response.data.bots || []);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingBot(null);
    setFormData({
      name: '',
      description: '',
      voice_provider: 'elevenlabs',
      voice_id: '',
      stt_provider: 'whisper',
      tts_provider: 'elevenlabs',
      ai_model: 'gpt-4',
      system_prompt: '',
      greeting_message: 'Hello! How can I help you today?',
      fallback_message: "I'm sorry, I didn't understand that. Could you please repeat?",
      max_call_duration: 600,
      language: 'en-US'
    });
    setShowForm(true);
  };

  const handleEdit = (bot) => {
    setEditingBot(bot);
    setFormData({
      name: bot.name,
      description: bot.description || '',
      voice_provider: bot.voice_provider || 'elevenlabs',
      voice_id: bot.voice_id || '',
      stt_provider: bot.stt_provider || 'whisper',
      tts_provider: bot.tts_provider || 'elevenlabs',
      ai_model: bot.ai_model || 'gpt-4',
      system_prompt: bot.system_prompt || '',
      greeting_message: bot.greeting_message || 'Hello! How can I help you today?',
      fallback_message: bot.fallback_message || "I'm sorry, I didn't understand that.",
      max_call_duration: bot.max_call_duration || 600,
      language: bot.language || 'en-US'
    });
    setShowForm(true);
  };

  const handleDelete = async (bot) => {
    if (!window.confirm(t('voice.deleteConfirm', { name: bot.name }))) return;
    try {
      await axiosInstance.delete(`/api/voice/bots/${bot.id}`);
      setBots(prev => prev.filter(b => b.id !== bot.id));
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const url = editingBot ? `/api/voice/bots/${editingBot.id}` : '/api/voice/bots';
      const response = editingBot
        ? await axiosInstance.put(url, formData)
        : await axiosInstance.post(url, formData);
      const result = response.data;
      if (editingBot) {
        setBots(prev => prev.map(b => b.id === result.bot.id ? result.bot : b));
      } else {
        setBots(prev => [...prev, result.bot]);
      }
      setShowForm(false);
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    } finally {
      setIsSaving(false);
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
    <div style={{ minHeight: '100vh', background: '#f5f7fa', padding: '32px' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#1a1a2e', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '32px' }}>📞</span>
              {t('voice.title', 'Voice AI Bots')}
            </h1>
            <p style={{ color: '#6c757d', margin: 0 }}>
              {t('voice.subtitle', 'Create AI-powered voice agents for phone calls')}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => navigate('/call-history')}
              style={{
                padding: '12px 24px',
                background: '#e3f2fd',
                color: '#1565c0',
                border: 'none',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              📋 {t('voice.callHistory', 'Call History')}
            </button>
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
              {t('voice.createBot', 'Create Voice Bot')}
            </button>
          </div>
        </div>

        {/* Bots Grid */}
        {bots.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 40px', background: 'white', borderRadius: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>📞</div>
            <h2 style={{ color: '#1a1a2e', marginBottom: '8px' }}>{t('voice.noBots', 'No Voice Bots Yet')}</h2>
            <p style={{ color: '#6c757d', marginBottom: '24px' }}>{t('voice.noBotsDesc', 'Create your first voice bot to start handling phone calls')}</p>
            <button onClick={handleCreate} style={{ padding: '12px 24px', background: '#667eea', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '500' }}>
              {t('voice.createFirstBot', 'Create Your First Voice Bot')}
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '24px' }}>
            {bots.map(bot => (
              <div key={bot.id} style={{ background: 'white', borderRadius: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
                <div style={{ padding: '20px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, #667eea20 0%, #764ba220 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
                      📞
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1a1a2e' }}>{bot.name}</h3>
                      <span style={{ fontSize: '12px', color: '#6c757d' }}>{bot.ai_model || 'gpt-4'}</span>
                    </div>
                  </div>
                  <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', background: `${statusColors[bot.status] || statusColors.active}20`, color: statusColors[bot.status] || statusColors.active }}>
                    {bot.status || 'active'}
                  </span>
                </div>

                <div style={{ padding: '20px' }}>
                  <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#6c757d', lineHeight: '1.5', minHeight: '42px' }}>
                    {bot.description || t('voice.noDescription', 'No description')}
                  </p>

                  {bot.phone_number && (
                    <div style={{ marginBottom: '16px', padding: '12px', background: '#e8f5e9', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>📱</span>
                      <span style={{ fontWeight: '600', color: '#2e7d32' }}>{bot.phone_number}</span>
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '16px' }}>
                    <div style={{ textAlign: 'center', padding: '12px', background: '#f8f9fa', borderRadius: '8px' }}>
                      <div style={{ fontSize: '20px', fontWeight: '700', color: '#1a1a2e' }}>{bot.total_calls || 0}</div>
                      <div style={{ fontSize: '11px', color: '#6c757d' }}>{t('voice.totalCalls', 'Total Calls')}</div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '12px', background: '#f8f9fa', borderRadius: '8px' }}>
                      <div style={{ fontSize: '20px', fontWeight: '700', color: '#1a1a2e' }}>{Math.round((bot.total_duration || 0) / 60)}m</div>
                      <div style={{ fontSize: '11px', color: '#6c757d' }}>{t('voice.totalDuration', 'Duration')}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
                    <span style={{ padding: '4px 8px', background: '#e3f2fd', color: '#1565c0', borderRadius: '4px', fontSize: '11px' }}>
                      {bot.voice_provider || 'elevenlabs'}
                    </span>
                    <span style={{ padding: '4px 8px', background: '#fff3e0', color: '#e65100', borderRadius: '4px', fontSize: '11px' }}>
                      {bot.language || 'en-US'}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', padding: '16px', background: '#f8f9fa', borderTop: '1px solid #f0f0f0' }}>
                  <button onClick={() => navigate(`/call-history?botId=${bot.id}`)} style={{ flex: 1, padding: '10px', background: '#667eea', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>
                    📋 {t('voice.viewCalls', 'Calls')}
                  </button>
                  <button onClick={() => handleEdit(bot)} style={{ padding: '10px 16px', background: '#e3f2fd', color: '#1565c0', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}>
                    ✏️
                  </button>
                  <button onClick={() => handleDelete(bot)} style={{ padding: '10px 16px', background: '#ffebee', color: '#c62828', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}>
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showForm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ padding: '24px', borderBottom: '1px solid #e9ecef' }}>
              <h2 style={{ margin: 0, fontSize: '20px', color: '#1a1a2e' }}>
                {editingBot ? t('voice.editBot', 'Edit Voice Bot') : t('voice.createBot', 'Create Voice Bot')}
              </h2>
            </div>

            <form onSubmit={handleSave} style={{ padding: '24px' }}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#1a1a2e' }}>{t('voice.name', 'Name')} *</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required style={{ width: '100%', padding: '12px', border: '1px solid #e9ecef', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }} placeholder={t('voice.namePlaceholder', 'Enter bot name')} />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#1a1a2e' }}>{t('voice.description', 'Description')}</label>
                <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={2} style={{ width: '100%', padding: '12px', border: '1px solid #e9ecef', borderRadius: '8px', fontSize: '14px', resize: 'vertical', boxSizing: 'border-box' }} placeholder={t('voice.descriptionPlaceholder', 'Describe the bot purpose')} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#1a1a2e' }}>{t('voice.aiModel', 'AI Model')}</label>
                  <select value={formData.ai_model} onChange={(e) => setFormData({ ...formData, ai_model: e.target.value })} style={{ width: '100%', padding: '12px', border: '1px solid #e9ecef', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }}>
                    <option value="gpt-4">GPT-4</option>
                    <option value="gpt-4-turbo">GPT-4 Turbo</option>
                    <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                    <option value="claude-3-opus">Claude 3 Opus</option>
                    <option value="claude-3-sonnet">Claude 3 Sonnet</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#1a1a2e' }}>{t('voice.language', 'Language')}</label>
                  <select value={formData.language} onChange={(e) => setFormData({ ...formData, language: e.target.value })} style={{ width: '100%', padding: '12px', border: '1px solid #e9ecef', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }}>
                    <option value="en-US">English (US)</option>
                    <option value="en-GB">English (UK)</option>
                    <option value="es-ES">Spanish</option>
                    <option value="fr-FR">French</option>
                    <option value="de-DE">German</option>
                    <option value="it-IT">Italian</option>
                    <option value="pt-BR">Portuguese</option>
                    <option value="ru-RU">Russian</option>
                    <option value="tr-TR">Turkish</option>
                    <option value="az-AZ">Azerbaijani</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#1a1a2e' }}>{t('voice.voiceProvider', 'Voice Provider')}</label>
                  <select value={formData.voice_provider} onChange={(e) => setFormData({ ...formData, voice_provider: e.target.value })} style={{ width: '100%', padding: '12px', border: '1px solid #e9ecef', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }}>
                    <option value="elevenlabs">ElevenLabs</option>
                    <option value="openai">OpenAI TTS</option>
                    <option value="google">Google TTS</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#1a1a2e' }}>{t('voice.sttProvider', 'Speech-to-Text')}</label>
                  <select value={formData.stt_provider} onChange={(e) => setFormData({ ...formData, stt_provider: e.target.value })} style={{ width: '100%', padding: '12px', border: '1px solid #e9ecef', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }}>
                    <option value="whisper">OpenAI Whisper</option>
                    <option value="google">Google Speech</option>
                    <option value="deepgram">Deepgram</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#1a1a2e' }}>{t('voice.greeting', 'Greeting Message')}</label>
                <textarea value={formData.greeting_message} onChange={(e) => setFormData({ ...formData, greeting_message: e.target.value })} rows={2} style={{ width: '100%', padding: '12px', border: '1px solid #e9ecef', borderRadius: '8px', fontSize: '14px', resize: 'vertical', boxSizing: 'border-box' }} />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#1a1a2e' }}>{t('voice.systemPrompt', 'System Prompt')}</label>
                <textarea value={formData.system_prompt} onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })} rows={4} style={{ width: '100%', padding: '12px', border: '1px solid #e9ecef', borderRadius: '8px', fontSize: '14px', fontFamily: 'monospace', resize: 'vertical', boxSizing: 'border-box' }} placeholder={t('voice.systemPromptPlaceholder', 'Define bot behavior...')} />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', paddingTop: '16px', borderTop: '1px solid #e9ecef' }}>
                <button type="button" onClick={() => setShowForm(false)} style={{ padding: '12px 24px', background: '#e9ecef', color: '#495057', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '500' }}>
                  {t('common.cancel', 'Cancel')}
                </button>
                <button type="submit" disabled={isSaving} style={{ padding: '12px 24px', background: '#667eea', color: 'white', border: 'none', borderRadius: '8px', cursor: isSaving ? 'not-allowed' : 'pointer', fontWeight: '500', opacity: isSaving ? 0.7 : 1 }}>
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

export default VoiceBots;
