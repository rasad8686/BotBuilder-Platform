import { useState, useRef, useEffect, useCallback } from 'react';
import ChatMessage from './ChatMessage';
import SuggestedQuestions from './SuggestedQuestions';
import { translations, languageFlags } from '../../locales/docsAI';

// Generate unique conversation ID
const generateConversationId = () => {
  return 'conv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
};

// Get or create conversation ID from localStorage
const getConversationId = () => {
  let id = localStorage.getItem('docsai_conversation_id');
  if (!id) {
    id = generateConversationId();
    localStorage.setItem('docsai_conversation_id', id);
  }
  return id;
};

export default function DocsAI() {
  const [isOpen, setIsOpen] = useState(false);
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('docsai_language') || 'en';
  });
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem('docsai_messages');
    return saved ? JSON.parse(saved) : [];
  });
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [conversationId] = useState(getConversationId);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const chatContainerRef = useRef(null);

  const t = translations[language] || translations.en;

  // Save messages to localStorage
  useEffect(() => {
    localStorage.setItem('docsai_messages', JSON.stringify(messages));
  }, [messages]);

  // Save language preference
  useEffect(() => {
    localStorage.setItem('docsai_language', language);
  }, [language]);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Handle send message
  const sendMessage = async (messageText) => {
    const text = messageText || inputValue.trim();
    if (!text || isLoading) return;

    const userMessage = {
      role: 'user',
      content: text,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/docs-ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          message: text,
          language: language,
          conversationHistory: messages.slice(-10) // Last 10 messages for context
        })
      });

      if (response.status === 429) {
        throw new Error('rate_limit');
      }

      if (!response.ok) {
        throw new Error('api_error');
      }

      const data = await response.json();

      const aiMessage = {
        role: 'assistant',
        content: data.reply,
        timestamp: new Date().toISOString(),
        suggestedFollowUps: data.suggestedFollowUps
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('DocsAI error:', error);
      const errorMessage = error.message === 'rate_limit'
        ? t.error.rateLimit
        : error.message === 'network'
        ? t.error.network
        : t.error.api;

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: errorMessage,
        timestamp: new Date().toISOString(),
        isError: true
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle key press
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Clear chat
  const clearChat = () => {
    setMessages([]);
    localStorage.removeItem('docsai_messages');
    localStorage.setItem('docsai_conversation_id', generateConversationId());
  };

  // Export chat
  const exportChat = () => {
    const text = messages
      .map(m => `[${m.role.toUpperCase()}] ${new Date(m.timestamp).toLocaleString()}\n${m.content}\n`)
      .join('\n---\n\n');

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `botbuilder-chat-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Handle language change
  const changeLanguage = (lang) => {
    setLanguage(lang);
    setShowLanguageMenu(false);
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-[60px] h-[60px] rounded-full shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-110"
        style={{
          background: 'linear-gradient(135deg, #635bff 0%, #8b5cf6 100%)',
          boxShadow: '0 4px 20px rgba(99, 91, 255, 0.4)'
        }}
        aria-label="Open AI Assistant"
      >
        {/* Chat bubble icon */}
        <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>

        {/* AI Badge */}
        <span
          className="absolute -top-1 -right-1 px-2 py-0.5 text-xs font-bold rounded-full"
          style={{ backgroundColor: '#fff', color: '#635bff' }}
        >
          AI
        </span>

        {/* Pulse animation */}
        <span
          className="absolute inset-0 rounded-full animate-ping opacity-30"
          style={{ backgroundColor: '#635bff' }}
        />
      </button>

      {/* Chat Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={() => setIsOpen(false)}
          />

          {/* Modal */}
          <div
            className="relative w-full sm:w-[420px] h-full sm:h-[600px] sm:max-h-[80vh] bg-white sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slideUp"
            style={{
              animation: 'slideUp 0.3s ease-out'
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-3 border-b"
              style={{
                background: 'linear-gradient(135deg, #635bff 0%, #8b5cf6 100%)',
                borderColor: 'transparent'
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
                >
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-white">{t.title}</h3>
                  <p className="text-xs text-white text-opacity-80">{t.powered}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Language Selector */}
                <div className="relative">
                  <button
                    onClick={() => setShowLanguageMenu(!showLanguageMenu)}
                    className="px-2 py-1 rounded-lg text-sm font-medium transition-colors"
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.2)',
                      color: '#fff'
                    }}
                  >
                    {languageFlags[language].flag}
                  </button>

                  {showLanguageMenu && (
                    <div
                      className="absolute right-0 top-full mt-1 py-1 rounded-lg shadow-lg overflow-hidden"
                      style={{ backgroundColor: '#fff', minWidth: '120px' }}
                    >
                      {Object.entries(languageFlags).map(([code, { flag, name }]) => (
                        <button
                          key={code}
                          onClick={() => changeLanguage(code)}
                          className="w-full px-3 py-2 text-sm text-left flex items-center gap-2 hover:bg-gray-100 transition-colors"
                          style={{
                            backgroundColor: language === code ? '#f6f9fc' : 'transparent',
                            color: '#32325d'
                          }}
                        >
                          <span>{flag}</span>
                          <span>{name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Close Button */}
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                  style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
                >
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Messages Area */}
            <div
              ref={chatContainerRef}
              className="flex-1 overflow-y-auto p-4"
              style={{ backgroundColor: '#fff' }}
              aria-label="AI Assistant messages"
              aria-live="polite"
            >
              {messages.length === 0 ? (
                <div className="h-full flex flex-col justify-center">
                  {/* Welcome message */}
                  <div className="text-center mb-6">
                    <div
                      className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
                      style={{
                        background: 'linear-gradient(135deg, #635bff 0%, #8b5cf6 100%)'
                      }}
                    >
                      <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </div>
                    <p className="text-sm" style={{ color: '#8898aa' }}>
                      {t.welcome}
                    </p>
                  </div>

                  {/* Suggested questions */}
                  <SuggestedQuestions
                    language={language}
                    onSelect={sendMessage}
                    disabled={isLoading}
                  />
                </div>
              ) : (
                <>
                  {messages.map((message, index) => (
                    <ChatMessage
                      key={index}
                      role={message.role}
                      content={message.content}
                      timestamp={message.timestamp}
                    />
                  ))}

                  {/* Loading indicator */}
                  {isLoading && (
                    <ChatMessage
                      role="assistant"
                      content=""
                      isLoading={true}
                    />
                  )}

                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Suggested follow-ups (if available) */}
            {messages.length > 0 && messages[messages.length - 1]?.suggestedFollowUps?.length > 0 && !isLoading && (
              <div className="px-4 pb-2">
                <div className="flex flex-wrap gap-2">
                  {messages[messages.length - 1].suggestedFollowUps.map((followUp, index) => (
                    <button
                      key={index}
                      onClick={() => sendMessage(followUp)}
                      className="px-3 py-1 text-xs rounded-full transition-colors"
                      style={{
                        backgroundColor: '#f6f9fc',
                        color: '#635bff',
                        border: '1px solid #e6ebf1'
                      }}
                    >
                      {followUp}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input Area */}
            <div
              className="p-4 border-t"
              style={{ borderColor: '#e6ebf1', backgroundColor: '#f6f9fc' }}
            >
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <textarea
                    ref={inputRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder={t.placeholder}
                    rows={1}
                    className="w-full px-4 py-3 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                    style={{
                      backgroundColor: '#fff',
                      border: '1px solid #e6ebf1',
                      color: '#32325d'
                    }}
                    aria-label="Type your question"
                    disabled={isLoading}
                  />
                </div>
                <button
                  onClick={() => sendMessage()}
                  disabled={!inputValue.trim() || isLoading}
                  className="px-4 py-3 rounded-xl font-medium transition-all"
                  style={{
                    background: inputValue.trim() && !isLoading
                      ? 'linear-gradient(135deg, #635bff 0%, #8b5cf6 100%)'
                      : '#e6ebf1',
                    color: inputValue.trim() && !isLoading ? '#fff' : '#8898aa',
                    cursor: inputValue.trim() && !isLoading ? 'pointer' : 'not-allowed'
                  }}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>

              {/* Action buttons */}
              {messages.length > 0 && (
                <div className="flex justify-center gap-4 mt-3">
                  <button
                    onClick={clearChat}
                    className="text-xs flex items-center gap-1 transition-colors hover:opacity-80"
                    style={{ color: '#8898aa' }}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    {t.clear}
                  </button>
                  <button
                    onClick={exportChat}
                    className="text-xs flex items-center gap-1 transition-colors hover:opacity-80"
                    style={{ color: '#8898aa' }}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    {t.export}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CSS Animation */}
      <style>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }
      `}</style>
    </>
  );
}
