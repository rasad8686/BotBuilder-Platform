import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import API_URL from '../utils/api';

const VoiceToBot = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // State
  const [step, setStep] = useState('idle'); // idle, recording, transcribing, extracting, preview, generating, completed
  const [session, setSession] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [transcription, setTranscription] = useState('');
  const [keyPhrases, setKeyPhrases] = useState([]);
  const [extractedData, setExtractedData] = useState(null);
  const [preview, setPreview] = useState(null);
  const [generatedBot, setGeneratedBot] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [language, setLanguage] = useState('en');
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [customizations, setCustomizations] = useState({ name: '', description: '' });

  // Refs
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const streamRef = useRef(null);
  const sessionRef = useRef(null); // For immediate session access

  // Fetch templates on mount
  useEffect(() => {
    fetchTemplates();
    return () => {
      stopRecording();
    };
  }, []);

  const fetchTemplates = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/voice-to-bot/templates`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setTemplates(data.templates);
      }
    } catch (err) {
      console.error('Failed to fetch templates', err);
    }
  };

  // Start session - returns session for immediate use
  const startSession = async () => {
    try {
      setError('');
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/voice-to-bot/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ language })
      });
      const data = await response.json();
      if (data.success) {
        setSession(data.session);
        sessionRef.current = data.session; // Store in ref for immediate access
        setStep('idle');
        return data.session; // Return session for immediate use
      }
      return null;
    } catch (err) {
      setError(t('voiceToBot.errors.sessionFailed'));
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Start recording
  const startRecording = async () => {
    try {
      setError('');

      if (!session) {
        await startSession();
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = handleRecordingStop;

      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
      setStep('recording');
      setRecordingTime(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (err) {
      setError(t('voiceToBot.errors.microphoneAccess'));
      console.error('Microphone access error:', err);
    }
  };

  // Stop recording
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, [isRecording]);

  // Handle recording stop
  const handleRecordingStop = async () => {
    if (audioChunksRef.current.length === 0) {
      setError(t('voiceToBot.errors.noAudio'));
      setStep('idle');
      return;
    }

    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

    if (audioBlob.size < 1000) {
      setError(t('voiceToBot.errors.tooShort'));
      setStep('idle');
      return;
    }

    await transcribeAudio(audioBlob);
  };

  // Transcribe audio
  const transcribeAudio = async (audioBlob) => {
    try {
      setStep('transcribing');
      setLoading(true);

      // Use sessionRef for immediate access
      const currentSession = sessionRef.current || session;
      if (!currentSession) {
        throw new Error('No session available');
      }

      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      formData.append('sessionId', currentSession.session_id);
      formData.append('language', language);

      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/voice-to-bot/transcribe`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await response.json();

      if (data.success) {
        setTranscription(data.transcription);
        setKeyPhrases(data.keyPhrases || []);
        setStep('extracting');
        await extractIntents(data.transcription);
      } else {
        throw new Error(data.error || 'Transcription failed');
      }
    } catch (err) {
      console.error('Transcription error:', err);
      setError(err.message || t('voiceToBot.errors.transcriptionFailed'));
      setStep('idle');
    } finally {
      setLoading(false);
    }
  };

  // Extract intents
  const extractIntents = async (text) => {
    try {
      setLoading(true);

      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/voice-to-bot/extract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ sessionId: (sessionRef.current || session)?.session_id, text })
      });
      const data = await response.json();

      if (data.success) {
        setExtractedData(data.extracted);
        setPreview(data.preview);
        setCustomizations({
          name: data.extracted.name,
          description: data.extracted.description
        });
        setStep('preview');
      } else {
        throw new Error(data.error || 'Extraction failed');
      }
    } catch (err) {
      console.error('Extraction error:', err);
      setError(err.message || t('voiceToBot.errors.extractionFailed'));
      setStep('idle');
    } finally {
      setLoading(false);
    }
  };

  // Generate bot
  const generateBot = async () => {
    try {
      setStep('generating');
      setLoading(true);

      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/voice-to-bot/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          sessionId: (sessionRef.current || session)?.session_id,
          customizations,
          extractedData // Send extracted data directly for template mode
        })
      });
      const data = await response.json();

      if (data.success) {
        setGeneratedBot(data.bot);
        setStep('completed');
      } else {
        throw new Error(data.error || 'Generation failed');
      }
    } catch (err) {
      console.error('Generation error:', err);
      setError(err.message || t('voiceToBot.errors.generationFailed'));
      setStep('preview');
    } finally {
      setLoading(false);
    }
  };

  // Reset
  const reset = () => {
    setStep('idle');
    setSession(null);
    sessionRef.current = null;
    setTranscription('');
    setKeyPhrases([]);
    setExtractedData(null);
    setPreview(null);
    setGeneratedBot(null);
    setError('');
    setRecordingTime(0);
    setCustomizations({ name: '', description: '' });
    setSelectedTemplate(null);
  };

  // Use template
  const useTemplate = async (template) => {
    setSelectedTemplate(template);
    setLoading(true);
    setError('');

    try {
      // Start session if not exists
      if (!session && !sessionRef.current) {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/api/voice-to-bot/start`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ language })
        });
        const data = await response.json();
        if (data.success) {
          setSession(data.session);
          sessionRef.current = data.session;
        }
      }

      // Use template data directly
      const templateData = {
        name: template.name,
        description: template.description,
        category: template.category,
        intents: template.intents || [],
        entities: template.entities || [],
        flows: template.flows || [],
        suggestedFeatures: template.suggested_features || []
      };

      setExtractedData(templateData);
      setTranscription(t('voiceToBot.templateUsed', `Using template: ${template.name}`));
      setCustomizations({
        name: template.name,
        description: template.description
      });
      setStep('preview');
    } catch (err) {
      setError(t('voiceToBot.errors.templateFailed', 'Failed to load template'));
    } finally {
      setLoading(false);
    }
  };

  // Format time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Go to bot
  const goToBot = () => {
    if (generatedBot) {
      navigate(`/edit-bot/${generatedBot.id}`);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>{t('voiceToBot.title', 'Voice to Bot')}</h1>
        <p style={styles.subtitle}>{t('voiceToBot.subtitle', 'Describe your bot and we will create it for you')}</p>
      </div>

      {error && (
        <div style={styles.error}>
          <span style={styles.errorIcon}>⚠️</span>
          {error}
          <button onClick={() => setError('')} style={styles.closeError}>×</button>
        </div>
      )}

      {/* Language Selection */}
      {step === 'idle' && !session && (
        <div style={styles.languageSection}>
          <label style={styles.label}>{t('voiceToBot.selectLanguage', 'Select Language')}</label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            style={styles.select}
          >
            <option value="en">English</option>
            <option value="ru">Русский</option>
            <option value="tr">Türkçe</option>
            <option value="az">Azərbaycanca</option>
            <option value="es">Español</option>
            <option value="de">Deutsch</option>
            <option value="fr">Français</option>
          </select>
        </div>
      )}

      {/* Recording Section */}
      {(step === 'idle' || step === 'recording') && (
        <div style={styles.recordingSection}>
          <div style={styles.microphoneContainer}>
            <button
              onClick={isRecording ? stopRecording : startRecording}
              style={{
                ...styles.micButton,
                ...(isRecording ? styles.micButtonRecording : {})
              }}
              disabled={loading}
            >
              <span style={styles.micIcon}>{isRecording ? '⏹️' : '🎤'}</span>
            </button>

            {isRecording && (
              <div style={styles.recordingIndicator}>
                <span style={styles.recordingDot}></span>
                <span style={styles.recordingTime}>{formatTime(recordingTime)}</span>
              </div>
            )}
          </div>

          <p style={styles.instructions}>
            {isRecording
              ? t('voiceToBot.recording', 'Recording... Click to stop')
              : t('voiceToBot.clickToRecord', 'Click the microphone to start recording')}
          </p>

          {!isRecording && (
            <div style={styles.exampleSection}>
              <h3 style={styles.exampleTitle}>{t('voiceToBot.examplePrompts', 'Example prompts:')}</h3>
              <ul style={styles.exampleList}>
                <li>{t('voiceToBot.example1', '"I need a customer support bot that handles returns and tracks orders"')}</li>
                <li>{t('voiceToBot.example2', '"Create a FAQ bot for my restaurant with menu and hours"')}</li>
                <li>{t('voiceToBot.example3', '"Build a booking bot for appointments at my salon"')}</li>
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Transcribing */}
      {step === 'transcribing' && (
        <div style={styles.processingSection}>
          <div style={styles.spinner}></div>
          <p style={styles.processingText}>{t('voiceToBot.transcribing', 'Transcribing your voice...')}</p>
        </div>
      )}

      {/* Extracting */}
      {step === 'extracting' && (
        <div style={styles.processingSection}>
          <div style={styles.spinner}></div>
          <p style={styles.processingText}>{t('voiceToBot.extracting', 'Analyzing and extracting intents...')}</p>
          {transcription && (
            <div style={styles.transcriptionPreview}>
              <strong>{t('voiceToBot.youSaid', 'You said:')}</strong>
              <p>"{transcription}"</p>
            </div>
          )}
        </div>
      )}

      {/* Preview Section */}
      {step === 'preview' && extractedData && (
        <div style={styles.previewSection}>
          <h2 style={styles.previewTitle}>{t('voiceToBot.botPreview', 'Bot Preview')}</h2>

          <div style={styles.transcriptionBox}>
            <strong>{t('voiceToBot.transcription', 'Transcription:')}</strong>
            <p style={styles.transcriptionText}>"{transcription}"</p>
          </div>

          <div style={styles.customizationSection}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>{t('voiceToBot.botName', 'Bot Name')}</label>
              <input
                type="text"
                value={customizations.name}
                onChange={(e) => setCustomizations(prev => ({ ...prev, name: e.target.value }))}
                style={styles.input}
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>{t('voiceToBot.description', 'Description')}</label>
              <textarea
                value={customizations.description}
                onChange={(e) => setCustomizations(prev => ({ ...prev, description: e.target.value }))}
                style={styles.textarea}
                rows={3}
              />
            </div>
          </div>

          <div style={styles.previewGrid}>
            <div style={styles.previewCard}>
              <h3 style={styles.cardTitle}>
                <span style={styles.cardIcon}>🎯</span>
                {t('voiceToBot.intents', 'Intents')} ({extractedData.intents?.length || 0})
              </h3>
              <ul style={styles.cardList}>
                {extractedData.intents?.slice(0, 5).map((intent, index) => (
                  <li key={index} style={styles.cardItem}>
                    <strong>{intent.displayName || intent.name}</strong>
                    <span style={styles.exampleCount}>
                      {intent.examples?.length || 0} {t('voiceToBot.examples', 'examples')}
                    </span>
                  </li>
                ))}
                {extractedData.intents?.length > 5 && (
                  <li style={styles.moreItems}>
                    +{extractedData.intents.length - 5} {t('voiceToBot.more', 'more')}
                  </li>
                )}
              </ul>
            </div>

            <div style={styles.previewCard}>
              <h3 style={styles.cardTitle}>
                <span style={styles.cardIcon}>📦</span>
                {t('voiceToBot.entities', 'Entities')} ({extractedData.entities?.length || 0})
              </h3>
              <ul style={styles.cardList}>
                {extractedData.entities?.map((entity, index) => (
                  <li key={index} style={styles.cardItem}>
                    <strong>{entity.name}</strong>
                    <span style={styles.entityType}>{entity.type}</span>
                  </li>
                ))}
                {(!extractedData.entities || extractedData.entities.length === 0) && (
                  <li style={styles.noItems}>{t('voiceToBot.noEntities', 'No entities detected')}</li>
                )}
              </ul>
            </div>

            <div style={styles.previewCard}>
              <h3 style={styles.cardTitle}>
                <span style={styles.cardIcon}>🔄</span>
                {t('voiceToBot.flows', 'Flows')} ({extractedData.flows?.length || 0})
              </h3>
              <ul style={styles.cardList}>
                {extractedData.flows?.map((flow, index) => (
                  <li key={index} style={styles.cardItem}>
                    <strong>{flow.name}</strong>
                    <span style={styles.flowSteps}>
                      {flow.steps?.length || 0} {t('voiceToBot.steps', 'steps')}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {extractedData.suggestedFeatures?.length > 0 && (
            <div style={styles.suggestionsBox}>
              <h3 style={styles.suggestionsTitle}>
                <span style={styles.cardIcon}>💡</span>
                {t('voiceToBot.suggestions', 'Suggested Features')}
              </h3>
              <div style={styles.tagList}>
                {extractedData.suggestedFeatures.map((feature, index) => (
                  <span key={index} style={styles.tag}>{feature}</span>
                ))}
              </div>
            </div>
          )}

          <div style={styles.buttonGroup}>
            <button onClick={reset} style={styles.secondaryButton}>
              {t('voiceToBot.startOver', 'Start Over')}
            </button>
            <button onClick={generateBot} style={styles.primaryButton} disabled={loading}>
              {loading ? t('voiceToBot.creating', 'Creating...') : t('voiceToBot.createBot', 'Create Bot')}
            </button>
          </div>
        </div>
      )}

      {/* Generating */}
      {step === 'generating' && (
        <div style={styles.processingSection}>
          <div style={styles.spinner}></div>
          <p style={styles.processingText}>{t('voiceToBot.generating', 'Generating your bot...')}</p>
        </div>
      )}

      {/* Completed */}
      {step === 'completed' && generatedBot && (
        <div style={styles.completedSection}>
          <div style={styles.successIcon}>✅</div>
          <h2 style={styles.successTitle}>{t('voiceToBot.success', 'Bot Created Successfully!')}</h2>
          <p style={styles.successText}>
            {t('voiceToBot.botCreated', 'Your bot "{{name}}" has been created.', { name: generatedBot.name })}
          </p>

          <div style={styles.statsGrid}>
            <div style={styles.statItem}>
              <span style={styles.statNumber}>{extractedData?.intents?.length || 0}</span>
              <span style={styles.statLabel}>{t('voiceToBot.intents', 'Intents')}</span>
            </div>
            <div style={styles.statItem}>
              <span style={styles.statNumber}>{extractedData?.entities?.length || 0}</span>
              <span style={styles.statLabel}>{t('voiceToBot.entities', 'Entities')}</span>
            </div>
            <div style={styles.statItem}>
              <span style={styles.statNumber}>1</span>
              <span style={styles.statLabel}>{t('voiceToBot.flow', 'Flow')}</span>
            </div>
          </div>

          <div style={styles.buttonGroup}>
            <button onClick={reset} style={styles.secondaryButton}>
              {t('voiceToBot.createAnother', 'Create Another Bot')}
            </button>
            <button onClick={goToBot} style={styles.primaryButton}>
              {t('voiceToBot.editBot', 'Edit Bot')}
            </button>
          </div>
        </div>
      )}

      {/* Templates Section */}
      {step === 'idle' && templates.length > 0 && (
        <div style={styles.templatesSection}>
          <h3 style={styles.templatesTitle}>{t('voiceToBot.orUseTemplate', 'Or start with a template')}</h3>
          <div style={styles.templatesGrid}>
            {templates.map(template => (
              <div
                key={template.id}
                style={styles.templateCard}
                onClick={() => useTemplate(template)}
              >
                <span style={styles.templateIcon}>
                  {template.category === 'support' ? '🎧' :
                   template.category === 'sales' ? '💼' :
                   template.category === 'faq' ? '❓' :
                   template.category === 'booking' ? '📅' : '🤖'}
                </span>
                <h4 style={styles.templateName}>{template.name}</h4>
                <p style={styles.templateDesc}>{template.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    padding: '24px',
    maxWidth: '1000px',
    margin: '0 auto'
  },
  header: {
    textAlign: 'center',
    marginBottom: '32px'
  },
  title: {
    fontSize: '28px',
    fontWeight: '600',
    marginBottom: '8px',
    color: '#1a1a2e'
  },
  subtitle: {
    fontSize: '16px',
    color: '#666'
  },
  error: {
    backgroundColor: '#fee2e2',
    color: '#dc2626',
    padding: '12px 16px',
    borderRadius: '8px',
    marginBottom: '24px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  errorIcon: {
    fontSize: '18px'
  },
  closeError: {
    marginLeft: 'auto',
    background: 'none',
    border: 'none',
    fontSize: '20px',
    cursor: 'pointer',
    color: '#dc2626'
  },
  languageSection: {
    marginBottom: '24px',
    textAlign: 'center'
  },
  label: {
    display: 'block',
    marginBottom: '8px',
    fontWeight: '500',
    color: '#374151'
  },
  select: {
    padding: '10px 16px',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    fontSize: '14px',
    minWidth: '200px'
  },
  recordingSection: {
    textAlign: 'center',
    padding: '40px 20px'
  },
  microphoneContainer: {
    position: 'relative',
    display: 'inline-block',
    marginBottom: '24px'
  },
  micButton: {
    width: '120px',
    height: '120px',
    borderRadius: '50%',
    border: 'none',
    backgroundColor: '#6366f1',
    color: 'white',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)'
  },
  micButtonRecording: {
    backgroundColor: '#ef4444',
    animation: 'pulse 1.5s infinite',
    boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)'
  },
  micIcon: {
    fontSize: '48px'
  },
  recordingIndicator: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    marginTop: '16px'
  },
  recordingDot: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    backgroundColor: '#ef4444',
    animation: 'blink 1s infinite'
  },
  recordingTime: {
    fontSize: '24px',
    fontWeight: '600',
    color: '#ef4444'
  },
  instructions: {
    fontSize: '16px',
    color: '#6b7280'
  },
  exampleSection: {
    marginTop: '40px',
    padding: '24px',
    backgroundColor: '#f9fafb',
    borderRadius: '12px',
    textAlign: 'left',
    maxWidth: '600px',
    margin: '40px auto 0'
  },
  exampleTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#374151',
    marginBottom: '12px'
  },
  exampleList: {
    margin: 0,
    padding: '0 0 0 20px',
    color: '#6b7280',
    fontSize: '14px',
    lineHeight: '1.8'
  },
  processingSection: {
    textAlign: 'center',
    padding: '60px 20px'
  },
  spinner: {
    width: '48px',
    height: '48px',
    border: '4px solid #e5e7eb',
    borderTop: '4px solid #6366f1',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    margin: '0 auto 24px'
  },
  processingText: {
    fontSize: '18px',
    color: '#374151'
  },
  transcriptionPreview: {
    marginTop: '24px',
    padding: '16px',
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
    maxWidth: '500px',
    margin: '24px auto 0'
  },
  previewSection: {
    padding: '20px'
  },
  previewTitle: {
    fontSize: '24px',
    fontWeight: '600',
    marginBottom: '24px',
    textAlign: 'center'
  },
  transcriptionBox: {
    backgroundColor: '#f0f9ff',
    padding: '16px',
    borderRadius: '8px',
    marginBottom: '24px'
  },
  transcriptionText: {
    fontStyle: 'italic',
    color: '#374151',
    margin: '8px 0 0'
  },
  customizationSection: {
    display: 'grid',
    gap: '16px',
    marginBottom: '24px'
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column'
  },
  input: {
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    fontSize: '14px'
  },
  textarea: {
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    fontSize: '14px',
    resize: 'vertical'
  },
  previewGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '16px',
    marginBottom: '24px'
  },
  previewCard: {
    backgroundColor: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '20px'
  },
  cardTitle: {
    fontSize: '16px',
    fontWeight: '600',
    marginBottom: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  cardIcon: {
    fontSize: '20px'
  },
  cardList: {
    listStyle: 'none',
    padding: 0,
    margin: 0
  },
  cardItem: {
    padding: '8px 0',
    borderBottom: '1px solid #f3f4f6',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  exampleCount: {
    fontSize: '12px',
    color: '#9ca3af'
  },
  entityType: {
    fontSize: '12px',
    color: '#6366f1',
    backgroundColor: '#eef2ff',
    padding: '2px 8px',
    borderRadius: '4px'
  },
  flowSteps: {
    fontSize: '12px',
    color: '#9ca3af'
  },
  moreItems: {
    color: '#6366f1',
    fontSize: '13px',
    fontStyle: 'italic'
  },
  noItems: {
    color: '#9ca3af',
    fontStyle: 'italic',
    fontSize: '13px'
  },
  suggestionsBox: {
    backgroundColor: '#fefce8',
    padding: '16px',
    borderRadius: '8px',
    marginBottom: '24px'
  },
  suggestionsTitle: {
    fontSize: '14px',
    fontWeight: '600',
    marginBottom: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  tagList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px'
  },
  tag: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
    padding: '4px 12px',
    borderRadius: '16px',
    fontSize: '13px'
  },
  buttonGroup: {
    display: 'flex',
    justifyContent: 'center',
    gap: '12px',
    marginTop: '24px'
  },
  primaryButton: {
    backgroundColor: '#6366f1',
    color: 'white',
    border: 'none',
    padding: '12px 32px',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '500',
    cursor: 'pointer'
  },
  secondaryButton: {
    backgroundColor: 'white',
    color: '#374151',
    border: '1px solid #e5e7eb',
    padding: '12px 32px',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '500',
    cursor: 'pointer'
  },
  completedSection: {
    textAlign: 'center',
    padding: '40px 20px'
  },
  successIcon: {
    fontSize: '64px',
    marginBottom: '16px'
  },
  successTitle: {
    fontSize: '24px',
    fontWeight: '600',
    color: '#059669',
    marginBottom: '8px'
  },
  successText: {
    fontSize: '16px',
    color: '#6b7280',
    marginBottom: '32px'
  },
  statsGrid: {
    display: 'flex',
    justifyContent: 'center',
    gap: '40px',
    marginBottom: '32px'
  },
  statItem: {
    textAlign: 'center'
  },
  statNumber: {
    display: 'block',
    fontSize: '32px',
    fontWeight: '700',
    color: '#6366f1'
  },
  statLabel: {
    fontSize: '14px',
    color: '#6b7280'
  },
  templatesSection: {
    marginTop: '48px',
    padding: '24px',
    backgroundColor: '#f9fafb',
    borderRadius: '12px'
  },
  templatesTitle: {
    fontSize: '16px',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: '20px',
    color: '#374151'
  },
  templatesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px'
  },
  templateCard: {
    backgroundColor: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '20px',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  },
  templateIcon: {
    fontSize: '32px',
    display: 'block',
    marginBottom: '12px'
  },
  templateName: {
    fontSize: '14px',
    fontWeight: '600',
    marginBottom: '4px'
  },
  templateDesc: {
    fontSize: '12px',
    color: '#6b7280',
    margin: 0
  }
};

// Add CSS animations
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.05); }
  }
  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
document.head.appendChild(styleSheet);

export default VoiceToBot;
