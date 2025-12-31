import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const StyleClone = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const fileInputRef = useRef(null);

  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [job, setJob] = useState(null);
  const [samples, setSamples] = useState([]);
  const [textInput, setTextInput] = useState('');
  const [testPrompt, setTestPrompt] = useState('');
  const [generatedText, setGeneratedText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [styleProfile, setStyleProfile] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    formalityLevel: 'neutral',
    tone: 'professional'
  });

  const token = localStorage.getItem('token');

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
        formalityLevel: jobData.job.formality_level || 'neutral',
        tone: jobData.job.tone || 'professional'
      });

      if (jobData.job.status === 'ready') {
        setStep(4);
        // Fetch style profile
        fetchStyleProfile(id);
      } else if (samplesData.samples?.length > 0) {
        setStep(2);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStyleProfile = async (jobId) => {
    try {
      const res = await fetch(`/api/clones/jobs/${jobId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.job) {
          setStyleProfile({
            formalityLevel: data.job.formality_level,
            tone: data.job.tone,
            vocabularyComplexity: data.job.vocabulary_complexity,
            avgSentenceLength: data.job.avg_sentence_length,
            useContractions: data.job.use_contractions,
            useEmoji: data.job.use_emoji
          });
        }
      }
    } catch (err) {
      console.error('Error fetching style profile:', err);
    }
  };

  const handleCreate = async () => {
    if (!formData.name) {
      alert(t('clone.nameRequired', 'Name is required'));
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/clones/style', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (!res.ok) throw new Error('Failed to create style clone');

      const data = await res.json();
      setJob(data.job);
      navigate(`/clone/style/${data.job.id}`, { replace: true });
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddTextSample = async () => {
    if (!textInput.trim()) {
      alert(t('clone.textRequired', 'Please enter some text'));
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
          type: 'text',
          content: textInput
        })
      });

      if (!res.ok) throw new Error('Failed to add sample');

      setTextInput('');

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

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setIsLoading(true);
    try {
      for (const file of files) {
        const formDataUpload = new FormData();
        formDataUpload.append('file', file);
        formDataUpload.append('type', 'document');

        const res = await fetch(`/api/clones/jobs/${job.id}/samples`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formDataUpload
        });

        if (!res.ok) throw new Error('Failed to upload file');
      }

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
    if (samples.length < 3) {
      alert(t('clone.needMoreSamples', 'At least 3 text samples are required'));
      return;
    }

    setIsLoading(true);
    setStep(3);

    try {
      const res = await fetch(`/api/clones/style/${job.id}/train`, {
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
          fetchStyleProfile(job.id);
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

  const handleGenerate = async () => {
    if (!testPrompt) {
      alert(t('clone.enterPrompt', 'Please enter a prompt'));
      return;
    }

    setIsGenerating(true);
    try {
      const res = await fetch(`/api/clones/style/${job.id}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ prompt: testPrompt })
      });

      if (!res.ok) throw new Error('Generation failed');

      const data = await res.json();
      setGeneratedText(data.text);
    } catch (err) {
      alert(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const getTotalWordCount = () => {
    return samples.reduce((total, sample) => {
      const content = sample.content || '';
      return total + content.split(/\s+/).filter(w => w).length;
    }, 0);
  };

  if (isLoading && !job) {
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <button onClick={() => navigate('/clone-dashboard')} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#667eea' }}>
          <span role="img" aria-label="back">←</span>
        </button>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1a202c', margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span role="img" aria-label="style">✍️</span> {t('clone.styleClone', 'Style Clone')}
          </h1>
          <p style={{ color: '#718096', marginTop: '4px' }}>{t('clone.styleClone.subtitle', 'Clone writing style from text samples')}</p>
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
                background: step >= s ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#e2e8f0',
                color: step >= s ? 'white' : '#a0aec0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: '600'
              }}>
                {step > s ? '✓' : s}
              </div>
              {i < 3 && (
                <div style={{ width: '60px', height: '4px', background: step > s ? '#667eea' : '#e2e8f0', borderRadius: '2px' }}></div>
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
          <h2 style={{ margin: '0 0 24px', color: '#2d3748' }}>{t('clone.step1', 'Step 1: Create Style Clone')}</h2>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#4a5568' }}>
              {t('clone.name')} *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder={t('clone.styleNamePlaceholder', 'e.g., Professional Email Style')}
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
              placeholder={t('clone.styleDescPlaceholder', 'Describe this writing style...')}
              rows={3}
              style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px', resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#4a5568' }}>
                {t('clone.formality', 'Formality Level')}
              </label>
              <select
                value={formData.formalityLevel}
                onChange={e => setFormData(prev => ({ ...prev, formalityLevel: e.target.value }))}
                style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px' }}
              >
                <option value="very_informal">Very Informal</option>
                <option value="informal">Informal</option>
                <option value="neutral">Neutral</option>
                <option value="formal">Formal</option>
                <option value="very_formal">Very Formal</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#4a5568' }}>
                {t('clone.tone', 'Tone')}
              </label>
              <select
                value={formData.tone}
                onChange={e => setFormData(prev => ({ ...prev, tone: e.target.value }))}
                style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px' }}
              >
                <option value="professional">Professional</option>
                <option value="friendly">Friendly</option>
                <option value="casual">Casual</option>
                <option value="authoritative">Authoritative</option>
                <option value="empathetic">Empathetic</option>
                <option value="humorous">Humorous</option>
              </select>
            </div>
          </div>

          <button
            onClick={handleCreate}
            disabled={isLoading}
            style={{
              width: '100%',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
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
            <h2 style={{ margin: '0 0 8px', color: '#2d3748' }}>{t('clone.step2', 'Step 2: Add Text Samples')}</h2>
            <p style={{ color: '#718096', marginBottom: '24px' }}>
              {t('clone.styleSamplesHint', 'Provide examples of the writing style you want to clone. At least 3 samples with 500+ words total is recommended.')}
            </p>

            {/* Stats */}
            <div style={{ display: 'flex', gap: '24px', marginBottom: '24px', padding: '16px', background: '#f7fafc', borderRadius: '8px' }}>
              <div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#667eea' }}>{samples.length}</div>
                <div style={{ fontSize: '13px', color: '#718096' }}>{t('clone.samples', 'Samples')}</div>
              </div>
              <div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#48bb78' }}>{getTotalWordCount()}</div>
                <div style={{ fontSize: '13px', color: '#718096' }}>{t('clone.totalWords', 'Total Words')}</div>
              </div>
              <div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: samples.length >= 3 ? '#48bb78' : '#e53e3e' }}>
                  {samples.length >= 3 ? '✓' : `${3 - samples.length} more`}
                </div>
                <div style={{ fontSize: '13px', color: '#718096' }}>{t('clone.required', 'Required')}</div>
              </div>
            </div>

            {/* Text Input */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#4a5568' }}>
                {t('clone.pasteText', 'Paste text sample')}
              </label>
              <textarea
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
                placeholder={t('clone.textPlaceholder', 'Paste an email, document, or any text that represents your writing style...')}
                rows={6}
                style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px', resize: 'vertical', marginBottom: '12px' }}
              />
              <button
                onClick={handleAddTextSample}
                disabled={!textInput.trim() || isLoading}
                style={{
                  background: textInput.trim() ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#e2e8f0',
                  color: textInput.trim() ? 'white' : '#a0aec0',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  fontWeight: '500',
                  cursor: textInput.trim() ? 'pointer' : 'not-allowed'
                }}
              >
                {t('clone.addSample', 'Add Sample')}
              </button>
            </div>

            {/* File Upload */}
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: '2px dashed #e2e8f0',
                borderRadius: '12px',
                padding: '24px',
                textAlign: 'center',
                cursor: 'pointer',
                marginBottom: '24px'
              }}
            >
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>📄</div>
              <p style={{ color: '#4a5568', fontWeight: '500', marginBottom: '4px' }}>{t('clone.uploadDocs', 'Upload documents')}</p>
              <p style={{ color: '#a0aec0', fontSize: '13px' }}>{t('clone.docFormats', 'TXT, PDF, DOC, DOCX')}</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.pdf,.doc,.docx"
                multiple
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
            </div>

            {/* Samples List */}
            {samples.length > 0 && (
              <div>
                <h3 style={{ margin: '0 0 16px', color: '#2d3748', fontSize: '16px' }}>
                  {t('clone.addedSamples', 'Added Samples')}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {samples.map(sample => (
                    <div key={sample.id} style={{
                      padding: '16px',
                      background: '#f7fafc',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '20px' }}>{sample.type === 'document' ? '📄' : '📝'}</span>
                          <span style={{ fontWeight: '500', color: '#2d3748' }}>
                            {sample.file_name || `Sample ${sample.id}`}
                          </span>
                        </div>
                        <button
                          onClick={() => handleDeleteSample(sample.id)}
                          style={{ background: 'none', border: 'none', color: '#e53e3e', cursor: 'pointer', fontSize: '18px' }}
                        >
                          ×
                        </button>
                      </div>
                      {sample.content && (
                        <p style={{ margin: 0, fontSize: '14px', color: '#718096', lineHeight: '1.5' }}>
                          {sample.content.length > 200 ? sample.content.slice(0, 200) + '...' : sample.content}
                        </p>
                      )}
                      <div style={{ marginTop: '8px', fontSize: '12px', color: '#a0aec0' }}>
                        {sample.content?.split(/\s+/).filter(w => w).length || 0} words
                        {sample.quality_score && ` • Quality: ${Math.round(sample.quality_score * 100)}%`}
                      </div>
                    </div>
                  ))}
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
              disabled={samples.length < 3 || isLoading}
              style={{
                background: samples.length >= 3 ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#e2e8f0',
                color: samples.length >= 3 ? 'white' : '#a0aec0',
                border: 'none',
                padding: '12px 32px',
                borderRadius: '8px',
                fontWeight: '600',
                cursor: samples.length >= 3 ? 'pointer' : 'not-allowed'
              }}
            >
              {t('clone.analyzeStyle', 'Analyze Style')}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Training */}
      {step === 3 && job && (
        <div style={{ maxWidth: '600px', margin: '0 auto', background: 'white', borderRadius: '12px', padding: '48px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', textAlign: 'center' }}>
          <div style={{ width: '80px', height: '80px', margin: '0 auto 24px', borderRadius: '50%', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '40px', height: '40px', border: '4px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
          </div>
          <h2 style={{ margin: '0 0 12px', color: '#2d3748' }}>{t('clone.analyzingStyle', 'Analyzing Writing Style')}</h2>
          <p style={{ color: '#718096', marginBottom: '32px' }}>{t('clone.analyzingWait', 'Extracting patterns, vocabulary, and tone...')}</p>

          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: '#718096' }}>{t('clone.progress', 'Progress')}</span>
              <span style={{ fontWeight: '600', color: '#667eea' }}>{job.training_progress || 0}%</span>
            </div>
            <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${job.training_progress || 0}%`,
                background: 'linear-gradient(90deg, #667eea, #764ba2)',
                borderRadius: '4px',
                transition: 'width 0.5s'
              }}></div>
            </div>
          </div>

          <div style={{ background: '#f7fafc', padding: '16px', borderRadius: '8px', fontSize: '14px', color: '#718096' }}>
            <p style={{ margin: 0 }}>{t('clone.styleSteps', 'Analyzing vocabulary → Extracting patterns → Building style profile → Validating')}</p>
          </div>

          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Step 4: Test & Use */}
      {step === 4 && job && (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: '12px', padding: '32px', color: 'white', marginBottom: '24px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
            <h2 style={{ margin: '0 0 8px' }}>{t('clone.styleReady', 'Style Clone Ready!')}</h2>
            <p style={{ opacity: 0.9 }}>{t('clone.styleReadyDesc', 'Your writing style has been analyzed and is ready to use.')}</p>
          </div>

          {/* Style Profile */}
          {styleProfile && (
            <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '24px' }}>
              <h3 style={{ margin: '0 0 16px', color: '#2d3748' }}>{t('clone.styleProfile', 'Detected Style Profile')}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                <div style={{ padding: '16px', background: '#f7fafc', borderRadius: '8px' }}>
                  <div style={{ fontSize: '13px', color: '#718096', marginBottom: '4px' }}>{t('clone.formality', 'Formality')}</div>
                  <div style={{ fontWeight: '600', color: '#2d3748', textTransform: 'capitalize' }}>{styleProfile.formalityLevel?.replace('_', ' ')}</div>
                </div>
                <div style={{ padding: '16px', background: '#f7fafc', borderRadius: '8px' }}>
                  <div style={{ fontSize: '13px', color: '#718096', marginBottom: '4px' }}>{t('clone.tone', 'Tone')}</div>
                  <div style={{ fontWeight: '600', color: '#2d3748', textTransform: 'capitalize' }}>{styleProfile.tone}</div>
                </div>
                <div style={{ padding: '16px', background: '#f7fafc', borderRadius: '8px' }}>
                  <div style={{ fontSize: '13px', color: '#718096', marginBottom: '4px' }}>{t('clone.vocabulary', 'Vocabulary')}</div>
                  <div style={{ fontWeight: '600', color: '#2d3748', textTransform: 'capitalize' }}>{styleProfile.vocabularyComplexity || 'Medium'}</div>
                </div>
                <div style={{ padding: '16px', background: '#f7fafc', borderRadius: '8px' }}>
                  <div style={{ fontSize: '13px', color: '#718096', marginBottom: '4px' }}>{t('clone.avgSentence', 'Avg Sentence')}</div>
                  <div style={{ fontWeight: '600', color: '#2d3748' }}>{styleProfile.avgSentenceLength || 15} words</div>
                </div>
                <div style={{ padding: '16px', background: '#f7fafc', borderRadius: '8px' }}>
                  <div style={{ fontSize: '13px', color: '#718096', marginBottom: '4px' }}>{t('clone.contractions', 'Contractions')}</div>
                  <div style={{ fontWeight: '600', color: '#2d3748' }}>{styleProfile.useContractions ? 'Yes' : 'No'}</div>
                </div>
                <div style={{ padding: '16px', background: '#f7fafc', borderRadius: '8px' }}>
                  <div style={{ fontSize: '13px', color: '#718096', marginBottom: '4px' }}>{t('clone.emojis', 'Emojis')}</div>
                  <div style={{ fontWeight: '600', color: '#2d3748' }}>{styleProfile.useEmoji ? 'Yes' : 'No'}</div>
                </div>
              </div>
            </div>
          )}

          <div style={{ background: 'white', borderRadius: '12px', padding: '32px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '24px' }}>
            <h3 style={{ margin: '0 0 16px', color: '#2d3748' }}>{t('clone.testStyle', 'Test Your Style Clone')}</h3>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#4a5568' }}>
                {t('clone.enterPrompt', 'Enter prompt to generate text')}
              </label>
              <textarea
                value={testPrompt}
                onChange={e => setTestPrompt(e.target.value)}
                placeholder={t('clone.stylePromptPlaceholder', 'Write an email thanking a customer for their order...')}
                rows={3}
                style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px', resize: 'vertical' }}
              />
            </div>

            <button
              onClick={handleGenerate}
              disabled={isGenerating || !testPrompt}
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '8px',
                fontWeight: '600',
                cursor: isGenerating || !testPrompt ? 'not-allowed' : 'pointer',
                opacity: isGenerating || !testPrompt ? 0.7 : 1,
                marginBottom: '20px'
              }}
            >
              {isGenerating ? t('clone.generating', 'Generating...') : t('clone.generate', 'Generate Text')}
            </button>

            {generatedText && (
              <div style={{ background: '#f7fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '13px', color: '#718096', marginBottom: '8px' }}>{t('clone.generatedText', 'Generated Text')}</div>
                <p style={{ margin: 0, color: '#2d3748', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{generatedText}</p>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '16px' }}>
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
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
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
        </div>
      )}
    </div>
  );
};

export default StyleClone;
