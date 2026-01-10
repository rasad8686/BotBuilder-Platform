import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { Bot, MessageCircle, X, Send, Paperclip } from 'lucide-react';
import { SurveyWidget } from './surveys';

const DEFAULT_CONFIG = {
  primaryColor: '#8b5cf6',
  position: 'right',
  size: 'medium',
  welcomeMessage: 'Hello! How can I help you today?',
  botName: 'Assistant',
  botAvatar: null,
  placeholder: 'Type a message...',
  offlineMessage: 'We are currently offline. Leave a message!',
};

const SIZES = {
  small: { width: 320, height: 400 },
  medium: { width: 380, height: 500 },
  large: { width: 420, height: 600 },
};

export default function ChatWidget({ botId, config = {}, apiUrl }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [sessionId, setSessionId] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showSurvey, setShowSurvey] = useState(false);
  const [activeSurvey, setActiveSurvey] = useState(null);
  const [surveyTriggerType, setSurveyTriggerType] = useState(null);

  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);
  const fileInputRef = useRef(null);
  const surveyShownRef = useRef(false);

  const settings = { ...DEFAULT_CONFIG, ...config };
  const size = SIZES[settings.size] || SIZES.medium;

  // Initialize session and socket connection
  useEffect(() => {
    if (!botId) return;

    // Generate or get session ID
    let storedSessionId = localStorage.getItem(`widget_session_${botId}`);
    if (!storedSessionId) {
      storedSessionId = `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem(`widget_session_${botId}`, storedSessionId);
    }
    setSessionId(storedSessionId);

    // Load message history
    const storedMessages = localStorage.getItem(`widget_messages_${botId}`);
    if (storedMessages) {
      try {
        setMessages(JSON.parse(storedMessages));
      } catch (e) {
        // Silent fail
      }
    } else {
      // Show welcome message
      setMessages([{
        id: 'welcome',
        type: 'bot',
        content: settings.welcomeMessage,
        timestamp: new Date().toISOString()
      }]);
    }

    // Connect to socket
    const serverUrl = apiUrl || window.location.origin;
    socketRef.current = io(serverUrl, {
      path: '/ws',
      transports: ['polling'],
      upgrade: false,
      query: { botId, sessionId: storedSessionId }
    });

    socketRef.current.on('connect', () => {
      setIsOnline(true);
      socketRef.current.emit('widget:join', { botId, sessionId: storedSessionId });
    });

    socketRef.current.on('disconnect', () => {
      setIsOnline(false);
    });

    socketRef.current.on('widget:typing', () => {
      setIsTyping(true);
    });

    socketRef.current.on('widget:message', (data) => {
      setIsTyping(false);
      const newMessage = {
        id: Date.now(),
        type: 'bot',
        content: data.message,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => {
        const updated = [...prev, newMessage];
        localStorage.setItem(`widget_messages_${botId}`, JSON.stringify(updated));
        return updated;
      });
    });

    socketRef.current.on('widget:error', () => {
      setIsTyping(false);
    });

    // Listen for survey trigger from server
    socketRef.current.on('widget:survey', (data) => {
      if (data.survey && !surveyShownRef.current) {
        setActiveSurvey(data.survey);
        setSurveyTriggerType(data.trigger_type);
        setShowSurvey(true);
        surveyShownRef.current = true;
      }
    });

    // Listen for chat end to trigger survey
    socketRef.current.on('widget:chat_ended', () => {
      triggerSurvey('after_chat');
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [botId, apiUrl, settings.welcomeMessage]);

  // Fetch survey for trigger type
  const fetchSurveyForTrigger = async (triggerType) => {
    try {
      const serverUrl = apiUrl || window.location.origin;
      const response = await fetch(
        `${serverUrl}/api/public/surveys/active?bot_id=${botId}&trigger_type=${triggerType}`
      );
      if (response.ok) {
        const data = await response.json();
        return data.survey;
      }
    } catch (err) {
      console.error('Error fetching survey:', err);
    }
    return null;
  };

  // Trigger survey by type
  const triggerSurvey = async (triggerType) => {
    if (surveyShownRef.current) return;

    const survey = await fetchSurveyForTrigger(triggerType);
    if (survey) {
      setActiveSurvey(survey);
      setSurveyTriggerType(triggerType);
      setShowSurvey(true);
      surveyShownRef.current = true;
    }
  };

  // Handle survey completion
  const handleSurveyComplete = (responses) => {
    // Emit survey completion event
    if (socketRef.current?.connected) {
      socketRef.current.emit('widget:survey_completed', {
        botId,
        sessionId,
        surveyId: activeSurvey?.id,
        responses
      });
    }
  };

  // Handle survey close
  const handleSurveyClose = () => {
    setShowSurvey(false);
    setActiveSurvey(null);
  };

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const sendMessage = async () => {
    if (!inputValue.trim() || !sessionId) return;

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: inputValue.trim(),
      timestamp: new Date().toISOString()
    };

    setMessages(prev => {
      const updated = [...prev, userMessage];
      localStorage.setItem(`widget_messages_${botId}`, JSON.stringify(updated));
      return updated;
    });
    setInputValue('');
    setIsTyping(true);

    if (socketRef.current?.connected) {
      socketRef.current.emit('widget:message', {
        botId,
        sessionId,
        message: userMessage.content
      });
    } else {
      // Offline - store message for later
      const offlineMessages = JSON.parse(localStorage.getItem(`widget_offline_${botId}`) || '[]');
      offlineMessages.push(userMessage);
      localStorage.setItem(`widget_offline_${botId}`, JSON.stringify(offlineMessages));

      setIsTyping(false);
      setMessages(prev => [...prev, {
        id: Date.now(),
        type: 'bot',
        content: settings.offlineMessage,
        timestamp: new Date().toISOString()
      }]);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('botId', botId);
    formData.append('sessionId', sessionId);

    try {
      const serverUrl = apiUrl || window.location.origin;
      const response = await fetch(`${serverUrl}/api/widget/upload`, {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        const fileMessage = {
          id: Date.now(),
          type: 'user',
          content: `📎 ${file.name}`,
          fileUrl: data.url,
          timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, fileMessage]);
      }
    } catch (err) {
      // Silent fail
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        [settings.position]: '20px',
        zIndex: 9999,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}
    >
      {/* Chat Window */}
      {isOpen && (
        <div
          style={{
            width: `${size.width}px`,
            height: `${size.height}px`,
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            marginBottom: '16px',
            animation: 'slideUp 0.3s ease'
          }}
        >
          <style>
            {`
              @keyframes slideUp {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
              }
              @keyframes bounce {
                0%, 60%, 100% { transform: translateY(0); }
                30% { transform: translateY(-4px); }
              }
            `}
          </style>

          {/* Header */}
          <div
            style={{
              padding: '16px 20px',
              backgroundColor: settings.primaryColor,
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}
          >
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255,255,255,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px'
              }}
            >
              {settings.botAvatar || <Bot size={20} />}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: '600', fontSize: '16px' }}>{settings.botName}</div>
              <div style={{ fontSize: '12px', opacity: 0.9 }}>
                {isOnline ? '● Online' : '○ Offline'}
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                cursor: 'pointer',
                color: 'white',
                fontSize: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              backgroundColor: '#f9fafb'
            }}
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  justifyContent: msg.type === 'user' ? 'flex-end' : 'flex-start'
                }}
              >
                <div
                  style={{
                    maxWidth: '80%',
                    padding: '12px 16px',
                    borderRadius: msg.type === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    backgroundColor: msg.type === 'user' ? settings.primaryColor : '#ffffff',
                    color: msg.type === 'user' ? 'white' : '#1f2937',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                  }}
                >
                  <div style={{ fontSize: '14px', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                    {msg.content}
                  </div>
                  <div
                    style={{
                      fontSize: '10px',
                      opacity: 0.7,
                      marginTop: '4px',
                      textAlign: msg.type === 'user' ? 'right' : 'left'
                    }}
                  >
                    {formatTime(msg.timestamp)}
                  </div>
                </div>
              </div>
            ))}

            {/* Typing Indicator */}
            {isTyping && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: '16px',
                    backgroundColor: '#ffffff',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    display: 'flex',
                    gap: '4px'
                  }}
                >
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: settings.primaryColor,
                        opacity: 0.6,
                        animation: `bounce 1.4s ease-in-out ${i * 0.2}s infinite`
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div
            style={{
              padding: '12px 16px',
              borderTop: '1px solid #e5e7eb',
              backgroundColor: '#ffffff',
              display: 'flex',
              gap: '8px',
              alignItems: 'center'
            }}
          >
            {/* File Upload */}
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
              accept="image/*,.pdf,.doc,.docx"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '20px',
                opacity: isUploading ? 0.5 : 1,
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#6b7280'
              }}
            >
              <Paperclip size={20} />
            </button>

            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={settings.placeholder}
              style={{
                flex: 1,
                padding: '10px 14px',
                border: '1px solid #e5e7eb',
                borderRadius: '20px',
                outline: 'none',
                fontSize: '14px'
              }}
            />

            <button
              onClick={sendMessage}
              disabled={!inputValue.trim()}
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: inputValue.trim() ? settings.primaryColor : '#e5e7eb',
                border: 'none',
                cursor: inputValue.trim() ? 'pointer' : 'default',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                transition: 'background 0.2s'
              }}
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Chat Bubble */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          backgroundColor: settings.primaryColor,
          border: 'none',
          cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '28px',
          color: 'white',
          transition: 'transform 0.2s, box-shadow 0.2s',
          marginLeft: settings.position === 'right' ? 'auto' : '0'
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.transform = 'scale(1.1)';
          e.currentTarget.style.boxShadow = '0 6px 25px rgba(0, 0, 0, 0.25)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.2)';
        }}
      >
        {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
      </button>

      {/* Survey Widget */}
      {showSurvey && activeSurvey && (
        <SurveyWidget
          survey={activeSurvey}
          config={{
            primaryColor: settings.primaryColor,
            position: settings.position
          }}
          apiUrl={apiUrl}
          sessionId={sessionId}
          onComplete={handleSurveyComplete}
          onClose={handleSurveyClose}
        />
      )}
    </div>
  );
}
