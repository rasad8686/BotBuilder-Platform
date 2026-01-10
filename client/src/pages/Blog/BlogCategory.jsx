import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Newspaper, BookOpen, BarChart3, Megaphone, FileText, Eye, Heart } from 'lucide-react';

const CATEGORY_INFO = {
  news: { title: 'News', description: 'Latest updates and announcements', Icon: Newspaper },
  tutorial: { title: 'Tutorials', description: 'Learn how to build amazing bots', Icon: BookOpen },
  'case-study': { title: 'Case Studies', description: 'Real-world success stories', Icon: BarChart3 },
  announcement: { title: 'Announcements', description: 'Important product updates', Icon: Megaphone }
};

function BlogCategory() {
  const { category } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });

  const currentPage = parseInt(searchParams.get('page')) || 1;
  const categoryInfo = CATEGORY_INFO[category] || { title: category, description: '', Icon: FileText };

  const fetchPosts = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/blog', {
        params: {
          page: currentPage,
          limit: 12,
          category
        }
      });
      setPosts(response.data.data || []);
      setPagination(response.data.pagination || { page: 1, pages: 1, total: 0 });
    } catch (error) {
      console.error('Failed to fetch posts:', error);
    } finally {
      setLoading(false);
    }
  }, [category, currentPage]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

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
        <Link to="/blog" style={styles.backLink}>← Back to Blog</Link>
        <div style={styles.categoryHeader}>
          <span style={styles.categoryIcon}>{categoryInfo.Icon && <categoryInfo.Icon size={48} />}</span>
          <div>
            <h1 style={styles.title}>{categoryInfo.title}</h1>
            <p style={styles.description}>{categoryInfo.description}</p>
          </div>
        </div>
        <div style={styles.stats}>
          {pagination.total} {pagination.total === 1 ? 'post' : 'posts'}
        </div>
      </div>

      {/* Posts */}
      {loading ? (
        <div style={styles.loading}>Loading posts...</div>
      ) : posts.length === 0 ? (
        <div style={styles.empty}>
          <p>No posts in this category yet.</p>
          <Link to="/blog" style={styles.browseLink}>Browse all posts</Link>
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
                  <span style={styles.postDate}>{formatDate(post.published_at)}</span>
                  <span style={styles.readTime}>{post.reading_time} min read</span>
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
                    <span><Eye size={12} style={{ display: 'inline', marginRight: '2px' }} /> {post.views_count}</span>
                    <span><Heart size={12} style={{ display: 'inline', marginRight: '2px' }} /> {post.likes_count}</span>
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

          <div style={styles.pageNumbers}>
            {Array.from({ length: pagination.pages }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                onClick={() => handlePageChange(page)}
                style={{
                  ...styles.pageNumber,
                  ...(page === currentPage ? styles.pageNumberActive : {})
                }}
              >
                {page}
              </button>
            ))}
          </div>

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
    marginBottom: '32px'
  },
  backLink: {
    color: '#3b82f6',
    textDecoration: 'none',
    fontSize: '14px',
    display: 'inline-block',
    marginBottom: '16px'
  },
  categoryHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px'
  },
  categoryIcon: {
    fontSize: '48px'
  },
  title: {
    fontSize: '32px',
    fontWeight: '700',
    color: '#111827',
    margin: 0
  },
  description: {
    color: '#6b7280',
    marginTop: '4px',
    fontSize: '16px'
  },
  stats: {
    marginTop: '16px',
    fontSize: '14px',
    color: '#6b7280'
  },
  loading: {
    textAlign: 'center',
    padding: '60px',
    color: '#6b7280'
  },
  empty: {
    textAlign: 'center',
    padding: '60px',
    backgroundColor: '#f9fafb',
    borderRadius: '12px'
  },
  browseLink: {
    display: 'inline-block',
    marginTop: '16px',
    color: '#3b82f6',
    textDecoration: 'none'
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
    marginBottom: '8px',
    fontSize: '13px',
    color: '#6b7280'
  },
  postDate: {},
  readTime: {},
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
    fontSize: '13px',
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
  pageNumbers: {
    display: 'flex',
    gap: '4px'
  },
  pageNumber: {
    width: '36px',
    height: '36px',
    border: '1px solid #e5e7eb',
    backgroundColor: 'white',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px'
  },
  pageNumberActive: {
    backgroundColor: '#3b82f6',
    color: 'white',
    borderColor: '#3b82f6'
  }
};

export default BlogCategory;
