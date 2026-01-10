import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronRight, ChevronLeft } from 'lucide-react';
import SurveyRenderer from './SurveyRenderer';
import SurveyThankYou from './SurveyThankYou';
import SurveyProgress from './SurveyProgress';

const DEFAULT_CONFIG = {
  primaryColor: '#8b5cf6',
  position: 'right',
  showProgress: true,
  allowSkip: false,
  closeOnComplete: true,
  closeDelay: 3000,
};

export default function SurveyWidget({
  survey,
  config = {},
  apiUrl,
  sessionId,
  onComplete,
  onClose,
  onResponse
}) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [responses, setResponses] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState(null);

  const containerRef = useRef(null);
  const settings = { ...DEFAULT_CONFIG, ...config };

  const questions = survey?.questions || [];
  const currentQuestion = questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === questions.length - 1;
  const isFirstQuestion = currentQuestionIndex === 0;

  // Handle response for current question
  const handleResponse = (questionId, value, additionalData = {}) => {
    setResponses(prev => ({
      ...prev,
      [questionId]: {
        value,
        ...additionalData,
        answeredAt: new Date().toISOString()
      }
    }));
    setError(null);

    // Notify parent of response
    if (onResponse) {
      onResponse(questionId, value, additionalData);
    }
  };

  // Navigate to next question or submit
  const handleNext = async () => {
    const currentResponse = responses[currentQuestion?.id];

    // Validate required questions
    if (currentQuestion?.required && !currentResponse?.value) {
      setError('Bu sual cavablandirmalidi');
      return;
    }

    if (isLastQuestion) {
      await submitSurvey();
    } else {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  // Navigate to previous question
  const handlePrevious = () => {
    if (!isFirstQuestion) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  // Skip current question
  const handleSkip = () => {
    if (!currentQuestion?.required && !isLastQuestion) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else if (isLastQuestion) {
      submitSurvey();
    }
  };

  // Submit survey responses
  const submitSurvey = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const serverUrl = apiUrl || window.location.origin;
      const response = await fetch(`${serverUrl}/api/public/surveys/${survey.id}/responses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          session_id: sessionId,
          responses: Object.entries(responses).map(([questionId, data]) => ({
            question_id: questionId,
            value: data.value,
            comment: data.comment,
            answered_at: data.answeredAt
          })),
          completed_at: new Date().toISOString(),
          metadata: {
            userAgent: navigator.userAgent,
            url: window.location.href
          }
        })
      });

      if (!response.ok) {
        throw new Error('Cavab gonderilmedi');
      }

      setIsComplete(true);

      if (onComplete) {
        onComplete(responses);
      }

      // Auto close after delay
      if (settings.closeOnComplete) {
        setTimeout(() => {
          if (onClose) onClose();
        }, settings.closeDelay);
      }
    } catch (err) {
      setError('Xeta bas verdi. Yeniden cehd edin.');
      console.error('Survey submission error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle close
  const handleClose = () => {
    if (onClose) {
      onClose();
    }
  };

  if (!survey || !questions.length) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        bottom: '100px',
        [settings.position]: '20px',
        zIndex: 10000,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        width: '360px',
        maxWidth: 'calc(100vw - 40px)'
      }}
    >
      <style>
        {`
          @keyframes surveySlideUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes surveyFadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
        `}
      </style>

      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15)',
          overflow: 'hidden',
          animation: 'surveySlideUp 0.3s ease'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            backgroundColor: settings.primaryColor,
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ fontWeight: '600', fontSize: '16px' }}>
            {survey.title || 'Anket'}
          </div>
          <button
            onClick={handleClose}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              borderRadius: '50%',
              width: '28px',
              height: '28px',
              cursor: 'pointer',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Progress Bar */}
        {settings.showProgress && !isComplete && questions.length > 1 && (
          <SurveyProgress
            current={currentQuestionIndex + 1}
            total={questions.length}
            primaryColor={settings.primaryColor}
          />
        )}

        {/* Content */}
        <div style={{ padding: '20px' }}>
          {isComplete ? (
            <SurveyThankYou
              message={survey.thank_you_message}
              primaryColor={settings.primaryColor}
            />
          ) : (
            <>
              {/* Question Renderer */}
              <SurveyRenderer
                question={currentQuestion}
                value={responses[currentQuestion?.id]?.value}
                comment={responses[currentQuestion?.id]?.comment}
                onChange={(value, additionalData) =>
                  handleResponse(currentQuestion.id, value, additionalData)
                }
                primaryColor={settings.primaryColor}
              />

              {/* Error Message */}
              {error && (
                <div
                  style={{
                    marginTop: '12px',
                    padding: '10px 14px',
                    backgroundColor: '#fef2f2',
                    color: '#dc2626',
                    borderRadius: '8px',
                    fontSize: '13px'
                  }}
                >
                  {error}
                </div>
              )}

              {/* Navigation */}
              <div
                style={{
                  marginTop: '20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px'
                }}
              >
                {/* Left side - Previous button */}
                <div>
                  {!isFirstQuestion && (
                    <button
                      onClick={handlePrevious}
                      style={{
                        padding: '10px 16px',
                        backgroundColor: '#f3f4f6',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        color: '#4b5563',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <ChevronLeft size={16} />
                      Geri
                    </button>
                  )}
                </div>

                {/* Right side - Skip and Next/Submit buttons */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  {settings.allowSkip && !currentQuestion?.required && (
                    <button
                      onClick={handleSkip}
                      style={{
                        padding: '10px 16px',
                        backgroundColor: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '14px',
                        color: '#9ca3af'
                      }}
                    >
                      Kec
                    </button>
                  )}

                  <button
                    onClick={handleNext}
                    disabled={isSubmitting}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: settings.primaryColor,
                      border: 'none',
                      borderRadius: '8px',
                      cursor: isSubmitting ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      fontWeight: '500',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      opacity: isSubmitting ? 0.7 : 1
                    }}
                  >
                    {isSubmitting ? (
                      'Gonderilir...'
                    ) : isLastQuestion ? (
                      'Gonder'
                    ) : (
                      <>
                        Novbeti
                        <ChevronRight size={16} />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
