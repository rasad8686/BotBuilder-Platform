import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, AlertCircle, ClipboardList } from 'lucide-react';
import {
  SurveyRenderer,
  SurveyThankYou,
  SurveyProgress
} from '../../components/widget/surveys';

export default function PublicSurveyPage() {
  const { id } = useParams();
  const [survey, setSurvey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [responses, setResponses] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [sessionId] = useState(() => `ps_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);

  const apiUrl = window.location.origin;

  useEffect(() => {
    fetchSurvey();
    trackView();
  }, [id]);

  const fetchSurvey = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${apiUrl}/api/public/surveys/${id}`);

      if (!response.ok) {
        throw new Error('Survey not found');
      }

      const data = await response.json();
      setSurvey(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const trackView = async () => {
    try {
      await fetch(`${apiUrl}/api/public/surveys/${id}/view`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId })
      });
    } catch (err) {
      // Silent fail
    }
  };

  const questions = survey?.questions || [];
  const currentQuestion = questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === questions.length - 1;
  const isFirstQuestion = currentQuestionIndex === 0;
  const primaryColor = survey?.settings?.primaryColor || '#8b5cf6';

  const handleResponse = (questionId, value, additionalData = {}) => {
    setResponses(prev => ({
      ...prev,
      [questionId]: {
        value,
        ...additionalData,
        answeredAt: new Date().toISOString()
      }
    }));
  };

  const handleNext = async () => {
    const currentResponse = responses[currentQuestion?.id];

    if (currentQuestion?.required && !currentResponse?.value) {
      return;
    }

    if (isLastQuestion) {
      await submitSurvey();
    } else {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (!isFirstQuestion) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const submitSurvey = async () => {
    setIsSubmitting(true);

    try {
      const response = await fetch(`${apiUrl}/api/public/surveys/${id}/responses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
            url: window.location.href,
            referrer: document.referrer
          }
        })
      });

      if (!response.ok) {
        throw new Error('Submission failed');
      }

      setIsComplete(true);
    } catch (err) {
      console.error('Error submitting survey:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f3f4f6'
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <Loader2
            size={40}
            style={{
              animation: 'spin 1s linear infinite',
              color: '#8b5cf6'
            }}
          />
          <p style={{ marginTop: '16px', color: '#6b7280' }}>Yuklenir...</p>
        </div>
        <style>
          {`
            @keyframes spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `}
        </style>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f3f4f6'
        }}
      >
        <div
          style={{
            backgroundColor: '#ffffff',
            padding: '40px',
            borderRadius: '16px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
            textAlign: 'center',
            maxWidth: '400px'
          }}
        >
          <AlertCircle size={48} color="#ef4444" style={{ marginBottom: '16px' }} />
          <h2 style={{ margin: '0 0 8px', color: '#1f2937' }}>Survey Tapilmadi</h2>
          <p style={{ margin: 0, color: '#6b7280' }}>
            Bu survey movcud deyil ve ya baglanilib.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#f3f4f6',
        padding: '40px 20px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}
    >
      <div
        style={{
          maxWidth: '600px',
          margin: '0 auto'
        }}
      >
        {/* Survey Card */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
            overflow: 'hidden'
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '24px 28px',
              backgroundColor: primaryColor,
              color: '#ffffff'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '8px'
              }}
            >
              <ClipboardList size={24} />
              <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>
                {survey?.title || 'Survey'}
              </h1>
            </div>
            {survey?.description && (
              <p style={{ margin: 0, opacity: 0.9, fontSize: '14px' }}>
                {survey.description}
              </p>
            )}
          </div>

          {/* Progress */}
          {!isComplete && questions.length > 1 && (
            <SurveyProgress
              current={currentQuestionIndex + 1}
              total={questions.length}
              primaryColor={primaryColor}
            />
          )}

          {/* Content */}
          <div style={{ padding: '28px' }}>
            {isComplete ? (
              <SurveyThankYou
                message={survey?.thank_you_message}
                primaryColor={primaryColor}
              />
            ) : (
              <>
                {/* Question */}
                <SurveyRenderer
                  question={currentQuestion}
                  value={responses[currentQuestion?.id]?.value}
                  comment={responses[currentQuestion?.id]?.comment}
                  onChange={(value, additionalData) =>
                    handleResponse(currentQuestion.id, value, additionalData)
                  }
                  primaryColor={primaryColor}
                />

                {/* Navigation */}
                <div
                  style={{
                    marginTop: '28px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    {!isFirstQuestion && (
                      <button
                        onClick={handlePrevious}
                        style={{
                          padding: '12px 20px',
                          backgroundColor: '#f3f4f6',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '14px',
                          color: '#4b5563'
                        }}
                      >
                        Geri
                      </button>
                    )}
                  </div>

                  <button
                    onClick={handleNext}
                    disabled={isSubmitting || (currentQuestion?.required && !responses[currentQuestion?.id]?.value)}
                    style={{
                      padding: '12px 28px',
                      backgroundColor: primaryColor,
                      border: 'none',
                      borderRadius: '8px',
                      cursor: isSubmitting ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#ffffff',
                      opacity: isSubmitting || (currentQuestion?.required && !responses[currentQuestion?.id]?.value) ? 0.6 : 1
                    }}
                  >
                    {isSubmitting ? 'Gonderilir...' : isLastQuestion ? 'Gonder' : 'Novbeti'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Branding */}
        <div
          style={{
            textAlign: 'center',
            marginTop: '24px',
            fontSize: '12px',
            color: '#9ca3af'
          }}
        >
          Powered by BotBuilder
        </div>
      </div>
    </div>
  );
}
