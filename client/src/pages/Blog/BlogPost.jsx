import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { Heart, Eye, MessageCircle } from 'lucide-react';

function BlogPost() {
  const { slug } = useParams();
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [relatedPosts, setRelatedPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchPost = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/blog/${slug}`);
      setPost(response.data.data);
      setRelatedPosts(response.data.relatedPosts || []);
    } catch (error) {
      console.error('Failed to fetch post:', error);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  const fetchComments = useCallback(async () => {
    try {
      const response = await axios.get(`/api/blog/${slug}/comments`);
      setComments(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch comments:', error);
    }
  }, [slug]);

  useEffect(() => {
    fetchPost();
    fetchComments();
  }, [fetchPost, fetchComments]);

  const handleLike = async () => {
    try {
      const response = await axios.post(`/api/blog/${slug}/like`);
      setPost(prev => ({ ...prev, likes_count: response.data.likes_count }));
    } catch (error) {
      console.error('Failed to like post:', error);
    }
  };

  const handleComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    try {
      setSubmitting(true);
      await axios.post(`/api/blog/${slug}/comments`, {
        content: commentText,
        parentCommentId: replyTo
      });
      setCommentText('');
      setReplyTo(null);
      fetchComments();
    } catch (error) {
      console.error('Failed to add comment:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const renderComment = (comment, depth = 0) => (
    <div
      key={comment.id}
      style={{ ...styles.comment, marginLeft: depth * 24 }}
    >
      <div style={styles.commentHeader}>
        {comment.user_avatar && (
          <img src={comment.user_avatar} alt="" style={styles.commentAvatar} />
        )}
        <div>
          <span style={styles.commentAuthor}>{comment.user_name || 'Anonymous'}</span>
          <span style={styles.commentDate}>{formatDate(comment.created_at)}</span>
        </div>
      </div>
      <p style={styles.commentContent}>{comment.content}</p>
      <button
        onClick={() => setReplyTo(comment.id)}
        style={styles.replyBtn}
      >
        Reply
      </button>
      {comment.replies && comment.replies.map(reply => renderComment(reply, depth + 1))}
    </div>
  );

  if (loading) {
    return <div style={styles.loading}>Loading...</div>;
  }

  if (!post) {
    return (
      <div style={styles.notFound}>
        <h2>Post not found</h2>
        <Link to="/blog" style={styles.backLink}>Back to Blog</Link>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Article Header */}
      <article style={styles.article}>
        <header style={styles.header}>
          <Link to="/blog" style={styles.backLink}>Back to Blog</Link>

          <div style={styles.meta}>
            <span style={styles.category}>{post.category}</span>
            <span style={styles.date}>{formatDate(post.published_at)}</span>
            <span style={styles.readTime}>{post.reading_time} min read</span>
          </div>

          <h1 style={styles.title}>{post.title}</h1>

          {post.excerpt && (
            <p style={styles.excerpt}>{post.excerpt}</p>
          )}

          <div style={styles.authorBox}>
            {post.author_avatar && (
              <img src={post.author_avatar} alt="" style={styles.authorAvatar} />
            )}
            <div>
              <div style={styles.authorName}>{post.author_name}</div>
              <div style={styles.authorEmail}>{post.author_email}</div>
            </div>
          </div>
        </header>

        {post.featured_image && (
          <img
            src={post.featured_image}
            alt={post.title}
            style={styles.featuredImage}
          />
        )}

        {/* Content */}
        <div
          style={styles.content}
          dangerouslySetInnerHTML={{ __html: post.content }}
        />

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div style={styles.tags}>
            {(typeof post.tags === 'string' ? JSON.parse(post.tags) : post.tags).map((tag, idx) => (
              <Link key={idx} to={`/blog?tag=${tag}`} style={styles.tag}>
                #{tag}
              </Link>
            ))}
          </div>
        )}

        {/* Actions */}
        <div style={styles.actions}>
          <button onClick={handleLike} style={styles.likeBtn}>
            <Heart size={14} style={{ display: 'inline', marginRight: '4px' }} /> {post.likes_count} Likes
          </button>
          <span style={styles.views}><Eye size={14} style={{ display: 'inline', marginRight: '4px' }} /> {post.views_count} Views</span>
          <span style={styles.commentCount}><MessageCircle size={14} style={{ display: 'inline', marginRight: '4px' }} /> {post.comments_count} Comments</span>
        </div>
      </article>

      {/* Related Posts */}
      {relatedPosts.length > 0 && (
        <div style={styles.relatedSection}>
          <h3 style={styles.relatedTitle}>Related Posts</h3>
          <div style={styles.relatedGrid}>
            {relatedPosts.map(related => (
              <Link key={related.id} to={`/blog/${related.slug}`} style={styles.relatedCard}>
                {related.featured_image && (
                  <img src={related.featured_image} alt="" style={styles.relatedImage} />
                )}
                <div style={styles.relatedContent}>
                  <h4>{related.title}</h4>
                  <span>{related.reading_time} min read</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Comments Section */}
      <div style={styles.commentsSection}>
        <h3 style={styles.commentsTitle}>Comments ({post.comments_count})</h3>

        {/* Comment Form */}
        <form onSubmit={handleComment} style={styles.commentForm}>
          {replyTo && (
            <div style={styles.replyIndicator}>
              Replying to comment...
              <button type="button" onClick={() => setReplyTo(null)} style={styles.cancelReply}>
                Cancel
              </button>
            </div>
          )}
          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Write a comment..."
            style={styles.commentInput}
            rows={3}
          />
          <button
            type="submit"
            disabled={submitting || !commentText.trim()}
            style={styles.submitBtn}
          >
            {submitting ? 'Posting...' : 'Post Comment'}
          </button>
        </form>

        {/* Comments List */}
        <div style={styles.commentsList}>
          {comments.length === 0 ? (
            <p style={styles.noComments}>No comments yet. Be the first to comment!</p>
          ) : (
            comments.map(comment => renderComment(comment))
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: '24px',
    maxWidth: '800px',
    margin: '0 auto',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  loading: {
    textAlign: 'center',
    padding: '60px',
    color: '#6b7280'
  },
  notFound: {
    textAlign: 'center',
    padding: '60px'
  },
  article: {
    backgroundColor: 'white',
    borderRadius: '12px',
    overflow: 'hidden',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  },
  header: {
    padding: '32px'
  },
  backLink: {
    color: '#3b82f6',
    textDecoration: 'none',
    fontSize: '14px',
    display: 'inline-block',
    marginBottom: '16px'
  },
  meta: {
    display: 'flex',
    gap: '16px',
    marginBottom: '16px',
    fontSize: '14px'
  },
  category: {
    color: '#3b82f6',
    fontWeight: '600',
    textTransform: 'uppercase'
  },
  date: {
    color: '#6b7280'
  },
  readTime: {
    color: '#6b7280'
  },
  title: {
    fontSize: '36px',
    fontWeight: '700',
    color: '#111827',
    margin: '0 0 16px 0',
    lineHeight: 1.3
  },
  excerpt: {
    fontSize: '18px',
    color: '#6b7280',
    lineHeight: 1.6,
    marginBottom: '24px'
  },
  authorBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  authorAvatar: {
    width: '48px',
    height: '48px',
    borderRadius: '50%'
  },
  authorName: {
    fontWeight: '600',
    color: '#111827'
  },
  authorEmail: {
    fontSize: '14px',
    color: '#6b7280'
  },
  featuredImage: {
    width: '100%',
    maxHeight: '400px',
    objectFit: 'cover'
  },
  content: {
    padding: '32px',
    fontSize: '17px',
    lineHeight: 1.8,
    color: '#374151'
  },
  tags: {
    padding: '0 32px 24px',
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap'
  },
  tag: {
    padding: '4px 12px',
    backgroundColor: '#f3f4f6',
    borderRadius: '16px',
    fontSize: '13px',
    color: '#374151',
    textDecoration: 'none'
  },
  actions: {
    padding: '24px 32px',
    borderTop: '1px solid #f3f4f6',
    display: 'flex',
    gap: '24px',
    alignItems: 'center'
  },
  likeBtn: {
    padding: '8px 16px',
    backgroundColor: '#fef2f2',
    border: 'none',
    borderRadius: '20px',
    cursor: 'pointer',
    fontSize: '14px',
    color: '#dc2626'
  },
  views: {
    fontSize: '14px',
    color: '#6b7280'
  },
  commentCount: {
    fontSize: '14px',
    color: '#6b7280'
  },
  relatedSection: {
    marginTop: '40px'
  },
  relatedTitle: {
    fontSize: '20px',
    fontWeight: '600',
    marginBottom: '16px',
    color: '#111827'
  },
  relatedGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '16px'
  },
  relatedCard: {
    backgroundColor: 'white',
    borderRadius: '8px',
    overflow: 'hidden',
    textDecoration: 'none',
    color: 'inherit',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  },
  relatedImage: {
    width: '100%',
    height: '100px',
    objectFit: 'cover'
  },
  relatedContent: {
    padding: '12px'
  },
  commentsSection: {
    marginTop: '40px',
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  },
  commentsTitle: {
    fontSize: '20px',
    fontWeight: '600',
    marginBottom: '24px',
    color: '#111827'
  },
  commentForm: {
    marginBottom: '24px'
  },
  replyIndicator: {
    padding: '8px 12px',
    backgroundColor: '#eff6ff',
    borderRadius: '6px',
    marginBottom: '8px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '14px',
    color: '#3b82f6'
  },
  cancelReply: {
    background: 'none',
    border: 'none',
    color: '#dc2626',
    cursor: 'pointer',
    fontSize: '13px'
  },
  commentInput: {
    width: '100%',
    padding: '12px',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    fontSize: '14px',
    resize: 'vertical',
    boxSizing: 'border-box'
  },
  submitBtn: {
    marginTop: '8px',
    padding: '10px 20px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px'
  },
  commentsList: {
    borderTop: '1px solid #f3f4f6',
    paddingTop: '24px'
  },
  noComments: {
    textAlign: 'center',
    color: '#6b7280',
    padding: '24px'
  },
  comment: {
    padding: '16px',
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
    marginBottom: '12px'
  },
  commentHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '8px'
  },
  commentAvatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%'
  },
  commentAuthor: {
    fontWeight: '600',
    color: '#111827',
    marginRight: '8px'
  },
  commentDate: {
    fontSize: '12px',
    color: '#9ca3af'
  },
  commentContent: {
    fontSize: '14px',
    color: '#374151',
    lineHeight: 1.6,
    margin: '0 0 8px 0'
  },
  replyBtn: {
    background: 'none',
    border: 'none',
    color: '#3b82f6',
    cursor: 'pointer',
    fontSize: '13px'
  }
};

export default BlogPost;
