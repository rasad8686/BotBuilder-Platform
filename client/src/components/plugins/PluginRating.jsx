import React, { useState } from 'react';

const PluginRating = ({
  rating = 0,
  reviewCount = 0,
  size = 'medium', // small, medium, large
  interactive = false,
  showCount = true,
  onChange,
  className = ''
}) => {
  const [hoverRating, setHoverRating] = useState(0);

  const handleClick = (star) => {
    if (interactive && onChange) {
      onChange(star);
    }
  };

  const handleMouseEnter = (star) => {
    if (interactive) {
      setHoverRating(star);
    }
  };

  const handleMouseLeave = () => {
    if (interactive) {
      setHoverRating(0);
    }
  };

  const displayRating = hoverRating || rating;

  const sizeClasses = {
    small: 'rating-small',
    medium: 'rating-medium',
    large: 'rating-large'
  };

  return (
    <div className={`plugin-rating ${sizeClasses[size]} ${interactive ? 'interactive' : ''} ${className}`}>
      <div className="stars-container" onMouseLeave={handleMouseLeave}>
        {[1, 2, 3, 4, 5].map((star) => {
          const isFilled = star <= displayRating;
          const isHalf = !isFilled && star - 0.5 <= displayRating;

          return (
            <span
              key={star}
              className={`star ${isFilled ? 'filled' : ''} ${isHalf ? 'half' : ''}`}
              onClick={() => handleClick(star)}
              onMouseEnter={() => handleMouseEnter(star)}
            >
              {isHalf ? (
                <span className="half-star">
                  <span className="half-filled">&#9733;</span>
                  <span className="half-empty">&#9733;</span>
                </span>
              ) : (
                '★'
              )}
            </span>
          );
        })}
      </div>

      {showCount && (
        <span className="rating-info">
          <span className="rating-value">{rating.toFixed(1)}</span>
          {reviewCount > 0 && (
            <span className="review-count">({reviewCount.toLocaleString()})</span>
          )}
        </span>
      )}

      <style>{`
        .plugin-rating {
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .stars-container {
          display: flex;
          gap: 2px;
        }

        .star {
          color: #d1d5db;
          transition: all 0.15s ease;
          user-select: none;
        }

        .star.filled {
          color: #f59e0b;
        }

        .plugin-rating.interactive .star {
          cursor: pointer;
        }

        .plugin-rating.interactive .star:hover {
          transform: scale(1.15);
        }

        .half-star {
          position: relative;
          display: inline-block;
        }

        .half-filled {
          position: absolute;
          left: 0;
          width: 50%;
          overflow: hidden;
          color: #f59e0b;
        }

        .half-empty {
          color: #d1d5db;
        }

        .rating-info {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .rating-value {
          font-weight: 600;
          color: #1a1a2e;
        }

        .review-count {
          color: #9ca3af;
        }

        /* Sizes */
        .rating-small .star {
          font-size: 14px;
        }

        .rating-small .rating-value,
        .rating-small .review-count {
          font-size: 12px;
        }

        .rating-medium .star {
          font-size: 18px;
        }

        .rating-medium .rating-value,
        .rating-medium .review-count {
          font-size: 14px;
        }

        .rating-large .star {
          font-size: 28px;
        }

        .rating-large .rating-value {
          font-size: 20px;
        }

        .rating-large .review-count {
          font-size: 16px;
        }
      `}</style>
    </div>
  );
};

export default PluginRating;
