import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  LinearProgress,
  Tooltip,
  Paper,
  Alert,
  Tabs,
  Tab,
  Badge
} from '@mui/material';
import {
  ThumbUp,
  ThumbUpOutlined,
  Add,
  Schedule,
  CheckCircle,
  Pending,
  Close,
  Preview,
  TrendingUp,
  NewReleases
} from '@mui/icons-material';
import api from '../../utils/api';

const statusConfig = {
  pending: { label: 'Pending', icon: <Pending />, color: '#9e9e9e' },
  reviewing: { label: 'Reviewing', icon: <Preview />, color: '#2196f3' },
  planned: { label: 'Planned', icon: <Schedule />, color: '#4caf50' },
  declined: { label: 'Declined', icon: <Close />, color: '#f44336' }
};

const categoryIcons = {
  feature: <NewReleases />,
  improvement: <TrendingUp />,
  integration: <NewReleases />,
  api: <NewReleases />
};

function FeatureRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    status: '',
    category: '',
    sort: 'votes'
  });

  useEffect(() => {
    fetchRequests();
  }, [filters]);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.category) params.append('category', filters.category);
      params.append('sort', filters.sort);

      const response = await api.get(`/api/roadmap/feature-requests/list?${params}`);
      setRequests(response.data.requests);
      setError(null);
    } catch (err) {
      setError('Failed to load feature requests');
      console.error('Fetch requests error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (id, e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const response = await api.post(`/api/roadmap/feature-requests/${id}/vote`);
      setRequests(prev => prev.map(req =>
        req.id === id
          ? { ...req, votes_count: response.data.votes_count, has_voted: response.data.action === 'voted' }
          : req
      ));
    } catch (err) {
      console.error('Vote error:', err);
    }
  };

  const RequestCard = ({ request }) => (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ flexGrow: 1 }}>
            <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
              <Chip
                size="small"
                icon={statusConfig[request.status]?.icon}
                label={statusConfig[request.status]?.label}
                sx={{
                  backgroundColor: statusConfig[request.status]?.color,
                  color: 'white',
                  '& .MuiChip-icon': { color: 'white' }
                }}
              />
              {request.category && (
                <Chip
                  size="small"
                  icon={categoryIcons[request.category]}
                  label={request.category}
                  variant="outlined"
                />
              )}
              {request.roadmap_item_id && (
                <Chip
                  size="small"
                  label="On Roadmap"
                  color="success"
                  variant="outlined"
                />
              )}
            </Box>

            <Typography variant="h6" gutterBottom>
              {request.title}
            </Typography>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {request.description.substring(0, 200)}
              {request.description.length > 200 ? '...' : ''}
            </Typography>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="caption" color="text.secondary">
                Requested by {request.user_name || 'User'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {new Date(request.created_at).toLocaleDateString()}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', ml: 2 }}>
            <Tooltip title={request.has_voted ? 'Remove vote' : 'Vote for this'}>
              <IconButton
                onClick={(e) => handleVote(request.id, e)}
                color={request.has_voted ? 'primary' : 'default'}
                size="large"
              >
                {request.has_voted ? <ThumbUp /> : <ThumbUpOutlined />}
              </IconButton>
            </Tooltip>
            <Typography variant="h6" color={request.has_voted ? 'primary' : 'text.secondary'}>
              {request.votes_count}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              votes
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  // Group by status for stats
  const stats = {
    total: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    reviewing: requests.filter(r => r.status === 'reviewing').length,
    planned: requests.filter(r => r.status === 'planned').length
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Feature Requests
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Submit and vote for features you'd like to see
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          component={Link}
          to="/feature-requests/new"
          size="large"
        >
          Submit Request
        </Button>
      </Box>

      {/* Stats */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={6} sm={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h4">{stats.total}</Typography>
            <Typography variant="body2" color="text.secondary">Total Requests</Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h4" color="grey.600">{stats.pending}</Typography>
            <Typography variant="body2" color="text.secondary">Pending</Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h4" color="info.main">{stats.reviewing}</Typography>
            <Typography variant="body2" color="text.secondary">Reviewing</Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h4" color="success.main">{stats.planned}</Typography>
            <Typography variant="body2" color="text.secondary">Planned</Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Status</InputLabel>
          <Select
            value={filters.status}
            label="Status"
            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="pending">Pending</MenuItem>
            <MenuItem value="reviewing">Reviewing</MenuItem>
            <MenuItem value="planned">Planned</MenuItem>
            <MenuItem value="declined">Declined</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Category</InputLabel>
          <Select
            value={filters.category}
            label="Category"
            onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="feature">Feature</MenuItem>
            <MenuItem value="improvement">Improvement</MenuItem>
            <MenuItem value="integration">Integration</MenuItem>
            <MenuItem value="api">API</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Sort</InputLabel>
          <Select
            value={filters.sort}
            label="Sort"
            onChange={(e) => setFilters(prev => ({ ...prev, sort: e.target.value }))}
          >
            <MenuItem value="votes">Most Votes</MenuItem>
            <MenuItem value="newest">Newest</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* Error */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Loading */}
      {loading && <LinearProgress sx={{ mb: 3 }} />}

      {/* Requests List */}
      {!loading && (
        <Box>
          {requests.map(request => (
            <RequestCard key={request.id} request={request} />
          ))}

          {requests.length === 0 && (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No feature requests yet
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Be the first to suggest a feature!
              </Typography>
              <Button
                variant="contained"
                startIcon={<Add />}
                component={Link}
                to="/feature-requests/new"
              >
                Submit Request
              </Button>
            </Paper>
          )}
        </Box>
      )}

      {/* Navigation */}
      <Box sx={{ mt: 4, textAlign: 'center' }}>
        <Button
          component={Link}
          to="/roadmap"
          variant="outlined"
        >
          View Product Roadmap
        </Button>
      </Box>
    </Container>
  );
}

export default FeatureRequests;
