/**
 * @fileoverview Forum User Profile
 * @description Shows a user's forum activity and stats
 */

import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../../utils/api';

const BADGE_COLORS = {
  newcomer: { bg: '#e5e7eb', text: '#374151', label: 'Newcomer' },
  contributor: { bg: '#dbeafe', text: '#1d4ed8', label: 'Contributor' },
  active: { bg: '#dcfce7', text: '#15803d', label: 'Active Member' },
  trusted: { bg: '#fef3c7', text: '#b45309', label: 'Trusted Member' },
  expert: { bg: '#ede9fe', text: '#7c3aed', label: 'Expert' },
  legend: { bg: '#fce7f3', text: '#be185d', label: 'Legend' }
};

export default function ForumUserProfile() {
  const { userId } = useParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('topics');

  useEffect(() => {
    loadProfile();
  }, [userId]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/api/forum/user/${userId}`);
      setProfile(res.data.data);
    } catch (err) {
      if (err.response?.status === 404) {
        setError('User not found');
      } else {
        setError('Failed to load profile');
      }
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getProgressToNextBadge = () => {
    const rep = profile?.stats?.reputation || 0;
    const badges = [
      { name: 'newcomer', threshold: 0 },
      { name: 'contributor', threshold: 50 },
      { name: 'active', threshold: 150 },
      { name: 'trusted', threshold: 500 },
      { name: 'expert', threshold: 1500 },
      { name: 'legend', threshold: 5000 }
    ];

    let currentIndex = 0;
    for (let i = badges.length - 1; i >= 0; i--) {
      if (rep >= badges[i].threshold) {
        currentIndex = i;
        break;
      }
    }

    if (currentIndex >= badges.length - 1) {
      return { current: badges[currentIndex], next: null, progress: 100 };
    }

    const current = badges[currentIndex];
    const next = badges[currentIndex + 1];
    const progress = ((rep - current.threshold) / (next.threshold - current.threshold)) * 100;

    return { current, next, progress: Math.min(progress, 100) };
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

  const { user, stats, recentTopics, recentSolutions } = profile;
  const badgeInfo = BADGE_COLORS[stats?.badge] || BADGE_COLORS.newcomer;
  const progressInfo = getProgressToNextBadge();

  return (
    <div style={styles.container}>
      {/* Breadcrumb */}
      <div style={styles.breadcrumb}>
        <Link to="/forum" style={styles.breadcrumbLink}>Forum</Link>
        <span style={styles.breadcrumbSep}>/</span>
        <span style={styles.breadcrumbCurrent}>{user?.name}</span>
      </div>

      {/* Profile Header */}
      <div style={styles.profileHeader}>
        <div style={styles.avatar}>
          {user?.name?.charAt(0)?.toUpperCase() || 'U'}
        </div>
        <div style={styles.profileInfo}>
          <h1 style={styles.userName}>{user?.name}</h1>
          <span style={{
            ...styles.badge,
            backgroundColor: badgeInfo.bg,
            color: badgeInfo.text
          }}>
            {badgeInfo.label}
          </span>
          <p style={styles.joinDate}>
            Member since {formatDate(user?.created_at)}
          </p>
        </div>
        <div style={styles.reputationBox}>
          <span style={styles.reputationValue}>{stats?.reputation || 0}</span>
          <span style={styles.reputationLabel}>Reputation</span>
        </div>
      </div>

      {/* Progress to Next Badge */}
      {progressInfo.next && (
        <div style={styles.progressSection}>
          <div style={styles.progressHeader}>
            <span>Progress to {BADGE_COLORS[progressInfo.next.name]?.label}</span>
            <span>{stats?.reputation || 0} / {progressInfo.next.threshold}</span>
          </div>
          <div style={styles.progressBar}>
            <div
              style={{
                ...styles.progressFill,
                width: `${progressInfo.progress}%`,
                backgroundColor: BADGE_COLORS[progressInfo.next.name]?.text
              }}
            />
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <span style={styles.statValue}>{stats?.topics_count || 0}</span>
          <span style={styles.statLabel}>Topics</span>
        </div>
        <div style={styles.statCard}>
          <span style={styles.statValue}>{stats?.replies_count || 0}</span>
          <span style={styles.statLabel}>Replies</span>
        </div>
        <div style={styles.statCard}>
          <span style={styles.statValue}>{stats?.solutions_count || 0}</span>
          <span style={styles.statLabel}>Solutions</span>
        </div>
        <div style={styles.statCard}>
          <span style={styles.statValue}>{stats?.likes_received || 0}</span>
          <span style={styles.statLabel}>Likes Received</span>
        </div>
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        <button
          onClick={() => setActiveTab('topics')}
          style={{
            ...styles.tab,
            ...(activeTab === 'topics' ? styles.activeTab : {})
          }}
        >
          Recent Topics
        </button>
        <button
          onClick={() => setActiveTab('solutions')}
          style={{
            ...styles.tab,
            ...(activeTab === 'solutions' ? styles.activeTab : {})
          }}
        >
          Solutions
        </button>
      </div>

      {/* Tab Content */}
      <div style={styles.tabContent}>
        {activeTab === 'topics' && (
          <div>
            {recentTopics?.length === 0 ? (
              <p style={styles.emptyMessage}>No topics yet</p>
            ) : (
              recentTopics?.map(topic => (
                <Link key={topic.id} to={`/forum/topic/${topic.slug}`} style={styles.activityItem}>
                  <div style={styles.activityContent}>
                    <div style={styles.activityTitle}>
                      {topic.is_solved && <span style={styles.solvedBadge}>Solved</span>}
                      {topic.title}
                    </div>
                    <div style={styles.activityMeta}>
                      <span style={styles.categoryTag}>{topic.category_name}</span>
                      <span>{topic.replies_count} replies</span>
                      <span>{formatDate(topic.created_at)}</span>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        )}

        {activeTab === 'solutions' && (
          <div>
            {recentSolutions?.length === 0 ? (
              <p style={styles.emptyMessage}>No solutions yet</p>
            ) : (
              recentSolutions?.map(solution => (
                <Link key={solution.id} to={`/forum/topic/${solution.topic_slug}`} style={styles.activityItem}>
                  <div style={styles.activityContent}>
                    <div style={styles.activityTitle}>
                      <span style={styles.solutionIcon}>Answered:</span>
                      {solution.topic_title}
                    </div>
                    <div style={styles.activityMeta}>
                      <span>{formatDate(solution.created_at)}</span>
                    </div>
                    <p style={styles.solutionPreview}>
                      {solution.content?.substring(0, 150)}...
                    </p>
                  </div>
                </Link>
              ))
            )}
          </div>
        )}
      </div>
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
  profileHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '24px',
    padding: '32px',
    backgroundColor: 'white',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
    marginBottom: '24px'
  },
  avatar: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    backgroundColor: '#3b82f6',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '32px',
    fontWeight: '600'
  },
  profileInfo: {
    flex: 1
  },
  userName: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#111827',
    margin: '0 0 8px 0'
  },
  badge: {
    display: 'inline-block',
    padding: '4px 12px',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: '500',
    marginBottom: '8px'
  },
  joinDate: {
    fontSize: '14px',
    color: '#6b7280',
    margin: 0
  },
  reputationBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '16px 32px',
    backgroundColor: '#f9fafb',
    borderRadius: '8px'
  },
  reputationValue: {
    fontSize: '32px',
    fontWeight: '700',
    color: '#111827'
  },
  reputationLabel: {
    fontSize: '13px',
    color: '#6b7280'
  },
  progressSection: {
    backgroundColor: 'white',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    padding: '16px 20px',
    marginBottom: '24px'
  },
  progressHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '13px',
    color: '#6b7280',
    marginBottom: '8px'
  },
  progressBar: {
    height: '8px',
    backgroundColor: '#e5e7eb',
    borderRadius: '4px',
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    borderRadius: '4px',
    transition: 'width 0.3s'
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '16px',
    marginBottom: '24px'
  },
  statCard: {
    backgroundColor: 'white',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    padding: '20px',
    textAlign: 'center'
  },
  statValue: {
    display: 'block',
    fontSize: '24px',
    fontWeight: '700',
    color: '#111827'
  },
  statLabel: {
    fontSize: '13px',
    color: '#6b7280'
  },
  tabs: {
    display: 'flex',
    gap: '4px',
    borderBottom: '1px solid #e5e7eb',
    marginBottom: '24px'
  },
  tab: {
    padding: '12px 24px',
    backgroundColor: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    cursor: 'pointer',
    fontSize: '14px',
    color: '#6b7280',
    fontWeight: '500'
  },
  activeTab: {
    color: '#3b82f6',
    borderBottomColor: '#3b82f6'
  },
  tabContent: {},
  activityItem: {
    display: 'block',
    padding: '16px 20px',
    backgroundColor: 'white',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    marginBottom: '8px',
    textDecoration: 'none'
  },
  activityContent: {},
  activityTitle: {
    fontSize: '15px',
    fontWeight: '500',
    color: '#111827',
    marginBottom: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  activityMeta: {
    display: 'flex',
    gap: '16px',
    fontSize: '12px',
    color: '#6b7280'
  },
  categoryTag: {
    padding: '2px 8px',
    backgroundColor: '#e5e7eb',
    borderRadius: '4px',
    fontSize: '11px',
    color: '#374151'
  },
  solutionIcon: {
    color: '#22c55e',
    fontWeight: '600'
  },
  solutionPreview: {
    fontSize: '13px',
    color: '#6b7280',
    marginTop: '8px',
    lineHeight: '1.5'
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
  emptyMessage: {
    textAlign: 'center',
    padding: '40px',
    color: '#6b7280'
  },
  backLink: {
    color: '#3b82f6',
    textDecoration: 'none',
    marginTop: '16px',
    display: 'inline-block'
  }
};
