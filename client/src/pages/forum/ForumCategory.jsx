/**
 * @fileoverview Forum Category Page
 * @description Shows topics within a specific category
 */

import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../utils/api';

export default function ForumCategory() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [category, setCategory] = useState(null);
  const [topics, setTopics] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const currentPage = parseInt(searchParams.get('page')) || 1;
  const sort = searchParams.get('sort') || 'latest';
  const filter = searchParams.get('filter') || 'all';

  useEffect(() => {
    loadCategoryData();
  }, [slug, currentPage, sort, filter]);

  const loadCategoryData = async () => {
    try {
      setLoading(true);
      const [categoryRes, topicsRes] = await Promise.all([
        api.get(`/api/forum/categories/${slug}`),
        api.get(`/api/forum/topics?category=${slug}&page=${currentPage}&sort=${sort}&filter=${filter}`)
      ]);

      setCategory(categoryRes.data.data);
      setTopics(topicsRes.data.data || []);
      setPagination(topicsRes.data.pagination);
    } catch (err) {
      if (err.response?.status === 404) {
        setError('Category not found');
      } else {
        setError('Failed to load category');
      }
    } finally {
      setLoading(false);
    }
  };

  const updateParams = (key, value) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set(key, value);
    if (key !== 'page') newParams.set('page', '1');
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

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto' }} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p style={{ color: '#ef4444' }}>{error}</p>
        <Link to="/forum" style={styles.backLink}>Back to Forum</Link>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Breadcrumb */}
      <div style={styles.breadcrumb}>
        <Link to="/forum" style={styles.breadcrumbLink}>Forum</Link>
        <span style={styles.breadcrumbSep}>/</span>
        <span style={styles.breadcrumbCurrent}>{category?.name}</span>
      </div>

      {/* Category Header */}
      <div style={{
        ...styles.categoryHeader,
        borderLeftColor: category?.color || '#3b82f6'
      }}>
        <div style={styles.categoryInfo}>
          <span style={styles.categoryIcon}>{category?.icon || '#'}</span>
          <div>
            <h1 style={styles.categoryName}>{category?.name}</h1>
            <p style={styles.categoryDescription}>{category?.description}</p>
          </div>
        </div>
        <button onClick={() => navigate('/forum/new?category=' + slug)} style={styles.newTopicButton}>
          New Topic
        </button>
      </div>

      {/* Filters */}
      <div style={styles.filters}>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>Sort:</label>
          <select
            value={sort}
            onChange={(e) => updateParams('sort', e.target.value)}
            style={styles.filterSelect}
          >
            <option value="latest">Latest Activity</option>
            <option value="popular">Most Viewed</option>
            <option value="most_replies">Most Replies</option>
            <option value="oldest">Oldest</option>
          </select>
        </div>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>Filter:</label>
          <select
            value={filter}
            onChange={(e) => updateParams('filter', e.target.value)}
            style={styles.filterSelect}
          >
            <option value="all">All Topics</option>
            <option value="solved">Solved</option>
            <option value="unsolved">Unsolved</option>
            <option value="unanswered">Unanswered</option>
          </select>
        </div>
        <div style={styles.statsInfo}>
          {pagination?.total || 0} topics
        </div>
      </div>

      {/* Topics List */}
      <div style={styles.topicsList}>
        {topics.length === 0 ? (
          <div style={styles.emptyState}>
            <p>No topics yet in this category.</p>
            <button onClick={() => navigate('/forum/new?category=' + slug)} style={styles.newTopicButton}>
              Start a Discussion
            </button>
          </div>
        ) : (
          topics.map(topic => (
            <Link key={topic.id} to={`/forum/topic/${topic.slug}`} style={styles.topicItem}>
              <div style={styles.topicContent}>
                <div style={styles.topicTitle}>
                  {topic.is_pinned && <span style={styles.pinnedBadge}>Pinned</span>}
                  {topic.is_locked && <span style={styles.lockedBadge}>Locked</span>}
                  {topic.is_solved && <span style={styles.solvedBadge}>Solved</span>}
                  {topic.title}
                </div>
                <div style={styles.topicMeta}>
                  <span style={styles.authorName}>by {topic.author_name}</span>
                  <span style={styles.topicDate}>
                    started {formatDate(topic.created_at)}
                  </span>
                  {topic.tags && JSON.parse(topic.tags || '[]').length > 0 && (
                    <div style={styles.tagsList}>
                      {JSON.parse(topic.tags).slice(0, 3).map((tag, i) => (
                        <span key={i} style={styles.tag}>{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div style={styles.topicStats}>
                <div style={styles.statBlock}>
                  <span style={styles.statNumber}>{topic.replies_count}</span>
                  <span style={styles.statText}>replies</span>
                </div>
                <div style={styles.statBlock}>
                  <span style={styles.statNumber}>{topic.views_count}</span>
                  <span style={styles.statText}>views</span>
                </div>
                <div style={styles.statBlock}>
                  <span style={styles.statNumber}>{topic.likes_count}</span>
                  <span style={styles.statText}>likes</span>
                </div>
                <div style={styles.lastActivity}>
                  {topic.last_reply_user_name ? (
                    <>
                      <span style={styles.lastReplyUser}>{topic.last_reply_user_name}</span>
                      <span style={styles.lastReplyTime}>
                        {formatDate(topic.last_reply_at)}
                      </span>
                    </>
                  ) : (
                    <span style={styles.noReplies}>No replies yet</span>
                  )}
                </div>
              </div>
            </Link>
          ))
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div style={styles.pagination}>
          <button
            onClick={() => updateParams('page', currentPage - 1)}
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
            onClick={() => updateParams('page', currentPage + 1)}
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
  );
}

const styles = {
  container: {
    maxWidth: '1200px',
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
  categoryHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '24px',
    backgroundColor: 'white',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
    borderLeft: '4px solid',
    marginBottom: '24px'
  },
  categoryInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px'
  },
  categoryIcon: {
    fontSize: '32px'
  },
  categoryName: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#111827',
    margin: 0
  },
  categoryDescription: {
    fontSize: '14px',
    color: '#6b7280',
    marginTop: '4px'
  },
  newTopicButton: {
    padding: '12px 24px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500'
  },
  filters: {
    display: 'flex',
    alignItems: 'center',
    gap: '24px',
    marginBottom: '16px',
    padding: '16px',
    backgroundColor: '#f9fafb',
    borderRadius: '8px'
  },
  filterGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  filterLabel: {
    fontSize: '13px',
    color: '#6b7280'
  },
  filterSelect: {
    padding: '6px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '13px',
    backgroundColor: 'white'
  },
  statsInfo: {
    marginLeft: 'auto',
    fontSize: '13px',
    color: '#6b7280'
  },
  topicsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  topicItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px',
    backgroundColor: 'white',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    textDecoration: 'none',
    transition: 'border-color 0.2s'
  },
  topicContent: {
    flex: 1
  },
  topicTitle: {
    fontSize: '16px',
    fontWeight: '500',
    color: '#111827',
    marginBottom: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap'
  },
  topicMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    flexWrap: 'wrap'
  },
  authorName: {
    fontSize: '13px',
    color: '#6b7280'
  },
  topicDate: {
    fontSize: '12px',
    color: '#9ca3af'
  },
  tagsList: {
    display: 'flex',
    gap: '6px'
  },
  tag: {
    padding: '2px 8px',
    backgroundColor: '#e5e7eb',
    color: '#374151',
    borderRadius: '4px',
    fontSize: '11px'
  },
  topicStats: {
    display: 'flex',
    alignItems: 'center',
    gap: '32px'
  },
  statBlock: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    minWidth: '50px'
  },
  statNumber: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#374151'
  },
  statText: {
    fontSize: '11px',
    color: '#9ca3af'
  },
  lastActivity: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    minWidth: '120px'
  },
  lastReplyUser: {
    fontSize: '13px',
    color: '#374151',
    fontWeight: '500'
  },
  lastReplyTime: {
    fontSize: '11px',
    color: '#9ca3af'
  },
  noReplies: {
    fontSize: '12px',
    color: '#9ca3af',
    fontStyle: 'italic'
  },
  pinnedBadge: {
    padding: '2px 6px',
    backgroundColor: '#fef3c7',
    color: '#b45309',
    borderRadius: '4px',
    fontSize: '10px',
    fontWeight: '600',
    textTransform: 'uppercase'
  },
  lockedBadge: {
    padding: '2px 6px',
    backgroundColor: '#fee2e2',
    color: '#dc2626',
    borderRadius: '4px',
    fontSize: '10px',
    fontWeight: '600',
    textTransform: 'uppercase'
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
  emptyState: {
    textAlign: 'center',
    padding: '60px 20px',
    backgroundColor: '#f9fafb',
    borderRadius: '12px'
  },
  pagination: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '16px',
    marginTop: '24px'
  },
  pageButton: {
    padding: '8px 16px',
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
  backLink: {
    color: '#3b82f6',
    textDecoration: 'none',
    marginTop: '16px',
    display: 'inline-block'
  }
};
