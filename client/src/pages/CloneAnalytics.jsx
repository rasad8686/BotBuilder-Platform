/**
 * Clone Analytics Page
 * Performance metrics and usage analytics dashboard
 */

import React, { useState, useEffect } from 'react';
import {
  Box, Grid, Card, CardContent, Typography, Select, MenuItem,
  FormControl, InputLabel, CircularProgress, Alert, Tabs, Tab,
  Table, TableBody, TableCell, TableHead, TableRow, Chip,
  LinearProgress, Paper, Divider, IconButton, Tooltip
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  AccessTime as TimeIcon,
  Star as StarIcon,
  Message as MessageIcon,
  Speed as SpeedIcon,
  CompareArrows as CompareIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon
} from '@mui/icons-material';
import { useParams } from 'react-router-dom';

const CloneAnalytics = () => {
  const { cloneId } = useParams();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState('30d');
  const [tabValue, setTabValue] = useState(0);
  const [clones, setClones] = useState([]);
  const [selectedClone, setSelectedClone] = useState(cloneId || '');

  useEffect(() => {
    fetchClones();
  }, []);

  useEffect(() => {
    if (selectedClone) {
      fetchAnalytics();
    }
  }, [selectedClone, period]);

  const fetchClones = async () => {
    try {
      const response = await fetch('/api/clones');
      const data = await response.json();
      if (data.success) {
        setClones(data.clones);
        if (!selectedClone && data.clones.length > 0) {
          setSelectedClone(data.clones[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch clones', err);
    }
  };

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ period });
      const response = await fetch(`/api/clones/${selectedClone}/analytics?${params}`);
      const data = await response.json();

      if (data.success) {
        setAnalytics(data.analytics);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num?.toString() || '0';
  };

  const MetricCard = ({ title, value, subtitle, icon, trend, color = 'primary' }) => (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography color="text.secondary" variant="body2">
              {title}
            </Typography>
            <Typography variant="h4" sx={{ my: 1 }}>
              {value}
            </Typography>
            {subtitle && (
              <Typography variant="body2" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Box
              sx={{
                bgcolor: `${color}.light`,
                color: `${color}.main`,
                p: 1.5,
                borderRadius: 2
              }}
            >
              {icon}
            </Box>
            {trend !== undefined && (
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                {trend >= 0 ? (
                  <TrendingUpIcon fontSize="small" color="success" />
                ) : (
                  <TrendingDownIcon fontSize="small" color="error" />
                )}
                <Typography
                  variant="caption"
                  color={trend >= 0 ? 'success.main' : 'error.main'}
                >
                  {Math.abs(trend)}%
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  if (loading && !analytics) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Clone Analytics</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>Select Clone</InputLabel>
            <Select
              value={selectedClone}
              label="Select Clone"
              onChange={(e) => setSelectedClone(e.target.value)}
            >
              {clones.map((clone) => (
                <MenuItem key={clone.id} value={clone.id}>{clone.name}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl sx={{ minWidth: 120 }}>
            <InputLabel>Period</InputLabel>
            <Select
              value={period}
              label="Period"
              onChange={(e) => setPeriod(e.target.value)}
            >
              <MenuItem value="7d">Last 7 days</MenuItem>
              <MenuItem value="30d">Last 30 days</MenuItem>
              <MenuItem value="90d">Last 90 days</MenuItem>
              <MenuItem value="all">All time</MenuItem>
            </Select>
          </FormControl>

          <Tooltip title="Refresh">
            <IconButton onClick={fetchAnalytics}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {analytics && (
        <>
          {/* Clone Info */}
          <Paper sx={{ p: 2, mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="h6">{analytics.clone?.name}</Typography>
              <Chip
                label={analytics.clone?.status}
                color={analytics.clone?.status === 'ready' ? 'success' : 'default'}
                size="small"
              />
              {analytics.clone?.trainingScore > 0 && (
                <Chip
                  icon={<StarIcon />}
                  label={`Score: ${analytics.clone.trainingScore.toFixed(1)}`}
                  size="small"
                  variant="outlined"
                />
              )}
            </Box>
          </Paper>

          {/* Overview Metrics */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard
                title="Total Responses"
                value={formatNumber(analytics.overview?.totalResponses)}
                subtitle={`${analytics.overview?.activeDays || 0} active days`}
                icon={<MessageIcon />}
                color="primary"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard
                title="Average Rating"
                value={analytics.overview?.avgRating?.toFixed(1) || 'N/A'}
                subtitle={`${analytics.overview?.positiveRatings || 0} positive`}
                icon={<StarIcon />}
                color="warning"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard
                title="Avg Latency"
                value={`${analytics.overview?.avgLatencyMs || 0}ms`}
                subtitle={`Range: ${analytics.overview?.latencyRange?.min}-${analytics.overview?.latencyRange?.max}ms`}
                icon={<SpeedIcon />}
                color="info"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard
                title="Similarity Score"
                value={`${((analytics.overview?.avgSimilarity || 0) * 100).toFixed(0)}%`}
                subtitle={`Edit rate: ${analytics.overview?.editRate || 0}%`}
                icon={<CompareIcon />}
                color="success"
              />
            </Grid>
          </Grid>

          {/* Tabs */}
          <Paper sx={{ mb: 3 }}>
            <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
              <Tab label="Usage" />
              <Tab label="Quality" />
              <Tab label="Training" />
              <Tab label="Comparison" />
            </Tabs>
          </Paper>

          {/* Tab Content */}
          {tabValue === 0 && (
            <Grid container spacing={3}>
              {/* Response Types */}
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Response Types</Typography>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Type</TableCell>
                          <TableCell align="right">Count</TableCell>
                          <TableCell align="right">Avg Rating</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {analytics.responseTypes?.map((type) => (
                          <TableRow key={type.type}>
                            <TableCell>{type.type}</TableCell>
                            <TableCell align="right">{type.count}</TableCell>
                            <TableCell align="right">{type.avgRating?.toFixed(1) || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </Grid>

              {/* Token Usage */}
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Token Usage</Typography>
                    <Box sx={{ mt: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body2">Input Tokens</Typography>
                        <Typography variant="body2">
                          {formatNumber(analytics.overview?.tokenUsage?.input)}
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={analytics.overview?.tokenUsage?.input /
                          (analytics.overview?.tokenUsage?.total || 1) * 100}
                        sx={{ mb: 2 }}
                      />

                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body2">Output Tokens</Typography>
                        <Typography variant="body2">
                          {formatNumber(analytics.overview?.tokenUsage?.output)}
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={analytics.overview?.tokenUsage?.output /
                          (analytics.overview?.tokenUsage?.total || 1) * 100}
                        color="secondary"
                        sx={{ mb: 2 }}
                      />

                      <Divider sx={{ my: 2 }} />
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="subtitle2">Total</Typography>
                        <Typography variant="subtitle2">
                          {formatNumber(analytics.overview?.tokenUsage?.total)}
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}

          {tabValue === 1 && (
            <Grid container spacing={3}>
              {/* Rating Distribution */}
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Rating Distribution</Typography>
                    {analytics.quality?.ratingDistribution?.map((item) => (
                      <Box key={item.rating} sx={{ mb: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            {[...Array(5)].map((_, i) => (
                              <StarIcon
                                key={i}
                                fontSize="small"
                                color={i < item.rating ? 'warning' : 'disabled'}
                              />
                            ))}
                          </Box>
                          <Typography variant="body2">{item.count}</Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={(item.count / analytics.overview?.totalResponses) * 100}
                        />
                      </Box>
                    ))}
                  </CardContent>
                </Card>
              </Grid>

              {/* Quality Distribution */}
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Quality Levels</Typography>
                    {analytics.quality?.qualityDistribution?.map((item) => (
                      <Box key={item.level} sx={{ mb: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                          <Chip
                            label={item.level.replace('_', ' ')}
                            size="small"
                            color={
                              item.level === 'excellent' ? 'success' :
                              item.level === 'good' ? 'primary' :
                              item.level === 'fair' ? 'warning' : 'error'
                            }
                          />
                          <Typography variant="body2">{item.count}</Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={(item.count / analytics.overview?.totalResponses) * 100}
                          color={
                            item.level === 'excellent' ? 'success' :
                            item.level === 'good' ? 'primary' :
                            item.level === 'fair' ? 'warning' : 'error'
                          }
                        />
                      </Box>
                    ))}
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}

          {tabValue === 2 && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Training Data</Typography>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Total samples: {analytics.training?.totalSamples || 0}
                    </Typography>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Type</TableCell>
                          <TableCell align="right">Count</TableCell>
                          <TableCell align="right">Avg Quality</TableCell>
                          <TableCell align="right">Processed</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {analytics.training?.byType?.map((item) => (
                          <TableRow key={item.type}>
                            <TableCell>{item.type}</TableCell>
                            <TableCell align="right">{item.count}</TableCell>
                            <TableCell align="right">{item.avgQuality?.toFixed(1) || '-'}</TableCell>
                            <TableCell align="right">{item.processedCount}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}

          {tabValue === 3 && (
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Clone Comparison</Typography>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Clone</TableCell>
                          <TableCell align="right">Responses</TableCell>
                          <TableCell align="right">Avg Rating</TableCell>
                          <TableCell align="right">Similarity</TableCell>
                          <TableCell align="right">Training Score</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {analytics.comparison?.map((clone) => (
                          <TableRow
                            key={clone.id}
                            sx={{ bgcolor: clone.isCurrent ? 'action.selected' : 'inherit' }}
                          >
                            <TableCell>
                              {clone.name}
                              {clone.isCurrent && (
                                <Chip label="Current" size="small" sx={{ ml: 1 }} />
                              )}
                            </TableCell>
                            <TableCell align="right">{clone.responseCount}</TableCell>
                            <TableCell align="right">{clone.avgRating?.toFixed(1) || '-'}</TableCell>
                            <TableCell align="right">
                              {clone.avgSimilarity ? `${(clone.avgSimilarity * 100).toFixed(0)}%` : '-'}
                            </TableCell>
                            <TableCell align="right">{clone.trainingScore?.toFixed(1) || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}
        </>
      )}
    </Box>
  );
};

export default CloneAnalytics;
