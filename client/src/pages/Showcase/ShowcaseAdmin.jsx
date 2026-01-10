import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Box, Container, Typography, Card, CardContent, Chip, IconButton, Button, Grid,
  LinearProgress, Paper, Alert, Tabs, Tab, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Dialog, DialogTitle, DialogContent, DialogActions, Tooltip
} from '@mui/material';
import { CheckCircle, Close, Star, StarBorder, Visibility, OpenInNew, Schedule } from '@mui/icons-material';
import api from '../../utils/api';

const statusConfig = {
  pending: { label: 'Pending', color: 'warning' },
  approved: { label: 'Approved', color: 'success' },
  rejected: { label: 'Rejected', color: 'error' },
  archived: { label: 'Archived', color: 'default' }
};

function ShowcaseAdmin() {
  const [activeTab, setActiveTab] = useState(0);
  const [pendingProjects, setPendingProjects] = useState([]);
  const [allProjects, setAllProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [previewProject, setPreviewProject] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [pendingRes, allRes] = await Promise.all([
        api.get('/api/showcase/admin/pending'),
        api.get('/api/showcase/admin/all')
      ]);
      setPendingProjects(pendingRes.data.projects);
      setAllProjects(allRes.data.projects);
    } catch (err) {
      setError('Failed to load projects');
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id) => {
    try {
      await api.put(`/api/showcase/admin/${id}/approve`);
      setSuccess('Project approved');
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to approve');
    }
  };

  const handleReject = async (id) => {
    try {
      await api.put(`/api/showcase/admin/${id}/reject`);
      setSuccess('Project rejected');
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reject');
    }
  };

  const handleToggleFeatured = async (id) => {
    try {
      const response = await api.put(`/api/showcase/admin/${id}/feature`);
      setSuccess(response.data.message);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to toggle featured');
    }
  };

  const ProjectPreview = ({ project }) => {
    if (!project) return null;
    return (
      <Dialog open={Boolean(project)} onClose={() => setPreviewProject(null)} maxWidth="md" fullWidth>
        <DialogTitle>{project.title}</DialogTitle>
        <DialogContent>
          {project.cover_image && <Box component="img" src={project.cover_image} alt="" sx={{ width: '100%', maxHeight: 300, objectFit: 'cover', borderRadius: 1, mb: 2 }} />}
          {project.tagline && <Typography variant="subtitle1" color="text.secondary" gutterBottom>{project.tagline}</Typography>}
          {project.description && <Typography variant="body1" sx={{ mb: 2 }}>{project.description}</Typography>}
          <Grid container spacing={2}>
            <Grid item xs={6}><Typography variant="caption" color="text.secondary">Category</Typography><Typography variant="body2">{project.category || '-'}</Typography></Grid>
            <Grid item xs={6}><Typography variant="caption" color="text.secondary">Industry</Typography><Typography variant="body2">{project.industry || '-'}</Typography></Grid>
            <Grid item xs={6}><Typography variant="caption" color="text.secondary">Author</Typography><Typography variant="body2">{project.author_name}</Typography></Grid>
            <Grid item xs={6}><Typography variant="caption" color="text.secondary">Organization</Typography><Typography variant="body2">{project.organization_name || '-'}</Typography></Grid>
          </Grid>
          {project.website_url && <Button href={project.website_url} target="_blank" startIcon={<OpenInNew />} sx={{ mt: 2 }}>Website</Button>}
          {project.demo_url && <Button href={project.demo_url} target="_blank" startIcon={<OpenInNew />} sx={{ mt: 2, ml: 1 }}>Demo</Button>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewProject(null)}>Close</Button>
          {project.status === 'pending' && (
            <>
              <Button color="error" onClick={() => { handleReject(project.id); setPreviewProject(null); }}>Reject</Button>
              <Button variant="contained" color="success" onClick={() => { handleApprove(project.id); setPreviewProject(null); }}>Approve</Button>
            </>
          )}
        </DialogActions>
      </Dialog>
    );
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>Showcase Admin</Typography>
        <Typography variant="body1" color="text.secondary">Review and manage showcase submissions</Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>{success}</Alert>}

      {loading && <LinearProgress sx={{ mb: 3 }} />}

      <Paper sx={{ mb: 3 }}>
        <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)}>
          <Tab label={`Pending Review (${pendingProjects.length})`} />
          <Tab label={`All Projects (${allProjects.length})`} />
        </Tabs>
      </Paper>

      {/* Pending Tab */}
      {activeTab === 0 && (
        <Grid container spacing={3}>
          {pendingProjects.map(project => (
            <Grid item xs={12} md={6} key={project.id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="h6" gutterBottom>{project.title}</Typography>
                      {project.tagline && <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{project.tagline}</Typography>}
                      <Typography variant="caption" color="text.secondary">by {project.author_name} ({project.author_email})</Typography>
                      {project.organization_name && <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{project.organization_name}</Typography>}
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                        Submitted {new Date(project.created_at).toLocaleDateString()}
                      </Typography>
                    </Box>
                    {project.cover_image && <Box component="img" src={project.cover_image} alt="" sx={{ width: 100, height: 60, objectFit: 'cover', borderRadius: 1 }} />}
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                    <Button size="small" startIcon={<Visibility />} onClick={() => setPreviewProject(project)}>Preview</Button>
                    <Button size="small" color="error" startIcon={<Close />} onClick={() => handleReject(project.id)}>Reject</Button>
                    <Button size="small" variant="contained" color="success" startIcon={<CheckCircle />} onClick={() => handleApprove(project.id)}>Approve</Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
          {pendingProjects.length === 0 && (
            <Grid item xs={12}>
              <Paper sx={{ p: 4, textAlign: 'center' }}>
                <Schedule sx={{ fontSize: 48, color: 'grey.400', mb: 2 }} />
                <Typography variant="h6" color="text.secondary">No pending projects</Typography>
              </Paper>
            </Grid>
          )}
        </Grid>
      )}

      {/* All Projects Tab */}
      {activeTab === 1 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Project</TableCell>
                <TableCell>Author</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Stats</TableCell>
                <TableCell>Featured</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {allProjects.map(project => (
                <TableRow key={project.id}>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">{project.title}</Typography>
                    <Typography variant="caption" color="text.secondary">{project.slug}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{project.author_name}</Typography>
                    <Typography variant="caption" color="text.secondary">{project.author_email}</Typography>
                  </TableCell>
                  <TableCell>{project.category || '-'}</TableCell>
                  <TableCell>
                    <Chip size="small" label={statusConfig[project.status]?.label} color={statusConfig[project.status]?.color} />
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">{project.views_count} views, {project.likes_count} likes</Typography>
                  </TableCell>
                  <TableCell>
                    <Tooltip title={project.is_featured ? 'Remove from featured' : 'Add to featured'}>
                      <IconButton size="small" onClick={() => handleToggleFeatured(project.id)} color={project.is_featured ? 'warning' : 'default'}>
                        {project.is_featured ? <Star /> : <StarBorder />}
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={() => setPreviewProject(project)}><Visibility /></IconButton>
                    {project.status === 'pending' && (
                      <>
                        <IconButton size="small" color="error" onClick={() => handleReject(project.id)}><Close /></IconButton>
                        <IconButton size="small" color="success" onClick={() => handleApprove(project.id)}><CheckCircle /></IconButton>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <ProjectPreview project={previewProject} />
    </Container>
  );
}

export default ShowcaseAdmin;
