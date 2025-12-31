import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const PluginReviews = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [plugin, setPlugin] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userReview, setUserReview] = useState(null);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '' });
  const [submitting, setSubmitting] = useState(false);
  const [sortBy, setSortBy] = useState('recent');
  const [filterRating, setFilterRating] = useState('all');

  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchPlugin(),
        fetchReviews()
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlugin = async () => {
    const response = await fetch(`${API_URL}/api/plugins/${id}`);
    if (response.ok) {
      const data = await response.json();
      setPlugin(data);
    }
  };

  const fetchReviews = async () => {
    const response = await fetch(`${API_URL}/api/plugins/${id}/reviews`);
    if (response.ok) {
      const data = await response.json();
      setReviews(data);

      // Check if current user has reviewed
      if (token) {
        // This would need user ID from context in real implementation
        const userReviewData = data.find(r => r.is_current_user);
        if (userReviewData) {
          setUserReview(userReviewData);
          setReviewForm({ rating: userReviewData.rating, comment: userReviewData.comment || '' });
        }
      }
    }
  };

  const handleSubmitReview = async () => {
    if (!token) {
      navigate('/login');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/api/plugins/${id}/reviews`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(reviewForm)
      });

      if (response.ok) {
        const data = await response.json();
        if (userReview) {
          setReviews(prev => prev.map(r => r.id === userReview.id ? data : r));
        } else {
          setReviews(prev => [data, ...prev]);
        }
        setUserReview(data);
        setShowReviewForm(false);
        fetchPlugin(); // Refresh rating
      }
    } catch (error) {
      console.error('Error submitting review:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteReview = async () => {
    if (!userReview || !token) return;

    try {
      const response = await fetch(`${API_URL}/api/plugins/${id}/reviews`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        setReviews(prev => prev.filter(r => r.id !== userReview.id));
        setUserReview(null);
        setReviewForm({ rating: 5, comment: '' });
        fetchPlugin(); // Refresh rating
      }
    } catch (error) {
      console.error('Error deleting review:', error);
    }
  };

  const renderStars = (rating, interactive = false, onChange = null) => {
    return [1, 2, 3, 4, 5].map(star => (
      <span
        key={star}
        className={`star ${star <= rating ? 'filled' : ''} ${interactive ? 'interactive' : ''}`}
        onClick={() => interactive && onChange && onChange(star)}
      >
        &#9733;
      </span>
    ));
  };

  const getRatingDistribution = () => {
    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviews.forEach(r => {
      if (r.rating >= 1 && r.rating <= 5) {
        distribution[Math.round(r.rating)]++;
      }
    });
    return distribution;
  };

  const filteredAndSortedReviews = () => {
    let result = [...reviews];

    // Filter by rating
    if (filterRating !== 'all') {
      result = result.filter(r => Math.round(r.rating) === parseInt(filterRating));
    }

    // Sort
    switch (sortBy) {
      case 'recent':
        result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        break;
      case 'highest':
        result.sort((a, b) => b.rating - a.rating);
        break;
      case 'lowest':
        result.sort((a, b) => a.rating - b.rating);
        break;
      case 'helpful':
        result.sort((a, b) => (b.helpful_count || 0) - (a.helpful_count || 0));
        break;
    }

    return result;
  };

  const distribution = getRatingDistribution();
  const totalReviews = reviews.length;

  if (loading) {
    return (
      <div className="reviews-loading">
        <div className="spinner"></div>
        <p>Loading reviews...</p>
      </div>
    );
  }

  return (
    <div className="plugin-reviews-page">
      <div className="reviews-header">
        <button className="back-btn" onClick={() => navigate(`/plugins/${id}`)}>
          &#8592; Back to Plugin
        </button>
        <h1>Reviews for {plugin?.name}</h1>
      </div>

      <div className="reviews-content">
        {/* Summary Section */}
        <div className="reviews-summary">
          <div className="overall-rating">
            <span className="rating-number">{(plugin?.rating || 0).toFixed(1)}</span>
            <div className="rating-stars">
              {renderStars(plugin?.rating || 0)}
            </div>
            <span className="review-count">{totalReviews} reviews</span>
          </div>

          <div className="rating-distribution">
            {[5, 4, 3, 2, 1].map(star => (
              <div key={star} className="distribution-row" onClick={() => setFilterRating(star.toString())}>
                <span className="star-label">{star} star</span>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${totalReviews ? (distribution[star] / totalReviews) * 100 : 0}%` }}
                  />
                </div>
                <span className="count">{distribution[star]}</span>
              </div>
            ))}
          </div>

          <button
            className="btn-write-review"
            onClick={() => setShowReviewForm(true)}
          >
            {userReview ? 'Edit Your Review' : 'Write a Review'}
          </button>
        </div>

        {/* Review Form */}
        {showReviewForm && (
          <div className="review-form-section">
            <h3>{userReview ? 'Update Your Review' : 'Write a Review'}</h3>

            <div className="rating-input">
              <label>Your Rating</label>
              <div className="stars-input">
                {renderStars(reviewForm.rating, true, (rating) =>
                  setReviewForm(prev => ({ ...prev, rating }))
                )}
              </div>
            </div>

            <div className="comment-input">
              <label>Your Review (optional)</label>
              <textarea
                value={reviewForm.comment}
                onChange={(e) => setReviewForm(prev => ({ ...prev, comment: e.target.value }))}
                placeholder="Share your experience with this plugin..."
                rows={4}
              />
            </div>

            <div className="form-actions">
              <button className="btn-cancel" onClick={() => setShowReviewForm(false)}>
                Cancel
              </button>
              {userReview && (
                <button className="btn-delete" onClick={handleDeleteReview}>
                  Delete Review
                </button>
              )}
              <button
                className="btn-submit"
                onClick={handleSubmitReview}
                disabled={submitting}
              >
                {submitting ? 'Submitting...' : userReview ? 'Update Review' : 'Submit Review'}
              </button>
            </div>
          </div>
        )}

        {/* Filter & Sort */}
        <div className="reviews-controls">
          <div className="filter-group">
            <label>Filter by rating:</label>
            <select value={filterRating} onChange={(e) => setFilterRating(e.target.value)}>
              <option value="all">All ratings</option>
              <option value="5">5 stars</option>
              <option value="4">4 stars</option>
              <option value="3">3 stars</option>
              <option value="2">2 stars</option>
              <option value="1">1 star</option>
            </select>
          </div>

          <div className="sort-group">
            <label>Sort by:</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="recent">Most Recent</option>
              <option value="highest">Highest Rated</option>
              <option value="lowest">Lowest Rated</option>
              <option value="helpful">Most Helpful</option>
            </select>
          </div>
        </div>

        {/* Reviews List */}
        <div className="reviews-list">
          {filteredAndSortedReviews().length === 0 ? (
            <div className="no-reviews">
              <span>&#128221;</span>
              <p>No reviews yet. Be the first to review!</p>
            </div>
          ) : (
            filteredAndSortedReviews().map(review => (
              <div key={review.id} className={`review-card ${review.is_current_user ? 'own-review' : ''}`}>
                <div className="review-header">
                  <div className="reviewer-info">
                    <span className="reviewer-name">{review.username || 'Anonymous'}</span>
                    <span className="review-date">
                      {new Date(review.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="review-rating">
                    {renderStars(review.rating)}
                  </div>
                </div>

                {review.comment && (
                  <p className="review-comment">{review.comment}</p>
                )}

                {review.is_current_user && (
                  <div className="review-badge">Your Review</div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <style>{`
        .plugin-reviews-page {
          padding: 24px;
          min-height: 100vh;
          background: #f5f6fa;
        }

        .reviews-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 60vh;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid #e5e7eb;
          border-top-color: #667eea;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .reviews-header {
          margin-bottom: 24px;
        }

        .back-btn {
          padding: 8px 16px;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          font-size: 14px;
          cursor: pointer;
          margin-bottom: 16px;
        }

        .back-btn:hover {
          background: #f3f4f6;
        }

        .reviews-header h1 {
          margin: 0;
          font-size: 24px;
          color: #1a1a2e;
        }

        .reviews-content {
          max-width: 800px;
          margin: 0 auto;
        }

        .reviews-summary {
          background: white;
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 24px;
          display: grid;
          grid-template-columns: auto 1fr auto;
          gap: 24px;
          align-items: center;
        }

        .overall-rating {
          text-align: center;
        }

        .rating-number {
          display: block;
          font-size: 48px;
          font-weight: 700;
          color: #1a1a2e;
        }

        .rating-stars {
          margin: 8px 0;
        }

        .star {
          color: #d1d5db;
          font-size: 20px;
        }

        .star.filled {
          color: #f59e0b;
        }

        .star.interactive {
          cursor: pointer;
          transition: transform 0.1s;
        }

        .star.interactive:hover {
          transform: scale(1.2);
        }

        .review-count {
          font-size: 14px;
          color: #6b7280;
        }

        .rating-distribution {
          flex: 1;
        }

        .distribution-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
          cursor: pointer;
        }

        .distribution-row:hover {
          opacity: 0.8;
        }

        .star-label {
          width: 50px;
          font-size: 13px;
          color: #6b7280;
        }

        .progress-bar {
          flex: 1;
          height: 8px;
          background: #e5e7eb;
          border-radius: 4px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: #f59e0b;
          border-radius: 4px;
        }

        .distribution-row .count {
          width: 24px;
          text-align: right;
          font-size: 13px;
          color: #6b7280;
        }

        .btn-write-review {
          padding: 12px 24px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
        }

        .review-form-section {
          background: white;
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 24px;
        }

        .review-form-section h3 {
          margin: 0 0 20px 0;
          color: #1a1a2e;
        }

        .rating-input,
        .comment-input {
          margin-bottom: 20px;
        }

        .rating-input label,
        .comment-input label {
          display: block;
          font-weight: 600;
          color: #1a1a2e;
          margin-bottom: 8px;
        }

        .stars-input .star {
          font-size: 32px;
        }

        .comment-input textarea {
          width: 100%;
          padding: 12px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          font-size: 14px;
          resize: vertical;
        }

        .comment-input textarea:focus {
          outline: none;
          border-color: #667eea;
        }

        .form-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
        }

        .btn-cancel,
        .btn-delete,
        .btn-submit {
          padding: 10px 20px;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
        }

        .btn-cancel {
          background: #f3f4f6;
          color: #4b5563;
        }

        .btn-delete {
          background: #fee2e2;
          color: #dc2626;
        }

        .btn-submit {
          background: #667eea;
          color: white;
        }

        .btn-submit:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .reviews-controls {
          background: white;
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 24px;
          display: flex;
          gap: 20px;
        }

        .filter-group,
        .sort-group {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .filter-group label,
        .sort-group label {
          font-size: 14px;
          color: #6b7280;
        }

        .filter-group select,
        .sort-group select {
          padding: 8px 12px;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          font-size: 14px;
        }

        .reviews-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .no-reviews {
          text-align: center;
          padding: 60px 20px;
          background: white;
          border-radius: 12px;
          color: #6b7280;
        }

        .no-reviews span {
          font-size: 48px;
          display: block;
          margin-bottom: 12px;
        }

        .review-card {
          background: white;
          border-radius: 12px;
          padding: 20px;
          position: relative;
        }

        .review-card.own-review {
          border: 2px solid #667eea;
        }

        .review-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 12px;
        }

        .reviewer-name {
          display: block;
          font-weight: 600;
          color: #1a1a2e;
        }

        .review-date {
          font-size: 12px;
          color: #9ca3af;
        }

        .review-rating .star {
          font-size: 16px;
        }

        .review-comment {
          margin: 0;
          color: #4b5563;
          line-height: 1.6;
        }

        .review-badge {
          position: absolute;
          top: 12px;
          right: 12px;
          background: #667eea;
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
        }

        @media (max-width: 768px) {
          .reviews-summary {
            grid-template-columns: 1fr;
            text-align: center;
          }

          .reviews-controls {
            flex-direction: column;
          }

          .form-actions {
            flex-direction: column;
          }

          .form-actions button {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

export default PluginReviews;
