import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Chip,
  IconButton,
  Button,
  Grid,
  TextField,
  LinearProgress,
  Paper,
  Avatar,
  Divider,
  Alert,
  Breadcrumbs
} from '@mui/material';
import {
  ThumbUp,
  ThumbUpOutlined,
  Comment,
  Schedule,
  CheckCircle,
  PlayCircle,
  ArrowBack,
  Send,
  Star,
  CalendarMonth,
  Category
} from '@mui/icons-material';
import api from '../../utils/api';

const priorityColors = {
  low: '#8bc34a',
  medium: '#ff9800',
  high: '#f44336',
  critical: '#9c27b0'
};

const statusConfig = {
  planned: { label: 'Planned', icon: <Schedule />, color: '#2196f3' },
  in_progress: { label: 'In Progress', icon: <PlayCircle />, color: '#ff9800' },
  completed: { label: 'Completed', icon: <CheckCircle />, color: '#4caf50' },
  cancelled: { label: 'Cancelled', icon: <Schedule />, color: '#9e9e9e' }
};

function RoadmapItemDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchItem();
    fetchComments();
  }, [slug]);

  const fetchItem = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/roadmap/${slug}`);
      setItem(response.data.item);
      setError(null);
    } catch (err) {
      if (err.response?.status === 404) {
        setError('Roadmap item not found');
      } else {
        setError('Failed to load roadmap item');
      }
      console.error('Fetch item error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    try {
      const response = await api.get(`/api/roadmap/${slug}/comments`);
      setComments(response.data.comments);
    } catch (err) {
      console.error('Fetch comments error:', err);
    }
  };

  const handleVote = async () => {
    if (!item) return;
    try {
      const response = await api.post(`/api/roadmap/${item.id}/vote`);
      setItem(prev => ({
        ...prev,
        votes_count: response.data.votes_count,
        has_voted: response.data.action === 'voted'
      }));
    } catch (err) {
      console.error('Vote error:', err);
    }
  };

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || !item) return;

    try {
      setSubmitting(true);
      const response = await api.post(`/api/roadmap/${item.id}/comments`, {
        content: newComment.trim()
      });
      setComments(prev => [...prev, response.data.comment]);
      setNewComment('');
      setItem(prev => ({
        ...prev,
        comments_count: (prev.comments_count || 0) + 1
      }));
    } catch (err) {
      console.error('Submit comment error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <LinearProgress />
      </Container>
    );
  }

  if (error || !item) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error || 'Item not found'}
        </Alert>
        <Button
          startIcon={<ArrowBack />}
          component={Link}
          to="/roadmap"
        >
          Back to Roadmap
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ mb: 3 }}>
        <Link to="/roadmap" style={{ textDecoration: 'none', color: 'inherit' }}>
          Roadmap
        </Link>
        <Typography color="text.primary">{item.title}</Typography>
      </Breadcrumbs>

      <Grid container spacing={4}>
        {/* Main Content */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3, mb: 3 }}>
            {/* Header */}
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                <Chip
                  icon={statusConfig[item.status]?.icon}
                  label={statusConfig[item.status]?.label}
                  sx={{
                    backgroundColor: statusConfig[item.status]?.color,
                    color: 'white',
                    '& .MuiChip-icon': { color: 'white' }
                  }}
                />
                <Chip
                  label={item.priority}
                  sx={{
                    backgroundColor: priorityColors[item.priority],
                    color: 'white',
                    textTransform: 'capitalize'
                  }}
                />
                {item.category && (
                  <Chip
                    icon={<Category />}
                    label={item.category}
                    variant="outlined"
                  />
                )}
              </Box>

              <Typography variant="h4" gutterBottom>
                {item.title}
              </Typography>

              {item.description && (
                <Typography variant="body1" color="text.secondary" paragraph>
                  {item.description}
                </Typography>
              )}
            </Box>

            <Divider sx={{ my: 3 }} />

            {/* Detailed Description */}
            {item.detailed_description && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Details
                </Typography>
                <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                  {item.detailed_description}
                </Typography>
              </Box>
            )}

            {/* Timeline Info */}
            <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', mb: 3 }}>
              {item.quarter && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CalendarMonth color="action" />
                  <Typography variant="body2">
                    Planned for {item.quarter}
                  </Typography>
                </Box>
              )}
              {item.estimated_date && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Schedule color="action" />
                  <Typography variant="body2">
                    Est. {new Date(item.estimated_date).toLocaleDateString()}
                  </Typography>
                </Box>
              )}
              {item.completed_date && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CheckCircle color="success" />
                  <Typography variant="body2">
                    Completed {new Date(item.completed_date).toLocaleDateString()}
                  </Typography>
                </Box>
              )}
            </Box>
          </Paper>

          {/* Comments Section */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Comments ({comments.length})
            </Typography>

            {/* Comment Form */}
            <Box component="form" onSubmit={handleSubmitComment} sx={{ mb: 3 }}>
              <TextField
                fullWidth
                multiline
                rows={3}
                placeholder="Add a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                sx={{ mb: 2 }}
              />
              <Button
                type="submit"
                variant="contained"
                endIcon={<Send />}
                disabled={!newComment.trim() || submitting}
              >
                {submitting ? 'Posting...' : 'Post Comment'}
              </Button>
            </Box>

            <Divider sx={{ my: 3 }} />

            {/* Comments List */}
            {comments.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                No comments yet. Be the first to comment!
              </Typography>
            ) : (
              <Box>
                {comments.map((comment, index) => (
                  <Box key={comment.id} sx={{ mb: 3 }}>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      <Avatar sx={{ width: 40, height: 40 }}>
                        {comment.user_name?.[0] || 'U'}
                      </Avatar>
                      <Box sx={{ flexGrow: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <Typography variant="subtitle2">
                            {comment.user_name || 'User'}
                          </Typography>
                          {comment.is_official && (
                            <Chip
                              size="small"
                              icon={<Star />}
                              label="Official"
                              color="primary"
                              sx={{ height: 20 }}
                            />
                          )}
                          <Typography variant="caption" color="text.secondary">
                            {new Date(comment.created_at).toLocaleDateString()}
                          </Typography>
                        </Box>
                        <Typography variant="body2">
                          {comment.content}
                        </Typography>
                      </Box>
                    </Box>
                    {index < comments.length - 1 && <Divider sx={{ mt: 2 }} />}
                  </Box>
                ))}
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Sidebar */}
        <Grid item xs={12} md={4}>
          {/* Vote Card */}
          <Card sx={{ mb: 3 }}>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h3" color="primary">
                {item.votes_count}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                votes
              </Typography>
              <Button
                variant={item.has_voted ? 'contained' : 'outlined'}
                startIcon={item.has_voted ? <ThumbUp /> : <ThumbUpOutlined />}
                onClick={handleVote}
                fullWidth
                sx={{ mt: 2 }}
              >
                {item.has_voted ? 'Voted' : 'Vote'}
              </Button>
            </CardContent>
          </Card>

          {/* Info Card */}
          <Card>
            <CardContent>
              <Typography variant="subtitle2" gutterBottom>
                Item Info
              </Typography>
              <Divider sx={{ my: 1 }} />

              <Box sx={{ py: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Status
                </Typography>
                <Typography variant="body2">
                  {statusConfig[item.status]?.label}
                </Typography>
              </Box>

              <Box sx={{ py: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Priority
                </Typography>
                <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                  {item.priority}
                </Typography>
              </Box>

              {item.category && (
                <Box sx={{ py: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Category
                  </Typography>
                  <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                    {item.category}
                  </Typography>
                </Box>
              )}

              <Box sx={{ py: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Comments
                </Typography>
                <Typography variant="body2">
                  {item.comments_count || 0}
                </Typography>
              </Box>

              <Box sx={{ py: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Created
                </Typography>
                <Typography variant="body2">
                  {new Date(item.created_at).toLocaleDateString()}
                </Typography>
              </Box>
            </CardContent>
          </Card>

          {/* Back Button */}
          <Button
            startIcon={<ArrowBack />}
            component={Link}
            to="/roadmap"
            sx={{ mt: 3 }}
            fullWidth
          >
            Back to Roadmap
          </Button>
        </Grid>
      </Grid>
    </Container>
  );
}

export default RoadmapItemDetail;
