import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Box, Container, Typography, Card, CardContent, Chip, IconButton, Button, Grid,
  LinearProgress, Paper, Alert, Menu, MenuItem
} from '@mui/material';
import { Add, Edit, Delete, MoreVert, Visibility, Favorite, CheckCircle, Schedule, Close } from '@mui/icons-material';
import api from '../../utils/api';

const statusConfig = {
  pending: { label: 'Pending Review', icon: <Schedule />, color: 'warning' },
  approved: { label: 'Approved', icon: <CheckCircle />, color: 'success' },
  rejected: { label: 'Rejected', icon: <Close />, color: 'error' },
  archived: { label: 'Archived', icon: <Schedule />, color: 'default' }
};

function MyShowcaseProjects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);

  useEffect(() => {
    fetchMyProjects();
  }, []);

  const fetchMyProjects = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/showcase/user/my');
      setProjects(response.data.projects);
    } catch (err) {
      setError('Failed to load your projects');
      console.error('Fetch my projects error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMenuOpen = (event, project) => {
    setMenuAnchor(event.currentTarget);
    setSelectedProject(project);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setSelectedProject(null);
  };

  const handleDelete = async () => {
    if (!selectedProject) return;
    if (!window.confirm('Are you sure you want to delete this project?')) {
      handleMenuClose();
      return;
    }
    try {
      await api.delete(`/api/showcase/${selectedProject.id}`);
      setProjects(prev => prev.filter(p => p.id !== selectedProject.id));
      handleMenuClose();
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const ProjectCard = ({ project }) => {
    const status = statusConfig[project.status] || statusConfig.pending;

    return (
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Box sx={{ flexGrow: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Chip size="small" icon={status.icon} label={status.label} color={status.color} />
                {project.is_featured && <Chip size="small" label="Featured" color="warning" />}
              </Box>
              <Typography variant="h6" gutterBottom>{project.title}</Typography>
              {project.tagline && <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{project.tagline}</Typography>}
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Favorite fontSize="small" color="error" />
                  <Typography variant="body2">{project.likes_count}</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Visibility fontSize="small" color="action" />
                  <Typography variant="body2">{project.views_count}</Typography>
                </Box>
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                Submitted {new Date(project.created_at).toLocaleDateString()}
              </Typography>
            </Box>
            <IconButton onClick={(e) => handleMenuOpen(e, project)}>
              <MoreVert />
            </IconButton>
          </Box>
        </CardContent>
      </Card>
    );
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" gutterBottom>My Showcase Projects</Typography>
          <Typography variant="body1" color="text.secondary">Manage your submitted projects</Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} component={Link} to="/showcase/submit">Submit New Project</Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
      {loading && <LinearProgress sx={{ mb: 3 }} />}

      {!loading && (
        <>
          {/* Stats */}
          <Grid container spacing={2} sx={{ mb: 4 }}>
            <Grid item xs={6} sm={3}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h4">{projects.length}</Typography>
                <Typography variant="body2" color="text.secondary">Total</Typography>
              </Paper>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h4" color="warning.main">{projects.filter(p => p.status === 'pending').length}</Typography>
                <Typography variant="body2" color="text.secondary">Pending</Typography>
              </Paper>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h4" color="success.main">{projects.filter(p => p.status === 'approved').length}</Typography>
                <Typography variant="body2" color="text.secondary">Approved</Typography>
              </Paper>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h4">{projects.reduce((sum, p) => sum + p.views_count, 0)}</Typography>
                <Typography variant="body2" color="text.secondary">Total Views</Typography>
              </Paper>
            </Grid>
          </Grid>

          {/* Projects List */}
          <Grid container spacing={3}>
            {projects.map(project => (
              <Grid item xs={12} sm={6} key={project.id}>
                <ProjectCard project={project} />
              </Grid>
            ))}
          </Grid>

          {projects.length === 0 && (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="h6" color="text.secondary" gutterBottom>No projects yet</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Share your work with the community!</Typography>
              <Button variant="contained" startIcon={<Add />} component={Link} to="/showcase/submit">Submit Your First Project</Button>
            </Paper>
          )}
        </>
      )}

      {/* Actions Menu */}
      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={handleMenuClose}>
        {selectedProject?.status === 'approved' && (
          <MenuItem component={Link} to={`/showcase/${selectedProject?.slug}`}><Visibility sx={{ mr: 1 }} /> View</MenuItem>
        )}
        <MenuItem onClick={handleDelete}><Delete sx={{ mr: 1 }} color="error" /> Delete</MenuItem>
      </Menu>
    </Container>
  );
}

export default MyShowcaseProjects;
