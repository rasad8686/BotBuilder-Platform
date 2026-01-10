/**
 * @fileoverview Forum Topic Page
 * @description Shows a topic with its replies
 */

import React, { useState, useEffect, useContext } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { AuthContext } from '../../context/AuthContext';

const BADGE_COLORS = {
  newcomer: { bg: '#e5e7eb', text: '#374151' },
  contributor: { bg: '#dbeafe', text: '#1d4ed8' },
  active: { bg: '#dcfce7', text: '#15803d' },
  trusted: { bg: '#fef3c7', text: '#b45309' },
  expert: { bg: '#ede9fe', text: '#7c3aed' },
  legend: { bg: '#fce7f3', text: '#be185d' }
};

export default function ForumTopic() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const [topic, setTopic] = useState(null);
  const [replies, setReplies] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [replyContent, setReplyContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);

  useEffect(() => {
    loadTopic();
  }, [slug]);

  const loadTopic = async () => {
    try {
      setLoading(true);
      const topicRes = await api.get(`/api/forum/topics/${slug}`);
      setTopic(topicRes.data.data);

      const repliesRes = await api.get(`/api/forum/topics/${topicRes.data.data.id}/replies`);
      setReplies(repliesRes.data.data || []);
      setPagination(repliesRes.data.pagination);
    } catch (err) {
      if (err.response?.status === 404) {
        setError('Topic not found');
      } else {
        setError('Failed to load topic');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLikeTopic = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    try {
      const res = await api.post(`/api/forum/topics/${topic.id}/like`);
      setTopic(prev => ({
        ...prev,
        userLiked: res.data.data.liked,
        likes_count: prev.likes_count + (res.data.data.liked ? 1 : -1)
      }));
    } catch (err) {
      console.error('Failed to toggle like:', err);
    }
  };

  const handleLikeReply = async (replyId) => {
    if (!user) {
      navigate('/login');
      return;
    }
    try {
      const res = await api.post(`/api/forum/replies/${replyId}/like`);
      setReplies(prev => prev.map(r =>
        r.id === replyId
          ? { ...r, likes_count: r.likes_count + (res.data.data.liked ? 1 : -1) }
          : r
      ));
    } catch (err) {
      console.error('Failed to toggle like:', err);
    }
  };

  const handleSubmitReply = async (e) => {
    e.preventDefault();
    if (!replyContent.trim() || submitting) return;

    try {
      setSubmitting(true);
      const res = await api.post(`/api/forum/topics/${topic.id}/replies`, {
        content: replyContent,
        parent_reply_id: replyingTo?.id
      });

      setReplies(prev => [...prev, res.data.data]);
      setReplyContent('');
      setReplyingTo(null);
      setTopic(prev => ({ ...prev, replies_count: prev.replies_count + 1 }));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to post reply');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkSolution = async (replyId) => {
    try {
      await api.post(`/api/forum/topics/${topic.id}/solution/${replyId}`);
      setTopic(prev => ({ ...prev, is_solved: true, solution_reply_id: replyId }));
      setReplies(prev => prev.map(r => ({
        ...r,
        is_solution: r.id === replyId
      })));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to mark as solution');
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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

  const isAuthor = user?.id === topic?.user_id;
  const canMarkSolution = isAuthor && !topic?.is_solved;

  return (
    <div style={styles.container}>
      {/* Breadcrumb */}
      <div style={styles.breadcrumb}>
        <Link to="/forum" style={styles.breadcrumbLink}>Forum</Link>
        <span style={styles.breadcrumbSep}>/</span>
        <Link to={`/forum/category/${topic?.category_slug}`} style={styles.breadcrumbLink}>
          {topic?.category_name}
        </Link>
        <span style={styles.breadcrumbSep}>/</span>
        <span style={styles.breadcrumbCurrent}>{topic?.title?.substring(0, 50)}...</span>
      </div>

      {/* Topic */}
      <div style={styles.topicCard}>
        <div style={styles.topicHeader}>
          <div style={styles.badges}>
            {topic?.is_pinned && <span style={styles.pinnedBadge}>Pinned</span>}
            {topic?.is_locked && <span style={styles.lockedBadge}>Locked</span>}
            {topic?.is_solved && <span style={styles.solvedBadge}>Solved</span>}
          </div>
          <h1 style={styles.topicTitle}>{topic?.title}</h1>
          <div style={styles.topicMeta}>
            <Link to={`/forum/user/${topic?.user_id}`} style={styles.authorLink}>
              {topic?.author_name}
            </Link>
            <span style={styles.topicDate}>{formatDate(topic?.created_at)}</span>
            <span style={styles.viewCount}>{topic?.views_count} views</span>
          </div>
        </div>

        <div style={styles.topicContent}>
          {topic?.content}
        </div>

        {topic?.tags && JSON.parse(topic.tags || '[]').length > 0 && (
          <div style={styles.tagsList}>
            {JSON.parse(topic.tags).map((tag, i) => (
              <span key={i} style={styles.tag}>{tag}</span>
            ))}
          </div>
        )}

        <div style={styles.topicActions}>
          <button
            onClick={handleLikeTopic}
            style={{
              ...styles.likeButton,
              backgroundColor: topic?.userLiked ? '#dbeafe' : 'transparent'
            }}
          >
            {topic?.likes_count} Likes
          </button>
          {user && (
            <button onClick={() => setReplyingTo(null)} style={styles.replyButton}>
              Reply
            </button>
          )}
        </div>
      </div>

      {/* Replies */}
      <div style={styles.repliesSection}>
        <h2 style={styles.repliesTitle}>
          {replies.length} {replies.length === 1 ? 'Reply' : 'Replies'}
        </h2>

        {replies.map(reply => (
          <div
            key={reply.id}
            style={{
              ...styles.replyCard,
              ...(reply.is_solution ? styles.solutionCard : {})
            }}
          >
            {reply.is_solution && (
              <div style={styles.solutionBanner}>
                Accepted Solution
              </div>
            )}

            <div style={styles.replyHeader}>
              <div style={styles.replyAuthor}>
                <Link to={`/forum/user/${reply.user_id}`} style={styles.authorLink}>
                  {reply.author_name}
                </Link>
                {reply.author_badge && (
                  <span style={{
                    ...styles.userBadge,
                    backgroundColor: BADGE_COLORS[reply.author_badge]?.bg,
                    color: BADGE_COLORS[reply.author_badge]?.text
                  }}>
                    {reply.author_badge}
                  </span>
                )}
                {reply.author_reputation > 0 && (
                  <span style={styles.reputation}>{reply.author_reputation} rep</span>
                )}
              </div>
              <div style={styles.replyDate}>
                {formatDate(reply.created_at)}
                {reply.is_edited && <span style={styles.editedLabel}>(edited)</span>}
              </div>
            </div>

            {reply.parent_reply_id && (
              <div style={styles.replyToIndicator}>
                Replying to a previous comment
              </div>
            )}

            <div style={styles.replyContent}>
              {reply.content}
            </div>

            <div style={styles.replyActions}>
              <button onClick={() => handleLikeReply(reply.id)} style={styles.likeButton}>
                {reply.likes_count} Likes
              </button>
              {user && !topic?.is_locked && (
                <button onClick={() => setReplyingTo(reply)} style={styles.replyButton}>
                  Reply
                </button>
              )}
              {canMarkSolution && !reply.is_solution && (
                <button onClick={() => handleMarkSolution(reply.id)} style={styles.solutionButton}>
                  Mark as Solution
                </button>
              )}
            </div>
          </div>
        ))}

        {/* Reply Form */}
        {user && !topic?.is_locked ? (
          <form onSubmit={handleSubmitReply} style={styles.replyForm}>
            <h3 style={styles.replyFormTitle}>
              {replyingTo ? `Replying to ${replyingTo.author_name}` : 'Post a Reply'}
              {replyingTo && (
                <button
                  type="button"
                  onClick={() => setReplyingTo(null)}
                  style={styles.cancelReplyButton}
                >
                  Cancel
                </button>
              )}
            </h3>
            <textarea
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder="Write your reply..."
              style={styles.replyTextarea}
              rows={6}
            />
            <div style={styles.replyFormActions}>
              <button
                type="submit"
                disabled={!replyContent.trim() || submitting}
                style={{
                  ...styles.submitButton,
                  opacity: !replyContent.trim() || submitting ? 0.5 : 1
                }}
              >
                {submitting ? 'Posting...' : 'Post Reply'}
              </button>
            </div>
          </form>
        ) : topic?.is_locked ? (
          <div style={styles.lockedNotice}>
            This topic is locked. No new replies can be posted.
          </div>
        ) : (
          <div style={styles.loginNotice}>
            <Link to="/login">Log in</Link> to post a reply.
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
    fontSize: '14px',
    flexWrap: 'wrap'
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
  topicCard: {
    backgroundColor: 'white',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
    padding: '24px',
    marginBottom: '24px'
  },
  topicHeader: {
    marginBottom: '20px'
  },
  badges: {
    display: 'flex',
    gap: '8px',
    marginBottom: '12px'
  },
  topicTitle: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#111827',
    margin: '0 0 12px 0',
    lineHeight: '1.3'
  },
  topicMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    fontSize: '14px'
  },
  authorLink: {
    color: '#3b82f6',
    textDecoration: 'none',
    fontWeight: '500'
  },
  topicDate: {
    color: '#6b7280'
  },
  viewCount: {
    color: '#9ca3af'
  },
  topicContent: {
    fontSize: '15px',
    lineHeight: '1.7',
    color: '#374151',
    whiteSpace: 'pre-wrap'
  },
  tagsList: {
    display: 'flex',
    gap: '8px',
    marginTop: '20px',
    flexWrap: 'wrap'
  },
  tag: {
    padding: '4px 12px',
    backgroundColor: '#e5e7eb',
    color: '#374151',
    borderRadius: '6px',
    fontSize: '13px'
  },
  topicActions: {
    display: 'flex',
    gap: '12px',
    marginTop: '20px',
    paddingTop: '20px',
    borderTop: '1px solid #e5e7eb'
  },
  likeButton: {
    padding: '8px 16px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    fontSize: '13px'
  },
  replyButton: {
    padding: '8px 16px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    fontSize: '13px'
  },
  repliesSection: {
    marginTop: '32px'
  },
  repliesTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#111827',
    marginBottom: '16px'
  },
  replyCard: {
    backgroundColor: 'white',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    padding: '20px',
    marginBottom: '12px'
  },
  solutionCard: {
    borderColor: '#22c55e',
    borderWidth: '2px'
  },
  solutionBanner: {
    backgroundColor: '#dcfce7',
    color: '#15803d',
    padding: '8px 16px',
    margin: '-20px -20px 16px -20px',
    borderRadius: '6px 6px 0 0',
    fontSize: '13px',
    fontWeight: '600'
  },
  replyHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px'
  },
  replyAuthor: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  userBadge: {
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '500',
    textTransform: 'capitalize'
  },
  reputation: {
    fontSize: '12px',
    color: '#6b7280'
  },
  replyDate: {
    fontSize: '12px',
    color: '#9ca3af'
  },
  editedLabel: {
    marginLeft: '8px',
    fontStyle: 'italic'
  },
  replyToIndicator: {
    fontSize: '12px',
    color: '#6b7280',
    marginBottom: '12px',
    paddingLeft: '12px',
    borderLeft: '2px solid #d1d5db'
  },
  replyContent: {
    fontSize: '14px',
    lineHeight: '1.6',
    color: '#374151',
    whiteSpace: 'pre-wrap'
  },
  replyActions: {
    display: 'flex',
    gap: '12px',
    marginTop: '16px'
  },
  solutionButton: {
    padding: '8px 16px',
    backgroundColor: '#dcfce7',
    color: '#15803d',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500'
  },
  replyForm: {
    backgroundColor: 'white',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    padding: '20px',
    marginTop: '24px'
  },
  replyFormTitle: {
    fontSize: '16px',
    fontWeight: '600',
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  cancelReplyButton: {
    padding: '4px 8px',
    fontSize: '12px',
    backgroundColor: '#f3f4f6',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    color: '#6b7280'
  },
  replyTextarea: {
    width: '100%',
    padding: '12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    resize: 'vertical',
    fontFamily: 'inherit'
  },
  replyFormActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: '12px'
  },
  submitButton: {
    padding: '10px 24px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500'
  },
  lockedNotice: {
    textAlign: 'center',
    padding: '20px',
    backgroundColor: '#fef3c7',
    color: '#b45309',
    borderRadius: '8px',
    marginTop: '24px'
  },
  loginNotice: {
    textAlign: 'center',
    padding: '20px',
    backgroundColor: '#f3f4f6',
    borderRadius: '8px',
    marginTop: '24px',
    color: '#6b7280'
  },
  pinnedBadge: {
    padding: '4px 8px',
    backgroundColor: '#fef3c7',
    color: '#b45309',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '600',
    textTransform: 'uppercase'
  },
  lockedBadge: {
    padding: '4px 8px',
    backgroundColor: '#fee2e2',
    color: '#dc2626',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '600',
    textTransform: 'uppercase'
  },
  solvedBadge: {
    padding: '4px 8px',
    backgroundColor: '#dcfce7',
    color: '#15803d',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '600',
    textTransform: 'uppercase'
  },
  backLink: {
    color: '#3b82f6',
    textDecoration: 'none',
    marginTop: '16px',
    display: 'inline-block'
  }
};
