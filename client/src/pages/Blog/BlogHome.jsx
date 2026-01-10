import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';

const CATEGORIES = [
  { value: '', label: 'All Posts' },
  { value: 'news', label: 'News' },
  { value: 'tutorial', label: 'Tutorials' },
  { value: 'case-study', label: 'Case Studies' },
  { value: 'announcement', label: 'Announcements' }
];

function BlogHome() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [posts, setPosts] = useState([]);
  const [featuredPosts, setFeaturedPosts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });

  const currentCategory = searchParams.get('category') || '';
  const currentPage = parseInt(searchParams.get('page')) || 1;
  const searchQuery = searchParams.get('search') || '';

  const fetchPosts = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/blog', {
        params: {
          page: currentPage,
          limit: 9,
          category: currentCategory || undefined,
          search: searchQuery || undefined
        }
      });
      setPosts(response.data.data || []);
      setPagination(response.data.pagination || { page: 1, pages: 1, total: 0 });
    } catch (error) {
      console.error('Failed to fetch posts:', error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, currentCategory, searchQuery]);

  const fetchFeatured = useCallback(async () => {
    try {
      const response = await axios.get('/api/blog/featured', { params: { limit: 3 } });
      setFeaturedPosts(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch featured posts:', error);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const response = await axios.get('/api/blog/categories');
      setCategories(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  useEffect(() => {
    fetchFeatured();
    fetchCategories();
  }, [fetchFeatured, fetchCategories]);

  const handleCategoryChange = (category) => {
    const params = new URLSearchParams(searchParams);
    if (category) {
      params.set('category', category);
    } else {
      params.delete('category');
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

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>Blog</h1>
        <p style={styles.subtitle}>News, tutorials, and updates from our team</p>
      </div>

      {/* Featured Posts */}
      {!currentCategory && !searchQuery && currentPage === 1 && featuredPosts.length > 0 && (
        <div style={styles.featuredSection}>
          <h2 style={styles.sectionTitle}>Featured Posts</h2>
          <div style={styles.featuredGrid}>
            {featuredPosts.map((post, idx) => (
              <Link
                key={post.id}
                to={`/blog/${post.slug}`}
                style={{
                  ...styles.featuredCard,
                  ...(idx === 0 ? styles.featuredCardLarge : {})
                }}
              >
                {post.featured_image && (
                  <img
                    src={post.featured_image}
                    alt={post.title}
                    style={styles.featuredImage}
                  />
                )}
                <div style={styles.featuredContent}>
                  <span style={styles.categoryBadge}>{post.category}</span>
                  <h3 style={styles.featuredTitle}>{post.title}</h3>
                  <p style={styles.featuredExcerpt}>{post.excerpt}</p>
                  <div style={styles.featuredMeta}>
                    <span>{post.author_name}</span>
                    <span>{post.reading_time} min read</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={styles.filters}>
        <div style={styles.categoryTabs}>
          {CATEGORIES.map(cat => (
            <button
              key={cat.value}
              onClick={() => handleCategoryChange(cat.value)}
              style={{
                ...styles.categoryTab,
                ...(currentCategory === cat.value ? styles.categoryTabActive : {})
              }}
            >
              {cat.label}
              {categories.find(c => c.category === cat.value) && (
                <span style={styles.categoryCount}>
                  {categories.find(c => c.category === cat.value)?.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <form onSubmit={handleSearch} style={styles.searchForm}>
          <input
            type="text"
            name="search"
            placeholder="Search posts..."
            defaultValue={searchQuery}
            style={styles.searchInput}
          />
          <button type="submit" style={styles.searchBtn}>Search</button>
        </form>
      </div>

      {/* Posts Grid */}
      {loading ? (
        <div style={styles.loading}>Loading posts...</div>
      ) : posts.length === 0 ? (
        <div style={styles.empty}>
          <p>No posts found</p>
          {(currentCategory || searchQuery) && (
            <button
              onClick={() => setSearchParams({})}
              style={styles.clearBtn}
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div style={styles.postsGrid}>
          {posts.map(post => (
            <Link key={post.id} to={`/blog/${post.slug}`} style={styles.postCard}>
              {post.featured_image && (
                <img
                  src={post.featured_image}
                  alt={post.title}
                  style={styles.postImage}
                />
              )}
              <div style={styles.postContent}>
                <div style={styles.postMeta}>
                  <span style={styles.postCategory}>{post.category}</span>
                  <span style={styles.postDate}>{formatDate(post.published_at)}</span>
                </div>
                <h3 style={styles.postTitle}>{post.title}</h3>
                <p style={styles.postExcerpt}>{post.excerpt}</p>
                <div style={styles.postFooter}>
                  <div style={styles.authorInfo}>
                    {post.author_avatar && (
                      <img src={post.author_avatar} alt="" style={styles.authorAvatar} />
                    )}
                    <span>{post.author_name}</span>
                  </div>
                  <div style={styles.postStats}>
                    <span>{post.reading_time} min</span>
                    <span>{post.views_count} views</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
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
  featuredSection: {
    marginBottom: '40px'
  },
  sectionTitle: {
    fontSize: '20px',
    fontWeight: '600',
    marginBottom: '16px',
    color: '#111827'
  },
  featuredGrid: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr',
    gap: '16px'
  },
  featuredCard: {
    position: 'relative',
    borderRadius: '12px',
    overflow: 'hidden',
    textDecoration: 'none',
    color: 'inherit',
    backgroundColor: '#f3f4f6',
    minHeight: '200px',
    display: 'flex',
    flexDirection: 'column'
  },
  featuredCardLarge: {
    gridRow: 'span 2',
    minHeight: '416px'
  },
  featuredImage: {
    width: '100%',
    height: '60%',
    objectFit: 'cover'
  },
  featuredContent: {
    padding: '16px',
    flex: 1,
    display: 'flex',
    flexDirection: 'column'
  },
  categoryBadge: {
    display: 'inline-block',
    padding: '4px 10px',
    backgroundColor: '#3b82f6',
    color: 'white',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: '8px',
    width: 'fit-content'
  },
  featuredTitle: {
    fontSize: '18px',
    fontWeight: '600',
    margin: '0 0 8px 0',
    color: '#111827'
  },
  featuredExcerpt: {
    fontSize: '14px',
    color: '#6b7280',
    margin: 0,
    flex: 1
  },
  featuredMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '12px',
    color: '#9ca3af',
    marginTop: '12px'
  },
  filters: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
    flexWrap: 'wrap',
    gap: '16px'
  },
  categoryTabs: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap'
  },
  categoryTab: {
    padding: '8px 16px',
    border: '1px solid #e5e7eb',
    backgroundColor: 'white',
    borderRadius: '20px',
    cursor: 'pointer',
    fontSize: '14px',
    color: '#374151',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'all 0.2s'
  },
  categoryTabActive: {
    backgroundColor: '#3b82f6',
    color: 'white',
    borderColor: '#3b82f6'
  },
  categoryCount: {
    fontSize: '11px',
    backgroundColor: 'rgba(0,0,0,0.1)',
    padding: '2px 6px',
    borderRadius: '10px'
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
  postsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '24px'
  },
  postCard: {
    backgroundColor: 'white',
    borderRadius: '12px',
    overflow: 'hidden',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    textDecoration: 'none',
    color: 'inherit',
    transition: 'transform 0.2s, box-shadow 0.2s'
  },
  postImage: {
    width: '100%',
    height: '180px',
    objectFit: 'cover'
  },
  postContent: {
    padding: '16px'
  },
  postMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px'
  },
  postCategory: {
    fontSize: '11px',
    fontWeight: '600',
    textTransform: 'uppercase',
    color: '#3b82f6'
  },
  postDate: {
    fontSize: '12px',
    color: '#9ca3af'
  },
  postTitle: {
    fontSize: '18px',
    fontWeight: '600',
    margin: '0 0 8px 0',
    color: '#111827',
    lineHeight: 1.4
  },
  postExcerpt: {
    fontSize: '14px',
    color: '#6b7280',
    margin: '0 0 12px 0',
    lineHeight: 1.5
  },
  postFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: '12px',
    borderTop: '1px solid #f3f4f6'
  },
  authorInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    color: '#374151'
  },
  authorAvatar: {
    width: '24px',
    height: '24px',
    borderRadius: '50%'
  },
  postStats: {
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

export default BlogHome;
