import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Mic } from 'lucide-react';

const VoiceClone = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const fileInputRef = useRef(null);

  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [job, setJob] = useState(null);
  const [samples, setSamples] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [audioChunks, setAudioChunks] = useState([]);
  const [testText, setTestText] = useState('');
  const [synthesizedAudio, setSynthesizedAudio] = useState(null);
  const [isSynthesizing, setIsSynthesizing] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    language: 'en',
    voiceProvider: 'elevenlabs'
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
        fetch(`/api/clones/jobs/${id}/samples?type=audio`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      if (!jobRes.ok) throw new Error('Clone job not found');

      const jobData = await jobRes.json();
      const samplesData = await samplesRes.json();

      setJob(jobData.job);
      setSamples(samplesData.samples || []);
      setFormData({
        name: jobData.job.name || '',
        description: jobData.job.description || '',
        language: jobData.job.language || 'en',
        voiceProvider: jobData.job.voice_provider || 'elevenlabs'
      });

      if (jobData.job.status === 'ready') {
        setStep(4);
      } else if (samplesData.samples?.length > 0) {
        setStep(2);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.name) {
      alert(t('clone.nameRequired', 'Name is required'));
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/clones/voice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (!res.ok) throw new Error('Failed to create voice clone');

      const data = await res.json();
      setJob(data.job);
      navigate(`/clone/voice/${data.job.id}`, { replace: true });
      setStep(2);
    } catch (err) {
      setError(err.message);
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
        formDataUpload.append('type', 'audio');

        const res = await fetch(`/api/clones/jobs/${job.id}/samples`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formDataUpload
        });

        if (!res.ok) throw new Error('Failed to upload file');
      }

      // Refresh samples
      const samplesRes = await fetch(`/api/clones/jobs/${job.id}/samples?type=audio`, {
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

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];

      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const file = new File([blob], `recording-${Date.now()}.webm`, { type: 'audio/webm' });

        // Upload recording
        const formDataUpload = new FormData();
        formDataUpload.append('file', file);
        formDataUpload.append('type', 'audio');

        try {
          const res = await fetch(`/api/clones/jobs/${job.id}/samples`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formDataUpload
          });

          if (res.ok) {
            const samplesRes = await fetch(`/api/clones/jobs/${job.id}/samples?type=audio`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            const samplesData = await samplesRes.json();
            setSamples(samplesData.samples || []);
          }
        } catch (err) {
          alert('Failed to save recording');
        }

        stream.getTracks().forEach(track => track.stop());
      };

      setMediaRecorder(recorder);
      setAudioChunks(chunks);
      recorder.start();
      setIsRecording(true);
    } catch (err) {
      alert('Could not access microphone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder) {
      mediaRecorder.stop();
      setIsRecording(false);
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
    if (samples.length < 1) {
      alert(t('clone.needSamples', 'At least 1 audio sample is required'));
      return;
    }

    setIsLoading(true);
    setStep(3);

    try {
      const res = await fetch(`/api/clones/voice/${job.id}/train`, {
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

  const handleSynthesize = async () => {
    if (!testText) {
      alert(t('clone.enterText', 'Please enter text to synthesize'));
      return;
    }

    setIsSynthesizing(true);
    try {
      const res = await fetch(`/api/clones/voice/${job.id}/synthesize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ text: testText })
      });

      if (!res.ok) throw new Error('Synthesis failed');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setSynthesizedAudio(url);
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSynthesizing(false);
    }
  };

  if (isLoading && !job) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f7fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '48px', height: '48px', border: '4px solid #e9ecef', borderTopColor: '#f5576c', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }}></div>
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
        <button onClick={() => navigate('/clone-dashboard')} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#f5576c' }}>
          <span role="img" aria-label="back">←</span>
        </button>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1a202c', margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Mic size={20} style={{ display: 'inline', marginRight: '8px' }} aria-hidden="true" />{t('clone.voiceClone', 'Voice Clone')}
          </h1>
          <p style={{ color: '#718096', marginTop: '4px' }}>{t('clone.voiceClone.subtitle', 'Create a voice clone from audio samples')}</p>
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
                background: step >= s ? 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' : '#e2e8f0',
                color: step >= s ? 'white' : '#a0aec0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: '600'
              }}>
                {step > s ? '✓' : s}
              </div>
              {i < 3 && (
                <div style={{ width: '60px', height: '4px', background: step > s ? '#f5576c' : '#e2e8f0', borderRadius: '2px' }}></div>
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
          <h2 style={{ margin: '0 0 24px', color: '#2d3748' }}>{t('clone.step1', 'Step 1: Create Voice Clone')}</h2>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#4a5568' }}>
              {t('clone.name')} *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder={t('clone.namePlaceholder', 'e.g., My Custom Voice')}
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
              placeholder={t('clone.descriptionPlaceholder', 'Describe this voice clone...')}
              rows={3}
              style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px', resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#4a5568' }}>
                {t('clone.language', 'Language')}
              </label>
              <select
                value={formData.language}
                onChange={e => setFormData(prev => ({ ...prev, language: e.target.value }))}
                style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px' }}
              >
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
                <option value="it">Italian</option>
                <option value="pt">Portuguese</option>
                <option value="zh">Chinese</option>
                <option value="ja">Japanese</option>
                <option value="ko">Korean</option>
                <option value="ar">Arabic</option>
                <option value="tr">Turkish</option>
                <option value="az">Azerbaijani</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#4a5568' }}>
                {t('clone.provider', 'Voice Provider')}
              </label>
              <select
                value={formData.voiceProvider}
                onChange={e => setFormData(prev => ({ ...prev, voiceProvider: e.target.value }))}
                style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px' }}
              >
                <option value="elevenlabs">ElevenLabs</option>
                <option value="openai">OpenAI TTS</option>
                <option value="azure">Azure Speech</option>
                <option value="google">Google TTS</option>
              </select>
            </div>
          </div>

          <button
            onClick={handleCreate}
            disabled={isLoading}
            style={{
              width: '100%',
              background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
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

      {/* Step 2: Upload Samples */}
      {step === 2 && job && (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '32px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '24px' }}>
            <h2 style={{ margin: '0 0 8px', color: '#2d3748' }}>{t('clone.step2', 'Step 2: Add Voice Samples')}</h2>
            <p style={{ color: '#718096', marginBottom: '24px' }}>
              {t('clone.samplesHint', 'Upload or record clear audio samples of the voice you want to clone. At least 30 seconds of audio is recommended.')}
            </p>

            {/* Upload Area */}
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: '2px dashed #e2e8f0',
                borderRadius: '12px',
                padding: '40px',
                textAlign: 'center',
                cursor: 'pointer',
                marginBottom: '24px',
                transition: 'border-color 0.2s'
              }}
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = '#f5576c'; }}
              onDragLeave={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; }}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.style.borderColor = '#e2e8f0';
                const files = Array.from(e.dataTransfer.files);
                handleFileUpload({ target: { files } });
              }}
            >
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📁</div>
              <p style={{ color: '#4a5568', fontWeight: '500', marginBottom: '8px' }}>{t('clone.dropFiles', 'Drop audio files here or click to browse')}</p>
              <p style={{ color: '#a0aec0', fontSize: '14px' }}>{t('clone.supportedFormats', 'Supports MP3, WAV, OGG, WebM')}</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                multiple
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
            </div>

            {/* Record Button */}
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <p style={{ color: '#718096', marginBottom: '12px' }}>{t('clone.orRecord', 'Or record directly')}</p>
              <button
                onClick={isRecording ? stopRecording : startRecording}
                style={{
                  background: isRecording ? '#e53e3e' : 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                  color: 'white',
                  border: 'none',
                  padding: '14px 32px',
                  borderRadius: '50px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {isRecording ? (
                  <><span style={{ width: '12px', height: '12px', background: 'white', borderRadius: '2px' }}></span> {t('clone.stopRecording', 'Stop Recording')}</>
                ) : (
                  <><span style={{ width: '12px', height: '12px', background: 'white', borderRadius: '50%' }}></span> {t('clone.startRecording', 'Start Recording')}</>
                )}
              </button>
            </div>

            {/* Samples List */}
            {samples.length > 0 && (
              <div>
                <h3 style={{ margin: '0 0 16px', color: '#2d3748', fontSize: '16px' }}>
                  {t('clone.uploadedSamples', 'Uploaded Samples')} ({samples.length})
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {samples.map(sample => (
                    <div key={sample.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      background: '#f7fafc',
                      borderRadius: '8px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '24px' }}>🎵</span>
                        <div>
                          <div style={{ fontWeight: '500', color: '#2d3748' }}>{sample.file_name || 'Recording'}</div>
                          <div style={{ fontSize: '13px', color: '#a0aec0' }}>
                            {sample.duration_seconds ? `${Math.round(sample.duration_seconds)}s` : 'Processing...'}
                            {sample.quality_score && ` • Quality: ${Math.round(sample.quality_score * 100)}%`}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteSample(sample.id)}
                        style={{ background: 'none', border: 'none', color: '#e53e3e', cursor: 'pointer', fontSize: '18px' }}
                      >
                        ×
                      </button>
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
              disabled={samples.length < 1 || isLoading}
              style={{
                background: samples.length >= 1 ? 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' : '#e2e8f0',
                color: samples.length >= 1 ? 'white' : '#a0aec0',
                border: 'none',
                padding: '12px 32px',
                borderRadius: '8px',
                fontWeight: '600',
                cursor: samples.length >= 1 ? 'pointer' : 'not-allowed'
              }}
            >
              {t('clone.startTraining', 'Start Training')}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Training */}
      {step === 3 && job && (
        <div style={{ maxWidth: '600px', margin: '0 auto', background: 'white', borderRadius: '12px', padding: '48px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', textAlign: 'center' }}>
          <div style={{ width: '80px', height: '80px', margin: '0 auto 24px', borderRadius: '50%', background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '40px', height: '40px', border: '4px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
          </div>
          <h2 style={{ margin: '0 0 12px', color: '#2d3748' }}>{t('clone.trainingInProgress', 'Training Voice Clone')}</h2>
          <p style={{ color: '#718096', marginBottom: '32px' }}>{t('clone.trainingWait', 'This may take a few minutes. Please wait...')}</p>

          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: '#718096' }}>{t('clone.progress', 'Progress')}</span>
              <span style={{ fontWeight: '600', color: '#f5576c' }}>{job.training_progress || 0}%</span>
            </div>
            <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${job.training_progress || 0}%`,
                background: 'linear-gradient(90deg, #f093fb, #f5576c)',
                borderRadius: '4px',
                transition: 'width 0.5s'
              }}></div>
            </div>
          </div>

          <div style={{ background: '#f7fafc', padding: '16px', borderRadius: '8px', fontSize: '14px', color: '#718096' }}>
            <p style={{ margin: 0 }}>{t('clone.trainingSteps', 'Processing audio → Extracting features → Training model → Validating quality')}</p>
          </div>

          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Step 4: Test & Use */}
      {step === 4 && job && (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', borderRadius: '12px', padding: '32px', color: 'white', marginBottom: '24px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
            <h2 style={{ margin: '0 0 8px' }}>{t('clone.voiceReady', 'Voice Clone Ready!')}</h2>
            <p style={{ opacity: 0.9 }}>{t('clone.voiceReadyDesc', 'Your voice clone has been trained and is ready to use.')}</p>
          </div>

          <div style={{ background: 'white', borderRadius: '12px', padding: '32px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '24px' }}>
            <h3 style={{ margin: '0 0 16px', color: '#2d3748' }}>{t('clone.testVoice', 'Test Your Voice Clone')}</h3>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#4a5568' }}>
                {t('clone.enterText', 'Enter text to synthesize')}
              </label>
              <textarea
                value={testText}
                onChange={e => setTestText(e.target.value)}
                placeholder={t('clone.testPlaceholder', 'Hello, this is a test of my cloned voice...')}
                rows={3}
                style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px', resize: 'vertical' }}
              />
            </div>

            <button
              onClick={handleSynthesize}
              disabled={isSynthesizing || !testText}
              style={{
                background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '8px',
                fontWeight: '600',
                cursor: isSynthesizing || !testText ? 'not-allowed' : 'pointer',
                opacity: isSynthesizing || !testText ? 0.7 : 1,
                marginBottom: '20px'
              }}
            >
              {isSynthesizing ? t('clone.synthesizing', 'Synthesizing...') : t('clone.synthesize', 'Synthesize Speech')}
            </button>

            {synthesizedAudio && (
              <div style={{ background: '#f7fafc', padding: '16px', borderRadius: '8px' }}>
                <audio controls src={synthesizedAudio} style={{ width: '100%' }}>
                  Your browser does not support the audio element.
                </audio>
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
                background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
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

export default VoiceClone;
