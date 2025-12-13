import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import API_URL from '../utils/api';
import { io } from 'socket.io-client';

// Professional Microphone Icon SVG Component
const MicrophoneIcon = ({ isRecording, size = 48 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ filter: isRecording ? 'drop-shadow(0 0 8px rgba(255,255,255,0.5))' : 'none' }}
  >
    <path
      d="M12 1C10.34 1 9 2.34 9 4V12C9 13.66 10.34 15 12 15C13.66 15 15 13.66 15 12V4C15 2.34 13.66 1 12 1Z"
      fill="currentColor"
    />
    <path
      d="M19 10V12C19 15.87 15.87 19 12 19C8.13 19 5 15.87 5 12V10H3V12C3 16.41 6.32 20.06 10.5 20.77V23H13.5V20.77C17.68 20.06 21 16.41 21 12V10H19Z"
      fill="currentColor"
    />
  </svg>
);

// Stop Icon SVG
const StopIcon = ({ size = 36 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </svg>
);

// Pause Icon SVG
const PauseIcon = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="4" width="4" height="16" rx="1" />
    <rect x="14" y="4" width="4" height="16" rx="1" />
  </svg>
);

// Play Icon SVG
const PlayIcon = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 5v14l11-7z" />
  </svg>
);

// Trash Icon SVG
const TrashIcon = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);

// Audio Waveform Visualizer Component
const AudioWaveform = ({ isActive, audioLevel = 0 }) => {
  const bars = 24;
  const [levels, setLevels] = useState(Array(bars).fill(0.1));
  const audioLevelRef = useRef(audioLevel);

  // Keep ref updated with latest audioLevel
  useEffect(() => {
    audioLevelRef.current = audioLevel;
  }, [audioLevel]);

  useEffect(() => {
    if (!isActive) {
      setLevels(Array(bars).fill(0.1));
      return;
    }

    const interval = setInterval(() => {
      const currentLevel = audioLevelRef.current;
      setLevels(prev => prev.map((_, i) => {
        const centerDistance = Math.abs(i - bars / 2) / (bars / 2);
        // More dynamic response to audio
        const baseLevel = 0.15 + Math.random() * 0.3 * (1 - centerDistance * 0.5);
        const audioInfluence = currentLevel * 2 * (1 - centerDistance * 0.3);
        return Math.min(1, baseLevel + audioInfluence);
      }));
    }, 50);

    return () => clearInterval(interval);
  }, [isActive]);

  return (
    <div style={waveformStyles.container}>
      {levels.map((level, i) => (
        <div
          key={i}
          style={{
            ...waveformStyles.bar,
            height: `${level * 100}%`,
            opacity: 0.4 + level * 0.6,
            background: `linear-gradient(180deg, #a855f7 0%, #6366f1 50%, #3b82f6 100%)`,
            transition: 'height 0.05s ease-out'
          }}
        />
      ))}
    </div>
  );
};

const waveformStyles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '3px',
    height: '60px',
    padding: '0 20px'
  },
  bar: {
    width: '4px',
    borderRadius: '2px',
    minHeight: '4px'
  }
};

// Animated Ring Component for Microphone
const AnimatedRings = ({ isRecording }) => {
  if (!isRecording) return null;

  return (
    <>
      <div style={ringStyles.ring1} />
      <div style={ringStyles.ring2} />
      <div style={ringStyles.ring3} />
    </>
  );
};

const ringStyles = {
  ring1: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    border: '2px solid rgba(168, 85, 247, 0.4)',
    animation: 'ringPulse 2s ease-out infinite'
  },
  ring2: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    border: '2px solid rgba(99, 102, 241, 0.3)',
    animation: 'ringPulse 2s ease-out infinite 0.5s'
  },
  ring3: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    border: '2px solid rgba(59, 130, 246, 0.2)',
    animation: 'ringPulse 2s ease-out infinite 1s'
  }
};

// Listening Animation Component
const ListeningAnimation = () => (
  <div style={listeningStyles.container}>
    <div style={listeningStyles.orb}>
      <div style={listeningStyles.orbInner} />
      <div style={listeningStyles.orbGlow} />
    </div>
    <span style={listeningStyles.text}>Listening</span>
    <div style={listeningStyles.dots}>
      <span style={{ ...listeningStyles.dot, animationDelay: '0s' }} />
      <span style={{ ...listeningStyles.dot, animationDelay: '0.2s' }} />
      <span style={{ ...listeningStyles.dot, animationDelay: '0.4s' }} />
    </div>
  </div>
);

const listeningStyles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    padding: '12px 24px',
    background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.1) 0%, rgba(99, 102, 241, 0.1) 100%)',
    borderRadius: '24px',
    marginBottom: '16px'
  },
  orb: {
    position: 'relative',
    width: '16px',
    height: '16px'
  },
  orbInner: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)',
    animation: 'orbPulse 1.5s ease-in-out infinite'
  },
  orbGlow: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)',
    filter: 'blur(6px)',
    opacity: 0.5,
    animation: 'orbPulse 1.5s ease-in-out infinite'
  },
  text: {
    fontSize: '15px',
    fontWeight: '500',
    background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text'
  },
  dots: {
    display: 'flex',
    gap: '4px'
  },
  dot: {
    width: '4px',
    height: '4px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)',
    animation: 'dotBounce 1s ease-in-out infinite'
  }
};

const VoiceToBot = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // State
  const [step, setStep] = useState('idle');
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
  const [micLoading, setMicLoading] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);

  // Refs
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const streamRef = useRef(null);
  const sessionRef = useRef(null);
  const speechRecognitionRef = useRef(null);
  const socketRef = useRef(null);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const useWebSocketStreamingRef = useRef(false);

  // Audio Level Analyzer - for waveform animation
  const startAudioAnalyzer = (stream) => {
    try {
      // Stop any existing analyzer
      stopAudioAnalyzer();

      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);

      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.3;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateLevel = () => {
        if (!analyserRef.current) return;

        analyser.getByteFrequencyData(dataArray);
        // Calculate RMS for better audio level detection
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sum / dataArray.length);
        const level = Math.min(1, rms / 128);

        setAudioLevel(level);
        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };

      updateLevel();
      console.log('[VoiceToBot] Audio analyzer started');
    } catch (e) {
      console.warn('[VoiceToBot] Audio analyzer error:', e);
    }
  };

  const stopAudioAnalyzer = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    analyserRef.current = null;
    setAudioLevel(0);
  };

  // Initialize WebSocket connection
  useEffect(() => {
    // Determine WebSocket URL based on environment
    let wsUrl;
    if (API_URL && API_URL !== '' && !API_URL.includes('render.com')) {
      // Use API_URL if it's set and not the default render.com URL
      wsUrl = API_URL.replace(/^http/, 'ws').replace(/\/api$/, '');
    } else if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      // Development: connect to backend on port 5000
      wsUrl = `ws://${window.location.hostname}:5000`;
    } else {
      // Production: use same origin
      wsUrl = window.location.origin.replace(/^http/, 'ws');
    }

    console.log('[VoiceToBot] Connecting to WebSocket:', wsUrl);

    socketRef.current = io(wsUrl, {
      path: '/ws',
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      upgrade: true
    });

    socketRef.current.on('connect', () => {
      console.log('[VoiceToBot] WebSocket connected');
    });

    socketRef.current.on('voice:ready', (data) => {
      console.log('[VoiceToBot] Voice streaming ready', data);
      useWebSocketStreamingRef.current = true;

      // Set a timeout - if no transcript received within 3 seconds, fallback to Web Speech
      setTimeout(() => {
        // Check if we still haven't received any transcript
        if (useWebSocketStreamingRef.current && !document.querySelector('[data-transcript-received]')) {
          console.log('[VoiceToBot] No transcript received, checking Web Speech fallback...');
        }
      }, 3000);
    });

    socketRef.current.on('voice:fallback', (data) => {
      console.log('[VoiceToBot] Google Cloud STT not available:', data.reason);
      useWebSocketStreamingRef.current = false;
      // Do NOT fallback to Web Speech API - it produces incorrect results
      // Just show a message that real-time transcription is not available
      setInterimTranscript('(Real-time transcription not available)');
    });

    socketRef.current.on('voice:transcript', (data) => {
      // Handle real-time transcription from Google Cloud STT
      console.log('[VoiceToBot] Received transcript:', data);

      if (data.isFinal) {
        // Final result - REPLACE (not accumulate) live transcript
        setLiveTranscript(data.transcript);
        setInterimTranscript('');
        console.log('[VoiceToBot] Final transcript REPLACED:', data.transcript);
      } else {
        // Interim result - REPLACE with current text (no accumulation)
        setInterimTranscript(data.transcript);
      }
    });

    socketRef.current.on('voice:error', (data) => {
      console.error('[VoiceToBot] Voice streaming error:', data.error);
      useWebSocketStreamingRef.current = false;
      // Do NOT fallback to Web Speech API - just log the error
    });

    socketRef.current.on('voice:restart', (data) => {
      console.log('[VoiceToBot] Streaming restart requested:', data.reason);
      // Restart streaming session if still recording
      if (isRecording && streamRef.current) {
        socketRef.current.emit('voice:start', {
          language: language,
          sessionId: sessionRef.current?.session_id
        });
      }
    });

    socketRef.current.on('voice:timeout', (data) => {
      console.log('[VoiceToBot] Streaming timeout:', data.reason);
      // Keep current transcripts, just log the timeout
    });

    socketRef.current.on('voice:complete', (data) => {
      console.log('[VoiceToBot] Voice streaming complete', {
        finalTranscript: data.finalTranscript?.substring(0, 50),
        chunks: data.audioChunksProcessed
      });
    });

    socketRef.current.on('disconnect', (reason) => {
      console.log('[VoiceToBot] WebSocket disconnected:', reason);
      useWebSocketStreamingRef.current = false;
    });

    socketRef.current.on('reconnect', (attemptNumber) => {
      console.log('[VoiceToBot] WebSocket reconnected after', attemptNumber, 'attempts');
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  useEffect(() => {
    fetchTemplates();
    return () => {
      stopRecording();
      stopAudioAnalyzer();
      if (speechRecognitionRef.current) {
        speechRecognitionRef.current.stop();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const getSpeechLangCode = (lang) => {
    const langMap = {
      'en': 'en-US',
      'az': 'az-AZ',
      'tr': 'tr-TR',
      'ru': 'ru-RU',
      'es': 'es-ES',
      'de': 'de-DE',
      'fr': 'fr-FR'
    };
    return langMap[lang] || 'en-US';
  };

  const startSpeechRecognition = (audioStream) => {
    setLiveTranscript('');
    setInterimTranscript('');

    // Use ONLY Google Cloud STT for real-time transcription (more accurate)
    // Do NOT use Web Speech API - it produces incorrect results
    if (socketRef.current && socketRef.current.connected) {
      console.log('[VoiceToBot] Starting Google Cloud STT streaming for real-time transcription...');

      // Notify server to start streaming session
      socketRef.current.emit('voice:start', {
        language: language,
        sessionId: sessionRef.current?.session_id
      });

      try {
        // Create AudioContext for processing
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioContextRef.current = new AudioContext({ sampleRate: 48000 });

        // Create media stream source (needed for audio context)
        audioContextRef.current.createMediaStreamSource(audioStream);

        // Determine best audio format for streaming
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/webm')
            ? 'audio/webm'
            : 'audio/mp4';

        console.log('[VoiceToBot] Using audio format:', mimeType);

        const streamRecorder = new MediaRecorder(audioStream, { mimeType });

        // Track chunk count for debugging
        let chunkCount = 0;

        streamRecorder.ondataavailable = (event) => {
          if (event.data.size > 0 && socketRef.current && socketRef.current.connected) {
            chunkCount++;
            // Convert blob to ArrayBuffer and send to server
            event.data.arrayBuffer().then((buffer) => {
              socketRef.current.emit('voice:audio', buffer);
            }).catch(err => {
              console.warn('[VoiceToBot] Error converting audio chunk:', err);
            });
          }
        };

        streamRecorder.onerror = (event) => {
          console.error('[VoiceToBot] MediaRecorder error:', event.error);
        };

        streamRecorder.onstop = () => {
          console.log('[VoiceToBot] MediaRecorder stopped, total chunks:', chunkCount);
        };

        // Start recording with 100ms chunks for Gemini-level real-time streaming
        // 100ms = optimal balance between latency and accuracy
        streamRecorder.start(100);
        processorRef.current = streamRecorder;

        console.log('[VoiceToBot] Audio streaming to Google Cloud STT started (100ms chunks, Gemini-level)');
      } catch (error) {
        console.error('[VoiceToBot] Failed to setup audio streaming:', error);
      }
    } else {
      console.warn('[VoiceToBot] WebSocket not connected, cannot start Google Cloud STT');
    }
  };

  const startWebSpeechRecognition = () => {
    // Stop any existing recognition first
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch (e) {}
      speechRecognitionRef.current = null;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('[VoiceToBot] Web Speech API not supported in this browser');
      return;
    }

    console.log('[VoiceToBot] Initializing Web Speech API...');

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = getSpeechLangCode(language);
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      console.log('[VoiceToBot] Web Speech API started, listening...');
    };

    recognition.onresult = (event) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript + ' ';
          console.log('[VoiceToBot] Web Speech final:', transcript);
        } else {
          interim = transcript;
          console.log('[VoiceToBot] Web Speech interim:', transcript);
        }
      }

      if (final) {
        setLiveTranscript(prev => prev + final);
      }
      setInterimTranscript(interim);
    };

    recognition.onerror = (event) => {
      console.warn('[VoiceToBot] Web Speech error:', event.error);
      // Don't clear interim on no-speech, just wait
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        setInterimTranscript('');
      }
    };

    recognition.onend = () => {
      console.log('[VoiceToBot] Web Speech ended, checking if should restart...');
      // Use ref to check if still recording (avoids stale closure)
      if (streamRef.current && speechRecognitionRef.current === recognition) {
        console.log('[VoiceToBot] Restarting Web Speech...');
        try {
          recognition.start();
        } catch (e) {
          console.warn('[VoiceToBot] Could not restart recognition:', e);
        }
      }
    };

    speechRecognitionRef.current = recognition;

    try {
      recognition.start();
      console.log('[VoiceToBot] Web Speech API recognition.start() called');
    } catch (e) {
      console.error('[VoiceToBot] Failed to start Web Speech:', e);
    }
  };

  const stopSpeechRecognition = () => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('voice:stop');
    }

    if (processorRef.current) {
      try {
        processorRef.current.stop();
      } catch (e) {
        console.warn('Error stopping processor:', e);
      }
      processorRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (speechRecognitionRef.current) {
      speechRecognitionRef.current.stop();
      speechRecognitionRef.current = null;
    }

    setInterimTranscript('');
  };

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
        sessionRef.current = data.session;
        setStep('idle');
        return data.session;
      }
      return null;
    } catch (err) {
      setError(t('voiceToBot.errors.sessionFailed'));
      return null;
    } finally {
      setLoading(false);
    }
  };

  const startRecording = async () => {
    try {
      setMicLoading(true);
      setError('');
      setLiveTranscript('');
      setInterimTranscript('');

      if (!session) {
        await startSession();
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Start audio analyzer for waveform
      startAudioAnalyzer(stream);

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

      mediaRecorder.start(1000);
      setIsRecording(true);
      setStep('recording');
      setRecordingTime(0);

      startSpeechRecognition(stream);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (err) {
      setError(t('voiceToBot.errors.microphoneAccess'));
      console.error('Microphone access error:', err);
    } finally {
      setMicLoading(false);
    }
  };

  const stopRecording = useCallback(() => {
    stopSpeechRecognition();
    stopAudioAnalyzer();

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

  // Handle Pause/Resume recording
  const handlePause = useCallback(() => {
    if (isPaused) {
      // RESUME
      if (mediaRecorderRef.current?.state === 'paused') {
        mediaRecorderRef.current.resume();
      }
      // Audio track-ları ENABLE et
      if (streamRef.current) {
        streamRef.current.getAudioTracks().forEach(track => {
          track.enabled = true;
        });
      }
      // Restart timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      setIsPaused(false);
      console.log('[VoiceToBot] Recording resumed');
    } else {
      // PAUSE
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.pause();
      }
      // Audio track-ları DISABLE et - mikrofon susar
      if (streamRef.current) {
        streamRef.current.getAudioTracks().forEach(track => {
          track.enabled = false;
        });
      }
      // Stop timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setIsPaused(true);
      console.log('[VoiceToBot] Recording paused');
    }
  }, [isPaused]);

  // Handle Cancel recording - NO navigation, just reset
  const handleCancel = useCallback(() => {
    console.log('[VoiceToBot] Cancelling recording...');

    // Stop speech recognition
    stopSpeechRecognition();
    stopAudioAnalyzer();

    // Stop MediaRecorder without triggering onstop handler
    if (mediaRecorderRef.current) {
      try {
        // Remove onstop handler to prevent transcription
        mediaRecorderRef.current.onstop = null;
        mediaRecorderRef.current.stop();
      } catch (e) {}
      mediaRecorderRef.current = null;
    }

    // Clear timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Stop media stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Stop WebSocket streaming
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('voice:stop');
    }

    // Clear audio chunks
    audioChunksRef.current = [];

    // Reset ALL state - NO navigation
    setIsRecording(false);
    setIsPaused(false);
    setRecordingTime(0);
    setLiveTranscript('');
    setInterimTranscript('');
    setStep('idle');

    // Show deleted message
    setShowDeleted(true);
    setTimeout(() => setShowDeleted(false), 2000);

    console.log('[VoiceToBot] Recording cancelled, state reset');
  }, []);

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

  const transcribeAudio = async (audioBlob) => {
    try {
      setStep('transcribing');
      setLoading(true);

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
        let processedTranscription = data.transcription;
        const eldjoVariants = [
          'elçin', 'elçi', 'elçü', 'elcü', 'elcu', 'elçu',
          'elçin borcu', 'elçin borcu ölçüsü',
          'əl çoğu', 'əl çogu', 'el çoğu', 'el çogu',
          'el-dru', 'eldru', 'bildru', 'elzur', 'yaqut',
          'el dru', 'el-drü', 'eldrü', 'eld-ru',
          'ona elə', 'ona ele', 'ildur', 'İldur', 'eldur',
          'eldju', 'eldjü', 'el-djo', 'el-dju',
          'elco', 'elço', 'elso', 'elşo'
        ];
        eldjoVariants.forEach(variant => {
          const regex = new RegExp(variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
          processedTranscription = processedTranscription.replace(regex, 'Eldjo');
        });

        setTranscription(processedTranscription);
        setKeyPhrases(data.keyPhrases || []);
        setStep('extracting');
        await extractIntents(processedTranscription);
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
          extractedData
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
    setLiveTranscript('');
    setInterimTranscript('');
  };

  const useTemplate = async (template) => {
    setSelectedTemplate(template);
    setLoading(true);
    setError('');

    try {
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

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const goToBot = () => {
    if (generatedBot) {
      navigate(`/bot/${generatedBot.id}/edit`);
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

      {/* Deleted Message */}
      {showDeleted && (
        <div style={styles.deletedMessage}>
          <TrashIcon size={20} />
          <span>Silindi!</span>
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

      {/* Recording Section - Professional Design */}
      {(step === 'idle' || step === 'recording') && (
        <div style={styles.recordingSection}>
          {/* Professional Microphone Button */}
          <div style={styles.microphoneContainer}>
            <AnimatedRings isRecording={isRecording} />
            <button
              onClick={isRecording ? stopRecording : startRecording}
              style={{
                ...styles.micButton,
                ...(isRecording ? styles.micButtonRecording : {}),
                ...(micLoading ? styles.micButtonLoading : {})
              }}
              disabled={micLoading}
            >
              <div style={styles.micButtonInner}>
                {micLoading ? (
                  <div style={styles.loadingSpinner} />
                ) : isRecording ? (
                  <StopIcon size={32} />
                ) : (
                  <MicrophoneIcon isRecording={isRecording} size={40} />
                )}
              </div>
            </button>
          </div>

          {/* Recording Info */}
          {isRecording && (
            <div style={styles.recordingInfo}>
              {!isPaused && <ListeningAnimation />}
              <div style={styles.recordingTime}>
                <span style={{
                  ...styles.recordingDot,
                  backgroundColor: isPaused ? '#f59e0b' : '#ef4444',
                  animation: isPaused ? 'none' : 'blink 1s infinite'
                }} />
                <span style={styles.timeText}>{formatTime(recordingTime)}</span>
              </div>
              {/* Control Buttons */}
              <div style={styles.controlButtons}>
                <button
                  onClick={handlePause}
                  style={styles.pauseButton}
                  title={isPaused ? 'Resume' : 'Pause'}
                >
                  {isPaused ? <PlayIcon size={20} /> : <PauseIcon size={20} />}
                </button>
                <button
                  onClick={handleCancel}
                  style={styles.cancelButton}
                  title="Cancel"
                >
                  <TrashIcon size={20} />
                </button>
              </div>
              {/* Paused Indicator */}
              {isPaused && (
                <div style={styles.pausedIndicator}>
                  <span style={styles.pausedText}>⏸️ Paused</span>
                </div>
              )}
            </div>
          )}

          {/* Audio Waveform - stops when paused */}
          {isRecording && (
            <div style={styles.waveformContainer}>
              <AudioWaveform isActive={isRecording && !isPaused} audioLevel={isPaused ? 0 : audioLevel} />
            </div>
          )}

          {/* Instructions */}
          {!isRecording && (
            <p style={styles.instructions}>
              {t('voiceToBot.clickToRecord', 'Click the microphone to start recording')}
            </p>
          )}

          {/* Live Transcription Display */}
          {isRecording && (
            <div style={styles.liveTranscriptBox}>
              <div style={styles.liveTranscriptHeader}>
                <div style={styles.streamingBadge}>
                  <span style={styles.streamingDot} />
                  Real-time Transcription
                </div>
              </div>
              {(liveTranscript || interimTranscript) ? (
                <div style={styles.liveTranscriptContent}>
                  <p style={styles.liveTranscriptText}>
                    {liveTranscript}
                    <span style={styles.interimText}>{interimTranscript}</span>
                    <span style={styles.cursor} />
                  </p>
                </div>
              ) : (
                <div style={styles.waitingIndicator}>
                  <div style={styles.waitingDots}>
                    <span style={{ ...styles.waitingDot, animationDelay: '0s' }} />
                    <span style={{ ...styles.waitingDot, animationDelay: '0.15s' }} />
                    <span style={{ ...styles.waitingDot, animationDelay: '0.3s' }} />
                  </div>
                  <span style={styles.waitingText}>Waiting for speech...</span>
                </div>
              )}
            </div>
          )}

          {/* Examples */}
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

      {/* Transcribing - Professional Loading */}
      {step === 'transcribing' && (
        <div style={styles.processingSection}>
          <div style={styles.processingOrb}>
            <div style={styles.orbCore} />
            <div style={styles.orbRing1} />
            <div style={styles.orbRing2} />
          </div>
          <p style={styles.processingText}>{t('voiceToBot.transcribing', 'Transcribing your voice...')}</p>
          <div style={styles.processingSubtext}>Processing audio with AI</div>
        </div>
      )}

      {/* Extracting */}
      {step === 'extracting' && (
        <div style={styles.processingSection}>
          <div style={styles.processingOrb}>
            <div style={styles.orbCore} />
            <div style={styles.orbRing1} />
            <div style={styles.orbRing2} />
          </div>
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
            <div style={styles.transcriptionHeader}>
              <strong>{t('voiceToBot.transcription', 'Transcription:')}</strong>
              <span style={styles.editHint}>{t('voiceToBot.editHint', '(click to edit)')}</span>
            </div>
            <textarea
              value={transcription}
              onChange={(e) => setTranscription(e.target.value)}
              style={styles.transcriptionInput}
              rows={3}
              placeholder={t('voiceToBot.transcriptionPlaceholder', 'Edit transcription here...')}
            />
            <button
              onClick={() => extractIntents(transcription)}
              style={styles.regenerateButton}
              disabled={loading || !transcription.trim()}
            >
              {loading ? t('voiceToBot.regenerating', 'Regenerating...') : t('voiceToBot.regenerateBot', 'Regenerate Bot')}
            </button>
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
          <div style={styles.processingOrb}>
            <div style={styles.orbCore} />
            <div style={styles.orbRing1} />
            <div style={styles.orbRing2} />
          </div>
          <p style={styles.processingText}>{t('voiceToBot.generating', 'Generating your bot...')}</p>
          <div style={styles.processingSubtext}>Creating intents, entities, and flows</div>
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
  deletedMessage: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    color: '#ef4444',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: '12px 24px',
    borderRadius: '8px',
    marginBottom: '24px',
    fontSize: '16px',
    fontWeight: '600',
    animation: 'fadeInOut 2s ease-in-out'
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
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '160px',
    height: '160px',
    marginBottom: '24px'
  },
  micButton: {
    width: '120px',
    height: '120px',
    borderRadius: '50%',
    border: 'none',
    background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 50%, #3b82f6 100%)',
    color: 'white',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    boxShadow: '0 8px 32px rgba(99, 102, 241, 0.35), 0 0 0 0 rgba(168, 85, 247, 0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    zIndex: 1
  },
  micButtonRecording: {
    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
    boxShadow: '0 8px 32px rgba(239, 68, 68, 0.4), 0 0 0 0 rgba(239, 68, 68, 0.4)',
    animation: 'micPulse 2s ease-in-out infinite'
  },
  micButtonLoading: {
    background: 'linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)',
    cursor: 'wait',
    boxShadow: '0 4px 16px rgba(156, 163, 175, 0.4)'
  },
  micButtonInner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  loadingSpinner: {
    width: '32px',
    height: '32px',
    border: '3px solid rgba(255,255,255,0.3)',
    borderTop: '3px solid white',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },
  recordingInfo: {
    marginBottom: '20px'
  },
  recordingTime: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    marginTop: '12px'
  },
  controlButtons: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    marginTop: '16px'
  },
  pauseButton: {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    border: 'none',
    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    color: 'white',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 12px rgba(245, 158, 11, 0.35)',
    transition: 'all 0.2s ease'
  },
  cancelButton: {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    border: 'none',
    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
    color: 'white',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 12px rgba(239, 68, 68, 0.35)',
    transition: 'all 0.2s ease'
  },
  pausedIndicator: {
    marginTop: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  pausedText: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#f59e0b',
    background: 'rgba(245, 158, 11, 0.1)',
    padding: '6px 16px',
    borderRadius: '20px',
    border: '1px solid rgba(245, 158, 11, 0.3)'
  },
  recordingDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    backgroundColor: '#ef4444',
    animation: 'blink 1s infinite'
  },
  timeText: {
    fontSize: '24px',
    fontWeight: '600',
    fontFamily: 'monospace',
    background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text'
  },
  waveformContainer: {
    marginBottom: '24px',
    padding: '16px',
    background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.05) 0%, rgba(99, 102, 241, 0.05) 100%)',
    borderRadius: '16px',
    maxWidth: '500px',
    margin: '0 auto 24px'
  },
  instructions: {
    fontSize: '16px',
    color: '#6b7280'
  },
  liveTranscriptBox: {
    marginTop: '24px',
    padding: '20px 24px',
    background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.03) 0%, rgba(99, 102, 241, 0.03) 100%)',
    border: '1px solid rgba(168, 85, 247, 0.15)',
    borderRadius: '16px',
    maxWidth: '600px',
    margin: '24px auto 0',
    minHeight: '100px'
  },
  liveTranscriptHeader: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '16px'
  },
  streamingBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)',
    color: 'white',
    padding: '6px 14px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '600'
  },
  streamingDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: '#fff',
    animation: 'blink 1s infinite'
  },
  liveTranscriptContent: {
    position: 'relative'
  },
  liveTranscriptText: {
    color: '#1a1a2e',
    fontSize: '17px',
    lineHeight: '1.7',
    margin: 0,
    fontFamily: 'inherit',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word'
  },
  interimText: {
    color: '#9ca3af',
    fontStyle: 'italic'
  },
  cursor: {
    display: 'inline-block',
    width: '2px',
    height: '20px',
    background: 'linear-gradient(180deg, #a855f7 0%, #6366f1 100%)',
    marginLeft: '2px',
    animation: 'cursorBlink 0.8s infinite',
    verticalAlign: 'text-bottom'
  },
  waitingIndicator: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    padding: '16px 0'
  },
  waitingDots: {
    display: 'flex',
    gap: '8px'
  },
  waitingDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)',
    animation: 'dotBounce 1.2s ease-in-out infinite'
  },
  waitingText: {
    fontSize: '14px',
    color: '#9ca3af'
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
  processingOrb: {
    position: 'relative',
    width: '80px',
    height: '80px',
    margin: '0 auto 32px'
  },
  orbCore: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 50%, #3b82f6 100%)',
    boxShadow: '0 0 30px rgba(168, 85, 247, 0.5)',
    animation: 'orbPulse 1.5s ease-in-out infinite'
  },
  orbRing1: {
    position: 'absolute',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    border: '2px solid transparent',
    borderTopColor: '#a855f7',
    borderBottomColor: '#6366f1',
    animation: 'orbSpin 1.5s linear infinite'
  },
  orbRing2: {
    position: 'absolute',
    top: '-10px',
    left: '-10px',
    width: 'calc(100% + 20px)',
    height: 'calc(100% + 20px)',
    borderRadius: '50%',
    border: '2px solid transparent',
    borderLeftColor: '#3b82f6',
    borderRightColor: '#a855f7',
    animation: 'orbSpin 2s linear infinite reverse'
  },
  processingText: {
    fontSize: '20px',
    fontWeight: '500',
    color: '#374151',
    marginBottom: '8px'
  },
  processingSubtext: {
    fontSize: '14px',
    color: '#9ca3af'
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
  transcriptionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px'
  },
  editHint: {
    fontSize: '12px',
    color: '#6366f1',
    fontWeight: '400'
  },
  transcriptionInput: {
    width: '100%',
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid #bfdbfe',
    fontSize: '14px',
    resize: 'vertical',
    fontFamily: 'inherit',
    backgroundColor: 'white',
    marginBottom: '12px',
    boxSizing: 'border-box'
  },
  regenerateButton: {
    backgroundColor: '#6366f1',
    color: 'white',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
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
    background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)',
    color: 'white',
    border: 'none',
    padding: '12px 32px',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '500',
    cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)'
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
    background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text'
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
  @keyframes ringPulse {
    0% {
      transform: scale(1);
      opacity: 0.6;
    }
    100% {
      transform: scale(2);
      opacity: 0;
    }
  }

  @keyframes micPulse {
    0%, 100% {
      transform: scale(1);
      box-shadow: 0 8px 32px rgba(239, 68, 68, 0.4), 0 0 0 0 rgba(239, 68, 68, 0.4);
    }
    50% {
      transform: scale(1.02);
      box-shadow: 0 8px 32px rgba(239, 68, 68, 0.4), 0 0 40px 8px rgba(239, 68, 68, 0.2);
    }
  }

  @keyframes orbPulse {
    0%, 100% {
      transform: translate(-50%, -50%) scale(1);
      opacity: 1;
    }
    50% {
      transform: translate(-50%, -50%) scale(1.1);
      opacity: 0.8;
    }
  }

  @keyframes orbSpin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  @keyframes dotBounce {
    0%, 80%, 100% {
      transform: translateY(0);
      opacity: 0.5;
    }
    40% {
      transform: translateY(-8px);
      opacity: 1;
    }
  }

  @keyframes cursorBlink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }

  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  @keyframes fadeInOut {
    0% { opacity: 0; transform: translateY(-10px); }
    15% { opacity: 1; transform: translateY(0); }
    85% { opacity: 1; transform: translateY(0); }
    100% { opacity: 0; transform: translateY(-10px); }
  }
`;
document.head.appendChild(styleSheet);

export default VoiceToBot;
