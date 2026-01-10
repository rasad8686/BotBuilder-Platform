import { useState } from 'react';

export default function FeedbackWidget({ sectionId, categoryId }) {
  const [feedback, setFeedback] = useState(null); // 'helpful' | 'not-helpful' | null
  const [showForm, setShowForm] = useState(false);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFeedback = async (type) => {
    setFeedback(type);

    if (type === 'not-helpful') {
      setShowForm(true);
    } else {
      // Submit helpful feedback directly
      await submitFeedback(type, '');
    }
  };

  const submitFeedback = async (type, feedbackComment) => {
    setIsSubmitting(true);
    try {
      // Send feedback to API
      await fetch('/api/docs/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          sectionId,
          categoryId,
          type,
          comment: feedbackComment,
          url: window.location.href,
          timestamp: new Date().toISOString()
        })
      });

      setSubmitted(true);
      setShowForm(false);
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    await submitFeedback(feedback, comment);
  };

  if (submitted) {
    return (
      <div
        className="mt-8 p-4 rounded-lg border text-center"
        style={{
          backgroundColor: '#f0fdf4',
          borderColor: '#bbf7d0',
          color: '#166534'
        }}
      >
        <div className="flex items-center justify-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="font-medium">Thank you for your feedback!</span>
        </div>
        <p className="text-sm mt-1" style={{ color: '#15803d' }}>
          Your input helps us improve our documentation.
        </p>
      </div>
    );
  }

  return (
    <div
      className="mt-8 p-4 rounded-lg border"
      style={{ backgroundColor: '#f6f9fc', borderColor: '#e6ebf1' }}
    >
      <h4 className="text-sm font-semibold mb-3" style={{ color: '#32325d' }}>
        Was this page helpful?
      </h4>

      <div className="flex items-center gap-3">
        <button
          onClick={() => handleFeedback('helpful')}
          disabled={isSubmitting}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium
            transition-all duration-200
            ${feedback === 'helpful'
              ? 'border-green-500 bg-green-50 text-green-700'
              : 'border-gray-200 hover:border-green-300 hover:bg-green-50'
            }
          `}
          style={{
            borderColor: feedback === 'helpful' ? '#22c55e' : '#e6ebf1',
            backgroundColor: feedback === 'helpful' ? '#f0fdf4' : '#fff',
            color: feedback === 'helpful' ? '#15803d' : '#525f7f'
          }}
          aria-label="Yes, this page was helpful"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
          </svg>
          Yes
        </button>

        <button
          onClick={() => handleFeedback('not-helpful')}
          disabled={isSubmitting}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium
            transition-all duration-200
            ${feedback === 'not-helpful'
              ? 'border-red-500 bg-red-50 text-red-700'
              : 'border-gray-200 hover:border-red-300 hover:bg-red-50'
            }
          `}
          style={{
            borderColor: feedback === 'not-helpful' ? '#ef4444' : '#e6ebf1',
            backgroundColor: feedback === 'not-helpful' ? '#fef2f2' : '#fff',
            color: feedback === 'not-helpful' ? '#b91c1c' : '#525f7f'
          }}
          aria-label="No, this page was not helpful"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
          </svg>
          No
        </button>
      </div>

      {/* Feedback form for "not helpful" */}
      {showForm && (
        <form onSubmit={handleSubmitComment} className="mt-4">
          <label className="block text-sm font-medium mb-2" style={{ color: '#32325d' }}>
            How can we improve this page?
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Please share your suggestions..."
            rows={3}
            className="w-full px-3 py-2 rounded-lg border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
            style={{
              borderColor: '#e6ebf1',
              color: '#32325d',
              backgroundColor: '#fff'
            }}
          />
          <div className="flex justify-end gap-2 mt-3">
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setFeedback(null);
              }}
              className="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
              style={{ color: '#8898aa' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium rounded-lg text-white transition-colors"
              style={{
                backgroundColor: isSubmitting ? '#a5b4fc' : '#635bff'
              }}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
