/**
 * @fileoverview Forum Home Page
 * @description Main forum landing page with categories and recent topics
 */

import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../utils/api';

const BADGE_COLORS = {
  newcomer: { bg: '#e5e7eb', text: '#374151' },
  contributor: { bg: '#dbeafe', text: '#1d4ed8' },
  active: { bg: '#dcfce7', text: '#15803d' },
  trusted: { bg: '#fef3c7', text: '#b45309' },
  expert: { bg: '#ede9fe', text: '#7c3aed' },
  legend: { bg: '#fce7f3', text: '#be185d' }
};

export default function ForumHome() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [popularTopics, setPopularTopics] = useState([]);
  const [recentTopics, setRecentTopics] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadForumData();
  }, []);

  const loadForumData = async () => {
    try {
      setLoading(true);
      const [categoriesRes, popularRes, recentRes, statsRes] = await Promise.all([
        api.get('/api/forum/categories'),
        api.get('/api/forum/topics/popular?limit=5'),
        api.get('/api/forum/topics?limit=10'),
        api.get('/api/forum/stats')
      ]);

      setCategories(categoriesRes.data.data || []);
      setPopularTopics(popularRes.data.data || []);
      setRecentTopics(recentRes.data.data || []);
      setStats(statsRes.data.data);
    } catch (err) {
      setError('Failed to load forum data');
      console.error(err);
    } finally {
      setLoading(false);
    }
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
        <p style={{ marginTop: '16px', color: '#6b7280' }}>Loading forum...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p style={{ color: '#ef4444' }}>{error}</p>
        <button onClick={loadForumData} style={styles.retryButton}>Retry</button>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Developer Forum</h1>
          <p style={styles.subtitle}>Ask questions, share knowledge, help others</p>
        </div>
        <div style={styles.headerActions}>
          <Link to="/forum/search" style={styles.searchLink}>
            Search
          </Link>
          <button onClick={() => navigate('/forum/new')} style={styles.newTopicButton}>
            New Topic
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      {stats && (
        <div style={styles.statsBar}>
          <div style={styles.statItem}>
            <span style={styles.statValue}>{stats.total_topics}</span>
            <span style={styles.statLabel}>Topics</span>
          </div>
          <div style={styles.statItem}>
            <span style={styles.statValue}>{stats.total_replies}</span>
            <span style={styles.statLabel}>Replies</span>
          </div>
          <div style={styles.statItem}>
            <span style={styles.statValue}>{stats.solved_topics}</span>
            <span style={styles.statLabel}>Solved</span>
          </div>
          <div style={styles.statItem}>
            <span style={styles.statValue}>{stats.unique_authors}</span>
            <span style={styles.statLabel}>Contributors</span>
          </div>
        </div>
      )}

      <div style={styles.mainContent}>
        {/* Left Column - Categories */}
        <div style={styles.leftColumn}>
          <h2 style={styles.sectionTitle}>Categories</h2>
          <div style={styles.categoriesGrid}>
            {categories.map(category => (
              <Link
                key={category.id}
                to={`/forum/category/${category.slug}`}
                style={{
                  ...styles.categoryCard,
                  borderLeftColor: category.color || '#3b82f6'
                }}
              >
                <div style={styles.categoryHeader}>
                  <span style={styles.categoryIcon}>{category.icon || '#'}</span>
                  <span style={styles.categoryName}>{category.name}</span>
                </div>
                <p style={styles.categoryDescription}>{category.description}</p>
                <div style={styles.categoryStats}>
                  <span>{category.topics_count} topics</span>
                  <span>{category.replies_count} replies</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Right Column - Popular & Recent Topics */}
        <div style={styles.rightColumn}>
          {/* Popular Topics */}
          <div style={styles.topicsSection}>
            <h2 style={styles.sectionTitle}>Popular Topics</h2>
            <div style={styles.topicsList}>
              {popularTopics.map(topic => (
                <Link key={topic.id} to={`/forum/topic/${topic.slug}`} style={styles.topicItem}>
                  <div style={styles.topicTitle}>
                    {topic.is_solved && <span style={styles.solvedBadge}>Solved</span>}
                    {topic.title}
                  </div>
                  <div style={styles.topicMeta}>
                    <span>{topic.views_count} views</span>
                    <span>{topic.replies_count} replies</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Recent Topics */}
          <div style={styles.topicsSection}>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>Recent Topics</h2>
              <Link to="/forum/topics/unanswered" style={styles.viewAllLink}>
                View Unanswered
              </Link>
            </div>
            <div style={styles.topicsList}>
              {recentTopics.map(topic => (
                <Link key={topic.id} to={`/forum/topic/${topic.slug}`} style={styles.topicItem}>
                  <div style={styles.topicContent}>
                    <div style={styles.topicTitle}>
                      {topic.is_pinned && <span style={styles.pinnedBadge}>Pinned</span>}
                      {topic.is_solved && <span style={styles.solvedBadge}>Solved</span>}
                      {topic.title}
                    </div>
                    <div style={styles.topicInfo}>
                      <span style={{
                        ...styles.categoryTag,
                        backgroundColor: topic.category_color || '#e5e7eb'
                      }}>
                        {topic.category_name}
                      </span>
                      <span style={styles.authorName}>by {topic.author_name}</span>
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
                    <span style={styles.topicTime}>{formatDate(topic.last_reply_at || topic.created_at)}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '24px'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px'
  },
  title: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#111827',
    margin: 0
  },
  subtitle: {
    fontSize: '14px',
    color: '#6b7280',
    marginTop: '4px'
  },
  headerActions: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center'
  },
  searchLink: {
    padding: '10px 20px',
    color: '#374151',
    textDecoration: 'none',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px'
  },
  newTopicButton: {
    padding: '10px 20px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500'
  },
  statsBar: {
    display: 'flex',
    gap: '32px',
    padding: '20px 24px',
    backgroundColor: '#f9fafb',
    borderRadius: '12px',
    marginBottom: '24px'
  },
  statItem: {
    display: 'flex',
    flexDirection: 'column'
  },
  statValue: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#111827'
  },
  statLabel: {
    fontSize: '13px',
    color: '#6b7280'
  },
  mainContent: {
    display: 'grid',
    gridTemplateColumns: '1fr 2fr',
    gap: '24px'
  },
  leftColumn: {},
  rightColumn: {},
  sectionTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#111827',
    marginBottom: '16px'
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px'
  },
  viewAllLink: {
    fontSize: '14px',
    color: '#3b82f6',
    textDecoration: 'none'
  },
  categoriesGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  categoryCard: {
    display: 'block',
    padding: '16px',
    backgroundColor: 'white',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    borderLeft: '4px solid',
    textDecoration: 'none',
    transition: 'box-shadow 0.2s'
  },
  categoryHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px'
  },
  categoryIcon: {
    fontSize: '18px'
  },
  categoryName: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#111827'
  },
  categoryDescription: {
    fontSize: '13px',
    color: '#6b7280',
    marginBottom: '12px',
    lineHeight: '1.5'
  },
  categoryStats: {
    display: 'flex',
    gap: '16px',
    fontSize: '12px',
    color: '#9ca3af'
  },
  topicsSection: {
    marginBottom: '32px'
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
    padding: '16px',
    backgroundColor: 'white',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    textDecoration: 'none',
    transition: 'background-color 0.2s'
  },
  topicContent: {
    flex: 1
  },
  topicTitle: {
    fontSize: '15px',
    fontWeight: '500',
    color: '#111827',
    marginBottom: '4px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  topicInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  topicMeta: {
    display: 'flex',
    gap: '12px',
    fontSize: '12px',
    color: '#6b7280'
  },
  categoryTag: {
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    color: '#374151'
  },
  authorName: {
    fontSize: '12px',
    color: '#6b7280'
  },
  topicStats: {
    display: 'flex',
    alignItems: 'center',
    gap: '24px'
  },
  statBlock: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
  },
  statNumber: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#374151'
  },
  statText: {
    fontSize: '11px',
    color: '#9ca3af'
  },
  topicTime: {
    fontSize: '12px',
    color: '#9ca3af',
    minWidth: '60px',
    textAlign: 'right'
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
  solvedBadge: {
    padding: '2px 6px',
    backgroundColor: '#dcfce7',
    color: '#15803d',
    borderRadius: '4px',
    fontSize: '10px',
    fontWeight: '600',
    textTransform: 'uppercase'
  },
  retryButton: {
    marginTop: '16px',
    padding: '8px 16px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer'
  }
};
