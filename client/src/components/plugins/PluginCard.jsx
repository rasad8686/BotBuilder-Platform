import React from 'react';

const PluginCard = ({ plugin, isInstalled, onInstall, onUninstall, onViewDetails }) => {
  const renderStars = (rating) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalf = rating % 1 >= 0.5;

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(<span key={i} className="star full">★</span>);
      } else if (i === fullStars && hasHalf) {
        stars.push(<span key={i} className="star half">★</span>);
      } else {
        stars.push(<span key={i} className="star empty">☆</span>);
      }
    }
    return stars;
  };

  const formatDownloads = (count) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count;
  };

  return (
    <article
      className="plugin-card"
      onClick={() => onViewDetails(plugin)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onViewDetails(plugin)}
      aria-label={`${plugin.name} plugin - ${plugin.is_free ? 'Free' : `$${plugin.price}`} - Rating: ${plugin.rating || 0} out of 5`}
    >
      <div className="plugin-icon" aria-hidden="true">
        {plugin.icon_url ? (
          <img src={plugin.icon_url} alt="" />
        ) : (
          <span className="default-icon">🧩</span>
        )}
      </div>

      <div className="plugin-content">
        <h3 className="plugin-name">{plugin.name}</h3>
        <p className="plugin-description">
          {plugin.description?.substring(0, 80) || 'No description'}
          {plugin.description?.length > 80 ? '...' : ''}
        </p>

        <div className="plugin-meta">
          <div className="plugin-rating" aria-label={`Rating: ${plugin.rating || 0} out of 5 stars, ${plugin.review_count || 0} reviews`}>
            <span aria-hidden="true">{renderStars(plugin.rating || 0)}</span>
            <span className="rating-count" aria-hidden="true">({plugin.review_count || 0})</span>
          </div>
          <div className="plugin-downloads" aria-label={`${formatDownloads(plugin.downloads || 0)} downloads`}>
            <span className="download-icon" aria-hidden="true">↓</span>
            <span aria-hidden="true">{formatDownloads(plugin.downloads || 0)}</span>
          </div>
        </div>

        <div className="plugin-footer">
          <span className={`plugin-price ${plugin.is_free ? 'free' : 'paid'}`}>
            {plugin.is_free ? 'Free' : `$${plugin.price}`}
          </span>
          <span className="plugin-category">{plugin.category_name || 'General'}</span>
        </div>
      </div>

      <div className="plugin-actions" onClick={(e) => e.stopPropagation()}>
        {isInstalled ? (
          <button
            className="btn-uninstall"
            onClick={() => onUninstall(plugin)}
            aria-label={`Uninstall ${plugin.name}`}
          >
            Uninstall
          </button>
        ) : (
          <button
            className="btn-install"
            onClick={() => onInstall(plugin)}
            aria-label={`Install ${plugin.name}`}
          >
            Install
          </button>
        )}
      </div>

      <style>{`
        .plugin-card {
          background: white;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          flex-direction: column;
          position: relative;
        }

        .plugin-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.12);
        }

        .plugin-icon {
          width: 64px;
          height: 64px;
          border-radius: 12px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 16px;
          overflow: hidden;
        }

        .plugin-icon img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .default-icon {
          font-size: 32px;
        }

        .plugin-content {
          flex: 1;
        }

        .plugin-name {
          margin: 0 0 8px 0;
          font-size: 16px;
          font-weight: 600;
          color: #1a1a2e;
        }

        .plugin-description {
          margin: 0 0 12px 0;
          font-size: 13px;
          color: #6b7280;
          line-height: 1.4;
          min-height: 36px;
        }

        .plugin-meta {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 12px;
        }

        .plugin-rating {
          display: flex;
          align-items: center;
          gap: 2px;
        }

        .star {
          font-size: 14px;
        }

        .star.full {
          color: #f59e0b;
        }

        .star.half {
          color: #f59e0b;
          opacity: 0.7;
        }

        .star.empty {
          color: #d1d5db;
        }

        .rating-count {
          font-size: 12px;
          color: #9ca3af;
          margin-left: 4px;
        }

        .plugin-downloads {
          font-size: 12px;
          color: #6b7280;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .download-icon {
          font-size: 14px;
        }

        .plugin-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 12px;
          border-top: 1px solid #f3f4f6;
        }

        .plugin-price {
          font-size: 14px;
          font-weight: 600;
        }

        .plugin-price.free {
          color: #10b981;
        }

        .plugin-price.paid {
          color: #667eea;
        }

        .plugin-category {
          font-size: 11px;
          color: #9ca3af;
          background: #f3f4f6;
          padding: 4px 8px;
          border-radius: 4px;
        }

        .plugin-actions {
          margin-top: 16px;
        }

        .btn-install, .btn-uninstall {
          width: 100%;
          padding: 10px;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-install {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .btn-install:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }

        .btn-uninstall {
          background: #fee2e2;
          color: #dc2626;
        }

        .btn-uninstall:hover {
          background: #fecaca;
        }
      `}</style>
    </article>
  );
};

export default PluginCard;
