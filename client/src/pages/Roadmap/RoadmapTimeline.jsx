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
  Tabs,
  Tab,
  Alert,
  Divider
} from '@mui/material';
import {
  ThumbUp,
  ThumbUpOutlined,
  Comment,
  Schedule,
  CheckCircle,
  PlayCircle,
  Timeline,
  ViewKanban,
  Add,
  ArrowForward
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
  completed: { label: 'Completed', icon: <CheckCircle />, color: '#4caf50' }
};

function RoadmapTimeline() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    category: '',
    status: ''
  });

  useEffect(() => {
    fetchRoadmap();
  }, [filters]);

  const fetchRoadmap = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.category) params.append('category', filters.category);
      if (filters.status) params.append('status', filters.status);

      const response = await api.get(`/api/roadmap?${params}`);
      setItems(response.data.items);
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
      setItems(prev => prev.map(item =>
        item.id === itemId
          ? { ...item, votes_count: response.data.votes_count, has_voted: response.data.action === 'voted' }
          : item
      ));
    } catch (err) {
      console.error('Vote error:', err);
    }
  };

  // Group items by quarter
  const groupedByQuarter = items.reduce((acc, item) => {
    const quarter = item.quarter || 'Unscheduled';
    if (!acc[quarter]) acc[quarter] = [];
    acc[quarter].push(item);
    return acc;
  }, {});

  // Sort quarters
  const sortedQuarters = Object.keys(groupedByQuarter).sort((a, b) => {
    if (a === 'Unscheduled') return 1;
    if (b === 'Unscheduled') return -1;
    return a.localeCompare(b);
  });

  const TimelineItem = ({ item, isLast }) => (
    <Box sx={{ display: 'flex', mb: isLast ? 0 : 3 }}>
      {/* Timeline connector */}
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mr: 2 }}>
        <Box
          sx={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            backgroundColor: statusConfig[item.status]?.color || '#9e9e9e',
            border: '2px solid white',
            boxShadow: 1
          }}
        />
        {!isLast && (
          <Box
            sx={{
              width: 2,
              flexGrow: 1,
              backgroundColor: 'grey.300',
              mt: 1
            }}
          />
        )}
      </Box>

      {/* Card */}
      <Card
        component={Link}
        to={`/roadmap/${item.slug}`}
        sx={{
          flexGrow: 1,
          textDecoration: 'none',
          transition: 'all 0.2s',
          '&:hover': {
            transform: 'translateX(4px)',
            boxShadow: 2
          }
        }}
      >
        <CardContent sx={{ py: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Box sx={{ flexGrow: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Chip
                  size="small"
                  icon={statusConfig[item.status]?.icon}
                  label={statusConfig[item.status]?.label}
                  sx={{
                    backgroundColor: statusConfig[item.status]?.color,
                    color: 'white',
                    '& .MuiChip-icon': { color: 'white' }
                  }}
                />
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

              <Typography variant="subtitle1" fontWeight="bold" color="text.primary">
                {item.title}
              </Typography>

              {item.description && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {item.description.substring(0, 150)}
                  {item.description.length > 150 ? '...' : ''}
                </Typography>
              )}

              {item.estimated_date && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  Est. {new Date(item.estimated_date).toLocaleDateString()}
                </Typography>
              )}
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', ml: 2 }}>
              <Tooltip title={item.has_voted ? 'Remove vote' : 'Vote for this'}>
                <IconButton
                  size="small"
                  onClick={(e) => handleVote(item.id, e)}
                  color={item.has_voted ? 'primary' : 'default'}
                >
                  {item.has_voted ? <ThumbUp /> : <ThumbUpOutlined />}
                </IconButton>
              </Tooltip>
              <Typography variant="caption" color="text.secondary">
                {item.votes_count}
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );

  const QuarterSection = ({ quarter, items }) => (
    <Box sx={{ mb: 4 }}>
      <Paper
        sx={{
          p: 2,
          mb: 2,
          backgroundColor: 'primary.main',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Schedule sx={{ mr: 1 }} />
          <Typography variant="h6">{quarter}</Typography>
        </Box>
        <Chip
          label={`${items.length} items`}
          size="small"
          sx={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'white' }}
        />
      </Paper>

      {items.map((item, index) => (
        <TimelineItem
          key={item.id}
          item={item}
          isLast={index === items.length - 1}
        />
      ))}
    </Box>
  );

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Roadmap Timeline
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Our product roadmap organized by quarter
        </Typography>
      </Box>

      {/* Filters & View Toggle */}
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
            <InputLabel>Status</InputLabel>
            <Select
              value={filters.status}
              label="Status"
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="planned">Planned</MenuItem>
              <MenuItem value="in_progress">In Progress</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
            </Select>
          </FormControl>
        </Box>

        <Box sx={{ display: 'flex', gap: 2 }}>
          <Tabs value="timeline" sx={{ minHeight: 40 }}>
            <Tab
              icon={<ViewKanban />}
              value="board"
              component={Link}
              to="/roadmap"
              sx={{ minHeight: 40, minWidth: 60 }}
            />
            <Tab
              icon={<Timeline />}
              value="timeline"
              sx={{ minHeight: 40, minWidth: 60 }}
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

      {/* Timeline View */}
      {!loading && (
        <Box>
          {sortedQuarters.map(quarter => (
            <QuarterSection
              key={quarter}
              quarter={quarter}
              items={groupedByQuarter[quarter]}
            />
          ))}

          {sortedQuarters.length === 0 && (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="h6" color="text.secondary">
                No roadmap items yet
              </Typography>
              <Button
                variant="contained"
                startIcon={<Add />}
                component={Link}
                to="/feature-requests/new"
                sx={{ mt: 2 }}
              >
                Request a Feature
              </Button>
            </Paper>
          )}
        </Box>
      )}

      {/* Legend */}
      <Paper sx={{ p: 2, mt: 4 }}>
        <Typography variant="subtitle2" gutterBottom>
          Status Legend
        </Typography>
        <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {Object.entries(statusConfig).map(([key, config]) => (
            <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  backgroundColor: config.color
                }}
              />
              <Typography variant="body2">{config.label}</Typography>
            </Box>
          ))}
        </Box>
      </Paper>
    </Container>
  );
}

export default RoadmapTimeline;
