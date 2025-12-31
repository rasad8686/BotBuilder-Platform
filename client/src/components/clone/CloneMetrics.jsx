/**
 * CloneMetrics Component
 * Display accuracy and quality metrics for clones
 */

import React from 'react';
import {
  Box, Paper, Typography, Grid, LinearProgress, Chip,
  Tooltip, CircularProgress as CircularProgressMUI
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Star as StarIcon,
  Speed as SpeedIcon,
  CompareArrows as SimilarityIcon,
  Edit as EditIcon,
  Check as CheckIcon,
  Message as MessageIcon
} from '@mui/icons-material';

// Custom circular progress with label
const CircularProgress = ({ value, size = 80, color = 'primary', label }) => (
  <Box sx={{ position: 'relative', display: 'inline-flex' }}>
    <CircularProgressMUI
      variant="determinate"
      value={value}
      size={size}
      color={color}
      thickness={4}
    />
    <Box
      sx={{
        top: 0,
        left: 0,
        bottom: 0,
        right: 0,
        position: 'absolute',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column'
      }}
    >
      <Typography variant="h6" component="div" color="text.primary">
        {value.toFixed(0)}%
      </Typography>
      {label && (
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
      )}
    </Box>
  </Box>
);

const MetricCard = ({ icon, label, value, subValue, trend, color = 'primary' }) => (
  <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
      <Box
        sx={{
          bgcolor: `${color}.light`,
          color: `${color}.main`,
          p: 1,
          borderRadius: 1
        }}
      >
        {icon}
      </Box>
      <Box sx={{ flexGrow: 1 }}>
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
          <Typography variant="h5">{value}</Typography>
          {trend !== undefined && (
            <Chip
              icon={trend >= 0 ? <TrendingUpIcon /> : <TrendingDownIcon />}
              label={`${trend >= 0 ? '+' : ''}${trend}%`}
              size="small"
              color={trend >= 0 ? 'success' : 'error'}
              variant="outlined"
            />
          )}
        </Box>
        {subValue && (
          <Typography variant="caption" color="text.secondary">
            {subValue}
          </Typography>
        )}
      </Box>
    </Box>
  </Paper>
);

const QualityBar = ({ label, value, maxValue = 5, color = 'primary' }) => {
  const percentage = (value / maxValue) * 100;

  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="body2">{label}</Typography>
        <Typography variant="body2" color="text.secondary">
          {value.toFixed(1)} / {maxValue}
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={percentage}
        color={color}
        sx={{ height: 8, borderRadius: 4 }}
      />
    </Box>
  );
};

const CloneMetrics = ({
  metrics = {},
  showDetailed = false,
  loading = false
}) => {
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgressMUI />
      </Box>
    );
  }

  const {
    trainingScore = 0,
    avgRating = 0,
    avgSimilarity = 0,
    avgLatency = 0,
    totalResponses = 0,
    editRate = 0,
    usageRate = 0,
    qualityBreakdown = {},
    trends = {}
  } = metrics;

  return (
    <Box>
      {/* Primary Metrics */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            icon={<StarIcon />}
            label="Training Score"
            value={trainingScore.toFixed(1)}
            subValue="out of 5.0"
            trend={trends.trainingScore}
            color="warning"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            icon={<SimilarityIcon />}
            label="Avg Similarity"
            value={`${(avgSimilarity * 100).toFixed(0)}%`}
            subValue="style match"
            trend={trends.similarity}
            color="success"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            icon={<SpeedIcon />}
            label="Avg Latency"
            value={`${avgLatency}ms`}
            subValue="response time"
            trend={trends.latency ? -trends.latency : undefined}
            color="info"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            icon={<MessageIcon />}
            label="Total Responses"
            value={totalResponses.toLocaleString()}
            subValue={`${editRate}% edited`}
            color="primary"
          />
        </Grid>
      </Grid>

      {/* Quality Overview */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="subtitle2" gutterBottom>
              Overall Quality
            </Typography>
            <CircularProgress
              value={avgRating * 20}
              color={avgRating >= 4 ? 'success' : avgRating >= 3 ? 'warning' : 'error'}
              label="Rating"
            />
            <Box sx={{ mt: 2 }}>
              <Chip
                icon={<StarIcon />}
                label={`${avgRating.toFixed(1)} / 5.0`}
                color={avgRating >= 4 ? 'success' : 'default'}
              />
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              Quality Breakdown
            </Typography>

            <QualityBar
              label="Accuracy"
              value={qualityBreakdown.accuracy || avgSimilarity * 5}
              color="success"
            />
            <QualityBar
              label="Relevance"
              value={qualityBreakdown.relevance || 4.2}
              color="primary"
            />
            <QualityBar
              label="Style Match"
              value={qualityBreakdown.styleMatch || avgSimilarity * 5}
              color="info"
            />
            <QualityBar
              label="Fluency"
              value={qualityBreakdown.fluency || 4.0}
              color="secondary"
            />
          </Paper>
        </Grid>
      </Grid>

      {/* Detailed Metrics */}
      {showDetailed && (
        <Paper sx={{ p: 3, mt: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Detailed Metrics
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={6} md={3}>
              <Box sx={{ textAlign: 'center', p: 2 }}>
                <Typography variant="h4" color="primary">
                  {(usageRate || 75).toFixed(0)}%
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Usage Rate
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} md={3}>
              <Box sx={{ textAlign: 'center', p: 2 }}>
                <Typography variant="h4" color="warning.main">
                  {(editRate || 15).toFixed(0)}%
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Edit Rate
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} md={3}>
              <Box sx={{ textAlign: 'center', p: 2 }}>
                <Typography variant="h4" color="success.main">
                  {(100 - editRate || 85).toFixed(0)}%
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  First-Pass Accept
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} md={3}>
              <Box sx={{ textAlign: 'center', p: 2 }}>
                <Typography variant="h4" color="info.main">
                  {avgLatency}ms
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Avg Response Time
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Paper>
      )}
    </Box>
  );
};

export default CloneMetrics;
