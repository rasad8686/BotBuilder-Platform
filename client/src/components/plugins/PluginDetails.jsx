import React, { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const PluginDetails = ({ plugin, isInstalled, onInstall, onUninstall, onClose }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [reviews, setReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [newReview, setNewReview] = useState({ rating: 5, comment: '' });
  const [submitting, setSubmitting] = useState(false);

  const token = localStorage.getItem('token');

  useEffect(() => {
    if (activeTab === 'reviews') {
      fetchReviews();
    }
  }, [activeTab, plugin.id]);

  const fetchReviews = async () => {
    setLoadingReviews(true);
    try {
      const response = await fetch(`${API_URL}/api/plugins/${plugin.id}/reviews`);
      if (response.ok) {
        const data = await response.json();
        setReviews(data);
      }
    } catch (error) {
      // Silent fail
    } finally {
      setLoadingReviews(false);
    }
  };

  const submitReview = async () => {
    if (!token) {
      alert('Please log in to submit a review');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/api/plugins/${plugin.id}/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newReview)
      });

      if (response.ok) {
        setNewReview({ rating: 5, comment: '' });
        fetchReviews();
      }
    } catch (error) {
      // Silent fail
    } finally {
      setSubmitting(false);
    }
  };

  const renderStars = (rating, interactive = false) => {
    return (
      <div className="stars-container">
        {[1, 2, 3, 4, 5].map(star => (
          <span
            key={star}
            className={`star ${star <= rating ? 'filled' : ''} ${interactive ? 'interactive' : ''}`}
            onClick={interactive ? () => setNewReview({ ...newReview, rating: star }) : undefined}
          >
            ★
          </span>
        ))}
      </div>
    );
  };

  const permissions = plugin.permissions || [];
  const manifest = plugin.manifest || {};

  return (
    <div className="plugin-details-overlay" onClick={onClose}>
      <div className="plugin-details-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>×</button>

        <div className="plugin-header">
          <div className="plugin-icon">
            {plugin.icon_url ? (
              <img src={plugin.icon_url} alt={plugin.name} />
            ) : (
              <span className="default-icon">🧩</span>
            )}
          </div>
          <div className="plugin-info">
            <h2>{plugin.name}</h2>
            <p className="plugin-version">v{plugin.version}</p>
            <div className="plugin-meta">
              <span className="rating">
                {renderStars(plugin.rating || 0)}
                <span className="count">({plugin.review_count || 0} reviews)</span>
              </span>
              <span className="downloads">↓ {plugin.downloads || 0} downloads</span>
            </div>
          </div>
          <div className="plugin-action">
            <span className={`price ${plugin.is_free ? 'free' : ''}`}>
              {plugin.is_free ? 'Free' : `$${plugin.price}`}
            </span>
            {isInstalled ? (
              <button className="btn-uninstall" onClick={() => onUninstall(plugin)}>
                Uninstall
              </button>
            ) : (
              <button className="btn-install" onClick={() => onInstall(plugin)}>
                Install Now
              </button>
            )}
          </div>
        </div>

        {plugin.banner_url && (
          <div className="plugin-banner">
            <img src={plugin.banner_url} alt={plugin.name} />
          </div>
        )}

        <div className="plugin-tabs">
          <button
            className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button
            className={`tab ${activeTab === 'reviews' ? 'active' : ''}`}
            onClick={() => setActiveTab('reviews')}
          >
            Reviews ({plugin.review_count || 0})
          </button>
          <button
            className={`tab ${activeTab === 'permissions' ? 'active' : ''}`}
            onClick={() => setActiveTab('permissions')}
          >
            Permissions
          </button>
        </div>

        <div className="plugin-content">
          {activeTab === 'overview' && (
            <div className="tab-overview">
              <h3>Description</h3>
              <p>{plugin.description || 'No description available.'}</p>

              <h3>Details</h3>
              <div className="details-grid">
                <div className="detail-item">
                  <label>Category</label>
                  <span>{plugin.category_name || 'General'}</span>
                </div>
                <div className="detail-item">
                  <label>Version</label>
                  <span>{plugin.version}</span>
                </div>
                <div className="detail-item">
                  <label>Last Updated</label>
                  <span>{new Date(plugin.updated_at).toLocaleDateString()}</span>
                </div>
                <div className="detail-item">
                  <label>Downloads</label>
                  <span>{plugin.downloads || 0}</span>
                </div>
              </div>

              {manifest.features && (
                <>
                  <h3>Features</h3>
                  <ul className="features-list">
                    {manifest.features.map((feature, i) => (
                      <li key={i}>✓ {feature}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}

          {activeTab === 'reviews' && (
            <div className="tab-reviews">
              <div className="review-form">
                <h4>Write a Review</h4>
                <div className="rating-select">
                  {renderStars(newReview.rating, true)}
                </div>
                <textarea
                  placeholder="Share your experience with this plugin..."
                  value={newReview.comment}
                  onChange={(e) => setNewReview({ ...newReview, comment: e.target.value })}
                  rows={3}
                />
                <button
                  className="btn-submit"
                  onClick={submitReview}
                  disabled={submitting}
                >
                  {submitting ? 'Submitting...' : 'Submit Review'}
                </button>
              </div>

              <div className="reviews-list">
                {loadingReviews ? (
                  <p className="loading">Loading reviews...</p>
                ) : reviews.length === 0 ? (
                  <p className="no-reviews">No reviews yet. Be the first to review!</p>
                ) : (
                  reviews.map((review, i) => (
                    <div key={i} className="review-item">
                      <div className="review-header">
                        <span className="reviewer">{review.username || 'Anonymous'}</span>
                        {renderStars(review.rating)}
                        <span className="review-date">
                          {new Date(review.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      {review.comment && (
                        <p className="review-comment">{review.comment}</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'permissions' && (
            <div className="tab-permissions">
              <p className="permissions-intro">
                This plugin requires the following permissions to function:
              </p>
              {permissions.length === 0 ? (
                <p className="no-permissions">No special permissions required.</p>
              ) : (
                <ul className="permissions-list">
                  {permissions.map((perm, i) => (
                    <li key={i}>
                      <span className="perm-icon">🔐</span>
                      <span className="perm-name">{perm}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <style>{`
          .plugin-details-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.6);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            padding: 20px;
          }

          .plugin-details-modal {
            background: white;
            border-radius: 16px;
            width: 100%;
            max-width: 700px;
            max-height: 90vh;
            overflow-y: auto;
            position: relative;
          }

          .close-btn {
            position: absolute;
            top: 16px;
            right: 16px;
            background: none;
            border: none;
            font-size: 28px;
            color: #6b7280;
            cursor: pointer;
            z-index: 10;
          }

          .plugin-header {
            display: flex;
            gap: 20px;
            padding: 24px;
            border-bottom: 1px solid #e5e7eb;
          }

          .plugin-header .plugin-icon {
            width: 80px;
            height: 80px;
            border-radius: 16px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            overflow: hidden;
          }

          .plugin-header .plugin-icon img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }

          .plugin-header .default-icon {
            font-size: 40px;
          }

          .plugin-info {
            flex: 1;
          }

          .plugin-info h2 {
            margin: 0 0 4px 0;
            font-size: 22px;
            color: #1a1a2e;
          }

          .plugin-version {
            color: #6b7280;
            margin: 0 0 8px 0;
            font-size: 13px;
          }

          .plugin-meta {
            display: flex;
            gap: 16px;
            font-size: 13px;
            color: #6b7280;
          }

          .plugin-action {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 12px;
          }

          .price {
            font-size: 24px;
            font-weight: 700;
            color: #667eea;
          }

          .price.free {
            color: #10b981;
          }

          .btn-install, .btn-uninstall {
            padding: 12px 24px;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
          }

          .btn-install {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
          }

          .btn-uninstall {
            background: #fee2e2;
            color: #dc2626;
          }

          .plugin-banner {
            width: 100%;
            height: 200px;
            overflow: hidden;
          }

          .plugin-banner img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }

          .plugin-tabs {
            display: flex;
            border-bottom: 1px solid #e5e7eb;
            padding: 0 24px;
          }

          .tab {
            padding: 16px 20px;
            border: none;
            background: none;
            font-size: 14px;
            font-weight: 500;
            color: #6b7280;
            cursor: pointer;
            border-bottom: 2px solid transparent;
            margin-bottom: -1px;
          }

          .tab.active {
            color: #667eea;
            border-bottom-color: #667eea;
          }

          .plugin-content {
            padding: 24px;
          }

          .plugin-content h3 {
            margin: 0 0 12px 0;
            font-size: 16px;
            color: #1a1a2e;
          }

          .plugin-content h3:not(:first-child) {
            margin-top: 24px;
          }

          .details-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 16px;
          }

          .detail-item {
            background: #f9fafb;
            padding: 12px;
            border-radius: 8px;
          }

          .detail-item label {
            display: block;
            font-size: 11px;
            color: #9ca3af;
            text-transform: uppercase;
            margin-bottom: 4px;
          }

          .detail-item span {
            font-weight: 600;
            color: #1a1a2e;
          }

          .features-list {
            list-style: none;
            padding: 0;
            margin: 0;
          }

          .features-list li {
            padding: 8px 0;
            color: #374151;
          }

          .stars-container {
            display: flex;
            gap: 2px;
          }

          .star {
            color: #d1d5db;
            font-size: 18px;
          }

          .star.filled {
            color: #f59e0b;
          }

          .star.interactive {
            cursor: pointer;
          }

          .star.interactive:hover {
            transform: scale(1.2);
          }

          .review-form {
            background: #f9fafb;
            padding: 20px;
            border-radius: 12px;
            margin-bottom: 24px;
          }

          .review-form h4 {
            margin: 0 0 12px 0;
          }

          .rating-select {
            margin-bottom: 12px;
          }

          .review-form textarea {
            width: 100%;
            padding: 12px;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            resize: vertical;
            font-family: inherit;
          }

          .btn-submit {
            margin-top: 12px;
            padding: 10px 20px;
            background: #667eea;
            color: white;
            border: none;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
          }

          .review-item {
            padding: 16px 0;
            border-bottom: 1px solid #f3f4f6;
          }

          .review-header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 8px;
          }

          .reviewer {
            font-weight: 600;
            color: #1a1a2e;
          }

          .review-date {
            color: #9ca3af;
            font-size: 12px;
            margin-left: auto;
          }

          .review-comment {
            color: #4b5563;
            margin: 0;
            line-height: 1.5;
          }

          .permissions-list {
            list-style: none;
            padding: 0;
            margin: 0;
          }

          .permissions-list li {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px;
            background: #f9fafb;
            border-radius: 8px;
            margin-bottom: 8px;
          }

          .perm-icon {
            font-size: 20px;
          }

          .no-permissions, .no-reviews, .loading {
            color: #6b7280;
            text-align: center;
            padding: 20px;
          }
        `}</style>
      </div>
    </div>
  );
};

export default PluginDetails;
