import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

const DIFFICULTY_COLORS = {
  beginner: '#22c55e',
  intermediate: '#f59e0b',
  advanced: '#ef4444'
};

function TutorialProgress() {
  const [progress, setProgress] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all', 'in-progress', 'completed'

  const fetchProgress = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/blog/tutorials/my/progress');
      setProgress(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch progress:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  const filteredProgress = progress.filter(p => {
    if (filter === 'completed') return p.is_completed;
    if (filter === 'in-progress') return !p.is_completed && p.completed_steps_count > 0;
    return true;
  });

  const stats = {
    total: progress.length,
    completed: progress.filter(p => p.is_completed).length,
    inProgress: progress.filter(p => !p.is_completed && p.completed_steps_count > 0).length
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>My Learning Progress</h1>
        <p style={styles.subtitle}>Track your tutorial completion progress</p>
      </div>

      {/* Stats Cards */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <span style={styles.statValue}>{stats.total}</span>
          <span style={styles.statLabel}>Started</span>
        </div>
        <div style={{ ...styles.statCard, ...styles.statCardProgress }}>
          <span style={styles.statValue}>{stats.inProgress}</span>
          <span style={styles.statLabel}>In Progress</span>
        </div>
        <div style={{ ...styles.statCard, ...styles.statCardCompleted }}>
          <span style={styles.statValue}>{stats.completed}</span>
          <span style={styles.statLabel}>Completed</span>
        </div>
        <div style={styles.statCard}>
          <span style={styles.statValue}>
            {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}%
          </span>
          <span style={styles.statLabel}>Completion Rate</span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={styles.filters}>
        {[
          { value: 'all', label: 'All' },
          { value: 'in-progress', label: 'In Progress' },
          { value: 'completed', label: 'Completed' }
        ].map(tab => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            style={{
              ...styles.filterTab,
              ...(filter === tab.value ? styles.filterTabActive : {})
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Progress List */}
      {loading ? (
        <div style={styles.loading}>Loading progress...</div>
      ) : filteredProgress.length === 0 ? (
        <div style={styles.empty}>
          {progress.length === 0 ? (
            <>
              <h3>No tutorials started yet</h3>
              <p>Start learning by exploring our tutorials</p>
              <Link to="/tutorials" style={styles.exploreBtn}>
                Explore Tutorials
              </Link>
            </>
          ) : (
            <p>No tutorials match this filter</p>
          )}
        </div>
      ) : (
        <div style={styles.progressList}>
          {filteredProgress.map(item => (
            <div key={item.id} style={styles.progressCard}>
              <div style={styles.cardContent}>
                <div style={styles.cardHeader}>
                  <span
                    style={{
                      ...styles.difficultyBadge,
                      backgroundColor: DIFFICULTY_COLORS[item.difficulty] || '#6b7280'
                    }}
                  >
                    {item.difficulty}
                  </span>
                  <span style={styles.duration}>⏱ {item.estimated_time} min</span>
                </div>

                <Link to={`/tutorials/${item.slug}`} style={styles.tutorialTitle}>
                  {item.title}
                </Link>

                <div style={styles.progressInfo}>
                  <div style={styles.progressBar}>
                    <div
                      style={{
                        ...styles.progressFill,
                        width: `${item.progress_percent}%`,
                        backgroundColor: item.is_completed ? '#22c55e' : '#3b82f6'
                      }}
                    />
                  </div>
                  <span style={styles.progressText}>
                    {item.completed_steps_count} / {item.total_steps} steps
                    ({Math.round(item.progress_percent)}%)
                  </span>
                </div>

                <div style={styles.cardFooter}>
                  {item.is_completed ? (
                    <span style={styles.completedBadge}>
                      ✓ Completed {item.completed_at && `on ${new Date(item.completed_at).toLocaleDateString()}`}
                    </span>
                  ) : (
                    <span style={styles.startedText}>
                      Started {new Date(item.created_at).toLocaleDateString()}
                    </span>
                  )}

                  <Link to={`/tutorials/${item.slug}`} style={styles.continueBtn}>
                    {item.is_completed ? 'Review' : 'Continue'}
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    padding: '24px',
    maxWidth: '900px',
    margin: '0 auto',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  header: {
    marginBottom: '32px'
  },
  title: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#111827',
    margin: 0
  },
  subtitle: {
    color: '#6b7280',
    marginTop: '4px'
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '16px',
    marginBottom: '32px'
  },
  statCard: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '12px',
    textAlign: 'center',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  },
  statCardProgress: {
    backgroundColor: '#dbeafe'
  },
  statCardCompleted: {
    backgroundColor: '#dcfce7'
  },
  statValue: {
    display: 'block',
    fontSize: '32px',
    fontWeight: '700',
    color: '#111827'
  },
  statLabel: {
    fontSize: '14px',
    color: '#6b7280'
  },
  filters: {
    display: 'flex',
    gap: '8px',
    marginBottom: '24px'
  },
  filterTab: {
    padding: '8px 16px',
    border: '1px solid #e5e7eb',
    backgroundColor: 'white',
    borderRadius: '20px',
    cursor: 'pointer',
    fontSize: '14px',
    color: '#374151'
  },
  filterTabActive: {
    backgroundColor: '#3b82f6',
    color: 'white',
    borderColor: '#3b82f6'
  },
  loading: {
    textAlign: 'center',
    padding: '60px',
    color: '#6b7280'
  },
  empty: {
    textAlign: 'center',
    padding: '60px',
    backgroundColor: 'white',
    borderRadius: '12px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  },
  exploreBtn: {
    display: 'inline-block',
    marginTop: '16px',
    padding: '10px 20px',
    backgroundColor: '#3b82f6',
    color: 'white',
    textDecoration: 'none',
    borderRadius: '6px'
  },
  progressList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  progressCard: {
    backgroundColor: 'white',
    borderRadius: '12px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    overflow: 'hidden'
  },
  cardContent: {
    padding: '20px'
  },
  cardHeader: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
    marginBottom: '12px'
  },
  difficultyBadge: {
    padding: '4px 10px',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: '600',
    color: 'white',
    textTransform: 'uppercase'
  },
  duration: {
    fontSize: '13px',
    color: '#6b7280'
  },
  tutorialTitle: {
    display: 'block',
    fontSize: '18px',
    fontWeight: '600',
    color: '#111827',
    textDecoration: 'none',
    marginBottom: '16px'
  },
  progressInfo: {
    marginBottom: '16px'
  },
  progressBar: {
    height: '8px',
    backgroundColor: '#e5e7eb',
    borderRadius: '4px',
    overflow: 'hidden',
    marginBottom: '8px'
  },
  progressFill: {
    height: '100%',
    borderRadius: '4px',
    transition: 'width 0.3s'
  },
  progressText: {
    fontSize: '13px',
    color: '#6b7280'
  },
  cardFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: '16px',
    borderTop: '1px solid #f3f4f6'
  },
  completedBadge: {
    color: '#22c55e',
    fontSize: '14px',
    fontWeight: '500'
  },
  startedText: {
    color: '#6b7280',
    fontSize: '13px'
  },
  continueBtn: {
    padding: '8px 16px',
    backgroundColor: '#3b82f6',
    color: 'white',
    textDecoration: 'none',
    borderRadius: '6px',
    fontSize: '14px'
  }
};

export default TutorialProgress;
