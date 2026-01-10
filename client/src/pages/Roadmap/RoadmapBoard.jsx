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
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  LinearProgress,
  Tooltip,
  Badge,
  Paper,
  Tabs,
  Tab,
  Alert
} from '@mui/material';
import {
  ThumbUp,
  ThumbUpOutlined,
  Comment,
  Schedule,
  CheckCircle,
  PlayCircle,
  FlagOutlined,
  Timeline,
  ViewKanban,
  Add,
  TrendingUp,
  NewReleases,
  BugReport,
  Extension,
  Api
} from '@mui/icons-material';
import api from '../../utils/api';

const priorityColors = {
  low: '#8bc34a',
  medium: '#ff9800',
  high: '#f44336',
  critical: '#9c27b0'
};

const categoryIcons = {
  feature: <NewReleases />,
  improvement: <TrendingUp />,
  integration: <Extension />,
  api: <Api />,
  bugfix: <BugReport />
};

const statusConfig = {
  planned: { label: 'Planned', icon: <Schedule />, color: '#2196f3' },
  in_progress: { label: 'In Progress', icon: <PlayCircle />, color: '#ff9800' },
  completed: { label: 'Completed', icon: <CheckCircle />, color: '#4caf50' }
};

function RoadmapBoard() {
  const [items, setItems] = useState([]);
  const [grouped, setGrouped] = useState({ planned: [], in_progress: [], completed: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState('board'); // 'board' or 'list'
  const [filters, setFilters] = useState({
    category: '',
    quarter: '',
    sort: 'votes'
  });

  useEffect(() => {
    fetchRoadmap();
  }, [filters]);

  const fetchRoadmap = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.category) params.append('category', filters.category);
      if (filters.quarter) params.append('quarter', filters.quarter);
      params.append('sort', filters.sort);

      const response = await api.get(`/api/roadmap?${params}`);
      setItems(response.data.items);
      setGrouped(response.data.grouped);
      setError(null);
    } catch (err) {
      setError('Failed to load roadmap');
      console.error('Fetch roadmap error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (itemId, e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const response = await api.post(`/api/roadmap/${itemId}/vote`);
      // Update local state
      setItems(prev => prev.map(item =>
        item.id === itemId
          ? { ...item, votes_count: response.data.votes_count, has_voted: response.data.action === 'voted' }
          : item
      ));
      setGrouped(prev => ({
        planned: prev.planned.map(item =>
          item.id === itemId
            ? { ...item, votes_count: response.data.votes_count, has_voted: response.data.action === 'voted' }
            : item
        ),
        in_progress: prev.in_progress.map(item =>
          item.id === itemId
            ? { ...item, votes_count: response.data.votes_count, has_voted: response.data.action === 'voted' }
            : item
        ),
        completed: prev.completed.map(item =>
          item.id === itemId
            ? { ...item, votes_count: response.data.votes_count, has_voted: response.data.action === 'voted' }
            : item
        )
      }));
    } catch (err) {
      console.error('Vote error:', err);
    }
  };

  const RoadmapCard = ({ item }) => (
    <Card
      component={Link}
      to={`/roadmap/${item.slug}`}
      sx={{
        mb: 2,
        textDecoration: 'none',
        transition: 'all 0.2s',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: 3
        }
      }}
    >
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          <Typography variant="subtitle1" fontWeight="bold" color="text.primary">
            {item.title}
          </Typography>
          <Chip
            size="small"
            label={item.priority}
            sx={{
              backgroundColor: priorityColors[item.priority],
              color: 'white',
              textTransform: 'capitalize'
            }}
          />
        </Box>

        {item.description && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {item.description.substring(0, 100)}
            {item.description.length > 100 ? '...' : ''}
          </Typography>
        )}

        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          {item.category && (
            <Chip
              size="small"
              icon={categoryIcons[item.category] || <FlagOutlined />}
              label={item.category}
              variant="outlined"
            />
          )}
          {item.quarter && (
            <Chip
              size="small"
              icon={<Schedule />}
              label={item.quarter}
              variant="outlined"
            />
          )}
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Tooltip title={item.has_voted ? 'Remove vote' : 'Vote for this'}>
              <IconButton
                size="small"
                onClick={(e) => handleVote(item.id, e)}
                color={item.has_voted ? 'primary' : 'default'}
              >
                {item.has_voted ? <ThumbUp /> : <ThumbUpOutlined />}
              </IconButton>
            </Tooltip>
            <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center' }}>
              {item.votes_count} votes
            </Typography>
          </Box>

          <Badge badgeContent={item.comments_count} color="primary">
            <Comment fontSize="small" color="action" />
          </Badge>
        </Box>
      </CardContent>
    </Card>
  );

  const KanbanColumn = ({ status, items }) => (
    <Paper
      sx={{
        p: 2,
        minHeight: 400,
        backgroundColor: 'grey.50',
        borderTop: `3px solid ${statusConfig[status].color}`
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        {statusConfig[status].icon}
        <Typography variant="h6" sx={{ ml: 1 }}>
          {statusConfig[status].label}
        </Typography>
        <Chip
          size="small"
          label={items.length}
          sx={{ ml: 1 }}
        />
      </Box>

      {items.map(item => (
        <RoadmapCard key={item.id} item={item} />
      ))}

      {items.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
          No items in this column
        </Typography>
      )}
    </Paper>
  );

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Product Roadmap
        </Typography>
        <Typography variant="body1" color="text.secondary">
          See what we're working on and vote for features you want to see
        </Typography>
      </Box>

      {/* Filters & Actions */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
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
            <InputLabel>Quarter</InputLabel>
            <Select
              value={filters.quarter}
              label="Quarter"
              onChange={(e) => setFilters(prev => ({ ...prev, quarter: e.target.value }))}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="Q1 2025">Q1 2025</MenuItem>
              <MenuItem value="Q2 2025">Q2 2025</MenuItem>
              <MenuItem value="Q3 2025">Q3 2025</MenuItem>
              <MenuItem value="Q4 2025">Q4 2025</MenuItem>
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
              <MenuItem value="priority">Priority</MenuItem>
            </Select>
          </FormControl>
        </Box>

        <Box sx={{ display: 'flex', gap: 2 }}>
          <Tabs
            value={view}
            onChange={(e, v) => setView(v)}
            sx={{ minHeight: 40 }}
          >
            <Tab
              icon={<ViewKanban />}
              value="board"
              sx={{ minHeight: 40, minWidth: 60 }}
            />
            <Tab
              icon={<Timeline />}
              value="timeline"
              sx={{ minHeight: 40, minWidth: 60 }}
              component={Link}
              to="/roadmap?view=timeline"
            />
          </Tabs>

          <Button
            variant="contained"
            startIcon={<Add />}
            component={Link}
            to="/feature-requests/new"
          >
            Request Feature
          </Button>
        </Box>
      </Box>

      {/* Error */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Loading */}
      {loading && <LinearProgress sx={{ mb: 3 }} />}

      {/* Kanban Board */}
      {!loading && view === 'board' && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <KanbanColumn status="planned" items={grouped.planned} />
          </Grid>
          <Grid item xs={12} md={4}>
            <KanbanColumn status="in_progress" items={grouped.in_progress} />
          </Grid>
          <Grid item xs={12} md={4}>
            <KanbanColumn status="completed" items={grouped.completed} />
          </Grid>
        </Grid>
      )}

      {/* Stats */}
      <Box sx={{ mt: 4, display: 'flex', gap: 4, justifyContent: 'center' }}>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h4" color="primary">
            {grouped.planned.length}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Planned
          </Typography>
        </Box>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h4" color="warning.main">
            {grouped.in_progress.length}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            In Progress
          </Typography>
        </Box>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h4" color="success.main">
            {grouped.completed.length}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Completed
          </Typography>
        </Box>
      </Box>
    </Container>
  );
}

export default RoadmapBoard;
