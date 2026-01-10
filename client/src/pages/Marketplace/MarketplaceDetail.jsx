/**
 * Marketplace Detail Page
 * View item details, reviews, and purchase/install
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Puzzle, ClipboardList, Link2, Palette, Package, Download } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const MarketplaceDetail = () => {
  const { t } = useTranslation();
  const { slug } = useParams();
  const navigate = useNavigate();

  const [item, setItem] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewForm, setReviewForm] = useState({ rating: 5, title: '', content: '' });
  const [purchasing, setPurchasing] = useState(false);
  const [installing, setInstalling] = useState(false);

  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchItem();
    fetchReviews();
  }, [slug]);

  const fetchItem = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/marketplace/${slug}`);
      const data = await response.json();

      if (data.success) {
        setItem(data.item);
      } else {
        setError(data.error || 'Item not found');
      }
    } catch (err) {
      setError('Failed to load item');
    } finally {
      setLoading(false);
    }
  };

  const fetchReviews = async () => {
    try {
      const response = await fetch(`${API_URL}/api/marketplace/${slug}/reviews`);
      const data = await response.json();
      if (data.success) {
        setReviews(data.reviews || []);
      }
    } catch (err) {
      console.error('Error fetching reviews:', err);
    }
  };

  const handlePurchase = async () => {
    if (!token) {
      navigate('/login');
      return;
    }

    try {
      setPurchasing(true);
      const response = await fetch(`${API_URL}/api/marketplace/${slug}/purchase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (data.success) {
        alert(t('marketplace.purchaseSuccess', 'Purchase successful!'));
        fetchItem();
      } else {
        alert(data.error || 'Purchase failed');
      }
    } catch (err) {
      alert('Failed to complete purchase');
    } finally {
      setPurchasing(false);
    }
  };

  const handleInstall = async () => {
    if (!token) {
      navigate('/login');
      return;
    }

    try {
      setInstalling(true);
      const response = await fetch(`${API_URL}/api/marketplace/${slug}/install`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (data.success) {
        alert(t('marketplace.installSuccess', 'Installation successful!'));
      } else {
        alert(data.error || 'Installation failed');
      }
    } catch (err) {
      alert('Failed to install');
    } finally {
      setInstalling(false);
    }
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!token) {
      navigate('/login');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/marketplace/${slug}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(reviewForm)
      });

      const data = await response.json();
      if (data.success) {
        setShowReviewModal(false);
        setReviewForm({ rating: 5, title: '', content: '' });
        fetchReviews();
        fetchItem();
      } else {
        alert(data.error || 'Failed to submit review');
      }
    } catch (err) {
      alert('Failed to submit review');
    }
  };

  const getTypeIcon = (itemType) => {
    const icons = { plugin: Puzzle, template: ClipboardList, integration: Link2, theme: Palette };
    const Icon = icons[itemType] || Package;
    return <Icon size={18} />;
  };

  const formatPrice = (item) => {
    if (item.price_type === 'free' || item.price === 0) {
      return t('marketplace.free', 'Free');
    }
    return `$${item.price.toFixed(2)}`;
  };

  const renderStars = (rating, interactive = false, onSelect = null) => {
    return [1, 2, 3, 4, 5].map(star => (
      <span
        key={star}
        style={{
          ...styles.star,
          color: star <= rating ? '#fbbf24' : '#e5e7eb',
          cursor: interactive ? 'pointer' : 'default'
        }}
        onClick={() => interactive && onSelect && onSelect(star)}
      >
        ★
      </span>
    ));
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>
          <div style={styles.spinner} />
          <p>{t('common.loading', 'Loading...')}</p>
        </div>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>
          <h2>{t('marketplace.notFound', 'Item Not Found')}</h2>
          <p>{error}</p>
          <button style={styles.backButton} onClick={() => navigate('/marketplace')}>
            {t('marketplace.backToMarketplace', 'Back to Marketplace')}
          </button>
        </div>
      </div>
    );
  }

  const screenshots = typeof item.screenshots === 'string'
    ? JSON.parse(item.screenshots)
    : (item.screenshots || []);

  return (
    <div style={styles.container}>
      {/* Breadcrumb */}
      <nav style={styles.breadcrumb}>
        <span style={styles.breadcrumbLink} onClick={() => navigate('/marketplace')}>
          {t('marketplace.title', 'Marketplace')}
        </span>
        <span style={styles.breadcrumbSeparator}>/</span>
        <span>{item.name}</span>
      </nav>

      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.itemIcon}>
            {item.icon_url ? (
              <img src={item.icon_url} alt={item.name} style={styles.iconImage} />
            ) : (
              <span style={styles.iconEmoji}>{getTypeIcon(item.type)}</span>
            )}
          </div>
          <div style={styles.headerInfo}>
            <div style={styles.headerMeta}>
              <span style={styles.itemType}>{item.type}</span>
              <span style={styles.version}>v{item.version}</span>
            </div>
            <h1 style={styles.itemName}>{item.name}</h1>
            <p style={styles.sellerName}>
              {t('marketplace.by', 'by')} {item.seller_name || 'Unknown'}
            </p>
            <div style={styles.stats}>
              <span style={styles.stat}>
                {renderStars(item.rating)}
                <span style={styles.ratingText}>
                  {item.rating.toFixed(1)} ({item.reviews_count} {t('marketplace.reviews', 'reviews')})
                </span>
              </span>
              <span style={styles.stat}><Download size={14} style={{ display: 'inline', marginRight: '4px' }} />{item.downloads.toLocaleString()} {t('marketplace.downloads', 'downloads')}</span>
            </div>
          </div>
        </div>

        <div style={styles.headerRight}>
          <div style={styles.priceBox}>
            <span style={styles.priceLabel}>{t('marketplace.price', 'Price')}</span>
            <span style={styles.priceValue}>{formatPrice(item)}</span>
          </div>
          {item.price_type === 'free' || item.price === 0 ? (
            <button
              style={styles.installButton}
              onClick={handleInstall}
              disabled={installing}
            >
              {installing ? t('common.installing', 'Installing...') : t('marketplace.install', 'Install')}
            </button>
          ) : (
            <button
              style={styles.purchaseButton}
              onClick={handlePurchase}
              disabled={purchasing}
            >
              {purchasing ? t('common.processing', 'Processing...') : t('marketplace.purchase', 'Purchase')}
            </button>
          )}
          {item.demo_url && (
            <a href={item.demo_url} target="_blank" rel="noopener noreferrer" style={styles.demoLink}>
              {t('marketplace.viewDemo', 'View Demo')}
            </a>
          )}
        </div>
      </header>

      {/* Tabs */}
      <nav style={styles.tabs}>
        {['overview', 'reviews', 'changelog'].map(tab => (
          <button
            key={tab}
            style={{ ...styles.tab, ...(activeTab === tab ? styles.tabActive : {}) }}
            onClick={() => setActiveTab(tab)}
          >
            {t(`marketplace.${tab}`, tab.charAt(0).toUpperCase() + tab.slice(1))}
          </button>
        ))}
      </nav>

      {/* Content */}
      <div style={styles.content}>
        {activeTab === 'overview' && (
          <div style={styles.overviewContent}>
            <div style={styles.mainContent}>
              {/* Description */}
              <section style={styles.section}>
                <h2 style={styles.sectionTitle}>{t('marketplace.description', 'Description')}</h2>
                <p style={styles.description}>{item.description}</p>
                {item.long_description && (
                  <div style={styles.longDescription}>
                    {item.long_description}
                  </div>
                )}
              </section>

              {/* Screenshots */}
              {screenshots.length > 0 && (
                <section style={styles.section}>
                  <h2 style={styles.sectionTitle}>{t('marketplace.screenshots', 'Screenshots')}</h2>
                  <div style={styles.screenshotsGrid}>
                    {screenshots.map((url, idx) => (
                      <img key={idx} src={url} alt={`Screenshot ${idx + 1}`} style={styles.screenshot} />
                    ))}
                  </div>
                </section>
              )}
            </div>

            <aside style={styles.sidebar}>
              {/* Details */}
              <div style={styles.sidebarCard}>
                <h3 style={styles.sidebarTitle}>{t('marketplace.details', 'Details')}</h3>
                <div style={styles.detailsList}>
                  <div style={styles.detailItem}>
                    <span style={styles.detailLabel}>{t('marketplace.type', 'Type')}</span>
                    <span style={styles.detailValue}>{item.type}</span>
                  </div>
                  <div style={styles.detailItem}>
                    <span style={styles.detailLabel}>{t('marketplace.version', 'Version')}</span>
                    <span style={styles.detailValue}>{item.version}</span>
                  </div>
                  {item.min_platform_version && (
                    <div style={styles.detailItem}>
                      <span style={styles.detailLabel}>{t('marketplace.minVersion', 'Min Platform')}</span>
                      <span style={styles.detailValue}>{item.min_platform_version}</span>
                    </div>
                  )}
                  <div style={styles.detailItem}>
                    <span style={styles.detailLabel}>{t('marketplace.published', 'Published')}</span>
                    <span style={styles.detailValue}>
                      {item.published_at ? new Date(item.published_at).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Tags */}
              {item.tags && (
                <div style={styles.sidebarCard}>
                  <h3 style={styles.sidebarTitle}>{t('marketplace.tags', 'Tags')}</h3>
                  <div style={styles.tags}>
                    {(typeof item.tags === 'string' ? JSON.parse(item.tags) : item.tags).map((tag, idx) => (
                      <span key={idx} style={styles.tag}>{tag}</span>
                    ))}
                  </div>
                </div>
              )}
            </aside>
          </div>
        )}

        {activeTab === 'reviews' && (
          <div style={styles.reviewsContent}>
            <div style={styles.reviewsHeader}>
              <h2 style={styles.sectionTitle}>
                {t('marketplace.reviews', 'Reviews')} ({reviews.length})
              </h2>
              <button style={styles.writeReviewButton} onClick={() => setShowReviewModal(true)}>
                {t('marketplace.writeReview', 'Write a Review')}
              </button>
            </div>

            {reviews.length === 0 ? (
              <div style={styles.noReviews}>
                <p>{t('marketplace.noReviews', 'No reviews yet. Be the first to review!')}</p>
              </div>
            ) : (
              <div style={styles.reviewsList}>
                {reviews.map(review => (
                  <div key={review.id} style={styles.reviewCard}>
                    <div style={styles.reviewHeader}>
                      <span style={styles.reviewUser}>{review.user_name}</span>
                      <span style={styles.reviewDate}>
                        {new Date(review.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div style={styles.reviewRating}>
                      {renderStars(review.rating)}
                    </div>
                    {review.title && <h4 style={styles.reviewTitle}>{review.title}</h4>}
                    <p style={styles.reviewContent}>{review.content}</p>
                    <div style={styles.reviewFooter}>
                      <button style={styles.helpfulButton}>
                        👍 {t('marketplace.helpful', 'Helpful')} ({review.helpful_count})
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'changelog' && (
          <div style={styles.changelogContent}>
            <h2 style={styles.sectionTitle}>{t('marketplace.changelog', 'Changelog')}</h2>
            <div style={styles.changelogEntry}>
              <h3 style={styles.changelogVersion}>v{item.version}</h3>
              <p style={styles.changelogDate}>
                {item.published_at ? new Date(item.published_at).toLocaleDateString() : 'N/A'}
              </p>
              <p>{t('marketplace.currentVersion', 'Current version')}</p>
            </div>
          </div>
        )}
      </div>

      {/* Review Modal */}
      {showReviewModal && (
        <div style={styles.modalOverlay} onClick={() => setShowReviewModal(false)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>{t('marketplace.writeReview', 'Write a Review')}</h2>
              <button style={styles.closeButton} onClick={() => setShowReviewModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmitReview} style={styles.reviewForm}>
              <div style={styles.formGroup}>
                <label style={styles.label}>{t('marketplace.rating', 'Rating')}</label>
                <div style={styles.ratingInput}>
                  {renderStars(reviewForm.rating, true, (star) => setReviewForm({ ...reviewForm, rating: star }))}
                </div>
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>{t('marketplace.reviewTitle', 'Title')}</label>
                <input
                  type="text"
                  value={reviewForm.title}
                  onChange={(e) => setReviewForm({ ...reviewForm, title: e.target.value })}
                  style={styles.input}
                  placeholder={t('marketplace.reviewTitlePlaceholder', 'Summarize your review')}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>{t('marketplace.reviewContent', 'Review')}</label>
                <textarea
                  value={reviewForm.content}
                  onChange={(e) => setReviewForm({ ...reviewForm, content: e.target.value })}
                  style={styles.textarea}
                  rows={4}
                  placeholder={t('marketplace.reviewContentPlaceholder', 'Share your experience...')}
                />
              </div>
              <button type="submit" style={styles.submitButton}>
                {t('marketplace.submitReview', 'Submit Review')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    padding: '24px',
    maxWidth: '1200px',
    margin: '0 auto',
    minHeight: '100vh',
    backgroundColor: '#f9fafb'
  },
  loading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '100px 20px'
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid #e5e7eb',
    borderTopColor: '#3b82f6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },
  error: {
    textAlign: 'center',
    padding: '100px 20px'
  },
  backButton: {
    marginTop: '20px',
    padding: '12px 24px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer'
  },
  breadcrumb: {
    marginBottom: '24px',
    fontSize: '14px',
    color: '#6b7280'
  },
  breadcrumbLink: {
    color: '#3b82f6',
    cursor: 'pointer'
  },
  breadcrumbSeparator: {
    margin: '0 8px'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '24px',
    padding: '24px',
    backgroundColor: 'white',
    borderRadius: '12px',
    marginBottom: '24px',
    flexWrap: 'wrap'
  },
  headerLeft: {
    display: 'flex',
    gap: '20px',
    flex: 1
  },
  itemIcon: {
    width: '80px',
    height: '80px',
    borderRadius: '16px',
    backgroundColor: '#f3f4f6',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  iconImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    borderRadius: '16px'
  },
  iconEmoji: {
    fontSize: '40px'
  },
  headerInfo: {
    flex: 1
  },
  headerMeta: {
    display: 'flex',
    gap: '8px',
    marginBottom: '8px'
  },
  itemType: {
    padding: '4px 8px',
    backgroundColor: '#eff6ff',
    color: '#3b82f6',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '500',
    textTransform: 'capitalize'
  },
  version: {
    padding: '4px 8px',
    backgroundColor: '#f3f4f6',
    color: '#6b7280',
    borderRadius: '4px',
    fontSize: '12px'
  },
  itemName: {
    margin: '0 0 4px 0',
    fontSize: '24px',
    fontWeight: '700',
    color: '#1a1a2e'
  },
  sellerName: {
    margin: '0 0 12px 0',
    fontSize: '14px',
    color: '#6b7280'
  },
  stats: {
    display: 'flex',
    gap: '20px',
    flexWrap: 'wrap'
  },
  stat: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '14px',
    color: '#6b7280'
  },
  star: {
    fontSize: '18px'
  },
  ratingText: {
    marginLeft: '4px'
  },
  headerRight: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '12px'
  },
  priceBox: {
    textAlign: 'right'
  },
  priceLabel: {
    display: 'block',
    fontSize: '12px',
    color: '#6b7280'
  },
  priceValue: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#10b981'
  },
  installButton: {
    padding: '12px 32px',
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer'
  },
  purchaseButton: {
    padding: '12px 32px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer'
  },
  demoLink: {
    fontSize: '14px',
    color: '#3b82f6',
    textDecoration: 'none'
  },
  tabs: {
    display: 'flex',
    gap: '8px',
    marginBottom: '24px'
  },
  tab: {
    padding: '10px 20px',
    backgroundColor: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    fontSize: '14px',
    cursor: 'pointer'
  },
  tabActive: {
    backgroundColor: '#3b82f6',
    color: 'white',
    borderColor: '#3b82f6'
  },
  content: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '24px'
  },
  overviewContent: {
    display: 'grid',
    gridTemplateColumns: '1fr 300px',
    gap: '32px'
  },
  mainContent: {},
  section: {
    marginBottom: '32px'
  },
  sectionTitle: {
    margin: '0 0 16px 0',
    fontSize: '18px',
    fontWeight: '600',
    color: '#1a1a2e'
  },
  description: {
    fontSize: '16px',
    lineHeight: '1.6',
    color: '#374151'
  },
  longDescription: {
    marginTop: '16px',
    fontSize: '14px',
    lineHeight: '1.7',
    color: '#6b7280',
    whiteSpace: 'pre-wrap'
  },
  screenshotsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '12px'
  },
  screenshot: {
    width: '100%',
    borderRadius: '8px',
    border: '1px solid #e5e7eb'
  },
  sidebar: {},
  sidebarCard: {
    padding: '16px',
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
    marginBottom: '16px'
  },
  sidebarTitle: {
    margin: '0 0 12px 0',
    fontSize: '14px',
    fontWeight: '600',
    color: '#374151'
  },
  detailsList: {},
  detailItem: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0',
    borderBottom: '1px solid #e5e7eb'
  },
  detailLabel: {
    fontSize: '13px',
    color: '#6b7280'
  },
  detailValue: {
    fontSize: '13px',
    fontWeight: '500',
    color: '#374151'
  },
  tags: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px'
  },
  tag: {
    padding: '4px 10px',
    backgroundColor: '#e5e7eb',
    borderRadius: '4px',
    fontSize: '12px',
    color: '#374151'
  },
  reviewsContent: {},
  reviewsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px'
  },
  writeReviewButton: {
    padding: '10px 20px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    cursor: 'pointer'
  },
  noReviews: {
    textAlign: 'center',
    padding: '40px',
    color: '#6b7280'
  },
  reviewsList: {},
  reviewCard: {
    padding: '20px',
    borderBottom: '1px solid #e5e7eb'
  },
  reviewHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '8px'
  },
  reviewUser: {
    fontWeight: '600',
    color: '#1a1a2e'
  },
  reviewDate: {
    fontSize: '13px',
    color: '#6b7280'
  },
  reviewRating: {
    marginBottom: '8px'
  },
  reviewTitle: {
    margin: '0 0 8px 0',
    fontSize: '16px',
    fontWeight: '600',
    color: '#1a1a2e'
  },
  reviewContent: {
    fontSize: '14px',
    color: '#374151',
    lineHeight: '1.6'
  },
  reviewFooter: {
    marginTop: '12px'
  },
  helpfulButton: {
    padding: '6px 12px',
    backgroundColor: 'transparent',
    border: '1px solid #e5e7eb',
    borderRadius: '4px',
    fontSize: '13px',
    cursor: 'pointer'
  },
  changelogContent: {},
  changelogEntry: {
    padding: '16px',
    backgroundColor: '#f9fafb',
    borderRadius: '8px'
  },
  changelogVersion: {
    margin: '0 0 4px 0',
    fontSize: '16px',
    fontWeight: '600'
  },
  changelogDate: {
    margin: '0 0 8px 0',
    fontSize: '13px',
    color: '#6b7280'
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: '12px',
    width: '100%',
    maxWidth: '500px',
    maxHeight: '90vh',
    overflow: 'auto'
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px',
    borderBottom: '1px solid #e5e7eb'
  },
  modalTitle: {
    margin: 0,
    fontSize: '18px',
    fontWeight: '600'
  },
  closeButton: {
    width: '32px',
    height: '32px',
    backgroundColor: '#f3f4f6',
    border: 'none',
    borderRadius: '6px',
    fontSize: '20px',
    cursor: 'pointer'
  },
  reviewForm: {
    padding: '20px'
  },
  formGroup: {
    marginBottom: '16px'
  },
  label: {
    display: 'block',
    marginBottom: '8px',
    fontSize: '14px',
    fontWeight: '500',
    color: '#374151'
  },
  ratingInput: {
    fontSize: '24px'
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    fontSize: '14px',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    boxSizing: 'border-box'
  },
  textarea: {
    width: '100%',
    padding: '10px 12px',
    fontSize: '14px',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    resize: 'vertical',
    boxSizing: 'border-box'
  },
  submitButton: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer'
  }
};

export default MarketplaceDetail;
