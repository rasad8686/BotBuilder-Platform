/**
 * @fileoverview Forum Search
 * @description Search topics across the forum
 */

import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../../utils/api';

export default function ForumSearch() {
  const [searchParams, setSearchParams] = useSearchParams();

  const query = searchParams.get('q') || '';
  const categorySlug = searchParams.get('category') || '';
  const currentPage = parseInt(searchParams.get('page')) || 1;

  const [searchQuery, setSearchQuery] = useState(query);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(categorySlug);
  const [results, setResults] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    if (query) {
      performSearch();
    }
  }, [query, categorySlug, currentPage]);

  const loadCategories = async () => {
    try {
      const res = await api.get('/api/forum/categories');
      setCategories(res.data.data || []);
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  };

  const performSearch = async () => {
    if (!query || query.length < 2) return;

    try {
      setLoading(true);
      let url = `/api/forum/search?q=${encodeURIComponent(query)}&page=${currentPage}`;
      if (categorySlug) {
        url += `&category=${categorySlug}`;
      }

      const res = await api.get(url);
      setResults(res.data.data || []);
      setPagination(res.data.pagination);
      setSearched(true);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (!searchQuery.trim() || searchQuery.length < 2) return;

    const newParams = new URLSearchParams();
    newParams.set('q', searchQuery.trim());
    if (selectedCategory) {
      newParams.set('category', selectedCategory);
    }
    newParams.set('page', '1');
    setSearchParams(newParams);
  };

  const updatePage = (page) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('page', page.toString());
    setSearchParams(newParams);
  };

  const formatDate = (date) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now - d;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString();
  };

  const highlightMatch = (text, query) => {
    if (!query || !text) return text;
    const regex = new RegExp(`(${query})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? <mark key={i} style={styles.highlight}>{part}</mark> : part
    );
  };

  return (
    <div style={styles.container}>
      {/* Breadcrumb */}
      <div style={styles.breadcrumb}>
        <Link to="/forum" style={styles.breadcrumbLink}>Forum</Link>
        <span style={styles.breadcrumbSep}>/</span>
        <span style={styles.breadcrumbCurrent}>Search</span>
      </div>

      {/* Search Header */}
      <div style={styles.searchHeader}>
        <h1 style={styles.title}>Search Forum</h1>
        <p style={styles.subtitle}>Find topics, questions, and discussions</p>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSearch} style={styles.searchForm}>
        <div style={styles.searchInputWrapper}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search for topics..."
            style={styles.searchInput}
            minLength={2}
          />
          <button type="submit" style={styles.searchButton}>
            Search
          </button>
        </div>

        <div style={styles.filters}>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={styles.categorySelect}
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.slug}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>
      </form>

      {/* Results */}
      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto' }} />
          <p style={{ marginTop: '16px', color: '#6b7280' }}>Searching...</p>
        </div>
      ) : searched ? (
        <div style={styles.resultsSection}>
          <div style={styles.resultsHeader}>
            <span style={styles.resultsCount}>
              {pagination?.total || 0} results for "{query}"
            </span>
          </div>

          {results.length === 0 ? (
            <div style={styles.noResults}>
              <p style={styles.noResultsTitle}>No results found</p>
              <p style={styles.noResultsText}>
                Try different keywords or check your spelling.
              </p>
              <div style={styles.suggestions}>
                <p style={styles.suggestionsTitle}>Suggestions:</p>
                <ul style={styles.suggestionsList}>
                  <li>Use more general terms</li>
                  <li>Try different keywords</li>
                  <li>Check for typos</li>
                  <li>Search in all categories</li>
                </ul>
              </div>
            </div>
          ) : (
            <div style={styles.resultsList}>
              {results.map(topic => (
                <Link key={topic.id} to={`/forum/topic/${topic.slug}`} style={styles.resultItem}>
                  <div style={styles.resultContent}>
                    <div style={styles.resultTitle}>
                      {topic.is_solved && <span style={styles.solvedBadge}>Solved</span>}
                      {highlightMatch(topic.title, query)}
                    </div>
                    <p style={styles.resultExcerpt}>
                      {topic.content?.substring(0, 200)}...
                    </p>
                    <div style={styles.resultMeta}>
                      <span style={{
                        ...styles.categoryTag,
                        backgroundColor: topic.category_color || '#e5e7eb'
                      }}>
                        {topic.category_name}
                      </span>
                      <span style={styles.authorName}>by {topic.author_name}</span>
                      <span style={styles.resultDate}>{formatDate(topic.created_at)}</span>
                      <span style={styles.resultStats}>
                        {topic.replies_count} replies, {topic.views_count} views
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div style={styles.pagination}>
              <button
                onClick={() => updatePage(currentPage - 1)}
                disabled={currentPage <= 1}
                style={{
                  ...styles.pageButton,
                  opacity: currentPage <= 1 ? 0.5 : 1
                }}
              >
                Previous
              </button>
              <span style={styles.pageInfo}>
                Page {currentPage} of {pagination.totalPages}
              </span>
              <button
                onClick={() => updatePage(currentPage + 1)}
                disabled={currentPage >= pagination.totalPages}
                style={{
                  ...styles.pageButton,
                  opacity: currentPage >= pagination.totalPages ? 0.5 : 1
                }}
              >
                Next
              </button>
            </div>
          )}
        </div>
      ) : (
        <div style={styles.initialState}>
          <p style={styles.initialText}>Enter a search term to find topics</p>
          <div style={styles.popularSearches}>
            <p style={styles.popularTitle}>Popular searches:</p>
            <div style={styles.popularTags}>
              {['API', 'authentication', 'integration', 'error', 'setup'].map(term => (
                <button
                  key={term}
                  onClick={() => {
                    setSearchQuery(term);
                    setSearchParams({ q: term, page: '1' });
                  }}
                  style={styles.popularTag}
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '900px',
    margin: '0 auto',
    padding: '24px'
  },
  breadcrumb: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '24px',
    fontSize: '14px'
  },
  breadcrumbLink: {
    color: '#3b82f6',
    textDecoration: 'none'
  },
  breadcrumbSep: {
    color: '#9ca3af'
  },
  breadcrumbCurrent: {
    color: '#374151'
  },
  searchHeader: {
    marginBottom: '24px'
  },
  title: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#111827',
    margin: '0 0 8px 0'
  },
  subtitle: {
    fontSize: '14px',
    color: '#6b7280'
  },
  searchForm: {
    backgroundColor: 'white',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
    padding: '24px',
    marginBottom: '24px'
  },
  searchInputWrapper: {
    display: 'flex',
    gap: '12px',
    marginBottom: '16px'
  },
  searchInput: {
    flex: 1,
    padding: '14px 16px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '16px'
  },
  searchButton: {
    padding: '14px 32px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: '500'
  },
  filters: {
    display: 'flex',
    gap: '12px'
  },
  categorySelect: {
    padding: '10px 16px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    backgroundColor: 'white',
    minWidth: '200px'
  },
  resultsSection: {},
  resultsHeader: {
    marginBottom: '16px'
  },
  resultsCount: {
    fontSize: '14px',
    color: '#6b7280'
  },
  resultsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  resultItem: {
    display: 'block',
    padding: '20px',
    backgroundColor: 'white',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    textDecoration: 'none',
    transition: 'border-color 0.2s'
  },
  resultContent: {},
  resultTitle: {
    fontSize: '17px',
    fontWeight: '600',
    color: '#111827',
    marginBottom: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap'
  },
  resultExcerpt: {
    fontSize: '14px',
    color: '#6b7280',
    lineHeight: '1.5',
    marginBottom: '12px'
  },
  resultMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    flexWrap: 'wrap',
    fontSize: '13px'
  },
  categoryTag: {
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    color: '#374151'
  },
  authorName: {
    color: '#6b7280'
  },
  resultDate: {
    color: '#9ca3af'
  },
  resultStats: {
    color: '#9ca3af'
  },
  solvedBadge: {
    padding: '2px 6px',
    backgroundColor: '#dcfce7',
    color: '#15803d',
    borderRadius: '4px',
    fontSize: '10px',
    fontWeight: '600',
    textTransform: 'uppercase'
  },
  highlight: {
    backgroundColor: '#fef3c7',
    padding: '0 2px',
    borderRadius: '2px'
  },
  noResults: {
    textAlign: 'center',
    padding: '60px 20px',
    backgroundColor: '#f9fafb',
    borderRadius: '12px'
  },
  noResultsTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#374151',
    marginBottom: '8px'
  },
  noResultsText: {
    fontSize: '14px',
    color: '#6b7280',
    marginBottom: '24px'
  },
  suggestions: {
    textAlign: 'left',
    maxWidth: '300px',
    margin: '0 auto'
  },
  suggestionsTitle: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#374151',
    marginBottom: '8px'
  },
  suggestionsList: {
    margin: 0,
    paddingLeft: '20px',
    fontSize: '13px',
    color: '#6b7280',
    lineHeight: '1.8'
  },
  pagination: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '16px',
    marginTop: '24px'
  },
  pageButton: {
    padding: '10px 20px',
    backgroundColor: 'white',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px'
  },
  pageInfo: {
    fontSize: '14px',
    color: '#6b7280'
  },
  initialState: {
    textAlign: 'center',
    padding: '60px 20px'
  },
  initialText: {
    fontSize: '16px',
    color: '#6b7280',
    marginBottom: '24px'
  },
  popularSearches: {},
  popularTitle: {
    fontSize: '14px',
    color: '#374151',
    marginBottom: '12px'
  },
  popularTags: {
    display: 'flex',
    justifyContent: 'center',
    gap: '8px',
    flexWrap: 'wrap'
  },
  popularTag: {
    padding: '8px 16px',
    backgroundColor: '#f3f4f6',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    color: '#374151'
  }
};
