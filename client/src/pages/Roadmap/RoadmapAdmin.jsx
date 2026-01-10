import React, { useState, useEffect } from 'react';
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  LinearProgress,
  Paper,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tab,
  Switch,
  FormControlLabel,
  Tooltip,
  Divider
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Transform,
  Visibility,
  VisibilityOff,
  Schedule,
  CheckCircle,
  PlayCircle,
  Close,
  Pending,
  Preview
} from '@mui/icons-material';
import api from '../../utils/api';

const statusConfig = {
  planned: { label: 'Planned', color: '#2196f3' },
  in_progress: { label: 'In Progress', color: '#ff9800' },
  completed: { label: 'Completed', color: '#4caf50' },
  cancelled: { label: 'Cancelled', color: '#9e9e9e' }
};

const requestStatusConfig = {
  pending: { label: 'Pending', color: '#9e9e9e' },
  reviewing: { label: 'Reviewing', color: '#2196f3' },
  planned: { label: 'Planned', color: '#4caf50' },
  declined: { label: 'Declined', color: '#f44336' }
};

const priorityOptions = ['low', 'medium', 'high', 'critical'];
const categoryOptions = ['feature', 'improvement', 'integration', 'api'];
const quarterOptions = ['Q1 2025', 'Q2 2025', 'Q3 2025', 'Q4 2025', 'Q1 2026', 'Q2 2026'];

function RoadmapAdmin() {
  const [activeTab, setActiveTab] = useState(0);
  const [items, setItems] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Dialog states
  const [itemDialog, setItemDialog] = useState({ open: false, item: null });
  const [convertDialog, setConvertDialog] = useState({ open: false, request: null });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, item: null });

  // Form state for creating/editing items
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    detailed_description: '',
    status: 'planned',
    priority: 'medium',
    category: 'feature',
    quarter: '',
    estimated_date: '',
    is_public: true
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [itemsRes, requestsRes] = await Promise.all([
        api.get('/api/roadmap/admin/items'),
        api.get('/api/roadmap/admin/feature-requests')
      ]);
      setItems(itemsRes.data.items);
      setRequests(requestsRes.data.requests);
      setError(null);
    } catch (err) {
      setError('Failed to load data');
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenItemDialog = (item = null) => {
    if (item) {
      setFormData({
        title: item.title,
        description: item.description || '',
        detailed_description: item.detailed_description || '',
        status: item.status,
        priority: item.priority,
        category: item.category || 'feature',
        quarter: item.quarter || '',
        estimated_date: item.estimated_date ? item.estimated_date.split('T')[0] : '',
        is_public: item.is_public
      });
    } else {
      setFormData({
        title: '',
        description: '',
        detailed_description: '',
        status: 'planned',
        priority: 'medium',
        category: 'feature',
        quarter: '',
        estimated_date: '',
        is_public: true
      });
    }
    setItemDialog({ open: true, item });
  };

  const handleSaveItem = async () => {
    try {
      if (itemDialog.item) {
        // Update
        await api.put(`/api/roadmap/admin/items/${itemDialog.item.id}`, formData);
        setSuccess('Roadmap item updated');
      } else {
        // Create
        await api.post('/api/roadmap/admin/items', formData);
        setSuccess('Roadmap item created');
      }
      setItemDialog({ open: false, item: null });
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save item');
    }
  };

  const handleDeleteItem = async () => {
    try {
      await api.delete(`/api/roadmap/admin/items/${deleteDialog.item.id}`);
      setSuccess('Roadmap item deleted');
      setDeleteDialog({ open: false, item: null });
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete item');
    }
  };

  const handleUpdateRequestStatus = async (requestId, status) => {
    try {
      await api.put(`/api/roadmap/admin/feature-requests/${requestId}/status`, { status });
      setSuccess('Status updated');
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update status');
    }
  };

  const handleConvertRequest = async () => {
    try {
      await api.post(`/api/roadmap/admin/feature-requests/${convertDialog.request.id}/convert`, {
        priority: formData.priority,
        quarter: formData.quarter,
        estimated_date: formData.estimated_date || null
      });
      setSuccess('Feature request converted to roadmap item');
      setConvertDialog({ open: false, request: null });
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to convert request');
    }
  };

  const openConvertDialog = (request) => {
    setFormData({
      ...formData,
      priority: 'medium',
      quarter: '',
      estimated_date: ''
    });
    setConvertDialog({ open: true, request });
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Roadmap Admin
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage roadmap items and feature requests
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => handleOpenItemDialog()}
        >
          New Roadmap Item
        </Button>
      </Box>

      {/* Alerts */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {/* Loading */}
      {loading && <LinearProgress sx={{ mb: 3 }} />}

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)}>
          <Tab label={`Roadmap Items (${items.length})`} />
          <Tab label={`Feature Requests (${requests.length})`} />
        </Tabs>
      </Paper>

      {/* Roadmap Items Tab */}
      {activeTab === 0 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Priority</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Quarter</TableCell>
                <TableCell>Votes</TableCell>
                <TableCell>Public</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map(item => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {item.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {item.slug}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={statusConfig[item.status]?.label}
                      sx={{
                        backgroundColor: statusConfig[item.status]?.color,
                        color: 'white'
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={item.priority} />
                  </TableCell>
                  <TableCell>{item.category}</TableCell>
                  <TableCell>{item.quarter || '-'}</TableCell>
                  <TableCell>{item.votes_count}</TableCell>
                  <TableCell>
                    {item.is_public ? (
                      <Visibility color="success" />
                    ) : (
                      <VisibilityOff color="disabled" />
                    )}
                  </TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={() => handleOpenItemDialog(item)}>
                      <Edit />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => setDeleteDialog({ open: true, item })}
                    >
                      <Delete />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    No roadmap items yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Feature Requests Tab */}
      {activeTab === 1 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Submitted By</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Votes</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {requests.map(request => (
                <TableRow key={request.id}>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {request.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {request.description.substring(0, 100)}...
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{request.user_name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {request.user_email}
                    </Typography>
                  </TableCell>
                  <TableCell>{request.category}</TableCell>
                  <TableCell>
                    <FormControl size="small" sx={{ minWidth: 120 }}>
                      <Select
                        value={request.status}
                        onChange={(e) => handleUpdateRequestStatus(request.id, e.target.value)}
                        disabled={!!request.roadmap_item_id}
                      >
                        <MenuItem value="pending">Pending</MenuItem>
                        <MenuItem value="reviewing">Reviewing</MenuItem>
                        <MenuItem value="planned">Planned</MenuItem>
                        <MenuItem value="declined">Declined</MenuItem>
                      </Select>
                    </FormControl>
                  </TableCell>
                  <TableCell>{request.votes_count}</TableCell>
                  <TableCell>
                    {new Date(request.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {request.roadmap_item_id ? (
                      <Chip size="small" label="Converted" color="success" />
                    ) : (
                      <Tooltip title="Convert to roadmap item">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => openConvertDialog(request)}
                        >
                          <Transform />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {requests.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    No feature requests yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Create/Edit Item Dialog */}
      <Dialog
        open={itemDialog.open}
        onClose={() => setItemDialog({ open: false, item: null })}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {itemDialog.item ? 'Edit Roadmap Item' : 'Create Roadmap Item'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TextField
              fullWidth
              label="Title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              required
            />

            <TextField
              fullWidth
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              multiline
              rows={2}
            />

            <TextField
              fullWidth
              label="Detailed Description"
              value={formData.detailed_description}
              onChange={(e) => setFormData(prev => ({ ...prev, detailed_description: e.target.value }))}
              multiline
              rows={4}
            />

            <Grid container spacing={2}>
              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={formData.status}
                    label="Status"
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                  >
                    <MenuItem value="planned">Planned</MenuItem>
                    <MenuItem value="in_progress">In Progress</MenuItem>
                    <MenuItem value="completed">Completed</MenuItem>
                    <MenuItem value="cancelled">Cancelled</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Priority</InputLabel>
                  <Select
                    value={formData.priority}
                    label="Priority"
                    onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value }))}
                  >
                    {priorityOptions.map(p => (
                      <MenuItem key={p} value={p}>{p}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            <Grid container spacing={2}>
              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={formData.category}
                    label="Category"
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  >
                    {categoryOptions.map(c => (
                      <MenuItem key={c} value={c}>{c}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Quarter</InputLabel>
                  <Select
                    value={formData.quarter}
                    label="Quarter"
                    onChange={(e) => setFormData(prev => ({ ...prev, quarter: e.target.value }))}
                  >
                    <MenuItem value="">None</MenuItem>
                    {quarterOptions.map(q => (
                      <MenuItem key={q} value={q}>{q}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            <TextField
              fullWidth
              label="Estimated Date"
              type="date"
              value={formData.estimated_date}
              onChange={(e) => setFormData(prev => ({ ...prev, estimated_date: e.target.value }))}
              InputLabelProps={{ shrink: true }}
            />

            <FormControlLabel
              control={
                <Switch
                  checked={formData.is_public}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_public: e.target.checked }))}
                />
              }
              label="Public (visible on roadmap)"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setItemDialog({ open: false, item: null })}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveItem}
            disabled={!formData.title.trim()}
          >
            {itemDialog.item ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Convert Request Dialog */}
      <Dialog
        open={convertDialog.open}
        onClose={() => setConvertDialog({ open: false, request: null })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Convert to Roadmap Item</DialogTitle>
        <DialogContent>
          {convertDialog.request && (
            <Box sx={{ pt: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                {convertDialog.request.title}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                {convertDialog.request.description}
              </Typography>

              <Divider sx={{ my: 2 }} />

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <FormControl fullWidth>
                  <InputLabel>Priority</InputLabel>
                  <Select
                    value={formData.priority}
                    label="Priority"
                    onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value }))}
                  >
                    {priorityOptions.map(p => (
                      <MenuItem key={p} value={p}>{p}</MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl fullWidth>
                  <InputLabel>Quarter</InputLabel>
                  <Select
                    value={formData.quarter}
                    label="Quarter"
                    onChange={(e) => setFormData(prev => ({ ...prev, quarter: e.target.value }))}
                  >
                    <MenuItem value="">None</MenuItem>
                    {quarterOptions.map(q => (
                      <MenuItem key={q} value={q}>{q}</MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <TextField
                  fullWidth
                  label="Estimated Date"
                  type="date"
                  value={formData.estimated_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, estimated_date: e.target.value }))}
                  InputLabelProps={{ shrink: true }}
                />
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConvertDialog({ open: false, request: null })}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleConvertRequest}
            startIcon={<Transform />}
          >
            Convert
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, item: null })}
      >
        <DialogTitle>Delete Roadmap Item</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{deleteDialog.item?.title}"?
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, item: null })}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeleteItem}
            startIcon={<Delete />}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default RoadmapAdmin;
