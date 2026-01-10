import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import {
  Clock,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  Send,
  Flag
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function CertificationExam() {
  const { slug } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [examData, setExamData] = useState(location.state?.examData || null);
  const [loading, setLoading] = useState(!location.state?.examData);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [flagged, setFlagged] = useState({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');

  // Initialize timer
  useEffect(() => {
    if (examData?.certification?.time_limit) {
      setTimeLeft(examData.certification.time_limit * 60);
    }
  }, [examData]);

  // Countdown timer
  useEffect(() => {
    if (timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          handleSubmit(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAnswerChange = async (questionId, answer) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));

    // Submit answer to server
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_BASE}/api/certifications/attempts/${examData.attempt.id}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ question_id: questionId, answer })
      });
    } catch (err) {
      console.error('Failed to save answer');
    }
  };

  const handleSubmit = async (timedOut = false) => {
    if (submitting) return;

    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_BASE}/api/certifications/attempts/${examData.attempt.id}/complete`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      const data = await response.json();

      if (data.success) {
        navigate(`/certifications/${slug}/results/${examData.attempt.id}`, {
          state: { results: data.results }
        });
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Failed to submit exam');
    } finally {
      setSubmitting(false);
      setShowConfirm(false);
    }
  };

  const toggleFlag = (questionId) => {
    setFlagged(prev => ({ ...prev, [questionId]: !prev[questionId] }));
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (!examData) {
    return (
      <div className="p-6">
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
          No exam data found. Please start the exam from the certification page.
        </div>
      </div>
    );
  }

  const { questions, certification, attempt } = examData;
  const currentQuestion = questions[currentIndex];
  const answeredCount = Object.keys(answers).length;
  const isLastQuestion = currentIndex === questions.length - 1;
  const isLowTime = timeLeft < 300; // Less than 5 minutes

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-white font-medium">{certification.name}</h1>
            <p className="text-gray-400 text-sm">
              Question {currentIndex + 1} of {questions.length}
            </p>
          </div>

          <div className="flex items-center gap-6">
            {/* Timer */}
            <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
              isLowTime ? 'bg-red-500/20 text-red-400' : 'bg-gray-700 text-white'
            }`}>
              <Clock className="w-5 h-5" />
              <span className="font-mono text-lg">{formatTime(timeLeft)}</span>
            </div>

            {/* Submit Button */}
            <button
              onClick={() => setShowConfirm(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              Submit Exam
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Question Navigator */}
        <div className="w-64 bg-gray-800 border-r border-gray-700 p-4 hidden lg:block">
          <h3 className="text-gray-400 text-sm mb-3">Questions</h3>
          <div className="grid grid-cols-5 gap-2">
            {questions.map((q, index) => (
              <button
                key={q.id}
                onClick={() => setCurrentIndex(index)}
                className={`w-10 h-10 rounded-lg text-sm font-medium relative ${
                  currentIndex === index
                    ? 'bg-blue-600 text-white'
                    : answers[q.id]
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                }`}
              >
                {index + 1}
                {flagged[q.id] && (
                  <Flag className="w-3 h-3 text-yellow-400 absolute -top-1 -right-1" />
                )}
              </button>
            ))}
          </div>

          <div className="mt-6 space-y-2 text-sm">
            <div className="flex items-center gap-2 text-gray-400">
              <div className="w-4 h-4 bg-green-500/20 rounded" />
              <span>Answered ({answeredCount})</span>
            </div>
            <div className="flex items-center gap-2 text-gray-400">
              <div className="w-4 h-4 bg-gray-700 rounded" />
              <span>Unanswered ({questions.length - answeredCount})</span>
            </div>
            <div className="flex items-center gap-2 text-gray-400">
              <Flag className="w-4 h-4 text-yellow-400" />
              <span>Flagged ({Object.values(flagged).filter(Boolean).length})</span>
            </div>
          </div>
        </div>

        {/* Question Content */}
        <div className="flex-1 p-6">
          <div className="max-w-3xl mx-auto">
            {/* Question */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 mb-6">
              <div className="flex items-start justify-between mb-4">
                <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm">
                  {currentQuestion.points} {currentQuestion.points === 1 ? 'point' : 'points'}
                </span>
                <button
                  onClick={() => toggleFlag(currentQuestion.id)}
                  className={`p-2 rounded-lg ${
                    flagged[currentQuestion.id]
                      ? 'bg-yellow-500/20 text-yellow-400'
                      : 'bg-gray-700 text-gray-400 hover:text-yellow-400'
                  }`}
                >
                  <Flag className="w-5 h-5" />
                </button>
              </div>

              <p className="text-white text-lg mb-6">{currentQuestion.question}</p>

              {/* Answer Options */}
              {currentQuestion.type === 'single' && (
                <div className="space-y-3">
                  {currentQuestion.options.map((option, index) => (
                    <label
                      key={index}
                      className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                        answers[currentQuestion.id] === option
                          ? 'border-blue-500 bg-blue-500/10'
                          : 'border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`question-${currentQuestion.id}`}
                        checked={answers[currentQuestion.id] === option}
                        onChange={() => handleAnswerChange(currentQuestion.id, option)}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span className="text-white">{option}</span>
                    </label>
                  ))}
                </div>
              )}

              {currentQuestion.type === 'multiple' && (
                <div className="space-y-3">
                  {currentQuestion.options.map((option, index) => {
                    const selectedAnswers = answers[currentQuestion.id] || [];
                    const isSelected = selectedAnswers.includes(option);

                    return (
                      <label
                        key={index}
                        className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                          isSelected
                            ? 'border-blue-500 bg-blue-500/10'
                            : 'border-gray-700 hover:border-gray-600'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            const newAnswers = isSelected
                              ? selectedAnswers.filter(a => a !== option)
                              : [...selectedAnswers, option];
                            handleAnswerChange(currentQuestion.id, newAnswers);
                          }}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <span className="text-white">{option}</span>
                      </label>
                    );
                  })}
                  <p className="text-gray-400 text-sm">Select all that apply</p>
                </div>
              )}

              {currentQuestion.type === 'code' && (
                <div>
                  <textarea
                    value={answers[currentQuestion.id] || currentQuestion.code_template || ''}
                    onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                    className="w-full h-48 p-4 bg-gray-900 border border-gray-700 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-blue-500"
                    placeholder="Write your code here..."
                  />
                </div>
              )}
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                disabled={currentIndex === 0}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>

              {isLastQuestion ? (
                <button
                  onClick={() => setShowConfirm(true)}
                  className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  <CheckCircle className="w-4 h-4" />
                  Finish Exam
                </button>
              ) : (
                <button
                  onClick={() => setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1))}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Submit Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md border border-gray-700">
            <h2 className="text-xl font-bold text-white mb-4">Submit Exam?</h2>

            <div className="space-y-3 mb-6">
              <div className="flex items-center justify-between text-gray-400">
                <span>Questions answered:</span>
                <span className="text-white">{answeredCount} / {questions.length}</span>
              </div>
              <div className="flex items-center justify-between text-gray-400">
                <span>Time remaining:</span>
                <span className="text-white">{formatTime(timeLeft)}</span>
              </div>
            </div>

            {answeredCount < questions.length && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-6">
                <div className="flex items-center gap-2 text-yellow-400">
                  <AlertCircle className="w-4 h-4" />
                  <span>You have {questions.length - answeredCount} unanswered questions</span>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
              >
                Continue Exam
              </button>
              <button
                onClick={() => handleSubmit(false)}
                disabled={submitting}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
