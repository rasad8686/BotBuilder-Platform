import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { FileText, Star, Clock, Eye, CheckCircle } from 'lucide-react';

const DIFFICULTY_LEVELS = [
  { value: '', label: 'All Levels', color: '#6b7280' },
  { value: 'beginner', label: 'Beginner', color: '#22c55e' },
  { value: 'intermediate', label: 'Intermediate', color: '#f59e0b' },
  { value: 'advanced', label: 'Advanced', color: '#ef4444' }
];

function TutorialsList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tutorials, setTutorials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [myProgress, setMyProgress] = useState([]);

  const currentDifficulty = searchParams.get('difficulty') || '';
  const currentPage = parseInt(searchParams.get('page')) || 1;
  const searchQuery = searchParams.get('search') || '';

  const fetchTutorials = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/blog/tutorials', {
        params: {
          page: currentPage,
          limit: 12,
          difficulty: currentDifficulty || undefined,
          search: searchQuery || undefined
        }
      });
      setTutorials(response.data.data || []);
      setPagination(response.data.pagination || { page: 1, pages: 1, total: 0 });
    } catch (error) {
      console.error('Failed to fetch tutorials:', error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, currentDifficulty, searchQuery]);

  const fetchMyProgress = useCallback(async () => {
    try {
      const response = await axios.get('/api/blog/tutorials/my/progress');
      setMyProgress(response.data.data || []);
    } catch (error) {
      // User might not be logged in
      console.log('Could not fetch progress');
    }
  }, []);

  useEffect(() => {
    fetchTutorials();
    fetchMyProgress();
  }, [fetchTutorials, fetchMyProgress]);

  const handleDifficultyChange = (difficulty) => {
    const params = new URLSearchParams(searchParams);
    if (difficulty) {
      params.set('difficulty', difficulty);
    } else {
      params.delete('difficulty');
    }
    params.delete('page');
    setSearchParams(params);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const search = formData.get('search');
    const params = new URLSearchParams(searchParams);
    if (search) {
      params.set('search', search);
    } else {
      params.delete('search');
    }
    params.delete('page');
    setSearchParams(params);
  };

  const handlePageChange = (page) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', page.toString());
    setSearchParams(params);
    window.scrollTo(0, 0);
  };

  const getProgress = (tutorialId) => {
    const progress = myProgress.find(p => p.tutorial_id === tutorialId);
    return progress ? progress.progress_percent : 0;
  };

  const getDifficultyColor = (difficulty) => {
    const level = DIFFICULTY_LEVELS.find(d => d.value === difficulty);
    return level?.color || '#6b7280';
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>Tutorials</h1>
        <p style={styles.subtitle}>Step-by-step guides to master bot building</p>
      </div>

      {/* Filters */}
      <div style={styles.filters}>
        <div style={styles.difficultyTabs}>
          {DIFFICULTY_LEVELS.map(level => (
            <button
              key={level.value}
              onClick={() => handleDifficultyChange(level.value)}
              style={{
                ...styles.difficultyTab,
                ...(currentDifficulty === level.value ? {
                  backgroundColor: level.color,
                  color: 'white',
                  borderColor: level.color
                } : {})
              }}
            >
              {level.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSearch} style={styles.searchForm}>
          <input
            type="text"
            name="search"
            placeholder="Search tutorials..."
            defaultValue={searchQuery}
            style={styles.searchInput}
          />
          <button type="submit" style={styles.searchBtn}>Search</button>
        </form>
      </div>

      {/* Tutorials Grid */}
      {loading ? (
        <div style={styles.loading}>Loading tutorials...</div>
      ) : tutorials.length === 0 ? (
        <div style={styles.empty}>
          <p>No tutorials found</p>
          {(currentDifficulty || searchQuery) && (
            <button
              onClick={() => setSearchParams({})}
              style={styles.clearBtn}
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div style={styles.tutorialsGrid}>
          {tutorials.map(tutorial => {
            const progress = getProgress(tutorial.id);

            return (
              <Link key={tutorial.id} to={`/tutorials/${tutorial.slug}`} style={styles.tutorialCard}>
                <div style={styles.cardHeader}>
                  <span
                    style={{
                      ...styles.difficultyBadge,
                      backgroundColor: getDifficultyColor(tutorial.difficulty)
                    }}
                  >
                    {tutorial.difficulty}
                  </span>
                  <span style={styles.duration}>
                    <Clock size={13} style={{ display: 'inline', marginRight: '4px' }} /> {tutorial.estimated_time} min
                  </span>
                </div>

                <h3 style={styles.tutorialTitle}>{tutorial.title}</h3>
                <p style={styles.tutorialDescription}>{tutorial.description}</p>

                <div style={styles.tutorialMeta}>
                  <span style={styles.stepsCount}>
                    <FileText size={14} className="inline mr-1" />{tutorial.steps_count} steps
                  </span>
                  {tutorial.rating > 0 && (
                    <span style={styles.rating}>
                      <Star size={14} className="inline mr-1" />{parseFloat(tutorial.rating).toFixed(1)}
                    </span>
                  )}
                </div>

                {progress > 0 && (
                  <div style={styles.progressContainer}>
                    <div style={styles.progressBar}>
                      <div
                        style={{
                          ...styles.progressFill,
                          width: `${progress}%`
                        }}
                      />
                    </div>
                    <span style={styles.progressText}>
                      {progress === 100 ? 'Completed ✓' : `${Math.round(progress)}% complete`}
                    </span>
                  </div>
                )}

                <div style={styles.cardFooter}>
                  <span style={styles.authorName}>By {tutorial.author_name}</span>
                  <div style={styles.stats}>
                    <span><Eye size={12} style={{ display: 'inline', marginRight: '2px' }} /> {tutorial.views_count}</span>
                    <span><CheckCircle size={12} style={{ display: 'inline', marginRight: '2px' }} /> {tutorial.completions_count}</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div style={styles.pagination}>
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            style={styles.pageBtn}
          >
            Previous
          </button>
          <span style={styles.pageInfo}>
            Page {currentPage} of {pagination.pages}
          </span>
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage >= pagination.pages}
            style={styles.pageBtn}
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
    padding: '24px',
    maxWidth: '1200px',
    margin: '0 auto',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  header: {
    textAlign: 'center',
    marginBottom: '40px'
  },
  title: {
    fontSize: '36px',
    fontWeight: '700',
    color: '#111827',
    margin: 0
  },
  subtitle: {
    color: '#6b7280',
    fontSize: '18px',
    marginTop: '8px'
  },
  filters: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
    flexWrap: 'wrap',
    gap: '16px'
  },
  difficultyTabs: {
    display: 'flex',
    gap: '8px'
  },
  difficultyTab: {
    padding: '8px 16px',
    border: '1px solid #e5e7eb',
    backgroundColor: 'white',
    borderRadius: '20px',
    cursor: 'pointer',
    fontSize: '14px',
    color: '#374151',
    transition: 'all 0.2s'
  },
  searchForm: {
    display: 'flex',
    gap: '8px'
  },
  searchInput: {
    padding: '8px 16px',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    fontSize: '14px',
    width: '200px'
  },
  searchBtn: {
    padding: '8px 16px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px'
  },
  loading: {
    textAlign: 'center',
    padding: '60px',
    color: '#6b7280'
  },
  empty: {
    textAlign: 'center',
    padding: '60px',
    color: '#6b7280'
  },
  clearBtn: {
    marginTop: '16px',
    padding: '8px 16px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer'
  },
  tutorialsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '24px'
  },
  tutorialCard: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    textDecoration: 'none',
    color: 'inherit',
    transition: 'transform 0.2s, box-shadow 0.2s',
    display: 'flex',
    flexDirection: 'column'
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
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
    fontSize: '18px',
    fontWeight: '600',
    margin: '0 0 8px 0',
    color: '#111827',
    lineHeight: 1.4
  },
  tutorialDescription: {
    fontSize: '14px',
    color: '#6b7280',
    margin: '0 0 12px 0',
    lineHeight: 1.5,
    flex: 1
  },
  tutorialMeta: {
    display: 'flex',
    gap: '16px',
    marginBottom: '12px',
    fontSize: '13px',
    color: '#374151'
  },
  stepsCount: {},
  rating: {
    color: '#f59e0b'
  },
  progressContainer: {
    marginBottom: '12px'
  },
  progressBar: {
    height: '6px',
    backgroundColor: '#e5e7eb',
    borderRadius: '3px',
    overflow: 'hidden',
    marginBottom: '4px'
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#22c55e',
    borderRadius: '3px',
    transition: 'width 0.3s'
  },
  progressText: {
    fontSize: '12px',
    color: '#22c55e',
    fontWeight: '500'
  },
  cardFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: '12px',
    borderTop: '1px solid #f3f4f6'
  },
  authorName: {
    fontSize: '13px',
    color: '#374151'
  },
  stats: {
    display: 'flex',
    gap: '12px',
    fontSize: '12px',
    color: '#9ca3af'
  },
  pagination: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '16px',
    marginTop: '40px'
  },
  pageBtn: {
    padding: '8px 16px',
    border: '1px solid #e5e7eb',
    backgroundColor: 'white',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px'
  },
  pageInfo: {
    fontSize: '14px',
    color: '#6b7280'
  }
};

export default TutorialsList;
