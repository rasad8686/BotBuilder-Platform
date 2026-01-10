import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  Alert,
  Snackbar,
  CircularProgress,
  Tooltip,
  Card,
  CardContent,
  Grid,
  Tabs,
  Tab,
  LinearProgress,
  Collapse,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TablePagination
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  Cancel as CancelIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Schedule as ScheduleIcon,
  CloudUpload as CloudUploadIcon,
  Code as CodeIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  ContentCopy as CopyIcon,
  Visibility as VisibilityIcon
} from '@mui/icons-material';
import api from '../../utils/api';

const BatchJobs = () => {
  // State
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [resultsDialogOpen, setResultsDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Selected items
  const [selectedJob, setSelectedJob] = useState(null);
  const [jobResults, setJobResults] = useState([]);
  const [resultsPage, setResultsPage] = useState(0);
  const [resultsTotalCount, setResultsTotalCount] = useState(0);

  // Form states
  const [createTab, setCreateTab] = useState(0);
  const [jobName, setJobName] = useState('');
  const [requestsJson, setRequestsJson] = useState('[\n  {\n    "method": "GET",\n    "endpoint": "/api/bots"\n  }\n]');
  const [uploadedFile, setUploadedFile] = useState(null);
  const [creating, setCreating] = useState(false);

  // Auto-refresh for running jobs
  const refreshIntervalRef = useRef(null);

  // Fetch batch jobs
  const fetchJobs = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page + 1,
        limit: rowsPerPage
      });
      if (statusFilter) {
        params.append('status', statusFilter);
      }

      const response = await api.get(`/api/batch/jobs?${params}`);
      setJobs(response.data.data || []);
      setTotalCount(response.data.pagination?.totalCount || 0);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load batch jobs');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, statusFilter]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Auto-refresh when there are running jobs
  useEffect(() => {
    const hasRunningJobs = jobs.some(job => ['pending', 'processing'].includes(job.status));

    if (hasRunningJobs) {
      refreshIntervalRef.current = setInterval(fetchJobs, 5000);
    } else if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [jobs, fetchJobs]);

  // Show snackbar
  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  // Create batch job
  const handleCreate = async () => {
    try {
      setCreating(true);

      let formData;

      if (createTab === 0) {
        // JSON input
        let requests;
        try {
          requests = JSON.parse(requestsJson);
        } catch (e) {
          showSnackbar('Invalid JSON format', 'error');
          return;
        }

        formData = new FormData();
        formData.append('requests', JSON.stringify(requests));
        if (jobName) {
          formData.append('name', jobName);
        }
      } else {
        // File upload
        if (!uploadedFile) {
          showSnackbar('Please select a file', 'error');
          return;
        }

        formData = new FormData();
        formData.append('file', uploadedFile);
        if (jobName) {
          formData.append('name', jobName);
        }
      }

      await api.post('/api/batch/jobs', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      showSnackbar('Batch job created successfully');
      setCreateDialogOpen(false);
      resetCreateForm();
      fetchJobs();
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Failed to create batch job', 'error');
    } finally {
      setCreating(false);
    }
  };

  // Reset create form
  const resetCreateForm = () => {
    setJobName('');
    setRequestsJson('[\n  {\n    "method": "GET",\n    "endpoint": "/api/bots"\n  }\n]');
    setUploadedFile(null);
    setCreateTab(0);
  };

  // Cancel job
  const handleCancel = async (jobId) => {
    try {
      await api.post(`/api/batch/jobs/${jobId}/cancel`);
      showSnackbar('Batch job cancelled');
      fetchJobs();
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Failed to cancel job', 'error');
    }
  };

  // Delete job
  const handleDelete = async () => {
    try {
      await api.delete(`/api/batch/jobs/${selectedJob.id}`);
      showSnackbar('Batch job deleted');
      setDeleteDialogOpen(false);
      setSelectedJob(null);
      fetchJobs();
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Failed to delete job', 'error');
    }
  };

  // View results
  const handleViewResults = async (job) => {
    setSelectedJob(job);
    setResultsPage(0);
    await fetchResults(job.id, 0);
    setResultsDialogOpen(true);
  };

  // Fetch results
  const fetchResults = async (jobId, page) => {
    try {
      const response = await api.get(`/api/batch/jobs/${jobId}/results?page=${page + 1}&limit=20`);
      setJobResults(response.data.data || []);
      setResultsTotalCount(response.data.pagination?.totalCount || 0);
    } catch (err) {
      showSnackbar('Failed to load results', 'error');
    }
  };

  // Download results
  const handleDownload = async (jobId) => {
    try {
      const response = await api.get(`/api/batch/jobs/${jobId}/download`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `batch-results-${jobId}.jsonl`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      showSnackbar('Download started');
    } catch (err) {
      showSnackbar('Failed to download results', 'error');
    }
  };

  // Handle file upload
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        showSnackbar('File size must be less than 10MB', 'error');
        return;
      }
      setUploadedFile(file);
    }
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'success';
      case 'failed': return 'error';
      case 'processing': return 'info';
      case 'pending': return 'warning';
      case 'cancelled': return 'default';
      default: return 'default';
    }
  };

  // Get status icon
  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return <CheckCircleIcon />;
      case 'failed': return <ErrorIcon />;
      case 'processing': return <PlayIcon />;
      case 'pending': return <ScheduleIcon />;
      case 'cancelled': return <CancelIcon />;
      default: return null;
    }
  };

  // Format date
  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Format duration
  const formatDuration = (startedAt, completedAt) => {
    if (!startedAt) return '-';
    const start = new Date(startedAt);
    const end = completedAt ? new Date(completedAt) : new Date();
    const diff = Math.floor((end - start) / 1000);

    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ${diff % 60}s`;
    return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`;
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Batch Jobs
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Submit multiple API requests for asynchronous processing
          </Typography>
        </Box>
        <Box display="flex" gap={1}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchJobs}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateDialogOpen(true)}
          >
            Create Batch Job
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth size="small">
              <InputLabel>Status Filter</InputLabel>
              <Select
                value={statusFilter}
                label="Status Filter"
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(0);
                }}
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="processing">Processing</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="failed">Failed</MenuItem>
                <MenuItem value="cancelled">Cancelled</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      {/* Jobs Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell align="center">Status</TableCell>
              <TableCell align="center">Progress</TableCell>
              <TableCell align="right">Requests</TableCell>
              <TableCell>Duration</TableCell>
              <TableCell>Created</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && jobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : jobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">
                    No batch jobs yet. Create one to get started.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              jobs.map((job) => (
                <TableRow key={job.id} hover>
                  <TableCell>
                    <Typography fontWeight={500}>{job.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      ID: {job.id}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      icon={getStatusIcon(job.status)}
                      label={job.status}
                      color={getStatusColor(job.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="center" sx={{ width: 200 }}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <LinearProgress
                        variant="determinate"
                        value={job.progress}
                        sx={{ flex: 1, height: 8, borderRadius: 4 }}
                        color={job.failedRequests > 0 ? 'warning' : 'primary'}
                      />
                      <Typography variant="caption" sx={{ minWidth: 35 }}>
                        {job.progress}%
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">
                      <span style={{ color: 'green' }}>{job.completedRequests}</span>
                      {job.failedRequests > 0 && (
                        <span style={{ color: 'red' }}> / {job.failedRequests}</span>
                      )}
                      <span style={{ color: 'gray' }}> / {job.totalRequests}</span>
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {formatDuration(job.startedAt, job.completedAt)}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {formatDate(job.createdAt)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    {['pending', 'processing'].includes(job.status) && (
                      <Tooltip title="Cancel">
                        <IconButton
                          size="small"
                          color="warning"
                          onClick={() => handleCancel(job.id)}
                        >
                          <CancelIcon />
                        </IconButton>
                      </Tooltip>
                    )}
                    {['completed', 'failed'].includes(job.status) && (
                      <>
                        <Tooltip title="View Results">
                          <IconButton
                            size="small"
                            onClick={() => handleViewResults(job)}
                          >
                            <VisibilityIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Download Results">
                          <IconButton
                            size="small"
                            onClick={() => handleDownload(job.id)}
                          >
                            <DownloadIcon />
                          </IconButton>
                        </Tooltip>
                      </>
                    )}
                    <Tooltip title="Delete">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => {
                          setSelectedJob(job);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={totalCount}
          page={page}
          onPageChange={(e, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[10, 25, 50]}
        />
      </TableContainer>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create Batch Job</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Job Name (optional)"
            value={jobName}
            onChange={(e) => setJobName(e.target.value)}
            placeholder="My Batch Job"
            sx={{ mb: 3, mt: 1 }}
          />

          <Tabs value={createTab} onChange={(e, v) => setCreateTab(v)} sx={{ mb: 2 }}>
            <Tab label="JSON Input" icon={<CodeIcon />} iconPosition="start" />
            <Tab label="File Upload" icon={<CloudUploadIcon />} iconPosition="start" />
          </Tabs>

          {createTab === 0 && (
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Enter an array of requests in JSON format:
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={12}
                value={requestsJson}
                onChange={(e) => setRequestsJson(e.target.value)}
                sx={{
                  fontFamily: 'monospace',
                  '& textarea': { fontFamily: 'monospace', fontSize: '13px' }
                }}
              />
              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  Each request should have: <code>method</code> (GET, POST, etc.), <code>endpoint</code> (must start with /api/), and optional <code>body</code>
                </Typography>
              </Alert>
            </Box>
          )}

          {createTab === 1 && (
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Upload a JSONL file (one JSON object per line):
              </Typography>
              <Paper
                sx={{
                  p: 4,
                  border: '2px dashed',
                  borderColor: 'grey.300',
                  textAlign: 'center',
                  cursor: 'pointer',
                  '&:hover': { borderColor: 'primary.main' }
                }}
                component="label"
              >
                <input
                  type="file"
                  hidden
                  accept=".jsonl,.json"
                  onChange={handleFileUpload}
                />
                <CloudUploadIcon sx={{ fontSize: 48, color: 'grey.400', mb: 1 }} />
                <Typography>
                  {uploadedFile ? uploadedFile.name : 'Click to upload or drag and drop'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  JSONL files up to 10MB
                </Typography>
              </Paper>

              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '12px' }}>
                  {'{"method": "GET", "endpoint": "/api/bots"}'}<br />
                  {'{"method": "POST", "endpoint": "/api/bots", "body": {"name": "Test"}}'}
                </Typography>
              </Alert>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleCreate}
            variant="contained"
            disabled={creating}
            startIcon={creating ? <CircularProgress size={16} /> : <PlayIcon />}
          >
            {creating ? 'Creating...' : 'Create & Run'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Results Dialog */}
      <Dialog open={resultsDialogOpen} onClose={() => setResultsDialogOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          Batch Job Results - {selectedJob?.name}
        </DialogTitle>
        <DialogContent>
          {selectedJob && (
            <Box sx={{ mb: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={3}>
                  <Typography variant="body2" color="text.secondary">Total Requests</Typography>
                  <Typography variant="h6">{selectedJob.totalRequests}</Typography>
                </Grid>
                <Grid item xs={3}>
                  <Typography variant="body2" color="text.secondary">Completed</Typography>
                  <Typography variant="h6" color="success.main">{selectedJob.completedRequests}</Typography>
                </Grid>
                <Grid item xs={3}>
                  <Typography variant="body2" color="text.secondary">Failed</Typography>
                  <Typography variant="h6" color="error.main">{selectedJob.failedRequests}</Typography>
                </Grid>
                <Grid item xs={3}>
                  <Button
                    variant="outlined"
                    startIcon={<DownloadIcon />}
                    onClick={() => handleDownload(selectedJob.id)}
                    fullWidth
                  >
                    Download All
                  </Button>
                </Grid>
              </Grid>
            </Box>
          )}

          <Divider sx={{ my: 2 }} />

          <TableContainer sx={{ maxHeight: 400 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell>#</TableCell>
                  <TableCell>Request</TableCell>
                  <TableCell align="center">Status</TableCell>
                  <TableCell>Response</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {jobResults.map((result, index) => (
                  <TableRow key={index}>
                    <TableCell>{result.index + 1}</TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                        {result.request?.method} {result.request?.endpoint}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={result.status}
                        color={result.status === 'completed' ? 'success' : 'error'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {result.error ? (
                        <Typography variant="body2" color="error">
                          {result.error}
                        </Typography>
                      ) : (
                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                          {result.response?.status} - {result.response?.duration}ms
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
            component="div"
            count={resultsTotalCount}
            page={resultsPage}
            onPageChange={(e, newPage) => {
              setResultsPage(newPage);
              if (selectedJob) {
                fetchResults(selectedJob.id, newPage);
              }
            }}
            rowsPerPage={20}
            rowsPerPageOptions={[20]}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResultsDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Batch Job</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This action cannot be undone!
          </Alert>
          <Typography>
            Are you sure you want to delete <strong>{selectedJob?.name}</strong>?
            All results will be permanently deleted.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained">Delete</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default BatchJobs;
