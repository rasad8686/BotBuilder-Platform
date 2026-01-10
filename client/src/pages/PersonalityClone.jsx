import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Smile, Briefcase, Sparkles, Target, Heart, Laugh, Timer, Palette, MessageSquare } from 'lucide-react';

const PersonalityClone = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();

  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [job, setJob] = useState(null);
  const [samples, setSamples] = useState([]);
  const [conversationInput, setConversationInput] = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [personalityProfile, setPersonalityProfile] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    personalityName: ''
  });

  const token = localStorage.getItem('token');

  const traitLabels = {
    friendliness: { label: 'Friendliness', Icon: Smile, low: 'Reserved', high: 'Warm' },
    formality: { label: 'Formality', Icon: Briefcase, low: 'Casual', high: 'Formal' },
    enthusiasm: { label: 'Enthusiasm', Icon: Sparkles, low: 'Calm', high: 'Energetic' },
    directness: { label: 'Directness', Icon: Target, low: 'Subtle', high: 'Direct' },
    empathy: { label: 'Empathy', Icon: Heart, low: 'Detached', high: 'Empathetic' },
    humor: { label: 'Humor', Icon: Laugh, low: 'Serious', high: 'Playful' },
    patience: { label: 'Patience', Icon: Timer, low: 'Brief', high: 'Patient' },
    creativity: { label: 'Creativity', Icon: Palette, low: 'Practical', high: 'Creative' }
  };

  useEffect(() => {
    if (id) {
      fetchJob();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchJob = async () => {
    setIsLoading(true);
    try {
      const [jobRes, samplesRes] = await Promise.all([
        fetch(`/api/clones/jobs/${id}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`/api/clones/jobs/${id}/samples`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      if (!jobRes.ok) throw new Error('Clone job not found');

      const jobData = await jobRes.json();
      const samplesData = await samplesRes.json();

      setJob(jobData.job);
      setSamples(samplesData.samples || []);
      setFormData({
        name: jobData.job.name || '',
        description: jobData.job.description || '',
        personalityName: jobData.job.personality_name || ''
      });

      if (jobData.job.status === 'ready') {
        setStep(4);
        fetchPersonalityProfile(id);
      } else if (samplesData.samples?.length > 0) {
        setStep(2);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPersonalityProfile = async (jobId) => {
    try {
      const res = await fetch(`/api/clones/jobs/${jobId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.job && data.job.traits) {
          setPersonalityProfile({
            traits: typeof data.job.traits === 'string' ? JSON.parse(data.job.traits) : data.job.traits,
            humorLevel: data.job.humor_level,
            empathyLevel: data.job.empathy_level,
            formalityLevel: data.job.formality_level,
            enthusiasmLevel: data.job.enthusiasm_level,
            directnessLevel: data.job.directness_level,
            systemPrompt: data.job.system_prompt
          });
        }
      }
    } catch (err) {
      console.error('Error fetching personality profile:', err);
    }
  };

  const handleCreate = async () => {
    if (!formData.name) {
      alert(t('clone.nameRequired', 'Name is required'));
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/clones/personality', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (!res.ok) throw new Error('Failed to create personality clone');

      const data = await res.json();
      setJob(data.job);
      navigate(`/clone/personality/${data.job.id}`, { replace: true });
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddConversation = async () => {
    if (!conversationInput.trim()) {
      alert(t('clone.conversationRequired', 'Please enter conversation data'));
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`/api/clones/jobs/${job.id}/samples`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          type: 'chat_history',
          content: conversationInput
        })
      });

      if (!res.ok) throw new Error('Failed to add sample');

      setConversationInput('');

      // Refresh samples
      const samplesRes = await fetch(`/api/clones/jobs/${job.id}/samples`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const samplesData = await samplesRes.json();
      setSamples(samplesData.samples || []);
    } catch (err) {
      alert(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSample = async (sampleId) => {
    try {
      await fetch(`/api/clones/jobs/${job.id}/samples/${sampleId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      setSamples(samples.filter(s => s.id !== sampleId));
    } catch (err) {
      alert('Failed to delete sample');
    }
  };

  const handleTrain = async () => {
    if (samples.length < 5) {
      alert(t('clone.needMoreConversations', 'At least 5 conversation samples are required'));
      return;
    }

    setIsLoading(true);
    setStep(3);

    try {
      const res = await fetch(`/api/clones/personality/${job.id}/train`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Training failed');
      }

      // Poll for status
      const pollStatus = async () => {
        const statusRes = await fetch(`/api/clones/status/${job.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const statusData = await statusRes.json();

        if (statusData.status === 'ready') {
          setJob(prev => ({ ...prev, status: 'ready' }));
          fetchPersonalityProfile(job.id);
          setStep(4);
        } else if (statusData.status === 'failed') {
          throw new Error(statusData.error || 'Training failed');
        } else {
          setJob(prev => ({ ...prev, training_progress: statusData.progress }));
          setTimeout(pollStatus, 2000);
        }
      };

      pollStatus();
    } catch (err) {
      setError(err.message);
      setStep(2);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!testMessage.trim()) return;

    const userMessage = testMessage;
    setTestMessage('');
    setChatHistory(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsGenerating(true);

    try {
      const res = await fetch(`/api/clones/personality/${job.id}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: userMessage,
          conversationHistory: chatHistory
        })
      });

      if (!res.ok) throw new Error('Failed to generate response');

      const data = await res.json();
      setChatHistory(prev => [...prev, { role: 'assistant', content: data.response }]);
    } catch (err) {
      setChatHistory(prev => [...prev, { role: 'error', content: err.message }]);
    } finally {
      setIsGenerating(false);
    }
  };

  if (isLoading && !job) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f7fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '48px', height: '48px', border: '4px solid #e9ecef', borderTopColor: '#38ef7d', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }}></div>
          <p style={{ color: '#6c757d' }}>{t('common.loading')}</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa', padding: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <button onClick={() => navigate('/clone-dashboard')} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#38ef7d' }}>
          <span role="img" aria-label="back">←</span>
        </button>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1a202c', margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span role="img" aria-label="personality">🎭</span> {t('clone.personalityClone', 'Personality Clone')}
          </h1>
          <p style={{ color: '#718096', marginTop: '4px' }}>{t('clone.personalityClone.subtitle', 'Create a personality from conversation samples')}</p>
        </div>
      </div>

      {/* Progress Steps */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {[1, 2, 3, 4].map((s, i) => (
            <React.Fragment key={s}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: step >= s ? 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' : '#e2e8f0',
                color: step >= s ? 'white' : '#a0aec0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: '600'
              }}>
                {step > s ? '✓' : s}
              </div>
              {i < 3 && (
                <div style={{ width: '60px', height: '4px', background: step > s ? '#38ef7d' : '#e2e8f0', borderRadius: '2px' }}></div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {error && (
        <div style={{ background: '#fed7d7', color: '#742a2a', padding: '16px', borderRadius: '8px', marginBottom: '24px' }}>
          {error}
          <button onClick={() => setError(null)} style={{ marginLeft: '16px', background: 'none', border: 'none', color: '#742a2a', cursor: 'pointer' }}>×</button>
        </div>
      )}

      {/* Step 1: Create Clone */}
      {step === 1 && (
        <div style={{ maxWidth: '600px', margin: '0 auto', background: 'white', borderRadius: '12px', padding: '32px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <h2 style={{ margin: '0 0 24px', color: '#2d3748' }}>{t('clone.step1', 'Step 1: Create Personality Clone')}</h2>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#4a5568' }}>
              {t('clone.name')} *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder={t('clone.personalityNamePlaceholder', 'e.g., Friendly Customer Support')}
              style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px' }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#4a5568' }}>
              {t('clone.description')}
            </label>
            <textarea
              value={formData.description}
              onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder={t('clone.personalityDescPlaceholder', 'Describe this personality...')}
              rows={3}
              style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px', resize: 'vertical' }}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#4a5568' }}>
              {t('clone.personalityLabel', 'Personality Name')}
            </label>
            <input
              type="text"
              value={formData.personalityName}
              onChange={e => setFormData(prev => ({ ...prev, personalityName: e.target.value }))}
              placeholder={t('clone.personalityLabelPlaceholder', 'e.g., Emma the Helper')}
              style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px' }}
            />
          </div>

          <button
            onClick={handleCreate}
            disabled={isLoading}
            style={{
              width: '100%',
              background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
              color: 'white',
              border: 'none',
              padding: '14px',
              borderRadius: '8px',
              fontWeight: '600',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.7 : 1
            }}
          >
            {isLoading ? t('common.creating', 'Creating...') : t('clone.createAndContinue', 'Create & Continue')}
          </button>
        </div>
      )}

      {/* Step 2: Add Samples */}
      {step === 2 && job && (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '32px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '24px' }}>
            <h2 style={{ margin: '0 0 8px', color: '#2d3748' }}>{t('clone.step2', 'Step 2: Add Conversation Samples')}</h2>
            <p style={{ color: '#718096', marginBottom: '24px' }}>
              {t('clone.conversationHint', 'Provide example conversations that demonstrate the personality you want to clone. At least 5 samples are recommended.')}
            </p>

            {/* Stats */}
            <div style={{ display: 'flex', gap: '24px', marginBottom: '24px', padding: '16px', background: '#f7fafc', borderRadius: '8px' }}>
              <div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#38ef7d' }}>{samples.length}</div>
                <div style={{ fontSize: '13px', color: '#718096' }}>{t('clone.conversations', 'Conversations')}</div>
              </div>
              <div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: samples.length >= 5 ? '#48bb78' : '#e53e3e' }}>
                  {samples.length >= 5 ? '✓' : `${5 - samples.length} more`}
                </div>
                <div style={{ fontSize: '13px', color: '#718096' }}>{t('clone.required', 'Required')}</div>
              </div>
            </div>

            {/* Format Guide */}
            <div style={{ background: '#edf2f7', padding: '16px', borderRadius: '8px', marginBottom: '24px' }}>
              <h4 style={{ margin: '0 0 8px', color: '#2d3748', fontSize: '14px' }}>{t('clone.formatGuide', 'Format Guide')}</h4>
              <p style={{ margin: '0 0 8px', color: '#718096', fontSize: '13px' }}>
                {t('clone.formatExample', 'Use JSON format for best results:')}
              </p>
              <pre style={{ margin: 0, padding: '12px', background: 'white', borderRadius: '4px', fontSize: '12px', overflow: 'auto' }}>
{`[
  {"role": "user", "content": "Hello!"},
  {"role": "assistant", "content": "Hi there! How can I help you today?"},
  {"role": "user", "content": "I have a question..."},
  {"role": "assistant", "content": "Of course! I'd be happy to help."}
]`}
              </pre>
            </div>

            {/* Conversation Input */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#4a5568' }}>
                {t('clone.addConversation', 'Add Conversation')}
              </label>
              <textarea
                value={conversationInput}
                onChange={e => setConversationInput(e.target.value)}
                placeholder={t('clone.conversationPlaceholder', 'Paste conversation in JSON format or plain text...')}
                rows={8}
                style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px', fontFamily: 'monospace', resize: 'vertical', marginBottom: '12px' }}
              />
              <button
                onClick={handleAddConversation}
                disabled={!conversationInput.trim() || isLoading}
                style={{
                  background: conversationInput.trim() ? 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' : '#e2e8f0',
                  color: conversationInput.trim() ? 'white' : '#a0aec0',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  fontWeight: '500',
                  cursor: conversationInput.trim() ? 'pointer' : 'not-allowed'
                }}
              >
                {t('clone.addConversation', 'Add Conversation')}
              </button>
            </div>

            {/* Samples List */}
            {samples.length > 0 && (
              <div>
                <h3 style={{ margin: '0 0 16px', color: '#2d3748', fontSize: '16px' }}>
                  {t('clone.addedConversations', 'Added Conversations')}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {samples.map((sample, index) => {
                    let messageCount = 0;
                    try {
                      const parsed = JSON.parse(sample.content || '[]');
                      messageCount = Array.isArray(parsed) ? parsed.length : 0;
                    } catch {
                      messageCount = sample.content?.split('\n').filter(l => l.trim()).length || 0;
                    }

                    return (
                      <div key={sample.id} style={{
                        padding: '16px',
                        background: '#f7fafc',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '10px',
                              background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'white',
                              fontWeight: '600'
                            }}>
                              {index + 1}
                            </div>
                            <div>
                              <div style={{ fontWeight: '500', color: '#2d3748' }}>Conversation #{index + 1}</div>
                              <div style={{ fontSize: '13px', color: '#a0aec0' }}>{messageCount} messages</div>
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteSample(sample.id)}
                            style={{ background: 'none', border: 'none', color: '#e53e3e', cursor: 'pointer', fontSize: '18px' }}
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button
              onClick={() => setStep(1)}
              style={{ padding: '12px 24px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', color: '#4a5568', fontWeight: '500', cursor: 'pointer' }}
            >
              {t('common.back', 'Back')}
            </button>
            <button
              onClick={handleTrain}
              disabled={samples.length < 5 || isLoading}
              style={{
                background: samples.length >= 5 ? 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' : '#e2e8f0',
                color: samples.length >= 5 ? 'white' : '#a0aec0',
                border: 'none',
                padding: '12px 32px',
                borderRadius: '8px',
                fontWeight: '600',
                cursor: samples.length >= 5 ? 'pointer' : 'not-allowed'
              }}
            >
              {t('clone.analyzePersonality', 'Analyze Personality')}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Training */}
      {step === 3 && job && (
        <div style={{ maxWidth: '600px', margin: '0 auto', background: 'white', borderRadius: '12px', padding: '48px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', textAlign: 'center' }}>
          <div style={{ width: '80px', height: '80px', margin: '0 auto 24px', borderRadius: '50%', background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '40px', height: '40px', border: '4px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
          </div>
          <h2 style={{ margin: '0 0 12px', color: '#2d3748' }}>{t('clone.analyzingPersonality', 'Analyzing Personality')}</h2>
          <p style={{ color: '#718096', marginBottom: '32px' }}>{t('clone.personalityWait', 'Learning communication patterns and traits...')}</p>

          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: '#718096' }}>{t('clone.progress', 'Progress')}</span>
              <span style={{ fontWeight: '600', color: '#38ef7d' }}>{job.training_progress || 0}%</span>
            </div>
            <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${job.training_progress || 0}%`,
                background: 'linear-gradient(90deg, #11998e, #38ef7d)',
                borderRadius: '4px',
                transition: 'width 0.5s'
              }}></div>
            </div>
          </div>

          <div style={{ background: '#f7fafc', padding: '16px', borderRadius: '8px', fontSize: '14px', color: '#718096' }}>
            <p style={{ margin: 0 }}>{t('clone.personalitySteps', 'Extracting traits → Analyzing tone → Building profile → Generating prompts')}</p>
          </div>

          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Step 4: Test & Use */}
      {step === 4 && job && (
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)', borderRadius: '12px', padding: '32px', color: 'white', marginBottom: '24px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
            <h2 style={{ margin: '0 0 8px' }}>{t('clone.personalityReady', 'Personality Clone Ready!')}</h2>
            <p style={{ opacity: 0.9 }}>{t('clone.personalityReadyDesc', 'Your personality has been analyzed and is ready to chat.')}</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            {/* Personality Profile */}
            <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
              <h3 style={{ margin: '0 0 20px', color: '#2d3748' }}>{t('clone.personalityProfile', 'Personality Profile')}</h3>

              {personalityProfile?.traits && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {Object.entries(traitLabels).map(([key, trait]) => {
                    const value = personalityProfile.traits[key] || 5;
                    return (
                      <div key={key}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <span style={{ fontSize: '14px', color: '#4a5568' }}>
                            {trait.Icon && <trait.Icon size={14} style={{ display: 'inline', marginRight: '4px' }} />}{trait.label}
                          </span>
                          <span style={{ fontSize: '14px', fontWeight: '600', color: '#2d3748' }}>{value}/10</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '12px', color: '#a0aec0', width: '60px' }}>{trait.low}</span>
                          <div style={{ flex: 1, height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{
                              height: '100%',
                              width: `${value * 10}%`,
                              background: 'linear-gradient(90deg, #11998e, #38ef7d)',
                              borderRadius: '4px'
                            }}></div>
                          </div>
                          <span style={{ fontSize: '12px', color: '#a0aec0', width: '60px', textAlign: 'right' }}>{trait.high}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Chat Test */}
            <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ margin: '0 0 16px', color: '#2d3748' }}>{t('clone.testChat', 'Test Chat')}</h3>

              {/* Chat Messages */}
              <div style={{ flex: 1, minHeight: '300px', maxHeight: '400px', overflowY: 'auto', marginBottom: '16px', padding: '12px', background: '#f7fafc', borderRadius: '8px' }}>
                {chatHistory.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#a0aec0', padding: '40px 0' }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}><MessageSquare size={32} /></div>
                    <p>{t('clone.startConversation', 'Start a conversation to test the personality')}</p>
                  </div>
                ) : (
                  chatHistory.map((msg, index) => (
                    <div
                      key={index}
                      style={{
                        marginBottom: '12px',
                        display: 'flex',
                        justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start'
                      }}
                    >
                      <div style={{
                        maxWidth: '80%',
                        padding: '10px 14px',
                        borderRadius: '12px',
                        background: msg.role === 'user' ? 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' : msg.role === 'error' ? '#fed7d7' : 'white',
                        color: msg.role === 'user' ? 'white' : msg.role === 'error' ? '#742a2a' : '#2d3748',
                        boxShadow: msg.role !== 'user' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                      }}>
                        {msg.content}
                      </div>
                    </div>
                  ))
                )}
                {isGenerating && (
                  <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '12px' }}>
                    <div style={{ padding: '10px 14px', background: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                      <span style={{ animation: 'blink 1s infinite' }}>...</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Chat Input */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={testMessage}
                  onChange={e => setTestMessage(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && !isGenerating && handleSendMessage()}
                  placeholder={t('clone.typeMessage', 'Type a message...')}
                  style={{ flex: 1, padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px' }}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={isGenerating || !testMessage.trim()}
                  style={{
                    background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
                    color: 'white',
                    border: 'none',
                    padding: '12px 20px',
                    borderRadius: '8px',
                    fontWeight: '500',
                    cursor: isGenerating || !testMessage.trim() ? 'not-allowed' : 'pointer',
                    opacity: isGenerating || !testMessage.trim() ? 0.7 : 1
                  }}
                >
                  {t('clone.send', 'Send')}
                </button>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px', marginTop: '24px' }}>
            <button
              onClick={() => navigate('/clone-dashboard')}
              style={{
                flex: 1,
                padding: '14px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                background: 'white',
                color: '#4a5568',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              {t('clone.backToDashboard', 'Back to Dashboard')}
            </button>
            <button
              onClick={() => navigate('/my-bots')}
              style={{
                flex: 1,
                background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
                color: 'white',
                border: 'none',
                padding: '14px',
                borderRadius: '8px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              {t('clone.applyToBot', 'Apply to Bot')}
            </button>
          </div>

          <style>{`@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
        </div>
      )}
    </div>
  );
};

export default PersonalityClone;
