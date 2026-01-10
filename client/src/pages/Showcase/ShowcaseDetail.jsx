import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Box, Container, Typography, Card, CardContent, Chip, IconButton, Button, Grid,
  TextField, LinearProgress, Paper, Avatar, Divider, Alert, Breadcrumbs, ImageList, ImageListItem
} from '@mui/material';
import { Favorite, FavoriteBorder, Visibility, OpenInNew, ArrowBack, Send, PlayCircle, Business, FormatQuote } from '@mui/icons-material';
import api from '../../utils/api';

function ShowcaseDetail() {
  const { slug } = useParams();
  const [project, setProject] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchProject();
    fetchComments();
  }, [slug]);

  const fetchProject = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/showcase/${slug}`);
      setProject(response.data.project);
    } catch (err) {
      setError(err.response?.status === 404 ? 'Project not found' : 'Failed to load project');
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    try {
      const response = await api.get(`/api/showcase/${slug}/comments`);
      setComments(response.data.comments);
    } catch (err) {
      console.error('Fetch comments error:', err);
    }
  };

  const handleLike = async () => {
    if (!project) return;
    try {
      const response = await api.post(`/api/showcase/${project.id}/like`);
      setProject(prev => ({ ...prev, likes_count: response.data.likes_count, has_liked: response.data.action === 'liked' }));
    } catch (err) {
      console.error('Like error:', err);
    }
  };

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || !project) return;
    try {
      setSubmitting(true);
      const response = await api.post(`/api/showcase/${project.id}/comments`, { content: newComment.trim() });
      setComments(prev => [response.data.comment, ...prev]);
      setNewComment('');
    } catch (err) {
      console.error('Submit comment error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Container maxWidth="lg" sx={{ py: 4 }}><LinearProgress /></Container>;

  if (error || !project) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error" sx={{ mb: 2 }}>{error || 'Project not found'}</Alert>
        <Button startIcon={<ArrowBack />} component={Link} to="/showcase">Back to Showcase</Button>
      </Container>
    );
  }

  const screenshots = typeof project.screenshots === 'string' ? JSON.parse(project.screenshots || '[]') : (project.screenshots || []);
  const tags = typeof project.tags === 'string' ? JSON.parse(project.tags || '[]') : (project.tags || []);
  const featuresUsed = typeof project.features_used === 'string' ? JSON.parse(project.features_used || '[]') : (project.features_used || []);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Breadcrumbs sx={{ mb: 3 }}>
        <Link to="/showcase" style={{ textDecoration: 'none', color: 'inherit' }}>Showcase</Link>
        <Typography color="text.primary">{project.title}</Typography>
      </Breadcrumbs>

      <Grid container spacing={4}>
        <Grid item xs={12} md={8}>
          {/* Cover Image */}
          {project.cover_image ? (
            <Box component="img" src={project.cover_image} alt={project.title} sx={{ width: '100%', borderRadius: 2, mb: 3 }} />
          ) : (
            <Box sx={{ height: 300, bgcolor: 'grey.200', borderRadius: 2, mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Business sx={{ fontSize: 100, color: 'grey.400' }} />
            </Box>
          )}

          {/* Title & Info */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              {project.logo_url && <Box component="img" src={project.logo_url} alt="" sx={{ width: 64, height: 64, borderRadius: 2 }} />}
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="h4">{project.title}</Typography>
                {project.tagline && <Typography variant="subtitle1" color="text.secondary">{project.tagline}</Typography>}
              </Box>
            </Box>

            {project.description && <Typography variant="body1" sx={{ mb: 3, whiteSpace: 'pre-wrap' }}>{project.description}</Typography>}

            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
              {tags.map((tag, idx) => <Chip key={idx} label={tag} size="small" />)}
            </Box>

            <Box sx={{ display: 'flex', gap: 2 }}>
              {project.website_url && <Button variant="outlined" startIcon={<OpenInNew />} href={project.website_url} target="_blank">Website</Button>}
              {project.demo_url && <Button variant="contained" startIcon={<PlayCircle />} href={project.demo_url} target="_blank">Try Demo</Button>}
            </Box>
          </Paper>

          {/* Screenshots */}
          {screenshots.length > 0 && (
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>Screenshots</Typography>
              <ImageList cols={2} gap={8}>
                {screenshots.map((img, idx) => (
                  <ImageListItem key={idx}>
                    <img src={img} alt={`Screenshot ${idx + 1}`} loading="lazy" style={{ borderRadius: 8 }} />
                  </ImageListItem>
                ))}
              </ImageList>
            </Paper>
          )}

          {/* Video */}
          {project.video_url && (
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>Video</Typography>
              <Box sx={{ position: 'relative', paddingTop: '56.25%' }}>
                <iframe src={project.video_url} title="Video" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none', borderRadius: 8 }} allowFullScreen />
              </Box>
            </Paper>
          )}

          {/* Testimonial */}
          {project.testimonial_text && (
            <Paper sx={{ p: 3, mb: 3, bgcolor: 'primary.light', color: 'primary.contrastText' }}>
              <FormatQuote sx={{ fontSize: 40, opacity: 0.5 }} />
              <Typography variant="h6" sx={{ fontStyle: 'italic', mb: 2 }}>{project.testimonial_text}</Typography>
              <Typography variant="subtitle2">{project.testimonial_author}</Typography>
              {project.testimonial_role && <Typography variant="body2" sx={{ opacity: 0.8 }}>{project.testimonial_role}</Typography>}
            </Paper>
          )}

          {/* Comments */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>Comments ({comments.length})</Typography>
            <Box component="form" onSubmit={handleSubmitComment} sx={{ mb: 3 }}>
              <TextField fullWidth multiline rows={3} placeholder="Add a comment..." value={newComment} onChange={(e) => setNewComment(e.target.value)} sx={{ mb: 2 }} />
              <Button type="submit" variant="contained" endIcon={<Send />} disabled={!newComment.trim() || submitting}>
                {submitting ? 'Posting...' : 'Post Comment'}
              </Button>
            </Box>
            <Divider sx={{ my: 3 }} />
            {comments.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>No comments yet</Typography>
            ) : (
              comments.map((comment, idx) => (
                <Box key={comment.id} sx={{ mb: 3 }}>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <Avatar>{comment.user_name?.[0] || 'U'}</Avatar>
                    <Box sx={{ flexGrow: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Typography variant="subtitle2">{comment.user_name || 'User'}</Typography>
                        <Typography variant="caption" color="text.secondary">{new Date(comment.created_at).toLocaleDateString()}</Typography>
                      </Box>
                      <Typography variant="body2">{comment.content}</Typography>
                    </Box>
                  </Box>
                  {idx < comments.length - 1 && <Divider sx={{ mt: 2 }} />}
                </Box>
              ))
            )}
          </Paper>
        </Grid>

        {/* Sidebar */}
        <Grid item xs={12} md={4}>
          <Card sx={{ mb: 3 }}>
            <CardContent sx={{ textAlign: 'center' }}>
              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 4, mb: 2 }}>
                <Box>
                  <Typography variant="h4" color="error.main">{project.likes_count}</Typography>
                  <Typography variant="body2" color="text.secondary">likes</Typography>
                </Box>
                <Box>
                  <Typography variant="h4">{project.views_count}</Typography>
                  <Typography variant="body2" color="text.secondary">views</Typography>
                </Box>
              </Box>
              <Button variant={project.has_liked ? 'contained' : 'outlined'} color="error" startIcon={project.has_liked ? <Favorite /> : <FavoriteBorder />} onClick={handleLike} fullWidth>
                {project.has_liked ? 'Liked' : 'Like'}
              </Button>
            </CardContent>
          </Card>

          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="subtitle2" gutterBottom>Project Info</Typography>
              <Divider sx={{ my: 1 }} />
              {project.category && <Box sx={{ py: 1 }}><Typography variant="caption" color="text.secondary">Category</Typography><Typography variant="body2">{project.category}</Typography></Box>}
              {project.industry && <Box sx={{ py: 1 }}><Typography variant="caption" color="text.secondary">Industry</Typography><Typography variant="body2">{project.industry}</Typography></Box>}
              {project.organization_name && <Box sx={{ py: 1 }}><Typography variant="caption" color="text.secondary">Organization</Typography><Typography variant="body2">{project.organization_name}</Typography></Box>}
              <Box sx={{ py: 1 }}><Typography variant="caption" color="text.secondary">Published</Typography><Typography variant="body2">{new Date(project.approved_at || project.created_at).toLocaleDateString()}</Typography></Box>
            </CardContent>
          </Card>

          {featuresUsed.length > 0 && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="subtitle2" gutterBottom>Features Used</Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {featuresUsed.map((f, idx) => <Chip key={idx} label={f} size="small" color="primary" variant="outlined" />)}
                </Box>
              </CardContent>
            </Card>
          )}

          <Button startIcon={<ArrowBack />} component={Link} to="/showcase" fullWidth>Back to Showcase</Button>
        </Grid>
      </Grid>
    </Container>
  );
}

export default ShowcaseDetail;
