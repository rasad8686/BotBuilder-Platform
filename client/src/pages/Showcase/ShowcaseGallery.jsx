import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  CardMedia,
  Chip,
  IconButton,
  Button,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  LinearProgress,
  Tooltip,
  Paper,
  InputAdornment,
  Pagination,
  ToggleButton,
  ToggleButtonGroup
} from '@mui/material';
import {
  Favorite,
  FavoriteBorder,
  Visibility,
  Search,
  Add,
  GridView,
  ViewList,
  Business,
  Star
} from '@mui/icons-material';
import api from '../../utils/api';
import ShowcaseFeatured from './ShowcaseFeatured';

const categoryLabels = {
  chatbot: 'Chatbot',
  'customer-support': 'Customer Support',
  sales: 'Sales',
  internal: 'Internal Tool',
  other: 'Other'
};

const industryLabels = {
  ecommerce: 'E-commerce',
  healthcare: 'Healthcare',
  finance: 'Finance',
  education: 'Education',
  technology: 'Technology',
  retail: 'Retail',
  other: 'Other'
};

function ShowcaseGallery() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [viewMode, setViewMode] = useState('grid');
  const [filters, setFilters] = useState({
    category: '',
    industry: '',
    sort: 'newest',
    search: ''
  });
  const [searchInput, setSearchInput] = useState('');

  useEffect(() => {
    fetchProjects();
  }, [filters, pagination.page]);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.category) params.append('category', filters.category);
      if (filters.industry) params.append('industry', filters.industry);
      if (filters.search) params.append('search', filters.search);
      params.append('sort', filters.sort);
      params.append('page', pagination.page);
      params.append('limit', 12);

      const response = await api.get(`/api/showcase?${params}`);
      setProjects(response.data.projects);
      setPagination(response.data.pagination);
    } catch (err) {
      console.error('Fetch projects error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (projectId, e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const response = await api.post(`/api/showcase/${projectId}/like`);
      setProjects(prev => prev.map(p =>
        p.id === projectId
          ? { ...p, likes_count: response.data.likes_count, has_liked: response.data.action === 'liked' }
          : p
      ));
    } catch (err) {
      console.error('Like error:', err);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setFilters(prev => ({ ...prev, search: searchInput }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const ProjectCard = ({ project }) => (
    <Card
      component={Link}
      to={`/showcase/${project.slug}`}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        textDecoration: 'none',
        transition: 'all 0.2s',
        '&:hover': { transform: 'translateY(-4px)', boxShadow: 4 }
      }}
    >
      {project.cover_image ? (
        <CardMedia component="img" height="180" image={project.cover_image} alt={project.title} />
      ) : (
        <Box sx={{ height: 180, bgcolor: 'grey.200', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Business sx={{ fontSize: 60, color: 'grey.400' }} />
        </Box>
      )}
      <CardContent sx={{ flexGrow: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
          {project.logo_url && (
            <Box component="img" src={project.logo_url} alt="" sx={{ width: 32, height: 32, borderRadius: 1 }} />
          )}
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6" color="text.primary" gutterBottom>{project.title}</Typography>
            {project.is_featured && <Chip size="small" icon={<Star />} label="Featured" color="warning" sx={{ mb: 1 }} />}
          </Box>
        </Box>
        {project.tagline && <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{project.tagline}</Typography>}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
          {project.category && <Chip size="small" label={categoryLabels[project.category] || project.category} variant="outlined" />}
          {project.industry && <Chip size="small" label={industryLabels[project.industry] || project.industry} variant="outlined" />}
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Tooltip title={project.has_liked ? 'Unlike' : 'Like'}>
              <IconButton size="small" onClick={(e) => handleLike(project.id, e)} color={project.has_liked ? 'error' : 'default'}>
                {project.has_liked ? <Favorite /> : <FavoriteBorder />}
              </IconButton>
            </Tooltip>
            <Typography variant="body2" color="text.secondary">{project.likes_count}</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Visibility fontSize="small" color="action" />
            <Typography variant="body2" color="text.secondary">{project.views_count}</Typography>
          </Box>
        </Box>
        {project.organization_name && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>by {project.organization_name}</Typography>
        )}
      </CardContent>
    </Card>
  );

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" gutterBottom>Showcase Gallery</Typography>
          <Typography variant="body1" color="text.secondary">Discover amazing projects built with our platform</Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} component={Link} to="/showcase/submit">Submit Your Project</Button>
      </Box>

      <ShowcaseFeatured />

      <Paper sx={{ p: 2, mb: 4 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <Box component="form" onSubmit={handleSearch} sx={{ flexGrow: 1, minWidth: 200 }}>
            <TextField fullWidth size="small" placeholder="Search projects..." value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><Search /></InputAdornment> }} />
          </Box>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Category</InputLabel>
            <Select value={filters.category} label="Category" onChange={(e) => { setFilters(prev => ({ ...prev, category: e.target.value })); setPagination(prev => ({ ...prev, page: 1 })); }}>
              <MenuItem value="">All Categories</MenuItem>
              {Object.entries(categoryLabels).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Industry</InputLabel>
            <Select value={filters.industry} label="Industry" onChange={(e) => { setFilters(prev => ({ ...prev, industry: e.target.value })); setPagination(prev => ({ ...prev, page: 1 })); }}>
              <MenuItem value="">All Industries</MenuItem>
              {Object.entries(industryLabels).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Sort</InputLabel>
            <Select value={filters.sort} label="Sort" onChange={(e) => setFilters(prev => ({ ...prev, sort: e.target.value }))}>
              <MenuItem value="newest">Newest</MenuItem>
              <MenuItem value="popular">Most Popular</MenuItem>
              <MenuItem value="views">Most Viewed</MenuItem>
            </Select>
          </FormControl>
          <ToggleButtonGroup value={viewMode} exclusive onChange={(e, v) => v && setViewMode(v)} size="small">
            <ToggleButton value="grid"><GridView /></ToggleButton>
            <ToggleButton value="list"><ViewList /></ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Paper>

      {loading && <LinearProgress sx={{ mb: 3 }} />}
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{pagination.total} projects found</Typography>

      {!loading && (
        <>
          <Grid container spacing={3}>
            {projects.map(project => (
              <Grid item xs={12} sm={6} md={viewMode === 'grid' ? 4 : 6} lg={viewMode === 'grid' ? 3 : 4} key={project.id}>
                <ProjectCard project={project} />
              </Grid>
            ))}
          </Grid>
          {projects.length === 0 && (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="h6" color="text.secondary" gutterBottom>No projects found</Typography>
              <Button variant="contained" startIcon={<Add />} component={Link} to="/showcase/submit">Submit Your Project</Button>
            </Paper>
          )}
          {pagination.pages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
              <Pagination count={pagination.pages} page={pagination.page} onChange={(e, page) => setPagination(prev => ({ ...prev, page }))} color="primary" />
            </Box>
          )}
        </>
      )}
    </Container>
  );
}

export default ShowcaseGallery;
