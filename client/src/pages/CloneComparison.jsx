/**
 * Clone Comparison Page
 * Compare two clones side by side
 */

import React, { useState, useEffect } from 'react';
import {
  Box, Grid, Card, CardContent, Typography, Button, FormControl,
  InputLabel, Select, MenuItem, CircularProgress, Alert, Table,
  TableBody, TableCell, TableHead, TableRow, Chip, LinearProgress,
  Paper, Divider, Avatar
} from '@mui/material';
import {
  CompareArrows as CompareIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Star as StarIcon,
  Speed as SpeedIcon,
  Message as MessageIcon,
  EmojiEvents as TrophyIcon
} from '@mui/icons-material';

const CloneComparison = () => {
  const [clones, setClones] = useState([]);
  const [clone1, setClone1] = useState('');
  const [clone2, setClone2] = useState('');
  const [comparison, setComparison] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetchingClones, setFetchingClones] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchClones();
  }, []);

  const fetchClones = async () => {
    try {
      const response = await fetch('/api/clones');
      const data = await response.json();
      if (data.success) {
        setClones(data.clones);
      }
    } catch (err) {
      setError('Failed to load clones');
    } finally {
      setFetchingClones(false);
    }
  };

  const handleCompare = async () => {
    if (!clone1 || !clone2) return;

    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/clones/${clone1}/compare/${clone2}`);
      const data = await response.json();

      if (data.success) {
        setComparison(data.comparison);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to compare clones');
    } finally {
      setLoading(false);
    }
  };

  const getWinnerStyles = (index, winner) => {
    if (winner === 0) return {}; // Tie
    if (winner === index + 1) {
      return { bgcolor: 'success.light', color: 'success.dark' };
    }
    return {};
  };

  const formatMetricValue = (value, type) => {
    if (value === null || value === undefined) return 'N/A';

    switch (type) {
      case 'rating':
        return value.toFixed(1);
      case 'percentage':
        return `${(value * 100).toFixed(0)}%`;
      case 'latency':
        return `${value}ms`;
      case 'tokens':
        return value.toLocaleString();
      default:
        return value.toString();
    }
  };

  const MetricRow = ({ label, values, type, higherIsBetter = true }) => {
    const v1 = values[0];
    const v2 = values[1];

    let winner = 0;
    if (v1 !== null && v2 !== null && v1 !== v2) {
      if (higherIsBetter) {
        winner = v1 > v2 ? 1 : 2;
      } else {
        winner = v1 < v2 ? 1 : 2;
      }
    }

    return (
      <TableRow>
        <TableCell>{label}</TableCell>
        <TableCell
          align="center"
          sx={winner === 1 ? { bgcolor: 'success.light', fontWeight: 'bold' } : {}}
        >
          {formatMetricValue(v1, type)}
          {winner === 1 && <TrophyIcon sx={{ ml: 1, fontSize: 16, color: 'warning.main' }} />}
        </TableCell>
        <TableCell
          align="center"
          sx={winner === 2 ? { bgcolor: 'success.light', fontWeight: 'bold' } : {}}
        >
          {formatMetricValue(v2, type)}
          {winner === 2 && <TrophyIcon sx={{ ml: 1, fontSize: 16, color: 'warning.main' }} />}
        </TableCell>
      </TableRow>
    );
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>Compare Clones</Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Clone Selection */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={5}>
            <FormControl fullWidth>
              <InputLabel>First Clone</InputLabel>
              <Select
                value={clone1}
                label="First Clone"
                onChange={(e) => setClone1(e.target.value)}
                disabled={fetchingClones}
              >
                {clones.map((clone) => (
                  <MenuItem
                    key={clone.id}
                    value={clone.id}
                    disabled={clone.id === clone2}
                  >
                    {clone.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={2} sx={{ textAlign: 'center' }}>
            <CompareIcon sx={{ fontSize: 40, color: 'text.secondary' }} />
          </Grid>

          <Grid item xs={12} md={5}>
            <FormControl fullWidth>
              <InputLabel>Second Clone</InputLabel>
              <Select
                value={clone2}
                label="Second Clone"
                onChange={(e) => setClone2(e.target.value)}
                disabled={fetchingClones}
              >
                {clones.map((clone) => (
                  <MenuItem
                    key={clone.id}
                    value={clone.id}
                    disabled={clone.id === clone1}
                  >
                    {clone.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        <Box sx={{ textAlign: 'center', mt: 3 }}>
          <Button
            variant="contained"
            size="large"
            startIcon={loading ? <CircularProgress size={20} /> : <CompareIcon />}
            onClick={handleCompare}
            disabled={!clone1 || !clone2 || loading}
          >
            {loading ? 'Comparing...' : 'Compare Clones'}
          </Button>
        </Box>
      </Paper>

      {/* Comparison Results */}
      {comparison && (
        <>
          {/* Winner Banner */}
          {comparison.winner && comparison.winner.winner !== 0 && (
            <Paper
              sx={{
                p: 2,
                mb: 3,
                bgcolor: 'success.light',
                textAlign: 'center'
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                <TrophyIcon sx={{ fontSize: 32, color: 'warning.main' }} />
                <Typography variant="h6">
                  {comparison.clones[comparison.winner.winner - 1].name} wins!
                </Typography>
                <Chip label={`Score: ${comparison.winner.score}`} color="success" />
              </Box>
            </Paper>
          )}

          {/* Clone Headers */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            {comparison.clones.map((clone, index) => (
              <Grid item xs={6} key={clone.id}>
                <Card sx={getWinnerStyles(index, comparison.winner?.winner)}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Avatar sx={{ bgcolor: index === 0 ? 'primary.main' : 'secondary.main' }}>
                        {clone.name[0]}
                      </Avatar>
                      <Box>
                        <Typography variant="h6">{clone.name}</Typography>
                        {comparison.winner?.winner === index + 1 && (
                          <Chip
                            icon={<TrophyIcon />}
                            label="Winner"
                            size="small"
                            color="warning"
                          />
                        )}
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {/* Metrics Comparison Table */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Performance Metrics</Typography>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Metric</TableCell>
                    <TableCell align="center">{comparison.clones[0].name}</TableCell>
                    <TableCell align="center">{comparison.clones[1].name}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <MetricRow
                    label="Total Responses"
                    values={comparison.metrics.totalResponses}
                    type="number"
                  />
                  <MetricRow
                    label="Average Rating"
                    values={comparison.metrics.avgRating}
                    type="rating"
                  />
                  <MetricRow
                    label="Average Latency"
                    values={comparison.metrics.avgLatency}
                    type="latency"
                    higherIsBetter={false}
                  />
                  <MetricRow
                    label="Similarity Score"
                    values={comparison.metrics.avgSimilarity}
                    type="percentage"
                  />
                  <MetricRow
                    label="Edit Rate"
                    values={comparison.metrics.editRate}
                    type="percentage"
                    higherIsBetter={false}
                  />
                  <MetricRow
                    label="Token Usage"
                    values={comparison.metrics.tokenUsage}
                    type="tokens"
                  />
                  <MetricRow
                    label="Training Score"
                    values={comparison.metrics.trainingScore}
                    type="rating"
                  />
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Visual Comparison */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Visual Comparison</Typography>

              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" gutterBottom>Rating</Typography>
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <Box sx={{ flex: 1 }}>
                      <LinearProgress
                        variant="determinate"
                        value={(comparison.metrics.avgRating[0] / 5) * 100}
                        sx={{ height: 20, borderRadius: 1 }}
                      />
                    </Box>
                    <Typography variant="body2" sx={{ width: 50 }}>
                      {comparison.metrics.avgRating[0]?.toFixed(1) || 'N/A'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mt: 1 }}>
                    <Box sx={{ flex: 1 }}>
                      <LinearProgress
                        variant="determinate"
                        value={(comparison.metrics.avgRating[1] / 5) * 100}
                        color="secondary"
                        sx={{ height: 20, borderRadius: 1 }}
                      />
                    </Box>
                    <Typography variant="body2" sx={{ width: 50 }}>
                      {comparison.metrics.avgRating[1]?.toFixed(1) || 'N/A'}
                    </Typography>
                  </Box>
                </Grid>

                <Grid item xs={12}>
                  <Typography variant="subtitle2" gutterBottom>Similarity</Typography>
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <Box sx={{ flex: 1 }}>
                      <LinearProgress
                        variant="determinate"
                        value={(comparison.metrics.avgSimilarity[0] || 0) * 100}
                        sx={{ height: 20, borderRadius: 1 }}
                      />
                    </Box>
                    <Typography variant="body2" sx={{ width: 50 }}>
                      {comparison.metrics.avgSimilarity[0]
                        ? `${(comparison.metrics.avgSimilarity[0] * 100).toFixed(0)}%`
                        : 'N/A'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mt: 1 }}>
                    <Box sx={{ flex: 1 }}>
                      <LinearProgress
                        variant="determinate"
                        value={(comparison.metrics.avgSimilarity[1] || 0) * 100}
                        color="secondary"
                        sx={{ height: 20, borderRadius: 1 }}
                      />
                    </Box>
                    <Typography variant="body2" sx={{ width: 50 }}>
                      {comparison.metrics.avgSimilarity[1]
                        ? `${(comparison.metrics.avgSimilarity[1] * 100).toFixed(0)}%`
                        : 'N/A'}
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Recommendations */}
          {comparison.recommendations && comparison.recommendations.length > 0 && (
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Recommendations</Typography>
                <Box component="ul" sx={{ m: 0, pl: 3 }}>
                  {comparison.recommendations.map((rec, index) => (
                    <Typography component="li" key={index} variant="body2" sx={{ mb: 1 }}>
                      {rec}
                    </Typography>
                  ))}
                </Box>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Empty State */}
      {!comparison && !loading && (
        <Paper sx={{ p: 5, textAlign: 'center' }}>
          <CompareIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            Select two clones to compare their performance
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Compare ratings, latency, similarity scores, and more
          </Typography>
        </Paper>
      )}
    </Box>
  );
};

export default CloneComparison;
