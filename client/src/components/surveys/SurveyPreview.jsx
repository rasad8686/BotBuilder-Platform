import React, { useState } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Smartphone,
  Monitor,
  Send
} from 'lucide-react';
import QuestionPreview from './QuestionPreview';

const SurveyPreview = ({ survey, onClose }) => {
  const [viewMode, setViewMode] = useState('desktop'); // desktop | mobile
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showThankYou, setShowThankYou] = useState(false);

  const questions = survey.questions || [];
  const currentQuestion = questions[currentQuestionIndex];
  const progress = questions.length > 0 ? ((currentQuestionIndex + 1) / questions.length) * 100 : 0;

  const handleAnswer = (value) => {
    setAnswers({
      ...answers,
      [currentQuestion.id]: value
    });
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      setShowThankYou(true);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const canProceed = () => {
    if (!currentQuestion) return false;
    if (!currentQuestion.required) return true;
    const answer = answers[currentQuestion.id];
    return answer !== undefined && answer !== null && answer !== '';
  };

  const resetPreview = () => {
    setCurrentQuestionIndex(0);
    setAnswers({});
    setShowThankYou(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl mx-4 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-semibold text-gray-900">Preview</h2>
            <span className="text-sm text-gray-500">{survey.name || 'Untitled Survey'}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('desktop')}
                className={`p-2 rounded ${viewMode === 'desktop' ? 'bg-white shadow-sm' : 'text-gray-500'}`}
                title="Desktop view"
              >
                <Monitor className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('mobile')}
                className={`p-2 rounded ${viewMode === 'mobile' ? 'bg-white shadow-sm' : 'text-gray-500'}`}
                title="Mobile view"
              >
                <Smartphone className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Preview Area */}
        <div className="flex-1 bg-gray-100 p-8 overflow-auto flex items-center justify-center">
          <div
            className={`bg-white rounded-xl shadow-lg transition-all ${
              viewMode === 'mobile' ? 'w-[375px]' : 'w-full max-w-xl'
            }`}
          >
            {questions.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-gray-500">No questions added yet.</p>
                <p className="text-sm text-gray-400 mt-1">Add questions to see the preview.</p>
              </div>
            ) : showThankYou ? (
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Send className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Thank You!</h3>
                <p className="text-gray-500">
                  {survey.settings?.thank_you_message || 'Thank you for your feedback!'}
                </p>
                <button
                  onClick={resetPreview}
                  className="mt-6 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg text-sm"
                >
                  Restart Preview
                </button>
              </div>
            ) : (
              <>
                {/* Progress Bar */}
                {survey.settings?.show_progress !== false && (
                  <div className="px-6 pt-4">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>Question {currentQuestionIndex + 1} of {questions.length}</span>
                      <span>{Math.round(progress)}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Question */}
                <div className="p-6">
                  <QuestionPreview
                    question={currentQuestion}
                    value={answers[currentQuestion.id]}
                    onChange={handleAnswer}
                    readonly={false}
                  />
                </div>

                {/* Navigation */}
                <div className="px-6 pb-6 flex items-center justify-between">
                  <button
                    onClick={handlePrevious}
                    disabled={currentQuestionIndex === 0}
                    className="flex items-center gap-1 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Back
                  </button>

                  {!currentQuestion.required && survey.settings?.allow_skip && (
                    <button
                      onClick={handleNext}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      Skip
                    </button>
                  )}

                  <button
                    onClick={handleNext}
                    disabled={!canProceed()}
                    className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {currentQuestionIndex === questions.length - 1 ? 'Submit' : 'Next'}
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 shrink-0">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              This is a preview. Responses will not be saved.
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
            >
              Close Preview
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SurveyPreview;
