import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Box, Typography, Card, CardContent, CardMedia, IconButton, Chip, Paper } from '@mui/material';
import { ChevronLeft, ChevronRight, Star, Favorite, Visibility, Business } from '@mui/icons-material';
import api from '../../utils/api';

function ShowcaseFeatured() {
  const [projects, setProjects] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFeatured();
  }, []);

  const fetchFeatured = async () => {
    try {
      const response = await api.get('/api/showcase/featured');
      setProjects(response.data.projects);
    } catch (err) {
      console.error('Fetch featured error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrev = () => {
    setCurrentIndex(prev => (prev === 0 ? projects.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex(prev => (prev === projects.length - 1 ? 0 : prev + 1));
  };

  if (loading || projects.length === 0) return null;

  const project = projects[currentIndex];

  return (
    <Paper sx={{ mb: 4, overflow: 'hidden', position: 'relative' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', p: 1, bgcolor: 'warning.main', color: 'warning.contrastText' }}>
        <Star sx={{ mr: 1 }} />
        <Typography variant="subtitle2">Featured Projects</Typography>
      </Box>

      <Box sx={{ position: 'relative' }}>
        <Card component={Link} to={`/showcase/${project.slug}`} sx={{ display: 'flex', textDecoration: 'none', minHeight: 200 }}>
          {project.cover_image ? (
            <CardMedia component="img" sx={{ width: 300, objectFit: 'cover' }} image={project.cover_image} alt={project.title} />
          ) : (
            <Box sx={{ width: 300, bgcolor: 'grey.200', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Business sx={{ fontSize: 80, color: 'grey.400' }} />
            </Box>
          )}
          <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
              {project.logo_url && <Box component="img" src={project.logo_url} alt="" sx={{ width: 48, height: 48, borderRadius: 1 }} />}
              <Box>
                <Typography variant="h5" color="text.primary">{project.title}</Typography>
                {project.organization_name && <Typography variant="body2" color="text.secondary">by {project.organization_name}</Typography>}
              </Box>
            </Box>
            {project.tagline && <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>{project.tagline}</Typography>}
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <Chip icon={<Favorite />} label={project.likes_count} size="small" />
              <Chip icon={<Visibility />} label={project.views_count} size="small" />
              {project.category && <Chip label={project.category} size="small" variant="outlined" />}
            </Box>
          </CardContent>
        </Card>

        {projects.length > 1 && (
          <>
            <IconButton onClick={handlePrev} sx={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', bgcolor: 'background.paper', '&:hover': { bgcolor: 'grey.100' } }}>
              <ChevronLeft />
            </IconButton>
            <IconButton onClick={handleNext} sx={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', bgcolor: 'background.paper', '&:hover': { bgcolor: 'grey.100' } }}>
              <ChevronRight />
            </IconButton>
          </>
        )}
      </Box>

      {projects.length > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, py: 1 }}>
          {projects.map((_, idx) => (
            <Box key={idx} onClick={() => setCurrentIndex(idx)}
              sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: idx === currentIndex ? 'primary.main' : 'grey.300', cursor: 'pointer' }} />
          ))}
        </Box>
      )}
    </Paper>
  );
}

export default ShowcaseFeatured;
