/**
 * Marketplace Browse Page
 * Browse, search, and filter marketplace items
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Puzzle, ClipboardList, Link2, Palette, Package, Download } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const MarketplaceBrowse = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [featuredItems, setFeaturedItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [type, setType] = useState(searchParams.get('type') || '');
  const [category, setCategory] = useState(searchParams.get('category') || '');
  const [priceType, setPriceType] = useState(searchParams.get('priceType') || '');
  const [sortBy, setSortBy] = useState(searchParams.get('sortBy') || 'downloads');
  const [page, setPage] = useState(parseInt(searchParams.get('page')) || 1);

  const token = localStorage.getItem('token');

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      if (type) params.set('type', type);
      if (category) params.set('category', category);
      if (priceType) params.set('priceType', priceType);
      if (sortBy) params.set('sortBy', sortBy);
      params.set('page', page.toString());
      params.set('limit', '20');

      const response = await fetch(`${API_URL}/api/marketplace?${params}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });

      const data = await response.json();
      if (data.success) {
        setItems(data.items || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
      }
    } catch (error) {
      console.error('Error fetching items:', error);
    } finally {
      setLoading(false);
    }
  }, [query, type, category, priceType, sortBy, page, token]);

  const fetchCategories = async () => {
    try {
      const response = await fetch(`${API_URL}/api/marketplace/categories`);
      const data = await response.json();
      if (data.success) {
        setCategories(data.categories || []);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchFeatured = async () => {
    try {
      const response = await fetch(`${API_URL}/api/marketplace/featured?limit=6`);
      const data = await response.json();
      if (data.success) {
        setFeaturedItems(data.items || []);
      }
    } catch (error) {
      console.error('Error fetching featured:', error);
    }
  };

  useEffect(() => {
    fetchCategories();
    fetchFeatured();
  }, []);

  useEffect(() => {
    fetchItems();
    // Update URL params
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (type) params.set('type', type);
    if (category) params.set('category', category);
    if (priceType) params.set('priceType', priceType);
    if (sortBy !== 'downloads') params.set('sortBy', sortBy);
    if (page > 1) params.set('page', page.toString());
    setSearchParams(params);
  }, [query, type, category, priceType, sortBy, page, fetchItems, setSearchParams]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
  };

  const getTypeIcon = (itemType) => {
    const icons = {
      plugin: Puzzle,
      template: ClipboardList,
      integration: Link2,
      theme: Palette
    };
    const Icon = icons[itemType] || Package;
    return <Icon size={18} />;
  };

  const formatPrice = (item) => {
    if (item.price_type === 'free' || item.price === 0) {
      return t('marketplace.free', 'Free');
    }
    return `$${item.price.toFixed(2)}`;
  };

  const renderStars = (rating) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalf = rating % 1 >= 0.5;

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(<span key={i} style={styles.starFilled}>★</span>);
      } else if (i === fullStars && hasHalf) {
        stars.push(<span key={i} style={styles.starHalf}>★</span>);
      } else {
        stars.push(<span key={i} style={styles.starEmpty}>★</span>);
      }
    }
    return stars;
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <h1 style={styles.title}>{t('marketplace.title', 'Marketplace')}</h1>
          <p style={styles.subtitle}>
            {t('marketplace.subtitle', 'Discover plugins, templates, and integrations to enhance your bots')}
          </p>
        </div>
        <button
          style={styles.sellButton}
          onClick={() => navigate('/seller/dashboard')}
        >
          {t('marketplace.startSelling', 'Start Selling')}
        </button>
      </header>

      {/* Search Bar */}
      <form onSubmit={handleSearch} style={styles.searchSection}>
        <div style={styles.searchBar}>
          <input
            type="text"
            placeholder={t('marketplace.searchPlaceholder', 'Search plugins, templates, integrations...')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={styles.searchInput}
          />
          <button type="submit" style={styles.searchButton}>
            {t('common.search', 'Search')}
          </button>
        </div>
      </form>

      {/* Filters */}
      <div style={styles.filters}>
        <select
          value={type}
          onChange={(e) => { setType(e.target.value); setPage(1); }}
          style={styles.filterSelect}
        >
          <option value="">{t('marketplace.allTypes', 'All Types')}</option>
          <option value="plugin">{t('marketplace.plugins', 'Plugins')}</option>
          <option value="template">{t('marketplace.templates', 'Templates')}</option>
          <option value="integration">{t('marketplace.integrations', 'Integrations')}</option>
          <option value="theme">{t('marketplace.themes', 'Themes')}</option>
        </select>

        <select
          value={category}
          onChange={(e) => { setCategory(e.target.value); setPage(1); }}
          style={styles.filterSelect}
        >
          <option value="">{t('marketplace.allCategories', 'All Categories')}</option>
          {categories.map(cat => (
            <option key={cat.slug} value={cat.slug}>{cat.name}</option>
          ))}
        </select>

        <select
          value={priceType}
          onChange={(e) => { setPriceType(e.target.value); setPage(1); }}
          style={styles.filterSelect}
        >
          <option value="">{t('marketplace.allPrices', 'All Prices')}</option>
          <option value="free">{t('marketplace.freeOnly', 'Free Only')}</option>
          <option value="one_time">{t('marketplace.oneTime', 'One-time Purchase')}</option>
          <option value="subscription">{t('marketplace.subscription', 'Subscription')}</option>
        </select>

        <select
          value={sortBy}
          onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
          style={styles.filterSelect}
        >
          <option value="downloads">{t('marketplace.mostPopular', 'Most Popular')}</option>
          <option value="rating">{t('marketplace.topRated', 'Top Rated')}</option>
          <option value="created_at">{t('marketplace.newest', 'Newest')}</option>
          <option value="price">{t('marketplace.lowestPrice', 'Lowest Price')}</option>
        </select>
      </div>

      {/* Featured Section */}
      {!query && !type && !category && page === 1 && featuredItems.length > 0 && (
        <section style={styles.featuredSection}>
          <h2 style={styles.sectionTitle}>{t('marketplace.featured', 'Featured')}</h2>
          <div style={styles.featuredGrid}>
            {featuredItems.map(item => (
              <div
                key={item.id}
                style={styles.featuredCard}
                onClick={() => navigate(`/marketplace/${item.slug}`)}
              >
                <div style={styles.featuredIcon}>
                  {item.icon_url ? (
                    <img src={item.icon_url} alt={item.name} style={styles.iconImage} />
                  ) : (
                    <span style={styles.iconEmoji}>{getTypeIcon(item.type)}</span>
                  )}
                </div>
                <div style={styles.featuredInfo}>
                  <h3 style={styles.featuredName}>{item.name}</h3>
                  <p style={styles.featuredDesc}>{item.description}</p>
                  <div style={styles.featuredMeta}>
                    <span style={styles.rating}>
                      {renderStars(item.rating)} ({item.reviews_count})
                    </span>
                    <span style={styles.price}>{formatPrice(item)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Results */}
      <section style={styles.resultsSection}>
        <div style={styles.resultsHeader}>
          <h2 style={styles.sectionTitle}>
            {query ? t('marketplace.searchResults', 'Search Results') : t('marketplace.allItems', 'All Items')}
          </h2>
          <span style={styles.resultCount}>
            {total} {t('marketplace.items', 'items')}
          </span>
        </div>

        {loading ? (
          <div style={styles.loading}>
            <div style={styles.spinner} />
            <p>{t('common.loading', 'Loading...')}</p>
          </div>
        ) : items.length === 0 ? (
          <div style={styles.empty}>
            <p>{t('marketplace.noResults', 'No items found')}</p>
          </div>
        ) : (
          <>
            <div style={styles.itemsGrid}>
              {items.map(item => (
                <div
                  key={item.id}
                  style={styles.itemCard}
                  onClick={() => navigate(`/marketplace/${item.slug}`)}
                >
                  <div style={styles.itemHeader}>
                    <div style={styles.itemIcon}>
                      {item.icon_url ? (
                        <img src={item.icon_url} alt={item.name} style={styles.iconImage} />
                      ) : (
                        <span style={styles.iconEmoji}>{getTypeIcon(item.type)}</span>
                      )}
                    </div>
                    <span style={styles.itemType}>{item.type}</span>
                  </div>
                  <h3 style={styles.itemName}>{item.name}</h3>
                  <p style={styles.itemDesc}>{item.description}</p>
                  <div style={styles.itemFooter}>
                    <div style={styles.itemStats}>
                      <span style={styles.downloads}>
                        <Download size={12} style={{ display: 'inline', marginRight: '4px' }} />{item.downloads.toLocaleString()}
                      </span>
                      <span style={styles.rating}>
                        ★ {item.rating.toFixed(1)}
                      </span>
                    </div>
                    <span style={styles.itemPrice}>{formatPrice(item)}</span>
                  </div>
                  <p style={styles.sellerName}>
                    {t('marketplace.by', 'by')} {item.seller_name || 'Unknown'}
                  </p>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={styles.pagination}>
                <button
                  style={{ ...styles.pageButton, opacity: page === 1 ? 0.5 : 1 }}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  {t('common.previous', 'Previous')}
                </button>
                <span style={styles.pageInfo}>
                  {t('common.page', 'Page')} {page} {t('common.of', 'of')} {totalPages}
                </span>
                <button
                  style={{ ...styles.pageButton, opacity: page === totalPages ? 0.5 : 1 }}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  {t('common.next', 'Next')}
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {/* Categories Grid */}
      {!query && page === 1 && (
        <section style={styles.categoriesSection}>
          <h2 style={styles.sectionTitle}>{t('marketplace.browseByCategory', 'Browse by Category')}</h2>
          <div style={styles.categoriesGrid}>
            {categories.map(cat => (
              <div
                key={cat.slug}
                style={styles.categoryCard}
                onClick={() => { setCategory(cat.slug); setPage(1); }}
              >
                <span style={styles.categoryIcon}>{cat.icon || '📁'}</span>
                <h3 style={styles.categoryName}>{cat.name}</h3>
                <p style={styles.categoryDesc}>{cat.description}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

const styles = {
  container: {
    padding: '24px',
    maxWidth: '1400px',
    margin: '0 auto',
    minHeight: '100vh',
    backgroundColor: '#f9fafb'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '32px',
    flexWrap: 'wrap',
    gap: '16px'
  },
  headerContent: {},
  title: {
    margin: '0 0 8px 0',
    fontSize: '32px',
    fontWeight: '700',
    color: '#1a1a2e'
  },
  subtitle: {
    margin: 0,
    fontSize: '16px',
    color: '#6b7280'
  },
  sellButton: {
    padding: '12px 24px',
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer'
  },
  searchSection: {
    marginBottom: '24px'
  },
  searchBar: {
    display: 'flex',
    gap: '12px',
    maxWidth: '600px'
  },
  searchInput: {
    flex: 1,
    padding: '12px 16px',
    fontSize: '16px',
    border: '2px solid #e5e7eb',
    borderRadius: '8px',
    outline: 'none'
  },
  searchButton: {
    padding: '12px 24px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer'
  },
  filters: {
    display: 'flex',
    gap: '12px',
    marginBottom: '32px',
    flexWrap: 'wrap'
  },
  filterSelect: {
    padding: '10px 16px',
    fontSize: '14px',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    backgroundColor: 'white',
    cursor: 'pointer'
  },
  featuredSection: {
    marginBottom: '48px'
  },
  sectionTitle: {
    margin: '0 0 20px 0',
    fontSize: '20px',
    fontWeight: '600',
    color: '#1a1a2e'
  },
  featuredGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
    gap: '20px'
  },
  featuredCard: {
    display: 'flex',
    gap: '16px',
    padding: '20px',
    backgroundColor: 'white',
    borderRadius: '12px',
    border: '2px solid #e5e7eb',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  featuredIcon: {
    width: '64px',
    height: '64px',
    borderRadius: '12px',
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
    borderRadius: '12px'
  },
  iconEmoji: {
    fontSize: '32px'
  },
  featuredInfo: {
    flex: 1,
    minWidth: 0
  },
  featuredName: {
    margin: '0 0 8px 0',
    fontSize: '16px',
    fontWeight: '600',
    color: '#1a1a2e'
  },
  featuredDesc: {
    margin: '0 0 12px 0',
    fontSize: '14px',
    color: '#6b7280',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  featuredMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  rating: {
    fontSize: '14px',
    color: '#6b7280'
  },
  price: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#10b981'
  },
  starFilled: { color: '#fbbf24' },
  starHalf: { color: '#fcd34d' },
  starEmpty: { color: '#e5e7eb' },
  resultsSection: {
    marginBottom: '48px'
  },
  resultsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px'
  },
  resultCount: {
    fontSize: '14px',
    color: '#6b7280'
  },
  loading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '60px 20px'
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid #e5e7eb',
    borderTopColor: '#3b82f6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },
  empty: {
    textAlign: 'center',
    padding: '60px 20px',
    color: '#6b7280'
  },
  itemsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '20px'
  },
  itemCard: {
    padding: '20px',
    backgroundColor: 'white',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  itemHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '12px'
  },
  itemIcon: {
    width: '48px',
    height: '48px',
    borderRadius: '10px',
    backgroundColor: '#f3f4f6',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
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
  itemName: {
    margin: '0 0 8px 0',
    fontSize: '16px',
    fontWeight: '600',
    color: '#1a1a2e'
  },
  itemDesc: {
    margin: '0 0 16px 0',
    fontSize: '14px',
    color: '#6b7280',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden'
  },
  itemFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px'
  },
  itemStats: {
    display: 'flex',
    gap: '12px',
    fontSize: '13px',
    color: '#6b7280'
  },
  downloads: {},
  itemPrice: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#10b981'
  },
  sellerName: {
    margin: 0,
    fontSize: '12px',
    color: '#9ca3af'
  },
  pagination: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '16px',
    marginTop: '32px'
  },
  pageButton: {
    padding: '10px 20px',
    backgroundColor: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    fontSize: '14px',
    cursor: 'pointer'
  },
  pageInfo: {
    fontSize: '14px',
    color: '#6b7280'
  },
  categoriesSection: {
    marginBottom: '48px'
  },
  categoriesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '16px'
  },
  categoryCard: {
    padding: '20px',
    backgroundColor: 'white',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  categoryIcon: {
    fontSize: '32px',
    marginBottom: '12px',
    display: 'block'
  },
  categoryName: {
    margin: '0 0 8px 0',
    fontSize: '16px',
    fontWeight: '600',
    color: '#1a1a2e'
  },
  categoryDesc: {
    margin: 0,
    fontSize: '13px',
    color: '#6b7280'
  }
};

export default MarketplaceBrowse;
